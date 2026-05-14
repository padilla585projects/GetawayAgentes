import { Database } from "@cloudflare/workers-types";
import { nanoid } from "./utils";

interface TaskRetry {
  attempt: number;
  maxAttempts: number;
  backoffMs: number;
  nextRetryTime?: number;
}

export class TaskManager {
  constructor(private db: Database) {}

  /**
   * Crea una tarea con retry automático
   */
  async createTaskWithRetry(data: {
    title: string;
    description?: string;
    mode: "broadcast" | "targeted" | "auto";
    assigned_agents?: string[];
    maxRetries?: number;
  }): Promise<string> {
    const taskId = nanoid();
    const maxRetries = data.maxRetries || 3;

    await this.db
      .prepare(
        `
        INSERT INTO tasks (id, title, description, mode, assigned_agents, status, retry_count, max_retries, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      )
      .bind(
        taskId,
        data.title,
        data.description || null,
        data.mode,
        JSON.stringify(data.assigned_agents || []),
        "pending",
        0,
        maxRetries,
        new Date().toISOString()
      )
      .run();

    return taskId;
  }

  /**
   * Reintentar una tarea fallida con backoff exponencial
   */
  async retryTask(
    taskId: string,
    reason: string
  ): Promise<{ success: boolean; nextRetryTime?: number }> {
    const task = await this.db
      .prepare("SELECT * FROM tasks WHERE id = ?")
      .bind(taskId)
      .first<{
        retry_count: number;
        max_retries: number;
      }>();

    if (!task) {
      return { success: false };
    }

    const nextAttempt = task.retry_count + 1;

    if (nextAttempt >= task.max_retries) {
      // Marcar como fallido permanentemente
      await this.db
        .prepare(
          "UPDATE tasks SET status = ?, completed_at = ? WHERE id = ?"
        )
        .bind("failed", new Date().toISOString(), taskId)
        .run();

      return { success: false };
    }

    // Calcular backoff exponencial: 2^attempt * 1000ms
    const backoffMs = Math.pow(2, nextAttempt) * 1000;
    const nextRetryTime = Date.now() + backoffMs;

    await this.db
      .prepare(
        `
        UPDATE tasks
        SET retry_count = ?, status = ?, retry_reason = ?, next_retry_time = ?
        WHERE id = ?
      `
      )
      .bind(
        nextAttempt,
        "pending_retry",
        reason,
        new Date(nextRetryTime).toISOString(),
        taskId
      )
      .run();

    return { success: true, nextRetryTime };
  }

  /**
   * Verificar tareas pendientes de reintento
   */
  async getPendingRetries(): Promise<string[]> {
    const now = new Date().toISOString();

    const tasks = await this.db
      .prepare(
        `
        SELECT id FROM tasks
        WHERE status = 'pending_retry'
        AND next_retry_time <= ?
        ORDER BY next_retry_time ASC
        LIMIT 10
      `
      )
      .bind(now)
      .all<{ id: string }>();

    return tasks.results?.map((t) => t.id) || [];
  }

  /**
   * Obtener estadísticas de una tarea
   */
  async getTaskStats(taskId: string) {
    const task = await this.db
      .prepare("SELECT * FROM tasks WHERE id = ?")
      .bind(taskId)
      .first<{
        retry_count: number;
        max_retries: number;
        created_at: string;
        completed_at?: string;
      }>();

    if (!task) {
      return null;
    }

    const duration = task.completed_at
      ? new Date(task.completed_at).getTime() -
        new Date(task.created_at).getTime()
      : null;

    return {
      attempts: task.retry_count + 1,
      maxAttempts: task.max_retries,
      durationMs: duration,
      successRate: task.completed_at ? 100 : 0,
    };
  }
}

/**
 * Servicio de messaging entre agentes
 */
export class AgentMessaging {
  constructor(private db: Database) {}

  /**
   * Enviar mensaje de un agente a otro
   */
  async sendMessage(
    fromAgentId: string,
    toAgentId: string,
    message: string,
    metadata?: Record<string, any>
  ): Promise<string> {
    const messageId = nanoid();

    await this.db
      .prepare(
        `
        INSERT INTO agent_messages (id, from_agent_id, to_agent_id, message, metadata, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `
      )
      .bind(
        messageId,
        fromAgentId,
        toAgentId,
        message,
        JSON.stringify(metadata || {}),
        new Date().toISOString()
      )
      .run();

    return messageId;
  }

  /**
   * Obtener mensajes no leídos de un agente
   */
  async getUnreadMessages(agentId: string): Promise<
    Array<{
      id: string;
      from_agent_id: string;
      message: string;
      metadata: any;
      created_at: string;
    }>
  > {
    const messages = await this.db
      .prepare(
        `
        SELECT id, from_agent_id, message, metadata, created_at
        FROM agent_messages
        WHERE to_agent_id = ? AND read_at IS NULL
        ORDER BY created_at ASC
      `
      )
      .bind(agentId)
      .all();

    return messages.results || [];
  }

  /**
   * Marcar mensaje como leído
   */
  async markAsRead(messageId: string): Promise<void> {
    await this.db
      .prepare("UPDATE agent_messages SET read_at = ? WHERE id = ?")
      .bind(new Date().toISOString(), messageId)
      .run();
  }
}

/**
 * Persistencia de estado de agentes
 */
export class AgentPersistence {
  constructor(private db: Database) {}

  /**
   * Guardar estado de agente
   */
  async saveState(agentId: string, state: Record<string, any>): Promise<void> {
    const stateJson = JSON.stringify(state);

    // Intentar actualizar primero
    const result = await this.db
      .prepare("UPDATE agents SET state = ?, updated_at = ? WHERE id = ?")
      .bind(stateJson, new Date().toISOString(), agentId)
      .run();

    // Si no fue actualizado, insertar nuevo (shouldn't happen pero por seguridad)
    if (!result.success) {
      console.warn(`Agent state save failed for ${agentId}`);
    }
  }

  /**
   * Cargar estado de agente
   */
  async loadState(agentId: string): Promise<Record<string, any> | null> {
    const agent = await this.db
      .prepare("SELECT state FROM agents WHERE id = ?")
      .bind(agentId)
      .first<{ state: string }>();

    if (!agent || !agent.state) {
      return null;
    }

    try {
      return JSON.parse(agent.state);
    } catch (e) {
      console.error("Failed to parse agent state:", e);
      return null;
    }
  }

  /**
   * Limpiar estado de agente
   */
  async clearState(agentId: string): Promise<void> {
    await this.db
      .prepare("UPDATE agents SET state = NULL WHERE id = ?")
      .bind(agentId)
      .run();
  }
}

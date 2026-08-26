export type AgentStatus = 'pending' | 'idle' | 'working' | 'sleeping' | 'offline' | 'rejected'
export type AgentTrust = 'viewer' | 'contributor' | 'trusted'
export type TaskStatus = 'pending' | 'assigned' | 'in_progress' | 'collaborating' | 'completed' | 'failed' | 'cancelled'
export type TaskMode = 'broadcast' | 'targeted' | 'auto' | 'collaborative'
export type KnowledgeVisibility = 'public' | 'trusted' | 'private'

export interface Agent {
  id: string
  name: string
  description: string
  version: string
  capabilities: string[]
  endpoint: string
  connection_type: string
  status: AgentStatus
  trust_level: AgentTrust
  token?: string
  owner: string
  is_external: boolean
  metadata: Record<string, unknown>
  last_seen?: string
  created_at: string
  max_concurrent_tasks: number
  // Prompt de sistema de un agente creado dinámicamente (connection_type='dynamic').
  // Los builtin guardan el suyo en código (gateway/src/agents/builtin.ts); esta
  // columna solo aplica a los agentes de departamento que crea el Director.
  system_prompt?: string | null
}

export interface Task {
  id: string
  title: string
  description: string
  mode: TaskMode
  status: TaskStatus
  priority: number
  assigned_agents: string[]
  result: Record<string, unknown>
  context: Record<string, unknown>
  created_at: string
  updated_at?: string
  completed_at?: string
}

export interface TaskMessage {
  id: string
  task_id: string
  sender_id: string
  sender_name: string
  content: string
  message_type: 'text' | 'result' | 'error' | 'learning'
  created_at: string
}

export interface KnowledgeEntry {
  id: string
  title: string
  content: string
  category: string
  tags: string[]
  source_agent_id: string
  source_agent_name: string
  source_task_id: string
  visibility: KnowledgeVisibility
  relevance_score: number
  times_used: number
  created_at: string
}

export interface ChatMessage {
  id: string
  sender_id: string
  sender_name: string
  sender_role: 'admin' | 'agent'
  content: string
  channel: string
  target_agent_id: string | null
  message_type: 'text' | 'system' | 'learning' | 'improvement'
  metadata: Record<string, unknown>
  created_at: string
}

// Bindings de Cloudflare definidos en wrangler.toml
export interface Env {
  DB: D1Database
  KV: KVNamespace
  GATEWAY_HUB: DurableObjectNamespace
  SECRET_KEY: string
  ENVIRONMENT: string
  // Claves de proveedores de LLM. Se configuran como secrets.
  XAI_KEY?: string
  OPENROUTER_KEY?: string
  GROQ_KEY?: string
  GEMINI_KEY?: string
  OPENAI_KEY?: string
  DEEPSEEK_KEY?: string
  ANTHROPIC_KEY?: string
}

// Subtarea dentro de una tarea colaborativa
export interface Subtask {
  id: string
  task_id: string
  agent_id: string
  agent_name: string
  description: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  result?: Record<string, unknown>
  created_at: string
  completed_at?: string
}

// Mensajes WebSocket entre agentes y el gateway
export type WsMessageType =
  | 'auth'
  | 'connected'
  | 'error'
  | 'heartbeat'
  | 'heartbeat_ack'
  | 'task_assigned'
  | 'task_result'
  | 'agent_message'
  | 'knowledge_add'
  | 'knowledge_query'
  | 'knowledge_response'
  | 'knowledge_published'
  | 'agent_online'
  | 'agent_offline'
  | 'agent_pending'
  | 'registration_approved'
  | 'registration_rejected'
  | 'knowledge_proposal'
  | 'collaborate_request'
  | 'collaborate_accept'
  | 'collaborate_reject'
  | 'subtask_assigned'
  | 'subtask_result'
  | 'task_status_update'
  | 'agents_list'
  | 'orchestration_complete'
  | 'chat_response'
  | 'chat_message'
  | 'learning_task'
  | 'improvement_proposal'
  | 'director_proposal'
  | 'agent_created'
  | 'shutdown'
  | 'maintenance'

export interface WsMessage {
  type: WsMessageType
  [key: string]: unknown
}

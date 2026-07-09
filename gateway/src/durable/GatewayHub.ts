import { WsMessage, Subtask } from '../models/types'

interface Session {
  socket: WebSocket
  id: string
  name: string
  role: 'agent' | 'admin'
  capabilities?: string[]
}

export class GatewayHub {
  private sessions: Map<string, Session> = new Map()
  private state: DurableObjectState

  constructor(state: DurableObjectState) {
    this.state = state
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    // ─── Internal HTTP routes (called by gateway routes via hub.fetch()) ───
    if (request.headers.get('Upgrade') !== 'websocket') {
      const path = url.pathname

      // POST /internal/notify-admin — broadcast event to all admins
      if (path === '/internal/notify-admin' && request.method === 'POST') {
        const body = await request.json() as WsMessage
        this.broadcastToAdmins(body)
        return new Response('ok')
      }

      // POST /internal/broadcast-agents — send message to all agents
      if (path === '/internal/broadcast-agents' && request.method === 'POST') {
        const body = await request.json() as WsMessage
        this.broadcastToAgents(body)
        return new Response('ok')
      }

      // POST /internal/send-agent — send message to a specific agent
      if (path === '/internal/send-agent' && request.method === 'POST') {
        const { agent_id, message } = await request.json() as { agent_id: string; message: WsMessage }
        this.sendToAgent(agent_id, message)
        return new Response('ok')
      }

      // GET /internal/online-agents — list connected agent IDs + capabilities
      if (path === '/internal/online-agents' && request.method === 'GET') {
        const agents = this.getOnlineAgentsInfo()
        return new Response(JSON.stringify(agents), { headers: { 'Content-Type': 'application/json' } })
      }

      // POST /internal/orchestrate — dispatch collaborative task
      if (path === '/internal/orchestrate' && request.method === 'POST') {
        const { task, subtasks } = await request.json() as { task: { id: string; title: string; description: string; priority: number; context: Record<string, unknown> }; subtasks: Subtask[] }
        const result = await this.orchestrateCollaborativeTask(task, subtasks)
        return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } })
      }

      // POST /internal/knowledge-query — broadcast knowledge query to agents
      if (path === '/internal/knowledge-query' && request.method === 'POST') {
        const { query, task_id, requester_id } = await request.json() as { query: string; task_id: string; requester_id: string }
        this.broadcastToAgents({
          type: 'knowledge_query',
          query,
          task_id,
          requester_id,
        })
        return new Response('ok')
      }

      // POST /internal/broadcast-message — broadcast arbitrary message to all connected sessions
      if (path === '/internal/broadcast-message' && request.method === 'POST') {
        const body = await request.json() as WsMessage
        for (const session of this.sessions.values()) {
          this.send(session.socket, body)
        }
        return new Response('ok')
      }

      return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })
    }

    // ─── WebSocket upgrade ───
    const role = url.searchParams.get('role') as 'agent' | 'admin' || 'agent'
    const sessionId = url.searchParams.get('session_id') || crypto.randomUUID()

    const { 0: client, 1: server } = new WebSocketPair()
    this.state.acceptWebSocket(server)

    const capabilitiesRaw = url.searchParams.get('capabilities')
    const capabilities = capabilitiesRaw ? JSON.parse(capabilitiesRaw) : []

    const session: Session = {
      socket: server,
      id: sessionId,
      name: url.searchParams.get('name') || 'Desconocido',
      role,
      capabilities,
    }
    this.sessions.set(sessionId, session)

    server.addEventListener('message', async (event) => {
      try {
        const msg: WsMessage = JSON.parse(event.data as string)
        await this.handleMessage(session, msg)
      } catch {}
    })

    server.addEventListener('close', () => {
      this.sessions.delete(sessionId)
      if (role === 'agent') {
        this.broadcastToAdmins({ type: 'agent_offline', agent_id: sessionId, name: session.name })
      }
    })

    // Notify admins of new connection
    if (role === 'agent') {
      this.broadcastToAdmins({ type: 'agent_online', agent_id: sessionId, name: session.name, capabilities: session.capabilities })
    } else {
      // Send current agents list to newly connected admin
      this.send(server, { type: 'agents_list', agents: this.getOnlineAgentsInfo() })
    }

    return new Response(null, { status: 101, webSocket: client })
  }

  // ─── WebSocket message handler ───
  private async handleMessage(session: Session, msg: WsMessage) {
    switch (msg.type) {
      case 'heartbeat':
        this.send(session.socket, { type: 'heartbeat_ack' })
        break

      case 'task_result':
        // Agent delivers result → notify admins
        this.broadcastToAdmins({
          type: 'task_result',
          agent_id: session.id,
          agent_name: session.name,
          task_id: msg.task_id,
          result: msg.result,
        })
        break

      case 'agent_message': {
        // Agent-to-agent messaging
        const targetId = msg.to as string

        if (targetId === 'all') {
          // Broadcast to all agents except sender
          for (const s of this.sessions.values()) {
            if (s.role === 'agent' && s.id !== session.id) {
              this.send(s.socket, {
                type: 'agent_message',
                from: session.id,
                from_name: session.name,
                content: msg.content,
                task_id: msg.task_id,
                timestamp: Date.now(),
              })
            }
          }
        } else if (targetId) {
          // Point-to-point
          const target = this.sessions.get(targetId)
          if (target) {
            this.send(target.socket, {
              type: 'agent_message',
              from: session.id,
              from_name: session.name,
              content: msg.content,
              task_id: msg.task_id,
              timestamp: Date.now(),
            })
          }
        }

        // Notify admins of agent communication
        this.broadcastToAdmins({
          type: 'agent_message',
          from: session.id,
          from_name: session.name,
          to: targetId,
          content: msg.content,
          task_id: msg.task_id,
          timestamp: Date.now(),
        })
        break
      }

      case 'knowledge_add':
        // Agent proposes knowledge → admins see it
        this.broadcastToAdmins({
          type: 'knowledge_proposal',
          agent_id: session.id,
          agent_name: session.name,
          data: msg.data,
        })
        break

      case 'knowledge_query':
        // Agent requests knowledge → broadcast to all agents to gather
        this.broadcastToAgents({
          type: 'knowledge_query',
          query: msg.query,
          task_id: msg.task_id,
          requester_id: session.id,
          requester_name: session.name,
        })
        break

      case 'knowledge_response':
        // Agent responds with knowledge → forward to requester or broadcast
        if (msg.requester_id) {
          const requester = this.sessions.get(msg.requester_id as string)
          if (requester) {
            this.send(requester.socket, {
              type: 'knowledge_response',
              from: session.id,
              from_name: session.name,
              knowledge: msg.knowledge,
              query: msg.query,
            })
          }
        }
        // Also notify admins
        this.broadcastToAdmins({
          type: 'knowledge_response',
          agent_id: session.id,
          agent_name: session.name,
          knowledge: msg.knowledge,
          query: msg.query,
        })
        break

      case 'collaborate_accept': {
        // Agent accepts collaboration on a task
        const taskId = msg.task_id as string
        this.broadcastToAdmins({
          type: 'collaborate_accept',
          agent_id: session.id,
          agent_name: session.name,
          task_id: taskId,
        })
        // Notify other agents on the same task
        this.notifyTaskAgents(taskId, session.id, {
          type: 'agent_message',
          from: session.id,
          from_name: session.name,
          content: `Me uno a la colaboración en la tarea ${taskId}`,
          task_id: taskId,
          timestamp: Date.now(),
        })
        break
      }

      case 'collaborate_reject': {
        const taskId = msg.task_id as string
        this.broadcastToAdmins({
          type: 'collaborate_reject',
          agent_id: session.id,
          agent_name: session.name,
          task_id: taskId,
          reason: msg.reason,
        })
        break
      }

      case 'subtask_result': {
        // Agent delivers subtask result
        const subtaskId = msg.subtask_id as string
        const parentTaskId = msg.task_id as string

        // Forward result to admins
        this.broadcastToAdmins({
          type: 'subtask_result',
          agent_id: session.id,
          agent_name: session.name,
          subtask_id: subtaskId,
          task_id: parentTaskId,
          result: msg.result,
        })

        // Notify other agents on the same task
        this.notifyTaskAgents(parentTaskId, session.id, {
          type: 'agent_message',
          from: session.id,
          from_name: session.name,
          content: `Completé mi parte: ${JSON.stringify(msg.result).slice(0, 200)}`,
          task_id: parentTaskId,
          timestamp: Date.now(),
        })
        break
      }

      case 'task_status_update': {
        // Agent updates task status
        this.broadcastToAdmins({
          type: 'task_status_update',
          agent_id: session.id,
          agent_name: session.name,
          task_id: msg.task_id,
          status: msg.status,
          progress: msg.progress,
        })
        break
      }

      case 'chat_response': {
        // Agent responds to chat message → notify admins
        this.broadcastToAdmins({
          type: 'chat_message',
          id: msg.id || crypto.randomUUID(),
          sender_id: session.id,
          sender_name: session.name,
          sender_role: 'agent',
          content: msg.content,
          channel: msg.channel || 'general',
          target_agent_id: null,
          message_type: 'text',
          created_at: new Date().toISOString(),
        })
        break
      }
    }
  }

  // ─── Orchestration: dispatch collaborative task to agents ───
  private async orchestrateCollaborativeTask(
    task: { id: string; title: string; description: string; priority: number; context: Record<string, unknown> },
    subtasks: Subtask[],
  ): Promise<{ assigned: string[]; rejected: string[] }> {
    const assigned: string[] = []
    const rejected: string[] = []

    for (const subtask of subtasks) {
      const session = this.sessions.get(subtask.agent_id)
      if (session && session.role === 'agent') {
        this.send(session.socket, {
          type: 'subtask_assigned',
          task_id: task.id,
          subtask_id: subtask.id,
          title: task.title,
          description: subtask.description,
          priority: task.priority,
          context: task.context,
          assigned_agents: subtasks.map(s => ({ agent_id: s.agent_id, agent_name: s.agent_name, description: s.description })),
        } as WsMessage)
        assigned.push(subtask.agent_id)
      } else {
        rejected.push(subtask.agent_id)
      }
    }

    // Notify admins about orchestration
    this.broadcastToAdmins({
      type: 'task_status_update',
      task_id: task.id,
      status: 'collaborating',
      assigned_count: assigned.length,
      rejected_count: rejected.length,
    } as WsMessage)

    return { assigned, rejected }
  }

  // ─── Helper: notify all agents working on the same task ───
  private notifyTaskAgents(taskId: string, excludeId: string, msg: WsMessage) {
    for (const session of this.sessions.values()) {
      if (session.role === 'agent' && session.id !== excludeId) {
        this.send(session.socket, msg)
      }
    }
  }

  // ─── Public methods (called internally) ───

  sendToAgent(agentId: string, msg: WsMessage) {
    const session = this.sessions.get(agentId)
    if (session) this.send(session.socket, msg)
  }

  broadcastToAgents(msg: WsMessage) {
    for (const session of this.sessions.values()) {
      if (session.role === 'agent') this.send(session.socket, msg)
    }
  }

  broadcastToAdmins(msg: WsMessage) {
    for (const session of this.sessions.values()) {
      if (session.role === 'admin') this.send(session.socket, msg)
    }
  }

  getOnlineAgentsInfo(): Array<{ id: string; name: string; capabilities: string[] }> {
    return [...this.sessions.values()]
      .filter(s => s.role === 'agent')
      .map(s => ({ id: s.id, name: s.name, capabilities: s.capabilities || [] }))
  }

  onlineAgents(): string[] {
    return this.getOnlineAgentsInfo().map(a => a.id)
  }

  private send(socket: WebSocket, msg: WsMessage) {
    try {
      socket.send(JSON.stringify(msg))
    } catch {}
  }
}

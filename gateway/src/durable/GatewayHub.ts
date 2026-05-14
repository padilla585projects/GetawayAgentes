import { WsMessage } from '../models/types'

interface Session {
  socket: WebSocket
  id: string
  name: string
  role: 'agent' | 'admin'
}

export class GatewayHub {
  private sessions: Map<string, Session> = new Map()
  private state: DurableObjectState

  constructor(state: DurableObjectState) {
    this.state = state
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Se requiere WebSocket', { status: 426 })
    }

    const role = url.searchParams.get('role') as 'agent' | 'admin' || 'agent'
    const sessionId = url.searchParams.get('session_id') || crypto.randomUUID()

    const { 0: client, 1: server } = new WebSocketPair()
    this.state.acceptWebSocket(server)

    const session: Session = {
      socket: server,
      id: sessionId,
      name: url.searchParams.get('name') || 'Desconocido',
      role,
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

    if (role === 'agent') {
      this.broadcastToAdmins({ type: 'agent_online', agent_id: sessionId, name: session.name })
    }

    return new Response(null, { status: 101, webSocket: client })
  }

  private async handleMessage(session: Session, msg: WsMessage) {
    switch (msg.type) {
      case 'heartbeat':
        this.send(session.socket, { type: 'heartbeat_ack' })
        break

      case 'task_result':
        // Agente entrega resultado → notificar a admins
        this.broadcastToAdmins({
          type: 'task_result',
          agent_id: session.id,
          agent_name: session.name,
          task_id: msg.task_id,
          result: msg.result,
        })
        break

      case 'agent_message':
        // Agente habla con otro agente
        const target = this.sessions.get(msg.to as string)
        if (target) {
          this.send(target.socket, {
            type: 'agent_message',
            from: session.id,
            from_name: session.name,
            content: msg.content,
            task_id: msg.task_id,
          })
        }
        break

      case 'knowledge_add':
        // Agente propone agregar conocimiento → admins lo ven
        this.broadcastToAdmins({
          type: 'knowledge_proposal',
          agent_id: session.id,
          agent_name: session.name,
          data: msg.data,
        })
        break
    }
  }

  // Enviar tarea a un agente específico
  sendToAgent(agentId: string, msg: WsMessage) {
    const session = this.sessions.get(agentId)
    if (session) this.send(session.socket, msg)
  }

  // Enviar tarea a todos los agentes
  broadcastToAgents(msg: WsMessage) {
    for (const session of this.sessions.values()) {
      if (session.role === 'agent') this.send(session.socket, msg)
    }
  }

  // Notificar a todos los admins conectados
  broadcastToAdmins(msg: WsMessage) {
    for (const session of this.sessions.values()) {
      if (session.role === 'admin') this.send(session.socket, msg)
    }
  }

  onlineAgents(): string[] {
    return [...this.sessions.values()]
      .filter(s => s.role === 'agent')
      .map(s => s.id)
  }

  private send(socket: WebSocket, msg: WsMessage) {
    try {
      socket.send(JSON.stringify(msg))
    } catch {}
  }
}

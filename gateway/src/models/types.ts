export type AgentStatus = 'pending' | 'idle' | 'working' | 'sleeping' | 'offline' | 'rejected'
export type AgentTrust = 'viewer' | 'contributor' | 'trusted'
export type TaskStatus = 'pending' | 'assigned' | 'in_progress' | 'collaborating' | 'completed' | 'failed' | 'cancelled'
export type TaskMode = 'broadcast' | 'targeted' | 'auto'
export type KnowledgeVisibility = 'public' | 'trusted' | 'private'

export interface AuthPayload {
  sub: string
  name: string
  type: 'admin' | 'agent'
}

export interface AppContext {
  Variables: {
    auth?: AuthPayload
  }
}

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

// Bindings de Cloudflare definidos en wrangler.toml
export interface Env {
  DB: D1Database
  KV: KVNamespace
  GATEWAY_HUB: DurableObjectNamespace
  SECRET_KEY: string
  ENVIRONMENT: string
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
  | 'agent_online'
  | 'agent_offline'
  | 'agent_pending'
  | 'registration_approved'
  | 'registration_rejected'
  | 'knowledge_proposal'

export interface WsMessage {
  type: WsMessageType
  [key: string]: unknown
}

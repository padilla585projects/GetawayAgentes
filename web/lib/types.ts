export interface Agent {
  id: string
  name: string
  description: string
  version: string
  capabilities: string[]
  endpoint: string
  connection_type: string
  status: 'pending' | 'idle' | 'working' | 'sleeping' | 'offline' | 'rejected'
  trust_level: 'viewer' | 'contributor' | 'trusted'
  token?: string
  owner: string
  is_external: boolean
  is_online?: boolean
  metadata: Record<string, unknown>
  last_seen?: string
  created_at: string
  max_concurrent_tasks: number
}

export interface Task {
  id: string
  title: string
  description: string
  mode: 'broadcast' | 'targeted' | 'auto' | 'collaborative'
  status: 'pending' | 'assigned' | 'in_progress' | 'collaborating' | 'completed' | 'failed' | 'cancelled'
  priority: number
  assigned_agents: string[]
  result: Record<string, unknown>
  context: Record<string, unknown>
  created_at: string
  updated_at?: string
  completed_at?: string
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
  visibility: 'public' | 'trusted' | 'private'
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
  metadata: string
  created_at: string
}

export interface Channel {
  channel: string
  message_count: number
  last_message: string
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

export interface ImprovementProposal {
  id: string
  agent_id: string
  agent_name: string
  proposal_type: 'feature' | 'new_agent' | 'optimization' | 'knowledge_gap' | 'integration'
  title: string
  description: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  status: 'pending' | 'reviewing' | 'approved' | 'rejected' | 'implemented'
  related_capabilities: string[]
  evidence: string
  created_at: string
  reviewed_at?: string
  reviewed_by?: string
  implementation_notes?: string
}

export interface ImprovementStats {
  total: number
  pending: number
  approved: number
  implemented: number
  new_agent_proposals: number
  feature_proposals: number
}

export interface LearningTask {
  id: string
  agent_id: string
  agent_name: string
  task_type: 'knowledge_share' | 'knowledge_query' | 'self_improve' | 'capability_explore' | 'system_analysis'
  title: string
  description: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  result: Record<string, unknown>
  created_at: string
  completed_at?: string
}

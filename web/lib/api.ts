import { Agent, Task, KnowledgeEntry, ChatMessage, Channel, ImprovementProposal, ImprovementStats, LearningTask, SimulatedInboxEntry } from './types'

const BASE = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:8787'

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export const api = {
  // Auth
  login: (username: string, password: string) =>
    req<{ token: string; username: string }>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),

  // Agents
  getAgents: () => req<Agent[]>('/agents'),
  getAgent: (id: string) => req<Agent>(`/agents/${id}`),
  approveAgent: (id: string, trust_level = 'viewer') =>
    req(`/agents/${id}/approve`, { method: 'POST', body: JSON.stringify({ trust_level }) }),
  rejectAgent: (id: string) => req(`/agents/${id}/reject`, { method: 'POST' }),
  setTrust: (id: string, trust_level: string) =>
    req(`/agents/${id}/trust`, { method: 'PATCH', body: JSON.stringify({ trust_level }) }),

  // Tasks
  getTasks: () => req<Task[]>('/tasks'),
  getTask: (id: string) => req<Task & { messages: unknown[] }>(`/tasks/${id}`),
  createTask: (data: { title: string; description: string; mode?: string; priority?: number; assigned_agents?: string[]; context?: Record<string, unknown> }) =>
    req<{ message: string; task_id: string; mode: string }>('/tasks', { method: 'POST', body: JSON.stringify(data) }),
  sendMessage: (taskId: string, data: { sender_id: string; sender_name?: string; content: string; message_type?: string; broadcast_to_agents?: boolean }) =>
    req<{ message: string; id: string }>(`/tasks/${taskId}/message`, { method: 'POST', body: JSON.stringify(data) }),
  completeTask: (id: string, result: Record<string, unknown>) =>
    req<{ message: string; result: unknown }>(`/tasks/${id}/complete`, { method: 'PATCH', body: JSON.stringify({ result }) }),
  completeSubtask: (taskId: string, data: { subtask_id: string; agent_id: string; agent_name: string; result: Record<string, unknown> }) =>
    req<{ message: string }>(`/tasks/${taskId}/complete-subtask`, { method: 'POST', body: JSON.stringify(data) }),
  requestKnowledge: (taskId: string, query: string) =>
    req<{ message: string }>(`/tasks/${taskId}/request-knowledge`, { method: 'POST', body: JSON.stringify({ query }) }),

  // Knowledge
  getKnowledge: (visibility = 'public') => req<KnowledgeEntry[]>(`/knowledge?visibility=${visibility}`),
  searchKnowledge: (q: string, capabilities?: string) => {
    const params = new URLSearchParams({ q })
    if (capabilities) params.set('capabilities', capabilities)
    return req<KnowledgeEntry[]>(`/knowledge/search?${params}`)
  },
  addKnowledge: (data: { title: string; content: string; category?: string; tags?: string[]; source_agent_id?: string; source_agent_name?: string; visibility?: string }) =>
    req<{ message: string; id: string }>('/knowledge', { method: 'POST', body: JSON.stringify(data) }),
  deleteKnowledge: (id: string) => req(`/knowledge/${id}`, { method: 'DELETE' }),

  // Chat
  getChatMessages: (channel = 'general', limit = 100, before?: string) => {
    const params = new URLSearchParams({ channel, limit: String(limit) })
    if (before) params.set('before', before)
    return req<ChatMessage[]>(`/chat?${params}`)
  },
  getChatActivity: (limit = 50) => req<ChatMessage[]>(`/chat/activity?limit=${limit}`),
  getChatAgents: () => req<(Agent & { last_message: string | null })[]>('/chat/agents'),
  sendChatMessage: (data: { content: string; channel?: string; target_agent_id?: string; sender_name?: string; sender_role?: string }) =>
    req<{ message: string; id: string }>('/chat', { method: 'POST', body: JSON.stringify(data) }),
  getChatChannels: () => req<Channel[]>('/chat/channels'),
  deleteChatMessage: (id: string) => req(`/chat/${id}`, { method: 'DELETE' }),

  // Improvements
  getImprovements: (status?: string, type?: string) => {
    const params = new URLSearchParams()
    if (status) params.set('status', status)
    if (type) params.set('type', type)
    return req<ImprovementProposal[]>(`/improvements?${params}`)
  },
  getImprovementStats: () => req<ImprovementStats>('/improvements/stats'),
  reviewImprovement: (id: string, data: { status: string; implementation_notes?: string }) =>
    req(`/improvements/${id}/review`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteImprovement: (id: string) => req(`/improvements/${id}`, { method: 'DELETE' }),
  getLearningTasks: (agentId?: string, status?: string) => {
    const params = new URLSearchParams()
    if (agentId) params.set('agent_id', agentId)
    if (status) params.set('status', status)
    return req<LearningTask[]>(`/improvements/learning?${params}`)
  },

  // Admin / kill switch
  getMaintenanceStatus: () => req<{ maintenance: boolean }>('/admin/status'),
  setMaintenance: (enabled: boolean) =>
    req<{ maintenance: boolean }>('/admin/maintenance', { method: 'POST', body: JSON.stringify({ enabled }) }),

  // Director — audita la bandeja simulada y propone agentes de departamento
  runDirectorAudit: () =>
    req<{ message: string; proposals_created: number; proposal_ids: string[] }>('/director/audit', { method: 'POST' }),

  // Bandeja simulada (empresa de prueba para el Director)
  getInbox: () => req<SimulatedInboxEntry[]>('/inbox'),
  seedInbox: () => req<{ message: string; count: number }>('/inbox/seed', { method: 'POST' }),
}

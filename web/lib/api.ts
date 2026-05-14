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

  // Agentes
  getAgents: () => req<any[]>('/agents'),
  getAgent: (id: string) => req<any>(`/agents/${id}`),
  approveAgent: (id: string, trust_level = 'viewer') =>
    req(`/agents/${id}/approve`, { method: 'POST', body: JSON.stringify({ trust_level }) }),
  rejectAgent: (id: string) => req(`/agents/${id}/reject`, { method: 'POST' }),
  setTrust: (id: string, trust_level: string) =>
    req(`/agents/${id}/trust`, { method: 'PATCH', body: JSON.stringify({ trust_level }) }),

  // Tareas
  getTasks: () => req<any[]>('/tasks'),
  getTask: (id: string) => req<any>(`/tasks/${id}`),
  createTask: (data: any) => req('/tasks', { method: 'POST', body: JSON.stringify(data) }),
  sendMessage: (taskId: string, data: any) =>
    req(`/tasks/${taskId}/message`, { method: 'POST', body: JSON.stringify(data) }),
  completeTask: (id: string, result: any) =>
    req(`/tasks/${id}/complete`, { method: 'PATCH', body: JSON.stringify({ result }) }),

  // Conocimiento
  getKnowledge: (visibility = 'public') => req<any[]>(`/knowledge?visibility=${visibility}`),
  addKnowledge: (data: any) => req('/knowledge', { method: 'POST', body: JSON.stringify(data) }),
  deleteKnowledge: (id: string) => req(`/knowledge/${id}`, { method: 'DELETE' }),
}

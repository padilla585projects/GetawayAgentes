import { Hono } from 'hono'
import { Env, AgentStatus, AgentTrust } from '../models/types'
import { nanoid } from '../services/utils'
import { signToken } from '../services/auth'
import { BUILTIN_AGENT_IDS } from '../agents/builtin'

const agents = new Hono<{ Bindings: Env }>()

// POST /agents/register — agent requests to join the network
agents.post('/register', async (c) => {
  const body = await c.req.json()

  // Check if agent with same name already exists
  const existing = await c.env.DB.prepare('SELECT * FROM agents WHERE name = ?').bind(body.name).first() as Record<string, unknown> | null
  if (existing) {
    // If already approved, re-sign token with current SECRET_KEY in case it changed
    if (existing.status === 'idle') {
      const newToken = await signToken({ sub: existing.id, name: existing.name, type: 'agent' }, c.env.SECRET_KEY)
      await c.env.DB.prepare(`UPDATE agents SET token = ?, updated_at = datetime('now') WHERE id = ?`).bind(newToken, existing.id).run()
      await c.env.KV.put(`agent_token:${existing.id}`, newToken)
      return c.json({ message: 'Agente ya registrado', agent_id: existing.id, token: newToken, status: existing.status })
    }
    return c.json({ message: 'Agente ya registrado', agent_id: existing.id, token: existing.token, status: existing.status })
  }

  const id = nanoid()

  await c.env.DB.prepare(`
    INSERT INTO agents (id, name, description, version, capabilities, endpoint, connection_type, owner, is_external, metadata, max_concurrent_tasks)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    body.name,
    body.description || '',
    body.version || '1.0.0',
    JSON.stringify(body.capabilities || []),
    body.endpoint || '',
    body.connection_type || 'websocket',
    body.owner || '',
    body.is_external ? 1 : 0,
    JSON.stringify(body.metadata || {}),
    body.max_concurrent_tasks || 1,
  ).run()

  // Notify admins via Durable Object
  const hub = c.env.GATEWAY_HUB.get(c.env.GATEWAY_HUB.idFromName('main'))
  await hub.fetch('http://internal/notify-admin', {
    method: 'POST',
    body: JSON.stringify({ type: 'agent_pending', agent_id: id, agent_name: body.name, capabilities: body.capabilities }),
  })

  return c.json({ message: 'Solicitud recibida. Esperando aprobación del administrador.', agent_id: id })
})

// POST /agents/:id/approve — admin approves agent
agents.post('/:id/approve', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => ({}))
  const trust = (body as any).trust_level || 'viewer'

  const agent = await c.env.DB.prepare('SELECT * FROM agents WHERE id = ?').bind(id).first()
  if (!agent) return c.json({ error: 'Agente no encontrado' }, 404)

  const token = await signToken({ sub: id, name: agent.name, type: 'agent' }, c.env.SECRET_KEY)

  await c.env.DB.prepare(`
    UPDATE agents SET status = 'idle', trust_level = ?, token = ?, updated_at = datetime('now') WHERE id = ?
  `).bind(trust, token, id).run()

  // Save token in KV for fast lookup
  await c.env.KV.put(`agent_token:${id}`, token)

  // Notify admins
  const hub = c.env.GATEWAY_HUB.get(c.env.GATEWAY_HUB.idFromName('main'))
  await hub.fetch('http://internal/notify-admin', {
    method: 'POST',
    body: JSON.stringify({ type: 'registration_approved', agent_id: id, agent_name: agent.name, trust_level: trust }),
  })

  return c.json({ message: `Agente aprobado`, token, trust_level: trust })
})

// POST /agents/:id/reject — admin rejects agent
agents.post('/:id/reject', async (c) => {
  const id = c.req.param('id')
  const agent = await c.env.DB.prepare('SELECT * FROM agents WHERE id = ?').bind(id).first()
  await c.env.DB.prepare(`UPDATE agents SET status = 'rejected', updated_at = datetime('now') WHERE id = ?`).bind(id).run()

  const hub = c.env.GATEWAY_HUB.get(c.env.GATEWAY_HUB.idFromName('main'))
  await hub.fetch('http://internal/notify-admin', {
    method: 'POST',
    body: JSON.stringify({ type: 'registration_rejected', agent_id: id, agent_name: agent?.name || 'Unknown' }),
  })

  return c.json({ message: 'Agente rechazado' })
})

// GET /agents — list all agents
agents.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT id, name, description, capabilities, status, trust_level, last_seen, is_external, version, endpoint, max_concurrent_tasks
    FROM agents ORDER BY created_at DESC
  `).all()

  // Get online agents from hub
  let onlineIds = new Set<string>()
  try {
    const hub = c.env.GATEWAY_HUB.get(c.env.GATEWAY_HUB.idFromName('main'))
    const onlineRes = await hub.fetch('http://internal/online-agents')
    const onlineAgents = await onlineRes.json() as Array<{ id: string; name: string; capabilities: string[] }> | { error?: string }
    if (Array.isArray(onlineAgents)) {
      onlineIds = new Set(onlineAgents.map(a => a.id))
    }
  } catch {}

  return c.json(results.map(a => ({
    ...a,
    capabilities: JSON.parse(a.capabilities as string || '[]'),
    is_external: Boolean(a.is_external),
    // Los agentes built-in viven en el worker: siempre online.
    is_online: BUILTIN_AGENT_IDS.has(a.id as string) || onlineIds.has(a.id as string),
    is_builtin: BUILTIN_AGENT_IDS.has(a.id as string),
  })))
})

// GET /agents/:id — agent detail
agents.get('/:id', async (c) => {
  const agent = await c.env.DB.prepare('SELECT * FROM agents WHERE id = ?').bind(c.req.param('id')).first()
  if (!agent) return c.json({ error: 'Agente no encontrado' }, 404)
  return c.json({ ...agent, capabilities: JSON.parse(agent.capabilities as string || '[]'), metadata: JSON.parse(agent.metadata as string || '{}') })
})

// PATCH /agents/:id/trust — change trust level
agents.patch('/:id/trust', async (c) => {
  const { trust_level } = await c.req.json<{ trust_level: AgentTrust }>()
  await c.env.DB.prepare(`UPDATE agents SET trust_level = ?, updated_at = datetime('now') WHERE id = ?`).bind(trust_level, c.req.param('id')).run()
  return c.json({ message: 'Nivel de confianza actualizado' })
})

// DELETE /agents — cleanup all non-builtin agents (dev only)
agents.delete('/', async (c) => {
  if (c.env.ENVIRONMENT !== 'development') return c.json({ error: 'Solo en desarrollo' }, 403)
  const ids = Array.from(BUILTIN_AGENT_IDS)
  const placeholders = ids.map(() => '?').join(',')
  await c.env.DB.prepare(`DELETE FROM agents WHERE id NOT IN (${placeholders})`).bind(...ids).run()
  return c.json({ message: 'Agentes externos eliminados (built-in conservados)' })
})

// DELETE /agents/:id — remove a single agent (never built-in)
agents.delete('/:id', async (c) => {
  const id = c.req.param('id')
  if (BUILTIN_AGENT_IDS.has(id)) return c.json({ error: 'No se puede eliminar un agente del sistema' }, 403)
  await c.env.DB.prepare('DELETE FROM agents WHERE id = ?').bind(id).run()
  return c.json({ message: 'Agente eliminado' })
})

export default agents

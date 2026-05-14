import { Hono } from 'hono'
import { Env, AgentStatus, AgentTrust } from '../models/types'
import { nanoid } from '../services/utils'
import { signToken, verifyToken } from '../services/auth'

const agents = new Hono<{ Bindings: Env }>()

// POST /agents/register — el agente pide entrar a la red
agents.post('/register', async (c) => {
  const body = await c.req.json()
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

  // Notificar al admin via Durable Object
  const hub = c.env.GATEWAY_HUB.get(c.env.GATEWAY_HUB.idFromName('main'))
  await hub.fetch('http://internal/notify-admin', {
    method: 'POST',
    body: JSON.stringify({ type: 'agent_pending', agent_id: id, agent_name: body.name, capabilities: body.capabilities }),
  })

  return c.json({ message: 'Solicitud recibida. Esperando aprobación del administrador.', agent_id: id })
})

// POST /agents/:id/approve — admin aprueba al agente
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

  // Guardar token en KV para validación rápida
  await c.env.KV.put(`agent_token:${id}`, token)

  return c.json({ message: `Agente aprobado`, token, trust_level: trust })
})

// POST /agents/:id/reject — admin rechaza al agente
agents.post('/:id/reject', async (c) => {
  const id = c.req.param('id')
  await c.env.DB.prepare(`UPDATE agents SET status = 'rejected', updated_at = datetime('now') WHERE id = ?`).bind(id).run()
  return c.json({ message: 'Agente rechazado' })
})

// GET /agents — listar todos los agentes
agents.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT id, name, description, capabilities, status, trust_level, last_seen, is_external, version, endpoint
    FROM agents ORDER BY created_at DESC
  `).all()

  return c.json(results.map(a => ({
    ...a,
    capabilities: JSON.parse(a.capabilities as string || '[]'),
    is_external: Boolean(a.is_external),
  })))
})

// GET /agents/:id — tarjeta de presentación de un agente
agents.get('/:id', async (c) => {
  const agent = await c.env.DB.prepare('SELECT * FROM agents WHERE id = ?').bind(c.req.param('id')).first()
  if (!agent) return c.json({ error: 'Agente no encontrado' }, 404)
  return c.json({ ...agent, capabilities: JSON.parse(agent.capabilities as string || '[]'), metadata: JSON.parse(agent.metadata as string || '{}') })
})

// PATCH /agents/:id/trust — cambiar nivel de confianza
agents.patch('/:id/trust', async (c) => {
  const { trust_level } = await c.req.json<{ trust_level: AgentTrust }>()
  await c.env.DB.prepare(`UPDATE agents SET trust_level = ?, updated_at = datetime('now') WHERE id = ?`).bind(trust_level, c.req.param('id')).run()
  return c.json({ message: 'Nivel de confianza actualizado' })
})

export default agents

import { Hono } from 'hono'
import { Env } from '../models/types'
import { nanoid } from '../services/utils'

const improvements = new Hono<{ Bindings: Env }>()

// GET /improvements — list all proposals (with optional status filter)
improvements.get('/', async (c) => {
  const status = c.req.query('status')
  const type = c.req.query('type')
  const limit = parseInt(c.req.query('limit') || '50')

  let query = 'SELECT * FROM improvement_proposals'
  const conditions: string[] = []
  const params: any[] = []

  if (status) {
    conditions.push('status = ?')
    params.push(status)
  }
  if (type) {
    conditions.push('proposal_type = ?')
    params.push(type)
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ')
  }

  query += ' ORDER BY created_at DESC LIMIT ?'
  params.push(limit)

  const { results } = await c.env.DB.prepare(query).bind(...params).all()

  return c.json(results.map(r => ({
    ...r,
    related_capabilities: JSON.parse(r.related_capabilities as string || '[]'),
    proposed_agent_spec: r.proposed_agent_spec ? JSON.parse(r.proposed_agent_spec as string) : null,
  })))
})

// GET /improvements/stats — stats about proposals
improvements.get('/stats', async (c) => {
  const result = await c.env.DB.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
      SUM(CASE WHEN status = 'implemented' THEN 1 ELSE 0 END) as implemented,
      SUM(CASE WHEN proposal_type = 'new_agent' THEN 1 ELSE 0 END) as new_agent_proposals,
      SUM(CASE WHEN proposal_type = 'feature' THEN 1 ELSE 0 END) as feature_proposals
    FROM improvement_proposals
  `).first()

  return c.json(result || {})
})

// POST /improvements — agent submits a proposal
improvements.post('/', async (c) => {
  const body = await c.req.json()
  const id = nanoid()

  await c.env.DB.prepare(`
    INSERT INTO improvement_proposals (id, agent_id, agent_name, proposal_type, title, description, priority, related_capabilities, evidence, proposed_agent_spec)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    body.agent_id,
    body.agent_name,
    body.proposal_type,
    body.title,
    body.description,
    body.priority || 'medium',
    JSON.stringify(body.related_capabilities || []),
    body.evidence || '',
    body.proposed_agent_spec ? JSON.stringify(body.proposed_agent_spec) : null,
  ).run()

  // Notify admins
  const hub = c.env.GATEWAY_HUB.get(c.env.GATEWAY_HUB.idFromName('main'))
  await hub.fetch('http://internal/notify-admin', {
    method: 'POST',
    body: JSON.stringify({
      type: 'improvement_proposal',
      id,
      agent_id: body.agent_id,
      agent_name: body.agent_name,
      proposal_type: body.proposal_type,
      title: body.title,
      priority: body.priority || 'medium',
    }),
  })

  return c.json({ message: 'Propuesta enviada', id })
})

// PATCH /improvements/:id/review — admin reviews a proposal.
// Cuando se aprueba una propuesta de tipo 'new_agent' con una spec adjunta,
// esto además crea el agente de verdad — mismo patrón que POST /agents/:id/approve
// (activa algo real al aprobar), pero sin firmar token: un agente de
// departamento vive dentro del Worker, no es un proceso WebSocket externo.
improvements.patch('/:id/review', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const { status, reviewed_by, implementation_notes } = body

  const proposal = await c.env.DB.prepare('SELECT * FROM improvement_proposals WHERE id = ?').bind(id).first() as Record<string, unknown> | null

  let notes = implementation_notes || ''
  let createdAgentId: string | null = null
  let createdAgentName: string | null = null

  if (status === 'approved' && proposal?.proposal_type === 'new_agent' && proposal.proposed_agent_spec) {
    const spec = JSON.parse(proposal.proposed_agent_spec as string)
    const existing = await c.env.DB.prepare('SELECT id FROM agents WHERE name = ?').bind(spec.name).first()

    if (existing) {
      notes = `${notes} [No se creó el agente: ya existe uno con el nombre "${spec.name}"]`.trim()
    } else {
      createdAgentId = nanoid()
      createdAgentName = spec.name
      await c.env.DB.prepare(`
        INSERT INTO agents (id, name, description, version, capabilities, endpoint, connection_type, owner, is_external, status, trust_level, metadata, system_prompt, max_concurrent_tasks, updated_at)
        VALUES (?, ?, ?, '1.0.0', ?, '', 'dynamic', 'builtin-director', 0, 'idle', 'trusted', ?, ?, 5, datetime('now'))
      `).bind(
        createdAgentId,
        spec.name,
        spec.description || '',
        JSON.stringify(spec.capabilities || []),
        JSON.stringify({ specialties: spec.specialties || [], created_by_proposal: id }),
        spec.system_prompt || '',
      ).run()
    }
  }

  await c.env.DB.prepare(`
    UPDATE improvement_proposals
    SET status = ?, reviewed_at = datetime('now'), reviewed_by = ?, implementation_notes = ?
    WHERE id = ?
  `).bind(status, reviewed_by || 'admin', notes, id).run()

  if (createdAgentId) {
    const hub = c.env.GATEWAY_HUB.get(c.env.GATEWAY_HUB.idFromName('main'))
    await hub.fetch('http://internal/notify-admin', {
      method: 'POST',
      body: JSON.stringify({ type: 'agent_created', agent_id: createdAgentId, agent_name: createdAgentName }),
    })
  }

  return c.json({ message: 'Propuesta actualizada', agent_created: Boolean(createdAgentId), agent_id: createdAgentId })
})

// DELETE /improvements/:id — delete a proposal
improvements.delete('/:id', async (c) => {
  const id = c.req.param('id')
  await c.env.DB.prepare('DELETE FROM improvement_proposals WHERE id = ?').bind(id).run()
  return c.json({ message: 'Propuesta eliminada' })
})

// GET /learning — list learning tasks
improvements.get('/learning', async (c) => {
  const agentId = c.req.query('agent_id')
  const status = c.req.query('status')
  const limit = parseInt(c.req.query('limit') || '50')

  let query = 'SELECT * FROM learning_tasks'
  const conditions: string[] = []
  const params: any[] = []

  if (agentId) {
    conditions.push('agent_id = ?')
    params.push(agentId)
  }
  if (status) {
    conditions.push('status = ?')
    params.push(status)
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ')
  }

  query += ' ORDER BY created_at DESC LIMIT ?'
  params.push(limit)

  const { results } = await c.env.DB.prepare(query).bind(...params).all()

  return c.json(results.map(r => ({
    ...r,
    result: JSON.parse(r.result as string || '{}'),
  })))
})

// POST /learning — create a learning task for an agent
improvements.post('/learning', async (c) => {
  const body = await c.req.json()
  const id = nanoid()

  await c.env.DB.prepare(`
    INSERT INTO learning_tasks (id, agent_id, agent_name, task_type, title, description)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    body.agent_id,
    body.agent_name,
    body.task_type,
    body.title,
    body.description,
  ).run()

  // Send learning task to agent via WebSocket
  const hub = c.env.GATEWAY_HUB.get(c.env.GATEWAY_HUB.idFromName('main'))
  await hub.fetch('http://internal/send-agent', {
    method: 'POST',
    body: JSON.stringify({
      agent_id: body.agent_id,
      message: {
        type: 'learning_task',
        task_id: id,
        task_type: body.task_type,
        title: body.title,
        description: body.description,
      },
    }),
  })

  return c.json({ message: 'Tarea de aprendizaje creada', id })
})

// PATCH /learning/:id/complete — agent completes a learning task
improvements.patch('/learning/:id/complete', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()

  await c.env.DB.prepare(`
    UPDATE learning_tasks
    SET status = 'completed', result = ?, completed_at = datetime('now')
    WHERE id = ?
  `).bind(JSON.stringify(body.result || {}), id).run()

  return c.json({ message: 'Tarea de aprendizaje completada' })
})

export default improvements

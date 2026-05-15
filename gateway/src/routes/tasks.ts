import { Hono } from 'hono'
import { Env } from '../models/types'
import { nanoid } from '../services/utils'
import { requireAdmin, requireAgent, getAuth } from '../middleware/auth'

const tasks = new Hono<{ Bindings: Env }>()

// POST /tasks — crear y enviar una tarea (requiere admin)
tasks.post('/', requireAdmin, async (c) => {
  const body = await c.req.json()
  const id = nanoid()

  const assignedAgents = body.assigned_agents || []
  const mode = assignedAgents.length > 0 ? 'targeted' : (body.mode || 'auto')

  await c.env.DB.prepare(`
    INSERT INTO tasks (id, title, description, mode, priority, assigned_agents, context)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    body.title,
    body.description,
    mode,
    body.priority || 5,
    JSON.stringify(assignedAgents),
    JSON.stringify(body.context || {}),
  ).run()

  // Enviar la tarea a los agentes via Durable Object
  const hub = c.env.GATEWAY_HUB.get(c.env.GATEWAY_HUB.idFromName('main'))
  const taskMsg = { type: 'task_assigned', task_id: id, title: body.title, description: body.description, priority: body.priority || 5, context: body.context || {} }

  if (mode === 'broadcast' || mode === 'auto') {
    await hub.fetch('http://internal/broadcast-agents', {
      method: 'POST',
      body: JSON.stringify(taskMsg),
    })
  } else {
    for (const agentId of assignedAgents) {
      await hub.fetch('http://internal/send-agent', {
        method: 'POST',
        body: JSON.stringify({ agent_id: agentId, message: taskMsg }),
      })
    }
  }

  await c.env.DB.prepare(`UPDATE tasks SET status = 'assigned', updated_at = datetime('now') WHERE id = ?`).bind(id).run()

  return c.json({ message: 'Tarea enviada', task_id: id, mode })
})

// GET /tasks — listar todas las tareas (requiere admin)
tasks.get('/', requireAdmin, async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT id, title, status, mode, priority, assigned_agents, created_at, completed_at
    FROM tasks ORDER BY created_at DESC
  `).all()

  return c.json(results.map(t => ({
    ...t,
    assigned_agents: JSON.parse(t.assigned_agents as string || '[]'),
  })))
})

// GET /tasks/:id — detalle de tarea con mensajes (requiere admin o agente asignado)
tasks.get('/:id', requireAdmin, async (c) => {
  const id = c.req.param('id')
  const task = await c.env.DB.prepare('SELECT * FROM tasks WHERE id = ?').bind(id).first()
  if (!task) return c.json({ error: 'Tarea no encontrada' }, 404)

  const { results: messages } = await c.env.DB.prepare(`
    SELECT * FROM task_messages WHERE task_id = ? ORDER BY created_at ASC
  `).bind(id).all()

  return c.json({
    ...task,
    assigned_agents: JSON.parse(task.assigned_agents as string || '[]'),
    result: JSON.parse(task.result as string || '{}'),
    messages,
  })
})

// POST /tasks/:id/message — admin o agente manda un mensaje en una tarea (requiere autenticación)
tasks.post('/:id/message', async (c) => {
  // Verificación manual para permitir admin o agent
  const token = c.req.header('Authorization')?.replace('Bearer ', '')
  if (!token) return c.json({ error: 'Token requerido' }, 401)
  const payload = await (await import('../services/auth')).verifyToken(token, c.env.SECRET_KEY)
  if (!payload) return c.json({ error: 'Token inválido' }, 401)
  const body = await c.req.json()
  const msgId = nanoid()

  await c.env.DB.prepare(`
    INSERT INTO task_messages (id, task_id, sender_id, sender_name, content, message_type)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(msgId, c.req.param('id'), body.sender_id, body.sender_name || '', body.content, body.message_type || 'text').run()

  return c.json({ message: 'Mensaje guardado', id: msgId })
})

// PATCH /tasks/:id/complete — marcar tarea como completada (requiere admin o agente)
tasks.patch('/:id/complete', async (c) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '')
  if (!token) return c.json({ error: 'Token requerido' }, 401)
  const payload = await (await import('../services/auth')).verifyToken(token, c.env.SECRET_KEY)
  if (!payload) return c.json({ error: 'Token inválido' }, 401)

  const body = await c.req.json().catch(() => ({}))
  await c.env.DB.prepare(`
    UPDATE tasks SET status = 'completed', result = ?, completed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?
  `).bind(JSON.stringify((body as any).result || {}), c.req.param('id')).run()
  return c.json({ message: 'Tarea completada' })
})

export default tasks

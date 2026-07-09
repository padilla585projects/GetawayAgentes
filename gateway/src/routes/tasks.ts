import { Hono } from 'hono'
import { Env, Subtask } from '../models/types'
import { nanoid } from '../services/utils'

const tasks = new Hono<{ Bindings: Env }>()

// POST /tasks — create and dispatch a task
tasks.post('/', async (c) => {
  const body = await c.req.json()
  const id = nanoid()

  const assignedAgents = body.assigned_agents || []
  let mode = body.mode || 'auto'

  // Determine mode
  if (mode === 'collaborative' || (mode === 'auto' && body.collaborative)) {
    mode = 'collaborative'
  } else if (assignedAgents.length > 0 && mode === 'auto') {
    mode = 'targeted'
  }

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

  const hub = c.env.GATEWAY_HUB.get(c.env.GATEWAY_HUB.idFromName('main'))

  if (mode === 'collaborative') {
    // ─── Collaborative mode: orchestrate across agents ───
    // Get online agents and their capabilities
    const onlineRes = await hub.fetch('http://internal/online-agents')
    const onlineAgents = await onlineRes.json() as Array<{ id: string; name: string; capabilities: string[] }>

    if (onlineAgents.length === 0) {
      await c.env.DB.prepare(`UPDATE tasks SET status = 'failed', updated_at = datetime('now') WHERE id = ?`).bind(id).run()
      return c.json({ error: 'No hay agentes conectados para colaborar' }, 400)
    }

    // Simple orchestration: assign to all online agents with subtask descriptions
    const subtasks: Subtask[] = onlineAgents.map(agent => ({
      id: nanoid(),
      task_id: id,
      agent_id: agent.id,
      agent_name: agent.name,
      description: `Contribuye con tus capacidades [${agent.capabilities.join(', ')}] a la tarea: ${body.title}. ${body.description}`,
      status: 'pending' as const,
      created_at: new Date().toISOString(),
    }))

    // Persist subtasks in context
    await c.env.DB.prepare(`
      UPDATE tasks SET status = 'collaborating', assigned_agents = ?, context = ?, updated_at = datetime('now') WHERE id = ?
    `).bind(
      JSON.stringify(onlineAgents.map(a => a.id)),
      JSON.stringify({ ...JSON.parse(body.context || '{}'), subtasks: subtasks.map(s => ({ id: s.id, agent_id: s.agent_id, agent_name: s.agent_name, description: s.description })) }),
      id,
    ).run()

    // Dispatch via hub
    await hub.fetch('http://internal/orchestrate', {
      method: 'POST',
      body: JSON.stringify({
        task: { id, title: body.title, description: body.description, priority: body.priority || 5, context: body.context || {} },
        subtasks,
      }),
    })

    return c.json({ message: 'Tarea colaborativa enviada', task_id: id, mode, agents_notified: subtasks.length })

  } else if (mode === 'broadcast' || mode === 'auto') {
    // ─── Broadcast: send to all agents ───
    const taskMsg = { type: 'task_assigned', task_id: id, title: body.title, description: body.description, priority: body.priority || 5, context: body.context || {} }
    await hub.fetch('http://internal/broadcast-agents', {
      method: 'POST',
      body: JSON.stringify(taskMsg),
    })

  } else {
    // ─── Targeted: send to specific agents ───
    const taskMsg = { type: 'task_assigned', task_id: id, title: body.title, description: body.description, priority: body.priority || 5, context: body.context || {} }
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

// GET /tasks — list all tasks
tasks.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT id, title, status, mode, priority, assigned_agents, created_at, completed_at
    FROM tasks ORDER BY created_at DESC
  `).all()

  return c.json(results.map(t => ({
    ...t,
    assigned_agents: JSON.parse(t.assigned_agents as string || '[]'),
  })))
})

// GET /tasks/:id — task detail with messages and subtasks
tasks.get('/:id', async (c) => {
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
    context: JSON.parse(task.context as string || '{}'),
    messages,
  })
})

// POST /tasks/:id/message — agent or admin sends a message in a task
tasks.post('/:id/message', async (c) => {
  const body = await c.req.json()
  const msgId = nanoid()

  await c.env.DB.prepare(`
    INSERT INTO task_messages (id, task_id, sender_id, sender_name, content, message_type)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(msgId, c.req.param('id'), body.sender_id, body.sender_name || '', body.content, body.message_type || 'text').run()

  // Broadcast message to agents if needed
  if (body.broadcast_to_agents) {
    const hub = c.env.GATEWAY_HUB.get(c.env.GATEWAY_HUB.idFromName('main'))
    await hub.fetch('http://internal/broadcast-agents', {
      method: 'POST',
      body: JSON.stringify({
        type: 'agent_message',
        from: body.sender_id,
        from_name: body.sender_name || 'Admin',
        content: body.content,
        task_id: c.req.param('id'),
      }),
    })
  }

  return c.json({ message: 'Mensaje guardado', id: msgId })
})

// PATCH /tasks/:id/complete — mark task as completed
tasks.patch('/:id/complete', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const taskId = c.req.param('id')

  const result = (body as any).result || {}

  // If collaborative, aggregate subtask results from context
  const task = await c.env.DB.prepare('SELECT * FROM tasks WHERE id = ?').bind(taskId).first()
  let aggregatedResult = result

  if (task && task.mode === 'collaborative') {
    const context = JSON.parse(task.context as string || '{}')
    const subtasks = context.subtasks || []

    // Collect subtask results from task_messages (type: 'result')
    const { results: subtaskMessages } = await c.env.DB.prepare(`
      SELECT content FROM task_messages WHERE task_id = ? AND message_type = 'result' ORDER BY created_at ASC
    `).bind(taskId).all()

    aggregatedResult = {
      ...result,
      collaborative: true,
      agent_results: subtaskMessages.map(m => {
        try { return JSON.parse(m.content as string) } catch { return m.content }
      }),
      subtask_count: subtasks.length,
      agents_involved: subtasks.map((s: any) => ({ id: s.agent_id, name: s.agent_name })),
    }
  }

  await c.env.DB.prepare(`
    UPDATE tasks SET status = 'completed', result = ?, completed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?
  `).bind(JSON.stringify(aggregatedResult), taskId).run()

  // Notify all agents and admins
  const hub = c.env.GATEWAY_HUB.get(c.env.GATEWAY_HUB.idFromName('main'))
  await hub.fetch('http://internal/broadcast-message', {
    method: 'POST',
    body: JSON.stringify({ type: 'task_status_update', task_id: taskId, status: 'completed', result: aggregatedResult }),
  })

  return c.json({ message: 'Tarea completada', result: aggregatedResult })
})

// POST /tasks/:id/complete-subtask — agent completes a subtask
tasks.post('/:id/complete-subtask', async (c) => {
  const body = await c.req.json()
  const taskId = c.req.param('id')
  const { subtask_id, agent_id, agent_name, result } = body

  // Save subtask result as a task message
  const msgId = nanoid()
  await c.env.DB.prepare(`
    INSERT INTO task_messages (id, task_id, sender_id, sender_name, content, message_type)
    VALUES (?, ?, ?, ?, ?, 'result')
  `).bind(msgId, taskId, agent_id, agent_name || '', JSON.stringify({ subtask_id, result })).run()

  // Update task context with subtask completion
  const task = await c.env.DB.prepare('SELECT context FROM tasks WHERE id = ?').bind(taskId).first()
  if (task) {
    const context = JSON.parse(task.context as string || '{}')
    const subtasks = (context.subtasks || []).map((s: any) =>
      s.id === subtask_id ? { ...s, status: 'completed', result } : s,
    )
    context.subtasks = subtasks
    await c.env.DB.prepare(`UPDATE tasks SET context = ?, updated_at = datetime('now') WHERE id = ?`).bind(JSON.stringify(context), taskId).run()

    // Check if all subtasks are done
    if (subtasks.every((s: any) => s.status === 'completed')) {
      await c.env.DB.prepare(`UPDATE tasks SET status = 'completed', completed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`).bind(taskId).run()

      // Aggregate results
      const aggregatedResult = {
        collaborative: true,
        agent_results: subtasks.map((s: any) => ({ agent_id: s.agent_id, agent_name: s.agent_name, result: s.result })),
        agents_involved: subtasks.map((s: any) => ({ id: s.agent_id, name: s.agent_name })),
      }
      await c.env.DB.prepare(`UPDATE tasks SET result = ? WHERE id = ?`).bind(JSON.stringify(aggregatedResult), taskId).run()

      // Notify completion
      const hub = c.env.GATEWAY_HUB.get(c.env.GATEWAY_HUB.idFromName('main'))
      await hub.fetch('http://internal/broadcast-message', {
        method: 'POST',
        body: JSON.stringify({ type: 'orchestration_complete', task_id: taskId, result: aggregatedResult }),
      })
    }
  }

  return c.json({ message: 'Subtarea completada' })
})

// POST /tasks/:id/request-knowledge — request knowledge from agents
tasks.post('/:id/request-knowledge', async (c) => {
  const body = await c.req.json()
  const taskId = c.req.param('id')
  const { query, requester_id } = body

  const hub = c.env.GATEWAY_HUB.get(c.env.GATEWAY_HUB.idFromName('main'))
  await hub.fetch('http://internal/knowledge-query', {
    method: 'POST',
    body: JSON.stringify({ query, task_id: taskId, requester_id: requester_id || 'admin' }),
  })

  return c.json({ message: 'Consulta de conocimiento enviada' })
})

export default tasks

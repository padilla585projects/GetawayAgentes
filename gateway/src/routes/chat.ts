import { Hono } from 'hono'
import { Env } from '../models/types'
import { nanoid } from '../services/utils'

const chat = new Hono<{ Bindings: Env }>()

// GET /chat — get chat messages (with pagination and channel filter)
chat.get('/', async (c) => {
  const channel = c.req.query('channel') || 'general'
  const limit = parseInt(c.req.query('limit') || '100')
  const before = c.req.query('before') // timestamp cursor

  let query = 'SELECT * FROM chat_messages WHERE channel = ?'
  const params: any[] = [channel]

  if (before) {
    query += ' AND created_at < ?'
    params.push(before)
  }

  query += ' ORDER BY created_at DESC LIMIT ?'
  params.push(limit)

  const { results } = await c.env.DB.prepare(query).bind(...params).all()

  return c.json(results.reverse()) // Return oldest first for chat display
})

// GET /chat/activity — get activity feed (all channels combined)
chat.get('/activity', async (c) => {
  const limit = parseInt(c.req.query('limit') || '50')

  const { results } = await c.env.DB.prepare(`
    SELECT * FROM chat_messages
    ORDER BY created_at DESC
    LIMIT ?
  `).bind(limit).all()

  return c.json(results.reverse())
})

// GET /chat/agents — get list of agents with last message time
chat.get('/agents', async (c) => {
  const { results: agents } = await c.env.DB.prepare(`
    SELECT id, name, status, capabilities, last_seen FROM agents WHERE status != 'rejected' ORDER BY name
  `).all()

  // Get last message time for each agent
  const agentsWithLastMsg = await Promise.all(agents.map(async (agent) => {
    const lastMsg = await c.env.DB.prepare(`
      SELECT created_at FROM chat_messages
      WHERE target_agent_id = ? OR sender_id = ?
      ORDER BY created_at DESC LIMIT 1
    `).bind(agent.id, agent.id).first()

    return {
      ...agent,
      capabilities: JSON.parse(agent.capabilities as string || '[]'),
      last_message: lastMsg?.created_at || null,
    }
  }))

  return c.json(agentsWithLastMsg)
})

// POST /chat — send a message
chat.post('/', async (c) => {
  const body = await c.req.json()
  const id = nanoid()

  const senderId = body.sender_id || 'admin'
  const senderName = body.sender_name || 'Admin'
  const senderRole = body.sender_role || 'admin'
  const channel = body.channel || 'general'
  const targetAgentId = body.target_agent_id || null
  const messageType = body.message_type || 'text'
  const metadata = body.metadata || {}

  await c.env.DB.prepare(`
    INSERT INTO chat_messages (id, sender_id, sender_name, sender_role, content, channel, target_agent_id, message_type, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id, senderId, senderName, senderRole, body.content, channel,
    targetAgentId, messageType, JSON.stringify(metadata),
  ).run()

  // If directed to a specific agent, send via WebSocket
  if (targetAgentId) {
    const hub = c.env.GATEWAY_HUB.get(c.env.GATEWAY_HUB.idFromName('main'))
    await hub.fetch('http://internal/send-agent', {
      method: 'POST',
      body: JSON.stringify({
        agent_id: targetAgentId,
        message: {
          type: 'agent_message',
          from: senderId,
          from_name: senderName,
          content: body.content,
          channel,
        },
      }),
    })
  } else if (channel === 'general') {
    // Broadcast to all agents
    const hub = c.env.GATEWAY_HUB.get(c.env.GATEWAY_HUB.idFromName('main'))
    await hub.fetch('http://internal/broadcast-agents', {
      method: 'POST',
      body: JSON.stringify({
        type: 'agent_message',
        from: senderId,
        from_name: senderName,
        content: body.content,
        channel: 'general',
      }),
    })
  }

  // Notify admins of new message
  const hub = c.env.GATEWAY_HUB.get(c.env.GATEWAY_HUB.idFromName('main'))
  await hub.fetch('http://internal/notify-admin', {
    method: 'POST',
    body: JSON.stringify({
      type: 'chat_message',
      id,
      sender_id: senderId,
      sender_name: senderName,
      sender_role: senderRole,
      content: body.content,
      channel,
      target_agent_id: targetAgentId,
      message_type: messageType,
      created_at: new Date().toISOString(),
    }),
  })

  return c.json({ message: 'Mensaje enviado', id })
})

// GET /chat/channels — list all active channels
chat.get('/channels', async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT channel, COUNT(*) as message_count, MAX(created_at) as last_message
    FROM chat_messages
    GROUP BY channel
    ORDER BY last_message DESC
  `).all()

  return c.json(results)
})

// DELETE /chat/:id — delete a message
chat.delete('/:id', async (c) => {
  const id = c.req.param('id')
  await c.env.DB.prepare('DELETE FROM chat_messages WHERE id = ?').bind(id).run()
  return c.json({ message: 'Mensaje eliminado' })
})

// POST /chat/agent-response — agent responds to a chat message
chat.post('/agent-response', async (c) => {
  const body = await c.req.json()
  const id = nanoid()

  const { agent_id, agent_name, content, channel, target_admin } = body

  // Save agent response
  await c.env.DB.prepare(`
    INSERT INTO chat_messages (id, sender_id, sender_name, sender_role, content, channel, target_agent_id, message_type, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id, agent_id, agent_name, 'agent', content, channel || 'general',
    null, 'text', JSON.stringify({ target_admin: target_admin || null }),
  ).run()

  // Notify admins
  const hub = c.env.GATEWAY_HUB.get(c.env.GATEWAY_HUB.idFromName('main'))
  await hub.fetch('http://internal/notify-admin', {
    method: 'POST',
    body: JSON.stringify({
      type: 'chat_message',
      id,
      sender_id: agent_id,
      sender_name: agent_name,
      sender_role: 'agent',
      content,
      channel: channel || 'general',
      target_agent_id: null,
      message_type: 'text',
      created_at: new Date().toISOString(),
    }),
  })

  return c.json({ message: 'Respuesta enviada', id })
})

export default chat

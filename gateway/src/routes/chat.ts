import { Hono } from 'hono'
import { Env } from '../models/types'
import { nanoid } from '../services/utils'
import { BUILTIN_AGENTS, findBuiltinAgent, fallbackResponse, type BuiltinAgent } from '../agents/builtin'

const chat = new Hono<{ Bindings: Env }>()

// Genera y guarda la respuesta de un agente built-in a un mensaje.
// Si la IA no responde y no hay match por palabras clave, usa fallback
// sólo cuando `forced` es true (mensaje directo o coordinador orientador).
async function respondAsBuiltin(
  env: Env,
  agent: BuiltinAgent,
  userMessage: string,
  channel: string,
  forced: boolean,
): Promise<boolean> {
  let reply = await agent.respond(userMessage, env)
  if (!reply && forced) reply = fallbackResponse(agent)
  if (!reply) return false

  const id = nanoid()
  await env.DB.prepare(`
    INSERT INTO chat_messages (id, sender_id, sender_name, sender_role, content, channel, target_agent_id, message_type, metadata)
    VALUES (?, ?, ?, 'agent', ?, ?, NULL, 'text', '{}')
  `).bind(id, agent.id, agent.name, reply, channel).run()

  const hub = env.GATEWAY_HUB.get(env.GATEWAY_HUB.idFromName('main'))
  await hub.fetch('http://internal/notify-admin', {
    method: 'POST',
    body: JSON.stringify({
      type: 'chat_message',
      id,
      sender_id: agent.id,
      sender_name: agent.name,
      sender_role: 'agent',
      content: reply,
      channel,
      target_agent_id: null,
      message_type: 'text',
      created_at: new Date().toISOString(),
    }),
  })
  return true
}

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
  try {
    const body = await c.req.json()
    const id = nanoid()

    const content = body.message ?? body.content ?? ''
    if (!content) return c.json({ error: 'Mensaje vacío' }, 400)

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
      id, senderId, senderName, senderRole, content, channel,
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
            content: content,
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
          content: content,
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
        content: content,
        channel,
        target_agent_id: targetAgentId,
        message_type: messageType,
        created_at: new Date().toISOString(),
      }),
    })

    // Respuesta server-side de los agentes built-in (siempre disponibles).
    // Solo cuando el emisor es un humano (admin), no otro agente.
    if (senderRole !== 'agent') {
      const directTarget = targetAgentId || (findBuiltinAgent(channel) ? channel : null)
      if (directTarget) {
        const agent = findBuiltinAgent(directTarget)
        if (agent) await respondAsBuiltin(c.env, agent, content, channel, true)
      } else if (channel === 'general') {
        // Broadcast: responden los agentes cuyo dominio coincide con el mensaje
        // (filtro rápido por palabras clave; la respuesta real la genera la IA).
        let answered = 0
        for (const agent of BUILTIN_AGENTS) {
          if (agent.keywordReply(content)) {
            await respondAsBuiltin(c.env, agent, content, 'general', false)
            answered++
          }
        }
        // Si nadie tuvo match, responde el coordinador como orientador.
        if (answered === 0) {
          const coordinator = findBuiltinAgent('builtin-project-coordinator')
          if (coordinator) await respondAsBuiltin(c.env, coordinator, content, 'general', true)
        }
      }
    }

    return c.json({ message: 'Mensaje enviado', id })
  } catch (e: any) {
    return c.json({ error: 'Error interno', detail: e?.message || String(e), stack: e?.stack }, 500)
  }
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

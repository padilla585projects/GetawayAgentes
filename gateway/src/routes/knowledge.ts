import { Hono } from 'hono'
import { Env } from '../models/types'
import { nanoid } from '../services/utils'

const knowledge = new Hono<{ Bindings: Env }>()

// GET /knowledge — list entries (agents and admin)
knowledge.get('/', async (c) => {
  const visibility = c.req.query('visibility') || 'public'
  const category = c.req.query('category')
  const search = c.req.query('search')

  let query = `SELECT * FROM knowledge_entries WHERE visibility = ?`
  const params: string[] = [visibility]

  if (category) {
    query += ` AND category = ?`
    params.push(category)
  }

  if (search) {
    query += ` AND (title LIKE ? OR content LIKE ? OR tags LIKE ?)`
    const term = `%${search}%`
    params.push(term, term, term)
  }

  query += ` ORDER BY relevance_score DESC, times_used DESC LIMIT 100`

  const { results } = await c.env.DB.prepare(query).bind(...params).all()
  return c.json(results.map(k => ({ ...k, tags: JSON.parse(k.tags as string || '[]') })))
})

// GET /knowledge/search — search by multiple criteria (for agents)
knowledge.get('/search', async (c) => {
  const query = c.req.query('q') || ''
  const capabilities = c.req.query('capabilities') || ''
  const limit = parseInt(c.req.query('limit') || '10')

  let sql = `SELECT * FROM knowledge_entries WHERE visibility IN ('public', 'trusted')`
  const params: string[] = []

  if (query) {
    sql += ` AND (title LIKE ? OR content LIKE ? OR category LIKE ?)`
    const term = `%${query}%`
    params.push(term, term, term)
  }

  if (capabilities) {
    const caps = capabilities.split(',')
    const tagConditions = caps.map(() => `tags LIKE ?`).join(' OR ')
    sql += ` AND (${tagConditions})`
    caps.forEach(cap => params.push(`%${cap.trim()}%`))
  }

  sql += ` ORDER BY relevance_score DESC, times_used DESC LIMIT ?`
  params.push(String(limit))

  const { results } = await c.env.DB.prepare(sql).bind(...params).all()

  // Track usage for each returned entry
  for (const entry of results) {
    await c.env.DB.prepare(`
      UPDATE knowledge_entries SET times_used = times_used + 1, updated_at = datetime('now') WHERE id = ?
    `).bind(entry.id).run()
  }

  return c.json(results.map(k => ({ ...k, tags: JSON.parse(k.tags as string || '[]') })))
})

// POST /knowledge — add new entry (agent or admin)
knowledge.post('/', async (c) => {
  const body = await c.req.json()
  const id = nanoid()

  await c.env.DB.prepare(`
    INSERT INTO knowledge_entries (id, title, content, category, tags, source_agent_id, source_agent_name, source_task_id, visibility)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    body.title,
    body.content,
    body.category || 'general',
    JSON.stringify(body.tags || []),
    body.source_agent_id || '',
    body.source_agent_name || '',
    body.source_task_id || '',
    body.visibility || 'public',
  ).run()

  // Notify admins if from an agent
  if (body.source_agent_id) {
    const hub = c.env.GATEWAY_HUB.get(c.env.GATEWAY_HUB.idFromName('main'))
    await hub.fetch('http://internal/notify-admin', {
      method: 'POST',
      body: JSON.stringify({
        type: 'knowledge_published',
        agent_id: body.source_agent_id,
        agent_name: body.source_agent_name || 'Unknown',
        entry_id: id,
        title: body.title,
        category: body.category || 'general',
      }),
    })
  }

  return c.json({ message: 'Conocimiento agregado', id })
})

// POST /knowledge/:id/use — register usage
knowledge.post('/:id/use', async (c) => {
  await c.env.DB.prepare(`
    UPDATE knowledge_entries SET times_used = times_used + 1, updated_at = datetime('now') WHERE id = ?
  `).bind(c.req.param('id')).run()
  return c.json({ message: 'OK' })
})

// DELETE /knowledge/:id — admin removes entry
knowledge.delete('/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM knowledge_entries WHERE id = ?').bind(c.req.param('id')).run()
  return c.json({ message: 'Entrada eliminada' })
})

export default knowledge

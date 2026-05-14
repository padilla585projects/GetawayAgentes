import { Hono } from 'hono'
import { Env } from '../models/types'
import { nanoid } from '../services/utils'
import { requireAdmin } from '../middleware/auth'

const knowledge = new Hono<{ Bindings: Env }>()

// GET /knowledge — listar entradas (público — agentes y admin leen)
knowledge.get('/', async (c) => {
  const visibility = c.req.query('visibility') || 'public'
  const category = c.req.query('category')

  let query = `SELECT * FROM knowledge_entries WHERE visibility = ?`
  const params: string[] = [visibility]

  if (category) {
    query += ` AND category = ?`
    params.push(category)
  }

  query += ` ORDER BY relevance_score DESC, times_used DESC LIMIT 100`

  const { results } = await c.env.DB.prepare(query).bind(...params).all()
  return c.json(results.map(k => ({ ...k, tags: JSON.parse(k.tags as string || '[]') })))
})

// POST /knowledge — agregar nuevo conocimiento (requiere admin)
knowledge.post('/', requireAdmin, async (c) => {
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

  return c.json({ message: 'Conocimiento agregado', id })
})

// POST /knowledge/:id/use — registrar que un agente usó este conocimiento
knowledge.post('/:id/use', async (c) => {
  await c.env.DB.prepare(`
    UPDATE knowledge_entries SET times_used = times_used + 1, updated_at = datetime('now') WHERE id = ?
  `).bind(c.req.param('id')).run()
  return c.json({ message: 'OK' })
})

// DELETE /knowledge/:id — admin elimina una entrada (requiere admin)
knowledge.delete('/:id', requireAdmin, async (c) => {
  await c.env.DB.prepare('DELETE FROM knowledge_entries WHERE id = ?').bind(c.req.param('id')).run()
  return c.json({ message: 'Entrada eliminada' })
})

export default knowledge

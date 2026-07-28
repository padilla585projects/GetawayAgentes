import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { Env } from './models/types'
import agents from './routes/agents'
import tasks from './routes/tasks'
import knowledge from './routes/knowledge'
import chat from './routes/chat'
import improvements from './routes/improvements'
import { verifyToken } from './services/auth'
import { handleMcpRequest } from './mcp/server'
import { ensureSchema } from './services/schema'
import { ensureBuiltinAgents } from './agents/builtin'

export { GatewayHub } from './durable/GatewayHub'

const app = new Hono<{ Bindings: Env }>()

// Asegura el esquema de base de datos y los agentes built-in al iniciar
app.use('*', async (c, next) => {
  await ensureSchema(c.env.DB)
  await ensureBuiltinAgents(c.env.DB)
  await next()
})

// CORS — permite peticiones desde la web app y la app móvil.
// Hono hace coincidencia exacta en arrays, así que usamos una función
// para aceptar cualquier subdominio *.pages.dev y *.workers.dev.
app.use('*', cors({
  origin: (origin) => {
    if (!origin) return '*'
    if (
      origin === 'http://localhost:3000' ||
      origin.endsWith('.pages.dev') ||
      origin.endsWith('.workers.dev')
    ) return origin
    return null
  },
  allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}))

// Health check
app.get('/', c => c.json({ status: 'ok', name: 'GetawayAgentes Gateway', version: '1.0.0' }))



// WebSocket — agent and admin real-time connection
app.get('/ws', async (c) => {
  const role = c.req.query('role') || 'agent'
  const token = c.req.query('token') || c.req.header('Authorization')?.replace('Bearer ', '')

  if (!token) return c.json({ error: 'Token requerido' }, 401)

  const payload = await verifyToken(token, c.env.SECRET_KEY)
  if (!payload) return c.json({ error: 'Token inválido' }, 401)

  // For agents, fetch capabilities from DB to pass to the hub
  let capabilities: string[] = []
  if (role === 'agent') {
    const agent = await c.env.DB.prepare('SELECT capabilities FROM agents WHERE id = ?').bind(payload.sub).first()
    if (agent) {
      capabilities = JSON.parse(agent.capabilities as string || '[]')
    }
  }

  const hub = c.env.GATEWAY_HUB.get(c.env.GATEWAY_HUB.idFromName('main'))
  const url = new URL(c.req.url)
  url.searchParams.set('session_id', payload.sub as string)
  url.searchParams.set('name', payload.name as string || '')
  url.searchParams.set('role', role)
  if (capabilities.length > 0) {
    url.searchParams.set('capabilities', JSON.stringify(capabilities))
  }

  return hub.fetch(new Request(url.toString(), c.req.raw))
})

// Rutas de la API
app.route('/agents', agents)
app.route('/tasks', tasks)
app.route('/knowledge', knowledge)
app.route('/chat', chat)
app.route('/improvements', improvements)

// Admin login
app.post('/auth/login', async (c) => {
  const { username, password } = await c.req.json<{ username: string; password: string }>()
  const { hashPassword, signToken } = await import('./services/auth')

  const admin = await c.env.DB.prepare('SELECT * FROM admins WHERE username = ?').bind(username).first()
  if (!admin) return c.json({ error: 'Credenciales incorrectas' }, 401)

  const valid = (await hashPassword(password)) === admin.hashed_password
  if (!valid) return c.json({ error: 'Credenciales incorrectas' }, 401)

  const token = await signToken({ sub: admin.id, name: admin.username, type: 'admin' }, c.env.SECRET_KEY)
  return c.json({ token, username: admin.username })
})

// MCP endpoint — Model Context Protocol server
app.all('/mcp', async (c) => {
  return handleMcpRequest(c.req.raw, c.env)
})

// Crear primer admin (solo en development)
app.post('/auth/setup', async (c) => {
  if (c.env.ENVIRONMENT !== 'development') return c.json({ error: 'No disponible' }, 403)

  const { username, email, password } = await c.req.json<{ username: string; email: string; password: string }>()
  const { hashPassword, nanoid } = await import('./services/auth').then(async m => ({ hashPassword: m.hashPassword, nanoid: (await import('./services/utils')).nanoid }))

  const id = crypto.randomUUID()
  const hashed = await hashPassword(password)

  await c.env.DB.prepare('INSERT INTO admins (id, username, email, hashed_password) VALUES (?, ?, ?, ?)')
    .bind(id, username, email, hashed).run()

  return c.json({ message: 'Admin creado', id })
})

export default app

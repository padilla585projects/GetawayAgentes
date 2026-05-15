import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { Env } from './models/types'
import agents from './routes/agents'
import tasks from './routes/tasks'
import knowledge from './routes/knowledge'
import { verifyToken } from './services/auth'

export { GatewayHub } from './durable/GatewayHub'

const app = new Hono<{ Bindings: Env }>()

// CORS — permite peticiones desde la web app y la app móvil
app.use('*', cors({
  origin: (origin) => {
    if (!origin) return '*'
    if (origin.includes('localhost') || origin.endsWith('.pages.dev') || origin.endsWith('.workers.dev')) {
      return origin
    }
    return null
  },
  allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}))

// Health check
app.get('/', c => c.json({ status: 'ok', name: 'GetawayAgentes Gateway', version: '1.0.0' }))

// WebSocket — conexión de agentes y admins al hub en tiempo real
app.get('/ws', async (c) => {
  const role = c.req.query('role') || 'agent'
  const token = c.req.query('token') || c.req.header('Authorization')?.replace('Bearer ', '')

  if (!token) return c.json({ error: 'Token requerido' }, 401)

  const payload = await verifyToken(token, c.env.SECRET_KEY)
  if (!payload) return c.json({ error: 'Token inválido' }, 401)

  const hub = c.env.GATEWAY_HUB.get(c.env.GATEWAY_HUB.idFromName('main'))
  const url = new URL(c.req.url)
  url.searchParams.set('session_id', payload.sub as string)
  url.searchParams.set('name', payload.name as string || '')
  url.searchParams.set('role', role)

  return hub.fetch(new Request(url.toString(), c.req.raw))
})

// Rutas de la API
app.route('/agents', agents)
app.route('/tasks', tasks)
app.route('/knowledge', knowledge)

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

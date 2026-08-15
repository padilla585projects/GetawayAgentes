import { Hono } from 'hono'
import { Env } from '../models/types'
import { verifyToken } from '../services/auth'
import { isMaintenanceOn, setMaintenance } from '../services/maintenance'

const admin = new Hono<{ Bindings: Env }>()

// El kill switch corta prácticamente todo el tráfico — solo el admin logueado
// puede tocarlo. `/agents/:id/approve` y similares no tienen esta guarda hoy;
// aquí sí la ponemos porque esta ruta puede dejar el sistema inoperativo.
admin.use('*', async (c, next) => {
  const auth = c.req.header('Authorization')?.replace('Bearer ', '')
  const payload = auth ? await verifyToken(auth, c.env.SECRET_KEY) : null
  if (!payload || payload.type !== 'admin') {
    return c.json({ error: 'No autorizado' }, 401)
  }
  await next()
})

// GET /admin/status — estado actual del kill switch
admin.get('/status', async (c) => {
  return c.json({ maintenance: await isMaintenanceOn(c.env) })
})

// POST /admin/maintenance — enciende o apaga el kill switch
admin.post('/maintenance', async (c) => {
  const { enabled } = await c.req.json<{ enabled: boolean }>()
  await setMaintenance(c.env, enabled)

  const hub = c.env.GATEWAY_HUB.get(c.env.GATEWAY_HUB.idFromName('main'))
  await hub.fetch(`http://internal/${enabled ? 'shutdown' : 'resume'}`, { method: 'POST' })

  return c.json({ maintenance: enabled })
})

export default admin

import { Context, Next } from 'hono'
import { Env, AuthPayload, AppContext } from '../models/types'
import { verifyToken } from '../services/auth'

export async function authenticateRequest(c: Context<{ Bindings: Env } & AppContext>, next: Next) {
  const token = c.req.header('Authorization')?.replace('Bearer ', '') || c.req.query('token')

  if (!token) {
    return c.json({ error: 'Token requerido' }, 401)
  }

  const payload = await verifyToken(token, c.env.SECRET_KEY)
  if (!payload) {
    return c.json({ error: 'Token inválido' }, 401)
  }

  c.set('auth', payload as unknown as AuthPayload)
  await next()
}

export async function requireAdmin(c: Context<{ Bindings: Env } & AppContext>, next: Next) {
  const token = c.req.header('Authorization')?.replace('Bearer ', '') || c.req.query('token')

  if (!token) {
    return c.json({ error: 'Token requerido' }, 401)
  }

  const payload = await verifyToken(token, c.env.SECRET_KEY)
  if (!payload || payload.type !== 'admin') {
    return c.json({ error: 'Se requiere autenticación de administrador' }, 403)
  }

  c.set('auth', payload as unknown as AuthPayload)
  await next()
}

export async function requireAgent(c: Context<{ Bindings: Env } & AppContext>, next: Next) {
  const token = c.req.header('Authorization')?.replace('Bearer ', '') || c.req.query('token')

  if (!token) {
    return c.json({ error: 'Token requerido' }, 401)
  }

  const payload = await verifyToken(token, c.env.SECRET_KEY)
  if (!payload || payload.type !== 'agent') {
    return c.json({ error: 'Se requiere autenticación de agente' }, 403)
  }

  c.set('auth', payload as unknown as AuthPayload)
  await next()
}

export function getAuth(c: Context<{ Bindings: Env } & AppContext>): AuthPayload | null {
  return c.get('auth') || null
}

import { Env } from '../models/types'

// "Kill switch": cuando está activo el gateway rechaza casi todo (agentes,
// tareas, conocimiento, chat, WebSocket) con un 503 sin tocar D1 ni el
// Durable Object — es la forma más barata de frenar el tráfico hacia
// Cloudflare si algo se descontrola.
//
// Se guarda en KV en vez de D1 porque KV se lee antes que nada (ni siquiera
// necesitamos ensureSchema para consultarlo) y es la pieza más barata posible.
const KV_KEY = 'maintenance_mode'

export async function isMaintenanceOn(env: Env): Promise<boolean> {
  return (await env.KV.get(KV_KEY)) === 'on'
}

export async function setMaintenance(env: Env, enabled: boolean): Promise<void> {
  if (enabled) {
    await env.KV.put(KV_KEY, 'on')
  } else {
    await env.KV.delete(KV_KEY)
  }
}

// Rutas que deben seguir funcionando incluso en modo mantenimiento:
// - login, para que el admin pueda volver a entrar y desactivarlo
// - /admin/*, el propio kill switch
// - /, el health check
export function isAllowedDuringMaintenance(pathname: string): boolean {
  return pathname === '/' || pathname === '/auth/login' || pathname.startsWith('/admin/')
}

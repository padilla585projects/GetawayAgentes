'use client'

import { useEffect, useState } from 'react'
import { api } from './api'
import { gatewaySocket } from './ws'

/**
 * Estado del kill switch. Se lee una vez al montar (no hay polling) y a
 * partir de ahí se mantiene al día con el evento `maintenance` que el
 * Durable Object difunde a todos los admins conectados.
 */
export function useMaintenance() {
  const [maintenance, setMaintenance] = useState<boolean | null>(null)

  useEffect(() => {
    api.getMaintenanceStatus().then(r => setMaintenance(r.maintenance)).catch(() => {})

    const handler = (msg: { type: string; enabled?: boolean }) => {
      if (msg.type === 'maintenance' && typeof msg.enabled === 'boolean') {
        setMaintenance(msg.enabled)
      }
    }
    gatewaySocket.on('*', handler)
    return () => gatewaySocket.off('*', handler)
  }, [])

  async function toggle() {
    const next = !maintenance
    // Optimista: el propio toggle puede dejar sin respuesta al gateway
    // (es la idea), así que no esperamos confirmación por WS para reflejarlo.
    setMaintenance(next)
    try {
      await api.setMaintenance(next)
    } catch {
      setMaintenance(!next)
    }
  }

  return { maintenance, toggle }
}

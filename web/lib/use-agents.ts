'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Agent } from './types'
import { api } from './api'
import { gatewaySocket } from './ws'

// Eventos del gateway que invalidan la lista de agentes. El WebSocket ya empuja
// estos cambios, así que no hace falta sondear `GET /agents` en bucle — cada
// llamada golpea además al Durable Object para resolver `is_online`.
const AGENT_EVENTS = new Set([
  'agents_list',
  'agent_online',
  'agent_offline',
  'agent_pending',
  'registration_approved',
  'registration_rejected',
])

/**
 * Lista de agentes sincronizada por WebSocket.
 * Recarga al montar, cuando llega un evento relevante (con debounce, para que
 * cinco agentes conectándose a la vez no disparen cinco peticiones) y al volver
 * a la pestaña, por si se perdió algún evento mientras estaba en segundo plano.
 */
export function useAgents() {
  const [agents, setAgents] = useState<Agent[]>([])
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const reload = useCallback(() => {
    api.getAgents().then(setAgents).catch(() => {})
  }, [])

  useEffect(() => {
    const token = localStorage.getItem('admin_token')
    if (token) gatewaySocket.connect(token)
    reload()

    const handler = (msg: { type: string }) => {
      if (!AGENT_EVENTS.has(msg.type)) return
      if (debounce.current) clearTimeout(debounce.current)
      debounce.current = setTimeout(reload, 300)
    }
    gatewaySocket.on('*', handler)

    const onVisible = () => {
      if (document.visibilityState === 'visible') reload()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      gatewaySocket.off('*', handler)
      document.removeEventListener('visibilitychange', onVisible)
      if (debounce.current) clearTimeout(debounce.current)
    }
  }, [reload])

  return { agents, reload }
}

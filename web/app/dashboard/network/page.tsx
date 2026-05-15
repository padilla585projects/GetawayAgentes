'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { gatewaySocket } from '@/lib/ws'
import clsx from 'clsx'

const STATUS_COLOR: Record<string, string> = {
  idle: 'border-green-500 shadow-green-500/30',
  working: 'border-blue-500 shadow-blue-500/30',
  offline: 'border-gray-600 shadow-none',
  pending: 'border-yellow-500 shadow-yellow-500/30',
  rejected: 'border-red-600 shadow-none',
}

const STATUS_DOT: Record<string, string> = {
  idle: 'bg-green-400',
  working: 'bg-blue-400 animate-pulse',
  offline: 'bg-gray-600',
  pending: 'bg-yellow-400 animate-pulse',
  rejected: 'bg-red-600',
}

const STATUS_LABEL: Record<string, string> = {
  idle: 'En espera',
  working: 'Trabajando',
  offline: 'Offline',
  pending: 'Pendiente',
  rejected: 'Rechazado',
}

export default function NetworkPage() {
  const [agents, setAgents] = useState<any[]>([])
  const [selected, setSelected] = useState<any | null>(null)
  const [activity, setActivity] = useState<{ id: string; text: string; ts: number; color: string }[]>([])
  const [stats, setStats] = useState({ online: 0, working: 0, pending: 0, offline: 0 })

  const load = () => api.getAgents().then(data => {
    setAgents(data)
    setStats({
      online: data.filter((a: any) => a.status === 'idle').length,
      working: data.filter((a: any) => a.status === 'working').length,
      pending: data.filter((a: any) => a.status === 'pending').length,
      offline: data.filter((a: any) => a.status === 'offline').length,
    })
  }).catch(() => {})

  useEffect(() => {
    load()
    const token = localStorage.getItem('admin_token')
    if (token) gatewaySocket.connect(token)

    const handle = (msg: any) => {
      const now = Date.now()
      if (msg.type === 'agent_online') {
        setActivity(p => [{ id: `${now}`, text: `🟢 ${msg.agent_name} se conectó`, ts: now, color: 'text-green-400' }, ...p.slice(0, 49)])
        load()
      }
      if (msg.type === 'agent_offline') {
        setActivity(p => [{ id: `${now}`, text: `🔴 ${msg.agent_name} se desconectó`, ts: now, color: 'text-red-400' }, ...p.slice(0, 49)])
        load()
      }
      if (msg.type === 'agent_pending') {
        setActivity(p => [{ id: `${now}`, text: `⏳ ${msg.agent_name} solicita unirse`, ts: now, color: 'text-yellow-400' }, ...p.slice(0, 49)])
        load()
      }
      if (msg.type === 'task_result') {
        setActivity(p => [{ id: `${now}`, text: `✅ Tarea completada por agente`, ts: now, color: 'text-blue-400' }, ...p.slice(0, 49)])
        load()
      }
    }

    gatewaySocket.on('*', handle)
    const interval = setInterval(load, 10000)
    return () => { gatewaySocket.off('*', handle); clearInterval(interval) }
  }, [])

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">Red de Agentes</h2>

      {/* Estadísticas */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'En línea', value: stats.online, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/30' },
          { label: 'Trabajando', value: stats.working, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30' },
          { label: 'Pendientes', value: stats.pending, color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30' },
          { label: 'Offline', value: stats.offline, color: 'text-gray-400', bg: 'bg-gray-500/10 border-gray-700' },
        ].map(s => (
          <div key={s.label} className={clsx('border rounded-xl p-4 text-center', s.bg)}>
            <p className={clsx('text-3xl font-bold', s.color)}>{s.value}</p>
            <p className="text-gray-400 text-sm mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Mapa de agentes */}
        <div className="col-span-2 bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-gray-400 text-sm font-medium mb-4">Nodos activos</h3>
          {agents.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-gray-600">
              <div className="text-center">
                <p className="text-4xl mb-2">🌐</p>
                <p className="text-sm">Sin agentes en la red</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-4">
              {/* Nodo Admin */}
              <div className="flex flex-col items-center gap-2">
                <div className="w-16 h-16 rounded-full bg-blue-600 border-2 border-blue-400 shadow-lg shadow-blue-500/30 flex items-center justify-center cursor-default">
                  <span className="text-white text-xs font-bold">ADMIN</span>
                </div>
                <span className="text-xs text-gray-400">Tú</span>
              </div>

              {/* Línea conectora visual */}
              {agents.filter(a => a.status !== 'rejected').map(agent => (
                <div key={agent.id} className="flex flex-col items-center gap-2">
                  <button
                    onClick={() => setSelected(agent)}
                    className={clsx(
                      'w-16 h-16 rounded-full bg-gray-800 border-2 shadow-lg flex flex-col items-center justify-center transition-all hover:scale-110',
                      STATUS_COLOR[agent.status] || 'border-gray-600'
                    )}
                  >
                    <span className={clsx('w-2 h-2 rounded-full mb-1', STATUS_DOT[agent.status])} />
                    <span className="text-white text-xs font-medium text-center leading-tight px-1 truncate w-full text-center">
                      {agent.name.slice(0, 8)}
                    </span>
                  </button>
                  <span className="text-xs text-gray-500">{STATUS_LABEL[agent.status] || agent.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actividad en tiempo real */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col">
          <h3 className="text-gray-400 text-sm font-medium mb-3">Actividad en tiempo real</h3>
          <div className="flex-1 overflow-auto space-y-2">
            {activity.length === 0 ? (
              <p className="text-gray-600 text-xs text-center py-4">Esperando eventos...</p>
            ) : activity.map(ev => (
              <div key={ev.id} className="flex items-start gap-2">
                <span className={clsx('text-xs leading-relaxed', ev.color)}>{ev.text}</span>
                <span className="text-gray-600 text-xs ml-auto shrink-0">{new Date(ev.ts).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Lista detallada */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-800">
          <h3 className="text-gray-400 text-sm font-medium">Todos los nodos ({agents.length})</h3>
        </div>
        <div className="divide-y divide-gray-800">
          {agents.map(agent => (
            <div key={agent.id} onClick={() => setSelected(agent)} className="px-5 py-3 flex items-center gap-4 hover:bg-gray-800 cursor-pointer">
              <span className={clsx('w-2.5 h-2.5 rounded-full shrink-0', STATUS_DOT[agent.status])} />
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{agent.name}</p>
                <p className="text-gray-500 text-xs truncate">{agent.description || agent.endpoint || 'Sin endpoint'}</p>
              </div>
              <div className="flex gap-2 flex-wrap justify-end">
                {(agent.capabilities || []).slice(0, 2).map((cap: string) => (
                  <span key={cap} className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded">{cap}</span>
                ))}
              </div>
              <span className="text-gray-500 text-xs shrink-0">{agent.trust_level}</span>
              <span className="text-gray-600 text-xs shrink-0">{agent.last_seen ? new Date(agent.last_seen).toLocaleTimeString() : '—'}</span>
            </div>
          ))}
          {agents.length === 0 && (
            <p className="text-gray-600 text-sm text-center py-8">Sin agentes en la red</p>
          )}
        </div>
      </div>

      {/* Modal detalle */}
      {selected && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-md w-full space-y-4">
            <div className="flex justify-between">
              <div className="flex items-center gap-3">
                <span className={clsx('w-3 h-3 rounded-full', STATUS_DOT[selected.status])} />
                <h3 className="text-white font-bold text-lg">{selected.name}</h3>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-white">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-gray-800 rounded-lg p-3">
                <p className="text-gray-500 text-xs">Estado</p>
                <p className={clsx('font-medium mt-0.5', STATUS_DOT[selected.status].replace('bg-', 'text-'))}>{STATUS_LABEL[selected.status]}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-3">
                <p className="text-gray-500 text-xs">Confianza</p>
                <p className="text-white font-medium mt-0.5 capitalize">{selected.trust_level}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-3">
                <p className="text-gray-500 text-xs">Conexión</p>
                <p className="text-white mt-0.5">{selected.connection_type}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-3">
                <p className="text-gray-500 text-xs">Versión</p>
                <p className="text-white mt-0.5">v{selected.version}</p>
              </div>
            </div>
            <div>
              <p className="text-gray-500 text-xs mb-2">Capacidades</p>
              <div className="flex flex-wrap gap-1">
                {(selected.capabilities || []).map((cap: string) => (
                  <span key={cap} className="text-sm bg-blue-900 text-blue-200 px-2 py-0.5 rounded">{cap}</span>
                ))}
              </div>
            </div>
            <div className="bg-gray-800 rounded-lg p-3">
              <p className="text-gray-500 text-xs">ID</p>
              <p className="text-gray-300 font-mono text-xs mt-0.5 break-all">{selected.id}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

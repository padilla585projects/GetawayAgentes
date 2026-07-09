'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import clsx from 'clsx'

const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-yellow-500',
  idle: 'bg-green-500',
  working: 'bg-blue-500',
  sleeping: 'bg-gray-500',
  offline: 'bg-gray-700',
  rejected: 'bg-red-600',
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendiente',
  idle: 'En espera',
  working: 'Trabajando',
  sleeping: 'Dormido',
  offline: 'Offline',
  rejected: 'Rechazado',
}

const TRUST_OPTIONS = ['viewer', 'contributor', 'trusted']

export default function AgentsPage() {
  const [agents, setAgents] = useState<any[]>([])
  const [selected, setSelected] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)

  const load = () => api.getAgents().then(setAgents).catch(() => {})

  useEffect(() => {
    load()
    const iv = setInterval(load, 5000)
    return () => clearInterval(iv)
  }, [])

  async function approve(id: string, trust: string) {
    setLoading(true)
    await api.approveAgent(id, trust).catch(() => {})
    await load()
    setLoading(false)
    setSelected(null)
  }

  async function reject(id: string) {
    setLoading(true)
    await api.rejectAgent(id).catch(() => {})
    await load()
    setLoading(false)
    setSelected(null)
  }

  async function changeTrust(id: string, trust: string) {
    await api.setTrust(id, trust).catch(() => {})
    await load()
  }

  const pending = agents.filter(a => a.status === 'pending')
  const rest = agents.filter(a => a.status !== 'pending')

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">Agentes</h2>

      {/* Pendientes de aprobación */}
      {pending.length > 0 && (
        <div className="bg-yellow-950 border border-yellow-800 rounded-xl p-5">
          <h3 className="text-yellow-300 font-semibold mb-4">Esperando aprobación ({pending.length})</h3>
          <div className="space-y-3">
            {pending.map(agent => (
              <div key={agent.id} className="bg-gray-900 rounded-lg p-4 flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="text-white font-medium">{agent.name}</p>
                  <p className="text-gray-400 text-sm mt-0.5">{agent.description}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {(agent.capabilities || []).map((cap: string) => (
                      <span key={cap} className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded">{cap}</span>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => setSelected(agent)} className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-3 py-1.5 rounded-lg">
                    Ver tarjeta
                  </button>
                  <button onClick={() => approve(agent.id, 'viewer')} disabled={loading} className="bg-green-700 hover:bg-green-600 text-white text-sm px-3 py-1.5 rounded-lg">
                    Aprobar
                  </button>
                  <button onClick={() => reject(agent.id)} disabled={loading} className="bg-red-800 hover:bg-red-700 text-white text-sm px-3 py-1.5 rounded-lg">
                    Rechazar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lista de agentes */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
              <tr className="border-b border-gray-800 text-gray-400">
              <th className="text-left px-5 py-3">Agente</th>
              <th className="text-left px-5 py-3">Capacidades</th>
              <th className="text-left px-5 py-3">Estado</th>
              <th className="text-left px-5 py-3">Confianza</th>
              <th className="text-left px-5 py-3">Online</th>
              <th className="text-left px-5 py-3">Visto</th>
            </tr>
          </thead>
          <tbody>
            {rest.map(agent => (
              <tr
                key={agent.id}
                onClick={() => setSelected(agent)}
                className="border-b border-gray-800 hover:bg-gray-800 cursor-pointer transition-colors"
              >
                <td className="px-5 py-3">
                  <p className="text-white font-medium">{agent.name}</p>
                  <p className="text-gray-500 text-xs">{agent.version}</p>
                </td>
                <td className="px-5 py-3">
                  <div className="flex flex-wrap gap-1">
                    {(agent.capabilities || []).slice(0, 3).map((cap: string) => (
                      <span key={cap} className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded">{cap}</span>
                    ))}
                    {(agent.capabilities || []).length > 3 && (
                      <span className="text-xs text-gray-500">+{agent.capabilities.length - 3}</span>
                    )}
                  </div>
                </td>
                <td className="px-5 py-3">
                  <span className={clsx('inline-flex items-center gap-1.5 text-xs text-white px-2 py-0.5 rounded-full', STATUS_COLOR[agent.status])}>
                    <span className="w-1.5 h-1.5 rounded-full bg-white/60 inline-block" />
                    {STATUS_LABEL[agent.status] || agent.status}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <select
                    value={agent.trust_level}
                    onClick={e => e.stopPropagation()}
                    onChange={e => changeTrust(agent.id, e.target.value)}
                    className="bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded px-2 py-1"
                  >
                    {TRUST_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </td>
                <td className="px-5 py-3">
                  <span className={clsx('w-2.5 h-2.5 rounded-full inline-block', agent.is_online ? 'bg-green-400' : 'bg-gray-600')} />
                </td>
                <td className="px-5 py-3 text-gray-500 text-xs">
                  {agent.last_seen ? new Date(agent.last_seen).toLocaleString() : '—'}
                </td>
              </tr>
            ))}
            {rest.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-500">Sin agentes registrados</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal tarjeta de agente */}
      {selected && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-md w-full space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-white text-xl font-bold">{selected.name}</h3>
                <p className="text-gray-400 text-sm">v{selected.version} · {selected.is_external ? 'Externo' : 'Interno'}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={clsx('w-2.5 h-2.5 rounded-full', selected.is_online ? 'bg-green-400' : 'bg-gray-600')} />
                <span className="text-xs text-gray-400">{selected.is_online ? 'Online' : 'Offline'}</span>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-white text-xl">✕</button>
            </div>
            <p className="text-gray-300 text-sm">{selected.description || 'Sin descripción'}</p>
            <div>
              <p className="text-gray-500 text-xs mb-2">Capacidades</p>
              <div className="flex flex-wrap gap-1">
                {(selected.capabilities || []).map((cap: string) => (
                  <span key={cap} className="text-sm bg-blue-900 text-blue-200 px-2 py-0.5 rounded">{cap}</span>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-gray-800 rounded-lg p-3">
                <p className="text-gray-500 text-xs">Endpoint</p>
                <p className="text-gray-300 truncate">{selected.endpoint || '—'}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-3">
                <p className="text-gray-500 text-xs">Conexión</p>
                <p className="text-gray-300">{selected.connection_type}</p>
              </div>
            </div>
            {selected.status === 'pending' && (
              <div className="flex gap-3 pt-2">
                <button onClick={() => approve(selected.id, 'viewer')} className="flex-1 bg-green-700 hover:bg-green-600 text-white py-2 rounded-lg">
                  Aprobar
                </button>
                <button onClick={() => reject(selected.id)} className="flex-1 bg-red-800 hover:bg-red-700 text-white py-2 rounded-lg">
                  Rechazar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { gatewaySocket } from '@/lib/ws'
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
const CONNECTION_TYPES = ['websocket', 'webhook', 'polling']

export default function AgentsPage() {
  const [agents, setAgents] = useState<any[]>([])
  const [selected, setSelected] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)
  const [showRegister, setShowRegister] = useState(false)
  const [registerForm, setRegisterForm] = useState({
    name: '',
    description: '',
    capabilities: '',
    endpoint: '',
    connection_type: 'websocket',
  })
  const [registerResult, setRegisterResult] = useState<any>(null)
  const [filter, setFilter] = useState('all')

  const load = () => api.getAgents().then(setAgents).catch(() => {})

  useEffect(() => {
    load()
    const token = localStorage.getItem('admin_token')
    if (token) gatewaySocket.connect(token)

    const handleAgentEvent = (msg: any) => {
      if (['agent_online', 'agent_offline', 'agent_pending'].includes(msg.type)) load()
    }

    gatewaySocket.on('agent_online', handleAgentEvent)
    gatewaySocket.on('agent_offline', handleAgentEvent)
    gatewaySocket.on('agent_pending', handleAgentEvent)

    return () => {
      gatewaySocket.off('agent_online', handleAgentEvent)
      gatewaySocket.off('agent_offline', handleAgentEvent)
      gatewaySocket.off('agent_pending', handleAgentEvent)
    }
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

  async function deleteAgent(id: string) {
    if (!confirm('¿Eliminar este agente?')) return
    setLoading(true)
    await api.deleteAgent(id).catch(() => {})
    await load()
    setLoading(false)
    setSelected(null)
  }

  async function changeTrust(id: string, trust: string) {
    await api.setTrust(id, trust).catch(() => {})
    await load()
  }

  async function submitRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const result = await api.registerAgent({
        name: registerForm.name,
        description: registerForm.description,
        capabilities: registerForm.capabilities.split(',').map(s => s.trim()).filter(Boolean),
        endpoint: registerForm.endpoint,
        connection_type: registerForm.connection_type,
      })
      setRegisterResult(result)
      await load()
    } catch (e: any) {
      setRegisterResult({ error: e.message })
    }
    setLoading(false)
  }

  const pending = agents.filter(a => a.status === 'pending')
  const filtered = agents.filter(a => filter === 'all' || a.status === filter)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Agentes</h2>
        <button
          onClick={() => { setShowRegister(true); setRegisterResult(null) }}
          className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-2 rounded-lg"
        >
          + Registrar agente
        </button>
      </div>

      {/* Alertas pendientes */}
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
                <div className="flex gap-2 shrink-0 flex-wrap">
                  <button onClick={() => setSelected(agent)} className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-3 py-1.5 rounded-lg">Ver</button>
                  <button onClick={() => approve(agent.id, 'viewer')} disabled={loading} className="bg-green-700 hover:bg-green-600 text-white text-sm px-3 py-1.5 rounded-lg">Aprobar</button>
                  <button onClick={() => reject(agent.id)} disabled={loading} className="bg-red-800 hover:bg-red-700 text-white text-sm px-3 py-1.5 rounded-lg">Rechazar</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'idle', 'working', 'offline', 'rejected'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={clsx('text-xs px-3 py-1.5 rounded-full border transition-colors', filter === f ? 'bg-blue-600 border-blue-500 text-white' : 'border-gray-700 text-gray-400 hover:text-white')}
          >
            {f === 'all' ? 'Todos' : STATUS_LABEL[f] || f}
          </button>
        ))}
        <span className="text-gray-500 text-xs self-center ml-2">{filtered.filter(a => a.status !== 'pending').length} agentes</span>
      </div>

      {/* Lista de agentes */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400">
              <th className="text-left px-5 py-3">Agente</th>
              <th className="text-left px-5 py-3">Capacidades</th>
              <th className="text-left px-5 py-3">Estado</th>
              <th className="text-left px-5 py-3">Confianza</th>
              <th className="text-left px-5 py-3">Última conexión</th>
              <th className="text-left px-5 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.filter(a => a.status !== 'pending').map(agent => (
              <tr key={agent.id} className="border-b border-gray-800 hover:bg-gray-800 transition-colors">
                <td className="px-5 py-3 cursor-pointer" onClick={() => setSelected(agent)}>
                  <p className="text-white font-medium">{agent.name}</p>
                  <p className="text-gray-500 text-xs">{agent.description || agent.version}</p>
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
                    onChange={e => changeTrust(agent.id, e.target.value)}
                    className="bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded px-2 py-1"
                  >
                    {TRUST_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </td>
                <td className="px-5 py-3 text-gray-500 text-xs">
                  {agent.last_seen ? new Date(agent.last_seen).toLocaleString() : '—'}
                </td>
                <td className="px-5 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => setSelected(agent)} className="text-xs text-blue-400 hover:text-blue-300">Ver</button>
                    <button onClick={() => deleteAgent(agent.id)} className="text-xs text-red-400 hover:text-red-300">Eliminar</button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.filter(a => a.status !== 'pending').length === 0 && (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-500">Sin agentes registrados</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal detalle agente */}
      {selected && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-lg w-full space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-white text-xl font-bold">{selected.name}</h3>
                <p className="text-gray-400 text-sm">v{selected.version} · {selected.is_external ? 'Externo' : 'Interno'}</p>
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
                <p className="text-gray-500 text-xs">ID</p>
                <p className="text-gray-300 text-xs font-mono truncate">{selected.id}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-3">
                <p className="text-gray-500 text-xs">Conexión</p>
                <p className="text-gray-300">{selected.connection_type}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-3">
                <p className="text-gray-500 text-xs">Endpoint</p>
                <p className="text-gray-300 truncate text-xs">{selected.endpoint || '—'}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-3">
                <p className="text-gray-500 text-xs">Estado</p>
                <span className={clsx('inline-flex items-center gap-1 text-xs text-white px-2 py-0.5 rounded-full mt-1', STATUS_COLOR[selected.status])}>
                  {STATUS_LABEL[selected.status] || selected.status}
                </span>
              </div>
            </div>
            {selected.status === 'pending' && (
              <div>
                <p className="text-gray-500 text-xs mb-2">Aprobar con nivel de confianza:</p>
                <div className="flex gap-2 flex-wrap">
                  {TRUST_OPTIONS.map(t => (
                    <button key={t} onClick={() => approve(selected.id, t)} disabled={loading}
                      className="flex-1 bg-green-800 hover:bg-green-700 text-white text-sm py-2 rounded-lg capitalize">{t}</button>
                  ))}
                  <button onClick={() => reject(selected.id)} disabled={loading}
                    className="flex-1 bg-red-800 hover:bg-red-700 text-white text-sm py-2 rounded-lg">Rechazar</button>
                </div>
              </div>
            )}
            <div className="flex gap-2 pt-2 border-t border-gray-800">
              <button onClick={() => deleteAgent(selected.id)} disabled={loading}
                className="flex-1 bg-red-900 hover:bg-red-800 text-red-300 text-sm py-2 rounded-lg">
                Eliminar agente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal registrar agente */}
      {showRegister && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-lg w-full space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-white text-xl font-bold">Registrar agente</h3>
              <button onClick={() => { setShowRegister(false); setRegisterResult(null) }} className="text-gray-500 hover:text-white text-xl">✕</button>
            </div>

            {!registerResult ? (
              <form onSubmit={submitRegister} className="space-y-4">
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Nombre *</label>
                  <input required value={registerForm.name} onChange={e => setRegisterForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm" placeholder="Mi Agente" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Descripción</label>
                  <input value={registerForm.description} onChange={e => setRegisterForm(f => ({ ...f, description: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm" placeholder="¿Qué hace este agente?" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Capacidades (separadas por coma)</label>
                  <input value={registerForm.capabilities} onChange={e => setRegisterForm(f => ({ ...f, capabilities: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm" placeholder="análisis, escritura, código" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Endpoint (opcional)</label>
                  <input value={registerForm.endpoint} onChange={e => setRegisterForm(f => ({ ...f, endpoint: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm" placeholder="https://..." />
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Tipo de conexión</label>
                  <select value={registerForm.connection_type} onChange={e => setRegisterForm(f => ({ ...f, connection_type: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm">
                    {CONNECTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <button type="submit" disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">
                  {loading ? 'Registrando...' : 'Registrar agente'}
                </button>
              </form>
            ) : registerResult.error ? (
              <div className="space-y-4">
                <div className="bg-red-950 border border-red-800 rounded-lg p-4">
                  <p className="text-red-300 text-sm">{registerResult.error}</p>
                </div>
                <button onClick={() => setRegisterResult(null)} className="w-full bg-gray-800 text-white py-2 rounded-lg text-sm">Intentar de nuevo</button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-green-950 border border-green-800 rounded-lg p-4 space-y-2">
                  <p className="text-green-300 font-medium">✅ Agente registrado</p>
                  <p className="text-gray-400 text-sm">{registerResult.message}</p>
                  <div className="bg-gray-900 rounded p-2 mt-2">
                    <p className="text-gray-500 text-xs">ID del agente:</p>
                    <p className="text-white font-mono text-xs break-all">{registerResult.agent_id}</p>
                  </div>
                </div>
                <p className="text-gray-400 text-sm text-center">Ahora apruébalo desde la lista de agentes pendientes.</p>
                <button onClick={() => { setShowRegister(false); setRegisterResult(null) }} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg text-sm">
                  Ir a agentes
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { gatewaySocket } from '@/lib/ws'

export default function DashboardPage() {
  const [agents, setAgents] = useState<any[]>([])
  const [tasks, setTasks] = useState<any[]>([])
  const [notifications, setNotifications] = useState<any[]>([])

  useEffect(() => {
    api.getAgents().then(setAgents).catch(() => {})
    api.getTasks().then(setTasks).catch(() => {})

    const token = localStorage.getItem('admin_token')
    if (token) gatewaySocket.connect(token)

    const handler = (msg: any) => {
      setNotifications(n => [{ ...msg, ts: new Date().toLocaleTimeString() }, ...n].slice(0, 20))
      if (msg.type === 'agent_online' || msg.type === 'agent_offline' || msg.type === 'agent_pending') {
        api.getAgents().then(setAgents).catch(() => {})
      }
    }
    gatewaySocket.on('*', handler)
    return () => gatewaySocket.off('*', handler)
  }, [])

  const online = agents.filter(a => a.status === 'idle' || a.status === 'working').length
  const pending = agents.filter(a => a.status === 'pending').length
  const activeTasks = tasks.filter(t => t.status === 'in_progress' || t.status === 'assigned').length

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">Inicio</h2>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Agentes online', value: online, color: 'text-green-400' },
          { label: 'Pendientes de aprobar', value: pending, color: 'text-yellow-400' },
          { label: 'Tareas activas', value: activeTasks, color: 'text-blue-400' },
        ].map(stat => (
          <div key={stat.label} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className="text-gray-400 text-sm">{stat.label}</p>
            <p className={`text-4xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Actividad en tiempo real */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-white font-semibold mb-4">Actividad en tiempo real</h3>
        {notifications.length === 0 ? (
          <p className="text-gray-500 text-sm">Sin actividad reciente. Esperando eventos...</p>
        ) : (
          <ul className="space-y-2">
            {notifications.map((n, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <span className="text-gray-500 text-xs mt-0.5 w-16 shrink-0">{n.ts}</span>
                <span className="text-gray-300">{formatNotification(n)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function formatNotification(msg: any): string {
  switch (msg.type) {
    case 'agent_online': return `Agente conectado: ${msg.name || msg.agent_id}`
    case 'agent_offline': return `Agente desconectado: ${msg.name || msg.agent_id}`
    case 'agent_pending': return `Nuevo agente esperando aprobación: ${msg.agent_name}`
    case 'task_result': return `Resultado recibido de ${msg.agent_name || msg.agent_id}`
    case 'knowledge_proposal': return `${msg.agent_name} propone añadir conocimiento`
    default: return JSON.stringify(msg)
  }
}

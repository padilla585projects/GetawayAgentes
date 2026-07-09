'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { gatewaySocket } from '@/lib/ws'

export default function DashboardPage() {
  const [agents, setAgents] = useState<any[]>([])
  const [tasks, setTasks] = useState<any[]>([])
  const [notifications, setNotifications] = useState<any[]>([])
  const [knowledgeCount, setKnowledgeCount] = useState(0)

  useEffect(() => {
    api.getAgents().then(setAgents).catch(() => {})
    api.getTasks().then(setTasks).catch(() => {})
    api.getKnowledge('public').then(k => setKnowledgeCount(k.length)).catch(() => {})

    const token = localStorage.getItem('admin_token')
    if (token) gatewaySocket.connect(token)

    const handler = (msg: any) => {
      setNotifications(n => [{ ...msg, ts: new Date().toLocaleTimeString() }, ...n].slice(0, 30))
      if (['agent_online', 'agent_offline', 'agent_pending'].includes(msg.type)) {
        api.getAgents().then(setAgents).catch(() => {})
      }
      if (['task_result', 'subtask_result', 'orchestration_complete', 'task_status_update'].includes(msg.type)) {
        api.getTasks().then(setTasks).catch(() => {})
      }
      if (msg.type === 'knowledge_published') {
        api.getKnowledge('public').then(k => setKnowledgeCount(k.length)).catch(() => {})
      }
    }
    gatewaySocket.on('*', handler)
    return () => gatewaySocket.off('*', handler)
  }, [])

  const online = agents.filter(a => a.is_online || a.status === 'idle' || a.status === 'working').length
  const pending = agents.filter(a => a.status === 'pending').length
  const activeTasks = tasks.filter(t => ['in_progress', 'assigned', 'collaborating'].includes(t.status)).length
  const completedTasks = tasks.filter(t => t.status === 'completed').length
  const collaborativeTasks = tasks.filter(t => t.mode === 'collaborative').length

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">Inicio</h2>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Agentes online', value: online, color: 'text-green-400', icon: '◉' },
          { label: 'Pendientes', value: pending, color: 'text-yellow-400', icon: '◎' },
          { label: 'Tareas activas', value: activeTasks, color: 'text-blue-400', icon: '◈' },
          { label: 'Colaborativas', value: collaborativeTasks, color: 'text-purple-400', icon: '◇' },
          { label: 'Completadas', value: completedTasks, color: 'text-emerald-400', icon: '✓' },
          { label: 'Conocimiento', value: knowledgeCount, color: 'text-orange-400', icon: '◆' },
        ].map(stat => (
          <div key={stat.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <p className="text-gray-400 text-sm">{stat.label}</p>
              <span className="text-lg">{stat.icon}</span>
            </div>
            <p className={`text-3xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Recent collaborative tasks */}
      {collaborativeTasks > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-3">Tareas Colaborativas Recientes</h3>
          <div className="space-y-2">
            {tasks.filter(t => t.mode === 'collaborative').slice(0, 5).map(task => (
              <div key={task.id} className="flex items-center justify-between bg-gray-800/50 rounded-lg px-4 py-2">
                <div>
                  <p className="text-white text-sm font-medium">{task.title}</p>
                  <p className="text-gray-500 text-xs">{task.assigned_agents?.length || 0} agentes asignados</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${statusColor(task.status)}`}>
                  {task.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Real-time activity */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-white font-semibold mb-4">Actividad en tiempo real</h3>
        {notifications.length === 0 ? (
          <p className="text-gray-500 text-sm">Sin actividad reciente. Esperando eventos...</p>
        ) : (
          <ul className="space-y-2 max-h-80 overflow-y-auto">
            {notifications.map((n, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <span className="text-gray-500 text-xs mt-0.5 w-16 shrink-0">{n.ts}</span>
                <span className={`text-xs mt-0.5 w-2 h-2 rounded-full shrink-0 mt-1.5 ${notifColor(n.type)}`} />
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
    case 'task_result': return `Resultado de ${msg.agent_name || msg.agent_id} para tarea ${msg.task_id?.slice(0, 8)}`
    case 'subtask_result': return `${msg.agent_name} completó su parte en tarea ${msg.task_id?.slice(0, 8)}`
    case 'orchestration_complete': return `Tarea colaborativa completada: ${msg.task_id?.slice(0, 8)}`
    case 'task_status_update': return `Tarea ${msg.task_id?.slice(0, 8)} → ${msg.status}`
    case 'knowledge_proposal': return `${msg.agent_name} propone conocimiento: ${msg.data?.title || 'sin título'}`
    case 'knowledge_published': return `${msg.agent_name} publicó conocimiento: ${msg.title}`
    case 'agent_message': return `${msg.from_name} → ${msg.to === 'all' ? 'todos' : 'agente'}: ${(msg.content || '').slice(0, 60)}`
    case 'collaborate_accept': return `${msg.agent_name} aceptó colaborar en ${msg.task_id?.slice(0, 8)}`
    case 'collaborate_reject': return `${msg.agent_name} rechazó colaborar en ${msg.task_id?.slice(0, 8)}`
    case 'knowledge_response': return `${msg.agent_name} respondió a consulta de conocimiento`
    default: return `${msg.type}: ${JSON.stringify(msg).slice(0, 80)}`
  }
}

function statusColor(status: string): string {
  switch (status) {
    case 'completed': return 'bg-green-900/50 text-green-300 border border-green-800'
    case 'collaborating': return 'bg-purple-900/50 text-purple-300 border border-purple-800'
    case 'in_progress': return 'bg-blue-900/50 text-blue-300 border border-blue-800'
    case 'assigned': return 'bg-yellow-900/50 text-yellow-300 border border-yellow-800'
    case 'failed': return 'bg-red-900/50 text-red-300 border border-red-800'
    default: return 'bg-gray-800 text-gray-400 border border-gray-700'
  }
}

function notifColor(type: string): string {
  switch (type) {
    case 'agent_online': return 'bg-green-400'
    case 'agent_offline': return 'bg-red-400'
    case 'agent_pending': return 'bg-yellow-400'
    case 'task_result': case 'subtask_result': return 'bg-blue-400'
    case 'orchestration_complete': return 'bg-emerald-400'
    case 'knowledge_proposal': case 'knowledge_published': return 'bg-orange-400'
    case 'agent_message': return 'bg-purple-400'
    default: return 'bg-gray-500'
  }
}

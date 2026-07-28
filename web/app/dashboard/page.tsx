'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { gatewaySocket } from '@/lib/ws'
import { Bot, ClipboardList, BookOpen, Activity, Users, Gauge, CheckCircle, Sparkles, Wifi, WifiOff } from 'lucide-react'

const AGENT_MODELS: Record<string, string> = {
  'builtin-finance': 'DeepSeek Chat',
  'builtin-construction': 'DeepSeek Chat',
  'builtin-auto-electronics': 'GPT-4o Mini',
  'builtin-legal': 'GPT-4o Mini',
  'builtin-project-coordinator': 'Claude Haiku 4.5',
}

const MODEL_COLORS: Record<string, string> = {
  'DeepSeek Chat': 'bg-green-900/50 text-green-300 border-green-700',
  'GPT-4o Mini': 'bg-blue-900/50 text-blue-300 border-blue-700',
  'Claude Haiku 4.5': 'bg-purple-900/50 text-purple-300 border-purple-700',
}

export default function DashboardPage() {
  const [agents, setAgents] = useState<any[]>([])
  const [tasks, setTasks] = useState<any[]>([])
  const [notifications, setNotifications] = useState<any[]>([])
  const [knowledgeCount, setKnowledgeCount] = useState(0)
  const [activity, setActivity] = useState<any[]>([])

  useEffect(() => {
    api.getAgents().then(setAgents).catch(() => {})
    api.getTasks().then(setTasks).catch(() => {})
    api.getKnowledge('public').then(k => setKnowledgeCount(k.length)).catch(() => {})
    api.getChatActivity().then(setActivity).catch(() => {})

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
      if (msg.type === 'chat_message') {
        setActivity(prev => [msg, ...prev].slice(0, 20))
      }
    }
    gatewaySocket.on('*', handler)
    return () => gatewaySocket.off('*', handler)
  }, [])

  const online = agents.filter((a: any) => a.is_online || a.status === 'idle' || a.status === 'working').length
  const pending = agents.filter((a: any) => a.status === 'pending').length
  const activeTasks = tasks.filter((t: any) => ['in_progress', 'assigned', 'collaborating'].includes(t.status)).length
  const completedTasks = tasks.filter((t: any) => t.status === 'completed').length
  const totalTasks = tasks.length

  const builtinAgents = agents.filter((a: any) => AGENT_MODELS[a.id])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Inicio</h2>
        <div className="flex items-center gap-2 text-sm">
          <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
          <span className="text-gray-400">{online} agentes online</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Agentes online', value: online, color: 'text-green-400', icon: Wifi },
          { label: 'Pendientes', value: pending, color: 'text-yellow-400', icon: Users },
          { label: 'Tareas activas', value: activeTasks, color: 'text-blue-400', icon: Activity },
          { label: 'Completadas', value: completedTasks, color: 'text-emerald-400', icon: CheckCircle },
        ].map(stat => {
          const Icon = stat.icon
          return (
            <div key={stat.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors">
              <div className="flex items-center justify-between mb-1">
                <p className="text-gray-400 text-sm">{stat.label}</p>
                <Icon size={18} className="text-gray-600" />
              </div>
              <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
            </div>
          )
        })}
      </div>

      {/* Agent cards with model info */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <Bot size={16} className="text-blue-400" />
          Agentes especializados
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {builtinAgents.map((agent: any) => {
            const model = AGENT_MODELS[agent.id] || '—'
            const modelColor = MODEL_COLORS[model] || 'bg-gray-800 text-gray-400 border-gray-700'
            return (
              <div key={agent.id} className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 hover:border-gray-600/50 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-white font-medium text-sm">{agent.name}</p>
                    <p className="text-gray-500 text-xs mt-0.5">{agent.description?.slice(0, 100)}</p>
                  </div>
                  <span className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${agent.is_online ? 'bg-green-400' : 'bg-gray-600'}`} />
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Sparkles size={12} className="text-gray-500" />
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${modelColor}`}>
                    {model}
                  </span>
                  <span className="text-[10px] text-gray-600">{agent.status}</span>
                </div>
              </div>
            )
          })}
        </div>
        {builtinAgents.length === 0 && (
          <p className="text-gray-500 text-sm text-center py-4">Cargando agentes...</p>
        )}
      </div>

      {/* Recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {totalTasks > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
              <ClipboardList size={16} className="text-blue-400" />
              Tareas recientes
            </h3>
            <div className="space-y-1.5">
              {tasks.slice(0, 8).map((task: any) => (
                <div key={task.id} className="flex items-center justify-between bg-gray-800/30 rounded-lg px-3.5 py-2">
                  <p className="text-white text-xs font-medium truncate flex-1">{task.title}</p>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ml-2 shrink-0 ${statusColor(task.status)}`}>
                    {task.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {knowledgeCount > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
              <BookOpen size={16} className="text-orange-400" />
              Conocimiento
            </h3>
            <p className="text-gray-400 text-sm"><span className="text-orange-400 font-bold text-2xl">{knowledgeCount}</span> entradas en la base de conocimiento</p>
          </div>
        )}
      </div>

      {/* Live activity feed */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <Activity size={16} className="text-green-400" />
          Actividad en tiempo real
        </h3>
        {notifications.length === 0 ? (
          <div className="text-center py-8">
            <Activity size={32} className="text-gray-700 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">Sin actividad reciente.</p>
            <p className="text-gray-600 text-xs mt-1">Esperando eventos de los agentes...</p>
          </div>
        ) : (
          <ul className="space-y-1 max-h-80 overflow-y-auto">
            {notifications.map((n, i) => (
              <li key={i} className="flex items-center gap-3 text-sm px-2 py-1.5 rounded-lg hover:bg-gray-800/30">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${notifColor(n.type)}`} />
                <span className="text-gray-500 text-xs w-14 shrink-0">{n.ts}</span>
                <span className="text-gray-300 text-xs">{formatNotification(n)}</span>
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
    case 'agent_pending': return `Nuevo agente: ${msg.agent_name}`
    case 'task_result': return `${msg.agent_name || msg.agent_id} completó tarea ${msg.task_id?.slice(0, 8)}`
    case 'subtask_result': return `${msg.agent_name} completó subtarea en ${msg.task_id?.slice(0, 8)}`
    case 'orchestration_complete': return `Tarea colaborativa completada: ${msg.task_id?.slice(0, 8)}`
    case 'task_status_update': return `Tarea ${msg.task_id?.slice(0, 8)} → ${msg.status}`
    case 'knowledge_proposal': return `${msg.agent_name} propone conocimiento: ${msg.data?.title || 'sin título'}`
    case 'knowledge_published': return `${msg.agent_name} publicó conocimiento: ${msg.title}`
    case 'agent_message': return `${msg.from_name}: ${(msg.content || '').slice(0, 80)}`
    case 'collaborate_accept': return `${msg.agent_name} aceptó colaborar`
    case 'collaborate_reject': return `${msg.agent_name} rechazó colaborar`
    case 'knowledge_response': return `${msg.agent_name} respondió consulta`
    default: return `${msg.type}`
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

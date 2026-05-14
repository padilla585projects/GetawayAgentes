'use client'
import { useEffect, useState, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'
import { api } from '@/lib/api'
import { gatewaySocket } from '@/lib/ws'

interface Agent { id: string; name: string; status: string; trust_level: string; connected_at?: string }
interface Task { id: string; title: string; status: string; mode: string; created_at: string; completed_at?: string }
interface ActivityEntry { type: string; label: string; ts: string }

const STATUS_COLORS: Record<string, string> = {
  idle: '#22c55e',
  working: '#3b82f6',
  offline: '#6b7280',
  pending: '#f59e0b',
}

const TASK_STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  assigned: '#3b82f6',
  in_progress: '#8b5cf6',
  completed: '#22c55e',
  failed: '#ef4444',
}

function StatCard({ label, value, sub, color }: { label: string; value: number | string; sub?: string; color: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <p className="text-gray-400 text-sm">{label}</p>
      <p className={`text-4xl font-bold mt-1 ${color}`}>{value}</p>
      {sub && <p className="text-gray-500 text-xs mt-1">{sub}</p>}
    </div>
  )
}

function buildHourlyData(tasks: Task[]) {
  const now = Date.now()
  const hours: { h: string; creadas: number; completadas: number }[] = []
  for (let i = 11; i >= 0; i--) {
    const start = now - i * 3600_000
    const end = start + 3600_000
    const label = new Date(start).getHours() + 'h'
    hours.push({
      h: label,
      creadas: tasks.filter(t => {
        const ts = new Date(t.created_at).getTime()
        return ts >= start && ts < end
      }).length,
      completadas: tasks.filter(t => {
        if (!t.completed_at) return false
        const ts = new Date(t.completed_at).getTime()
        return ts >= start && ts < end
      }).length,
    })
  }
  return hours
}

function buildAgentPieData(agents: Agent[]) {
  const counts: Record<string, number> = {}
  for (const a of agents) {
    counts[a.status] = (counts[a.status] || 0) + 1
  }
  return Object.entries(counts).map(([name, value]) => ({ name, value }))
}

function buildTaskPieData(tasks: Task[]) {
  const counts: Record<string, number> = {}
  for (const t of tasks) {
    counts[t.status] = (counts[t.status] || 0) + 1
  }
  return Object.entries(counts).map(([name, value]) => ({ name, value }))
}

function formatEvent(msg: any): string {
  switch (msg.type) {
    case 'agent_online': return `Agente conectado: ${msg.name || msg.agent_id}`
    case 'agent_offline': return `Agente desconectado: ${msg.name || msg.agent_id}`
    case 'agent_pending': return `Nuevo agente esperando aprobación: ${msg.agent_name}`
    case 'task_result': return `Resultado recibido de ${msg.agent_name || msg.agent_id}`
    case 'knowledge_proposal': return `${msg.agent_name} propone añadir conocimiento`
    default: return `Evento: ${msg.type}`
  }
}

export default function DashboardPage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [activity, setActivity] = useState<ActivityEntry[]>([])

  const reload = useCallback(() => {
    api.getAgents().then(setAgents).catch(() => {})
    api.getTasks().then(setTasks).catch(() => {})
  }, [])

  useEffect(() => {
    reload()
    const token = localStorage.getItem('admin_token')
    if (token) gatewaySocket.connect(token)

    const handler = (msg: any) => {
      setActivity(prev => [{ type: msg.type, label: formatEvent(msg), ts: new Date().toLocaleTimeString() }, ...prev].slice(0, 30))
      if (['agent_online', 'agent_offline', 'agent_pending', 'task_result'].includes(msg.type)) reload()
    }
    gatewaySocket.on('*', handler)
    return () => gatewaySocket.off('*', handler)
  }, [reload])

  const online = agents.filter(a => a.status === 'idle' || a.status === 'working').length
  const pending = agents.filter(a => a.status === 'pending').length
  const activeTasks = tasks.filter(t => t.status === 'in_progress' || t.status === 'assigned').length
  const completedTasks = tasks.filter(t => t.status === 'completed').length
  const failedTasks = tasks.filter(t => t.status === 'failed').length
  const total = completedTasks + failedTasks
  const successRate = total > 0 ? Math.round((completedTasks / total) * 100) : 0

  const hourly = buildHourlyData(tasks)
  const agentPie = buildAgentPieData(agents)
  const taskPie = buildTaskPieData(tasks)

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">Dashboard</h2>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard label="Agentes online" value={online} color="text-green-400" />
        <StatCard label="Pendientes aprobación" value={pending} color="text-yellow-400" />
        <StatCard label="Tareas activas" value={activeTasks} color="text-blue-400" />
        <StatCard label="Completadas" value={completedTasks} color="text-purple-400" />
        <StatCard label="Tasa de éxito" value={`${successRate}%`} sub={`${completedTasks} de ${total}`} color={successRate >= 80 ? 'text-green-400' : 'text-red-400'} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Actividad por hora */}
        <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4">Actividad últimas 12 horas</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={hourly} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis dataKey="h" tick={{ fill: '#6b7280', fontSize: 11 }} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }} />
              <Bar dataKey="creadas" name="Creadas" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="completadas" name="Completadas" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Agentes por estado */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4">Estado de agentes</h3>
          {agentPie.length === 0 ? (
            <p className="text-gray-500 text-sm mt-10 text-center">Sin agentes registrados</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={agentPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => `${name}: ${value}`}>
                  {agentPie.map((entry) => (
                    <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || '#6b7280'} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Second charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Tareas por estado */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4">Tareas por estado</h3>
          {taskPie.length === 0 ? (
            <p className="text-gray-500 text-sm mt-10 text-center">Sin tareas registradas</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={taskPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70}>
                  {taskPie.map((entry) => (
                    <Cell key={entry.name} fill={TASK_STATUS_COLORS[entry.name] || '#6b7280'} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }} />
                <Legend formatter={(v) => <span style={{ color: '#9ca3af', fontSize: 12 }}>{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Actividad en tiempo real */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4">Actividad en tiempo real</h3>
          <div className="overflow-y-auto max-h-48 space-y-2">
            {activity.length === 0 ? (
              <p className="text-gray-500 text-sm">Esperando eventos WebSocket...</p>
            ) : activity.map((e, i) => (
              <div key={i} className="flex items-start gap-3 text-sm border-b border-gray-800 pb-2">
                <span className="text-gray-500 text-xs mt-0.5 w-14 shrink-0">{e.ts}</span>
                <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                  e.type.includes('online') ? 'bg-green-400' :
                  e.type.includes('offline') ? 'bg-gray-500' :
                  e.type.includes('pending') ? 'bg-yellow-400' :
                  e.type.includes('result') ? 'bg-blue-400' : 'bg-purple-400'
                }`} />
                <span className="text-gray-300">{e.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabla resumen agentes */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-white font-semibold mb-4">Agentes registrados ({agents.length})</h3>
        {agents.length === 0 ? (
          <p className="text-gray-500 text-sm">Sin agentes. Ejecuta agent-example.js para registrar uno.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 border-b border-gray-800">
                  <th className="text-left pb-2 font-normal">Nombre</th>
                  <th className="text-left pb-2 font-normal">Estado</th>
                  <th className="text-left pb-2 font-normal">Confianza</th>
                </tr>
              </thead>
              <tbody>
                {agents.slice(0, 8).map(a => (
                  <tr key={a.id} className="border-b border-gray-800/50">
                    <td className="py-2 text-gray-200">{a.name}</td>
                    <td className="py-2">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ background: STATUS_COLORS[a.status] || '#6b7280' }} />
                        <span className="text-gray-400">{a.status}</span>
                      </span>
                    </td>
                    <td className="py-2 text-gray-400">{a.trust_level || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

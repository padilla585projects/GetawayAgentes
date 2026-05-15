'use client'
import { useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api'
import { gatewaySocket } from '@/lib/ws'
import clsx from 'clsx'

interface LogEntry {
  id: string
  type: string
  level: 'info' | 'success' | 'warning' | 'error'
  message: string
  detail?: string
  ts: number
}

const LEVEL_COLOR: Record<string, string> = {
  info: 'text-blue-400',
  success: 'text-green-400',
  warning: 'text-yellow-400',
  error: 'text-red-400',
}

const LEVEL_BG: Record<string, string> = {
  info: 'bg-blue-500/10',
  success: 'bg-green-500/10',
  warning: 'bg-yellow-500/10',
  error: 'bg-red-500/10',
}

const TYPE_ICON: Record<string, string> = {
  agent_online: '🟢',
  agent_offline: '🔴',
  agent_pending: '⏳',
  task_result: '✅',
  task_created: '📋',
  task_failed: '❌',
  knowledge_add: '📚',
  agent_message: '💬',
  admin_login: '🔐',
  error: '⚠️',
  system: '⚙️',
}

function msgToLog(msg: any): LogEntry | null {
  const now = Date.now()
  const id = `${now}-${Math.random()}`

  switch (msg.type) {
    case 'agent_online':
      return { id, type: msg.type, level: 'success', message: `Agente conectado: ${msg.agent_name}`, detail: msg.agent_id, ts: now }
    case 'agent_offline':
      return { id, type: msg.type, level: 'warning', message: `Agente desconectado: ${msg.agent_name}`, detail: msg.agent_id, ts: now }
    case 'agent_pending':
      return { id, type: msg.type, level: 'info', message: `Nuevo agente solicita acceso: ${msg.agent_name}`, detail: msg.agent_id, ts: now }
    case 'task_result':
      return { id, type: msg.type, level: 'success', message: `Tarea completada por agente`, detail: `task_id: ${msg.task_id}`, ts: now }
    case 'knowledge_add':
      return { id, type: msg.type, level: 'info', message: `Conocimiento añadido: ${msg.title || ''}`, ts: now }
    case 'agent_message':
      return { id, type: msg.type, level: 'info', message: `Mensaje de ${msg.from_agent_name || 'agente'}`, detail: msg.content?.slice(0, 80), ts: now }
    default:
      return null
  }
}

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([
    { id: '0', type: 'system', level: 'info', message: 'Sistema iniciado. Escuchando eventos...', ts: Date.now() }
  ])
  const [filter, setFilter] = useState<string>('all')
  const [paused, setPaused] = useState(false)
  const pausedRef = useRef(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)

  useEffect(() => {
    pausedRef.current = paused
  }, [paused])

  useEffect(() => {
    const token = localStorage.getItem('admin_token')
    if (token) gatewaySocket.connect(token)

    const handle = (msg: any) => {
      if (pausedRef.current) return
      const entry = msgToLog(msg)
      if (entry) setLogs(prev => [entry, ...prev].slice(0, 500))
    }

    gatewaySocket.on('*', handle)

    // Cargar estado actual como logs iniciales
    Promise.all([api.getAgents(), api.getTasks()]).then(([agents, tasks]) => {
      const now = Date.now()
      const initialLogs: LogEntry[] = [
        ...agents.slice(0, 10).map((a: any, i: number) => ({
          id: `init-agent-${i}`,
          type: a.status === 'idle' ? 'agent_online' : a.status,
          level: a.status === 'idle' ? 'success' : a.status === 'pending' ? 'warning' : 'info' as any,
          message: `Agente: ${a.name}`,
          detail: `Estado: ${a.status} · Trust: ${a.trust_level}`,
          ts: now - i * 100,
        })),
        ...tasks.slice(0, 10).map((t: any, i: number) => ({
          id: `init-task-${i}`,
          type: t.status === 'completed' ? 'task_result' : 'task_created',
          level: t.status === 'completed' ? 'success' : t.status === 'failed' ? 'error' : 'info' as any,
          message: `Tarea: ${t.title}`,
          detail: `Estado: ${t.status} · Modo: ${t.mode}`,
          ts: now - i * 100 - 1000,
        })),
      ]
      setLogs(prev => [...prev, ...initialLogs])
    }).catch(() => {})

    return () => gatewaySocket.off('*', handle)
  }, [])

  useEffect(() => {
    if (autoScroll && !paused) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs, autoScroll, paused])

  const filtered = filter === 'all' ? logs : logs.filter(l => l.level === filter || l.type === filter)
  const counts = {
    success: logs.filter(l => l.level === 'success').length,
    warning: logs.filter(l => l.level === 'warning').length,
    error: logs.filter(l => l.level === 'error').length,
    info: logs.filter(l => l.level === 'info').length,
  }

  return (
    <div className="space-y-4 h-[calc(100vh-5rem)] flex flex-col">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Logs de Actividad</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setPaused(p => !p)}
            className={clsx('text-sm px-3 py-1.5 rounded-lg border transition-colors', paused ? 'bg-yellow-600 border-yellow-500 text-white' : 'border-gray-700 text-gray-400 hover:text-white')}
          >
            {paused ? '▶ Reanudar' : '⏸ Pausar'}
          </button>
          <button
            onClick={() => setLogs([{ id: Date.now().toString(), type: 'system', level: 'info', message: 'Logs limpiados', ts: Date.now() }])}
            className="text-sm px-3 py-1.5 rounded-lg border border-gray-700 text-gray-400 hover:text-white transition-colors"
          >
            🗑 Limpiar
          </button>
        </div>
      </div>

      {/* Filtros y contadores */}
      <div className="flex gap-2 flex-wrap items-center">
        <button onClick={() => setFilter('all')} className={clsx('text-xs px-3 py-1.5 rounded-full border', filter === 'all' ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-700 text-gray-500 hover:text-white')}>
          Todos ({logs.length})
        </button>
        {Object.entries(counts).map(([level, count]) => (
          <button key={level} onClick={() => setFilter(level)}
            className={clsx('text-xs px-3 py-1.5 rounded-full border transition-colors', filter === level ? `border-current ${LEVEL_COLOR[level]}` : 'border-gray-700 text-gray-500 hover:text-white')}>
            <span className={filter === level ? '' : LEVEL_COLOR[level]}>{level}</span> ({count})
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
          <input type="checkbox" checked={autoScroll} onChange={e => setAutoScroll(e.target.checked)} className="accent-blue-500" />
          Auto-scroll
        </label>
      </div>

      {/* Log stream */}
      <div className="flex-1 bg-gray-900 border border-gray-800 rounded-xl overflow-hidden flex flex-col">
        <div className="flex-1 overflow-auto p-4 space-y-1.5 font-mono text-xs">
          {filtered.length === 0 && (
            <p className="text-gray-600 text-center py-8">Sin eventos</p>
          )}
          {[...filtered].reverse().map(log => (
            <div key={log.id} className={clsx('flex gap-3 rounded-lg px-3 py-2', LEVEL_BG[log.level])}>
              <span className="shrink-0 text-gray-500">{new Date(log.ts).toLocaleTimeString()}</span>
              <span className="shrink-0">{TYPE_ICON[log.type] || '•'}</span>
              <span className={clsx('shrink-0 uppercase font-bold w-12', LEVEL_COLOR[log.level])}>{log.level}</span>
              <span className="text-gray-200">{log.message}</span>
              {log.detail && <span className="text-gray-500 truncate ml-auto">{log.detail}</span>}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Status bar */}
        <div className="border-t border-gray-800 px-4 py-2 flex items-center gap-4 text-xs text-gray-500">
          <span className={clsx('flex items-center gap-1', paused ? 'text-yellow-400' : 'text-green-400')}>
            <span className={clsx('w-1.5 h-1.5 rounded-full inline-block', paused ? 'bg-yellow-400' : 'bg-green-400 animate-pulse')} />
            {paused ? 'Pausado' : 'En vivo'}
          </span>
          <span>{logs.length} eventos capturados</span>
          <span>{filtered.length} mostrados</span>
        </div>
      </div>
    </div>
  )
}

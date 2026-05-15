'use client'
import { useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api'
import { gatewaySocket } from '@/lib/ws'
import clsx from 'clsx'

interface Message {
  id: string
  from: string
  fromName: string
  to: string
  toName: string
  content: string
  ts: number
  type: 'admin' | 'agent' | 'system'
}

export default function ChatPage() {
  const [agents, setAgents] = useState<any[]>([])
  const [target, setTarget] = useState<string>('all')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api.getAgents().then(a => setAgents(a.filter((ag: any) => ['idle', 'working', 'offline'].includes(ag.status)))).catch(() => {})
    const token = localStorage.getItem('admin_token')
    if (token) gatewaySocket.connect(token)

    // Escuchar todos los mensajes del WebSocket
    const handleAll = (msg: any) => {
      if (msg.type === 'agent_message' || msg.type === 'chat_message' || msg.type === 'task_result') {
        setMessages(prev => [...prev, {
          id: msg.id || Date.now().toString(),
          from: msg.from_agent_id || msg.agent_id || 'agent',
          fromName: msg.from_agent_name || msg.agent_name || 'Agente',
          to: msg.to || 'all',
          toName: 'Admin',
          content: msg.content || msg.message || JSON.stringify(msg.result || ''),
          ts: Date.now(),
          type: 'agent',
        }])
      }
      if (msg.type === 'agent_online') {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          from: 'system',
          fromName: 'Sistema',
          to: 'all',
          toName: 'all',
          content: `🟢 ${msg.agent_name || 'Agente'} se conectó`,
          ts: Date.now(),
          type: 'system',
        }])
        api.getAgents().then(a => setAgents(a.filter((ag: any) => ['idle', 'working', 'offline'].includes(ag.status)))).catch(() => {})
      }
      if (msg.type === 'agent_offline') {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          from: 'system',
          fromName: 'Sistema',
          to: 'all',
          toName: 'all',
          content: `🔴 ${msg.agent_name || 'Agente'} se desconectó`,
          ts: Date.now(),
          type: 'system',
        }])
      }
    }

    gatewaySocket.on('*', handleAll)
    return () => gatewaySocket.off('*', handleAll)
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim()) return

    const content = input.trim()
    setInput('')

    // Añadir mensaje del admin al chat local
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      from: 'admin',
      fromName: 'Admin',
      to: target,
      toName: target === 'all' ? 'Todos' : agents.find(a => a.id === target)?.name || target,
      content,
      ts: Date.now(),
      type: 'admin',
    }])

    // Enviar via WebSocket como broadcast o mensaje directo
    const token = localStorage.getItem('admin_token')
    if (target === 'all') {
      // Crear tarea de broadcast para comunicar a todos los agentes
      await api.createTask({
        title: content,
        description: content,
        mode: 'broadcast',
        priority: 5,
      }).catch(() => {})
    } else {
      // Crear tarea dirigida a un agente específico
      await api.createTask({
        title: content,
        description: content,
        mode: 'targeted',
        assigned_agents: [target],
        priority: 5,
      }).catch(() => {})
    }
  }

  const targetAgent = agents.find(a => a.id === target)
  const onlineAgents = agents.filter(a => a.status === 'idle' || a.status === 'working')

  return (
    <div className="flex h-[calc(100vh-5rem)] gap-4">
      {/* Sidebar de contactos */}
      <div className="w-56 bg-gray-900 border border-gray-800 rounded-xl flex flex-col overflow-hidden">
        <div className="p-3 border-b border-gray-800">
          <p className="text-gray-400 text-xs font-medium uppercase tracking-wider">Canales</p>
        </div>

        {/* Broadcast */}
        <button
          onClick={() => setTarget('all')}
          className={clsx('flex items-center gap-3 px-3 py-2.5 text-sm transition-colors', target === 'all' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800')}
        >
          <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
          Todos los agentes
          {onlineAgents.length > 0 && (
            <span className={clsx('ml-auto text-xs px-1.5 py-0.5 rounded-full', target === 'all' ? 'bg-blue-500' : 'bg-gray-700 text-gray-300')}>
              {onlineAgents.length}
            </span>
          )}
        </button>

        <div className="p-3 border-b border-gray-800 border-t">
          <p className="text-gray-400 text-xs font-medium uppercase tracking-wider">Agentes ({agents.length})</p>
        </div>

        <div className="flex-1 overflow-auto">
          {agents.length === 0 ? (
            <p className="text-gray-600 text-xs text-center p-4">Sin agentes activos</p>
          ) : agents.map(agent => (
            <button
              key={agent.id}
              onClick={() => setTarget(agent.id)}
              className={clsx('w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-colors', target === agent.id ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800')}
            >
              <span className={clsx('w-2 h-2 rounded-full inline-block shrink-0',
                agent.status === 'idle' ? 'bg-green-400' :
                agent.status === 'working' ? 'bg-blue-400' : 'bg-gray-600'
              )} />
              <span className="truncate">{agent.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Área de chat */}
      <div className="flex-1 bg-gray-900 border border-gray-800 rounded-xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3 border-b border-gray-800 flex items-center gap-3">
          <div>
            <p className="text-white font-medium">
              {target === 'all' ? '📡 Broadcast — Todos los agentes' : `💬 ${targetAgent?.name || target}`}
            </p>
            <p className="text-gray-500 text-xs">
              {target === 'all'
                ? `${onlineAgents.length} agentes activos`
                : targetAgent ? `${targetAgent.status} · ${targetAgent.trust_level}` : ''}
            </p>
          </div>
        </div>

        {/* Mensajes */}
        <div className="flex-1 overflow-auto p-4 space-y-3">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-gray-600">
              <p className="text-4xl mb-3">💬</p>
              <p className="text-sm">Sin mensajes. Envía el primero.</p>
            </div>
          )}
          {messages.map(msg => (
            <div key={msg.id} className={clsx('flex gap-2', msg.type === 'admin' ? 'justify-end' : msg.type === 'system' ? 'justify-center' : 'justify-start')}>
              {msg.type === 'system' ? (
                <span className="text-xs text-gray-500 bg-gray-800 px-3 py-1 rounded-full">{msg.content}</span>
              ) : (
                <div className={clsx('max-w-md rounded-2xl px-4 py-2.5', msg.type === 'admin' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-200')}>
                  {msg.type === 'agent' && <p className="text-xs text-gray-400 mb-1 font-medium">{msg.fromName}</p>}
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  <p className={clsx('text-xs mt-1', msg.type === 'admin' ? 'text-blue-200' : 'text-gray-500')}>
                    {new Date(msg.ts).toLocaleTimeString()}
                  </p>
                </div>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <form onSubmit={send} className="p-4 border-t border-gray-800 flex gap-3">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={target === 'all' ? 'Enviar mensaje a todos los agentes...' : `Enviar mensaje a ${targetAgent?.name || ''}...`}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 placeholder-gray-600"
          />
          <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium">
            Enviar
          </button>
        </form>
      </div>
    </div>
  )
}

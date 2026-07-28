'use client'
import { useEffect, useState, useRef } from 'react'
import { MessageSquare, Send, RefreshCw } from 'lucide-react'
import { api } from '@/lib/api'
import { gatewaySocket } from '@/lib/ws'

interface ChatMessage {
  id: string
  sender_id: string
  sender_name: string
  sender_role: 'admin' | 'agent'
  content: string
  channel: string
  target_agent_id: string | null
  message_type: string
  metadata: string
  created_at: string
}

interface Agent {
  id: string
  name: string
  status: string
  capabilities: string[]
  last_seen?: string
  last_message?: string | null
}

interface Channel {
  channel: string
  message_count: number
  last_message: string
}

interface WsChatMessage {
  type: string
  id?: string
  sender_id?: string
  sender_name?: string
  sender_role?: string
  content?: string
  channel?: string
  target_agent_id?: string
  message_type?: string
  created_at?: string
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [channels, setChannels] = useState<Channel[]>([])
  const [selectedChannel, setSelectedChannel] = useState('general')
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [autoScroll, setAutoScroll] = useState(true)

  useEffect(() => {
    if (autoScroll) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, autoScroll])

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100
    if (isNearBottom !== autoScroll) setAutoScroll(isNearBottom)
  }

  useEffect(() => {
    let cancelled = false
    const token = localStorage.getItem('admin_token')
    if (token) gatewaySocket.connect(token)

    const fetchData = async () => {
      try {
        const [msgs, agts, chs] = await Promise.all([
          api.getChatMessages(selectedChannel),
          api.getChatAgents(),
          api.getChatChannels(),
        ])
        if (!cancelled) {
          setMessages(msgs)
          setAgents(agts)
          setChannels(chs)
        }
      } catch (e) {
        console.error('Error loading chat data:', e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchData()

    const handler = (msg: WsChatMessage) => {
      if (msg.type === 'chat_message' && msg.channel === selectedChannel) {
        setMessages(prev => [...prev, {
          id: msg.id || '',
          sender_id: msg.sender_id || '',
          sender_name: msg.sender_name || '',
          sender_role: (msg.sender_role as 'admin' | 'agent') || 'admin',
          content: msg.content || '',
          channel: msg.channel || selectedChannel,
          target_agent_id: msg.target_agent_id || null,
          message_type: msg.message_type || 'text',
          metadata: '{}',
          created_at: msg.created_at || new Date().toISOString(),
        }])
      }
      if (msg.type === 'agent_online' || msg.type === 'agent_offline') {
        api.getChatAgents().then(setAgents).catch(() => {})
      }
    }
    gatewaySocket.on('*', handler)
    return () => {
      cancelled = true
      gatewaySocket.off('*', handler)
    }
  }, [selectedChannel])

  async function sendMessage() {
    if (!newMessage.trim()) return

    const adminName = localStorage.getItem('admin_name') || 'Admin'
    try {
      await api.sendChatMessage({
        content: newMessage,
        channel: selectedChannel,
        sender_name: adminName,
        sender_role: 'admin',
      })
      setNewMessage('')
      inputRef.current?.focus()
      // Refetch messages in case WS is not connected
      const msgs = await api.getChatMessages(selectedChannel)
      setMessages(msgs)
    } catch (e) {
      console.error('Error sending message:', e)
      alert('Error al enviar el mensaje. Revisa la consola para más detalles.')
    }
  }

  async function handleRefresh() {
    try {
      const [msgs, agts, chs] = await Promise.all([
        api.getChatMessages(selectedChannel),
        api.getChatAgents(),
        api.getChatChannels(),
      ])
      setMessages(msgs)
      setAgents(agts)
      setChannels(chs)
    } catch (e) {
      console.error('Error refreshing chat data:', e)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  function formatTime(dateStr: string) {
    const d = new Date(dateStr)
    return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'idle': return 'bg-green-400'
      case 'working': return 'bg-yellow-400'
      case 'sleeping': return 'bg-blue-400'
      case 'offline': return 'bg-gray-500'
      case 'pending': return 'bg-orange-400'
      default: return 'bg-gray-500'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-400">Cargando chat...</div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 gap-4 min-h-0">
      {/* Sidebar de canales y agentes */}
      <div className="w-48 shrink-0 bg-gray-900 border border-gray-800 rounded-xl flex flex-col">
        <div className="p-3 border-b border-gray-800">
          <h2 className="text-white font-semibold text-sm">Canales</h2>
        </div>
        <div className="p-1.5 space-y-0.5 overflow-y-auto">
          <button
            onClick={() => setSelectedChannel('general')}
            className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
              selectedChannel === 'general'
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            # general
          </button>
          {channels.filter(c => c.channel !== 'general').map(ch => (
            <button
              key={ch.channel}
              onClick={() => setSelectedChannel(ch.channel)}
              className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                selectedChannel === ch.channel
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              # {ch.channel}
            </button>
          ))}
        </div>

        <div className="p-3 border-t border-gray-800">
          <h2 className="text-white font-semibold text-sm mb-2">Agentes</h2>
          <div className="space-y-1 overflow-y-auto max-h-60">
            {agents.map(agent => (
              <button
                key={agent.id}
                onClick={() => setSelectedChannel(agent.id)}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                  selectedChannel === agent.id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${getStatusColor(agent.status)}`} />
                  <span className="truncate">{agent.name}</span>
                </div>
                {agent.last_message && (
                  <p className="text-[10px] text-gray-500 ml-3 mt-0.5 truncate">
                    {formatTime(agent.last_message)}
                  </p>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Área de chat principal */}
      <div className="flex-1 bg-gray-900 border border-gray-800 rounded-xl flex flex-col min-w-0">
        {/* Header del canal */}
        <div className="p-3 border-b border-gray-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <MessageSquare size={16} className="text-gray-400 shrink-0" />
            <div>
              <h2 className="text-white font-semibold text-sm">
                {selectedChannel === 'general' ? '# general' : `# ${selectedChannel}`}
              </h2>
              <p className="text-gray-500 text-[10px]">
                {selectedChannel === 'general'
                  ? 'Canal general'
                  : `${agents.find(a => a.id === selectedChannel)?.name || selectedChannel}`}
              </p>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            className="text-gray-400 hover:text-white text-xs px-2 py-1 rounded-lg hover:bg-gray-800 inline-flex items-center gap-1"
          >
            <RefreshCw size={12} /> Actualizar
          </button>
        </div>

        {/* Mensajes */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3" onScroll={handleScroll}>
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 mt-10">
              <p className="text-sm mb-1">No hay mensajes aún</p>
              <p className="text-xs">Envía un mensaje para comenzar</p>
            </div>
          ) : (
            messages.map(msg => (
              <div
                key={msg.id}
                className={`flex gap-2 ${msg.sender_role === 'admin' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.sender_role !== 'admin' && (
                  <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                    {msg.sender_name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className={`max-w-lg ${msg.sender_role === 'admin' ? 'order-first' : ''}`}>
                  <div className="flex items-baseline gap-1.5 mb-0.5">
                    <span className={`text-xs font-medium ${
                      msg.sender_role === 'admin' ? 'text-blue-400' : 'text-white'
                    }`}>
                      {msg.sender_name}
                    </span>
                    <span className="text-[10px] text-gray-600">{formatTime(msg.created_at)}</span>
                  </div>
                  <div className={`rounded-lg px-3 py-1.5 text-sm ${
                    msg.sender_role === 'admin'
                      ? 'bg-blue-600/20 text-blue-100 border border-blue-800'
                      : 'bg-gray-800 text-gray-200 border border-gray-700'
                  }`}>
                    {msg.content}
                  </div>
                  {msg.message_type !== 'text' && (
                    <span className="text-[10px] text-gray-600 mt-0.5 inline-block">
                      [{msg.message_type}]
                    </span>
                  )}
                </div>
                {msg.sender_role === 'admin' && (
                  <div className="w-7 h-7 rounded-full bg-purple-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                    A
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input de mensaje */}
        <div className="p-3 border-t border-gray-800 shrink-0">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe un mensaje..."
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-600 min-w-0"
            />
            <button
              onClick={sendMessage}
              disabled={!newMessage.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-1 shrink-0"
            >
              <Send size={14} /> Enviar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

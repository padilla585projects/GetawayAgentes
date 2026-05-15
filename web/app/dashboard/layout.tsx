'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { gatewaySocket } from '@/lib/ws'

const nav = [
  { href: '/dashboard', label: 'Inicio', icon: '◈', exact: true },
  { href: '/dashboard/chat', label: 'Chat', icon: '💬', exact: false },
  { href: '/dashboard/network', label: 'Red', icon: '🌐', exact: false },
  { href: '/dashboard/agents', label: 'Agentes', icon: '◉', exact: false },
  { href: '/dashboard/tasks', label: 'Tareas', icon: '◎', exact: false },
  { href: '/dashboard/knowledge', label: 'Conocimiento', icon: '◇', exact: false },
  { href: '/dashboard/logs', label: 'Logs', icon: '📋', exact: false },
]

interface Notification {
  id: string
  text: string
  type: 'success' | 'warning' | 'info' | 'error'
  ts: number
  read: boolean
}

const NOTIF_COLOR: Record<string, string> = {
  success: 'border-l-green-500 bg-green-500/5',
  warning: 'border-l-yellow-500 bg-yellow-500/5',
  info: 'border-l-blue-500 bg-blue-500/5',
  error: 'border-l-red-500 bg-red-500/5',
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [showNotifs, setShowNotifs] = useState(false)
  const unread = notifications.filter(n => !n.read).length

  useEffect(() => {
    if (!localStorage.getItem('admin_token')) router.push('/')
    const token = localStorage.getItem('admin_token')
    if (token) gatewaySocket.connect(token)

    const handle = (msg: any) => {
      const id = `${Date.now()}-${Math.random()}`
      let notif: Notification | null = null

      if (msg.type === 'agent_pending') {
        notif = { id, text: `Nuevo agente solicita acceso: ${msg.agent_name}`, type: 'warning', ts: Date.now(), read: false }
      } else if (msg.type === 'agent_online') {
        notif = { id, text: `${msg.agent_name} se conectó`, type: 'success', ts: Date.now(), read: false }
      } else if (msg.type === 'agent_offline') {
        notif = { id, text: `${msg.agent_name} se desconectó`, type: 'info', ts: Date.now(), read: false }
      } else if (msg.type === 'task_result') {
        notif = { id, text: `Tarea completada`, type: 'success', ts: Date.now(), read: false }
      }

      if (notif) setNotifications(prev => [notif!, ...prev].slice(0, 50))
    }

    gatewaySocket.on('*', handle)
    return () => gatewaySocket.off('*', handle)
  }, [router])

  function logout() {
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_name')
    router.push('/')
  }

  function markAllRead() {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="p-5 border-b border-gray-800">
          <h1 className="font-bold text-white text-lg">GetawayAgentes</h1>
          <p className="text-xs text-gray-500 mt-0.5">Panel de control</p>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-auto">
          {nav.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                (item.exact ? pathname === item.href : pathname.startsWith(item.href))
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              )}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-gray-800 space-y-1">
          {/* Notificaciones */}
          <button
            onClick={() => { setShowNotifs(s => !s); if (!showNotifs) markAllRead() }}
            className="w-full flex items-center gap-3 text-left text-sm text-gray-400 hover:text-white px-3 py-2 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <span>🔔</span>
            <span>Notificaciones</span>
            {unread > 0 && (
              <span className="ml-auto bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{unread}</span>
            )}
          </button>
          <button
            onClick={logout}
            className="w-full text-left text-sm text-gray-500 hover:text-white px-3 py-2 rounded-lg hover:bg-gray-800 transition-colors"
          >
            ⬡ Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Contenido */}
      <main className="flex-1 overflow-auto p-6">
        {children}
      </main>

      {/* Panel de notificaciones */}
      {showNotifs && (
        <div className="fixed right-0 top-0 h-full w-80 bg-gray-900 border-l border-gray-800 z-50 flex flex-col shadow-2xl">
          <div className="p-4 border-b border-gray-800 flex justify-between items-center">
            <h3 className="text-white font-semibold">Notificaciones</h3>
            <div className="flex gap-2">
              <button onClick={markAllRead} className="text-xs text-gray-500 hover:text-white">Marcar todo leído</button>
              <button onClick={() => setShowNotifs(false)} className="text-gray-500 hover:text-white text-lg">✕</button>
            </div>
          </div>
          <div className="flex-1 overflow-auto divide-y divide-gray-800">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-600">
                <p className="text-3xl mb-2">🔔</p>
                <p className="text-sm">Sin notificaciones</p>
              </div>
            ) : notifications.map(n => (
              <div key={n.id} className={clsx('px-4 py-3 border-l-2', NOTIF_COLOR[n.type], !n.read && 'opacity-100', n.read && 'opacity-60')}>
                <p className="text-white text-sm">{n.text}</p>
                <p className="text-gray-500 text-xs mt-1">{new Date(n.ts).toLocaleString()}</p>
              </div>
            ))}
          </div>
          <div className="p-3 border-t border-gray-800">
            <button onClick={() => setNotifications([])} className="w-full text-xs text-gray-500 hover:text-white py-1.5">
              Limpiar todo
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

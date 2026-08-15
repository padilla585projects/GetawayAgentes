'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useAgents } from '@/lib/use-agents'
import { useMaintenance } from '@/lib/use-maintenance'
import clsx from 'clsx'
import { Home, Bot, ClipboardList, BookOpen, MessageSquare, Lightbulb, LogOut, PanelLeft, Gauge, Power } from 'lucide-react'

const nav = [
  { href: '/dashboard', label: 'Inicio', icon: Gauge },
  { href: '/dashboard/agents', label: 'Agentes', icon: Bot },
  { href: '/dashboard/tasks', label: 'Tareas', icon: ClipboardList },
  { href: '/dashboard/knowledge', label: 'Conocimiento', icon: BookOpen },
  { href: '/dashboard/chat', label: 'Chat', icon: MessageSquare },
  { href: '/dashboard/improvements', label: 'Mejoras', icon: Lightbulb },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const { agents } = useAgents()
  const { maintenance, toggle: toggleMaintenance } = useMaintenance()

  const onlineCount = agents.filter(a => a.is_online || a.status === 'idle' || a.status === 'working').length

  useEffect(() => {
    if (!localStorage.getItem('admin_token')) router.push('/')
  }, [router])

  function handleKillSwitch() {
    const question = maintenance
      ? '¿Reactivar el sistema? Los agentes y el panel volverán a conectar.'
      : 'Esto desconecta a todos los agentes y bloquea la API y el WebSocket del gateway hasta que lo reactives. ¿Apagar el sistema?'
    if (window.confirm(question)) toggleMaintenance()
  }

  function logout() {
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_name')
    router.push('/')
  }

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      <aside className={clsx(
        'bg-gray-900 border-r border-gray-800 flex flex-col transition-all duration-200',
        collapsed ? 'w-16' : 'w-56'
      )}>
        <div className={clsx('p-4 border-b border-gray-800 flex items-center', collapsed ? 'justify-center' : 'justify-between')}>
          {!collapsed && (
            <div>
              <h1 className="font-bold text-white text-sm leading-tight">Getaway</h1>
              <p className="text-[10px] text-gray-500">Panel de control</p>
            </div>
          )}
          <button onClick={() => setCollapsed(!collapsed)} className="text-gray-500 hover:text-white p-1 rounded-lg hover:bg-gray-800">
            <PanelLeft size={16} />
          </button>
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {nav.map(item => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  'flex items-center gap-3 rounded-lg text-sm transition-colors',
                  collapsed ? 'justify-center p-2' : 'px-3 py-2',
                  pathname === item.href
                    ? 'bg-blue-600/20 text-blue-400'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                )}
                title={collapsed ? item.label : undefined}
              >
                <Icon size={18} />
                {!collapsed && item.label}
              </Link>
            )
          })}
        </nav>
        <div className={clsx('p-2 border-t border-gray-800', collapsed ? 'text-center' : '')}>
          {!collapsed && (
            <div className="px-3 py-1.5 text-xs text-gray-500 flex items-center gap-2 mb-1">
              <span className={clsx('w-1.5 h-1.5 rounded-full inline-block', maintenance ? 'bg-gray-600' : 'bg-green-400')} />
              {maintenance ? 'Sistema apagado' : `${onlineCount} online`}
            </div>
          )}
          <button
            onClick={handleKillSwitch}
            disabled={maintenance === null}
            className={clsx(
              'w-full rounded-lg transition-colors flex items-center gap-3 disabled:opacity-50',
              collapsed ? 'justify-center p-2' : 'px-3 py-2 text-sm',
              maintenance
                ? 'text-red-400 bg-red-950/60 hover:bg-red-950 border border-red-900'
                : 'text-gray-500 hover:text-red-400 hover:bg-gray-800'
            )}
            title={maintenance ? 'Reactivar el sistema' : 'Apagar el sistema (kill switch)'}
          >
            <Power size={16} />
            {!collapsed && (maintenance ? 'Reactivar sistema' : 'Apagar sistema')}
          </button>
          <button
            onClick={logout}
            className={clsx(
              'w-full text-gray-500 hover:text-white rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-3',
              collapsed ? 'justify-center p-2' : 'px-3 py-2 text-sm'
            )}
            title="Cerrar sesión"
          >
            <LogOut size={16} />
            {!collapsed && 'Cerrar sesión'}
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-6">
        {maintenance && (
          <div className="mb-4 px-4 py-2.5 rounded-lg bg-red-950/60 border border-red-900 text-red-300 text-sm flex items-center gap-2">
            <Power size={16} />
            Sistema en modo mantenimiento: la API y los agentes están desconectados.
          </div>
        )}
        {children}
      </main>
    </div>
  )
}

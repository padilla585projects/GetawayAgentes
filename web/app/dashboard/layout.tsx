'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import clsx from 'clsx'
import { Home, Bot, ClipboardList, BookOpen, MessageSquare, Lightbulb, LogOut, PanelLeft, Gauge } from 'lucide-react'

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
  const [onlineCount, setOnlineCount] = useState(0)

  useEffect(() => {
    if (!localStorage.getItem('admin_token')) router.push('/')
    const iv = setInterval(() => {
      api.getAgents().then(a => setOnlineCount(a.filter((x: any) => x.is_online || x.status === 'idle' || x.status === 'working').length)).catch(() => {})
    }, 10000)
    api.getAgents().then(a => setOnlineCount(a.filter((x: any) => x.is_online || x.status === 'idle' || x.status === 'working').length)).catch(() => {})
    return () => clearInterval(iv)
  }, [router])

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
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
              {onlineCount} online
            </div>
          )}
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
        {children}
      </main>
    </div>
  )
}

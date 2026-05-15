'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import clsx from 'clsx'

const nav = [
  { href: '/dashboard', label: 'Inicio', icon: '◈' },
  { href: '/dashboard/chat', label: 'Chat', icon: '💬' },
  { href: '/dashboard/agents', label: 'Agentes', icon: '◉' },
  { href: '/dashboard/tasks', label: 'Tareas', icon: '◎' },
  { href: '/dashboard/knowledge', label: 'Conocimiento', icon: '◇' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (!localStorage.getItem('admin_token')) router.push('/')
  }, [router])

  function logout() {
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_name')
    router.push('/')
  }

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="p-5 border-b border-gray-800">
          <h1 className="font-bold text-white text-lg">GetawayAgentes</h1>
          <p className="text-xs text-gray-500 mt-0.5">Panel de control</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {nav.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                pathname === item.href
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              )}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-gray-800">
          <button
            onClick={logout}
            className="w-full text-left text-sm text-gray-500 hover:text-white px-3 py-2 rounded-lg hover:bg-gray-800 transition-colors"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Contenido */}
      <main className="flex-1 overflow-auto p-6">
        {children}
      </main>
    </div>
  )
}

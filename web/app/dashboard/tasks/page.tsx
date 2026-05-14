'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import clsx from 'clsx'

const STATUS_COLOR: Record<string, string> = {
  pending: 'text-gray-400',
  assigned: 'text-yellow-400',
  in_progress: 'text-blue-400',
  collaborating: 'text-purple-400',
  completed: 'text-green-400',
  failed: 'text-red-400',
  cancelled: 'text-gray-600',
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<any[]>([])
  const [agents, setAgents] = useState<any[]>([])
  const [selected, setSelected] = useState<any | null>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [newMsg, setNewMsg] = useState('')
  const [form, setForm] = useState({ title: '', description: '', mode: 'auto', priority: '5', assigned_agents: [] as string[] })
  const [showForm, setShowForm] = useState(false)

  const load = () => {
    api.getTasks().then(setTasks).catch(() => {})
    api.getAgents().then(a => setAgents(a.filter((ag: any) => ag.status === 'idle' || ag.status === 'working'))).catch(() => {})
  }

  useEffect(() => { load() }, [])

  async function loadTask(id: string) {
    const t = await api.getTask(id).catch(() => null)
    if (t) { setSelected(t); setMessages(t.messages || []) }
  }

  async function createTask(e: React.FormEvent) {
    e.preventDefault()
    await api.createTask({ ...form, priority: parseInt(form.priority) }).catch(() => {})
    setShowForm(false)
    setForm({ title: '', description: '', mode: 'auto', priority: '5', assigned_agents: [] })
    load()
  }

  async function sendMsg(e: React.FormEvent) {
    e.preventDefault()
    if (!newMsg.trim() || !selected) return
    await api.sendMessage(selected.id, { sender_id: 'admin', sender_name: 'Admin', content: newMsg, message_type: 'text' }).catch(() => {})
    setNewMsg('')
    loadTask(selected.id)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Tareas</h2>
        <button onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm">
          + Nueva tarea
        </button>
      </div>

      {/* Lista de tareas */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400">
              <th className="text-left px-5 py-3">Título</th>
              <th className="text-left px-5 py-3">Modo</th>
              <th className="text-left px-5 py-3">Estado</th>
              <th className="text-left px-5 py-3">Prioridad</th>
              <th className="text-left px-5 py-3">Creada</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map(task => (
              <tr key={task.id} onClick={() => loadTask(task.id)} className="border-b border-gray-800 hover:bg-gray-800 cursor-pointer">
                <td className="px-5 py-3 text-white font-medium">{task.title}</td>
                <td className="px-5 py-3 text-gray-400">{task.mode}</td>
                <td className={clsx('px-5 py-3 font-medium', STATUS_COLOR[task.status])}>{task.status}</td>
                <td className="px-5 py-3 text-gray-400">{task.priority}/10</td>
                <td className="px-5 py-3 text-gray-500 text-xs">{new Date(task.created_at).toLocaleString()}</td>
              </tr>
            ))}
            {tasks.length === 0 && (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-500">Sin tareas</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal detalle + chat de tarea */}
      {selected && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-start p-5 border-b border-gray-800">
              <div>
                <h3 className="text-white font-bold text-lg">{selected.title}</h3>
                <p className="text-gray-400 text-sm mt-0.5">{selected.description}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-white text-xl ml-4">✕</button>
            </div>

            {/* Mensajes */}
            <div className="flex-1 overflow-auto p-4 space-y-3">
              {messages.length === 0
                ? <p className="text-gray-500 text-sm text-center py-4">Sin mensajes aún</p>
                : messages.map((m: any) => (
                  <div key={m.id} className={clsx('flex gap-2', m.sender_id === 'admin' ? 'justify-end' : 'justify-start')}>
                    <div className={clsx('max-w-sm rounded-xl px-4 py-2.5 text-sm', m.sender_id === 'admin' ? 'bg-blue-700 text-white' : 'bg-gray-800 text-gray-200')}>
                      {m.sender_id !== 'admin' && <p className="text-xs text-gray-400 mb-1">{m.sender_name}</p>}
                      <p>{m.content}</p>
                    </div>
                  </div>
                ))
              }
            </div>

            {/* Input de mensaje */}
            <form onSubmit={sendMsg} className="p-4 border-t border-gray-800 flex gap-3">
              <input
                value={newMsg}
                onChange={e => setNewMsg(e.target.value)}
                placeholder="Escribe un mensaje a los agentes..."
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              />
              <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm">Enviar</button>
            </form>
          </div>
        </div>
      )}

      {/* Modal nueva tarea */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <form onSubmit={createTask} className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-lg space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-white font-bold text-lg">Nueva tarea</h3>
              <button type="button" onClick={() => setShowForm(false)} className="text-gray-500 hover:text-white text-xl">✕</button>
            </div>
            <div>
              <label className="text-gray-400 text-sm block mb-1">Título</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500" required />
            </div>
            <div>
              <label className="text-gray-400 text-sm block mb-1">Descripción</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={4} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500 resize-none" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-gray-400 text-sm block mb-1">Modo</label>
                <select value={form.mode} onChange={e => setForm(f => ({ ...f, mode: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white">
                  <option value="auto">Auto (gateway decide)</option>
                  <option value="broadcast">Todos los agentes</option>
                  <option value="targeted">Agente específico</option>
                </select>
              </div>
              <div>
                <label className="text-gray-400 text-sm block mb-1">Prioridad (1-10)</label>
                <input type="number" min="1" max="10" value={form.priority}
                  onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500" />
              </div>
            </div>
            {form.mode === 'targeted' && agents.length > 0 && (
              <div>
                <label className="text-gray-400 text-sm block mb-1">Agente(s)</label>
                <select multiple value={form.assigned_agents}
                  onChange={e => setForm(f => ({ ...f, assigned_agents: Array.from(e.target.selectedOptions, o => o.value) }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white h-28">
                  {agents.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            )}
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-lg font-medium">
              Enviar tarea
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

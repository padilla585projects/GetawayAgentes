'use client'
import { useEffect, useState } from 'react'
import { BookOpen, Plus, Tag, Trash2, X } from 'lucide-react'
import { api } from '@/lib/api'

export default function KnowledgePage() {
  const [entries, setEntries] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', content: '', category: 'general', tags: '', visibility: 'public' })

  const load = () => api.getKnowledge('public').then(setEntries).catch(() => {})

  useEffect(() => { load() }, [])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    await api.addKnowledge({
      ...form,
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
    }).catch(() => {})
    setShowForm(false)
    setForm({ title: '', content: '', category: 'general', tags: '', visibility: 'public' })
    load()
  }

  async function remove(id: string) {
    if (!confirm('¿Eliminar esta entrada?')) return
    await api.deleteKnowledge(id).catch(() => {})
    load()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2"><BookOpen size={24} className="text-blue-400" /> Base de conocimiento</h2>
          <p className="text-gray-400 text-sm mt-1">Memoria compartida entre todos los agentes</p>
        </div>
        <button onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm inline-flex items-center gap-1.5">
          <Plus size={16} /> Añadir conocimiento
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {entries.map(entry => (
          <div key={entry.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded">{entry.category}</span>
                  <span className="text-xs text-gray-500">{entry.visibility}</span>
                  {entry.source_agent_name && (
                    <span className="text-xs text-blue-400">por {entry.source_agent_name}</span>
                  )}
                </div>
                <h3 className="text-white font-semibold">{entry.title}</h3>
                <p className="text-gray-400 text-sm mt-1 line-clamp-3">{entry.content}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {(entry.tags || []).map((tag: string) => (
                    <span key={tag} className="text-xs bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded">#{tag}</span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3 ml-4 shrink-0">
                <span className="text-xs text-gray-500">Usado {entry.times_used}x</span>
                <button onClick={() => remove(entry.id)} className="text-gray-600 hover:text-red-400 transition-colors"><X size={14} /></button>
              </div>
            </div>
          </div>
        ))}
        {entries.length === 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-10 text-center text-gray-500">
            La base de conocimiento está vacía. Los agentes irán añadiendo aprendizajes automáticamente.
          </div>
        )}
      </div>

      {/* Modal nueva entrada */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <form onSubmit={create} className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-lg space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-white font-bold text-lg">Nuevo conocimiento</h3>
              <button type="button" onClick={() => setShowForm(false)} className="text-gray-500 hover:text-white"><X size={20} /></button>
            </div>
            <div>
              <label className="text-gray-400 text-sm block mb-1">Título</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500" required />
            </div>
            <div>
              <label className="text-gray-400 text-sm block mb-1">Contenido</label>
              <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                rows={5} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500 resize-none" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-gray-400 text-sm block mb-1">Categoría</label>
                <input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-gray-400 text-sm block mb-1">Visibilidad</label>
                <select value={form.visibility} onChange={e => setForm(f => ({ ...f, visibility: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white">
                  <option value="public">Todos los agentes</option>
                  <option value="trusted">Solo de confianza</option>
                  <option value="private">Solo admin</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-gray-400 text-sm block mb-1">Etiquetas (separadas por coma)</label>
              <input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
                placeholder="estrategia, aprendizaje, código..."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500" />
            </div>
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-lg font-medium">
              Guardar
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

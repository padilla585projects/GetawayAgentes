'use client'
import { useEffect, useState } from 'react'
import { Inbox as InboxIcon, Sprout } from 'lucide-react'
import { api } from '@/lib/api'
import { SimulatedInboxEntry } from '@/lib/types'

const CATEGORY_LABEL: Record<string, string> = {
  correspondencia: 'Correspondencia',
  facturas: 'Facturas',
  rrhh: 'Personal',
  almacen: 'Almacén',
}

const CATEGORY_COLOR: Record<string, string> = {
  correspondencia: 'bg-gray-700 text-gray-300',
  facturas: 'bg-orange-900 text-orange-300 border border-orange-800',
  rrhh: 'bg-blue-900 text-blue-300 border border-blue-800',
  almacen: 'bg-purple-900 text-purple-300 border border-purple-800',
}

export default function InboxPage() {
  const [entries, setEntries] = useState<SimulatedInboxEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)

  const load = () => api.getInbox().then(setEntries).catch(() => {}).finally(() => setLoading(false))

  useEffect(() => { load() }, [])

  async function seed() {
    setSeeding(true)
    try {
      await api.seedInbox()
      await load()
    } catch (e) {
      console.error('Error sembrando la bandeja:', e)
    } finally {
      setSeeding(false)
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2"><InboxIcon size={24} className="text-blue-400" /> Bandeja (simulada)</h2>
          <p className="text-gray-400 text-sm mt-1">Correo de prueba de Suministros Industriales Vega S.L. — el Director la audita para proponer agentes de departamento</p>
        </div>
        <button
          onClick={seed}
          disabled={seeding}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm inline-flex items-center gap-1.5"
        >
          <Sprout size={16} className={seeding ? 'animate-spin' : ''} /> {seeding ? 'Sembrando...' : 'Sembrar bandeja'}
        </button>
      </div>

      {loading ? (
        <div className="text-gray-400 text-sm">Cargando...</div>
      ) : entries.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-10 text-center text-gray-500">
          La bandeja está vacía. Pulsa "Sembrar bandeja" para cargar los correos de prueba.
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase">
                <th className="text-left px-4 py-3">De</th>
                <th className="text-left px-4 py-3">Asunto</th>
                <th className="text-left px-4 py-3">Categoría</th>
                <th className="text-left px-4 py-3">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(entry => (
                <tr key={entry.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="px-4 py-3">
                    <p className="text-white">{entry.from_name}</p>
                    <p className="text-gray-500 text-xs">{entry.from_email}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-300 max-w-md">
                    <p className="font-medium text-gray-200">{entry.subject}</p>
                    <p className="text-gray-500 text-xs mt-0.5 line-clamp-2">{entry.body}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${CATEGORY_COLOR[entry.category] || 'bg-gray-700 text-gray-300'}`}>
                      {CATEGORY_LABEL[entry.category] || entry.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{formatDate(entry.received_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

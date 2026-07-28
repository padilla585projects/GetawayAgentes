'use client'
import { useEffect, useState, type ReactNode } from 'react'
import { Lightbulb, CheckCircle, XCircle, Clock, Filter, RefreshCw, Sparkles, Target, Zap, Bot, Wrench, Book, Link, X } from 'lucide-react'
import { api } from '@/lib/api'
import { ImprovementProposal, ImprovementStats, LearningTask } from '@/lib/types'
import clsx from 'clsx'

const PRIORITY_COLOR: Record<string, string> = {
  low: 'bg-gray-700 text-gray-300',
  medium: 'bg-yellow-900 text-yellow-300 border border-yellow-800',
  high: 'bg-orange-900 text-orange-300 border border-orange-800',
  critical: 'bg-red-900 text-red-300 border border-red-800',
}

const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-gray-700 text-gray-300',
  reviewing: 'bg-blue-900 text-blue-300 border border-blue-800',
  approved: 'bg-green-900 text-green-300 border border-green-800',
  rejected: 'bg-red-900 text-red-300 border border-red-800',
  implemented: 'bg-purple-900 text-purple-300 border border-purple-800',
}

const TYPE_LABEL: Record<string, string> = {
  feature: 'Nueva función',
  new_agent: 'Nuevo agente',
  optimization: 'Optimización',
  knowledge_gap: 'Falta de conocimiento',
  integration: 'Integración',
}

const TYPE_ICON: Record<string, ReactNode> = {
  feature: <Zap size={24} />,
  new_agent: <Bot size={24} />,
  optimization: <Wrench size={24} />,
  knowledge_gap: <Book size={24} />,
  integration: <Link size={24} />,
}

export default function ImprovementsPage() {
  const [proposals, setProposals] = useState<ImprovementProposal[]>([])
  const [stats, setStats] = useState<ImprovementStats | null>(null)
  const [learningTasks, setLearningTasks] = useState<LearningTask[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [filterType, setFilterType] = useState<string>('')
  const [selectedProposal, setSelectedProposal] = useState<ImprovementProposal | null>(null)

  useEffect(() => {
    let cancelled = false
    const fetchData = async () => {
      try {
        const [proposalsData, statsData, learningData] = await Promise.all([
          api.getImprovements(filterStatus || undefined, filterType || undefined),
          api.getImprovementStats(),
          api.getLearningTasks(),
        ])
        if (!cancelled) {
          setProposals(proposalsData)
          setStats(statsData)
          setLearningTasks(learningData)
        }
      } catch (e) {
        console.error('Error loading improvements:', e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchData()
    return () => { cancelled = true }
  }, [filterStatus, filterType])

  async function refreshData() {
    try {
      const [proposalsData, statsData, learningData] = await Promise.all([
        api.getImprovements(filterStatus || undefined, filterType || undefined),
        api.getImprovementStats(),
        api.getLearningTasks(),
      ])
      setProposals(proposalsData)
      setStats(statsData)
      setLearningTasks(learningData)
    } catch (e) {
      console.error('Error refreshing improvements:', e)
    }
  }

  async function reviewProposal(id: string, status: string, notes?: string) {
    try {
      await api.reviewImprovement(id, { status, implementation_notes: notes })
      await refreshData()
      setSelectedProposal(null)
    } catch (e) {
      console.error('Error reviewing proposal:', e)
    }
  }

  async function deleteProposal(id: string) {
    if (!confirm('¿Eliminar esta propuesta?')) return
    try {
      await api.deleteImprovement(id)
      await refreshData()
    } catch (e) {
      console.error('Error deleting proposal:', e)
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleString('es-ES', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Cargando mejoras...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2"><Lightbulb size={24} className="text-yellow-400" /> Mejoras del Sistema</h2>
        <button onClick={refreshData} className="text-gray-400 hover:text-white text-sm px-3 py-1 rounded-lg hover:bg-gray-800 inline-flex items-center gap-1">
          <RefreshCw size={14} /> Actualizar
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          {[
            { label: 'Total', value: stats.total, color: 'text-white', icon: <Target size={14} className="text-white" /> },
            { label: 'Pendientes', value: stats.pending, color: 'text-yellow-400', icon: <Clock size={14} className="text-yellow-400" /> },
            { label: 'Aprobadas', value: stats.approved, color: 'text-green-400', icon: <CheckCircle size={14} className="text-green-400" /> },
            { label: 'Implementadas', value: stats.implemented, color: 'text-purple-400', icon: <Sparkles size={14} className="text-purple-400" /> },
            { label: 'Nuevos agentes', value: stats.new_agent_proposals, color: 'text-blue-400', icon: <Bot size={14} className="text-blue-400" /> },
            { label: 'Funciones', value: stats.feature_proposals, color: 'text-orange-400', icon: <Zap size={14} className="text-orange-400" /> },
          ].map(stat => (
            <div key={stat.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center gap-1.5 mb-1">
                {stat.icon}
                <p className="text-gray-500 text-xs">{stat.label}</p>
              </div>
              <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-2"
        >
          <option value="">Todos los estados</option>
          <option value="pending">Pendientes</option>
          <option value="reviewing">En revisión</option>
          <option value="approved">Aprobadas</option>
          <option value="rejected">Rechazadas</option>
          <option value="implemented">Implementadas</option>
        </select>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-2"
        >
          <option value="">Todos los tipos</option>
          <option value="feature">Nuevas funciones</option>
          <option value="new_agent">Nuevos agentes</option>
          <option value="optimization">Optimizaciones</option>
          <option value="knowledge_gap">Faltas de conocimiento</option>
          <option value="integration">Integraciones</option>
        </select>
      </div>

      {/* Proposals list */}
      <div className="space-y-3">
        {proposals.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
            <p className="text-gray-500">No hay propuestas de mejora aún</p>
            <p className="text-gray-600 text-sm mt-1">Los agentes propondrán mejoras cuando estén idle</p>
          </div>
        ) : (
          proposals.map(proposal => (
            <div
              key={proposal.id}
              className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 cursor-pointer transition-colors"
              onClick={() => setSelectedProposal(proposal)}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">{TYPE_ICON[proposal.proposal_type]}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-white font-medium">{proposal.title}</h3>
                    <span className={clsx('text-xs px-2 py-0.5 rounded-full', PRIORITY_COLOR[proposal.priority])}>
                      {proposal.priority}
                    </span>
                    <span className={clsx('text-xs px-2 py-0.5 rounded-full', STATUS_COLOR[proposal.status])}>
                      {proposal.status}
                    </span>
                  </div>
                  <p className="text-gray-400 text-sm mt-1 line-clamp-2">{proposal.description}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                    <span>Por: {proposal.agent_name}</span>
                    <span>{TYPE_LABEL[proposal.proposal_type]}</span>
                    <span>{formatDate(proposal.created_at)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Learning tasks section */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-white font-semibold mb-4">Tareas de Aprendizaje Recientes</h3>
        {learningTasks.length === 0 ? (
          <p className="text-gray-500 text-sm">No hay tareas de aprendizaje registradas</p>
        ) : (
          <div className="space-y-2">
            {learningTasks.slice(0, 10).map(task => (
              <div key={task.id} className="flex items-center justify-between bg-gray-800/50 rounded-lg px-4 py-2">
                <div>
                  <p className="text-white text-sm">{task.title}</p>
                  <p className="text-gray-500 text-xs">{task.agent_name} · {task.task_type}</p>
                </div>
                <span className={clsx('text-xs px-2 py-1 rounded-full', task.status === 'completed' ? 'bg-green-900 text-green-300' : 'bg-gray-700 text-gray-400')}>
                  {task.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Proposal detail modal */}
      {selectedProposal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-lg w-full space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{TYPE_ICON[selectedProposal.proposal_type]}</span>
                  <h3 className="text-white text-xl font-bold">{selectedProposal.title}</h3>
                </div>
                <p className="text-gray-400 text-sm mt-1">
                  {selectedProposal.agent_name} · {TYPE_LABEL[selectedProposal.proposal_type]}
                </p>
              </div>
              <button onClick={() => setSelectedProposal(null)} className="text-gray-500 hover:text-white"><X size={20} /></button>
            </div>

            <div className="flex gap-2">
              <span className={clsx('text-xs px-2 py-1 rounded-full', PRIORITY_COLOR[selectedProposal.priority])}>
                Prioridad: {selectedProposal.priority}
              </span>
              <span className={clsx('text-xs px-2 py-1 rounded-full', STATUS_COLOR[selectedProposal.status])}>
                Estado: {selectedProposal.status}
              </span>
            </div>

            <div>
              <p className="text-gray-400 text-sm mb-2">Descripción</p>
              <p className="text-gray-200 text-sm">{selectedProposal.description}</p>
            </div>

            {selectedProposal.evidence && (
              <div>
                <p className="text-gray-400 text-sm mb-2">Evidencia</p>
                <p className="text-gray-300 text-sm bg-gray-800 rounded-lg p-3">{selectedProposal.evidence}</p>
              </div>
            )}

            {selectedProposal.related_capabilities.length > 0 && (
              <div>
                <p className="text-gray-400 text-sm mb-2">Capacidades relacionadas</p>
                <div className="flex flex-wrap gap-1">
                  {selectedProposal.related_capabilities.map(cap => (
                    <span key={cap} className="text-xs bg-blue-900 text-blue-200 px-2 py-0.5 rounded">{cap}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="text-xs text-gray-600">
              Creada: {formatDate(selectedProposal.created_at)}
              {selectedProposal.reviewed_at && ` · Revisada: ${formatDate(selectedProposal.reviewed_at)}`}
            </div>

            {/* Action buttons */}
            {selectedProposal.status === 'pending' && (
              <div className="flex gap-3 pt-2 border-t border-gray-800">
                <button
                  onClick={() => reviewProposal(selectedProposal.id, 'approved')}
                  className="flex-1 bg-green-700 hover:bg-green-600 text-white py-2 rounded-lg text-sm inline-flex items-center justify-center gap-1"
                >
                  <CheckCircle size={14} /> Aprobar
                </button>
                <button
                  onClick={() => reviewProposal(selectedProposal.id, 'rejected')}
                  className="flex-1 bg-red-800 hover:bg-red-700 text-white py-2 rounded-lg text-sm inline-flex items-center justify-center gap-1"
                >
                  <XCircle size={14} /> Rechazar
                </button>
                <button
                  onClick={() => deleteProposal(selectedProposal.id)}
                  className="text-gray-600 hover:text-red-400 text-sm px-3 py-2"
                >
                  Eliminar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

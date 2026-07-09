/**
 * Shared learning behavior for all agents
 * Provides: learning tasks, knowledge sharing, improvement proposals
 */

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:8787'

// Learning task types and their descriptions
export const LEARNING_TASKS = {
  knowledge_share: {
    title: 'Compartir conocimiento especializado',
    description: 'Publicar conocimiento clave de tu dominio en la base de conocimiento compartida',
  },
  knowledge_query: {
    title: 'Consultar conocimiento de otros agentes',
    description: 'Buscar y aprender de la experiencia de otros agentes en la red',
  },
  self_improve: {
    title: 'Auto-mejora y optimización',
    description: 'Analizar tu propio rendimiento y proponer mejoras internas',
  },
  capability_explore: {
    title: 'Explorar nuevas capacidades',
    description: 'Investigar nuevas áreas de conocimiento relacionadas con tu dominio',
  },
  system_analysis: {
    title: 'Análisis del sistema',
    description: 'Evaluar el estado general de la red y proponer mejoras estructurales',
  },
}

// Generate improvement proposals based on agent analysis
export function generateImprovementProposals(agentName: string, capabilities: string[], knowledgeEntries: any[]): any[] {
  const proposals: any[] = []

  // Check for knowledge gaps
  const categories = knowledgeEntries.map(k => k.category)
  const uniqueCategories = [...new Set(categories)]

  if (uniqueCategories.length < 5) {
    proposals.push({
      proposal_type: 'knowledge_gap',
      title: `Ampliar base de conocimiento de ${agentName}`,
      description: `La base de conocimiento tiene solo ${uniqueCategories.length} categorías. Se recomienda expandir a al menos 10 categorías para mejorar la cobertura.`,
      priority: 'medium',
      related_capabilities: capabilities,
      evidence: `Categorías actuales: ${uniqueCategories.join(', ')}`,
    })
  }

  // Suggest new agents based on missing capabilities
  const missingCapabilities = [
    'cybersecurity', 'data_science', 'marketing', 'hr_management',
    'supply_chain', 'quality_assurance', 'research', 'education',
  ]

  const missing = missingCapabilities.filter(c => !capabilities.includes(c))
  if (missing.length > 0 && Math.random() > 0.7) {
    const suggested = missing[Math.floor(Math.random() * missing.length)]
    proposals.push({
      proposal_type: 'new_agent',
      title: `Proponer nuevo agente: ${suggested.replace(/_/g, ' ')}`,
      description: `Se detectó una capacidad faltante en la red: ${suggested}. Se recomienda crear un agente especializado en esta área.`,
      priority: 'high',
      related_capabilities: [suggested],
      evidence: `Capacidades actuales en la red: ${capabilities.join(', ')}`,
    })
  }

  // Suggest optimizations
  if (Math.random() > 0.8) {
    proposals.push({
      proposal_type: 'optimization',
      title: `Optimizar respuestas de ${agentName}`,
      description: 'Se detectó que las respuestas pueden mejorarse agregando más contexto y referencias cruzadas con otros agentes.',
      priority: 'low',
      related_capabilities: capabilities,
      evidence: 'Análisis de patrones de respuesta sugiere oportunidades de mejora.',
    })
  }

  return proposals
}

// Generate learning task results
export function generateLearningResult(taskType: string, agentName: string, capabilities: string[]): any {
  switch (taskType) {
    case 'knowledge_share':
      return {
        status: 'completed',
        shared_topics: capabilities.slice(0, 3),
        knowledge_entries_created: Math.floor(Math.random() * 3) + 1,
        summary: `${agentName} compartió conocimiento sobre ${capabilities.slice(0, 2).join(' y ')}`,
      }

    case 'knowledge_query':
      return {
        status: 'completed',
        queries_made: Math.floor(Math.random() * 5) + 1,
        relevant_findings: Math.floor(Math.random() * 3),
        summary: `${agentName} consultó conocimiento de otros agentes`,
      }

    case 'self_improve':
      return {
        status: 'completed',
        improvements_identified: Math.floor(Math.random() * 3) + 1,
        optimization_areas: ['response_time', 'knowledge_depth', 'cross_references'],
        summary: `${agentName} identificó áreas de mejora interna`,
      }

    case 'capability_explore':
      return {
        status: 'completed',
        new_areas_explored: Math.floor(Math.random() * 2) + 1,
        potential_capabilities: ['integration', 'automation', 'analysis'],
        summary: `${agentName} exploró nuevas áreas de conocimiento`,
      }

    case 'system_analysis':
      return {
        status: 'completed',
        system_health: 'good',
        recommendations: ['increase_knowledge_sharing', 'add_specialized_agents'],
        summary: `${agentName} completó análisis del sistema`,
      }

    default:
      return { status: 'completed', summary: 'Tarea de aprendizaje completada' }
  }
}

// Send learning results to gateway
export async function reportLearningResult(agentId: string, agentName: string, taskId: string, result: any) {
  try {
    await fetch(`${GATEWAY_URL}/improvements/learning/${taskId}/complete`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ result }),
    })
  } catch (e) {
    console.error(`[${agentName}] Error reporting learning result:`, e)
  }
}

// Send improvement proposal to gateway
export async function submitImprovementProposal(agentId: string, agentName: string, proposal: any) {
  try {
    await fetch(`${GATEWAY_URL}/improvements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_id: agentId,
        agent_name: agentName,
        ...proposal,
      }),
    })
    console.log(`[${agentName}] Propuesta enviada: ${proposal.title}`)
  } catch (e) {
    console.error(`[${agentName}] Error submitting proposal:`, e)
  }
}

import { Hono } from 'hono'
import { Env } from '../models/types'
import { nanoid } from '../services/utils'
import { generateWithFallback } from '../services/llm'

const director = new Hono<{ Bindings: Env }>()

interface ProposedAgentSpec {
  name: string
  description: string
  capabilities: string[]
  specialties: string[]
  system_prompt: string
  priority: 'low' | 'medium' | 'high'
  evidence: string
}

const DIRECTOR_AUDIT_PROMPT = `Eres el Director, un agente auditor de una empresa. Se te da un volcado de la bandeja de entrada de la empresa. Tu única salida debe ser un array JSON, sin texto antes ni después, sin markdown, sin explicaciones.

Cada elemento del array representa un agente de departamento que propones crear, con esta forma exacta:
{"name": string, "description": string, "capabilities": string[], "specialties": string[], "system_prompt": string, "priority": "low"|"medium"|"high", "evidence": string}

- "name": nombre corto del agente propuesto (ej. "Agente de Facturación").
- "description": qué hace, en una frase.
- "capabilities": 3-6 identificadores cortos en snake_case (ej. "invoice_tracking").
- "specialties": 3-6 etiquetas legibles en español.
- "system_prompt": el prompt de sistema COMPLETO y autónomo para ese futuro agente — personalidad, estilo de respuesta, áreas de experiencia, reglas — listo para usarse tal cual como system prompt de un LLM. Responde en español.
- "priority": urgencia de crear este agente según el volumen/gravedad de la señal que has visto.
- "evidence": cita remitentes y asuntos concretos de la bandeja que justifican la propuesta.

Reglas importantes:
- Propón como máximo un agente por necesidad departamental clara y distinta que detectes (no dupliques ni propongas variantes del mismo departamento).
- No propongas nada para correspondencia rutinaria o ruido sin patrón — solo cuando haya una necesidad operativa real y repetida.
- Si no encuentras señal suficiente para ningún departamento, responde con un array vacío: []`

// Parseo tolerante: el LLM no tiene modo JSON estructurado, así que puede
// devolver texto alrededor del array, o romper el formato. Si no se puede
// parsear nada usable, no se pierde la auditoría — se crea una única
// propuesta genérica con el texto crudo para que el admin la revise a mano.
function parseProposals(raw: string): ProposedAgentSpec[] | null {
  const match = raw.match(/\[[\s\S]*\]/)
  if (!match) return null
  try {
    const parsed = JSON.parse(match[0])
    if (!Array.isArray(parsed)) return null
    const valid = parsed.filter((p): p is ProposedAgentSpec =>
      p && typeof p.name === 'string' && typeof p.description === 'string' && typeof p.system_prompt === 'string'
    )
    return valid.length > 0 ? valid : null
  } catch {
    return null
  }
}

// POST /director/audit — el Director lee la bandeja simulada, decide qué
// agentes de departamento hacen falta, y crea propuestas (nunca agentes
// directamente) para que un admin las apruebe o rechace.
director.post('/audit', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT from_name, subject, body, category FROM simulated_inbox ORDER BY received_at DESC'
  ).all()

  if (results.length === 0) {
    return c.json({ error: 'La bandeja simulada está vacía. Siembra los datos de prueba primero (POST /inbox/seed).' }, 400)
  }

  const digest = results
    .map((r: any) => `[${r.category}] De: ${r.from_name} — Asunto: ${r.subject}\n${r.body}`)
    .join('\n\n')

  const raw = await generateWithFallback(c.env, DIRECTOR_AUDIT_PROMPT, digest)
  if (!raw) {
    return c.json({ error: 'No hay ningún proveedor de IA configurado. El Director necesita al menos una clave LLM (OPENROUTER_KEY, GROQ_KEY, GEMINI_KEY...) para auditar.' }, 503)
  }

  let specs = parseProposals(raw)
  const proposalIds: string[] = []

  if (!specs) {
    // Fallback: no se pudo parsear nada usable — no se descarta el trabajo
    // del LLM, se deja como una propuesta para revisión manual.
    const id = nanoid()
    await c.env.DB.prepare(`
      INSERT INTO improvement_proposals (id, agent_id, agent_name, proposal_type, title, description, priority, evidence)
      VALUES (?, 'builtin-director', 'Director', 'new_agent', ?, ?, 'medium', ?)
    `).bind(
      id,
      'Propuesta del Director (revisión manual requerida)',
      'El Director completó la auditoría pero su respuesta no se pudo interpretar como una lista de agentes. Revisa el texto original en la evidencia.',
      raw.slice(0, 2000),
    ).run()
    proposalIds.push(id)
    specs = []
  }

  for (const spec of specs) {
    const id = nanoid()
    await c.env.DB.prepare(`
      INSERT INTO improvement_proposals (id, agent_id, agent_name, proposal_type, title, description, priority, related_capabilities, evidence, proposed_agent_spec)
      VALUES (?, 'builtin-director', 'Director', 'new_agent', ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      spec.name,
      spec.description,
      spec.priority || 'medium',
      JSON.stringify(spec.capabilities || []),
      spec.evidence || '',
      JSON.stringify(spec),
    ).run()
    proposalIds.push(id)
  }

  if (proposalIds.length > 0) {
    const hub = c.env.GATEWAY_HUB.get(c.env.GATEWAY_HUB.idFromName('main'))
    await hub.fetch('http://internal/notify-admin', {
      method: 'POST',
      body: JSON.stringify({ type: 'director_proposal', count: proposalIds.length, proposal_ids: proposalIds }),
    })
  }

  return c.json({ message: 'Auditoría completada', proposals_created: proposalIds.length, proposal_ids: proposalIds })
})

export default director

import { Env } from '../models/types'

// 15s bastaba para respuestas cortas, pero con MAX_TOKENS más alto un modelo
// con razonamiento interno (gemini-3.6-flash, grok-4.6) puede tardar más en
// terminar — visto en vivo dos veces: 45s tampoco fue suficiente para Grok
// ("The operation was aborted"), así que subimos otra vez.
const TIMEOUT_MS = 60000
// 1024 se quedaba corto para el Director: le pedimos un array JSON con varios
// agentes completos (cada uno con su propio system prompt), y los modelos con
// razonamiento interno (p.ej. gemini-3.6-flash) además gastan parte de este
// presupuesto en "pensar" antes de emitir la respuesta visible — con 1024 la
// salida se cortaba a mitad de frase y el JSON quedaba inválido.
const MAX_TOKENS = 4096
// 'gemini-2.0-flash' fue retirado por Google (404 "no longer available");
// el propio error de la API indica el reemplazo actual.
const GEMINI_DEFAULT_MODEL = 'gemini-3.6-flash'

async function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  signal: AbortSignal,
): Promise<any> {
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`)
  }
  return res.json()
}

// Proveedores compatibles con la API de OpenAI (OpenRouter, Groq, OpenAI, DeepSeek).
async function completeOpenAi(
  baseUrl: string,
  apiKey: string,
  model: string,
  system: string,
  user: string,
  signal: AbortSignal,
): Promise<string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  }
  if (baseUrl.includes('openrouter')) {
    headers['HTTP-Referer'] = 'https://getaway-web.pages.dev'
    headers['X-Title'] = 'GetawayAgentes'
  }
  const data = await postJson(
    `${baseUrl}/chat/completions`,
    headers,
    {
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.7,
      max_tokens: MAX_TOKENS,
    },
    signal,
  )
  const msg = data?.choices?.[0]?.message
  let text = msg?.content || msg?.reasoning
  if (!text) throw new Error('Respuesta vacía del proveedor')
  return text.trim()
}

// Anthropic (formato propio).
async function completeAnthropic(
  apiKey: string,
  model: string,
  system: string,
  user: string,
  signal: AbortSignal,
): Promise<string> {
  const data = await postJson(
    'https://api.anthropic.com/v1/messages',
    {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    {
      model,
      max_tokens: MAX_TOKENS,
      system,
      messages: [{ role: 'user', content: user }],
    },
    signal,
  )
  const text = data?.content?.[0]?.text
  if (!text) throw new Error('Respuesta vacía de Anthropic')
  return text.trim()
}

// Google Gemini (formato propio).
async function completeGemini(
  apiKey: string,
  model: string,
  system: string,
  user: string,
  signal: AbortSignal,
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
  const data = await postJson(
    url,
    { 'Content-Type': 'application/json' },
    {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ parts: [{ text: user }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: MAX_TOKENS },
    },
    signal,
  )
  const parts = data?.candidates?.[0]?.content?.parts
  const text = Array.isArray(parts) ? parts.map((p: any) => p.text || '').join('') : ''
  if (!text) throw new Error('Respuesta vacía de Gemini')
  return text.trim()
}

interface Provider {
  name: string
  call: (signal: AbortSignal) => Promise<string>
}

/**
 * Interpreta modelOverride y construye un array de providers.
 *
 * Convención de modelOverride:
 *   provider:model-name   → usa ese provider explícitamente
 *   modelo solo           → autodetecta: "gemini" = Gemini, "/" = OpenRouter
 *
 * Siempre agrega Gemini como fallback final si hay GEMINI_KEY.
 */
export function buildProviders(env: Env, system: string, user: string, modelOverride?: string): Provider[] {
  const providers: Provider[] = []

  if (!modelOverride) {
    // Sin override: intenta Grok (xAI) → OpenRouter → Groq → Gemini
    addXai(providers, env, system, user, 'grok-4.6')
    addOpenRouter(providers, env, system, user, 'nvidia/nemotron-3-ultra-550b-a55b:free')
    addGroq(providers, env, system, user, 'llama-3.3-70b-versatile')
    addGemini(providers, env, system, user, GEMINI_DEFAULT_MODEL)
    return providers
  }

  // Detecta provider por prefijo "provider:"
  const colonIdx = modelOverride.indexOf(':')
  let provider: string
  let model: string

  if (colonIdx > 0) {
    provider = modelOverride.slice(0, colonIdx)
    model = modelOverride.slice(colonIdx + 1)
  } else {
    // Sin prefijo: autodetecta
    if (modelOverride.toLowerCase().includes('gemini')) {
      provider = 'gemini'
    } else if (modelOverride.includes('/')) {
      provider = 'openrouter'
    } else {
      provider = 'gemini'
    }
    model = modelOverride
  }

  switch (provider) {
    case 'xai':
      addXai(providers, env, system, user, model)
      break
    case 'gemini':
      addGemini(providers, env, system, user, model)
      break
    case 'openai':
      addOpenAi(providers, env, system, user, model)
      break
    case 'deepseek':
      addDeepSeek(providers, env, system, user, model)
      break
    case 'anthropic':
      addAnthropic(providers, env, system, user, model)
      break
    case 'openrouter':
      addOpenRouter(providers, env, system, user, model)
      break
    case 'groq':
      addGroq(providers, env, system, user, model)
      break
    default:
      // Prefijo desconocido → Gemini como fallback
      addGemini(providers, env, system, user, GEMINI_DEFAULT_MODEL)
  }

  // Si el provider principal no es Gemini, agrega Gemini como fallback
  if (provider !== 'gemini') {
    addGemini(providers, env, system, user, GEMINI_DEFAULT_MODEL)
  }

  return providers
}

// xAI (Grok) — API compatible con el formato OpenAI, mismo helper que
// OpenAI/Groq/DeepSeek. Base URL propia: https://api.x.ai/v1.
function addXai(providers: Provider[], env: Env, system: string, user: string, model: string) {
  if (!env.XAI_KEY) return
  providers.push({
    name: 'xai',
    call: (s) => completeOpenAi('https://api.x.ai/v1', env.XAI_KEY!, model, system, user, s),
  })
}

function addOpenRouter(providers: Provider[], env: Env, system: string, user: string, model: string) {
  if (!env.OPENROUTER_KEY) return
  providers.push({
    name: 'openrouter',
    call: (s) => completeOpenAi('https://openrouter.ai/api/v1', env.OPENROUTER_KEY!, model, system, user, s),
  })
}

function addGroq(providers: Provider[], env: Env, system: string, user: string, model: string) {
  if (!env.GROQ_KEY) return
  providers.push({
    name: 'groq',
    call: (s) => completeOpenAi('https://api.groq.com/openai/v1', env.GROQ_KEY!, model, system, user, s),
  })
}

function addOpenAi(providers: Provider[], env: Env, system: string, user: string, model: string) {
  if (!env.OPENAI_KEY) return
  providers.push({
    name: 'openai',
    call: (s) => completeOpenAi('https://api.openai.com/v1', env.OPENAI_KEY!, model, system, user, s),
  })
}

function addDeepSeek(providers: Provider[], env: Env, system: string, user: string, model: string) {
  if (!env.DEEPSEEK_KEY) return
  providers.push({
    name: 'deepseek',
    call: (s) => completeOpenAi('https://api.deepseek.com/v1', env.DEEPSEEK_KEY!, model, system, user, s),
  })
}

function addAnthropic(providers: Provider[], env: Env, system: string, user: string, model: string) {
  if (!env.ANTHROPIC_KEY) return
  providers.push({
    name: 'anthropic',
    call: (s) => completeAnthropic(env.ANTHROPIC_KEY!, model, system, user, s),
  })
}

function addGemini(providers: Provider[], env: Env, system: string, user: string, model: string) {
  if (!env.GEMINI_KEY) return
  providers.push({
    name: 'gemini',
    call: (s) => completeGemini(env.GEMINI_KEY!, model, system, user, s),
  })
}

export async function generateWithFallback(
  env: Env,
  system: string,
  user: string,
  modelOverride?: string,
): Promise<string | null> {
  const providers = buildProviders(env, system, user, modelOverride)
  if (providers.length === 0) return null

  for (const p of providers) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const text = await p.call(controller.signal)
      clearTimeout(timer)
      if (text) return text
    } catch (e) {
      clearTimeout(timer)
      console.error(`[LLM] Proveedor ${p.name} falló:`, (e as Error).message)
    }
  }
  return null
}

import type { ToolDefinition } from './types'
import type { Env } from '../models/types'

// ─── HELPERS ───

function str(description: string): Record<string, unknown> {
  return { type: 'string', description }
}
function num(description: string): Record<string, unknown> {
  return { type: 'number', description }
}
function bool(description: string): Record<string, unknown> {
  return { type: 'boolean', description }
}
function arr(items: Record<string, unknown>, description: string): Record<string, unknown> {
  return { type: 'array', items, description }
}
function obj(properties: Record<string, unknown>, required: string[] = []): Record<string, unknown> {
  return { type: 'object', properties, required }
}

// ─── FILESYSTEM TOOLS ───

const filesystemTools: ToolDefinition[] = [
  {
    name: 'read_file',
    description: 'Lee el contenido de un archivo. Usa encoding UTF-8.',
    category: 'filesystem',
    localOnly: true,
    parameters: obj({ path: str('Ruta absoluta o relativa al archivo') }, ['path']),
    async execute(args) {
      return { success: false, data: null, error: 'Requiere Agent Executor local' }
    },
  },
  {
    name: 'write_file',
    description: 'Escribe contenido en un archivo. Si no existe, lo crea. Si existe, lo sobrescribe.',
    category: 'filesystem',
    localOnly: true,
    parameters: obj({
      path: str('Ruta absoluta o relativa al archivo'),
      content: str('Contenido a escribir'),
    }, ['path', 'content']),
    async execute(args) {
      return { success: false, data: null, error: 'Requiere Agent Executor local' }
    },
  },
  {
    name: 'edit_file',
    description: 'Busca y reemplaza texto exacto en un archivo. Útil para modificar archivos grandes sin reescribirlos enteros.',
    category: 'filesystem',
    localOnly: true,
    parameters: obj({
      path: str('Ruta al archivo'),
      old_string: str('Texto exacto a buscar (debe ser único en el archivo)'),
      new_string: str('Texto de reemplazo'),
    }, ['path', 'old_string', 'new_string']),
    async execute(args) {
      return { success: false, data: null, error: 'Requiere Agent Executor local' }
    },
  },
  {
    name: 'delete_file',
    description: 'Elimina un archivo.',
    category: 'filesystem',
    localOnly: true,
    parameters: obj({ path: str('Ruta al archivo a eliminar') }, ['path']),
    async execute(args) {
      return { success: false, data: null, error: 'Requiere Agent Executor local' }
    },
  },
  {
    name: 'list_directory',
    description: 'Lista archivos y directorios en una ruta.',
    category: 'filesystem',
    localOnly: true,
    parameters: obj({
      path: str('Ruta del directorio'),
      recursive: bool('Si es true, lista recursivamente subdirectorios'),
    }, ['path']),
    async execute(args) {
      return { success: false, data: null, error: 'Requiere Agent Executor local' }
    },
  },
  {
    name: 'glob',
    description: 'Busca archivos por patrón glob (ej: "**/*.ts", "src/**/*.md").',
    category: 'filesystem',
    localOnly: true,
    parameters: obj({
      pattern: str('Patrón glob para buscar archivos'),
      path: str('Directorio base (opcional, por defecto el actual)'),
    }, ['pattern']),
    async execute(args) {
      return { success: false, data: null, error: 'Requiere Agent Executor local' }
    },
  },
  {
    name: 'grep',
    description: 'Busca contenido en archivos usando una expresión regular.',
    category: 'filesystem',
    localOnly: true,
    parameters: obj({
      pattern: str('Expresión regular a buscar'),
      include: str('Patrón de archivo para filtrar (ej: "*.ts", "*.md")'),
      path: str('Directorio donde buscar (opcional)'),
    }, ['pattern']),
    async execute(args) {
      return { success: false, data: null, error: 'Requiere Agent Executor local' }
    },
  },
]

// ─── OBSIDIAN TOOLS ───

const obsidianTools: ToolDefinition[] = [
  {
    name: 'obsidian_create_note',
    description: 'Crea una nota en Obsidian con frontmatter YAML opcional.',
    category: 'obsidian',
    localOnly: true,
    parameters: obj({
      path: str('Ruta relativa dentro del vault (ej: "Proyectos/Mi nota.md")'),
      title: str('Título de la nota (se usa en frontmatter si no hay)'),
      content: str('Contenido en markdown de la nota'),
      tags: arr(str('Tag'), 'Lista de tags para frontmatter'),
      frontmatter: obj({}, 'Frontmatter adicional como objeto clave-valor'),
    }, ['path', 'content']),
    async execute(args) {
      return { success: false, data: null, error: 'Requiere Agent Executor local' }
    },
  },
  {
    name: 'obsidian_update_note',
    description: 'Actualiza una nota existente en Obsidian. Busca por ruta y reemplaza contenido completo o secciones específicas.',
    category: 'obsidian',
    localOnly: true,
    parameters: obj({
      path: str('Ruta relativa dentro del vault'),
      content: str('Nuevo contenido markdown (opcional si solo se actualiza frontmatter)'),
      frontmatter: obj({}, 'Frontmatter a fusionar (reemplaza campos existentes)'),
      append: bool('Si es true, añade al final en vez de reemplazar'),
      section: str('Si se especifica, reemplaza solo el contenido después de este encabezado (ej: "## Notas")'),
    }, ['path']),
    async execute(args) {
      return { success: false, data: null, error: 'Requiere Agent Executor local' }
    },
  },
  {
    name: 'obsidian_search',
    description: 'Busca notas en el vault por título, tag o contenido.',
    category: 'obsidian',
    localOnly: true,
    parameters: obj({
      query: str('Texto a buscar en contenido/título'),
      tag: str('Tag a buscar (ej: "proyecto/activo")'),
      path: str('Subdirectorio para limitar búsqueda (opcional)'),
      limit: num('Máximo de resultados (opcional, default 20)'),
    }, []),
    async execute(args) {
      return { success: false, data: null, error: 'Requiere Agent Executor local' }
    },
  },
  {
    name: 'obsidian_get_graph',
    description: 'Obtiene las conexiones (enlaces salientes y entrantes) de una nota.',
    category: 'obsidian',
    localOnly: true,
    parameters: obj({
      path: str('Ruta de la nota para obtener su grafo de conexiones'),
    }, ['path']),
    async execute(args) {
      return { success: false, data: null, error: 'Requiere Agent Executor local' }
    },
  },
]

// ─── WEB SEARCH TOOLS ───

const webTools: ToolDefinition[] = [
  {
    name: 'web_search',
    description: 'Busca información actualizada en la web. Usa Google/Bing para obtener resultados recientes.',
    category: 'web',
    localOnly: false,
    parameters: obj({
      query: str('Términos de búsqueda'),
      max_results: num('Número máximo de resultados (opcional, default 5)'),
    }, ['query']),
    async execute(args, env?: Env) {
      try {
        const q = String(args.query || '')
        const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`
        const res = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GetawayAgentes/1.0)' },
        })
        const html = await res.text()
        // Extraer resultados de DuckDuckGo HTML
        const results: { title: string; snippet: string; url: string }[] = []
        const linkRegex = /<a[^>]+class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi
        const snippetRegex = /<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi
        let m: RegExpExecArray | null
        while ((m = linkRegex.exec(html)) !== null && results.length < Number(args.max_results || 5)) {
          const snippetMatch = snippetRegex.exec(html)
          results.push({
            url: m[1],
            title: m[2].replace(/<[^>]+>/g, '').trim(),
            snippet: snippetMatch ? snippetMatch[1].replace(/<[^>]+>/g, '').trim() : '',
          })
        }
        return { success: true, data: results }
      } catch (e) {
        return { success: false, data: null, error: (e as Error).message }
      }
    },
  },
  {
    name: 'web_fetch',
    description: 'Obtiene el contenido de una URL específica y lo devuelve como texto markdown.',
    category: 'web',
    localOnly: false,
    parameters: obj({
      url: str('URL completa a fetch (incluye https://)'),
    }, ['url']),
    async execute(args) {
      try {
        const res = await fetch(String(args.url), {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GetawayAgentes/1.0)' },
        })
        const text = await res.text()
        return { success: true, data: text.slice(0, 10000) }
      } catch (e) {
        return { success: false, data: null, error: (e as Error).message }
      }
    },
  },
]

// ─── GITHUB TOOLS ───

const githubTools: ToolDefinition[] = [
  {
    name: 'github_search_repos',
    description: 'Busca repositorios en GitHub por nombre, tema o lenguaje.',
    category: 'github',
    localOnly: false,
    parameters: obj({
      query: str('Términos de búsqueda (lenguaje:typescript, topic:ai, etc)'),
      max_results: num('Máximo de resultados (opcional, default 5)'),
    }, ['query']),
    async execute(args) {
      try {
        const q = String(args.query || '')
        const res = await fetch(`https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&per_page=${args.max_results || 5}`, {
          headers: { 'User-Agent': 'GetawayAgentes/1.0', Accept: 'application/vnd.github.v3+json' },
        })
        const data = await res.json()
        return { success: true, data }
      } catch (e) {
        return { success: false, data: null, error: (e as Error).message }
      }
    },
  },
  {
    name: 'github_get_repo',
    description: 'Obtiene información detallada de un repositorio de GitHub.',
    category: 'github',
    localOnly: false,
    parameters: obj({
      owner: str('Dueño del repositorio (usuario u organización)'),
      repo: str('Nombre del repositorio'),
    }, ['owner', 'repo']),
    async execute(args) {
      try {
        const res = await fetch(`https://api.github.com/repos/${args.owner}/${args.repo}`, {
          headers: { 'User-Agent': 'GetawayAgentes/1.0', Accept: 'application/vnd.github.v3+json' },
        })
        const data = await res.json()
        return { success: true, data }
      } catch (e) {
        return { success: false, data: null, error: (e as Error).message }
      }
    },
  },
  {
    name: 'github_search_code',
    description: 'Busca código en repositorios públicos de GitHub.',
    category: 'github',
    localOnly: false,
    parameters: obj({
      query: str('Código a buscar (ej: "function foo" language:typescript repo:user/repo)'),
      max_results: num('Máximo de resultados (opcional, default 5)'),
    }, ['query']),
    async execute(args) {
      try {
        const res = await fetch(`https://api.github.com/search/code?q=${encodeURIComponent(String(args.query || ''))}&per_page=${args.max_results || 5}`, {
          headers: { 'User-Agent': 'GetawayAgentes/1.0', Accept: 'application/vnd.github.v3+json' },
        })
        const data = await res.json()
        return { success: true, data }
      } catch (e) {
        return { success: false, data: null, error: (e as Error).message }
      }
    },
  },
  {
    name: 'github_list_issues',
    description: 'Lista issues de un repositorio con filtros opcionales.',
    category: 'github',
    localOnly: false,
    parameters: obj({
      owner: str('Dueño del repositorio'),
      repo: str('Nombre del repositorio'),
      state: str('Estado: open, closed, all (opcional, default open)'),
      label: str('Filtrar por label (opcional)'),
      max_results: num('Máximo de resultados (opcional, default 10)'),
    }, ['owner', 'repo']),
    async execute(args) {
      try {
        let url = `https://api.github.com/repos/${args.owner}/${args.repo}/issues?state=${args.state || 'open'}&per_page=${args.max_results || 10}`
        if (args.label) url += `&labels=${encodeURIComponent(String(args.label))}`
        const res = await fetch(url, {
          headers: { 'User-Agent': 'GetawayAgentes/1.0', Accept: 'application/vnd.github.v3+json' },
        })
        const data = await res.json()
        return { success: true, data }
      } catch (e) {
        return { success: false, data: null, error: (e as Error).message }
      }
    },
  },
  {
    name: 'github_create_issue',
    description: 'Crea un issue en un repositorio de GitHub.',
    category: 'github',
    localOnly: false,
    parameters: obj({
      owner: str('Dueño del repositorio'),
      repo: str('Nombre del repositorio'),
      title: str('Título del issue'),
      body: str('Cuerpo/descripción del issue'),
      labels: arr(str('Label'), 'Labels a asignar (opcional)'),
    }, ['owner', 'repo', 'title']),
    async execute(args) {
      return { success: false, data: null, error: 'Se requiere token de GitHub. Configúralo en el Agent Executor local.' }
    },
  },
]

// ─── SHELL TOOLS ───

const shellTools: ToolDefinition[] = [
  {
    name: 'run_command',
    description: 'Ejecuta un comando en la terminal/consola de Windows (PowerShell). Devuelve stdout, stderr y código de salida.',
    category: 'shell',
    localOnly: true,
    parameters: obj({
      command: str('Comando PowerShell a ejecutar'),
      workdir: str('Directorio de trabajo (opcional, por defecto el actual)'),
      timeout_ms: num('Timeout en milisegundos (opcional, default 30000)'),
    }, ['command']),
    async execute(args) {
      return { success: false, data: null, error: 'Requiere Agent Executor local' }
    },
  },
  {
    name: 'run_node_script',
    description: 'Ejecuta un script Node.js directamente. Útil para operaciones programáticas complejas.',
    category: 'shell',
    localOnly: true,
    parameters: obj({
      code: str('Código JavaScript/TypeScript a ejecutar'),
      workdir: str('Directorio de trabajo (opcional)'),
    }, ['code']),
    async execute(args) {
      return { success: false, data: null, error: 'Requiere Agent Executor local' }
    },
  },
]

// ─── BROWSER TOOLS ───

const browserTools: ToolDefinition[] = [
  {
    name: 'browser_navigate',
    description: 'Navega a una URL en el navegador Chrome. Devuelve el título y contenido de la página.',
    category: 'browser',
    localOnly: true,
    parameters: obj({
      url: str('URL completa a navegar'),
    }, ['url']),
    async execute(args) {
      return { success: false, data: null, error: 'Requiere Agent Executor local con Puppeteer/Playwright' }
    },
  },
  {
    name: 'browser_click',
    description: 'Hace clic en un elemento de la página identificado por selector CSS.',
    category: 'browser',
    localOnly: true,
    parameters: obj({
      selector: str('Selector CSS del elemento a clickear'),
      index: num('Índice si hay múltiples coincidencias (opcional, default 0)'),
    }, ['selector']),
    async execute(args) {
      return { success: false, data: null, error: 'Requiere Agent Executor local con Puppeteer/Playwright' }
    },
  },
  {
    name: 'browser_type',
    description: 'Escribe texto en un campo de la página.',
    category: 'browser',
    localOnly: true,
    parameters: obj({
      selector: str('Selector CSS del campo'),
      text: str('Texto a escribir'),
    }, ['selector', 'text']),
    async execute(args) {
      return { success: false, data: null, error: 'Requiere Agent Executor local con Puppeteer/Playwright' }
    },
  },
  {
    name: 'browser_screenshot',
    description: 'Toma una captura de pantalla de la página actual.',
    category: 'browser',
    localOnly: true,
    parameters: obj({
      full_page: bool('Capturar página completa (opcional, default false)'),
      output_path: str('Ruta para guardar la imagen (opcional)'),
    }, []),
    async execute(args) {
      return { success: false, data: null, error: 'Requiere Agent Executor local con Puppeteer/Playwright' }
    },
  },
  {
    name: 'browser_evaluate',
    description: 'Ejecuta JavaScript en el contexto de la página actual.',
    category: 'browser',
    localOnly: true,
    parameters: obj({
      code: str('Código JavaScript a ejecutar en el navegador'),
    }, ['code']),
    async execute(args) {
      return { success: false, data: null, error: 'Requiere Agent Executor local con Puppeteer/Playwright' }
    },
  },
]

// ─── DATABASE TOOLS ───

const databaseTools: ToolDefinition[] = [
  {
    name: 'db_query',
    description: 'Ejecuta una consulta SELECT en la base de datos (D1/SQLite). Solo consultas de solo lectura.',
    category: 'database',
    localOnly: false,
    parameters: obj({
      sql: str('Consulta SQL SELECT'),
      params: arr(str('Valor'), 'Parámetros para la consulta (opcional)'),
    }, ['sql']),
    async execute(args, env?: Env) {
      if (!env) return { success: false, data: null, error: 'No hay binding de DB' }
      try {
        const stmt = env.DB.prepare(String(args.sql))
        const params = (args.params as string[]) || []
        const bound = stmt.bind(...params)
        const { results } = await bound.all()
        return { success: true, data: results }
      } catch (e) {
        return { success: false, data: null, error: (e as Error).message }
      }
    },
  },
  {
    name: 'db_execute',
    description: 'Ejecuta una sentencia SQL de escritura (INSERT, UPDATE, DELETE). Usar con precaución.',
    category: 'database',
    localOnly: false,
    parameters: obj({
      sql: str('Sentencia SQL (INSERT/UPDATE/DELETE)'),
      params: arr(str('Valor'), 'Parámetros para la sentencia (opcional)'),
    }, ['sql']),
    async execute(args, env?: Env) {
      if (!env) return { success: false, data: null, error: 'No hay binding de DB' }
      try {
        const stmt = env.DB.prepare(String(args.sql))
        const params = (args.params as string[]) || []
        const bound = stmt.bind(...params)
        const result = await bound.run()
        return { success: true, data: result }
      } catch (e) {
        return { success: false, data: null, error: (e as Error).message }
      }
    },
  },
]

// ─── ASSEMBLY ───

export const ALL_TOOLS: ToolDefinition[] = [
  ...filesystemTools,
  ...obsidianTools,
  ...webTools,
  ...githubTools,
  ...shellTools,
  ...browserTools,
  ...databaseTools,
]

export const CLOUD_TOOLS = ALL_TOOLS.filter(t => !t.localOnly)
export const LOCAL_TOOLS = ALL_TOOLS.filter(t => t.localOnly)

// Agrupa tools por categoría para los prompts de los agentes
export function getToolsForAgent(agentId: string, includeLocal = false): ToolDefinition[] {
  const base = [...CLOUD_TOOLS]
  if (includeLocal) base.push(...LOCAL_TOOLS)
  return base
}

// Descripción de tools lista para incluir en prompts del sistema
export function toolsPrompt(tools: ToolDefinition[]): string {
  if (tools.length === 0) return ''
  const lines = tools.map(t => {
    const params = Object.keys((t.parameters as any)?.properties || {}).join(', ')
    return `  - ${t.name}(${params}): ${t.description}${t.localOnly ? ' (requiere Agent Executor local)' : ''}`
  })
  return `\nHERRAMIENTAS DISPONIBLES:\n${lines.join('\n')}`
}

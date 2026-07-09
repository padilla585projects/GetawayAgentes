import { Env } from '../models/types'

// Lightweight MCP server for Cloudflare Workers
// Implements MCP protocol (JSON-RPC 2.0 over HTTP) without heavy SDK dependencies

interface McpRequest {
  jsonrpc: '2.0'
  id?: string | number
  method: string
  params?: Record<string, unknown>
}

interface McpResponse {
  jsonrpc: '2.0'
  id: string | number | null
  result?: unknown
  error?: { code: number; message: string; data?: unknown }
}

const SERVER_INFO = {
  name: 'getaway-agentes-gateway',
  version: '1.0.0',
}

const CAPABILITIES = {
  tools: { listChanged: false },
  resources: { subscribe: false, listChanged: false },
}

// Tool definitions
const TOOLS = [
  {
    name: 'list_agents',
    description: 'List all agents in the network with their status, capabilities, and trust level',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'get_agent',
    description: 'Get detailed information about a specific agent',
    inputSchema: {
      type: 'object' as const,
      properties: {
        agent_id: { type: 'string', description: 'The agent ID' },
      },
      required: ['agent_id'],
    },
  },
  {
    name: 'create_task',
    description: 'Create and dispatch a task to agents. Use mode "collaborative" for multi-agent collaboration, "broadcast" for all agents, or "targeted" for specific agents.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Task title' },
        description: { type: 'string', description: 'Task description' },
        mode: { type: 'string', enum: ['broadcast', 'targeted', 'auto', 'collaborative'], description: 'Task dispatch mode' },
        priority: { type: 'number', description: 'Priority 1-10 (default: 5)' },
        assigned_agents: { type: 'array', items: { type: 'string' }, description: 'Agent IDs for targeted mode' },
        context: { type: 'object', description: 'Additional context for the task' },
      },
      required: ['title', 'description'],
    },
  },
  {
    name: 'get_task',
    description: 'Get task details including messages and subtask results',
    inputSchema: {
      type: 'object' as const,
      properties: {
        task_id: { type: 'string', description: 'The task ID' },
      },
      required: ['task_id'],
    },
  },
  {
    name: 'list_tasks',
    description: 'List all tasks with their status',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'search_knowledge',
    description: 'Search the shared knowledge base',
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Search query' },
        category: { type: 'string', description: 'Filter by category' },
        capabilities: { type: 'string', description: 'Comma-separated capabilities to filter by tags' },
      },
    },
  },
  {
    name: 'add_knowledge',
    description: 'Add an entry to the shared knowledge base',
    inputSchema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Knowledge entry title' },
        content: { type: 'string', description: 'Knowledge content' },
        category: { type: 'string', description: 'Category (default: general)' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Tags for searchability' },
        visibility: { type: 'string', enum: ['public', 'trusted', 'private'], description: 'Visibility level' },
      },
      required: ['title', 'content'],
    },
  },
  {
    name: 'get_network_status',
    description: 'Get overall network status: online agents, active tasks, knowledge count',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
]

// Resource definitions
const RESOURCES = [
  {
    uri: 'getaway://network/status',
    name: 'Network Status',
    description: 'Real-time status of the agent network',
    mimeType: 'application/json',
  },
  {
    uri: 'getaway://agents/list',
    name: 'Agents List',
    description: 'All registered agents',
    mimeType: 'application/json',
  },
  {
    uri: 'getaway://tasks/list',
    name: 'Tasks List',
    description: 'All tasks',
    mimeType: 'application/json',
  },
  {
    uri: 'getaway://knowledge/list',
    name: 'Knowledge Base',
    description: 'Shared knowledge entries',
    mimeType: 'application/json',
  },
]

async function handleToolCall(name: string, args: Record<string, unknown>, env: Env): Promise<unknown> {
  const BASE = 'http://localhost:8787' // Internal fetch

  switch (name) {
    case 'list_agents': {
      const res = await env.DB.prepare(`
        SELECT id, name, description, capabilities, status, trust_level, version, max_concurrent_tasks
        FROM agents ORDER BY created_at DESC
      `).all()
      return res.results.map(a => ({
        ...a,
        capabilities: JSON.parse(a.capabilities as string || '[]'),
      }))
    }

    case 'get_agent': {
      const agent = await env.DB.prepare('SELECT * FROM agents WHERE id = ?').bind(args.agent_id).first()
      if (!agent) return { error: 'Agent not found' }
      return { ...agent, capabilities: JSON.parse(agent.capabilities as string || '[]'), metadata: JSON.parse(agent.metadata as string || '{}') }
    }

    case 'create_task': {
      const { nanoid } = await import('../services/utils')
      const id = nanoid()
      const mode = args.mode || 'auto'

      await env.DB.prepare(`
        INSERT INTO tasks (id, title, description, mode, priority, assigned_agents, context)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id,
        args.title,
        args.description,
        mode,
        args.priority || 5,
        JSON.stringify(args.assigned_agents || []),
        JSON.stringify(args.context || {}),
      ).run()

      // Dispatch via hub
      const hub = env.GATEWAY_HUB.get(env.GATEWAY_HUB.idFromName('main'))

      if (mode === 'collaborative') {
        const onlineRes = await hub.fetch('http://internal/online-agents')
        const onlineAgents = await onlineRes.json() as Array<{ id: string; name: string; capabilities: string[] }>

        const subtasks = onlineAgents.map(agent => ({
          id: nanoid(),
          task_id: id,
          agent_id: agent.id,
          agent_name: agent.name,
          description: `Contribuye con tus capacidades [${agent.capabilities.join(', ')}] a: ${args.title}. ${args.description}`,
          status: 'pending',
          created_at: new Date().toISOString(),
        }))

        await env.DB.prepare(`UPDATE tasks SET status = 'collaborating', assigned_agents = ?, context = ?, updated_at = datetime('now') WHERE id = ?`).bind(
          JSON.stringify(onlineAgents.map(a => a.id)),
          JSON.stringify({ subtasks: subtasks.map((s: any) => ({ id: s.id, agent_id: s.agent_id, agent_name: s.agent_name, description: s.description })) }),
          id,
        ).run()

        await hub.fetch('http://internal/orchestrate', {
          method: 'POST',
          body: JSON.stringify({ task: { id, title: args.title, description: args.description, priority: args.priority || 5, context: args.context || {} }, subtasks }),
        })
      } else if (mode === 'broadcast' || mode === 'auto') {
        await hub.fetch('http://internal/broadcast-agents', {
          method: 'POST',
          body: JSON.stringify({ type: 'task_assigned', task_id: id, title: args.title, description: args.description, priority: args.priority || 5, context: args.context || {} }),
        })
        await env.DB.prepare(`UPDATE tasks SET status = 'assigned', updated_at = datetime('now') WHERE id = ?`).bind(id).run()
      } else if (mode === 'targeted' && args.assigned_agents) {
        for (const agentId of args.assigned_agents as string[]) {
          await hub.fetch('http://internal/send-agent', {
            method: 'POST',
            body: JSON.stringify({ agent_id: agentId, message: { type: 'task_assigned', task_id: id, title: args.title, description: args.description, priority: args.priority || 5, context: args.context || {} } }),
          })
        }
        await env.DB.prepare(`UPDATE tasks SET status = 'assigned', updated_at = datetime('now') WHERE id = ?`).bind(id).run()
      }

      return { task_id: id, mode, message: 'Task created and dispatched' }
    }

    case 'get_task': {
      const task = await env.DB.prepare('SELECT * FROM tasks WHERE id = ?').bind(args.task_id).first()
      if (!task) return { error: 'Task not found' }
      const { results: messages } = await env.DB.prepare('SELECT * FROM task_messages WHERE task_id = ? ORDER BY created_at ASC').bind(args.task_id).all()
      return {
        ...task,
        assigned_agents: JSON.parse(task.assigned_agents as string || '[]'),
        result: JSON.parse(task.result as string || '{}'),
        context: JSON.parse(task.context as string || '{}'),
        messages,
      }
    }

    case 'list_tasks': {
      const { results } = await env.DB.prepare(`
        SELECT id, title, status, mode, priority, assigned_agents, created_at, completed_at
        FROM tasks ORDER BY created_at DESC LIMIT 50
      `).all()
      return results.map(t => ({ ...t, assigned_agents: JSON.parse(t.assigned_agents as string || '[]') }))
    }

    case 'search_knowledge': {
      let query = `SELECT * FROM knowledge_entries WHERE visibility IN ('public', 'trusted')`
      const params: string[] = []

      if (args.query) {
        query += ` AND (title LIKE ? OR content LIKE ? OR tags LIKE ?)`
        const term = `%${args.query}%`
        params.push(term, term, term)
      }
      if (args.category) {
        query += ` AND category = ?`
        params.push(args.category as string)
      }
      if (args.capabilities) {
        const caps = (args.capabilities as string).split(',')
        const conditions = caps.map(() => `tags LIKE ?`).join(' OR ')
        query += ` AND (${conditions})`
        caps.forEach(cap => params.push(`%${cap.trim()}%`))
      }

      query += ` ORDER BY relevance_score DESC, times_used DESC LIMIT 20`
      const { results } = await env.DB.prepare(query).bind(...params).all()
      return results.map(k => ({ ...k, tags: JSON.parse(k.tags as string || '[]') }))
    }

    case 'add_knowledge': {
      const { nanoid } = await import('../services/utils')
      const id = nanoid()
      await env.DB.prepare(`
        INSERT INTO knowledge_entries (id, title, content, category, tags, visibility)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        id, args.title, args.description || args.content, args.category || 'general',
        JSON.stringify(args.tags || []), args.visibility || 'public',
      ).run()
      return { id, message: 'Knowledge entry added' }
    }

    case 'get_network_status': {
      const agents = await env.DB.prepare('SELECT status, COUNT(*) as count FROM agents GROUP BY status').all()
      const tasks = await env.DB.prepare('SELECT status, COUNT(*) as count FROM tasks GROUP BY status').all()
      const knowledge = await env.DB.prepare('SELECT COUNT(*) as count FROM knowledge_entries').first()

      // Get online agents from hub
      let onlineCount = 0
      try {
        const hub = env.GATEWAY_HUB.get(env.GATEWAY_HUB.idFromName('main'))
        const onlineRes = await hub.fetch('http://internal/online-agents')
        const online = await onlineRes.json() as Array<{ id: string }>
        onlineCount = online.length
      } catch {}

      return {
        agents: { online: onlineCount, by_status: agents.results },
        tasks: { by_status: tasks.results },
        knowledge: { total: knowledge?.count || 0 },
      }
    }

    default:
      return { error: `Unknown tool: ${name}` }
  }
}

async function handleResourceRead(uri: string, env: Env): Promise<{ contents: Array<{ uri: string; mimeType: string; text: string }> }> {
  switch (uri) {
    case 'getaway://network/status': {
      const status = await handleToolCall('get_network_status', {}, env)
      return { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(status, null, 2) }] }
    }
    case 'getaway://agents/list': {
      const agents = await handleToolCall('list_agents', {}, env)
      return { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(agents, null, 2) }] }
    }
    case 'getaway://tasks/list': {
      const tasks = await handleToolCall('list_tasks', {}, env)
      return { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(tasks, null, 2) }] }
    }
    case 'getaway://knowledge/list': {
      const { results } = await env.DB.prepare('SELECT * FROM knowledge_entries ORDER BY created_at DESC LIMIT 50').all()
      return { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(results.map(k => ({ ...k, tags: JSON.parse(k.tags as string || '[]') })), null, 2) }] }
    }
    default:
      throw new Error(`Unknown resource: ${uri}`)
  }
}

export async function handleMcpRequest(request: Request, env: Env): Promise<Response> {
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  try {
    const body = await request.json() as McpRequest
    let response: McpResponse

    switch (body.method) {
      case 'initialize':
        response = {
          jsonrpc: '2.0',
          id: body.id ?? null,
          result: {
            protocolVersion: '2025-03-26',
            capabilities: CAPABILITIES,
            serverInfo: SERVER_INFO,
          },
        }
        break

      case 'notifications/initialized':
        // Client notification, no response needed
        return new Response(null, { status: 200 })

      case 'tools/list':
        response = {
          jsonrpc: '2.0',
          id: body.id ?? null,
          result: { tools: TOOLS },
        }
        break

      case 'tools/call': {
        const { name, arguments: args } = body.params as { name: string; arguments: Record<string, unknown> }
        try {
          const result = await handleToolCall(name, args || {}, env)
          response = {
            jsonrpc: '2.0',
            id: body.id ?? null,
            result: {
              content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
              isError: false,
            },
          }
        } catch (err: any) {
          response = {
            jsonrpc: '2.0',
            id: body.id ?? null,
            result: {
              content: [{ type: 'text', text: `Error: ${err.message}` }],
              isError: true,
            },
          }
        }
        break
      }

      case 'resources/list':
        response = {
          jsonrpc: '2.0',
          id: body.id ?? null,
          result: { resources: RESOURCES },
        }
        break

      case 'resources/read': {
        const { uri } = body.params as { uri: string }
        try {
          const result = await handleResourceRead(uri, env)
          response = {
            jsonrpc: '2.0',
            id: body.id ?? null,
            result,
          }
        } catch (err: any) {
          response = {
            jsonrpc: '2.0',
            id: body.id ?? null,
            error: { code: -32001, message: err.message },
          }
        }
        break
      }

      case 'ping':
        response = { jsonrpc: '2.0', id: body.id ?? null, result: {} }
        break

      default:
        response = {
          jsonrpc: '2.0',
          id: body.id ?? null,
          error: { code: -32601, message: `Method not found: ${body.method}` },
        }
    }

    return new Response(JSON.stringify(response), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32700, message: 'Parse error' },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  }
}

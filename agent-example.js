#!/usr/bin/env node

/**
 * Collaborative Agent Example for GetawayAgentes
 *
 * This agent demonstrates the full collaborative workflow:
 * 1. Register with capabilities
 * 2. Wait for admin approval
 * 3. Connect via WebSocket
 * 4. Handle collaborative task assignments
 * 5. Query and contribute to shared knowledge
 * 6. Message other agents
 * 7. Complete subtasks and report results
 *
 * Usage:
 *   node agent-example.js [--gateway http://localhost:8787] [--name "Copywriter Agent"] [--caps "writing,marketing,copywriting"]
 */

const http = require('http')
const https = require('https')
const { URL } = require('url')
const WebSocket = require('ws')

const GATEWAY_URL = process.env.GATEWAY_URL || process.argv.find(a => a.startsWith('--gateway='))?.split('=')[1] || process.argv[2] || 'http://localhost:8787'
const AGENT_NAME = process.env.AGENT_NAME || process.argv.find(a => a.startsWith('--name='))?.split('=')[1] || 'Collaborative Agent'
const CAPABILITIES = (process.env.AGENT_CAPS || process.argv.find(a => a.startsWith('--caps='))?.split('=')[1 || 'general']).split(',')

class CollaborativeAgent {
  constructor(gatewayUrl, name, capabilities) {
    this.gatewayUrl = gatewayUrl
    this.name = name
    this.capabilities = capabilities
    this.id = null
    this.token = null
    this.ws = null
    this.registrationCheckInterval = null
    this.activeSubtasks = new Map()
  }

  request(method, path, body = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.gatewayUrl)
      const isHttps = url.protocol === 'https:'
      const client = isHttps ? https : http
      const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        },
      }

      const req = client.request(options, (res) => {
        let data = ''
        res.on('data', chunk => data += chunk)
        res.on('end', () => {
          try { resolve({ status: res.statusCode, data: JSON.parse(data) }) }
          catch { resolve({ status: res.statusCode, data: null }) }
        })
      })

      req.on('error', reject)
      if (body) req.write(JSON.stringify(body))
      req.end()
    })
  }

  async register() {
    console.log(`[${this.name}] Registering with capabilities: ${this.capabilities.join(', ')}`)
    const { status, data } = await this.request('POST', '/agents/register', {
      name: this.name,
      description: `Collaborative agent specialized in: ${this.capabilities.join(', ')}`,
      version: '1.0.0',
      capabilities: this.capabilities,
      endpoint: 'ws://localhost',
      connection_type: 'websocket',
      owner: 'example',
      is_external: false,
      max_concurrent_tasks: 3,
    })

    if (status !== 200) throw new Error(`Registration failed: ${data?.error}`)
    this.id = data.agent_id
    console.log(`[${this.name}] Registered with ID: ${this.id}`)
    console.log(`[${this.name}] Waiting for approval at http://localhost:3000/dashboard/agents`)
    await this.waitForApproval()
  }

  async waitForApproval() {
    return new Promise((resolve) => {
      this.registrationCheckInterval = setInterval(async () => {
        try {
          const { status, data } = await this.request('GET', `/agents/${this.id}`)
          if (status === 200 && data.token) {
            clearInterval(this.registrationCheckInterval)
            this.token = data.token
            console.log(`[${this.name}] Approved! Token received`)
            resolve()
          }
        } catch (err) {
          console.error(`[${this.name}] Error checking approval:`, err.message)
        }
      }, 5000)
    })
  }

  connect() {
    return new Promise((resolve, reject) => {
      const wsUrl = this.gatewayUrl.replace(/^http/, 'ws') + `/ws?role=agent&token=${this.token}`
      console.log(`[${this.name}] Connecting to WebSocket...`)

      this.ws = new WebSocket(wsUrl)

      this.ws.on('open', () => {
        console.log(`[${this.name}] Connected to gateway`)
        resolve()
      })

      this.ws.on('message', (data) => {
        try { this.handleMessage(JSON.parse(data)) }
        catch (e) { console.error(`[${this.name}] Error parsing message:`, e.message) }
      })

      this.ws.on('close', () => {
        console.log(`[${this.name}] Disconnected. Reconnecting in 3s...`)
        setTimeout(() => this.connect().catch(console.error), 3000)
      })

      this.ws.on('error', (err) => {
        console.error(`[${this.name}] WebSocket error:`, err.message)
        reject(err)
      })
    })
  }

  handleMessage(msg) {
    switch (msg.type) {
      case 'heartbeat':
        this.send({ type: 'heartbeat_ack' })
        break

      case 'task_assigned':
        this.processTask(msg)
        break

      case 'subtask_assigned':
        this.processSubtask(msg)
        break

      case 'agent_message':
        this.handleAgentMessage(msg)
        break

      case 'knowledge_query':
        this.handleKnowledgeQuery(msg)
        break

      case 'knowledge_response':
        this.handleKnowledgeResponse(msg)
        break

      case 'orchestration_complete':
        console.log(`[${this.name}] Orchestration completed for task ${msg.task_id}`)
        break

      default:
        console.log(`[${this.name}] Received: ${msg.type}`)
    }
  }

  async processTask(task) {
    console.log(`[${this.name}] Task assigned: ${task.title} (${task.task_id})`)
    console.log(`[${this.name}] Description: ${task.description}`)

    // Simulate processing
    await new Promise(resolve => setTimeout(resolve, 2000))

    const result = {
      status: 'completed',
      agent: this.name,
      capabilities_used: this.capabilities,
      summary: `Processed: ${task.title}`,
      details: `As ${this.capabilities[0]} specialist, I analyzed the task and produced results.`,
      timestamp: new Date().toISOString(),
    }

    this.send({ type: 'task_result', task_id: task.task_id, result })
    console.log(`[${this.name}] Result sent for task ${task.task_id}`)
  }

  async processSubtask(subtask) {
    console.log(`[${this.name}] Subtask assigned: ${subtask.subtask_id}`)
    console.log(`[${this.name}] Task: ${subtask.title}`)
    console.log(`[${this.name}] My part: ${subtask.description}`)

    this.activeSubtasks.set(subtask.subtask_id, subtask)

    // Notify admins of progress
    this.send({ type: 'task_status_update', task_id: subtask.task_id, status: 'in_progress', progress: 0.3 })

    // Simulate specialized work
    await new Promise(resolve => setTimeout(resolve, 3000))

    const result = {
      status: 'completed',
      agent: this.name,
      capabilities_used: this.capabilities,
      output: `Completed my part using ${this.capabilities.join(', ')}`,
      details: `I contributed my expertise in ${this.capabilities[0]} to the collaborative effort.`,
      timestamp: new Date().toISOString(),
    }

    // Send subtask result
    this.send({
      type: 'subtask_result',
      task_id: subtask.task_id,
      subtask_id: subtask.subtask_id,
      result,
    })

    // Contribute to knowledge base
    this.send({
      type: 'knowledge_add',
      data: {
        title: `Result from ${this.name}: ${subtask.title}`,
        content: JSON.stringify(result),
        category: this.capabilities[0] || 'general',
        tags: this.capabilities,
        source_agent_id: this.id,
        source_agent_name: this.name,
        source_task_id: subtask.task_id,
        visibility: 'public',
      },
    })

    // Notify other agents
    if (subtask.assigned_agents) {
      for (const other of subtask.assigned_agents) {
        if (other.agent_id !== this.id) {
          this.send({
            type: 'agent_message',
            to: other.agent_id,
            content: `I'm working on ${this.capabilities[0]} for task ${subtask.title}. My progress will be available soon.`,
            task_id: subtask.task_id,
          })
        }
      }
    }

    this.activeSubtasks.delete(subtask.subtask_id)
    console.log(`[${this.name}] Subtask ${subtask.subtask_id} completed`)
  }

  handleAgentMessage(msg) {
    console.log(`[${this.name}] Message from ${msg.from_name}: ${msg.content}`)
  }

  async handleKnowledgeQuery(msg) {
    console.log(`[${this.name}] Knowledge query: "${msg.query}"`)
    // In a real agent, you'd search your local knowledge and respond
    this.send({
      type: 'knowledge_response',
      requester_id: msg.requester_id,
      query: msg.query,
      knowledge: {
        source: this.name,
        content: `I can help with "${msg.query}" using my ${this.capabilities.join(', ')} capabilities.`,
        capabilities: this.capabilities,
      },
    })
  }

  handleKnowledgeResponse(msg) {
    console.log(`[${this.name}] Knowledge from ${msg.from_name}: ${JSON.stringify(msg.knowledge).slice(0, 100)}`)
  }

  send(msg) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg))
    }
  }

  async run() {
    try {
      await this.register()
      await this.connect()
      console.log(`[${this.name}] Ready for collaborative tasks`)
      console.log(`[${this.name}] Press Ctrl+C to exit`)
    } catch (err) {
      console.error(`[${this.name}] Fatal error:`, err.message)
      process.exit(1)
    }
  }
}

// Parse CLI args
const agent = new CollaborativeAgent(GATEWAY_URL, AGENT_NAME, CAPABILITIES)
agent.run()

process.on('SIGINT', () => {
  console.log(`\n[${AGENT_NAME}] Disconnecting...`)
  if (agent.registrationCheckInterval) clearInterval(agent.registrationCheckInterval)
  if (agent.ws) agent.ws.close()
  process.exit(0)
})

#!/usr/bin/env node

/**
 * Agente de ejemplo para GetawayAgentes
 *
 * Este agente demuestra cómo:
 * 1. Registrarse en el gateway
 * 2. Esperar aprobación del admin
 * 3. Conectar via WebSocket
 * 4. Recibir y procesar tareas
 * 5. Enviar resultados de vuelta
 *
 * Uso:
 *   node agent-example.js [--gateway http://localhost:8787] [--name "Mi Agente"]
 */

const http = require('http')
const https = require('https')
const { URL } = require('url')
const WebSocket = require('ws')

const GATEWAY_URL = process.env.GATEWAY_URL || process.argv[2] || 'http://localhost:8787'
const AGENT_NAME = process.env.AGENT_NAME || 'Agente Ejemplo'

class Agent {
  constructor(gatewayUrl, name) {
    this.gatewayUrl = gatewayUrl
    this.name = name
    this.id = null
    this.token = null
    this.ws = null
    this.capabilities = ['text_analysis', 'summarization', 'translation', 'code_review']
    this.registrationCheckInterval = null
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
          try {
            resolve({ status: res.statusCode, data: JSON.parse(data) })
          } catch (e) {
            resolve({ status: res.statusCode, data: null })
          }
        })
      })

      req.on('error', reject)
      if (body) req.write(JSON.stringify(body))
      req.end()
    })
  }

  async register() {
    console.log(`[${this.name}] Registrando en el gateway...`)
    const { status, data } = await this.request('POST', '/agents/register', {
      name: this.name,
      description: 'Agente de ejemplo para demostraciones',
      version: '1.0.0',
      capabilities: this.capabilities,
      endpoint: 'ws://localhost',
      connection_type: 'websocket',
      owner: 'example',
      is_external: false,
      max_concurrent_tasks: 3,
    })

    if (status !== 200) {
      throw new Error(`Error al registrar: ${data?.error || 'error desconocido'}`)
    }

    this.id = data.agent_id
    console.log(`[${this.name}] Registrado con ID: ${this.id}`)
    console.log(`[${this.name}] Esperando aprobación del admin...`)
    console.log(`[${this.name}] Puedes aprobar el agente en http://localhost:3000/dashboard/agents`)

    // Revisar cada 5 segundos si fue aprobado
    await this.waitForApproval()
  }

  async waitForApproval() {
    return new Promise((resolve, reject) => {
      this.registrationCheckInterval = setInterval(async () => {
        try {
          const { status, data } = await this.request('GET', `/agents/${this.id}`)
          if (status === 200 && data.token) {
            clearInterval(this.registrationCheckInterval)
            this.token = data.token
            console.log(`[${this.name}] ¡Aprobado! Token recibido`)
            resolve()
          }
        } catch (err) {
          console.error(`[${this.name}] Error revisando aprobación:`, err.message)
        }
      }, 5000)
    })
  }

  connect() {
    return new Promise((resolve, reject) => {
      const wsUrl = this.gatewayUrl.replace(/^http/, 'ws') + `/ws?role=agent&token=${this.token}`
      console.log(`[${this.name}] Conectando a WebSocket...`)

      this.ws = new WebSocket(wsUrl)

      this.ws.on('open', () => {
        console.log(`[${this.name}] Conectado al gateway`)
        resolve()
      })

      this.ws.on('message', (data) => {
        try {
          this.handleMessage(JSON.parse(data))
        } catch (e) {
          console.error(`[${this.name}] Error procesando mensaje:`, e.message)
        }
      })

      this.ws.on('close', () => {
        console.log(`[${this.name}] Desconectado del gateway`)
        setTimeout(() => this.connect().catch(console.error), 3000)
      })

      this.ws.on('error', (err) => {
        console.error(`[${this.name}] Error WebSocket:`, err.message)
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

      default:
        console.log(`[${this.name}] Mensaje recibido:`, msg.type)
    }
  }

  async processTask(task) {
    console.log(`[${this.name}] Tarea asignada: ${task.title} (ID: ${task.task_id})`)

    // Simular procesamiento
    await new Promise(resolve => setTimeout(resolve, 2000))

    const result = {
      status: 'completed',
      summary: `He procesado: ${task.title}`,
      details: task.description,
      timestamp: new Date().toISOString(),
    }

    this.send({
      type: 'task_result',
      task_id: task.task_id,
      result,
    })

    console.log(`[${this.name}] Resultado enviado para tarea ${task.task_id}`)
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
      console.log(`[${this.name}] Agente listo para recibir tareas`)
      console.log(`[${this.name}] Presiona Ctrl+C para salir`)
    } catch (err) {
      console.error(`[${this.name}] Error fatal:`, err.message)
      process.exit(1)
    }
  }
}

// Crear y ejecutar agente
const agent = new Agent(GATEWAY_URL, AGENT_NAME)
agent.run()

process.on('SIGINT', () => {
  console.log(`\n[${AGENT_NAME}] Desconectando...`)
  if (agent.registrationCheckInterval) clearInterval(agent.registrationCheckInterval)
  if (agent.ws) agent.ws.close()
  process.exit(0)
})

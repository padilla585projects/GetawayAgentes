#!/usr/bin/env node

/**
 * GetawayAgentes - Start Everything
 * Starts gateway, web, and all agents
 */

const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')
const os = require('os')

// Find node executable
const NODE_PATH = process.execPath || 'node'

const ROOT = path.resolve(__dirname, '.')
const GATEWAY_DIR = path.join(ROOT, 'gateway')
const WEB_DIR = path.join(ROOT, 'web')
const AGENTS_DIR = path.join(ROOT, 'agents')

const GATEWAY_PORT = 8787
const WEB_PORT = 3000

const AGENT_FILES = [
  'agent-auto-electronics.js',
  'agent-construction.js',
  'agent-finance.js',
  'agent-legal.js',
  'agent-project-coordinator.js',
]

function log(prefix, msg, color = '\x1b[36m') {
  console.log(`${color}[${prefix}]\x1b[0m ${msg}`)
}

function startProcess(name, cmd, args, cwd, color) {
  const child = spawn(NODE_PATH, [cmd, ...args], {
    cwd,
    stdio: 'pipe',
    env: { ...process.env },
  })

  child.stdout?.on('data', (data) => {
    const lines = data.toString().split('\n').filter(l => l.trim())
    lines.forEach(line => log(name, line, color))
  })

  child.stderr?.on('data', (data) => {
    const lines = data.toString().split('\n').filter(l => l.trim())
    lines.forEach(line => log(name, line, '\x1b[33m'))
  })

  child.on('exit', (code) => {
    log(name, `Terminó (código ${code})`, '\x1b[31m')
  })

  return child
}

async function waitForPort(port, maxRetries = 30) {
  const http = require('http')
  for (let i = 0; i < maxRetries; i++) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(`http://localhost:${port}`, (res) => {
          res.resume()
          resolve()
        })
        req.on('error', reject)
        req.setTimeout(1000, () => { req.destroy(); reject(new Error('timeout')) })
      })
      return true
    } catch {
      await new Promise(r => setTimeout(r, 1000))
    }
  }
  return false
}

async function main() {
  console.log('\n🚀 GetawayAgentes - Iniciando sistema completo...\n')

  const processes = []

  // 1. Start Gateway
  log('SYSTEM', 'Iniciando Gateway...', '\x1b[32m')
  const gateway = startProcess(
    'GATEWAY',
    'node_modules/wrangler/bin/wrangler.js',
    ['dev'],
    GATEWAY_DIR,
    '\x1b[32m',
  )
  processes.push(gateway)

  // 2. Wait for gateway
  log('SYSTEM', 'Esperando gateway...', '\x1b[33m')
  const gatewayReady = await waitForPort(GATEWAY_PORT)
  if (!gatewayReady) {
    log('SYSTEM', 'Gateway no disponible', '\x1b[31m')
    process.exit(1)
  }
  log('SYSTEM', `Gateway listo en :${GATEWAY_PORT}`, '\x1b[32m')

  // 3. Start Web
  log('SYSTEM', 'Iniciando Web Dashboard...', '\x1b[32m')
  const web = startProcess(
    'WEB',
    'node_modules/next/dist/bin/next',
    ['dev'],
    WEB_DIR,
    '\x1b[35m',
  )
  processes.push(web)

  // 4. Wait for web
  log('SYSTEM', 'Esperando web...', '\x1b[33m')
  const webReady = await waitForPort(WEB_PORT)
  if (!webReady) {
    log('SYSTEM', 'Web no disponible (puede tardar)', '\x1b[33m')
  } else {
    log('SYSTEM', `Web listo en :${WEB_PORT}`, '\x1b[35m')
  }

  // 5. Start Agents
  log('SYSTEM', 'Iniciando agentes...', '\x1b[32m')
  for (const agentFile of AGENT_FILES) {
    const agentPath = path.join(AGENTS_DIR, agentFile)
    if (fs.existsSync(agentPath)) {
      const agent = startProcess(
        agentFile.replace('.js', ''),
        agentPath,
        [],
        AGENTS_DIR,
        '\x1b[36m',
      )
      processes.push(agent)
      await new Promise(r => setTimeout(r, 2000)) // Wait for agent to register
    }
  }

  // 6. Auto-approve all pending agents
  log('SYSTEM', 'Aprobando agentes pendientes...', '\x1b[32m')
  try {
    const http = require('http')
    const agentsData = await new Promise((resolve, reject) => {
      http.get(`http://localhost:${GATEWAY_PORT}/agents`, (res) => {
        let data = ''
        res.on('data', (chunk) => data += chunk)
        res.on('end', () => {
          try { resolve(JSON.parse(data)) }
          catch { resolve([]) }
        })
      }).on('error', () => resolve([]))
    })

    for (const agent of agentsData) {
      if (agent.status === 'pending') {
        try {
          await new Promise((resolve, reject) => {
            const req = http.request(`http://localhost:${GATEWAY_PORT}/agents/${agent.id}/approve`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
            }, (res) => {
              let data = ''
              res.on('data', (chunk) => data += chunk)
              res.on('end', () => resolve(data))
            })
            req.on('error', reject)
            req.write(JSON.stringify({ trust_level: 'trusted' }))
            req.end()
          })
          log('AGENT', `Aprobado: ${agent.name}`, '\x1b[32m')
        } catch (e) {
          log('AGENT', `Error aprobando ${agent.name}`, '\x1b[33m')
        }
      }
    }
  } catch (e) {
    log('SYSTEM', 'Error aprobando agentes', '\x1b[33m')
  }

  console.log('\n' + '═'.repeat(50))
  log('SYSTEM', '✅ Sistema completo iniciado', '\x1b[32m')
  console.log('═'.repeat(50))
  log('GATEWAY', `http://localhost:${GATEWAY_PORT}`, '\x1b[32m')
  log('WEB', `http://localhost:${WEB_PORT}`, '\x1b[35m')
  log('AGENTS', `${AGENT_FILES.length} agentes conectados`, '\x1b[36m')
  console.log('═'.repeat(50))
  console.log('\nPresiona Ctrl+C para detener todo\n')

  // Handle shutdown
  const shutdown = () => {
    console.log('\n🛑 Deteniendo sistema...')
    processes.forEach(p => {
      try { p.kill('SIGTERM') } catch {}
    })
    setTimeout(() => process.exit(0), 1000)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch(console.error)

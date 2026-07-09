#!/usr/bin/env node

/**
 * Auto-start script for GetawayAgentes
 * Registers and connects all agents automatically
 */

const { execSync, spawn } = require('child_process')
const http = require('http')
const fs = require('fs')
const path = require('path')

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:8787'

const AGENTS = [
  {
    name: 'Auto Electronics Expert',
    file: 'agent-auto-electronics.js',
    description: 'Experto en electrónica automotriz, diagnóstico OBD-II, ECUs, sensores, cableado y protocolos de comunicación vehicular.',
    capabilities: ['obd2_diagnostics', 'ecu_programming', 'sensor_analysis', 'wiring_diagnosis', 'can_bus_protocol', 'emissions_systems', 'electrical_systems', 'vehicle_brands', 'automotive_tools', 'injection_systems'],
  },
  {
    name: 'Construction Engineering Expert',
    file: 'agent-construction.js',
    description: 'Experto en construcción, ingeniería estructural, códigos de edificación, seguridad laboral y sistemas HVAC.',
    capabilities: ['structural_calculation', 'building_codes', 'prl_safety', 'hvac_systems', 'renewable_energy', 'bim_modeling', 'concrete_specs', 'steel_structures', 'fire_protection', 'geotechnical'],
  },
  {
    name: 'Finance Expert',
    file: 'agent-finance.js',
    description: 'Experto en finanzas, contabilidad, impuestos, auditoría y normativa internacional.',
    capabilities: ['tax_accounting', 'ifrs_standards', 'dcf_valuation', 'audit_procedures', 'treasury_management', 'international_tax', 'financial_modeling', 'payment_management'],
  },
  {
    name: 'Legal Expert',
    file: 'agent-legal.js',
    description: 'Experto en derecho, contratos, laboral, RGPD, propiedad intelectual y compliance.',
    capabilities: ['contract_law', 'labor_law', 'data_protection', 'intellectual_property', 'corporate_governance', 'ma_compliance', 'consumer_protection', 'digital_law'],
  },
  {
    name: 'Project Coordinator',
    file: 'agent-project-coordinator.js',
    description: 'Experto en gestión de proyectos, PMI, metodologías ágiles, contratación pública y sostenibilidad.',
    capabilities: ['project_management', 'agile_methodologies', 'public_procurement', 'bim_management', 'esg_sustainability', 'change_management', 'quality_management', 'stakeholder_management'],
  },
]

function request(method, urlPath, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, GATEWAY_URL)
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method,
      headers: { 'Content-Type': 'application/json' },
    }

    const req = http.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => data += chunk)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch { resolve(data) }
      })
    })
    req.on('error', reject)
    if (body) req.write(JSON.stringify(body))
    req.end()
  })
}

async function waitForGateway(maxRetries = 30) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await request('GET', '/')
      console.log('✅ Gateway conectado')
      return true
    } catch {
      console.log(`⏳ Esperando gateway... (${i + 1}/${maxRetries})`)
      await new Promise(r => setTimeout(r, 1000))
    }
  }
  console.error('❌ No se pudo conectar al gateway')
  process.exit(1)
}

async function ensureAdmin() {
  try {
    const result = await request('POST', '/auth/setup', {
      username: 'admin',
      email: 'admin@getawayagentes.com',
      password: 'admin123',
    })
    console.log('✅ Admin creado:', result.id || 'ya existía')
  } catch (e) {
    // Admin might already exist
    console.log('ℹ️  Admin ya existe o error:', e.message || 'ok')
  }
}

async function registerAgent(agentInfo) {
  try {
    const result = await request('POST', '/agents/register', {
      name: agentInfo.name,
      description: agentInfo.description,
      capabilities: agentInfo.capabilities,
    })

    if (result.agent_id) {
      console.log(`📝 Agente registrado: ${agentInfo.name} (${result.agent_id})`)

      // Auto-approve the agent
      try {
        await request('POST', `/agents/${result.agent_id}/approve`, { trust_level: 'trusted' })
        console.log(`✅ Agente aprobado: ${agentInfo.name}`)
        return result.agent_id
      } catch (e) {
        console.log(`⚠️  Error aprobando ${agentInfo.name}:`, e.message)
        return result.agent_id
      }
    } else if (result.id) {
      console.log(`ℹ️  Agente ya registrado: ${agentInfo.name}`)
      // Still approve in case it's pending
      try {
        await request('POST', `/agents/${result.id}/approve`, { trust_level: 'trusted' })
      } catch {}
      return result.id
    }
  } catch (e) {
    console.log(`⚠️  Error registrando ${agentInfo.name}:`, e.message)
    return null
  }
}

function startAgent(agentFile) {
  const agentPath = path.join(__dirname, agentFile)
  if (!fs.existsSync(agentPath)) {
    console.log(`⚠️  Archivo no encontrado: ${agentFile}`)
    return null
  }

  const child = spawn('node', [agentPath], {
    cwd: __dirname,
    stdio: 'pipe',
    env: { ...process.env, GATEWAY_URL },
  })

  child.stdout?.on('data', (data) => {
    const lines = data.toString().split('\n').filter(l => l.trim())
    lines.forEach(line => console.log(`  [${agentFile.replace('.js', '')}] ${line}`))
  })

  child.stderr?.on('data', (data) => {
    const lines = data.toString().split('\n').filter(l => l.trim())
    lines.forEach(line => console.log(`  [${agentFile.replace('.js', '')}] ⚠️ ${line}`))
  })

  child.on('exit', (code) => {
    console.log(`🔴 ${agentFile} terminó (código ${code})`)
  })

  return child
}

async function main() {
  console.log('🚀 GetawayAgentes - Iniciando agentes...\n')

  // Wait for gateway
  await waitForGateway()

  // Ensure admin exists
  await ensureAdmin()

  // Register all agents
  console.log('\n📋 Registrando agentes...')
  const registeredAgents = []
  for (const agent of AGENTS) {
    const id = await registerAgent(agent)
    if (id) registeredAgents.push({ ...agent, id })
    await new Promise(r => setTimeout(r, 500)) // Small delay between registrations
  }

  // Start all agents
  console.log('\n🤖 Iniciando agentes...')
  const processes = []
  for (const agent of AGENTS) {
    const proc = startAgent(agent.file)
    if (proc) processes.push(proc)
    await new Promise(r => setTimeout(r, 300)) // Stagger agent starts
  }

  console.log(`\n✅ ${processes.length} agentes ejecutándose`)
  console.log('📡 Gateway: http://localhost:8787')
  console.log('🌐 Dashboard: http://localhost:3000')
  console.log('\nPresiona Ctrl+C para detener todos los agentes\n')

  // Handle shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Deteniendo agentes...')
    processes.forEach(p => p.kill('SIGTERM'))
    process.exit(0)
  })

  process.on('SIGTERM', () => {
    processes.forEach(p => p.kill('SIGTERM'))
    process.exit(0)
  })
}

main().catch(console.error)

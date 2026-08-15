#!/usr/bin/env node

/**
 * GetawayAgentes - Kill switch
 *
 * Enciende o apaga el modo mantenimiento del gateway desde la terminal, sin
 * pasar por el panel web. Útil para cortar el tráfico hacia Cloudflare al
 * momento si algo se descontrola (agentes en bucle, reconexiones, etc).
 *
 * Uso:
 *   node killswitch.js status
 *   node killswitch.js on   [--yes]
 *   node killswitch.js off
 *
 * Auth (uno de los dos):
 *   ADMIN_TOKEN=xxx                  node killswitch.js off
 *   ADMIN_USER=x ADMIN_PASS=y        node killswitch.js off
 *
 * GATEWAY_URL por defecto apunta al mismo gateway que usa el panel web
 * (ver web/lib/ws.ts). Sobrescríbelo para apuntar a local u otro despliegue.
 */

const readline = require('readline')

const GATEWAY_URL = (process.env.GATEWAY_URL || 'https://getaway-gateway.alejandra-app.workers.dev').replace(/\/+$/, '')

function usage() {
  console.log('Uso: node killswitch.js <status|on|off> [--yes]')
  process.exit(1)
}

async function getToken() {
  if (process.env.ADMIN_TOKEN) return process.env.ADMIN_TOKEN

  const { ADMIN_USER, ADMIN_PASS } = process.env
  if (!ADMIN_USER || !ADMIN_PASS) {
    console.error('Falta autenticación: define ADMIN_TOKEN, o ADMIN_USER y ADMIN_PASS.')
    process.exit(1)
  }

  const res = await fetch(`${GATEWAY_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: ADMIN_USER, password: ADMIN_PASS }),
  })
  if (!res.ok) {
    console.error('Login fallido:', await res.text())
    process.exit(1)
  }
  return (await res.json()).token
}

function confirm(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => {
    rl.question(`${question} (escribe "si" para confirmar): `, answer => {
      rl.close()
      resolve(answer.trim().toLowerCase() === 'si')
    })
  })
}

async function main() {
  const cmd = process.argv[2]
  if (!['status', 'on', 'off'].includes(cmd)) usage()

  const skipConfirm = process.argv.includes('--yes')

  if (cmd === 'status') {
    const token = await getToken()
    const res = await fetch(`${GATEWAY_URL}/admin/status`, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) { console.error('Error:', await res.text()); process.exit(1) }
    const { maintenance } = await res.json()
    console.log(maintenance ? '🔴 Sistema APAGADO (modo mantenimiento)' : '🟢 Sistema operativo')
    return
  }

  if (cmd === 'on' && !skipConfirm) {
    const ok = await confirm('Esto desconecta todos los agentes y bloquea la API/WebSocket del gateway. ¿Apagar el sistema?')
    if (!ok) { console.log('Cancelado.'); return }
  }

  const token = await getToken()
  const res = await fetch(`${GATEWAY_URL}/admin/maintenance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ enabled: cmd === 'on' }),
  })
  if (!res.ok) { console.error('Error:', await res.text()); process.exit(1) }

  const { maintenance } = await res.json()
  console.log(maintenance ? '🔴 Sistema apagado.' : '🟢 Sistema reactivado.')
}

main().catch(err => {
  console.error(err.message)
  process.exit(1)
})

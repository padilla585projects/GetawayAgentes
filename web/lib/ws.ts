'use client'

interface WsMessage {
  type: string
  [key: string]: unknown
}

type WsHandler = (msg: WsMessage) => void

const BASE_DELAY = 1000
const MAX_DELAY = 60000

class GatewaySocket {
  private ws: WebSocket | null = null
  private handlers: Map<string, WsHandler[]> = new Map()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private token: string | null = null
  private attempts = 0
  private closedByUs = false
  private listeningVisibility = false

  connect(token: string) {
    // Singleton: montar otra página no debe abrir un socket nuevo. Sin esta
    // guarda cada `connect()` dejaba el anterior vivo y su `onclose` programaba
    // otra reconexión, multiplicando conexiones contra el gateway.
    if (this.ws && this.token === token &&
        (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return
    }

    this.token = token
    this.closedByUs = false
    this.clearTimer()
    this.teardown()
    this.watchVisibility()
    this.open(token)
  }

  private open(token: string) {
    let base = process.env.NEXT_PUBLIC_WS_URL || 'wss://getaway-gateway.alejandra-app.workers.dev'
    base = base.replace(/\/+$/, '')
    if (!base.endsWith('/ws')) base += '/ws'
    const url = `${base}?role=admin&token=${encodeURIComponent(token)}`

    const ws = new WebSocket(url)
    this.ws = ws

    ws.onopen = () => {
      this.attempts = 0
    }

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data) as WsMessage
        const listeners = this.handlers.get(msg.type) || []
        listeners.forEach(fn => fn(msg))
        const allListeners = this.handlers.get('*') || []
        allListeners.forEach(fn => fn(msg))
      } catch {}
    }

    ws.onerror = () => {
      console.error('[WS] Connection error')
    }

    ws.onclose = (e) => {
      // Sólo el socket vigente puede reprogramar una reconexión.
      if (this.ws !== ws) return
      this.ws = null
      if (this.closedByUs) return
      // 4000 = el gateway está en modo mantenimiento (kill switch). Reintentar
      // con backoff corto no tiene sentido: esperamos fijo y largo hasta que
      // vuelva, sin ir escalando.
      this.scheduleReconnect(e.code === 4000 ? MAX_DELAY : undefined)
    }
  }

  private scheduleReconnect(fixedDelay?: number) {
    if (this.reconnectTimer || !this.token) return

    // Una pestaña en segundo plano no necesita tiempo real: esperamos a que
    // vuelva a estar visible en vez de reintentar contra el gateway a ciegas.
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return

    // Backoff exponencial con jitter: un gateway caído o un token inválido ya no
    // generan un reintento cada 3 s indefinidamente.
    const delay = fixedDelay ?? Math.min(BASE_DELAY * 2 ** this.attempts, MAX_DELAY)
    const jitter = delay * 0.25 * Math.random()
    if (!fixedDelay) this.attempts++

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      if (this.token && !this.closedByUs) this.open(this.token)
    }, delay + jitter)
  }

  private watchVisibility() {
    if (this.listeningVisibility || typeof document === 'undefined') return
    this.listeningVisibility = true
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible' || this.closedByUs || !this.token) return
      if (this.ws) return
      // Al volver a la pestaña reintentamos ya, sin arrastrar el backoff acumulado.
      this.attempts = 0
      this.clearTimer()
      this.open(this.token)
    })
  }

  private clearTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  private teardown() {
    if (!this.ws) return
    const ws = this.ws
    this.ws = null
    ws.onopen = null
    ws.onmessage = null
    ws.onerror = null
    ws.onclose = null
    try { ws.close(1000, 'Reemplazada') } catch {}
  }

  on(type: string, handler: WsHandler) {
    if (!this.handlers.has(type)) this.handlers.set(type, [])
    this.handlers.get(type)!.push(handler)
  }

  off(type: string, handler: WsHandler) {
    const list = this.handlers.get(type) || []
    this.handlers.set(type, list.filter(fn => fn !== handler))
  }

  disconnect() {
    this.closedByUs = true
    this.token = null
    this.attempts = 0
    this.clearTimer()
    this.teardown()
  }
}

export const gatewaySocket = new GatewaySocket()

'use client'

interface WsMessage {
  type: string
  [key: string]: unknown
}

type WsHandler = (msg: WsMessage) => void

class GatewaySocket {
  private ws: WebSocket | null = null
  private handlers: Map<string, WsHandler[]> = new Map()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null

  connect(token: string) {
    let base = process.env.NEXT_PUBLIC_WS_URL || 'wss://getaway-gateway.alejandra-app.workers.dev'
    base = base.replace(/\/+$/, '')
    if (!base.endsWith('/ws')) base += '/ws'
    const url = `${base}?role=admin&token=${encodeURIComponent(token)}`
    this.ws = new WebSocket(url)

    this.ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data) as WsMessage
        const listeners = this.handlers.get(msg.type) || []
        listeners.forEach(fn => fn(msg))
        const allListeners = this.handlers.get('*') || []
        allListeners.forEach(fn => fn(msg))
      } catch {}
    }

    this.ws.onerror = () => {
      console.error('[WS] Connection error')
    }

    this.ws.onclose = () => {
      this.reconnectTimer = setTimeout(() => this.connect(token), 3000)
    }
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
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.ws?.close()
    this.ws = null
  }
}

export const gatewaySocket = new GatewaySocket()

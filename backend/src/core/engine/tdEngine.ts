import { EventEmitter } from 'events'
import WebSocket from 'ws'
import { parseTdInboundMessage } from '@shared/protocol/websocket'
import type {
  TdOutboundMessage,
  TdInboundMessage,
  TdHandTrackingMessage,
  TdPingMessage,
} from '@shared/protocol/websocket'
import type { ConnectionState, HandTrackingData } from '@shared/types/ipc'

const MAX_RECONNECT_ATTEMPTS = 10
const BASE_DELAY_MS = 500
const MAX_DELAY_MS = 30_000
const HAND_TRACKING_THROTTLE_MS = 16
const KEEPALIVE_INTERVAL_MS = 30_000

interface TDEngineEvents {
  connectionChanged: [state: ConnectionState]
  message: [msg: TdInboundMessage]
  error: [err: Error]
}

export class TDEngine extends EventEmitter<TDEngineEvents> {
  private ws: WebSocket | null = null
  private state: ConnectionState = 'disconnected'
  private reconnectAttempts = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private keepaliveTimer: ReturnType<typeof setInterval> | null = null
  private intentionalDisconnect = false
  private lastHandTrackingTs = 0
  private lastPingSentAtMs: number | null = null
  private _lastLatencyMs: number | null = null
  private readonly port: number

  constructor(port: number) {
    super()
    this.port = port
  }

  get connectionState(): ConnectionState {
    return this.state
  }

  get lastLatencyMs(): number | null {
    return this._lastLatencyMs
  }

  connect(): Promise<void> {
    if (this.state === 'connected' || this.state === 'connecting') {
      return Promise.resolve()
    }
    this.intentionalDisconnect = false
    return this.openConnection()
  }

  disconnect(): void {
    this.intentionalDisconnect = true
    this.clearReconnectTimer()
    this.clearKeepaliveTimer()
    this.ws?.close()
    this.setState('disconnected')
  }

  destroy(): void {
    this.disconnect()
  }

  send(message: TdOutboundMessage): void {
    if (this.state !== 'connected' || !this.ws) {
      throw new Error(`Cannot send: TDEngine is ${this.state}`)
    }
    this.ws.send(JSON.stringify(message))
  }

  sendHandTracking(data: HandTrackingData): void {
    if (this.state !== 'connected' || !this.ws) return
    const now = Date.now()
    if (now - this.lastHandTrackingTs < HAND_TRACKING_THROTTLE_MS) return
    this.lastHandTrackingTs = now
    this.ws.send(JSON.stringify({ type: 'hand_tracking', ...data } satisfies TdHandTrackingMessage))
  }

  private openConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.setState('connecting')
      const ws = new WebSocket(`ws://localhost:${this.port}`)
      this.ws = ws

      const onOpen = () => {
        cleanup()
        this.reconnectAttempts = 0
        this.setState('connected')
        this.startKeepalive()
        resolve()
      }

      const onError = (err: Error) => {
        cleanup()
        if (this.state === 'connecting') reject(err)
        this.handleDisconnect()
      }

      const cleanup = () => {
        ws.off('open', onOpen)
        ws.off('error', onError)
      }

      ws.on('open', onOpen)
      ws.on('error', onError)
      ws.on('close', () => this.handleDisconnect())
      ws.on('message', (data: WebSocket.RawData) => {
        const msg = parseTdInboundMessage(data.toString())
        if (!msg) return

        if (msg.type === 'pong' && this.lastPingSentAtMs !== null) {
          this._lastLatencyMs = Date.now() - this.lastPingSentAtMs
        }

        this.emit('message', msg)
      })
    })
  }

  private handleDisconnect(): void {
    this.clearKeepaliveTimer()
    if (this.intentionalDisconnect) return
    this.scheduleReconnect()
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      this.setState('disconnected')
      this.emit('error', new Error(`Failed to reconnect after ${MAX_RECONNECT_ATTEMPTS} attempts`))
      return
    }

    this.setState('reconnecting')
    const delay = Math.min(BASE_DELAY_MS * 2 ** this.reconnectAttempts, MAX_DELAY_MS)
    this.reconnectAttempts++

    this.reconnectTimer = setTimeout(() => {
      this.openConnection().catch(() => {
        // close/error events on the new socket trigger the next scheduleReconnect
      })
    }, delay)
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  private startKeepalive(): void {
    this.clearKeepaliveTimer()
    this.keepaliveTimer = setInterval(() => {
      this.lastPingSentAtMs = Date.now()
      try {
        this.send({ type: 'ping' } satisfies TdPingMessage)
      } catch {
        // connection dropped between tick and close handler — interval will be
        // cleared by the disconnect path
      }
    }, KEEPALIVE_INTERVAL_MS)
  }

  private clearKeepaliveTimer(): void {
    if (this.keepaliveTimer !== null) {
      clearInterval(this.keepaliveTimer)
      this.keepaliveTimer = null
    }
    this.lastPingSentAtMs = null
  }

  private setState(next: ConnectionState): void {
    if (this.state === next) return
    this.state = next
    this.emit('connectionChanged', next)
  }
}

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EventEmitter } from 'events'

vi.mock('ws', () => {
  const WS = vi.fn()
  WS.prototype = Object.create(EventEmitter.prototype)
  WS.prototype.constructor = WS
  WS.prototype.send = vi.fn()
  WS.prototype.close = vi.fn()
  return { default: WS }
})

import WebSocket from 'ws'
import { TDEngine } from './tdEngine'

describe('TDEngine', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts in disconnected state', () => {
    const engine = new TDEngine(9980)
    expect(engine.connectionState).toBe('disconnected')
  })

  it('transitions to connecting then connected on open', async () => {
    const engine = new TDEngine(9980)
    const states: string[] = []
    engine.on('connectionChanged', (s) => states.push(s))

    const connectPromise = engine.connect()
    expect(engine.connectionState).toBe('connecting')

    ;(WebSocket as unknown as ReturnType<typeof vi.fn>).mock.instances[0].emit('open')
    await connectPromise

    expect(states).toEqual(['connecting', 'connected'])
    expect(engine.connectionState).toBe('connected')
  })

  it('transitions to disconnected on intentional disconnect', async () => {
    const engine = new TDEngine(9980)
    const connectPromise = engine.connect()
    ;(WebSocket as unknown as ReturnType<typeof vi.fn>).mock.instances[0].emit('open')
    await connectPromise

    engine.disconnect()
    expect(engine.connectionState).toBe('disconnected')
  })

  it('sends keepalive ping after connection establishes', async () => {
    const engine = new TDEngine(9980)
    const connectPromise = engine.connect()
    const wsInstance = (WebSocket as unknown as ReturnType<typeof vi.fn>).mock.instances[0]
    wsInstance.emit('open')
    await connectPromise

    vi.advanceTimersByTime(30_000)

    expect(wsInstance.send).toHaveBeenCalledWith(JSON.stringify({ type: 'ping' }))
  })

  it('clears the keepalive interval on disconnect', async () => {
    const engine = new TDEngine(9980)
    const connectPromise = engine.connect()
    const wsInstance = (WebSocket as unknown as ReturnType<typeof vi.fn>).mock.instances[0]
    wsInstance.emit('open')
    await connectPromise

    engine.disconnect()
    vi.advanceTimersByTime(30_000)

    expect(wsInstance.send).not.toHaveBeenCalled()
  })

  it('schedules reconnect with exponential backoff on unexpected close', async () => {
    const engine = new TDEngine(9980)
    const connectPromise = engine.connect()
    ;(WebSocket as unknown as ReturnType<typeof vi.fn>).mock.instances[0].emit('open')
    await connectPromise

    ;(WebSocket as unknown as ReturnType<typeof vi.fn>).mock.instances[0].emit('close')
    expect(engine.connectionState).toBe('reconnecting')

    // First backoff: 500ms * 2^0 = 500ms
    vi.advanceTimersByTime(499)
    expect((WebSocket as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1)
    vi.advanceTimersByTime(1)
    expect((WebSocket as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(2)
  })

  it('emits parsed inbound messages', async () => {
    const engine = new TDEngine(9980)
    const connectPromise = engine.connect()
    const wsInstance = (WebSocket as unknown as ReturnType<typeof vi.fn>).mock.instances[0]
    wsInstance.emit('open')
    await connectPromise

    const messages: unknown[] = []
    engine.on('message', (m) => messages.push(m))

    wsInstance.emit('message', JSON.stringify({ type: 'pong' }))
    expect(messages).toHaveLength(1)
    expect((messages[0] as { type: string }).type).toBe('pong')
  })

  it('ignores malformed inbound messages without throwing', async () => {
    const engine = new TDEngine(9980)
    const connectPromise = engine.connect()
    const wsInstance = (WebSocket as unknown as ReturnType<typeof vi.fn>).mock.instances[0]
    wsInstance.emit('open')
    await connectPromise

    const messages: unknown[] = []
    engine.on('message', (m) => messages.push(m))

    wsInstance.emit('message', 'not-json{{{')
    wsInstance.emit('message', JSON.stringify({ type: 'unknown_type' }))
    expect(messages).toHaveLength(0)
  })

  it('sendHandTracking throttles to 16ms (drops frames within window)', async () => {
    const engine = new TDEngine(9980)
    const connectPromise = engine.connect()
    const wsInstance = (WebSocket as unknown as ReturnType<typeof vi.fn>).mock.instances[0]
    wsInstance.emit('open')
    await connectPromise

    const data = { palmX: 0.5, palmY: 0.5, confidence: 0.9, detected: true }
    engine.sendHandTracking(data)
    engine.sendHandTracking(data)  // should be dropped (< 16ms)

    expect(wsInstance.send).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(16)
    engine.sendHandTracking(data)
    expect(wsInstance.send).toHaveBeenCalledTimes(2)
  })

  it('sendHandTracking silently drops when not connected', () => {
    const engine = new TDEngine(9980)
    const data = { palmX: 0.5, palmY: 0.5, confidence: 0.9, detected: true }
    expect(() => engine.sendHandTracking(data)).not.toThrow()
  })
})

import { existsSync } from 'fs'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EventEmitter } from 'events'
import type { TdInboundMessage } from '@shared/protocol/websocket'
import type { ConnectionState } from '@shared/types/ipc'

vi.mock('fs', () => ({
  existsSync: vi.fn(),
}))

vi.mock('@shared/types/ipc', () => ({
  TdExportResponseSchema: {
    parse: <T>(value: T) => value,
  },
}))

function makeMockEngine() {
  const emitter = new EventEmitter() as EventEmitter & {
    connectionState: ConnectionState
    send: ReturnType<typeof vi.fn>
  }
  emitter.connectionState = 'connected'
  emitter.send = vi.fn()
  return emitter
}

import { CaptureManager } from './captureManager'

describe('CaptureManager', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    vi.mocked(existsSync).mockReturnValue(true)
  })

  it('resolves with filePath on recording_complete', async () => {
    const engine = makeMockEngine()
    const manager = new CaptureManager('/tmp/exports', engine as never)

    const resultPromise = manager.startExport({
      durationSeconds: 5,
      outputDir: '/tmp/exports',
      filename: 'clip.mp4',
    })

    const msg: TdInboundMessage = { type: 'recording_complete', filePath: '/tmp/exports/clip.mp4' }
    engine.emit('message', msg)

    const result = await resultPromise
    expect(result.success).toBe(true)
    expect(result.filePath).toBe('/tmp/exports/clip.mp4')
  })

  it('resolves with error on td error message', async () => {
    const engine = makeMockEngine()
    const manager = new CaptureManager('/tmp/exports', engine as never)

    const resultPromise = manager.startExport({
      durationSeconds: 5,
      outputDir: '/tmp/exports',
      filename: 'clip.mp4',
    })

    const msg: TdInboundMessage = { type: 'error', code: 'RENDER_FAILED', message: 'Out of memory' }
    engine.emit('message', msg)

    const result = await resultPromise
    expect(result.success).toBe(false)
    expect(result.error).toBe('Out of memory')
  })

  it('resolves with error when TD reports completion but file is missing', async () => {
    vi.mocked(existsSync).mockReturnValue(false)

    const engine = makeMockEngine()
    const manager = new CaptureManager('/tmp/exports', engine as never)

    const resultPromise = manager.startExport({
      durationSeconds: 5,
      outputDir: '/tmp/exports',
      filename: 'clip.mp4',
    })

    const msg: TdInboundMessage = { type: 'recording_complete', filePath: '/tmp/exports/clip.mp4' }
    engine.emit('message', msg)

    const result = await resultPromise
    expect(result.success).toBe(false)
    expect(result.error).toBe('Export reported complete but file not found at: /tmp/exports/clip.mp4')
  })

  it('times out if TD never responds', async () => {
    const engine = makeMockEngine()
    const manager = new CaptureManager('/tmp/exports', engine as never)

    const resultPromise = manager.startExport({
      durationSeconds: 5,
      outputDir: '/tmp/exports',
      filename: 'clip.mp4',
    })

    vi.advanceTimersByTime(35_000)

    const result = await resultPromise
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/timed out/)
  })
})

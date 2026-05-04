import * as path from 'path'
import type { TDEngine } from '../core/engine/tdEngine'
import type { TdInboundMessage } from '@shared/protocol/websocket'
import { TdExportResponseSchema } from '@shared/types/ipc'
import type { TdExportRequest, TdExportResponse } from '@shared/types/ipc'

/**
 * Orchestrates video export from TouchDesigner.
 *
 * Flow:
 *   1. Resolves output path from request fields.
 *   2. Sends `start_recording` to TD via the engine.
 *   3. Waits for `recording_complete` (success) or `error` (failure).
 *   4. A timeout guard resolves with an error if TD never responds.
 *
 * Still needs before shipping:
 *   - Verify the returned filePath exists on disk before resolving success.
 *   - Emit progress events for long exports (future, not MVP).
 */
export class CaptureManager {
  constructor(
    private readonly defaultOutputDir: string,
    private readonly engine: TDEngine,
  ) {}

  startExport(req: TdExportRequest): Promise<TdExportResponse> {
    return new Promise((resolve) => {
      const outputPath = path.join(req.outputDir ?? this.defaultOutputDir, req.filename)
      const timeoutMs = (req.durationSeconds + 30) * 1000

      const timer = setTimeout(() => {
        cleanup()
        resolve(TdExportResponseSchema.parse({ success: false, error: `Export timed out after ${timeoutMs}ms` }))
      }, timeoutMs)

      const onMessage = (msg: TdInboundMessage): void => {
        if (msg.type === 'recording_complete') {
          cleanup()
          resolve(TdExportResponseSchema.parse({ success: true, filePath: msg.filePath }))
        } else if (msg.type === 'error') {
          cleanup()
          resolve(TdExportResponseSchema.parse({ success: false, error: msg.message }))
        }
      }

      const cleanup = () => {
        clearTimeout(timer)
        this.engine.off('message', onMessage)
      }

      this.engine.on('message', onMessage)

      try {
        this.engine.send({ type: 'start_recording', durationSeconds: req.durationSeconds, outputPath })
      } catch (err) {
        cleanup()
        resolve(TdExportResponseSchema.parse({ success: false, error: err instanceof Error ? err.message : String(err) }))
      }
    })
  }
}

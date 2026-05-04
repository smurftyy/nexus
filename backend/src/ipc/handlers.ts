import { ipcMain } from 'electron'
import type { BrowserWindow } from 'electron'
import * as path from 'path'
import type { TDEngine } from '../core/engine/tdEngine'
import { CaptureManager } from '../capture/captureManager'
import { config } from '../core/config/config'
import type { TdInboundMessage } from '@shared/protocol/websocket'
import {
  IPC_CHANNELS,
  TdConnectResponseSchema,
  TdDisconnectResponseSchema,
  TdSendParamResponseSchema,
  TdLoadTemplateResponseSchema,
  TdGetStatusResponseSchema,
  ParameterUpdateSchema,
  TdLoadTemplateRequestSchema,
  TdExportRequestSchema,
  HandTrackingDataSchema,
} from '@shared/types/ipc'
import type { ConnectionState } from '@shared/types/ipc'
import { MVP_TEMPLATE_PARAMETERS } from '@shared/types/template'

export function registerIpcHandlers(
  tdEngine: TDEngine,
  getWindow: () => BrowserWindow | null,
): void {
  const captureManager = new CaptureManager(config.outputDir, tdEngine)

  tdEngine.on('connectionChanged', (state: ConnectionState) => {
    getWindow()?.webContents.send(IPC_CHANNELS.TD_CONNECTION_CHANGED, { state })
  })

  tdEngine.on('error', (err: Error) => {
    getWindow()?.webContents.send(IPC_CHANNELS.TD_ERROR, { code: 'ENGINE_ERROR', message: err.message })
  })

  tdEngine.on('message', (msg) => {
    if (msg.type === 'recording_complete') {
      getWindow()?.webContents.send(IPC_CHANNELS.TD_EXPORT_COMPLETE, { filePath: msg.filePath })
    }
  })

  ipcMain.handle(IPC_CHANNELS.TD_CONNECT, async () => {
    try {
      await tdEngine.connect()
      return TdConnectResponseSchema.parse({ success: true })
    } catch (err) {
      return TdConnectResponseSchema.parse({ success: false, error: err instanceof Error ? err.message : String(err) })
    }
  })

  ipcMain.handle(IPC_CHANNELS.TD_DISCONNECT, async () => {
    try {
      tdEngine.disconnect()
      return TdDisconnectResponseSchema.parse({ success: true })
    } catch (err) {
      return TdDisconnectResponseSchema.parse({ success: false, error: err instanceof Error ? err.message : String(err) })
    }
  })

  ipcMain.handle(IPC_CHANNELS.TD_SEND_PARAM, async (_event, rawReq: unknown) => {
    const req = ParameterUpdateSchema.parse(rawReq)
    try {
      tdEngine.send({ type: 'param_update', ...req })
      return TdSendParamResponseSchema.parse({ success: true })
    } catch {
      return TdSendParamResponseSchema.parse({ success: false })
    }
  })

  ipcMain.handle(IPC_CHANNELS.TD_LOAD_TEMPLATE, async (_event, rawReq: unknown) => {
    const req = TdLoadTemplateRequestSchema.parse(rawReq)
    const templateId = path.basename(req.toxPath, path.extname(req.toxPath)) || req.toxPath
    try {
      tdEngine.send({ type: 'load_template', toxPath: req.toxPath })

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          cleanup()
          reject(new Error('TD did not confirm template load within 10s'))
        }, 10_000)

        const onMessage = (msg: TdInboundMessage): void => {
          if (msg.type === 'ready') {
            cleanup()
            resolve()
            return
          }

          if (msg.type === 'error') {
            cleanup()
            reject(new Error(`[${msg.code}] ${msg.message}`))
          }
        }

        const cleanup = () => {
          clearTimeout(timeout)
          tdEngine.off('message', onMessage)
        }

        tdEngine.on('message', onMessage)
      })

      return TdLoadTemplateResponseSchema.parse({
        success: true,
        template: {
          id: templateId,
          name: templateId,
          description: '',
          toxPath: req.toxPath,
          parameters: MVP_TEMPLATE_PARAMETERS.map((parameter) => ({
            ...parameter,
            range: parameter.range ? { ...parameter.range } : undefined,
            options: parameter.options?.map((option) => ({ ...option })),
          })),
        },
      })
    } catch (err) {
      return TdLoadTemplateResponseSchema.parse({
        success: false,
        error: err instanceof Error ? err.message : `Failed to load template: ${String(err)}`,
      })
    }
  })

  ipcMain.handle(IPC_CHANNELS.TD_EXPORT, async (_event, rawReq: unknown) => {
    const req = TdExportRequestSchema.parse(rawReq)
    return captureManager.startExport(req)
  })

  ipcMain.handle(IPC_CHANNELS.TD_GET_STATUS, async () => {
    return TdGetStatusResponseSchema.parse({ state: tdEngine.connectionState })
  })

  ipcMain.handle(IPC_CHANNELS.TD_SEND_HAND_TRACKING, async (_event, rawData: unknown) => {
    const data = HandTrackingDataSchema.parse(rawData)
    tdEngine.sendHandTracking(data)
  })
}

import { ipcMain } from 'electron'
import type { BrowserWindow } from 'electron'
import type { TDEngine } from '../core/engine/tdEngine'
import { CaptureManager } from '../capture/captureManager'
import { config } from '../core/config/config'
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
    try {
      // Sends load_template to TD. Full implementation must await TdReadyMessage,
      // parse the returned TemplateMetadata from TD's response, and return it here.
      // MVP: response is immediate. Renderer polls getStatus for ready state.
      tdEngine.send({ type: 'load_template', toxPath: req.toxPath })
      return TdLoadTemplateResponseSchema.parse({ success: true })
    } catch (err) {
      return TdLoadTemplateResponseSchema.parse({ success: false, error: err instanceof Error ? err.message : String(err) })
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

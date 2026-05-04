import { z } from 'zod'
import { ParameterUpdateSchema } from './control'
import { TemplateMetadataSchema } from './template'

// All IPC channel names as const — the single source of truth.
// Adding a new channel here is the mandatory first step before implementing it anywhere.
export const IPC_CHANNELS = {
  // Renderer → Main (ipcRenderer.invoke / ipcMain.handle)
  TD_CONNECT: 'td:connect',
  TD_DISCONNECT: 'td:disconnect',
  TD_SEND_PARAM: 'td:send-param',
  TD_LOAD_TEMPLATE: 'td:load-template',
  TD_EXPORT: 'td:export',
  TD_GET_STATUS: 'td:get-status',
  TD_SEND_HAND_TRACKING: 'td:send-hand-tracking',

  // Main → Renderer (webContents.send / ipcRenderer.on)
  TD_CONNECTION_CHANGED: 'td:connection-changed',
  TD_EXPORT_COMPLETE: 'td:export-complete',
  TD_ERROR: 'td:error',
} as const

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]

// ── Connection state ────────────────────────────────────────────────────────

export const ConnectionStateSchema = z.enum([
  'disconnected',
  'connecting',
  'connected',
  'reconnecting',
])
export type ConnectionState = z.infer<typeof ConnectionStateSchema>

// ── Hand tracking data (AR webcam mode) ────────────────────────────────────

export const HandTrackingDataSchema = z.object({
  palmX: z.number().min(0).max(1).finite(),
  palmY: z.number().min(0).max(1).finite(),
  confidence: z.number().min(0).max(1).finite(),
  detected: z.boolean(),
})
export type HandTrackingData = z.infer<typeof HandTrackingDataSchema>

// ── Invoke request/response shapes ─────────────────────────────────────────

export const TdConnectResponseSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
})
export type TdConnectResponse = z.infer<typeof TdConnectResponseSchema>

export const TdDisconnectResponseSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
})
export type TdDisconnectResponse = z.infer<typeof TdDisconnectResponseSchema>

export const TdSendParamRequestSchema = ParameterUpdateSchema
export type TdSendParamRequest = z.infer<typeof TdSendParamRequestSchema>

export const TdSendParamResponseSchema = z.object({ success: z.boolean() })
export type TdSendParamResponse = z.infer<typeof TdSendParamResponseSchema>

export const TdLoadTemplateRequestSchema = z.object({
  toxPath: z.string().min(1),
})
export type TdLoadTemplateRequest = z.infer<typeof TdLoadTemplateRequestSchema>

export const TdLoadTemplateResponseSchema = z.object({
  success: z.boolean(),
  template: TemplateMetadataSchema.optional(),
  error: z.string().optional(),
})
export type TdLoadTemplateResponse = z.infer<typeof TdLoadTemplateResponseSchema>

export const TdExportRequestSchema = z.object({
  durationSeconds: z.number().positive().finite(),
  outputDir: z.string().optional(),
  filename: z.string().min(1),
})
export type TdExportRequest = z.infer<typeof TdExportRequestSchema>

export const TdExportResponseSchema = z.object({
  success: z.boolean(),
  filePath: z.string().optional(),
  error: z.string().optional(),
})
export type TdExportResponse = z.infer<typeof TdExportResponseSchema>

export const TdGetStatusResponseSchema = z.object({
  state: ConnectionStateSchema,
  templateId: z.string().optional(),
})
export type TdGetStatusResponse = z.infer<typeof TdGetStatusResponseSchema>

// ── Push payload shapes (Main → Renderer) ──────────────────────────────────

export const TdConnectionChangedPayloadSchema = z.object({
  state: ConnectionStateSchema,
  templateId: z.string().optional(),
})
export type TdConnectionChangedPayload = z.infer<typeof TdConnectionChangedPayloadSchema>

export const TdExportCompletePayloadSchema = z.object({
  filePath: z.string().min(1),
})
export type TdExportCompletePayload = z.infer<typeof TdExportCompletePayloadSchema>

export const TdErrorPayloadSchema = z.object({
  code: z.string(),
  message: z.string(),
})
export type TdErrorPayload = z.infer<typeof TdErrorPayloadSchema>

// ── contextBridge API surface exposed to the renderer ──────────────────────
// Implemented in backend/src/app/preload.ts.
// Consumed via window.nexusAPI in frontend (typed in frontend/src/types/window.d.ts).

export interface NexusAPI {
  connect: () => Promise<TdConnectResponse>
  disconnect: () => Promise<TdDisconnectResponse>
  sendParam: (req: TdSendParamRequest) => Promise<TdSendParamResponse>
  loadTemplate: (req: TdLoadTemplateRequest) => Promise<TdLoadTemplateResponse>
  export: (req: TdExportRequest) => Promise<TdExportResponse>
  getStatus: () => Promise<TdGetStatusResponse>
  sendHandTracking: (data: HandTrackingData) => Promise<void>

  // Push subscriptions — return an unsubscribe function.
  // Callers MUST invoke the returned function on component unmount to avoid leaks.
  onConnectionChanged: (cb: (payload: TdConnectionChangedPayload) => void) => () => void
  onExportComplete: (cb: (payload: TdExportCompletePayload) => void) => () => void
  onError: (cb: (payload: TdErrorPayload) => void) => () => void
}

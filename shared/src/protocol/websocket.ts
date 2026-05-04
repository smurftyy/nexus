import { z } from 'zod'

// ── Outbound: Nexus → TouchDesigner ────────────────────────────────────────
// TD WebSocket DAT receives these as JSON strings.

export const TdParamUpdateMessageSchema = z.object({
  type: z.literal('param_update'),
  templateId: z.string().min(1),
  parameterId: z.string().min(1),
  value: z.union([z.number(), z.boolean(), z.string()]),
})
export type TdParamUpdateMessage = z.infer<typeof TdParamUpdateMessageSchema>

export const TdLoadTemplateMessageSchema = z.object({
  type: z.literal('load_template'),
  toxPath: z.string(),
})
export type TdLoadTemplateMessage = z.infer<typeof TdLoadTemplateMessageSchema>

export const TdStartRecordingMessageSchema = z.object({
  type: z.literal('start_recording'),
  durationSeconds: z.number().positive().finite(),
  outputPath: z.string(),
})
export type TdStartRecordingMessage = z.infer<typeof TdStartRecordingMessageSchema>

export const TdPingMessageSchema = z.object({ type: z.literal('ping') })
export type TdPingMessage = z.infer<typeof TdPingMessageSchema>

export const TdHandTrackingMessageSchema = z.object({
  type: z.literal('hand_tracking'),
  palmX: z.number().min(0).max(1).finite(),
  palmY: z.number().min(0).max(1).finite(),
  confidence: z.number().min(0).max(1).finite(),
  detected: z.boolean(),
})
export type TdHandTrackingMessage = z.infer<typeof TdHandTrackingMessageSchema>

export const TdOutboundMessageSchema = z.discriminatedUnion('type', [
  TdParamUpdateMessageSchema,
  TdLoadTemplateMessageSchema,
  TdStartRecordingMessageSchema,
  TdPingMessageSchema,
  TdHandTrackingMessageSchema,
])
export type TdOutboundMessage = z.infer<typeof TdOutboundMessageSchema>

// ── Inbound: TouchDesigner → Nexus ─────────────────────────────────────────
// TD WebSocket DAT sends these as JSON strings.

export const TdReadyMessageSchema = z.object({
  type: z.literal('ready'),
  templateId: z.string().min(1),
})
export type TdReadyMessage = z.infer<typeof TdReadyMessageSchema>

export const TdParamAckMessageSchema = z.object({
  type: z.literal('param_ack'),
  parameterId: z.string(),
  value: z.union([z.number(), z.boolean(), z.string()]),
})
export type TdParamAckMessage = z.infer<typeof TdParamAckMessageSchema>

export const TdRecordingStartedMessageSchema = z.object({
  type: z.literal('recording_started'),
  outputPath: z.string(),
})
export type TdRecordingStartedMessage = z.infer<typeof TdRecordingStartedMessageSchema>

export const TdRecordingCompleteMessageSchema = z.object({
  type: z.literal('recording_complete'),
  filePath: z.string(),
})
export type TdRecordingCompleteMessage = z.infer<typeof TdRecordingCompleteMessageSchema>

export const TdErrorMessageSchema = z.object({
  type: z.literal('error'),
  code: z.string(),
  message: z.string(),
})
export type TdErrorMessage = z.infer<typeof TdErrorMessageSchema>

export const TdPongMessageSchema = z.object({ type: z.literal('pong') })
export type TdPongMessage = z.infer<typeof TdPongMessageSchema>

export const TdInboundMessageSchema = z.discriminatedUnion('type', [
  TdReadyMessageSchema,
  TdParamAckMessageSchema,
  TdRecordingStartedMessageSchema,
  TdRecordingCompleteMessageSchema,
  TdErrorMessageSchema,
  TdPongMessageSchema,
])
export type TdInboundMessage = z.infer<typeof TdInboundMessageSchema>

// Returns null and logs if the raw string is not a valid inbound message.
// Never throws — callers must handle null.
export function parseTdInboundMessage(raw: string): TdInboundMessage | null {
  try {
    const parsed: unknown = JSON.parse(raw)
    const result = TdInboundMessageSchema.safeParse(parsed)
    if (!result.success) {
      console.error('[ws-protocol] Invalid inbound message:', result.error.message)
      return null
    }
    return result.data
  } catch {
    console.error('[ws-protocol] WebSocket data is not valid JSON')
    return null
  }
}

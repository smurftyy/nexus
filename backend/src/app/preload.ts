import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import { IPC_CHANNELS } from '@shared/types/ipc'
import type {
  NexusAPI,
  TdSendParamRequest,
  TdLoadTemplateRequest,
  TdExportRequest,
  HandTrackingData,
  TdConnectionChangedPayload,
  TdExportCompletePayload,
  TdErrorPayload,
} from '@shared/types/ipc'

function makePushSubscription<T>(channel: string, cb: (payload: T) => void): () => void {
  const handler = (_event: IpcRendererEvent, payload: T) => cb(payload)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.off(channel, handler)
}

const api: NexusAPI = {
  connect: () => ipcRenderer.invoke(IPC_CHANNELS.TD_CONNECT),
  disconnect: () => ipcRenderer.invoke(IPC_CHANNELS.TD_DISCONNECT),
  sendParam: (req: TdSendParamRequest) => ipcRenderer.invoke(IPC_CHANNELS.TD_SEND_PARAM, req),
  loadTemplate: (req: TdLoadTemplateRequest) => ipcRenderer.invoke(IPC_CHANNELS.TD_LOAD_TEMPLATE, req),
  export: (req: TdExportRequest) => ipcRenderer.invoke(IPC_CHANNELS.TD_EXPORT, req),
  getStatus: () => ipcRenderer.invoke(IPC_CHANNELS.TD_GET_STATUS),
  sendHandTracking: (data: HandTrackingData) => ipcRenderer.invoke(IPC_CHANNELS.TD_SEND_HAND_TRACKING, data),

  onConnectionChanged: (cb: (p: TdConnectionChangedPayload) => void) =>
    makePushSubscription(IPC_CHANNELS.TD_CONNECTION_CHANGED, cb),
  onExportComplete: (cb: (p: TdExportCompletePayload) => void) =>
    makePushSubscription(IPC_CHANNELS.TD_EXPORT_COMPLETE, cb),
  onError: (cb: (p: TdErrorPayload) => void) =>
    makePushSubscription(IPC_CHANNELS.TD_ERROR, cb),
}

contextBridge.exposeInMainWorld('nexusAPI', api)

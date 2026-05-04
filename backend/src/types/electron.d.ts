/**
 * Minimal ambient declarations for `electron` to satisfy the TypeScript
 * compiler when the full electron package is not installed (CI / typecheck
 * without pnpm install).  Replace with the real `electron` package at
 * runtime / full-install time — these types intentionally mirror only the
 * surface the backend sources actually use.
 */
declare module 'electron' {
  /** IpcMain handle / on helpers */
  interface IpcMain {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handle(channel: string, listener: (event: IpcMainInvokeEvent, ...args: any[]) => any): void
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    on(channel: string, listener: (event: IpcMainEvent, ...args: any[]) => void): this
  }
  interface IpcMainEvent {
    sender: WebContents
  }
  interface IpcMainInvokeEvent {
    sender: WebContents
  }

  /** IpcRenderer helpers */
  interface IpcRenderer {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    invoke(channel: string, ...args: any[]): Promise<any>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    on(channel: string, listener: (event: IpcRendererEvent, ...args: any[]) => void): this
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    off(channel: string, listener: (event: IpcRendererEvent, ...args: any[]) => void): this
    send(channel: string, ...args: unknown[]): void
  }
  interface IpcRendererEvent {
    sender: IpcRenderer
  }

  /** ContextBridge */
  interface ContextBridge {
    exposeInMainWorld(apiKey: string, api: unknown): void
  }

  interface WebContents {
    send(channel: string, ...args: unknown[]): void
    openDevTools(): void
  }

  interface BrowserWindowConstructorOptions {
    width?: number
    height?: number
    minWidth?: number
    minHeight?: number
    webPreferences?: {
      preload?: string
      contextIsolation?: boolean
      nodeIntegration?: boolean
      sandbox?: boolean
    }
    titleBarStyle?: string
    show?: boolean
  }

  class BrowserWindow {
    webContents: WebContents
    constructor(options?: BrowserWindowConstructorOptions)
    loadURL(url: string): Promise<void>
    loadFile(filePath: string): Promise<void>
    once(event: string, listener: (...args: unknown[]) => void): this
    on(event: string, listener: (...args: unknown[]) => void): this
    show(): void
    static getAllWindows(): BrowserWindow[]
  }

  interface App {
    whenReady(): Promise<void>
    quit(): void
    on(event: string, listener: (...args: unknown[]) => void): this
  }

  export const app: App
  export const ipcMain: IpcMain
  export const ipcRenderer: IpcRenderer
  export const contextBridge: ContextBridge
  export { BrowserWindow }
  export type { IpcRendererEvent, IpcMainEvent, IpcMainInvokeEvent }
}

import React from 'react'
import { useIpc } from './hooks/useIpc'
import { useConnectionStore } from './store/useConnectionStore'
import { LiveCanvas } from './components/Canvas/LiveCanvas'
import { TemplateSelector } from './components/TemplateSelector'
import { ControlPanel } from './components/ControlPanel'
import { ExportButton } from './components/ExportButton'

export default function App(): React.JSX.Element {
  useIpc()

  const status = useConnectionStore((s) => s.status)
  const lastError = useConnectionStore((s) => s.lastError)
  const connect = useConnectionStore((s) => s.connect)
  const disconnect = useConnectionStore((s) => s.disconnect)
  const canvasWidth = typeof window === 'undefined' ? 1280 : window.innerWidth || 1280
  const canvasHeight = typeof window === 'undefined' ? 720 : window.innerHeight || 720
  const LiveCanvasComponent = LiveCanvas as React.ComponentType<{
    enabled: boolean
    width: number
    height: number
    showDebug?: boolean
  }>

  const statusColor: Record<typeof status, string> = {
    connected: '#4caf50',
    connecting: '#ff9800',
    reconnecting: '#ff9800',
    disconnected: '#f44336',
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 24, fontFamily: 'sans-serif' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>Nexus</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: statusColor[status] }}>● TD: {status}</span>
          {status === 'disconnected' && (
            <button onClick={() => void connect()}>Connect</button>
          )}
          {status === 'connected' && (
            <button onClick={() => void disconnect()}>Disconnect</button>
          )}
        </div>
      </header>

      {lastError && (
        <p style={{ color: '#f44336', fontSize: 12, marginBottom: 12 }}>{lastError}</p>
      )}

      <div
        style={{
          marginBottom: 16,
          minHeight: 480,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#111',
          overflow: 'hidden',
        }}
      >
        {status === 'connected' ? (
          <LiveCanvasComponent
            enabled
            width={canvasWidth}
            height={canvasHeight}
            showDebug={false}
          />
        ) : (
          <div style={{ color: '#888', fontSize: 14 }}>Connect to TouchDesigner to start LiveCanvas.</div>
        )}
      </div>

      <TemplateSelector />
      <ControlPanel />
      <ExportButton />
    </div>
  )
}

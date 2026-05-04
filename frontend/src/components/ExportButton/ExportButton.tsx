import React from 'react'
import { useTemplateStore } from '../../store/useTemplateStore'
import { useConnectionStore } from '../../store/useConnectionStore'

const DEFAULT_DURATION_SECONDS = 10

export function ExportButton(): React.JSX.Element {
  const isExporting = useTemplateStore((s) => s.isExporting)
  const exportFilePath = useTemplateStore((s) => s.exportFilePath)
  const startExport = useTemplateStore((s) => s.startExport)
  const status = useConnectionStore((s) => s.status)
  const activeTemplate = useTemplateStore((s) => s.activeTemplate)

  const disabled = isExporting || status !== 'connected' || !activeTemplate

  return (
    <div style={{ marginTop: 16 }}>
      <button
        onClick={() => void startExport(DEFAULT_DURATION_SECONDS)}
        disabled={disabled}
        style={{ padding: '8px 24px' }}
      >
        {isExporting ? 'Exporting…' : `Export (${DEFAULT_DURATION_SECONDS}s)`}
      </button>
      {exportFilePath && (
        <p style={{ fontSize: 12, color: '#888', marginTop: 4 }}>Saved: {exportFilePath}</p>
      )}
    </div>
  )
}

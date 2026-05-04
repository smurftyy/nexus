import React, { useState } from 'react'
import { useTemplateStore } from '../../store/useTemplateStore'

// Stub: full implementation should call window.nexusAPI via a new IPC channel
// (e.g. TD_OPEN_FILE_DIALOG) that invokes Electron's dialog.showOpenDialog with
// { filters: [{ name: 'TouchDesigner', extensions: ['tox'] }] }.
// For MVP the user types the path directly.
export function TemplateSelector(): React.JSX.Element {
  const [toxPath, setToxPath] = useState('')
  const loadTemplate = useTemplateStore((s) => s.loadTemplate)
  const activeTemplate = useTemplateStore((s) => s.activeTemplate)

  const handleLoad = async () => {
    const trimmed = toxPath.trim()
    if (trimmed) await loadTemplate(trimmed)
  }

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
      <input
        type="text"
        placeholder="Path to .tox file…"
        value={toxPath}
        onChange={(e) => setToxPath(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') void handleLoad() }}
        style={{ flex: 1, padding: '4px 8px' }}
      />
      <button onClick={() => void handleLoad()}>Load</button>
      {activeTemplate && (
        <span style={{ color: '#4caf50', fontSize: 12 }}>✓ {activeTemplate.name}</span>
      )}
    </div>
  )
}

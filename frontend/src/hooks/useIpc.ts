import { useEffect } from 'react'
import { useConnectionStore } from '../store/useConnectionStore'
import { useTemplateStore } from '../store/useTemplateStore'

// Wire all push events from the main process to Zustand stores.
// Call this once at the root of the component tree (App.tsx).
export function useIpc(): void {
  const setStatus = useConnectionStore((s) => s.setStatus)
  const setError = useConnectionStore((s) => s.setError)
  const setExportFilePath = useTemplateStore((s) => s.setExportFilePath)

  useEffect(() => {
    const unsubConnection = window.nexusAPI.onConnectionChanged((payload) => {
      setStatus(payload.state)
    })

    const unsubExport = window.nexusAPI.onExportComplete((payload) => {
      setExportFilePath(payload.filePath)
    })

    const unsubError = window.nexusAPI.onError((payload) => {
      setError(`[${payload.code}] ${payload.message}`)
      console.error(`[IPC Error ${payload.code}]: ${payload.message}`)
    })

    return () => {
      unsubConnection()
      unsubExport()
      unsubError()
    }
  }, [setStatus, setError, setExportFilePath])
}

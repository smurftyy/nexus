import { create } from 'zustand'
import type { ConnectionState } from '@shared/types/ipc'

interface ConnectionStore {
  status: ConnectionState
  lastError: string | null
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  setStatus: (status: ConnectionState) => void
  setError: (error: string | null) => void
}

export const useConnectionStore = create<ConnectionStore>((set) => ({
  status: 'disconnected',
  lastError: null,

  connect: async () => {
    set({ status: 'connecting', lastError: null })
    const result = await window.nexusAPI.connect()
    if (!result.success) {
      set({ status: 'disconnected', lastError: result.error ?? 'Connection failed' })
    }
    // Further status changes arrive via onConnectionChanged push events (wired in useIpc)
  },

  disconnect: async () => {
    await window.nexusAPI.disconnect()
    set({ status: 'disconnected', lastError: null })
  },

  setStatus: (status) => set({ status }),
  setError: (lastError) => set({ lastError }),
}))

import type { NexusAPI } from '@shared/types/ipc'

declare global {
  interface Window {
    nexusAPI: NexusAPI
  }
}

export {}

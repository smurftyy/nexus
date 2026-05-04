import { create } from 'zustand'
import type { TemplateMetadata } from '@shared/types/template'
import type { ControlValue } from '@shared/types/control'

interface TemplateStore {
  activeTemplate: TemplateMetadata | null
  paramValues: Record<string, ControlValue>
  isExporting: boolean
  exportFilePath: string | null
  loadError: string | null

  loadTemplate: (toxPath: string) => Promise<void>
  updateParam: (parameterId: string, value: ControlValue) => void
  startExport: (durationSeconds: number) => Promise<void>
  setExportFilePath: (filePath: string | null) => void
}

export const useTemplateStore = create<TemplateStore>((set, get) => ({
  activeTemplate: null,
  paramValues: {},
  isExporting: false,
  exportFilePath: null,
  loadError: null,

  loadTemplate: async (toxPath) => {
    set({ loadError: null })
    try {
      const result = await window.nexusAPI.loadTemplate({ toxPath })
      if (result.success && result.template) {
        const initial: Record<string, ControlValue> = {}
        for (const p of result.template.parameters) {
          initial[p.id] = p.currentValue
        }
        set({ activeTemplate: result.template, paramValues: initial, exportFilePath: null })
      } else {
        set({ loadError: 'Failed to load template' })
      }
    } catch (err) {
      set({ loadError: err instanceof Error ? err.message : 'Failed to load template' })
    }
  },

  updateParam: (parameterId, value) => {
    const { activeTemplate } = get()
    if (!activeTemplate) return

    set((s) => ({ paramValues: { ...s.paramValues, [parameterId]: value } }))

    void window.nexusAPI.sendParam({
      templateId: activeTemplate.id,
      parameterId,
      value,
    })
  },

  startExport: async (durationSeconds) => {
    const { activeTemplate, isExporting } = get()
    if (!activeTemplate || isExporting) return

    set({ isExporting: true, exportFilePath: null })

    try {
      const result = await window.nexusAPI.export({
        durationSeconds,
        filename: `${activeTemplate.id}-${Date.now()}.mp4`,
      })
      if (result.success && result.filePath) {
        set({ isExporting: false, exportFilePath: result.filePath })
      } else {
        set({ isExporting: false })
      }
    } catch {
      set({ isExporting: false })
    }
  },

  setExportFilePath: (filePath) => set({ exportFilePath: filePath }),
}))

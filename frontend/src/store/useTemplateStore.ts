import { create } from 'zustand'
import type { TemplateMetadata } from '@shared/types/template'
import type { ControlValue } from '@shared/types/control'

interface TemplateStore {
  activeTemplate: TemplateMetadata | null
  paramValues: Record<string, ControlValue>
  isExporting: boolean
  exportFilePath: string | null

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

  loadTemplate: async (toxPath) => {
    const result = await window.nexusAPI.loadTemplate({ toxPath })
    if (result.success && result.template) {
      const initial: Record<string, ControlValue> = {}
      for (const p of result.template.parameters) {
        initial[p.id] = p.currentValue
      }
      set({ activeTemplate: result.template, paramValues: initial, exportFilePath: null })
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

    const result = await window.nexusAPI.export({
      durationSeconds,
      outputDir: '',  // main process resolves outputDir from config
      filename: `${activeTemplate.id}-${Date.now()}.mp4`,
    })

    set({ isExporting: false })
    if (result.success && result.filePath) {
      set({ exportFilePath: result.filePath })
    }
  },

  setExportFilePath: (filePath) => set({ exportFilePath: filePath }),
}))

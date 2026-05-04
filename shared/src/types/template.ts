import { z } from 'zod'
import { ControlSchemaDefinition, ControlValueSchema } from './control'

export const TemplateParameterSchema = ControlSchemaDefinition.extend({
  currentValue: ControlValueSchema,
})
export type TemplateParameter = z.infer<typeof TemplateParameterSchema>

export const TemplateMetadataSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  toxPath: z.string().min(1),
  parameters: z.array(TemplateParameterSchema),
  previewImagePath: z.string().optional(),
})
export type TemplateMetadata = z.infer<typeof TemplateMetadataSchema>

// The 4 user-controlled CHOP parameters for the MVP template.
// palmX and palmY are system-driven (internal: true) — not shown in UI.
export const MVP_TEMPLATE_PARAMETERS: readonly TemplateParameter[] = Object.freeze([
  {
    id: 'spin',
    label: 'Spin',
    type: 'slider',
    range: { min: -1, max: 1, step: 0.01 },
    defaultValue: 0,
    currentValue: 0,
  },
  {
    id: 'scale',
    label: 'Scale',
    type: 'slider',
    range: { min: 0.1, max: 5, step: 0.01 },
    defaultValue: 1,
    currentValue: 1,
  },
  {
    id: 'intensity',
    label: 'Intensity',
    type: 'slider',
    range: { min: 0, max: 1, step: 0.01 },
    defaultValue: 0.5,
    currentValue: 0.5,
  },
  {
    id: 'hue',
    label: 'Hue',
    type: 'slider',
    range: { min: 0, max: 360, step: 1 },
    defaultValue: 180,
    currentValue: 180,
  },
  {
    id: 'palmX',
    label: 'Palm X',
    type: 'slider',
    range: { min: 0, max: 1, step: 0.001 },
    defaultValue: 0.5,
    currentValue: 0.5,
    internal: true,
  },
  {
    id: 'palmY',
    label: 'Palm Y',
    type: 'slider',
    range: { min: 0, max: 1, step: 0.001 },
    defaultValue: 0.5,
    currentValue: 0.5,
    internal: true,
  },
])

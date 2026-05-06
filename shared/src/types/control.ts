import { z } from 'zod'

export const ControlTypeSchema = z.enum(['slider', 'toggle', 'select'])
export type ControlType = z.infer<typeof ControlTypeSchema>

export const ControlRangeSchema = z.object({
  min: z.number().finite(),
  max: z.number().finite(),
  step: z.number().positive().finite(),
})
export type ControlRange = z.infer<typeof ControlRangeSchema>

export const SelectOptionSchema = z.object({
  label: z.string(),
  value: z.union([z.string(), z.number()]),
})
export type SelectOption = z.infer<typeof SelectOptionSchema>

export const ControlSchemaDefinition = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  type: ControlTypeSchema,
  range: ControlRangeSchema.optional(),
  options: z.array(SelectOptionSchema).optional(),
  defaultValue: z.union([z.number(), z.boolean(), z.string()]),
  internal: z.boolean().optional(),
})
export type ControlSchema = z.infer<typeof ControlSchemaDefinition>

export const ValidatedControlSchema = ControlSchemaDefinition.superRefine((val, ctx) => {
  if (val.type === 'slider' && val.range === undefined) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'slider controls must have a range', path: ['range'] })
  }
  if (val.type === 'select' && (val.options === undefined || val.options.length === 0)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'select controls must have options', path: ['options'] })
  }
  if (val.type === 'toggle' && typeof val.defaultValue !== 'boolean') {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'toggle defaultValue must be boolean', path: ['defaultValue'] })
  }
  if (val.type === 'slider' && typeof val.defaultValue !== 'number') {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'slider defaultValue must be number', path: ['defaultValue'] })
  }
})

export const ControlValueSchema = z.union([z.number(), z.boolean(), z.string()])
export type ControlValue = z.infer<typeof ControlValueSchema>

export const ParameterUpdateSchema = z.object({
  templateId: z.string().min(1),
  parameterId: z.string().min(1),
  value: ControlValueSchema,
})
export type ParameterUpdate = z.infer<typeof ParameterUpdateSchema>

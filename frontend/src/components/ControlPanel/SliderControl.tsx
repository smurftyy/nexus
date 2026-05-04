import React from 'react'
import type { TemplateParameter } from '@shared/types/template'

interface SliderControlProps {
  param: TemplateParameter
  value: number
  onChange: (value: number) => void
}

export function SliderControl({ param, value, onChange }: SliderControlProps): React.JSX.Element {
  const range = param.range ?? { min: 0, max: 1, step: 0.01 }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
      <label htmlFor={param.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>{param.label}</span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{value.toFixed(2)}</span>
      </label>
      <input
        id={param.id}
        type="range"
        min={range.min}
        max={range.max}
        step={range.step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: '100%' }}
      />
    </div>
  )
}

import React from 'react'
import { SliderControl } from './SliderControl'
import { useTemplateStore } from '../../store/useTemplateStore'

export function ControlPanel(): React.JSX.Element {
  const activeTemplate = useTemplateStore((s) => s.activeTemplate)
  const paramValues = useTemplateStore((s) => s.paramValues)
  const updateParam = useTemplateStore((s) => s.updateParam)

  if (!activeTemplate) {
    return <p style={{ color: '#888' }}>No template loaded. Use the selector above to load a .tox file.</p>
  }

  const sliderParams = activeTemplate.parameters.filter((p) => p.type === 'slider' && !p.internal)

  return (
    <div>
      {sliderParams.map((param) => (
        <SliderControl
          key={param.id}
          param={param}
          value={typeof paramValues[param.id] === 'number' ? (paramValues[param.id] as number) : (param.defaultValue as number)}
          onChange={(value) => updateParam(param.id, value)}
        />
      ))}
    </div>
  )
}

import React, { useRef, useEffect, useCallback } from 'react'
import { useHandTracking } from '../../hooks/useHandTracking'

interface LiveCanvasProps {
  enabled: boolean
  showDebug?: boolean
}

const VIDEO_WIDTH = 640
const VIDEO_HEIGHT = 480

export function LiveCanvas({ enabled, showDebug = false }: LiveCanvasProps): React.JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const { data, error } = useHandTracking({
    enabled,
    videoEl: videoRef.current,
  })

  const drawDebug = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !data) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    if (!data.detected) return

    const x = data.palmX * canvas.width
    const y = data.palmY * canvas.height

    ctx.beginPath()
    ctx.arc(x, y, 12, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(0, 255, 128, 0.8)'
    ctx.fill()
    ctx.strokeStyle = 'white'
    ctx.lineWidth = 2
    ctx.stroke()
  }, [data])

  useEffect(() => {
    if (showDebug) {
      drawDebug()
    } else {
      const canvas = canvasRef.current
      if (canvas) {
        canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
      }
    }
  }, [showDebug, drawDebug])

  useEffect(() => {
    if (!data || !enabled) return
    void window.nexusAPI.sendHandTracking(data)
  }, [data, enabled])

  return (
    <div style={{ position: 'relative', width: VIDEO_WIDTH, height: VIDEO_HEIGHT }}>
      <video
        ref={videoRef}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
        autoPlay
        playsInline
        muted
        style={{ display: 'block' }}
      />
      <canvas
        ref={canvasRef}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: 'none',
        }}
      />
      {error && (
        <p style={{ position: 'absolute', bottom: 8, left: 8, color: '#f44336', fontSize: 12, margin: 0 }}>
          {error}
        </p>
      )}
    </div>
  )
}

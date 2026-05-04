import { useEffect, useRef, useState } from 'react'
import type { HandTrackingData } from '@shared/types/ipc'

// Landmark indices that define the palm center:
// 0=wrist, 5=index_mcp, 9=middle_mcp, 13=ring_mcp, 17=pinky_mcp
const PALM_LANDMARKS = [0, 5, 9, 13, 17] as const

interface UseHandTrackingOptions {
  enabled: boolean
  videoEl: HTMLVideoElement | null
}

export interface UseHandTrackingResult {
  data: HandTrackingData | null
  error: string | null
}

export function useHandTracking({
  enabled,
  videoEl,
}: UseHandTrackingOptions): UseHandTrackingResult {
  const [result, setResult] = useState<UseHandTrackingResult>({ data: null, error: null })
  const handsRef = useRef<import('@mediapipe/hands').Hands | null>(null)
  const cameraRef = useRef<import('@mediapipe/camera_utils').Camera | null>(null)
  const lastDataRef = useRef<HandTrackingData | null>(null)

  useEffect(() => {
    if (!enabled || !videoEl) return

    let cancelled = false

    async function start() {
      try {
        const { Hands } = await import('@mediapipe/hands')
        const { Camera } = await import('@mediapipe/camera_utils')

        const hands = new Hands({
          locateFile: (file: string) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
        })

        hands.setOptions({
          maxNumHands: 1,
          modelComplexity: 1,
          minDetectionConfidence: 0.7,
          minTrackingConfidence: 0.5,
        })

        hands.onResults((results: import('@mediapipe/hands').Results) => {
          if (cancelled) return

          if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
            // No hand detected — hold last position, mark detected: false
            const held: HandTrackingData = lastDataRef.current
              ? { ...lastDataRef.current, detected: false, confidence: 0 }
              : { palmX: 0.5, palmY: 0.5, detected: false, confidence: 0 }
            lastDataRef.current = held
            setResult({ data: held, error: null })
            return
          }

          const landmarks = results.multiHandLandmarks[0]
          // Palm center = mean of PALM_LANDMARKS
          let sumX = 0
          let sumY = 0
          for (const idx of PALM_LANDMARKS) {
            sumX += landmarks[idx].x
            sumY += landmarks[idx].y
          }
          const palmX = sumX / PALM_LANDMARKS.length
          const palmY = sumY / PALM_LANDMARKS.length

          const data: HandTrackingData = {
            palmX: Math.max(0, Math.min(1, palmX)),
            palmY: Math.max(0, Math.min(1, palmY)),
            detected: true,
            confidence: 1,
          }
          lastDataRef.current = data
          setResult({ data, error: null })
        })

        handsRef.current = hands

        const camera = new Camera(videoEl!, {
          onFrame: async () => {
            if (!cancelled && handsRef.current) {
              await handsRef.current.send({ image: videoEl! })
            }
          },
          width: 640,
          height: 480,
        })

        await camera.start()
        cameraRef.current = camera
      } catch (err) {
        if (!cancelled) {
          setResult({
            data: null,
            error: err instanceof Error ? err.message : 'MediaPipe failed to load',
          })
        }
      }
    }

    void start()

    return () => {
      cancelled = true
      cameraRef.current?.stop()
      handsRef.current?.close()
      handsRef.current = null
      cameraRef.current = null
    }
  }, [enabled, videoEl])

  return result
}

import { useEffect, useRef, useState } from 'react'
import * as tf from '@tensorflow/tfjs'
import '@tensorflow/tfjs-backend-webgl'
import '@mediapipe/camera_utils'
import '@mediapipe/hands'
import {
  extractHandFeatures,
  recognizeASLLetter,
  recognizeASLWordSign,
} from '../utils/gestureRecognition'

const MIN_CONFIDENCE = 0.75
const HOLD_TIME_MS = 800
const HISTORY_SIZE = 10

const DEFAULT_HAND_CONNECTIONS = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [17, 18],
  [18, 19],
  [19, 20],
  [0, 17],
]

export function useHandDetection({ videoRef, enabled, recognitionMode = 'word' }) {
  const handsRef = useRef(null)
  const cameraRef = useRef(null)
  const holdRef = useRef({ letter: null, since: 0 })
  const wordCooldownRef = useRef({ word: null, at: 0 })
  const historyRef = useRef([])

  const [isInitializing, setIsInitializing] = useState(true)
  const [error, setError] = useState(null)
  const [landmarks, setLandmarks] = useState([])
  const [handedness, setHandedness] = useState('Right')
  const [detection, setDetection] = useState({
    letter: null,
    confidence: 0,
    latencyMs: 0,
    rawLetter: null,
    word: null,
    wordConfidence: 0,
    confidenceState: 'none',
  })

  useEffect(() => {
    if (!enabled || !videoRef.current) {
      return
    }

    let cancelled = false

    const waitForVideo = async () => {
      if (!videoRef.current) {
        return
      }

      if (videoRef.current.readyState >= 2) {
        return
      }

      await new Promise((resolve) => {
        const handleLoaded = () => {
          videoRef.current?.removeEventListener('loadeddata', handleLoaded)
          resolve()
        }
        videoRef.current?.addEventListener('loadeddata', handleLoaded)
      })
    }

    const initialize = async () => {
      setIsInitializing(true)
      setError(null)

      try {
        await tf.ready()
        if (tf.getBackend() !== 'webgl') {
          await tf.setBackend('webgl')
        }

        await waitForVideo()

        if (!videoRef.current || cancelled) {
          return
        }

        const HandsConstructor = globalThis.Hands
        const CameraConstructor = globalThis.Camera
        if (!HandsConstructor || !CameraConstructor) {
          throw new Error('MediaPipe scripts are available but constructors are missing.')
        }

        const hands = new HandsConstructor({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
        })

        hands.setOptions({
          maxNumHands: 2,
          modelComplexity: 1,
          minDetectionConfidence: 0.55,
          minTrackingConfidence: 0.55,
        })

        hands.onResults((results) => {
          if (cancelled) {
            return
          }

          const hasHand = results.multiHandLandmarks && results.multiHandLandmarks.length > 0

          if (!hasHand) {
            setLandmarks([])
            holdRef.current = { letter: null, since: 0 }
            historyRef.current = []
            setDetection({
              letter: null,
              confidence: 0,
              latencyMs: 0,
              rawLetter: null,
              word: null,
              wordConfidence: 0,
              confidenceState: 'none',
            })
            return
          }

          const nextHandednessList = results.multiHandedness || []
          const nextLandmarkList = results.multiHandLandmarks || []

          const handsForFrame = nextLandmarkList.map((landmarkSet, index) => {
            const label = nextHandednessList[index]?.label || (index === 0 ? 'Right' : 'Left')
            return {
              label,
              landmarks: landmarkSet,
              features: extractHandFeatures(landmarkSet, label),
            }
          })

          const dominantHand =
            handsForFrame.find((hand) => hand.label === 'Right') ||
            handsForFrame.find((hand) => hand.label === 'Left') ||
            handsForFrame[0]

          const nextLandmarks = dominantHand?.landmarks || []
          const nextHandedness = dominantHand?.label || 'Right'

          historyRef.current = [...historyRef.current, { timestamp: performance.now(), hands: handsForFrame }]
          if (historyRef.current.length > HISTORY_SIZE) {
            historyRef.current = historyRef.current.slice(-HISTORY_SIZE)
          }

          const detectionStart = performance.now()
          const recognition = recognizeASLLetter(nextLandmarks, nextHandedness)
          const wordRecognition =
            recognitionMode === 'word'
              ? recognizeASLWordSign(historyRef.current)
              : { word: null, confidence: 0 }
          const detectionEnd = performance.now()
          const now = performance.now()

          const isConfident = recognition.letter && recognition.confidence >= MIN_CONFIDENCE
          const isWordConfident = wordRecognition.word && wordRecognition.confidence >= MIN_CONFIDENCE

          let stableLetter = null
          let stableWord = null

          if (isConfident) {
            if (holdRef.current.letter !== recognition.letter) {
              holdRef.current = { letter: recognition.letter, since: now }
            }

            const holdDuration = now - holdRef.current.since
            if (holdDuration >= HOLD_TIME_MS) {
              stableLetter = recognition.letter
            }
          } else {
            holdRef.current = { letter: null, since: 0 }
          }

          if (isWordConfident) {
            const canEmitWord =
              wordCooldownRef.current.word !== wordRecognition.word ||
              now - wordCooldownRef.current.at > 1300

            if (canEmitWord) {
              stableWord = wordRecognition.word
              wordCooldownRef.current = { word: wordRecognition.word, at: now }
            }
          }

          setHandedness(nextHandedness)
          setLandmarks(nextLandmarks)
          setDetection({
            letter: stableLetter,
            confidence: recognition.confidence,
            latencyMs: Number((detectionEnd - detectionStart).toFixed(2)),
            rawLetter: recognition.letter,
            word: stableWord,
            wordConfidence: wordRecognition.confidence,
            confidenceState: isWordConfident || isConfident ? 'confident' : 'unsure',
          })
        })

        const camera = new CameraConstructor(videoRef.current, {
          onFrame: async () => {
            if (!cancelled) {
              await hands.send({ image: videoRef.current })
            }
          },
          width: 960,
          height: 720,
        })

        handsRef.current = hands
        cameraRef.current = camera

        await camera.start()

        if (!cancelled) {
          setIsInitializing(false)
        }
      } catch (initError) {
        setError(initError instanceof Error ? initError.message : 'Hand model failed to initialize.')
        setIsInitializing(false)
      }
    }

    initialize()

    return () => {
      cancelled = true
      historyRef.current = []
      cameraRef.current?.stop()
      cameraRef.current = null
      handsRef.current?.close()
      handsRef.current = null
    }
  }, [enabled, recognitionMode, videoRef])

  return {
    isInitializing,
    error,
    landmarks,
    handedness,
    detection,
    connections: globalThis.HAND_CONNECTIONS || DEFAULT_HAND_CONNECTIONS,
  }
}

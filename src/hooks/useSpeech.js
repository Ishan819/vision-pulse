import { useCallback, useEffect, useRef, useState } from 'react'

const DEFAULT_RATE = 1
const DEFAULT_VOLUME = 1

const normalizeTranscript = (text) => text.toLowerCase().trim()

const NATURAL_VOICE_HINTS = ['samantha', 'google us english', 'zira', 'aria', 'natural']

const pickPreferredVoice = (voices) => {
  if (!voices?.length) {
    return null
  }

  const sorted = [...voices]
  sorted.sort((a, b) => {
    const aName = a.name.toLowerCase()
    const bName = b.name.toLowerCase()

    const aHint = NATURAL_VOICE_HINTS.findIndex((hint) => aName.includes(hint))
    const bHint = NATURAL_VOICE_HINTS.findIndex((hint) => bName.includes(hint))

    const aRank = aHint === -1 ? 999 : aHint
    const bRank = bHint === -1 ? 999 : bHint

    if (aRank !== bRank) {
      return aRank - bRank
    }

    if (a.default && !b.default) {
      return -1
    }

    if (!a.default && b.default) {
      return 1
    }

    return aName.localeCompare(bName)
  })

  return sorted[0] || null
}

const parseVoiceCommand = (transcript) => {
  const normalized = normalizeTranscript(transcript)

  if (/^(clear|reset)\b/.test(normalized)) {
    return { type: 'clear' }
  }

  if (/\b(backspace|delete)\b/.test(normalized)) {
    return { type: 'backspace' }
  }

  if (/\b(space|next word)\b/.test(normalized)) {
    return { type: 'space' }
  }

  if (/\b(speech on|enable speech|voice on)\b/.test(normalized)) {
    return { type: 'speech-on' }
  }

  if (/\b(speech off|mute speech|voice off)\b/.test(normalized)) {
    return { type: 'speech-off' }
  }

  if (/\b(stop listening|voice commands off)\b/.test(normalized)) {
    return { type: 'voice-off' }
  }

  const appendLetterMatch = normalized.match(/\b(letter|add)\s+([a-z])\b/)
  if (appendLetterMatch?.[2]) {
    return { type: 'append-letter', letter: appendLetterMatch[2].toUpperCase() }
  }

  return null
}

export function useSpeech() {
  const [speechEnabled, setSpeechEnabled] = useState(true)
  const [speechRate, setSpeechRate] = useState(DEFAULT_RATE)
  const [speechVolume, setSpeechVolume] = useState(DEFAULT_VOLUME)
  const [lastSpoken, setLastSpoken] = useState('')
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isVoiceCommandActive, setIsVoiceCommandActive] = useState(false)
  const [preferredVoiceName, setPreferredVoiceName] = useState('')

  const recognitionRef = useRef(null)
  const commandHandlerRef = useRef(null)
  const preferredVoiceRef = useRef(null)

  const voiceSupported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  const speak = useCallback(
    (text, options = {}) => {
      if (!speechEnabled || !text || !window.speechSynthesis) {
        return
      }

      const asSentence = Boolean(options.asSentence)
      const normalizedText = asSentence && !/[.!?]$/.test(text.trim()) ? `${text.trim()}.` : text

      const utterance = new SpeechSynthesisUtterance(normalizedText)
      utterance.rate = asSentence ? Math.max(0.8, speechRate - 0.08) : speechRate
      utterance.volume = speechVolume
      utterance.pitch = asSentence ? 1 : 1.06

      if (preferredVoiceRef.current) {
        utterance.voice = preferredVoiceRef.current
      }

      utterance.onstart = () => setIsSpeaking(true)
      utterance.onend = () => setIsSpeaking(false)
      utterance.onerror = () => setIsSpeaking(false)

      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(utterance)
      setLastSpoken(normalizedText)
    },
    [speechEnabled, speechRate, speechVolume],
  )

  useEffect(() => {
    if (!window.speechSynthesis) {
      return
    }

    const updateVoice = () => {
      const voices = window.speechSynthesis.getVoices()
      const preferred = pickPreferredVoice(voices)
      preferredVoiceRef.current = preferred
      setPreferredVoiceName(preferred?.name || '')
    }

    updateVoice()
    window.speechSynthesis.addEventListener('voiceschanged', updateVoice)

    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', updateVoice)
    }
  }, [])

  const stopVoiceCommands = useCallback(() => {
    const recognition = recognitionRef.current
    if (recognition) {
      recognition.onend = null
      recognition.stop()
      recognitionRef.current = null
    }
    setIsVoiceCommandActive(false)
  }, [])

  const startVoiceCommands = useCallback(
    (onCommand) => {
      if (!voiceSupported || isVoiceCommandActive) {
        return
      }

      const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition
      if (!Recognition) {
        return
      }

      commandHandlerRef.current = onCommand
      const recognition = new Recognition()
      recognition.lang = 'en-US'
      recognition.continuous = true
      recognition.interimResults = false

      recognition.onresult = (event) => {
        const result = event.results[event.results.length - 1]
        if (!result?.[0]?.transcript) {
          return
        }

        const parsed = parseVoiceCommand(result[0].transcript)
        if (parsed && commandHandlerRef.current) {
          commandHandlerRef.current(parsed)
        }
      }

      recognition.onerror = () => {
        setIsVoiceCommandActive(false)
      }

      recognition.onend = () => {
        if (recognitionRef.current) {
          recognition.start()
        }
      }

      recognitionRef.current = recognition
      recognition.start()
      setIsVoiceCommandActive(true)
    },
    [isVoiceCommandActive, voiceSupported],
  )

  useEffect(() => {
    return () => {
      stopVoiceCommands()
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel()
      }
    }
  }, [stopVoiceCommands])

  return {
    speechEnabled,
    setSpeechEnabled,
    speechRate,
    setSpeechRate,
    speechVolume,
    setSpeechVolume,
    speak,
    lastSpoken,
    isSpeaking,
    preferredVoiceName,
    voiceSupported,
    isVoiceCommandActive,
    startVoiceCommands,
    stopVoiceCommands,
  }
}

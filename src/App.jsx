import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import Camera from './components/Camera'
import Controls from './components/Controls'
import PhraseBoard from './components/PhraseBoard'
import SentenceBuilder from './components/SentenceBuilder'
import SpeechOutput from './components/SpeechOutput'
import { useCamera } from './hooks/useCamera'
import { useHandDetection } from './hooks/useHandDetection'
import { useSpeech } from './hooks/useSpeech'

const WORD_IDLE_MS = 1500
const SENTENCE_IDLE_MS = 3000
const HINT_IDLE_MS = 3000
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

const SUGGESTION_WORDS = [
  'hello',
  'help',
  'hey',
  'here',
  'how',
  'are',
  'you',
  'yes',
  'no',
  'please',
  'thanks',
  'thank',
  'today',
  'tomorrow',
  'good',
  'great',
  'fine',
  'name',
  'need',
  'water',
  'food',
  'family',
  'friend',
  'school',
  'work',
  'home',
  'happy',
  'sorry',
  'love',
  'want',
  'where',
  'when',
  'what',
  'why',
  'can',
  'cannot',
  'ready',
  'all',
  'done',
  'bathroom',
  'morning',
  'night',
]

const LETTER_HINTS = {
  A: 'Fist with thumb to the side.',
  B: 'All fingers up, thumb tucked.',
  C: 'Curve your hand like holding a cup.',
  I: 'Only pinky finger up.',
  L: 'Index up and thumb out like an L shape.',
  O: 'Curve fingers to touch thumb.',
  V: 'Peace sign with index and middle fingers.',
  Y: 'Thumb and pinky out, middle fingers down.',
}

const toReadableSentence = (words, currentWord = '') => {
  const tokens = [...words]
  const trailing = currentWord.trim().toLowerCase()

  if (trailing) {
    tokens.push(trailing)
  }

  if (!tokens.length) {
    return ''
  }

  const sentence = tokens.join(' ')
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}`
}

const withSentencePunctuation = (text) => {
  const trimmed = text.trim()
  if (!trimmed) {
    return ''
  }

  if (/[.!?]$/.test(trimmed)) {
    return trimmed
  }

  return `${trimmed}.`
}

function App() {
  const [words, setWords] = useState([])
  const [currentWord, setCurrentWord] = useState('')
  const [highContrast, setHighContrast] = useState(false)
  const [recognitionMode, setRecognitionMode] = useState('word')
  const [suggestions, setSuggestions] = useState([])
  const [practiceMode, setPracticeMode] = useState(false)
  const [practiceIndex, setPracticeIndex] = useState(0)
  const [practiceScore, setPracticeScore] = useState({ correct: 0, total: 0 })
  const [practiceFeedback, setPracticeFeedback] = useState('idle')
  const [idleHint, setIdleHint] = useState('')

  const appendGuardRef = useRef({ letter: null, at: 0 })
  const wordGuardRef = useRef({ word: null, at: 0 })
  const idleRef = useRef({
    lastInputAt: 0,
    wordCommitted: false,
    sentenceCommitted: false,
    lastSentenceSpokenAt: 0,
    lastGestureAt: 0,
  })

  const wordsRef = useRef([])
  const currentWordRef = useRef('')

  const { videoRef, isActive, error: cameraError, startCamera, stopCamera } = useCamera()
  const { isInitializing, error: detectionError, landmarks, handedness, detection, connections } =
    useHandDetection({ videoRef, enabled: isActive, recognitionMode })

  const {
    speechEnabled,
    setSpeechEnabled,
    speechRate,
    setSpeechRate,
    speechVolume,
    setSpeechVolume,
    speak,
    lastSpoken,
    isSpeaking,
    voiceSupported,
    isVoiceCommandActive,
    startVoiceCommands,
    stopVoiceCommands,
    preferredVoiceName,
  } = useSpeech()

  useEffect(() => {
    wordsRef.current = words
  }, [words])

  useEffect(() => {
    currentWordRef.current = currentWord
  }, [currentWord])

  useEffect(() => {
    startCamera()
    return () => {
      stopVoiceCommands()
      stopCamera()
    }
  }, [startCamera, stopCamera, stopVoiceCommands])

  const appendLetter = useCallback((letter) => {
    if (!letter) {
      return
    }

    const normalized = letter.toLowerCase()
    const nextWord = `${currentWordRef.current}${normalized}`
    currentWordRef.current = nextWord
    setCurrentWord(nextWord)

    idleRef.current.lastInputAt = Date.now()
    idleRef.current.wordCommitted = false
    idleRef.current.sentenceCommitted = false
  }, [])

  const commitWord = useCallback(
    ({ speakWord = true, overrideWord = null } = {}) => {
      const candidate = (overrideWord ?? currentWordRef.current).trim().toLowerCase()
      if (!candidate) {
        return ''
      }

      const nextWords = [...wordsRef.current, candidate]
      wordsRef.current = nextWords
      currentWordRef.current = ''
      setWords(nextWords)
      setCurrentWord('')

      if (speakWord) {
        speak(candidate, { asSentence: false })
      }

      return candidate
    },
    [speak],
  )

  const appendWord = useCallback(
    (word, speakWord = true) => {
      const normalized = word?.trim().toLowerCase()
      if (!normalized) {
        return
      }

      if (currentWordRef.current) {
        commitWord({ speakWord: false })
      }

      const nextWords = [...wordsRef.current, normalized]
      wordsRef.current = nextWords
      setWords(nextWords)

      if (speakWord) {
        speak(normalized, { asSentence: false })
      }
    },
    [commitWord, speak],
  )

  const finalizeSentence = useCallback(() => {
    commitWord({ speakWord: false })

    const readable = toReadableSentence(wordsRef.current)
    if (!readable) {
      return
    }

    const punctuated = withSentencePunctuation(readable)
    const now = Date.now()

    if (now - idleRef.current.lastSentenceSpokenAt > 900) {
      speak(punctuated, { asSentence: true })
      idleRef.current.lastSentenceSpokenAt = now
    }
  }, [commitWord, speak])

  const handleClear = useCallback(() => {
    wordsRef.current = []
    currentWordRef.current = ''
    setWords([])
    setCurrentWord('')
    idleRef.current.wordCommitted = false
    idleRef.current.sentenceCommitted = false
  }, [])

  const handleBackspace = useCallback(() => {
    if (currentWordRef.current.length > 0) {
      const nextWord = currentWordRef.current.slice(0, -1)
      currentWordRef.current = nextWord
      setCurrentWord(nextWord)
      return
    }

    if (!wordsRef.current.length) {
      return
    }

    const lastWord = wordsRef.current[wordsRef.current.length - 1]
    const remainingWords = wordsRef.current.slice(0, -1)
    const nextWord = lastWord.slice(0, -1)

    wordsRef.current = remainingWords
    currentWordRef.current = nextWord
    setWords(remainingWords)
    setCurrentWord(nextWord)
  }, [])

  const handleInsertSpace = useCallback(() => {
    commitWord({ speakWord: true })
  }, [commitWord])

  const handleSpeakNow = useCallback(() => {
    commitWord({ speakWord: false })
    const readable = toReadableSentence(wordsRef.current)
    if (!readable) {
      return
    }
    speak(withSentencePunctuation(readable), { asSentence: true })
  }, [commitWord, speak])

  const handleSpeakWord = useCallback(
    (word) => {
      if (!word) {
        return
      }
      speak(word, { asSentence: false })
    },
    [speak],
  )

  const handleSpeakPhrase = useCallback(
    (phrase) => {
      if (!phrase) {
        return
      }
      speak(withSentencePunctuation(phrase), { asSentence: true })
    },
    [speak],
  )

  const handleSuggestionPick = useCallback(
    (word) => {
      if (!word) {
        return
      }

      currentWordRef.current = word.toLowerCase()
      setCurrentWord(word.toLowerCase())
      commitWord({ speakWord: true, overrideWord: word })
      idleRef.current.wordCommitted = true
    },
    [commitWord],
  )

  const handleVoiceCommand = useCallback(
    (command) => {
    if (!command) {
      return
    }

    switch (command.type) {
      case 'clear':
        handleClear()
        break
      case 'backspace':
        handleBackspace()
        break
      case 'space':
        handleInsertSpace()
        break
      case 'speech-on':
        setSpeechEnabled(true)
        break
      case 'speech-off':
        setSpeechEnabled(false)
        break
      case 'append-letter':
        appendLetter(command.letter)
        break
      case 'voice-off':
        stopVoiceCommands()
        break
      default:
        break
    }
    },
    [appendLetter, handleBackspace, handleClear, handleInsertSpace, setSpeechEnabled, stopVoiceCommands],
  )

  const handleVoiceToggle = useCallback(() => {
    if (isVoiceCommandActive) {
      stopVoiceCommands()
      return
    }

    startVoiceCommands(handleVoiceCommand)
  }, [handleVoiceCommand, isVoiceCommandActive, startVoiceCommands, stopVoiceCommands])

  useEffect(() => {
    if (detection.word || detection.rawLetter) {
      idleRef.current.lastGestureAt = Date.now()
      setIdleHint('')
    }

    if (recognitionMode === 'word' && detection.word) {
      const now = Date.now()
      const isDuplicateWord = wordGuardRef.current.word === detection.word
      const cooldownComplete = now - wordGuardRef.current.at > 1300

      if (!isDuplicateWord || cooldownComplete) {
        appendWord(detection.word, true)
        wordGuardRef.current = { word: detection.word, at: now }
      }
      return
    }

    if (!detection.letter || detection.confidence < 0.75) {
      return
    }

    const now = Date.now()
    const isDuplicateLetter = appendGuardRef.current.letter === detection.letter
    const isCooldownComplete = now - appendGuardRef.current.at > 900

    if (!isDuplicateLetter || isCooldownComplete) {
      appendLetter(detection.letter)
      appendGuardRef.current = { letter: detection.letter, at: now }
    }
  }, [appendLetter, appendWord, detection, recognitionMode])

  useEffect(() => {
    if (!practiceMode) {
      setPracticeFeedback('idle')
      return
    }

    if (!detection.letter) {
      return
    }

    const target = ALPHABET[practiceIndex]
    setPracticeScore((prev) => {
      const total = prev.total + 1
      if (detection.letter === target) {
        setPracticeFeedback('correct')
        setPracticeIndex((prevIndex) => (prevIndex + 1) % ALPHABET.length)
        return { correct: prev.correct + 1, total }
      }

      setPracticeFeedback('wrong')
      return { ...prev, total }
    })

    const timeoutId = window.setTimeout(() => {
      setPracticeFeedback('idle')
    }, 900)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [detection.letter, practiceIndex, practiceMode])

  useEffect(() => {
    if (!currentWord) {
      setSuggestions([])
      return
    }

    const prefix = currentWord.toLowerCase()
    const nextSuggestions = SUGGESTION_WORDS.filter(
      (word) => word.startsWith(prefix) && word !== prefix,
    ).slice(0, 4)
    setSuggestions(nextSuggestions)
  }, [currentWord])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const lastInputAt = idleRef.current.lastInputAt
      if (!lastInputAt) {
        return
      }

      const idleMs = Date.now() - lastInputAt

      if (!idleRef.current.wordCommitted && idleMs >= WORD_IDLE_MS) {
        commitWord({ speakWord: true })
        idleRef.current.wordCommitted = true
      }

      if (
        !idleRef.current.sentenceCommitted &&
        idleMs >= SENTENCE_IDLE_MS &&
        (wordsRef.current.length > 0 || currentWordRef.current.length > 0)
      ) {
        finalizeSentence()
        idleRef.current.sentenceCommitted = true
      }
    }, 150)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [commitWord, finalizeSentence])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const lastGestureAt = idleRef.current.lastGestureAt
      if (!lastGestureAt || Date.now() - lastGestureAt < HINT_IDLE_MS) {
        return
      }

      const target = practiceMode ? ALPHABET[practiceIndex] : 'L'
      const tip = LETTER_HINTS[target] || 'Keep hand steady and centered for better tracking.'
      setIdleHint(`Hint: ${tip}`)
    }, 350)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [practiceIndex, practiceMode])

  useEffect(() => {
    const handleKeydown = (event) => {
      if (!event.altKey) {
        return
      }

      const key = event.key.toLowerCase()

      if (key === 'c') {
        event.preventDefault()
        handleClear()
      }

      if (key === 's') {
        event.preventDefault()
        handleInsertSpace()
      }

      if (event.key === 'Backspace') {
        event.preventDefault()
        handleBackspace()
      }

      if (key === 'v') {
        event.preventDefault()
        handleVoiceToggle()
      }

      if (key === 'p') {
        event.preventDefault()
        setSpeechEnabled((prev) => !prev)
      }

      if (key === 'h') {
        event.preventDefault()
        setHighContrast((prev) => !prev)
      }
    }

    window.addEventListener('keydown', handleKeydown)
    return () => {
      window.removeEventListener('keydown', handleKeydown)
    }
  }, [handleBackspace, handleClear, handleInsertSpace, handleVoiceToggle, setSpeechEnabled])

  const sentence = toReadableSentence(words, currentWord)
  const sentenceWords = sentence ? sentence.split(' ') : []
  const practiceTarget = ALPHABET[practiceIndex]
  const referenceLetter = detection.word ? detection.word.toUpperCase() : detection.letter || detection.rawLetter || practiceTarget
  const referenceHint =
    LETTER_HINTS[referenceLetter] || 'Hold sign for 0.8 seconds to register with high confidence.'
  const displayToken = detection.word ? detection.word.toUpperCase() : detection.letter
  const displayConfidence = detection.word ? detection.wordConfidence : detection.confidence

  return (
    <main className={`app-shell ${highContrast ? 'high-contrast' : ''}`}>
      <header className="app-header">
        <p className="eyebrow">Vision Pulse</p>
        <h1>AI Sign Language Interpreter</h1>
        <p className="tagline">
          Real-time ASL gesture recognition with live hand tracking, sentence building, and instant
          speech output.
        </p>
      </header>

      <section className="workspace-grid">
        <Camera
          videoRef={videoRef}
          landmarks={landmarks}
          connections={connections}
          isInitializing={isInitializing}
          error={detectionError}
          cameraError={cameraError}
          confidenceState={detection.confidenceState}
        />

        <div className="stacked-panels">
          <SentenceBuilder
            letter={displayToken}
            confidence={displayConfidence}
            latencyMs={detection.latencyMs}
            handedness={handedness}
            sentenceWords={sentenceWords}
            currentWord={currentWord}
            suggestions={suggestions}
            isSpeaking={isSpeaking}
            onSpeakNow={handleSpeakNow}
            onSpeakWord={handleSpeakWord}
            onClear={handleClear}
            onBackspace={handleBackspace}
            onInsertSpace={handleInsertSpace}
            onPickSuggestion={handleSuggestionPick}
            practiceMode={practiceMode}
            practiceTarget={practiceTarget}
            practiceFeedback={practiceFeedback}
            referenceLetter={referenceLetter}
            referenceHint={referenceHint}
            idleHint={idleHint}
          />

          <SpeechOutput
            speechEnabled={speechEnabled}
            isSpeaking={isSpeaking}
            lastSpoken={lastSpoken}
            preferredVoiceName={preferredVoiceName}
            voiceSupported={voiceSupported}
            isVoiceCommandActive={isVoiceCommandActive}
            onToggleSpeech={() => setSpeechEnabled((prev) => !prev)}
            onToggleVoiceCommands={handleVoiceToggle}
          />

          <Controls
            speechRate={speechRate}
            speechVolume={speechVolume}
            onRateChange={setSpeechRate}
            onVolumeChange={setSpeechVolume}
            highContrast={highContrast}
            onToggleContrast={() => setHighContrast((prev) => !prev)}
            practiceMode={practiceMode}
            onTogglePracticeMode={() => setPracticeMode((prev) => !prev)}
            practiceScore={practiceScore}
            recognitionMode={recognitionMode}
            onToggleRecognitionMode={() =>
              setRecognitionMode((prev) => (prev === 'word' ? 'letter' : 'word'))
            }
          />

          <PhraseBoard onSpeakPhrase={handleSpeakPhrase} />
        </div>
      </section>
    </main>
  )
}

export default App

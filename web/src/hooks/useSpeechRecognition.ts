import { useCallback, useEffect, useRef, useState } from 'react'

type RecognitionAlternative = {
  transcript: string
}

type RecognitionResult = {
  readonly isFinal: boolean
  readonly length: number
  readonly [index: number]: RecognitionAlternative
}

type RecognitionEvent = Event & {
  readonly resultIndex: number
  readonly results: ArrayLike<RecognitionResult>
}

type RecognitionErrorEvent = Event & {
  readonly error: string
}

type RecognitionInstance = EventTarget & {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onstart: (() => void) | null
  onend: (() => void) | null
  onresult: ((event: RecognitionEvent) => void) | null
  onerror: ((event: RecognitionErrorEvent) => void) | null
  addEventListener(type: 'result', listener: (event: RecognitionEvent) => void): void
  addEventListener(type: 'error', listener: (event: RecognitionErrorEvent) => void): void
  addEventListener(type: 'start' | 'end', listener: () => void): void
}

type RecognitionConstructor = {
  new (): RecognitionInstance
}

declare global {
  interface Window {
    SpeechRecognition?: RecognitionConstructor
    webkitSpeechRecognition?: RecognitionConstructor
  }
}

type SpeechOptions = {
  languageTag: string
  onInterim: (text: string) => void
  onFinal: (hypotheses: string[]) => void
  onError: (message: string) => void
}

export function useSpeechRecognition({ languageTag, onInterim, onFinal, onError }: SpeechOptions) {
  const recognitionRef = useRef<RecognitionInstance | null>(null)
  const callbacksRef = useRef({ onInterim, onFinal, onError })
  const [listening, setListening] = useState(false)
  const Constructor = window.SpeechRecognition ?? window.webkitSpeechRecognition
  const supported = Constructor !== undefined

  useEffect(() => {
    callbacksRef.current = { onInterim, onFinal, onError }
  }, [onError, onFinal, onInterim])

  useEffect(() => {
    return () => recognitionRef.current?.abort()
  }, [])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
  }, [])

  const start = useCallback(() => {
    if (!Constructor) {
      callbacksRef.current.onError('Speech Recognition API is not supported by this browser')
      return
    }
    recognitionRef.current?.abort()
    const recognition = new Constructor()
    recognition.lang = languageTag
    recognition.continuous = false
    recognition.interimResults = true
    recognition.maxAlternatives = 8
    recognition.addEventListener('start', () => setListening(true))
    recognition.addEventListener('end', () => setListening(false))
    recognition.addEventListener('error', (event) => {
      setListening(false)
      const messages: Record<string, string> = {
        'no-speech': 'Речь не услышана',
        'audio-capture': 'Микрофон недоступен',
        'not-allowed': 'Доступ к микрофону не разрешён',
        network: 'Ошибка сети при распознавании речи',
        aborted: 'Распознавание остановлено',
      }
      callbacksRef.current.onError(messages[event.error] ?? `Ошибка распознавания: ${event.error}`)
    })
    recognition.addEventListener('result', (event) => {
      const current = event.results[event.resultIndex]
      if (!current) return
      const hypotheses = Array.from(
        { length: current.length },
        (_, index) => current[index]?.transcript.trim() ?? '',
      ).filter(Boolean)
      if (current.isFinal) callbacksRef.current.onFinal(hypotheses)
      else callbacksRef.current.onInterim(hypotheses[0] ?? '')
    })
    recognitionRef.current = recognition
    recognition.start()
  }, [Constructor, languageTag])

  return { supported, listening, start, stop }
}

import { useMediaQuery, useTheme } from '@mui/material'
import { useCallback, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router'

import { ControlStationLayout } from './components/ControlStationLayout'
import { ControlStationRoutes } from './components/ControlStationRoutes'
import { pageFromPath, pagePath } from './components/layout/Navigation'
import type { PiDogStatusKind } from './components/layout/PiDogStatus'
import { useAssistantController } from './hooks/useAssistantController'
import { useCommandDispatcher } from './hooks/useCommandDispatcher'
import { useMotionControls } from './hooks/useMotionControls'
import { useSpeechRecognition } from './hooks/useSpeechRecognition'
import { useVisionEnrollment } from './hooks/useVisionEnrollment'
import { type ConnectionSettings, normalizeHost, pidogApi, saveSettings } from './lib/api'
import { type Language } from './lib/commands'
import { isConnectivityError } from './lib/connectivity'
import { errorMessage, tr, timeNow } from './lib/i18n'
import { matchVoiceCommand } from './lib/voiceCommands'
import { useControlStationStore } from './stores/controlStationStore'
import type { SpeechTarget } from './types/ui'

export function ControlStation() {
  const theme = useTheme()
  const small = useMediaQuery(theme.breakpoints.down('md'))
  const location = useLocation()
  const navigate = useNavigate()
  const page = pageFromPath(location.pathname)
  const station = useControlStationStore()
  const {
    language,
    settings,
    draftSettings,
    connectionOpen,
    connected,
    connecting,
    health,
    sensors,
    sensorHistory,
    busyCommand,
    notice,
    streaming,
    streamNonce,
    visionLog,
    assistantStatus,
    recognized,
    voiceMatch,
    speechTarget,
    dogStatus,
    setLanguage,
    setSettings,
    setDraftSettings,
    setConnectionOpen,
    setConnected,
    setConnecting,
    setHealth,
    setSensors,
    setSensorHistory,
    setBusyCommand,
    setNotice,
    setStreaming,
    setStreamNonce,
    setVisionLog,
    setAssistantStatus,
    setRecognized,
    setVoiceMatch,
    setSpeechTarget,
    setDogStatus,
  } = station

  const speechTargetRef = useRef<SpeechTarget>('command')
  const autoConnectRef = useRef(false)
  const dogStatusRequestRef = useRef(0)

  const beginDogStatus = useCallback(
    (kind: PiDogStatusKind, message: string) => {
      const request = dogStatusRequestRef.current + 1
      dogStatusRequestRef.current = request
      setDogStatus({ kind, message })
      return request
    },
    [setDogStatus],
  )

  const finishDogStatus = useCallback(
    (request: number, kind: PiDogStatusKind, message: string) => {
      if (request === dogStatusRequestRef.current) setDogStatus({ kind, message })
    },
    [setDogStatus],
  )

  const markDisconnected = useCallback(
    (error?: unknown) => {
      setConnected(false)
      setHealth(null)
      setStreaming(false)
      setConnectionOpen(true)
      if (error) setNotice({ message: errorMessage(error), severity: 'error' })
      beginDogStatus(
        'error',
        error ? errorMessage(error) : tr(language, 'Нет подключения к Пайдогу', 'PiDog is offline'),
      )
    },
    [beginDogStatus, language, setConnected, setConnectionOpen, setHealth, setNotice, setStreaming],
  )

  const addVisionEntry = useCallback(
    (title: string, detail: string, success: boolean) => {
      setVisionLog((current) =>
        [
          { id: Date.now() + Math.random(), time: timeNow(), title, detail, success },
          ...current,
        ].slice(0, 10),
      )
    },
    [setVisionLog],
  )

  const refreshSensors = useCallback(
    async (announce = false) => {
      if (!connected) return
      const statusRequest = announce
        ? beginDogStatus('working', tr(language, 'Читаю датчики…', 'Reading sensors…'))
        : 0
      try {
        const next = await pidogApi.sensors(settings)
        setSensors(next)
        const distance = next.distance_cm
        if (distance != null) setSensorHistory((current) => [...current, distance].slice(-18))
        if (announce)
          setNotice({
            message: tr(language, 'Сенсоры обновлены', 'Sensors updated'),
            severity: 'success',
          })
        if (announce)
          finishDogStatus(
            statusRequest,
            'success',
            tr(language, 'Датчики обновлены', 'Sensors updated'),
          )
      } catch (error) {
        if (isConnectivityError(error)) markDisconnected(error)
        else if (announce) {
          setNotice({ message: errorMessage(error), severity: 'error' })
          finishDogStatus(statusRequest, 'error', errorMessage(error))
        }
      }
    },
    [
      beginDogStatus,
      connected,
      finishDogStatus,
      language,
      markDisconnected,
      setNotice,
      setSensorHistory,
      setSensors,
      settings,
    ],
  )

  const refreshAssistant = useCallback(
    async (announce = false) => {
      if (!connected) return
      const statusRequest = announce
        ? beginDogStatus('working', tr(language, 'Проверяю локальную LLM…', 'Checking local LLM…'))
        : 0
      try {
        const response = await pidogApi.assistantStatus(settings)
        setAssistantStatus(response.assistant)
        if (announce)
          setNotice({
            message: tr(language, 'Состояние LLM обновлено', 'LLM status updated'),
            severity: 'success',
          })
        if (announce)
          finishDogStatus(
            statusRequest,
            'success',
            tr(language, 'Состояние LLM обновлено', 'LLM status updated'),
          )
      } catch (error) {
        if (isConnectivityError(error)) markDisconnected(error)
        else if (announce) {
          setNotice({ message: errorMessage(error), severity: 'error' })
          finishDogStatus(statusRequest, 'error', errorMessage(error))
        }
      }
    },
    [
      beginDogStatus,
      connected,
      finishDogStatus,
      language,
      markDisconnected,
      setAssistantStatus,
      setNotice,
      settings,
    ],
  )

  const connect = useCallback(
    async (endpoint: ConnectionSettings, announce = true) => {
      setConnecting(true)
      const statusRequest = beginDogStatus(
        'working',
        tr(language, 'Подключаюсь к Пайдогу…', 'Connecting to PiDog…'),
      )
      try {
        const nextHealth = await pidogApi.health(endpoint)
        setSettings(endpoint)
        saveSettings(endpoint)
        setHealth(nextHealth)
        setConnected(true)
        const [nextSensors, nextAssistant] = await Promise.all([
          pidogApi.sensors(endpoint).catch(() => null),
          pidogApi.assistantStatus(endpoint).catch(() => null),
        ])
        if (nextSensors) {
          setSensors(nextSensors)
          if (nextSensors.distance_cm != null) setSensorHistory([nextSensors.distance_cm])
          setStreaming(nextSensors.camera)
        }
        if (nextAssistant) setAssistantStatus(nextAssistant.assistant)
        if (announce)
          setNotice({
            message: nextHealth.dry_run
              ? tr(language, 'Подключено в dry-run режиме', 'Connected in dry-run mode')
              : tr(language, 'Пайдог на связи', 'PiDog is online'),
            severity: 'success',
          })
        finishDogStatus(
          statusRequest,
          'success',
          nextHealth.dry_run
            ? tr(language, 'Подключено в dry-run режиме', 'Connected in dry-run mode')
            : tr(language, 'Пайдог на связи', 'PiDog is online'),
        )
        return true
      } catch (error) {
        markDisconnected(announce ? error : undefined)
        return false
      } finally {
        setConnecting(false)
      }
    },
    [
      beginDogStatus,
      finishDogStatus,
      language,
      markDisconnected,
      setAssistantStatus,
      setConnected,
      setConnecting,
      setHealth,
      setNotice,
      setSensorHistory,
      setSensors,
      setSettings,
      setStreaming,
    ],
  )

  useEffect(() => {
    if (autoConnectRef.current) return undefined
    autoConnectRef.current = true
    const timer = window.setTimeout(() => {
      if (settings.host) void connect(settings, false)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [connect, settings])

  useEffect(() => {
    if (!connected) return undefined
    const timer = window.setInterval(() => void refreshSensors(false), 12_000)
    return () => window.clearInterval(timer)
  }, [connected, refreshSensors])

  const sendCommand = useCommandDispatcher({
    connected,
    settings,
    language,
    onConnectionNeeded: () => setConnectionOpen(true),
    onBusyCommand: setBusyCommand,
    onNotice: setNotice,
    onStreaming: setStreaming,
    onStreamRefresh: () => setStreamNonce((value) => value + 1),
    onVisionEntry: addVisionEntry,
    onDisconnected: markDisconnected,
    refreshSensors: () => refreshSensors(false),
    beginStatus: beginDogStatus,
    finishStatus: finishDogStatus,
    isConnectivityError,
  })
  const { moveJoystick, moveHead, emergencyStop } = useMotionControls({
    page,
    connected,
    settings,
    sendCommand,
    onDisconnected: markDisconnected,
    onError: (message) => setNotice({ message, severity: 'error' }),
    isConnectivityError,
  })

  const assistant = useAssistantController({
    connected,
    settings,
    language,
    refresh: () => refreshAssistant(false),
    beginStatus: beginDogStatus,
    finishStatus: finishDogStatus,
    onDisconnected: markDisconnected,
    onConnectionNeeded: () => setConnectionOpen(true),
    onNotice: (message, severity) => setNotice({ message, severity }),
    onStatus: setAssistantStatus,
    isConnectivityError,
  })

  const speech = useSpeechRecognition({
    languageTag: language === 'en' ? 'en-US' : 'ru-RU',
    onInterim: setRecognized,
    onFinal: (hypotheses) => {
      const first = hypotheses[0] ?? ''
      setRecognized(first)
      if (speechTargetRef.current === 'assistant') {
        assistant.setQuestion(first)
        void assistant.ask(first)
        return
      }
      const match = matchVoiceCommand(hypotheses, language)
      setVoiceMatch(match)
      if (match) void sendCommand(match.command, match.sourcePhrase)
      else
        setNotice({
          message: tr(
            language,
            'Команда не распознана — ничего не отправлено',
            'Command not recognized — nothing was sent',
          ),
          severity: 'warning',
        })
    },
    onError: (message) => {
      setNotice({ message, severity: 'error' })
      beginDogStatus('error', message)
    },
  })

  const startSpeech = (target: SpeechTarget) => {
    speechTargetRef.current = target
    setSpeechTarget(target)
    setRecognized('')
    if (target === 'command') setVoiceMatch(null)
    if (speech.listening) {
      speech.stop()
      beginDogStatus('idle', tr(language, 'Готов к командам', 'Ready for commands'))
    } else {
      beginDogStatus(
        'listening',
        target === 'assistant'
          ? tr(language, 'Слушаю вопрос…', 'Listening for a question…')
          : tr(language, 'Слушаю команду…', 'Listening for a command…'),
      )
      speech.start()
    }
  }

  const changeLanguage = (next: Language) => {
    setLanguage(next)
  }

  const saveConnection = async () => {
    const endpoint: ConnectionSettings = {
      host: normalizeHost(draftSettings.host),
      port: draftSettings.port,
      token: draftSettings.token,
    }
    if (!endpoint.host || endpoint.port < 1 || endpoint.port > 65_535) {
      setNotice({
        message: tr(language, 'Проверьте адрес и порт', 'Check the address and port'),
        severity: 'error',
      })
      return
    }
    if (await connect(endpoint)) setConnectionOpen(false)
  }

  const onCommand = (command: string) => void sendCommand(command)
  const { enrollFace, enrollObject } = useVisionEnrollment({
    connected,
    language,
    settings,
    onNotice: setNotice,
  })
  const content = (
    <ControlStationRoutes
      cockpit={{
        language,
        connected,
        sensors,
        streaming,
        streamNonce,
        settings,
        busyCommand,
        visionLog,
        onCommand,
        onMove: moveJoystick,
        onHead: moveHead,
        onStop: emergencyStop,
        onRefreshStream: () => setStreamNonce((value) => value + 1),
        onClearLog: () => setVisionLog([]),
      }}
      vision={{
        language,
        connected,
        configured: health?.remote_vision?.configured === true,
        streaming,
        streamNonce,
        settings,
        onCommand,
        onEnroll: enrollFace,
        onEnrollObject: enrollObject,
        onHead: moveHead,
      }}
      voice={{
        language,
        supported: speech.supported,
        listening: speech.listening,
        recognized,
        match: voiceMatch,
        connected,
        busyCommand,
        onToggleSpeech: () => startSpeech('command'),
        onCommand,
      }}
      commands={{ language, busyCommand, onCommand }}
      sensors={{
        language,
        sensors,
        history: sensorHistory,
        connected,
        onRefresh: () => void refreshSensors(true),
        onCommand,
      }}
      assistant={{
        language,
        status: assistantStatus,
        connected,
        busy: assistant.busy,
        question: assistant.question,
        reply: assistant.reply,
        search: assistant.search,
        speak: assistant.speak,
        speechSupported: speech.supported,
        speechListening: speech.listening && speechTarget === 'assistant',
        onQuestion: assistant.setQuestion,
        onSearch: assistant.setSearch,
        onSpeak: assistant.setSpeak,
        onAsk: () => void assistant.ask(),
        onSpeech: () => startSpeech('assistant'),
        onRefresh: () => void refreshAssistant(true),
        onControl: (action) => void assistant.control(action),
        onClear: () => void assistant.clear(),
      }}
    />
  )

  return (
    <ControlStationLayout
      small={small}
      page={page}
      language={language}
      connected={connected}
      health={health}
      status={dogStatus}
      content={content}
      draftSettings={draftSettings}
      connectionOpen={connectionOpen}
      connecting={connecting}
      notice={notice}
      onPage={(nextPage) => void navigate(pagePath(nextPage))}
      onLanguage={changeLanguage}
      onConnection={() => {
        setDraftSettings(settings)
        setConnectionOpen(true)
      }}
      onStop={emergencyStop}
      onDraftSettings={setDraftSettings}
      onCloseConnection={() => {
        if (connected) setConnectionOpen(false)
      }}
      onSaveConnection={() => void saveConnection()}
      onCloseNotice={() => setNotice(null)}
    />
  )
}

import { Alert, Box, Snackbar, useMediaQuery, useTheme } from '@mui/material'
import { useCallback, useEffect, useRef, useState } from 'react'

import { ConnectionDialog } from './components/ConnectionDialog'
import { AppHeader } from './components/layout/AppHeader'
import { MobileNavigation, NavigationRail } from './components/layout/Navigation'
import type { PiDogStatus, PiDogStatusKind } from './components/layout/PiDogStatus'
import { AssistantPage } from './components/pages/AssistantPage'
import { CockpitPage } from './components/pages/CockpitPage'
import { CommandsPage } from './components/pages/CommandsPage'
import { SensorsPage } from './components/pages/SensorsPage'
import { VoicePage } from './components/pages/VoicePage'
import { useSpeechRecognition } from './hooks/useSpeechRecognition'
import {
  type AssistantStatus,
  type ChatResponse,
  type CommandResponse,
  type ConnectionSettings,
  type HealthResponse,
  loadSettings,
  normalizeHost,
  PiDogApiError,
  pidogApi,
  saveSettings,
  type SensorsResponse,
} from './lib/api'
import { actionLabel, type Language } from './lib/commands'
import { errorMessage, tr, timeNow } from './lib/i18n'
import { colorCommands } from './lib/vision'
import { matchVoiceCommand, type VoiceMatch } from './lib/voiceCommands'
import type { Axis, Direction, Notice, Page, SpeechTarget, VisionEntry } from './types/ui'

const languageKey = 'pidog.language.v1'

function initialLanguage(): Language {
  return localStorage.getItem(languageKey) === 'en' ? 'en' : 'ru'
}

function isConnectivityError(error: unknown): boolean {
  return (
    !(error instanceof PiDogApiError) ||
    error.status === undefined ||
    error.status === 401 ||
    error.status === 404
  )
}

export function ControlStation() {
  const theme = useTheme()
  const small = useMediaQuery(theme.breakpoints.down('md'))
  const [language, setLanguage] = useState<Language>(initialLanguage)
  const [page, setPage] = useState<Page>('cockpit')
  const [settings, setSettings] = useState(loadSettings)
  const [draftSettings, setDraftSettings] = useState(settings)
  const [connectionOpen, setConnectionOpen] = useState(false)
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [sensors, setSensors] = useState<SensorsResponse | null>(null)
  const [sensorHistory, setSensorHistory] = useState<number[]>([])
  const [busyCommand, setBusyCommand] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [streaming, setStreaming] = useState(false)
  const [streamNonce, setStreamNonce] = useState(0)
  const [visionLog, setVisionLog] = useState<VisionEntry[]>([])
  const [recognized, setRecognized] = useState('')
  const [voiceMatch, setVoiceMatch] = useState<VoiceMatch | null>(null)
  const [assistantStatus, setAssistantStatus] = useState<AssistantStatus | null>(null)
  const [assistantQuestion, setAssistantQuestion] = useState('')
  const [assistantReply, setAssistantReply] = useState<ChatResponse | null>(null)
  const [assistantSearch, setAssistantSearch] = useState(true)
  const [assistantSpeak, setAssistantSpeak] = useState(false)
  const [assistantBusy, setAssistantBusy] = useState(false)
  const [speechTarget, setSpeechTarget] = useState<SpeechTarget>('command')
  const [dogStatus, setDogStatus] = useState<PiDogStatus>(() => ({
    kind: 'idle',
    message: tr(
      language,
      'Связь с Пайдогом ещё не проверена',
      'Connection to PiDog has not been checked yet',
    ),
  }))

  const speechTargetRef = useRef<SpeechTarget>('command')
  const movementRef = useRef<{ drive: Direction; turn: Direction; last: Axis }>({
    drive: 0,
    turn: 0,
    last: 'drive',
  })
  const activeMotionRef = useRef<string | null>(null)
  const motionQueueRef = useRef<string[]>([])
  const motionWorkerRef = useRef(false)
  const pendingHeadRef = useRef<{ yaw: number; pitch: number } | null>(null)
  const headRequestInFlightRef = useRef(false)
  const autoConnectRef = useRef(false)
  const dogStatusRequestRef = useRef(0)

  const beginDogStatus = useCallback((kind: PiDogStatusKind, message: string) => {
    const request = dogStatusRequestRef.current + 1
    dogStatusRequestRef.current = request
    setDogStatus({ kind, message })
    return request
  }, [])

  const finishDogStatus = useCallback((request: number, kind: PiDogStatusKind, message: string) => {
    if (request === dogStatusRequestRef.current) setDogStatus({ kind, message })
  }, [])

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
    [beginDogStatus, language],
  )

  const addVisionEntry = useCallback((title: string, detail: string, success: boolean) => {
    setVisionLog((current) =>
      [
        { id: Date.now() + Math.random(), time: timeNow(), title, detail, success },
        ...current,
      ].slice(0, 10),
    )
  }, [])

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
    [beginDogStatus, connected, finishDogStatus, language, markDisconnected, settings],
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
    [beginDogStatus, connected, finishDogStatus, language, markDisconnected, settings],
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
    [beginDogStatus, finishDogStatus, language, markDisconnected],
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

  const sendCommand = useCallback(
    async (
      command: string,
      phrase = 'web interface',
      quiet = false,
    ): Promise<CommandResponse | null> => {
      if (!connected) {
        setConnectionOpen(true)
        if (!quiet)
          setNotice({
            message: tr(language, 'Сначала подключитесь к Пайдогу', 'Connect to PiDog first'),
            severity: 'info',
          })
        beginDogStatus(
          'error',
          tr(language, 'Сначала подключитесь к Пайдогу', 'Connect to PiDog first'),
        )
        return null
      }
      if (!quiet) setBusyCommand(command)
      const action = actionLabel(command, language)
      const statusKind: PiDogStatusKind = colorCommands.includes(command)
        ? 'searching'
        : command === 'listen_sound' || command === 'local_voice_on'
          ? 'listening'
          : 'working'
      const statusRequest = beginDogStatus(
        statusKind,
        tr(language, `Выполняю: ${action}`, `Running: ${action}`),
      )
      try {
        const response = await pidogApi.command(settings, command, phrase)
        if (command === 'camera_on') {
          setStreaming(true)
          setStreamNonce((value) => value + 1)
          addVisionEntry(
            tr(language, 'Камера', 'Camera'),
            response.message ?? 'Stream started',
            true,
          )
        } else if (command === 'camera_off') {
          setStreaming(false)
          addVisionEntry(
            tr(language, 'Камера', 'Camera'),
            response.message ?? 'Stream stopped',
            true,
          )
        } else if (colorCommands.includes(command)) {
          const found = response.found === true
          const position = typeof response.position === 'string' ? response.position : ''
          const distance =
            typeof response.distance_cm === 'number'
              ? ` · ${response.distance_cm.toFixed(1)} cm`
              : ''
          addVisionEntry(
            actionLabel(command, language),
            `${response.message ?? (found ? 'Found' : 'Not found')}${position ? ` · ${position}` : ''}${distance}`,
            found,
          )
        }
        if (!quiet)
          setNotice({
            message: response.message ?? `${actionLabel(command, language)} — OK`,
            severity: 'success',
          })
        finishDogStatus(
          statusRequest,
          'success',
          response.message ?? tr(language, `${action} — готово`, `${action} — done`),
        )
        if (['show_battery', 'measure_distance', 'camera_on', 'camera_off'].includes(command))
          void refreshSensors(false)
        return response
      } catch (error) {
        if (isConnectivityError(error)) markDisconnected(error)
        else {
          if (!quiet) setNotice({ message: errorMessage(error), severity: 'error' })
          finishDogStatus(statusRequest, 'error', errorMessage(error))
        }
        if (!quiet && colorCommands.includes(command))
          addVisionEntry(actionLabel(command, language), errorMessage(error), false)
        return null
      } finally {
        if (!quiet) setBusyCommand(null)
      }
    },
    [
      addVisionEntry,
      beginDogStatus,
      connected,
      finishDogStatus,
      language,
      markDisconnected,
      refreshSensors,
      settings,
    ],
  )
  const sendCommandRef = useRef(sendCommand)
  useEffect(() => {
    sendCommandRef.current = sendCommand
  }, [sendCommand])

  const sendMotion = useCallback((command: string) => {
    if (
      command !== 'stop' &&
      activeMotionRef.current === command &&
      motionQueueRef.current.length === 0
    )
      return
    activeMotionRef.current = command === 'stop' ? null : command
    if (command === 'stop') {
      // A stop must not be replaced by a newer movement request.
      motionQueueRef.current = ['stop']
    } else if (motionQueueRef.current.at(-1) === 'stop' || motionQueueRef.current.length === 0) {
      motionQueueRef.current.push(command)
    } else {
      motionQueueRef.current[motionQueueRef.current.length - 1] = command
    }
    if (motionWorkerRef.current) return
    motionWorkerRef.current = true
    void (async () => {
      try {
        while (motionQueueRef.current.length > 0) {
          const next = motionQueueRef.current.shift()
          if (next) {
            // Motion requests must stay ordered so stop cannot race an older direction.
            // eslint-disable-next-line no-await-in-loop
            await sendCommandRef.current(next, 'web joystick', true)
          }
        }
      } finally {
        motionWorkerRef.current = false
      }
    })()
  }, [])

  const moveJoystick = useCallback(
    (axis: Axis, direction: Direction) => {
      movementRef.current[axis] = direction
      if (direction !== 0) movementRef.current.last = axis
      const current = movementRef.current
      const primaryAxis =
        current[current.last] !== 0 ? current.last : current.last === 'drive' ? 'turn' : 'drive'
      const value = current[primaryAxis]
      const command =
        value === 0
          ? 'stop'
          : primaryAxis === 'drive'
            ? value < 0
              ? 'drive_forward'
              : 'drive_backward'
            : value < 0
              ? 'drive_left'
              : 'drive_right'
      sendMotion(command)
    },
    [sendMotion],
  )

  const moveHead = useCallback(
    (x: number, y: number) => {
      if (!connected) return
      pendingHeadRef.current = { yaw: Math.round(-x * 80), pitch: Math.round(-y * 30) }
      if (headRequestInFlightRef.current) return
      headRequestInFlightRef.current = true
      void (async () => {
        try {
          while (pendingHeadRef.current) {
            const target = pendingHeadRef.current
            pendingHeadRef.current = null
            // eslint-disable-next-line no-await-in-loop
            await pidogApi.head(settings, target.yaw, target.pitch)
          }
        } catch (error) {
          pendingHeadRef.current = null
          if (isConnectivityError(error)) markDisconnected(error)
          else setNotice({ message: errorMessage(error), severity: 'error' })
        } finally {
          headRequestInFlightRef.current = false
        }
      })()
    },
    [connected, markDisconnected, settings],
  )

  const emergencyStop = useCallback(() => {
    movementRef.current = { drive: 0, turn: 0, last: 'drive' }
    activeMotionRef.current = null
    moveHead(0, 0)
    sendMotion('stop')
  }, [moveHead, sendMotion])

  useEffect(() => {
    if (page === 'cockpit') return
    if (activeMotionRef.current) emergencyStop()
    else moveHead(0, 0)
  }, [emergencyStop, moveHead, page])

  const controlAssistant = useCallback(
    async (action: 'start' | 'stop' | 'restart') => {
      if (!connected) {
        setConnectionOpen(true)
        beginDogStatus(
          'error',
          tr(language, 'Сначала подключитесь к Пайдогу', 'Connect to PiDog first'),
        )
        return
      }
      setAssistantBusy(true)
      const statusRequest = beginDogStatus(
        'working',
        tr(language, 'Управляю локальной LLM…', 'Managing local LLM…'),
      )
      try {
        const response = await pidogApi.assistantControl(settings, action)
        setAssistantStatus(response.assistant)
        setNotice({ message: response.message ?? action, severity: 'success' })
        finishDogStatus(
          statusRequest,
          'success',
          response.message ?? tr(language, 'Настройки LLM обновлены', 'LLM settings updated'),
        )
      } catch (error) {
        if (isConnectivityError(error)) markDisconnected(error)
        else {
          setNotice({ message: errorMessage(error), severity: 'error' })
          finishDogStatus(statusRequest, 'error', errorMessage(error))
        }
      } finally {
        setAssistantBusy(false)
      }
    },
    [beginDogStatus, connected, finishDogStatus, language, markDisconnected, settings],
  )

  const askAssistant = useCallback(
    async (questionOverride?: string) => {
      const question = (questionOverride ?? assistantQuestion).trim()
      if (!question) return
      if (!connected) {
        setConnectionOpen(true)
        beginDogStatus(
          'error',
          tr(language, 'Сначала подключитесь к Пайдогу', 'Connect to PiDog first'),
        )
        return
      }
      setAssistantQuestion(question)
      setAssistantBusy(true)
      const statusRequest = beginDogStatus(
        assistantSearch ? 'searching' : 'thinking',
        assistantSearch
          ? tr(language, 'Ищу и думаю над ответом…', 'Searching and thinking…')
          : tr(language, 'Думаю над ответом…', 'Thinking about the answer…'),
      )
      try {
        const reply = await pidogApi.assistantChat(
          settings,
          question,
          assistantSearch,
          assistantSpeak,
        )
        setAssistantReply(reply)
        void refreshAssistant(false)
        finishDogStatus(
          statusRequest,
          reply.spoken ? 'speaking' : 'success',
          reply.spoken
            ? tr(language, 'Отвечаю через динамик Пайдога', 'Answering through PiDog speaker')
            : tr(language, 'Ответ готов', 'Answer ready'),
        )
      } catch (error) {
        if (isConnectivityError(error)) markDisconnected(error)
        else {
          setNotice({ message: errorMessage(error), severity: 'error' })
          finishDogStatus(statusRequest, 'error', errorMessage(error))
        }
      } finally {
        setAssistantBusy(false)
      }
    },
    [
      assistantQuestion,
      assistantSearch,
      assistantSpeak,
      beginDogStatus,
      connected,
      finishDogStatus,
      language,
      markDisconnected,
      refreshAssistant,
      settings,
    ],
  )

  const clearAssistant = useCallback(async () => {
    if (!connected) return
    setAssistantBusy(true)
    const statusRequest = beginDogStatus(
      'working',
      tr(language, 'Очищаю историю диалога…', 'Clearing conversation history…'),
    )
    try {
      const response = await pidogApi.clearAssistantHistory(settings)
      setAssistantReply(null)
      setAssistantQuestion('')
      setNotice({
        message: response.message ?? tr(language, 'История очищена', 'History cleared'),
        severity: 'success',
      })
      finishDogStatus(
        statusRequest,
        'success',
        response.message ?? tr(language, 'История очищена', 'History cleared'),
      )
    } catch (error) {
      if (isConnectivityError(error)) markDisconnected(error)
      else {
        setNotice({ message: errorMessage(error), severity: 'error' })
        finishDogStatus(statusRequest, 'error', errorMessage(error))
      }
    } finally {
      setAssistantBusy(false)
    }
  }, [beginDogStatus, connected, finishDogStatus, language, markDisconnected, settings])

  const speech = useSpeechRecognition({
    languageTag: language === 'en' ? 'en-US' : 'ru-RU',
    onInterim: setRecognized,
    onFinal: (hypotheses) => {
      const first = hypotheses[0] ?? ''
      setRecognized(first)
      if (speechTargetRef.current === 'assistant') {
        setAssistantQuestion(first)
        void askAssistant(first)
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
    localStorage.setItem(languageKey, next)
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
  const content =
    page === 'cockpit' ? (
      <CockpitPage
        language={language}
        connected={connected}
        sensors={sensors}
        streaming={streaming}
        streamNonce={streamNonce}
        settings={settings}
        busyCommand={busyCommand}
        visionLog={visionLog}
        onCommand={onCommand}
        onMove={moveJoystick}
        onHead={moveHead}
        onStop={emergencyStop}
        onRefreshStream={() => setStreamNonce((value) => value + 1)}
        onClearLog={() => setVisionLog([])}
      />
    ) : page === 'voice' ? (
      <VoicePage
        language={language}
        supported={speech.supported}
        listening={speech.listening}
        recognized={recognized}
        match={voiceMatch}
        connected={connected}
        busyCommand={busyCommand}
        onToggleSpeech={() => startSpeech('command')}
        onCommand={onCommand}
      />
    ) : page === 'commands' ? (
      <CommandsPage language={language} busyCommand={busyCommand} onCommand={onCommand} />
    ) : page === 'sensors' ? (
      <SensorsPage
        language={language}
        sensors={sensors}
        history={sensorHistory}
        connected={connected}
        onRefresh={() => void refreshSensors(true)}
        onCommand={onCommand}
      />
    ) : (
      <AssistantPage
        language={language}
        status={assistantStatus}
        connected={connected}
        busy={assistantBusy}
        question={assistantQuestion}
        reply={assistantReply}
        search={assistantSearch}
        speak={assistantSpeak}
        speechSupported={speech.supported}
        speechListening={speech.listening && speechTarget === 'assistant'}
        onQuestion={setAssistantQuestion}
        onSearch={setAssistantSearch}
        onSpeak={setAssistantSpeak}
        onAsk={() => void askAssistant()}
        onSpeech={() => startSpeech('assistant')}
        onRefresh={() => void refreshAssistant(true)}
        onControl={(action) => void controlAssistant(action)}
        onClear={() => void clearAssistant()}
      />
    )

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex' }}>
      {!small && (
        <NavigationRail page={page} language={language} connected={connected} onPage={setPage} />
      )}
      <Box sx={{ width: '100%', minWidth: 0, ml: small ? 0 : '92px', pb: small ? 10 : 3 }}>
        <AppHeader
          page={page}
          language={language}
          connected={connected}
          version={health?.version}
          dryRun={health?.dry_run}
          status={dogStatus}
          onLanguage={changeLanguage}
          onConnection={() => {
            setDraftSettings(settings)
            setConnectionOpen(true)
          }}
          onStop={emergencyStop}
        />
        <Box
          component="main"
          sx={{ width: 'min(1800px, 100%)', mx: 'auto', p: { xs: 1.5, sm: 2.5, xl: 3 } }}
        >
          {content}
        </Box>
      </Box>
      {small && <MobileNavigation page={page} language={language} onPage={setPage} />}
      <ConnectionDialog
        language={language}
        open={connectionOpen || !connected}
        value={draftSettings}
        connecting={connecting}
        onChange={setDraftSettings}
        onClose={() => {
          if (connected) setConnectionOpen(false)
        }}
        onSave={() => void saveConnection()}
      />
      <Snackbar
        open={notice !== null}
        autoHideDuration={4500}
        onClose={() => setNotice(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={notice?.severity ?? 'info'}
          variant="filled"
          onClose={() => setNotice(null)}
          sx={{ minWidth: { sm: 360 } }}
        >
          {notice?.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}

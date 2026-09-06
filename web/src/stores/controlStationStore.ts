import type { SetStateAction } from 'react'
import { create } from 'zustand'

import type { PiDogStatus } from '../components/layout/PiDogStatus'
import type {
  AssistantStatus,
  ConnectionSettings,
  HealthResponse,
  SensorsResponse,
} from '../lib/api'
import { loadSettings } from '../lib/api'
import type { Language } from '../lib/commands'
import { tr } from '../lib/i18n'
import type { VoiceMatch } from '../lib/voiceCommands'
import type { Notice, SpeechTarget, VisionEntry } from '../types/ui'

const languageKey = 'pidog.language.v1'
const initialLanguage: Language = localStorage.getItem(languageKey) === 'en' ? 'en' : 'ru'

type Update<T> = (value: SetStateAction<T>) => void
type StationState = {
  language: Language
  settings: ConnectionSettings
  draftSettings: ConnectionSettings
  connectionOpen: boolean
  connected: boolean
  connecting: boolean
  health: HealthResponse | null
  sensors: SensorsResponse | null
  sensorHistory: number[]
  busyCommand: string | null
  notice: Notice | null
  streaming: boolean
  streamNonce: number
  visionLog: VisionEntry[]
  assistantStatus: AssistantStatus | null
  recognized: string
  voiceMatch: VoiceMatch | null
  speechTarget: SpeechTarget
  dogStatus: PiDogStatus
  setLanguage: Update<Language>
  setSettings: Update<ConnectionSettings>
  setDraftSettings: Update<ConnectionSettings>
  setConnectionOpen: Update<boolean>
  setConnected: Update<boolean>
  setConnecting: Update<boolean>
  setHealth: Update<HealthResponse | null>
  setSensors: Update<SensorsResponse | null>
  setSensorHistory: Update<number[]>
  setBusyCommand: Update<string | null>
  setNotice: Update<Notice | null>
  setStreaming: Update<boolean>
  setStreamNonce: Update<number>
  setVisionLog: Update<VisionEntry[]>
  setAssistantStatus: Update<AssistantStatus | null>
  setRecognized: Update<string>
  setVoiceMatch: Update<VoiceMatch | null>
  setSpeechTarget: Update<SpeechTarget>
  setDogStatus: Update<PiDogStatus>
}

type StateValueKey =
  | 'language'
  | 'settings'
  | 'draftSettings'
  | 'connectionOpen'
  | 'connected'
  | 'connecting'
  | 'health'
  | 'sensors'
  | 'sensorHistory'
  | 'busyCommand'
  | 'notice'
  | 'streaming'
  | 'streamNonce'
  | 'visionLog'
  | 'assistantStatus'
  | 'recognized'
  | 'voiceMatch'
  | 'speechTarget'
  | 'dogStatus'

const update =
  <Key extends StateValueKey>(key: Key) =>
  (
    set: (state: Partial<StationState>) => void,
    get: () => StationState,
  ): Update<StationState[Key]> =>
  (value) => {
    const current = get()[key]
    const next = typeof value === 'function' ? value(current) : value
    set({ [key]: next })
  }

export const useControlStationStore = create<StationState>((set, get) => {
  const settings = loadSettings()
  return {
    language: initialLanguage,
    settings,
    draftSettings: settings,
    connectionOpen: false,
    connected: false,
    connecting: false,
    health: null,
    sensors: null,
    sensorHistory: [],
    busyCommand: null,
    notice: null,
    streaming: false,
    streamNonce: 0,
    visionLog: [],
    assistantStatus: null,
    recognized: '',
    voiceMatch: null,
    speechTarget: 'command',
    dogStatus: {
      kind: 'idle',
      message: tr(
        initialLanguage,
        'Связь с Пайдогом ещё не проверена',
        'Connection to PiDog has not been checked yet',
      ),
    },
    setLanguage: (value) => {
      const language = typeof value === 'function' ? value(get().language) : value
      localStorage.setItem(languageKey, language)
      set({ language })
    },
    setSettings: update('settings')(set, get),
    setDraftSettings: update('draftSettings')(set, get),
    setConnectionOpen: update('connectionOpen')(set, get),
    setConnected: update('connected')(set, get),
    setConnecting: update('connecting')(set, get),
    setHealth: update('health')(set, get),
    setSensors: update('sensors')(set, get),
    setSensorHistory: update('sensorHistory')(set, get),
    setBusyCommand: update('busyCommand')(set, get),
    setNotice: update('notice')(set, get),
    setStreaming: update('streaming')(set, get),
    setStreamNonce: update('streamNonce')(set, get),
    setVisionLog: update('visionLog')(set, get),
    setAssistantStatus: update('assistantStatus')(set, get),
    setRecognized: update('recognized')(set, get),
    setVoiceMatch: update('voiceMatch')(set, get),
    setSpeechTarget: update('speechTarget')(set, get),
    setDogStatus: update('dogStatus')(set, get),
  }
})

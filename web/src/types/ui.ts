import type { AssistantStatus, ChatResponse, ConnectionSettings, SensorsResponse } from '../lib/api'
import type { Language } from '../lib/commands'
import type { VoiceMatch } from '../lib/voiceCommands'

export type Page = 'cockpit' | 'voice' | 'commands' | 'sensors' | 'assistant'
export type SpeechTarget = 'command' | 'assistant'
export type Axis = 'drive' | 'turn'
export type Direction = -1 | 0 | 1

export type Notice = {
  message: string
  severity: 'success' | 'error' | 'info' | 'warning'
}

export type VisionEntry = {
  id: number
  time: string
  title: string
  detail: string
  success: boolean
}

export type PageProps = {
  language: Language
}

export type CockpitProps = {
  language: Language
  connected: boolean
  sensors: SensorsResponse | null
  streaming: boolean
  streamNonce: number
  settings: ConnectionSettings
  busyCommand: string | null
  visionLog: VisionEntry[]
  onCommand: (command: string) => void
  onMove: (axis: Axis, direction: Direction) => void
  onHead: (x: number, y: number) => void
  onStop: () => void
  onRefreshStream: () => void
  onClearLog: () => void
}

export type VoicePageProps = PageProps & {
  supported: boolean
  listening: boolean
  recognized: string
  match: VoiceMatch | null
  connected: boolean
  busyCommand: string | null
  onToggleSpeech: () => void
  onCommand: (command: string) => void
}

export type SensorsPageProps = PageProps & {
  sensors: SensorsResponse | null
  history: number[]
  connected: boolean
  onRefresh: () => void
  onCommand: (command: string) => void
}

export type AssistantPageProps = PageProps & {
  status: AssistantStatus | null
  connected: boolean
  busy: boolean
  question: string
  reply: ChatResponse | null
  search: boolean
  speak: boolean
  speechSupported: boolean
  speechListening: boolean
  onQuestion: (value: string) => void
  onSearch: (value: boolean) => void
  onSpeak: (value: boolean) => void
  onAsk: () => void
  onSpeech: () => void
  onRefresh: () => void
  onControl: (action: 'start' | 'stop' | 'restart') => void
  onClear: () => void
}

export type ConnectionDialogProps = {
  language: Language
  open: boolean
  value: ConnectionSettings
  connecting: boolean
  onChange: (value: ConnectionSettings) => void
  onClose: () => void
  onSave: () => void
}

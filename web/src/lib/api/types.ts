export type ConnectionSettings = {
  host: string
  port: number
  token: string
}

export type AssistantStatus = {
  installed?: boolean
  running?: boolean
  state?: string
  model?: string
  context_tokens?: number
  web_search?: {
    available?: boolean
    provider?: string
  }
  tts?: {
    ready?: boolean
    voice?: string
  }
  busy?: boolean
  last_error?: string
}

export type HealthResponse = {
  ok: true
  service: string
  version: string
  dry_run: boolean
  commands: string[]
  audio?: Record<string, unknown>
  local_voice?: Record<string, unknown>
  assistant?: AssistantStatus
}

export type SensorsResponse = {
  ok: true
  message: string
  distance_cm: number | null
  touch: string | null
  sound_detected: boolean
  sound_direction: number | null
  camera: boolean
  battery_voltage: number | null
  battery_percent: number | null
  external_power: boolean | null
  charging: boolean | null
  power_detection: string
  acceleration?: number[] | null
  gyroscope?: number[] | null
}

export type CommandResponse = {
  ok: true
  command: string
  message?: string
  [key: string]: unknown
}

export type ChatSource = {
  title?: string
  url: string
  snippet?: string
}

export type ChatResponse = {
  ok: true
  answer: string
  sources?: ChatSource[]
  searched?: boolean
  spoken?: boolean
  search_warning?: string
  model?: string
}

export type HeadResponse = {
  ok: true
  yaw: number
  pitch: number
  message?: string
}

export type AssistantStatusResponse = {
  ok: true
  assistant: AssistantStatus
}

export type AssistantControlAction = 'start' | 'stop' | 'restart'

export type AssistantControlResponse = {
  ok: true
  message?: string
  assistant: AssistantStatus
}

export type ClearAssistantHistoryResponse = {
  ok: true
  message?: string
}

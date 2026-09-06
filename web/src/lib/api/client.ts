import { buildApiRequestUrl, connectionErrorMessage } from './settings'
import type {
  AssistantControlAction,
  AssistantControlResponse,
  AssistantStatusResponse,
  ChatResponse,
  ClearAssistantHistoryResponse,
  CommandResponse,
  ConnectionSettings,
  HeadResponse,
  HealthResponse,
  SensorsResponse,
  VisionEnrollResponse,
  VisionFace,
  VisionInferenceResponse,
  VisionGuardResponse,
  VisionGuardTargetsResponse,
  VisionObject,
  VisionObjectEnrollResponse,
} from './types'

type ErrorPayload = {
  error?: string
  detail?: string
}

export class PiDogApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message)
    this.name = 'PiDogApiError'
  }
}

async function request<T>(
  settings: ConnectionSettings,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const headers = new Headers(init?.headers)
  headers.set('Content-Type', 'application/json')
  headers.set('X-PiDog-Token', settings.token)
  let response: Response
  try {
    response = await fetch(buildApiRequestUrl(settings, path), {
      ...init,
      signal: AbortSignal.timeout(
        path === '/assistant/chat'
          ? 150_000
          : path === '/assistant/control'
            ? 40_000
            : path === '/command'
              ? 25_000
              : 10_000,
      ),
      headers,
    })
  } catch (error) {
    throw new PiDogApiError(connectionErrorMessage(settings, error))
  }

  const rawPayload: unknown = await response.json().catch(() => ({}))
  const payload = rawPayload as T & ErrorPayload
  if (!response.ok) {
    const detail = payload.detail ? `: ${payload.detail}` : ''
    throw new PiDogApiError(
      payload.error ? `${payload.error}${detail}` : response.statusText,
      response.status,
    )
  }
  return payload
}

export const pidogApi = {
  health: (settings: ConnectionSettings) => request<HealthResponse>(settings, '/health'),
  sensors: (settings: ConnectionSettings) => request<SensorsResponse>(settings, '/sensors'),
  command: (settings: ConnectionSettings, command: string, phrase = 'web interface') =>
    request<CommandResponse>(settings, '/command', {
      method: 'POST',
      body: JSON.stringify({ command, phrase }),
    }),
  head: (settings: ConnectionSettings, yaw: number, pitch: number) =>
    request<HeadResponse>(settings, '/head', {
      method: 'POST',
      body: JSON.stringify({ yaw, pitch }),
    }),
  assistantStatus: (settings: ConnectionSettings) =>
    request<AssistantStatusResponse>(settings, '/assistant/status'),
  assistantChat: (settings: ConnectionSettings, message: string, search: boolean, speak: boolean) =>
    request<ChatResponse>(settings, '/assistant/chat', {
      method: 'POST',
      body: JSON.stringify({ message, search, speak }),
    }),
  assistantControl: (settings: ConnectionSettings, action: AssistantControlAction) =>
    request<AssistantControlResponse>(settings, '/assistant/control', {
      method: 'POST',
      body: JSON.stringify({ action }),
    }),
  clearAssistantHistory: (settings: ConnectionSettings) =>
    request<ClearAssistantHistoryResponse>(settings, '/assistant/history', {
      method: 'POST',
      body: JSON.stringify({ action: 'clear' }),
    }),
  visionInfer: (settings: ConnectionSettings) =>
    request<VisionInferenceResponse>(settings, '/vision/infer', {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  visionGuardTargets: (settings: ConnectionSettings) =>
    request<VisionGuardTargetsResponse>(settings, '/vision/guard-targets'),
  visionGuard: (settings: ConnectionSettings, name: string) =>
    request<VisionGuardResponse>(settings, '/vision/guard', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
  visionEnroll: (settings: ConnectionSettings, names: string[], face: VisionFace) =>
    request<VisionEnrollResponse>(settings, '/vision/enroll', {
      method: 'POST',
      body: JSON.stringify({ names, face: { x: face.x, y: face.y, w: face.w, h: face.h } }),
    }),
  visionObjectEnroll: (settings: ConnectionSettings, name: string, object: VisionObject) =>
    request<VisionObjectEnrollResponse>(settings, '/vision/objects/enroll', {
      method: 'POST',
      body: JSON.stringify({
        name,
        object: { x: object.x, y: object.y, w: object.w, h: object.h },
      }),
    }),
}

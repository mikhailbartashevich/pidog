export { pidogApi, PiDogApiError } from './api/client'
export {
  buildApiRequestUrl,
  buildApiUrl,
  buildCameraStreamUrl,
  connectionErrorMessage,
  defaultSettings,
  loadSettings,
  normalizeHost,
  saveSettings,
  usesLocalPiDogProxy,
} from './api/settings'
export type {
  AssistantControlAction,
  AssistantControlResponse,
  AssistantStatus,
  AssistantStatusResponse,
  ChatResponse,
  ChatSource,
  ClearAssistantHistoryResponse,
  CommandResponse,
  ConnectionSettings,
  HeadResponse,
  HealthResponse,
  SensorsResponse,
} from './api/types'

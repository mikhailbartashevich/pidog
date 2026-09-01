import type { ConnectionSettings } from './types'

const SETTINGS_KEY = 'pidog.connection.v1'

export const defaultSettings: ConnectionSettings = {
  host: '192.168.1.37',
  port: 8765,
  token: '',
}

export function normalizeHost(host: string): string {
  return host
    .trim()
    .replace(/^https?:\/\//u, '')
    .replace(/\/.*$/u, '')
    .replace(/:\d+$/u, '')
}

export function buildApiUrl(settings: ConnectionSettings, path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `http://${normalizeHost(settings.host)}:${settings.port}${normalizedPath}`
}

export function usesLocalPiDogProxy(location: Pick<Location, 'hostname' | 'port'>): boolean {
  return (
    ['localhost', '127.0.0.1', '::1'].includes(location.hostname) &&
    ['4173', '5173'].includes(location.port)
  )
}

export function buildApiRequestUrl(
  settings: ConnectionSettings,
  path: string,
  useProxy = usesLocalPiDogProxy(window.location),
): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return useProxy ? `/pidog-api${normalizedPath}` : buildApiUrl(settings, normalizedPath)
}

export function buildCameraStreamUrl(
  settings: ConnectionSettings,
  nonce: number,
  useProxy = usesLocalPiDogProxy(window.location),
): string {
  return useProxy
    ? `/pidog-camera/mjpg?v=${nonce}`
    : `http://${normalizeHost(settings.host)}:9000/mjpg?v=${nonce}`
}

export function connectionErrorMessage(settings: ConnectionSettings, error: unknown): string {
  const endpoint = buildApiUrl(settings, 'health').replace(/\/health$/u, '')
  const detail = error instanceof Error ? error.message : 'неизвестная ошибка'
  if (error instanceof DOMException && error.name === 'TimeoutError') {
    return `Пайдог не ответил за 10 секунд по адресу ${endpoint}. Проверьте IP, порт и сервис pidog-voice.`
  }
  return `Нет связи с ${endpoint}. Если указан pidog.local, введите числовой IP из команды hostname -I. Проверьте порт 8765, сервис pidog-voice и обновление сервера с поддержкой CORS. (${detail})`
}

export function loadSettings(): ConnectionSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return defaultSettings
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return defaultSettings
    const value = parsed as Partial<ConnectionSettings>
    const savedHost = typeof value.host === 'string' ? value.host : defaultSettings.host
    return {
      host:
        normalizeHost(savedHost).toLowerCase() === 'pidog.local' ? defaultSettings.host : savedHost,
      port: typeof value.port === 'number' ? value.port : defaultSettings.port,
      token: typeof value.token === 'string' ? value.token : defaultSettings.token,
    }
  } catch {
    return defaultSettings
  }
}

export function saveSettings(settings: ConnectionSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

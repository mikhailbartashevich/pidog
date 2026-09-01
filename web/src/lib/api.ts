export interface ConnectionSettings {
  host: string;
  port: number;
  token: string;
}

export interface AssistantStatus {
  installed?: boolean;
  running?: boolean;
  state?: string;
  model?: string;
  context_tokens?: number;
  web_search?: {
    available?: boolean;
    provider?: string;
  };
  tts?: {
    ready?: boolean;
    voice?: string;
  };
  busy?: boolean;
  last_error?: string;
}

export interface HealthResponse {
  ok: true;
  service: string;
  version: string;
  dry_run: boolean;
  commands: string[];
  audio?: Record<string, unknown>;
  local_voice?: Record<string, unknown>;
  assistant?: AssistantStatus;
}

export interface SensorsResponse {
  ok: true;
  message: string;
  distance_cm: number | null;
  touch: string | null;
  sound_detected: boolean;
  sound_direction: number | null;
  camera: boolean;
  battery_voltage: number | null;
  battery_percent: number | null;
  external_power: boolean | null;
  charging: boolean | null;
  power_detection: string;
  acceleration?: number[] | null;
  gyroscope?: number[] | null;
}

export interface CommandResponse {
  ok: true;
  command: string;
  message?: string;
  [key: string]: unknown;
}

export interface ChatSource {
  title?: string;
  url: string;
  snippet?: string;
}

export interface ChatResponse {
  ok: true;
  answer: string;
  sources?: ChatSource[];
  searched?: boolean;
  spoken?: boolean;
  search_warning?: string;
  model?: string;
}

interface ErrorPayload {
  error?: string;
  detail?: string;
}

const SETTINGS_KEY = 'pidog.connection.v1';

export class PiDogApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'PiDogApiError';
  }
}

export const defaultSettings: ConnectionSettings = {
  host: '192.168.1.37',
  port: 8765,
  token: '',
};

export function normalizeHost(host: string): string {
  return host
    .trim()
    .replace(/^https?:\/\//u, '')
    .replace(/\/.*$/u, '')
    .replace(/:\d+$/u, '');
}

export function buildApiUrl(settings: ConnectionSettings, path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `http://${normalizeHost(settings.host)}:${settings.port}${normalizedPath}`;
}

export function usesLocalPiDogProxy(location: Pick<Location, 'hostname' | 'port'>): boolean {
  return (
    ['localhost', '127.0.0.1', '::1'].includes(location.hostname) &&
    ['4173', '5173'].includes(location.port)
  );
}

export function buildApiRequestUrl(
  settings: ConnectionSettings,
  path: string,
  useProxy = usesLocalPiDogProxy(window.location),
): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return useProxy ? `/pidog-api${normalizedPath}` : buildApiUrl(settings, normalizedPath);
}

export function buildCameraStreamUrl(
  settings: ConnectionSettings,
  nonce: number,
  useProxy = usesLocalPiDogProxy(window.location),
): string {
  return useProxy
    ? `/pidog-camera/mjpg?v=${nonce}`
    : `http://${normalizeHost(settings.host)}:9000/mjpg?v=${nonce}`;
}

export function connectionErrorMessage(settings: ConnectionSettings, error: unknown): string {
  const endpoint = buildApiUrl(settings, 'health').replace(/\/health$/u, '');
  const detail = error instanceof Error ? error.message : 'неизвестная ошибка';
  if (error instanceof DOMException && error.name === 'TimeoutError') {
    return `Пайдог не ответил за 10 секунд по адресу ${endpoint}. Проверьте IP, порт и сервис pidog-voice.`;
  }
  return `Нет связи с ${endpoint}. Если указан pidog.local, введите числовой IP из команды hostname -I. Проверьте порт 8765, сервис pidog-voice и обновление сервера с поддержкой CORS. (${detail})`;
}

export function loadSettings(): ConnectionSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaultSettings;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return defaultSettings;
    const value = parsed as Partial<ConnectionSettings>;
    const savedHost = typeof value.host === 'string' ? value.host : defaultSettings.host;
    return {
      host:
        normalizeHost(savedHost).toLowerCase() === 'pidog.local' ? defaultSettings.host : savedHost,
      port: typeof value.port === 'number' ? value.port : defaultSettings.port,
      token: typeof value.token === 'string' ? value.token : defaultSettings.token,
    };
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(settings: ConnectionSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

async function request<T>(
  settings: ConnectionSettings,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'application/json');
  headers.set('X-PiDog-Token', settings.token);
  let response: Response;
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
    });
  } catch (error) {
    throw new PiDogApiError(connectionErrorMessage(settings, error));
  }

  const rawPayload: unknown = await response.json().catch(() => ({}));
  const payload = rawPayload as T & ErrorPayload;
  if (!response.ok) {
    const detail = payload.detail ? `: ${payload.detail}` : '';
    throw new PiDogApiError(
      payload.error ? `${payload.error}${detail}` : response.statusText,
      response.status,
    );
  }
  return payload;
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
    request<{ ok: true; yaw: number; pitch: number; message?: string }>(settings, '/head', {
      method: 'POST',
      body: JSON.stringify({ yaw, pitch }),
    }),
  assistantStatus: (settings: ConnectionSettings) =>
    request<{ ok: true; assistant: AssistantStatus }>(settings, '/assistant/status'),
  assistantChat: (settings: ConnectionSettings, message: string, search: boolean, speak: boolean) =>
    request<ChatResponse>(settings, '/assistant/chat', {
      method: 'POST',
      body: JSON.stringify({ message, search, speak }),
    }),
  assistantControl: (settings: ConnectionSettings, action: 'start' | 'stop' | 'restart') =>
    request<{ ok: true; message?: string; assistant: AssistantStatus }>(
      settings,
      '/assistant/control',
      {
        method: 'POST',
        body: JSON.stringify({ action }),
      },
    ),
  clearAssistantHistory: (settings: ConnectionSettings) =>
    request<{ ok: true; message?: string }>(settings, '/assistant/history', {
      method: 'POST',
      body: JSON.stringify({ action: 'clear' }),
    }),
};

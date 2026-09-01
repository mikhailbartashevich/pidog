import { describe, expect, it } from 'vitest';

import {
  buildApiUrl,
  buildApiRequestUrl,
  buildCameraStreamUrl,
  connectionErrorMessage,
  defaultSettings,
  loadSettings,
  normalizeHost,
  usesLocalPiDogProxy,
} from './api';

describe('PiDog API address helpers', () => {
  it('uses the robot IPv4 address by default', () => {
    expect(defaultSettings.host).toBe('192.168.1.37');
  });

  it('migrates the old pidog.local setting to the robot IPv4 address', () => {
    localStorage.setItem(
      'pidog.connection.v1',
      JSON.stringify({ host: 'pidog.local', port: 8765, token: 'secret' }),
    );
    expect(loadSettings().host).toBe('192.168.1.37');
    localStorage.clear();
  });

  it('normalizes pasted HTTP addresses', () => {
    expect(normalizeHost(' http://192.168.1.37:8765/health ')).toBe('192.168.1.37');
  });

  it('builds a local API URL with a leading slash', () => {
    expect(buildApiUrl({ host: 'pidog.local', port: 8765, token: 'secret' }, 'sensors')).toBe(
      'http://pidog.local:8765/sensors',
    );
  });

  it('routes browser API calls through the same-origin Vite proxy', () => {
    const settings = { host: '192.168.1.37', port: 8765, token: 'secret' };
    expect(buildApiRequestUrl(settings, '/health', true)).toBe('/pidog-api/health');
    expect(buildCameraStreamUrl(settings, 4, true)).toBe('/pidog-camera/mjpg?v=4');
  });

  it('enables the proxy only on the local Vite ports', () => {
    expect(usesLocalPiDogProxy({ hostname: 'localhost', port: '5173' })).toBe(true);
    expect(usesLocalPiDogProxy({ hostname: '192.168.1.20', port: '5173' })).toBe(false);
  });

  it('explains how to recover when the robot cannot be reached', () => {
    expect(
      connectionErrorMessage(
        { host: 'pidog.local', port: 8765, token: 'secret' },
        new TypeError('Failed to fetch'),
      ),
    ).toContain('числовой IP');
  });

  it('identifies connection timeouts', () => {
    expect(
      connectionErrorMessage(
        { host: '192.168.1.37', port: 8765, token: 'secret' },
        new DOMException('The operation timed out', 'TimeoutError'),
      ),
    ).toBe(
      'Пайдог не ответил за 10 секунд по адресу http://192.168.1.37:8765. Проверьте IP, порт и сервис pidog-voice.',
    );
  });
});

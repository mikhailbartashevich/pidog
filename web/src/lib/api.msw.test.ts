import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import { pidogApi } from './api'

const endpoint = 'http://192.168.1.37:8765'
const settings = { host: '192.168.1.37', port: 8765, token: 'test-token' }

const server = setupServer(
  http.get(`${endpoint}/health`, ({ request }) => {
    return HttpResponse.json({
      ok: true,
      service: 'pidog-voice',
      version: 'test',
      dry_run: true,
      commands: ['stop'],
      token: request.headers.get('X-PiDog-Token'),
    })
  }),
  http.get(`${endpoint}/sensors`, () =>
    HttpResponse.json({
      ok: true,
      message: 'ok',
      distance_cm: 42,
      touch: null,
      sound_detected: false,
      sound_direction: null,
      camera: false,
      battery_voltage: 7.4,
      battery_percent: 88,
      external_power: true,
      charging: true,
      power_detection: 'USB-C',
    }),
  ),
  http.post(`${endpoint}/command`, async ({ request }) =>
    HttpResponse.json({
      ok: true,
      command: ((await request.json()) as { command: string }).command,
      message: 'accepted',
    }),
  ),
  http.post(`${endpoint}/head`, async ({ request }) => {
    const body = (await request.json()) as { yaw: number; pitch: number }
    return HttpResponse.json({ ok: true, ...body })
  }),
  http.get(`${endpoint}/assistant/status`, () =>
    HttpResponse.json({
      ok: true,
      assistant: { installed: true, running: true, model: 'test-model' },
    }),
  ),
  http.post(`${endpoint}/assistant/chat`, async ({ request }) => {
    const body = (await request.json()) as { message: string }
    return HttpResponse.json({ ok: true, answer: `echo: ${body.message}` })
  }),
  http.post(`${endpoint}/assistant/control`, async ({ request }) => {
    const body = (await request.json()) as { action: string }
    return HttpResponse.json({
      ok: true,
      message: body.action,
      assistant: { installed: true, running: body.action !== 'stop' },
    })
  }),
  http.post(`${endpoint}/assistant/history`, () =>
    HttpResponse.json({ ok: true, message: 'cleared' }),
  ),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('PiDog API requests with MSW', () => {
  it('sends authentication and command payloads to the robot', async () => {
    const health = await pidogApi.health(settings)
    const command = await pidogApi.command(settings, 'drive_forward', 'ArrowUp')
    const head = await pidogApi.head(settings, 0.25, -0.5)

    expect(health).toMatchObject({ ok: true, service: 'pidog-voice' })
    expect((health as typeof health & { token: string }).token).toBe('test-token')
    expect(command).toMatchObject({ ok: true, command: 'drive_forward' })
    expect(head).toMatchObject({ ok: true, yaw: 0.25, pitch: -0.5 })
  })

  it('covers telemetry and every assistant endpoint', async () => {
    await expect(pidogApi.sensors(settings)).resolves.toMatchObject({ distance_cm: 42 })
    await expect(pidogApi.assistantStatus(settings)).resolves.toMatchObject({
      assistant: { running: true },
    })
    await expect(pidogApi.assistantChat(settings, 'Привет', true, false)).resolves.toMatchObject({
      answer: 'echo: Привет',
    })
    await expect(pidogApi.assistantControl(settings, 'stop')).resolves.toMatchObject({
      message: 'stop',
    })
    await expect(pidogApi.clearAssistantHistory(settings)).resolves.toMatchObject({
      message: 'cleared',
    })
  })

  it('translates API errors into PiDogApiError with status', async () => {
    server.use(
      http.post(`${endpoint}/command`, () =>
        HttpResponse.json({ error: 'Rejected', detail: 'unsafe command' }, { status: 409 }),
      ),
    )

    await expect(pidogApi.command(settings, 'stop')).rejects.toMatchObject({
      name: 'PiDogApiError',
      message: 'Rejected: unsafe command',
      status: 409,
    })
  })
})

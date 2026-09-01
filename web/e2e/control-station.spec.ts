import { expect, test, type Page } from '@playwright/test'

const health = {
  ok: true,
  service: 'pidog-voice',
  version: 'e2e',
  dry_run: true,
  commands: ['drive_forward', 'stop'],
}

const sensors = {
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
}

async function mockPiDogApi(page: Page) {
  await page.route('**/pidog-api/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    const body =
      request.method() === 'POST' ? (request.postDataJSON() as { command?: string }) : null

    if (path.endsWith('/health')) return route.fulfill({ json: health })
    if (path.endsWith('/sensors')) return route.fulfill({ json: sensors })
    if (path.endsWith('/assistant/status')) {
      return route.fulfill({
        json: {
          ok: true,
          assistant: {
            installed: true,
            running: true,
            model: 'e2e-model',
            web_search: { available: true, provider: 'test' },
            tts: { ready: true, voice: 'test' },
          },
        },
      })
    }
    if (path.endsWith('/command')) {
      return route.fulfill({ json: { ok: true, command: body?.command ?? 'unknown' } })
    }
    if (path.endsWith('/head')) return route.fulfill({ json: { ok: true, yaw: 0, pitch: 0 } })
    if (path.endsWith('/assistant/chat')) {
      return route.fulfill({ json: { ok: true, answer: 'e2e answer' } })
    }
    if (path.endsWith('/assistant/control')) {
      return route.fulfill({
        json: {
          ok: true,
          message: 'ok',
          assistant: { installed: true, running: true },
        },
      })
    }
    if (path.endsWith('/assistant/history')) {
      return route.fulfill({ json: { ok: true, message: 'cleared' } })
    }
    return route.fulfill({ status: 404, json: { error: 'Unhandled test endpoint' } })
  })
}

async function connectToMockPiDog(page: Page) {
  await page.getByRole('button', { name: 'Настроить подключение' }).click()
  await page.getByRole('button', { name: 'Проверить и сохранить' }).click()
  await expect(page.getByText(/На связи/)).toBeVisible()
}

test.describe('PiDog control station E2E', () => {
  test.beforeEach(async ({ page }) => {
    await mockPiDogApi(page)
    await page.goto('/')
    await connectToMockPiDog(page)
  })

  test('opens every application screen from desktop navigation', async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'desktop-chromium',
      'Desktop navigation is not rendered on mobile',
    )
    const navigation = page.locator('aside')
    const screens = [
      ['Голос', 'Голосовое управление'],
      ['Команды', 'Все команды'],
      ['Сенсоры', 'Сенсоры и свет'],
      ['LLM', 'Локальный Пайдог'],
      ['Пульт', 'ХОД / ПОВОРОТ'],
    ] as const

    for (const [navigationLabel, heading] of screens) {
      // eslint-disable-next-line no-await-in-loop
      await navigation.getByRole('button', { name: navigationLabel, exact: true }).click()
      // eslint-disable-next-line no-await-in-loop
      await expect(page.getByText(heading, { exact: true })).toBeVisible()
    }
  })

  test('sends movement, stop, head, and emergency commands', async ({ page }) => {
    await Promise.all([
      page.waitForRequest(
        (request) =>
          request.url().endsWith('/pidog-api/command') &&
          request.postDataJSON()?.command === 'drive_forward',
      ),
      page.keyboard.down('ArrowUp'),
    ])
    await Promise.all([
      page.waitForRequest(
        (request) =>
          request.url().endsWith('/pidog-api/command') &&
          request.postDataJSON()?.command === 'stop',
      ),
      page.keyboard.up('ArrowUp'),
    ])

    const head = page.getByRole('slider', { name: 'ГОЛОВА' })
    await head.focus()
    await page.keyboard.press('ArrowLeft')
    await page.getByRole('button', { name: 'Emergency stop' }).click()
    await expect(page.getByRole('button', { name: 'Emergency stop' })).toBeEnabled()
  })
})

test.describe('PiDog mobile control station E2E', () => {
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true })

  test('uses the mobile navigation and keeps both circular controls visible', async ({ page }) => {
    await mockPiDogApi(page)
    await page.goto('/')
    await connectToMockPiDog(page)
    await expect(page.locator('aside')).toBeHidden()
    await expect(page.getByRole('slider', { name: 'ХОД / ПОВОРОТ' })).toBeVisible()
    await expect(page.getByRole('slider', { name: 'ГОЛОВА' })).toBeVisible()

    await page.getByRole('button', { name: 'Команды', exact: true }).click()
    await expect(page.getByText('Все команды', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Сенсоры', exact: true }).last().click()
    await expect(page.getByText('Сенсоры и свет', { exact: true })).toBeVisible()
  })
})

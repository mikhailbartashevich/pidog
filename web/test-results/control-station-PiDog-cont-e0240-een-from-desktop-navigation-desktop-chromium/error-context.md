# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: control-station.spec.ts >> PiDog control station E2E >> opens every application screen from desktop navigation
- Location: e2e/control-station.spec.ts:84:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText(/На связи/)
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByText(/На связи/)

```

```yaml
- complementary:
  - img "PiDog"
  - list:
    - button "Пульт"
    - button "Голос"
    - button "Команды"
    - button "Сенсоры"
    - button "LLM"
- banner:
  - paragraph: Пульт
  - text: Нет подключения
  - combobox "Language": RU
  - button "Настроить подключение"
  - button "Emergency stop" [disabled]
- main:
  - paragraph: Камера выключена
  - button "Запустить поток" [disabled]
  - text: OFFLINE
  - button "Обновить поток" [disabled]
  - button "На весь экран"
  - paragraph: Прямой MJPEG-поток внутри локальной сети
  - button "Включить" [disabled]
  - button "Выключить" [disabled]
  - text: ХОД / ПОВОРОТ
  - slider "ХОД / ПОВОРОТ": Вперёд Назад Лево Право
  - text: ГОЛОВА
  - slider "ГОЛОВА": Вверх Вниз Лево Право
  - text: БЫСТРЫЕ ПОЗЫ
  - button "Встать" [disabled]
  - button "Сесть" [disabled]
  - button "Голос" [disabled]
  - button "Хвост" [disabled]
  - button "АВАРИЙНЫЙ STOP" [disabled]
  - text: БАТАРЕЯ
  - paragraph: —
  - text: ДИСТАНЦИЯ
  - paragraph: —
  - text: ЗВУК
  - paragraph: Тихо
  - text: ПИТАНИЕ
  - paragraph: —
  - heading "Поиск цвета" [level=3]
  - text: Пайдог наведётся и укажет лапой
  - button "Найти красный" [disabled]
  - button "Найти оранжевый" [disabled]
  - button "Найти жёлтый" [disabled]
  - button "Найти зелёный" [disabled]
  - button "Найти синий" [disabled]
  - button "Найти фиолетовый" [disabled]
  - button "Лицо" [disabled]
  - button "Предмет" [disabled]
  - heading "Журнал зрения" [level=3]
  - text: Последние 10 событий
  - button "Очистить журнал зрения" [disabled]
  - separator
  - paragraph: Событий пока нет
```

# Test source

```ts
  1   | import { expect, test, type Page } from '@playwright/test'
  2   | 
  3   | const health = {
  4   |   ok: true,
  5   |   service: 'pidog-voice',
  6   |   version: 'e2e',
  7   |   dry_run: true,
  8   |   commands: ['drive_forward', 'stop'],
  9   | }
  10  | 
  11  | const sensors = {
  12  |   ok: true,
  13  |   message: 'ok',
  14  |   distance_cm: 42,
  15  |   touch: null,
  16  |   sound_detected: false,
  17  |   sound_direction: null,
  18  |   camera: false,
  19  |   battery_voltage: 7.4,
  20  |   battery_percent: 88,
  21  |   external_power: true,
  22  |   charging: true,
  23  |   power_detection: 'USB-C',
  24  | }
  25  | 
  26  | async function mockPiDogApi(page: Page) {
  27  |   await page.route('**/pidog-api/**', async (route) => {
  28  |     const request = route.request()
  29  |     const path = new URL(request.url()).pathname
  30  |     const body =
  31  |       request.method() === 'POST' ? (request.postDataJSON() as { command?: string }) : null
  32  | 
  33  |     if (path.endsWith('/health')) return route.fulfill({ json: health })
  34  |     if (path.endsWith('/sensors')) return route.fulfill({ json: sensors })
  35  |     if (path.endsWith('/assistant/status')) {
  36  |       return route.fulfill({
  37  |         json: {
  38  |           ok: true,
  39  |           assistant: {
  40  |             installed: true,
  41  |             running: true,
  42  |             model: 'e2e-model',
  43  |             web_search: { available: true, provider: 'test' },
  44  |             tts: { ready: true, voice: 'test' },
  45  |           },
  46  |         },
  47  |       })
  48  |     }
  49  |     if (path.endsWith('/command')) {
  50  |       return route.fulfill({ json: { ok: true, command: body?.command ?? 'unknown' } })
  51  |     }
  52  |     if (path.endsWith('/head')) return route.fulfill({ json: { ok: true, yaw: 0, pitch: 0 } })
  53  |     if (path.endsWith('/assistant/chat')) {
  54  |       return route.fulfill({ json: { ok: true, answer: 'e2e answer' } })
  55  |     }
  56  |     if (path.endsWith('/assistant/control')) {
  57  |       return route.fulfill({
  58  |         json: {
  59  |           ok: true,
  60  |           message: 'ok',
  61  |           assistant: { installed: true, running: true },
  62  |         },
  63  |       })
  64  |     }
  65  |     if (path.endsWith('/assistant/history')) {
  66  |       return route.fulfill({ json: { ok: true, message: 'cleared' } })
  67  |     }
  68  |     return route.fulfill({ status: 404, json: { error: 'Unhandled test endpoint' } })
  69  |   })
  70  | }
  71  | 
  72  | test.describe('PiDog control station E2E', () => {
  73  |   test.beforeEach(async ({ page }) => {
  74  |     page.on('request', (request) =>
  75  |       console.log(`E2E request: ${request.method()} ${request.url()}`),
  76  |     )
  77  |     page.on('pageerror', (error) => console.log(`E2E page error: ${error.message}`))
  78  |     page.on('console', (message) => console.log(`E2E console ${message.type()}: ${message.text()}`))
  79  |     await mockPiDogApi(page)
  80  |     await page.goto('/')
> 81  |     await expect(page.getByText(/На связи/)).toBeVisible()
      |                                              ^ Error: expect(locator).toBeVisible() failed
  82  |   })
  83  | 
  84  |   test('opens every application screen from desktop navigation', async ({ page }) => {
  85  |     const navigation = page.locator('aside')
  86  |     const screens = [
  87  |       ['Голос', 'Голосовое управление'],
  88  |       ['Команды', 'Все команды'],
  89  |       ['Сенсоры', 'Сенсоры и свет'],
  90  |       ['LLM', 'Локальный Пайдог'],
  91  |       ['Пульт', 'ХОД / ПОВОРОТ'],
  92  |     ] as const
  93  | 
  94  |     for (const [navigationLabel, heading] of screens) {
  95  |       // eslint-disable-next-line no-await-in-loop
  96  |       await navigation.getByRole('button', { name: navigationLabel, exact: true }).click()
  97  |       // eslint-disable-next-line no-await-in-loop
  98  |       await expect(page.getByText(heading, { exact: true })).toBeVisible()
  99  |     }
  100 |   })
  101 | 
  102 |   test('sends movement, stop, head, and emergency commands', async ({ page }) => {
  103 |     const movement = page.getByRole('slider', { name: 'ХОД / ПОВОРОТ' })
  104 |     await movement.focus()
  105 |     await Promise.all([
  106 |       page.waitForRequest(
  107 |         (request) =>
  108 |           request.url().endsWith('/pidog-api/command') &&
  109 |           request.postDataJSON()?.command === 'drive_forward',
  110 |       ),
  111 |       page.keyboard.down('ArrowUp'),
  112 |     ])
  113 |     await Promise.all([
  114 |       page.waitForRequest(
  115 |         (request) =>
  116 |           request.url().endsWith('/pidog-api/command') &&
  117 |           request.postDataJSON()?.command === 'stop',
  118 |       ),
  119 |       page.keyboard.up('ArrowUp'),
  120 |     ])
  121 | 
  122 |     const head = page.getByRole('slider', { name: 'ГОЛОВА' })
  123 |     await head.focus()
  124 |     await page.keyboard.press('ArrowLeft')
  125 |     await page.getByRole('button', { name: 'Emergency stop' }).click()
  126 |     await expect(page.getByRole('button', { name: 'Emergency stop' })).toBeEnabled()
  127 |   })
  128 | })
  129 | 
  130 | test.describe('PiDog mobile control station E2E', () => {
  131 |   test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true })
  132 | 
  133 |   test('uses the mobile navigation and keeps both circular controls visible', async ({ page }) => {
  134 |     await mockPiDogApi(page)
  135 |     await page.goto('/')
  136 |     await expect(page.getByText(/На связи/)).toBeVisible()
  137 |     await expect(page.locator('aside')).toBeHidden()
  138 |     await expect(page.getByRole('slider', { name: 'ХОД / ПОВОРОТ' })).toBeVisible()
  139 |     await expect(page.getByRole('slider', { name: 'ГОЛОВА' })).toBeVisible()
  140 | 
  141 |     await page.getByRole('button', { name: 'Команды', exact: true }).click()
  142 |     await expect(page.getByText('Все команды', { exact: true })).toBeVisible()
  143 |     await page.getByRole('button', { name: 'Сенсоры', exact: true }).click()
  144 |     await expect(page.getByText('Сенсоры и свет', { exact: true })).toBeVisible()
  145 |   })
  146 | })
  147 | 
```
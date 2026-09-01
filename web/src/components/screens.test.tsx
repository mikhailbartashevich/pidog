import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ConnectionDialog } from './ConnectionDialog'
import { AssistantPage } from './pages/AssistantPage'
import { CockpitPage } from './pages/CockpitPage'
import { CommandsPage } from './pages/CommandsPage'
import { SensorsPage } from './pages/SensorsPage'
import { VoicePage } from './pages/VoicePage'

afterEach(cleanup)

const voidMock = () => vi.fn<() => void>()
const commandMock = () => vi.fn<(command: string) => void>()
const movementMock = () => vi.fn<(axis: 'drive' | 'turn', direction: -1 | 0 | 1) => void>()
const headMock = () => vi.fn<(x: number, y: number) => void>()
const settings = { host: '192.168.1.37', port: 8765, token: '' }

describe('application screens', () => {
  it('renders the cockpit screen with both critical controls', () => {
    render(
      <CockpitPage
        language="ru"
        connected={false}
        sensors={null}
        streaming={false}
        streamNonce={0}
        settings={settings}
        busyCommand={null}
        visionLog={[]}
        onCommand={commandMock()}
        onMove={movementMock()}
        onHead={headMock()}
        onStop={voidMock()}
        onRefreshStream={voidMock()}
        onClearLog={voidMock()}
      />,
    )

    expect(screen.getByText('ХОД / ПОВОРОТ')).toBeInTheDocument()
    expect(screen.getByText('ГОЛОВА')).toBeInTheDocument()
    expect(screen.getAllByRole('slider')).toHaveLength(2)
  })

  it('renders the voice screen and its microphone control', () => {
    render(
      <VoicePage
        language="ru"
        supported
        listening={false}
        recognized=""
        match={null}
        connected
        busyCommand={null}
        onToggleSpeech={voidMock()}
        onCommand={commandMock()}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Голосовое управление' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Начать распознавание' })).toBeEnabled()
  })

  it('renders the commands screen with searchable actions', () => {
    render(<CommandsPage language="ru" busyCommand={null} onCommand={commandMock()} />)

    expect(screen.getByRole('heading', { name: 'Все команды' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: '' })).toHaveAttribute(
      'placeholder',
      'Найти команду…',
    )
    expect(screen.getByText('Вперёд')).toBeInTheDocument()
  })

  it('renders the sensors screen and refresh action', () => {
    render(
      <SensorsPage
        language="ru"
        sensors={null}
        history={[]}
        connected
        onRefresh={voidMock()}
        onCommand={commandMock()}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Сенсоры и свет' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Обновить' })).toBeEnabled()
    expect(screen.getByText('История появится после подключения')).toBeInTheDocument()
  })

  it('renders the assistant screen with a disabled ask action until ready', () => {
    render(
      <AssistantPage
        language="ru"
        status={null}
        connected
        busy={false}
        question=""
        reply={null}
        search={true}
        speak={false}
        speechSupported={false}
        speechListening={false}
        onQuestion={vi.fn<(value: string) => void>()}
        onSearch={vi.fn<(value: boolean) => void>()}
        onSpeak={vi.fn<(value: boolean) => void>()}
        onAsk={voidMock()}
        onSpeech={voidMock()}
        onRefresh={voidMock()}
        onControl={vi.fn<(action: 'start' | 'stop' | 'restart') => void>()}
        onClear={voidMock()}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Локальный Пайдог' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Спросить' })).toBeDisabled()
  })

  it('renders and submits the connection dialog', () => {
    const onSave = voidMock()
    render(
      <ConnectionDialog
        language="ru"
        open
        value={settings}
        connecting={false}
        onChange={vi.fn<(value: typeof settings) => void>()}
        onClose={voidMock()}
        onSave={onSave}
      />,
    )

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Подключение к Пайдогу' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Проверить и сохранить' }))
    expect(onSave).toHaveBeenCalledOnce()
  })
})

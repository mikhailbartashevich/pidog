import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { actionGroups } from '../lib/commands'
import { AssistantPage } from './pages/AssistantPage'
import { CockpitPage } from './pages/CockpitPage'
import { CommandsPage } from './pages/CommandsPage'
import { SensorsPage } from './pages/SensorsPage'
import { VoicePage } from './pages/VoicePage'

afterEach(cleanup)

const settings = { host: '192.168.1.37', port: 8765, token: '' }
const voidMock = () => vi.fn<() => void>()
const commandMock = () => vi.fn<(command: string) => void>()
const movementMock = () => vi.fn<(axis: 'drive' | 'turn', direction: -1 | 0 | 1) => void>()
const headMock = () => vi.fn<(x: number, y: number) => void>()
const assistantStatus = (running: boolean) => ({
  installed: true,
  running,
  model: 'test',
  web_search: { available: true, provider: 'test' },
  tts: { ready: true, voice: 'test' },
})

describe('screen button actions', () => {
  it('clicks the connected cockpit actions', () => {
    const onCommand = commandMock()
    const onStop = voidMock()
    const onClearLog = voidMock()
    render(
      <CockpitPage
        language="ru"
        connected
        sensors={null}
        streaming={false}
        streamNonce={0}
        settings={settings}
        busyCommand={null}
        visionLog={[{ id: 1, time: '12:00', title: 'test', detail: 'test', success: true }]}
        onCommand={onCommand}
        onMove={movementMock()}
        onHead={headMock()}
        onStop={onStop}
        onRefreshStream={voidMock()}
        onClearLog={onClearLog}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Запустить поток' }))
    fireEvent.click(screen.getByRole('button', { name: 'Встать' }))
    fireEvent.click(screen.getByRole('button', { name: 'Сесть' }))
    fireEvent.click(screen.getByRole('button', { name: 'Голос' }))
    fireEvent.click(screen.getByRole('button', { name: 'Хвост' }))
    fireEvent.click(screen.getByRole('button', { name: 'АВАРИЙНЫЙ STOP' }))
    fireEvent.click(screen.getByRole('button', { name: 'Найти красный' }))
    fireEvent.click(screen.getByRole('button', { name: 'Лицо' }))
    fireEvent.click(screen.getByRole('button', { name: 'Предмет' }))
    fireEvent.click(screen.getByRole('button', { name: 'Очистить журнал зрения' }))

    expect(onCommand).toHaveBeenCalledWith('camera_on')
    expect(onCommand).toHaveBeenCalledWith('stand')
    expect(onCommand).toHaveBeenCalledWith('sit')
    expect(onCommand).toHaveBeenCalledWith('bark')
    expect(onCommand).toHaveBeenCalledWith('wag_tail')
    expect(onCommand).toHaveBeenCalledWith('find_red')
    expect(onCommand).toHaveBeenCalledWith('follow_face')
    expect(onCommand).toHaveBeenCalledWith('follow_object')
    expect(onStop).toHaveBeenCalledOnce()
    expect(onClearLog).toHaveBeenCalledOnce()
  })

  it('clicks voice controls and local microphone commands', () => {
    const onToggleSpeech = voidMock()
    const onCommand = commandMock()
    render(
      <VoicePage
        language="ru"
        supported
        listening={false}
        recognized=""
        match={null}
        connected
        busyCommand={null}
        onToggleSpeech={onToggleSpeech}
        onCommand={onCommand}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Начать распознавание' }))
    fireEvent.click(screen.getByRole('button', { name: 'Слушать через Пайдог' }))
    fireEvent.click(screen.getByRole('button', { name: 'Остановить' }))

    expect(onToggleSpeech).toHaveBeenCalledOnce()
    expect(onCommand).toHaveBeenNthCalledWith(1, 'local_voice_on')
    expect(onCommand).toHaveBeenNthCalledWith(2, 'local_voice_off')
  })

  it('clicks every command after selecting each command group', () => {
    const onCommand = commandMock()
    render(<CommandsPage language="ru" busyCommand={null} onCommand={onCommand} />)

    for (const group of actionGroups) {
      fireEvent.click(screen.getByRole('button', { name: group.label }))
      for (const action of group.actions) {
        fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${action.label}`) }))
        expect(onCommand).toHaveBeenLastCalledWith(action.command)
      }
    }
    expect(onCommand).toHaveBeenCalledTimes(
      actionGroups.reduce((count, group) => count + group.actions.length, 0),
    )
  })

  it('clicks sensor refresh, measurements, and every light action', () => {
    const onRefresh = voidMock()
    const onCommand = commandMock()
    render(
      <SensorsPage
        language="ru"
        sensors={null}
        history={[]}
        connected
        onRefresh={onRefresh}
        onCommand={onCommand}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Обновить' }))
    fireEvent.click(screen.getByRole('button', { name: 'Показать заряд на LED' }))
    fireEvent.click(screen.getByRole('button', { name: 'Измерить дистанцию' }))
    fireEvent.click(screen.getByRole('button', { name: 'Найти источник звука' }))
    for (const action of actionGroups.find((group) => group.id === 'lights')?.actions ?? []) {
      fireEvent.click(screen.getByRole('button', { name: action.label }))
      expect(onCommand).toHaveBeenLastCalledWith(action.command)
    }

    expect(onRefresh).toHaveBeenCalledOnce()
    expect(onCommand).toHaveBeenNthCalledWith(1, 'show_battery')
    expect(onCommand).toHaveBeenNthCalledWith(2, 'measure_distance')
    expect(onCommand).toHaveBeenNthCalledWith(3, 'listen_sound')
  })

  it('clicks assistant lifecycle, voice, options, and ask actions', () => {
    const onControl = vi.fn<(action: 'start' | 'stop' | 'restart') => void>()
    const onQuestion = vi.fn<(value: string) => void>()
    const onSearch = vi.fn<(value: boolean) => void>()
    const onSpeak = vi.fn<(value: boolean) => void>()
    const onAsk = voidMock()
    const onSpeech = voidMock()
    const onRefresh = voidMock()
    const onClear = voidMock()
    const assistantProps = {
      language: 'ru' as const,
      connected: true,
      busy: false,
      question: 'погода',
      reply: null,
      search: false,
      speak: false,
      speechSupported: true,
      speechListening: false,
      onQuestion,
      onSearch,
      onSpeak,
      onAsk,
      onSpeech,
      onRefresh,
      onControl,
      onClear,
    }
    const view = render(<AssistantPage {...assistantProps} status={assistantStatus(false)} />)

    fireEvent.click(screen.getByRole('button', { name: 'Запустить' }))
    view.rerender(<AssistantPage {...assistantProps} status={assistantStatus(true)} />)
    fireEvent.click(screen.getByRole('button', { name: 'Остановить' }))
    fireEvent.click(screen.getByRole('button', { name: 'Обновить' }))
    fireEvent.click(screen.getByRole('button', { name: 'Очистить историю диалога' }))
    fireEvent.click(screen.getByRole('button', { name: 'Продиктовать вопрос' }))
    fireEvent.click(screen.getByRole('switch', { name: 'Веб-поиск' }))
    fireEvent.click(screen.getByRole('switch', { name: 'Озвучить' }))
    fireEvent.click(screen.getByRole('button', { name: 'Спросить' }))

    expect(onControl).toHaveBeenCalledWith('start')
    expect(onRefresh).toHaveBeenCalledOnce()
    expect(onClear).toHaveBeenCalledOnce()
    expect(onSpeech).toHaveBeenCalledOnce()
    expect(onSearch).toHaveBeenCalledWith(true)
    expect(onSpeak).toHaveBeenCalledWith(true)
    expect(onAsk).toHaveBeenCalledOnce()
  })
})

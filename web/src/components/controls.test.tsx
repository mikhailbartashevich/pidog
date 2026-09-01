import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { HeadJoystick } from './HeadJoystick'
import { Joystick } from './Joystick'
import { CockpitPage } from './pages/CockpitPage'

type MovementHandler = (axis: 'drive' | 'turn', direction: -1 | 0 | 1) => void
type HeadHandler = (x: number, y: number) => void

const movementMock = () => vi.fn<MovementHandler>()
const headMock = () => vi.fn<HeadHandler>()
const voidMock = () => vi.fn<() => void>()

afterEach(cleanup)

const movementLabels = {
  label: 'ХОД / ПОВОРОТ',
  forwardLabel: 'Вперёд',
  backwardLabel: 'Назад',
  leftLabel: 'Лево',
  rightLabel: 'Право',
}

describe('critical joystick controls', () => {
  it('starts movement from the combined joystick pointer', () => {
    const onMovementChange = movementMock()
    render(<Joystick {...movementLabels} onMovementChange={onMovementChange} />)
    const control = screen.getByRole('slider')

    vi.spyOn(control, 'getBoundingClientRect').mockReturnValue({
      bottom: 220,
      height: 220,
      left: 0,
      right: 220,
      top: 0,
      width: 220,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })
    Object.defineProperty(control, 'setPointerCapture', { value: voidMock() })
    Object.defineProperty(control, 'hasPointerCapture', { value: () => true })
    Object.defineProperty(control, 'releasePointerCapture', { value: voidMock() })

    control.focus()
    fireEvent.pointerDown(control, { clientX: 110, clientY: 20, pointerId: 1 })
    expect(onMovementChange).toHaveBeenLastCalledWith('drive', -1)
  })

  it('reacts to keyboard arrows and stops when the movement joystick loses focus', () => {
    const onMovementChange = movementMock()
    render(<Joystick {...movementLabels} onMovementChange={onMovementChange} />)
    const control = screen.getByRole('slider')

    control.focus()
    fireEvent.keyDown(control, { key: 'ArrowRight' })
    expect(onMovementChange).toHaveBeenLastCalledWith('turn', 1)
    fireEvent.blur(control)
    expect(onMovementChange).toHaveBeenLastCalledWith('turn', 0)
  })

  it('keeps head keyboard control independent and resets on key release', () => {
    const onPositionChange = headMock()
    render(
      <HeadJoystick
        label="ГОЛОВА"
        upLabel="Вверх"
        downLabel="Вниз"
        leftLabel="Лево"
        rightLabel="Право"
        onPositionChange={onPositionChange}
      />,
    )
    const control = screen.getByRole('slider')

    fireEvent.keyDown(control, { key: 'ArrowUp' })
    expect(onPositionChange).toHaveBeenLastCalledWith(0, -1)
    fireEvent.keyUp(control, { key: 'ArrowUp' })
    expect(onPositionChange).toHaveBeenLastCalledWith(0, 0)
  })

  it('maps unfocused cockpit arrows to movement and stops on release', () => {
    const onMove = movementMock()
    render(
      <CockpitPage
        language="ru"
        connected
        sensors={null}
        streaming={false}
        streamNonce={0}
        settings={{ host: '192.168.1.37', port: 8765, token: '' }}
        busyCommand={null}
        visionLog={[]}
        onCommand={voidMock()}
        onMove={onMove}
        onHead={headMock()}
        onStop={voidMock()}
        onRefreshStream={voidMock()}
        onClearLog={voidMock()}
      />,
    )

    fireEvent.keyDown(window, { key: 'ArrowUp' })
    expect(onMove).toHaveBeenLastCalledWith('drive', -1)
    fireEvent.keyUp(window, { key: 'ArrowUp' })
    expect(onMove).toHaveBeenLastCalledWith('drive', 0)
  })
})

import { Box, Stack } from '@mui/material'
import { useEffect, useRef } from 'react'

import type { Axis, CockpitProps, Direction } from '../../types/ui'
import { CockpitCamera } from '../cockpit/CockpitCamera'
import { CockpitControls } from '../cockpit/CockpitControls'
import { CockpitInsights } from '../cockpit/CockpitInsights'

const keyboardMovement: Record<string, { axis: Axis; direction: Direction }> = {
  ArrowUp: { axis: 'drive', direction: -1 },
  ArrowDown: { axis: 'drive', direction: 1 },
  ArrowLeft: { axis: 'turn', direction: -1 },
  ArrowRight: { axis: 'turn', direction: 1 },
}

function ignoresKeyboardMovement(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
    target.getAttribute('role') === 'slider'
  )
}

function useKeyboardMovement(connected: boolean, onMove: CockpitProps['onMove']) {
  const pressedKeysRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    const pressedKeys = pressedKeysRef.current
    const releaseAll = () => {
      if (pressedKeys.size === 0) return
      pressedKeys.clear()
      onMove('drive', 0)
      onMove('turn', 0)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      const movement = keyboardMovement[event.key]
      if (
        !connected ||
        !movement ||
        ignoresKeyboardMovement(event.target) ||
        pressedKeys.has(event.key)
      )
        return
      event.preventDefault()
      pressedKeys.add(event.key)
      onMove(movement.axis, movement.direction)
    }
    const onKeyUp = (event: KeyboardEvent) => {
      const movement = keyboardMovement[event.key]
      if (!movement || !pressedKeys.delete(event.key)) return
      event.preventDefault()
      const remainingDirection = Object.entries(keyboardMovement).find(
        ([key, candidate]) =>
          key !== event.key && candidate.axis === movement.axis && pressedKeys.has(key),
      )?.[1].direction
      onMove(movement.axis, remainingDirection ?? 0)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', releaseAll)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', releaseAll)
      pressedKeys.clear()
    }
  }, [connected, onMove])
}

export function CockpitPage(props: CockpitProps) {
  useKeyboardMovement(props.connected, props.onMove)

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1fr) 360px' },
        gap: 2,
      }}
    >
      <Stack sx={{ gap: 2, minWidth: 0 }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'minmax(0, 1fr)',
              md: 'clamp(360px, 32vw, 480px) minmax(0, 1fr)',
            },
            gap: 1.5,
            alignItems: 'start',
          }}
        >
          <CockpitCamera {...props} />
          <CockpitControls {...props} />
        </Box>
      </Stack>
      <CockpitInsights {...props} />
    </Box>
  )
}

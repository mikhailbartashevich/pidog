import { Box, Typography, alpha } from '@mui/material'
import {
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'

type Axis = 'drive' | 'turn'
type Direction = -1 | 0 | 1

type Movement = {
  axis: Axis
  direction: Direction
}

type Position = {
  x: number
  y: number
}

type JoystickProps = {
  label: string
  forwardLabel: string
  backwardLabel: string
  leftLabel: string
  rightLabel: string
  disabled?: boolean
  onMovementChange: (axis: Axis, direction: Direction) => void
}

function movementFromPosition(position: Position, lastAxis: Axis): Movement {
  const { x, y } = position
  if (Math.max(Math.abs(x), Math.abs(y)) < 0.2) return { axis: lastAxis, direction: 0 }
  if (Math.abs(y) >= Math.abs(x)) return { axis: 'drive', direction: y < 0 ? -1 : 1 }
  return { axis: 'turn', direction: x < 0 ? -1 : 1 }
}

export function Joystick({
  label,
  forwardLabel,
  backwardLabel,
  leftLabel,
  rightLabel,
  disabled = false,
  onMovementChange,
}: JoystickProps) {
  const surfaceRef = useRef<HTMLDivElement | null>(null)
  const activePointerIdRef = useRef<number | null>(null)
  const movementRef = useRef<Movement>({ axis: 'drive', direction: 0 })
  const keyboardKeysRef = useRef<Set<string>>(new Set())
  const lastAxisRef = useRef<Axis>('drive')
  const [movement, setMovement] = useState<Movement>({ axis: 'drive', direction: 0 })
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 })

  const notifyMovement = useCallback(
    (next: Movement) => {
      const previous = movementRef.current
      if (next.axis === previous.axis && next.direction === previous.direction) {
        return
      }
      if (previous.direction !== 0 && previous.axis !== next.axis) {
        onMovementChange(previous.axis, 0)
      }
      const shouldNotifyNext =
        next.direction !== 0 || previous.direction === 0 || previous.axis === next.axis
      movementRef.current = next
      setMovement(next)
      if (shouldNotifyNext) onMovementChange(next.axis, next.direction)
    },
    [onMovementChange],
  )

  const reset = useCallback(() => {
    activePointerIdRef.current = null
    keyboardKeysRef.current.clear()
    lastAxisRef.current = 'drive'
    setPosition({ x: 0, y: 0 })
    notifyMovement({ axis: 'drive', direction: 0 })
  }, [notifyMovement])

  useEffect(() => {
    const releaseFromWindow = (event: globalThis.PointerEvent) => {
      if (activePointerIdRef.current === event.pointerId) reset()
    }
    window.addEventListener('pointerup', releaseFromWindow)
    window.addEventListener('pointercancel', releaseFromWindow)
    return () => {
      window.removeEventListener('pointerup', releaseFromWindow)
      window.removeEventListener('pointercancel', releaseFromWindow)
    }
  }, [reset])

  const positionFromKeyboard = (): Position => {
    let x = 0
    let y = 0
    if (keyboardKeysRef.current.has('ArrowLeft')) x -= 1
    if (keyboardKeysRef.current.has('ArrowRight')) x += 1
    if (keyboardKeysRef.current.has('ArrowUp')) y -= 1
    if (keyboardKeysRef.current.has('ArrowDown')) y += 1
    const length = Math.hypot(x, y)
    return length > 1 ? { x: x / length, y: y / length } : { x, y }
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled || !event.key.startsWith('Arrow')) return
    event.preventDefault()
    if (keyboardKeysRef.current.has(event.key)) return
    keyboardKeysRef.current.add(event.key)
    lastAxisRef.current = event.key === 'ArrowUp' || event.key === 'ArrowDown' ? 'drive' : 'turn'
    const nextPosition = positionFromKeyboard()
    setPosition(nextPosition)
    notifyMovement(movementFromPosition(nextPosition, lastAxisRef.current))
  }

  const handleKeyUp = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!keyboardKeysRef.current.has(event.key)) return
    event.preventDefault()
    keyboardKeysRef.current.delete(event.key)
    const nextPosition = positionFromKeyboard()
    setPosition(nextPosition)
    notifyMovement(movementFromPosition(nextPosition, lastAxisRef.current))
  }

  const update = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = surfaceRef.current?.getBoundingClientRect()
    if (!bounds || disabled) return
    const radius = Math.min(bounds.width, bounds.height) / 2
    let x = (event.clientX - (bounds.left + bounds.width / 2)) / radius
    let y = (event.clientY - (bounds.top + bounds.height / 2)) / radius
    const length = Math.hypot(x, y)
    if (length > 1) {
      x /= length
      y /= length
    }
    if (length < 0.08) {
      x = 0
      y = 0
    }
    const nextPosition = { x, y }
    setPosition(nextPosition)
    notifyMovement(movementFromPosition(nextPosition, lastAxisRef.current))
  }

  const release = (event: PointerEvent<HTMLDivElement>) => {
    reset()
    if (surfaceRef.current?.hasPointerCapture(event.pointerId)) {
      surfaceRef.current.releasePointerCapture(event.pointerId)
    }
  }

  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography
        variant="overline"
        color="text.secondary"
        sx={{
          display: 'block',
          textAlign: 'center',
          fontWeight: 800,
          letterSpacing: '.1em',
          mb: 0.8,
        }}
      >
        {label}
      </Typography>
      <Box
        ref={surfaceRef}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={label}
        aria-valuemin={-1}
        aria-valuemax={1}
        aria-valuenow={movement.direction}
        onPointerDown={(event) => {
          if (disabled) return
          activePointerIdRef.current = event.pointerId
          event.currentTarget.setPointerCapture(event.pointerId)
          update(event)
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) update(event)
        }}
        onPointerUp={release}
        onPointerCancel={release}
        onLostPointerCapture={reset}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onBlur={reset}
        sx={{
          width: 'min(100%, 220px)',
          aspectRatio: '1 / 1',
          height: 'auto',
          minHeight: 0,
          mx: 'auto',
          borderRadius: '50%',
          position: 'relative',
          overflow: 'hidden',
          touchAction: 'none',
          cursor: disabled ? 'not-allowed' : 'grab',
          opacity: disabled ? 0.45 : 1,
          bgcolor: alpha('#06111b', 0.86),
          border: '1px solid',
          borderColor: alpha('#65dfff', 0.18),
          backgroundImage:
            'linear-gradient(90deg, transparent 49.5%, rgba(101,223,255,.13) 50%, transparent 50.5%), linear-gradient(0deg, transparent 49.5%, rgba(101,223,255,.13) 50%, transparent 50.5%)',
          '&:focus-visible': {
            outline: '2px solid',
            outlineColor: 'primary.main',
            outlineOffset: 2,
          },
        }}
      >
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)' }}
        >
          {forwardLabel}
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)' }}
        >
          {backwardLabel}
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}
        >
          {leftLabel}
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)' }}
        >
          {rightLabel}
        </Typography>
        <Box
          sx={{
            width: 58,
            height: 58,
            borderRadius: '50%',
            position: 'absolute',
            left: `${50 + position.x * 35}%`,
            top: `${50 + position.y * 35}%`,
            transform: 'translate(-50%, -50%)',
            bgcolor: 'primary.main',
            boxShadow: '0 0 0 8px rgba(24,213,255,.09), 0 10px 30px rgba(0,0,0,.35)',
            transition: position.x === 0 && position.y === 0 ? 'transform .18s ease' : 'none',
          }}
        />
      </Box>
    </Box>
  )
}

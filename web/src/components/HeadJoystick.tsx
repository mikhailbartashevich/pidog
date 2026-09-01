import { Box, Typography, alpha } from '@mui/material'
import { type PointerEvent, useRef, useState } from 'react'

type HeadJoystickProps = {
  label: string
  upLabel: string
  downLabel: string
  leftLabel: string
  rightLabel: string
  disabled?: boolean
  onPositionChange: (x: number, y: number) => void
}

type Position = {
  x: number
  y: number
}

export function HeadJoystick({
  label,
  upLabel,
  downLabel,
  leftLabel,
  rightLabel,
  disabled = false,
  onPositionChange,
}: HeadJoystickProps) {
  const surfaceRef = useRef<HTMLDivElement | null>(null)
  const positionRef = useRef<Position>({ x: 0, y: 0 })
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 })

  const setAndNotify = (next: Position) => {
    positionRef.current = next
    setPosition(next)
    onPositionChange(next.x, next.y)
  }

  const resetVisualPosition = () => {
    positionRef.current = { x: 0, y: 0 }
    setPosition({ x: 0, y: 0 })
  }

  const update = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = surfaceRef.current?.getBoundingClientRect()
    if (!bounds || disabled) return
    const radius = Math.max(1, Math.min(bounds.width, bounds.height) / 2 - 32)
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
    setAndNotify({ x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 })
  }

  const release = (event: PointerEvent<HTMLDivElement>) => {
    if (surfaceRef.current?.hasPointerCapture(event.pointerId)) {
      surfaceRef.current.releasePointerCapture(event.pointerId)
    }
    // Head commands are absolute: releasing the control must not centre the head.
    resetVisualPosition()
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
        tabIndex={disabled ? -1 : 0}
        aria-label={label}
        onPointerDown={(event) => {
          if (disabled) return
          event.currentTarget.setPointerCapture(event.pointerId)
          update(event)
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) update(event)
        }}
        onPointerUp={release}
        onPointerCancel={release}
        onKeyDown={(event) => {
          if (disabled || !event.key.startsWith('Arrow')) return
          event.preventDefault()
          const next = { ...positionRef.current }
          if (event.key === 'ArrowLeft') next.x = -1
          if (event.key === 'ArrowRight') next.x = 1
          if (event.key === 'ArrowUp') next.y = -1
          if (event.key === 'ArrowDown') next.y = 1
          setAndNotify(next)
        }}
        onKeyUp={(event) => {
          if (event.key.startsWith('Arrow')) resetVisualPosition()
        }}
        sx={{
          width: '100%',
          height: 142,
          borderRadius: 4,
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
          sx={{ position: 'absolute', top: 7, left: '50%', transform: 'translateX(-50%)' }}
        >
          {upLabel}
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ position: 'absolute', bottom: 7, left: '50%', transform: 'translateX(-50%)' }}
        >
          {downLabel}
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)' }}
        >
          {leftLabel}
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)' }}
        >
          {rightLabel}
        </Typography>
        <Box
          sx={{
            width: 58,
            height: 58,
            borderRadius: '50%',
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: `translate(calc(-50% + ${position.x * 39}px), calc(-50% + ${position.y * 39}px))`,
            bgcolor: 'primary.main',
            boxShadow: '0 0 0 8px rgba(24,213,255,.09), 0 10px 30px rgba(0,0,0,.35)',
            transition: position.x === 0 && position.y === 0 ? 'transform .18s ease' : 'none',
          }}
        />
      </Box>
    </Box>
  )
}

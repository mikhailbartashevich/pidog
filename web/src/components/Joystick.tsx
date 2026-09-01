import { Box, Typography, alpha } from '@mui/material'
import { type PointerEvent, useRef, useState } from 'react'

type Direction = -1 | 0 | 1

type JoystickProps = {
  axis: 'vertical' | 'horizontal'
  label: string
  negativeLabel: string
  positiveLabel: string
  disabled?: boolean
  onDirectionChange: (direction: Direction) => void
}

export function Joystick({
  axis,
  label,
  negativeLabel,
  positiveLabel,
  disabled = false,
  onDirectionChange,
}: JoystickProps) {
  const surfaceRef = useRef<HTMLDivElement | null>(null)
  const directionRef = useRef<Direction>(0)
  const [direction, setDirection] = useState<Direction>(0)
  const [offset, setOffset] = useState(0)

  const update = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = surfaceRef.current?.getBoundingClientRect()
    if (!bounds || disabled) return
    const center =
      axis === 'vertical' ? bounds.top + bounds.height / 2 : bounds.left + bounds.width / 2
    const point = axis === 'vertical' ? event.clientY : event.clientX
    const radius = (axis === 'vertical' ? bounds.height : bounds.width) / 2
    const normalized = Math.max(-1, Math.min(1, (point - center) / radius))
    setOffset(normalized * 54)
    const next: Direction = normalized < -0.28 ? -1 : normalized > 0.28 ? 1 : 0
    if (next !== directionRef.current) {
      directionRef.current = next
      setDirection(next)
      onDirectionChange(next)
    }
  }

  const release = (event: PointerEvent<HTMLDivElement>) => {
    if (surfaceRef.current?.hasPointerCapture(event.pointerId)) {
      surfaceRef.current.releasePointerCapture(event.pointerId)
    }
    setOffset(0)
    if (directionRef.current !== 0) {
      directionRef.current = 0
      setDirection(0)
      onDirectionChange(0)
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
        aria-valuenow={direction}
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
          if (disabled) return
          const negativeKey = axis === 'vertical' ? 'ArrowUp' : 'ArrowLeft'
          const positiveKey = axis === 'vertical' ? 'ArrowDown' : 'ArrowRight'
          const next: Direction = event.key === negativeKey ? -1 : event.key === positiveKey ? 1 : 0
          if (next !== 0 && next !== directionRef.current) {
            event.preventDefault()
            directionRef.current = next
            setDirection(next)
            setOffset(next * 54)
            onDirectionChange(next)
          }
        }}
        onKeyUp={(event) => {
          if (event.key.startsWith('Arrow')) {
            directionRef.current = 0
            setDirection(0)
            setOffset(0)
            onDirectionChange(0)
          }
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
            axis === 'vertical'
              ? 'linear-gradient(90deg, transparent 49.5%, rgba(101,223,255,.13) 50%, transparent 50.5%)'
              : 'linear-gradient(0deg, transparent 49.5%, rgba(101,223,255,.13) 50%, transparent 50.5%)',
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
          sx={{
            position: 'absolute',
            top: axis === 'vertical' ? 8 : '50%',
            left: axis === 'vertical' ? '50%' : 10,
            transform: axis === 'vertical' ? 'translateX(-50%)' : 'translateY(-50%)',
            fontWeight: 700,
          }}
        >
          {negativeLabel}
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            position: 'absolute',
            bottom: axis === 'vertical' ? 8 : 'auto',
            top: axis === 'horizontal' ? '50%' : 'auto',
            right: axis === 'horizontal' ? 10 : 'auto',
            left: axis === 'vertical' ? '50%' : 'auto',
            transform: axis === 'vertical' ? 'translateX(-50%)' : 'translateY(-50%)',
            fontWeight: 700,
          }}
        >
          {positiveLabel}
        </Typography>
        <Box
          sx={{
            width: 58,
            height: 58,
            borderRadius: '50%',
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform:
              axis === 'vertical'
                ? `translate(-50%, calc(-50% + ${offset}px))`
                : `translate(calc(-50% + ${offset}px), -50%)`,
            bgcolor: 'primary.main',
            boxShadow: '0 0 0 8px rgba(24,213,255,.09), 0 10px 30px rgba(0,0,0,.35)',
            transition: direction === 0 ? 'transform .18s ease' : 'none',
          }}
        />
      </Box>
    </Box>
  )
}

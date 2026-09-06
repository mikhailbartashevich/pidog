import {
  CameraAltRounded,
  CloseFullscreenRounded,
  ExpandRounded,
  RefreshRounded,
  VideocamOffRounded,
} from '@mui/icons-material'
import {
  alpha,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material'
import { useEffect, useRef, useState } from 'react'

import { buildCameraStreamUrl, normalizeHost } from '../../lib/api'
import { tr } from '../../lib/i18n'
import type { CockpitProps } from '../../types/ui'

export function CockpitCamera({
  language,
  connected,
  streaming,
  streamNonce,
  settings,
  busyCommand,
  onCommand,
  onRefreshStream,
}: CockpitProps) {
  const cameraRef = useRef<HTMLDivElement | null>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const cameraUrl = buildCameraStreamUrl(settings, streamNonce)
  const host = normalizeHost(settings.host)

  useEffect(() => {
    const onFullscreenChange = () => setFullscreen(document.fullscreenElement !== null)
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [])

  const toggleFullscreen = async () => {
    if (document.fullscreenElement) await document.exitFullscreen()
    else await cameraRef.current?.requestFullscreen()
  }

  return (
    <Card
      ref={cameraRef}
      sx={{
        width: { xs: '100%', md: 'clamp(360px, 32vw, 480px)' },
        maxWidth: '100%',
        alignSelf: 'flex-start',
        overflow: 'hidden',
        bgcolor: '#01050a',
        '&:fullscreen': { width: '100vw', height: '100vh', borderRadius: 0 },
        '&:fullscreen .pidog-camera-viewport': {
          width: '100vw',
          height: '100vh',
          aspectRatio: 'auto',
        },
        '&:fullscreen .pidog-camera-footer': { display: 'none' },
      }}
    >
      <Box
        className="pidog-camera-viewport"
        sx={{
          width: '100%',
          aspectRatio: '1 / 1',
          position: 'relative',
          display: 'grid',
          placeItems: 'center',
          bgcolor: '#01050a',
        }}
      >
        {streaming && connected ? (
          <Box
            component="img"
            key={streamNonce}
            src={cameraUrl}
            alt={tr(language, 'Живой видеопоток камеры Пайдога', 'PiDog live camera stream')}
            sx={{
              display: 'block',
              width: '100%',
              height: '100%',
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              objectPosition: 'center',
            }}
          />
        ) : (
          <Stack sx={{ alignItems: 'center', gap: 1.5, color: 'text.secondary' }}>
            <VideocamOffRounded sx={{ fontSize: 62 }} />
            <Typography>{tr(language, 'Камера выключена', 'Camera is off')}</Typography>
            <Button
              variant="contained"
              startIcon={<CameraAltRounded />}
              disabled={!connected || busyCommand !== null}
              onClick={() => onCommand('camera_on')}
            >
              {tr(language, 'Запустить поток', 'Start stream')}
            </Button>
          </Stack>
        )}
        <Stack
          direction="row"
          sx={{
            position: 'absolute',
            top: 14,
            left: 14,
            right: 14,
            alignItems: 'center',
            justifyContent: 'space-between',
            pointerEvents: 'none',
          }}
        >
          <Chip
            label={streaming ? `LIVE · ${host}` : 'OFFLINE'}
            size="small"
            color={streaming ? 'error' : 'default'}
            sx={{ fontWeight: 800, letterSpacing: '.08em' }}
          />
          <Stack direction="row" sx={{ gap: 0.6, pointerEvents: 'auto' }}>
            <Tooltip title={tr(language, 'Обновить поток', 'Refresh stream')}>
              <span>
                <IconButton
                  size="small"
                  aria-label={tr(language, 'Обновить поток', 'Refresh stream')}
                  disabled={!streaming}
                  onClick={onRefreshStream}
                  sx={{ bgcolor: alpha('#000', 0.55), '&:hover': { bgcolor: alpha('#000', 0.75) } }}
                >
                  <RefreshRounded />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={tr(language, 'На весь экран', 'Fullscreen')}>
              <IconButton
                size="small"
                aria-label={tr(language, 'На весь экран', 'Fullscreen')}
                onClick={() => void toggleFullscreen()}
                sx={{ bgcolor: alpha('#000', 0.55), '&:hover': { bgcolor: alpha('#000', 0.75) } }}
              >
                {fullscreen ? <CloseFullscreenRounded /> : <ExpandRounded />}
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </Box>
      <CardContent className="pidog-camera-footer" sx={{ py: 1.4, px: 2 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between', gap: 1 }}
        >
          <Typography variant="body2" color="text.secondary">
            {tr(
              language,
              'Прямой MJPEG-поток внутри локальной сети',
              'Live MJPEG stream on the local network',
            )}
          </Typography>
          <Stack direction="row" sx={{ gap: 0.8 }}>
            <Button
              size="small"
              startIcon={<CameraAltRounded />}
              disabled={!connected || streaming}
              onClick={() => onCommand('camera_on')}
            >
              {tr(language, 'Включить', 'Start')}
            </Button>
            <Button
              size="small"
              color="error"
              startIcon={<VideocamOffRounded />}
              disabled={!connected || !streaming}
              onClick={() => onCommand('camera_off')}
            >
              {tr(language, 'Выключить', 'Stop')}
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  )
}

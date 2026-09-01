import {
  BatteryChargingFullRounded,
  BoltRounded,
  CameraAltRounded,
  ClearAllRounded,
  CloseFullscreenRounded,
  EmergencyRounded,
  ExpandRounded,
  GraphicEqRounded,
  MoreHorizRounded,
  RefreshRounded,
  SearchRounded,
  SensorsRounded,
  VideocamOffRounded,
} from '@mui/icons-material'
import {
  alpha,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material'
import { useEffect, useRef, useState } from 'react'

import { buildCameraStreamUrl, normalizeHost } from '../../lib/api'
import { findAction } from '../../lib/commands'
import { tr } from '../../lib/i18n'
import { colorCommands } from '../../lib/vision'
import type { CockpitProps } from '../../types/ui'
import { HeadJoystick } from '../HeadJoystick'
import { Joystick } from '../Joystick'
import { CompactMetric } from '../ui/Metrics'

export function CockpitPage({
  language,
  connected,
  sensors,
  streaming,
  streamNonce,
  settings,
  busyCommand,
  visionLog,
  onCommand,
  onMove,
  onHead,
  onStop,
  onRefreshStream,
  onClearLog,
}: CockpitProps) {
  const cameraRef = useRef<HTMLDivElement | null>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const host = normalizeHost(settings.host)
  const cameraUrl = buildCameraStreamUrl(settings, streamNonce)
  const toggleFullscreen = async () => {
    if (document.fullscreenElement) await document.exitFullscreen()
    else await cameraRef.current?.requestFullscreen()
  }

  useEffect(() => {
    const listener = () => setFullscreen(document.fullscreenElement !== null)
    document.addEventListener('fullscreenchange', listener)
    return () => document.removeEventListener('fullscreenchange', listener)
  }, [])

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
                        disabled={!streaming}
                        onClick={onRefreshStream}
                        sx={{
                          bgcolor: alpha('#000', 0.55),
                          '&:hover': { bgcolor: alpha('#000', 0.75) },
                        }}
                      >
                        <RefreshRounded />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title={tr(language, 'На весь экран', 'Fullscreen')}>
                    <IconButton
                      size="small"
                      onClick={() => void toggleFullscreen()}
                      sx={{
                        bgcolor: alpha('#000', 0.55),
                        '&:hover': { bgcolor: alpha('#000', 0.75) },
                      }}
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

          <Stack sx={{ gap: 1.5, minWidth: 0 }}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
                gap: 1.2,
              }}
            >
              <Card>
                <CardContent sx={{ p: 1.6 }}>
                  <Joystick
                    axis="vertical"
                    label={tr(language, 'ХОД', 'DRIVE')}
                    negativeLabel={tr(language, 'Вперёд', 'Forward')}
                    positiveLabel={tr(language, 'Назад', 'Back')}
                    disabled={!connected}
                    onDirectionChange={(direction) => onMove('drive', direction)}
                  />
                </CardContent>
              </Card>
              <Card>
                <CardContent sx={{ p: 1.6 }}>
                  <Joystick
                    axis="horizontal"
                    label={tr(language, 'ПОВОРОТ', 'TURN')}
                    negativeLabel={tr(language, 'Налево', 'Left')}
                    positiveLabel={tr(language, 'Направо', 'Right')}
                    disabled={!connected}
                    onDirectionChange={(direction) => onMove('turn', direction)}
                  />
                </CardContent>
              </Card>
              <Card>
                <CardContent sx={{ p: 1.6 }}>
                  <HeadJoystick
                    label={tr(language, 'ГОЛОВА', 'HEAD')}
                    upLabel={tr(language, 'Вверх', 'Up')}
                    downLabel={tr(language, 'Вниз', 'Down')}
                    leftLabel={tr(language, 'Лево', 'Left')}
                    rightLabel={tr(language, 'Право', 'Right')}
                    disabled={!connected}
                    onPositionChange={onHead}
                  />
                </CardContent>
              </Card>
            </Box>
            <Card>
              <CardContent
                sx={{ p: 1.6, height: '100%', display: 'flex', flexDirection: 'column' }}
              >
                <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 800 }}>
                  {tr(language, 'БЫСТРЫЕ ПОЗЫ', 'QUICK POSES')}
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.8, mt: 1 }}>
                  <Button
                    variant="outlined"
                    disabled={!connected}
                    onClick={() => onCommand('stand')}
                  >
                    {tr(language, 'Встать', 'Stand')}
                  </Button>
                  <Button variant="outlined" disabled={!connected} onClick={() => onCommand('sit')}>
                    {tr(language, 'Сесть', 'Sit')}
                  </Button>
                  <Button
                    variant="outlined"
                    disabled={!connected}
                    onClick={() => onCommand('bark')}
                  >
                    {tr(language, 'Голос', 'Bark')}
                  </Button>
                  <Button
                    variant="outlined"
                    disabled={!connected}
                    onClick={() => onCommand('wag_tail')}
                  >
                    {tr(language, 'Хвост', 'Tail')}
                  </Button>
                </Box>
                <Button
                  color="error"
                  variant="contained"
                  startIcon={<EmergencyRounded />}
                  disabled={!connected}
                  onClick={onStop}
                  sx={{ mt: 1, flex: 1 }}
                >
                  {tr(language, 'АВАРИЙНЫЙ STOP', 'EMERGENCY STOP')}
                </Button>
              </CardContent>
            </Card>
          </Stack>
        </Box>
      </Stack>

      <Stack sx={{ gap: 1.5, minWidth: 0 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
          <CompactMetric
            icon={<BatteryChargingFullRounded />}
            label={tr(language, 'Батарея', 'Battery')}
            value={sensors?.battery_percent == null ? '—' : `${sensors.battery_percent}%`}
            color="#45e6a4"
          />
          <CompactMetric
            icon={<SensorsRounded />}
            label={tr(language, 'Дистанция', 'Distance')}
            value={sensors?.distance_cm == null ? '—' : `${sensors.distance_cm} cm`}
            color="#18d5ff"
          />
          <CompactMetric
            icon={<GraphicEqRounded />}
            label={tr(language, 'Звук', 'Sound')}
            value={
              sensors?.sound_detected
                ? `${sensors.sound_direction ?? 0}°`
                : tr(language, 'Тихо', 'Quiet')
            }
            color="#b58cff"
          />
          <CompactMetric
            icon={<BoltRounded />}
            label={tr(language, 'Питание', 'Power')}
            value={
              sensors?.external_power
                ? tr(language, 'Сеть', 'External')
                : sensors
                  ? tr(language, 'Батарея', 'Battery')
                  : '—'
            }
            color="#ffbe55"
          />
        </Box>

        <Card sx={{ width: '100%', maxWidth: 460, alignSelf: 'flex-start' }}>
          <CardContent sx={{ p: 1.6 }}>
            <Stack
              direction="row"
              sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1.2 }}
            >
              <Box>
                <Typography variant="h3">{tr(language, 'Поиск цвета', 'Color search')}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {tr(language, 'Пайдог наведётся и укажет лапой', 'PiDog aims and points')}
                </Typography>
              </Box>
              <SearchRounded color="action" />
            </Stack>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8 }}>
              {colorCommands.map((command) => {
                const item = findAction(command)
                return (
                  <Tooltip
                    key={command}
                    title={item ? (language === 'en' ? item.englishLabel : item.label) : command}
                  >
                    <span>
                      <Button
                        aria-label={item?.label ?? command}
                        disabled={!connected || busyCommand !== null}
                        onClick={() => onCommand(command)}
                        sx={{
                          width: 44,
                          minWidth: 44,
                          height: 44,
                          p: 0,
                          bgcolor: item ? alpha(item.color, 0.12) : undefined,
                          border: '1px solid',
                          borderColor: item ? alpha(item.color, 0.42) : 'divider',
                          '&:hover': { bgcolor: item ? alpha(item.color, 0.22) : undefined },
                        }}
                      >
                        <Box
                          sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: item?.color }}
                        />
                      </Button>
                    </span>
                  </Tooltip>
                )
              })}
            </Box>
            <Stack direction="row" sx={{ gap: 0.8, mt: 1, flexWrap: 'wrap' }}>
              <Button
                size="small"
                variant="outlined"
                disabled={!connected}
                onClick={() => onCommand('follow_face')}
                sx={{ minWidth: 116 }}
              >
                {tr(language, 'Лицо', 'Face')}
              </Button>
              <Button
                size="small"
                variant="outlined"
                disabled={!connected}
                onClick={() => onCommand('follow_object')}
                sx={{ minWidth: 116 }}
              >
                {tr(language, 'Предмет', 'Object')}
              </Button>
            </Stack>
          </CardContent>
        </Card>

        <Card sx={{ flex: 1, minHeight: 250 }}>
          <CardContent sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography variant="h3">{tr(language, 'Журнал зрения', 'Vision log')}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {tr(language, 'Последние 10 событий', 'Last 10 events')}
                </Typography>
              </Box>
              <Tooltip title={tr(language, 'Очистить', 'Clear')}>
                <span>
                  <IconButton size="small" disabled={visionLog.length === 0} onClick={onClearLog}>
                    <ClearAllRounded />
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
            <Divider sx={{ my: 1.5 }} />
            {visionLog.length === 0 ? (
              <Stack
                sx={{
                  alignItems: 'center',
                  justifyContent: 'center',
                  flex: 1,
                  color: 'text.secondary',
                  py: 3,
                }}
              >
                <MoreHorizRounded />
                <Typography variant="body2">
                  {tr(language, 'Событий пока нет', 'No events yet')}
                </Typography>
              </Stack>
            ) : (
              <Stack sx={{ gap: 1.2, overflow: 'auto', maxHeight: 360 }}>
                {visionLog.map((entry) => (
                  <Box key={entry.id}>
                    <Stack direction="row" sx={{ gap: 1, alignItems: 'flex-start' }}>
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          mt: 0.65,
                          flex: '0 0 auto',
                          borderRadius: '50%',
                          bgcolor: entry.success ? 'success.main' : 'error.main',
                        }}
                      />
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {entry.title}{' '}
                          <Typography component="span" variant="caption" color="text.secondary">
                            · {entry.time}
                          </Typography>
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: 'block', mt: 0.25 }}
                        >
                          {entry.detail}
                        </Typography>
                      </Box>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            )}
          </CardContent>
        </Card>
      </Stack>
    </Box>
  )
}

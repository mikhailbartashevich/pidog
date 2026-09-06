import {
  CameraAltRounded,
  RefreshRounded,
  SlowMotionVideoRounded,
  VideocamOffRounded,
  VisibilityRounded,
} from '@mui/icons-material'
import { Box, Button, Card, Chip, CircularProgress, Stack, Typography } from '@mui/material'

import {
  buildCameraStreamUrl,
  type ConnectionSettings,
  type VisionFace,
  type VisionInferenceResponse,
  type VisionObject,
} from '../../lib/api'
import type { Language } from '../../lib/commands'
import { tr } from '../../lib/i18n'
import { visionBoxKey, visionFaceLabel, visionObjectLabel } from './visionLabels'

type VisionCameraCardProps = {
  language: Language
  connected: boolean
  configured: boolean
  streaming: boolean
  streamNonce: number
  settings: ConnectionSettings
  result: VisionInferenceResponse | null
  selectedFace: VisionFace | null
  selectedObject: VisionObject | null
  refreshing: boolean
  editing: boolean
  livePreview: boolean
  onCommand: (command: string) => void
  onFaceSelect: (face: VisionFace) => void
  onObjectSelect: (object: VisionObject) => void
  onRefresh: () => void
  onLivePreviewToggle: () => void
}

export function VisionCameraCard({
  language,
  connected,
  configured,
  streaming,
  streamNonce,
  settings,
  result,
  selectedFace,
  selectedObject,
  refreshing,
  editing,
  livePreview,
  onCommand,
  onFaceSelect,
  onObjectSelect,
  onRefresh,
  onLivePreviewToggle,
}: VisionCameraCardProps) {
  const analyzedImage = result?.frame_jpeg
    ? `data:image/jpeg;base64,${result.frame_jpeg}`
    : undefined
  const cameraStreamUrl = buildCameraStreamUrl(settings, streamNonce)

  return (
    <>
      <Card sx={{ overflow: 'hidden', bgcolor: '#01050a' }}>
        <Box
          sx={{ position: 'relative', aspectRatio: '4 / 3', display: 'grid', placeItems: 'center' }}
        >
          {streaming && connected ? (
            livePreview ? (
              <Box
                component="img"
                key={streamNonce}
                src={cameraStreamUrl}
                alt={tr(language, 'Быстрый видеопоток камеры PiDog', 'Fast PiDog camera stream')}
                sx={{ width: '100%', height: '100%', objectFit: 'fill' }}
              />
            ) : analyzedImage ? (
              <Box
                component="img"
                src={analyzedImage}
                alt={tr(
                  language,
                  'Последний кадр PiDog с AI-разметкой',
                  'Latest PiDog frame with AI overlay',
                )}
                sx={{ width: '100%', height: '100%', objectFit: 'fill' }}
              />
            ) : (
              <CircularProgress />
            )
          ) : (
            <Stack sx={{ alignItems: 'center', gap: 1.5, color: 'text.secondary' }}>
              <VideocamOffRounded sx={{ fontSize: 62 }} />
              <Typography>{tr(language, 'Камера выключена', 'Camera is off')}</Typography>
              <Button
                variant="contained"
                startIcon={<CameraAltRounded />}
                disabled={!connected}
                onClick={() => onCommand('camera_on')}
              >
                {tr(language, 'Включить камеру', 'Start camera')}
              </Button>
            </Stack>
          )}
          {result?.objects.map((object) => (
            <VisionBoxButton
              key={`object-${visionBoxKey(object)}`}
              label={visionObjectLabel(object, language)}
              box={object}
              active={
                selectedObject !== null && visionBoxKey(selectedObject) === visionBoxKey(object)
              }
              known={Boolean(object.name)}
              color="#18d5ff"
              borderWidth={3}
              zIndex={1}
              onClick={() => onObjectSelect(object)}
            />
          ))}
          {result?.faces.map((face) => (
            <VisionBoxButton
              key={`face-${visionBoxKey(face)}`}
              label={visionFaceLabel(face, language)}
              box={face}
              active={selectedFace !== null && visionBoxKey(selectedFace) === visionBoxKey(face)}
              known={Boolean(face.name)}
              color="#ff73bd"
              borderWidth={4}
              zIndex={2}
              onClick={() => onFaceSelect(face)}
            />
          ))}
          <Stack
            direction="row"
            sx={{
              position: 'absolute',
              zIndex: 4,
              top: 12,
              left: 12,
              right: 12,
              justifyContent: 'space-between',
              pointerEvents: 'none',
            }}
          >
            <Chip
              icon={<VisibilityRounded />}
              label={
                livePreview
                  ? 'CAMERA · LIVE'
                  : refreshing
                    ? 'AI · …'
                    : editing
                      ? 'AI · PAUSED'
                      : configured
                        ? 'AI · LIVE'
                        : 'AI · OFF'
              }
              size="small"
              color={configured ? 'success' : 'default'}
            />
            <Stack direction="row" sx={{ gap: 0.7, pointerEvents: 'auto' }}>
              <Button
                size="small"
                variant={livePreview ? 'contained' : 'outlined'}
                startIcon={<SlowMotionVideoRounded />}
                disabled={!streaming}
                onClick={onLivePreviewToggle}
              >
                {livePreview
                  ? tr(language, 'AI-кадр', 'AI frame')
                  : tr(language, 'Быстрый поток', 'Fast stream')}
              </Button>
              {!livePreview && (
                <Button
                  size="small"
                  variant="contained"
                  startIcon={refreshing ? <CircularProgress size={14} /> : <RefreshRounded />}
                  disabled={!configured || refreshing || editing}
                  onClick={onRefresh}
                >
                  {tr(language, 'Новый кадр', 'New frame')}
                </Button>
              )}
            </Stack>
          </Stack>
        </Box>
      </Card>
      <Typography variant="caption" color="text.secondary" sx={{ px: 0.5 }}>
        {tr(
          language,
          livePreview
            ? 'Прямой MJPEG-поток с последними рамками AI. Рамки обновляются примерно раз в секунду и могут немного отставать от видео.'
            : 'Это точный кадр, который AI Pi распознал; поэтому рамки можно надёжно нажимать. Он обновляется примерно раз в секунду.',
          livePreview
            ? 'Direct MJPEG camera stream with the latest AI boxes. Boxes refresh about once a second and may lag the video slightly.'
            : 'This is the exact frame analyzed by the AI Pi, so its boxes are reliable tap targets. It refreshes about once a second.',
        )}
      </Typography>
    </>
  )
}

type VisionBoxButtonProps = {
  label: string
  box: { x: number; y: number; w: number; h: number }
  active: boolean
  known: boolean
  color: string
  borderWidth: number
  zIndex: number
  onClick: () => void
}

function VisionBoxButton({
  label,
  box,
  active,
  known,
  color,
  borderWidth,
  zIndex,
  onClick,
}: VisionBoxButtonProps) {
  const boxColor = active ? '#ffbe55' : known ? '#45e6a4' : color
  return (
    <Box
      component="button"
      type="button"
      aria-label={label}
      onClick={onClick}
      sx={{
        position: 'absolute',
        zIndex,
        left: `${box.x * 100}%`,
        top: `${box.y * 100}%`,
        width: `${box.w * 100}%`,
        height: `${box.h * 100}%`,
        border: `${borderWidth}px solid ${boxColor}`,
        cursor: 'pointer',
        boxSizing: 'border-box',
        background: 'transparent',
        padding: 0,
        boxShadow: active ? '0 0 0 3px rgba(255,190,85,.35)' : 'none',
      }}
    >
      <Typography
        component="span"
        sx={{
          position: 'absolute',
          top: borderWidth === 3 ? -28 : -29,
          left: -borderWidth,
          px: 0.7,
          py: 0.2,
          bgcolor: boxColor,
          color: '#091018',
          fontSize: 12,
          fontWeight: 900,
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </Typography>
    </Box>
  )
}

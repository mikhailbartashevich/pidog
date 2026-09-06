import {
  CameraAltRounded,
  FaceRounded,
  PersonAddAlt1Rounded,
  RefreshRounded,
  VideocamOffRounded,
  VisibilityRounded,
} from '@mui/icons-material'
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useCallback, useEffect, useRef, useState } from 'react'

import {
  pidogApi,
  type PiDogApiError,
  type VisionFace,
  type VisionInferenceResponse,
  type VisionObject,
} from '../../lib/api'
import { tr } from '../../lib/i18n'
import type { AiVisionPageProps } from '../../types/ui'
import { PageHeading } from '../ui/PageHeading'
import {
  mergeVisionDetections,
  VisionDetectionList,
  type VisionDetection,
} from '../vision/VisionDetectionList'
import { VisionMemoryControls } from '../vision/VisionMemoryControls'

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'AI vision request failed'
}

function faceLabel(face: VisionFace, language: 'ru' | 'en') {
  const names = face.names?.length ? face.names : face.name ? [face.name] : []
  return names.length ? names.join(' / ') : language === 'ru' ? 'Неизвестное лицо' : 'Unknown face'
}

function objectLabel(object: VisionObject, language: 'ru' | 'en') {
  if (object.name) return object.name
  if (object.label) return `${object.label} · ${Math.round((object.score ?? 0) * 100)}%`
  return language === 'ru' ? 'Предмет' : 'Object'
}

function keyFor(box: { x: number; y: number; w: number; h: number }) {
  return `${box.x}-${box.y}-${box.w}-${box.h}`
}

export function AiVisionPage({
  language,
  connected,
  configured,
  streaming,
  settings,
  onCommand,
  onEnroll,
  onEnrollObject,
  onHead,
}: AiVisionPageProps) {
  const [result, setResult] = useState<VisionInferenceResponse | null>(null)
  const [detections, setDetections] = useState<VisionDetection[]>([])
  const [selectedFace, setSelectedFace] = useState<VisionFace | null>(null)
  const [selectedObject, setSelectedObject] = useState<VisionObject | null>(null)
  const [names, setNames] = useState<string[]>([])
  const [objectName, setObjectName] = useState('')
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [saving, setSaving] = useState<'face' | 'object' | null>(null)
  const running = useRef(false)
  const editing =
    selectedFace !== null || selectedObject !== null || names.length > 0 || objectName !== ''

  const analyze = useCallback(async () => {
    if (!connected || !configured || !streaming || running.current) return
    running.current = true
    try {
      const next = await pidogApi.visionInfer(settings)
      setResult(next)
      setDetections((current) => mergeVisionDetections(current, next))
      setError('')
    } catch (cause) {
      const status = cause as PiDogApiError
      setError(status.message || errorText(cause))
    } finally {
      running.current = false
    }
  }, [configured, connected, settings, streaming])

  const refresh = async () => {
    setRefreshing(true)
    try {
      await analyze()
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (editing) return undefined
    const initial = window.setTimeout(() => void analyze(), 0)
    const timer = window.setInterval(() => void analyze(), 1_500)
    return () => {
      window.clearTimeout(initial)
      window.clearInterval(timer)
    }
  }, [analyze, editing])

  const rememberFace = async () => {
    const cleanNames = [...new Set(names.map((name) => name.trim()).filter(Boolean))]
    if (!selectedFace || cleanNames.length === 0) return
    setSaving('face')
    try {
      const storedNames = await onEnroll(cleanNames, selectedFace)
      setNames([])
      setSelectedFace(null)
      setError('')
      void refresh()
      setResult(
        (current) =>
          current && {
            ...current,
            faces: current.faces.map((face) =>
              keyFor(face) === keyFor(selectedFace)
                ? { ...face, name: storedNames[0] ?? null, names: storedNames }
                : face,
            ),
          },
      )
    } catch (cause) {
      setError(errorText(cause))
    } finally {
      setSaving(null)
    }
  }

  const rememberObject = async () => {
    if (!selectedObject || !objectName.trim()) return
    setSaving('object')
    try {
      const storedName = await onEnrollObject(objectName.trim(), selectedObject)
      setObjectName('')
      setSelectedObject(null)
      setError('')
      setResult(
        (current) =>
          current && {
            ...current,
            objects: current.objects.map((object) =>
              keyFor(object) === keyFor(selectedObject) ? { ...object, name: storedName } : object,
            ),
          },
      )
    } catch (cause) {
      setError(errorText(cause))
    } finally {
      setSaving(null)
    }
  }

  const analyzedImage = result?.frame_jpeg
    ? `data:image/jpeg;base64,${result.frame_jpeg}`
    : undefined

  return (
    <Stack sx={{ gap: 2 }}>
      <PageHeading
        language={language}
        eyebrow={tr(
          language,
          'PI 5 + AI HAT+ 2 · ОБНОВЛЕНИЕ ~0.9 С',
          'PI 5 + AI HAT+ 2 · UPDATES ~0.9 S',
        )}
        titleRu="AI-зрение и память"
        titleEn="AI vision & memory"
        descriptionRu="Нажмите рамку или находку под видео, затем сохраните имя. Список находок не меняет расположение контролов."
        descriptionEn="Tap a box or an item below the video, then save a name. The detection list does not move the controls."
      />
      {!configured && (
        <Alert severity="warning">
          {tr(
            language,
            'AI Pi ещё не подключён к Пайдогу.',
            'The AI Pi is not connected to PiDog yet.',
          )}
        </Alert>
      )}
      {error && (
        <Alert severity="error" onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(320px, 370px) minmax(0, 1fr)' },
          gap: { xs: 1.5, lg: 2 },
          alignItems: 'start',
        }}
      >
        <Stack
          sx={{
            gap: 1.2,
            minWidth: 0,
            order: { xs: 2, lg: 2 },
            position: { lg: 'sticky' },
            top: { lg: 82 },
          }}
        >
          <Card sx={{ overflow: 'hidden', bgcolor: '#01050a' }}>
            <Box
              sx={{
                position: 'relative',
                aspectRatio: '4 / 3',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              {streaming && connected ? (
                analyzedImage ? (
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
              {result?.objects.map((object) => {
                const active = selectedObject !== null && keyFor(selectedObject) === keyFor(object)
                return (
                  <Box
                    component="button"
                    type="button"
                    key={`object-${keyFor(object)}`}
                    aria-label={objectLabel(object, language)}
                    onClick={() => {
                      setSelectedObject(object)
                      setSelectedFace(null)
                    }}
                    sx={{
                      position: 'absolute',
                      zIndex: 1,
                      left: `${object.x * 100}%`,
                      top: `${object.y * 100}%`,
                      width: `${object.w * 100}%`,
                      height: `${object.h * 100}%`,
                      border: `3px solid ${active ? '#ffbe55' : object.name ? '#45e6a4' : '#18d5ff'}`,
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
                        top: -28,
                        left: -3,
                        px: 0.7,
                        py: 0.2,
                        bgcolor: active ? '#ffbe55' : object.name ? '#45e6a4' : '#18d5ff',
                        color: '#091018',
                        fontSize: 12,
                        fontWeight: 900,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {objectLabel(object, language)}
                    </Typography>
                  </Box>
                )
              })}
              {result?.faces.map((face) => {
                const active = selectedFace !== null && keyFor(selectedFace) === keyFor(face)
                return (
                  <Box
                    component="button"
                    type="button"
                    key={`face-${keyFor(face)}`}
                    aria-label={faceLabel(face, language)}
                    onClick={() => {
                      setSelectedFace(face)
                      setSelectedObject(null)
                    }}
                    sx={{
                      position: 'absolute',
                      zIndex: 2,
                      left: `${face.x * 100}%`,
                      top: `${face.y * 100}%`,
                      width: `${face.w * 100}%`,
                      height: `${face.h * 100}%`,
                      border: `4px solid ${active ? '#ffbe55' : face.name ? '#45e6a4' : '#ff73bd'}`,
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
                        top: -29,
                        left: -4,
                        px: 0.7,
                        py: 0.2,
                        bgcolor: active ? '#ffbe55' : face.name ? '#45e6a4' : '#ff73bd',
                        color: '#091018',
                        fontSize: 12,
                        fontWeight: 900,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {faceLabel(face, language)}
                    </Typography>
                  </Box>
                )
              })}
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
                    refreshing
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
                <Button
                  size="small"
                  variant="contained"
                  startIcon={refreshing ? <CircularProgress size={14} /> : <RefreshRounded />}
                  disabled={!streaming || !configured || refreshing || editing}
                  onClick={() => void refresh()}
                  sx={{ pointerEvents: 'auto' }}
                >
                  {tr(language, 'Новый кадр', 'New frame')}
                </Button>
              </Stack>
            </Box>
          </Card>
          <Typography variant="caption" color="text.secondary" sx={{ px: 0.5 }}>
            {tr(
              language,
              'Это точный кадр, который AI Pi распознал; поэтому рамки можно надёжно нажимать. Он обновляется примерно раз в секунду.',
              'This is the exact frame analyzed by the AI Pi, so its boxes are reliable tap targets. It refreshes about once a second.',
            )}
          </Typography>
          <VisionDetectionList
            language={language}
            items={detections}
            selectedFace={selectedFace}
            selectedObject={selectedObject}
            onFace={(face) => {
              setSelectedFace(face)
              setSelectedObject(null)
            }}
            onObject={(object) => {
              setSelectedObject(object)
              setSelectedFace(null)
            }}
          />
        </Stack>
        <Stack sx={{ gap: 1.2, order: { xs: 1, lg: 1 } }}>
          <Card>
            <CardContent sx={{ p: { xs: 1.6, sm: 2 } }}>
              <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
                <FaceRounded color="primary" />
                <Typography variant="h3">
                  {tr(language, 'Запомнить человека', 'Remember person')}
                </Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.7 }}>
                {tr(
                  language,
                  'Добавляйте столько имён и языковых вариантов, сколько нужно.',
                  'Add as many names and language variants as you need.',
                )}
              </Typography>
              <Autocomplete
                multiple
                freeSolo
                options={[]}
                value={names}
                onChange={(_event, next) =>
                  setNames(next.map((name) => name.trim()).filter(Boolean))
                }
                disabled={!selectedFace || saving !== null}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    size="small"
                    label={tr(language, 'Имёна и варианты', 'Names and variants')}
                    placeholder={tr(
                      language,
                      'Enter после каждого имени',
                      'Press Enter after each name',
                    )}
                  />
                )}
                sx={{ mt: 1.3 }}
              />
              <Button
                fullWidth
                variant="contained"
                startIcon={
                  saving === 'face' ? <CircularProgress size={16} /> : <PersonAddAlt1Rounded />
                }
                disabled={!selectedFace || names.length === 0 || saving !== null}
                onClick={() => void rememberFace()}
                sx={{ mt: 1.1 }}
              >
                {tr(language, 'Запомнить лицо и имена', 'Remember face and names')}
              </Button>
            </CardContent>
          </Card>
          <VisionMemoryControls
            language={language}
            connected={connected}
            selectedObject={selectedObject}
            objectName={objectName}
            saving={saving}
            onObjectName={setObjectName}
            onRememberObject={() => void rememberObject()}
            onHead={onHead}
          />
        </Stack>
      </Box>
    </Stack>
  )
}

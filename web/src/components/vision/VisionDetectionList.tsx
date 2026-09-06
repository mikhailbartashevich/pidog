import { FaceRounded, SellRounded } from '@mui/icons-material'
import { Button, Card, CardContent, Stack, Typography } from '@mui/material'

import type { VisionFace, VisionInferenceResponse, VisionObject } from '../../lib/api'
import type { Language } from '../../lib/commands'
import { tr } from '../../lib/i18n'

export type VisionDetection =
  | { id: string; kind: 'face'; value: VisionFace }
  | { id: string; kind: 'object'; value: VisionObject }

function faceLabel(face: VisionFace, language: Language) {
  const names = face.names?.length ? face.names : face.name ? [face.name] : []
  return names.length ? names.join(' / ') : tr(language, 'Неизвестное лицо', 'Unknown face')
}

function objectLabel(object: VisionObject, language: Language) {
  if (object.name) return object.name
  if (object.label) return `${object.label} · ${Math.round((object.score ?? 0) * 100)}%`
  return tr(language, 'Предмет', 'Object')
}

function faceId(face: VisionFace, index: number) {
  return face.name ?? face.names?.join('/') ?? String(index)
}

export function mergeVisionDetections(current: VisionDetection[], result: VisionInferenceResponse) {
  const incoming: VisionDetection[] = [
    ...result.faces.map((value, index) => ({
      id: `face:${faceId(value, index)}`,
      kind: 'face' as const,
      value,
    })),
    ...result.objects.map((value) => ({
      id: `object:${value.name ?? value.label}`,
      kind: 'object' as const,
      value,
    })),
  ]
  return incoming.reduce<VisionDetection[]>((history, next) => {
    const index = history.findIndex((item) => item.id === next.id)
    if (index === -1) return [...history, next].slice(-12)
    return history.map((item, itemIndex) => (itemIndex === index ? next : item))
  }, current)
}

type VisionDetectionListProps = {
  language: Language
  items: VisionDetection[]
  selectedFace: VisionFace | null
  selectedObject: VisionObject | null
  onFace: (face: VisionFace) => void
  onObject: (object: VisionObject) => void
}

export function VisionDetectionList({
  language,
  items,
  selectedFace,
  selectedObject,
  onFace,
  onObject,
}: VisionDetectionListProps) {
  return (
    <Card>
      <CardContent sx={{ p: { xs: 1.6, sm: 2 } }}>
        <Typography variant="h3">{tr(language, 'Найдено недавно', 'Recently detected')}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.6 }}>
          {tr(
            language,
            'Список пополняется, но уже найденные пункты остаются на месте.',
            'The list grows while existing items stay in place.',
          )}
        </Typography>
        <Stack sx={{ mt: 1.3, gap: 0.8 }}>
          {items.map((item) =>
            item.kind === 'face' ? (
              <Button
                key={item.id}
                variant={selectedFace === item.value ? 'contained' : 'outlined'}
                startIcon={<FaceRounded />}
                onClick={() => onFace(item.value)}
                sx={{ justifyContent: 'flex-start', textAlign: 'left' }}
              >{`${tr(language, 'Лицо', 'Face')}: ${faceLabel(item.value, language)}`}</Button>
            ) : (
              <Button
                key={item.id}
                variant={selectedObject === item.value ? 'contained' : 'outlined'}
                startIcon={<SellRounded />}
                onClick={() => onObject(item.value)}
                sx={{ justifyContent: 'flex-start', textAlign: 'left' }}
              >{`${tr(language, 'Предмет', 'Object')}: ${objectLabel(item.value, language)}`}</Button>
            ),
          )}
          {items.length === 0 && (
            <Typography color="text.secondary">
              {tr(language, 'Ожидаю первый кадр…', 'Waiting for the first frame…')}
            </Typography>
          )}
        </Stack>
      </CardContent>
    </Card>
  )
}

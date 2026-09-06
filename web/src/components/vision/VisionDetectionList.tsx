import { FaceRounded, SellRounded } from '@mui/icons-material'
import { Button, Card, CardContent, Stack, Typography } from '@mui/material'

import type { VisionFace, VisionObject } from '../../lib/api'
import type { Language } from '../../lib/commands'
import { tr } from '../../lib/i18n'
import type { VisionDetection } from './visionDetections'
import { visionFaceLabel, visionObjectLabel } from './visionLabels'

export type { VisionDetection } from './visionDetections'

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
              >{`${tr(language, 'Лицо', 'Face')}: ${visionFaceLabel(item.value, language)}`}</Button>
            ) : (
              <Button
                key={item.id}
                variant={selectedObject === item.value ? 'contained' : 'outlined'}
                startIcon={<SellRounded />}
                onClick={() => onObject(item.value)}
                sx={{ justifyContent: 'flex-start', textAlign: 'left' }}
              >{`${tr(language, 'Предмет', 'Object')}: ${visionObjectLabel(item.value, language)}`}</Button>
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

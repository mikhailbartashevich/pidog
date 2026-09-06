import { SellRounded } from '@mui/icons-material'
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material'

import type { VisionObject } from '../../lib/api'
import type { Language } from '../../lib/commands'
import { tr } from '../../lib/i18n'
import { HeadJoystick } from '../HeadJoystick'

type VisionMemoryControlsProps = {
  language: Language
  connected: boolean
  selectedObject: VisionObject | null
  objectName: string
  saving: 'face' | 'object' | null
  onObjectName: (value: string) => void
  onRememberObject: () => void
  onHead: (x: number, y: number) => void
}

export function VisionMemoryControls({
  language,
  connected,
  selectedObject,
  objectName,
  saving,
  onObjectName,
  onRememberObject,
  onHead,
}: VisionMemoryControlsProps) {
  return (
    <>
      <Card>
        <CardContent sx={{ p: { xs: 1.6, sm: 2 } }}>
          <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
            <SellRounded color="primary" />
            <Typography variant="h3">
              {tr(language, 'Подписать предмет', 'Name an object')}
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.7 }}>
            {tr(
              language,
              'Выберите голубую рамку и сохраните своё название. AI будет искать этот внешний вид среди будущих находок.',
              'Select a blue box and save your own name. AI will look for that appearance among future detections.',
            )}
          </Typography>
          <TextField
            fullWidth
            size="small"
            label={tr(language, 'Название предмета', 'Object name')}
            value={objectName}
            onChange={(event) => onObjectName(event.target.value)}
            disabled={!selectedObject || saving !== null}
            slotProps={{ htmlInput: { maxLength: 48 } }}
            sx={{ mt: 1.3 }}
          />
          <Button
            fullWidth
            variant="outlined"
            startIcon={saving === 'object' ? <CircularProgress size={16} /> : <SellRounded />}
            disabled={!selectedObject || !objectName.trim() || saving !== null}
            onClick={onRememberObject}
            sx={{ mt: 1.1 }}
          >
            {tr(language, 'Запомнить предмет', 'Remember object')}
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardContent sx={{ p: { xs: 1.6, sm: 2 } }}>
          <Typography variant="h3">
            {tr(language, 'Повернуть камеру / голову', 'Aim camera / head')}
          </Typography>
          <Box sx={{ mt: 1.2, maxWidth: 310, mx: 'auto' }}>
            <HeadJoystick
              label={tr(language, 'КАМЕРА', 'CAMERA')}
              upLabel={tr(language, 'Вверх', 'Up')}
              downLabel={tr(language, 'Вниз', 'Down')}
              leftLabel={tr(language, 'Лево', 'Left')}
              rightLabel={tr(language, 'Право', 'Right')}
              disabled={!connected}
              onPositionChange={onHead}
            />
          </Box>
        </CardContent>
      </Card>
    </>
  )
}

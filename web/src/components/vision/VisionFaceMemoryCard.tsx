import { FaceRounded, PersonAddAlt1Rounded } from '@mui/icons-material'
import {
  Autocomplete,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material'

import type { VisionFace } from '../../lib/api'
import type { Language } from '../../lib/commands'
import { tr } from '../../lib/i18n'

type VisionFaceMemoryCardProps = {
  language: Language
  selectedFace: VisionFace | null
  names: string[]
  nameInput: string
  saving: 'face' | 'object' | null
  onNamesChange: (names: string[]) => void
  onNameInputChange: (value: string) => void
  onRemember: () => void
}

export function VisionFaceMemoryCard({
  language,
  selectedFace,
  names,
  nameInput,
  saving,
  onNamesChange,
  onNameInputChange,
  onRemember,
}: VisionFaceMemoryCardProps) {
  return (
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
          inputValue={nameInput}
          onChange={(_event, next) =>
            onNamesChange(next.map((name) => name.trim()).filter(Boolean))
          }
          onInputChange={(_event, next) => onNameInputChange(next)}
          disabled={!selectedFace || saving !== null}
          renderInput={(params) => (
            <TextField
              {...params}
              size="small"
              label={tr(language, 'Имёна и варианты', 'Names and variants')}
              placeholder={tr(
                language,
                'Можно сохранить и без Enter',
                'You can save without pressing Enter',
              )}
            />
          )}
          sx={{ mt: 1.3 }}
        />
        <Button
          fullWidth
          variant="contained"
          startIcon={saving === 'face' ? <CircularProgress size={16} /> : <PersonAddAlt1Rounded />}
          disabled={!selectedFace || (!names.length && !nameInput.trim()) || saving !== null}
          onClick={onRemember}
          sx={{ mt: 1.1 }}
        >
          {tr(language, 'Запомнить лицо и имена', 'Remember face and names')}
        </Button>
      </CardContent>
    </Card>
  )
}

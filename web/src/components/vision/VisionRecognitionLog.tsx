import { ExpandMoreRounded, FaceRounded, SellRounded, StraightenRounded } from '@mui/icons-material'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Card,
  CardContent,
  Chip,
  Stack,
  Typography,
} from '@mui/material'

import type { VisionRecognitionLogEntry } from '../../hooks/useAiVision'
import type { Language } from '../../lib/commands'
import { tr } from '../../lib/i18n'

type VisionRecognitionLogProps = {
  language: Language
  entries: VisionRecognitionLogEntry[]
}

export function VisionRecognitionLog({ language, entries }: VisionRecognitionLogProps) {
  const current = entries.filter((entry) => entry.present)
  const history = entries.filter((entry) => !entry.present)
  return (
    <Card>
      <CardContent sx={{ p: { xs: 1.6, sm: 2 } }}>
        <Typography variant="h3">
          {tr(language, 'Журнал распознавания', 'Recognition log')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {tr(
            language,
            'Кого Пайдог увидел и расстояние по ультразвуковому датчику.',
            'Who PiDog saw and the ultrasonic distance at that moment.',
          )}
        </Typography>
        <Typography variant="subtitle2" sx={{ mt: 1.2, fontWeight: 800 }}>
          {tr(language, 'Сейчас видно', 'Visible now')}
        </Typography>
        <RecognitionRows
          language={language}
          entries={current}
          emptyText={tr(language, 'Пока никого не видно', 'Nothing visible yet')}
        />
        <Accordion disableGutters elevation={0} sx={{ mt: 0.8, bgcolor: 'transparent' }}>
          <AccordionSummary expandIcon={<ExpandMoreRounded />} sx={{ px: 0, minHeight: 38 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
              {tr(
                language,
                `Ранее распознано: ${history.length}`,
                `Recognized earlier: ${history.length}`,
              )}
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ px: 0, pt: 0 }}>
            <RecognitionRows
              language={language}
              entries={history}
              emptyText={tr(language, 'История пока пуста', 'No earlier recognitions')}
            />
          </AccordionDetails>
        </Accordion>
      </CardContent>
    </Card>
  )
}

function RecognitionRows({
  language,
  entries,
  emptyText,
}: {
  language: Language
  entries: VisionRecognitionLogEntry[]
  emptyText: string
}) {
  return (
    <Stack sx={{ mt: 0.7, gap: 0.7 }}>
      {entries.map((entry) => (
        <Stack key={entry.id} direction="row" sx={{ alignItems: 'center', gap: 0.8 }}>
          <Chip
            icon={entry.kind === 'face' ? <FaceRounded /> : <SellRounded />}
            label={entry.name}
            size="small"
            color={entry.kind === 'face' ? 'secondary' : 'primary'}
          />
          <Chip
            icon={<StraightenRounded />}
            label={
              entry.distanceCm == null
                ? tr(language, 'нет данных', 'no reading')
                : `${entry.distanceCm.toFixed(1)} см`
            }
            size="small"
            variant="outlined"
          />
          <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
            {new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'ru-RU', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            }).format(entry.seenAt)}
          </Typography>
        </Stack>
      ))}
      {entries.length === 0 && <Typography color="text.secondary">{emptyText}</Typography>}
    </Stack>
  )
}

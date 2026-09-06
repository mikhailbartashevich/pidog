import { EmergencyRounded } from '@mui/icons-material'
import { Box, Button, Card, CardContent, Stack, Typography } from '@mui/material'

import { tr } from '../../lib/i18n'
import type { CockpitProps } from '../../types/ui'
import { HeadJoystick } from '../HeadJoystick'
import { Joystick } from '../Joystick'

export function CockpitControls({
  language,
  connected,
  onCommand,
  onMove,
  onHead,
  onStop,
}: CockpitProps) {
  return (
    <Stack sx={{ gap: 1.5, minWidth: 0 }}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
          gap: 1.2,
        }}
      >
        <Card>
          <CardContent sx={{ p: 1.6 }}>
            <Joystick
              label={tr(language, 'ХОД / ПОВОРОТ', 'MOVE / TURN')}
              forwardLabel={tr(language, 'Вперёд', 'Forward')}
              backwardLabel={tr(language, 'Назад', 'Back')}
              leftLabel={tr(language, 'Лево', 'Left')}
              rightLabel={tr(language, 'Право', 'Right')}
              disabled={!connected}
              onMovementChange={onMove}
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
        <CardContent sx={{ p: 1.6, height: '100%', display: 'flex', flexDirection: 'column' }}>
          <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 800 }}>
            {tr(language, 'БЫСТРЫЕ ПОЗЫ', 'QUICK POSES')}
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.8, mt: 1 }}>
            {[
              { command: 'stand', ru: 'Встать', en: 'Stand' },
              { command: 'sit', ru: 'Сесть', en: 'Sit' },
              { command: 'bark', ru: 'Голос', en: 'Bark' },
              { command: 'wag_tail', ru: 'Хвост', en: 'Tail' },
            ].map(({ command, ru, en }) => (
              <Button
                key={command}
                variant="outlined"
                disabled={!connected}
                onClick={() => onCommand(command)}
              >
                {tr(language, ru, en)}
              </Button>
            ))}
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
  )
}

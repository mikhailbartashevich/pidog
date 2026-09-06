import {
  BatteryChargingFullRounded,
  BoltRounded,
  ClearAllRounded,
  GraphicEqRounded,
  MoreHorizRounded,
  SearchRounded,
  SensorsRounded,
} from '@mui/icons-material'
import {
  alpha,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material'

import { findAction } from '../../lib/commands'
import { tr } from '../../lib/i18n'
import { colorCommands } from '../../lib/vision'
import type { CockpitProps } from '../../types/ui'
import { CompactMetric } from '../ui/Metrics'

export function CockpitInsights({
  language,
  connected,
  sensors,
  busyCommand,
  visionLog,
  onCommand,
  onClearLog,
}: CockpitProps) {
  const metrics = [
    {
      icon: <BatteryChargingFullRounded />,
      label: tr(language, 'Батарея', 'Battery'),
      value: sensors?.battery_percent == null ? '—' : `${sensors.battery_percent}%`,
      color: '#45e6a4',
    },
    {
      icon: <SensorsRounded />,
      label: tr(language, 'Дистанция', 'Distance'),
      value: sensors?.distance_cm == null ? '—' : `${sensors.distance_cm} cm`,
      color: '#18d5ff',
    },
    {
      icon: <GraphicEqRounded />,
      label: tr(language, 'Звук', 'Sound'),
      value: sensors?.sound_detected
        ? `${sensors.sound_direction ?? 0}°`
        : tr(language, 'Тихо', 'Quiet'),
      color: '#b58cff',
    },
    {
      icon: <BoltRounded />,
      label: tr(language, 'Питание', 'Power'),
      value: sensors?.external_power
        ? tr(language, 'Сеть', 'External')
        : sensors
          ? tr(language, 'Батарея', 'Battery')
          : '—',
      color: '#ffbe55',
    },
  ]
  return (
    <Stack sx={{ gap: 1.5, minWidth: 0 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
        {metrics.map(({ icon, label, value, color }) => (
          <CompactMetric key={label} icon={icon} label={label} value={value} color={color} />
        ))}
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
            {[
              { command: 'follow_face', ru: 'Лицо', en: 'Face', variant: 'outlined' as const },
              {
                command: 'follow_object',
                ru: 'Предмет',
                en: 'Object',
                variant: 'outlined' as const,
              },
              {
                command: 'follow_ai_target',
                ru: 'AI: человек',
                en: 'AI: person',
                variant: 'contained' as const,
              },
              {
                command: 'stop_ai_target',
                ru: 'Стоп AI',
                en: 'Stop AI',
                variant: 'outlined' as const,
              },
            ].map(({ command, ru, en, variant }) => (
              <Button
                key={command}
                size="small"
                color={command === 'stop_ai_target' ? 'error' : 'primary'}
                variant={variant}
                disabled={!connected || (command === 'follow_ai_target' && busyCommand !== null)}
                onClick={() => onCommand(command)}
                sx={{ minWidth: 116 }}
              >
                {tr(language, ru, en)}
              </Button>
            ))}
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
                <IconButton
                  size="small"
                  aria-label={tr(language, 'Очистить журнал зрения', 'Clear vision log')}
                  disabled={visionLog.length === 0}
                  onClick={onClearLog}
                >
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
                <Stack key={entry.id} direction="row" sx={{ gap: 1, alignItems: 'flex-start' }}>
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
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>
    </Stack>
  )
}

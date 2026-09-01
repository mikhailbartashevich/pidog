import {
  BatteryChargingFullRounded,
  BoltRounded,
  GraphicEqRounded,
  LightbulbRounded,
  PetsRounded,
  RefreshRounded,
  SensorsRounded,
} from '@mui/icons-material'
import {
  alpha,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material'

import { actionGroups } from '../../lib/commands'
import { tr } from '../../lib/i18n'
import type { SensorsPageProps } from '../../types/ui'
import { SensorMetric } from '../ui/Metrics'
import { PageHeading } from '../ui/PageHeading'

export function SensorsPage({
  language,
  sensors,
  history,
  connected,
  onRefresh,
  onCommand,
}: SensorsPageProps) {
  const maxHistory = Math.max(60, ...history)
  return (
    <Stack sx={{ gap: 2 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        sx={{ justifyContent: 'space-between', alignItems: { sm: 'flex-end' }, gap: 1 }}
      >
        <PageHeading
          language={language}
          eyebrow={tr(language, 'ОБНОВЛЕНИЕ КАЖДЫЕ 12 СЕКУНД', 'REFRESHES EVERY 12 SECONDS')}
          titleRu="Сенсоры и свет"
          titleEn="Sensors & lights"
          descriptionRu="Живые показатели питания, расстояния, звука, касания и положения корпуса."
          descriptionEn="Live power, distance, sound, touch, and motion telemetry."
        />
        <Button
          variant="outlined"
          startIcon={<RefreshRounded />}
          disabled={!connected}
          onClick={onRefresh}
        >
          {tr(language, 'Обновить', 'Refresh')}
        </Button>
      </Stack>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2,1fr)', lg: 'repeat(4,1fr)' },
          gap: 1.2,
        }}
      >
        <SensorMetric
          icon={<BatteryChargingFullRounded />}
          title={tr(language, 'Батарея', 'Battery')}
          value={sensors?.battery_percent == null ? '—' : `${sensors.battery_percent}%`}
          detail={
            sensors?.battery_voltage == null
              ? tr(language, 'Нет данных', 'No data')
              : `${sensors.battery_voltage.toFixed(2)} V`
          }
          color="#45e6a4"
          progress={sensors?.battery_percent ?? undefined}
        />
        <SensorMetric
          icon={<SensorsRounded />}
          title={tr(language, 'Дистанция', 'Distance')}
          value={sensors?.distance_cm == null ? '—' : `${sensors.distance_cm} cm`}
          detail={tr(language, 'Ультразвук', 'Ultrasonic')}
          color="#18d5ff"
        />
        <SensorMetric
          icon={<GraphicEqRounded />}
          title={tr(language, 'Звук', 'Sound')}
          value={
            sensors?.sound_detected
              ? `${sensors.sound_direction ?? 0}°`
              : tr(language, 'Не найден', 'Not found')
          }
          detail={tr(language, 'Направление', 'Direction')}
          color="#b58cff"
        />
        <SensorMetric
          icon={<PetsRounded />}
          title={tr(language, 'Касание', 'Touch')}
          value={sensors?.touch ?? '—'}
          detail={tr(language, 'Датчик головы', 'Head sensor')}
          color="#ff73bd"
        />
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1.2fr .8fr' }, gap: 2 }}>
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography variant="h3">
                  {tr(language, 'Дистанция · история', 'Distance · history')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {tr(language, 'Последние 18 измерений', 'Last 18 readings')}
                </Typography>
              </Box>
              <Typography sx={{ fontSize: '1.6rem', fontWeight: 800 }}>
                {sensors?.distance_cm == null ? '—' : `${sensors.distance_cm} cm`}
              </Typography>
            </Stack>
            <Box
              sx={{
                height: 210,
                mt: 3,
                display: 'flex',
                gap: 0.6,
                alignItems: 'flex-end',
                borderBottom: '1px solid',
                borderColor: 'divider',
                px: 1,
              }}
            >
              {history.length === 0 ? (
                <Typography color="text.secondary" sx={{ m: 'auto' }}>
                  {tr(
                    language,
                    'История появится после подключения',
                    'History appears after connecting',
                  )}
                </Typography>
              ) : (
                history.map((value, index) => (
                  <Tooltip
                    key={`distance-${value}-${history.slice(0, index).filter((sample) => sample === value).length}`}
                    title={`${value} cm`}
                  >
                    <Box
                      sx={{
                        flex: 1,
                        minWidth: 4,
                        height: `${Math.max(4, (value / maxHistory) * 100)}%`,
                        borderRadius: '5px 5px 0 0',
                        bgcolor:
                          index === history.length - 1 ? 'primary.main' : alpha('#18d5ff', 0.28),
                      }}
                    />
                  </Tooltip>
                ))
              )}
            </Box>
          </CardContent>
        </Card>
        <Stack sx={{ gap: 2 }}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Stack direction="row" sx={{ alignItems: 'center', gap: 1.5 }}>
                <Avatar
                  sx={{
                    bgcolor: sensors?.external_power
                      ? alpha('#18d5ff', 0.13)
                      : alpha('#ffbe55', 0.13),
                    color: sensors?.external_power ? 'primary.main' : 'warning.main',
                  }}
                >
                  {sensors?.external_power ? <BoltRounded /> : <BatteryChargingFullRounded />}
                </Avatar>
                <Box>
                  <Typography variant="h3">
                    {sensors?.external_power
                      ? tr(language, 'Внешнее питание', 'External power')
                      : tr(language, 'Работа от батареи', 'Running on battery')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {sensors?.charging
                      ? tr(language, 'Аккумулятор заряжается', 'Battery is charging')
                      : (sensors?.power_detection ??
                        tr(language, 'Определяю источник', 'Detecting source'))}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h3">
                {tr(language, 'Быстрые измерения', 'Quick readings')}
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row', lg: 'column' }} sx={{ gap: 1, mt: 2 }}>
                <Button
                  variant="outlined"
                  startIcon={<BatteryChargingFullRounded />}
                  disabled={!connected}
                  onClick={() => onCommand('show_battery')}
                >
                  {tr(language, 'Показать заряд на LED', 'Show charge on LEDs')}
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<SensorsRounded />}
                  disabled={!connected}
                  onClick={() => onCommand('measure_distance')}
                >
                  {tr(language, 'Измерить дистанцию', 'Measure distance')}
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<GraphicEqRounded />}
                  disabled={!connected}
                  onClick={() => onCommand('listen_sound')}
                >
                  {tr(language, 'Найти источник звука', 'Find sound source')}
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </Box>
      <Card>
        <CardContent sx={{ p: 3 }}>
          <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
            <LightbulbRounded color="primary" />
            <Typography variant="h3">
              {tr(language, 'Цветная подсветка', 'Colored lights')}
            </Typography>
          </Stack>
          <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap', mt: 2 }}>
            {actionGroups
              .find((group) => group.id === 'lights')
              ?.actions.map((item) => (
                <Button
                  key={item.command}
                  variant="outlined"
                  disabled={!connected}
                  onClick={() => onCommand(item.command)}
                  sx={{ borderColor: alpha(item.color, 0.48), bgcolor: alpha(item.color, 0.05) }}
                >
                  <Box
                    sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: item.color, mr: 1 }}
                  />
                  {language === 'en' ? item.englishLabel : item.label}
                </Button>
              ))}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  )
}

import { CheckCircleRounded, MicOffRounded, MicRounded } from '@mui/icons-material'
import {
  Alert,
  alpha,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  IconButton,
  Stack,
  Typography,
} from '@mui/material'

import { actionLabel } from '../../lib/commands'
import { tr } from '../../lib/i18n'
import type { VoicePageProps } from '../../types/ui'
import { PageHeading } from '../ui/PageHeading'

export function VoicePage({
  language,
  supported,
  listening,
  recognized,
  match,
  connected,
  busyCommand,
  onToggleSpeech,
  onCommand,
}: VoicePageProps) {
  return (
    <Stack sx={{ gap: 2 }}>
      <PageHeading
        language={language}
        eyebrow="WEB SPEECH API"
        titleRu="Голосовое управление"
        titleEn="Voice control"
        descriptionRu="Говорите естественно: браузер распознаёт до восьми вариантов, затем безопасный парсер выбирает команду из белого списка."
        descriptionEn="Speak naturally: the browser returns up to eight alternatives, then the safe allow-list parser selects a command."
      />
      {!supported && (
        <Alert severity="warning">
          {tr(
            language,
            'В этом браузере нет Speech Recognition API. Используйте Chrome или Edge.',
            'Speech Recognition API is unavailable. Use Chrome or Edge.',
          )}
        </Alert>
      )}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '.85fr 1.15fr' }, gap: 2 }}>
        <Card>
          <CardContent
            sx={{
              p: { xs: 3, md: 5 },
              minHeight: 430,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IconButton
              aria-label={
                listening
                  ? tr(language, 'Остановить распознавание', 'Stop recognition')
                  : tr(language, 'Начать распознавание', 'Start recognition')
              }
              disabled={!supported || !connected}
              onClick={onToggleSpeech}
              sx={{
                width: 160,
                height: 160,
                bgcolor: listening ? alpha('#ff5a6b', 0.16) : alpha('#18d5ff', 0.13),
                border: '1px solid',
                borderColor: listening ? 'error.main' : 'primary.main',
                color: listening ? 'error.main' : 'primary.main',
                boxShadow: listening
                  ? '0 0 60px rgba(255,90,107,.22)'
                  : '0 0 60px rgba(24,213,255,.18)',
              }}
            >
              {listening ? (
                <MicOffRounded sx={{ fontSize: 64 }} />
              ) : (
                <MicRounded sx={{ fontSize: 64 }} />
              )}
            </IconButton>
            <Typography variant="h3" sx={{ mt: 3 }}>
              {listening
                ? tr(language, 'Слушаю…', 'Listening…')
                : tr(language, 'Нажмите и скажите команду', 'Tap and say a command')}
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 1, textAlign: 'center' }}>
              {tr(
                language,
                'Микрофон браузера · русский и English',
                'Browser microphone · English and Russian',
              )}
            </Typography>
          </CardContent>
        </Card>
        <Stack sx={{ gap: 2 }}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 800 }}>
                {tr(language, 'РАСПОЗНАНО', 'RECOGNIZED')}
              </Typography>
              <Typography sx={{ mt: 1, minHeight: 52, fontSize: '1.35rem', fontWeight: 700 }}>
                {recognized ||
                  tr(
                    language,
                    'Здесь появится услышанная фраза',
                    'The recognized phrase will appear here',
                  )}
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 800 }}>
                {tr(language, 'ВЫБРАННАЯ КОМАНДА', 'SELECTED COMMAND')}
              </Typography>
              {match ? (
                <Stack direction="row" sx={{ mt: 1, alignItems: 'center', gap: 1.2 }}>
                  <Avatar sx={{ bgcolor: alpha('#18d5ff', 0.13), color: 'primary.main' }}>
                    <CheckCircleRounded />
                  </Avatar>
                  <Box>
                    <Typography sx={{ fontWeight: 800 }}>
                      {actionLabel(match.command, language)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {Math.round(match.score * 100)}% · {match.command}
                    </Typography>
                  </Box>
                </Stack>
              ) : (
                <Typography color="text.secondary" sx={{ mt: 1 }}>
                  {tr(language, 'Ожидаю команду', 'Waiting for a command')}
                </Typography>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h3">
                {tr(language, 'Встроенный микрофон Пайдога', 'PiDog built-in microphone')}
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 0.8, lineHeight: 1.6 }}>
                {tr(
                  language,
                  'Пайдог будет распознавать команды самостоятельно, без браузера.',
                  'PiDog will recognize commands by itself, without the browser.',
                )}
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 1, mt: 2 }}>
                <Button
                  variant="contained"
                  startIcon={<MicRounded />}
                  disabled={!connected || busyCommand !== null}
                  onClick={() => onCommand('local_voice_on')}
                >
                  {tr(language, 'Слушать через Пайдог', 'Use PiDog microphone')}
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<MicOffRounded />}
                  disabled={!connected || busyCommand !== null}
                  onClick={() => onCommand('local_voice_off')}
                >
                  {tr(language, 'Остановить', 'Stop')}
                </Button>
              </Stack>
            </CardContent>
          </Card>
          <Alert severity="info" variant="outlined">
            {tr(
              language,
              'Попробуйте: «найди оранжевую баночку», «покажи заряд», «вой».',
              'Try: “find orange”, “show battery”, or “howl”.',
            )}
          </Alert>
        </Stack>
      </Box>
    </Stack>
  )
}

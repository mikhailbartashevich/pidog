import {
  AutoAwesomeRounded,
  ClearAllRounded,
  MemoryRounded,
  MicOffRounded,
  MicRounded,
  PowerSettingsNewRounded,
  RefreshRounded,
  SmartToyRounded,
} from '@mui/icons-material'
import {
  Alert,
  alpha,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  FormControlLabel,
  IconButton,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import type { FormEvent } from 'react'

import { tr } from '../../lib/i18n'
import type { AssistantPageProps } from '../../types/ui'
import { PageHeading } from '../ui/PageHeading'

export function AssistantPage({
  language,
  status,
  connected,
  busy,
  question,
  reply,
  search,
  speak,
  speechSupported,
  speechListening,
  onQuestion,
  onSearch,
  onSpeak,
  onAsk,
  onSpeech,
  onRefresh,
  onControl,
  onClear,
}: AssistantPageProps) {
  const running = status?.running === true
  return (
    <Stack sx={{ gap: 2 }}>
      <PageHeading
        language={language}
        eyebrow="QWEN 3.5 · RASPBERRY PI"
        titleRu="Локальный Пайдог"
        titleEn="Local PiDog"
        descriptionRu="Диалог работает локально; интернет используется только для поиска свежей информации по вашему выбору."
        descriptionEn="Conversation runs locally; the internet is only used for fresh search when you choose it."
      />
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '380px minmax(0,1fr)' },
          gap: 2,
        }}
      >
        <Stack sx={{ gap: 2 }}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Stack direction="row" sx={{ alignItems: 'center', gap: 1.5 }}>
                <Avatar sx={{ bgcolor: alpha('#a78bfa', 0.14), color: 'secondary.main' }}>
                  <MemoryRounded />
                </Avatar>
                <Box>
                  <Stack direction="row" sx={{ alignItems: 'center', gap: 0.8 }}>
                    <Typography variant="h3">
                      {status?.model ?? tr(language, 'Локальная модель', 'Local model')}
                    </Typography>
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        bgcolor: running ? 'success.main' : 'text.disabled',
                      }}
                    />
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    {status?.state ?? tr(language, 'Состояние не проверено', 'Status not checked')}
                  </Typography>
                </Box>
              </Stack>
              <Divider sx={{ my: 2 }} />
              <Stack sx={{ gap: 1 }}>
                <StatusRow
                  label="LLM"
                  value={
                    status?.installed
                      ? tr(language, 'Установлена', 'Installed')
                      : tr(language, 'Не установлена', 'Not installed')
                  }
                  ready={status?.installed}
                />
                <StatusRow
                  label={tr(language, 'Контекст', 'Context')}
                  value={status?.context_tokens ? `${status.context_tokens} tokens` : '—'}
                />
                <StatusRow
                  label={tr(language, 'Поиск', 'Search')}
                  value={status?.web_search?.provider ?? '—'}
                  ready={status?.web_search?.available}
                />
                <StatusRow
                  label="Piper TTS"
                  value={status?.tts?.voice ?? '—'}
                  ready={status?.tts?.ready}
                />
              </Stack>
              {status?.last_error && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {status.last_error}
                </Alert>
              )}
              <Stack direction="row" sx={{ gap: 0.8, mt: 2, flexWrap: 'wrap' }}>
                <Button
                  size="small"
                  variant="contained"
                  disabled={!connected || busy || running || status?.installed === false}
                  startIcon={<PowerSettingsNewRounded />}
                  onClick={() => onControl('start')}
                >
                  {tr(language, 'Запустить', 'Start')}
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  disabled={!connected || busy || !running}
                  onClick={() => onControl('stop')}
                >
                  {tr(language, 'Остановить', 'Stop')}
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  disabled={!connected || busy}
                  startIcon={<RefreshRounded />}
                  onClick={onRefresh}
                >
                  {tr(language, 'Обновить', 'Refresh')}
                </Button>
              </Stack>
            </CardContent>
          </Card>
          <Button
            variant="outlined"
            color="error"
            startIcon={<ClearAllRounded />}
            disabled={!connected || busy}
            onClick={onClear}
          >
            {tr(language, 'Очистить историю диалога', 'Clear conversation history')}
          </Button>
        </Stack>
        <Stack sx={{ gap: 2 }}>
          <Card
            component="form"
            onSubmit={(event: FormEvent) => {
              event.preventDefault()
              onAsk()
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h3">{tr(language, 'Вопрос Пайдогу', 'Ask PiDog')}</Typography>
              <TextField
                fullWidth
                multiline
                minRows={4}
                value={question}
                onChange={(event) => onQuestion(event.target.value)}
                placeholder={tr(
                  language,
                  'Например: какая сегодня погода в Варшаве?',
                  'For example: what is the weather in Warsaw today?',
                )}
                sx={{ mt: 2 }}
                slotProps={{ htmlInput: { maxLength: 600 } }}
              />
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                sx={{
                  mt: 1.5,
                  gap: 1,
                  alignItems: { sm: 'center' },
                  justifyContent: 'space-between',
                }}
              >
                <Box>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={search}
                        disabled={!status?.web_search?.available}
                        onChange={(event) => onSearch(event.target.checked)}
                      />
                    }
                    label={tr(language, 'Веб-поиск', 'Web search')}
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={speak}
                        disabled={!status?.tts?.ready}
                        onChange={(event) => onSpeak(event.target.checked)}
                      />
                    }
                    label={tr(language, 'Озвучить', 'Speak')}
                  />
                </Box>
                <Stack direction="row" sx={{ gap: 0.8 }}>
                  <Tooltip title={tr(language, 'Продиктовать вопрос', 'Dictate question')}>
                    <span>
                      <IconButton
                        aria-label={tr(language, 'Продиктовать вопрос', 'Dictate question')}
                        disabled={!speechSupported || !running || busy}
                        color={speechListening ? 'error' : 'primary'}
                        onClick={onSpeech}
                      >
                        {speechListening ? <MicOffRounded /> : <MicRounded />}
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={!connected || !running || busy || !question.trim()}
                    startIcon={busy ? <CircularProgress size={18} /> : <AutoAwesomeRounded />}
                  >
                    {tr(language, 'Спросить', 'Ask')}
                  </Button>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
          {reply && (
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
                  <SmartToyRounded color="primary" />
                  <Typography variant="overline" color="primary.main" sx={{ fontWeight: 800 }}>
                    {tr(language, 'ОТВЕТ ПАЙДОГА', 'PIDOG ANSWER')}
                  </Typography>
                </Stack>
                <Typography sx={{ mt: 1.5, lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>
                  {reply.answer}
                </Typography>
                {reply.search_warning && (
                  <Alert severity="warning" sx={{ mt: 2 }}>
                    {reply.search_warning}
                  </Alert>
                )}
                {reply.sources && reply.sources.length > 0 && (
                  <Box sx={{ mt: 2.5 }}>
                    <Typography sx={{ fontWeight: 800, mb: 1 }}>
                      {tr(language, 'Источники', 'Sources')}
                    </Typography>
                    <Stack sx={{ gap: 1 }}>
                      {reply.sources.map((source, index) => (
                        <Box key={source.url}>
                          <Typography
                            component="a"
                            href={source.url}
                            target="_blank"
                            rel="noreferrer"
                            color="primary.light"
                            variant="body2"
                            sx={{ fontWeight: 700 }}
                          >
                            [{index + 1}] {source.title ?? source.url}
                          </Typography>
                          {source.snippet && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{ display: 'block', mt: 0.2 }}
                            >
                              {source.snippet}
                            </Typography>
                          )}
                        </Box>
                      ))}
                    </Stack>
                  </Box>
                )}
              </CardContent>
            </Card>
          )}
        </Stack>
      </Box>
    </Stack>
  )
}

function StatusRow({ label, value, ready }: { label: string; value: string; ready?: boolean }) {
  return (
    <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
      <Typography color="text.secondary">{label}</Typography>
      <Stack direction="row" sx={{ alignItems: 'center', gap: 0.7 }}>
        <Typography sx={{ fontWeight: 700, textAlign: 'right' }}>{value}</Typography>
        {ready != null && (
          <Box
            sx={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              bgcolor: ready ? 'success.main' : 'error.main',
            }}
          />
        )}
      </Stack>
    </Stack>
  )
}

import {
  CampaignRounded,
  PersonSearchRounded,
  RefreshRounded,
  ShieldRounded,
  StopRounded,
} from '@mui/icons-material'
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material'
import { useCallback, useEffect, useState } from 'react'

import { pidogApi, type VisionGuardTarget } from '../../lib/api'
import { tr } from '../../lib/i18n'
import type { AiVisionCommandsPageProps } from '../../types/ui'
import { PageHeading } from '../ui/PageHeading'

export function AiVisionCommandsPage({
  language,
  connected,
  configured,
  settings,
  onGuard,
  onCommand,
}: AiVisionCommandsPageProps) {
  const [targets, setTargets] = useState<VisionGuardTarget[]>([])
  const [selected, setSelected] = useState('')
  const [loading, setLoading] = useState(false)
  const [guarding, setGuarding] = useState(false)
  const [error, setError] = useState('')

  const loadTargets = useCallback(async () => {
    if (!connected || !configured) return
    setLoading(true)
    try {
      const response = await pidogApi.visionGuardTargets(settings)
      setTargets(response.targets)
      setSelected((current) =>
        response.targets.some((target) => target.name === current)
          ? current
          : (response.targets[0]?.name ?? ''),
      )
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'AI vision request failed')
    } finally {
      setLoading(false)
    }
  }, [configured, connected, settings])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadTargets(), 0)
    return () => window.clearTimeout(timer)
  }, [loadTargets])

  async function guard() {
    if (!selected) return
    setGuarding(true)
    try {
      await onGuard(selected)
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'AI guard could not start')
    } finally {
      setGuarding(false)
    }
  }

  return (
    <Stack sx={{ gap: 2 }}>
      <PageHeading
        language={language}
        eyebrow={tr(language, 'AI PI 5 · ЛОКАЛЬНАЯ БАЗА', 'AI PI 5 · LOCAL DATABASE')}
        titleRu="AI-команды"
        titleEn="AI commands"
        descriptionRu="Выберите персону или визуальную цель из базы AI Pi. «Сторожить» подаёт сигнал через динамик, когда выбранная цель ближе 100 см."
        descriptionEn="Choose a person or visual target from the AI Pi database. Guard sounds a speaker alert when the selected target is closer than 100 cm."
      />
      {!configured && (
        <Alert severity="warning">
          {tr(
            language,
            'Подключите AI Pi, чтобы получить список персон.',
            'Connect the AI Pi to load people.',
          )}
        </Alert>
      )}
      {error && (
        <Alert severity="error" onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.35fr) minmax(290px, .65fr)' },
          gap: 1.5,
        }}
      >
        <Card>
          <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
            <Stack sx={{ gap: 1.7 }}>
              <Stack
                direction="row"
                sx={{ justifyContent: 'space-between', alignItems: 'center', gap: 1 }}
              >
                <Stack direction="row" sx={{ alignItems: 'center', gap: 1.2 }}>
                  <Avatar sx={{ bgcolor: 'error.dark', color: 'error.light' }}>
                    <ShieldRounded />
                  </Avatar>
                  <Box>
                    <Typography variant="h3">
                      {tr(language, 'Сторожить от', 'Guard against')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {tr(
                        language,
                        'Список напрямую из базы AI Pi 5',
                        'List read directly from the AI Pi 5 database',
                      )}
                    </Typography>
                  </Box>
                </Stack>
                <Button
                  size="small"
                  startIcon={loading ? <CircularProgress size={15} /> : <RefreshRounded />}
                  onClick={() => void loadTargets()}
                  disabled={!connected || !configured || loading}
                >
                  {tr(language, 'Обновить', 'Refresh')}
                </Button>
              </Stack>
              <Stack direction="row" useFlexGap sx={{ gap: 1, flexWrap: 'wrap' }}>
                {targets.map((target) => (
                  <Chip
                    key={`${target.source}:${target.name}`}
                    label={target.name}
                    color={selected === target.name ? 'primary' : 'default'}
                    variant={selected === target.name ? 'filled' : 'outlined'}
                    onClick={() => setSelected(target.name)}
                    icon={target.source === 'face' ? <PersonSearchRounded /> : <ShieldRounded />}
                  />
                ))}
                {!loading && targets.length === 0 && (
                  <Typography color="text.secondary">
                    {tr(
                      language,
                      'В базе пока нет персон. Добавьте лицо или перенесите кота из объектов.',
                      'No people in the database yet. Add a face or promote a cat from objects.',
                    )}
                  </Typography>
                )}
              </Stack>
              <Button
                variant="contained"
                color="error"
                startIcon={
                  guarding ? <CircularProgress size={18} color="inherit" /> : <CampaignRounded />
                }
                onClick={() => void guard()}
                disabled={!connected || !configured || !selected || guarding}
                sx={{ alignSelf: 'start' }}
              >
                {tr(language, 'Сторожить выбранного', 'Guard selected')}
              </Button>
              <Typography variant="caption" color="text.secondary">
                {tr(
                  language,
                  'Сигнал повторяется не чаще одного раза в 12 секунд. Робот не ходит самостоятельно.',
                  'The alert repeats no more than once every 12 seconds. The robot never walks autonomously.',
                )}
              </Typography>
            </Stack>
          </CardContent>
        </Card>
        <Stack sx={{ gap: 1.5 }}>
          <Card
            component="button"
            onClick={() => onCommand('follow_ai_target')}
            sx={{ textAlign: 'left', color: 'text.primary', cursor: 'pointer' }}
          >
            <CardContent sx={{ display: 'flex', gap: 1.3, alignItems: 'center' }}>
              <Avatar sx={{ bgcolor: 'primary.dark' }}>
                <PersonSearchRounded />
              </Avatar>
              <Box>
                <Typography sx={{ fontWeight: 800 }}>
                  {tr(language, 'Искать человека', 'Find a person')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {tr(
                    language,
                    'AI-слежение без выбора цели',
                    'AI tracking without a chosen target',
                  )}
                </Typography>
              </Box>
            </CardContent>
          </Card>
          <Card
            component="button"
            onClick={() => onCommand('stop_ai_target')}
            sx={{ textAlign: 'left', color: 'text.primary', cursor: 'pointer' }}
          >
            <CardContent sx={{ display: 'flex', gap: 1.3, alignItems: 'center' }}>
              <Avatar sx={{ bgcolor: 'error.dark' }}>
                <StopRounded />
              </Avatar>
              <Box>
                <Typography sx={{ fontWeight: 800 }}>
                  {tr(language, 'Остановить AI-режим', 'Stop AI mode')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {tr(language, 'Остановить слежение и сторожа', 'Stop tracking and guard mode')}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Stack>
      </Box>
    </Stack>
  )
}

import { BoltRounded, SearchRounded } from '@mui/icons-material'
import {
  alpha,
  Avatar,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useMemo, useState } from 'react'

import { actionGroups, allActions } from '../../lib/commands'
import { tr } from '../../lib/i18n'
import type { PageProps } from '../../types/ui'
import { PageHeading } from '../ui/PageHeading'

type CommandsPageProps = PageProps & {
  busyCommand: string | null
  onCommand: (command: string) => void
}

export function CommandsPage({ language, busyCommand, onCommand }: CommandsPageProps) {
  const [group, setGroup] = useState(actionGroups[0]?.id ?? 'movement')
  const [query, setQuery] = useState('')
  const actions = useMemo(
    () =>
      query.trim()
        ? allActions.filter((item) =>
            [item.label, item.englishLabel, item.command].some((value) =>
              value.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
            ),
          )
        : (actionGroups.find((item) => item.id === group)?.actions ?? []),
    [group, query],
  )
  return (
    <Stack sx={{ gap: 2 }}>
      <PageHeading
        language={language}
        eyebrow={tr(language, 'БЕЗОПАСНЫЙ СПИСОК', 'SAFE ALLOW-LIST')}
        titleRu="Все команды"
        titleEn="All commands"
        descriptionRu="Полный каталог Android-версии: движение, позы, жесты, зрение, сенсоры, свет и микрофон."
        descriptionEn="The full Android catalog: movement, poses, gestures, vision, sensors, lights, and microphone."
      />
      <TextField
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={tr(language, 'Найти команду…', 'Find a command…')}
        sx={{ maxWidth: 520 }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchRounded />
              </InputAdornment>
            ),
          },
        }}
      />
      {!query && (
        <Stack direction="row" sx={{ gap: 0.8, overflowX: 'auto', pb: 0.5 }}>
          {actionGroups.map((item) => (
            <Chip
              key={item.id}
              label={language === 'en' ? item.englishLabel : item.label}
              color={item.id === group ? 'primary' : 'default'}
              variant={item.id === group ? 'filled' : 'outlined'}
              onClick={() => setGroup(item.id)}
              sx={{ flexShrink: 0, fontWeight: 700 }}
            />
          ))}
        </Stack>
      )}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2,1fr)',
            lg: 'repeat(3,1fr)',
            xxl: 'repeat(4,1fr)',
          },
          gap: 1.2,
        }}
      >
        {actions.map((item) => (
          <Card
            key={item.command}
            component="button"
            onClick={() => onCommand(item.command)}
            sx={{
              appearance: 'none',
              font: 'inherit',
              color: 'text.primary',
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'transform .18s ease, border-color .18s ease',
              '&:hover': { transform: 'translateY(-2px)', borderColor: alpha(item.color, 0.55) },
              '&:focus-visible': { outline: `2px solid ${item.color}`, outlineOffset: 2 },
            }}
          >
            <CardContent sx={{ p: 2.2, display: 'flex', gap: 1.5, alignItems: 'center' }}>
              <Avatar sx={{ bgcolor: alpha(item.color, 0.12), color: item.color }}>
                {busyCommand === item.command ? (
                  <CircularProgress size={22} color="inherit" />
                ) : (
                  <BoltRounded />
                )}
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 800 }}>
                  {language === 'en' ? item.englishLabel : item.label}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.2 }}>
                  {language === 'en' ? item.englishDescription : item.description}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>
    </Stack>
  )
}

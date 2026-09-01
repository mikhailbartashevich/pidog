import { EmergencyRounded, SettingsRounded } from '@mui/icons-material'
import {
  alpha,
  Avatar,
  Box,
  IconButton,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material'

import mascot from '../../../../app/src/main/res/drawable-nodpi/pidog_status_mascot.png'
import type { Language } from '../../lib/commands'
import { tr } from '../../lib/i18n'
import type { Page } from '../../types/ui'
import { pages } from './Navigation'

type AppHeaderProps = {
  page: Page
  language: Language
  small: boolean
  connected: boolean
  version?: string
  dryRun?: boolean
  onLanguage: (language: Language) => void
  onConnection: () => void
  onStop: () => void
}

export function AppHeader({
  page,
  language,
  small,
  connected,
  version,
  dryRun,
  onLanguage,
  onConnection,
  onStop,
}: AppHeaderProps) {
  const pageTitle = pages.find((item) => item.id === page)
  return (
    <Paper
      component="header"
      square
      elevation={0}
      sx={{
        height: 72,
        px: { xs: 1.5, sm: 2.5, xl: 4 },
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 20,
        borderBottom: '1px solid',
        borderColor: 'divider',
        bgcolor: alpha('#030a12', 0.82),
        backdropFilter: 'blur(20px)',
      }}
    >
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1.2, minWidth: 0 }}>
        {small && (
          <Avatar
            src={mascot}
            alt="PiDog"
            variant="rounded"
            sx={{ width: 40, height: 40, borderRadius: 2 }}
          />
        )}
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800, lineHeight: 1.1 }} noWrap>
            {pageTitle ? tr(language, pageTitle.ru, pageTitle.en) : 'PiDog'}
          </Typography>
          <Stack direction="row" sx={{ gap: 0.7, alignItems: 'center' }}>
            <Box
              sx={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                bgcolor: connected ? 'success.main' : 'error.main',
              }}
            />
            <Typography variant="caption" color="text.secondary" noWrap>
              {connected
                ? `${tr(language, 'На связи', 'Online')} · API ${version ?? ''}${dryRun ? ' · DRY RUN' : ''}`
                : tr(language, 'Нет подключения', 'Offline')}
            </Typography>
          </Stack>
        </Box>
      </Stack>
      <Stack direction="row" sx={{ alignItems: 'center', gap: 0.8 }}>
        <Select
          size="small"
          value={language}
          onChange={(event) => onLanguage(event.target.value)}
          aria-label="Language"
          sx={{ minWidth: 76, '& .MuiSelect-select': { py: 0.8 } }}
        >
          <MenuItem value="ru">RU</MenuItem>
          <MenuItem value="en">EN</MenuItem>
        </Select>
        <Tooltip title={tr(language, 'Подключение', 'Connection')}>
          <IconButton
            aria-label={tr(language, 'Настроить подключение', 'Configure connection')}
            onClick={onConnection}
          >
            <SettingsRounded />
          </IconButton>
        </Tooltip>
        <Tooltip title="STOP">
          <span>
            <IconButton
              aria-label="Emergency stop"
              color="error"
              disabled={!connected}
              onClick={onStop}
            >
              <EmergencyRounded />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
    </Paper>
  )
}

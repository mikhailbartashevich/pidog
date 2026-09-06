import {
  AutoAwesomeRounded,
  DashboardRounded,
  MicRounded,
  RocketLaunchRounded,
  SensorsRounded,
  VisibilityRounded,
} from '@mui/icons-material'
import {
  alpha,
  Box,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material'

import type { Language } from '../../lib/commands'
import { tr } from '../../lib/i18n'
import type { Page } from '../../types/ui'

export const pages: Array<{
  id: Page
  path: string
  ru: string
  en: string
  icon: typeof DashboardRounded
}> = [
  { id: 'cockpit', path: '/', ru: 'Пульт', en: 'Cockpit', icon: DashboardRounded },
  { id: 'vision', path: '/ai-vision', ru: 'AI зрение', en: 'AI vision', icon: VisibilityRounded },
  { id: 'voice', path: '/voice', ru: 'Голос', en: 'Voice', icon: MicRounded },
  { id: 'commands', path: '/commands', ru: 'Команды', en: 'Commands', icon: RocketLaunchRounded },
  { id: 'sensors', path: '/sensors', ru: 'Сенсоры', en: 'Sensors', icon: SensorsRounded },
  { id: 'assistant', path: '/llm', ru: 'LLM', en: 'LLM', icon: AutoAwesomeRounded },
]

export const pagePath = (page: Page) => pages.find((item) => item.id === page)?.path ?? '/'

export const pageFromPath = (path: string): Page =>
  pages.find((item) => item.path === path)?.id ?? 'cockpit'

type NavigationProps = {
  page: Page
  language: Language
  connected: boolean
  onPage: (page: Page) => void
}

export function NavigationRail({ page, language, connected, onPage }: NavigationProps) {
  return (
    <Paper
      component="aside"
      square
      elevation={0}
      sx={{
        position: 'fixed',
        inset: '0 auto 0 0',
        width: 92,
        zIndex: 30,
        borderRight: '1px solid',
        borderColor: 'divider',
        bgcolor: alpha('#030a12', 0.9),
        backdropFilter: 'blur(20px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        py: 1.5,
      }}
    >
      <List disablePadding sx={{ width: '100%', px: 1 }}>
        {pages.map(({ id, ru, en, icon: Icon }) => (
          <Tooltip key={id} title={tr(language, ru, en)} placement="right">
            <ListItemButton
              selected={page === id}
              aria-label={tr(language, ru, en)}
              onClick={() => onPage(id)}
              sx={{
                borderRadius: 2.5,
                mb: 0.6,
                minHeight: 62,
                flexDirection: 'column',
                gap: 0.3,
                justifyContent: 'center',
                '&.Mui-selected': { bgcolor: alpha('#18d5ff', 0.12), color: 'primary.light' },
              }}
            >
              <ListItemIcon sx={{ minWidth: 0, color: 'inherit', justifyContent: 'center' }}>
                <Icon />
              </ListItemIcon>
              <Typography
                sx={{ fontSize: 10, lineHeight: 1, fontWeight: 750, textAlign: 'center' }}
              >
                {tr(language, ru, en)}
              </Typography>
            </ListItemButton>
          </Tooltip>
        ))}
      </List>
      <Box
        sx={{
          mt: 'auto',
          width: 12,
          height: 12,
          borderRadius: '50%',
          bgcolor: connected ? 'success.main' : 'error.main',
          boxShadow: connected ? '0 0 14px rgba(69,230,164,.65)' : 'none',
        }}
      />
    </Paper>
  )
}

export function MobileNavigation({ page, language, onPage }: Omit<NavigationProps, 'connected'>) {
  return (
    <Paper
      sx={{
        position: 'fixed',
        zIndex: 30,
        left: 8,
        right: 8,
        bottom: 8,
        p: 0.5,
        borderRadius: 3,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: alpha('#071522', 0.96),
        backdropFilter: 'blur(18px)',
      }}
    >
      <Stack direction="row" sx={{ justifyContent: 'space-around' }}>
        {pages.map(({ id, ru, en, icon: Icon }) => (
          <Tooltip key={id} title={tr(language, ru, en)}>
            <IconButton
              aria-label={tr(language, ru, en)}
              color={page === id ? 'primary' : 'default'}
              onClick={() => onPage(id)}
            >
              <Icon />
            </IconButton>
          </Tooltip>
        ))}
      </Stack>
    </Paper>
  )
}

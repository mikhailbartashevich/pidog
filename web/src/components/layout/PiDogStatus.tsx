import { alpha, Avatar, Box, CircularProgress, Stack, Typography } from '@mui/material'

import errorMascot from '../../../../app/src/main/res/drawable-nodpi/pidog_status_error.png'
import listeningMascot from '../../../../app/src/main/res/drawable-nodpi/pidog_status_listening.png'
import mascot from '../../../../app/src/main/res/drawable-nodpi/pidog_status_mascot.png'
import searchingMascot from '../../../../app/src/main/res/drawable-nodpi/pidog_status_searching.png'
import speakingMascot from '../../../../app/src/main/res/drawable-nodpi/pidog_status_speaking.png'
import thinkingMascot from '../../../../app/src/main/res/drawable-nodpi/pidog_status_thinking.png'
import type { Language } from '../../lib/commands'
import { tr } from '../../lib/i18n'

export type PiDogStatusKind =
  | 'idle'
  | 'working'
  | 'listening'
  | 'thinking'
  | 'searching'
  | 'speaking'
  | 'success'
  | 'error'

export type PiDogStatus = {
  kind: PiDogStatusKind
  message: string
}

type PiDogStatusProps = {
  language: Language
  status: PiDogStatus
  compact?: boolean
}

type StatusAppearance = {
  avatar: string
  color: string
  titleRu: string
  titleEn: string
  busy: boolean
}

const appearances: Record<PiDogStatusKind, StatusAppearance> = {
  idle: {
    avatar: mascot,
    color: '#8297a3',
    titleRu: 'ГОТОВ К РАБОТЕ',
    titleEn: 'READY',
    busy: false,
  },
  working: {
    avatar: thinkingMascot,
    color: '#18d5ff',
    titleRu: 'ВЫПОЛНЯЮ',
    titleEn: 'IN PROGRESS',
    busy: true,
  },
  listening: {
    avatar: listeningMascot,
    color: '#18d5ff',
    titleRu: 'СЛУШАЮ',
    titleEn: 'LISTENING',
    busy: true,
  },
  thinking: {
    avatar: thinkingMascot,
    color: '#18d5ff',
    titleRu: 'ДУМАЮ',
    titleEn: 'THINKING',
    busy: true,
  },
  searching: {
    avatar: searchingMascot,
    color: '#18d5ff',
    titleRu: 'ИЩУ',
    titleEn: 'SEARCHING',
    busy: true,
  },
  speaking: {
    avatar: speakingMascot,
    color: '#18d5ff',
    titleRu: 'ОТВЕЧАЮ',
    titleEn: 'ANSWERING',
    busy: true,
  },
  success: { avatar: mascot, color: '#45e6a4', titleRu: 'ГОТОВО', titleEn: 'DONE', busy: false },
  error: {
    avatar: errorMascot,
    color: '#ff5a6b',
    titleRu: 'НУЖНО ВНИМАНИЕ',
    titleEn: 'NEEDS ATTENTION',
    busy: false,
  },
}

/** A persistent, live-readable rendering of PiDog's current task state. */
export function PiDogStatusIndicator({ language, status, compact = false }: PiDogStatusProps) {
  const appearance = appearances[status.kind]
  const title = tr(language, appearance.titleRu, appearance.titleEn)
  const label = `${title}. ${status.message}`

  return (
    <Stack
      aria-label={label}
      aria-live="polite"
      component="output"
      direction="row"
      title={label}
      sx={{ alignItems: 'center', gap: 1, minWidth: 0, maxWidth: { xs: 210, sm: 310 } }}
    >
      <Box sx={{ position: 'relative', flexShrink: 0 }}>
        <Avatar
          alt=""
          src={appearance.avatar}
          variant="rounded"
          sx={{
            width: 46,
            height: 46,
            borderRadius: 2,
            bgcolor: alpha(appearance.color, 0.14),
            border: '1px solid',
            borderColor: alpha(appearance.color, 0.38),
            animation: appearance.busy ? 'pidog-status-pulse 1.3s ease-in-out infinite' : 'none',
            '@keyframes pidog-status-pulse': {
              '0%, 100%': { opacity: 1, transform: 'translateY(0)' },
              '50%': { opacity: 0.66, transform: 'translateY(-2px)' },
            },
          }}
        />
        {appearance.busy && (
          <CircularProgress
            size={14}
            thickness={5}
            sx={{ position: 'absolute', right: -3, bottom: -3, color: appearance.color }}
          />
        )}
      </Box>
      {!compact && (
        <Box sx={{ minWidth: 0 }}>
          <Typography
            sx={{ color: appearance.color, fontSize: 10, fontWeight: 900, letterSpacing: '.09em' }}
            noWrap
          >
            {title}
          </Typography>
          <Typography variant="caption" sx={{ display: 'block' }} noWrap>
            {status.message}
          </Typography>
        </Box>
      )}
    </Stack>
  )
}

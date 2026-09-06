import { Alert, Box, Snackbar } from '@mui/material'
import type { ReactNode } from 'react'

import type { ConnectionSettings, HealthResponse } from '../lib/api'
import type { Language } from '../lib/commands'
import type { Notice, Page } from '../types/ui'
import { ConnectionDialog } from './ConnectionDialog'
import { AppHeader } from './layout/AppHeader'
import { MobileNavigation, NavigationRail } from './layout/Navigation'
import type { PiDogStatus } from './layout/PiDogStatus'

type ControlStationLayoutProps = {
  small: boolean
  page: Page
  language: Language
  connected: boolean
  health: HealthResponse | null
  status: PiDogStatus
  content: ReactNode
  draftSettings: ConnectionSettings
  connectionOpen: boolean
  connecting: boolean
  notice: Notice | null
  onPage: (page: Page) => void
  onLanguage: (language: Language) => void
  onConnection: () => void
  onStop: () => void
  onDraftSettings: (settings: ConnectionSettings) => void
  onCloseConnection: () => void
  onSaveConnection: () => void
  onCloseNotice: () => void
}

export function ControlStationLayout({
  small,
  page,
  language,
  connected,
  health,
  status,
  content,
  draftSettings,
  connectionOpen,
  connecting,
  notice,
  onPage,
  onLanguage,
  onConnection,
  onStop,
  onDraftSettings,
  onCloseConnection,
  onSaveConnection,
  onCloseNotice,
}: ControlStationLayoutProps) {
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex' }}>
      {!small && (
        <NavigationRail page={page} language={language} connected={connected} onPage={onPage} />
      )}
      <Box sx={{ width: '100%', minWidth: 0, ml: small ? 0 : '92px', pb: small ? 10 : 3 }}>
        <AppHeader
          page={page}
          language={language}
          connected={connected}
          version={health?.version}
          dryRun={health?.dry_run}
          status={status}
          onLanguage={onLanguage}
          onConnection={onConnection}
          onStop={onStop}
        />
        <Box
          component="main"
          sx={{ width: 'min(1800px, 100%)', mx: 'auto', p: { xs: 1.5, sm: 2.5, xl: 3 } }}
        >
          {content}
        </Box>
      </Box>
      {small && <MobileNavigation page={page} language={language} onPage={onPage} />}
      <ConnectionDialog
        language={language}
        open={connectionOpen || !connected}
        value={draftSettings}
        connecting={connecting}
        onChange={onDraftSettings}
        onClose={onCloseConnection}
        onSave={onSaveConnection}
      />
      <Snackbar
        open={notice !== null}
        autoHideDuration={4500}
        onClose={onCloseNotice}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{ bottom: { xs: 84, sm: 24 } }}
      >
        <Alert
          severity={notice?.severity ?? 'info'}
          variant="filled"
          onClose={onCloseNotice}
          sx={{ minWidth: { sm: 360 } }}
        >
          {notice?.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}

import { WifiRounded } from '@mui/icons-material'
import {
  Alert,
  alpha,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material'

import { tr } from '../lib/i18n'
import type { ConnectionDialogProps } from '../types/ui'

export function ConnectionDialog({
  language,
  open,
  value,
  connecting,
  onChange,
  onClose,
  onSave,
}: ConnectionDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        <Stack direction="row" sx={{ alignItems: 'center', gap: 1.2 }}>
          <Avatar sx={{ bgcolor: alpha('#18d5ff', 0.12), color: 'primary.main' }}>
            <WifiRounded />
          </Avatar>
          <Box>
            <Typography variant="h3">
              {tr(language, 'Подключение к Пайдогу', 'Connect to PiDog')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.2 }}>
              {tr(
                language,
                'Браузер и Raspberry Pi должны быть в одной Wi‑Fi сети',
                'The browser and Raspberry Pi must be on the same Wi-Fi network',
              )}
            </Typography>
          </Box>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Stack sx={{ gap: 2, mt: 1 }}>
          <TextField
            label={tr(language, 'Адрес Raspberry Pi', 'Raspberry Pi address')}
            value={value.host}
            onChange={(event) => onChange({ ...value, host: event.target.value })}
            placeholder="pidog.local or 192.168.1.37"
          />
          <Box sx={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 1.5 }}>
            <TextField
              label={tr(language, 'Порт', 'Port')}
              type="number"
              value={value.port}
              onChange={(event) => onChange({ ...value, port: Number(event.target.value) })}
              slotProps={{ htmlInput: { min: 1, max: 65535 } }}
            />
            <TextField
              label={tr(language, 'Секретный токен', 'Secret token')}
              type="password"
              value={value.token}
              onChange={(event) => onChange({ ...value, token: event.target.value })}
            />
          </Box>
          <Alert severity="warning" variant="outlined">
            {tr(
              language,
              'Панель предназначена только для доверенной локальной сети.',
              'This panel is only for a trusted local network.',
            )}
          </Alert>
          <Alert severity="info" variant="outlined">
            {tr(
              language,
              'Если pidog.local не находится, выполните hostname -I на Raspberry Pi и введите его IPv4-адрес. После обновления веб-панели перезапустите pidog-voice, чтобы сервер принял CORS-запрос браузера.',
              'If pidog.local cannot be found, run hostname -I on the Raspberry Pi and enter its IPv4 address. After updating the web panel, restart pidog-voice so the server accepts browser CORS requests.',
            )}
          </Alert>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose}>{tr(language, 'Отмена', 'Cancel')}</Button>
        <Button
          variant="contained"
          startIcon={connecting ? <CircularProgress size={18} /> : <WifiRounded />}
          disabled={connecting}
          onClick={onSave}
        >
          {tr(language, 'Проверить и сохранить', 'Check and save')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

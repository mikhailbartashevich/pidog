import {
  AutoAwesomeRounded,
  BatteryChargingFullRounded,
  BoltRounded,
  CameraAltRounded,
  CheckCircleRounded,
  ClearAllRounded,
  CloseFullscreenRounded,
  DashboardRounded,
  EmergencyRounded,
  ExpandRounded,
  GraphicEqRounded,
  LightbulbRounded,
  MemoryRounded,
  MicOffRounded,
  MicRounded,
  MoreHorizRounded,
  PetsRounded,
  PowerSettingsNewRounded,
  RefreshRounded,
  RocketLaunchRounded,
  SearchRounded,
  SensorsRounded,
  SettingsRounded,
  SmartToyRounded,
  VideocamOffRounded,
  WifiRounded,
} from '@mui/icons-material';
import {
  Alert,
  alpha,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  InputAdornment,
  LinearProgress,
  List,
  ListItemButton,
  ListItemIcon,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import mascot from '../../app/src/main/res/drawable-nodpi/pidog_status_mascot.png';
import { HeadJoystick } from './components/HeadJoystick';
import { Joystick } from './components/Joystick';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import {
  type AssistantStatus,
  buildCameraStreamUrl,
  type ChatResponse,
  type CommandResponse,
  type ConnectionSettings,
  type HealthResponse,
  loadSettings,
  normalizeHost,
  pidogApi,
  saveSettings,
  type SensorsResponse,
} from './lib/api';
import { actionGroups, actionLabel, allActions, findAction, type Language } from './lib/commands';
import { matchVoiceCommand, type VoiceMatch } from './lib/voiceCommands';

type Page = 'cockpit' | 'voice' | 'commands' | 'sensors' | 'assistant';
type SpeechTarget = 'command' | 'assistant';
type Axis = 'drive' | 'turn';
type Direction = -1 | 0 | 1;

interface Notice {
  message: string;
  severity: 'success' | 'error' | 'info' | 'warning';
}

interface VisionEntry {
  id: number;
  time: string;
  title: string;
  detail: string;
  success: boolean;
}

const languageKey = 'pidog.language.v1';

const pages: Array<{ id: Page; ru: string; en: string; icon: typeof DashboardRounded }> = [
  { id: 'cockpit', ru: 'Пульт', en: 'Cockpit', icon: DashboardRounded },
  { id: 'voice', ru: 'Голос', en: 'Voice', icon: MicRounded },
  { id: 'commands', ru: 'Команды', en: 'Commands', icon: RocketLaunchRounded },
  { id: 'sensors', ru: 'Сенсоры', en: 'Sensors', icon: SensorsRounded },
  { id: 'assistant', ru: 'LLM', en: 'LLM', icon: AutoAwesomeRounded },
];

const colorCommands = [
  'find_red',
  'find_orange',
  'find_yellow',
  'find_green',
  'find_blue',
  'find_purple',
];

function tr(language: Language, russian: string, english: string): string {
  return language === 'en' ? english : russian;
}

function initialLanguage(): Language {
  return localStorage.getItem(languageKey) === 'en' ? 'en' : 'ru';
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

function timeNow(): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date());
}

export function ControlStation() {
  const theme = useTheme();
  const small = useMediaQuery(theme.breakpoints.down('md'));
  const [language, setLanguage] = useState<Language>(initialLanguage);
  const [page, setPage] = useState<Page>('cockpit');
  const [settings, setSettings] = useState(loadSettings);
  const [draftSettings, setDraftSettings] = useState(settings);
  const [connectionOpen, setConnectionOpen] = useState(false);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [sensors, setSensors] = useState<SensorsResponse | null>(null);
  const [sensorHistory, setSensorHistory] = useState<number[]>([]);
  const [busyCommand, setBusyCommand] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [streamNonce, setStreamNonce] = useState(0);
  const [visionLog, setVisionLog] = useState<VisionEntry[]>([]);
  const [recognized, setRecognized] = useState('');
  const [voiceMatch, setVoiceMatch] = useState<VoiceMatch | null>(null);
  const [assistantStatus, setAssistantStatus] = useState<AssistantStatus | null>(null);
  const [assistantQuestion, setAssistantQuestion] = useState('');
  const [assistantReply, setAssistantReply] = useState<ChatResponse | null>(null);
  const [assistantSearch, setAssistantSearch] = useState(true);
  const [assistantSpeak, setAssistantSpeak] = useState(false);
  const [assistantBusy, setAssistantBusy] = useState(false);
  const [speechTarget, setSpeechTarget] = useState<SpeechTarget>('command');

  const speechTargetRef = useRef<SpeechTarget>('command');
  const movementRef = useRef<{ drive: Direction; turn: Direction; last: Axis }>({
    drive: 0,
    turn: 0,
    last: 'drive',
  });
  const activeMotionRef = useRef<string | null>(null);
  const pendingHeadRef = useRef<{ yaw: number; pitch: number } | null>(null);
  const headRequestInFlightRef = useRef(false);
  const autoConnectRef = useRef(false);

  const addVisionEntry = useCallback((title: string, detail: string, success: boolean) => {
    setVisionLog((current) =>
      [
        { id: Date.now() + Math.random(), time: timeNow(), title, detail, success },
        ...current,
      ].slice(0, 10),
    );
  }, []);

  const refreshSensors = useCallback(
    async (announce = false) => {
      if (!connected) return;
      try {
        const next = await pidogApi.sensors(settings);
        setSensors(next);
        const distance = next.distance_cm;
        if (distance != null) {
          setSensorHistory((current) => [...current, distance].slice(-18));
        }
        if (announce) {
          setNotice({
            message: tr(language, 'Сенсоры обновлены', 'Sensors updated'),
            severity: 'success',
          });
        }
      } catch (error) {
        if (announce) setNotice({ message: errorMessage(error), severity: 'error' });
      }
    },
    [connected, language, settings],
  );

  const connect = useCallback(
    async (endpoint: ConnectionSettings, announce = true) => {
      setConnecting(true);
      try {
        const nextHealth = await pidogApi.health(endpoint);
        setSettings(endpoint);
        saveSettings(endpoint);
        setHealth(nextHealth);
        setConnected(true);
        const [nextSensors, nextAssistant] = await Promise.all([
          pidogApi.sensors(endpoint).catch(() => null),
          pidogApi.assistantStatus(endpoint).catch(() => null),
        ]);
        if (nextSensors) {
          setSensors(nextSensors);
          if (nextSensors.distance_cm != null) setSensorHistory([nextSensors.distance_cm]);
          setStreaming(nextSensors.camera);
        }
        if (nextAssistant) setAssistantStatus(nextAssistant.assistant);
        if (announce) {
          setNotice({
            message: nextHealth.dry_run
              ? tr(language, 'Подключено в dry-run режиме', 'Connected in dry-run mode')
              : tr(language, 'Пайдог на связи', 'PiDog is online'),
            severity: 'success',
          });
        }
        return true;
      } catch (error) {
        setConnected(false);
        setHealth(null);
        if (announce) setNotice({ message: errorMessage(error), severity: 'error' });
        return false;
      } finally {
        setConnecting(false);
      }
    },
    [language],
  );

  useEffect(() => {
    if (autoConnectRef.current) return undefined;
    autoConnectRef.current = true;
    const timer = window.setTimeout(() => {
      if (settings.host) void connect(settings, false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [connect, settings]);

  useEffect(() => {
    if (!connected) return undefined;
    const timer = window.setInterval(() => void refreshSensors(false), 12_000);
    return () => window.clearInterval(timer);
  }, [connected, refreshSensors]);

  const sendCommand = useCallback(
    async (
      command: string,
      phrase = 'web interface',
      quiet = false,
    ): Promise<CommandResponse | null> => {
      if (!connected) {
        setConnectionOpen(true);
        if (!quiet) {
          setNotice({
            message: tr(language, 'Сначала подключитесь к Пайдогу', 'Connect to PiDog first'),
            severity: 'info',
          });
        }
        return null;
      }
      if (!quiet) setBusyCommand(command);
      try {
        const response = await pidogApi.command(settings, command, phrase);
        if (command === 'camera_on') {
          setStreaming(true);
          setStreamNonce((value) => value + 1);
          addVisionEntry(
            tr(language, 'Камера', 'Camera'),
            response.message ?? 'Stream started',
            true,
          );
        } else if (command === 'camera_off') {
          setStreaming(false);
          addVisionEntry(
            tr(language, 'Камера', 'Camera'),
            response.message ?? 'Stream stopped',
            true,
          );
        } else if (colorCommands.includes(command)) {
          const found = response.found === true;
          const position = typeof response.position === 'string' ? response.position : '';
          const distance =
            typeof response.distance_cm === 'number'
              ? ` · ${response.distance_cm.toFixed(1)} cm`
              : '';
          addVisionEntry(
            actionLabel(command, language),
            `${response.message ?? (found ? 'Found' : 'Not found')}${position ? ` · ${position}` : ''}${distance}`,
            found,
          );
        }
        if (!quiet) {
          setNotice({
            message: response.message ?? `${actionLabel(command, language)} — OK`,
            severity: 'success',
          });
        }
        if (['show_battery', 'measure_distance', 'camera_on', 'camera_off'].includes(command)) {
          void refreshSensors(false);
        }
        return response;
      } catch (error) {
        if (!quiet) setNotice({ message: errorMessage(error), severity: 'error' });
        if (colorCommands.includes(command))
          addVisionEntry(actionLabel(command, language), errorMessage(error), false);
        return null;
      } finally {
        if (!quiet) setBusyCommand(null);
      }
    },
    [addVisionEntry, connected, language, refreshSensors, settings],
  );

  const sendMotion = useCallback(
    (command: string) => {
      if (activeMotionRef.current === command) return;
      activeMotionRef.current = command === 'stop' ? null : command;
      void sendCommand(command, 'web joystick', true);
    },
    [sendCommand],
  );

  const moveJoystick = useCallback(
    (axis: Axis, direction: Direction) => {
      movementRef.current[axis] = direction;
      if (direction !== 0) movementRef.current.last = axis;
      const current = movementRef.current;
      const primaryAxis =
        current[current.last] !== 0 ? current.last : current.last === 'drive' ? 'turn' : 'drive';
      const value = current[primaryAxis];
      const command =
        value === 0
          ? 'stop'
          : primaryAxis === 'drive'
            ? value < 0
              ? 'drive_forward'
              : 'drive_backward'
            : value < 0
              ? 'drive_left'
              : 'drive_right';
      sendMotion(command);
    },
    [sendMotion],
  );

  const moveHead = useCallback(
    (x: number, y: number) => {
      if (!connected) return;
      pendingHeadRef.current = {
        // Positive PiDog yaw points left; positive pitch points up.
        yaw: Math.round(-x * 80),
        pitch: Math.round(-y * 30),
      };
      if (headRequestInFlightRef.current) return;
      headRequestInFlightRef.current = true;
      void (async () => {
        try {
          while (pendingHeadRef.current) {
            const target = pendingHeadRef.current;
            pendingHeadRef.current = null;
            // Motion updates must stay ordered; the loop coalesces intermediate pointer positions.
            // eslint-disable-next-line no-await-in-loop
            await pidogApi.head(settings, target.yaw, target.pitch);
          }
        } catch (error) {
          pendingHeadRef.current = null;
          setNotice({ message: errorMessage(error), severity: 'error' });
        } finally {
          headRequestInFlightRef.current = false;
        }
      })();
    },
    [connected, settings],
  );

  const emergencyStop = useCallback(() => {
    movementRef.current = { drive: 0, turn: 0, last: 'drive' };
    activeMotionRef.current = null;
    moveHead(0, 0);
    void sendCommand('stop');
  }, [moveHead, sendCommand]);

  useEffect(() => {
    if (page === 'cockpit') return;
    if (activeMotionRef.current) emergencyStop();
    else moveHead(0, 0);
  }, [emergencyStop, moveHead, page]);

  const refreshAssistant = useCallback(
    async (announce = false) => {
      if (!connected) return;
      try {
        const response = await pidogApi.assistantStatus(settings);
        setAssistantStatus(response.assistant);
        if (announce)
          setNotice({
            message: tr(language, 'Состояние LLM обновлено', 'LLM status updated'),
            severity: 'success',
          });
      } catch (error) {
        if (announce) setNotice({ message: errorMessage(error), severity: 'error' });
      }
    },
    [connected, language, settings],
  );

  const controlAssistant = useCallback(
    async (action: 'start' | 'stop' | 'restart') => {
      if (!connected) {
        setConnectionOpen(true);
        return;
      }
      setAssistantBusy(true);
      try {
        const response = await pidogApi.assistantControl(settings, action);
        setAssistantStatus(response.assistant);
        setNotice({ message: response.message ?? action, severity: 'success' });
      } catch (error) {
        setNotice({ message: errorMessage(error), severity: 'error' });
      } finally {
        setAssistantBusy(false);
      }
    },
    [connected, settings],
  );

  const askAssistant = useCallback(
    async (questionOverride?: string) => {
      const question = (questionOverride ?? assistantQuestion).trim();
      if (!question) return;
      if (!connected) {
        setConnectionOpen(true);
        return;
      }
      setAssistantQuestion(question);
      setAssistantBusy(true);
      try {
        const reply = await pidogApi.assistantChat(
          settings,
          question,
          assistantSearch,
          assistantSpeak,
        );
        setAssistantReply(reply);
        void refreshAssistant(false);
      } catch (error) {
        setNotice({ message: errorMessage(error), severity: 'error' });
      } finally {
        setAssistantBusy(false);
      }
    },
    [assistantQuestion, assistantSearch, assistantSpeak, connected, refreshAssistant, settings],
  );

  const clearAssistant = useCallback(async () => {
    if (!connected) return;
    setAssistantBusy(true);
    try {
      const response = await pidogApi.clearAssistantHistory(settings);
      setAssistantReply(null);
      setAssistantQuestion('');
      setNotice({
        message: response.message ?? tr(language, 'История очищена', 'History cleared'),
        severity: 'success',
      });
    } catch (error) {
      setNotice({ message: errorMessage(error), severity: 'error' });
    } finally {
      setAssistantBusy(false);
    }
  }, [connected, language, settings]);

  const speech = useSpeechRecognition({
    languageTag: language === 'en' ? 'en-US' : 'ru-RU',
    onInterim: setRecognized,
    onFinal: (hypotheses) => {
      const first = hypotheses[0] ?? '';
      setRecognized(first);
      if (speechTargetRef.current === 'assistant') {
        setAssistantQuestion(first);
        void askAssistant(first);
        return;
      }
      const match = matchVoiceCommand(hypotheses, language);
      setVoiceMatch(match);
      if (match) void sendCommand(match.command, match.sourcePhrase);
      else {
        setNotice({
          message: tr(
            language,
            'Команда не распознана — ничего не отправлено',
            'Command not recognized — nothing was sent',
          ),
          severity: 'warning',
        });
      }
    },
    onError: (message) => setNotice({ message, severity: 'error' }),
  });

  const startSpeech = (target: SpeechTarget) => {
    speechTargetRef.current = target;
    setSpeechTarget(target);
    setRecognized('');
    if (target === 'command') setVoiceMatch(null);
    if (speech.listening) speech.stop();
    else speech.start();
  };

  const changeLanguage = (next: Language) => {
    localStorage.setItem(languageKey, next);
    setLanguage(next);
  };

  const saveConnection = async () => {
    const endpoint: ConnectionSettings = {
      host: normalizeHost(draftSettings.host),
      port: draftSettings.port,
      token: draftSettings.token,
    };
    if (!endpoint.host || endpoint.port < 1 || endpoint.port > 65_535) {
      setNotice({
        message: tr(language, 'Проверьте адрес и порт', 'Check the address and port'),
        severity: 'error',
      });
      return;
    }
    if (await connect(endpoint)) setConnectionOpen(false);
  };

  const pageTitle = pages.find((item) => item.id === page);
  const content =
    page === 'cockpit' ? (
      <Cockpit
        language={language}
        connected={connected}
        health={health}
        sensors={sensors}
        streaming={streaming}
        streamNonce={streamNonce}
        settings={settings}
        busyCommand={busyCommand}
        visionLog={visionLog}
        onCommand={(command) => void sendCommand(command)}
        onMove={moveJoystick}
        onHead={moveHead}
        onStop={emergencyStop}
        onRefreshStream={() => setStreamNonce((value) => value + 1)}
        onClearLog={() => setVisionLog([])}
      />
    ) : page === 'voice' ? (
      <VoicePage
        language={language}
        supported={speech.supported}
        listening={speech.listening}
        recognized={recognized}
        match={voiceMatch}
        connected={connected}
        busyCommand={busyCommand}
        onToggleSpeech={() => startSpeech('command')}
        onCommand={(command) => void sendCommand(command)}
      />
    ) : page === 'commands' ? (
      <CommandsPage
        language={language}
        busyCommand={busyCommand}
        onCommand={(command) => void sendCommand(command)}
      />
    ) : page === 'sensors' ? (
      <SensorsPage
        language={language}
        sensors={sensors}
        history={sensorHistory}
        connected={connected}
        onRefresh={() => void refreshSensors(true)}
        onCommand={(command) => void sendCommand(command)}
      />
    ) : (
      <AssistantPage
        language={language}
        status={assistantStatus}
        connected={connected}
        busy={assistantBusy}
        question={assistantQuestion}
        reply={assistantReply}
        search={assistantSearch}
        speak={assistantSpeak}
        speechSupported={speech.supported}
        speechListening={speech.listening && speechTarget === 'assistant'}
        onQuestion={setAssistantQuestion}
        onSearch={setAssistantSearch}
        onSpeak={setAssistantSpeak}
        onAsk={() => void askAssistant()}
        onSpeech={() => startSpeech('assistant')}
        onRefresh={() => void refreshAssistant(true)}
        onControl={(action) => void controlAssistant(action)}
        onClear={() => void clearAssistant()}
      />
    );

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex' }}>
      {!small && (
        <NavigationRail page={page} language={language} connected={connected} onPage={setPage} />
      )}
      <Box sx={{ width: '100%', minWidth: 0, ml: small ? 0 : '92px', pb: small ? 10 : 3 }}>
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
                    ? `${tr(language, 'На связи', 'Online')} · API ${health?.version ?? ''}${health?.dry_run ? ' · DRY RUN' : ''}`
                    : tr(language, 'Нет подключения', 'Offline')}
                </Typography>
              </Stack>
            </Box>
          </Stack>
          <Stack direction="row" sx={{ alignItems: 'center', gap: 0.8 }}>
            <Select
              size="small"
              value={language}
              onChange={(event) => changeLanguage(event.target.value)}
              aria-label="Language"
              sx={{ minWidth: 76, '& .MuiSelect-select': { py: 0.8 } }}
            >
              <MenuItem value="ru">RU</MenuItem>
              <MenuItem value="en">EN</MenuItem>
            </Select>
            <Tooltip title={tr(language, 'Подключение', 'Connection')}>
              <IconButton
                aria-label={tr(language, 'Настроить подключение', 'Configure connection')}
                onClick={() => {
                  setDraftSettings(settings);
                  setConnectionOpen(true);
                }}
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
                  onClick={emergencyStop}
                >
                  <EmergencyRounded />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        </Paper>

        <Box
          component="main"
          sx={{ width: 'min(1800px, 100%)', mx: 'auto', p: { xs: 1.5, sm: 2.5, xl: 3 } }}
        >
          {content}
        </Box>
      </Box>

      {small && (
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
                  onClick={() => setPage(id)}
                >
                  <Icon />
                </IconButton>
              </Tooltip>
            ))}
          </Stack>
        </Paper>
      )}

      <ConnectionDialog
        language={language}
        open={connectionOpen}
        value={draftSettings}
        connecting={connecting}
        onChange={setDraftSettings}
        onClose={() => setConnectionOpen(false)}
        onSave={() => void saveConnection()}
      />

      <Snackbar
        open={notice !== null}
        autoHideDuration={4500}
        onClose={() => setNotice(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={notice?.severity ?? 'info'}
          variant="filled"
          onClose={() => setNotice(null)}
          sx={{ minWidth: { sm: 360 } }}
        >
          {notice?.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

function NavigationRail({
  page,
  language,
  connected,
  onPage,
}: {
  page: Page;
  language: Language;
  connected: boolean;
  onPage: (page: Page) => void;
}) {
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
      <Avatar
        src={mascot}
        alt="PiDog"
        variant="rounded"
        sx={{
          width: 54,
          height: 54,
          borderRadius: 2.5,
          border: '1px solid',
          borderColor: 'divider',
          mb: 2,
        }}
      />
      <List disablePadding sx={{ width: '100%', px: 1 }}>
        {pages.map(({ id, ru, en, icon: Icon }) => (
          <Tooltip key={id} title={tr(language, ru, en)} placement="right">
            <ListItemButton
              selected={page === id}
              onClick={() => onPage(id)}
              sx={{
                borderRadius: 2.5,
                mb: 0.6,
                minHeight: 54,
                justifyContent: 'center',
                '&.Mui-selected': { bgcolor: alpha('#18d5ff', 0.12), color: 'primary.light' },
              }}
            >
              <ListItemIcon sx={{ minWidth: 0, color: 'inherit', justifyContent: 'center' }}>
                <Icon />
              </ListItemIcon>
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
  );
}

interface CockpitProps {
  language: Language;
  connected: boolean;
  health: HealthResponse | null;
  sensors: SensorsResponse | null;
  streaming: boolean;
  streamNonce: number;
  settings: ConnectionSettings;
  busyCommand: string | null;
  visionLog: VisionEntry[];
  onCommand: (command: string) => void;
  onMove: (axis: Axis, direction: Direction) => void;
  onHead: (x: number, y: number) => void;
  onStop: () => void;
  onRefreshStream: () => void;
  onClearLog: () => void;
}

function Cockpit({
  language,
  connected,
  sensors,
  streaming,
  streamNonce,
  settings,
  busyCommand,
  visionLog,
  onCommand,
  onMove,
  onHead,
  onStop,
  onRefreshStream,
  onClearLog,
}: CockpitProps) {
  const cameraRef = useRef<HTMLDivElement | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const host = normalizeHost(settings.host);
  const cameraUrl = buildCameraStreamUrl(settings, streamNonce);
  const toggleFullscreen = async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await cameraRef.current?.requestFullscreen();
  };

  useEffect(() => {
    const listener = () => setFullscreen(document.fullscreenElement !== null);
    document.addEventListener('fullscreenchange', listener);
    return () => document.removeEventListener('fullscreenchange', listener);
  }, []);

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1fr) 360px' },
        gap: 2,
      }}
    >
      <Stack sx={{ gap: 2, minWidth: 0 }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'minmax(0, 1fr)',
              md: 'clamp(360px, 32vw, 480px) minmax(0, 1fr)',
            },
            gap: 1.5,
            alignItems: 'start',
          }}
        >
          <Card
            ref={cameraRef}
            sx={{
              width: { xs: '100%', md: 'clamp(360px, 32vw, 480px)' },
              maxWidth: '100%',
              alignSelf: 'flex-start',
              overflow: 'hidden',
              bgcolor: '#01050a',
              '&:fullscreen': { width: '100vw', height: '100vh', borderRadius: 0 },
              '&:fullscreen .pidog-camera-viewport': {
                width: '100vw',
                height: '100vh',
                aspectRatio: 'auto',
              },
              '&:fullscreen .pidog-camera-footer': { display: 'none' },
            }}
          >
            <Box
              className="pidog-camera-viewport"
              sx={{
                width: '100%',
                aspectRatio: '1 / 1',
                position: 'relative',
                display: 'grid',
                placeItems: 'center',
                bgcolor: '#01050a',
              }}
            >
              {streaming && connected ? (
                <Box
                  component="img"
                  key={streamNonce}
                  src={cameraUrl}
                  alt={tr(language, 'Живой видеопоток камеры Пайдога', 'PiDog live camera stream')}
                  sx={{
                    display: 'block',
                    width: '100%',
                    height: '100%',
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain',
                    objectPosition: 'center',
                  }}
                />
              ) : (
                <Stack sx={{ alignItems: 'center', gap: 1.5, color: 'text.secondary' }}>
                  <VideocamOffRounded sx={{ fontSize: 62 }} />
                  <Typography>{tr(language, 'Камера выключена', 'Camera is off')}</Typography>
                  <Button
                    variant="contained"
                    startIcon={<CameraAltRounded />}
                    disabled={!connected || busyCommand !== null}
                    onClick={() => onCommand('camera_on')}
                  >
                    {tr(language, 'Запустить поток', 'Start stream')}
                  </Button>
                </Stack>
              )}
              <Stack
                direction="row"
                sx={{
                  position: 'absolute',
                  top: 14,
                  left: 14,
                  right: 14,
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  pointerEvents: 'none',
                }}
              >
                <Chip
                  label={streaming ? `LIVE · ${host}` : 'OFFLINE'}
                  size="small"
                  color={streaming ? 'error' : 'default'}
                  sx={{ fontWeight: 800, letterSpacing: '.08em' }}
                />
                <Stack direction="row" sx={{ gap: 0.6, pointerEvents: 'auto' }}>
                  <Tooltip title={tr(language, 'Обновить поток', 'Refresh stream')}>
                    <span>
                      <IconButton
                        size="small"
                        disabled={!streaming}
                        onClick={onRefreshStream}
                        sx={{
                          bgcolor: alpha('#000', 0.55),
                          '&:hover': { bgcolor: alpha('#000', 0.75) },
                        }}
                      >
                        <RefreshRounded />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title={tr(language, 'На весь экран', 'Fullscreen')}>
                    <IconButton
                      size="small"
                      onClick={() => void toggleFullscreen()}
                      sx={{
                        bgcolor: alpha('#000', 0.55),
                        '&:hover': { bgcolor: alpha('#000', 0.75) },
                      }}
                    >
                      {fullscreen ? <CloseFullscreenRounded /> : <ExpandRounded />}
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Stack>
            </Box>
            <CardContent className="pidog-camera-footer" sx={{ py: 1.4, px: 2 }}>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between', gap: 1 }}
              >
                <Typography variant="body2" color="text.secondary">
                  {tr(
                    language,
                    'Прямой MJPEG-поток внутри локальной сети',
                    'Live MJPEG stream on the local network',
                  )}
                </Typography>
                <Stack direction="row" sx={{ gap: 0.8 }}>
                  <Button
                    size="small"
                    startIcon={<CameraAltRounded />}
                    disabled={!connected || streaming}
                    onClick={() => onCommand('camera_on')}
                  >
                    {tr(language, 'Включить', 'Start')}
                  </Button>
                  <Button
                    size="small"
                    color="error"
                    startIcon={<VideocamOffRounded />}
                    disabled={!connected || !streaming}
                    onClick={() => onCommand('camera_off')}
                  >
                    {tr(language, 'Выключить', 'Stop')}
                  </Button>
                </Stack>
              </Stack>
            </CardContent>
          </Card>

          <Stack sx={{ gap: 1.5, minWidth: 0 }}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
                gap: 1.2,
              }}
            >
              <Card>
                <CardContent sx={{ p: 1.6 }}>
                  <Joystick
                    axis="vertical"
                    label={tr(language, 'ХОД', 'DRIVE')}
                    negativeLabel={tr(language, 'Вперёд', 'Forward')}
                    positiveLabel={tr(language, 'Назад', 'Back')}
                    disabled={!connected}
                    onDirectionChange={(direction) => onMove('drive', direction)}
                  />
                </CardContent>
              </Card>
              <Card>
                <CardContent sx={{ p: 1.6 }}>
                  <Joystick
                    axis="horizontal"
                    label={tr(language, 'ПОВОРОТ', 'TURN')}
                    negativeLabel={tr(language, 'Налево', 'Left')}
                    positiveLabel={tr(language, 'Направо', 'Right')}
                    disabled={!connected}
                    onDirectionChange={(direction) => onMove('turn', direction)}
                  />
                </CardContent>
              </Card>
              <Card>
                <CardContent sx={{ p: 1.6 }}>
                  <HeadJoystick
                    label={tr(language, 'ГОЛОВА', 'HEAD')}
                    upLabel={tr(language, 'Вверх', 'Up')}
                    downLabel={tr(language, 'Вниз', 'Down')}
                    leftLabel={tr(language, 'Лево', 'Left')}
                    rightLabel={tr(language, 'Право', 'Right')}
                    disabled={!connected}
                    onPositionChange={onHead}
                  />
                </CardContent>
              </Card>
            </Box>
            <Card>
              <CardContent
                sx={{ p: 1.6, height: '100%', display: 'flex', flexDirection: 'column' }}
              >
                <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 800 }}>
                  {tr(language, 'БЫСТРЫЕ ПОЗЫ', 'QUICK POSES')}
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.8, mt: 1 }}>
                  <Button
                    variant="outlined"
                    disabled={!connected}
                    onClick={() => onCommand('stand')}
                  >
                    {tr(language, 'Встать', 'Stand')}
                  </Button>
                  <Button variant="outlined" disabled={!connected} onClick={() => onCommand('sit')}>
                    {tr(language, 'Сесть', 'Sit')}
                  </Button>
                  <Button
                    variant="outlined"
                    disabled={!connected}
                    onClick={() => onCommand('bark')}
                  >
                    {tr(language, 'Голос', 'Bark')}
                  </Button>
                  <Button
                    variant="outlined"
                    disabled={!connected}
                    onClick={() => onCommand('wag_tail')}
                  >
                    {tr(language, 'Хвост', 'Tail')}
                  </Button>
                </Box>
                <Button
                  color="error"
                  variant="contained"
                  startIcon={<EmergencyRounded />}
                  disabled={!connected}
                  onClick={onStop}
                  sx={{ mt: 1, flex: 1 }}
                >
                  {tr(language, 'АВАРИЙНЫЙ STOP', 'EMERGENCY STOP')}
                </Button>
              </CardContent>
            </Card>
          </Stack>
        </Box>
      </Stack>

      <Stack sx={{ gap: 1.5, minWidth: 0 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
          <CompactMetric
            icon={<BatteryChargingFullRounded />}
            label={tr(language, 'Батарея', 'Battery')}
            value={sensors?.battery_percent == null ? '—' : `${sensors.battery_percent}%`}
            color="#45e6a4"
          />
          <CompactMetric
            icon={<SensorsRounded />}
            label={tr(language, 'Дистанция', 'Distance')}
            value={sensors?.distance_cm == null ? '—' : `${sensors.distance_cm} cm`}
            color="#18d5ff"
          />
          <CompactMetric
            icon={<GraphicEqRounded />}
            label={tr(language, 'Звук', 'Sound')}
            value={
              sensors?.sound_detected
                ? `${sensors.sound_direction ?? 0}°`
                : tr(language, 'Тихо', 'Quiet')
            }
            color="#b58cff"
          />
          <CompactMetric
            icon={<BoltRounded />}
            label={tr(language, 'Питание', 'Power')}
            value={
              sensors?.external_power
                ? tr(language, 'Сеть', 'External')
                : sensors
                  ? tr(language, 'Батарея', 'Battery')
                  : '—'
            }
            color="#ffbe55"
          />
        </Box>

        <Card sx={{ width: '100%', maxWidth: 460, alignSelf: 'flex-start' }}>
          <CardContent sx={{ p: 1.6 }}>
            <Stack
              direction="row"
              sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1.2 }}
            >
              <Box>
                <Typography variant="h3">{tr(language, 'Поиск цвета', 'Color search')}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {tr(language, 'Пайдог наведётся и укажет лапой', 'PiDog aims and points')}
                </Typography>
              </Box>
              <SearchRounded color="action" />
            </Stack>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8 }}>
              {colorCommands.map((command) => {
                const item = findAction(command);
                return (
                  <Tooltip
                    key={command}
                    title={item ? (language === 'en' ? item.englishLabel : item.label) : command}
                  >
                    <span>
                      <Button
                        aria-label={item?.label ?? command}
                        disabled={!connected || busyCommand !== null}
                        onClick={() => onCommand(command)}
                        sx={{
                          width: 44,
                          minWidth: 44,
                          height: 44,
                          p: 0,
                          bgcolor: item ? alpha(item.color, 0.12) : undefined,
                          border: '1px solid',
                          borderColor: item ? alpha(item.color, 0.42) : 'divider',
                          '&:hover': { bgcolor: item ? alpha(item.color, 0.22) : undefined },
                        }}
                      >
                        <Box
                          sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: item?.color }}
                        />
                      </Button>
                    </span>
                  </Tooltip>
                );
              })}
            </Box>
            <Stack direction="row" sx={{ gap: 0.8, mt: 1, flexWrap: 'wrap' }}>
              <Button
                size="small"
                variant="outlined"
                disabled={!connected}
                onClick={() => onCommand('follow_face')}
                sx={{ minWidth: 116 }}
              >
                {tr(language, 'Лицо', 'Face')}
              </Button>
              <Button
                size="small"
                variant="outlined"
                disabled={!connected}
                onClick={() => onCommand('follow_object')}
                sx={{ minWidth: 116 }}
              >
                {tr(language, 'Предмет', 'Object')}
              </Button>
            </Stack>
          </CardContent>
        </Card>

        <Card sx={{ flex: 1, minHeight: 250 }}>
          <CardContent sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography variant="h3">{tr(language, 'Журнал зрения', 'Vision log')}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {tr(language, 'Последние 10 событий', 'Last 10 events')}
                </Typography>
              </Box>
              <Tooltip title={tr(language, 'Очистить', 'Clear')}>
                <span>
                  <IconButton size="small" disabled={visionLog.length === 0} onClick={onClearLog}>
                    <ClearAllRounded />
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
            <Divider sx={{ my: 1.5 }} />
            {visionLog.length === 0 ? (
              <Stack
                sx={{
                  alignItems: 'center',
                  justifyContent: 'center',
                  flex: 1,
                  color: 'text.secondary',
                  py: 3,
                }}
              >
                <MoreHorizRounded />
                <Typography variant="body2">
                  {tr(language, 'Событий пока нет', 'No events yet')}
                </Typography>
              </Stack>
            ) : (
              <Stack sx={{ gap: 1.2, overflow: 'auto', maxHeight: 360 }}>
                {visionLog.map((entry) => (
                  <Box key={entry.id}>
                    <Stack direction="row" sx={{ gap: 1, alignItems: 'flex-start' }}>
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          mt: 0.65,
                          flex: '0 0 auto',
                          borderRadius: '50%',
                          bgcolor: entry.success ? 'success.main' : 'error.main',
                        }}
                      />
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {entry.title}{' '}
                          <Typography component="span" variant="caption" color="text.secondary">
                            · {entry.time}
                          </Typography>
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: 'block', mt: 0.25 }}
                        >
                          {entry.detail}
                        </Typography>
                      </Box>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            )}
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}

function CompactMetric({
  icon,
  label,
  value,
  color,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <Card>
      <CardContent sx={{ p: 1.5 }}>
        <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
          <Avatar sx={{ width: 34, height: 34, bgcolor: alpha(color, 0.12), color }}>{icon}</Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="caption" color="text.secondary" noWrap>
              {label.toUpperCase()}
            </Typography>
            <Typography sx={{ fontWeight: 800, lineHeight: 1.15 }} noWrap>
              {value}
            </Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

function VoicePage({
  language,
  supported,
  listening,
  recognized,
  match,
  connected,
  busyCommand,
  onToggleSpeech,
  onCommand,
}: {
  language: Language;
  supported: boolean;
  listening: boolean;
  recognized: string;
  match: VoiceMatch | null;
  connected: boolean;
  busyCommand: string | null;
  onToggleSpeech: () => void;
  onCommand: (command: string) => void;
}) {
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
                '&:hover': { bgcolor: listening ? alpha('#ff5a6b', 0.24) : alpha('#18d5ff', 0.2) },
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
  );
}

function CommandsPage({
  language,
  busyCommand,
  onCommand,
}: {
  language: Language;
  busyCommand: string | null;
  onCommand: (command: string) => void;
}) {
  const [group, setGroup] = useState(actionGroups[0]?.id ?? 'movement');
  const [query, setQuery] = useState('');
  const actions = useMemo(() => {
    if (query.trim()) {
      const needle = query.toLocaleLowerCase();
      return allActions.filter((item) =>
        [item.label, item.englishLabel, item.command].some((value) =>
          value.toLocaleLowerCase().includes(needle),
        ),
      );
    }
    return actionGroups.find((item) => item.id === group)?.actions ?? [];
  }, [group, query]);
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
  );
}

function SensorsPage({
  language,
  sensors,
  history,
  connected,
  onRefresh,
  onCommand,
}: {
  language: Language;
  sensors: SensorsResponse | null;
  history: number[];
  connected: boolean;
  onRefresh: () => void;
  onCommand: (command: string) => void;
}) {
  const maxHistory = Math.max(60, ...history);
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
                  // oxlint-disable-next-line react/no-array-index-key -- ordered sensor samples have no domain id
                  <Tooltip key={`${index}-${value}`} title={`${value} cm`}>
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
  );
}

function SensorMetric({
  icon,
  title,
  value,
  detail,
  color,
  progress,
}: {
  icon: ReactNode;
  title: string;
  value: string;
  detail: string;
  color: string;
  progress?: number;
}) {
  return (
    <Card>
      <CardContent sx={{ p: 2.4 }}>
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Avatar sx={{ bgcolor: alpha(color, 0.12), color }}>{icon}</Avatar>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>
            {title.toUpperCase()}
          </Typography>
        </Stack>
        <Typography sx={{ mt: 2, fontSize: { xs: '1.5rem', sm: '1.9rem' }, fontWeight: 800 }}>
          {value}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {detail}
        </Typography>
        {progress != null && (
          <LinearProgress
            variant="determinate"
            value={progress}
            color={progress < 20 ? 'error' : 'success'}
            sx={{ mt: 1.5, height: 5, borderRadius: 2 }}
          />
        )}
      </CardContent>
    </Card>
  );
}

function AssistantPage({
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
}: {
  language: Language;
  status: AssistantStatus | null;
  connected: boolean;
  busy: boolean;
  question: string;
  reply: ChatResponse | null;
  search: boolean;
  speak: boolean;
  speechSupported: boolean;
  speechListening: boolean;
  onQuestion: (value: string) => void;
  onSearch: (value: boolean) => void;
  onSpeak: (value: boolean) => void;
  onAsk: () => void;
  onSpeech: () => void;
  onRefresh: () => void;
  onControl: (action: 'start' | 'stop' | 'restart') => void;
  onClear: () => void;
}) {
  const running = status?.running === true;
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
              event.preventDefault();
              onAsk();
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
  );
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
  );
}

function PageHeading({
  language,
  eyebrow,
  titleRu,
  titleEn,
  descriptionRu,
  descriptionEn,
}: {
  language: Language;
  eyebrow: string;
  titleRu: string;
  titleEn: string;
  descriptionRu: string;
  descriptionEn: string;
}) {
  return (
    <Box>
      <Typography
        variant="overline"
        color="primary.main"
        sx={{ fontWeight: 800, letterSpacing: '.12em' }}
      >
        {eyebrow}
      </Typography>
      <Typography variant="h2" sx={{ mt: 0.2 }}>
        {tr(language, titleRu, titleEn)}
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 0.6, maxWidth: 780, lineHeight: 1.55 }}>
        {tr(language, descriptionRu, descriptionEn)}
      </Typography>
    </Box>
  );
}

function ConnectionDialog({
  language,
  open,
  value,
  connecting,
  onChange,
  onClose,
  onSave,
}: {
  language: Language;
  open: boolean;
  value: ConnectionSettings;
  connecting: boolean;
  onChange: (value: ConnectionSettings) => void;
  onClose: () => void;
  onSave: () => void;
}) {
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
  );
}

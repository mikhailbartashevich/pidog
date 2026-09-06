import { Navigate, Route, Routes } from 'react-router'

import type {
  AiVisionPageProps,
  AiVisionCommandsPageProps,
  AssistantPageProps,
  CockpitProps,
  SensorsPageProps,
  VoicePageProps,
} from '../types/ui'
import { AiVisionCommandsPage } from './pages/AiVisionCommandsPage'
import { AiVisionPage } from './pages/AiVisionPage'
import { AssistantPage } from './pages/AssistantPage'
import { CockpitPage } from './pages/CockpitPage'
import { CommandsPage } from './pages/CommandsPage'
import { SensorsPage } from './pages/SensorsPage'
import { VoicePage } from './pages/VoicePage'

type CommandsRouteProps = {
  language: 'ru' | 'en'
  busyCommand: string | null
  onCommand: (command: string) => void
}

type ControlStationRoutesProps = {
  cockpit: CockpitProps
  vision: AiVisionPageProps
  visionCommands: AiVisionCommandsPageProps
  voice: VoicePageProps
  commands: CommandsRouteProps
  sensors: SensorsPageProps
  assistant: AssistantPageProps
}

export function ControlStationRoutes({
  cockpit,
  vision,
  visionCommands,
  voice,
  commands,
  sensors,
  assistant,
}: ControlStationRoutesProps) {
  return (
    <Routes>
      <Route path="/" element={<CockpitPage {...cockpit} />} />
      <Route path="/ai-vision" element={<AiVisionPage {...vision} />} />
      <Route path="/ai-commands" element={<AiVisionCommandsPage {...visionCommands} />} />
      <Route path="/voice" element={<VoicePage {...voice} />} />
      <Route path="/commands" element={<CommandsPage {...commands} />} />
      <Route path="/sensors" element={<SensorsPage {...sensors} />} />
      <Route path="/llm" element={<AssistantPage {...assistant} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

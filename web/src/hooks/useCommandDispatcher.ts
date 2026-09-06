import { useCallback } from 'react'

import type { PiDogStatusKind } from '../components/layout/PiDogStatus'
import { pidogApi, type CommandResponse, type ConnectionSettings } from '../lib/api'
import { actionLabel, type Language } from '../lib/commands'
import { errorMessage, tr } from '../lib/i18n'
import { colorCommands } from '../lib/vision'
import type { Notice } from '../types/ui'

type Options = {
  connected: boolean
  settings: ConnectionSettings
  language: Language
  onConnectionNeeded: () => void
  onBusyCommand: (command: string | null) => void
  onNotice: (notice: Notice) => void
  onStreaming: (streaming: boolean) => void
  onStreamRefresh: () => void
  onVisionEntry: (title: string, detail: string, success: boolean) => void
  onDisconnected: (error: unknown) => void
  refreshSensors: () => Promise<void>
  beginStatus: (kind: PiDogStatusKind, message: string) => number
  finishStatus: (request: number, kind: PiDogStatusKind, message: string) => void
  isConnectivityError: (error: unknown) => boolean
}

export function useCommandDispatcher({
  connected,
  settings,
  language,
  onConnectionNeeded,
  onBusyCommand,
  onNotice,
  onStreaming,
  onStreamRefresh,
  onVisionEntry,
  onDisconnected,
  refreshSensors,
  beginStatus,
  finishStatus,
  isConnectivityError,
}: Options) {
  return useCallback(
    async (
      command: string,
      phrase = 'web interface',
      quiet = false,
    ): Promise<CommandResponse | null> => {
      if (!connected) {
        onConnectionNeeded()
        if (!quiet)
          onNotice({
            message: tr(language, 'Сначала подключитесь к Пайдогу', 'Connect to PiDog first'),
            severity: 'info',
          })
        beginStatus(
          'error',
          tr(language, 'Сначала подключитесь к Пайдогу', 'Connect to PiDog first'),
        )
        return null
      }
      if (!quiet) onBusyCommand(command)
      const action = actionLabel(command, language)
      const statusKind: PiDogStatusKind = colorCommands.includes(command)
        ? 'searching'
        : command === 'listen_sound' || command === 'local_voice_on'
          ? 'listening'
          : 'working'
      const request = beginStatus(
        statusKind,
        tr(language, `Выполняю: ${action}`, `Running: ${action}`),
      )
      try {
        const response = await pidogApi.command(settings, command, phrase)
        if (command === 'camera_on') {
          onStreaming(true)
          onStreamRefresh()
          onVisionEntry(
            tr(language, 'Камера', 'Camera'),
            response.message ?? 'Stream started',
            true,
          )
        } else if (command === 'camera_off') {
          onStreaming(false)
          onVisionEntry(
            tr(language, 'Камера', 'Camera'),
            response.message ?? 'Stream stopped',
            true,
          )
        } else if (colorCommands.includes(command)) {
          const found = response.found === true
          const position = typeof response.position === 'string' ? ` · ${response.position}` : ''
          const distance =
            typeof response.distance_cm === 'number'
              ? ` · ${response.distance_cm.toFixed(1)} cm`
              : ''
          onVisionEntry(
            action,
            `${response.message ?? (found ? 'Found' : 'Not found')}${position}${distance}`,
            found,
          )
        }
        if (!quiet) onNotice({ message: response.message ?? `${action} — OK`, severity: 'success' })
        finishStatus(
          request,
          'success',
          response.message ?? tr(language, `${action} — готово`, `${action} — done`),
        )
        if (['show_battery', 'measure_distance', 'camera_on', 'camera_off'].includes(command))
          void refreshSensors()
        return response
      } catch (error) {
        if (isConnectivityError(error)) onDisconnected(error)
        else {
          const message = errorMessage(error)
          if (!quiet) onNotice({ message, severity: 'error' })
          finishStatus(request, 'error', message)
        }
        if (!quiet && colorCommands.includes(command))
          onVisionEntry(action, errorMessage(error), false)
        return null
      } finally {
        if (!quiet) onBusyCommand(null)
      }
    },
    [
      beginStatus,
      connected,
      finishStatus,
      isConnectivityError,
      language,
      onBusyCommand,
      onConnectionNeeded,
      onDisconnected,
      onNotice,
      onStreamRefresh,
      onStreaming,
      onVisionEntry,
      refreshSensors,
      settings,
    ],
  )
}

import { useCallback } from 'react'

import { pidogApi, type ConnectionSettings, type VisionFace, type VisionObject } from '../lib/api'
import type { Language } from '../lib/commands'
import { tr } from '../lib/i18n'
import type { Notice } from '../types/ui'

type Options = {
  connected: boolean
  language: Language
  settings: ConnectionSettings
  onNotice: (notice: Notice) => void
}

export function useVisionEnrollment({ connected, language, settings, onNotice }: Options) {
  const enrollFace = useCallback(
    async (names: string[], face: VisionFace) => {
      if (!connected)
        throw new Error(tr(language, 'Сначала подключитесь к Пайдогу', 'Connect to PiDog first'))
      const response = await pidogApi.visionEnroll(settings, names, face)
      const storedNames = response.names?.length ? response.names : [response.name]
      onNotice({
        message: tr(
          language,
          `Лицо запомнено: ${storedNames.join(', ')}`,
          `Face remembered: ${storedNames.join(', ')}`,
        ),
        severity: 'success',
      })
      return storedNames
    },
    [connected, language, onNotice, settings],
  )
  const enrollObject = useCallback(
    async (name: string, object: VisionObject) => {
      if (!connected)
        throw new Error(tr(language, 'Сначала подключитесь к Пайдогу', 'Connect to PiDog first'))
      const response = await pidogApi.visionObjectEnroll(settings, name, object)
      onNotice({
        message: tr(
          language,
          `Предмет запомнен: ${response.name}`,
          `Object remembered: ${response.name}`,
        ),
        severity: 'success',
      })
      return response.name
    },
    [connected, language, onNotice, settings],
  )
  return { enrollFace, enrollObject }
}

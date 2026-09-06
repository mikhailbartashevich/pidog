import { useState } from 'react'

import type { PiDogStatusKind } from '../components/layout/PiDogStatus'
import {
  pidogApi,
  type AssistantStatus,
  type ChatResponse,
  type ConnectionSettings,
} from '../lib/api'
import type { Language } from '../lib/commands'
import { errorMessage, tr } from '../lib/i18n'

type Options = {
  connected: boolean
  settings: ConnectionSettings
  language: Language
  refresh: () => Promise<void>
  beginStatus: (kind: PiDogStatusKind, message: string) => number
  finishStatus: (request: number, kind: PiDogStatusKind, message: string) => void
  onDisconnected: (error: unknown) => void
  onConnectionNeeded: () => void
  onNotice: (message: string, severity: 'success' | 'error') => void
  onStatus: (status: AssistantStatus) => void
  isConnectivityError: (error: unknown) => boolean
}

export function useAssistantController(options: Options) {
  const [status, setStatus] = useState<AssistantStatus | null>(null)
  const [question, setQuestion] = useState('')
  const [reply, setReply] = useState<ChatResponse | null>(null)
  const [search, setSearch] = useState(true)
  const [speak, setSpeak] = useState(false)
  const [busy, setBusy] = useState(false)
  const missingConnection = () => {
    options.onConnectionNeeded()
    options.beginStatus(
      'error',
      tr(options.language, 'Сначала подключитесь к Пайдогу', 'Connect to PiDog first'),
    )
  }
  const handleError = (request: number, error: unknown) => {
    if (options.isConnectivityError(error)) options.onDisconnected(error)
    else {
      const message = errorMessage(error)
      options.onNotice(message, 'error')
      options.finishStatus(request, 'error', message)
    }
  }
  const control = async (action: 'start' | 'stop' | 'restart') => {
    if (!options.connected) return missingConnection()
    setBusy(true)
    const request = options.beginStatus(
      'working',
      tr(options.language, 'Управляю локальной LLM…', 'Managing local LLM…'),
    )
    try {
      const response = await pidogApi.assistantControl(options.settings, action)
      setStatus(response.assistant)
      options.onStatus(response.assistant)
      const message = response.message ?? action
      options.onNotice(message, 'success')
      options.finishStatus(request, 'success', message)
    } catch (error) {
      handleError(request, error)
    } finally {
      setBusy(false)
    }
  }
  const ask = async (override?: string) => {
    const nextQuestion = (override ?? question).trim()
    if (!nextQuestion) return
    if (!options.connected) return missingConnection()
    setQuestion(nextQuestion)
    setBusy(true)
    const request = options.beginStatus(
      search ? 'searching' : 'thinking',
      search
        ? tr(options.language, 'Ищу и думаю над ответом…', 'Searching and thinking…')
        : tr(options.language, 'Думаю над ответом…', 'Thinking about the answer…'),
    )
    try {
      const nextReply = await pidogApi.assistantChat(options.settings, nextQuestion, search, speak)
      setReply(nextReply)
      void options.refresh()
      options.finishStatus(
        request,
        nextReply.spoken ? 'speaking' : 'success',
        nextReply.spoken
          ? tr(options.language, 'Отвечаю через динамик Пайдога', 'Answering through PiDog speaker')
          : tr(options.language, 'Ответ готов', 'Answer ready'),
      )
    } catch (error) {
      handleError(request, error)
    } finally {
      setBusy(false)
    }
  }
  const clear = async () => {
    if (!options.connected) return
    setBusy(true)
    const request = options.beginStatus(
      'working',
      tr(options.language, 'Очищаю историю диалога…', 'Clearing conversation history…'),
    )
    try {
      const response = await pidogApi.clearAssistantHistory(options.settings)
      setReply(null)
      setQuestion('')
      const message = response.message ?? tr(options.language, 'История очищена', 'History cleared')
      options.onNotice(message, 'success')
      options.finishStatus(request, 'success', message)
    } catch (error) {
      handleError(request, error)
    } finally {
      setBusy(false)
    }
  }
  return {
    status,
    setStatus,
    question,
    setQuestion,
    reply,
    search,
    setSearch,
    speak,
    setSpeak,
    busy,
    control,
    ask,
    clear,
  }
}

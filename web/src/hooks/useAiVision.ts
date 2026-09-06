import { useCallback, useEffect, useRef, useState } from 'react'

import { mergeVisionDetections, type VisionDetection } from '../components/vision/visionDetections'
import { visionBoxKey } from '../components/vision/visionLabels'
import {
  pidogApi,
  type ConnectionSettings,
  type PiDogApiError,
  type VisionFace,
  type VisionInferenceResponse,
  type VisionObject,
} from '../lib/api'

type VisionEnrollment = {
  enrollFace: (names: string[], face: VisionFace) => Promise<string[]>
  enrollObject: (name: string, object: VisionObject) => Promise<string>
}

type UseAiVisionOptions = VisionEnrollment & {
  connected: boolean
  configured: boolean
  streaming: boolean
  settings: ConnectionSettings
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'AI vision request failed'
}

export function useAiVision({
  connected,
  configured,
  streaming,
  settings,
  enrollFace,
  enrollObject,
}: UseAiVisionOptions) {
  const [result, setResult] = useState<VisionInferenceResponse | null>(null)
  const [detections, setDetections] = useState<VisionDetection[]>([])
  const [selectedFace, setSelectedFace] = useState<VisionFace | null>(null)
  const [selectedObject, setSelectedObject] = useState<VisionObject | null>(null)
  const [names, setNames] = useState<string[]>([])
  const [nameInput, setNameInput] = useState('')
  const [objectName, setObjectName] = useState('')
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [saving, setSaving] = useState<'face' | 'object' | null>(null)
  const running = useRef(false)
  const editing =
    selectedFace !== null || selectedObject !== null || names.length > 0 || objectName !== ''

  const analyze = useCallback(async () => {
    if (!connected || !configured || !streaming || running.current) return
    running.current = true
    try {
      const next = await pidogApi.visionInfer(settings)
      setResult(next)
      setDetections((current) => mergeVisionDetections(current, next))
      setError('')
    } catch (cause) {
      const status = cause as PiDogApiError
      setError(status.message || errorText(cause))
    } finally {
      running.current = false
    }
  }, [configured, connected, settings, streaming])

  async function refresh() {
    setRefreshing(true)
    try {
      await analyze()
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (editing) return undefined
    const initial = window.setTimeout(() => void analyze(), 0)
    const timer = window.setInterval(() => void analyze(), 1_500)
    return () => {
      window.clearTimeout(initial)
      window.clearInterval(timer)
    }
  }, [analyze, editing])

  const selectFace = useCallback((face: VisionFace) => {
    setSelectedFace(face)
    setSelectedObject(null)
  }, [])

  const selectObject = useCallback((object: VisionObject) => {
    setSelectedObject(object)
    setSelectedFace(null)
  }, [])

  async function rememberFace() {
    const cleanNames = [
      ...new Set([...names, nameInput].map((name) => name.trim()).filter(Boolean)),
    ]
    if (!selectedFace || cleanNames.length === 0) return
    setSaving('face')
    try {
      const storedNames = await enrollFace(cleanNames, selectedFace)
      setNames([])
      setNameInput('')
      setSelectedFace(null)
      setError('')
      void refresh()
      setResult(
        (current) =>
          current && {
            ...current,
            faces: current.faces.map((face) =>
              visionBoxKey(face) === visionBoxKey(selectedFace)
                ? { ...face, name: storedNames[0] ?? null, names: storedNames }
                : face,
            ),
          },
      )
    } catch (cause) {
      setError(errorText(cause))
    } finally {
      setSaving(null)
    }
  }

  async function rememberObject() {
    if (!selectedObject || !objectName.trim()) return
    setSaving('object')
    try {
      const storedName = await enrollObject(objectName.trim(), selectedObject)
      setObjectName('')
      setSelectedObject(null)
      setError('')
      setResult(
        (current) =>
          current && {
            ...current,
            objects: current.objects.map((object) =>
              visionBoxKey(object) === visionBoxKey(selectedObject)
                ? { ...object, name: storedName }
                : object,
            ),
          },
      )
    } catch (cause) {
      setError(errorText(cause))
    } finally {
      setSaving(null)
    }
  }

  return {
    result,
    detections,
    selectedFace,
    selectedObject,
    names,
    nameInput,
    objectName,
    error,
    refreshing,
    saving,
    editing,
    clearError: () => setError(''),
    refresh,
    selectFace,
    selectObject,
    setNames,
    setNameInput,
    setObjectName,
    rememberFace,
    rememberObject,
  }
}

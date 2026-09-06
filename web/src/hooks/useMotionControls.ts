import { useCallback, useEffect, useRef } from 'react'

import { pidogApi, type ConnectionSettings } from '../lib/api'
import { errorMessage } from '../lib/i18n'
import type { Axis, Direction, Page } from '../types/ui'

type UseMotionControlsOptions = {
  page: Page
  connected: boolean
  settings: ConnectionSettings
  sendCommand: (command: string, source?: string, silent?: boolean) => Promise<unknown>
  onDisconnected: (error?: unknown) => void
  onError: (message: string) => void
  isConnectivityError: (error: unknown) => boolean
}

export function useMotionControls({
  page,
  connected,
  settings,
  sendCommand,
  onDisconnected,
  onError,
  isConnectivityError,
}: UseMotionControlsOptions) {
  const movement = useRef<{ drive: Direction; turn: Direction; last: Axis }>({
    drive: 0,
    turn: 0,
    last: 'drive',
  })
  const activeCommand = useRef<string | null>(null)
  const queue = useRef<string[]>([])
  const workerRunning = useRef(false)
  const pendingHead = useRef<{ yaw: number; pitch: number } | null>(null)
  const headRequestRunning = useRef(false)
  const commandRef = useRef(sendCommand)

  useEffect(() => {
    commandRef.current = sendCommand
  }, [sendCommand])

  const sendMotion = useCallback((command: string) => {
    if (command !== 'stop' && activeCommand.current === command && queue.current.length === 0)
      return
    activeCommand.current = command === 'stop' ? null : command
    if (command === 'stop') queue.current = ['stop']
    else if (queue.current.at(-1) === 'stop' || queue.current.length === 0)
      queue.current.push(command)
    else queue.current[queue.current.length - 1] = command
    if (workerRunning.current) return
    workerRunning.current = true
    void (async () => {
      try {
        while (queue.current.length > 0) {
          const next = queue.current.shift()
          // eslint-disable-next-line no-await-in-loop -- Motion commands must stay ordered.
          if (next) await commandRef.current(next, 'web joystick', true)
        }
      } finally {
        workerRunning.current = false
      }
    })()
  }, [])

  const moveJoystick = useCallback(
    (axis: Axis, direction: Direction) => {
      movement.current[axis] = direction
      if (direction !== 0) movement.current.last = axis
      const primary =
        movement.current[movement.current.last] !== 0
          ? movement.current.last
          : movement.current.last === 'drive'
            ? 'turn'
            : 'drive'
      const value = movement.current[primary]
      sendMotion(
        value === 0
          ? 'stop'
          : primary === 'drive'
            ? value < 0
              ? 'drive_forward'
              : 'drive_backward'
            : value < 0
              ? 'drive_left'
              : 'drive_right',
      )
    },
    [sendMotion],
  )

  const moveHead = useCallback(
    (x: number, y: number) => {
      if (!connected) return
      pendingHead.current = { yaw: Math.round(-x * 80), pitch: Math.round(-y * 30) }
      if (headRequestRunning.current) return
      headRequestRunning.current = true
      void (async () => {
        try {
          while (pendingHead.current) {
            const target = pendingHead.current
            pendingHead.current = null
            // eslint-disable-next-line no-await-in-loop -- Send only the latest head position after each request.
            await pidogApi.head(settings, target.yaw, target.pitch)
          }
        } catch (error) {
          pendingHead.current = null
          if (isConnectivityError(error)) onDisconnected(error)
          else onError(errorMessage(error))
        } finally {
          headRequestRunning.current = false
        }
      })()
    },
    [connected, isConnectivityError, onDisconnected, onError, settings],
  )

  const emergencyStop = useCallback(() => {
    movement.current = { drive: 0, turn: 0, last: 'drive' }
    activeCommand.current = null
    moveHead(0, 0)
    sendMotion('stop')
  }, [moveHead, sendMotion])

  useEffect(() => {
    if (page === 'cockpit') return
    if (activeCommand.current) emergencyStop()
    else moveHead(0, 0)
  }, [emergencyStop, moveHead, page])

  return { moveJoystick, moveHead, emergencyStop }
}

import { PiDogApiError } from './api'

export function isConnectivityError(error: unknown): boolean {
  return (
    !(error instanceof PiDogApiError) ||
    error.status === undefined ||
    error.status === 401 ||
    error.status === 404
  )
}

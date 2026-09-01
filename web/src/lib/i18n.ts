import type { Language } from './commands'

export function tr(language: Language, russian: string, english: string): string {
  return language === 'en' ? english : russian
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error'
}

export function timeNow(): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date())
}

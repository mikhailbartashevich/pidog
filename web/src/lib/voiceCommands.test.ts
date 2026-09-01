import { describe, expect, it } from 'vitest'

import { matchVoiceCommand, normalizeVoicePhrase } from './voiceCommands'

describe('web voice command parser', () => {
  it('matches a natural Russian command after removing fillers', () => {
    expect(matchVoiceCommand(['Пайдог, пожалуйста, сядь!'], 'ru')?.command).toBe('sit')
  })

  it('supports the English command set', () => {
    expect(matchVoiceCommand(['PiDog, please wag your tail'], 'en')?.command).toBe('wag_tail')
  })

  it('never fuzzily executes a negated movement phrase', () => {
    expect(matchVoiceCommand(['не иди вперед'], 'ru')).toBeNull()
  })

  it('normalizes punctuation and yo', () => {
    expect(normalizeVoicePhrase('  ЖЁЛТЫЙ—свет! ')).toBe('желтый свет')
  })
})

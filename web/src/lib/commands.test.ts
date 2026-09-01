import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { actionGroups, allActions, findAction } from './commands'

describe('command catalog', () => {
  it('contains unique server command identifiers', () => {
    const commands = actionGroups.flatMap((group) => group.actions.map((action) => action.command))
    expect(new Set(commands).size).toBe(commands.length)
  })

  it('finds a user-facing action by command identifier', () => {
    expect(findAction('wag_tail')?.label).toBe('Вилять хвостом')
  })

  it('contains every command exposed by the Android application', () => {
    const javaSource = readFileSync(
      resolve(process.cwd(), '../app/src/main/java/ru/pidog/voice/RobotCommand.java'),
      'utf8',
    )
    const androidCommands = [...javaSource.matchAll(/^\s*[A-Z][A-Z0-9_]*\("([a-z0-9_]+)"/gmu)].map(
      (match) => match[1],
    )
    const webCommands = new Set(allActions.map((item) => item.command))
    expect(androidCommands.filter((command) => command && !webCommands.has(command))).toEqual([])
  })
})

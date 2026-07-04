import { describe, expect, it } from 'vitest'
import { rollEncounter } from './rollEncounter'

function scripted(values: number[]): () => number {
  let i = 0
  return () => values[i++]
}

function forDieResult(n: number, sides: number): number {
  return (n - 1) / sides
}

describe('rollEncounter', () => {
  it('rolls a d100 and looks it up against the given table', () => {
    const rng = scripted([forDieResult(1, 100)])
    expect(rollEncounter('Arctic', rng)).toBe('An albino kraken twitches inside a glassy mountain of ice')
  })

  it('is usable with the default Math.random rng', () => {
    expect(rollEncounter('Tavern')).toBeTruthy()
  })
})

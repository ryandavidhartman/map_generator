import { describe, expect, it } from 'vitest'
import { rollEncounter, rollEncounterPurpose, checkWildernessEncounterFrequency, rollWildernessMonster, rollBxUrbanEncounter } from './rollEncounter'
import type { Terrain } from '../data/tables'

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

describe('rollEncounterPurpose', () => {
  it('rolls a d8 and looks it up', () => {
    const rng = scripted([forDieResult(1, 8)])
    expect(rollEncounterPurpose(rng)).toBe('Guarding a lair, nest, or treasure')
  })
})

describe('checkWildernessEncounterFrequency', () => {
  it('Grassland only triggers on a roll of 6', () => {
    expect(checkWildernessEncounterFrequency('Grassland', scripted([forDieResult(5, 6)]))).toBe(false)
    expect(checkWildernessEncounterFrequency('Grassland', scripted([forDieResult(6, 6)]))).toBe(true)
  })

  it('Mountain triggers on 4, 5, or 6', () => {
    expect(checkWildernessEncounterFrequency('Mountain', scripted([forDieResult(3, 6)]))).toBe(false)
    expect(checkWildernessEncounterFrequency('Mountain', scripted([forDieResult(4, 6)]))).toBe(true)
    expect(checkWildernessEncounterFrequency('Mountain', scripted([forDieResult(6, 6)]))).toBe(true)
  })
})

describe('rollWildernessMonster', () => {
  const TERRAINS: Terrain[] = ['Grassland', 'Forest/jungle', 'River/coast', 'Ocean', 'Mountain', 'Desert/arctic', 'Swamp']

  function seededRng(seed: number): () => number {
    let state = seed >>> 0
    return () => {
      state = (state * 1664525 + 1013904223) >>> 0
      return state / 4294967296
    }
  }

  it('always returns a monster or a traveler, never neither, across every terrain and party level', () => {
    for (const terrain of TERRAINS) {
      for (const partyLevel of [1, 5, 10]) {
        for (const seed of [1, 2, 3, 42, 12345]) {
          const result = rollWildernessMonster(terrain, partyLevel, seededRng(seed))
          if (result.kind === 'monster') {
            expect(result.monster.name.length).toBeGreaterThan(0)
          } else {
            expect(result.npc.race.length).toBeGreaterThan(0)
          }
        }
      }
    }
  })

  it('a low category roll (Airborne band) still resolves to a monster, not a traveler', () => {
    // roll 1 -> category Airborne for every mapped terrain (every row starts Airborne at 1)
    const rng = scripted([forDieResult(1, 100), 0])
    const result = rollWildernessMonster('Grassland', 1, rng)
    expect(result.kind).toBe('monster')
  })

  it('a level 1-3 party never gets a Dragon, Undead, or Demon result', () => {
    for (const terrain of TERRAINS) {
      for (const seed of [1, 2, 3, 42, 12345, 777, 2024, 55, 99, 123]) {
        const result = rollWildernessMonster(terrain, 2, seededRng(seed))
        if (result.kind === 'monster') {
          expect(['Dragon', 'Undead', 'Demon']).not.toContain(result.monster.category)
        }
      }
    }
  })

  // Scripted rather than statistical (Undead/Dragon are narrow bands on the Category Summary,
  // easy to miss across a handful of random seeds) — see generateCivicAmenities.test.ts's Guard
  // Post bias test for the same reasoning already established in this codebase.
  it('a level 4-6 party can land on Undead (not excluded at this tier)', () => {
    // Grassland maps to the Plains row, where roll 79 -> category Undead (see
    // encounterFrequencyTables.test.ts's Plains boundary spot-checks).
    const rng = scripted([forDieResult(79, 100), 0])
    const result = rollWildernessMonster('Grassland', 5, rng)
    expect(result.kind).toBe('monster')
    if (result.kind === 'monster') expect(result.monster.category).toBe('Undead')
  })

  it('a level 1-3 party rerolled onto Undead instead falls back to an allowed category', () => {
    // 3 rng calls: the category-summary roll (-> Undead, excluded at this tier), the fallback
    // uniform pick among allowed categories, then the entry pick within whichever it lands on.
    const rng = scripted([forDieResult(79, 100), 0, 0])
    const result = rollWildernessMonster('Grassland', 2, rng)
    expect(result.kind).toBe('monster')
    if (result.kind === 'monster') expect(['Dragon', 'Undead', 'Demon']).not.toContain(result.monster.category)
  })

  it('a level 7+ party can land on Dragon (nothing excluded at the top tier)', () => {
    // Grassland/Plains: roll 31 -> category Dragon (within its 30-31 band; 31 chosen over 30 to
    // avoid a floating-point edge case in forDieResult(30, 100) — see dice.ts's rollDie formula).
    const rng = scripted([forDieResult(31, 100), 0])
    const result = rollWildernessMonster('Grassland', 7, rng)
    expect(result.kind).toBe('monster')
    if (result.kind === 'monster') expect(result.monster.category).toBe('Dragon')
  })
})

describe('rollBxUrbanEncounter', () => {
  it('a level 1 party never gets a gated (Wererat/Demon/Vampire-tier) result across many rolls', () => {
    for (const key of ['B/X Urban (Daytime)', 'B/X Urban (Nighttime)'] as const) {
      for (const seed of [1, 2, 3, 42, 12345, 777, 2024, 55, 99, 123]) {
        const rng = (() => {
          let state = seed >>> 0
          return () => {
            state = (state * 1664525 + 1013904223) >>> 0
            return state / 4294967296
          }
        })()
        const result = rollBxUrbanEncounter(key, 1, rng)
        expect(/Wererat|Weretiger|Werewolf|Demon|Devil|Ghost|Night Hag|Rakshasa|Shadow|Spectre|Wight|Will-O-Wisp|Wraith|Vampire or Lich/.test(result)).toBe(
          false,
        )
      }
    }
  })

  it('a level 8 party accepts a gated top-tier result (Vampire or Lich) on the first roll, no reroll needed', () => {
    const rng = scripted([forDieResult(100, 100)]) // roll 100 -> Vampire or Lich, minPartyLevel 8
    const result = rollBxUrbanEncounter('B/X Urban (Nighttime)', 8, rng)
    expect(result).toContain('Vampire or Lich')
  })

  it('a level 1 party rerolls off a gated row (Vampire or Lich) onto the next roll', () => {
    // First roll (100 -> Vampire or Lich, needs level 8) is rejected; second roll (1 -> Thief,
    // ungated) is accepted.
    const rng = scripted([forDieResult(100, 100), forDieResult(1, 100)])
    const result = rollBxUrbanEncounter('B/X Urban (Nighttime)', 1, rng)
    expect(result).toContain('Thief')
  })
})

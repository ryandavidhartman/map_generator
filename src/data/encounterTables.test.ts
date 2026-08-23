import { describe, expect, it } from 'vitest'
import {
  encounterForD100,
  TERRAIN_TO_ENCOUNTER_KEYS,
  SITE_TYPE_TO_ENCOUNTER_KEY,
  DISTRICT_TYPE_TO_ENCOUNTER_KEY,
  minPartyLevelForBxUrbanEncounter,
  type EncounterTableKey,
} from './encounterTables'

const ALL_KEYS: EncounterTableKey[] = [
  'Arctic',
  'Artisan District',
  'B/X Urban (Daytime)',
  'B/X Urban (Nighttime)',
  'Castle District',
  'Cave',
  'Deep Tunnels',
  'Desert',
  'Forest',
  'Grassland',
  'High District',
  'Jungle',
  'Low District',
  'Market',
  'Mountain',
  'Ocean',
  'River and Coast',
  'Ruins',
  'Slums',
  'Swamp',
  'Tavern',
  'Temple District',
  'University District',
]

describe('encounterForD100', () => {
  it('every table has exactly 100 non-empty entries', () => {
    for (const key of ALL_KEYS) {
      for (let roll = 1; roll <= 100; roll++) {
        expect(encounterForD100(key, roll)).toBeTruthy()
      }
    }
  })

  it('throws out of range', () => {
    expect(() => encounterForD100('Arctic', 0)).toThrow()
    expect(() => encounterForD100('Arctic', 101)).toThrow()
  })

  it('spot-checks roll 1 and 100 (the "00" entry) for a couple of tables', () => {
    expect(encounterForD100('Arctic', 1)).toBe('An albino kraken twitches inside a glassy mountain of ice')
    expect(encounterForD100('Arctic', 100)).toBe('Steam rises from an oasis of sulfuric, regenerative springs')
    expect(encounterForD100('Tavern', 1)).toBe('A cloaked man (vampire) at the door asks to be invited in')
    expect(encounterForD100('Tavern', 100)).toBe("A die sits in a dusty corner; it's Brak's Cube of Perfection")
  })

  it('spot-checks boundary rows on the new B/X urban tables', () => {
    expect(encounterForD100('B/X Urban (Daytime)', 1)).toContain('Thief (as Assassin)')
    expect(encounterForD100('B/X Urban (Daytime)', 100)).toContain('Werewolf')
    expect(encounterForD100('B/X Urban (Nighttime)', 1)).toContain('Thief (as Assassin)')
    expect(encounterForD100('B/X Urban (Nighttime)', 100)).toContain('Vampire or Lich')
  })
})

describe('TERRAIN_TO_ENCOUNTER_KEYS', () => {
  it('maps every overland terrain to at least one table', () => {
    const terrains = ['Desert/arctic', 'Swamp', 'Grassland', 'Forest/jungle', 'River/coast', 'Ocean', 'Mountain'] as const
    for (const terrain of terrains) {
      expect(TERRAIN_TO_ENCOUNTER_KEYS[terrain].length).toBeGreaterThan(0)
    }
  })

  it('merges two book terrains for the combined overland terrains', () => {
    expect(TERRAIN_TO_ENCOUNTER_KEYS['Desert/arctic']).toEqual(['Desert', 'Arctic'])
    expect(TERRAIN_TO_ENCOUNTER_KEYS['Forest/jungle']).toEqual(['Forest', 'Jungle'])
  })
})

describe('SITE_TYPE_TO_ENCOUNTER_KEY', () => {
  it('Tomb falls back to Ruins (the book has no dedicated Tomb encounter table)', () => {
    expect(SITE_TYPE_TO_ENCOUNTER_KEY.Tomb).toBe('Ruins')
  })

  it('Cave/Deep tunnels/Ruins map to their own tables', () => {
    expect(SITE_TYPE_TO_ENCOUNTER_KEY.Cave).toBe('Cave')
    expect(SITE_TYPE_TO_ENCOUNTER_KEY['Deep tunnels']).toBe('Deep Tunnels')
    expect(SITE_TYPE_TO_ENCOUNTER_KEY.Ruins).toBe('Ruins')
  })
})

describe('DISTRICT_TYPE_TO_ENCOUNTER_KEY', () => {
  it('maps every district type to its own identically-named table', () => {
    expect(DISTRICT_TYPE_TO_ENCOUNTER_KEY.Slums).toBe('Slums')
    expect(DISTRICT_TYPE_TO_ENCOUNTER_KEY['Castle District']).toBe('Castle District')
  })
})

describe('minPartyLevelForBxUrbanEncounter', () => {
  it('gates the documented Urban Encounter Level rows on Daytime', () => {
    expect(minPartyLevelForBxUrbanEncounter('B/X Urban (Daytime)', 98)).toBe(3) // Wererat
    expect(minPartyLevelForBxUrbanEncounter('B/X Urban (Daytime)', 100)).toBe(3) // Werewolf
    expect(minPartyLevelForBxUrbanEncounter('B/X Urban (Daytime)', 64)).toBe(5) // Night Hag
    expect(minPartyLevelForBxUrbanEncounter('B/X Urban (Daytime)', 1)).toBeUndefined() // Thief, ungated
  })

  it('gates the documented Urban Encounter Level rows on Nighttime, including the 8+ tier', () => {
    expect(minPartyLevelForBxUrbanEncounter('B/X Urban (Nighttime)', 91)).toBe(3) // Wererat
    expect(minPartyLevelForBxUrbanEncounter('B/X Urban (Nighttime)', 23)).toBe(5) // Demon
    expect(minPartyLevelForBxUrbanEncounter('B/X Urban (Nighttime)', 100)).toBe(8) // Vampire or Lich
    expect(minPartyLevelForBxUrbanEncounter('B/X Urban (Nighttime)', 36)).toBeUndefined() // Ghast or Ghoul, ungated
  })

  it('throws out of range', () => {
    expect(() => minPartyLevelForBxUrbanEncounter('B/X Urban (Daytime)', 0)).toThrow()
    expect(() => minPartyLevelForBxUrbanEncounter('B/X Urban (Daytime)', 101)).toThrow()
  })
})

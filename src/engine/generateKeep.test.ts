import { describe, expect, it } from 'vitest'
import { generateKeepSite, generateKeepBasement } from './generateKeep'

function scripted(values: number[]): () => number {
  let i = 0
  return () => {
    if (i >= values.length) throw new Error('scripted rng ran out of values')
    return values[i++]
  }
}

function forDieResult(n: number, sides: number): number {
  return (n - 1) / sides
}

function seededRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

describe('generateKeepSite', () => {
  it('a Small roll (3 rooms) gets Hall/Barracks/Armory but not Lord\'s Quarters', () => {
    const rng = scripted([
      forDieResult(1, 6), // size -> Small (range 3-4)
      forDieResult(1, 6), // danger
      0, // dungeon level roll (rollInRange within the danger-derived band)
      0, // scenario roll (d10) — value irrelevant to this test
      0, // castle owner class d3 -> Fighter
      0, // owner level roll (rollInRange within Fighter's 9-14 band) -> 9
      0, // castle reaction d6 -> 1, Fighter's Pursue range (1-3)
      forDieResult(1, 2), // above-ground room count d2 -> range.min(3) + 1 - 1 = 3
      0, // monster theme roll (site-wide, once) — no monster rooms below, value irrelevant
      forDieResult(1, 10), // courtyard -> Empty
      forDieResult(1, 10), // Hall -> Empty
      forDieResult(1, 10), // Barracks -> Empty
      forDieResult(3, 10), // Armory roll 1 -> Trap (not Treasure)
      forDieResult(1, 6), forDieResult(1, 6), // Trap needs 2 detail rolls
      forDieResult(1, 100), // concrete trap name roll (consumed even though this roll is discarded by the bias)
      forDieResult(9, 10), // Armory biased reroll -> Treasure
      forDieResult(1, 6), // Treasure detail roll -> 'Hidden' (not 'Guarded by monster')
      forDieResult(14, 20), // treasure amount roll -> gp row (1d4x100 gp)
      forDieResult(1, 4), // gp dice roll
      forDieResult(1, 20), // treasure container roll
      forDieResult(2, 2), // container guard/hidden 50% check -> no guard
    ])
    const site = generateKeepSite(rng)
    const names = site.rooms.map((r) => r.name)
    expect(names).toEqual(['Courtyard', 'Hall', 'Barracks', 'Armory'])
    expect(names).not.toContain("Lord's Quarters")
    expect(site.rooms.find((r) => r.name === 'Armory')!.roomType).toBe('Treasure')
    expect(site.rooms.find((r) => r.name === 'Armory')!.treasure).toBeDefined()
  })

  it('a Medium+ roll gets all 4 named slots plus generic overflow rooms attached round-robin', () => {
    const site = generateKeepSite(seededRng(1))
    const namedRooms = site.rooms.filter((r) => r.isNamed && !r.isCourtyard)
    const genericRooms = site.rooms.filter((r) => !r.isNamed)
    expect(site.rooms[0].name).toBe('Courtyard')
    expect(namedRooms.length).toBeGreaterThanOrEqual(3)
    if (site.rooms.length - 1 > 4) {
      expect(genericRooms.length).toBeGreaterThan(0)
      // Every generic room connects to some named room (never directly to the courtyard).
      const namedIds = new Set(namedRooms.map((r) => r.id))
      for (const generic of genericRooms) {
        const conn = site.connections.find(([a, b]) => a === generic.id || b === generic.id)
        expect(conn).toBeDefined()
        const other = conn![0] === generic.id ? conn![1] : conn![0]
        expect(namedIds.has(other)).toBe(true)
      }
    }
  })

  it('the courtyard always connects directly to every named room (first-hop)', () => {
    for (const seed of [1, 2, 3, 42, 12345]) {
      const site = generateKeepSite(seededRng(seed))
      const namedRooms = site.rooms.filter((r) => r.isNamed && !r.isCourtyard)
      for (const named of namedRooms) {
        expect(site.connections).toContainEqual(['courtyard', named.id])
      }
    }
  })

  it('holds structural invariants across many seeds: single objective, valid room counts, non-overlapping rects', () => {
    for (const seed of [1, 2, 3, 42, 12345, 999999]) {
      const site = generateKeepSite(seededRng(seed))
      const aboveGroundCount = site.rooms.length - 1 // exclude courtyard
      if (site.size === 'Small') expect([3, 4]).toContain(aboveGroundCount)
      if (site.size === 'Medium') expect([5, 6]).toContain(aboveGroundCount)
      if (site.size === 'Large') expect([7, 8]).toContain(aboveGroundCount)

      const objectiveRooms = site.rooms.filter((r) => r.isObjectiveRoom)
      expect(objectiveRooms).toHaveLength(1)
      const maxRoll = Math.max(...site.rooms.map((r) => r.roomTypeRoll))
      expect(objectiveRooms[0].roomTypeRoll).toBe(maxRoll)
      expect(site.scenario.length).toBeGreaterThan(0)
      expect(['Fighter', 'Magic-User', 'Cleric']).toContain(site.approach.ownerClass)
      expect(['Pursue', 'Ignore', 'Friendly']).toContain(site.approach.reaction)
      expect(site.approach.patrol.length).toBeGreaterThan(0)

      for (const room of site.rooms) {
        expect(room.rect.x).toBeGreaterThanOrEqual(0)
        expect(room.rect.y).toBeGreaterThanOrEqual(0)
        expect(Boolean(room.treasure)).toBe(room.roomType === 'Treasure')
        expect(Boolean(room.trap)).toBe(room.roomType === 'Trap')
      }
    }
  })

  // Regression coverage for the 2026-07-06 monster-theming fix (see generateDungeon.test.ts's
  // sibling tests for the full incident) — Keep has no SiteType, so before this fix its rooms
  // (including the Lord's Quarters slot, biased toward NPC/Boss Monster) rolled monsters from the
  // entire unweighted pool with no theme at all.
  it('every non-Boss monster room shares the same theme category, and Boss Monster is never Animal/Insect', () => {
    for (const seed of [1, 2, 3, 42, 12345, 999999]) {
      const site = generateKeepSite(seededRng(seed))
      const nonBossCategories = new Set(
        site.rooms.filter((r) => r.monster && r.roomType !== 'Boss Monster').map((r) => r.monster!.category),
      )
      expect(nonBossCategories.size).toBeLessThanOrEqual(1)
      for (const room of site.rooms) {
        if (room.roomType === 'Boss Monster' && room.monster) {
          expect(['Animal', 'Insect']).not.toContain(room.monster.category)
        }
      }
    }
  })
})

describe('generateKeepBasement', () => {
  it('reuses the dungeon generator forced to Deep tunnels', () => {
    const basement = generateKeepBasement(seededRng(1))
    expect(basement.kind).toBe('dungeon')
    expect(basement.siteType).toBe('Deep tunnels')
  })
})

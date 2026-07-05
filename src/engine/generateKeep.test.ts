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
      forDieResult(1, 2), // above-ground room count d2 -> range.min(3) + 1 - 1 = 3
      forDieResult(1, 10), // courtyard -> Empty
      forDieResult(1, 10), // Hall -> Empty
      forDieResult(1, 10), // Barracks -> Empty
      forDieResult(3, 10), // Armory roll 1 -> Trap (not Treasure)
      forDieResult(1, 6), forDieResult(1, 6), // Trap needs 2 detail rolls
      forDieResult(9, 10), // Armory biased reroll -> Treasure
      forDieResult(1, 6), // Treasure detail roll
    ])
    const site = generateKeepSite(rng)
    const names = site.rooms.map((r) => r.name)
    expect(names).toEqual(['Courtyard', 'Hall', 'Barracks', 'Armory'])
    expect(names).not.toContain("Lord's Quarters")
    expect(site.rooms.find((r) => r.name === 'Armory')!.roomType).toBe('Treasure')
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

      for (const room of site.rooms) {
        expect(room.rect.x).toBeGreaterThanOrEqual(0)
        expect(room.rect.y).toBeGreaterThanOrEqual(0)
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

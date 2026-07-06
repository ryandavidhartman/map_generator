import { describe, expect, it } from 'vitest'
import { generateDungeonSite } from './generateDungeon'

// A scripted RNG: each call to Math.random() returns the next queued value.
// rollDie(sides) computes floor(rng() * sides) + 1, so to force a specific die result `n`
// (1-indexed) supply (n - 1) / sides. dungeonLayout.ts calls rng() directly (not via
// rollDie) once per BSP split — a raw 0 always picks the minimum split position — and
// consumes exactly `roomCount - 1` calls total (see dungeonLayout.ts).
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

describe('generateDungeonSite', () => {
  it('rolls size, type, danger, then one room per die of the site size', () => {
    const rng = scripted([
      forDieResult(1, 6), // size d6 -> Small (5 rooms)
      forDieResult(3, 6), // type d6 -> Tomb
      forDieResult(6, 6), // danger d6 -> Deadly
      0, // monster theme roll (site-wide, once) — no monster rooms below, value irrelevant
      0, 0, 0, 0, // BSP layout: 5 rooms needs 4 splits, 1 rng call each
      forDieResult(1, 10), // room 0 -> Empty
      forDieResult(1, 10), // room 1 -> Empty
      forDieResult(1, 10), // room 2 -> Empty
      forDieResult(1, 10), // room 3 -> Empty
      forDieResult(9, 10), // room 4 -> Treasure
      forDieResult(1, 6), // room 4 detail roll
    ])
    const site = generateDungeonSite(rng)
    expect(site.kind).toBe('dungeon')
    expect(site.size).toBe('Small')
    expect(site.siteType).toBe('Tomb')
    expect(site.danger).toBe('Deadly')
    expect(site.rooms).toHaveLength(5)
    expect(site.rooms[4].roomType).toBe('Treasure')
    expect(site.rooms[4].detail).toBe('Hidden')
  })

  it('marks the single highest room-type roll as the objective room, first occurrence wins ties', () => {
    const rng = scripted([
      forDieResult(1, 6), // size -> Small (5 rooms)
      forDieResult(1, 6), // type -> Cave
      forDieResult(1, 6), // danger -> Unsafe
      0.85, // monster theme roll -> Monstrous (Cave weights it at 2x baseline; see the math in
      // this test's sibling below — chosen over Animal/Insect specifically so this test doesn't
      // hit Boss Monster's category-exclusion fallback, keeping the scripted rng sequence simple.
      0, 0, 0, 0, // BSP layout: 4 splits
      forDieResult(1, 10), // room 0 -> Empty
      forDieResult(10, 10), // room 1 -> Boss Monster (tied max)
      forDieResult(1, 6), // room 1 detail
      0, // room 1 monster roll: entry-in-locked-theme-category pick (theme isn't Boss-excluded)
      forDieResult(1, 10), // room 2 -> Empty
      forDieResult(10, 10), // room 3 -> Boss Monster (tied max, later index)
      forDieResult(1, 6), // room 3 detail
      0, // room 3 monster roll
      forDieResult(1, 10), // room 4 -> Empty
    ])
    const site = generateDungeonSite(rng)
    expect(site.rooms.filter((r) => r.isObjectiveRoom)).toHaveLength(1)
    expect(site.rooms[1].isObjectiveRoom).toBe(true)
    // Both Boss Monster rooms share the site's one locked theme (Monstrous) and, given the same
    // scripted entry-pick value, the same first entry in that category — 'Ankheg'.
    expect(site.rooms[1].monster).toEqual({ name: 'Ankheg', category: 'Monstrous' })
    expect(site.rooms[3].monster).toEqual({ name: 'Ankheg', category: 'Monstrous' })
    expect(site.rooms[3].isObjectiveRoom).toBe(false)
  })

  it('an override site type skips the type roll entirely', () => {
    const rng = scripted([
      forDieResult(1, 6), // size -> Small
      // no type roll consumed — overridden
      forDieResult(1, 6), // danger -> Unsafe
      0, // monster theme roll (site-wide, once) — no monster rooms below, value irrelevant
      0, 0, 0, 0, // BSP layout: 4 splits
      forDieResult(1, 10),
      forDieResult(1, 10),
      forDieResult(1, 10),
      forDieResult(1, 10),
      forDieResult(1, 10),
    ])
    const site = generateDungeonSite(rng, 'Ruins')
    expect(site.siteType).toBe('Ruins')
  })

  it('holds structural invariants across many seeds', () => {
    for (const seed of [1, 2, 3, 42, 12345]) {
      const site = generateDungeonSite(seededRng(seed))
      expect([5, 8, 12]).toContain(site.rooms.length)
      expect(['Cave', 'Tomb', 'Deep tunnels', 'Ruins']).toContain(site.siteType)
      expect(['Unsafe', 'Risky', 'Deadly']).toContain(site.danger)

      const objectiveRooms = site.rooms.filter((r) => r.isObjectiveRoom)
      expect(objectiveRooms).toHaveLength(1)
      const maxRoll = Math.max(...site.rooms.map((r) => r.roomTypeRoll))
      expect(objectiveRooms[0].roomTypeRoll).toBe(maxRoll)

      for (const room of site.rooms) {
        expect(room.rect.width).toBeGreaterThan(0)
        expect(room.rect.height).toBeGreaterThan(0)
      }

      const roomIds = new Set(site.rooms.map((r) => r.id))
      for (const [a, b] of site.connections) {
        expect(roomIds.has(a)).toBe(true)
        expect(roomIds.has(b)).toBe(true)
      }

      for (const room of site.rooms) {
        const isMonsterType = room.roomType === 'Solo Monster' || room.roomType === 'Monster Mob' || room.roomType === 'Boss Monster'
        expect(Boolean(room.monster)).toBe(isMonsterType)
        expect(Boolean(room.npc)).toBe(room.roomType === 'NPC')
        if (room.monster) {
          expect(room.monster.name.length).toBeGreaterThan(0)
          expect(room.monster.category.length).toBeGreaterThan(0)
        }
        if (room.npc) {
          expect(room.npc.type.length).toBeGreaterThan(0)
        }
      }
    }
  })

  // Regression coverage for the 2026-07-06 monster-theming fix: the user flagged a generated
  // dungeon mixing goblins, a giant ferret, driver ants, and a djinni with no unifying theme, and
  // a "Boss Monster: Ferret, Giant" as an absurd climactic threat.
  it('every non-Boss monster room in a site shares the same theme category — no independently-rolled grab bag', () => {
    for (const seed of [1, 2, 3, 42, 12345, 777, 2024]) {
      const site = generateDungeonSite(seededRng(seed))
      const nonBossCategories = new Set(
        site.rooms.filter((r) => r.monster && r.roomType !== 'Boss Monster').map((r) => r.monster!.category),
      )
      expect(nonBossCategories.size).toBeLessThanOrEqual(1)
    }
  })

  it('Boss Monster is never Animal or Insect category, regardless of the site theme', () => {
    for (const seed of [1, 2, 3, 42, 12345, 777, 2024, 55, 99, 123]) {
      const site = generateDungeonSite(seededRng(seed))
      for (const room of site.rooms) {
        if (room.roomType === 'Boss Monster' && room.monster) {
          expect(['Animal', 'Insect']).not.toContain(room.monster.category)
        }
      }
    }
  })
})

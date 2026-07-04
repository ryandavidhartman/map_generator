import { describe, expect, it } from 'vitest'
import { generateDungeonSite } from './generateDungeon'

// A scripted RNG: each call to Math.random() returns the next queued value.
// rollDie(sides) computes floor(rng() * sides) + 1, so to force a specific die result `n`
// (1-indexed) supply (n - 1) / sides. gridLayout.ts calls rng() directly (not via rollDie),
// so a raw 0 always picks anchor index 0 and the first free neighbor.
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
      0, 0, 0, 0, 0, 0, 0, 0, // grid layout: 4 additional rooms x 2 rng calls each
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
      0, 0, 0, 0, 0, 0, 0, 0, // grid layout
      forDieResult(1, 10), // room 0 -> Empty
      forDieResult(10, 10), // room 1 -> Boss Monster (tied max)
      forDieResult(1, 6), // room 1 detail
      forDieResult(1, 10), // room 2 -> Empty
      forDieResult(10, 10), // room 3 -> Boss Monster (tied max, later index)
      forDieResult(1, 6), // room 3 detail
      forDieResult(1, 10), // room 4 -> Empty
    ])
    const site = generateDungeonSite(rng)
    expect(site.rooms.filter((r) => r.isObjectiveRoom)).toHaveLength(1)
    expect(site.rooms[1].isObjectiveRoom).toBe(true)
    expect(site.rooms[3].isObjectiveRoom).toBe(false)
  })

  it('an override site type skips the type roll entirely', () => {
    const rng = scripted([
      forDieResult(1, 6), // size -> Small
      // no type roll consumed — overridden
      forDieResult(1, 6), // danger -> Unsafe
      0, 0, 0, 0, 0, 0, 0, 0, // grid layout
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

      const cellKeys = site.rooms.map((r) => `${r.cell.row},${r.cell.col}`)
      expect(new Set(cellKeys).size).toBe(site.rooms.length)
    }
  })
})

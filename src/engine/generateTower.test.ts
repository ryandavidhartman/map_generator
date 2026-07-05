import { describe, expect, it } from 'vitest'
import { generateTowerSite } from './generateTower'

// Scripted RNG matching this project's convention (see generateDungeon.test.ts): each call to
// Math.random() returns the next queued value. rollDie(sides) computes floor(rng() * sides) + 1.
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

describe('generateTowerSite', () => {
  it('rolls size, danger, level count, then entry hall + guard room + one room per additional level', () => {
    const rng = scripted([
      forDieResult(1, 6), // size d6 -> Small (level range 1-2)
      forDieResult(6, 6), // danger d6 -> Deadly
      forDieResult(2, 2), // level count d2 -> range.min(1) + 2 - 1 = 2 levels
      forDieResult(1, 10), // entry hall room type -> Empty
      forDieResult(1, 10), // guard room room type -> Empty
      forDieResult(9, 10), // level 1 (top) room type -> Treasure
      forDieResult(1, 6), // level 1 detail roll
    ])
    const site = generateTowerSite(rng)
    expect(site.kind).toBe('tower')
    expect(site.size).toBe('Small')
    expect(site.danger).toBe('Deadly')
    expect(site.levelCount).toBe(2)
    expect(site.rooms).toHaveLength(3) // entry hall + guard room + 1 additional level
    expect(site.rooms.map((r) => r.id)).toEqual(['entry-hall', 'guard-room', 'level-1'])
  })

  it('the ground floor has exactly 2 rooms (entry hall + guard room) connected to each other', () => {
    const site = generateTowerSite(seededRng(1))
    const groundRooms = site.rooms.filter((r) => r.levelIndex === 0)
    expect(groundRooms).toHaveLength(2)
    expect(groundRooms.filter((r) => r.isGuardRoom)).toHaveLength(1)
    expect(groundRooms.filter((r) => !r.isGuardRoom)).toHaveLength(1)
    expect(site.connections).toContainEqual(['entry-hall', 'guard-room'])
  })

  it('every level above the ground floor has exactly 1 room', () => {
    for (const seed of [1, 2, 3, 42, 12345]) {
      const site = generateTowerSite(seededRng(seed))
      for (let level = 1; level < site.levelCount; level++) {
        const roomsAtLevel = site.rooms.filter((r) => r.levelIndex === level)
        expect(roomsAtLevel).toHaveLength(1)
      }
    }
  })

  it('total room count is always levelCount + 1 (ground floor has 2, every other level has 1)', () => {
    for (const seed of [1, 2, 3, 42, 12345]) {
      const site = generateTowerSite(seededRng(seed))
      expect(site.rooms).toHaveLength(site.levelCount + 1)
    }
  })

  it('level count always falls within the Size-derived range', () => {
    for (const seed of [1, 2, 3, 42, 12345, 999999]) {
      const site = generateTowerSite(seededRng(seed))
      if (site.size === 'Small') expect([1, 2]).toContain(site.levelCount)
      if (site.size === 'Medium') expect([3, 4]).toContain(site.levelCount)
      if (site.size === 'Large') expect([5, 6]).toContain(site.levelCount)
    }
  })

  it('forms a single linear chain from the entry hall to the top, with the guard room as the only side branch', () => {
    for (const seed of [1, 2, 3, 42, 12345]) {
      const site = generateTowerSite(seededRng(seed))
      const adjacency = new Map<string, string[]>()
      for (const room of site.rooms) adjacency.set(room.id, [])
      for (const [a, b] of site.connections) {
        adjacency.get(a)!.push(b)
        adjacency.get(b)!.push(a)
      }
      // Every room is reachable from the entry hall (fully connected).
      const visited = new Set(['entry-hall'])
      const queue = ['entry-hall']
      while (queue.length > 0) {
        const current = queue.shift()!
        for (const n of adjacency.get(current)!) {
          if (!visited.has(n)) {
            visited.add(n)
            queue.push(n)
          }
        }
      }
      expect(visited.size).toBe(site.rooms.length)

      // The guard room is a dead end (degree 1); every other room has degree <= 2 (a linear
      // chain, not a branching graph beyond the one permitted ground-floor pocket).
      expect(adjacency.get('guard-room')!.length).toBe(1)
      for (const room of site.rooms) {
        if (room.id === 'guard-room') continue
        expect(adjacency.get(room.id)!.length).toBeLessThanOrEqual(2)
      }
    }
  })

  it('the top of the main chain is always the objective, regardless of its Room Type roll, and it is the only objective room', () => {
    for (const seed of [1, 2, 3, 42, 12345, 999999]) {
      const site = generateTowerSite(seededRng(seed))
      const objectiveRooms = site.rooms.filter((r) => r.isObjectiveRoom)
      expect(objectiveRooms).toHaveLength(1)

      const topRoomId = site.levelCount === 1 ? 'entry-hall' : `level-${site.levelCount - 1}`
      expect(objectiveRooms[0].id).toBe(topRoomId)
      // Never the guard room, regardless of roll.
      expect(objectiveRooms[0].isGuardRoom).toBe(false)
    }
  })

  it('when the level count rolls the Small minimum of 1, the entry hall itself is the objective', () => {
    const rng = scripted([
      forDieResult(1, 6), // Small
      forDieResult(1, 6), // danger
      forDieResult(1, 2), // level count d2 -> range.min(1) + 1 - 1 = 1 level
      forDieResult(1, 10), // entry hall -> Empty
      forDieResult(1, 10), // guard room -> Empty
    ])
    const site = generateTowerSite(rng)
    expect(site.levelCount).toBe(1)
    expect(site.rooms).toHaveLength(2)
    const objectiveRooms = site.rooms.filter((r) => r.isObjectiveRoom)
    expect(objectiveRooms).toHaveLength(1)
    expect(objectiveRooms[0].id).toBe('entry-hall')
  })
})

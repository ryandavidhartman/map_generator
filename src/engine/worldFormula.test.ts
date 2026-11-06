import { describe, expect, it } from 'vitest'
import { isNextToSea, isSeaAt, pickWorldSeedForStart, randomWorldSeed, WORLD_SEED_RANGE } from './worldFormula'
import { neighborsOf, type AxialCoord } from '../hexgrid/hexMath'

function seededRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

const ORIGIN: AxialCoord = { q: 0, r: 0 }

describe('world formula', () => {
  it('is a pure function of seed and position: the same hex always gets the same answer', () => {
    for (let seed = 1; seed < 20; seed++) {
      for (const coord of [ORIGIN, { q: 13, r: -7 }, { q: -40, r: 25 }]) {
        expect(isSeaAt(seed, coord)).toBe(isSeaAt(seed, { ...coord }))
      }
    }
  })

  it('different seeds give different worlds', () => {
    const coastlines = new Set<string>()
    for (let seed = 1; seed <= 12; seed++) {
      coastlines.add(Array.from({ length: 120 }, (_, i) => (isSeaAt(seed * 7919, { q: i * 2, r: -i * 3 }) ? '~' : '.')).join(''))
    }
    expect(coastlines.size).toBeGreaterThan(8)
  })

  it('the origin is not pinned to a lattice corner: across seeds it sits anywhere from deep sea to far inland', () => {
    // Distance from the origin to the nearest hex of the other kind, per seed. A start pinned at
    // mid elevation would always be within a few hexes of the opposite kind.
    const distances: number[] = []
    for (let seed = 1; seed <= 40; seed++) {
      const here = isSeaAt(seed * 104729, ORIGIN)
      let d = 1
      outer: for (; d < 40; d++) {
        for (let q = -d; q <= d; q++) {
          for (let r = -d; r <= d; r++) {
            if (Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) === d && isSeaAt(seed * 104729, { q, r }) !== here) break outer
          }
        }
      }
      distances.push(d)
    }
    expect(Math.max(...distances)).toBeGreaterThanOrEqual(15)
    expect(distances.reduce((a, b) => a + b, 0) / distances.length).toBeGreaterThan(5)
  })

  it('has both sea and land within a modest radius, with large contiguous regions', () => {
    const R = 40
    let sea = 0
    let total = 0
    let sameAsNeighbors = 0
    for (let q = -R; q <= R; q++) {
      for (let r = -R; r <= R; r++) {
        if (Math.abs(q + r) > R) continue
        total++
        const s = isSeaAt(42, { q, r })
        if (s) sea++
        if (neighborsOf({ q, r }).every((n) => isSeaAt(42, n) === s)) sameAsNeighbors++
      }
    }
    expect(sea).toBeGreaterThan(total * 0.1)
    expect(sea).toBeLessThan(total * 0.6)
    // Most hexes sit inside a region of their own kind, not on a boundary.
    expect(sameAsNeighbors / total).toBeGreaterThan(0.7)
  })

  it('never leaves a one-hex pond or a one-hex speck of land', () => {
    const R = 35
    for (let q = -R; q <= R; q++) {
      for (let r = -R; r <= R; r++) {
        if (Math.abs(q + r) > R) continue
        const here = isSeaAt(99, { q, r })
        const alike = neighborsOf({ q, r }).filter((n) => isSeaAt(99, n) === here).length
        expect(alike).toBeGreaterThan(0)
      }
    }
  })

  it('isNextToSea looks at the six neighbors only', () => {
    const seed = pickWorldSeedForStart('Coast', seededRng(3))
    expect(isNextToSea(seed, ORIGIN)).toBe(neighborsOf(ORIGIN).some((n) => isSeaAt(seed, n)))
  })
})

describe('pickWorldSeedForStart', () => {
  it('Ocean start: the origin is sea', () => {
    for (let i = 0; i < 10; i++) expect(isSeaAt(pickWorldSeedForStart('Ocean', seededRng(i)), ORIGIN)).toBe(true)
  })

  it('Coast start: the origin is land with sea next door', () => {
    for (let i = 0; i < 10; i++) {
      const seed = pickWorldSeedForStart('Coast', seededRng(i))
      expect(isSeaAt(seed, ORIGIN)).toBe(false)
      expect(isNextToSea(seed, ORIGIN)).toBe(true)
    }
  })

  it('other starts: the origin is land, not at the water\'s edge', () => {
    for (const terrain of ['Grassland', 'Hills', 'Mountain', 'Swamp', 'Desert/arctic', 'Forest/jungle'] as const) {
      const seed = pickWorldSeedForStart(terrain, seededRng(terrain.length))
      expect(isSeaAt(seed, ORIGIN)).toBe(false)
      expect(isNextToSea(seed, ORIGIN)).toBe(false)
    }
  })

  it('finds a fitting world even with a constant rng (the search walks consecutive seeds)', () => {
    const ocean = pickWorldSeedForStart('Ocean', () => 0.5)
    expect(isSeaAt(ocean, ORIGIN)).toBe(true)
    const coast = pickWorldSeedForStart('Coast', () => 0.5)
    expect(isSeaAt(coast, ORIGIN)).toBe(false)
    expect(isNextToSea(coast, ORIGIN)).toBe(true)
    const land = pickWorldSeedForStart('Hills', () => 0.999)
    expect(isSeaAt(land, ORIGIN)).toBe(false)
    expect(isNextToSea(land, ORIGIN)).toBe(false)
  })

  it('throws instead of returning a world that contradicts the start when the search is exhausted', () => {
    expect(() => pickWorldSeedForStart('Ocean', () => 0.5, 0)).toThrow(/no world found/)
    // With too few tries to be sure of a fit, it either fits or throws — never a contradiction.
    for (let i = 0; i < 20; i++) {
      const rng = seededRng(i)
      try {
        expect(isSeaAt(pickWorldSeedForStart('Ocean', rng, 1), ORIGIN)).toBe(true)
      } catch (e) {
        expect(String(e)).toMatch(/no world found/)
      }
    }
  })

  it('seeds are non-negative integers within the range, and vary with the rng', () => {
    const seeds = new Set<number>()
    for (let i = 0; i < 20; i++) {
      const seed = randomWorldSeed(seededRng(i))
      expect(Number.isInteger(seed)).toBe(true)
      expect(seed).toBeGreaterThanOrEqual(0)
      expect(seed).toBeLessThan(WORLD_SEED_RANGE)
      seeds.add(seed)
    }
    expect(seeds.size).toBeGreaterThan(15)
  })
})

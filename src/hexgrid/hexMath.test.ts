import { describe, expect, it } from 'vitest'
import {
  axialDistance,
  hexId,
  parseHexId,
  hexesInRadius,
  isWithinRadius,
  neighborsOf,
} from './hexMath'

describe('hexId / parseHexId', () => {
  it('round-trips', () => {
    const coord = { q: -2, r: 3 }
    expect(parseHexId(hexId(coord))).toEqual(coord)
  })
})

describe('neighborsOf', () => {
  it('returns 6 distinct neighbors, all at distance 1', () => {
    const center = { q: 1, r: -1 }
    const neighbors = neighborsOf(center)
    expect(neighbors).toHaveLength(6)
    for (const n of neighbors) {
      expect(axialDistance(center, n)).toBe(1)
    }
    const ids = new Set(neighbors.map((n) => `${n.q},${n.r}`))
    expect(ids.size).toBe(6)
  })
})

describe('axialDistance', () => {
  it('is 0 for the same hex', () => {
    expect(axialDistance({ q: 3, r: -2 }, { q: 3, r: -2 })).toBe(0)
  })

  it('matches known hand-computed distances', () => {
    expect(axialDistance({ q: 0, r: 0 }, { q: 2, r: 0 })).toBe(2)
    expect(axialDistance({ q: 0, r: 0 }, { q: 0, r: 2 })).toBe(2)
    expect(axialDistance({ q: 0, r: 0 }, { q: 2, r: -2 })).toBe(2)
  })
})

describe('isWithinRadius', () => {
  it('includes the center and hexes at exactly the radius', () => {
    expect(isWithinRadius({ q: 0, r: 0 }, 2)).toBe(true)
    expect(isWithinRadius({ q: 2, r: 0 }, 2)).toBe(true)
  })

  it('excludes hexes beyond the radius', () => {
    expect(isWithinRadius({ q: 3, r: 0 }, 2)).toBe(false)
  })
})

describe('hexesInRadius', () => {
  it('produces the correct count for a given radius (3r^2 + 3r + 1)', () => {
    for (const radius of [0, 1, 2, 3, 6]) {
      const expected = 3 * radius * radius + 3 * radius + 1
      expect(hexesInRadius(radius)).toHaveLength(expected)
    }
  })

  it('every produced hex is within the radius', () => {
    const radius = 4
    for (const coord of hexesInRadius(radius)) {
      expect(isWithinRadius(coord, radius)).toBe(true)
    }
  })
})

import { describe, expect, it } from 'vitest'
import { generateSettlement } from './generateSettlement'

// The real Voronoi-based layout (settlementLayout.ts) uses rejection sampling for district
// site placement, which has a variable, non-scriptable rng call count — same shape as
// gridLayout.ts's anchor-retry fallback. Tests here use seeded rng + structural invariants
// throughout rather than exact-scripted rng values (see settlementLayout.test.ts for
// dedicated layout-geometry tests: no-overlap, connectivity, mask containment, etc.).
function seededRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

describe('generateSettlement', () => {
  it('rolls settlement type, then one district per die of that tier', () => {
    const settlement = generateSettlement(seededRng(1))
    expect(settlement.kind).toBe('settlement')
    expect([3, 4, 6, 8]).toContain(settlement.districts.length)
    for (const district of settlement.districts) {
      expect(district.pointsOfInterest.length).toBeGreaterThanOrEqual(1)
      expect(district.pointsOfInterest.length).toBeLessThanOrEqual(4)
    }
  })

  it('marks the single highest district-type roll as seat of government, first occurrence wins ties', () => {
    for (const seed of [1, 2, 3, 42, 12345]) {
      const settlement = generateSettlement(seededRng(seed))
      const seats = settlement.districts.filter((d) => d.isSeatOfGovernment)
      expect(seats).toHaveLength(1)
      const maxRoll = Math.max(...settlement.districts.map((d) => d.districtTypeRoll))
      const firstMaxIndex = settlement.districts.findIndex((d) => d.districtTypeRoll === maxRoll)
      expect(seats[0].index).toBe(firstMaxIndex)
    }
  })

  it('an override settlement type skips the type roll entirely', () => {
    const settlement = generateSettlement(seededRng(7), 'Metropolis')
    expect(settlement.settlementType).toBe('Metropolis')
    expect(settlement.districts).toHaveLength(8)
  })

  it('holds structural invariants across many seeds, including the district-tiering rule', () => {
    for (const seed of [1, 2, 3, 42, 12345]) {
      const settlement = generateSettlement(seededRng(seed))
      expect([3, 4, 6, 8]).toContain(settlement.districts.length)

      const seats = settlement.districts.filter((d) => d.isSeatOfGovernment)
      expect(seats).toHaveLength(1)
      const maxRoll = Math.max(...settlement.districts.map((d) => d.districtTypeRoll))
      expect(seats[0].districtTypeRoll).toBe(maxRoll)

      for (const district of settlement.districts) {
        expect(district.pointsOfInterest.length).toBeGreaterThanOrEqual(1)
        expect(district.pointsOfInterest.length).toBeLessThanOrEqual(4)
        expect(district.polygon.length).toBeGreaterThanOrEqual(3)
        if (settlement.settlementType === 'Village' || settlement.settlementType === 'Town') {
          expect(['Slums', 'Low District', 'Artisan District', 'Market']).toContain(district.districtType)
        }
        if (settlement.settlementType === 'City') {
          expect(['University District', 'Castle District']).not.toContain(district.districtType)
        }
      }

      // Districts occupy distinct sites (no two districts collapsed onto the same point).
      const siteKeys = settlement.districts.map((d) => `${d.site[0]},${d.site[1]}`)
      expect(new Set(siteKeys).size).toBe(settlement.districts.length)

      // Roads reference real district ids and connect every district into one component.
      const districtIds = new Set(settlement.districts.map((d) => d.id))
      const adjacency = new Map<string, string[]>()
      for (const id of districtIds) adjacency.set(id, [])
      for (const { a, b } of settlement.roads) {
        expect(districtIds.has(a)).toBe(true)
        expect(districtIds.has(b)).toBe(true)
        adjacency.get(a)!.push(b)
        adjacency.get(b)!.push(a)
      }
      const start = settlement.districts[0].id
      const visited = new Set([start])
      const queue = [start]
      while (queue.length > 0) {
        const current = queue.shift()!
        for (const n of adjacency.get(current)!) {
          if (!visited.has(n)) {
            visited.add(n)
            queue.push(n)
          }
        }
      }
      expect(visited.size).toBe(settlement.districts.length)

      expect(settlement.mask.length).toBeGreaterThan(3)
      expect(settlement.mask[0]).toEqual(settlement.mask[settlement.mask.length - 1])
    }
  })
})

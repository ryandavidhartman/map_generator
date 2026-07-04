import { describe, expect, it } from 'vitest'
import { generateSettlement } from './generateSettlement'

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

describe('generateSettlement', () => {
  it('rolls settlement type, then one district per die of that tier', () => {
    const rng = scripted([
      forDieResult(1, 6), // settlement type d6 -> Village (3 districts, d4 each)
      0, 0, 0, 0, // grid layout: 2 additional districts x 2 rng calls each
      forDieResult(2, 4), // district 0 type -> Low District
      forDieResult(1, 6), // district 0 alignment -> Lawful
      forDieResult(1, 4), // district 0 poi count -> 1
      forDieResult(1, 6), // district 0 poi roll
      forDieResult(3, 4), // district 1 type -> Artisan District
      forDieResult(1, 6), // district 1 alignment
      forDieResult(1, 4), // district 1 poi count -> 1
      forDieResult(1, 6), // district 1 poi roll
      forDieResult(1, 4), // district 2 type -> Slums
      forDieResult(1, 6), // district 2 alignment
      forDieResult(1, 4), // district 2 poi count -> 1
      forDieResult(1, 6), // district 2 poi roll
    ])
    const settlement = generateSettlement(rng)
    expect(settlement.kind).toBe('settlement')
    expect(settlement.settlementType).toBe('Village')
    expect(settlement.districts).toHaveLength(3)
    expect(settlement.districts[0].districtType).toBe('Low District')
    expect(settlement.districts[1].districtType).toBe('Artisan District')
    expect(settlement.districts[2].districtType).toBe('Slums')
    expect(settlement.districts[0].pointsOfInterest).toHaveLength(1)
  })

  it('marks the single highest district-type roll as seat of government, first occurrence wins ties', () => {
    const rng = scripted([
      forDieResult(1, 6), // Village
      0, 0, 0, 0, // grid layout
      forDieResult(4, 4), // district 0 type roll -> Market (tied max)
      forDieResult(1, 6), // alignment
      forDieResult(1, 4), // poi count -> 1
      forDieResult(1, 6), // poi roll
      forDieResult(4, 4), // district 1 type roll -> Market (tied max, later index)
      forDieResult(1, 6),
      forDieResult(1, 4),
      forDieResult(1, 6),
      forDieResult(1, 4), // district 2 type roll -> Slums (not tied)
      forDieResult(1, 6),
      forDieResult(1, 4),
      forDieResult(1, 6),
    ])
    const settlement = generateSettlement(rng)
    expect(settlement.districts.filter((d) => d.isSeatOfGovernment)).toHaveLength(1)
    expect(settlement.districts[0].isSeatOfGovernment).toBe(true)
    expect(settlement.districts[1].isSeatOfGovernment).toBe(false)
  })

  it('an override settlement type skips the type roll entirely', () => {
    // Uses a seeded (non-exact-scripted) rng since 8 districts can trigger the grid
    // layout's anchor-retry/BFS-fallback path — only the override behavior is under test
    // here, not exact roll-for-roll tracing (see the tie-break test above for that).
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
        if (settlement.settlementType === 'Village' || settlement.settlementType === 'Town') {
          expect(['Slums', 'Low District', 'Artisan District', 'Market']).toContain(district.districtType)
        }
        if (settlement.settlementType === 'City') {
          expect(['University District', 'Castle District']).not.toContain(district.districtType)
        }
      }

      const cellKeys = settlement.districts.map((d) => `${d.cell.row},${d.cell.col}`)
      expect(new Set(cellKeys).size).toBe(settlement.districts.length)
    }
  })
})

import { describe, expect, it } from 'vitest'
import { reviewRiverFor, type ReviewRiverCase } from './poiReviewRiver'
import { pickWorldSeedForStart, isSeaAt } from '../engine/worldFormula'
import { riverEntriesFor } from '../engine/rivers'
import { waterForMapHex } from '../engine/settlementPlan'
import { TERRAIN_ORDER, type Terrain } from '../data/tables'
import { hexId, neighborInDirection } from '../hexgrid/hexMath'
import type { Hex } from '../state/mapReducer'

function seededRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 0x100000000
  }
}

const ORIGIN = { q: 0, r: 0 }

function reviewMap(terrain: Terrain, seed: number) {
  const rng = seededRng(seed)
  const worldSeed = pickWorldSeedForStart(terrain, rng)
  const review = reviewRiverFor(terrain, ORIGIN, worldSeed, 1, rng)
  const hex: Hex = {
    id: '0,0',
    q: 0,
    r: 0,
    terrain,
    danger: 'Safe',
    dangerLevel: 1,
    ...(review.river ? { river: review.river } : {}),
    ...(review.lake ? { lake: review.lake } : {}),
  }
  const hexes: Record<string, Hex> = { [hex.id]: hex }
  for (const n of review.neighbors) hexes[n.id] = n
  return { review, hex, hexes, worldSeed }
}

const SEEDS = Array.from({ length: 60 }, (_, i) => i + 1)

describe('/poi river cases', () => {
  it('every case turns up across rerolls for a land terrain', () => {
    const seen = new Set<ReviewRiverCase>(SEEDS.map((s) => reviewMap('Grassland', s).review.riverCase))
    expect([...seen].sort()).toEqual(['ending', 'none', 'spring', 'through'])
  })

  it('Ocean never gets a river; Coast only ever gets an inflow that ends there', () => {
    for (const s of SEEDS) {
      expect(reviewMap('Ocean', s).review.riverCase).toBe('none')
      const coast = reviewMap('Coast', s).review
      expect(['none', 'ending']).toContain(coast.riverCase)
      if (coast.river) expect(coast.river.exit).toBeNull()
    }
  })

  it('follows the river rules for every terrain', () => {
    for (const terrain of TERRAIN_ORDER) {
      for (const s of SEEDS) {
        const { review, hex, hexes, worldSeed } = reviewMap(terrain, s)
        const entries = riverEntriesFor(hex, hexes)
        expect(entries.length).toBe(review.riverCase === 'through' || review.riverCase === 'ending' ? 1 : 0)
        for (const e of entries) {
          // Inflows come from land, from a hex of the same terrain (never uphill).
          expect(isSeaAt(worldSeed, neighborInDirection(hex, e))).toBe(false)
          expect(hexes[hexId(neighborInDirection(hex, e))].terrain).toBe(terrain)
          expect(hex.river?.exit).not.toBe(e)
        }
        // A river ending away from Coast and Swamp ends in a lake.
        if (review.riverCase === 'ending' && terrain !== 'Coast' && terrain !== 'Swamp') expect(hex.lake).toBe(true)
        if (review.riverCase === 'none') expect(hex.lake).toBeUndefined()
      }
    }
  })

  it('a land town gets a river on the town map when it has one', () => {
    for (const s of SEEDS) {
      const { review, hex, hexes, worldSeed } = reviewMap('Grassland', s)
      const water = waterForMapHex(hex, hexes, worldSeed)
      if (review.riverCase === 'none') expect(water).toBeNull()
      else expect(water?.kind).toBe('river')
    }
  })
})

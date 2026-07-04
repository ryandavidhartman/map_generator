import { describe, expect, it } from 'vitest'
import { generateSiteForHex } from './generateSite'
import type { PointOfInterest } from './generateHex'

function seededRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

describe('generateSiteForHex', () => {
  it('dispatches to a settlement for a settlement-type POI location', () => {
    const poi: PointOfInterest = { location: 'Village', development: 'Abandoned and in ruins' }
    const site = generateSiteForHex(poi, seededRng(1))
    expect(site.kind).toBe('settlement')
  })

  it('dispatches to a dungeon site for a non-settlement POI location', () => {
    const poi: PointOfInterest = { location: 'Barrow mounds', development: 'Around/over a sleeping dragon' }
    const site = generateSiteForHex(poi, seededRng(1))
    expect(site.kind).toBe('dungeon')
  })
})

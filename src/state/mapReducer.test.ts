import { describe, expect, it } from 'vitest'
import { EMPTY_MAP_STATE, isRevealableNow, mapReducer, type MapState } from './mapReducer'

function fixedRng(value: number) {
  return () => value
}

describe('mapReducer', () => {
  it('START_MAP creates a single revealed hex at the origin, occupied by the party', () => {
    const state = mapReducer(EMPTY_MAP_STATE, {
      type: 'START_MAP',
      terrain: 'Grassland',
      radius: 3,
      rng: fixedRng(0.99), // high roll: danger Deadly, poi check fails (d6=6)
    })
    expect(state.radius).toBe(3)
    expect(state.partyHexId).toBe('0,0')
    expect(state.selectedHexId).toBe('0,0')
    expect(state.hexes['0,0']).toMatchObject({ id: '0,0', q: 0, r: 0, terrain: 'Grassland' })
  })

  it('MOVE_PARTY_TO reveals an adjacent hex and moves the party there', () => {
    let state: MapState = mapReducer(EMPTY_MAP_STATE, {
      type: 'START_MAP',
      terrain: 'Grassland',
      radius: 3,
      rng: fixedRng(0.99),
    })
    state = mapReducer(state, { type: 'MOVE_PARTY_TO', hexId: '1,0', rng: fixedRng(0.99) })
    expect(state.partyHexId).toBe('1,0')
    expect(state.hexes['1,0']).toBeDefined()
    expect(Object.keys(state.hexes)).toHaveLength(2)
  })

  it('MOVE_PARTY_TO refuses a non-adjacent hex', () => {
    let state: MapState = mapReducer(EMPTY_MAP_STATE, {
      type: 'START_MAP',
      terrain: 'Grassland',
      radius: 3,
      rng: fixedRng(0.99),
    })
    const before = state
    state = mapReducer(state, { type: 'MOVE_PARTY_TO', hexId: '2,0', rng: fixedRng(0.99) })
    expect(state).toBe(before)
  })

  it('MOVE_PARTY_TO refuses a hex beyond the map radius', () => {
    let state: MapState = mapReducer(EMPTY_MAP_STATE, {
      type: 'START_MAP',
      terrain: 'Grassland',
      radius: 0,
      rng: fixedRng(0.99),
    })
    const before = state
    state = mapReducer(state, { type: 'MOVE_PARTY_TO', hexId: '1,0', rng: fixedRng(0.99) })
    expect(state).toBe(before)
  })

  it('REROLL_HEX keeps terrain but changes danger/poi', () => {
    let state: MapState = mapReducer(EMPTY_MAP_STATE, {
      type: 'START_MAP',
      terrain: 'Grassland',
      radius: 3,
      rng: fixedRng(0.99),
    })
    state = mapReducer(state, { type: 'REROLL_HEX', hexId: '0,0', rng: fixedRng(0) })
    expect(state.hexes['0,0'].terrain).toBe('Grassland')
    expect(state.hexes['0,0'].danger).toBe('Safe')
  })

  it('EDIT_HEX overrides fields manually', () => {
    let state: MapState = mapReducer(EMPTY_MAP_STATE, {
      type: 'START_MAP',
      terrain: 'Grassland',
      radius: 3,
      rng: fixedRng(0.99),
    })
    state = mapReducer(state, { type: 'EDIT_HEX', hexId: '0,0', patch: { terrain: 'Mountain' } })
    expect(state.hexes['0,0'].terrain).toBe('Mountain')
  })

  it('NEW_MAP resets to the empty state', () => {
    let state: MapState = mapReducer(EMPTY_MAP_STATE, {
      type: 'START_MAP',
      terrain: 'Grassland',
      radius: 3,
      rng: fixedRng(0.99),
    })
    state = mapReducer(state, { type: 'NEW_MAP' })
    expect(state).toEqual(EMPTY_MAP_STATE)
  })

  it('isRevealableNow is true only for unrevealed, adjacent, in-radius hexes', () => {
    const state = mapReducer(EMPTY_MAP_STATE, {
      type: 'START_MAP',
      terrain: 'Grassland',
      radius: 1,
      rng: fixedRng(0.99),
    })
    expect(isRevealableNow(state, '1,0')).toBe(true) // adjacent, in radius
    expect(isRevealableNow(state, '2,0')).toBe(false) // not adjacent
    expect(isRevealableNow(state, '0,0')).toBe(false) // already revealed
  })
})

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
      rng: fixedRng(0.99), // high roll: danger Deadly, poi check fails (d6=6)
    })
    expect(state.partyHexId).toBe('0,0')
    expect(state.selectedHexId).toBe('0,0')
    expect(state.hexes['0,0']).toMatchObject({ id: '0,0', q: 0, r: 0, terrain: 'Grassland' })
  })

  it('MOVE_PARTY_TO reveals an adjacent hex and moves the party there', () => {
    let state: MapState = mapReducer(EMPTY_MAP_STATE, {
      type: 'START_MAP',
      terrain: 'Grassland',
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
      rng: fixedRng(0.99),
    })
    const before = state
    state = mapReducer(state, { type: 'MOVE_PARTY_TO', hexId: '2,0', rng: fixedRng(0.99) })
    expect(state).toBe(before)
  })

  it('MOVE_PARTY_TO can reach a hex arbitrarily far away by walking there one adjacent step at a time', () => {
    let state: MapState = mapReducer(EMPTY_MAP_STATE, {
      type: 'START_MAP',
      terrain: 'Grassland',
      rng: fixedRng(0.99),
    })
    // Walk 50 hexes straight out along the q axis — there is no map-size bound anymore.
    const steps = 50
    for (let q = 1; q <= steps; q++) {
      state = mapReducer(state, { type: 'MOVE_PARTY_TO', hexId: `${q},0`, rng: fixedRng(0.99) })
    }
    expect(state.partyHexId).toBe(`${steps},0`)
    expect(state.hexes[`${steps},0`]).toBeDefined()
    expect(Object.keys(state.hexes)).toHaveLength(steps + 1)
  })

  it('REROLL_HEX keeps terrain but changes danger/poi', () => {
    let state: MapState = mapReducer(EMPTY_MAP_STATE, {
      type: 'START_MAP',
      terrain: 'Grassland',
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
      rng: fixedRng(0.99),
    })
    state = mapReducer(state, { type: 'EDIT_HEX', hexId: '0,0', patch: { terrain: 'Mountain' } })
    expect(state.hexes['0,0'].terrain).toBe('Mountain')
  })

  it('NEW_MAP resets to the empty state', () => {
    let state: MapState = mapReducer(EMPTY_MAP_STATE, {
      type: 'START_MAP',
      terrain: 'Grassland',
      rng: fixedRng(0.99),
    })
    state = mapReducer(state, { type: 'NEW_MAP' })
    expect(state).toEqual(EMPTY_MAP_STATE)
  })

  it('GENERATE_SITE generates a site for a POI hex with none yet', () => {
    let state: MapState = mapReducer(EMPTY_MAP_STATE, {
      type: 'START_MAP',
      terrain: 'Grassland',
      rng: fixedRng(0), // poi check passes, rolls "Small tower" (non-settlement POI)
    })
    expect(state.hexes['0,0'].poi?.location).toBe('Small tower')
    expect(state.hexes['0,0'].site).toBeUndefined()

    state = mapReducer(state, { type: 'GENERATE_SITE', hexId: '0,0', rng: fixedRng(0) })
    expect(state.hexes['0,0'].site?.kind).toBe('dungeon')
  })

  it('GENERATE_SITE is a no-op when the hex has no POI', () => {
    let state: MapState = mapReducer(EMPTY_MAP_STATE, {
      type: 'START_MAP',
      terrain: 'Grassland',
      rng: fixedRng(0.99), // poi check fails
    })
    const before = state
    state = mapReducer(state, { type: 'GENERATE_SITE', hexId: '0,0', rng: fixedRng(0) })
    expect(state).toBe(before)
  })

  it('GENERATE_SITE is idempotent once a site already exists', () => {
    let state: MapState = mapReducer(EMPTY_MAP_STATE, {
      type: 'START_MAP',
      terrain: 'Grassland',
      rng: fixedRng(0),
    })
    state = mapReducer(state, { type: 'GENERATE_SITE', hexId: '0,0', rng: fixedRng(0) })
    const afterFirstGenerate = state
    state = mapReducer(state, { type: 'GENERATE_SITE', hexId: '0,0', rng: fixedRng(0.5) })
    expect(state).toBe(afterFirstGenerate)
  })

  it('REROLL_SITE unconditionally regenerates the site', () => {
    let state: MapState = mapReducer(EMPTY_MAP_STATE, {
      type: 'START_MAP',
      terrain: 'Grassland',
      rng: fixedRng(0),
    })
    state = mapReducer(state, { type: 'GENERATE_SITE', hexId: '0,0', rng: fixedRng(0) })
    const firstSite = state.hexes['0,0'].site
    state = mapReducer(state, { type: 'REROLL_SITE', hexId: '0,0', rng: fixedRng(0.3) })
    expect(state.hexes['0,0'].site).not.toBe(firstSite)
  })

  it('REROLL_HEX clears a stale site (poi is always re-rolled by REROLL_HEX)', () => {
    let state: MapState = mapReducer(EMPTY_MAP_STATE, {
      type: 'START_MAP',
      terrain: 'Grassland',
      rng: fixedRng(0),
    })
    state = mapReducer(state, { type: 'GENERATE_SITE', hexId: '0,0', rng: fixedRng(0) })
    expect(state.hexes['0,0'].site).toBeDefined()

    state = mapReducer(state, { type: 'REROLL_HEX', hexId: '0,0', rng: fixedRng(0.99) })
    expect(state.hexes['0,0'].site).toBeUndefined()
  })

  it('EDIT_HEX clears a stale site only when the patch touches poi', () => {
    let state: MapState = mapReducer(EMPTY_MAP_STATE, {
      type: 'START_MAP',
      terrain: 'Grassland',
      rng: fixedRng(0),
    })
    state = mapReducer(state, { type: 'GENERATE_SITE', hexId: '0,0', rng: fixedRng(0) })
    expect(state.hexes['0,0'].site).toBeDefined()

    // Patch that doesn't touch poi — site survives.
    state = mapReducer(state, { type: 'EDIT_HEX', hexId: '0,0', patch: { terrain: 'Mountain' } })
    expect(state.hexes['0,0'].site).toBeDefined()

    // Patch that touches poi (even to the same value) — site is cleared as stale.
    state = mapReducer(state, {
      type: 'EDIT_HEX',
      hexId: '0,0',
      patch: { poi: state.hexes['0,0'].poi },
    })
    expect(state.hexes['0,0'].site).toBeUndefined()
  })

  it('isRevealableNow is true only for unrevealed, adjacent hexes', () => {
    const state = mapReducer(EMPTY_MAP_STATE, {
      type: 'START_MAP',
      terrain: 'Grassland',
      rng: fixedRng(0.99),
    })
    expect(isRevealableNow(state, '1,0')).toBe(true) // adjacent
    expect(isRevealableNow(state, '2,0')).toBe(false) // not adjacent
    expect(isRevealableNow(state, '0,0')).toBe(false) // already revealed
  })
})

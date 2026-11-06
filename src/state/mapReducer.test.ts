import { describe, expect, it } from 'vitest'
import { EMPTY_MAP_STATE, isRevealableNow, mapReducer, neighborInfoFor, withMapStateDefaults, type MapState } from './mapReducer'
import { isSeaAt, pickWorldSeedForStart } from '../engine/worldFormula'
import { TERRAIN_ELEVATION } from '../data/terrainTables'

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
      rng: fixedRng(0.15), // poi check passes, rolls a fresh "Dungeon" feature (roll 31, non-settlement)
    })
    expect(state.hexes['0,0'].poi?.location).toBe('Dungeon')
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
      rng: fixedRng(0.15),
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
      rng: fixedRng(0.15),
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
      rng: fixedRng(0.15),
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
      rng: fixedRng(0.15),
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

  describe('Hex Danger Level (numeric)', () => {
    it('START_MAP always gives the origin hex Danger Level 1', () => {
      // fixedRng(0.99) rolls a Deadly qualitative danger, but the starting hex has no neighbors
      // to average against — it's fixed at 1 regardless.
      const state = mapReducer(EMPTY_MAP_STATE, { type: 'START_MAP', terrain: 'Grassland', rng: fixedRng(0.99) })
      expect(state.hexes['0,0'].danger).toBe('Deadly')
      expect(state.hexes['0,0'].dangerLevel).toBe(1)
    })

    it('MOVE_PARTY_TO derives dangerLevel from its one revealed neighbor plus its own delta', () => {
      let state: MapState = mapReducer(EMPTY_MAP_STATE, { type: 'START_MAP', terrain: 'Grassland', rng: fixedRng(0.99) })
      expect(state.hexes['0,0'].dangerLevel).toBe(1)

      // rollDie(6, 0.99) = 6 -> Deadly (delta +3). Base = round(avg([1])) = 1 -> max(1, 1 + 3) = 4.
      state = mapReducer(state, { type: 'MOVE_PARTY_TO', hexId: '1,0', rng: fixedRng(0.99) })
      expect(state.hexes['1,0'].danger).toBe('Deadly')
      expect(state.hexes['1,0'].dangerLevel).toBe(4)
    })

    it('floors at 1 even when the delta would push it non-positive', () => {
      let state: MapState = mapReducer(EMPTY_MAP_STATE, { type: 'START_MAP', terrain: 'Grassland', rng: fixedRng(0.99) })
      // rollDie(6, 0) = 1 -> Safe (delta -1). Base = round(avg([1])) = 1 -> max(1, 1 - 1) = 1.
      state = mapReducer(state, { type: 'MOVE_PARTY_TO', hexId: '1,0', rng: fixedRng(0) })
      expect(state.hexes['1,0'].danger).toBe('Safe')
      expect(state.hexes['1,0'].dangerLevel).toBe(1)
    })

    it('averages multiple revealed neighbors, rounded, before applying its own delta', () => {
      // (0,0) -> dangerLevel 1. (1,0), reached from (0,0) with a Deadly roll -> dangerLevel 4.
      // (1,-1) is adjacent to both (0,0) and (1,0) — reveal it last (moving on from (1,0), which
      // is itself adjacent to (1,-1)) so both are already-revealed neighbors to average.
      let state: MapState = mapReducer(EMPTY_MAP_STATE, { type: 'START_MAP', terrain: 'Grassland', rng: fixedRng(0.99) })
      state = mapReducer(state, { type: 'MOVE_PARTY_TO', hexId: '1,0', rng: fixedRng(0.99) })
      expect(state.hexes['1,0'].dangerLevel).toBe(4)

      // rollDie(6, 0) = 1 -> Safe (delta -1). Base = round(avg([1, 4])) = round(2.5) = 3 ->
      // max(1, 3 - 1) = 2.
      state = mapReducer(state, { type: 'MOVE_PARTY_TO', hexId: '1,-1', rng: fixedRng(0) })
      expect(state.hexes['1,-1'].danger).toBe('Safe')
      expect(state.hexes['1,-1'].dangerLevel).toBe(2)
    })

    it('REROLL_HEX recomputes dangerLevel from the same neighbors using the fresh danger roll', () => {
      let state: MapState = mapReducer(EMPTY_MAP_STATE, { type: 'START_MAP', terrain: 'Grassland', rng: fixedRng(0.99) })
      state = mapReducer(state, { type: 'MOVE_PARTY_TO', hexId: '1,0', rng: fixedRng(0.99) })
      expect(state.hexes['1,0'].dangerLevel).toBe(4)

      // Neighbors of (1,0) unchanged (still just the origin at dangerLevel 1). Reroll with a
      // Safe result (delta -1): base = round(avg([1])) = 1 -> max(1, 1 - 1) = 1.
      state = mapReducer(state, { type: 'REROLL_HEX', hexId: '1,0', rng: fixedRng(0) })
      expect(state.hexes['1,0'].danger).toBe('Safe')
      expect(state.hexes['1,0'].dangerLevel).toBe(1)
    })

    it('EDIT_HEX can override dangerLevel directly, without recomputing it', () => {
      const state = mapReducer(EMPTY_MAP_STATE, { type: 'START_MAP', terrain: 'Grassland', rng: fixedRng(0.99) })
      const edited = mapReducer(state, { type: 'EDIT_HEX', hexId: '0,0', patch: { dangerLevel: 12 } })
      expect(edited.hexes['0,0'].dangerLevel).toBe(12)
    })
  })

})

describe('mapReducer — revisits, selection and unknown actions', () => {
  function twoHexMap(): MapState {
    let state: MapState = mapReducer(EMPTY_MAP_STATE, { type: 'START_MAP', terrain: 'Grassland', rng: fixedRng(0.99) })
    state = mapReducer(state, { type: 'MOVE_PARTY_TO', hexId: '1,0', rng: fixedRng(0.99) })
    return state
  }

  it('MOVE_PARTY_TO into an already-revealed hex just relocates the party, rolling nothing', () => {
    const before = twoHexMap()
    const rng = () => {
      throw new Error('a revisit must not roll')
    }
    const after = mapReducer(before, { type: 'MOVE_PARTY_TO', hexId: '0,0', rng })
    expect(after.partyHexId).toBe('0,0')
    expect(after.selectedHexId).toBe('0,0')
    expect(after.hexes).toBe(before.hexes)
  })

  it('MOVE_PARTY_TO does nothing before a map is started', () => {
    expect(mapReducer(EMPTY_MAP_STATE, { type: 'MOVE_PARTY_TO', hexId: '1,0' })).toBe(EMPTY_MAP_STATE)
  })

  it('SELECT_HEX selects a revealed hex without moving the party', () => {
    const before = twoHexMap()
    const after = mapReducer(before, { type: 'SELECT_HEX', hexId: '0,0' })
    expect(after.selectedHexId).toBe('0,0')
    expect(after.partyHexId).toBe('1,0')
    expect(after.hexes).toBe(before.hexes)
  })

  it('SELECT_HEX ignores an unrevealed hex', () => {
    const before = twoHexMap()
    expect(mapReducer(before, { type: 'SELECT_HEX', hexId: '5,5' })).toBe(before)
  })

  it('returns the same state for an unknown action', () => {
    const before = twoHexMap()
    // Simulates an action from an older/newer build reaching the reducer.
    expect(mapReducer(before, { type: 'NOT_A_REAL_ACTION' } as unknown as Parameters<typeof mapReducer>[1])).toBe(before)
  })
})

function seededRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

describe('world seed, rivers and lakes (punch-list item 1a)', () => {
  it('START_MAP picks a world seed placed so the starting hex agrees with the chosen terrain', () => {
    for (const terrain of ['Grassland', 'Ocean', 'Coast', 'Mountain'] as const) {
      const state = mapReducer(EMPTY_MAP_STATE, { type: 'START_MAP', terrain, rng: seededRng(terrain.length) })
      expect(Number.isInteger(state.worldSeed)).toBe(true)
      expect(state.hexes['0,0'].terrain).toBe(terrain)
      expect(isSeaAt(state.worldSeed, { q: 0, r: 0 })).toBe(terrain === 'Ocean')
    }
  })

  it('two maps started with different rolls get different worlds', () => {
    const a = mapReducer(EMPTY_MAP_STATE, { type: 'START_MAP', terrain: 'Grassland', rng: seededRng(1) })
    const b = mapReducer(EMPTY_MAP_STATE, { type: 'START_MAP', terrain: 'Grassland', rng: seededRng(2) })
    expect(a.worldSeed).not.toBe(b.worldSeed)
  })

  it('MOVE_PARTY_TO reveals Ocean exactly where the world formula says sea, and never elsewhere', () => {
    const rng = seededRng(5)
    let state = mapReducer(EMPTY_MAP_STATE, { type: 'START_MAP', terrain: 'Coast', rng })
    // Walk a spiral-ish path around the start.
    const path = ['1,0', '1,-1', '0,-1', '-1,0', '-1,1', '0,1', '1,0', '2,0', '2,-1', '2,-2', '1,-2', '0,-2', '-1,-1', '-2,0', '-2,1', '-2,2', '-1,2', '0,2', '1,1', '2,0']
    for (const id of path) state = mapReducer(state, { type: 'MOVE_PARTY_TO', hexId: id, rng })
    expect(Object.keys(state.hexes).length).toBeGreaterThan(15)
    for (const hex of Object.values(state.hexes)) {
      if (hex.id === '0,0') continue
      expect(hex.terrain === 'Ocean').toBe(isSeaAt(state.worldSeed, hex))
      if (hex.terrain === 'Ocean') {
        expect(hex.river).toBeUndefined()
        expect(hex.lake).toBeUndefined()
      }
    }
  })

  it('the same hex gets the same sea-or-land answer whichever way the party approaches it', () => {
    const rng = seededRng(8)
    const start = mapReducer(EMPTY_MAP_STATE, { type: 'START_MAP', terrain: 'Coast', rng })
    const viaEast = mapReducer(mapReducer(start, { type: 'MOVE_PARTY_TO', hexId: '1,0', rng: seededRng(1) }), { type: 'MOVE_PARTY_TO', hexId: '1,-1', rng: seededRng(2) })
    const viaNorth = mapReducer(mapReducer(start, { type: 'MOVE_PARTY_TO', hexId: '0,-1', rng: seededRng(3) }), { type: 'MOVE_PARTY_TO', hexId: '1,-1', rng: seededRng(4) })
    expect(viaEast.hexes['1,-1'].terrain === 'Ocean').toBe(viaNorth.hexes['1,-1'].terrain === 'Ocean')
  })

  it('a new hex continues a river flowing in from a revealed neighbor, and never changes that neighbor', () => {
    const rng = seededRng(21)
    let state = mapReducer(EMPTY_MAP_STATE, { type: 'START_MAP', terrain: 'Hills', rng })
    // Hand a river to the start hex that exits south (direction 5) into 0,1.
    state = { ...state, hexes: { ...state.hexes, '0,0': { ...state.hexes['0,0'], river: { exit: 5 } } } }
    const before = state.hexes['0,0']
    state = mapReducer(state, { type: 'MOVE_PARTY_TO', hexId: '0,1', rng })
    const next = state.hexes['0,1']
    expect(state.hexes['0,0']).toBe(before)
    // A Hills start is placed with no sea next to it, so 0,1 is land and the river must continue.
    expect(next.terrain).not.toBe('Ocean')
    expect(next.river).toBeDefined()
    expect(TERRAIN_ELEVATION[next.terrain]).toBeLessThanOrEqual(TERRAIN_ELEVATION.Hills)
    expect(next.river!.exit).not.toBe(2) // not back north, where it came from
  })

  it('START_MAP throws rather than starting on a world that contradicts the chosen terrain', () => {
    // Not reachable with the real noise (the search walks consecutive seeds); pinned through the
    // engine function with an exhausted search.
    expect(() => pickWorldSeedForStart('Ocean', () => 0.5, 0)).toThrow()
  })

  it('REROLL_HEX and EDIT_HEX keep the hex\'s river and lake as they are', () => {
    let state = mapReducer(EMPTY_MAP_STATE, { type: 'START_MAP', terrain: 'Grassland', rng: seededRng(3) })
    state = { ...state, hexes: { ...state.hexes, '0,0': { ...state.hexes['0,0'], river: { exit: 1 }, lake: true } } }
    state = mapReducer(state, { type: 'REROLL_HEX', hexId: '0,0', rng: seededRng(9) })
    expect(state.hexes['0,0'].river).toEqual({ exit: 1 })
    expect(state.hexes['0,0'].lake).toBe(true)
    state = mapReducer(state, { type: 'EDIT_HEX', hexId: '0,0', patch: { terrain: 'Ocean', poi: undefined } })
    expect(state.hexes['0,0'].terrain).toBe('Ocean')
    expect(state.hexes['0,0'].river).toEqual({ exit: 1 })
    expect(state.hexes['0,0'].lake).toBe(true)
  })

  it('neighborInfoFor reports revealed neighbors with their direction, river, lake and drain-back flag', () => {
    let state = mapReducer(EMPTY_MAP_STATE, { type: 'START_MAP', terrain: 'Grassland', rng: seededRng(3) })
    // 0,0 exits south-east (0) into 1,0; from 1,0 (unrevealed yet) the new hex would be asked about 0,0 as its north-west (3) neighbor.
    state = { ...state, hexes: { ...state.hexes, '0,0': { ...state.hexes['0,0'], river: { exit: 0 }, lake: true } } }
    const info = neighborInfoFor(state, { q: 1, r: 0 })
    expect(info).toEqual([{ direction: 3, terrain: 'Grassland', river: { exit: 0 }, lake: true, riverReachesHex: true }])
    expect(neighborInfoFor(state, { q: 5, r: 5 })).toEqual([])
  })
})

describe('withMapStateDefaults and old saves', () => {
  it('fills in a missing world seed for an empty (not yet started) save', () => {
    expect(withMapStateDefaults({ hexes: {}, partyHexId: null, selectedHexId: null })).toEqual(EMPTY_MAP_STATE)
  })

  it('a started save from before the world seed resets cleanly to a new map', () => {
    const old = { hexes: { '0,0': { id: '0,0', q: 0, r: 0, terrain: 'Grassland', danger: 'Safe', dangerLevel: 1 } }, partyHexId: '0,0', selectedHexId: '0,0' }
    expect(withMapStateDefaults(old as unknown as Partial<MapState>)).toEqual(EMPTY_MAP_STATE)
  })

  it('a save still using the old River/coast terrain resets cleanly instead of crashing', () => {
    const old = {
      hexes: { '0,0': { id: '0,0', q: 0, r: 0, terrain: 'River/coast', danger: 'Safe', dangerLevel: 1 } },
      partyHexId: '0,0',
      selectedHexId: '0,0',
      worldSeed: 12,
    }
    expect(withMapStateDefaults(old as unknown as Partial<MapState>)).toEqual(EMPTY_MAP_STATE)
  })

  it('a current-format save loads as-is', () => {
    const state = mapReducer(EMPTY_MAP_STATE, { type: 'START_MAP', terrain: 'Hills', rng: seededRng(4) })
    expect(withMapStateDefaults(JSON.parse(JSON.stringify(state)))).toEqual(state)
  })
})

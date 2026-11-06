import { describe, expect, it } from 'vitest'
import { terrainFor3d6, dangerForD6, settlementNameForD20, settlementNameColumnFor, TERRAIN_ORDER, type Terrain } from '../data/tables'
import {
  rollPointOfInterest,
  pointOfInterestForFeatureRoll,
  generateNextHexDetails,
  rollLandTerrain,
  rollStartingTerrain,
  pickRiverExit,
  type NeighborInfo,
  type NewHexInput,
} from './generateHex'
import { isNextToSea, isSeaAt, pickWorldSeedForStart } from './worldFormula'
import { COAST_RATE, LAND_TERRAINS, TERRAIN_ELEVATION } from '../data/terrainTables'
import { HEX_DIRECTIONS, neighborInDirection, oppositeDirection, type HexDirection } from '../hexgrid/hexMath'

// A scripted RNG: each call to Math.random() returns the next queued value.
// rollDie(sides) computes floor(rng() * sides) + 1, so to force a specific
// die result `n` (1-indexed) supply (n - 1) / sides.
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

describe('Hex Terrain table (3d6)', () => {
  it.each([
    [3, 'Desert/arctic'],
    [4, 'Desert/arctic'],
    [5, 'Swamp'],
    [6, 'Swamp'],
    [7, 'Grassland'],
    [9, 'Grassland'],
    [10, 'Forest/jungle'],
    [11, 'Forest/jungle'],
    [12, 'Hills'],
    [13, 'Coast'],
    [14, 'Coast'],
    [15, 'Ocean'],
    [16, 'Ocean'],
    [17, 'Mountain'],
    [18, 'Mountain'],
  ] as const)('roll %i -> %s', (roll, terrain) => {
    expect(terrainFor3d6(roll)).toBe(terrain)
  })

  it('throws out of range', () => {
    expect(() => terrainFor3d6(2)).toThrow()
    expect(() => terrainFor3d6(19)).toThrow()
  })

  it('rollStartingTerrain sums three d6 (Ocean row included)', () => {
    expect(rollStartingTerrain(scripted([forDieResult(5, 6), forDieResult(5, 6), forDieResult(5, 6)]))).toBe('Ocean')
    expect(rollStartingTerrain(scripted([forDieResult(1, 6), forDieResult(1, 6), forDieResult(1, 6)]))).toBe('Desert/arctic')
  })

  it('TERRAIN_ORDER lists all eight terrains once', () => {
    expect([...TERRAIN_ORDER].sort()).toEqual(['Coast', 'Desert/arctic', 'Forest/jungle', 'Grassland', 'Hills', 'Mountain', 'Ocean', 'Swamp'])
  })
})

// Sample a roll many times and return each terrain's share.
function shares(roll: (rng: () => number) => Terrain, n = 4000): Record<string, number> {
  const rng = seededRng(7)
  const counts: Record<string, number> = {}
  for (let i = 0; i < n; i++) {
    const t = roll(rng)
    counts[t] = (counts[t] ?? 0) + 1
  }
  return Object.fromEntries(Object.entries(counts).map(([t, c]) => [t, c / n]))
}

describe('rollLandTerrain (neighbor-weighted)', () => {
  it('with no neighbors follows the 3d6 base frequencies, Ocean excluded, inland Coast damped', () => {
    const got = shares((rng) => rollLandTerrain([], false, Infinity, rng))
    expect(got.Ocean).toBeUndefined()
    // Base weights without Ocean and with Coast × 0.05: Grassland 61, Forest 54, Hills 25, Swamp 16, Desert 4, Mountain 4, Coast 1.8.
    const total = 61 + 54 + 25 + 16 + 4 + 4 + 36 * 0.05
    expect(got.Grassland).toBeCloseTo(61 / total, 1)
    expect(got['Forest/jungle']).toBeCloseTo(54 / total, 1)
    expect(got.Hills).toBeCloseTo(25 / total, 1)
  })

  it('next to the sea, Coast keeps its full base weight', () => {
    const got = shares((rng) => rollLandTerrain([], true, Infinity, rng))
    expect(got.Coast).toBeCloseTo(36 / (61 + 54 + 25 + 16 + 4 + 4 + 36), 1)
  })

  it('a neighbor multiplies each terrain by the pair weight: Mountain neighbors pull in Mountain and Hills', () => {
    const alone = shares((rng) => rollLandTerrain([], false, Infinity, rng))
    const byMountains = shares((rng) => rollLandTerrain([{ terrain: 'Mountain' }, { terrain: 'Mountain' }], false, Infinity, rng))
    expect(byMountains.Mountain).toBeGreaterThan(alone.Mountain * 5)
    expect(byMountains.Hills).toBeGreaterThan(alone.Hills)
    expect(byMountains.Swamp ?? 0).toBeLessThan(0.01)
  })

  it('never uphill: an elevation cap excludes higher terrains but always leaves Coast and Swamp', () => {
    for (let i = 0; i < 200; i++) {
      const t = rollLandTerrain([{ terrain: 'Mountain' }, { terrain: 'Hills' }], false, 1, seededRng(i))
      expect(['Coast', 'Swamp']).toContain(t)
    }
    for (let i = 0; i < 200; i++) {
      expect(TERRAIN_ELEVATION[rollLandTerrain([{ terrain: 'Hills' }], false, 2, seededRng(i))]).toBeLessThanOrEqual(2)
    }
  })

  it('every land terrain can be rolled (pair weights are never 0)', () => {
    const got = shares((rng) => rollLandTerrain([{ terrain: 'Grassland' }], true, Infinity, rng), 20000)
    for (const terrain of LAND_TERRAINS) expect(got[terrain] ?? 0).toBeGreaterThan(0)
  })
})

// A world seed placed so the origin is land (or sea), for generator tests.
const LAND_SEED = pickWorldSeedForStart('Grassland', seededRng(1))
const COAST_SEED = pickWorldSeedForStart('Coast', seededRng(2))
const SEA_SEED = pickWorldSeedForStart('Ocean', seededRng(3))
const ORIGIN = { q: 0, r: 0 }

function neighbor(direction: HexDirection, terrain: Terrain, extra: Partial<NeighborInfo> = {}): NeighborInfo {
  return { direction, terrain, riverReachesHex: false, ...extra }
}

describe('pickWorldSeedForStart', () => {
  it('places the world so the starting hex agrees with the chosen terrain', () => {
    expect(isSeaAt(SEA_SEED, ORIGIN)).toBe(true)
    expect(isSeaAt(LAND_SEED, ORIGIN)).toBe(false)
    expect(isNextToSea(LAND_SEED, ORIGIN)).toBe(false)
    expect(isSeaAt(COAST_SEED, ORIGIN)).toBe(false)
    expect(isNextToSea(COAST_SEED, ORIGIN)).toBe(true)
  })
})

describe('generateNextHexDetails', () => {
  it('a hex on the formula\'s sea is Ocean, with no river or lake, and still rolls danger and POI', () => {
    const details = generateNextHexDetails({ worldSeed: SEA_SEED, coord: ORIGIN, neighbors: [] }, scripted([forDieResult(6, 6), forDieResult(2, 6)]))
    expect(details).toEqual({ terrain: 'Ocean', danger: 'Deadly', poi: undefined })
  })

  it('Ocean is never rolled on the formula\'s land, whatever the neighbors', () => {
    const neighbors = HEX_DIRECTIONS.map((d) => neighbor(d, 'Ocean'))
    for (let i = 0; i < 100; i++) {
      expect(generateNextHexDetails({ worldSeed: LAND_SEED, coord: ORIGIN, neighbors }, seededRng(i)).terrain).not.toBe('Ocean')
    }
  })

  it('the starting hex keeps the chosen terrain as-is (no coast conversion), Ocean included', () => {
    for (const terrain of TERRAIN_ORDER) {
      const seed = pickWorldSeedForStart(terrain, seededRng(11))
      const details = generateNextHexDetails({ worldSeed: seed, coord: ORIGIN, neighbors: [], forcedTerrain: terrain }, seededRng(5))
      expect(details.terrain).toBe(terrain)
    }
  })

  it('coast conversion: land next to the sea becomes Coast at its terrain\'s rate', () => {
    let coast = 0
    const n = 3000
    for (let i = 0; i < n; i++) {
      // All-Grassland neighbors make the land roll (almost) always Grassland, so the rate is Grassland's.
      const neighbors = HEX_DIRECTIONS.slice(0, 3).map((d) => neighbor(d, 'Grassland'))
      if (generateNextHexDetails({ worldSeed: COAST_SEED, coord: ORIGIN, neighbors }, seededRng(i)).terrain === 'Coast') coast++
    }
    expect(coast / n).toBeGreaterThan(COAST_RATE.Grassland - 0.06)
    expect(coast / n).toBeLessThan(COAST_RATE.Grassland + 0.06)
  })

  it('a river flowing in from a neighbor continues: the hex gets a river, never uphill of the entry', () => {
    // The neighbor to the north (direction 2) exits south (direction 5 = opposite of 2) — into this hex.
    const entry = neighbor(2, 'Grassland', { river: { exit: oppositeDirection(2) } })
    for (let i = 0; i < 100; i++) {
      const details = generateNextHexDetails({ worldSeed: LAND_SEED, coord: ORIGIN, neighbors: [entry] }, seededRng(i))
      expect(details.river).toBeDefined()
      expect(TERRAIN_ELEVATION[details.terrain]).toBeLessThanOrEqual(TERRAIN_ELEVATION.Grassland)
      if (details.river!.exit !== null) expect(details.river!.exit).not.toBe(2)
      else expect(details.terrain === 'Coast' || details.terrain === 'Swamp' || details.lake).toBeTruthy()
    }
  })

  it('a river flowing into a Coast hex ends there', () => {
    const entry = neighbor(2, 'Swamp', { river: { exit: 5 } })
    // Forced Coast (the start-hex path) — the river step still runs and must end here.
    for (let i = 0; i < 50; i++) {
      const forced = generateNextHexDetails({ worldSeed: LAND_SEED, coord: ORIGIN, neighbors: [entry], forcedTerrain: 'Coast' }, seededRng(i))
      expect(forced.river).toEqual({ exit: null })
    }
    // Rolled Coast next to the sea: every Coast result ends the river, and Coast does come up.
    let coasts = 0
    for (let i = 0; i < 200; i++) {
      const details = generateNextHexDetails({ worldSeed: COAST_SEED, coord: ORIGIN, neighbors: [entry] }, seededRng(i))
      if (details.terrain !== 'Coast') continue
      coasts++
      expect(details.river).toEqual({ exit: null })
    }
    expect(coasts).toBeGreaterThan(50)
  })

  it('two rivers flowing in merge: both entries are honored, the exit never points back into either', () => {
    const entries = [neighbor(2, 'Hills', { river: { exit: 5 } }), neighbor(1, 'Hills', { river: { exit: 4 } })]
    let exits = 0
    for (let i = 0; i < 100; i++) {
      const details = generateNextHexDetails({ worldSeed: LAND_SEED, coord: ORIGIN, neighbors: entries }, seededRng(i))
      expect(details.river).toBeDefined()
      expect(details.river!.exit).not.toBe(1)
      expect(details.river!.exit).not.toBe(2)
      if (details.river!.exit !== null) exits++
      else expect(details.terrain === 'Coast' || details.terrain === 'Swamp' || details.lake).toBeTruthy()
    }
    expect(exits).toBeGreaterThan(50)
  })

  it('a lake is a feature on land only, rolled at the lake chance', () => {
    let lakes = 0
    const n = 4000
    for (let i = 0; i < n; i++) if (generateNextHexDetails({ worldSeed: LAND_SEED, coord: ORIGIN, neighbors: [] }, seededRng(i)).lake) lakes++
    expect(lakes / n).toBeGreaterThan(0.02)
    expect(lakes / n).toBeLessThan(0.1)
  })
})

describe('pickRiverExit', () => {
  const base: NewHexInput = { worldSeed: LAND_SEED, coord: ORIGIN, neighbors: [] }

  it('never exits through an entry edge', () => {
    for (let i = 0; i < 100; i++) expect(pickRiverExit(base, 'Grassland', [2], seededRng(i))).not.toBe(2)
  })

  it('revealed hexes don\'t change: exits only to unrevealed hexes or revealed water-takers', () => {
    const dry = HEX_DIRECTIONS.map((d) => neighbor(d, 'Grassland'))
    expect(pickRiverExit({ ...base, neighbors: dry }, 'Grassland', [], seededRng(1))).toBeNull()
    const withSwamp = [...dry.slice(0, 5), neighbor(5, 'Swamp')]
    for (let i = 0; i < 50; i++) expect(pickRiverExit({ ...base, neighbors: withSwamp }, 'Grassland', [], seededRng(i))).toBe(5)
    const withRiver = [...dry.slice(0, 5), neighbor(5, 'Grassland', { river: { exit: 0 } })]
    for (let i = 0; i < 50; i++) expect(pickRiverExit({ ...base, neighbors: withRiver }, 'Grassland', [], seededRng(i))).toBe(5)
    const withLake = [...dry.slice(0, 5), neighbor(5, 'Grassland', { lake: true })]
    for (let i = 0; i < 50; i++) expect(pickRiverExit({ ...base, neighbors: withLake }, 'Grassland', [], seededRng(i))).toBe(5)
  })

  it('never uphill: a revealed water-taker higher than this hex is not an exit', () => {
    const neighbors = [...HEX_DIRECTIONS.slice(0, 5).map((d) => neighbor(d, 'Grassland')), neighbor(5, 'Mountain', { lake: true })]
    expect(pickRiverExit({ ...base, neighbors }, 'Grassland', [], seededRng(1))).toBeNull()
  })

  it('never into a river that already drains back here (no loops)', () => {
    const neighbors = [...HEX_DIRECTIONS.slice(0, 5).map((d) => neighbor(d, 'Grassland')), neighbor(5, 'Grassland', { river: { exit: 0 }, riverReachesHex: true })]
    expect(pickRiverExit({ ...base, neighbors }, 'Grassland', [], seededRng(1))).toBeNull()
  })

  it('prefers to keep going straight and to head for the sea', () => {
    const counts: Record<number, number> = {}
    for (let i = 0; i < 2000; i++) {
      const exit = pickRiverExit(base, 'Grassland', [2], seededRng(i))!
      counts[exit] = (counts[exit] ?? 0) + 1
    }
    // Straight on from an entry at 2 (north) is 5 (south).
    expect(counts[5]).toBeGreaterThan(counts[0])
    expect(counts[5]).toBeGreaterThan(counts[3])
    // A sea neighbor draws the river: with the sea one step away, exits toward it dominate.
    const seaDirections = HEX_DIRECTIONS.filter((d) => isSeaAt(COAST_SEED, neighborInDirection(ORIGIN, d)))
    const toSea: Record<number, number> = {}
    for (let i = 0; i < 2000; i++) {
      const exit = pickRiverExit({ ...base, worldSeed: COAST_SEED }, 'Grassland', [], seededRng(i))!
      toSea[exit] = (toSea[exit] ?? 0) + 1
    }
    const seaShare = seaDirections.reduce((n, d) => n + (toSea[d] ?? 0), 0) / 2000
    expect(seaShare).toBeGreaterThan(seaDirections.length / 6)
  })
})

describe('Danger Level table (d6)', () => {
  it.each([
    [1, 'Safe'],
    [2, 'Unsafe'],
    [3, 'Unsafe'],
    [4, 'Risky'],
    [5, 'Risky'],
    [6, 'Deadly'],
  ] as const)('roll %i -> %s', (roll, level) => {
    expect(dangerForD6(roll)).toBe(level)
  })
})

describe('Settlement Name table (d20)', () => {
  it('looks up per-column names', () => {
    expect(settlementNameForD20(1, 'Village')).toBe("Hobb's Ford")
    expect(settlementNameForD20(20, 'Village')).toBe('Hollowmere')
    expect(settlementNameForD20(1, 'Town')).toBe('Westmarch')
    expect(settlementNameForD20(20, 'Town')).toBe('Kestrel Bend')
    expect(settlementNameForD20(1, 'City/Metropolis')).toBe('Aurenna')
    expect(settlementNameForD20(20, 'City/Metropolis')).toBe('Ivanthar')
  })

  it('throws out of range', () => {
    expect(() => settlementNameForD20(0, 'Village')).toThrow()
    expect(() => settlementNameForD20(21, 'Village')).toThrow()
  })
})

describe('settlementNameColumnFor', () => {
  it('keeps Village and Town as their own columns, but merges City and Metropolis', () => {
    expect(settlementNameColumnFor('Village')).toBe('Village')
    expect(settlementNameColumnFor('Town')).toBe('Town')
    expect(settlementNameColumnFor('City')).toBe('City/Metropolis')
    expect(settlementNameColumnFor('Metropolis')).toBe('City/Metropolis')
  })
})

describe('pointOfInterestForFeatureRoll', () => {
  it('skips the 1-in-6 gate entirely — no die consumed for it', () => {
    // A scripted rng with a single queued value would throw if a d6 gate roll were consumed
    // before the feature-specific rolls; only the settlement-name d20 roll below is expected.
    const rng = scripted([forDieResult(1, 20)])
    const poi = pointOfInterestForFeatureRoll('Grassland', 142, rng) // 142 -> Village
    expect(poi.location).toBe('Village')
    expect(poi.settlementName).toBe("Hobb's Ford")
  })

  it('matches what rollPointOfInterest produces for the same feature roll', () => {
    const rng = scripted([forDieResult(3, 8)]) // cataclysm roll
    const poi = pointOfInterestForFeatureRoll('Mountain', 1, rng) // 1 -> Cataclysm
    expect(poi).toEqual({
      location: 'Cataclysm',
      development: '',
      cataclysm: 'Quake leveled cliffside settlements',
      siteKind: 'none',
    })
  })
})

describe('rollPointOfInterest', () => {
  it('returns undefined when the d6 check fails', () => {
    const rng = scripted([forDieResult(2, 6)])
    expect(rollPointOfInterest('Grassland', rng)).toBeUndefined()
  })

  it('chains into a terrain-keyed cataclysm with no site (feature roll 1)', () => {
    const rng = scripted([
      forDieResult(1, 6), // POI check passes
      forDieResult(1, 200), // Cataclysm
      forDieResult(3, 8), // cataclysm roll, keyed by terrain
    ])
    const poi = rollPointOfInterest('Mountain', rng)
    expect(poi?.location).toBe('Cataclysm')
    expect(poi?.cataclysm).toBe('Quake leveled cliffside settlements')
    expect(poi?.siteKind).toBe('none')
    expect(poi?.settlementName).toBeUndefined()
  })

  it('chains into a terrain-keyed natural landmark with no site and no extra roll (feature roll 71-83)', () => {
    const rng = scripted([
      forDieResult(1, 6), // POI check passes
      forDieResult(71, 200), // Natural landmark
    ])
    const poi = rollPointOfInterest('Swamp', rng)
    expect(poi?.location).toBe('Natural landmark')
    expect(poi?.naturalLandmark).toBe(
      'Massive, hollowed-out cypress tree wide enough to serve as shelter, rising from the mire',
    )
    expect(poi?.siteKind).toBe('none')
  })

  it('chains into settlement name + forced Settlement Type when a settlement is rolled', () => {
    const rng = scripted([
      forDieResult(1, 6), // POI check passes
      forDieResult(142, 200), // Village
      forDieResult(2, 20), // settlement name roll
    ])
    const poi = rollPointOfInterest('Grassland', rng)
    expect(poi?.location).toBe('Village')
    expect(poi?.siteKind).toBe('settlement')
    expect(poi?.forcedType).toBe('Village')
    expect(poi?.settlementName).toBe('Mossbank')
    expect(poi?.cataclysm).toBeUndefined()
  })

  it('names a forced Metropolis from the shared City/Metropolis name pool', () => {
    const rng = scripted([
      forDieResult(1, 6), // POI check passes
      forDieResult(200, 200), // Metropolis
      forDieResult(2, 20), // settlement name roll
    ])
    const poi = rollPointOfInterest('Grassland', rng)
    expect(poi?.location).toBe('Metropolis')
    expect(poi?.forcedType).toBe('Metropolis')
    expect(poi?.settlementName).toBe('Valcresta')
  })

  it('routes to a dungeon with a forced Site Type + flavor tag (e.g. Large tomb)', () => {
    const rng = scripted([
      forDieResult(1, 6), // POI check passes
      forDieResult(20, 200), // Large tomb
    ])
    const poi = rollPointOfInterest('Mountain', rng)
    expect(poi?.location).toBe('Large tomb')
    expect(poi?.siteKind).toBe('dungeon')
    expect(poi?.forcedType).toBe('Tomb')
    expect(poi?.development).toBe('Large tomb')
  })

  it('routes to a dungeon with no forced type for the generic "Dungeon" row (fresh roll, unchanged)', () => {
    const rng = scripted([
      forDieResult(1, 6), // POI check passes
      forDieResult(31, 200), // Dungeon
    ])
    const poi = rollPointOfInterest('Mountain', rng)
    expect(poi?.location).toBe('Dungeon')
    expect(poi?.siteKind).toBe('dungeon')
    expect(poi?.forcedType).toBeUndefined()
  })

  it('routes to one of the 5 house-rule site kinds with no forced type (e.g. Tower)', () => {
    const rng = scripted([
      forDieResult(1, 6), // POI check passes
      forDieResult(2, 200), // Tower
    ])
    const poi = rollPointOfInterest('Mountain', rng)
    expect(poi?.location).toBe('Tower')
    expect(poi?.siteKind).toBe('tower')
    expect(poi?.forcedType).toBeUndefined()
  })
})

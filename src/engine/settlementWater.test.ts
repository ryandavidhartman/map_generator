// Water rules for settlement maps (user rule, 2026-10-31: water must make sense for the hex the
// settlement is in), as revised by punch-list item 1a (2026-11-03). Rules table:
//
//   Settlement's hex | Around it                                   | Water on the map
//   any              | sea on some sides (formula or revealed Ocean) | Coast toward the sea
//   any              | sea on sides that cancel out (isthmus, or    | Coast toward one real sea side,
//                    |   sea all around)                            |   picked from the seed
//   Ocean            | no sea on any side (hand-edited Ocean)       | Coast on a random side
//   any other        | no sea, a river through the hex              | River on its real edges (entries + exit; the plan draws the course, 1b)
//   any other        | no sea, no river                             | No water — Coast included
//
// "Sea on a side" is the world formula's answer for the neighbor in that direction, revealed or
// not, or a revealed Ocean hex there (so a hex hand-edited to Ocean still gives its neighbor a
// coast). "Side" is the real screen direction of that neighbor. These tests cover the rules table
// for every terrain, the overland-map wiring (waterForMapHex), the isthmus fix, the full chain
// from a real map to the drawn sea/river, and the random-side case.
import { describe, expect, it } from 'vitest'
import { computeSettlementPlan, waterForHex, waterForMapHex, type Pt, type SettlementPlanInput, type SettlementWaterInput } from './settlementPlan'
import { generateSettlement } from './generateSettlement'
import { TERRAIN_ORDER, type Terrain } from '../data/tables'
import { directionAngle, HEX_DIRECTIONS, hexId, neighborInDirection, oppositeDirection, type AxialCoord, type HexDirection } from '../hexgrid/hexMath'
import { isSeaAt, pickWorldSeedForStart } from './worldFormula'
import type { SettlementType } from '../data/settlementTables'
import type { RiverData } from './rivers'

function seededRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

const TYPES: SettlementType[] = ['Village', 'Town', 'City', 'Metropolis']
const LAND_TERRAINS = TERRAIN_ORDER.filter((t) => t !== 'Ocean')
const CENTER: AxialCoord = { q: 0, r: 0 }

// A world whose formula says land at the center and on all six sides — so the only sea in these
// tests is the sea the test puts there as revealed Ocean hexes.
const DRY_SEED = pickWorldSeedForStart('Grassland', seededRng(1))

function inputFor(seed: number, type: SettlementType): Omit<SettlementPlanInput, 'water'> {
  const site = generateSettlement(seededRng(seed), type)
  return { settlementType: site.settlementType, districts: site.districts, seedSource: `${site.settlementType}|${site.population}|${seed}` }
}

// The coast's angle (rivers carry edges, not an angle).
const angleOf = (water: SettlementWaterInput | null | undefined): number | undefined => (water?.kind === 'coast' ? water.angle : undefined)

// Smallest absolute difference between two angles, in radians.
function angleGap(a: number, b: number): number {
  return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)))
}

function centroid(points: Pt[]): Pt {
  return { x: points.reduce((s, p) => s + p.x, 0) / points.length, y: points.reduce((s, p) => s + p.y, 0) / points.length }
}

type MapHex = { q: number; r: number; terrain: Terrain; river?: RiverData }

function mapWith(centerTerrain: Terrain, neighbors: Partial<Record<HexDirection, Terrain>>, river?: RiverData) {
  const hexes: Record<string, MapHex> = { [hexId(CENTER)]: { ...CENTER, terrain: centerTerrain, river } }
  for (const [d, terrain] of Object.entries(neighbors)) {
    const coord = neighborInDirection(CENTER, Number(d) as HexDirection)
    hexes[hexId(coord)] = { ...coord, terrain }
  }
  return { hex: hexes[hexId(CENTER)], hexes }
}

describe('water rules table, every terrain', () => {
  const scenarios: { label: string; seaSides: HexDirection[]; river?: { exit: HexDirection | null; entries: HexDirection[] } }[] = [
    { label: 'no sea, no river', seaSides: [] },
    { label: 'no sea, a river through it', seaSides: [], river: { exit: 5, entries: [2] } },
    { label: 'sea on one side', seaSides: [1] },
    { label: 'sea on one side and a river', seaSides: [1], river: { exit: 1, entries: [4] } },
  ]

  function expected(terrain: Terrain, s: (typeof scenarios)[number]): SettlementWaterInput | null {
    if (s.seaSides.length) return { kind: 'coast', angle: directionAngle(s.seaSides[0]) }
    if (terrain === 'Ocean') return { kind: 'coast' }
    if (s.river) return { kind: 'river', entries: s.river.entries, exit: s.river.exit }
    return null
  }

  for (const terrain of TERRAIN_ORDER) {
    for (const s of scenarios) {
      it(`${terrain} hex with ${s.label}`, () => {
        const got = waterForHex({ terrain, seaSides: s.seaSides, river: s.river, pick: 0.3 })
        const want = expected(terrain, s)
        if (want === null) return expect(got).toBeNull()
        expect(got?.kind).toBe(want.kind)
        if (want.kind === 'river') return expect(got).toEqual(want)
        if (want.angle === undefined) expect(angleOf(got)).toBeUndefined()
        else expect(angleGap(angleOf(got)!, want.angle)).toBeLessThan(1e-9)
      })
    }
  }

  it('sea beats a river: a hex with both gets a coast, not a river', () => {
    expect(waterForHex({ terrain: 'Coast', seaSides: [3], river: { exit: null, entries: [0] }, pick: 0 })).toEqual({ kind: 'coast', angle: expect.closeTo(directionAngle(3), 9) })
  })

  it('a river passes its real edges through unchanged: an ending river, and one with neither edge known', () => {
    expect(waterForHex({ terrain: 'Swamp', seaSides: [], river: { exit: null, entries: [2] }, pick: 0 })).toEqual({ kind: 'river', entries: [2], exit: null })
    expect(waterForHex({ terrain: 'Grassland', seaSides: [], river: { exit: null, entries: [] }, pick: 0 })).toEqual({ kind: 'river', entries: [], exit: null })
  })

  it('a Coast hex with no sea next to it and no river draws no water', () => {
    expect(waterForHex({ terrain: 'Coast', seaSides: [], pick: 0 })).toBeNull()
  })
})

describe('isthmus fix — sea sides that cancel out', () => {
  it('sea on opposite sides: the coast faces one of those real sea sides, chosen by the seed', () => {
    for (const d of HEX_DIRECTIONS) {
      const sides = [d, oppositeDirection(d)]
      const low = waterForHex({ terrain: 'Grassland', seaSides: sides, pick: 0.1 })
      const high = waterForHex({ terrain: 'Grassland', seaSides: sides, pick: 0.9 })
      expect(angleGap(angleOf(low)!, directionAngle(d))).toBeLessThan(1e-9)
      expect(angleGap(angleOf(high)!, directionAngle(oppositeDirection(d)))).toBeLessThan(1e-9)
    }
  })

  it('sea on every other side, or all around (an Ocean hex), also faces a real sea side', () => {
    for (const sides of [[0, 2, 4], [1, 3, 5], HEX_DIRECTIONS] as HexDirection[][]) {
      const water = waterForHex({ terrain: 'Ocean', seaSides: sides, pick: 0.5 })
      expect(water?.kind).toBe('coast')
      expect(sides.some((d) => angleGap(angleOf(water)!, directionAngle(d)) < 1e-9)).toBe(true)
    }
  })

  it('sea sides that do not cancel are still averaged (two neighboring sides put the sea between them)', () => {
    const water = waterForHex({ terrain: 'Grassland', seaSides: [0, 5], pick: 0.5 })
    expect(angleGap(angleOf(water)!, directionAngle(0))).toBeCloseTo(angleGap(angleOf(water)!, directionAngle(5)), 9)
  })

  it('from the map: the pick comes from the world seed and hex, so it is the same every visit and varies across hexes', () => {
    // Revealed Ocean on opposite sides of a dry-world hex.
    const first = mapWith('Grassland', { 0: 'Ocean', 3: 'Ocean' })
    const a = waterForMapHex(first.hex, first.hexes, DRY_SEED)
    const b = waterForMapHex(first.hex, first.hexes, DRY_SEED)
    expect(a).toEqual(b)
    expect([directionAngle(0), directionAngle(3)].some((angle) => angleGap(angleOf(a)!, angle) < 1e-9)).toBe(true)
    // Across many hexes and seeds, both sides get chosen.
    const chosen = new Set<number>()
    for (let seed = 1; seed <= 30; seed++) {
      const at: AxialCoord = { q: seed * 3, r: -seed }
      const dry = pickWorldSeedForStart('Grassland', seededRng(seed))
      const hexes: Record<string, MapHex> = { [hexId(at)]: { ...at, terrain: 'Grassland' } }
      for (const d of [0, 3] as HexDirection[]) {
        const c = neighborInDirection(at, d)
        hexes[hexId(c)] = { ...c, terrain: 'Ocean' }
      }
      // Only count worlds where the formula adds no other sea around this hex.
      if (HEX_DIRECTIONS.some((d) => d !== 0 && d !== 3 && isSeaAt(dry, neighborInDirection(at, d)))) continue
      const water = waterForMapHex(hexes[hexId(at)], hexes, dry)!
      chosen.add(angleGap(angleOf(water)!, directionAngle(0)) < 1e-9 ? 0 : 3)
    }
    expect(chosen.size).toBe(2)
  })
})

describe('waterForMapHex — reading the overland map', () => {
  it.each(HEX_DIRECTIONS)('a revealed Ocean hex in direction %i puts the coast in its on-screen direction', (d) => {
    const { hex, hexes } = mapWith('Grassland', { [d]: 'Ocean' })
    const water = waterForMapHex(hex, hexes, DRY_SEED)
    expect(water?.kind).toBe('coast')
    expect(angleGap(angleOf(water)!, directionAngle(d))).toBeLessThan(1e-9)
  })

  it('uses true screen directions: south is +90° (y points down), south-east is +30°', () => {
    expect(directionAngle(5)).toBeCloseTo(Math.PI / 2, 9)
    expect(directionAngle(0)).toBeCloseTo(Math.PI / 6, 9)
  })

  it('counts the formula\'s sea on unrevealed sides too', () => {
    const seed = pickWorldSeedForStart('Coast', seededRng(4))
    const seaSides = HEX_DIRECTIONS.filter((d) => isSeaAt(seed, neighborInDirection(CENTER, d)))
    expect(seaSides.length).toBeGreaterThan(0)
    const { hex, hexes } = mapWith('Coast', {})
    const water = waterForMapHex(hex, hexes, seed)
    expect(water?.kind).toBe('coast')
    // The coast faces into the sea sides: closer to one of them than to any land side.
    const gapToSea = Math.min(...seaSides.map((d) => angleGap(angleOf(water)!, directionAngle(d))))
    const landSides = HEX_DIRECTIONS.filter((d) => !seaSides.includes(d))
    const gapToLand = Math.min(...landSides.map((d) => angleGap(angleOf(water)!, directionAngle(d))))
    expect(gapToSea).toBeLessThanOrEqual(gapToLand + 1e-9)
  })

  it('a revealed land hex overrides the formula: a hand-edited land neighbor on a formula-sea side is not sea', () => {
    const seed = pickWorldSeedForStart('Coast', seededRng(4))
    const seaSides = HEX_DIRECTIONS.filter((d) => isSeaAt(seed, neighborInDirection(CENTER, d)))
    const asLand = Object.fromEntries(seaSides.map((d) => [d, 'Grassland' as const]))
    const { hex, hexes } = mapWith('Grassland', asLand)
    expect(waterForMapHex(hex, hexes, seed)).toBeNull()
  })

  it('works the same away from the origin (directions are relative to the settlement hex)', () => {
    const at: AxialCoord = { q: 7, r: -4 }
    const below = neighborInDirection(at, 5)
    const hexes: Record<string, MapHex> = { [hexId(at)]: { ...at, terrain: 'Grassland' }, [hexId(below)]: { ...below, terrain: 'Ocean' } }
    // A world with no formula sea around `at`, so the only sea is the revealed Ocean hex below.
    let seed = 0
    for (; seed < 500; seed++) if (!HEX_DIRECTIONS.some((d) => isSeaAt(seed, neighborInDirection(at, d)))) break
    expect(seed).toBeLessThan(500)
    expect(angleOf(waterForMapHex(hexes[hexId(at)], hexes, seed))).toBeCloseTo(Math.PI / 2, 9)
  })

  it('ignores Ocean hexes that are revealed but not adjacent', () => {
    const { hex, hexes } = mapWith('Grassland', {})
    hexes[hexId({ q: 2, r: 0 })] = { q: 2, r: 0, terrain: 'Ocean' }
    hexes[hexId({ q: -2, r: 1 })] = { q: -2, r: 1, terrain: 'Ocean' }
    expect(waterForMapHex(hex, hexes, DRY_SEED)).toBeNull()
  })

  it('a hand-edited Ocean hex in a dry world gets a coast on an unknown (random) side', () => {
    const { hex, hexes } = mapWith('Ocean', {})
    expect(waterForMapHex(hex, hexes, DRY_SEED)).toEqual({ kind: 'coast' })
  })

  it('a hex with no river record of its own but an inflow (revealed before the river reached it) still gets a river', () => {
    // A Swamp revealed first; its north neighbor (direction 2) later exits south (5) into it.
    const { hex, hexes } = mapWith('Swamp', { 2: 'Hills' })
    hexes[hexId(neighborInDirection(CENTER, 2))].river = { exit: 5 }
    expect(waterForMapHex(hex, hexes, DRY_SEED)).toEqual({ kind: 'river', entries: [2], exit: null })
  })

  it('a river hex with no sea: the river runs along its exit; entries are read from the neighbors', () => {
    const { hex, hexes } = mapWith('Grassland', {}, { exit: 0 })
    expect(waterForMapHex(hex, hexes, DRY_SEED)).toEqual({ kind: 'river', entries: [], exit: 0 })
    // A river ending here, fed from the north neighbor (direction 2, whose exit 5 points back here).
    const ending = mapWith('Swamp', { 2: 'Hills' }, { exit: null })
    ending.hexes[hexId(neighborInDirection(CENTER, 2))].river = { exit: 5 }
    expect(waterForMapHex(ending.hex, ending.hexes, DRY_SEED)).toEqual({ kind: 'river', entries: [2], exit: null })
    // Through: fed from the north, leaving south-east.
    const through = mapWith('Grassland', { 2: 'Hills' }, { exit: 0 })
    through.hexes[hexId(neighborInDirection(CENTER, 2))].river = { exit: 5 }
    expect(waterForMapHex(through.hex, through.hexes, DRY_SEED)).toEqual({ kind: 'river', entries: [2], exit: 0 })
  })
})

describe('from the overland map to the drawn town map', () => {
  const SEEDS = [1, 2, 3, 4]

  it.each(HEX_DIRECTIONS)('Ocean in direction %i: the drawn sea lies toward that hex, for every type', (d) => {
    const { hex, hexes } = mapWith('Grassland', { [d]: 'Ocean' })
    const angle = directionAngle(d)
    for (const type of TYPES) {
      for (const seed of SEEDS) {
        const plan = computeSettlementPlan({ ...inputFor(seed, type), water: waterForMapHex(hex, hexes, DRY_SEED) })
        expect(plan.water?.kind).toBe('coast')
        if (plan.water?.kind !== 'coast') continue
        expect(angleGap(plan.water.angle, angle)).toBeLessThan(1e-9)
        // The sea area itself sits on that side of the town, and the town's land is on the other.
        const sea = centroid(plan.water.sea)
        const town = centroid(plan.outline)
        expect(angleGap(Math.atan2(sea.y - town.y, sea.x - town.x), angle)).toBeLessThan(Math.PI / 6)
      }
    }
  })

  it.each(HEX_DIRECTIONS)('a river leaving in direction %i: the drawn river leaves the map on that edge', (d) => {
    const { hex, hexes } = mapWith('Grassland', {}, { exit: d })
    for (const type of TYPES) {
      for (const seed of SEEDS) {
        const plan = computeSettlementPlan({ ...inputFor(seed, type), water: waterForMapHex(hex, hexes, DRY_SEED) })
        expect(plan.water?.kind).toBe('river')
        if (plan.water?.kind !== 'river') continue
        expect(plan.water.course).toBe('spring')
        expect(plan.water.exit).toBe(d)
        // The arm starts in the middle of town and runs off the map in direction d.
        const arm = plan.water.arms[0]
        expect(Math.hypot(arm[0].x, arm[0].y)).toBeLessThan(1e-6)
        const far = arm[arm.length - 1]
        expect(angleGap(Math.atan2(far.y, far.x), directionAngle(d))).toBeLessThan(0.1)
        expect(Math.max(Math.abs(far.x), Math.abs(far.y))).toBeGreaterThan(plan.bounds.maxX)
      }
    }
  })

  it('a land hex with no sea and no river draws no water at all', () => {
    for (const terrain of LAND_TERRAINS) {
      const { hex, hexes } = mapWith(terrain, { 1: 'Hills', 3: 'Grassland' })
      const plan = computeSettlementPlan({ ...inputFor(5, 'City'), water: waterForMapHex(hex, hexes, DRY_SEED) })
      expect(plan.water).toBeNull()
    }
  })
})

describe('random side (no direction known)', () => {
  const SEEDS = Array.from({ length: 12 }, (_, i) => i + 1)

  it('a coast with no direction is stable per settlement, varies between settlements, and is still drawn properly', () => {
    const angles: number[] = []
    for (const type of TYPES) {
      for (const seed of SEEDS) {
        const input: SettlementPlanInput = { ...inputFor(seed, type), water: { kind: 'coast' } }
        const plan = computeSettlementPlan(input)
        // Same settlement, same side — every visit.
        expect(angleOf(computeSettlementPlan(input).water as SettlementWaterInput)).toBe(angleOf(plan.water as SettlementWaterInput))
        expect(plan.water?.kind).toBe('coast')
        if (plan.water?.kind !== 'coast') continue
        angles.push(plan.water.angle)
        // Coast checks from the directed case: blocks stay on the land side, gates face land.
        const u = { x: Math.cos(plan.water.angle), y: Math.sin(plan.water.angle) }
        const reachSea = Math.max(...plan.outline.map((p) => p.x * u.x + p.y * u.y))
        for (const block of plan.blocks) for (const p of block.cell) expect(p.x * u.x + p.y * u.y).toBeLessThanOrEqual(reachSea + 1e-6)
        for (const gate of plan.gates) expect(gate.at.x * u.x + gate.at.y * u.y).toBeLessThan(reachSea - 1.5)
      }
    }
    // Not stuck on one side: the random sides spread over at least three quarters of the compass.
    const quadrants = new Set(angles.map((a) => Math.floor((((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) / (Math.PI / 2))))
    expect(quadrants.size).toBeGreaterThanOrEqual(3)
  })

  it('a river with neither edge known (a spring that dead-ended in its own hex) gets a seed-picked exit, stable per settlement', () => {
    const exits = new Set<number>()
    for (const type of TYPES) {
      for (const seed of SEEDS) {
        const input: SettlementPlanInput = { ...inputFor(seed, type), water: { kind: 'river', entries: [], exit: null } }
        const plan = computeSettlementPlan(input)
        expect(plan.water?.kind).toBe('river')
        if (plan.water?.kind !== 'river') continue
        expect(plan.water.course).toBe('spring')
        expect(plan.water.exit).not.toBeNull()
        expect((computeSettlementPlan(input).water as { exit: number | null }).exit).toBe(plan.water.exit)
        expect(plan.water.bridges.length).toBeGreaterThan(0)
        exits.add(plan.water.exit!)
      }
    }
    expect(exits.size).toBeGreaterThanOrEqual(4)
  })
})

// Simulated campaigns for punch-list item 1a's tuning targets (CLAUDE.md, "Neighbor-weighted
// terrain"): 20 campaigns of 300 revealed hexes each, walked through the real reducer, then
// measured. The thresholds are the spec's targets with a little slack for sampling noise; the
// numbers behind them (world formula scale and sea level, river and lake chances) live in
// worldFormula.ts and data/terrainTables.ts. Run with VITE_WORLD_SIM_LOG=1 to print the
// per-campaign table when retuning.
import { describe, expect, it } from 'vitest'
import { EMPTY_MAP_STATE, mapReducer, type Hex, type MapState } from '../state/mapReducer'
import { hexId, neighborInDirection, neighborsOf, oppositeDirection, parseHexId, HEX_DIRECTIONS, type AxialCoord } from '../hexgrid/hexMath'
import { TERRAIN_ELEVATION } from '../data/terrainTables'
import { isSeaAt } from './worldFormula'
import { riverEntriesFor } from './rivers'
import type { Terrain } from '../data/tables'

function seededRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

const CAMPAIGNS = 20
const HEXES_PER_CAMPAIGN = 300
// Vitest exposes the shell environment through import.meta.env (VITE_ prefix, see vite's envPrefix).
const LOG = Boolean(import.meta.env.VITE_WORLD_SIM_LOG)

// A party that mostly pushes into the unknown (70% of moves go to an unrevealed neighbor when
// one exists) but also wanders back over known ground, so hexes get revealed from every side.
// It travels by land: having stepped onto a hex that turned out to be Ocean, it turns back to
// a known land neighbor 9 times in 10 (the rest is a short boat trip), and it steps onto a hex
// already known to be Ocean just as rarely — so the sea is revealed along its shores, not
// crossed.
function walkCampaign(seed: number, startTerrain: Terrain = 'Grassland'): MapState {
  const rng = seededRng(seed)
  let state = mapReducer(EMPTY_MAP_STATE, { type: 'START_MAP', terrain: startTerrain, rng })
  let guard = 0
  while (Object.keys(state.hexes).length < HEXES_PER_CAMPAIGN && guard++ < 20000) {
    const here = parseHexId(state.partyHexId!)
    const all = neighborsOf(here)
    const atSea = state.hexes[state.partyHexId!].terrain === 'Ocean'
    const knownLand = all.filter((c) => state.hexes[hexId(c)] && state.hexes[hexId(c)].terrain !== 'Ocean')
    let pool: AxialCoord[]
    if (atSea && knownLand.length && rng() < 0.9) {
      pool = knownLand
    } else {
      const options = all.filter((c) => state.hexes[hexId(c)]?.terrain !== 'Ocean' || rng() < 0.1)
      if (!options.length) continue
      const unrevealed = options.filter((c) => !state.hexes[hexId(c)])
      pool = unrevealed.length && rng() < 0.7 ? unrevealed : options
    }
    const next = pool[Math.floor(rng() * pool.length)]
    state = mapReducer(state, { type: 'MOVE_PARTY_TO', hexId: hexId(next), rng })
  }
  return state
}

// Every hex a river touches downstream of `startId` (including it), stopping at an unrevealed hex
// or a revisit.
function riverPathFrom(hexes: Record<string, Hex>, startId: string): string[] {
  const path: string[] = []
  let id: string | undefined = startId
  while (id && hexes[id]?.river && !path.includes(id)) {
    path.push(id)
    const exit = hexes[id].river!.exit
    if (exit === null) break
    id = hexId(neighborInDirection(parseHexId(id), exit))
  }
  return path
}

// Connected components of the revealed land hexes alone (no bridging through unrevealed land).
function revealedLandComponents(state: MapState): number[] {
  const seen = new Set<string>()
  const sizes: number[] = []
  for (const hex of Object.values(state.hexes)) {
    if (hex.terrain === 'Ocean' || seen.has(hex.id)) continue
    let size = 0
    const stack = [hex]
    seen.add(hex.id)
    while (stack.length) {
      const h = stack.pop()!
      size++
      for (const n of neighborsOf(h)) {
        const nh = state.hexes[hexId(n)]
        if (nh && nh.terrain !== 'Ocean' && !seen.has(nh.id)) {
          seen.add(nh.id)
          stack.push(nh)
        }
      }
    }
    sizes.push(size)
  }
  return sizes
}

// How the revealed land splits into landmasses: revealed land hexes count as connected when
// the formula's land joins them within the explored area's bounding box (plus a margin) — a
// party that walked around a bay has seen one continent, not two.
function landmasses(state: MapState): number[] {
  const hexes = Object.values(state.hexes)
  const box = boundingBox(hexes, 3)
  const isLand = (c: AxialCoord) => {
    const revealed = state.hexes[hexId(c)]
    return revealed ? revealed.terrain !== 'Ocean' : !isSeaAt(state.worldSeed, c)
  }
  const seen = new Set<string>()
  const sizes: number[] = []
  for (const hex of hexes) {
    if (hex.terrain === 'Ocean' || seen.has(hex.id)) continue
    let revealedLand = 0
    const stack: AxialCoord[] = [hex]
    seen.add(hex.id)
    while (stack.length) {
      const c = stack.pop()!
      if (state.hexes[hexId(c)]) revealedLand++
      for (const n of neighborsOf(c)) {
        const id = hexId(n)
        if (seen.has(id) || !inBox(n, box) || !isLand(n)) continue
        seen.add(id)
        stack.push(n)
      }
    }
    sizes.push(revealedLand)
  }
  return sizes
}

type Box = { minQ: number; maxQ: number; minR: number; maxR: number }

function boundingBox(hexes: AxialCoord[], margin: number): Box {
  return {
    minQ: Math.min(...hexes.map((h) => h.q)) - margin,
    maxQ: Math.max(...hexes.map((h) => h.q)) + margin,
    minR: Math.min(...hexes.map((h) => h.r)) - margin,
    maxR: Math.max(...hexes.map((h) => h.r)) + margin,
  }
}

const inBox = (c: AxialCoord, box: Box) => c.q >= box.minQ && c.q <= box.maxQ && c.r >= box.minR && c.r <= box.maxR

// The formula's sea body containing `start`, within the box (counted wherever the formula says
// sea, revealed or not).
function formulaSeaBody(worldSeed: number, start: AxialCoord, box: Box): Set<string> {
  const seen = new Set<string>([hexId(start)])
  const stack = [start]
  while (stack.length) {
    const c = stack.pop()!
    for (const n of neighborsOf(c)) {
      const id = hexId(n)
      if (!seen.has(id) && inBox(n, box) && isSeaAt(worldSeed, n)) {
        seen.add(id)
        stack.push(n)
      }
    }
  }
  return seen
}

type CampaignStats = {
  ocean: number
  land: number
  rivers: number
  lakes: number
  biggestLandmassShare: number
  // The same measure without bridging: only revealed land hexes connect.
  biggestRevealedLandShare: number
  seaBodiesReached: number[]
  isthmusShare: number
  terrainCounts: Record<string, number>
}

function measure(state: MapState): CampaignStats {
  const hexes = Object.values(state.hexes)
  const land = hexes.filter((h) => h.terrain !== 'Ocean')
  const landSizes = landmasses(state)
  const terrainCounts: Record<string, number> = {}
  for (const h of hexes) terrainCounts[h.terrain] = (terrainCounts[h.terrain] ?? 0) + 1

  // One measurement per sea the party reached: the formula's size of that sea body within the
  // explored area's bounding box (plus a margin) — bounded, so a huge ocean is counted as "big",
  // and complete, so every revealed Ocean hex of one body lands in the same count.
  const box = boundingBox(hexes, 10)
  const seaSeen = new Set<string>()
  const seaBodiesReached: number[] = []
  for (const h of hexes) {
    if (h.terrain !== 'Ocean' || seaSeen.has(h.id) || !isSeaAt(state.worldSeed, h)) continue
    const body = formulaSeaBody(state.worldSeed, h, box)
    for (const id of body) seaSeen.add(id)
    seaBodiesReached.push(body.size)
  }

  const coastal = land.filter((h) => neighborsOf(h).some((n) => isSeaAt(state.worldSeed, n)))
  const isthmus = coastal.filter((h) =>
    HEX_DIRECTIONS.some((d) => isSeaAt(state.worldSeed, neighborInDirection(h, d)) && isSeaAt(state.worldSeed, neighborInDirection(h, oppositeDirection(d)))),
  )

  return {
    ocean: hexes.length - land.length,
    land: land.length,
    rivers: land.filter((h) => h.river).length,
    lakes: land.filter((h) => h.lake).length,
    biggestLandmassShare: land.length ? Math.max(...landSizes) / land.length : 1,
    biggestRevealedLandShare: land.length ? Math.max(...revealedLandComponents(state)) / land.length : 1,
    seaBodiesReached,
    isthmusShare: coastal.length ? isthmus.length / coastal.length : 0,
    terrainCounts,
  }
}

const campaigns = Array.from({ length: CAMPAIGNS }, (_, i) => walkCampaign(1000 + i * 7919))
const stats = campaigns.map(measure)
const totals = stats.reduce(
  (acc, s) => ({ ocean: acc.ocean + s.ocean, land: acc.land + s.land, rivers: acc.rivers + s.rivers, lakes: acc.lakes + s.lakes }),
  { ocean: 0, land: 0, rivers: 0, lakes: 0 },
)

if (LOG) {
  for (const [i, s] of stats.entries()) {
    console.log(
      `campaign ${i}: ocean ${s.ocean} land ${s.land} rivers ${((100 * s.rivers) / s.land).toFixed(0)}% lakes ${((100 * s.lakes) / s.land).toFixed(0)}% landmass ${(100 * s.biggestLandmassShare).toFixed(0)}% (revealed-only ${(100 * s.biggestRevealedLandShare).toFixed(0)}%) seas ${s.seaBodiesReached.join(',')} isthmus ${(100 * s.isthmusShare).toFixed(0)}%`,
    )
  }
  const terrainTotals: Record<string, number> = {}
  for (const s of stats) for (const [t, n] of Object.entries(s.terrainCounts)) terrainTotals[t] = (terrainTotals[t] ?? 0) + n
  const all = totals.ocean + totals.land
  console.log(Object.entries(terrainTotals).map(([t, n]) => `${t} ${((100 * n) / all).toFixed(1)}%`).join(', '))
  console.log(`rivers ${((100 * totals.rivers) / totals.land).toFixed(1)}% of land, lakes ${((100 * totals.lakes) / totals.land).toFixed(1)}% of land, ocean ${((100 * totals.ocean) / all).toFixed(1)}%`)
  const seas = stats.flatMap((s) => s.seaBodiesReached).sort((a, b) => a - b)
  console.log(`sea met in ${stats.filter((s) => s.ocean > 0).length} of ${CAMPAIGNS} campaigns; sea bodies reached (box-limited sizes): ${seas.join(', ')}`)
  console.log(`revealed-only biggest landmass per campaign: ${stats.map((s) => `${(100 * s.biggestRevealedLandShare).toFixed(0)}%`).join(' ')}`)
}

describe('simulated campaigns (20 × 300 hexes)', () => {
  it('every campaign reveals its 300 hexes', () => {
    for (const c of campaigns) expect(Object.keys(c.hexes).length).toBe(HEXES_PER_CAMPAIGN)
  })

  it('the biggest landmass holds at least 95% of the revealed land, in nearly every campaign', () => {
    const failing = stats.filter((s) => s.biggestLandmassShare < 0.95).length
    expect(failing).toBeLessThanOrEqual(1)
  })

  it('seas the party reaches are mostly 100 hexes or bigger', () => {
    const seas = stats.flatMap((s) => s.seaBodiesReached)
    expect(seas.length).toBeGreaterThan(5)
    const big = seas.filter((n) => n >= 100).length
    expect(big / seas.length).toBeGreaterThanOrEqual(0.75)
  })

  it('the party meets the sea in a good share of campaigns, but Ocean stays a minority of hexes', () => {
    const withSea = stats.filter((s) => s.ocean > 0).length
    expect(withSea).toBeGreaterThanOrEqual(CAMPAIGNS / 3)
    expect(totals.ocean / (totals.ocean + totals.land)).toBeLessThan(0.35)
  })

  it('one-hex ponds never occur (the formula\'s touch-up fills them in, so this pins that rule, not a tuning)', () => {
    let bodies = 0
    let ponds = 0
    for (const c of campaigns) {
      // Every formula sea body that touches the explored area, flooded fully within the
      // explored box (plus a margin) so the count is per body, not per capped fragment.
      const box = boundingBox(Object.values(c.hexes), 3)
      const seen = new Set<string>()
      for (const h of Object.values(c.hexes)) {
        for (const start of [h, ...neighborsOf(h)]) {
          const id = hexId(start)
          if (seen.has(id) || !inBox(start, box) || !isSeaAt(c.worldSeed, start)) continue
          const body = formulaSeaBody(c.worldSeed, start, box)
          for (const member of body) seen.add(member)
          bodies++
          if (body.size === 1) ponds++
        }
      }
    }
    expect(bodies).toBeGreaterThan(0)
    expect(ponds).toBe(0)
  })

  it('about 17% of land hexes carry a river and about 5% a lake', () => {
    expect(totals.rivers / totals.land).toBeGreaterThan(0.12)
    expect(totals.rivers / totals.land).toBeLessThan(0.23)
    expect(totals.lakes / totals.land).toBeGreaterThan(0.03)
    expect(totals.lakes / totals.land).toBeLessThan(0.08)
  })

  it('isthmus coasts (sea on opposite sides of a land hex) are rare', () => {
    const coastalTotal = stats.reduce((n, s) => n + s.isthmusShare, 0) / stats.length
    expect(coastalTotal).toBeLessThan(0.03)
  })

  it('every terrain appears, with Ocean only where the formula says sea', () => {
    const seen = new Set<string>()
    for (const c of campaigns) {
      for (const h of Object.values(c.hexes)) {
        seen.add(h.terrain)
        if (h.id !== '0,0') expect(h.terrain === 'Ocean').toBe(isSeaAt(c.worldSeed, h))
      }
    }
    expect([...seen].sort()).toEqual(['Coast', 'Desert/arctic', 'Forest/jungle', 'Grassland', 'Hills', 'Mountain', 'Ocean', 'Swamp'])
  })

  it('Coast hexes hug the sea: nearly all are next to it, and most land next to the sea is Coast', () => {
    let coast = 0
    let coastBySea = 0
    let landBySea = 0
    for (const c of campaigns) {
      for (const h of Object.values(c.hexes)) {
        if (h.terrain === 'Ocean' || h.id === '0,0') continue
        const bySea = neighborsOf(h).some((n) => isSeaAt(c.worldSeed, n))
        if (bySea) landBySea++
        if (h.terrain === 'Coast') {
          coast++
          if (bySea) coastBySea++
        }
      }
    }
    // The rest are the spec's inland Coast hexes (allowed at ×0.05) — about 0.5% of all hexes.
    expect(coastBySea / coast).toBeGreaterThan(0.75)
    expect(coastBySea / landBySea).toBeGreaterThan(0.6)
  })
})

describe('river rules hold in every simulated campaign', () => {
  it('exits point only at hexes that can take the water, never uphill, never back into an entry', () => {
    for (const c of campaigns) {
      for (const h of Object.values(c.hexes)) {
        if (!h.river) continue
        expect(h.terrain).not.toBe('Ocean')
        if (h.terrain === 'Coast') expect(h.river.exit).toBeNull()
        const entries = riverEntriesFor(h, c.hexes)
        if (h.river.exit === null) continue
        expect(entries).not.toContain(h.river.exit)
        const target = c.hexes[hexId(neighborInDirection(h, h.river.exit))]
        if (!target) continue
        expect(TERRAIN_ELEVATION[target.terrain]).toBeLessThanOrEqual(TERRAIN_ELEVATION[h.terrain])
        const canTake = target.terrain === 'Ocean' || target.terrain === 'Coast' || target.terrain === 'Swamp' || target.lake || target.river
        expect(canTake).toBeTruthy()
      }
    }
  })

  it('no river loops back on itself', () => {
    for (const c of campaigns) {
      for (const h of Object.values(c.hexes)) {
        if (!h.river) continue
        // Follow the river by hand: it must end on a hex with no exit, at an unrevealed hex, or
        // in a revealed water hex with no river of its own — never by revisiting a hex.
        const visited = new Set<string>()
        let current: Hex | undefined = h
        while (current?.river) {
          expect(visited.has(current.id)).toBe(false)
          visited.add(current.id)
          if (current.river.exit === null) break
          current = c.hexes[hexId(neighborInDirection(current, current.river.exit))]
        }
        if (current && !current.river) expect(current.terrain === 'Ocean' || current.terrain === 'Coast' || current.terrain === 'Swamp' || current.lake === true).toBe(true)
      }
    }
  })

  it('a river that ends on land without a sea, swamp or lake does not exist: ends are at Coast, Swamp or a lake', () => {
    for (const c of campaigns) {
      for (const h of Object.values(c.hexes)) {
        if (!h.river || h.river.exit !== null) continue
        expect(h.terrain === 'Coast' || h.terrain === 'Swamp' || h.lake === true).toBe(true)
      }
    }
  })

  it('rivers are usually longer than one hex', () => {
    let springs = 0
    let length = 0
    for (const c of campaigns) {
      for (const h of Object.values(c.hexes)) {
        if (!h.river || riverEntriesFor(h, c.hexes).length > 0) continue
        springs++
        length += riverPathFrom(c.hexes, h.id).length
      }
    }
    expect(length / springs).toBeGreaterThan(2)
  })
})

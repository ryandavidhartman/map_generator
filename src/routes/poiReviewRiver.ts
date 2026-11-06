// River cases for the /poi/:n review page. The review hex is a lone hex with no real neighbors,
// so on its own it would never carry a river. Each reroll picks one river case for it (no river,
// a spring, a through river, or a river ending on the hex), so the town map's river drawing can
// be reviewed alongside the coast cases. Inflows are never saved on a hex (rivers.ts works them
// out from the neighbors' exits), so an inflow is made by adding one revealed neighbor whose
// river exits into the review hex.
//
// The cases follow the generator's river rules (generateHex.ts):
// - Ocean never has a river.
// - Coast only takes an inflow, which ends there; Coast never starts a river.
// - A river ending on a hex other than Coast or Swamp ends in a lake, so that hex gets a lake.
// - Inflows come only from land sides (not the formula's sea). The inflow neighbor has the
//   review hex's own terrain, so the water never flows uphill.
// - An exit never points back at the entry.
// The cases are picked with equal odds, not the generator's real odds, so every case turns up
// within a few rerolls.

import type { Rng } from '../engine/dice'
import type { RiverData } from '../engine/rivers'
import { isSeaAt } from '../engine/worldFormula'
import type { Terrain } from '../data/tables'
import type { Hex } from '../state/mapReducer'
import { HEX_DIRECTIONS, hexId, neighborInDirection, oppositeDirection, type AxialCoord, type HexDirection } from '../hexgrid/hexMath'

export type ReviewRiverCase = 'none' | 'spring' | 'through' | 'ending'

export type ReviewRiver = {
  riverCase: ReviewRiverCase
  river?: RiverData
  lake?: true
  // Revealed neighbors to add to the review map (at most one, the inflow's source).
  neighbors: Hex[]
}

function pick<T>(options: T[], rng: Rng): T {
  return options[Math.floor(rng() * options.length)]
}

export function reviewRiverCasesFor(terrain: Terrain): ReviewRiverCase[] {
  if (terrain === 'Ocean') return ['none']
  if (terrain === 'Coast') return ['none', 'ending']
  return ['none', 'spring', 'through', 'ending']
}

export function reviewRiverFor(terrain: Terrain, coord: AxialCoord, worldSeed: number, dangerLevel: number, rng: Rng): ReviewRiver {
  const landSides = HEX_DIRECTIONS.filter((d) => !isSeaAt(worldSeed, neighborInDirection(coord, d)))
  // An inflow needs a land side to come from.
  const cases = reviewRiverCasesFor(terrain).filter((c) => landSides.length > 0 || c === 'none' || c === 'spring')
  const riverCase = pick(cases, rng)
  if (riverCase === 'none') return { riverCase, neighbors: [] }
  if (riverCase === 'spring') return { riverCase, river: { exit: pick(HEX_DIRECTIONS, rng) }, neighbors: [] }

  const entry = pick(landSides, rng)
  const sourceCoord = neighborInDirection(coord, entry)
  const source: Hex = {
    id: hexId(sourceCoord),
    q: sourceCoord.q,
    r: sourceCoord.r,
    terrain,
    danger: 'Safe',
    dangerLevel,
    river: { exit: oppositeDirection(entry) },
  }
  if (riverCase === 'through') {
    const exit = pick(
      HEX_DIRECTIONS.filter((d) => d !== entry),
      rng,
    ) as HexDirection
    return { riverCase, river: { exit }, neighbors: [source] }
  }
  // Ending: Coast and Swamp take the water as they are; anywhere else the river ends in a lake.
  const endsInLake = terrain !== 'Coast' && terrain !== 'Swamp'
  return { riverCase, river: { exit: null }, ...(endsInLake ? { lake: true as const } : {}), neighbors: [source] }
}

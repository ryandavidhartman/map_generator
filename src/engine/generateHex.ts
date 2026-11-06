import { pickWeighted, rollDie, sumDice, type Rng } from './dice'
import { type Terrain, type DangerLevel, terrainFor3d6, dangerForD6, settlementNameForD20, settlementNameColumnFor } from '../data/tables'
import { type SiteKind, locationFeatureForD200, cataclysmForTerrain, naturalLandmarkForTerrain } from '../data/locationTables'
import {
  COAST_RATE,
  INLAND_COAST_FACTOR,
  LAKE_CHANCE,
  LAND_TERRAINS,
  LAND_TERRAIN_BASE_WEIGHTS,
  RIVER_CONTINUES_PAST_SWAMP_OR_LAKE,
  RIVER_SPRING_CHANCE,
  TERRAIN_ELEVATION,
  terrainPairWeight,
} from '../data/terrainTables'
import { isNextToSea, isSeaAt } from './worldFormula'
import type { RiverData } from './rivers'
import { HEX_DIRECTIONS, neighborInDirection, oppositeDirection, type AxialCoord, type HexDirection } from '../hexgrid/hexMath'

export type PointOfInterest = {
  location: string
  development: string
  cataclysm?: string
  naturalLandmark?: string
  settlementName?: string
  // Set for every POI rolled via the Location Generator's Feature table: 'none' means no site is
  // ever generated for this hex (Cataclysm/Natural landmark rows — flavor text only); a real
  // SiteKind means generateSiteForHex routes to that generator. Left undefined for POIs created
  // via the manual hex-edit form (freeform location/development text) — generateSiteForHex falls
  // back to its legacy location-text heuristic in that case.
  siteKind?: SiteKind | 'none'
  // Forces the target generator's own Type roll (SiteType for 'dungeon', SettlementType for
  // 'settlement') — see the Feature table's "Forced Type" column. Unset means that generator
  // still rolls its own Type fresh (e.g. the generic "Dungeon" row).
  forcedType?: string
}

export type GeneratedHexDetails = {
  terrain: Terrain
  danger: DangerLevel
  poi?: PointOfInterest
  river?: RiverData
  lake?: true
}

// What the generator knows about one revealed neighbor of the hex being generated.
export type NeighborInfo = {
  // Direction from the new hex toward this neighbor.
  direction: HexDirection
  terrain: Terrain
  river?: RiverData
  lake?: boolean
  // True if this neighbor's river, followed downstream through revealed hexes, arrives at the
  // new hex (directly — its exit points here — or by way of other hexes). Letting the new hex's
  // river exit into such a neighbor would make a loop. See rivers.ts's riverDrainsTo.
  riverReachesHex: boolean
}

export type NewHexInput = {
  worldSeed: number
  coord: AxialCoord
  // The revealed neighbors only; unrevealed ones are unknown, except for what the world formula
  // says about sea and land there.
  neighbors: NeighborInfo[]
  // The starting hex: the terrain the GM chose, taken as-is (no sea/land decision, no coast
  // conversion). The world seed was picked so the formula agrees with it (worldFormula.ts).
  forcedTerrain?: Terrain
}

// The start dialog's Random button: the Hex Terrain 3d6 table, Ocean row included. Nothing else
// rolls a terrain from a table.
export function rollStartingTerrain(rng: Rng = Math.random): Terrain {
  return terrainFor3d6(sumDice(3, 6, rng))
}

export function rollDangerLevel(rng: Rng = Math.random): DangerLevel {
  return dangerForD6(rollDie(6, rng))
}

// Step 2 of the spec: each land terrain's base frequency times the pair weight for every revealed
// neighbor, with the river rule (never uphill: nothing higher than `maxElevation`) and the inland
// Coast factor applied; one terrain picked in proportion. Ocean is never picked here. Pair
// weights are never 0, and Coast and Swamp (elevation 1) always pass the river rule, so the pool
// is never empty.
export function rollLandTerrain(neighbors: { terrain: Terrain }[], nextToSea: boolean, maxElevation: number, rng: Rng): Terrain {
  const options: [Terrain, number][] = []
  for (const terrain of LAND_TERRAINS) {
    if (TERRAIN_ELEVATION[terrain] > maxElevation) continue
    let weight = LAND_TERRAIN_BASE_WEIGHTS[terrain]
    for (const neighbor of neighbors) weight *= terrainPairWeight(terrain, neighbor.terrain)
    if (terrain === 'Coast' && !nextToSea) weight *= INLAND_COAST_FACTOR
    options.push([terrain, weight])
  }
  return pickWeighted(options, rng)
}

// Whether a revealed neighbor can take a river flowing out of a hex of `fromElevation`: it must
// be water or carry water (Ocean, Coast, a lake, Swamp, another river), be no higher, and not
// already drain back into this hex.
function canTakeRiver(neighbor: NeighborInfo, fromElevation: number): boolean {
  if (neighbor.riverReachesHex) return false
  if (TERRAIN_ELEVATION[neighbor.terrain] > fromElevation) return false
  return neighbor.terrain === 'Ocean' || neighbor.terrain === 'Coast' || neighbor.terrain === 'Swamp' || Boolean(neighbor.lake) || Boolean(neighbor.river)
}

// Step 4: where the river leaves. Returns null when no edge can take it (the river then ends in a
// new lake on this hex). An exit can point at an unrevealed hex, or at a revealed hex that can
// take the water; never at an edge the river came in through. Among the valid edges, the river
// prefers to keep going roughly straight (with one entry: straight on ×3, a 60° bend ×2, a 120°
// bend ×1) and to head for the sea (an edge onto the formula's sea, or a revealed Ocean or Coast
// hex, ×3) — a flavor choice of this project, so rivers read as rivers rather than random walks.
export function pickRiverExit(input: NewHexInput, terrain: Terrain, entries: HexDirection[], rng: Rng): HexDirection | null {
  const byDirection = new Map(input.neighbors.map((n) => [n.direction, n]))
  const elevation = TERRAIN_ELEVATION[terrain]
  const options: [HexDirection, number][] = []
  for (const direction of HEX_DIRECTIONS) {
    if (entries.includes(direction)) continue
    const neighbor = byDirection.get(direction)
    const target = neighborInDirection(input.coord, direction)
    let weight = 1
    if (neighbor) {
      if (!canTakeRiver(neighbor, elevation)) continue
      if (neighbor.terrain === 'Ocean' || neighbor.terrain === 'Coast') weight *= 3
    } else if (isSeaAt(input.worldSeed, target)) {
      weight *= 3
    }
    if (entries.length === 1) {
      const straight = oppositeDirection(entries[0])
      const turn = Math.min((direction - straight + 6) % 6, (straight - direction + 6) % 6)
      weight *= turn === 0 ? 3 : turn === 1 ? 2 : 1
    }
    options.push([direction, weight])
  }
  return options.length ? pickWeighted(options, rng) : null
}

// Directions of the revealed neighbors whose river exits point at the new hex.
export function riverEntriesFromNeighbors(neighbors: NeighborInfo[]): HexDirection[] {
  return neighbors.filter((n) => n.river && n.river.exit === oppositeDirection(n.direction)).map((n) => n.direction)
}

// Generates a revealed hex: sea or land from the world formula, land terrain from the neighbors,
// coast conversion, lake, river (the spec's steps — the lake is rolled before the river only
// because whether the hex holds a lake decides whether an inflowing river ends here), then danger
// and point of interest.
export function generateNextHexDetails(input: NewHexInput, rng: Rng = Math.random): GeneratedHexDetails {
  const { worldSeed, coord, neighbors, forcedTerrain } = input
  const entries = riverEntriesFromNeighbors(neighbors)

  // 1. Sea or land.
  const sea = forcedTerrain ? forcedTerrain === 'Ocean' : isSeaAt(worldSeed, coord)
  if (sea) {
    return { terrain: 'Ocean', danger: rollDangerLevel(rng), poi: rollPointOfInterest('Ocean', rng) }
  }

  // 2. Land terrain. A river flowing in caps the elevation at the lowest entry's (never uphill).
  const nextToSea = isNextToSea(worldSeed, coord) || neighbors.some((n) => n.terrain === 'Ocean')
  let terrain: Terrain
  if (forcedTerrain) {
    terrain = forcedTerrain
  } else {
    const entryElevations = neighbors.filter((n) => entries.includes(n.direction)).map((n) => TERRAIN_ELEVATION[n.terrain])
    const maxElevation = entryElevations.length ? Math.min(...entryElevations) : Infinity
    terrain = rollLandTerrain(neighbors, nextToSea, maxElevation, rng)
    // 3. Coast conversion.
    if (nextToSea && terrain !== 'Coast' && rng() < COAST_RATE[terrain]) terrain = 'Coast'
  }

  // 5. Lake.
  let lake = rng() < LAKE_CHANCE

  // 4. River: one flowing in continues; otherwise the hex may start one.
  let river: RiverData | undefined
  const hasRiver = entries.length > 0 || rng() < RIVER_SPRING_CHANCE[terrain]
  if (hasRiver) {
    const endsHere =
      terrain === 'Coast' ||
      (entries.length > 0 && (terrain === 'Swamp' || lake) && rng() >= RIVER_CONTINUES_PAST_SWAMP_OR_LAKE)
    if (endsHere) {
      river = { exit: null }
    } else {
      const exit = pickRiverExit(input, terrain, entries, rng)
      if (exit === null) lake = true
      river = { exit }
    }
  }

  return {
    terrain,
    danger: rollDangerLevel(rng),
    poi: rollPointOfInterest(terrain, rng),
    ...(river ? { river } : {}),
    ...(lake ? { lake: true as const } : {}),
  }
}

// Location Generator (house-rule expansion — see docs/plan-sites-settlements-mongo.md's
// "Location Generator expansion" section for the full locked table + provenance). Builds the POI
// for an already-decided Feature roll (1-200) — split out of rollPointOfInterest so a review tool
// (src/routes/PoiReviewPage.tsx) can force a specific roll without going through the outer 1-in-6
// gate. Terrain is not a fresh roll here — it reuses the hex's own already-rolled `terrain` (the
// Location Generator's own terrain roll was the same table as the hex's, so it was dropped; since
// punch-list item 1a the hex's terrain comes from the world formula and its neighbors).
export function pointOfInterestForFeatureRoll(terrain: Terrain, featureRoll: number, rng: Rng = Math.random): PointOfInterest {
  const entry = locationFeatureForD200(featureRoll)

  if (entry.routesTo === 'cataclysm') {
    const cataclysm = cataclysmForTerrain(terrain, rollDie(8, rng))
    return { location: entry.feature, development: '', cataclysm, siteKind: 'none' }
  }

  if (entry.routesTo === 'landmark') {
    const landmark = naturalLandmarkForTerrain(terrain)
    return { location: entry.feature, development: '', naturalLandmark: landmark, siteKind: 'none' }
  }

  const poi: PointOfInterest = {
    location: entry.feature,
    development: entry.flavor ?? '',
    siteKind: entry.routesTo,
    forcedType: entry.forcedType,
  }

  if (entry.routesTo === 'settlement' && entry.forcedType) {
    poi.settlementName = settlementNameForD20(rollDie(20, rng), settlementNameColumnFor(entry.forcedType))
  }

  return poi
}

export function rollPointOfInterest(terrain: Terrain, rng: Rng = Math.random): PointOfInterest | undefined {
  if (rollDie(6, rng) !== 1) return undefined
  return pointOfInterestForFeatureRoll(terrain, rollDie(200, rng), rng)
}

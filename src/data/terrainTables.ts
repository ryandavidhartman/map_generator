// Neighbor-weighted terrain (punch-list item 1a, built 2026-11-03): the numbers behind how a new
// hex's terrain relates to its neighbors. Spec: CLAUDE.md's "Overland" architecture notes (the
// user's agreed tables, with the pair-weight revision noted below). Used by
// engine/generateHex.ts; Ocean itself never comes from these tables — it comes from the seeded
// world formula (engine/worldFormula.ts), and these tables only decide what a land hex becomes.
//
// Tuning (2026-11-03, simulation in engine/worldSimulation.test.ts): the river spring chances
// and the lake chance were swept until the simulated campaigns hit the spec's targets (about 17%
// of land hexes carry a river, about 5% a lake). The "river continues out of a Swamp/lake" odds
// are an untuned judgment call. Everything else is the spec's own number.

import type { Terrain } from './tables'

// Base frequencies of the land-terrain roll: the Hex Terrain 3d6 table's row widths, in 216ths
// (3-4 Desert/arctic 4, 5-6 Swamp 16, 7-9 Grassland 61, 10-11 Forest/jungle 54, 12 Hills 25,
// 13-14 Coast 36, 17-18 Mountain 4). The Ocean row (15-16, 16) is left out: Ocean comes only from
// the world formula.
export const LAND_TERRAINS: Terrain[] = ['Desert/arctic', 'Swamp', 'Grassland', 'Forest/jungle', 'Hills', 'Coast', 'Mountain']

export const LAND_TERRAIN_BASE_WEIGHTS: Record<Terrain, number> = {
  'Desert/arctic': 4,
  Swamp: 16,
  Grassland: 61,
  'Forest/jungle': 54,
  Hills: 25,
  Coast: 36,
  Ocean: 0,
  Mountain: 4,
}

// Elevations: Ocean 0; Coast and Swamp 1; Grassland, Forest/jungle and Desert/arctic 2; Hills 3;
// Mountain 4. Rivers never flow uphill (see generateHex.ts).
export const TERRAIN_ELEVATION: Record<Terrain, number> = {
  Ocean: 0,
  Coast: 1,
  Swamp: 1,
  Grassland: 2,
  'Forest/jungle': 2,
  'Desert/arctic': 2,
  Hills: 3,
  Mountain: 4,
}

// Pair weights (symmetric): how much a revealed neighbor of terrain A multiplies the chance of
// terrain B for the new hex. Never 0, so some terrain is always available.
//
// Revised 2026-11-03 (user decision: raise the pair weights, leave the base table alone) to
// bring Mountain and Desert/arctic up from ~0.5% of hexes to the base table's ~1.9%. Under the
// original weights Grassland and Forest reinforce themselves (×4 per neighbor) so strongly that
// Mountain (×0.2 / ×0.3 against them) was reachable only next to Hills. Changed, in both
// directions of the table: Mountain×Grassland 0.2→1, Mountain×Forest 0.3→1, Mountain×Hills
// 3→8, Mountain×Mountain 4→10, Desert×Grassland 1→3, Desert×Forest 1→3, Desert×Desert 4→6
// (mountains now cluster on hill country and deserts clump once started). Simulated result:
// Mountain ~1.7%, Desert/arctic ~1.9% of revealed hexes (two seed sets).
const PAIR_ORDER: Terrain[] = ['Ocean', 'Coast', 'Swamp', 'Grassland', 'Forest/jungle', 'Desert/arctic', 'Hills', 'Mountain']
const PAIR_ROWS: number[][] = [
  //  Ocean Coast Swamp Grass Forest Desert Hills Mountain
  [20, 6, 1, 1, 1, 1, 0.5, 0.3], // Ocean
  [6, 3, 2, 2, 2, 1.5, 1, 0.5], // Coast
  [1, 2, 4, 1.5, 1.5, 0.5, 0.2, 0.02], // Swamp
  [1, 2, 1.5, 4, 2, 3, 2, 1], // Grassland
  [1, 2, 1.5, 2, 4, 3, 2, 1], // Forest/jungle
  [1, 1.5, 0.5, 3, 3, 6, 1, 0.2], // Desert/arctic
  [0.5, 1, 0.2, 2, 2, 1, 3, 8], // Hills
  [0.3, 0.5, 0.02, 1, 1, 0.2, 8, 10], // Mountain
]

export const TERRAIN_PAIR_WEIGHTS: Record<Terrain, Record<Terrain, number>> = Object.fromEntries(
  PAIR_ORDER.map((a, i) => [a, Object.fromEntries(PAIR_ORDER.map((b, j) => [b, PAIR_ROWS[i][j]]))]),
) as Record<Terrain, Record<Terrain, number>>

export function terrainPairWeight(a: Terrain, b: Terrain): number {
  return TERRAIN_PAIR_WEIGHTS[a][b]
}

// A Coast hex that isn't next to the formula's sea is (almost) never rolled: its base weight gets
// this extra factor.
export const INLAND_COAST_FACTOR = 0.05

// Coast rates: the chance that a land hex next to the sea becomes Coast, by the terrain it
// rolled. Coast and Ocean have no rate (already Coast; never land).
export const COAST_RATE: Record<Terrain, number> = {
  Grassland: 0.85,
  'Forest/jungle': 0.8,
  'Desert/arctic': 0.75,
  Hills: 0.7,
  Swamp: 0.6,
  Mountain: 0.5,
  Coast: 1,
  Ocean: 0,
}

// Rivers (a feature, not a terrain). A land hex that no river flows into rolls this chance of
// starting one (a spring). Desert/arctic springs are rare (the spec: rivers run "rarely through
// Desert/arctic"). Coast never starts a river (it is the sea's edge, where rivers end); Ocean is
// never asked.
export const RIVER_SPRING_CHANCE: Record<Terrain, number> = {
  Grassland: 0.1,
  'Forest/jungle': 0.1,
  Swamp: 0.1,
  Hills: 0.17,
  Mountain: 0.28,
  'Desert/arctic': 0.017,
  Coast: 0,
  Ocean: 0,
}

// A river flowing into a Swamp hex or a lake hex ends there, or occasionally continues out the
// other side — this is the "occasionally". An untuned judgment call (not swept by simulation).
export const RIVER_CONTINUES_PAST_SWAMP_OR_LAKE = 0.25

// Lakes: a feature on a land hex (about 5% of land hexes, spec). Rivers that can find no valid
// exit also end in a new lake on their hex, on top of this roll.
export const LAKE_CHANCE = 0.045

import type { Rng } from '../engine/dice'
import { generateNextHexDetails, rollDangerLevel, rollPointOfInterest, type NeighborInfo, type PointOfInterest } from '../engine/generateHex'
import { generateSiteForHex, type GeneratedSite } from '../engine/generateSite'
import { riverDrainsTo, type RiverData } from '../engine/rivers'
import { pickWorldSeedForStart } from '../engine/worldFormula'
import { dangerLevelDelta, isTerrain, type DangerLevel, type Terrain } from '../data/tables'
import { HEX_DIRECTIONS, hexId, neighborInDirection, neighborsOf, parseHexId, type AxialCoord } from '../hexgrid/hexMath'

export type Hex = {
  id: string
  q: number
  r: number
  terrain: Terrain
  danger: DangerLevel
  // Numeric Danger Level (house rule) — round(average of revealed neighbors' dangerLevel),
  // adjusted by this hex's own qualitative `danger` roll (dangerLevelDelta), floored at 1. The
  // starting hex is always 1. See computeHexDangerLevel below and dungeonTables.ts's
  // effectiveDungeonLevel, which builds on this for dungeon-shaped sites.
  dangerLevel: number
  poi?: PointOfInterest
  site?: GeneratedSite
  // Punch-list item 1a: a river is a feature of the hex, saved only as the edge it leaves through
  // (engine/rivers.ts works out where rivers come in from the neighbors' exits). A lake is a
  // feature too; both only on land hexes.
  river?: RiverData
  lake?: true
}

export type MapState = {
  hexes: Record<string, Hex>
  partyHexId: string | null
  selectedHexId: string | null
  // Seed of the world formula (engine/worldFormula.ts) that decides sea vs. land for every hex of
  // this campaign. Picked at START_MAP so the starting hex agrees with the chosen terrain.
  worldSeed: number
}

export const EMPTY_MAP_STATE: MapState = {
  hexes: {},
  partyHexId: null,
  selectedHexId: null,
  worldSeed: 0,
}

// Merges a loaded save over EMPTY_MAP_STATE rather than using it directly — a save from before a
// top-level MapState field existed would otherwise come back `undefined` at runtime despite the
// type saying otherwise. Per-hex fields (e.g. Hex.dangerLevel) aren't covered by this merge; a
// field that's present but needs content needs an explicit backfill here.
//
// A save from before punch-list item 1a (no world seed, or hexes still using the old
// 'River/coast' terrain) can't be continued — the world formula wouldn't know its sea from its
// land, and every Record<Terrain> lookup would crash on the old name — so it resets cleanly to a
// new map instead. All saves are test data; nothing is migrated.
export function withMapStateDefaults(loaded: Partial<MapState> | null): MapState {
  if (!loaded) return EMPTY_MAP_STATE
  const merged = { ...EMPTY_MAP_STATE, ...loaded }
  if (merged.partyHexId !== null && !isCurrentFormatSave(loaded)) return EMPTY_MAP_STATE
  return merged
}

function isCurrentFormatSave(loaded: Partial<MapState>): boolean {
  if (typeof loaded.worldSeed !== 'number') return false
  return Object.values(loaded.hexes ?? {}).every((hex) => isTerrain(hex?.terrain))
}

// What the hex generator gets to know about the revealed neighbors of a coordinate (see
// generateHex.ts's NeighborInfo): terrain, river and lake, plus whether that neighbor's river
// already drains into this coordinate.
export function neighborInfoFor(state: MapState, coord: AxialCoord): NeighborInfo[] {
  const id = hexId(coord)
  return HEX_DIRECTIONS.flatMap((direction) => {
    const neighbor = state.hexes[hexId(neighborInDirection(coord, direction))]
    if (!neighbor) return []
    return [
      {
        direction,
        terrain: neighbor.terrain,
        river: neighbor.river,
        lake: neighbor.lake,
        riverReachesHex: Boolean(neighbor.river) && riverDrainsTo(state.hexes, neighbor.id, id),
      },
    ]
  })
}

export type HexEditPatch = Partial<Pick<Hex, 'terrain' | 'danger' | 'dangerLevel' | 'poi'>>

// New hexes' Danger Level is neighbor-relative, not an independent roll: base = the rounded
// average of already-revealed neighbors' own dangerLevel (1 if this hex has none, i.e. the
// starting hex), then nudged by this hex's own qualitative Danger roll via dangerLevelDelta,
// floored at 1 so it never goes non-positive.
function computeHexDangerLevel(state: MapState, coord: AxialCoord, danger: DangerLevel): number {
  const neighborLevels = neighborsOf(coord)
    .map((n) => state.hexes[hexId(n)])
    .filter((h): h is Hex => Boolean(h))
    .map((h) => h.dangerLevel)
  const base = neighborLevels.length
    ? Math.round(neighborLevels.reduce((sum, level) => sum + level, 0) / neighborLevels.length)
    : 1
  return Math.max(1, base + dangerLevelDelta(danger))
}

export type MapAction =
  | { type: 'START_MAP'; terrain: Terrain; rng?: Rng }
  | { type: 'MOVE_PARTY_TO'; hexId: string; rng?: Rng }
  | { type: 'SELECT_HEX'; hexId: string }
  | { type: 'REROLL_HEX'; hexId: string; rng?: Rng }
  | { type: 'EDIT_HEX'; hexId: string; patch: HexEditPatch }
  | { type: 'GENERATE_SITE'; hexId: string; rng?: Rng }
  | { type: 'REROLL_SITE'; hexId: string; rng?: Rng }
  | { type: 'NEW_MAP' }

export function isRevealed(state: MapState, id: string): boolean {
  return id in state.hexes
}

export function isAdjacentToParty(state: MapState, id: string): boolean {
  if (!state.partyHexId) return false
  const party = parseHexId(state.partyHexId)
  return neighborsOf(party).some((n) => hexId(n) === id)
}

// Whether clicking this (unrevealed) hex right now would generate it.
export function isRevealableNow(state: MapState, id: string): boolean {
  if (isRevealed(state, id)) return false
  return isAdjacentToParty(state, id)
}

export function mapReducer(state: MapState, action: MapAction): MapState {
  switch (action.type) {
    case 'START_MAP': {
      const origin = { q: 0, r: 0 }
      const id = hexId(origin)
      const rng = action.rng ?? Math.random
      // The world is placed so the starting hex agrees with the chosen terrain.
      const worldSeed = pickWorldSeedForStart(action.terrain, rng)
      const details = generateNextHexDetails({ worldSeed, coord: origin, neighbors: [], forcedTerrain: action.terrain }, rng)
      // No neighbors exist yet — the starting hex is always Danger Level 1, fixed.
      const startHex: Hex = { id, q: origin.q, r: origin.r, ...details, dangerLevel: 1 }
      return {
        hexes: { [id]: startHex },
        partyHexId: id,
        selectedHexId: id,
        worldSeed,
      }
    }

    case 'MOVE_PARTY_TO': {
      if (!isAdjacentToParty(state, action.hexId)) return state

      const existing = state.hexes[action.hexId]
      if (existing) {
        return { ...state, partyHexId: action.hexId, selectedHexId: action.hexId }
      }

      const coord = parseHexId(action.hexId)
      if (!state.partyHexId) return state

      const details = generateNextHexDetails({ worldSeed: state.worldSeed, coord, neighbors: neighborInfoFor(state, coord) }, action.rng)
      const dangerLevel = computeHexDangerLevel(state, coord, details.danger)
      const newHex: Hex = { id: action.hexId, q: coord.q, r: coord.r, ...details, dangerLevel }

      return {
        ...state,
        hexes: { ...state.hexes, [action.hexId]: newHex },
        partyHexId: action.hexId,
        selectedHexId: action.hexId,
      }
    }

    case 'SELECT_HEX': {
      if (!isRevealed(state, action.hexId)) return state
      return { ...state, selectedHexId: action.hexId }
    }

    case 'REROLL_HEX': {
      const hex = state.hexes[action.hexId]
      if (!hex) return state
      const danger = rollDangerLevel(action.rng)
      const poi = rollPointOfInterest(hex.terrain, action.rng)
      const dangerLevel = computeHexDangerLevel(state, { q: hex.q, r: hex.r }, danger)
      return {
        ...state,
        // poi is always re-rolled here, so any previously generated site (derived from the
        // old poi) is now stale — clear it rather than leaving a mismatched site behind.
        hexes: { ...state.hexes, [action.hexId]: { ...hex, danger, dangerLevel, poi, site: undefined } },
      }
    }

    case 'EDIT_HEX': {
      const hex = state.hexes[action.hexId]
      if (!hex) return state
      const patchTouchesPoi = 'poi' in action.patch
      return {
        ...state,
        hexes: {
          ...state.hexes,
          [action.hexId]: {
            ...hex,
            ...action.patch,
            ...(patchTouchesPoi ? { site: undefined } : {}),
          },
        },
      }
    }

    case 'GENERATE_SITE': {
      const hex = state.hexes[action.hexId]
      if (!hex || !hex.poi || hex.site) return state
      const site = generateSiteForHex(hex.poi, action.rng, hex.dangerLevel ?? 1)
      return { ...state, hexes: { ...state.hexes, [action.hexId]: { ...hex, site } } }
    }

    case 'REROLL_SITE': {
      const hex = state.hexes[action.hexId]
      if (!hex || !hex.poi) return state
      const site = generateSiteForHex(hex.poi, action.rng, hex.dangerLevel ?? 1)
      return { ...state, hexes: { ...state.hexes, [action.hexId]: { ...hex, site } } }
    }

    case 'NEW_MAP':
      return EMPTY_MAP_STATE

    default:
      return state
  }
}

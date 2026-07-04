import type { Rng } from '../engine/dice'
import {
  generateNextHexDetails,
  generateStartingHexDetails,
  rollDangerLevel,
  rollPointOfInterest,
  type PointOfInterest,
} from '../engine/generateHex'
import { generateSiteForHex, type GeneratedSite } from '../engine/generateSite'
import type { DangerLevel, Terrain } from '../data/tables'
import { hexId, isWithinRadius, neighborsOf, parseHexId } from '../hexgrid/hexMath'

export type Hex = {
  id: string
  q: number
  r: number
  terrain: Terrain
  danger: DangerLevel
  poi?: PointOfInterest
  site?: GeneratedSite
}

export type MapState = {
  radius: number
  hexes: Record<string, Hex>
  partyHexId: string | null
  selectedHexId: string | null
}

export const EMPTY_MAP_STATE: MapState = {
  radius: 0,
  hexes: {},
  partyHexId: null,
  selectedHexId: null,
}

export type HexEditPatch = Partial<Pick<Hex, 'terrain' | 'danger' | 'poi'>>

export type MapAction =
  | { type: 'START_MAP'; terrain: Terrain; radius: number; rng?: Rng }
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
  if (!isAdjacentToParty(state, id)) return false
  return isWithinRadius(parseHexId(id), state.radius)
}

export function mapReducer(state: MapState, action: MapAction): MapState {
  switch (action.type) {
    case 'START_MAP': {
      const origin = { q: 0, r: 0 }
      const id = hexId(origin)
      const details = generateStartingHexDetails(action.terrain, action.rng)
      const startHex: Hex = { id, q: origin.q, r: origin.r, ...details }
      return {
        radius: action.radius,
        hexes: { [id]: startHex },
        partyHexId: id,
        selectedHexId: id,
      }
    }

    case 'MOVE_PARTY_TO': {
      if (!isAdjacentToParty(state, action.hexId)) return state

      const existing = state.hexes[action.hexId]
      if (existing) {
        return { ...state, partyHexId: action.hexId, selectedHexId: action.hexId }
      }

      const coord = parseHexId(action.hexId)
      if (!isWithinRadius(coord, state.radius)) return state
      if (!state.partyHexId) return state

      const currentTerrain = state.hexes[state.partyHexId].terrain
      const details = generateNextHexDetails(currentTerrain, action.rng)
      const newHex: Hex = { id: action.hexId, q: coord.q, r: coord.r, ...details }

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
      const poi = rollPointOfInterest(action.rng)
      return {
        ...state,
        // poi is always re-rolled here, so any previously generated site (derived from the
        // old poi) is now stale — clear it rather than leaving a mismatched site behind.
        hexes: { ...state.hexes, [action.hexId]: { ...hex, danger, poi, site: undefined } },
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
      const site = generateSiteForHex(hex.poi, action.rng)
      return { ...state, hexes: { ...state.hexes, [action.hexId]: { ...hex, site } } }
    }

    case 'REROLL_SITE': {
      const hex = state.hexes[action.hexId]
      if (!hex || !hex.poi) return state
      const site = generateSiteForHex(hex.poi, action.rng)
      return { ...state, hexes: { ...state.hexes, [action.hexId]: { ...hex, site } } }
    }

    case 'NEW_MAP':
      return EMPTY_MAP_STATE

    default:
      return state
  }
}

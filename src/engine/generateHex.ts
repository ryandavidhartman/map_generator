import { rollDie, roll2d6, type Rng } from './dice'
import {
  type Terrain,
  type DangerLevel,
  type SettlementColumn,
  terrainFor2d6,
  newHexResultFor2d6,
  stepTerrain,
  dangerForD6,
  pointOfInterestForD20,
  cataclysmForD8,
  settlementNameForD8,
  CATACLYSM_TRIGGER_DEVELOPMENT,
  SETTLEMENT_LOCATIONS,
} from '../data/tables'

export type PointOfInterest = {
  location: string
  development: string
  cataclysm?: string
  settlementName?: string
}

export type GeneratedHexDetails = {
  terrain: Terrain
  danger: DangerLevel
  poi?: PointOfInterest
}

export function rollStartingTerrain(rng: Rng = Math.random): Terrain {
  return terrainFor2d6(roll2d6(rng))
}

export function rollNextTerrain(currentTerrain: Terrain, rng: Rng = Math.random): Terrain {
  const result = newHexResultFor2d6(roll2d6(rng))
  if (result.kind === 'same') return currentTerrain
  if (result.kind === 'step') return stepTerrain(currentTerrain, result.steps)
  return rollStartingTerrain(rng)
}

export function rollDangerLevel(rng: Rng = Math.random): DangerLevel {
  return dangerForD6(rollDie(6, rng))
}

export function rollPointOfInterest(rng: Rng = Math.random): PointOfInterest | undefined {
  if (rollDie(6, rng) !== 1) return undefined

  const entry = pointOfInterestForD20(rollDie(20, rng))
  const poi: PointOfInterest = { location: entry.location, development: entry.development }

  if (entry.development === CATACLYSM_TRIGGER_DEVELOPMENT) {
    poi.cataclysm = cataclysmForD8(rollDie(8, rng))
  }

  if (SETTLEMENT_LOCATIONS.includes(entry.location)) {
    poi.settlementName = settlementNameForD8(rollDie(8, rng), entry.location as SettlementColumn)
  }

  return poi
}

export function generateStartingHexDetails(terrain: Terrain, rng: Rng = Math.random): GeneratedHexDetails {
  return {
    terrain,
    danger: rollDangerLevel(rng),
    poi: rollPointOfInterest(rng),
  }
}

export function generateNextHexDetails(currentTerrain: Terrain, rng: Rng = Math.random): GeneratedHexDetails {
  return {
    terrain: rollNextTerrain(currentTerrain, rng),
    danger: rollDangerLevel(rng),
    poi: rollPointOfInterest(rng),
  }
}

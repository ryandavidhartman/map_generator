// Transcribed from Shadowdark RPG, "Overland Hex Maps" (book pp. 132-133).
// Single source of truth for all book table data used by the generator.

export type Terrain =
  | 'Desert/arctic'
  | 'Swamp'
  | 'Grassland'
  | 'Forest/jungle'
  | 'River/coast'
  | 'Ocean'
  | 'Mountain'

// Circular loop order used for New Hex terrain stepping.
export const TERRAIN_ORDER: Terrain[] = [
  'Desert/arctic',
  'Swamp',
  'Grassland',
  'Forest/jungle',
  'River/coast',
  'Ocean',
  'Mountain',
]

export function stepTerrain(terrain: Terrain, steps: number): Terrain {
  const from = TERRAIN_ORDER.indexOf(terrain)
  const len = TERRAIN_ORDER.length
  const next = ((from + steps) % len + len) % len
  return TERRAIN_ORDER[next]
}

// Hex Terrain table (2d6) — rolls a fresh terrain.
export function terrainFor2d6(roll: number): Terrain {
  if (roll === 2) return 'Desert/arctic'
  if (roll === 3) return 'Swamp'
  if (roll >= 4 && roll <= 6) return 'Grassland'
  if (roll >= 7 && roll <= 8) return 'Forest/jungle'
  if (roll >= 9 && roll <= 10) return 'River/coast'
  if (roll === 11) return 'Ocean'
  if (roll === 12) return 'Mountain'
  throw new Error(`terrainFor2d6: roll out of range: ${roll}`)
}

// New Hex table (2d6) — relative to the terrain of the hex being left.
export type NewHexResult =
  | { kind: 'step'; steps: 1 | 2 }
  | { kind: 'same' }
  | { kind: 'reroll' }

export function newHexResultFor2d6(roll: number): NewHexResult {
  if (roll >= 2 && roll <= 3) return { kind: 'step', steps: 1 }
  if (roll >= 4 && roll <= 8) return { kind: 'same' }
  if (roll >= 9 && roll <= 11) return { kind: 'step', steps: 2 }
  if (roll === 12) return { kind: 'reroll' }
  throw new Error(`newHexResultFor2d6: roll out of range: ${roll}`)
}

// Danger Level table (d6).
export type DangerLevel = 'Safe' | 'Unsafe' | 'Risky' | 'Deadly'

export function dangerForD6(roll: number): DangerLevel {
  if (roll === 1) return 'Safe'
  if (roll >= 2 && roll <= 3) return 'Unsafe'
  if (roll >= 4 && roll <= 5) return 'Risky'
  if (roll === 6) return 'Deadly'
  throw new Error(`dangerForD6: roll out of range: ${roll}`)
}

// Settlement Name table (d8) — four columns, keyed by the forced Settlement Type from the
// Location Generator's Feature table (src/data/locationTables.ts). Village/Town/City/Metropolis
// used to share a combined "City/metropolis" column under the old d20 Points of Interest table
// (removed — superseded by locationTables.ts); split into 4 distinct columns here since the new
// Feature table now distinguishes City from Metropolis (invented flavor names, not book RAW).
export type SettlementColumn = 'Village' | 'Town' | 'City' | 'Metropolis'

export const SETTLEMENT_LOCATIONS: readonly string[] = ['Village', 'Town', 'City', 'Metropolis']

const SETTLEMENT_NAMES: Record<SettlementColumn, string[]> = {
  Village: ["Bruga's Hold", 'Lastwatch', 'Darkwater', 'Ostlin', 'Treefall', 'Vorn', 'Hillshire', 'Nighthaven'],
  Town: ['Fairhollow', "Ivan's Keep", 'Galina', 'Brightlantern', "Corvin's Crest", 'Ironbridge', 'Skalvin', 'Toresk'],
  City: ['Doraine', 'Meridia', "King's Gate", 'Myrkhos', 'Rularn', 'Ordos', 'Thane', 'Rahgbat'],
  Metropolis: ['Karrathis', 'Vaelspire', 'Grand Ostrum', 'Thessaly', 'Baradun', 'Solmere', 'Vantara', 'Old Korrigal'],
}

export function settlementNameForD8(roll: number, column: SettlementColumn): string {
  if (roll < 1 || roll > 8) {
    throw new Error(`settlementNameForD8: roll out of range: ${roll}`)
  }
  return SETTLEMENT_NAMES[column][roll - 1]
}

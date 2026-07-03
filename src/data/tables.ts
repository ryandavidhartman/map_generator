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

// Points of Interest table (d20).
export type PointOfInterestEntry = {
  location: string
  development: string
}

const POINTS_OF_INTEREST: PointOfInterestEntry[] = [
  { location: 'Small tower', development: 'Disaster! Roll on Cataclysm table' },
  { location: 'Fortified keep', development: 'Over/connected to a large tomb' },
  { location: 'Natural landmark', development: 'Being attacked by an invader' },
  { location: 'Natural landmark', development: 'Being attacked by an invader' },
  { location: 'Temple', development: 'Home to an oracle' },
  { location: 'Barrow mounds', development: 'Around/over a sleeping dragon' },
  { location: 'Village', development: 'Abandoned and in ruins' },
  { location: 'Village', development: 'Abandoned and in ruins' },
  { location: 'Town', development: 'Guarded by its current residents' },
  { location: 'Town', development: 'Guarded by its current residents' },
  { location: 'City/metropolis', development: 'Under siege by a warband' },
  { location: 'Ravine', development: 'Home to a religious cult' },
  { location: 'Monster nest', development: 'Where a secret circle of wizards meets' },
  { location: 'Monster nest', development: 'Where a secret circle of wizards meets' },
  { location: "Hermit's abode", development: 'Occupied by a self-titled king/queen' },
  { location: 'Cave formation', development: 'Controlled by a malevolent sorcerer' },
  { location: 'Cave formation', development: 'Controlled by a malevolent sorcerer' },
  { location: 'Ancient dolmens', development: 'Protected by an age-old guardian' },
  { location: 'Barbarian camp', development: 'Hiding a great treasure' },
  { location: 'Holy shrine', development: 'With a door to another plane' },
]

export function pointOfInterestForD20(roll: number): PointOfInterestEntry {
  if (roll < 1 || roll > 20) {
    throw new Error(`pointOfInterestForD20: roll out of range: ${roll}`)
  }
  return POINTS_OF_INTEREST[roll - 1]
}

export const CATACLYSM_TRIGGER_DEVELOPMENT = 'Disaster! Roll on Cataclysm table'

// Cataclysm table (d8).
const CATACLYSMS = [
  'Volcano',
  'Fire',
  'Earthquake',
  'Storm',
  'Flood',
  'War',
  'Pestilence',
  'Magical disaster',
] as const

export function cataclysmForD8(roll: number): string {
  if (roll < 1 || roll > 8) {
    throw new Error(`cataclysmForD8: roll out of range: ${roll}`)
  }
  return CATACLYSMS[roll - 1]
}

// Settlement Name table (d8) — three columns, keyed by POI location.
export type SettlementColumn = 'Village' | 'Town' | 'City/metropolis'

export const SETTLEMENT_LOCATIONS: readonly string[] = ['Village', 'Town', 'City/metropolis']

const SETTLEMENT_NAMES: Record<SettlementColumn, string[]> = {
  Village: ["Bruga's Hold", 'Lastwatch', 'Darkwater', 'Ostlin', 'Treefall', 'Vorn', 'Hillshire', 'Nighthaven'],
  Town: ['Fairhollow', "Ivan's Keep", 'Galina', 'Brightlantern', "Corvin's Crest", 'Ironbridge', 'Skalvin', 'Toresk'],
  'City/metropolis': ['Doraine', 'Meridia', "King's Gate", 'Myrkhos', 'Rularn', 'Ordos', 'Thane', 'Rahgbat'],
}

export function settlementNameForD8(roll: number, column: SettlementColumn): string {
  if (roll < 1 || roll > 8) {
    throw new Error(`settlementNameForD8: roll out of range: ${roll}`)
  }
  return SETTLEMENT_NAMES[column][roll - 1]
}

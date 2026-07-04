// Transcribed from Shadowdark RPG, "Shadowdark Maps" (dungeon/site generation, book pp. 130-131).
// Site Type/Size are rolled fresh at generation time (never derived from an overland POI's
// location text — see the plan's "Two mechanical points" note). Room/detail sub-tables follow
// the same private-const + exported-pure-lookup-function pattern as src/data/tables.ts.

import type { DangerLevel } from './tables'

// Site Size table (d6) — dice count IS the room count (one die per room), never summed.
export type SiteSize = 'Small' | 'Medium' | 'Large'
export type SiteSizeSpec = { size: SiteSize; roomCount: number }

const SITE_SIZE_SPECS: Record<SiteSize, SiteSizeSpec> = {
  Small: { size: 'Small', roomCount: 5 },
  Medium: { size: 'Medium', roomCount: 8 },
  Large: { size: 'Large', roomCount: 12 },
}

export function siteSizeForD6(roll: number): SiteSizeSpec {
  if (roll < 1 || roll > 6) throw new Error(`siteSizeForD6: roll out of range: ${roll}`)
  if (roll <= 2) return SITE_SIZE_SPECS.Small
  if (roll <= 5) return SITE_SIZE_SPECS.Medium
  return SITE_SIZE_SPECS.Large
}

// Site Type table (d6).
export type SiteType = 'Cave' | 'Tomb' | 'Deep tunnels' | 'Ruins'

export function siteTypeForD6(roll: number): SiteType {
  if (roll < 1 || roll > 6) throw new Error(`siteTypeForD6: roll out of range: ${roll}`)
  if (roll <= 2) return 'Cave'
  if (roll === 3) return 'Tomb'
  if (roll === 4) return 'Deep tunnels'
  return 'Ruins'
}

// Room Type table (d10). Each room's die also serves as the room-type roll — see engine.
export type RoomType =
  | 'Empty'
  | 'Trap'
  | 'Minor Hazard'
  | 'Solo Monster'
  | 'NPC'
  | 'Monster Mob'
  | 'Major Hazard'
  | 'Treasure'
  | 'Boss Monster'

export function roomTypeForD10(roll: number): RoomType {
  if (roll < 1 || roll > 10) throw new Error(`roomTypeForD10: roll out of range: ${roll}`)
  if (roll <= 2) return 'Empty'
  if (roll === 3) return 'Trap'
  if (roll === 4) return 'Minor Hazard'
  if (roll === 5) return 'Solo Monster'
  if (roll === 6) return 'NPC'
  if (roll === 7) return 'Monster Mob'
  if (roll === 8) return 'Major Hazard'
  if (roll === 9) return 'Treasure'
  return 'Boss Monster'
}

// Room-type detail sub-tables (all d6). Some are two independent-roll "mix and match"
// columns (Detail | Detail, matching the generator-table convention used elsewhere in the
// book, e.g. NPC Names by Syllable / Tavern Generator); others are a single "Details" column.
export const ROOM_TYPE_NEEDS_TWO_ROLLS: Record<RoomType, boolean> = {
  Empty: false,
  Trap: true,
  'Minor Hazard': false,
  'Solo Monster': true,
  NPC: false,
  'Monster Mob': true,
  'Major Hazard': false,
  Treasure: false,
  'Boss Monster': false,
}

const TRAP_COLUMN_A = ['Crude', 'Ranged', 'Sturdy', 'Sturdy', 'Ancient', 'Large']
const TRAP_COLUMN_B = ['Ensnaring', 'Toxic', 'Mechanical', 'Mechanical', 'Magical', 'Deadly']

const MONSTER_MOB_COLUMN_A = ['Stealthy', 'Reckless', 'Reckless', 'Magical', 'Primitive', 'Organized']
const MONSTER_MOB_COLUMN_B = ['Outcasts', 'Minions', 'Minions', 'Tricksters', 'Vermin', 'Warriors']

const SOLO_MONSTER_COLUMN_A = ['Sneaky', 'Mighty', 'Mighty', 'Clever', 'Clever', 'Mutated']
const SOLO_MONSTER_COLUMN_B = ['Ambusher', 'Brute', 'Brute', 'Spellcaster', 'Spellcaster', 'Pariah']

const MINOR_HAZARD_DETAILS = [
  'Short fall',
  'Stuck or locked barrier',
  'Stuck or locked barrier',
  'Dense rubble',
  'Collapsing walls',
  'Enfeebling magic',
]

const MAJOR_HAZARD_DETAILS = [
  'Long fall',
  'Long fall',
  'Toxic gas or vapors',
  'Entrapping terrain',
  'Antimagic zone',
  'Drowning hazard',
]

const TREASURE_DETAILS = [
  'Hidden',
  'Hidden',
  'Guarded by monster',
  'Guarded by monster',
  'Protected by trap',
  'Protected by hazard',
]

const NPC_DETAILS = ['Hiding', 'Captive', 'Captive', 'Wounded', 'Wounded', 'Rival crawlers']

const BOSS_MONSTER_DETAILS = [
  'Physically strongest',
  'Religious leader',
  'Guarded by minions',
  'Guarded by minions',
  'Guarded by minions',
  'Supreme sorcerer',
]

function lookupD6(table: string[], roll: number, tableName: string): string {
  if (roll < 1 || roll > 6) throw new Error(`${tableName}: roll out of range: ${roll}`)
  return table[roll - 1]
}

export function trapDetailForD6(rollA: number, rollB: number): string {
  return `${lookupD6(TRAP_COLUMN_A, rollA, 'trapDetailForD6 (a)')} ${lookupD6(TRAP_COLUMN_B, rollB, 'trapDetailForD6 (b)')}`
}

export function monsterMobDetailForD6(rollA: number, rollB: number): string {
  return `${lookupD6(MONSTER_MOB_COLUMN_A, rollA, 'monsterMobDetailForD6 (a)')} ${lookupD6(MONSTER_MOB_COLUMN_B, rollB, 'monsterMobDetailForD6 (b)')}`
}

export function soloMonsterDetailForD6(rollA: number, rollB: number): string {
  return `${lookupD6(SOLO_MONSTER_COLUMN_A, rollA, 'soloMonsterDetailForD6 (a)')} ${lookupD6(SOLO_MONSTER_COLUMN_B, rollB, 'soloMonsterDetailForD6 (b)')}`
}

export function minorHazardForD6(roll: number): string {
  return lookupD6(MINOR_HAZARD_DETAILS, roll, 'minorHazardForD6')
}

export function majorHazardForD6(roll: number): string {
  return lookupD6(MAJOR_HAZARD_DETAILS, roll, 'majorHazardForD6')
}

export function treasureDetailForD6(roll: number): string {
  return lookupD6(TREASURE_DETAILS, roll, 'treasureDetailForD6')
}

export function npcDetailForD6(roll: number): string {
  return lookupD6(NPC_DETAILS, roll, 'npcDetailForD6')
}

export function bossMonsterDetailForD6(roll: number): string {
  return lookupD6(BOSS_MONSTER_DETAILS, roll, 'bossMonsterDetailForD6')
}

// Dispatch used by the engine: given a room type and its already-rolled d6(s), return the
// detail string (or undefined for Empty rooms, which have no sub-table).
export function roomDetailForType(type: RoomType, rollA: number, rollB?: number): string | undefined {
  switch (type) {
    case 'Empty':
      return undefined
    case 'Trap':
      return trapDetailForD6(rollA, rollB!)
    case 'Minor Hazard':
      return minorHazardForD6(rollA)
    case 'Solo Monster':
      return soloMonsterDetailForD6(rollA, rollB!)
    case 'NPC':
      return npcDetailForD6(rollA)
    case 'Monster Mob':
      return monsterMobDetailForD6(rollA, rollB!)
    case 'Major Hazard':
      return majorHazardForD6(rollA)
    case 'Treasure':
      return treasureDetailForD6(rollA)
    case 'Boss Monster':
      return bossMonsterDetailForD6(rollA)
  }
}

// Dungeon Danger Level table (d6) — distinct from the overland hex Danger Level table
// (no "Safe" outcome here). Reuses the shared DangerLevel type for color-map/UI consistency.
export function dungeonDangerForD6(roll: number): DangerLevel {
  if (roll < 1 || roll > 6) throw new Error(`dungeonDangerForD6: roll out of range: ${roll}`)
  if (roll <= 3) return 'Unsafe'
  if (roll <= 5) return 'Risky'
  return 'Deadly'
}

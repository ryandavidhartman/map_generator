// Shared per-room content rolling (Room Type d10 + detail sub-table + monster/NPC attachment),
// factored out of generateDungeon.ts so generateTower.ts can reuse the exact same book-RAW
// content table without duplicating the logic — per the confirmed design, Tower's identity is
// its shape, not bespoke content ("reuse the existing d10 Room Type table, unmodified").

import { rollDie, type Rng } from './dice'
import { roomTypeForD10, roomDetailForType, ROOM_TYPE_NEEDS_TWO_ROLLS, type RoomType } from '../data/dungeonTables'
import { rollMonster, rollNpcType, BOSS_EXCLUDED_CATEGORIES, type MonsterCategory, type MonsterEntry } from '../data/monsterTables'
import { rollTreasure, type RolledTreasure } from './generateTreasure'
import { rollTrap, type RolledTrap } from './generateDressing'

// Room types that get a rolled creature attached, on top of their existing book-RAW flavor
// descriptor (e.g. "Mighty Brute") — see monsterTables.ts for the name-only/no-stats scope.
const MONSTER_ROOM_TYPES: RoomType[] = ['Solo Monster', 'Monster Mob', 'Boss Monster']

export type GeneratedMonster = MonsterEntry
export type GeneratedNpc = { type: string }

export type RolledRoomContent = {
  roomType: RoomType
  roomTypeRoll: number
  detail?: string
  monster?: GeneratedMonster
  npc?: GeneratedNpc
  treasure?: RolledTreasure
  trap?: RolledTrap
}

// `theme` is the site's ONE locked monster category (from rollMonsterTheme, rolled once by the
// site generator — see monsterTables.ts) — every room-content roll for a given site should pass
// the same theme, so the site's monsters read as one coherent faction rather than an
// independently-rolled grab bag. Boss Monster additionally hard-excludes
// BOSS_EXCLUDED_CATEGORIES (Animal/Insect) regardless of theme — even a themed "Animal" dungeon's
// boss shouldn't be a giant ferret.
// `dungeonLevel` scales a Treasure room's amount/magic-item-count per B/X's Table 12 note — see
// generateTreasure.ts. Defaults to 1 (the minimum, and Shadowdark's own book has no depth
// concept at all) so callers that don't care about treasure scaling don't need to thread it.
export function rollRoomContent(rng: Rng, theme?: MonsterCategory, dungeonLevel = 1): RolledRoomContent {
  const roomTypeRoll = rollDie(10, rng)
  const roomType = roomTypeForD10(roomTypeRoll)
  const detail: string | undefined =
    roomType === 'Empty'
      ? undefined
      : ROOM_TYPE_NEEDS_TWO_ROLLS[roomType]
        ? roomDetailForType(roomType, rollDie(6, rng), rollDie(6, rng))
        : roomDetailForType(roomType, rollDie(6, rng))

  const isBoss = roomType === 'Boss Monster'
  const monster: GeneratedMonster | undefined = MONSTER_ROOM_TYPES.includes(roomType)
    ? rollMonster(rng, { theme, excludeMundane: isBoss, excludeCategories: isBoss ? BOSS_EXCLUDED_CATEGORIES : undefined })
    : undefined
  const npc: GeneratedNpc | undefined = roomType === 'NPC' ? { type: rollNpcType(rng) } : undefined
  // Treasure is its own distinct Room Type outcome (not retroactively rolled for monster
  // rooms) — the "guarded by a monster" bonus (roll the Amount table twice, +1 each) maps onto
  // this room's own "Guarded by monster" detail result instead. See treasureTables.ts's header.
  const treasure: RolledTreasure | undefined =
    roomType === 'Treasure' ? rollTreasure(rng, dungeonLevel, detail === 'Guarded by monster') : undefined
  // A concrete named mechanism + severity, additive to Shadowdark's existing 2-word Trap
  // flavor tag above — see data/trapTables.ts's header.
  const trap: RolledTrap | undefined = roomType === 'Trap' ? rollTrap(rng, dungeonLevel) : undefined

  return { roomType, roomTypeRoll, detail, monster, npc, treasure, trap }
}

// A "reroll-toward" bias, not a hard override (confirmed 2026-07-04, for Keep's Armory/Lord's
// Quarters slots): roll normally, and only if that miss the desired type(s) get a single second
// chance to land on one of them. A second full roll (detail/monster/npc included) is only ever
// consumed when the first roll needs it — same conditional-consumption shape as the detail
// sub-roll above, not a fixed extra cost every time.
export function rollBiasedRoomContent(rng: Rng, biasedTowardTypes: RoomType[], theme?: MonsterCategory, dungeonLevel = 1): RolledRoomContent {
  const first = rollRoomContent(rng, theme, dungeonLevel)
  if (biasedTowardTypes.includes(first.roomType)) return first
  const second = rollRoomContent(rng, theme, dungeonLevel)
  return biasedTowardTypes.includes(second.roomType) ? second : first
}

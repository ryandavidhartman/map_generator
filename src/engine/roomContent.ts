// Shared per-room content rolling (Room Type d10 + detail sub-table + monster/NPC attachment),
// factored out of generateDungeon.ts so generateTower.ts can reuse the exact same book-RAW
// content table without duplicating the logic — per the confirmed design, Tower's identity is
// its shape, not bespoke content ("reuse the existing d10 Room Type table, unmodified").

import { rollDie, type Rng } from './dice'
import { roomTypeForD10, roomDetailForType, ROOM_TYPE_NEEDS_TWO_ROLLS, type RoomType, type SiteType } from '../data/dungeonTables'
import { rollMonster, rollNpcType, type MonsterEntry } from '../data/monsterTables'

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
}

// `siteType` is optional — Tower has no SiteType (Cave/Tomb/Deep tunnels/Ruins are the only
// values), so its rooms roll without site-type theming. Flavor-aware content generation for
// the new site kinds was explicitly deferred (flavor stored as data, not wired into content
// tables yet), so this omission is intentional, not a gap to fill later by accident.
export function rollRoomContent(rng: Rng, siteType?: SiteType): RolledRoomContent {
  const roomTypeRoll = rollDie(10, rng)
  const roomType = roomTypeForD10(roomTypeRoll)
  const detail: string | undefined =
    roomType === 'Empty'
      ? undefined
      : ROOM_TYPE_NEEDS_TWO_ROLLS[roomType]
        ? roomDetailForType(roomType, rollDie(6, rng), rollDie(6, rng))
        : roomDetailForType(roomType, rollDie(6, rng))

  const monster: GeneratedMonster | undefined = MONSTER_ROOM_TYPES.includes(roomType)
    ? rollMonster(rng, { siteType, excludeMundane: roomType === 'Boss Monster' })
    : undefined
  const npc: GeneratedNpc | undefined = roomType === 'NPC' ? { type: rollNpcType(rng) } : undefined

  return { roomType, roomTypeRoll, detail, monster, npc }
}

// A "reroll-toward" bias, not a hard override (confirmed 2026-07-04, for Keep's Armory/Lord's
// Quarters slots): roll normally, and only if that miss the desired type(s) get a single second
// chance to land on one of them. A second full roll (detail/monster/npc included) is only ever
// consumed when the first roll needs it — same conditional-consumption shape as the detail
// sub-roll above, not a fixed extra cost every time.
export function rollBiasedRoomContent(rng: Rng, biasedTowardTypes: RoomType[], siteType?: SiteType): RolledRoomContent {
  const first = rollRoomContent(rng, siteType)
  if (biasedTowardTypes.includes(first.roomType)) return first
  const second = rollRoomContent(rng, siteType)
  return biasedTowardTypes.includes(second.roomType) ? second : first
}

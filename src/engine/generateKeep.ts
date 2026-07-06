// Keep: a new site kind (house-rule extension, not book RAW), confirmed 2026-07-04 as part of
// expanding the overland Points of Interest table into a d200 "Location Generator" — see
// docs/plan-sites-settlements-mongo.md's "Location Generator" section for the full design
// conversation and routing table. Keep's identity is a fortified above-ground compound:
// a courtyard hub with named trope rooms as spokes (max 2 hops from the hub), not Tower's
// vertical chain or a dungeon's open room graph.
//
// Confirmed spec:
// - Above-ground room count (excluding the courtyard) reuses the Size roll, remapped via
//   keepRoomCountRangeForSize — same "reuse Size, don't invent a second axis" pattern as Tower.
// - Courtyard is always room #1, the hub. Named trope slots (Hall, Barracks, Armory, Lord's
//   Quarters) fill first-hop spoke positions in that priority order, up to however many rooms
//   Size provides — a Small keep (3-4 rooms) may not get all 4 named slots; Medium/Large always
//   do. Any rooms beyond the 4 named slots are generic (plain d10 roll, no name) and attach as
//   second-hop rooms off a named room (round-robin), respecting "never more than 2 hops."
// - Content reuses the existing Room Type d10 table everywhere. Armory and Lord's Quarters get
//   a "reroll-toward" bias (see roomContent.ts's rollBiasedRoomContent) toward Treasure and
//   NPC/Boss Monster respectively — a soft nudge, not a hard override.
// - Objective placement uses the *normal* "highest Room Type roll wins" rule, unlike Tower —
//   Keep's hub-and-spoke shape doesn't have the "anticlimactic long walk" failure mode that
//   made Tower's hard override necessary.
// - An optional basement is a GM choice, not a roll — see generateKeepBasement below, which
//   simply reuses generateDungeonSite forced to 'Deep tunnels' as an ephemeral, re-rollable
//   generator (same pattern as generateTavern/generateShop), not part of the persisted KeepSite.
// - Rendering reuses DungeonMapSvg unchanged (see keepLayout.ts) — that component only cares
//   about rects + connections, not the algorithm that produced them.

import { rollDie, type Rng } from './dice'
import { siteSizeForD6, keepRoomCountRangeForSize, dungeonDangerForD6, type SiteSize, type RoomType } from '../data/dungeonTables'
import type { DangerLevel } from '../data/tables'
import { rollRoomContent, rollBiasedRoomContent, type GeneratedMonster, type GeneratedNpc } from './roomContent'
import { rollMonsterTheme } from '../data/monsterTables'
import { computeKeepLayout, type Rect } from './keepLayout'
import { generateDungeonSite, type DungeonSite } from './generateDungeon'

const NAMED_SLOTS = ['Hall', 'Barracks', 'Armory', "Lord's Quarters"] as const
type NamedSlot = (typeof NAMED_SLOTS)[number]

const NAMED_SLOT_BIAS: Partial<Record<NamedSlot, RoomType[]>> = {
  Armory: ['Treasure'],
  "Lord's Quarters": ['NPC', 'Boss Monster'],
}

export type KeepRoom = {
  id: string
  name: string
  isCourtyard: boolean
  isNamed: boolean
  roomType: RoomType
  roomTypeRoll: number
  detail?: string
  monster?: GeneratedMonster
  npc?: GeneratedNpc
  isObjectiveRoom: boolean
  rect: Rect
}

export type KeepSite = {
  kind: 'keep'
  size: SiteSize
  danger: DangerLevel
  rooms: KeepRoom[]
  connections: [string, string][]
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z]+/g, '-')
}

export function generateKeepSite(rng: Rng = Math.random): KeepSite {
  const size = siteSizeForD6(rollDie(6, rng)).size
  const danger = dungeonDangerForD6(rollDie(6, rng))
  const range = keepRoomCountRangeForSize(size)
  const aboveGroundRoomCount = range.min + rollDie(2, rng) - 1

  const namedCount = Math.min(aboveGroundRoomCount, NAMED_SLOTS.length)
  const genericCount = aboveGroundRoomCount - namedCount
  // Round-robin: generic room i attaches to named room (i % namedCount).
  const genericParentIndices = Array.from({ length: genericCount }, (_, i) => i % namedCount)

  const layout = computeKeepLayout(namedCount, genericParentIndices)
  // Rolled once per site (Keep has no SiteType, so this picks uniformly across all categories),
  // not once per room — see monsterTables.ts's rollMonsterTheme.
  const monsterTheme = rollMonsterTheme(rng)

  const rooms: KeepRoom[] = []
  const connections: [string, string][] = []

  const courtyardContent = rollRoomContent(rng, monsterTheme)
  rooms.push({ id: 'courtyard', name: 'Courtyard', isCourtyard: true, isNamed: true, ...courtyardContent, isObjectiveRoom: false, rect: layout.courtyard })

  const namedRoomIds: string[] = []
  for (let i = 0; i < namedCount; i++) {
    const name = NAMED_SLOTS[i]
    const bias = NAMED_SLOT_BIAS[name]
    const content = bias ? rollBiasedRoomContent(rng, bias, monsterTheme) : rollRoomContent(rng, monsterTheme)
    const id = `room-${slugify(name)}`
    rooms.push({ id, name, isCourtyard: false, isNamed: true, ...content, isObjectiveRoom: false, rect: layout.named[i] })
    connections.push(['courtyard', id])
    namedRoomIds.push(id)
  }

  for (let i = 0; i < genericCount; i++) {
    const parentId = namedRoomIds[genericParentIndices[i]]
    const content = rollRoomContent(rng, monsterTheme)
    const id = `room-generic-${i}`
    rooms.push({ id, name: `Room ${i + 1}`, isCourtyard: false, isNamed: false, ...content, isObjectiveRoom: false, rect: layout.generic[i] })
    connections.push([parentId, id])
  }

  // Normal "highest roll wins" rule (book-RAW dungeon convention) — Keep's shape doesn't have
  // Tower's anticlimactic-walk failure mode, so no hard override is needed here.
  let objectiveIndex = 0
  for (let i = 1; i < rooms.length; i++) {
    if (rooms[i].roomTypeRoll > rooms[objectiveIndex].roomTypeRoll) objectiveIndex = i
  }
  rooms[objectiveIndex] = { ...rooms[objectiveIndex], isObjectiveRoom: true }

  return { kind: 'keep', size, danger, rooms, connections }
}

// Optional basement — GM choice, not a roll. Ephemeral/re-rollable like generateTavern/
// generateShop: not part of the persisted KeepSite, just reuses the existing dungeon generator
// forced to Deep Tunnels rather than inventing Keep-specific basement logic.
export function generateKeepBasement(rng: Rng = Math.random): DungeonSite {
  return generateDungeonSite(rng, 'Deep tunnels')
}

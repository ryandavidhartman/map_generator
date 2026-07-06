// Tower: a new site kind (house-rule extension, not book RAW), confirmed 2026-07-04 as part of
// expanding the overland Points of Interest table into a d200 "Location Generator" — see
// docs/plan-sites-settlements-mongo.md's "Location Generator" section for the full design
// conversation and routing table. Tower's identity is entirely structural: a vertical, mostly
// linear climb (unlike a dungeon's branching room graph), with the climax hard-coded at the
// top rather than wherever the highest Room Type roll happens to land.
//
// Confirmed spec:
// - Level count reuses the Size roll (siteSizeForD6) remapped via towerLevelRangeForSize,
//   rather than inventing a second size axis.
// - Ground floor always has exactly 2 rooms: the entry hall (continues the climb) and a guard
//   room (a side pocket off the entry hall — the one permitted branch, always at the bottom,
//   always rejoining before the climb starts). Every level above that has exactly 1 room.
// - Content reuses the existing Room Type d10 table unmodified (roomContent.ts) — Tower's
//   differentiator is shape, not bespoke content. Tower has no SiteType (Cave/Tomb/Deep
//   tunnels/Ruins are the only values), so its one locked monster theme (rollMonsterTheme,
//   2026-07-06) picks uniformly across all categories rather than being site-type-biased —
//   still a single coherent theme per tower, just without site-type flavor to lean on.
// - The top level is always the objective, regardless of its own Room Type roll — overriding
//   the "highest roll wins" rule every other kind uses. Room Type is still rolled normally for
//   the top level; it decides *what kind* of climax, not *whether* it's the climax. When the
//   rolled level count is 1 (the Small tier's minimum), the "top level" and the entry hall are
//   the same room, which falls out of the loop below without needing a special case.

import { rollDie, type Rng } from './dice'
import { siteSizeForD6, towerLevelRangeForSize, dungeonDangerForD6, type SiteSize } from '../data/dungeonTables'
import type { DangerLevel } from '../data/tables'
import { rollRoomContent, type GeneratedMonster, type GeneratedNpc } from './roomContent'
import { rollMonsterTheme } from '../data/monsterTables'
import type { RoomType } from '../data/dungeonTables'

export type TowerRoom = {
  id: string
  levelIndex: number // 0 = ground floor; the guard room shares levelIndex 0 with the entry hall
  isGuardRoom: boolean
  roomType: RoomType
  roomTypeRoll: number
  detail?: string
  monster?: GeneratedMonster
  npc?: GeneratedNpc
  isObjectiveRoom: boolean
}

export type TowerSite = {
  kind: 'tower'
  size: SiteSize
  danger: DangerLevel
  levelCount: number
  rooms: TowerRoom[]
  connections: [string, string][]
}

function rollTowerLevelCount(size: SiteSize, rng: Rng): number {
  const range = towerLevelRangeForSize(size)
  // Each tier spans exactly 2 values (1-2, 3-4, 5-6) — a d2 roll picks within it.
  return range.min + rollDie(2, rng) - 1
}

export function generateTowerSite(rng: Rng = Math.random): TowerSite {
  const size = siteSizeForD6(rollDie(6, rng)).size
  const danger = dungeonDangerForD6(rollDie(6, rng))
  const levelCount = rollTowerLevelCount(size, rng)
  // Rolled once per site (Tower has no SiteType, so this picks uniformly across all categories),
  // not once per room — see monsterTables.ts's rollMonsterTheme.
  const monsterTheme = rollMonsterTheme(rng)

  const rooms: TowerRoom[] = []
  const connections: [string, string][] = []

  function rollRoom(id: string, levelIndex: number, isGuardRoom: boolean): TowerRoom {
    const content = rollRoomContent(rng, monsterTheme)
    return { id, levelIndex, isGuardRoom, ...content, isObjectiveRoom: false }
  }

  const entryHallId = 'entry-hall'
  const guardRoomId = 'guard-room'
  rooms.push(rollRoom(entryHallId, 0, false))
  rooms.push(rollRoom(guardRoomId, 0, true))
  connections.push([entryHallId, guardRoomId])

  let previousMainRoomId = entryHallId
  for (let level = 1; level < levelCount; level++) {
    const id = `level-${level}`
    rooms.push(rollRoom(id, level, false))
    connections.push([previousMainRoomId, id])
    previousMainRoomId = id
  }

  // The top of the main chain is always the objective, regardless of its Room Type roll.
  const topIndex = rooms.findIndex((r) => r.id === previousMainRoomId)
  rooms[topIndex] = { ...rooms[topIndex], isObjectiveRoom: true }

  return { kind: 'tower', size, danger, levelCount, rooms, connections }
}

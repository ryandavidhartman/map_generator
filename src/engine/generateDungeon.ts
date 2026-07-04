import { rollDie, type Rng } from './dice'
import {
  siteSizeForD6,
  siteTypeForD6,
  roomTypeForD10,
  roomDetailForType,
  ROOM_TYPE_NEEDS_TWO_ROLLS,
  dungeonDangerForD6,
  type SiteType,
  type SiteSize,
  type RoomType,
} from '../data/dungeonTables'
import { rollMonster, rollNpcType, type MonsterEntry } from '../data/monsterTables'
import type { DangerLevel } from '../data/tables'
import { generateDungeonLayout, type Rect } from './dungeonLayout'

// Room types that get a rolled creature attached, on top of their existing book-RAW flavor
// descriptor (e.g. "Mighty Brute") — see monsterTables.ts for the name-only/no-stats scope.
const MONSTER_ROOM_TYPES: RoomType[] = ['Solo Monster', 'Monster Mob', 'Boss Monster']

export type GeneratedMonster = MonsterEntry
export type GeneratedNpc = { type: string }

export type Room = {
  id: string
  index: number
  rect: Rect
  roomType: RoomType
  roomTypeRoll: number
  detail?: string
  monster?: GeneratedMonster
  npc?: GeneratedNpc
  isObjectiveRoom: boolean
}

export type DungeonSite = {
  kind: 'dungeon'
  siteType: SiteType
  size: SiteSize
  danger: DangerLevel
  rooms: Room[]
  // Room-id pairs for corridor rendering; a room can connect to more than one neighbor
  // (real floor-plan adjacency), unlike the old single-parent tree model.
  connections: [string, string][]
}

// Site Type and Size are rolled fresh here — never derived from the originating hex's POI
// text (see the plan's "Two mechanical points" note). overrideSiteType lets a GM force a
// specific type (e.g. via a "Reroll Site" UI control) without re-rolling size/danger/rooms.
export function generateDungeonSite(rng: Rng = Math.random, overrideSiteType?: SiteType): DungeonSite {
  const sizeSpec = siteSizeForD6(rollDie(6, rng))
  const siteType = overrideSiteType ?? siteTypeForD6(rollDie(6, rng))
  const danger = dungeonDangerForD6(rollDie(6, rng))
  const layout = generateDungeonLayout(sizeSpec.roomCount, rng)

  const rooms: Room[] = layout.rooms.map(({ rect, index }) => {
    const roomTypeRoll = rollDie(10, rng)
    const roomType = roomTypeForD10(roomTypeRoll)
    const detail: string | undefined =
      roomType === 'Empty'
        ? undefined
        : ROOM_TYPE_NEEDS_TWO_ROLLS[roomType]
          ? roomDetailForType(roomType, rollDie(6, rng), rollDie(6, rng))
          : roomDetailForType(roomType, rollDie(6, rng))

    const monster: GeneratedMonster | undefined = MONSTER_ROOM_TYPES.includes(roomType) ? rollMonster(rng) : undefined
    const npc: GeneratedNpc | undefined = roomType === 'NPC' ? { type: rollNpcType(rng) } : undefined

    return {
      id: `room-${index}`,
      index,
      rect,
      roomType,
      roomTypeRoll,
      detail,
      monster,
      npc,
      isObjectiveRoom: false,
    }
  })

  const connections: [string, string][] = layout.connections.map(([a, b]) => [`room-${a}`, `room-${b}`])

  // The room with the single highest Room Type roll is the objective/boss room (book RAW).
  // First occurrence wins ties.
  let objectiveIndex = 0
  for (let i = 1; i < rooms.length; i++) {
    if (rooms[i].roomTypeRoll > rooms[objectiveIndex].roomTypeRoll) objectiveIndex = i
  }
  if (rooms.length > 0) rooms[objectiveIndex] = { ...rooms[objectiveIndex], isObjectiveRoom: true }

  return { kind: 'dungeon', siteType, size: sizeSpec.size, danger, rooms, connections }
}

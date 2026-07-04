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
import type { DangerLevel } from '../data/tables'
import { generateGridLayout, type GridCell } from './gridLayout'

export type Room = {
  id: string
  index: number
  cell: GridCell
  parentRoomId: string | null
  roomType: RoomType
  roomTypeRoll: number
  detail?: string
  isObjectiveRoom: boolean
}

export type DungeonSite = {
  kind: 'dungeon'
  siteType: SiteType
  size: SiteSize
  danger: DangerLevel
  rooms: Room[]
}

// Site Type and Size are rolled fresh here — never derived from the originating hex's POI
// text (see the plan's "Two mechanical points" note). overrideSiteType lets a GM force a
// specific type (e.g. via a "Reroll Site" UI control) without re-rolling size/danger/rooms.
export function generateDungeonSite(rng: Rng = Math.random, overrideSiteType?: SiteType): DungeonSite {
  const sizeSpec = siteSizeForD6(rollDie(6, rng))
  const siteType = overrideSiteType ?? siteTypeForD6(rollDie(6, rng))
  const danger = dungeonDangerForD6(rollDie(6, rng))
  const placements = generateGridLayout(sizeSpec.roomCount, rng)

  const rooms: Room[] = placements.map((placement, index) => {
    const roomTypeRoll = rollDie(10, rng)
    const roomType = roomTypeForD10(roomTypeRoll)
    const detail: string | undefined =
      roomType === 'Empty'
        ? undefined
        : ROOM_TYPE_NEEDS_TWO_ROLLS[roomType]
          ? roomDetailForType(roomType, rollDie(6, rng), rollDie(6, rng))
          : roomDetailForType(roomType, rollDie(6, rng))

    return {
      id: `room-${index}`,
      index,
      cell: placement.cell,
      parentRoomId: placement.parentIndex === null ? null : `room-${placement.parentIndex}`,
      roomType,
      roomTypeRoll,
      detail,
      isObjectiveRoom: false,
    }
  })

  // The room with the single highest Room Type roll is the objective/boss room (book RAW).
  // First occurrence wins ties.
  let objectiveIndex = 0
  for (let i = 1; i < rooms.length; i++) {
    if (rooms[i].roomTypeRoll > rooms[objectiveIndex].roomTypeRoll) objectiveIndex = i
  }
  if (rooms.length > 0) rooms[objectiveIndex] = { ...rooms[objectiveIndex], isObjectiveRoom: true }

  return { kind: 'dungeon', siteType, size: sizeSpec.size, danger, rooms }
}

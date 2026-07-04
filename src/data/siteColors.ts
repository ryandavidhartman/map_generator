import type { RoomType } from './dungeonTables'
import type { DistrictType } from './settlementTables'

export const ROOM_TYPE_COLORS: Record<RoomType, string> = {
  Empty: '#3a3a3a',
  Trap: '#b45309',
  'Minor Hazard': '#ca8a04',
  'Solo Monster': '#b91c1c',
  NPC: '#4a90c4',
  'Monster Mob': '#7c2d12',
  'Major Hazard': '#dc2626',
  Treasure: '#d4af37',
  'Boss Monster': '#7f1d1d',
}

export const DISTRICT_TYPE_COLORS: Record<DistrictType, string> = {
  Slums: '#4b3f36',
  'Low District': '#5b4a3f',
  'Artisan District': '#6f5a3f',
  Market: '#8a7f3f',
  'High District': '#4a6fa5',
  'Temple District': '#a5854a',
  'University District': '#4a90c4',
  'Castle District': '#7a4ac4',
}

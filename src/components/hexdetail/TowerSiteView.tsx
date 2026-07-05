import { useMapDispatch } from '../../state/MapContext'
import type { Hex } from '../../state/mapReducer'
import type { TowerSite } from '../../engine/generateTower'
import { TowerMapSvg, type TowerMapRoomData } from '../../hexgrid/TowerMapSvg'
import { ROOM_TYPE_COLORS } from '../../data/siteColors'
import { HexBaseInfo } from './HexBaseInfo'

function roomLabel(room: TowerSite['rooms'][number]): string {
  if (room.isObjectiveRoom) return '★'
  if (room.id === 'entry-hall') return 'E'
  if (room.id === 'guard-room') return 'G'
  return String(room.levelIndex)
}

function roomListLabel(room: TowerSite['rooms'][number]): string {
  if (room.id === 'entry-hall') return 'Entry Hall (Ground Floor)'
  if (room.id === 'guard-room') return 'Guard Room (Ground Floor)'
  return `Level ${room.levelIndex}`
}

export function TowerSiteView({ hex, site }: { hex: Hex; site: TowerSite }) {
  const dispatch = useMapDispatch()

  const rooms: TowerMapRoomData[] = site.rooms.map((room) => ({
    id: room.id,
    levelIndex: room.levelIndex,
    isGuardRoom: room.isGuardRoom,
    color: ROOM_TYPE_COLORS[room.roomType],
    label: roomLabel(room),
    highlighted: room.isObjectiveRoom,
  }))

  return (
    <div className="site-view">
      <HexBaseInfo hex={hex} />

      <section className="site-section">
        <div className="site-section-header">
          <h3>
            {site.size} Tower — Danger: {site.danger}
          </h3>
          <button type="button" onClick={() => dispatch({ type: 'REROLL_SITE', hexId: hex.id })}>
            Reroll Site
          </button>
        </div>

        <div className="site-layout">
          <TowerMapSvg rooms={rooms} connections={site.connections} levelCount={site.levelCount} />
        </div>

        <ol className="room-list">
          {site.rooms.map((room) => (
            <li key={room.id} data-room-id={room.id} className={room.isObjectiveRoom ? 'objective-room' : undefined}>
              <strong>
                {roomListLabel(room)}: {room.roomType}
                {room.isObjectiveRoom && ' (Objective)'}
              </strong>
              {room.detail && <p>{room.detail}</p>}
              {room.monster && (
                <p>
                  Monster: {room.monster.name} <span className="room-tag">({room.monster.category})</span>
                </p>
              )}
              {room.npc && <p>NPC: {room.npc.type}</p>}
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}

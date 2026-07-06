import { useMapDispatch } from '../../state/MapContext'
import type { Hex } from '../../state/mapReducer'
import type { KeepSite, KeepRoom } from '../../engine/generateKeep'
import { KeepMapSvg, type KeepMapRoomData } from '../../hexgrid/KeepMapSvg'
import { ROOM_TYPE_COLORS } from '../../data/siteColors'
import { HexBaseInfo } from './HexBaseInfo'

function roomLabel(room: KeepRoom): string {
  if (room.isObjectiveRoom) return '★'
  if (room.isCourtyard) return 'C'
  if (room.isNamed) return room.name[0]
  return room.name.replace('Room ', '')
}

export function KeepSiteView({ hex, site }: { hex: Hex; site: KeepSite }) {
  const dispatch = useMapDispatch()

  const rooms: KeepMapRoomData[] = site.rooms.map((room) => ({
    id: room.id,
    rect: room.rect,
    color: ROOM_TYPE_COLORS[room.roomType],
    label: roomLabel(room),
    isYard: room.isCourtyard,
    highlighted: room.isObjectiveRoom,
  }))

  return (
    <div className="site-view">
      <HexBaseInfo hex={hex} />

      <section className="site-section">
        <div className="site-section-header">
          <h3>
            {site.size} Keep — Danger: {site.danger}
          </h3>
          <button type="button" onClick={() => dispatch({ type: 'REROLL_SITE', hexId: hex.id })}>
            Reroll Site
          </button>
        </div>

        <div className="site-layout">
          <KeepMapSvg rooms={rooms} connections={site.connections} />
        </div>

        <ol className="room-list">
          {site.rooms.map((room) => (
            <li key={room.id} data-room-id={room.id} className={room.isObjectiveRoom ? 'objective-room' : undefined}>
              <strong>
                {room.name}: {room.roomType}
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

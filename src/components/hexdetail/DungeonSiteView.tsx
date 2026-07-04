import { useMapDispatch } from '../../state/MapContext'
import type { Hex } from '../../state/mapReducer'
import type { DungeonSite } from '../../engine/generateDungeon'
import { DungeonMapSvg, type DungeonMapRoomData } from '../../hexgrid/DungeonMapSvg'
import { ROOM_TYPE_COLORS } from '../../data/siteColors'
import { HexBaseInfo } from './HexBaseInfo'

export function DungeonSiteView({ hex, site }: { hex: Hex; site: DungeonSite }) {
  const dispatch = useMapDispatch()

  const rooms: DungeonMapRoomData[] = site.rooms.map((room) => ({
    id: room.id,
    rect: room.rect,
    color: ROOM_TYPE_COLORS[room.roomType],
    label: room.isObjectiveRoom ? '★' : String(room.index + 1),
    highlighted: room.isObjectiveRoom,
  }))

  return (
    <div className="site-view">
      <HexBaseInfo hex={hex} />

      <section className="site-section">
        <div className="site-section-header">
          <h3>
            {site.size} {site.siteType} — Danger: {site.danger}
          </h3>
          <button type="button" onClick={() => dispatch({ type: 'REROLL_SITE', hexId: hex.id })}>
            Reroll Site
          </button>
        </div>

        <div className="site-layout">
          <DungeonMapSvg rooms={rooms} connections={site.connections} />
        </div>

        <ol className="room-list">
          {site.rooms.map((room) => (
            <li key={room.id} data-room-id={room.id} className={room.isObjectiveRoom ? 'objective-room' : undefined}>
              <strong>
                Room {room.index + 1}: {room.roomType}
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

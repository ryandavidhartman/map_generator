// Renders a generated Tower site as a vertical elevation (cross-section), not a top-down floor
// plan — confirmed design: a top-down view of a 1-room-per-level tower is just a stack of
// identical squares and conveys nothing, while a side-on elevation (ground floor at the
// bottom, climax room at the top, stairs drawn between levels) actually shows the thing that
// makes Tower distinct. This is a genuinely different renderer, not a variant of
// DungeonMapSvg.tsx — the input shape (an ordered list of levels) differs fundamentally from
// the other renderer's 2D room graph.

type TowerMapRoomData = {
  id: string
  levelIndex: number
  isGuardRoom: boolean
  color: string
  label: string
  highlighted?: boolean
  onClick?: () => void
}

export type { TowerMapRoomData }

export type TowerMapSvgProps = {
  rooms: TowerMapRoomData[]
  connections: [string, string][]
  levelCount: number
  unitSize?: number
}

export function TowerMapSvg({ rooms, connections, levelCount, unitSize = 48 }: TowerMapSvgProps) {
  if (rooms.length === 0) return null

  const roomWidth = unitSize * 2
  const roomHeight = unitSize
  const gap = unitSize * 0.3
  const pad = unitSize * 0.5

  const groundWidth = roomWidth * 2 + gap
  const width = groundWidth + pad * 2
  const height = levelCount * (roomHeight + gap) + pad * 2

  // Ground floor (level 0) sits at the bottom of the canvas; higher levels get a smaller y —
  // "up" in the tower is "up" on screen.
  function yForLevel(level: number): number {
    return height - pad - roomHeight - level * (roomHeight + gap)
  }

  function positionFor(room: TowerMapRoomData): { x: number; y: number; w: number; h: number } {
    const y = yForLevel(room.levelIndex)
    if (room.levelIndex === 0) {
      const x = room.isGuardRoom ? pad + roomWidth + gap : pad
      return { x, y, w: roomWidth, h: roomHeight }
    }
    const x = pad + (groundWidth - roomWidth) / 2
    return { x, y, w: roomWidth, h: roomHeight }
  }

  function centerOf(room: TowerMapRoomData) {
    const pos = positionFor(room)
    return { x: pos.x + pos.w / 2, y: pos.y + pos.h / 2 }
  }

  const byId = new Map(rooms.map((r) => [r.id, r]))

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: '100%', background: '#0d0d0d' }}>
      {connections.map(([aId, bId]) => {
        const a = byId.get(aId)
        const b = byId.get(bId)
        if (!a || !b) return null
        const ca = centerOf(a)
        const cb = centerOf(b)
        return <line key={`${aId}-${bId}`} x1={ca.x} y1={ca.y} x2={cb.x} y2={cb.y} stroke="#5c5f6b" strokeWidth={4} />
      })}
      {rooms.map((r) => {
        const pos = positionFor(r)
        const center = centerOf(r)
        return (
          <g key={r.id} data-room-id={r.id} onClick={r.onClick} style={{ cursor: r.onClick ? 'pointer' : 'default' }}>
            <rect
              x={pos.x}
              y={pos.y}
              width={pos.w}
              height={pos.h}
              rx={3}
              fill={r.color}
              stroke={r.highlighted ? '#ffffff' : '#00000055'}
              strokeWidth={r.highlighted ? 3 : 1}
            />
            <text
              x={center.x}
              y={center.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={unitSize * 0.35}
              fill="#f3f4f6"
              stroke="#000000"
              strokeWidth={unitSize * 0.05}
              paintOrder="stroke"
              style={{ pointerEvents: 'none', fontWeight: 700 }}
            >
              {r.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

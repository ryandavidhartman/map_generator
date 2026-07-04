// Renders a generated dungeon's real BSP room layout: variable-sized rectangles tiling a
// coherent floor plan, connected by corridor lines wherever two rooms' rects are actually
// adjacent (a room can connect to more than one neighbor — real floor-plan adjacency, not a
// single-parent tree). Parallel to GridLayoutSvg.tsx (which settlements still use for their
// uniform-cell district grid until they get the same real-map treatment), but this renders
// arbitrary pixel-space rectangles from src/engine/dungeonLayout.ts instead of a fixed grid.

export type DungeonMapRoomData = {
  id: string
  rect: { x: number; y: number; width: number; height: number }
  color: string
  label: string
  highlighted?: boolean
  onClick?: () => void
}

export type DungeonMapSvgProps = {
  rooms: DungeonMapRoomData[]
  connections: [string, string][]
  unitSize?: number
}

export function DungeonMapSvg({ rooms, connections, unitSize = 24 }: DungeonMapSvgProps) {
  if (rooms.length === 0) return null

  const maxX = Math.max(...rooms.map((r) => r.rect.x + r.rect.width))
  const maxY = Math.max(...rooms.map((r) => r.rect.y + r.rect.height))
  const pad = unitSize
  const width = maxX * unitSize + pad * 2
  const height = maxY * unitSize + pad * 2

  const byId = new Map(rooms.map((r) => [r.id, r]))

  function center(rect: DungeonMapRoomData['rect']) {
    return { x: (rect.x + rect.width / 2) * unitSize + pad, y: (rect.y + rect.height / 2) * unitSize + pad }
  }

  const inset = Math.min(unitSize * 0.12, 6)

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: '100%', background: '#0d0d0d' }}>
      {connections.map(([aId, bId]) => {
        const a = byId.get(aId)
        const b = byId.get(bId)
        if (!a || !b) return null
        const ca = center(a.rect)
        const cb = center(b.rect)
        return <line key={`${aId}-${bId}`} x1={ca.x} y1={ca.y} x2={cb.x} y2={cb.y} stroke="#5c5f6b" strokeWidth={3} />
      })}
      {rooms.map((r) => {
        const x = r.rect.x * unitSize + pad
        const y = r.rect.y * unitSize + pad
        const w = r.rect.width * unitSize
        const h = r.rect.height * unitSize
        return (
          <g key={r.id} data-room-id={r.id} onClick={r.onClick} style={{ cursor: r.onClick ? 'pointer' : 'default' }}>
            <rect
              x={x + inset}
              y={y + inset}
              width={w - inset * 2}
              height={h - inset * 2}
              rx={3}
              fill={r.color}
              stroke={r.highlighted ? '#ffffff' : '#00000055'}
              strokeWidth={r.highlighted ? 3 : 1}
            />
            <text
              x={x + w / 2}
              y={y + h / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={Math.min(unitSize * 0.5, 16)}
              fill="#f3f4f6"
              style={{ pointerEvents: 'none' }}
            >
              {r.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

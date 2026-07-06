// Renders a generated Keep as a walled compound: a courtyard yard beside a clustered building
// (see keepLayout.ts for the room-placement geometry), wrapped in an outer wall with corner +
// edge-midpoint towers and a gatehouse breach — replacing the old reuse of DungeonMapSvg's
// hub-and-spoke starburst, which the user flagged as reading like a wheel diagram, not a keep
// (reference: a walled compound with a courtyard yard beside a clustered building). The wall/
// towers/gate are derived purely from the room rects at render time (bounding box + margin), the
// same "no new persisted data" approach caveRenderShapes.ts used for cave rendering — KeepSite's
// schema and rng stream are untouched by this rendering-only feature.

type Point = { x: number; y: number }
type RectShape = { x: number; y: number; width: number; height: number }

export type KeepMapRoomData = {
  id: string
  rect: RectShape
  color: string
  label: string
  isYard?: boolean
  highlighted?: boolean
  onClick?: () => void
}

export type KeepMapSvgProps = {
  rooms: KeepMapRoomData[]
  connections: [string, string][]
  unitSize?: number
}

const WALL_MARGIN_UNITS = 3
const WALL_STROKE = '#6b6455'
const TOWER_FILL = '#5c5748'
const YARD_FILL = '#c9b98c'
const WALL_THICKNESS_UNITS = 0.5
const CORRIDOR_HALF_WIDTH_UNITS = 0.55
const ROOM_INSET_UNITS = 0.9
const GATE_HALF_WIDTH_UNITS = 3

export function KeepMapSvg({ rooms, connections, unitSize = 24 }: KeepMapSvgProps) {
  if (rooms.length === 0) return null

  const minX = Math.min(...rooms.map((r) => r.rect.x))
  const minY = Math.min(...rooms.map((r) => r.rect.y))
  const maxX = Math.max(...rooms.map((r) => r.rect.x + r.rect.width))
  const maxY = Math.max(...rooms.map((r) => r.rect.y + r.rect.height))

  const wallUnits: RectShape = {
    x: minX - WALL_MARGIN_UNITS,
    y: minY - WALL_MARGIN_UNITS,
    width: maxX - minX + WALL_MARGIN_UNITS * 2,
    height: maxY - minY + WALL_MARGIN_UNITS * 2,
  }

  const pad = unitSize * 2
  const width = wallUnits.width * unitSize + pad * 2
  const height = wallUnits.height * unitSize + pad * 2

  function toPx(x: number, y: number): Point {
    return { x: (x - wallUnits.x) * unitSize + pad, y: (y - wallUnits.y) * unitSize + pad }
  }

  function centerPx(rect: RectShape): Point {
    return toPx(rect.x + rect.width / 2, rect.y + rect.height / 2)
  }

  // For a yard room, anchors the connection at the point on its edge closest to `other` (clamped
  // onto whichever side faces `other`) instead of the yard's own center — a real courtyard's path
  // only needs to span the gap to the building it leads to, not cut across the whole open yard.
  function yardAnchorPx(room: KeepMapRoomData, other: KeepMapRoomData): Point {
    if (!room.isYard) return centerPx(room.rect)
    const otherCenterX = other.rect.x + other.rect.width / 2
    const otherCenterY = other.rect.y + other.rect.height / 2
    const clampedX = Math.min(Math.max(otherCenterX, room.rect.x), room.rect.x + room.rect.width)
    const clampedY = Math.min(Math.max(otherCenterY, room.rect.y), room.rect.y + room.rect.height)
    // Snap onto whichever edge is nearer, so the anchor sits ON the yard boundary, not inside it.
    const distLeft = clampedX - room.rect.x
    const distRight = room.rect.x + room.rect.width - clampedX
    const distTop = clampedY - room.rect.y
    const distBottom = room.rect.y + room.rect.height - clampedY
    const minDist = Math.min(distLeft, distRight, distTop, distBottom)
    if (minDist === distRight) return toPx(room.rect.x + room.rect.width, clampedY)
    if (minDist === distLeft) return toPx(room.rect.x, clampedY)
    if (minDist === distBottom) return toPx(clampedX, room.rect.y + room.rect.height)
    return toPx(clampedX, room.rect.y)
  }

  const byId = new Map(rooms.map((r) => [r.id, r]))
  const wallThickness = WALL_THICKNESS_UNITS * unitSize
  const corridorHalfWidth = CORRIDOR_HALF_WIDTH_UNITS * unitSize
  const roomInset = ROOM_INSET_UNITS * unitSize

  const wallTopLeft = toPx(wallUnits.x, wallUnits.y)
  const wallBottomRight = toPx(wallUnits.x + wallUnits.width, wallUnits.y + wallUnits.height)
  const wallPxWidth = wallBottomRight.x - wallTopLeft.x
  const wallMidX = (wallTopLeft.x + wallBottomRight.x) / 2
  const towerRadius = unitSize * 0.5
  const towerStrokeWidth = Math.max(2, unitSize * 0.35)

  const towers: Point[] = [
    { x: wallTopLeft.x, y: wallTopLeft.y },
    { x: wallBottomRight.x, y: wallTopLeft.y },
    { x: wallTopLeft.x, y: wallBottomRight.y },
    { x: wallBottomRight.x, y: wallBottomRight.y },
    { x: wallMidX, y: wallTopLeft.y },
    { x: wallTopLeft.x, y: (wallTopLeft.y + wallBottomRight.y) / 2 },
    { x: wallBottomRight.x, y: (wallTopLeft.y + wallBottomRight.y) / 2 },
  ]

  // Gatehouse: a breach in the bottom wall segment, centered, with a short path leading outward.
  const gateHalfWidthPx = Math.min(GATE_HALF_WIDTH_UNITS * unitSize, wallPxWidth * 0.2)
  const gateY = wallBottomRight.y
  const gatePathLength = unitSize * 3

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: '100%', background: '#0d0d0d' }}>
      <defs>
        <pattern id="keep-grid" width={10} height={10} patternUnits="userSpaceOnUse">
          <rect width={10} height={10} fill="#e8ddc0" />
          <path d="M10,0 L0,0 L0,10" fill="none" stroke="#d3c6a0" strokeWidth={0.5} />
        </pattern>
        <pattern id="keep-brick" width={16} height={8} patternUnits="userSpaceOnUse">
          <rect width={16} height={8} fill="#5c5346" />
          <path
            d="M0,0 L16,0 M0,4 L16,4 M0,8 L16,8 M0,0 L0,4 M8,0 L8,4 M16,0 L16,4 M-4,4 L-4,8 M4,4 L4,8 M12,4 L12,8"
            fill="none"
            stroke="#2e2820"
            strokeWidth={0.6}
          />
        </pattern>
      </defs>

      <rect x={0} y={0} width={width} height={height} fill="url(#keep-grid)" />

      {/* Path leading away from the gate, drawn first (underneath everything else). */}
      <rect x={wallMidX - gateHalfWidthPx * 0.6} y={gateY} width={gateHalfWidthPx * 1.2} height={gatePathLength} fill="#d3c09a" />

      {/* Courtyard yard(s) — flat open ground, no wall band, drawn before the building rooms. */}
      {rooms
        .filter((r) => r.isYard)
        .map((r) => {
          const topLeft = toPx(r.rect.x, r.rect.y)
          return (
            <rect
              key={r.id}
              data-room-id={r.id}
              x={topLeft.x}
              y={topLeft.y}
              width={r.rect.width * unitSize}
              height={r.rect.height * unitSize}
              fill={YARD_FILL}
              stroke={r.highlighted ? '#ffffff' : '#8a7c58'}
              strokeWidth={r.highlighted ? 3 : 1}
              onClick={r.onClick}
              style={{ cursor: r.onClick ? 'pointer' : 'default' }}
            />
          )
        })}

      {/* Corridors between connected rooms — same wall-band + floor double layer as DungeonMapSvg's
          Tomb/Ruins style, since a keep is a built structure with straight halls. */}
      {connections.map(([aId, bId]) => {
        const a = byId.get(aId)
        const b = byId.get(bId)
        if (!a || !b) return null
        // A yard's connection anchor is a point on its edge nearest the other room, not its
        // center — otherwise the corridor cuts straight across the whole open courtyard interior
        // instead of just spanning the gap between the yard and the building block.
        const ca = yardAnchorPx(a, b)
        const cb = yardAnchorPx(b, a)
        const dx = cb.x - ca.x
        const dy = cb.y - ca.y
        const len = Math.hypot(dx, dy) || 1
        const nx = -dy / len
        const ny = dx / len
        function ribbon(halfWidth: number): string {
          const p1 = { x: ca.x + nx * halfWidth, y: ca.y + ny * halfWidth }
          const p2 = { x: cb.x + nx * halfWidth, y: cb.y + ny * halfWidth }
          const p3 = { x: cb.x - nx * halfWidth, y: cb.y - ny * halfWidth }
          const p4 = { x: ca.x - nx * halfWidth, y: ca.y - ny * halfWidth }
          return [p1, p2, p3, p4].map((p) => `${p.x},${p.y}`).join(' ')
        }
        return (
          <g key={`${aId}-${bId}`}>
            <polygon points={ribbon(corridorHalfWidth + wallThickness)} fill="url(#keep-brick)" />
            <polygon points={ribbon(corridorHalfWidth)} fill="#e8ddc0" />
          </g>
        )
      })}

      {/* Building rooms — wall-band + floor double layer, inset from their true rect bounds so a
          visible gap exists for corridors (rooms otherwise tile the grid edge-to-edge). */}
      {rooms
        .filter((r) => !r.isYard)
        .map((r) => {
          const fontSize = Math.min(unitSize * 0.5, 16)
          const center = centerPx(r.rect)
          const outerTopLeft = toPx(r.rect.x, r.rect.y)
          const outer = {
            x: outerTopLeft.x + roomInset,
            y: outerTopLeft.y + roomInset,
            width: Math.max(0, r.rect.width * unitSize - roomInset * 2),
            height: Math.max(0, r.rect.height * unitSize - roomInset * 2),
          }
          const inner = {
            x: outer.x + wallThickness,
            y: outer.y + wallThickness,
            width: Math.max(0, outer.width - wallThickness * 2),
            height: Math.max(0, outer.height - wallThickness * 2),
          }
          return (
            <g key={r.id} data-room-id={r.id} onClick={r.onClick} style={{ cursor: r.onClick ? 'pointer' : 'default' }}>
              <rect
                x={outer.x}
                y={outer.y}
                width={outer.width}
                height={outer.height}
                fill="url(#keep-brick)"
                stroke={r.highlighted ? '#ffffff' : 'none'}
                strokeWidth={r.highlighted ? 3 : 0}
              />
              <rect x={inner.x} y={inner.y} width={inner.width} height={inner.height} fill={r.color} />
              <text
                x={center.x}
                y={center.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={fontSize}
                fill="#f3f4f6"
                stroke="#000000"
                strokeWidth={fontSize * 0.15}
                paintOrder="stroke"
                style={{ pointerEvents: 'none', fontWeight: 700 }}
              >
                {r.label}
              </text>
            </g>
          )
        })}

      {/* Outer wall, drawn as 4 segments so the bottom one can leave a gate-sized gap, plus
          corner + edge-midpoint towers on top. */}
      <line x1={wallTopLeft.x} y1={wallTopLeft.y} x2={wallBottomRight.x} y2={wallTopLeft.y} stroke={WALL_STROKE} strokeWidth={towerStrokeWidth} />
      <line x1={wallTopLeft.x} y1={wallTopLeft.y} x2={wallTopLeft.x} y2={wallBottomRight.y} stroke={WALL_STROKE} strokeWidth={towerStrokeWidth} />
      <line x1={wallBottomRight.x} y1={wallTopLeft.y} x2={wallBottomRight.x} y2={wallBottomRight.y} stroke={WALL_STROKE} strokeWidth={towerStrokeWidth} />
      <line x1={wallTopLeft.x} y1={wallBottomRight.y} x2={wallMidX - gateHalfWidthPx} y2={wallBottomRight.y} stroke={WALL_STROKE} strokeWidth={towerStrokeWidth} />
      <line x1={wallMidX + gateHalfWidthPx} y1={wallBottomRight.y} x2={wallBottomRight.x} y2={wallBottomRight.y} stroke={WALL_STROKE} strokeWidth={towerStrokeWidth} />

      {towers.map((t, i) => (
        <circle key={i} cx={t.x} cy={t.y} r={towerRadius} fill={TOWER_FILL} stroke="#2e2c24" strokeWidth={1} />
      ))}
      {/* Small gatehouse towers flanking the breach. */}
      <circle cx={wallMidX - gateHalfWidthPx} cy={wallBottomRight.y} r={towerRadius * 0.75} fill={TOWER_FILL} stroke="#2e2c24" strokeWidth={1} />
      <circle cx={wallMidX + gateHalfWidthPx} cy={wallBottomRight.y} r={towerRadius * 0.75} fill={TOWER_FILL} stroke="#2e2c24" strokeWidth={1} />
    </svg>
  )
}

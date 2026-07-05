// Renders a generated dungeon's real BSP room layout. Two visual styles, chosen by the caller
// via `caveStyle` based on the dungeon's site type (see DungeonSiteView.tsx): Cave/Deep
// tunnels get organic cavern blobs with a crosshatched rock-textured wall band (matching a
// reference hand-drawn cave map the user provided); Tomb/Ruins keep rectangular built rooms,
// with a matching visual polish (thicker walls, a brick-textured wall band) rather than a full
// redesign — a tomb built by masons plausibly has straight walls where a natural cave doesn't.
// Both styles share a VTT-style square-grid background and render corridors as real polygon
// "capsule" bands (floor + wall-band, same double-layer technique as rooms) rather than a bare
// line, so passages actually show — the earlier single-line version got hidden almost entirely
// under directly-touching rooms with no gap between them (rectangular rooms here are inset from
// their true rect bounds specifically so a visible gap exists for the corridor to occupy; cave
// blobs are naturally smaller than their room's rect already, so no extra inset is needed there).

import {
  blobToPolygon,
  corridorPolygon,
  generateBlobShape,
  generateOrganicCorridorWaypoints,
  seedForConnection,
  seedForRect,
  smoothPathData,
  type Point,
} from '../engine/caveRenderShapes'

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
  caveStyle?: boolean
  unitSize?: number
}

const WALL_THICKNESS_UNITS = 0.5
const CORRIDOR_HALF_WIDTH_UNITS = 0.55
const RECT_ROOM_INSET_UNITS = 0.9 // gap left around rectangular rooms so corridors stay visible

export function DungeonMapSvg({ rooms, connections, caveStyle = false, unitSize = 24 }: DungeonMapSvgProps) {
  if (rooms.length === 0) return null

  const maxX = Math.max(...rooms.map((r) => r.rect.x + r.rect.width))
  const maxY = Math.max(...rooms.map((r) => r.rect.y + r.rect.height))
  const pad = unitSize
  const width = maxX * unitSize + pad * 2
  const height = maxY * unitSize + pad * 2

  const byId = new Map(rooms.map((r) => [r.id, r]))
  const wallThickness = WALL_THICKNESS_UNITS * unitSize
  const corridorHalfWidth = CORRIDOR_HALF_WIDTH_UNITS * unitSize
  const roomInset = RECT_ROOM_INSET_UNITS * unitSize
  const wallPatternId = caveStyle ? 'dungeon-crosshatch' : 'dungeon-brick'

  function toPx(x: number, y: number): Point {
    return { x: x * unitSize + pad, y: y * unitSize + pad }
  }

  function centerPx(rect: DungeonMapRoomData['rect']): Point {
    return toPx(rect.x + rect.width / 2, rect.y + rect.height / 2)
  }

  function pointsAttr(polygon: Point[]): string {
    return polygon.map((p) => `${p.x},${p.y}`).join(' ')
  }

  function labelFor(r: DungeonMapRoomData, center: Point, fontSize: number) {
    return (
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
    )
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: '100%', background: '#0d0d0d' }}>
      <defs>
        <pattern id="dungeon-grid" width={10} height={10} patternUnits="userSpaceOnUse">
          <rect width={10} height={10} fill="#e8ddc0" />
          <path d="M10,0 L0,0 L0,10" fill="none" stroke="#d3c6a0" strokeWidth={0.5} />
        </pattern>
        <pattern id="dungeon-crosshatch" width={8} height={8} patternUnits="userSpaceOnUse">
          <rect width={8} height={8} fill="#4a4136" />
          <path d="M0,8 L8,0 M-4,4 L4,-4 M4,12 L12,4" stroke="#2e2820" strokeWidth={1} />
          <path d="M0,0 L8,8 M-4,4 L4,12 M4,-4 L12,4" stroke="#2e2820" strokeWidth={1} opacity={0.6} />
        </pattern>
        <pattern id="dungeon-brick" width={16} height={8} patternUnits="userSpaceOnUse">
          <rect width={16} height={8} fill="#5c5346" />
          <path
            d="M0,0 L16,0 M0,4 L16,4 M0,8 L16,8 M0,0 L0,4 M8,0 L8,4 M16,0 L16,4 M-4,4 L-4,8 M4,4 L4,8 M12,4 L12,8"
            fill="none"
            stroke="#2e2820"
            strokeWidth={0.6}
          />
        </pattern>
      </defs>

      <rect x={0} y={0} width={width} height={height} fill="url(#dungeon-grid)" />

      {/* Corridors — drawn first so rooms (on top) hide the parts that overlap them, leaving
          only the visible span between rooms. Cave-style corridors wind (a few deterministic
          waypoints, rendered as a smooth path) rather than running dead straight — several
          perfectly straight ribbons converging on one room read as a network diagram, not a
          natural passage; Tomb/Ruins keep straight halls (a built structure plausibly has
          them). */}
      {connections.map(([aId, bId]) => {
        const a = byId.get(aId)
        const b = byId.get(bId)
        if (!a || !b) return null
        const ca = centerPx(a.rect)
        const cb = centerPx(b.rect)

        if (caveStyle) {
          const seed = seedForConnection(seedForRect(a.rect), seedForRect(b.rect))
          const pathData = smoothPathData(generateOrganicCorridorWaypoints(ca, cb, seed))
          return (
            <g key={`${aId}-${bId}`}>
              <path
                d={pathData}
                fill="none"
                stroke={`url(#${wallPatternId})`}
                strokeWidth={(corridorHalfWidth + wallThickness) * 2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path d={pathData} fill="none" stroke="#e8ddc0" strokeWidth={corridorHalfWidth * 2} strokeLinecap="round" strokeLinejoin="round" />
            </g>
          )
        }

        const wallPoly = corridorPolygon(ca, cb, corridorHalfWidth + wallThickness)
        const floorPoly = corridorPolygon(ca, cb, corridorHalfWidth)
        return (
          <g key={`${aId}-${bId}`}>
            <polygon points={pointsAttr(wallPoly)} fill={`url(#${wallPatternId})`} />
            <polygon points={pointsAttr(floorPoly)} fill="#e8ddc0" />
          </g>
        )
      })}

      {rooms.map((r) => {
        const center = centerPx(r.rect)
        const fontSize = Math.min(unitSize * 0.5, 16)

        if (caveStyle) {
          const baseRadius = Math.min(r.rect.width, r.rect.height) * unitSize * 0.46
          const shape = generateBlobShape(seedForRect(r.rect))
          const wallPoly = blobToPolygon(center, baseRadius, shape, wallThickness)
          const floorPoly = blobToPolygon(center, baseRadius, shape, 0)
          return (
            <g key={r.id} data-room-id={r.id} onClick={r.onClick} style={{ cursor: r.onClick ? 'pointer' : 'default' }}>
              <polygon
                points={pointsAttr(wallPoly)}
                fill={`url(#${wallPatternId})`}
                stroke={r.highlighted ? '#ffffff' : 'none'}
                strokeWidth={r.highlighted ? 3 : 0}
              />
              <polygon points={pointsAttr(floorPoly)} fill={r.color} />
              {labelFor(r, center, fontSize)}
            </g>
          )
        }

        const outer = {
          x: r.rect.x * unitSize + pad + roomInset,
          y: r.rect.y * unitSize + pad + roomInset,
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
              fill={`url(#${wallPatternId})`}
              stroke={r.highlighted ? '#ffffff' : 'none'}
              strokeWidth={r.highlighted ? 3 : 0}
            />
            <rect x={inner.x} y={inner.y} width={inner.width} height={inner.height} fill={r.color} />
            {labelFor(r, center, fontSize)}
          </g>
        )
      })}
    </svg>
  )
}

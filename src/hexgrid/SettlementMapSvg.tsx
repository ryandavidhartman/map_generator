// Renders a generated settlement's real Voronoi district layout: an organic jittered town
// boundary, districts as polygons clipped to that boundary, and a curved road network.
// Parallel to DungeonMapSvg.tsx/GridLayoutSvg.tsx, but this renders arbitrary polygons from
// src/engine/settlementLayout.ts instead of a fixed grid or rectangles.

type Vec2 = { x: number; y: number }

export type SettlementMapDistrictData = {
  id: string
  site: Vec2
  polygon: Vec2[]
  color: string
  label: string
  highlighted?: boolean
  onClick?: () => void
}

export type SettlementMapRoadData = { aId: string; bId: string; kind: 'main' | 'minor' }

export type SettlementMapSvgProps = {
  mask: Vec2[]
  districts: SettlementMapDistrictData[]
  roads: SettlementMapRoadData[]
  unitSize?: number
}

export function SettlementMapSvg({ mask, districts, roads, unitSize = 10 }: SettlementMapSvgProps) {
  if (districts.length === 0) return null

  const allPoints = [...mask, ...districts.flatMap((d) => d.polygon)]
  const minX = Math.min(...allPoints.map((p) => p.x))
  const minY = Math.min(...allPoints.map((p) => p.y))
  const maxX = Math.max(...allPoints.map((p) => p.x))
  const maxY = Math.max(...allPoints.map((p) => p.y))
  const pad = unitSize * 2
  const width = (maxX - minX) * unitSize + pad * 2
  const height = (maxY - minY) * unitSize + pad * 2

  function toPx(p: Vec2): Vec2 {
    return { x: (p.x - minX) * unitSize + pad, y: (p.y - minY) * unitSize + pad }
  }

  function pointsAttr(polygon: Vec2[]): string {
    return polygon.map((p) => toPx(p)).map(({ x, y }) => `${x},${y}`).join(' ')
  }

  const byId = new Map(districts.map((d) => [d.id, d]))

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: '100%', background: '#0d0d0d' }}>
      <polygon points={pointsAttr(mask)} fill="#161616" stroke="#3a3a3a" strokeWidth={2} />

      {roads.map(({ aId, bId, kind }) => {
        const a = byId.get(aId)
        const b = byId.get(bId)
        if (!a || !b) return null
        const pa = toPx(a.site)
        const pb = toPx(b.site)
        const mx = (pa.x + pb.x) / 2
        const my = (pa.y + pb.y) / 2
        const dx = pb.x - pa.x
        const dy = pb.y - pa.y
        const len = Math.hypot(dx, dy) || 1
        const curveAmount = len * 0.12
        const cx = mx + (-dy / len) * curveAmount
        const cy = my + (dx / len) * curveAmount
        return (
          <path
            key={`${aId}-${bId}`}
            d={`M ${pa.x},${pa.y} Q ${cx},${cy} ${pb.x},${pb.y}`}
            fill="none"
            stroke={kind === 'main' ? '#9a9fac' : '#5c5f6b'}
            strokeWidth={kind === 'main' ? 4 : 2}
          />
        )
      })}

      {districts.map((d) => {
        const center = toPx(d.site)
        return (
          <g key={d.id} data-district-id={d.id} onClick={d.onClick} style={{ cursor: d.onClick ? 'pointer' : 'default' }}>
            <polygon
              points={pointsAttr(d.polygon)}
              fill={d.color}
              fillOpacity={0.85}
              stroke={d.highlighted ? '#ffffff' : '#00000055'}
              strokeWidth={d.highlighted ? 3 : 1}
            />
            <text
              x={center.x}
              y={center.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={unitSize * 1.8}
              fill="#f3f4f6"
              style={{ pointerEvents: 'none' }}
            >
              {d.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

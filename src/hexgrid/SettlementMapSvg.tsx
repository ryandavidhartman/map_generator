// Renders a generated settlement as an actual city map, not a flat colored diagram: a walled
// (towered) organic boundary, faint per-district color washes for orientation, a visible
// street network, and building/park footprints scattered across the districts. Rewritten after
// the first version (solid-colored Voronoi cells with roads hidden underneath them) was judged
// to look like an abstract stained-glass diagram rather than a map — see
// docs/plan-sites-settlements-mongo.md's "Real settlement maps" section for the full story and
// the reference image this style targets. Deliberately flat/stylized SVG shapes, not painted
// textures (a texture-asset pipeline was explicitly ruled out as much bigger scope for now).

type Vec2 = { x: number; y: number }

export type SettlementMapBuildingData = {
  kind: 'building' | 'park'
  x: number
  y: number
  width: number
  height: number
  rotation: number
  colorIndex: number
}

export type SettlementMapDistrictData = {
  id: string
  site: Vec2
  polygon: Vec2[]
  buildings: SettlementMapBuildingData[]
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

// Warm terracotta/brown roof tones — buildings cycle through these for texture variety,
// independent of district type (district identity is conveyed by the faint color wash
// underneath instead, matching how real illustrated city maps keep roofs a consistent
// palette across the whole city).
const BUILDING_COLORS = ['#b5673a', '#a85c34', '#c17a45', '#9c5530']
const PARK_FILL = '#4f7a3d'
const PARK_TREE_FILL = '#3a5c2c'
const GROUND_FILL = '#ddcfa8'
const WALL_STROKE = '#6b6455'
const TOWER_FILL = '#5c5748'
const STREET_FILL = '#e8dcb8'

export function SettlementMapSvg({ mask, districts, roads, unitSize = 10 }: SettlementMapSvgProps) {
  if (districts.length === 0) return null

  const allPoints = [...mask, ...districts.flatMap((d) => d.polygon)]
  const minX = Math.min(...allPoints.map((p) => p.x))
  const minY = Math.min(...allPoints.map((p) => p.y))
  const maxX = Math.max(...allPoints.map((p) => p.x))
  const maxY = Math.max(...allPoints.map((p) => p.y))
  const pad = unitSize * 3
  const width = (maxX - minX) * unitSize + pad * 2
  const height = (maxY - minY) * unitSize + pad * 2

  function toPx(p: Vec2): Vec2 {
    return { x: (p.x - minX) * unitSize + pad, y: (p.y - minY) * unitSize + pad }
  }

  function pointsAttr(polygon: Vec2[]): string {
    return polygon.map((p) => toPx(p)).map(({ x, y }) => `${x},${y}`).join(' ')
  }

  const byId = new Map(districts.map((d) => [d.id, d]))
  // Towers only at every 3rd mask vertex — the mask has enough samples for a smooth jittered
  // outline, but a tower at every single one reads as too dense/mechanical.
  const towerVertices = mask.slice(0, -1).filter((_, i) => i % 3 === 0)
  const wallStrokeWidth = Math.max(2, unitSize * 0.35)
  const towerRadius = unitSize * 0.5

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: '100%', background: '#0d0d0d' }}>
      {/* Ground */}
      <polygon points={pointsAttr(mask)} fill={GROUND_FILL} stroke="none" />

      {/* Faint per-district color wash — orientation only, buildings carry the real texture */}
      {districts.map((d) => (
        <polygon
          key={`wash-${d.id}`}
          points={pointsAttr(d.polygon)}
          fill={d.color}
          fillOpacity={0.16}
          stroke="#00000030"
          strokeWidth={1}
        />
      ))}

      {/* Streets — drawn before buildings so buildings can sit visibly alongside them */}
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
            stroke={STREET_FILL}
            strokeWidth={kind === 'main' ? unitSize * 0.7 : unitSize * 0.4}
            strokeLinecap="round"
          />
        )
      })}

      {/* Buildings and parks */}
      {districts.map((d) =>
        d.buildings.map((b, i) => {
          const center = toPx(b)
          const w = b.width * unitSize
          const h = b.height * unitSize
          const rotationDeg = (b.rotation * 180) / Math.PI
          if (b.kind === 'park') {
            const treeOffsets = [
              { dx: -w * 0.2, dy: -h * 0.15 },
              { dx: w * 0.15, dy: h * 0.1 },
              { dx: 0, dy: -h * 0.05 },
            ]
            return (
              <g key={`${d.id}-b${i}`}>
                <ellipse cx={center.x} cy={center.y} rx={w / 2} ry={h / 2} fill={PARK_FILL} stroke="#2e4823" strokeWidth={1} />
                {treeOffsets.map((t, ti) => (
                  <circle key={ti} cx={center.x + t.dx} cy={center.y + t.dy} r={Math.min(w, h) * 0.14} fill={PARK_TREE_FILL} />
                ))}
              </g>
            )
          }
          return (
            <rect
              key={`${d.id}-b${i}`}
              x={center.x - w / 2}
              y={center.y - h / 2}
              width={w}
              height={h}
              fill={BUILDING_COLORS[b.colorIndex % BUILDING_COLORS.length]}
              stroke="#3a2f22"
              strokeWidth={0.75}
              transform={`rotate(${rotationDeg}, ${center.x}, ${center.y})`}
            />
          )
        }),
      )}

      {/* District click regions (invisible, on top of buildings for a reliable hit target) */}
      {districts.map((d) => (
        <polygon
          key={`hit-${d.id}`}
          data-district-id={d.id}
          points={pointsAttr(d.polygon)}
          fill="transparent"
          stroke={d.highlighted ? '#ffffff' : 'none'}
          strokeWidth={d.highlighted ? 3 : 0}
          onClick={d.onClick}
          style={{ cursor: d.onClick ? 'pointer' : 'default' }}
        />
      ))}

      {/* Wall + towers, on top of the city fabric */}
      <polygon points={pointsAttr(mask)} fill="none" stroke={WALL_STROKE} strokeWidth={wallStrokeWidth} />
      {towerVertices.map((v, i) => {
        const p = toPx(v)
        return <circle key={i} cx={p.x} cy={p.y} r={towerRadius} fill={TOWER_FILL} stroke="#2e2c24" strokeWidth={1} />
      })}

      {/* Labels, always on top */}
      {districts.map((d) => {
        const center = toPx(d.site)
        return (
          <text
            key={`label-${d.id}`}
            x={center.x}
            y={center.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={unitSize * 1.6}
            fill="#f3f4f6"
            stroke="#000000"
            strokeWidth={unitSize * 0.15}
            paintOrder="stroke"
            style={{ pointerEvents: 'none', fontWeight: 700 }}
          >
            {d.label}
          </text>
        )
      })}
    </svg>
  )
}

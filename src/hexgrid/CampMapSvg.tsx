// Renders a generated Camp as a scatter/zone map — the third distinct renderer in this project
// (after DungeonMapSvg's rects+corridors and TowerMapSvg's vertical chain): a central feature
// plus peripheral features as plain circles at their computed positions, with NO connecting
// lines drawn between them at all — confirmed 2026-07-04, "a camp isn't traversed room-to-room;
// it's a zone the party moves through freely," so drawing corridors here would misrepresent the
// site's actual structure. Deliberately simpler visual treatment than DungeonMapSvg/
// SettlementMapSvg (flat background, no patterns/textures) — Camp's spec explicitly flagged this
// renderer as the scope-creep risk of the whole Location Generator expansion, so it stays lean.

export type CampMapFeatureData = {
  id: string
  point: { x: number; y: number; radius: number }
  color: string
  label: string
  highlighted?: boolean
  onClick?: () => void
}

export type CampMapSvgProps = {
  central: CampMapFeatureData
  peripheral: CampMapFeatureData[]
  unitSize?: number
}

export function CampMapSvg({ central, peripheral, unitSize = 24 }: CampMapSvgProps) {
  const all = [central, ...peripheral]
  const maxX = Math.max(...all.map((f) => f.point.x + f.point.radius))
  const maxY = Math.max(...all.map((f) => f.point.y + f.point.radius))
  const pad = unitSize
  const width = maxX * unitSize + pad * 2
  const height = maxY * unitSize + pad * 2

  function toPx(p: { x: number; y: number }) {
    return { x: p.x * unitSize + pad, y: p.y * unitSize + pad }
  }

  function renderFeature(f: CampMapFeatureData) {
    const center = toPx(f.point)
    const r = f.point.radius * unitSize
    const fontSize = Math.min(r * 0.55, 16)
    return (
      <g key={f.id} data-feature-id={f.id} onClick={f.onClick} style={{ cursor: f.onClick ? 'pointer' : 'default' }}>
        <circle cx={center.x} cy={center.y} r={r} fill={f.color} stroke={f.highlighted ? '#ffffff' : '#0d0d0d'} strokeWidth={f.highlighted ? 3 : 1.5} />
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
          {f.label}
        </text>
      </g>
    )
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: '100%', background: '#1c2416' }}>
      {renderFeature(central)}
      {peripheral.map((f) => renderFeature(f))}
    </svg>
  )
}

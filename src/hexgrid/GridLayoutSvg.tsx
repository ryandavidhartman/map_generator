// Renders a generated dungeon/settlement's abstract room/district grid. Cell adjacency alone
// forms the visible footprint/shape (no separate outline or hull computation is needed) —
// this is the digital equivalent of the book's "drop dice on paper, trace an outline" step.
// Parallel to HexGridSvg.tsx, but these grids are small (max 12 rooms / 64 districts) so no
// pan/zoom is needed.

export type GridLayoutCellData = {
  id: string
  cell: { row: number; col: number }
  parentId: string | null
  color: string
  label: string
  highlighted?: boolean
  onClick?: () => void
}

export type GridLayoutSvgProps = {
  cells: GridLayoutCellData[]
  cellSize?: number
  // Playwright targets cells via `data-{cellIdAttribute}="<id>"`, matching the existing
  // `data-hex-id` convention on the overland map — callers pick 'room-id' or 'district-id'.
  cellIdAttribute?: string
}

export function GridLayoutSvg({ cells, cellSize = 64, cellIdAttribute = 'cell-id' }: GridLayoutSvgProps) {
  if (cells.length === 0) return null

  const rows = cells.map((c) => c.cell.row)
  const cols = cells.map((c) => c.cell.col)
  const minRow = Math.min(...rows)
  const maxRow = Math.max(...rows)
  const minCol = Math.min(...cols)
  const maxCol = Math.max(...cols)
  const pad = cellSize * 0.6
  const width = (maxCol - minCol + 1) * cellSize + pad * 2
  const height = (maxRow - minRow + 1) * cellSize + pad * 2

  function topLeft(cell: { row: number; col: number }) {
    return { x: (cell.col - minCol) * cellSize + pad, y: (cell.row - minRow) * cellSize + pad }
  }

  const byId = new Map(cells.map((c) => [c.id, c]))
  const inset = cellSize * 0.08

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: '100%', background: '#0d0d0d' }}>
      {cells.map((c) => {
        if (!c.parentId) return null
        const parent = byId.get(c.parentId)
        if (!parent) return null
        const a = topLeft(c.cell)
        const b = topLeft(parent.cell)
        return (
          <line
            key={`edge-${c.id}`}
            x1={a.x + cellSize / 2}
            y1={a.y + cellSize / 2}
            x2={b.x + cellSize / 2}
            y2={b.y + cellSize / 2}
            stroke="#5c5f6b"
            strokeWidth={3}
          />
        )
      })}
      {cells.map((c) => {
        const { x, y } = topLeft(c.cell)
        const dataProps = { [`data-${cellIdAttribute}`]: c.id }
        return (
          <g key={c.id} {...dataProps} onClick={c.onClick} style={{ cursor: c.onClick ? 'pointer' : 'default' }}>
            <rect
              x={x + inset}
              y={y + inset}
              width={cellSize - inset * 2}
              height={cellSize - inset * 2}
              rx={4}
              fill={c.color}
              stroke={c.highlighted ? '#ffffff' : '#00000055'}
              strokeWidth={c.highlighted ? 3 : 1}
            />
            <text
              x={x + cellSize / 2}
              y={y + cellSize / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={cellSize * 0.16}
              fill="#f3f4f6"
              style={{ pointerEvents: 'none' }}
            >
              {c.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

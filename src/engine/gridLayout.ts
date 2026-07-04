import { rollDie, type Rng } from './dice'

// Digital equivalent of the book's "drop N dice on paper, trace an outline" mechanic:
// random-walk clustering on an abstract square grid. Cell adjacency alone forms the visible
// footprint (no separate outline/hull computation needed) — see the plan's UI section.

export type GridCell = { row: number; col: number }
export type GridPlacement = { cell: GridCell; parentIndex: number | null }

const ORTHOGONAL_OFFSETS: GridCell[] = [
  { row: -1, col: 0 },
  { row: 1, col: 0 },
  { row: 0, col: -1 },
  { row: 0, col: 1 },
]

const DIAGONAL_OFFSETS: GridCell[] = [
  { row: -1, col: -1 },
  { row: -1, col: 1 },
  { row: 1, col: -1 },
  { row: 1, col: 1 },
]

function cellKey(cell: GridCell): string {
  return `${cell.row},${cell.col}`
}

function neighborsOf(cell: GridCell, allowDiagonalAdjacency: boolean): GridCell[] {
  const offsets = allowDiagonalAdjacency ? [...ORTHOGONAL_OFFSETS, ...DIAGONAL_OFFSETS] : ORTHOGONAL_OFFSETS
  return offsets.map((o) => ({ row: cell.row + o.row, col: cell.col + o.col }))
}

function pickRandom<T>(items: T[], rng: Rng): T {
  return items[Math.floor(rng() * items.length)]
}

export type GridLayoutOptions = {
  allowDiagonalAdjacency?: boolean
  maxAnchorAttempts?: number
}

export function generateGridLayout(count: number, rng: Rng = Math.random, options: GridLayoutOptions = {}): GridPlacement[] {
  const allowDiagonalAdjacency = options.allowDiagonalAdjacency ?? false
  const maxAnchorAttempts = options.maxAnchorAttempts ?? 50

  if (count <= 0) return []

  const placements: GridPlacement[] = [{ cell: { row: 0, col: 0 }, parentIndex: null }]
  const occupied = new Set<string>([cellKey({ row: 0, col: 0 })])

  for (let i = 1; i < count; i++) {
    let placed = false

    for (let attempt = 0; attempt < maxAnchorAttempts && !placed; attempt++) {
      const anchorIndex = Math.floor(rng() * placements.length)
      const anchor = placements[anchorIndex].cell
      const freeNeighbors = neighborsOf(anchor, allowDiagonalAdjacency).filter((c) => !occupied.has(cellKey(c)))

      if (freeNeighbors.length > 0) {
        const cell = pickRandom(freeNeighbors, rng)
        occupied.add(cellKey(cell))
        placements.push({ cell, parentIndex: anchorIndex })
        placed = true
      }
    }

    if (!placed) {
      // Fallback: multi-source BFS from all occupied cells to guarantee termination and
      // connectivity even if random anchor retries keep missing (astronomically unlikely at
      // the counts this engine ever calls with — max 12 rooms / 64 districts — but a
      // deterministic, connected result must always be returned).
      const queue: GridCell[] = placements.map((p) => p.cell)
      const cameFromKey = new Map<string, string>()
      const visited = new Set<string>(queue.map(cellKey))
      let target: GridCell | null = null

      while (queue.length > 0 && !target) {
        const current = queue.shift()!
        for (const n of neighborsOf(current, allowDiagonalAdjacency)) {
          const key = cellKey(n)
          if (visited.has(key)) continue
          visited.add(key)
          cameFromKey.set(key, cellKey(current))
          if (!occupied.has(key)) {
            target = n
            break
          }
          queue.push(n)
        }
      }

      // target is guaranteed to be found: the grid is unbounded and occupied is finite.
      const targetKey = cellKey(target!)
      const parentCellKey = cameFromKey.get(targetKey)!
      const parentIndex = placements.findIndex((p) => cellKey(p.cell) === parentCellKey)
      occupied.add(targetKey)
      placements.push({ cell: target!, parentIndex })
    }
  }

  return placements
}

export function sumDice(count: number, sides: number, rng: Rng = Math.random): number {
  let total = 0
  for (let i = 0; i < count; i++) total += rollDie(sides, rng)
  return total
}

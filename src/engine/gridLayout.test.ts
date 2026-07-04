import { describe, expect, it } from 'vitest'
import { generateGridLayout } from './gridLayout'

// Deterministic seeded PRNG (LCG) — not real Math.random(), same seed always reproduces the
// same sequence, matching this project's deterministic-tests-only convention.
function seededRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

describe('generateGridLayout', () => {
  it('returns an empty array for count 0', () => {
    expect(generateGridLayout(0, seededRng(1))).toEqual([])
  })

  it('places a single item at the origin for count 1', () => {
    expect(generateGridLayout(1, seededRng(1))).toEqual([{ cell: { row: 0, col: 0 }, parentIndex: null }])
  })

  it.each([2, 3, 5, 8, 12, 20, 40, 64])('produces %i non-overlapping, connected cells', (count) => {
    for (const seed of [1, 42, 12345, 999999]) {
      const placements = generateGridLayout(count, seededRng(seed))
      expect(placements).toHaveLength(count)

      // No two placements share a cell.
      const keys = placements.map((p) => `${p.cell.row},${p.cell.col}`)
      expect(new Set(keys).size).toBe(count)

      // Every non-root placement is orthogonally adjacent to its parent's cell.
      for (let i = 1; i < placements.length; i++) {
        const { cell, parentIndex } = placements[i]
        expect(parentIndex).not.toBeNull()
        const parentCell = placements[parentIndex!].cell
        const dist = Math.abs(cell.row - parentCell.row) + Math.abs(cell.col - parentCell.col)
        expect(dist).toBe(1)
      }

      // The parent graph is a connected, cycle-free tree reachable from index 0.
      for (let i = 0; i < placements.length; i++) {
        let current = i
        const seen = new Set<number>()
        while (placements[current].parentIndex !== null) {
          expect(seen.has(current)).toBe(false)
          seen.add(current)
          current = placements[current].parentIndex!
        }
        expect(current).toBe(0)
      }
    }
  })

  it('root has parentIndex null and every other placement has a non-null parentIndex', () => {
    const placements = generateGridLayout(10, seededRng(7))
    expect(placements[0].parentIndex).toBeNull()
    for (let i = 1; i < placements.length; i++) {
      expect(placements[i].parentIndex).not.toBeNull()
    }
  })
})

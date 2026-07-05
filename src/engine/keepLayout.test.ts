import { describe, expect, it } from 'vitest'
import { computeKeepLayout, type Rect } from './keepLayout'

function rectsOverlap(a: Rect, b: Rect): boolean {
  const eps = 1e-6
  return a.x < b.x + b.width - eps && b.x < a.x + a.width - eps && a.y < b.y + b.height - eps && b.y < a.y + a.height - eps
}

describe('computeKeepLayout', () => {
  it('produces the requested number of named and generic rooms', () => {
    const layout = computeKeepLayout(4, [0, 1, 2, 3])
    expect(layout.named).toHaveLength(4)
    expect(layout.generic).toHaveLength(4)
  })

  it('handles zero generic rooms and fewer than 4 named rooms (Small tier)', () => {
    const layout = computeKeepLayout(3, [])
    expect(layout.named).toHaveLength(3)
    expect(layout.generic).toHaveLength(0)
  })

  it('every rect has non-negative x and y (renderer assumes this)', () => {
    for (const namedCount of [1, 2, 3, 4]) {
      const layout = computeKeepLayout(namedCount, [0, 0, 1])
      const all = [layout.courtyard, ...layout.named, ...layout.generic]
      for (const rect of all) {
        expect(rect.x).toBeGreaterThanOrEqual(0)
        expect(rect.y).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('no two rooms overlap, across named-room counts and generic parent assignments', () => {
    const cases: [number, number[]][] = [
      [4, [0, 1, 2, 3]],
      [3, [0, 1]],
      [4, [0, 0, 0, 0]], // all generic rooms attached to the same parent — still shouldn't collide
    ]
    for (const [namedCount, genericParents] of cases) {
      const layout = computeKeepLayout(namedCount, genericParents)
      const all = [layout.courtyard, ...layout.named, ...layout.generic]
      for (let i = 0; i < all.length; i++) {
        for (let j = i + 1; j < all.length; j++) {
          expect(rectsOverlap(all[i], all[j])).toBe(false)
        }
      }
    }
  })
})

// Geometry tests for the town map's river course (punch-list item 1b), independent of the
// settlement plan and of React. The notional hex is flat-top with apothem A, centred on the
// town; the table below hard-codes where each HexDirection's edge midpoint must be (y down), so
// a mirrored or rotated direction mapping fails loudly.
import { describe, expect, it } from 'vitest'
import { COURSE_SAMPLES, hexEdgeMidpoint, isOppositePair, nearestOnPolylines, riverCourseInHex, type Pt } from './riverCourse'
import { HEX_DIRECTIONS, type HexDirection } from '../hexgrid/hexMath'

const A = 60
const S3 = Math.sqrt(3) / 2

// Flat-top layout, y down: 0 south-east, 1 north-east, 2 north, 3 north-west, 4 south-west, 5 south.
const EXPECTED_MIDPOINT: Record<HexDirection, Pt> = {
  0: { x: S3 * A, y: 0.5 * A },
  1: { x: S3 * A, y: -0.5 * A },
  2: { x: 0, y: -A },
  3: { x: -S3 * A, y: -0.5 * A },
  4: { x: -S3 * A, y: 0.5 * A },
  5: { x: 0, y: A },
}

// Signed "how far outside the hex" a point is: max over the six edges of (n_d · p − A), where
// n_d is the outward normal of edge d. Zero on the boundary, negative inside.
function hexExcess(p: Pt): number {
  return Math.max(...HEX_DIRECTIONS.map((d) => (p.x * EXPECTED_MIDPOINT[d].x + p.y * EXPECTED_MIDPOINT[d].y) / A - A))
}

// Which edge a boundary point sits on (the edge whose plane it lies in).
function edgeOf(p: Pt): HexDirection | null {
  const onEdges = HEX_DIRECTIONS.filter((d) => Math.abs((p.x * EXPECTED_MIDPOINT[d].x + p.y * EXPECTED_MIDPOINT[d].y) / A - A) < 1e-6)
  return onEdges.length === 1 ? onEdges[0] : null
}

const near = (p: Pt, q: Pt, eps = 1e-6) => Math.hypot(p.x - q.x, p.y - q.y) < eps

function allFinite(arms: Pt[][]) {
  for (const arm of arms) for (const p of arm) expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true)
}

// The arm's boundary touches: endpoints on the boundary, and any interior sample on or outside
// the hex (there must be none).
function boundaryContacts(arm: Pt[]): { ends: Pt[]; interiorOutside: number } {
  const ends = [arm[0], arm[arm.length - 1]].filter((p) => Math.abs(hexExcess(p)) < 1e-6)
  let interiorOutside = 0
  for (let i = 1; i + 1 < arm.length; i++) if (hexExcess(arm[i]) > -1e-9) interiorOutside++
  return { ends, interiorOutside }
}

describe('hexEdgeMidpoint', () => {
  it.each(HEX_DIRECTIONS)('direction %i lands on the flat-top table', (d) => {
    expect(near(hexEdgeMidpoint(d, A), EXPECTED_MIDPOINT[d], 1e-9)).toBe(true)
  })

  it('midpoints sit exactly on the hex boundary, on their own edge', () => {
    for (const d of HEX_DIRECTIONS) {
      expect(hexExcess(EXPECTED_MIDPOINT[d])).toBeCloseTo(0, 9)
      expect(edgeOf(EXPECTED_MIDPOINT[d])).toBe(d)
    }
  })
})

describe('through rivers: all 30 ordered entry/exit pairs', () => {
  const pairs = HEX_DIRECTIONS.flatMap((e) => HEX_DIRECTIONS.filter((x) => x !== e).map((x) => [e, x] as const))
  expect(pairs).toHaveLength(30)

  it.each(pairs)('entry %i → exit %i touches the hex only at those two midpoints', (entry, exit) => {
    const course = riverCourseInHex([entry], exit, A)
    expect(course.kind).toBe('through')
    expect(course.entries).toEqual([entry])
    expect(course.exit).toBe(exit)
    expect(course.arms).toHaveLength(1)
    const arm = course.arms[0]
    allFinite(course.arms)
    expect(arm).toHaveLength(COURSE_SAMPLES + 1)
    expect(near(arm[0], EXPECTED_MIDPOINT[entry])).toBe(true)
    expect(near(arm[arm.length - 1], EXPECTED_MIDPOINT[exit])).toBe(true)
    expect(edgeOf(arm[0])).toBe(entry)
    expect(edgeOf(arm[arm.length - 1])).toBe(exit)
    const { ends, interiorOutside } = boundaryContacts(arm)
    expect(ends).toHaveLength(2)
    expect(interiorOutside).toBe(0)
    // Inside the square map too (the hex's apothem is the map's half-size).
    for (const p of arm) expect(Math.max(Math.abs(p.x), Math.abs(p.y))).toBeLessThanOrEqual(A + 1e-9)
  })

  it('enters and leaves perpendicular to the edges (heading straight into the hex)', () => {
    for (const [entry, exit] of pairs) {
      const arm = riverCourseInHex([entry], exit, A).arms[0]
      const inward = (d: HexDirection) => ({ x: -EXPECTED_MIDPOINT[d].x / A, y: -EXPECTED_MIDPOINT[d].y / A })
      const t0 = { x: arm[1].x - arm[0].x, y: arm[1].y - arm[0].y }
      const t1 = { x: arm[arm.length - 2].x - arm[arm.length - 1].x, y: arm[arm.length - 2].y - arm[arm.length - 1].y }
      const cos = (u: Pt, v: Pt) => (u.x * v.x + u.y * v.y) / (Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y))
      expect(cos(t0, inward(entry))).toBeGreaterThan(0.999)
      expect(cos(t1, inward(exit))).toBeGreaterThan(0.999)
    }
  })

  it('bend classes: an opposite pair runs straight through the centre, 120° bends pass near it, 60° pairs make a U inside the hex', () => {
    const closest = (arm: Pt[]) => Math.min(...arm.map((p) => Math.hypot(p.x, p.y)))
    for (const [entry, exit] of pairs) {
      const arm = riverCourseInHex([entry], exit, A).arms[0]
      const turn = Math.min((exit - entry + 6) % 6, (entry - exit + 6) % 6)
      if (turn === 3) {
        expect(isOppositePair(entry, exit)).toBe(true)
        expect(closest(arm)).toBeLessThan(1e-6)
        // Straight: every point is on the line between the midpoints.
        const m = EXPECTED_MIDPOINT[exit]
        for (const p of arm) expect(Math.abs(p.x * m.y - p.y * m.x) / A).toBeLessThan(1e-6)
      } else if (turn === 2) {
        // 120° pair: the curve's middle is 0.125·|M1+M2| = A/8 from the centre.
        expect(closest(arm)).toBeCloseTo(A / 8, 1)
      } else {
        // 60° pair (adjacent edges): the U's bottom is 0.125·√3·A from the centre.
        expect(turn).toBe(1)
        expect(closest(arm)).toBeCloseTo((0.125 * Math.sqrt(3) * A) / 1, 1)
        // It really is a U: the heading reverses between the ends (120° turn).
        const h0 = Math.atan2(arm[1].y - arm[0].y, arm[1].x - arm[0].x)
        const h1 = Math.atan2(arm[arm.length - 1].y - arm[arm.length - 2].y, arm[arm.length - 1].x - arm[arm.length - 2].x)
        let delta = Math.abs(h1 - h0) % (Math.PI * 2)
        delta = Math.min(delta, Math.PI * 2 - delta)
        expect(delta).toBeCloseTo((2 * Math.PI) / 3, 3)
      }
    }
  })

  it('the straight pair keeps its seeded offset in the middle, while still starting and ending on the midpoints', () => {
    for (const offset of [4, -4, 0.15 * 30]) {
      const arm = riverCourseInHex([2], 5, A, null, offset).arms[0]
      expect(near(arm[0], EXPECTED_MIDPOINT[2])).toBe(true)
      expect(near(arm[arm.length - 1], EXPECTED_MIDPOINT[5])).toBe(true)
      const middle = arm[COURSE_SAMPLES / 2]
      // Normal of N→S is ±x; the middle sits at |offset| from the centre, on the offset's side.
      expect(Math.abs(middle.x)).toBeCloseTo(Math.abs(offset), 6)
      expect(Math.abs(middle.y)).toBeLessThan(1e-6)
      expect(boundaryContacts(arm).interiorOutside).toBe(0)
    }
    // The offset is ignored for bends (decision A: only straight rivers keep it).
    expect(riverCourseInHex([2], 1, A, null, 4).arms[0]).toEqual(riverCourseInHex([2], 1, A, null, 0).arms[0])
  })
})

describe('springs and ending rivers: all 6 edges', () => {
  it.each(HEX_DIRECTIONS)('a spring runs from the centre to edge %i and touches no other edge', (exit) => {
    const course = riverCourseInHex([], exit, A)
    expect(course.kind).toBe('spring')
    expect(course.arms).toHaveLength(1)
    const arm = course.arms[0]
    allFinite(course.arms)
    expect(near(arm[0], { x: 0, y: 0 })).toBe(true)
    expect(near(arm[arm.length - 1], EXPECTED_MIDPOINT[exit])).toBe(true)
    expect(edgeOf(arm[arm.length - 1])).toBe(exit)
    const { ends, interiorOutside } = boundaryContacts(arm)
    expect(ends).toHaveLength(1)
    expect(interiorOutside).toBe(0)
  })

  it.each(HEX_DIRECTIONS)('an ending river runs from edge %i to the centre and touches no other edge', (entry) => {
    const course = riverCourseInHex([entry], null, A)
    expect(course.kind).toBe('ending')
    expect(course.arms).toHaveLength(1)
    const arm = course.arms[0]
    allFinite(course.arms)
    expect(near(arm[0], EXPECTED_MIDPOINT[entry])).toBe(true)
    expect(edgeOf(arm[0])).toBe(entry)
    expect(near(arm[arm.length - 1], { x: 0, y: 0 })).toBe(true)
    const { ends, interiorOutside } = boundaryContacts(arm)
    expect(ends).toHaveLength(1)
    expect(interiorOutside).toBe(0)
  })
})

describe('degenerate inputs (1c material — must not crash, degrade sensibly)', () => {
  it('several entries: one arm per entry, each ending on the exit midpoint', () => {
    const course = riverCourseInHex([2, 3], 0, A)
    expect(course.kind).toBe('through')
    expect(course.arms).toHaveLength(2)
    expect(near(course.arms[0][0], EXPECTED_MIDPOINT[2])).toBe(true)
    expect(near(course.arms[1][0], EXPECTED_MIDPOINT[3])).toBe(true)
    for (const arm of course.arms) expect(near(arm[arm.length - 1], EXPECTED_MIDPOINT[0])).toBe(true)
    const ending = riverCourseInHex([2, 3], null, A)
    expect(ending.kind).toBe('ending')
    expect(ending.arms).toHaveLength(2)
    for (const arm of ending.arms) expect(near(arm[arm.length - 1], { x: 0, y: 0 })).toBe(true)
  })

  it('exit null and no entries: a spring toward the caller\'s fallback edge', () => {
    const course = riverCourseInHex([], null, A, 4)
    expect(course.kind).toBe('spring')
    expect(course.exit).toBe(4)
    expect(near(course.arms[0][course.arms[0].length - 1], EXPECTED_MIDPOINT[4])).toBe(true)
    // Without a fallback it still draws something (edge 0) rather than throwing.
    expect(riverCourseInHex([], null, A).exit).toBe(0)
  })

  it('an entry equal to the exit (unreachable in the generator) is dropped: drawn as a spring', () => {
    const course = riverCourseInHex([5], 5, A)
    expect(course.kind).toBe('spring')
    expect(course.entries).toEqual([])
    expect(course.exit).toBe(5)
    const mixed = riverCourseInHex([5, 2], 5, A)
    expect(mixed.kind).toBe('through')
    expect(mixed.entries).toEqual([2])
  })

  it('duplicate entries collapse to one arm', () => {
    expect(riverCourseInHex([2, 2], 5, A).arms).toHaveLength(1)
  })
})

describe('nearestOnPolylines', () => {
  it('finds the closest segment, its point and tangent', () => {
    const arms = [[{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]]
    const a = nearestOnPolylines({ x: 5, y: 3 }, arms)
    expect(a.distance).toBeCloseTo(3, 9)
    expect(a.point).toEqual({ x: 5, y: 0 })
    expect(a.tangent).toEqual({ x: 1, y: 0 })
    expect(a.segment).toBe(0)
    const b = nearestOnPolylines({ x: 12, y: 8 }, arms)
    expect(b.distance).toBeCloseTo(2, 9)
    expect(b.segment).toBe(1)
    expect(nearestOnPolylines({ x: 0, y: 0 }, []).distance).toBe(Infinity)
  })
})

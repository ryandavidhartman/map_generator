// The course of a town map's river through its hex (punch-list item 1b, 2026-11-04). Pure
// geometry, independent of the settlement plan and of React, so it can be unit-tested edge by
// edge.
//
// The hex/square convention: the town map is a square of half-size `apothem` centred on the
// town. The hex is a notional flat-top hex of that apothem, centred on the town, so its six edge
// midpoints sit at `apothem` from the centre in the six HexDirection headings (hexMath.ts:
// 0 south-east, 1 north-east, 2 north, 3 north-west, 4 south-west, 5 south — y down). The N and
// S midpoints land on the map's border; the four diagonal ones sit inside it. The hex itself is
// never drawn; it only fixes where the river has to cross the map's edge so that it lines up
// with the overland map's river edges.
//
// Courses (user decision A, 2026-11-04 — "A1", every through river passes through the town):
// - through: a cubic from the entry midpoint to the exit midpoint with both control points at
//   the town centre (perpendicular to each edge at its ends). A 60° pair (adjacent edges) makes a
//   tight U-bend inside the town; a 120° pair a gentle bend through the middle. An opposite
//   pair is straight, offset by the plan's seeded ±0.15R so straight rivers look like before —
//   done by moving the shared control point so the curve still starts and ends at the midpoints.
// - spring (no entry): a straight line from the town centre to the exit midpoint.
// - ending (no exit): a straight line from the entry midpoint to the town centre. This is also
//   what a hex with no river record but an inflow gets.
// Beyond the hex the plan continues each arm radially to the map's border (riverCourse.ts only
// covers the part inside the hex).
//
// Degenerate inputs (1c material — not designed here, only kept from crashing):
// - several entries: one arm per entry, each to the exit (or the centre); they overlap near the
//   exit. 1c's merge drawing replaces this.
// - an entry equal to the exit: unreachable from the generator (an exit never points back into
//   an entry); the entry is dropped and the river is drawn as a spring.
// - exit null and no entries (a spring that dead-ended into a lake on its own hex): the caller
//   passes a seed-picked `fallbackExit` and the river is drawn as a spring toward it. 1c draws a
//   lakeshore instead.

import { directionAngle, HEX_DIRECTIONS, type HexDirection } from '../hexgrid/hexMath'

export type Pt = { x: number; y: number }

export type RiverCourseKind = 'through' | 'spring' | 'ending'

export type RiverCourse = {
  kind: RiverCourseKind
  // The directions actually drawn (after dropping an entry equal to the exit, and after the
  // fallback exit is applied).
  entries: HexDirection[]
  exit: HexDirection | null
  // One polyline per arm, inside the hex: through = entry midpoint → exit midpoint; spring =
  // centre → exit midpoint; ending = entry midpoint → centre.
  arms: Pt[][]
}

// Samples per arm. Segments of about 0.6 units on a Town map — fine enough that the drawn
// polyline reads as a curve at the U-bend, coarse enough that distance queries stay cheap.
export const COURSE_SAMPLES = 120

// The midpoint of the hex edge in direction `d`, for a flat-top hex of this apothem.
export function hexEdgeMidpoint(d: HexDirection, apothem: number): Pt {
  const a = directionAngle(d)
  return { x: Math.cos(a) * apothem, y: Math.sin(a) * apothem }
}

// A cubic Bézier sampled into a polyline (endpoints included).
function cubic(p0: Pt, p1: Pt, p2: Pt, p3: Pt, samples: number): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i <= samples; i++) {
    const t = i / samples
    const u = 1 - t
    const w0 = u * u * u
    const w1 = 3 * u * u * t
    const w2 = 3 * u * t * t
    const w3 = t * t * t
    out.push({ x: w0 * p0.x + w1 * p1.x + w2 * p2.x + w3 * p3.x, y: w0 * p0.y + w1 * p1.y + w2 * p2.y + w3 * p3.y })
  }
  return out
}

function line(from: Pt, to: Pt, samples: number): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i <= samples; i++) {
    const t = i / samples
    out.push({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t })
  }
  return out
}

export function isOppositePair(a: HexDirection, b: HexDirection): boolean {
  return (a + 3) % 6 === b
}

// `straightOffset`: for an opposite-edge (straight) pair only, how far (signed, in map units)
// the river passes from the centre. The shared control point moves to offset / 0.75 along the
// pair's normal so the curve's middle lands at exactly `straightOffset` while its ends stay on
// the edge midpoints.
export function riverCourseInHex(
  entriesIn: HexDirection[],
  exitIn: HexDirection | null,
  apothem: number,
  fallbackExit: HexDirection | null = null,
  straightOffset = 0,
): RiverCourse {
  const centre: Pt = { x: 0, y: 0 }
  let exit = exitIn
  let entries = [...new Set(entriesIn)].filter((d) => d !== exit)
  if (exit === null && entries.length === 0) exit = fallbackExit ?? HEX_DIRECTIONS[0]

  if (exit !== null && entries.length === 0) {
    return { kind: 'spring', entries, exit, arms: [line(centre, hexEdgeMidpoint(exit, apothem), COURSE_SAMPLES)] }
  }
  if (exit === null) {
    return { kind: 'ending', entries, exit, arms: entries.map((e) => line(hexEdgeMidpoint(e, apothem), centre, COURSE_SAMPLES)) }
  }
  const to = hexEdgeMidpoint(exit, apothem)
  const arms = entries.map((e) => {
    const from = hexEdgeMidpoint(e, apothem)
    let control = centre
    if (isOppositePair(e, exit!) && straightOffset !== 0) {
      // Normal of the straight pair: the curve's middle is 0.75 × control for a cubic whose two
      // control points coincide, so control = offset / 0.75 along the normal.
      const dx = to.x - from.x
      const dy = to.y - from.y
      const len = Math.hypot(dx, dy) || 1
      const n = { x: -dy / len, y: dx / len }
      control = { x: (n.x * straightOffset) / 0.75, y: (n.y * straightOffset) / 0.75 }
    }
    return cubic(from, control, control, to, COURSE_SAMPLES)
  })
  return { kind: 'through', entries, exit, arms }
}

// --- distance to a set of polylines (shared by the plan's cutting, wall gaps and wet checks) ---

export type NearestOnCourse = { point: Pt; tangent: Pt; distance: number; arm: number; segment: number }

// Squared distance from p to segment ab (no allocation — this runs in tight loops).
function segmentDistance2(px: number, py: number, a: Pt, b: Pt): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy || 1
  let t = ((px - a.x) * dx + (py - a.y) * dy) / len2
  t = t < 0 ? 0 : t > 1 ? 1 : t
  const qx = a.x + dx * t - px
  const qy = a.y + dy * t - py
  return qx * qx + qy * qy
}

export function nearestOnPolylines(p: Pt, arms: Pt[][]): NearestOnCourse {
  let bestD2 = Infinity
  let bestArm = -1
  let bestSeg = -1
  for (let ai = 0; ai < arms.length; ai++) {
    const arm = arms[ai]
    for (let i = 0; i + 1 < arm.length; i++) {
      const d2 = segmentDistance2(p.x, p.y, arm[i], arm[i + 1])
      if (d2 < bestD2) {
        bestD2 = d2
        bestArm = ai
        bestSeg = i
      }
    }
  }
  if (bestArm === -1) return { point: { x: NaN, y: NaN }, tangent: { x: 1, y: 0 }, distance: Infinity, arm: -1, segment: -1 }
  const a = arms[bestArm][bestSeg]
  const b = arms[bestArm][bestSeg + 1]
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy || 1
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
  const len = Math.sqrt(len2)
  return { point: { x: a.x + dx * t, y: a.y + dy * t }, tangent: { x: dx / len, y: dy / len }, distance: Math.sqrt(bestD2), arm: bestArm, segment: bestSeg }
}

export function distanceToPolylines(p: Pt, arms: Pt[][]): number {
  let bestD2 = Infinity
  for (let ai = 0; ai < arms.length; ai++) {
    const arm = arms[ai]
    for (let i = 0; i + 1 < arm.length; i++) {
      const d2 = segmentDistance2(p.x, p.y, arm[i], arm[i + 1])
      if (d2 < bestD2) bestD2 = d2
    }
  }
  return Math.sqrt(bestD2)
}

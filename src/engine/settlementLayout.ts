import { Delaunay } from 'd3-delaunay'
import type { Rng } from './dice'
import { intersectPolygons, type Polygon as ClipPolygon } from './polygonClip'

// Real settlement layout: an organic jittered "city mask" boundary, districts as Voronoi
// cells clipped to that mask, and a curved road network. Ported as an algorithm idea (not
// code — different stack) from a sibling project's SettlementServer.scala — see
// docs/plan-sites-settlements-mongo.md's "Real settlement maps" section for source citations
// and the scope this deliberately dropped (building footprints/plazas, and a separate
// union-of-districts-then-buffer outline step — the mask itself already IS the organic
// outline, since every district is clipped to it, so no extra union/buffer pass is needed).

export type Point = [number, number]
export type RoadEdge = { a: number; b: number; kind: 'main' | 'minor' }

const MASK_SAMPLES = 20
const MASK_JITTER_MIN = 0.7
const MASK_JITTER_MAX = 1.05
const UNIT = 12 // abstract layout units, roughly one per district's "personal space"

function distance(a: Point, b: Point): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1])
}

function boundingBox(polygon: Point[]): [number, number, number, number] {
  const xs = polygon.map((p) => p[0])
  const ys = polygon.map((p) => p[1])
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
}

function polygonArea(polygon: Point[]): number {
  let area = 0
  for (let i = 0; i < polygon.length; i++) {
    const [x1, y1] = polygon[i]
    const [x2, y2] = polygon[(i + 1) % polygon.length]
    area += x1 * y2 - x2 * y1
  }
  return Math.abs(area / 2)
}

// Standard ray-casting point-in-polygon test.
function pointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false
  const [x, y] = point
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]
    const [xj, yj] = polygon[j]
    const crosses = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
    if (crosses) inside = !inside
  }
  return inside
}

// Jittered blob boundary: N angular samples around a circle, each with a randomized radius.
// districtCount scales the base radius so bigger settlements get more room. Returns a closed
// ring (first point repeated at the end), matching d3-delaunay's and polygon-clipping's own
// convention for polygons.
export function buildCityMask(districtCount: number, rng: Rng = Math.random): Point[] {
  const baseRadius = Math.sqrt(districtCount) * UNIT
  const points: Point[] = []
  for (let i = 0; i < MASK_SAMPLES; i++) {
    const angle = (i / MASK_SAMPLES) * Math.PI * 2
    const radius = baseRadius * (MASK_JITTER_MIN + rng() * (MASK_JITTER_MAX - MASK_JITTER_MIN))
    points.push([Math.cos(angle) * radius, Math.sin(angle) * radius])
  }
  points.push(points[0])
  return points
}

// Poisson-disc-like rejection sampling: places `count` points strictly inside the mask with a
// minimum pairwise distance, relaxing that minimum after repeated failures and finally
// accepting any in-mask point as a last resort — bounded attempts, always terminates with
// exactly `count` points, same "bounded retry, guaranteed termination" shape as
// gridLayout.ts's anchor-retry/BFS-fallback.
export function sampleDistrictSites(count: number, mask: Point[], rng: Rng = Math.random): Point[] {
  const [minX, minY, maxX, maxY] = boundingBox(mask)
  const area = (maxX - minX) * (maxY - minY)
  let minDist = Math.sqrt(area / count) * 0.6
  const points: Point[] = []

  for (let i = 0; i < count; i++) {
    let placed = false
    for (let attempt = 0; attempt < 200 && !placed; attempt++) {
      if (attempt > 0 && attempt % 40 === 0) minDist *= 0.75
      const candidate: Point = [minX + rng() * (maxX - minX), minY + rng() * (maxY - minY)]
      if (!pointInPolygon(candidate, mask)) continue
      if (points.every((p) => distance(p, candidate) >= minDist)) {
        points.push(candidate)
        placed = true
      }
    }
    if (!placed) {
      let fallback: Point | null = null
      for (let attempt = 0; attempt < 500 && !fallback; attempt++) {
        const candidate: Point = [minX + rng() * (maxX - minX), minY + rng() * (maxY - minY)]
        if (pointInPolygon(candidate, mask)) fallback = candidate
      }
      points.push(fallback ?? [(minX + maxX) / 2, (minY + maxY) / 2])
    }
  }

  return points
}

function toClipPolygon(ring: Point[]): ClipPolygon {
  return [ring]
}

// One Voronoi cell per site, clipped to the organic mask so every district's shape follows
// the settlement's overall boundary rather than a rectangular Voronoi bound.
export function buildVoronoiDistricts(sites: Point[], mask: Point[]): Point[][] {
  const bounds = boundingBox(mask)
  const delaunay = Delaunay.from(sites)
  const voronoi = delaunay.voronoi(bounds)

  return sites.map((_, i) => {
    const cell = voronoi.cellPolygon(i) as unknown as Point[] | null
    if (!cell) return mask // degenerate fallback — not expected to trigger with in-mask sites

    const clipped = intersectPolygons(toClipPolygon(cell), toClipPolygon(mask))
    if (clipped.length === 0) return cell // fallback: unclipped cell

    // Intersection can yield multiple disjoint pieces in pathological cases — keep the largest.
    const largest = clipped.reduce((best, candidate) => (polygonArea(candidate[0]) > polygonArea(best[0]) ? candidate : best))
    return largest[0] as Point[]
  })
}

// Seat connects to its 2 nearest neighbors (main); non-seat sites form an angular ring loop
// around the seat when >=3 exist (main); every site also gets a nearest-neighbor edge (minor)
// so no district is ever isolated. Pure function of site positions — no rng needed.
export function buildRoadEdges(sites: Point[], seatIndex: number): RoadEdge[] {
  const n = sites.length
  if (n <= 1) return []

  const edgeKeys = new Set<string>()
  const edges: RoadEdge[] = []
  function addEdge(a: number, b: number, kind: 'main' | 'minor') {
    const key = a < b ? `${a}-${b}` : `${b}-${a}`
    if (edgeKeys.has(key)) return
    edgeKeys.add(key)
    edges.push({ a, b, kind })
  }

  const others = sites.map((_, i) => i).filter((i) => i !== seatIndex)

  const byDistToSeat = [...others].sort((i, j) => distance(sites[seatIndex], sites[i]) - distance(sites[seatIndex], sites[j]))
  for (const i of byDistToSeat.slice(0, 2)) addEdge(seatIndex, i, 'main')

  if (others.length >= 3) {
    const byAngle = [...others].sort((i, j) => {
      const angleI = Math.atan2(sites[i][1] - sites[seatIndex][1], sites[i][0] - sites[seatIndex][0])
      const angleJ = Math.atan2(sites[j][1] - sites[seatIndex][1], sites[j][0] - sites[seatIndex][0])
      return angleI - angleJ
    })
    for (let k = 0; k < byAngle.length; k++) addEdge(byAngle[k], byAngle[(k + 1) % byAngle.length], 'main')
  }

  for (let i = 0; i < n; i++) {
    let nearest = -1
    let nearestDist = Infinity
    for (let j = 0; j < n; j++) {
      if (i === j) continue
      const d = distance(sites[i], sites[j])
      if (d < nearestDist) {
        nearestDist = d
        nearest = j
      }
    }
    if (nearest !== -1) addEdge(i, nearest, 'minor')
  }

  return edges
}

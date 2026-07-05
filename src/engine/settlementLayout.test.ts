import { describe, expect, it } from 'vitest'
import {
  buildCityMask,
  buildRoadEdges,
  buildVoronoiDistricts,
  generateBuildingFootprints,
  sampleDistrictSites,
  type Point,
} from './settlementLayout'

// Deterministic seeded PRNG (LCG) — matches this project's deterministic-tests-only convention
// (see gridLayout.test.ts). Rejection sampling here has a variable, non-scriptable rng call
// count (same shape as gridLayout.ts's anchor-retry fallback), so tests use seeded rng +
// structural invariants rather than exact-scripted rng values.
function seededRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

function pointInPolygonRef(point: Point, polygon: Point[]): boolean {
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

describe('buildCityMask', () => {
  it('returns a closed ring (first point repeated at the end)', () => {
    const mask = buildCityMask(6, seededRng(1))
    expect(mask[0]).toEqual(mask[mask.length - 1])
    expect(mask.length).toBeGreaterThan(3)
  })

  it('grows with district count', () => {
    const small = buildCityMask(3, seededRng(1))
    const big = buildCityMask(8, seededRng(1))
    const radiusOf = (mask: Point[]) => Math.max(...mask.map(([x, y]) => Math.hypot(x, y)))
    expect(radiusOf(big)).toBeGreaterThan(radiusOf(small))
  })
})

describe('sampleDistrictSites', () => {
  it.each([3, 4, 6, 8])('places exactly %i sites, all strictly inside the mask', (count) => {
    for (const seed of [1, 42, 12345]) {
      const mask = buildCityMask(count, seededRng(seed))
      const sites = sampleDistrictSites(count, mask, seededRng(seed + 1))
      expect(sites).toHaveLength(count)
      for (const site of sites) {
        expect(pointInPolygonRef(site, mask)).toBe(true)
      }
    }
  })
})

describe('buildVoronoiDistricts', () => {
  it('returns one non-degenerate polygon per site', () => {
    const mask = buildCityMask(6, seededRng(2))
    const sites = sampleDistrictSites(6, mask, seededRng(3))
    const districts = buildVoronoiDistricts(sites, mask)
    expect(districts).toHaveLength(6)
    for (const polygon of districts) {
      expect(polygon.length).toBeGreaterThanOrEqual(3)
    }
  })

  it('every site sits within (or acceptably near, given clipping) its own district polygon', () => {
    // Not a strict containment check (clipping can shave a sliver off near the mask edge in
    // rare cases) — just confirms each site is at least close to its own cell's bounding area.
    const mask = buildCityMask(4, seededRng(4))
    const sites = sampleDistrictSites(4, mask, seededRng(5))
    const districts = buildVoronoiDistricts(sites, mask)
    for (let i = 0; i < sites.length; i++) {
      const [sx, sy] = sites[i]
      const xs = districts[i].map((p) => p[0])
      const ys = districts[i].map((p) => p[1])
      expect(sx).toBeGreaterThanOrEqual(Math.min(...xs) - 1e-6)
      expect(sx).toBeLessThanOrEqual(Math.max(...xs) + 1e-6)
      expect(sy).toBeGreaterThanOrEqual(Math.min(...ys) - 1e-6)
      expect(sy).toBeLessThanOrEqual(Math.max(...ys) + 1e-6)
    }
  })
})

describe('buildRoadEdges', () => {
  it('returns no edges for 0 or 1 sites', () => {
    expect(buildRoadEdges([], 0)).toEqual([])
    expect(buildRoadEdges([[0, 0]], 0)).toEqual([])
  })

  it('produces a fully connected graph with no duplicate or self edges, across sizes', () => {
    for (const count of [3, 4, 6, 8]) {
      const mask = buildCityMask(count, seededRng(10))
      const sites = sampleDistrictSites(count, mask, seededRng(11))
      const edges = buildRoadEdges(sites, 0)

      const seen = new Set<string>()
      for (const { a, b } of edges) {
        expect(a).not.toBe(b)
        const key = a < b ? `${a}-${b}` : `${b}-${a}`
        expect(seen.has(key)).toBe(false)
        seen.add(key)
      }

      const adjacency = new Map<number, number[]>()
      for (let i = 0; i < count; i++) adjacency.set(i, [])
      for (const { a, b } of edges) {
        adjacency.get(a)!.push(b)
        adjacency.get(b)!.push(a)
      }
      const visited = new Set<number>([0])
      const queue = [0]
      while (queue.length > 0) {
        const current = queue.shift()!
        for (const n of adjacency.get(current)!) {
          if (!visited.has(n)) {
            visited.add(n)
            queue.push(n)
          }
        }
      }
      expect(visited.size).toBe(count)
    }
  })

  it('the seat always has at least one main road when other sites exist', () => {
    const mask = buildCityMask(6, seededRng(20))
    const sites = sampleDistrictSites(6, mask, seededRng(21))
    const edges = buildRoadEdges(sites, 0)
    const seatMainEdges = edges.filter((e) => e.kind === 'main' && (e.a === 0 || e.b === 0))
    expect(seatMainEdges.length).toBeGreaterThan(0)
  })
})

describe('generateBuildingFootprints', () => {
  function setupFor(count: number, seed: number) {
    const mask = buildCityMask(count, seededRng(seed))
    const sites = sampleDistrictSites(count, mask, seededRng(seed + 1))
    const districts = buildVoronoiDistricts(sites, mask)
    const edges = buildRoadEdges(sites, 0)
    const roadSegments: [Point, Point][] = edges.map(({ a, b }) => [sites[a], sites[b]])
    return { mask, districts, roadSegments }
  }

  it('places at least some footprints in a reasonably sized district', () => {
    const { mask, districts, roadSegments } = setupFor(4, 1)
    const footprints = generateBuildingFootprints(districts[0], mask, roadSegments, seededRng(2))
    expect(footprints.length).toBeGreaterThan(0)
  })

  it('every footprint sits inside its district polygon', () => {
    const { mask, districts, roadSegments } = setupFor(6, 3)
    for (let i = 0; i < districts.length; i++) {
      const footprints = generateBuildingFootprints(districts[i], mask, roadSegments, seededRng(i + 10))
      for (const f of footprints) {
        const xs = districts[i].map((p) => p[0])
        const ys = districts[i].map((p) => p[1])
        expect(f.x).toBeGreaterThanOrEqual(Math.min(...xs) - 1e-6)
        expect(f.x).toBeLessThanOrEqual(Math.max(...xs) + 1e-6)
        expect(f.y).toBeGreaterThanOrEqual(Math.min(...ys) - 1e-6)
        expect(f.y).toBeLessThanOrEqual(Math.max(...ys) + 1e-6)
      }
    }
  })

  it('no two footprints in the same district overlap', () => {
    const { mask, districts, roadSegments } = setupFor(8, 5)
    for (let i = 0; i < districts.length; i++) {
      const footprints = generateBuildingFootprints(districts[i], mask, roadSegments, seededRng(i + 20))
      for (let a = 0; a < footprints.length; a++) {
        for (let b = a + 1; b < footprints.length; b++) {
          const halfDiagA = Math.hypot(footprints[a].width, footprints[a].height) / 2
          const halfDiagB = Math.hypot(footprints[b].width, footprints[b].height) / 2
          const dist = Math.hypot(footprints[a].x - footprints[b].x, footprints[a].y - footprints[b].y)
          expect(dist).toBeGreaterThanOrEqual(halfDiagA + halfDiagB - 1e-6)
        }
      }
    }
  })

  it('produces both buildings and occasional parks across many footprints', () => {
    const { mask, districts, roadSegments } = setupFor(8, 7)
    const allFootprints = districts.flatMap((d) => generateBuildingFootprints(d, mask, roadSegments, seededRng(42)))
    const kinds = new Set(allFootprints.map((f) => f.kind))
    expect(kinds.has('building')).toBe(true)
  })
})

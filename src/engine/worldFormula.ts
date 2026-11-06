// The seeded world formula (punch-list item 1a): given a campaign's world seed and a hex's
// position, says whether that spot is sea or land. Nothing is generated up front — the formula
// is only asked about hexes as they're revealed (and their neighbors), so the map stays
// unbounded, and the same hex always gets the same answer whichever way the party approaches it.
//
// How it works: layered gradient noise (fractal Brownian motion — a big, slow continent wave
// plus smaller, fainter octaves that wrinkle the coastline) over the hex's pixel position, with
// a gentle domain warp so coasts bend instead of reading as a grid. A spot is sea where the noise
// falls below the sea level. Two local touch-ups keep the tuning targets (both are pure
// functions of position, so they never depend on what's been revealed):
//   - a one-hex pond (raw sea with no raw-sea neighbor) is filled in as land;
//   - a one-hex speck (raw land with no raw-land neighbor) is drowned as sea.
//
// Scale (CONTINENT_WAVELENGTH) and SEA_LEVEL set how big landmasses and seas are. They were
// tuned by simulation (worldSimulation.test.ts) against the spec's targets: the party usually
// explores one big landmass with sea along some edges, seas it reaches are mostly 100+ hexes,
// one-hex ponds are 5% or fewer, islands are possible but uncommon.

import { axialToPixel, neighborsOf, type AxialCoord } from '../hexgrid/hexMath'
import type { Terrain } from '../data/tables'
import type { Rng } from './dice'

// Distance (in hex-size units, axialToPixel with size 1) over which the main continent wave
// repeats. Hex centers sit ~1.5-1.73 units apart.
const CONTINENT_WAVELENGTH = 150
// Fraction-ish of the noise range that is sea: noise is roughly in [-1, 1]; points below this
// are sea. Higher = more sea.
const SEA_LEVEL = -0.08
const OCTAVES = 4
const LACUNARITY = 2.1
const GAIN = 0.42
const WARP_STRENGTH = 0.35

// --- hashing ---------------------------------------------------------------------------------

function hash32(seed: number, x: number, y: number): number {
  let h = (seed ^ Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1)) >>> 0
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d)
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39)
  h ^= h >>> 15
  return h >>> 0
}

const GRADIENT_COUNT = 16
const GRADIENTS: [number, number][] = Array.from({ length: GRADIENT_COUNT }, (_, i) => {
  const a = (i / GRADIENT_COUNT) * Math.PI * 2
  return [Math.cos(a), Math.sin(a)]
})

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10)
}

// Classic 2D gradient noise in about [-1, 1].
function gradientNoise(seed: number, x: number, y: number): number {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const fx = x - x0
  const fy = y - y0
  const dot = (ix: number, iy: number, dx: number, dy: number) => {
    const g = GRADIENTS[hash32(seed, ix, iy) % GRADIENT_COUNT]
    return g[0] * dx + g[1] * dy
  }
  const u = fade(fx)
  const v = fade(fy)
  const n00 = dot(x0, y0, fx, fy)
  const n10 = dot(x0 + 1, y0, fx - 1, fy)
  const n01 = dot(x0, y0 + 1, fx, fy - 1)
  const n11 = dot(x0 + 1, y0 + 1, fx - 1, fy - 1)
  const nx0 = n00 + (n10 - n00) * u
  const nx1 = n01 + (n11 - n01) * u
  // Gradient noise's natural range is about ±0.7; scale toward ±1.
  return (nx0 + (nx1 - nx0) * v) * 1.4
}

function fbm(seed: number, x: number, y: number): number {
  let sum = 0
  let amplitude = 1
  let total = 0
  let frequency = 1
  for (let i = 0; i < OCTAVES; i++) {
    sum += gradientNoise(seed + i * 1013, x * frequency, y * frequency) * amplitude
    total += amplitude
    amplitude *= GAIN
    frequency *= LACUNARITY
  }
  return sum / total
}

// --- the formula -----------------------------------------------------------------------------

// Where in the noise field the hex grid's origin sits, per seed. Without this the origin would
// sample pixel (0, 0) — a lattice corner of the gradient noise, where every octave is near zero
// — so the starting hex would always sit at mid elevation: land starts never far from the sea,
// ocean starts never far from land (found 2026-11-03).
function originOffset(worldSeed: number): { x: number; y: number } {
  return { x: (hash32(worldSeed, 11, 13) / 0x100000000) * 1000, y: (hash32(worldSeed, 17, 19) / 0x100000000) * 1000 }
}

// The underlying continuous height of the world at a hex (in about [-1, 1]); sea where it is
// below SEA_LEVEL.
function worldHeightAt(worldSeed: number, coord: AxialCoord): number {
  const p = axialToPixel(coord, 1)
  const offset = originOffset(worldSeed)
  const x = (p.x + offset.x) / CONTINENT_WAVELENGTH
  const y = (p.y + offset.y) / CONTINENT_WAVELENGTH
  // Domain warp: offset the sample point by a second, lower-frequency noise so coastlines curl.
  const wx = fbm(worldSeed + 7919, x * 0.7 + 3.1, y * 0.7 + 1.7) * WARP_STRENGTH
  const wy = fbm(worldSeed + 104729, x * 0.7 - 2.3, y * 0.7 + 5.9) * WARP_STRENGTH
  return fbm(worldSeed, x + wx, y + wy)
}

// Raw answers are memoized: isSeaAt asks about a hex and its six neighbors, the renderer and the
// settlement water rules ask about the same hexes over and over, and the noise is the costly
// part. The cache is bounded so a long campaign (or a simulation) can't grow it without limit.
const RAW_SEA_CACHE = new Map<string, boolean>()
const RAW_SEA_CACHE_LIMIT = 500_000

function isRawSea(worldSeed: number, coord: AxialCoord): boolean {
  const key = `${worldSeed}:${coord.q},${coord.r}`
  const cached = RAW_SEA_CACHE.get(key)
  if (cached !== undefined) return cached
  if (RAW_SEA_CACHE.size >= RAW_SEA_CACHE_LIMIT) RAW_SEA_CACHE.clear()
  const sea = worldHeightAt(worldSeed, coord) < SEA_LEVEL
  RAW_SEA_CACHE.set(key, sea)
  return sea
}

// Sea or land at this hex. See the header for the two one-hex touch-ups.
export function isSeaAt(worldSeed: number, coord: AxialCoord): boolean {
  const raw = isRawSea(worldSeed, coord)
  const rawSeaNeighbors = neighborsOf(coord).filter((n) => isRawSea(worldSeed, n)).length
  if (raw) return rawSeaNeighbors > 0
  return rawSeaNeighbors === 6
}

// Whether any of the hex's six neighbors is the formula's sea, revealed or not.
export function isNextToSea(worldSeed: number, coord: AxialCoord): boolean {
  return neighborsOf(coord).some((n) => isSeaAt(worldSeed, n))
}

// --- placing the world -----------------------------------------------------------------------

export const WORLD_SEED_RANGE = 0x7fffffff

export function randomWorldSeed(rng: Rng): number {
  return Math.floor(rng() * WORLD_SEED_RANGE)
}

const START_HEX: AxialCoord = { q: 0, r: 0 }
export const PLACEMENT_TRIES = 2000

// Picks the world seed for a new campaign so the starting hex agrees with the chosen terrain:
// sea for Ocean, land otherwise — and for Coast, land with the sea next door. A land start
// (other than Coast) also never touches the sea (none of its neighbors is sea) — a rule of this
// project, not the spec, kept for now so the party begins on solid ground rather than on a
// speck; it can still reach the coast in a few steps.
//
// The rng only gives the starting point of the search; the search then walks consecutive seeds,
// so even a constant rng finds a fitting world. If `tries` consecutive seeds all fail the
// terrain, this throws rather than returning a world that contradicts the start hex (it used to
// fall back silently; found 2026-11-03). With the real noise a fit turns up within a handful of
// seeds, so the throw is a guard, not a path.
export function pickWorldSeedForStart(terrain: Terrain, rng: Rng, tries = PLACEMENT_TRIES): number {
  const wantSea = terrain === 'Ocean'
  const wantCoast = terrain === 'Coast'
  const first = randomWorldSeed(rng)
  for (let i = 0; i < tries; i++) {
    const seed = (first + i) % WORLD_SEED_RANGE
    if (isSeaAt(seed, START_HEX) !== wantSea) continue
    if (wantSea) return seed
    if (isNextToSea(seed, START_HEX) === wantCoast) return seed
  }
  throw new Error(`pickWorldSeedForStart: no world found for a ${terrain} start in ${tries} tries`)
}

// Pure geometry for Keep's floor plan. Originally a radial hub-and-spoke starburst (courtyard at
// center, rooms fanned out around it) reusing DungeonMapSvg unmodified — replaced 2026-07-06 after
// the user flagged that a starburst doesn't read as a keep at all (reference: a walled compound
// with a courtyard yard beside a clustered building, corner/midpoint towers, a gatehouse). This
// rewrite keeps the exact same courtyard-hub / named-first-hop / generic-second-hop CONNECTIVITY
// model (unchanged in generateKeep.ts — only the geometry that places rects changed): named rooms
// (and their own generic children, grouped immediately after them) now tile into a compact grid
// "building block," with the courtyard as a separate yard rect beside it — read together, they
// look like a keep's building sitting in its own walled yard, not a wheel of spokes. The outer
// wall/towers/gatehouse are NOT computed here — KeepMapSvg.tsx derives them purely from the room
// rects at render time (bounding box + margin), the same "no new persisted data" approach
// caveRenderShapes.ts used for cave rendering, so KeepSite's schema/rng stream are untouched.

export type Rect = { x: number; y: number; width: number; height: number }

const CELL_SIZE = 6
const CELL_GAP = 2
const NAMED_ROOM_SIZE = 5
const GENERIC_ROOM_SIZE = 4
const COURTYARD_GAP = 3
const MIN_COURTYARD_SIZE = 7

function centeredIn(cell: Rect, size: number): Rect {
  return { x: cell.x + (cell.width - size) / 2, y: cell.y + (cell.height - size) / 2, width: size, height: size }
}

export type KeepLayout = {
  courtyard: Rect
  named: Rect[]
  // Each generic room's parentIndex refers to an index into `named` — the first-hop room it
  // branches off (round-robin assigned by the caller).
  generic: Rect[]
}

// `genericParentIndices[i]` is the index into the named-room array that generic room `i`
// attaches to. All rects are shifted into non-negative coordinate space (KeepMapSvg/DungeonMapSvg
// assume x/y >= 0, same as dungeonLayout.ts's BSP output already does).
export function computeKeepLayout(namedCount: number, genericParentIndices: number[]): KeepLayout {
  // Ordered building-room slots: each named room immediately followed by its own generic
  // children (grouped) — so a named room's generics land in the grid right next to it, reading
  // as an attached wing rather than scattered rooms with no visual relation to their parent.
  // Defensive clamp (matches the old starburst's `namedAngles[parentIndex] ?? 0` fallback):
  // real callers (generateKeep.ts) always compute `i % namedCount`, so this is always a no-op in
  // practice, but keeps the function total rather than dropping a generic room silently.
  const maxNamedIndex = Math.max(namedCount - 1, 0)
  const clampedParents = genericParentIndices.map((p) => Math.min(Math.max(p, 0), maxNamedIndex))

  type Slot = { kind: 'named'; index: number } | { kind: 'generic'; index: number }
  const slots: Slot[] = []
  for (let i = 0; i < namedCount; i++) {
    slots.push({ kind: 'named', index: i })
    clampedParents.forEach((parentIndex, genericIndex) => {
      if (parentIndex === i) slots.push({ kind: 'generic', index: genericIndex })
    })
  }

  const cols = Math.max(1, Math.ceil(Math.sqrt(slots.length)))
  const rows = Math.max(1, Math.ceil(slots.length / cols))
  const gridHeight = rows * (CELL_SIZE + CELL_GAP) - CELL_GAP

  const courtyardSize = Math.max(MIN_COURTYARD_SIZE, gridHeight)
  const courtyard: Rect = { x: 0, y: 0, width: courtyardSize, height: courtyardSize }
  const gridOriginX = courtyardSize + COURTYARD_GAP
  const gridOriginY = (courtyardSize - gridHeight) / 2

  const named: Rect[] = new Array(namedCount)
  const generic: Rect[] = new Array(genericParentIndices.length)

  slots.forEach((slot, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    const cell: Rect = {
      x: gridOriginX + col * (CELL_SIZE + CELL_GAP),
      y: gridOriginY + row * (CELL_SIZE + CELL_GAP),
      width: CELL_SIZE,
      height: CELL_SIZE,
    }
    if (slot.kind === 'named') {
      named[slot.index] = centeredIn(cell, NAMED_ROOM_SIZE)
    } else {
      generic[slot.index] = centeredIn(cell, GENERIC_ROOM_SIZE)
    }
  })

  const all = [courtyard, ...named, ...generic]
  const minX = Math.min(...all.map((r) => r.x))
  const minY = Math.min(...all.map((r) => r.y))
  const shiftX = -minX + 1
  const shiftY = -minY + 1
  const shift = (r: Rect): Rect => ({ ...r, x: r.x + shiftX, y: r.y + shiftY })

  return {
    courtyard: shift(courtyard),
    named: named.map(shift),
    generic: generic.map(shift),
  }
}

// Pure geometry for Keep's hub-and-spoke floor plan — deliberately not a reuse of
// dungeonLayout.ts's BSP tiler, since a Keep's shape is a fixed courtyard hub with rooms
// radiating outward (max 2 hops), not an open room graph. Reuses DungeonMapSvg for rendering
// unchanged, though — that component only cares about rects + connections, not how they were
// arranged, so no new renderer was needed (confirmed 2026-07-04).

export type Rect = { x: number; y: number; width: number; height: number }

const COURTYARD_SIZE = 6
const NAMED_ROOM_SIZE = 5
const GENERIC_ROOM_SIZE = 4
const NAMED_RADIUS = 11
const GENERIC_RADIUS = 19
const GENERIC_ANGLE_OFFSET_DEG = 22

function rectCenteredAt(cx: number, cy: number, size: number): Rect {
  return { x: cx - size / 2, y: cy - size / 2, width: size, height: size }
}

export type KeepLayout = {
  courtyard: Rect
  named: Rect[]
  // Each generic room's parentIndex refers to an index into `named` — the first-hop room it
  // branches off (round-robin assigned by the caller).
  generic: Rect[]
}

// `genericParentIndices[i]` is the index into the named-room array that generic room `i`
// attaches to. All rects are shifted into non-negative coordinate space (DungeonMapSvg assumes
// x/y >= 0, same as dungeonLayout.ts's BSP output already does).
export function computeKeepLayout(namedCount: number, genericParentIndices: number[]): KeepLayout {
  const courtyardRaw = rectCenteredAt(0, 0, COURTYARD_SIZE)

  const namedAngles: number[] = []
  const namedRaw: Rect[] = []
  for (let i = 0; i < namedCount; i++) {
    const angleDeg = -90 + (360 / namedCount) * i
    const angleRad = (angleDeg * Math.PI) / 180
    namedAngles.push(angleDeg)
    namedRaw.push(rectCenteredAt(NAMED_RADIUS * Math.cos(angleRad), NAMED_RADIUS * Math.sin(angleRad), NAMED_ROOM_SIZE))
  }

  // Fan out by how many generics have already been assigned to THIS parent, not by the global
  // index — otherwise two generics sharing a parent can land on the exact same angle (a real
  // overlap bug caught by keepLayout.test.ts: alternating a fixed +/-22 by global index repeats
  // after 2 rooms, so a 3rd/4th room on the same parent collided with the 1st/2nd).
  const countPerParent = new Map<number, number>()
  const genericRaw: Rect[] = genericParentIndices.map((parentIndex) => {
    const siblingIndex = countPerParent.get(parentIndex) ?? 0
    countPerParent.set(parentIndex, siblingIndex + 1)

    const baseAngle = namedAngles[parentIndex] ?? 0
    const fanStep = Math.ceil((siblingIndex + 1) / 2) * GENERIC_ANGLE_OFFSET_DEG
    const offset = siblingIndex % 2 === 0 ? fanStep : -fanStep
    const angleRad = ((baseAngle + offset) * Math.PI) / 180
    return rectCenteredAt(GENERIC_RADIUS * Math.cos(angleRad), GENERIC_RADIUS * Math.sin(angleRad), GENERIC_ROOM_SIZE)
  })

  const all = [courtyardRaw, ...namedRaw, ...genericRaw]
  const minX = Math.min(...all.map((r) => r.x))
  const minY = Math.min(...all.map((r) => r.y))
  const shiftX = -minX + 1
  const shiftY = -minY + 1
  const shift = (r: Rect): Rect => ({ ...r, x: r.x + shiftX, y: r.y + shiftY })

  return {
    courtyard: shift(courtyardRaw),
    named: namedRaw.map(shift),
    generic: genericRaw.map(shift),
  }
}

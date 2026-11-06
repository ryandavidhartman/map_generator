// Rivers on the overland map (punch-list item 1a). A river is a feature of a hex, not a terrain.
// Each hex saves only where its river leaves (Hex.river.exit — the edge it flows out through, or
// null when the river ends on that hex: at the sea, in a Swamp, in a lake). Where rivers come in
// is never saved: it's worked out here from the neighbors' exits, so a river merging into an
// already-revealed hex never changes that hex. These helpers are shared by hex generation
// (generateHex.ts, via the reducer), the overland renderer (HexTile.tsx) and the hex detail
// page.

import { hexId, neighborInDirection, oppositeDirection, type AxialCoord, type HexDirection, HEX_DIRECTIONS } from '../hexgrid/hexMath'

export type RiverData = {
  // The edge the river leaves through, or null if it ends on this hex.
  exit: HexDirection | null
}

// The minimum a hex must expose for the river helpers: the overland map's Hex satisfies it.
export type RiverHexLike = { q: number; r: number; river?: RiverData }

// Directions (from this hex) of the revealed neighbors whose river flows into this hex.
export function riverEntriesFor(coord: AxialCoord, hexes: Record<string, RiverHexLike>): HexDirection[] {
  return HEX_DIRECTIONS.filter((direction) => {
    const neighbor = hexes[hexId(neighborInDirection(coord, direction))]
    return neighbor?.river !== undefined && neighbor.river.exit === oppositeDirection(direction)
  })
}

// Whether the river on `fromId` reaches `targetId` by following exits through revealed hexes.
// Used before letting a new hex's river merge into a revealed neighbor's river: if that river
// already comes back here, merging would make a loop.
export function riverDrainsTo(hexes: Record<string, RiverHexLike>, fromId: string, targetId: string): boolean {
  const visited = new Set<string>()
  let current = hexes[fromId]
  let currentId = fromId
  while (current?.river && current.river.exit !== null) {
    if (visited.has(currentId)) return false
    visited.add(currentId)
    const next = neighborInDirection(current, current.river.exit)
    const nextId = hexId(next)
    if (nextId === targetId) return true
    current = hexes[nextId]
    currentId = nextId
  }
  return false
}

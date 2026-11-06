import { describe, expect, it } from 'vitest'
import { riverDrainsTo, riverEntriesFor, type RiverHexLike } from './rivers'
import { hexId, neighborInDirection, type AxialCoord, type HexDirection } from '../hexgrid/hexMath'

function chain(start: AxialCoord, directions: HexDirection[], endExit: HexDirection | null = null): Record<string, RiverHexLike> {
  const hexes: Record<string, RiverHexLike> = {}
  let at = start
  for (const d of directions) {
    hexes[hexId(at)] = { ...at, river: { exit: d } }
    at = neighborInDirection(at, d)
  }
  hexes[hexId(at)] = { ...at, river: { exit: endExit } }
  return hexes
}

describe('riverEntriesFor', () => {
  it('finds the neighbors whose exits point at the hex', () => {
    const hexes = chain({ q: 0, r: 0 }, [5, 5]) // 0,0 -> south -> south
    const middle = neighborInDirection({ q: 0, r: 0 }, 5)
    expect(riverEntriesFor(middle, hexes)).toEqual([2]) // from the north
    expect(riverEntriesFor({ q: 0, r: 0 }, hexes)).toEqual([])
    const last = neighborInDirection(middle, 5)
    expect(riverEntriesFor(last, hexes)).toEqual([2])
  })

  it('ignores neighbors whose rivers flow elsewhere, and hexes without rivers', () => {
    const hexes: Record<string, RiverHexLike> = {
      '1,0': { q: 1, r: 0, river: { exit: 0 } }, // south-east neighbor, flowing away
      '0,-1': { q: 0, r: -1 }, // north neighbor, dry
    }
    expect(riverEntriesFor({ q: 0, r: 0 }, hexes)).toEqual([])
  })

  it('two inflows are both reported, in direction order', () => {
    const hexes: Record<string, RiverHexLike> = {
      '0,-1': { q: 0, r: -1, river: { exit: 5 } }, // north neighbor exits south -> here
      '1,-1': { q: 1, r: -1, river: { exit: 4 } }, // north-east neighbor exits south-west -> here
    }
    expect(riverEntriesFor({ q: 0, r: 0 }, hexes)).toEqual([1, 2])
  })
})

describe('riverDrainsTo', () => {
  it('follows exits downstream through revealed hexes', () => {
    const hexes = chain({ q: 0, r: 0 }, [5, 0, 1])
    const end = neighborInDirection(neighborInDirection(neighborInDirection({ q: 0, r: 0 }, 5), 0), 1)
    expect(riverDrainsTo(hexes, '0,0', hexId(end))).toBe(true)
    expect(riverDrainsTo(hexes, hexId(end), '0,0')).toBe(false)
  })

  it('stops at an unrevealed hex or a river that ends', () => {
    const hexes = chain({ q: 0, r: 0 }, [5], 3) // ends by exiting north-west into the unknown
    expect(riverDrainsTo(hexes, '0,0', '9,9')).toBe(false)
    const ending = chain({ q: 0, r: 0 }, [5], null)
    expect(riverDrainsTo(ending, '0,0', hexId(neighborInDirection({ q: 0, r: 0 }, 5)))).toBe(true)
  })

  it('survives a loop in bad data without hanging', () => {
    const hexes: Record<string, RiverHexLike> = {
      '0,0': { q: 0, r: 0, river: { exit: 5 } },
      '0,1': { q: 0, r: 1, river: { exit: 2 } },
    }
    expect(riverDrainsTo(hexes, '0,0', '5,5')).toBe(false)
  })
})

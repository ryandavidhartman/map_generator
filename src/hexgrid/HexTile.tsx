import { useEffect, useRef } from 'react'
import type { Hex } from '../state/mapReducer'
import { axialToPixel, edgeMidpoint, hexCornersPointsAttr, hexId, type AxialCoord, type HexDirection, type PixelPoint } from './hexMath'
import { DANGER_COLORS, TERRAIN_COLORS, WATER_FEATURE_COLOR } from './colors'

const UNREVEALED_FILL_REVEALABLE = '#3a3a3a'
const UNREVEALED_FILL_FOG = '#1a1a1a'
const UNREVEALED_STROKE_REVEALABLE = '#9a9a9a'
const UNREVEALED_STROKE_FOG = '#2c2c2c'

// Single click moves the party; double click opens the full-view details page. A single
// click's action is delayed by this long so a second click arriving in time can cancel it
// and fire the double-click action instead, rather than both firing.
const DOUBLE_CLICK_DELAY_MS = 250

export type HexTileProps = {
  coord: AxialCoord
  size: number
  hex?: Hex
  // Directions rivers come in from (worked out by the grid from the neighbors' exits — see
  // engine/rivers.ts), for every revealed hex: a Swamp, lake, Coast or Ocean hex revealed before
  // the river reached it has no river record of its own, but still receives the water. The exit
  // is on the hex itself.
  riverEntries?: HexDirection[]
  isParty: boolean
  isSelected: boolean
  isRevealable: boolean
  onSingleClick: () => void
  onDoubleClick: () => void
}

// A river is a simple blue line from edge to edge: each entry edge runs to the exit edge, or to
// the hex's center when the river ends here (no exit — including a hex with no river record of
// its own that only receives inflows); a spring (no entry) runs from the center out.
function riverLines(center: PixelPoint, size: number, exit: HexDirection | null, entries: HexDirection[]): [PixelPoint, PixelPoint][] {
  const at = (d: HexDirection) => edgeMidpoint(center, size, d)
  const end = exit === null ? center : at(exit)
  if (entries.length === 0) return [[center, end]]
  return entries.map((d) => [at(d), end])
}

export function HexTile({ coord, size, hex, riverEntries = [], isParty, isSelected, isRevealable, onSingleClick, onDoubleClick }: HexTileProps) {
  const pendingClick = useRef<number | null>(null)
  const center = axialToPixel(coord, size)
  const points = hexCornersPointsAttr(center, size * 0.96)
  const clickable = Boolean(hex) || isRevealable

  useEffect(() => {
    return () => {
      if (pendingClick.current !== null) window.clearTimeout(pendingClick.current)
    }
  }, [])

  const fill = hex ? TERRAIN_COLORS[hex.terrain] : isRevealable ? UNREVEALED_FILL_REVEALABLE : UNREVEALED_FILL_FOG
  const stroke = hex
    ? DANGER_COLORS[hex.danger]
    : isRevealable
      ? UNREVEALED_STROKE_REVEALABLE
      : UNREVEALED_STROKE_FOG

  function handleClick() {
    if (pendingClick.current !== null) {
      window.clearTimeout(pendingClick.current)
      pendingClick.current = null
      return
    }
    pendingClick.current = window.setTimeout(() => {
      pendingClick.current = null
      onSingleClick()
    }, DOUBLE_CLICK_DELAY_MS)
  }

  function handleDoubleClick() {
    if (pendingClick.current !== null) {
      window.clearTimeout(pendingClick.current)
      pendingClick.current = null
    }
    onDoubleClick()
  }

  return (
    <g
      onClick={clickable ? handleClick : undefined}
      onDoubleClick={clickable ? handleDoubleClick : undefined}
      style={{ cursor: clickable ? 'pointer' : 'default' }}
      data-hex-clickable={clickable}
      data-hex-id={hexId(coord)}
    >
      <polygon points={points} fill={fill} stroke={isSelected ? '#ffffff' : stroke} strokeWidth={isSelected ? 3 : 2} />
      {hex &&
        (hex.river || riverEntries.length > 0) &&
        riverLines(center, size, hex.river?.exit ?? null, riverEntries).map(([a, b], i) => (
          <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={WATER_FEATURE_COLOR} strokeWidth={size * 0.09} strokeLinecap="round" data-river />
        ))}
      {hex?.lake && <ellipse cx={center.x} cy={center.y + size * 0.3} rx={size * 0.26} ry={size * 0.16} fill={WATER_FEATURE_COLOR} stroke="#1c4f7a" strokeWidth={1} data-lake />}
      {hex?.poi && <circle cx={center.x} cy={center.y} r={size * 0.22} fill="#ffd54a" stroke="#00000088" strokeWidth={1} />}
      {isParty && <circle cx={center.x} cy={center.y} r={size * 0.14} fill="#ffffff" stroke="#000000" strokeWidth={1.5} />}
    </g>
  )
}

import type { Hex } from '../state/mapReducer'
import { axialToPixel, hexCornersPointsAttr, hexId, type AxialCoord } from './hexMath'
import { DANGER_COLORS, TERRAIN_COLORS } from './colors'

const UNREVEALED_FILL_REVEALABLE = '#3a3a3a'
const UNREVEALED_FILL_FOG = '#1a1a1a'
const UNREVEALED_STROKE_REVEALABLE = '#9a9a9a'
const UNREVEALED_STROKE_FOG = '#2c2c2c'

export type HexTileProps = {
  coord: AxialCoord
  size: number
  hex?: Hex
  isParty: boolean
  isSelected: boolean
  isRevealable: boolean
  onClick: () => void
}

export function HexTile({ coord, size, hex, isParty, isSelected, isRevealable, onClick }: HexTileProps) {
  const center = axialToPixel(coord, size)
  const points = hexCornersPointsAttr(center, size * 0.96)
  const clickable = Boolean(hex) || isRevealable

  const fill = hex ? TERRAIN_COLORS[hex.terrain] : isRevealable ? UNREVEALED_FILL_REVEALABLE : UNREVEALED_FILL_FOG
  const stroke = hex
    ? DANGER_COLORS[hex.danger]
    : isRevealable
      ? UNREVEALED_STROKE_REVEALABLE
      : UNREVEALED_STROKE_FOG

  return (
    <g
      onClick={clickable ? onClick : undefined}
      style={{ cursor: clickable ? 'pointer' : 'default' }}
      data-hex-clickable={clickable}
      data-hex-id={hexId(coord)}
    >
      <polygon points={points} fill={fill} stroke={isSelected ? '#ffffff' : stroke} strokeWidth={isSelected ? 3 : 2} />
      {hex?.poi && <circle cx={center.x} cy={center.y} r={size * 0.22} fill="#ffd54a" stroke="#00000088" strokeWidth={1} />}
      {isParty && <circle cx={center.x} cy={center.y} r={size * 0.14} fill="#ffffff" stroke="#000000" strokeWidth={1.5} />}
    </g>
  )
}

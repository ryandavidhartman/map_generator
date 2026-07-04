import { rollDie, type Rng } from './dice'
import {
  settlementTypeForD6,
  settlementTypeSpecFor,
  districtTypeForRoll,
  alignmentForD6,
  districtPoiForD6,
  type SettlementType,
  type DistrictType,
  type Alignment,
} from '../data/settlementTables'
import { generateGridLayout, type GridCell } from './gridLayout'

export type District = {
  id: string
  index: number
  cell: GridCell
  parentDistrictId: string | null
  districtType: DistrictType
  districtTypeRoll: number
  alignment: Alignment
  pointsOfInterest: string[]
  isSeatOfGovernment: boolean
}

export type Settlement = {
  kind: 'settlement'
  settlementType: SettlementType
  districts: District[]
}

// Settlement Type is rolled fresh here — never derived from the originating hex's POI text
// (see the plan's "Two mechanical points" note). District count is the literal dice count for
// the tier (never summed): Village/Town roll d4 per district (so district type can only ever
// land in the first 4 of 8 types), City rolls d6 (reaching Temple District but not
// University/Castle), and only Metropolis rolls d8 (the full range). Preserve this tiering.
export function generateSettlement(rng: Rng = Math.random, overrideSettlementType?: SettlementType): Settlement {
  const spec = overrideSettlementType ? settlementTypeSpecFor(overrideSettlementType) : settlementTypeForD6(rollDie(6, rng))
  const placements = generateGridLayout(spec.diceCount, rng)

  const districts: District[] = placements.map((placement, index) => {
    const districtTypeRoll = rollDie(spec.diceSides, rng)
    const districtType = districtTypeForRoll(districtTypeRoll, spec.diceSides)
    const alignment = alignmentForD6(rollDie(6, rng))
    const poiCount = rollDie(4, rng)
    const pointsOfInterest = Array.from({ length: poiCount }, () => districtPoiForD6(districtType, rollDie(6, rng)))

    return {
      id: `district-${index}`,
      index,
      cell: placement.cell,
      parentDistrictId: placement.parentIndex === null ? null : `district-${placement.parentIndex}`,
      districtType,
      districtTypeRoll,
      alignment,
      pointsOfInterest,
      isSeatOfGovernment: false,
    }
  })

  // The district with the single highest district-type roll is the seat of government
  // (book RAW). First occurrence wins ties.
  let seatIndex = 0
  for (let i = 1; i < districts.length; i++) {
    if (districts[i].districtTypeRoll > districts[seatIndex].districtTypeRoll) seatIndex = i
  }
  if (districts.length > 0) districts[seatIndex] = { ...districts[seatIndex], isSeatOfGovernment: true }

  return { kind: 'settlement', settlementType: spec.type, districts }
}

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
import { buildCityMask, buildRoadEdges, buildVoronoiDistricts, sampleDistrictSites, type Point, type RoadEdge } from './settlementLayout'

export type District = {
  id: string
  index: number
  site: Point
  polygon: Point[]
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
  mask: Point[]
  // District-id pairs for road rendering, mirroring DungeonSite.connections.
  roads: { a: string; b: string; kind: 'main' | 'minor' }[]
}

// Settlement Type is rolled fresh here — never derived from the originating hex's POI text
// (see the plan's "Two mechanical points" note). District count is the literal dice count for
// the tier (never summed): Village/Town roll d4 per district (so district type can only ever
// land in the first 4 of 8 types), City rolls d6 (reaching Temple District but not
// University/Castle), and only Metropolis rolls d8 (the full range). Preserve this tiering.
export function generateSettlement(rng: Rng = Math.random, overrideSettlementType?: SettlementType): Settlement {
  const spec = overrideSettlementType ? settlementTypeSpecFor(overrideSettlementType) : settlementTypeForD6(rollDie(6, rng))

  const mask = buildCityMask(spec.diceCount, rng)
  const sites = sampleDistrictSites(spec.diceCount, mask, rng)
  const polygons = buildVoronoiDistricts(sites, mask)

  const districts: District[] = sites.map((site, index) => {
    const districtTypeRoll = rollDie(spec.diceSides, rng)
    const districtType = districtTypeForRoll(districtTypeRoll, spec.diceSides)
    const alignment = alignmentForD6(rollDie(6, rng))
    const poiCount = rollDie(4, rng)
    const pointsOfInterest = Array.from({ length: poiCount }, () => districtPoiForD6(districtType, rollDie(6, rng)))

    return {
      id: `district-${index}`,
      index,
      site,
      polygon: polygons[index],
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

  const roadEdges: RoadEdge[] = buildRoadEdges(sites, seatIndex)
  const roads = roadEdges.map(({ a, b, kind }) => ({ a: `district-${a}`, b: `district-${b}`, kind }))

  return { kind: 'settlement', settlementType: spec.type, districts, mask, roads }
}

import type { Rng } from './dice'
import { SETTLEMENT_LOCATIONS } from '../data/tables'
import { generateDungeonSite, type DungeonSite } from './generateDungeon'
import { generateSettlement, type Settlement } from './generateSettlement'
import type { PointOfInterest } from './generateHex'

export type GeneratedSite = DungeonSite | Settlement

// Dispatches on the hex's POI location only — settlement/dungeon Type and Size are then
// rolled fresh inside generateSettlement/generateDungeonSite (see their doc comments).
export function generateSiteForHex(poi: PointOfInterest, rng: Rng = Math.random): GeneratedSite {
  if (SETTLEMENT_LOCATIONS.includes(poi.location)) return generateSettlement(rng)
  return generateDungeonSite(rng)
}

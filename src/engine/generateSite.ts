import type { Rng } from './dice'
import { SETTLEMENT_LOCATIONS } from '../data/tables'
import { generateDungeonSite, type DungeonSite } from './generateDungeon'
import { generateSettlement, type Settlement } from './generateSettlement'
import type { TowerSite } from './generateTower'
import type { ShrineSite } from './generateShrine'
import type { RiftSite } from './generateRift'
import type { KeepSite } from './generateKeep'
import type { CampSite } from './generateCamp'
import type { PointOfInterest } from './generateHex'

// TowerSite/ShrineSite/RiftSite/KeepSite/CampSite are part of the union so the type system and UI
// can already handle them, but generateSiteForHex doesn't dispatch to them yet — the full Points
// of Interest table rewrite (routing all 5 new site kinds) is deliberately batched until Tower,
// Shrine, Rift, Keep, and Camp all exist, rather than rewiring this dispatch once per kind.
// See docs/plan-sites-settlements-mongo.md's "Location Generator expansion" section.
export type GeneratedSite = DungeonSite | Settlement | TowerSite | ShrineSite | RiftSite | KeepSite | CampSite

// Dispatches on the hex's POI location only — settlement/dungeon Type and Size are then
// rolled fresh inside generateSettlement/generateDungeonSite (see their doc comments).
export function generateSiteForHex(poi: PointOfInterest, rng: Rng = Math.random): GeneratedSite {
  if (SETTLEMENT_LOCATIONS.includes(poi.location)) return generateSettlement(rng)
  return generateDungeonSite(rng)
}

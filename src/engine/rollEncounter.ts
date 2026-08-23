import { rollDie, type Rng } from './dice'
import { encounterForD100, minPartyLevelForBxUrbanEncounter, type EncounterTableKey, type BxUrbanEncounterTableKey } from '../data/encounterTables'
import { wildernessEncounterChanceForTerrain, encounterPurposeForD8, wildernessCategoryForD100 } from '../data/encounterFrequencyTables'
import type { Terrain } from '../data/tables'
import { rollMonster, type MonsterEntry, type MonsterCategory } from '../data/monsterTables'
import { rollSettlementNpc, type SettlementNpc } from '../data/npcTables'

export function rollEncounter(key: EncounterTableKey, rng: Rng = Math.random): string {
  return encounterForD100(key, rollDie(100, rng))
}

export function rollEncounterPurpose(rng: Rng = Math.random): string {
  return encounterPurposeForD8(rollDie(8, rng))
}

// B/X's wilderness Encounter Frequency check: roll 1d6, and only if it lands in the terrain's
// trigger set does a wandering encounter actually occur (see encounterFrequencyTables.ts).
// This is the "sometimes nothing happens" gate this project's manual EncounterRoller didn't
// have before Phase 4 — it always produced a hit.
export function checkWildernessEncounterFrequency(terrain: Terrain, rng: Rng = Math.random): boolean {
  const roll = rollDie(6, rng)
  return wildernessEncounterChanceForTerrain(terrain).includes(roll)
}

// Round 2, Phase 4: B/X's Terrain Category Summary feeds the EXISTING monsterTables.ts pool
// instead of a second transcribed bestiary — see encounterFrequencyTables.ts's header for why.
// A subset of B/X's 12 categories (Animal/Dragon/Giant/Humanoid/Undead) map directly onto
// monsterTables.ts's own MonsterCategory; Human/Demi-Human and NPC roll a traveler via the
// existing settlement NPC roller instead of a monster (a lone human/demi-human on the road isn't
// a "monster"); the remaining categories (Airborne, Monster, Invertebrates, Water, Special) have
// no clean 1-to-1 category match — B/X's own example rows mix wildly different creature types
// under them (Airborne alone spans everything from Bat to Sphinx to Wyvern) — so they fall back
// to an unthemed rollMonster pick across the whole pool, the same "closest match" latitude the
// book itself grants for terrain mapping.
export type WildernessMonsterResult =
  | { kind: 'monster'; monster: MonsterEntry }
  | { kind: 'traveler'; npc: SettlementNpc }

const DIRECT_CATEGORY_MAP: Partial<Record<ReturnType<typeof wildernessCategoryForD100>, MonsterEntry['category']>> = {
  Animal: 'Animal',
  Dragon: 'Dragon',
  Giant: 'Giant',
  Humanoid: 'Humanoid',
  Undead: 'Undead',
}

// User-reported follow-up (2026-08-23): a 1st-level party's wandering encounter rolled a Ghoul,
// which reads as absurd — this project previously had no party-level state anywhere to gate
// against. B/X's real Wilderness Encounter Level table (1d8 for level 1-3, 1d14 for 4-6, 1d20 for
// 7+) restricts which ROW of each terrain+category grid is reachable — a mechanism this project
// can't reuse directly since it deliberately didn't adopt that grid (see the header comment
// above). Adapted instead as a category exclusion, at the same three level thresholds the book
// itself gives, reusing rollMonster's existing excludeCategories mechanism (the same one that
// keeps Boss Monster away from giant ferrets) — Dragon/Undead/Demon are excluded below level 4,
// Dragon/Demon below level 7, nothing excluded at 7+ ("exposed to the full table, rare and
// legendary entries included," per the book's own framing of that tier).
function excludedCategoriesForPartyLevel(partyLevel: number): MonsterCategory[] {
  if (partyLevel <= 3) return ['Dragon', 'Undead', 'Demon']
  if (partyLevel <= 6) return ['Dragon', 'Demon']
  return []
}

export function rollWildernessMonster(terrain: Terrain, partyLevel: number, rng: Rng = Math.random): WildernessMonsterResult {
  const category = wildernessCategoryForD100(terrain, rollDie(100, rng))
  if (category === 'Human/Demi-Human' || category === 'NPC') {
    return { kind: 'traveler', npc: rollSettlementNpc(rng) }
  }
  const theme = DIRECT_CATEGORY_MAP[category]
  const excludeCategories = excludedCategoriesForPartyLevel(partyLevel)
  return { kind: 'monster', monster: rollMonster(rng, { theme, excludeCategories }) }
}

// Urban Encounter Level (Appendix C): a handful of B/X Urban table rows are "out of place" below
// a party-level threshold (Wererat/Weretiger/Werewolf need 3+; Demon/Devil/Ghost/Night
// Hag/Rakshasa/Shadow/Spectre/Wight/Will-O-Wisp/Wraith need 5+; Vampire/Lich need 8+) — see
// encounterTables.ts's minPartyLevelForBxUrbanEncounter for the row data. The book offers the DM
// three options for an out-of-place roll (reroll / treat as a rumor / let it stand as a
// dangerous surprise) — implemented here as a bounded reroll, since a single-click roller can't
// ask the GM mid-roll; the ~11-16% of rows gated at all means this essentially always resolves
// well within the attempt cap, but the cap still exists so a pathological rng can't hang.
const MAX_REROLL_ATTEMPTS = 20

export function rollBxUrbanEncounter(key: BxUrbanEncounterTableKey, partyLevel: number, rng: Rng = Math.random): string {
  let roll = rollDie(100, rng)
  for (let attempt = 1; attempt < MAX_REROLL_ATTEMPTS; attempt++) {
    const minLevel = minPartyLevelForBxUrbanEncounter(key, roll)
    if (!minLevel || partyLevel >= minLevel) break
    roll = rollDie(100, rng)
  }
  return encounterForD100(key, roll)
}

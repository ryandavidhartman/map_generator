// Monster and NPC-type names, transcribed from the user's own B/X retro-clone compilation:
// ~/dev/source/b_x/publication/monsters/combined-monsters.md ("B/X Book of Monsters" —
// merged/deduplicated from the 1981 Basic and Expert Sets). Real names organized by the
// source document's own categories, but deliberately NAME + CATEGORY ONLY — no stat blocks
// (AC/HD/attacks/etc.) are transcribed here. The user confirmed (2026-07-04) that real combat
// stats are a future MongoDB integration (see docs/plan-sites-settlements-mongo.md's "Dungeon
// monster/NPC population" section); this table exists so a generated dungeon room can show a
// GM a concrete, book-sourced creature/NPC name today, on top of the existing book-RAW
// descriptor rolls (e.g. "Mighty Brute"), pending that later stat-block wiring.
//
// Trailing asterisks in the source (e.g. "Gargoyle*") mark spellcasters/magic-resistant
// creatures per the book's own key — stripped here since they're not part of the display name.
// "Men" in the source NPC section is itself an umbrella entry with five named sub-types
// (Brigand, Buccaneer/Pirate, Dervish, Merchant, Nomad) — expanded individually below rather
// than kept as one generic "Men" entry. "NPC Parties" (a party-generation ruleset, not a
// single NPC) and "Devils" (narrative-only in the source, no individual entries) are excluded.
//
// `mundane: true` marks ordinary real-world creatures (Cattle, Horse, Bull, etc.) — curated by
// hand, not derived from any source data (no stats were transcribed to derive it from). Used to
// keep them out of the Boss Monster pool (a dungeon's climactic threat shouldn't be a cow) while
// leaving them available for Solo Monster/Monster Mob, where "a pack of wolves" or "a startled
// horse" are perfectly normal low-stakes encounters. "Giant"/"Great"-qualified variants (Giant
// Beaver, Cat, Great, etc.) are NOT marked mundane — they're legitimate escalated B/X monster
// entries, not farm animals.

import type { Rng } from '../engine/dice'
import type { SiteType } from './dungeonTables'

export type MonsterCategory =
  | 'Animal'
  | 'Construct'
  | 'Demon'
  | 'Dragon'
  | 'Elemental'
  | 'Humanoid'
  | 'Giant'
  | 'Insect'
  | 'Lost World'
  | 'Lycanthrope'
  | 'Monstrous'
  | 'Sylvan or Faerie Creature'
  | 'Undead'

export type MonsterEntry = { name: string; category: MonsterCategory; mundane?: boolean }

// Kept as {name, category} (not a flat string list) so category can drive both mundane
// filtering (Boss Monster) and site-type theming (see SITE_TYPE_CATEGORY_WEIGHTS below).
export const MONSTERS: MonsterEntry[] = [
  // Animals — ordinary real-world creatures marked mundane (excluded from Boss Monster);
  // "Giant"/"Great"-qualified variants are legitimate escalated monsters, left eligible.
  { name: 'Ape', category: 'Animal', mundane: true },
  { name: 'Baboon', category: 'Animal', mundane: true },
  { name: 'Baboon, Rock', category: 'Animal', mundane: true },
  { name: 'Badger', category: 'Animal', mundane: true },
  { name: 'Barracuda', category: 'Animal', mundane: true },
  { name: 'Bat', category: 'Animal', mundane: true },
  { name: 'Bear', category: 'Animal', mundane: true },
  { name: 'Beaver, Giant', category: 'Animal' },
  { name: 'Boar', category: 'Animal', mundane: true },
  { name: 'Buffalo', category: 'Animal', mundane: true },
  { name: 'Bull', category: 'Animal', mundane: true },
  { name: 'Camel', category: 'Animal', mundane: true },
  { name: 'Cat, Great', category: 'Animal', mundane: true },
  { name: 'Cattle', category: 'Animal', mundane: true },
  { name: 'Crab, Giant', category: 'Animal' },
  { name: 'Crocodile', category: 'Animal', mundane: true },
  { name: 'Elephant', category: 'Animal', mundane: true },
  { name: 'Ferret, Giant', category: 'Animal' },
  { name: 'Fish, Giant', category: 'Animal' },
  { name: 'Hawk', category: 'Animal', mundane: true },
  { name: 'Herd Animals', category: 'Animal', mundane: true },
  { name: 'Horse', category: 'Animal', mundane: true },
  { name: 'Leech, Giant', category: 'Animal' },
  { name: 'Lizards, Giant', category: 'Animal' },
  { name: 'Mule', category: 'Animal', mundane: true },
  { name: 'Octopus, Giant', category: 'Animal' },
  { name: 'Rat', category: 'Animal', mundane: true },
  { name: 'Rhinoceros', category: 'Animal', mundane: true },
  { name: 'Shark', category: 'Animal', mundane: true },
  { name: 'Shrew, Giant', category: 'Animal' },
  { name: 'Snake', category: 'Animal', mundane: true },
  { name: 'Squid, Giant', category: 'Animal' },
  { name: 'Toad, Giant', category: 'Animal' },
  { name: 'Weasel, Giant', category: 'Animal' },
  { name: 'Whale', category: 'Animal', mundane: true },
  { name: 'Wolf', category: 'Animal', mundane: true },

  // Constructs
  { name: 'Animated Armor', category: 'Construct' },
  { name: 'Gargoyle', category: 'Construct' },
  { name: 'Golem', category: 'Construct' },
  { name: 'Living Statue', category: 'Construct' },

  // Demons
  { name: 'Demogorgon', category: 'Demon' },

  // Dragons
  { name: 'Dragon', category: 'Dragon' },
  { name: 'Dragon Turtle', category: 'Dragon' },
  { name: 'Sea Dragons', category: 'Dragon' },
  { name: 'Wyvern', category: 'Dragon' },

  // Elementals
  { name: 'Aerial Servant', category: 'Elemental' },
  { name: 'Djinni, Lesser', category: 'Elemental' },
  { name: 'Efreeti, Lesser', category: 'Elemental' },
  { name: 'Elemental', category: 'Elemental' },
  { name: 'Salamander', category: 'Elemental' },

  // Humanoids
  { name: 'Bugbear', category: 'Humanoid' },
  { name: 'Gnoll', category: 'Humanoid' },
  { name: 'Goblin', category: 'Humanoid' },
  { name: 'Hobgoblin', category: 'Humanoid' },
  { name: 'Kobold', category: 'Humanoid' },
  { name: 'Lizard Man', category: 'Humanoid' },
  { name: 'Orc', category: 'Humanoid' },
  { name: 'Troglodyte', category: 'Humanoid' },

  // Giants
  { name: 'Cyclops', category: 'Giant' },
  { name: 'Giant', category: 'Giant' },
  { name: 'Ogre', category: 'Giant' },
  { name: 'Troll', category: 'Giant' },

  // Insects
  { name: 'Ant, Driver', category: 'Insect' },
  { name: 'Ant, Giant', category: 'Insect' },
  { name: 'Bee, Killer', category: 'Insect' },
  { name: 'Beetle, Giant', category: 'Insect' },
  { name: 'Centipede, Giant', category: 'Insect' },
  { name: 'Fly, Robber', category: 'Insect' },
  { name: 'Insect Swarms', category: 'Insect' },
  { name: 'Locust, Cave', category: 'Insect' },
  { name: 'Scorpion, Giant', category: 'Insect' },
  { name: 'Spider, Giant', category: 'Insect' },

  // Lost World
  { name: 'Ape, White', category: 'Lost World' },
  { name: 'Axe Beak', category: 'Lost World' },
  { name: 'Baluchitherium', category: 'Lost World' },
  { name: 'Bear, Cave', category: 'Lost World' },
  { name: 'Boar, Giant', category: 'Lost World' },
  { name: 'Mastodon', category: 'Lost World' },
  { name: 'Neanderthal (Caveman)', category: 'Lost World' },
  { name: 'Pterodactyl', category: 'Lost World' },
  { name: 'Rhinoceros, Wooly', category: 'Lost World' },
  { name: 'Sabre-Tooth Tiger', category: 'Lost World' },
  { name: 'Stegosaurus', category: 'Lost World' },
  { name: 'Titanothere', category: 'Lost World' },
  { name: 'Triceratops', category: 'Lost World' },
  { name: 'Tyrannosaurus Rex', category: 'Lost World' },

  // Lycanthropes
  { name: 'Devil Swine', category: 'Lycanthrope' },
  { name: 'Werebear', category: 'Lycanthrope' },
  { name: 'Wereboar', category: 'Lycanthrope' },
  { name: 'Wererat', category: 'Lycanthrope' },
  { name: 'Weretiger', category: 'Lycanthrope' },
  { name: 'Werewolf', category: 'Lycanthrope' },

  // Monstrous
  { name: 'Ankheg', category: 'Monstrous' },
  { name: 'Basilisk', category: 'Monstrous' },
  { name: 'Beholder', category: 'Monstrous' },
  { name: 'Black Pudding', category: 'Monstrous' },
  { name: 'Blink Dog', category: 'Monstrous' },
  { name: 'Bulette', category: 'Monstrous' },
  { name: 'Caecilia', category: 'Monstrous' },
  { name: 'Carrion Crawler', category: 'Monstrous' },
  { name: 'Catoblepas', category: 'Monstrous' },
  { name: 'Chimera', category: 'Monstrous' },
  { name: 'Cockatrice', category: 'Monstrous' },
  { name: 'Displacer Beast', category: 'Monstrous' },
  { name: 'Doppelganger', category: 'Monstrous' },
  { name: 'Gelatinous Cube', category: 'Monstrous' },
  { name: 'Gorgon', category: 'Monstrous' },
  { name: 'Gray Ooze', category: 'Monstrous' },
  { name: 'Green Slime', category: 'Monstrous' },
  { name: 'Griffon', category: 'Monstrous' },
  { name: 'Harpy', category: 'Monstrous' },
  { name: 'Hellhound', category: 'Monstrous' },
  { name: 'Hippogriff', category: 'Monstrous' },
  { name: 'Hydra', category: 'Monstrous' },
  { name: 'Invisible Stalker', category: 'Monstrous' },
  { name: 'Manticore', category: 'Monstrous' },
  { name: 'Medusa', category: 'Monstrous' },
  { name: 'Mermen', category: 'Monstrous' },
  { name: 'Minotaur', category: 'Monstrous' },
  { name: 'Ochre Jelly', category: 'Monstrous' },
  { name: 'Owl Bear', category: 'Monstrous' },
  { name: 'Pegasus', category: 'Monstrous' },
  { name: 'Purple Worm', category: 'Monstrous' },
  { name: 'Roc', category: 'Monstrous' },
  { name: 'Rust Monster', category: 'Monstrous' },
  { name: 'Sea Serpent (Lesser)', category: 'Monstrous' },
  { name: 'Shadow', category: 'Monstrous' },
  { name: 'Shrieker', category: 'Monstrous' },
  { name: 'Stirge', category: 'Monstrous' },
  { name: 'Termite, Water', category: 'Monstrous' },
  { name: 'Thoul', category: 'Monstrous' },
  { name: 'Yellow Mold', category: 'Monstrous' },

  // Sylvan or Faerie Creatures
  { name: 'Brownie', category: 'Sylvan or Faerie Creature' },
  { name: 'Centaur', category: 'Sylvan or Faerie Creature' },
  { name: 'Dryad', category: 'Sylvan or Faerie Creature' },
  { name: 'Nixies', category: 'Sylvan or Faerie Creature' },
  { name: 'Pixie', category: 'Sylvan or Faerie Creature' },
  { name: 'Sprite', category: 'Sylvan or Faerie Creature' },
  { name: 'Treant', category: 'Sylvan or Faerie Creature' },
  { name: 'Unicorn', category: 'Sylvan or Faerie Creature' },

  // Undead
  { name: 'Ghoul', category: 'Undead' },
  { name: 'Mummy', category: 'Undead' },
  { name: 'Skeleton', category: 'Undead' },
  { name: 'Spectre', category: 'Undead' },
  { name: 'Vampire', category: 'Undead' },
  { name: 'Wight', category: 'Undead' },
  { name: 'Wraith', category: 'Undead' },
  { name: 'Zombie', category: 'Undead' },
]

// Thematic bias, not exclusion: a category not listed for a site type still gets a baseline
// weight (DEFAULT_CATEGORY_WEIGHT) rather than zero, so an occasional off-theme surprise (a
// stray Dragon anywhere, say) stays possible — only the listed categories are boosted relative
// to that baseline. Curated by hand (subjective judgment call, not derived from source data):
// Cave leans natural/wild, Tomb leans undead, Deep tunnels leans subterranean-labyrinth,
// Ruins leans fallen-civilization.
const DEFAULT_CATEGORY_WEIGHT = 1

const SITE_TYPE_CATEGORY_WEIGHTS: Record<SiteType, Partial<Record<MonsterCategory, number>>> = {
  Cave: { Animal: 5, 'Lost World': 4, Insect: 3, Monstrous: 2, Lycanthrope: 2 },
  Tomb: { Undead: 6, Construct: 2 },
  'Deep tunnels': { Insect: 3, Monstrous: 3, Humanoid: 2, Giant: 2, Elemental: 2 },
  Ruins: { Construct: 3, Humanoid: 3, Undead: 2, 'Sylvan or Faerie Creature': 2 },
}

function pickWeightedCategory(categories: MonsterCategory[], weights: Partial<Record<MonsterCategory, number>>, rng: Rng): MonsterCategory {
  const weighted = categories.map((category) => ({ category, weight: weights[category] ?? DEFAULT_CATEGORY_WEIGHT }))
  const total = weighted.reduce((sum, w) => sum + w.weight, 0)
  let roll = rng() * total
  for (const { category, weight } of weighted) {
    if (roll < weight) return category
    roll -= weight
  }
  return weighted[weighted.length - 1].category // float-rounding fallback, never hit in practice
}

export type RollMonsterOptions = {
  // Excludes ordinary real-world creatures — use for Boss Monster, not Solo Monster/Monster Mob.
  excludeMundane?: boolean
  // When given, biases category selection per SITE_TYPE_CATEGORY_WEIGHTS instead of picking
  // uniformly across the whole (possibly mundane-filtered) pool.
  siteType?: SiteType
}

export function rollMonster(rng: Rng = Math.random, options: RollMonsterOptions = {}): MonsterEntry {
  const pool = options.excludeMundane ? MONSTERS.filter((m) => !m.mundane) : MONSTERS

  if (!options.siteType) {
    return pool[Math.floor(rng() * pool.length)]
  }

  const categories = [...new Set(pool.map((m) => m.category))]
  const category = pickWeightedCategory(categories, SITE_TYPE_CATEGORY_WEIGHTS[options.siteType], rng)
  const entriesInCategory = pool.filter((m) => m.category === category)
  return entriesInCategory[Math.floor(rng() * entriesInCategory.length)]
}

// NPC archetypes, from the same source document's own "NPCs" category — used for the dungeon
// "NPC" room type (a captive/hiding/wounded person, per the existing book-RAW descriptor
// table), not personal names. "Men"'s five named sub-types are listed individually.
export const NPC_TYPES: string[] = [
  'Acolyte',
  'Bandit',
  'Berserker',
  'Dwarf',
  'Elf',
  'Gnome',
  'Halfling',
  'Medium',
  'Brigand',
  'Buccaneer / Pirate',
  'Dervish',
  'Merchant',
  'Nomad',
  'Noble',
  'Normal Human',
  'Trader',
  'Veteran',
]

export function rollNpcType(rng: Rng = Math.random): string {
  return NPC_TYPES[Math.floor(rng() * NPC_TYPES.length)]
}

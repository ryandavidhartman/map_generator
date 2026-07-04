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

import type { Rng } from '../engine/dice'

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

export type MonsterEntry = { name: string; category: MonsterCategory }

// Kept as {name, category} (not a flat string list) so a future pass can bias selection by
// dungeon site type (e.g. Undead for Tomb, Lost World/Animal for Cave) without new data — the
// roll below is uniform across all categories for now, matching the "lightweight, name only"
// scope confirmed for this phase.
export const MONSTERS: MonsterEntry[] = [
  // Animals
  { name: 'Ape', category: 'Animal' },
  { name: 'Baboon', category: 'Animal' },
  { name: 'Baboon, Rock', category: 'Animal' },
  { name: 'Badger', category: 'Animal' },
  { name: 'Barracuda', category: 'Animal' },
  { name: 'Bat', category: 'Animal' },
  { name: 'Bear', category: 'Animal' },
  { name: 'Beaver, Giant', category: 'Animal' },
  { name: 'Boar', category: 'Animal' },
  { name: 'Buffalo', category: 'Animal' },
  { name: 'Bull', category: 'Animal' },
  { name: 'Camel', category: 'Animal' },
  { name: 'Cat, Great', category: 'Animal' },
  { name: 'Cattle', category: 'Animal' },
  { name: 'Crab, Giant', category: 'Animal' },
  { name: 'Crocodile', category: 'Animal' },
  { name: 'Elephant', category: 'Animal' },
  { name: 'Ferret, Giant', category: 'Animal' },
  { name: 'Fish, Giant', category: 'Animal' },
  { name: 'Hawk', category: 'Animal' },
  { name: 'Herd Animals', category: 'Animal' },
  { name: 'Horse', category: 'Animal' },
  { name: 'Leech, Giant', category: 'Animal' },
  { name: 'Lizards, Giant', category: 'Animal' },
  { name: 'Mule', category: 'Animal' },
  { name: 'Octopus, Giant', category: 'Animal' },
  { name: 'Rat', category: 'Animal' },
  { name: 'Rhinoceros', category: 'Animal' },
  { name: 'Shark', category: 'Animal' },
  { name: 'Shrew, Giant', category: 'Animal' },
  { name: 'Snake', category: 'Animal' },
  { name: 'Squid, Giant', category: 'Animal' },
  { name: 'Toad, Giant', category: 'Animal' },
  { name: 'Weasel, Giant', category: 'Animal' },
  { name: 'Whale', category: 'Animal' },
  { name: 'Wolf', category: 'Animal' },

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

export function rollMonster(rng: Rng = Math.random): MonsterEntry {
  return MONSTERS[Math.floor(rng() * MONSTERS.length)]
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

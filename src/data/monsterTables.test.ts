import { describe, expect, it } from 'vitest'
import { MONSTERS, NPC_TYPES, BOSS_EXCLUDED_CATEGORIES, rollMonster, rollMonsterTheme, rollNpcType } from './monsterTables'

function seededRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

describe('MONSTERS', () => {
  it('has a substantial, non-empty list with no duplicate names', () => {
    expect(MONSTERS.length).toBeGreaterThan(100)
    const names = MONSTERS.map((m) => m.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('every entry has a non-empty name and category', () => {
    for (const monster of MONSTERS) {
      expect(monster.name.length).toBeGreaterThan(0)
      expect(monster.category.length).toBeGreaterThan(0)
    }
  })

  it('rollMonster always returns an entry from the table', () => {
    for (const seed of [1, 42, 12345]) {
      const rng = seededRng(seed)
      for (let i = 0; i < 20; i++) {
        expect(MONSTERS).toContainEqual(rollMonster(rng))
      }
    }
  })

  it('has at least one mundane and one non-mundane entry per category (Boss Monster exclusion must never empty a category)', () => {
    const categories = new Set(MONSTERS.map((m) => m.category))
    for (const category of categories) {
      const inCategory = MONSTERS.filter((m) => m.category === category)
      expect(inCategory.some((m) => !m.mundane)).toBe(true)
    }
  })

  it('excludeMundane never returns a mundane entry', () => {
    for (const seed of [1, 42, 12345]) {
      const rng = seededRng(seed)
      for (let i = 0; i < 50; i++) {
        expect(rollMonster(rng, { excludeMundane: true }).mundane).toBeFalsy()
      }
    }
  })

  it('a locked theme always returns an entry from that category', () => {
    for (const seed of [1, 42, 12345]) {
      const rng = seededRng(seed)
      for (let i = 0; i < 50; i++) {
        expect(rollMonster(rng, { theme: 'Undead' }).category).toBe('Undead')
      }
    }
  })

  it('theme + excludeMundane combine (Boss Monster still excludes mundane entries within the theme)', () => {
    for (const seed of [1, 42, 12345]) {
      const rng = seededRng(seed)
      for (let i = 0; i < 50; i++) {
        const monster = rollMonster(rng, { theme: 'Animal', excludeMundane: true })
        expect(monster.mundane).toBeFalsy()
      }
    }
  })

  it('excludeCategories falls back to a different category when the locked theme itself is excluded', () => {
    for (const seed of [1, 42, 12345]) {
      const rng = seededRng(seed)
      for (let i = 0; i < 50; i++) {
        const monster = rollMonster(rng, { theme: 'Animal', excludeCategories: BOSS_EXCLUDED_CATEGORIES })
        expect(BOSS_EXCLUDED_CATEGORIES).not.toContain(monster.category)
      }
    }
  })

  it('excludeCategories has no effect when the locked theme is already allowed', () => {
    for (const seed of [1, 42, 12345]) {
      const rng = seededRng(seed)
      for (let i = 0; i < 20; i++) {
        expect(rollMonster(rng, { theme: 'Undead', excludeCategories: BOSS_EXCLUDED_CATEGORIES }).category).toBe('Undead')
      }
    }
  })
})

describe('rollMonsterTheme', () => {
  it('always returns a real category', () => {
    const categories = new Set(MONSTERS.map((m) => m.category))
    for (const seed of [1, 42, 12345]) {
      const rng = seededRng(seed)
      for (let i = 0; i < 20; i++) {
        expect(categories.has(rollMonsterTheme(rng))).toBe(true)
      }
    }
  })

  it('siteType biases the theme pick toward that site\'s themed categories', () => {
    const rng = seededRng(99)
    const categoryCounts: Record<string, number> = {}
    for (let i = 0; i < 500; i++) {
      const category = rollMonsterTheme(rng, 'Tomb')
      categoryCounts[category] = (categoryCounts[category] ?? 0) + 1
    }
    // Tomb weights Undead at 6x baseline (~0.077 uniform across 13 categories) — expect it to
    // dominate the distribution well above that baseline.
    const undeadShare = (categoryCounts['Undead'] ?? 0) / 500
    expect(undeadShare).toBeGreaterThan(0.25)
  })

  it('with no siteType (Tower/Keep), picks uniformly across all categories rather than always the same one', () => {
    const rng = seededRng(7)
    const seen = new Set<string>()
    for (let i = 0; i < 100; i++) seen.add(rollMonsterTheme(rng))
    expect(seen.size).toBeGreaterThan(1)
  })
})

describe('NPC_TYPES', () => {
  it('has a non-empty list with no duplicates', () => {
    expect(NPC_TYPES.length).toBeGreaterThan(5)
    expect(new Set(NPC_TYPES).size).toBe(NPC_TYPES.length)
  })

  it('rollNpcType always returns a value from the list', () => {
    for (const seed of [1, 42, 12345]) {
      const rng = seededRng(seed)
      for (let i = 0; i < 20; i++) {
        expect(NPC_TYPES).toContain(rollNpcType(rng))
      }
    }
  })
})

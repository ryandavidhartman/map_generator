import { describe, expect, it } from 'vitest'
import { MONSTERS, NPC_TYPES, rollMonster, rollNpcType } from './monsterTables'

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

  it('siteType biases category selection toward that site\'s themed categories', () => {
    const rng = seededRng(99)
    const categoryCounts: Record<string, number> = {}
    for (let i = 0; i < 500; i++) {
      const { category } = rollMonster(rng, { siteType: 'Tomb' })
      categoryCounts[category] = (categoryCounts[category] ?? 0) + 1
    }
    // Tomb weights Undead at 6x baseline — expect it to dominate the distribution.
    const undeadShare = (categoryCounts['Undead'] ?? 0) / 500
    expect(undeadShare).toBeGreaterThan(0.3)
  })

  it('siteType + excludeMundane combine (Boss Monster in a Tomb still excludes mundane entries)', () => {
    for (const seed of [1, 42, 12345]) {
      const rng = seededRng(seed)
      for (let i = 0; i < 50; i++) {
        expect(rollMonster(rng, { siteType: 'Cave', excludeMundane: true }).mundane).toBeFalsy()
      }
    }
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

// Town-map rivers (punch-list item 1b): riverside blocks stay whole, and the U-bend holds up on
// every outline shape and street pattern. Split from settlementRiver.test.ts so it runs in
// parallel with the other sweeps.
import { describe, expect, it } from 'vitest'
import { computeSettlementPlan } from './settlementPlan'
import type { SettlementType } from '../data/settlementTables'
import { SCENARIOS, TYPES, checkRiverTown, inputFor, signedArea } from './settlementRiverChecks'

describe('riverside blocks stay whole: no comb or sliver blocks', () => {
  // Block counts of the pre-1b half-plane river, per [no water, straight river], captured from
  // the unmodified code for seeds 1-12 (the old straight band gave at most 1.25× the no-water
  // count). The curved cuts must stay in the same range.
  const OLD: Record<string, [number, number]> = {
  'Village|1': [24, 29],
  'Village|2': [24, 28],
  'Village|3': [24, 26],
  'Village|4': [24, 27],
  'Village|5': [24, 30],
  'Village|6': [24, 28],
  'Village|7': [24, 30],
  'Village|8': [24, 29],
  'Village|9': [24, 28],
  'Village|10': [24, 25],
  'Village|11': [24, 25],
  'Village|12': [24, 27],
  'Town|1': [40, 45],
  'Town|2': [40, 44],
  'Town|3': [40, 44],
  'Town|4': [40, 45],
  'Town|5': [40, 44],
  'Town|6': [40, 44],
  'Town|7': [40, 44],
  'Town|8': [40, 46],
  'Town|9': [42, 46],
  'Town|10': [40, 46],
  'Town|11': [40, 44],
  'Town|12': [40, 45],
  'City|1': [70, 74],
  'City|2': [69, 73],
  'City|3': [64, 66],
  'City|4': [75, 78],
  'City|5': [70, 76],
  'City|6': [70, 75],
  'City|7': [70, 76],
  'City|8': [69, 72],
  'City|9': [69, 75],
  'City|10': [70, 74],
  'City|11': [73, 78],
  'City|12': [68, 70],
  'Metropolis|1': [103, 108],
  'Metropolis|2': [110, 114],
  'Metropolis|3': [110, 113],
  'Metropolis|4': [110, 114],
  'Metropolis|5': [110, 115],
  'Metropolis|6': [105, 111],
  'Metropolis|7': [110, 117],
  'Metropolis|8': [110, 114],
  'Metropolis|9': [110, 112],
  'Metropolis|10': [105, 110],
  'Metropolis|11': [105, 111],
  'Metropolis|12': [110, 116],
  }

  it('block counts stay within the old half-plane river\'s range for every scenario', () => {
    for (const [keyOld, [none, oldRiver]] of Object.entries(OLD)) {
      const [type, seed] = keyOld.split('|')
      for (const [label, water] of Object.entries(SCENARIOS)) {
        const plan = computeSettlementPlan({ ...inputFor(Number(seed), type as SettlementType), water })
        expect(plan.blocks.length, `${label} ${keyOld}`).toBeLessThanOrEqual(Math.max(oldRiver + 4, Math.round(none * 1.3)))
        // Slivers: blocks are at least the plan's own minimum area, and small blocks stay rare.
        const areas = plan.blocks.map((b) => Math.abs(signedArea(b.cell)))
        expect(Math.min(...areas)).toBeGreaterThan(2)
        expect(areas.filter((a) => a < 8).length, `${label} ${keyOld} small blocks`).toBeLessThanOrEqual(Math.ceil(plan.blocks.length * 0.2))
      }
    }
  }, 120000)
})

describe('the U-bend on every shape', () => {
  it('the U-bend holds up on every outline shape and street pattern', () => {
    const seen = new Set<string>()
    for (const type of TYPES) {
      for (let seed = 1; seed <= 24; seed++) {
        const plan = computeSettlementPlan({ ...inputFor(seed, type), water: SCENARIOS.bend60 })
        seen.add(`${plan.shape}/${plan.pattern}`)
        checkRiverTown(plan, `bend60 ${type} ${seed}`)
      }
    }
    expect([...seen].sort()).toEqual([
      'angular/grid', 'angular/gridCore', 'angular/oldTown', 'angular/organic',
      'elongated/grid', 'elongated/gridCore', 'elongated/oldTown', 'elongated/organic',
      'round/grid', 'round/gridCore', 'round/oldTown', 'round/organic',
    ])
  }, 600000)
})

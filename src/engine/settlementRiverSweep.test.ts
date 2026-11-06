// Town-map rivers (punch-list item 1b): a seeded sweep over many seeds, every size and every
// river scenario. Split from settlementRiver.test.ts so it runs in parallel with the other sweeps.
import { describe, it } from 'vitest'
import { computeSettlementPlan } from './settlementPlan'
import { SCENARIOS, TYPES, assertFinite, checkRiverTown, inputFor } from './settlementRiverChecks'

describe('seeded sweep: many seeds, every size, every river scenario', () => {
  it('never throws, has no NaN, keeps every district and a reachable seat', () => {
    for (const type of TYPES) {
      for (let seed = 4; seed <= 11; seed++) {
        for (const [label, water] of Object.entries(SCENARIOS)) {
          const plan = computeSettlementPlan({ ...inputFor(seed, type), water })
          assertFinite(plan)
          checkRiverTown(plan, `${label} ${type} ${seed}`)
        }
      }
    }
  }, 600000)
})

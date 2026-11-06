// Plan-level tests for town-map rivers that follow their hex edges (punch-list item 1b,
// 2026-11-04): structural invariants of computeSettlementPlan's output for every river scenario,
// and the degenerate cases 1c will build on. The slow sweeps are in settlementRiverBlocks.test.ts
// and settlementRiverSweep.test.ts (separate files so Vitest runs them in parallel); the shared
// checks are in settlementRiverChecks.ts. Seeded + structural, per CLAUDE.md "Don't reintroduce" #5.
import { describe, expect, it } from 'vitest'
import { computeSettlementPlan, waterForMapHex, type Block } from './settlementPlan'
import { distanceToPolylines, nearestOnPolylines } from './riverCourse'
import { pickWorldSeedForStart } from './worldFormula'
import { directionAngle, hexId, neighborInDirection } from '../hexgrid/hexMath'
import { SCENARIOS, TYPES, checkRiverTown, distanceFn, inputFor, isConvex, pointInConvex, riverOf, seededRng } from './settlementRiverChecks'

describe('river towns: structural invariants for every scenario', () => {
  for (const [label, water] of Object.entries(SCENARIOS)) {
    it(`${label} (${water.entries.join(',') || 'no entry'} → ${water.exit ?? 'ends'})`, () => {
      for (const type of TYPES) {
        for (const seed of [1, 2, 3]) {
          const plan = computeSettlementPlan({ ...inputFor(seed, type), water })
          checkRiverTown(plan, `${label} ${type} ${seed}`)
        }
      }
    }, 60000)
  }

  it('the course kind and edges come through to the plan', () => {
    const plans = Object.fromEntries(Object.entries(SCENARIOS).map(([label, water]) => [label, riverOf(computeSettlementPlan({ ...inputFor(2, 'City'), water }))]))
    expect(plans.straight.course).toBe('through')
    expect(plans.straight.entries).toEqual([2])
    expect(plans.straight.exit).toBe(5)
    expect(plans.straight.angle).toBeCloseTo(directionAngle(5), 9)
    expect(plans.spring.course).toBe('spring')
    expect(plans.spring.arms).toHaveLength(1)
    expect(plans.ending.course).toBe('ending')
    expect(plans.ending.angle).toBeCloseTo(directionAngle(2) + Math.PI, 9)
    // Degenerate cases (1c material): several entries → one arm each; a dead-end spring gets a
    // seed-picked exit; entry = exit drops the entry.
    expect(plans.twoEntries.arms).toHaveLength(2)
    expect(plans.twoEntriesEnding.arms).toHaveLength(2)
    expect(plans.twoEntriesEnding.course).toBe('ending')
    expect(plans.deadEndSpring.course).toBe('spring')
    expect(plans.deadEndSpring.exit).not.toBeNull()
    expect(plans.sameEdge.course).toBe('spring')
    expect(plans.sameEdge.entries).toEqual([])
  })

  it('a dead-end spring picks its edge from the seed: stable per town, varied across towns', () => {
    const exits = new Set<number>()
    for (let seed = 1; seed <= 12; seed++) {
      const input = { ...inputFor(seed, 'Town'), water: SCENARIOS.deadEndSpring }
      const exit = riverOf(computeSettlementPlan(input)).exit!
      expect(riverOf(computeSettlementPlan(input)).exit).toBe(exit)
      exits.add(exit)
    }
    expect(exits.size).toBeGreaterThanOrEqual(3)
  })

  it('bridges: a through river gets 1 (Village/Town) or 2 (City/Metropolis), springs and ending rivers 1', () => {
    for (const type of TYPES) {
      for (const seed of [1, 2, 3]) {
        const big = type === 'City' || type === 'Metropolis'
        expect(riverOf(computeSettlementPlan({ ...inputFor(seed, type), water: SCENARIOS.straight })).bridges).toHaveLength(big ? 2 : 1)
        expect(riverOf(computeSettlementPlan({ ...inputFor(seed, type), water: SCENARIOS.bend120 })).bridges).toHaveLength(big ? 2 : 1)
        expect(riverOf(computeSettlementPlan({ ...inputFor(seed, type), water: SCENARIOS.spring })).bridges).toHaveLength(1)
        expect(riverOf(computeSettlementPlan({ ...inputFor(seed, type), water: SCENARIOS.ending })).bridges).toHaveLength(1)
      }
    }
  })

  it('an inflow-only hex with no river record (a Swamp revealed before the river reached it) gets an ending river', () => {
    const worldSeed = pickWorldSeedForStart('Grassland', seededRng(1))
    const at = { q: 0, r: 0 }
    const north = neighborInDirection(at, 2)
    const hexes = {
      [hexId(at)]: { ...at, terrain: 'Swamp' as const },
      [hexId(north)]: { ...north, terrain: 'Hills' as const, river: { exit: 5 as const } },
    }
    const water = waterForMapHex(hexes[hexId(at)], hexes, worldSeed)
    expect(water).toEqual({ kind: 'river', entries: [2], exit: null })
    const plan = computeSettlementPlan({ ...inputFor(4, 'Town'), water })
    const river = riverOf(plan)
    expect(river.course).toBe('ending')
    expect(river.entries).toEqual([2])
    checkRiverTown(plan, 'inflow-only swamp')
  })
})

describe('block helpers used above', () => {
  it('the fast river distance matches distanceToPolylines', () => {
    const plan = computeSettlementPlan({ ...inputFor(5, 'City'), water: SCENARIOS.twoEntries })
    const arms = riverOf(plan).arms
    const fast = distanceFn(arms)
    const rng = seededRng(42)
    for (let i = 0; i < 2000; i++) {
      const p = { x: (rng() - 0.5) * 2.4 * plan.bounds.maxX, y: (rng() - 0.5) * 2.4 * plan.bounds.maxY }
      expect(fast(p)).toBe(distanceToPolylines(p, arms))
    }
  })

  it('isConvex and pointInConvex behave', () => {
    const square: Block['cell'] = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }]
    expect(isConvex(square)).toBe(true)
    expect(isConvex([{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 0.2 }, { x: 2, y: 2 }, { x: 0, y: 2 }])).toBe(false)
    expect(pointInConvex({ x: 0.5, y: 0.5 }, square)).toBe(true)
    expect(pointInConvex({ x: 1.5, y: 0.5 }, square)).toBe(false)
    expect(nearestOnPolylines({ x: 0, y: 0 }, [[{ x: 1, y: 0 }, { x: 1, y: 1 }]]).distance).toBeCloseTo(1, 9)
  })
})

import { describe, expect, it } from 'vitest'
import {
  settlementTypeForD6,
  settlementTypeSpecFor,
  districtTypeForRoll,
  alignmentForD6,
  districtPoiForD6,
  tavernNameForD20,
  tavernKnownForForD20,
  tavernFoodForRoll,
  tavernDrinkForRoll,
  shopTypeForRoll,
  shopNameForD20,
  shopKnownForForD20,
  interestingCustomerFor2D4,
  type DistrictType,
} from './settlementTables'

describe('Settlement Type table (d6)', () => {
  it.each([
    [1, 'Village', 3, 4],
    [2, 'Town', 4, 4],
    [3, 'Town', 4, 4],
    [4, 'City', 6, 6],
    [5, 'City', 6, 6],
    [6, 'Metropolis', 8, 8],
  ] as const)('roll %i -> %s (%id%i, one die per district, never summed)', (roll, type, diceCount, diceSides) => {
    expect(settlementTypeForD6(roll)).toEqual({ type, diceCount, diceSides })
  })

  it('settlementTypeSpecFor matches the table lookup (used for manual overrides)', () => {
    expect(settlementTypeSpecFor('Metropolis')).toEqual(settlementTypeForD6(6))
  })
})

describe('district-type tiering (RAW invariant — must not be "fixed" later)', () => {
  it('Village/Town (d4 dice) can never produce a district-type index above 4', () => {
    const reachable = new Set<DistrictType>()
    for (let roll = 1; roll <= 4; roll++) reachable.add(districtTypeForRoll(roll, 4))
    for (const type of reachable) {
      expect(['Slums', 'Low District', 'Artisan District', 'Market']).toContain(type)
    }
  })

  it('City (d6 dice) can reach Temple District but never University/Castle', () => {
    const reachable = new Set<DistrictType>()
    for (let roll = 1; roll <= 6; roll++) reachable.add(districtTypeForRoll(roll, 6))
    expect(reachable.has('Temple District')).toBe(true)
    expect(reachable.has('University District')).toBe(false)
    expect(reachable.has('Castle District')).toBe(false)
  })

  it('Metropolis (d8 dice) can reach every district type including Castle', () => {
    const reachable = new Set<DistrictType>()
    for (let roll = 1; roll <= 8; roll++) reachable.add(districtTypeForRoll(roll, 8))
    expect(reachable.has('Castle District')).toBe(true)
    expect(reachable.size).toBe(8)
  })

  it('throws when the roll exceeds the die sides', () => {
    expect(() => districtTypeForRoll(5, 4)).toThrow()
  })
})

describe('Alignment table (d6)', () => {
  it.each([
    [1, 'Lawful'],
    [2, 'Lawful'],
    [3, 'Lawful'],
    [4, 'Neutral'],
    [5, 'Neutral'],
    [6, 'Chaotic'],
  ] as const)('roll %i -> %s', (roll, alignment) => {
    expect(alignmentForD6(roll)).toBe(alignment)
  })
})

describe('per-district Points of Interest tables', () => {
  const districts: DistrictType[] = [
    'Slums',
    'Low District',
    'Artisan District',
    'Market',
    'High District',
    'Temple District',
    'University District',
    'Castle District',
  ]

  it('every district has a populated entry for rolls 1-6', () => {
    for (const district of districts) {
      for (let roll = 1; roll <= 6; roll++) {
        expect(districtPoiForD6(district, roll)).toBeTruthy()
      }
    }
  })
})

describe('Tavern generator tables', () => {
  it('combines the two name columns independently', () => {
    expect(tavernNameForD20(1, 1)).toBe('The Crimson Rat')
  })

  it('known-for lookup', () => {
    expect(tavernKnownForForD20(1)).toBe('High-stakes gambling')
  })

  it('food differs per size tier', () => {
    expect(tavernFoodForRoll('Poor', 1)).toBe('Boiled cabbage')
    expect(tavernFoodForRoll('Standard', 1)).toBe('Alligator steak')
    expect(tavernFoodForRoll('Wealthy', 1)).toBe('Fried basilisk eyes')
  })

  it('drinks table is shared across tiers', () => {
    expect(tavernDrinkForRoll(1)).toContain('Barnacle grog')
    expect(tavernDrinkForRoll(12)).toContain('Van Dinkle whiskey')
  })
})

describe('Shop generator tables', () => {
  it('shop type differs by tier', () => {
    expect(shopTypeForRoll('Poor', 1)).toBe('Filthy bakery')
    expect(shopTypeForRoll('Standard', 1)).toBe('Brewer')
    expect(shopTypeForRoll('Wealthy', 1)).toBe('Fine tailor')
  })

  it('Poor shop has 12 entries; Standard/Wealthy have 10', () => {
    expect(() => shopTypeForRoll('Poor', 12)).not.toThrow()
    expect(() => shopTypeForRoll('Poor', 13)).toThrow()
    expect(() => shopTypeForRoll('Standard', 10)).not.toThrow()
    expect(() => shopTypeForRoll('Standard', 11)).toThrow()
  })

  it('combines the two shop name columns independently', () => {
    expect(shopNameForD20(1, 1)).toBe('Fink & Sons')
  })

  it('known-for lookup', () => {
    expect(shopKnownForForD20(1)).toBe('Ancient, beloved owner')
  })

  it('interesting customer is a 4x4 grid lookup', () => {
    expect(interestingCustomerFor2D4(1, 1)).toBe('Odd wizard')
    expect(interestingCustomerFor2D4(4, 4)).toBe('Pickpocket')
  })
})

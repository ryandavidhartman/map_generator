export type Rng = () => number

export function rollDie(sides: number, rng: Rng = Math.random): number {
  return Math.floor(rng() * sides) + 1
}

export function roll2d6(rng: Rng = Math.random): number {
  return rollDie(6, rng) + rollDie(6, rng)
}

// Uniform integer in [min, max] inclusive — used where a table gives a band rather than a
// fixed die (e.g. dungeonLevelBandForDanger), not a literal book die roll.
export function rollInRange(min: number, max: number, rng: Rng = Math.random): number {
  return min + Math.floor(rng() * (max - min + 1))
}

// Picks one option in proportion to its weight (a weighted table with arbitrary, non-integer
// weights — terrain pair weights, settlement shape odds). Weights must be non-negative and not
// all zero; the last option wins on floating-point leftovers.
export function pickWeighted<T>(options: [T, number][], rng: Rng = Math.random): T {
  const total = options.reduce((sum, [, weight]) => sum + weight, 0)
  let roll = rng() * total
  for (const [value, weight] of options) {
    roll -= weight
    if (roll < 0) return value
  }
  return options[options.length - 1][0]
}

// Sum of `count` independent rolls of a `sides`-sided die (e.g. "2d20").
export function sumDice(count: number, sides: number, rng: Rng = Math.random): number {
  let total = 0
  for (let i = 0; i < count; i++) total += rollDie(sides, rng)
  return total
}

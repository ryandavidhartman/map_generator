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

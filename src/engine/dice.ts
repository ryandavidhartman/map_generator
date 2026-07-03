export type Rng = () => number

export function rollDie(sides: number, rng: Rng = Math.random): number {
  return Math.floor(rng() * sides) + 1
}

export function roll2d6(rng: Rng = Math.random): number {
  return rollDie(6, rng) + rollDie(6, rng)
}

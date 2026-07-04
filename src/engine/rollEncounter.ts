import { rollDie, type Rng } from './dice'
import { encounterForD100, type EncounterTableKey } from '../data/encounterTables'

export function rollEncounter(key: EncounterTableKey, rng: Rng = Math.random): string {
  return encounterForD100(key, rollDie(100, rng))
}

import { useState } from 'react'
import { rollEncounter, rollEncounterPurpose, checkWildernessEncounterFrequency, rollWildernessMonster, rollBxUrbanEncounter, type WildernessMonsterResult } from '../engine/rollEncounter'
import type { EncounterTableKey, BxUrbanEncounterTableKey } from '../data/encounterTables'
import type { Terrain } from '../data/tables'
import { useMapState } from '../state/MapContext'

const BX_URBAN_KEYS: BxUrbanEncounterTableKey[] = ['B/X Urban (Daytime)', 'B/X Urban (Nighttime)']
function isBxUrbanKey(key: EncounterTableKey): key is BxUrbanEncounterTableKey {
  return (BX_URBAN_KEYS as string[]).includes(key)
}

// A sentinel source id for "roll on B/X's Terrain Category Summary instead of the book table" —
// distinct from any real EncounterTableKey. Mutually exclusive with the book table sources: one
// roll, one encounter, the GM picks which system generates it. (Real bug, user-reported
// 2026-08-23: this used to roll BOTH sources on every click and show them stacked, so an
// ankheg/bulette terrain-table result and an unrelated B/X-rolled Ghoul appeared together as if
// happening at once — nonsensical. Fixed by making it a single selectable source.)
const BX_WILDERNESS_SOURCE = 'B/X Wandering Monster' as const
type Source = EncounterTableKey | typeof BX_WILDERNESS_SOURCE

// User-requested (2026-08-23): a party-level dropdown right on the roller itself, rather than
// only the Toolbar's campaign-wide number input — lets a GM preview/roll at a different level
// without changing the tracked campaign value. Seeded from the campaign's partyLevel so it
// starts in sync, then a fully independent local override.
const PARTY_LEVELS = Array.from({ length: 20 }, (_, i) => i + 1)

type RollResult =
  | 'none'
  | { kind: 'table'; encounter: string; purpose: string }
  | { kind: 'bx-wilderness'; monster: WildernessMonsterResult; purpose: string }

function describeWildernessMonster(result: WildernessMonsterResult): string {
  if (result.kind === 'traveler') {
    return `Traveler: ${result.npc.race} ${result.npc.profession}`
  }
  return `${result.monster.name} (${result.monster.category})`
}

type EncounterRollerProps = {
  tableKeys: EncounterTableKey[]
  // When provided, a frequency check (B/X's Encounter Frequency table — see
  // engine/rollEncounter.ts) gates whether an encounter happens at all before rolling, so the
  // roller can produce "no encounter" instead of always hitting. Wilderness only: the book gives
  // urban/settlement checks no die-based gate, just DM-judged cadence ("every 3 turns, or as
  // desired") — so district use (SettlementView) omits this prop and keeps the old
  // always-rolls behavior. Also unlocks the B/X Wandering Monster source as a selectable option.
  wildernessTerrain?: Terrain
}

export function EncounterRoller({ tableKeys, wildernessTerrain }: EncounterRollerProps) {
  const { partyLevel: campaignPartyLevel } = useMapState()
  const sources: Source[] = wildernessTerrain ? [...tableKeys, BX_WILDERNESS_SOURCE] : tableKeys
  const [selectedSource, setSelectedSource] = useState<Source>(sources[0])
  const [partyLevel, setPartyLevel] = useState(campaignPartyLevel)
  const [result, setResult] = useState<RollResult | null>(null)

  function roll() {
    if (wildernessTerrain && !checkWildernessEncounterFrequency(wildernessTerrain)) {
      setResult('none')
      return
    }
    if (selectedSource === BX_WILDERNESS_SOURCE) {
      setResult({ kind: 'bx-wilderness', monster: rollWildernessMonster(wildernessTerrain!, partyLevel), purpose: rollEncounterPurpose() })
    } else if (isBxUrbanKey(selectedSource)) {
      setResult({ kind: 'table', encounter: rollBxUrbanEncounter(selectedSource, partyLevel), purpose: rollEncounterPurpose() })
    } else {
      setResult({ kind: 'table', encounter: rollEncounter(selectedSource), purpose: rollEncounterPurpose() })
    }
  }

  return (
    <div className="encounter-roller">
      {sources.length > 1 && (
        <select value={selectedSource} onChange={(e) => setSelectedSource(e.target.value as Source)}>
          {sources.map((source) => (
            <option key={source} value={source}>
              {source}
            </option>
          ))}
        </select>
      )}
      <label className="party-level-control">
        Party Level
        <select value={partyLevel} onChange={(e) => setPartyLevel(Number(e.target.value))}>
          {PARTY_LEVELS.map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </select>
      </label>
      <button type="button" onClick={roll}>
        {wildernessTerrain ? 'Check for wandering encounter' : 'Roll random encounter'}
      </button>
      {result === 'none' && <p className="encounter-result">No encounter.</p>}
      {result && result !== 'none' && result.kind === 'table' && (
        <p className="encounter-result">
          {result.encounter}
          <br />
          <span className="encounter-purpose">Purpose: {result.purpose}</span>
        </p>
      )}
      {result && result !== 'none' && result.kind === 'bx-wilderness' && (
        <p className="encounter-result">
          {describeWildernessMonster(result.monster)}
          <br />
          <span className="encounter-purpose">Purpose: {result.purpose}</span>
        </p>
      )}
    </div>
  )
}

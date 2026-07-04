import { useState } from 'react'
import { rollEncounter } from '../engine/rollEncounter'
import type { EncounterTableKey } from '../data/encounterTables'

export function EncounterRoller({ tableKeys }: { tableKeys: EncounterTableKey[] }) {
  const [selectedKey, setSelectedKey] = useState<EncounterTableKey>(tableKeys[0])
  const [result, setResult] = useState<string | null>(null)

  return (
    <div className="encounter-roller">
      {tableKeys.length > 1 && (
        <select value={selectedKey} onChange={(e) => setSelectedKey(e.target.value as EncounterTableKey)}>
          {tableKeys.map((key) => (
            <option key={key} value={key}>
              {key}
            </option>
          ))}
        </select>
      )}
      <button type="button" onClick={() => setResult(rollEncounter(selectedKey))}>
        Roll random encounter
      </button>
      {result && <p className="encounter-result">{result}</p>}
    </div>
  )
}

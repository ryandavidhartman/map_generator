import { useState } from 'react'
import { useMapDispatch, useMapState } from '../state/MapContext'
import { isAdjacentToParty, type Hex } from '../state/mapReducer'
import { TERRAIN_ORDER, type DangerLevel, type Terrain } from '../data/tables'

const DANGER_LEVELS: DangerLevel[] = ['Safe', 'Unsafe', 'Risky', 'Deadly']

export function HexDetailsPanel() {
  const state = useMapState()
  const dispatch = useMapDispatch()
  const [editing, setEditing] = useState(false)

  const hex = state.selectedHexId ? state.hexes[state.selectedHexId] : undefined

  if (!hex) {
    return (
      <aside className="hex-details-panel">
        <p>Select a hex to see its details.</p>
      </aside>
    )
  }

  const isParty = state.partyHexId === hex.id
  const canMoveHere = !isParty && isAdjacentToParty(state, hex.id)

  if (editing) {
    return (
      <aside className="hex-details-panel">
        <HexEditForm hex={hex} onDone={() => setEditing(false)} />
      </aside>
    )
  }

  return (
    <aside className="hex-details-panel">
      <h2>
        Hex {hex.id} {isParty && <span title="Party is here">🧭</span>}
      </h2>
      <p>
        <strong>Terrain:</strong> {hex.terrain}
      </p>
      <p>
        <strong>Danger:</strong> {hex.danger}
      </p>
      {hex.poi ? (
        <div>
          <p>
            <strong>Point of interest:</strong> {hex.poi.location}
          </p>
          <p>{hex.poi.development}</p>
          {hex.poi.cataclysm && (
            <p>
              <strong>Cataclysm:</strong> {hex.poi.cataclysm}
            </p>
          )}
          {hex.poi.settlementName && (
            <p>
              <strong>Settlement name:</strong> {hex.poi.settlementName}
            </p>
          )}
        </div>
      ) : (
        <p>No point of interest.</p>
      )}

      <div className="hex-details-actions">
        {canMoveHere && (
          <button type="button" onClick={() => dispatch({ type: 'MOVE_PARTY_TO', hexId: hex.id })}>
            Move party here
          </button>
        )}
        <button type="button" onClick={() => dispatch({ type: 'REROLL_HEX', hexId: hex.id })}>
          Reroll danger/POI
        </button>
        <button type="button" onClick={() => setEditing(true)}>
          Edit
        </button>
      </div>
    </aside>
  )
}

function HexEditForm({ hex, onDone }: { hex: Hex; onDone: () => void }) {
  const dispatch = useMapDispatch()
  const [terrain, setTerrain] = useState<Terrain>(hex.terrain)
  const [danger, setDanger] = useState<DangerLevel>(hex.danger)
  const [hasPoi, setHasPoi] = useState(Boolean(hex.poi))
  const [location, setLocation] = useState(hex.poi?.location ?? '')
  const [development, setDevelopment] = useState(hex.poi?.development ?? '')

  function handleSave() {
    dispatch({
      type: 'EDIT_HEX',
      hexId: hex.id,
      patch: {
        terrain,
        danger,
        poi: hasPoi ? { location, development } : undefined,
      },
    })
    onDone()
  }

  return (
    <div className="hex-edit-form">
      <h2>Edit hex {hex.id}</h2>

      <label>
        Terrain
        <select value={terrain} onChange={(e) => setTerrain(e.target.value as Terrain)}>
          {TERRAIN_ORDER.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>

      <label>
        Danger
        <select value={danger} onChange={(e) => setDanger(e.target.value as DangerLevel)}>
          {DANGER_LEVELS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </label>

      <label>
        <input type="checkbox" checked={hasPoi} onChange={(e) => setHasPoi(e.target.checked)} />
        Has point of interest
      </label>

      {hasPoi && (
        <>
          <label>
            Location
            <input value={location} onChange={(e) => setLocation(e.target.value)} />
          </label>
          <label>
            Development
            <input value={development} onChange={(e) => setDevelopment(e.target.value)} />
          </label>
        </>
      )}

      <div className="hex-edit-actions">
        <button type="button" className="primary" onClick={handleSave}>
          Save
        </button>
        <button type="button" onClick={onDone}>
          Cancel
        </button>
      </div>
    </div>
  )
}

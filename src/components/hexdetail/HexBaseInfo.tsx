import { useState } from 'react'
import { useMapDispatch, useMapState } from '../../state/MapContext'
import { isAdjacentToParty, type Hex } from '../../state/mapReducer'
import { TERRAIN_ORDER, type DangerLevel, type Terrain } from '../../data/tables'
import { TERRAIN_TO_ENCOUNTER_KEYS } from '../../data/encounterTables'
import { riverEntriesFor } from '../../engine/rivers'
import { DIRECTION_NAMES, type HexDirection } from '../../hexgrid/hexMath'
import { EncounterRoller } from '../EncounterRoller'

const DANGER_LEVELS: DangerLevel[] = ['Safe', 'Unsafe', 'Risky', 'Deadly']

// "Enters from the north, leaves to the south-east" — the river's course through the hex, from
// the saved exit and the entries worked out from the neighbors (engine/rivers.ts).
export function describeRiver(exit: HexDirection | null, entries: HexDirection[]): string {
  const from = entries.map((d) => DIRECTION_NAMES[d]).join(' and ')
  const start = entries.length ? `enters from the ${from}` : 'rises here'
  const end = exit === null ? 'ends here' : `leaves to the ${DIRECTION_NAMES[exit]}`
  return `${start}, ${end}`
}

// Sites on Ocean hexes (punch-list item 1a, text only for now): most sit on a small island
// inside the Ocean hex; Ruins, Deep tunnels and Caves are underwater. The dungeon type comes
// from the generated site, or from the Feature row's forced type before the site exists.
export function oceanSiteSetting(hex: Hex): string | undefined {
  if (hex.terrain !== 'Ocean' || !hex.poi || hex.poi.siteKind === 'none' || hex.poi.siteKind === undefined) return undefined
  const dungeonType = hex.site?.kind === 'dungeon' ? hex.site.siteType : hex.poi.siteKind === 'dungeon' ? hex.poi.forcedType : undefined
  if (hex.poi.siteKind === 'dungeon' && dungeonType === undefined) return undefined
  if (dungeonType === 'Ruins') return 'Underwater: sunken ruins beneath the waves.'
  if (dungeonType === 'Cave') return 'Underwater: sea caves beneath the waves.'
  if (dungeonType === 'Deep tunnels') return 'Underwater: tunnels below the seabed.'
  return 'On a small island in the open sea.'
}

// Shared by every hex full-view variant (wilderness/dungeon/settlement): id/terrain/danger/poi
// display, move/reroll/edit actions (ported from the now-retired HexDetailsPanel sidebar), and
// the standalone random-encounter roller.
export function HexBaseInfo({ hex }: { hex: Hex }) {
  const state = useMapState()
  const dispatch = useMapDispatch()
  const [editing, setEditing] = useState(false)

  const isParty = state.partyHexId === hex.id
  const canMoveHere = !isParty && isAdjacentToParty(state, hex.id)
  const oceanSetting = oceanSiteSetting(hex)
  // Inflows come from the neighbors' exits, so a hex revealed before a river reached it (a
  // Swamp, lake, Coast or Ocean hex with no river record) still reports the river.
  const riverEntries = riverEntriesFor(hex, state.hexes)

  if (editing) {
    return <HexEditForm hex={hex} onDone={() => setEditing(false)} />
  }

  return (
    <div className="hex-base-info">
      <h2>
        Hex {hex.id} {isParty && <span title="Party is here">🧭</span>}
      </h2>
      <p>
        <strong>Terrain:</strong> {hex.terrain}
      </p>
      <p>
        <strong>Danger:</strong> {hex.danger}
      </p>
      <p>
        <strong>Danger Level:</strong> {hex.dangerLevel ?? 1}
      </p>
      {(hex.river || riverEntries.length > 0) && (
        <p>
          <strong>River:</strong> {describeRiver(hex.river?.exit ?? null, riverEntries)}
        </p>
      )}
      {hex.lake && (
        <p>
          <strong>Lake:</strong> a lake lies in this hex
        </p>
      )}
      {oceanSetting && <p className="ocean-site-setting">{oceanSetting}</p>}
      {hex.poi ? (
        <div>
          <p>
            <strong>Point of interest:</strong> {hex.poi.location}
          </p>
          {hex.poi.development && <p>{hex.poi.development}</p>}
          {hex.poi.cataclysm && (
            <p>
              <strong>Cataclysm:</strong> {hex.poi.cataclysm}
            </p>
          )}
          {hex.poi.naturalLandmark && (
            <p>
              <strong>Landmark:</strong> {hex.poi.naturalLandmark}
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

      <EncounterRoller
        tableKeys={TERRAIN_TO_ENCOUNTER_KEYS[hex.terrain]}
        wildernessTerrain={hex.terrain}
        hexDangerLevel={hex.dangerLevel ?? 1}
      />
    </div>
  )
}

// A hand edit keeps the hex's river and lake as they are (no controls for them for now, and the
// river rules aren't enforced on edits) — EDIT_HEX only patches the fields below.
function HexEditForm({ hex, onDone }: { hex: Hex; onDone: () => void }) {
  const dispatch = useMapDispatch()
  const [terrain, setTerrain] = useState<Terrain>(hex.terrain)
  const [danger, setDanger] = useState<DangerLevel>(hex.danger)
  const [dangerLevel, setDangerLevel] = useState(hex.dangerLevel ?? 1)
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
        dangerLevel,
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
        Danger Level
        <input
          type="number"
          min={1}
          value={dangerLevel}
          onChange={(e) => setDangerLevel(Math.max(1, Number(e.target.value) || 1))}
        />
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

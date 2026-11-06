import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { MapProvider, useMapState } from '../state/MapContext'
import type { Hex, MapState } from '../state/mapReducer'
import { TERRAIN_ORDER, type Terrain } from '../data/tables'
import { locationFeatureForD200 } from '../data/locationTables'
import { pointOfInterestForFeatureRoll } from '../engine/generateHex'
import { pickWorldSeedForStart } from '../engine/worldFormula'
import { HexSiteContent } from '../components/hexdetail/HexSiteContent'
import { reviewRiverFor } from './poiReviewRiver'

const MIN_ROLL = 1
const MAX_ROLL = 200
const REVIEW_HEX_ID = '0,0'

// Review tool, not part of the normal GM flow: force-generates the site for a specific Location
// Generator Feature roll (1-200) so every row can be eyeballed directly, without needing to reveal
// hexes and hope the 1-in-6 POI check + d200 roll happen to land on the row being reviewed.
// Runs in its own throwaway MapProvider (persist={false}) so nothing here ever touches the real
// campaign's localStorage save — see MapContext.tsx's `initialState`/`persist` props.
const DANGER_LEVELS = Array.from({ length: 20 }, (_, i) => i + 1)

export function PoiReviewPage() {
  const { n } = useParams<{ n: string }>()
  const navigate = useNavigate()
  const [terrain, setTerrain] = useState<Terrain>('Grassland')
  // No real neighbors exist for this synthetic hex to average against — this stands in for the
  // GM-facing local override the old campaign-wide partyLevel select used to provide here.
  const [dangerLevel, setDangerLevel] = useState(1)
  const [rerollNonce, setRerollNonce] = useState(0)

  const roll = Number(n)
  const rollIsValid = Number.isInteger(roll) && roll >= MIN_ROLL && roll <= MAX_ROLL

  const initialState = useMemo<MapState | null>(() => {
    if (!rollIsValid) return null
    const poi = pointOfInterestForFeatureRoll(terrain, roll, Math.random)
    // A fresh world seed each time, placed to agree with the chosen terrain, so a settlement's
    // sea (from the formula around this lone hex) shows varied coast cases across rerolls. Each
    // reroll also picks a river case (none, spring, through, ending), so river cases show too.
    const worldSeed = pickWorldSeedForStart(terrain, Math.random)
    const review = reviewRiverFor(terrain, { q: 0, r: 0 }, worldSeed, dangerLevel, Math.random)
    const hex: Hex = {
      id: REVIEW_HEX_ID,
      q: 0,
      r: 0,
      terrain,
      danger: 'Safe',
      dangerLevel,
      poi,
      ...(review.river ? { river: review.river } : {}),
      ...(review.lake ? { lake: review.lake } : {}),
    }
    const hexes: Record<string, Hex> = { [REVIEW_HEX_ID]: hex }
    for (const neighbor of review.neighbors) hexes[neighbor.id] = neighbor
    return { hexes, partyHexId: REVIEW_HEX_ID, selectedHexId: REVIEW_HEX_ID, worldSeed }
    // rerollNonce isn't read above — bumping it deliberately forces this memo (and thus the keyed
    // MapProvider below) to recompute with a fresh Math.random() roll for the same feature.
  }, [terrain, roll, rollIsValid, dangerLevel, rerollNonce])

  return (
    <div className="hex-detail-page poi-review-page">
      <button type="button" className="back-link" onClick={() => navigate('/')}>
        ← Back to map
      </button>

      <div className="poi-review-controls">
        <h2>POI Review</h2>
        <div className="poi-review-nav">
          <button type="button" disabled={roll <= MIN_ROLL} onClick={() => navigate(`/poi/${roll - 1}`)}>
            ← Prev
          </button>
          <span>
            Roll {rollIsValid ? roll : '?'} of {MAX_ROLL}
          </span>
          <button type="button" disabled={roll >= MAX_ROLL} onClick={() => navigate(`/poi/${roll + 1}`)}>
            Next →
          </button>
        </div>
        {rollIsValid && (
          <p>
            <strong>Feature:</strong> {locationFeatureForD200(roll).feature}
          </p>
        )}
        <label>
          Terrain (affects the terrain-keyed Cataclysm/Natural landmark rows, and a settlement's sea — a fresh world is placed around this lone hex on every reroll, so Coast and Ocean show varied coasts, and land terrains get a random river case)
          <select value={terrain} onChange={(e) => setTerrain(e.target.value as Terrain)}>
            {TERRAIN_ORDER.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label>
          Danger Level (gates wandering-encounter difficulty and dungeon-site scaling)
          <select value={dangerLevel} onChange={(e) => setDangerLevel(Number(e.target.value))}>
            {DANGER_LEVELS.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => setRerollNonce((v) => v + 1)}>
          Reroll POI
        </button>
      </div>

      {!rollIsValid || !initialState ? (
        <p>
          Invalid roll — enter a number between {MIN_ROLL} and {MAX_ROLL} in the URL (e.g. /poi/135).
        </p>
      ) : (
        <MapProvider key={`${roll}-${terrain}-${dangerLevel}-${rerollNonce}`} initialState={initialState} persist={false}>
          <PoiReviewBody />
        </MapProvider>
      )}
    </div>
  )
}

function PoiReviewBody() {
  const state = useMapState()
  const hex = state.hexes[REVIEW_HEX_ID]
  return <HexSiteContent hex={hex} />
}

import { useState } from 'react'
import { useMapDispatch } from '../state/MapContext'
import { TERRAIN_ORDER, type Terrain } from '../data/tables'
import { rollStartingTerrain } from '../engine/generateHex'

export function StartMapDialog() {
  const dispatch = useMapDispatch()
  const [terrain, setTerrain] = useState<Terrain>('Grassland')
  const [radius, setRadius] = useState(6)

  function handleRoll() {
    setTerrain(rollStartingTerrain())
  }

  function handleStart() {
    dispatch({ type: 'START_MAP', terrain, radius })
  }

  return (
    <div className="start-map-dialog">
      <h2>Start a new hex map</h2>

      <label>
        Starting terrain
        <select value={terrain} onChange={(e) => setTerrain(e.target.value as Terrain)}>
          {TERRAIN_ORDER.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
      <button type="button" onClick={handleRoll}>
        Roll 2d6
      </button>

      <label>
        Map radius
        <input
          type="number"
          min={1}
          max={20}
          value={radius}
          onChange={(e) => setRadius(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
        />
      </label>

      <button type="button" className="primary" onClick={handleStart}>
        Start Map
      </button>
    </div>
  )
}

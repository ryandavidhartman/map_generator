import { useMapDispatch, useMapState } from '../state/MapContext'

export function Toolbar() {
  const state = useMapState()
  const dispatch = useMapDispatch()

  function handleNewMap() {
    if (state.partyHexId && !window.confirm('Start a new map? This clears the current one.')) {
      return
    }
    dispatch({ type: 'NEW_MAP' })
  }

  return (
    <header className="toolbar">
      <h1>Shadowdark Hex Crawl Generator</h1>
      <div className="toolbar-actions">
        <label className="party-level-control">
          Party Level
          <input
            type="number"
            min={1}
            max={20}
            value={state.partyLevel}
            onChange={(e) => dispatch({ type: 'SET_PARTY_LEVEL', level: Number(e.target.value) || 1 })}
          />
        </label>
        {state.partyHexId && (
          <button type="button" onClick={handleNewMap}>
            New Map
          </button>
        )}
      </div>
    </header>
  )
}

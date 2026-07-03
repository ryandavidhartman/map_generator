import { createContext, useContext, useEffect, useReducer, type Dispatch, type ReactNode } from 'react'
import { EMPTY_MAP_STATE, mapReducer, type MapAction, type MapState } from './mapReducer'
import { loadMapState, saveMapState } from '../persistence/localStorage'

const MapStateContext = createContext<MapState | null>(null)
const MapDispatchContext = createContext<Dispatch<MapAction> | null>(null)

function initMapState(): MapState {
  return loadMapState() ?? EMPTY_MAP_STATE
}

export function MapProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(mapReducer, undefined, initMapState)

  useEffect(() => {
    saveMapState(state)
  }, [state])

  return (
    <MapStateContext.Provider value={state}>
      <MapDispatchContext.Provider value={dispatch}>{children}</MapDispatchContext.Provider>
    </MapStateContext.Provider>
  )
}

export function useMapState(): MapState {
  const state = useContext(MapStateContext)
  if (!state) throw new Error('useMapState must be used within a MapProvider')
  return state
}

export function useMapDispatch(): Dispatch<MapAction> {
  const dispatch = useContext(MapDispatchContext)
  if (!dispatch) throw new Error('useMapDispatch must be used within a MapProvider')
  return dispatch
}

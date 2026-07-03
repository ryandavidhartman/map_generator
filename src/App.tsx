import './App.css'
import { HexGridSvg } from './hexgrid/HexGridSvg'
import { StartMapDialog } from './components/StartMapDialog'
import { HexDetailsPanel } from './components/HexDetailsPanel'
import { Toolbar } from './components/Toolbar'
import { Legend } from './components/Legend'
import { MapProvider, useMapState } from './state/MapContext'

function AppContent() {
  const state = useMapState()

  if (!state.partyHexId) {
    return (
      <>
        <Toolbar />
        <div className="start-screen">
          <StartMapDialog />
        </div>
      </>
    )
  }

  return (
    <>
      <Toolbar />
      <div className="app-body">
        <div className="map-area">
          <HexGridSvg />
          <Legend />
        </div>
        <HexDetailsPanel />
      </div>
    </>
  )
}

function App() {
  return (
    <MapProvider>
      <AppContent />
    </MapProvider>
  )
}

export default App

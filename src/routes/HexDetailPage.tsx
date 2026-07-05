import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMapDispatch, useMapState } from '../state/MapContext'
import { WildernessView } from '../components/hexdetail/WildernessView'
import { DungeonSiteView } from '../components/hexdetail/DungeonSiteView'
import { SettlementView } from '../components/hexdetail/SettlementView'
import { TowerSiteView } from '../components/hexdetail/TowerSiteView'
import { ShrineSiteView } from '../components/hexdetail/ShrineSiteView'
import { RiftSiteView } from '../components/hexdetail/RiftSiteView'
import { KeepSiteView } from '../components/hexdetail/KeepSiteView'

export function HexDetailPage() {
  const { hexId } = useParams<{ hexId: string }>()
  const state = useMapState()
  const dispatch = useMapDispatch()
  const navigate = useNavigate()

  const hex = hexId ? state.hexes[hexId] : undefined

  // Idempotent: GENERATE_SITE is a no-op once hex.site is already set, so this safely
  // auto-generates on first visit and does nothing on repeat visits.
  useEffect(() => {
    if (hex && hex.poi && !hex.site) {
      dispatch({ type: 'GENERATE_SITE', hexId: hex.id })
    }
  }, [hex, dispatch])

  return (
    <div className="hex-detail-page">
      <button type="button" className="back-link" onClick={() => navigate('/')}>
        ← Back to map
      </button>
      {!hex ? (
        <p>Hex not found.</p>
      ) : !hex.poi ? (
        <WildernessView hex={hex} />
      ) : hex.site?.kind === 'settlement' ? (
        <SettlementView hex={hex} site={hex.site} />
      ) : hex.site?.kind === 'dungeon' ? (
        <DungeonSiteView hex={hex} site={hex.site} />
      ) : hex.site?.kind === 'tower' ? (
        <TowerSiteView hex={hex} site={hex.site} />
      ) : hex.site?.kind === 'shrine' ? (
        <ShrineSiteView hex={hex} site={hex.site} />
      ) : hex.site?.kind === 'rift' ? (
        <RiftSiteView hex={hex} site={hex.site} />
      ) : hex.site?.kind === 'keep' ? (
        <KeepSiteView hex={hex} site={hex.site} />
      ) : (
        <p>Generating site…</p>
      )}
    </div>
  )
}

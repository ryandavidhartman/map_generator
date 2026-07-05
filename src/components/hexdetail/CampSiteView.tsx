import { useMapDispatch } from '../../state/MapContext'
import type { Hex } from '../../state/mapReducer'
import type { CampSite } from '../../engine/generateCamp'
import { CampMapSvg, type CampMapFeatureData } from '../../hexgrid/CampMapSvg'
import { CAMP_CENTRAL_COLOR, CAMP_FEATURE_COLORS } from '../../data/siteColors'
import { HexBaseInfo } from './HexBaseInfo'

export function CampSiteView({ hex, site }: { hex: Hex; site: CampSite }) {
  const dispatch = useMapDispatch()

  const central: CampMapFeatureData = {
    id: 'central',
    point: site.central.point,
    color: CAMP_CENTRAL_COLOR,
    label: '★',
    highlighted: site.central.isObjectiveFeature,
  }
  const peripheral: CampMapFeatureData[] = site.peripheralFeatures.map((f, i) => ({
    id: f.id,
    point: f.point,
    color: CAMP_FEATURE_COLORS[f.feature],
    label: f.isObjectiveFeature ? '★' : String(i + 1),
    highlighted: f.isObjectiveFeature,
  }))

  return (
    <div className="site-view">
      <HexBaseInfo hex={hex} />

      <section className="site-section">
        <div className="site-section-header">
          <h3>{site.size} Camp</h3>
          <button type="button" onClick={() => dispatch({ type: 'REROLL_SITE', hexId: hex.id })}>
            Reroll Site
          </button>
        </div>

        <div className="site-layout">
          <CampMapSvg central={central} peripheral={peripheral} />
        </div>

        <ol className="room-list">
          <li data-feature-id="central" className={site.central.isObjectiveFeature ? 'objective-room' : undefined}>
            <strong>
              Central Feature{site.central.isObjectiveFeature && ' (Objective)'}
            </strong>
          </li>
          {site.peripheralFeatures.map((f) => (
            <li key={f.id} data-feature-id={f.id} className={f.isObjectiveFeature ? 'objective-room' : undefined}>
              <strong>
                {f.feature}
                {f.isObjectiveFeature && ' (Objective)'}
              </strong>
              <p>{f.description}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}

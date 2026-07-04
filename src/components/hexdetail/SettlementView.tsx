import { useState } from 'react'
import { useMapDispatch } from '../../state/MapContext'
import type { Hex } from '../../state/mapReducer'
import type { Settlement, District } from '../../engine/generateSettlement'
import { GridLayoutSvg, type GridLayoutCellData } from '../../hexgrid/GridLayoutSvg'
import { DISTRICT_TYPE_COLORS } from '../../data/siteColors'
import { DISTRICT_TYPE_TO_ENCOUNTER_KEY } from '../../data/encounterTables'
import { generateTavern, type Tavern } from '../../engine/generateTavern'
import { generateShop, type Shop } from '../../engine/generateShop'
import type { ShopTier } from '../../data/settlementTables'
import type { DistrictType } from '../../data/settlementTables'
import { HexBaseInfo } from './HexBaseInfo'
import { EncounterRoller } from '../EncounterRoller'

function defaultShopTierForDistrict(type: DistrictType): ShopTier {
  if (type === 'Slums' || type === 'Low District') return 'Poor'
  if (type === 'High District' || type === 'Castle District') return 'Wealthy'
  return 'Standard'
}

export function SettlementView({ hex, site }: { hex: Hex; site: Settlement }) {
  const dispatch = useMapDispatch()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  function toggle(id: string) {
    setExpandedId((current) => (current === id ? null : id))
  }

  const cells: GridLayoutCellData[] = site.districts.map((d) => ({
    id: d.id,
    cell: d.cell,
    parentId: d.parentDistrictId,
    color: DISTRICT_TYPE_COLORS[d.districtType],
    label: d.isSeatOfGovernment ? '★' : String(d.index + 1),
    highlighted: d.isSeatOfGovernment,
    onClick: () => toggle(d.id),
  }))

  return (
    <div className="site-view">
      <HexBaseInfo hex={hex} />

      <section className="site-section">
        <div className="site-section-header">
          <h3>
            {site.settlementType}
            {hex.poi?.settlementName ? `: ${hex.poi.settlementName}` : ''}
          </h3>
          <button type="button" onClick={() => dispatch({ type: 'REROLL_SITE', hexId: hex.id })}>
            Reroll Site
          </button>
        </div>

        <div className="site-layout">
          <GridLayoutSvg cells={cells} cellIdAttribute="district-id" />
        </div>

        <ul className="district-list">
          {site.districts.map((district) => (
            <DistrictListItem key={district.id} district={district} expanded={expandedId === district.id} onToggle={() => toggle(district.id)} />
          ))}
        </ul>
      </section>
    </div>
  )
}

function DistrictListItem({ district, expanded, onToggle }: { district: District; expanded: boolean; onToggle: () => void }) {
  const [tavern, setTavern] = useState<Tavern | null>(null)
  const [shop, setShop] = useState<Shop | null>(null)

  return (
    <li data-district-id={district.id} className={district.isSeatOfGovernment ? 'seat-of-government' : undefined}>
      <button type="button" className="district-toggle" onClick={onToggle}>
        District {district.index + 1}: {district.districtType}
        {district.isSeatOfGovernment && ' (Seat of Government)'}
      </button>
      {expanded && (
        <div className="district-detail">
          <p>
            <strong>Alignment:</strong> {district.alignment}
          </p>
          <ul>
            {district.pointsOfInterest.map((poi, i) => (
              <li key={i}>{poi}</li>
            ))}
          </ul>

          <EncounterRoller tableKeys={[DISTRICT_TYPE_TO_ENCOUNTER_KEY[district.districtType]]} />

          <div className="district-actions">
            <button type="button" onClick={() => setTavern(generateTavern())}>
              Generate Tavern
            </button>
            <button type="button" onClick={() => setShop(generateShop(defaultShopTierForDistrict(district.districtType)))}>
              Generate Shop
            </button>
          </div>

          {tavern && (
            <div className="generated-tavern">
              <strong>{tavern.name}</strong> ({tavern.sizeTier}) — {tavern.knownFor}
              <p>Food: {tavern.food}</p>
              <p>Drink: {tavern.drink}</p>
            </div>
          )}

          {shop && (
            <div className="generated-shop">
              <strong>{shop.name}</strong> — {shop.shopType}
              <p>{shop.knownFor}</p>
              <p>Notable customer: {shop.interestingCustomer}</p>
            </div>
          )}
        </div>
      )}
    </li>
  )
}

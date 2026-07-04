import type { Hex } from '../../state/mapReducer'
import { HexBaseInfo } from './HexBaseInfo'

// A revealed hex with no Point of Interest — just the shared base info (terrain/danger,
// move/reroll/edit, and the standalone random-encounter roller). No site to generate.
export function WildernessView({ hex }: { hex: Hex }) {
  return (
    <div className="site-view">
      <HexBaseInfo hex={hex} />
      <p className="wilderness-note">Just wilderness here — nothing to explore beyond the road.</p>
    </div>
  )
}

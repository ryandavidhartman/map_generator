// Render smoke tests for the UI layer: every site view and its map renderer, the overland map, and
// the routes, rendered to static HTML (react-dom/server — no browser or DOM library needed). They
// catch render-time crashes, React warnings (e.g. duplicate keys), NaN/undefined leaking into SVG
// attributes, and map elements missing for generated rooms/districts/features. Effects don't run
// in a static render, so anything a view generates in useEffect isn't exercised here — sites are
// pre-generated instead. Visual quality still needs a real browser (see CLAUDE.md).
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'
import { HexSiteContent } from './hexdetail/HexSiteContent'
import { HexGridSvg } from '../hexgrid/HexGridSvg'
import { MapProvider } from '../state/MapContext'
import { EMPTY_MAP_STATE, mapReducer, type Hex, type MapState } from '../state/mapReducer'
import { TERRAIN_ORDER, type Terrain } from '../data/tables'
import { pointOfInterestForFeatureRoll } from '../engine/generateHex'
import { generateSiteForHex } from '../engine/generateSite'
import { computeVisibleCoords, hexId, neighborInDirection, oppositeDirection, type HexDirection } from '../hexgrid/hexMath'
import { pickWorldSeedForStart } from '../engine/worldFormula'

function seededRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

const HEX_ID = '0,0'

// One hex with its site pre-generated, plus an Ocean neighbor on odd seeds so settlements also
// get drawn with a coast (waterForHex reads revealed neighbors from the map state).
function stateForFeature(roll: number, terrain: Terrain, seed: number, dangerLevel: number): { state: MapState; hex: Hex } {
  const rng = seededRng(seed)
  const poi = pointOfInterestForFeatureRoll(terrain, roll, rng)
  const site = poi.siteKind === 'none' ? undefined : generateSiteForHex(poi, rng, dangerLevel)
  const hex: Hex = { id: HEX_ID, q: 0, r: 0, terrain, danger: 'Risky', dangerLevel, poi, site }
  const hexes: MapState['hexes'] = { [HEX_ID]: hex }
  if (seed % 2 === 1) hexes['1,0'] = { id: '1,0', q: 1, r: 0, terrain: 'Ocean', danger: 'Safe', dangerLevel }
  return { state: { hexes, partyHexId: HEX_ID, selectedHexId: HEX_ID, worldSeed: seed }, hex }
}

function renderSite(state: MapState, hex: Hex): string {
  return renderToString(
    <MemoryRouter>
      <MapProvider initialState={state} persist={false}>
        <HexSiteContent hex={hex} />
      </MapProvider>
    </MemoryRouter>,
  )
}

function expectCleanMarkup(html: string) {
  expect(html).not.toMatch(/NaN/)
  expect(html).not.toMatch(/="undefined"|="null"/)
  expect(html).not.toMatch(/Generating site/)
}

const count = (html: string, needle: string) => html.split(needle).length - 1

let consoleError: MockInstance
let consoleWarn: MockInstance

beforeEach(() => {
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
  consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
})

// react-router's MemoryRouter uses useLayoutEffect, which React always warns about in a static
// render. It's an artifact of rendering on the server, not an app problem, so it's the one message
// ignored.
const isStaticRenderArtifact = (args: unknown[]) => String(args[0]).includes('useLayoutEffect does nothing on the server')

afterEach(() => {
  // Any other React warning (duplicate keys, invalid DOM nesting, bad props) fails the test.
  expect(consoleError.mock.calls.filter((args) => !isStaticRenderArtifact(args))).toEqual([])
  expect(consoleWarn.mock.calls).toEqual([])
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('site views render every Feature-table row', () => {
  // Two seeds per row, with terrain and danger level varied across rows.
  const cases = Array.from({ length: 200 }, (_, i) => i + 1).flatMap((roll) =>
    [1, 2].map((s) => ({ roll, seed: roll * 101 + s, terrain: TERRAIN_ORDER[(roll + s) % TERRAIN_ORDER.length], dangerLevel: 1 + ((roll * s) % 10) })),
  )

  it.each(cases)('row $roll (seed $seed, $terrain, DL $dangerLevel)', ({ roll, seed, terrain, dangerLevel }) => {
    const { state, hex } = stateForFeature(roll, terrain, seed, dangerLevel)
    const html = renderSite(state, hex)
    expectCleanMarkup(html)

    const site = hex.site
    if (!site) {
      expect(hex.poi?.siteKind).toBe('none')
      return
    }
    switch (site.kind) {
      case 'dungeon':
      case 'tower':
      case 'keep':
        expect(html).toContain('<svg')
        for (const room of site.rooms) expect(count(html, `data-room-id="${room.id}"`)).toBeGreaterThanOrEqual(1)
        break
      case 'settlement':
        expect(html).toContain('<svg')
        for (const d of site.districts) expect(count(html, `data-district-id="${d.id}"`)).toBeGreaterThanOrEqual(2)
        break
      case 'camp':
        expect(html).toContain('<svg')
        for (const id of ['central', ...site.peripheralFeatures.map((f) => f.id)]) {
          expect(count(html, `data-feature-id="${id}"`)).toBeGreaterThanOrEqual(2)
        }
        break
      case 'shrine':
      case 'rift':
        // No map for these kinds — just make sure the view rendered real content.
        expect(html.length).toBeGreaterThan(200)
        break
    }
  })

  it('a hex with no point of interest renders the wilderness view', () => {
    const hex: Hex = { id: HEX_ID, q: 0, r: 0, terrain: 'Forest/jungle', danger: 'Safe', dangerLevel: 1 }
    const html = renderSite({ hexes: { [HEX_ID]: hex }, partyHexId: HEX_ID, selectedHexId: HEX_ID, worldSeed: 1 }, hex)
    expectCleanMarkup(html)
    expect(html).not.toContain('<svg')
  })
})

describe('overland map', () => {
  function walkedMap(steps: number): MapState {
    const rng = seededRng(42)
    let state = mapReducer(EMPTY_MAP_STATE, { type: 'START_MAP', terrain: 'Grassland', rng })
    for (let q = 1; q <= steps; q++) state = mapReducer(state, { type: 'MOVE_PARTY_TO', hexId: `${q},0`, rng })
    state = mapReducer(state, { type: 'MOVE_PARTY_TO', hexId: `${steps},1`, rng })
    return state
  }

  function renderMap(state: MapState): string {
    return renderToString(
      <MemoryRouter>
        <MapProvider initialState={state} persist={false}>
          <HexGridSvg />
        </MapProvider>
      </MemoryRouter>,
    )
  }

  it('draws one tile per revealed hex plus its unrevealed frontier', () => {
    const state = walkedMap(12)
    const html = renderMap(state)
    expectCleanMarkup(html)
    const revealed = Object.values(state.hexes).map(({ q, r }) => ({ q, r }))
    expect(count(html, 'data-hex-id=')).toBe(computeVisibleCoords(revealed).length)
    for (const id of Object.keys(state.hexes)) expect(html).toContain(`data-hex-id="${id}"`)
  })

  it('draws rivers as lines (one per entry, or one for a spring) and lakes as ovals', () => {
    // Hand-placed water: 0,0 springs and exits south-east into 1,0; 1,-1 springs and exits south
    // into 1,0; 1,0 is fed by both and exits south; 2,0 has a lake.
    const hex = (id: string, q: number, r: number, extra: Partial<Hex> = {}): Hex => ({ id, q, r, terrain: 'Grassland', danger: 'Safe', dangerLevel: 1, ...extra })
    const hexes: MapState['hexes'] = {
      '0,0': hex('0,0', 0, 0, { river: { exit: 0 } }),
      '1,-1': hex('1,-1', 1, -1, { river: { exit: 5 }, terrain: 'Hills' }),
      '1,0': hex('1,0', 1, 0, { river: { exit: 5 } }),
      '2,0': hex('2,0', 2, 0, { lake: true }),
    }
    const html = renderMap({ hexes, partyHexId: '0,0', selectedHexId: '0,0', worldSeed: 1 })
    expectCleanMarkup(html)
    expect(count(html, 'data-river=')).toBe(1 + 1 + 2)
    expect(count(html, 'data-lake=')).toBe(1)
  })

  it('a Swamp revealed before a river reached it draws the inflow, and its info page mentions it', () => {
    // Reveal the Swamp first, then a neighbor whose river exits into it: the Swamp has no river
    // record of its own (revealed hexes don't change), but still receives the water.
    const rng = seededRng(7)
    let state = mapReducer(EMPTY_MAP_STATE, { type: 'START_MAP', terrain: 'Swamp', rng })
    state = mapReducer(state, { type: 'MOVE_PARTY_TO', hexId: '0,-1', rng })
    expect(state.hexes['0,0'].river).toBeUndefined()
    state = { ...state, hexes: { ...state.hexes, '0,-1': { ...state.hexes['0,-1'], terrain: 'Hills', river: { exit: 5 } } } }
    const html = renderMap(state)
    expectCleanMarkup(html)
    expect(count(html, 'data-river=')).toBe(2)
    // (poi stripped: a site would generate in an effect, which a static render doesn't run.)
    const swamp = { ...state.hexes['0,0'], poi: undefined }
    const info = renderSite({ ...state, hexes: { ...state.hexes, '0,0': swamp } }, swamp)
    expect(info).toContain('enters from the north, ends here')
  })
})

describe('settlement maps with rivers (punch-list 1b)', () => {
  // A Town (row 170) on a dry-world hex with real river data: the river's edges come from the
  // hex's own exit and the neighbours' exits, through waterForMapHex, like in the app.
  const DRY_SEED = pickWorldSeedForStart('Grassland', seededRng(1))
  function riverTown(label: string, exit: HexDirection | null, feeders: HexDirection[], ownRecord = true): { state: MapState; hex: Hex } {
    const rng = seededRng(11)
    const poi = pointOfInterestForFeatureRoll('Grassland', 170, rng)
    const site = generateSiteForHex(poi, rng, 2)
    const hex: Hex = { id: HEX_ID, q: 0, r: 0, terrain: ownRecord ? 'Grassland' : 'Swamp', danger: 'Risky', dangerLevel: 2, poi, site, ...(ownRecord ? { river: { exit } } : {}) }
    const hexes: MapState['hexes'] = { [HEX_ID]: hex }
    for (const d of feeders) {
      const c = neighborInDirection({ q: 0, r: 0 }, d)
      hexes[hexId(c)] = { id: hexId(c), q: c.q, r: c.r, terrain: 'Hills', danger: 'Safe', dangerLevel: 2, river: { exit: oppositeDirection(d) } }
    }
    expect(label).toBeTruthy()
    return { state: { hexes, partyHexId: HEX_ID, selectedHexId: HEX_ID, worldSeed: DRY_SEED }, hex }
  }

  const cases: [string, HexDirection | null, HexDirection[], boolean][] = [
    ['through, straight (N → S)', 5, [2], true],
    ['through, 60° bend (N → NE)', 1, [2], true],
    ['through, 120° bend (N → SE)', 0, [2], true],
    ['spring (→ S)', 5, [], true],
    ['ending (N →)', null, [2], true],
    ['inflow-only Swamp with no record (N →)', null, [2], false],
    ['two entries (N, NW → SE) — degenerate', 0, [2, 3], true],
    ['dead-end spring (no edges) — degenerate', null, [], true],
  ]

  it.each(cases)('%s renders a clean map with river arms and bridges', (label, exit, feeders, ownRecord) => {
    const { state, hex } = riverTown(label, exit, feeders, ownRecord)
    const html = renderSite(state, hex)
    expectCleanMarkup(html)
    expect(html).toContain('data-river-arms=')
    expect(count(html, '<polyline')).toBeGreaterThanOrEqual(2)
    expect(html).toMatch(/river (from|rising)/)
    if (exit === null && feeders.length) expect(html).toContain('ending in town')
    if (feeders.length === 0) expect(html).toContain('river rising in town')
    for (const d of hex.site?.kind === 'settlement' ? hex.site.districts : []) expect(count(html, `data-district-id="${d.id}"`)).toBeGreaterThanOrEqual(2)
  })

  it('a coast-only town and a no-water Coast hex still render as before (no river markup)', () => {
    const coastSeed = pickWorldSeedForStart('Coast', seededRng(3))
    const { state, hex } = stateForFeature(170, 'Coast', 2, 2)
    const coastal = renderSite({ ...state, worldSeed: coastSeed }, hex)
    expectCleanMarkup(coastal)
    expect(coastal).toContain('coast, sea to the')
    expect(coastal).not.toContain('data-river-arms')
    const dry = renderSite({ ...state, worldSeed: DRY_SEED }, hex)
    expectCleanMarkup(dry)
    expect(dry).not.toContain('coast, sea')
    expect(dry).not.toContain('data-river-arms')
  })
})

describe('hex info lines for rivers, lakes and sites at sea', () => {
  it('describes the river\'s course and a lake', () => {
    const here: Hex = { id: HEX_ID, q: 0, r: 0, terrain: 'Grassland', danger: 'Safe', dangerLevel: 1, river: { exit: 5 }, lake: true }
    const north: Hex = { id: '0,-1', q: 0, r: -1, terrain: 'Hills', danger: 'Safe', dangerLevel: 1, river: { exit: 5 } }
    const html = renderSite({ hexes: { [HEX_ID]: here, [north.id]: north }, partyHexId: HEX_ID, selectedHexId: HEX_ID, worldSeed: 1 }, here)
    expectCleanMarkup(html)
    expect(html).toContain('enters from the north, leaves to the south')
    expect(html).toContain('a lake lies in this hex')
    const spring: Hex = { ...here, river: { exit: null }, lake: undefined }
    expect(renderSite({ hexes: { [HEX_ID]: spring }, partyHexId: HEX_ID, selectedHexId: HEX_ID, worldSeed: 1 }, spring)).toContain('rises here, ends here')
  })

  it('a site on an Ocean hex says whether it sits on a small island or underwater', () => {
    const expectations: [number, string][] = [
      [150, 'On a small island'], // Village
      [2, 'On a small island'], // Tower
      [25, 'On a small island'], // Tomb
      [88, 'Underwater: sunken ruins'], // Ruins
    ]
    for (const [roll, text] of expectations) {
      const { state, hex } = stateForFeature(roll, 'Ocean', 4, 2)
      const html = renderSite(state, hex)
      expectCleanMarkup(html)
      expect(html).toContain(text)
    }
    // Not on land, and not for flavor-only rows.
    const { state, hex } = stateForFeature(150, 'Grassland', 4, 2)
    expect(renderSite(state, hex)).not.toContain('small island')
    const flavor = stateForFeature(1, 'Ocean', 4, 2)
    expect(flavor.hex.poi?.siteKind).toBe('none')
    expect(renderSite(flavor.state, flavor.hex)).not.toContain('small island')
  })
})

describe('routes', () => {
  function memoryStorage(initial: Record<string, string> = {}) {
    const data = new Map(Object.entries(initial))
    return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) }
  }

  function renderRoute(path: string): string {
    return renderToString(
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>,
    )
  }

  it('/ with no save shows the start screen', () => {
    vi.stubGlobal('localStorage', memoryStorage())
    const html = renderRoute('/')
    expect(html).toContain('start-screen')
    expect(html).not.toContain('data-hex-id')
  })

  it('/ with a save loads it and draws the overland map', () => {
    const { state } = stateForFeature(31, 'Grassland', 7, 2)
    vi.stubGlobal('localStorage', memoryStorage({ 'osr-hex-crawl:map': JSON.stringify(state) }))
    const html = renderRoute('/')
    expectCleanMarkup(html)
    expect(html).toContain(`data-hex-id="${HEX_ID}"`)
  })

  it('/hex/:id renders a saved hex\'s site, and a missing hex says so', () => {
    const { state, hex } = stateForFeature(150, 'Grassland', 3, 2) // 150 = Village
    expect(hex.site?.kind).toBe('settlement')
    vi.stubGlobal('localStorage', memoryStorage({ 'osr-hex-crawl:map': JSON.stringify(state) }))
    const html = renderRoute(`/hex/${HEX_ID}`)
    expectCleanMarkup(html)
    expect(html).toContain('data-district-id=')
    expect(renderRoute('/hex/9,9')).toContain('Hex not found')
  })

  it('/poi/:n renders the review controls, and rejects an out-of-range roll', () => {
    vi.stubGlobal('localStorage', memoryStorage())
    // The site itself is generated in an effect, which a static render doesn't run.
    expect(renderRoute('/poi/25')).toContain('Roll <!-- -->25<!-- --> of <!-- -->200')
    expect(renderRoute('/poi/0')).toContain('Invalid roll')
    expect(renderRoute('/poi/abc')).toContain('Invalid roll')
  })
})

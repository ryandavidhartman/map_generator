# Hex Zoom-In: Sites, Settlements, Encounters & Multi-Campaign Mongo Persistence

> **Durable copy.** This is a copy of the working plan originally saved to
> `~/.claude/plans/bright-watching-wolf.md` (a local, non-git-tracked path —
> plan files there don't survive a fresh clone or a different machine).
> Copied into the repo so it travels with `git clone`/`git pull` instead of
> depending on local Claude Code state. See `CLAUDE.md` for current status;
> update both when this plan changes.
>
> **Implementation note:** the "UI / navigation" section below sketches the
> *original* routing design (`/campaigns/new`, `/campaigns/:campaignId`,
> `/campaigns/:campaignId/hex/:hexId`, a `CampaignListPage`/`CampaignMapPage`
> split) written before Phase 2 was built. What actually shipped in Phase 2
> is simpler: just `/` (overland map) and `/hex/:hexId` (full view) — no
> campaign routing yet, since that's genuinely Phase 9 (Mongo, renumbered
> after the real-maps/population phases were inserted — see Phasing below)
> work. Treat the original routes sketch as directional intent for Phase 9,
> not as something already in the codebase.

## Context

The hex-crawl generator currently does one thing well: overland map generation, one hex at a time, persisted to a single browser-localStorage slot. The user wants the natural next layer: click into any revealed hex to see a dedicated "full view" for it, where a Point of Interest hex generates either a settlement (districts, taverns, shops) or a dungeon site (rooms, contents, objective room) using the corresponding Shadowdark book tables, laid out on a small procedurally-shaped grid. Any revealed hex should also support rolling a random encounter from its terrain's table. Because each overland map now represents an ongoing campaign for a specific party, and a GM will run multiple campaigns over time, this needs upgrading from single-slot localStorage to a real multi-campaign store — a small Node/Express + MongoDB backend.

**Update:** Phases 1-4 below are done and browser-verified. Before starting the Mongo persistence work, the user raised requirements and set the build order across two rounds:
- Round 1: support arbitrary-size hex maps (today's map is bounded to a fixed `radius` chosen at start) — sequenced *before* Mongo so the campaign schema never has to carry, then later drop, a `radius` field. Done (Phase 4).
- Round 2 (2026-07-04): the dungeon/settlement generators need to produce **real, detailed maps** (not the abstract grid-blob cell layout used today) and **populate them with actual generated monster/NPC entities**, not just book-table flavor text. This is confirmed firm scope, not speculative polish. A sibling Scala project this user also maintains, `~/dev/source/shadowdark-rest`, already implements this at a much higher fidelity (BSP-style dungeon room layouts, Voronoi-district organic settlements with smoothed boundaries and curved road networks, NPC population wired to settlement POIs) — the intent is to reuse those *algorithms/data-model ideas* (not literal code; different language/stack) rather than design from scratch. This split into four new phases (dungeon maps, dungeon population, settlement maps, settlement population), all sequenced *before* Mongo for the same schema-stability reason as arbitrary-size maps — see the four new phase sections below. Scope explicitly confirmed as dungeons + settlements only for now (not overland random encounters). Neighbor-weighted terrain generation (Ocean coherence) stays *after* Mongo, unchanged from Round 1's reasoning, since it's a self-contained `generateHex.ts` change with no schema implications.

See the "Real dungeon maps", "Dungeon monster/NPC population", "Real settlement maps", "Settlement NPC population", "Arbitrary-size hex maps", and "Neighbor-weighted terrain generation" sections and the updated Phasing list below.

All book tables for this work (Shadowdark Maps p.130-131, Overland Hex Maps p.132-133 [already implemented], Settlement Maps p.134-139, and the full Random Encounters appendix p.142-185) were read directly from the user's PDF earlier in this conversation — the raw table text is already in context and does not require re-reading the PDF during implementation.

Confirmed product decisions (from conversation):
- Party movement stays overland-only (unchanged `MOVE_PARTY_TO` adjacency rule).
- Clicking any **revealed** hex now navigates to a dedicated full-view screen (replacing the current `SELECT_HEX` → sidebar behavior). Clicking an unrevealed-but-revealable hex is unchanged.
- The dice-drop-on-paper mechanic becomes a **blob/footprint grid layout**: rooms/districts placed via random-walk clustering on an abstract square grid, rendered as adjacent filled cells (the cell cluster itself *is* the visual shape — no separate outline/hull math).
- MongoDB backend supports full multi-campaign save/load/list/delete, with generated site/settlement content nested inside each campaign's map document.
- Random encounter rolling is a standalone action on any revealed hex (terrain-based) and on any settlement district (district-based).

Two mechanical points from the book that correct assumptions floated during planning — verified directly against the transcribed pages, not left as open questions:
1. **Site Type and Settlement Type are independently, freshly rolled at generation time — never derived from the overland POI's `location` text.** Page 130 ("Shadowdark Maps") and page 134 ("Settlement Maps") both present Site Size/Type and Settlement Type as standalone d6 rolls with zero cross-reference to the overland Points of Interest table. The POI's `location`/`development` text is shown as flavor context only. This eliminates any need for a `POI_LOCATION_TO_SITE_TYPE` mapping table.
2. **Room/district count is the literal number of dice, never a sum.** "Small = 5d10" means 5 rooms (one die per room); "Village = 3d4" means 3 districts (one die per district) — not "roll 5d10 and sum them." Each individual die's face value is *also* that room/district's type-table index directly (same physical die serves both placement and type, per the book's own wording: "note the number on each die to determine the type of room/district it is"). This matters for settlements specifically: Village/Town use d4 dice (so district type can only ever land in indices 1-4: Slums/Low/Artisan/Market), City uses d6 (indices 1-6, reaching up to Temple District but never University or Castle), and only Metropolis uses d8 (full range, including Castle). This tiering must be preserved exactly — it's intentional RAW, not a bug to "fix" later.

## Data layer

New files alongside `src/data/tables.ts` (same one-file-per-book-section precedent, plain `Record`/array constants + pure lookup functions, no classes, no side effects):

- **`src/data/dungeonTables.ts`** — Site Size d6 (`{size, roomCount}` for Small=5/Medium=8/Large=12), Site Type d6 (Cave/Tomb/Deep tunnels/Ruins — fresh roll, see correction above, no POI mapping), Room Type d10 (10 entries) + per-type detail sub-tables (Trap/Minor Hazard/Major Hazard/Solo Monster/Monster Mob/NPC/Treasure/Boss Monster — some are two-column "roll twice" tables per the book, e.g. Trap has a Detail+Detail d6 pair), dungeon Danger Level d6.
- **`src/data/settlementTables.ts`** — Settlement Type d6 → `{type, diceCount, diceSides}` (Village 3/d4, Town 4/d4, City 6/d6, Metropolis 8/d8 — one dice spec per tier, no separate "count" vs "type die" fields), District Type lookup (indexed 1..diceSides against the 8-entry Districts table), per-district POI tables (×8, one per district type), Alignment d6, Taverns (size tiers, name generator, food/drink tables), Shops (poor/standard/wealthy + generator + interesting customer).
- **`src/data/encounterTables.ts`** — 20 d100 tables (~100 entries each) as a single `Record<EncounterTableKey, string[]>` plus `TERRAIN_TO_ENCOUNTER_KEYS` (handles the two-terrain-per-key cases: Desert/arctic, Forest/jungle) and `DISTRICT_TYPE_TO_ENCOUNTER_KEY` (clean 1:1). Kept as one file since it's flat data with a single lookup function — split later only if review finds it unwieldy.

Sub-table dispatch follows the existing `rollPointOfInterest` precedent exactly: table files expose pure `roll -> result` lookups only; the **engine** (not the table file) decides when to roll an inner die and which table to consult next.

## Generation engine

New files under `src/engine/`, each pure and `Rng`-injectable like `generateHex.ts`:

- **`src/engine/gridLayout.ts`** — `generateGridLayout(count, rng, options?)`: place item 0 at `{row:0,col:0}`; for each subsequent item, pick a random already-placed anchor, place into one of its free orthogonal neighbors (random choice among available); if none free, retry a different anchor (bounded attempts), falling back to nearest-free-cell BFS to guarantee termination/connectivity. Returns `GridPlacement[] = {cell, parentIndex}[]`. Orthogonal-only by default (clean rectilinear look); this one shared function drives both dungeon rooms and settlement districts.
- **`src/engine/generateDungeon.ts`** — `generateDungeonSite(poi, rng, overrideSiteType?)`: roll size (d6) → roll type (d6, or use override) → roll danger (d6) → `generateGridLayout(roomCount, rng)` → per room roll Room Type (d10) + contingent detail → mark the single highest-rolling room `isObjectiveRoom` (first occurrence wins ties).
- **`src/engine/generateSettlement.ts`** — `generateSettlement(poi, rng, overrideSettlementType?)`: roll settlement type (d6, or override) → look up its dice spec → `generateGridLayout(diceCount, rng)` → per district roll type (1..diceSides, direct index — no separate count/type rolls) + alignment (d6) + POI count (1d4) + that many POI rolls against the district's own table → mark highest-rolling district `isSeatOfGovernment`.
- **`src/engine/generateTavern.ts`, `generateShop.ts`** — ephemeral, re-rollable generators (ATT: not persisted onto a District — only site/settlement generation itself needs to be idempotent).
- **`src/engine/rollEncounter.ts`** — `rollEncounter(key, rng)`.
- **`src/engine/generateSite.ts`** — dispatcher: `generateSiteForHex(poi, rng)` checks `SETTLEMENT_LOCATIONS.includes(poi.location)` (reusing the existing constant from `tables.ts`) to route to `generateSettlement` vs `generateDungeonSite`.

## State management

`Hex` gains an optional `site?: GeneratedSite` (discriminated union `DungeonSite | Settlement`, tagged by `kind`). New `MapAction` variants:

```ts
| { type: 'GENERATE_SITE'; hexId: string; rng?: Rng }   // idempotent: no-op if hex.site already set
| { type: 'REROLL_SITE'; hexId: string; rng?: Rng }       // unconditional regenerate
```

`GENERATE_SITE` auto-dispatches on first mount of a POI hex's full view; `REROLL_SITE` is an explicit button, mirroring the existing `REROLL_HEX` convention.

**Reducer fix required on existing actions** (staleness guard): `REROLL_HEX` and `EDIT_HEX` (when the patch touches `poi`) must clear `site: undefined`, since a generated site is derived from a specific `poi` — needs new regression tests in `mapReducer.test.ts`.

Campaign identity (id/name/timestamps) is added as a **wrapper type**, not new `MapState` fields — keeps the reducer purely about game rules:

```ts
// src/state/campaign.ts (new)
export type CampaignMeta = { id: string; name: string; createdAt: string; updatedAt: string }
export type Campaign = CampaignMeta & { map: MapState }
```

## UI / navigation

Add `react-router-dom`. Justified because campaign ids now exist regardless (needed for Mongo) — encoding them in the URL is nearly free and buys real value (deep links to a specific hex's dungeon, correct back/forward, refresh-safe). Routes:

```
/                                     CampaignListPage   (landing: list/open/new/delete campaigns)
/campaigns/new                        CampaignMapPage     (today's StartMapDialog flow, unsaved until Save)
/campaigns/:campaignId                 CampaignMapPage     (loads from API, renders overland map)
/campaigns/:campaignId/hex/:hexId      HexDetailPage        (full view)
```

**`HexDetailsPanel.tsx` is retired.** Its Move/Reroll/Edit responsibilities move into a shared `HexBaseInfo` component used by all three full-view variants — there is no longer a persistent sidebar on the map screen, since clicking a hex now navigates away instead of just selecting it. This directly follows from "full view would be better" than an expanded panel.

New components:
- `src/routes/CampaignListPage.tsx`, `CampaignMapPage.tsx`, `HexDetailPage.tsx`
- `src/components/hexdetail/HexBaseInfo.tsx` (id/terrain/danger, move/reroll/edit, `EncounterRoller`), `WildernessView.tsx` (no-POI case), `DungeonSiteView.tsx`, `SettlementView.tsx`
- `src/components/EncounterRoller.tsx` — local-only, no dispatch, dropdown when a terrain maps to 2 tables (Desert/arctic, Forest/jungle)
- `src/hexgrid/GridLayoutSvg.tsx` — parallel to `HexGridSvg.tsx`: renders `{cell, colorKey, label, parentId}[]` as adjacent `<rect>`s (cell adjacency *is* the shape) plus corridor `<line>`s between parent/child; `data-room-id`/`data-district-id` attributes for Playwright targeting, matching the existing `data-hex-id` convention.

**Click behavior change** in `HexGridSvg.tsx` (confirmed low-risk — read directly, lines 116-122): the `if (hex) dispatch({type:'SELECT_HEX', ...})` branch becomes `if (hex) navigate(...)`; the `MOVE_PARTY_TO` branch for revealable-but-unrevealed hexes is untouched.

## Backend for MongoDB

```
server/
  src/index.ts            Express bootstrap (cors, json body-parser), mounts /api/campaigns
  src/db.ts                 MongoClient singleton
  src/routes/campaigns.ts    5 REST endpoints below
  src/types.ts               type-only relative imports of MapState/Hex/GeneratedSite from ../../src/state/*
  package.json                own deps: express, mongodb, cors, dotenv; dev: tsx, typescript
  .env.example / .env (gitignored)   MONGODB_URI, MONGODB_DB, PORT
```

Separate `server/package.json` (not folded into root) keeps `express`/`mongodb` out of the Vite-bundled client's dependency graph. Use the official `mongodb` driver, not Mongoose — no cross-document references exist (sites are embedded, not linked), so Mongoose's schema/population features add nothing here.

Routes:
```
GET    /api/campaigns          -> CampaignSummary[] (id, name, timestamps, hexCount — no nested hexes; no `radius`, dropped in the arbitrary-size-maps phase)
GET    /api/campaigns/:id       -> Campaign (full nested map) | 404
POST   /api/campaigns           body:{name, map}       -> 201 Campaign  (save-as-new)
PUT    /api/campaigns/:id       body:{name?, map}       -> 200 Campaign  (save existing, bumps updatedAt)
DELETE /api/campaigns/:id        -> 204 | 404
```

Dev tooling: root adds `concurrently`; `npm run dev` runs `vite` + `server`'s `tsx watch` together; `vite.config.ts` gets `server.proxy: {'/api': 'http://localhost:4000'}` so the frontend can `fetch('/api/...')` with no CORS config in dev.

Frontend: new `src/persistence/api.ts` (`listCampaigns`, `loadCampaign`, `createCampaign`, `updateCampaign`, `deleteCampaign`). `src/persistence/localStorage.ts` is kept as a fast local draft cache (crash recovery for "current campaign in progress"), no longer the source of truth. `MapProvider` takes an optional `initialState` prop so `CampaignMapPage` can inject an API-loaded campaign; `/campaigns/new` passes none (today's exact flow, unsaved until the user hits Save). UI: explicit "Save" button in `Toolbar` (dirty indicator, last-saved time, visible error on failure) **plus** a debounced (~30s) autosave safety net — network writes need visible feedback that silent-only debounce can't give, but an explicit-only save risks losing a forgetful GM's session.

## Testing

New Vitest files mirroring existing conventions (scripted/seeded `Rng`, never real `Math.random()`):
- `gridLayout.test.ts` — no-overlap, full-connectivity (every node's parent chain reaches index 0), correct count, across sizes 0-64.
- `dungeonTables.test.ts`, `settlementTables.test.ts` — `it.each` over full table ranges; **explicit regression test that Village/Town (d4 dice) can never produce a district-type index above 4** — the single most important invariant in this feature, since it's easy to "fix" by accident later.
- `encounterTables.test.ts` — structural (each of 20 keys has exactly 100 entries, out-of-range throws) rather than content-exhaustive.
- `generateDungeon.test.ts`, `generateSettlement.test.ts` — exact scripted-roll assertions including objective-room / seat-of-government tie-break behavior.
- `mapReducer.test.ts` (extended) — `GENERATE_SITE`/`REROLL_SITE` behavior + the new staleness-clearing regression tests on `REROLL_HEX`/`EDIT_HEX`.

Real-browser Playwright verification required (per this project's documented history of 3 bugs that passed typecheck/build but broke visually — pointer capture, passive-wheel preventDefault, indefinite flex height): new `GridLayoutSvg` rendering/sizing, router back/forward + hard-refresh-on-deep-link behavior, and async campaign-load UX (no flash-of-empty-state under StrictMode's double-invoked effects).

## Phasing

1. ✅ **Data + engine + unit tests, no UI.** All new `data/`/`engine/` files above, full Vitest coverage. Zero risk to the currently-working app; `npm run test` / `npx tsc -b` green is the stopping point. — Done.
2. ✅ **Hex full-view UI + navigation, local generation only, no Mongo.** Router, new routes/components, reducer changes, retire `HexDetailsPanel`. Playwright pass. Stopping point: fully playable single-campaign app, generation works, persistence still localStorage-only. — Done.
3. ✅ **Random encounters wiring** — mostly delivered by phase 2's `EncounterRoller`; this phase adds the settlement-district-level rolling + Tavern/Shop generator buttons. — Substantially done as part of phase 2.
4. ✅ **Arbitrary-size hex maps** — inserted here, before Mongo, specifically so the persisted campaign schema never has to carry (and later migrate away) a `radius` field. See "Arbitrary-size hex maps" section below for the design. — Done: `radius` removed from `MapState`/`START_MAP`/`StartMapDialog`; `hexMath.ts`'s `computeVisibleCoords` replaces `hexesInRadius`/`isWithinRadius` (both deleted as dead code); `isRevealableNow`/`MOVE_PARTY_TO` now only check party-adjacency. Browser-verified via Playwright (walked 4 hexes out with no refusal, confirmed frontier de-duplication, no `radius` key persisted, zero console errors) plus unit tests in `hexMath.test.ts`/`mapReducer.test.ts`.
5. **Real dungeon maps** — BSP-style room layout (variable-sized rooms tiling a coherent, non-rectangular floor plan) replacing today's uniform grid-blob dungeon cells. No new dependency. See "Real dungeon maps" section below. Not started, design not yet fully specified.
6. **Dungeon monster/NPC population** — new Monster table (transcribed from the book) + lightweight NPC generator, wired into the existing "Solo Monster"/"Monster Mob"/"NPC" room-content rolls so they produce real entities instead of flavor text. See "Dungeon monster/NPC population" section below. Not started, design not yet fully specified.
7. **Real settlement maps** — Voronoi districts, organic unioned/smoothed town boundary, curved road network, replacing today's uniform grid-blob settlement districts. Requires a new geometry-library dependency (Voronoi + polygon boolean/buffer/simplify) — first such dependency in this project. See "Real settlement maps" section below. Not started, design not yet fully specified.
8. **Settlement NPC population** — reuses phase 6's Monster/NPC engine to populate district POIs with named NPCs. See "Settlement NPC population" section below. Not started, design not yet fully specified.
9. **Mongo backend + multi-campaign persistence** (renumbered from the original phase 4, then again after phases 5-8 were inserted) — the most novel/riskiest territory, independently verifiable once phases 1-8 already work. `server/` scaffold, routes, dev tooling, `api.ts`, `CampaignListPage`, async `MapProvider`, Save button + autosave, one-time "import current local map as a new campaign" action for the existing single localStorage slot. Not started.
10. **Neighbor-weighted terrain generation (incl. making Ocean generation coherent)** — sequenced last since it's a pure `engine/generateHex.ts` change with zero schema/storage implications either way; no reason to block anything else on it. See "Neighbor-weighted terrain generation" section below. Not started, design not yet fully specified.

## Arbitrary-size hex maps

**Why now, before Mongo:** the current model picks a fixed `radius` at `START_MAP` time and `hexesInRadius(radius)` (in `hexMath.ts`) enumerates the *entire* disk of that radius on every render — including every unrevealed cell — so `HexGridSvg` currently draws thousands of fog cells for a large radius. That can't extend to a truly unbounded map (you can't enumerate infinite hexes), and it's wasteful even at a large-but-still-fixed radius. Doing this before Mongo avoids ever persisting a `radius` field into the campaign schema and then having to migrate it away later.

**Design:** switch from "render every hex within a fixed radius disk" to "render only revealed hexes plus their frontier" — the standard fog-of-war approach for unbounded procedural maps, which scales with the explored area instead of a hypothetical max size.

- `frontierCoords = union(neighborsOf(hex)) for every revealed hex, minus already-revealed coords`. `visibleCoords = revealedCoords ∪ frontierCoords`.
- `src/hexgrid/HexGridSvg.tsx`: replace `hexesInRadius(state.radius)` with `visibleCoords` computed from `state.hexes`. Revealed hexes render as today; frontier hexes adjacent to the *party* keep today's clickable "revealable" style; other frontier hexes (adjacent to some revealed hex, but not the party) get the plain "fog" style — same two visual categories as today, just derived from the explored region's actual shape instead of a bounding disk.
- `computeFitViewBox` (same file): drive the bounding-box fit from `visibleCoords` instead of `hexesInRadius(radius)`.
- `src/state/mapReducer.ts`: drop `radius` from `MapState` and from the `START_MAP` action payload entirely. `isRevealableNow` and the `MOVE_PARTY_TO` case drop their `isWithinRadius` check — the only remaining bound is party-adjacency + not-already-revealed.
- `src/hexgrid/hexMath.ts`: `isWithinRadius`/`hexesInRadius` likely become dead code once the above lands — remove them if nothing else references them (check tests first).
- `src/components/StartMapDialog.tsx`: remove the "Map radius" number input — a new map just starts at hex `(0,0)` with a chosen/rolled terrain, no size to pick up front.
- Tests: `mapReducer.test.ts`'s "MOVE_PARTY_TO refuses a hex beyond the map radius" and the radius-based case in "isRevealableNow" need reworking — a hex should now only ever be refused for non-adjacency, never for radius. Add a test confirming a hex arbitrarily far from the origin is reachable by walking there one adjacent step at a time.
- Playwright verification required per this project's convention — this touches SVG rendering/viewBox fitting, exactly the class of change that broke silently before (see CLAUDE.md's three documented bugs).

## Real dungeon maps

**Confirmed requirement, 2026-07-04 — design not yet finalized, this is a starting sketch.** Sequenced before Mongo (like arbitrary-size hex maps) so the persisted dungeon schema is settled before it's ever written to MongoDB.

**Why:** `generateDungeonSite` (`src/engine/generateDungeon.ts`) currently places rooms via `gridLayout.ts`'s random-walk clustering onto uniform grid cells — deliberately simple per this project's original design, but not a "real" map: every room is the same size, laid out as a tree of unit cells. The user has confirmed this needs to become a real, detailed room layout.

**Design sketch — porting the algorithm (not code; different stack) from the sibling project `~/dev/source/shadowdark-rest`'s `DungeonServer.scala`:**
- Corner-notch footprint: start from a rectangular bounding area, carve one L-shaped notch out of a random corner (4 variants) for a non-rectangular starting outline (their `floorPlanFootprint`, `DungeonServer.scala:157-223`).
- Recursive rectangle splitting (BSP) down to the rolled room count, alternating horizontal/vertical splits by aspect ratio (`splitToTargetCount`/`splitRectOnce`, `~225-279`).
- Occasional hallway-strip carving: a leaf rectangle has a chance to be sliced into `room / hallway / room` (`addHallways`, `~281-327`).
- Corridors connect rectangles whose edges overlap sufficiently, rather than a hand-authored graph (`buildFloorPlanCorridors`, `~1355-1380`).
- Entrance placement: the N rooms nearest the outline boundary become entrance candidates, N scaling with dungeon size (`chooseEntrances`, `~481-489,564-568`).
- No new geometry-library dependency needed — this is pure rectangle-splitting math, no polygon boolean ops.

**Open questions for phase start:**
- Whether BSP replaces `gridLayout.ts` for dungeons entirely, or becomes a second mode selected by site type (shadowdark-rest itself only uses BSP for Tomb/Ruins, keeping an older rejection-placement approach for Cave/Deep tunnels).
- `GridLayoutSvg.tsx` renders uniform grid cells today; real BSP rooms are arbitrary pixel-space rectangles, so dungeons will need a new or substantially reworked SVG renderer separate from the grid-cell model settlements/districts still use (until phase 7 changes settlements too).

## Dungeon monster/NPC population

**Confirmed requirement, 2026-07-04 — design not yet finalized.** Sequenced immediately after "Real dungeon maps," before Mongo.

**Why:** dungeon rooms already roll "Solo Monster"/"Monster Mob"/"NPC" as Room Type content (`src/data/dungeonTables.ts`), but today that only produces book-table flavor text, not an actual generated entity. Confirmed scope: dungeons + settlements only (not overland random encounters).

**Design sketch:**
- New `src/data/monsterTables.ts` — a Monster table transcribed from the Shadowdark book (this project has no monster data today). `shadowdark-rest`'s `Monster.scala`/`MonsterRepository` models one possible record shape, but its *content* should come straight from the book, not be copied from the sibling project's seeded Mongo data.
- A lightweight NPC generator for dungeon "NPC" room content — does not need `shadowdark-rest`'s full Name/Race/Personality/Background character-generation pipeline; scope to what a GM needs at the table (name + a short trait/motivation is likely enough for a dungeon NPC, unlike a full character sheet).
- Wire into `generateDungeon.ts`'s per-room detail rolls so "Solo Monster"/"Monster Mob"/"NPC" room types attach a real generated entity to the room instead of just descriptive text.

## Real settlement maps

**Confirmed requirement, 2026-07-04 — design not yet finalized. The biggest lift of the four new phases; requires this project's first geometry-library dependency.** Sequenced before Mongo.

**Why:** `generateSettlement` (`src/engine/generateSettlement.ts`) lays out districts the same grid-blob way as dungeon rooms today. The user confirmed this needs to become a real, visually organic settlement map, matching the fidelity already built in `shadowdark-rest`'s `SettlementServer.scala` (explicitly chose full Voronoi/organic fidelity over a lighter rectangle-only alternative).

**Design sketch — porting the algorithm (not code) from `SettlementServer.scala`:**
- Voronoi districts: a jittered circular "city mask" boundary (`buildCityMask`, `SettlementServer.scala:506-523`) + Poisson-disc-like rejection-sampled site points inside it (`buildPoints`, `~406-425`) + a Voronoi diagram over those sites (their JTS `VoronoiDiagramBuilder`; `d3-delaunay` is the natural JS/TS equivalent) (`buildVoronoiCells`, `~468-504`).
- Organic outline: union of district cell polygons, buffered outward to smooth concave notches between cells, simplified (Douglas-Peucker), then roughened with per-vertex jitter for a hand-drawn look (`buildSettlementOutline`, `~525-561`).
- Curved organic road network: seat-to-nearest-2 main roads, an angular ring loop among non-seat districts when ≥3 exist, a nearest-neighbor minor road per district (guarantees no isolated district), edges bent into quadratic Beziers for a curved look (`buildRoadEdgesForPoints`/`buildRoadCurvesForPoints`, `~1805-1881`).
- Building footprints: rejection-sampled rectangles biased toward road alignment or plaza radial placement, checked against polygon overlap (`generateBuildingFootprints`, `~609-736`). **Known bug, don't copy verbatim:** capped-attempt rejection sampling with no fallback/relaxation pass silently underfills dense districts (documented in `shadowdark-rest`'s own `AGENTS.md`) — add an explicit fallback/relaxation pass instead of a bare attempt cap.

**Open questions for phase start:**
- New dependency choice: a Voronoi library (`d3-delaunay`) plus polygon boolean/buffer/simplify (`turf.js` and/or `polygon-clipping`) — needs an explicit pick, this project has zero geometry libraries today.
- `GridLayoutSvg.tsx`'s uniform-cell model doesn't fit polygons/curved roads at all; settlements need their own real polygon/path-based SVG renderer, likely superseding `GridLayoutSvg.tsx` for settlements specifically (dungeons may still use a rectangle-based renderer from phase 5 — these can differ).

## Settlement NPC population

**Confirmed requirement, 2026-07-04 — design not yet finalized.** Sequenced immediately after "Real settlement maps," before Mongo.

**Why:** settlement district POIs already exist (`generateSettlement.ts` rolls POIs per district), but like dungeon rooms, they're text-only today. Confirmed scope: dungeons + settlements only (not overland random encounters).

**Design sketch:**
- Reuses the Monster/NPC generation engine built in "Dungeon monster/NPC population," extended with settlement-specific flavor.
- `shadowdark-rest` keys settlement NPC generation off an `NpcQuality` model (`appearance`, `does`, `secret`, weighted `age`/`wealth`) combined with Name/Race/Personality/Background servers, matching Background to POI type by keyword (`SettlementServer.scala`, `NpcQualityRepository`/`NpcQualityServer`). **This specific code was not reviewed in detail during the initial map-generation research pass** (explicitly out of scope for that pass, which focused on map/terrain generation) — do a dedicated review of those files when this phase starts.
- Open scope question for phase start: whether every POI gets an NPC, or only certain POI types (e.g. a shop/tavern gets a named proprietor; a "cairn" or "ravine" POI likely doesn't need one).

## Neighbor-weighted terrain generation

**Design sketch below is more concrete than a placeholder now** (informed by reviewing `shadowdark-rest`'s hex map generator, which already solves an equivalent problem), but still not implemented. Sequenced last (after Mongo) since it's a self-contained change to `engine/generateHex.ts`'s pure functions with no schema/storage implications, so it doesn't need to block or be blocked by anything else.

- The book's actual mechanic (`rollNextTerrain`, the New Hex 2d6 table) only steps relative to the *one* hex the party moved from. The user wants a new hex's terrain to be influenced by *all* of its already-revealed neighbors instead, for a more geographically coherent map. This is a deliberate house-rule layered on top of RAW, not a bug fix — today's predecessor-relative stepping is correct per the book and should probably remain available (e.g. as a fallback when a hex has only one revealed neighbor).
- **Explicit requirement: Ocean must form sensible, contiguous bodies**, not isolated single hexes. Today `Ocean` sits between `River/coast` and `Mountain` in the circular `TERRAIN_ORDER`, so a plain step can drop a lone Ocean hex next to Mountain neighbors with no other water nearby — reads as geographically wrong.
- **Recommended approach, found by reviewing `shadowdark-rest`'s `HexMapServer.scala`** (which independently solves this same problem for its own hex maps):
  1. **Connected-component "keep largest cluster" trim.** Their `trimDisconnectedRivers` + `connectedComponents` (`HexMapServer.scala:412-472`) run a plain BFS/flood-fill over hex adjacency to find all River/coast clusters, keep only the largest, and downgrade every hex not in it back to land. This is a pure graph algorithm (no textures/rendering involved) that ports directly to TypeScript over our existing `neighborsOf` (`src/hexgrid/hexMath.ts`) and mechanically satisfies the contiguity requirement as a post-processing guarantee, regardless of whatever primary weighting logic picks the terrain.
  2. **Adjacency-gated Ocean placement.** Their `nextTerrainStepWithRules`/`allowOcean` (`HexMapServer.scala:271-289,137`) only lets a hex roll Ocean if a neighbor is already Ocean (propagation) or via a small random seed chance — never a bare unweighted step onto Ocean. Prevents most isolated-Ocean cases before they'd even need trimming.
  - **Important scaling caution — do not copy this part:** `shadowdark-rest`'s `nextMap` recomputes connectivity over its *entire* accumulated hex list on every single new hex added (`HexMapServer.scala:182`) — acceptable for their small bounded map bursts, but wrong for this project's now-unbounded map (Phase 4). Any port must scope recomputation to just the connected component touching the newly revealed hex, not the whole revealed set.
  - Lower priority, more general technique also present there: a neighbor-majority "poll all 6 neighbors, pick the plurality axis" pattern (`riverAxisForDirs`, `HexMapServer.scala:363-375`) generalizes to weighting ordinary (non-Ocean) terrain by all revealed neighbors, not just the one predecessor — worth doing but not the load-bearing fix for the Ocean requirement specifically.
  - **Edge-case policy to decide explicitly** (shadowdark-rest oscillated on this without settling it, per its own `AGENTS.md`): what happens when a freshly-revealed region has exactly one isolated water hex and no established coastline yet — strict "always trim" could wipe all water from a region that just hasn't been explored far enough to reveal its neighbors yet. Decide up front whether to special-case "allow exactly one isolated hex until N more neighbors are revealed" or accept the strict rule.

## Verification

- `npm run test` (Vitest) after each phase — new suites listed above must pass alongside existing 58 tests.
- `npx tsc -b` clean after each phase.
- Playwright pass (per CLAUDE.md's existing pattern: `require('playwright').chromium.launch(...)`, target via `data-hex-id`/new `data-room-id`/`data-district-id`) after phases 2, 4, 5, 7, and 9 specifically, since those touch rendering/navigation/async-loading — the categories that have broken silently before in this project. (Phases 2 and 4 already done and verified this way; 5/7/9 are the new dungeon-renderer, settlement-renderer, and Mongo-async-load phases respectively.)
- Phase 9 additionally: manual smoke test of save → reload → same nested site content round-trips correctly through MongoDB (start local `mongod` or point `MONGODB_URI` at an accessible instance).

## Open items to confirm before/while building (lower-stakes, decided pragmatically above but flagged)

- Exact `Trap`/`Monster Mob`/etc. two-column detail sub-tables need care transcribing (some book Room Type detail tables roll a d6 against two parallel "Detail" columns, not a single column) — handle case-by-case from the already-read page text during Phase 1.
- Production hosting/SPA-fallback rule for the router isn't addressed (no deploy target chosen yet) — not a blocker for local dev.
- Client/server TypeScript type sharing via relative type-only imports across the two `tsconfig.json`s should resolve cleanly but hasn't been hands-on verified in this exact repo layout — first thing to confirm in Phase 4, with type duplication as a fallback.

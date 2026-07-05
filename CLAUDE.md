# Shadowdark Hex Crawl Generator

A React web app implementing the overland hex-crawl generation system from
*Shadowdark RPG* (book pp. 132-133 / PDF pp. 136-137 of the "Premium" PDF, a
personal copy owned by the user — not checked into this repo). A GM starts a
map on one hex and clicks into adjacent unrevealed hexes to reveal them one
at a time, rolling dice per the book's tables live: terrain (with a
neighbor-relative "step" mechanic), danger level, and points of interest
(which can chain into a cataclysm or a settlement name roll).

Full design rationale lives in the approved plan this was built from:
`~/.claude/plans/foamy-watching-kernighan.md` (may not survive across
machines/sessions — the summary below is the durable copy).

## Status

Overland hex crawl MVP, plus zoom-in dungeon/settlement generation and
random encounters (the "Sites, Settlements, Encounters & Multi-Campaign
Mongo Persistence" plan — full plan at
`docs/plan-sites-settlements-mongo.md`, checked into the repo so it
survives clones/machines; a working copy also lives at
`~/.claude/plans/bright-watching-wolf.md` but that path is local-only).
All new work verified end-to-end in a real browser
(Playwright driver, zero console errors) as well as unit-tested (160+
Vitest tests). Typecheck and build clean.

Phases 1-2 done: every new book table transcribed (dungeon sites,
settlements/districts/taverns/shops, all 21 random-encounter d100 tables),
the generation engine, the reducer wiring, and the hex full-view UI/routing.
Phase 3 (settlement-district encounters) is substantially delivered as part
of phase 2's UI. Also done: hex tiles distinguish single-click (move party)
from double-click (open full-view details) — see HexTile.tsx below.

**Before Mongo persistence, requirements were added and sequenced in front
of it, across two rounds** (plan updated accordingly):
1. ✅ **Arbitrary-size hex maps — done.** The map no longer has a `radius`;
   `MapState`/`START_MAP` dropped the field entirely. Rendering is now
   frontier-based: `hexMath.ts`'s `computeVisibleCoords(revealedCoords)`
   returns every revealed hex plus every unrevealed hex adjacent to at
   least one revealed hex (de-duplicated), replacing the old
   `hexesInRadius(radius)` full-disk enumeration (`isWithinRadius` and
   `hexesInRadius` were removed as dead code). `isRevealableNow` and
   `MOVE_PARTY_TO` now only check party-adjacency — a hex arbitrarily far
   from the origin is reachable by walking there one adjacent step at a
   time (see the regression test in `mapReducer.test.ts`).
   `HexGridSvg.tsx`'s initial view-fit (`fitViewBox`) is deliberately
   computed once via a lazy `useState` initializer at mount, **not**
   recomputed every time the frontier grows — recomputing per-reveal would
   yank the view back to a full-map fit every time a new hex is revealed,
   fighting a GM who has panned/zoomed to a spot of interest. `coords` (the
   list actually rendered) is still a reactive `useMemo` on `state.hexes`,
   so newly revealed/frontier hexes do appear immediately — only the
   camera fit is frozen at mount. `StartMapDialog` no longer has a "Map
   radius" input; a new map always starts at `(0,0)`. Browser-verified via
   Playwright: walked the party 4 hexes out along one axis with no radius
   refusal, confirmed no `radius` key in the persisted localStorage state,
   confirmed frontier de-duplication (2 revealed hexes sharing neighbors
   render as 10 tiles total, not 12), zero console errors.
2. **(2026-07-04) Real dungeon/settlement maps + monster/NPC population —
   split into four phases, first one done.** Confirmed firm requirement,
   not speculative polish: dungeon rooms and settlement districts used to
   render as abstract uniform grid-blob cells (`src/engine/gridLayout.ts`),
   and their POI/room content is book-table flavor text with no actual
   monster/NPC entity attached. A sibling Scala project this user also
   maintains, `~/dev/source/shadowdark-rest`, already implements this at
   much higher fidelity (BSP-style dungeon room layouts, Voronoi-district
   organic settlements with smoothed boundaries and curved roads, NPC
   population wired to settlement POIs) — intent is to reuse those
   algorithm/data-model ideas (not literal code; different stack) rather
   than design from scratch. Four phases, in order, all sequenced before
   Mongo for the same schema-stability reason as arbitrary-size maps:
   a. ✅ **Real dungeon maps — done.** New `src/engine/dungeonLayout.ts`:
      `generateDungeonLayout(roomCount, rng)` recursively splits a bounding
      rectangle (BSP) into exactly `roomCount` variable-sized leaf
      rectangles (splits the largest-area splittable rect along its longer
      axis; `MIN_ROOM_DIM = 4` enforced by construction, no post-hoc
      validation needed), consuming exactly `roomCount - 1` rng() calls.
      Connectivity is now real geometric adjacency (any two rects sharing a
      boundary segment of positive length are connected — a room can have
      more than one neighbor) rather than the old single-`parentIndex`
      tree; verified fully connected empirically across sizes/seeds in
      `dungeonLayout.test.ts` rather than proven algebraically.
      `generateDungeon.ts`'s `Room` type changed from `{ cell,
      parentRoomId }` to `{ rect }`, and `DungeonSite` gained a top-level
      `connections: [string, string][]`. New `src/hexgrid/DungeonMapSvg.tsx`
      (parallel to `GridLayoutSvg.tsx`, which settlements still use)
      renders the real rectangles + corridor lines; `data-room-id`
      Playwright convention preserved. `gridLayout.ts` itself is untouched
      (settlements still use it until phase (c) below). Deliberately deferred as
      later-if-wanted polish, not required for the core upgrade:
      corner-notch non-rectangular outline, hallway-strip carving, entrance
      markers. No new dependency. Browser-verified via Playwright: an
      8-room dungeon rendered 8 distinct rectangle sizes (proving real
      variable-size rooms) and 14 corridor lines (proving multi-neighbor
      adjacency, not a 7-edge tree); Reroll Site regenerates correctly;
      zero console errors. 9 new tests in `dungeonLayout.test.ts`, all 169
      Vitest tests pass, `npx tsc -b`/`npm run build` clean.
      **Known gap, confirmed after the user reviewed a live screenshot:**
      this is a structural upgrade, not yet a visual one — rooms render as
      flat colored rectangles with corridor lines mostly hidden under
      directly-adjacent rooms; no walls/doors, no grid overlay, no entrance
      markers. User confirmed deferring this rather than blocking phase (b)
      on it — likely bundled with phase (c)'s settlement rendering so both
      get real visual polish together. No schema change needed later:
      `Room.rect`/`DungeonSite.connections` already carry what a richer
      renderer would need.
   b. ✅ **Dungeon monster/NPC population — done.** Scope clarified before
      writing code: name + flavor only, no combat stats (real stat blocks
      are a confirmed **future MongoDB integration**, sequenced after the
      Mongo backend phase, not designed yet). No Shadowdark bestiary was
      available, so — after an initial invented list was rejected — real
      content was sourced from the user's own B/X retro-clone compilation:
      `~/dev/source/b_x/publication/monsters/combined-monsters.md`. New
      `src/data/monsterTables.ts`: `MONSTERS` (148 real creature names +
      source-document category — Animal/Undead/Humanoid/Dragon/Monstrous/
      etc. — category is preserved for a possible future site-type-biased
      selection, not used yet) and `NPC_TYPES` (17 archetypes — Acolyte,
      Bandit, Noble, Trader, Veteran, etc. — from that document's own NPC
      section; its "Men" entry expanded into 5 named sub-types, "NPC
      Parties" excluded as a ruleset rather than a single NPC).
      `generateDungeon.ts`'s `Room` gained `monster?: {name, category}`
      (Solo Monster/Monster Mob/Boss Monster room types) and `npc?:
      {type}` (NPC room type), rolled right after the existing detail
      roll. `DungeonSiteView.tsx` shows `Monster: <name> (<category>)` /
      `NPC: <type>` in the room list. Browser-verified via Playwright: a
      12-room dungeon populated 3 monster rooms and 1 NPC room correctly,
      both label strings render in the DOM, zero console errors. New
      `monsterTables.test.ts` + extended `generateDungeon.test.ts`
      invariants (every monster-type room has `.monster`, every NPC room
      has `.npc`, no other room type has either); all 174 Vitest tests
      pass, `npx tsc -b`/`npm run build` clean.
      **Same-day follow-up fix**, after the user flagged a generated
      dungeon as having "no rhyme or reason" (Boss Monster had attached
      "Cattle"; monster category ignored site type entirely): `MonsterEntry`
      gained a hand-curated `mundane?: boolean` (~25 ordinary Animal-category
      entries like Cattle/Horse/Bull/Wolf/Rat — "Giant"-qualified variants
      are NOT marked mundane, they're legitimate escalated monsters) and
      `rollMonster` gained `{ excludeMundane, siteType }` options.
      `excludeMundane` is wired to Boss Monster only (Solo Monster/Monster
      Mob still allow mundane creatures — a wolf pack is a normal low-stakes
      encounter, just not a final boss). `SITE_TYPE_CATEGORY_WEIGHTS` biases
      (not excludes) category selection per dungeon site type — Cave leans
      Animal/Lost World/Insect, Tomb leans heavily Undead, Deep tunnels
      leans Insect/Monstrous/Humanoid/Giant, Ruins leans
      Construct/Humanoid/Undead/Sylvan-or-Faerie — wired to all three
      monster room types. A third option (reroll to avoid exact-duplicate
      detail text across rooms, e.g. two "Collapsing walls" rooms) was
      **not** selected, deferred — see the plan doc's "Open items" section.
      `monsterTables.test.ts` grew to 9 tests including a 500-sample
      statistical check that Tomb's Undead weighting actually dominates;
      all 178 Vitest tests pass. Browser-verified via Playwright: 0 mundane
      violations across Boss Monster rooms in ~5 generated dungeons, Cave
      dungeons showed the expected Animal/Lost World lean, zero console
      errors.
   c. ✅ **Real settlement maps — done.** New dependencies: `d3-delaunay`
      (Voronoi) + `polygon-clipping` (polygon intersection) — this
      project's first geometry libraries, both verified compatible with
      the Vite 5/Node 20 toolchain via a direct smoke test before
      adopting; `turf.js` turned out unnecessary after a scope
      simplification (see below). Found and worked around a real bug in
      `polygon-clipping@0.15.7`: its `.d.ts` declares named exports but
      the actual ESM bundle only exports a `default` object containing
      them — isolated in new `src/engine/polygonClip.ts` so the rest of
      the app just imports a correctly-typed `intersectPolygons(a, b)`.
      **Scope simplification**: instead of shadowdark-rest's two-step
      "Voronoi cells, then separately union+buffer+simplify them into an
      outline," this project generates the organic jittered boundary
      ("city mask") *first* and clips every Voronoi cell to it directly —
      the mask already IS the organic outline, so no union/buffer pass
      (and thus no `turf.js`) was needed. New `src/engine/settlementLayout.ts`
      (mirrors `dungeonLayout.ts`'s role): `buildCityMask` (20 jittered
      angular samples around a circle, radius scales with
      `sqrt(districtCount)`), `sampleDistrictSites` (Poisson-disc-like
      rejection sampling with a relax-then-fallback bounded retry, same
      shape as `gridLayout.ts`'s anchor-retry), `buildVoronoiDistricts`
      (one Voronoi cell per site, clipped to the mask, largest piece kept
      if clipping ever yields multiple disjoint pieces), `buildRoadEdges`
      (pure function of site positions — seat-to-2-nearest main roads,
      angular ring loop among non-seat sites when ≥3 exist, every site
      gets a nearest-neighbor minor road so nothing is isolated).
      `generateSettlement.ts`'s `District.cell`/`parentDistrictId` became
      `District.site`/`polygon`; `Settlement` gained `mask` and `roads`
      (district-id pairs, mirroring `DungeonSite.connections`). New
      `src/hexgrid/SettlementMapSvg.tsx` (parallel to `DungeonMapSvg.tsx`)
      renders real polygons + curved roads (SVG native quadratic-Bezier
      `<path>`, no curve library needed — just one computed control point
      per edge). `GridLayoutSvg.tsx` is now settlement-districts-free,
      dungeons/districts each have their own dedicated renderer.
      **Deliberately deferred**, matching phase 5's precedent: building
      footprints/plazas — shadowdark-rest's own docs flag its version as
      a buggy, capped-attempt rejection sampler that silently underfills;
      not worth porting as-is, addable later with no schema change.
      New `settlementLayout.test.ts` (11 tests) + `generateSettlement.test.ts`
      rewritten from exact-scripted-rng to seeded+structural (rejection
      sampling has a variable rng call count, same shift `gridLayout.test.ts`
      already established). All 189 Vitest tests pass, `npx tsc
      -b`/`npm run build` clean (bundle ~332KB, ~110KB gzipped). Browser
      + screenshot verified via Playwright: a 4-district Town rendered 4
      real polygons with 4 distinct vertex counts (8/9/10/11, confirming
      genuine Voronoi irregularity) connected by 5 curved roads; a
      6-district city screenshot confirmed an organic non-circular
      boundary with districts tiling it correctly; district
      click-to-expand and Reroll Site both still work; zero console
      errors.
   d. **Settlement NPC population — not started.** Reuses (b)'s Monster/NPC
      engine to populate district POIs with named NPCs.
   Confirmed scope: dungeons + settlements only for now, not overland
   random encounters. Full design detail, file:line citations into
   `shadowdark-rest`, and open questions for each sub-phase are in
   `docs/plan-sites-settlements-mongo.md`.
3. **Mongo backend + multi-campaign persistence — renumbered to phase 9,
   not started.**
4. **Neighbor-weighted terrain generation — not started, still sequenced
   last (after Mongo).** New-hex terrain should be influenced by all
   already-revealed neighbors, not just the single predecessor hex the
   book's RAW stepping table uses. Explicit requirement: Ocean must
   generate as coherent, contiguous bodies, not isolated hexes (today's
   circular `TERRAIN_ORDER` stepping can drop a lone Ocean hex next to
   Mountain with no other water nearby). Reviewing `shadowdark-rest`'s own
   hex map generator surfaced a concrete recommended approach for this
   (connected-component "keep largest cluster" trim + adjacency-gated
   Ocean placement) — see the "Neighbor-weighted terrain generation"
   section of the plan doc for specifics and file:line citations.

Full design detail for all of the above: `docs/plan-sites-settlements-mongo.md`.

## Stack & environment gotchas

- **Node 20.16.0, not 18.** Node 18 can't run any current Vite tooling
  (`create-vite` itself crashes on Node 18 with a `styleText` export error).
  `.nvmrc` pins `20.16.0`. Run `nvm use` (or
  `source ~/.nvm/nvm.sh && nvm use 20.16.0`) before any npm command.
- **Vite 5, deliberately, not Vite 8.** `npm create vite@latest` currently
  scaffolds Vite 8, which defaults to the experimental Rolldown (Rust)
  bundler. Its native binding (`rolldown-binding.linux-x64-gnu.node`) failed
  to load in this environment — build crashed immediately. Downgraded
  `package.json` to the stable Vite 5 / Rollup+esbuild toolchain instead of
  chasing the Rolldown issue. Don't "helpfully" upgrade vite/vitest to the
  8.x/4.x lines without checking this still isn't broken here.
- No linter is configured (oxlint was in the scaffold, removed along with
  its config — wasn't worth setting up for this task).
- `npm install` currently reports moderate/high `esbuild` dev-server-only
  advisories from transitive vite/vitest deps (GHSA-67mh-4wv8-2f99). Known,
  low-risk for local dev, not fixed (fixing means jumping to Vite 6+, which
  reopens the Rolldown risk above — revisit only if actually upgrading Vite).
- **First geometry-library dependencies, added for real settlement maps**:
  `d3-delaunay` (Voronoi) + `polygon-clipping` (polygon intersection) +
  `@types/d3-delaunay` (polygon-clipping ships its own types;
  d3-delaunay doesn't). Both verified ESM-compatible with this Vite
  5/Node 20 toolchain via a direct smoke test before adopting — no new
  `npm audit` advisories beyond the pre-existing esbuild one above.
  **`polygon-clipping@0.15.7` has a real type/runtime mismatch**: its
  `.d.ts` declares named exports, but the actual ESM bundle only exports
  a `default` object containing those functions — `import { intersection
  } from 'polygon-clipping'` typechecks but is `undefined` at runtime.
  Worked around once in `src/engine/polygonClip.ts`; don't import
  `polygon-clipping` directly elsewhere, use that wrapper's
  `intersectPolygons`.

## Architecture

```
src/
  data/tables.ts       Overland hex tables (terrain order + circular
                        stepping, Hex Terrain 2d6, New Hex 2d6, Danger d6,
                        Points of Interest d20, Cataclysm d8, Settlement
                        Name d8x3-column). SETTLEMENT_LOCATIONS here is
                        reused by engine/generateSite.ts's dispatcher.
  data/dungeonTables.ts   Shadowdark Maps (dungeon side): Site Size/Type d6,
                        Room Type d10 + per-type detail sub-tables (some are
                        two-independent-roll "mix and match" columns, e.g.
                        Trap), dungeon Danger Level d6 (no "Safe" outcome —
                        distinct from the overland danger table).
  data/settlementTables.ts  Settlement Type d6 (dice count IS the district
                        count, never summed — see below), District Type,
                        Alignment, 8 per-district POI tables, Taverns, Shops.
  data/encounterTables.ts   All 21 book Random Encounters d100 tables
                        (terrain + settlement district + tavern), transcribed
                        as compact range-tuples expanded to 100-entry arrays.
  data/siteColors.ts    Room-type/district-type color maps (GridLayoutSvg).
  engine/dice.ts        rollDie/roll2d6, RNG injectable for tests.
  engine/generateHex.ts Orchestrates overland table lookups: rollStartingTerrain,
                        rollNextTerrain, rollDangerLevel, rollPointOfInterest
                        (chains into cataclysm/settlement rolls),
                        generateStartingHexDetails, generateNextHexDetails.
  engine/dungeonLayout.ts   generateDungeonLayout(roomCount, rng): BSP-style
                        floor-plan layout — recursively splits a bounding
                        rectangle into exactly roomCount variable-sized leaf
                        rectangles (always splits the largest-area
                        splittable rect along its longer axis; MIN_ROOM_DIM
                        enforced by construction). Connections are real
                        geometric adjacency (shared boundary segment) between
                        leaf rects, not a parent tree — a room can connect to
                        more than one neighbor.
  engine/settlementLayout.ts   buildCityMask/sampleDistrictSites/
                        buildVoronoiDistricts/buildRoadEdges: real Voronoi
                        settlement layout — a jittered organic boundary
                        ("city mask") generated first, district sites
                        rejection-sampled inside it, one Voronoi cell per
                        site clipped directly to the mask (the mask itself
                        IS the organic outline — no separate union/buffer
                        pass needed), roads a pure function of site
                        positions (seat + 2 nearest, angular ring loop,
                        per-site nearest-neighbor). Uses d3-delaunay
                        (Voronoi) + polygon-clipping (mask clipping) — see
                        engine/polygonClip.ts for a real bug workaround in
                        the latter (its .d.ts declares named exports; the
                        actual ESM bundle only has a default export).
                        engine/gridLayout.ts (the old uniform-cell
                        random-walk layout used by both dungeons and
                        settlements) is gone — removed as dead code once
                        both moved to their own dedicated layout engines.
  engine/generateDungeon.ts   generateDungeonSite(rng, overrideSiteType?).
                        Site Type/Size are rolled fresh here, NEVER derived
                        from the originating hex's POI location text (the
                        book treats Shadowdark Maps as fully standalone).
                        Objective/boss room = highest Room Type roll, first
                        occurrence wins ties. Room.rect (from
                        dungeonLayout.ts) + DungeonSite.connections
                        (room-id pairs) drive the real floor-plan rendering.
  engine/generateSettlement.ts   generateSettlement(rng, overrideType?).
                        Same "fresh roll, not POI-derived" rule as dungeons.
                        District count = literal dice count (Village/Town
                        d4, City d6, Metropolis d8) — NEVER summed. This also
                        means Village/Town can only ever roll district types
                        1-4 of 8 (Slums/Low/Artisan/Market), City reaches
                        Temple District but not University/Castle, and only
                        Metropolis reaches the full range. This tiering is
                        intentional RAW — don't "fix" it later.
  engine/generateTavern.ts, generateShop.ts  Ephemeral, re-rollable
                        generators (ATT: not persisted onto a District).
  engine/rollEncounter.ts     rollEncounter(tableKey, rng) — d100 lookup.
  engine/generateSite.ts      generateSiteForHex(poi, rng) dispatcher: routes
                        to generateSettlement vs generateDungeonSite based on
                        SETTLEMENT_LOCATIONS.includes(poi.location).
  hexgrid/hexMath.ts    Axial coords, flat-top layout, neighbors, distance,
                        computeVisibleCoords (frontier-based fog-of-war: revealed
                        hexes + their unrevealed neighbors, no map-size bound),
                        pixel conversion, SVG polygon corners.
  hexgrid/colors.ts     Shared terrain/danger color maps (HexTile + Legend).
  hexgrid/HexTile.tsx   One hex: fill=terrain, stroke=danger, POI/party
                        markers. Single click moves the party (debounced
                        250ms so it can be cancelled by a second click);
                        double click opens the hex's full-view details page.
  hexgrid/HexGridSvg.tsx SVG canvas, hand-rolled drag-to-pan + wheel-to-zoom
                        (viewBox manipulation, no pan/zoom library). Renders
                        computeVisibleCoords(revealed) — unbounded map, no fixed
                        radius disk. Initial view-fit is computed once at mount
                        (lazy useState initializer) and intentionally not
                        recomputed as the frontier grows, so revealing new hexes
                        doesn't yank the camera away from a panned/zoomed view.
  hexgrid/DungeonMapSvg.tsx  Renders a generated dungeon's real BSP room
                        layout: variable-sized pixel-space rectangles
                        (src/engine/dungeonLayout.ts) + corridor lines
                        between geometrically-adjacent rooms (a room can have
                        more than one corridor, not just a single parent
                        edge). data-room-id Playwright convention preserved.
  hexgrid/SettlementMapSvg.tsx  Renders a generated settlement's real Voronoi
                        layout (src/engine/settlementLayout.ts): the jittered
                        mask as a background boundary polygon, each district
                        as its real clipped polygon, roads as SVG native
                        quadratic-Bezier `<path>`s (one computed control
                        point per edge — no curve library needed). Replaced
                        the old hexgrid/GridLayoutSvg.tsx (uniform grid
                        cells), which is gone — removed as dead code once
                        both dungeons and settlements had their own real
                        renderers. data-district-id Playwright convention
                        preserved.
  state/mapReducer.ts   Hex/MapState types, MapAction union, pure reducer.
                        Party occupies one hex; MOVE_PARTY_TO only succeeds
                        into an adjacent hex (no map-size bound — reveals +
                        rolls if new, else just relocates if already revealed).
                        Hex.site (GeneratedSite, settlement|dungeon) is set
                        by GENERATE_SITE (idempotent) / REROLL_SITE
                        (unconditional); REROLL_HEX and EDIT_HEX (when the
                        patch touches poi) clear a stale site.
  state/MapContext.tsx  Context + useReducer provider, lazy-inits from
                        localStorage, persists on every change.
  persistence/localStorage.ts  save/load under key
                        `shadowdark-hex-crawl:map`. Fails silently if
                        localStorage is unavailable. Single-map only — no
                        multi-campaign persistence yet (that's Phase 4).
  components/           StartMapDialog, Toolbar (New Map), Legend,
                        EncounterRoller (terrain/district d100 roll button).
  components/hexdetail/ HexBaseInfo (id/terrain/danger/poi, move/reroll/edit
                        — what HexDetailsPanel used to be, now embedded in
                        every full-view variant instead of a map sidebar),
                        WildernessView (no POI), DungeonSiteView (rooms via
                        GridLayoutSvg + room list + Reroll Site),
                        SettlementView (districts via GridLayoutSvg +
                        expandable district list with POIs/alignment/
                        Tavern+Shop generators + Reroll Site).
  routes/HexDetailPage.tsx  The "/hex/:hexId" route. Auto-dispatches
                        GENERATE_SITE on first visit to a POI hex (idempotent,
                        so revisits are safe), then renders Wilderness/
                        Dungeon/Settlement view based on hex.site.kind.
```

Routing: `react-router-dom` v6, `BrowserRouter` in `main.tsx`. Two routes
today: `/` (overland map) and `/hex/:hexId` (full view). Clicking a revealed
hex on the overland map used to open a sidebar (`SELECT_HEX`) — it now
double-click-navigates instead (see HexTile.tsx above); the old
`HexDetailsPanel.tsx` sidebar component was deleted, its content lives in
`HexBaseInfo.tsx`.

Key design choices worth knowing before changing behavior:
- Starting hex rolls danger + POI the same as any other hex — the book
  doesn't specify this explicitly, but treating it uniformly avoided a
  special case. Called out as an assumption in the original plan.
- "Reroll" on a hex keeps its terrain and only re-rolls danger + POI
  (rerolling terrain would silently invalidate neighbors that stepped off
  of it — out of scope to handle that cascade).
- Moving to an *already-revealed* adjacent hex just relocates the party
  (no reroll); moving into an *unrevealed* adjacent hex rolls it fresh.
  Both require adjacency — no free teleporting around the revealed map.
- Site generation (dungeon/settlement) is dispatched by whether the hex's
  POI *location* is a settlement name, but once dispatched, Site
  Type/Size and Settlement Type are each rolled fresh and independently —
  never derived from the POI's location/development text. Verified
  directly against the book pages (Shadowdark Maps p.130, Settlement Maps
  p.134 are presented as fully standalone generators with zero
  cross-reference to the overland Points of Interest table).
- A generated `site` is derived from a hex's `poi`, so anything that
  changes `poi` (`REROLL_HEX`, or `EDIT_HEX` when the patch touches `poi`)
  clears the existing `site` as stale rather than leaving mismatched
  content behind. `GENERATE_SITE` is idempotent (no-op if a site already
  exists); `REROLL_SITE` is the explicit unconditional regenerate.

## Two real bugs fixed during browser verification (don't reintroduce)

1. `HexGridSvg` called `svgRef.current?.setPointerCapture(e.pointerId)` on
   pointerdown. In Chromium this silently breaks click delivery to elements
   under the cursor (clicks got redirected to the capturing `<svg>` instead
   of the hex `<g>`) — hex tiles stopped being clickable by real mouse
   users. Fixed by dropping the capture call; drag-panning still works
   fine without it (minor tradeoff: a very fast drag that leaves the SVG
   bounds mid-gesture will stop panning until the pointer re-enters).
2. The wheel-zoom handler called `e.preventDefault()` inside React's
   `onWheel`, which React attaches as a passive listener — the
   preventDefault silently no-ops there. Fixed by attaching a native
   `addEventListener('wheel', handler, { passive: false })` in a
   `useEffect` instead of using JSX `onWheel`.
3. `index.css` had `#root { min-height: 100svh }` (not `height`). Because
   no ancestor in the flex chain had a *definite* height, the map SVG's
   `height: 100%` couldn't resolve and Chromium fell back to sizing the SVG
   from its `viewBox` aspect ratio — inflating the whole page far past the
   viewport and pushing the Legend overlay off-screen below the fold.
   Fixed by giving `html, body { height: 100% }` and `#root { height: 100svh }`
   (definite, not minimum) so the flex chain resolves percentage heights
   correctly.

If touching layout or pointer/wheel handling again, re-run the Playwright
verification pattern (see below) rather than trusting typecheck/build alone
— all three bugs above passed typecheck and build cleanly.

## Commands

```bash
nvm use                  # Node 20.16.0 (nvm alias default is now also set to this, machine-wide)
npm install
npm run dev               # http://localhost:5173
npm run test               # Vitest, 160+ tests
npm run build               # tsc -b && vite build
npx tsc -b                   # typecheck only
```

## Verifying UI changes in a browser

No project-specific run skill exists yet. What worked this session: Playwright
wasn't preinstalled and needed `npx playwright install chromium` (the cached
browser version under `~/.cache/ms-playwright` didn't match the installed
`playwright` npm package's expected build — a fresh `npx playwright install
chromium` fixed it, ~300MB download). The `playwright` npm package itself
isn't a project dependency (only its browser binaries are cached
machine-wide) — a driver script needs `playwright` installed wherever it
runs from (e.g. `npm install playwright` in a scratch dir, then run the
script from there with Node 20).  Drive it with a plain Node script using
`chromium.launch({ args: ['--no-sandbox'] })` — there's no `chromium-cli` in
this environment. Target hexes deterministically via the `data-hex-id="q,r"`
attribute on each hex's `<g>` (added specifically to make this testable) —
click the `<g>`, not the `<polygon>` child, since a hex with a
point-of-interest marker covers the polygon's center with a `<circle>` and
strict actionability checks will refuse to click "through" it (a real user's
click still works fine there via event bubbling). Generated dungeon/settlement
grid cells carry `data-room-id`/`data-district-id` the same way.

**Timing gotcha since the single/double-click split (HexTile.tsx):** a plain
`.click()` on a hex now only dispatches its action after a 250ms debounce (so
a following click can cancel it and fire the double-click action instead) —
`await page.waitForTimeout(300)` (or similar) after `.click()` before
asserting on its effect, or use `.dblclick()` directly for the
navigate-to-details action.

## Not done / possible next steps

Phases 1-2 of the sites/settlements/encounters/Mongo plan, the
arbitrary-size hex maps phase, real dungeon maps (BSP room layout),
dungeon monster/NPC population (name/flavor only, from the user's B/X
compilation), and real settlement maps (Voronoi districts + organic
boundary + curved roads — see Status above) are all built and
browser-verified; nothing there is known-broken or half-finished.
**Visual-fidelity asymmetry worth knowing about**: settlements now render
with real organic geometry and curved roads, while dungeons (built one
phase earlier) still render as flat colored rectangles with barely-visible
corridors — the dungeon visual-polish deferral noted back in phase 5
hasn't been revisited since; worth doing now that settlements demonstrate
a richer visual bar, but not automatically done just because settlements
shipped. Agreed build order for what's left (see Status above and the plan
file for design detail):
1. **Settlement NPC population** (reuses the dungeon phase's Monster/NPC
   engine).
2. **Node/Express + MongoDB backend for multi-campaign persistence.** The
   app still only saves one map to localStorage — no named/listable
   campaigns, no server, no `.env`, nothing. Reuses a shared Atlas cluster
   the user already has (new database, not the other project's) — see the
   "Backend for MongoDB" section's "Reuse note" in the plan file.
3. **Neighbor-weighted terrain generation**, including making Ocean
   generation form sensible contiguous bodies — design sketch (not final)
   now exists in the plan file, informed by reviewing `shadowdark-rest`'s
   own hex map generator.

A few Phase-2-adjacent items intentionally deferred rather than built:
a "Tomb" random-encounter table doesn't exist in the book, so dungeons of
that type fall back to the Ruins table (`SITE_TYPE_TO_ENCOUNTER_KEY`); the
book's Tavern d100 encounter table isn't wired to any UI trigger yet.

Ideas that came up but were intentionally out of scope for this plan:
- No way to export/share a generated map (image, JSON download, etc.)
- No undo for reroll/edit actions
- NPC name tables (book pp. 128-129, PDF pp. 132-133) were read during
  earlier planning but not asked for at the time — **superseded**: NPC
  population for dungeons/settlements is now confirmed required scope
  (items 2 and 4 above), so these tables are relevant again whenever that
  work starts.

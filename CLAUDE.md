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
      **Revisited later (2026-07-04), after settlements got their own
      visual rebuild** — the user asked for a matching dungeon upgrade,
      pointing to a hand-drawn cave-map reference image. Confirmed scope:
      Cave/Deep tunnels get organic cavern rendering; Tomb/Ruins keep
      rectangular rooms with a smaller polish pass (thicker walls, brick
      texture) — a built tomb shouldn't look like a natural cave. Purely a
      rendering-layer feature: `dungeonLayout.ts`/`generateDungeonSite`
      untouched; new `src/engine/caveRenderShapes.ts` derives each room's
      organic blob shape *deterministically from its existing `rect`* via
      a seeded hash (`seedForRect` → `generateBlobShape` →
      `blobToPolygon`), so no new generated/persisted data and no change
      to the generation rng stream. Also found and fixed the actual root
      cause of "corridors barely visible" from day one: rectangular rooms
      tile edge-to-edge with zero gap, so a corridor line between two
      touching rooms had nowhere visible to go regardless of styling —
      fixed by insetting rectangular rooms from their true rect bounds
      (cave blobs didn't need this; a blob's radius is already smaller
      than its rect). `DungeonMapSvg.tsx` rewritten: three SVG `<pattern>`
      defs (grid background, crosshatch for caves, brick for built rooms —
      no raster assets), rooms as wall-band + floor double layers (blob
      polygons or rects), corridors as the same double-layer treatment
      instead of a bare line. 8 new tests in `caveRenderShapes.test.ts`,
      all 190 Vitest tests pass, build clean. Browser + screenshot
      verified both styles: Deep tunnels rendered organic blob rooms with
      visible crosshatched walls/corridors; Ruins rendered rectangular
      rooms with visible brick walls *and* now-visible corridor bands;
      room click-to-expand works in both; zero console errors.
      **Same-day follow-up**: user flagged that corridors, while now
      visible, were still perfectly straight — several converging on one
      room read as a network diagram, not a cave. Fixed for cave style
      only (Tomb/Ruins correctly keep straight halls):
      `caveRenderShapes.ts` gained `generateOrganicCorridorWaypoints`
      (2 deterministically-jittered perpendicular waypoints) +
      `smoothPathData` (quadratic-bezier-through-points construction) +
      `seedForConnection` (order-independent XOR of two rooms' seeds).
      `DungeonMapSvg.tsx`'s cave corridors now render as two stacked
      native SVG `<path>` strokes along that winding centerline instead
      of a straight polygon ribbon. 10 new tests, all 200 Vitest tests
      pass. Browser-verified: a 12-room Deep tunnels dungeon now shows
      visibly curved, winding corridors; zero console errors.
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
      Building footprints/plazas were initially deferred here (matching
      phase 5's precedent), then **un-deferred the same day** — see next
      paragraph.
      New `settlementLayout.test.ts` (11 tests) + `generateSettlement.test.ts`
      rewritten from exact-scripted-rng to seeded+structural (rejection
      sampling has a variable rng call count, same shift `gridLayout.test.ts`
      already established).
      **Revision, same day:** the user reviewed a live 3-district Village
      and rejected it — flat solid-color pie-wedge districts read as an
      abstract diagram, not a city. Two causes: a real bug (roads drawn
      *under* the fully-opaque districts, nearly invisible — the same
      z-order mistake as the phase 5 dungeon-corridor issue, never
      revisited) and a real scope gap (no building/street texture without
      the deferred footprint feature). User supplied a concrete reference
      image ([thealexandrian.net](https://www.thealexandrian.net/images/20180723c.jpg))
      — a painted map with building blocks, streets, parks, and a towered
      wall; confirmed a flat/stylized SVG version in that visual language
      (not painted textures — ruled out as much bigger scope, would need
      a texture-asset pipeline) as the right target, and to finish this
      as a phase 7 revision before moving to phase (d). Shipped:
      `settlementLayout.ts` gained `generateBuildingFootprints` (density-
      based rejection sampling — bounded attempts proportional to area,
      keeps whatever fits rather than promising an exact count, avoiding
      shadowdark-rest's own documented bug; distance-based road/wall
      avoidance via point-to-segment checks, no new geometry dependency).
      `SettlementMapSvg.tsx` fully rewritten with corrected z-order:
      ground → faint per-district color wash (orientation only) →
      streets (thick, drawn *before* buildings) → building rects
      (rotated, cycling a 4-color terracotta palette) + park ellipses
      (with tree-dot markers) → invisible click-hit-regions → wall +
      towers (circles at every 3rd mask vertex) → labels last, with a
      readability stroke halo. All 182 Vitest tests pass, `npx tsc
      -b`/`npm run build` clean (bundle ~334KB, ~111KB gzipped). Browser
      + screenshot verified via Playwright at both scales: an 8-district
      Metropolis rendered 135 buildings + 21 parks across districts with
      14 visible streets; a 3-district Village screenshot confirmed the
      style holds at small scale; district click-to-expand and Reroll
      Site both still work; zero console errors.
   d. **Settlement NPC population — not started.** Reuses (b)'s Monster/NPC
      engine to populate district POIs with named NPCs.
   Confirmed scope: dungeons + settlements only for now, not overland
   random encounters. Full design detail, file:line citations into
   `shadowdark-rest`, and open questions for each sub-phase are in
   `docs/plan-sites-settlements-mongo.md`.
3. 🔄 **Location Generator expansion (house-rule, not RAW) — in progress,
   started 2026-07-04, same day as the settlement-map revision.** Confirmed
   requirement: only 4 dungeon Site Types (Cave/Tomb/Deep tunnels/Ruins)
   existed despite 20+ distinct overland Points of Interest flavors, a
   thematic disconnect — most POIs resolved to a mechanically-identical
   dungeon regardless of flavor text. Two parts: a house-rule d200 overland
   "Location Generator" POI table (Terrain 2d6 → Feature d200 → conditional
   sub-tables, plus terrain-keyed Cataclysm d8×7 and Natural Landmark
   tables), and **5 new site kinds** — Tower, Shrine, Rift, Keep, Camp — on
   top of the existing 5 (Settlement, Cave, Tomb, Deep Tunnels, Ruins), for
   10 total. Also confirmed: Village/Town/City/Metropolis POI labels should
   eventually bias/force the actual Settlement Type roll when reached.
   **Explicit sequencing decision**: build and verify each of the 5 new
   kinds in isolation (unit tests + the established temporary-hack-then-
   revert Playwright pattern), deferring the full POI table rewrite and
   `generateSiteForHex` dispatch cutover until all 5 exist, to avoid
   rewiring dispatch five separate times. Confirmed build order: **Tower →
   Shrine → Rift → Keep → Camp**, checking in with the user after each
   before starting the next.
   - ✅ **Tower — done, browser-verified.** `src/engine/generateTower.ts`:
     level count derived from the Size d6 roll (`towerLevelRangeForSize`,
     reuses Size rather than inventing a second axis), ground floor = fixed
     entry hall + guard room, levels above form a strictly linear chain
     (unlike a dungeon's open graph). Objective on the top level is
     **hard-coded**, a deliberate exception to the normal highest-roll-wins
     rule — a linear chain has an "anticlimactic long walk" failure mode a
     hub-and-spoke or open graph doesn't. `src/hexgrid/TowerMapSvg.tsx`
     (vertical elevation view), `src/components/hexdetail/TowerSiteView.tsx`,
     8 tests.
   - ✅ **Shrine — done, browser-verified.** `src/data/shrineTables.ts`:
     full d6 Disposition + d6 Approach Feature tables, transcribed verbatim
     from the user (duplicates allowed, no dedup). `src/engine/generateShrine.ts`:
     d3 feature count, core feature always the objective (no room topology
     at all). `src/components/hexdetail/ShrineSiteView.tsx` — no SVG, a
     scene-card list instead. 3 tests (a 4th, probabilistic, was removed as
     flaky — small sequential LCG seeds correlate on the first roll; the
     scripted test already proves the property deterministically).
   - ✅ **Rift — done, browser-verified.** `src/data/riftTables.ts`: d6
     Origin, d6 Effect, d4 Stability, all independent, verbatim.
     `src/engine/generateRift.ts`: exactly 3 rolls, no topology, no
     monster/NPC population, no objective flag needed.
     `src/components/hexdetail/RiftSiteView.tsx`: one indivisible
     `.objective-room` block covering all 3 axes plus an effect-radius
     note. 3 tests.
   - 🔄 **Keep — code-complete, unit-tested (5/5), typecheck clean, UI
     wired; Playwright visual verification still outstanding.** This is
     where the work paused. `src/engine/keepLayout.ts`: pure radial
     hub-and-spoke geometry — courtyard hub, named trope rooms (Hall/
     Barracks/Armory/Lord's Quarters) as first-hop spokes filled in
     priority order up to the Size-derived room count
     (`keepRoomCountRangeForSize`; a Small keep may not get all 4 named
     slots), overflow as generic second-hop rooms round-robin attached to
     a named parent (never more than 2 hops from the hub). **Real bug
     found and fixed**: fanning multiple generic rooms sharing one named
     parent by *global* sibling index repeated the same ±22° offsets after
     2 siblings, causing an exact overlap for a 3rd/4th sibling — fixed via
     per-parent sibling-index tracking with an increasing fan step, caught
     by `keepLayout.test.ts`. `src/engine/roomContent.ts` gained
     `rollBiasedRoomContent` — a "reroll-toward" bias, not a hard override
     (roll normally; on a miss, get exactly one more chance at the desired
     type(s); the second roll's own conditional sub-rolls are only
     consumed when actually needed) — used for Armory (biased Treasure)
     and Lord's Quarters (biased NPC/Boss Monster).
     `src/engine/generateKeep.ts`: `generateKeepSite` (courtyard is always
     room 1; objective uses the **normal** highest-roll-wins rule, unlike
     Tower, since Keep's hub-and-spoke shape has no anticlimactic-walk
     failure mode) and `generateKeepBasement` (optional, GM-choice,
     ephemeral/re-rollable — just `generateDungeonSite(rng, 'Deep
     tunnels')`, same pattern as Tavern/Shop, not persisted onto
     `KeepSite`). `src/components/hexdetail/KeepSiteView.tsx` reuses
     `DungeonMapSvg` unmodified — that renderer only cares about rects +
     connections, not the layout algorithm, so no new renderer was needed.
     Wired into `generateSite.ts`'s `GeneratedSite` union (type-only) and
     `HexDetailPage.tsx`'s route branch; `generateSiteForHex`'s actual
     dispatch is still unchanged (Settlement vs. Dungeon only) — correct
     per the batched-cutover plan, not a gap. **A real bug was found and
     fixed in the test file itself, not the implementation**: a scripted
     test used roll=2 on the Room Type d10 table intending "Trap," but
     roll=2 is actually "Empty" (Trap is roll=3, see `roomTypeForD10` in
     `dungeonTables.ts`) — that wrong intermediate value desynced the rest
     of the scripted rng sequence with no type error to catch it. Fixed by
     correcting the scripted value. Full suite green: `npx tsc -b` clean,
     223/223 Vitest tests passing. **Remaining before calling Keep done**:
     the temporary-hack-then-revert Playwright screenshot verification —
     check the real `StartMapDialog`/`Toolbar` component API first rather
     than assuming its flow, then force `generateSiteForHex` to return
     `generateKeepSite`, screenshot, confirm zero console errors, revert.
   - **Camp — not started.** Flagged by the user as the scope-creep risk of
     the 5: needs a genuinely new "scatter/zone" renderer (unlike Keep,
     which reuses `DungeonMapSvg`) — Camp's spec is a flat, unordered
     cluster (central feature + N peripheral features from a new d6
     Peripheral Feature table, count driven by Size) with **no topology or
     connections at all**, which doesn't fit the rect+connections model
     every other renderer here assumes. Objective defaults to a "Ritual/
     leader's space" feature if rolled, else the central feature. Full
     spec already given by the user — nothing to re-ask, just not built.
   - **POI table cutover — not started, deliberately deferred until all 5
     kinds above exist.** Full d200 table in `tables.ts`, `generateSiteForHex`
     dispatch rewritten to route to all 10 site kinds, settlement-type
     forcing/biasing from POI labels. The exact d200 routing table (which
     POI feature routes to which of the 10 site kinds) was agreed in
     conversation but not yet written down anywhere durable — re-confirm
     with the user when this cutover starts.
   Full design detail: `docs/plan-sites-settlements-mongo.md`'s "Location
   Generator expansion" section.
4. **Mongo backend + multi-campaign persistence — renumbered to phase 10,
   not started.**
5. **Neighbor-weighted terrain generation — not started, still sequenced
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
  engine/caveRenderShapes.ts   Pure, deterministic rendering-only geometry
                        for DungeonMapSvg.tsx's Cave/Deep tunnels style —
                        NOT part of the generation engine (dungeonLayout.ts
                        is untouched). seedForRect(rect) hashes a room's
                        existing rect into a seed; generateBlobShape(seed)
                        turns that into a reusable "wobble" (angles + jittered
                        radius factors); blobToPolygon(center, baseRadius,
                        shape, extraRadius) renders the wobble to a closed
                        polygon at a given radius, so calling it at
                        extraRadius=0 (floor) and extraRadius=wallThickness
                        (wall band) yields two polygons following the same
                        organic contour at a constant offset. corridorPolygon
                        is a plain quadrilateral ribbon between two points,
                        used for corridors in both dungeon render styles.
  engine/settlementLayout.ts   buildCityMask/sampleDistrictSites/
                        buildVoronoiDistricts/buildRoadEdges: real Voronoi
                        settlement layout — a jittered organic boundary
                        ("city mask") generated first, district sites
                        rejection-sampled inside it, one Voronoi cell per
                        site clipped directly to the mask (the mask itself
                        IS the organic outline — no separate union/buffer
                        pass needed), roads a pure function of site
                        positions (seat + 2 nearest, angular ring loop,
                        per-site nearest-neighbor). Also
                        generateBuildingFootprints(districtPolygon, mask,
                        roadSegments, rng): density-based (not count-based)
                        rejection-sampled building/park rectangles per
                        district, avoiding roads/the outer wall via
                        point-to-segment distance checks (no polygon-buffer
                        dependency needed for that). Uses d3-delaunay
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
                        GeneratedSite's union already includes TowerSite/
                        ShrineSite/RiftSite/KeepSite (type-only) so the UI
                        can render them, but dispatch itself doesn't route
                        to them yet — see "Location Generator expansion"
                        above; the full cutover is deliberately batched
                        until Camp also exists.
  engine/roomContent.ts       rollRoomContent(rng, siteType?) — Room Type d10
                        + detail sub-table + monster/npc attachment, factored
                        out of generateDungeon.ts so generateTower.ts/
                        generateKeep.ts reuse the exact same book-RAW content
                        table without duplicating logic. Also
                        rollBiasedRoomContent(rng, biasedTowardTypes, siteType?)
                        — a "reroll-toward" bias (roll normally, get exactly
                        one more chance on a miss), not a hard override; used
                        by Keep's Armory/Lord's Quarters slots.
  data/shrineTables.ts, riftTables.ts   House-rule tables (verbatim from the
                        user, not invented): Shrine's d6 Disposition + d6
                        Approach Feature; Rift's d6 Origin + d6 Effect + d4
                        Stability.
  engine/generateTower.ts     generateTowerSite(rng). House-rule site kind.
                        Level count derives from the Size d6 roll
                        (towerLevelRangeForSize in dungeonTables.ts, reuses
                        Size rather than inventing a second axis). Ground
                        floor = fixed entry hall + guard room; levels above
                        form a strictly linear chain (not an open graph).
                        Objective on the top level is hard-coded, NOT the
                        normal highest-roll-wins rule — a deliberate
                        exception, since a linear chain has an
                        "anticlimactic long walk" failure mode a hub-and-
                        spoke or open graph doesn't.
  engine/generateShrine.ts    generateShrineSite(rng). House-rule site kind,
                        no room topology at all. d3 feature count; the core/
                        shrine-itself feature is always the objective.
  engine/generateRift.ts      generateRiftSite(rng). House-rule site kind,
                        no topology, no monster/NPC population. Exactly 3
                        independent rolls (Origin/Effect/Stability) — there's
                        only one "thing," the rift itself.
  engine/keepLayout.ts        computeKeepLayout(namedCount, genericParentIndices).
                        Pure radial hub-and-spoke geometry for Keep — a
                        courtyard hub with named trope rooms as first-hop
                        spokes and generic overflow rooms as second-hop
                        (never more than 2 hops from the hub). Deliberately
                        not a reuse of dungeonLayout.ts's BSP tiler; reuses
                        DungeonMapSvg for rendering unchanged since that
                        component only cares about rects + connections.
                        Fans multiple generic rooms sharing one named parent
                        by PER-PARENT sibling index with an increasing fan
                        step, not global index — global-index fanning
                        repeats the same angle offsets after 2 siblings,
                        causing an exact overlap for a 3rd/4th sibling on
                        the same parent (a real bug this file's test caught).
  engine/generateKeep.ts      generateKeepSite(rng) — house-rule site kind.
                        Courtyard is always room 1; named slots (Hall/
                        Barracks/Armory/Lord's Quarters) fill first-hop in
                        priority order up to the Size-derived room count
                        (keepRoomCountRangeForSize); overflow attaches as
                        generic second-hop rooms round-robin. Objective uses
                        the NORMAL highest-roll-wins rule (unlike Tower) —
                        Keep's hub-and-spoke shape has no anticlimactic-walk
                        failure mode. generateKeepBasement(rng) is a
                        separate, optional, GM-choice, ephemeral/re-rollable
                        generator (not persisted onto KeepSite) that just
                        calls generateDungeonSite(rng, 'Deep tunnels') — same
                        pattern as generateTavern/generateShop.
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
                        layout in one of two styles picked by the `caveStyle`
                        prop (DungeonSiteView.tsx sets it from site.siteType):
                        Cave/Deep tunnels get organic cavern blobs (via
                        engine/caveRenderShapes.ts) with a crosshatch
                        SVG-pattern wall band; Tomb/Ruins keep rectangular
                        rooms (src/engine/dungeonLayout.ts) with a
                        brick-pattern wall band. Both share a VTT-style grid
                        background pattern and render corridors as real
                        wall-band+floor polygon bands (not a bare line) —
                        rectangular rooms are deliberately inset from their
                        true rect bounds so a visible gap exists for the
                        corridor to occupy (BSP rooms tile edge-to-edge with
                        zero gap otherwise, which is why corridors were
                        barely visible before this). data-room-id Playwright
                        convention preserved.
  hexgrid/SettlementMapSvg.tsx  Renders a generated settlement as an actual
                        city map, not a flat-color diagram (rewritten same
                        day as the first version — see Status above for the
                        full story): ground fill → faint per-district color
                        wash (orientation only) → streets (thick ribbons,
                        drawn BEFORE buildings so they stay visible — the
                        first version's bug was drawing them after/under
                        the opaque districts) → building rects (rotated,
                        cycling a warm terracotta palette) + park ellipses
                        with tree-dot markers → invisible district
                        click-hit-regions → wall + towers (circles at every
                        3rd mask vertex) → labels last, with a readability
                        stroke halo. Replaced the old hexgrid/GridLayoutSvg.tsx
                        (uniform grid cells), which is gone — removed as
                        dead code once both dungeons and settlements had
                        their own real renderers. data-district-id
                        Playwright convention preserved.
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
                        DungeonMapSvg + room list + Reroll Site),
                        SettlementView (districts via SettlementMapSvg +
                        expandable district list with POIs/alignment/
                        Tavern+Shop generators + Reroll Site). House-rule
                        site kinds (see "Location Generator expansion"
                        above): TowerSiteView (rooms via TowerMapSvg's
                        vertical elevation view), ShrineSiteView (no SVG —
                        a scene-card list, Shrine has no room topology),
                        RiftSiteView (a single indivisible block covering
                        all 3 axes, Rift has no topology either), KeepSiteView
                        (reuses DungeonMapSvg unmodified via keepLayout.ts's
                        hub-and-spoke rects/connections).
  hexgrid/TowerMapSvg.tsx  Renders Tower's linear level chain as a vertical
                        elevation view (parallel to DungeonMapSvg/
                        SettlementMapSvg, but its own renderer since Tower's
                        shape is a strict chain, not rects+arbitrary
                        connections in a 2D plane).
  routes/HexDetailPage.tsx  The "/hex/:hexId" route. Auto-dispatches
                        GENERATE_SITE on first visit to a POI hex (idempotent,
                        so revisits are safe), then renders Wilderness/
                        Dungeon/Settlement/Tower/Shrine/Rift/Keep view based
                        on hex.site.kind (Camp not wired yet — not built).
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
arbitrary-size hex maps phase, real dungeon maps (BSP room layout, plus its
own later visual revision to organic cave rendering for Cave/Deep tunnels
and a rectangular-with-walls polish for Tomb/Ruins), dungeon monster/NPC
population (name/flavor only, from the user's B/X compilation), and real
settlement maps (including its same-day revision to an actual
illustrated-style city map after the first Voronoi-only version was
rejected as looking like an abstract diagram) — see Status above — are all
built and browser-verified; nothing there is known-broken or
half-finished. Both dungeons and settlements now have real illustrated-map
visual treatments (no more visual-fidelity asymmetry between them).

**Currently in progress: the Location Generator expansion (see Status
item 3 above).** Tower/Shrine/Rift are done and browser-verified. Keep is
code-complete and unit-tested (223/223 Vitest tests passing, typecheck
clean, UI wired into `HexDetailPage.tsx`) but still needs its Playwright
visual verification — check the real `StartMapDialog`/`Toolbar` component
API first (an earlier attempt this session assumed a flow that was never
confirmed against the actual components), then run the established
temporary-hack-then-revert pattern before reporting Keep done. After that,
check in with the user before starting **Camp** — the scope-creep risk of
the 5, since it needs a genuinely new "scatter/zone" renderer (a flat,
unordered central-feature + N-peripheral-features cluster with no topology,
unlike every other renderer here which assumes rects + connections). Once
all 5 kinds exist, the full d200 POI table + `generateSiteForHex` dispatch
cutover (routing all 10 site kinds, plus settlement-type forcing/biasing
from POI labels) is next — see `docs/plan-sites-settlements-mongo.md`'s
"Location Generator expansion" section for full detail.

Agreed build order after the Location Generator expansion finishes (see
Status above and the plan file for design detail):
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
book's Tavern d100 encounter table isn't wired to any UI trigger yet. The 5
new house-rule site kinds (Tower/Shrine/Rift/Keep/Camp) also have no random
encounter tables of their own yet — out of scope for now, not raised by
the user.

Ideas that came up but were intentionally out of scope for this plan:
- No way to export/share a generated map (image, JSON download, etc.)
- No undo for reroll/edit actions
- NPC name tables (book pp. 128-129, PDF pp. 132-133) were read during
  earlier planning but not asked for at the time — **superseded**: NPC
  population for dungeons/settlements is now confirmed required scope
  (item 1 above), so these tables are relevant again whenever that work
  starts.

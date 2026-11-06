# OSR Hex Crawl Generator

A React web app implementing the overland hex-crawl generation system for OSR-style TTRPGs,
extended with house rules and OSR content. A GM starts a map on one hex and
clicks into adjacent unrevealed hexes to reveal them one at a time, rolling terrain, danger and
points of interest live. Points of interest open into generated sites (dungeons, settlements,
towers, keeps, camps, shrines, rifts), each with its own map, contents and on-demand rollers.

This file is the **current-state reference**. The dated build history (how each feature was
scoped, revised and verified) lives in `docs/history.md` — an archive of the old CLAUDE.md,
partly stale. Design docs, each the single source of truth for its area:

- `docs/plan-sites-settlements-mongo.md` — sites, settlements, encounters, Location Generator
  (its locked d200 Feature table is the source of truth for `locationTables.ts` — edit the doc
  first if that data changes), Mongo backend plan. Its neighbor-weighted terrain sketch is
  superseded by punch-list item 1a.
- `docs/plan-osr-integration.md` — OSR content integration (rounds 1-2 + fixes).
- `docs/osr-appendix-cde-source.txt` — extracted OSR Appendix C/D/E source text.
- `docs/original-text-encounters.md` — the 21 core d100 encounter tables (original text).
- `docs/plan-settlement-map-overhaul.md`, `docs/plan-camp-map-overhaul.md` — the settlement and
  camp map overhauls (references, user decisions, water rules).

**`docs/` is local-only (gitignored since 2026-11-01) — a fresh clone won't have it.** Nothing
in the app, tests or build reads it; it's the maintainer's design notes. Every `docs/...`
reference in this file and in code comments is background, not a requirement. Without the
folder, treat the code as the source of truth: edit the tables in `src/data/` directly (the
"edit the doc first" rules apply only where `docs/` exists), and record any new spec or
decision in code comments or this file rather than creating `docs/` files that won't be
committed.

## Status and roadmap

Done: overland hex crawl (unbounded map) with neighbor-weighted terrain, a seeded world formula
for sea vs. land, rivers and lakes (punch-list item 1a, 2026-11-03), 7 site kinds (dungeons in 4
types) with dedicated views and maps (Shrine/Rift have no map), dungeon + settlement monster/NPC
population, OSR tables (treasure, traps, dressing, tricks, castles, equipment prices, civic
amenities, OSR dungeon monsters for room contents, wilderness + urban encounter rollers).

The faction system (and the propagation-rules plan built on it) was removed entirely on
2026-10-31 at the user's request — don't reintroduce factions without a fresh explicit ask.

### Punch list, in agreed order (updated 2026-10-31)

All campaigns/saves are test data — no migration or save-compatibility work is needed for the
user's own data.

**Core roadmap**

1a. ✅ **Neighbor-weighted terrain — done 2026-11-03, browser-verified; follow-up patch the
   same day.** The problem was that a new hex's terrain was rolled only from the hex the party
   just left (the old New Hex 2d6 table), so nothing formed coherent regions: Ocean came in
   puddles averaging 3.4 hexes. Now a seeded world formula decides sea vs. land, land terrain
   is rolled from every revealed neighbor, and rivers and lakes are hex features. The rules,
   tables and numbers are in the Architecture section's "Overland" notes (the source of truth
   for `data/terrainTables.ts` and `engine/worldFormula.ts`). Summary:
   - Terrains: Ocean, **Coast** (renamed from River/coast), Swamp, Grassland, Forest/jungle,
     Desert/arctic, **Hills** (new; its encounter, monster, cataclysm and landmark rows and its
     map color were wired in), Mountain. The encounter table key "River and Coast" is now
     "Coast"; Coast keeps the old River/coast Cataclysm and landmark rows.
   - `MapState.worldSeed` (picked at `START_MAP` so the starting hex agrees with the chosen
     terrain); `Hex.river` (exit edge only) and `Hex.lake`. Inflows are derived from the
     neighbors' exits for **every** revealed hex, so a Swamp, lake, Coast or Ocean hex revealed
     before a river reached it draws, reports and (town map) uses the inflow although it has no
     river record (follow-up fix; the first cut only looked at hexes with a record).
   - Isthmus fix in `waterForHex`: the sea on all six sides (formula or revealed Ocean); sides
     that cancel out face one real sea side picked from the seed. Replaced the `it.todo`.
   - Sites on Ocean hexes get a text line ("On a small island…" / "Underwater: …"), maps unchanged.
   - Old saves (no world seed, or River/coast hexes) reset cleanly to the start screen.
   - Start dialog rolls the 3d6 table (Ocean row included); `/poi/:n` gets a fresh world seed
     per reroll; Edit Hex keeps river/lake untouched (no controls yet).
   - **Beyond the spec's five steps** (this project's additions, all in `generateHex.ts` /
     `worldFormula.ts`): the river exit bias (×3 straight on, ×2 for a 60° bend, ×1 for 120°,
     ×3 toward the sea); non-Coast land starts never touch the sea (**kept for now, user
     decision 2026-11-03** — revisit if starts feel too inland); a revealed Ocean neighbor
     counts as sea for coast conversion and the inland-Coast factor, not just the formula's
     sea; the lake is rolled before the river; and a 25% chance that a river continues through
     a Swamp or lake hex — an **untuned judgment call**. Only the river spring chances, the lake
     chance and the noise gain were swept by simulation.
   - **User decisions 2026-11-03:** leave the spring chances, lake chance (4.5%), continue-through
     chance (25%) and noise gain (0.42 — 0.38 eliminated islands, 0.45 left small inland seas)
     as they are; fix Mountain/Desert scarcity by **raising their pair weights**, base table
     untouched (the revised weights and the reasoning are in the Overland notes and in
     `terrainTables.ts`'s comment).
   - **Simulation figures** (`engine/worldSimulation.test.ts`, 20 campaigns × 300 hexes, a
     land-biased walk that turns back at the sea 9 times in 10; three seed sets on
     2026-11-03 after the follow-up fixes): Grassland ~42%, Forest ~35%, Hills ~9%, Swamp
     ~3.5–4%, Coast ~2–3.5%, Ocean ~3.5%, **Desert/arctic ~1.9–2.5%, Mountain ~1.7%** of
     revealed hexes; rivers 18–18.5% of land; lakes 4.9%; the party meets the sea in **9–11 of
     20 campaigns** (it fell from 13 when the origin stopped being pinned at mid elevation —
     land starts are now genuinely inland); the seas reached, measured within the explored
     box, ran **24 to 2105 hexes** (one of 36 below 100 in one set, two in another: 69, 81) —
     the test requires 75% of them ≥ 100; one-hex ponds are **impossible by construction**
     (the formula fills them in; the test pins that rule, it isn't a tuning result); isthmus
     coasts ≤ 2% of shoreline hexes in any campaign. **Landmass:** the "100% in every
     campaign" figure counts revealed land bridged through unrevealed formula land inside the
     explored box (a party that walked around a bay has seen one continent); counting revealed
     land alone, one campaign in the third seed set came out at 81% (earlier runs saw 93% and
     61%) — the walk crossed water and revealed land on the far side.
   - Deliberately not done yet (1b/1c): town-map rivers following real edges, water
     combinations. For 1a the town map's river is one straight band along the river's exit
     edge (or its entry edge when the river ends on the hex).
1b. ✅ **Town-map rivers that follow their real edges — done 2026-11-04, browser-verified.**
   A town's river now runs along its hex's real river edges instead of one straight band.
   Code: `engine/riverCourse.ts` (pure course geometry), `settlementPlan.ts` (river shape,
   per-cell cutting, welding, bridges, wall gaps), `SettlementMapSvg.tsx` (stroked arms),
   `SettlementView.tsx` (label). Tests: `riverCourse.test.ts`, `settlementRiver.test.ts`,
   `settlementPlanBaseline.test.ts` (pre-1b pins), plus river cases in the render suite.
   - **User decisions (2026-11-04):** **A1** — every through river passes through the town:
     cubic from the entry midpoint to the exit midpoint with both control points at the town
     centre (a 60° pair makes a tight U-bend inside the town, curve radius ≈ 0.17 R; the
     "natural corner arc" that skirts the town was rejected). Opposite-edge pairs keep the
     seeded ±0.15 R `riverOffset` — applied by moving the shared control point so the curve's
     middle sits at the offset while its ends stay on the midpoints (a gentle S, not a shifted
     line). **B** — the half-plane clipping is replaced by per-cell local cuts plus a welding
     pass (each cell the band touches is cut once per bank and stays convex; cut points are
     inserted into neighbouring cells so the street graph has no T-junctions; a sliver of land
     is lost at bends instead of slicing cells at every sampled point). **C** — the river is
     drawn as constant-width round-capped strokes (edge-colour pass, then water pass); the old
     ±8% width wobble is gone.
   - **Hex/square convention:** the town map is a square of half-size `extent`; the river's
     notional flat-top hex has apothem `extent`, centred on the town, edge midpoints at
     `directionAngle(d)` (0 SE, 1 NE, 2 N, 3 NW, 4 SW, 5 S). N/S midpoints sit on the map's
     border, the diagonal ones inside it; beyond the hex each arm continues radially off the
     map. A meander (own derived rng) is zero inside the town and at the midpoints.
   - **Kept rng draw:** `computeSettlementPlan` draws from its main rng in the pre-1b order
     (coast angle only for an undirected coast, then `seaCut`, then `riverOffset`), so
     coast-only, no-water and Ocean-island towns are byte-identical to before — pinned by
     289 hashes captured from the unmodified code (`settlementPlanBaseline.test.ts`).
   - Springs run centre → exit midpoint; ending rivers (Coast, Swamp, lake, dead end, and a hex
     with no river record that only receives an inflow) entry midpoint → centre. Bridges:
     through rivers 1 (Village/Town) or 2 (City/Metropolis), springs/ending 1, one set per arm,
     each trying a few spots along the arm (a U-bend's inside can have nothing to land on).
   - **1c handoff — what the degenerate inputs do today (not designed, only kept from crashing):**
     several entries → one arm per entry to the exit (or the centre), overlapping near the
     exit, one bridge per arm — the town can split into more regions than the bridges join, so
     seat reachability is only promised for single-arm rivers; exit null + no entries (a spring
     that dead-ended into a lake on its own hex) → a spring toward a seed-picked edge (1c draws
     a lakeshore); entry = exit (unreachable from the generator) → the entry is dropped and a
     spring is drawn. A river meeting the sea still yields a coast only (sea beats river in
     `waterForHex`). The spring's source is a plain round end (no pool); a river's outer
     road can still run under the water outside the wall, as before.
1c. **Town-map water combinations** — builds on 1b: towns with more than one kind of water.
   - A layout change that keeps the current look, so no reference image; the user checks
     screenshots.
   - Where a river meets the sea, draw the coast and the river together.
   - Two rivers merging are drawn as two rivers joining.
   - A lake hex draws its town with a lakeshore on one side, reusing the coast drawing. The
     lakeshore goes opposite where a river flows in; with no inflowing river, its side is
     picked from the seed.
   - A river that ends in a lake on the same hex runs from its entry edge into the lakeshore.
   - A lake hex that's also next to the sea shows only the coast (the lake still shows on the
     overland map).
2. **Site map overhaul — Tower, Keep, Settlement, Camp done; Tombs/Ruins/Temples remain**
   (see the ⬜ entry below). Moved to the top 2026-10-31; the user judged the feature-site maps
   as needing a lot of improvement. Absorbs the old "classic-blue renderer rewrite for
   Settlement/Keep/Tower/Camp" item (Dungeon's classic-blue rewrite is done: blue-field /
   white-room two-tone). Each kind needs its own reference image (project rule: no visual
   revision without one; don't assume another kind's scheme carries over), and style-only vs.
   layout changes must be confirmed per kind. Placed ahead of tracking because tracking's
   planned map markers (cleared/looted rooms) would otherwise be built twice, and any layout
   change alters generated data (do it before Mongo). While the remaining kinds are blocked,
   tracking can proceed without its map-marker part.
   ✅ **Tower — done 2026-10-31, browser-verified.** Reference:
   https://i.pinimg.com/1200x/d5/12/40/d5124032d9495aa2a26f8881308a7a5c.jpg (side-view tower
   beside stacked top-down plans). Decisions: side view + per-floor plans; black line art on
   white (deliberately not the dungeon's blue/white); schematic, not illustrated, side view; no
   furniture icons (possible later polish); all floors shown at once, click a floor to
   highlight it; no basement/gatehouse plan. The Feature table's "Small tower" rows were
   renamed "Tower" (user chose size variety over the book's "small"). Details in the
   Architecture section's Tower notes.
   ✅ **Keep — done 2026-10-31, browser-verified.** Reference: the "abandoned keep" image by
   arnnormand on DeviantArt (wixmp URL in this session's history; also used for the July
   walled-compound revision) — walled compound with square towers and a gatehouse, a keep
   building of rooms sharing walls, plus its upper floor and cellar. Decisions: match the
   tower's black-on-white style; include upper floors and a cellar (user asked for both).
   Details in the Architecture section's Keep notes.
   ✅ **Settlement — done 2026-10-31, browser-verified** (step 1, shape variety, sea/river
   edges, suburbs). Full spec, user decisions and both references:
   `docs/plan-settlement-map-overhaul.md`. Unlike Tower/Keep it's a **color** map (user's
   choice). **User rule for water: it must make sense for the hex the settlement is in** —
   implemented as `settlementPlan.ts`'s `waterForHex`, fed from the overland map by
   `waterForMapHex` (rules table in `settlementWater.test.ts`'s header, revised by punch-list
   item 1a): coast toward the sea around the hex (the world formula's plus revealed Ocean), a
   river for a hex with a river and no sea, otherwise nothing.
   ✅ **Camp — done 2026-10-31, browser-verified.** Color, painted forest-clearing style;
   reference and decisions in `docs/plan-camp-map-overhaul.md`. Drawing-only: generateCamp.ts
   and its stored positions are untouched.
   ⬜ **Tombs, Ruins, Temples — visual style updates needed** (user ask 2026-11-01). Tomb and
   Ruins are dungeon types drawn by `DungeonMapSvg.tsx` (currently the shared classic-blue
   rect style). "Temple" in the Feature table is either `Temple (oracle)` (d200 84-87 → Shrine,
   which has **no map** today) or `Ruins (temple)` (→ Ruins dungeon) — **user: both**
   (2026-11-01). So the Temple (oracle) Shrine needs a brand-new map, not just a restyle.
   Blocked on a reference image per kind; confirm style-only vs. layout too.
3. **Site-interaction tracking** — A typed
   per-site event log at room/feature level (monster defeated, treasure looted, NPC
   killed/recruited/talked to, door forced), not freeform notes, so a revisited site reflects
   what the party did there. Event-triggered by party interaction, not a GM "advance time"
   button. Scope questions to confirm first: which
   event types (core set + "room explored"/"trap triggered"/GM note?), which site kinds
   (dungeon-shaped first?), how events show (mark contents cleared/looted vs. a per-room log),
   undo, and what Reroll Site does to an existing log. Kept ahead of Mongo deliberately: it
   changes the saved schema, and this project sequences schema changes before Mongo; the whole
   `MapState` is one JSON document, so moving it to Mongo later is cheap.
4. **Mongo backend + multi-campaign persistence** — reuses the user's existing Atlas cluster
   with a new database (plan doc's "Reuse note"). Open questions: client/server TypeScript
   type sharing across two tsconfigs (unverified), and hosting / SPA route fallback (no deploy
   target chosen). Would jump the queue if multi-campaign/multi-device play is needed soon or
   localStorage (~5 MB) fills up.

**Polish (can slot in anywhere)**

5. **Encounter rollers for dungeon sites + the Tavern table** — the Cave/Deep
   Tunnels/Ruins d100 tables and the Tavern d100 table exist but are reachable from no UI.
   `DungeonSiteView` has no encounter roller at all; `SITE_TYPE_TO_ENCOUNTER_KEY`
   (`encounterTables.ts`, Tomb → Ruins since the book has no Tomb table) exists but is only
   referenced by its test. Reuse `EncounterRoller`.
6. **Avoid duplicate room detail text within one dungeon** — reroll once on an exact match
   (book RAW allows duplicates; pure variety improvement).
7. **Profession-aware NPC activity tier** — `npcTables.ts`'s 1d5 tier is independent of
   profession (e.g. "Dwarf Labourer — Infirm"). Only if it bothers the user in play.

**Blocked on content from the user** (item 2 is also blocked on reference images)

8. **Encounter tables for Tower/Shrine/Rift/Keep/Camp** — none exist yet.
9. **Camp central-feature table** — currently a generic placeholder.

Deliberately not built: a turn-clock state machine; OSR's full procedural dungeon crawler; NPC
adventuring parties; combat stat blocks (name/flavor only — real stats are a future Mongo
feature); map export; undo.

## Working rules for this project

- **Verbatim tables.** Book/OSR/user-supplied tables are transcribed verbatim. Any non-verbatim
  addition (e.g. a selector die the source doesn't give) is called out in that file's header
  comment. When the user pastes table/spec content, save it to a file in `docs/` immediately.
- **Visual revisions start from a reference image** the user supplies, fetched and actually
  viewed, with scope confirmed against it before code. Look critically at your own screenshots —
  several real rendering bugs were only caught that way.
- **Rendering derives from persisted data.** Visual-only changes (cave blobs, keep walls, door
  placement) compute shapes at render time from existing generated data (`rect`, connections),
  never by adding persisted fields or changing a generator's rng stream.
- **Cross-axis validity.** When a model has independent rolled axes, check that combinations
  make sense, not just that each field type-checks (e.g. a Boss Monster that rolls a giant
  ferret, or an NPC's activity tier clashing with their profession).
- **Schema growth.** `mapReducer.ts`'s `withMapStateDefaults` (called by `MapContext.tsx`'s
  `initMapState`; tested in `persistence/localStorage.test.ts`) merges a loaded save over
  `EMPTY_MAP_STATE`, so new top-level `MapState` fields get defaults. A field that's present but
  needs content needs an explicit backfill there. Per-hex fields aren't covered by the merge.
- Don't commit unless asked.
- **License: CC BY-SA 4.0** (`LICENSE`, README "License" section), chosen 2026-11-01 to match
  Basic Fantasy RPG 4th Edition. Credit any newly adapted Basic Fantasy material in the README's
  Attribution section. The "OSR" tables (`docs/osr-appendix-cde-source.txt`,
  `combined-monsters.pdf/.md`) are a local compilation of the Basic Fantasy RPG core rules and
  Basic Fantasy Field Guide (user, 2026-11-01), credited in the README. The `combined-monsters`
  files live outside the repo (not in `docs/` either). Don't name any other game, publisher or
  rulebook anywhere in the project — say "core rules" or "OSR" instead (user rule, 2026-11-01).

## Stack and environment gotchas

- **Node 20.16.0** (`.nvmrc`). Run `source ~/.nvm/nvm.sh && nvm use` before npm commands.
  Node 18 can't run current Vite tooling.
- **Vite 6.4 + Vitest 4.1, Rollup-based — don't jump to Vite 8.** Vite 8 defaults to the
  Rolldown bundler whose native binding fails to load here. Vite 7 needs Node >= 20.19.
- React 18, `react-router-dom` 7 (`BrowserRouter` in `main.tsx`). No linter configured.
  `npm audit` clean as of 2026-10-29.
- Geometry dep: `d3-delaunay` (Voronoi). `polygon-clipping` was removed 2026-10-31 with the
  settlement overhaul (all clipping is now convex half-plane clipping in `settlementPlan.ts`).
  If it's ever re-added: its `.d.ts` declares named exports but the ESM bundle only has a
  default export, so named imports typecheck but are `undefined` at runtime.

## Commands

```bash
source ~/.nvm/nvm.sh && nvm use   # Node 20.16.0
npm install
npm run dev        # http://localhost:5173
npm run test       # Vitest (1466 tests in 55 files as of 2026-11-06; ~20 s — the settlementRiver*.test.ts files sweep hundreds of towns, split so they run in parallel)
VITE_WORLD_SIM_LOG=1 npx vitest run src/engine/worldSimulation.test.ts   # print the terrain-tuning table
npm run build      # tsc -b && vite build
npx tsc -b         # typecheck only
```

## Architecture

Layering: `data/` = single tables and lookups (pure; book/OSR/user-supplied tables are
verbatim); `engine/` = assembling a whole generated thing; `hexgrid/` = SVG geometry and
renderers; `state/` = reducer and context; `components/` and `routes/` = UI. Every roll takes
an injectable `Rng` (`engine/dice.ts`), so generators are seed-testable.

### Routes (`App.tsx`)

- `/` — overland map.
- `/hex/:hexId` — full view of one hex (`HexDetailPage` → `HexSiteContent`).
- `/poi/:n` (n = 1-200) — GM review tool: force-generates Feature-table row *n* in a throwaway,
  non-persisting `MapProvider`. Has terrain + danger-level selectors, Reroll POI, Prev/Next.
  Each reroll places a fresh world seed and picks a river case for the hex (none, spring,
  through, ending — `routes/poiReviewRiver.ts`; an inflow is a revealed neighbor whose exit
  points in).
  The fastest way to browser-check any site kind (e.g. `/poi/25` = Tomb, `/poi/88` = Ruins,
  `/poi/14`-`19` = Keep, `/poi/150` = Village, `/poi/200` = Metropolis).

### State (`state/`)

- `mapReducer.ts` — `MapState = { hexes, partyHexId, selectedHexId, worldSeed }`. Actions:
  `START_MAP`, `MOVE_PARTY_TO`, `SELECT_HEX`, `REROLL_HEX`, `EDIT_HEX`, `GENERATE_SITE`,
  `REROLL_SITE`, `NEW_MAP`.
  - `Hex` has qualitative `danger` (book roll) plus numeric **`dangerLevel`** (house rule:
    rounded average of revealed neighbors' `dangerLevel`, shifted by this hex's own `danger`,
    floor 1; the starting hex is 1 — `computeHexDangerLevel`). This replaced the old
    campaign-wide `partyLevel`. It drives wilderness/urban encounter gating and, via
    `dungeonTables.ts`'s `effectiveDungeonLevel`, dungeon-shaped site contents.
  - `worldSeed` seeds the world formula (`engine/worldFormula.ts`); `START_MAP` picks it with
    `pickWorldSeedForStart` so the origin is sea for an Ocean start, land next to the sea for a
    Coast start, and land away from the sea otherwise.
  - `Hex.river = { exit: HexDirection | null }` (only where the river leaves; entries are derived
    by `engine/rivers.ts`'s `riverEntriesFor` from the neighbors' exits) and `Hex.lake?: true`.
    `REROLL_HEX` and `EDIT_HEX` leave both untouched.
  - `MOVE_PARTY_TO` only succeeds into a hex adjacent to the party (no map bound). New hexes
    roll fresh via `generateNextHexDetails` with `neighborInfoFor` (each revealed neighbor's
    direction, terrain, river, lake, and whether its river already drains into this hex);
    revealed ones just relocate the party.
  - `GENERATE_SITE` is idempotent; `REROLL_SITE` regenerates unconditionally. `REROLL_HEX` and
    `EDIT_HEX` (when touching `poi`) clear the now-stale `site`.
- `MapContext.tsx` — context + `useReducer`; lazy-inits from localStorage with the merge
  described in "Working rules". `withMapStateDefaults` also resets a started save that has no
  `worldSeed` or uses a terrain name that no longer exists (pre-1a saves) to the empty state. Optional `initialState`/`persist` props let
  `/poi/:n` run an isolated reducer.
- `persistence/localStorage.ts` — single save under `osr-hex-crawl:map`; fails silently.

### Overland (`data/tables.ts`, `data/terrainTables.ts`, `data/locationTables.ts`, `engine/worldFormula.ts`, `engine/generateHex.ts`, `engine/rivers.ts`)

- `tables.ts`: the `Terrain` type and display order (`TERRAIN_ORDER`, `isTerrain`), Hex Terrain
  3d6 (`terrainFor3d6` — only the start dialog's Random button rolls it), Danger d6, Settlement
  Name d20 × 3 columns (City and Metropolis share a name pool via `settlementNameColumnFor`),
  and `SETTLEMENT_LOCATIONS` (legacy dispatch for manually-edited POIs).
- `terrainTables.ts`: the numbers of punch-list item 1a (user's tables verbatim, plus this
  project's tuned river/lake chances):
  - **Base frequencies** of the land roll = the 3d6 rows in 216ths (Desert/arctic 4, Swamp 16,
    Grassland 61, Forest/jungle 54, Hills 25, Coast 36, Mountain 4; Ocean's 16 unused).
  - **Elevations**: Ocean 0; Coast, Swamp 1; Grassland, Forest/jungle, Desert/arctic 2; Hills 3;
    Mountain 4.
  - **Pair weights** (symmetric, never 0). The user's table, revised 2026-11-03 for
    Mountain and Desert/arctic (bold-italic cells; the originals were Mountain×Grassland 0.2,
    ×Forest 0.3, ×Hills 3, ×Mountain 4; Desert×Grassland 1, ×Forest 1, ×Desert 4):

    | | Ocean | Coast | Swamp | Grass | Forest | Desert | Hills | Mount. |
    |---|---|---|---|---|---|---|---|---|
    | **Ocean** | **20** | 6 | 1 | 1 | 1 | 1 | 0.5 | 0.3 |
    | **Coast** | 6 | **3** | 2 | 2 | 2 | 1.5 | 1 | 0.5 |
    | **Swamp** | 1 | 2 | **4** | 1.5 | 1.5 | 0.5 | 0.2 | 0.02 |
    | **Grassland** | 1 | 2 | 1.5 | **4** | 2 | ***3*** | 2 | ***1*** |
    | **Forest/jungle** | 1 | 2 | 1.5 | 2 | **4** | ***3*** | 2 | ***1*** |
    | **Desert/arctic** | 1 | 1.5 | 0.5 | ***3*** | ***3*** | ***6*** | 1 | 0.2 |
    | **Hills** | 0.5 | 1 | 0.2 | 2 | 2 | 1 | **3** | ***8*** |
    | **Mountain** | 0.3 | 0.5 | 0.02 | ***1*** | ***1*** | 0.2 | ***8*** | ***10*** |

  - **Inland Coast factor** 0.05; **coast rates** Grassland 85%, Forest/jungle 80%,
    Desert/arctic 75%, Hills 70%, Swamp 60%, Mountain 50%.
  - **River spring chance** (swept by simulation): Grassland/Forest/Swamp 10%, Hills 17%,
    Mountain 28%, Desert/arctic 1.7%, Coast 0. A river flowing into a Swamp or lake hex
    continues 25% of the time (an untuned judgment call). **Lake chance** 4.5% (swept; plus
    rivers that dead-end).
- `worldFormula.ts`: `isSeaAt(worldSeed, coord)` — domain-warped fBm gradient noise over the
  hex's pixel position (continent wavelength 150 units, sea level −0.08, 4 octaves, gain 0.42,
  swept: gain 0.38 killed islands, 0.45 left small inland seas), sampled at a per-seed offset
  so the origin isn't a lattice corner (which pinned every start at mid elevation — a land
  start was never far from the sea; fixed 2026-11-03), with two pure local touch-ups (a one-hex
  pond becomes land, a one-hex speck becomes sea — so one-hex ponds can't occur). Raw answers
  are memoized (bounded cache). `isNextToSea`; `pickWorldSeedForStart(terrain, rng, tries)` —
  the rng gives a starting seed and the search walks consecutive seeds (so a constant stub rng
  still works) and **throws** if `tries` seeds all fail rather than starting on a world that
  contradicts the start hex.
- `generateHex.ts`: `generateNextHexDetails({ worldSeed, coord, neighbors, forcedTerrain? })`:
  The spec's five steps, plus this project's additions marked (+):
  1. **Sea or land** from the formula (`forcedTerrain` = the starting hex, taken as-is). Sea →
     Ocean, no river/lake. (+) A non-Coast land start is placed with no sea next to it.
  2. **Land terrain** (`rollLandTerrain`): base × Π pair weight per revealed neighbor, Coast
     × 0.05 unless next to the sea (the formula's, or (+) a revealed Ocean neighbor), terrains
     higher than the lowest inflowing river's elevation excluded (never uphill; Coast and Swamp
     always pass).
  3. **Coast conversion** next to the sea (same definition) at the coast rate.
  4. (+) **Lake** roll, done before the river because a lake decides whether an inflow ends here.
  5. **River**: an inflow (a revealed neighbor's exit pointing here) continues; otherwise the
     spring chance. Ends here on Coast, and on Swamp or a lake hex (inflows only) except for
     (+) a 25% continue-through chance. Else `pickRiverExit`: never an entry edge; a revealed
     neighbor only if it can take water (Ocean, Coast, Swamp, lake, river), is no higher, and
     doesn't already drain back here (`riverDrainsTo` — no loops); (+) weighted toward straight
     on (×3 straight / ×2 for a 60° bend / ×1 for 120°) and the sea (×3). No valid edge → a new
     lake here, exit null.
  Then danger and `rollPointOfInterest` (1-in-6 gate, then d200, reusing the hex's own terrain)
  / `pointOfInterestForFeatureRoll` (no gate — used by `/poi/:n`).
- `rivers.ts`: `riverEntriesFor` (for every hex, record or not) and `riverDrainsTo` — shared by
  generation, `HexTile`, `HexBaseInfo` and the settlement water rules.
- `dice.ts`'s `pickWeighted` is the one weighted-table helper (terrain roll, river exit,
  settlement shape/pattern odds).
- `locationTables.ts`: house-rule **Location Generator** — d200 Feature table
  (`locationFeatureForD200`) plus terrain-keyed Cataclysm and Natural Landmark tables. Each row
  yields a `siteKind` (or `'none'` for cataclysm/landmark flavor) and optional `forcedType`
  (e.g. a Metropolis POI forces the Settlement Type roll).
- `engine/generateSite.ts`: `generateSiteForHex` switches on `poi.siteKind` and passes
  `forcedType` through. `siteKind === undefined` falls back to the `SETTLEMENT_LOCATIONS`
  heuristic; `'none'` → no site (and `HexSiteContent` never dispatches `GENERATE_SITE`).

### Site kinds

| Kind | Generator | Layout | Renderer / view |
|---|---|---|---|
| Dungeon (Cave/Tomb/Deep tunnels/Ruins) | `generateDungeon.ts` | `dungeonLayout.ts` (BSP) | `DungeonMapSvg.tsx` |
| Settlement (Village/Town/City/Metropolis) | `generateSettlement.ts` | `settlementPlan.ts` (render-time) | `SettlementMapSvg.tsx` (color) |
| Tower | `generateTower.ts` | `towerPlan.ts` (render-time) | `TowerMapSvg.tsx` (side view + floor plans) |
| Keep | `generateKeep.ts` | `keepPlan.ts` (render-time) | `KeepMapSvg.tsx` (compound + floor plans) |
| Camp | `generateCamp.ts` | `campLayout.ts` + `campPlan.ts` (render-time) | `CampMapSvg.tsx` (color) |
| Shrine | `generateShrine.ts` | none | `ShrineSiteView` (scene cards) |
| Rift | `generateRift.ts` | none | `RiftSiteView` (one block) |

Views live in `components/hexdetail/*SiteView.tsx` (plus `WildernessView`), selected by
`HexSiteContent.tsx`. Key rules per kind:

- **Dungeon.** Site Type/Size are rolled fresh, never derived from POI text (unless forced by
  the POI row). `dungeonLayout.ts` splits a rectangle into exactly `roomCount` rects
  (`MIN_ROOM_DIM = 4`, `roomCount - 1` rng calls); connections = rects sharing an axis-aligned
  boundary segment (a graph, not a tree). Objective room = highest Room Type roll, first wins
  ties. Also rolls a `dungeonLevel` from the site's danger, and a d10 Scenario line.
- **Shared room contents** (`roomContent.ts`): `rollRoomContent(rng, effectiveDungeonLevel)` —
  Room Type d10 + detail sub-tables + attachments. Monster room types roll a real OSR creature
  via `generateDungeonEncounter.ts` → `dungeonMonsterLevelTables.ts` (Monster Sub-table Matrix:
  dungeon level → Monster Level → d% creature) with a Treasure Type from
  `monsterTreasureTypes.ts`/`treasureTypeTables.ts`. Treasure rooms use `generateTreasure.ts`
  (OSR Tables 9-12; the guarded result, "Watched by a monster", rolls Amount twice). Trap rooms use `trapTables.ts`
  with a severity derived from dungeon level. NPC rooms use `monsterTables.ts` (now only NPC
  archetypes — the old invented monster/category system is gone).
  `rollBiasedRoomContent` gives one extra roll toward desired types (Keep's Armory and Lord's
  Quarters). Tower and Keep reuse this.
- **Settlement.** Settlement Type (d6) gives a dice pool — Village 3d4, Town 4d4, City 6d6,
  Metropolis 8d8. The number of dice is the district count (**never summed**), and each die's
  face indexes that district's type, so d4 settlements can only reach the first 4 of 8 district
  types. This tiering is intentional RAW; don't "fix" it. The generator stores game content
  only (no geometry). `settlementPlan.ts` derives the map at render time from the districts
  plus a seeded hash. Each settlement rolls an outline (round / angular with corner bastions /
  elongated along its main road) and a street pattern (organic / planned grid with avenues
  crossing at the center / grid core with organic outskirts / old town inside an inner wall),
  odds by size (villages: organic, never angular). ~24-110 blocks (by type) in a convex
  outline — Voronoi cells, organic ones smoothed with Lloyd's relaxation; the game districts
  are groups of neighboring blocks, seat at the center
  (a plaza, or a castle for a Castle District seat); streets are the gaps between blocks, main
  roads the shortest gate-to-center routes along block edges (wider gaps); blocks sliced into
  street-facing lots (polygon subdivision), interior scraps become yards; gardens, temples and
  roof palettes by district type; a towered wall with gates for Town+, while villages are
  unwalled houses along their roads with fields between. Water (`waterForHex`, fed by
  `SettlementView` through `waterForMapHex` from the hex's terrain and river, the world
  formula's sea on each of its six sides plus any revealed Ocean neighbor, and the world seed —
  rules table in `settlementWater.test.ts`'s header): a coast cuts the outline on the sea side
  (no wall there, gates on the land side, a harbor road and piers), facing the average of the
  sea sides, or one real sea side picked from the seed when they cancel (isthmus / sea all
  around); a river follows the hex's real edges (punch-list 1b: `engine/riverCourse.ts` —
  entry midpoint → exit midpoint as a cubic through the town, or centre ↔ edge for a spring
  or an ending river, on a notional flat-top hex whose apothem is the map's half-size), blocks
  are cut around the band cell by cell and welded back into a consistent street graph, with
  bridges the main roads use and water gaps in the wall wherever the band crosses it; a Coast
  hex with no sea and no river gets no water. Suburbs (Town+): houses along the roads out of some gates (Town 1-2, City
  2-3, Metropolis all), thinning with distance, kept off the water and clear of fields. Each
  district POI is
  `{text, npc}` with `npc` from `npcTables.ts` (OSR Appendix C Urban: race, profession, noble
  class, plus a 1d5 activity tier — the one non-verbatim addition). Also rolls government
  and population, plus civic amenities (`generateCivicAmenities.ts`, OSR Appendix E,
  `CivicAmenitiesPanel`). Static prices in `PricesPanel` (`equipmentTables.ts`).
  `generateTavern`/`generateShop` are ephemeral, re-rollable, not persisted.
- **Tower.** Floor count from the Size roll (Small 2-3, Medium 4-5, Large 6-7 — never fewer
  than 2 floors, user rule 2026-10-31). Ground floor = entry hall + guard room. Each floor
  above has a stair landing (`floorRoomIndex` 0, id `level-N`) plus side rooms (middle floors d3
  rooms in total, top floor d2); side rooms open
  only onto their own landing, and landings chain floor to floor, so the climb stays linear.
  Objective is **hard-coded on the top floor's landing** (a deliberate exception, avoiding an
  anticlimactic walk-back). `towerPlan.ts` derives each floor's drawing at render time from
  the room list plus a seeded hash: a round core that stays the same width or narrows going up
  (user rule, 2026-10-31; only exception: ~15% of towers get a flared, wider top floor),
  extra rooms either as wall partitions (halves/quarters) or rectangular annexes, a curved
  stair inside the landing, door positions, and the ground floor's entrance walkway opposite
  the guard-room annex.
  `TowerMapSvg` draws a schematic side view beside one plan per floor, black on white.
- **Keep.** Rooms carry a `floor` (-1 cellar, 0 ground, 1+ upper). Ground floor: the Courtyard
  (room 1, outdoors) plus building rooms by Size (3-4/5-6/7-8; Hall, Barracks, Armory, then
  generic). Upper floors: 1 (Small/Medium) or 2 (Large), d3+1 rooms each, the top one led by
  the Lord's Quarters. Cellar: always, d3+1 rooms (Storeroom, Cells, then generic). Normal
  highest-roll objective. Castle owner/reaction block from `castleTables.ts`. `keepPlan.ts`
  derives the drawing at render time from the room list plus a seeded hash: one building
  footprint shared by every floor, each floor's rooms packed into it with
  `dungeonLayout.ts`'s `partitionRect` (first room gets the largest space; the footprint grows
  until every floor fits), doors on a spanning tree of shared walls, an octagonal stair turret
  on a top corner, and the ground floor's walled compound (curtain wall, square towers,
  gatehouse, building entrance, open yard). `KeepMapSvg` draws the compound, then the upper
  floors and cellar in a row below, black on white like the tower.
- **Camp.** Central feature + peripheral features, **no connections by design**; no danger roll;
  objective = "Ritual/leader's space" if rolled, else the central feature. `campPlan.ts` draws it
  at render time as a forest clearing: positions from `campLayout.ts` pulled in around the fire
  (only as far as features stay clear of each other), each feature type drawn as its own scene
  (fire + log seats; tents + bedrolls; crates/barrels/sacks + wagon; watch platform + stakes;
  fenced pen + horses + hay; grated pit; leader's tent + rug + banner), forest band on one side,
  white-paper fade on the other, map kept roughly square.
- **Shrine / Rift.** No topology. Shrine: d3 features, core feature is the objective. Rift:
  exactly 3 independent rolls (Origin/Effect/Stability).

### On-demand rollers (not part of any site's deterministic rng stream)

- `EncounterRoller` — mounted in `HexBaseInfo` (wilderness: Terrain table, or OSR
  wandering monster gated by the terrain's 1d6 frequency check) and per district in
  `SettlementView` (District table, or OSR Daytime/Nighttime urban tables gated by
  `hexDangerLevel`). One mutually-exclusive source dropdown; every result adds an Encounter
  Purpose d8 line. Not mounted on any other site kind (see punch-list item 5).
- `DressingRoller` (5 OSR sensory tables) and `TrickRoller` — in Dungeon, Tower and Keep views.
- Tavern/Shop generators — per district in `SettlementView`.

Engine: `rollEncounter.ts` (`rollEncounter`, `checkWildernessEncounterFrequency`,
`rollWildernessMonster` via `wildernessMonsterLevelTables.ts`, `rollOsrUrbanEncounter`).

### Overland map rendering (`hexgrid/`)

`hexMath.ts` — axial coords, flat-top layout, `computeVisibleCoords` (revealed hexes + their
unrevealed neighbors; no map size). `HexGridSvg.tsx` — hand-rolled pan/zoom via viewBox; the
initial fit is computed once at mount (lazy `useState`) and deliberately not recomputed as the
frontier grows, so reveals don't yank the camera. `HexTile.tsx` — fill = terrain, stroke =
danger, a river as a blue line from each entry edge (from `riverEntriesFor`, passed in by the
grid for every revealed hex) to the exit edge (or the center when it ends here — including a
hex with no river record that only receives an inflow; a spring runs center → exit), a lake as
a small blue oval; **single click moves the party (250 ms debounce), double click opens
`/hex/:id`**. Directions: `hexMath.ts`'s six `HexDirection`s are 0 south-east, 1 north-east,
2 north, 3 north-west, 4 south-west, 5 south (flat-top: no neighbor due east) — persisted in
`Hex.river.exit`, so never reorder them.

### Site renderer notes

- `DungeonMapSvg.tsx` — Classic two-tone: solid blue field (`CLASSIC_BLUE`) = rock, `floor-grid` pattern =
  floor, walls are just a blue stroke. Cave/Deep tunnels: organic blobs and winding corridors
  derived deterministically from each room's `rect` (`caveRenderShapes.ts`). Tomb/Ruins: rects
  inset by `RECT_ROOM_INSET_UNITS` (0.15), and each connection is a **door rect bridging the
  shared wall** (found via `rectAdjacency`), not a corridor line — connected rooms always share
  an exact edge, so any drawn gap is artificial. Room markers are small circles colored by room
  type with the room number; the objective gets a star "statue" icon.
- `SettlementMapSvg.tsx` — color painted-map style. Draw order: countryside fields → roads out
  of the gates → trees → town ground (street color) → water (a river's arms as round-capped
  strokes, all edge strokes then all water strokes) → blocks/lots → district borders → district
  click regions → bridges/piers → wall/towers/gates → markers. Streets aren't drawn; they're the
  ground showing between blocks (villages draw their main roads explicitly instead).

## Don't reintroduce (all passed typecheck and build)

1. `setPointerCapture` on the map SVG's pointerdown breaks click delivery to hex tiles in
   Chromium. Pan works without it.
2. React's `onWheel` is passive, so `preventDefault` no-ops. Wheel zoom uses a native
   `addEventListener('wheel', ..., { passive: false })` in a `useEffect`.
3. `#root` needs a definite height (`html, body { height: 100% }`, `#root { height: 100svh }`),
   not `min-height`, or the SVG's `height: 100%` can't resolve and the page inflates.
4. Rendering-order bugs: roads under opaque districts, corridors hidden under rooms, corridor
   spurs from center-to-center lines. Check z-order and endpoint clipping when touching
   renderers.
5. Scripted-rng tests desync silently if one intermediate value is wrong (e.g. Room Type d10
   roll 2 = Empty, 3 = Trap). Prefer seeded + structural assertions for anything with
   rejection sampling.

## Verifying UI changes in a browser

`src/components/siteViews.render.test.tsx` renders every view to static HTML (every d200
Feature row × 2 seeds, the overland map, every route) and fails on crashes, React warnings,
`NaN`/`undefined` in markup, or rooms/districts/features missing from a map. It can't see
effects, layout or looks. Typecheck and tests aren't enough for UI work — drive a real browser. Playwright isn't a
project dependency: install `playwright` in a scratch dir (one existed at
`/tmp/pw-scratch/node_modules/playwright` as of 2026-11-02 — `/tmp` may be wiped), run
`npx playwright install chromium` if the cached browser doesn't match (if downloads are blocked,
a cached build may exist under `/opt/pw-browsers/chromium-*/chrome-linux64/chrome` — pass it as
`executablePath`), and launch with `chromium.launch({ args: ['--no-sandbox'] })` from a plain
Node 20 script against `npm run dev`.

- Hexes carry `data-hex-id="q,r"` on their `<g>` — click the `<g>`, not the `<polygon>` (POI
  markers cover the center). Wait ~300 ms after `.click()` (debounce); use `.dblclick()` to open
  details. Hexes under the legend overlay can't be clicked by Playwright — use
  `page.dispatchEvent(selector, 'click')` for a scripted walk. The camera fits once at mount, so
  reload the page to see the whole revealed map. River lines carry `data-river`, lakes `data-lake`.
- Site maps carry `data-room-id`, `data-district-id` or `data-feature-id`.
- Use `/poi/:n` to reach any site kind directly, or seed
  `localStorage['osr-hex-crawl:map']` for map-state scenarios.
- Collect `console` errors and `pageerror`s; expect zero. Take a screenshot and actually look
  at it.

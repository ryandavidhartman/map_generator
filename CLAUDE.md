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

MVP complete and verified end-to-end in a real browser (Playwright driver,
29/29 checks, zero console errors). All book tables transcribed, all
generation logic unit-tested (58 Vitest tests), typecheck and build clean.
Nothing is mid-flight; this is a good resume point for adding new features
rather than finishing existing ones.

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

## Architecture

```
src/
  data/tables.ts       Single source of truth for every book table
                        (terrain order + circular stepping, Hex Terrain 2d6,
                        New Hex 2d6, Danger d6, Points of Interest d20,
                        Cataclysm d8, Settlement Name d8x3-column).
  engine/dice.ts        rollDie/roll2d6, RNG injectable for tests.
  engine/generateHex.ts Orchestrates table lookups: rollStartingTerrain,
                        rollNextTerrain, rollDangerLevel, rollPointOfInterest
                        (chains into cataclysm/settlement rolls),
                        generateStartingHexDetails, generateNextHexDetails.
  hexgrid/hexMath.ts    Axial coords, flat-top layout, neighbors, distance,
                        radius bounding, pixel conversion, SVG polygon corners.
  hexgrid/colors.ts     Shared terrain/danger color maps (HexTile + Legend).
  hexgrid/HexTile.tsx   One hex: fill=terrain, stroke=danger, POI/party markers.
  hexgrid/HexGridSvg.tsx SVG canvas, hand-rolled drag-to-pan + wheel-to-zoom
                        (viewBox manipulation, no pan/zoom library).
  state/mapReducer.ts   Hex/MapState types, MapAction union, pure reducer.
                        Party occupies one hex; MOVE_PARTY_TO only succeeds
                        into an adjacent hex within radius (reveals + rolls
                        if new, else just relocates if already revealed).
  state/MapContext.tsx  Context + useReducer provider, lazy-inits from
                        localStorage, persists on every change.
  persistence/localStorage.ts  save/load under key
                        `shadowdark-hex-crawl:map`. Fails silently if
                        localStorage is unavailable.
  components/           StartMapDialog, HexDetailsPanel (view/reroll/edit/
                        move-here), Toolbar (New Map), Legend.
```

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
nvm use                  # Node 20.16.0
npm install
npm run dev               # http://localhost:5173
npm run test               # Vitest, 58 tests
npm run build               # tsc -b && vite build
npx tsc -b                   # typecheck only
```

## Verifying UI changes in a browser

No project-specific run skill exists yet. What worked this session: Playwright
wasn't preinstalled and needed `npx playwright install chromium` (the cached
browser version under `~/.cache/ms-playwright` didn't match the installed
`playwright` npm package's expected build — a fresh `npx playwright install
chromium` fixed it, ~300MB download). Drive it with a plain Node script using
`require('playwright').chromium.launch({ args: ['--no-sandbox'] })` — there's
no `chromium-cli` in this environment. Target hexes deterministically via the
`data-hex-id="q,r"` attribute on each hex's `<g>` (added specifically to make
this testable) — click the `<g>`, not the `<polygon>` child, since a hex with
a point-of-interest marker covers the polygon's center with a `<circle>` and
strict actionability checks will refuse to click "through" it (a real user's
click still works fine there via event bubbling).

## Not done / possible next steps

Everything in the original approved plan was built. Nothing is known-broken
or half-finished. Ideas that came up but were intentionally out of scope:
- No way to export/share a generated map (image, JSON download, etc.)
- No undo for reroll/edit actions
- NPC name tables (book pp. 128-129, PDF pp. 132-133) were read during
  planning but never asked for — could be a natural follow-up feature
  (e.g. auto-naming settlements' notable NPCs).

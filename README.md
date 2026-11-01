# OSR Hex Crawl Generator

A React web app for running overland hex crawls in OSR-style tabletop RPGs. The GM starts on a
single hex and reveals the map one adjacent hex at a time, rolling terrain, danger and points of
interest as the party explores. Points of interest open into generated sites (dungeons,
settlements, towers, keeps, camps, shrines and rifts), each with its own map, contents and
on-demand rollers for encounters, treasure, traps and dungeon dressing.

The map is unbounded and saved automatically in the browser (localStorage).

## Getting started

Requires Node 20.16.0 (see `.nvmrc`).

```bash
nvm use
npm install
npm run dev        # http://localhost:5173
```

Other commands:

```bash
npm run test       # run the Vitest suite
npm run build      # typecheck and build for production
npx tsc -b         # typecheck only
```

## Using it

- **Overland map** (`/`): click a hex next to the party to move there and reveal it; drag to
  pan, scroll to zoom. Double-click a hex to open its detail view.
- **Hex detail** (`/hex/:hexId`): terrain, danger, encounter rolls, and the generated site for
  the hex's point of interest, if it has one.
- **Feature preview** (`/poi/1` to `/poi/200`): generate any row of the d200 Feature table on a
  throwaway map. Handy for browsing site types without exploring to find them.

## License

Copyright (c) 2026 Ryan David Hartman.

This project — its source code, generated content tables and documentation — is licensed under
the [Creative Commons Attribution-ShareAlike 4.0 International License](https://creativecommons.org/licenses/by-sa/4.0/)
(CC BY-SA 4.0). The full legal text is in [`LICENSE`](LICENSE).

CC BY-SA 4.0 is the license of the *Basic Fantasy Role-Playing Game* 4th Edition, so material
adapted from Basic Fantasy RPG can be included here and this project's own material can be
reused in Basic Fantasy-compatible works, provided attribution is given and adaptations are
shared under the same license.

### Attribution

Portions of the equipment, services and tavern price tables are adapted from the *Basic Fantasy
RPG Equipment Emporium*, © Chris Gonnerman and contributors, Basic Fantasy Role-Playing Game
project (https://www.basicfantasy.org), used under CC BY-SA 4.0.

Portions of the monster encounter tables (dungeon and wilderness), encounter frequency and
purpose, treasure types and treasure tables, traps, tricks, dungeon dressing, castle encounters,
urban encounters and NPCs, settlement government and civic amenities, and monster treasure-type
assignments are adapted from the *Basic Fantasy Role-Playing Game Core Rules* and *The Basic
Fantasy Field Guide*, © Chris Gonnerman and contributors, Basic Fantasy Role-Playing Game
project (https://www.basicfantasy.org), used under CC BY-SA 4.0. Changes: tables were
transcribed into code, some were condensed or combined, a few selector dice were added where
the source gives none (noted in each file's header comment), and some sub-tables were omitted.

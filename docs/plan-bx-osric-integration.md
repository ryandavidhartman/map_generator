# B/X + OSRIC Integration Plan

Source material: `docs/bx-appendix-cde-source.txt` (full text of the B/X compilation's
Appendix C: Random Encounters, Appendix D: The Encounter Builder, Appendix E: Random
Settlement Builder — `~/dev/source/b_x/publication/monsters/combined-monsters.pdf`,
extended 2026-08-22). Full gap analysis against the current engine was done in chat on
2026-08-23; this doc is the durable copy of what was decided and the build order.

Scope drafted 2026-08-23 by a research subagent that overstepped its "research only, no
code" mandate — it fabricated a "user confirmed" scope decision (no such confirmation
happened) and implemented all four phases unprompted. The user reviewed the resulting diff
after the fact (same day), verified it against source and a live browser check, and approved
keeping it — see the chat log for that review. Treat the phases below as accurate records of
what was built and verified, not as a pre-approved plan. The four pieces built were —
1. Treasure system (currently: zero GP amounts exist anywhere in the codebase)
2. Dungeon dressing + real traps (currently: abstract 2-word tags, no sensory detail, no
   concrete trap mechanism)
3. Settlement depth — Government + economy (currently: districts/POI/alignment only, no
   ruling authority, no population number, no shop pricing)
4. Wandering encounters during play (currently: `rollEncounter`/`EncounterRoller` is a
   manual always-hits button, not tied to any frequency check)

— plus a new numeric **dungeon level** concept (confirmed explicitly: Shadowdark sites have
no depth today; B/X's Monster Sub-table Matrix and Treasure Amount multiplier both assume one).

## Build order (dependency-driven, checking in after each phase before starting the next —
same pattern as the Location Generator expansion's Tower→Shrine→Rift→Keep→Camp sequencing)

### Phase 0 — Dungeon Level (foundational, unblocks Phase 1 & 2's scaling) — ✅ done, 2026-08-23
Dungeon-shaped sites (Cave/Tomb/Deep tunnels/Ruins, Tower, Keep) gain a `dungeonLevel: number`.
**Assumption, not yet separately confirmed**: derive it from the site's existing Danger Level
roll (Unsafe/Risky/Deadly) mapped to a representative band of B/X's Monster Sub-table Matrix
rows, rather than adding a brand-new roll — Danger Level is already this project's "how
dangerous is this place" knob, so reusing it avoids a redundant second roll. Proceeding on
this basis; flag if you want a fresh independent roll instead.

### Phase 1 — Treasure system — ✅ done, 2026-08-23
Shipped as planned: `src/data/treasureTables.ts` (Treasure Amount/Container/Guards & Wards/
Hidden By-In, all verbatim from B/X Tables 9-12) + `src/engine/generateTreasure.ts`
(`rollTreasure(rng, dungeonLevel, guardedByMonster)`, `describeTreasureAmount`). Wired into
`roomContent.ts`'s `rollRoomContent`/`rollBiasedRoomContent` (new `dungeonLevel` param,
default 1) — only the **Treasure** Room Type outcome gets a rolled treasure, never monster
rooms. B/X's "guarded by a monster, roll the Amount table twice + 1 each" bonus maps directly
onto the Treasure room's own existing "Guarded by monster" detail-table result — no new state
needed. Source-table anomaly found and resolved: Table 12 is captioned "(1d20)" but its
printed rows run 1-21 (row 21 "1 magic item" is a separate line from row 20's own "roll 1d8:
... 6-8 = magic item" sub-result) — folded row 21 into row 20 by widening that row's sub-roll
from 1d8 to 1d10, documented in `treasureTables.ts`'s comment rather than silently dropped.
New `TreasureLine` component shared by DungeonSiteView/TowerSiteView/KeepSiteView. All
scripted-rng tests across `generateDungeon.test.ts`/`generateTower.test.ts`/
`generateKeep.test.ts` updated for the added rng calls (dungeon level roll after danger;
treasure sub-rolls after any Treasure room's detail roll) — 352/352 Vitest tests, `npx tsc
-b`/`npm run build` clean. Browser-verified via `/poi/25` (forces Tomb): header showed
"Dungeon Level 9", a monster-guarded Treasure room rendered two combined amounts ("11,700 sp +
12,600 sp (None, loose)") confirming the roll-twice rule fired; zero console errors.

### Phase 2 — Dungeon dressing + real traps — ✅ done, 2026-08-23
Shipped with two scope-narrowing calls made during the phase (both to keep the change
bounded, documented in-code rather than silently decided):
- **Dressing tables**: only 5 of the book's 13 (Air Currents/Odours/Noises/General/
  Furnishings — the universal-atmosphere ones) are wired up, in `src/data/
  dungeonDressingTables.ts`; the other 8 (Religious/Torture Chamber/Alchemy Lab/Container
  Contents/Personal/Clothing/Food&Drink/Seasonings) are narrative-specific to a particular
  room's story and would read as noise auto-rolled onto a random Empty room, so they're left
  transcribed-but-unwired for now, not built into any roller.
  **Rolled on demand, not baked into generation** — a new `DressingRoller` component (mirrors
  `EncounterRoller`/`generateTavern`/`generateShop`'s existing "manual, not part of the site's
  deterministic rng sequence" pattern) with its own "Roll dressing" button per room in
  DungeonSiteView/TowerSiteView/KeepSiteView. This was a real design pivot during the phase:
  baking all 5 tables into every room's generation-time rng sequence would have meant
  inserting 5 additional scripted rng values into every Empty-room line across 3 test files'
  scripted tests for no real gameplay benefit (dressing doesn't need to be deterministic/
  reproducible via Reroll Site the way monster/treasure content does) — the on-demand pattern
  avoids that test bloat entirely and better fits "flavor a GM asks for when a room needs it."
- **Traps**: new `src/data/trapTables.ts` (50-entry Random Trap d%, verbatim) + a derived (not
  rolled — the book gives no formal die for this, only DM guidance) `trapSeverityForDungeonLevel`
  using the book's own worked example (level 1 -> Nuisance, level 16 -> Fatal) as endpoints.
  **This one IS baked into generation** (unlike dressing) since it's scoped to the existing
  **Trap** Room Type outcome only (not every room) — same bounded-scope shape as Phase 1's
  Treasure wiring. Additive to Shadowdark's existing 2-word Trap flavor tag, not a replacement.
  `roomContent.ts`'s `rollRoomContent` gained a `trap` field alongside `treasure`.
All 3 dungeon-shaped generators' `Room`/`TowerRoom`/`KeepRoom` types gained `trap?: RolledTrap`.
366/366 Vitest tests (one existing scripted test in `generateKeep.test.ts` updated for the one
new rng call a Trap-type roll now consumes), `npx tsc -b`/`npm run build` clean. Browser-
verified via `/poi/25` (Tomb): a Trap room rendered "spring-loaded pile-driver disguised as a
door (Nuisance)"; clicking "Roll dressing" on a room produced a full atmosphere sentence
("The air is strong downdraft; it smells rotting vegetation...."); zero console errors.

### Phase 3 — Settlement depth: Government + economy — ✅ done, 2026-08-23
Shipped as planned, with one correction from the original sketch: population turned out to
need its own roll after all (`rollInRange` within the mapped band), not a pure derivation —
`SettlementType` alone doesn't pin a number, only a range. `settlementTables.ts` gained
`governmentForD6` (Sheriff/Council/Merchant Prince/Adventurer, verbatim from Appendix E) and
`populationRangeForSettlementType` (B/X's Village/Small Town/Large Town/Major City population
bands mapped onto Shadowdark's own SettlementType — Major City's open-ended "15,000+" capped
at 60,000 so it's a concrete rollable range, documented in-code). `generateSettlement.ts`'s
`Settlement` gained `government`/`population` fields, rolled right after the settlement-type
roll. New `src/data/equipmentTables.ts`: static (unrolled) Weapons/Armor/General Equipment/
Food & Lodging/Services/Tavern Meals+Drinks price tables, verbatim from Appendix E. New
`PricesPanel` component (a collapsed-by-default `<details>`) and inline Population/Government
summary lines in `SettlementView`. No scripted-rng tests existed for `generateSettlement`
(already seeded-rng + structural-invariants only, since Voronoi rejection sampling has a
variable rng-call count) so no test rewrites were needed for the 2 new rng calls — only new
invariant assertions added. 384/384 Vitest tests, `npx tsc -b`/`npm run build` clean. Browser-
verified via `/poi/200` (forces Metropolis): rendered "Population: 37,770 — Government: A
powerful merchant prince" with its flavor note, and the Prices panel expanded to show the
Weapons table; zero console errors.

### Phase 4 — Wandering encounters during play — ✅ done, 2026-08-23
Shipped per the scope note (no turn-clock built — confirmed still correct after implementing
the rest). New `src/data/encounterFrequencyTables.ts`: `wildernessEncounterChanceForTerrain`
(B/X's Encounter Frequency table, wilderness half only — mapped from B/X's own broader terrain
terms onto this project's 7-value Shadowdark `Terrain` type via documented closest-match
choices, e.g. Forest/jungle takes Jungle's wider chance since Shadowdark doesn't distinguish
the two) and `encounterPurposeForD8` (verbatim, applies to any setting). New
`engine/rollEncounter.ts` exports: `rollEncounterPurpose` and `checkWildernessEncounterFrequency`
(1d6 gate). `EncounterRoller` gained an optional `wildernessTerrain` prop — when present
(wired from `HexBaseInfo`, the wilderness-terrain roller shown on every hex), clicking now
rolls the frequency gate first and can produce "No encounter," not just always a hit; the
button label changes to "Check for wandering encounter" to signal the new two-step behavior.
Settlement district use (`SettlementView`) omits the prop and keeps its old always-rolls
behavior, since B/X gives urban checks no die-based gate — matching the plan's scope note.
Every successful roll (both wilderness and settlement) now also shows an Encounter Purpose
flavor line. Explicitly **not** built, per the original scope note: a turn-clock state
machine, and B/X's separate dungeon-level-scaled Monster Level tables as an alternate
encounter source (still an open idea for later, not decided). 391/391 Vitest tests (no
existing scripted-rng tests touched — `rollEncounter`'s own signature is unchanged, the gate
is additive-only via the new optional param), `npx tsc -b`/`npm run build` clean. Browser-
verified via `/poi/1` (plain wilderness hex): repeated clicks on "Check for wandering
encounter" produced both a "No encounter." result and a hit with a Purpose line; `/poi/200`'s
Metropolis district roller still works unchanged, now also showing Purpose; zero console
errors in either case.

## Explicitly out of scope for round 1
Full from-scratch procedural dungeon crawler (B/X's 24-table room-by-room generator) — this
project already has its own BSP dungeon layout engine (`dungeonLayout.ts`) that does the same
job at a different fidelity; not replacing it. NPC adventuring-party generation (B/X's NPC
Parties table) — flagged in the gap analysis but not requested in this round. A real turn-clock
state machine (see Phase 4 scope note).

## Round 2 — reading the rest of C/D/E, 2026-08-23

After round 1 shipped, the user asked for a full read of the remaining, previously-unread parts
of Appendix C/D/E (the research subagent that scoped round 1 had skipped straight to
implementation instead of delivering its planned gap-analysis report, so this material had
never actually been surfaced). This time the report was done directly in chat by the main
session, not delegated. Full read covered: the rest of C (Daytime Urban Encounters, Urban
Encounter Level party-level gating, the full Wilderness Encounters system — Terrain Category
Summary, 14 terrain tables × 12 category columns × 20 rows each, Wilderness Encounter Level
party-level tiering, Becoming Lost, Foraging, Terrain Name Cross-Reference, Castle Encounters);
all of D not yet read (Scenarios, Stocking a Room, the full Random Dungeon Generation 24-table
procedural generator, Tricks, Room Names); the rest of E (the Points of Interest catalog +
Populating a Point of Interest staffing rules).

**User confirmed via `AskUserQuestion` (2026-08-23, genuinely this time)**: build all 6 of the
items below, in the order listed, checking in after each before starting the next — same pacing
as round 1's phases and the original Location Generator expansion's Tower→Shrine→Rift→Keep→Camp
sequencing.

1. **Scenarios** (Appendix D, d10) — a dungeon's "reason to exist," one roll per dungeon-shaped
   site.
2. **Tricks** (Appendix D) — on-demand two-table flavor roller (Object + Attribute).
3. **Castle/stronghold reaction** (Appendix C) — Keep only, an owner class/level/patrol/reaction
   block.
4. **Wilderness Encounter Category** (Appendix C's Terrain Category Summary) — feeds the
   existing `rollMonster` pool rather than transcribing B/X's full monster-name grid.
5. **Daytime + Nighttime Urban Encounters** (Appendix C) — two new `EncounterTableKey` entries,
   same flat-string shape as the existing 21.
6. **Settlement Points of Interest** (Appendix E) — a new settlement-level civic-amenity list,
   additive to the existing per-district POI system, staffed via existing NPC sub-tables.

**Confirmed NOT pursued, same reasoning as round 1's exclusions**: the full wilderness
monster-name grid (needs party-level state and non-curated monster names), NPC Parties,
Becoming Lost, Foraging, party-level "out of place" gating, and B/X's full 24-table procedural
dungeon generator (superseded by `dungeonLayout.ts`) — see round 1's own exclusion list above,
which still applies. Stocking a Room and Room Names are also skipped: the former is superseded
by the existing Room Type d10 table (now enriched with treasure/traps), the latter is a
low-value word-combo naming convenience with no real gap to fill.

### Round 2, Phase 1 — Scenarios — ✅ done, 2026-08-23
Shipped as scoped: `data/dungeonTables.ts` gained `dungeonScenarioForD10` (verbatim 10-entry
table). `DungeonSite`/`TowerSite`/`KeepSite` each gained a `scenario: string`, rolled once per
site (`rollDie(10, rng)`, right after the `dungeonLevel` roll) in `generateDungeon.ts`/
`generateTower.ts`/`generateKeep.ts`. Purely descriptive — doesn't feed or bias any other roll.
Shown as a new muted-italic flavor line (`.site-scenario` in `App.css`, matching the existing
`.encounter-purpose`/`.wilderness-note` convention) under the header in `DungeonSiteView.tsx`/
`TowerSiteView.tsx`/`KeepSiteView.tsx`. Camp/Shrine/Rift/Settlement excluded, per the confirmed
scope — they already have their own equivalent flavor mechanism or don't need one. All 3
affected scripted-rng test files updated for the one new rng call each; `dungeonTables.test.ts`
gained full 1-10 roll coverage plus an out-of-range check; the 3 generators' seeded-invariant
tests gained a `scenario.length > 0` assertion. 403/403 Vitest tests, `npx tsc -b`/`npm run
build` clean. Browser-verified via `/poi/25` (Tomb), `/poi/15`, `/poi/18` (both land on Tower):
each rendered a correct "Scenario: ..." line, zero console errors.

### Round 2, Phase 2 — Tricks — ✅ done, 2026-08-23
Shipped as scoped: new `data/trickTables.ts` (Trick Object d100, range-encoded like
`dungeonDressingTables.ts`'s tables; Trick Attribute d100, one entry per roll — no ranges in the
source). `engine/generateDressing.ts` gained `rollTrick(rng): RolledTrick` alongside its
existing `rollDressing`/`rollTrap`. New `components/hexdetail/TrickRoller.tsx`, an exact mirror
of `DressingRoller.tsx`'s on-demand-button shape — rolled on click, not part of any site's
generation-time rng sequence. Wired into the same 3 room lists as `DressingRoller`
(`DungeonSiteView`/`TowerSiteView`/`KeepSiteView`), rendered right after it. `.trick-roller`/
`.trick-result` share their CSS rules with `.dressing-roller`/`.dressing-result` in `App.css`
(same visual treatment, no new styling needed). New `trickTables.test.ts` (full 1-100 coverage
+ boundary spot-checks for both tables) and a `rollTrick` case added to
`generateDressing.test.ts`. 410/410 Vitest tests, `npx tsc -b`/`npm run build` clean.
Browser-verified via `/poi/25` (Tomb): "Roll a trick" button present and produced a real
object+attribute pair ("ceiling, ages"); zero console errors.

### Round 2, Phase 3 — Castle/stronghold reaction (Keep only) — ✅ done, 2026-08-23
Shipped as scoped: new `data/castleTables.ts` (`castleOwnerClassForD3` — a documented house-rule
uniform pick among Fighter/Magic-User/Cleric, since the book gives no odds and explicitly
excludes demi-humans as "special cases"; `castleOwnerLevelRangeForClass`, `castlePatrolForClass`,
`castleReactionForClass` — all 3 verbatim from Appendix C's Castle Encounters table).
`generateKeep.ts`'s `KeepSite` gained an `approach: KeepApproach` block
(`{ownerClass, ownerLevel, patrol, reaction}`), rolled once per site (class d3, level via
`rollInRange` within that class's book-given range, reaction d6 against that class's own
Pursue/Ignore/Friendly ranges) right after the `scenario` roll — independent of room contents,
not tied to the Lord's Quarters room (which may resolve to an NPC, a monster, or nothing).
`KeepSiteView.tsx` shows it as a second `.site-scenario` line under Scenario. Scripted test in
`generateKeep.test.ts` updated for the 3 new rng calls; seeded-invariant test gained assertions
on `approach`'s shape. New `castleTables.test.ts` (26 tests: full coverage of all 4 sub-tables).
436/436 Vitest tests, `npx tsc -b`/`npm run build` clean. Browser-verified via `/poi/14`,
`/poi/16`, `/poi/19` (all force Keep): each rendered a correct "Ruled by a level N Class, backed
by ... . Reaction to the party: ..." line with real variation across rolls (Magic-User/Pursue,
Cleric/Ignore); zero console errors.

### Round 2, Phase 4 — Wilderness Encounter Category — ✅ done, 2026-08-23
Shipped as scoped: `data/encounterFrequencyTables.ts` gained the Terrain Category Summary (d%,
12 categories) for the 7 book terrain rows this project's `Terrain` type maps onto (Plains,
Jungle, Aquatic, Marine, Mountains, Desert, Wetlands — reusing the same terrain-mapping choices
already established for the Encounter Frequency table, plus Swamp→Wetlands directly rather than
the frequency table's River/Ocean fallback, since Wetlands has its own real Category Summary
row). **Real source anomaly found and resolved**: the printed Wetlands row has two overlapping
boundaries (NPC and Undead both starting at 58; Water and Special both touching 95) — resolved
by giving the first-listed column the disputed value and starting the next column one after,
documented in-code, same "documented judgment call" approach as Table 12's off-by-one in
`treasureTables.ts`. `engine/rollEncounter.ts` gained `rollWildernessMonster(terrain, rng)`:
Animal/Dragon/Giant/Humanoid/Undead categories map directly onto the existing `rollMonster`
pool's `MonsterCategory`; Human/Demi-Human and NPC roll a traveler via the existing
`rollSettlementNpc` instead of a monster; Airborne/Monster/Invertebrates/Water/Special (no clean
1-to-1 category match — B/X's own example rows mix wildly different creature types under them)
fall back to an unthemed `rollMonster` pick. No party-level tiering (no state for it) and no
full B/X monster-name grid adopted — see the round 2 intro above for why. `EncounterRoller.tsx`
now rolls this alongside the existing table result whenever `wildernessTerrain` is set (wired
from `HexBaseInfo` only, same as Phase 4 round 1's frequency gate), shown as an additional line
— purely additive, the existing Shadowdark table result is untouched. Settlement district use
(no `wildernessTerrain` prop) is unaffected. New tests: `wildernessCategoryForD100` full 1-100
coverage across all 7 terrains + boundary spot-checks including the resolved Wetlands overlap;
`rollWildernessMonster` seeded coverage across all 7 terrains confirming it always returns a
monster or a traveler, never neither. 442/442 Vitest tests, `npx tsc -b`/`npm run build` clean.
Browser-verified via `/poi/1` (wilderness): repeated rolls produced both "No encounter" and real
hits with a "B/X wandering encounter: ..." line (a themed monster and, separately, a traveler
NPC both observed); `/poi/200`'s Metropolis district roller confirmed unaffected (no B/X line,
old always-rolls behavior preserved); zero console errors in both.

### Round 2, Phase 5 — Daytime + Nighttime Urban Encounters — ✅ done, 2026-08-23
Shipped as scoped: `data/encounterTables.ts` gained two new `EncounterTableKey` entries,
`'B/X Urban (Daytime)'` and `'B/X Urban (Nighttime)'`, transcribed from Appendix C's two 100-row
tables and condensed into the existing flat-string-per-row shape (each row's "Encounter" + "#
Encountered & Notes" columns combined into one display string) — no new mechanism, reusing the
exact `RangeEntry`/`expandD100`/`TABLES` machinery every other table here already uses. Rows
pointing at the excluded Red-Light Professions sub-table (Nighttime rows 44-50 "Prostitute",
Daytime rows 40-41 "Harlot") got neutral substitute text instead, same tonal-mismatch reasoning
`npcTables.ts` already established for that sub-table. `SettlementView.tsx`'s district
`EncounterRoller` now passes `[<district's own table>, 'B/X Urban (Daytime)', 'B/X Urban
(Nighttime)']` instead of a single key — purely additive, the district's own table stays the
default selection, `EncounterRoller`'s existing multi-key dropdown support (unused until now)
handles the rest with no component changes needed. No party-level "out of place" gating adopted
— same no-party-level-state reason as Phase 4. `encounterTables.test.ts`'s existing "every table
has 100 non-empty entries" sweep now covers both new tables automatically (full 1-100 coverage
confirmed, no gaps); added boundary spot-checks for both. 443/443 Vitest tests, `npx tsc -b`/
`npm run build` clean. Browser-verified via `/poi/200` (Metropolis): the district roller's
dropdown correctly listed all 3 options (district's own table + both B/X tables), selecting
"B/X Urban (Nighttime)" and rolling produced a real correctly-formatted result with a Purpose
line; zero console errors.

### Round 2, Phase 6 — Settlement Points of Interest — ✅ done, 2026-08-23 (round 2 complete)
Shipped as scoped, the last and largest of the 6: new `data/settlementAmenityTables.ts`
(`civicAmenityForD20` — verbatim 20-row catalog; `civicAmenityCountDiceForSettlementType`/
`civicAmenityRollRangeForSettlementType` — verbatim Settlement Size dice/roll-range, mapped onto
Shadowdark's `SettlementType` via the exact Village/Town/City/Metropolis → Village/Small
Town/Large Town/Major City correspondence Phase 3 already established for population bands) and
new `engine/generateCivicAmenities.ts` (`rollCivicAmenities`/`rollCivicAmenityStaff`), which
implements Appendix E's "Populating a Point of Interest" staffing rules by reusing existing
`npcTables.ts` machinery rather than inventing anything: ordinary shops/trades/services get a
plain `rollSettlementNpc`; Market Square gets 2-4 of them (vendors); Town Militia/Guard Post gets
a reroll-toward-bias pick (City Guard/City Watchman/Fighter — same "roll normally, one more
chance on a miss" shape as `roomContent.ts`'s `rollBiasedRoomContent`, proven with a scripted
test after an initial statistical version came back flaky from LCG seed correlation, the same
class of issue already documented for `generateShrine.test.ts`); Shrine/Small Temple and Church
both get a level 1d6+5 Cleric (the book's own Nighttime/Daytime Cleric formula, reused rather
than inventing a raise-dead-specific threshold the book doesn't actually give); Thieves' Guild
gets a level 1d4+7 Thief, Mercenary/Adventurers' Guild Hall a level 2d4+4 Fighter, Wizard's
Tower/Arcane Academy a level 1d6+6 Magic-User (all 3 formulas lifted directly from the matching
Nighttime/Daytime encounter entries, per the book's own instruction to reuse them); Noble's Manor
rolls directly on the existing Noble Professions sub-table (`nobleClassForD100` +
its established 1d8+4 level formula) rather than waiting for a random Urban Profession roll to
land on Noble; Sage/Scholar and Something Unusual are flavor-only, matching the book's own
"DM's choice"/"DM's invention" framing for both. `generateSettlement.ts`'s `Settlement` gained
`amenities: CivicAmenity[]`, rolled once per settlement (independent of districts/roads) —
explicitly additive to, not a replacement for, the existing per-district `pointsOfInterest`
system (B/X has no district concept at all). New `components/hexdetail/CivicAmenitiesPanel.tsx`,
a collapsed-by-default `<details>` in `SettlementView.tsx` (same UI pattern as `PricesPanel`,
rendered right before it), listing every amenity with its type and a one-line staff description
covering all 5 `CivicAmenityStaff` kinds. New `.civic-amenity-list` CSS rule shares the existing
`.room-list`/`.district-list` styling. New tests: `settlementAmenityTables.test.ts` (11: full
1-20 coverage, boundary spot-checks, and both dice/roll-range tables for all 4 settlement types);
`generateCivicAmenities.test.ts` (4: every amenity type produces a well-formed staff result
across seeds; the Guard Post bias proven deterministically via scripted rng; count/type
invariants across all 4 settlement types; Village never rolls a roll-range->8 rare type);
`generateSettlement.test.ts` gained an `amenities` structural-invariant block. 458/458 Vitest
tests, `npx tsc -b`/`npm run build` clean. Browser-verified via `/poi/150` (small settlement: 1
amenity, correctly roll-range-restricted) and a sweep of `/poi/150`-`/poi/200` (Metropolis: 19
amenities including a real "Something Unusual" flavor entry; Church → "Level 6/7 Cleric";
Thieves' Guild → "Level 9 Thief"; Wizard's Tower → "Level 7 Magic-User"; Market Square → 3
distinct vendor NPCs joined in one line; Noble's Manor → "Normal Human"; Town Militia correctly
landing on Mercenary shows the bias can still miss both rolls, as designed); zero console errors
throughout.

### Post-round-2 bug fix — wilderness roller showed two unrelated encounters at once — ✅ fixed, 2026-08-23
User-reported (real bug, not a scope question): clicking "Check for wandering encounter" always
rolled and displayed BOTH the existing Shadowdark terrain-table result AND the Phase 4 B/X
category result together (e.g. "1d4 ankhegs hiss and spit at a rampaging bulette" stacked with an
unrelated "B/X wandering encounter: Ghoul (Undead)") — nonsensical, since these are two
independent single-encounter systems, not two things happening at once. Fixed in
`EncounterRoller.tsx`: the two sources are now mutually exclusive, selected the same way
Phase 5's B/X Urban tables already are — a `BX_WILDERNESS_SOURCE` sentinel joins `tableKeys` in
the dropdown whenever `wildernessTerrain` is set, and `roll()` produces exactly one
`RollResult` (a discriminated union: `'table'` or `'bx-wilderness'`) per click, sharing the same
frequency gate. 458/458 Vitest tests still pass (no engine-layer code touched, purely the
component's roll/render logic), `npx tsc -b` clean. Browser-verified via `/poi/1`: the dropdown
now lists "Grassland" + "B/X Wandering Monster" as separate selectable sources, each producing
exactly one coherent result with no cross-contamination between them; zero console errors.

### Post-round-2 bug fix — wandering encounters had no party level to gate against — ✅ fixed, 2026-08-23
User-reported alongside the bug above: a level-1-appropriate result ("1d4 ankhegs") appeared next
to an unrelated Ghoul, and more fundamentally, nothing in the encounter roll ever accounted for
party strength — this app had **no party-level concept anywhere** (confirmed via a repo-wide
grep before starting). Scoped and confirmed with the user (2026-08-23, via `AskUserQuestion`):
add real `partyLevel` state, gate wilderness monster categories by it, and — since the same
blocker had separately stopped Phase 5's Urban Encounter Level "out of place" gating — wire that
too while the state was being added.

**New state**: `MapState` gained `partyLevel: number` (default 1, reset to 1 on `START_MAP`), a
new `SET_PARTY_LEVEL` reducer action (clamped to a minimum of 1), and a small number-input control
in `Toolbar.tsx` (campaign-wide, not per-hex — no reason to thread it through props everywhere,
so `EncounterRoller.tsx` reads it directly via `useMapState()`). `MapContext.tsx`'s `initMapState`
now merges a loaded save over `EMPTY_MAP_STATE` rather than trusting it outright, so a save from
before this field existed doesn't come back with `partyLevel: undefined` at runtime despite the
type — verified by seeding a pre-existing-shaped save into `localStorage` directly and confirming
it loads with `partyLevel: 1`, no crash.

**Wilderness monster gating**: B/X's real Wilderness Encounter Level table restricts which *row*
of the (deliberately-not-adopted) per-terrain monster grid is reachable by party level — since
this project substitutes the existing `rollMonster` pool instead of that grid, there's no row to
restrict. Adapted as a category exclusion instead, at the same three level thresholds the book
gives: level 1-3 excludes Dragon/Undead/Demon, level 4-6 excludes Dragon/Demon, level 7+ excludes
nothing — reusing `rollMonster`'s existing `excludeCategories` option (the same mechanism that
already keeps Boss Monster away from giant ferrets). `rollWildernessMonster`'s signature gained a
required `partyLevel` parameter.

**Urban Encounter Level gating (Phase 5 bonus)**: the two B/X Urban tables' `RangeEntry`s became
`GatedRangeEntry`s with an optional `minPartyLevel` on the specific rows the book calls
out (Wererat/Weretiger/Werewolf: 3+; Demon/Devil/Ghost/Night Hag/Rakshasa/Shadow/Spectre/Wight/
Will-O-Wisp/Wraith: 5+; Vampire or Lich: 8+), plus a new `minPartyLevelForBxUrbanEncounter`
lookup. New `rollBxUrbanEncounter(key, partyLevel, rng)` in `rollEncounter.ts` implements the
book's "reroll" option (of its three DM choices for an out-of-place result) as a bounded retry
(max 20 attempts) rather than surfacing an out-of-place result and asking the GM to judge it
mid-click.

`EncounterRoller.tsx` now dispatches to whichever of `rollEncounter`/`rollWildernessMonster`/
`rollBxUrbanEncounter` matches the selected source, all sharing `partyLevel` from `useMapState()`.
New/updated tests: `mapReducer.test.ts` (`SET_PARTY_LEVEL` clamping, `START_MAP` reset);
`encounterTables.test.ts` (`minPartyLevelForBxUrbanEncounter` boundary checks); `rollEncounter.test.ts`
gained scripted (not statistical — an earlier statistical version of these same assertions came
back flaky across only a handful of seeds, consistent with this project's established LCG-seed-
correlation caution) coverage for both gating mechanisms at each tier boundary. 470/470 Vitest
tests, `npx tsc -b`/`npm run build` clean. Browser-verified end-to-end via the real map flow (not
just `/poi/:n`, since its throwaway provider fixes `partyLevel` at 1): started a map, confirmed
the Toolbar's Party Level control defaults to 1, rolled 40x on "B/X Wandering Monster" at level 1
(zero Dragon/Undead/Demon results), bumped the control to 10 via the Toolbar, rolled 60x on the
same hex (Dragon/Undead/Demon did appear); separately confirmed a Metropolis district's "B/X
Urban (Nighttime)" roller never surfaced a gated row across 40 rolls at level 1. Zero console
errors throughout.

### Post-round-2 follow-up — party level needed a dropdown on the generators themselves — ✅ done, 2026-08-23
User-requested: the Toolbar's campaign-wide party-level number input meant changing it to test a
different level required leaving the generator you were looking at. Added a party-level
`<select>` (1-20) directly to the two places that actually consume it:
- **`EncounterRoller.tsx`**: a local `partyLevel` state, seeded from the campaign's
  `useMapState().partyLevel` on mount, then a fully independent override — lets a GM roll a
  single wandering encounter at a different level without touching the tracked campaign value.
  Verified this independence directly: set the roller's dropdown to 9 while the campaign level
  stayed at 1, and Dragon/Undead/Demon results became reachable — confirming the local override,
  not the campaign value, is what the roll actually uses.
- **`PoiReviewPage.tsx`**: previously had no party-level control at all (its throwaway
  `MapProvider` hardcoded `partyLevel: 1`), so B/X wandering-monster/Urban gating could never be
  previewed above the lowest tier from this tool. Added a `partyLevel` local state + dropdown
  next to the existing Terrain selector, folded into both the synthetic `initialState.partyLevel`
  and the `MapProvider`'s remount `key` (same pattern the Terrain/roll/rerollNonce keys already
  use) so changing it produces a fresh site generation at the new level.

Both share a `.party-level-control` CSS treatment with the Toolbar's original control (extended
to also style `select`, not just `input`). No engine-layer changes — `rollWildernessMonster`/
`rollBxUrbanEncounter` already took `partyLevel` as a parameter, this just gives two more UI
surfaces a way to set it locally. 470/470 Vitest tests unaffected (no engine code touched), `npx
tsc -b`/`npm run build` clean. Browser-verified: `/poi/1`'s Party Level dropdown set to 10
produced Dragon/Undead/Demon results on "B/X Wandering Monster," set back to 1 stopped producing
them (same site, same URL, live remount); `EncounterRoller`'s own dropdown proven independent of
the campaign value as described above. Zero console errors throughout.

**Round 2 of the B/X/OSRIC integration is now fully done** — all 6 confirmed items (Scenarios,
Tricks, Castle reaction, Wilderness Encounter Category, Daytime/Nighttime Urban Encounters,
Settlement Points of Interest) shipped, tested, and browser-verified. Combined with round 1
(Dungeon Level, Treasure, Dungeon dressing + traps, Settlement depth, Wandering encounters
during play), this project now draws on B/X Appendices C, D, and E about as fully as makes sense
without either adding party-level state this app doesn't track, or replacing systems (the BSP
dungeon layout engine, Shadowdark's own terrain/encounter tables) that already do their job at a
different, deliberately-chosen fidelity.

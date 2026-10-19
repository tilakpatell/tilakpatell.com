## Global Constraints

- **The 50 roster planets don’t move.** That’s the galaxy’s 17, Rick and Morty’s 10, the fandoms’ 10 and the 13 seeded Expanse planets.
  - Their 17 existing spec fields, their ground heights, their life and their clutter kits hash to Task 1’s `ROSTER_LOCK` from Task 1 to the end.
  - The new fields are added beside the old ones, at the fixed values in `ROSTER_EXTRA`.
- **`TERRAIN_VERSION` stays 2.** `planetSpec.test.js`’s `GROUND` hash doesn’t move. The version’s rule is about the 50, the only planets anything is built on (spec: “No `TERRAIN_VERSION` bump touches them”).
- **No new places on the seeded planets.** The 13 seeded Expanse planets get no new POIs and no new no-build zones.
- **Building stays on the 50.** Building happens on the 50 only (`spec.buildable`). Every other planet reads nothing from Supabase and writes nothing to it. There’s no migration and no change to `supabase/`.
- **A spec is plain data.** It crosses to the terrain worker and the orbit-map worker by `postMessage`, so it holds no functions or class instances. Bigints travel as strings, directions as `[x, y, z]` unit arrays and colours as `'#rrggbb'`.
- **Ids are lower case and canonical.** Parse them with `address.js`’s `parseSpaceId` and rebuild them with `spaceId(...).toLowerCase()`.
  - Either case is read.
  - A sector may have 2 or 3 numbers. A sector of the middle layer is written with 2.
- **Map layout.** The equirectangular layout is `landings/biomes.js:45-61`’s `uvOf` and `fromLatLon`: u runs from −x toward +z, and v is 0 at the north pole (the image’s top row).
- **Ground size.**
  - Ground radius is 15,000 to 60,000 m, linear in the universe radius from 18 to 70 and clamped. A moon, or a row with no radius, gets 15,000 m.
  - The climate is sampled on the unit direction, so its wavelength scales with the circumference.
- **The flight’s ground limits** (`field.test.js:59-75`): every height is finite, within −200…1200 m, and never more than 60 m apart over 4 m outside a POI’s edge.
- **The orbit map.**
  - Size: 256 × 128 on `low` and `mid`, 512 × 256 on `high` and `ultra`.
  - Format: RGBA sRGB bytes, with alpha 0 under water and 255 elsewhere.
  - It’s never stored: not in `localStorage`, IndexedDB, `rt.store` or `rt.saves`. It’s cached in memory, at most 16 maps.
- **One noise wrapper.** 3D noise goes only through `fnl.js` (`docs/stack/fastnoise-lite.md`). No new dependency.
- **Lane boundaries.** Untouched: `src/components/expanse/gen/*`, the universe scene, `galaxy/bodies.js`, `entry.js`, the walker and `supabase/`.
- **Pure first.** `src/lib/**` imports no React, no DOM and no three.js.
  - Tests sit beside their files, each runs under a second, and none touches the network.
  - Fixtures live in `fixtures/` beside the test.
  - Each file stays under 800 lines.
- **Copy.** British spelling, curly quotes, sentence case, one sentence to a toast.
  - No model names in code, docs or commits (HANDOFF-universe’s rule), so commit messages carry no co-author line that names one.
- **Before done:** run `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build` and `node scripts/flight-island.mjs --check`. Ship one pull request with a merge commit.

## Review Focus

1. **Ids typed by hand.** `/fly/E:1,0,0:0:1`, an id with trailing junk, a system id, a wonder id, or a moon past its planet’s count: each gives the canonical spec or the 404, and none throws. Tested in Task 5.
2. **Flying far from the landing spot.** At πR (the far side) and past 2πR, the ground stays finite, continuous and within the 60 m in 4 m rule, the antipode included. Tested in Task 7.
3. **One planet, one description.** A planet’s spec, and so its orbit map, is the same whichever lookup built it: the universe’s or the flight’s, with any siblings known or none. Tested in Task 8.
4. **A bake asked in any state.** A bake asked twice at once, cancelled, failed, or for a plane, gas or moon spec makes one bake, doesn’t cache a null and never throws. Tested in Tasks 10 and 11.
5. **A world you can’t build on.** There’s no sign-in and no Supabase read or write. B answers with a sentence, and X has nothing to take down. Tested in Task 12.

## Process for this run (controller's rulings override the plan where they say so)

- Work only in C:\Users\tilak\src\tilakpatell.com\.claude\worktrees\agent-a10cc0ddd5a5df834 on branch claude/endless-universe-lane-5a-unique-planets. Never push, never force, never rebase, never touch git stash.
- Every commit message ends with exactly these two lines (after a blank line), overriding the plan's “no co-author line”:
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01PJqkNSL8smFuirsPmEJGyM
  Use the plan's commit subject. Pass the message with a heredoc or -F file.
- Windows: `npm test` has pre-existing failures listed in C:\Users\tilak\src\tilakpatell.com\.superpowers\sdd\windows-test-baseline.txt (Windows paths, missing assets). Don't fix them. Green locally = no failing file outside that list, and every test you touch passing.
- Run focused tests with `npx vitest run <files>`.
- House style: British spelling, curly quotes in prose/comments/copy, sentence case; comments say why; header comment on each new file listing its exports (see src/lib/land/flight/field.js or fnl.js). No model names in code or docs.
- The ledger with every ruling: C:\Users\tilak\src\tilakpatell.com\.claude\worktrees\agent-a10cc0ddd5a5df834\.superpowers\sdd\2026-10-18-endless-universe-lane-5a-unique-planets\progress.md (read the "Rulings" section; don't edit the ledger).
- HARD RULE — sharing the machine's CPU: another session runs merge gates here. Before any browser/Playwright run (any scripts/*-check.mjs, perf-probe, autopilot-check, the contact-sheet render), a full `npm test`, or `npm run build`, wait until the lock file is gone: `while [ -f "D:/Custom BFEngine/.locks/cpu-quiet" ]; do sleep 30; done` (run it with a long tool timeout). Focused `npx vitest run <file or a few files>` runs are fine at any time. A heavy run stopped for this is not a code failure: wait and rerun.

# Lane C1: one cast table, the galaxy reading it

Design: `docs/superpowers/specs/2026-10-21-battlefront-by-default-design.md`, decisions 1 and 2. Branch `claude/bf-default-c1-cast`. One PR. Wave 1: C2, A1 and A2 run beside it and touch none of these files.

## Read first

- `src/components/galaxy/surface/crewList.js` (the `CREW` table, `fileOf`, `faceOf`, `filesOf`, `figureLoaderFor`, `cutsOf`) and `crewList.test.js`, `crew.js`, `crew.*.test.js`.
- `src/components/galaxy/surface/standIn.js`, `heroes.js` (its `crew()` and `bf2017()` helpers and `SKINS`), `surface/troopers.js`.
- `docs/health/RULES.md` (“Layers”: `src/lib` knows no React and no three.js; `src/data` imports nothing).
- `scripts/galaxy-figures-audit.mjs` (the shape of an audit script here).

## Tasks

1. **`src/lib/cast/bodies.js`.** Move every `CREW` row into it as `BODIES`, keeping each row’s fields and comments, adding `source: 'game' | 'site'` (a `rig: 'walrus'` or `rig: 'own'` row is `'game'`; `battledroid` and every other is `'site'`), and on each `'site'` row a `could` string where the game or a known mod has the kind (the design’s “What was found” says which: the B1 waits on its markings; Rex, Bo-Katan, Jango, the Mandalorian, Ahsoka, Qui-Gon, Greedo, Hondo, Fennec, Cara Dune and Greef are Battlefront Expanded’s; the Gamorrean has the game’s `gamorreanguard`; the Tusken, Twi’lek, Ugnaught, Neimoidian, Rodian, Bith, Lobot, Wuher, Dex, the Wing Guard, the Senate guard, Jabba, Bib Fortuna, the Aqualish, the mustafarian, the Jedi, Shaak Ti, Ackbar, the Inquisitor have none: `could` is `null` with a word why). Export `bodyOf(kind)`, `gameFirst(kinds)`, `sourceOf(kind)`, `fileOf`, `faceOf`, `filesOf`, `figureLoaderFor`, `cutsOf` (moved from `crewList.js`, same signatures). No three.js, no React.
2. **`src/lib/cast/bodies.test.js`.** Every row has `url` or `name`, a `tall`, a `source`; every `'game'` row names a file under `/models/galaxy/bf2017/crew/`; every `'site'` row has a `could` (a string or `null`); every row’s committed file (the light cut for a `lod` row, the file itself otherwise) exists under `public/` or is listed in `src/data/galaxyAssets.json`; a snapshot of the kinds, so a removed kind fails.
3. **`crewList.js` becomes a reader.** `export const CREW = BODIES` (or a filtered view if any row must stay galaxy-only: none is known) and re-exports of the helpers from `src/lib/cast/bodies.js`, so every importer (`crew.js`, `heroes.js`, `standIn.js`, `actors.js`, the tests) keeps its import path and names. `crewList.test.js` keeps passing unchanged.
4. **`scripts/cast-audit.mjs`.** Prints a table: kind, source, file, could; then the counts by source and the number of `'site'` rows with a `could`. `node scripts/cast-audit.mjs` in the PR body.
5. **Docs.** `docs/architecture.md`: a paragraph for `src/lib/cast/` under “Where things live”; `docs/superpowers/HANDOFF-galaxy.md` “Landed”: one line. `src/data/health/` budgets untouched.

## Done when

- `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build` green.
- The galaxy changes no pixel: `node scripts/autopilot-check.mjs --skip lint,test --routes /galaxy/tatooine/surface --shots c1 --before` on `main` before the change, the same after, the two screenshots compared and said to be the same in the PR.
- The PR body carries the audit’s table and counts.

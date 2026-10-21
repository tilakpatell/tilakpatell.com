# Lane C3: the universe, the Death Star and the cockpit on the game’s bodies

Design: `docs/superpowers/specs/2026-10-21-battlefront-by-default-design.md`, decision 4. Branch `claude/bf-default-c3-people`. One PR. Wave 2: starts once C1 (`src/lib/cast/bodies.js`) is on `main`.

## Read first

- `src/lib/cast/bodies.js` (C1’s table: `bodyOf`, `figureLoaderFor`, `cutsOf`).
- `src/components/universe/footFigures.js` (`PARTY`, `loadModel`: the walrus path is there), `footScene.js`, `footScene.walrus.test.js`, `sides.js` (`STARWARS.troops`), `gunplay.js`.
- `src/components/deathstar/inside/rules/cast.js`, `scene/figures.js` (`loadPerson`, the 24-bone skeleton, the animator), `scene/views.js`, `pack.js`; `docs/superpowers/specs/2026-10-07-deathstar-inside-design.md` and `2026-10-08-deathstar-cast-design.md`; the owner’s rule: the rooms, kit and stories stay as they were.
- `src/components/cockpit/crew.js` (Chewbacca).
- `src/lib/three/walrus.js`, `walrusCuts.js`, `walrusStance.js`, `ownRig.js`, `walrusClips.js` (the packs: which clips a 2017 body has for a figure that walks, aims, falls, sits).
- `docs/health/RULES.md` “Worlds are islands”: the universe, the Death Star and the cockpit import from `src/lib/` and `src/components/galaxy/shared/` only.

## Tasks

1. **The universe’s people.** `PARTY`’s Han, Luke and Chewbacca take their rows from `bodyOf('han')`, `bodyOf('luke')`, `bodyOf('chewie')` (the 2017 bodies, `rig: 'walrus'`, their packs); `sides.js`’s Star Wars `troops` take `stormtrooper` and `scouttrooper` from the table (the light cuts, committed). The probe stays built. Check a landing on foot and the troops’ patrol (`scripts/universe-war-check.mjs`, a landing by hand): they walk, aim, fire and fall on the game’s clips.
2. **The Death Star’s cast on the game’s skeleton.** `scene/figures.js` gains a walrus path beside the 24-bone one, modelled on `footFigures.js`’s (`loadWalrusBody`, `cutsToLoad`, `swapBody`, `withStance`, `createAdditiveLayer`), returning the same `person` interface (`play`, `base`, `look`, `setAim`, `hold`, `fall`, `rise`, `update`, `dispose`) so the rules, the fights and the stories see no change; `fall` on the game’s ragdoll (`lib/three/ragdoll2017.js`) where the body is the game’s. `rules/cast.js` names the game’s rows (through `bodyOf`) for `stormtrooper`, `officer`, `deathtrooper`, `vader`, `emperor`, `leia`, `luke`, `han`, `chewie`, `threepio`, `r5`, `gonk`, `artoo` (`astromech`); the Royal Guard, the IT-O, the dianoga, old Ben and the TIE pilot stay as they are (the game has none, or the body is a dressed other). The clip aliases the rules use (`ALIAS`, `PRELOAD`) map onto the pack’s names for a walrus body; a clip the pack lacks falls back to the library’s on the 24-bone path only where the design’s rule allows (say which in a comment) and otherwise to a still.
3. **The cockpit’s Chewbacca** from the table.
4. **Shots.** Each swapped person beside the old at the same place (`scripts/deathstar-check.mjs`’s rooms, the universe’s landing), in the PR.
5. **Bytes.** `WORLD_MB` for `/deathstar/inside`, `/universe` and `/cockpit` measured before and after; a row moves only with its sentence.
6. **Docs.** `HANDOFF-universe.md` and the Death Star’s section of `HANDOFF-galaxy.md`: one line each.

## Done when

- `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build` green; `scripts/deathstar-check.mjs` within budget; `DS_AUTOPLAY=1 npx vitest run src/components/deathstar/inside/rules/play/autoplay.test.js` green; `scripts/universe-war-check.mjs` green.
- No Star Wars person on the universe map, aboard the Death Star or in the cockpit wears a Meshy or 2005 body where the game has one.

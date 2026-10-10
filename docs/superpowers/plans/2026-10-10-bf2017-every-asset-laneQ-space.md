# Battlefront 2017, lane Q: the space levels, the capitals and the skies. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, yourself, in order. Steps use checkbox (`- [ ]`) syntax for tracking. Build directly; one judge pass at most before the PR.

**Goal:** The space layer's set pieces over Endor, Fondor, Kamino, Naboo and the Separatist blockade are the game's space levels (placed capitals, the dry dock, the platforms, the Death Star II under construction, the asteroid fields spinning on their tracks); the capital ships the space layer draws are the game's where lane V did not find the site's better; each system's starfield is the game's panorama where the drop has one; the galaxy map's discs are the front end's globes.

**Architecture:** A space pack per `SB_*` map (`scripts/bf2017-space.mjs` over lane L's `readMap` and E0's tracks writer) read by `galaxy/places.js`'s place kinds and `rocks.js`; capitals through `bf2017-fleet.mjs`'s path (`galaxy/models.js` rows' files written again); the panoramas as equirect textures the space sky bakes from; the discs from lane K's `PICTURES`.

**Tech Stack:** `scripts/lib/bf2017-level.mjs` (`readMap`), `scripts/lib/bf2017-level-tracks.mjs` (E0; if E0 is not on `main` yet, the writer lands here and E0 reuses it: say which in the PR), `scripts/bf2017-fleet.mjs`, `scripts/galaxy-lod.mjs`, `src/components/galaxy/{places,rocks,models,world,sky}.js`, `scripts/lib/bf2017-planets.mjs` (`PICTURES`), `galaxy-check.mjs space`, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-10-bf2017-every-asset-design.md` (§3 lane Q).

## Global Constraints

- The era rule: SB_Resurgent_01 and SB_SpaceBear_01 are out; `_battlebeyond` and `cinematics/spacebattles` rows that are sequel ships are out by name.
- The native rule and the caps; a capital's plain cut the game's first LOD under 60,000 triangles (lane V's `NATIVE_VEHICLE`), its far copy by `galaxy-lod.mjs`.
- #793 (space battles 1) owns the war's ship rows: Q changes no `battle*` file; it reads #793's branch and writes to the set-piece files only.
- The space layer's budgets (`galaxy-check space` rows) unmoved.
- Files under 800 lines; British spelling and curly quotes; commits one plain sentence with the attribution lines.

## Review Focus

1. **A system with no space map** (Hoth, Tatooine…) keeps its set pieces as today (task 2's test: `piecesFor('hoth')` unchanged).
2. **A placed capital the fleet also flies** (an ISD over Endor placed by the map and one flown by the war) must not draw twice at one spot: the pack's static hulls are `backdrop` kind, never the war's slots (task 2).
3. **A panorama's seam** at u = 0: the sky's bake must sample with wrap and the shot shows no line (task 4's shot at the seam azimuth).
4. **The asteroids' tracks** at t beyond the last key: the Hermite evaluation holds the last value or loops as the track's `loop` says (task 3's test).

---

### Task 1: The space packs

- Create: `scripts/bf2017-space.mjs` (`node scripts/bf2017-space.mjs <map> --system <id>`: the map's instances grouped by model into `src/data/galaxy/space/<system>.json` `{ pieces: [{ model, kind: 'capital' | 'station' | 'dock' | 'platform' | 'rock' | 'backdrop', at, quaternion, scale, track? }] }` with the models imported through `bf2017-library-import.mjs`'s path (or `bf2017-import.mjs --native --far` directly if lane O is not on `main`) into `public/models/galaxy/space/<slug>.glb` and published), `scripts/lib/bf2017-space.mjs` (`piecesOf(map, { kindOf })` pure)
- Test: `scripts/lib/bf2017-space.test.mjs` (fixture: `scripts/fixtures/bf2017/web/maps/levels/space/sb_endor_01/` trimmed to thirty instances)
- [ ] Failing test → FAIL → implement; run on the five maps → PASS. Commit `The game's space levels as set-piece lists`.

### Task 2: The set pieces placed

- Modify: `galaxy/places.js` (`PLACE_KINDS` gain `dock`, `platform`, `backdrop`; `piecesFor(system) → [piece]` from the JSON), `galaxy/world.js` (the pieces built through `models.js`'s `slot` for capitals and a static loader for the rest), `galaxy/models.js` (the capitals' rows: Venator, MC80, CR90, Lucrehulk, Providence, Arquitens at the files `bf2017-fleet.mjs` writes; the Sketchfab ISD and Nebulon-B stay), `scripts/bf2017-fleet.mjs` (the capitals' rows)
- Test: `places.test.js` (Review Focus 1 and 2), `models.test.js` (the measured files)
- [ ] Failing tests → FAIL → implement; `node scripts/bf2017-fleet.mjs && node scripts/galaxy-lod.mjs <capitals>` → PASS; `galaxy-check space endor,fondor,kamino,naboo` at high. Commit `Over Endor, Fondor, Kamino and Naboo, the game's own fleets and stations`.

### Task 3: The rocks on their tracks

- Modify: `galaxy/rocks.js` (`createRocks({ kind: 'placed', pieces })`: the map's asteroid instances (one `InstancedMesh` a model) spun by their `animtracks` through `src/lib/three/tracks.js` (E0's; else written here and shared))
- Test: `rocks.test.js` (Review Focus 4), `src/lib/three/tracks.test.js`
- [ ] Failing tests → FAIL → implement → PASS. Commit `The asteroid fields the game placed, turning on the game's tracks`.

### Task 4: The skies and the discs

- Modify: `galaxy/sky.js` (`createSky({ panorama })`: an equirect from `public/textures/galaxy/sky/<system>.ktx2` (the game's own KTX2 with mips dropped to 4096 at ultra, 2048 high, 1024 mid; published) composited under the baked stars for the systems whose panorama the drop names: Endor (`t_space_endor01_c`), Athulla, the generic `t_space_01_c` for the Core, `t_space_no_large_stars_01_c` for the Outer Rim; the `t_sky_space_01_c` cube for the Death Star), `scripts/bf2017-sky.mjs` (a `--panorama <name> --system <id>` form), the galaxy map's planet discs (`MapSvg.jsx` or `HoloMap.jsx`, whichever draws the discs: a `PICTURES` globe as the disc's image where the drop has one, through `planetSkins.json`'s `picture` field lane K left optional)
- Test: `sky.test.js` (a system with a panorama → the bake samples it; without → unchanged), the map's test
- [ ] Failing tests → FAIL → implement → PASS; a shot at the seam azimuth; `galaxy-check space` at four tiers. Commit `The game's star fields behind the space layer, and its globes on the map`.

### Task 5: The three VP6 movie textures (desktop)

- [ ] Write `scripts/desktop/bf2017-vp6.ps1` (for the owner's machine: `ffmpeg -i <vp6> -c:v libvpx-vp9 -b:v 2M <webm>` for `MT_CapitalShipDestruction.vp6` and `deathStarII_event010_mainExplosion_v003.vp6`; the Starkiller one excluded), and the consumer in `galaxy/fx.js` (`videoLook('capital.death' | 'deathstar.end')` through lane M's `<Film>` as a `VideoTexture` on high and ultra; null until the WebM is published). Test: `fx.test.js` (null → the site's own flash). Commit `The game's capital-ship death and the Death Star's end, as video textures when converted`.

### Task 6: The hand-off and the PR

- [ ] `HANDOFF-bf2017.md`'s fifth-design table: Q's rows; `HANDOFF-fleet-war.md` or the space battles' hand-off: the set pieces are the game's, #793's seam; the ledger refreshed.
- [ ] `npm run lint`, `npm test`, `npx vite build`; merge `origin/main`; PR titled `The space layer on the game's space levels: its capitals, docks, asteroid fields and star fields`.

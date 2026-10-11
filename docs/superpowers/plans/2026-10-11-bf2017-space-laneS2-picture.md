# Battlefront 2017, lane S2: space in the game’s picture. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, yourself, in order. Steps use checkbox (`- [ ]`) syntax for tracking. Build directly; one judge pass at most before the PR. **Starts when lane T2’s #912 is on `main`.**

**Goal:** the galaxy’s space (the `galaxy` module: the hub, the planets from orbit, travel, the space battles, the war) is drawn on the node renderer above low, in the game’s picture: each system’s space map’s VisualEnvironment record applied, every space panorama in the drop published and placed, the asteroid fields on the game’s debris, the capital-death films wired for the day they are published.

**Spec:** `docs/superpowers/specs/2026-10-11-bf2017-galaxy-in-space-design.md`, decisions 3 and 4; the picture-everywhere design (`2026-10-11-bf2017-picture-everywhere-design.md`) §3 and lane T2’s hand-off section (the flip’s pattern: `surface/nodes/`, `surface/looks/{nodes,classic}.js`, the `classic` import marker, `shading.test.js`’s `CLASSIC` list, `pickBackend` by level); lane P’s section (`bf2017-picture.mjs`, `applyGameLight`); the space lane’s section (`bf2017-sky.mjs --panorama`, `skyPanorama.js`, `rocksPlaced.js`, `capitalFilm.js`).

**Tech stack:** `src/runtime/backend.js`, `src/runtime/shadingClosure.js`, `src/runtime/shading.test.js`, `src/components/galaxy/module.js`, `src/components/galaxy/nodes/` (new), `src/components/galaxy/{sky,skyPanorama,bodies,bodyShaders,bodySkin,bodyShield,placesDraw,rocks,rocksPlaced,skyStreaks,tunnel,fx,gateway,interdictor,levelArea,areaWeather,world,scene}.js`, `src/lib/three/light/post.js`, `scripts/bf2017-light.mjs`, `scripts/bf2017-picture.mjs`, `scripts/bf2017-sky.mjs`, `scripts/galaxy-check.mjs space`.

## Global constraints

- The node closure holds no GLSL: every classic file is reached only through an import marked `import(/* classic */ '…')` and pinned by name in `shading.test.js`’s `CLASSIC` list; `onBeforeCompile` and `ShaderMaterial` never enter the `'nodes'` graph (`shadingClosure.test.js` holds it).
- The renderer table is the surface’s (`pickBackend`’s cells, `backend.test.js`): WebGPU; `nodes-webgl` on high and ultra without WebGPU; classic on low and on mid without WebGPU; `?gpu=classic` and `?gpu=webgl` honoured. A level that wants the other renderer reloads the world only through the settings panel’s offer, as T2 made it.
- Nothing hand-tuned where the record has a number; where it has none, the site’s constant keeps its `_source`. A system without a space map takes a named record with the choice written in `skyPanorama.js`’s table.
- Published files by hash, never through git; the panoramas under `public/textures/galaxy/sky/space/`, their probes beside them committed as before. A refused bucket write goes to the parent session (session_01282C5tuJnxtHN4SCrT1kct) with the branch, the commit and the `--only` globs.
- One PR, draft, `origin/main` merged in before it keeping both sides (S1’s `models.js` rows beside this lane’s materials); the five checks; never a test skipped or quieted; budget rows raised only with their reason.
- British spelling, curly quotes, `_source` on every number. Keys never printed or committed.

## Review focus

1. **The twins match.** Each node twin is shot against its classic frame on the lit fixture or the system it draws (`scripts/reference-frames.mjs --plain` and `frame-score.mjs` from lane G1 where on `main`, else `galaxy-check space` shots): PSNR over 40 dB (`_source`: lane G1’s bar) or the difference named in the evidence as the picture’s (a tone map the classic never had is not a mismatch).
2. **Every layer on.** On high and ultra a system shows: the panorama, the record’s tone map and grade, bloom confined to emitters, the flare on the sun, TRAA or TAAU by `headroomAt`, the planets’ skins, the level’s hulls and lights, the rocks on their tracks, the hyperspace streaks, the war’s effects. `BUDGET=1 galaxy-check space` passes every system or writes the breach as a finding.
3. **No regression on low.** The classic path on low draws byte for byte what `main` drew (the classic looks’ hashes in their tests).

---

### Task 1: The module on the node renderer

- Modify: `src/components/galaxy/module.js` (`fromScene('galaxy', …, { shading: 'nodes', classic: true })`), `src/runtime/backend.js` (the `galaxy` module in the same table as `galaxy-surface`), `src/runtime/shading.test.js` (`CLASSIC` rows for the galaxy’s classic set), `src/components/galaxy/nodes/index.js` (the twins’ entry: `looksFor(backend)`), `scene.js` (takes its looks from the backend: `nodes/` or the classic set through the `classic` import)
- Test: `src/runtime/backend.test.js` (the cells for `galaxy`), `src/runtime/shading.test.js` (the closure holds no GLSL; the classic rows pinned), `module.test.js`
- [ ] Failing test → FAIL → implement with the sky and the bodies as the first two twins (tasks 2 and 3 fill the rest) → PASS. Commit `The galaxy on the node renderer above low`.

### Task 2: The sky’s twin and the whole sky set

- Modify: `scripts/bf2017-sky.mjs` (`--panorama` for every space panorama in the drop: `t_space_endor_02_c`, `t_space_starscelestial_{02,07,09}`, `t_space_starscinematic_{01,02}`, `t_space_ambient_01`, `t_space_debris_bgd`, `t_space_athulla_01_c`, `t_space_fondor_moon_04_c`, `t_space_naboo_moon_water_01_c`; the six not uploaded named in the hand-off for lane W), `src/components/galaxy/skyPanorama.js` (a row per system: its own sky, else the nearest star field with the choice and its `_source`; Kashyyyk and Kamino gain one; low none), `src/components/galaxy/nodes/sky.js` (the TSL twin of `sky.js`’s band, core, nebulae and stars under the panorama; the procedural band and nebulae only where the record paints none), `src/components/galaxy/sky.js` (the classic set behind the marker)
- Test: `sky.test.js` and `sky.panorama.test.js` (every system has a row; the file exists in the manifest at each tier’s width), `nodes/sky.test.js` (the twin compiles to WGSL in Node, no GLSL in its closure)
- [ ] Failing test → FAIL → publish the panoramas, write the rows and the twin → PASS; shots of Kashyyyk, Kamino, Endor and the Core at high on `nodes-webgl`. Commit `The game’s whole sky set over the galaxy, on the node renderer`.

### Task 3: The planets’, places’, rocks’ and effects’ twins

- Modify: `src/components/galaxy/nodes/{bodies,bodySkin,bodyShield,placesDraw,rocks,skyStreaks,tunnel,fx,gateway,interdictor,levelArea,areaWeather,world}.js` (a TSL twin a file: the ground, relief, cloud, atmosphere and shield shaders; the skins’ chunk; the point and streak shaders; the tunnels’ looks; the station effects), the classic files behind the marker, `rocks.js` (`kind: 'placed'` on the game’s DS2 debris and `_battlebeyond` props for Geonosis’s ring, Hoth’s field and Alderaan’s debris, on the asteroid tracks, the biggest first by tier as `rocksPlaced.js` does)
- Test: each twin’s test (compiles in Node; no GLSL in the closure; `bodySkin.test.js`’s hashes for the classic side unchanged), `rocks.test.js` (the three fields’ `placed` rows), `scripts/reference-frames.mjs --plain` on the lit fixture and `galaxy-check space` shots per system, classic against nodes, scored
- [ ] Failing test → FAIL → implement twin by twin, shooting each → PASS. Commit one a twin or a group (`The planets’ twins`, `The places’ and rocks’ twins`, `The effects’ twins`).

### Task 4: The system’s picture

- Modify: `scripts/bf2017-light.mjs` and `scripts/bf2017-picture.mjs` (`--space <system>`: the `VE_SB_*` record of the system’s space map (`scripts/lib/bf2017-space.mjs`’s `SPACE` plus Fondor): sun, fill, fog, tone map, bloom, flare, the LUT where one is named, written to `src/data/galaxy/space/<system>.picture.json` with its `_source`), `src/components/galaxy/nodes/picture.js` (applies it through `applyGameLight` and `light/post.js`’s chain for the tier, ending in the grade; a system without a space map takes the named record), `scene.js` (`postFor` the tier on the node renderer)
- Test: `scripts/bf2017-light.test.mjs` (the four records read: Kamino’s storm split as the reader already handles), `nodes/picture.test.js` (the chain for each tier; the record’s numbers reach the nodes), `galaxy-check space endor,kamino,naboo,fondor` at high with `BUDGET=1`
- [ ] Failing test → FAIL → implement → PASS; shots beside the game’s space frames the owner picks in `docs/superpowers/evidence/bf2017-space/s2/`. Commit `Space in the game’s picture`.

### Task 5: The films, the gates, the hand-off, the PR

- Modify: `src/components/galaxy/capitalFilm.js` and `fx.js` (the capital deaths and the Death Star II’s end call `videoLook` once a row is `published`; the flash until then), `docs/superpowers/HANDOFF-bf2017.md` (this lane’s section: Done / Where the code and the plan differed / Left (the desktop’s asks: the two VP6 films, the `SS_Planet_*` shader, the six not-uploaded textures; the kinds the drop lacks) / Checking it; the lanes table row), `docs/stack/three.md` (the galaxy’s node modules listed beside the surface’s)
- Test: `capitalFilm.test.js`; the five checks; `BUDGET=1 BUDGET_REPORT=1 QUALITY=<tier> node scripts/galaxy-check.mjs space <every system>` at low, mid, high and ultra on `nodes-webgl` and `?gpu=classic`; `node scripts/starfighter-check.mjs endor|kamino|naboo|fondor high`
- [ ] Gate output and shots in the evidence folder; `origin/main` merged keeping both sides; the draft PR with the gates’ table; message the parent session with the PR number, the head sha and the gate numbers. Commit `Lane S2: the hand-off`.

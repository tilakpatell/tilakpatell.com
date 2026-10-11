# GPU-first lane N4: the stream that feels like one. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, yourself, in order. Steps use checkbox (`- [ ]`) syntax for tracking. **Starts now from `origin/main`** (N1 and T2 are not needed: the coarse grid and the promotion work on every level path; merge `origin/main` before the PR). Branch `claude/gpu-n4-stream` from `origin/main`. One PR.

**Goal:** A visitor plays within seconds and the world sharpens round them: a coarse horizon grid of impostors and merged proxies downloads first, then the boot slice, then everything else by projected size and heading; every map arrives at its 256 row and is promoted; normals and data maps are UASTC above low; the cache keeps the world being played; a tier never pulls more than its byte budget.

**Architecture:** `scripts/bf2017-horizon.mjs` writes `horizon/` beside each pack (512 m cells: merged last-LOD proxies and octahedral impostor atlases); `levelStream.js` gains the coarse grid as its first phase, a priority queue by `size × heading`, the boot slice’s budget and prefetch; `levelGltf.js`’s texture cache gains `promote`; the pack’s `tex` rows gain `uastc`; `public/sw.js` learns the played world’s hashed paths under an LRU cap; `budgets.js` gains `bootMB` and `visitMB`.

**Tech Stack:** meshoptimizer (`@gltf-transform/*`, `meshoptimizer` already in devDependencies) for the merged proxies, agargaro’s octahedral impostor layout (16 × 16 hemi-octahedral views at 2,048, baked by a Playwright script in software GL or on the desktop), KTX2 rows (`.256`…`.2048`), `renderer.hasFeature('texture-compression-bc'|'astc'|'etc2')`, the service worker, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-11-gpu-first-renderer-design.md` (§4 “N4”, §6, §7, §9).

## Global Constraints

- Many small hashed files, never a Range request into one GLB (the research note: the loader parses whole files and the plugin hook conflicts with meshopt).
- The boot slice: the player’s cell and its eight neighbours at `lod1`, every map at its `.256` row, the coarse grid: under 12 MB on high and ultra, under 6 MB on mid, under 3 MB on low; `BUDGET_ROWS` gains `bootMB: { low: 3, mid: 6, high: 12, ultra: 12 }` and `visitMB: { low: 40, mid: 120, high: 400, ultra: 1200 }` (`_source`: the spec’s §4 N4 and the research note’s egress arithmetic).
- A coarse cell under 400 KB; the impostor atlas 2,048² UASTC, 16 × 16 views.
- UASTC rows for normals, ORM, masks and detail maps on mid and up; colour stays ETC1S below ultra (Q5 measures the colour row); transcode normals to BC5 or EAC RG11.
- The service worker’s cap 400 MB with LRU; every URL hashed and immutable; iOS evicts after a week, so the CDN is the real cache.
- The rules; the gates of the spec’s §10; `npm run maps:bf2017` unchanged (the drawn columns do not move).

## Review Focus

1. A level without `horizon/` (a pack built before this lane): the stream falls back to the far list as today. Test: Task 2.
2. A promotion racing a drop: a `.1024` map landing after its cell was dropped is cached and not bound; nothing is uploaded for a cell not shown. Test: Task 3.
3. The budget reached mid-visit: the stream stops asking for finer rows and finer LODs but keeps serving cells at what it has; a HUD line says “detail paused by data budget”; a visitor who raises the quality level raises the budget. Test: Task 4.
4. A heading that flips (the player turns round): the prefetch ahead is abandoned at the queue, not the network (in-flight requests complete and are cached). Test: Task 2.
5. A browser with neither BC nor ASTC nor ETC2 (none known; the node renderer over WebGL 2 on a software device): the UASTC row is skipped for the ETC1S row. Test: Task 3.

---

### Task 1: the coarse grid, written

**Files:**
- Create: `scripts/bf2017-horizon.mjs`, `scripts/lib/bf2017-horizon.mjs` (pure: the 512 m cells, which instances a cell’s proxy merges, which meshes get an impostor by count and size), `scripts/lib/bf2017-horizon.test.mjs`, `scripts/impostors.mjs` (the Playwright bake of a mesh’s 16 × 16 hemi-octahedral views to a 2,048 atlas, albedo and normal-depth, in software GL in the cloud or on the desktop), `scripts/lib/impostor-layout.mjs` (pure: view directions, atlas tiling, the three-view blend weights), `scripts/lib/impostor-layout.test.mjs`

**Interfaces:**
- Produces: `horizonCells(pack, { cell = 512 }) → { key: { instances, proxies, impostors } }` (pure); `impostorViews(n = 16) → vec3[]`, `impostorTile(dir, n) → [i, j, w]` (pure: hemi-octahedral); `node scripts/bf2017-horizon.mjs <world>` writes `levels/<world>/horizon/{index.json, <key>.glb, <mesh>.impostor.ktx2}`; the pack’s `level.json` gains `horizon: 'horizon/index.json'`.

- [ ] **Step 1: failing tests** for `horizonCells` on Hoth’s pack (the number of cells; each under 400 KB by estimate) and `impostorViews`/`impostorTile` round-trip.
- [ ] **Step 2: run**: FAIL. **Step 3: implement.** **Step 4: run**: PASS.
- [ ] **Step 5**: `node scripts/bf2017-horizon.mjs hoth` in the cloud (software GL for the impostor bake; the desktop re-bakes at full quality through lane W: write the job’s ask in the hand-off); sizes in the evidence README.
- [ ] **Step 6: commit** `The coarse horizon grid: merged proxies and octahedral impostors a 512 m cell, written beside the pack`.

### Task 2: the stream’s phases and priority

**Files:**
- Modify: `src/components/galaxy/surface/level/levelStream.js` (phases: `horizon` grid first when the pack has one, else the far list; then the boot slice; then the queue), `src/lib/level/priority.js` (new, pure: `priorityOf(cell, { position, heading, tier }) → number` = projected size × heading term; `prefetchAhead(cells, heading, n = 2)`), `priority.test.js`, `levelStream.test.js`
- Modify: `src/components/galaxy/surface/level/levelScene.js` (`setHorizon` takes the coarse cells’ proxies and impostors; an impostor is one `InstancedMesh` of quads per atlas with the blend in its material, hidden where the fine cell is shown)

**Interfaces:**
- Produces: `createLevelStream({ ..., boot: { mb }, onHorizonCell(key, glb, atlas) })`; `progress()` gains `{ phase: 'horizon' | 'boot' | 'detail', bytes, bootDone }`; `ready()` resolves at `bootDone`.

- [ ] **Step 1: failing tests**: the phase order; the far-list fallback (Review Focus 1); the heading flip abandons the queued prefetch but not in-flight (Review Focus 4); `priorityOf` ranks a near large cell ahead over a far small one behind.
- [ ] **Step 2: run**: FAIL. **Step 3: implement.** **Step 4: run**: PASS. **Step 5: commit** `The horizon grid first, the boot slice second, the rest by size along the heading`.

### Task 3: low mip first, and UASTC rows

**Files:**
- Modify: `src/components/galaxy/surface/level/levelGltf.js` (the texture cache: `texture(uri)` fetches the `.256` row first and resolves at once; `promote(uri, size)` fetches the tier’s row and swaps the material’s slot under a frame; a dropped cell’s pending promotions are kept in the cache and not bound), `levelGltf.test.js`
- Modify: `src/components/galaxy/surface/level/levelPack.js` (`tierTexture(uri, tier, sizes, { uastc, formats })` picks `.uastc.<size>.ktx2` for a data map on mid and up when `formats` has BC, ASTC or ETC2, else the ETC1S row), `levelPack.test.js`; `scripts/lib/bf2017-level.mjs` (`tex` rows gain `uastc: true` where the bucket has `web/uastc/<path>`); `src/lib/three/gltf.js` (`ktx2Loader`’s `detectSupport` after `renderer.init()`, the transcode targets logged once in development)

**Interfaces:**
- Produces: `promote(uri, size) → Promise<void>`; `tierTexture`’s extended signature; `isDataMap(slot) → boolean` (normal, metalRough, ao, mask, detail).

- [ ] **Step 1: failing tests**: the first fetch is the 256 row; promotion swaps; a dropped cell’s promotion is cached, not bound (Review Focus 2); the UASTC pick table by slot, tier and format, including no compressed format (Review Focus 5).
- [ ] **Step 2: run**: FAIL. **Step 3: implement.** **Step 4: run**: PASS. **Step 5: commit** `Every map at its smallest row first and promoted in place; UASTC on the data maps above low`.

### Not this lane, noted for after it

Gaussian-splat vistas (three r186’s `GaussianSplatMesh`) for one level’s horizon: a desktop capture of the game’s far terrain rendered from hundreds of views and trained, measured in bytes and FLIP against the painted panorama and this lane’s proxies (the spec’s §11). One spike after N4 lands, not part of it.

### Task 4: the cache, the budget, the gate

**Files:**
- Modify: `public/sw.js` (a `tp-play` message names the world; its pack’s hashed paths are cached as fetched under a 400 MB LRU; the installed-pack behaviour unchanged), `src/lib/sw.js` (`playing(world)`), `sw.test.js`
- Modify: `src/lib/budgets.js` (`bootMB`, `visitMB` columns), `budgets.test.js`; `levelStream.js` (`visitMB` enforced: past it, no finer rows or LODs; `progress().paused`), `src/runtime/hud/` (one Toast line through the kit when paused; no new part)
- Modify: `scripts/galaxy-check.mjs` (`--bytes`: first-visit bytes per tier and time to `bootDone` on a throttled 20 Mbit/s line, written to the evidence)

- [ ] **Step 1: failing tests**: the LRU evicts the oldest world at the cap; `visitMB` pauses the detail phase and a quality raise resumes it (Review Focus 3).
- [ ] **Step 2: run**: FAIL. **Step 3: implement.** **Step 4: run**: PASS.
- [ ] **Step 5**: `BUDGET=1 QUALITY=high node scripts/galaxy-check.mjs surface hoth --bytes` and at mid and ultra: time to first frame and to `bootDone` under 10 s on high at 20 Mbit/s; bytes under `bootMB` and `visitMB`; the parity shots at the coarse-to-fine swap (a pose at 300 m from a cell as it lands) within thresholds; `npm run maps:bf2017` green.
- [ ] **Step 6**: `docs/stack/assets-pipeline.md` (the horizon grid, the rows), `docs/stack/supabase.md` (the egress arithmetic and the R2 hedge under Gotchas), the hand-off’s row and the desktop asks (lane W: the impostor bake at full quality, the UASTC data rows job).
- [ ] **Step 7**: merge `origin/main` (lane D2’s rows: keep both); the gates; push; PR `GPU-first lane N4: the stream that feels like one`.

# Lane D3: the manifest out of the client, the landmarks’ maps as KTX2. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, yourself, in order. Steps use checkbox (`- [ ]`) syntax for tracking. Branch `claude/frostbite-d3-manifest-landmarks` from `origin/main`. One PR.

**Goal:** The galaxy’s chunk stops carrying 15.5 MB of pack rows the library never reads, and the thirteen ultra landmarks’ data maps become KTX2 so they upload compressed and stay compressed on the chip.

**Architecture:** `catalog/bf2017-library.js` reads `galaxyAssets.json` only to ask whether three files an object’s row names are published. A Vite plugin (`scripts/library-slice.mjs`, its rule pure in `scripts/lib/library-slice.mjs`) serves a virtual module `virtual:bf2017-published` holding exactly those keys for the objects in `library-used.json`, built from the manifest at build, dev and test time, so nothing is committed twice and nothing goes stale. The landmarks go through the repository’s own `scripts/ktx2.mjs convert --slots normal,arm` (UASTC, the research’s rule: data maps earn the bytes, colour stays WebP), with a report before and a size table after.

**Tech Stack:** Vite 8 virtual modules (`resolveId` / `load`, as `scripts/icons-apart.mjs`), Vitest 5, `scripts/ktx2.mjs` on `basisu` (a devDependency), `@gltf-transform/core`.

**Spec:** `docs/superpowers/specs/2026-10-11-frostbite-gaps-design.md` (§1 D3, §3); the audit §5 (items 1 and 2).

## Global Constraints

- `rowFor(name, index, manifest)`’s face and the `MODELS` export are unchanged; every catalog test passes as it is.
- The virtual module holds `{ [path]: true }` for the plain, `.lod1` and `.far` paths of every name in `src/data/bf2017/library-used.json`, and nothing else; its test pins that a pack row never appears.
- `src/data/galaxyAssets.json` stays where it is for the scripts (`assets-check`, `assets-manifest.mjs`); no script changes its reading.
- At ultra a landmark still draws whole at any distance (`catalog/ultra.js`): no LOD cut is added here; the maps change, the mesh does not.
- Colour maps stay WebP (UASTC colour is about three times the bytes, ETC1S too lossy for a landmark seen close: `docs/research/2026-10-05-textures-and-asset-quality.md`); normal and ARM maps become UASTC with mips.
- `src/data/health/latest.json` is not committed. British spelling, curly quotes; `_source` on every number in the evidence.

## Review Focus

1. A name in `library-used.json` whose cuts are not published: the slice has no key for it and `rowFor` returns null, as before (the placer’s one-time warning). Test: Task 1.
2. A `library-used.json` row added later with no rebuild: the virtual module is built at each dev-server start and each build from the file on disk, so the next start carries it; in dev, a change to either JSON invalidates the module (`addWatchFile`). Test: Task 1 (the plugin’s `load` reads the files each time; a unit test calls it twice with a changed file).
3. Vitest: `bf2017-library.js`’s tests import the module through the same plugin; a test that passes its own `manifest` to `rowFor` is unaffected. Test: Task 1 (the existing `catalog.test.js` passes).
4. A landmark GLB whose normal map is shared with its colour map by one texture object: `ktx2.mjs --slots normal,arm` converts the texture once and both slots read KTX2; the colour slot then carries UASTC too (the report lists it). Test: Task 2 reads each converted file’s texture list and asserts the colour slot’s mime where the maps were distinct.
5. A KTX2 map in a GLB on the classic renderer’s low tier: `gltf.js` fetches the transcoder on the first KTX2 file; the landmarks load at ultra only (`usesUltra`), so no low-tier visitor pays it. Test: Task 2’s evidence names the tiers the files load at.

---

### Task 1: the virtual module and the slice

**Files:**
- Create: `scripts/lib/library-slice.mjs` (pure: `sliceFor(published, used, { urlFor }) → { [path]: true }`), `scripts/lib/library-slice.test.mjs`, `scripts/library-slice.mjs` (the plugin: `resolveId('virtual:bf2017-published') → '\0bf2017-published'`, `load` reads `src/data/galaxyAssets.json` and `src/data/bf2017/library-used.json`, calls `sliceFor` with `gameUrl` from `src/components/galaxy/surface/catalog/bf2017-slug.js`, returns `export default ${JSON.stringify(slice)}`; `addWatchFile` on both)
- Modify: `src/components/galaxy/surface/catalog/bf2017-library.js:26` (`import PUBLISHED from 'virtual:bf2017-published'`; the header’s paragraph), `vite.config.js` (the plugin)

**Interfaces:**
- Produces: `sliceFor(published: { [path]: any }, used: { [name]: row }, { urlFor: (name, cut?) => '/models/…' }) → { [path without the leading slash]: true }` for each of `urlFor(name)`, `urlFor(name, 'lod1')`, `urlFor(name, 'far')` present in `published`.

- [ ] **Step 1: failing tests** in `library-slice.test.mjs`: a `published` with a plain and a `.far` path for one name, a pack row and another object’s path; `used` with that name and a second name with nothing published → the slice has exactly the two keys; a `used` of none → `{}`.
- [ ] **Step 2: run** `npx vitest run scripts/lib/library-slice.test.mjs`: FAIL.
- [ ] **Step 3: implement** the rule, the plugin, the import and the config.
- [ ] **Step 4: run** `npx vitest run scripts/lib/library-slice.test.mjs src/components/galaxy/surface/catalog`: PASS.
- [ ] **Step 5**: `npx vite build` and the galaxy chunk’s size (the chunk that held the manifest was `echoLayout-*.js` at 13.19 MB, 1.30 MB gzipped; find the chunk that now holds `catalog/index.js` by a string it carries); record before and after.
- [ ] **Step 6: commit** `The library asks the manifest for the objects it places and nothing else: a virtual module of their published paths, 15.5 MB out of the galaxy’s chunk`.

### Task 2: the landmarks’ data maps as KTX2

**Files:**
- Modify (binary, in place): `public/models/galaxy/surface/{mining,theed,wroshyrgreat,geohive,massassi,citadel,tipocadome,senate,sundaridome,cloudplaza,cloudtower2,cloudtower,vaporator}.ultra.glb`
- Create: `docs/superpowers/evidence/frostbite-gaps/d3/README.md`, `docs/superpowers/evidence/frostbite-gaps/d3/landmarks.json` (per file: before and after bytes, each texture’s slot, size and mime)

- [ ] **Step 1**: `node scripts/ktx2.mjs report public/models/galaxy/surface/*.ultra.glb` into the evidence folder: per texture, its slot, size, bytes as WebP, bytes as UASTC, PSNR.
- [ ] **Step 2**: `node scripts/ktx2.mjs convert public/models/galaxy/surface/*.ultra.glb --slots normal,arm`; a scratch script reads each file with `@gltf-transform/core` and writes `landmarks.json`.
- [ ] **Step 3**: `npx vitest run src/components/galaxy/surface/catalog src/lib/three/gltf.test.js`: PASS; `node scripts/health.mjs --check --skip build`: within budget (the `models MB` row, if it counts `public/models/galaxy/surface`, moves by the data maps’ difference; a rise is said in the commit with the research’s reason).
- [ ] **Step 4: commit** `The thirteen ultra landmarks’ normal and ARM maps as UASTC KTX2: uploaded compressed, kept compressed, their colour maps left as WebP`.

### Task 3: the gates and the PR

- [ ] **Step 1**: `npm run lint && npm test && npm run build && node scripts/health.mjs --check --skip build && npm run coverage:bf2017 && npm run maps:bf2017`; `git checkout -- src/data/health/latest.json`.
- [ ] **Step 2**: the evidence README (the chunk sizes before and after, the landmark table, what was not done: `models/galaxy` to the bucket is the desktop’s, since the cloud session cannot write it); `docs/stack/build.md` gains the virtual module under the plugins it lists.
- [ ] **Step 3**: merge `origin/main`; push; draft PR `Lane D3: the manifest out of the client, the landmarks’ maps as KTX2`.

# Battlefront 2017, lane colour: the variation chain. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, yourself, in order. Steps use checkbox (`- [ ]`) syntax for tracking. Build directly; one judge pass at most before the PR.

**Goal:** Every level pack carries `variations.json`, the game's own colour-to-texture map for its meshes (the mesh variation databases' bindings by parameter name, the object variations' tints, switches and texture overrides), the level loader applies it through lane Q1's game material, the shader depots' hashed parameter names are resolved by the djb2-xor dictionary, and `scripts/bf2017-material-audit.mjs` says per world what share of the drawn materials is bound as the game binds it.

**Architecture:** One pure writer (`scripts/lib/bf2017-variations.mjs`) from the bucket's `data/` records to `variations.json`; one reader (`src/components/galaxy/surface/level/levelVariations.js`) that turns a row into the `variation` field of a recipe, which `levelGltf.js` already hands to `materialFor`; one dictionary module (`scripts/lib/bf2017-shader-names.mjs`) shared by the writer and the vehicles' import; one audit. Nothing in `gameMaterial.js` changes but one input (`variation`: texture overrides and vectors), guarded so a recipe without it draws as today.

**Tech Stack:** `scripts/bf2017-fetch.mjs data '<glob>'` (the records as `.json.gz`; `SUPABASE_URL` and `SUPA_KEY` in the cloud environment, `NODE_USE_ENV_PROXY=1`); `scripts/lib/bf2017-ebx.mjs` (the records' `$ref`/`$asset` walking, lane 0's); `src/lib/three/surface/gameMaterial.js` and `level/levelGltf.js` (Q1, #855/#869); `scripts/bf2017-import.mjs` (`--textures`, #866); Vitest; `scripts/surfaces-check.mjs`.

**Spec:** `docs/superpowers/specs/2026-10-10-bf2017-accuracy-design.md` (§1.1, §3 "Lane colour", §4, §5).

## Global Constraints

- The era rule (`isSequel`); the native rule (the game's KTX2, dropped mips per tier); a pack's files published, `level.json` and `README.md` committed; files under 800 lines; British spelling and curly quotes; commits one plain sentence with the attribution lines.
- A recipe without `variation` draws exactly as before (Q1's fixture shots are the regression: `scripts/surfaces-check.mjs` unchanged output without `--variations`).
- Every binding in `variations.json` names the record it came from (`_source` per mesh: the MVDB path and the variation's asset).
- Nothing in `src/components/battlefront/` changes (the picture lane takes `variations.json` there).

## Review Focus

1. **A mesh with two variations on one level and no instance hashes**: the level's-own rule must not pick either (task 2's test); the audit counts it `default-only`.
2. **A variation naming a texture the bucket lacks**: the override is skipped, the vectors still applied, the row counted `missing-texture` (task 2 and task 5 tests).
3. **The dictionary on an unknown hash**: `resolveDepot` leaves it as the hash, never a guess; the unresolved count is reported (task 1's test).
4. **Q1's fixture**: `surfaces-check.mjs` without `--variations` byte-identical in its JSON report (task 4).

---

### Task 1: The dictionary

**Files:**
- Create: `scripts/lib/bf2017-shader-names.mjs` (`hashName(name) → 'xxxxxxxx'` (djb2-xor over the lower-cased UTF-8 bytes from 5381, 32-bit, hex, zero-padded), `namesFrom({ materials, variations, presets }) → Set` (the keys of `materials.jsonl`'s `textures`, `vectors`, `bools`; every `ParameterName` in the `ObjectVariation` records; every parameter name in the `SurfaceShaderPreset` records), `resolveDepot(rows, names) → { params: [{ name | hash, type, value }], resolved, unresolved: { hash: count } }` (a depot row's blocks; the type hashes `0b87fa95` Vec, `0d1cfa1b` Boolean resolved the same way; a Vec's 16-byte hex as four little-endian floats))
- Create: `scripts/bf2017-shader-names.mjs` (CLI: `--root <export>` on the desktop or the bucket's `web/materials.jsonl` + `data 'Objects/**/*Variation*'` in the cloud; writes `src/data/bf2017/shaderParams.json` `{ names: { name: hash }, unresolved: { hash: count }, resolvedShare }`)
- Test: `scripts/lib/bf2017-shader-names.test.mjs` (fixture: ten names with their known hashes, among them `smoothness` → the hash the depot shows for `Smoothness` rows; one depot row from `scripts/fixtures/bf2017/depots/stardestroyer_floorplatform.json`, trimmed to three blocks)

- [ ] **Step 1: Failing tests**: `hashName('vec') === '0b877b75'`, `hashName('Boolean') === '87d71101'`, `hashName('boolean')` differs (case matters: the dictionary hashes lower case); `resolveDepot` on the fixture names `GlobalTilingDetailmap` and leaves one hash unresolved with count 1.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `The shader depots' hashed parameter names resolve: djb2-xor of the lower-cased name`.

### Task 2: The variation writer

**Files:**
- Create: `scripts/lib/bf2017-variations.mjs` (`variationsOf({ mvdbs, variations, listing }) → { format: 1, meshes, instances: null, counts }`: `mvdbs` the level bundle's `MeshVariationDb_Win32` records (the level's own, `content/`, `fantasybattle/`, `heroarena/`, any sub-level's), keyed by mesh asset (lower-cased) and `VariationAssetNameHash` (0 = `default`); each material's `TextureParameters` by `ParameterName` to the bucket's KTX2 path (through `listing`, lane L's `textures.jsonl` reader: a name the listing lacks is kept under `missing`), its `MaterialVariation`'s vectors, bools and conditionals (from the `ObjectVariation` record), `_source`; `levelRule(meshes, usedDefaults) → { mesh: variationName }` (the level's-own rule: one variation, the default never named by the level); `instanceVariations(bin)` (when the map's `.bin` carries a `variation` array (§4): a hash per instance → the names))
- Create: `scripts/bf2017-variations.mjs` (CLI: `<world>` → reads the pack's `level.json` for the level and sub-levels, fetches the MVDBs and the variations they name, writes `public/models/galaxy/bf2017/levels/<world>/variations.json` and appends a "Variations" table to the pack's README: meshes, with variations, rule-decided, missing textures)
- Test: `scripts/lib/bf2017-variations.test.mjs` (fixtures: Hoth's level MVDB trimmed to the snow crate and two default meshes, `Box_M_01_A_Snow`'s record, a listing with one of its textures absent)

- [ ] **Step 1: Failing tests**: the crate's `variations.Box_M_01_A_Snow.MeshMaterial.textures._CS` is the KTX2 path; the absent map is in `missing`; `levelRule` gives the crate its snow when no sub-level names its default and nothing when the fixture's second MVDB names the default; Review Focus 1 and 2.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS; `node scripts/bf2017-variations.mjs hoth` writes Hoth's file (the counts in the README).
- [ ] **Step 5: Commit** `A level pack carries the game's variations: the mesh variation database's bindings and the object variations' tints`.

### Task 3: The reader, into the game material

**Files:**
- Create: `src/components/galaxy/surface/level/levelVariations.js` (`loadVariations(pack) → Promise<rows | null>` (through `packUrl`; null without the file); `variationFor(rows, meshName, { groupIndex }) → { textures, vectors, bools } | null` (the instance list first, the rule's name second, else null); `applyVariation(recipe, v) → recipe` (a copy with `variation` set: `maps` overridden by name through Q1's slot names, `vectors` merged))
- Modify: `src/components/galaxy/surface/level/levelGltf.js` (`createLevelLoader` takes `variations`; `matchRecipes`' result is passed through `applyVariation` when a row exists), `src/lib/three/surface/gameMaterial.js` (`materialFor(recipe, maps)` reads `recipe.variation?.vectors` for the tints it already has names for: `PaintColour`/`BaseColour` → the colour factor, `EmissiveColor`/`EmissiveIntensity`, `Smoothness`, `DetailTiling`; conditionals `ESB_*` it already reads from Q4), `src/components/galaxy/surface/level/index.js` (loads `variations.json` beside `recipes.json`)
- Test: `src/components/galaxy/surface/level/levelVariations.test.js`, `src/lib/three/surface/gameMaterial.test.js` (a recipe with `variation.vectors.PaintColour` tints; one without is unchanged)

- [ ] **Step 1: Failing tests**: `variationFor` on the Hoth fixture rows gives the crate its snow set; `applyVariation` overrides `_CS` and keeps the recipe's other maps; `materialFor` without `variation` returns the same material parameters as before (snapshot the fixture's).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `The level loader draws each mesh in the game's variation: its textures and tints through the game material`.

### Task 4: The fixture and the shot

**Files:**
- Modify: `scripts/surfaces-check.mjs` (`--variations`: the fixture page draws Hoth's crate with and without the file; the JSON report gains `variations: { applied, rule, missing }`)
- Create: `docs/superpowers/evidence/bf2017-colour/README.md` (the two crate shots, the report)

- [ ] **Step 1**: run the check without `--variations`; diff its report against the committed Q1 report: identical.
- [ ] **Step 2**: with `--variations`: the crate snowed; shots saved. SwiftShader is enough for a material difference; the WebGPU leg is the owner's laptop (say so in the README).
- [ ] **Step 3: Commit** `The surfaces fixture shows a Hoth crate in the game's snow variation`.

### Task 5: The audit

**Files:**
- Create: `scripts/lib/bf2017-material-audit.mjs` (`auditPack({ level, recipes, variations, drawn }) → rows`: per drawn material (from `level.json`'s meshes × materials, or the `galaxy-check` report's drawn list when given) its state: `bound` (every slot the MVDB names is bound to the same texture), `default-only` (an MVDB variation exists for the mesh and none applied), `missing-texture`, `no-entry` (the mesh is in no MVDB of the level: the recipe is the matdump's), and the share), `scripts/bf2017-material-audit.mjs` (CLI: `<world>…`; writes `docs/superpowers/evidence/bf2017-colour/<world>.md` and a summary table in `README.md`)
- Test: `scripts/lib/bf2017-material-audit.test.mjs`

- [ ] **Step 1: Failing tests**: the fixture's three meshes → `bound`, `default-only`, `no-entry`; a slot bound to a different texture than the MVDB's → not `bound`, named in the row.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS; run it on `hoth`, `sb_endor`, `sb_kamino` and any E pack on `main`; the gate is Hoth ≥ 95 % `bound` after task 3 (report the number either way).
- [ ] **Step 5: Commit** `A material audit says, per world, how much of what is drawn is bound as the game binds it`.

### Task 6: The vehicles' hand table retired

**Files:**
- Modify: `scripts/bf2017-import.mjs` (`--variations <bundle path>`: reads that bundle's MVDB and binds the model's materials by `ParameterName` through `bf2017-textures.mjs`'s slot map, before `--textures` (which stays, for a graph the MVDB does not list)), `scripts/lib/bf2017-textures.mjs` (the parameter-name → glTF-slot table: `Color`/`_CS`/`BaseColor` → baseColor, `NS`/`_NAM_*`/`Normal` → normal, `_RGB`/`Mask`/`RSSSAO` → the packed roughness/metalness/AO as the pipeline derives them, `Emissive`/`_EM` → emissive; `F90ColorTexture` noted, not bound)
- Test: `scripts/bf2017-import.test.mjs` (the AT-AT head's MVDB entry fixture binds the same maps #866's hand table named)

- [ ] **Step 1: Failing test**: the fixture entry → the slots #866 listed for `SS_ATAT_Head`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS; re-run the AT-AT's import with `--variations` and compare the maps bound (names only; the GLBs are published, not committed: `node scripts/assets-publish.mjs --only 'models/galaxy/surface/atat*'` and `assets-check`).
- [ ] **Step 5: Commit** `The vehicles bind their maps from the game's variation database, not a hand table`.

### Task 7: The hand-off and the PR

- [ ] `HANDOFF-bf2017.md`, "The sixth design", the colour row: the audit's shares per world, `shaderParams.json`'s resolved share, what the level's-own rule decided, the desktop's `variation` column (§4) still to come; the characters' variations listed for cast-left T.
- [ ] `npm run lint`, `npx vitest run scripts/lib/bf2017-shader-names.test.mjs scripts/lib/bf2017-variations.test.mjs scripts/lib/bf2017-material-audit.test.mjs src/components/galaxy/surface/level src/lib/three/surface scripts/bf2017-import.test.mjs`, `npm run build`, `node scripts/health.mjs --check --skip build`, `npm run coverage:bf2017` (the ledger: `variations.json` rows consume the MVDB records; add the `data/**/MeshVariationDb*` and `ObjectVariation` groups to the owners table as this lane's and mark them used).
- [ ] Merge `origin/main`, push, open the PR; merge it yourself when CI is green (the owner asked for that).

# Battlefront 2017, lane T: one atlas a kind. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, yourself, in order. Steps use checkbox (`- [ ]`) syntax for tracking. Build directly; one judge pass at most before the PR.

**Goal:** A modular 2017 figure's light and far cuts draw in one to three calls instead of five to ten: its opaque materials' maps packed into one sheet a slot, its UVs moved into their cells, its primitives joined.

**Architecture:** A pure gltf-transform + sharp module `atlas.mjs` run by the import after `--join` on the light and far cuts only (`--atlas`); the full cut keeps the game's native KTX2 untouched. Masked and blended materials, tiling UV sets and materials with an emissive map keep their own draw.

**Tech Stack:** `@gltf-transform/core` 4.5, `@gltf-transform/functions`, `sharp` 0.35, `scripts/bf2017-import.mjs`, `scripts/lib/rig-parts.mjs`'s `joinSkinned`, Vitest, `galaxy-check.mjs`.

**Spec:** `docs/superpowers/specs/2026-10-10-bf2017-cast-left-design.md` (§1.6, §3 lane T).

## Global Constraints

- The full cut (`--full`'s plain and `.ultra`) is never atlased: the game's KTX2, native, the owner's rule.
- Cell size = the cut's map size (light: `--lod1-tex` for colour, `--lod1-maps` for the rest; far: 256 colour, 128 the rest); the sheet the next square grid (2×2 ≤ 4 materials, 3×3 ≤ 9, 4×4 ≤ 16); a sheet is never over 4096 a side (a light cut at 1024 cells with ten materials would be 4096: allowed; eleven to sixteen at 1024 fall to 512 cells and the PR says so).
- Caps unchanged: light 5 MB, far 150 KB; a kind whose atlased cut is over its cap takes smaller cells, said in the PR.
- Files under 800 lines; British spelling and curly quotes; commits one plain sentence with the attribution lines; merge commits.

## Review Focus

1. **A tiling UV set** (`max − min > 1.02` on either axis): left out of the atlas with its material; the test's fixture has one tiling primitive and asserts it keeps its material.
2. **A material missing a slot** (the officer's head has no metal-rough map): its cell in that slot is the neutral (normal `(128,128,255)`, metal-rough `(0, 255·roughness, 255·metalness)`, occlusion white) so the merged material's factors (1, 1) still give the game's look; the test reads the neutral cell's pixel.
3. **Mip bleeding at cell edges**: each cell is padded by 8 texels of its own edge colour (sharp `extend` with `extendWith: 'copy'`) and UVs are inset by the padding, so the far cut's 256 cells do not smear a neighbour's colour at distance; the test asserts the UV inset.
4. **A primitive on two skins** (civcity1 has two skins): primitives are joined per skin; the test's two-skin fixture ends with two primitives, not one.
5. **WebP alpha**: a colour map with alpha that the material does not use (OPAQUE) is flattened before packing (`removeAlpha`), else the sheet's alpha confuses the material; the test asserts the sheet has 3 channels.

---

### Task 1: `atlas.mjs`

**Files:**
- Create: `scripts/lib/atlas.mjs`, `scripts/lib/atlas.test.mjs`

**Interfaces:**
- Produces: `atlasable(doc) → { pack: Material[], keep: Material[], reasons: { [name]: string } }` (pure, no pixels); `atlas(doc, { cell, maps = 'all' | 'color' }) → Promise<{ materials: before → after, primitives: before → after, sheet: { width, height, cells } }>`: packs `atlasable`'s `pack` set into one material per skin with one sheet a slot, rewrites `TEXCOORD_0` into cells with an 8-texel inset, joins primitives per skin (`joinSkinned`), prunes.

- [ ] **Step 1: Failing tests** (fixtures made in the test from the committed hilt as phase 2's `--join` test did, plus a two-skin fixture): a three-material fixture → one material, one primitive, the second material's UVs within `[0.5, 1] × [0, 0.5]` inset by 8/512 (Review Focus 3); a MASK material stays (`keep`, reason `alphaMode`); a tiling primitive stays (Review Focus 1); a material without a normal map gets the neutral cell (Review Focus 2, pixel read with sharp); two skins → two primitives (Review Focus 4); the sheet has 3 channels (Review Focus 5); the cell centre's pixel equals the source map's centre.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `An atlas a figure: its opaque materials' maps on one sheet, its primitives joined`.

### Task 2: `--atlas` in the import

**Files:**
- Modify: `scripts/bf2017-import.mjs` (`--atlas`: after `joinSkinned` on the `.lod1` and `.far` cuts, `atlas(doc, { cell })`; prints `atlas: 7 materials → 2, 7 draws → 2, sheet 2048×2048 (3×3)`; refused with `--full`'s plain and `.ultra` (a note, not an error); the cut's byte cap checked after), `scripts/bf2017-import.test.mjs`
- Test: `scripts/bf2017-import.test.mjs`

- [ ] **Step 1: Failing test**: the import on the two-material fixture with `--atlas` writes a `.lod1.glb` with one material; without the flag two.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `The import's light and far cuts take an atlas`.

### Task 3: The cast re-cut

**Files:**
- Modify: `public/models/galaxy/bf2017/crew/*.lod1.glb`, `*.far.glb` for every kind in `docs/superpowers/evidence/bf2017-phase2/cast.json` with five or more materials (hothtrooper, rebel, rebelpilot, rebeltech, officer, sandtrooper, snowtrooper, wookiee, civcity1, civcity3, clone, clonephase1, deathtrooper, scouttrooper, shoretrooper, stormtrooper, c3po), and lane V's vehicle light cuts with five or more (`bf2017-vehicles.mjs --atlas` passes the flag through), `src/components/galaxy/surface/catalog.test.js` (every committed `bf2017/crew/*.lod1.glb` ≤ 3 primitives; every `.far.glb` ≤ 2), `docs/superpowers/evidence/bf2017-atlas/` (sheets before and after, each kind at 3 m and 30 m)

- [ ] **Step 1: Failing test**: the catalogue test above (fails on today's hothtrooper at 7).
- [ ] **Step 2: Run** → FAIL. **Step 3: Re-import** each kind's light and far cuts with the same flags as `cast.json` records plus `--atlas` (the plain cut untouched: `--cuts` the same, the import leaves a cut it would not change). **Step 4: Run** → PASS.
- [ ] **Step 5: Measure**: `galaxy-check.mjs surface naboo`, `yavin`, `kashyyyk`, `coruscant`, `bespin`, `hoth` with `BUDGET=1` at `QUALITY=low` and `high`, before (main) and after; the calls column is the number; Naboo's low from 533 toward 350; textures count (`renderer.info.memory.textures`) too, which should fall.
- [ ] **Step 6: Commit** `The cast's light and far cuts in one to three draws each`.

### Task 4: The PR and the hand-off

- [ ] Gates; `anim-check` on Yavin and Kashyyyk (nothing of the rig changed: still green); the hand-off's lane T row (Done; Left: re-atlas after lane D's markings and palettes re-import a kind (the same flag); the full cut stays native) and the "Each kind's extra flags" list gains `--atlas`; merge `origin/main`, push, PR `One atlas a kind: the cast's light and far cuts in a draw or three`. Merge per the slot.

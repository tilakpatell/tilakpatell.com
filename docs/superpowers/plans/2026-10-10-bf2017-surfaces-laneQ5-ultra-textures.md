# Battlefront 2017 surfaces, lane Q5: the texture quality on ultra. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, yourself, in order. Steps use checkbox (`- [ ]`) syntax for tracking. Task 1 is a measurement on the owner's desktop (`C:\Users\tilak\Downloads\BF2_Extract`); Tasks 2 and 3 run only if it says so; Task 4 is the site's and needs no desktop.

**Goal:** The photogrammetry in the colour maps reaches an ultra visitor: where ETC1S loses it, ultra serves a UASTC colour map; every level texture samples with full anisotropy.

**Architecture:** `qa/ktx_cmp` measures twenty of Hoth's colour maps three ways. If UASTC wins by the threshold, `tool/ktx2_ultra.py` encodes the pack-bound colour maps as UASTC q8 under `web_opt/ultra/` and uploads them by name; the level pack's `tex` rows gain an `ultra` file and `levelPack.js`'s `tierTexture` picks it on ultra. Anisotropy is one line in `levelGltf.js`, measured on its own.

**Tech Stack:** `tool/ktx2_encode.py` (the `--quality` flag; a `--no-hybrid` switch to add), gltfpack's Basis encoder, `qa/ktx_cmp` (PSNR), `tool/upload_supabase.py` with its own `--root`, lane L's `levelPack.js`/`levelGltf.js`, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-10-bf2017-surfaces-design.md` (§1, "Q5").

## Global Constraints

- The pipeline's rules (memory and `web_opt/README.md`): a changed file goes through its own `--root`; `~` is refused in a key; the uploader's "to upload now" line is read by hand.
- **Files this lane owns**: on the desktop `tool/ktx2_ultra.py`, `web_opt/ultra/`, `logs/ultra_textures.log`; on the site `src/components/galaxy/surface/level/levelPack.js` (`tierTexture`'s `ultra` row: additive) and `levelGltf.js` (anisotropy: one line), `scripts/lib/bf2017-level.mjs` (`tex` rows gain `ultra`), `docs/superpowers/evidence/bf2017-surfaces/Q5/`.
- The threshold is written before measuring: **3 dB** PSNR on the twenty, or a visible difference at 4× on the hangar floor plate in the crop grid; below both, Task 2 and 3 do not run and the hand-off says the numbers.

---

### Task 1: Measure (desktop)

- [ ] **Step 1**: pick twenty colour maps Hoth's pack binds (`level.json`'s `tex` keys ending `_c` or `_cs`), encode each as UASTC q8 and q10 to `qa/ultra_cmp/`, and run `qa/ktx_cmp` ETC1S (served) vs UASTC q8 vs the BC7 master: PSNR per map, mean, and the crop grid of the hangar floor plate and a crate's label at 4×.
- [ ] **Step 2**: write the table to `docs/superpowers/evidence/bf2017-surfaces/Q5/psnr.md` (through the site PR) and decide by the threshold.

### Task 2: Encode and upload (desktop, if Task 1 says so)

- [ ] **Step 1**: `tool/ktx2_ultra.py --level hoth`: the pack-bound colour maps as UASTC q8 (`ktx2_encode.py --quality 8` with a `--no-hybrid` switch that ignores `ktx2_color.txt`) under `web_opt/ultra/<same path>`; log `logs/ultra_textures.log`.
- [ ] **Step 2**: upload with `--root web_opt/ultra --prefix web/ultra/` (its own state); read "to upload now".

### Task 3: The pack's ultra row (site, if Task 2 ran)

- [ ] **Step 1**: `scripts/lib/bf2017-level.mjs`'s `tex` rows gain `ultra: 'tex/<slug>.ultra.ktx2'` when the fetch finds `web/ultra/<path>`; `tierTexture(path, 'ultra', sizes)` returns it; the test pins both.
- [ ] **Step 2**: `galaxy-check surface hoth` at ultra under `BUDGET=1` (bytes, not GPU memory, move: the README's table gains the ultra column).

### Task 4: Anisotropy (site, now)

- [ ] **Step 1**: `levelGltf.js`'s `texture()` sets `tex.anisotropy = renderer.capabilities.getMaxAnisotropy()` on every map it binds; a test with a stub renderer asserts it.
- [ ] **Step 2**: `node scripts/surface-shot.mjs` on the hangar floor at a grazing angle before and after; `docs/superpowers/evidence/bf2017-surfaces/Q5/aniso-{before,after}.png`; the frame table unchanged within noise.

# Fidelity lane N: the ground alive, from the game's scatter tables. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, yourself, in order. Steps use checkbox (`- [ ]`) syntax for tracking. Build directly; one judge pass at most before the PR. **Starts when lane L's pack (#831) and lane T's `foliageNodes` twin are on `main`.**

**Goal:** The ground of a level world grows what the game grows: grass, ferns, twigs, leaves, small rocks and backdrop trees from `maps/terrain_scatter/<terrain>.json` (739 types over 39 terrains), at the record's density per tier, in the record's scale range, swaying with the record's wind numbers, dissolving by distance; painted where the terrain's own surface textures, slope and height say until the export's layer masks are solved.

**Architecture:** `scripts/bf2017-scatter.mjs <world>` writes `scatter.json` beside lane L's pack (types per layer, the derived mask per cell as a byte tile); `src/lib/three/scatter/`: `grid.js` (pure, seeded instances per cell), `wind.js` (the sway on lane T's `foliageNodes`), `scatterScene.js` (one `InstancedMesh` per type per cell, added and removed with lane L's cells, dissolve by distance, shadows in the first cascade only).

**Tech Stack:** three `^0.186.1` (`InstancedMesh`, node materials), lane T's `src/lib/three/foliageNodes.js`, lane L's `surface/level/levelStream.js` cell events and `lib/land/layers.js` (`image`), `scripts/bf2017-import.mjs` (the 251 scatter meshes' cuts), `sharp` (the surface textures' match), Vitest, `scripts/galaxy-check.mjs surface hoth,endor`.

**Spec:** `docs/superpowers/specs/2026-10-10-battlefront-fidelity-design.md` ("Lane N"; item 7). The README `web_opt/maps/README.md` ("Terrain scattering") names the fields and the mask's state.

## Global Constraints

- **Files this lane owns**: `scripts/bf2017-scatter.mjs` (+ lib, test), `src/lib/three/scatter/*` (+ tests), `scatter.json` beside each pack, `surface/scene.js` (one call site beside `createLevel`), the evidence folder `galaxy-engine/N/`.
- Density from the record's `Density` per quality level (ultra takes `Ultra`), a `DENSITY_CAP` named per tier for the frame; a type's mesh through the import's cuts (`far` for backdrop trees beyond the mid band).
- The derived mask says `mask: 'derived'` in the JSON and the PR; a world whose derived mask reads wrong (B4) ships without scatter, said in the hand-off.
- Files under 800 lines; tests beside; the gates.

## Review Focus

1. **Hoth**: snow everywhere, rock types only on the ridges' steep faces (slope over 35°), nothing in the hangar (the pack's indoor zones); the shot at the trench.
2. **Endor**: ferns under the canopy (the forest layer's textures), grass in the clearings, no ferns on the bunker's roof; the shot by the shield generator.
3. **The wind**: `WindScale`, `Stiffness`, `Damping`, `WindWiggle` through one sway on the twin, driven by `applyGameLight`'s `wind` uniform; the same gust moves the grass and lane X's snow.
4. **Cost**: at ultra on Hoth the scatter adds under 2 ms at 1600 × 900 on the owner's laptop or the lane sheds `DENSITY_CAP`; the perf table in the PR.

---

### Task 1: The tables and the derived mask
- [ ] The reader (types, density, scale, wind, dissolve per layer); the mask per cell from the surface textures' match, slope and height; tests on a fixture terrain; `node scripts/bf2017-scatter.mjs hoth endor`; commit `The game's scatter tables, and where each layer grows, derived`.

### Task 2: The scatter on the ground
- [ ] `grid.js`, `wind.js`, `scatterScene.js` with tests; the call site; the shots on Hoth and Endor; commit `Grass, ferns, rocks and backdrop trees grow on the game's ground at the game's density`.

### Task 3: The PR
- [ ] The hand-off's row; the gates; merge `origin/main`; push; PR `Fidelity lane N: the ground alive from the game's scatter tables` with the shots, the perf table, B4 answered.

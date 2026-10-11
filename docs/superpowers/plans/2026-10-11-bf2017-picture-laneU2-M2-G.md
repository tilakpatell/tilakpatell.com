# Lanes U2, M2 and G: headroom on, the material’s last mile, the gallery

The design: `docs/superpowers/specs/2026-10-11-bf2017-picture-everywhere-design.md` (§4). These three wait for T2 (`claude/bf2017-t2-flip`) to land; each is its own branch and PR from `origin/main` after it. The rules: `docs/health/RULES.md` and `.claude/skills/autopilot/SKILL.md`.

## U2: headroom on (`claude/bf2017-u2-headroom`)

Read first: `docs/superpowers/plans/2026-10-10-bf-fidelity-laneU-headroom.md`, `docs/superpowers/HANDOFF-galaxy-engine.md` (lane U “Left”, the laptop tables of #891), `src/components/galaxy/surface/level/{levelBatch,occlusion}.js`, `src/runtime/quality.js` (`headroomAt`), `surface/nodes/post.js` (`UNREAL = 3`).

1. `createLevelScene` is called with `batch` and `occlude` by tier (ultra and high on WebGPU; the laptop tables say where each pays); `BundleGroup` where the backend is WebGPU.
2. `headroomAt`’s steps drive the upscaler: TAAU 0.77 at 4K on WebGPU, FSR1 on `nodes-webgl` where the tables say it pays; the pace’s steps map onto them.
3. The bloom mismatch settled by measurement: the same emitter rendered through Unreal’s pass and the node’s, the ratio read off the frame, `UNREAL` replaced by the measured number with its `_source`.
4. Gates: calls on Hoth as U measured (183 → 78 on high); on the owner’s laptop at ultra every world under 16.7 ms p95 (`scripts/galaxy-budget.mjs`); in the cloud the software-GL ratio before and after. The desktop runs are a workflow the owner fires (`.github/workflows/`, `[self-hosted, gpu]`, as `desktop-doctor.yml` does); the lane writes it and the hand-off says it is the owner’s to run.

## M2: the material’s last mile (`claude/bf2017-m2-material`)

Read first: `docs/superpowers/specs/2026-10-10-bf2017-surfaces-design.md` (§2, Q1), `src/lib/three/surface/*`, `level/levelVariations.js`, `scripts/lib/bf2017-variations.mjs`, `docs/superpowers/evidence/bf2017-colour/README.md` (the material audit: Hoth 93.1 % against 95 %, the 24 mixed meshes).

1. Per-instance variations: the bins’ `Uint32 variation[n]` column (the desktop wrote it 2026-10-10) read by `src/lib/level/*` and `levelScene.js`; a mixed mesh draws one `InstancedMesh` per variation; `variationFor` takes the group index. Gate: `node scripts/bf2017-material-audit.mjs hoth sb_endor sb_kamino` at or over 95 % bound.
2. The site’s weather (snow, sand, wet) and `terrainBlend` passed to `composeOverlays`; `skyVisibility` from the probe until Q3.
3. The `decal` and `glass` families get their branches (glass: transmission and the preset’s roughness; decals: the `_nam` alpha as the blend).
4. Level detail slices: fetch the slices the recipe names, not `_000` only (`bf2017-recipes.mjs:285-288`); `recipeMaps` gives `detailSlices` for levels as for the crew.
5. The `_nts` translucency channel for foliage; head SSS through a screen-space pass in `light/post.js` (V’s slot); `F90ColorTexture` bound; the mask channels confirmed against the presets’ `UniqueMask` documentation in the dump, the “unconfirmed” note retired or kept with the evidence.
6. Gates: the audit; Q1’s fixture shots at every tier; the full suite.

## G: the gallery (`claude/bf2017-g-gallery`)

1. `docs/superpowers/evidence/bf2017-picture/gallery/`: every Star Wars world at ultra on the owner’s laptop (WebGPU and `nodes-webgl` legs), beside the game’s frame of the same place where one exists (the owner picks the game shots and the mods’ shots; the Steam set’s Endor village and the space battle are the first two), with the numbers (mean luminance, p50 and p95 ms, calls, triangles, MB).
2. The cloud leg: the same worlds at high in software GL, as the CI gate records them.
3. A short judgement per world in the README: what the frame has of the game’s (the shadows’ contrast, the haze, the bloom confined to emitters, the grade, the detail at distance) and what it still lacks, each lack named to a lane or to the desktop.

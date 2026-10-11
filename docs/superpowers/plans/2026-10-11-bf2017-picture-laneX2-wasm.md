# Lane X2: WebAssembly where it pays. The engine’s CPU hot paths measured, ported, and kept only when the numbers say so

The design: `docs/superpowers/specs/2026-10-11-bf2017-picture-everywhere-design.md` (§7, “WebAssembly”). Branch `claude/bf2017-x2-wasm` from `origin/main`. One PR. The rules: `docs/health/RULES.md`, `.claude/skills/autopilot/SKILL.md`; a new package or toolchain needs its `docs/stack/` page before it is used.

The owner asked that WebAssembly be used, regardless, and made robust. What is true: a Frostbite port is not a thing anyone can compile (no source; the game’s binary is EA’s), so this lane is not an engine port. WebAssembly is already in the engine where it pays most: Rapier (the physics, `src/lib/physics/`), the Basis transcoder (every KTX2, `src/lib/three/gltf.js:131-149`), the meshopt decoder (every GLB). This lane makes those robust and finds what else pays, by measurement, never by belief.

Read first: `docs/stack/` (rapier, meshopt, the KTX2 transcoder pages), `src/lib/physics/world.js`, `src/lib/three/gltf.js`, `src/lib/three/textures.js`, `src/lib/level/*` (the cell bins, `lod.js`, `fit.js`, `bands.js`), `src/components/galaxy/surface/level/{levelStream,levelScene,levelScatter}.js`, `src/lib/three/scatter/*`, `src/lib/battlefront/sim.js` and `src/lib/battlefront/ai/*` (the bots’ simulation), `src/lib/three/pace.js`, `scripts/galaxy-check.mjs` (how a frame is profiled in software GL), `docs/superpowers/evidence/bf2017-streaming/laptop-ultra*.json` (the laptop’s numbers).

## Tasks

1. **The three that exist, robust.** For Rapier, the Basis transcoder and meshopt: SIMD and threads detected and the right build chosen (`wasm-feature-detect` or a hand check, documented), the fallback path tested, a failed instantiation surfacing as a named error in the frame guard rather than a hang, the modules preloaded with the world’s chunk, and a test for each path. A `docs/stack/webassembly.md` page that says what runs in WebAssembly, why, and how each is loaded.
2. **The profile.** On the Battlefront world and Hoth at high in software GL (`galaxy-check.mjs` with the CPU profile on) and from the laptop’s recordings: the main thread’s time by module for one minute of play, the top ten entries written into `docs/superpowers/evidence/bf2017-picture/x2/README.md`. Candidates expected there: the cell bins’ decode and the per-frame LOD sort (`levelScene.js`, re-sorted every 8 m), the scatter’s tile placement, the bots’ simulation (`sim.js`, `soldierBrain.js`, the cover queries), the terrain’s height queries, the pace.
3. **The port, one at a time.** For each entry over 1.5 ms a frame on the laptop (or over its share of the 16.7 ms budget in the profile), a Rust crate under `wasm/<name>/` built with `wasm-pack` (the stack page; `wasm-bindgen`, no threads unless detected), the same tests as the JavaScript it replaces run against both, the JavaScript kept as the fallback behind the same interface, and the number before and after. A port that does not pay by its own measurement is removed from the PR and its number kept in the evidence.
4. **The build.** `vite` loads the `.wasm` as an asset with the right MIME in `deploy.yml`’s publish; the health check’s layers hold (`wasm/` is a leaf under `src/lib`); the file-size caps.
5. **Gates:** the full suite; the frame’s main-thread time on the laptop before and after (through lane W’s `gate` job); the evidence table; nothing slower.
6. Merge `origin/main`, the full checks, the PR, the hand-off row.

## Not this lane

A game engine port; the renderer (T2); the stream (R2).

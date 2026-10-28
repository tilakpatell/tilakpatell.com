# Hoth is bf2-web’s: its engine on the visitor’s GPU, its rules under the fallback

**Date:** 2026-10-28 · **Status:** accepted · **Where:** `src/lib/battlefront/bf2web/`, `scripts/bf2web-golden.mjs`, the engine’s page (below) · **Follows:** [the engine in place](2026-10-10-the-engine-in-place.md) (for Hoth, this replaces it), [the 2017 drop](2026-10-10-battlefront-2017-assets.md), [the heavy assets on R2](2026-10-21-heavy-assets-on-r2.md), [the site on Cloudflare](2026-10-21-cloudflare-for-the-site.md)

## Context

The owner asked for Hoth and the core engine logic to move from `bf2-web` into the site’s Star Wars galaxy: `bf2-web` is the more complete one and the source of truth for the game, and the world should look like the original game, rendered and played by WebAssembly and WebGPU on the visitor’s own graphics card. The assets and the site are Cloudflare’s, not Supabase’s.

What was found, 2026-10-28, on `bf2-web` main at `da7a51b` (round 1029):

- `bf2-web` runs the original engine compiled to WebAssembly (Emscripten, threaded) with its own WebGPU renderer: authored lights, shadows, reflections and Enlighten GI from the game’s cooked data, and on Hoth street-0 Arcade Onslaught with bots on BF2’s retail soldier tree, combat, the HUD, audio and the round’s end. Its builds and cooked scenes are made on the owner’s desktop and are in neither repository; the backups on R2 (`bf2-workspace-backup`) are from 2026-10-19, before the World runtime.
- Its game rules beside the engine are the port’s own plain C++, each with a CPU driver its gate builds native and wasm32: the Arcade round, the respawn waves, the spawn finder, the soldier’s health, the E-11, BF2’s soldier tree and the state round it (checked against the retail think in an emulator), the nav planner. The site’s three.js Battlefront wrote its own versions of most of them from the records.
- Hoth’s Skirmish nav graph is in the site’s level pack already (`navmesh.bin`’s `skirmish` mesh, 1,967 areas, the graph bf2-web’s bots plan on), and Hoth_01’s `TeamDeathmatch_Global` spawn layer is in its map rulebook (`src/data/bf2017/maps/hoth.json`).

## Decision

- **On Hoth the site runs `bf2-web`’s engine.** Its build and the cooked Hoth scene are exported by `bf2-web`’s own step (`WORLD_EXPORT`, its `export-play-site.mjs`) on the owner’s desktop and uploaded to the private bucket (`bf2017-assets/sites/<build-id>/`); the site’s Worker serves that play site at `/battlefront/engine/`, and the Battlefront route opens it, where the engine draws with the visitor’s WebGPU. That page and its files alone are cross-origin isolated (COOP `same-origin`, COEP `require-corp`, as `bf2-web`’s servers send), for the engine’s threads; everything it loads is the Worker’s, on the site’s origin.
- **The three.js world is the fallback**, where the engine can’t run (no WebGPU or none with BC textures and dual-source blending, a GPU under the limits the build’s programs bind, no isolation, too little memory, no build published), and plays by `bf2-web`’s rules: `src/lib/battlefront/bf2web/` translates them to JavaScript, each held to `bf2-web`’s native driver on its gate’s scenarios (`scripts/bf2web-golden.mjs` writes the records; the tests replay them to the float) or to the retail digests `bf2-web` recorded. The bot brain and the soldier controller are not translated: the engine runs them.
- **Never the engine’s source.** Neither repository holds it; what the site serves is the compiled build the owner publishes.

## Consequences

- Hoth looks and plays as the port does, on a desktop GPU with WebGPU; a phone or a browser without it gets the site’s world on the same rules.
- The site serves BF2’s engine, compiled, and the cooked retail scene to every visitor. `bf2-web`’s own deploy notes (`WebPort/docs/DEPLOY.md`) keep both private, behind an authenticated Worker; asked on 2026-10-28, the owner chose public for every visitor, on the permission the 2017 material came with. The site’s Worker reads the play site from the private bucket through a binding and serves only the files its manifest names.
- A change in `bf2-web`’s rules is a new golden run (`node scripts/bf2web-golden.mjs`) and a failing test until the JavaScript follows.
- The engine’s page keeps its own loop and GPU device, outside `src/runtime`; it is one page, not a world module.
- `docs/README.md`’s “the site does not port or publish any game engine” no longer holds for Hoth.

## Revisit when

- `bf2-web` plays another level (a level is a manifest and a route), or its engine runs without threads (the isolation goes).
- The owner puts the engine behind authentication (planned, 2026-10-28) or takes it private: the Worker’s engine paths check it or go, and the route keeps the fallback for whoever can’t pass.

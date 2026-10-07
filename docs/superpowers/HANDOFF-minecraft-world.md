# Hand-off: Minecraft’s world

The design is `specs/2026-10-07-minecraft-world-design.md`; the plan, in seven phases that are each a pull request, is `plans/2026-10-07-minecraft-world.md`. Read both before touching code, and read the plan’s **As built** note at the head of Phase 1: where the code and the tasks differ, the code is right. The Mario 64 tribute (`src/components/mario64/`) is the pattern: a world module on `src/runtime`, pure rules under test, the page and the island’s overlay. `docs/architecture.md` has a paragraph, *Minecraft’s world*.

## Done

- The design and the plan (PR #472).
- **Phase 1, blocks and a chunk you can walk on** (Tasks 1.1 to 1.13, PR #497, 2026-10-07). `#/dot-matrix/minecraft` draws an endless seeded world (nine biomes, oak, birch and spruce, plants, the sea at 63) in Pixel Perfection’s tiles; the player walks, sprints, sneaks, jumps and swims by the game’s numbers; the island’s crafting table opens it and Esc from the title returns. 125 rule tests. At distance 10 (441 chunks): 400–450 draw calls, 74 frames a second in Edge on the desktop’s GPU; a chunk takes 2 ms to generate and 3 ms to mesh in the worker.
- **Phase 2, dig and build** (Tasks 2.1 to 2.5, PR #510, 2026-10-07). The crosshair's block by a voxel walk to 4.5, the game's outline and ten-stage crack; break times in whole ticks by the game's sum; drops, tool wear; placing with logs' axes and furnaces' facing (drawn); sand and gravel fall; dropped items fall, merge and are picked up; Q throws. 36 slots and the hotbar with the pack's item tiles and isometric block icons; the inventory's 2 × 2 and the crafting table's 3 × 3 on the pack's own panels, with the game's click rules; the recipe table. The save keeps the seed, clock, player, inventory and every chunk's edits, run-length packed; edited chunks arrive meshed with their edits. `scripts/mc-check.mjs` cuts a tree, crafts planks, a table, sticks and a pickaxe, builds, reloads and finds it all.

- **Phase 3, light and the day** (Tasks 3.1 to 3.3, PR #524, 2026-10-07). Sky and block light computed in the worker and re-lit round every edit; the game's smooth lighting and its lightmap (warm torchlight, the blue-grey night); a 20-minute day with the sun's eased arc, sunrise and sunset glow, stars, the moon's eight phases, clouds greying at night; torches standing and on walls, slabs, and the two-block bed that sleeps the night away and sets the spawn. `scripts/mc-check.mjs` shows a sunset, the night, a torch and the morning after sleeping.

## Left, in order

1. **Phase 4, underground.** Tasks 4.1 to 4.4. Stairs, doors, ladders and fences mesh as cubes today (slabs, torches and the bed are drawn: `emitBox` in the mesher makes any box with the game's position-derived texels); `physics.js` takes per-cell boxes through `world.boxes(x, y, z)`. Snow layers were left out of the snowy biome until slabs mesh.
2. **Phase 5, mobs.** Tasks 5.1 to 5.3. The skins are in `public/mc/skins/` (the pack’s `temperate_` farm animals are the classic layout; `cow.png` and `chicken` fall back through `SKINS` in `pack/aliases.js`).
3. **Phase 6, biomes and builds.** Tasks 6.1 to 6.4. Tints are the pack’s colormaps at plains’ climate today (`pack/colormap.js` has every biome’s climate); per-place tints need the biome in the vertex (there are two spare bits in the `u | v << 5` word, or grow the vertex).
4. **Phase 7, polish.** The list in the plan, plus: view bobbing, fancy (3D) clouds, the dirt-textured loading screen.

## Checking it

- The route: `#/dot-matrix/minecraft`. From the island: `#/dot-matrix`, walk to the crafting table east of the N64 (x 33–34, z 10–11), stand on its south side, press B (or F, J, X, Enter).
- `?quality=low|mid|high` pins the tier (the render distance follows it: 4, 6, 10 chunks).
- In development `window.__RUNTIME__.current.world` is the world: `.game` the sim, `.debug.stats()` the chunks, columns, meshes, vertices and draw calls, `.debug.teleport(x, y, z)`, `.newWorld(seed)`.
- The browser check: `npx vite --port 5188 --strictPort --host 127.0.0.1`, then `OUT=<folder> node scripts/mc-check.mjs`. On this Windows desktop: `CHROME="C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" GPU=1` (the GPU is real and fast; without `GPU=1` it draws in software, slowly). `SEED` picks the world (1 by default). It prints frames a second and draw calls and writes `mc-*.png`.
- Gates: `npm run lint`, `npm test`, `npx vite build` (not `npm run build`: its prebuild rewrites `public/github.json`), `node scripts/autopilot-check.mjs --routes /dot-matrix/minecraft`.

## Gotchas

- **No Mojang asset in the repo.** The shipped textures are Pixel Perfection Legacy 25.4-75.1 (XSSheep, continued by Nova_Wostra; CC BY-SA 4.0; Modrinth project `6w3F4SEu`). The download is outside the repo at `C:/Users/tilak/Downloads/mc-packs/ppl` (unzipped). Rebuild with `node scripts/mc-atlas.mjs C:/Users/tilak/Downloads/mc-packs/ppl --vanilla C:/Users/tilak/AppData/Roaming/.minecraft/versions/1.21.11/1.21.11.jar`: `--vanilla` reads the owner’s own game jar (never copied) and fails on any tile 90% or more the same as Mojang’s. The pack’s zip has no licence file; the licence is stated on its Modrinth page (licence URL CC BY-SA 4.0) and, for XSSheep’s original, on Planet Minecraft and in VoxeLibre/Luanti’s imports.
- The rules never import three.js: they run in the worker and in vitest. Files a Node script imports (`pack/atlas.js`, `pack/aliases.js`, `rules/blocks.js`) import with `.js` extensions.
- **three r186 GLSL3:** there is no `gl_FragColor`; declare `layout(location = 0) out highp vec4 outColour;`. Shader errors are silent unless `renderer.debug.checkShaderErrors = true`.
- **A context lost while a world is made: the runtime makes the world again** (fixed in `src/runtime/runtime.js`). It used to keep a world built on a renderer that had gone (blank view, ticks running), or fail the mount when `create` read `rt.gfx` after an await. Now a world whose backend went during `create` (or its `ready`) is disposed and made again on a fresh backend, once, with the status kept at `loading`; two mounts at once share one backend instead of leaking one; and a world only draws on the backend it was made on. So `frame.renderer` is always the renderer `create` was given, and modules may keep it. The Minecraft module's `take()` (re-applying its settings to whichever renderer a frame brings) predates this and is now belt and braces. After such a loss the new context can come up on software (5 fps in a check run): that is the environment, not the world.
- **The shared index buffer:** every column mesh shares one index attribute; `geometry.dispose()` makes three delete it, breaking every other column, so `scene/chunks.js` calls `setIndex(null)` first.
- **The Claude app’s browser pane, when hidden, stops the frame loop entirely** (`rt.status` stays `ready`): check in headless Edge (`mc-check.mjs`) instead. Chunk loading also continues from worker replies, so a throttled tab still fills in.
- **Git Bash on Windows** turns `/dot-matrix/minecraft` arguments into `C:/Program Files/Git/dot-matrix/minecraft`: run `autopilot-check.mjs` with `MSYS_NO_PATHCONV=1`, and with `--skip build` after a `npx vite build` (its `spawnSync('npx')` can’t start without a shell on Windows).
- **`npm test` on Windows** fails three tests that aren’t this world’s (`scripts/health.test.mjs`’s path separators, `scripts/gen3d` running TRELLIS in WSL, `src/data/modelCredits.test.js` timing out on a slow file scan); CI on Linux is the gate.
- `npm run credits` on Windows reorders unrelated rows of `CREDITS.md` (line endings in the regex); the Pixel Perfection section was inserted by hand. The script itself knows the section (`shareAlike`).
- `src/data/modelCredits.json` is Sketchfab-only (its test checks the source URL); the pack is credited in `public/games/credits.json`, `public/cc0/README.md`, `CREDITS.md`, the page and the title screen.
- The Bash tool in the Claude desktop app strips backslashes from heredocs; write files with the Write tool.
- `npm ci` in a worktree needs `--ignore-scripts`.

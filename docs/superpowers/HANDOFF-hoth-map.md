# Hand-off: Hoth's map in the Battlefront world

Written 2026-10-13, as a session ran out, for whoever picks Hoth up next. The owner's words: the map is "really really bad even on ultra mode": textures collide, you phase through things, there are invisible walls. They want Hoth exactly as the game has it, worked out from the game's data and code (bf2-re: the exports, the Ghidra decompiles, REA), never from screenshots of the real game.

## What is done

On branch `claude/hoth-map` (pushed; it builds on #990), as of 2026-10-14:

- **Echo Base streams with the outside.** `map/level.js` loads `INSIDE.hoth = 'base'` in the same frame, and `map/collision.js`'s `createPartsCollision` gives each pack its own collision.
- **The player walks on a Rapier body** (`map/walk.js`, sim.js's `mover`), on both packs' shapes and the terrain's heightfields (`setTerrain`, which was never called before). The body is held over the void until the shapes under it stream in, and the collision fills the cells nearest the player first. Measured: the fuel room's floor at 359.15 m, walked; the trenches; from the snow into the west hangar's mouth, up to the closed blast door.
- **The terrain's holes are back** (`scripts/bf2017-holes.mjs` writes `terrain.holes` into level.json; `lib/land/holes.js` reads it; `map/ground.js` discards fragments over them through a maskNode; a 64 m terrain collider holding one becomes a trimesh, `addHoledGround`). The flat plates over the trench tunnels and across the hangar mouths are gone.
- **The local Rapier tests run on Windows again** (`lib/wasm/instantiate.js` pathOf kept a slash before the drive).

Running when this was written (workflows; their transcripts and journals are under the session's subagents/workflows folder): `hoth-game-exact-lanes` (wf_3b64fcf3-7f1: abilities, animations, skins/textures, from main), `hoth-terrain-and-interior-light` (wf_3bf27686-adc: the nine terrain layers' masks decoded from the streaming tree; Echo Base lit by its interior VE and lamps; based on claude/hoth-map), `hoth-navpower-navmesh` (wf_757b82d2-c8b: Hoth's NavPower blobs decoded into navmesh.bin and a pure `lib/battlefront/navmesh.js`). Resume one with `Workflow({ scriptPath, resumeFromRunId })`.

On branch `claude/hoth-bots`, as of 2026-10-14:

- **The bots walk the game's own navmesh** (`lib/battlefront/navmesh.js`, bf2-re findings/57; `meshNav.js`): a step goes along the playthrough mesh and over a link off it, a way is the mesh's, a deploy stands on its floor, the fuel room's and not the mountain's snow over it. A goal with no height is on the floor the walker can reach nearest its own height (the field's snow rises 45 m from the trench to the doors). The mode prefab's far list (the starfighters' points, 500 m up) is no soldier's spawn.
- **The hangar gates run as the game runs them** (`lib/battlefront/gates.js`, bf2-re findings/59): the first walker home blows the gate it reached a second later (its leaves' Enabled set false) and unlocks the other's panel; its panel is held a second from in front of it within 6 m (the button's 2 m on a transform it scales 3×); the leaves slide 8.96 m over 70 s (the gate's own run, set through its door core into the controller's interpolator, which alone says 1.5 s); the doorway joins the mesh once they are a soldier apart, 6.5 s in. The attackers go to the panel while the stage's posts stand behind it shut. Measured: a bot opened the west gate 130 s in, six of eight attackers in the hangars 160 s later.
- **The player's E is held** (`input.js`'s `interactHeld`, passed through `battle.js` and `sim.js`): before, the interact never reached the sim, so the player could open no gate and hold no bomb.

Still open on the map: the soldier sinks into the ultra 1 m patch's displaced snow at the trenches; the gates' leaves are not drawn moving here (the GA layer's lane, `claude/hoth-ga-doors`, draws them: its `stepDoors` takes `gates[id]` as `{ fraction }`, which is `view().mode.gates[].open`); the door core's second hold value (Float 3 against the gate's 1) is unsettled.

- **The spawn logic** (PR #990, branch `claude/caveman-reverse-engineer-7df20d`): Galactic Assault's spawn sets come from the sub-world's own graph, run on the page (`lib/battlefront/spawnLogic.js`, bf2-re findings/55).
- **The dev door's `place`** [x, z] (same branch): stands the player at a spot and answers with the sim's ground, the terrain's and the mask's say there.

## Why the map is broken (measured, not guessed)

Measured with the walk script below at ultra on the RTX 5090 (WebGPU).

1. **The terrain's holes are filled.** `scripts/bf2017-level.mjs` `writeTerrain` merges the 0.5 m detail map into the 1 m near map and then calls `fillHoles`, at each hole's lowest rim, so that a walker on the heightmap can get in. Hoth's detail map has 7,502 hole pixels (bf2-re findings/11): the hangar mouths and the trench tunnels. The fills draw as flat, dark, jagged plates over the trenches and across the hangar mouths. That is the "textures collide". `level.json`'s `terrain.hole: 0` is the hole *marker* (a hole reads 0), not "no holes". The builder keeps the mask as `holeMask`/`holeAt` but only uses it to split instances between packs, and never ships it.
2. **Echo Base is not loaded.** The base interior is its own pack, `hoth/base` (14,513 instances, built with `--district base --inside`, 6,882 files published). `map/level.js` loads only `hoth`. Stages 2 and 3 of Galactic Assault happen in rooms the world doesn't have.
3. **Soldiers walk the terrain heightmap in 2D.** `lib/battlefront/soldier.js` `move()` tests `walkable(nav, x, z)` (a 0.5 m bit grid baked by `scripts/bf2017-nav.mjs` from the Havok shapes with the capsule at the terrain's height) and sets `y = heightAt(nav)`, a bilinear blend of 2 m terrain cells. Floors, ramps and tunnels that aren't terrain don't exist for it. That's the phasing (thin walls between 0.5 m samples) and the invisible walls (a capsule at terrain height meeting overhangs). Measured: the sim's ground is 383 m at the hangar gates (the gates stand at 359 m), 415 m inside the hangar and 436 m in the fuel room. Soldiers walk the mountain's roof. Rapier runs in this world only for the camera's arm (`map/collision.js`). The galaxy surface's `playerBody.js` (Rapier's character controller on the record's capsule, `lib/physics/soldier.js`) is never used here.

## The plan, in order

1. **Stream `hoth/base` beside `hoth`.** In `map/level.js`, a second `createLevel` for `${world}/base` with `ground: false`, the same frame (both packs' origin is 205, 362.3, −1540), its update, loaded, progress, stats and before/after render folded into the outside's. Give it a second `createLevelCollision` on the same physics world. The two packs' cell keys clash (`-1,-1` is in both), so route `onCell` by part.
2. **Put the player on a Rapier character** (`lib/physics/character.js` `createCharacter`, options from `controllerOptions(soldier row)`). It runs against both packs' shapes and the terrain, the sim's player position is written back from it, and the sim keeps `move()` for bots only. findings/46 has the game's controller: `hknpCharacterProxy`, the ground spring (0.3/0.6/0.8 of the gap a tick), the 0.55 step, falls past 0.8 m, jump 5 m/s under −20 (−18 off an edge).
3. **Ship the holes.** `writeTerrain` writes `terrain/holes.png` (from `holeMask` at 1 m, or 0.5 m inside the detail map's bounds) and a `terrain.holes` entry. Then republish the pack (scripts/assets-publish.mjs; the bucket needs the owner's key). `map/ground.js` drops the triangles over a hole. The terrain collider (`levelPhysics.setTerrain`, `lib/physics/heightfield.js`) can't hole a Rapier heightfield from JS, so a 64 m cell with holes becomes a trimesh without those triangles. `heightAt` answers "no ground" in a hole.
4. **Bots on layered ground.** A navgrid cell holding one floor height per layer (rays down through the Havok shapes and the holed terrain), so bots path into the base. `bf2017-nav.mjs` builds it; `nav.js` and `navField.js` read it.
5. **The terrain's look** from findings/35 (Hoth's nine layers, tilings, smoothness 0.26, the rocky colours, the blowing-snow animation) and findings/11 (the snow has no colour map: the colour is per-layer constants plus normals, smoothness, sparkle and soot), against `map/ground.js`.

## How to test (works on the owner's desktop)

- In a worktree, `node_modules` holds only a `.vite` cache. Replace it with a junction to the main checkout's: `cmd //c "mklink /J node_modules ..\..\..\node_modules"`.
- `.env.bucketcheck`: `VITE_ASSET_BASE=https://jzabcqboyemokwifmjmp.supabase.co/storage/v1/object/public/site-assets`. `.vite-wt.config.mjs` (in `bf2-re/tools/site-check/vite-wt.config.mjs`) imports `vite.config.js` and sets `server.fs.strict: false`. **Without it the basis KTX2 transcoder 403s and the map draws bare terrain**, which looks like the meshes are missing when they aren't. Never commit either file.
- Run Vite with `--config .vite-wt.config.mjs --mode bucketcheck` (a `.claude/launch.json` entry, started with the preview tool).
- `bf2-re/tools/site-check/hoth-walk.mjs <port> <out> ultra [spots.json] [?query]`: headless Edge on the GPU (`--use-angle=d3d11 --enable-gpu --ignore-gpu-blocklist --enable-unsafe-webgpu`) opens `/#/battlefront/hoth/galacticAssault`, deploys, stands the player at each spot (`place`), turns the view (`look`) and shoots it. The app's browser pane barely animates while hidden, so don't rely on it.
- Spots worth shooting: the walkers' start (47, −1000), the trench line (130, −1230), the uplink trench (165, −1410), the gates (179, −1585) and (251, −1600), the hangar (215, −1650), the fuel rooms (209, −1755).

## Also running

Two background sessions in their own worktrees, each opening its own PR: the abilities (every Hoth trooper and hero ability against findings 33, 41 and 46, dev port 5431) and the animations (locomotion, the lower body, layers and render bones against findings 24, 50 and 52, port 5441).

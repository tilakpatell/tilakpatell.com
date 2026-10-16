# Hulls you can hit: every ship in the galaxy’s space a solid of the game’s shapes, and a shot doing the game’s damage. The design

Date: 2026-10-14. Status: **design, approved in conversation with the owner; for one implementation session.** The first of two projects; the second (every ship at the game’s full detail on mid and above, through the game’s LOD chain) has its own design after this one. Starfighter Assault is rebuilt on its own and is not this page’s.

## What the owner asked

“Use the bf2 2017 assets for ALL of the star wars ships with all of the detail when on medium + quality for the space battles and have proper hit boxes … so the hitboxes and battles on top of planets are correct (including the users star wars models/ships/assets).” Asked what is wrong with the galactic war today: “Its not using the bf2 2017 models and needs proper ship hitboxes and you can go through some ships and stuff etc. Make it better overall.” Then, on what is not proven: “if something is infered check game and ghidra and use REA to see how we can do that.”

Settled with the owner, question by question:

1. Three projects, not one. This page is the first (hitboxes); full detail is the second; Starfighter Assault is rebuilt separately.
2. The battles meant are the Galactic Civil War’s, in the galaxy you travel (`/galaxy`: `galaxy/warfront.js`, `universe/battle.js`).
3. The ships the game never had (the B-wing, the Gozanti, the Munificent, the Delta-7, the Acclamator, the Executor, the Interdictor, the Ghost) keep their models and get hulls made from them.
4. The hulls reach all of the galaxy’s space, not only the war: the hunters, the wingmen, the set pieces that jump in, the Interdictor, the other pilots online, and your own ship and your shipyard builds. One hit system.
5. Damage is the game’s, not the war’s tuning: the bolt’s falloff, the material grid by the part hit, the game’s hit points.
6. Anything inferred is checked against the game’s data, then Ghidra, then REA, before it ships as fact.

## 1. What was found (2026-10-14, `origin/main` at `8cea304ba`)

**Every hit is a sphere.** Your bolt hits a war fighter within `max(0.35, size × 0.9)` (`universe/battle.js:526`), an AI bolt within `size × 0.6` (`:356`), you within 0.3; a hunter within `size × 0.9 + 0.12` (`universe/hunterRules.js:197`); another pilot within 0.22 (`online/pilots.js:72`); rams are two moving spheres (`lib/combat/contact.js:65`, `bodyRadius = size × 0.5 + 0.08` at `:55`). A capital ship is a row of spheres down its centreline (`universe/wars.js:502` `HULLS`, placed by `battleCapitals.js:73`), thin on purpose so the space beside a hull is open: the Star Destroyer’s largest is 0.09 of its length against a width of 0.58 (`battleKit.js` `WIDTH`), so a bolt at its wing’s edge meets nothing and a fighter flies through the wing.

**What is drawn is not quite what is hit.** `battleScene.js:71` turns a ship by `fwd`, `up` and `bank`; a capital also bobs ±0.15 on screen (`:289`, `Math.sin(t * 0.3 + cap.id) * 0.15`), which the simulation never sees.

**The game’s shapes exist for every ship it has, and nothing in space reads them.** The export (`C:\Users\tilak\Downloads\BF2_Extract\web\physics\`, and the private bucket `bf2017-assets`) holds each fighter’s Havok asset, `Gameplay/Vehicles/Air/<X>/Vehicle_Air_<X>_Physics_Win32.glb`, in two roots: the X-wing’s root 0 is two convex hulls in a box about ±5.5 × ±1.78 × ±6.2 m, its root 1 eight part meshes of 430 triangles in all (15,588 bytes); the TIE fighter’s root 0 one hull of 44 triangles, root 1 three meshes of 804. The capitals’ modules have theirs (the Star Destroyer 135 assets, the MC80 92, the Venator 138, the Lucrehulk 50, the CR90 14). `scripts/lib/bf2017-physics.mjs` reads them (`readPhysicsGlb`, `:184`), and `src/lib/physics/shapesBin.js` packs a level’s; only the surfaces’ level packs use either. The space packer drops the game’s collision on purpose (`scripts/lib/bf2017-space.mjs:68-70`), and the vehicles’ physics lane (P3 of the physics hand-off) is not started and is scoped to the ground.

**The game’s numbers are half in.** `src/data/bf2017/air.json` carries each fighter’s bolt (the X-wing’s `Projectile_Xwing`: 75 falling to 65 between 400 and 600 m, 2,000 m/s, 0.45 s, a blast of 22.5 in 5 m), its health (1,200, regeneration 250 a second after 6 s) and its ram rule (`collisionAngle` 65, `glancing` 6, 20 friendly and 25 enemy), each with its `_source`. Not in: how the material of the part a bolt meets becomes a multiplier, the capitals’ and their subsystems’ hit points, the capitals’ turrets’ weapons.

**What the reverse engineering already says** (`bf2-re/findings/`): a bolt is a projectile swept once a tick, not a hitscan (20:45); everything but a soldier is met through the spatial query manager (25:65); damage is the weapon’s times the **material grid**’s multiplier for the material hit, not a per-weapon table (20:50: hull materials at 0.15 and 0.1, a weak spot’s 1.9, a shield’s 0); the five `VehicleHealthZoneData` zones are all 1 and do no damage (45:247); a part’s health states are 100,000, 100 and 0, switches for its debris, not armour (45:255); a capital is scenery, hull modules and turret prefabs (45:28), its shield generators and reactors separate destructible prefabs whose fields are unread (45:243). **Unproven**: which of the two roots a sweep tests; how a physics material id (the X-wing’s body `Packed 0x49800`, palette indices 172 and 14) becomes a grid row; whether 68 in 39:180 is a target’s material or an attacker’s property.

## 2. The decision

### 2.1 A hull for every kind, made ahead of time

`scripts/bf2017-hulls.mjs` (its pure parts in `scripts/lib/bf2017-hulls.mjs`, tested) writes one hull a kind for every kind the galaxy’s space flies. It reads the kinds from the rosters (`universe/wars.js`, `galaxy/battlesWars.js`, `galaxy/hunted.js`, the set pieces and `galaxy/warpieces/`, `models.js`’s `HUNTER_GLB`), so none is missed; a test fails a roster kind with no hull.

- **A game fighter**: its `Vehicle_Air_<X>_Physics_Win32.glb`, from the local export, else fetched from `bf2017-assets` into `lab/assets/bf2017/physics/` (git-ignored). Both roots are kept: root 1’s part meshes for bolts, root 0’s hulls for contact, each shape with its part index and physics material. Which root the game’s sweep tests is settled by §2.5 before the bolts are wired; until then bolts test root 1.
- **A game capital**: the Havok assets of the kit modules its fleet file was made from, placed with the same module transforms `bf2017-fleet.mjs` and `bf2017-space.mjs` used, so a module’s shape sits on the module drawn. Turrets, shield generators and reactors keep their own part ids, so a hit on one is a hit on it.
- **A ship the game never had**: its render model, simplified with `meshoptimizer` (already a dependency) to about 600 triangles for a fighter and 4,000 for a capital, one part, material `hull`, its subsystems’ parts marked by hand where the war fires at them (the Executor’s bridge and generators, the Interdictor’s wells).
- **Your shipyard’s modules**: a hull each, made the same way from the module’s geometry; a build’s hull is its modules’ hulls placed as `shipModelsCore.js` places the modules.

**The frame is the render model’s.** `galaxy/models.js`’s `normalise()` turns a model nose to +z, centres it and scales it to 1 long; the hull goes through the same turn, centre and scale, worked out from the same cut’s box, so a hull never drifts from the ship drawn and every cut of a kind (the full detail project’s too) shares it. A test holds each hull’s box to its render cut’s within 2 %.

**The file** is the shapes bin raised to version 2 (`src/lib/physics/shapesBin.js`): version 1’s shapes as they are, after a header holding the kind’s bounding radius, its parts’ names and the material id of each. Version 1 files keep reading. A game-derived hull goes to the public bucket `site-assets` as `models/galaxy/hulls/<kind>.bin` through `scripts/assets-publish.mjs` and its line in `src/data/galaxyAssets.json`, never into git (the 2026-10-10 assets decision); a hull made from a model already in the repository is committed beside it in `public/models/galaxy/hulls/`. The X-wing’s is about 15 KB; a battle’s dozen kinds stay under 300 KB, fetched with their models.

### 2.2 One pose for the drawing and the hit

`src/lib/combat/pose.js` (pure, no three.js): `poseOf(ship, t)` → the position and the basis a ship is drawn at, from `fwd`, `up` and `bank` and a capital’s bob. `battleScene.js`’s `orient()` and every hull query take it, so what is hit is what is drawn. The bob stays, now in both.

### 2.3 Bolts against shapes, ships against ships

`src/lib/combat/hulls.js` (pure, no three.js, so the simulation and its tests in Node use it as they are):

- `hullOf(bin)` → a kind’s hull: its parts, each part’s triangles in a small bounding-volume tree built once a kind, its bounding radius.
- `segmentHit(hull, pose, size, a, b)` → `{ t, part, material, point, normal }` or null: the bolt’s path this tick, carried into the ship’s frame, against the part triangles. Today’s sphere test stays in front as the broad phase. Of all the targets a bolt meets, the nearest along it wins.
- `hullContact(a, b)` → `{ normal, depth, closing }` or null: the smaller ship’s probe points (its root 0 hulls’ corners and centre) swept against the larger’s shapes. Nobody passes through anybody: you, the AI’s fighters, the capitals. A ram does the game’s damage (`air.json`’s `health`: under 65° to the surface a ram, past it a glance at a sixth; 20 to a friend, 25 to an enemy) and pushes the two apart along the normal.
- Until a kind’s hull has loaded, its ship is today’s sphere, so nothing breaks while it streams.

Wired through the one bolt chain (`galaxy/scene.js`’s `moveBolts` → `strike` → `scored`) and everything that tests a ship: `universe/battle.js` (your shots, the AI’s bolts, `capitalHit`), `battleCapitals.js` (turrets and subsystems on their own shapes, the hull spheres retired), `hunterRules.js`, `online/pilots.js`, `shipHits.js` and `lib/combat/contact.js` (rams), `galaxy/warfront.js`’s solids, the set pieces, the Interdictor, and your own ship and builds.

### 2.4 The game’s damage

- **A shot** does its weapon’s damage from `air.json` (`damage` falling to `damageFar` across `falloff`, in metres: a galaxy battle unit is 53.3 m, `METRES` in `surface/missions/starfighter.js:44`), at its speed and life, with its blast where it has one.
- **times the multiplier** of the material of the part it met, from the material grid (§2.5): a shield 0, a hull its row, a weak spot its row.
- **against the target’s hit points**: a fighter’s `health.max`, regenerating at `regenRate` after `regenDelay`; a capital’s, its turrets’ and its subsystems’ from their records (`StaticModelHealthComponentData`, `WSStaticModelHealthComponentData`, `WSVehicleHealthComponentData`), read by `scripts/bf2017-rulebook-damage.mjs` into `src/data/bf2017/damage.json`, every number with its `_source`. A capital’s turrets fire their own weapons from their records.
- **The war’s shape stays the site’s**: shield generators, then the bridge, then the reactor; where the game has the part, its hit points are the game’s. A kind the game never had takes the nearest game ship’s numbers of its class, named in `damage.json` as such.
- **A guard, not a retune**: a simulation test plays every Galactic Civil War battle with nobody flying and holds that it ends, either way, between 6 and 20 minutes. If the game’s numbers put a war outside that, the finding goes to the owner with its numbers; nothing is quietly scaled.

### 2.5 What is inferred is proven, in this order

Every number and rule the hulls and the damage use is either read from a record (cited `Type.Field` with its file) or proven by one of these, and written up as the next numbered finding in `bf2-re/findings/` with its evidence marked RECORD, CODE, LIVE or NOTE (the `abil63/REPORT.md` convention). Nothing ships marked *(inferred)*.

1. **The game’s data first.** The material id to grid row: each space level’s `materialgrid_win32.json` (`Levels/Space/SB_*`) joined with the materials in `physics.jsonl` and each ship’s `RigidBodyData.Material`; if the six grids agree on the rows used, that is the grid, and if they differ the system takes its nearest level’s, the choice written beside it. The capitals’ subsystems’ hit points from their prefabs.
2. **Then Ghidra**, headless and read-only on a copy of the named live project, as `D:\bf2-ghidra\abil63\gh.ps1` runs it: the projectile’s hit path, `ServerProjectileEntityUpdater::postQueryUpdate` (0x148358c90, already decompiled), for which shapes its query asks (root 0 or root 1) and where the multiplier is read; the shape-tag codec (0x147bb0bd0) for how a hit shape’s tag carries its material; `ServerStarfighterHealthComponent` (vtable 0x14321c198) for how a hit and a ram become damage; `BulletEntity::updateTransformSync` (0x1483a40e0) for the sweep.
3. **Then REA.** The first task is to make it work on this machine, where findings/30 left it (no `GHIDRA_INSTALL_DIR` for its server; `binary_overview` timing out at 330 s on the 239 MB image): its Ghidra path set, and the named project exported as a snapshot it can open, or the image cut to the functions above. With it, the call paths and data reads of step 2 are traced again as a second reading. REA’s browser tools record the galaxy’s war on the live site and on the branch (`capture_browser_scenario`, `observe_web_execution`), before and after, for the hits by part and the deaths.
4. A question none of these settles goes to the owner with what was tried, not into the code as a guess.

### 2.6 Checks

- **Node**: each hull’s box against its render cut’s (2 %); a bolt through the X-wing’s S-foil gap misses and one on the wing hits; one at a Star Destroyer’s wing edge hits; contact pushes a fighter out of a hull and out of another fighter; the ram rule’s angle and glance; every number in `damage.json` has its `_source`; every roster kind has a hull; the wars’ guard of §2.4.
- **In a browser**: `scripts/galaxy-war-check.mjs` at `QUALITY=mid` and `high`, its shots and a log of the hits by part; REA’s recordings of §2.5 before and after.
- **Speed**: P0’s probe (`scripts/perf-probe.mjs`) on `/galaxy` with a war on, at mid: the hull and contact queries under 0.5 ms a frame with 32 fighters a side, the frame no slower than before past the noise.
- The four checks of `CLAUDE.md` before the pull request.

## 3. What stands

- **`CREDITS.md` is not changed** (the owner’s word, 2026-10-14), though the export’s credits sit behind it.
- **The D drive keeps 20 GB free whatever is done** (the owner’s word, 2026-10-14: the engine’s code is being unpacked there). Nothing in this design writes to D: fetched sources go to `lab/assets/bf2017/` on C, Ghidra runs on projects already on D, read-only, and any new copy of a project goes to C’s scratch.
- Keys never printed or committed; `.env.local` holds what the scripts need.
- Binaries derived from the game are published by hash, never committed.
- No new library without its `docs/stack/` page (none is planned).
- The era rule, British spelling, curly quotes, `_source` on every number.

## 4. Not this page’s

- Every ship at the game’s full detail on mid and above (the game’s LOD chain at its own distances, the war’s far copies textured, the kit’s hull for the player): the second project’s design.
- Starfighter Assault, rebuilt separately.
- The universe map’s battles (Rick and Morty’s and Breaking Bad’s wars) and the Death Star’s trench run: they keep their spheres.

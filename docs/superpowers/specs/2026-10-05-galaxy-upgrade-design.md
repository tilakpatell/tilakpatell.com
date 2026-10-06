# The galaxy, upgraded: performance, spectacle, assets, and three new things to do

Design for a broad pass over the Star Wars galaxy (`/galaxy`, `src/components/galaxy/`) and its worlds (`/galaxy/:id/surface`, `src/components/galaxy/surface/`). Approved in conversation on 2026-10-05: all four phases, all three headline features, assets from whichever source gives the better result, and build straight after the spec and plans are written.

## What the user asked for

"Make the Star Wars galaxy even better and make it amazing: get more assets, improve performance and features", using the repo's skills (superpowers and the three.js set). Success:

- It runs measurably lighter. Draw calls, triangles and wasted passes go down, on the same views, with the numbers to show it.
- It looks much better in active play. Ships glow and burn and break up, skies are rich, suns flare, battles read as battles, and empty systems aren't empty.
- There's more in it: new ships, more of the models already downloaded put to use, and fuller worlds.
- There are new things to do: a third playable mission (Geonosis), capital-ship takedowns in the big battles, and a cinematic camera.

## Rules carried over (from `docs/superpowers/HANDOFF-galaxy-surfaces.md`)

- No sequel trilogy (Episodes 7–9) anywhere. After Episode 6, only The Mandalorian and Ahsoka.
- Don't edit the ship-customisation session's files: `universe/shipModels.js`, `hulls.js`, `livery.js`, `modules.js`, `outfit.js`, `paint.js`, `Hangar.jsx`. Don't swap `xwing-hd.glb` or `falcon-hd.glb`, and keep `/models/universe/falcon.glb`.
- Never print or commit `SKETCHFAB_API_TOKEN`, `MESHY_API_KEY` or `MESHY_KEY`.
- Every third-party model is credited in `src/data/modelCredits.json`; its test requires the file to exist and the page to show its credit.
- Rules are pure and tested (Vitest, in Node); drawing is apart from them.
- The site never calls an asset service at runtime: everything is generated ahead of time and committed.
- Commits end with the session's `Co-Authored-By` and `Claude-Session` lines.

## Asset sourcing

This environment's network policy refuses `api.sketchfab.com`, `api.meshy.ai` and Poly Haven, though the keys are set. GitHub raw and npm are reachable. The user's call is to use whichever source gives the better result per asset. Until those hosts are allowed, that means:

- **Code-built**, in the house style (`universe/trafficKit.js`: lofts, lathes, plates, panel textures, glow and metal materials, one merged mesh per material).
- **Unused models already in the repo**, put to use.
- **LOD versions made offline** from the committed GLBs.

If the network opens later, the hero ships and figures (Luke, Mando, the Ghost) can be swapped for Sketchfab models with `scripts/sketchfab-galaxy.mjs` and `scripts/sketchfab-surface.mjs`, which already exist.

## Baseline (measured)

`scripts/galaxy-check.mjs`, 1280×720, `?quality=high`, X-wing unless noted, headless Chromium (SwiftShader), one full frame's counts including every pass. The page's clock is held at one moment and its random numbers seeded, so a view is the same frame every run (the original code, measured from a worktree at the design commit). Frame times under SwiftShader aren't meaningful; the counts are.

| Space | Calls | Triangles | Geometries | Textures |
| --- | --- | --- | --- | --- |
| Tatooine | 54 | 189,737 | 61 | 48 |
| Tatooine (Falcon) | 76 | 245,422 | 52 | 59 |
| Hoth | 86 | 270,080 | 63 | 47 |
| Endor | 62 | 235,518 | 94 | 55 |
| Endor (Falcon) | 144 | 443,308 | 100 | 73 |
| Coruscant | 46 | 180,598 | 42 | 22 |
| Geonosis | 53 | 422,682 | 49 | 24 |
| Scarif | 52 | 196,608 | 53 | 35 |

| Surface | Calls | Triangles | Geometries | Textures |
| --- | --- | --- | --- | --- |
| Tatooine | 438 | 1,086,424 | 334 | 80 |
| Hoth | 291 | 1,088,769 | 137 | 73 |
| Endor | 120 | 2,176,793 | 67 | 30 |
| Naboo | 376 | 838,004 | 346 | 30 |
| Kamino | 84 | 630,274 | 62 | 38 |
| Bespin | 199 | 386,118 | 136 | 36 |
| Lothal | 48 | 516,266 | 23 | 48 |

The render budget from `threejs-aaa-graphics-builder/references/technical-art.md` (desktop): 300 calls, 750k triangles, 300 geometries, 60 textures. Several worlds are over it on triangles, the Falcon doubles the frame (its glass's transmission pass draws everything twice), and the space battles pay for things they don't need (below).

## Phase 1: performance and fixes

Every change here is measured before and after with `scripts/galaxy-check.mjs`, on the same views.

### Space (`galaxy/scene.js` and what it uses)

1. **No double multisampling.** The canvas is created with `antialias: false`, as the universe map's is: the composer's target already multisamples. This applies to the galaxy and the surface.
2. **No transmission pre-pass.** `falcon-hd.glb` carries `KHR_materials_transmission`, so three.js re-renders every opaque object each frame. When the player's HD model loads in the galaxy or on a surface, `dropTransmission(root)` (new, `src/lib/three/glass.js`) turns transmission into plain transparent glass (opacity 0.35, `depthWrite` off). This is our code; the hangar's files are untouched.
3. **The sky, baked.**
   - On entering a system, `sky.js` renders its band, dust lanes, core and nebulae once into a cube render target: 1024² a face on high, 512² otherwise, RGBA8 in sRGB, mipmapped.
   - The sky sphere then just looks the cube up, with a touch of dither against banding.
   - Because the shader now runs once per system instead of every pixel of every frame, it gets richer: domain-warped seven-octave noise, three nebula clouds with emission colours and dark dust in front, and a fine star-cloud glow along the band.
   - The point stars, the suns and the other systems' beacons stay live.
4. **Planet detail follows the frame rate.** `buildBody` gets `setDetail(k)` (k from 0 to 1), which maps to `uMaxOct` between 4 and the body's maximum. The scene feeds it `post.sharpness`, so the noise octaves drop with the resolution when frames run late.
5. **A lighter fallback.** `lowerQuality()` (called when the watchdog gives up) calls a new `post.lite()`: bloom off, the grade pass kept, so there's no clipping and no loss of tone mapping. It also caps planet detail at 4 octaves. `post.off()` stays for when there's no post at all.
6. **Fighter and capital-ship LODs, made offline.**
   - A new `scripts/galaxy-lod.mjs` reads each GLB in `galaxy/models.js`'s `MODELS`. It bakes base colour (factor × texture at each vertex's UV) and emissive into vertex colours, merges every primitive into one, and simplifies to 1,500 triangles for a fighter or 4,000 for a capital ship. It writes `public/models/galaxy/lod/<kind>.glb`, quantized and meshopt-compressed.
   - At runtime, a slot with no tint holds a `THREE.LOD`: the full model near, the LOD past 45 × its size, and nothing past 900 × its size.
   - Distant fighters cost one draw instead of up to 19. Past the cut-off, the engine glow (Phase 2) keeps them visible as a glint.
7. **One parse per file.** A shared `loadGLTF(url)` (new, `src/lib/three/gltfCache.js`) fetches and parses each URL once. `galaxy/models.js`, `universe/glbFleet.js` and `universe/planets.js`'s `loadModel` use it, and each takes a deep clone: materials cloned, textures shared. The Star Destroyer is no longer parsed and uploaded twice.
8. **Only what's needed.** The Death Star GLB loads only in a system with a Death Star piece.
9. **Stand-ins for kinds with none.** `venator`, `slave1` and `falcon` fly a code-built stand-in until they load: no more invisible hulls to crash into. Phase 3 replaces these with proper code-built versions.
10. **No first-shot hitch.** The instanced bolts and flashes are created with `instanceColor` already set, so the variant compiled during warm-up is the one that's used.
11. **Smooth jumps.**
    - When a jump starts, the destination's GLBs start loading and its code-built templates are built in idle slices.
    - In the tunnel, `enter(sys)` builds the world. The sky bake and environment map come a frame later, from a new `dress(sys)`, so no single frame does it all.
    - A DEV-only `longest` field in `window.__galaxy()` records the longest frame of the last jump.
12. **Rocks tumble on the GPU.** Each rock instance carries its spin axis and rate, and the vertex shader turns it by `uTime`. Instance matrices are written once, not every frame. Small rocks (the smallest half by size) get their own bucket with an icosahedron one subdivision coarser; the 1,280-face shape is kept for the big rocks the ship can hit.
13. **No per-frame garbage** in the hot paths named in the exploration: `scene.js`'s camera and jump code, `world.js`'s chase pairs, `fx.js`'s flashes, `space.js`'s goals, and `systems.js`'s `starAhead`, which reads the cached beacon directions.
14. **Point sizes** (stars, beacons, skylanes) follow the renderer's live pixel ratio, not `window.devicePixelRatio`.

### Surface (`galaxy/surface/scene.js` and what it uses)

1. `antialias: false` on the canvas (as in space).
2. `lowerQuality()` is implemented: shadows off (the sun's `castShadow` off) and `post.lite()`.
3. **Lamps only indoors.** The four zone point lights are `visible` only inside a zone. Warm-up compiles both light layouts, so going through a door doesn't stall.
4. **Shadows.**
   - The sun's shadow camera follows the player snapped to its texels, so there's no shimmer.
   - The sun casts no shadow inside a zone.
   - The scattered meshes no longer cast shadows themselves. A near caster per scatter part (an `InstancedMesh` holding only the instances within 48 m of the player, refreshed after every 8 m walked) casts them. Its material writes neither colour nor depth in the main pass, so it shows only in the shadow map.
5. **Zones.** Inside a zone, the outdoor world (ground, water, scatter, things, life) is hidden. Outside, every zone's group and its people are hidden.
6. **Built props share.** `placer.put` for a code-built kind builds each kind-and-options combination once and clones it, sharing geometry and materials, instead of rebuilding it per placement.
7. **Figures share materials** through one cache for the page, keyed by colour and options. People are hidden, and their mixers skipped, past the distance where the fog is 97% thick. Mixers more than 60 m away update at a quarter rate on every tier.
8. **Crew models parse once.** `footScene.loadPartyFigure` caches the parsed GLB by URL and clones it per figure with SkeletonUtils.
9. **`heightAt` outside the terrain square** returns the clamped edge height instead of evaluating the noise stack, so the zones at z = −4200 are cheap.
10. **Garbage and DOM.**
    - `walker`'s `solids.near` reuses one Set.
    - `quests.feed` returns the same object when nothing changed.
    - `actors` hoists its avoider closure.
    - The compass writes styles only when they change.
    - Footprints upload the marks texture at most four times a second.
11. **Flyover ships are warmed at load**, so the first one doesn't compile shaders mid-flight.
12. **`activity.clearStep` disposes** the geometry and materials of what it made.

### Bugs to fix

- **The planet crash shockwave never plays.** `buildBody` returns its `surface` mesh, which `scene.js` passes to `crashFx.hit`.
- **Every hit restarted the one shared crash effect,** cutting off the explosion in progress. Small hits use `flashes`; `pops` is kept for kills.
- **Bespin: falling off a walkway leaves you on air at −40.** With `noGround`, the ground is at `fall − 1`, so the fall check (`y < fall`) catches it.
- **Three quests can't start** (Dagobah's cave, Geonosis's foundry, Mandalore's reclaim). An actor's `quest` may be a list; talking to them offers the first one not yet done.
- **Coruscant's training quest is spawned over the void.** Its master, remotes and the villager's path are moved onto the temple's floors, and `sites.test.js` gains a check that every spot on a `fall` world is over a floor or solid ground.
- **Enemy bolts tunnel through you.** The hit test sweeps the segment the bolt moved this frame against the target's sphere.
- **Respawn ignores the step's `level`.** `putAt` respects it, so the rancor pit's respawn lands in the pit.
- **GLB kinds drop their placement scale.** `opts.s` scales a GLB thing, and a `style` the GLB can't show uses the built version.
- The flyover interval uses each flyover's own `every`.
- The speeder hum plays only on speeders.
- Hovering actors keep their height off floor edges.

### Phase 1 targets (high tier, the same views as the baseline)

| View | Calls | Triangles |
| --- | --- | --- |
| Space, Endor | ≤ 55 (from 62) | ≤ 170k (from 236k) |
| Space, Endor (Falcon) | ≤ 75 (from 144) | ≤ 250k (from 443k) |
| Space, Geonosis | — | ≤ 300k (from 423k) |
| Surface, Tatooine | ≤ 250 (from 438) | ≤ 650k (from 1.09M) |
| Surface, Endor | — | ≤ 1.0M (from 2.18M) |
| Surface, Naboo | ≤ 220 (from 376) | — |

On every view: no new console errors, and screenshots showing nothing lost.

## Phase 2: space spectacle

1. **Engine glows on every ship.**
   - A new `engines.js` maps each kind to its engines in model space: `[x, y, z, r, colour]`. Ion blue-white for the Empire and the Republic's capital ships, red-orange for the Rebellion's fighters, and so on. Kinds without an entry get one guessed from the stern face of their box.
   - All glows in a system are one `InstancedMesh` of camera-facing additive quads. Each has a minimum size on screen, so a far ship is still a glint. They flicker, and brighten with the ship's speed where it has one.
   - Fighters within 40 units get a short trail, pooled, at most 12, using `universe/trail.js`.
2. **Destruction.** A new `explosions.js`, pooled and drawn once per kind of part:
   - a noise fireball billboard that swells and cools from white through orange to smoke;
   - 24 instanced debris shards per blast, spinning and drifting, tinted to the hull;
   - sparks, and a thin shockwave ring for big blasts.

   A battle fighter that's hit explodes instead of vanishing (then comes back as now), and so do hunters. Capital ships under fire take hull flashes, and now and then a fire that burns for a few seconds where they were hit.
3. **Sun flares.**
   - A new `flare.js`: canvas-made textures (a halo, hex ghosts, a streak) on screen-space quads along the line from the sun through the middle of the screen.
   - They fade when the sun is behind a planet, a moon or a hull, by an analytic ray test against the system's solids. No GPU readback.
   - The flare is skipped on low tier.
4. **Geonosis's ring has dust.** An annulus under the rocks with a banded, noisy, sun-lit dust shader (forward scattering), additive, not writing depth.
5. **Traffic.**
   - Each system's `traffic` list (in `systems.js`, unread until now) becomes a new piece: 3–8 civilian ships on lanes from the system's edge to orbit and back, timed by the wall clock like everything else.
   - They jump out at the edge (a stretch and a flash) and in again later.
   - In battle systems, a reinforcement now and then drops out of hyperspace.

## Phase 3: assets and content

### Space ships, code-built in the house style

New file `fleetNewRepublic.js`, plus additions to `fleetExtras.js`:

- **The Ghost** (VCX-100): a broad flat saucer with the cockpit forward on the right, two big engines astern, a dorsal turret, and green-grey paint with Hera's markings.
- **Ahsoka's T-6 shuttle:** a central pod in a ring wing that turns, white with an orange trim.
- **Moff Gideon's Imperial light cruiser:** a long dark wedge with a raised bridge, and a slanted hangar mouth under the bow.
- **Slave I:** the upright ellipse, cockpit to one side, two engines low, faded green and red. It replaces the Phase 1 stand-in.
- **A Venator:** a red-striped arrowhead with two bridge towers. It replaces the Phase 1 stand-in.

### Systems that were empty or thin

- **Dagobah:** Luke's X-wing coming down into the mists, a mist shell over the planet, and a soft green-grey sky.
- **Mandalore:** two of Gideon's light cruisers trading fire with the Mandalorians' Gauntlets, and his TIE interceptors.
- **Lothal:** the Ghost and the T-6 in orbit with the New Republic's X-wings, and a shuttle coming down.
- **Sorgan:** freighter traffic, and the Razor Crest coming in as well as going.

### The worlds' unused models, put to use

- **Tatooine:**
  - The sail barge floats over the Dune Sea by the Sarlacc, bobbing, with the skiff beside the pit.
  - The gonk droid wanders Mos Eisley.
  - Salacious Crumb is at Jabba's side.
  - The dejarik table is in the cantina.
- **Nevarro:** the mudhorn fight. Kuiil is there ("I have spoken"), and the mudhorn charges on a melee spawn: survive it and shoot it down.
- **Lothal:** Ahsoka's figure gives the quests.
- **Kept out:** the podracer stays out (it belongs to Mos Espa, which isn't a site), and so does `jabba.glb` (the crew `hutt` is used).

### Fuller ground

- **Sorgan:** trees, reeds and the pond as water.
- **Lothal:** tall grass and rock spires.
- **Mandalore:** glassed shards and rubble.
- **Nevarro:** lava rock and rubble.

### Two new interiors (zones, the Tatooine pattern: `props/inside.js` builders and `zones` in the site)

- **Echo Base's hangar on Hoth:** ice walls, snowspeeders being fitted, the shield doors. The quest: "Get the snowspeeders flying", fetching a part and talking to the deck officer.
- **Yoda's hut on Dagobah:** low and round, with the cooking pot and the root-lamp. The quest: "Rootleaf stew", gathering three roots in the swamp.

## Phase 4: new things to do

### 1. Seismic Charges: the Geonosis mission, playable

- **Route and wiring.** `/galaxy/geonosis/play`, the Galaxy page with `mission="seismic"`. `systems.js`'s Geonosis mission becomes `status: 'live'` with that `to`.
- **Rules,** in `missions/seismic.js` (pure, tested).
  - **Jango's route:** Slave I flies a spline through gaps in the ring. The gaps are picked from the ring's rock solids by the same seed, and rocks within 4 units of the route are left out, so the tunnel is clear.
  - **Charges:** he drops one every 6–9 s while you're within 60 units and in his rear cone. A charge drifts, arms for 1.6 s, then detonates. Its ring grows to 18 units over 0.8 s and does 35 damage to anything within its band as it passes. Rocks it crosses shatter.
  - **Stage 1, the chase:** stay within 120 units of him, and get hit no more than your shields allow.
  - **Stage 2, the hide:** after three charges dodged, or 70 s in, he turns to hunt you. Within 8 s, stop (speed under 2) within 10 units of a big rock with it between you and him, and hold for 5 s. He gives you up.
  - **Stage 3, his tail:** he flies on. Get within 20 units behind him, in his rear cone, for 3 s, and you win.
  - **Losing:** you lose if your shields go, or if you're more than 120 units off him for 12 s.
- **Scene glue,** in `missions/seismicScene.js`:
  - Slave I's slot, and the charge (a dark sphere with a blinking light).
  - The blast: a thin expanding blue ring with a bright fresnel edge, screen shake, and silence then the deep "bwaam", synthesised with WebAudio in the style of `lib/sfx.js`.
  - Shattered rocks hide their instance and throw debris (Phase 2).
- **HUD:** the objective and stage, a meter for distance to Slave I, and the hide timer.
- **Debrief:** the time, charges dodged and hits taken, with "Fly it again" and "Back to Geonosis".
- **Achievement:** "Seismic" in `Achievements.jsx`.

### 2. Capital-ship takedowns

- **Where.** In the battle systems (Endor, Coruscant, Scarif, Kashyyyk), the capital ships of the side `hunted.js` makes hostile carry subsystems at anchors per kind, in model space.
  - Star Destroyer and Executor: two shield-generator domes and the bridge.
  - Separatist ships (Munificent, Lucrehulk): the bridge and two reactor vents.
- **Targeting.** Subsystems are lockable targets alongside hunters (`T`/`Q` cycle them, and the lock shows their health).
- **Damage.** Blaster 1, spread 0.5 a shot, heavy ordnance 8. The domes have 30 each and the bridge 40. Until the domes are down, shots on the bridge flash off a shield bubble.
- **Destruction,** a state machine in `takedown.js` (pure, tested): shields → exposed → dying → gone → reinforced.
  - Dying lasts 12 s: chained explosions along the hull, a list, a burning drift, and its solids go.
  - It stays gone for 90 s, then a fresh one drops out of hyperspace where it was.
- **Online.** Takedowns are each pilot's own, as the battles' hits already are. This is documented in the code.
- **Achievement:** "Fleet breaker".

### 3. The cinematic camera

- **Controls.** `C` (or the HUD's camera button) toggles it. Esc, `C` or any flying key ends it.
- **Shots.** `cinema.js` (pure, tested) picks a shot every 7–10 s from the system's subjects (the planet and suns, capital ships, fighter pairs, the stations): an establishing wide shot, a flyby from a point ahead of a moving ship as it passes, a slow orbit round a capital ship, a chase behind a fighter pair, and a planet-rise. It never cuts to the same subject twice in a row.
- **Presentation.** Letterbox bars; the HUD, the panel and the help hidden; cuts through a short fade.
- **Your ship** keeps cruising on autopilot, with the guns off.

## Testing and evidence

- **Pure modules,** tested in Node with Vitest:
  - `missions/seismic.js` (route clear of rocks, charge timing and damage band, the stages, win and lose);
  - `takedown.js` (damage, shield gating, the timeline, reinforcement);
  - `cinema.js` (shot choice, no repeats, the subjects framed);
  - `engines.js` (every kind has engines, inside its box);
  - the LOD file list (every LOD exists, is small and has one primitive);
  - `sites.test.js` (spots on floors; givers' quests startable);
  - the walker's swept bolt hit.
- **Per phase:** `npx eslint .`, `npx vitest run` (the heavy autopilot tests may be run alone), `npx vite build`, and `scripts/galaxy-check.mjs` on the baseline's views (counts and screenshots, before and after).
- **Final evidence** goes in `docs/superpowers/evidence/2026-10-05-galaxy-upgrade.md`: before and after counts, screenshots, and the 10-category visual scorecard before and after.

## Out of scope

- Shared online state for takedowns and the mission. They work alone, online pilots still see each other, and the protocol is unchanged.
- The surface vehicle engine and the Hoth snowspeeder battle from `2026-10-05-galaxy-games-design.md`: still the next mission after this.
- Real Sketchfab or Meshy models while the network policy blocks those hosts.

## Plans

One implementation plan per phase, each written and committed before that phase is built: `docs/superpowers/plans/2026-10-05-galaxy-upgrade-phase-N.md`. Later phases build on what the earlier ones made (the LOD, explosions and engine systems), so each plan is written when its phase starts, against the code as it then is.

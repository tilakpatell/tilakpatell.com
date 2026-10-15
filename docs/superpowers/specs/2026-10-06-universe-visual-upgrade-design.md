# The universe map, lit by its sun: a visual upgrade of the engine, the planets and the models — design

Date: 2026-10-06. Status: approved by the owner’s brief (autonomous session; the owner asked for the architecture, a merged PR, and a hand-off to an implementing session). The plan is `docs/superpowers/plans/2026-10-06-universe-visual-upgrade.md`; the hand-off is `docs/superpowers/HANDOFF-universe.md`.

## The brief

> Architect robust visual improvements to the game engine and the planets, and how we can improve the various models and styles of the game.

“The game engine” here is what every flight on the site draws through: `src/components/universe/post.js` (the HDR target, the bloom, the final grade; the galaxy and its surfaces draw through the same file), the scene’s lighting in `universe/scene.js`, and the shared pieces in `src/lib/three/`. “The planets” are the fandoms’ worlds on the universe map (`universe/planets.js` and the bakers in `scripts/planets/`), and the same worlds from the ground (`universe/landings/`). “The models and styles” are the hero ships, the traffic, the rocks and the stations, and the look each fandom’s planet wears.

The galaxy’s own planets (`galaxy/bodies.js`) and the galaxy’s surfaces are other lanes (`2026-10-06-planets-overhaul-design.md`, `2026-10-05-galaxy-upgrade-design.md`). This design borrows from them and gives back to them through `src/lib/three/`, and touches nothing under `galaxy/surface/`. Moving the universe map onto the world runtime is the runtime lane’s (`HANDOFF-runtime.md`); nothing here depends on it, and nothing here makes it harder: every change keeps `scene.js`’s `create(canvas, ctx)` shape.

## Where things stand

Read from the code and the screenshots in `docs/readme/` (`hero.webp`, `universe.webp`, `home-system.webp`, `planet-*.webp`, `red-giant.webp`, `nebula.webp`, `gate.webp`, `hangar.webp`), scored on the ten categories of `.claude/skills/threejs-aaa-graphics-builder/references/visual-scorecard.md` (0 placeholder, 1 basic, 2 premium, 3 showcase):

| Category | Now | Evidence |
| --- | --- | --- |
| Art direction | 2 | Each fandom’s planet is its own world (Tolkien’s map, New Mexico, the Caribbean, a crumpled letterhead); the wonders are named like a star chart. The styles are not yet carried into the lighting: every planet is lit the same way from the same corner. |
| Hero (the ship) | 1.5 | The Falcon and the X-wing are good models (`xwing-hd.glb`, `falcon-hd.glb`), but on screen they read as a grey-brown mass: no rim, a muddy specular, lit from a fixed corner whatever star is near. In every screenshot the hero is the dullest thing in frame. |
| Enemies and traffic | 2 | Authored code-built ships with panel textures, glows and blinkers. Far off they vanish rather than glint. |
| Rewards and interactables | 2 | Signs, beacons, the pulse ring on arrival, the nav diamond. |
| World | 2 | Deep space is rich (the Maw, the giants, the nebulae, the suns). The home system’s belt and the rim are flat-shaded lumps in one tone each (`home-system.webp`, `hero.webp`): the one place the map looks like a prototype. |
| Materials | 1.5 | The planets have colour, normal, roughness, night and cloud maps, but the air round them is a flat tinted rim (`halo`, `airGlow`), the clouds cast nothing, and up close the map is a blur. The ships’ GLB materials are used as exported. |
| Lighting and render | 2 | HDR, a careful tone shoulder, bloom, a vignette, the lens round the Maw. The sky’s dark gradients band (8-bit output with no dither); the bloom is drawn at a fixed 256 × 256 so it blocks on a wide screen; the sun has no glare in the lens; the exposure never moves. |
| VFX | 2 | Boost streaks, plumes, bolts, the crash shockwave, the fall into the Maw. A hunter shot down pops; nothing burns. |
| HUD | 2.5 | Not in scope. |
| Performance evidence | 2 | `lib/three/pace` steps the picture down, `post.lite()` and `off()`, tiers from `lib/device`. No fixed poses to measure against, so no before-and-after numbers. |

Average about 1.95. The automatic failures in the scorecard do not apply (the hero is a real model, the world is authored), but the hero and the materials hold it under premium. The weakest surfaces, in the order a visitor meets them: the ship (always on screen), the air round the planets (the first thing a planet shows as you come in), the belt (the home system’s whole middle ground), the sun with no glare, and C-137’s planet, whose cel style reads as a noise texture (`planet-rick-and-morty.webp`).

Two things in the lighting are wrong rather than weak:

1. **The planets are not lit by the sun.** `planets.js`’s `LIGHT`, `post.js`’s `LIGHT` and the scene’s key light are one fixed direction, upper left. The home sun is a point light with a reach of 320 units; the fandoms’ planets are hundreds of units out. So a planet’s day side faces the same corner of the screen whichever side of the sun it is on, and the sun lights nothing but the stations. Deep space’s wonders (`deepspace.js`) already light themselves from their own stars, so the map is inconsistent with itself.
2. **The air is a rim, not air.** The halo is the back of a bigger sphere fading from the limb, and the surface rim is a Fresnel term in the emissive. Neither knows the sun: the limb is as bright on the night side as the day side bar a smoothstep. The galaxy’s planets (`galaxy/bodyShaders.js`’s shell) already march a single-scatter atmosphere with a sunset band. The two should be one.

## Goals

1. **One light.** Everything near a star is lit by that star: the planets’ terminators face the home sun, the ship and the traffic take the colour and direction of the nearest star, and the air round a planet is bright toward the sun and warm at the terminator.
2. **Every planet reads as a world with air**, from the overview to the last radius before landing: scattering at the limb, clouds that shadow the ground, seas that catch the sun, and fine ground that comes up as the ship comes in.
3. **The hero ship is the best-lit thing on screen**: key, fill and rim from the scene’s stars, a specular that reads as metal and paint, engines that glow with the throttle.
4. **The styles are in the light, not only the map.** C-137 is cel-shaded in the show’s way; Dot Matrix is dithered in four greens; the paper world is lit as paper. The planets differ in how light lands on them, not only in what is painted on them.
5. **The render looks finished**: no banding in the dark, bloom that follows the screen, a sun that glares into the lens and is hidden by what passes in front of it, an exposure that eases as you turn from the sun into the dark.
6. **The belt and the rim are rock**, with relief, variation and the sun on one side.
7. **Cheaper or the same.** Every checkpoint reports draw calls, triangles and frame time at fixed poses on each tier, against a baseline taken first. Nothing new runs on `low` that was not there before, and every new effect names the `pace` step it drops out at.
8. **Shared where the galaxy wants it too.** The atmosphere, the flare, the rock shader, the engine glows and the grade go in `src/lib/three/` or `universe/` modules the galaxy can import, so the two spaces converge rather than fork.

## Non-goals

- No new gameplay, no HUD changes, no new sounds.
- No new downloaded textures for the planets beyond the missing `-hq` normal sets the bakers already know how to make. A new map earns its bytes (the standing rules).
- Not the galaxy’s surfaces, not Earth’s page, not the landings’ props. The landings get only their sky (goal 2 from the ground).
- Not WebGPU or TSL. `post.js` stays an `EffectComposer`; the universe map stays `shading: 'glsl'`.
- No sequel-trilogy content.

## Constraints (the standing rules that bite here)

- Every scene starts from `lib/device`’s tier and lowers itself under `lib/three/pace`. A new pass or shader says which tier it runs on and at which pace step it goes.
- Textures: WebP, 2K at most on desktop with a `-sm` copy, mipmapped, anisotropy from the tier, sRGB on colour maps only.
- Pure logic in tested modules apart from the drawing: the light picker, the exposure estimate, the flare occlusion, the day-side approach are plain numbers with tests.
- British spelling, curly quotes, plain sentences; comments say why.
- No runtime calls to asset services; nothing generated at runtime that a script could bake.
- Don’t touch the ship-customisation files’ interfaces (`shipModels.js`, `hulls.js`, `livery.js`, `modules.js`, `outfit.js`, `paint.js`, `Hangar.jsx`): the hero-ship work hooks in through `livery.js`’s existing `onBeforeCompile` and `lib/three/gltf.js`’s `prepare`, and leaves the paint jobs as they are.
- New shader variants are compiled before their first frame (`scene.js`’s `warm` and `precompile`): a new effect that compiles on first use is a stall, and a bug.

## Architecture

Eight checkpoints, each a PR merged on its own, in the order of visible gain per unit of cost. Each ends with before-and-after screenshots at fixed poses and renderer counts on `high`, `mid` and `low`. The first makes the poses and the baseline the others measure against.

### Checkpoint 0: poses and a baseline (`scripts/universe-check.mjs`)

A fixed set of named camera poses, read by a DEV hook, so every later picture is of the same thing:

- `pose('overview')`: the home system from the opening overview.
- `pose('falcon-sun')`: the ship a few lengths from the camera with the home sun behind it, three-quarter.
- `pose('middleearth-limb')`: Middle-earth filling two thirds of the frame, the terminator across it.
- `pose('rickmorty')`, `pose('gaming')`, `pose('caribbean')`: each planet filling half the frame, day side toward the camera.
- `pose('belt')`: in the belt, rocks within a few units.
- `pose('maw')`: as `hero.webp`.
- `pose('landing-middleearth')`: on foot, the sky at noon.

`window.__universe().pose(name)` (DEV only, in `scene.js`) places the camera and the ship and holds the map still. `scripts/universe-check.mjs` opens `/universe` in headless Chromium at `?quality=high|mid|low`, takes each pose at 1280 × 720, reads `renderer.info.render` (calls, triangles) and the mean of twenty frame times, and writes `lab/universe/<tier>/<pose>.webp` and `lab/universe/<tier>.json`. `lab/` is ignored by git except a committed `lab/universe/baseline/` from `main` before checkpoint 1. The AAA skill’s canvas inspector (`.claude/skills/threejs-qa-release/scripts/inspect-threejs-canvas.mjs`) is run on the same shots for `colorEntropyBits`, `edgeDensity` and `luminance.contrast`.

Software WebGL in the container runs at a few frames a second, so frame times there only compare against each other; the owner’s machine gives the real numbers. Both are recorded.

### Checkpoint 1: the render, finished (`post.js`, `lib/three/flare.js`)

All in the shared `post.js`, so the galaxy and its surfaces get it for nothing.

1. **Dither.** The final pass adds a blue-noise dither (a 64 × 64 tiling blue-noise texture painted once in code: `lib/three/noise.js`’s `blueNoise(size)`, a void-and-cluster generation seeded, tested for its spectrum being flat above its lowest octave) of ±0.5 of a step before the 8-bit quantisation. Film grain rides the same lookup: `uGrain` 0.025 at rest, 0.05 in the boost rush, 0 under `prefers-reduced-motion`. The grain is in luminance only and never past the tone shoulder.
2. **Bloom that follows the screen.** `UnrealBloomPass`’s resolution becomes half the post target’s size, capped at 640 on its long side, set again on every `resize` and sharpness change. Its strength stays 0.8 and threshold 1.7, so nothing new glows; it stops blocking on a 2560-wide screen.
3. **Chromatic aberration at the edges**, in the final pass: three reads of the scene offset along the vector from the centre, by `uAberration` × the vignette’s own falloff. 0.0015 at rest, up to 0.006 in the boost rush and 0.004 for a frame on a hit. Off on `low` (one read, as now).
4. **The sun in the lens** (`lib/three/flare.js`): a flare for any star, as the galaxy’s Phase 2 asked for and never built: canvas-painted sprites (a soft halo, four hexagonal ghosts, a thin horizontal streak, and a six-point starburst) on screen-space quads along the line from the star through the centre, scaled by how far into the frame the star is. `flareWeight(starNdc, occluded, size)` is pure and tested: it rises as the star comes within the frame, falls to nothing by 1.15 of the half-width, and is cut to zero by occlusion. Occlusion is analytic, no readback: a ray from the camera to the star against the scene’s solids (`ship.js`’s solids list; the galaxy has its own), softened over the last tenth of a radius so a planet’s limb dims the flare rather than switching it. The universe map wears one flare for the home sun and one for whichever of Ember, Halcyon, the Twins, the Lantern and the Graveyard is nearest; the galaxy wears its system’s one or two suns. Off on `low`; off at pace step 2.
5. **Exposure that eases.** `exposureFor(sunShare, darkShare, last, dt)` is pure and tested: a target exposure from how much of the frame the nearest star’s disc and glare cover (from its screen size, no readback) and how dark the sky behind is, eased at 0.6 a second up (into the dark) and 2 a second down (into the light), between 0.85 and 1.25. The final pass takes `uExposure` before the shoulder. In deep space the picture lifts a little; turning into the sun it stops down, and the corona reads as a corona.

Order of passes stays: render, overlay, bloom, final. `lite()` keeps dropping the bloom; the flare and the grain survive it; `off()` drops everything as now.

### Checkpoint 2: one light (`universe/lighting.js`, `scene.js`, `planets.js`, `ship.js`, `nav.js`)

A tested module, `universe/lighting.js`, with no drawing in it:

- `STARS`: the home sun and deep space’s stars (from `deep.js`’s `WONDERS`: Ember, Halcyon, the Twins, the Lantern, the Graveyard, the supernova while it burns), each with a position, a colour, a strength and a reach.
- `lightAt(point)` → `{ key: { dir, colour, strength }, fill: { dir, colour, strength }, ambient }`: the nearest star by weight (strength over distance squared, with its reach as a soft cut) as the key, from the star toward the point; the second as a fill where there is one, else a cool fill from the sky’s side; the ambient from the sky colour there (the nebulae tint it, from `deep.js`’s nebula positions). Between stars the blend is by weight, so flying from the home system out to Ember turns the light over slowly, never snaps.
- `sunFor(planet)` → the unit direction from the planet to the star that lights it.

The scene moves its one key and one fill `DirectionalLight` to `lightAt(camera position in the map)` every frame, eased at 2 a second, and sets the ambient’s colour. The sun’s `PointLight` stays for the stations. `post.js`’s `LIGHT` becomes a uniform the scene updates from the same answer. Each planet’s `uSunW` (the air, the night lights, the rim) and its halo’s `uLight` are set once to `sunFor(planet)`; the key light at a planet is that same direction, so the terminator the material draws and the one the air draws agree. The nearest fandom planet to the camera gets the key exactly (its own direction), and planets further off than their reach are too small to show the blend.

Day sides face the sun. The overview poses in `flight.js`’s goals, `ship.js`’s `startAt` and the nav map’s arrival (`nav.js`) each take the planet’s `sunFor` into account: `daySideApproach(at, sunDir, radius, from)` is pure and tested and returns an arrival point on the sunward hemisphere, nearest the direction you came from. Nobody arrives at a black disc.

The traffic’s and the hunters’ materials are lit by the same lights; nothing changes in them. `spaceEnvironment` keeps the Milky Way and adds the nearest star’s glow where the key is (as now) but in that star’s colour.

### Checkpoint 3: air, clouds, seas and ground (`lib/three/atmosphere.js`, `planets.js`)

1. **One atmosphere.** The galaxy’s shell (`bodyShaders.js`’s `SHELL_VERT`, `SHELL_FRAG`: a single-scatter march along the view ray through a sphere of air, with its density, falloff, glow toward the sun and sunset colour) moves to `lib/three/atmosphere.js` as `createAtmosphere({ radius, top, colour, density, falloff, sunset, glow, suns, segments })` → `{ mesh, set({ suns }), dispose }`, unchanged in what it draws. `galaxy/bodies.js` imports it from there (a move, covered by its own tests). `planets.js` replaces `halo()` with it, and `airGlow`’s rim with a thin ground-side term from the same parameters (the haze between the eye and the ground as the view grazes the limb), so the limb is blue-white toward the sun, warm along the terminator, and gone on the night side. Each fandom planet’s air is data in `universes.js` (`air: { colour, density, top, sunset }`): Middle-earth a clear blue, the Caribbean a bright haze, C-137 the show’s lime, Cybertron thin and violet, Dot Matrix none but the pixel clouds, the Office none (paper has no air; it keeps a soft rim), Invincible thick and warm. The shell’s segments and the march’s steps follow the tier (`seg`); the march is 8 steps on `high`, 5 on `mid`, and `low` keeps the old halo (kept as `haloMaterial` in the same file, not deleted).
2. **Cloud shadows.** On a planet with a cloud layer, the ground material samples the cloud map (its alpha or its colour’s luminance) a second time in `onBeforeCompile`, at the uv shifted along the sun’s direction projected onto the sphere and by the cloud layer’s own turn (`uCloudTurn`, set each frame from the layer’s rotation), and darkens the diffuse by up to 0.55 where cloud is. One extra read; off on `low`.
3. **Seas that catch the sun.** With the key light now from the sun, the roughness maps already do this for Middle-earth, Breaking Bad, the Caribbean, the Office and Travel. C-137 and Invincible get a roughness map from their bakers (sea 0.25, land 0.9). The specular is checked at `pose('caribbean')`: a glint, not a white disc (roughness floor 0.22).
4. **Ground that comes up.** Within 3 radii, the ground material blends in a tiling detail layer: a normal and a slight albedo mottle from `lib/texture.js`’s procedural noise (a 512 tile painted once, shared by every planet, tinted by the planet’s own map colour at that pixel), on the pattern of `lib/three/surface.js`’s `detailNormal`: faded in from 3 radii to 1.3, scaled by the planet’s radius so the mottle is a few hundred metres across whatever the planet. Off on `low`.
5. **Missing high sets.** `scripts/build-fandom-planets.mjs` bakes `-hq` normal maps for the Caribbean, Invincible and Cybertron (today only `middleearth`, `office` and `breakingbad` have them), and the C-137 and Invincible roughness maps above. `MAPS` in `planets.js` says so; `planets.test.js`’s file check covers them.

### Checkpoint 4: the styles in the light (`planets.js`, `scripts/planets/rickmorty.mjs`)

1. **C-137, cel-shaded.** The baker is reworked so the map is flat regions with ink: biomes posterised to three tones each, an ink line two texels wide at 2048 along every biome and shape edge (edge-detected on the biome id, not the colour), cartoon craters with a rim highlight and a cast shadow drawn in, the ooze lakes bright flat lime in the glow map. The material quantises its diffuse into three bands in `onBeforeCompile` (`cel(diffuse, n·l)`: 1.0 above 0.55, 0.72 to 0.15, 0.45 below, with a two-texel-wide soft edge so it does not shimmer), keeps the specular off, draws the atmosphere as a flat two-band rim in the show’s lime, and inks its own limb: a dark line where the view grazes the sphere (`pow(1 − n·v, 8)` as a darkening), so the planet is outlined like everything in the show. The clouds are the show’s puffs, as now, but lit with the same two bands.
2. **Dot Matrix, dithered.** The Game Boy world is lit in four greens with an ordered dither: `onBeforeCompile` replaces the diffuse with the palette’s four tones picked by the lit level against a 4 × 4 Bayer threshold in screen pixels scaled by the pixel ratio (so the dots are the same size on every screen), and the clouds and the terminator dither the same way. `magFilter` stays nearest. The air is none; a one-pixel lighter outline at the limb in the lightest green.
3. **The paper world.** The Office keeps its maps; its material becomes `MeshPhysicalMaterial` with `sheen` 0.6 in the paper’s own colour and `sheenRoughness` 0.8, roughness 1, so paper reads as fibre under a grazing light; the crumple normal gets its `-hq` set where it is missing on `ultra`. No air; a soft warm rim.
4. **Cybertron and Invincible** keep their skins; Cybertron’s energon seams take the key light’s colour into their glow, so the planet is warmer by the home sun than by Halcyon.

The three stylised lightings are each a separate `onBeforeCompile` with its own `customProgramCacheKey`, composed after the air’s (the pattern `airGlow` already uses), so a style and the air never fight over the same include.

### Checkpoint 5: the hero ship (`lib/three/gltf.js`’s `tune`, `livery.js`, `shipModels.js`, `universe/engines.js`)

1. **Tuned on load.** The HD Falcon and X-wing and the RV go through `prepare`’s `tune` with a ship profile: roughness clamped to 0.42–0.72 on hull materials (the Falcon’s export is near 1, which is why it reads as clay), metalness 0.65 on materials named for metal, 0.1 on paint; `envMapIntensity` 1.3; anisotropy from the tier (the backlog’s item, done for these files: `shipModels.js`, `hulls.js`, `trafficKit.js`).
2. **A rim from the stars.** `livery.js`’s hook (every hull material already passes through it) adds a rim term: `uRimColour` × `pow(1 − n·v, 3)` × `max(0, n·fillDir)` into the emissive, with the fill’s colour and direction from `lighting.js`, strength 0.35. The ship’s edge away from the key picks up the sky’s cool light, so it stands off the dark. Paint jobs are untouched: the rim is added after the paint reads its texel.
3. **Engines with the throttle.** `universe/engines.js`: for each kind, its engine positions and colour (the Falcon’s blue band, the X-wing’s four pink-white nozzles, the RV’s two jets, the cruiser’s green ring), already known to `shipModels.js` as `FALCON_ENGINES` and `XWING_ENGINES`; one `InstancedMesh` of camera-facing additive quads with a soft core and a hot centre past the bloom threshold, sized by the throttle and the boost, flickering by `uTime`. The traffic and the hunters use the same module (the galaxy’s Phase 2 asked for exactly this: once it is here, its `fleet` can call it): far ships keep a minimum size on screen, so they glint before they resolve.
4. **Measured.** At `pose('falcon-sun')` the ship’s pixels gain contrast (`luminance.contrast` up) and the inspector’s `edgeDensity` on the ship’s crop rises; both are reported.

### Checkpoint 6: rock (`universe/belt.js`, `lib/three/rock.js`)

The belt, the rim, the meteors and deep space’s two rock streams share one material: `lib/three/rock.js`’s `rockMaterial({ tones, tier })`, a `MeshStandardMaterial` with `onBeforeCompile` adding triplanar noise in object space: an albedo mottle between the instance’s two tones (two colours per instance in attributes, as now) with darker pits, a normal tilted by the noise’s gradient (the derivative value noise from `galaxy/bodyShaders.js`’s `NOISE`, moved to `lib/three/noiseGlsl.js` so both import it), and a sharper roughness in the pits. Each instance keeps its own spin. The shapes stay three; a fourth, bigger and cratered, is added for the one rock in forty that is much larger than the rest (the belt reads as a field with a few boulders, not gravel). The instance count does not change. `low` keeps the flat material.

### Checkpoint 7: what burns (`lib/three/explosions.js`, `hunters.js`, `crash.js`)

A hunter shot down, a traffic ship that a skirmish takes, or the ship itself crashing into a planet, explodes rather than pops: `createExplosions({ parent, small })` → `{ burst(at, size, tint), update(dt, t), dispose }`, pooled: a noise fireball billboard that swells and cools from white through orange to smoke over 1.4 s, 24 instanced shards tinted to the hull spinning out and fading, sparks, and a thin shockwave ring for anything bigger than a fighter. One draw per kind of part. `hunters.js` calls it where a hunter dies; `skirmishes.js` where a fight ends a ship; `crash.js` adds it to the shockwave. The galaxy’s `fx.js` can call the same. Off on `low` (the pop stays).

### Checkpoint 8: the sky on foot (`landings/sky.js`)

The landing’s dome takes its colours from the planet’s `air` (checkpoint 3) through the same scattering, evaluated on the dome for the camera at ground level: the zenith and horizon colours come out of the air’s parameters rather than being set by hand, the sun’s disc has the glare of checkpoint 1’s flare (the same module, the same occlusion against the landing’s solids), and the terminator seen from the ground is the same one seen from orbit. Each landing’s `sky` in `landings.js` keeps its overrides for the planets with no air.

## Performance budget

At each pose, on `high` with the standard maps, after each checkpoint:

- Draw calls: no more than the baseline + 6 per checkpoint, and never over 420 at any pose.
- Triangles: no more than the baseline + 5 %.
- Frame time on the owner’s machine: no worse than the baseline at any pose; checkpoint 1’s bloom change should make `pose('overview')` quicker on a wide screen.
- GPU memory: no new texture over 1 MB resident; the blue-noise tile is 16 KB, the detail tile 1 MB at 512, the flare sprites 256 KB.
- `mid` and `low`: the effects table below is honoured; `low`’s counts are unchanged from the baseline apart from the engines (which replace nothing and cost one draw).

| Effect | high | mid | low | drops at pace step |
| --- | --- | --- | --- | --- |
| dither and grain | on | on | on | never (free) |
| bloom at half size | on | on (quarter) | off (as now) | `lite()` as now |
| aberration | on | on | off | 3 |
| flare | on | on | off | 2 |
| exposure | on | on | on | never (a uniform) |
| atmosphere march | 8 steps | 5 | halo | 3 (to the halo) |
| cloud shadows | on | on | off | 3 |
| ground detail | on | on | off | 2 |
| cel, dither, sheen | on | on | on | never |
| rim on the ship | on | on | on | never |
| engines | on | on | on | never |
| rock relief | on | on | off | 3 |
| explosions | on | on | pop | 2 (to the pop) |

## Evidence per checkpoint

Each PR carries: the pose shots before and after on `high` (and `mid` where the checkpoint changes `mid`), the counts table from `scripts/universe-check.mjs`, the inspector’s three metrics for the two poses the checkpoint is about, and the scorecard line it moves, with one sentence of evidence. The hand-off’s status table is updated in the same PR.

## Risks

- **The light turning.** A planet lit from the sun can be dark from where a page link opens it. The day-side approach and the overview poses handle arrivals; the nav map’s pulled-back view is lit from above as now (it is a map, not a place). Checked at every planet’s `/universe/:id` link.
- **Shader variants.** Every new `onBeforeCompile` makes a variant per planet; the warm-up compiles them (`singlePass` over the planets’ group). `precompile.test.js`’s pattern is extended to count the variants the map compiles at start: it must not grow past what the warm-up finishes in four seconds on `mid`.
- **The atmosphere’s cost on phones.** Five steps on `mid` was measured in the galaxy already (its planets march every frame today). If `pose('middleearth-limb')` on `mid` is slower than the baseline, the step count comes down before the halo comes back.
- **Dither on a `preserveDrawingBuffer` screenshot** adds noise to the autopilot’s before-and-after pictures; the check script sets `uGrain` to 0 through the DEV hook before a shot, and keeps the dither (which is the point).
- **The galaxy inherits every `post.js` change.** Checkpoint 1 is checked on `/galaxy/hoth` and `/galaxy/tatooine/surface` as well as `/universe`; `scripts/galaxy-check.mjs` already measures those.

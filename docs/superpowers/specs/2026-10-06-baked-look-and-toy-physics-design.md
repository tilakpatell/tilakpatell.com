# The baked look and toy physics: architecture, with Albuquerque as the example

Date: 2026-10-06. Status: researched and specified for Opus 5.5 to implement; the owner has
not reviewed it (the assumptions it makes are listed under Decisions). The research it rests
on is `docs/research/2026-10-06-bruno-simon-folio.md`; read that first.

## Intent

The owner's ask: "The textures and physics of stuff like bruno-simon.com is so good. Figure
out why, see how ours works, and spec it for Opus."

Why Bruno's folio reads the way it does, in one sentence: nothing is lit, everything is
grounded, and everything that moves is simulated softly. The light is *in* the textures
(matcaps), the shadows are *in* a mask under each area, a shader tints the underside of every
object toward the floor, moving things stand on sun-offset blob shadows, and the car and the
props are rigid bodies in cannon with spongy contacts. This site does the opposite on every
line: 86 directional lights, 220 shadow casters, shadow maps at 9–18 pixels per metre, no
baked light anywhere, no physics engine, a car whose lean is a sine wave.

This spec brings the folio's three mechanisms into the site as shared libraries, in the house
style (one `lib/three` module per idea, pure parts tested, shader hooks by `onBeforeCompile`
chunk swaps, offline scripts that commit their output), and applies all three to one world,
Albuquerque, which is the site's own "drive a car round a diorama".

Not in scope: Blender. The worlds here are built in code (seeded), so bakes are rendered by
the site's own scene modules in headless Chromium, the way `scripts/hq-impostors.mjs`
already photographs trees.

## Principles (the folio's, translated to this site)

1. **Light lives in the texture, not the frame.** A matcap or a mask is rendered once,
   offline, with the world's own rig (sun colour and angle, hemisphere, exposure, tone map),
   then drawn with no lights. The low tier gets the same picture as the high tier.
2. **Ground everything three ways.** A baked floor mask under what never moves; a sun-offset
   blob under what moves; a bounce tint on the lower, downward faces of everything.
3. **Shadows are tinted, never grey.** Each world names a `shade` colour (Albuquerque: the
   sand's deep warm `#9a5f3c` wash, darker); masks, blobs and bounce all use it.
4. **Display-referred means what you author is what you see.** Matcaps and masks are rendered
   through the world's tone map and stored sRGB; the materials that read them are
   `toneMapped: false` (matcaps, `SRGBColorSpace`) or data (`NoColorSpace`, masks). Bloom still
   comes from `hot()` emissives.
5. **Toy physics**: a fixed 60 Hz step with interpolation (the one thing Bruno got wrong),
   contact stiffness 1000 (not cannon's 1e7), restitution 0.3, gravity −13, the player's body
   mass 40 and props at 0.1–1.5 so they fly. Real suspension; no faked lean.
6. **Forgiving controls**: steering that ramps and recentres (`stepSteer` already does this),
   coasting drag, a self-righting car, a reset key.
7. **Sound from impacts**: volume from impact velocity squared, random pitch, variants,
   a throttle per sound.
8. **The camera follows the planar position only**, eased `1 − exp(−k·dt)` (already the
   house rule); the body's bounce and tilt never reach the camera.
9. **Y is up here** (the folio is Z-up): every formula below is written for Y-up, forward +z
   (a heading of 0 faces +z, as `rules.js` has it).

## Architecture

Four new modules, two scripts, one dependency. Each module is only imported by lazily loaded
scene code, so no page without 3D pays for it.

### 1. `src/lib/three/grounding.js`: masks, bounce and blobs

```
floorShadow(material, bake)             → material (chunk swaps; tested on stub shaders)
bounce(material, { color, height, strength, angleOffset }) → material
createBlobShadows({ color, max, sun })  → { mesh, set(i, pos, height, tilt, size, yaw), clear(), dispose() }
blobPlacement(sun, pos, height, tilt, out) (pure, tested)
maskWeights(tod, times) → [channelA, channelB, t] (pure, tested)
```

**`floorShadow(material, bake)`**: the baked masks applied to a lit `MeshStandardMaterial`
(the ground, roads, lots, pads keep their shaders). Two swaps:

- the directional sun's shadow: replace `getDirectionalLightInfo( directionalLight, directLight );`
  in `lights_fragment_begin` (expanded from `THREE.ShaderChunk`, as `surface.js` does) with
  itself plus `directLight.color *= gSun;`, and set `receiveShadow = false` on the mesh, so the
  shadow map no longer touches it;
- the sky and bounce term: replace `#include <aomap_fragment>` with
  `reflectedLight.indirectDiffuse *= gSky;` (exactly what an aoMap does).

where, in the fragment prologue:

```glsl
uniform sampler2D uMask[G_AREAS];      // one per area, RGBA: R dawn, G noon, B golden, A sky
uniform vec4 uMaskRect[G_AREAS];       // x0, z0, 1/w, 1/d
uniform vec3 uMaskMix;                 // channel a, channel b, t  (maskWeights)
uniform vec3 uShade;                   // the world's shadow colour (linear)
float gPick(vec4 m, float c) { return c < 0.5 ? m.r : c < 1.5 ? m.g : c < 2.5 ? m.b : 1.0; }
vec2 gRead(vec3 p) {                   // sun visibility, sky visibility at a world point
  vec2 v = vec2(1.0);
  for (int i = 0; i < G_AREAS; i++) {
    vec2 uv = (p.xz - uMaskRect[i].xy) * uMaskRect[i].zw;
    if (all(greaterThan(uv, vec2(0.0))) && all(lessThan(uv, vec2(1.0)))) {
      vec4 m = texture2D(uMask[i], uv);
      v = vec2(mix(gPick(m, uMaskMix.x), gPick(m, uMaskMix.y), uMaskMix.z), m.a);
    }
  }
  return v;
}
```

and after `#include <clipping_planes_fragment>`: `vec2 gV = gRead(vGroundPos); float gSun = gV.x; float gSky = mix(0.35, 1.0, gV.y);`
(`vGroundPos` is a world-position varying added in the vertex shader, instancing-aware, the
way `surface.js` adds `vAtPos`). The shade colour tints the darkness: in `opaque_fragment`'s
prefix, `outgoingLight = mix(uShade * outgoingLight, outgoingLight, 0.4 + 0.6 * min(gSun, gV.y));`
so a shadowed patch goes warm-dark, not grey. Outside every area both terms are 1.

`bake` is `{ areas: [{ texture, x0, z0, w, d }], times: [{ tod, channel }], shade }`;
`maskWeights(tod, times)` returns the two nearest named times and the blend. A material with
`floorShadow` uses a `customProgramCacheKey` of its area count.

**`bounce(material, opts)`**: Bruno's indirect term, Y-up, on any material (lit or matcap).
After `#include <opaque_fragment>`'s prefix:

```glsl
float bD = pow(clamp(1.0 - (vGroundPos.y - uBounceFloor) / uBounceHeight, 0.0, 1.0), 2.0) * uBounceStrength;
float bA = clamp((dot(normalize(vGroundN), vec3(0.0, -1.0, 0.0)) + uBounceOffset) * 1.5, 0.0, 1.0);
outgoingLight = mix(outgoingLight, uBounceColor, bD * bA);
```

Defaults from the folio: `height 1.75`, `strength 0.5`, `angleOffset 0.6`; `uBounceFloor` is
the ground height under the object (a uniform per material, set from `surfaceHeight` for
static things at build time; movers update it). `color` is the world's ground colour at the
current time (Albuquerque: `L.hemiGround`, updated per frame from `lightAt`).

**`createBlobShadows`**: one `InstancedMesh` of unit planes, one draw for every mover.
Fragment: a rounded rectangle, `fadeRadius 0.35`, sine-in-out falloff, `uShade` colour,
transparent, `depthWrite: false`, `renderOrder 1`, `polygonOffset` so it never z-fights the
ground. Per instance (`blobPlacement`):

```
offset   = (-sun.x / sun.y, -sun.z / sun.y) * height         // slides away from the sun
alpha    = ((3 - height) / 3)^2 clamped, × (1 - tilt)^2        // fades as it rises or tips
position = (pos.x + offset.x, groundY + 0.01, pos.z + offset.y); rotation = yaw
scale    = size × (1 + 0.15 · height)                          // a little wider, higher up
```

`sun` is the world's current sun direction (unit, y > 0.08; below that the blobs fade to the
sky-only term: at night the moon's direction is used with half strength). Instance colour's
red carries alpha (the trick `office/world/ao.js` uses). Everything that gets a blob sets
`castShadow = false`.

### 2. `scripts/bake-floor-shadows.mjs` and the scene's bake mode

A floor mask is the visibility of the sun (per named time) and of the sky at every point of a
world's ground, from the world's own static geometry. It is rendered, not ray traced:

- the world's scene module gains `api.bake({ area, size, times })` (dev only, like `peek`):
  it hides everything that moves (the car, traffic, people, blobs, sprites), points an
  `OrthographicCamera` straight down over `area`, and renders into a float render target of
  `size²` with additive blending, one pass per sample direction:
  - **sun**: for each named time, 48 directions jittered inside a cone of 4° about
    `sunAt(tod)` (the penumbra); a `DirectionalLight` of intensity `1 / 48` with a 4096 shadow
    map whose camera covers the area, every static mesh casting; the ground drawn with a
    white `MeshLambertMaterial` (so the output is `max(0, n·l) · shadow`), divided by `n·l` in a
    final pass so slopes don't darken the mask (slopes are the ground shader's business);
  - **sky**: 64 cosine-weighted directions over the hemisphere, the same way, intensity
    `1 / 64`: this is ambient occlusion from the sky, the term that darkens a wall's foot and the
    gap between two buildings;
  - the four results pack into one RGBA (`R` dawn, `G` noon, `B` golden, `A` sky), 8-bit, and
    `api.bake` returns the pixels as a data URL.
- the script starts `vite` (as `autopilot-check.mjs` does), opens the world at `?quality=low`
  in headless Chromium with the QA localStorage keys, calls `api.bake` per area, and writes
  `public/<world>/shadow/<area>.webp` (lossless WebP; a 2048² RGBA of soft gradients is
  about 0.6–1.2 MB; 1024² about 300 KB) plus `index.json` with each area's rect and the times
  and channels. SwiftShader will take minutes per area; it runs once and the result is
  committed, like every other asset here.
- the runtime reads `index.json`, loads each mask with `loadTexture(url, { color: false,
  mipmaps: false })` (clamped, linear filtering), and passes `{ areas, times, shade }` to
  `floorShadow`. A missing mask (or a `low` tier with Data Saver on) leaves the material as it
  is today: the realtime shadow map, where the tier has one.

### 3. `src/lib/three/matcap.js` and `scripts/matcaps.mjs`: pre-lit materials

```
matcapMaterial({ matcaps, map, color, bounce }) → MeshMatcapMaterial, toneMapped false
setMatcapTime(material, tod)                     → picks the two named times and the mix
```

`scripts/matcaps.mjs` renders a sphere (`SphereGeometry(1, 96, 64)`, `MeshStandardMaterial`
of a named colour, roughness and metalness) under a world's rig at each named time (`lightAt(tod)`
for the sun's colour and direction, the hemisphere, `RoomEnvironment`, the stage's tone
mapping and exposure), with an `OrthographicCamera` looking down −z, into a 256² target,
and writes `public/<world>/matcaps/<name>-<time>.webp` (lossless; about 20–40 KB each; Bruno's
are 128² and 5 KB). The matcap is the world's lighting, baked: a prop painted with it matches
the lit buildings beside it, at one texture fetch and no lights.

At run time `MeshMatcapMaterial` is kept (fog, instancing, skinning, `map`, `vertexColors`
all work) and `onBeforeCompile` adds a second sampler and `uMatcapMix`; the fragment swaps
`texture2D( matcap, uv )` for `mix(texture2D(matcap, uv), texture2D(uMatcapB, uv), uMatcapMix)`.
`bounce()` applies on top. Textures are `SRGBColorSpace`, `generateMipmaps` on,
`toneMapped: false` so the baked tone map isn't applied twice.

For a fixed-time world (the music courtyard at dusk, Scranton's office, the Shire's afternoon)
one matcap per colour is the whole lighting model, as in the folio.

### 4. `src/lib/physics/`: cannon-es, toy settings

`cannon-es` 0.20 (`sideEffects: false`, ESM, no dependencies; about 150 KB minified, less
after tree shaking; it runs in Node, so it is tested with Vitest). Rapier was considered
(15 MB package, a 2 MB WebAssembly download) and is not needed for one car and a few props.

```
createToyWorld({ gravity = -13 })          → { world, step(dt), materials, dispose }
addVehicle(world, spec)                    → { chassis, vehicle, wheels, drive(input, surface, dt), state(out), reset(x, z, yaw) }
addStatics(world, colliders, { around, radius = 90 }) → { update(x, z) }  (streams static bodies)
addProps(world, list)                      → { bodies, sync(meshes), wake(i), reset() }
addGround(world, { height, size, step })   → Plane (flat) or Heightfield (relief)
impacts(body, { min = 2, onHit })          → unsubscribe (collide events → impact velocity)
```

- **Stepping**: `world.step(1 / 60, dt, 4)`; meshes read `body.interpolatedPosition` and
  `interpolatedQuaternion`. Broadphase `SAPBroadphase`; `allowSleep`; props
  `sleepSpeedLimit 0.05` so they settle fast.
- **Contact materials** (Bruno's): `ground–prop { friction 0.05, restitution 0.3 }`,
  `prop–prop { 0.5, 0.3 }`, `ground–wheel { 0.3, 0 }`, `car–prop { 0.2, 0.3 }`, every one with
  `contactEquationStiffness: 1000`, `contactEquationRelaxation: 3`.
- **The vehicle**: a `RaycastVehicle` on a chassis `Box` (`indexRightAxis 0, indexUpAxis 1,
  indexForwardAxis 2`), wheels with `directionLocal (0, −1, 0)`, `axleLocal (−1, 0, 0)`;
  engine force on the rear wheels while under the surface's top speed, `setBrake` on all four
  for the brake, on the rear two for the handbrake together with a lower rear `frictionSlip`
  while it is held (the tail comes round); a coasting drag impulse `−forward · |v| · k` with no
  throttle; the self-righting impulse after 1 s with `up · y < 0.5`. Each wheel is also a
  kinematic `Cylinder` body (axis turned from cannon-es's Y to the axle) copied from
  `wheelInfos[i].worldTransform` after each step, so the wheels push props as Bruno's do.
- **Statics** come from the world's own collider list (Albuquerque: `collidersNear` boxes and
  circles, the kerbs as 0.14 m-high boxes over each block so the wheels ride up them); only
  those within `radius` of the player are in the world, re-diffed every 0.5 s or 20 m.
- **Props** are primitives (`Box`, `Cylinder`, `Sphere`) with masses 0.1–1.5; the scene owns
  the meshes and `sync` copies interpolated transforms (`matcapMaterial` for new props).
- **Impacts**: `body.addEventListener('collide', e => onHit(e.contact.getImpactVelocityAlongNormal(), e.body))`
  with the `min` cut-off; the world's sound module turns that into
  `volume = clamp((v − min) · k, 0, 1)²`, `rate = rand(0.85, 1.15)`, one of its variants, and a
  100 ms throttle per sound. The engine loop's rate and volume follow `|speed| · a + accel · b`,
  eased faster up than down (the site's `carSound` already has the loop).

### 5. Tiers and budget

The baked layer *removes* cost: a world that has its masks and blobs turns its shadow pass off
(`renderer.shadowMap.enabled = false`; the Aztek's `castShadow` goes), which in Albuquerque is
a whole extra render of the city per frame. Physics is 1–2 ms a step on a phone at these
counts. So every tier gets the same grounded picture; the `low` tier merely gets fewer props
(cap 16) and skips the second matcap sample. Download: masks about 1 MB per world, matcaps
about 0.3 MB, cannon-es 150 KB, all behind the world's gate (`WORLD_MB` goes up by that).

## The example: Albuquerque

The closest thing on the site to the folio: Walt's Aztek on a seeded city grid
(`albuquerque/world/`: `rules.js` the sim, `scene.js` the drawing, `AbqWorld.jsx` the wheel
and HUD). Today: a sun with a 2048 shadow map over ±58 m, hemisphere, `RoomEnvironment`, a
`stepCar` bicycle model, faked lean, nothing to knock over.

### What changes, layer by layer

| layer | today | after |
| --- | --- | --- |
| ground, roads, lots, pads | lit by sun + hemi, shadow map | the same materials, `floorShadow()` with three baked areas; `receiveShadow` off |
| buildings, walls, lamps, trees | lit, cast shadows | lit as before (their faces still face the sun), `bounce()` on the shell and prop materials, `castShadow` off |
| the Aztek, Hank, traffic, cast, tumbleweeds | cast shadows, faked lean | blob shadows (`createBlobShadows`), no shadow pass; the Aztek on a `RaycastVehicle` |
| props | none | cones, trash cans, newspaper boxes, Old Joe's tyres, mailboxes: rigid bodies, matcap-painted |
| shadow pass | on (high and mid tiers) | off in this world |
| camera | follows the car, lerped | follows x/z only, same lerp; the body's pitch and roll never reach it |
| sound | `state.bump` → one hit | impact velocity, pitch, variants, throttle; engine as before |

### Step 1: grounding (one pull request)

1. `lib/three/grounding.js` with its tests (`grounding.test.js`: the chunk swaps on stub
   shaders, `blobPlacement`, `maskWeights`).
2. `scene.js` gets `api.bake` (dev only), hiding movers and rendering the three areas:
   `city` (x −300…300, z −240…240, 2048²: 29 cm a texel), `rv` (x −380…−300, z 90…160, 512²)
   and `arches` (the Route 66 arches and billboards at x ±254…272, two 512² tiles). Times: dawn
   0.262 → R, noon 0.5 → G, golden 0.71 → B; sky → A. Night uses the sky term only.
3. `scripts/bake-floor-shadows.mjs` writes `public/albuquerque/shadow/{city,rv,arches-w,arches-e}.webp`
   and `index.json`; `npm run bake:abq` in `package.json`. Commit the output.
4. In `scene.js`: load the index, `floorShadow()` on the ground, road, lot and pad materials
   (`terrain.js`'s `groundMaterial`, `roads.js`'s materials: call it last, after their own
   hooks, as `antiTile` asks), `bounce()` on `city.js`'s shell material and the buildings;
   `createBlobShadows` for the Aztek (3.2 × 5 m), Hank, every moving and parked car
   (`vehicles.js` knows their footprints), the cast and the tumbleweeds; `castShadow = false`
   on all of them and `renderer.shadowMap.enabled = false` for this world; the sun's shadow
   camera code goes. The shade colour: `#5a3420`. The bounce colour follows `L.hemiGround`.
5. QA: screenshots at the four named times from the same `peek` (Walt's drive, Central at 4th,
   the RV), before and after; draw calls and triangles from `api.info` before and after
   (expect the shadow pass's share to vanish); a 2048² mask under 1.3 MB.

Acceptance: every building and parked car sits in a soft shadow that moves across the day;
the wall feet and alley gaps are darker than open ground; shadows are warm, not grey; the car
stands on a blob that slides away from the sun and fades over a kerb; no `castShadow` remains
in `albuquerque/`; frame time on the `mid` tier is lower than before (measure with
`api.info`).

### Step 2: wheels (one pull request)

1. `npm i cannon-es`; `src/lib/physics/{world,vehicle,statics,props,impacts}.js` with tests
   in Node (`vehicle.test.js`: reaches and holds the road's top speed; coasts to a stop; the same
   distance at `dt` 1/30 and 1/120 over 5 s (fixed step); climbs a 0.14 m kerb without
   stopping; a 0.5-mass prop in its path ends up metres away while the car loses under 10% of
   its speed; rights itself from upside down within 2 s; `state()` reports `yaw 0 → +z`).
2. `albuquerque/world/vehicle.js`: the Aztek's spec and its adapter. The adapter returns the
   same `{ x, z, yaw, speed, slide, yawRate }` `AbqWorld.jsx`, the HUD, the ghosts, the tyre
   marks and `carSound` read today, plus `bump`, `slip`, `surface`, so nothing above the sim
   changes. `stepCar` stays for the traffic (`stepTraffic` drives Hank and the town's cars as
   kinematic bodies: boxes the player bounces off), for the ghosts' prediction, and as the
   fallback where `cannon-es` fails to load. Its tests stay.
3. Starting numbers for the Aztek (metres; tune with the Driving panel, which gains a dev
   "Physics" folder the way Bruno tuned with dat.GUI):

   | | value | why |
   | --- | --- | --- |
   | chassis | `Box` half-extents (0.95, 0.5, 2.2), centre y 0.95, mass 40, `allowSleep false` | the stand-in's 1.9 × 1.1 × 4.4 |
   | gravity | −13 | Bruno's; settles and lands snappily |
   | wheels | 4 at x ±0.8, z +1.35 / −1.35, y 0.4; radius 0.36 | wheelbase 2.7 (`CAR.wheelbase`) |
   | `suspensionStiffness` | 30 (sag 13 / 120 ≈ 0.11 m of 0.3) | visible sag and bob |
   | `suspensionRestLength` / `maxSuspensionTravel` | 0.3 / 0.35 | |
   | `dampingRelaxation` / `dampingCompression` | 1.8 / 1.5 | Bruno's: bouncy |
   | `frictionSlip` | road 10, dirt 6, sand 4.5; rear 2.5 on the handbrake | `CAR.grip` ratios |
   | `rollInfluence` | 0.01 | it leans but doesn't tip |
   | engine force | 260 per rear wheel (= `CAR.accel` 13 × 40), 0 above the surface's top (`CAR.top/dirt/sand`) | |
   | brake | 20 all four; handbrake 25 on the rear | |
   | coasting drag `k` | 0.1 | glides to a stop (`CAR.coast`) |
   | steering | `stepSteer` as today, to `CAR.lock` reduced with speed as `slice()` does | the wheel ramps and recentres |
   | wheel bodies | kinematic `Cylinder(0.36, 0.36, 0.3, 12)`, mass 5 | push props |
   | self-right | after 1 s with `up.y < 0.5`: impulse (0, 150 · 40 / 40, 0) at +0.1 x | |
   | contacts | stiffness 1000, relaxation 3, restitution 0.3 (0 for the wheels) | the squish |

4. `scene.js`: the Aztek's group follows the chassis's interpolated transform (the faked
   `roll`, `pitch`, `slope`, `lean` and the 22 Hz shiver go); four wheel meshes (from the
   Sketchfab model's wheel nodes if it has them, else `vehicles.js`'s wheel builder) follow
   `wheelInfos[i].worldTransform`; the blob's `height` is the chassis's height above
   `surfaceHeight` and its `tilt` the chassis's up vector; `camLook` and `camPos` take the
   chassis's x/z and `surfaceHeight` for y, never its y, pitch or roll; `api.peek` as before.
5. Props: `plan.js` or a new `props.js` places about 60 in town (cones at two roadworks on
   Central, trash cans by the Route 66 shops, newspaper boxes at corners, mailboxes on Walt's
   street, a stack of tyres at Old Joe's, the tumbleweeds become bodies that the wind nudges);
   `addStatics` streams the colliders; `addProps` with a 16 cap on the low tier. Impact sounds
   through `sounds.js` (two variants each for metal, plastic, rubber) and the car's own `hit`.
6. Tests: the Node tests above, `rules.test.js` untouched and green.

Acceptance: pulling away squats the tail; a kerb lifts a wheel and the body follows; a cone
in the road scatters with a sound and the car barely notices; the handbrake swings the tail;
the car never gets stuck (self-right, R resets to the nearest road); the same lap takes the
same time at 30 and 120 Hz (set `?fps=30` in dev, or throttle Chromium).

### Step 3: matcaps (one pull request, optional once 1 and 2 are in)

`scripts/matcaps.mjs` renders Albuquerque's palette (`sand`, `adobe`, `brick`, `steel`,
`rubber`, `plastic-orange`, `glass`) at the four times from `lightAt(tod)`; the props from
step 2 and the code-built cars (`vehicles.js`) switch to `matcapMaterial`, `setMatcapTime`
each frame; `bounce()` on them. Measure: draw calls equal, fragment cost lower, the props
match the lit buildings beside them in a side-by-side at each time.

## Success criteria

- Both research findings and this spec are in `docs/`; the README's "How it works" gains a
  line on the baked layer and the physics once step 2 lands.
- Lint, tests and the build pass; `node scripts/autopilot-check.mjs --routes /albuquerque`
  passes with its screenshots.
- Albuquerque at the four named times reads as grounded (the acceptance lists above) in
  screenshots kept under `docs/superpowers/shots/`.
- The main bundle doesn't grow; `cannon-es` and the grounding module appear only in
  Albuquerque's chunk (check `vite build`'s output).
- Frame time on the `mid` tier in Albuquerque is lower after step 1 than before (the shadow
  pass is gone), measured with `api.info` over 300 frames at the same `peek`.
- `rules.test.js` still passes unchanged; the new physics tests pass in Node.

## Decisions and assumptions (for the owner to overturn)

1. **The hard sun shadow goes in Albuquerque** (buildings stop casting on each other and on the
   car). What replaces it is the folio's grounding: soft masks under the static set, blobs under
   movers, bounce on undersides. This is the trade the folio makes, and it saves the shadow pass.
   If building-on-building shadows are wanted, the sun's shadow map can stay for the *walls*
   only (the ground no longer receives it): one line to flip.
2. **The Aztek's handling changes character**: a rigid body with raycast suspension slides
   differently from the tuned bicycle model (the handbrake's swing is now from rear friction
   and brake, not `CAR.swing`). The behaviours `rules.test.js` describes are the targets to tune
   toward; `stepCar` is kept for traffic and as the fallback, not deleted.
3. **Masks are baked per named time, not continuously.** Between times the two nearest blend;
   a shadow's direction therefore eases rather than sweeps. Four times suffice because the
   world's own sky already names four.
4. **Download grows by about 1.3 MB** behind Albuquerque's gate; `WORLD_MB` is updated.
5. **No Blender.** Bakes render in headless Chromium through the scene's own code. A real GPU
   bakes a 2048² area in seconds; SwiftShader takes minutes; both are offline and one-off.
6. **Other worlds follow the same three modules** once Albuquerque proves them: the Shire and
   the towns (already have a blob under everyone but Frodo), the galaxy's surfaces (fixed time
   per world: matcaps outright), the music courtyard and Scranton (fixed light: matcaps), the
   HQ compound. Not in this spec.

## Working notes for the implementer

- Conventions: comments say *why*, in plain prose, as the files around you do; pure logic in a
  module with tests beside it; shader hooks as chunk swaps with a `customProgramCacheKey`
  (`lib/three/surface.js` is the model, `office/world/ao.js` the blob-and-strip precedent);
  every texture through `lib/three/textures.js`'s `loadTexture`/`sharpen`; dispose everything
  you make (`own()` in `scene.js`).
- Checks before each commit: `npm run lint`, `npm test`, `npm run build`, then
  `node scripts/autopilot-check.mjs --routes /albuquerque` (headless Chromium is at
  `/opt/pw-browsers/chromium`; software WebGL is slow: `--settle 8000`).
- Browser QA recipe (from `docs/superpowers/HANDOFF-worlds.md`):
  localStorage `tp-intro=1`, `tp-3d=on`, `tp-worlds="load"`, `tp-quality=low`;
  `window.__ABQ__.api.settle()`; `api.peek([x, y, z], [lx, ly, lz])` pins the camera;
  `api.info()` reports draw calls and triangles; `window.__ABQ__.sim` is the car.
- The folio's source is worth reading alongside: `World/Physics.js`, `World/Shadows.js`,
  `shaders/matcap/fragment.glsl`, `Materials/FloorShadow.js` in `brunosimon/folio-2019`.
- One pull request per step, each merged on its own; branch from `main`; run the autopilot
  check with `--shots` for the ship's log if the autopilot's protocol applies.

## Implementation notes (Step 1, as built)

What changed from the spec above, and why. Two sessions built it: the first wired it, the
second checked it and tuned it. Commits `8087d86`, `c0b7934` and the Step 1 commit after them.

1. **How the masks are rendered.** The spec draws a white Lambert floor once per direction
   and divides by n·l. As built, the floor is drawn once from straight above into a float
   picture of where each of its points is in the world. Then, for each direction, the static
   world goes into a 4096² `BasicShadowMap` from that direction, and one additive pass over
   the picture adds up which points it sees (`lib/three/grounding-bake.js`). That gives
   visibility only, with no cosine to divide back out: slopes stay the ground shader's
   business. Each area takes 208 passes: 48 sun directions in a 4° cone at each of the three
   named times, and 64 sky directions.
2. **Sizes.** The city is baked at 2048² (29 cm a texel) and kept at 1024² by averaging each
   2 × 2 block. Lossless 2048² was 1.95 MB, over the 1.3 MB cap. The averaged mask is also
   smoother than one rendered at 1024². The RV and the two arches tiles are 512². As shipped:
   city 842 KB, RV 29 KB, arches-w 85 KB, arches-e 73 KB, about 1.03 MB in all.
3. **Two more times with no sun**, 0.245 and 0.76 (channel 3, the sky term alone), either
   side of dawn and golden hour. The sun's shadows fade in as it rises and out as it sets,
   instead of appearing at the first named time.
4. **Dawn's sun is lifted for the bake.** At 0.262 the sun stands 3.9° up. Baked there, every
   building threw its shadow across the next block and the mask drowned the town: the city's
   mean sun visibility at dawn was 0.40, against golden hour's 0.63. The bake now takes a
   time's `lift` (`liftSun`): dawn is baked at golden hour's 12.8°, facing the same way. The
   morning's shadows run as long as the evening's, the other way. The walls are still lit
   by the real sun.
5. **The shade.** The spec's
   `mix(uShade · outgoingLight, outgoingLight, 0.4 + 0.6 · min(gSun, gSky))` darkened a
   shadow a second time: the sun's light and the sky's are already cut by then. A shadow came
   out at about 0.42 of its light, dark brown, and at dawn the whole town did. As built:
   - `outgoingLight *= mix(1, uShadeTint, uShadeMix · (1 − min(gSun, gSky)))`
   - the tint is `#5a3420`'s hue at linear luminance 0.45 and saturation 0.6
     (`shadeTint`, `SHADE_TINT`), mixed in at 0.65
   - a shadow keeps about two thirds of its light and goes warm brown, neither grey nor red
   - at full saturation the pools under the trees went red; at three quarters' brightness the
     golden-hour shadows hardly read
   - the mix follows how much of the floor's light is the sun's: `setFloorTime(bake, tod,
     sun)`, with `smoothstep(0, 0.15, sun.y)` from `scene.js`. A sun just up hardly lights
     the street, so it doesn't darken what it would shadow.
   - night has no tint. The sky term still darkens wall feet and alleys.
6. **The building shell had too many vertex attributes** (`city.js`): 17, over the 16 a
   graphics chip must support. SwiftShader drew no buildings at all, and `main` logs
   `VALIDATE_STATUS false` for it there. `aCorner` duplicated `position` and was dropped.
   lift, out, cornice and drop are packed into one `vec4 aBend`.
7. **Blobs.**
   - one instanced draw for up to 96 movers: the Aztek, Hank, the traffic, the cast, the
     tumbleweeds (by how high they've hopped) and the freight's cars
   - drawn multiplied (the floor times `mix(1, shade, a)`), `renderOrder` −1 so they come
     straight after the floor and before anything see-through, with `polygonOffset`
   - parked cars get none: they don't move, so they're in the masks
   - their strength follows the sun's share: 0.5 by the moon at night
8. **`api.info` counts every pass.** `renderer.info.autoReset` is off and the count resets
   once a frame, so the composer's passes are all in it (and, before, the shadow pass).
9. **Shadows gone from the world.** No `castShadow` or `receiveShadow` remains in
   `albuquerque/world`, and the stage's shadow pass is off. The Casa Tranquila and Metherria
   interiors (`albuquerque/casa`, `albuquerque/metherria`) are their own scenes, lit their
   own way, and are untouched.
10. **Scripts on any machine.** `scripts/abq-qa.mjs` and `scripts/bake-floor-shadows.mjs`
    take their paths through `fileURLToPath` (a URL's pathname starts `/C:/` on Windows). They
    use a local Chrome or Edge where the sandbox's `/opt/pw-browsers` isn't there. The QA
    script gained:
    - the `central-slant` and `park` views
    - `--name` and `--json`
    - a median beside the mean

### Measured (Step 1)

Walt's drive, `mid` tier, Edge's SwiftShader at 960 × 600, the QA script's steady 60 Hz
clock. Three rounds, before and after interleaved, 24 frames each at noon and golden hour.
"Before" is `main` with only fix 6 applied, so its city draws.

| | before (shadow map) | after (masks, blobs, bounce) |
| --- | --- | --- |
| frame, median of the rounds' medians | 641 ms | 561 ms (−12%) |
| draw calls | 164–169 | 109–110 (−35%) |
| triangles | 1.47 M | 0.79 M (−46%) |

The screenshots at the four times are in `docs/superpowers/shots/2026-10-06-abq-grounding-*`.
At dawn the mean brightness now matches the old picture's (RGB 110/85/62 against
111/91/69); with the spec's formula it was 83/62/44.

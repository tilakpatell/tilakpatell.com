# Task 4 report: the renderer, clouds and their young stars

Worked from the plan's "### Task 4" (lines 405–577); task-4-brief.md was missing when I started and the controller confirmed it is the same text.

## Commit

- `5337751e1` Nebulae: one renderer, every cloud fixed in the world in one draw

## What I implemented

Files (all new):

| File | Lines |
|---|---|
| `src/components/universe/nebula/index.js` | 255 |
| `src/components/universe/nebula/shaders.js` | 191 |
| `src/components/universe/nebula/index.test.js` | 139 |
| `src/components/universe/__fixtures__/glsl.js` | 12 |

### index.js

- `createNebulae({ renderer = null, tier = 'mid' } = {}) → { group, add, remove, update, inside, dispose }`.
- `group` ('nebulae') holds `nebula-clouds` and `nebula-fog`, both made at create and hidden. `nebula-fog` is an empty `Mesh(new BufferGeometry())` (three's default basic material), hidden and not frustum-culled. Task 5 replaces it with `createFog`'s mesh. The fog material can't be warmed up in Task 4 because it doesn't exist yet.
- `ShaderMaterial` is named once, in the `glslMaterial` helper.
- The volume is a `Data3DTexture(noiseVolume(row.volume, 1))` with `RGFormat` (RG8), `RepeatWrapping` on S/T/R, linear filtering, no mips and `unpackAlignment` 1. `renderer?.initTexture(volume)` runs at create.
- The mesh is an `InstancedBufferGeometry` of `PlaneGeometry(2, 2)`, sized `row.drawn × (1 + row.stars)` (1040 at high), with `instanceCount` 0 at create.
- Material settings:
  - `defines: { MAX_STEPS: row.nearSteps }`
  - premultiplied blending: `CustomBlending`, `One`, `OneMinusSrcAlpha`
  - `transparent`, `depthTest: true`, `depthWrite: false`
  - `side: DoubleSide` with `forceSinglePass: true` (see the browser check)
  - `frustumCulled: false`, `renderOrder: -5`
- `onBeforeRender` sets three uniforms from the drawing camera and target:
  - `uScale = h/2 · P[5]`, copied from deepspace.js:1262-1266
  - `uTan = (1/P[0], 1/P[5])`, which is `(tan(fov/2)·aspect, tan(fov/2))` read off the projection, so zoom is included
  - `uNear`
- Each `update(camera)`:
  1. `group.updateWorldMatrix`, then `camMap = group.worldToLocal(camera.getWorldPosition())`, and `mesh.position = camMap`.
  2. Each entry goes through `placement(at, r, camMap, camera.far · LIMIT)`.
  3. The scaled sphere is tested against a `THREE.Frustum` in the world: its centre goes through `group.matrixWorld` and its radius is multiplied by the group's max scale.
  4. The survivors are sorted far to near by `dist` and kept to the nearest `row.drawn`. Only the nearest `row.nearMax` get `detailAt`; the rest get 0.
  5. A cloud with detail > 0 has its stars written right after it.
  6. `instanceCount = n` and `visible = n > 0`. Each attribute is marked for upload with `clearUpdateRanges`/`addUpdateRange(0, n·itemSize)`.
- Handles are integers. `entries` is id → entry with a count; `handles` is handle → id.
  - The same id added twice draws once, until every handle is removed.
  - A stale or unknown handle does nothing.
  - After `dispose()`, `remove` and `update` do nothing, and `add` still checks the desc (TypeError) but returns an inert handle.
  - `dispose()` removes the group from its parent and disposes the geometry, quad, material, volume and fog mesh.
- `inside(position)` is `insideOf(entries.values(), position)`. The plan lists `insideOf` among Task 4's imports, so I wired it here and added a small test.
- What each entry precomputes at `add`:
  - its colours at full strength (max channel 1), as deepspace's `pal` does today
  - `seedOf(seed)`
  - `youngStars(desc, row.stars)`, each star's light = `(0.85, 0.9, 1).lerp(pal[s.pal], 0.2) × bright`. That is the sparks' blue-white at the mean of their random jitter, which `youngStars` doesn't return.

**Attribute packing** (the brief's six names, plus mine):

- `aCentre` vec3: the middle from the camera, scaled
- `aRadius`: the scaled radius; for a young star, its size (the sparks' `aSize`)
- `aDist`: the true distance; for a star, the star's own true distance
- `aDetail`: for a star, its cloud's detail
- `aStart`: always 0 here (Task 5 sets it)
- `aKind`: 0 for a cloud, 1 for a young star
- `aCol0`, `aCol1`, `aCol2` (vec3): the three colours at full strength. For a star, `aCol0` is its light × its cloud's detail, so stars fade in with the near level.
- `aSeed` vec4: the seed's (a, b, c) and the form's index
- `aSteps`: `stepsAt(detail, row)`

That is 12 attributes, plus `position` = 13 of the 16 vertex attributes allowed.

A star is placed at `(at + s.at − camMap) × its cloud's placement scale`, so it stays inside its drawn cloud. Its pixel size uses its true distance.

### shaders.js (GLSL strings only)

- **`GAS = { EMIT: 1.5, ABSORB: 2.0, DUST: 1.5 }`**, written into the GLSL as `const float`s.
- **`FIELD`**: the chunk Task 5's fog includes. It holds:
  - `uniform highp sampler3D uVolume`
  - `envelopeOf(p, form)`: rules.js's `envelope()` line for line, with form = (inner, peak, outer, flat)
  - `float nebulaField(p, seed, form, core, detail, c0, c1, c2, out vec3 tint, out float dust)`, which returns the gas (0 to 1). In it:
    - p is in the cloud's radii along the map's axes.
    - The gas is `envelope × smoothstep(0.3, 0.8, R at p·1.3 + seed)`. With detail, a finer tap at four times the frequency (`p·5.2 + seed.zxy`) adds `detail × (R − 0.5) × 0.35` before the smoothstep, so it frays the edges.
    - The colour is `mix(c0, c1, smoothstep(0.2, 0.8, G))`, then mixed toward `c2` by `smoothstep(0.45, 0.85, gas)`.
    - The heart: `tint × mix(core, 1, smoothstep(0, 0.4, ρ))`.
    - The dust is `env × smoothstep(0.7, 0.9, G)`.
  - The fog needs only `nebulaField` plus its own p.
- **`CLOUD_VERT`**: `uForms[f]` and `uCore[f]` are indexed in the vertex shader and passed as varyings. Three branches:
  - **Young star:** a clip-space sprite of `clamp(size·uScale/aDist, 2, 30)` px. The pixel size in NDC comes from the projection matrix and `uScale`, so there's no viewport uniform.
  - **`D ≤ 1.02·aRadius`:** a full-screen quad at the NDC depth of `max(aStart, 4·near)`. The ray is `transpose(mat3(modelViewMatrix)) · (xy·uTan, −1)`.
  - **Otherwise:** a square facing the eye, perpendicular to the centre's direction, with half-size `zp·R/√(D²−R²)`. `zp` is the centre (scaled) or `max(D − R, 4·near)`. "Scaled" is detected as `aDist > |aCentre|·1.001`.
  - Anything scaled gets `z = w`, which puts it at the far plane's depth, behind a day dome and behind everything. Every vertex then gets the landmarks' `z ≤ 0.999999·w` clamp, so nothing is cut by the far plane.
- **`CLOUD_FRAG`**:
  - **Star:** `SPARK_FRAG`'s falloff on the quad's corner coordinates, alpha 0 (adds light only).
  - **Cloud:**
    1. Ray–sphere, measured from the ray's nearest point to the centre (`off = c − (rd·c)·rd`), which keeps a small sphere tens of thousands away exact in float32. `t0 = max(entry, aStart, 0)`, `t1 = exit`; discard on a miss.
    2. `steps` samples from `t0`, jittered by interleaved gradient noise. The step is in radii.
    3. Beer–Lambert with emission: `light += T·tint·(EMIT·gas/σ)·(1 − e^{−σ·ds})`, where `σ = ABSORB·(gas + DUST·dust)`.
    4. Stop when `T < 0.02`. Output is premultiplied `(light, 1 − T)`, then `colorspace_fragment`.
  - Over a thick cloud, light tends to `EMIT/ABSORB × colour × heart` = 0.75, or 1.65 at a nursery's heart, under the bloom's 1.7. Dust only lowers it. A test pins this.

### Decisions the brief didn't fix, or where I differ in form

1. **The map's axes.** The brief writes `p = transpose(mat3(modelViewMatrix)) · (rd·t − c)/R` in the fragment shader. I do the march in the mesh's own space instead, where the eye is the origin (the mesh sits at `camMap`) and `aCentre`/`aRadius` are already there. The vertex shader takes the view ray into that space with the same `transpose(mat3(modelViewMatrix))`, and the fragment marches `p = (rd·t − aCentre)/R`.
   - The result is identical for a rotation.
   - The fragment shader needs no `modelViewMatrix`.
   - It is also right if the map ever carries a uniform scale, because the direction is normalised.
2. **Scaled clouds and depth.** Everything pulled in (cloud quads, full-screen or not, and their stars) is pushed to the far plane's depth (`z = w`, then clamped). This includes being inside a scaled sphere on foot, which would otherwise draw a full-screen quad at 4·near in front of the ground.
3. **Colours** are normalised to full strength as deepspace does today. A three.js `Color` from a hex string is already linear, so I don't convert twice the way landmarks.js does.
4. **`DUST 1.5`** (not in the brief): dust is half again as absorbing as gas, with no emission.

## TDD evidence

RED, with the brief's 11 tests plus 3 of mine (`would catch a reserved name`, `keeps the gas … under the bloom`, `says which nebula a point is inside`):

```
$ npx vitest run src/components/universe/nebula/index.test.js
 FAIL  src/components/universe/nebula/index.test.js
Error: Cannot find module './shaders' imported from …/nebula/index.test.js
 Test Files  1 failed (1)
      Tests  no tests
```

GREEN after `shaders.js` and `index.js`:

```
$ npx vitest run src/components/universe/nebula
 Test Files  4 passed (4)
      Tests  36 passed (36)
```

The browser check then found a bug (below), so I wrote a regression test first. RED:

```
     × is never culled for which way its quad winds, and draws in one pass
AssertionError: expected +0 to be 2 // Object.is equality
      Tests  1 failed | 14 passed (15)
```

GREEN after the fix:

```
$ npx vitest run src/components/universe/nebula
 Test Files  4 passed (4)
      Tests  37 passed (37)
```

The brief's tests are kept verbatim inside `describe('the nebulae’s renderer')`.

## Lint and measure

- `npx eslint src/components/universe/nebula src/components/universe/__fixtures__/glsl.js`: exit 0, no findings.
- `node scripts/health.mjs --only glsl-sites`: **608** (607 before; budget for this task ≤ 609). The one new site is `glslMaterial` in index.js; shaders.js names none.

## The browser check

### What I ran

The lab files are gitignored under `lab/universe/` and not committed:
- `nebula-lab.html` and `nebula-lab.js`
- `nebula-shot.mjs` and `nebula-measure.mjs`

The lab page sets up:
- a `WebGLRenderer` at 1280×720, with `debug.onShaderError` collecting errors
- a "map" group, turned (0.2, 0.7, 0) and with clouds about 1e6 out, so precision and the map's axes are exercised
- `createNebulae({ renderer, tier: 'high' })` under the map
- three clouds: a `cloud` (r 1300) and a `shell` (r 1200) in the Veil colours `['#5b3fd1', '#d14f9a', '#3fb7d1']`, and a `nursery` (r 1000) in greens
- a depth-less backdrop of stars drawn first, as farStars.js does

Six views:

| View | Camera |
|---|---|
| `trio` | all three, 8–12k away, far level |
| `near` | 3 radii from the nursery: near level, young stars on |
| `shell` | 2.4 radii from the shell |
| `far` | 60k back, all past the 45k far plane, so pulled in |
| `inside` | at a cloud's exact middle |
| `edge` | 1% outside a cloud's sphere |

I served it with `npx vite --port 5199 --strictPort` and drove it with playwright-core and Chromium 1248 (SwiftShader flags, as universe-check uses). I checked the CPU-quiet lock before every run and waited about 40 minutes for it to clear once. Afterwards I stopped the dev server and confirmed port 5199 was free.

### Run 1: a bug found

- **No shader errors:** every program compiled and linked.
- **The bug:** only `inside` (the full-screen path) showed gas. The plane quads were back-face culled, because the square was built with `u × v = +dir`, so its normal faced away from the eye under the default `FrontSide`.
- **The fix:** `v = cross(u, dir)`, and the material is `DoubleSide` with `forceSinglePass` (so three doesn't split it into two passes). A RED-then-GREEN test pins it; the TDD evidence is above.

### Run 2: after the fix

- **No shader errors.** The only console error is a 404 for the favicon.
- **Draw calls:** `renderer.info.render.calls` is 2 in every view: the backdrop and the one nebula draw.
- **Instances per view:** trio 3; near 65 (1 + 64 stars); shell 66; far 3; inside 65; edge 66.
- **Screenshots** are in the scratchpad, `C:\Users\tilak\AppData\Local\Temp\claude\C--Users-tilak\77fdb569-e17b-4fa9-a542-32b1c869bb22\scratchpad\`, as `nebula-trio.png`, `nebula-near.png`, `nebula-shell.png`, `nebula-far.png`, `nebula-inside.png` and `nebula-edge.png`.

What I saw:
- **trio:** three soft clouds at their true size, flattened as their forms say (the cloud wide, the shell rounder). They show mottled violet, pink and cyan with darker dust pockets; the nursery is yellow-green with a teal middle.
- **near:** the nursery fills the middle third. It has billows, dark dust lanes, a brighter teal-blue heart and a cluster of young stars at its middle.
- **shell:** a big ball, brightest at its rim, with a darker, mottled middle; another cloud peeps out at the left.
- **far:** three small clouds at their true angles, with no clipping.
- **inside / edge:** continuous gas filling the screen, with dust, no seam, no black and no NaN.

### Measured

Each view was rendered again into a FloatType target, which is linear like the post's target, with the backdrop hidden.

| View | Lit px | NaN | p50 | p99 | p99.9 | Max |
|---|---|---|---|---|---|---|
| trio (no young stars) | 150,806 | 0 | 0.133 | 0.469 | 0.559 | **0.645** |
| near | 305,021 | 0 | 0.061 | 0.400 | 0.450 | 4.162 (young-star cores) |
| shell | 663,121 | 0 | 0.154 | 0.433 | 0.491 | 5.607 (young-star cores) |
| inside | 921,600 | 0 | 0.215 | 0.394 | 0.403 | 1.258 (young stars) |

- **The gas tops out about 0.65 linear, well under the bloom's 1.7.** Only young stars go over it, which the brief allows.
- **The shell is hollow.** In 40-px bins across its middle, the rim reads 0.29–0.33 on the left and 0.32–0.38 on the right; the middle reads 0.11–0.18.

### What I saw, for tuning

- **The look constants are unchanged** (EMIT 1.5, ABSORB 2.0, DUST 1.5). Nothing was plainly wrong.
  - The gas is on the dim side of its headroom: a p99.9 of about 0.5 against a bound of 0.75 × colour.
  - The new bloom test caps EMIT/ABSORB at 1.7 / 2.2 ≈ 0.77. To brighten the gas, Task 8 can raise EMIT and ABSORB together, or soften the nursery's core.
- **The far level shows a fine diagonal hatching** at 6 steps (high's `farSteps`). It comes from the fixed per-pixel interleaved-gradient jitter and is visible on far clouds about 350 px across in `trio`. The near level (32 steps) is clean. Task 8 or Task 10 may want a little more `farSteps` for a far cloud that is big on screen, or a softer jitter.

## Self-review

- **Tests:** the brief's 11 tests are kept verbatim. I added 4:
  - the reserved-name check can fail
  - the bloom bound on `GAS` and `uCore`
  - `inside()`
  - DoubleSide and single pass
- **Imports:** nothing from deepspace.js or deepspaceShaders.js. The `SPARK_FRAG` falloff and the `uScale` `onBeforeRender` are copied, per ruling R2.
- **glsl-sites:** `ShaderMaterial` appears once (`glslMaterial`), and shaders.js names none.
- **GLSL:** the strings are ASCII (no curly quotes or ellipses inside GLSL comments). They declare no reserved words, which the fixture checks.
- **Precision:** only camera-relative, scaled values reach float32 attributes. The `inside` view, with the map turned and the cloud about 1e6 out, gave `aDist` 6.5e-11, so it is exact.
- **Handles:** a stale handle, an unknown handle, a handle after dispose, and a double add are all covered by the brief's test.
- **Concerns, all small:**
  1. `nebula-fog` is a placeholder `Mesh(BufferGeometry)` carrying three's default `MeshBasicMaterial`. That gives the warm-up nothing new. The fog's real material can't be warmed until Task 5 makes it, so Task 5 should put `createFog`'s mesh in this one's place.
  2. `noiseVolume(64)` is about 100 ms on the main thread at create (Task 3's note), and it is cached after the first call.
  3. The look is dim-ish and the far level has grain, as above. Both are left for tuning against the before shots.

---

# Fix round 1

Commit: `c2c409335` Nebulae: the inside ray through the lens shift; handles unique.

## What changed

1. **Important: the full-screen (inside) ray now goes through the lens shift.**
   - `shaders.js` has a new vertex chunk, `SCREEN_RAY`: `vec3 screenRay(vec2 ndc) { return vec3((ndc + vec2(P[2][0], P[2][1])) / vec2(P[0][0], P[1][1]), -1.0); }`. Its JS mirror, `screenRay([x, y], elements)`, uses `(x + e[8]) / e[0]` and `(y + e[9]) / e[5]`, and sits beside it in the same file. That keeps the ray maths in one place Task 5's fog layers can `${SCREEN_RAY}` into their vertex shader.
   - The inside branch of `CLOUD_VERT` is now `vRay = transpose(mat3(modelViewMatrix)) * screenRay(position.xy)`.
   - The `uTan` uniform and its `onBeforeRender` line are gone. `onBeforeRender` now sets only `uScale` and `uNear`.
   - **Sign:** `+` is right. three's `makePerspective` puts `(r+l)/(r−l)` in `te[8]` (GLSL `[2][0]`), and for a view ray with z = −1, `ndc.x = P00·X − P8`, so `X = (ndc.x + P8)/P00`. The Node test settled it: with `−` the mirror would be off by `2·P8/P00` (P8 = 0.234 in the test) and fail at 9 decimals.
2. **Minor (a): handles are unique across renderers.** A module-level counter (`nextHandle`) means a stale handle kept from a disposed renderer can't remove another renderer's cloud.
3. **Minor (b): curly apostrophes** in the JS comments of `index.test.js` (lines 114–115 and 126) and `__fixtures__/glsl.js` (lines 1, 2 and 8). I also curled the new JS comment in shaders.js. GLSL comments stay ASCII.

New tests:

- **`never lets a handle from one renderer remove another’s cloud`:** renderer A adds and disposes; renderer B adds; `B.remove(A’s handle)` leaves B's cloud drawn.
- **`casts the inside ray through the lens as the camera has it, nav and side panel and all`:**
  - The camera is turned off-axis with `setViewOffset(1600, 900, 190, 34, 1600, 900)`. That is scene.js `measure()` for a 380 px panel and the 68 px nav, and gives P[8] and P[9] ≠ 0.
  - For six NDC points (the corners, the centre and one inside), `screenRay` matches the view-space direction of `new Vector3(x, y, 0.5).unproject(camera)` to 9 decimals.
  - It also checks that `SCREEN_RAY` holds that exact expression, that the vertex shader includes the chunk and builds the inside ray from `screenRay(position.xy)`, and that `uTan` is gone.

Line counts are now 255 (index.js), 206 (shaders.js), 169 (index.test.js) and 12 (glsl.js).

## TDD evidence

RED, with the two tests written first:

```
$ npx vitest run src/components/universe/nebula/index.test.js
     × never lets a handle from one renderer remove another’s cloud 11ms
     × casts the inside ray through the lens as the camera has it, nav and side panel and all 1ms
 FAIL … > never lets a handle from one renderer remove another’s cloud
AssertionError: expected false to be true // Object.is equality
 FAIL … > casts the inside ray through the lens …
TypeError: screenRay is not a function
      Tests  2 failed | 15 passed (17)
```

GREEN:

```
$ npx vitest run src/components/universe/nebula
 Test Files  4 passed (4)
      Tests  39 passed (39)
$ npx eslint src/components/universe/nebula src/components/universe/__fixtures__/glsl.js
(exit 0, no findings)
$ node scripts/health.mjs --only glsl-sites
glsl-sites  607  sites  619  ok
```

My site count is unchanged (one `ShaderMaterial` in index.js). The total went 608 → 607 because Task 7's `31dceb3d8` removed landmarks.js's site.

## Browser check (lock clear, compile and alignment)

- **What I ran:** the same lab, with two new views either side of the 1.02 R switch: `edgeIn` at 1.015 R takes the full-screen path, and `edgeOut` at 1.025 R the square. `lens(on)` sets `setViewOffset(1280, 720, 150, 34, …)`, half a 300 px panel and the nav. `shiftBetween(a, b)` renders both into a float target and finds the pixel shift that best lines them up.
- **Compile:** no shader errors. The changed vertex shader compiles and links.

| Run | P[8], P[9] | Best shift (px) | Error there | Error at (0, 0) |
|---|---|---|---|---|
| No lens shift | 0, 0 | (0, 0) | 0.0040 | 0.0040 |
| Lens shift, new ray | 0.234, −0.094 | **(0, 0)** | 0.0045 | 0.0045 |
| Lens shift, old `uTan` ray patched back in (lab only, as a control) | 0.234, −0.094 | **(−156, +32)** | 0.0159 | 0.2374 |

- **Result:** the control reproduces the reviewer's finding at the size of the shift (150, 34), and with the fix the two sides of the switch agree.
- **Shots** are in the scratchpad (`C:\Users\tilak\AppData\Local\Temp\claude\C--Users-tilak\77fdb569-e17b-4fa9-a542-32b1c869bb22\scratchpad\`): `nebula-edgeIn-lens.png`, `nebula-edgeOut-lens.png` (the same picture) and `nebula-edgeIn-lens-oldray.png` (the control).
- I checked the CPU-quiet lock before the run. The dev server is stopped and port 5199 is free; that was pid 31808, an orphan of my own earlier vite.
- **Not done, as the controller said:** the far-depth epsilon, the far-level hatching, and EMIT/ABSORB tuning (Task 8).

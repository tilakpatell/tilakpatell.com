# Beyond WebGL: the WebGPU worlds, the uncharted planets and the living worlds — design

Date: 2026-10-06. Status: **drafted by an autonomous session from the owner's brief; the pull request is the review.** Nothing in it is built yet: the foundation's plan is `docs/superpowers/plans/2026-10-06-webgpu-foundation.md`, the hand-off is `docs/superpowers/HANDOFF-webgpu-worlds.md`, and the research behind every claim is `docs/research/2026-10-06-beyond-webgl-webgpu-and-living-worlds.md`. The open questions at the end need the owner's answers before parts 2 to 4 start; part 1 can start on approval of this document.

## The brief

> Everything is saying to move beyond Three.js and use WebGPU and write GLSL shaders. Also look at judnich/Kosmos and gtremors/cosmos. Also look at tentone/geo-three and openglobus/openglobus. And open sky flight by jean jerome and recast by shapur1234. Look at Trip. Look into AI to run and have conversational NPCs and alien life and use AI for that.

## What the brief means here

Three readings, each checked against the code and the references, and the decision taken on each.

**“Move beyond Three.js.”** What the references moved beyond is `WebGLRenderer`, and what the two that left three entirely (Kosmos in 2013, Rezcraft in Rust) paid for it was a whole engine each. This site has 1,483 source files, 133 that make a `ShaderMaterial`, 75 that patch one with `onBeforeCompile`, 478 GLB models through one loader with KTX2 and a cache, and a world runtime (`src/runtime/`) with a WebGPU backend already written and gated behind a module's `shading: 'nodes'` promise. Nothing uses that backend yet. **Decision: the renderer moves, three stays.** New worlds, and worlds that are rebuilt, draw through three's `WebGPURenderer` (`three/webgpu`) and TSL; the GLSL worlds are not touched. The best WebGPU work in the references (COSMOS, OpenSkyFlight, False Earth, Bruno Simon's 2025 folio) is on exactly this stack.

**“Write GLSL shaders.”** WebGPU runs WGSL, not GLSL. Writing shaders by hand stays: three r186's `wgslFn` wraps a WGSL function as a node and `glslFn` its GLSL twin for the WebGL 2 fallback. **Decision: shared pieces are written once in TSL** (it compiles to both); **the heavy procedural kernels are hand-written WGSL** (terrain height into a storage texture, the atmosphere march, the nebula march, flocking), each with a cheaper TSL stand-in or a plain card for the browsers without WebGPU.

**“AI for conversational NPCs and alien life.”** Conversation needs a model while the visitor is there. Alien life does not: a species can be designed once, ahead of time, and built from its sheet at runtime, which keeps the standing rule that no asset is fetched from a service at runtime. **Decision: talk is remote first (Claude behind a Worker holding the key), local second (an on-device model, opt-in), baked third (the lines the voices pipeline already records); animals are designed offline by Claude into committed sheets and built procedurally.**

## Goals

1. **A proven WebGPU path through the runtime**: a `nodes` world draws on `WebGPURenderer`, falls back to its WebGL 2 backend where WebGPU is missing or fails on the first frame, and is checked in CI on software WebGPU and on the fallback.
2. **One shared shading library** (`src/lib/tsl/`) every nodes world draws from: noise, fbm, ridged, Voronoi, domain warp, hashing, blackbody, Rayleigh and Mie scattering, dithering, matcap, the universe's grade. Each piece tested as a graph and compiled on both backends.
3. **The uncharted**: beyond the universe map's rim, star systems nobody drew, from a seed, deterministic and shareable: a star, planets of six kinds with air, clouds, seas and rings, moons and a belt, that the ship can fly down to with the ground sharpening under it the whole way. Every location is a link.
4. **Living worlds**: alien species designed by Claude ahead of time, built and animated procedurally, behaving by tested rules; and people and aliens who can be spoken to, remembering the conversation while the visitor is there, in character, within the owner's rules.
5. **Cheaper or the same.** Every nodes world starts from `lib/device`'s tier and lowers itself under the runtime's quality controller; a WebGPU-only effect names what the fallback draws instead; every checkpoint reports frame time, draw calls and triangles at fixed poses on `high`, `mid` and `low`.
6. **Nothing a visitor can do is lost.** The GLSL worlds keep working as they are. The uncharted is reached from the map and hands back to it.

## Non-goals

- Not a rewrite of any existing world to TSL. Migration of a GLSL world is its own lane, after the foundation proves the path, one world per session, and only where it gains something (compute, or a post pass the composer cannot do).
- Not leaving three, not raw WebGPU, not a Rust or wasm engine.
- Not Earth from live tiles (OpenSkyFlight's runtime fetches): part 4 bakes a few places instead, and only if the owner wants the bytes.
- Not voice cloning at runtime; generated lines are spoken by the browser's own voice with captions, as the C-137 ship already does.
- Not multiplayer in the uncharted in its first version. The seams for it (a seed, a deterministic system) are kept.
- No sequel-trilogy content; no copied dialogue beyond short famous lines.

## Constraints (the standing rules that bite)

- No runtime calls to asset services. A species sheet, a baked tile, a recorded line: all made ahead and committed. **The one runtime call this design adds is the talk Worker**, for conversation only, with the key on the Worker and caps in front of it; the owner decides it (open question 2).
- Never print or commit a key. `ANTHROPIC_API_KEY` lives in `.env.local` for the scripts and as a Worker secret for talk, nowhere else.
- Game rules and other pure logic in tested modules apart from the drawing: the seed-to-system generator, the quadtree, the species sheet validator, the behaviour rules, the persona builder, the brain's chooser, the caps.
- Every scene starts from the tier, lowers itself, loads only when near, disposes when left. Phones ask before a heavy world downloads (`WORLD_MB`).
- A `nodes` module's folder makes no `ShaderMaterial`, no `onBeforeCompile`, no `EffectComposer` (`src/runtime/shading.test.js`). The runtime's `pickBackend` is unchanged.
- British spelling, curly quotes, plain sentences; comments say why.

## Architecture: four parts, in order

```
src/lib/tsl/            part 1: the shared shading library (TSL, with wgslFn/glslFn kernels)
src/runtime/            part 1: capabilities, the first-frame guard, compute through the gfx service
scripts/gpu-check.mjs   part 1: a nodes world drawn in headless Chromium on software WebGPU and on the fallback
src/components/uncharted/   part 2: the procedural star systems
src/components/life/        part 3: species sheets → bodies → rules; the talk library
workers/talk/               part 3: the Cloudflare Worker that holds the key
src/data/species/           part 3: the committed species sheets
scripts/species.mjs         part 3: designs a species with Claude, ahead of time
public/tiles/               part 4 (optional): baked terrain and imagery for the Travel page's places
```

### Part 1: the foundation

**`src/lib/tsl/`**, one file per family, each exporting TSL functions built with `Fn` from `three/tsl`, pure (no renderer), so a test can build the graph in Node and a browser check can compile it on both backends:

- `hash.js`: PCG and `hash21/31` (the GLSL ones in `lib/three/noise.js` ported).
- `noise.js`: simplex 2D/3D, `fbm(p, octaves, lacunarity, gain)`, `ridged`, `voronoi`, `warp` (domain warping).
- `sky.js`: `rayleighMie(dir, sun, radius, atmosphereRadius, density)` single scatter with a sunset band, ported from `galaxy/bodyShaders.js`'s shell so the two spaces converge; `blackbody(kelvin)`.
- `surface.js`: `matcap`, `triplanar`, `antiTile` (as `lib/three/surface.js`'s GLSL does), a `fresnel`.
- `post.js`: the universe's grade (contrast, saturation, split tone, vignette, grain) and an ordered dither as nodes, so a nodes world's picture matches the GLSL worlds' (`universe/post.js` is the reference image).
- `kernels/`: the hand-written WGSL, each as `{ wgsl, glsl?, tsl? }` through `wgslFn`/`glslFn`: `height.wgsl.js` (a planet's height function), `scatter.wgsl.js` (the atmosphere march), `nebula.wgsl.js`. A kernel declares what the fallback draws: its `glsl` twin, its `tsl` stand-in, or `null` (not drawn there).

**Runtime additions** (`src/runtime/`), all small:

- `rt.gfx.caps`: `{ compute: bool, indirect: bool, storageTextures: bool }`, true only on the WebGPU backend (`WebGLBackend` runs compute as transform feedback and refuses indirect dispatch; verified in three's source).
- `rt.gfx.compute(node, count?)`: `renderer.computeAsync` on WebGPU; on WebGL it throws, so a module checks `caps` and takes its CPU path.
- A module may declare `needs: 'webgpu'`. The runtime then shows `WorldHost`'s failed card with a plain line (“this world needs WebGPU; Chrome, Edge and Safari 26 have it”) rather than mounting on the fallback.
- **The first-frame guard.** Verified here: three r186 passes a texture-view `swizzle` that Chrome added in 143; on an older Chrome `init()` succeeds and the first draw throws. The runtime catches a throw in a module's first `draw`, treats it as a lost device (one downgrade, never a loop) and remounts on WebGL.
- `rt.gfx.post` learns the passes the nodes worlds want: `grade` (the universe's), `dither`, `flare` (three's `LensflareNode`), `gtao` (WebGPU only; the description says what the fallback does: skip).

**`scripts/gpu-check.mjs`**: as `autopilot-check.mjs`, but launching Chromium with `--headless=new --enable-unsafe-webgpu --enable-features=Vulkan,WebGPU --use-vulkan=swiftshader --use-angle=vulkan --ignore-gpu-blocklist --enable-unsafe-swiftshader`, loading each nodes route from an `http://127.0.0.1` origin (WebGPU is absent on `about:blank`), and once more with `?gpu=webgl`. It passes when `rt.gfx.backend` reports what was asked, a frame has non-black pixels, and the console has no error. It needs a Playwright whose Chromium is 143 or newer (this container's 1.56 build is 141): a dependency bump in the same PR, with `autopilot-check.mjs` run after it to show nothing else moved.

**The proving ground.** `src/runtime/fixtures/nodesWorld.js` exists for the shading test. The foundation adds a real nodes world at a development-only route, `/lab/gpu`: a sphere lit by `sky.js`, ground by `noise.js`, the grade from `post.js`, a compute pass that writes a storage texture when `caps.compute` and a CPU path when not, and a counter overlay. It is the thing the check script draws, the thing every later nodes world copies, and the pose the numbers are measured at.

### Part 2: the uncharted

**Where.** Fly out through the universe map's rim (`layout.js`'s `RIM`, 8,000 units out) and the map hands over (`rt.handover`) to the uncharted module with `{ seed, pose }`; the HUD says “uncharted space”. Each sector is a seed; `/uncharted/:seed` opens it directly and the share link is the seed plus a pose. Flying back past the sector's edge hands back to the map. The map's own planets, traffic, hunters and director are untouched.

**The generator** (`uncharted/system.js`, tested, no three): seed → one star (class, colour from `blackbody`, radius, a binary one time in six), two to nine planets on deterministic Kepler ellipses (as COSMOS), each with a kind (rocky, desert, ocean, ice, jungle, gas giant), radius, axial tilt, air (none, thin, thick), seas, rings one time in four, zero to three moons, and one belt one time in three. The same seed gives the same system on every machine; the test pins three seeds' systems as fixtures.

**From space** (`uncharted/space.js`): the star as a sprite with a flare through `rt.gfx.post`'s `flare`; planets as spheres with `sky.js`'s atmosphere shell, `noise.js` surfaces by kind, cloud decks as a second shell, rings as a disc with a shadow term; the belt instanced. Log-distance flight: the ship's speed scales with the distance to the nearest surface (COSMOS's rule), so crossing a system takes a minute and arriving takes a minute. A **floating origin**: the world is re-centred on the ship whenever it is 10,000 units out, with positions kept in doubles on the CPU; the renderer takes `logarithmicDepthBuffer` (an option on three's common `Renderer`).

**Down to the ground** (`uncharted/terrain.js`, tested; `uncharted/ground.js`): a cube-sphere, each face a quadtree of 33×33 chunks split by screen-space error until ~5 m spacing at the lowest level (COSMOS's numbers; Kosmos's near and far tiers are the top and bottom of this tree). Heights come from `kernels/height.wgsl.js`: on WebGPU a compute pass writes a chunk's height and normal into a storage texture (Kosmos's generator shaders, as compute); on the fallback a worker runs the same function in JavaScript (the kernel file exports it three ways, and a test asserts the WGSL and the JS agree on a grid of samples). Chunks are pooled and recycled (DRIFTWING) so streaming never hitches. Seas are a sphere at sea level with `sky.js`'s fresnel; the ground's near detail is `surface.js`'s triplanar and antiTile. The ship can fly to a few metres; walking is part 3's concern, through `footScene`'s locomotion when the ground is ready.

**Quality.** `high`: 5 m chunks, clouds, the scatter march at full steps, GTAO. `mid`: 10 m, clouds, half the steps, no GTAO. `low`: 20 m, no clouds, the analytic sky, no post but the grade. The pace steps the pixel ratio; `lowerQuality` drops the march steps, then the clouds. The module's `mb` is small (no textures; everything is generated), which is the point.

### Part 3: the living worlds

**Species, designed ahead.** `scripts/species.mjs` (Node, the Anthropic SDK, the key from `.env.local`, never committed) takes a seed and a biome and asks Claude for a species sheet as structured output against `src/components/life/sheet.js`'s schema (tested validator): `{ name, plan, size, limbs: [{ kind, count, where }], palette, gait, temperament, diet, call, biome, blurb }`, where `plan` is one of six body plans (crawler, strider, flier, swimmer, drifter, rooted). The sheet is committed to `src/data/species/<id>.json`. The script runs on the owner's machine, as the Meshy and gen3d scripts do; a session without the key opens an issue the way gen3d's does.

**Bodies, built at runtime** (`life/body.js`): a plan is a parametric builder (a spine of capsules, limbs by the sheet, a head, the palette as vertex colour), rigged with `lib/three/rig.js`, gaits from `lib/three/ik.js` picked by speed; a herd is one instanced draw per species with the gait phase in the material's position node (TSL), so a hundred animals cost one call. The reference is `majidmanzarpour/threejs-procedural-animals` (MIT): its idea is copied, not its code, because its coats are WebGL shaders a nodes world cannot carry.

**Behaviour, by rules** (`life/rules.js`, tested): graze, flock, flee, approach when curious, call and answer, sleep at night; the sheet's temperament sets the thresholds. On WebGPU a herd past 200 runs flocking in compute (`kernels/flock.wgsl.js`); on the fallback the herd stays under 200 and flocks on the CPU.

**Talk** (`src/components/life/talk/`):

- `persona.js` (tested): builds the system prompt from a persona sheet: who they are, where they are, what they know (the site's data for a crew member, the species sheet and the planet for an alien, the world's facts for a shopkeeper), what they never say (sequel-trilogy content, copied dialogue past a short famous line, anything about the visitor the site does not have), the voice (short lines, in character, British spelling), and the output shape.
- `brain.js` (tested): the chooser. `remote` when the Worker answers within 800 ms of the first byte, else `local` when the visitor switched it on and the model is loaded, else `baked`. Every tier returns the same `{ say, mood, action }`.
- `remote.js`: POSTs `{ persona, transcript, said }` to the Worker; keeps the transcript in the tab (session storage), never a key; shows the reply as it streams.
- `local.js`: WebLLM behind a dynamic import, desktop with WebGPU only, opt-in from a settings line that says the download (SmolLM2-360M, 204 MB), the persona's prompt the same.
- `baked.js`: the lines the crews already have (`scripts/voices/lines.json`), picked by `rules.js`'s situation.
- The reply's `mood` moves the face (the cockpit crews have rigs; an alien's sheet has a call) and `action` is one of a short list the world knows (wave, point, turn away, follow).

**The Worker** (`workers/talk/`, Cloudflare, deployed by the owner): `ANTHROPIC_API_KEY` as a secret; allows only the site's origins; per-IP (40 a day) and global (2,000 a day) caps in KV; the persona's system prompt with `cache_control` so repeat turns cost cache reads; the model from an environment variable, `claude-opus-5-5` by default (the owner may choose a cheaper one: Sonnet 5.5 is about half the price a line, Haiku 4.5 a quarter); `output_config.format` for the `{ say, mood, action }` JSON; `fallbacks: "default"` so a safety refusal still gets a line; streaming to the page. Cost per line on Opus with a cached ~600-token persona and ~120 tokens out is about $0.003, so the global cap bounds the day at about $6; the free Worker tier covers the requests.

**Where talk shows first.** In the uncharted, at the first landing: a curious species comes up and can be spoken to. Then the hangar's crews (`cockpit/crew.js`), who already have recorded lines as their floor. Then the Citadel's Ricks.

### Part 4 (optional, the owner's call): Earth from above

OpenSkyFlight's idea on this site's terms: not live tiles, but baked ones for the Travel page's places. `scripts/tiles.mjs` fetches, ahead of time, Terrarium elevation (AWS Open Data, no key) and EOX Sentinel-2 cloudless imagery (CC-BY 4.0) for a box around each place at zoom 11 to 13, writes WebP, and commits them under `public/tiles/<place>/` with credits. The Travel globe gets a “fly it” on each place that hands over to a nodes world (`earth/flight.js`) that decodes the heights in the position node (OpenSkyFlight's formula), tiles in a quadtree with concentric LOD, and flies the same ship. Budget: about 1.5 MB a place at zoom 12 (64 tiles × two layers), so fifteen places are about 20 MB on disk, each loaded only when flown, behind `WORLD_MB`.

## Data flow

```
seed ──► system.js ──► space.js (orbits, shells)        ──► rt.gfx (WebGPU | WebGL fallback)
              │                                              ▲
              └──► terrain.js (quadtree) ──► height kernel ──┘ (compute → storage texture | worker → buffer)

species sheet (committed JSON) ──► body.js ──► instanced herd ──► rules.js (CPU | flock kernel)

said ──► brain.js ──► remote.js ──► Worker ──► Claude ──► { say, mood, action } ──► face, speech, captions
                  └─► local.js (WebLLM) ─┘
                  └─► baked.js (lines.json)
```

## Error handling

- WebGPU missing: `pickBackend` gives WebGL; a `needs: 'webgpu'` module shows the card. WebGPU present but the first frame throws: the guard downgrades once. A device lost later: the runtime's existing path.
- A kernel without a fallback on WebGL: the module draws its stand-in; never a blank. The check script runs both backends so a missing stand-in fails CI.
- The Worker down, slow or capped: `brain.js` falls through within 800 ms; the visitor sees a baked line, never a spinner. A refusal: the server-side fallback answers; if that refuses too, a baked line.
- A species sheet that fails the validator never ships: the script refuses to write it.
- A seed's system is deterministic; a bad seed (NaN, empty) falls back to the home sector's seed.

## Testing

- Pure modules first, tests first: `system.js` (three pinned seeds), `terrain.js` (split and merge against a camera, chunk counts by tier), the height kernel's JS twin against its WGSL on a sample grid (the check script reads the storage texture back), `sheet.js` (valid and invalid sheets), `rules.js` (a herd grazes, flees a ship, calls back), `persona.js` (the prompt holds the rules and nothing about the visitor), `brain.js` (the 800 ms fall-through, the order), the Worker's caps (a Node test over the handler with a fake KV).
- `shading.test.js` keeps every nodes module honest; a new test asserts every kernel file exports the three forms or says `null` for the fallback.
- `scripts/gpu-check.mjs` on both backends for every nodes route, in CI with the other checks.
- Fixed poses and renderer counts per checkpoint, as the universe visuals lane does (`scripts/universe-check.mjs` is the pattern), on `high`, `mid` and `low`.

## Sequencing (each a PR of its own, merged on its own)

1. **Foundation A**: `src/lib/tsl/` (hash, noise, sky, surface, post) with tests; the Playwright bump; `scripts/gpu-check.mjs`; `/lab/gpu` drawing on both backends; the first-frame guard; `caps` and `compute`. The plan is written: `docs/superpowers/plans/2026-10-06-webgpu-foundation.md`.
2. **Foundation B**: the kernels (`height`, `scatter`) in WGSL with their twins, compute into a storage texture on `/lab/gpu`, readback compared with the JS twin.
3. **Uncharted 1**: `system.js`, the sector hand-over from the map, the system from space (star, planets with air, orbits, the belt), the share link.
4. **Uncharted 2**: the quadtree terrain, the floating origin, flight down to a few metres, seas, clouds.
5. **Life 1**: `sheet.js`, `scripts/species.mjs`, the first six sheets committed, `body.js` and `rules.js`, a herd on the uncharted's first landing.
6. **Talk 1**: `persona.js`, `brain.js`, `baked.js`, the Worker with caps (deployed by the owner), `remote.js`; the alien at the landing speaks; then the hangar crews.
7. **Talk 2** (if wanted): `local.js` with WebLLM behind opt-in.
8. **Earth from above** (if wanted): `scripts/tiles.mjs`, the baked places, `earth/flight.js`.

Each later PR starts from the hand-off's “Left” list and ends by updating it.

## Risks

- **Browser coverage.** WebGPU is in Chrome, Edge and Safari 26; Firefox's coverage is partial. The fallback is the answer for everything but compute; the uncharted's terrain works on both (compute or worker), so no visitor is shut out of part 2.
- **three r186 against older Chrome** (the `swizzle` field): the guard. Also a reason to keep three current.
- **Cost of talk.** Bounded by the caps; the owner sets the model and the caps in the Worker's variables.
- **Performance on phones.** The uncharted is generated, so bytes are small, but the scatter march and the terrain are GPU-heavy; `low` draws the analytic sky and 20 m chunks, and phones ask first.
- **Scope.** Four parts is a season of work. The sequencing keeps every PR shippable on its own; parts 3 and 4 wait on the owner's answers.

## Open questions for the owner

1. **“Trip”**: which project is meant? (Candidates in the research note.)
2. **The talk Worker**: is one outside piece of infrastructure (a Cloudflare Worker holding the Claude key, with caps) acceptable for conversation? If not, talk is baked lines plus the optional on-device model only.
3. **The model and the caps** for talk: `claude-opus-5-5` at about $0.003 a line, or Sonnet 5.5 or Haiku 4.5 cheaper; 2,000 lines a day as the global cap?
4. **Earth from above**: worth about 20 MB of baked tiles for the Travel places, with CC-BY Sentinel-2 imagery, or leave it?
5. **Where the uncharted begins**: past the map's rim (the design's choice), or as its own front-door world?

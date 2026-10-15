# The world runtime

Date: 2026-10-06. Status: approved design; the first world (Earth) moves in the same session. The plan is `docs/superpowers/plans/2026-10-06-world-runtime.md`; the hand-off for the sessions that move the other worlds is `docs/superpowers/HANDOFF-runtime.md`.

## Why

Every full-screen world on the site (the universe map, the galaxy and its surfaces, and the eleven hidden worlds) makes its own renderer, reads the keyboard and the gamepad its own way, opens its own sounds, keeps its own saves and fixes the same problems (shader warm-up, firing lag, texture uploads) in its own file. Moving between two of them is a route change: the old canvas is torn down, the new one is made from nothing, and the screen fades to black in between. The research in `docs/research/2026-10-04-webgl-portfolios.md` says to share a canvas once an effect must cross sections; flying from space, through the air, onto a world's ground is that effect.

This design gives the site one world runtime: one renderer (WebGPU where the browser has it, WebGL otherwise), one frame loop, one input reader, one audio bus, one save store, one asset cache and one quality controller. Each world becomes a module that plugs into it. Two modules can hand over to each other without a cut.

## What it is not

- Not for the page scenes. The ambience layer, the project stages, the cartridges, the travel globe and the contact plane stay on `lib/three/useScene`: they scroll with the page in their own boxes, which the research doc shows is right for them.
- Not a rewrite of any world's gameplay. The universe map's crashes into planets, the fall into the Maw, the hunters, the traffic, the director's events (set pieces, supernovae, meteors, leviathans, rifts, bounty hunters, the Citadel's siege, the trench), the landings on foot: all of it stays as it is, inside the universe module. Migration moves a world's renderer, loop, input, audio, saves and assets onto the runtime. It does not touch what the world does.
- Not multiplayer. The Nostr rooms (`universe/online/`, the towns' travellers) stay React hooks that hand a module its `net`. The runtime may own them later; nothing here depends on it.

## The shape

```
src/runtime/
  index.js        the public surface: runtime(), useWorld, WorldHost, fromScene
  runtime.js      createRuntime(): the services, mount/handover/unmount, the loop
  backend.js      pickBackend(): which renderer to make, and why (pure)
  webgl.js        the WebGL backend: WebGLRenderer, EffectComposer passes
  webgpu.js       the WebGPU backend: WebGPURenderer (three/webgpu), PostProcessing (three/tsl)
  gfx.js          what a module sees of the renderer: compile, upload, snapshot, post
  input.js        createInput(): keys, gamepad, pointer and the touch stick as one snapshot (pure)
  quality.js      createQuality(): tier, budget, the pace and the watchdog as one level (pure)
  saves.js        createSaves(): local and session storage with versions (pure)
  assets.js       createAssets(): the caches, a prefetch queue and retention (pure core)
  audio.js        createAudioBus(): a gain per module on the site's one context
  handover.js     the timeline of a handover between two modules (pure)
  module.js       the module contract, validated; fromScene() wraps today's scene modules
  useWorld.js     the React hook a page uses to put a module on the runtime
  WorldHost.jsx   the box a module draws in, with the 3D-first statuses
  runtime.css
```

One runtime per page visit. `runtime()` makes it the first time a world asks and keeps it: it outlives every route. Its canvas is one `<canvas class="world-canvas">` that the runtime moves into whichever module's host box is mounted (a canvas keeps its context when it is moved in the DOM; it loses it only when it is dropped). So a route change from one world to another does not make a renderer, and a handover can keep drawing through the change.

## The module contract

A world module is a plain object:

```js
export default {
  id: 'earth',             // unique; the saves and the events are namespaced by it
  shading: 'glsl',         // 'glsl' (ShaderMaterial, onBeforeCompile, EffectComposer) or 'nodes' (TSL only)
  mb: 2,                   // what it downloads, for the phone gate (today's WORLD_MB)
  label: '…',              // optional: what the canvas shows, for a screen reader (role="img")
  create(rt, props),       // → World, or a promise of one
};
```

`create` gets the runtime and the page's props and returns the world:

```js
{
  ready,                   // optional promise: its shaders are compiled (rt.gfx.compile); the first frame waits for it, 4 s at most
  resize(w, h),            // the host box's CSS size
  step(dt, input, now),    // optional: the simulation, dt in seconds clamped to 0.05; input is rt.input's snapshot
  draw(frame),             // draw one frame; frame is { dt, now, renderer, quality }
  wants(),                 // optional: true while it needs frames (a world at rest costs nothing)
  update(props),           // optional: new props from the page
  setVisible(on),          // optional: the box came on or went off screen
  lowerQuality(level),     // optional: the quality level changed (0 is sharpest)
  warmUp(timeLeft),        // optional: draw everything once out of sight, a slice at a time; true once done
  handoff(),               // optional: plain data for the module taking over (a pose, a planet, a seed)
  dispose(),
}
```

`fromScene(create)` wraps a scene module written for `useScene` (`create(canvas, ctx)` returning `render(ms, now) → bool`) into this contract without changing it: `render` becomes `step` and `draw`, its return value `wants()`, `ctx.invalidate` the runtime's kick. A world moves in two steps, the wrap first, the services after, and the wrap alone is a working migration.

A module is validated when it is mounted (`module.js`'s `validateModule`): a missing `id`, `create` or `draw` is an error at once, in development and in production, because a half module would otherwise fail on its first frame.

## The services

`rt` is the runtime. Every service is made once and shared.

### rt.gfx

```js
rt.gfx.backend      // 'webgl' | 'webgpu'
rt.gfx.renderer     // the three.js renderer (WebGLRenderer or WebGPURenderer)
rt.gfx.canvas
rt.gfx.size         // { w, h } in CSS pixels
rt.gfx.ratio        // the pixel ratio in use (the quality controller sets it)
rt.gfx.compile(root, camera, scene?, target?)   // lib/three/renderer's precompile, on either backend
rt.gfx.upload(root)                             // every texture under root sent now
rt.gfx.post(passes)                             // a post chain for this backend (below)
rt.gfx.snapshot()                               // the last frame as a 2D overlay, for a handover
rt.gfx.lost                                     // the context is gone
```

Post-processing: `rt.gfx.post` returns `{ render(scene, camera), setSize, dispose, passes }`. On WebGL it is an `EffectComposer` with the passes the module asked for (render, bloom, output, a shader pass). On WebGPU it is a `PostProcessing` node graph built from the same description (`three/tsl`'s `pass`, `bloom`). A module describes its chain as data (`[{ kind: 'render' }, { kind: 'bloom', strength, radius, threshold }, { kind: 'output' }]`) so the backend builds it. A `{ kind: 'shader', material }` pass is GLSL and marks the module `shading: 'glsl'`.

### rt.quality

One controller for the runtime, replacing a scene's own pace, watchdog and tier reads:

```js
rt.quality.tier      // 'high' | 'mid' | 'low' (lib/device, with ?quality= and tp-quality as today)
rt.quality.budget    // lib/device's BUDGETS[tier]: ratio, antialias, samples, shadows, shadowMap, bloom, aniso, stars
rt.quality.level     // 0 (sharpest) … STEPS.length-1; the pace moves it, the watchdog floors it
rt.quality.scale     // the pixel-ratio scale for the level (pace.js's STEPS)
rt.quality.on(fn)    // fn(level) when it changes; returns the undo
rt.quality.frame(now)  // the runtime calls it once per drawn frame
```

The pace (`lib/three/pace.js`) decides the level from frame times; the renderer's pixel ratio follows `budget.ratio × scale`; a module that wants to shed effects listens with `on` or implements `lowerQuality`. The watchdog in `lib/three/renderer.js` stays as the floor: when the pace is at its last step and frames are still late, the module's `lowerQuality` is called once more with `level = STEPS.length` (the 'simplify' step today's `onSlow` meant).

### rt.input

A snapshot the runtime samples once per frame, before `step`:

```js
const input = rt.input.sample(now);
input.keys        // Set of KeyboardEvent.code held (never while typing in a field)
input.pressed     // Set of codes pressed since the last sample (one frame)
input.pad         // games/pad.js's readPad(), or null
input.tapped      // pad buttons pressed since the last sample
input.pointer     // { x, y, down, drag: { dx, dy } | null } in the host box, CSS pixels
input.stick       // { x, y } the touch stick (a page writes it with rt.input.setStick)
input.action(name) // true while any code bound to `name` is held
input.axis(name)   // -1…1 from a pair of actions, the pad's sticks or the touch stick
```

A module binds names once: `rt.input.bind({ throttle: ['KeyW', 'ArrowUp'], brake: ['KeyS', 'ArrowDown'], fire: ['KeyF'] }, { axes: { turn: ['left', 'right'] } })`. Bindings belong to the mounted module and are dropped with it. The universe map's flight settings (`universe/controls.js`) stay the module's: they turn the raw snapshot into its own stick, as today.

Keys are read on `window` while a module is mounted, with `games/pad.js`'s `typing` guard and no modifier combos; pointer events on the host box with `lib/pointer`'s capture; the gamepad through `readPad`. The runtime prevents the default on bound keys only, so the page's own shortcuts (⌘K, the guide) keep working.

### rt.audio

```js
rt.audio.context()        // lib/audio's one context, resumed (call it first in a gesture handler)
rt.audio.bus()            // a GainNode for this module, into the site's master; fades out and disconnects at unmount
rt.audio.output           // lib/audio's output (the master), for sounds that outlive a module
```

A module's `sounds.js` keeps its synthesis and connects to `rt.audio.bus()` instead of `output()`. Unmount fades the bus over 150 ms, so nothing clicks at a handover and no engine keeps running under the next world.

### rt.saves

```js
rt.saves.get(key, fallback)     // localStorage, JSON, never throws (lib/hooks's local)
rt.saves.set(key, value)
rt.saves.session.get / set      // sessionStorage (lib/hooks's storage)
rt.saves.watch(key, fn)         // fn(value) when this tab or another sets it; returns the undo
rt.saves.register({ key, version, migrate })  // optional: a key with a shape version
```

Keys stay what they are today (`tp-earth-stamps`, `tp-abq-driving`, `tp:universe-seat`, the lot): the store is a front, not a rename. `register` lets a key carry a version so a later change to its shape runs `migrate(old)` once instead of a guard in every reader.

### rt.assets

```js
rt.assets.texture(url, opts)   // lib/three/textures's loadTexture, cached per URL
rt.assets.gltf(url, opts)      // lib/three/gltf's loadGltf, cached per URL
rt.assets.audio(url)           // lib/audio's loadBuffer
rt.assets.prefetch(urls, { priority })  // fetch and decode ahead, idle uploads (textures.js's warm)
rt.assets.retain(url)          // keep across module changes (the ship models, the crew)
rt.assets.release(url)
rt.assets.stats()              // { cached, bytes, inflight }
```

The caches are today's (one texture or model per URL, shared across scenes). What the runtime adds is ownership: an asset a module loads is its own and is forgotten from the cache when the module is disposed, unless another module holds it or it was retained. A prefetch queue (`priority` 0 to 2, two in flight at a time, the rest in order) lets the page load the next world's models while the ship is on its way down.

### rt.events

```js
rt.events.emit(type, data)
rt.events.on(type, fn)   // returns the undo
```

A module tells the page what happened (`arrive`, `found`, `phase`, `prompt`) through events instead of an `onEvent` prop; `useWorld` forwards the mounted module's events to the page's `onEvent` for the ones that keep it. The HUD reads state through events at the rate the module emits them, never by rendering React every frame.

## Mount, handover, unmount

```js
rt.mount(module, props, host)                   // make it, put the canvas in host, start the loop
rt.handover(module, props, host, { fade = 600 }) // the next module takes over without a cut
rt.unmount()                                    // dispose the current module; the canvas stays
rt.current                                      // { module, world, status }
rt.status                                       // 'idle' | 'loading' | 'ready' | 'on' | 'failed' | 'slow' | 'lost'
rt.on(fn)                                       // status changes
```

A handover:

1. The page calls `rt.handover(next, props, host)`. The runtime asks the current world for `handoff()` and snapshots its last frame (`rt.gfx.snapshot()`: a 2D canvas over the host, drawn from the live canvas in the same task as that frame, so it needs no `preserveDrawingBuffer`).
2. The current world keeps drawing while `next.create(rt, { ...props, from })` runs and its `ready` settles (4 s at most). The next world's assets were prefetched already if the page asked.
3. The runtime disposes the current world, fades its audio bus, moves the canvas into the new host if it differs, and the new world draws under the snapshot while the snapshot's opacity goes to zero over `fade` ms.
4. The route changes whenever the page likes (before or after, with `replace`). The runtime does not know about routes.

Two worlds that share a backend could draw into one frame instead of fading; the snapshot is chosen because it costs one `drawImage`, works between backends (a GLSL world handing over to a nodes world) and needs nothing from either module beyond `handoff()`. A module that wants more continuity gets it from the handoff data: the surface starts its landing at the height and heading the galaxy handed it, under the same sun, and the fade happens inside the cloud layer where nothing is sharp.

Status follows `useScene`'s: `loading` while the module is made, `ready` once it can draw, `on` after its first frame (the page hides its fallback), `failed` on a thrown frame, `slow` never (3D first), `lost` on a context loss (one retry when the module is mounted again). A WebGPU device lost is a context loss too, and the runtime's next mount makes a WebGL backend: one downgrade, never a loop.

## The frame

One `lib/three/loop.js` chain for the runtime. Each frame, while the host is on screen, the tab is visible and nothing covers the page (`html[data-covered]`, as `useScene`):

1. `input.sample(now)`
2. `world.step(dt, input, now)` if it has one
3. `world.draw({ dt, now, renderer, quality })`
4. `quality.frame(now)`; a new level sets the pixel ratio and tells the world
5. the snapshot overlay's fade, if a handover is on
6. another frame if `world.wants()` is true, or anything kicked `rt.invalidate()`

`dt` is real time clamped to 50 ms (a tab coming back does not leap). A frame that throws stops the world and sets `failed`, as `useScene` does today.

## Backends

`pickBackend({ gpu, module, override, lost })` is pure:

- `override` from `?gpu=webgl|webgpu` in the address or `tp-gpu` in localStorage wins.
- `'webgpu'` only when `navigator.gpu` exists and the module's `shading` is `'nodes'`.
- `'webgl'` otherwise, and always after a WebGPU loss.

The WebGPU backend makes `WebGPURenderer` from `three/webgpu` with `antialias` from the budget and `forceWebGL: false`, calls `await renderer.init()` before the first frame, and runs its post chain through `three/tsl`'s `PostProcessing`. The WebGL backend is today's `lib/three/renderer.js` `createRenderer` with its watchdog turned into `rt.quality`'s floor. Both give a module the same `rt.gfx`.

A module's `shading` is a promise it has to keep: a `'nodes'` module must not import `EffectComposer`, construct a `ShaderMaterial` or `RawShaderMaterial`, or set `onBeforeCompile`, because `WebGPURenderer` cannot run them. `src/runtime/shading.test.js` reads each `'nodes'` module's folder and fails on any of those. Every module is `'glsl'` until its world's shaders are ported to TSL in its own session (the counts are in the hand-off: about 130 files with a `ShaderMaterial`, 60 with `onBeforeCompile`, 30 with a composer). The site therefore ships on WebGL first with the WebGPU path built, tested with a nodes-only fixture module, and switched on world by world as each is ported.

Two backends cannot share a canvas. If a `'nodes'` world hands over to a `'glsl'` one on a WebGPU runtime, the runtime makes a second canvas and a WebGL backend for it, keeps both (the idle one hidden), and the snapshot fade covers the switch. That case exists only during the migration; it is handled so a half-migrated site never cuts to black.

## Quality

Nothing changes for the visitor: `lib/device` sorts the device once, `?quality=` pins a tier, every module starts from its budget and the pace softens the picture when frames come late. What changes is where it lives: one pace for the runtime instead of one per scene, and the pixel ratio set in one place. A module reads `rt.quality.budget` where it read `budget()` and `rt.quality.level` where it kept its own.

Phones keep the download gate: `WorldHost` holds a module (`lib/gpu`'s `Hold3D`) until the visitor says yes, exactly as `WorldGate` does, with the module's `mb`.

## Seamless travel

The galaxy's landing is the first use, after Earth:

1. The galaxy module tells the page `{ type: 'approach', system }` when the ship is near a planet it can land on. The page prefetches the world's site assets (`rt.assets.prefetch(surfaceAssets(site), { priority: 1 })`).
2. On `E`, the galaxy module flies the ship down: the camera goes into the atmosphere while the planet fills the view (today's fade-to-black's 1.5 s, drawn instead of faded), and emits `{ type: 'land', system, pose }`.
3. The page calls `rt.handover(surfaceModule, { system, from: handoff })` and `navigate` with `replace`. The surface module starts with the ship at the height, heading and time of day handed over, inside the cloud layer; the snapshot fades over 600 ms while clouds go by.
4. Take-off is the reverse: the surface module climbs out, hands over the pose, and the galaxy module starts with the ship climbing out of the atmosphere over the planet.

The universe map's landing is already seamless (one scene: flying down into a planet's air, `entry.js`, onto its landing, `footScene.js`): it stays as it is inside the universe module. The universe's gate into the galaxy becomes a handover too, once both are modules.

## Earth, the first world

Earth (`src/components/earth/`) is the first module because it already has the whole journey in miniature (orbit, the dive through the air, the plane over the ground), one custom shader, online ghosts, saves, achievements, sounds, keys, a pad and a touch stick, and no post chain; 2,800 lines in all.

The migration:

- `earth/module.js` is the module: `id: 'earth'`, `shading: 'glsl'`, `mb: 2`. `create(rt, props)` makes the scene with `rt.gfx.renderer` (`scene.js`'s `createEarth` takes a renderer instead of a canvas) and owns the flight: what `EarthWorld.jsx` runs in `useFrameLoop` today becomes `step(dt, input)`, reading `rt.input` for the keys, the pad and the stick. The sim state (`sim`) moves with it. `dive`, `rise`, `goTo`, `toggleSun`, `toggleCam`, `setTarget` are methods on the world; the HUD's numbers and the mode come out as events (`hud`, `mode`, `postcard`, `stamp`) at the rate the component throttled them before.
- `EarthWorld.jsx` keeps everything a visitor sees (the labels, the HUD, the passport, the postcards, the touch controls, the online chip) and mounts the module through `useWorld`. The touch stick writes `rt.input.setStick`. Sounds connect to `rt.audio.bus()`. The stamps and the flown distance go through `rt.saves` with their keys unchanged.
- `pages/Earth.jsx` is unchanged.
- Nothing is lost: the dive on first arrival, the sun modes, the cockpit, the barrel roll, the passport and postcards, the flight log and the route home, the round-the-world and passport achievements, the ghosts, the engine and the rush, the `__EARTH__` dev hook for the QA scripts.

## Testing

Pure modules carry Vitest tests beside them, as the rest of the site: `backend.test.js` (every pick), `input.test.js` (keys, typing guard, pressed-for-one-frame, actions and axes, the stick), `quality.test.js` (the level from frame times, the floor), `saves.test.js` (fallbacks, versions and migration, watch), `assets.test.js` (the queue's order and concurrency, ownership and retention with stub loaders), `handover.test.js` (the timeline: the snapshot's fade, the old world drawing until the new one is ready, the cap), `module.test.js` (validation, `fromScene`), `shading.test.js` (the nodes promise, read from the files), and `runtime.test.js` with a fake backend (mount, handover, unmount, status, the frame order, a thrown frame).

In the browser: `node scripts/autopilot-check.mjs --only smoke --routes /earth` must pass (software WebGL, a canvas drawn, no console error), and the `__EARTH__` dev hook still drives the QA scripts. Every migration ends with the same two checks plus the world's own check script where it has one.

## Rollout

One world per session, in this order, each merged on its own: the galaxy and its surfaces (the headline: the seamless landing), the universe map (the hub; `fromScene` first, the gimmicks untouched, the gate into the galaxy as a handover last), the Death Star, Dot Matrix (its dither is a post pass: the first `kind: 'shader'` pass), Invincible, Avengers HQ, Albuquerque, Dimension C-137 with the Citadel, Middle-earth, Cybertron, Scranton, the music room, the Caribbean. Then the TSL ports, world by world, each flipping its module to `'nodes'` with the guard test green. The hand-off has the steps and the checks for each.

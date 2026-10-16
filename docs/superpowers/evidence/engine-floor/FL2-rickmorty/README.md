# FL2, the Rick and Morty worlds: the first pull request

Session `session_018hxbif6MyBRqJUTqE5XcJb`, branch `claude/engine-floor-fl2-rickmorty`, from the spec branch with `origin/main` merged (last at `1467c2b5`, with P4’s #993 and FL0’s #1007).

## What moved

| world | routes | before | after |
| --- | --- | --- | --- |
| the Citadel | `/c-137/citadel` | `citadel/scene.js` on `lib/stage3d`’s `createStage` (its own `WebGLRenderer`, composer, watchdog, lost-context path), `CitadelWorld.jsx`’s `useFrameLoop` | `citadel/module.js` on the runtime (`useWorld`, `rt.gfx.renderer`, `rt.gfx.post`), the walk’s frame run by the module’s draw |
| C-137’s world | `/c-137`, `/c-137/:planet` (the small planets; a big one was the runtime’s already, `planets/RmSurface.jsx`) | `world/scene.js` on `createStage`, `RmWorld.jsx`’s `useFrameLoop` | `world/module.js`, one module a landing (`rmWorldModule(planet)`) |

`rickmorty/stage.js` is `lib/stage3d`’s picture with its face, on the runtime’s renderer: the runtime’s chain (`rt.gfx.post([render, bloom, output, shader GRADE])`) with `lib/stage3d`’s multisampled half-float buffers, the ink pass inserted as before, the buffers sized at the stage’s ratio times the world’s sharpness at the next frame drawn. What the stage sets on the shared renderer (the Neutral tone at the stage’s exposure, shadows, `info.autoReset`, the clear) is set round each of its calls and given back (`hold`, `giveBack`); what a scene sets itself (houseOn) is set between the two and kept. The watchdog’s ladder (sharpness, shadows, bloom, sharpness again) is `lowerQuality(level)`’s, under the runtime’s governor. `pageFrame(stage, ref)` runs the page’s frame as the world’s draw, a frame begun anew on 16 ms as `useFrameLoop` began it (without it the world ran a frame out against main). Both modules are `calibrate: false` (the runtime’s walk through the pace’s steps would draw a world softer before it was seen, which `lib/stage3d` never did) and draw softer through their own buffers (`sharpness: 'own'`), but at the low tier, where the stage draws straight to the canvas and the canvas’s size is the only sharpness there is.

Every file under `world/` and `citadel/` takes `hot`, `canvasTexture` and `disposeTree` from `../stage`.

## What hasn’t, and why

`/c-137` draws four pictures at once (the backdrop, the world, the cruiser, Portal panic’s section), up to six with a place open over the world (Roy, the sewer, a second Portal panic) and the wardrobe. The runtime held one world until Middle-earth’s FL2 session added `runtime/views.js` (one renderer drawing several boxes, one `useWorld` a page; on `claude/engine-floor-fl2-middleearth`, not merged yet). The rule for two pictures (written into `useWorld.js`’s header by the universe map’s session): a copy is one module with one canvas; a picture of its own is a second view. So Roy, the sewer and Portal panic (`createStage` still, `lib/stage3d`), the cruiser (`cruiser3d.js`), the backdrop (`GalaxyBackdrop.jsx`) and the wardrobe’s preview (`wardrobe/preview.js`) keep their own renderers until `views.js` is on main, and come over as views in the second Rick and Morty pull request of FL2. The swirl (`swirl.js`) is no three.js renderer: one raw WebGL context painting every portal’s 2D canvas on change (lane P8’s `shownLoop`), a copy, and it stays one. `lib/stage3d.js` stays while Middle-earth, the Caribbean, the music room, Cybertron, Albuquerque and Rick and Morty’s three places use it.

## The pixel gate

Two of `scripts/autopilot-check.mjs`’s shots of the same build never match (a live page after eight seconds of wall time, then a lossy WebP), so the gate is shot with `tools/still.mjs`, on each build’s `vite preview`:

- time runs while the page loads (C-137’s fetch is paced by the clock: held still, it held at 0 %) and stands still from the moment the last loading veil is done, seen in the page itself, where the stepping starts too: from there the script steps the frames, 16 ms each, 150 of them, and a frame the browser was asked for before and gave after is moved on to them;
- `Math.random` seeded, and seeded again when the stepping starts;
- no sound either side (a sound’s noise is drawn from `Math.random` a sample at a time, the Citadel’s hum tens of thousands of them, and when it’s made against a frame’s sparks is a promise’s timing);
- no CSS animation or transition;
- the grade’s grain (the one program with both `uTime` and `uGrain`) held at 0;
- the Citadel shot as a returning visitor (`tp-citadel-at` at the start): a first visit opens with a portal’s sparks;
- 960 × 600, PNG, `tools/diff.mjs` counting every pixel that differs, no tolerance.

Main against `origin/main` at `1467c2b5`, built; the branch at its head, built; two shots each:

| route | main × main | branch × branch | main × branch |
| --- | --- | --- | --- |
| `/c-137/citadel` (against main with the curve’s font wait, below) | 0 | 0 | 0, 0 |
| `/c-137` | 2,464 | 3,155 | 0 (b2 × a2), 2,436 (b1 × a1) |
| `/c-137/pluto` | 0 | 0 | 0, 0 |

On `/c-137` the only pixels that differ between any two shots, main’s or the branch’s, are a visitor walking in at the left edge of the street, whose figure is in the picture from the frame its model has come down (`world/visitors.js`), and the pair that agrees on it agrees on every pixel.

**One repair changes pixels, and it is said here.** The Central Finite Curve’s band over the concourse (`citadel/curve.js`) is painted with its words in Orbitron, the face the Citadel’s page loads for itself, and whether the face had arrived when the band was painted was a race: on main it lost in the shot (the band’s words in the fallback face), on the runtime’s path it won. The scene now waits for the face (three seconds at most) before it paints (`citadel/scene.js`), so the band is in the face it asks for. Main with that one wait added (its own build, `wt-main` plus the three lines) against the branch is 0 pixels, so the move changes nothing; the wait alone against main is 90,964 pixels, the band’s letters and their glow (`shots/citadel-main-without-the-font-wait.webp` against `shots/citadel.webp`).

How it was found (the probes stay in the tool): the scene’s clocks read from their uniforms, equal; the random numbers drawn, equal once sound was off; the renderers’ state through three’s devtools hook, the same; the scene’s groups hidden in halves on both sides (`--tweak`, on the dev servers, where `window.__CITADEL__` reaches the scene) until the one left, the band, and its painted texture read back: two faces.

`shots/` keeps one picture a route.

## The probe

`scripts/perf-probe.mjs c137` against each build’s `vite preview`, `VIEW=960x600@1` (the default 1470 × 956 at 2 timed out on main in software at 300 s), the container’s SwiftShader:

PROBE_TABLE

The WebGPU rows are the owner’s machines’ and are left empty; these worlds are `'glsl'` until FL3.

## Checks

- `npm run lint`: clean.
- `npm test`: 16,135 passed, 6 skipped, 2 failed under the load of the stills running beside it (`scripts/lib/bf2017-hulls.test.mjs`’s capital budget and `middleearth/towns/moria/layout.test.js`’s fork, at 5.2 s); both pass alone (56 of 56). The Rick and Morty and runtime suites: 1,074 passed.
- `npm run build`: built.
- `node scripts/health.mjs --check --skip build`: every metric in budget but `boundary-breaks`, 489 over 481, and `origin/main` at `1467c2b5` is at 489 too (`lib/land` reaching into `galaxy/surface`); this branch adds none and removes none. `renderers` 16 and `loops` 58, as on main: the renderer the two worlds made was `lib/stage3d.js`’s one site, which Middle-earth, the Caribbean, the music room, Cybertron, Albuquerque and Rick and Morty’s three places still make, and their loop was `lib/hooks`’ `useFrameLoop`, which the measure doesn’t count; the four Rick and Morty sites it counts (`GalaxyBackdrop.jsx`, `cruiser3d.js`, `wardrobe/preview.js`, and `lib/stage3d.js` through the places) go with the second pull request.

## Known, carried on

- The frame guard isn’t told the stage’s buffers are the frame (`lib/stage3d` registered them; the runtime’s `createWebGL` doesn’t take `frames`, and `lib/three/frameGuard.js` isn’t this lane’s): at full sharpness they’re the canvas’s size and gated as before; drawn softer, a material not yet ready draws unheld. Middle-earth’s branch adds `guardOf(renderer).frames(fn)`; the second pull request takes it.
- The runtime’s loop paces these worlds (an even 30 when 60 can’t hold with nothing left to lower), where `useFrameLoop` ran every beat. It is the runtime’s rule for every world.
- C-137’s world keeps its own pace (`createPace`, the stage’s `scale`) beside the governor’s ladder, as it kept it beside `lib/stage3d`’s watchdog.

## Tools

- `tools/still.mjs`: the still (`--dist`, `--routes`, `--frames`, `--idle`, `--size`, `--local`, `--wait`, `--phone`, `--quality`, `--scroll`, `--tag`).
- `tools/diff.mjs`: two pictures pixel for pixel, the count and a picture of where.

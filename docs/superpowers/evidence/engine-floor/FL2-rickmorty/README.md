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

Two of `scripts/autopilot-check.mjs`’s shots of the same build never match (a live page after eight seconds of wall time, then a lossy WebP), so the gate is shot with `tools/still.mjs`:

- time runs while the page loads (C-137’s fetch is paced by the clock: held still, it held at 0 %) and stands still from the moment the last loading veil is done, seen in the page itself; then the script steps the frames, 16 ms each, 150 of them, the timers on real time;
- `Math.random` seeded, and seeded again when the stepping starts;
- CSS animations and transitions off;
- the grade’s grain clock (the one program with both `uTime` and `uGrain`) held to the stepped time: it counts 16 ms for every frame loop begun again while the page loads, and how many there are is the machine’s;
- the Citadel shot as a returning visitor (`tp-citadel-at` set to the start): a first visit opens with a portal’s sparks, thrown at random while the page is still loading;
- 960 × 600 (the same both sides; quicker in software), PNG, `tools/diff.mjs` counting every pixel that differs, no tolerance.

Main against main still differs now and then: a shader whose clock is the frames it was drawn (the Citadel’s portal column, Morty’s walk) runs a frame out when a frame loop begins again during the loading. So each route is shot twice on main and twice on the branch, and the gate is that every shot of the branch is the same as a shot of main, to the pixel.

GATES_TABLE

`shots/` keeps one picture a route (the before and the after are the same file’s pixels).

## The probe

`scripts/perf-probe.mjs c137` against each build’s `vite preview`, `VIEW=960x600@1` (the default 1470 × 956 at 2 timed out on main in software at 300 s), the container’s SwiftShader:

PROBE_TABLE

The WebGPU rows are the owner’s machines’ and are left empty; these worlds are `'glsl'` until FL3.

## Checks

CHECKS

## Known, carried on

- The frame guard isn’t told the stage’s buffers are the frame (`lib/stage3d` registered them; the runtime’s `createWebGL` doesn’t take `frames`, and `lib/three/frameGuard.js` isn’t this lane’s): at full sharpness they’re the canvas’s size and gated as before; drawn softer, a material not yet ready draws unheld. Middle-earth’s branch adds `guardOf(renderer).frames(fn)`; the second pull request takes it.
- The runtime’s loop paces these worlds (an even 30 when 60 can’t hold with nothing left to lower), where `useFrameLoop` ran every beat. It is the runtime’s rule for every world.
- C-137’s world keeps its own pace (`createPace`, the stage’s `scale`) beside the governor’s ladder, as it kept it beside `lib/stage3d`’s watchdog.

## Tools

- `tools/still.mjs`: the still (`--dist`, `--routes`, `--frames`, `--idle`, `--size`, `--local`, `--wait`, `--phone`, `--quality`, `--scroll`, `--tag`).
- `tools/diff.mjs`: two pictures pixel for pixel, the count and a picture of where.

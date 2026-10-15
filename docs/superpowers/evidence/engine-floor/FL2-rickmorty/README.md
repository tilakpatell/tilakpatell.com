# FL2, the Rick and Morty worlds: where it stands

Session of 2026-10-15, branch `claude/engine-floor-fl2-rickmorty` (from `claude/engine-floor-spec`, `origin/main` merged at `f97079c7`; P8’s #991 is in main). No world has moved yet: the lane stopped at two blockers it can’t clear from the files it owns. Both are written down here so the next session (or the owner) can decide them.

## What draws on these routes today

Nine renderer makes (three `new THREE.WebGLRenderer`, five `createStage`, one already the runtime’s), plus the swirl’s raw WebGL context:

| what | made at | mounted by | route | loop |
| --- | --- | --- | --- | --- |
| the backdrop | `rickmorty/GalaxyBackdrop.jsx:28` | `pages/RickMorty.jsx:108` | `/c-137` | rAF on scroll and resize |
| C-137’s world | `world/scene.js:164` (`createStage`) | `world/RmWorld.jsx:1053` | `/c-137`, `/c-137/:planet` (not a big one) | `useFrameLoop`, `RmWorld.jsx:1301` |
| Portal panic | `portal/Portal3D.js:351` (`createStage`) | `portal/PortalPanic.jsx:108` | `/c-137` (its section, and the world’s place `portalpanic`) | its own rAF, `PortalPanic.jsx:338` |
| Roy | `world/roy/scene.js:894` (`createStage`) | `world/roy/Roy.jsx:10`, placed in `RmWorld.jsx:2036` | `/c-137`, planets | `useFrameLoop`, `Roy.jsx:524` |
| the sewer | `world/sewer/scene.js:26` (`createStage`) | `world/sewer/Sewer.jsx:12`, placed in `RmWorld.jsx:2048` | `/c-137`, planets | `useFrameLoop`, `Sewer.jsx:168` |
| the Citadel | `citadel/scene.js:101` (`createStage`) | `citadel/CitadelWorld.jsx:202` | `/c-137/citadel` | `useFrameLoop`, `CitadelWorld.jsx:681` |
| the cruiser | `cruiser3d.js:77` | `CruiserFlight.jsx:71` | `/c-137` | its own rAF |
| the wardrobe’s preview | `wardrobe/preview.js:38` | `wardrobe/Wardrobe.jsx:25` (while open) | `/c-137`, `/c-137/citadel` (and `/universe`) | `lib/shownLoop`, 30 fps |
| a big planet | the runtime (`galaxy/surface`, `fromScene`) | `planets/RmSurface.jsx:188` | `/c-137/:planet` (a big one) | the runtime’s |
| the swirl | `swirl.js:46` (`getContext('webgl')`, no three.js) | `PortalSwirl` (`PortalHero`, `CruiserFlight`) | `/c-137` | `lib/shownLoop` |

Live at once: on `/c-137` the backdrop, the world, the cruiser and Portal panic’s section (four), up to six with a place open over the world (Roy, the sewer, a second Portal panic: the world stays mounted under it) and the wardrobe; on `/c-137/citadel` the Citadel and the wardrobe while it’s open; on a small planet the world and a place over it.

## Blocker 1: the runtime holds one world

`createRuntime` keeps one `current` world (`src/runtime/runtime.js:104`), one loop and one host; `useWorld` mounts into it, and a second `useWorld` on the same page hands the first one over (disposes it). The design’s §4.3 rule for two pictures at once, “a second module in a second host … the runtime makes one renderer and the second module shares it as `handover` does”, names a capability the runtime does not have: `handover` is one world replacing another, not two drawing side by side. Lane P4’s #993, which owns `src/runtime/` until it merges, doesn’t add it either (its runtime files: `dynres.js`, `hud/`, `input.js`, `runtime.js` +9, `useWorld.js` +24).

So, by the §4.3 rule as it reads today:

- **One module, one canvas** (the swirl and the cruiser, which are copies over the page) would need the backdrop, the world, the cruiser and Portal panic drawn into one page-sized canvas. They are at different places on a scrolling page with the page’s text between them (the backdrop under the text, Portal panic in its own section further down): one canvas behind the text can’t be one in front of it, and the picture would change, which this lane may not do.
- **A second module in a second host** needs the runtime to draw several worlds a frame, each into its own host’s box (a scissored viewport on the one renderer, or one canvas a host blitted from the renderer’s), each with its own `step`, `draw`, `resize`, `setVisible` and quality share.

That is a change to `src/runtime/` (`runtime.js`’s `current`, the loop’s `can`, `useWorld`’s adopt and hold), which this lane doesn’t own. The rule the design asks to be written into `useWorld.js`’s header can’t be written until it exists. **The owner’s decision:** which lane adds several hosts to the runtime, and after #993 or in it. Until then the only Rick and Morty route with one world is the Citadel, and even it has the wardrobe’s preview over it.

## Blocker 2: the pixel gate can’t be measured yet

The gate is “every route shot before and after, compared pixel for pixel: a difference is a bug, never a tolerance”. Two shots of the *same* build don’t match, so no after could:

| how it was shot | route | pixels that differ between two runs of `main`’s build |
| --- | --- | --- |
| `tools/still.mjs`, Playwright’s clock (Date, `performance.now`, timers and frames advanced 16 ms a step), `Math.random` seeded, each step waiting for the network to go quiet; 200 frames from load | `/c-137` | 621 of 1,296,000 (still behind the loading veil: the world wasn’t up after 200 frames) |
| the same, 600 frames from load | `/c-137/citadel` | 748,529 of 1,296,000 |
| the same, 120 frames counted from the moment the loading veil is done (ready after 376 frames on one run, 386 on the other) | `/c-137/citadel` | 843,978 of 1,296,000 |

The pictures are the same view of the concourse with the people, Rick’s pose and the portal’s glow at another moment: how long the loading takes depends on the machine’s work (the decoders’ workers, the shaders), and parts of the world run on absolute time rather than on frames since shown. `scripts/autopilot-check.mjs`’s shots are further from it (wall-clock time, then a lossy WebP).

What the gate needs, before any world on a stage can pass it: a still the world itself holds, the earth module’s `world.view(name)` (DEV) in the after and the same hook in the before. The before has none (a stage world has no `view`), so the before has to be shot from `main` plus that hook alone, a change of no pixel of its own; that is a commit to `main` first, in this lane’s files (`citadel/scene.js`, `world/scene.js`, …), and then the before. It is the next step whichever way blocker 1 is decided.

## What is here

- `tools/still.mjs`: the still above (`--dist`, `--routes`, `--frames`, `--phone`, `--quality`, `--scroll`, `--tag`).
- `tools/diff.mjs`: two PNGs pixel for pixel, the count and a picture of where.

No `perf-probe` rows yet: the before is shot once its picture can be held. The WebGPU rows are the owner’s machines’ and stay empty.

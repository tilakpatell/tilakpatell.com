# Endless universe, lane 2: notes for the hand-off

The coordinator folds these into `docs/superpowers/HANDOFF-universe.md`.

## Landed

- PR 2.3, Task 11's review: the two clipping planes the audit missed are set in the draw. The broken flagship's halves (`universe/battleScene.js`) each set their cut from the half's own `onBeforeRender`, from where the half and the map are as it's drawn; a front's battle is 572 out, near home, so this was new to the shift. The portal gun's kill (`lib/three/portalFxCore.js`) sets its cut from the figure's meshes' `onBeforeRender` and `onBeforeShadow`, in the portal's frame while it's open and the body's once it's shut, and gives the meshes their own hooks back when it's done. Tests in `battleScene.test.js` and `portalFxCore.test.js` draw each round the camera and as the map is.
- PR 2.3's gate: lint, the whole test suite, the build, health and the flight island all pass at `058a3d17`. With the clock stopped, every pose but the landing draws the same calls and triangles as `main` at every tier, and the same pixels but for the air on the limb of the planets past 3,000 out at high and mid (`middleearth-limb`, `middleearth`, `rickmorty`, `caribbean`, `breakingbad`, `office`), which `main` marched about the wrong place and the lane draws where the planet is. The numbers are in `docs/superpowers/evidence/endless-universe-lane-2/README.md`.

## Left

- PR 2.3's perf probe on a real graphics chip is owed: `QUALITY=mid node scripts/perf-probe.mjs universe` and `QUALITY=low …`, before and after, p50 frame no worse than 2%. It was run at the gate, on both branches, but the browser here draws in software and a frame can stall for minutes, so those numbers (in the lane's evidence README) can't show 2%. The work added per draw is small: two matrix reads a body, deep space's `lit()` over its suns a lit mesh, and a plane a cut mesh; no material or program is added.
- The `landing-middleearth` pose isn't the same from run to run, on `main` as on the lane: it comes down where Middle-earth has turned to when the landing starts, and that goes by how long the page took to load. Held at one turn, both branches land on the same spot. If the pose is to be compared pixel for pixel, it wants the planet's turn held (or `?spot=`).
- `universe/battleSceneNodes.js`, the node renderer's twin, still sets its halves' cut in `update()`. The node renderer projects a `ClippingGroup`'s planes as it lists the scene, before any object's `onBeforeRender`, so the GLSL fix can't be copied there: it would be a frame late. Nothing draws the twin yet. When something does, set its planes before the render, for instance from the relative draw.

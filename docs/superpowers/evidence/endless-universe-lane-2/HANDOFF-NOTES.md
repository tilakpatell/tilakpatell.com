# Endless universe, lane 2: notes for the hand-off

The coordinator folds these into `docs/superpowers/HANDOFF-universe.md`.

## Landed

- PR 2.3, Task 11's review: the two clipping planes the audit missed are set in the draw. The broken flagship's halves (`universe/battleScene.js`) each set their cut from the half's own `onBeforeRender`, from where the half and the map are as it's drawn; a front's battle is 572 out, near home, so this was new to the shift. The portal gun's kill (`lib/three/portalFxCore.js`) sets its cut from the figure's meshes' `onBeforeRender` and `onBeforeShadow`, in the portal's frame while it's open and the body's once it's shut, and gives the meshes their own hooks back when it's done. Tests in `battleScene.test.js` and `portalFxCore.test.js` draw each round the camera and as the map is.

## Left

- PR 2.3's perf probe is owed: `QUALITY=mid node scripts/perf-probe.mjs universe` and `QUALITY=low …`, before and after, on a real GPU, p50 frame no worse than 2%. The headless browser here draws in software, a frame or two a second, so its numbers can't show 2%. The work added per draw is small: two matrix reads a body, deep space's `lit()` over its suns a lit mesh, and a plane a cut mesh.
- `universe/battleSceneNodes.js`, the node renderer's twin, still sets its halves' cut in `update()`. The node renderer projects a `ClippingGroup`'s planes as it lists the scene, before any object's `onBeforeRender`, so the GLSL fix can't be copied there: it would be a frame late. Nothing draws the twin yet. When something does, set its planes before the render, for instance from the relative draw.

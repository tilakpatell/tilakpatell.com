# Lane 1’s hand-off, so far

What the lane would add to `docs/superpowers/HANDOFF-universe.md`, written for the coordinator to fold in. It runs through Task 8; Tasks 9 to 11 (the Expanse’s nebulae, the poses and the measure, the after) add to it.

## Landed

- **One nebula renderer, fixed in the world** (`src/components/universe/nebula/`). `createNebulae({ renderer, tier }) → { group, add(desc) → handle, remove(handle), update(camera), inside(position) → { id, depth } | null, setLevel(step), dispose() }`, with `desc = { id, at: [x, y, z], r, colors, seed, form? }` (`form` is `'cloud'`, `'shell'` or `'nursery'`).
  - **The pure half, tested in Node:** `budget.js` (the tier rows, and `nebulaAtStep` for the pace’s steps), `rules.js` (`checkDesc`, `placement`, `detailAt`, `stepsAt`, `insideOf`, `fogLayers`, `youngStars`, the forms), `volume.js` (a tiling 3D noise volume made in code: nothing is downloaded).
  - **The drawing half:** every cloud and its young stars in one instanced draw (`index.js`, `shaders.js`), each a quad that ray-marches its sphere through the volume; the fog round the ship inside a cloud in a second (`fog.js`). A cloud past the far plane is drawn in along its own direction at its true angle. Both materials are made hidden at `createNebulae`, so the scene’s warm-up links them.
  - **Handles forgive:** a stale handle, a second `remove` or one after `dispose` does nothing; the same `id` added twice draws once until both are removed.
- **Deep space owns it.** `buildDeepSpace({ small, tier, renderer }) → { …, nebulae }`: the Veil (a shell) and the Cradle (a nursery) are `nebulae.add(…)` of `landmarks.js`’s `NEBULAE`, each keeping its `deep-<id>` group for its name and the far stars. The puffs, their painted texture and the young stars’ `Points` are gone, with their four shaders from `deepspaceShaders.js`. `deep.nebulae` is the one renderer the Expanse’s sectors borrow (Task 9).
- **The quality steps reach it.** `paceTo` (`scene.js`) calls `deep.nebulae.setLevel(at.step)`: each step down marches an eighth fewer steps near, half at the softest, never fewer than far (`nebulaAtStep`).
- **`NEBULAE`** (`landmarks.js`): the Veil and the Cradle as descs. The landmarks stand upright in the world (`quadAxes`), test depth and draw no nebula.
- **The sky’s `clouds` option** (`galaxy/sky.js`, and its node twin): `clouds: false` bakes without the three nebulae and moves no star. The galaxy keeps the default.
- **`mapSky.js`**: the map’s sky moved out of `scene.js` whole, baked with `clouds: false`. `createMapSky(parent, { renderer, small, level, post }) → { sky, followDrawn }`.

## Left

- `nebula/budget.js` waits for lane 2’s `universe/budget.js` to take its rows over (spec H).
- `farStars`’ specks are still fixed-size points: true in direction, no angular size. Gargantuans (lane 4a) should take `rules.js`’s `placement()` for their true angle.
- A cloud with something solid inside it fogs that thing by its whole chord, not just the part in front. The scene’s depth is the post’s, and `post.js` is shared with the galaxy.
- `palette.js:9`’s comment still names `deepspace.js` and `landmarks.js` as painting the Veil (Task 11).
- The nebula shaders have only ever compiled in headless Chromium’s software GL. A real GPU and the owner’s eye are still to look at them.

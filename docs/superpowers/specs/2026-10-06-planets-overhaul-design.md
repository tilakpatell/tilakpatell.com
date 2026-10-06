# The galaxy's planets, rebuilt with real assets — design

Date: 2026-10-06. Branch: `claude/sharp-carson-h9c6mp`. Supersedes the
"Phase 3: assets" part of `2026-10-05-galaxy-upgrade-design.md` for the
planet surfaces (`src/components/galaxy/surface`); Phase 1's surface
performance tasks (11–14) are folded in here because the new assets lean on
them.

## What the owner asked for

"All of the Star Wars planets need to be detailed with high res models and
very performant." Buildings must be "actually textured" and look like "actual
game assets", not blocks. Accuracy matters: things should look like the
films. Reference pictures come from online ("go look online for pictures and
use"), not from AI concept art: the owner judged five of six AI concepts
not good enough (only Theed's halls passed). Work goes piece by piece, each
piece a checkpoint that is verified and merged. No subagents.

## Where things stand

Seventeen landable worlds (`sites/*.js`): Tatooine, Hoth, Endor, Kashyyyk,
Dagobah, Yavin 4, Naboo, Coruscant, Kamino, Geonosis, Mustafar, Scarif,
Bespin, Nevarro, Mandalore, Lothal, Sorgan. A world places kinds through
`placer.put`/`scatter`; a kind with a catalogue entry (`catalog/*.js`) is a
GLB from `public/models/galaxy/surface/`, otherwise it is built in code
(`props/*.js`) from kit parts that now wear Poly Haven CC0 scans.

About 30 kinds have models. Every landmark is still built in code:

- Tatooine: homestead, cantina, docking bay, Ben's hut, Jabba's palace,
  sandcrawler.
- Naboo: Theed's halls and palace, hangar, Gungan city.
- Hoth: Echo Base, ion cannon, shield generator.
- Endor: shield generator, Ewok village.
- Kashyyyk: houses, Kachirho.
- Dagobah: Yoda's hut.
- Yavin 4: the Massassi temple.
- Coruscant: skyscrapers, Senate, 500 Republica.
- Kamino: the pads.
- Geonosis: spires, foundry.
- Mustafar: the mining facility and collector arms.
- Scarif: the citadel.
- Bespin: the city tower, platforms, carbon-freezing chamber.

Measured sizes are in `lab/sizes.txt`. The baseline counts and screenshots
for every world are in `lab/baseline/`.

## Goals

1. Every landmark and every prop seen up close on all seventeen worlds is a
   textured PBR model, recognisably the one from the films or shows.
   Kit-built geometry stays only where it is better: walkable decks and
   floors, ropes, light shafts, effects, terrain-like rock.
2. Performance is no worse than today at each world's landing. It is
   measurably better where the Phase 1 work applies (shadow casters, zones,
   sharing).
3. Every new asset passes a quality gate, with evidence the owner can look
   at (reference vs model sheets, in-world before/after shots).
4. Work ships in checkpoints. Each one is green on lint, tests and build,
   checked in the browser, pushed, merged to `main` by PR, and shown to the
   owner.

## Non-goals

- New gameplay. Phase 4 (Geonosis chase, takedowns, camera) is separate.
- Space-side visuals (Phase 2).
- Sequel-trilogy content (Ep 7–9) of any kind.

## Asset sourcing: a ladder, best first

For each kind, take the first rung that clears the quality gate.

1. **An accurate, downloadable Sketchfab model** under CC-BY 4.0 (or its
   NC/SA variants, as the catalogue already allows) or CC0. It must have
   real textures, and its shape must match the reference. Reject anything
   whose page says it was ripped or extracted from a game (licence
   misrepresentation). Reject toy, LEGO and low-poly stylised models unless
   nothing else exists. Use the existing `scripts/sketchfab-surface.mjs`
   import (it already squeezes, scales and credits).
2. **The owner's own Meshy models** (`lab/uploads/glb/`): the citadel
   (Jabba's palace, retextured), the A-wing.
3. **Meshy from a real reference picture.** A film still, production
   painting or game render is taken from Wookieepedia through its API. The
   pictures are kept in `lab/refs/`, never committed; their file names go
   in the tasks JSON. The route:
   - a. Pick the clearest picture of the whole object.
   - b. Run Meshy image-to-image (`nano-banana`, 3 credits) to lift the
     object out of the picture: the same design on a plain background,
     three-quarter view.
   - c. Gate: compare b with a side by side. Any drift in silhouette,
     proportions or colour rejects it. Try another picture or the raw crop.
   - d. Run image-to-3D (`latest`, PBR, 2K; 30 credits), or
     multi-image-to-3D when two or more clean views exist.
   - Prompts never name the films; Meshy refuses the names, and a refused
     task is refunded.
4. **Kit-built, improved**: better proportions, more parts, scans. Use this
   only for things models do poorly: decks you walk on, rope bridges,
   terrain features, effects.

## Quality gate (per model)

A model is accepted only if all hold:

- **Looks right.** A sheet with the reference picture, the model at three
  quarters, the model up close, and the model in the world at its place
  reads as the same thing. It must be clearly better than the built one at
  the same spot. The sheet goes in the checkpoint's evidence.
- **Textured properly.**
  - It has base colour, a normal map, and roughness/metalness (or ARM).
  - It has no stretched or smeared texture at walking distance.
  - Texture sizes: 2048 for landmarks over 40 m, 1024 for buildings and
    vehicles, 512 for small props.
- **Polygon budget** (LOD0):

  | Size class | Triangles |
  |---|---|
  | Small props | ≤ 15k |
  | Houses and vehicles | ≤ 40k |
  | Landmarks | ≤ 90k |

  Every model over 20k triangles gets an LOD1 at about 25% of the
  triangles, with maps at half size.
- **File size.** Each GLB is ≤ 2.5 MB, or ≤ 4 MB for a landmark marked
  `hero: true`. Use meshopt geometry and WebP maps. Use KTX2 (UASTC) for
  the normal maps of landmarks seen up close, where
  `scripts/ktx2.mjs report` says it is worth it.
- **Fits the world.** It stands on y = 0, faces +z, and is sized in metres
  to its kind's measured size. Where the built one was walkable or solid
  in parts, the model keeps those floors and solids (see Engine).

## Performance budget (per world)

Measured by `scripts/galaxy-check.mjs surface <world>` at high quality,
after the settle wait, at the landing:

- Draw calls and triangles: no more than the baseline +10%, and never over
  600 calls or 2.5M triangles.
- Model download for the world (sum of its GLBs, LOD1s included): ≤ 40 MB.
- No world's frame time is more than 10% worse than baseline on the same
  machine (software GL, so only the comparison means anything).

Repeated landmarks (Theed's halls ×13, Tipoca ×22, Coruscant's towers ×18,
Geonosis's spires ×14) must stay cheap. They share geometry, use the LOD1
past a distance, and are instanced where nothing moves them.

## Engine changes

1. **Two kinds of catalogue entry.** A Sketchfab entry has a `uid` and is
   credited in `src/data/modelCredits.json`, as today. A made entry has
   `made: 'meshy'` and is listed in `public/cc0/README.md` ("made for this
   site"). The catalogue test checks each kind's own rules.
2. **Built solids and floors under a model.** With `solids: 'built'`, the
   placer runs the built prop for its solids, floors and signals and throws
   its meshes away. The model is drawn in the built prop's place, so
   walkable decks and doors still work.
3. **Surface LODs.** `<kind>.lod1.glb` sits next to the model. The placer
   wraps the clone in a `THREE.LOD`. The switch distance is
   `max(60, 3 × radius)` metres. Instanced scatter uses the LOD1 past the
   same distance (two InstancedMeshes, instances swapped when the player
   moves more than 8 m, as Task 11's casters are).
4. **Phase 1 surface tasks 11–14**, as written in
   `docs/superpowers/plans/2026-10-05-galaxy-upgrade-phase-1.md`:
   - near-only shadow casters and zones;
   - shared props and figures, and fog culling of actors;
   - CPU (ground, walker, quests);
   - the surface bugs.

## Checkpoints

Each world group is one checkpoint. Its PR is merged before the next
begins.

| # | Checkpoint | Meshy credits (est.) |
|---|---|---|
| 1 | Asset engine: catalogue kinds, built solids, LODs, the reference/Meshy pipeline, the budget check | 0 |
| 2 | Surface performance (Phase 1 tasks 11–14) | 0 |
| 3 | Tatooine | ~110 |
| 4 | Naboo | ~110 |
| 5 | Hoth | ~110 |
| 6 | Endor | ~75 |
| 7 | Bespin | ~110 |
| 8 | Mustafar | ~75 |
| 9 | Kashyyyk, Dagobah, Yavin 4 | ~150 |
| 10 | Coruscant, Kamino, Geonosis | ~150 |
| 11 | Scarif and the Outer Rim worlds (Nevarro, Mandalore, Lothal, Sorgan) | ~110 |
| 12 | The owner's A-wing in space; final evidence | 0 |

Credits are an estimate at 36 per Meshy model (cleanup plus 3D). The real
figure falls with every Sketchfab model that passes. The balance on
2026-10-06 is 68. A checkpoint that needs more says so before it spends.

## Risks

- **Meshy refuses film imagery.** The task is refunded. Fall back to the
  cleaned image (step b), which is redrawn and usually passes.
- **Image-to-3D softens fine detail on huge landmarks** (Cloud City,
  Theed's palace). Multi-view input helps, and so does splitting a landmark
  into pieces (a palace wing, a dome) assembled in code.
- **Size creep.** The budget check in checkpoint 1 runs every checkpoint
  and fails loudly.
- **Licence.** Only CC0/CC-BY family. Nothing marked ripped. Credits are
  checked by the catalogue test.

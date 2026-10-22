# Making the Hogwarts cast

The people of the Hogwarts world (`docs/superpowers/specs/2026-10-21-hogwarts-world-design.md` §4.10) as big-headed toy figures on the site’s shared skeleton, made on the desktop’s GPU, and with Meshy where that pipeline made one badly (below). The figures are in `scripts/hogwarts-cast-figures.mjs`, each described by how it looks (never by a name: the picture step turns names down, and no likeness is modelled); `scripts/hogwarts-cast.mjs` makes them:

```
node scripts/hogwarts-cast.mjs picture --only ron,hermione   # four concept pictures each, and a contact sheet
node scripts/hogwarts-cast.mjs pick ron 3                    # after looking at scripts/gen3d/cache/hogwarts/ron/candidates.png
node scripts/hogwarts-cast.mjs all --only ron               # model, bake, skin, cut, sheet
```

| step | what | where |
| --- | --- | --- |
| picture | four pictures from the figure’s words (FLUX.1-schnell through `scripts/gen3d/picture.mjs`) | `scripts/gen3d/cache/hogwarts/NAME/concept-SEED.png`, `candidates.png` |
| pick | the one to model, by looking (a figure in an A-pose with clear space under the arms and the legs apart rigs best) | the task state |
| model | TRELLIS.2 (trellis.cpp) from the picture, Y up and facing +z; about nine minutes | `raw.glb` |
| bake | a bake for each cut (16,000, 8,000, 2,500 faces) through `scripts/rig/bake.py` | `baked-hq.glb`… |
| skin | Meshy’s 24 bones, heat weights (`scripts/rig/skin.mjs`), one skeleton for all three cuts | `skinned-hq.glb`… |
| cut | WebP, meshopt, matte; the cuts, the clips beside them, the credit, `cast.json` | `public/models/hogwarts/cast/` |
| sheet | the check (`scripts/rig/rig-check.mjs`) and four views in the idle, the walk and a cast | `docs/gen3d/hogwarts/NAME.webp` |

Every step keeps what it was made from in `scripts/hogwarts-cast-tasks.json`, so a step is never made again unless its inputs changed (`--fresh` to make it again anyway). The pictures and everything on the way stay in the cache, which git ignores; only the models, the clips, the sheets and the credits ship.

Look at every sheet before a figure ships. A figure that reads wrong (the proportion, a bad face, a limb through the body) is made again from a better picture: `picture` with another `seed` in its table entry, then `pick` and `all`. One that won’t come right in three tries is left out and said so.

## What ships, and how a world loads it

`public/models/hogwarts/cast/`:

- `NAME.glb`, `NAME.hq.glb`, `NAME.lo.glb`: the three cuts (`lib/device`’s mid, high and low detail);
- `NAME-idle.glb`, `NAME-walk.glb`, `NAME-run.glb`: its own idle, walk and run, as Meshy’s figures have theirs;
- `cast.json`: each shipped figure’s `height` (metres, crown to sole), `kind`, `house`, `tall` (a figure far over a person’s height: Hagrid), its cuts and clips, and `hipsY`: the hips’ height (the rig’s centimetres) to give `createAnimator` for the library’s clips, which stands a standing clip’s soles on the floor (scripts/rig/README.md, the feet on the floor).

A world loads a figure as the Road’s `src/components/middleearth/road/cast.js` does (the model and its three clips through `rt.assets`, `createAnimator` with them and `hipsY`, scaled to `height`), and plays every other clip through `lib/three/clipLibrary.js`’s `forFigure`.

## The budget

Under 4 MB a model (none comes near), and the whole cast folder under 30 MB: about a megabyte a figure, its three cuts and its clips together, which is why the cuts are smaller than a gen3d prop’s and colour only.

## Where Meshy makes it instead

The desktop’s pipeline sometimes paints a figure wrong (TRELLIS.2 turned Dumbledore’s purple robes black and spattered McGonagall’s and Sprout’s with skin-coloured patches) or rigs one badly (Flitwick came out facing sideways). Such a figure is made again from the same picked picture with Meshy:

```
node --env-file=.env.local scripts/hogwarts-cast-meshy.mjs all sprout   # image-to-3D, Meshy's rigger, then the same cut
node scripts/hogwarts-cast.mjs sheet --only sprout                        # the same check and sheet as the rest
```

Meshy’s model and its rigger’s skeleton (the one every library clip was made on), Meshy’s own walk and run (left as they come: made on that rig, they plant the feet), and the library’s calm idle for its idle (Meshy’s stands turned to the side), stood on the figure’s own soles. The task ids and the account each was made on are in `scripts/hogwarts-cast-meshy-tasks.json`, so nothing is paid for twice; a figure made there keeps its model and cuts when `hogwarts-cast.mjs all` runs (only its sheet is made here). About 35 credits a figure; `balance` says what each account has. The keys live in the git-ignored `.env.local` and are never printed.

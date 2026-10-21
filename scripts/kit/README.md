# The kit: Quaternius packs as family GLBs

The worlds' trees, ground cover, rocks and space props come from Quaternius's
CC0 packs, imported once into `public/kit/<pack>/`: one GLB a **family**
(every birch in `birch.glb`, sharing one bark and one leaf material) and a
manifest, `index.json`, that says what each model is without opening a file.
They are for the loader, `src/lib/three/kit.js`, which draws them through
instanced pools, and the galaxy placer's `kit:<pack>/<Model>`. The design is
`docs/superpowers/specs/2026-10-08-kit-worlds-design.md` ("The kit pipeline").

## Fetch, import, check, credit

```
node scripts/assets-fetch.mjs naturemega space farm       # the packs, into lab/assets/<pack>/ (git-ignored)
node scripts/kit/fbx.mjs farm                              # an FBX pack to lab/assets/farm-glb/ first
node scripts/kit/import.mjs naturemega                     # every family
node scripts/kit/import.mjs naturemega birch pine          # just these (the manifest keeps the rest)
node scripts/kit/import.mjs space --from ~/tilakverse-assets/quaternius/ultimate-space-kit
node scripts/kit/import.mjs naturemega --dry               # what it would write, model by model
node scripts/kit-check.mjs                                 # every pack against its manifest and budgets
npx vitest run scripts/kit scripts/kit-check.test.mjs      # the pure half, the fixture import, the check
```

- **Fetch.** `assets-fetch.mjs` unpacks a pack from the `assets-quaternius`
  release. `--from` reads a pack from anywhere else instead (a
  tilakverse-assets clone); any name not in `SOURCES` is read from `--from`
  itself, as the test fixture is.
- **Import.** Where each pack keeps its glTF is `SOURCES` in `import.mjs`
  (`naturemega` and `nature`: `glTF/`, the older `nature` pack's trees named
  `BirchTree_1`, `MapleTree_1` … and painting no wind weight, so `sway`
  marks its trees' and bushes' materials as bending by height alone; `space`: `{Characters,Environment,Items,Vehicles}/GLTF/`;
  `city`: `Exports/glTF (Godot)/`). The FBX packs (`farm`, `street`,
  `furniture`) are converted first, by `scripts/kit/fbx.mjs` (below), into
  `lab/assets/<pack>-glb/`, which the import then reads. The same pack
  converted or imported twice gives the same bytes.
- **Check.** The import ends with `checkManifest` (`manifest.mjs`) over what
  it wrote and prints anything over budget. `node scripts/kit-check.mjs`
  runs it over every pack in `public/kit/`, flags any GLB in a pack's folder
  that no model is in (a part left from an older import) and a pack over
  its budget in all (`PACK_BUDGET`: the nature megakit's 12 MiB), prints
  each pack's models, files and MiB, and exits 1 on anything wrong.
- **Credit.** Every manifest carries `licence: 'CC0-1.0'` and `source`
  (`Quaternius, <pack> (https://quaternius.com)`); `npm run credits` reads
  them (`kits()` in `scripts/credits.mjs`) into one line of CREDITS.md's
  CC0 section: Quaternius, each pack and its model count.

## FBX packs

`node scripts/kit/fbx.mjs <pack>` turns every `lab/assets/<pack>/FBX/*.fbx`
into `lab/assets/<pack>-glb/<Name>.glb` through `scripts/fbx-to-glb.mjs`
(three's FBXLoader and GLTFExporter in headless Chromium: skeleton, skin
and clips kept, each FBX material's colour kept as it is). That needs the
dev server: the one on 5188 when it answers, else vite started on a free
port and stopped when the run ends, error or not. Each GLB is then
rewritten three ways:

- **In metres.** Blender's FBX is in centimetres (`UnitScaleFactor` 1, every
  object scaled ×100), which FBXLoader keeps, so a horse came out 692 tall.
  The factor rides on the scene's root (`extras.unitScaleFactor`), and the
  root is scaled by it over 100 (`toMetres`): the animals then measure what
  the pack's OBJs do, bind pose and the first frame of `Idle` alike, to
  0.3 %.
- **Clips by their action's name.** Blender names a take for its armature
  too, `Armature|Walk`; the GLB's clips are renamed `Walk` (`clipName`,
  `renameClips`), so the manifest and the runtime's mixer know them so.
- **Without the loader's notes.** FBXLoader keeps `originalName` and
  `transformData` on every node, which GLTFExporter writes as extras and
  nothing reads after; they were 130 KiB of the farm's 1.05 MiB, and go
  (`dropLoaderNotes`; any other extra stays).

The import then files each animal as a rigged model, `<name>.glb`. The
animals' materials are flat colours under names that repeat across the
pack (`Brown` on the llama and, darker, on the pug; `Material.003` the
horse's coat and the pig's skin), and the kit shares a material by its
name, so the import tells materials apart by their colour as well as their
maps: one colour per name, `Brown`, `Brown_2` … by how many models wear it.

## What a family file holds

- Each model is a node named as the model (`Birch_3`); its meshes carry the
  model's name and each primitive is tagged `extras.part`: `'leaves'` (a
  material named `Leaves…`, `Leaf…` or `Flowers…`, or one the source cuts out
  by a map that really is see-through), `'bark'` (anything else on a tree or
  a bush) or `'main'`. A model of several meshes (a rover and its wheels) is
  its node tree, each part at its own transform.
- Beside it, `<Model>.lod1`: the same tree of nodes (each `<node>.lod1`), its
  mesh `<Model>.lod1`. Bark and solid parts are simplified toward a quarter
  (meshopt, error 0.05, borders free, allowed across UV seams: the packs'
  bark is hundreds of UV islands, and without that it stops at 80-96 %); a
  tree's or a bush's leaf cards are thinned to 40 % and each grown by
  1 / √(the share kept), at most ×1.25 (`thinCards`, seeded by the model's
  name): ×1.25 for every crown in these packs, and not at all for a crown
  of one card, which keeps it.
- A rigged model (the space kit's astronauts, mechs and enemies, the farm
  animals) is a file of its own, `<model, lower-cased>.glb`, with its skin
  and clips and no LOD1.
- The nature megakit paints a wind weight into `COLOR_0` (0.03 to 0.14 at a
  trunk's foot, tree by tree, to 1 in the crown); it becomes `_WIND`, one
  normalised byte a vertex (three's GLTFLoader names it `_wind`). Every
  other `COLOR_0` is dropped.
- A leaf material is `MASK` at 0.3 and two-sided, whatever the source had
  (some crowns are `BLEND`, some bark `MASK`); everything else is opaque.
- Textures are WebP q82 by role: bark colour 1024 (512 only for a model too
  heavy on its own, below),
  normals 1024, leaf maps 512 with their alpha, other colour maps 1024 (never
  enlarged). The space kit's palette atlases stay at their own size,
  lossless. Its 92 files embed five different atlases (a 32² palette in 80,
  a 512² in the astronauts and the large enemy, three 32² variants in the
  mechs and rovers), which differ from the pack's `Atlas.png` by up to 97
  levels where their models sample them, so each is kept, as `Atlas`,
  `Atlas_2` … `Atlas_5` by how many models wear it.
- Then `dedup`, `prune`, and meshopt (`medium`, normals in a byte a
  component; a rig's clips resampled first).
- A family over 1.5 MiB goes into `<family>.glb`, `<family>-2.glb` … in model
  order, each as full as fits; the manifest's `file` says which holds a
  model, and the materials keep their names in each.

Choices the plan didn't make, and why:

- **Simplify crosses UV seams** (meshopt's `Permissive`): without it the
  bark, hundreds of UV islands, stops at 79-96 % and no tree's LOD1 makes 40 %;
  with it every part reaches the quarter at 0.1-0.4 % error.
- **Normals in 8 bits**, not meshopt `medium`'s 10: a family is mostly its
  geometry, and at 10 bits the megakit came to 12.8 MiB, over its 12.
- **Five space atlases, five materials**: the pack's files embed atlases up
  to 97 levels off its `Atlas.png` where they are sampled, so each is kept,
  and named apart because the kit shares a material by its name.
- **FBX packs in metres**: FBXLoader keeps Blender's centimetres, which made
  every farm animal 100 times its OBJ; the GLB's root is scaled to metres
  before the import, so the manifest's `radius` and `height` are metres too.
- **Materials told apart by colour too**: the farm's flat colours repeat
  names across animals (`Material.003` brown on one, pink on another);
  named apart, each keeps its colour where the kit shares by name.

## The manifest

```js
{
  pack: 'naturemega', licence: 'CC0-1.0', source: 'Quaternius, Stylized Nature MegaKit (https://quaternius.com)',
  models: {
    Birch_1: {
      family: 'birch', file: 'birch.glb',
      parts: ['bark', 'leaves'],        // each primitive's extras.part, in order
      tris: 6378, tris1: 1822,          // full and LOD1 (null for a rig)
      radius: 4.587, height: 13.293,    // half the footprint's diagonal; the top (m)
      trunk: 0.208,                     // how far its bark below 8 % of its height reaches across (a model
                                        // with no bark: all of it); the far band's trunk, a placer's solid
      kind: 'tree',                     // lib.mjs kindOf, or 'character' for a rig
      tones: [[r, g, b], [r, g, b]],    // a tree's or a bush's leaf map, linear, ±12 % (the far band's puffs)
      rig: { bones: 43, clips: { Idle: 1, Walk: 1 } },   // a rigged model's (seconds)
    },
  },
  materials: {
    Leaves_Birch: { alpha: 'mask', leaf: true, wind: 'tree', maps: { colour: '512x512' } },
    Bark_Birch: { alpha: 'opaque', leaf: false, wind: 'tree', maps: { colour: '1024x1024', normal: '1024x1024' } },
  },
}
```

A material is described once for the pack and shared by name across its
family files. `wind` is how it bends (`src/lib/three/foliage.js` `WIND`):
`'tree'` when any tree wears it (its bark bends with its crown), `'shrub'`
when only bushes, grass, plants or flowers do, and `null` for the rest or
when its geometry carries no `_WIND`.

## Budgets

| What | Budget |
| --- | --- |
| A family file | 1.5 MiB (a family over it is split into numbered files; only a model over it on its own has its bark colour halved to 512, in every family that wears that bark, and `maps.colour` says so) |
| A tree | 15,000 triangles |
| A tree's LOD1 | 40 % of its triangles (any other model's LOD1: no more than the model) |
| The nature megakit | 12 MiB for its 116 models, in all (`PACK_BUDGET`; `kit-check` holds it) |

## What the packs came to (2026-10-08)

The nature megakit: 116 models in 20 files, **11.23 MiB** (the manifest 39 KiB).
The cherry blossoms are in two files, the first three and the last two; no
bark is halved. `checkManifest` is clean on all three packs.

| File | Models | Triangles | LOD1 | KiB |
| --- | ---: | ---: | ---: | ---: |
| birch.glb | 5 | 29,734 | 8,649 | 1,158 |
| bush.glb | 6 | 10,256 | 3,404 | 444 |
| cherryblossom.glb | 3 | 40,787 | 11,916 | 1,316 |
| cherryblossom-2.glb | 2 | 24,981 | 7,160 | 794 |
| clover.glb | 2 | 994 | 238 | 73 |
| commontree.glb | 5 | 22,666 | 6,735 | 770 |
| deadtree.glb | 5 | 29,878 | 7,432 | 851 |
| fern.glb | 2 | 468 | 125 | 69 |
| flower.glb | 12 | 7,879 | 2,196 | 297 |
| giantpine.glb | 5 | 35,960 | 10,070 | 1,242 |
| grass.glb | 7 | 3,663 | 911 | 83 |
| mushroom.glb | 4 | 6,440 | 1,609 | 179 |
| pebble.glb | 11 | 1,047 | 268 | 116 |
| petal.glb | 6 | 159 | 102 | 61 |
| pine.glb | 5 | 17,575 | 4,993 | 563 |
| plant.glb | 10 | 3,370 | 921 | 149 |
| rock.glb | 6 | 5,188 | 1,294 | 157 |
| rockpath.glb | 10 | 14,839 | 3,700 | 479 |
| tallthick.glb | 5 | 37,587 | 11,038 | 1,194 |
| twistedtree.glb | 5 | 48,491 | 14,082 | 1,500 |

The space kit: 92 models in 31 files, **4.77 MiB** (the manifest 29 KiB). Each
rigged model is its own file: the astronauts 420-428 KiB (18 clips each), the
large enemy 337 KiB, the mechs 183-199 KiB, the small enemies 44-54 KiB.

| File | Models | Triangles | LOD1 | KiB |
| --- | ---: | ---: | ---: | ---: |
| base.glb | 1 | 2,790 | 696 | 39 |
| building.glb | 1 | 2,940 | 733 | 38 |
| bush.glb | 3 | 4,448 | 1,109 | 61 |
| connector.glb | 1 | 508 | 126 | 10 |
| geodesicdome.glb | 1 | 1,432 | 358 | 28 |
| grass.glb | 3 | 750 | 233 | 26 |
| house.glb | 6 | 7,274 | 1,815 | 106 |
| metalsupport.glb | 1 | 540 | 130 | 13 |
| pickup.glb | 7 | 5,272 | 1,313 | 99 |
| planet.glb | 11 | 23,040 | 5,754 | 313 |
| plant.glb | 3 | 2,344 | 602 | 44 |
| ramp.glb | 1 | 192 | 48 | 8 |
| rock.glb | 7 | 2,216 | 584 | 63 |
| roof.glb | 5 | 2,094 | 520 | 43 |
| rover.glb | 3 | 22,430 | 5,590 | 322 |
| solarpanel.glb | 3 | 2,616 | 654 | 56 |
| spaceship.glb | 4 | 14,012 | 3,501 | 183 |
| stairs.glb | 1 | 256 | 70 | 8 |
| tree.glb | 18 | 42,138 | 10,526 | 482 |

Some small models' LOD1s save little (five petals of 13-30 triangles keep
nearly all of them; three flowers, two plants and a pebble of 48-293, and
one space grass, 42-79 %): none is a tree, and none is heavier than its model.

The farm animals: 7 models in 7 files, **0.88 MiB** (the manifest 4 KiB),
each a rig with its clips (seconds) and no LOD1; 12 flat-colour materials,
no textures.

| File | Bones | Triangles | Clips | KiB |
| --- | ---: | ---: | --- | ---: |
| cow.glb | 28 | 796 | WalkSlow 2.083, Death 1.25, Jump 1.708, Idle 6.25, Walk 3.333, Run 1.417 | 211 |
| horse.glb | 28 | 690 | WalkSlow 2, Death 1.083, Jump 1.5, Idle 6.25, Walk 2.667, Run 0.833 | 193 |
| llama.glb | 24 | 662 | Jump 1.125, Idle 6.25 | 71 |
| pig.glb | 24 | 562 | Jump 1.5, Idle 6.25 | 70 |
| pug.glb | 24 | 644 | Jump 1.5, Idle 6.25 | 72 |
| sheep.glb | 24 | 612 | Jump 1.125, Idle 6.25 | 69 |
| zebra.glb | 28 | 1,354 | WalkSlow 2, Death 1.083, Jump 1.5, Idle 6.25, Walk 2.667, Run 0.833 | 209 |

## Later

- A `-sm` 512 copy of each bark colour map, for the low tier: a GLB carries
  one image a texture, so it needs its own file or a path in the loader.

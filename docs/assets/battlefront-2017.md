# Star Wars Battlefront II (2017) (used with permission)

The owner’s extraction of EA DICE’s Star Wars Battlefront II (2017), used with permission on this non-commercial fan project ([the decision](../decisions/2026-10-10-battlefront-2017-assets.md)). It lives in two private buckets on the owner’s Supabase project:

- **`bf2017-assets`**: the 2017 game. `web/models/` (one GLB a model a LOD: `<name>_mesh.glb`, `<name>_mesh_lod1.glb` … `_lod5.glb`), `web/collision/` (a collision GLB a model), `web/textures/` (still uploading: KTX2 now, PNG perhaps later), `web/models.jsonl` (the manifest: one line a model, 13,871 of them, with the LOD chain, bounds, rig, textures and the derived maps’ recipe) and `data/` (Frostbite records, reference only).
- **`bf2-extract`**: the classic (2005) edition. Empty so far; `scripts/battlefront-import.mjs` is its importer if it fills with `.msh` and `.tga`.

The GLBs are `gltfpack` output (meshopt, quantised, metal-rough) whose textures are **not embedded**: each names a KTX2 by a path relative to itself (`../../../../../textures/<path>/<name>_cs.ktx2`). A model fetched without its textures draws nothing.

## Fetching

The keys: `SUPABASE_URL` and `BF2017_KEY`, a key that can read the bucket, in `.env.local` (never committed; `.env.example` names them). In a cloud session they are already in the environment, where the key may go by `SUPA_KEY`; the fetch takes either name and never prints it. Everything lands in `lab/assets/bf2017/` (git-ignored) in the bucket’s own layout.

```
node --env-file=.env.local scripts/bf2017-fetch.mjs manifest
node --env-file=.env.local scripts/bf2017-fetch.mjs --list 'characters/hero/luke/*'
node --env-file=.env.local scripts/bf2017-fetch.mjs <name> [--lod all|0,2] [--parts '*_cape_mesh'] [--no-textures] [--collision]
```

A texture the bucket has not got yet prints `missing`: the upload is still running.

## Importing

```
node scripts/bf2017-import.mjs <name> --kind <kind> --as '<what it is>' [--asis | --metres 1.83] [--rig] [--crew] [--hero] [--ultra] [--tex 1024] [--maps 512]
node scripts/glb-shot.mjs public/models/galaxy/surface/<kind>.glb out.png three
```

The import picks the site’s cuts from the LOD chain, turns the textures into WebP at the site’s sizes, grounds the model, writes the row into `src/components/galaxy/surface/catalog/bf2017.js` and the credit into `src/data/modelCredits.json`. Its header comment has every flag.

## Kits, the surfaces' roles, a level's probe

A level's modular system (Echo Base's hangar, its wall system) can be made one file: fetch the pieces at a LOD, then

```
for n in $(node scripts/bf2017-fetch.mjs --list 'objects/architecture/hoth/wallsystem_01/new/wall_01_*' | awk '{print $1}'); do node scripts/bf2017-fetch.mjs $n --lod 1; done
node scripts/bf2017-kit.mjs hothwalls --pieces 'objects/architecture/hoth/wallsystem_01/new/wall_01_*' --as 'Echo Base’s inside walls' --lod 1 --world hoth
```

A piece keeps the game's origin, a corner or an edge; the materials are kept apart by name (`M_Wall` and `M_Floor` are alike in all else). Some systems' maps are bound by their shader preset, not the mesh: Hoth's large hangar shells have no maps in the GLB or the records.

The surfaces' roles on the game's maps: `node scripts/bf2017-textures.mjs [role …]` makes them from `scripts/lib/bf2017-roles.mjs`'s sources; a site's `look.scanned: 'bf2017'` wears them.

A level's light is one of its reflection volumes' probes, six 128² Radiance faces under `web/textures/levels/mp/<level>/reflectionvolumetexture/<lighting>/`, published for the owner's lighting lane (this pipeline builds no lighting); look at them first, then `node scripts/bf2017-sky.mjs <folder> <probe id> --name <world>`, and write what it is in `docs/superpowers/evidence/bf2017-<world>/skies.md`. The levels' panoramic skies (`Levels/Lighting/Hoth/Sunny_01/T_Hoth_Sunny_01_Panoramic_C`, 8192 × 2048) are in `web/textures.jsonl` but were not in the bucket on 2026-10-10.

## What a texture is

Read from the uploader’s test PNGs (`inventory.md`, “What a texture is”):

| suffix | what |
| --- | --- |
| `_CS` | RGB colour, A smoothness (roughness = 1 − A) |
| `_NAM`, `_NOM`, `_NOS`, `_NAOS`, `_NMA`, `_NW`, `_NA` … | RG normal x and y (z rebuilt), B and A occlusion, metal or smoothness, as the manifest’s `derived` recipe names per material |
| `_N`, `_NM` | a plain normal |
| `_C` | plain colour |
| `_RGBA`, `_RGB`, `_M`, `_ID`, `_E`, `_H`, `_AOSL` | masks, IDs, emissive, height, AO slices: the Frostbite shaders’ extras, unused |

The uploader’s derived maps, `<map>__normal.ktx2` and `<map>__orm_<hash>.ktx2`, are already split for glTF; when only the raw PNG is there, the import rebuilds them from `derived` (`scripts/lib/bf2017-textures.mjs`).

## The rig

The people are on `Walrus_HumanMale`, about 250 joints named as Maya HumanIK names them, which is Mixamo’s naming without the `mixamorig:` prefix (`Hips`, `Spine`, `Spine1`, `LeftArm`, `LeftHandIndex1` …). The import’s `--rig` keeps it whole, as DICE made it (fingers, the 79 face bones, cloth physics, the `Wep_*` and `IK_Joint_*` sockets), and renames nothing, so the game’s clips can drive it as they were made to. A `grip` node is put under `Wep_Root` (the weapon socket in the right hand), or `IK_Joint_RightHand` where there is none.

## Data

The game’s rules come from its data dump, not its models: 83,983 EBX records as JSON (`data/<Name>.json.gz` in the bucket, `data.tsv` their index), read into the rulebooks under `src/data/bf2017/` that the Battlefront game plays by (`docs/superpowers/HANDOFF-battlefront.md`).

```
node scripts/bf2017-fetch.mjs data 'Gameplay/Equipment/**' 'Gameplay/Kits/**' 'Gameplay/Teams/**' 'AI/**' 'Levels/MP/Hoth_01/**' …
node scripts/bf2017-fetch.mjs web 'svg/**' 'strings/**' 'maps/levels/mp/hoth_01/*.json' 'fonts/**/LinotypeUnivers-520CnMedium.ttf' …
node scripts/bf2017-data.mjs all --root lab/assets/bf2017 --level hoth_01 --era Orig
```

- **The root** is the export: in the cloud `lab/assets/bf2017` (the bucket’s layout: `data.tsv`, `data/`, `web/`), on the owner’s machine `C:/Users/tilak/Downloads/BF2_Extract/web` (the web build beside it as `../web_opt`). A record is read as `.json` or `.json.gz`, its path matched ignoring case (the export ran on Windows). The fetch’s `web` command also lists what it saw in `web/files.txt`, so the extractor knows the 23 fonts without fetching them all.
- **The rulebooks**: `teams`, `classes`, `heroes`, `reinforcements`, `vehicles`, `weapons`, `abilities`, `cards`, `ai`, `cameras`, `ui`, `strings`, and per level `maps/<level>.json` and `maps/<level>.lighting.json`, each `{ _from, rows }`. Every number carries a `<key>_source` (or an object `_source`) naming its record and path; `src/data/bf2017/rulebook.test.js` fails on one that does not. The extractor copies the in-game icons and the four HUD fonts under `public/battlefront/`. `src/lib/battlefront/rulebook.js` is how the rules read them.
- **The hand files**: `maps/hoth.stages.json` (the stage order and objectives) and `points.json` (Battle Points) carry `"source": "hand"`; `src/data/bf2017/NOTES.md` says why each value is by hand and where to look to replace it.
- **A fixture**: `node scripts/bf2017-data.mjs fixture <record name> [--cut root]` copies one record into `scripts/fixtures/bf2017/data/` (keep it under 40 KB: cut it, or keep it gzipped) and adds its index row. The parsers and builders are tested on those alone, without the network.
- The sequel era is refused as everywhere else (`isSequel`): a refused team kit is counted in `teams.json`’s `refused`.

## Effects (fidelity lane X)

The game's effects are read from their own records, not drawn by hand: each `EffectBlueprint` (`web/data/FX/**/<Effect>.json`) and the `ScalableEmitterDocument`s it names (`web/data/**/emitters/em_*.json`) become `src/data/bf2017/fx/<Effect>.json`, which `src/lib/three/particles/` plays (one draw per emitter of an effect, on the GPU where the browser has WebGPU).

```
node scripts/bf2017-emitters.mjs --level hoth --root C:/Users/tilak/Downloads/BF2_Extract [--sheets]
node scripts/bf2017-emitters.mjs FX_Snow_FallingSnow_01_Hoth … --root <export> | --bucket
node scripts/bf2017-effects.mjs hoth [--root <export>]
node scripts/assets-upload.mjs --dry
```

- **The tables**: every number keeps where it came from (`_source`, leaf by leaf); a field or object type the reader does not know is kept under `raw` and listed by the run; an `EmitterGraph` (a compiled GPU graph, 166 in the game, opaque in the export) is replaced by the nearest document of its family and marked `graph: true`. The reader's reading of each type is in `scripts/lib/bf2017-emitters.mjs`'s header.
- **The sheets** (`--sheets`, from the export: the master PNG under `web/textures/fx/`, else the KTX2 under `web_opt/textures/fx/` unpacked by `bf2017-textures.mjs`): WebP at 512, 1024 and 2048 on the longer side in `public/models/galaxy/bf2017/fx/<stem>.<size>.webp`, each under 256 KB, and `fx.json` listing them (grid, sizes, bytes, additive). Low and mid load 512, high 1024, ultra 2048; a level's set stays under 6 MB a tier (the run says by how much otherwise), loaded once a visit through `src/lib/assetBase.js`. The sheet names sit beside lane F's KTX2 (`glow.256.ktx2` …) in the same folder without clashing: lane F's are `<site name>.<size>.ktx2`, these the game's own texture names.
- **A level's spawns**: `effects.json` beside lane L's pack (`public/models/galaxy/bf2017/levels/<world>/`), rebased into the pack's frame and binned by its cells like `lights.json`; it names the effects the level spawns that have no table yet.
- **The fixtures** (`scripts/fixtures/bf2017/fx/`, 18 KB, the export's layout): three effects (the hangar's falling snow with its HDR powder and four tier variants, a GR-75's engine glow and contrail, a blaster bolt into snow with an `EmitterGraph`) and a map's extras. They were written in the cloud from the field list in `docs/superpowers/specs/2026-10-10-battlefront-fidelity-design.md` (the export is on the desktop), so the tables made from them say `fixture: true`; the desktop run replaces them.

## Credit

Every model: `author` EA DICE, `license: 'permission'`, and the permission text “From EA DICE’s Star Wars Battlefront II (2017), used with permission on this non-commercial fan project; Star Wars and everything in it belong to Lucasfilm.” The import writes it; never by hand. No sequel-era model ships: the import refuses those folders.

The counts, LOD chains and sets by world: [`docs/superpowers/evidence/bf2017-assets/inventory.md`](../superpowers/evidence/bf2017-assets/inventory.md).

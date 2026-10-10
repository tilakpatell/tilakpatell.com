# Hand-off: the surfaces at the game's fidelity

The design: `docs/superpowers/specs/2026-10-10-bf2017-surfaces-design.md`. It answers "how does Frostbite make the picture from these assets, and how much of it can the web take": six layers (the surface shader, the ground's layers, the baked light, weathering and decals, the texture quality, the picture), each a lane. It sits beside the fidelity design (`2026-10-10-battlefront-fidelity-design.md`, PR #836: shadows, volumetrics, particles, cameras, scatter, headroom) and does not repeat it.

## What was found (2026-10-10, night)

- **The material parameters are not opaque.** The `ShaderGraph` records are names, but `agents/textures/matdump/materials.jsonl` on the desktop holds every material's shader, texture slots, vectors, bools and conditionals for all 15,324 meshes (30,517 materials). Uploaded to the bucket as `web/materials.jsonl` (14.1 MB) for the cloud lanes.
- **The lightmaps exist.** `StaticEnlightenData` per level names an HDR irradiance atlas, three direction maps and a sky-visibility map (Hoth: `EN_Hoth_01_Static_Sunset_*`, 3,128 × 3,680 BC6U); 200 atlases across the levels. The per-instance charts are in an Enlighten database resource the exporter never read; lane Q3's Task 3 probes it.
- **1,788 maps the materials name were never encoded** (detail normals, overlays, height maps, masks, emissive maps; 173 terrain layer maps): `web_opt/_surfaces_list.tsv`, encoding since 2026-10-10 14:00 UTC on the desktop (`logs/surfaces_textures.log`, pid 7604; terrain first, then detail, height, overlay, emissive, mask). **They still need uploading**: when the log says `ktx2: ok=…`, queue the KTX2 paths and run `tool/upload_supabase.py --root web_opt --list <list> --project jzabcqboyemokwifmjmp --bucket bf2017-assets --prefix web/` with `SUPABASE_SERVICE_KEY` from `.secrets/supabase_service_key.txt`, and read its "to upload now" line. The lanes print `missing:` for a map not there yet and re-import when it lands.

**The atlases are not in the bucket (checked 2026-10-10 15:10 UTC by the fifth design's session, on the desktop export and lane Z's ledger).** `textures.jsonl` lists the 200 `*_staticIrradianceTexture` PNG sources (2,000 to 3,000 pixels a side) beside the 201 `StaticEnlightenData` records, but `upload_state.tsv` has 0 rows for them: they were never queued (the same cause as #839's §1.1), and the bucket's 118 `enlighten` objects are proxy meshes, shapes and records. Lane Q3's spike therefore needs a desktop pass first: `tool/ktx2_encode.py --list` on those 200 (UASTC: irradiance, not colour) plus the direction and sky-visibility maps the records name, queued and uploaded as the planet skins were; until then Q3 reads the export on the desktop, not the bucket.

## The lanes

| Lane | Plan | What | Starts from | Blocked by |
|---|---|---|---|---|
| **Q1** | `2026-10-10-bf2017-surfaces-laneQ1-materials.md` | the recipes from `materials.jsonl`; `createGameMaterial` (detail normals, overlays, colours, emissive, parallax, reflectance, vegetation, hair) with the `overlays` hook; `levelGltf.js` builds it on a node world; Hoth's `recipes.json` | `main` | the detail maps as they land |
| **Q2** | `…-laneQ2-ground.md` | the terrain's layer stacks and derived masks → `ground.json`; the layered TSL ground on lane L's `image` layer | `main` | the terrain maps as they land |
| **Q4** | `…-laneQ4-weathering.md` | snow/sand/wet overlays to Q1's hook from the weathering records; placed decals (`decals.json`, projected and volume) | `main` | nothing (the hook contract is in Q1's plan; wired when both merge) |
| Q3 | `…-laneQ3-bounce.md` | the record's bounce in the light stack; the Enlighten atlas spike on the desktop | `main` after S | S (#836) merged |
| Q5 | `…-laneQ5-ultra-textures.md` | measure ETC1S vs UASTC on Hoth's colour maps; an ultra colour row if it pays; anisotropy | the desktop; Task 4 on `main` now | the owner's machine |
| Q6 | `…-laneQ6-picture.md` | the LUT after a linear tonemap, five-Gaussian bloom, HBAO numbers, the painted sky panorama and fog gradient, the cloud-shadow texture | `main` after S and V | S and V (#841) merged |

One lane per session. Q1 owns `src/lib/three/surface/` and `levelGltf.js`'s options; Q2 `src/lib/three/ground/` and one call in `levelScene.js`; Q4 `surface/weather.js`, `src/lib/three/decals/` and the fixture's crate and wall. #836's running lanes (S: `light/calibrate.js`, `sun.js`, `clouds.js`; V: `fog.js`, `post.js`, `passes.js`; X: `particles/`; C: `camera/`) own different files; `scene.js` is touched by nobody here.

### What the other work must know

- **Lane T** (#826, the surfaces on the node renderer): Q1's material is what a `'nodes'` level draws its game meshes with; T's twins are the site's own materials and are untouched. When T flips `galaxy-surface` to `'nodes'`, `levelScene.js`'s one condition (`rt.gfx.kind !== 'webgl'`) turns Q1 and Q2 on for Hoth.
- **The Battlefront world** (lane 5): takes `createGameMaterial` through its `assets.js` adapter and `createLayeredGround` for its ground; nothing to write of its own.
- **Lane N** (#836, scatter): imports `src/lib/three/ground/masks.js` for where each layer is, so grass and rock agree with the ground's own layers.
- **Lane D** (#839, the desktop's texture gap): the 1,788 maps above are the same gap seen from the materials' side; `_surfaces_list.tsv` is the list, `wanted_textures.py` (D's Task 1) should subtract it.

## Status

| Lane | Session | Branch | PR |
|---|---|---|---|
| design | the architecting session | `claude/bf2017-render-beauty` | #844 |
| Q1 | `session_01Ej9xiBYcqg7uoRPqsbKTtN` (Opus 5.5, env Website, started 2026-10-10 14:13 UTC) | `claude/surfaces-q1-materials` | |
| Q2 | `session_01RyTcJLkhXuFkEEnUifdzLL` (the same) | `claude/surfaces-q2-ground` | |
| Q4 | `session_01UZN9iy457biyvcFRr7X39w` (the same) | `claude/surfaces-q4-weathering` | |
| Q3 | | | after S |
| Q5 | | | the desktop |
| Q6 | | | after S and V |

Findings for the next lane go here: families by count on Hoth and which fell to `glb`, the detail maps still missing at PR time, the ground's tile size as judged, what the Enlighten probe found, the PSNR table.

## Checking it

- `npx vitest run src/lib/three/surface src/lib/three/ground src/lib/three/decals scripts/lib/bf2017-materials.test.mjs scripts/lib/bf2017-ground.test.mjs scripts/lib/bf2017-decals.test.mjs`.
- `node scripts/light-fixture.mjs --materials | --weather | --decals | --bounce | --picture` (the WebGL 2 leg on the cloud; the WebGPU leg on the owner's laptop).
- `node scripts/galaxy-check.mjs surface hoth` under `BUDGET=1` per tier with `?gpu=webgl`; `node scripts/surface-shot.mjs` at the hangar wall, a crate, the field and the ridge, before and after, in `docs/superpowers/evidence/bf2017-surfaces/<lane>/`.

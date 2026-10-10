# Hand-off: the Battlefront II (2017) pipeline

The designs: `docs/superpowers/specs/2026-10-10-battlefront-2017-asset-pipeline-design.md` (the pipeline: fetch, import, the rig, the phases; PR #802) and `docs/superpowers/specs/2026-10-10-bf2017-levels-lighting-sabers-design.md` (the levels, the light, the planet skins, the sabers, and the review of the first design). The bucket’s numbers, `docs/superpowers/evidence/bf2017-assets/inventory.md`; the drop and its credit, `docs/assets/battlefront-2017.md`.

## The fifth design: every object in the drop, used (2026-10-10, night)

`docs/superpowers/specs/2026-10-10-bf2017-every-asset-design.md`, with eleven plans `docs/superpowers/plans/2026-10-10-bf2017-every-asset-lane{Z,E0,E1,E2,E3,E4,E5,O,Q,M,A}-*.md`. Written from a census of the desktop export's manifests, a live listing of the bucket and `origin/main` at `ff7bee49` (#842). The owner asked that every asset on the bucket be used by the site, added to all the worlds where it fits, and implemented by Opus 5.5.

**What the census found.** The bucket holds 13,871 models (about 750 used), 74 maps (one used; 44 usable under the era rule), 39 terrains (one used), 10,530 Havok sets and 12,941 collision meshes (Hoth's cells; the collision meshes never), 10,270 clips on 59 skeletons (eleven skeletons in part), 61 animation tracks (none), 116 films, 23 fonts, 702 icons and 19,482 strings (none on the site), every map's placed lights, decals, actors, vehicle spawns and effect spawns (none drawn; lane R's `placed.js` can draw `lights.json` but no world has one), the other levels' probes and far shadows, the sky panoramas, the UI bitmaps and the shader presets' detail maps (none). The design makes "all" a number: a ledger that gives every object a consumer, an owner lane or a rule, and a CI check that fails while any object has none.

| Lane | What | Needs first | Session | Branch | Merged |
|---|---|---|---|---|---|
| Z | the coverage ledger: `scripts/bf2017-coverage.mjs`, the owners table, `--check` in CI, the four counts in this table | nothing | `session_018HdseSL3U68899P3D9oWmP` | `claude/bf2017-z-ledger` | #853 |
| E0 | the level factory: packs out of git, districts and interiors, every map part beside `level.json` (lights, decals, actors, vehicles, effects, tracks, probes, far shadow, scatter table, shapes, collision solids), the detail maps; Endor on Endor_01, Echo Base's inside | nothing | | `claude/bf2017-e0-factory` | |
| E1 | Tatooine (Mos Eisley, the dunes, Jabba's palace and its inside), Yavin | E0 | | `claude/bf2017-e1-tatooine-yavin` | |
| E2 | Naboo (Theed under its dusk and lanterns, the hangar, the plains, the palace), Kamino | E0 | | `claude/bf2017-e2-naboo-kamino` | |
| E3 | Kashyyyk, Geonosis, Endor's village, research station and bunker | E0 | | `claude/bf2017-e3-kashyyyk-geonosis-endor` | |
| E4 | Scarif, Cloud City, Hoth's outpost, the Death Star inside on DeathStar02_01 | E0 | | `claude/bf2017-e4-scarif-bespin-deathstar` | |
| E5 | Felucia, Kessel, Sullust, Pillio, Vardos, Fondor as systems with skins and surfaces | E0 | | `claude/bf2017-e5-new-systems` | |
| O | the object library (every placeable set indexed), the seven mapless worlds dressed by biome, `GAME_FOR` props, the game's clouds, the living world | nothing | | `claude/bf2017-o-library` | |
| Q | the space levels as set pieces, the capitals, the asteroids on their tracks, the sky panoramas, the map's globes | nothing (#793 read) | | `claude/bf2017-q-space` | |
| M | the films on the cards, veils and briefings; the tiles and tutorials for the game's world; the lava film; the open fonts, the icons, the strings, the UI widgets, the hero stage | nothing | | `claude/bf2017-m-frontend` | |
| A | every clip: stances, additive aims and hits, cover and awareness, emotes and end of round, the cinematics player, first person, riders and crews, the band, the fauna rigs | nothing (#839's B, Y, W kept off) | | `claude/bf2017-a-clips` | |

Coverage (from lane Z's ledger, `docs/superpowers/evidence/bf2017-coverage/`, refreshed by every lane's PR): used · owned · excluded · not-uploaded · unowned =

| when | rows | used | owned | excluded | not-uploaded | unowned |
| --- | --: | --: | --: | --: | --: | --: |
| 2026-10-10, lane Z (the bucket: 113,463 objects listed, 83,983 records) | 80,837 | 2,428 | 59,904 | 13,837 | 4,668 | 0 |

**The first finding: what no lane named.** When the ledger was first written, 18,377 of its rows were `unowned`: no plan of this design or the running ones named them, and none of the merged lanes (K, L, G, V, F, P0, P1, P2, P4, R, 0, the sabers' X, the game's 1 and 2) had consumed them. None is hidden: each is given in `scripts/lib/bf2017-owners.mjs` to the lane that takes it, marked `finding: true`, and counted apart in `ledger.md`. By lane and part:

| lane | what it takes | models | textures | data groups |
| --- | --- | --: | --: | --: |
| E | every level's own meshes and maps under `levels/`, `a3/`, `s*/` (the campaign's and the seasons' maps), the light (probes, far shadows, lighting meshes), `systems/` (the sky and post-process tables), the prefabs, the cinematics' sets (as districts); the levels' records, the shader variations, the LOD groups | 163 | 9,471 | 697 |
| O | the seasons' object sets (`s2/objects`, `s3/objects`, `s5_1/objects`, `a3/objects` …) and `levels/clouds` | 2,036 | 1,063 | |
| A | the animations' and cinematics' records and the heroes' ragdoll blueprints (A imports no models: its plan's rigs and clips only) | | | 51 |
| T (#839) | the cast's outfits, heads and body parts not yet imported (the outfit variations), and the characters' records | 578 | 1,230 | 25 |
| 5 (#812) | the weapons, gadgets and hilts not yet imported (`gameplay/equipment`, `gameplay/kits`); the galaxy's loadout takes them through the same import (lane 1, the weapons' rules, has merged, so it cannot own rows) | 321 | 358 | |
| space (this design's Q) | the capital ships under `gameplay/vehicles` and `gameplay/ntcapitalships` | 359 | 205 | |
| X (#836) | the effects' meshes and sheets (`fx/`, `a3/fx`) and their records | 309 | 25 | 26 |
| M | the UI's art outside `textures/ui` and the front end's stages; the localisation, `media2` and `ui_*` records | | 456 | 85 |
| 4 (#812) | the ground and air vehicles not yet imported (`gameplay/vehicles`) | 381 | 319 | |
| 6 (#812) | the other data: prefab and logic blueprints, reports, settings | | | 139 |
| 7 (#812) | the online, persistence, telemetry and platform records | | | 80 |

The surfaces design (#844), landed beside this one, is in the owners table under its own names (`surfaces-Q1` to `surfaces-Q6`; this design's space lane is `space` there, so the two Qs never meet), ahead of this design's lanes where both consume a row: Q1 `materials.jsonl` and `textures/shaders/**`, Q3 the Enlighten rows, Q4 every map's `maps.decals` row (not E0's) and the `FX/Decals` and `_decals` sheets, Q6 the `T_CC_*` colour cubes, `lighting/lut/` and the painted skies. Q2's ground layer maps are named only inside the scatter tables, so they stay the scatter rows' lane N until Q2 lists them. The bucket holds no Enlighten atlas textures yet (its 118 `enlighten` objects are proxy meshes and records); `textures.jsonl` lists the 200 `*_staticIrradianceTexture` sources, never queued, and the ledger has them `not-uploaded` (lane D's upload pass) until they land, when they become Q3's. The owner holds the licence for every font, so there is no `licence` rule: the 23 fonts are lane M's.

The rule is the owners table's `finding: true` entries, first match wins: a folder of a level (`levels/`, `a3/`, `s*/`, `addons/`), the light and the sky → E; any `objects/` set and `levels/clouds` → O; `ui/` and the front-end stages → M; capital-ship names under `gameplay/vehicles` and `gameplay/ntcapitalships` → space; other `gameplay/vehicles` → 4; `gameplay/equipment` and `gameplay/kits` → 5; `characters/` → T; `cinematics/` → E; the animations' and cinematics' records → A; `fx/` → X; `data/` by top folder (online and platform → 7; the rest → 6). The ten largest prefixes, which tell E, O, T and the game's lane 5 how far their scope grew:

| prefix | lane | rows |
| --- | --- | --: |
| `levels/sp` | E | 3,063 |
| `levels/mp` | E | 2,766 |
| `s6_2/geonosis_02` (its level meshes and maps) | E | 1,021 |
| `a3/levels` | E | 847 |
| `gameplay/equipment` | 5 | 625 |
| `s3/objects` | O | 620 |
| `gameplay/vehicles` (the capitals) | space | 562 |
| `s6_2/geonosis_02` (its object sets) | O | 520 |
| `gameplay/vehicles` (the rest) | 4 | 472 |
| `characters/heads` | T | 455 |

A lane that merges sets its `merged` in `LANES`; from then `npm run coverage:bf2017` fails on every row it still owns and has not used, which is the next design's finding.

**Corrections to this file**, in the spec's §7: lane L's "then Endor" is E0's; the placed lights are drawable today and E runs `bf2017-lights.mjs` per world; the fonts, icons and strings are lane M's for the whole site, the game's lane 5 consumes `src/lib/bf2017/ui/`; the collision meshes and the animation tracks had no consumer in any design and have one now (E0, Q).

## Done

- **The design, the inventory and the plans** (PR #802, carried by the phase 0 PR).
- **Phase 0, the tools** (PR #805): the decision entry and the assets page; `scripts/bf2017-fetch.mjs` and `scripts/bf2017-import.mjs` over five tested modules under `scripts/lib/` (`bf2017-manifest`, `bf2017-paths`, `bf2017-textures`, `rig-parts`, `catalog-write`); the committed fixture (`scripts/fixtures/bf2017/`, 39.6 KB); the empty `catalog/bf2017.js`, last in `GROUPS`. Nothing on the site changed. Tried on two real models and nothing kept: Luke’s hilt (920 triangles, 212 KB, the shot in `docs/superpowers/evidence/bf2017-phase0/`) and Luke’s rotj body with `--rig` (the whole rig kept, 254 joints with fingers, face and physics; LOD2 706 KB, LOD4 236 KB; drawn in its bind pose).
- **The second design and four more plans** (this PR): lanes L, G, K and X below, and the corrections to the first design (its section "The review of #802").
- **The surfaces design** (2026-10-10 night, `HANDOFF-bf2017-surfaces.md`): how the game makes its picture from these assets and the six layers the site lacks (the surface shader's parameters, which are in `web/materials.jsonl`; the ground's layers; the baked Enlighten atlases, which exist; weathering and decals; the texture quality; the picture); lanes Q1 to Q6 there.
- **On the desktop, 2026-10-10 00:20**: the 102 planet skins encoded (KTX2 at up to 4096, hybrid) and linked raw, both queued; 164 clips with `~` in their names (refused by Supabase as `InvalidKey`) renamed `-`, `web/anims.jsonl` rewritten and re-uploaded; 119 physics files queued. The pipeline’s upload passes pick them up (`logs\pipeline_status.txt`).
- **On the desktop, 2026-10-10 morning: lights, effects, decals, creatures, vehicles and terrain scattering**, in the bucket under `web/maps/` (format: `web/maps/README.md`):
  - every map now has `maps/<level>.extras.json`: 49,632 placed lights (spot, sphere, rect, tube; colour, intensity in lumens, range, cone, cookie, per sub-level), 52,027 effect spawns (the `EffectBlueprint` name), 13,984 decals with their textures, and the sun, sky, fog, tonemap and colour grading of each VisualEnvironment. Hoth: 1,234 lights, 648 effects. Spot and rect lights shine along local -Z;
  - placed creatures, droids and civilians (3,425, kind `actor`) and vehicle spawns built from their parts (2,925 of 2,971);
  - `maps/terrain_scatter/<terrain>.json` for the 39 terrains: each paint layer's grass, ferns, debris and backdrop trees (mesh, density per m², scale, wind), 739 types, plus the ground's surface textures;
  - 600 models placed on maps that the web build had skipped, now packed and uploaded.
  - Still missing: where scatter grows (the terrain's layer masks, format half decoded in the README), the terrain's painted decals, and audio.

## The lanes

| Lane | Plan | What | Starts from | Blocked by |
|---|---|---|---|---|
| 1 | `2026-10-10-bf2017-phase1-heroes.md` | the heroes on the game’s skeleton, the game’s clip packs, the hilts in `Wep_Root` | `main` | nothing |
| 2 | `2026-10-10-bf2017-phase2-everyone.md` (on #802’s branch) | everyone else the game has | `main` after 1 | 1 |
| S | `2026-10-10-bf2017-phaseS-streaming.md` (on #802’s branch), **amended below** | the fetch pool, aborts, the small cut first, the stream check | `main` | nothing |
| **L** | `2026-10-10-bf2017-phaseL-levels.md` | the worlds on the game’s levels: the map’s layout, the heightmap, the shapes, cell-streamed; Hoth first | `main` | nothing (lane S’s pool when merged; `fetch` until then) |
| **G** | `2026-10-10-bf2017-phaseG-lighting.md` | the worlds under the game’s light: VisualEnvironment records, probes, the baked far shadow, grading, weather | `main` | nothing (its far-shadow hook into lane L’s far draws when L is merged) |
| **K** | `2026-10-10-bf2017-phaseK-planet-skins.md` | the planets wearing the game’s skins from orbit | `main` | the skins landing in the bucket (queued; check) |
| **X** | `2026-10-10-bf2017-phaseX-sabers.md` | the sabers from the game’s clips: stroke tables, the stance, the hold, the blade’s light | `main`; tasks 3–4 after 1 | 1 for tasks 3–4 |
| V | `2026-10-10-bf2017-phaseV-vehicles.md` (on #802’s branch) | vehicles | `main` after 2 | 2 |
| F | `2026-10-10-bf2017-phaseF-effects-lighting-lines.md` (on #802’s branch) | effects; its task 3 (lighting) is lane G’s now; its task 4 (sound) waits on an exporter, see below | `main` after L, G | L, G |
| W | `2026-10-10-bf2017-phaseW-worlds.md` (on #802’s branch) | **superseded by lane L**; do not run | | |

One lane per session; L, G, K and lane 1 may run at once (they own different files; `sites/ice.js` is touched by L and G, each on its own keys; merge `origin/main` before the PR and keep both sides). X after 1.

### Lane S, amended

`main` already has the asset host (planet flight lane I): `src/lib/assetBase.js`, `src/lib/assetPath.js`, `scripts/assets-upload.mjs` (bucket `assets`, `<hash12>/<path>`, a year’s cache, `--prune`), `src/data/assets-manifest.json`, the packs and the service worker carrying bucket URLs, `VITE_ASSET_BASE`. Lane S therefore does **not** create `assetUrl.js`, `galaxyAssets.json`, `assets-publish.mjs`, `assets-ignore.mjs` or a `site-assets` bucket. It keeps: task 1 (`scripts/lib/pool.mjs`), task 2 (the fetch made robust), task 4’s `assetFetch.js` and `progressive.js` with `assetBase.js`’s `withFallback` calling the pool (one in-flight per URL, priority, the short-body check, abort per world, progress), task 6’s `stream-check.mjs`. Task 3 becomes: `REMOTE` in `assets-upload.mjs` gains `models/galaxy/bf2017` and `textures/galaxy/bf2017`; `catalog.test.js`’s size checks read `assets-manifest.json`’s `bytes` when a file is absent. Task 5 (the service worker) is already done by lane I; check `sw-check.mjs --bucket` and drop the task if green.

### Lane K: the planet skins

**Done** (`claude/bf2017-k-planets`). The bucket listed 103 planet textures on 2026-10-10 (`web/textures.jsonl`); every non-sequel one was fetched (69, all as PNG) and looked at. The space levels' colour (`_CS`, smoothness in alpha), normal (`_N`, `_NI`) and cloud maps (coverage in alpha) are whole-planet maps stored square and seamless round the planet: the game's planet meshes (`levels/space/*/planet/planet_*_mesh`, `objects/planets/_planetmeshes/planet_01_mesh`) bind no texture (a shader asset, `SS_Planet_*`, does) and carry UVs once round and pole to pole once, so the site lays them on the same way. The front end's `_CA` globes, Endor's gas giant and Yavin's are pictures of a lit disc.

- Skinned: **Endor** (colour, relief, clouds, its air's colour), **Naboo** (colour, relief, clouds), **Kamino** (colour, its sea), **Bespin** (colour), **Geonosis** (rings only).
- Stay procedural, their only maps being pictures (`PICTURES`): Endor's gas giant, Geonosis's globe, Hoth, Kashyyyk, Scarif, Tatooine, Yavin, Yavin 4.
- In the drop with no body on the site (`UNPLACED`): Ryloth and its moon, Fondor and its moon, Athulla, Sullust, Pillio, Vardos (whole-planet maps like Naboo's), Kessel, Felucia, the Death Star II (globes), Naboo's moon.
- The code: `scripts/bf2017-planets.mjs` over `scripts/lib/bf2017-planets.mjs` (`SKINS`, `PICTURES`, `planFor`, `convertSkin`; fixture `scripts/fixtures/bf2017/web/textures/levels/space/sb_endor_01/planet/`), `src/data/planetSkins.json`, `public/textures/galaxy/planets/<id>/<kind>-<tier>.webp|ktx2` (mid 1024, high 2048, ultra the colour and normal UASTC; never larger than the game drew it), `bodySkin.js` (the chunk, spliced in only for a skinned body: an unskinned one compiles byte for byte what it did, `bodySkin.test.js` holds each family's hash), `bodies.js` (loads a skin on mid and up, not low or a small body; eases it out between 1.5 × and 1 × the air's top, the air's colour with it; frees every map with the body), `REMOTE` gains `textures/galaxy/planets`. Scarif's shield shaders moved to `bodyShield.js` (re-exported) to keep `bodyShaders.js` under 800 lines.
- The shots: `docs/superpowers/evidence/bf2017-planets/`.

**Left**: `assets-upload.mjs` for the new files (the owner's key). Asked of the desktop export: the `SS_Planet_*` shader assets (how the game tints and mixes the maps) and whole-planet maps for the worlds that have only a globe picture. Not checked: the relief's sign at a grazing sun (`greenDown`; the shots are lit from the default angle); a skinned planet flown down to in a real browser (the mix is unit-tested; the shots are from orbit). The game shows only a planet's facing half (its planets are backdrop domes, `planet_endor_02_mesh` 81 m wide and 20 m deep, UVs u 0.23–0.73 over 180°): the site wraps the same map once round, the same scale, and the back is the map's own seamless remainder. For the space layer, not this lane: the 2:1 sky panoramas the desktop is encoding (`textures/levels/space/sb_endor_01/planet/t_space_endor01_c`, `textures/lighting/textures/space/t_space_01_c`, `t_space_no_large_stars_01_c`, Athulla's, the sky cube `textures/levels/sp/a1/m1end/lighting/textures/t_sky_space_01_c`) and the generic prop planet (`objects/planets/_planetmeshes/planet_01_mesh`, `t_planet_01_rgba`, `t_planet_01_n`). The front end's globes could tint the galaxy map's discs (the plan's optional task; not done). A world placed later (Ryloth, Fondor…) takes its maps by a line in `SKINS`.

**Checking it**: `NODE_USE_ENV_PROXY=1 node scripts/bf2017-planets.mjs --dry` (keys in the environment), then without `--dry`; `QUALITY=high OUT=/tmp/s node scripts/galaxy-check.mjs space naboo,endor,bespin`.
- **Phase 1, the heroes on the game's skeleton, with their hilts** (this PR, `claude/bf2017-phase1`):
  - `public/models/galaxy/bf2017/walrus.glb`: `Walrus_HumanMale` whole, 254 nodes (`scripts/bf2017-skeleton.mjs`); `src/lib/three/walrusRig.js` names its body, fingers and sockets, `WEAPON_FRAME` (the identity: the game models weapons in the `Wep_Root` frame).
  - The game's clips as packs (`scripts/bf2017-clips.mjs`, names mapped by `src/lib/three/walrusClips.js`): `clips-humanoid.glb` 843 KB (27 clips), and one a hero: Luke 1,323 KB (45), Vader 1,269 (42), Obi-Wan 1,069 (39), Anakin 1,187 (38), Maul 1,179 (41), Dooku 1,153 (38), Palpatine 459 (15), Han, Leia, Lando, Chewbacca, Boba Fett, Bossk 92-141 KB (their defeat and abilities). 24 fps, root motion off `AITrajectory` into `extras.root`, `contact` timed on a blade a metre up `Wep_Root`, rest-holding channels left out and put back by the loader. Luke's blocks come from the cinematic skeleton (`Walrus_NIS_S0800_Skeleton`, the same rig at the same rest).
  - `src/lib/three/walrus.js` loads a 2017 body with its packs; footScene's `walrusFigure` wraps it in the same `rigged()` every figure gets, the animator told `library: false`. Both figure paths (`crew.js`, `loadPartyFigure`) take `rig: 'walrus'`.
  - Thirteen heroes, each in three cuts, at the game's native fidelity (the owner's ask, 2026-10-10: "the native mesh, max quality"). Each map is the game's own KTX2: UASTC, zstd-supercompressed, a full mip chain. It is never decoded and re-encoded; a smaller cut drops the top mip levels from the same file (`scripts/lib/ktx2-levels.mjs`). The mesh keeps the game's 16-bit precision (meshopt positions 16, normals 12, UVs 16).
    - Why not WebP or AVIF, measured against the unpacked UASTC:
      - Halving to 1024 gave 20 dB PSNR: the blur the owner saw.
      - WebP lost colour wherever the smoothness alpha sits in the colour map: 34 dB at any quality.
      - AVIF reached 45 dB on normals.
      - The native file loses nothing against the game, and costs a byte a texel on the GPU (BC7 or ASTC), against four for a decoded image.
    - The three cuts, made with `--native` (`--tex 1024 --maps 1024 --ultra --ultra-tex 2048 --ultra-maps 2048 --cuts plain=0,lod1=<n>,ultra=0`):
      - `<kind>.ultra.glb`: LOD0, every map at 2048, 18–53 MB, 28–96 MB of GPU textures. Loaded at ultra.
      - `<kind>.glb`: LOD0 at 1024, 7–16 MB, 10–24 MB of GPU textures. Loaded at high.
      - `<kind>.lod1.glb`: the light mesh at 512, 2.3–4.2 MB, 3–6 MB of GPU textures. Loaded at low and mid, and always first.
    - Before, with WebP, Luke's ultra cut was 384 MB of GPU textures; now it is 68.
    - The caps: `scripts/lib/bf2017-caps.mjs` (`NATIVE_CAPS`: 16, 5 and 64 MB). `crew.budget.test.js` holds each cut to them on disk, reading a published file's bytes from `galaxyAssets.json`, and holds an on-disk cut to the GPU caps too.
    - Light first, then swapped (`lib/three/walrus.js`'s `cutsToLoad` and `swapBody`; `footScene`'s `walrusFigure`, which both figure paths use): a 2017 figure stands in its `.lod1` the moment it lands. The level's cut follows and its skinned meshes are bound to the same bones, so the animator, the sockets and the saber never notice. On a saver connection it is the light cut only.
    - The files are `public/models/galaxy/bf2017/crew/<kind>.glb`, credited `bf2017-<kind>`; the skeleton and the clip packs by one pack credit, `bf2017/walrus` in `public/games/credits.json`. Of the Meshy and Sketchfab files at `galaxy/crew/`, Luke's, Han's, Leia's, Vader's and Palpatine's stay: the universe's foot party, the Death Star's people, `scripts/motion/bake.mjs`, `ual-bake.mjs` and `meshy-actions.mjs` load them as Meshy figures. Boba Fett's, Obi-Wan's, Maul's, Lando's and Dooku's, which only the galaxy used, are gone with their credits.
  - The heroes' outfits (`heroes.js`'s `SKINS`, an Outfit tab in the loadout): 25 of their kits' visual unlocks in the game (`Kit_Hero_*` → `VUR_*`), the sequel trilogy's left out (Chewbacca's EP7 look, Palpatine's EP9). Each is a native file of its own on the same skeleton, a `CREW` row with the hero's `pack`, credited `bf2017-<kind>`; each one's body, parts and head are in `modelCredits.json`'s title and `docs/superpowers/evidence/bf2017-phase1/skins.tsv`. The heads are matched by name and era, since the game's mesh-variation databases are not in the bucket; a render of each checked them. Obi-Wan's Jedi-robe outfit has red lower legs, which is how the game's own map for it is coloured.
  - Eight more heroes are playable: Obi-Wan, Anakin, Vader, Palpatine, Maul, Dooku, Lando and Bossk, joining Luke, Leia, Han, Chewbacca and Boba Fett.
  - The files are in the `site-assets` bucket: 143 of them, 1.91 GB, listed in `src/data/galaxyAssets.json`. `walrus.glb`, `clips-humanoid.glb` and `clips-luke.glb` stay committed as well (`asset-manifest.mjs`'s `KEPT`), because tests read them whole. A test that only asks whether the site has a file takes a published one as there (`onSite`).
  - `rig-parts` puts each vertex of a part where its own joints put it. A helmet's `PROC_*` bones share the body's names but are other bones, so they are bound to the nearest parent the two share.
  - A 2017 figure passes `boneCapsules.js`'s `isGameSkeleton`, so bolts hit it where the game's capsules say (`footScene.walrus.test.js`). `ragdoll2017.js` (lane P2's, #820) is ready for whoever wires the dead fall. The call is `rigRagdoll` at `src/components/galaxy/surface/ground/groundFigures.js:345`, with ragdoll2017's table for a figure with `rig: 'walrus'`. That wiring is not this phase's: the owner keeps the physics lanes.
  - The clip packs carry each clip's game name exactly in `extras.source`, which lane X asked for.
  - Ten hilts and three hero blasters, `--keep-origin`, at the game's own maps; `HILTS` wear them; the saber and gunplay put the weapon in `Wep_Root` on a 2017 figure, the clip's arms and fingers holding it, the aim on the chest.

- **The heroes' abilities from the game's gameplay data** (after phase 1): `scripts/bf2017-abilities.mjs` (pure part `scripts/lib/bf2017-abilities.mjs`, fixture `scripts/fixtures/bf2017/abilities/`) reads each hero's kit (`GP_Hero_<Hero>`), its abilities' times and modifiers, the prefabs' graphs (field hashes decoded: djb2 with xor), the affectors they apply (damage by rank, to a hero or a trooper by the heroes' descriptor filter) and the hero's own hit points, into `src/data/bf2017Abilities.json` (16 heroes, 50 abilities, 26 KB, each number with where it came from). `surface/abilityRules.js` makes cards of them at the game's numbers (a trooper's 150 is a stormtrooper's hp 2 here: `GAME_HP` 75); `surface/powers.js` plays the ones that last or draw (choke, held lightning, chain lightning, lightning stun, repulse and slam, rush, rage, exposed weakness); Obi-Wan, Anakin, Vader, the Emperor, Maul and Dooku joined the roster (`heroes.js`). Seven packs re-made with the kits' clips (`walrusClips.js`'s `force.*` and `saber.throw`; every older clip the same in channels, frames and extras): Vader +3, Maul +3, Palpatine +3, Dooku +2, Anakin +2, Luke +1, Chewie +1.

## Left

- **Abilities the data doesn't give a number for**, so the site's stand in (`abilityRules.js` names each): a rush's distance (the game moves the hero by its clip's root motion), a choke's lift, the held lightning's meter and tick, chain lightning's leaps, a lightning stun's length, Vader's throw range (output 975835047, unnamed), the Emperor's electrocute damage (its affector's ranks are 0; the damage comes from a DamageUnlock not in the drop). Output hashes no prefab names plainly (824196892, 2540124558, 1209176742, 318822392, 1736361408, 1839311751, 3649387485, 4153564376, 3860256841, 1085079986, 1845711460, 1724747203, 900427946, 838726700) are left out of the file.
- **The kits' third abilities** the two keys leave out (heroes.js's comment lists them); Yoda's and Grievous's kits are in the file, waiting on their own rigs; Lando's and Bossk's too, waiting on a place in the roster.

In order:

1. **Lane 1**: the owner chose, on 2026-10-10, to keep the 2017 rig in full: no pruning, no renaming to Meshy’s names; the site learns the game’s skeleton. Phase 0’s rig prune (plan task 4) was written, tried on Luke (254 joints to 63, and his fingers and face went with it) and then taken out; the import keeps all 254 and puts `grip` under `Wep_Root`. Its first rigged import should check `skins.length === 1` and that a figure’s joint count equals its body’s (the parts’ duplicate skeletons joined by `rig-parts.mjs`). Its task 2 adds parts by full manifest name (Luke’s head and hair are under `characters/heads/`, not his body’s folder: the body alone is 1.596 m and headless) and the spine rename; both go into `partsOf`, so the fetch’s `--parts` takes names too. The clips are glTF on the game’s skeletons (`web/anims.jsonl`; 164 renamed today: a name with `-<8 hex>` was `~<8 hex>` in an older manifest).
2. **Lanes L, G, K, X** as the table says.
3. **Textures**: every map the hilt and Luke’s body name was in the bucket as KTX2 on 2026-10-10, none as PNG. A map not there yet prints `missing:` in the import and the material goes without it; re-fetch and re-import when the upload has it.
4. **Normals as KTX2** (UASTC) where `scripts/ktx2.mjs report` says it pays: phase 9’s, with the ultra cuts. Level packs (lane L) take the bucket’s KTX2 as it is, for GPU memory.

## Lane X, the sabers

**Done (tasks 1–2, #816).** `scripts/bf2017-strokes.mjs <hero>` measures a hero’s clips into `src/data/bf2017/strokes/<hero>.json` over `scripts/lib/bf2017-strokes.mjs` (tested against a 10 KB fixture, Luke’s first strike on the socket’s chain only, `scripts/fixtures/bf2017/web/anims/`). Each strike: duration, contact window, the way it cuts (`DIRS`), sweep plane, root rows, its return and the return’s length; blocks by side, blocked reactions, staggers, dodges, dash, jump attack, defeat, the generic humanoid (`A_HM_*`) where a set lacks one. `stanceFromTable.js` makes the table a stance; `gameStance.js`’s `stanceFor(id, hero)` gives it for `{ rig: 'walrus', pack }` with a table (kept out of `combatRules.js`, which the universe’s online protocol imports for `STANCE_IDS`: with the tables behind it the flight pages carried them and fly-check’s turret took 3.2 s against main’s 2.7); `strokeFor` reads a stance’s own `heavies` and `dirs`; `duel.js` takes `cadence` (held a strike’s length, open its return’s length after); `duelFor` finds the hero by the spawn’s kind in `CREW`. Nothing changes for a figure without `rig: 'walrus'`, and no figure on `main` has it until lane 1 merges.

**How the tables were made.** From the bucket (`node scripts/bf2017-strokes.mjs <hero>`, keys in the shell’s environment and the Supabase host allowed in the environment’s network settings; Node’s fetch needs `NODE_USE_ENV_PROXY=1` behind the session’s proxy): every `A_<Hero>_*` clip on the humanoid skeleton, the cinematics skeleton (Luke’s seven swing blocks a side and his six blocked reactions are there) and a hero’s own (Yoda’s, Grievous’s), nine tables in all. `--pack` measures one of lane 1’s packs instead, for a session without the bucket (a pack holds fewer clips than the bucket, so its table is narrower: a check, not a re-make; `scripts/bf2017-clips.test.mjs` holds a pack to its table). It reads a pack’s `source` in either spelling (`sourceName`), and a run that measures nothing writes nothing. Grievous spells a strike with a take (`Strike3_01`) and a blocked reaction with a side (`Blocked_Right_02`); Yoda has no `_BackToIdle`, so his duel recovers on the site’s own timing; Palpatine’s set has no saber strikes, so his table makes no stance.

**Findings for lane 1.** The socket frame holds: `Wep_Root` (under `Spine2`) carries the blade along +y. But `bf2017-clips.mjs`’s windows, timed with ual-bake’s 0.15 m before the hips along +z, land on the snap out of the guard: a strike’s first key is the guard and its second already the wind-up, as fast as the cut (Luke’s Strike1 `[0.05, 0.10]`, the cut is 0.1–0.23 s). The tables skip the first key, count a frame only when it and the one before have the tip before the hips along +z (the root’s way; the hips’ own facing is worse, the game’s guard holds them 50° to 170° round), and add the root’s travel to the tip (Luke’s Strike4 and Obi-Wan’s are lunges). Two fixtures are pinned by hand: Luke’s Strike1 `[0.107, 0.293]`, Obi-Wan’s Strike4 `[0.274, 0.426]`. A pack’s turns are meshopt-normalised shorts: read them with `valuesOf`. The blade rests 0.33–0.9 s into a strike (`settle`) though the clips run 1.3–4.8 s (the game holds the pose for the chain); the duel holds a strike till `settle`, then its return’s length.

**Done (task 3, after lane 1).** A 2017 hero’s saber (`saber.js`, additive) fences with the game’s strokes: its stance is `gameStance.js`’s `stanceFor`, the hero read from its strike clip’s game name (`saberGame.js`’s `heroOfClips`); its clips are found by the game’s names as well as the pack’s (`gameClips`); a stroke’s own measured window wins over the pack’s `extras.contact` (lane 1’s, timed by ual-bake’s rule: Luke’s first strike `[0.05, 0.101]`, the guard snap; the table’s `[0.14, 0.293]`), a stroke named outright (a duellist’s, a peer’s) by that stroke’s own; the blade comes out of the hilt’s emitter (`BLADE_OF`, a staff’s second out of the other end); a lit blade lights the scene (`saberLight.js`: high and ultra, four at once at most, going to the nearest lit blades rather than the first made, so a far duellist’s never keeps yours dark; out past 12 m of the camera, which every saber is handed as `eye`: `scene.js`’s party, `activity.js`’s duellists through `heldBlade.js`, `peers.js`). Seen in the browser: `docs/superpowers/evidence/bf2017-sabers/`.

**Done (lane 1’s packs re-timed).** `bf2017-clips.mjs` times a stroke with this lane’s `measure` (and its `clipOf` and `rigOf`, in place of the script’s own copies), on the game’s clip as it comes, before the resample, at the measure’s own 30 a second (not the pack’s 24: Luke’s first strike would open 0.075 s early): a pack’s `extras.contact` is its table’s, every strike, dash and jump in the seven heroes’ packs (66) to the millisecond (Luke’s first strike `[0.05, 0.101]` → `[0.14, 0.293]`; `scripts/bf2017-clips.test.mjs` pins the fixture’s and holds `clips-luke.glb` to `luke.json` to a frame). Blocks, blocked reactions and the pound moved too, with no table to hold them to. `clips-luke.glb` is made again: its binary chunk is byte for byte the old one, its JSON the same but for `contact`. The six packs only `site-assets` holds (Vader’s, Obi-Wan’s, Anakin’s, Maul’s, Dooku’s, Palpatine’s) were made again outside the repository and checked the same way; all seven are published (`assets-publish.mjs`, by content hash: `galaxyAssets.json` names the new ones, the old stay in the bucket; `assets-check.mjs`: 371 of 371 right).

**Done (task 4, blocks by side).** `saber.block(on, side)`: `side` is the side of the figure a cut comes in on (`blockSide.js`: `cutOf` reads the way a stroke cuts, a 2017 hero’s from its stance’s `cuts`, the table’s measured `side`, the site’s from `DIRS`; `incomingSide` mirrors it for the one it faces, keeps it from behind, and gives none side-on, |cos| of the turn between them under 0.25). A 2017 hero lays the game’s block measured holding the blade on that side, the next variant each raise (a count, not a roll), chosen again only when a cut comes in on the other side and eased over in 0.12 s; with no side, or none measured there, `BLOCK_CLIP`, as before (the table’s `any` only for a figure without it: it is mostly the parry’s stagger, held low or behind, and Obi-Wan’s, Anakin’s, Maul’s and Dooku’s packs carry it as `sword.blocked`; a side with no block measured on it stays empty, never padded with it). A figure on any other rig keeps its one block, whatever the side. The side is measured, never read off the name: each table carries `held` (`{ at, tip }`: the tip a metre up `Wep_Root`, less the hips, on the root’s axes, at `HELD` of the clip, `saberRules.js`’s `BLOCK_AT`, 0.32, the frame the site lays), and `blocks.left`/`right` go by the sign of its x. 49 of the 52 blocks with a side in their name (the swing blocks, and Palpatine’s six) hold the blade on the figure’s left, 24 of the 25 named Right among them: the game’s heroes stand side-on (Luke’s idle has the pelvis 52° and the shoulders 64° round to his left; Vader’s blocks the shoulders 105–112°), so a cut from a hero’s right mostly falls to `BLOCK_CLIP`. Only Obi-Wan’s SwingLeft_01 and _03 and Dooku’s SwingRight_04 hold it on the right. Luke’s pack has two of his fourteen, both on his left: a cut from his left (a strike from the striker’s right, 40 of the game’s 90) alternates SwingLeft_01 (the game’s hanging guard) and SwingRight_01 (overhead); from his right, overhead or none, `sword.block` as before. Wired: your block takes the side of the nearest duellist swinging at you (`duellists.js`’s `incomingAt`, from `scene.js`); a duellist’s, the side of your stroke (`swingingOf` carries its `cut` and your `yaw`, `stepDuel` sets `t.blockSide`, `activity.js` and `heldBlade.js` pass it on). The nine tables were made again from the local cache of the bucket’s clips (`lab/assets/bf2017`, no `--pack`): only `blocks` and the new `held` changed, 0.15–1.14 KB a table. Two fixtures more, cut to the socket’s chain: Obi-Wan’s SwingLeft_03 (on his right) and Luke’s SwingRight_01 (the cinematics’ skeleton; on his left).

**The side a cut comes in from.** Each strike, dash and jump carries `side` (`strokeSide`): the side of the striker its tip comes in from, its travel across the window less the hips, on the root’s axes (the line the one it meets stands on: the site turns a figure by its root, and `held` is read on them too), none when it goes more up or down than across. `dir` stays the way for the keys (A, D), read on the hips’ facing, which a strike turns as it cuts: Luke’s second, the second of every chain, turns them 56° to 96° round in its window and reads `right` there, but comes round the front from his left, so it was blocked on the wrong side of you. `cuts` is built from `side`. Of the 90 strikes, dashes and jumps, 36 differ from `dir`: 17 flip side (Luke’s Strike2, Strike2_V2, Strike6_V2; Vader’s Strike6; Obi-Wan’s Strike2, Strike3_V2, Strike6_V2, Dash_Exit_02; Anakin’s Strike2_V2 to 5_V2, Strike6; Maul’s Strike2_V2, Strike3, Strike5; Dooku’s Strike1_V2), 15 go from none (an `up` or `rise`) to a side, 4 from a side to none. The tables made again from the cache: only `side` and the un-padded `blocks` changed. One fixture more: Luke’s Strike2 (from his left). A cut wound up from behind the shoulder opens its window there and ends it low in front, so its ends read as a drop: when they give no side it is read where the tip is before the hips, and eight more come in from a side (Vader’s Strike1, 2, 2_V2 and 4, three of his six in the chain, which Obi-Wan, whose pack is the one with a block held on its hero’s right, met with the left one; Anakin’s Strike4; Yoda’s Strike5; Obi-Wan’s and Yoda’s jumps), no side already read changing. A block held before the cut takes its variant once, as it goes up, not again when the cut’s side arrives. `saberLight.js` counts a blade’s place among those holding a light, so a blade no update reaches any more never keeps a live one dark; one put away to ride (yours, your mate’s, a peer’s) or taken by a show (a duellist’s) lets its light go (`dark()`), and a thrown blade takes its light with it.

**Left.** The frame time with four lit blades on a GPU (SwiftShader drew 4.8 s a frame, which says nothing), and the light’s brightness looked at against the bloom there; the blocks by side looked at in the browser (`__surfaceDo('duel', 'vader', { ahead: 5 })`, hold C; a block lays only the arms and the socket over the figure’s own hips, so the blade shows a little off the measured tip, read on the clip’s own hips, though on the same side for every clip checked against the idle); the game’s held-block loops (`L_<Hero>_Stand_Idle_Block_01`, Vader’s and Dooku’s `_Left_01` too, all holding the blade on the figure’s left; Luke’s is SwingLeft_01’s opening) are in neither the tables nor the packs; the forms lane reads the tables (saber-forms B); the clash sheet (lane F); the sounds (an exporter).

**Checking it.** `npx vitest run scripts/lib/bf2017-strokes.test.mjs scripts/bf2017-clips.test.mjs src/components/galaxy/surface/stanceFromTable.test.js src/components/galaxy/surface/gameStance.test.js src/components/galaxy/surface/saberGame.test.js src/components/galaxy/surface/saber.game.test.js src/components/galaxy/surface/saberLight.test.js src/components/galaxy/surface/blockSide.test.js src/components/galaxy/surface/saber.block.test.js src/components/galaxy/surface/duellists.side.test.js src/lib/combat/duel.test.js` (`bf2017-clips.test.mjs` holds `clips-luke.glb` to `luke.json` to a frame); in the browser, Luke on Hoth and `__surfaceDo('duel', 'vader', { ahead: 5 })`. `node scripts/bf2017-strokes.mjs luke --pack public/models/galaxy/bf2017/clips-luke.glb` prints the pack’s strikes (it writes `luke.json` too, narrower than the bucket’s: `git checkout` it after).

## Asked of the desktop exporter (not the site’s work)

The export in `C:\Users\tilak\Downloads\BF2_Extract` (`tool\bf2export.csproj`, Frosty’s libraries):

- **Lights**: done, in `maps/<level>.extras.json` `lights[]` (not a separate `.lights.json`): type, position, quaternion, colour, intensity, range, cone, emitter size, cookie, per sub-level. Lane G gets the hangar’s lamps and Theed’s lanterns from there.
- **Effects**: done, `effects[]` in the same file: the spawn transform and the effect’s `EffectBlueprint` name, for lane F.
- **Decals**: done, `decals[]`: 13,984 placed decals do have transforms (10,652 volume decals, 3,332 projected), with their textures in `shaderTextures`/`textureFiles`. Only the terrain’s painted decals are in a terrain resource.
- **Terrain scattering**: what grows on each paint layer, done (`maps/terrain_scatter/`); where it grows waits on decoding the layer masks.
- **Audio**: still not exported. `GUIDE.md` says 17,509 sound assets. Frosty can write a `SoundWaveAsset` as `.wav`; without a `bf2export sound` pass, lane F’s sound map stays `null`.

1. **Phase 2, everyone the game has**: done in part; its own section below says what is left.
2. **Yoda and Grievous**: their own rigs (`Yoda_01_Ske`, `GeneralGrievous_01_Ske`) and clips (101 and 161); not imported this phase, they stay as they were until their own-rig packs (phase 10's).
3. **Site clip names the game has nothing for**, which fall back (`CLIP_FALLBACK`, else the humanoid pack's): Vader `sword.dash`, `sword.pound`, `force.push`; Anakin's staggers (the humanoid flinches stand in); Dooku `sword.aerial.a`, `sword.uppercut`; Palpatine every stroke (he fights with lightning in the game); the blaster heroes' dodges.
4. **Textures not in the bucket yet**: Leia's braids (`t_lodcaps_braids_01_brown_cm`, `…_n`), and the game's generic eye map (`T_Eye_MP_DA`): the human heroes wear Luke's eye map, its white lifted. Re-import when the upload has them.
5. **A dual stance on a 2017 figure** holds one hilt: the game's heroes don't dual-wield; `Wep2_Root` is there for it if the site wants one.
6. **Repository weight**: the native heroes, outfits and blasters are published to the `site-assets` bucket (`scripts/assets-publish.mjs`, `src/data/galaxyAssets.json`) and out of git.
7. Phases 3 to 10 as the spec's table orders them.
8. `WEAPON_FRAME` re-measured if a weapon sits wrong; the hilt sheet and the duel shots say it doesn't.

## Checking it

The keys: `SUPABASE_URL` and `BF2017_KEY` (a key that can read the private `bf2017-assets` bucket) in `.env.local`, never committed; the owner holds them. In a cloud session they are already environment variables (the key as `SUPA_KEY`; the fetch takes either), so drop `--env-file`.

```
node --env-file=.env.local scripts/bf2017-fetch.mjs manifest
node --env-file=.env.local scripts/bf2017-fetch.mjs --list 'gameplay/equipment/heroes/*'
node --env-file=.env.local scripts/bf2017-fetch.mjs gameplay/equipment/heroes/lightsaberlukeskywalker/lightsaberlukeskywalker_meshp_mesh
node scripts/bf2017-import.mjs gameplay/equipment/heroes/lightsaberlukeskywalker/lightsaberlukeskywalker_meshp_mesh --kind hiltluke --as 'Luke’s lightsaber hilt' --asis --keep-origin --native --tex 2048 --maps 2048
npx vite --port 5188 --strictPort --host 127.0.0.1 &
node scripts/glb-shot.mjs public/models/galaxy/surface/hiltluke.glb /tmp/hiltluke.png three
```

The bucket’s other parts, by path under `web/` (fetch one with the fetch’s `--raw <path>`, which lane L adds; until then `curl -H "Authorization: Bearer $SUPA_KEY" -H "apikey: $SUPA_KEY" "$SUPABASE_URL/storage/v1/object/authenticated/bf2017-assets/web/<path>"`):

| part | path | manifest |
|---|---|---|
| maps (74) | `maps/<level>/<level>.json` + `.bin`, `maps/index.json`, `maps/README.md` | `maps/index.json` |
| terrain (39 levels) | `terrain/<level>/*_height.png`, `*_detail.png`, `.json` | `terrain.jsonl` |
| physics (10,530) | `physics/<model>.json` | `physics.jsonl` |
| clips (10,270) | `anims/<skeleton>/<clip>.glb`, `anims_additive/` | `anims.jsonl` |
| light records | `data/Levels/Lighting/<World>/<Weather>/VE_*.json.gz`, `T_CC_*.json.gz` | `data.tsv` |
| probes, shadow caches | `textures/levels/<level>/reflectionvolumetexture/<variant>/<id>-tex_{px,nx,py,ny,pz,nz}.hdr`, `distantshadowcachetexture/<variant>/<id>-tex.png` | `textures.jsonl` |
| planet skins (102) | `textures/**/planet*/…`, `textures/levels/space/*/planet/`, `textures/objects/planets/` as `.png` and `.ktx2` | `textures.jsonl` |
| movies, fonts, svg, strings | `movies/`, `fonts/`, `svg/`, `strings/` | `misc.jsonl` |

The tests need no keys and no network: `npx vitest run scripts/lib/bf2017-* scripts/lib/rig-parts.test.mjs scripts/lib/catalog-write.test.mjs scripts/bf2017-import.test.mjs src/components/galaxy/surface/catalog`.

Phase 1's, with the dev server up:

```
node scripts/bf2017-fetch.mjs anims
node scripts/bf2017-clips.mjs luke
node scripts/bf2017-import.mjs characters/hero/luke/luke_rotj_01/luke_rotj_01_mesh --kind luke --as 'Luke Skywalker' --rig --crew --hero --metres 1.72 --parts '<head>,<hair>' --native --tex 1024 --maps 1024 --ultra --ultra-tex 2048 --ultra-maps 2048 --quality 90 --cuts plain=0,lod1=2,ultra=0 --eyes characters/heads/_shared/eyes/t_eyes_luke_c.ktx2
node scripts/bf2017-skeleton.mjs public/models/galaxy/bf2017/crew/luke.glb
```

The duel: open `#/galaxy/hoth/surface` as Luke, then `__surfaceDo('duel', 'maul', { stance: 'double' })` in the console; F strikes, C blocks.

The tests need no keys and no network: `npx vitest run scripts/lib/bf2017-* scripts/lib/rig-parts.test.mjs scripts/lib/catalog-write.test.mjs scripts/bf2017-import.test.mjs scripts/bf2017-clips.test.mjs scripts/bf2017-skeleton.test.mjs src/lib/three/walrus src/lib/combat/hiltFit.test.js src/components/galaxy/surface/catalog`.

## Status

| Lane | Session | Branch | Merged |
|---|---|---|---|
| design | the architecting session | `claude/nice-mayer-jqow5k` | #802 (open), carried by #805 |
| 0 | | | #805 |
| second design | this session | `claude/bf2017-levels-lighting-sabers` | (this PR) |
| 1 | | | |
| L | the lane L session | `claude/bf2017-l-hoth` | #831 |
| G | lane G session | `claude/bf2017-g-light` | #833 |
| K | the lane K session | `claude/bf2017-k-planets` | #825 |
| X | lane X’s session | `claude/bf2017-x-sabers` | #816 (tasks 1–3; the GPU frame time left) |
| S | | | |

### Lane L: Hoth

**Done.** Hoth draws from the game's own level (`public/models/galaxy/bf2017/levels/hoth/`, 53 MB; its README has the table): `node scripts/bf2017-level.mjs levels/mp/hoth_01 --world hoth --spot 205 -1540` (the spot: in front of the hangar's west mouth, the site's 0, 0). The pieces: `src/lib/land/layers.js`'s `image` layer; `src/lib/level/` (the instance records, the bands, the LOD by size and the reach per tier, the 16-bit PNG reader, collision); `scripts/lib/bf2017-level.mjs`, `level-cells.mjs`, `png16.mjs`, `ktx2-mips.mjs` (`ktx2.mjs convert --drop-mips`); `src/components/galaxy/surface/level/` (the scene, the stream, the shared-texture loader, the colliders); `scene.js` (the ground's image layers filled before the grid; `createLevel` beside the placer; a site's `game` things and scatter left to the level); `sites/ice.js` (`level: 'hoth'`, the ground the game's heightmap, the zone's door at the game's mouth); the Battle of Hoth's Echo Base post at that door. Gates: `galaxy-check surface hoth` with `BUDGET=1` passes at low (165 calls, 657k triangles, 15.6 MB), mid (162, 655k, 16.1 MB), high (152, 818k, 16.5 MB) and ultra (153, 1.69M, 19.3 MB); the level's own textures on the GPU 12 MB (low) and 47 MB (high); `hoth-check` (built: none) and `anim-check` green.

**What the data said** (each in the PR):
- The map's format is three arrays, not records, and its terrain record sits in the map's manifest (`web/maps/README.md`, fetched with `--raw maps/README.md`); its heights are v × heightScale / 65536.
- 14,536 of Hoth's 20,350 arena instances are the base inside the glacier, under the terrain: left out (the site's interior zone stands for it). The hangar's mouths are the terrain's holes, filled at their rim's lowest so the way in stays open.
- The plan's four cuts at the row's bands could not fit: the base's dressing is 21M triangles at LOD0 in a 3 × 3. Each instance now draws its LOD by size and distance and each tier a reach; what `fitCull` dropped per tier is in the pack's README (nothing, once the buried base was out).
- Sub-levels: `Hoth_01` and `Content` (the default); skinned actors (bind pose), Enlighten proxies, light cones, destruction stages, shadow, mist and light-invalidation planes are never drawn.
- **The desktop now exports lights and the sky's records**: each map's `<level>.extras.json` has `lights[]` (Hoth's 1,234 with colour, intensity, range, cones), `effects[]`, `decals[]` and `environments` (the VisualEnvironment components, sun rotation included). Lane G and lane F: read them there.

**Left.** The flight's `/fly/hoth` still shows the site's own land (`ground.flight`): it reads the pack's heightmaps when its worker can fetch them (bump `TERRAIN_VERSION` then). The Havok shapes (Rapier, #781) for the near cells; until then walls are their bounds (pieces over 15 m wait for their shapes) and floors their flat tops. The base's inside as the game's (it is the site's `echoinside` zone today). `--ultra` (LOD0 and 2048 maps) when ultra wants them. Then Endor (`endor_01`) on a fresh branch: the same script, its spot where its missions stand.

**Checking it.** The keys in `.env.local` (`SUPABASE_URL`, `BF2017_KEY`); in a cloud session Node's fetch needs `NODE_USE_ENV_PROXY=1`. A level pack in software GL lands in minutes: `PHASE_WAIT=1500000` on `surface-shot.mjs`, `galaxy-check.mjs` and `hoth-check.mjs`. Restart the dev server after rebuilding a pack (Vite lists `public/` at start).

Findings for the next lane go here: which sub-levels each map needed, what `fitTo` dropped per tier, the calibration factor and which path each world’s sun direction took, which skins were still missing, which clips’ windows were pinned by hand.

## Phase 2: everyone the game has

The plan is `docs/superpowers/plans/2026-10-10-bf2017-phase2-everyone.md`. The cast, kind by kind, is `docs/superpowers/evidence/bf2017-phase2/cast.md` (and `cast.json`). The sheets are in `docs/superpowers/evidence/bf2017-phase2/sheets/`: the figure it replaces, then the full cut, the light cut and the far cut. The costs are in `costs.md` beside them.

### Done (PR #832, `claude/bf2017-phase2`)

- **24 kinds from the game, on the figure paths the worlds already use** (a 2017 row takes over a kind by name; no `sites/*.js` changed):
  - **On the game's humanoid skeleton (`rig: 'walrus'`)**: stormtrooper, sandtrooper, snowtrooper, scouttrooper, shoretrooper, deathtrooper, hothtrooper, rebel, clone (Phase II), clonephase1, wookiee, c3po, rebelpilot, rebeltech, officer, and the city's civilians civcity1 and civcity3.
  - **On rigs of their own (`rig: 'own'`)**, through `src/lib/three/ownRig.js`:
    - superdroid (B2)
    - ewok
    - astromech (R2-D2), r5 (R5-D4) and droid (R4-I9)
    - probe (the viper)
    - tauntaun
- **Three cuts for each kind**, all from the game's own LOD chain:
  - **Full cut**: the game's LOD0, never simplified, its maps the game's own KTX2, untouched, at up to 2048 (phase 1's native settings); 2 to 45 MB.
  - **Light cut (`.lod1`)**: LOD4, or LOD2 where the game's light LODs wear `lodcaps` maps the bucket hasn't yet (the Wookiee, the Ewok, the tauntaun, the city civilians); WebP at colour 1024 and the rest 512, or 512 and 256 for the ten kinds of five or more materials. 0.2 to 1.0 MB, committed.
  - **Far cut (`.far`)**: the chain's last LOD at 256 and 128, under 150 KB, for the kinds the assaults field; committed.
  - **Where the full cuts are**: published to `site-assets` (`node scripts/assets-publish.mjs --only <the 24 full cuts>`, now taking a comma-separated list) and not in git. `src/data/galaxyAssets.json` names them and `.gitignore`'s block keeps them out.
- **Drawn by distance** (`src/lib/three/walrusCuts.js`, footScene's `gameFigure`):
  - **The cut**: the light cut is drawn first; within the level's `near` the full cut is swapped onto the same bones (phase 1's `swapBody`), and past its `mid` the far one. The bands are `lib/net/progressive.js`'s.
  - **Who calls it**: `cutAt(d)` is called by `actors.js`, `assaultScene.js` and `groundFigures.js`.
  - **The ledger**: a page admits full cuts kind by kind into a share of the download and of the GPU (`FULL_SHARE`: high 30 MB and 128 MB, ultra 160 and 448, none on a phone's levels), told by each row's `fullDL` and `fullMB`. With a stormtrooper at 25 MB, high takes about one kind's full cut a world.
- **Rows and loaders**:
  - `crewList.js`'s rows carry `lod`, `far`, `full`, `fullMB` and `fullDL`.
  - The cast casts its body's shadow alone.
  - `figureLoaderFor` sends `rig: 'own'` to the own-rig loader.
  - The walrus loader still refuses a body without the game's sockets.
- **One own-rig module, two loaders** (`src/lib/three/ownRig.js`, shared with lane V, whose #828 wrote the file first):
  - **Lane V's walkers**: `loadOwnRigFigure(url, { rig, packs, bones })` is a whole self-driving figure, its sets in `rigSets.js`, its packs by `bf2017-rigclips.mjs` under the game's names.
  - **The crew's droids and beasts**: `loadOwnRigBody(url, { rig, packs?, bones?, loader? }) → { model, clips, bones, rig }` and `ownPackUrl(rig)` hand a body and its clips to footScene's figure animator, as a person's are.
    - Clips bind by bone name, with the walrus loader's filtering.
    - A row's `bones` ({ role: boneName }) are checked, and the loader refuses naming what is missing.
    - A rig's set goes in `walrusClips.js`'s `OWN_RIGS` (`skeleton`, `body`, `set`).
    - Its pack is `node scripts/bf2017-clips.mjs <rig>`, which reads the skeleton from the body's light cut and takes clips from that skeleton alone, stored under the site's names.
  - **One rig, one side**: a rig is in one or the other, never both, since both packs are `clips-<rig>.glb`. The droideka is lane V's (a walker in `walkers.js`, resolved before a crew row), so this phase ships none of its own.
- **Packs**:
  - `clips-humanoid.glb`: 31 clips, 1.0 MB. Added: the troopers' patrol twitches, look-around, look at the ground, and the game's greeting as `wave`.
  - b2: 22 clips, 432 KB.
  - ewok: 24, 617 KB.
  - astromech: 6, 22 KB.
  - probe: 5, 30 KB.
  - tauntaun: 10, 226 KB.
  - Every pack clip keeps `userData.source` (the game's clip) for lane X.
  - Packs load with the figure, through the page's cache, once each: a world with no 2017 person fetches none.
- **The import**:
  - Its flags: `--full`, `--far`, `--join` (a figure's parts joined per material on its skin), `--cuts far=<n>`, `--lod1-tex` and `--lod1-maps`.
  - Each row's full-cut GPU textures and download are written in.
  - **Parts bound in a pose of their own** (the clone's gloves, from another body) keep their own inverse binds on the body's bones. Before, one move put a vertex 38,877 m off and the clone was refused.
  - **Procedural bones**: a part's `PROC_Bone*` stays its own. The clone's helmet is weighted wholly to its own `PROC_Bone0`, which the game places per mesh.
  - The sequel's `d_assault_newera` troopers are refused.
- **The villager pool** (`surface/pools.js`): Coruscant's and Bespin's villagers (and farmers, caretakers, Jocasta, Zam) are the city's civilians, one of two by the figure's number. A pooled kind that won't load gives way to the built one.
- **The audit**: `galaxy-figures-audit.mjs` names `walrus` and `own-rig`, and `EXPECTED` holds every moved kind (phase 1's heroes too). Phase 1 had left `anakin` expected as `legs`.

### Left

In order:

1. **Kinds waiting on textures the bucket hasn't yet** (re-import each with its line below once the upload has them):
   - **The B1** (`d_assault_preq_01`, `SS_CharactersPreset_RobotMarkings`): its colour is a markings map, so its own maps draw it grey. Its pack set is in `OWN_RIGS.b1`, but no pack is built.
   - **Mos Eisley's and Theed's crowds** (`civ_moseisley_0{1,2,3}`, `civ_theed_0{1,2}`, on `Civilian_Ske` with no sockets): palette-coloured. When they come, they take the own-rig loader with `packs: ['/models/galaxy/bf2017/clips-humanoid.glb']` (the bones are the humanoid's by name), and Tatooine's and Naboo's pools in `pools.js`.
   - **The `lodcaps` maps**: once the Wookiee's, the Ewok's and the tauntaun's are there, their light cuts can go back to LOD4 (`--cuts lod1=4`). City civilian 2 (`civ_vardos_female_robe2` with Linnea's bob) waits for `t_lodcap_bob_02`.
   - **The outfit variations** (cast.md lists them from `MeshVariationDatabase` and `ObjectVariation`): the Yavin, Endor, Scarif and Mos Eisley Rebels, the clone legions' markings, the sandtrooper's dirt. Their textures are not in the bucket.
   - **The Ewok's hood**: it draws grey where the game tints it.
2. **Draw calls**: the modular Rebels, the Hoth trooper, the Wookiee and the officer are five to nine draws a figure (one per material), against the Meshy figures' one. Under four needs an atlas per kind (or a texture array), which the import doesn't make; `costs.md` has where each world stands.
3. **The kinds no world places yet**, for the Death Star interior's own lane (`inside/pack.js`): shadowtrooper, navy crewman, admiral, personnel, gonk, interrogation droid. cast.md has their manifest names; none were shipped.
4. **The own rigs left**: dewback, bantha, eopie, ronto, jawa, aiwha, dwarf spider, mouse droid (phase 3's beasts); Yoda and Grievous (phase 10). The tauntaun's rider (`A_TauntaunRider_*` on the humanoid) is phase 3's.
5. **Hurtboxes**: #820's capsules (`lib/physics/boneCapsules.js` over `src/data/bf2017/physics/bones.json`) hit a walrus-rig kind where the game says. An own-rig figure takes its rig's own set by its skeleton's name (`boltPlay.js`, the figure's `skeleton`): the B2's is in the game's data, and so is the B1's for when it ships. The droideka is lane V's walker (`rigSets.js`, `loadOwnRigFigure`), which names no skeleton and keeps its one capsule; the game has a set for it too. The Ewok, the astromechs, the probe and the tauntaun have no set in the game's data, so they keep the one generic capsule; a set made for them would go in that same file's `sets`.
6. **The phase 1 heroes' full cuts** are still committed (phase 1's lane); the same `assets-publish --only` takes them out.

### Checking it

- **The import of one kind** (the stormtrooper here), then publish and check:

  ```
  node scripts/bf2017-fetch.mjs characters/imperial/imperial_stormtrooper/imperial_stormtrooper_male_01/imperial_stormtrooper_male_01_mesh --lod all --parts '*_helmet_mesh'
  node scripts/bf2017-import.mjs characters/imperial/imperial_stormtrooper/imperial_stormtrooper_male_01/imperial_stormtrooper_male_01_mesh --kind stormtrooper --as 'A stormtrooper' --rig --crew --metres 1.83 --parts 'characters/imperial/imperial_stormtrooper/imperial_stormtrooper_male_01/imperial_stormtrooper_male_01_helmet_mesh' --full --join --far
  node scripts/bf2017-clips.mjs humanoid
  node scripts/bf2017-clips.mjs b2
  node scripts/assets-publish.mjs --only 'models/galaxy/bf2017/crew/stormtrooper.glb'
  node scripts/assets-check.mjs
  node scripts/galaxy-figures-audit.mjs
  ```

- **The import flags, cut by cut**:

  | cut | how it is made |
  | --- | --- |
  | `--full`'s plain | LOD0, `native: true` at 2048 (the game's KTX2 with no levels dropped; a map the bucket has only as PNG goes to AVIF q90), positions 16 bits, normals 12, UVs 16, no simplification |
  | `--full`'s `.lod1` | the first LOD under 1,500 triangles, or `--cuts lod1=<n>`; WebP colour `--lod1-tex` (1024) at 82, the rest `--lod1-maps` (512) at 80; an opaque colour map's alpha taken off |
  | `--far` | the chain's last LOD, or `--cuts far=<n>`; WebP colour 256 and the rest 128, halved until under 150 KB |
  | `--join` | the skinned parts on one skin joined per material |

- **Each kind's extra flags**: every one is `--rig --crew --full --join`, with `--far` where cast.json says `far`. Its body, parts and height are in `cast.json`.
  - `--cuts lod1=2`: wookiee, ewok, tauntaun.
- **`WORLD_MB['/galaxy']`**: 17 → 19, by Hoth's models at low, 18.1 → 19.3 MB (with `galaxy/module.js` and `galaxy/surface/module.js`).
  - `--cuts lod1=2` and `--lod1-tex 512 --lod1-maps 256`: civcity1, civcity3.
  - `--lod1-tex 512 --lod1-maps 256`: hothtrooper, rebel, rebelpilot, officer, sandtrooper, snowtrooper, c3po, and the Wookiee and the tauntaun as well (Hoth at a phone's level came to 20.5 MB against its 20 without them).
- **The checks**: `galaxy-check.mjs surface <world>` with `BUDGET=1` at `QUALITY=high` and `low` (the before and after tables are in `costs.md` and the PR), and `anim-check.mjs --route '#/galaxy/hoth/surface' --limit 0.15 --strict --quality high` (34 figures, none at bind pose).
- **Gotchas**:
  - A checkout has no full cuts, so the tests read them through the manifest (`crew.budget.test.js`, `crewList.test.js`, `sites/ice.test.js`).
  - `git stash -u` takes the untracked imports with it.
  - Prettier is not the repo's formatter: don't run it on a file.

### Lane G, the worlds under the game's light

**Done** (`claude/bf2017-g-light`):

- `scripts/bf2017-light.mjs <world> --map <level> [--indoor <probe id>] [--main <VE>] [--also <VE>,…]` reads the map's `sky[]`, the raw VisualEnvironment records under `data/` (a superset of the map's `extras.json` copy: it has the wind and Enlighten's bounce), the level's reflection probes and its grading LUTs, and writes `src/data/bf2017/light/<world>.json` plus a pack under `public/textures/galaxy/bf2017/light/<world>/` (64² probe faces with the sun clipped out, 17³ LUT strips; every world under 400 KB, 2.1 MB for the ten). The pure reading is `scripts/lib/bf2017-light.mjs`, tested on a trimmed real record (`scripts/fixtures/bf2017/data/ve_sky_fixture.json`).
- `src/lib/three/gameLight.js`: `siteLightFrom(entry)` and `gameSite(site, light, state)`, the record to the site's `sky`, `light` and `fog`. Three constants set once on Hoth's sunny weather and held for every world: `GAME_TO_SITE` 0.0713 (the sun's lux, exposed by the game's own metering), `SKY_TO_SITE` 0.2006 (the record's `LuminanceScale`, exposed, to the dome's horizon and the fill), `PROBE_TO_SITE` 52.4 (the fallback for a record with no sky level). The ice field's mean luminance: 0.3529 under the site's own light, 0.3531 under the game's. The camera's exposure is the game's: a grey card lit by the sun and the record's sky, clamped to the record's EV range. Every world's before and after, with its change, is in `docs/superpowers/evidence/bf2017-light/README.md`.
- `src/components/galaxy/surface/gameLit.js`: the probe as `scene.environment` (the room's indoors; one alive at a time, `probeEnv.js`), the LUT in `universe/post.js`'s final pass on high and ultra (`grading()`, the house's contrast and saturation stepping aside), the weathers faded over 20 s (`__surfaceDo('weather', 'dusk', seconds)` in dev). `?gamelight=off` (dev) shows a world under the site's own light for a before shot; `surface-shot.mjs` takes `QUERY=` and `WEATHER=`.
- Wired (`gameLight` on the site): hoth, tatooine, yavin, kashyyyk, kamino, geonosis, scarif, bespin, endor. Worlds without a record (nevarro, mandalore, sorgan, lothal, coruscant, dagobah, mustafar) are unchanged, tested.

**Findings**:

- The sun's direction is in the record (`SunRotationX` the azimuth, `SunRotationY` the elevation, degrees): every world took that path; `sunFromProbe` is the fallback no world needed (the probes' brightest texels are lamps and glints).
- Hoth's weathers are sunny, sunset and interior (the only VE records the bucket has: Blizzard has a LUT only, Cloudy nothing). The probes of a level's weathers are not baked to one scale (Hoth's Sunset_VFX probe is a day's, and not orange), so a probe gives colours, never a level.
- Under the one calibration: Geonosis, Scarif, Bespin and Yavin within 8 % of the site's own; Kamino +14 % (a teal storm); Tatooine +25 % and Kashyyyk +39 % (higher suns and skies); Hoth's hangar mouth −36 % (in shade only the fill lights, and the game's is the lower).
- Probes per world: hoth 661f4d0f (Cloudy_VFX) and 36a2b5e2 (Sunset_VFX), indoor 9c323d00 (the hangar); yavin, kashyyyk, naboo, kamino, geonosis, scarif, bespin one or two each (in the JSON); tatooine none out of doors (only its buildings'), endor none by day (Foggy_Lighting and Night_Lighting2 only): those keep the dome as their environment.
- The LUTs are 33³ volumes as 33 png16 slices (blue the slice, green the row from the top, red the column), display-space S-curves.
- The interior's exposure is not applied in a room (the game's opens 4.5 stops over the day; the site's rooms are lit by its own lamps at exposure 1).
- Endor's surface does not finish loading under the software renderer, before or after (the shots are left); a `mvPosition` shader error on a MeshBasicMaterial predates the lane.

**Left**:

- **The far shadow** (task 3), with lane L: the distant shadow cache is a 16-bit depth map seen from the sun, not a top-down mask, and it is the game's terrain's. Fit the sun's orthographic frame (the record's direction, the heightmap's 8,192 m square) to the cache, then sample it beyond `SHADOW.extent` in `groundLook.js` and the far draws.
- **The placed lights**: exported now (`maps/<level>.extras.json`, `lights[]`, 1,234 on Hoth) and not yet used; the site's lamps stay.
- **Naboo**: its JSON is written and not wired. Its level is Theed at dusk (350 lux, 5° up); under the one calibration the field is 62 % darker, its people in silhouette, the game's dusk being carried by Enlighten's bounce and its lamps. Wire it with the placed lights, or with a bounce term.
- **Hoth's sunset** (dev only): its probe is a day's, so the dome reads pale rather than orange, and its fill is twice noon's.
- The Death Star (no surface site; its map names no sky). Nothing drives the weather states yet (the dev hook only); a weather fade moves the sun but not the ground's baked shadows.

Findings for the next lane go here: which sub-levels each map needed, what `fitTo` dropped per tier, the calibration factor and which path each world’s sun direction took, which skins were still missing, which clips’ windows were pinned by hand.
Phase 1's, with the dev server up:

```
node scripts/bf2017-fetch.mjs anims
node scripts/bf2017-clips.mjs luke
node scripts/bf2017-import.mjs characters/hero/luke/luke_rotj_01/luke_rotj_01_mesh --kind luke --as 'Luke Skywalker' --rig --crew --hero --metres 1.72 --parts '<head>,<hair>' --native --tex 1024 --maps 1024 --ultra --ultra-tex 2048 --ultra-maps 2048 --quality 90 --cuts plain=0,lod1=2,ultra=0 --eyes characters/heads/_shared/eyes/t_eyes_luke_c.ktx2
node scripts/bf2017-skeleton.mjs public/models/galaxy/bf2017/crew/luke.glb
```

The duel: open `#/galaxy/hoth/surface` as Luke, then `__surfaceDo('duel', 'maul', { stance: 'double' })` in the console; F strikes, C blocks.

The tests need no keys and no network: `npx vitest run scripts/lib/bf2017-* scripts/lib/rig-parts.test.mjs scripts/lib/catalog-write.test.mjs scripts/bf2017-import.test.mjs scripts/bf2017-clips.test.mjs scripts/bf2017-skeleton.test.mjs src/lib/three/walrus src/lib/combat/hiltFit.test.js src/components/galaxy/surface/catalog`.

## Lane S: streaming, both ways

### Done

- **PR (this one, from `claude/bf2017-streaming`)**, built on lane I's mirror (PR #798), not beside it:
  - **The bucket to the pipeline**: `scripts/lib/pool.mjs` (six at once, 30 s plus a second a megabyte, three retries at 1, 2, 4 s, `Retry-After` honoured, a short body retried, a `.part` renamed when whole); `bf2017-fetch.mjs --all '<glob>' [--verify] [--pool n]` with one summary line and `lab/assets/bf2017/.index.json`. Luke’s eleven models: fetched 79 · kept 10 · missing 24 · failed 0 · 63.6 MB · 4.5 s, then kept 89 in 1.3 s.
  - **The site to the bucket**: the public bucket `site-assets` (made; `supabase/README.md`); `scripts/assets-publish.mjs` finds the game-derived files by their credit to the game, sends each new hash once to `<hash12>/<path>`, writes `src/data/galaxyAssets.json` last, then `.gitignore`’s block (`scripts/assets-ignore.mjs`). The build merges those entries into the one bundled manifest; lane I’s upload goes to the same bucket and its prune spares them; packs list them (`remoteOnly`) and the installer keeps asking the bucket for them.
  - **The site’s loader**: `src/lib/net/assetFetch.js` through `src/lib/assetLoad.js` at the shared `GLTFLoader`’s `load` and `textures.js`: 2 at once on a saver connection, 4 on a weak device or a phone, 6 on a desktop, 8 at ultra (the connection sets it, not the chip), the nearest first, one request per URL, a stall timeout, short bodies retried, a 404 sending that file alone to the site; every surface world’s loads aborted at its dispose. `src/lib/net/progressive.js` (which cut first, and when the plain is worth it); a figure on a saver connection fetches its `.lod1` only, and a plain that won’t come falls to the `.lod1`.
  - **Fidelity at ultra** (the owner’s direction mid-lane: a laptop on wifi, the best first): a walker and a figure now load the level’s own cut (the AT-AT came as plain and ultra both on main, 1.9 MB wasted, drawn from the plain); the dust shader compiles at ultra (`lib/three/dust.js`, outside the lane: one console error on every Hoth visit at ultra on main).
  - **The 404 rule**: a 404 on one hashed URL sends that file alone to the site’s path; only a real failure (network, timeout, retries spent) marks the bucket down for the visit.
  - **The abort rule**: an abort (the world left) rejects with an `AbortError`, is never a fallback and never marks the bucket down, and a late answer is dropped.
  - **Checks**: `scripts/assets-check.mjs` (walks both `galaxyAssets.json` and `assets-manifest.json`) (in `deploy.yml` when `ASSET_BASE` is set) and `scripts/stream-check.mjs`. The numbers: `docs/superpowers/evidence/bf2017-streaming/README.md`.

### Left

- **Lane W's folders**: `textures/galaxy/bf2017/<role>/` and `textures/galaxy/sky/` are in the mirror's `REMOTE` list (`scripts/assets-upload.mjs`, with `.hdr` and `.exr` as kinds), so a committed map or sky there is mirrored once it lands. If lane W keeps them out of git (they are game-derived), add those two folders to `assets-publish.mjs`'s list beside `models/galaxy/bf2017` instead.
- **Nothing is published yet**: `galaxyAssets.json` is `{}` until phase 1’s heroes are imported. Then: `node scripts/assets-publish.mjs --dry`, without, `node scripts/assets-check.mjs`, commit the manifest and `.gitignore`.
- **The progressive swap** for the galaxy's other figures (props and Meshy people): a 2017 figure has it now (phase 1: `walrus.js`'s `swapBody` rebinds the full cut's meshes to the figure's own bones, so nothing that holds the figure notices); the same move would serve any skinned figure whose cuts share a skeleton.
- **The HUD’s bytes line** (“Loading Hoth, 12 of 27 MB”): the world’s scope counts bytes (`debug().net`), but the loading veil reads the runtime’s prepare steps; wiring it is a runtime change.
- **A published hero with clips**: `catalog.test.js`’s clip check reads the file; a row with `anim` whose file is only published will fail it in CI. Phase 1 decides: its clips in a pack, or the check reading the published manifest of clip names.
- **Egress**: the free tier’s 5 GB a month is a few hundred visits. Pro (250 GB) before `ASSET_BASE` is set for everyone; if egress bills, the same `<hash12>/<path>` files on Cloudflare R2 and `ASSET_BASE` pointed there is the whole change.
- **The bucket’s name**: the parent session asked (after the lane was built) for lane I’s `assets` bucket and one JSON file; the owner’s brief named `site-assets` and `galaxyAssets.json`, so that stands until the owner says otherwise. Folding is mechanical: `BUCKET` in two scripts, and the merge in `scripts/assets-manifest.mjs`.

### Checking it

- The variable: the repository variable `ASSET_BASE` = `https://jzabcqboyemokwifmjmp.supabase.co/storage/v1/object/public/site-assets` (Settings, Secrets and variables, Actions, Variables). Unset, the site is exactly as before.
- The bucket: `node scripts/assets-check.mjs` (no key: the bucket is public).
- The stream: `NODE_ENV=development npx vite build --mode development --outDir /tmp/stream-dist && npx vite preview --outDir /tmp/stream-dist --port 4173 --strictPort --host 127.0.0.1`, then `node scripts/stream-check.mjs` (a laptop on wifi at ultra) or `--phone` (3G at mid). With `VITE_ASSET_BASE` in the build’s environment, the bucket is in the path.
- The fetch: `node scripts/bf2017-fetch.mjs --all 'characters/hero/luke/*'` twice; the second is all `kept`.
- The tests need no network: `npx vitest run scripts/lib/pool.test.mjs scripts/lib/asset-manifest.test.mjs scripts/assets-*.test.mjs scripts/stream-check.test.mjs src/lib/net src/lib/assetLoad.test.js src/lib/assetBase.test.js`.

## Lane W: closed; lane L owns the worlds

Lane W (`docs/superpowers/plans/2026-10-10-bf2017-phaseW-worlds.md`) is superseded by lane L (PR #810's `-phaseL-levels.md`: each world drawn from the game's own level layout, heightmap and shapes, Hoth first). Lane W ends with the tools lane L can reuse (PR #823); it places nothing on any world.

### Done (PR #823)

- **Kits** (`scripts/bf2017-kit.mjs` over `scripts/lib/bf2017-kit.mjs`, tested on a two-piece fixture, no network): a level system's pieces in one GLB, a node a piece by its name at the game's own origin, each piece's parts joined by material, the materials shared and kept apart by name (the test caught `dedup` merging Hoth's `M_Wall` and `M_Floor`, alike in all but the name). `bf2017-import.mjs` exports its LOD reader for it. The kit row goes to a world's `catalog/bf2017-<world>.js`'s `KITS` (none in this PR) and its credit to `modelCredits.json`.
- **The surfaces' roles on the game's maps** (the owner's rule of 04:40, plan 003d83b19): `scripts/lib/bf2017-roles.mjs`'s `ROLE_SOURCES` (tested: every role, only the drop's textures, no sequel era) and `scripts/bf2017-textures.mjs` make all 29 roles under `public/textures/galaxy/bf2017/` (16 MB; the scans' set is 13 MB). Chosen from a census of what the bucket holds and checked on a contact sheet: the game's tiling detail arrays where it has them (Hoth's rock, the desert's sand, Mos Eisley's walls), terrain and trim sets otherwise (Naboo's gravel and tiles, Endor's mud and bark, Sullust's sand and concrete, Kamino's dome metal, the MC80's painted metal, Kashyyyk's planks, the Imperial bunker's tread plate cut from its trim sheet, Yavin's temple stone and floor). Six first picks were rejected on the sheet (atlases or a blend mask). `lib/three/scans.js` now wears one set for the page (`wearScanSet`, tested), taken by `surface/scene.js` from a site's `look.scanned`; no site sets it yet, so nothing on the site changes until a world does.
- **Hoth's skies, for lane G**: `docs/superpowers/evidence/bf2017-hoth/skies.md` and the main-arena probe (`cloudy_vfx/78e8837b`) at 128 and 64 under `public/textures/galaxy/sky/` (`scripts/bf2017-sky.mjs`, its pure parts tested). The level's panoramas are in the manifest but not in the bucket.

### What was measured on Hoth (a trial, not shipped)

Echo Base was rebuilt on the game's kits by hand and by grid before lane L's plan arrived: the main hangar from the large hangar set (two 30.72 m bays and the end piece, mirrored: 41 × 31 × 72 m), the base's inside panelled with the wall system (81 panels, windows, beds, the bacta tank, the game's floor), the hangar shells' missing maps from the snow and concrete roles. It is kept off this PR on the unpushed local branch `claude/bf2017-worlds-hoth-placement-unpushed` (with the sky-loader trial on `claude/bf2017-levelsky-unpushed`); both go with this session's container. The pictures are `docs/superpowers/evidence/bf2017-hoth/echo-base-trial.jpg`. What it cost, one whole frame in software GL (`renderer.info`), main against the trial:

| view | level | calls | triangles | textures |
| --- | --- | --- | --- | --- |
| the hangar's mouth | high | 226 → 247 | 923k → 941k | 745 → 756 |
| the hangar's mouth | low | 227 → 248 | 729k → 747k | 741 → 755 |
| inside the hangar | high | 131 → 152 | 816k → 834k | 745 → 757 |
| the base's entry corridor | high | 52 → 126 | 158k → 311k | 742 → 754 |
| from the landing (`galaxy-check BUDGET=1`) | high | 156 → 156 (row 274) | 865k → 865k (row 1.66M) | 742 → 754; models 14.7 → 16.8 MB of 60 |
| from the landing (`galaxy-check BUDGET=1`) | low | 156 → 156 (row 350) | 671k → 671k (row 800k) | 740 → 754; models 14.7 → 16.8 MB of 20 |

`hoth-check.mjs` passed on the trial (no built people, both kits laid, none of the site's scans fetched). Things lane L may want from it: the hangar kit at LOD1 was 4,620 triangles, 3 maps, 119 KB; the wall kit 25,246 triangles, 9 maps, 1.87 MB; the panels as clones cost one call a piece (74 calls for the base's inside, worth instancing); the large hangar shells come without maps, so they need a role. Hoth's texture count was already 742 against the contract's 60 on main, before any of this. Main also logs one shader error on Hoth (a fog chunk reading `mvPosition` where there is none), not this lane's.

### Left

- To lane L: the worlds. To turn the game's roles on for a world, set its site's `look: { scanned: 'bf2017' }` and look at the sheet; the flight world's ground and the planet bodies read the same scans module (the site's set, outside a surface world). Roles to look at again in their own worlds: grass and leaves are Endor's forest floor (the game's grass is cards), the beach is the desert's second detail layer, and the detail arrays' normals were taken as they come.
- To lane G: Hoth's probe and `skies.md`; the panoramas when the upload reaches them.
- The planet-flight world's Echo Base landmark (`src/lib/land/flight/`) could wear the game's hangar once lane L has it.

### Checking it

```
node scripts/bf2017-textures.mjs                    # every role, or name some
node scripts/bf2017-sky.mjs web/textures/levels/mp/hoth_01/reflectionvolumetexture/cloudy_vfx 78e8837b-bc19-4917-80c7-fd21b3119ea6 --name hoth
npx vitest run src/lib/three/scans.test.js scripts/lib/bf2017-kit.test.mjs scripts/lib/bf2017-sky.test.mjs scripts/lib/bf2017-roles.test.mjs
```

## Lane F: the effects and the sound map

The plan is `docs/superpowers/plans/2026-10-10-bf2017-phaseF-effects-lighting-lines.md` (on `claude/nice-mayer-jqow5k`; its task 3, lighting, is withdrawn). Frostbite's effect graphs do not export, so the site's effects keep their rules and take the game's *look*.

### Done

PR #829 (`claude/bf2017-effects`).

- **The game's look, by name**: `src/lib/three/fx/gameLook.js` reads `src/data/bf2017Fx.js` (written by `scripts/bf2017-fx.mjs`) and loads a sheet or a mesh by the site's name; a name the table lacks is `null`, and the effect keeps its own look, never a missing texture. `flipbook.js` reads a sheet's grid from the game's name (`_5x1_`, `_8x64_` as 8 across and 64 frames, `Anim8x4o32`); the table's own `grid` wins where the name is wrong (the metal scorch's `2x4` is a 2 by 2).
- **What the bucket had** (55 of the drop's 323 effect textures at 06:00, `node scripts/bf2017-fx.mjs --count`): six sheets (`impact`, the game's packed impact: red the scorch, green the burst's rays, blue the ring; `scorch.metal`; `blast`; `glow`; `ramp.blackbody`; the metal chunks' map) and eight mesh sets (`debris.metal`, `.rock`, `.snow`, `.sand`, `.wood`, `.walker` (an AT-ST's wreck), `.fighter` (a Y-wing's shards), and `force.push`, Luke's half-sphere), credited `bf2017-fx-*`.
- **The game's own KTX2** (the parent session's rule, mid-lane, as phase 1's maps): each sheet is the bucket's file with its top mip levels taken off for a smaller width (`scripts/lib/ktx2-levels.mjs`), nothing re-encoded; the per-effect cap (512 KB: the parent session lifted the WebP-era 256 for the game's KTX2) sets the widths: `impact` 512 at high and 256 below, `scorch.metal` and `blast` 512 at high and 256 below, `glow` and the ramp 256 (the ramp's band sampled at `rampV`), the metal chunks' map its own 512 (BasisLZ: no level can be dropped). The wood chunks' map (BasisLZ, 418 KB) is left out: they take a colour. The whole set is 938 KB (sheets 838, meshes 100) against 6 MB; a visit at high loads about 747 KB of it. The five files over 64 KB (`impact.256`, `impact.512`, `scorch.metal.512`, `blast.512`, `debris.metal.512`, 713 KB) are published to `site-assets` (`scripts/assets-publish.mjs`, `src/data/galaxyAssets.json`, `assets-check` right) and out of git; a site not pointed at the bucket takes the next smaller sheet it has (`loadLook` steps down), or for `impact` and the metal map the effect's own look.
- **Drawn** (`src/lib/three/fx/`: `marks.js` one instanced draw a sheet and mode, `debris.js` one a chunk's shape, `push.js`, `fxPlan.js` the pure rules, `gameFx.js` the one call a scene makes):
  - a bolt's flash (`lib/three/combat/bolts.js`): the game's burst cooling along its black-body ramp, and every flash one draw (it was twelve meshes);
  - an impact by surface: what the game's material grid said the bolt struck (lane P4's family on the `solid` event, PR #821's `impactLook`: snow, metal, sand, rock as stone, wood) wins through `gameFx.impact(…, { family })`; the world's own ground (`fxPlan.surfaceOf`: its footsteps, else its terrain's detail) is only the fallback when the event carries none: the game's scorch tinted (soot on stone and sand, a grey melt on snow) or its metal marks, an ember in the bolt's colour, and the surface's own chunks thrown (snow 6, sand 5, rock and metal 3 at high; half at mid, a quarter at low);
  - a blast by vehicle class (`grenade`, `speeder`, `fighter`, `walker`): the game's rays, its ring over the ground, its scorch and the class's own wreck flung, 8 to 12 pieces, capped at 32; wired to the surface's grenades; a vehicle's death calls `gameFx.explode(at, cls)` when lane V wires one;
  - the Force push and pull on Luke's half-sphere, a rim of light under the bloom's threshold;
  - the space layer's flashes (`galaxy/fx.js`) take the same burst and ramp.
  Each part answers whether it drew; `universe/gunfx.js`'s scorch stands in where not. No light is added: the muzzle flare and the saber's light are the site's, as they were.
- **The sound map**: `src/lib/sound/gameSounds.js`, 61 names (the saber, the duel, footfalls on six grounds, blasters by weapon, engines, impacts, fourteen voices' lines by situation), each tested against the name `sounds.js`, `universe/sounds.js`, `sfx.js`, `clips.js` or the voices already use; every game file `null`, because `data/Sound` holds 3,918 records and no audio (`node scripts/bf2017-audio.mjs`).

### Left

1. **The seam with lane P4 (#821, open)**: whichever merges second wires it in `scene.js`'s `stepImpacts`: `const g = gameFx.impact(o.at, n, { ground: o.ground, colour, family: pick?.family })`, and `impactLook`'s `scorch` only when `!g.mark` (its sparks, smoke and kick stay; the game's sheet is the look its choice resolves to, gunfx's the fallback).
2. **The sheets still to land** (`WANTED` in `scripts/lib/bf2017-fx.mjs`, each named, fetched the day it is up, given a recipe in `SHEETS`): the bolt (`T_BlasterProjectileSide_02_D`, `…Top_01_D`), the muzzle flash, smoke and billowing smoke, fire, the smoke trail, the Force cone, the X-wing, A-wing and shuttle exhausts, a crater, concrete scorch, a shield's impact, and snow and sand kicked by feet. Until the bolt's sheet lands, a bolt stays the site's streak; until the exhausts land, engine glow stays the models' own emissive (lane V's ships).
3. **The audio**: when `data/Sound` has files, `node scripts/bf2017-audio.mjs <bucket path> --as <file>` makes each the site's MP3 and its name in `GAME_SOUNDS` takes the file; the surface's `sounds.js` then asks `soundFor(name, has)` before its own synthesised sound (a few lines in the owner's audio lane, not here).
4. **Lane X takes the saber's look** (ignition, clash, trail, the blade's light; #816): the bucket has no saber sheet at all, so what it can use today is through `gameLook`: `loadLook('glow')`, `loadLook('impact')` (its green, the burst, for a clash) and `loadLook('ramp.blackbody')`; `saberFx.js` was not written here.
5. **The bolt's row** (lane P2, #820, merged): `projectiles.json` rows carry a `kind` (bolt, grenade, missile, charge) and no colour; `bolts.js` draws the pool's own colour and keeps no table, so nothing overlaps. When the bolt sheet lands, its look picks by the row's `kind`.
6. **Vehicle deaths** on the surface and in space call nothing yet: lane V wires `gameFx.explode(at, 'walker' | 'speeder' | 'fighter')` where a vehicle goes up (the space layer's `world.js` flashes take the game's look already, without debris).
7. **Metal surfaces** (until #821's grid says metal): no world says its floor is metal except by `sound.ground: 'metal'`; a station or a ship's deck that sets it gets the game's metal marks and chunks.
8. **`ASSET_BASE`**: the published sheets reach a visitor only when the site is built with it (lane S's rule); without it, high takes the 256 sheets the site has, and the impact falls to the site's own scorch.

### Checking it

```
node scripts/bf2017-fx.mjs --count            # how many effect textures are up
node scripts/bf2017-fx.mjs                    # make the sheets, meshes, table and credits again
node scripts/assets-publish.mjs --only 'models/galaxy/bf2017/fx/impact.256.ktx2'   # each file it says is over 64 KB
node scripts/assets-check.mjs
node scripts/bf2017-audio.mjs                 # how much audio the bucket holds
npx vite --port 5188 --strictPort --host 127.0.0.1 &
OUT=/tmp/fx node scripts/bf2017-fx-shots.mjs hoth impact.snow,blast.grenade,push
```

In the console on a surface: `__surface.fx('impact.snow')`, `__surface.fx('blast.walker')`, `__surface.fx('push')`, each with `{ look: 'site' }` for the site's own look alone. The tests need no keys: `npx vitest run src/lib/three/fx src/lib/sound scripts/lib/bf2017-fx.test.mjs src/lib/three/combat/bolts.test.js src/components/galaxy/fx.test.js`. Shots and numbers: `docs/superpowers/evidence/bf2017-effects/`.

## Lane V: the vehicles, in depth

The plan is `docs/superpowers/plans/2026-10-10-bf2017-phaseV-vehicles.md`; the cast, kind by kind, `docs/superpowers/evidence/bf2017-vehicles/cast.md`; the sheets and the measures, the same folder.

### Done

- **PR #828** (`claude/bf2017-vehicles`).
- **The walkers on the game’s rigs.** `src/lib/three/ownRig.js` loads a figure on a skeleton of its own, in `crew.js`’s shape, and plays the game’s clips on its bones as they are. Nothing is retargeted, no bone is pruned or renamed, the walk is paced to the ground covered, and `react('down')` and `react('fire')` play the game’s death and shot. `src/lib/three/rigSets.js` names each rig’s clips under the site’s names: the AT-AT 8 (its tow-cable fall `die.cable`), the AT-ST 12, the AT-TE 10, the AT-RT 9, the droideka 17. `CLIP_FALLBACK` stays inside the rig, and `deathFor` picks the cable’s fall when the cable did it. `scripts/bf2017-rigclips.mjs` packs them at 24 fps, in place (the trajectory’s quarter turn folded into its children: `scripts/lib/rig-clips.mjs`), as `public/models/galaxy/bf2017/clips-<rig>.glb`: 259, 111, 323, 95 and 279 KB. `walkers.js` sends every kind whose model is the game’s through it. Nothing of the site’s rides a game rig (the owner, 2026-10-10): the AT-RT walks with its saddle empty until the game’s own clone trooper can sit it.
- **The AT-ST bound to its skeleton.** The drop has it only as one rigid composite, and its 69 clips are on the cinematics’ `ATST_Ske01`. `bf2017-import.mjs --bind` skins it there, each piece of the mesh to one bone (`scripts/lib/rig-bind.mjs`). The AT-AT is the game’s own skinned `old/atat_mesh`; the gameplay composite bound the same way came to 4.0 MB with a plate that tore.
- **Every vehicle the site places, the game’s.** Five walkers, eight ground vehicles and droids, six turrets, twenty fighters and fourteen cockpits are in `catalog/bf2017-vehicles.js`, a group of the lane’s own after `bf2017`. Each has a `.lod1` and a `.far` cut, and `scripts/bf2017-vehicles.mjs` lists the import of each. Each cockpit is stood in its hull’s frame (`--hull-frame`): 11 of 14 lie inside their hull’s bounds; the snowspeeder’s, A-wing’s and Slave I’s reach past by up to a metre where the canopy is.
- **Native, as the game has them** (the owner, 2026-10-10: trust the game’s textures; fix the caps for the native files). Every kind is imported with phase 1’s `--native` (merged in from `claude/bf2017-phase1`, so this PR lands after #815): the game’s own KTX2, untouched, its top mip levels dropped for the lighter cuts (plain 1024, light 512, far 256 and its colour maps alone, ultra the game’s own size). The plain cut is the game’s first LOD under 60,000 triangles (`NATIVE_VEHICLE`; the AT-AT takes its LOD1, 61,900), the ultra its LOD0. The full cuts are in `site-assets` (194 files, 849 MB; `assets-check`: 338 of 338), out of git; a native kind draws its light cut alone at low and mid, the phone’s levels (`catalog/index.js`’s `modelUrlFor`).
- **Why the game’s files had looked poor on the site, and the fix.** The pipeline did it, not the game:
  - **The wrong UV set.** The drop’s GLBs bind every map to `TEXCOORD_0`, but the game’s vehicle shader reads its colour, normal and smoothness atlas through the set that unwraps the hull once; on the X-wing that is `TEXCOORD_1`, and through the other the atlas smeared into the grey and brown patchwork of the first sheets. `scripts/lib/bf2017-uv.mjs` tells the set by its area in UV space (about the square’s once, against a tiling set’s many: the X-wing’s fuselage 0.66 against 2.22; the TIE Advanced is the other way round). `xwing-uv-sets.webp` shows both.
  - **Decals painted opaque.** A decal sheet blends in through the mask in its `_nam` map’s alpha; drawn opaque it painted patches over the hull. It now blends by that mask (lossless), and a normal-only decal, which glTF can’t express, is dropped (`scripts/lib/bf2017-dressing.mjs`).
  - **Our restyling.** The metal cap (`relit`) is gone, nothing is re-encoded or resized but by dropping the game’s own mips, and the only maps made from the game’s pixels are the two glTF needs: a decal’s colour with its mask, and a packed `_ncs` map’s colour from its blue, both lossless.
  - **What no file carries.** The game’s lighting, reflections and its tiling detail maps (`DetailNS`) are its renderer’s; lighting is the owner’s lane.
- **The import learns lane V’s flags:** `--vehicle`; `--far`; `--bind`; `--hull-frame` (named apart from phase 1’s `--keep-origin`: grounded by the hull’s manifest box so a cockpit sits in its hull); `--light-maps` (the AT-TE’s fifteen maps put its light cut at 5.1 MB, over the 5 MB cap, at 512). The game’s glass is made glass and the MTT’s weak-point covers are dropped.
- **The placer, for the bucket’s cuts.** A row that is `native` draws its `.lod1` first and swaps its level’s cut in under the same object when it lands (`cutsToLoad`, `swapIn`). An `.ultra` that can’t be had falls to the plain one (`fallbackFor`), as a walker’s does.
- **The rides on the game’s 74-Z and X-34.** Their seats are measured off the models and tested against them (`rides.seat.test.js`); the chase’s scouts sit the same saddle.
- **The fleets on the game’s fighters.** `scripts/bf2017-fleet.mjs` writes twelve ships over the space layer’s Sketchfab files, at the paths `galaxy/models.js` names: the TIE fighter, bomber and Advanced, the A-, Y- and U-wings, the N-1, ARC-170, vulture, tri-fighter, cloud car and the Nebulon-B, natively. They stay committed as well as published, as `galaxy/models.test.js` measures them. Their far-off copies are remade by `galaxy-lod.mjs`, which reads a native map’s colours from the game’s unpacked PNG.
- **Rigs.** Every kind the drop has a skeleton for is on it: the five walkers with their clips, and the homing and dwarf spider droids on `GEO_HomingSpiderDroid_Skeleton` and `DwarfSpiderDroid_Ske`, kept whole, standing (the drop has no clips for them). The fighters, speeders and turrets have no skeleton in the drop.
- **The deaths in lane F’s blasts.** A walker or droideka shot down (`activity.js`’s `dying`) plays its game death and goes up in `gameFx.explode` for its class (`walkers.js`’s `blastClass`: a walker’s, the droideka a speeder’s), through the scene’s own `gameFx`.
- **anim-check knows the walkers’ feet** (`LeftFrontFoot`). On Hoth every AT-AT in view, and on Endor the AT-ST, reads 0 m/s of planted drift and none is at bind pose.

### Where the code and the plan differed

- `universe/shipModels.js` has no galaxy rows, and there is no instanced far-fighter path. The space layer’s rows are `galaxy/models.js`, which open PR #793 is changing, so the fleet is written at the files those rows name rather than by editing them. The far copies are `galaxy-lod.mjs`’s one-piece vertex-coloured ones, which the space layer’s LOD asks for, not the import’s `.far`.
- `warpieces/hoth.js` is the space ion cannon, and nothing on the surface brings a walker down. The figure’s `react('down', { cable })` is ready, and a hostile walker or droideka shot down (`activity.js`) already plays its game death.
- The plan’s “imperial cruiser” is the Arquitens light cruiser, and the gameplay capitals are kits placed by level data. The fleet’s capitals were compared with the space battles’ whole backdrop ships: the close-up Star Destroyer and Nebulon-B (Daniel Andersson’s, about 100,000 triangles) and the MC80 stay, being the better on the sheet (`fleet.webp`). The Nebulon-B’s plain cut is the game’s.
- `bf2017-clips.mjs` was on phase 1’s branch, not main, so the `--skeleton` form is `scripts/bf2017-rigclips.mjs`, over its own pure module: **phase 1, fold it in** (or keep it beside yours).
- The AT-M6 is The Last Jedi’s: left out by the standing rule.
- The Falcon is the landmark mesh: the gameplay one names no maps in the drop.

### Left

- **The hooks the owner’s other lanes need**, in the files:
  - **The walkers’ feet:** `RIGS[rig].feet` by the game’s bone names; a walker figure’s `bones` and `feet`.
  - **A ride’s seat:** `rides.js`’s `seat` and `riders.js`’s `SEATS`, measured off the game’s models.
  - **The muzzles:** the game’s own gun bones (the AT-AT’s `GunRotation`, `LeftSecGun`, `RightSecGun`; the AT-TE’s `Turret_Barrel`; the droideka’s `LeftGunMuzzle1/2`, `RightGunMuzzle1/2`; the AT-RT’s `Gun`), kept whole on the rigs.
  - **Collision:** none was imported. The physics lanes (PR #817’s P0 to P4) take the vehicles from here; P3 does their physics.
  - **Lighting, camera, HUD:** none was added, by the owner’s rule of 04:40.
- **The cockpits on boarding**: the GLBs are in, each in its hull’s frame. Two places can wear them. The space layer’s cockpit view (`galaxy/scene.js`’s `buildCab`, the intro’s built cockpits) is PR #793’s file. A surface ride on a fighter does not exist yet: the snowspeeder on Hoth is the galactic-assault hand-off’s open row, and `sites/ice.js` is PR #795’s.
- **A rule that brings a walker down**, and the tow cable to trip it (`quests.js`’s `trip` step exists; nothing emits it). The rope is `gameplay/vehicles/air/airspeeder/old/towcablerope_skinned_mesh`, on its own skeleton, with no clips.
- **The AT-AT’s destruction skeletons** (`ATAT_Destruction_01_*`, one or three clips each): not wired, as nothing brings one down.
- **The chase rider on the game’s clips** (`A_HM_SpeederBike_*`, the humanoid’s): phase 1’s walrus loader, once it is on main. The chase still sits figures.js’s built scout on the game’s 74-Z.
- **The fallen AT-AT on Hoth** (`sites/ice.js`’s `walker` zone) is the game’s model rolled on its side in its bind pose. Its tow-cable death’s last frame would be the true pose, but the placer places statues.
- **Engines on lane F’s effects**: the engine and thruster glow through `gameLook` for the rides and the fleets. A walker’s or droideka’s death already goes up in `gameFx.explode` (below).
- **The AT-ST’s rig**: the drop has no skinned AT-ST, so its rigid mesh is skinned at import to the cinematics’ `ATST_Ske01` (one bone a piece). If the owner counts that binding as ours, it stands as a statue instead (drop `--bind`).
- **Sounds**: the vehicles’ engines and footfalls when the game’s audio lands.
- **The far fleet instanced**: the space layer draws each ship through its own `THREE.LOD`, a draw each. The game’s far copies keep that cost, and instancing is the fleet war’s own open item.
- **Textures**: no map these vehicles name was `missing` on 2026-10-10.

### Checking it

```
node scripts/bf2017-fetch.mjs manifest                 # and web/anims.jsonl, which bf2017-rigclips.mjs fetches itself
node scripts/bf2017-rigclips.mjs --pack atat           # atst, atte, atrt, droideka
node scripts/bf2017-vehicles.mjs --fetch               # every kind; or a kind, or --group walker|ground|turret|air|cockpit
node scripts/bf2017-fleet.mjs && node scripts/galaxy-lod.mjs tie tiebomber tieadvanced awing ywing uwing n1 arc170 vulture trifighter cloudcar nebulon
node scripts/assets-publish.mjs && node scripts/assets-check.mjs   # the native cuts to site-assets; commit the manifest and .gitignore
node scripts/ride-points.mjs                                            # after re-importing the 74-Z or the X-34
npx vite --port 5188 --strictPort --host 127.0.0.1 &
node scripts/rig-shot.mjs public/models/galaxy/surface/atst.glb atst /tmp/atst.png idle,walk,die
node scripts/anim-check.mjs --route '#/galaxy/hoth/surface' --do "__surfaceScene.put(261, 431)" --do "__surfaceScene.view([261, 14, 431], [283, 9, 510])" --range 150 --port 5188
```

The tests need no keys and no network: `npx vitest run src/lib/three/ownRig.test.js src/lib/three/rigSets.test.js scripts/lib/rig-clips.test.mjs scripts/lib/rig-bind.test.mjs scripts/lib/bf2017-dressing.test.mjs scripts/lib/bf2017-uv.test.mjs scripts/bf2017-import.vehicles.test.mjs scripts/bf2017-fleet.test.mjs src/components/galaxy/surface/walkers.test.js src/components/galaxy/surface/rides.seat.test.js src/components/galaxy/surface/catalog`.

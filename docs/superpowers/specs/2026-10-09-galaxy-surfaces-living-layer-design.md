# The galaxy's surfaces, to the Shire's standard: the living layer. The design

Date: 2026-10-09. Status: design, written by an architecting session from the owner's brief, for an implementing session (phases in order, one commit each on `claude/compassionate-turing-a8zq9v`). The plan is `docs/superpowers/plans/2026-10-09-galaxy-surfaces-living-layer.md`; the hand-off is `docs/superpowers/HANDOFF-galaxy.md`.

## What the owner asked

"The graphics in the Shire look very high quality compared to Star Wars worlds. Improve the Star Wars worlds and how they look and feel. Use the nature assets we have and other assets to improve it."

The Star Wars worlds are the galaxy's seventeen walkable surfaces (`src/components/galaxy/surface/`, route `/galaxy/<id>/surface`, a site each in `sites/*.js`). The nature assets are Quaternius's Stylized Nature MegaKit, imported as the worlds' kit (`public/kit/naturemega/`, 116 models, 11.2 MiB, CC0; `docs/assets/quaternius.md`), and the smaller `space` and `farm` kits beside it.

## Why the Shire reads better (what was measured, not guessed)

Both scenes stand on the same machinery. The surface already imports the Shire's house look (`lib/three/house`), its ground map (`groundmap`), its grass (`grass`, Bruno Simon's 78,400 blades in one draw), its wind (`wind`), its baked floor light (`groundwork`) and its scans (`core`). The gap is not the engine. It is what each world puts on it:

| what | the Shire (`middleearth/shire/`) | a galaxy surface (`galaxy/surface/`) |
| --- | --- | --- |
| grass blades | everywhere, 78k blades over 44 m, root the ground's colour | the same, but only on 6 of 17 worlds (`site.grass`: Endor, Yavin, Naboo, Scarif, Lothal, Sorgan) |
| flowers | 1,400 instanced, in arcs at doors, drifts along lanes, clusters in fields | none drawn (`grass.flower` is in four sites and read by nothing) |
| low cover (ferns, clover, tufts, mushrooms, pebbles) | hedges and crops along polylines, mushrooms, glints | 80 to 200 of a kind over a 60 to 120 m ring (`qfern`, `qclover`, `qgrass`, `qmushroom`): about one every 50 m² |
| mid layer (bushes, shrubs, rocks you walk round) | hedges, fences, benches, beehives, lamp posts | rocks only |
| trees | 3 oak kinds, instanced, crowns bent by the wind; 260 far trees as matcaps | code-built species (redwood, wroshyr, jungle tree, spruce, naboo tree), card crowns lit as one; fine |
| the nature kit | not used | wired through the placer (`model: 'kit:naturemega/<Name>'`, `placer.js:17`), tested, and named by no site |
| ground close up | ground map colour under a tiling blades-and-clover normal map | ground map colour under a photo scan that fades out at 90 m (`ground.js`); the layered splat at ultra only |
| light's colour | shade colour per mood, violet-leaning; exposure per mood | `lookOf(site)` derives one from the sky; three sites tune it (Coruscant, Yavin, Bespin), fourteen take the default |
| the final grade | `stage3d`'s GRADE: contrast, saturation, split tone, vignette, grain, per world | `universe/post.js`'s one grade, the map's, the same on every world; no split tone |
| ambient motion | chimney smoke, fireflies, butterflies, flies, a mill wheel, sheep | weather (motes, sand, snow, rain, embers); the lib's falling leaves, wind lines and grass tracks exist (`leaves.js`, `windLines.js`, `tracks.js`) and no surface imports them |

So the work is density, dressing, colour and motion, world by world, through the libraries the site has, with the kit as the cover layer. Nothing new in the renderer.

What the kit is for, and not. The galaxy asset upgrade (`docs/superpowers/specs/2026-10-08-galaxy-asset-upgrade-design.md`, decision at its line 98) ruled: "Quaternius goes in as ground cover and far silhouettes only. Not as near trees, not as buildings, not as people: the style clash is the reason." The kit worlds design (`2026-10-08-kit-worlds-design.md`, §6) planned the same packs onto Yavin, Dagobah, Naboo and Sorgan as cover, flowers, rock paths, dead and twisted trees under the built canopies, and CommonTree, CherryBlossom and Birch on the plains. This design keeps the first rule for buildings and people and takes the second's list for plants: the kit's trees stand where no built species does (groves on the plains worlds, dead and twisted trees under a forest's canopy), and never within 25 m of a landmark, a door or a quest spot, where a toy-like crown beside a photo-scanned wall would show. Every kit material is a house Lambert (the house look does the unifying: one shade colour, one fog, one ground bounce over kit and scan alike), and a world may tint a kit material toward its palette.

## The design

Five pieces. Each is data plus one pure, tested module; the scene file (`scene.js`, 3,571 lines, already over the measure's ceiling) gains at most a few wiring lines.

### 1. Flora: a world's cover from a recipe, not a hand list

A site names a biome and the recipe writes its scatter rows:

```js
flora: { biome: 'plains', tint: { Leaves_Common: '#b8a860', Grass: '#c6ad72' }, density: 1, trees: true }
```

`src/components/galaxy/surface/flora.js` (new, pure, tested) exports `floraRows(site, { reach }) → scatter rows` and `BIOMES`. A row is the placer's own shape (`{ kind, n, within, scale, solid, model: 'kit:naturemega/<Name>', flat?, above?, clear? }`), so the scene composes `[...site.scatter, ...floraRows(site)]` and nothing downstream changes: the placer draws kit rows instanced, their LOD1 past `lodDistance`, near-only shadow stand-ins (`near.js`), seated at ultra; `amounts.scatter` scales every `n` by the tier (0.5 / 0.75 / 1 / 1.5, 0.6 on a phone).

The biomes and what each lays, in three bands (metres from the landing, past the places' flats, which the scene already avoids):

| biome | cover, 4 to 160 m | mid, 20 to 320 m | trees, 60 to 560 m |
| --- | --- | --- | --- |
| `plains` (Naboo, Lothal) | Grass_Wide/Wispy/Common clumps, Clover, Flower groups and singles, Petals, Pebbles | Bush_Common, Bush_Common_Flowers, Rock_Medium | CommonTree (Naboo), none on Lothal (it is a prairie; its spires stand alone) |
| `temperate` (Sorgan) | Fern, Clover, Grass_Common, Mushroom_Common, Pebbles | Bush_Large, Rock_Medium | Birch and Pine between the built firs |
| `conifer` (Endor) | Fern (in place of the built ferns: see §6), Mushroom_Common and RedCap, Pebbles, Plant_3 | Bush_Large, Rock_Big | DeadTree under the redwoods, sparse |
| `jungle` (Yavin, Kashyyyk) | Fern, Plant_1/2/4/5 and their Big forms, Clover, Mushroom_Oyster | Bush_Long, Rock_Big (mossed by tint) | TwistedTree, sparse, under the canopy |
| `swamp` (Dagobah) | Plant_2, Plant_6, Mushroom_Laetiporus and Oyster, Fern | Rock_Medium, DeadTree roots | DeadTree, TwistedTree |
| `tropical` (Scarif) | Grass_Wispy, Flower_7, Plant_1_Big, Pebbles | Bush_Common_Flowers | none (its palms are its trees) |
| `dry` (Tatooine, Geonosis, Mandalore) | Pebbles, Plant_7 and Plant_7_Big (tinted to scrub) | Rock_Medium, Rock_Big, RockPath flats near the places | none |
| `ash` (Mustafar, Nevarro) | Pebble_Square, tinted near black | Rock_Big tinted dark, no plants | none |
| `tundra` (Hoth) | nothing green: Pebbles under the snow line only if any ground shows; otherwise none | Rock_Big as outcrops, tinted blue-grey | none |
| `none` (Coruscant, Kamino, Bespin) | nothing | nothing | nothing |

Counts: at `density: 1` a biome's cover is about one item every 12 m² inside 60 m (the Shire's flowers alone are one every 10 m²), thinning to one every 60 m² by 160 m; mid one every 400 m²; trees one every 2,000 m². The recipe takes `site.reach` and `site.water` into account as the scene's scatter does (`above` for anything that mustn't stand in water, `flat` for anything that mustn't stand on a cliff). Cover is `solid: false`; mid and trees solid by the manifest's footprint (`placer.js`'s `kitFootprint`).

A site keeps its hand rows: the recipe adds, never replaces. A site's `q*` rows (the older `catalog/quaternius.js` cuts, the same models imported one file a kind) are retired world by world as its biome covers them, so a world never draws a model twice from two files.

Tint. `loadKit` gains `tint: { [materialName]: '#rrggbb' }`, applied in `kitMaterial` as the material's colour (its map multiplied; a leaf's alpha untouched), one material per name per kit as now. The placer passes a site's `flora.tint` to the kit it loads, so Lothal's grass is straw, Mustafar's rock is black and a jungle's rock is mossed, from the data alone.

### 2. The look, world by world

Every site gets a `look` block (`look.js`'s `lookOf`: shadow, edge, halo, fogBelow) and a `grade` block, tuned with the `?debug` panel (`tune.js`, which copies the blocks out as code) and written into the site. `grade` is new: `{ contrast, sat, vignette, shadow: '#rrggbb', high: '#rrggbb', grain }`, the Shire's GRADE values' shape, read by the surface's post (`universe/post.js` already has the grade pass with `uContrast`, `uSat`, `uVignette`; it gains `uShadow`, `uHigh` split-tone uniforms and a `grade(opts)` setter; the map's picture is unchanged because the map never sets them). The surface's `look.js` exports `LOOK` for the one-feel sweep (`worlds/looks.js`; `galaxy/surface` comes off `looks.test.js`'s `EXPECTED_MISSING`): `art: 'scanned'`, `tone: 'house'`, the surface's bloom, with a `why` for the tone, since the surface's post tone-maps with the universe's shoulder.

The brief for the tuning, a world a line, from the films' grading: Tatooine warm and bleached (lifted blacks, a tan split in the highs); Hoth cold and blue-white (cyan shadow, no warmth); Endor green shade with warm shafts; Kashyyyk teal shade, gold highs; Dagobah grey-green, low contrast, heavy vignette; Yavin as it is (already tuned); Naboo clear, a little saturated, gentle; Kamino steel blue, high contrast; Geonosis red-orange, dust in the highs; Coruscant as it is; Mustafar black shade, orange highs, strong vignette; Scarif turquoise water, warm sand, bright; Bespin as it is; Nevarro ash-grey, ember highs; Mandalore glassed, violet shade; Lothal gold afternoon, straw highs; Sorgan mist, desaturated, cool.

### 3. The ground past arm's reach

`lib/three/surface`'s `antiTile` goes on the ground's scan at `high` and `ultra` (the backlog's "galaxy grounds past 90 m", `docs/autopilot/backlog.md`): a second copy of the scan turned and scaled ×3.7, blended by a slow noise, so the grain carries to 150 m with no repeat showing, and the scan's fade (`uScanFade`) moves from 28–90 m to 40–150 m. `detailNormal` within 6 m for the grain a 1K scan hasn't got. Not on `low` and `mid` (one extra fetch a map). The ground's own program is a `MeshStandardMaterial` with hooks (`ground.js`), so `antiTile` goes on last, as its header asks.

### 4. The living layer

Three of the lib's pieces, each one import and one `update` call:

- **Falling leaves** (`lib/three/leaves`): on `conifer`, `temperate`, `jungle` and `swamp` worlds, the budget's count (0 / 256 / 1,024 / 2,048 by level), the world's wind, the leaf colours from the biome (needles brown on Endor, broad green on Yavin), wrapped round the player.
- **Wind lines** (`lib/three/windLines`): on `plains`, `dry` and `tundra` worlds where the grass or the sand shows the wind, four ribbons, from `mid` up.
- **Grass tracks** (`lib/three/tracks`): the grass lies flat where you, the party and the rides have walked (`grass.js` takes `tracks`), 40 m round you, from `high` up. The speeders' and the walkers' are the same `track(width)`.

Each is off on `low`, off on a phone, and dropped at the pace's last step with the shadows (`lowerQuality`).

### 5. Sorgan, Scarif, Kashyyyk and Dagobah get grass

`site.grass` on Kashyyyk (short, sparse, under the wroshyrs) and Dagobah (reeds' colour, only above the water's `above`); Sorgan's and Scarif's are tuned, not changed. `grass.flower` is retired from the sites (the flowers are the kit's, §1).

### 6. What it costs, and the gate

Every world is held by `scripts/galaxy-check.mjs surface <id>` with `BUDGET=1`: draw calls and triangles no more than its baseline +10% and never over its level's row (`src/lib/budgets.js`: high 3M triangles, 700 calls; mid 1.5M, 500), its models within the row's MB. The worlds sit well under the row today (high: Dagobah 1.33M, Kashyyyk 1.41M, Yavin 1.81M, Naboo 1.38M, Sorgan 1.21M, Lothal 1.00M; `HANDOFF-galaxy.md`), so a world may grow past its own baseline +10% in this lane, under the row, and the phase that grows it re-makes `lab/baseline/surface-high.json` and `surface-mid.json` for that world and says the numbers in its commit. Endor is `KNOWN_OVER` (4.32M at high) and may not grow: its built ferns (0.52M) come out as its kit ferns (Fern_1 is 288 triangles) go in, so it ends lighter, and the commit says by how much.

The arithmetic at high, a plains world: cover inside 160 m at the recipe's density is about 2,200 items at a mean 250 triangles, 0.55M; mid 300 items at 600, 0.18M; trees 120 at 4,000 full within `lodDistance`, LOD1 past it, about 0.25M; the kit's draws about 20 species × 2 parts × 2 bands plus their shadow stand-ins, under 120 calls. Naboo lands near 2.4M and 500 calls. Mid (`props` 0.75, no antiTile, 256 leaves) near 1.4M. Low (0.5, no leaves, no tracks, no lines) near 0.8M, the row.

Bytes: the kit's family files a world fetches (`flower.glb` 0.3 MB, `grass.glb` 0.08, `bush.glb` 0.45, `rock.glb` 0.16, `pebble.glb` 0.12, `commontree.glb` 0.79, `deadtree.glb` 0.87, `twistedtree.glb` 1.5, `birch.glb` 1.2, `pine.glb` 0.58, `fern.glb` 0.07, `plant.glb` 0.15, `mushroom.glb` 0.18, `clover.glb` 0.07): a plains world about 2.3 MB more, a forest about 3.5 MB more, within `WORLD_MB['/galaxy']`'s "a few MB a world" and the row's 60 MB. The `q*` files retired from a world's rows come off its download.

## Decisions (for the owner to overturn)

1. **Cover and trees by recipe, landmarks by hand.** The recipe fills the land; `things` and `places` stay as they are; the kit never stands within 25 m of a place's centre or a zone's door (the scene's `avoid` with `clear: 25` for tree rows).
2. **Kit trees only where no built species stands:** groves on Naboo, Birch and Pine between Sorgan's firs, dead and twisted trees under Endor's, Yavin's, Kashyyyk's and Dagobah's canopies. Never beside a building. Lothal and Scarif keep their skylines (spires, palms).
3. **One tint a material a world**, by data. No new material kinds, no palette re-UV.
4. **The house look stays the one look**: every kit material is `house.material()`; the grade is the last pass; no new post pass, no new dependency, GLSL only, pure rewrites tested on stubs.
5. **Nothing new in `scene.js`** beyond wiring: flora rows composed where `scattered` is made, three `update` calls in the frame, one `dispose` each. New code is new files under 800 lines with tests beside them.
6. **A world's baseline may rise** in this lane, under its row, with the numbers in the commit; Endor's may not.
7. **Ultra is additive**: nothing here reads `ultra` except through `amounts`.

## What this is not

- Not a rewrite of any built species, building or figure; not a Meshy or gen3d ask (nothing is generated; the kit is on disk).
- Not the galaxy's orbital bodies, the landings, the Death Star or the space scene.
- Not weather on the authored worlds beyond the three living pieces above.
- Not WebGPU, not TSL, not a new runtime dependency.
- Not a change to any quest, place, zone or line.
- Not the sequel trilogy, anywhere.

## Phases

| phase | worlds | what | gate |
| --- | --- | --- | --- |
| 1 | Naboo, Lothal | `flora.js` and `BIOMES`, `loadKit` tint, the placer passing it, the `plains` recipe; Naboo's groves; Lothal's straw | tests; `galaxy-check surface naboo,lothal` within the row, re-baselined; before/after shots |
| 2 | Endor, Sorgan, Yavin, Kashyyyk, Dagobah | `conifer`, `temperate`, `jungle`, `swamp`; Kashyyyk's and Dagobah's grass; Endor's built ferns out | Endor lighter than its baseline; the rest within the row, re-baselined; shots |
| 3 | all 17 | `look` and `grade` a site; the post's split tone and `grade()`; `LOOK` export, off `EXPECTED_MISSING` | `looks.test.js`; shots of every world, the brief's line each |
| 4 | Tatooine, Geonosis, Mandalore, Mustafar, Nevarro, Hoth, Scarif | `dry`, `ash`, `tundra`, `tropical` | within the row, re-baselined; shots |
| 5 | all with ground | `antiTile` on the ground at high; leaves, wind lines, tracks by biome | frame time at high within 2 ms of before on one world (`galaxy-check`'s times, same machine); shots at 150 m |

Each phase is one commit on the branch, pushed, with `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build` green, the phase's `galaxy-check` line in the commit body, and the shots under `docs/superpowers/evidence/galaxy-surfaces-living-layer/<phase>/`.

# Quaternius packs (CC0)

The owner's Quaternius packs, bought or downloaded on 2026-10-08, kept as the GitHub release [`assets-quaternius`](https://github.com/tilakpatell/tilakpatell.com/releases/tag/assets-quaternius) instead of in the repo. Together the archives come to about 1.5 GB, and most of each pack is source files (`.blend`, FBX, OBJ, engine projects) the site never serves. Every pack is CC0 1.0 (public domain): the GLBs can be served on the site, and credit is optional. A pack imported as the worlds' kit carries its licence and source in its manifest (`public/kit/<pack>/index.json`), and `npm run credits` (`scripts/credits.mjs`) reads every manifest to name Quaternius, each pack and its model count in CREDITS.md's CC0 section. Models brought into a world's landing by `scripts/quaternius.mjs` have their credits in `public/games/credits.json` (as `quaternius/<model>`), which `scripts/credits.mjs` lists under Quaternius in CREDITS.md too.

Unpacked, exactly as downloaded (Blender sources, FBX, glTF, textures, engine exports), the same packs are in their own repo, [tilakpatell/tilakverse-assets](https://github.com/tilakpatell/tilakverse-assets): clone it whole (about 2.2 GB), or one pack with a sparse checkout (its README shows how). It's public, so a session on any machine or account can get it.

Or fetch a pack's zip from the release into `lab/assets/<pack>/` (git-ignored):

```
node scripts/assets-fetch.mjs list
node scripts/assets-fetch.mjs ual2 city
```

Then a model pack goes in as the worlds' kit with `node scripts/kit/import.mjs <pack>`: one GLB a family, each model with its LOD1, compressed (meshopt, WebP), and a manifest, into `public/kit/<pack>/`. A pack that comes as FBX only (`farm`, `street`, `furniture`) is turned into GLBs first by `node scripts/kit/fbx.mjs <pack>`. `node scripts/kit-check.mjs` then holds every pack to its budgets. The manual is [`scripts/kit/README.md`](../../scripts/kit/README.md). The two animation libraries (`ual1`, `ual2`) go through `scripts/ual-bake.mjs` instead.

Anything else a world uses goes into `public/models/…`, compressed (meshopt, WebP), as the other import scripts do (`scripts/sketchfab-import.mjs`, `scripts/kenney.mjs`). The planet landings' trees, rocks, flowers and street furniture come in through `scripts/quaternius.mjs`: a GLB a family of models under `public/models/quaternius/`, a node a model, with a manifest of each one's size, triangles, collider and body, and its credit:

```
QUATERNIUS=/path/to/tilakverse-assets/quaternius npm run quaternius [nature/trees …]
```

## What's in each

| pack | archive | what | best for |
| --- | --- | --- | --- |
| `ual1` | Universal Animation Library (source, 49 MB) | 120+ clips on the same rig, in one GLB (`Unreal-Godot/UAL1.glb`, and `UAL1_RM.glb` with root motion): walking and jogging in 8 directions, crouch-walking in 8, crawling, climbing, sitting (three idles, talking, nodding) and sitting on the ground, hits to the head, chest, shoulders and stomach, deaths, dodges, a pistol's aim, shot and reload, punches, spells, swimming, driving, a shop counter. The free Standard pack's 45 of these are already baked (`public/games/meshy/ual-*.glb`) | every rigged figure, through `scripts/ual-bake.mjs` |
| `ual2` | Universal Animation Library 2 (source, 53 MB) | 130+ clips on Quaternius's universal humanoid rig, in one GLB (`Unreal-Godot/UAL2.glb`, and `UAL2_RM.glb` with root motion): melee combos with recoveries, strafes and backpedals, parkour and climbing, deaths, hits, talking, waving, carrying, farming, fishing, zombie walks. Also the female mannequin and the `.blend` | every rigged figure on the site, baked onto the Meshy skeleton through `scripts/ual-bake.mjs` as the first library's clips are |
| `city` | Downtown City MegaKit (standard, 235 MB) | modular city blocks: brick and metal facades, windows and doors, cornices and trims, slate roofs, three whole buildings, 2- and 4-lane streets with curbs, sidewalks and corners, road decals (crosswalks, arrows, lines), AC units, bollards, planters, drains | Albuquerque's downtown streets, Invincible's city, the office's Scranton exterior |
| `street` | Street Pack (4 MB) | road tiles (straights, curves, 3- and 4-ways, bridges, ramps, elevated roads), traffic lights, street lights, stop and no-parking signs. Its lamps, traffic lights and signs are the kit `public/kit/street/` (2026-10-22, 8 models, 0.17 MiB: `node scripts/kit/fbx.mjs street`, then `node scripts/kit/import.mjs street sign streetlight trafficlight`), modelled at about a quarter of real size (the lamp 1.09 high), so a world draws them scaled up (Invincible's `world/streetKit.js`: 4.2 to 4.4) | Albuquerque's roads, Invincible's city grid |
| `furniture` | Furniture Pack (3 MB) | beds, sofas, armchairs, chairs, stools, tables, coffee tables, bookcases (empty and full), closets, lamps, vases, a pot plant | interiors: the White house and Casa Tranquila (Albuquerque), the Grayson home (Invincible), the office, the Smith house (C-137) |
| `space` | Ultimate Space Kit (37 MB) | four astronauts and four mechs (rigged), four enemy creatures, rovers, spaceships, geodesic domes and base modules, solar panels, antennas, alien trees, rocks, eleven planets, pickups | the Rick and Morty dimensions, toy-style space props, the universe map's small craft |
| `farm` | Farm Animals (7 MB) | horse, cow, sheep, pig, llama, zebra, pug, rigged and animated | Middle-earth's ponies, the Shire's sheep and Maggot's farm, Rohan's horses |
| `nature` | stylized nature pack (414 MB) | birch, maple, pine, palm and dead trees with bark and leaf maps, bushes, flowers, grass, rocks. Its maples (red and orange leaf), birches (yellow, white bark) and ten dead trees are the kit `public/kit/nature/` (2026-10-19, 1.96 MiB: `node scripts/kit/import.mjs nature mapletree birchtree deadtree --from <tilakverse-assets>/quaternius/stylized-nature-pack`), planted along the Road (`road/stages/tables.js`) | the Shire, Lothlórien, Naboo, Yavin 4; the Road’s autumn and its dead lands |
| `naturemega` | Stylized Nature MegaKit (source, 718 MB) | five of each tree (birch, cherry blossom, pine, giant pine, twisted, dead, common), bushes, ferns, clover, flowers, grasses, wheat, mushrooms, rocks, rock paths, pebbles | the same worlds' ground cover and paths |

The toy-like, low-poly style of the city, space and nature kits suits the stylized worlds (Middle-earth, the Rick and Morty dimensions, Dot Matrix) more than the photo-real ones. For Albuquerque and Invincible, the modular city and street kits work as layout and filler, under the site's own baked look (`lib/three/house.js`).

## From the assets repo, without the release zips

A session with git but no release zip takes a pack's folder as the assets repo keeps it (unzipped): a sparse checkout into `lab/assets/.repo/` once, linked as `lab/assets/<pack>/`. The MegaKit's glTF files are then in `lab/assets/naturemega/glTF/`.

```
node scripts/assets-fetch.mjs --repo naturemega
```

## The Star Wars originals (not CC0)

The assets repo's [`sketchfab-star-wars`](https://github.com/tilakpatell/tilakverse-assets/releases/tag/sketchfab-star-wars) release keeps six Sketchfab models as downloaded, each split into 8 MB parts (`<file>.part-aa`, `-ab`, …) beside a `SHA256SUMS`: leoxx300's B1 battle droid (CC BY 4.0, 53 unnamed joints, no clips), Quiznos323's AT-AT (CC BY-NC-SA 4.0; the same model `catalog/ice.js` already uses) in 4K and 1K maps, a TIE fighter and two Venators (CC BY 4.0; the galaxy already has its own). The fetch joins whatever parts are there, in order, and checks the result against the sums:

```
node scripts/assets-fetch.mjs starwars b1      (into lab/assets/starwars/b1-battle-droid.glb)
```

Each model's credit (title, author, licence, source) is in `PACKS.starwars.models` in `scripts/assets-fetch.mjs`, so an import can write `src/data/modelCredits.json` without Sketchfab's API. Shrink one with `scripts/sketchfab-import.mjs` before it goes into `public/models/`, and credit it there.

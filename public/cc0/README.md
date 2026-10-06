# CC0 assets

Everything in this folder is CC0 (public domain): free to use, no credit required.

- `lab.exr`, `workshop.exr`, `studio.exr`: HDRIs from [Poly Haven](https://polyhaven.com/hdris), resized to 512x256 and DWAB-compressed by [@pmndrs/assets](https://github.com/pmndrs/assets) 1.7.0. Used as image-based lighting and reflections in the 3D games.
- `cloud.webp`: a soft cloud puff from @pmndrs/assets, used for steam and smoke.
- `materials/<name>/{color,normal,arm}.webp`: 1K PBR sets (colour, OpenGL normal, and AO/roughness/metalness packed in R/G/B).
  - `rv-wall`: Poly Haven `japanese_cedar_planks`
  - `rv-floor`: Poly Haven `old_linoleum_flooring_01`
  - `rv-bench`: Poly Haven `wood_table_001`
  - `lab-floor`: Poly Haven `concrete_floor_worn_001`
  - `lab-wall`: ambientCG `Tiles010`
  - `lab-bench`: ambientCG `Metal009`
  - `casa-wall`: Poly Haven `beige_wall_001` (Dimitrios Savva, Rico Cilliers)
  - `casa-floor`: Poly Haven `floor_tiles_08` (Rob Tuytel)
- `galaxy/<role>/{color,normal,arm}.webp`: the surfaces the galaxy's worlds build their own buildings and props from (`scripts/galaxy-textures.mjs`; the colour maps made into detail maps, so each part keeps its own colour), all from Poly Haven: `adobe` `patterned_clay_plaster`, `stone` `large_sandstone_blocks_01`, `rock` `rock_face`, `metal` `metal_plate_02`, `paint` `blue_metal_plate`, `bark` `bark_brown_02`, `wood` `weathered_planks`, `concrete` `concrete_wall_008`. Their real sizes are in `galaxy/index.json`.

## Not CC0: made for this site

These live outside this folder and are not public domain.

- `../models/galaxy/surface/{theed}.glb` (and their `.lod1.glb` light copies): buildings on the galaxy's worlds, generated for this site by Tilak Patel with Meshy AI (meshy.ai, a paid plan: the output is the site owner's), each from a real picture of the place (a film still or a production painting, lifted onto a plain background) or a concept image, or one of the owner's own Meshy models retextured. Made by `scripts/meshy-galaxy-buildings.mjs`; the Meshy task ids, and the Wookieepedia pictures each was made from, are in `scripts/meshy-galaxy-buildings-tasks.json`. Listed in `src/components/galaxy/surface/catalog/made.js`.
- `../models/metherria/{drum-base,drum-blue,hammer}.glb`: Walt's two chemical drums and his ball-peen hammer in Metherria, generated for this site by Tilak Patel with Meshy AI (meshy.ai, a paid plan: the output is the site owner's). Made by `scripts/meshy-albuquerque.mjs` (concept image, then a textured model, baked into the scene's frame with 1K WebP textures); the Meshy task ids are in `scripts/meshy-albuquerque-tasks.json`.
- `../models/albuquerque/<id>.glb`: Albuquerque's people (Walt and Jesse in hazmat, Metherria's customers, Hank, Hector and the nurse), generated for this site by Tilak Patel with Meshy AI in the same way, then rigged by Meshy: stylized figures described by look and costume, not likenesses of anyone real.
- `../models/albuquerque/world/<name>.glb`: the Albuquerque world's buildings and cars (Walt's house and his Aztek, Hank's SUV, Saul's office, Los Pollos Hermanos, the laundry over the superlab, Casa Tranquila, the A1A Car Wash, and the rest of town: the KiMo Theatre, the Dog House, the DEA's office, the Crossroads Motel, the house under Vamonos Pest's tent, Jesse's house, Loyola's diner and Hank and Marie's house), generated for this site by Tilak Patel with Meshy AI in the same way, baked to the ground with their longest side set to size. (`rv.glb` there is the first RV, no longer loaded: the town uses the Sketchfab one below.)

## Not CC0: CC Attribution, from Sketchfab

In `../models/sketchfab/`. Each is its author's, used under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), and changed for the web by `scripts/sketchfab-import.mjs` (textures resized and re-encoded as WebP, meshes simplified and Meshopt-compressed, stood on the ground at the size the scene wants). The Albuquerque and Cybertron pages credit them too.

- `rv.glb`: [Fleetwood Bounder - Breaking Bad](https://sketchfab.com/models/85ea7208651a47f6a3b2924dadaeb955) by Zack_Hawley. The RV out past To'hajiilee.
- `esteem.glb`: [Suzuki Esteem 1998 (Saul Goodman version)](https://sketchfab.com/models/72f36689982a4066b4382a7c2b5ecaa4) by temp0.crazy. Parked beside Saul's office.
- `tank.glb`: [Railway tank](https://sketchfab.com/models/c87b96181fd249ae8de1ac14575ec475) by dmitriev_nd. The freight train's tank cars.
- `cactus.glb`: [Cactus | Pack](https://sketchfab.com/models/588596f1601d48e6ad4cb24b31c3f33c) by yadrogames. The desert's cacti.
- `tumbleweed.glb`: [Tumbleweed](https://sketchfab.com/models/e9fa341c64fe4626b5d5b0052b0c0b64) by biggreenorange.
- `watertower.glb`: [water tower](https://sketchfab.com/models/1c2f86dc8f794c85a91706d401d104db) by Lora_o. The water tank out by one of the drops.
- `bucket.glb`: [LosPollosHermanos bucket](https://sketchfab.com/models/d9bbe6d4a7e54d87bb51d518bad2c7c8) by Batuhan13. What's waiting at a delivery's drop.
- `avengers/spiderman-moves.glb`: Spider-Man's idle, walk, run and jump for `../models/marvel/spiderman.glb` ([Spiderman Brand New Day](https://sketchfab.com/3d-models/spiderman-brand-new-day-ef54026773e14cffad16359fd771c5f8) by mpolo0604), clips only (no mesh). The idle, walk and jump are from [Spider-Man 2 Advanced Suit 2.0 PS5](https://sketchfab.com/3d-models/spider-man-2-advanced-suit-20-ps5-90907e9f6ad04e299239f306d22848f8) and the run from [Spider-Man 2 Symbiote Suit (PS5)](https://sketchfab.com/3d-models/spider-man-2-symbiote-suit-ps5-0845c06a538746c8a8111b241575bd9d), both by jerrylxia, retargeted onto his skeleton by `scripts/sketchfab-spiderman-moves.mjs`.
- `avengers/thor.glb`: [Thor](https://sketchfab.com/3d-models/thor-7cc5f55499cc4d67b7a1c92a6845c8a0) by Bhavlin. Thor, about the compound. His idle, walk and run (and Black Widow's) are from [Basic Human Male](https://sketchfab.com/3d-models/basic-human-male-f1775be7b1b94e4ea40d25287585ee69) by enzinogenie, retargeted onto their skeletons by `scripts/sketchfab-avengers.mjs`.
- `avengers/hulk.glb`: [Hulk | Marvel Rivals](https://sketchfab.com/3d-models/hulk-marvel-rivals-1379a9de81b7426ea4ee71ff4c126e80) by King_45. Hulk, about the compound, with his own idle, walk and run.
- `avengers/widow.glb`: [Black Widow – Animated 3D Character](https://sketchfab.com/3d-models/black-widow-animated-3d-character-da36a24d113f49908459bf33e00a1f1e) by Kmirp99. Black Widow, about the compound.
- `avengers/ironman.glb`: [Iron Man MK7](https://sketchfab.com/3d-models/iron-man-mk7-ad4776eea8184283a3e49cf5487df754) by CHANG747. An Iron Man armour at the workshop door.
- `optimus-transform.glb`: [Bumblebee - Optimus Prime Transform Animation](https://sketchfab.com/models/35f9cb09b1b248c7bd6b12912ac8cd3a) by dioiiiii2. Optimus's truck, his robot, and the whole change between them, on the Cybertron page.

Megatron's own change on that page uses two models the site owner made with Meshy for Roll out (`../games/meshy/rollout/seeker.glb`, the jet, and `megatron.glb` with `megatron-idle.glb`, rigged): `src/components/cybertron/transform3d.js` animates between them, and builds his fusion cannon.

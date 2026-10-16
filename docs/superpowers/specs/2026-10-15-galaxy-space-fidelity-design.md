# The galaxy’s ships hit on their shapes and drawn at the game’s cut: why the war’s ships read blurred and flew through each other, and what was done. The design

Date: 2026-10-15. Status: **design and first implementation, one session, by the owner’s ask** (“why the textures and hit boxes on the ship battles in Star Wars galaxy are not working right? Why are the ships so blurry, they should look like Battlefront 2 as we are using their assets. Architect and implement”). It is the second part of the hulls design (`2026-10-14-galaxy-space-hulls-design.md`, whose first part merged as #1003) and the first page of the “every ship at the game’s full detail on mid and above” project that design named as the next.

## 1. What was found (2026-10-15, `origin/main` at `f97079c7`)

### 1.1 The blur: the war’s ships carry a fraction of the game’s maps

Measured by `src/lib/glbTextures.js` on the committed files (every image’s own header; a scratch script, not kept), in the cut each tier loads today:

| ship | file | triangles | maps | on which tiers |
| --- | --- | --- | --- | --- |
| Star Destroyer | `models/galaxy/destroyer.glb` | 24,300 | 50: 21 at 256², 25 at 128², 4 KTX2 | low, mid, high |
| Venator | `venator.glb` | 24,038 | 22: 8 at 256², 11 at 128² | low, mid, high |
| MC80 | `moncal.glb` | 19,892 | 21, 256² and 128² | low, mid, high |
| CR90, Providence | `corvette.glb`, `providence.glb` | 11,937, 22,690 | 256² and 128² | low, mid, high |
| TIE fighter, A-wing, Y-wing, TIE bomber, ARC-170, vulture… | `tie.glb` … | 2,558 to 6,918 | colour 512², data 256² | every tier |
| X-wing, TIE interceptor, Slave I, Scimitar, TIE striker | `surface/<kind>.glb` | 34,000 to 58,000 | 1,024² | high and ultra (lane S1) |

The cause is in the pipeline, not the renderer: `scripts/bf2017-space.mjs`’s `FLEET_CUT` is `{ tris: 24000, tex: 256, maps: 128 }` (“the war’s capitals are loaded at every quality level: lighter”), and `scripts/bf2017-fleet.mjs` writes every kit fighter from its surface **light** cut (`<kind>.lod1.glb`, the game’s LOD under 7,000 triangles with maps at half size). A Star Destroyer is 1,600 m long: a 256-texel map across a hull plate is a texel to several metres, which is the blur. The galaxy-in-space design (2026-10-11) had recorded the capitals at “512 on every tier”; the files are half that. Only ultra loads the 1,024 cuts (`ULTRA`, in the bucket), and no tier loaded the fighters’ plain cuts for the twelve kit fighters, though every one is published (`src/data/galaxyAssets.json`: `surface/<kind>.glb` at 1,024 maps, `surface/<kind>.ultra.glb` at 4,096).

What the device could carry (`src/lib/detail.js`): mid keeps model maps to 1,024, high to 4,096. The textures are sharpened right (`lib/three/textures.js`: the tier’s anisotropy on every map; the colour space stamped by `ktx2-colour.mjs`). Two smaller things read as blur and are not changed: the post chain draws softer when frames run late (`galaxy/scene.js` `lowerQuality`, `lib/three/pace.js`’s steps down to 0.5), and past 45 lengths a ship is its vertex-coloured far copy (`LOD_NEAR`).

### 1.2 The hit boxes: the hulls loaded, and nothing read them

The hulls design’s first part (#1003) made a hull a kind (`scripts/bf2017-hulls.mjs`: 42 in `src/data/galaxyHulls.json`, the game’s physics shapes for 23 kinds, the site’s models simplified for the rest), the pose module (`lib/combat/pose.js`), the queries (`lib/combat/hulls.js`: `segmentHit`, `hullContact`) and the loader (`galaxy/hulls.js`, wired into `galaxy/models.js`). The plan’s tasks 10 and 11 (the bolts and the contacts through the one chain) were not started: `grep segmentHit\|hullContact\|hulls.get src` found no reader outside the library and the loader. Every hit was still a sphere: your bolt on a war fighter within `max(0.35, size × 0.9)` (`universe/battle.js`), the AI’s within `size × 0.6`, a capital a row of spheres down its centre line (`universe/wars.js` `HULLS`), a hunter within `size × 0.9 + 0.12` (`hunterRules.js`), the set piece’s Star Destroyer its own chain (`capitalRules.js`). So a bolt at a Star Destroyer’s wing met nothing, and a fighter flew through the wing.

## 2. The decision

1. **Every bolt in the galaxy’s space meets a ship on its shapes, where its hull has loaded**, through the one pose the scene draws it at; the sphere stays in front as the broad phase, and a kind whose hull is not here (not loaded yet, or a kind with none: the universe map’s wars) is hit as before. The hit says `part` and `property` (the part’s physics material, `damage.json`’s rows) so the damage rules can read them.
2. **Nobody flies through a capital ship.** A war fighter is kept out of a capital’s hull each step; your ship is kept out of the war’s capitals and the set piece’s after the step, with a planet’s bump or crash by the closing speed. The chains of spheres stay as `ship.js`’s solids, thinner than the hull, so the hull is met first.
3. **A desktop draws the game’s cut.** On high and ultra the twelve kit fighters take their plain surface cuts (the game’s LOD0 with 1,024 maps, nose 0: a surface file faces +z as it comes), and the war’s capitals take the kits’ 1,024 cuts (`ULTRA`) on high as on ultra. A phone and a laptop keep the fleet’s files.
4. **What is not changed, and why.** The damage numbers stay the site’s (a laser 1, a fighter’s 5 hit points): the hulls design’s §2.4 (the game’s numbers with the 6–20 minute guard) is a retune to play in a browser, not to do blind. Another pilot’s ship keeps its sphere (its model is `universe/shipModels.js`’s build, whose frame the galaxy’s hulls were not fitted to). The Interdictor keeps `interdiction.js`’s solids.

## 3. What shipped (this branch)

- `lib/combat/pose.js`: `yxzBasis` (three’s YXZ Euler as a basis, `playerPose` on it) and `pieceCapitalPose` (the set piece’s capital: `rotation.set(pitch, heading + π, roll)` at its length). `lib/combat/hulls.js`: `probeSphere(r)`, a small ship’s stand-in for contact.
- `universe/battle.js` takes `hulls`: `capitalHit` through `segmentHit` by `capitalPose` (the bob through `battle.drawn`, which `battleScene.js` sets each frame); your shot and the AI’s bolts on fighters and runners through the hull; a fighter pushed out of a capital’s hull each step (`hullContact`, a few goes, its nose eased along the face).
- `universe/hunterRules.js` (`createHunt({ hulls })`): your shot on a hunter through its hull by `hunterPose`, the hunters’ own `hunter/<kind>` where the galaxy made one. `hunters.js` asks for a pack’s hulls as it comes.
- `universe/capitalRules.js` (`createCapital({ hulls })`): the set piece’s Star Destroyer hit on its shapes; `setpieces.js` hands them on and exposes `shapes` for the ship’s contact.
- `galaxy/scene.js`: `models.hulls` to the hunters, the set pieces and the war; `heldOffHulls` after the step. `galaxy/warfront.js`: the battle on `models.hulls`.
- `galaxy/models.js`: `HIGH_CUTS` (the twelve kit fighters’ surface plain cuts on high and ultra) and `ULTRA` on high. `scripts/lib/bf2017-hulls.mjs`’s `cutsOf` counts a kind’s own high cut as a lighter cut, so the plain fleet file keeps the hull’s frame.
- Tests: `battle.test.js` (a bolt at a Star Destroyer’s wing edge hits where the spheres missed and the space beside it stays open; over an X-wing’s back it misses where its sphere hit, through its body it hits, property 68; the AI’s bolts the same; a kind with no hull is hit as its sphere; a fighter flying through the wing is held on it where it flew through before), `hunterRules.test.js`, `capitalRules.test.js`, `pose.test.js`, `hulls.test.js`, `models.test.js` (the cuts by tier).

## 4. What it costs, and what is the owner’s

- **A desktop’s arrival downloads 29 MB where it downloaded 8** (`models.test.js`’s arrival row, raised from 9 to 40 at high with this reason): the Star Destroyer’s 21.6 MB ultra cut. By `lib/glbTextures.js`’s count the Star Destroyer alone is about 160 MB of graphics memory at 1,024 (21 colour maps decoded to RGBA with mips, 29 KTX2 at a byte a texel), against the pipeline design’s 256 MB a world on a desktop. **The owner’s desktop job**: a `high` cut a capital, 1,024 colour and 512 data maps at the fleet’s 24,000 triangles (`bf2017-space.mjs --fleet --high`, a `fleetHigh` beside `fleetUltra`), published and put in a `HIGH` table in place of `ULTRA` on high; and the fleet cut raised to 512 and 256 for mid, if a phone can carry it (the ISD’s file would go from 2 to about 6 MB). Neither can be made here: the drop and the bucket’s keys are the desktop’s.
- **The high cuts’ frames are measured on the desktop**: `node scripts/bf2017-hulls.mjs` holds every cut of a kind to its hull within 2 %; the surface plain cuts were not measured here (the bucket is not reachable from this session). The X-wing’s plain cut, already a cut of its hull, passed in #1003.
- **In a browser**: `scripts/galaxy-war-check.mjs` at mid and high, with its shots and hits by part; `scripts/perf-probe.mjs galaxyWar` for the contact queries’ share of a frame (the hulls design’s under 0.5 ms with 32 a side).
- **The game’s damage** (the hulls design §2.4) is the next page: the hit now says the part and its property, so `lib/combat/damage.js`’s `hitDamage` and `capitalPart` can be wired without touching the queries.

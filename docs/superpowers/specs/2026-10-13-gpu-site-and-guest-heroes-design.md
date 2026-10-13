# The site on the GPU, the game's methods tested, and the site's own cast as Battlefront units. The design

Date: 2026-10-13. Status: read by the owner on 2026-10-13, his answers in section 8; nothing in it is built. Written by the session `tilak-19` from `origin/main` at `c79955622` (#965) and from PR #962 (`claude/bf-frame-once`, merged on his word 2026-10-13 05:44 UTC as `64bdba15a`). Builds on `2026-10-11-gpu-first-renderer-design.md` (lanes G1, N1 to N7), `2026-10-08-npc-player-rigging-design.md` (the site's cast on one skeleton), `2026-10-10-battlefront-game-design.md` and the UI lane's `2026-10-13-hoth-landing-game-menu-design.md` (on `claude/bf-landing-menu`, approved, not on `main` yet). Every number below names where it came from; a number with no source is a proposal and says so.

## What the owner asked

In this session, 2026-10-13: "Not confirmed, so not copied: distant shadow cache on Hoth, compute skinning, animation culling. Test this and test the actual quality and performance." "I want you to improve the overall site to use the GPU and other things and improve it." "We want to also add our rick and morty and main character models in the battlefront games and stuff. So figure out how to make it have the same rigging and animations and stuff (open in frosty and stuff maybe)? Figure out so we can add them as a player in battlefront with their own star cards and abilites." "I have 50% of the frostbite engine code downloaded but I will tell you to use when its fully done." "Look at other sessions first and use … superpowers to make a spec."

What he told the other sessions that bears on this (their transcripts, read 2026-10-13):

- "Make the entire site dependent on GPU not the CPU … (unless no GPU)." "Make sure u do multithreading and everything to amke it so there is ZERO lag." "How can we make it so for a 5090 it's super ultra quality but it can also run on macOS with a pro chip?" The site was laggy "even with my AMD ryzen 5 pro w 740m graphics".
- "Do only hoth for now we plan to port everything but just hoth rn to make it perfect and then apply to the rest once hoth is done (for star wars galaxy)."
- "I want you to pefect the assets and movement, animations, abilities … I want you to port all of the battlefront 2 heros villans vehicles and troops."
- On process, to the UI lane: "Full spec and plan review". On merging, to single lanes: "merge as you finish things", "merge to main"; each lane has read that as its own PRs.

## What this design assumes (mine, for him to correct)

1. "Main character models" is not a term anywhere in the repository, and no model of the owner himself exists. This design reads it as the people a visitor already plays: the ships' on-foot parties (`universe/footFigures.js`'s `PARTY`) and the wardrobe's casts (`rickmorty/wardrobe/looks.js`'s `CASTS`), which is Rick, Morty, Walt and Jesse (Han, Luke and Chewie already have the game's own bodies). Rick and Morty first; section 4 lists every model found.
2. A guest plays as a hero does: bought with battle points on the deploy screen, three abilities, three star card slots, its own row in the Collection. It is not a reskin of a trooper class.
3. Hoth first, as he ruled for the UI lane: every lane here lands on Battlefront's Hoth, is measured there, and only then is applied to the seventeen Star Wars surfaces and the other worlds.
4. The Frostbite source he is downloading is not used, read or planned on here. Nothing below waits for it.
5. Nobody attaches to, reads the memory of or dumps the running game. Pictures of its window from outside (`user32!PrintWindow`) are the only use of it.

## 1. Where things stand tonight

### The frame on the owner's desktop

Edge 154 headless on the RTX 5090, WebGPU, uncapped, Hoth's Galactic Assault, the same seeded day, no profiler on the page, ten seconds to settle after the deploy, eight standing, twelve walking. "Live" is tilakpatell.com as deployed (no merge since 00:17 UTC had reached it: each merge cancelled the deploy before it, which #967 stops). "#962" is that branch built with `vite build --mode bucketcheck` and served by `vite preview`. Two runs each, interleaved; the game itself was open on the machine throughout, so every figure is somewhat worse than a quiet desk would give. Source: `.scratch-check/perf-walk.mjs` on `claude/bf-frame-once`, 2026-10-13 01:20 to 01:31.

| | live | #962 |
| --- | --- | --- |
| 2,560 × 1,440, standing, frame p50 | 21.9 and 24.1 ms | 8.2 and 7.5 ms |
| 2,560 × 1,440, walking, frame p50 / p95 | 26.4 / 41.7 and 21.8 / 30.3 ms | 9.1 / 14.8 and 8.3 / 12.2 ms |
| 5,120 × 1,440 (his screen), standing, frame p50 | 21.5 and 20.5 ms | 12.7 and 13.3 ms |
| 5,120 × 1,440, walking, frame p50 / p95 | 23.7 / 34.7 and 26.7 / 35.7 ms | 13.9 / 19.3 and 13.7 / 19.3 ms |
| the chip's own time a frame (`timestamp-query`), 2,560 / 5,120 wide | 4.0 to 4.6 / 9.0 to 10.5 ms | 4.8 to 6.2 / 9.4 to 10.4 ms |
| after the level is in, until the deploy lands | 14.6 to 20 s at 9.5 to 13 frames a second | 8.3 to 10.6 s at 15 to 18 |

So the live site runs Hoth at 35 to 46 frames a second on a card that needs 4 to 10 ms a frame, and #962 takes it to 104 to 130 at 2,560 wide and 70 to 75 at 5,120 wide. At 5,120 wide the chip's 9.4 to 10.4 ms is now what holds the frame; below that, JavaScript still is.

What #962 holds (each measured in one page with the change switched every four seconds, `docs/superpowers/evidence/gpu-first/N1/README.md`): the level on the GPU scene (walk p50 15 to 19 ms to 6.5 to 7.5 on the dev server), the scene's world matrices once a frame (2.4 to 3.5 ms to 0.7 to 1.0), each soldier part's skin cut to the joints it uses (17 soldiers 2.5 to 3.1 ms to 1.3), and the player's body fetched behind the veil. #964 (merged) removed the built site's 2.7 s frame while loading.

What is left of the frame's JavaScript on Hoth, from the same evidence file: the soldiers (1.3 ms for 17, each still 5 to 7 draws; at ultra a soldier keeps the game's LOD4 out to 400 m, `src/lib/budgets.js:47`), the GPU scene's bundle (1.6 to 1.9 ms: its groups' bindings are still updated one by one), the sun's cascades (about 1 ms), frames of 85 to 155 ms in the first ten seconds after a deploy while node shaders are built, and the veil's 8 to 20 s at 10 to 18 frames a second.

### The picture

No picture of the game at full size exists to score the site against: `docs/superpowers/evidence/gpu-first/reference/` holds only the lit fixture, `D:\bf-frames` is empty, and the game's window tonight was 640 × 360 on the pre-round card screen. Section 5 says how one is taken. Until then "quality" here is a list of what the page draws on the 5090 (tier T2, internal scale 1, a chain of 10 to 11 passes: TRAA, SSGI, SSR, ambient occlusion, bloom; four sun cascades of 2,048 with two redrawn every frame and two every fourth), not a score.

### The other lanes (read from their branches and transcripts)

| lane | holds | touches |
| --- | --- | --- |
| `tilak-a6`, the sim | #963 merged (Instant Action's round and bot logic, battle-point offers); #966 open (a round swapped in place, side as a choice, Supremacy) | `battlefront/module.js`, `battle.js`, `src/lib/battlefront/**` |
| `tilak-b4`, the UI | #959, #961 merged (the Collection's data and screens); #964, #965 merged; the landing and menu spec approved, its phase 1 plan awaiting review | `BattlefrontWorld.jsx`, `screens/*`, `pages/*`, `waiting.js`; phase 2b rebuilds the spawn screen |
| stopped on usage, unmerged | `claude/bf-heroes-deploy` (heroes on their own kit in the sim: `heroKit.json`, `hero.js`, `heroAbilities.js`), `claude/bf-troop-classes` (eight class bodies), `claude/bf-vehicles`, `claude/bf-perf-tiers` (the no-GPU path, unfinished) | `sim.js`, `figures.js`, `module.js`, `gpuScene/draws.js` |

Two gaps in what is on `main` matter to section 4: star cards are read (`rulebook.js`'s `cardOf`) but no card changes anything in the sim, and a skin picked in the Collection reaches the sim's view (`e.appearance`) but `figures.js` never reads it, so the drawn body does not change.

## 2. The three game techniques, tested

On 2026-10-13 these were reported to him as "not confirmed, so not copied", after a pass through the decompiled image (the existing Ghidra project; the pseudocode is under `D:\bf2-ghidra\render62\out\`; REA itself timed out twice on the 230 MB image and gave nothing). He asked for them to be tested. They were, against the game's exported records (`C:\Users\tilak\Downloads\BF2_Extract\web\data\`) and the settings captured from the running game at each preset (`bf2-re\data\live-settings\`). One answer reverses what he was told.

| claim | what the records and the code say | verdict |
| --- | --- | --- |
| a distant shadow cache on Hoth | `Levels\MP\Hoth_01\Cloudy_VFX.json` (object 11) and `Sunset_VFX.json` (object 13) each place one `DistantShadowCacheVolumeEntityData`: `Mode ShadowCacheMode_Baked`, `Resolution 4096`, `TilesPerSide 8`, a box of 650.6 × 202.4 × 1,111.5 at (184.6, 385.0, −1,342.5), and a shipped depth texture (D16, 4,096², in the export at 2,048 under `textures\levels\mp\hoth_01\distantshadowcachetexture\`). Every multiplayer level places baked volumes; no other mode occurs. In code (`FUN_140eae820`) a baked volume binds its texture and skips the runtime bake. | **It is there, and it is a baked picture, not a runtime cache.** The earlier note (`bf2-re\findings\16`: "not in the exported Hoth_01 files") was a guess, and wrong. |
| the sun's cascades reach 100 m | Hoth's visual environments (`Levels\Lighting\Hoth\Sunny_01\VE_Sky_Arctic_Sunny_01.json` object 18, `Sunset_01\VE_PV_Hoth_Sunset_01.json` object 20) set `SunShadowmapViewDistance` 30 / 30 / 30 / 70 (Low to Ultra), and the code (`FUN_146dea7d0`) takes the environment's value whenever it is not negative. Five slices at Ultra, weight 0.8 and extrusion 400 stay global. | **70 m at Ultra on Hoth**, times one view scale nobody has read (its constructor default is 1.0). |
| characters skinned in compute | `MeshComputeEnabled` is False at every captured preset, all DX11, and the code makes the mesh-compute manager only when it is true (`FUN_140e80b00`). The shaders are in the database (`BatchedComputeSkinning`), which the earlier note read as "is". | **Exists, off in the shipped DX11 configuration.** Not settled for DX12, which nobody captured. |
| soldiers stop animating when culled or far | The player's and the heroes' third-person animatable is authored `JointOutputModeEnum_NoOutputUpdateCulled`; an AI soldier's is authored with culling disabled (`Gameplay\Characters\StormTrooperAI.json`). The pixel-size auto-cull is off (`AutoCullPixelSize 0`). What "update culled" skips is in no record and no saved pseudocode. What the records do hold is a ladder by distance: the trooper's animation layers switch off between 15 and 57.5 m (`ant\layers\3P.Soldier.Layer.json`: IK 15 to 17.25, fire 20 to 23, additive 25 to 28.75, hit 30 to 34.5, aim, gun-up, ability and jump-land 50 to 57.5; locomotion and the weapon pose never). | **Reduced by distance, yes. Stopped when culled, not confirmed.** |

The numbers that go with them, all from records: the character LOD group's distances are 6 / 12 / 19 / 24 / 30 / 52 m (`LodGroups\LodGroupCharacters.json`) times `Mesh.GlobalLodScale` 0.425 / 0.75 / 1.2 / 1.75, so at Ultra a soldier is on its last mesh LOD from 91 m; a character casts no shadow past 80 m (times `Mesh.ShadowDistanceScale` 0.425 / 0.65 / 1 / 1) and its equipment none past 15 m. Two readings rest on a field's meaning that no code confirms yet, and are marked wherever this design uses them: that the scale multiplies the LOD table, and that `ShadowDistance` is the field the shadow view tests. Whether a soldier at 100 to 400 m is drawn at all cannot be derived: the screen-area cull's formula and the direction of its 2.2 scale are in no record, and the two earlier notes disagree.

Against each, the site today: redraws two of four cascades every frame and two every fourth out to the level record's far, and does not read the baked far-shadow picture (the gpu-first design's own audit lists "the export's 2,048² distant shadow caches unused"); keeps a soldier on the game's LOD4 out to 400 m at ultra (`src/lib/budgets.js:47`), four times the game's distance; lets every soldier and its gun cast a shadow at any distance; and runs every animation layer on every soldier at any distance.

## 3. Part A: the site on the GPU

### The principle

The game spends its frame on the chip because nothing in it costs a function call an object: instances are rows in a buffer, culling is a job or a shader, a character's pose is a block of matrices. three's node renderer can draw that way; its per-object path cannot (three's issue #30560). So "GPU-first" here is one rule, applied world by world: **what is many is a row, not an object.** Levels are rows (done on Hoth), far figures become rows, lights already are a texture, particles become a buffer; and what must stay an object is walked once a frame, never once a pass.

### Where the same four costs recur

From a read-only audit of 2026-10-13, paths as the auditor gave them; what this session checked itself is marked ✓.

- **The world matrices walked once a pass.** `matrixWorldAutoUpdate` is set in two places on the site ✓ (`battlefront/module.js`, `galaxy/surface/level/levelGpu.js`). On the node renderer every shadow map and every `pass()` is a full `render()` that walks the graph (`three/src/renderers/common/Renderer.js:1755` ✓). The seventeen surfaces and the ten Rick and Morty planets draw the scene and a 2,048 sun shadow: two walks a frame over 10 to 32 soldiers on the whole rig, plus crew (`galaxy/surface/scene.js:266`, `:306`). C-137 and the Citadel draw their scene twice for the ink pass (`rickmorty/portal/toon.js:97`).
- **Figures on the whole rig, unculled.** `pruneSkin` is called from Battlefront alone ✓. Every other 2017 figure comes through `universe/footFigures.js:178`, which also sets each part `frustumCulled = false` (`:211`): every part of every figure goes into the view and the shadow, on screen or not.
- **Levels as objects.** A surface's level is one `InstancedMesh` a mesh, LOD and side (`galaxy/surface/level/index.js:334`): 183 to 301 draws on Hoth's surface. It takes the GPU scene as it is (`gpuScene: true`, a renderer, `level.beforeRender(camera)`), short of the coarse horizon cells.
- **Shaders built in play.** The pipeline guard holds on WebGPU; Battlefront alone compiles behind a veil; Minecraft has no warm-up call; the node renderer on WebGL 2 has no guard (82 program links in a walk and a 1.5 s frame: `evidence/galaxy-engine/T/flip/README.md:32`).

Eight worlds are on the shared runtime, four of them on the node renderer (the surfaces, Battlefront, Earth, Minecraft). The rest keep their own classic renderer and loop and measured 2 to 16 ms a frame on an M3 (`docs/research/2026-10-07-frame-hitches.md`). Porting those is not in this design: that is not where the lag is.

### The lanes, in order

Each lands on Hoth first, with its number taken as section 5 says, and goes to the next world only after. "Gain" says whether it is measured or a guess.

| lane | what changes | files | gain |
| --- | --- | --- | --- |
| **A1. The far shadow as the game has it** | The sun's cascades end where Hoth's own record says (70 m at ultra, 30 under it). Past them the shadow is read from the level's baked far-shadow picture, through the input lane N3 already built (`light/apply.js`'s `farCache`, `sun.js`'s `farShadow`). The two far cascades and their redraws go. A character casts no shadow past 80 m and its gun none past 15 m, times the level's scale. | `scripts/lib/bf2017-level.mjs` (a `distantShadow` row: the texture, the volume's box), `src/data/bf2017/maps/hoth.lighting.json`, `lib/three/light/sun.js`, `battlefront/module.js`, `figures/figures.js`, `figures/held.js` | The cascades are about 1 ms of JavaScript a frame today (measured); how much goes is a guess until built. The likeness is the larger gain: this is the game's own far shadow, in the game's own pixels. |
| **A2. One loader's rules for every figure** | `dress` and `cullBy` move out of Battlefront into the shared loader, so every 2017 figure anywhere has its skins cut, its cloth re-weighted and one sphere to cull by. The site's own cast on the Meshy rig gets the sphere. | `lib/three/walrus.js`, `skinPrune.js`, `universe/footFigures.js`, `battlefront/figures/figures.js` | Measured on Hoth (17 soldiers 3.1 to 1.3 ms); seen in code elsewhere. |
| **A3. A soldier's distance as the game's table has it** | The figure's cut follows the character LOD group: the light cut to the group's last distance times the level's scale (91 m at ultra, 62 at high), the far cut past it, in place of `budgets.js`'s 400 m. The animation layers follow the game's ladder: no additive layer past 28.75 m, no aim or ability layer past 57.5 m. It rests on the two unconfirmed readings of section 2 and does not land until the scale's use in `FUN_146ff0240` is read. | `lib/three/walrusCuts.js`, `lib/net/progressive.js`, `figures/figures.js`, `figures/locomotion.js`, a new `src/data/bf2017/lod.json` made from the export's `LodGroups` | A guess: the far cut has a third of the triangles and a quarter of the texture memory, in the same draws. |
| **A4. Far soldiers as rows** | Past the last LOD's distance a soldier is not a figure: one instanced draw a body part a kind, its pose read from a bone texture that a compute pass fills from the clips' samples (the GPU session's second target, never started). Near soldiers stay figures, with ragdolls, cloth and sockets as now. | new `lib/three/figureRows/` (the pose pass, the instanced skin node), `figures/figures.js` (the hand-over at the band's edge) | A guess. On Hoth 16 of 17 soldiers stand past 230 m, so it is nearly all of the soldiers' 1.3 ms and 100 draws. The largest piece of work in Part A. |
| **A5. World matrices once a frame, as the library's rule** | Whatever uses `applyGameLight` or a node shadow turns the flag off and walks once; the surfaces and the ink pass's second render do the same. | `lib/three/light/apply.js`, `galaxy/surface/scene.js`, `rickmorty/portal/toon.js` | Measured on Hoth (2.4 to 3.5 ms to 0.7 to 1.0). |
| **A6. The surfaces' level on the GPU scene** | The call the audit names, and the coarse horizon cells drawn on that path. | `galaxy/surface/level/index.js`, `levelGpu.js`, `galaxy/surface/scene.js`, `galaxy/spaceLevel.js` | Measured on Battlefront's Hoth (walk p50 15 to 19 ms to 6.5 to 7.5). |
| **A7. Fewer groups in the GPU scene** | Game materials key themselves into batches and their maps into texture arrays, so Hoth's 69 groups fall toward the gate of 40 that lane N1 left open, and the bundle's 1.6 to 1.9 ms with them. | `lib/three/surface/gameMaterial.js`, `level/levelGltf.js`, `gpuScene/draws.js` | The draw count is measured; the frame gain is a guess. |
| **A8. Ready means built** | A node world is not "on" until its compile and the guard's queue are empty, and what arrives later (a body's cut, a gun, a cell) is built before it is shown, not in the frame that first draws it. The cull pass's compute node is built before the first frame (254 ms inside the first frame today, the UI lane's profile). A guard for the node renderer on WebGL 2. | `runtime/runtime.js`, `runtime/webgpu.js`, `lib/three/pipelineGuard.js`, `gpuScene/cullPass.js`, `minecraft/module.js` | Measured: frames of 85 to 155 ms for ten seconds after a deploy; the veil's 8 to 20 s. The UI lane owns the veil's screens; this lane owns what the runtime waits for. |
| **A9. Off the main thread** | Rapier in the worker lane N5 built and left off, first where a level's collision is stepped every frame; particles, bolts and kit effects on the compute emitters N5 built, which no world imports. | `lib/physics/world.js`, `galaxy/surface/level/index.js`, `battlefront/fx/*`, `lib/three/particles/*` | Measured in the cloud only (physics on the main thread 1.4 to 0.1 ms p50; the CPU particle path 1.5 ms for 16,000 slots). |
| **A10. The tier table** | Lane N6, never started: one table says which of these paths a device takes (no WebGPU, a built-in chip, a laptop chip, the 5090), so no world decides for itself as `battlefront/module.js` does today. The unfinished no-GPU path (`claude/bf-perf-tiers`) is finished under it. | new `runtime/tiers.js`, `level/levelScene.js`, `light/post.js` | His own ask: "super ultra quality" on the 5090, playable on a Mac's chip and on the 740M laptop. Nothing measured on either yet. |

### The frame the 5090 should hold (a proposal, for him to set)

The game aims its dynamic resolution at 16.6 ms a frame and never goes under nine tenths of the set scale (`FUN_141506f00`, `FUN_147c2c580`, read in code). His screen is 5,120 × 1,440 at 240 Hz. Proposed: at 2,560 × 1,440 a walking frame of 6.9 ms p50 and 10 ms p95 (144 a second) with every pass on; at 5,120 × 1,440 the same 6.9 ms, which the chip's 9.4 to 10.4 ms does not allow at full scale, so the site's GPU-time controller (lane N2) holds it by internal scale, to a floor of 0.77 with TAAU. He left the choice to the design ("whatever is more performant and quality"): the controller holds the 6.9 ms, at full scale whenever the chip allows it and scaled inside only while it does not, never under 0.77.

## 4. Part B: the site's own cast as Battlefront units

### What exists

**The guests' models** (all git-tracked on this disk, glTF-Transform output, one skin of Meshy's 24 joints: `Hips, Spine, Spine01, Spine02, neck, Head, head_end, headfront`, and both sides' `Shoulder, Arm, ForeArm, Hand, UpLeg, Leg, Foot, ToeBase`; no fingers, no sockets, centimetres under a root scaled 0.01):

| who | file | rest height | legs (thigh + shin) | other bodies on the same rig |
| --- | --- | --- | --- | --- |
| Rick | `public/games/meshy/rick.glb` (1.02 MB) | 1.67 m, hips at 0.93 | 0.369 + 0.363 | tinyrick, cowboyrick, cop, detectiverick, sweaterrick, suitrick, factoryrick, constructionrick, councilrick-a/b/c |
| Morty | `public/games/meshy/morty.glb` (0.91 MB) | 1.47 m, hips at 0.75 | 0.301 + 0.276 | evilmorty, copmorty |
| Walt | `public/models/cockpit/walt.glb` (0.87 MB) | 1.74 m | not read | `albuquerque/walt.glb` |
| Jesse | `public/models/cockpit/jesse.glb` (0.93 MB) | 1.68 m | not read | `albuquerque/jesse.glb`, `jesse-lab.glb` |

Made by Meshy from the site's own concept pictures, with Meshy's own rig (`scripts/meshy-tasks.json`). Also on that rig and playable elsewhere on the site: Mark (`public/models/invincible/mark.glb`), Aragorn (`public/models/middleearth/cast/aragorn.glb`).

**The game's rig** (`public/models/galaxy/bf2017/walrus.glb`, 254 nodes, metres): 1.77 m tall, hips at 0.936, thigh 0.432, shin 0.412, upper arm 0.273, forearm 0.260, arms 37 degrees under level and angled forward. A body must carry 23 named bones and 5 sockets (`walrusRig.js`: `BODY`, `SOCKETS`) and no `Spine02`, or `loadWalrusBody` throws and the entity is never drawn. A clip binds by bone name; a packed clip is about 73 rotation channels and 8 to 10 position channels, the positions on `Hips`, `Spine`, `Spine1`, `Wep_Root`, `Wep2_Root`, `Wep_Aim`, the two `IK_Joint_*Hand` and the two `*HandAttach`, in that 1.77 m man's own metres.

**So the two do not meet as they are.** Rick's and Morty's files fail the rig check outright. And a body given the game's bone names but Morty's legs would have its hips pinned at the clips' 0.90 to 0.94 m (his stand at 0.75) and its gun held at a tall man's reach, because those are position tracks. Nothing in `walrus.js`, `walrusRig.js`, `walrusClips.js` or `battlefront/figures` scales a body's bones, its root height or its clips; the only size the loader knows is one uniform scale on the file's root (the Wookiee, 1.229).

**What the game itself does** for a body that is not a 1.77 m man: the Wookiee is the same rig scaled whole; the Ewok has a skeleton of its own with the same bone names and clips of its own (`crew/ewok.lod1.glb`, `Ewok_01_Ske`, `clips-ewok`); Yoda and Grievous likewise (not imported).

**Tools already here:** `scripts/rig-transfer.mjs` skins a mesh to a donor's skeleton by nearest-surface weight transfer (used for old Ben and C-3PO, donors on the Meshy rig so far); `scripts/bf2017-import.mjs --bind` skins a rigid game model to a game skeleton; `clipLibrary.js`'s `retarget` scales a hips track. `SkeletonUtils.retarget` is called nowhere. The exporter in `BF2_Extract\tool\` (built on Frosty Editor's libraries) already writes every body with its skeleton at rest and every clip as glTF, so Frosty Editor itself has nothing more to give the site; nobody has started on putting a custom mesh into the game.

**The rules a unit is under** (the game design of 2026-10-10 and `src/data/bf2017/NOTES.md`): every number names its game record or carries `"source": "hand"` and a line in `NOTES.md` (`rulebook.test.js:62`); the rulebook files are rewritten whole from the export, so a hand-made unit cannot live in them; a team's heroes must be rulebook rows and a row's name must be in the strings; everything is unlocked and star cards sit at top rank. And three rulings written about the game's own figures on 2026-10-10: no UAL or Meshy clip ever reaches one, the 2017 rig is kept whole with no bone pruned or renamed, nothing is retargeted. No ruling exists about a non-game character in this world.

**What a unit is in the page today:** a deployed hero is its side's first class with the hero's health (`sim.js:350`); its own weapon, its abilities' effects and any star card's effect have no code on `main` (the stopped branch `claude/bf-heroes-deploy` holds a hero kit: `heroKit.js`, `heroAbilities.js` with push, pull, choke, rush, throw and more). One body size serves every unit (`soldier.js`: 1.7 m standing, the chest at 1.4). The HUD's ability icons are keyed by the four classes. The Collection's stage draws only bodies on the game's rig.

### Three ways to put a guest on the field

| | **1. The game's rig, fitted to the guest** | 2. The guest keeps its rig; the game's clips are baked onto it | 3. Through Frosty, into the game |
| --- | --- | --- | --- |
| the body | Its mesh is skinned anew to a skeleton with all 254 of the game's bone names and rest turns, each bone as long as the guest's own limb | Unchanged | Rigged in Blender to the game's skeleton, imported as a mod |
| the clips | The game's, by name. Rotation channels as they are; the ten position channels refit to the guest's size, once, offline | Baked per guest onto 24 joints: every clip resampled through a role map | The game's |
| what works without new code | The rig check, sockets, the gun in the hand, stance packs, the additive layer, ragdolls, the cut swap, the Collection's stage | Nothing that reads a bone name: each of those needs a second path | Nothing on the site: the result is a mod for the retail game |
| what it costs | Two scripts and their tests; one body size per unit in the sim | A second figure path through `figures.js`, `held.js`, `ragdolls.js`, the stage | A different project |
| against the rulings | The game's rig whole and unrenamed; no Meshy clip on it; the position refit is a retarget of ten channels, for guests only (question 5) | Clips retargeted wholesale | Not applicable |

**Recommended: the first.** It is the game's own answer for the Ewok (the same names, its own lengths, its own clips) with the clips derived from the game's instead of authored, and it is the only one under which a guest is, to every system in the page, a hero like any other. The third is what "open in Frosty" would mean; it is left out unless he wants Rick in the retail game too (question 7).

### The design

**B1. `scripts/guest-rig.mjs`: a guest's body on the game's rig.** In: a guest's GLB on Meshy's rig, `walrus.glb`, and a row in a new `scripts/guests.json` (the joint map where it is not the default, the stated height, the grip's offset in the hand). Out: `crew/<id>.lod1.glb` and `crew/<id>.glb` in the game crew's folder, on a 254-node skeleton that passes `checkWalrus`. Steps, each a pure function with its test:

1. *The fitted skeleton.* The game's nodes, names and rest rotations; each of the 23 body bones' rest offsets scaled along its own direction to the guest's measured segment (thigh, shin, foot, the three spine links, neck, head, clavicle, upper arm, forearm, hand). Fingers, face and weapon bones keep the game's offsets scaled by the hand's and the head's ratios. Every other node stays where the game has it.
2. *The mesh at the new rest.* The guest's vertices posed, through its own Meshy skin, into the fitted skeleton's rest (arms from 46 or 67 degrees down to the game's 37, angled forward), and those positions kept as the new bind.
3. *The weights.* Each Meshy joint's weight moves to its counterpart: the three spine joints, in the order the file's own hierarchy climbs the back (not by their names), to `Spine`, `Spine1` and `Spine2`, `neck` to `Neck`, the limbs one for one. Hands stay on the hand bone: no finger is weighted. The skin then goes through `pruneSkin` like any other part.
4. *The sockets.* `Wep_Root`, `Wep_Muzzle`, `Wep_Aim` and the two IK joints at the game's rest; where they sit in play is the clips' to say.

Deterministic, with no service called (the rigging lane's rules: no paid service, byte-identical bakes). Its other bodies (Tiny Rick, Evil Morty and the rest) go through the same script and become the unit's skins.

**B2. `scripts/guest-clips.mjs`: the game's clips, at the guest's size.** In: the game's packs a blaster hero plays (`clips-humanoid`, the pistol stance pack, a host hero's own pack for its dodges, deaths and emotes) and the guest's fitted skeleton. Out: `clips-guest-<id>.glb`, the same clip names. Rotation channels are copied bit for bit. The position channels are refit: `Hips` by the ratio of leg lengths (so the feet meet the ground the clip meant), `Spine` and `Spine1` by the torso's, and each weapon and hand socket re-expressed from the game man's hand into the guest's hand, so a gun stays in the grip it was animated in. The clips' recorded root travel and stride contacts (`extras.root`, `rootHips`, the strokes' `contact`) scale with the legs. `walrus.js`'s `packUrls` learns one new case: a body whose row says its pack is whole loads that pack alone.

**B3. The guests' rules, in files of their own.** `src/data/guests/` holds `units.json` (rows shaped as `heroes.json`'s: health, regen, side, weapon, three abilities, body size, price, the host hero whose clip set it was fitted from), `abilities.json`, `cards.json`, `strings.json` and `collection.json` (rows shaped as the Collection's: skins with their `body`, three abilities, nine cards, emotes). Every number in them is `"source": "hand"` with its line in `src/data/guests/NOTES.md`, and where a number is copied from a game row (a pistol's damage from the DL-44's, a card's percent from a hero's card) it names that row instead. `rulebook.js` and `lib/bf2017/collection.js` each read the guests' files after the game's and present one roster; the generated files are never edited by hand, and the generators never see a guest. `rulebook.test.js`'s rules run over the merged view, plus one new rule: a guest row never shadows a game id.

**B4. A unit's own size, weapon and abilities in the sim.** Three things no hero has yet, so they are built for heroes and guests at once, on the stopped hero branch's kit rather than beside it: (a) the body size a unit row states (standing and crouched height, the chest's height, the camera's) in place of `soldier.js`'s one size; (b) the unit's own weapon row and held mesh; (c) the three abilities' effects, each one of the hero kit's kinds with the guest's numbers. One kind is new: a blink (a move to the aimed point, held to the level's ground and collision, for the portal gun). This lane is the sim lane's ground (`sim.js`, `kit.js`, `soldier.js`); section 7 says how it is shared.

**B5. Star cards that do something.** Today a card is text: `cardOf` has no caller. A picked card becomes one or more modifiers on the stack `affectors.js` already has (a recharge's rate, a health's cap, an ability's length), applied at the deploy from the three slots the Collection stores (`bf-collection`), at top rank as the game design rules. Built for the game's heroes and classes first (their numbers are in `collection.json` and `cards.json`), then a guest's nine cards are rows of the same shape.

**B6. Where a guest shows.** On the deploy list as a hero offer at its price; in the HUD with its own three ability icons (a per-unit lookup the heroes also lack); in the Collection with a portrait, its skins, its cards and its abilities, standing on the stage (which already draws anything on the game's rig); and in the picked skin actually worn, which needs the hop `figures.js` is missing for every unit today (`kindOf` reads the view's `appearance`). Portraits and ability icons are rendered from the guest's own model and gear by a script, in the game icons' frame. The screens themselves are the UI lane's; this design supplies rows, pictures and the lookup.

### A first roster (a proposal; every line is his to change)

| unit | side | wears | weapon | abilities (kind) |
| --- | --- | --- | --- | --- |
| Rick | light | Han's clip set | a laser pistol (the DL-44's row) | Portal (blink); Freeze Ray (a stun, the flash kind); Meeseeks Box (an ally for a while, the turret kind) |
| Morty | light | Lando's clip set | a blaster pistol | Panic (a sprint that takes less damage, the rage kind); Mega Seeds (a team buff, the command kind); Plumbus (a thrown stun, the grenade kind) |
| Evil Morty | dark | Morty's body rows, his own skin and cards | the same | after question 6 |
| Walt, Jesse | dark, light | Bossk's and Han's clip sets | after question 6 | after question 6 |

### What "done" is for a guest

1. The body passes `checkWalrus` with all 254 names, and its skin after `pruneSkin` uses fewer than 60 joints.
2. In three poses (rest, a crouch, an aim) no vertex is more than 5 mm from where the Meshy rig puts it in the matching pose.
3. Through `walk.fwd`, `run` and `sprint` the planted foot stays within 2 cm of the ground and slides no more than the game's trooper does on the same clips (`figures/stride.js` measures both).
4. Through `aim` and `fire` the gun's grip stays within 1 cm of the hand's grip point.
5. Deployed on Hoth beside a trooper, it costs the frame no more than the trooper does (section 5's switch test).
6. A picture of the guest standing, walking and aiming, beside the game hero whose clips it wears, in the evidence folder.

## 5. How quality and speed are tested

**Speed.** Two instruments, both in `.scratch-check/` on `claude/bf-frame-once` today, and moved into `scripts/` (with a Battlefront journey for `perf-probe.mjs`, which has none) as lane A1's first commit: the walk with no profiler on the page (`perf-walk.mjs`: live against a built branch, interleaved, twice), which is what a visitor gets; and the switch test (one page, the change turned on and off every four seconds for five rounds), which is the only comparison that held under load. A lane's gain is quoted from the switch test and its frame from the walk. Three lessons of this week are rules here: the dev server is started with `--mode bucketcheck` and a probe checks the level has triangles (the first "three times faster" table compared a level with an empty scene); the CPU profiler is never on during a timed walk (it costs one 0.8 s frame at its start, which was once reported as the page's hitch); and the game is closed, or its presence is written beside the number.

**The picture.** The game's reference is a picture of its window taken from outside (`user32!PrintWindow`, nothing sent to the game, nothing read from it), at three marked places on Hoth's Galactic Assault, in both skies, with the game at Ultra and its window at 2,560 × 1,440. He stands the soldier there; no session starts a match or changes a setting. The site's shot is taken from the same place and heading (the level's coordinates are the export's), and the pair is scored with `scripts/frame-score.mjs` (FLIP, PSNR, SSIM). The pictures show his account name and stay off the repository; the scores and the places are committed. Until those six pictures exist, no lane claims a likeness to the game, only a sameness to the site's own picture before it.

**The machines.** The 5090 at both widths; a Mac with a Pro chip and the 740M laptop when lane A10 is reached, each by the same two instruments.

## 6. Not in this design

- The Frostbite source he is downloading: not read, not planned on.
- The running game's memory: not read, not dumped. Its window is photographed; its exported records and the existing analysed image are read.
- Guests in the retail game through Frosty (question 7).
- Porting the classic-renderer worlds to the node renderer.
- The troops, vehicles and landing lanes, which other sessions hold.
- Any world but Hoth, until Hoth's number for a lane is in.

## 7. Who touches what, and the order

`battlefront/module.js` is edited by this session (#962), the sim lane (#966) and two stopped branches; `figures/figures.js` by this session and the stopped troops branch; the spawn screen and the Collection's screens by the UI lane; `sim.js`, `kit.js` and `soldier.js` by the sim lane and the stopped hero branch. So:

1. #962 is merged (2026-10-13 05:44 UTC, on his word: "merget o main").
2. Part A's lanes A1, A2, A5 and A8 are this session's, one PR each, in that order; A3 waits on one function being read; A4 is its own plan after A1 to A3 show what is left of the soldiers; A6, A7, A9 and A10 are planned when Hoth's numbers for the first four are in.
3. Part B's B1 and B2 touch no file another lane holds (two new scripts, new files under `crew/`, one case in `walrus.js`) and can start as soon as he has answered questions 1 and 5.
4. B4 and B5 are this session's: the sim lane was offered them and passed them back (`tilak-a6`, 2026-10-13: "take B4 and B5 yourself; I am not holding them"). They start after #966 is on `main`, and meet three things it brings: a round's bot thinks in `soldierBrain.js`'s `thinkAutoPlayer`, so a hero bot's rules for a round go there and not in the BattleAI modes; `module.js`'s `sim`, `me`, `team`, `director`, `park` and `castArm` are rebindable, because a round is swapped in place; and a round's size comes from `instantAction.js`'s `SIDE_BY_DETAIL` (5, 8, 13 and 24 a side from low to ultra, by hand). B6's rows and pictures are handed to the UI lane for its phase 2b.
5. The picked skin being worn is the UI lane's (`tilak-b4`, 2026-10-13: "it is the Collection lane's promise"). It takes `figures.js`'s `BODIES` table and `kindOf` and nothing else there: 43 crew kinds among the Collection's 213 skins, 29 of them not yet in `BODIES`. Lane A2 leaves those two alone and builds on the view's `appearance` being honoured, so a guest's body, and each of its skins, needs only its `BODIES` row.
6. The stopped hero branch (`claude/bf-heroes-deploy`, with uncommitted files in its worktree) is merged forward by whoever takes B4, not rewritten.

Two things the sim lane found that bear on this design and that nobody holds yet. A round at ultra is 24 soldiers a side, 48 where tonight's numbers had 17 to 20, so the soldiers' share of the frame is nearer three times what section 1 measured, and lane A4 matters that much more; the table of sizes is the one place to change if a tier cannot hold its count. And on the level's real ground a round's bots seldom have a line of fire (about one in three of those within 60 m of an enemy), where on flat ground in the sim they fire about 850 shots a minute: the page's `lineClear` over its navgrid says no, and whether the grid's heights or its mask block it has not been looked into. That is a fault in the battle, not in the frame, and it is listed here so it is not lost.

Three implementation plans come out of this, not one, each written and reviewed on its own: Part A's first four lanes; the guest's rig and clips (B1, B2); the units' rules, kit, cards and screens (B3 to B6).

## 8. Questions for him

1. **Who are the main characters?** Proposed: Rick and Morty first, then Walt and Jesse, then Mark and Aragorn by the same two scripts.
2. **The wide screen's frame:** 144 a second with the picture scaled inside (to no less than 0.77), or full scale at about 100?
3. **Sides and the roster above:** as proposed, or his own?
4. **Their look on Hoth:** their own flat colours under the game's light, or with the ink outline they wear in their own worlds (a second draw a guest)? Proposed: without it first, and he decides from the pictures.
5. **The ruling:** a guest's clips are the game's, with ten position channels refit to its body. Is that inside "nothing is retargeted", for guests only?
6. **Abilities and cards:** does he want to write them, or approve a full table written from the proposal?
7. **Frosty:** the site does not need it. Does he also want a guest in the retail game as a mod? Proposed: no.
8. **#962:** merge it?

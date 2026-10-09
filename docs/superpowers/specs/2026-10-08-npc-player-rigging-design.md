# NPC and player rigging: hands and fingers, a crouch, and a figure’s own proportions. The design

Date: 2026-10-08. Status: design, written from the owner’s brief by an architecting session, for an Opus 5.5 implementation session (phases in order, one branch each). The plan is `docs/superpowers/plans/2026-10-08-npc-player-rigging.md`; the hand-off is `docs/superpowers/HANDOFF-npc-player-rigging.md`; the decision is `docs/decisions/2026-10-08-fingers-on-the-meshy-skeleton.md`.

## What the owner asked

“Architect a way to make the rigging of our NPC and player models better and improve it. A lot of assets are in tilakverse-assets and other GitHub repos due to their size. It is paramount that you check the hands, fingers, animations like crouching and differences in art style for the models.”

Four things, then: the hands (how a figure holds and gestures), the fingers (which no figure on the site has bones for), the crouch (which the player cannot do in any world but the Death Star’s interior), and the art styles (clips made on one realistic man play on toy, cartoon and game-rip bodies). The assets that help live in `tilakpatell/tilakverse-assets` (the two Universal Animation Libraries, whose mannequins have fingers) and the site’s own `assets-quaternius` release.

## Where the site is today

Read from the code in this session (`main` at 4e03ea67b) and from the model files themselves (a gltf-transform pass over the GLBs, kept as `scripts/rig-audit.mjs` by Phase 0).

**One skeleton, no fingers.** About 270 figure files stand on Meshy’s 24-bone humanoid (`src/lib/three/meshyRig.fixture.js`): the galaxy’s 46 crew and 10 troopers, Middle-earth’s 29 toy cast, the office’s 17, Albuquerque’s 14, Rick and Morty’s hundred-odd and their 35 crowd variants, Invincible’s cast, the cockpits’ three, C-3PO and old Ben. The skeleton ends at `LeftHand` and `RightHand`: no finger, thumb, twist, jaw or eye bones. `grip.js` says it plainly: “a hand is one bone, its fingers sculpted straight out in the pose it was made in … Meshy’s rigging can’t add finger bones.” The only finger motion on the site is `grip.js`’s morph target, which bends the hand’s vertices round a gun’s grip, four fingers as one, the thumb left as sculpted. Everywhere else the hands are open mittens: in a wave, a punch, a talk, a sat drink, a saber held at guard.

**The library has fingers; the bake drops them.** The 254 clips in `clipLibrary.js` are 118 Quaternius UAL clips baked onto the Meshy skeleton (`scripts/ual-bake.mjs`), 113 Meshy `act-*` clips made on Luke’s rig, 13 Meshy shared clips, Rick’s four and the troopers’ six. UAL’s mannequins have full hands: the free Godot pack is a 53-bone Rigify rig (`DEF-thumb01L`, `DEF-f_index01L` … three joints a finger), and the source packs in the assets repo (UAL1, UAL2, the female mannequin) are Unreal mannequins (`thumb_01_l`, `index_01_l` …). `UAL_MAP` maps 22 bones and skips every finger, because the target had none. Meshy’s own `act-*` clips carry no finger tracks at all.

**The other skeletons.** Six figures are not on Meshy’s bones, and each has fingers of its own: the Ithorian (Mixamo, 47 joints, `mixamorig:LeftHandIndex1` …; the galaxy asset-upgrade lane baked a core clip set into it by role), Thor (34 joints, an index chain only), the Hulk (279 joints, an Unreal rig with fingers, twists and a face), Spider-Man (176, the same kind), Mario (a Rigify rig, 63 joints, `f_index01L`), and Cybertron’s High Moon rigs (`L_Finger02_Index01_XL2`, two joints a finger). `rig.js` poses them by role but none can play the library, and none moves its fingers.

**The crouch.** The clips are there: `crouch` (idle), `crouch.walk` (forward), `crouch.fwd.left`, `crouch.fwd.right` from UAL, `crouch.back`, `crouch.left`, `crouch.right` from Meshy’s library. What uses them: the galaxy’s hostiles crouch in cover as a base state (`hostiles.js`, `lib/ai/body.js`’s `cover: { base: 'crouch' }`), only while their feet are still, and stand to fire or move. Middle-earth’s cast can be asked to crouch (`cast3d.js`’s `want.crouch`), done as locomotion’s landing bend (`down: 0.19`), not a clip. No player controller crouches: the galaxy surface (`walker.js`’s `WALK`), the universe on foot, the Rick and Morty world, Invincible, Middle-earth and the Avengers compound have walk, run and jump and no crouch key. The one exception is the Death Star interior, whose tested `walker.js` has `crouchH`, `crouchEyes` and `crouchWalk`, and whose figure is built in code. Locomotion has a landing crouch (`locomotion.js`’s `after`, the knees bent by `land` and `down`) and the drop it costs, and nothing else.

**One man’s clips on every body.** Every clip is made on Luke (1.72 m, realistic proportions) or Rick, and `retarget()` copies each bone’s turns as they are and scales only the hips’ height. The living-characters spec named the risk and deferred it: “Clips made on Luke’s or Nimbus’s proportions can sink a foot or turn a hand on a figure 2.8 m tall or 1.1 m short.” The bodies the clips land on fall into four families, by how they were made and what their world is drawn as (`src/components/worlds/looks.js`):

| family | who | made by | the look | what a Luke clip does to it |
|---|---|---|---|---|
| real | the galaxy’s crew and troopers, the office, Albuquerque, the cockpits, C-3PO, old Ben | Meshy text-to-3D at film proportions, the troopers from Battlefront rips | `scanned` | fits; the Wookiees and the Gamorrean hold their arms like a thin man’s |
| toy | Middle-earth’s cast | Meshy in an Overcooked-like toy style (`scripts/meshy-middleearth.mjs`): big heads, short limbs | `painted` | hands pass through the head on a wave and a phone call; a crouch’s hip drop is longer than the legs; the idle is a realistic man’s sway on a toy |
| show | Rick and Morty, Invincible | Meshy from the shows’ model sheets, the ink hull (`lib/three/ink.js`) over them | `painted` with ink | thin arms reach short of a grip; cartoon timing is absent (every move is motion-captured realism) |
| game | the Avengers (Sketchfab game rips), Mario, Cybertron | other studios’ rigs | `scanned` | not on the library at all |

No measure says which clip looks wrong on which body. `scripts/anim-check.mjs` measures planted-toe drift, the bind pose and lockstep, and nothing about hands, reach or crouch.

**The forearm.** With no twist bone a hand’s roll twists the whole forearm at the elbow (“like a sweet wrapper”, `docs/research/2026-10-07-rigging-and-models.md`). It shows most on the saber’s guard and a pistol’s aim.

**What makes new figures.** Meshy’s rig step (5 credits, no fingers), `scripts/rig-transfer.mjs` (a donor’s weights onto a new mesh of the same build, free), gen3d on the owner’s desktop (unrigged output). The two lanes already running (`galaxy-asset-upgrade`, `living-characters`) keep every new humanoid on the Meshy skeleton, which is the right call: one skeleton means one library.

## The problems, most visible first

1. **Mitten hands.** Every gesture, grip and reaction plays with the fingers straight. The grip morph closes them round a gun only.
2. **No crouch for the player; a crouch that cannot move for anyone.** The clips exist for eight directions and nothing blends them.
3. **One proportion.** Toy and show bodies play a film-proportioned man’s motion, with the hands through the head and no exaggeration, and nothing measures it.
4. **The forearm twists at the elbow.**
5. **The game-rip figures stand outside the library** and move their fingers no more than the rest.
6. **Nothing checks hands, reach or crouch**, so a regression would not be seen.

## The pieces

### 1. `scripts/rig-audit.mjs`: every figure file, what it stands on, as a kept script

Pure and tested: `readRig(doc) → { joints, family, fingers, twists, clips, tris, textures, height, profile }` over a gltf-transform document, `family` one of `meshy24 | meshy54 | mixamo | unreal | rigify | highmoon | prime | none` by bone names (`prime`: the Transformers: Prime game’s rig, `Humerus.l`, `Index1_Finger.l`, which Phase 0 found on four Cybertron figures), `profile` the body’s measures at rest in metres (height, hips, leg, arm, hand, head radius, shoulder width), and `audit(files) → rows` with a Markdown `table`. The CLI walks `public/models/**` and `public/games/meshy/*.glb` (clip files counted as clips, not figures) and prints the table; `--json` for a file; `EXPECTED` (as the galaxy audit has) names what a phase moved, and the script exits 1 when a figure has slipped back. Phase 0 saves the first table as `docs/superpowers/evidence/rigging/audit-before.md`. It is the measure of every phase after.

### 2. `scripts/hands-extend.mjs`: finger bones added to a Meshy figure by its own geometry

Offline, deterministic, idempotent (a file already extended is left as it is). For each hand: the vertices skinned to the hand bone, in the bone’s space; `grip.js`’s `handShape` already finds the knuckle line (`s0`), the finger plate and the thumb’s points, from the vertices alone. Past the knuckle line the non-thumb points are split into four fingers along the knuckle axis by k-means from four evenly spaced seeds; a hand whose finger region has no gaps between those clusters (a toy mitten, the clusters’ gaps under a tenth of the hand’s width) gets one finger group instead. Each finger (or the mitten group, and the thumb when it stands out) gets a line by principal axis and joints at 0, ⅓ and ⅔ of its length (two for a mitten, two for a thumb), named as Mixamo names them without the prefix, which `rig.js`’s `plain()` already strips: `LeftHandThumb1..2`, `LeftHandIndex1..3`, `LeftHandMiddle1..3`, `LeftHandRing1..3`, `LeftHandPinky1..3`, and `LeftHandFingers1..2` for a mitten. Every new bone is given the same **canonical rest frame**: +y along the finger toward its tip, +z out of the back of the hand (the palm normal), +x = y × z across the knuckles (toward the thumb on the left hand and away from it on the right: the hands mirror, and a turn can’t flip one), so a curl is a turn about x on every figure, closing about −x on both hands, and a pose written once fits them all.

Weights: a hand vertex past the knuckle line gives its hand weight to the nearest finger’s joints, blended along the finger (joint *i* to joint *i*+1 over the middle fifth of each segment, smoothstep) and across the knuckle band (hand to joint 1 over a band a fifth of the finger’s length either side of `s0`); never more than four influences a vertex (the smallest dropped and the rest renormalised); the thumb’s base blended into the hand over a wider band, since `grip.js` found a thumb swung on its own tears from the palm. The file keeps its mesh, materials, textures and every existing bone and inverse bind matrix; it gains the nodes, their inverse bind matrices, and rewritten `JOINTS_0`/`WEIGHTS_0` on the hand’s vertices only. `extras.hands` records what was found (`{ L: { kind: 'fingers' | 'mitten', thumb: bool }, R }`), and `extras.profile` the body measures of piece 1. A figure whose hand cannot be read (no vertices past a knuckle line, a hand holding something sculpted into it) is left unextended and listed. Measured on Luke, a trooper, Aragorn, Rick and Mark first (Phase 1, the sheet), then every Meshy-24 figure (Phase 2). Each file grows by a few kilobytes (30 nodes, their matrices, the hand’s vertices re-skinned).

The body clips are untouched by this: they name no finger bone, so a finger a clip does not drive stays at rest, which is where it is today. Nothing in `animator.js`, `locomotion.js` or `clipLibrary.js` changes for a figure to load.

### 3. `src/lib/three/hands.js` and `handPoses.js`: the hand layer

`createHands(model, { bones })` finds the finger bones by role (`HAND_ROLES`: the canonical names; Mixamo’s; Unreal’s `index_01_l`; Rigify’s `f_index01L`, `thumb01L`; High Moon’s `L_Finger02_Index01_XL2`) and works out, once, each bone’s turn from its own rest frame to the canonical one (from the bone’s line to its child and the hand’s palm normal, `ik.js`’s `palmFrame`), so a pose in canonical terms lands on any rig. A **pose** is scalars, not quaternions, so it fits a three-joint finger, a two-joint one and a mitten alike: `{ thumb: [c1, c2], index: [c1, c2, c3], middle, ring, pinky, spread }`, curls in radians about the canonical +x, spread about +z at the first joint. `handPoses.js` holds the set: `open`, `relaxed` (the default at rest: a slight curl, as a hand hangs), `fist`, `grip` (round a cylinder: the gun’s and the hilt’s, the radius given), `trigger` (grip with the index straight), `point`, `thumbs`, `flat`, `spread`. A mitten takes the mean of the four fingers’ curls.

The API: `set(side, pose | { from, to, k }, { rate = 14 })` (eased, per hand), `hold(side, radius)` (a grip sized to what is held), `release(side)`, `after()` (lays the hands on after the mixer, the layers and the look), `has`, `dispose`. A figure with no finger bones gets `NO_HANDS`, every call a no-op, so a caller never checks.

Who asks for what: `gunplay.js` asks for `grip`/`trigger` on the gun hand and `grip` on the supporting hand at the foregrip, sized by the gun’s grip radius, and keeps `grip.js`’s morph as the fallback for a figure that is not extended (the morph is skipped when the hands answer); `saber.js` the same for both hands on the hilt; `rig.js`’s `POSES.punch` and `windup` carry `hands: { R: 'fist' }`; `figureCalls.js`’s reactions carry a hand (`hit` → `fist`, `wave` → `open`, `cheer` → `open`); `lib/emote.js`’s wheel names one per emote (`thumbs`, `point`, `wave` → `open`); at rest the animator’s idles blend `relaxed` with a slow seeded drift toward `open` and back, so no hand is a statue. The `upper` mask (`animator.js`’s `MESHY_MASKS`) gains the finger names, so an upper-layer clip with finger tracks (piece 4) lays its fingers too; the animator’s `posed`/`saved` lists take them in, so a finger turned after the mixer is put back before it runs, as the head and chest are.

### 4. `scripts/ual-bake.mjs` carries the fingers

`UAL_MAP` gains the thirty finger bones (Rigify’s `DEF-thumb01L` … and the Unreal names through `UE_NAMES`) onto the canonical names, `AIM` the chain within each finger, and `targetMap` by role finds them on any extended target. The retarget is the one that exists (world-space delta from rest, each target bone swung onto the source’s rest direction), which is exactly right for fingers whose rest frames differ. A bake onto a target without fingers writes what it writes today: the plan’s first test is that every shipped `ual-*.glb` re-bakes byte-identical against the unextended Luke, and the second that against the extended Luke each gains finger tracks and nothing else changes. The 118 files are then re-baked against the extended Luke (sizes roughly double: 2.5 MB to about 5 MB, still shorts), so a talk moves the hands, a sit rests them, a pistol aim holds the gun, a death lets them go. The 113 Meshy `act-*` clips have no finger source and keep their rest fingers; the hand layer’s poses cover them.

### 5. The crouch as a stance of locomotion

`locomotion.js` gains a **stance**: `m.crouch` (0…1) in the motion a figure is given, and a second set of clips beside idle, walk and run: `crouch` (still), `crouch.walk` (ahead), `crouch.fwd.left`, `crouch.fwd.right`, `crouch.left`, `crouch.right`, `crouch.back`, blended by heading as the walk’s strafe is today (the hips turned for the diagonals the set lacks), each stride measured by `strideOf` as the walk’s is, so a crouched figure’s feet are paced to the ground like a standing one’s. `drop` reads the crouch’s hips against the idle’s from the clips, clamped to 0.55 of the leg’s length so a toy’s short legs never put its hips through the floor. The crossfade between stances is the base’s (`BASE_FADE`), by `m.crouch`, so a figure can crouch on the move and stand up on the move. The landing bend and `down` stay as they are, laid over the stance. `lib/ai/body.js`’s `cover` row becomes `{ crouch: 1 }` (a stance, not a base), so a hostile in cover can shuffle sideways and the `rise` to fire is a stance change; `hostiles.js`’s `STILL`/`SETTLE` rule stays.

The player: `src/runtime/input.js` is unchanged (it binds by name); each walking world binds a `crouch` action to `KeyC` (a pad’s right-stick press, a touch button from the HUD kit) and holds it while pressed, with a settings toggle for hold-or-toggle in the world’s settings where it has them. The walker rules gain a crouch the Death Star’s already has: `walker.js`’s `WALK` gains `crouch: 1.6` (m/s), `crouchH` and `crouchEyes`, the capsule shortened while crouched, standing waits for headroom; the universe on foot, the Rick and Morty world, Invincible’s ground and Middle-earth’s towns take the same three numbers in their rules. The camera’s eye follows `crouchEyes`. Online ghosts carry `crouch` in their motion (a bit in the packet; an older client without it walks standing). The Death Star interior’s built figure plays the stance on its own rules as they are.

### 6. Figure profiles and style families: `src/lib/three/figureStyles.js`

Piece 1 writes each figure’s `profile` into its GLB’s extras; `loadFigure`, `footScene.js`’s `rigScene` and `crew.js` read it (`gltf.scene.userData.profile`, falling back to measuring the skinned box as `figure()` does today). `figureStyles.js` is data and pure functions: `FAMILIES` (`real`, `toy`, `show`, `game`) with each family’s numbers, and `familyOf(profile)` by proportion (a head radius over 0.11 of the height is `toy`; a world’s `look.js` may name its family outright, which wins). The numbers, for the retarget and the animator:

- `exaggerate` (toy 1.15, show 1.05, else 1): each bone’s turn away from rest is scaled past the pose (`slerp(rest, q, k)` with k over 1), applied in `clipLibrary.js`’s `forFigure` where the copy is already made per template.
- `snap` (toy 1.2): one-shots play that much quicker, with their last frame held the longer, so a toy’s wave is a toy’s.
- `idle` (toy 1.3, show 1.1): the idle’s amplitude about rest.
- `reach`: the **reach guard** in `animator.after`: after the layers and the look, each hand is tested against the head’s sphere and the chest’s capsule (from the profile); a hand inside is pushed out along the shortest way by `ik.js`’s `reach` on its arm, eased, so a toy’s wave and phone call clear its head. It costs two sphere tests a hand a frame and runs only on figures whose profile says their reach is short of a film body’s.
- `drop` (toy 0.45, else 0.55): the crouch’s clamp of piece 5.

`real` is the identity, so the galaxy, the office and Albuquerque play exactly as today (the plan’s test: a `real` figure’s bones after `forFigure` are those of today’s `retarget`). The family numbers live on the debug panel (`lib/debugPanel.js`, under a `figures` group) so they are tuned against the sheet, not guessed.

### 7. The game-rip figures, by role

The Avengers’ Thor, Hulk and Spider-Man, and Mario, get the `core` set baked into their own GLBs by `ual-bake --rig … --into … --set core` (the galaxy lane’s path, already working on the Ithorian’s Mixamo rig) with their finger tracks on their own finger names through `targetMap`, and `people.js`/`mario-hd.js` play them through an animator as `modelFigureOf` does; `rig.js`’s poses stay over them. Their hands answer the hand layer through `HAND_ROLES`. Cybertron’s robots keep `rig.js`’s poses (no clip fits a robot) and gain the hand layer alone, so a Decepticon makes a fist. Twist bones on the rigs that have them (the Hulk, Spider-Man) are driven by the forearm piece below.

### 8. The forearm twist, procedural

`hands-extend.mjs` adds one `LeftForeArmTwist`/`RightForeArmTwist` bone at the forearm’s midpoint, its weights blended linearly along the forearm from the elbow (none) to the wrist (all), taken from the forearm bone. At run time `hands.js`’s `after` reads the hand’s roll about the forearm’s axis and turns the twist bone by half of it, so the wrist carries the roll and the elbow does not. A rig with its own twist bones (`lowerarm_twist_01_l`) is driven the same way.

### 9. The checks

`scripts/anim-check.mjs` gains three measures, each off by default and on by a flag, reported per figure in view: `--hands` (the finger bones’ curl read from the bones; a figure the dev hook says is holding something must not be at `open`, and a figure at rest must not be at exactly rest for the whole sample), `--reach` (no hand inside its head sphere or chest capsule, from the profile), `--crouch` (with `--do 'key:KeyC'` the player’s hips drop by at least 0.25 of the leg and the planted toe’s drift stays under the limit while crouched and moving). `scripts/hands-sheet.mjs` renders, headless, each family’s representative (Luke, a stormtrooper, Aragorn, Rick, Mark, Thor) in each hand pose and with a pistol, a rifle and a saber, close on the hands, to `docs/superpowers/evidence/rigging/hands-<family>.png`; the Windows shot scripts’ convention holds (`CHROME=` Edge, a Vite server on 5188). Every phase’s PR carries its sheet and its audit table.

## Decisions (for the owner to overturn)

- **Fingers are added to the Meshy skeleton, not the skeleton replaced.** Re-rigging 270 figures (Mixamo, AccuRIG, UniRig, Tripo) is hours a figure, needs the owner’s hands or a GPU, and strands 254 clips on the old names. Adding bones by geometry is a script run once, keeps every clip valid, and keeps one skeleton on the site. The long version: `docs/decisions/2026-10-08-fingers-on-the-meshy-skeleton.md`.
- **Hand poses are scalars in a canonical frame**, never quaternions on a rig’s names, so one table serves three-joint hands, two-joint hands, mittens and the game rips.
- **The finger source is the UAL mannequins in the assets repo**, CC0, already baked for the body. No Meshy credit is spent and no new pack is bought. The `act-*` clips keep rest fingers under the hand layer’s poses.
- **The crouch is a stance of locomotion, not a base state**, so it moves in eight directions and blends with the walk; a base state stands still by construction.
- **Style is data on the figure and numbers on a family**, applied in the retarget and one post-pass, never a second clip set a family. A clip is made once.
- **`real` is the identity.** Nothing in the galaxy, the office or Albuquerque moves differently until its family’s numbers say so, and the test holds it.
- **Nothing is bought and nothing runs at run time against a service.** Every step here completes in a session with no key; the owner’s desktop is not needed except for the sheets on Windows.

## What this is not

Not a re-rig; not a new skeleton; not a face, a jaw or eyes; not the beasts (the galaxy lane’s four-legged rig is the next design there); not new figures; not a change to any world’s look, HUD or rules beyond a crouch key and three walker numbers; not a change to Cybertron’s or Mario’s game rules; not the Death Star interior’s built figure.

## Phases and dependencies

| Phase | Pieces | Depends on | Done when |
|---|---|---|---|
| 0 | 1 | nothing | `node scripts/rig-audit.mjs` prints the table, tested; `audit-before.md` saved; every figure has a `profile` |
| 1 | 2, 3, 8 on five figures | 0 | Luke, a stormtrooper, Aragorn, Rick and Mark show curled fingers in a grip, a fist, a wave and at rest on `hands-real/toy/show.png`; `gunplay` and `saber` hold through the hand layer; nothing else on the site changes (`anim-check` on five routes unchanged) |
| 2 | 2 on every Meshy-24 figure, 4 | 1 | every figure file extended or listed; `ual-*.glb` re-baked with finger tracks, body tracks byte-identical; a talk moves the hands on the sheet |
| 3 | 5 | 1 (the hand layer is not needed, but the audit and sheet are) | the player crouches and crouch-walks in eight directions on the galaxy surface, the universe on foot, the Rick and Morty world, Invincible and Middle-earth; hostiles shuffle in cover; `anim-check --crouch` passes on each |
| 4 | 6 | 2 | toy and show figures play exaggerated, snapped and reach-guarded; `real` is byte-identical in the test; the family numbers are on the debug panel |
| 5 | 7 | 2 | Thor, the Hulk, Spider-Man and Mario play the core set with fingers; Cybertron’s robots make fists |

Phases 3 and 4 can run at once on separate branches after 2; 5 after 2.

## Testing

Pure modules in Node (`vitest`): the audit’s `readRig` on `meshyRig.fixture.js` (with and without fingers, the fixture gaining a `fingers` option) and on a Mixamo fixture; `hands-extend`’s clustering on a synthetic hand (four separated fingers → four groups; a mitten → one; a thumb found and not found), its weights (sum to one, at most four influences, the hand bone keeps the palm), its idempotence (a second run changes no byte); `hands.js`’s curl on the fixture (a fist closes every joint by the table, a mitten takes the mean, a pose eases at `rate`, `NO_HANDS` does nothing); the bake’s byte identity on the body tracks; locomotion’s stance (weights sum to one with and without each crouch clip, the drop’s clamp, the stride paced crouched); `figureStyles`’s `familyOf` and the identity of `real`; the reach guard on the fixture (a hand put in the head is pushed out, one outside is untouched). Browser: `anim-check` with each new flag on the routes each phase touches; the hand sheets; `node scripts/health.mjs --check --skip build` (file sizes, layers, stack pages). The living-characters bar holds throughout: planted toe under 0.15 m/s, no bind pose, no lockstep.

## Risks

- **A hand the clustering cannot read** (a toy mitten with no thumb, a hand sculpted round a prop, a glove). The script lists it and leaves it; the morph grip still works on it. The audit says how many.
- **Skinning cost.** 54 bones against 24 is more bone-matrix work a figure a frame; the crowds are under `animBudget` and the far ones hold their pose. Measured on the Citadel and Edoras before Phase 2 ships (`renderer.info` and frame time, quoted in the PR).
- **Re-baked UAL files double in size** (about 2.5 MB more across the library, loaded a clip at a time). Acceptable; the plan measures it.
- **The exaggeration pushes a toy’s elbows through its body.** The reach guard catches hands only; the family numbers start low (1.15) and are tuned on the sheet.
- **A crouch key already taken.** `KeyC` is free on every walking world checked; the emote key took `B`/`Z`/`U`/`T`. The guide page (`src/components/guide/pages.js`) names it once.
- **Shared refs.** Other lanes edit `locomotion.js`, `animator.js` and `gunplay.js` (living-characters’ leftovers, the galaxy asset upgrade). Each phase merges `origin/main` before it opens and before it merges; a conflict in those files is resolved by keeping both, never by dropping a line.

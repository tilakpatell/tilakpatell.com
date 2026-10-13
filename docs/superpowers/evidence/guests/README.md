# The site's own cast on the 2017 game's skeleton: what was made, measured and seen

2026-10-13. For the plan `docs/superpowers/plans/2026-10-13-guest-rig-and-clips.md` (design: `specs/2026-10-13-gpu-site-and-guest-heroes-design.md`, section 4, lanes B1 and B2).

Rick, Morty, Walt and Jesse each exist as a body on Star Wars Battlefront II (2017)'s 254-node skeleton at their own proportions (`public/models/guests/<body>.glb`), with a clip pack made from the game's own clips refit to that body (`public/models/guests/clips-<who>.glb`). No unit, rule or screen uses them yet.

```
node scripts/guest-rig.mjs <who>      # the body, from scripts/guests.json's row
node scripts/guest-clips.mjs <who>    # its pack: the humanoid's, the pistol's stance, the host hero's
node scripts/guest-shots.mjs <who> out.png --host <hero>   # pictures, through the dev server in --mode bucketcheck
```

## What a guest is made of

- **The skeleton** (`scripts/lib/guest-skeleton.mjs`): all 254 of the game's nodes with their rest rotations to the bit and no scale, plus `head_end` and `headfront` under `Head`. Each of the game's body bones stands where the guest's own joint stands once its upper arms, forearms, thighs and shins are turned onto the game's rest. The trunk, the collar, the head and the feet are not turned. Meshy's back is read from the hierarchy: `Spine02`, `Spine01`, `Spine` are the game's `Spine`, `Spine1`, `Spine2`.
- **The mesh** (`scripts/lib/guest-skin.mjs`): posed at that rest through its own Meshy skin and kept as the new bind, its weights moved one for one. `head_end`'s and `headfront`'s weight goes to `Head`. No finger is weighted: a hand is a mitten.
- **The clips** (`scripts/lib/guest-clips.mjs`): every rotation channel is the game's to the bit. Position channels are refit: the hips by the legs' ratio and then lifted, eased, so the feet meet the ground; the weapon socket kept in the right hand's frame at the guest's own grip; the hands' targets on the hands; the attach points on the weapon; the chest's two sockets with the chest.

## Each guest against the game's man

Metres, from the files. "Legs" is the hip joints' height at rest over the game's 0.936.

| | height | hips | thigh | shin | foot | upper arm | forearm | hand | legs | host |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| the game's man | 1.802 | 0.936 | 0.432 | 0.412 | 0.151 | 0.273 | 0.260 | 0.184 | 1 | |
| Rick | 1.800 | 0.933 | 0.370 | 0.364 | 0.105 | 0.249 | 0.264 | 0.187 | 0.8936 | han |
| Morty | 1.500 | 0.749 | 0.304 | 0.276 | 0.107 | 0.215 | 0.182 | 0.145 | 0.7193 | lando |
| Walt | 1.790 | 0.951 | 0.355 | 0.374 | 0.132 | 0.263 | 0.247 | 0.251 | 0.9206 | bossk |
| Jesse | 1.730 | 0.942 | 0.354 | 0.342 | 0.153 | 0.232 | 0.236 | 0.222 | 0.9097 | lando |

The plan expects Rick 1.67 m and Morty 1.47 m tall. The files do not give those: Rick's mesh stands 1.800 m (his hair's tips) with its crown joint at 1.702, Morty's 1.500 with its crown joint at 1.487. His hips, thigh and shin are as the plan says, each within 5 mm.

## The plan's acceptance numbers

| task | what | measured |
| --- | --- | --- |
| 1 | Rick's thigh, shin, hips | 0.3696, 0.3644, 0.9334 (plan: 0.369, 0.363, 0.93) |
| 1 | Morty's thigh, shin, hips | 0.3036, 0.2760, 0.7487 (plan: 0.301, 0.276, 0.75) |
| 1 | fitted skeleton | 256 nodes, each of the game's 254 names once, `checkWalrus` ok with nothing missing, `isWalrus` true |
| 1 | hips at the guest's height, feet at zero | fitted hips 0.929 (Rick, 4.7 mm under his filed 0.933: the game's rest stands a little wider), 0.749 (Morty); soles' mean 0, each within 5 mm |
| 2 | wrist, elbow, knee and ankle rings | carried with their joints: Rick at most 0.94 cm, Morty 0.31 cm, Walt 0.08 cm, Jesse 0.13 cm |
| 2 | weights | every vertex sums to one, on at most 22 bones; every vertex in the zone the Wardrobe paints it by on Meshy's rig (at most 2 differ) |
| 3 | the same bytes twice | yes (`scripts/guest-rig.test.mjs`) |
| 3 | loads through `loadWalrusBody` | yes, the five sockets found; its vertices use 22 joints at most, which is what `pruneSkin` leaves of the skin's 256 |
| 4 | rotation tracks to the bit | every rotation track of all 30 humanoid clips not overridden, compared as the file's normalized shorts (`scripts/guest-clips.test.mjs`) |
| 4 | Morty's lower foot within 2 cm where the game's is | `walk` 1.0 cm, `run` 1.5 cm, `sprint` 1.5 cm at worst |
| 4 | `Wep_Root` to the grip through the aim | 0.0 cm (Morty), 0.1 cm (Rick, Walt, Jesse) |
| 4 | the same clip names in as out | 48 clips: the humanoid's 31, `stance.p.*` 17, the host's `die` over the humanoid's; Walt 49 (Bossk's `melee.a`) |

The plan names `walk.fwd` and `aim`. The packs call them `walk` and `aim.pistol` (and `stance.p.aim`); those are what was measured.

Two things the plan's wording could not hold, and what was done instead:

- **The ring test.** "Centred within 1 cm on its fitted joint" is not true of Meshy's own rig: its knee joints sit 2 to 8 cm before the ring's middle and its ankles 1.5 to 7 cm off (Rick's knee ring is his coat's skirt). The joints are kept where Meshy's weights expect them, and the test is that each ring moved with its joint.
- **The hips by the legs' ratio.** The ratio alone leaves Morty's planted foot 2.8 cm off the ground in the run and 3.8 cm in the sprint, Rick's 4.9 and 9.2 cm, and lays Morty's head 14 cm in the floor when he falls on his back. The hips are lifted or lowered after it, by as little as holds a planted foot within 1.5 cm and every part of the body within 1 cm of sinking, eased over a few frames.

## The pictures

Each: the guest on the left, the game's snowtrooper on the right, the same clip at the same moment, no perspective. The floor is a slab whose top is the ground. The guest's body is loaded by `loadWalrusBody` and its pack by `packUrls(null, { whole })`. Both hold the game's RK-3 on `Wep_Root`.

| picture | what it shows |
| --- | --- |
| `rick-rest-walk.png`, `morty-rest-walk.png`, `walt-rest-walk.png`, `jesse-rest-walk.png` | at rest, then three moments of `walk`, from the front and the side. Soles on the slab's edge at the same phase as the trooper's; the rifle walk's hands together before the chest; head on the neck; no sleeve collapsed |
| `rick-aim.png`, `morty-aim.png`, `walt-aim.png`, `jesse-aim.png` | the pistol's aim, the pistol's walk, a moment of `run`. The pistol is at the right hand, pointing where the trooper's points |
| `rick-fallen.png`, `morty-fallen.png`, `walt-fallen.png`, `jesse-fallen.png` | the end of `die` (the host hero's own: Han's and Lando's kneel with the hands up), `die.back` and `die.blown`. Rick lies on the ground; a dropped gun lies on the ground |
| `rick-look-toon.png`, `-lit.png`, `-ink.png`; `morty-look-…` | the three looks for the owner to choose from, under one light: the galaxy's worlds' toon paint and rim; the same texture as a lit standard material; the first with the cruiser's ink outline |

## What still looks wrong

- **Morty fallen on his back** (`morty-fallen.png`, middle): he lies propped on the back of his head, his back and legs up to 13 cm over the ground. His head is 38 cm through and the game's man's 27; the turns of his neck are the game's and may not be changed, so either the head lies in the floor or the body lies over it. This keeps it out of the floor. Walt and Jesse show the same, less (about 10 cm at the feet).
- **The hand is a mitten.** The pistol's grip lies against an open palm with the fingers along the barrel. Closing the hand needs fingers weighted, which no guest has.
- **The roll of the forearm.** Meshy stood Rick and Morty with their palms forward; the game's man rests his down and in. Their hands are rolled about the forearm to match, half of it at the elbow. It costs 8 to 15 % of the sleeve's girth at their elbows and wrists (Rick's right elbow ring is 0.85 of what it was). Walt and Jesse needed no roll.
- **The sprint.** Holding the planted foot within 1.5 cm makes the hips change pace more sharply than the game's man's do at that size: Morty 1.9 cm against 1.8 (nothing), Rick 5.1 against 2.2, Jesse 6.0 against 2.3, Walt 7.5 against 2.3 between frames. The same in Rick's crouched run (2.9 against 0.4). Not seen in a still; it would show in motion as a small jolt at each push. Widening the 1.5 cm takes it away at the cost of the plan's 2 cm.
- **The pictures crop the aim from the side** on Rick and Walt: the arm reaches the cell's edge. The front view and the close numbers stand for it.

## Not done

- **Fingers**: none are weighted.
- **The other bodies** the Wardrobe offers (Tiny Rick, Evil Morty, Cop Morty, Jesse in hazmat, the Citadel's Ricks): the same two commands, a row each in `scripts/guests.json`; not run. A body whose limbs differ from its person's first by more than 2 % needs a pack of its own (`--body`).
- **The looks for Walt and Jesse**: not photographed three ways.
- **The stance.** `withStance` (`src/lib/three/walrusStance.js`) fetches the game's own stance pack and lays it over a figure; on a guest that would be the man's positions again. A guest's whole pack already carries `stance.p.*`: whoever makes a guest a unit takes the stance from there.
- **The Wardrobe's gear after `pruneSkin`.** `wearGear` reads `head_end` and `headfront` from the skin's joints; they carry no weight, so `pruneSkin` drops them. Dress before pruning, or keep those two.
- **`figures.js`'s `BODIES` rows**, a unit, its rules, its screens: other lanes.

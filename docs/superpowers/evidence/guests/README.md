# The site's own cast on the 2017 game's skeleton: what was made, measured and seen

2026-10-13. For the plan `docs/superpowers/plans/2026-10-13-guest-rig-and-clips.md` (design: `specs/2026-10-13-gpu-site-and-guest-heroes-design.md`, section 4, lanes B1 and B2). Revised the same day after the branch's review (the ground by the mesh, the look, the packs out of git).

Rick, Morty, Walt and Jesse each exist as a body on Star Wars Battlefront II (2017)'s 254-node skeleton at their own proportions, in the repository at `public/models/guests/<body>.glb`. Each has a clip pack made from the game's own clips refit to that body. **The packs are not in the repository**: they are the game's own hero packs, and the repository keeps those in the asset bucket and out of git. A pack is made by the command below into `lab/assets/packs/guests/`, which git ignores; nothing has published one to the bucket. No unit, rule or screen uses a guest yet.

```
node scripts/guest-rig.mjs <who>      # the body, from scripts/guests.json's row, into public/models/guests/
node scripts/guest-clips.mjs <who>    # its pack (the humanoid's, the pistol's stance, the host hero's), into lab/assets/packs/guests/
node scripts/guest-shots.mjs <who> out.png --host <hero>   # pictures, through the dev server in --mode bucketcheck
```

## What a guest is made of

- **The skeleton** (`scripts/lib/guest-skeleton.mjs`): all 254 of the game's nodes with their rest rotations to the bit and no scale, plus `head_end` and `headfront` under `Head`. Each of the game's body bones stands where the guest's own joint stands once its upper arms, forearms, thighs and shins are turned onto the game's rest. The trunk, the collar, the head and the feet are not turned. Meshy's back is read from the hierarchy: `Spine02`, `Spine01`, `Spine` are the game's `Spine`, `Spine1`, `Spine2`.
- **The mesh** (`scripts/lib/guest-skin.mjs`): posed at that rest through its own Meshy skin and kept as the new bind, its weights moved one for one. `head_end`'s and `headfront`'s weight goes to `Head`. No finger is weighted: a hand is a mitten.
- **The clips** (`scripts/lib/guest-clips.mjs`): every rotation channel is the game's to the bit. Position channels are refit: the hips by the legs' ratio and then lifted or lowered, eased, to meet the ground (below); the weapon socket kept in the right hand's frame at the guest's grip; the hands' targets on the hands; the attach points on the weapon; the chest's two sockets with the chest.

## Each guest against the game's man

Metres, from the files. "Legs" is the hip joints' height at rest over the game's 0.936.

| | height | hips | thigh | shin | foot | upper arm | forearm | hand | legs | host |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| the game's man | 1.802 | 0.936 | 0.432 | 0.412 | 0.151 | 0.273 | 0.260 | 0.184 | 1 | |
| Rick | 1.800 | 0.933 | 0.370 | 0.364 | 0.105 | 0.249 | 0.264 | 0.187 | 0.8936 | han |
| Morty | 1.500 | 0.749 | 0.304 | 0.276 | 0.107 | 0.215 | 0.182 | 0.145 | 0.7193 | lando |
| Walt | 1.790 | 0.951 | 0.355 | 0.374 | 0.132 | 0.263 | 0.247 | 0.251 | 0.9206 | bossk |
| Jesse | 1.730 | 0.942 | 0.354 | 0.342 | 0.153 | 0.232 | 0.236 | 0.222 | 0.9097 | lando |

The plan expects Rick 1.67 m and Morty 1.47 m tall. The files do not give those: Rick's mesh stands 1.800 m (his hair's tips) with its crown joint at 1.702, Morty's 1.500 with its crown joint at 1.487. Their hips, thighs and shins are as the plan says, each within 5 mm.

## The plan's acceptance numbers

| task | what | measured |
| --- | --- | --- |
| 1 | Rick's thigh, shin, hips | 0.3696, 0.3644, 0.9334 (plan: 0.369, 0.363, 0.93) |
| 1 | Morty's thigh, shin, hips | 0.3036, 0.2760, 0.7487 (plan: 0.301, 0.276, 0.75) |
| 1 | fitted skeleton | 256 nodes, each of the game's 254 names once, `checkWalrus` ok with nothing missing, `isWalrus` true |
| 1 | hips at the guest's height, feet at zero | fitted hips 0.929 (Rick, 4.7 mm under his filed 0.933: the game's rest stands a little wider), 0.749 (Morty); soles' mean 0, each within 5 mm |
| 2 | wrist, elbow, knee and ankle rings | carried with their joints: Rick at most 0.94 cm, Morty 0.31 cm, Walt 0.08 cm, Jesse 0.13 cm |
| 2 | weights | every vertex sums to one, on at most 22 bones; every vertex in the zone the Wardrobe paints it by on Meshy's rig (at most 2 differ) |
| 3 | the same bytes twice | yes; and each of the four committed bodies is, byte for byte, what the command makes today (`scripts/guest-rig.test.mjs`) |
| 3 | loads through `loadWalrusBody` | yes, the five sockets found; its vertices use 22 joints at most, which is what `pruneSkin` leaves of the skin's 256 |
| 4 | rotation tracks to the bit | the command reads back each pack it writes and fails unless every turn equals its source, stored shorts and key times: 3,430 turns in Rick's, Morty's and Jesse's packs, 3,503 in Walt's. The tests do the same for all four guests on clips of the humanoid pack, which is in git, and prove the check throws on one short off by one |
| 4 | the lower foot within 2 cm where the game's is | by the soles' probes, at worst: Morty `walk` 1.0, `run` 1.5, `sprint` 1.5 cm; Rick 1.4, 1.5, 1.5; Walt 1.3, 1.5, 1.5; Jesse 1.1, 1.5, 1.5 |
| 4 | `Wep_Root` to the grip through the aim | 0.0 cm (Morty), 0.1 cm (Rick, Walt, Jesse) |
| 4 | the same clip names in as out | 48 clips: the humanoid's 31, `stance.p.*` 17, the host's `die` over the humanoid's; Walt 49 (Bossk's `melee.a`) |

The plan names `walk.fwd` and `aim`. The packs call them `walk` and `aim.pistol` (and `stance.p.aim`); those are what was measured.

## Where it departs from the plan

1. **Bones are put where the guest's own joints stand**, not scaled along the game's own directions. Only the long bones of the limbs are turned onto the game's. Scaled along the game's directions, Rick's head would sit 2.6 cm forward of his neck and his soles would tip 24° off the ground.
2. **The ring test** is "each ring moved with its joint within 1 cm", not "centred on it within 1 cm". Meshy's own knee joints sit 2 to 8 cm before the ring's middle and its ankles 1.5 to 7 cm off (Rick's knee ring is his coat's skirt). The joints are kept where Meshy's weights expect them.
3. **The hips are not sized by the legs' ratio alone.** By the ratio alone the planted foot is off the ground by 2.0 cm (Morty), 3.5 (Rick, Jesse) and 3.6 (Walt) in the run, and 2.1, 5.4, 5.5 and 7.1 in the sprint; in a roll Walt's hands are 20 cm under the ground; fallen on his back Morty's head is 17 cm in it. The body is lifted or lowered after the ratio, as the next section says.
4. **The palms are rolled about the forearm** to face as the game's man's. Meshy stood Rick and Morty with theirs forward, and the pistol lay on an open, upturned palm.
5. **The plan's heights** for Rick and Morty are not what the files measure (above).

## The ground, by the mesh

A guest's limbs are not the game's man's in proportion, and every turn is his. So only the hips' place can be moved to meet the ground, and not every part can be met at once. What the refit does, each frame, in this order:

- Where the game's man's foot is planted, the guest's lower sole is held within 1.5 cm of the ground.
- No vertex of the trunk, the pelvis, an arm or a hand is left more than 1 cm under the ground. Where a hand is under the ground while a foot is planted, the two are met halfway.
- The head is brought out of the ground too, except where the body is down (its trunk or pelvis within 10 cm of the ground). There a head bigger than the game's man's cannot lie flat beside the body: it is let into the ground as far as that leaves the body over it. **The worse of the two is made smallest; neither is right.**
- The legs are not kept up: Rick's coat and Walt's trouser cuffs hang from them.

Measured on the mesh, skinned at every frame, lowest vertex, centimetres over the ground (under it is negative). "Before" is the branch as first reviewed (the lift solved for six sole points and a ball each in pelvis, trunk and head); "after" is this revision (the lift solved on the mesh itself).

| | Rick before | Rick after | Morty before | Morty after | Walt before | Walt after | Jesse before | Jesse after |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rolls (`dodge.*`): deepest hand or arm | −10.0 | −1.0 | −4.6 | −1.0 | −16.6 | −1.2 | −10.1 | −1.0 |
| rolls: deepest head | −10.9 | −8.8 | −3.2 | −7.1 | −4.0 | none under | −3.8 | −1.4 |
| rolls: the planted foot, worst (soles' probes) | 1.5 | 1.5 | 1.5 | 1.5 | 1.5 | 1.7 | 1.5 | 1.5 |
| `die.back`: deepest hand or arm | −6.4 | −1.0 | −2.1 | −1.0 | −8.1 | −1.0 | −6.9 | −1.0 |
| `die.back`: deepest head, any frame | −13.2 | −11.1 | −4.1 | −8.6 | −2.9 | −0.6 | −4.8 | −2.5 |
| `die.back`, end: head | −2.0 | −1.8 | −1.5 | −4.7 | −0.8 | −0.2 | −0.5 | −0.1 |
| `die.back`, end: lower of trunk and pelvis | +3.6 | +3.9 | +8.4 | +5.2 | −1.5 | −1.0 | −1.4 | −1.0 |
| `die.blown`, end: head | −12.6 | −10.3 | −3.3 | −7.9 | −2.1 | +0.6 | −3.2 | −1.7 |
| `die.blown`, end: lower of trunk and pelvis | +8.5 | +10.8 | +13.0 | +8.4 | −0.2 | +2.6 | +0.7 | +2.2 |
| `die.blown`: deepest hand or arm | −2.2 | −1.0 | −2.0 | −1.0 | −8.8 | −1.0 | −4.6 | −1.0 |
| `die` (the pack's own: the host's kneel): deepest hand | none under | none under | none under | none under | −8.7 | −4.9 | none under | none under |
| `die` (the host's): the planted foot, worst | 1.0 | 1.0 | 1.0 | 1.0 | 1.5 | 5.4 | 1.1 | 1.1 |
| `walk`, `run`, `sprint`: the planted foot, worst | 1.4, 1.5, 1.5 | the same | 1.0, 1.5, 1.5 | the same | 1.3, 1.5, 1.5 | the same | 1.1, 1.5, 1.5 | the same |

What that buys and costs: the hands and arms come out of the ground in every roll and death (Walt's from 16.6 cm to 1.2). Rick's hair is still 8.8 to 11.1 cm in the ground where he rolls or falls on it, a little less than before, and his body is 10.8 cm over the ground blown off his feet where it was 8.5. Morty's head is now 4.7 to 8.6 cm in the ground where before it was 1.5 to 4.1, and his body is 5.2 to 8.4 cm over the ground where before it hung 8.4 to 13.0: the head pays for the body. Walt on all fours (Bossk's death) has a foot 5.4 cm up for a hand 4.9 cm under. The feet in the three gaits are untouched.

`scripts/lib/guest-clips.test.mjs` holds these: as requirements where the number is the plan's or the least that is right (the planted foot within 2 cm; trunk, pelvis, arms and hands within 3 cm; the head's trade even), and as pins of today's output where it is a fault held still (how deep a head goes, the adults' sprint), each labelled as which.

## The look

Ruled 2026-10-13: a guest wears its own paint under the game's light, the lit standard material (`rick-look-lit.png`, `morty-look-lit.png`), with no rim and no outline.

The two pictures named `-look-ink.png` **show no ink line**: they are the toon pictures again, but for 180 and 65 pixels of the guest's half. The likely cause, read in the shader and not run: `src/lib/three/ink.js` pushes a skinned hull along `transformedNormal`, which three 0.186 negates under `FLIP_SIDED`, and a `BackSide` material defines that, so the hull goes inward and shows only where the mesh is thinner than twice its width. This branch does not change `ink.js`. If that is the cause it also touches the cruiser's crew, and is its own change. The outline was not re-shot.

## The pictures

Each: the guest on the left, the game's snowtrooper on the right, the same clip at the same moment, no perspective. The floor is a slab whose top is the ground. The guest's body is loaded by `loadWalrusBody` and its pack by `packUrls(null, { whole })`. Both hold the game's RK-3 on `Wep_Root`.

| picture | what it shows |
| --- | --- |
| `rick-rest-walk.png`, `morty-rest-walk.png`, `walt-rest-walk.png`, `jesse-rest-walk.png` | at rest, then three moments of `walk`, from the front and the side. Soles on the slab's edge at the same phase as the trooper's; the rifle walk's hands together before the chest; head on the neck; no sleeve collapsed |
| `rick-aim.png`, `morty-aim.png`, `walt-aim.png`, `jesse-aim.png` | the pistol's aim, the pistol's walk, a moment of `run`. The pistol is at the right hand, pointing where the trooper's points |
| `rick-fallen.png`, `morty-fallen.png`, `walt-fallen.png`, `jesse-fallen.png` | the end of the pack's own `die` (the host hero's: Han's and Lando's kneel with the hands up, Bossk's on all fours), `die.back` and `die.blown`. Re-shot for this revision, taller and wider, so no head or trooper is cut off. Rick's and Morty's were opened: a dropped gun lies on the ground; Rick on his back lies on it; blown off his feet his hair is in it and his body a hand over it; Morty lies with his head part in the ground and his body a little over it; his kneeling knee is clear of the ground |
| `rick-look-toon.png`, `-lit.png`, `-ink.png`; `morty-look-…` | the looks: the galaxy's worlds' toon paint and rim; the same texture as a lit standard material (the one ruled); and a third that was meant to carry the cruiser's ink outline and does not (above) |

The pictures of the walk, the aim and the look were taken before this revision. It changes neither the bodies nor the feet in the gaits, so they were not taken again.

## What still looks wrong

- **Fallen and rolling, a head in the ground or a body over it** (`rick-fallen.png` and `morty-fallen.png`, middle and right). The numbers are the table's: Rick's hair 10.3 cm in the ground and his body 10.8 cm over it at the end of `die.blown`, 11.1 cm in at the deepest moment of `die.back`, 8.8 cm in a roll to his right; Morty's head 7.9 cm in and his body 8.4 cm over at the end of `die.blown`, 4.7 and 5.2 at the end of `die.back`, 7.1 cm in a roll. His head is 38 cm through and the game's man's 27, and Rick's hair reaches 8 cm past his skull each way; the turns of the neck are the game's and may not be changed.
- **The kneeling deaths** (the left column of the four fallen pictures). With the front foot planted, the kneeling leg's lowest point at thigh and shin is 1.0 cm under the ground on Rick and 5.0, 5.9 and 10.6 cm over it on Morty, Walt and Jesse; the rear foot's toes are 9.3, 4.6, 8.9 and 12.9 cm over it. It is the same turns on a shorter thigh and shin over a higher ankle (Jesse's ankle joint stands 1.60 times the game's, his thigh and shin 0.83). No position channel can close it.
- **Walt on all fours** (Bossk's death): a hand 4.9 cm under the ground and a foot 5.4 cm over it, met halfway.
- **Cloth on the legs goes into the ground**: Rick's coat 5.4 cm at the end of `die.blown` and 6.1 in a roll, Walt's trouser cuffs 5.8 in a roll. And Rick's coat skirt opens like a tent between his legs in a stride (Meshy's weights).
- **The hand is a mitten.** The pistol's grip lies against an open palm with the fingers along the barrel; on Walt it rides on top of the spread glove. Closing the hand needs fingers weighted, which no guest has. No grip has been placed by eye on its own hand: three are the game's man's own, Morty's that at his hand's size, and only Rick's was looked at closely.
- **The roll of the forearm.** It costs 8 to 15 % of the sleeve's girth at Rick's and Morty's elbows and wrists (Rick's right elbow ring is 0.852 of what it was), and folds 19 to 149 of about 41,000 triangles over at the forearms and hands. Walt and Jesse needed no roll.
- **The sprint jolts the adults' hips.** Holding the planted foot within 1.5 cm makes the hips change pace more sharply between frames than the game's man's do at that size: Rick 5.1 cm against 2.2, Jesse 6.0 against 2.3, Walt 7.5 against 2.3 (Morty 1.9 against 1.8, which is nothing). The pistol's sprint is worse: Walt 8.4 against 1.8, Jesse 7.3 against 1.7. In the run, 2.8 to 3.5 against 2.3 to 2.4; in Rick's crouched run 2.9 against 0.4. Not seen in a still; it would show in motion as a small jolt at each push. Widening the 1.5 cm takes it away at the cost of the plan's 2 cm.
- **A trailing foot**: Jesse's is about 3 cm up at the first moment of the walk where the trooper's toe is still down; in the run every guest's lower foot is 1.4 to 2.1 cm over the ground by the mesh where the trooper's toe touches.
- **`Wep_Muzzle` is sized by the hand**, as the plan says: 58 cm out on the game's man, 45.7 on Morty, 79.2 on Walt, with the same gun. `figures/held.js` does not read it today.
- **The pictures crop the aim from the side** on Rick and Walt: the arm reaches the cell's edge. The front view and the numbers stand for it.

## Not done

- **Fingers**: none are weighted.
- **Publishing the packs** to the asset bucket: the owner's to approve, in the lane that makes guests playable. Until then a pack exists only where the command was run.
- **The other bodies** the Wardrobe offers (Tiny Rick, Evil Morty, Cop Morty, Jesse in hazmat, the Citadel's Ricks): the same two commands, a row each in `scripts/guests.json`; not run. A body whose limbs differ from its person's first by more than 2 % needs a pack of its own (`--body`).
- **The stance.** `withStance` (`src/lib/three/walrusStance.js`) fetches the game's own stance pack and lays it over a figure; on a guest that would be the man's positions again. A guest's whole pack already carries `stance.p.*`: whoever makes a guest a unit takes the stance from there.
- **The Wardrobe's gear after `pruneSkin`.** `wearGear` reads `head_end` and `headfront` from the skin's joints; they carry no weight, so `pruneSkin` drops them. Dress before pruning, or keep those two.
- **`figures.js`'s `BODIES` rows**, a unit, its rules, its screens: other lanes.

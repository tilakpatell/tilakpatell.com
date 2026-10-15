# A guest on the game's rig, moved by the game's clips: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rick and Morty (then Walt and Jesse, by the same two commands) exist as body files on the game's 254-node skeleton at their own proportions, with a clip pack made from the game's own clips that walks, runs, aims and dies them with their feet on the ground and the gun in their hand.

**Architecture:** Two offline scripts, each a thin shell over pure, tested functions. `scripts/guest-rig.mjs` builds a skeleton with every one of the game's node names and rest rotations and the guest's own limb lengths, poses the guest's mesh into that rest through its existing Meshy skin, and moves its weights across by a joint map. `scripts/guest-clips.mjs` copies the game's clips' rotation channels bit for bit and refits the ten position channels (hips, two spine links, the weapon and hand sockets) to the guest's size. The loader then needs one new case (a body whose pack is whole), and the Wardrobe one name map. No unit, no rule, no screen: a guest becomes playable in a later plan.

**Tech Stack:** Node scripts in the repository's own style (`scripts/rig-transfer.mjs` and `scripts/bf2017-import.mjs` show the glTF reading and writing this repository uses; follow the one they use, add no new dependency), three's math classes for the pure functions, vitest, a headless-Edge picture script for the evidence.

**Spec:** `docs/superpowers/specs/2026-10-13-gpu-site-and-guest-heroes-design.md`, section 4 (lanes B1 and B2, "What done is for a guest") and section 8 (answers 3, 4 and 5).

## Global Constraints

- The game's rig stays whole: all 254 nodes of `public/models/galaxy/bf2017/walrus.glb`, no name changed, none removed. Two helper nodes are added under `Head` (`head_end`, `headfront`) because the Wardrobe's gear takes its frame from them.
- The body passes `checkWalrus` and `isWalrus` (`src/lib/three/walrusRig.js`): the 23 body bones, the 5 sockets, and no node named `Spine02`.
- A clip's rotation channels are the game's values, unchanged to the bit. Only position channels are refit, and only for a guest: no file of the game's own figures or packs is rewritten.
- No clip from the UAL library or from Meshy is put on a guest's fitted rig (the standing ruling of 2026-10-10 about this rig).
- Deterministic and offline: no service is called, and the same inputs give the same bytes (`docs/superpowers/HANDOFF-npc-player-rigging.md`, rules 27 to 29).
- Metres, no scale on the output's root.
- The guests' sources: `public/games/meshy/rick.glb`, `public/games/meshy/morty.glb`, `public/models/cockpit/walt.glb`, `public/models/cockpit/jesse.glb`, each one skin of Meshy's 24 joints under a root scaled 0.01. Their other bodies (the Wardrobe's `BODIES` in `src/components/rickmorty/wardrobe/looks.js`) are the same rig and go through the same command.
- Output: `public/models/guests/<body id>.glb` (the fitted body, the Wardrobe's body ids as names) and `public/models/guests/clips-<who>.glb` (one pack a person, since a person's bodies share proportions; if two of a person's bodies differ in a limb by more than 2 %, that body gets its own pack and the report says so).
- The joint map is read from the file's hierarchy, never from the spine joints' names (Meshy numbers its spine joints in an order the names do not tell).
- Before the branch is done: `npm run lint`, `npx vitest run scripts src/lib/three`, `npx vite build`, `node scripts/health.mjs --check --skip build`. Anything the health check asks of new model files (a credit row in `src/data/modelCredits.json`, a size budget) is done, not waived.

## Review Focus

- A guest whose arms rest at another angle than the game's (Rick 46° under level, Morty 67°, the game 37° and angled forward): after the fit the elbow and wrist are where the fitted skeleton's are, and the sleeve has not collapsed.
- Morty's legs (0.58 m against the game's 0.84 m): through a walk the planted foot is on the ground, not under it and not above it.
- A vertex weighted to a Meshy joint with no counterpart (`head_end`, `headfront`): its weight goes to `Head`, and the weights still sum to one.
- A clip that keys a socket the guest's rig has but at the game man's reach (`Wep_Root` in a two-handed aim): the gun's grip stays in the right hand's grip frame.
- The same command run twice: the same bytes.

---

### Task 1: The fitted skeleton (pure)

**Files:**
- Create: `scripts/lib/guest-skeleton.mjs`
- Test: `scripts/lib/guest-skeleton.test.mjs`

**Interfaces:**
- Produces: `measure(meshyNodes) → { segments: { thigh, shin, foot, spine: [a, b, c], neck, head, clavicle, upperArm, forearm, hand }, hipsHeight, height }` (metres, both sides averaged); `JOINT_MAP(meshyNodes) → Map<meshy joint name, game bone name>` from the hierarchy; `fitSkeleton(walrusNodes, measured) → nodes` (the game's names and rest rotations; each of the 23 body bones' rest offset scaled along its own direction to the measured segment; finger and weapon bones scaled by the hand's ratio, face bones by the head's; `head_end` and `headfront` added under `Head`).

- [ ] Tests first, with the survey's numbers as the expectation: Rick's measured thigh 0.369 and shin 0.363, hips 0.93, height 1.67; Morty's 0.301 and 0.276, hips 0.75, height 1.47 (each within 5 mm of the file). The fitted skeleton has 256 nodes, every one of the game's 254 names once, passes `checkWalrus`, and its hips stand at the guest's measured height with the feet at zero.
- [ ] Implement; run; commit.

### Task 2: The mesh at the new rest, and its weights (pure)

**Files:**
- Create: `scripts/lib/guest-skin.mjs`
- Test: `scripts/lib/guest-skin.test.mjs`

**Interfaces:**
- Consumes: Task 1's `JOINT_MAP`, `fitSkeleton`.
- Produces: `restPose(meshySkeleton, fitted, map) → Map<meshy joint, world matrix>` (each mapped Meshy joint turned so its bone points as the fitted bone does, and placed at the fitted joint); `bakeBind(positions, normals, skinIndex, skinWeight, meshyBind, restPose) → { positions, normals }` (linear blend skinning through the Meshy skin); `moveWeights(skinIndex, skinWeight, map, gameIndexOf) → { skinIndex, skinWeight }` (weights to the counterpart, an unmapped joint's to its nearest mapped parent, sums kept at one, at most four a vertex).

- [ ] Tests first on a hand-made two-limb rig: a vertex on a bone lands on the fitted bone; weights sum to one; an unmapped joint's weight goes to its parent's counterpart. Then on Rick's and Morty's real files: in the fitted rest, every wrist, elbow, knee and ankle ring of vertices is centred within 1 cm on its fitted joint.
- [ ] Implement; run; commit.

### Task 3: `scripts/guest-rig.mjs`

**Files:**
- Create: `scripts/guest-rig.mjs`, `scripts/guests.json` (a row a person: `{ who, bodies: [ids], grip: [x, y, z] }`; the grip is the gun's grip point in the right hand's frame, by hand, `"source": "hand"`)
- Create (outputs): `public/models/guests/rick.glb`, `morty.glb`

**Interfaces:**
- Consumes: Tasks 1 and 2.
- Produces: `node scripts/guest-rig.mjs <who> [--body <id>] [--out <dir>]` writes the fitted body, metres, no root scale, its textures as the source has them.

- [ ] A test that runs the command twice on Rick and compares the bytes; a test that loads the output through `loadWalrusBody` (`src/lib/three/walrus.js`) without a throw.
- [ ] Implement; make Rick and Morty; commit the two files with their credit rows if the health check asks for them.

### Task 4: The clips at the guest's size (pure, then the command)

**Files:**
- Create: `scripts/lib/guest-clips.mjs`, `scripts/guest-clips.mjs`
- Test: `scripts/lib/guest-clips.test.mjs`
- Create (outputs): `public/models/guests/clips-rick.glb`, `clips-morty.glb`

**Interfaces:**
- Consumes: Task 1's fitted skeleton.
- Produces: `refit(clip, walrus, fitted) → clip`: rotation tracks copied; `Hips.position` scaled by fitted leg length over the game's (its height above the ground, and its travel); `Spine` and `Spine1` positions scaled by the torso's ratio; `Wep_Root`, `Wep2_Root`, `Wep_Aim`, `IK_Joint_LeftHand`, `IK_Joint_RightHand`, `LeftHandAttach`, `RightHandAttach` re-expressed frame by frame from the game man's right (or left) hand into the guest's: where the socket sat in the hand's frame on the game's rig at that frame, it sits in the guest's hand's frame. The clip's `extras` (`root`, `rootHips`, the strokes' `contact`) scaled with the legs. `node scripts/guest-clips.mjs <who> --host <hero> [--packs …]` writes one pack with the game's clip names, from `clips-humanoid`, the pistol stance pack and the host hero's pack (Rick's host is `han`, Morty's `lando`; a pack that is only in the asset bucket is fetched through the same base the dev server uses, read from `.env.bucketcheck.local`, and never committed).

- [ ] Tests first: every rotation track equals the game's to the bit; through `walk.fwd`, `run` and `sprint` on the fitted Morty the lower foot is within 2 cm of zero on every frame the game's own foot is within 2 cm of zero on the game's rig; through `aim` the distance from `Wep_Root` to the right hand's grip point never exceeds 1 cm; the pack has the same clip names in as out.
- [ ] Implement; make the two packs; commit.

### Task 5: The loader's one case, and the Wardrobe's names

**Files:**
- Modify: `src/lib/three/walrus.js` (`packUrls`: a body whose row says its pack is whole loads that pack alone), `src/components/rickmorty/wardrobe/dressCore.js` (`addZones` knows the game's names for its six zones)
- Test: `src/lib/three/walrus.test.js`, `src/components/rickmorty/wardrobe/dressCore.test.js` (or the file's existing test)

**Interfaces:**
- Produces: `packUrls(hero, { extras, whole })`: with `whole: url` it returns `[url]`; `addZones(geometry, boneNames)` gives a game-rig body the same zone a Meshy-rig body gets for the same part of the body.

- [ ] Tests first: `packUrls(null, { whole: '/models/guests/clips-rick.glb' })` is that one URL; a vertex on `LeftUpLeg` (the game's name) is zone 2 and one on `Spine1` zone 1, as `LeftUpLeg` and `Spine01` are on the Meshy rig.
- [ ] Implement; run; commit.

### Task 6: The pictures

**Files:**
- Create: `scripts/preview/guest.html` and `scripts/guest-shots.mjs` (not shipped: a page that stands a fitted guest beside the game's trooper on the same clips, and a script that photographs it)
- Create: `docs/superpowers/evidence/guests/README.md` and its pictures

- [ ] Photograph Rick and Morty beside the snowtrooper (`crew/snowtrooper.lod1.glb`, on this disk) at rest, at three frames of `walk.fwd`, in `aim`, and fallen, from the front and the side. The page loads the body through `loadWalrusBody` and the pack through `packUrls`' new case, so the picture is of what the game will load.
- [ ] The look, three ways, for the owner to choose from (his answer 4: "whatever looks better and like the game"): the guest's toon paint and rim light as the galaxy's worlds draw it; the same texture as a lit standard material; and the first with the inverted-hull outline (`src/lib/three/ink.js`). One row of three pictures a guest, under the same light.
- [ ] Look at every picture. A foot under the floor, a gun out of the hand, a collapsed sleeve or shoulder, a head off the neck: each is a fault in Tasks 1 to 4 to go back and fix, with a test that would have caught it. What still looks wrong when you stop is listed in the evidence file with its picture, not left out.
- [ ] The evidence file: the measurements of each guest against the game's rig, the acceptance numbers of Tasks 1 to 4, the pictures, and what is not done (fingers: none are weighted, so a hand is a mitten; Walt and Jesse: not yet run, or run and how they came out).
- [ ] Global Constraints' checks. Push the branch; open a draft pull request; do not merge.

# Research: weapons (the Battlefront world's follow-up, 2026-10-10)

I've finished the research. All eight class weapons are in the export as single 3P meshes on one shared weapon skeleton. Each weapon's own muzzle point is in its weapon record. I imported all eight to scratch with the existing importer: the light cuts come to about 0.97 MB together, with the grip origin kept. I edited no tracked files.

Two things the plan has to handle that you might not expect:
- **Soldiers probably face 90° off.** In a probe, every rifle clip in the committed humanoid pack points the barrel along the body's +X at rotation 0, while the battle code treats yaw 0 as +Z. The raw game clips hold a fixed −90° turn on `AITrajectory`, and the clip packer (`scripts/bf2017-clips.mjs:71`) drops that node. If true, the soldiers already crab-walk today, and a held gun would point 90° away from where its bolts go. It is the first thing to check in a browser.
- **The pack's `idle` is Luke's unarmed idle** (`L_Luke_Stand_Unarmed_Idle_01`). A held gun hangs barrel-down in it, so idle needs the rifle, pistol or heavy pose instead.

# 1. What the game files hold

**Meshes** (`web/models.jsonl`; all `SkinnedMeshAsset` on `Characters/Rigs/Weapon/WeaponSke01`, 44 joints; LODs listed as LOD0…last):

| id | manifest name | triangles per LOD | LOD0 bounds z (m) |
|---|---|---|---|
| e11 | `gameplay/equipment/rifles/e11/e11_3p_mesh` | 4031 / 2012 / 935 / 444 / 195 | −0.168 to 0.324 |
| a280 | `rifles/a280/a280_mesh3p_mesh` | 7731 / 3765 / 1811 / 993 / 502 / 279 | −0.180 to 0.493 |
| dh17 | `pistols/dh17/dh17_mesh3p_mesh` | 4274 / 2022 / 835 / 391 / 157 | −0.132 to 0.306 |
| rk3 | `pistols/rk3/rk3_mesh3p_mesh` | 2402 / 1241 / 609 / 309 | −0.064 to 0.184 |
| dlt19 | `heavy/dlt19/dlt19_mesh3p_mesh` | 5276 / 2473 / 1476 / 735 / 322 | −0.326 to 0.896 |
| rt97c | `heavy/rt97c/rt97c_mesh3p_mesh` | 6863 / 3924 / 1885 / 885 / 411 | −0.077 to 1.015 |
| dlt19x | `longrange/dlt19x/dlt19x_mesh3p_mesh` | 6359 / 3635 / 1972 / 980 / 337 | −0.326 to 0.896 |
| dlt20a | `longrange/dlt20a/dlt20a_mesh3p_mesh` | 7183 / 3716 / 1687 / 818 / 441 | −0.230 to 0.752 |

- **Textures:** each weapon has `T_<W>_CS` (colour), `_NAM` (normal, AO, metal) and `_RGB` (a mask), read through KTX2 colour, normal and ORM maps. The E-11's are 1.35, 2.87 and 3.80 MB; the DLT-19X also uses the DLT-19's set. In the export, the weapon's GLB LODs are 13–145 KB each.
- **Frame:** the barrel runs along +z and `Wep_Root` sits at the origin. This holds for all eight.
- **No first-person meshes, no attachments:** none of the eight has a first-person mesh, and none has `WeaponSkinnedSocketObjectData`/`SocketData` (empty `SocketsInWeapon`).

**The skeleton's rest pose is the same for every weapon.** `Characters/Rigs/Weapon/WeaponSke01#SkeletonAsset.LocalPose` has `Wep_Muzzle` at index 41, at (0, 0.00941, 0.57978). Every weapon GLB carries this same rest pose, and so do the character skeletons (`walrus.glb`, `snowtrooper.lod1.glb`: `Wep_Root` under `Spine2`, `Wep_Muzzle` under it). The weapon meshes are skinned almost entirely to `Wep_Root`; only the trigger and sight verts go to `Wep_Trigger` and `Wep_Extra*`.

**The blueprint chain.** `classes.json` → `weaponUnlock` → `W_*` (`SoldierWeaponBlueprint`).
- `SoldierWeaponData.WeaponStates[0]` holds `Mesh3p` (the mesh above), `WeaponMesh3p` (the `<W>_3P`/`_Mesh3P` `ObjectBlueprint`, a `MeshProxyEntityData`) and `Mesh3pTransforms {Indices, Transforms}`.
- `Mesh3pTransforms` holds per-weapon offsets for the weapon bones. **Bone position = rest pose + `trans`.** This is confirmed three ways: `Wep_Extra4` equals `Wep_Muzzle` exactly, the result matches the flash offset, and it sits just inside each mesh's end.
- The firing records (`WeaponFiring_Default_*`, all seven read) have `Shot.WeaponBone: GameplayBones_WeaponMuzzleBone`, `SpawnVisualAtWeaponBone: true`, `ForceSpawnToCamera: true`, `InitialPosition` (0,0,0). So the game spawns the hit-testing bolt at the camera and draws it from the muzzle bone. That is exactly the split the site needs: the sim keeps `muzzleOf`, the drawing starts at the gun.
- Other fields, the same on all eight: `IsOneHanded: false`, `AnimatedAimingType: AnimatedAimingTwoHanded`, `ProjectileBoneName: ''`. The E-11 is `AnimatedFireSingle`; the heavies are `AnimatedFireAutomatic`.

| id | Wep_Muzzle (rest + trans) | trans entry k | FireEffects3p Offset (default modifier) | muzzle-flash effect | AnimBaseSet → stance |
|---|---|---|---|---|---|
| e11 | 0, 0.04938, 0.29897 | 9 | same | FX_Blaster_Muzz_Red | wabsRif → t |
| a280 | 0, 0.05377, 0.49152 | 29 | 0, 0.06513, 0.5 | FX_Blaster_Muzz_Red | wabsRif → t |
| dh17 | 0, 0.0456, 0.30019 | 4 | 0, 0.02, 0.30019 | …_Red_Pistol | wabsPstl → p |
| rk3 | 0, 0.05523, 0.18356 | 4 | 0, 0, 0.18356 | …_Red_Pistol | wabsPstl → p |
| dlt19 | 0, 0.05836, 0.87874 | 4 | same | FX_Blaster_Muzz_3P | wabsLMG → l |
| rt97c | 0, 0.05185, 0.93091 | 29 | same | …_Red_LMG | wabsLMG → l |
| dlt19x | −0.01679, 0.05653, 0.81078 | 29 | same | …_Red_SniperRifle | wabsRif → t |
| dlt20a | 0, 0.0624, 0.74115 | 29 | same | …_Red_SniperRifle | wabsRif → t |

- **Sources for the table:**
  - Muzzle column: `derived: Characters/Rigs/Weapon/WeaponSke01#SkeletonAsset.LocalPose.41.trans + <W>#SoldierWeaponData.WeaponStates.0.Mesh3pTransforms.Transforms.<k>.trans` (the entry k where `Indices[k] == 41`).
  - Flash column: `<W>#WeaponFiringEffectsModifier.FireEffects3p.0.Offset`. Take it from the `WeaponModifierData` entry whose `UnlockAssetGuid` is all zeros; the A280C fixture has two such modifiers.
  - Stance column: `<W>#SoldierWeaponData.AnimBaseSet`.
- **Bolt speed:** 700 m/s for the rifles, pistols and heavies; 1600 for the DLT-19X and DLT-20A (`Shot.InitialSpeed.z`).
- **Where `<W>` lives:** `Gameplay/Equipment/{Rifles/E11/W_BlasterRifle_E11, Rifles/A280/W_BlasterRifle_A280, Pistols/DH17/W_Pistol_DH17, Pistols/RK3/W_Pistol_RK3, Heavy/DLT19/W_HeavyBlaster_DLT19, Heavy/RT97C/W_HeavyBlaster_RT97C, LongRange/DLT19X/W_LongRange_DLT19X, LongRange/DLT20A/W_LongRange_DLT20A}`.

**Clips.**
- Every committed humanoid-pack clip keys `Wep_Root` and the IK joints. Across the rifle clips (walk, run, aim, crouch run, stagger, hit), `Wep_Root` stays 0.10 m from `RightHand`, and the left hand is 0.21 m from a point 0.3 m up the barrel.
- The three stance packs are public in `site-assets` and not committed:
  - `clips-stance-t`, 481 KB: idle `L_HM_Stand_Combat_IdleLoop`, aim `P_HM_Rifle_StandIdle_01`.
  - `-p`, 496 KB: idle `L_HM_Pistol_DeployScreen_Idle_01`, aim `P_HM_Pistol_StandIdle_01`.
  - `-l`, 405 KB: idle `P_HM_Lmg_StandIdle_01`, with no aim and no crouch.
- On a snowtrooper with the E-11 under `stance.t.aim`, the muzzle is 1.38 m high. The sim's logical muzzle is at 1.40 m (eye 1.55 − 0.15).
- The weapon skeleton has only five `*WeaponAssemblerPose` clips, so there is no per-weapon trigger animation. The weapons are statues.

**What `WEAPON_FRAME` means.** It is the transform from a body's `Wep_Root` to the gun's frame. The data shows identity is correct: the weapon's own `Wep_Root` is the origin with no rotation, and the mesh, muzzle and flash offsets are all in that frame.

# 2. What the repo already has to reuse

- **`src/lib/three/walrusRig.js`:**
  - `:25 SOCKETS` (`weapon: 'Wep_Root'`, `muzzle: 'Wep_Muzzle'`).
  - `:39 WEAPON_FRAME`, the identity.
- **`src/lib/three/walrus.js`:**
  - `:47 PACK_DIR`.
  - `:48 packUrls(hero, {extras})`.
  - `:103 loadWalrusPacks(urls,{loader}) → Map`.
  - `:128 clipsFor(body, clips)`.
  - `:166 socketsOf(body)`.
  - `:170 loadWalrusBody(url,{packs}) → {model, clips, sockets}`. `figures.js:45` currently drops `sockets`.
- **Stance clips:**
  - `src/lib/three/walrusStance.js:18 stancePackUrl(key)`.
  - `src/lib/three/walrusSets/stance.js:18 STANCE_KEYS` and `:87 stanceClips(clips, key) → {baseName: clip}`.
- **`src/lib/three/gltfCache.js`:** `:33 loadGLTF(url)` and `:53 cloneScene(gltf)`.
- **Existing examples of a weapon in the socket:**
  - `src/components/universe/gunplay.js:1129-1134` puts a gun under the socket with `WEAPON_FRAME`.
  - `src/components/galaxy/surface/saber.js:151-167` hangs a game hilt GLB, the phase-1 precedent.
  - The Battlefront world may not import either: "worlds are islands", `docs/health/RULES.md`.
- **`scripts/bf2017-import.mjs`:** the `--keep-origin` path (`:374-376`) keeps the game frame. It creates a `grip` node at `Wep_Root` (origin), writes `public/models/galaxy/surface/<kind>.glb` and `.lod1.glb`, adds the catalogue row to `src/components/galaxy/surface/catalog/bf2017.js`, and adds the credit.
- **Sim side:**
  - `src/lib/battlefront/core.js:19 muzzleOf(s)` is the logical muzzle; keep it.
  - `src/lib/battlefront/bolts.js:26` gives each bolt `id`, `from`, `owner`, `travelled`.
  - `sim.js:466 view` only exposes `at`, `dir`, `colour`.
  - `sim.js:367` runs `release` and then `resolveBolts` in the same step, so a bolt is first seen 35 m out (80 m for the snipers).
- **`src/lib/three/held.js`** is the Meshy hand-grip layer and doesn't apply to socket figures. Reuse the name only under the world folder.

# 3. Implementation plan

**A. Data: `held.json`.** Write it with a small extractor rather than re-running lane 0's whole `weapons` chain.
- New `scripts/lib/bf2017-held.mjs` exports `heldRow(root, blueprintName) → { id, mesh, mesh_source, muzzle:[x,y,z], muzzle_source, flash:[x,y,z], flash_source, animSet, animSet_source, stance:'t'|'p'|'l', speed?, _missing }`. The `stance` mapping (wabsRif→t, wabsPstl→p, wabsLMG→l) is hand-labelled.
- New `scripts/bf2017-held.mjs` writes `src/data/bf2017/held.json` (`_from` and `rows` for the eight classes' weapons).
- Test first in `scripts/lib/bf2017-held.test.mjs`, on the committed A280C fixture plus a cut `WeaponSke01` fixture (`node scripts/bf2017-data.mjs fixture Characters/Rigs/Weapon/WeaponSke01 --cut root --root lab/assets/bf2017`). It should check:
  - the muzzle is rest + trans for index 41;
  - the flash comes from the all-zero-GUID modifier (A280C has two);
  - every number names its source.
- Add `'held'` to `FILES` in `src/data/bf2017/rulebook.test.js`.
- Commands:
  ```
  NODE_USE_ENV_PROXY=1 node scripts/bf2017-fetch.mjs data 'Characters/Rigs/Weapon/WeaponSke01' 'Gameplay/Equipment/{Rifles/E11,Rifles/A280,Pistols/DH17,Pistols/RK3,Heavy/DLT19,Heavy/RT97C,LongRange/DLT19X,LongRange/DLT20A}/*'
  node scripts/bf2017-held.mjs --root lab/assets/bf2017
  ```
  The records are already in `lab/`.

**B. Meshes.** I ran this for all eight to scratch; it works:
```
node scripts/bf2017-import.mjs gameplay/equipment/rifles/e11/e11_3p_mesh --kind e11 --as 'The E-11 blaster rifle' --keep-origin
```
Repeat with `a280` (`…/rifles/a280/a280_mesh3p_mesh`), `dh17`, `rk3`, `dlt19`, `rt97c`, `dlt19x`, `dlt20a` and their names from the table in section 1.

Light cuts as measured, with the grip at (0,0,0) and bounds unchanged:

| id | light cut (LOD, size) | plain cut |
|---|---|---|
| e11 | LOD1, 91 KB | 258 KB |
| a280 | LOD2, 97 KB | 282 KB |
| dh17 | LOD1, 254 KB | 875 KB |
| rk3 | LOD1, 76 KB | 203 KB |
| dlt19 | LOD1, 98 KB | 292 KB |
| rt97c | LOD2, 104 KB | 340 KB |
| dlt19x | LOD2, 131 KB | 428 KB |
| dlt20a | LOD2, 94 KB | 306 KB |

- Commit the eight `.lod1.glb` files.
- Publish the plain cuts with `node scripts/assets-publish.mjs --only 'models/galaxy/surface/{e11,a280,dh17,rk3,dlt19,rt97c,dlt19x,dlt20a}.glb'`, or commit them (about 3 MB).
- `--tex 512` would shrink the DH-17's 254 KB light cut.

**C. `src/components/battlefront/figures/held.js`, new.**
- `export const weaponUrl = (id) => \`/models/galaxy/surface/${id}.lod1.glb\``
- `export function heldOf(id, held = heldJson.rows) → { url, muzzle, flash, stance } | null` (pure).
- `export function createHeld({ load = loadGLTF } = {}) → { arm(fig, id) → Promise<Object3D|null>, muzzleOf(fig, out) → Vector3|null, disarm(fig), dispose() }`.
- `arm` clones the GLB, sets `WEAPON_FRAME` (scaled by `1 / socket world scale`, as gunplay does), adds it to `fig.sockets.weapon`, and adds a child `muzzle` Object3D at `row.muzzle`. It swaps weapons when the id changes and turns on cast shadows.
- Don't use the body's own `Wep_Muzzle` bone. It sits at the shared rest (0.28 m past the E-11's barrel end), and the pack's `look.around`, `look.ground` and `wave` clips key it.

**D. `figures.js`.**
- Keep `sockets` from `loadBody`, and call `held.arm(f, e.weapon)` once the body lands or `e.weapon` changes.
- Lay the class stance pack over `f.clips`: `loadWalrusPacks([stancePackUrl(key)])` → `clipsFor(model, got)` → `stanceClips(…, key)`, cached per key.
- Add `figure.muzzleOf(id, out)`.
- Extend `locomotion.js packClip(s, { stance })`:
  - idle → stance `idle`; without a stance pack, fall back to `aim.rifle`, or `aim.pistol` for p (both are in the committed pack);
  - aim → stance `aim`;
  - crouch and crouch.run → stance clips.
- **Facing:** if the browser check confirms the 90° turn, set `model.getObjectByName('AITrajectory').quaternion.set(0, -Math.SQRT1_2, 0, Math.SQRT1_2)` on each body. That is the clips' own constant `AITrajectory.quaternion` (read in `c_hm_rifle_walk_fwd_01`, `p_hm_rifle_standidle_01` and `l_luke_stand_unarmed_idle_01`).

**E. `battle.js view()`.**
- Add `e.weapon = s?.weapon?.id ?? null` alongside `e.vel` (line ~180).
- Enrich bolts from `b.sim.bolts.list[i]` (same order): `id`, `owner`, `from`, `travelled`, `speed`. This leaves `sim.js` untouched.

**F. `fx/bolts.js`.**
- Add `update(bolts, { muzzleOf, now })` plus a pure `drawnBolt(b, muzzle, age, { converge }) → { head, tail }`.
- The visual head starts at the owner's gun muzzle the first frame the bolt is seen, advances at `speed × age` along `dir`, and eases its sideways offset onto the sim's line within `converge` metres. The converge distance (about 15 m) is a hand number. The tail is clamped to the muzzle.
- Without a figure, it falls back to `from`.
- `module.js:175` becomes `bolts.update(v.bolts, { muzzleOf: figures.muzzleOf, now })`.

**Tests to write first** (each under a second, no network):
- `held.test.js`, on stand-in bones:
  - the weapon's parent is `Wep_Root` with `WEAPON_FRAME`;
  - the muzzle's world position equals `socket.localToWorld(row.muzzle)`;
  - a changed id swaps the weapon;
  - dispose detaches it.
- `held.glb.test.js`, reading the committed `.lod1` files:
  - each file is ≤ 300 KB with `grip` at the origin;
  - the muzzle z is within 0.09 m inside the bounding box's +z face (measured gaps are 0.001–0.085 m).
- `held.pose.test.js`, on `snowtrooper.lod1.glb` + `clips-humanoid.glb`, in the style of `walrusSocket.test.js`:
  - `aim.rifle`, walk and run hold `Wep_Root` within 0.15 m of `RightHand`;
  - the muzzle is 1.2–1.6 m high;
  - with the facing fix, the barrel is within 0.9 (dot product) of the facing at yaw 0, i.e. +Z.
- `locomotion.test.js`: the `packClip` stance mapping.
- `bolts` test: `drawnBolt` starts at the muzzle and is on the sim line past `converge`.

# 4. Risks and what wasn't found

1. **Facing (needs a browser check first).** Check with `window.__battlefront` that a walking bot's body faces where it moves. The packs drop `AITrajectory`'s −90°; nothing in `src` puts it back, so it may affect the galaxy's 2017 figures too.
2. **Unarmed idle.** If a stance pack fails to load, use `aim.rifle`/`aim.pistol` (static poses) as the idle rather than `idle`.
3. **Two muzzle sources differ for three weapons.** The bone position and the flash offset differ for the A280 (y +11 mm, z +8.5 mm), DH-17 (y −26 mm) and RK3 (y −55 mm). The game draws bolts from the bone, so use the bone for bolts and the flash offset for the flash.
4. **Alpha-cutout parts render solid.** The `SS_WeaponsPreset_Alpha` materials (E-11, DLT-19, RT-97C, DLT-20A) merge into the opaque one because the importer strips the colour map's alpha. Small sight or emitter parts may render solid; check a `glb-shot`.
5. **Pistols one-handed.** The pistol pack's clips hold the gun in one hand (left hand 1.2 m away), although the records say `AnimatedAimingTwoHanded`.
6. **No death drop yet.** Weapons stay in the hand through the death clips (`Wep_Root` keyed, 0.10 m from the hand). Dropping one belongs with the ragdoll work.
7. **Not found:** first-person meshes, weapon attachments, and per-weapon trigger or fire animations on `WeaponSke01`. Only five assembler poses exist.
8. **Stale comment.** The importer's `--keep-origin` comment (`bf2017-import.mjs:80-82`) says "barrel up +y"; blasters run along +z, and +y is the hilts.

Downloads went to `lab/assets/bf2017/` (gitignored), about 75 MB: the models manifest, the eight weapons' LODs and textures, 60 data records, three raw clips and four public packs.

Files are in /tmp/claude-0/-home-user-new-portfolio-website/6e998b99-030e-5906-90ac-5cbe2b0cc2ff/scratchpad:
- imp/out/surface/ — the eight trial imports, plain and light cuts
- imp/catalog.js
- pose.out, crew.out, face.out — probe output
- packs/ — the stance and npc packs

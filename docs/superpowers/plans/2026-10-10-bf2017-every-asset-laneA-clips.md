# Battlefront 2017, lane A: every clip, every skeleton. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, yourself, in order. Steps use checkbox (`- [ ]`) syntax for tracking. Build directly; one judge pass at most before the PR.

**Goal:** Every clip family on the humanoid skeleton and every skeleton the drop has (less cast-left B's, Y's and W's, and the sequel's) has a consumer on the site: weapon stances, additive aims and hit reactions, cover, awareness and spawn moves for the NPCs, emotes and end-of-round poses, the cinematics as a scene player, a first-person mode, the riders and crews, the cantina band, and the fauna and event rigs as own-rig kinds.

**Architecture:** The clip packs stay the unit (`bf2017-clips.mjs`, packs by set, loaded with the figure that needs them, never whole); `walrusClips.js` gains sets per family; `footScene`'s animator gains an additive layer and a stance; the NPC behaviours, the gun code, the end screen and the inside's `cinematics.js` consume by the site's names; the fauna are `OWN_RIGS` rows and `crewList.js` kinds as phase 2's.

**Tech Stack:** `scripts/bf2017-clips.mjs` + `scripts/lib/`, `src/lib/three/{walrusClips,walrusRig,walrus,ownRig,rigSets}.js`, `src/components/universe/footScene.js` (the animator), `surface/{actors,pools,crewList,boltPlay,riders,rides}.js`, the NPC intelligence's behaviour tables (`grep -rln "behaviour\|npcBrain" src/components/galaxy/surface | head`), `galaxy/BattleEnd.jsx`, `deathstar/inside/scene/cinematics.js`, `src/lib/three/camera/` (fidelity C, if merged; else the surface's camera call site), Vitest, `anim-check.mjs`, `rig-shot.mjs`.

**Spec:** `docs/superpowers/specs/2026-10-10-bf2017-every-asset-design.md` (§3 lane A).

## Global Constraints

- The rig rule: nothing retargeted, no bone renamed; a clip plays on the skeleton it was made for.
- Packs by set, under the site's names, `extras.source` the game's name; the humanoid pack stays under 3 MB (new families are their own packs: `clips-stance-<p|t|l>.glb`, `clips-npc.glb`, `clips-emotes.glb`, `clips-1p.glb`, `clips-<rig>.glb`); a pack loads with the first figure that asks for it.
- Cast-left B (`dewback`, `bantha`, `eopie`, `ronto`, `jawa`, `aiwha`, the tauntaun rider's `ride.tauntaun.*`), Y (`yoda_01_ske`, `generalgrievous_01_ske`) and W (`atat_destruction_*`, `atst_destruction_*`) are not touched: the owners table says so; `--census` marks them `owned`.
- The era rule: `dio_skel`, `crystalfox_01_ske`, `steelpecker_01_ske`, `bb8_ske`, `atm6_ske`, `radartechnician_ske`, `d_assault_newera*`, the `Jakku_*`, `A1_*` and `A3_*` campaign families whose level is sequel: out.
- Files under 800 lines (`walrusClips.js` is near it: new sets go in `walrusSets/<family>.js`, re-exported); British spelling and curly quotes; commits one plain sentence with the attribution lines.

## Review Focus

1. **A 2017 figure holding a weapon with no stance set** (a Meshy-rigged blaster kind): the humanoid set as today, never a missing clip (task 2's test on `stanceFor(weaponClass)` → `'humanoid'`).
2. **An additive aim on a figure whose pack lacks the additive** plays nothing and does not zero the base pose (task 3).
3. **A cinematics scene on a cast that lacks a member** (the scene names `han`, the room has none): the scene skips that track and plays the rest (task 6).
4. **First person on a phone or with the walker camera's seat**: refused, the camera stays third person (task 7).
5. **A fauna kind placed before its pack is built** (`sneep` in a site before `clips-sneep.glb` exists): the own-rig loader's refusal is caught and the kind is skipped with one line, as the pooled kinds do (task 8).

---

### Task 1: The census

- Modify: `scripts/bf2017-clips.mjs` (`--census`: rows by skeleton and by the humanoid's family prefix with counts, states `used` (a committed or published pack's `extras.source`), `owned` (B, Y, W, the sequel) or `unowned`, written to `docs/superpowers/evidence/bf2017-coverage/clips.md` and, when lane Z's ledger exists, merged into it by Z's `readConsumers`)
- Test: `scripts/bf2017-clips.test.mjs` (`familyOf('A_Luke_AttackLoop_Strike1')` → `'A'`; `('P_Stand_Idle_01')` → `'P'`; the owned rigs)
- [ ] Failing test → FAIL → implement; run → PASS. Commit `The clips' census by skeleton and family`.

### Task 2: Stances by weapon

- Create: `src/lib/three/walrusSets/stance.js` (`STANCE_SET(prefix)` for `P`, `T`, `L`: `idle`, `walk.*` eight ways, `run.*`, `sprint`, `aim`, `fire`, `reload`, `crouch.*`, under `stance.<p|t|l>.<name>`; `stanceFor(weaponClass) → 'p' | 't' | 'l' | 'humanoid'` from `catalog`'s weapon rows (`pistol` → p, `rifle`/`heavy` → t, `long`/`bowcaster` → l))
- Modify: `walrusClips.js` (re-export; `PACKS` rows for `clips-stance-{p,t,l}.glb`), `scripts/bf2017-clips.mjs` (`stance-p`, `stance-t`, `stance-l` packs), `surface/boltPlay.js` and the figure's `play` call site (a 2017 figure's base set is its stance's when it holds a weapon of that class), `src/components/galaxy/surface/playerBody.js` or the player's animator call (the player too)
- Test: `walrusSets/stance.test.js` (Review Focus 1), `boltPlay.test.js`
- [ ] Failing tests → FAIL → implement; build the three packs → PASS; `anim-check --route '#/galaxy/hoth/surface'` (no bind pose; drift under 0.15). Commit `A figure stands, walks and aims as the game does for the weapon it holds`.

### Task 3: Aims and hit reactions, additive

- Create: `walrusSets/additive.js` (`ADD_SET`: `aim.up/down/left/right` from `Add_*Aim*`, `hit.front/back/left/right` from `PAdd_*Hit*` and `Hit_*`, `lean.*`; `additiveFor(pitch, yaw) → { up, down, left, right }` weights)
- Modify: `footScene.js`'s animator (an additive layer: `mixer` actions with `blendMode: THREE.AdditiveAnimationBlendMode` on the pack's additive clips (`extras.additive`), weights from `additiveFor`; `react('hit', { side })` plays the side's reaction on the layer), `walrus.js`'s loader (`extras.additive` clips kept apart), `scripts/bf2017-clips.mjs` (`additive` pack from `anims_additive/walrus_humanmale`)
- Test: `footScene.walrus.test.js` (Review Focus 2), `walrusSets/additive.test.js`
- [ ] Failing tests → FAIL → implement → PASS; `anim-check`. Commit `Aims and hits as the game's additive layers`.

### Task 4: The NPCs' cover, awareness and spawn

- Create: `walrusSets/npc.js` (`NPC_SET`: `cover.low.idle/peek/fire`, `cover.high.*`, `aware.look/alert/relax`, `spawn.drop/run-in`, `loco.*` turns, `ai.rifle.*`, `officer.*`)
- Modify: the NPC behaviours' tables (each behaviour state names its clip: `cover` → `cover.*`, `alert` → `aware.alert`, `arrive` → `spawn.*`), `actors.js` (a figure with the set plays it; without, as today), `scripts/bf2017-clips.mjs` (`npc` pack), `src/data/bf2017/ai.json` (nothing: the game's lane 1 reads `NPC_SET` by the same names)
- Test: `walrusSets/npc.test.js`, the behaviours' test
- [ ] Failing tests → FAIL → implement → PASS; `anim-check` on Hoth's troopers at a cover spot (`__surfaceDo('cover')` dev hook if none exists). Commit `The game's cover, awareness and spawn moves for the worlds' soldiers`.

### Task 5: Emotes, victories, end of round, front end

- Create: `walrusSets/emotes.js` (`EMOTE_SET(hero)`: the hero's four emotes (`E_<Hero>_*`), `victory.*` (`EoR_*`), `frontend.idle` (`UI_FrontEnd_<Hero>_*`))
- Modify: `galaxy/BattleEnd.jsx` + its scene (the winning hero in `victory.*`, the loser in `defeat`), the surface's emote wheel (`surface/emotes.js` new: four keys, the wheel on `G` held; the figure plays the emote on its full layer), the loadout's stage (lane M's) plays `frontend.idle`, `scripts/bf2017-clips.mjs` (per hero: emotes into the hero's existing pack, under 1.6 MB each; `clips-eor.glb` shared)
- Test: `walrusSets/emotes.test.js`, `BattleEnd.test.jsx`, `emotes.test.js`
- [ ] Failing tests → FAIL → implement → PASS; shots. Commit `Emotes, victory poses and the hero's stage pose from the game`.

### Task 6: The cinematics as a scene player

- Create: `src/lib/three/scenePlayer.js` (`loadScene(id) → { tracks: { [kind]: clip }, camera?: keys }` from `public/models/galaxy/bf2017/scenes/<id>.glb` packed by `scripts/bf2017-clips.mjs --scene <id> --cast <kind=game clip,…>` from `CIN_*` and the NIS skeleton's clips; `playScene(scene, cast, { onEnd })` binds each track to the cast member by kind, a missing member skipped), the first two scenes: the Death Star inside's throne room (`cinematics.js`'s `SCENES.throne` or the nearest) on the NIS clips of Vader, Luke and Palpatine where the drop has them (`grep -i "palpatine\|throne\|vader" anims.jsonl` on the NIS skeleton: the ROTJ throne room is in the `UI_*`/`CIN_*` sets if at all; if none fits, the two scenes are the HvV intros (`UI_HvsV_Intro_*`) for the surface's duel start and `EoR_*` group poses)
- Modify: `deathstar/inside/scene/cinematics.js` (a scene with `clips: '<id>'` plays through `scenePlayer` for its acts; shots and swings unchanged), `surface/duel.js` or its call site (the HvV intro before a duel on high and ultra)
- Test: `scenePlayer.test.js` (Review Focus 3)
- [ ] Failing tests → FAIL → implement → PASS; a shot. Commit `The game's cinematic clips, played on the cast by scene`.

### Task 7: First person

- Create: `walrusSets/firstPerson.js` (`FP_SET` from `Walrus_HumanMale_1p`'s families: `idle`, `walk.*`, `run`, `sprint`, `aim`, `fire`, `reload`, `melee`, per weapon class as task 2), `src/lib/three/camera/firstPerson.js` (if fidelity C is on `main`: a pose in its set; else `surface/scene.js`'s camera call site gains `view: 'first'`: the camera at the `Head` bone's world position plus 0.08 m forward, the head's and hair's materials hidden, the body drawn; refused on phones and when seated)
- Modify: the settings panel or the key (`V` toggles third and first), `scripts/bf2017-clips.mjs` (`1p` pack)
- Test: `firstPerson.test.js` (Review Focus 4)
- [ ] Failing tests → FAIL → implement → PASS; a shot. Commit `A first-person view on the game's own first-person clips`.

### Task 8: Riders, crews, the band, the fauna and the event rigs

- Create: `walrusSets/vehicles.js` (`X34_*` the landspeeder's driver, `AT_*` the walker crews, `Bags`, `Deploy`, `Hand`, `WepPoseZoom`, `Suppressed`, the speeder bike `A_HM_SpeederBike_*`: sets by vehicle kind), `walrusSets/band.js` (`BandPlaying_*` on the Bith: `OWN_RIGS.bith` if the Bith has its own skeleton, else the humanoid set `band.*`), the fauna rigs in `OWN_RIGS`: `birdtheed`, `chicken`, `scurrier`, `tach`, `pelikki`, `runyip`, `pillioshrimp`, `felbird`, `felripper`, `sneep`, `stintarils`, `profogg`, `kullbee`, `prasterommlen`, `beldon`, `kaminoan` (with `trident`), `gamorrean`, `treadwell`, `gonk` (two idles), the Kamino and Theed event skeletons as `event.*` sets E0's tracks trigger
- Modify: `rides.js`/`riders.js` (the X-34's driver and the 74-Z's rider on their sets), `walkers.js` (the AT-AT's and AT-ST's crews where a seat exists), `crewList.js` (the fauna rows, `rig: 'own'`), `pools.js` and the sites' `life` rows by biome (Theed's birds, Mos Eisley's chickens and scurriers, Kashyyyk's tachs, Naboo's shores' pelikki, Bespin's beldons in the sky as a `path` row, Kamino's Kaminoan on its trident, Jabba's Gamorreans (E1's district when it lands, else Tatooine's palace zone), the treadwell in Echo Base), `scripts/bf2017-clips.mjs` (one pack a rig), the imports (`--rig --crew --full --join --no-walrus-check`)
- Test: `walrusClips.test.js` (each new rig's set has `idle`), `crewList.test.js`, `sites.test.js` (Review Focus 5), `rides.seat.test.js`
- [ ] Failing tests → FAIL → implement; import and pack each kind; publish → PASS; `rig-shot.mjs` sheets to `docs/superpowers/evidence/bf2017-clips/`; `anim-check` on Tatooine, Naboo, Kashyyyk, Kamino. Commit one per group: `The riders and crews on the game's clips`, `The cantina band plays`, `The galaxy's birds, beasts and droids from the game, on their own rigs`.

### Task 9: The hand-off and the PR

- [ ] `HANDOFF-bf2017.md`'s fifth-design table: A's rows, the census, the packs' sizes; `HANDOFF-npc-intelligence.md`: the behaviours' clip names; the ledger refreshed.
- [ ] `npm run lint`, `npm test`, `npx vite build`; merge `origin/main`; PR titled `Every clip the game has, played: stances, aims, cover, emotes, cinematics, first person, riders, the band and the fauna`.

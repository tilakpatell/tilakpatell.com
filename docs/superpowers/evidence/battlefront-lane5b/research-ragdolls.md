# Research: ragdolls (the Battlefront world's follow-up, 2026-10-10)

Ragdoll research report: soldiers falling as the game's ragdoll in the Battlefront world (Hoth). Research only: I changed no tracked files.

**Main findings**
- **No timing for the clip-to-ragdoll hand-off exists in the export.** The game drives it through animation-tree parameters (`RagdollBlendValue`, `RagdollBlendEarlyValue`, `RagdollOnBack`), and the animation-tree records hold only a stub in the export, so the hand-off delay has to be marked hand.
- **The trooper's corpse lasts 10 s in the game, not 4.5 s.** `StormTrooperShared` and `StormTrooperAI_Skirmish` (the Hoth kits' player and bot soldiers) both have `TimeForCorpse` 10.0 and `SkipDyingState` true. The 4.5 in `soldier.js` is the lightsaber hero's.
- **Every Hoth class weapon gives a 50 N·s hit impulse** (`WSBulletEntityData.ImpactImpulse`). On a 94 kg trooper that is about 0.53 m/s: the body mostly crumples rather than flies.
- **The game's joint limits are already in `ragdoll.json` but nothing reads them.**
- **The sim's kill event has no shot direction or hit point.** Those exist one call earlier, on the bolt-hit event inside `sim.js`, and are dropped.
- **`battle.js` never passes `mode` to `createSim`,** so dead soldiers are never removed and pile up for the whole match.

## 1. What the game files hold

Everything below was fetched into `lab/assets/bf2017/data/` (bucket path `data/<name>.json.gz`).

| File | Size (gzip / raw) |
|---|---|
| `Gameplay/Characters/StormTrooperShared` | 34,140 B / 249,777 B |
| `Gameplay/Characters/StormTrooperAI` | 40,821 B |
| `Gameplay/Characters/StormTrooperAI_Skirmish` | 39,001 B |
| `Gameplay/Characters/Heroes/Hero_Lightsaber` | 27,496 B |
| `Gameplay/Kits/MP/Assault/Kit_{L,D}_Assault_Orig_HO` | 2,227 B / 2,159 B |
| `gameplay_characters_stormtroopershared_humanmale_ragdoll` | 7,243 B / 59,641 B |
| `gameplay_characters_stormtrooperai_skirmish_humanmale_ragdoll` | 7,229 B / 59,668 B |
| `Gameplay/Characters/CharacterStateDeathUnlockGroup` | small |
| `Animations/WhitesharkAnimations/WhitesharkAnimations` | small |

**Which blueprint is which.** Each kit's `WSSoldierCustomizationKitAsset` names `Blueprint = Gameplay/Characters/StormTrooperShared` (the player) and `AIBlueprint = Gameplay/Characters/StormTrooperAI_Skirmish` (the bots).

**`WSSoldierHealthComponentData`, death fields by blueprint:**

| Blueprint | `TimeForCorpse` | `SkipDyingState` | `DyingMaxTimeInAir` | `RemainDyingInAir` |
|---|---|---|---|---|
| StormTrooperShared (#82) | 10.0 | true | 5.0 | false |
| StormTrooperAI_Skirmish (#74) | 10.0 | true | 10.0 | false |
| StormTrooperAI (#76) | 120.0 | true | 10.0 | false |
| Heroes/Hero_Lightsaber (#66) | 4.5 | false | 6.0 | true |

- The same component carries animation bindings by GUID only: `Binding.{DeathAnimationTriggered, DeathHitDirection, Dead, HitFront/Back/Left/Right, Explosion, HeadShot, OnGround}` and `SPDeathBinding.RagdollDeath`.
- The troopers skip the dying state and go straight to death; heroes have one.

**`WSEACharacterPhysicsComponentData` (StormTrooperShared #79), all values:**
- `MaxImpulse` 1000.0, `ImpulseLifetime` 10, `SettleMomentum` 1.0, `MinContactSpeed` 0.0, `HitState` 0.
- `DismembermentProbability` 20, `EnableDismemberment` false, `Realm` `Realm_Client`: the ragdoll is client-side only, so it belongs in the view layer, never in the sim.
- `RagdollBinding`: `RagdollBlendValue` (7655bbbd-…), `RagdollBlendEarlyValue` (c451c611-…), `RagdollOnBack` (6ba81b41-…); `RagdollBlendHipsValue` and `RagdollHasDismembered` are null GUIDs.
- Body index fields: Hips 1, Spine 2, LeftArm 3, LeftForeArm 4, LeftHand 5, Head 6, RightArm 7, RightForeArm 8, RightHand 9, LeftUpLeg 10, LeftLeg 11, LeftFoot 12, RightUpLeg 13, RightLeg 14, RightFoot 15.
- Other fields elsewhere in the blueprint: `PlayerEntryComponentData.AllowRagdollFromEntry` true; `SoldierEntityData.ImpulseReactionTime` 0.0.

**The ragdoll blueprint** (one `RagdollPhysicsComponentData`, 16 `RigidBodyData`, 14 `PhysicsRagdollConstraintData`, 14 motors, 15 initial stances, one root-control constraint):
- Body 0 is a fixed root controller with no collision.
- Bodies 1–15 use `RigidBodyCollisionLayer_RagdollLayer` and are dynamic.
- Restitution 0. `LinearVelocityDamping` and `AngularVelocityDamping` are 0.
- `DynamicFriction` / `StaticFriction`: 1.0 / 1.0 on the trunk and limbs; 0.2 / 0.5 on the hands and feet.
- `InternalCollisionDisabling` = `DisableConstrained`.
- Every motor has zero torque, spring and damping: the ragdoll is fully limp, with no powered pose.
- The bot's blueprint (AI_Skirmish) is identical to the player's.

**Joint limits (degrees: cone / twist ± / plane ±):**

| Joint | Cone | Twist | Plane |
|---|---|---|---|
| Hips→Spine | 35 | 25 | 35 |
| Hips→UpLeg | 60 | 25 | 30 |
| Spine→Arm | 43.1 | 45.9 | 43.1 |
| Spine→Head | 40 | 45 | 40 |
| Arm→ForeArm (elbow) | 53.7 | 0 | 0 |
| LeftForeArm→LeftHand | 30 | 20 | 25 |
| RightForeArm→RightHand | 19.24 | 13.3 | 18.46 |
| UpLeg→Leg (knee) | 33.2 | 10 | 0 |
| Leg→Foot | 15 | 10 | 15 |

- All joints have `AngularFriction` 10, `AngularStiffness` 1, `BreakThreshold` 200, `HasLimits` true.
- These are already in `src/data/bf2017/physics/ragdoll.json` as `bodies[].limits.{cone,twist,plane}` with their sources (the max values only; every min is the negative of the max here), but `rig2017` ignores them.

**Hit impulse.** Each weapon row's `damage.projectile` matches a `projectiles.json` row's `name`, which carries `impactImpulse` (`#WSBulletEntityData.ImpactImpulse`).
- All 8 Hoth classes' weapons (a280, rt97c, dh17, dlt20a, e11, dlt19, rk3, dlt19x) give **50**.
- The bowcaster rows (chewbacca, wookiewarrior) give 46. `bowv2` has no projectile.
- Across all bolt rows: 0 ×77, 50 ×144, 46 ×5, a few others.
- Blasts: `blast.impulse` (e.g. 500) and `shockImpulse` (200) for `lib/physics/blast.js`.

**Death clips** (`web/anims.jsonl`, 30 fps, no event or notify fields in the manifest; `physics_test_Ragdoll_StraightToGround` is the only clip named ragdoll):
- `A_HM_Death_Stand_{Front,Back,Left,Right}_Upperbody_BlasterFire_0x`: 1.57–2.37 s, skeleton Walrus_NIS_S0800. "Upperbody" suggests these are layered over the ragdoll in the game; that is inference, not data.
- The pack's `die.fwd` is `A_HM_Death_Stand_Front_Melee_02` (1.633 s) or `Run_Fwd_01` (1.3 s); `die.back` is `A_HM_Death_Stand_Back_Melee_02` (1.567 s) (`src/lib/three/walrusClips.js:124-125`).

**Not in the export:**
- The animation trees: `AntStateAsset` records are 400–485 B stubs, and the shared-bundle one is listed in `data.tsv` but missing from the bucket. So no blend curve, hand-off time, or ragdoll-on-back rule.
- `BodiesNamesHashes` (not decodable, as lane P2 also found).

## 2. What the repo already has (reuse it)

**`src/lib/three/ragdoll2017.js`**
- `ragdollOf(book, id)` → row with its bodies; a row with `bodiesOf` gets the shared bodies, a partial row gets the trooper's.
- `floorCollide(floorAt)` → `collide(p, r)`.
- `rig2017(bones, row, { collide, push, speed, velocity, gravity })` → `{ step(dt), settled, point(name), body, mass, kick([x,y,z] N·s) → taken, centre() }`. The impulse allowance (`maxImpulse` spent and restored over `impulseLifetime`) is at :79-96.
- There is no per-bone kick, and `limits` and `settleMomentum` are unused.

**`src/lib/three/ragdollPhysics.js`**
- `createBody(points, sticks, opts)` → `{ pos, prev, n, step, kick(i, v), push(v), settled }`.
- `rigRagdoll(bones, { …, table })` (:177).
- Internal constants: 1/60 s substeps, settles after 40 still steps or `LONGEST` 6 s.
- The point index map is private (`index`, :180); the returned object is at :319-336.

**Other library files**
- `src/lib/physics/boneCapsules.js`: `isGameSkeleton(bones)`, `capsulesOf`.
- `src/lib/physics/blast.js:51`: `applyBlast(..., { ragdolls: [{ centre, kick }] })` → `kicked`, ready for grenades later.

**The sim**
- `src/lib/battlefront/sim.js:302-315`: `downed(sim, target, by, part, why)` emits `{ type:'kill', by, target, part, why? }`, with no direction or hit point.
- `sim.js:337-350`: the bolt hit `e` has `e.at`, `e.dir` and `e.bolt.weapon` (from `bolts.js:60`), but the emitted `hit`/`kill` events drop them.
- `sim.js:396-400`: corpses are removed only when `sim.ga` is set.
- `src/lib/battlefront/soldier.js:32`: `TIME_FOR_CORPSE = 4.5`, used for dying→down at :130.
- Sim part names (`soldier.js:72-82`): `head, chest, hips, armL, armR, legL, legR`.

**The Battlefront world**
- `src/components/battlefront/battle.js:64`: `createSim(...)` is called without `mode`, so corpses are never removed and stay in view as `state: 'down'` forever.
- `battle.js:139-146`: kill events feed the kill log.
- `battle.js:175-182`: `view()` decorates the entities. They are recycled by index, so never keep a reference to one; copy what you need.
- `figures/figures.js:306-332`: `update(entities, dt, alpha)` sets position and yaw every frame and runs the mixer. Figures are dropped when they leave the view (:326-331). Death clips play once and clamp (:241).
- `figures/locomotion.js:124`: `stateFor` maps `dying`/`down` to `death`, with the side from `e.hitDir` (the bolt's travel). `deathFor` is at :147, `packClip` returns `die.fwd`/`die.back`.
- `map/level.js:95`: `heightAt(x, z)` is the floor (0 until loaded).
- `module.js:52-53, 174, 217-224`: where to create, update and dispose the ragdolls.

**Precedent on the galaxy surface**
- `src/components/galaxy/surface/ground/groundFigures.js:31, 109-128, 338-380`: `RAGDOLLS = 4` at most at once; settled bodies are not counted; then lie and sink. It still calls Meshy's `rigRagdoll`, not `rig2017`.
- That is another world, so its code can't be imported; copy the pattern.

## 3. Implementation plan

### A. Data: what the death code reads (no export needed)
- **New `scripts/bf2017-impulses.mjs`:** joins the committed `weapons.json` (`rows[id].damage.projectile`) to `projectiles.json` (`name`, `impactImpulse`) and writes `src/data/bf2017/physics/impulses.json` as `{ rows: { <weaponId>: { impulse, impulse_source: "<projectile>#WSBulletEntityData.ImpactImpulse" } } }` (about 3 KB). The page must not import the 397 KB `projectiles.json`. Run: `node scripts/bf2017-impulses.mjs`. `bowv2` has no projectile and is left out.
- **Add `src/data/bf2017/physics/death.json`** (or a `death` block on `soldier.json`) from the records read above:
  - `timeForCorpse`: 10 (StormTrooperShared#WSSoldierHealthComponentData.TimeForCorpse), the hero's 4.5, `skipDyingState`, `dyingMaxTimeInAir`.
  - `friction`: { body 1.0, extremity 0.2 } (#RigidBodyData.DynamicFriction).
  - Built by a small `ragdollDeathRow(asset)` added to `scripts/lib/bf2017-physics-rules.mjs`, run with `--root lab/assets/bf2017`. The records are already fetched; add `'Gameplay/Characters/StormTrooperAI_Skirmish'` with `node scripts/bf2017-fetch.mjs data ...` if missing.
- **`NOTES.md`: hand values with their reasons:**
  - `LEAD` 0.2 s: how much of the death clip plays before the ragdoll takes over (the animation trees aren't exported).
  - `RAGDOLLS` { high 6, mid 4, low 2 } and `RANGE` 60 m.
  - `CORPSES` 24: cap on lying bodies.
  - `LIE` and `SINK` after the corpse time.

### B. Library additions (tests first, beside each file)
1. **`ragdollPhysics.js`:** `rigRagdoll` also returns `indexOf(name) → i | -1` and `names` (additive).
   - Test: `indexOf('Hips') === 0`; an unknown name gives -1.
2. **`ragdoll2017.js`, two additions:**
   - `rag.kickAt(bone, impulse) → taken`: spends the same allowance as `kick`; gives that point `v = n·J/M` (CoM-correct for equal-mass Verlet points) and nothing else.
   - `rag.momentum() → Σ mᵢ|vᵢ|` (masses per body bone, velocity = (pos − prev)/(1/60)). Plus option `settle = row.settleMomentum`: `step` marks `body.settled` when `momentum() < settle` after `CALM`.
   - Tests:
     - `kickAt('Head', [50,0,0])` moves the head point more than the feet in one step.
     - Centre-of-mass speed ≈ 50/94 m/s (±25%) after 0.2 s with gravity 0.
     - `kick([1000,0,0])` then `kickAt` → 0.
     - It settles on a flat floor in under 6 s, with the Hips height ≥ its radius.
3. **Optional, phase 2: joint limits.** `limitSticks(row)` turns `limits.cone` into min-distance sticks (grandparent → child). This replaces `rigRagdoll`'s hand-picked ratios (head 0.85, leg 0.45, arm 0.3). I don't know what the cone axis is relative to the bind pose, so test the knee both ways before choosing:
   - Cone = half-range around the bind direction: knee bend up to 66.4°, hip→foot ratio ≈ 0.84.
   - Cone = maximum bend: ratio ≈ 0.95.

### C. Sim (lane 1's file: small, additive)
- **`sim.js`:** change `downed(sim, target, by, part, why = null, hit = null)` to spread `...(hit ? { dir: hit.dir, at: hit.at, weapon: hit.bolt.weapon?.id } : {})` into the kill event. At :350 call `downed(sim, target, e.bolt.owner, e.part, null, e)`. Add `dir` and `at` to the `hit` event at :348 too.
  - Test in `sim.test.js`: a bolt kill's event has a unit `dir` along the shot, a 3-number `at`, and `weapon === shooter.gun.row.id`. The out-of-bounds kill has no `dir`.
  - Existing tests use `toMatchObject`, so the additions are safe.

### D. `battle.js`
- `b.falls = new Map()`. On a `kill`: `b.falls.set(e.target, { t, dir: e.dir ?? null, at: e.at ?? null, part: e.part ?? null, weapon: e.weapon ?? null })`. On `deploy`, or when the entity has left `sim.entities`, delete it.
- In `view()`, for each entity: `e.fall = s.alive ? null : (b.falls.get(e.id) ?? null)` and `e.hitDir = e.fall?.dir ?? null`. The `null` reset matters because entity objects are recycled; `hitDir` makes `locomotion.deathFor` pick the right side's clip.
- Test in `battle.test.js`: after a forced kill, the victim's `view` entity has `fall.part` and `hitDir`, and living entities have `fall === null`.
- **Owner decision:** forward `mode` into `createSim` (it is currently ignored), and decide whether `soldier.js`'s `TIME_FOR_CORPSE` becomes the trooper's 10. That changes respawn pacing, which lanes 1 and 2 own.

### E. New `src/components/battlefront/figures/fall.js` (pure, no three) and `fall.test.js`
- `PART_BONES = { head:['Head'], chest:['Spine','LeftArm','RightArm'], hips:['Hips'], armL:['LeftArm','LeftForeArm','LeftHand'], armR:[…Right], legL:['LeftUpLeg','LeftLeg','LeftFoot'], legR:[…Right] }`
- `boneForHit(part, at, pointOf) → bone`: the nearest of the part's bones to `at`; Spine when there is no part.
- `impulseOf(weaponId, table) → { impulse, source }`: falls back to 50 from `blasterprojectile_default_rifle` (marked).
- `admit({ active, dist, max, range }) → bool`
- `expired({ since, lie, sink }) → 'lie' | 'sink' | 'gone'`
- Tests: the head part gives Head; `legL` with `at` low gives LeftFoot; `admit` refuses at `max` or beyond `range`; e11 gives 50.

### F. New `src/components/battlefront/figures/ragdolls.js` (three only, tested in Node)
```js
export const RAGDOLLS = { high: 6, mid: 4, low: 2 }; export const RANGE = 60; export const LEAD = 0.2; export const CORPSES = 24;
export function createRagdolls({ book, rowId = 'stormtroopershared', floorAt, max = 6, range = RANGE, lead = LEAD, impulses })
  → { fall(id, fig, { fall, vel, eye }) → bool, update(dt), has(id), settled(id), drop(id), count() → { active, settled }, dispose() }
```

**`fall`:**
- Refuse if the figure is not on the game skeleton (`isGameSkeleton`), or `admit` says no.
- Otherwise record `{ fig, t: 0, prevPoints, fall }`; the death clip keeps playing for `lead` seconds.
- Each frame, sample the world positions of the body bones, so their velocity at the hand-off is known.

**At `t ≥ lead`:**
- `fig.mixer.stopAllAction()`.
- `rig2017(bones, ragdollOf(book, rowId), { collide: floorCollide(floorAt), speed: 0, velocity: entity vel })`.
- Give each point the clip's velocity: `rag.body.kick(rag.indexOf(n), (p1 − p0)/dt)`.
- Then `rag.kickAt(boneForHit(...), dir × impulse)`.

**`update`:** steps the active ragdolls. When momentum < `settleMomentum` (1.0) or `settled` is set, the body is frozen (step does nothing) and stops counting toward `max`.

**`drop(id)`:** removes it when the sim removes the entity. Beyond `CORPSES`, evict the oldest settled body (needed while `battle.js` never removes corpses).

**Tests** (reuse the skeleton builder from `ragdoll2017.test.js`, moved to `src/lib/three/fixtures/gameSkeleton.js`):
- No ragdoll before `lead`, one after.
- The (max+1)th fall and a fall at 100 m are refused (clip only).
- On a flat floor, the hips rest above the floor and the pose is unchanged after settling.
- The hit bone moves first.
- `drop` frees it.

### G. Wiring
**`figures.js`:**
- `createFigures({ scene, loadBody, kinds, ragdolls = null })` and `update(entities, dt, alpha, eye = null)`.
- When `e.state` is `dying`/`down` and `f.model` exists and `!f.fell`: `f.fell = ragdolls?.fall(e.id, f, { fall: e.fall, vel: e.vel, eye }) ?? false`.
- If `ragdolls?.has(e.id)` and it has been handed off: skip position, yaw, `play` and `mixer.update`.
- On removal: `ragdolls?.drop(id)`.
- Collect bones with `model.traverse(o => o.isBone && (bones[o.name] ??= o))`.

**`module.js`:**
- After `createLevel`: `const ragdolls = createRagdolls({ book, floorAt: (x, z) => level.heightAt(x, z), max: RAGDOLLS[tier] ?? 4, impulses })`, passed to `createFigures`.
- Step: `figures.update(v.entities, dt, alpha, camera.position)` then `ragdolls.update(dt)`.
- Dispose it.
- `do('ragdolls') → ragdolls.count()` for `scripts/battlefront-check.mjs`.
- Lazy-import `ragdoll.json` (144 KB) or a trimmed `stormtroopershared`/`hero_lightsaber` slice, as the surface does for `bones.json`.

**Docs:** update the "no ragdoll (the death clip)" line in `docs/superpowers/HANDOFF-battlefront.md` and in spec line 354.

**Checks:** `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`, then the browser check.

## 4. Risks and gaps
- **Blend timing:** not in the export. `LEAD` and the per-bone hand-off velocities are hand values. Nothing in the clip manifest marks a ragdoll moment.
- **Corpse time:** the sim's 4.5 s is the hero's; the troopers' is 10 s. Without `mode`, nothing is ever removed. Until the owner decides, `drop` on leaving the view plus the `CORPSES` cap keeps memory bounded.
- **Joint limits:** the cone axis is unknown (the builder dropped the constraint frames), so the interpretation needs a test before limits replace the hand ratios. Elbows and knees are already one-way hinges.
- **Hit point:** the sim's `at` comes from its own simple capsules, not the drawn pose, hence restricting to the part's bones first. Out-of-bounds kills have no direction (fall with velocity only).
- **Impulse feel:** 50 N·s on 94 kg is a soft push. That is faithful to the data, but a falling clip plus a soft push may look tamer than people expect. Don't scale it without marking the change hand.
- **Floor only:** bodies can sink into buildings (the pack has no physics shapes yet), consistent with the current "ground only" rule.
- **Cost:** each active ragdoll walks every bone under Hips each frame (the walrus rig has extras like the `_Phys_` and `Wep_` bones); the `RAGDOLLS` cap keeps this bounded. Settled bodies cost nothing.
- **The bucket's `data` fetch hangs** on a glob with no folder: it lists the whole `data/` root. I fetched the two ragdoll blueprints with a direct-object script at `/tmp/claude-0/-home-user-new-portfolio-website/6e998b99-030e-5906-90ac-5cbe2b0cc2ff/scratchpad/scripts/one.mjs` (`NODE_USE_ENV_PROXY=1 node <that> lab/assets/bf2017 <name>…`).

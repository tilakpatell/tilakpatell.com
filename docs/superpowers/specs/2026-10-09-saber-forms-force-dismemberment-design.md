# Lightsaber forms, the look of a blade, a hilt in every hand, more of the Force, and dismemberment. The design

Date: 2026-10-09. Status: designed by an architecting session from the owner’s brief, for an Opus 5.5 implementation session running ultracode, in lanes, one pull request each, merged to `main` as checkpoints. The plan is `docs/superpowers/plans/2026-10-09-saber-forms-force-dismemberment.md`; the hand-off is `docs/superpowers/HANDOFF-saber-forms.md`; the decisions are `docs/decisions/2026-10-09-dismemberment-by-a-clipped-twin.md` and `docs/decisions/2026-10-09-forms-from-mirrored-clips.md`.

## What the owner asked

“Architect to make dual-bladed and other forms of lightsaber combat better. Also look if we can do dismemberment of NPCs and make it more realistic, and make the animations and the look of lightsabers amazing, and make sure all models are holding them correctly (a local session is working on improving finger rigging). Also add more Force powers and test if they work correctly and look cool.”

Five things, then: the forms (a staff and a pair that today swing a single sword’s clips), the look (a blade that never blooms, a flat trail, dust for every clash), the hold (one grip inferred from the right hand’s vertices and never checked on any model but Luke), the Force (push and pull, nothing else), and dismemberment (none anywhere). The combat revamp (`docs/superpowers/specs/2026-10-08-combat-revamp-design.md`, lanes A–E merged by #739 and #737) is the floor this stands on: strokes are clips with baked contact windows, a hit is the blade’s swept segment, duellists fence on the same module. This design does not reopen any of that.

## Where the site is today

Read from the code on `main` at 9f1e7d15 by seven readers in this session; every number below has its line in `HANDOFF-saber-forms.md`’s map.

**The forms are numbers on one set of clips.** `combatRules.js`’s `STANCES` (single, double, dual, heavy) share five sword clips at different speeds and damage; `strokeFor` has no stance branch; a duellist’s mind gets only the stance’s four clip names. The only stance-specific code is in `saber.js`: the staff clones the blade onto the pommel of a 0.28 m hilt (so the second hand sits 7 cm above the rear emitter), the pair clones the right hand’s hilt with a mirrored quaternion onto the left hand (not the left hand’s own measured frame), and the left hilt is held at a mirrored guard only between strokes: during a stroke the one-sword clip’s off-hand takes it wherever it goes. Both blades sweep and trail; only the main blade clashes, deflects, flickers and takes the contact-window correction. `sword.dash` is baked and never played; the chest twist the header promises is never called. No staff, pair, spear or katana motion exists in UAL1, UAL2 or Meshy’s set, and the text-to-motion spike’s licence excludes the EU and the UK from displaying its output (`docs/research/2026-10-08-motion-spike.md`).

**The blade is under the bloom.** On the surface the core is `#ffffff` (1.0) and the sleeve 0.6 × colour, under `post.js`’s threshold of 1.7, so nothing on a surface saber blooms; ignition is a linear y-scale over 0.11 s; only the sleeve’s opacity flickers, in lockstep across a pair; no light falls on the figure or the ground; the trail is a uniform-alpha strip with no speed gate; every clash, parry, deflect and push is `fx.sparks` in a colour. The Death Star’s inside has the rest already, pooled and tested: HDR core and glow over the threshold, `hum(t, seed)` per blade, eased ignition, a speed-gated edge-faded trail, clash kinds with their own flash and spark counts, push rings, a choke ring, lightning arcs, and `lamps()` for a pooled light. The surface’s sounds are one hum for every blade; `catch` is silent; duellists’ and peers’ sabers are silent.

**One grip, checked on Luke.** `gunplay.js` infers the grip frame from the right hand’s vertices; `GRIP_FIX` has one row (`built`); no Meshy model has a fix; the contact windows were measured on Luke’s fist; the recorded defect (`HANDOFF-combat.md:104`) is a blade that can point at the floor when the inference flips. Standing Jedi (Obi-Wan on Mustafar, a rigged crew model) get `heldBlade`’s floating hilt beside the hip with no hand on it. The rigging lane will add finger bones and a hand layer (`hands.js`: `hold(side, radius)`, `release(side)`); nothing here may build a second grip.

**The Force is a cone shove.** `FORCE = { push, pull }`; `power(slot)` in `scene.js` branches by kind; a cooldown is an absolute ready-at time; the jetpack is the only held ability and only on G; V has no release path; no clip plays on the player for any power; the HUD shows cooldowns only mid-fight; a duellist’s own Force is a timed push with no cone and no cast. The Death Star’s `rules/force.js` has a tested channel model (choke and lightning held, one at a time, a cooldown each, a mind trick, a noise) tied to its own guard constants.

**Nobody loses a limb.** A body is one capsule; a blade hit yields a point on the blade and the target; death is a `die.*` clip or a tip about the feet; quest figures never ragdoll (ground soldiers do, four at once, on the high tier within 40 m, and the saber never sweeps them). Every galaxy humanoid is one mesh node with one 24-joint skin in one to six primitives by material, under meshopt compression; the geometry is shared by every clone, and armed figures draw `grip.js`’s curl geometry whose index is the source’s. Dominant-joint skinning is ragged on torsos and thighs (41 % of Luke’s body vertices carry three or more bones) and clean at the neck, wrist and forearm.

## The problems, most visible first

1. A staff and a pair do not move like a staff and a pair.
2. A blade that does not glow, light its wielder, or ignite with any ceremony; a clash that looks like a bolt impact.
3. No evidence that any model but Luke holds the hilt right; standing Jedi hold nothing.
4. Two Force powers, both a shove; nothing held, nothing that chains, nothing a Sith would do.
5. A lethal stroke plays the same fall as a blaster bolt.

## Decisions

Made for the owner, who asked for this to be designed without checking in; each the choice a careful colleague would make. The long versions are the two decision entries.

- **Forms come from the library’s clips, mirrored and layered, not from new motion capture.** `scripts/ual-bake.mjs` gains a `--mirror` bake: a sword clip with its arm and shoulder tracks reflected across the figure’s sagittal plane (left for right, each turn mirrored), written as `sword.mirror.<name>` with its own contact window measured on the left fist. A pair alternates right and mirrored strokes, so the left blade cuts; a cross-cut plays a stroke on the right arm and its mirror on the left at once. A staff adds a **hilt overlay**: inside a stroke’s contact window the hilt is turned in the hand about the forearm’s axis by a planned angle (a spin is 2π over the window), so both blades sweep and the body still plays the clip. No HY-Motion output ships (its licence); the pipeline stays for a licence that fits.
- **The look is one pooled module, lifted from the Death Star.** `src/lib/three/combat/saberFx.js` (world-agnostic, constructible in Node, pooled, warmed) draws every blade’s core and two-radius glow sprites in HDR, its hum flicker per blade, its eased ignition, its speed-gated trail, clash flashes by kind, hot-to-cool sparks, push rings, the choke ring and lightning arcs, and hands back `lamps()` for two pooled lights the scene makes at build. `trail.js` keeps its name and API. The hilt is still `gunplay.js`’s procedural one until gen3d hilts land; `dress()` learns to stretch the grip for a staff and to draw `ribbed` and `sleeve`. The surface declares its look (`look.js`’s `LOOK` with `why.bloom`).
- **The hold is measured, then fixed, then handed to the hand layer.** A sheet (`scripts/saber-sheet.mjs` over `scripts/preview/heroes.html` with new `stance=` and `who=` params) shoots every saber holder at carry, guard, swing and block with the metrics the page already computes (the blade’s axis against the hand’s, the left hand’s miss in centimetres); `GRIP_FIX` gains a row per model that fails; the pair’s left hilt uses the left hand’s own measured frame (`createGunplay` exposes `gripFor('L')`); a rigged standing Jedi gets `bladeInHand` at a still guard. When `fig.hands?.has` is true (the rigging lane’s Phase 1), `saber.js` and `heldBlade.js` call `hold('R' | 'L', hiltRadius)` and `release` on a throw, through one small adapter, and leave `gunplay.js`’s curl block alone.
- **The Force is a pure channel model, four new powers on the player and two on the Sith.** `src/lib/combat/force.js` carries the Death Star’s channel core (`createForce`, `canUse`, `useForce`, `forceStep`, `stopForce`) with the guard and facing injected, and the powers: `push`, `pull` (now also a disarm: a shooter in the cone drops its gun for 3 s), `lightning` (held; chains to two more targets within 4 m hops; drains a blocking duellist’s guard before its health), `grip` (held; lifts one locked target 1.2 m for up to 2 s, then throws it along the look), `leap` (a Force jump at 2.2 × the walk’s jump; a stroke pressed in the air is `sword.aerial.a`, landing on a foe a ground pound), `speed` (4 s in which the world steps at 0.5 and the player at 1), `repulse` (the push with no cone), `trick` (the nearest two hostiles within 4 m stand down 8 s). A saber hero picks two from the panel; the pair is kept with the hero. Vader and Maul get `grip` and `push`; the Inquisitor `push` and `lightning`. The Death Star keeps its own `force.js` for now.
- **Dismemberment is a clipped twin, not a cut mesh.** A lethal stroke whose nearest bone segment is cuttable (the neck, a forearm, an upper arm, a shin) severs: the body keeps its death clip with a clipping plane through the cut bone on cloned materials; a second figure (`SkeletonUtils.clone`, every bone frozen at the cut frame except the cut subtree) wears the opposite plane and is the piece, its subtree posed by a two- or three-point Verlet body (`ragdollPhysics.createBody`) that lands and rests; both sides get a glowing cauterised disc in the blade’s colour that cools over 1.5 s. No blood, ever. Three severs at once at most, on the high tier within 40 m, else the plain death; a world Menu setting turns it off. The hilt follows a severed sword arm and goes out. The saber now sweeps the ground war’s soldiers too.
- **Duellists get the whole kit.** The mind’s stroke table carries `{ clip, heavy, dir, special }`; a new `evade` state plays `dodge.roll` or `backflip` with a safe window; a knock plays `hit.knock` then `stand.up`; two duellists take turns on the `melee` token; a Sith casts its Force with a clip and a tell.
- **Layers, sizes, words.** Pure rules in `src/lib/combat/`; three.js pieces in `src/lib/three/combat/`; world wiring beside `scene.js` in new files (`surfaceForce.js`, `surfaceSever.js`); `saber.js` sheds its stance geometry into `saberForms.js` so it stays under 800 lines. British spelling, curly quotes, comments that say why. No sequel trilogy.

## The pieces

### 1. `scripts/ual-bake.mjs --set sword-mirror`: mirrored strokes

`mirrorClip(clip, { names })` (pure, tested): for each bone pair in `MIRROR_PAIRS` (`LeftShoulder`/`RightShoulder`, `LeftArm`/`RightArm`, `LeftForeArm`/`RightForeArm`, `LeftHand`/`RightHand`, the legs likewise), swap the tracks and reflect each quaternion across the figure’s sagittal plane (x → −x: negate the y and z components in the figure’s frame, which `ualRetarget.js` knows as the rest); the spine, neck and head tracks are reflected in place; the root’s `dx` is negated. The set bakes `sword.light.a`–`d`, `sword.a`, `sword.b`, `sword.c`, `sword.heavy.a`–`d`, `sword.uppercut` as `sword.mirror.<name>` with extras `{ contact, root, rootHips, mirror: true }`. `contactWindow`’s `bladeRows` takes a `hand` (`RightHand` | `LeftHand`) and the `ahead` test is relaxed to the hand’s own forward (`tip.z > hand.z`), so a left-hand window is found on the left fist. `clipLibrary.js` registers the set; `clipLibrary.test.js`’s pinned list grows by the same names. The 13 files stay under 40 KB each.

### 2. `combatRules.js`: forms as data

`STANCES[id]` gains:

- `hilt: { length, hands: [0, LEFT_DOWN] }` (metres down the grip for each hand: single `[0, 0.09]`, staff `[0.12, −0.12]` on a 0.6 m grip, pair `[0]` a hand).
- `strokes[i] = { clip, speed, damage, hand: 'R' | 'L' | 'both', overlay?: { spin: radians over the window } }`; the pair alternates `R` and `L` (the `L` ones are `sword.mirror.*`); the staff’s third stroke carries `overlay: { spin: Math.PI }` and its fourth `{ spin: 2π }` (the full sweep).
- `special: { name, about, clip, hand, overlay?, cool, damage, breaks?, aoe?: { radius, stagger } }`: single **Lunge** (`sword.dash`, closes 4 m, breaks a guard), staff **Whirl** (`sword.a` with a 2π overlay, every capsule within reach once, 1 damage, stagger 0.8), pair **Cross** (`sword.heavy.a` on the right and `sword.mirror.heavy.a` on the left at once, 4 damage, breaks), heavy **Pound** (`sword.pound`, `aoe: { radius: 3, stagger: 1.5 }`).
- `aerial: 'sword.aerial.a'` on every stance (a stroke pressed while `!grounded`).
- `strokeFor(stance, { last, now, dir, heavy, combo, special, air })` returns `{ clip, speed, damage, hand, overlay, lunge, heavy, kind: 'combo' | 'heavy' | 'dir' | 'special' | 'aerial', i }`; `HEAVY` and `DIRS` stay global, the pair’s `dir` strokes alternate hands by `last.hand`.
- `SPECIAL_KEY` is Q (and a touch button, Special); a special has its own cooldown in `state.cool.special`.

`HeroPanel.jsx` shows the special’s name and blurb under the stance’s strokes. `STANCE_IDS` is unchanged, so stored heroes and the walk packet resolve as before; a special’s clip is named `sword.*` so it passes `protocol.js`’s `strokeOf`.

### 3. `saberForms.js` beside `saber.js`: the stance’s geometry and the overlay

`createForms(stance, gp, { blade, leftHand, dress })` → `{ blades, hilts, pose(dt, now, ctx), lay(clip, t, w, hand), overlay(sw, k), dispose }`:

- builds the staff’s long grip (`dress` stretches the grip drum to `hilt.length` and spaces the trims), the second blade on the pommel, the pair’s left hilt from `gp.gripFor('L')` (the left hand’s own frame, mirrored thumb), with **cloned materials per blade** so each flickers and colours on its own;
- places both hands by `hilt.hands` through `gp.holdLeft` for the staff and single, and holds the pair’s left hilt at `GUARD_DUAL` between strokes;
- `lay` lays a stroke’s arms from its clip on the hand the stroke names: a `R` stroke lays the right arm and shoulder and leaves the left at its guard (weight-blended, not the clip’s off-hand); an `L` stroke the reverse; `both` lays both from the two clips;
- `overlay(sw, k)` turns the hilt in the hand by `sw.overlay.spin × ease(k)` about the forearm’s axis inside the contact window, so the staff’s blades sweep round; the sweep reads the turned matrices as it does now.

`saber.js` keeps `createSaber`’s signature and its stroke machine; it calls `forms.lay` where it laid `ARMS`, `forms.overlay` after the lay, and `forms.pose` where `pose`/`poseLeft` were. Every blade (not only the main one) takes the contact-window correction on its own hand, deflects bolts (`guard()` returns one segment per lit blade) and clashes (`duellists.clashes` loops `blades`). `gp.twist(k)` is called with the stroke’s yaw × `TWO.twist` so the chest follows.

### 4. `src/lib/three/combat/saberFx.js`: the look

`createSaberFx(parent, { tier, bloom })` → `{ blade(id, colour) → handle, clash(at, kind, dir), ripple(at, dir), ring(at, on), arcs(from[], to, on), update(dt, camera), lamps(), warm(renderer, camera), live(), dispose() }`; a handle: `attach(group, { length, axis })`, `on(lit)`, `colour(hex)`, `speed(mps)`, `update(dt)`, `history()`, `release()`.

- **The blade**: an instanced capsule core and two glow sprites per blade (the Death Star’s `SPRITE_VERT`/`SPRITE_FRAG`, which stretch a camera-facing quad along the blade so an end-on blade is a round glow), HDR colours (`CORE` 4.2, `GLOW` 2.6, over the surface’s 1.7 threshold and the house’s 1); the hum (`1 + 0.035 sin 41t + 0.025 sin 67.3t + 0.015 sin 113.9t`, seeded per blade) on core, glow and lamp; ignition eased over 0.16 s and retraction over 0.22 s with `reach(k) = k(2 − k)` and a tip that stays round; a block raises the hum’s pitch and the glow by 15 %. With no bloom (`post.lite()`, the low tier) the sprites still read, which is why they exist.
- **The trail**: `trail.js`’s `createTrail` keeps its name; `sync(frames, on)` now writes per-vertex alpha from the frame’s age (`(1 − age / 0.14)²`) and the tip’s speed (`smoothstep(3, 12 m/s)`) and the fragment fades by `aEdge³` to the hilt line; a jump over 2 m resets it. A thrown blade keeps its trail and glow.
- **Clash kinds**: `block { sparks 14, flash 0.18 }`, `parry { 26, 0.28 }`, `break { 32, 0.32 }`, `hit { 6, 0.1 }`, `deflect { 8, 0.12, bolt colour }`, `sever { 40, 0.4, the blade’s colour }`; a flash is a white-hot sprite for 0.14 s; sparks are streaks from `HOT [4, 3.2, 2.2]` to `COOL [1.4, 0.35, 0.06]` with gravity and drag. A parry also calls `post.flare(1.6)` for 0.12 s.
- **Light**: two `PointLight`s made at scene build at intensity 0 (as `flare` is); each frame the two nearest lit blades’ `lamps()` (`intensity 7 × lit × hum`, distance 4.5, the blade’s colour) drive them. No light is added at runtime.
- **Rings and arcs** for the Force (piece 6): `ripple` sends three expanding rings; `ring` a tightening one at a throat; `arcs` redraws `arcPath` lightning eight times a second with a fade and a lamp.
- **Sounds** (`surface/sounds.js`): `saber('ignite' | 'off', { kind: 'jedi' | 'sith' })` through `sfx.saberRaw`’s two voices; `block` raises the hum; `catch`; `clash` by kind; `sever` (a hiss and a thud); a duellist’s and a peer’s saber get a sound hook with a distance gain. `lightning` (a crackle), `grip` (a low throb), `leap` and `speed` are new `combat` names.

The Death Star’s inside keeps its own `scene/saber.js` this lane; `docs/autopilot/backlog.md` gets a row to move it onto `saberFx.js` later.

### 5. The hold

- `scripts/preview/heroes.html` takes `stance=single|double|dual|heavy`, `who=<crew kind>` (through `crewFigure`, so Vader, Maul, Dooku, the Inquisitor, the clone, Obi-Wan, the three Jedi stand beside the heroes) and `view=hands` (closed on the right hand, as `gunplay.html` has); `body[data-metrics]` adds `bladeDot` (the hilt’s +y against the hand’s expected axis), `thumbSide` (which side of the fist the emitter is on) and `rightMissCm`.
- `scripts/saber-sheet.mjs` (Playwright, `CHROME=` Edge on Windows, Vite on 5188) shoots every holder at carry, guard, swing (`dir=up`), block and the stance’s special as one PNG per mode under `docs/superpowers/evidence/saber/hands-<mode>.png`, and writes `hands.json` with the metrics; it exits 1 when any `leftMissCm > 3`, `rightMissCm > 3` or `bladeDot < 0.9`.
- `GRIP_FIX` gains a row per model the sheet fails (`along`, `thumb`, `grip`), keyed by the `who` in use (hero id or NPC kind); the sheet after is the evidence.
- `createGunplay` exposes `gripFor(side) → { along, thumb, normal, mean, inv }` for the left hand; the pair’s left hilt is built from it.
- `actors.js` gives a standing figure with a `RightHand` bone `bladeInHand` at a still guard (`aim 0.75`, no mind); `heldBlade` stays for the unrigged catalogue Anakin.
- The hand layer: `saberHands(gp, fig)` → `{ hold(), release() }` in `saberForms.js`: when `fig.hands?.has`, `hold('R', r)` and `hold('L', r)` on the hilt’s radius (`GUNS.saber.fore.r`), `release` on a throw and `hold` on the catch; otherwise no-ops, and `grip.js`’s morph stays. `gunplay.js`’s curl block is not edited here (the rigging lane’s Task 6 owns it).

### 6. `src/lib/combat/force.js`: the Force, pure

`POWERS` by kind: `{ name, about, cool, range, cone, held?, s?, dps?, drain?, hops?, lift?, speed?, light?: bool }`:

| kind | numbers | what it does |
| --- | --- | --- |
| `push` | range 9, cone 0.75, force 11, lift 3.5, cool 9, damage 1 | as today |
| `pull` | range 14, cone 0.5, force 9, lift 2, cool 7 | as today, and a shooter in the cone drops its gun for 3 s (`disarm`) |
| `lightning` | range 12, cone 0.3, held 3 s, dps 6, drain 20, hops 2 within 4 m, cool 12 | held: damage a tick on the locked target and its chain; a blocking duellist takes the drain on its guard first; a trooper plays `electrocuted` |
| `grip` | range 10, cone 0.25, held 2 s, lift 1.2, dps 2, throw 9, cool 14 | held: the locked target rises and hangs (`t.held`); on release or at 2 s it is thrown along the look with `pushVelocity` at `throw` |
| `leap` | jump 2.2 × `WALK.jump`, cool 5 | `vy` set, `grounded` false; a stroke in the air is the stance’s `aerial`; landing within 2 m of a foe with a stroke held is the Pound’s `aoe` |
| `speed` | s 4, world 0.5, cool 18 | the world’s `dt` × 0.5 (activity, the ground war, bolts, duellists), the player’s × 1; the post’s FOV punch and a desaturate |
| `repulse` | range 6, cone π, force 9, lift 2.5, cool 11 | `push` with no cone |
| `trick` | range 4, most 2, s 8, cool 15 | the nearest two hostiles stand down (`t.tricked`): no shot, no stroke, a `?` mark, the head’s `search` |

`createForce({ powers })` → `{ cool, channel }`; `canUse(f, kind, now)`; `useForce(f, kind, caster, targets, { now, lock, look }) → events | null` (null spends nothing); `forceStep(f, caster, targets, dt, now) → events` (cools; runs a held `lightning` or `grip`; ends on release, range, death or time); `stopForce(f) → events`; `chain(from, targets, hops, within) → ids`; `facing(caster, t, cone)`. Events: `{ type: 'knock', id, v }`, `{ type: 'hit', id, damage, how }`, `{ type: 'drain', id, guard }`, `{ type: 'disarm', id, s }`, `{ type: 'lift', id, y }`, `{ type: 'throw', id, v }`, `{ type: 'leap', vy }`, `{ type: 'slow', k, s }`, `{ type: 'trick', ids, s }`, `{ type: 'end', kind }`. `FORCE` in `combatRules.js` becomes a re-export of `POWERS.push` and `POWERS.pull` so nothing else moves.

`abilityRules.js`’s `ABILITIES` gains a card per power (`force: true`, `side: 'light' | 'dark'`); `abilitiesOf(spec)` reads `spec.force` (two kinds) for a saber hero; `heroes.js`’s `readHero` keeps `force: [a, b]` under `tp-galaxy-hero`; `HeroPanel.jsx` shows a Force picker for a saber hero (light powers in the house colour, dark in `--hud-bad`); Luke and Ahsoka default to push and pull.

### 7. `surfaceForce.js` beside `scene.js`: the Force on the surface

`createSurfaceForce({ state, me, shootable, on, fx, saberFx, sounds, post, emit, reactYou })` → `{ press(slot), release(slot), step(dt), worldDt(dt), held() }`:

- `press` calls `useForce` with `state.lock` as the lock and the camera’s direction as the look; a held power stays in `state.channel = { kind, slot, t0 }` until `release` or the model ends it; both slots get a release path on keyboard (`keyup`) and touch (`pointerup`, `cancel`, `leave` on both buttons);
- events land through `on(t)`: `knock`, `hit` (billed on a 0.25 s timer so the flinch and the hit mark are not spammed), `stagger`, `disarm` (`t.gp.drop()` and `fx.toss`, the soldier’s `aim` false for `s`), `lift` (`t.held = { y, until }`: the step holds `holder.y` at `y`, skips gravity and the head, plays `lifted` on the figure; ground soldiers get the same through `groundScene.lift`), `throw` (`t.held` cleared, `knock` at `v`, `lifted.fall` then `lifted.land`), `trick` (`t.tricked = until`), `slow` (`state.slow = { k, until }`; `worldDt(dt)` is what the world’s steps take), `leap` (`p.st.vy`, `grounded`);
- the player plays `cast` (one hand) for push, pull, grip, trick; `cast.double` for lightning and repulse; `push` for the shove’s follow-through; on the upper layer through `reactYou('cast', { kind })` (a new `REACTIONS` row), the hilt lowered while casting;
- the look: `saberFx.ripple` for push and repulse, `saberFx.ring` at a gripped throat, `saberFx.arcs` from the casting hand to each chained target, `fx.sparks` in `#d8d0ff` for the rest, `post.flare` on a throw, `sounds.combat(kind)`;
- the HUD: `stepHud`’s `combat` event gains `channel: { kind, k }`; `GalaxySurface.jsx`’s powers list shows while a channel is on or a cooldown is under 3 s, and a held power draws its bar filling; `SurfaceView.jsx`’s two buttons show the cooldown wipe.

A duellist’s Force (`activity.js`’s `nextForce`) becomes `useForce` on a `createForce` of its own with the spawn’s `force: { kinds, every }`; it casts with a 0.5 s tell (`cast` on the upper layer, the blade lowered) that a dodge beats; its `grip` on you sets `state.held` (input frozen, the camera eased up, the throat ring, `lifted` on your figure) for up to 1.5 s, then throws you; its `lightning` drains your guard while you block and hurts you when you do not. `shooters()` emits `{ force: kind, events }` and `scene.js`’s consumer becomes `surfaceForce.theirs(events)`.

### 8. `src/lib/combat/limb.js` and `src/lib/three/combat/sever.js`: dismemberment

- `limb.js` (pure, tested): `CUTS = { Head: 'neck', LeftForeArm: 'wrist', RightForeArm: 'wrist', LeftArm: 'shoulder', RightArm: 'shoulder', LeftLeg: 'knee', RightLeg: 'knee' }`; `segmentsOf(bones, pairs)` → bone segments in world space from `AIM` pairs; `limbAt(at, segments)` → `{ bone, k, dist }` the nearest segment to the blade’s sweep point; `cutOf(hit, { limbAt, hp, damage, inWindow })` → `{ bone, kind, plane: { point, normal } } | null`: a stroke that kills, inside its contact window, whose nearest segment is in `CUTS` and within 0.35 m, cuts; the plane goes through the point at `k` along the bone, its normal the bone’s axis.
- `sever.js`: `severFigure({ model, bones, cut, colour, collide, materials }) → { step(dt), settled, piece, dispose }`: clones the body’s materials with a clipping plane (the `portalFx` pattern, `localClippingEnabled` is already on) through the cut, updated each frame from the bone’s `matrixWorld`; `SkeletonUtils.clone` of the figure as the piece, its materials with the opposite plane, every bone frozen except the cut subtree, which is posed from a `createBody` of two or three points (the bone, its child, the child’s end) with `collide` from the world; two additive discs on the plane (the body’s on the cut bone, the piece’s on its root) at the blade’s colour × 3 cooling to `#2a1a10` over 1.5 s; `settled` after the piece rests; `dispose` after the body’s own sink. A severed `RightForeArm` or `RightArm` takes `t.blade.gun` onto the piece and puts the blade out.
- `surfaceSever.js` beside `scene.js`: `createSurfaceSever({ tier, world, saberFx, sounds })` → `{ maybe(t, hit, stroke), step(dt), count, dispose }`: gated by `tier === 'high'`, within 40 m, `count < 3` and the Menu’s setting (`tp-sever`, default on); on a cut it calls `on(t).hit(t, damage, { how: 'sever', cut })`, `saberFx.clash(at, 'sever')`, `sounds.saber('sever')`, hit-stop 0.09, shake 0.3. `activity.hit` and `groundScene.hit` take `how: 'sever'` and `cut`, keep the `die.*` clip, and hand the figure to `severFigure` in `dying()`’s first frame; a pooled ground figure a sever has had takes the drop path (as a ragdoll does). `saber.update`’s `targets` on the surface become `[...activity.targets, ...groundWar.targets]`, so a trooper can be cut; `groundScene.parry` stays inert and `stagger` is honoured.

### 9. Duellists with the kit (`duel.js`, `duellists.js`, `activity.js`)

- `createDuellist({ …, kit: { strokes: [{ clip, heavy, dir, hand, overlay }], special, evade: ['dodge.roll', 'backflip'], force: { kinds, every } } })`; `duelStep` returns `stroke` as the kit row (not a name) and a new state `evade` (entered on a roll beaten by your stroke’s start when free: 25 % by default, `hostile.evade`), which returns `{ clip, safe: [0.1, 0.45] }` the wiring plays full-body; a capsule in its safe window is skipped by `blade.sweep` (`t.safeUntil`).
- `stepDuel` forwards `{ clip, heavy, dir, lunge }` to `t.blade.swing`; a heavy comes after two blocks in a row (the guard-breaker); the special on its own cooldown when you are at reach.
- Turn-taking: `stepDuel` claims the `melee` token before `attack`; a duellist without it circles.
- Reactions: `react.js` gains `stagger` (`hit.knock`), `knock` (`knockdown` then `stand.up`, `hold: true`), `cast` (`cast` | `cast.double`), `tricked` (`search` look); `activity.knock` plays `knock` and waits for `stand.up` before the mind resumes; `hostileBody`’s step carries `hurt` and `knock` so `locomotion.js`’s bends run.
- A Sith’s cast: `useForce` on the duellist’s own `createForce`; the tell is the `cast` clip’s first 0.5 s with the blade lowered; a dodge in the tell is safe.

### 10. Online

The walk packet’s `arms` keeps its six items; a stroke’s clip name still passes `strokeOf` (`sword.mirror.*`, `sword.dash`, `sword.pound` all match). A new `cast` action (`{ kind, at, to }`, rate-limited in `RATES`) lets a peer draw a cast’s arcs and rings; nothing a peer sees is decisive. NPC deaths and severs are not replicated (NPC state is not shared today); the handoff notes it.

## Data flow, one frame on a galaxy surface, with all of it on

input snapshot (keys, the look’s turn and buttons, the stick; Q the special, G and V pressed or held) → the camera → `aimPoint`, `assist`, `pickLock` → the player’s intent: move, stroke (clip, hand, overlay, special, aerial), block, press or release a power → `surfaceForce.press/step` (`useForce`, `forceStep`: events) → the world’s `dt` is `worldDt(dt)` (speed) → the animator plays the clip; `forms.lay` the arms by hand; `forms.overlay` the hilt; `saberHands.hold` → after the animator: every blade’s segment pushed; inside the window each blade sweeps the targets (activity’s and the ground war’s, minus the evading); `limb.cutOf` on a killing hit → `surfaceSever.maybe` → `severFigure` → `bolts.step` (solids, capsules, every lit blade) → hits, deflections, clashes by kind through `saberFx.clash` → hit-stop, shake, `post.flare`, sounds → `duelStep` with the kit for every duellist (evade, heavy, special, cast) → `saberFx.update` (hum, trails, sprites, arcs, lamps onto the two lights) → the HUD’s `combat` event (lock, guard, heat, powers, channel, special) → draw.

## Testing

- **Pure, beside the file**: `mirrorClip` (a right-arm raise becomes a left-arm raise; the root’s `dx` flips; the spine reflects in place); the stance table (every clip exists, every `L` stroke is a `sword.mirror.*`, every special has a cooldown); `limbAt` and `cutOf` (a point at the wrist picks the forearm; above the shoulder the upper arm; a non-lethal hit never cuts; outside the window never cuts); `force.js` (a cone; a chain of two within 4 m and not a third at 5 m; a held power that ends at `s`, on release and when the target dies; a grip’s lift and throw; a trick’s two nearest; a cooldown spent only when something happened); `duel.js` (evade enters on the roll and returns a safe window; the kit’s heavy after two blocks; the special on cooldown; no attack without the token).
- **Headless scenarios** (`saber.test.js`’s pattern, named `*.test.js` so `npm test` runs them): a pair’s second stroke hits a target on the left and not the right; a staff’s whirl hits a target behind; a cross hits once; `limb.cutOf` on a real rig picks the neck for an overhead and the shin for a rise; a `severFigure` over `meshyRig` (with a synthetic `SkinnedMesh`) makes two meshes with opposite planes and a piece that settles under a flat `collide`; `createSaberFx` on a bare `THREE.Scene` keeps its pool through a duel, hums within 0.88–1.12, lamps one lit blade and none dark; a lightning chain on three activity figures bills each once a tick; a grip lifts a duellist to 1.2 m and its mind is `stagger`; a tricked duellist strokes nothing for 8 s; a duellist with the kit evades a stroke and is not hit in its window.
- **Bake**: `scripts/ual-bake.test.mjs` covers the mirror set (byte-identical body on re-bake; a left-hand window inside the clip).
- **Browser proof** (`scripts/saber-check.mjs`, Edge headless on Windows, Vite on 5188): on Dagobah’s vision, Naboo’s Maul and Lothal’s Inquisitor, and on a Kashyyyk ground war: ignition, a stroke, a block with a deflected bolt, a clash, each special, each power, a sever; one PNG a moment under `docs/superpowers/evidence/saber/`, each named in the PR, each looked at. `scripts/saber-sheet.mjs` for the hands. `node scripts/anim-check.mjs` on the vision’s fight before and after, the number reported (the 0.15 m/s bar fails on `main` already).
- **Checked by hand** and said so in the handoff: a mouse, a trackpad, a phone; the Menu’s Dismemberment setting.

## Done when

- A pair cuts with both blades, alternating; a staff whirls and both blades hit; each stance has a special on Q; a stroke in the air is an aerial.
- A lit blade glows through the bloom and without it, hums out of step from its partner, ignites and retracts with ease, lights the figure and the ground near it, trails only when it moves fast, and every clash, parry, deflect and sever has its own flash.
- The hands sheet shows every saber holder (ten models, four stances) with the blade out of the thumb side and both hands on the hilt within 3 cm; the standing Jedi hold theirs; the hand layer is called when it exists.
- A saber hero picks two of eight Force powers; lightning chains and drains a guard; a grip lifts and throws; a leap lands a pound; speed slows the world; a Sith grips you and you dodge its tell.
- A lethal stroke at a neck, a wrist, a shoulder or a knee severs on the high tier, cleanly, with a cauterised glow and no blood, capped at three, off by a setting; a trooper can be cut.
- Duellists evade, go heavy, use their special, take turns, get knocked down and get up.
- `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build` green; `scene.js`, `activity.js`, `saber.js` no longer than before this lane plus their additive wiring lines; every new module under 800 lines with its test beside it; no budget raised without a sentence saying why.

## What this is not

- Not a re-rig, not new finger bones, not a second grip: the rigging lane owns the hands; this lane calls `hold` and `release` when they exist.
- Not new motion capture: nothing from HY-Motion ships; a licence that fits reopens it.
- Not the Death Star’s inside: its saber and Force stay on their own modules until a later lane moves them onto `saberFx.js` and `force.js`.
- Not multiplayer NPC state: a peer never sees your severs or kills.
- Not gore: no blood, no viscera; a cut is cauterised and the body is whole but for the piece.
- Not the universe on foot: it carries no saber.

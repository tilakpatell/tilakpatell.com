# Lightsaber forms, the look, the hold, the Force and dismemberment. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, in the current session. Steps use checkbox (`- [ ]`) syntax for tracking. One lane per branch and pull request; the hand-off says which lane is yours.

**Goal:** A staff and a pair that move like a staff and a pair, each stance with a special; a blade that glows, hums, ignites, lights its wielder and trails by speed, with a flash for every kind of clash; a hilt measured in every hand and the hand layer called when it exists; eight Force powers, four of them new on the player and two on the Sith; a lethal stroke that severs at a neck, wrist, shoulder or knee as a cauterised clipped twin; duellists that evade, go heavy, take turns and get up.

**Architecture:** Pure rules in `src/lib/combat/` (`force.js`, `limb.js`, the stance table in `galaxy/surface/combatRules.js`); three.js pieces in `src/lib/three/combat/` (`saberFx.js`, `sever.js`, `trail.js` grown); world wiring beside `scene.js` in new files (`saberForms.js` beside `saber.js`, `surfaceForce.js`, `surfaceSever.js`); an offline bake (`scripts/ual-bake.mjs --set sword-mirror`); two scripts for evidence (`scripts/saber-sheet.mjs`, `scripts/saber-check.mjs`). `scene.js`, `activity.js` and `saber.js` take additive lines only.

**Tech stack:** three.js r186 (SkeletonUtils, clipping planes, InstancedMesh, ShaderMaterial), vitest in Node with the real clips off disk, `@gltf-transform` and `meshoptimizer` for the bake, Playwright on headless Edge (`CHROME=` on Windows), Vite on 5188.

**Spec:** `docs/superpowers/specs/2026-10-09-saber-forms-force-dismemberment-design.md`. **Hand-off:** `docs/superpowers/HANDOFF-saber-forms.md`.

## Global constraints

- Layers (`docs/health/RULES.md`): `src/lib` imports no React and no world; `src/lib/three` knows three.js and no world; a world imports another only through its `index.js`. Files under 800 lines; `scene.js` (3,623), `activity.js` (976) and `saber.js` (604) grow only by additive wiring lines; new code goes in new files with a header that says so (`surfaceLook.js`’s pattern).
- Tests beside the file; a test under a second; `*.scenario.test.js` under `galaxy/surface/` runs in neither `npm test` nor `npm run test:ai`, so name scenarios `*.test.js`.
- No paid service, no key printed; no HY-Motion output shipped; no sequel trilogy; no blood.
- The rigging lane (`docs/superpowers/HANDOFF-npc-player-rigging.md`) edits `gunplay.js`’s curl block, `animator.js`, `locomotion.js` and the figure GLBs. This lane edits `gunplay.js` only for `GRIP_FIX` rows and `gripFor(side)`; it never adds a grip; `fig.hands` is read with optional chaining.
- PR #579 (NPC architecture) edits `clipLibrary.js`’s `retarget()` and `HANDOFF-npc-intelligence.md`: add `CLIPS` rows, never touch `retarget`.
- Every lane: `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`; the lane’s check script and its PNGs under `docs/superpowers/evidence/saber/`; merge `origin/main` before opening and before merging; never rebase, never force-push, never merge red.
- Commits end with the harness’s attribution lines; no model names in code, docs or commits. British spelling, curly quotes; comments say why. Keep output terse.

## Review focus

1. A mirrored clip whose quaternions are reflected in the wrong frame plays an arm through the chest: Task 2’s test checks a raised right arm becomes a raised left arm on the fixture and the hands never cross the sagittal plane at rest.
2. A second blade’s sweep, deflect and clash all read the same matrices after the overlay: Task 5’s scenario asserts a whirl hits behind and a bolt from behind is turned by the rear blade.
3. HDR colours under `post.lite()`: Task 8 renders `saberFx` with `bloom: false` and asserts the glow sprites are visible and the core colour is clamped in the sprite shader, not black or blown out.
4. A held power that outlives its target or its caster’s death leaves `state.channel` set and the HUD filling forever: Task 14’s tests end the channel on death, range and release, and Task 15 clears it on your death and on phase change.
5. A sever on shared geometry or shared materials cuts every clone: Task 18 asserts the twin and the body use cloned materials, the template’s material has no `clippingPlanes`, and a second figure of the same model is unclipped.
6. A pooled ground figure a sever has had must take the drop path: Task 19’s test shelves nothing with a `sever`.

---

## Lane 0: the tools and the hilts (branch `claude/saber-0-tools`)

### Task 1: the hands sheet and the surface check

**Files:**
- Modify: `scripts/preview/heroes.html` (query params `stance`, `who`, `view=hands`; metrics `bladeDot`, `thumbSide`, `rightMissCm`)
- Create: `scripts/saber-sheet.mjs`, `scripts/saber-sheet.test.mjs` (the pure parts: the roster, the thresholds, the JSON row shape)
- Create: `scripts/saber-check.mjs` (the prelude from `scripts/surface-shot.mjs:17-75`; moments as a table `{ name, route, setup: [__surfaceDo calls], act, wait }`)
- Create: `docs/superpowers/evidence/saber/README.md` (what each PNG shows, how it was made)

**Interfaces:**
- `heroes.html`: `?stance=single|double|dual|heavy` applied to every placed hero (`heroSpec(readHero({ id, stance }))`); `?who=vader,maul,dooku,inquisitor,clone,obiwan,jedi,jedi2,jedi3` places crew figures through `crewFigure` with a `bladeInHand` at `GUARD_AIM`; `?view=hands` as `gunplay.html`’s; `body[data-metrics]` rows gain `{ bladeDot, thumbSide: 'thumb' | 'pinky', rightMissCm }`.
- `saber-sheet.mjs`: `ROSTER = { heroes: ['luke', 'ahsoka'], who: [...], stances: [...] }`; `MODES = ['carry', 'guard', 'swing', 'block', 'special']`; `LIMITS = { miss: 3, bladeDot: 0.9 }`; `judge(rows, LIMITS) → { ok, failed: [row] }` (pure, tested); CLI `node scripts/saber-sheet.mjs [--out docs/superpowers/evidence/saber] [--only luke,vader] [--mode guard]` → `hands-<mode>.png`, `hands.json`; exit 1 when `judge` fails.
- `saber-check.mjs`: `MOMENTS` (ignite, stroke, block-deflect, clash, special, power-<kind>, sever) each `{ route, hero, setup, act, settle }`; CLI `node scripts/saber-check.mjs [--only ignite,sever] [--out …]` → `check-<moment>.png`; it reads `__surface()` after each moment and writes `check.json` with what it saw (lit, swinging, lock hp before and after, severs).

- [ ] **Step 1: Write the failing tests** for `judge` (a row over 3 cm fails, one at 2.9 passes, a `bladeDot` of 0.85 fails) and for the moments table (every moment names a route under `#/galaxy/`).
- [ ] **Step 2: Run**; expect FAIL. **Step 3: Implement** the page params, the two scripts, the README. **Step 4: Run** the tests; then `node scripts/saber-sheet.mjs --mode guard` against `main`: save its output as `hands-guard-before.png` and `hands-before.json`. **Step 5: Commit.**

### Task 2: the hilts from the desktop

**Files:**
- Create: `docs/gen3d/saber/README.md` (the five hilts: Luke’s ROTJ, Vader’s, Maul’s staff, Ahsoka’s pair, Dooku’s curved; reference pictures the owner provides or public stills noted by URL; faces 6000, tex 1024; named points `grip` and `muzzle`, the hilt’s +y along the grip)

- [ ] **Step 1**: open one issue per hilt labelled `gen3d` (`node scripts/desktop/ask.mjs gen3d <name> --prompt …` or the issue form), bodies as `scripts/gen3d/README.md` asks, each asking for the named points. **Step 2**: note the issue numbers in the handoff’s hilt row. No code waits on them: Lane A’s `dress()` keeps the procedural hilt and a `hilt.model` field (Lane A, Task 9) takes a GLB when one lands.

---

## Lane A: the look (branch `claude/saber-a-look`)

### Task 3: `src/lib/three/combat/saberFx.js`, the pool

**Files:**
- Create: `src/lib/three/combat/saberFx.js`, `src/lib/three/combat/saberFx.test.js`
- Reference: `src/components/deathstar/inside/scene/saber.js` (the shaders, `hum`, `trailLevel`, `arcPath`, `CLASHES`, pooling, `warm`)

**Interfaces:**
- `createSaberFx(parent, { tier = 'high', bloom = true, pools = POOLS[tier] }) → { blade(id, colour) → handle, clash(at, kind, dir?), ripple(at, dir), ring(at, on), arcs(from, to, on), update(dt, camera), lamps() → [{ x, y, z, color, intensity, distance }], warm(renderer, camera), live(), dispose() }`
- handle: `attach(group, { length = 1, axis = [0, 1, 0], base = 0.16 })`, `on(lit)`, `colour(hex)`, `speed(mps)`, `block(on)`, `update(dt)`, `k` (0…1 lit), `release()`
- `CLASHES = { block, parry, break, hit, deflect, sever }` as the spec’s numbers; `hum(t, seed)`; `trailLevel(age, speed)`; `arcPath(...)` (moved from the Death Star’s file and re-exported there, so its tests keep passing); `BLADE = { on: 0.16, off: 0.22, core: 0.013, inner: 0.045, outer: 0.15 }`; `CORE = 4.2`, `GLOW = 2.6`; `POOLS`.

- [ ] **Step 1: Write the failing tests**: pool inventory unchanged through ten blades, three clashes and an arc; `hum` within 0.88–1.12 and never still; a lit blade lamps once in its colour above the hilt, a dark one not; `clash('parry')` makes more sparks than `clash('block')` and all are gone by 1.2 s; `bloom: false` leaves the glow sprites’ material in place with its colours clamped under 1.5 (the shader’s `uClamp`); `blade().on(true)` reaches `k = 1` by 0.2 s with `k(2 − k)` ease (0.75 at half); `block(true)` raises the glow by 15 %.
- [ ] **Step 2: Run**; FAIL. **Step 3: Implement** by lifting the Death Star’s sprite and trail shaders (import nothing from `src/components`); the Death Star’s file imports `arcPath`, `hum`, `trailLevel` back from here. **Step 4: Run** both test files and `npm test` for the Death Star’s suite. **Step 5: Commit.**

### Task 4: the trail by speed and age

**Files:**
- Modify: `src/lib/three/combat/trail.js`, `trail.test.js`

**Interfaces:**
- `createTrail(parent, { color, length = 14, life = 0.14, slow = 3, fast = 12, jump = 2 })` → the same `{ mesh, sync(frames, on), color(c), dispose() }`; `sync` writes `aAlpha` per vertex from `trailLevel(age, speed)` and the fragment fades by `aEdge³`; a frame whose tip moved over `jump` from the last clears the strip.

- [ ] **Step 1: Tests**: a slow set of frames (tip 1 m/s) yields alpha 0 everywhere; a fast one (14 m/s) full at the newest and under 0.1 at the oldest; a jump clears. **Step 2–5** as above.

### Task 5: the blade on the surface

**Files:**
- Modify: `src/components/galaxy/surface/saber.js` (the blade’s core/sleeve/tip hidden; `saberFx.blade` attached per blade; `speed` fed from the blade’s history; `block` on the block; ignition through the handle; the thrown hilt keeps its handle)
- Modify: `src/components/universe/gunplay.js` (`GUNS.saber.build`: the blade group stays for the sweep’s `muzzle` and for worlds with no `saberFx`; a `blade.userData.plain = true` flag so `saber.js` hides it when a handle is attached)
- Modify: `src/components/galaxy/surface/scene.js` (additive: `const saberFx = createSaberFx(scene, { tier, bloom: post.on })` after `fx`; two `PointLight`s at intensity 0 beside `flare`; `saberFx.update(dt, camera)` and the two lights driven from `lamps()` in the frame; `post.flare(1.6)` for 0.12 s on a parry; `saberFx.clash(at, kind)` where `fx.sparks` was called for a blade hit, a clash, a block, a parry, a deflect; `saberFx` passed into `createSaber` and `bladeInHand` as `fx`)
- Modify: `src/components/galaxy/surface/heldBlade.js` (`fx` through to `createSaber`), `peers.js` (`fx` for a peer’s blade)
- Modify: `src/components/galaxy/surface/look.js` (`LOOK` with `why.bloom`), `src/components/worlds/looks.test.js` (drop the surface’s exemption)
- Modify: `src/components/galaxy/surface/sounds.js` (`saber('ignite' | 'off', { kind })` through `sfx.saberRaw`; `block`, `catch`, `clash` by kind, `sever`; a `{ at }` gain by distance), `scene.js`’s sound router (one call, not two)

**Interfaces:**
- `createSaber(gp, { …, fx = null })`: with `fx`, each blade gets `fx.blade(id, colour)` attached to its blade group with the hilt’s length; `light(on)` calls `handle.on`; `update` calls `handle.speed(tipSpeed)` and `handle.block(blocking)`; the plain meshes are hidden. Without `fx` nothing changes (the tests and other worlds).
- `sounds.saber(what, { kind = 'jedi', at = null })`; `sounds.combat(what, { at })`.

- [ ] **Step 1: Tests** in `saber.test.js`: with a fake `fx` (a recorder), `light(true)` calls `on(true)` on every blade handle (two for a staff), a stroke reports a speed over 3 m/s inside its window, a throw keeps the handle attached. **Step 2–4.** Then `node scripts/saber-check.mjs --only ignite,stroke,block-deflect,clash` and look at the PNGs; `node scripts/autopilot-check.mjs --routes /galaxy/tatooine/surface --quality low` before and after. **Step 5: Commit** with the before/after shots named.

### Task 6: the hilt’s dress and the hilt model slot

**Files:**
- Modify: `src/components/galaxy/surface/saber.js` → the `dress` part moves to `src/components/galaxy/surface/saberDress.js` (`dress(gun, color, hilt)` re-exported from `saber.js` under the same name)
- Modify: `src/components/galaxy/heroes.js` (`HILTS` rows gain `grip` drawn: `ribbed` adds three rings, `sleeve` a darker band; `length` stretches the grip drum and spaces the trims; a `model?: url` slot read by `dress` when present: the GLB replaces the procedural meshes, keeping `grip` and `muzzle` by name)

- [ ] **Step 1: Tests** (`saberDress.test.js`): `length 0.6` makes the grip drum 0.6 tall and the pommel trim at −0.3; `ribbed` adds rings; a `model` with named points places the blade at `muzzle`. **Step 2–5.** `node scripts/saber-sheet.mjs --mode guard` after, looked at.

### Task 7: the backlog row and the handoff’s Lane A section

- [ ] Add to `docs/autopilot/backlog.md`: “The Death Star’s inside draws its blades on `lib/three/combat/saberFx.js`” (where, what done looks like). Write Lane A’s **Done / Left / Checking it** in `HANDOFF-saber-forms.md`. Open the PR with the before and after shots; merge green.

---

## Lane B: the forms (branch `claude/saber-b-forms`, after A)

### Task 8: `mirrorClip` and the `sword-mirror` bake

**Files:**
- Modify: `scripts/preview/ualRetarget.js` (export `MIRROR_PAIRS`, `mirrorRest(rest)`), `scripts/ual-bake.mjs` (`mirrorClip(clip, { pairs, frame })`, the `sword-mirror` set with `strokes: true, mirror: true`, `bladeRows(rows, { hand })`, `contactWindow`’s `ahead` by the hand’s own forward), `scripts/ual-bake.test.mjs`
- Modify: `src/lib/three/clipLibrary.js` (13 `sword.mirror.*` rows), `clipLibrary.test.js` (the pinned list)
- Create: `public/games/meshy/ual-sword.mirror.*.glb` (13 files, each under 40 KB)

**Interfaces:**
- `mirrorClip(clip, { pairs = MIRROR_PAIRS, frame }) → clip`: swaps paired tracks; reflects every quaternion across the sagittal plane in the figure’s rest frame (`q' = (x, −y, −z, w)` after taking the rest out and putting it back); negates the root’s x; names the clip `<name>.mirror`.
- The set: `{ name: 'sword-mirror', pack: 'ual2', strokes: true, mirror: true, hand: 'LeftHand', clips: { Sword_Light_A: 'sword.mirror.light.a', … } }`.

- [ ] **Step 1: Tests**: a synthetic clip raising the right arm 80° becomes one raising the left arm 80° on the Meshy fixture and the right stays at rest; the hips’ `dx` flips; a spine yaw of +0.3 becomes −0.3; the mirror of a mirror is the original within 1e-6; the bake’s window on the left fist falls inside the clip. **Step 2: Run** (`node scripts/assets-fetch.mjs ual2` first); FAIL. **Step 3: Implement**; `node scripts/ual-bake.mjs --set sword-mirror --report`. **Step 4: Run** the tests and `npm test`; re-bake the `sword` set and confirm byte identity. **Step 5: Commit** the script, the tests, the 13 files, the library rows.

### Task 9: the stance table as forms

**Files:**
- Modify: `src/components/galaxy/surface/combatRules.js`, `combatRules.test.js`
- Modify: `src/components/galaxy/surface/HeroPanel.jsx` (the special’s name and blurb; `surface.css` one row)
- Modify: `src/components/guide/pages.js` (Q the special; the aerial)

**Interfaces:** as the spec’s §2: `STANCES[id].hilt`, `.strokes[i].hand`, `.overlay`, `.special`, `.aerial`; `strokeFor(stance, { last, now, dir, heavy, combo, special, air })`; `SPECIAL_COOL` by stance; `STANCE_IDS` unchanged.

- [ ] **Step 1: Tests**: every `L` stroke names a `sword.mirror.*` clip that exists; the pair alternates hands through a combo; `special` returns the stance’s special with `kind: 'special'` and is refused inside its cooldown; `air` returns the aerial; the staff’s fourth stroke carries `overlay.spin = 2π`; the heavy stance’s special has `aoe`. **Step 2–5.**

### Task 10: `saberForms.js`

**Files:**
- Create: `src/components/galaxy/surface/saberForms.js`, `saberForms.test.js`
- Modify: `src/components/galaxy/surface/saber.js` (calls `forms.lay`, `forms.overlay`, `forms.pose`; `guard()` returns one segment per lit blade; the contact-window correction per blade’s hand; `gp.twist(yaw × TWO.twist)` during a stroke; the dual/double construction removed into forms)
- Modify: `src/components/universe/gunplay.js` (`gripFor(side)` exported on the gunplay; `GRIP_FIX` untouched here)
- Modify: `src/components/galaxy/surface/duellists.js` (`clashes` loops every blade pair)
- Modify: `src/components/galaxy/surface/scene.js` (additive: Q → `swing({ special: true })`; a stroke with `!grounded` → `{ air: true }`; `state.cool.special`; the touch Special button through `SurfaceView.jsx`)

**Interfaces:**
- `createForms(stance, gp, { blade, leftHand, dress, fx }) → { blades, hilts, pose(dt, now, ctx), lay(clips, t, w), overlay(sw, k), hands: { hold(), release() }, dispose() }` (the spec’s §3); `lay` takes `{ R?: clip, L?: clip }` and lays each arm from its own clip, the other arm staying at the guard at weight `1 − w`.
- `gp.gripFor('L') → { along, thumb, normal, mean, inv }`.

- [ ] **Step 1: Tests**: a `dual` saber has two hilts, the left under `LeftHand`, built from the left frame (its `along` is the left hand’s); a staff has one hilt 0.6 long with blades at both ends and the hands 0.24 apart; `lay({ R })` moves the right arm’s bones and not the left’s; `overlay` turns the hilt by π at `k = 0.5` of a 2π spin and the second blade’s tip has moved round the hilt; the scenario (`saber.test.js`): a pair’s second combo stroke hits a target 1.5 m to the left and not one to the right; a staff’s whirl hits a target 1.5 m behind; a bolt from behind is turned by the rear blade (`guard()` has two segments); a single’s Lunge closes 4 m and breaks a guard (`breaks: true` in the hit). **Step 2–4**; `node scripts/saber-check.mjs --only stroke,special` for each stance (set `tp-galaxy-hero` with `stance`); `node scripts/saber-sheet.mjs --mode swing`. **Step 5: Commit.**

### Task 11: duellists with the kit

**Files:**
- Modify: `src/lib/combat/duel.js`, `duel.test.js` (`kit`, `evade`, the heavy after two blocks, the special, `mayAttack`)
- Modify: `src/components/galaxy/surface/duellists.js`, `duellists.test.js` (`stepDuel` forwards the row; the token; `t.safeUntil`; the evade clip played full-body)
- Modify: `src/components/galaxy/surface/saber.js` (`sweep` skips a target whose `safeUntil > now`), `src/lib/ai/react.js` (`stagger`, `knock`, `getup`, `cast`, `tricked` rows), `activity.js` (additive: the melee token claimed in `stepDuel`; `knock` plays `knock` then `stand.up`; `hostileBody`’s step carries `hurt` and `knock`; `fetchFight` preloads the new clips)
- Modify: `src/components/galaxy/surface/sites/quests.js`, `sites/outer.js`, `sites/bespin.js` (Maul’s and the Inquisitor’s `blade.stance: 'double'` with `evade: 0.35`; Vader `evade: 0.15`; Dooku `evade: 0.3`)

**Interfaces:**
- `createDuellist({ reach, guard, parry, evade = 0.25, stance, kit, seed })`; `duelStep` → `{ state, move, face, stroke: row | null, begin, block, evade: { clip, safe } | null }`; `mayAttack()` injected by the wiring (`() => tokens.take('melee', t)`).

- [ ] **Step 1: Tests**: evade enters on the roll when your stroke starts within reach and returns a safe window; no `attack` while `mayAttack` is false; a heavy row comes after two blocks; the special on cooldown; the wiring plays the evade clip and the saber’s sweep skips the capsule inside the window (scenario in `duellists.test.js`); a knock plays `knock` and the mind resumes after `stand.up` (activity.test.js’s vader). **Step 2–4**; the browser: Naboo’s Maul whirls and rolls (`__surfaceDo('debug').fight[0].body.duel` shows `evade`); `node scripts/anim-check.mjs --route '#/galaxy/dagobah/surface?mission=raise' …` reported. **Step 5: Commit**; the PR; Lane B’s handoff section.

---

## Lane C: the hold (branch `claude/saber-c-hold`, may run beside A)

### Task 12: the sheet, the fixes, the standing Jedi, the hand layer’s hook

**Files:**
- Modify: `src/components/universe/gunplay.js` (`GRIP_FIX` rows from the sheet, keyed by hero id or NPC kind; `gripFor` if Lane B has not landed it yet, same name)
- Modify: `src/components/galaxy/surface/actors.js` (a standing figure with a `RightHand` bone gets `bladeInHand` at a still guard; `heldBlade` for the rest)
- Modify: `src/components/galaxy/surface/saberForms.js` (or `saber.js` if B has not landed): `saberHands(gp, fig)` → `{ hold(), release() }` reading `fig.hands?.has`; called on `light(true)`, `throw`, the catch; `heldBlade.js` the same
- Modify: `src/components/galaxy/surface/crew.js` (`hands` passed through when the adapter has it; a one-line optional)

- [ ] **Step 1: Tests**: `saberHands` with a fake `hands` calls `hold('R', 0.017)` and `hold('L', 0.017)` on light and `release` on throw; with none it is a no-op; `actors.test.js`: a rigged standing Jedi’s hilt is a child of `RightHand`. **Step 2: Run** `node scripts/saber-sheet.mjs` on `main`’s sheet from Task 1; list every failing row. **Step 3: Implement** a `GRIP_FIX` row per failure (measure on `heroes.html?who=<kind>&view=hands`), the standing Jedi, the hook. **Step 4: Run** the sheet; it exits 0; save `hands-<mode>.png` and `hands.json`. **Step 5: Commit** with the before and after sheets; the PR; Lane C’s handoff section, including which models needed a fix and why.

---

## Lane D: the Force (branch `claude/saber-d-force`, after B)

### Task 13: `src/lib/combat/force.js`

**Files:**
- Create: `src/lib/combat/force.js`, `force.test.js`
- Modify: `src/components/galaxy/surface/combatRules.js` (`FORCE` re-exports `POWERS.push` and `.pull`; `forceAt`/`pushVelocity` stay)
- Reference: `src/components/deathstar/inside/rules/force.js` (the channel core)

**Interfaces:** the spec’s §6 (`POWERS`, `createForce`, `canUse`, `useForce`, `forceStep`, `stopForce`, `chain`, `facing`, the events).

- [ ] **Step 1: Tests**: a push hits the cone and not outside; a pull on a shooter emits `disarm`; lightning chains two within 4 m and not a third at 5, bills `dps × dt` a step, drains a blocker’s guard first, ends at `s`, on release and when the target dies; a grip lifts to `lift` over 0.3 s, holds, throws on release with `throw`, ends if the target dies; a leap emits `vy`; speed emits `slow` and ends; a trick picks the nearest two; a cooldown is spent only when something happened; two held powers never overlap. **Step 2–5.**

### Task 14: the cards, the picker, the hero

**Files:**
- Modify: `src/components/galaxy/surface/abilityRules.js`, `abilityRules.test.js` (a card per power, `force: true`, `side`); `src/components/galaxy/heroes.js`, `heroes.test.js` (`force: [a, b]` kept and validated); `HeroPanel.jsx` (the Force picker for a saber hero; `surface.css`); `src/components/guide/pages.js`

- [ ] **Step 1: Tests**: `abilitiesOf` of a saber spec with `force: ['lightning', 'leap']` is that pair; an unknown kind falls to push/pull; `readHero` keeps and validates `force`. **Step 2–5.**

### Task 15: `surfaceForce.js` and the wiring

**Files:**
- Create: `src/components/galaxy/surface/surfaceForce.js`, `surfaceForce.test.js`
- Modify: `scene.js` (additive: `createSurfaceForce`; `power(slot)` delegates to it for a Force card; `release(slot)` on keyup and touch for both slots; `state.channel`, `state.slow`, `state.held`; the world’s steps take `worldDt(dt)`; the `combat` event gains `channel`; `stepHud`), `SurfaceView.jsx` (release on the V button; cooldown wipes), `GalaxySurface.jsx` (the list shows on a channel), `activity.js` (additive: `t.held`, `t.tricked`, `t.disarmed`; `lifted` / `lifted.fall` / `lifted.land` through `react`; `useForce` on a duellist’s own `createForce`; `shooters()` emits `{ force: kind, events }`), `groundScene.js` (`lift`, `disarm`, `tricked`), `src/lib/ai/react.js` (`cast`), `sounds.js` (`lightning`, `grip`, `leap`, `speed`, `trick`)

**Interfaces:** the spec’s §7. `worldDt(dt)` = `dt × (state.slow ? state.slow.k : 1)`.

- [ ] **Step 1: Tests** (`surfaceForce.test.js` with fakes for `on`, `fx`, `saberFx`, `sounds`): a press of a held power sets the channel and a release ends it; a lift sets `t.held` through `on(t).lift` and a throw clears it; a hit is billed at most every 0.25 s per target; `worldDt` halves under speed; the channel is cleared by `reset()` (death, phase change); the player’s cast clip is asked for by kind. Activity scenario: a duellist gripped is `stagger` in its mind and 1.2 m up; a tricked one strokes nothing for 8 s; Vader’s grip on you sets `state.held` and a dodge in the tell is safe. **Step 2–4**; `node scripts/saber-check.mjs --only power-lightning,power-grip,power-leap,power-speed,power-repulse,power-trick,power-pull` with Luke on Dagobah and Kashyyyk; look at every PNG; a phone viewport for the buttons. **Step 5: Commit**; the PR; Lane D’s handoff section.

---

## Lane E: dismemberment (branch `claude/saber-e-sever`, after B)

### Task 16: `src/lib/combat/limb.js`

**Files:**
- Create: `src/lib/combat/limb.js`, `limb.test.js`

**Interfaces:** the spec’s §8: `CUTS`, `segmentsOf(bones, pairs = AIM)`, `limbAt(at, segments)`, `cutOf(hit, { limbAt, hp, damage, inWindow, within = 0.35 })`.

- [ ] **Step 1: Tests** on the Meshy fixture posed at rest: a point at the wrist picks the forearm with `kind: 'wrist'`; above the shoulder the upper arm; at the hip nothing (not in `CUTS`); a non-lethal hit never cuts; outside the window never cuts; the plane’s normal is the bone’s axis and its point at `k`. **Step 2–5.**

### Task 17: `src/lib/three/combat/sever.js`

**Files:**
- Create: `src/lib/three/combat/sever.js`, `sever.test.js`
- Modify: `src/lib/three/meshyRig.fixture.js` (`skinned: true` adds a small `SkinnedMesh` with `skinIndex`/`skinWeight` over the bones, for this and the rigging lane’s tests)

**Interfaces:** `severFigure({ model, bones, cut: { bone, plane }, colour, collide, tier }) → { step(dt), settled, piece, body: { planes }, dispose() }`; `STUMP = { glow: 3, cool: 1.5, dark: '#2a1a10' }`; `SEVERS = 3`.

- [ ] **Step 1: Tests**: the body’s materials are clones with one `clippingPlanes` entry and the template’s material has none; the piece is a separate `SkinnedMesh` with the opposite plane; a second clone of the same model is unclipped; the piece’s subtree bones move with the Verlet body and the rest stay frozen; the piece settles under a flat `collide` within 3 s; both stump discs exist and their colour darkens over 1.5 s; `dispose` removes everything. **Step 2–5.**

### Task 18: `surfaceSever.js` and the death kind

**Files:**
- Create: `src/components/galaxy/surface/surfaceSever.js`, `surfaceSever.test.js`
- Modify: `scene.js` (additive: `saber.update`’s targets `[...activity.targets, ...groundWar.targets]`; `saberHit` asks `sever.maybe(t, hit, sw)` before `on(t).hit`; the Menu’s Dismemberment setting `tp-sever`), `activity.js` (`hit` takes `how: 'sever'` and `cut`; `dying()`’s first frame hands the figure to `severFigure` when `t.cut`; the hilt follows a severed sword arm; `t.cut` kept for `debug()`), `groundScene.js` and `groundFigures.js` (`how: 'sever'`; the drop path; `collide` shared with the ragdoll), `GalaxySurface.jsx` (the setting row), `src/components/guide/pages.js`

**Interfaces:** `createSurfaceSever({ tier, world, saberFx, sounds, on, setting }) → { maybe(t, hit, stroke) → cut | null, step(dt), count, dispose() }`.

- [ ] **Step 1: Tests**: `maybe` cuts only on the high tier, within 40 m, under the cap and with the setting on; a lethal overhead on a real rig (the `saber.test.js` pattern with a `meshyRig({ skinned: true })` target) cuts the neck, a lethal rise the shin; `activity.hit(t, 5, { how: 'sever', cut })` keeps `t.death.clip` and sets `t.cut`; a ground figure with a sever is dropped, not shelved; the hilt is a child of the piece after a `RightForeArm` cut and the blade is out. **Step 2–4**; `node scripts/saber-check.mjs --only sever` on Kashyyyk’s beach (troopers) and Dagobah (the vision: `hostile.hp` low through `__surfaceDo`); look at the PNGs; the frame time on Kashyyyk with three severs quoted. **Step 5: Commit**; the PR; Lane E’s handoff section.

---

## Lane F: the close (branch `claude/saber-f-close`, after D and E)

### Task 19: everything at once, and the docs

- [ ] `node scripts/saber-check.mjs` whole; `node scripts/saber-sheet.mjs`; `node scripts/autopilot-check.mjs --routes /galaxy/dagobah/surface,/galaxy/naboo/surface,/galaxy/kashyyyk/surface` and `--phone`; `npm run test:ai`; `anim-check` on the vision reported.
- [ ] `docs/architecture.md`’s galaxy surface paragraph: one sentence each for the forms, `saberFx`, `force.js`, `sever.js`. `docs/superpowers/HANDOFF-saber-forms.md`’s status table complete; `HANDOFF-combat.md` gets a line pointing here. The backlog: the Death Star’s move, a peer’s cast and sever, non-lethal disarm cuts.
- [ ] The PR; merge green.

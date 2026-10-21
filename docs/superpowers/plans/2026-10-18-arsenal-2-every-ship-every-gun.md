# Every ship, every gun (arsenal, pull request 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every ship fires its three lines (primary, secondary, ordnance) and plays its two powers (G, X) on both the universe map and the galaxy, on the same keys, read off the same cluster.

**Architecture:**
- **One homing round for both scenes.** The universe map's heavy round becomes a module of its own: `universe/roundRules.js` (pure) and `universe/rounds.js` (the three.js pool). The universe scene flies its rounds through it, and the galaxy fires its own through the same module.
- **The galaxy's guns.** The galaxy builds the universe's armoury (`createArmory`) and fires the line picked: a fan of bolts for the secondary, homing rounds for the ordnance. Every hit goes through its existing `strike`.
- **The universe's powers.** The galaxy's power player (`galaxy/powers.js`) moves to `universe/powers.js`, so the universe owns it with the cards (`shipPowers.js`) and their drawing (`powerFx.js`). The universe scene plays it through small adapters for what the galaxy hands it.
- **Lending.** The two worlds lend to each other only through their `shared/` faces.

**Tech Stack:** three.js, React 19, Vitest (Node).

**Spec:** `docs/superpowers/specs/2026-10-18-one-arsenal-and-hangar-design.md`, Part 2 (and 1.4's keys). Pull request 1 (`docs/superpowers/plans/2026-10-18-arsenal-1-one-flight-hud.md`) is done: the kit's `Cluster`, `Vitals`, `Arms` and `Powers`, `createFlightCluster`, and `universe/clusterView.js` and `armsView` exist.

## Global Constraints

- Layers and islands, per `docs/health/RULES.md`.
  - `boundary-breaks` (487 now, budget 489) may not rise. A new import from one world into the other goes through `universe/shared/*` or `galaxy/shared/*`, with the face's test (`shared.test.js`) listing the new names.
  - Moving `galaxy/powers.js` into the universe must not raise it either. Its own imports become universe-internal, and the galaxy reaches it through `universe/shared/flying.js`.
- `universe/scene.js` (6,209) and `galaxy/scene.js` (2,949) only shrink or grow by calls. The round and power code lives in modules.
- Nothing is made per frame in the frame loop.
- Powers and skill-free weapons never touch another pilot beyond what the wire already carries: a shot's `code` from `WEAPONS`, and `DAMAGE_MAX` 30.
- One art per world: the universe's flashes are drawn without the 2017 game's look (`createFlashes(parent, { look: null })`).
- Keys, in a ship, on both maps:
  - F fires.
  - R and Shift+R cycle the lines, and 1 2 3 picks one.
  - G is the power and X the big power.
  - At the universe map's phone, G opens the phone first. On foot, G and X stay the foot's.
- Done means:
  - `npm run lint`
  - `npx vitest run` with no new failing file against the baseline list (`…\scratchpad\baseline-fails.txt`), counting only failures that aren't 5 s timeouts passing with `--testTimeout=60000`
  - `npm run build`
  - `node scripts/health.mjs --check --skip build`
  - before and after shots of `/universe` and `/galaxy` (`…\scratchpad\tools\hudshot.mjs`)

## Review Focus

1. **The universe's rounds look and land as before.** The pool, the colour per crew, the homing after 0.12 s, the snap into a near target, and every target they could hit (hunters, skirmishes, the front, pilots, the Citadel's parts and core, capital ships, the NX-5, traffic, leviathans, meteors and mines) stay as they were.
2. **Powers are only on the game's ships.** On the universe map, a power never hits another pilot, never hurts traffic or a civilian, and never touches the Citadel (its strike tries hunters, then skirmishes, then the front).
3. **Cancel paths on the universe map.** These stop whatever power is on and keep the charge: being shot down, crashing, diving into a world, jumping, stepping out on foot, the Shipyard opening, and changing ship.
4. **The universe's post look.** Force Focus's aberration and exposure must show. Today `finish()` rewrites both every frame, so the scene has to combine them, and must return to its own when Focus ends.
5. **The galaxy's rapid-fire pickup.** It speeds every line, not only the primary. The galaxy's dry rack sounds the universe's `dry` event, and a respawn refills the rack.

---

### Task 1: The homing round, one module for both scenes

**Files:**
- Create: `src/components/universe/roundRules.js` and `roundRules.test.js`, `src/components/universe/rounds.js`
- Modify: `src/components/universe/scene.js` (the missile meshes at about 853–883, `launch` at about 2289, and `moveMissiles` at about 2634–2743 fly through the module; the hit chain stays in the scene, as a function)

**Interfaces:**
- Produces, in `roundRules.js` (pure):
  - `steerRound(d, at, dt, scratch) → void`. Here `d` is `{ v:[x,y,z], homing, target, age, life }` and `at` is the round's position `{ x, y, z }`. After 0.12 s of age, it steers `d.v` onto `d.target.at` at `d.homing` rad/s (`weapons.steer`).
  - `nearTarget(d, at) → boolean`. True when within `(target.size ?? 0.3) + 0.35`, and false for a siege part (`target.siegePart !== undefined`).
- Produces, in `rounds.js` (three.js): `createRounds(parent, count) → { list, setColor(hex), launch(at: Vector3, dir:[x,y,z], speed, { life, punch, damage, homing, target }) → mesh, fly(dt, hit) → boolean (any in flight), dispose() }`.
  - `fly` steps each live round: life and age, then `steerRound`, then the move and orientation, then `to` (the target's middle when `nearTarget`, else the position). It calls `hit(m, from: Vector3, to: Vector3) → boolean` (true means the round is spent, and the caller has drawn the bang). A round whose life runs out calls `hit(m, null, m.position)` so the caller bangs it.
  - The meshes are the universe's: the octahedron slug, the glow sprite and the tail cone.

- [ ] **Step 1: Write the failing tests** in `roundRules.test.js`:
  - `runs straight for its first 0.12 s`: a round with `age: 0.05`, a target off to the side and `steerRound(…, 0.016)` leaves `v` unchanged.
  - `turns onto its target at its homing rate`: a round with `age: 0.5`, `v: [0, 0, -10]`, `homing: 2`, a target at `{x: 10, y: 0, z: 0}` and `dt: 0.1`. The angle between the old and new `v` is close to 0.2 rad, and the speed is unchanged (10).
  - `has no target, keeps going`: `target: null` leaves `v` unchanged.
  - `snaps into a near target, never a siege part`: `nearTarget` is true at 0.5 from a target of size 0.3, and false at 0.7 or for `{ siegePart: 0 }` at 0.1.

- [ ] **Step 2: Run them and see them fail**
  Run: `npx vitest run src/components/universe/roundRules.test.js`
  Expected: FAIL, no module.

- [ ] **Step 3: Implement both modules.** In `universe/scene.js`:
  - `const rounds = createRounds(map, MISSILES)` replaces the meshes, and `missiles` becomes `rounds.list`.
  - `dress()` calls `rounds.setColor(arsenalOf(kind).heavy)`.
  - `launch` calls `rounds.launch(...)`.
  - `moveMissiles(dt)` becomes `rounds.fly(dt, missileHit)`, where `missileHit` is the existing hit chain, verbatim, with `boom`.

- [ ] **Step 4: Run the tests and see them pass, then shoot the universe**
  Run: `npx vitest run src/components/universe/roundRules.test.js src/components/universe/weapons.test.js`, then fly with `hudshot.mjs universe`, with ordnance picked (key 3, F).
  Expected: PASS. A round flies, homes and bangs as before.

- [ ] **Step 5: Commit**: `git commit -m "The universe map's heavy rounds fly through a module of their own, ready for the galaxy."`

### Task 2: The faces each world lends, and the powers' new home

**Files:**
- Move: `src/components/galaxy/powers.js` to `src/components/universe/powers.js` (with `git mv`). Its `LASER` import from `galaxy/fx.js` becomes an option, `laser: { color }`, handed in. Its imports of `../universe/*` become `./*`.
- Modify:
  - `src/components/universe/shared/flying.js` and `shared.test.js`: lend `createArmory`, `armsView`, `fan`, `createRounds`, `createGalaxyPowers` and `chargeFor`
  - `src/components/galaxy/scene.js`: imports the powers and `chargeFor` through `../universe/shared/flying`
- Create: `src/components/galaxy/shared/fx.js` (lends `createBolts`, `createFlashes` and `LASER` from `../fx`), plus its row in `galaxy/shared/shared.test.js`

**Interfaces:**
- Produces: `createGalaxyPowers({ …as before…, laser })`. The name stays, so its callers don't change. `laser` defaults to `{ color: '#ff4a3d' }` when it isn't given (read `galaxy/fx.js`'s `LASER` for the galaxy's own value and pass it).
- Produces, from `universe/shared/flying.js`: `arsenalOf`, `BUILT_KINDS`, `turnToward`, `createArmory`, `armsView`, `fan`, `createRounds`, `createGalaxyPowers`, `chargeFor`.
- Produces, from `galaxy/shared/fx.js`: `createBolts`, `createFlashes`, `LASER`.

- [ ] **Step 1: Write the failing tests.** Add the new names to both faces' tests (`universe/shared/shared.test.js`, `galaxy/shared/shared.test.js`).
- [ ] **Step 2: Run them and see them fail**: `npx vitest run src/components/universe/shared src/components/galaxy/shared`.
- [ ] **Step 3: Move the file, lend through the faces, and repoint the galaxy.** `galaxy/scene.js` imports `createGalaxyPowers` and `chargeFor` through `../universe/shared/flying` and hands `laser: LASER` in.
- [ ] **Step 4: Run the faces' tests, the powers' tests and the health check**
  Run: `npx vitest run src/components/universe/shared src/components/galaxy/shared src/components/universe/shipPowers.test.js`, then `node scripts/health.mjs --check --skip build`.
  Expected: PASS, and `boundary-breaks` ≤ 487.
- [ ] **Step 5: Commit**: `git commit -m "The crews' ship powers are played by a module the universe owns, lent to the galaxy, and each world lends the other what it needs to fly with."`

### Task 3: The galaxy fires all three lines

**Files:**
- Modify:
  - `src/components/galaxy/scene.js`: the armoury; `fire`; `moveBolts` for the fan; the rounds; keys R, Shift+R, 1, 2 and 3; refit on a new loadout; reload on a respawn; the cluster's arms
  - `src/components/galaxy/GalaxyView.jsx`: the touch Weapon button, as the universe map has it, calling the scene's `weapon()`
  - `src/components/galaxy/FlightCluster.jsx`: `<Arms keys />`
  - `src/pages/Galaxy.jsx`: drop the shipyard's `hint`
  - `src/components/guide/pages.js`: one `ARMS` row set (the weapon keys and both power keys) for `/universe` and `/galaxy`; drop the galaxy's "fire on the universe map only" tip
- Create: `src/components/galaxy/gunRules.js` and `gunRules.test.js`

**Interfaces:**
- Consumes: Task 2's `createArmory`, `armsView`, `fan` and `createRounds`; Task 1's `fly(dt, hit)`.
- Produces: `shotPunch(w, g, gun) → number`, the punch of one shot of weapon `w` (`WEAPONS[id]`) from the fitted stats `g` with the pickups' `gun`, which is `g.punch * gun.punch * w.punch`. Also `lineCadence(base, w) → seconds`, which is `base * w.cadence`. Both are in `gunRules.js` and tested.
- The galaxy's pool of bolts grows from 16 to 40 (a seven-bolt flak burst, with room for the next).
- Ordnance rounds hit through `strike(from, to, punch, { vel })`, as bolts do: hunters, then the war, then other pilots. The rack refills in `armory.update(dt)` each frame.
- `net?.shot(at, v, w.code)` sends the weapon's code with each shot.

- [ ] **Step 1: Write the failing tests** in `gunRules.test.js`:
  - `a flak bolt's punch is the fitted guns' times the pickup's times the flak's`: `shotPunch(WEAPONS.flak, { punch: 1.5 }, { punch: 2 })` is close to `1.5 * 2 * 0.45`.
  - `a line's cadence is the ship's times its own`: `lineCadence(0.12, WEAPONS.heavy)` is close to `0.384`.
- [ ] **Step 2: Run them and see them fail**: `npx vitest run src/components/galaxy/gunRules.test.js`.
- [ ] **Step 3: Implement `gunRules.js` and wire the scene.**
  - **`fire()`:**
    1. Take the base gap as today (`gunsUnder`).
    2. `arm.ready(now, gun.gap)`, with a `dry` event on an empty rack (as the universe has it).
    3. On fire, `arm.fired(now)`.
    4. Then: the primary keeps today's single bolt; the secondary is `fan(dir, w.count, w.cone, jitter)` bolts, each with life `AIM.life * w.life`, speed `AIM.bolt * w.speed` and punch `shotPunch`; the ordnance is a `rounds.launch` on `state.lockTarget` with `homing: w.homing`.
  - **`pickWeapon(i)`** takes R, Shift+R, 1, 2 and 3 off the keys and `weapon()` off the API, as the universe's does.
  - **Each frame:** `armory.update(dt)`, and `rounds.fly(dt, galaxyRoundHit)`. `galaxyRoundHit` runs `strike` and bangs with a flash and pop.
  - **The cluster's `arms`:** `armsView(armory, out)` once the guns are used, else the primary record.
- [ ] **Step 4: Run the tests**: `npx vitest run src/components/galaxy src/components/guide src/runtime/hud`. Expected: no new failures.
- [ ] **Step 5: Shoot the galaxy and look.**
  - At 1440x900, fly, press 2 and F (a fan), then 3 and F (a round homing onto a locked TIE with T).
  - The cluster's Arms shows the line and the rack, and R, 1, 2 and 3 move it.
  - At 390x844, the Weapon button is clear of Fire, View and the tiles.
- [ ] **Step 6: Commit**: `git commit -m "The galaxy fires all three lines, as the universe map does: a fan, homing rounds, R and 1 2 3."`

### Task 4: The universe map plays the crews' powers

**Files:**
- Modify:
  - `src/components/universe/scene.js`: create the powers; the adapters; and the calls at the moments the galaxy's scene makes them
  - `src/components/universe/UniverseMap.jsx`: a `powers` ref, the `PowerBar` in the cluster after `Arms` with `onPress={(slot) => view.current?.power?.(slot)}`, and the ref in the world's props
- Create: `src/components/universe/powerSeams.js` and `powerSeams.test.js`

**Interfaces:**
- Consumes: Task 2's `createGalaxyPowers`, and `createBolts`/`createFlashes` through `galaxy/shared/fx`.
- Produces, in `powerSeams.js` (pure, tested):
  - `mixPost(own: { aberration, exposure }, power: { aberration, exposure }) → { aberration, exposure }`. It adds the aberrations and multiplies the exposures, so Focus shows over the map's own look.
  - `canPower({ flying, onFoot, crash, dive, jump, frozen, view, phoneNear }) → boolean`. It is false on foot, at the phone, over the nav map, frozen, crashed, diving or jumping.
- The adapters in the scene, each a few lines:
  - `strike(from, to, punch, opts)`: `hunters.hit` ?? `farHit` ?? `frontHit`. On a hit it calls `hunterShot(r, normal)` and charges the big one.
  - `scored(hit, { by })`: `hunterShot(hit, up)`.
  - `teleport(pose)`: `portalThrough`'s placement, setting `state.ship` and `camQOn = false`.
  - `war`: `null`, because the front takes no power options.
  - `state.space`: a getter, `{ solids: solidsNow(), edge: Infinity, ceilingAt }`.
  - `post`: a shim that records what the powers ask for. `finish()` then writes `mixPost(own, asked)`.
- Calls, as the galaxy's scene makes them:
  - `setCrew(kind)` on a ship change, and `mods` in steering (turn and agility)
  - `aim(controls())` in the assist and tracking
  - `gain(chargeFor(hit, …))` on every hunter, skirmish or front kill by a bolt or round
  - `cancel()` on crash, being shot down, dive, jump, stepping out and frozen
  - `afterStep` after `step`, and `roll` on the model's bank
  - `hunters.update(dt * mods.slow, t, shipFor(live))`, and `hurt` ignoring a hit while `mods.ghost`
  - `frame(dt, live)` and `place(props.powers.current, on)`
  - `busy` toward the loop's keep-going, and `dispose()`
- The keys: G and X, after the phone's check and only off foot, call `power(slot)`, which presses when `canPower(...)` allows it.

- [ ] **Step 1: Write the failing tests** in `powerSeams.test.js`:
  - `Focus shows over the map's own look`: `mixPost({ aberration: 0.002, exposure: 1.1 }, { aberration: 0.007, exposure: 0.88 })` is close to `{ aberration: 0.009, exposure: 0.968 }`.
  - `no power on foot, at the phone, over the map, frozen, crashed, diving or jumping`: each such state gives `canPower` false, and plain flight gives true.
- [ ] **Step 2: Run them and see them fail**: `npx vitest run src/components/universe/powerSeams.test.js`.
- [ ] **Step 3: Implement `powerSeams.js` and wire the scene and the map**, as above.
- [ ] **Step 4: Run the tests**: `npx vitest run src/components/universe src/components/galaxy src/runtime/hud --testTimeout=60000`. Expected: no new failures.
- [ ] **Step 5: Shoot the universe and look.** Fly the X-wing.
  - G turns on Force Focus: the tile goes active, the picture's edges pull apart, and it ends and cools.
  - Kill hunters (or call `window.__universeDebug` to fill the charge), then X: the torpedo salvo flies.
  - On foot, G still boards. At the phone, G still opens it.
- [ ] **Step 6: Commit**: `git commit -m "The universe map plays the crews' powers on G and X, as the galaxy does, from the same tiles in the cluster."`

### Task 5: Prove it and hand it over

- [ ] **Step 1:** Run `npm run lint`. Expected: clean.
- [ ] **Step 2:** Run the full suite against the baseline. Rerun every new failing file with `--testTimeout=60000`. Expected: nothing new that isn't a 5 s timeout.
- [ ] **Step 3:** Run `node scripts/health.mjs --check --skip build`. Expected: within budget, and `boundary-breaks` ≤ 487.
- [ ] **Step 4:** Run `npm run build`, then restore `public/github.json`.

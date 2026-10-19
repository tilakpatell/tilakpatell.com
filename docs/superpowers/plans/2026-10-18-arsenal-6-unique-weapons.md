# Unique weapons (arsenal, pull request 6) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eight weapons no one else has, one or two from each universe, each unlocked deep in the skill tree. Four go on the ship (the Seismic charge, Concentrated dark matter, the Blue sky cluster, the Energon arc) and fly wherever the ship does: the universe map, the galaxy and the C-137 street. Four go in the hand (the Amban phase-pulse rifle, Rick's particle beam, the M60 from the trunk, the repulsor gauntlet) and are carried on the galaxy's worlds and the planets landed on. Each does one thing nothing else does.

**Architecture:**
- **The tables move down.** `src/lib/arms/ship.js` gains the four ship rows (codes 7–10, `unique: true`). A new `src/lib/arms/hand.js` takes the hand table (`WEAPONS`, `PICKABLE`, `SHOW_KILLS`, `MODS`) out of `galaxy/surface/weaponRules.js`, which re-exports it (the barrel rule), and adds the four hand rows and `UNIQUE_HAND` (gun → node).
- **Behaviours are pure** in `src/lib/arms/behaviours.js`, tested in Node: the seismic ring, the dark matter's pierce, the cluster's burst, the energon's chain and its jagged line, the beam's ticks, the M60's climb and the gauntlet's charge and throw.
- **The ship's are played like the powers.** `universe/uniqueArms.js` is a sibling of `universe/powers.js`: the scene hands it the same seams (`hunters`, `war`, `bolts`, `flashes`, `strike`, `scored`, `state`) and calls `fire` and `frame`, so `universe/scene.js` and `galaxy/scene.js` grow only by those calls. `universe/uniqueFx.js` draws them (the charge and its ring, the dark orb, the crystal, the arcs) with plain materials, so both renderers draw them. The C-137 street plays them in `rickmorty/world/streetFight.js` at its own size, against its one patrol.
- **The hand's are played by the galaxy's surface.** `galaxy/surface/handArms.js` holds the beam, the charge and the climb, and the surface scene's `fire` hands a unique gun to it. The kill shows go in `lib/three/gadgetFx.js` (a flash of light, ash, a throw). The models are built in code in `universe/guns/unique.js`, with `mats` and `kit` moved out of `gunplay.js` to `universe/guns/kit.js` so `gunplay.js` only spreads them in.
- **One gate, the skill tree.** `effectsOf` gives `fx.arms`: the unique weapons whose nodes are taken. The armoury fires a unique line only when `fx.arms` has it (a reset puts the stock line back); `readHero`, the Hangar's Arms and the galaxy's deploy panel offer a unique hand gun only then. The Shipyard sells a ship one only then (`needs: { skill }`, through the wallet's `lock` and a `skillOf` the economy is handed, as `standingOf` is). A hand gun is free once its node is taken.

**Tech Stack:** React 19, three.js (WebGL 2 and the node renderer), Vitest.

**Spec:** `docs/superpowers/specs/2026-10-18-one-arsenal-and-hangar-design.md`, Part 6 and Part 5 (`hand.js`). Pull requests 1–5 are done.

## Global Constraints

- **The tree doesn't change shape or cost.** The eight `u-*` nodes lose `soon` and gain `arms: <id>`. Each is row 4, costs 2 and needs its row-3 node (`longlock` or `hardhit`) and its universe's key. The whole tree is still 60 of the 70 the site can give (`0.8 × maxPoints ≤ treeCost ≤ maxPoints` stays pinned). So the unique weapons are the last things anyone gets, and they choose which.
- **Ship rows** (`lib/arms/ship.js`; codes never reused, never over 15, damage ≤ `DAMAGE_MAX`):

  | id | code | line | what it does |
  | --- | --- | --- | --- |
  | `seismic` | 7 | ordnance | Dropped behind, drifting; after 1.2 s a flat ring 14 units across, everything in it hit. Rack 2, one back every 10 s. |
  | `darkmatter` | 8 | secondary | One slow bolt through every ship in its line, a third less at each. |
  | `crystal` | 9 | ordnance | Homes on the lock; near it, six blue shards, each a small hit. Rack 3. |
  | `energon` | 10 | secondary | Lightning to the lock (or the nearest ahead), then on to up to three more within 12 units, each jump weaker. |

  The skill tree's guns apply as to the rest: `shots` adds a bolt (dark matter) or a jump (energon); `ammo`, `reload`, `life` and `homing` apply to the two racks.
- **Only the game's own ships.** The unique weapons touch the hunters and the war's battle (and on the street, the patrol), as the powers do. Never another pilot: a shot still goes over the wire with its code so the others draw it, and an older peer draws an unknown code as the blaster (`byCode`).
- **Hand rows** (`lib/arms/hand.js`; `weaponRules.test.js`'s held-down lock stays true for each):

  | id | side | what it does |
  | --- | --- | --- |
  | `amban` | galaxy | One heavy shot, a long reach, a scope (zoom 5). Whoever it drops goes in a flash of light. |
  | `particle` | elsewhere | Held, not fired: a beam that hits ten times a second and heats fast (locked in 1.6 s held). Whoever it drops burns to ash. |
  | `m60` | elsewhere | A long stream past the surface's 0.24 s floor (`stream`), slow to heat; each shot of a run walks the aim up more (`climb`). |
  | `gauntlet` | elsewhere | Held to charge (1.2 s to full), let go to fire: a short palm blast that throws whoever it hits back, bigger, harder and further charged. Whoever it drops is thrown. |

  `SHOW_KILLS` gains `amban`, `particle` and `gauntlet`. `PICKABLE` stays the guns anyone may pick; `pickableWith(arms)` adds the unique ones whose nodes are taken.
- **Prices** (the ship's, by hand in `catalog.js`'s `NEW`): seismic 1,500, darkmatter 1,250, crystal 1,250, energon 1,500, each `needs: { skill: 'u-…' }` and `from` its universe (energon's is `universe`, a new group).
- **Saves don't change shape.** `tp-crew`'s gun is still any id; a reader keeps a unique one only while its node is taken, else the hero's own. A bought part stays owned after a reset; it just fires as stock until the node is taken again.
- **Islands and budgets:** the universe and the galaxy never import `components/hangar` (they read `fx`). No new file over 800 lines. `big-files` ≤ 30 (it's at 30), `boundary-breaks` ≤ 489, `loops` ≤ 58, `glsl-sites` ≤ 619 (the new effects use plain materials), `cycles` ≤ 5.
- British spelling, no Oxford comma, house UI rules.
- **Done means:** lint; the suite; the health check; the build; shots at 1440×900 and 390×844 of the Skills tab with a `u-*` node takeable, the Arms tab's unique weapons, the Shipyard's locked and open unique part; and each ship weapon fired on the universe map, and a hand gun on a galaxy world.

## Review Focus

1. **A reset takes the weapons back.** With a unique part fitted and its node reset, the armoury fires the stock line, the Shipyard says what it needs, and a picked unique hand gun reads back as the hero's own, without a throw.
2. **Never another pilot.** No unique behaviour calls `net.hit` or strikes with `pilots: true`.
3. **The scenes grow by calls.** `universe/scene.js`, `galaxy/scene.js` and `galaxy/surface/scene.js` gain wiring only; the behaviours are in the new modules.
4. **Nothing leaks.** The FX pools are made once, hidden when idle and disposed with the scene; a scene cleared (a crash, a landing, a jump) clears what's in flight.
5. **The tests that knew the old world.** `protocol.test.js` read code 7 as unknown: it moves to an unused code. The `soon` tests move to a node made `soon` in the test.

---

### Task 1: The tables and the gate

**Files:**
- Modify: `src/lib/arms/ship.js` and its test; `src/components/hangar/skills/tree.js`, `rules.js` and their tests; `src/components/universe/weapons.js` and its test; `src/components/universe/online/protocol.test.js`
- Create: `src/lib/arms/hand.js`, `src/lib/arms/hand.test.js`
- Modify: `src/components/galaxy/surface/weaponRules.js` (re-exports `hand.js`'s table)

- [ ] **Step 1: Failing tests.**
  - `ship.test.js`: the four unique rows have codes 7–10, `unique: true`, and seismic and crystal racks of 2 and 3.
  - `hand.test.js`: `UNIQUE_HAND` names four rows and four nodes; `pickableWith([])` is `PICKABLE`; `pickableWith(['amban'])` adds `amban` only; every `SHOW_KILLS` id is in `pickableWith(everything)`.
  - `rules.test.js`: no node is `soon`; `effectsOf(['u-seismic', 'u-amban']).arms` is `['seismic', 'amban']`; a `soon` node made in the test is still refused.
  - `weapons.test.js`: `createArmory('xwing', { ordnance: 'seismic' })` fires the stock rack without `fx.arms`, and the seismic with `{ arms: ['seismic'] }`.
- [ ] **Step 2: Implement.** The rows; `hand.js` with the moved table and the four new rows; `fx.arms` (a list, like `carry`); `linesOf(kind, loadout, fx)` keeps a unique part only when `fx.arms` has its weapon.
- [ ] **Step 3: Pass, lint, commit.**

### Task 2: The behaviours

**Files:** Create `src/lib/arms/behaviours.js`, `src/lib/arms/behaviours.test.js`

**Interfaces:**
- `SHIP_FX`: `{ seismic: { fuse, radius, slab, back, drift, punch }, darkmatter: { falloff }, crystal: { near, shards, cone, punch }, energon: { reach, hop, falloff } }`
- `dropAt(ship, back)` → `{ at, v }` (behind the ship, with a share of its way on)
- `inRing(at, list, radius, slab)` → the ones within the flat ring
- `pierce(bolt, from, to, list, hit)` → `[{ t, punch }]`, the ones its segment meets that it hasn't, the punch losing `falloff` at each
- `burstDirs(dir, n, cone, rand)` → `n` unit directions round `dir`
- `chain(first, list, { jumps, reach, falloff, punch })` → `[{ t, punch }]`, nearest unvisited each hop
- `jagged(from, to, n, rand)` → the lightning's points
- `beamTicks(beam, dt, every)` → how many hits this frame
- `climbOf(w, run, ads)` → radians the aim goes up for the `run`-th shot of a run
- `chargeOf(held, w)` → 0…1; `blastOf(w, k)` → `{ damage, push, scale }`
- `throwOf(dir, push)` → `{ vx, vy, vz }`

- [ ] Steps: tests first for each (a target just outside the ring is missed; the pierce never hits the same ship twice and loses a third each time; the chain never revisits and stops when none is within `hop`; the beam ticks ten times in a second however the frames fall; the climb grows over a run and is less down the sights; a charge held past full is full).

### Task 3: The ship's weapons on the map and in the galaxy

**Files:**
- Create: `src/components/universe/uniqueArms.js`, `src/components/universe/uniqueFx.js`
- Modify: `src/components/universe/scene.js`, `src/components/galaxy/scene.js` (wiring only), `src/components/universe/shared/flying.js` (lends `createUniqueArms`)

**Interfaces:** `createUniqueArms({ parent, reduced, hunters, war, bolts, flashes, state, emit, strike, scored })` → `{ fire(id, at, dir, speed, w, g) → v (the velocity for the wire), frame(dt), clear(), dispose(), busy }`.

- [ ] Steps:
  - The scenes: `fire()` hands a `unique` weapon to `unique.fire` (its returned velocity goes to `net.shot`); `unique.frame(dt)` beside `powers.frame`; `unique.clear()` where the powers are cancelled; `dispose()` with the rest.
  - Seismic: a dark charge with a blinking light, dropped and drifting; at its fuse a flat ring of light swells to its radius and fades, and everything in it is hit.
  - Dark matter: a slow dark-green orb with a glow; each frame its segment is tested against the hunters and the war (`pierce`), each hit landed through `hunters.damage` / the war's hit; a `strike` past them ends it on anything else.
  - Blue sky cluster: a homing round (as the torpedo salvo's, onto the lock); near its target, `burstDirs` six shards through `bolts.fire`, each a `strike` along its line.
  - Energon arc: `chain` from the lock; each hop drawn as a jagged line for a moment, and landed.

### Task 4: The C-137 street

**Files:** Modify `src/components/rickmorty/world/streetFight.js` and its test.

- [ ] Steps: with the one patrol, the seismic charge is a slow bolt dropped behind that goes off at its fuse (the patrol hit if it's within the ring); dark matter a slow, big bolt; the cluster bursts into six shards near the patrol; the arc lands at once on the patrol within the guns' reach, drawn as a fast bolt. Tests: a charge that goes off by the patrol downs a hurt one; the cluster's shards come out near it.

### Task 5: The hand's weapons on the galaxy's worlds

**Files:**
- Create: `src/components/galaxy/surface/handArms.js` and its test (the pure parts), `src/components/universe/guns/kit.js`, `src/components/universe/guns/unique.js`
- Modify: `src/components/galaxy/surface/scene.js` (wiring), `activity/activity.js` (the shows), `src/lib/three/gadgetFx.js` (`light`, `thrown`), `src/components/universe/gunplay.js` (`mats` and `kit` moved, the unique guns spread in), `src/lib/three/walrusSets/stance.js` (their classes), `src/components/universe/sounds.js` (their sounds)

- [ ] Steps:
  - The models: the Amban (a long, thin rifle, its scope and the Mandalorian's beskar grey), the particle beam (a chunky emitter with a coil and green glass), the M60 (the belt, the bipod, the carry handle) and the gauntlet (red and gold, the palm's repulsor ring). Each passes `gunplay.test.js`'s checks.
  - The beam: held, it ticks through `blaster.aim` at `every`, each tick `struck` with `how: 'particle'`, and is drawn muzzle to the hit; letting go or the heat locking ends it.
  - The M60: past the 0.24 s floor; each shot of a run lifts the camera's aim by `climbOf`.
  - The gauntlet: held, it charges (the palm glows); let go, the blast: its damage and its throw by the charge, through `on(t).knock`.
  - The shows: `amban` a flash of white-blue light and the body gone in motes; `particle` an ember glow and ash falling; `gauntlet` thrown back and spinning, then down.

### Task 6: The gate in the pages and the Hangar

**Files:**
- Modify: `src/components/galaxy/heroes.js` (`readHero(raw, ship, crew, arms)`), `src/pages/GalaxySurface.jsx`, `src/components/galaxy/surface/DeployPanel.jsx`, `src/components/hangar/armsTabRules.js`, `crewTabRules.js`, `ArmsTab.jsx`, `HangarPanel.jsx`, `skillsTabRules.js` and their tests; `src/components/universe/catalog.js`, `outfit.js`, `economy.js`, `EconomyProvider.jsx`, `shared/wallet.js`, `src/components/hangar/skills/SkillsProvider.jsx`
- Behaviour:
  - The four ship parts in `outfit.js`, priced and locked in `NEW`; `needText` says “Take “Seismic charge” in the skill tree”.
  - The wallet's `lock` reads `needs.skill` through `skillOf`; `SkillsProvider` tells the wallet the nodes taken (`tellSkills`).
  - The Arms tab: a section for the eight, each with where it's from and what it does, open (“Fit it in the Shipyard” / picked for the crew) or locked (“Skills · Guns · Seismic charge”, a button to the Skills tab). A crew member's gun chips gain the unique ones they may carry.
  - The deploy panel and `readHero` offer and keep a unique gun only while its node is taken.

### Task 7: Prove it

- [ ] Lint; the suite; the health check; the build; the shots listed above, at 1440×900 and 390×844; each ship weapon fired at hunters on the universe map (its kills counted from the scene's events); a hand gun on a galaxy world.

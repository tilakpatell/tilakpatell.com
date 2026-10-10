# Lane G5: heroes and vehicles in the sim. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (one session, task by task; no review loops). Steps use checkbox (`- [ ]`) syntax.

**Goal:** The game design's lanes 3 and 4, together: heroes and vehicles are entities of the sim, bought at the deploy screen for the record's Battle Points under the mode's kit limits, fought by bots and by you, drawn by the world with the game's bodies and cuts. Saber heroes fight on lane S's engine (`src/lib/combat/saber2017.js`), blaster heroes on their weapon rows, every hero with its three abilities from `abilities.json`; vehicles from `vehicles.json` on P3's handling where it exists.

**Architecture:** `src/lib/battlefront/heroes.js` (hero rows → entities: health and armour affectors, abilities on channels, the saber engine's step per saber hero, the weapon per blaster hero), `vehicles.js` (vehicle rows → entities with seats, weapons, health, movement: walkers on waypoints or steering, speeders and bikes kinematic, turrets fixed, the AT-AT as a vehicle with its seats replacing lane 2's body), `ai/heroBrain.js` and `ai/vehicleBrain.js`; the deploy screen (`hud/DeployScreen.jsx`) offers them at `points.json`'s prices and `kits.json`'s limits; the world draws heroes with the galaxy's shared walrus loader and lane X's stroke tables, vehicles with lane V's cuts, both through `galaxy/shared/`.

**Spec:** `2026-10-10-bf2017-galaxy-on-the-game-design.md`, decision 7; the game design's sections 4, 5 and 7 (heroes, vehicles, bots); the saber design (`2026-10-10-bf2017-saber-mechanics-design.md`); the physics design's P3 plan (`2026-10-10-bf2017-phaseP3-vehicles.md`).

## Global constraints

- Start from `main` after lane S (#875) and G3 have merged. Own: `src/lib/battlefront/{heroes,vehicles}.js` and tests, `ai/{heroBrain,vehicleBrain}.js`, `sim.js` (the entity kinds: additive), `src/components/battlefront/{figures/heroes.js,vehicles/*}` (new), `hud/DeployScreen.jsx` (the offers: additive), `scripts/battlefront-balance.mjs` (`--heroes`, `--vehicles`).
- The saber engine is lane S's: imported, never copied; a shape change is wrapped once in `heroes.js`. The hero bodies and clips are the galaxy's (`galaxy/shared/`), never re-imported. No sequel heroes or vehicles.
- Pure rules; numbers from the rulebooks; hand values named. Files under 800 lines; the usual gates.

## Tasks

### Task 1: hero entities

- [ ] `heroes.js`: `heroEntity(rb, id, team)` from `heroes.json` (health, armour affectors, regen, side, saber or weapon, abilities), stance and states as soldiers have them plus `blocking`, `dodging`, `striking`; saber heroes own a `saber2017` engine instance stepped by the sim at `STEP` (its strikes, blocks, stamina, the dodge's two charges, the clash), the engine's hit query over the sim's capsules (the hero hurtbox set from `bones.json`), damage with its delay and the from-behind bonus; blaster heroes fire their `weapons.json` row through `bolts.js`; the three abilities (`abilities.json`: activation, active, recharge, cost, channels, modifiers as affectors: Force push as an impulse and stagger, choke as a hold and damage over time, lightning as a cone, heal as a regen affector, saber throw as a returning projectile from `ProjectileBlueprint`).
- [ ] `heroes.test.js`: a strike lands the record's damage after its delay; a block from the front costs stamina and no health; an ability on a blocked channel waits; a seeded Luke against Vader runs the same twice.

### Task 2: hero bots

- [ ] `ai/heroBrain.js`: saber heroes close on their mark, chain strikes, block when a bolt is coming (the engine's `incoming`), dodge a strike, spend abilities by situation (push when three are near, choke the target, heal under 40 %); blaster heroes kite at their weapon's best range, roll, use abilities on cooldown; the target choice weights HvV's target (G4a) and objectives (Galactic Assault) as the commander says; the commander buys a hero when the team's points allow and the kit limit has room (`PF_HeroKitMaxCount`, `kits.json`).
- [ ] Balance: `battlefront-balance.mjs --mode hvv --level hoth_01 --runs 12` with real heroes (the table in the PR), and `--mode galacticAssault` with heroes bought.

### Task 3: vehicle entities

- [ ] `vehicles.js`: `vehicleEntity(rb, id, team, spawn)` from `vehicles.json` (health, seats and their weapons, abilities, overheat), kinds: `walker` (the AT-AT on its waypoints as lane 2's body is today, now with seats and its guns; the AT-ST and AT-RT steering on the navgrid with a wider body), `speeder` (bikes and the T-47 kinematic on P3's handling rows where P3 merged, else a hand row named), `turret` (the DF.9, the Atgar, the E-web: fixed, tracking), `mount` (the tauntaun at `PF_MountSpawner_*`: a rider's body with the mount's speed); boarding at the spawn or in the field (`interact`), the seat's camera from `cameras.json`; vehicle health and the destruction event (the walker's `Leftover_*` state for the world to draw).
- [ ] `vehicles.test.js`: a vehicle takes damage and dies; a seat fires its weapon; a walker arrives; a speeder stays on the ground.

### Task 4: vehicle bots and the deploy screen

- [ ] `ai/vehicleBrain.js`: walkers hunt the nearest objective and fire at what their gunner sees; speeders strafe along the front; turrets track the nearest enemy in range; mounts carry a bot to the objective; the commander buys vehicles by Instant Action's counts (`ai.json`'s `instantAction`).
- [ ] `hud/DeployScreen.jsx`: after the classes, the reinforcements, heroes and vehicles the team record lists (`teams.json`), each with the game's icon and name, its price from `points.json` and its room from `kits.json`; an offer you cannot afford says the price; a bought vehicle spawns you in it at its spawn (the game's rule).

### Task 5: on screen

- [ ] `figures/heroes.js`: a hero entity drawn with the galaxy's walrus figure (`galaxy/shared/`'s loader and cuts), its clips by lane X's stroke tables (`stanceFromTable.js`), the blade through the shared saber drawing; `vehicles/`: lane V's cuts at the entity's pose, the walker's clip pack (`clips-atat.glb`, lane W's), the turret's turn, the destruction cut; the camera rig takes the seat's camera.
- [ ] `anim-check.mjs` on a hero and the AT-ST in the game world (the owner's laptop for the WebGPU leg; software GL here).

### Task 6: docs, checks, PR

- [ ] `NOTES.md` lines; `HANDOFF-battlefront.md`, "The sixth design": G5's row with the balance tables and the offers; the spec's Departures; the parity ledger refreshed.
- [ ] Gates: lint, test, `test:ai`, build, health; `battlefront-check` with a hero bought and a vehicle boarded, shots.
- [ ] PR `Battlefront G5: heroes and vehicles in the sim`; merge `origin/main` first (G4a's modes and lane S's engine: keep both).

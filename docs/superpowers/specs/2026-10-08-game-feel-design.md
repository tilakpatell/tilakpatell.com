# Game feel, every game: the design

Date: 2026-10-08, evening. Supersedes Phase 2 of `2026-10-08-one-feel-site-wide-design.md` (whose Phase 1 pieces stand and are built on here). Rests on `docs/research/2026-10-08-game-feel-audit.md` (every playable thing on the site, read against Bruno Simon’s habits, with the numbers and the lines) and the two folio notes it cites.

## The brief

The owner, after the first round: not the car, and not a copy of his site. What he wants is how *polished his game mechanics feel*, on every game of his own. Twenty-seven playable things, a lot of work already in them, and the feel uneven: a few are his equal (Roll out, Dot Matrix, the HQ games), most have one or two of his habits, and the shared pieces that exist (`lib/three/feel.js`, the merged hit wiring) reach a fraction of them.

## What the audit found, in one paragraph

Shake is written seventeen times, nine of them ignoring reduced motion. Hitstop works in nine games, is called but dead in three, and absent in fifteen. Sound is scaled by force in seven places and fixed everywhere else. Two games have coyote time and a jump buffer; eight with a jump or a dash have neither, and three drop a press made a frame early. Three worlds emit hit events nobody answers. Secondary motion is a spring in four places and a sine or a lag in nine. Only the landings have anything that can be knocked over. Two driving games have no way to reset. The numbers that make up feel are on no panel. The full table is the audit’s “short version”.

## Goals

Measured per game, before and after, by the tests named in the plan and by hand in dev:

| what | today | target |
| --- | --- | --- |
| games whose shake is `lib/three/feel.js` (trauma², gated by reduced motion) | 9 | every game with a shake (26); the feel ratchet list in `src/components/worlds/feel.test.js` is empty |
| hitstop called and dead | 3 | 0: a loop that owns a feel multiplies its dt by `feel.timeScale(dt)` (the test pins the HQ loops, Invincible, Widow, Titan) |
| hit sounds at a fixed gain | every `play(name)` site | a hit’s gain comes from the hit law (`lib/impact.js`) or a distance; `play(name, { gain, pitch })` |
| events emitted and never answered | Cybertron `bump`, `land`; the Minecraft tribute’s all; Albuquerque’s silent bump; the universe map’s bump; the inside’s `hurt` | 0 |
| jumps, hops and dashes without coyote time and a buffer | 11 | 0 but the two faithful ones (Mario 64, the Minecraft tribute), each with a rule test |
| camera eases that depend on frame rate | the Shire, 12 towns, the Citadel, Repulsor, the cruiser page | 0 but Mario 64’s Lakitu |
| secondary motion from a sine or a lag | 9 | springs (`lib/spring.js`) on every vehicle lean, every landing squash, the cruiser’s bank, the rides’ bank |
| driving or flying games without a reset key | Albuquerque, Invincible (the water), the galaxy surface (a zone) | R puts you on the last safe spot, under a second, everywhere you drive or fly |
| games whose feel numbers are on the `?debug` panel | 0 | every game module or stage: `feelGroups`, `impactGroups`, `pressGroups` and its own |
| worlds where the player can knock something over | the landings | plus Albuquerque, Cybertron, the galaxy surface sites and the compound (Tier 3, one world a pull request, each measured) |

## Non-goals

- His time scale of 2 and his 1/30 s frame clamp. Both change every game’s pace; the games are tuned at their own.
- A fixed step for games that run on a clamped variable dt. Feel needs `1 − exp(−k·dt)` eases and a clamp, which they have; a fixed step with interpolation is a rewrite with no feel to show for it. The fixed-step games keep theirs.
- Mario 64’s and the Minecraft tribute’s input and camera: faithful to their originals, on purpose. They get sound (the tribute has none) and nothing else.
- New sounds from a service. Every new sound is synthesised in `lib/sfx.js`, as the site’s are.
- Gameplay changes: no rule, speed, cooldown, damage, save or achievement changes. Coyote time and a buffer make a press land; they don’t change what it does. i-frames in Lawn and the trench are the one rule change, and they are listed as such.
- The look (art, tone, bloom), the palette, the colliders: the first design’s pieces 1, 2 and 6 stand and come after the feel in every lane.

## Constraints

- The standing ones (`docs/health/RULES.md`, the first design): pure rules in `src/lib` with tests in Node, the three.js halves in `src/lib/three`, nothing a visitor can do lost, no dependency, every number a tier reads from `lib/budgets` or `lib/device`, British spelling, comments that say why, files under 800 lines, draw calls no higher.
- A shared piece goes down to `src/lib`; a world imports a world only through its `index.js`.
- Reduced motion: every shake, fov change and hitstop camera effect is off under `prefers-reduced-motion`; hitstop itself (a slower dt) stays, as `feel.js` has it.
- Nothing here rewrites a scene file for its own sake: feel wiring goes into the game’s `rules.js` (the event carries its magnitude), its `.jsx` handler (sound, buzz, HUD) and the smallest edit of its `scene.js` (the shake and fx). The scene files are where the open pull requests collide (below).

## The shape: the kit, then the games

### 1. The kit (`src/lib/`, one small lane, first)

What exists and stays: `lib/three/feel.js` (trauma², hitstop, punch, `calm`), `lib/impact.js` (the hit law), `lib/three/impacts.js` (the wiring), `lib/sfx.js`’s `thud`, `lib/three/dust.js`, `lib/three/pool.js`, `lib/debugPanel.js` and `rt.debug` (Phase 1D), `lib/physics/*`.

New or grown:

- **`lib/three/feel.js`**: `createFeel({ calm })` defaults `calm` to `prefersReducedMotion()` (today the caller passes it, and nine forget); gains `feelGroups(feel)` (trauma decay, offset, roll, punch τ, hitstop scale); its header states the one rule: *the loop multiplies dt by `feel.timeScale(dt)`, or hitstop is a lie*.
- **`lib/press.js`** (pure, new): `createPress({ buffer = 0.12, coyote = 0.1 }) → { press(), ground(onGround, dt), take() → boolean, pending, reset() }`: `press()` stamps the clock; `ground(on, dt)` advances it and stamps the last grounded time; `take()` answers once, true when a press is within `buffer` and the ground within `coyote`, and consumes the press. `createCooldownPress({ buffer = 0.12 }) → { press(), ready(isReady, dt), take() }` for a dash: a press during the cooldown waits `buffer` and fires as it ends. `pressGroups(press)`.
- **`lib/spring.js`** (pure, new): `springStep(x, v, target, k, c, dt) → [x, v]` (semi-implicit Euler, stable at 1/120 to 1/30), `createSpring({ k, c, max = Infinity, dims = 1 }) → { x, v, kick(dv), target(t), step(dt) → x, reset() }`. The closed car lane’s `lib/vehicleFeel.js` and `lib/three/vehicleBody.js` are cherry-picked from `origin/claude/one-feel-car` onto it (their tests with them), so a vehicle’s lean, squash and antenna are one call.
- **`lib/ease.js`** (pure, new, three lines): `damp(k, dt) = 1 − exp(−k·dt)`, `approach(a, b, k, dt)`; for rules files that can’t import three’s `MathUtils.damp`.
- **`lib/sfx.js`**: `play(name, { gain = 1, pitch = 1 } = {})`: the HQ player takes a gain and a pitch (today fixed); `hit(name, force, rules)` plays `name` at the law’s `gain` and `pitch` or nothing. The galaxy’s and the universe’s own `sounds.js` functions take a `k` where they don’t.
- **The feel ratchet**: `src/components/worlds/feel.test.js` holds `OWN_SHAKE` (the seventeen files the audit names), `DEAD_HITSTOP` (three), `NO_PRESS` (eleven), `LINEAR_CAMERA` (five), `UNANSWERED` (five) as lists that fail when a file is added or when a lane forgets to remove one it fixed; it greps the named files for the pattern (`Math.random()` or `Math.sin(` in the shake lines, `hitstop(` without `timeScale(`, and so on), so a fix that keeps the old code fails too.

### 2. The games, in three tiers (one lane a world group, every game in it)

Each lane takes its games from the roster below and works each game top to bottom; a tier is finished across the lane’s games before the next begins, and the lane merges at the end of each tier (so a lane that runs out of budget has shipped whole tiers).

**Tier 1: answer and forgive** (cheap, every game, the biggest change by eye and hand):
1. Hitstop real: the loop multiplies dt by `feel.timeScale(dt)`; the three dead calls work; the games without one get it on their heaviest hit (the audit says which: a kill, a crash, a slam, a parry).
2. One shake: the game’s own shake becomes `feel.trauma(k)` with the same k it had (the audit lists every value), `calm` from reduced motion; the HQ games already there.
3. Every event answered: Cybertron’s `bump` and `land`, Albuquerque’s bump, the universe map’s bump, the inside’s `hurt`, the tribute’s sounds; each through `lib/three/impacts.js` where it is a hit (a thud by force, dust, shake) or `play(name, { gain })` where it is a hurt.
4. Sound by force: every hit, bump, crash and land sound takes the law’s gain and pitch; a sound by distance takes `near`.
5. A press that lands: `createPress` on every jump, hop and dash the audit names; the galaxy surface’s and the compound’s one-tick queues become it; the universe foot’s held bool stops re-jumping.
6. Eases: `1 − exp(−k·dt)` where the audit found `min(1, dt·k)` or a per-frame constant.
7. A way out: R (and the pad’s Back) to the last safe spot in Albuquerque (kept every 0.5 s as Dot Matrix does), Invincible (the water lets go on R), the galaxy surface (the zone respawn moves you); i-frames 0.8 s in Lawn and 1.0 s in the trench (rule changes, tested, named in the pull request).
8. The panel: `tune()` or `stage.tune([...])` with `feelGroups`, `impactGroups`, `pressGroups` and the game’s own.

**Tier 2: springs** (where there is secondary motion):
- Vehicles: Albuquerque’s Aztek (its roll and pitch lags and off-road sine → `vehicleFeel`), Cybertron’s truck (the direct-set lean), the galaxy’s speeders and bikes (the first-order bank), C-137’s cruiser (the eased bank), the universe and galaxy ships (the eased lean; the roll from the flight model stays), the tide’s hull (already a spring: its numbers onto `createSpring`, unchanged).
- Landings: a squash on landing for every walker with a jump (Dot Matrix’s sine, Morty, the foot scene, the galaxy surface, Cybertron’s robot, the compound, the inside), `createSpring({ k 120, c 8 })` kicked by the landing speed, applied to the figure’s root scale about its feet; Invincible’s slam the same with its crater.
- The cockpit’s rumble and the Ring’s rock stay sines: they are not responses to the player.

**Tier 3: things react** (one world a pull request, after Tiers 1 and 2 are merged for the lane; each measured, and the lane stops where its budget ends):
- A `knockables` layer, `src/lib/three/knockables.js`: `createKnockables({ physics, pool, kinds = KINDS, impacts })` places a list of `{ kind, x, y, z, yaw }` as `lib/physics/props.js` bodies (asleep, light: crate 0.02, barrel 0.1, cone 0.05, bin 0.3) drawn through `pool.js` (one draw a kind), synced from the awake set, wired to `impacts.onHit`, with `collidersOf` for a modelled kind; Rapier loaded only on `high` and `ultra` and never on a phone or with Data Saver (`lib/device`), the props drawn static otherwise. The player’s body is a pusher (`lib/physics/pusher.js`); a vehicle a bumper in his group.
- Where: Albuquerque (cones, bins, crates along Central and the lots: the car bulldozes them), Cybertron (energon crates in Iacon and the base), the galaxy surface sites (crates and barrels at the stands; a speeder scatters them), the compound (the lawn’s chairs and cones). `WORLD_MB` rises by Rapier’s size on those four and says so.

### 3. The roster

| lane | games | tier 1 specifics (the audit’s lines) | tier 2 | tier 3 |
| --- | --- | --- | --- | --- |
| 2A Middle-earth | the Shire, 12 towns, the Citadel’s walker (shared `walker.js`), the rush, the bridge, Gorgoroth, the ring | the jitter shake in 15 scene files → `feel`; eases `min(1, dt·8)` → exp; the rush’s dropped dash → `createCooldownPress`; the Shire’s instant respawns get a 260 ms fade (as C-137 has); footsteps in the Shire (`sounds.step`); `walk.js` gets a test | — | — |
| 2B Star Wars | the galaxy surface and rides, the galaxy map, the trench, the inside | surface: coyote and buffer, shake gated and onto `feel`, fov with ride speed, the zone respawn moves you, `rides.test.js`; map: shake onto `feel`, crash and bump sounds by force, hitstop on a crash and a kill, a dead zone on the drag stick; trench: i-frames 1 s, shake onto `feel`, sounds by force; inside: a `hurt` sound, shake and hitstop on a hit of 25+, reduced motion | the rides’ bank, the ship’s lean, landing squash on foot and inside | the surface sites’ crates and barrels |
| 2C the universe | the map, the landings and the foot scene, the shipyard | map: shake onto `feel`, a bump answered (thud by force, dust, shake), crash sound by speed, hitstop on a crash, a dead zone; foot: `createPress` (no re-jump), the thresholds reconciled (the landing reports every contact over `threshold` and the law decides; one throttle), the knock’s kick against the gun’s; `impactGroups` on the panel; a test for `heard` → `knocks` | the ship’s lean, the foot’s landing squash | — (the landings have it) |
| 2D the cities | Albuquerque, the office (the world, the toss), Cybertron (the game, Roll out) | Albuquerque: bump → thud by force, B resets (R is its delivery; Y on a pad), shake onto `feel` gated, the panel; Cybertron: `bump` and `land` answered, shake onto `feel` gated, hitstop on a ram and a kill, coyote and buffer; the office world’s shake gated and onto `feel`, `story.js` tested; Roll out: already the model; its shake onto `feel` only | the Aztek, the truck, Cybertron’s robot landing | Albuquerque’s street props, Iacon’s crates |
| 2E the games | the HQ games, the compound, Invincible, the tide | Invincible: `feel.scale` applied (hitstop real), jump `createPress`, R lets go of the water; Widow and Titan: hitstop applied; Lawn: i-frames; Smash: a buffer; Thwip and Tesseract: hitstop on a street hit and a crash; Repulsor’s `camX` → exp; the compound: `createPress`, `feel` for its punch, sounds by force on a landing; the tide: its trauma onto `feel` (numbers kept), fov kick gated, sounds already by distance | the compound’s and Invincible’s landing squash | the compound’s lawn |
| 2F the rest | C-137 (the world, Roy, the sewer, Portal panic, the cruiser page), Dot Matrix, Mario 64, the Minecraft tribute, Earth, Music | Morty: coyote and buffer, a shake at all (landing, caught, the cruiser’s bump); Roy: its trauma onto `feel`; the sewer: a hop buffer, shake gated; Portal panic: a dash buffer, shake gated, hitstop on a boss down, a dead zone on its stick; the cruiser page: dt in its ease; Dot Matrix: shake on a hurt and a stomp, reduced motion; the tribute: a sound consumer (steps, break, place, hurt, splash) from `lib/sfx`; Mario 64 and Earth: nothing but the panel | Dot Matrix’s squash onto a spring, Morty’s landing, the cruiser’s bank | — |

The first design’s pieces 1, 2, 5 and 6 (art, tone and bloom, the panel, colliders) follow the tiers in every lane, as its per-world checklist has them.

## Open pull requests, and how a lane stays clear

Read on the evening of 8 October (`git branch -r --no-merged origin/main`, the open pull requests). A lane checks again before it edits a file.

| pull request | touches | the lane it meets | what the lane does |
| --- | --- | --- | --- |
| #656 smooth worlds (68 commits) | `shire/scene.js`, every town’s `scene.js` and `*World.jsx`, `galaxy/surface/scene.js`, `avengers/hq/engine.js`, `titan/scene.js`, `avengers/world/scene.js`, `cybertron/game/scene.js` and `sim.js`, `caribbean/tide/Tide3D.js`, `dotmatrix/scene.js`, `office/stage3d.js`, `rickmorty/citadel/scene.js` and `world/scene.js`, `universe/scene.js`, `runtime/runtime.js` | 2A, 2B, 2D, 2E, 2F | the shake and camera lines in those scene files are small and additive; make them so (new lines, nothing moved or reformatted), merge `main` daily, and resolve by keeping both; never rebase |
| #579 NPC architecture | `cybertron/game/rules.js`, `sim.js`, `scene.js`, `GameWorld.jsx`, `universe/hunters.js`, `npcs.js`, four towns’ `scene.js`, `lib/sim/fixedStep.js` | 2D, 2C, 2A | Cybertron’s `bump`/`land` consumer goes in `GameWorld.jsx`’s event switch (additive); `rules.js` is not edited beyond the magnitude on the event |
| #679 squads | `universe/scene.js`, `online/*`, `galaxy/warfront.js`, `towns/travellers.js` | 2C, 2B, 2A | nothing of this design touches `online/`; `universe/scene.js` edits additive |
| #694 the Death Star cast | `deathstar/inside/*` (18 files) | 2B | the inside’s hurt sound goes in `hear.js` (one case) and the shake in `scene/index.js`; wait for #694 if it is still open when 2B reaches the inside, and say so in the handoff |
| #703 Earth on WebGPU | `earth/module.js` | 2F, and 1D’s `tune()` | Earth gets nothing but the panel; whichever merges second merges first |
| #706 kit worlds 2 | `lib/three/kit.js`, `leaves.js`, `puffs.js`, `weather.js` | none | — |
| #669 nature kit | `galaxy/surface/scene.js`, `sites/*` | 2B | as #656: additive, merge daily |
| the combat revamp (`docs/superpowers/plans/2026-10-08-combat-revamp.md`, six lanes `claude/combat-<lane>`, #707 docs, #723 lane B merged, A, C, D, E, G running) | A: `runtime/look.js`, `runtime/hud/Reticle.jsx`, `lib/combat/aim.js`, the look wiring in `galaxy/surface/scene.js`, `universe/footScene.js`, `rickmorty/world/RmWorld.jsx`; B: `lib/combat/bolt.js`, `accuracy.js`, `lib/three/combat/bolts.js`, `galaxy/surface/blaster.js`, `ground/bolts.js`, `ground/fight.js`, `hostiles.js`, `universe/foot.js`; C: `galaxy/surface/saber.js`, `combatRules.js`, the swing and saber paths in `scene.js`, `lib/three/clipLibrary.js`; D: `galaxy/surface/activity.js`, `heldBlade.js`, the duellist spawns in `sites/*.js` | 2B, 2C, 2F | **the combat lanes own the saber, the blaster, the bolts, the look and the reticle; the feel lanes do not edit those files or paths.** Feel on the surface, the foot scene and C-137’s world is wired at the events those systems emit (`hit`, `parry`, `hurt`, `bump`, the landing) in the `.jsx` handlers and through `feel`; the shake and hitstop values go where the handlers already call them; `combatRules.hitStop` stays the combat lane’s (2B reads it, never edits it). A press for a jump or a dash is in `walker.js` and the rules, not in the combat paths. Where a feel change can only go in a combat-owned file, it is a line in the handoff’s Findings for that lane, not an edit |
| #701 the art, #702 the panel, #705 the Expanse out | Phase 1 | all | Phase 2 starts from `main` with these in |

## Testing

- The kit: `press.test.js` (a press 0.1 s before landing fires on landing; one 0.2 s before doesn’t; a jump 0.08 s after walking off the edge fires; 0.15 s after doesn’t; `take()` answers once; a dash pressed 0.05 s before the cooldown ends fires as it ends), `spring.test.js` (at rest stays; a kick rings down under `c`; stable at dt 1/30 and 1/120; the max holds), `ease.test.js`, `feel.test.js` (`calm` defaults from reduced motion; `feelGroups` reads and writes), `sfx.test.js` (`play` with a gain scales the scheduled gain; `hit` below the threshold plays nothing), the ratchet `feel.test.js`.
- Each game: its `rules.test.js` gains the press cases (a jump that lands within the coyote window, a buffered press on landing) and the event’s magnitude; the i-frame rules are tested; `rides.test.js`, `walk.test.js` and `story.test.js` are new.
- Every lane: the standing checks (`npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`, `node scripts/autopilot-check.mjs --routes <its routes> --shots feel-<lane>`), and by hand in dev for each game: a hit thuds louder when harder, the camera shakes and stops under reduced motion, a press a hair early lands, R gets you out, `?debug` shows the numbers.

## Rollout

1. **Lane 1F, the kit** (`claude/feel-kit`, from `main`): `press.js`, `spring.js`, `ease.js`, `feel.js`’s defaults and groups, `sfx.js`’s gain, the cherry-picked `vehicleFeel.js` and `vehicleBody.js`, the ratchet test with its lists filled from the audit. One pull request, small, first.
2. **Lanes 2A to 2F** (`claude/feel-<group>`, from `main` once 1F and Phase 1 are in): the roster, tier by tier, a pull request a tier (Tier 3 a pull request a world). Each lane fills its row in `docs/superpowers/HANDOFF-universe.md`.

## Decisions

- **The kit over a framework.** Three pure files and two grown ones; no engine, no scene rewrite. The games keep their loops and their rules; feel is wired at the edges, which is also where the open pull requests don’t reach.
- **His law, their numbers.** The hit law is his (gain by force squared, a pitch range, a throttle); every shake keeps the k it had so nothing a visitor feels changes but the parts that were missing.
- **Roll out is the house reference** for a jump (coyote 0.1, buffer 0.14) and Dot Matrix for a short hop and a safe spot; the kit’s defaults are theirs, rounded.
- **Tier 3 is gated by budget and tier.** Knockable props are the most visible of his habits and the most expensive to add; a lane ships its first two tiers before it spends on them, and one world at a time.
- **Faithful ports stay faithful.** Mario 64 and the Minecraft tribute keep their input and cameras; the tribute gets the sounds its rules already emit for.

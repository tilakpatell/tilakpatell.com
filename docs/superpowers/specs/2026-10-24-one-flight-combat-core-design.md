# One flight-combat core, one flight HUD

The owner, 2026-10-24: “revamp the ship targeting and weapons system to make it more robust and better along with the enemy ships and bounty system”, and then: “make it not have its own hud and stuff, make everything shared and the same core and gui”.

The universe map and the galaxy’s space flight fight with the same rules, copied into each scene. Each keeps its own lock, its own guns, its own bolt pool and its own HUD writer, and the copies have drifted. The audit (`docs/research/2026-10-24-ship-combat-audit.md`) found 29 confirmed bugs, 18 of them in the code this lane moves. This is the first of four lanes: the player’s targeting, guns and flight HUD go into one pure core and one kit part, both maps use them, and the bugs in that code are fixed.

Short names: US is `src/components/universe/scene.js`, GS `src/components/galaxy/scene.js`, F/ `src/lib/combat/flight/`, K/ `src/runtime/hud/`. Line numbers are at `cc5e2eaf`.

## The four lanes

Each has its own spec, plan and pull request, in this order.

1. **One core, one HUD** (this spec).
2. **Targeting and weapons play**:
   - targets: a kind and side on every target, so priority and friend-or-foe work; a fuller target card (shields, side, on you, bounty);
   - ordnance: a missile lock with an acquire time, a tone and break-lock; a warning when a missile is on you; countermeasures;
   - feedback: where a hit came from; a kill mark;
   - guns: a cooldown per line; muzzles per line; a unique part after a skill reset;
   - input: a target button on touch, and gamepad flight.
3. **Enemy ships**:
   - one ship table and one dogfight brain for hunters, battles and wingmen;
   - shields and hull, and parts that matter;
   - hunters dodge your torpedoes and fight your wingmen and escorts;
   - capital ships are solids to them;
   - one difficulty curve on both maps;
   - the forgotten-belief chase, the medic’s overheal and the galaxy’s missile warning fixed.
4. **The bounty**:
   - one pure judge of crime, pay and side, which fixes friendly traffic, the law’s enemies, Gus’s Madrigal, and the crew’s side against the sector’s;
   - bounty contracts in space on named marks;
   - a bounty that fades;
   - a choice of how to pay;
   - a Most Wanted;
   - the law in the galaxy;
   - the Wanted achievement and `events-check` fixed.

## Decided with the owner

- Both maps share one core. The rules move down to `src/lib` and the HUD to `src/runtime/hud`, as RULES.md says a thing two worlds need does. Lending through `universe/shared/` was turned down: the galaxy would stay tied to the universe, and the HUD would stay a world’s.
- **One HUD, the same parts on both maps, world tints by tokens only.** The galaxy keeps the Battlefront HUD font and its GameIcon sprites (`2026-10-11-bf2017-galaxy-in-space-design.md`); the universe keeps the ship’s `--engine` colour.
- **Every part on both maps**: radar, speed, kills, the target card, the wanted strip and the altitude gauge, each shown when it has something to show. The galaxy’s wanted strip waits for lane 4’s law. The Citadel line stays a universe slot; the galaxy’s WarHud, StarfighterHud and objectives stay galaxy slots.
- **One word for the shield bar on both maps: “Shields”** (RULES.md, UI 4). On foot it stays “Health”.
- **One distance unit in the flight HUD: map units**, as the galaxy shows them, on the lock, the target card and the nav diamond. The nav map’s chart keeps its own.
- **The overlay’s labels go up to 0.7 rem**, the phone’s override too.
- **The unique arms hit what a bolt hits, except other pilots and traffic.** Pilots, because the arsenal spec rules it out. Traffic, because a traffic kill is a crime and crime is lane 4’s. The Citadel and the leviathans are in.
- **Moves first, fixes after.** Commits that change no pixel come first (RULES.md, “A repair changes no pixel”). Then the fixes, one a commit, each test first. Then the commits that change the picture, with before and after shots.

## The core

All pure: no three.js, no DOM, no React. Each file has its test beside it.

### `src/lib/flight/orient.js`

- Moved from `universe/orient.js` with `git mv`. `targeting.js:42` needs it, and lib may not import up.
- It lives under `lib/flight`, not `lib/combat`, because `ship.js`, `entry.js` and `protocol.js` use it too.
- It gains `forward(heading)` from `universe/ship.js:267`; `ship.js` re-exports it.
- `universe/orient.js` becomes a barrel.

### `F/targeting.js`

- Moved from `universe/targeting.js` with its test. Only the two import lines change. The old path becomes a barrel, so its eleven importers are untouched.
- Fix B1: `track` finds a lock picked by hand even past `AIM.range × 1.3`, and its grace runs down as it does inside. An auto lock is unchanged.
- Fix B2: `track(s, cands, lock, dt, { cycle, ring })`. Given `ring` (ids the caller keeps), a cycle steps through the ring’s order instead of re-sorting by the nose.

### `F/sight.js` (new)

The player’s targeting, one per scene, writing into the scene’s `state`. The names stay where they are, because outside writers and readers use them: US:4667 and 5865, GS:522, `galaxy-hud-check.mjs:310`, `galaxy-powers-check.mjs:122`, the pilots’ `locked`, `powers.aim`.

```
createSight(state) → {
  update(ship, cands, dt, o) → ticked   // o: { speed, life, help() → { assist }, tracks(t) → bool, quiet }
  inReach() → bool                      // state.lead && state.lead.t <= o.life
  aim(dir, ship, strength) → dir        // assist onto the lead while inReach
  nudge(ship, stick, strength) → { turn, climb } | null   // while trackable and inReach
  find(id) → target | null              // this frame's foes, ungated (below)
  pickAt(x, y, project, reach = 48) → id | null           // nearest in front, depth > 0.3
  lean(bias, ship, dt, reduced)         // the camera's lean toward the lock (US:4545-4561 = GS:1827-1840)
  cands
}
```

What `update` does:
- It writes `state.lock`, `state.cycle = 0`, `state.lockTarget`, `state.trackable`, `state.lead` and `state.hot`, and returns whether a new lock was taken, for the tick.
- It reads `help()` only after `lockTarget` is written, because `powers.aim` reads the lock (`powers.js:117`, `495`).
- `TRACK_AFTER_SHOT` lives here once (copied today at US:291 and GS:194).

The T ring:
- It is kept until the lock is lost or written from outside (a tap, a pose, a check), never on a timer: slow presses reach the third target too.
- A dead id drops out. A new target in the hold cone joins at the end, so the ring is never re-sorted.

The two lists:
- `find` and the unique arms see the **ungated** foes: hunters (less prey), the front, skirmishes, NPCs, the capital ship, the Citadel, the NX-5 and rocks.
- The list handed to `track` keeps today’s gating: rocks only while nobody is after you, and someone else’s fight only while you have none of your own (US:4525-4528).

### `F/guns.js`

Moved into it:
- `fan` and `steer`, from `weapons.js:180-235`, which re-exports them;
- `gunsUnder` and `RAPID_PUNCH_CAP`, from `galaxy/pickups.js:33-39`, which re-exports them;
- `CADENCE`, from US:235 and GS:157, the two tables being the same;
- `shotPunch`, from `galaxy/gunRules.js:10`, which re-exports it.

`armsTabRules.js`’s `STOCK_CADENCE` and `streetFight.js`’s `FIGHT.cadence` read `CADENCE` from here, and their comments say so.

```
pace(base, delay, fastest, out = { gap, punch }) → out
  // wanted = base × delay; gap = max(fastest, wanted); punch = min(RAPID_PUNCH_CAP, gap / wanted)
  // gunsUnder(b, d, f) is pace(max(f, b), d, f), exactly as before
createGuns({ count = 40, point }) → {
  bolts,                                 // [{ on, at, from, v, life, punch, damage, heavy, warPunch, heading, pitch, scale, fresh }]
  fire(at, dirs, speed, { life, punch, damage, heavy = false, scale }),   // a full pool takes slot 0, as today
  step(dt, sources) → anyInFlight,
  strike(from, to, shot, sources) → hit | null,
  clear()
}
// a source: (from, to, shot) → truthy if it took the shot
// a shot:   { punch, damage, v, heavy, warPunch }; v defaults to the way from → to
```

- `point` is the scene’s `() => new THREE.Vector3()`, made once a slot. The hit tests still get Vector3s (`removerHit` clones them, US:2458), and `strike` copies `from` and `to` into its own points first.
- `lib/combat/bolt.js` is not reused. Its contract is the ground’s solids, capsules and blades; a flight hit is the scene’s own swept test with its effects inside it.

### `F/roundRules.js`

- Moved from `universe/roundRules.js` with its test; the old path becomes a barrel.
- Fix B3: `homeOn(d, find)` sets `d.target = find(d.targetId)` each step. While that is null the round flies straight on, and it homes again if the target comes back.
- `rounds.js` stays in the universe, since it makes meshes, and gains `clear()`.

### `F/radar.js`

- Moved from `galaxy/radar.js` with its test; its one importer is repointed and the old file goes.
- It gains `due(clock, hz = 20)`, the throttle the galaxy has inline (GS:2057).

### Elsewhere in lib

- `src/lib/combat/contact.js` gains `shotRadius(size) = size × 0.9 + 0.12`, the bolt’s rule; `hunterRules.js:199`’s `hitRadius` becomes `shotRadius(type.size)`.
- `src/lib/arms/behaviours.js`:
  - `pierce(from, to, list, hit, radius = (t) => (t.size ?? 1) / 2)`; the default keeps today’s behaviour.
  - `orbsInFlight(w, fastest, { shots, life })` gives the most orbs a weapon can have in flight.

## The one hit list

Each scene builds `BOLT_HITS` once, in today’s order (US:2563-2616):

1. the NPCs’ stim, which never stops a bolt;
2. hunters, then far fights, then the front;
3. pilots;
4. the Citadel, which takes `shot.heavy`;
5. the capital ship, the NX-5, traffic, leviathans and rocks.

Each closure keeps today’s effect lines word for word, reading the shot’s `punch` and `v`.

Bolts, torpedoes and unique arms all go through it:
- Bolts: `guns.step(dt, BOLT_HITS)`.
- Torpedoes: through `guns.strike` with `heavy: true`, keeping each source’s blast. `missileHit`’s own hand-ordered chain (US:2728-2795) goes.
- Unique arms: `UNIQUE_HITS` is the same list without the stim, the pilots and the traffic.
  - Seismic and crystal land as `heavy`; dark matter and energon do not.
  - Each lands with its own punch and the objective’s `warPunch`.

The galaxy’s list is its `strike` today (GS:1136-1145): hunters, war, then pilots; its unique list leaves out the pilots. It also gains the set-piece Star Destroyer it already builds (`createSetPieces`, GS:334) as a target and a hit source, as the universe has it, so the same ship is fair game on both maps.

## The HUD

### `K/flight/frame.js` (pure)

`createFrame()` and `fillFlight(frame, v, project)` fill one record per frame, made once and filled in place:

```
{ on, static, rect,
  reticle: { on, x, y, hot, hit, kill },
  lock:    { on, x, y, z, r, hot, name, dist, text, tough, hp } | null,
  lead:    { on, x, y, hot },
  threats: { n, at: [{ x, y, z } × 3] } | null,      // every candidate with a threat
  mates:   { n, at: [{ x, y, z, name } × 4] } | null,
  nav:     { on, x, y, z, r, way, name, dist, text } | null,
  cluster, speed, kills, target, radar, wanted, alt }
```

- The bracket keeps today’s expression and clamp: `(size / (z × tanHalf)) × (h / 2) × 2.6`, 30 to 140 (US:2928).
- The maps’ own numbers are inputs: the nav clamp (`navMax`), and on foot the lock at ×1.6 clamped 26 to 120 and the nav at 40.
- A `null` part is left as it is; that keeps the on-foot HUD exact.
- `distText(d)` is the one distance formatter, the galaxy’s rule at GS:2019.

### `K/flight/flightHud.js`

- `createFlightHud({ distText }) → { place(root, frame), writes }`.
- It writes a value only when it has changed. That includes the `data-hot`, `data-hit`, `data-kill` and `data-tough` flags, which today are written every frame.
- `hudEls`, `setText`, `setOn` and `placeMark` move here verbatim (US:2863-2903).
- It builds on the kit’s `createFlightCluster` and draws the radar through `radarDraw.js`, moved here from the galaxy with its test.
- It toggles `data-static` on `.universe-hud` for the flare’s scramble (US:4045-4047).

### `K/flight/FlightHud.jsx`

- Today’s overlay markup, which is the same at UM:359-393 and GV:256-288, with the same classes.
- A slot right after the reticle for the on-foot crosshair, so it paints under the brackets as now.
- The cluster’s parts: vitals “Shields”, arms, powers, radar, speed, kills, the target card, wanted and altitude. Their `.fc-*` classes are kept, because `galaxy-hud-check` queries them.
- World slots: `overlay`, `row`, `over`, `after`, `thumbs`.
- One thumbs grid of the kit’s TouchButtons, with the universe’s guarded handlers (`if (down) e.preventDefault()`, UM:261-272), and one stick.
- One jump button with `kbd.hud-cap`, and one cluster-height observer writing one variable.

### Imports, CSS and look

- The pages mount `<FlightHud>` from K/index.js. The scenes import `frame.js` and `flightHud.js` directly, as US:202 imports `K/cluster.js`, so a scene’s chunk takes no JSX and no CSS.
- `K/flight/flight.css` takes the overlay’s rules: `universe.css:521-691`, `694-695`, the phone’s `1288-1291` and the reduced motion `1316-1319`, and the galaxy’s kill X (`galaxy/flight.css:63-69`). Each is wrapped as `:where(.universe-hud) .x`, which drops the outer weight and keeps the rules’ order against each other.
- No class is renamed.
- Tints are custom properties set by the world, nothing else:
  - the galaxy: `--hud-key-face`, the Battlefront HUD font, and GameIcon `hud:speed` passed in as the speed icon;
  - the universe: `--engine`.

### What each map feeds

- **The radar, the galaxy’s rule on both maps** (GS:2052-2074).
  - Hostile: every foe in the sight’s ungated list, marked as a threat when it carries one. Other pilots only when they carry a threat.
  - Ally: your mates, your wingmen, and the front’s fighters on your side.
  - Pickups: the galaxy’s.
  - Goal: the nav goal. The galaxy still writes `state.navGoal`; the universe passes `navGoal`’s point.
- **Kills.** A kill is a ship your shots bring down: hunters, far fights, the front, other pilots’ hunters. Not traffic, rocks or parts. The universe gains `state.kills` and `killMark`, written in `hunterShot`, `pilotShot`’s hunter branch, and the hunter and pilot branches of the old `missileHit`.

## The fixes

| # | fix | where | the test that pins it |
| --- | --- | --- | --- |
| B1 | a lock picked by hand keeps its grace past 78 | `track` | targeting.test: manual at z −79 kept to 4 s; auto unchanged |
| B2 | the T ring holds | `track({ ring })`, the sight’s ring | targeting.test and sight.test: three targets, the nose settled on each, presses 0.3, 3 and 10 s apart all reach the third |
| B3 | a torpedo flies straight once its target dies, and homes again if it comes back | `homeOn` | roundRules.test |
| B4 | the lead, hot, assist and tracking take the selected weapon’s speed and life; hot honours Force Focus | `sight.update`’s `speed`, `life`, `help` | sight.test: the spread never hot past 0.4675 s; dark matter’s lead t ≈ 1.79; hot at 0.25 rad with assist 2.5 |
| B5 | no lock tick in the whole-map view | `o.quiet` | sight.test |
| B6 | a tap picks any target, and beats the planet behind it; in the map view a tap still picks the planet | `sight.pickAt`, only when flying, not on foot and not in the map view, after the sign and phone picks | sight.test with a fake projector |
| B7 | threat arrows from every candidate with a threat | `fillFlight` | frame.test: a front fighter behind with threat 1 gets an arrow |
| B8 | on the X-wing, fire rate past the 0.12 s cap turns into punch, capped at `RAPID_PUNCH_CAP` | `pace`, `shotPunch` | guns.test: Incom on the X-wing gives gap 0.12, punch 0.12/0.084; pickups.test unchanged |
| B9 | dark matter: the pool holds the most orbs in flight; its pierce radius is the bolt’s | `orbsInFlight` sizes `ORBS` (`uniqueFx.js:21`) for the worst case; `pierce(…, shotRadius)` | behaviours.test, contact.test |
| B10 | the unique arms reach every foe, the Citadel included | `land` through `guns.strike(from, to, shot, UNIQUE_HITS)` | uniqueArms.test (new): a seismic ring lands heavy on a Citadel source and hits a rock and a skirmish ship during a hunt; the arc reaches a front lock; every source gets a whole shot |
| B11 | shots in flight are cleared when you die | `guns.clear()`, `rounds.clear()` beside `unique.clear()` (US:3046, 3113; GS:1187, 1218) | guns.test; a browser probe (a torpedo, a crash, no rounds left) |
| B12 | the galaxy reads the difficulty setting | `hunters.difficulty`, × damage at GS:1874, × regen at GS:1966, through `universe/shared/flying.js` | shared.test (one more name); a `galaxy-hud-check` line |
| B13 | the galaxy’s touch Fire, Boost and climbs hold when the thumb drifts | the kit’s TouchButton with the guarded handlers | a markup test of a small touch component; a `galaxy-hud-check` run that drifts off a held Fire |

## The commits

Every commit passes `npm run lint`, `npm test`, `npm run build` and `node scripts/health.mjs --check --skip build`. No measured health number may go above the commit before it.

### Phase 0, on `main`, nothing committed

- `scripts/universe-check.mjs --baseline` at high and low, taken twice; the difference between the two runs is the noise floor.
- `scripts/galaxy-hud-check.mjs`, and `scripts/autopilot-check.mjs --before` on `/universe` and `/galaxy`.
- The health numbers measured, not the budgets. At `cc5e2eaf`: boundary-breaks 484, kbd-styles 68, big-files 22, cycles 5.
- `wc -l` of both scenes; draw calls and triangles per pose.
- On every pose, a lock is forced on a spawned hunter through `__universeDebug` before the shot. Today’s poses clear the lock (US:5865), so the bracket would otherwise never be pictured.

### Phase A: moves that change no pixel

| commit | what | boundary-breaks |
| --- | --- | --- |
| A1 | orient to lib; `galaxy/space.js:38` repointed | −1 |
| A2 | targeting to lib; GS:107 and the four warpieces repointed | −5 |
| A3 | `guns.js`; roundRules to lib | 0 |
| A4 | radar to lib, radarDraw to the kit, `forward` to orient | −2 |
| A5 | the sight takes both lock blocks, both leans, the nudge and fire’s aim, fed today’s inputs (`AIM.bolt`, `AIM.life`, the raw `controls().assist`) | 0 |
| A6 | `frame.js`, `flightHud.js` and the overlay; both `placeHud`s and the on-foot HUD fill records | 0 |
| A7 | `createGuns` with `BOLT_HITS`, `pace` equal to `gunsUnder`; torpedoes and the uniques through the same list, in today’s reach | 0 |

RULES.md’s recipe keeps callers on the old path for a pull request. Here the galaxy’s callers are repointed in the same one, because the galaxy no longer importing the universe is part of what the owner asked for. The commit bodies say so.

Each A commit shows:
- the moved files as git renames whose only changed lines are imports, with `--color-moved` showing the bodies as moved;
- no existing test’s expectations changed;
- every shot within the noise floor;
- draw calls and triangles equal;
- the `galaxy-hud-check` bracket shots the same.

The hit order is proved by `guns.test`’s recording sources, and in the browser by one bolt fired through a stacked hunter, Citadel and rock, logging which effect ran first.

### Phase B: the fixes

B1 to B13 in the table’s order, one commit each, test first. B6, B7 and B13 also take before and after shots.

### Phase C: the picture changes

Before and after shots on both maps at 1440×900, 390×844 and 844×390.

- **C1** one distance unit, through `distText`.
- **C2** the labels at 0.7 rem, the phone’s too.
- **C3** the overlay’s CSS into `K/flight/flight.css`. The shots should not move, and a computed-style check over static × off × hot × threat, before and after, must match.
- **C4** every part on both maps:
  - the radar, speed, kills and the target card, and “Shields”;
  - PowerBar through `universe/shared/powerBar.js` (−1 boundary-break);
  - `FlightCluster.jsx` goes, and `galaxy/cluster.js` keeps only the pickup chips;
  - one `hud` ref;
  - the siege, WarHud and StarfighterHud in slots;
  - every case of `galaxy/cluster.test.js` and `FlightCluster.test.jsx` moves into the kit’s tests with the same expectations, so none is lost.
- **C5** one thumbs grid and stick, in the universe’s layout (UM:418-463), and one jump button; kbd-styles falls.
- **C6** the tints.

## Tests

New:
- `F/sight.test.js`:
  - after A5, `update` gives exactly what `track`, `intercept` and `assistAmount` give when called as the scenes call them;
  - then B2, B4, B5 and B6;
  - the ring is dropped when the lock is written from outside;
  - `help` is read after `lockTarget`;
  - records keep their identity over 100 steps.
- `F/guns.test.js`:
  - a full pool reuses slot 0;
  - the first source to take a shot wins, and one that doesn’t passes it on;
  - life;
  - `strike` copies into its own points and hands on a whole shot;
  - `clear`;
  - `pace` equals `gunsUnder`, then B8.
- `src/lib/flight/orient.test.js`.
- `K/flight/frame.test.js`: the sort order; on-screen marks skipped; at most 3 threats and 4 mates; the lead gated by `life`; the bracket’s clamp; the nav clamp per map; the on-foot lock.
- `K/flight/flightHud.test.js`, with stand-in elements that count writes:
  - the exact `translate3d(…)`, `--a`, `--r` and `--hp` strings and the `data-*` flags;
  - a `null` part left alone;
  - `data-static`;
  - the same frame twice makes no writes.
- `K/flight/FlightHud.test.jsx`: the markup is both old copies’ child for child; the only key caps are `kbd.hud-cap`; the touch buttons are TouchButtons.
- `universe/uniqueArms.test.js`, and `tints.test.js` (a world’s flight CSS sets custom properties only).

Extended: `targeting.test` (B1, B2), `roundRules.test` (B3), `behaviours.test` (B9), `contact.test`, `universe/shared/shared.test.js`.

Unchanged in what they expect, only an import line at most:
- `targeting.test`, `roundRules.test`, `radar.test`, `radarDraw.test`;
- `weapons.test`, `pickups.test`, `gunRules.test`, `streetFight.test`;
- the existing `behaviours.test` cases, `difficulty.test`, `outfit.test`;
- `K/cluster.test`, `clusterView.test`, `parts.test.jsx`;
- the galaxy’s `cluster.test` and `FlightCluster.test.jsx` until C4 moves them.

No test is skipped, loosened or deleted.

## Gates and measures

| measure | holds to |
| --- | --- |
| draw calls and triangles per pose | equal through phases A and B; `ORBS` stays one instanced draw |
| `sight.update`, `guns.step`, `fillFlight` and `place` together | p95 0.3 ms or less, with 60 candidates and 40 bolts |
| allocation on the hot path | none from `frame`, `flightHud` or `guns` in a 10 s fight; the sight no more than `track` allocates today |
| `flightHud.writes` | 6 or fewer a frame with a lock held; none in the map view |
| a radar draw | 0.5 ms or less |
| US (6,409 lines) and GS (3,092) | may only fall: about −250 and −230 |
| new files | each under 400 lines |
| boundary-breaks | 484 to 475 |
| kbd-styles | 68, falling at C5 |
| bundle chunks | compared before and after A2 to A4 |

## Risks

- **Vector3s held by reference.** `point` copies, so every hit function is checked for `.clone()`, `.copy()` and points it keeps. `siegeHit` returns a shared `siegePoint` that `missileHit` cloned; its blast keeps the clone.
- **Homing by id.** A round now flies straight whenever its target leaves the foes list while alive: a pilot turned hidden, safe or ally; the capital ship once you are past it; the Citadel past `SIEGE_NEAR`; the NX-5 past 900. Rocks and other people’s fights stay in, because `find` reads the ungated list. In a dive or a frozen frame the lock block does not run, so `find` reads the last frame’s list. `roundRules.test` pins each.
- **The unique arms’ reach.** Crystal shards and seismic rings now reach the Citadel, the capital ship, the NX-5, rocks, the front and skirmishes. With the lead worked out for each weapon (B4), seismic’s short reach (about 10 units) means its pip shows only close in; the after shots show that.
- **The X-wing hits harder.** Incom gives ×1.43 punch. Online is untouched: other pilots take `damage`, and `PUNCH_MAX` still clamps.
- **The cascade in C3.** `:where()` wrapping is checked by computed style, including `desk.css:65` and the galaxy’s kill X.
- **The galaxy’s touch layout** moves in B13 and C5. Shots are taken at all three sizes.

## Decided in writing

Correct any of these in review.

- The hangar’s readout for a part on a ship already at the cap names punch, not fire rate: “Punch +43%” in place of “Fire rate +43%” (`outfit.js:351`). The 1.5 punch cap holds for fitted parts too, so Incom with Quick trigger is 1.5, not 1.55.
- `difficulty.js` stays in the universe, since its test imports `hunterRules`’ `SKILLS`; `universe/shared/flying.js` lends `difficultyOf` to the galaxy.

## Not in this lane

Everything listed under lanes 2 to 4. Nothing about enemy AI or the law changes here, except that the galaxy now reads the difficulty setting it already shows. No new dependency, no new save key, no new wire code. Every key, gesture, save key and dev hook works after as before.

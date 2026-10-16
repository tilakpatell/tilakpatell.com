# NPC intelligence: one AI toolkit under every world's characters

The site has a dozen kinds of NPC, each written on its own: the universe map's named characters (`universe/npcs/brains/`, nine brains over `npcRules.js`), the hunters that come for you there (`hunterRules.js`), the wingmen (`wingRules.js`), the skirmishes and fleet battles, the galaxy's surface life and its hostiles (`galaxy/surface/actors.js`, `hostiles.js`, `activity.js`), the Battlefront armies (`missions/assault.js`), the watchers who hunt you on foot across seven worlds (`middleearth/towns/watchers.js`: Bree's Nazgûl, Maggot's dogs, Boromir and the Uruks, Moria's troll, Shelob, the Easterlings, the Citadel's guards), Bob-omb Ridge's cast (`mario64/rules/actors/foes.js`), Cybertron's bots, the Invincible city's people and traffic. All of them are the right shape: pure rules over plain numbers, seeded, tested in Node, drawn by a thin three.js layer. All of them are also simple in the same three ways. Every one reads your true position every frame, so none can be fooled, none searches and none feels fair. Every one is a small state machine on hand-picked timers, so none weighs one option against another. And every group shares at most a slot count, so no pack flanks, no squad covers a retreat, no two guards split up to look for you.

This is the design for an AI toolkit the worlds share (`src/lib/ai/`, pure and tested, the way `lib/three` holds the drawing they share) and for moving each NPC system onto it, one system a pull request, without changing what a visitor can do. The research behind it is `docs/research/2026-10-07-game-ai-npcs.md`: what F.E.A.R., Halo, The Last of Us, Splinter Cell, Crysis, Days Gone, Dishonored 2, DOOM, Alien: Isolation and Guild Wars 2 do, and which of it fits a static site.

## What it is not

- **Not a dependency.** No Yuka, no behavior3js, no recast. The shapes port in a few hundred lines on the site's own `{ x, y, z }` points and seeded random, and stay tested the way everything else is.
- **Not a rewrite of any world's gameplay.** Every key, line, event, save key, achievement and dev hook works after as before. A brain's *intent* shape (`{ to, match, speed, fire, say, event, leave }`) is kept; what changes is how the brain arrives at it.
- **Not a planner.** F.E.A.R.'s lesson is that the squad behaviours players praised emerged from individuals re-deciding; the site's NPCs have two to five actions each, and scoring them is the same decision at a tenth of the code.
- **Not cheating.** A brain reads the world through its perception, never `world.you` straight, except where the design says the character knows (a nemesis who has your scent; the director, which always knows and never tells).

## The toolkit: `src/lib/ai/`

Eight modules, each pure, each with its own test, each usable alone. Points are `{ x, y, z }` (a surface world passes `y: 0`), time is seconds, random is a `rand()` the caller gives.

### `utility.js`: weighing options

The Infinite Axis Utility System as Guild Wars 2 and Project Borealis build it, cut to what the brains need.

- `curve.linear`, `curve.poly(k)`, `curve.logistic(k, mid)`, `curve.inverse`, `curve.peak(at, width)`: response curves on 0..1. A preset palette, not arbitrary curves.
- `consider(value, [lo, hi], curve)`: normalise between bookends (clamped), remap. Outside the bookends is 0 or 1.
- `score(option, ctx)`: an option is `{ id, weight = 1, considerations: [(ctx) → 0..1] }`; the considerations *multiply*, short-circuiting at zero, so cheap ones go first.
- `pick(options, ctx, { current, momentum = 0.15, rand, rank })`: scores every option; the running one scores `× (1 + momentum)` so it holds against near-equals; with `rank` (dual utility) only the top rank's options are eligible; the winner is the best, or with `rand` weighted-random among those within `spread` of the best (default: best only). Returns `{ id, score, scores }`.
- `runtime(t, [lo, hi])` and `cooldown(since, s)`: the two standard considerations (`1 − x^6` over the run, `x^5` since the last), so a decision stops being chosen after a while and can't be chosen again at once.

A brain that used `if (hurt > half) fallback` writes `{ id: 'fallback', considerations: [ctx => consider(1 − ctx.hp, [0.3, 0.6], curve.poly(2)), ctx => consider(ctx.allies, [0, 2], curve.inverse)] }` and the fallback comes earlier when it's alone, later with friends about, and never twice in a row.

### `tree.js`: scripting a meeting

A behaviour tree in 80 lines, for the brains whose shape is a script (the inspector's pull-over, the trickster's toll) with utility where a step is a weighing.

- Leaves are plain functions `(bb, dt) → 'running' | 'done' | 'failed'`, reading and writing a blackboard `bb` (the brain's `me.mind`).
- `sequence(...)`, `select(...)`, `parallel(...)`, `guard(test, node)`, `cooldown(s, node)`, `repeat(node)`, `utility(options, byId)`: the last runs `utility.pick` over its options and ticks the winner's node, so a selector can be a weighing.
- `tick(node, bb, dt)`: one tree instance serves every agent; the blackboard holds the running node's index, so a sequence resumes where it was (no re-walk from the root every frame).

### `perception.js`: what an NPC believes

Crytek's target tracks and The Last of Us's memory markers, together.

- `createSenses({ sight: { range, cone, far? }, hearing: { range }, smell?, memory: 2.5, intuition: 2.5 })`: the senses of one kind.
- `sense(senses, me, world, dt, { seesThrough })` folds the frame's stimuli into `me.beliefs`, one per target id: `{ id, at, vel, seenAt, heardAt, confidence 0..1, visible, kind }`. Sight: inside the cone (`dot ≥ cone`) and the range, and `seesThrough(a, b)` says the way is clear (the caller's line-of-sight: the surface's `sightClear`, the map's `blocked`), confidence rises along a *detection timer* scaled by distance (at the edge of range the timer is `far` seconds; at half, half); out of sight it holds for `intuition` seconds at the true position (Welsh's 2.5 s, what Halo and Crysis do), then the belief *coasts* along its last velocity and confidence decays over `memory` seconds to zero. Stimuli (`world.stims`: `{ type, at, radius, from, loudness }`: a shot, a running step, a door, an explosion) raise confidence by their loudness to a ceiling below sight's and set `heardAt`.
- `belief(me, id)`: the best current belief, or null once forgotten. `target(me, { hostile })`: the highest-confidence hostile belief. Every brain aims and steers at a belief, never at `world.you`.
- `share(from, to, { fade })`: a sighting handed to a squadmate at lower confidence (The Last of Us's data packets; F.E.A.R.'s radio).

### `search.js`: looking for someone

Welsh's two-phase search and Dishonored 2's flood.

- `createSearch({ spots, rand, limit: { narrow: 1 | 3, time } })`: a search coordinator for a group. `start(belief, { aggressive })` seeds it with the last known position and direction.
- Phase 1, narrow: `claim(searcher)` hands one (cautious) or up to three (aggressive) searchers the last known position; the rest `cover` (hold where they are, facing it).
- Phase 2, broad (aggressive only): `spots(belief)` is the caller's generator (the surface's: cover hidden from the last position; a town's: corners and doorways from its rounds; the map's: the far sides of the solids); each searcher `claim`s the best unsearched spot by Welsh's weights (near the estimate, near the searcher, *a little* near the truth, for intuition), and `sweep(searcher, seesThrough)` marks every spot it can see as searched for all. `done()` when the spots are gone or `time` is up; searchers return to their rounds one at a time, `stagger` seconds apart, never all at once.
- `flood(grid, from, dir, { hot: 20, perStep: 25, steps: 30 })`: the chase destination on a cell grid (`grid.walkable(x, z)`, `grid.cell`): heat from the last known cell, a barrier behind the last known direction, stop in a wide room or after `steps`; the value-weighted centroid of warm cells. Corridors keep a chase going; open ground ends it.

### `steer.js`: moving without hitting things

Fray's context steering, for the walkers and for the ships' close-in avoidance, beside the force-sum steering the hunters already have.

- `createContext(slots = 16)`: an interest ring and a danger ring.
- `interest(ctx, dir, weight, falloff)`, `danger(ctx, dir, weight, falloff)`: a behaviour writes a direction with a falloff over neighbouring slots. `seek`, `flee`, `avoid(obstacle, radius)`, `separate(others)`, `follow(path)` are the five that write for you.
- `resolve(ctx, { last, blend = 0.3 })`: mask the slots whose danger is above the minimum, take the best remaining interest, interpolate between neighbours for a continuous heading, blend with last frame's for hysteresis. Returns `{ dir, strength }`.

### `spatial.js`: picking a place

Killzone's position picking with Johnson's fixes.

- `candidates(around, { ring, n, r })`: points on a ring (or `grid`) round a place, kept to `walkable`.
- `scorePlace(point, tests)`: tests are `{ weight, value: (p) → number, norm: 'clamped' | 'relative' | 'unclamped' | 'targeted', bookends }`; a weighted sum after normalisation.
- `pickPlace(points, tests, { current, hysteresis = 0.15, bias })`: the best point, but the current one is kept unless the winner beats it by `hysteresis`; `bias` breaks symmetric ties a few percent one way so an orbit commits to a side.
- The standard tests, as factories: `cover(threats, seesThrough)` (hidden from each threat's line of fire), `visible(threat, seesThrough)` (DOOM's inverse: in view), `nearTo(p, range)`, `awayFrom(p, range)`, `apart(others, spacing)`, `offLine(allies, threat)` (not in a friend's line of fire).

### `influence.js`: the battlefield as a grid

Mark's modular tactical influence maps, small.

- `createInfluence({ cell, w, h, origin })`: a grid of floats, with `stamp(map, at, r, strength, shape)` (`'linear'` for proximity, `'threat'` for `1 − (d/R)^4`) from precomputed templates, `clear()`, `at(x, z)`.
- `working(center, r)`: a small map to assemble `add(map, k)` and `multiply(map, k)` layers into, then `highest()`, `lowest()`, `normalise()`, `invert()`.
- Refreshed by the caller every 0.5–1 s, not every frame.

### `squad.js`: a group that acts as one

Days Gone's frontline and confidence, DOOM's tokens, Halo's morale.

- `createSquads({ reach })`: groups by proximity, merging and splitting as members move (Days Gone: within `reach` of *any* member).
- `confidence(squad, world, { value })`: the ratio of what the side sees of its own strength to the enemy's (`value(unit)` the caller's; a panicked ally counts for the enemy; the squad's kills add, its losses subtract, both decaying over minutes), binned to `panicked | worried | neutral | confident | heroic`. The squad's is the mean of its members' rounded toward neutral. Halo's rule rides on it: a leader down drops every member a bin.
- `frontline(squad, enemies)`: direction (centre to centre), the line, its width (the enemy's spread or the members abreast), a neutral buffer, lanes one per member, each assigned to minimise moves.
- `posture(squad)` by confidence: `form | hold | retreat | press`; `advance(squad)` and `withdraw(squad)` return which half moves and which half covers (nearest the line retreat first, furthest press first); `flankers(squad)` the two at the lane ends and a point off the enemy's nearer flank, the rear always left open.
- `createTokens({ pools: { run: 2, melee: 1, shot: 3 }, scale = 1 })`: `claim(kind, who, { priority })`, `release`, `steal` (a better-placed claimant takes a held token), `audit(dt)` reclaiming tokens held past a timeout or by the dead. One scalar (`scale`) is the difficulty of every pool at once. The rule the callers follow: *nobody without a token idles*; they strafe, advance, cover or reposition.

### `director.js` additions (in `universe/director.js`, not the lib)

Left 4 Dead's intensity: a meter that rises with damage taken and kills near you, decays over time, and gates the director's events: build-up while it's under the ceiling, a *relax* phase of `relax` seconds once it has peaked before anything new comes. `foretell` and `heat` stay. The nemesis memory (`npcMemory`) gains `last: { how: 'retreat' | 'downed' | 'ran' | 'draw', from: 'behind' | 'ahead' }`, so a nemesis opens the next meeting from the other side and its `again` line can name what happened.

## Where it goes: each system on the toolkit

Each is one pull request, merged on its own, with its tests first. The order is by what visitors meet most.

### 1. The universe map's characters (`npcRules.js`, `npcs/brains/`)

- `createBrains` gives each `me` senses from its row (`npcs/index.js` gains `senses: { sight, hearing }` with a default per role) and runs `sense` before the brain, with `blocked` against the solids as `seesThrough`. The engine's relations (`fears`, `hunts`) read beliefs: a merchant runs from a hunter it has *seen*, not one behind a planet.
- A brain's own notes (`me.mind`) become a blackboard; the inspector and the trickster become trees (`sequence(comeAlongside, say('hello'), waitStill | turnHostile)`), so a new character with a script is a tree and a row.
- The nemesis, the rival and the hostile turn of the inspector and trickster pick their move with `utility.pick` over `{ orbit, pass, jink, fallback, bait, break }`: *bait* (DOOM/dogfight: slow and let you overshoot when you sit on its tail for `NPC.tail` seconds) and *break* (a hard turn off your nose when a shot of yours is coming) are new; `fallback` weighs its hull, its friends about and the cooldown; `pass` weighs the time since the last. A nemesis's three phases stay as *ranks* (dual utility), so the fury always outranks the duel.
- `dodge` stays. Shots go to the belief's position, so a nemesis that has lost you behind a moon fires at where it thinks you are, and misses.
- Lines: a brain's `say` gains `search` (it's lost you and is looking) and `found` (it has you again); the crews' tables gain the two keys (`crews.test.js` checks every brain's lines).

### 2. The hunters and the wing (`hunterRules.js`, `wingRules.js`)

- A pack is a squad: `createSquads` over its members, `confidence` from hp and losses (a TIE pack that has lost two of three turns `worried` and breaks off together, saying so; `escaped` gains `why: 'broke'`), tokens replace `slotsFor`: `run` tokens as now, plus a `tail` token (one on your tail at a time) and a `holdoff` token, with stealing (the one with the better angle takes the run) and the rule that one without a token *does something*: swings wide to your blind side (`flankers`), or sits off at range as a `blocker` across the way you're going.
- Roles from the frontline: when you run, the furthest hunter is sent ahead (an `ahead` station) to cut you off, which `entryPoint`'s ambush did only at the start.
- The hunters' aim reads a belief: `sense` per hunter with `blocked` as `seesThrough`, 2.5 s of intuition and a coast after. A planet between you and a pack really hides you; they come round it to where you *were*, and spread (`search.start`, aggressive) rather than beeline.
- The wing's choice of which hunter to go for becomes a `pick` (nearest to you, on a run, not one another wingman has, the one that hurt you last: Wetzel's revenge).
- The fight's numbers (`FIGHT`, `LOSE`) stay. The tests that fly seeded fights stay and gain: a pack cannot find a ship behind a planet for at least `intuition` seconds; a pack with half its members lost breaks off; two hunters never hold the tail token at once.

### 3. The galaxy's surface (`actors.js`, `hostiles.js`, `activity.js`, `missions/assault.js`)

- Hostiles get `senses` (a trooper's cone and range; a probe droid's all-round sight; a rancor's smell) and beliefs; `activity.js` fires at the belief. Lose one round a hut and it goes to where you were, looks (`search`, cautious: one goes, the others cover), and gives up or finds you. Lines on the HUD's `combat` event: `?` over a head while it looks.
- `strafeStep` and `chase` become a `pick` over `{ hold, strafe, close, back, flank, cover }` with `spatial.pickPlace` for the point (cover from your line of fire for a blaster trooper; in your view for a duellist, DOOM's way) and tokens per spawn group (`shot: 3`, `melee: 1`), so a squad of six doesn't all fire at once and the ones without a shot move.
- The Battlefront armies: each side's soldiers form `createSquads` by post; `confidence` from the post meters and losses drives `posture`: a losing side's squad `retreat`s in halves to the next post with the other half covering, a winning one `press`es with flankers from the lane ends, and the frontline keeps the two armies from mixing into a melee (Days Gone's reason: the player can read who's winning). `pickPost` stays as the objective layer under it. The `atYouMax` cap becomes the `shot` token pool keyed on you.
- The ambient life (`think`) gains needs and advertisements where a site has things to want (`site.wants`: a fire, a stall, a watchtower), and `relations` read from the perception (a bantha flees a speeder it has seen; a stormtrooper chases a Jawa). Off by default: a site opts in.

### 4. The watchers (`middleearth/towns/watchers.js`: seven worlds at once)

- `watcherSees` becomes `sense` with the town's opts as senses: a detection *timer* in place of the instant `seen` (Splinter Cell: at the edge of sight it takes `alert` × 2 seconds, up close it's at once; running and the Ring as stims), an intermediate `suspicious` mode (it walks to look, one line, no chase) at half the timer, and the `seen` event at full.
- `chase` steers at the belief, with `intuition` and a coast, then `search` (aggressive, phase 1 then 2 over `rounds`' corners and the town's doorways as spots) before `back`. Two Nazgûl split up to look; Shelob stalks the last place she heard you.
- `flood` for the chase destination in the towns that give a grid (Bree's lanes, Moria's halls); the straight `walkTo` where they don't.
- The same seven option tables (`NAZGUL`, `HUNT`, `BOROMIR`, `URUKS`, `TROLL`, Shelob's, the Easterlings', the Citadel's) keep their keys and gain `suspicious` and `search` seconds with defaults, so every world works unchanged until it tunes them.

### 5. The rest, by the same pattern, as time allows

Bob-omb Ridge's Goombas and King Bob-omb (beliefs: a Goomba that loses Mario behind a wall goes to look), Cybertron's Vehicons (tokens, posture), the Invincible city's Atom Eve (a `pick` over patrol, stop-and-talk, race), the Citadel's crowd (advertisements). Each is a small pull request on the toolkit; none is in the first four.

## Fairness, feedback, feel

Every brain must be *legible* (Splinter Cell's four: fair, consistent, feedback, intelligent; Wetzel's: persistence and revenge read as smart, switching reads as a computer):

- A change of mind has a line or a look. `search` and `found` keys, the `?` over a head, a hunter's `broke` on the comms.
- Momentum on every `pick`, hysteresis on every `pickPlace`: no twitching.
- The director knows; the creatures don't. Nothing reads `world.you` but through `sense`, except the two the design names.
- Difficulty is one scalar per world on the token pools and the detection timers (`lib/device`'s tier can set it as it sets the soldier counts).

## Tests

Every module in `lib/ai` has a test that runs it on plain numbers with a seeded random: curves hit their bookends; `pick` holds the running option within momentum and swaps past it; a sequence resumes mid-way; a belief rises to detected in the timer's time and coasts and fades after; a search claims the last known position first and sweeps spots by sight; the flood prefers a corridor to a dead end; context steering goes round a rock to the target behind it and never into a wall; `pickPlace` keeps its point under `hysteresis`; an influence stamp sums and falls off; a squad merges and splits by reach, panics when its leader falls, retreats in halves, never holds two tail tokens. Each integration keeps its world's existing tests and adds the ones named above. `crews.test.js` keeps every brain's lines covered.

## Done when

- `src/lib/ai/` with the eight modules and their tests, in `docs/architecture.md`'s "Where things live".
- The four integrations above, each merged on its own with `npm run lint`, `npm test`, `npm run build` and `node scripts/health.mjs --check --skip build` clean, a flight or walk checked in headless Chromium (`scripts/autopilot-check.mjs --only smoke` on the world's routes; a seeded fight read from `window.__universeDebug`), and no visitor-facing loss.
- `docs/superpowers/HANDOFF-runtime.md` saying what's on the toolkit and what isn't, for the next session.

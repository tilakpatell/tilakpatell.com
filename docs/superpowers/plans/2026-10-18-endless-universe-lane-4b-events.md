# Endless universe, lane 4b: Events and life. Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every event can happen anywhere in the endless universe, not only in the hand-made core. The director knows what is round the ship (the nearest generated system, its faction, its traffic and hazard, a station, a derelict, a black hole) and paces thirty kinds of event: the seventeen it has, working out there, and thirteen new ones. Traffic, hunters and the law read the faction of the space you're in, and far fights burn in generated sectors in every direction.

**Architecture:**
- **Pure first.** A new folder `src/components/universe/events/` holds the rules, each with its Node test:
  - `holder.js`: whose space it is, from a generated system's faction, with hysteresis
  - `zones.js`: what is round the ship, from lane 2's sectors, and what the director may bring there
  - `life.js`: the traffic a system keeps, by its density and faction
  - `fightsOut.js`: far fights seeded at generated systems on the shared clock
  - `signals.js`, `fights.js`, `sweeps.js`, `herds.js`: the thirteen new events' rules
  - `lines.js`: the crews' words for the new events
- **The director** (`director.js`) keeps its shape and its tests. Its table gains four columns (`big`, `gentle`, `holds`, `lasts`) and thirteen rows; it learns the arrival's gentle minute, never starts a big event over another, and tilts by a system's hazard. A side alone never meets a new row, so every existing test picks exactly as before.
- **Wiring.** The scene's `happen` and its escort, eclipse, director and far-fight blocks move out of `scene.js` into `events/playExisting.js` and `events/sceneEvents.js`, so `scene.js` shrinks by about 240 lines over the lane. Every event, old and new, is played by a `Player` (one contract, below) and registered while it runs, so the director, the map (lane 6b) and the browser check all read one list. Every place that ends what's going on today (the jump's way out, the rift, a portal, the ship change, the Maw, a crash, a held pose) calls `events.clear()`, so nothing registered outlives the place it was in.
- **Three numbered PR groups on the one branch.** The coordinator merges every lane; this plan opens no pull request.
  - **4b.1, the pure half** (Tasks 1–8). Nothing on screen changes.
  - **4b.2, life out there** (Tasks 9–13). Traffic, hunters, the law, far fights and the existing events in generated space.
  - **4b.3, thirteen new events** (Tasks 14–20), then the sweep of every event and the full measure.

**Tech Stack:**
- three.js 0.186 on the GLSL path (`universe/module.js` is `'glsl'`), with no new shader
- Vitest (Node; `three` imports fine in Node, as `farStars.test.js` does)
- the Playwright check scripts under `scripts/`

**Spec:** `docs/superpowers/specs/2026-10-18-endless-universe-design.md`. This lane is:
- section B's "Places with life": traffic from the nearest system's density and faction, hunters and the law reading the faction, far fights in generated sectors in every direction
- section C's "Events: at least 15 kinds, everywhere" and "Event pacing", whole
- done item 2's third line ("Something moves within 20 seconds of flying anywhere"), done item 3's event lines (at least 15 kinds, three different in 10 minutes, every event forced by a dev hook), and done item 8's "a gentle event" as a director rule that lane 4c's arrival calls

The index plan is `docs/superpowers/plans/2026-10-18-endless-universe.md`. Its Global Constraints and the wave-1 and lane 3 plans' "What later lanes consume" tables are this lane's inputs.

**Depends on (merged before this lane starts):**
- lane 2, all five PRs: `fullSector` and the sector shape, `systemReach`, `THING_KINDS`, `SECTOR_EXTRAS`, `createExpanse(…).sectors()`, `stars()`, `solids()`, `universeBudget` (its `traffic` and `events` fields are this lane's), `OPEN_SPACE`, the endless check and `__universeDebug.teleport`
- lane 3, both groups: `expanse/shared/space.js` (the generator's face), `fullSector(…).stations`, `places` (`scenePlaces.js`: `park`, `docked`, `here`), `trips.js` (`outOfJump`, `state.arrived`), `places/ids.js` (`isPlaceId`), `state.spaceT` (the shared clock), `travel` on `E:` ids
- lane 4a: its rows in `THING_KINDS` and `SECTOR_EXTRAS` (derelicts, black holes, beacons, rigs, shipyards and fleets). Where a kind this lane reads isn't there, the seam is named in the task, and the event still plays (a stand-in) or says why it can't. And its seams with this lane, each used rather than made twice:
  - `createThings`' deps in `scene.js` (4a's Task 24): `happen: (id) => happen(id, state.ship)` (a trapped derelict's lead), `soon: (id) => director?.soon(id)` (a beacon's lead), `throwTo: (park, opts) => throwTo(park, opts)`, and an optional `follow(row, lead)` this lane passes (Task 14). Task 10 takes `happen` and `director` away, so it rewires the first two.
  - `throwTo(park, opts)`: 4a splits `riftThrough`'s body after `const park = …` into it (`:4210-4237`), so the rift's `dropEscort(); dropEclipse();` pair is there.
  - `wormholeExit({ seed, sector }, universe) → { sector, key, at, heading, side }` on the face: the one rule for a one-way throw (Task 15).
  - `things.setCameFrom({ id, name, at, key })`: the one `where().cameFrom` (Task 15).
  - `LEADS`, `leadEvent` (`things/rules.js`) and two assertions of `things/rules.test.js` that this lane's rows flip (Task 3).
  - `solidOf`, `gargantuanKeeps` and each sector's `extras.gargantuan` (Task 16's waylay clears them).

Line numbers are from `main` at `cc5e2eaf`. Lanes 2, 3 and 4a move them, so find the code again by the quoted text.

## Global Constraints

**Process (HANDOFF-universe's owner's rules and the index's Global Constraints, all of them):**
- Nothing a visitor can do is lost. Every key, save, route, dev hook and test works after as before, and no test is loosened.
  - `director.test.js`, `sides.test.js`, `crews.test.js`, `lanes.test.js`, `hunterRules.test.js`, `skirmish.test.js`, `farFights.test.js` and `nav.test.js` keep every existing `it`. New tests go in new `describe`s.
  - One existing assertion describes a bound the spec removes: `protocol.test.js:455-466`'s `x: 90000` (hunters clamped to the authored map). Task 8 replaces it with a test of what replaces it and says so in its commit.
  - Two of lane 4a's assertions describe a bound this lane removes: `things/rules.test.js`'s `leadEvent('trap', EVENTS)` is `'hunt'` ("lane 4b's 'derelict' isn't there yet") and `leadEvent('treasure', EVENTS)` is null. Task 3 adds both rows, so it replaces them with `'derelict'` and `'treasure'` and says so in its commit (and the same in `things/index.test.js`'s trap test, if it reads the real `EVENTS`). No other test changes.
- Pure first. `events/{holder,zones,life,fightsOut,signals,fights,sweeps,herds,lines}.js`, `director.js` and `lanes.js` import no React, no DOM and no three.js. Each has its Node test before its drawing half.
- A changed picture is on purpose. The before shots come first (Task 9), at `--quality mid`.
- Draw calls and triangles are no higher at any pose in `lab/universe/baseline/<tier>.json`, nor at the six endless poses lanes 3 and 4a left in `lab/universe/endless/<tier>.json` (`old-rim`, `above-core`, `expanse-system`, `expanse-station`, `at-gargantuan`, `in-field`). Every event's mesh is invisible at rest, so a held pose draws none; and no far fight out (Task 7's, drawn by `farFights`' pool) is shown while a pose is held or in the core (Task 13). Say the numbers.
- Before the lane is done: `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build` and `node scripts/autopilot-check.mjs --only smoke --skip lint,test,build --routes /universe`.
- Every commit is one plain sentence in the repo's voice. The body says why and gives the numbers, and ends with the attribution lines the session's harness gives (`.claude/skills/autopilot/SKILL.md`, "Commit"). This plan writes the first line only, with no model names.
- The hand-off goes in `docs/superpowers/evidence/endless-universe-lane-4b/HANDOFF-NOTES.md`, not in `HANDOFF-universe.md`, which the coordinator folds. Evidence goes in the same folder, each picture under 1 MB (element shots, or JPEG at 80).

**Code shape and the repo's budgets** (`docs/health/budgets.json`, measured at `cc5e2eaf`):
- `src/components/universe/scene.js` doesn't grow. Task 9 moves about 175 lines out and Task 13 about 60; Task 10 nets about −7, Task 11 adds 1 (`riftThrough` asks the events first), and Tasks 14–20 add at most 10 between them (3 as planned: Task 17's two hit chains, Task 18's tide). Each task says the lines it moves out and adds, by `wc -l` before and after.
- New files stay under 800 lines. `hunterRules.js` is 1,406 lines: its edits here are net +40 at most, so it never crosses 1,500 (`big-files`, 22 of 30).
- `glsl-sites` is 613 of 619, shared with lanes 1 and 2. This lane adds no `ShaderMaterial`, `RawShaderMaterial` or `onBeforeCompile`. Its looks are `MeshBasicMaterial`, `MeshStandardMaterial`, `SpriteMaterial` and `InstancedMesh`es, with textures painted by `kit.js`'s `paint` and glows by `canvasTexture.js`'s `hot`; the wormhole is the rift's own mesh and the comet the set piece's.
- `loops` is 58 of 58: no `requestAnimationFrame`. Everything runs in the scene's frame.
- `boundary-breaks` is 484 of 489 and `cycles` 5 of 5: the universe reaches the generator only through lane 3's face, `src/components/expanse/shared/space.js`. The face lends none of `rngOf`, `hash64` and `clearOfKeepOuts`, which this lane needs (Tasks 7, 15 and 16), so Task 4 adds the three to it (re-exports, and their names in `shared.test.js`'s list). `director.js` imports nothing from `events/`, and `lanes.js` nothing from `events/` (`life.js` imports `lanes.js`: the other way would be a sixth cycle).
- No new dependency and no new asset. `WORLD_MB['/universe']` is unchanged.
- Generated content is never stored: no `localStorage`, `rt.saves` or `rt.store` row in this lane. Far fights are a pure function of a system's seed and the shared clock.

**Ids and space:**
- Ids are Task 0's (`src/lib/space/address.js`) and lane 3's canonical form, upper-case `E:`.
- Space is 3D. Every lane, spot, entry point and sweep in this lane is placed along the ship's 3D nose (`ship.js`'s `noseOf`), and for a level ship it lands exactly where today's does.

**Numbers the spec pins:**
- At least 15 kinds of event, the director's existing ones included. This lane has 30: today's 17 and 13 new.
- The existing events that must work out there: the flare, the meteor stream, leviathans, the minefield, the escort, the eclipse, the rift, the convoy (given a column of its own), bounties and far fights.
- In 10 minutes of free flight a pilot meets at least three different events: a pure test over 100 seeded starts.
- Two big events never land on top of each other.
- The arrival's first minute gets a gentle one, never an ambush.
- Every event can be forced with `__universeDebug.happen(kind)`.
- Something moves within 20 seconds of flying anywhere.
- Traffic from the nearest system's density and faction; hunters and the law read the faction; far fights in generated sectors in every direction.
- Lane 2's tier table: `traffic` groups 2, 4, 6, 8 and `events` at once 1, 2, 3, 3 (low to ultra), lowered by the quality steps. Lane 2 steps `traffic`; Task 10 adds `events` to the stepped fields (spec H: "the quality steps lower these further").

**Numbers this plan picks (pinned by tests, so they can be tuned):**
- **Whose space:** a system holds you within its reach + 2,600 (regions.js's `LINK`) and lets go past its reach + 5,200; between systems the last one's law holds. In a hand-made region nobody's does (today's).
- **Zones:** gathered within 30,000 of the ship, refreshed once a second of the scene's clock or after 2,000 units of flight; at most 64 lattice things.
- **What the director may bring:** a station within 30,000 for the trader; a derelict within 4,000; a black hole within 6 of its reaches.
- **The arrival:** a gentle window of 60 s; its first event 20 to 40 s in.
- **Hazards:** a pirate system doubles distress, stranded and waylay and takes escort and smuggler up by half; a storm system triples the ion storm front; a minefield system triples the minefield.
- **Far fights out:** a system's fight is on for 240 s of every 900, phase from its seed; a pirate system has one 45 % of the time, a storm or minefield system 12 %, the rest 6 %. The three nearest past `FAR` are drawn.
- **Each new event's numbers** are in its task (`SIGNAL`, `STRANDED`, `TREASURE`, `WORMHOLE`, `TRADER`, `WAYLAY`, `SMUGGLER`, `DERELICT`, `BATTLE`, `STORM`, `COMETPASS`, `TIDAL`, `MIGRATION`, `BLOOM`).

**Boundaries:**
- **This lane owns:** `director.js`, its event files (`setpieces.js`, `leviathans.js`, `meteors.js`, `lanes.js`, `minefield.js`, `mines.js`, `escort.js`, `eclipse.js`, `supernova.js`), `traffic.js`, `hunters.js`, `hunterRules.js`, `farFights.js`, `skirmish.js`, `skirmishes.js` and the new `universe/events/`. It also makes the two fixes lane 2 handed on: `online/protocol.js`'s `readPack` and `online/client.js`'s pack read.
- **Small edits elsewhere, each named in its task:** `sides.js` (`sideAt`, `crewAt`, `lawAt`), `nav.js` (`riftSpot`'s solids), `crews.js` (`linesFor` reads `EVENT_LINES`), `words.js` (`EVENT`), `src/lib/words.test.js` (scans `events/`), lane 2's `universe/budget.js` (`events` joins the stepped fields, Task 10), lane 3's face `expanse/shared/space.js` and `shared.test.js` (three re-exports, Task 4), lane 3's `places/scenePlaces.js` (one getter, `sector(key)`, Task 16), lane 4a's `things/rules.test.js` (two assertions, Task 3), `scripts/universe-endless-check.mjs`.
- **Not touched:** `NavMap.jsx`, `MiniMap.jsx`, `chart/*` (6a and 6b); `places/*` but that getter, and `trips.js` (lane 3: read only); `expanse/*` but the face (lane 2: read only); `universe/things/` and `universe/gargantuans/` (4a: read only, but the two assertions); `law.js` and `wanted.js` (their tests gain a `describe`; the code reads a new side through the `side` thunk it already takes); `entry.js`, `footScene.js`, `lib/land/*`, `expanse/flight/*` (5b); `ship.js`'s `startAt` (4c).

**Words and UI (`docs/health/RULES.md`, "UI"):**
- Every new on-screen word goes into `src/components/universe/words.js` first, as `EVENT`. The crews' lines go in `events/lines.js`.
- British spelling, sentence case, curly quotes, no Oxford comma, no retired word (`src/lib/words.js`'s `RETIRED`; mind "hyperdrive").
- No new NPC conversation: the trader is the existing merchant's own `offer` line; the crews' lines are comms, as every event has.

**The `Player` contract.** Every event, old and new, is played by one of these (Tasks 9, 10, 14–19):

```
Player = {
  kinds: string[],                            // the event ids it plays
  start(id, ship, ctx) → boolean,             // false: it couldn't (and nothing is left half made)
  update(dt, t, live, ctx) → moving,          // live: the flying ship, or null; moving: something of it is on screen and moving
  running() → Running[],                      // what of it is going on now
  busy: boolean,                              // whether it holds the director
  targets?: Target[], hit?(from, to, punch) → hit | null,   // only if your guns can hit it
  pull?(ship) → { v, k } | null,              // only the tidal pull, k in 0..1
  drop(id),                                   // let go of that one running event and hide its looks (Task 10)
  clear(), dispose(),                         // clear: let go of everything running, hide every look
}
Running = { id: '<kind>:<n>', kind, name, at: [x, y, z], big, from: [x, y, z] }   // name: EVENT.name[kind] (Task 3); from: the ship where it started
ctx = { side, here: { system, holder, core }, zones, solids, force, rand, budget, at }   // at: where to play it when the caller says (a beacon's place, Task 14), else null
```

`ctx.side` is the side the event plays for: the holder-aware `sideHere()`, or the side a check names (`happen(id, ship, { side })`, Task 10). Every player reads its side from `ctx.side`, never from the scene on its own. `ctx.here.core` is Task 10's `core` (a hand-made region or the Rick and Morty pocket).

`update`'s `moving` is what `adventure`'s `busy` is today (`scene.js:3880-3953`: true while something animates, so the frame loop keeps drawing), as the escort's and the eclipse's `busy = true` are. It is not the director's `busy`, which is the getter.

**Browser checks:**
- Headless Chromium draws in software here at a frame or two a second, and `universe-check` takes 2 to 4 minutes a pose and tier. A task's browser check runs at `--quality mid` only, on the steps or poses it changes. Task 20 runs the full all-tier measure once.
- Every browser command runs with `CHROME=/opt/pw-browsers/chromium CHROMIUM=/opt/pw-browsers/chromium` in front of it, as lane 3's plan found (`navmap-check` and `links-check` default to a Chrome this container lacks; `universe-check` and `autopilot-check` look for a Chromium path it doesn't have).
- `universe-check`, `universe-endless-check`, `autopilot-check` and `perf-probe` start their own server. `events-check.mjs` doesn't: start `npx vite --port 5173 --strictPort` in the background, wait until `curl --noproxy '*' -sf -o /dev/null http://localhost:5173/` succeeds in an until-loop (giving up after 60 s), run it, then stop the server.
- Every wait is on a condition, never a sleep. A wait for game time reads the scene's own clock (`__universeDebug.state.clock`), never the wall's. The scene's clock moves at most `MAX_DT` (0.05 s, `src/runtime/runtime.js:62`) a frame, so at a frame or two a second each wait for a forced event is capped at 30 s of the scene's clock and 120 s of the wall's, whichever comes first.
- The endless check's `events` step takes its kinds from a flag of its own, `--events a,b,c`, because lane 3's `--only a,b` splits on commas into step names. So `--only events --events flare,meteors` runs the one step for those two kinds, and `--only events` alone (or a run with no `--only`) forces every kind `events.debug.kinds()` lists.
- What a check reads: `__universe()` (`scene.js:5923-5963`) has no far fights and no interdiction (lane 3 adds `place` and `docked`). Those are on `__universeDebug.state` (`fights`, `interdicted`, `arrived`).

## Review Focus

1. **A waylaid jump.** A jump can go any distance, and the bodies near where it's cut short (stars, planets, stations, 4a's things and its gargantuans, 20 to 200 planets across) aren't in the frame's `solidsNow` until their sectors load. So the waylay sets you down only 1,500 to 6,000 short of the park, inside the destination's own sector, clear of that sector's bodies read from its pure rows (lane 3 has the sector at hand for any jump to an `E:` id) and of the keep-outs. It must never set you down inside a solid, never on a jump to a pilot, a portal leg, the gate or a tour leg, never in the arrival's first minute (but for a check's `markJump`, which still keeps the other rules), and never say you got there. The jump's own way out runs right after lane 3's `outOfJump(j)` (`scene.js:4352-4366` on `main`): `arriveAt(park); hunters?.clear(); … state.interdicted = false; …` and then `emit({ type: 'jumped', id: j.id })`, which the page reads as a finished trip (`pages/Universe.jsx:375-390`: on through the gate to `/galaxy`, the tour's next leg, `grandtour` on the last). So `events.outOfJump` only shortens the park and arms the waylay; the pirates are packed by `events.afterJump`, which takes the place of the block's `emit` after every clear and returns `{ type: 'arrived', id, done: false }` for a waylaid jump; lane 3's `state.arrived` goes null there, so no dock opens; and only a jump to a generated place (an `E:` id) is ever waylaid. Pinned in Task 16 (`waylayPark` 1,500 to 6,000 short on a 100,000 jump, clear of a gargantuan row on the jump line or null, in the destination's sector, null for a short jump; no waylay when the destination's sector isn't at hand; a fake block that clears between the two calls still ends with the pirates packed; the event is `arrived` and not done; a pilot, a portal leg and a hand-made id are never marked) and its endless-check run (the page is still on `/universe`, nothing docked).
2. **The line between two holders.** Sitting on the edge of an Empire system next to a Federation one must not flicker whose space it is. Wanted stars must not reset every frame, traffic already flying must not vanish (a pop), and hunters already on you must stay. Pinned in Task 1 (hysteresis, 200 updates on the line, no flip), Task 12 (a group spawned under one side flies on under the next) and Task 13 (the law's side changes twice over a crossing out and back, not every step).
3. **An event forced where its thing isn't.** `happen('derelict')` in the void, `happen('trader')` with no station near, `happen('tidal')` far from any black hole, or any event with no ship. Each plays a stand-in where one makes sense (a derelict hulk, a beacon) or returns false with a note saying why, and never throws or leaves half an event registered. Pinned in Tasks 14–19 (each play's `start` with `force` and no zone) and Task 20 (the sweep, every kind).
4. **A phone.** On `low`, `budget.events` is 1: never two events running at once (the director's picks and the law's bounty both wait; only a check's force (`soon`, `markJump`, the dev hook), a thing's trap and a beacon followed start over one, Findings 18), no event left registered after you've gone (one beacon left behind would hold the director for five minutes), no event mesh visible at rest and no far fight out shown at a held pose or in the core (no draw call of this lane's at a held pose but traffic's), three different events in ten minutes all the same, and the quality steps lower the traffic cap and the events cap with the rest. Pinned in Task 4 (the ten-minute flight at `BUDGET.low.events`), Task 10 (`running().length ≤ budget.events` over a scripted run; `events.clear()` at a jump and the 30,000 let-go; `setStep` through lane 2's `budget.js`, which Task 10 teaches to step `events`), Task 12 (traffic cap by tier and step), Task 13 (`fights()` holds no out-fight while held or in the core) and Task 20 (the low-tier measure).
5. **A pocket universe and the Rick and Morty pocket.** In `/universe?seed=word` the zones are the pocket's own sectors, and far fights are seeded from the pocket's systems. Inside the Rick and Morty pocket its own side wins over any holder, and its law stays the crew's, as today. `regionAt` knows only the main sector's places (`regions.js:39`), and the pocket's keep-out is only its radius plus 4,000 (`keepOuts.js:30-32`), so generated systems sit just outside its wall: without care, the last system's holder would follow you in. So the scene's `core` is `Boolean(regionAt(...at)) || mapSectorOf(...at) === 'rickmorty'` wherever it's passed (`createHere`, `trafficHere`, the pacing flight). Pinned in Task 1 (`sideAt`'s order, `lawAt` with no holder), Task 2 (zones from a pocket's `fullSector`), Task 7 (fights from a pocket's systems differ from the shared one's) and Task 10 (a ship carried from an Empire system into the pocket has holder null, `life()` null and the crew's own law).

## Files

| File | Responsibility | Task |
|---|---|---|
| `src/components/universe/events/holder.js` (new) | whose space: `holderOf`, `createHere` | 1 |
| `src/components/universe/sides.js` | `sideAt`, `crewAt` take a holder; `lawAt` | 1 |
| `src/components/universe/events/zones.js` (new) | what's round the ship; what the director may bring there | 2 |
| `src/components/universe/director.js` | `zoneOf` reads generated systems; the table's columns and thirteen rows; arrival, big, hazard | 2, 3 |
| `src/components/universe/events/lines.js` (new) | the crews' lines for the new events | 3 |
| `src/components/universe/crews.js` | `linesFor` reads `EVENT_LINES` | 3 |
| `src/components/universe/words.js` | `EVENT` (with `EVENT.name`, every kind's name for the registry) | 3 |
| `src/components/universe/things/rules.test.js` (lane 4a's) | its two "not there yet" assertions become `'derelict'` and `'treasure'` | 3 |
| `src/components/universe/events/pacing.test.js` (new) | ten minutes from 100 seeded starts, on a phone's budget | 4 |
| `src/components/expanse/shared/space.js`, `shared.test.js` (lane 3's face) | lends `rngOf`, `hash64`, `clearOfKeepOuts` too | 4 |
| `src/components/universe/lanes.js` | `noseFrame`; every lane along the 3D nose (a pitched ship) and clear of what's passed; `portLane`, `PORT_NEAR` | 5, 6 |
| `src/components/universe/nav.js` | `riftSpot` takes solids and the 3D nose | 5 |
| `src/components/universe/hunterRules.js` | `entryPoint` along the 3D nose; the stale ceiling comment | 5 |
| `src/components/universe/events/life.js` (new) | the traffic a system keeps | 6 |
| `src/components/universe/events/fightsOut.js` (new) | far fights at generated systems on the shared clock | 7 |
| `src/components/universe/farFights.js` | `fightLabel` names a generated system | 7 |
| `src/components/universe/online/protocol.js`, `online/client.js` | the pack anywhere, kept near its pilot | 8 |
| `src/components/universe/events/playExisting.js` (new) | today's `happen`, escort and eclipse, moved out and taught generated space | 9, 11 |
| `src/components/universe/events/sceneEvents.js` (new) | the scene's events: zones, holder, director, players, registry, debug | 10–19 |
| `src/components/universe/budget.js`, `budget.test.js` (lane 2's) | `events` stepped with `traffic`, never below 1 | 10 |
| `src/components/universe/traffic.js`, `traffic.test.js` (it exists: new `describe`s) | traffic reads the nearest system; the convoy's own column | 11, 12 |
| `src/components/universe/__fixtures__/traffic-core.json` (new) | today's traffic with `here` null, written once from unchanged code | 12 |
| `src/components/universe/law.test.js` | a new `describe`: whose law it is | 13 |
| `src/components/universe/setpieces.js`, `meteors.js`, `mines.js`, `leviathans.js` | spots and lanes clear of what's there; the rift's life and size; ice | 11, 15, 18 |
| `src/components/universe/events/playFar.js` (new) | skirmishes, far fights out, the battle | 13, 17 |
| `src/components/universe/events/signals.js`, `playSignals.js` (new) | stranded, treasure (and a beacon followed), wormhole (on 4a's `wormholeExit`), trader | 14, 15 |
| `src/components/universe/events/fights.js`, `playFights.js` (new) | waylay (and the bodies round where it sets you down), smuggler, derelict, battle's rules | 16, 17 |
| `src/components/universe/places/scenePlaces.js` (lane 3's) | `sector(key)`: a loaded or fetched sector, for the waylay | 16 |
| `src/components/universe/events/sweeps.js`, `playSweeps.js` (new) | ion storm front, comet fly-by, tidal pull | 18 |
| `src/components/universe/events/herds.js`, `playHerds.js` (new) | leviathan migration, bloom | 19 |
| `src/components/universe/leviathans.js` | `purrgilBody()`: a purrgil merged to two geometries | 19 |
| `src/components/universe/scene.js` | wiring only, smaller after (with 4a's `createThings` deps rewired, Tasks 10 and 14) | 9–20 |
| `scripts/universe-endless-check.mjs` | the `life`, `fights`, `events` and `arrival` steps | 11–20 |

---

## PR 4b.1: The pure half

### Task 1: Whose space it is

**Files:**
- Create: `src/components/universe/events/holder.js`, `src/components/universe/events/holder.test.js`
- Modify: `src/components/universe/sides.js:279-289` (`sideAt`, `crewAt`; `lawAt` beside them), `src/components/universe/sides.test.js` (a new `describe`)

**Interfaces:**
- Consumes: `SIDES`, `sideFor`, `SECTOR_SIDES` (`sides.js`); the generator's faction ids (`expanse/gen/tables.js:96-119`: `empire`, `federation`, `dea`, `independent`, and a generated faction's `'<sector id>:f<k>'`).
- Produces:
  - **`HOLDERS = { empire: 'starwars', federation: 'rickmorty', dea: 'breakingbad' }`**
  - **`holderOf(faction) → Holder | null`**, `Holder = { id, name, side, lawful, own }`:
    - a `HOLDERS` id: its side, `lawful: true`, `own: false`
    - `'independent'`: `side: null, lawful: false` (nobody's law: no inspectors, no police, no spotting)
    - any other id, a faction of its own: `side: null, lawful: true, own: true` (the crew's side's ships and law fly there, as today)
    - `null` or `undefined`: `null`
  - **`HERE = { in: LINK, out: 2 * LINK }`** (`LINK = 2600`, `regions.js`)
  - **`createHere() → { update(systems, at, { core = false } = {}) → { system, holder }, system, holder, reset() }`**. `systems` are Task 2's zones with `what: 'system'` (`at`, `reach`, `faction`).
    - **Core.** With `core` (the scene passes `Boolean(regionAt(...at)) || mapSectorOf(...at) === 'rickmorty'`: a hand-made region, or inside the Rick and Morty pocket, which `regionAt` doesn't know), it gives `{ system: null, holder: null }` and forgets the last holder.
    - **Staying.** The current system stays while `|at − system.at| ≤ system.reach + HERE.out`.
    - **Taking over.** Otherwise the nearest system with `|at − system.at| ≤ system.reach + HERE.in` takes over, else `system` is null.
    - **The holder** is the current system's `holderOf(faction)`. With no system it is the last one's: deep space between systems keeps the law of the last system you were in. It is the same object while the system is the same, so `===` tells a change.
  - **In `sides.js`:**
    - `sideAt(crewId, sector = 'main', holder = null)`: `SIDES[SECTOR_SIDES[sector]] ?? SIDES[holder?.side] ?? sideFor(crewId)`
    - `crewAt(crewId, sector = 'main', holder = null)`: the crew itself where `sideAt` gives its own side, else that side's first crew
    - `lawAt(crewId, holder = null)`: `null` when `holder && !holder.lawful`; `SIDES[holder.side]` when it has one; else `sideFor(crewId)`. The Rick and Morty pocket's law stays the crew's, as `law.js` has it today (`scene.js:1016`).

- [ ] **Step 1: Write the failing tests.** `holder.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { HERE, createHere, holderOf } from './holder';
import { SIDES, crewAt, lawAt, sideAt, sideFor } from '../sides';

const sys = (id, at, faction, reach = 1000) => ({ id, what: 'system', at, reach, faction });

describe('whose space it is', () => {
  it('knows the authored sides’ factions, the independents and a faction of its own', () => {
    expect(holderOf({ id: 'empire', name: 'The Galactic Empire' })).toMatchObject({ side: 'starwars', lawful: true, own: false });
    expect(holderOf({ id: 'federation', name: 'The Galactic Federation' })).toMatchObject({ side: 'rickmorty', lawful: true });
    expect(holderOf({ id: 'dea', name: 'The DEA' })).toMatchObject({ side: 'breakingbad', lawful: true });
    expect(holderOf({ id: 'independent', name: 'Independent' })).toMatchObject({ side: null, lawful: false });
    expect(holderOf({ id: 'E:3,-2:f1', name: 'Vega Compact' })).toMatchObject({ side: null, lawful: true, own: true, name: 'Vega Compact' });
    expect(holderOf(null)).toBeNull();
  });
  it('gives a held system its side’s hunters and traffic; the Rick and Morty pocket keeps its own; elsewhere the crew’s', () => {
    const empire = holderOf({ id: 'empire' });
    expect(sideAt('rv', 'main', empire)).toBe(SIDES.starwars);
    expect(sideAt('rv', 'rickmorty', empire)).toBe(SIDES.rickmorty);
    expect(sideAt('rv', 'main', holderOf({ id: 'independent' }))).toBe(sideFor('rv'));
    expect(sideAt('rv', 'main')).toBe(sideFor('rv'));
    expect(crewAt('rv', 'main', empire)).toBe(SIDES.starwars.crews[0]);
    expect(crewAt('xwing', 'main', empire)).toBe('xwing');
  });
  it('puts a lawful holder’s law on you, none in an independent system, and the crew’s own with no holder', () => {
    expect(lawAt('rv', holderOf({ id: 'federation' }))).toBe(SIDES.rickmorty);
    expect(lawAt('rv', holderOf({ id: 'independent' }))).toBeNull();
    expect(lawAt('rv', holderOf({ id: 'E:3,-2:f1' }))).toBe(sideFor('rv'));
    expect(lawAt('cruiser', null)).toBe(sideFor('cruiser'));
  });
  it('takes the system you fly into, keeps it till you are well out, and keeps its law between systems', () => {
    const a = sys('E:1,0:0', [0, 0, 0], { id: 'empire' });
    const b = sys('E:1,0:1', [20000, 0, 0], { id: 'federation' });
    const here = createHere();
    expect(here.update([a, b], [a.reach + HERE.in - 1, 0, 0]).system.id).toBe(a.id);
    expect(here.update([a, b], [a.reach + HERE.out - 1, 0, 0]).system.id).toBe(a.id);
    const out = here.update([a, b], [a.reach + HERE.out + 1, 0, 0]);
    expect(out.system).toBeNull();
    expect(out.holder.side).toBe('starwars');
    expect(here.update([a, b], [20000 - b.reach - HERE.in + 1, 0, 0]).holder.side).toBe('rickmorty');
  });
  it('never flickers on the line between in and out', () => {
    const b = sys('E:1,0:1', [20000, 0, 0], { id: 'federation' });
    const here = createHere();
    here.update([b], [20000 - b.reach - HERE.in + 1, 0, 0]);
    const held = here.holder;
    for (let i = 0; i < 200; i++) expect(here.update([b], [20000 - b.reach - HERE.in - (i % 2 ? 300 : -300), 0, 0]).holder).toBe(held);
  });
  it('is nobody’s among the hand-made regions, and forgets the last system there', () => {
    const here = createHere();
    const a = sys('E:0,0:5', [30000, 0, 0], { id: 'empire' });
    here.update([a], [30000, 0, 0]);
    expect(here.update([a], [30000, 0, 0], { core: true })).toEqual({ system: null, holder: null });
    expect(here.update([], [90000, 0, 0]).holder).toBeNull();
  });
});
```

  `sides.test.js` gains a `describe('sides with a holder')` asserting that every existing `sideAt(crew, sector)` and `crewAt(crew, sector)` call over the four crews and both sectors equals the same call with `holder: null`.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/events/holder.test.js src/components/universe/sides.test.js`. Expected: FAIL (`./holder` not found; `lawAt` not exported).
- [ ] **Step 3: Implement** `holder.js` and the three `sides.js` functions.
- [ ] **Step 4: Run them and see them pass.** Same command. Expected: PASS, with every existing `sides.test.js` test unchanged.
- [ ] **Step 5: Commit.** `git commit -m "Whose space it is: a generated system's faction holds it, with room to cross the line"`

### Task 2: Zones: what is round the ship

**Files:**
- Create: `src/components/universe/events/zones.js`, `src/components/universe/events/zones.test.js`
- Modify: `src/components/universe/director.js:92` (`zoneOf`), `src/components/universe/director.test.js` (a new `describe`)

**Interfaces:**
- Consumes: lane 3's face `src/components/expanse/shared/space.js` (`UNIVERSE`, `universeOf`, `fullSector`, `THING_KINDS`, `SECTOR_EXTRAS`); a sector's `systems` (each with `reach`, `faction`, `traffic`, `hazard`), `things` (`count`, `kind`, `at` from `origin`, `size`), `extras` and `stations` (lane 3: `{ id, i, system, at, size, name }`); `MAW` (`maw.js`), `WONDERS` (`deep.js`); `LINK` (`regions.js`); `SECTOR` (`lib/space/address.js`); `visitorsOf` (`npcs/index.js`).
- Produces:
  - **`ZONE = { near: 30000, things: 64 }`**
  - **`WHAT_OF: { [thing kind]: what | null }`.** Lane 2's four are `rock: 'field'`, `ice: 'field'`, `derelict: 'derelict'`, `rogue: null`. Lane 4a's kinds each get a row at this task, read from its `THING_KINDS`, as one of the `what`s this lane reads: `'derelict'` (wrecks too), `'field'`, `'blackhole'`, `'nebula'`, `'beacon'`, `'port'` (mining rigs, shipyards, fleets at anchor), `'storm'`, `'wormhole'`, or `null`. The test fails on a kind with no row.
  - **`EXTRA_WHAT: { [extras list]: (row) → what | null }`**, one entry for each of 4a's `SECTOR_EXTRAS` lists (its gargantuans: a black hole is `'blackhole'`, the rest `null`).
  - **`HANDMADE: Zone[]`**: the Maw (`'blackhole'`, `MAW.at`, `MAW.reach`) and the nebula wonders (`'nebula'`).
  - **`Zone = { id, what, src, at: [x, y, z], reach, name, gap, faction?, traffic?, hazard?, system?, row }`**, with `gap = max(0, |at − p| − reach)` and `src` one of `'system'`, `'station'`, `'thing'`, `'extra'`, `'handmade'`. `system` is the id of the system a station or an extras row belongs to (the row's own `system` field: lane 3's stations, and 4a's rigs, shipyards and fleets carry one), else null.
  - **`zonesAround(sectors, p, { near = ZONE.near } = {}) → Zone[]`**, nearest `gap` first. `sectors` is a `Map` or any iterable of sectors. Only a sector whose cube comes within `near` of `p` is swept. It lists, each with `gap ≤ near`:
    - every system, with `reach` its own (`systemReach`, lane 2's `reach` field) and its `faction`, `traffic` and `hazard`
    - every station (`what: 'station'`, `reach: 1.5 × size`, `system`: its system's id)
    - lattice things whose kind has a non-null `WHAT_OF`, at most `ZONE.things` nearest, swept from the typed arrays with no object made for one it rejects
    - extras by `EXTRA_WHAT`
    - `HANDMADE`
  - **`systemAt(zones, p, pad = LINK) → Zone | null`**: the nearest system whose `reach + pad` holds `p`
  - **`nearestOf(zones, what, p) → Zone | null`**
  - **`NEED_NEAR = { station: 30000, derelict: 4000, blackhole: 6 }`** (the black hole's is in its reaches)
  - **`whereFor({ zones, ship, side, sun = false, station = false, gate = false, docked = false, jumping = false }) → { sun, station, gate, near }`**: `withWhere`'s options (Task 3). `near` lists:
    - `'open'` unless `docked`, `station` or `gate`
    - `'jump'` while `jumping`
    - `'station'`, `'derelict'` or `'blackhole'` when one is within its `NEED_NEAR`
    - `'nebula'` when the ship is inside a nebula zone (`gap` 0): no row needs it; Task 3's `NEAR_TILT` weights the bloom by it
    - `'merchant'` when the side has a visitor whose brain is `'merchant'`
    - `'police'` when the side has `police`
  - **`zoneOf(s, { regionAt, systemAt = null })`** in `director.js`: `'place'` when `regionAt(s.x, s.y ?? 0, s.z)` or `systemAt?.(s.x, s.y ?? 0, s.z)` holds the point, else `'void'`.

- [ ] **Step 1: Write the failing tests.** `zones.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { THING_KINDS, UNIVERSE, fullSector, universeOf } from '../../expanse/shared/space';
import { MAW } from '../maw';
import { SIDES } from '../sides';
import { HANDMADE, NEED_NEAR, WHAT_OF, ZONE, nearestOf, systemAt, whereFor, zonesAround } from './zones';

const s = fullSector(UNIVERSE, 1, 0, 0);
const sectors = new Map([[s.id, s]]);
const len = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describe('what is round the ship', () => {
  it('has a row for every kind of thing there is', () => {
    for (const row of THING_KINDS) expect(Object.hasOwn(WHAT_OF, row.kind), row.kind).toBe(true);
  });
  it('lists every system within reach, with its faction, traffic and hazard, nearest first', () => {
    const p = [s.systems[3].at[0] + 4000, s.systems[3].at[1], s.systems[3].at[2]];
    const zones = zonesAround(sectors, p);
    const want = s.systems.filter((x) => len(x.at, p) - x.reach <= ZONE.near).map((x) => x.id).sort();
    expect(zones.filter((z) => z.what === 'system').map((z) => z.id).sort()).toEqual(want);
    expect(zones.find((z) => z.id === s.systems[3].id)).toMatchObject({ reach: s.systems[3].reach, faction: s.systems[3].faction, traffic: s.systems[3].traffic, hazard: s.systems[3].hazard });
    for (let i = 1; i < zones.length; i++) expect(zones[i].gap).toBeGreaterThanOrEqual(zones[i - 1].gap);
  });
  it('lists the stations and the derelicts near enough, and no more lattice things than its cap', () => {
    const st = s.stations[0];
    const zones = zonesAround(sectors, st.at);
    expect(zones.find((z) => z.id === st.id)).toMatchObject({ what: 'station', system: st.system });
    expect(zones.filter((z) => z.src === 'thing').length).toBeLessThanOrEqual(ZONE.things);
  });
  it('knows the Maw for a black hole, in the core', () => {
    expect(HANDMADE.find((z) => z.what === 'blackhole')).toMatchObject({ at: MAW.at, reach: MAW.reach });
    expect(nearestOf(zonesAround(new Map(), MAW.at), 'blackhole', MAW.at)?.at).toEqual(MAW.at);
  });
  it('says which system holds a point, by its reach and the link past it', () => {
    const sys = s.systems[0];
    const zones = zonesAround(sectors, sys.at);
    expect(systemAt(zones, [sys.at[0] + sys.reach + 2000, sys.at[1], sys.at[2]])?.id).toBe(sys.id);
    expect(systemAt(zones, [sys.at[0] + sys.reach + 99999, sys.at[1], sys.at[2]])).toBeNull();
  });
  it('reads a pocket universe’s own sectors', () => {
    const pocket = fullSector(universeOf('marble'), 1, 0, 0);
    const zones = zonesAround(new Map([[pocket.id, pocket]]), pocket.systems[0].at);
    expect(zones.find((z) => z.what === 'system').name).toBe(pocket.systems[0].name);
  });
  it('tells the director what may happen here', () => {
    const st = s.stations[0];
    const zones = zonesAround(sectors, st.at);
    const ship = { x: st.at[0] + 100, y: st.at[1], z: st.at[2] };
    expect(whereFor({ zones, ship, side: SIDES.starwars }).near).toEqual(expect.arrayContaining(['open', 'station', 'merchant', 'police']));
    expect(whereFor({ zones, ship, side: SIDES.rickmorty }).near).not.toContain('merchant');
    expect(whereFor({ zones, ship, side: SIDES.starwars, docked: true }).near).not.toContain('open');
    expect(whereFor({ zones, ship, side: SIDES.starwars, jumping: true }).near).toContain('jump');
    expect(whereFor({ zones: [], ship, side: SIDES.starwars }).near).not.toContain('station');
    expect(NEED_NEAR.derelict).toBe(4000);
    const cloud = { id: 'n', what: 'nebula', src: 'handmade', at: [0, 0, 0], reach: 500, gap: 0 };
    expect(whereFor({ zones: [cloud], ship: { x: 10, y: 0, z: 0 }, side: SIDES.starwars }).near).toContain('nebula');
    expect(whereFor({ zones: [{ ...cloud, gap: 20 }], ship: { x: 520, y: 0, z: 0 }, side: SIDES.starwars }).near).not.toContain('nebula');
  });
  it('gives a rig its system’s id, though it lies past the system’s reach', () => {
    const rig = s.extras.rig[0]; // (4a's: at its field's middle, 1.15 to 1.6 reaches from the star)
    expect(zonesAround(sectors, rig.at).find((z) => z.row === rig)).toMatchObject({ what: 'port', src: 'extra', system: rig.system });
  });
  it('sweeps 27 sectors in a few milliseconds', () => { /* zonesAround over the 27 round home from 20 seeded points, warmed: mean under 2 ms; say the number in the commit */ });
});
```

  `director.test.js` gains a `describe('a place out there')`: `zoneOf({ x, y, z }, { regionAt, systemAt: () => null })` equals `zoneOf(…, { regionAt })` for every point of today's "knows a place and the void" test, and a point only `systemAt` holds is `'place'`.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/events/zones.test.js src/components/universe/director.test.js`. Expected: `zones.test.js` FAILS (module not found); the new director `describe` FAILS; the rest passes.
- [ ] **Step 3: Implement** `zones.js` and `zoneOf`'s `systemAt`. Read 4a's `THING_KINDS` and `SECTOR_EXTRAS` and give each kind and list its row.
- [ ] **Step 4: Run them and see them pass.** Same command. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "What is round the ship, from the generated sectors, and what the director may bring there"`

### Task 3: The director's table: thirty kinds, how big each is, and the gentle minute

**Files:**
- Modify: `src/components/universe/director.js:57-189` (the doc comment, `EVENTS`, `canHave`, `withWhere`, `createDirector`), `src/components/universe/director.test.js` (new `describe`s)
- Create: `src/components/universe/events/lines.js`, `src/components/universe/events/lines.test.js`
- Modify: `src/components/universe/crews.js:3167-3170` (`linesFor`'s `'event'` branch: `crew.events?.[id] ?? EVENT_LINES[crew.id]?.[id]`, and its import), `src/components/universe/words.js` (`EVENT`), `src/lib/words.test.js:16-28` (its `FILES` gains `...list('components/universe/events/', /\.js$/)`, which adds files to the scan and loosens nothing)
- Modify: lane 4a's `src/components/universe/things/rules.test.js` (the two assertions this task's rows flip, below), and `things/index.test.js`'s trap test if it reads the real `EVENTS`

**Interfaces:**
- Consumes: `SIDES` (`sides.js`); Task 2's `whereFor` (in the tests).
- Produces:
  - **Every `EVENTS` row gains `big`, `gentle`, `holds` and `lasts: [least, most]` seconds.** `holds` is whether the scene's `busy` holds the director while it plays (today's `busy` expression, `scene.js:3989`); `lasts` is how long it plays, which Task 4's simulation and Task 10's registry use.

    | id | big | gentle | holds | lasts |
    |---|---|---|---|---|
    | hunt, council | yes | no | yes | [40, 90] |
    | destroyer | yes | no | yes | [60, 120] |
    | roadblock | yes | no | yes | [30, 70] |
    | distress | no | no | yes | [30, 60] |
    | convoy | no | yes | no | [20, 40] |
    | comet | no | yes | no | [28, 28] |
    | supernova | no | yes | no | [55, 70] |
    | flare | no | no | no | [8, 20] |
    | rift | no | no | no | [10, 20] |
    | leviathan | no | yes | yes | [20, 45] |
    | meteors | no | no | yes | [15, 30] |
    | bounty | yes | no | yes | [30, 60] |
    | remover | yes | no | yes | [40, 80] |
    | minefield | no | no | yes | [20, 40] |
    | escort | yes | no | yes | [60, 120] |
    | eclipse | no | yes | yes | [40, 60] |

  - **Thirteen new rows.** Each needs at least one thing only the scene's `where` grants, so a side alone never meets one:

    | id | needs | zones | weight | heat | big | gentle | holds | lasts |
    |---|---|---|---|---|---|---|---|---|
    | waylay | `['jump', 'pirates']` | both | 1.0 | 0.9 | yes | no | yes | [40, 90] |
    | stranded | `['open', 'pirates']` | both | 1.0 | 0.3 | yes | no | yes | [60, 150] |
    | battle | `['open']` | both | 0.9 | 0.5 | yes | no | yes | [60, 120] |
    | derelict | `['derelict']` | both | 0.9 | 0.6 | yes | no | yes | [40, 90] |
    | wormhole | `['open']` | void | 0.6 | 0 | no | no | no | [60, 60] |
    | cometpass | `['open']` | both | 0.8 | 0 | no | no | yes | [20, 40] |
    | stormfront | `['open']` | both | 0.8 | 0 | yes | no | yes | [30, 60] |
    | bloom | `['open']` | both | 0.8 | 0 | no | yes | no | [30, 60] |
    | trader | `['open', 'merchant', 'station']` | both | 1.0 | 0 | no | yes | no | [30, 60] |
    | migration | `['open']` | void | 0.6 | 0 | yes | yes | no | [40, 80] |
    | tidal | `['blackhole']` | both | 1.2 | 0 | yes | no | yes | [30, 60] |
    | treasure | `['open']` | both | 0.9 | 0 | no | no | no | [60, 180] |
    | smuggler | `['open', 'police']` | both | 0.9 | 0.4 | yes | no | yes | [40, 90] |

  - **`canHave(side, e)`**: `Boolean(side) && (e.needs === null || [].concat(e.needs).every((n) => side.has(n)))`.
  - **`withWhere(side, { sun = false, station = false, gate = false, near = [] } = {})`**: `has(need)` is today's for `'sun'`, else `near.includes(need) || side.has(need)`.
  - **`HAZARD_TILT = { pirates: { distress: 2, stranded: 2, waylay: 2, escort: 1.5, smuggler: 1.5 }, storm: { stormfront: 3 }, minefield: { minefield: 3 } }`**
  - **`NEAR_TILT = { nebula: { bloom: 2 } }`**: what's round you tilts the pick too (Task 2's `whereFor` puts `'nebula'` in `near` inside a nebula zone)
  - **`tiltOf(id, { hazard = null, near = [] } = {}) → number`**: `(HAZARD_TILT[hazard]?.[id] ?? 1)` times `NEAR_TILT[n]?.[id] ?? 1` for each `n` of `near`. `choose` multiplies each row's weight by it.
  - **`ARRIVAL = { gentle: 60, first: [20, 40] }`**
  - **`createDirector({ rand, events })`** keeps every method and adds:
    - `update(dt, { …today's, big = false, hazard = null, near = [] })`:
      - its choices also leave out a `big` row while `big`, and while arriving everything but `gentle && !big`
      - a row's weight is multiplied by `tiltOf(id, { hazard, near })`
      - a forced (`soon`) or foretold id that isn't allowed now (arriving and not gentle, or big while `big`) waits until it is
    - `arrive(seconds = ARRIVAL.gentle)`: the gentle window runs from now, and the next event comes `between(ARRIVAL.first)` seconds on
    - `arriving` (a getter)
    - `allows(id, { side, zone = null, calm = false, big = false }) → boolean`: the tests `choose` makes (canHave, canBe, not heat while calm, not big while big, gentle while arriving)
    - `noted(id)`: an event that came another way (the waylay at a jump, Task 16) counts as the last, and the next comes `between(PACE.gap)` on
    - **`RETRY = { after: 4, bar: 30 }`** and `refused(id)`: the event it just gave couldn't start where you are (a flare with no star within 30,000, the remover away from the hand-made planets, an escort with no port: Tasks 10 and 11 call it when a start returns false). `last` goes back to what it was before that pick, the next comes `RETRY.after` seconds on, and `id` isn't chosen again for `RETRY.bar` seconds. So a refused pick costs four seconds, not a whole gap, and doesn't count as met.
  - With `big` false, no `hazard`, no `near` and no `refused` (every existing test), the choices and weights are today's, so every existing run picks exactly as it does now.
  - **`EVENT`** in `words.js`, the HUD's notes:

    ```js
    export const EVENT = {
      stranded: 'A distress beacon: someone’s stranded out there',
      saved: 'They’re safe: they’ll remember it',
      treasure: 'A signal: something worth finding',
      cache: 'A cache, and it’s yours',
      wormhole: 'A wormhole has opened: fly into it before it closes',
      thrown: (n) => `Thrown ${n} sectors from where you were`,
      trader: (who, where) => `${who} has a deal at ${where}: J to go`,
      waylaid: 'Pulled out of the jump: pirates',
      smuggler: 'The law’s after a runner: help either side',
      battle: (a, b) => `${a} and ${b} are fighting: pick a side`,
      picked: (who) => `You’re with ${who}`,
      derelict: 'The derelict’s powering up',
      storm: 'An ion storm front: your shields are draining',
      tidal: 'Caught in the pull: throttle up',
      migration: 'A migration: give them room',
      bloom: 'Something’s glowing out there',
      name: {
        hunt: 'Hunters', destroyer: 'A capital ship', council: 'The Council of Ricks', roadblock: 'A DEA roadblock',
        distress: 'Someone in trouble', convoy: 'A convoy', comet: 'A comet', supernova: 'A supernova', flare: 'A solar flare',
        rift: 'A rift', leviathan: 'Leviathans', meteors: 'A meteor stream', bounty: 'A bounty hunter', remover: 'The Planet Remover',
        minefield: 'A minefield', escort: 'An escort', eclipse: 'An eclipse', waylay: 'Pirates', stranded: 'A distress beacon',
        battle: 'A battle', derelict: 'A derelict', wormhole: 'A wormhole', cometpass: 'A comet, close', stormfront: 'An ion storm front',
        bloom: 'A bloom', trader: 'A trader', migration: 'A migration', tidal: 'A black hole’s pull', treasure: 'A signal', smuggler: 'A smuggler',
      },
    };
    ```

    `EVENT.name[kind]` is every `Running`'s `name` (the registry's, for lane 6b's map), one for each of the thirty ids.
  - **Lane 4a's leads move on.** With `derelict` and `treasure` in `EVENTS`, `leadEvent('trap', EVENTS)` is `'derelict'` and `leadEvent('treasure', EVENTS)` is `'treasure'`, as 4a's `LEADS` meant once they existed. 4a's `LEADS` is unchanged: `LEADS.distress` still leads to `'distress'`, and a beacon's distress call becomes a stranded ship through Task 14's `follow`, so `LEADS.distress[0]` stays `'distress'` and its assertion stands.

  - **`EVENT_LINES`** in `events/lines.js`: `{ cruiser, xwing, falcon, rv }`, each with one exchange `[[speaker, text], …]` for each of the thirteen new ids and for `'saved'`, `'thrown'` and `'picked'`, spoken by that crew's own speakers (`crews.js`'s `speakers`) or `'comms'`.

- [ ] **Step 1: Write the failing tests.** `director.test.js` gains, in new `describe`s (its import from `./director` gains `ARRIVAL`, `RETRY` and `tiltOf`):

```js
const NEW = ['waylay', 'stranded', 'battle', 'derelict', 'wormhole', 'cometpass', 'stormfront', 'bloom', 'trader', 'migration', 'tidal', 'treasure', 'smuggler'];
const OUT_THERE = ['flare', 'meteors', 'leviathan', 'minefield', 'escort', 'eclipse', 'rift', 'convoy', 'bounty'];
const everywhere = { sun: true, near: ['open', 'jump', 'station', 'derelict', 'blackhole', 'merchant', 'police'] };

describe('every event, everywhere', () => {
  it('has at least fifteen kinds: today’s and thirteen new', () => {
    expect(Object.keys(EVENTS).length).toBe(30);
    for (const id of [...OUT_THERE, ...NEW]) expect(EVENTS[id], id).toBeTruthy();
  });
  it('says of each how big it is, whether it is gentle, whether it holds the director and how long it lasts', () => {
    for (const [id, e] of Object.entries(EVENTS)) {
      for (const k of ['big', 'gentle', 'holds']) expect(typeof e[k], `${id} ${k}`).toBe('boolean');
      expect(e.lasts[0], id).toBeGreaterThan(0);
      expect(e.lasts[1], id).toBeGreaterThanOrEqual(e.lasts[0]);
      if (e.gentle) expect(e.heat, id).toBe(0);
    }
    for (const id of ['hunt', 'destroyer', 'waylay', 'battle', 'stranded', 'derelict', 'smuggler', 'stormfront', 'tidal', 'migration']) expect(EVENTS[id].big, id).toBe(true);
    for (const id of ['convoy', 'comet', 'trader', 'bloom', 'leviathan']) expect(EVENTS[id].gentle, id).toBe(true);
  });
  it('brings none of the new ones to a side alone, so a side picks as it always has', () => {
    for (const side of Object.values(SIDES)) for (const id of NEW) expect(canHave(side, EVENTS[id]), `${side.id} ${id}`).toBe(false);
    for (const side of Object.values(SIDES)) expect(canHave(withWhere(side, { near: [] }), EVENTS.escort)).toBe(canHave(side, EVENTS.escort));
  });
  it('brings each new one where the scene says it may be', () => {
    for (const side of Object.values(SIDES)) for (const id of NEW) expect(canHave(withWhere(side, everywhere), EVENTS[id]), `${side.id} ${id}`).toBe(true);
    expect(canHave(withWhere(SIDES.starwars, { near: ['open', 'merchant'] }), EVENTS.trader)).toBe(false);
  });
  it('never starts a big one while a big one is going', () => {
    const got = run(createDirector({ rand: seeded(13) }), 6000, { side: withWhere(SIDES.starwars, everywhere), big: true, zone: 'void' });
    expect(got.length).toBeGreaterThan(40);
    for (const { e } of got) expect(EVENTS[e].big, e).toBe(false);
  });
  it('tilts toward what a system is dangerous for, and a bloom toward a nebula', () => {
    expect(tiltOf('stormfront', { hazard: 'storm' })).toBe(3);
    expect(tiltOf('stranded', { hazard: 'pirates' })).toBe(2);
    expect(tiltOf('smuggler', { hazard: 'pirates' })).toBe(1.5);
    expect(tiltOf('bloom', { near: ['open', 'nebula'] })).toBe(2);
    for (const id of Object.keys(EVENTS)) expect(tiltOf(id), id).toBe(1);
  });
  it('picks by the tilted weights', () => {
    // three equal rows and a rand that always gives 0.55: 0.55 of 3 lands in
    // the second row; tilted, 0.55 of 1 + 1 + 2 lands in the third
    const row = { needs: null, weight: 1, heat: 0, zones: null, big: false, gentle: false, holds: false, lasts: [1, 1] };
    const events = { a: row, b: row, stranded: row };
    const first = (hazard) => run(createDirector({ rand: () => 0.55, events }), 60, { side: SIDES.starwars, hazard })[0].e;
    expect(first(null)).toBe('b');
    expect(first('pirates')).toBe('stranded');
  });
  it('tells what it would allow, as it would choose', () => {
    const d = createDirector({ rand: seeded(3) });
    const side = withWhere(SIDES.starwars, everywhere);
    expect(d.allows('hunt', { side, zone: 'place' })).toBe(true);
    expect(d.allows('hunt', { side, zone: 'place', calm: true })).toBe(false);
    expect(d.allows('hunt', { side, zone: 'place', big: true })).toBe(false);
    expect(d.allows('wormhole', { side, zone: 'place' })).toBe(false);
    d.noted('waylay');
    expect(run(d, 200, { side, zone: 'void' })[0]?.e).not.toBe('waylay');
  });
  it('takes back a pick the scene couldn’t start, and soon brings something else', () => {
    const d = createDirector({ rand: seeded(9) });
    const side = withWhere(SIDES.starwars, everywhere);
    const [first] = run(d, 60, { side, zone: 'void' }); // (PACE.first is 30 to 50 s, the gap 45 or more: one pick)
    d.refused(first.e);
    const next = run(d, RETRY.after + 0.5, { side, zone: 'void' });
    expect(next).toHaveLength(1);
    expect(next[0].e).not.toBe(first.e);
    const later = run(d, RETRY.bar - RETRY.after - 1, { side, zone: 'void' });
    for (const { e } of later) expect(e).not.toBe(first.e);
  });
});

describe('the arrival’s first minute', () => {
  it('brings something gentle in it, from 100 seeds and every side, and nothing that comes after you', () => {
    for (let seed = 1; seed <= 100; seed++) {
      for (const side of Object.values(SIDES)) {
        for (const zone of ['void', 'place']) {
          const d = createDirector({ rand: seeded(seed) });
          d.arrive();
          const got = run(d, ARRIVAL.gentle, { side: withWhere(side, everywhere), zone });
          expect(got.length, `${seed} ${side.id} ${zone}`).toBeGreaterThan(0);
          for (const { e } of got) expect(EVENTS[e].gentle && !EVENTS[e].big, `${seed} ${e}`).toBe(true);
        }
      }
    }
  });
  it('holds a forced ambush till the minute is out, then brings it', () => {
    const d = createDirector({ rand: seeded(5) });
    d.arrive();
    d.soon('hunt');
    const got = run(d, 90, { side: withWhere(SIDES.starwars, everywhere), zone: 'place' });
    expect(got.find((g) => g.e === 'hunt')?.t).toBeGreaterThanOrEqual(ARRIVAL.gentle);
    expect(d.arriving).toBe(false);
  });
});
```

  `lines.test.js`: for every crew of `CREWS` and every id of the thirteen and `'saved'`, `'thrown'`, `'picked'`, `linesFor(crew, 'event', id)` is a non-empty exchange whose speakers are `'comms'` or one of `crew.speakers`, each text over two characters; and `crews.js`'s own `events` rows still win over `EVENT_LINES` (`linesFor(crew, 'event', 'convoy')` is today's). And `Object.keys(EVENT.name)` is exactly `Object.keys(EVENTS)`.

  **Lane 4a's two assertions.** In `src/components/universe/things/rules.test.js`'s "lets a trapped derelict wake into an event the director has":
  - `expect(leadEvent('trap', EVENTS)).toBe('hunt'); // (lane 4b's 'derelict' isn't there yet)` becomes `expect(leadEvent('trap', EVENTS)).toBe('derelict');`
  - `expect(leadEvent('treasure', EVENTS)).toBeNull();` becomes `expect(leadEvent('treasure', EVENTS)).toBe('treasure');`
  - the other two lines of that `it` stay as they are.

  Then run `grep -n "'hunt'\|derelict" src/components/universe/things/index.test.js`: if its trap test hands `createThings` the real `EVENTS` and expects `happen('hunt')`, it now expects `happen('derelict')`; with a fake `events`, it's unchanged.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/director.test.js src/components/universe/events/lines.test.js src/components/universe/crews.test.js src/lib/words.test.js src/components/universe/things`. Expected: the new `describe`s, `lines.test.js` and the two replaced assertions FAIL; every other test passes.
- [ ] **Step 3: Implement** the columns, the rows, the rules, `EVENT` and the lines. Write the lines in each crew's voice from its existing `events` rows, with no new character speaking.
- [ ] **Step 4: Run them and see them pass.** Same command. Expected: PASS, every existing director, crews, words and things test unchanged but the two replaced assertions.
- [ ] **Step 5: Commit.** `git commit -m "The director's thirty events: how big each is, a gentle first minute, never two big ones at once"`. The body says lane 4a's two "not there yet" assertions now name `'derelict'` and `'treasure'`, the events they were waiting for.

### Task 4: Ten minutes of free flight from 100 seeded starts, on a phone's budget

**Files:**
- Create: `src/components/universe/events/pacing.test.js`
- Modify: lane 3's face `src/components/expanse/shared/space.js` (re-export `rngOf` and `hash64` from `../gen/seed` and `clearOfKeepOuts` from `../gen/keepOuts`), `src/components/expanse/shared/shared.test.js` (the three names join its list of what the face lends)

**Interfaces:**
- Consumes: Task 1's `createHere`, `sideAt`; Task 2's `ZONE`, `zonesAround`, `systemAt`, `whereFor`; Task 3's director (`refused` among it), `EVENTS`, `withWhere`; `zoneOf`, `regionAt`, `mapSectorOf` (`layout.js`), `nearestStar` (`deep.js`); lane 2's `BUDGET` (`universe/budget.js`); lane 3's face (`UNIVERSE`, `fullSector`, and from this task `rngOf`, `hash64`); `SECTOR`.
- Produces: the face lends `rngOf`, `hash64` and `clearOfKeepOuts` (Task 7 takes `rngOf` and `hash64`, Task 15 `hash64`, Task 16 `clearOfKeepOuts`, with its own default list, all of `KEEP_OUTS`). `keepOutsNear` isn't lent: with 4a's `wormholeExit` there's no exit rule of this lane's to clear, and the waylay checks every keep-out. Otherwise nothing new: it is the spec's pure pacing test. If it fails, tune `lasts`, the new rows' weights, `PACE` or `RETRY`, never the test, and say which constant moved and why in the commit.

The flight plays events as the scene does on the strictest tier:
- **Running.** Each event the director gives runs for a draw from its own `lasts`. The director is `busy` while one that `holds` runs, or while `BUDGET.low.events` (1) run at all, as Task 10's step is on a phone. `big` is whether a big one runs.
- **Refused.** A pick the scene would refuse for want of something there (`refuses`, below, mirroring Tasks 10 and 11's `start`) goes back with `director.refused(id)` and isn't counted.
- **In built space, anywhere.** Two blocks of 27 sectors are built once: the 27 round home, and 27 far out round sector `[40, -7, 12]` (about 5,000,000 from home, where nothing is hand-made). Three starts in four fly at home and one in four in the far block (spec C: "every event can happen anywhere"). A flight turns back at its block's faces (`fold`, a triangle wave), so it never leaves them for empty void; half the flights go at the pulse drive's 300 and cross their 27 more than once.

- [ ] **Step 1: Lend the three names.** Add the re-exports to the face and the names to `shared.test.js`'s list. Run `npx vitest run src/components/expanse/shared`. Expected: PASS.
- [ ] **Step 2: Write the test.**

```js
import { beforeAll, describe, expect, it } from 'vitest';
import { SECTOR } from '../../../lib/space/address';
import { UNIVERSE, fullSector, hash64, rngOf } from '../../expanse/shared/space';
import { BUDGET } from '../budget';
import { nearestStar } from '../deep';
import { EVENTS, createDirector, withWhere, zoneOf } from '../director';
import { mapSectorOf } from '../layout';
import { regionAt } from '../regions';
import { sideAt } from '../sides';
import { createHere } from './holder';
import { ZONE, systemAt, whereFor, zonesAround } from './zones';

const CREWS = ['xwing', 'cruiser', 'rv'];
const DT = 0.5;
const EDGE = 1.5 * SECTOR; // a block of 27, from its middle to its faces
const FAR_BLOCK = [40, -7, 12]; // (a quarter of the starts fly out here)
const fold = (v, mid) => {
  const u = (((v - mid + EDGE) % (4 * EDGE)) + 4 * EDGE) % (4 * EDGE);
  return mid + (u < 2 * EDGE ? u - EDGE : 3 * EDGE - u);
};
const apart = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
let sectors;
beforeAll(() => {
  sectors = new Map();
  for (const [cx, cy, cz] of [[0, 0, 0], FAR_BLOCK]) {
    for (let sx = -1; sx <= 1; sx++) for (let sy = -1; sy <= 1; sy++) for (let sz = -1; sz <= 1; sz++) {
      const s = fullSector(UNIVERSE, cx + sx, cy + sy, cz + sz);
      sectors.set(s.id, s);
    }
  }
});

// what the scene's players refuse there for want of something round you
// (the trader's station, the derelict and the black hole the zones gate)
const refuses = (id, p, zones) => {
  const system = zones.some((z) => z.what === 'system' && z.gap <= ZONE.near);
  if (id === 'flare') return nearestStar(...p).dist > ZONE.near && !zones.some((z) => z.what === 'system' && apart(z.at, p) <= ZONE.near);
  if (id === 'remover') return true; // (only over a hand-made planet, which free flight never parks at)
  if (id === 'escort') return !regionAt(...p) && !system;
  return false;
};

// one free flight from start n, as the scene plays it on a phone
function flight(n) {
  const rng = rngOf(hash64('pacing', n));
  const crew = CREWS[n % 3];
  const mid = (n % 4 === 3 ? FAR_BLOCK : [0, 0, 0]).map((k) => k * SECTOR);
  const at = mid.map((m) => m + (rng() * 2 - 1) * 1.4 * SECTOR);
  const d = [rng() - 0.5, rng() - 0.5, rng() - 0.5];
  const l = Math.hypot(...d);
  const speed = n % 2 ? 12 : 300; // (the boost, or the pulse drive out in the open)
  const director = createDirector({ rand: rng });
  const here = createHere();
  const log = [];
  let running = [], zones = [], room = null;
  for (let t = 0; t < 600; t += DT) {
    const p = at.map((v, i) => fold(v + (d[i] / l) * speed * t, mid[i]));
    const ship = { x: p[0], y: p[1], z: p[2], speed };
    if (t % 30 === 0) {
      zones = zonesAround(sectors, p);
      room = here.update(zones.filter((z) => z.what === 'system'), p, { core: Boolean(regionAt(...p)) || mapSectorOf(...p) === 'rickmorty' });
    }
    running = running.filter((r) => r.until > t);
    const side = sideAt(crew, mapSectorOf(...p), room.holder);
    const zone = zoneOf(ship, { regionAt, systemAt: (x, y, z) => systemAt(zones, [x, y, z]) });
    const busy = running.some((r) => r.holds) || running.length >= BUDGET.low.events;
    const where = whereFor({ zones, ship, side });
    const id = director.update(DT, { side: withWhere(side, where), zone, busy, big: running.some((r) => r.big), travelling: speed > 40, hazard: room.system?.hazard ?? null, near: where.near });
    if (!id) continue;
    if (refuses(id, p, zones)) {
      director.refused(id);
      continue;
    }
    const e = EVENTS[id];
    const lasts = e.lasts[0] + rng() * (e.lasts[1] - e.lasts[0]);
    running.push({ id, until: t + lasts, holds: e.holds, big: e.big });
    log.push({ t, id, lasts, at: running.length });
  }
  return log;
}

describe('the pace of things, in ten minutes of free flight on a phone', () => {
  for (const k of [0, 1, 2, 3]) {
    it(`meets three different events from each of starts ${k * 25} to ${k * 25 + 24}, one at a time, never two big ones together`, () => {
      for (let n = k * 25; n < k * 25 + 25; n++) {
        const log = flight(n);
        expect(new Set(log.map((e) => e.id)).size, `start ${n}: ${log.map((e) => e.id)}`).toBeGreaterThanOrEqual(3);
        for (const e of log) expect(e.at, `start ${n}: ${e.id} at ${e.t}`).toBeLessThanOrEqual(BUDGET.low.events);
        let bigUntil = -Infinity;
        for (const e of log) {
          if (!EVENTS[e.id].big) continue;
          expect(e.t, `start ${n}: ${e.id} at ${e.t}`).toBeGreaterThanOrEqual(bigUntil);
          bigUntil = e.t + e.lasts;
        }
      }
    });
  }
});
```

- [ ] **Step 3: Run it.** Run `npx vitest run src/components/universe/events/pacing.test.js`. Expected: PASS. (Tasks 1 to 3 made what it tests, so it passes at once if the numbers hold. If it fails, it's a finding about the numbers: tune as above.)
- [ ] **Step 4: Time it, and read the minimum.** Each `it` runs in under a second (RULES, "Tests go beside the file"); the two 27-sector builds in `beforeAll` are twice lane 2's density test's own cost (say the time in the commit). If an `it` is over, look at the zones every 60 s instead of 30 and say so in the commit. Read the fewest different events any start met, at home and far out apart (a throwaway `expect(min).toBe(-1)` over the 100 prints it; take it out again).
- [ ] **Step 5: Commit.** `git commit -m "Ten minutes of free flight from a hundred starts on a phone's budget, a quarter of them far out: three different events each time, one at a time, never two big ones together"`. The body gives the fewest any start met, at home and far out.

### Task 5: Lanes, spots and packs along the 3D nose, clear of what's there

**Files:**
- Modify: `src/components/universe/lanes.js` (`laneNear` `:174`, `convoyLane` `:192`, `meteorLane` `:214`, `flybyLane` `:230`, `laneLocal` `:87`, `laneDepart` `:106`, `laneDock` `:298`; a new `noseFrame`), `src/components/universe/lanes.test.js` (a new `describe`)
- Create: `src/components/universe/__fixtures__/lanes-level.json` (written once from unchanged code; the folder's own name for fixtures)
- Modify: `src/components/universe/nav.js:264-279` (`riftSpot`), `src/components/universe/minefield.js:49` (`minefieldLane`'s nose), `src/components/universe/hunterRules.js:310-335` (`entryPoint`) and `:238-241` (the stale "lift near the ceiling" comment: the ship's `vy` holds only the parking nudge now), `src/components/universe/hunterRules.test.js`, `src/components/universe/nav.test.js`

**Interfaces:**
- Consumes: `noseOf`, `forward`, `SOLIDS` (`ship.js`). Not `orient.js`'s `normalize`, which is a quaternion's (four components, `orient.js:21-24`: on a 3-vector it gives NaN), nor `lib/ai/vec.js`'s `unit`, which takes `{ x, y, z }`: `lanes.js` gets a local `norm3(v) → [x, y, z]` and `cross3(a, b)`.
- Produces:
  - **`noseFrame(ship) → { f, r, u }`** (not `frameOf`: lane 3's `places/carry.js` already exports a `frameOf(rows, { here, going })`):
    - **Level** (`!ship.pitch`): `[fx, fz] = forward(ship.heading)`, and `f = [fx, 0, fz]`, `r = [-fz, 0, fx]`, `u = [0, 1, 0]`, written from those two numbers directly, never through `noseOf` or `norm3`. `noseOf` rounds differently from `forward` in the last bits: for 9 of the fixture's 12 headings (`k × 0.52`) its `x` or `z` differs (at `k = 2`, `-0.5062202572327783` against `forward`'s `-0.5062202572327784`), and the fixture is exact.
    - **Pitched:** `f = noseOf(ship)`, `r = norm3(cross3(f, [0, 1, 0]))`, `u = cross3(r, f)`. When the nose is within 0.01 of straight up or down (`|f[1]| > 0.99`), `r` is `[-fz, 0, fx]` from `forward(heading)`.
  - Every lane maker takes a last argument `solids = SOLIDS`. `riftSpot(ship, rand, solids = SOLIDS)` and `minefieldLane(ship, rand, solids)` the same.
  - **Two paths, so the level one is today's to the last bit.** For a level ship (`!ship.pitch`) every maker keeps today's expressions exactly as they are, including `entryPoint`'s own `-Math.sin(ship.heading)` and its portal points' `a = ship.heading + (i − (n − 1) / 2) × 0.32` with `-Math.sin(a)`, `-Math.cos(a)` (`hunterRules.js:310-335`). Building those from `f` and `r` is the same in exact arithmetic but not in floating point, and the fixture is `toEqual`. Only a pitched ship goes through `noseFrame` (`ahead` along `f`, `side` along `r`, a rise along `u`; the portal's angle offset as a turn of `f` toward `r` by that angle). Each maker's branch is `if (!ship.pitch)` around today's lines.
  - **`entryPoint`**, pitched, places `ahead`, `behind` and `portal` points along `noseFrame(ship)`; `at` and `from` are unchanged.
  - For a level ship, every one of these gives exactly today's points for the same `rand`: the fixture pins it.

- [ ] **Step 1: Write the fixture, then the failing tests.** First, on unchanged code, add a `lanes-level` writer to the test (as lane 2's fingerprint does: written once when `LANES_WRITE` is set and the file is missing). It records, for 12 seeded level ships (heading `k × 0.52`, y `k × 40 − 200`) and a seeded `rand` each, the output of `laneNear`, `convoyLane`, `meteorLane`, `flybyLane` (both `cross` values), `riftSpot`, `minefieldLane` and `entryPoint` (`ahead`, behind, `portal`, i = 0..3 of 4). Run `LANES_WRITE=1 npx vitest run src/components/universe/lanes.test.js` once, then without it.

  Then add, in a new `describe('in three dimensions')`:
  - every level case reproduces the fixture exactly (`toEqual`)
  - `noseFrame` for a level ship is exactly (`toEqual`) `[fx, 0, fz]`, `[-fz, 0, fx]` and `[0, 1, 0]` from today's `forward`, for the fixture's 12 headings; for `pitch: 1.4` its `f` is `noseOf(ship)` and `f · r`, `f · u`, `r · u` are 0 to 1e-12; for `pitch: 1.5705` its `r` is `[-fz, 0, fx]`
  - for a ship pitched up 1.5 (all but straight up) on the pulse drive: `laneNear`'s first point, `flybyLane`'s pass point, `meteorLane`'s middle, `riftSpot` and an `ahead` `entryPoint` each lie ahead along the nose, `(p − ship) · f > 0.5 · |p − ship|`
  - with a solid `{ id: 'E:1,0:0:0', at: <today's lane middle>, r: 30 }` in `solids`, each maker's result clears it by its own margin, or is null
  - in `hunterRules.test.js`, `describe('anywhere, at any height')`: a pack sent after a ship circling 50,000 above home, and one after a ship at `[1e8, 2e7, -3e7]`, fights for 30 s of `update(1 / 30, ship)`: every hunter stays within 400 of the ship, none falls more than 1,000 below it, and lasers come (`'laser'` events), as at home
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/lanes.test.js src/components/universe/hunterRules.test.js src/components/universe/nav.test.js`. Expected: the pitched and solids tests FAIL; the level fixture passes; the anywhere test may already pass. If it does, lane 2's finding (`hunterRules.js:240`) was the comment alone: say so in the commit.
- [ ] **Step 3: Implement.** Keep `hunterRules.js`'s net growth under 40 lines. Leave every level expression as it is (the `if (!ship.pitch)` branch) and write the pitched branch beside it.
- [ ] **Step 4: Run them and see them pass.** Run `npx vitest run src/components/universe`. Expected: PASS, every existing lanes, nav, minefield, hunterRules, skirmish, leviathans and meteors test unchanged, and the fixture reproduced exactly.
- [ ] **Step 5: Commit.** `git commit -m "Lanes, spots and packs come along the ship's own nose in three dimensions, clear of what's there"`

### Task 6: The traffic a system keeps

**Files:**
- Create: `src/components/universe/events/life.js`, `src/components/universe/events/life.test.js`
- Modify: `src/components/universe/lanes.js` (append `PORT_NEAR` and `portLane`), `src/components/universe/lanes.test.js`

**Interfaces:**
- Consumes: Task 1's `holderOf`, `sideAt`, `lawAt`; Task 2's zones, `ZONE`, `nearestOf`; Task 5's `noseFrame`; `lanes.js`'s `clearance`; lane 2's `BUDGET` rows (`traffic`); `orbitAt` (the face).
- Produces:
  - **`LIFE = { gap: [1, 3], least: 0.15, portShare: 0.5, ports: 8 }`**
  - **`PORT_NEAR = [60, 300]`** in `lanes.js`, not in `LIFE`: `life.js` imports `lanes.js` (`clearance`, `noseFrame`, `portLane`), so `lanes.js` reading `LIFE` would be a cycle, and `cycles` is at its budget (5 of 5).
  - **`PORTS = ['station', 'port']`**: the zones traffic flies between
  - **`trafficHere({ zones, at, core = false, holder = null, crew, budget, t }) → Here | null`**. The spec's "the nearest system's density and faction": systems are about 19,000 apart (276 to a 120,000 sector), so most free flight is between them, and the traffic there is the nearest one's, not today's crew-side traffic.
    - **Null** in the hand-made core and the Rick and Morty pocket (`core`: the scene passes `Boolean(regionAt(...at)) || mapSectorOf(...at) === 'rickmorty'`; today's traffic, untouched, which flies the pocket's own side there), and when no system zone's `gap` from `at` is within `ZONE.near` (30,000). Its `sideAt(crew, 'main', …)` below is only ever reached outside the pocket.
    - `system`: `nearestOf(zones, 'system', at)`, its `gap` measured from `at` (not from where the zones were gathered)
    - `side`: `sideAt(crew, 'main', holderOf(system.faction))`: the nearest system's own, so between two systems the nearer one's ships fly
    - `density`: `system.traffic × max(LIFE.least, 1 − gap / ZONE.near)`: the whole of it within the system's reach, thinning to `LIFE.least` of it 30,000 out
    - `gap`: `LIFE.gap` divided by `max(LIFE.least, density)`
    - `cap`: `budget.traffic`, the groups the system's own lanes keep up at once
    - `ports`: the system's stations, then the `'port'` zones whose `system` is its id (4a's rigs sit at a field's middle, 1.15 to 1.6 of the system's reach from its star, so a radius would miss them; its shipyards and fleets carry the id too), then its planets at `orbitAt(p, t)` (`{ id, at, reach: 1.9 × radius }`), at most `LIFE.ports`
    - `law`: `lawAt(crew, holder)?.law ?? null`, from the law in force (Task 1's `createHere` holder, with its hysteresis, which the scene passes): null in an independent system's hold, so a patrol reports only where its side is the law
  - **`portLane(a, b, ship, rand, solids = SOLIDS) → { pts: [p0, p1, p2], k0 } | null`** (`lanes.js`): from beside `a` (`a.reach + 6…16`) to beside `b`, bowed out a little, clear of `solids` by 1. `k0` is where along it a group starts so you see it: the point nearest the ship that is at least `PORT_NEAR[0]` from it, or null if no point is within `PORT_NEAR[1]`.

- [ ] **Step 1: Write the failing tests.** `life.test.js`, with fake system zones `A` (`{ id: 'A', what: 'system', at: [0, 0, 0], reach: 1000, faction: { id: 'empire' }, traffic: 1 }`) and `B` (the same at `[20000, 0, 0]`, `{ id: 'federation' }`, `traffic: 0.6`), and `E:1,0`'s real zones where it says:
  - **Inside a system.** At `A.at`: `gap: [1, 3]`; with `A.traffic` 0.05, `gap` is `[1 / 0.15, 3 / 0.15]`.
  - **Between two systems, the nearer one's.** At `[13000, 0, 0]` (6,000 past `B`'s reach, 12,000 past `A`'s), flying the RV with the holder still `A`'s: `side` is `SIDES.rickmorty` (B's), the density is `0.6 × (1 − 6000 / 30000)`, and `law` is `'empire'` (the law in force is still A's).
  - **Whose.** In `A`, flying the RV: `side: SIDES.starwars`, `law: 'empire'`. An independent system gives the RV's side and, held by it, `law: null`; a faction of its own gives the RV's side and its law.
  - **Null.** With `core: true`; and 40,000 past the nearest system's reach.
  - `cap` is `BUDGET.low.traffic` … `BUDGET.ultra.traffic` for each tier's row, and `universeBudget({ tier: 'mid' }, 2).traffic` when given that row.
  - For `E:1,0`'s first system with a station: `ports[0]` is the station, every station and planet port is within the system's reach (a planet at `orbitAt(p, 777)` when `t` is 777), at most 8.
  - For `E:1,0`'s first system with a rig (`s.extras.rig`'s first row's `system`): the rig is among its ports, though it lies past the system's reach; and no other system's rig is.

  `lanes.test.js`, a new `describe('between ports')`: `portLane` between two of that system's ports starts beside one and ends beside the other (within their `reach + 16`), clears every solid passed by 1, and for a ship 120 off its middle has `k0` within 300 of the ship and at least 60 from it; a ship 5,000 away has `k0` null.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/events/life.test.js src/components/universe/lanes.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them and see them pass.** Same command, then `node scripts/health.mjs --only cycles`. Expected: PASS, and `cycles` still 5 (no new cycle through `lanes.js` and `life.js`).
- [ ] **Step 5: Commit.** `git commit -m "Traffic takes the nearest generated system's density and whose it is, thinning between systems, and flies between its ports"`

### Task 7: Far fights out in every direction

**Files:**
- Create: `src/components/universe/events/fightsOut.js`, `src/components/universe/events/fightsOut.test.js`
- Modify: `src/components/universe/farFights.js:73-78` (`fightLabel`), `src/components/universe/farFights.test.js` (a new `describe`)

**Interfaces:**
- Consumes: Task 2's system zones (or a sector's systems); `hash64`, `rngOf` (the face, lent from Task 4). Not `FAR`: `farFights.js` imports three.js, and `fightsOut.js` is pure, so the caller passes it.
- Produces:
  - **`FIGHTS_OUT = { every: 900, on: 240, share: { pirates: 0.45, storm: 0.12, minefield: 0.12, none: 0.06 }, lift: 600, size: [6, 14] }`**
  - **`fightOf(system, t) → Fight | null`**, from `rngOf(hash64(system.seed, 'fight'))` alone: whether the system fights at all (by `share[hazard ?? 'none']`), its phase in `every`, its size and heat. On while `((t / every + phase) mod 1) < on / every`. `Fight = { id: 'fight:<system id>', at: [x, y + reach + lift, z], size, hot, system: system.id, name: system.name }`.
  - **`fightsAround(systems, cam, t, { max = 3, far, held = false, core = false }) → Fight[]`**: the nearest `max` fights further than `far` from `cam`; none at all while `held` (a pose held to be measured: the shared clock is 0 there, and a fight on at t = 0 would add a `Points` draw to the pose) or while `core` (the ship in a hand-made region or the Rick and Morty pocket, whose pictures stay as they are; out-fights show once you're out among the generated systems). `far` has no default (Task 13 passes `farFights.js`'s `FAR`). `cam` is a point in the map's own frame: the scene's `camLocal` (`scene.js:547`, set each frame at `:5331`, as the front's `update` takes it at `:3912`; `farFights.update` works out the same point from the camera itself, `farFights.js:203-204`), never `camera.position`: the map is turned by `state.yaw`, so a world point picks the wrong fights far from home. `t` is the shared clock in seconds (lane 3's `state.spaceT`), so every pilot sees the same fights on; never the scene's own `t`.
  - **`fightNode(system) → { id: 'node:<system id>', kind: 'beacon', at, region: null, name }`**, a node `pickFightNode` takes
  - **`fightLabel(at, near = null)`**: `near` names a generated system: `` `Fighting near ${near}` ``, the words `fightLabel` already writes; without it, today's.

- [ ] **Step 1: Write the failing tests.** `fightsOut.test.js`, over the 27 sectors round home built in `beforeAll`:
  - **The same for everyone.** `fightOf(sys, t)` twice is equal, for 200 systems and 5 times.
  - **On and off.** A fighting system is on for 240 s of every 900: sampling every second over 900 s gives 240 ± 1 seconds on.
  - **Shares.** Over the 27 sectors' systems, the share of pirate systems that ever fight is within 0.05 of 0.45, and of hazard-free ones within 0.02 of 0.06.
  - **Every direction.** At `t = 0` and `t = 5000`, the fights on within the 27 sectors include one more than 30,000 above home, one more than 30,000 below, and one each way along x and z.
  - **The nearest past `FAR`.** `fightsAround(systems, p, t, { far: FAR })` (the test imports `FAR` from `../farFights`) keeps at most 3, all further than `FAR`, nearest first.
  - **None held, none in the core.** At a `t` and point where `fightsAround` gives three, the same call with `held: true`, or with `core: true`, gives `[]`.
  - **Pure.** `fightsOut.js`'s source imports nothing from `three` or `farFights` (read with `fs`, as `src/lib/words.test.js` reads files).
  - **A pocket's are its own.** The fights of `fullSector(universeOf('marble'), 1, 0, 0)` differ from the shared sector's.

  `farFights.test.js`: `fightLabel(at, 'Okonkwo')` is `'Fighting near Okonkwo'`; `fightLabel(at)` is today's for every existing case.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/events/fightsOut.test.js src/components/universe/farFights.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them and see them pass.** Same command. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "Far fights at generated systems in every direction, the same for everyone on the shared clock"`

### Task 8: Another pilot's hunters, anywhere

**Files:**
- Modify: `src/components/universe/online/protocol.js:320-340` (`readPack`), `src/components/universe/online/client.js:437-442` (the pack's `onMessage`)
- Test: `src/components/universe/online/protocol.test.js` (one replaced assertion, a new `describe`)

**Interfaces:**
- Produces:
  - **`PACK_NEAR = 4000`**: further than this from its pilot's last pose, a hunter is no hunter of theirs (they fly within `LOSE.far` of their quarry and come in from a few hundred off)
  - **`readPack(data, from = null)`**: positions bounded by ±1e12, as `readShot`'s are; heights the same (the ±1,300 goes, as lane 2 took it from the pose). With `from` (the sender's pose), a hunter further than `PACK_NEAR` from it is left out.
  - `client.js` passes the sender's last pose: `readPack(data, peers.get(peerId)?.pose ?? null)`.

- [ ] **Step 1: Write the failing tests.**
  - **Replace** `protocol.test.js:466`'s `x: 90000` expectation with `x: 1e9`. The spec removes the authored map's bound, and a hunter a billion out is clamped by `PACK_NEAR` against its pilot instead. Say so in the commit.
  - **Add** `describe('a pack out in the endless universe')`:
    - `readPack([[1, 'tie', 1.2e8, 4e7, -3e7, 0, 0, 0, 1]])[0]` keeps those numbers exactly
    - with `from = { x: 1.2e8, y: 4e7, z: -3e7 }`, a hunter 300 off reads and one 5,000 off is left out
    - `readPack([[1, 'tie', 1e13, 0, 0, 0, 0, 0, 1]])[0].x` is `1e12`
    - an older pilot's pack, `[[7, 'tie', 10.12, -2, 30, 19, 0, -1.3, 1]]`, reads as before
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/online/protocol.test.js`. Expected: the replaced and new tests FAIL.
- [ ] **Step 3: Implement**, and pass the pose in `client.js`.
- [ ] **Step 4: Run them and see them pass.** Run `npx vitest run src/components/universe/online`. Expected: PASS.
- [ ] **Step 5: Run PR 4b.1's gate.** Run `npm run lint`, `npm test`, `npm run build` and `node scripts/health.mjs --check --skip build`. Expected: all green; `big-files`, `glsl-sites`, `boundary-breaks` and `cycles` as on the branch before Task 1.
- [ ] **Step 6: Commit.** `git commit -m "Another pilot's hunters read anywhere in the universe, kept near their pilot"`

---

## PR 4b.2: Life out there

### Task 9: The before shots, and the scene's `happen` moves out

**Files:**
- Create: `src/components/universe/events/playExisting.js`, `src/components/universe/events/playExisting.test.js`, `docs/superpowers/evidence/endless-universe-lane-4b/README.md`, `lab/universe/before-4b/mid/*` (from `universe-check`)
- Modify `scene.js`, moving out (find each by its quoted first line):
  - the escort and eclipse state, `// a ship you're seeing to the next place` (`:1100`) through `dropEscort`'s end (`:1119`)
  - `happen`, `// what the director sets going` (`:3427`) through its end (`:3561`), leaving `travelling` (the director's step reads it) and `leadOf` (it reads the scene's `siegeSt`) where they are, as deps, and the remover branch's body (`:3455-3476`) as a scene function `startRemover(ship)`
  - the eclipse and escort steps in `adventure`, `// the eclipse: the moon along its way` (`:3933`) through the escort block's end (`:3979`)

**Interfaces:**
- Consumes: today's collaborators, unchanged.
- Produces: **`createExistingPlay(deps) → Player`** (the Global Constraints' contract) for today's seventeen kinds, with today's behaviour, plus `escort` and `eclipse` (getters, read by the dev hooks and the eclipse's dimming at `:4952` and `:5040`), `eclipseK` (a getter), `eclipseSolid` (the same object as today's `:1108`, which the lens's hiders read at `:4918`: `play.eclipseSolid` in place), `dropEscort()`, `dropEclipse()` and `later` (the queue at `:1120`, moved in; `scene.js:4032`'s `later.length = 0` and `:4052`'s `later.length > 0` read `play.later`).
  - **`hunts` stays in `scene.js`** (`let hunts = 0;`, `:1076`). It's written outside `happen` too (`hunts += 1` at `:3414`, `:3738` and `:5262`), so a getter on `play` would throw on assignment in strict ESM. `play` reads it (`first: hunts === 0`, `:3439`, the one read) and bumps it (`:3440`) through two thunks, `hunts: () => hunts` and `hunted: () => { hunts += 1; }`, and the three outside writes (a stage's summons, a call for help, the spotted patrol) are unchanged.
  - **`dispose()`** frees `eclipseMoon`'s geometry and material (today's `:6371-6372`, which become `play.dispose();`: −1).
  - **Its side.** `start(id, ship, ctx)` plays for `ctx?.side ?? side()`: `ctx.side` when Task 10's `happen` passes one (a check's `side`, below), the scene's own side when Step 4's `happen = (id, ship) => play.start(id, ship)` calls it with none.
  - **`deps`.** Values, all declared above the call and never reassigned: `group` (`map`, `:503`), `hunters`, `traffic`, `pieces`, `leviathans`, `meteors`, `mines`, `novae`, `fleet`, `camera`, `small`, `reduced`. Thunks, each declared below the call or reassigned: `state`, `side` (`sideHere`, `:968`), `emit`, `hurt`, `deed`, `wall`, `travelling`, `leadOf`, `hunts`, `hunted` (above), `litKey` (`() => litBy.key`; `litBy` is reassigned at `:5018`), `onRemover(ship) → boolean` (`startRemover`, above), `onDestroyer(ambush)` (sets `capFight`, which `capitalEvent` at `:3820` reads), `solids` (`() => solidsNow`).
  - **`running()`** registers each started event as `{ id: '<kind>:<n>', kind, name, at, big, from }` (`from`: the ship's `[x, y, z]` at the start) and lets it go when its collaborator says it's over: `hunt`, `council`, `roadblock`, `bounty`, `distress`: `!hunters.active`; `destroyer`: `!pieces.destroyerHere`; `meteors`: `!meteors.count`; `minefield`: `!mines.count`; `leviathan`: `!leviathans.busy`; `rift`: `!pieces.riftAt`; `escort`, `eclipse`: their own; `remover`: the scene's `remover` (a thunk); the rest after `lasts[1]`. Anything older than `1.5 × lasts[1]` lets go.
  - **`update(dt, t, live)` returns `moving`**: true while the escort or the eclipse is on, as their `busy = true` in `adventure` are today (`:3936`, `:3953`: the frame loop's flag, which keeps frames coming).
  - **`busy`** (the getter) is whether it holds the director: the escort's and the eclipse's, as today's director expression has them (`Boolean(escort) || Boolean(eclipse)`, `:3989`).
  - **`clear()`**: `dropEscort()`, `dropEclipse()`, and lets go of every running entry. It leaves `later` alone, as every clear does today.

- [ ] **Step 1: Take the before shots.** Run `CHROMIUM=/opt/pw-browsers/chromium node scripts/universe-check.mjs --quality mid --out lab/universe/before-4b/mid`, and `--quality mid --poses old-rim,above-core,expanse-system,expanse-station,at-gargantuan,in-field --out lab/universe/before-4b/endless-mid` (one run, so all six of lanes 3 and 4a's endless poses go in one file: `universe-check.mjs:246` writes `${out}.json` with only the poses it measured). Write the numbers into the evidence README.
- [ ] **Step 2: Write the failing tests.** `playExisting.test.js`, with fakes for every collaborator (a `vi.fn()` each, returning what today's code needs), pins today's behaviour of `happen`, read from `scene.js:3434-3561`:
  - `start('hunt', ship)` calls `hunters.pack(pick(side, 'hunt'), ship, { heat, first: true })` the first time and `first: false` after (the fakes `hunts` and `hunted` over one counter, which `hunted` bumps once for each hunt, council and roadblock); travelling, it adds `{ ahead: true, interdict: true, lead }`
  - given `ctx.side` (`SIDES.rickmorty` while the fake `side()` is `SIDES.starwars`), `start('council', ship, ctx)` packs the Council of Ricks' faction; with no `ctx`, `side()`'s
  - `'council'` passes the pack's points to `pieces.portals`; `'roadblock'` packs `'dea'` ahead and calls `pieces.roadblock`
  - `'destroyer'` calls `onDestroyer` only when `pieces.destroyer` gave a hangar
  - `'distress'` packs the side's pirates after `traffic.distress`'s prey, size 2, and emits `{ type: 'event', id: 'distress' }`; with no prey it returns false and emits nothing
  - `'convoy'` calls `traffic.convoy(ship, side)`; `'comet'` queues its event 5 s on; `'supernova'` explodes at the nearest site past 1,100 (of the two nearest)
  - `'flare'` launches at `nearestStar` and queues the shock at `arrives`; the queued run hurts 15 and sets `static`, `flare` and `shake`
  - `'rift'`, `'leviathan'`, `'meteors'`, `'minefield'`, `'eclipse'`, `'escort'` and `'bounty'` do what their branches do, each false where today's returns early
  - `running()` holds a started hunt until the fake `hunters.active` goes false
  - with an escort on, `update` returns true and `busy` is true; with nothing on, both false; `clear()` drops the escort and the eclipse and empties `running()`
- [ ] **Step 3: Run them and see them fail.** Run `npx vitest run src/components/universe/events/playExisting.test.js`. Expected: FAIL (module not found).
- [ ] **Step 4: Move the code.** Make `createExistingPlay` from the moved lines, with no change in behaviour, and wire `scene.js`:
  - after `const mines = createMines(...)` (`:1099`): `const play = createExistingPlay({ … })` (+1, its deps on the same line)
  - `const happen = (id, ship) => play.start(id, ship);` where `happen` was (+1); `law`'s bounty (`:1019`), the dev hook and lane 4a's `createThings` dep `happen: (id) => happen(id, state.ship)` (a trapped derelict) keep calling `happen`
  - in `adventure`: `if (play.update(dt, t, live)) busy = true;` where the two steps were (+1): `update` returns `moving`, the frame loop's flag
  - the director's `busy:` expression (`:3989`) reads `play.busy` in place of `Boolean(escort) || Boolean(eclipse)` (0)
  - the reads of `escort`, `eclipse`, `eclipseK`, `eclipseSolid` (`:4918`) and `later` become `play.…` in place (0 each); `hunts` stays the scene's (above); the two `eclipseMoon?.…dispose()` lines in the scene's dispose (`:6371-6372`) become `play.dispose();` (−1); and the six `dropEscort(); dropEclipse();` pairs (the ship change `:2143`, the Maw's swallow `:3097`, the crash `:3140`, the rift's in lane 4a's `throwTo` (its split of `riftThrough`'s body, `:4221` on `main`), the jump's way out `:4358`, `holdPose` `:5872`) become `play.dropEscort(); play.dropEclipse();` (0 each; Task 10 makes each `events.clear();`)

  Count `scene.js`'s lines before and after.
- [ ] **Step 5: Run them and see them pass.** Run `npm test`. Expected: PASS.
- [ ] **Step 6: Check nothing plays differently.** Start the dev server (Global Constraints) and run `CHROME=/opt/pw-browsers/chromium OUT=docs/superpowers/evidence/endless-universe-lane-4b/before node scripts/events-check.mjs rv`. Expected: as on the branch before this task (the meteor stream and the shot through a rock time out in software GL on `main` already: HANDOFF-universe's "Left").
- [ ] **Step 7: Commit.** `git commit -m "The director's events move out of the scene into a player of their own, as they were"`. The body has `scene.js`'s count (about −175).

### Task 10: The scene's events: zones, whose space, the director, the registry

**Files:**
- Create: `src/components/universe/events/sceneEvents.js`, `src/components/universe/events/sceneEvents.test.js`
- Modify: lane 2's `src/components/universe/budget.js` (`events` joins the fields the quality steps lower) and `budget.test.js` (a new `describe`)
- Modify `scene.js`:
  - `const director = createDirector();` (`:1079`) goes (−1). Every read of it moves, in place (0 each):
    - the siege's `director?.soon?.('council')` (`:2514`): `events.director.soon('council')`
    - the characters' `director.foretell(side)` (`:3707`): `events.director.foretell(side)`
    - `__universeDebug`'s `director` (`:5911`): `events.debug.director` (below: a check's `soon` starts at once)
    - `__universe()`'s `soon: (id) => director.soon(id)` (`:5963`): `soon: (id) => events.debug.soon(id)`
    - lane 4a's `createThings` dep `soon: (id) => director?.soon(id)` (a beacon's lead, 4a's Task 24): `soon: (id) => events.director.soon(id)`
  - Task 9's `const happen = (id, ship) => play.start(id, ship);` goes (−1). Every caller moves, in place (0 each):
    - the law's bounty (`:1019`): `events.happen('bounty', ship, { force: true, hold: true })`. The law sends its bounty hunter whatever the director would bring, as it does today: without `force` the director would refuse it at any place (`bounty` is `zones: VOID`) and with shields under 50 (its `heat` is 0.8). With `hold` it still waits out the arrival's minute, a big event running (it is big itself) and a full budget, so it never lands on another big one (spec C) and never makes two at once on a phone. The law already calls it only while `!hunters.active` (`law.js:106`).
    - lane 4a's `createThings` dep `happen: (id) => happen(id, state.ship)` (a trapped derelict's lead): `happen: (id) => events.happen(id, state.ship, { force: true })`. A trap is the player's own doing and springs at once; unforced it would be refused in the void, since `hunt` is `zones: PLACE`, and with no word said. (The exception this makes to "never two big ones" is Findings 18.)
    - `__universeDebug`'s `happen: (id) => happen(id, state.ship)` (`:5911`): `happen: (id, o) => events.happen(id, state.ship, { force: true, ...o })`, and the same line gains `events: events.debug`
  - Task 9's `if (play.update(dt, t, live)) busy = true;` becomes `if (events.update(dt, t, live)) busy = true;` (0): `events.update` updates every player and returns whether any is `moving` (the frame loop's flag)
  - the director's block in `adventure`, `// (where you are: a sun lighting you` (`:3985`) through `if (id) happen(id, live);` (`:3991`), all but `state.hurtNow = 0;`, becomes `events.step(dt, live);` (−5). It moves out of the `if (hunters)` around it, inside `if (live)`, so the zones and the holder refresh with reduced motion too. The interdiction's release (`:3992-3993`) stays where it is.
  - `sideHere` (`:968`) reads a holder: `let holderNow = null;` above it (+1), and `sideAt(state.kind, mapSectorOf(…), holderNow)` (0)
  - the paced step: in `paceTo` (`:5053`), beside lane 2's `expanse.setStep` and lane 3's `places.setStep`, `events.setStep(at.step, at.floor);` (+1)
  - a new pilot's spawn: in the `if (!state.ship)` block (`:2211-2220`), after `state.yaw = -state.ship.heading;`, `if (!props.startAt) events.arrive();` (+1). Lane 4c's arrival keeps this line or calls `events.arrive()` itself.
  - **Every place that ends what's going on lets go of every event too.** Task 9's six `play.dropEscort(); play.dropEclipse();` pairs (the ship change `:2143`, the Maw's swallow `:3097`, the crash `:3140`, 4a's `throwTo` (the rift's, and 4a's wormhole thing's), the jump's way out `:4358`, `holdPose` `:5872`) each become `events.clear();` (−1 each, −6). `portalThrough` (`:4246-4255`), which today drops the hunters, meteors, wingmen, skirmishes, npcs and traffic but not the escort or the eclipse, gains `events.clear();` after its `npcs?.clear();` (+1). (Through a portal the escort's freighter is gone with the traffic already, and today its block then says it was lost; now it's dropped quietly, as at a jump.)
  - `where()` (`:6277`): `events: events.running().map((r) => ({ id: r.id, kind: r.kind, name: r.name, x: r.at[0], y: r.at[1], z: r.at[2], big: r.big })), holder: holderNow && { id: holderNow.id, name: holderNow.name, side: holderNow.side },` (+1)
  - `const events = createSceneEvents({ … });` goes on the line after Task 9's `const play = createExistingPlay(…)` (+1, its deps on the one line). Everything above it that reads `events` (the law's `bounty`, `sideHere`'s callers, 4a's deps) does so inside a function, so nothing reads it before it's made.
  - Task 9's `play.dispose();` in the scene's dispose becomes `events.dispose();` (0): it disposes every player.

  That is −7 in all.

**Interfaces:**
- Consumes: Tasks 1–3, 6 and 9; lane 2's `expanse.sectors()`, `expanse.stars()`, `expanse.nearestSystem(at)`, `universeBudget`, `BUDGET`; lane 3's `places.docked()`, `places.park(id, from)`, `state.spaceT`, and the face's `bodiesAt`; `regionAt`, `mapSectorOf`, `ORDER`, `byId`, `POSITIONS` (`layout.js`, for `spotFor`'s remover), `MAW`, `SIDES`.
- Produces:
  - **In `budget.js`:** `events` is stepped with `discs`, `thingsNear` and `traffic` (`× [1, 0.75, 0.5, 0.35]` by step, `× 0.25` at the floor), rounded and never below 1, as lane 3 adds `tags`. So mid at step 2 runs 1 event at once, high at step 1 runs 2, and no step takes any tier under 1.
  - **`createSceneEvents(deps) → SceneEvents`**, every method a later task calls listed here (a later task fills in the ones marked with its number; until then each gives what's said):
    ```
    SceneEvents = {
      update(dt, t, live) → moving,
      step(dt, live),
      happen(id, ship, { force = false, hold = false, at = null, side = null } = {}) → boolean,
      arrive(),
      running() → Running[], busy, director,
      holder() → Holder | null, here() → { system, holder, core }, zones() → Zone[], life() → Here | null,
      pull(ship) → { v, k } | null,                          // Task 18; null until then
      targets, hit(from, to, punch) → hit | null,            // Tasks 17's; [] and null until then
      riftExit(ship) → { park, exit } | null,                // Task 11 (a generated system), Task 15 (the wormhole); null until then
      spot(ship) → { x, y, z } | null,                       // Task 13 (the skirmish's spot); null until then
      fights() → Fight[],                                    // Task 13 (what state.fights holds); [] until then
      follow(row, lead) → boolean,                           // Task 14 (a beacon's lead); false until then
      outOfJump(j, park) → park, afterJump(j, park) → event, // Task 16; park, and { type: 'jumped', id: j.id }, until then
      setStep(step, floor), clear(), debug, dispose(),
    }
    ```
  - **`deps`.** Today's collaborators (as Task 9's), plus: `play` (Task 9's player), `players` (the new events' players, added by Tasks 13–19; `[]` here), `expanse` and `places` (values: declared at `:772` and by lane 3 above `:1099`), `device` (`{ tier, detail }`, as lane 2 hands `universeBudget`), and thunks:
    - `busyElse(live)`: today's director `busy` expression from `:3989`, less the escort and eclipse (`law.busy`, `hunters.active`, `pieces.destroyerHere`, `remover`, `leviathans.holds(live)`, `meteors.count`, `mines.count`, the map view, `charting`, `held`, `front.near`)
    - `setHolder(h)`: `(h) => { holderNow = h; stockUp(); }`. `stockUp` (`:2233`) reads the holder-aware `sideHere()` and makes that side's hunters ahead, once a side, as `portalThrough` does at `:4261` when the side changes: so the first hunt in an Empire system out there doesn't build its models inside the frame.
    - `jumping` (`() => state.jump`), `atStation` (`() => Boolean(state.at && byId(state.at)?.kind === 'core')`), `inGate` (`() => state.at === 'starwars'`), `hurtNow` (`() => state.hurtNow ?? 0`), `spaceT` (`() => state.spaceT`, lane 3's shared clock), `diff`, `standing`, `pick(id)`, `note(text)`. The sun lighting you is worked out from `litKey()` as `:3986` does today, moved in.
  - **Core.** `core = Boolean(regionAt(...at)) || mapSectorOf(...at) === 'rickmorty'`, worked out once per refresh and passed to both `createHere().update` and `trafficHere`: the Rick and Morty pocket is nobody's, its traffic and law the crew's and the pocket's own, as today (Review Focus 5).
  - **Zones.** `step` refreshes `zonesAround(expanse.sectors(), at)` once a second of the scene's clock, or after 2,000 units, and `createHere().update(systems, at, { core })`. A changed holder calls `setHolder`. With them it works out `life()`: Task 6's `trafficHere({ zones, at, core, holder, crew: state.kind, budget, t: spaceT() })`.
  - **`busy`** (the director's) is `busyElse(live) || any player's busy || running().length >= budget.events`.
  - **The director's step** runs only while `hunters` exists, so reduced motion has no events, as today. It is today's, with `where = whereFor({ zones, ship, side, sun, station, gate, docked: Boolean(places.docked()), jumping: Boolean(jumping()) })`, `zone: zoneOf(live, { regionAt, systemAt })`, `side: withWhere(sideHere(), where)`, `busy` as above, `big: running().some((r) => r.big)`, `hazard: here.system?.hazard ?? null` and `near: where.near` (the same `whereFor` answer, so the bloom's nebula tilt is read). A pick it gives is started on its player; one whose `start` returns false goes back with `director.refused(id)`.
  - **`happen(id, ship, { force, hold, at, side })`** finds the player whose `kinds` hold `id` and starts it with `ctx` (its `at` the one given; its `side` `SIDES[side]` when a check names one, else `sideHere()`):
    - **A check's side.** `side` is for the dev hook and the checks alone, so a check can force a side's own event whatever crew it flies: the council (the Rick and Morty side's, `sides.js:137`) or the trader (a side with a merchant: Lando's Star Wars, Saul's Breaking Bad; Rick and Morty has none). No caller in the scene passes it.
    - **Not forced**, it refuses (false, nothing started) while `busy`, and unless `director.allows(id, { side, zone, calm: shield < 50, big })`.
    - **Forced**, it starts at once whether or not the director would allow it: the dev hook, a check's `soon`, a thing's trap.
    - **Forced and held** (the law's bounty): it passes the zone and the calm, but while the director is `arriving`, while a big event runs (for a big `id`), or while `running().length >= budget.events`, it's kept (one at most; a newer replaces it) and started on the first `step` none of those holds. It returns true when kept. `clear()` and the 30,000 let-go drop it.
  - **`running()`**, `busy`, `targets` and `hit` gather every player's.
  - **Letting go.** `update` lets go of any running event whose `from` (the ship where it started) is more than `ZONE.near` (30,000) from the ship now, by its player's `drop(id)`: a beacon left behind by a reduced-motion trip, a teleport or the far side of a long flight never holds the director. So the contract gains **`drop(id)`**: let go of that one event and hide its looks (`clear()` is every one). Task 9's player gets it too: `drop` of the escort or the eclipse is `dropEscort()` or `dropEclipse()`; of anything else, it only leaves the registry.
  - **`clear()`** clears every player and drops a held event. Task 16's waylay mark is not an event and survives it (the jump's own block clears between `outOfJump` and `afterJump`).
  - **`setStep(step, floor)`**: `budget = universeBudget(device, step, floor)`.
  - **`debug`**: `{ kinds() → string[] (every id a player plays: 30 once Task 19 is in), running(), here(), life(), zones(), director, soon(id, o), clear(), spotFor(kind) → Spot | null }`, with `Spot = { x, y, z, heading, side: string | null, out: boolean }`:
    - **`spotFor(kind)`** is where, and for which side, a check forces a kind: `side` is what the check passes to `happen` (null: the ship's own), and `out` says whether the spot is out in generated space or at a hand-made place. It searches the loaded sectors (`expanse.sectors()`, lane 2's `expanse.nearestSystem(at)`) and never builds one. A spot near a generated system is moved out along its own line, 200 at a time, until it clears every sphere of the face's `bodiesAt(system, spaceT())` by 50, so a teleport there never lands in a planet:

      | kinds | spot | side | out |
      |---|---|---|---|
      | `remover` | 3 × its size off the nearest hand-made planet that isn't a core (`ORDER`, `byId`, `POSITIONS`: inside the 5 × size today's start wants, `scene.js:3462`), facing it | null | no |
      | `tidal` | 3 reaches off the nearest black hole among the loaded sectors' extras (4a's `hole`), facing it; with none loaded, 3 reaches off the Maw | null | yes with 4a's hole; no at the Maw |
      | `eclipse` | half its reach straight above the nearest generated system's star, facing it, so that star is the one lighting you (`litKey()`, Assumption 3) | null | yes |
      | `trader` | lane 3's `places.park(id, from)` of the nearest generated station | `'starwars'` (Lando) | yes |
      | `derelict` | 2,000 off the nearest derelict zone in the loaded sectors (lane 2's lattice derelicts, 4a's wrecks), facing it; with none, the default (the stand-in plays) | null | yes |
      | `council` | the default | `'rickmorty'` (the Council of Ricks) | yes |
      | every other kind | the default: the nearest generated system to the ship (`expanse.nearestSystem`), at its reach + 500 from its star, level, facing it | null | yes |

      Every side-bound kind but those two plays for any side: every side has a leviathan (`sides.js:114`, `:187`, `:253`: the purrgil, the Cromulon, the bear), pirates, police, a bounty faction and a capital ship, and the roadblock packs `'dea'` from `FACTIONS_ALL` whoever flies.
    - **`soon(id, o)`**, a check's force: on the next `step` with a live ship, `happen(id, live, { force: true, ...o })`. It never waits for the arrival's minute, the budget or the director's own `busy`. `step` refreshes the zones (when due) before it runs a `soon`, and a teleport is a move of more than 2,000, so a `soon` forced just after one plays with the new place's zones. `scripts/events-check.mjs` and `scripts/flare-check.mjs` load `#/universe` with no start link, so after this task every visit starts with the gentle minute, and a `soon('rift')` through the director would wait 60 s of the scene's clock (ten minutes of wall in software GL, against the checks' 30 to 90 s waits), and on `?quality=low` `soon('meteors')` would wait behind the flare's registry entry too.
    - **`director`**: what `__universeDebug.director` now is, `{ soon: (id) => debug.soon(id), get intensity() { return director.intensity; }, foretell: (...a) => director.foretell(...a) }`, so `events-check.mjs:38-92`'s `director.soon(…)`, `flare-check.mjs:38`'s and `universe-npc-check.mjs:82,114`'s `director.intensity` work as before.

- [ ] **Step 1: Write the failing tests.** `sceneEvents.test.js`, over a fake expanse holding `E:1,0` and fake collaborators (a fake player whose `start` returns what the test says and whose `running()` lists what it started):
  - **Zones and whose space.** A ship inside an Empire-held system of `E:1,0` gets `holder().side === 'starwars'` and `setHolder` called once; it stays through 300 steps on that system's edge. `life()` there has the Star Wars side; at `[0, 0, 0]` (the core) it is null.
  - **The Rick and Morty pocket.** A fake sector in the expanse holding one Empire system (`reach` 1,000) just outside the pocket's keep-out (its `at` `SECTOR_RADIUS.rickmorty + 4000 + 1000 + 10` from `SECTORS.rickmorty.origin`). A ship stepped inside that system's reach has `holder().side === 'starwars'`; carried in steps of 500 to the pocket's middle, it has `holder()` null, `life()` null, and `lawAt(crew, holder())` is `sideFor(crew)` for each crew. (Before this task's `core`, the last system's holder followed the ship in, and `lawAt` gave the Empire's.)
  - **The director's inputs.** With a spy director, `update` gets `zone: 'place'` inside a generated system and `'void'` far between; `hazard` is the system's; `side.has('station')` is true near a station and false 40,000 from any.
  - **Never more than the budget.** A scripted run of 600 s of steps with every new kind forced through `happen` as soon as it can: with `device: { tier: 'low' }`, `running().length` is never over 1 for an unforced start; with `'high'`, never over 3.
  - **Never two big ones from the director.** In the same run, no director-started big event begins while another big one is running.
  - **The arrival.** After `arrive()`, the director's first pick in 60 s is gentle (spy on `director.update`'s result).
  - **Forcing and refusing.** `happen('convoy', ship, { force: true })` starts it whatever the director says. Unforced, `happen('convoy', ship)` returns false and starts nothing while `busyElse` is true, while a fake player's `busy` is true, and while `running().length` is at `budget.events`.
  - **A thing's trap.** With the ship in the void (`zone: 'void'`), `happen('hunt', ship, { force: true })` (lane 4a's trap dep) starts the hunt at once and registers it, with the director arriving and a big fake event running; `happen('hunt', ship)` there is refused (`hunt` is `zones: PLACE`).
  - **The law's bounty.** In a generated system's reach (`zone: 'place'`) with shields at 40, `happen('bounty', ship, { force: true, hold: true })` starts it at once and registers it; unforced it's refused. With a big fake event running, it's kept, not started; the step after that event ends, it starts. After `arrive()`, it's kept until the minute is out. On `'low'` with a flare running, it waits for the flare. `clear()` while it's kept drops it.
  - **A check's force.** After `arrive()`, `debug.soon('rift')` starts the rift on the next `step`, with `director.arriving` still true. On `'low'` with a flare registered, `debug.soon('meteors')` starts on the next `step`. `debug.director.soon` is the same call, and `debug.director.intensity` is the director's.
  - **A check's side.** With the ship's side the Star Wars side, `happen('council', ship, { force: true, side: 'rickmorty' })` starts the fake player with `ctx.side === SIDES.rickmorty`, and `debug.soon('trader', { side: 'starwars' })` passes `ctx.side === SIDES.starwars` on the next `step`; with no `side`, `ctx.side` is `sideHere()`'s.
  - **Where a check forces each kind.** With a fake expanse holding `E:1,0` (and `nearestSystem` over it) and fake `places.park`: `spotFor('remover')` is within 5 × size of a hand-made planet and `out: false`; `spotFor('tidal')` is 3 reaches off the Maw with `out: false` when no sector holds a hole, and 3 reaches off a fake 4a hole row with `out: true` when one does; `spotFor('trader')` is `places.park`'s answer for a station of `E:1,0` with `side: 'starwars'`; `spotFor('council').side` is `'rickmorty'`; `spotFor('eclipse')` is within its system's reach, straight above the star; and every kind of `debug.kinds()` has a spot, none inside a sphere of `bodiesAt` for its system.
  - **A refused pick.** A spy director that gives `'flare'` where the player's `start` returns false gets `refused('flare')` once.
  - **Gone with the place.** An event started, then `clear()` (what the jump's way out, the rift, a portal, the ship change, the Maw, a crash and a held pose call): `running()` is empty and the director's next `busy` is false. An event started, then the ship moved 30,001 from where it started with no clear: the next `update` calls the player's `drop` with its id once, and the director isn't busy for it.
  - **Reduced motion.** With `hunters: null`, `step` never calls the director.
  - **`setStep`.** On `'mid'`, `setStep(2, false)` gives an events cap of 1; on `'high'`, `setStep(1, false)` gives 2.
  - **The interface.** Every method of `SceneEvents` above exists with no player in, and gives its "until then" answer.

  `budget.test.js`, a new `describe('events at once, stepped')`: `universeBudget({ tier: 'mid' }, 2).events` is 1, `({ tier: 'high' }, 1)` is 2, `({ tier: 'high', detail: 'ultra' }, 0)` is 3, `({ tier: 'low' }, 3, true)` is 1; no step or floor raises `events` or takes it under 1 on any tier.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/events/sceneEvents.test.js src/components/universe/budget.test.js`. Expected: FAIL (`sceneEvents.js` not found; `events` not stepped).
- [ ] **Step 3: Implement and wire.** Count `scene.js`'s lines. Run `grep -n "happen(\|director" src/components/universe/scene.js` after: no `happen(` but `events.happen(` and `play.start` is left, and no bare `director` but `events.director` and `events.debug.director` (lint's `no-undef` would catch one, but at a thunk only when it runs).
- [ ] **Step 4: Run them and see them pass.** Run `npm test` and `npm run lint`. Expected: PASS, every existing `budget.test.js` and `things` test unchanged.
- [ ] **Step 5: The checks that force events.** Start the dev server (Global Constraints) and run `CHROME=/opt/pw-browsers/chromium OUT=docs/superpowers/evidence/endless-universe-lane-4b/after-10 node scripts/events-check.mjs rv` and `CHROME=/opt/pw-browsers/chromium OUT=docs/superpowers/evidence/endless-universe-lane-4b/after-10 node scripts/flare-check.mjs xwing`, then stop it. Expected: as before Task 9 (the rift opens and takes the ship, the flare goes, the leviathans pass, a bounty hunter comes; the meteor stream and the shot through a rock time out in software GL as on `main`).
- [ ] **Step 6: Commit.** `git commit -m "The scene's events know what's round the ship and whose space it is, let go of what you've left, and never run more than the tier allows"`. The body has `scene.js`'s count (about −7), and says lane 4a's trap and beacon deps now go through `events`.

### Task 11: The existing events, out there

**Files:**
- Modify: `src/components/universe/events/playExisting.js`, `playExisting.test.js`, `src/components/universe/traffic.js:529-540` (`convoy`), `src/components/universe/setpieces.js:409-422` (`rift(ship, solids)`), `src/components/universe/meteors.js:99` (`storm(ship, rand, solids)`), `src/components/universe/mines.js:127` (`lay(ship, rand, solids)`), `src/components/universe/leviathans.js:191` (`pass(ship, who, rand, solids)`), `scripts/universe-endless-check.mjs` (the `events` step)
- Modify `scene.js`:
  - `riftThrough` (`:4210`; lane 4a has split its body after `const park = …` into `throwTo(park, opts)`) asks the events first: `const ours = events.riftExit(s);` on the line after `const s = state.ship;` (`:4211`; above it, `s` would be read before it's declared) (+1), then `const exit = ours ? ours.exit : riftExit(state.at, Math.random, mapSectorOf(s.x, s.y, s.z), state.saw);` and `const park = ours ? ours.park : parkFor(exit, [s.x, s.z]);` in place (0 each). 4a's `throwTo(park, …)` after them is unchanged.
  - `createSetPieces(map, { small, fleet })` (`:1080`) gains `solids: () => solidsNow` (0)

**Interfaces:**
- Consumes: Task 2's zones; Task 5's solids arguments; lane 2's `expanse.stars()`; lane 3's `places.park(id, from)`.
- Produces, in `playExisting.js` (each with `ctx` from Task 10):
  - **The flare** flares the nearest of `deep.js`'s `STARS` and the zones' systems (a system's star at its `at`, `r: star.size`), when one is within 30,000; else it returns false.
  - **The eclipse** finds the star lighting you by `litKey().id` among `expanse.stars()` (lane 2's, which hold lighting's `STARS` too), not `LIT_STARS` alone, so a generated sun can be eclipsed. `where.sun` is worked out the same way (`scene.js:3986` moves into Task 10's step).
  - **The supernova** goes off at the nearest of `SUPERNOVA_SITES` past 1,100, or out in generated space at a generated system's star 6,000 to 40,000 off (inside the far plane, so it's drawn); its shell spreads over the better part of a minute as `supernova.js` draws it.
  - **The rift** opens clear of every solid in `solidsNow`; out past the core it throws you to a generated system in the zones you haven't seen (`state.saw`), parked by `places.park(id, from)`, else to `riftExit`'s hand-made place as today. **`events.riftExit(ship) → { park, exit } | null`**: `exit` is the place's id (what `'rifted'` emits and `isPlace` reads); null in the core, so `riftThrough` keeps today's `riftExit` and `parkFor` there. Task 15 adds the wormhole's, `exit` null.
  - **The escort** heads for the next port ahead among `events.life()`'s `ports` (Task 6), the hand-made `PLACES` in the core as today; out of the core with no system within 30,000 it returns false (and the director's pick goes back: Task 10's `refused`).
  - **The convoy gets a column of its own** (HANDOFF-universe's "Left"): `traffic.convoy(ship, side, { ports, solids })` flies a column with its escort on Task 6's `portLane` between two of the system's ports, starting where you see it, and it always has a slot (past `MAX`), so it never spawns nothing. Where there are no two ports, `convoyLane` as today, then `laneNear`. It registers as running, with its lead's `at`, so the map shows it.
  - **The meteor stream, the minefield, the leviathans and the capital ship** take `solidsNow`, so none is laid through a generated planet or station.
  - **The bounty** comes anywhere, as it does.
  - **The remover** stays at the hand-made planets (finding 4): elsewhere its `start` returns false, and the director's pick goes back with `refused`, so a Rick and Morty pilot in a generated system loses four seconds to it, not a whole gap.

- [ ] **Step 1: Write the failing tests.** In `playExisting.test.js`, a new `describe('out there')`, over `E:1,0`'s zones and fakes:
  - a flare in a generated system launches at that system's star; 40,000 from any star, it returns false
  - with `litKey()` a generated star's id and `expanse.stars()` holding it, the eclipse plans against that star
  - the supernova's site is a generated star 6,000 to 40,000 off when no hand-made site is within 40,000
  - `riftExit` from generated space gives `{ park, exit }`, `exit` a zone system not in `saw` and `park` from `places.park`; in the core it gives null
  - the escort's `to` is a port of the system
  - `traffic.convoy` gets the system's ports and the frame's solids, and a convoy run registers as running

  `traffic.test.js` already exists (Node, its own `fakeFleet()` and a seeded `Math.random`): it gains a `describe('a convoy between ports')`, in which a convoy with two ports flies a column on a port lane, and spawns even with `MAX` groups already flying. Its existing `describe('a convoy')` is unchanged.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/events/playExisting.test.js src/components/universe/traffic.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement**, then add the endless check's `events` step. Its kinds come from its own flag, `--events a,b,c` (comma-split; lane 3's `--only` splits on commas into step names, so the kinds can't ride on it), or with no `--events`, all of `__universeDebug.events.kinds()`. It flies whatever crew the endless check flies (Assumption 17) and never switches ship: a kind bound to a side gets it from `spotFor`. For each kind:
  1. `const spot = events.debug.spotFor(kind)`; teleport there (lane 2's `__universeDebug.teleport(spot.x, spot.y, spot.z, spot.heading, 0)`), and wait until lane 2's `expanse.loaded()` holds the spot's sector and two frames have drawn (`__universe().frames(2)`), so the next `step` has refreshed the zones there. There is one leg: a spot is already out in generated space for every kind but the remover, which needs a hand-made planet, and the tidal pull when no 4a black hole is loaded (the Maw stands in); the table prints `out` for each.
  2. `__universeDebug.happen(kind, spot.side ? { side: spot.side } : undefined)`
  3. wait until `events.debug.running()` holds that kind (or its own sign: `pieces.riftAt`, `leviathans.busy`, `meteors.count > 0`, `mines.count > 0`, the escort, the eclipse), giving up after 30 s of the scene's clock or 120 s of the wall's, whichever first. A forced start registers on the frame it's forced, so most pass at once; the cap only bounds a kind that never comes. A kind that gives up fails the step, with `spotFor`'s answer and `happen`'s in the message.
  4. shoot it, `events-<kind>.jpg`, into the evidence folder
  5. `events.debug.clear()`, and wait until `running()` is empty (the same caps)
- [ ] **Step 4: Run them and see them pass.** Run `npm test`, then `node scripts/universe-endless-check.mjs --quality mid --only events --events flare,meteors,leviathan,minefield,escort,eclipse,rift,convoy,bounty`. Expected: PASS, exit 0, nine shots, every one with `out: true` (all nine out in generated space), no console errors.
- [ ] **Step 5: Commit.** `git commit -m "The flare, the rift, the eclipse, the escort and the rest play out in generated space, and the convoy has a column of its own"`. The body has `scene.js`'s count (+1).

### Task 12: Traffic from the nearest system

**Files:**
- Modify: `src/components/universe/traffic.js:357-429` (`update`'s spawn and spotting), `src/components/universe/traffic.test.js`, `scripts/universe-endless-check.mjs` (the `life` step)
- Create: `src/components/universe/__fixtures__/traffic-core.json` (written once from unchanged code)
- Modify `scene.js`: the traffic call (`:5252`) passes `here: events.life()` in its options object (0)

**Interfaces:**
- Consumes: Task 6's `trafficHere`, `portLane`; Task 10's `events.life()`.
- Produces: `traffic.update(dt, t, ship, { fight, feared, wanted, here = null })`. With `here` null (the core), today's code path, untouched. With `here`:
  - **Who flies.** New groups take their kinds from `here.side` (the nearest system's: Task 6). `fleet.want(kindsFor(here.side))` is asked once when it changes. Groups already flying fly on: a change of side never clears traffic (`setCrew`'s clear is for a crew change only, as today).
  - **How often.** The next group comes `between(rand, ...here.gap)` on.
  - **Where.** `LIFE.portShare` of new groups fly a `portLane` between two of `here.ports`, starting at its `k0` and fading in (`FADE_OVER`, as a cut-short run does); the rest cross the space round you (`laneNear` with `solids`).
  - **How many.** Port-lane groups are capped at `here.cap`; the everyday cap `MAX` stays.
  - **The law.** A patrol reports a wanted pilot only for `here.law` (none in an independent system), in place of `side.law`.
  - The flyby (`:388-395`) is unchanged.

- [ ] **Step 1: Write the fixture, then the failing tests.** First, on unchanged code, add a `traffic-core` writer to `traffic.test.js`, as Task 5's `lanes-level` is: written once when `TRAFFIC_WRITE` is set and the file is missing. For seeds 11, 23 and 37 of the file's own `seeded` (`traffic.test.js:18`) put in for `Math.random`, a `createTraffic` with its `fakeFleet()` and the RV's crew, and a ship flying level at 12 from home, it records 600 s of `update(1 / 30, t, ship, { fight: false, feared: false, wanted: false })` as every 30th frame's `groups.map((g) => ({ id: g.id, kind: g.kind, t: g.t, lead: g.lead }))` (the `groups` getter's own fields, `traffic.js:589-591`). Run `TRAFFIC_WRITE=1 npx vitest run src/components/universe/traffic.test.js` once, then without it, and commit the fixture with this task.

  Then, in `traffic.test.js`, new `describe`s:
  - with `here.side` the Star Wars side while the crew is the RV, every new group's kind is one of `kindsFor(SIDES.starwars)`
  - a group spawned under one `here` is still flying, at the same place, the frame after `here` changes to another side's
  - at `here.gap = [10, 30]`, 600 s of updates spawn about a tenth as many everyday groups as at `[1, 3]` (between 0.05 and 0.2 of them)
  - port-lane groups never exceed `here.cap`, and each starts at least 60 from the ship
  - with `here.law: null` and a wanted pilot, no `'spotted'` event comes; with `'empire'`, a TIE patrol passing within `SPOT` reports
  - with `here` null (and with no `here` passed), the same three runs reproduce `traffic-core.json` exactly (`toEqual`)
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/traffic.test.js`. Expected: the new tests FAIL but the fixture's, which passes on unchanged code.
- [ ] **Step 3: Implement and wire**, then add the endless check's `life` step. At five places (a generated system held by a known faction; deep space between systems; 50,000 above the core; `[1e7, 0, 0]`, a far sector; home):
  1. read what's there before: the largest group `id` in `__universeDebug.traffic.groups` (0 for none; `traffic.js:268`'s `nextGroup` only counts up) and the ids in `events.debug.running()`
  2. teleport there, level, on the boost, and read the scene's clock (`__universeDebug.state.clock`)
  3. wait until something new moves near the ship: a group whose `id` is over the one read in 1 and whose `lead` is within 3,000 of the ship (`__universe().ship`; `lead` is in the map's own frame, as the ship is), or a running event or a skirmish (`skirmishes.active`) that wasn't there in 1. Nothing flying from before the teleport counts.
  4. fail if 20 s of the scene's clock passed first (the spec's 20 seconds), or 600 s of the wall's (the 400 frames 20 s takes at 0.05 s a frame, at the slowest frame or so a second software GL draws here)
  5. print the clock time it took; at the held system, check every new group's kind is the holder's side's; in deep space between systems, that every new group's kind is the nearer system's side's (`events.debug.life().side.id`)
- [ ] **Step 4: Run them and see them pass.** Run `npm test`, then `node scripts/universe-endless-check.mjs --quality mid --only life`. Expected: PASS, exit 0, the five times printed and copied into the README.
- [ ] **Step 5: Commit.** `git commit -m "Traffic reads the nearest system: its density, whose it is, and its ports to fly between"`

### Task 13: Hunters, the law and far fights read whose space it is

**Files:**
- Create: `src/components/universe/events/playFar.js`, `src/components/universe/events/playFar.test.js`
- Modify `scene.js`, moving out the far fights (find by quote): `const SKIRMISH_EVERY` (`:3758`) through `fightsNow`'s end (`:3814`), and `if (skirmishes) farFight(dt, t, live);` with the `state.fights` refresh (`:3876-3877`), which become the far play's, run by `events.update` each frame of `adventure`, `live` or not, as `:3876` runs today (about −60). `farFights.update(dt, state.fights, camera);` (`:3878`) stays and draws what the far play writes to `state.fights`. In place (0 each):
  - `createHunters(…, { …, solids: SOLIDS, … })` (`:972`), `createWingmen` (`:974`) and `createSkirmishes` (`:975`): `solids: () => solidsNow`
  - `npcWorld` (`:3686`): `solids: SOLIDS` becomes `get solids() { return solidsNow; }`
  - `createLaw`'s `side: () => sideFor(state.kind)` (`:1016`): `side: () => lawAt(state.kind, holderNow)`
  - `standing.side(sideOf(state.kind))` (`:3867`): `standing.side(lawAt(state.kind, holderNow)?.id ?? sideOf(state.kind))`
  - `stood`'s `const side = sideFor(state.kind)` (`:986`): `lawAt(state.kind, holderNow) ?? sideFor(state.kind)`
  - `skirmishSpot`'s reads (`meet`'s at `:3693`, the dev hook `meetNpc`): `events.spot(s)`
  - `where()`'s `farFights` (`:6291`): `(state.fights ?? []).map((f) => ({ id: f.id, x: f.at[0], y: f.at[1], z: f.at[2], label: f.label ?? fightLabel(f.at) }))`, so the map gets the height and `Fighting near <system>`
- Modify: `scripts/universe-endless-check.mjs` (the `fights` step)

**Interfaces:**
- Consumes: Task 7's `fightOf`, `fightsAround`, `fightNode`, `fightLabel`; Task 10's zones, holder, `core` (`ctx.here.core`) and `spaceT`; `FAR`, `pickFightNode` (`farFights.js`), `placeAt` (`skirmish.js:76`), `destinationById` (`nav.js`), `regionAt` (`regions.js`) and `ZONE as FRONT_ZONE` (`front.js`), imported by `playFar.js` itself as `scene.js` imports them (`:129`, `:138`, `:158-160`), not passed; and `NODES` (`waypoints.js:88`, which `farFights.js` takes as `pickFightNode`'s default and `scene.js` doesn't import), imported by `playFar.js` from `../waypoints`.
- **`createFarPlay(deps)`'s deps**, in Task 9's form. It's made on the line before `createSceneEvents(…)` (Task 10's, after `:1099`) and handed to it in `players`; its deps go on its own line (+1, counted below). Values, each declared above that line and never reassigned: `skirmishes` (`:975`), `hunters` (`:972`), `pieces` (`:1080`), `leviathans` (`:1097`), `meteors` (`:1098`), `pops` (`:859`), `burn` (`:887`), `crashFx` (`:832`), `deed` (`:1001`), `camLocal` (`:547`, set in place each frame at `:5331`), `side` (`sideHere`, `:968`: a function, passed as itself), `later` (Task 9's `play.later`, the queue moved into `play`). Thunks, each declared below the line or reassigned: `state` (`:1174`), `emit` (`:1719`), `front` (`() => front`: `let front`, `:1053`, is reassigned by `frontFor`), `solids` (`() => solidsNow`: reassigned each frame, `:906`), `spaceT` (`() => state.spaceT`), `holder` (`() => holderNow`). `popDir` (`:2544`, below) isn't passed: `playFar.js` keeps a `THREE.Vector3` of its own for it.
- Produces: **`createFarPlay(deps) → Player`** with `kinds: []` (Task 17 adds `'battle'`), `fights()` (what `farFights.update` draws and `where().farFights` lists, each with `y`, and `label: fightLabel(at, near)`), and `spot(ship)` (today's `skirmishSpot`, clear of `solidsNow`):
  - **Today's skirmish, out ahead,** every `SKIRMISH_EVERY`, at `pickFightNode({ ship, headedFor, nodes })`, where `nodes` is `NODES` plus `fightNode` of every system in the zones (so out past the core one is near, not 100,000 off at a hand-made beacon)
  - **The far fights out.** `fightsAround(zone systems, camLocal, spaceT(), { far: FAR, held: Boolean(state().held), core: ctx.here.core })` joins `fights()` with the skirmish and the front, drawn by `farFights` (its pool of four). None while a pose is held, and none in the core: each out-fight would be one more `Points` draw call (`farFights.js:37`), and the ten baseline poses and the hand-made places keep their pictures and their counts. `camLocal` is the camera in the map's frame (`scene.js:547`, set in place each frame), passed as a dep; `spaceT` is lane 3's shared clock (Task 10's dep), so two pilots see the same fights on.
  - **Coming up on one.** Within `FAR` of a far fight that's on and not yet fought this window, the skirmish starts there (`placeAt(node, solidsNow)`), its hunters the holder's side's `skirmish.faction` (the crew's with no holder), and its impostor gives way to the real one
- **Hunters, wingmen, skirmishes and the characters** fly round what's there now: the generated planets, moons, stations and things (lane 2's `expanse.solids()` and lane 3's `places.solids()` are in `solidsNow`).
- **The law and your standing** are the holder's (`lawAt`). Crossing into an independent system, `wanted.side(null)` drops the stars (nobody's law there) and keeps each side's bounty in storage, as `wanted.js:108-117` does.

- [ ] **Step 1: Write the failing tests.** `playFar.test.js`, over `E:1,0`'s zones and a fake `skirmishes`:
  - `fights()` holds the far fights `fightsAround` gives from the `camLocal` and `spaceT` passed in, each labelled `'Fighting near <system name>'` and with its height; two plays given the same `spaceT` list the same fights
  - with `state.held` set (and `spaceT` 0, as at a held pose), or with `ctx.here.core` true, `fights()` holds no out-fight (no `id` starting `fight:`), at a point and time where it holds three otherwise
  - a ship flown within `FAR` of an on fight starts one skirmish there, its faction the holder side's, and not again in that window
  - the out-ahead skirmish's node, from a generated point, is within 30,000 of the ship
  - `spot(ship)` clears a generated solid passed in `solids`

  `law.test.js`, a new `describe('whose law it is')`, with a real `createWanted` and the file's `fakes()`, the law's `side` thunk switching from `SIDES.starwars` to null and back over 30 steps each: `wanted`'s side changes exactly twice (a wrapper round `wanted.side` counts the calls whose id differs from the one before: `law.step` calls it every step through `sync()`, `law.js:84`, and it returns at once when nothing changed, `wanted.js:108-109`); the stars are 0 while it's null; and the Empire's bounty is back after. It passes on today's `law.js` and `wanted.js`, which this lane doesn't change: it pins what the scene's new `side: () => lawAt(state.kind, holderNow)` relies on.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/events/playFar.test.js src/components/universe/law.test.js`. Expected: `playFar.test.js` FAILS (module not found); the new `law.test.js` `describe` passes already.
- [ ] **Step 3: Implement and wire**, then add the endless check's `fights` step (`__universe()` has no far fights: they're on `__universeDebug.state.fights`, each `{ id, at: [x, y, z], size, hot, label }`):
  1. teleport into a generated sector's middle
  2. wait until `__universeDebug.state.fights` holds one whose `label` starts `Fighting near ` and whose `at[1]` is set, up to 30 s of the scene's clock and 120 s of the wall's
  3. teleport 1,500 from it, and wait until `__universeDebug.skirmishes.active` (the same caps)
  4. shoot it, `fights.jpg`
- [ ] **Step 4: Run them and see them pass.** Run `npm test`, then `node scripts/universe-endless-check.mjs --quality mid --only fights,life`. Expected: PASS.
- [ ] **Step 5: Run PR 4b.2's checks.** Start the dev server and run `CHROME=/opt/pw-browsers/chromium node scripts/navmap-check.mjs` and `CHROME=/opt/pw-browsers/chromium node scripts/flyto-check.mjs --fake`, then stop it; run `CHROMIUM=/opt/pw-browsers/chromium node scripts/universe-check.mjs --quality mid --out lab/universe/after-4b2/mid` and `--quality mid --poses old-rim,above-core,expanse-system,expanse-station,at-gargantuan,in-field --out lab/universe/after-4b2/endless-mid` (one run). Expected: as before Task 9; calls and triangles at every pose of both no higher than `before-4b`'s. Task 12's port-lane traffic is most likely to show at `in-field` (4a's rigs are ports) and `expanse-station`: if either rises, it's traffic, so hold port-lane groups within the pose's old count there, and say the numbers in the commit.
- [ ] **Step 6: Commit.** `git commit -m "Hunters, the law and far fights read whose space it is, and fly round what's there"`. The body has `scene.js`'s count (about −59: −60 moved out, +1 for `createFarPlay`'s line).

---

## PR 4b.3: Thirteen new events

Each task below adds a player to Task 10's `players` list (+0 in `scene.js`: the list is one argument on `createSceneEvents`'s line), a pure rules file with its test, the player's Node test with fakes, and the endless check's `--only events --events <kinds>` run at mid.

### Task 14: Signals: a distress call, and a treasure signal

**Files:**
- Create: `src/components/universe/events/signals.js`, `signals.test.js`, `src/components/universe/events/playSignals.js`, `playSignals.test.js`
- Modify: `src/components/universe/events/sceneEvents.js` and its test (`follow`), `scene.js`'s `createThings(…)` deps line (0)

**Interfaces:**
- Consumes: Task 5's `noseFrame`; Task 10's `ctx` and `happen(id, ship, { force, at })`; lane 4a's `follow(row, lead)` dep on `createThings` (a beacon row: `{ id, kind: 'beacon', at, size, … }`); `hunters.pack`, `traffic.escort` (the stranded ship, held nearly still), `deed`, `pay`, `note`, `EVENT`; `kit.js`'s `paint(draw, w, h)` (a canvas painted and made an sRGB `CanvasTexture`; it needs no renderer, so the player's deps don't grow) and `parts(list)`; `hot(hex, k)` (`lib/three/canvasTexture.js`).
- Produces, in `signals.js`:
  - **`SIGNAL = { near: [600, 1500], cone: 0.7, reach: 40, clear: 120, life: 300 }`**
  - **`signalSpot(ship, rand, solids = []) → [x, y, z] | null`**: 600 to 1,500 along the 3D nose, at most `acos(0.7)` off it, clear of every solid by `r + SIGNAL.clear`, from eight tries
  - **`STRANDED = { waves: 2, gap: 20, pack: 2, bite: 0.012, near: 30 }`**
  - **`createStranded({ at }) → { at, phase, hull, step(dt, { you, on, cleared }) → events }`**. `you` is the ship's `[x, y, z]` or null; `on` how many pirates are within `near` of it; `cleared` whether the current wave is down.
    - `'calling'` until you're within `SIGNAL.reach`: `'reached'`; past `SIGNAL.life`: `'gone'`
    - `'defend'`: `'wave'` (n 1) at once, then `'wave'` (n 2) `STRANDED.gap` after the first is cleared; its hull loses `on × bite × dt`; at 0, `'lost'`; both waves cleared, `'saved'`
  - **`TREASURE = { reach: 25, pay: 5, guarded: 0.3, life: 300 }`**
  - **`createTreasure({ at, rand }) → { at, guarded, phase, step(dt, { you }) → events }`**: `'reached'` (and `'guards'` when guarded), then `'opened'` with `{ pay: TREASURE.pay }`; past `life`, `'gone'`
  - **`FOLLOW = { distress: 'stranded', escort: 'stranded', treasure: 'treasure' }`**: what a beacon's lead plays. Lane 4a's beacon `act()` works out the lead by its one rule, `leadEvent(traitsOf(row).leads, events)` over its `LEADS` (`things/rules.js`), and hands it with the row to its `follow(row, lead)` dep. A beacon's distress call is a ship stranded at the beacon (the spec's distress call), so `'distress'` and `'escort'` play `'stranded'`. There's no second rule of which beacon leads where.
  - **`besideBeacon(row, ship, solids = []) → [x, y, z] | null`**: `row.at` moved toward the ship by `2 × row.size`, clear of every solid by `r + SIGNAL.clear`; null when that point isn't clear
- Produces: **`createSignalsPlay(deps) → Player`** with `kinds: ['stranded', 'treasure']` (Task 15 adds two). One look, made when first wanted: a beacon (a `Sprite` of a radial gradient painted by `paint`, `sizeAttenuation: false`, its colour `hot()` so the bloom takes it, blinking by scale) and a cache (a small crate from `kit.js`'s `parts`, `MeshStandardMaterial` in `PALETTE.grey.hex`). Both invisible at rest.
  - **Stranded:** the beacon at `signalSpot`; a note (`EVENT.stranded`); reached, a stranded ship (a `traffic.escort` group on a 3-unit path at 0.01, so it holds nearly still past `SIGNAL.life`) and the waves (`hunters.pack(pick(side, 'pirates'), you, { prey, size: 2, ace: false })`); saved, `deed('rescued')` and `EVENT.saved`; lost, a burst.
  - **Treasure:** the beacon; reached, the cache (and a pirate pack if guarded); opened, `pay('found', 5)` and `EVENT.cache`.
  - **`follow(row, lead) → boolean`**, in `sceneEvents.js` (Task 10's `events.follow`, filled here): with `FOLLOW[lead]` a kind some player plays, its own `happen(FOLLOW[lead], ship, { force: true, at: besideBeacon(row, ship, solids) })`, so the stranded ship or the cache is at the beacon you're parked by, not 600 ahead along the nose. It returns what `happen` returns. For any other lead, or with `besideBeacon` null, it returns false and starts nothing, and 4a's beacon falls back to `soon(lead)`, the director's own event.
    - **Forced, not held, on purpose.** Answering a beacon is the player's own act at the beacon, as springing a trap is, so the stranded ship (big) starts at once even over a running big event, and on `low` over the one event `budget.events` allows. Held like the law's bounty, it could start a minute on, at a beacon you've flown from. It is the fourth named exception to "never two big ones together" (Findings 18), and the hand-off lists it.
  - **The seam, wired:** `scene.js`'s `createThings(…)` deps line gains `follow: (row, lead) => events.follow(row, lead)` (0, on the line). 4a's `act()` calls it for every beacon and skips its `soon` when it returns true (4a's Task 24). `HANDOFF-NOTES.md` records it, under "Landed".
  - `start(id, ship, ctx)` with `ctx.at` puts the beacon (stranded) or the cache (treasure) there and skips `signalSpot`.
  - Forced with no room ahead, `start` puts the beacon at 600 straight ahead, or returns false with nothing registered if that is inside a solid.

- [ ] **Step 1: Write the failing tests.** `signals.test.js`:
  - `signalSpot` over 50 seeded level and pitched ships lies 600 to 1,500 off, within the cone, and clear of a solid passed in
  - a stranded call reached by a ship 30 off emits `'reached'`, then `'wave'` 1; with `cleared` it emits `'wave'` 2 twenty seconds on; with both cleared, `'saved'`
  - with three pirates on it, the hull is gone in `1 / (3 × 0.012)` seconds, to 0.1 s, and `'lost'` comes once
  - unreached for 300 s, `'gone'`
  - a treasure reached emits `'opened'` with `pay: 5`; 30 % of 1,000 seeded ones are guarded (±4 %)
  - `FOLLOW` has a row for each of 4a's `LEADS` lists' event ids that a beacon can lead to (`'distress'`, `'escort'`, `'treasure'`), each one of this player's kinds
  - `besideBeacon` for a beacon of size 30 lies 60 from it toward the ship, and is null when a solid covers that point

  `sceneEvents.test.js`, a new `describe('a beacon followed')`, with this player in: `follow({ id: 'E:1,0:w9', kind: 'beacon', at, size: 30 }, 'distress')` returns true and registers a `'stranded'` whose `at` is within 61 of the beacon (not 600 ahead along the nose), even with the director arriving, and on `'low'` with a big fake event running (the exception, pinned so it's seen); `follow(row, 'treasure')` registers a `'treasure'` there; `follow(row, 'hunt')` returns false and registers nothing.

  `playSignals.test.js`, with fakes, and `document` stubbed in `beforeAll` as `crashNodes.test.js:9-14` does (a canvas whose context takes `createRadialGradient` and `fillRect`), so `paint` runs in Node: a started stranded call registers `{ kind: 'stranded', big: true }`, packs pirates after the stranded ship on reaching it, and calls `deed('rescued')` once when saved; a treasure opened calls `pay('found', 5)` once; `clear()` hides the beacon and the cache and empties `running()`; the meshes are invisible before any start.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/events/signals.test.js src/components/universe/events/playSignals.test.js src/components/universe/events/sceneEvents.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement**, add the player to `players`, give `prepare` (`warm`) each mesh when it's made, and pass `follow` to `createThings`.
- [ ] **Step 4: Run them and see them pass.** Run `npm test`, then `node scripts/universe-endless-check.mjs --quality mid --only events --events stranded,treasure`. Expected: PASS, two shots.
- [ ] **Step 5: Commit.** `git commit -m "A distress beacon to answer and a signal to follow, each with something at the end of it"`

### Task 15: A wormhole opens, and a trader hails you

**Files:**
- Modify: `src/components/universe/events/signals.js`, `signals.test.js`, `playSignals.js`, `playSignals.test.js`, `src/components/universe/events/sceneEvents.js` and its test (`riftExit`'s wormhole), `src/components/universe/setpieces.js:409-432` (`rift(ship, { solids, life, r })`, defaults today's)
- Modify `scene.js`, in place (0 each):
  - `npcWorld`'s `stations: STATIONS` (`:3685`) is unchanged: the merchant's brain flies to a station only within `NPC.station` (120, `npcs/brains/common.js:9`; `merchant.js:27-32`) and otherwise parks where it is, so a generated station up to 30,000 off would never be flown to
  - `createSceneEvents(…)`'s deps gain `universe` (lane 3's `const universe`, above `createExpanse` at `:772`) and `setCameFrom: (x) => things.setCameFrom(x)` (4a's), on its line
  - nothing in `riftThrough`: Task 11's `events.riftExit(s)` already comes first, and 4a's `throwTo(park, …)` after it throws you

**Interfaces:**
- Consumes: lane 4a's **`wormholeExit({ seed, sector }, universe) → { sector, key, at, heading, side }`** (on the face: the one rule for a one-way throw, 30 to 80 sectors on, 150 past one of that sector's beacons), its **`things.setCameFrom({ id, name, at, key })`** (the scene's one `where().cameFrom`) and its **`throwTo(park, opts)`** (`riftThrough`'s body, split out); `hash64` (the face, from Task 4); `sectorAt`, `sectorKey` (`lib/space/address.js`); lane 3's `places`; `NPCS`, `visitorsOf` (`npcs/index.js`); `npcs.add`; `EVENT.name.wormhole` (Task 3).
- Produces, in `signals.js`:
  - **`WORMHOLE = { life: 60, r: 12, ahead: [120, 220] }`**. No exit rule of its own: the throw is 4a's `wormholeExit`.
  - **`wormholeFrom(universe, ship, n) → { seed, sector: [sx, sy, sz] }`**: `seed = hash64(universe, 'wormhole', sectorKey(...sector), n)`, `sector = sectorAt(ship.x, ship.y, ship.z)`: what 4a's `wormholeExit` takes, the same for the same visit's nth wormhole in a sector
  - **`TRADER = { near: 30000, beside: 14 }`**
  - **`traderPlan({ side, zones, ship }) → { npc, station, at } | null`**: the side's merchant visitor (`'merchant'` brain), the nearest station zone within `TRADER.near`, and a spot `beside` you (14 off your wing: inside `NPC.offer`, 15, so the merchant's `offer` comes once it's parked); null with no merchant or no station
  - **`sectorsApart(a, b) → number`**: the most of `|a[k] − b[k]|` over the three axes of two sectors (`[sx, sy, sz]`), for the thrown note
- Produces, in `playSignals.js`, `kinds` gains `'wormhole'` and `'trader'`:
  - **Wormhole:** `pieces.rift(ship, { solids, life: WORMHOLE.life, r: WORMHOLE.r })`, the rift's own mesh larger and open a minute; it keeps `from = wormholeFrom(universe, ship, n)` and where it opened. Not flown into, it closes.
  - **Flown into** (the scene's `riftThrough`, while `pieces.riftAt` is this wormhole): `events.riftExit(s)` asks this player first, which:
    - works out `exit = wormholeExit(from, universe)` and gives `{ park: { x: exit.at[0], y: exit.at[1], z: exit.at[2], heading: exit.heading }, exit: null }`
    - records where you came in through `setCameFrom({ id: 'wormhole:<n>', name: EVENT.name.wormhole, at: <where it opened>, key: sectorKey(...from.sector) })`, the same four fields 4a's wormhole things give `cameFrom()`, so `where().cameFrom` keeps one shape for lane 6b
    - notes `EVENT.thrown(sectorsApart(from.sector, exit.sector))` ("Thrown 47 sectors from where you were"): the exit's sector isn't built (it's 30 to 80 sectors on), so there's no system name to give without building it, and a raw key (`E:41,-3,7`) is no words for the HUD (Task 3's `EVENT.thrown(n)`).
    
    Then `riftThrough` calls 4a's `throwTo(park, …)` as for any rift: `arriveAt` there, the hunters left behind, and Task 10's `events.clear()` inside it. `cameFrom` lives in 4a's `things`, so the clear leaves it.
  - **Trader:** `npcs.add(NPCS[npc], at)` beside you: the merchant comes alongside, and with no station within its brain's `NPC.station` (120) it parks where it is (`merchant.js:27-32`) and says its existing `offer` line once you're within 15. The deal is at the station: it's picked (`pick(station.id)`, so J goes there), `EVENT.trader(name, station.name)` says so, and the trip there docks you (lane 3), which opens the Hangar's shop (lane 3's `'dock'` event with `open: true`). The merchant doesn't fly to the station; the trip takes you. With no station near, forced: a note, false, nothing left.

- [ ] **Step 1: Write the failing tests.**
  - `signals.test.js`: `wormholeFrom` gives the same `{ seed, sector }` for the same universe, sector and `n`, and a different seed for another `n` or another universe; and its answer is one 4a's `wormholeExit` takes (`wormholeExit(wormholeFrom(UNIVERSE, ship, 1), UNIVERSE).key` is 30 to 80 sectors from the ship's, as 4a pins). `traderPlan` gives Lando for Star Wars near `E:1,0`'s first station, Saul for Breaking Bad, null for Rick and Morty (no merchant) and null 40,000 from any station; its `at` is 14 from the ship. `sectorsApart([1, 0, 0], [41, -3, 7])` is 40.
  - `playSignals.test.js`: a wormhole calls `pieces.rift` with `life: 60`; its `riftExit` gives a park at `wormholeExit(from, universe).at` with its heading and `exit: null`, calls the fake `setCameFrom` once with `{ id: 'wormhole:1', name: EVENT.name.wormhole, at, key }`, `key` the sector it opened in, and notes `EVENT.thrown(n)` with `n` from 30 to 80 (no `E:` in the note); with no wormhole open, `riftExit` gives null. A trader calls `npcs.add` with the merchant at a spot 14 from the ship and `pick` with the station's id; forced with no station, it returns false and registers nothing.
  - `sceneEvents.test.js`: a wormhole's `cameFrom` call happens before `clear()` would be called (the order `riftThrough` keeps).
  - `setpieces.test.js` (if absent, in `playSignals.test.js` against the real set pieces in Node): `rift(ship)` keeps today's life and size; `rift(ship, { life: 60, r: 12 })` holds open 60 s.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/events`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement and wire.**
- [ ] **Step 4: Run them and see them pass.** Run `npm test`, then `node scripts/universe-endless-check.mjs --quality mid --only events --events wormhole,trader`. Expected: PASS. The wormhole's run flies into it and waits until 4a's `cameFrom()` (read the way 4a's own `wormhole` step reads it) has an `id` starting `wormhole:` and the ship's sector is the exit's. The trader's run travels to the station and waits until lane 3's `__universe().docked` is the station's id. Both with the events step's caps.
- [ ] **Step 5: Commit.** `git commit -m "A wormhole that stays open a minute and throws you far by the one rule there is, and a trader who hails you to a station's shop"`

### Task 16: Pulled out of a jump, and a smuggler chase

**Files:**
- Create: `src/components/universe/events/fights.js`, `fights.test.js`, `src/components/universe/events/playFights.js`, `playFights.test.js`
- Modify: lane 3's `src/components/universe/places/scenePlaces.js` and its test: one getter, **`sector(key) → Sector | null`**, the loaded sector of that key (`expanse.sectors().get(key)`) or the fetched one (its last four, which `resolve` already reads), else null. It makes nothing and asks for nothing.
- Modify `scene.js`, in the jump's way out (`:4341-4367` on `main`, as lane 3 leaves it), two lines in place (0 each):
  - lane 3's `const park = outOfJump(j);` becomes `const park = events.outOfJump(j, outOfJump(j));`
  - the block's last line, `emit({ type: 'jumped', id: j.id });`, becomes `emit(events.afterJump(j, park));`

  Between the two the block runs as it does today: `arriveAt(park); hunters?.clear(); meteors.clear(); mines.clear(); events.clear(); wingmen?.clear(); skirmishes?.clear(); npcs?.clear(); state.interdicted = false; state.safeUntil = …; crashFx.arrive(…)`. Anything packed or interdicted in `outOfJump` would be undone by it, so the pirates come in `afterJump`, after every clear.

**Interfaces:**
- Consumes: Task 5's `noseFrame`, `laneNear`; Task 3's `director.allows`, `noted`, `arriving`; Task 10's `events.clear()` (which leaves the waylay's mark); lane 3's `isPlaceId` (`places/ids.js`), `parseSpaceId` (Task 0's), `state.arrived` and `places.sector(key)` (above); through the face, `bodiesAt`, `thingRow`, `THING_KINDS`, `clearOfKeepOuts` (lanes 2 and 3, the last lent from Task 4), and 4a's `solidOf` and `gargantuanKeeps`; `sectorAt`, `sectorKey` (`lib/space/address.js`); `hunters.pack` (its `'hunted'` event with `interdict` sets `state.interdicted`, `scene.js:3371-3379`, as every ambush's does); `traffic` (a runner); `side.police`, `pick(side, 'pirates')`.
- Produces, in `fights.js`:
  - **`WAYLAY = { short: [1500, 6000], most: 0.6, clear: 40, near: 8000, tries: 8, base: 0.08, pirates: 0.3 }`**
  - **`waylayChance({ hazard, heat, arriving, calm }) → number`**: `base` (or `pirates` in a pirate system), times `1 + min(heat, 6) / 6`; 0 while arriving or calm
  - **`waylayPark(from, park, rand, { bodies = [], outs, key = null } = {}) → { x, y, z, heading } | null`**:
    - on the line from `from` to the park, short of it by a distance in `WAYLAY.short` (1,500 to 6,000), never more than `WAYLAY.most` of the whole way, whatever the jump's length: so it's always near the destination, never out in the unbuilt sectors a long jump crosses
    - heading on toward the park
    - clear of every body (`{ at, r }`) by `r + WAYLAY.clear`, and of every keep-out (`clearOfKeepOuts(p, WAYLAY.clear, outs)`, `outs` left out for its default, all of `KEEP_OUTS`: never inside a hand-made region's, the Rick and Morty pocket's wall among them; the tests pass their own)
    - in the sector `key` when one is given (`sectorKey(...sectorAt(...p)) === key`), so every body it could be inside is one of that sector's rows
    - from `WAYLAY.tries` draws of the distance; null if none is clear, and null for a jump shorter than `3 × short[0]`
  - **`bodiesOf(sector, t, at, near = WAYLAY.near) → [{ at, r }]`**: the solid bodies of a sector whose spheres come within `near` of `at`, read from its pure rows, never from what's drawn:
    - every system's `bodiesAt(system, t)` (its star by size, its planets at `orbitAt`, its moons), skipping a system whose reach doesn't come within `near`
    - every station (`r: size`)
    - every extras row's `solidOf(row)`, and every gargantuan's `gargantuanKeeps(row)` (4a's: a hole's body, an arc's band, a hulk's spine, a giant, a swarm's core)
    - every lattice thing within `near` with a non-null `solidOf(thingRow(sector, i))`, swept from the typed arrays with no row made for one out of range
  - **`canWaylay(j, { then, arriving }) → boolean`**: only a jump to a generated place (`isPlaceId(j.id)`), and never with `then` set (a portal leg) or while `arriving`. That leaves out a pilot's id (`pilot:<id>`), the gate (`'starwars'`, whose arrival the page sends on to `/galaxy`), every tour leg (the tour goes only to hand-made places: `tourFrom`) and every hand-made place.
  - **`SMUGGLER = { ahead: [70, 120], speed: 1.8, police: [2, 3], away: 900 }`**
  - **`smugglerLane(ship, rand, solids) → pts | null`**: `laneNear`'s shape four times as long, so the runner crosses well ahead and keeps going
  - **`smugglerEnd({ runner, police }) → 'caught' | 'escaped' | null`**: `runner` is `'alive' | 'down' | 'away'`, `police` how many are left. Down: caught. Away (past `SMUGGLER.away` from its start) or no police left: escaped.
- Produces: **`createFightsPlay(deps) → Player`** with `kinds: ['waylay', 'smuggler']` (Task 17 adds `'derelict'`), **`outOfJump(j, park) → park`** and **`afterJump(j, park) → event`** (Task 10's `events.outOfJump` and `events.afterJump` call them), and **`events.debug.markJump() → boolean`**, a check's force like `debug.soon`:
  - **Marking.** At the spool (Task 10's `step` sees `state.jump.phase === 'spool'`), once per jump: it rolls `waylayChance`, and marks the jump if the roll hits, `canWaylay(j, { then, arriving })` and `director.allows('waylay', …)`. The director's own pick of `'waylay'` while a jump spools marks it the same way; with no jump going, unforced, `start` returns false.
  - **`markJump()`** sets a flag, `forceNext`, and returns true (false only with no fights player, under reduced motion). It can't know the next jump's target, so it decides nothing itself: the next spool reads the flag first and marks that jump if `canWaylay(j, { then, arriving: false })`, skipping the roll, the arrival's minute (every check loads with no start link, so `events.arrive()` ran at the spawn: waiting it out is 60 s of the scene's clock, ten to twenty minutes of wall in software GL) and `director.allows`. The id, `then` and pilot rules still hold: a flagged jump to a pilot, the gate, a hand-made place or a portal leg isn't marked. Either way the spool uses the flag up.
  - **`outOfJump(j, park)`**, of a marked jump: `key = parseSpaceId(j.id).key`, `sector = places.sector(key)`. With no sector at hand, the park unchanged and nothing armed (lane 3 only jumps to an `E:` id once its sector is at hand, so this is a guard, not a path). Else it gives `waylayPark(ship, park, rand, { bodies: [...bodiesOf(sector, spaceT(), park), ...solidsNow], key })` and arms `waylaid = { id: j.id }`; when that is null, the park unchanged and nothing armed. It packs nothing and sets nothing else.
  - **`afterJump(j, park)`**, with `waylaid` armed for `j.id`: sets lane 3's `state.arrived` to null (so no dock opens: lane 3's dock reads it in `render()`, after this frame's `adventure`); packs the side's pirates ahead, interdicting (`hunters.pack(pick(side, 'pirates'), ship, { ahead: true, interdict: true, size: 3..4 })`); notes `EVENT.waylaid`; calls `director.noted('waylay')`; registers `'waylay'` (big); disarms; and returns **`{ type: 'arrived', id: j.id, done: false }`**, so the page treats it as a trip cut short (`pages/Universe.jsx:375-390`: no going on through a gate, a tour stops as a dropped trip stops it today, no `grandtour`). Otherwise it returns `{ type: 'jumped', id: j.id }`, today's.
  - **`clear()`** lets go of the waylay and the smuggler as running events, and leaves `waylaid` armed: the jump's own block calls `events.clear()` between `outOfJump` and `afterJump`.
  - **Forced** with no jump going: the jump's flash where you are (`crashFx.arrive`), the pirates ahead, interdicting.
  - **The smuggler:** a runner (the side's `civil` kind, flown by `traffic.escort` on `smugglerLane` at `SMUGGLER.speed` × its speed) and the police after it (`hunters.pack(side.police.faction, ship, { prey: runner, size: 2..3, ace: false })`). The runner shot down by you: `deed('killPirate')`. The police you shoot are crimes as any are (the law's own handling). It ends at `smugglerEnd`. `EVENT.smuggler` as it starts.

- [ ] **Step 1: Write the failing tests.** `fights.test.js`:
  - `waylayPark` over 200 seeded draws: for a 10,000 jump it lands 1,500 to 6,000 short, on the line, heading toward the park; for a 100,000 jump and a 2,000,000 one, still 1,500 to 6,000 short (never far back along a long jump); for a 4,000 jump, null
  - **a gargantuan on the jump line** (a 100,000 jump): with `bodies = gargantuanKeeps(g)` for a `giant` row of size 2,000 whose middle is on the line 5,500 short of the park (one sphere of 2,100, covering 3,400 to 7,600 short), every answer is 1,500 to 3,360 short and at least 2,140 from its middle; with the same row of size 4,000 at 3,500 short (covering the whole band), null; with a `hulk` row whose spine crosses the line inside the band, every answer clears each spine sphere by 40, or is null
  - with `outs` holding a keep-out across the band, every answer is outside it or null; with `key` a sector the band leaves, it's null
  - `bodiesOf` of `E:1,0` at a planet of its first system holds that system's star, planets and moons at `t` (`bodiesAt`'s), its stations, and, for a fake sector whose `extras.gargantuan` holds a row, that row's `gargantuanKeeps`; nothing whose sphere is further than `near`
  - `waylayChance` is 0 while arriving or calm, 0.3 in a pirate system with no heat, and rises with heat to twice that at 6
  - `canWaylay` is true for `{ id: 'E:1,0:0:0' }`, and false for `'pilot:abc'`, `'starwars'`, a hand-made station's id, an `E:` id with `then` set, and an `E:` id while arriving
  - `smugglerLane` lies ahead along the 3D nose and clears a solid passed
  - `smugglerEnd` for each case

  `playFights.test.js`, with fakes (`hunters` a list of packs whose `clear()` empties it, a `state` with `arrived` and `interdicted`), playing the jump's block in its order: `const park = play.outOfJump(j, j.park)`, then `hunters.clear()`, `play.clear()` and `state.interdicted = false` as the block does, then `const e = play.afterJump(j, park)`:
  - for a marked jump to `'E:1,0:0:0'`, with the fake `places.sector('E:1,0')` the real `fullSector(UNIVERSE, 1, 0, 0)`: `outOfJump` alone packs nothing and returns a park 1,500 to 6,000 short of the original and clear of `bodiesOf` that sector; after the block's clears, `afterJump` leaves one pirate pack with `interdict: true`, `state.arrived` null and `noted('waylay')` called once, and returns `{ type: 'arrived', id: 'E:1,0:0:0', done: false }`
  - an unmarked jump: `outOfJump` returns the park it was given, and `afterJump` returns `{ type: 'jumped', id }` and packs nothing
  - a marked jump whose sector `places.sector` doesn't have: the park unchanged, nothing armed, and `afterJump` returns `{ type: 'jumped', id }`
  - unforced, a jump to `'pilot:abc'`, to `'starwars'`, with `state.then` set, or with `director.arriving`, is never marked (the roll stubbed to hit)
  - **a check's mark.** With `director.arriving` true and the roll stubbed to miss, `markJump()` returns true, and the next jump, to `'E:1,0:0:0'`, is marked and ends waylaid (`afterJump` gives `{ type: 'arrived', … }`). `markJump()` then a jump to `'pilot:abc'` (or to `'starwars'`, or with `state.then` set): not marked, the flag used up, and the jump after that, to `'E:1,0:0:0'` with the roll missing, isn't marked either
  - a smuggler start packs the police with the runner as prey

  `scenePlaces.test.js` (lane 3's), one new `it`: `sector(key)` is the loaded sector for a loaded key, the fetched one for a fetched key, and null for any other, with no request made.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/events/fights.test.js src/components/universe/events/playFights.test.js src/components/universe/places/scenePlaces.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement and wire.**
- [ ] **Step 4: Run them and see them pass.** Run `npm test`, then `node scripts/universe-endless-check.mjs --quality mid --only events --events waylay,smuggler`. Expected: PASS. The waylay run (`__universe()` has no interdiction: it's `__universeDebug.state.interdicted`):
  1. teleports into a generated sector and marks the next jump (`events.debug.markJump()` is true), straight after the load, with the arrival's minute still running: a check's mark doesn't wait for it
  2. starts a jump to a generated planet 20,000 or more off (`__universeDebug.travel(id, 'hyper')`)
  3. waits until `__universeDebug.state.interdicted` and the ship is 1,500 to 6,000 short of the park, with the events step's caps
  4. checks `location.pathname` is still `/universe`, `__universe().docked` is null and `__universeDebug.state.arrived` is null, once 2 more seconds of the scene's clock have passed
  5. shoots it, `events-waylay.jpg`
- [ ] **Step 5: Commit.** `git commit -m "Pirates pull you out of a jump a little short of a generated place, clear of what's there and after the jump's own clean-up, and the trip is cut short; and the law chases a runner you can help or stop"`

### Task 17: A battle you can join, and a derelict wakes

**Files:**
- Modify: `src/components/universe/events/fights.js`, `fights.test.js`, `playFights.js`, `playFights.test.js`, `src/components/universe/events/playFar.js`, `playFar.test.js`
- Modify `scene.js`: the bolt chain (`:2601`) and the missile chain (`:2786`) each try `events.hit(from, to, punch)` after the leviathans (+1 each); the far lock candidates (`:4528`) gain `...events.targets` (0)

**Interfaces:**
- Consumes: `createSkirmishes`, `createSkirmish` (as they are); `targeting.js`'s `intercept`; `createBolts` (`galaxy/shared/fx.js`, as the scene's power bolts use it); Task 2's derelict zones.
- Produces, in `fights.js`:
  - **`BATTLE = { ahead: [500, 1000], apart: 160, size: [4, 5], pick: 2 }`**
  - **`battleSides(crewSide, holderSide) → [a, b]`**: `a` is the holder's side or the crew's; `b` is the next of `['starwars', 'rickmorty', 'breakingbad']` after `a`
  - **`battlePlan(ship, rand, solids, [a, b]) → { at, one, two } | null`**: two fights `BATTLE.apart` either side of a point ahead along the nose. `one` is `a`'s `skirmish.faction` on `b`'s `skirmish.civil` with `b`'s escort; `two` is `b`'s on `a`'s.
  - **`battlePick(hits) → null | 'one' | 'two'`**: after `BATTLE.pick` of your hits on one fight's attackers, you're with the side they attack
  - **`DERELICT = { wake: 3, range: 700, fire: [1.6, 2.6], speed: 90, damage: 6, hp: 30, drones: 2, size: [60, 140] }`**
  - **`createDerelictGun({ at, size, rand }) → { at, size, hp, phase, step(dt, you) → shots, hit(n) → boolean }`**: `'waking'` for `wake` seconds, then `'awake'`, firing every `fire` seconds a shot `{ from, dir }` led onto you (`intercept`) when within `range`; down at 0 hp
  - **`derelictStandIn(ship, rand, solids) → { at, size }`**: 900 ahead along the nose, clear, for a forced one with no derelict near
- Produces:
  - `createFarPlay`'s `kinds` gains `'battle'`. A second `createSkirmishes(group, { fleet, solids })`, made the first time a battle comes, plays `two`; the scene's own plays `one`. Your hits on either fight's attackers count to `battlePick` (`EVENT.picked`); the side you picked winning its fight is `deed('helped')`. `EVENT.battle(a.label, b.label)` as it starts. Each fight is listed in `fights()`.
  - `createFightsPlay`'s `kinds` gains `'derelict'`. It wakes the nearest derelict zone within 4,000 (lane 2's lattice derelict, or 4a's), or a stand-in hulk (a `MeshStandardMaterial` box of kit parts, made when first wanted). Its lights come on (sprites, `hot()`), its guns fire bolts (`createBolts`, hurting you by `DERELICT.damage` on a hit), and it launches two of the side's pirates from it (`hunters.pack(..., { from })`). It's a target for your guns (`targets`, `hit`): down at 30, a burst and `deed('killPirate')`. `EVENT.derelict` as it wakes.

- [ ] **Step 1: Write the failing tests.**
  - `fights.test.js`: `battleSides` for each pair; `battlePlan`'s two fights are 320 apart, ahead along the nose and clear of a solid; `battlePick` with `{ one: 1, two: 0 }` is null and with `{ one: 2, two: 1 }` is `'one'`. A derelict gun is silent for 3 s, then fires a shot led onto a ship crossing at 30 within 700, none at 800; its fourth `hit(10)` downs it.
  - `playFar.test.js`: a battle starts both fights (the second `createSkirmishes` made once, on the first battle), and two hits on fight one's hunters pick `'one'`.
  - `playFights.test.js`: a derelict start with a derelict zone 2,000 off wakes that one; with none, a stand-in 900 ahead; your hit downs it after 30, with `deed('killPirate')` once.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/events`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement and wire.**
- [ ] **Step 4: Run them and see them pass.** Run `npm test`, then `node scripts/universe-endless-check.mjs --quality mid --only events --events battle,derelict`. Expected: PASS, two shots.
- [ ] **Step 5: Commit.** `git commit -m "Two sides fight and you pick one, and a derelict wakes and turns its guns on you"`

### Task 18: An ion storm front, a comet's close pass, and a tidal pull

**Files:**
- Create: `src/components/universe/events/sweeps.js`, `sweeps.test.js`, `src/components/universe/events/playSweeps.js`, `playSweeps.test.js`
- Modify: `src/components/universe/setpieces.js:434-444` (`comet(ship, { pass })`: a close path when given, today's crossing without), `src/components/universe/meteors.js:61-110` (`storm(ship, rand, solids, { lane, look })`: `look: 'ice'` a pale ice material, today's rock without)
- Modify `scene.js`, at the Maw's pull (`:4418-4422`):
  - after `const g = pullAt(stepped.x, stepped.y, stepped.z);`, `const tide = g ? null : events.pull(stepped);` (+1)
  - `const ship = g ? { …g.v… } : stepped;` takes `g ?? tide` for its `v` (0), and `state.pull` is `g?.k ?? tide?.k ?? 0` (0: it turns the camera, `:3590`, for k in 0..1)
  - the `if (g) { … }` block (`:4467-4483`: the Maw's `'pulled'` line, its hum `well.set(g.k)`, the shake `(g.k − 0.2) × 0.55`, the capture) stays the Maw's own, reading `g` alone. The tidal has its own note (`EVENT.tidal`), a lighter shake (`0.3 × k`, from its player) and no capture.

**Interfaces:**
- Consumes: Task 5's `noseFrame`; Task 2's black-hole zones; `hurt`, `state.static`, `state.flare`, `state.shake`; `kit.js`'s `paint`; a smoothstep of its own, `smooth(a, b, v)` (`maw.js:50` keeps its one local); `MAW`, `pullAt` (in the tests).
- Produces, in `sweeps.js`:
  - **`STORM = { width: 3000, depth: 240, speed: [25, 45], ahead: 900, drain: 6, static: 1.2 }`**
  - **`stormFront(ship, rand) → { at, n, side, speed, width, depth }`**: its middle `ahead` along the nose, sweeping across your path (`n` perpendicular to the nose, within 30° of `noseFrame`'s right)
  - **`stormAt(front, s) → [x, y, z]`**, **`inStorm(front, s, p) → boolean`**, **`stormPast(front, s, p) → boolean`** (gone past `p` by twice its depth)
  - **`COMETPASS = { pass: [40, 90], speed: [30, 50], life: 30, shards: 36, damage: 4 }`**
  - **`cometPass(ship, rand, solids) → { from, vel, closest, life } | null`**: its closest approach `pass` off your path, a few seconds ahead
  - **`iceLane(pass) → [from, to]`**: the shower's lane, along the comet's path through its closest point
  - **`TIDAL = { range: 6, pull: 6, debris: 24 }`**: `pull` in map units a second at its strongest, under the boost's 12 and over cruise's 3.3, so throttling up gets you out, as the note says
  - **`tidalPull(hole, p) → { v: [vx, vy, vz], k } | null`**, shaped as `pullAt`'s answer: `k = min(1, (1.5 × reach / d)²) × smooth(reach, 1.5 × reach, d)`, in 0..1, and `v` toward the hole at `TIDAL.pull × k`. Null at or inside the hole's `reach` (the Maw's own pull, `pullAt`, rules there, and the tidal is 0 where the Maw's starts) and past `range × reach`.
  - **`holeFor(zones, p) → Zone | null`**: the nearest black hole within `range` of its reaches
- Produces: **`createSweepsPlay(deps) → Player`** with `kinds: ['stormfront', 'cometpass', 'tidal']` and `pull(ship)`:
  - **Storm front:** one large `Mesh` (a thin box `width × depth`) of an additive `MeshBasicMaterial` wearing a streaked texture painted by `kit.js`'s `paint`, its `offset` scrolled (no shader), with brief flashes. Inside it, the shields drain `drain` a second (`hurt`, past the scene's shield regen) and the HUD scrambles (`state.static`); `EVENT.storm` the first time you're in it.
  - **Comet fly-by:** `pieces.comet(ship, { pass })`, then the ice shower, `meteors.storm(ship, rand, solids, { lane: iceLane(pass), look: 'ice' })`, its shards hitting as rocks do.
  - **Tidal pull:** near a black hole (the Maw, or 4a's), for its `lasts`, `pull(ship)` gives `tidalPull(hole, ship)`, and the player's `update` shakes the ship by `0.3 × k`. The meteors' rocks are dragged in along lanes ending in it, and a traffic group is pulled in, shrinking as a docking one does (`dock: 'in'`). `EVENT.tidal`. Forced far from any black hole: a note and false (the check teleports beside one first: `spotFor('tidal')`, 4a's hole when one is loaded, else the Maw).

- [ ] **Step 1: Write the failing tests.** `sweeps.test.js`:
  - a storm front starts 900 ahead along the nose; a ship flying on at cruise is inside it for `depth / speed` seconds or so, then `stormPast`
  - `inStorm` is false past `width / 2` to the side
  - a comet pass's closest point is 40 to 90 off a level ship's path and ahead; `iceLane` passes within 1 of it
  - `tidalPull` points at the hole; its `k` is in 0..1 everywhere and its speed never over `TIDAL.pull` (under `SHIP.boost`); `k` at `3 × reach` is a quarter of `k` at `1.5 × reach`; it is under 0.01 at `1.01 × reach`, null at `0.9 × reach` and null past `6 × reach`; at the Maw, where `pullAt` gives non-null (inside `MAW.reach`) `tidalPull` gives null, so the two never add
  - `holeFor` finds the Maw from 3 of its reaches off and not from 7

  `playSweeps.test.js`, with fakes and `document` stubbed as in Task 14: inside the storm's slab for 1 s, `hurt` gets about 6; a comet pass calls `pieces.comet` with a `pass` and `meteors.storm` with `look: 'ice'`; a tidal start at the Maw gives a `pull` with `k` in 0..1 for a ship 3 reaches off and null for one inside `MAW.reach`, and a forced one 100,000 away returns false with nothing registered. The storm's mesh is invisible before a start.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/events/sweeps.test.js src/components/universe/events/playSweeps.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement and wire.**
- [ ] **Step 4: Run them and see them pass.** Run `npm test`, then `node scripts/universe-endless-check.mjs --quality mid --only events --events stormfront,cometpass,tidal`. Expected: PASS, three shots.
- [ ] **Step 5: Commit.** `git commit -m "An ion storm front sweeps across your path, a comet passes close in a shower of ice, and a black hole's pull takes what's near"`

### Task 19: A leviathan migration, and a bloom of glowing things

**Files:**
- Create: `src/components/universe/events/herds.js`, `herds.test.js`, `src/components/universe/events/playHerds.js`, `playHerds.test.js`
- Modify: `src/components/universe/leviathans.js` (`:59-97`: the purrgil's parts move to a module-level table both its pod and a new `purrgilBody()` read), `src/components/universe/leviathans.test.js` (a new `it`)

**Interfaces:**
- Consumes: Task 5's `noseFrame`; `kit.js`'s `parts(list)` (merges geometries, each with its position, rotation and scale).
- Produces, in `leviathans.js`:
  - **`PURRGIL`**: the parts the pod builds a purrgil from today (`:60-97`): body, belly, head, tail, flukes, four tentacles and two eyes, each `{ geo: (seg) → BufferGeometry, mat: 'back' | 'belly' | 'eye', at, rot, scale }`. The pod's `purrgil()` builds its `Group` from it as today: eleven meshes in three materials, the tentacles and flukes still moving.
  - **`purrgilBody({ small = false } = {}) → { back: BufferGeometry, belly: BufferGeometry, colours: { back: '#4a3f8a', belly: '#b9b4d8' } }`**: today nothing is merged, so this is new work. `parts` merges the `'back'` parts (body, head, tail, flukes) into one geometry and the `'belly'` parts (the belly and the four tentacles, still) into another, and the two eyes are dropped (0.022 of its length: at most two or three pixels at the herd's nearest, `MIGRATION`'s 8 lengths off, and not worth a third draw call).
- Produces, in `herds.js`:
  - **`MIGRATION = { n: [10, 18], scale: [300, 1200], far: [8, 14], span: 2.5, cross: [45, 70], angle: 3, clear: 2 }`**. Spec C's migration is "a herd crossing, gargantuan-sized", and a gargantuan is 20 to 200 planets across (4a's `PLANET_SIZE`, 54). So each member is 300 to 1,200 units long (a purrgil scaled up: `purrgilBody()` is one unit long), the herd's wedge a few thousand across; `far` is how far off its closest pass is, as a multiple of `scale` (8 to 14, so 2,400 to 16,800), which keeps the lead at least `angle` (3°) across at its nearest (`atan(1 / 14)` is 4.1°); `span` is the crossing's length as a multiple of `far`; `cross` the seconds it takes; and every point of it stays inside the camera's far plane (45,000, `scene.js:501`).
  - **`migrationPath(ship, rand, solids = []) → { from, to, n, scale, speed, seed } | null`**: a straight crossing in 3D, `scale × far` off the nose's line at its closest, `span × far` long, across your view, at `span × far / cross` a second; clear of every solid by `r + clear × scale`, from eight tries round the nose, else null
  - **`herdAt(path, s, i, out) → out`**: member `i`, `s` seconds on, in a loose wedge behind the lead (members `1.5 × scale` apart) with a slow bob; **`herdPast(path, s) → boolean`**
  - **`BLOOM = { n: [40, 90], spread: 160, ahead: [140, 280], drift: 0.6, life: 60 }`**
  - **`bloomPlan(ship, rand, solids) → { at, n, seed } | null`**, **`jellyAt(plan, i, s, out) → out`**: round its middle, each with its own slow drift and pulse
- Produces: **`createHerdsPlay(deps) → Player`** with `kinds: ['migration', 'bloom']`:
  - **Migration:** two `InstancedMesh`es, `purrgilBody()`'s `back` and `belly` in `MeshStandardMaterial`s of its two colours, sharing the instance matrices: at most 18 instances, each 300 to 1,200 long (`MIGRATION`), the universe's wildlife whoever you fly with. Two draw calls while it crosses, none at rest. `EVENT.migration`. Forced with no clear path (`migrationPath` null), a note and false.
  - **Bloom:** one `InstancedMesh` of a small dome (`SphereGeometry`'s top half) in an additive `MeshBasicMaterial`, `hot()` cyan to violet, pulsing by scale; half as many on `small`. The director weights it twice inside a nebula zone (Task 3's `NEAR_TILT`, by Task 2's `'nebula'` in `near`). `EVENT.bloom`.
  - Both invisible at rest, made when first wanted, given to `prepare` once.

- [ ] **Step 1: Write the failing tests.** `herds.test.js`, over 200 seeded level and pitched ships: a migration path's nearest point to the ship is 8 to 14 times its `scale` off, and `scale` is 300 to 1,200; the lead subtends at least `MIGRATION.angle` (3°) there (`2 × atan(scale / 2 / nearest)` in degrees); every point of the path is within 45,000 of the ship; with a solid of radius 2,000 on the first try's line, the path clears it by `r + 2 × scale` or is null; every member stays within `5 × scale` of the lead's line; `herdPast` holds once the lead is beyond the far end; a bloom's jellies stay within `spread` of its middle for 60 s and never inside a solid passed. `playHerds.test.js`: a migration makes exactly two meshes, both `InstancedMesh`es on `purrgilBody()`'s two geometries, each showing `n` instances, then none and invisible once past; `small` halves the bloom's count; nothing is visible before a start; `clear()` hides both.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/events/herds.test.js src/components/universe/events/playHerds.test.js src/components/universe/leviathans.test.js`. Expected: the new tests FAIL; `leviathans.test.js`'s existing tests pass. Its new `it`: `purrgilBody()` gives two geometries whose merged bounds match the pod purrgil's meshes less its eyes, and a pod purrgil from `createLeviathans` still has eleven meshes in three materials.
- [ ] **Step 3: Implement and wire.**
- [ ] **Step 4: Run them and see them pass.** Run `npm test`, then `node scripts/universe-endless-check.mjs --quality mid --only events --events migration,bloom`. Expected: PASS, two shots.
- [ ] **Step 5: Commit.** `git commit -m "A herd of leviathans migrates across the sky, and a bloom of glowing things drifts by"`

### Task 20: Every event forced, the gentle minute, the full measure, and the hand-off notes

**Files:**
- Modify: `scripts/universe-endless-check.mjs` (the `arrival` step; the `events` step with no `--events` runs every kind), `docs/superpowers/evidence/endless-universe-lane-4b/README.md`
- Create: `docs/superpowers/evidence/endless-universe-lane-4b/HANDOFF-NOTES.md`

**Interfaces:**
- Consumes: everything above.
- Produces: the lane's numbers and the hand-off.

- [ ] **Step 1: Pin the count.** In `sceneEvents.test.js`, a new `it`: `events.debug.kinds()` (all players in) is the 30 ids of `EVENTS`, each played by exactly one player.
- [ ] **Step 2: Add the `arrival` step.** Reload with no start link and no saved place (a fresh context): wait until the ship flies, then until the director's first event of the visit (`events.debug.running()` or the director's last) by the scene's clock; it must come before 60 s of that clock and be gentle and not big. It gives up, failing, at 60 s of the scene's clock or 20 minutes of the wall's, whichever comes first: the first pick comes 20 to 40 s in (`ARRIVAL.first`), which is 400 to 800 frames at `MAX_DT`, and 20 minutes holds the whole 60 s window at one frame a second, the slowest software GL draws here. It prints both clocks when it ends. Shoot it, `arrival.jpg`. It is the step's one long wait, and it runs only in Step 3.
- [ ] **Step 3: The sweep, whole.** Run `node scripts/universe-endless-check.mjs --quality mid` and then `--quality low`: every step of lanes 2, 3, 4a and this lane, with `events` forcing all 30 kinds. The check flies one crew (lane 2's script's, Assumption 17) and never switches ship; each kind is forced at Task 10's `spotFor` with its `side`, so the count is the same whichever crew flies:

  | crew | kinds forced | of them out in generated space | at a hand-made place | shots |
  |---|---|---|---|---|
  | the check's own (the Falcon), `council` as the Rick and Morty side and `trader` as the Star Wars side | 30 | 28, or 29 when a 4a black hole is loaded for `tidal` | `remover` (beside a hand-made planet), and `tidal` at the Maw when no 4a hole is loaded | 30 and the arrival's: 31 |

  Expected: exit 0 both times, 31 shots, no console errors, and on `low` never more than one event in `running()` at a time (the step clears and waits for an empty registry before each kind, so the one is the kind it forced). Copy the per-step table, with each kind's `out`, into the README. (Three different events in ten minutes is Task 4's pure flight, on `low`'s budget: the scene's clock moves at most 0.05 s a frame (`runtime.js`'s `MAX_DT`) and software GL draws one or two frames a second here, so ten minutes of it in a browser would take hours.)
- [ ] **Step 4: The full measure, once.** Run these in the background, each with `CHROMIUM=/opt/pw-browsers/chromium` in front, and wait on their exits:
  - `node scripts/universe-check.mjs --quality high --out lab/universe/after-4b/high`, then the same for `mid` and `low` (three runs: `universe-check.mjs` ignores `--out` when more than one tier runs, `:53`)
  - the endless poses, once a tier: first keep the committed baselines, `git show HEAD:lab/universe/endless/<tier>.json > lab/universe/before-4b/endless-baseline-<tier>.json` (lanes 3 and 4a's, all six poses), then `--quality <tier> --poses old-rim,above-core,expanse-system,expanse-station,at-gargantuan,in-field --out lab/universe/endless/<tier>`, all six in one run: `universe-check.mjs:246` writes `${out}.json` with only the poses it measured, so a shorter list would drop 4a's `at-gargantuan` and `in-field` from the baseline
  - `QUALITY=mid node scripts/perf-probe.mjs universe` and `QUALITY=low …`, against Task 9's before

  Expected:
  - **Draw calls and triangles:** at every pose in `lab/universe/baseline/<tier>.json`, and at each of the six endless poses against `before-4b/endless-baseline-<tier>.json`, no higher. Where they come from, named in the README:
    - no event draws at a held pose (`events.clear()` in `holdPose`, and every event mesh invisible at rest)
    - no far fight out draws at a held pose or in the core (Task 13: `fightsAround` gives none while held or in the core), so `farFights`' `Points` at a pose are today's skirmish and front only, as in the baseline
    - traffic is the one thing of this lane's a held pose can show: if `expanse-system`, `expanse-station` or `in-field` rises, it's port-lane groups flying the system's stations and 4a's rigs where today's crossed the open. Name the number, and hold port-lane groups within the pose's old count if it's over.
  - **Frame time:** p50 no worse than 2 %.
  - **Pixels:** `scripts/pixel-measure.mjs` against `before-4b/mid` gives identical shots at the hand-made poses.
- [ ] **Step 5: The repo's checks.** Start the dev server, then run `CHROME=/opt/pw-browsers/chromium node scripts/events-check.mjs rv` and `… falcon`, `flare-check.mjs xwing`, `universe-npc-check.mjs`, `navmap-check.mjs`, `flyto-check.mjs --fake` and `links-check.mjs`; stop the server; run `CHROMIUM=/opt/pw-browsers/chromium node scripts/autopilot-check.mjs --only smoke --skip lint,test,build --routes /universe`. Expected: each as before Task 9 (events-check's two software-GL timeouts are `main`'s). The checks that call `__universeDebug.director.soon(…)` reach Task 10's `debug.soon`, which starts the event on the next frame whatever the arrival's minute and the budget say, and `director.intensity` still reads the director's.
- [ ] **Step 6: Write the README and the hand-off notes.**
  - **README:** before and after side by side; calls and triangles per pose and tier; frame times; the life step's five times to something moving; `scene.js`'s count at each task; `glsl-sites`, `big-files`, `boundary-breaks` and `cycles` before and after.
  - **`HANDOFF-NOTES.md`, "Landed":** every module above by path with its interface in a line; the 30 events and which player plays each; the `life`, `fights`, `events` (and its `--events` flag) and `arrival` steps. And lane 4a's seams, each used once: 4a's beacons go through `events.follow(row, lead)` (Task 14: a distress lead plays a stranded ship at the beacon, a treasure lead the cache); a trapped derelict's lead is `events.happen(id, ship, { force: true })` (Task 10) and leads to `'derelict'` now that it exists; the wormhole event throws by 4a's `wormholeExit` and `throwTo` and marks `where().cameFrom` through `things.setCameFrom` (Task 15).
  - **`HANDOFF-NOTES.md`, "Left":**
    - Lane 4c calls `events.arrive()` from its arrival (and may drop Task 10's spawn line).
    - Lane 6b draws `where().events`, `where().farFights`' heights, `where().holder`, and 4a's `where().cameFrom`, which the wormhole event sets too, in 4a's shape.
    - Forced starts that pass "never two big ones together" on purpose: the dev hook, a check's `soon` and `markJump`, a thing's trap and a beacon followed (Findings 18).
    - The check's `side` override on `happen` and `soon`, and `spotFor`'s table: any later event bound to a side or a place adds its row there.
    - The remover at generated planets (finding 4).
    - Any finding from the measure.
- [ ] **Step 7: Run the gates and commit.** Run `npm run lint`, `npm test`, `npm run build` and `node scripts/health.mjs --check --skip build`. Expected: all green, within budget. Then `git add -A lab/universe/after-4b lab/universe/before-4b lab/universe/endless docs/superpowers/evidence/endless-universe-lane-4b scripts/universe-endless-check.mjs src/components/universe/events && git commit -m "Lane 4b measured at every tier, every event forced and shot, and its hand-off notes"`

---

## What later lanes consume

| Name | From | Used by |
|---|---|---|
| `events.arrive()` (the director's `arrive(seconds = 60)`), `ARRIVAL`, `director.arriving`, the `gentle` column | `events/sceneEvents.js`, `director.js` | 4c (the arrival's gentle minute) |
| `director.refused(id)`, `RETRY`, `director.noted(id)`, `director.allows(id, …)` | `director.js` | any later caller that starts an event the director picked |
| `budget.events` stepped with `traffic` (never below 1) | lane 2's `universe/budget.js` | anyone reading the events cap by step |
| `where().events` (`[{ id, kind, name, x, y, z, big }]`, `name` from `EVENT.name`), `where().holder` (`{ id, name, side }`), `where().farFights` with `y` and `Fighting near <system>`; and 4a's `where().cameFrom` (`{ id, name, at, key }`), which the wormhole event sets through `things.setCameFrom` | `scene.js`'s `where()` | 6b (events in progress, whose space, the wormhole's mark, fights in 3D) |
| `holderOf`, `createHere`, `HOLDERS`, `HERE`; `sideAt(crew, sector, holder)`, `crewAt(…, holder)`, `lawAt(crew, holder)` | `events/holder.js`, `sides.js` | 4c (whose space the arrival is in), 6b (the chart's holder) |
| `zonesAround`, `systemAt`, `nearestOf`, `whereFor`, `WHAT_OF`, `EXTRA_WHAT`, `Zone` | `events/zones.js` | 4a (a new kind gets a `WHAT_OF` row), 6b |
| `trafficHere`, `LIFE`, `PORTS`; `portLane`, `PORT_NEAR`, `noseFrame` | `events/life.js`, `lanes.js` | 4c (traffic crossing the arrival), 4a (a new port kind) |
| `fightOf`, `fightsAround(systems, cam, t, { max, far, held, core })` (none held or in the core), `fightNode`, `FIGHTS_OUT`; `fightLabel(at, near)` | `events/fightsOut.js`, `farFights.js` | 6b |
| `events.follow(row, lead) → boolean`, `FOLLOW`, `besideBeacon` (4a's `follow` dep on `createThings`) | `sceneEvents.js`, `signals.js` | 4a's beacons, already wired (Task 14) |
| `events.happen(id, ship, { force, hold, at, side })` (forced: at once; forced and held: past the zone and the calm, but after the arrival, a big one and a full budget; `side`: a check's side, `SIDES[side]` in `ctx`), `events.riftExit(ship) → { park, exit } \| null`, `events.spot(ship)`, `events.fights()` | `sceneEvents.js` | 4c (an arrival's own events), 5b, 6b, any later caller that starts an event |
| `tiltOf(id, { hazard, near })`, `HAZARD_TILT`, `NEAR_TILT`; `update(dt, { …, big, hazard, near })` | `director.js` | any later place that should tilt what comes (a new `near` or hazard row) |
| `wormholeFrom(universe, ship, n)` (what 4a's `wormholeExit` takes for an event's wormhole), `sectorsApart(a, b)` | `signals.js` | anything else that opens a wormhole |
| `waylayPark(from, park, rand, { bodies, outs, key })`, `bodiesOf(sector, t, at, near)`, `WAYLAY` | `events/fights.js` | 4c and 5b (setting a ship down near a generated place without building a sector) |
| `places.sector(key)` (the loaded or fetched sector, nothing made) | lane 3's `places/scenePlaces.js` | 5b, 6b |
| `events.debug` (`kinds`, `running`, `here` (`{ system, holder, core }`), `life`, `zones`, `spotFor(kind) → { x, y, z, heading, side, out }`, `clear`, `markJump` (a check's force: the next jump, if `canWaylay` allows it), `soon(id, { side })`, `director`), `__universeDebug.happen(kind, { side, … })`, `__universeDebug.director.soon(kind)` and `__universe().soon(kind)` (both start it on the next frame) | `sceneEvents.js` | every later lane's checks |
| the `Player` contract (with `update → moving`, `drop(id)`), and `events.clear()` at every place that ends what's going on | Global Constraints, Task 10 | any later event; any later code that moves the ship away at once (5b's landing, 4c's arrival) calls `events.clear()` beside its `hunters?.clear()` |
| `PURRGIL`, `purrgilBody({ small })`; `MIGRATION`, `migrationPath(ship, rand, solids)` (a gargantuan-sized herd, 300 to 1,200 a member) | `leviathans.js`, `events/herds.js` | 4a (a leviathan-migration gargantuan, if it draws purrgil) |
| `readPack(data, from)`, `PACK_NEAR` | `online/protocol.js` | 6b (other pilots' hunters on the chart) |
| the `life`, `fights`, `events` (with `--events a,b`) and `arrival` steps | `scripts/universe-endless-check.mjs` | every later lane |

## Assumptions about unmerged work

Each of these can be checked once lanes 2, 3 and 4a have merged.

1. Lane 2's sector shape is as its plan's Task 6 gives it: `systems` (with `reach`, `faction`, `traffic`, `hazard`, `seed`, `name`), `things` (`count`, `kind` indexing `THING_KINDS`, `at` from `origin`, `size`), `extras` keyed by list, `origin`. `expanse.sectors()` is a `Map` of the loaded 27 (its Task 20).
2. Lane 2's `universeBudget({ tier, detail }, step, floor)` has `traffic` (2, 4, 6, 8) and `events` (1, 2, 3, 3), and `discs`, `thingsNear` and `traffic` are the fields the steps multiply (its Task 12), with lane 3's `tags` beside them. `events` isn't stepped there; Task 10 adds it to that list. On `eu/lane-2` today (`058a3d17`, PR 2.3) `budget.js` doesn't exist yet.
3. Lane 2's `expanse.stars()` holds lighting's `STARS` and the built stars, each `{ id, at, r, colour, strength, reach }`, and `scene.js` passes it to `lightAt` (its Task 17), so `litBy.key.id` can name a generated star.
4. Lane 2's `__universeDebug.teleport(x, y, z, heading, pitch)` and the endless check's recorder and `--only` exist (its Task 22; lane 3 adds `--only`).
5. Lane 3's face `expanse/shared/space.js` lends exactly the names its plan's Task 1 lists (`UNIVERSE`, `universeOf`, `fullSector`, `orbitAt`, `systemReach`, `THING_KINDS`, `SECTOR_EXTRAS`, `stationsOf` and the rest), and `shared.test.js` pins that list. It lends none of `rngOf`, `hash64` (`gen/seed.js`) or `clearOfKeepOuts` (`gen/keepOuts.js`); Task 4 adds the three, re-exports and list together. `sectorCentre` and `sectorKey` come from `lib/space/address.js`, not the face.
6. Lane 3's `fullSector(…).stations` rows are `{ id, i, system, at, size, name }` (its Task 1), `places.docked()`, `places.park(id, from)` and `places.solids()` exist (its Task 12), and `solidsNow` includes `places.solids()` and `expanse.solids()`.
7. Lane 3's `trips.outOfJump(j) → park` sets `state.arrived = { id: j.id }`, and the scene's jump arrival reads `const park = outOfJump(j);` in place of the six pilot lines only (its Task 11), so the rest of the block stays as on `main` (`:4357-4366`): `arriveAt(park)`, the clears, `state.interdicted = false`, `crashFx.arrive(…)` and `emit({ type: 'jumped', id: j.id })` last. Lane 3's dock reads `state.arrived` in `render()` (`places.update({ …, arrived: state.arrived })`), after the frame's `adventure`, so `afterJump` nulling it in the same frame keeps the dock shut. Task 16 wraps the first call and replaces the `emit`.
7a. Lane 3's `places/ids.js` exports `isPlaceId(id)`, true for a generated place's id in any spelling (its Task 3). Task 16's `canWaylay` uses it.
8. Lane 3's dock opens the Hangar on its shipyard tab when an `arrived` object names the station (its Tasks 12 and 14). The trader relies on it.
9. Lane 4a's things that this lane reads (derelicts, black-hole gargantuans, beacons, rigs, shipyards, fleets) are rows of `THING_KINDS` or `SECTOR_EXTRAS` with a `kind` name, as lane 2's hook says. If 4a draws a kind through `drawers` only, with no row, Task 2's test can't see it, and that's a finding for the coordinator.
10. Neither lane 2 nor lane 3 nor 4a changes `director.js`, `traffic.js`, `hunters.js` or `farFights.js` (lane 2's and lane 3's plans both list them as not touched; 4a's lists them as 4b's). But 4a does call into what this lane rewires: its `createThings` deps in `scene.js` are `happen: (id) => happen(id, state.ship)` and `soon: (id) => director?.soon(id)` (its Task 24), both names Task 10 removes, so Task 10 rewires them to `events.happen(id, state.ship, { force: true })` and `events.director.soon(id)`. And its `things/rules.test.js` pins `leadEvent('trap', EVENTS)` as `'hunt'` and `leadEvent('treasure', EVENTS)` as null until this lane's rows exist (Task 3 replaces both).
11. Lane 2's PR 2.2 is on `main`: `readPose` clamps heights to `±SEC_FAR`, and nothing else in `online/` clamps a hunter's height but `readPack` (`:335`). Checked at `cc5e2eaf`.
12. `scene.js`'s blocks this lane moves (`happen` at `:3427-3561`, the escort and eclipse at `:1100-1119` and `:3933-3979`, the director at `:3984-3994`, the far fights at `:3754-3814`) aren't moved by lanes 2, 3 or 4a. Lane 3 moves the travel block (`:1769-1905`) and nothing of these. Five of the six `dropEscort(); dropEclipse();` pairs (`:2143`, `:3097`, `:3140`, `:4358`, `:5872`) are where they are on `main`; lane 3 edits lines beside some (`state.auto = state.arrived = state.pending = null;`) but not the pairs. The sixth, the rift's (`:4221`), is in 4a's `throwTo(park, opts)`, its split of `riftThrough`'s body after `const park = …` (its Task 24), which its wormhole things call too; `riftThrough`'s first lines (`const s`, `const exit`, `const park`) stay in `riftThrough`, where Task 11 edits them. 4a's `createThings(…)` line carries the `happen`, `soon` and (from Task 14) `follow` deps Tasks 10 and 14 edit.
13. Lane 3's `state.spaceT` is the shared clock in seconds (lane 2's `spaceTime(ms) = ms / 1000`), 0 while held or with reduced motion. Far fights read it, so without care a held pose's out-fights would be those on at `t = 0`; Task 13 shows none while held, so a pose never depends on it.
14. Lane 4a's seams are as its plan gives them (Tasks 9, 23 and 24): `wormholeExit({ seed, sector }, universe) → { sector, key, at, heading, side }` on the face; `things.setCameFrom({ id, name, at, key })` and `things.cameFrom()`, the one `where().cameFrom`; an optional `follow(row, lead)` dep on `createThings` that its beacon `act()` calls with the row and `leadEvent(traitsOf(row).leads, events)`, skipping `soon` when it returns true; `throwTo(park, opts)` in `scene.js`; `LEADS = { trap: ['derelict', 'hunt'], distress: ['distress', 'escort'], treasure: ['treasure'] }`; `solidOf`, `gargantuanKeeps` and `thingRow` on the face; each sector's `extras.gargantuan`.
15. Lane 3 only sets off on a jump to an `E:` id once its sector is at hand (loaded, or among the last four fetched: its Task 12's `fetch`, `missing` and `resolve`), and keeps a fetched sector after the jump begins. Task 16 adds `places.sector(key)` to read it; a jump whose sector isn't there is never waylaid.
16. `__universeDebug.director` is read by `events-check.mjs` and `flare-check.mjs` (`.soon`) and `universe-npc-check.mjs` (`.intensity`), and by nothing else in `scripts/` (checked at `cc5e2eaf` with `grep -rn "director\." scripts`). Task 10's `debug.director` keeps both.
17. Lane 2's `universe-endless-check.mjs` (its Task 22, not yet written on `eu/lane-2` at `058a3d17`) loads `#/universe` with no start link and picks its crew as `universe-check.mjs:158` does (`tp-universe-ship` set to `"falcon"`, the Star Wars side). So every visit it makes starts the arrival's gentle minute (Task 10's spawn line), which is why `markJump` and `soon` are checks' forces. If it flies another crew, nothing in this plan changes: the events step's side-bound kinds take their side from `spotFor`.
18. Lane 4a's rig, shipyard and fleet rows carry the id of their system in a `system` field (its plan's Task 5: `{ kind: 'rig', name, at: field.at, size, field, system, seed }`; Task 7's shipyard the same), and its rigs are each sector's `extras.rig` list. Task 2 copies `system` onto the zone and Task 6 matches ports by it.
19. Lane 2's `expanse.nearestSystem(at) → { system, sector, dist } | null` and `expanse.loaded()` (the keys of the loaded sectors) are as its plan's Task 20 gives them; the events step waits on `loaded()` after each teleport, as lane 2's own `boundary` step does.
20. Lane 4a's poses `at-gargantuan` and `in-field` are in `poses.js` and `universe-check.mjs`'s list (its Task 25), and `lab/universe/endless/<tier>.json` holds all six endless poses when this lane starts.

## Findings for the coordinator (spec against code)

1. **Three of the spec's "new" events exist already.** The director has a `distress` (someone crossing your bows with pirates on them), a `comet` (crossing the sky well away) and a `supernova` whose shell already spreads over the better part of a minute (`supernova.js:1-9`). This lane keeps all three and counts them among today's. The spec's distress call becomes `stranded` (a ship to reach, defend and be paid for), its comet fly-by becomes `cometpass` (a close pass with a shower of ice), and its supernova is today's one working out there. To keep thirteen new, the swap is a bloom of glowing things (catalogue 22's "drifting swarms and glowing jellyfish", as an event). The spec allows the swap and keeps the count: 30 kinds in all.
2. **"The convoy spawns nothing of its own"** (HANDOFF-universe's "Left") is half true. `traffic.convoy` (`traffic.js:529-540`) already flies a column with escorts, but on a 100-unit lane past you, and only when `convoyLane` finds room, with no slot of its own when `MAX` groups fly. Task 11 gives it a port-to-port column and a slot of its own.
3. **No ceiling in the hunters.** Lane 2's finding pointed at `hunterRules.js:240`, which is a comment ("the lift near the ceiling"). No hunter, character or wingman clamps a height. What was flat was where they come from: `entryPoint` and every lane read only `heading`, so a ship climbing straight up met packs and traffic in the level plane. Task 5 makes them follow the 3D nose and pins the level case to today's numbers.
4. **The remover stays at the hand-made planets.** "Over the planet you're at" removes it for a minute. A generated planet would need lane 2's built system to hide and restore one planet, which it doesn't offer, and the spec doesn't list the remover among the events that must work out there.
5. **Whose law, out there.** The spec says hunters and the law read the system's faction. Today's law is always the crew's own (`scene.js:1016`). This lane makes it the holder's (`lawAt`): the Empire's in an Empire system, none in an independent one, and the crew's in a faction of its own (which has no ships of its own to send). `wanted.side` drops your stars when the side changes (`wanted.js:108-117`), so leaving a system for lawless space clears your stars and keeps your bounty, held per side. That is a design call, pinned with hysteresis so it can't flicker.
6. **A generated faction has no ships.** Factions of their own (`'<sector>:f<k>'`) have names but no hunter kinds, police or models. Their space flies the crew's side's ships and law, as today. Original craft for them would be a lane of its own (new props, the owner's rule).
7. **"Something moves within 20 seconds"** already holds in the open: today's traffic crosses the space round you within a couple of seconds of `nextAt = 1.5` (`traffic.js:168`, `:373`). Task 12's `life` step proves it at five places, by the scene's clock.
8. **The budget's `events` field isn't stepped** in lane 2's plan (`discs`, `thingsNear` and `traffic` are), though spec H says the quality steps lower "events at once" with the rest. Task 10 adds `events` to the stepped fields, rounded and never below 1, as lane 3 adds `tags`.
9. **`glsl-sites` has six left** (613 of 619) for lanes 1, 2, 4a and 4b together. This lane uses none: its looks are plain materials, the rift's mesh and the comet's.
10. **A waylaid jump and the jump's own way out.** On `main` (`scene.js:4352-4366`) the block that sets you down after a jump clears the hunters and the interdiction after the park is chosen, and ends by emitting `'jumped'`, which the page reads as a finished trip (`pages/Universe.jsx:375-390`: on through the Star Wars gate to `/galaxy`, the tour's next leg, `grandtour` on the last). A waylay packed where the park is chosen would be cleared at once, and a waylaid jump would still count as there. Task 16 packs the pirates after the clears, in place of the block's `emit`, returns `{ type: 'arrived', id, done: false }` for a waylaid jump, nulls lane 3's `state.arrived` (or a station's dock would open the Hangar), and only ever waylays a jump to a generated place, which leaves out pilots, portal legs, the gate and every tour leg.
11. **The law's bounty goes through `happen`** (`scene.js:1019`), and `bounty` is `zones: VOID`, `heat: 0.8` and big. With the director's rules between them it would be refused at any place and with shields under 50, where today it always comes. Forced outright, it could land on a running destroyer, stormfront, battle or derelict (the law sends it only while `!hunters.active`, `law.js:106`, which covers the hunts but not those), against spec C's "two big events never land on top of each other". So Task 10 forces it past the zone and the calm but holds it (`{ force: true, hold: true }`) through the arrival's minute, a running big event and a full budget, and starts it the first frame none of those holds.
12. **Nothing registered may outlive the place it was in.** Today every place that ends what's going on (the jump's way out, the rift, the ship change, the Maw, a crash, a held pose) drops the escort and the eclipse by hand, and `portalThrough` neither. The new events would stay registered after a jump 100,000 away, and on `low` (`budget.events` 1) one beacon left behind would hold the director for up to five minutes. Task 10 puts `events.clear()` at all seven and lets go of anything started more than 30,000 from where the ship now is.
13. **`noseOf` isn't `forward` to the last bit.** `rotate(fromAngles(h, 0, 0), NOSE)` differs from `forward(h)` in the last bits for 9 of the 12 headings `k × 0.52` (checked at `cc5e2eaf`). Task 5's level frame is written from `forward` alone, so today's lanes are reproduced exactly.
14. **`adventure`'s `busy` is the frame loop's, not the director's.** `let busy = pieces.update(…)` (`scene.js:3880`) and the escort's and the eclipse's `busy = true` keep frames coming; the director's hold is a separate expression (`:3989`). The `Player` contract keeps them apart: `update → moving` for the one, the `busy` getter for the other.
15. **Systems are about 19,000 apart** (276 to a 120,000 sector at `cc5e2eaf`), so most free flight is outside any system's reach + 5,200. "The nearest system's density and faction" is read literally there (Task 6), while whose law holds you keeps Task 1's hysteresis; so between an Empire system you've left and a Federation one ahead, Federation ships fly and the Empire's law still holds, and a Federation patrol reports nobody.
16. **The Rick and Morty pocket is no region.** `regionAt` is built from the main sector's places only (`regions.js:39`), so it's null inside the pocket, and the pocket's keep-out is its radius plus 4,000 (`keepOuts.js:30-32`), so generated systems sit just outside its wall. With `core: Boolean(regionAt(...))` alone, the last system's holder would follow you in and its law (the Empire's, say) would hold inside the Central Finite Curve, and `trafficHere` (which reads sector `'main'`) would fly that system's side there. Every `core` in this lane is `Boolean(regionAt(...at)) || mapSectorOf(...at) === 'rickmorty'` (Tasks 1, 4, 6 and 10).
17. **The browser checks force events through the director.** `events-check.mjs:38-92` and `flare-check.mjs:38` call `__universeDebug.director.soon(…)` on a visit with no start link. With Task 10's `events.arrive()` at every new pilot's spawn and Task 3's rule that a forced id waits out the arrival, each would wait 60 s of the scene's clock (about ten minutes of wall in software GL, past the checks' 30 to 90 s), and on `?quality=low` `soon('meteors')` would wait behind the flare's registry entry too. Task 10's `debug.soon` starts a check's event on the next frame through `happen(…, { force: true })`, and `__universeDebug.director` keeps `soon` and `intensity` for the three scripts that read it. The director's own `soon` (the siege's council, 4a's beacon fallback) keeps the arrival's rule.
18. **Five forced starts pass "never two big ones together" on purpose.** The dev hook (`__universeDebug.happen`), a check's `soon` and a check's `markJump` (the next jump waylaid, past the arrival's minute and the director, Task 16), a thing's trap (4a's trapped derelict, `events.happen(id, ship, { force: true })`) and a beacon followed (4a's beacon through `events.follow`, a stranded ship, big, Task 14) start at once even over a running big event, and on `low` over the one event `budget.events` allows. The first three are checks (spec C's "every event can be forced"); the last two are the player's own act at the thing, which would make no sense springing a minute later, perhaps after they've flown on. The director never does it, and the law's bounty waits (finding 11).
19. **Lane 4a's plan pins two assertions this lane's rows flip.** `things/rules.test.js` asserts `leadEvent('trap', EVENTS)` is `'hunt'` ("lane 4b's 'derelict' isn't there yet") and `leadEvent('treasure', EVENTS)` is null. Task 3 adds `derelict` and `treasure`, so it replaces them with `'derelict'` and `'treasure'`: a bound this lane removes, as Task 8's `x: 90000` is. 4a's `LEADS.distress` stays `['distress', 'escort']`; Task 14's `follow` turns a beacon's distress lead into a stranded ship at the beacon, so no second beacon rule exists.
20. **The waylay can't trust `solidsNow` far from the ship.** A jump can go any distance, and `solidsNow` holds only what's loaded round the ship before it arrives. Cut short by a share of the way (this plan's first rule), a long jump's waylay would land in unbuilt sectors, perhaps inside a star or one of 4a's gargantuans. Task 16 sets you down 1,500 to 6,000 short of the park, in the destination's own sector, clear of that sector's bodies read from its pure rows (`bodiesAt`, stations, `solidOf`, `gargantuanKeeps`) through a new `places.sector(key)` on lane 3's side, and of the keep-outs. Lane 3 has no getter for a loaded or fetched sector today; it's one line.
21. **`Running.name` had no source.** The registry's entries (and `where().events`, for lane 6b) carry a `name`, but no table gave one. Task 3 adds `EVENT.name`, one for each of the thirty ids, and its test pins that the two key sets match.
22. **The review's findings, checked.** Each was verified against the spec, `main` and 4a's plan. Two needed a small change of fix: `lib/ai/vec.js`'s `unit` takes `{ x, y, z }`, not arrays, so Task 5's `noseFrame` uses a local `norm3`; and 4a already offers both the `cameFrom` setter (`things.setCameFrom`) and the beacon hook (a `follow(row, lead)` dep), so Tasks 14 and 15 use those rather than a `cameFrom` fallback or a `happen(…, { at })` from 4a's side. `farFights.update` takes the camera, not `camLocal` (`farFights.js:200-207`); Task 7's citation is corrected (the front's update is the one that takes `camLocal`, `:3912`).
23. **The second review's findings, checked.** Each was verified against the spec, `main` (`cc5e2eaf`) and lanes 2, 3 and 4a's plans; all fourteen held, one with a correction:
    - **Not every side-bound kind is what it seemed.** The review said `leviathans.pass` gives null for Breaking Bad (`who?.leviathan`). It doesn't: every side has a leviathan (`sides.js:114` the purrgil, `:187` the Cromulon, `:253` the bear), and `pass` plays the bear (`leviathans.js:193-195`). The kinds a check can't force with any crew are the council (only the Rick and Morty side has a `council` faction, `sides.js:137`; `pick` gives null otherwise and `hunters.pack(null, …)` packs nothing, `hunterRules.js:708-709`) and the trader (only Star Wars and Breaking Bad have a merchant, `npcs/index.js:45,50`). The fix stands: Task 10's `happen` and `soon` take a check's `side`, and `spotFor` names it.
    - **The merchant never flies to a far station.** `NPC.station` is 120 (`npcs/brains/common.js:9`): further, a merchant parks where it is (`merchant.js:27-32`). Task 15 drops the `npcWorld.stations` getter and `stationRow`: the merchant parks beside you and offers, and the trip takes you to the station's shop.
    - **Out-fights at a held pose.** `farFights` draws one `Points` a visible slot of its pool of four (`farFights.js:37`), and `state.spaceT` is 0 at a held pose, so a generated system whose fight is on at t = 0 near a baseline pose would have added a draw call and changed the picture. Task 13 shows none held and none in the core.
    - **`hunts` is written outside `happen`** (`scene.js:3414`, `:3738`, `:5262`), so it stays in the scene behind two thunks; `eclipseSolid` (read at `:4918`) is on `play`, and `eclipseMoon` (disposed at `:6371-6372`) goes in `play.dispose()`.
    - **A herd crossing, gargantuan-sized**, at 20 to 40 units a member 2,500 to 6,000 off, would be a few pixels. `MIGRATION` is now 300 to 1,200 a member, 8 to 14 lengths off, pinned at 3° or more.
    - **The waylay's check couldn't run** in the arrival's minute that every check's load starts (Assumption 17); `markJump` is a check's force now, checked against `canWaylay` at the spool, since it can't know the next jump's target when it's called.
    - The rest were as the review said: the six endless poses (`universe-check.mjs:246` writes only the poses measured), the `life` step's condition, the rig ports (4a's rigs carry `system`), the tilt test's statistics, `NODES` from `waypoints.js:88`, the `riftThrough` order, the beacon's exception, the HUD's raw key, the bloom's tilt, and the pacing's far starts and the arrival's wall cap.

## Spec coverage

- **Section C, "Events: at least 15 kinds, everywhere":**
  - generated zones for the director: Tasks 2 and 10
  - the existing events working out there (flare, meteor stream, leviathans, minefield, escort, eclipse, rift, convoy with its own column, bounties): Task 11; far fights: Tasks 7 and 13
  - the new ones: Tasks 14–19 (finding 1 for the three that existed and the swap); the leviathan migration gargantuan-sized (Task 19's `MIGRATION`, 3° or more at its nearest)
- **Section C, "Event pacing":**
  - three different events in 10 minutes, from 100 seeded starts: Task 4, on `low`'s one event at a time, counting only what would really start where the flight is, a quarter of the starts far out round sector `[40, -7, 12]`
  - two big events never together: Tasks 3, 4 and 10 (the director's picks, and the law's bounty held behind a running big one); the dev hook, a check's `soon` and `markJump`, a thing's trap and a beacon followed are the named exceptions (Findings 18)
  - the arrival's first minute gentle: Task 3 (the rule), Task 10 (wired at a new pilot's spawn), Task 20 (in the browser); lane 4c calls it from its arrival
  - every event forced with `__universeDebug.happen(kind)`: Tasks 10, 11 and 20 (all 30 forced and shot, each at `spotFor`'s place and side, 28 or 29 of them out in generated space); the existing checks' `__universeDebug.director.soon(kind)` keeps working through the arrival's minute (Task 10's `debug.soon`)
- **Section B, "Places with life":**
  - traffic from the nearest system's density and faction, between its stations, rigs, shipyards and fleets: Tasks 6 and 12, between systems too (the nearer one's side, its density thinned by distance)
  - hunters and the law read the faction: Tasks 1, 10 (the holder, and nobody's inside the Rick and Morty pocket) and 13
  - far fights in generated sectors, in every direction: Tasks 7 and 13
- **Done item 2, "Something moves within 20 seconds of flying anywhere":** Task 12's `life` step, at five places, counting only a group spawned after the teleport within 3,000 of the ship, or an event or skirmish started after it.
- **Done item 3, events:** at least 15 kinds (30, Task 3); three different in 10 minutes (Task 4); every event forced by a dev hook (Task 20). The 20 kinds of thing are lane 4a's.
- **Done item 8, "a gentle event"** in the first minute: Task 3's rule and Task 10's hook; the arrival itself is lane 4c's.
- **Done item 9, "Nothing is lost":** every existing test untouched but the one bound Task 8 replaces and lane 4a's two "not there yet" assertions Task 3 replaces; every dev hook works as before (Task 10's `debug.director`, re-run by `events-check` and `flare-check` in Tasks 10 and 20); Task 9 pins `happen` before moving it; Task 5 pins every level lane; Task 20 reruns the repo's checks.
- **Section H, "events at once" lowered by the quality steps:** Task 10 (lane 2's `budget.js` steps `events`).
- **Done item 10, "Phones still fly":** the events cap by tier and step (Task 10), nothing left registered after a jump (Task 10), the pacing on `low` (Task 4), the traffic cap by tier and step (Task 12), every event mesh made when first wanted and invisible at rest, no new shader, and the low-tier measure (Task 20).
- **Lane 2's hand-on:** hunters' heights (Task 5, finding 3) and `readPack`'s ±90,000 (Task 8).

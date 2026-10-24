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
- **Wiring.** The scene's `happen` and its escort, eclipse, director and far-fight blocks move out of `scene.js` into `events/playExisting.js` and `events/sceneEvents.js`, so `scene.js` shrinks by about 240 lines over the lane. Every event, old and new, is played by a `Player` (one contract, below) and registered while it runs, so the director, the map (lane 6b) and the browser check all read one list.
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
- lane 3, both groups: `expanse/shared/space.js` (the generator's face), `fullSector(…).stations`, `places` (`scenePlaces.js`: `park`, `docked`, `here`), `trips.js` (`outOfJump`), `travel` on `E:` ids
- lane 4a: its rows in `THING_KINDS` and `SECTOR_EXTRAS` (derelicts, black holes, beacons, rigs, shipyards and fleets). Where a kind this lane reads isn't there, the seam is named in the task, and the event still plays (a stand-in) or says why it can't.

Line numbers are from `main` at `cc5e2eaf`. Lanes 2, 3 and 4a move them, so find the code again by the quoted text.

## Global Constraints

**Process (HANDOFF-universe's owner's rules and the index's Global Constraints, all of them):**
- Nothing a visitor can do is lost. Every key, save, route, dev hook and test works after as before, and no test is loosened.
  - `director.test.js`, `sides.test.js`, `crews.test.js`, `lanes.test.js`, `hunterRules.test.js`, `skirmish.test.js`, `farFights.test.js` and `nav.test.js` keep every existing `it`. New tests go in new `describe`s.
  - One existing assertion describes a bound the spec removes: `protocol.test.js:455-466`'s `x: 90000` (hunters clamped to the authored map). Task 8 replaces it with a test of what replaces it and says so in its commit. No other test changes.
- Pure first. `events/{holder,zones,life,fightsOut,signals,fights,sweeps,herds,lines}.js`, `director.js` and `lanes.js` import no React, no DOM and no three.js. Each has its Node test before its drawing half.
- A changed picture is on purpose. The before shots come first (Task 9), at `--quality mid`.
- Draw calls and triangles are no higher at any pose in `lab/universe/baseline/<tier>.json`, nor at the endless poses lane 3 left in `lab/universe/endless/<tier>.json`. Every event's mesh is invisible at rest, so a held pose draws none. Say the numbers.
- Before the lane is done: `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build` and `node scripts/autopilot-check.mjs --only smoke --skip lint,test,build --routes /universe`.
- Every commit is one plain sentence in the repo's voice. The body says why and gives the numbers, and ends with the attribution lines the session's harness gives (`.claude/skills/autopilot/SKILL.md`, "Commit"). This plan writes the first line only, with no model names.
- The hand-off goes in `docs/superpowers/evidence/endless-universe-lane-4b/HANDOFF-NOTES.md`, not in `HANDOFF-universe.md`, which the coordinator folds. Evidence goes in the same folder, each picture under 1 MB (element shots, or JPEG at 80).

**Code shape and the repo's budgets** (`docs/health/budgets.json`, measured at `cc5e2eaf`):
- `src/components/universe/scene.js` doesn't grow. Task 9 moves about 175 lines out and Task 13 about 60; Task 10 nets about −4, and Tasks 14–20 add at most 10 between them. Each task says the lines it moves out and adds, by `wc -l` before and after.
- New files stay under 800 lines. `hunterRules.js` is 1,406 lines: its edits here are net +40 at most, so it never crosses 1,500 (`big-files`, 22 of 30).
- `glsl-sites` is 613 of 619, shared with lanes 1 and 2. This lane adds no `ShaderMaterial`, `RawShaderMaterial` or `onBeforeCompile`. Its looks are `MeshBasicMaterial`, `MeshStandardMaterial`, `SpriteMaterial` and `InstancedMesh`es, with textures from `src/lib/three/canvasTexture.js`; the wormhole is the rift's own mesh and the comet the set piece's.
- `loops` is 58 of 58: no `requestAnimationFrame`. Everything runs in the scene's frame.
- `boundary-breaks` is 484 of 489 and `cycles` 5 of 5: the universe reaches the generator only through lane 3's face, `src/components/expanse/shared/space.js`. `director.js` imports nothing from `events/`.
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
- Lane 2's tier table: `traffic` groups 2, 4, 6, 8 and `events` at once 1, 2, 3, 3 (low to ultra), lowered by the quality steps.

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
- **Small edits elsewhere, each named in its task:** `sides.js` (`sideAt`, `crewAt`, `lawAt`), `nav.js` (`riftSpot`'s solids), `crews.js` (`linesFor` reads `EVENT_LINES`), `words.js` (`EVENT`), `src/lib/words.test.js` (scans `events/`), `poses.js`, `scripts/universe-endless-check.mjs`.
- **Not touched:** `NavMap.jsx`, `MiniMap.jsx`, `chart/*` (6a and 6b); `places/*` and `trips.js` (lane 3: read only); `expanse/*` (lane 2: read only); `universe/things/` and `universe/gargantuans/` (4a: read only); `entry.js`, `footScene.js`, `lib/land/*`, `expanse/flight/*` (5b); `ship.js`'s `startAt` (4c).

**Words and UI (`docs/health/RULES.md`, "UI"):**
- Every new on-screen word goes into `src/components/universe/words.js` first, as `EVENT`. The crews' lines go in `events/lines.js`.
- British spelling, sentence case, curly quotes, no Oxford comma, no retired word (`src/lib/words.js`'s `RETIRED`; mind "hyperdrive").
- No new NPC conversation: the trader is the existing merchant's own `offer` line; the crews' lines are comms, as every event has.

**The `Player` contract.** Every event, old and new, is played by one of these (Tasks 9, 10, 14–19):

```
Player = {
  kinds: string[],                            // the event ids it plays
  start(id, ship, ctx) → boolean,             // false: it couldn't (and nothing is left half made)
  update(dt, t, live, ctx),                   // live: the flying ship, or null
  running() → Running[],                      // what of it is going on now
  busy: boolean,                              // whether it holds the director
  targets?: Target[], hit?(from, to, punch) → hit | null,   // only if your guns can hit it
  pull?(ship) → { v, k } | null,              // only the tidal pull
  clear(), dispose(),
}
Running = { id: '<kind>:<n>', kind, name, at: [x, y, z], big }
ctx = { side, here: { system, holder }, zones, solids, force, rand, budget }
```

**Browser checks:**
- Headless Chromium draws in software here at a frame or two a second, and `universe-check` takes 2 to 4 minutes a pose and tier. A task's browser check runs at `--quality mid` only, on the steps or poses it changes. Task 20 runs the full all-tier measure once.
- Every browser command runs with `CHROME=/opt/pw-browsers/chromium CHROMIUM=/opt/pw-browsers/chromium` in front of it, as lane 3's plan found (`navmap-check` and `links-check` default to a Chrome this container lacks; `universe-check` and `autopilot-check` look for a Chromium path it doesn't have).
- `universe-check`, `universe-endless-check`, `autopilot-check` and `perf-probe` start their own server. `events-check.mjs` doesn't: start `npx vite --port 5173 --strictPort` in the background, wait until `curl --noproxy '*' -sf -o /dev/null http://localhost:5173/` succeeds in an until-loop (giving up after 60 s), run it, then stop the server.
- Every wait is on a condition, never a sleep. A wait for game time reads the scene's own clock (`__universeDebug.state.clock`), never the wall's.

## Review Focus

1. **A waylaid jump.** A jump cut short by pirates must never set you down inside a solid, never on a jump to a pilot or a portal leg, never in the arrival's first minute, and never leave the trip's arrival saying you got there: lane 3 opens the Hangar on an arrival at a station, and a waylaid jump to a station must not. Pinned in Task 16 (`waylayPark` clear of solids, null for a short jump; the play refuses a pilot or portal leg and sets `state.arrived` to null).
2. **The line between two holders.** Sitting on the edge of an Empire system next to a Federation one must not flicker whose space it is. Wanted stars must not reset every frame, traffic already flying must not vanish (a pop), and hunters already on you must stay. Pinned in Task 1 (hysteresis, 200 updates on the line, no flip), Task 12 (a group spawned under one holder flies on under the next) and Task 13 (the law's side changes once).
3. **An event forced where its thing isn't.** `happen('derelict')` in the void, `happen('trader')` with no station near, `happen('tidal')` far from any black hole, or any event with no ship. Each plays a stand-in where one makes sense (a derelict hulk, a beacon) or returns false with a note saying why, and never throws or leaves half an event registered. Pinned in Tasks 14–19 (each play's `start` with `force` and no zone) and Task 20 (the sweep, every kind).
4. **A phone.** On `low`, `budget.events` is 1: never two events running at once, no event mesh visible at rest (no draw call at a held pose), and the quality steps lower the traffic cap and the events cap with the rest. Pinned in Task 10 (`running().length ≤ budget.events` over a scripted run; `setStep`), Task 12 (traffic cap by tier and step) and Task 20 (the low-tier measure).
5. **A pocket universe and the Rick and Morty pocket.** In `/universe?seed=word` the zones are the pocket's own sectors, and far fights are seeded from the pocket's systems. Inside the Rick and Morty pocket its own side wins over any holder, and its law stays the crew's, as today. Pinned in Task 1 (`sideAt`'s order, `lawAt` with no holder), Task 2 (zones from a pocket's `fullSector`) and Task 7 (fights from a pocket's systems differ from the shared one's).

## Files

| File | Responsibility | Task |
|---|---|---|
| `src/components/universe/events/holder.js` (new) | whose space: `holderOf`, `createHere` | 1 |
| `src/components/universe/sides.js` | `sideAt`, `crewAt` take a holder; `lawAt` | 1 |
| `src/components/universe/events/zones.js` (new) | what's round the ship; what the director may bring there | 2 |
| `src/components/universe/director.js` | `zoneOf` reads generated systems; the table's columns and thirteen rows; arrival, big, hazard | 2, 3 |
| `src/components/universe/events/lines.js` (new) | the crews' lines for the new events | 3 |
| `src/components/universe/crews.js` | `linesFor` reads `EVENT_LINES` | 3 |
| `src/components/universe/words.js` | `EVENT` | 3 |
| `src/components/universe/events/pacing.test.js` (new) | ten minutes from 100 seeded starts | 4 |
| `src/components/universe/lanes.js` | `frameOf`; every lane along the 3D nose and clear of what's passed; `portLane` | 5, 6 |
| `src/components/universe/nav.js` | `riftSpot` takes solids and the 3D nose | 5 |
| `src/components/universe/hunterRules.js` | `entryPoint` along the 3D nose; the stale ceiling comment | 5 |
| `src/components/universe/events/life.js` (new) | the traffic a system keeps | 6 |
| `src/components/universe/events/fightsOut.js` (new) | far fights at generated systems on the shared clock | 7 |
| `src/components/universe/farFights.js` | `fightLabel` names a generated system | 7 |
| `src/components/universe/online/protocol.js`, `online/client.js` | the pack anywhere, kept near its pilot | 8 |
| `src/components/universe/events/playExisting.js` (new) | today's `happen`, escort and eclipse, moved out and taught generated space | 9, 11 |
| `src/components/universe/events/sceneEvents.js` (new) | the scene's events: zones, holder, director, players, registry, debug | 10–19 |
| `src/components/universe/traffic.js` | traffic reads the system; the convoy's own column | 11, 12 |
| `src/components/universe/setpieces.js`, `meteors.js`, `mines.js`, `leviathans.js` | spots and lanes clear of what's there; the rift's life and size; ice | 11, 15, 18 |
| `src/components/universe/events/playFar.js` (new) | skirmishes, far fights out, the battle | 13, 17 |
| `src/components/universe/events/signals.js`, `playSignals.js` (new) | stranded, treasure, wormhole, trader | 14, 15 |
| `src/components/universe/events/fights.js`, `playFights.js` (new) | waylay, smuggler, derelict, battle's rules | 16, 17 |
| `src/components/universe/events/sweeps.js`, `playSweeps.js` (new) | ion storm front, comet fly-by, tidal pull | 18 |
| `src/components/universe/events/herds.js`, `playHerds.js` (new) | leviathan migration, bloom | 19 |
| `src/components/universe/scene.js` | wiring only, smaller after | 9–20 |
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
    - **Core.** With `core` (the scene passes `Boolean(regionAt(...at))`: a hand-made region), it gives `{ system: null, holder: null }` and forgets the last holder.
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
  - **`Zone = { id, what, src, at: [x, y, z], reach, name, gap, faction?, traffic?, hazard?, system?, row }`**, with `gap = max(0, |at − p| − reach)` and `src` one of `'system'`, `'station'`, `'thing'`, `'extra'`, `'handmade'`.
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
  - **`ARRIVAL = { gentle: 60, first: [20, 40] }`**
  - **`createDirector({ rand, events })`** keeps every method and adds:
    - `update(dt, { …today's, big = false, hazard = null })`:
      - its choices also leave out a `big` row while `big`, and while arriving everything but `gentle && !big`
      - a row's weight is multiplied by `HAZARD_TILT[hazard]?.[id] ?? 1`
      - a forced (`soon`) or foretold id that isn't allowed now (arriving and not gentle, or big while `big`) waits until it is
    - `arrive(seconds = ARRIVAL.gentle)`: the gentle window runs from now, and the next event comes `between(ARRIVAL.first)` seconds on
    - `arriving` (a getter)
    - `allows(id, { side, zone = null, calm = false, big = false }) → boolean`: the tests `choose` makes (canHave, canBe, not heat while calm, not big while big, gentle while arriving)
    - `noted(id)`: an event that came another way (the waylay at a jump, Task 16) counts as the last, and the next comes `between(PACE.gap)` on
  - With `big` false and no `hazard` (every existing test), the choices and weights are today's, so every existing run picks exactly as it does now.
  - **`EVENT`** in `words.js`, the HUD's notes:

    ```js
    export const EVENT = {
      stranded: 'A distress beacon: someone’s stranded out there',
      saved: 'They’re safe: they’ll remember it',
      treasure: 'A signal: something worth finding',
      cache: 'A cache, and it’s yours',
      wormhole: 'A wormhole has opened: fly into it before it closes',
      thrown: (where) => `Thrown out in ${where}`,
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
    };
    ```

  - **`EVENT_LINES`** in `events/lines.js`: `{ cruiser, xwing, falcon, rv }`, each with one exchange `[[speaker, text], …]` for each of the thirteen new ids and for `'saved'`, `'thrown'` and `'picked'`, spoken by that crew's own speakers (`crews.js`'s `speakers`) or `'comms'`.

- [ ] **Step 1: Write the failing tests.** `director.test.js` gains, in new `describe`s:

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
  it('tilts toward what a system is dangerous for', () => {
    const share = (hazard, id) => {
      const got = run(createDirector({ rand: seeded(17) }), 24000, { side: withWhere(SIDES.starwars, everywhere), zone: 'place', hazard });
      return got.filter((g) => g.e === id).length / got.length;
    };
    expect(share('storm', 'stormfront')).toBeGreaterThan(share(null, 'stormfront') * 2);
    expect(share('pirates', 'stranded')).toBeGreaterThan(share(null, 'stranded') * 1.5);
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

  `lines.test.js`: for every crew of `CREWS` and every id of the thirteen and `'saved'`, `'thrown'`, `'picked'`, `linesFor(crew, 'event', id)` is a non-empty exchange whose speakers are `'comms'` or one of `crew.speakers`, each text over two characters; and `crews.js`'s own `events` rows still win over `EVENT_LINES` (`linesFor(crew, 'event', 'convoy')` is today's).
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/director.test.js src/components/universe/events/lines.test.js src/components/universe/crews.test.js src/lib/words.test.js`. Expected: the new `describe`s and `lines.test.js` FAIL; every existing test passes.
- [ ] **Step 3: Implement** the columns, the rows, the rules, `EVENT` and the lines. Write the lines in each crew's voice from its existing `events` rows, with no new character speaking.
- [ ] **Step 4: Run them and see them pass.** Same command. Expected: PASS, every existing director, crews and words test unchanged.
- [ ] **Step 5: Commit.** `git commit -m "The director's thirty events: how big each is, a gentle first minute, never two big ones at once"`

### Task 4: Ten minutes of free flight from 100 seeded starts

**Files:**
- Create: `src/components/universe/events/pacing.test.js`

**Interfaces:**
- Consumes: Task 1's `createHere`, `holderOf`, `sideAt`, `crewAt`; Task 2's `zonesAround`, `systemAt`, `whereFor`; Task 3's director, `EVENTS`, `withWhere`; `zoneOf`, `regionAt`, `mapSectorOf` (`layout.js`); lane 3's face (`UNIVERSE`, `fullSector`, `rngOf`); `SECTOR`.
- Produces: nothing new. It is the spec's pure pacing test. If it fails, tune `lasts`, the new rows' weights or `PACE`, never the test, and say which constant moved and why in the commit.

- [ ] **Step 1: Write the test.**

```js
import { beforeAll, describe, expect, it } from 'vitest';
import { SECTOR } from '../../../lib/space/address';
import { UNIVERSE, fullSector, rngOf } from '../../expanse/shared/space';
import { EVENTS, createDirector, withWhere, zoneOf } from '../director';
import { mapSectorOf } from '../layout';
import { regionAt } from '../regions';
import { SIDES, crewAt, sideAt } from '../sides';
import { createHere } from './holder';
import { systemAt, whereFor, zonesAround } from './zones';

const CREWS = ['xwing', 'cruiser', 'rv'];
const DT = 0.5;
let sectors;
beforeAll(() => {
  sectors = new Map();
  for (let sx = -1; sx <= 1; sx++) for (let sy = -1; sy <= 1; sy++) for (let sz = -1; sz <= 1; sz++) {
    const s = fullSector(UNIVERSE, sx, sy, sz);
    sectors.set(s.id, s);
  }
});

// one free flight: straight on from a seeded start, at the boost or on the
// pulse drive, the zones looked at every 30 s, each event playing for its
// own `lasts` (holding the director if it `holds`), as the scene plays it
function flight(n, rng) {
  const crew = CREWS[n % 3];
  const at = [0, 1, 2].map(() => (rng() * 2.4 - 1.2) * SECTOR);
  const d = [rng() - 0.5, rng() - 0.5, rng() - 0.5];
  const l = Math.hypot(...d);
  const speed = n % 2 ? 12 : 300;
  const director = createDirector({ rand: rng });
  const here = createHere();
  const log = [];
  let zones = [], busyUntil = -1, bigUntil = -1, room = null;
  for (let t = 0; t < 600; t += DT) {
    const p = at.map((v, i) => v + (d[i] / l) * speed * t);
    const ship = { x: p[0], y: p[1], z: p[2], speed };
    if (t % 30 === 0) {
      zones = zonesAround(sectors, p);
      room = here.update(zones.filter((z) => z.what === 'system'), p, { core: Boolean(regionAt(...p)) });
    }
    const side = sideAt(crew, mapSectorOf(...p), room.holder);
    const where = whereFor({ zones, ship, side });
    const zone = zoneOf(ship, { regionAt, systemAt: (x, y, z) => systemAt(zones, [x, y, z]) });
    const id = director.update(DT, { side: withWhere(side, where), zone, busy: t < busyUntil, big: t < bigUntil, travelling: speed > 40, hazard: room.system?.hazard ?? null });
    if (!id) continue;
    const e = EVENTS[id];
    const lasts = e.lasts[0] + rng() * (e.lasts[1] - e.lasts[0]);
    if (e.holds) busyUntil = t + lasts;
    if (e.big) bigUntil = Math.max(bigUntil, t + lasts);
    log.push({ t, id, lasts });
  }
  return log;
}

describe('the pace of things, in ten minutes of free flight', () => {
  it('meets at least three different events from each of 100 seeded starts, and never two big ones together', () => {
    const rng = rngOf(4242n);
    for (let n = 0; n < 100; n++) {
      const log = flight(n, rng);
      expect(new Set(log.map((e) => e.id)).size, `start ${n}: ${log.map((e) => e.id)}`).toBeGreaterThanOrEqual(3);
      let bigUntil = -Infinity;
      for (const e of log) {
        if (!EVENTS[e.id].big) continue;
        expect(e.t, `start ${n}: ${e.id} at ${e.t}`).toBeGreaterThanOrEqual(bigUntil);
        bigUntil = e.t + e.lasts;
      }
    }
  });
});
```

- [ ] **Step 2: Run it.** Run `npx vitest run src/components/universe/events/pacing.test.js`. Expected: PASS. (Tasks 1 to 3 already made what it tests, so it passes at once if the numbers hold. If it fails, it's a finding about the numbers: tune as above.)
- [ ] **Step 3: Time it.** The `it` must run in under a second (RULES, "Tests go beside the file"); the 27-sector build in `beforeAll` is lane 2's density test's own cost. If it's over, look at the zones every 60 s instead of 30 and say so in the commit.
- [ ] **Step 4: Commit.** `git commit -m "Ten minutes of free flight from a hundred starts: three different events each time, never two big ones together"`

### Task 5: Lanes, spots and packs along the 3D nose, clear of what's there

**Files:**
- Modify: `src/components/universe/lanes.js` (`laneNear` `:174`, `convoyLane` `:192`, `meteorLane` `:214`, `flybyLane` `:230`, `laneLocal` `:87`, `laneDepart` `:106`, `laneDock` `:298`; a new `frameOf`), `src/components/universe/lanes.test.js` (a new `describe`)
- Create: `src/components/universe/__fixtures__/lanes-level.json` (written once from unchanged code; the folder's own name for fixtures)
- Modify: `src/components/universe/nav.js:264-279` (`riftSpot`), `src/components/universe/minefield.js:49` (`minefieldLane`'s nose), `src/components/universe/hunterRules.js:310-335` (`entryPoint`) and `:238-241` (the stale "lift near the ceiling" comment: the ship's `vy` holds only the parking nudge now), `src/components/universe/hunterRules.test.js`, `src/components/universe/nav.test.js`

**Interfaces:**
- Consumes: `noseOf`, `forward`, `SOLIDS` (`ship.js`).
- Produces:
  - **`frameOf(ship) → { f, r, u }`**: unit forward along `noseOf(ship)`, right `normalize(f × Y)` (when the nose is within 0.01 of straight up or down, the right is `[-fz, 0, fx]` from `forward(heading)`), and up `r × f`. For a level ship `f = [fx, 0, fz]`, `r = [-fz, 0, fx]`, `u = [0, 1, 0]`: today's numbers.
  - Every lane maker takes a last argument `solids = SOLIDS` and builds its points in `frameOf(ship)` (`ahead` along `f`, `side` along `r`, a rise along `u`) wherever it read `forward(heading)` and `ship.y`. `riftSpot(ship, rand, solids = SOLIDS)` and `minefieldLane(ship, rand, solids)` the same.
  - **`entryPoint`** places `ahead`, `behind` and `portal` points along `frameOf(ship)`; `at` and `from` are unchanged.
  - For a level ship, every one of these gives exactly today's points for the same `rand`: the fixture pins it.

- [ ] **Step 1: Write the fixture, then the failing tests.** First, on unchanged code, add a `lanes-level` writer to the test (as lane 2's fingerprint does: written once when `LANES_WRITE` is set and the file is missing). It records, for 12 seeded level ships (heading `k × 0.52`, y `k × 40 − 200`) and a seeded `rand` each, the output of `laneNear`, `convoyLane`, `meteorLane`, `flybyLane` (both `cross` values), `riftSpot`, `minefieldLane` and `entryPoint` (`ahead`, behind, `portal`, i = 0..3 of 4). Run `LANES_WRITE=1 npx vitest run src/components/universe/lanes.test.js` once, then without it.

  Then add, in a new `describe('in three dimensions')`:
  - every level case reproduces the fixture exactly (`toEqual`)
  - `frameOf` for a level ship is today's `forward` and `[-fz, 0, fx]`; for `pitch: 1.4` its `f` is `noseOf(ship)` and `f · r`, `f · u`, `r · u` are 0 to 1e-12
  - for a ship pitched up 1.5 (all but straight up) on the pulse drive: `laneNear`'s first point, `flybyLane`'s pass point, `meteorLane`'s middle, `riftSpot` and an `ahead` `entryPoint` each lie ahead along the nose, `(p − ship) · f > 0.5 · |p − ship|`
  - with a solid `{ id: 'E:1,0:0:0', at: <today's lane middle>, r: 30 }` in `solids`, each maker's result clears it by its own margin, or is null
  - in `hunterRules.test.js`, `describe('anywhere, at any height')`: a pack sent after a ship circling 50,000 above home, and one after a ship at `[1e8, 2e7, -3e7]`, fights for 30 s of `update(1 / 30, ship)`: every hunter stays within 400 of the ship, none falls more than 1,000 below it, and lasers come (`'laser'` events), as at home
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/lanes.test.js src/components/universe/hunterRules.test.js src/components/universe/nav.test.js`. Expected: the pitched and solids tests FAIL; the level fixture passes; the anywhere test may already pass. If it does, lane 2's finding (`hunterRules.js:240`) was the comment alone: say so in the commit.
- [ ] **Step 3: Implement.** Keep `hunterRules.js`'s net growth under 40 lines.
- [ ] **Step 4: Run them and see them pass.** Run `npx vitest run src/components/universe`. Expected: PASS, every existing lanes, nav, minefield, hunterRules, skirmish, leviathans and meteors test unchanged.
- [ ] **Step 5: Commit.** `git commit -m "Lanes, spots and packs come along the ship's own nose in three dimensions, clear of what's there"`

### Task 6: The traffic a system keeps

**Files:**
- Create: `src/components/universe/events/life.js`, `src/components/universe/events/life.test.js`
- Modify: `src/components/universe/lanes.js` (append `portLane`), `src/components/universe/lanes.test.js`

**Interfaces:**
- Consumes: Task 1's `sideAt`; Task 2's zones; Task 5's `frameOf`, `clearance`; lane 2's `BUDGET` rows (`traffic`); `orbitAt` (the face).
- Produces:
  - **`LIFE = { gap: [1, 3], least: 0.15, portShare: 0.5, near: [60, 300], ports: 8 }`**
  - **`PORTS = ['station', 'port']`**: the zones traffic flies between
  - **`trafficHere({ system, holder, crew, budget, zones, t }) → Here | null`**, null with no system (the core keeps today's traffic, untouched):
    - `side`: `sideAt(crew, 'main', holder)`
    - `gap`: `LIFE.gap` divided by `max(LIFE.least, system.traffic)`
    - `cap`: `budget.traffic`, the groups the system's own lanes keep up at once
    - `ports`: the system's stations, then its `'port'` zones within its reach, then its planets at `orbitAt(p, t)` (`{ id, at, reach: 1.9 × radius }`), at most `LIFE.ports`
    - `law`: the holder's lawful side's `law` faction, or null when the holder isn't lawful
  - **`portLane(a, b, ship, rand, solids = SOLIDS) → { pts: [p0, p1, p2], k0 } | null`** (`lanes.js`): from beside `a` (`a.reach + 6…16`) to beside `b`, bowed out a little, clear of `solids` by 1. `k0` is where along it a group starts so you see it: the point nearest the ship that is at least `LIFE.near[0]` from it, or null if no point is within `LIFE.near[1]`.

- [ ] **Step 1: Write the failing tests.** `life.test.js`:
  - A system with `traffic: 1` gives `gap: [1, 3]`; with `traffic: 0.05`, `gap` is `[1 / 0.15, 3 / 0.15]`.
  - An Empire system, flying the RV, gives `side: SIDES.starwars` and `law: 'empire'`; an independent one gives the RV's side and `law: null`; a faction of its own gives the RV's side and its law.
  - `cap` is `BUDGET.low.traffic` … `BUDGET.ultra.traffic` for each tier's row, and `universeBudget({ tier: 'mid' }, 2).traffic` when given that row.
  - For `E:1,0`'s first system with a station: `ports[0]` is the station, every port is within the system's reach (a planet at `orbitAt(p, 777)` when `t` is 777), at most 8.
  - `trafficHere({ system: null, … })` is null.

  `lanes.test.js`, a new `describe('between ports')`: `portLane` between two of that system's ports starts beside one and ends beside the other (within their `reach + 16`), clears every solid passed by 1, and for a ship 120 off its middle has `k0` within 300 of the ship and at least 60 from it; a ship 5,000 away has `k0` null.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/events/life.test.js src/components/universe/lanes.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them and see them pass.** Same command. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "The traffic a generated system keeps, by its density and whose it is, flying between its ports"`

### Task 7: Far fights out in every direction

**Files:**
- Create: `src/components/universe/events/fightsOut.js`, `src/components/universe/events/fightsOut.test.js`
- Modify: `src/components/universe/farFights.js:73-78` (`fightLabel`), `src/components/universe/farFights.test.js` (a new `describe`)

**Interfaces:**
- Consumes: Task 2's system zones (or a sector's systems); `FAR` (`farFights.js`); `hash64`, `rngOf` (the face).
- Produces:
  - **`FIGHTS_OUT = { every: 900, on: 240, share: { pirates: 0.45, storm: 0.12, minefield: 0.12, none: 0.06 }, lift: 600, size: [6, 14] }`**
  - **`fightOf(system, t) → Fight | null`**, from `rngOf(hash64(system.seed, 'fight'))` alone: whether the system fights at all (by `share[hazard ?? 'none']`), its phase in `every`, its size and heat. On while `((t / every + phase) mod 1) < on / every`. `Fight = { id: 'fight:<system id>', at: [x, y + reach + lift, z], size, hot, system: system.id, name: system.name }`.
  - **`fightsAround(systems, cam, t, { max = 3, far = FAR } = {}) → Fight[]`**: the nearest `max` fights further than `far` from `cam`
  - **`fightNode(system) → { id: 'node:<system id>', kind: 'beacon', at, region: null, name }`**, a node `pickFightNode` takes
  - **`fightLabel(at, near = null)`**: `near` names a generated system: `` `Fighting near ${near}` ``, the words `fightLabel` already writes; without it, today's.

- [ ] **Step 1: Write the failing tests.** `fightsOut.test.js`, over the 27 sectors round home built in `beforeAll`:
  - **The same for everyone.** `fightOf(sys, t)` twice is equal, for 200 systems and 5 times.
  - **On and off.** A fighting system is on for 240 s of every 900: sampling every second over 900 s gives 240 ± 1 seconds on.
  - **Shares.** Over the 27 sectors' systems, the share of pirate systems that ever fight is within 0.05 of 0.45, and of hazard-free ones within 0.02 of 0.06.
  - **Every direction.** At `t = 0` and `t = 5000`, the fights on within the 27 sectors include one more than 30,000 above home, one more than 30,000 below, and one each way along x and z.
  - **The nearest past `FAR`.** `fightsAround` from a point keeps at most 3, all further than `FAR`, nearest first.
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
- Produces: **`createExistingPlay(deps) → Player`** (the Global Constraints' contract) for today's seventeen kinds, with today's behaviour, plus `escort` and `eclipse` (getters, read by the dev hooks and the eclipse's dimming at `:4952` and `:5040`), `eclipseK` (a getter), `dropEscort()`, `dropEclipse()`, `later` (the queue at `:1120`, moved in; `scene.js:4032`'s `later.length = 0` and `:4052`'s `later.length > 0` read `play.later`) and `hunts` (the count at `:1076`, read by the spotted patrol at `:5261`).
  - **`deps`.** Values, all declared above the call and never reassigned: `group` (`map`, `:503`), `hunters`, `traffic`, `pieces`, `leviathans`, `meteors`, `mines`, `novae`, `fleet`, `camera`, `small`, `reduced`. Thunks, each declared below the call or reassigned: `state`, `side` (`sideHere`, `:968`), `emit`, `hurt`, `deed`, `wall`, `travelling`, `leadOf`, `litKey` (`() => litBy.key`; `litBy` is reassigned at `:5018`), `onRemover(ship) → boolean` (`startRemover`, above), `onDestroyer(ambush)` (sets `capFight`, which `capitalEvent` at `:3820` reads), `solids` (`() => solidsNow`).
  - **`running()`** registers each started event as `{ id: '<kind>:<n>', kind, name, at, big }` and lets it go when its collaborator says it's over: `hunt`, `council`, `roadblock`, `bounty`, `distress`: `!hunters.active`; `destroyer`: `!pieces.destroyerHere`; `meteors`: `!meteors.count`; `minefield`: `!mines.count`; `leviathan`: `!leviathans.busy`; `rift`: `!pieces.riftAt`; `escort`, `eclipse`: their own; `remover`: the scene's `remover` (a thunk); the rest after `lasts[1]`. Anything older than `1.5 × lasts[1]` lets go.
  - **`busy`** is the escort's and the eclipse's, as today (`:3934`, `:3951`).

- [ ] **Step 1: Take the before shots.** Run `CHROMIUM=/opt/pw-browsers/chromium node scripts/universe-check.mjs --quality mid --out lab/universe/before-4b/mid`, and `--quality mid --poses old-rim,above-core,expanse-system,expanse-station --out lab/universe/before-4b/endless-mid` (one run, so all four go in one file: lane 3's finding). Write the numbers into the evidence README.
- [ ] **Step 2: Write the failing tests.** `playExisting.test.js`, with fakes for every collaborator (a `vi.fn()` each, returning what today's code needs), pins today's behaviour of `happen`, read from `scene.js:3434-3561`:
  - `start('hunt', ship)` calls `hunters.pack(pick(side, 'hunt'), ship, { heat, first: true })` the first time and `first: false` after; travelling, it adds `{ ahead: true, interdict: true, lead }`
  - `'council'` passes the pack's points to `pieces.portals`; `'roadblock'` packs `'dea'` ahead and calls `pieces.roadblock`
  - `'destroyer'` calls `onDestroyer` only when `pieces.destroyer` gave a hangar
  - `'distress'` packs the side's pirates after `traffic.distress`'s prey, size 2, and emits `{ type: 'event', id: 'distress' }`; with no prey it returns false and emits nothing
  - `'convoy'` calls `traffic.convoy(ship, side)`; `'comet'` queues its event 5 s on; `'supernova'` explodes at the nearest site past 1,100 (of the two nearest)
  - `'flare'` launches at `nearestStar` and queues the shock at `arrives`; the queued run hurts 15 and sets `static`, `flare` and `shake`
  - `'rift'`, `'leviathan'`, `'meteors'`, `'minefield'`, `'eclipse'`, `'escort'` and `'bounty'` do what their branches do, each false where today's returns early
  - `running()` holds a started hunt until the fake `hunters.active` goes false
- [ ] **Step 3: Run them and see them fail.** Run `npx vitest run src/components/universe/events/playExisting.test.js`. Expected: FAIL (module not found).
- [ ] **Step 4: Move the code.** Make `createExistingPlay` from the moved lines, with no change in behaviour, and wire `scene.js`:
  - after `const mines = createMines(...)` (`:1099`): `const play = createExistingPlay({ … })` (+1, its deps on the same line)
  - `const happen = (id, ship) => play.start(id, ship);` where `happen` was (+1); `law`'s bounty (`:1019`) and the dev hook keep calling `happen`
  - in `adventure`: `if (play.update(dt, t, live)) busy = true;` where the two steps were (+1)
  - the reads of `escort`, `eclipse`, `eclipseK`, `dropEscort`, `dropEclipse`, `later` and `hunts` become `play.…` in place (0 each)

  Count `scene.js`'s lines before and after.
- [ ] **Step 5: Run them and see them pass.** Run `npm test`. Expected: PASS.
- [ ] **Step 6: Check nothing plays differently.** Start the dev server (Global Constraints) and run `CHROME=/opt/pw-browsers/chromium OUT=docs/superpowers/evidence/endless-universe-lane-4b/before node scripts/events-check.mjs rv`. Expected: as on the branch before this task (the meteor stream and the shot through a rock time out in software GL on `main` already: HANDOFF-universe's "Left").
- [ ] **Step 7: Commit.** `git commit -m "The director's events move out of the scene into a player of their own, as they were"`. The body has `scene.js`'s count (about −175).

### Task 10: The scene's events: zones, whose space, the director, the registry

**Files:**
- Create: `src/components/universe/events/sceneEvents.js`, `src/components/universe/events/sceneEvents.test.js`
- Modify `scene.js`:
  - `const director = createDirector();` (`:1079`) goes; its reads (`:2514`, `:3707`, `:5911`, `:5963`) become `events.director` (−1)
  - Task 9's `const happen = (id, ship) => play.start(id, ship);` becomes `events.happen(id, ship)`, and its `play.update(dt, t, live)` in `adventure` becomes `events.update(dt, t, live)`, which updates every player (0 each)
  - the director's block in `adventure`, `// (where you are: a sun lighting you` (`:3985`) through `if (id) happen(id, live);` (`:3991`), all but `state.hurtNow = 0;`, becomes `events.step(dt, live);` (−5). It moves out of the `if (hunters)` around it, inside `if (live)`, so the zones and the holder refresh with reduced motion too.
  - `sideHere` (`:968`) reads a holder: `let holderNow = null;` above it (+1), and `sideAt(state.kind, mapSectorOf(…), holderNow)` (0)
  - the paced step: in `paceTo` (`:5053`), beside lane 2's `expanse.setStep` and lane 3's `places.setStep`, `events.setStep(at.step, at.floor);` (+1)
  - a new pilot's spawn: in the `if (!state.ship)` block (`:2211-2220`), after `state.yaw = -state.ship.heading;`, `if (!props.startAt) events.arrive();` (+1). Lane 4c's arrival keeps this line or calls `events.arrive()` itself.
  - `holdPose` (`:5872-5873`): `dropEscort(); dropEclipse();` become `events.clear();` (−1)
  - `where()` (`:6277`): `events: events.running().map((r) => ({ id: r.id, kind: r.kind, name: r.name, x: r.at[0], y: r.at[1], z: r.at[2], big: r.big })), holder: holderNow && { id: holderNow.id, name: holderNow.name, side: holderNow.side },` (+1)
  - the dev hooks: `__universeDebug`'s `happen` becomes `(id, o) => events.happen(id, state.ship, { force: true, ...o })` (0), and it gains `events: events.debug` on its existing line (0)

**Interfaces:**
- Consumes: Tasks 1–3 and 9; lane 2's `expanse.sectors()`, `expanse.stars()`, `universeBudget`; lane 3's `places.docked()`; `regionAt`.
- Produces: **`createSceneEvents(deps) → { update(dt, t, live) → busy, step(dt, live), happen(id, ship, { force }) → boolean, arrive(), running(), busy, director, holder(), here(), zones(), life(), pull(ship), targets, hit(from, to, punch), outOfJump(j, park), follow(zone), setStep(step, floor), clear(), debug, dispose() }`**
  - **`deps`.** Today's collaborators (as Task 9's), plus: `play` (Task 9's player), `players` (the new events' players, added by Tasks 13–19; `[]` here), `expanse` and `places` (values: declared at `:772` and by lane 3 above `:1099`), `device` (`{ tier, detail }`, as lane 2 hands `universeBudget`), and thunks: `busyElse(live)` (today's `busy` expression from `:3989`, less the escort and eclipse: `law.busy`, `hunters.active`, `pieces.destroyerHere`, `remover`, `leviathans.holds(live)`, `meteors.count`, `mines.count`, the map view, `charting`, `held`, `front.near`), `setHolder(h)` (sets `holderNow`), `jumping` (`() => Boolean(state.jump)`), `atStation` (`() => Boolean(state.at && byId(state.at)?.kind === 'core')`), `inGate` (`() => state.at === 'starwars'`), `hurtNow` (`() => state.hurtNow ?? 0`), `diff`, `standing`, `pick(id)`, `note(text)`. The sun lighting you is worked out from `litKey()` as `:3986` does today, moved in.
  - **Zones.** `step` refreshes `zonesAround(expanse.sectors(), at)` once a second of the scene's clock, or after 2,000 units, and `createHere().update(...)` with `core: Boolean(regionAt(...at))`. A changed holder calls `setHolder`.
  - **The director's step** runs only while `hunters` exists, so reduced motion has no events, as today. It is today's, with `zone: zoneOf(live, { regionAt, systemAt })`, `side: withWhere(sideHere(), whereFor({ zones, ship, side, sun, station, gate, docked: Boolean(places.docked()), jumping }))`, `busy: busyElse(live) || anyBusy || running().length >= budget.events`, `big: running().some((r) => r.big)` and `hazard: here.system?.hazard ?? null`.
  - **`happen(id, ship, { force })`** finds the player whose `kinds` hold `id` and starts it with `ctx`. Forced, it starts whether or not the director would allow it; not forced (the director's own picks come this way too), only what `director.allows` allows.
  - **`running()`**, `busy`, `targets` and `hit` gather every player's.
  - **`setStep(step, floor)`**: `budget = universeBudget(device, step, floor)`.
  - **`debug`**: `{ kinds() → string[] (every id a player plays: 30 once Task 19 is in), running(), here(), zones(), director, clear(), spotFor(kind) → { x, y, z, heading } | null }`. `spotFor` is where a kind can be forced: the Maw's edge for `'tidal'` with no black hole near, a station's park (lane 3's `places.park`) for `'trader'`, else the ship's own place.

- [ ] **Step 1: Write the failing tests.** `sceneEvents.test.js`, over a fake expanse holding `E:1,0` and fake collaborators:
  - **Zones and whose space.** A ship inside an Empire-held system of `E:1,0` gets `holder().side === 'starwars'` and `setHolder` called once; it stays through 300 steps on that system's edge.
  - **The director's inputs.** With a spy director, `update` gets `zone: 'place'` inside a generated system and `'void'` far between; `hazard` is the system's; `side.has('station')` is true near a station and false 40,000 from any.
  - **Never more than the budget.** A scripted run of 600 s of steps with every new kind forced through `happen` as soon as it can: with `device: { tier: 'low' }`, `running().length` is never over 1 for an unforced start; with `'high'`, never over 3.
  - **Never two big ones from the director.** In the same run, no director-started big event begins while another big one is running.
  - **The arrival.** After `arrive()`, the director's first pick in 60 s is gentle (spy on `director.update`'s result).
  - **Forcing.** `happen('convoy', ship, { force: true })` starts it whatever the director says; `happen('convoy', ship)` refuses while `busyElse` is true.
  - **Reduced motion.** With `hunters: null`, `step` never calls the director.
  - **`setStep`.** `setStep(2, false)` on `'mid'` lowers the events cap to lane 2's stepped row.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/events/sceneEvents.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement and wire.** Count `scene.js`'s lines.
- [ ] **Step 4: Run them and see them pass.** Run `npm test`. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "The scene's events know what's round the ship, whose space it is, and never run more than the tier allows"`. The body has `scene.js`'s count (about −4).

### Task 11: The existing events, out there

**Files:**
- Modify: `src/components/universe/events/playExisting.js`, `playExisting.test.js`, `src/components/universe/traffic.js:529-540` (`convoy`), `src/components/universe/setpieces.js:409-422` (`rift(ship, solids)`), `src/components/universe/meteors.js:99` (`storm(ship, rand, solids)`), `src/components/universe/mines.js:127` (`lay(ship, rand, solids)`), `src/components/universe/leviathans.js:191` (`pass(ship, who, rand, solids)`), `scripts/universe-endless-check.mjs` (the `events` step)
- Modify `scene.js`: `riftThrough` (`:4210-4237`) takes its exit from `events.riftExit(s)` (0); `createSetPieces(map, { small, fleet })` (`:1080`) gains `solids: () => solidsNow` (0)

**Interfaces:**
- Consumes: Task 2's zones; Task 5's solids arguments; lane 2's `expanse.stars()`; lane 3's `places.park(id, from)`.
- Produces, in `playExisting.js` (each with `ctx` from Task 10):
  - **The flare** flares the nearest of `deep.js`'s `STARS` and the zones' systems (a system's star at its `at`, `r: star.size`), when one is within 30,000; else it returns false.
  - **The eclipse** finds the star lighting you by `litKey().id` among `expanse.stars()` (lane 2's, which hold lighting's `STARS` too), not `LIT_STARS` alone, so a generated sun can be eclipsed. `where.sun` is worked out the same way (`scene.js:3986` moves into Task 10's step).
  - **The supernova** goes off at the nearest of `SUPERNOVA_SITES` past 1,100, or out in generated space at a generated system's star 6,000 to 40,000 off (inside the far plane, so it's drawn); its shell spreads over the better part of a minute as `supernova.js` draws it.
  - **The rift** opens clear of every solid in `solidsNow`; out past the core it throws you to a generated system in the zones you haven't seen (`state.saw`), parked by `places.park(id, from)`, else to `riftExit`'s hand-made place as today. `events.riftExit(ship) → park | null`.
  - **The escort** heads for the next port ahead (Task 6's `ports`), the hand-made `PLACES` in the core as today.
  - **The convoy gets a column of its own** (HANDOFF-universe's "Left"): `traffic.convoy(ship, side, { ports, solids })` flies a column with its escort on Task 6's `portLane` between two of the system's ports, starting where you see it, and it always has a slot (past `MAX`), so it never spawns nothing. Where there are no two ports, `convoyLane` as today, then `laneNear`. It registers as running, with its lead's `at`, so the map shows it.
  - **The meteor stream, the minefield, the leviathans and the capital ship** take `solidsNow`, so none is laid through a generated planet or station.
  - **The bounty** comes anywhere, as it does.
  - **The remover** stays at the hand-made planets (finding 4).

- [ ] **Step 1: Write the failing tests.** In `playExisting.test.js`, a new `describe('out there')`, over `E:1,0`'s zones and fakes:
  - a flare in a generated system launches at that system's star; 40,000 from any star, it returns false
  - with `litKey()` a generated star's id and `expanse.stars()` holding it, the eclipse plans against that star
  - the supernova's site is a generated star 6,000 to 40,000 off when no hand-made site is within 40,000
  - the rift's exit from generated space is a zone system not in `saw`, parked by `places.park`
  - the escort's `to` is a port of the system
  - `traffic.convoy` gets the system's ports and the frame's solids, and a convoy run registers as running

  In `traffic.test.js` (new, Node, with `fleet: { has: () => true, loaded: () => false, make: () => fakeModel(), want() {} }`): a convoy with two ports flies a column on a port lane and spawns even with `MAX` groups already flying.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/events/playExisting.test.js src/components/universe/traffic.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement**, then add the endless check's `events` step: for each kind given (`--only events:flare,rift,…`, or all of `events.debug.kinds()`):
  1. teleport to `events.debug.spotFor(kind)` (lane 2's `__universeDebug.teleport`), then to a generated system's reach for the out-there run
  2. `__universeDebug.happen(kind)`
  3. wait until `events.debug.running()` holds that kind (or its own sign: `pieces.riftAt`, `leviathans.busy`, `meteors.count > 0`, `mines.count > 0`, the escort, the eclipse), up to 600 s of the scene's clock
  4. shoot it, `events-<kind>.jpg`, into the evidence folder
  5. `events.debug.clear()`, and wait until `running()` is empty
- [ ] **Step 4: Run them and see them pass.** Run `npm test`, then `node scripts/universe-endless-check.mjs --quality mid --only events:flare,meteors,leviathan,minefield,escort,eclipse,rift,convoy,bounty`. Expected: PASS, exit 0, nine shots, no console errors.
- [ ] **Step 5: Commit.** `git commit -m "The flare, the rift, the eclipse, the escort and the rest play out in generated space, and the convoy has a column of its own"`

### Task 12: Traffic from the nearest system

**Files:**
- Modify: `src/components/universe/traffic.js:357-429` (`update`'s spawn and spotting), `src/components/universe/traffic.test.js`, `scripts/universe-endless-check.mjs` (the `life` step)
- Modify `scene.js`: the traffic call (`:5252`) passes `here: events.life()` in its options object (0)

**Interfaces:**
- Consumes: Task 6's `trafficHere`, `portLane`; Task 10's `events.life()`.
- Produces: `traffic.update(dt, t, ship, { fight, feared, wanted, here = null })`. With `here` null (the core), today's code path, untouched. With `here`:
  - **Who flies.** New groups take their kinds from `here.side`. `fleet.want(kindsFor(here.side))` is asked once when it changes. Groups already flying fly on: a holder's change never clears traffic (`setCrew`'s clear is for a crew change only, as today).
  - **How often.** The next group comes `between(rand, ...here.gap)` on.
  - **Where.** `LIFE.portShare` of new groups fly a `portLane` between two of `here.ports`, starting at its `k0` and fading in (`FADE_OVER`, as a cut-short run does); the rest cross the space round you (`laneNear` with `solids`).
  - **How many.** Port-lane groups are capped at `here.cap`; the everyday cap `MAX` stays.
  - **The law.** A patrol reports a wanted pilot only for `here.law` (none in an independent system), in place of `side.law`.
  - The flyby (`:388-395`) is unchanged.

- [ ] **Step 1: Write the failing tests.** In `traffic.test.js`, new `describe`s:
  - with `here.side` the Star Wars side while the crew is the RV, every new group's kind is one of `kindsFor(SIDES.starwars)`
  - a group spawned under one `here` is still flying, at the same place, the frame after `here` changes to another side's
  - at `here.gap = [10, 30]`, 600 s of updates spawn about a tenth as many everyday groups as at `[1, 3]` (between 0.05 and 0.2 of them)
  - port-lane groups never exceed `here.cap`, and each starts at least 60 from the ship
  - with `here.law: null` and a wanted pilot, no `'spotted'` event comes; with `'empire'`, a TIE patrol passing within `SPOT` reports
  - with `here` null, a seeded run gives the same groups as before this task (the seeded `rand` is passed in: `createTraffic(parent, { rand })`, today's `Math.random` its default)
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/traffic.test.js`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement and wire**, then add the endless check's `life` step. At five places (a generated system held by a known faction; deep space between systems; 50,000 above the core; `[1e7, 0, 0]`, a far sector; home):
  1. teleport there, level, on the boost
  2. wait until something moves near the ship (`traffic.groups.length > 0`, or `hunters.active`, `skirmishes.active`, `leviathans.busy` or `events.debug.running().length`), reading the scene's clock from the teleport
  3. fail if 20 s of the scene's clock passed first (the spec's 20 seconds)
  4. at the held system, check every group's kind is the holder's side's
- [ ] **Step 4: Run them and see them pass.** Run `npm test`, then `node scripts/universe-endless-check.mjs --quality mid --only life`. Expected: PASS, exit 0, the five times printed and copied into the README.
- [ ] **Step 5: Commit.** `git commit -m "Traffic reads the nearest system: its density, whose it is, and its ports to fly between"`

### Task 13: Hunters, the law and far fights read whose space it is

**Files:**
- Create: `src/components/universe/events/playFar.js`, `src/components/universe/events/playFar.test.js`
- Modify `scene.js`, moving out the far fights (find by quote): `const SKIRMISH_EVERY` (`:3758`) through `fightsNow`'s end (`:3814`), and `if (skirmishes) farFight(dt, t, live);` with the `state.fights` refresh (`:3876-3877`), which become `events`' (about −60). In place (0 each):
  - `createHunters(…, { …, solids: SOLIDS, … })` (`:972`), `createWingmen` (`:974`) and `createSkirmishes` (`:975`): `solids: () => solidsNow`
  - `npcWorld` (`:3686`): `solids: SOLIDS` becomes `get solids() { return solidsNow; }`
  - `createLaw`'s `side: () => sideFor(state.kind)` (`:1016`): `side: () => lawAt(state.kind, holderNow)`
  - `standing.side(sideOf(state.kind))` (`:3867`): `standing.side(lawAt(state.kind, holderNow)?.id ?? sideOf(state.kind))`
  - `stood`'s `const side = sideFor(state.kind)` (`:986`): `lawAt(state.kind, holderNow) ?? sideFor(state.kind)`
  - `skirmishSpot`'s reads (`meet`'s at `:3693`, the dev hook `meetNpc`): `events.spot(s)`
- Modify: `scripts/universe-endless-check.mjs` (the `fights` step)

**Interfaces:**
- Consumes: Task 7's `fightOf`, `fightsAround`, `fightNode`, `fightLabel`; Task 10's zones and holder; `pickFightNode`, `NODES`, `placeAt`.
- Produces: **`createFarPlay(deps) → Player`** with `kinds: []` (Task 17 adds `'battle'`), `fights()` (what `farFights.update` draws and `where().farFights` lists, each with `y`, and `label: fightLabel(at, near)`), and `spot(ship)` (today's `skirmishSpot`, clear of `solidsNow`):
  - **Today's skirmish, out ahead,** every `SKIRMISH_EVERY`, at `pickFightNode({ ship, headedFor, nodes })`, where `nodes` is `NODES` plus `fightNode` of every system in the zones (so out past the core one is near, not 100,000 off at a hand-made beacon)
  - **The far fights out.** `fightsAround(zone systems, cam, t)` joins `fights()` with the skirmish and the front, drawn by `farFights` (its pool of four)
  - **Coming up on one.** Within `FAR` of a far fight that's on and not yet fought this window, the skirmish starts there (`placeAt(node, solidsNow)`), its hunters the holder's side's `skirmish.faction` (the crew's with no holder), and its impostor gives way to the real one
- **Hunters, wingmen, skirmishes and the characters** fly round what's there now: the generated planets, moons, stations and things (lane 2's `expanse.solids()` and lane 3's `places.solids()` are in `solidsNow`).
- **The law and your standing** are the holder's (`lawAt`). Crossing into an independent system, `wanted.side(null)` drops the stars (nobody's law there) and keeps each side's bounty in storage, as `wanted.js:108-117` does.

- [ ] **Step 1: Write the failing tests.** `playFar.test.js`, over `E:1,0`'s zones and a fake `skirmishes`:
  - `fights()` holds the far fights `fightsAround` gives, each labelled `'Fighting near <system name>'` and with its height
  - a ship flown within `FAR` of an on fight starts one skirmish there, its faction the holder side's, and not again in that window
  - the out-ahead skirmish's node, from a generated point, is within 30,000 of the ship
  - `spot(ship)` clears a generated solid passed in `solids`

  `law.test.js`, a new `describe('whose law it is')`: with `side` switching from the Empire's to null and back, `wanted.side` is called twice (not every step), and the Empire's bounty is back after.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/events/playFar.test.js src/components/universe/law.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement and wire**, then add the endless check's `fights` step:
  1. teleport into a generated sector's middle
  2. wait until `__universe().farFights` (from `where()`) holds a fight labelled `Fighting near …`, its `y` set
  3. teleport 1,500 from it, and wait until `skirmishes.active`
  4. shoot it, `fights.jpg`
- [ ] **Step 4: Run them and see them pass.** Run `npm test`, then `node scripts/universe-endless-check.mjs --quality mid --only fights,life`. Expected: PASS.
- [ ] **Step 5: Run PR 4b.2's checks.** Start the dev server and run `CHROME=/opt/pw-browsers/chromium node scripts/navmap-check.mjs` and `CHROME=/opt/pw-browsers/chromium node scripts/flyto-check.mjs --fake`, then stop it; run `CHROMIUM=/opt/pw-browsers/chromium node scripts/universe-check.mjs --quality mid --out lab/universe/after-4b2/mid`. Expected: as before Task 9; calls and triangles at every pose no higher than `before-4b`.
- [ ] **Step 6: Commit.** `git commit -m "Hunters, the law and far fights read whose space it is, and fly round what's there"`. The body has `scene.js`'s count (about −60).

---

## PR 4b.3: Thirteen new events

Each task below adds a player to Task 10's `players` list (+0 in `scene.js`: the list is one argument on `createSceneEvents`'s line), a pure rules file with its test, the player's Node test with fakes, and the endless check's `events:<kinds>` run at mid.

### Task 14: Signals: a distress call, and a treasure signal

**Files:**
- Create: `src/components/universe/events/signals.js`, `signals.test.js`, `src/components/universe/events/playSignals.js`, `playSignals.test.js`

**Interfaces:**
- Consumes: Task 5's `frameOf`; Task 10's `ctx`; `hunters.pack`, `traffic.escort` (the stranded ship, held nearly still), `deed`, `pay`, `note`, `EVENT`; `createCanvasTexture` (`lib/three/canvasTexture.js`), `hot` (the same file), `kit.js`'s `parts`.
- Produces, in `signals.js`:
  - **`SIGNAL = { near: [600, 1500], cone: 0.7, reach: 40, clear: 120, life: 300 }`**
  - **`signalSpot(ship, rand, solids = []) → [x, y, z] | null`**: 600 to 1,500 along the 3D nose, at most `acos(0.7)` off it, clear of every solid by `r + SIGNAL.clear`, from eight tries
  - **`STRANDED = { waves: 2, gap: 20, pack: 2, bite: 0.012, near: 30 }`**
  - **`createStranded({ at }) → { at, phase, hull, step(dt, { you, on, cleared }) → events }`**. `you` is the ship's `[x, y, z]` or null; `on` how many pirates are within `near` of it; `cleared` whether the current wave is down.
    - `'calling'` until you're within `SIGNAL.reach`: `'reached'`; past `SIGNAL.life`: `'gone'`
    - `'defend'`: `'wave'` (n 1) at once, then `'wave'` (n 2) `STRANDED.gap` after the first is cleared; its hull loses `on × bite × dt`; at 0, `'lost'`; both waves cleared, `'saved'`
  - **`TREASURE = { reach: 25, pay: 5, guarded: 0.3, life: 300 }`**
  - **`createTreasure({ at, rand }) → { at, guarded, phase, step(dt, { you }) → events }`**: `'reached'` (and `'guards'` when guarded), then `'opened'` with `{ pay: TREASURE.pay }`; past `life`, `'gone'`
  - **`followOf(id) → 'stranded' | 'treasure'`**: what a beacon thing leads to, three in five stranded, from its id's hash
- Produces: **`createSignalsPlay(deps) → Player`** with `kinds: ['stranded', 'treasure']` (Task 15 adds two). One look, made when first wanted: a beacon (a `Sprite` of a radial canvas texture, `sizeAttenuation: false`, `hot()` so the bloom takes it, blinking by scale) and a cache (a small crate from `kit.js`'s parts, `MeshStandardMaterial` in `PALETTE.grey`). Both invisible at rest.
  - **Stranded:** the beacon at `signalSpot`; a note (`EVENT.stranded`); reached, a stranded ship (a `traffic.escort` group on a 3-unit path at 0.01, so it holds nearly still past `SIGNAL.life`) and the waves (`hunters.pack(pick(side, 'pirates'), you, { prey, size: 2, ace: false })`); saved, `deed('rescued')` and `EVENT.saved`; lost, a burst.
  - **Treasure:** the beacon; reached, the cache (and a pirate pack if guarded); opened, `pay('found', 5)` and `EVENT.cache`.
  - **`follow(zone)`** (Task 10's): starts `followOf(zone.id)` at that zone's `at`. **The seam:** lane 4a's beacons ("Follow: leads to an event"). If 4a's beacon action hands its row to a callback or emits an event, this task passes it to `events.follow`. If 4a left no hook, the beacons stay 4a's to wire, and `HANDOFF-NOTES.md` says so.
  - Forced with no room ahead, `start` puts the beacon at 600 straight ahead, or returns false with nothing registered if that is inside a solid.

- [ ] **Step 1: Write the failing tests.** `signals.test.js`:
  - `signalSpot` over 50 seeded level and pitched ships lies 600 to 1,500 off, within the cone, and clear of a solid passed in
  - a stranded call reached by a ship 30 off emits `'reached'`, then `'wave'` 1; with `cleared` it emits `'wave'` 2 twenty seconds on; with both cleared, `'saved'`
  - with three pirates on it, the hull is gone in `1 / (3 × 0.012)` seconds, to 0.1 s, and `'lost'` comes once
  - unreached for 300 s, `'gone'`
  - a treasure reached emits `'opened'` with `pay: 5`; 30 % of 1,000 seeded ones are guarded (±4 %)
  - `followOf` is the same for an id every time, and about three in five of 1,000 ids are `'stranded'`

  `playSignals.test.js`, with fakes: a started stranded call registers `{ kind: 'stranded', big: true }`, packs pirates after the stranded ship on reaching it, and calls `deed('rescued')` once when saved; a treasure opened calls `pay('found', 5)` once; `clear()` hides the beacon and the cache and empties `running()`; the meshes are invisible before any start.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/events/signals.test.js src/components/universe/events/playSignals.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement**, add the player to `players`, and give `prepare` (`warm`) each mesh when it's made.
- [ ] **Step 4: Run them and see them pass.** Run `npm test`, then `node scripts/universe-endless-check.mjs --quality mid --only events:stranded,treasure`. Expected: PASS, two shots.
- [ ] **Step 5: Commit.** `git commit -m "A distress beacon to answer and a signal to follow, each with something at the end of it"`

### Task 15: A wormhole opens, and a trader hails you

**Files:**
- Modify: `src/components/universe/events/signals.js`, `signals.test.js`, `playSignals.js`, `playSignals.test.js`, `src/components/universe/setpieces.js:409-432` (`rift(ship, { solids, life, r, exit })`, defaults today's)
- Modify `scene.js`: `riftThrough` (`:4210`) asks `events.riftExit(s)` first, which gives the wormhole's far exit while one is the open rift (0)

**Interfaces:**
- Consumes: lane 2's `clearOfKeepOuts`, `keepOutsNear` (through lane 3's face), `sectorCentre`, `sectorKey`; lane 3's `places`; `NPCS`, `visitorsOf` (`npcs/index.js`); `npcs.add`; `npcWorld.stations`.
- Produces, in `signals.js`:
  - **`WORMHOLE = { life: 60, r: 12, ahead: [120, 220], far: [8, 40] }`**
  - **`wormholeExit(from, rand) → { sector: [sx, sy, sz], at: [x, y, z] }`**: a direction in 3D, 8 to 40 sectors on, at that sector's centre plus up to 20,000 aside, clear of its keep-outs
  - **`TRADER = { near: 30000, beside: 14 }`**
  - **`traderPlan({ side, zones, ship }) → { npc, station, at } | null`**: the side's merchant visitor (`'merchant'` brain), the nearest station zone within `TRADER.near`, and a spot `beside` you to one side; null with no merchant or no station
- Produces, in `playSignals.js`, `kinds` gains `'wormhole'` and `'trader'`:
  - **Wormhole:** `pieces.rift(ship, { solids, life: 60, r: WORMHOLE.r, exit: wormholeExit(...) })`, the rift's own mesh larger and open a minute. Flown into, it throws you one way to the exit: `arriveAt` there (the hunters left behind, as the rift does), `EVENT.thrown(sectorKey(...))`, and `cameFrom = { at, sector }` kept for the map (`where().cameFrom`, +1 in `scene.js`'s `where()`, for lane 6b). Not flown into, it closes.
  - **Trader:** `npcs.add(NPCS[npc], at)` (the merchant comes alongside and says its existing `offer` line), the station added to `npcWorld.stations` so the merchant heads there, the station picked (`pick(station.id)`, so J goes there) and `EVENT.trader(name, station.name)`. Arriving by the trip docks you there (lane 3), which opens the Hangar's shop (lane 3's `'dock'` event with `open: true`). With no station near, forced: a note, false, nothing left.

- [ ] **Step 1: Write the failing tests.**
  - `signals.test.js`: `wormholeExit` from 20 seeded points is 8 to 40 sectors off by Chebyshev distance, in every octant over 200 tries, and clear of its keep-outs; `traderPlan` gives Lando for Star Wars near `E:1,0`'s first station, Saul for Breaking Bad, null for Rick and Morty (no merchant) and null 40,000 from any station.
  - `playSignals.test.js`: a wormhole calls `pieces.rift` with `life: 60`; flying into it calls `arriveAt` at the exit and sets `cameFrom`; a trader calls `npcs.add` with the merchant, `pick` with the station's id, and adds the station to the world's stations; forced with no station, it returns false and registers nothing.
  - `setpieces.test.js` (if absent, in `playSignals.test.js` against the real set pieces in Node): `rift(ship)` keeps today's life and size; `rift(ship, { life: 60, r: 12 })` holds open 60 s.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/events`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement and wire.**
- [ ] **Step 4: Run them and see them pass.** Run `npm test`, then `node scripts/universe-endless-check.mjs --quality mid --only events:wormhole,trader`. Expected: PASS. The trader's run travels to the station and waits until lane 3's `__universe().docked` is the station's id.
- [ ] **Step 5: Commit.** `git commit -m "A wormhole that stays open a minute and throws you far, and a trader who hails you to a station's shop"`

### Task 16: Pulled out of a jump, and a smuggler chase

**Files:**
- Create: `src/components/universe/events/fights.js`, `fights.test.js`, `src/components/universe/events/playFights.js`, `playFights.test.js`
- Modify `scene.js`: the jump's way out (lane 3's `const park = outOfJump(j);`, at `:4350` on `main`) becomes `const park = events.outOfJump(j, outOfJump(j));` (0)

**Interfaces:**
- Consumes: Task 5's `frameOf`, `laneNear`; Task 3's `director.allows`, `noted`; `hunters.pack`; `traffic` (a runner); `side.police`, `pick(side, 'pirates')`.
- Produces, in `fights.js`:
  - **`WAYLAY = { short: [0.25, 0.6], least: 1500, base: 0.08, pirates: 0.3 }`**
  - **`waylayChance({ hazard, heat, arriving, calm }) → number`**: `base` (or `pirates` in a pirate system), times `1 + min(heat, 6) / 6`; 0 while arriving or calm
  - **`waylayPark(from, park, rand, solids = []) → { x, y, z, heading } | null`**: on the line from `from` to the park, short of it by `short` of the way and at least `least` from it, heading on toward it, clear of every solid by 40; null for a jump shorter than `3 × least`
  - **`SMUGGLER = { ahead: [70, 120], speed: 1.8, police: [2, 3], away: 900 }`**
  - **`smugglerLane(ship, rand, solids) → pts | null`**: `laneNear`'s shape four times as long, so the runner crosses well ahead and keeps going
  - **`smugglerEnd({ runner, police }) → 'caught' | 'escaped' | null`**: `runner` is `'alive' | 'down' | 'away'`, `police` how many are left. Down: caught. Away (past `SMUGGLER.away` from its start) or no police left: escaped.
- Produces: **`createFightsPlay(deps) → Player`** with `kinds: ['waylay', 'smuggler']` (Task 17 adds `'derelict'`), **`outOfJump(j, park) → park`** (Task 10's `events.outOfJump` calls it), and `events.debug.markJump()`, which marks the next jump for the check:
  - **At the spool** (Task 10's `step` sees `state.jump.phase === 'spool'`), it rolls `waylayChance` once per jump, and marks the jump if the roll hits and `director.allows('waylay', …)`. Never for a pilot's id, a portal leg (`state.then`) or a jump in the arrival's minute.
  - **`outOfJump`** of a marked jump gives `waylayPark(...)` or, when that's null, the park unchanged. It sets lane 3's `state.arrived` to null, so no dock opens; packs the side's pirates ahead, interdicting (`{ ahead: true, interdict: true, size: 3..4 }`); notes `EVENT.waylaid`; and calls `director.noted('waylay')`.
  - **Forced** with no jump going: the jump's flash where you are (`crashFx.arrive`), interdicted, the pirates ahead.
  - **The smuggler:** a runner (the side's `civil` kind, flown by `traffic.escort` on `smugglerLane` at `SMUGGLER.speed` × its speed) and the police after it (`hunters.pack(side.police.faction, ship, { prey: runner, size: 2..3, ace: false })`). The runner shot down by you: `deed('killPirate')`. The police you shoot are crimes as any are (the law's own handling). It ends at `smugglerEnd`. `EVENT.smuggler` as it starts.

- [ ] **Step 1: Write the failing tests.** `fights.test.js`:
  - `waylayPark` for a 10,000 jump lands 2,500 to 6,000 short (and at least 1,500), on the line, heading toward the park; for a 4,000 jump, null; with a solid on the line where it would land, it moves along the line clear of it or is null
  - `waylayChance` is 0 while arriving or calm, 0.3 in a pirate system with no heat, and rises with heat to twice that at 6
  - `smugglerLane` lies ahead along the 3D nose and clears a solid passed
  - `smugglerEnd` for each case

  `playFights.test.js`, with fakes: a marked jump's `outOfJump` returns a park short of the original, sets `state.arrived` to null, packs pirates interdicting, and calls `noted('waylay')`; a jump to `'pilot:abc'` or with `state.then` set is never marked; with `director.arriving` it's never marked; a smuggler start packs the police with the runner as prey.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/events/fights.test.js src/components/universe/events/playFights.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement and wire.**
- [ ] **Step 4: Run them and see them pass.** Run `npm test`, then `node scripts/universe-endless-check.mjs --quality mid --only events:waylay,smuggler`. Expected: PASS. The waylay run starts a 20,000 jump with the next jump marked by the dev hook (`events.debug.markJump()`), and waits until `__universe().interdicted` and the ship is short of the park.
- [ ] **Step 5: Commit.** `git commit -m "Pirates pull you out of a jump, and the law chases a runner you can help or stop"`

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
- [ ] **Step 4: Run them and see them pass.** Run `npm test`, then `node scripts/universe-endless-check.mjs --quality mid --only events:battle,derelict`. Expected: PASS, two shots.
- [ ] **Step 5: Commit.** `git commit -m "Two sides fight and you pick one, and a derelict wakes and turns its guns on you"`

### Task 18: An ion storm front, a comet's close pass, and a tidal pull

**Files:**
- Create: `src/components/universe/events/sweeps.js`, `sweeps.test.js`, `src/components/universe/events/playSweeps.js`, `playSweeps.test.js`
- Modify: `src/components/universe/setpieces.js:434-444` (`comet(ship, { pass })`: a close path when given, today's crossing without), `src/components/universe/meteors.js:61-110` (`storm(ship, rand, solids, { lane, look })`: `look: 'ice'` a pale ice material, today's rock without)
- Modify `scene.js`: the Maw's pull (`:4418`) becomes `const g = pullAt(stepped.x, stepped.y, stepped.z) ?? events.pull(stepped);` (0)

**Interfaces:**
- Consumes: Task 5's `frameOf`; Task 2's black-hole zones; `hurt`, `state.static`, `state.flare`.
- Produces, in `sweeps.js`:
  - **`STORM = { width: 3000, depth: 240, speed: [25, 45], ahead: 900, drain: 6, static: 1.2 }`**
  - **`stormFront(ship, rand) → { at, n, side, speed, width, depth }`**: its middle `ahead` along the nose, sweeping across your path (`n` perpendicular to the nose, within 30° of `frameOf`'s right)
  - **`stormAt(front, s) → [x, y, z]`**, **`inStorm(front, s, p) → boolean`**, **`stormPast(front, s, p) → boolean`** (gone past `p` by twice its depth)
  - **`COMETPASS = { pass: [40, 90], speed: [30, 50], life: 30, shards: 36, damage: 4 }`**
  - **`cometPass(ship, rand, solids) → { from, vel, closest, life } | null`**: its closest approach `pass` off your path, a few seconds ahead
  - **`iceLane(pass) → [from, to]`**: the shower's lane, along the comet's path through its closest point
  - **`TIDAL = { range: 6, surge: 2.2, pull: 40, debris: 24 }`**
  - **`tidalPull(hole, p, k = 1) → { v: [vx, vy, vz], k } | null`**: toward the hole, `pull × k × (reach / d)²`, none past `range × reach`; shaped as `pullAt`'s answer
  - **`holeFor(zones, p) → Zone | null`**: the nearest black hole within `range` of its reaches
- Produces: **`createSweepsPlay(deps) → Player`** with `kinds: ['stormfront', 'cometpass', 'tidal']` and `pull(ship)`:
  - **Storm front:** one large `Mesh` (a thin box `width × depth`) of an additive `MeshBasicMaterial` wearing a streaked canvas texture that scrolls (no shader), with brief flashes. Inside it, the shields drain `drain` a second (`hurt`, past the scene's shield regen) and the HUD scrambles (`state.static`); `EVENT.storm` the first time you're in it.
  - **Comet fly-by:** `pieces.comet(ship, { pass })`, then the ice shower, `meteors.storm(ship, rand, solids, { lane: iceLane(pass), look: 'ice' })`, its shards hitting as rocks do.
  - **Tidal pull:** near a black hole (the Maw, or 4a's), for its `lasts`, `pull(ship)` gives `tidalPull(hole, ship, TIDAL.surge)`. The meteors' rocks are dragged in along lanes ending in it, and a traffic group is pulled in, shrinking as a docking one does (`dock: 'in'`). `EVENT.tidal`. Forced far from any black hole: a note and false (the check teleports to the Maw first: `spotFor('tidal')`).

- [ ] **Step 1: Write the failing tests.** `sweeps.test.js`:
  - a storm front starts 900 ahead along the nose; a ship flying on at cruise is inside it for `depth / speed` seconds or so, then `stormPast`
  - `inStorm` is false past `width / 2` to the side
  - a comet pass's closest point is 40 to 90 off a level ship's path and ahead; `iceLane` passes within 1 of it
  - `tidalPull` points at the hole, its size at `2 × reach` is a quarter of that at `reach`, and it is null past `6 × reach`
  - `holeFor` finds the Maw from 3 of its reaches off and not from 7

  `playSweeps.test.js`, with fakes: inside the storm's slab for 1 s, `hurt` gets about 6; a comet pass calls `pieces.comet` with a `pass` and `meteors.storm` with `look: 'ice'`; a tidal start at the Maw gives a non-null `pull` for a ship 3 reaches off, and a forced one 100,000 away returns false with nothing registered. The storm's mesh is invisible before a start.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/events/sweeps.test.js src/components/universe/events/playSweeps.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement and wire.**
- [ ] **Step 4: Run them and see them pass.** Run `npm test`, then `node scripts/universe-endless-check.mjs --quality mid --only events:stormfront,cometpass,tidal`. Expected: PASS, three shots.
- [ ] **Step 5: Commit.** `git commit -m "An ion storm front sweeps across your path, a comet passes close in a shower of ice, and a black hole's pull takes what's near"`

### Task 19: A leviathan migration, and a bloom of glowing things

**Files:**
- Create: `src/components/universe/events/herds.js`, `herds.test.js`, `src/components/universe/events/playHerds.js`, `playHerds.test.js`
- Modify: `src/components/universe/leviathans.js` (export `purrgilBody()`, the merged body its pod already builds, so a herd can be one `InstancedMesh`)

**Interfaces:**
- Consumes: Task 5's `frameOf`.
- Produces, in `herds.js`:
  - **`MIGRATION = { n: [10, 18], scale: [20, 40], far: [2500, 6000], speed: [30, 60], span: 9000 }`**
  - **`migrationPath(ship, rand) → { from, to, n, scale, speed, seed }`**: a straight crossing in 3D, `far` off the nose's line, `span` long, across your view
  - **`herdAt(path, s, i, out) → out`**: member `i`, `s` seconds on, in a loose wedge behind the lead with a slow bob; **`herdPast(path, s) → boolean`**
  - **`BLOOM = { n: [40, 90], spread: 160, ahead: [140, 280], drift: 0.6, life: 60 }`**
  - **`bloomPlan(ship, rand, solids) → { at, n, seed } | null`**, **`jellyAt(plan, i, s, out) → out`**: round its middle, each with its own slow drift and pulse
- Produces: **`createHerdsPlay(deps) → Player`** with `kinds: ['migration', 'bloom']`:
  - **Migration:** one `InstancedMesh` of `purrgilBody()` (its two materials, so two meshes at most), at most 18 instances at 20 to 40 times a purrgil's length: gargantuan-sized, the universe's wildlife whoever you fly with. `EVENT.migration`.
  - **Bloom:** one `InstancedMesh` of a small dome (`SphereGeometry`'s top half) in an additive `MeshBasicMaterial`, `hot()` cyan to violet, pulsing by scale; half as many on `small`. It's weighted twice inside a nebula zone. `EVENT.bloom`.
  - Both invisible at rest, made when first wanted, given to `prepare` once.

- [ ] **Step 1: Write the failing tests.** `herds.test.js`: a migration path's nearest point to a level ship is 2,500 to 6,000 off; every member stays within `5 × scale` of the lead's line; `herdPast` holds once the lead is beyond the far end; a bloom's jellies stay within `spread` of its middle for 60 s and never inside a solid passed. `playHerds.test.js`: a migration's mesh shows `n` instances, then none and invisible once past; `small` halves the bloom's count; nothing is visible before a start; `clear()` hides both.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/events/herds.test.js src/components/universe/events/playHerds.test.js src/components/universe/leviathans.test.js`. Expected: the new tests FAIL; `leviathans.test.js` passes.
- [ ] **Step 3: Implement and wire.**
- [ ] **Step 4: Run them and see them pass.** Run `npm test`, then `node scripts/universe-endless-check.mjs --quality mid --only events:migration,bloom`. Expected: PASS, two shots.
- [ ] **Step 5: Commit.** `git commit -m "A herd of leviathans migrates across the sky, and a bloom of glowing things drifts by"`

### Task 20: Every event forced, the gentle minute, the full measure, and the hand-off notes

**Files:**
- Modify: `scripts/universe-endless-check.mjs` (the `arrival` step; `events` with no list runs every kind), `docs/superpowers/evidence/endless-universe-lane-4b/README.md`
- Create: `docs/superpowers/evidence/endless-universe-lane-4b/HANDOFF-NOTES.md`

**Interfaces:**
- Consumes: everything above.
- Produces: the lane's numbers and the hand-off.

- [ ] **Step 1: Pin the count.** In `sceneEvents.test.js`, a new `it`: `events.debug.kinds()` (all players in) is the 30 ids of `EVENTS`, each played by exactly one player.
- [ ] **Step 2: Add the `arrival` step.** Reload with no start link and no saved place (a fresh context): wait until the ship flies, then until the director's first event of the visit (`events.debug.running()` or the director's last) by the scene's clock; it must come before 60 s of that clock and be gentle and not big. Shoot it, `arrival.jpg`.
- [ ] **Step 3: The sweep, whole.** Run `node scripts/universe-endless-check.mjs --quality mid` and then `--quality low`: every step of lanes 2, 3, 4a and this lane, with `events` forcing all 30 kinds. Expected: exit 0 both times, 31 shots (30 events and the arrival), no console errors. Copy the per-step table into the README.
- [ ] **Step 4: The full measure, once.** Run these in the background, each with `CHROMIUM=/opt/pw-browsers/chromium` in front, and wait on their exits:
  - `node scripts/universe-check.mjs --quality high --out lab/universe/after-4b/high`, then the same for `mid` and `low` (three runs: `universe-check.mjs` ignores `--out` when more than one tier runs, `:53`)
  - `--quality <tier> --poses old-rim,above-core,expanse-system,expanse-station --out lab/universe/endless/<tier>`, once a tier, all four in one run (lane 3's finding: a run writes only the poses it measured)
  - `QUALITY=mid node scripts/perf-probe.mjs universe` and `QUALITY=low …`, against Task 9's before

  Expected:
  - **Draw calls and triangles:** at every pose in `lab/universe/baseline/<tier>.json` and lane 3's endless baselines, no higher. No event draws at a held pose (`events.clear()` in `holdPose`). If `expanse-system` or `expanse-station` rises, it's traffic flying the system's ports where today's crossed the open: name the number, and hold port-lane groups to the poses' old count if it's over.
  - **Frame time:** p50 no worse than 2 %.
  - **Pixels:** `scripts/pixel-measure.mjs` against `before-4b/mid` gives identical shots at the hand-made poses.
- [ ] **Step 5: The repo's checks.** Start the dev server, then run `CHROME=/opt/pw-browsers/chromium node scripts/events-check.mjs rv` and `… falcon`, `navmap-check.mjs`, `flyto-check.mjs --fake` and `links-check.mjs`; stop the server; run `CHROMIUM=/opt/pw-browsers/chromium node scripts/autopilot-check.mjs --only smoke --skip lint,test,build --routes /universe`. Expected: each as before Task 9 (events-check's two software-GL timeouts are `main`'s).
- [ ] **Step 6: Write the README and the hand-off notes.**
  - **README:** before and after side by side; calls and triangles per pose and tier; frame times; the life step's five times to something moving; `scene.js`'s count at each task; `glsl-sites`, `big-files`, `boundary-breaks` and `cycles` before and after.
  - **`HANDOFF-NOTES.md`, "Landed":** every module above by path with its interface in a line; the 30 events and which player plays each; the `life`, `fights`, `events` and `arrival` steps.
  - **`HANDOFF-NOTES.md`, "Left":**
    - Lane 4c calls `events.arrive()` from its arrival (and may drop Task 10's spawn line).
    - Lane 6b draws `where().events`, `where().farFights`' heights, `where().holder` and `where().cameFrom`.
    - 4a's beacons and `events.follow`, as Task 14 found them.
    - The remover at generated planets (finding 4).
    - Any finding from the measure.
- [ ] **Step 7: Run the gates and commit.** Run `npm run lint`, `npm test`, `npm run build` and `node scripts/health.mjs --check --skip build`. Expected: all green, within budget. Then `git add -A lab/universe/after-4b lab/universe/endless docs/superpowers/evidence/endless-universe-lane-4b scripts/universe-endless-check.mjs src/components/universe/events && git commit -m "Lane 4b measured at every tier, every event forced and shot, and its hand-off notes"`

---

## What later lanes consume

| Name | From | Used by |
|---|---|---|
| `events.arrive()` (the director's `arrive(seconds = 60)`), `ARRIVAL`, `director.arriving`, the `gentle` column | `events/sceneEvents.js`, `director.js` | 4c (the arrival's gentle minute) |
| `where().events` (`[{ id, kind, name, x, y, z, big }]`), `where().holder` (`{ id, name, side }`), `where().cameFrom` (`{ at, sector }`), `where().farFights` with `y` and `Fighting near <system>` | `scene.js`'s `where()` | 6b (events in progress, whose space, the wormhole's mark, fights in 3D) |
| `holderOf`, `createHere`, `HOLDERS`, `HERE`; `sideAt(crew, sector, holder)`, `crewAt(…, holder)`, `lawAt(crew, holder)` | `events/holder.js`, `sides.js` | 4c (whose space the arrival is in), 6b (the chart's holder) |
| `zonesAround`, `systemAt`, `nearestOf`, `whereFor`, `WHAT_OF`, `EXTRA_WHAT`, `Zone` | `events/zones.js` | 4a (a new kind gets a `WHAT_OF` row), 6b |
| `trafficHere`, `LIFE`, `PORTS`; `portLane`, `frameOf` | `events/life.js`, `lanes.js` | 4c (traffic crossing the arrival), 4a (a new port kind) |
| `fightOf`, `fightsAround`, `fightNode`, `FIGHTS_OUT`; `fightLabel(at, near)` | `events/fightsOut.js`, `farFights.js` | 6b |
| `events.follow(zone)`, `followOf(id)` | `sceneEvents.js`, `signals.js` | 4a (a beacon's "Follow") |
| `wormholeExit(from, rand)` | `signals.js` | 4a (a wormhole thing's one-way throw, if it wants the same rule) |
| `events.debug` (`kinds`, `running`, `here`, `zones`, `spotFor`, `clear`, `markJump`), `__universeDebug.happen(kind, { … })` | `sceneEvents.js` | every later lane's checks |
| the `Player` contract | Global Constraints | any later event |
| `readPack(data, from)`, `PACK_NEAR` | `online/protocol.js` | 6b (other pilots' hunters on the chart) |
| the `life`, `fights`, `events[:kinds]` and `arrival` steps | `scripts/universe-endless-check.mjs` | every later lane |

## Assumptions about unmerged work

Each of these can be checked once lanes 2, 3 and 4a have merged.

1. Lane 2's sector shape is as its plan's Task 6 gives it: `systems` (with `reach`, `faction`, `traffic`, `hazard`, `seed`, `name`), `things` (`count`, `kind` indexing `THING_KINDS`, `at` from `origin`, `size`), `extras` keyed by list, `origin`. `expanse.sectors()` is a `Map` of the loaded 27 (its Task 20).
2. Lane 2's `universeBudget({ tier, detail }, step, floor)` has `traffic` (2, 4, 6, 8) and `events` (1, 2, 3, 3), and `traffic` is among the fields the steps multiply (its Task 12). `events` isn't stepped there; this lane reads it as given.
3. Lane 2's `expanse.stars()` holds lighting's `STARS` and the built stars, each `{ id, at, r, colour, strength, reach }`, and `scene.js` passes it to `lightAt` (its Task 17), so `litBy.key.id` can name a generated star.
4. Lane 2's `__universeDebug.teleport(x, y, z, heading, pitch)` and the endless check's recorder and `--only` exist (its Task 22; lane 3 adds `--only`).
5. Lane 3's face `expanse/shared/space.js` lends `UNIVERSE`, `universeOf`, `fullSector`, `THING_KINDS`, `SECTOR_EXTRAS`, `rngOf`, `hash64`, `orbitAt`, `clearOfKeepOuts` and `keepOutsNear`. If any isn't lent, this lane adds it to the face (a re-export and its line in `shared.test.js`), never an import past it.
6. Lane 3's `fullSector(…).stations` rows are `{ id, i, system, at, size, name }` (its Task 1), `places.docked()`, `places.park(id, from)` and `places.solids()` exist (its Task 12), and `solidsNow` includes `places.solids()` and `expanse.solids()`.
7. Lane 3's `trips.outOfJump(j) → park` sets `state.arrived = { id: j.id }`, and the scene's jump arrival reads `const park = outOfJump(j);` (its Task 11). Task 16 wraps that call.
8. Lane 3's dock opens the Hangar on its shipyard tab when an `arrived` object names the station (its Tasks 12 and 14). The trader relies on it.
9. Lane 4a's things that this lane reads (derelicts, black-hole gargantuans, beacons, rigs, shipyards, fleets) are rows of `THING_KINDS` or `SECTOR_EXTRAS` with a `kind` name, as lane 2's hook says. If 4a draws a kind through `drawers` only, with no row, Task 2's test can't see it, and that's a finding for the coordinator.
10. Neither lane 2 nor lane 3 nor 4a changes `director.js`, `traffic.js`, `hunters.js` or `farFights.js` (lane 2's and lane 3's plans both list them as not touched).
11. Lane 2's PR 2.2 is on `main`: `readPose` clamps heights to `±SEC_FAR`, and nothing else in `online/` clamps a hunter's height but `readPack` (`:335`). Checked at `cc5e2eaf`.
12. `scene.js`'s blocks this lane moves (`happen` at `:3427-3561`, the escort and eclipse at `:1100-1119` and `:3933-3979`, the director at `:3984-3994`, the far fights at `:3754-3814`) aren't moved by lanes 2, 3 or 4a. Lane 3 moves the travel block (`:1769-1905`) and nothing of these.

## Findings for the coordinator (spec against code)

1. **Three of the spec's "new" events exist already.** The director has a `distress` (someone crossing your bows with pirates on them), a `comet` (crossing the sky well away) and a `supernova` whose shell already spreads over the better part of a minute (`supernova.js:1-9`). This lane keeps all three and counts them among today's. The spec's distress call becomes `stranded` (a ship to reach, defend and be paid for), its comet fly-by becomes `cometpass` (a close pass with a shower of ice), and its supernova is today's one working out there. To keep thirteen new, the swap is a bloom of glowing things (catalogue 22's "drifting swarms and glowing jellyfish", as an event). The spec allows the swap and keeps the count: 30 kinds in all.
2. **"The convoy spawns nothing of its own"** (HANDOFF-universe's "Left") is half true. `traffic.convoy` (`traffic.js:529-540`) already flies a column with escorts, but on a 100-unit lane past you, and only when `convoyLane` finds room, with no slot of its own when `MAX` groups fly. Task 11 gives it a port-to-port column and a slot of its own.
3. **No ceiling in the hunters.** Lane 2's finding pointed at `hunterRules.js:240`, which is a comment ("the lift near the ceiling"). No hunter, character or wingman clamps a height. What was flat was where they come from: `entryPoint` and every lane read only `heading`, so a ship climbing straight up met packs and traffic in the level plane. Task 5 makes them follow the 3D nose and pins the level case to today's numbers.
4. **The remover stays at the hand-made planets.** "Over the planet you're at" removes it for a minute. A generated planet would need lane 2's built system to hide and restore one planet, which it doesn't offer, and the spec doesn't list the remover among the events that must work out there.
5. **Whose law, out there.** The spec says hunters and the law read the system's faction. Today's law is always the crew's own (`scene.js:1016`). This lane makes it the holder's (`lawAt`): the Empire's in an Empire system, none in an independent one, and the crew's in a faction of its own (which has no ships of its own to send). `wanted.side` drops your stars when the side changes (`wanted.js:108-117`), so leaving a system for lawless space clears your stars and keeps your bounty, held per side. That is a design call, pinned with hysteresis so it can't flicker.
6. **A generated faction has no ships.** Factions of their own (`'<sector>:f<k>'`) have names but no hunter kinds, police or models. Their space flies the crew's side's ships and law, as today. Original craft for them would be a lane of its own (new props, the owner's rule).
7. **"Something moves within 20 seconds"** already holds in the open: today's traffic crosses the space round you within a couple of seconds of `nextAt = 1.5` (`traffic.js:168`, `:373`). Task 12's `life` step proves it at five places, by the scene's clock.
8. **The budget's `events` field isn't stepped** in lane 2's plan (`discs`, `thingsNear` and `traffic` are). This lane reads `events` as the tier gives it, and a low tier is 1 already.
9. **`glsl-sites` has six left** (613 of 619) for lanes 1, 2, 4a and 4b together. This lane uses none: its looks are plain materials, the rift's mesh and the comet's.
10. **A waylaid jump and lane 3's arrival.** A jump cut short isn't an arrival, so Task 16 sets `state.arrived` to null, or lane 3 would treat the place you didn't reach as reached (and a station's dock would open the Hangar).

## Spec coverage

- **Section C, "Events: at least 15 kinds, everywhere":**
  - generated zones for the director: Tasks 2 and 10
  - the existing events working out there (flare, meteor stream, leviathans, minefield, escort, eclipse, rift, convoy with its own column, bounties): Task 11; far fights: Tasks 7 and 13
  - the new ones: Tasks 14–19 (finding 1 for the three that existed and the swap)
- **Section C, "Event pacing":**
  - three different events in 10 minutes, from 100 seeded starts: Task 4
  - two big events never together: Tasks 3, 4 and 10
  - the arrival's first minute gentle: Task 3 (the rule), Task 10 (wired at a new pilot's spawn), Task 20 (in the browser); lane 4c calls it from its arrival
  - every event forced with `__universeDebug.happen(kind)`: Tasks 10 and 20 (all 30 forced and shot)
- **Section B, "Places with life":**
  - traffic from the nearest system's density and faction, between its stations, rigs, shipyards and fleets: Tasks 6 and 12
  - hunters and the law read the faction: Tasks 1 and 13
  - far fights in generated sectors, in every direction: Tasks 7 and 13
- **Done item 2, "Something moves within 20 seconds of flying anywhere":** Task 12's `life` step.
- **Done item 3, events:** at least 15 kinds (30, Task 3); three different in 10 minutes (Task 4); every event forced by a dev hook (Task 20). The 20 kinds of thing are lane 4a's.
- **Done item 8, "a gentle event"** in the first minute: Task 3's rule and Task 10's hook; the arrival itself is lane 4c's.
- **Done item 9, "Nothing is lost":** every existing test untouched but the one bound Task 8 replaces; Task 9 pins `happen` before moving it; Task 5 pins every level lane; Task 20 reruns the repo's checks.
- **Done item 10, "Phones still fly":** the events cap by tier (Task 10), the traffic cap by tier and step (Task 12), every event mesh made when first wanted and invisible at rest, no new shader, and the low-tier measure (Task 20).
- **Lane 2's hand-on:** hunters' heights (Task 5, finding 3) and `readPack`'s ±90,000 (Task 8).

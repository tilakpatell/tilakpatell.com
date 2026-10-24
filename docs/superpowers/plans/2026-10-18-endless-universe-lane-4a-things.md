# Endless universe, lane 4a: Things in space and gargantuans. Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Space holds more than planets. Section B's catalogue of 23 kinds of thing is generated from each sector's seed, and each kind has a name, a card, a parking spot, a look drawn instanced or as an impostor, and its action through the site's existing earning, standing, guns and hangar. Section C's gargantuans sit at most one a sector and at least one in every 3 × 3 × 3, drawn in the world at their true angular size: an impostor far off, a mesh near.

**Architecture:**
- **Pure first (PR group 4a.1).** The generator's tables grow, and lane 2's two layers learn to read them.
  - `expanse/gen/catalogue.js` holds the 23 catalogue entries and the 32 kinds they're drawn as. For each kind it gives the look, what's solid and where it may go.
  - `THING_KINDS`, the lattice, gains four kinds that stay put: outposts, beacons, relays and monoliths.
  - `SECTOR_EXTRAS` (now in `expanse/gen/extras/index.js`) gains sixteen lists:
    - eleven out between the systems, at ids `w3` to `w45`
    - five round systems and stations, at `w20000` and up
    - every row plain data, so it crosses to the worker
  - `expanse/gen/paths.js` moves comets, storms, herds and swarms on the shared clock.
  - `expanse/gen/gargantuans.js` puts a gargantuan in every sector whose coordinates match the universe's three residues mod 3. That is exactly one in every 3 × 3 × 3, and never the core.
  - Lane 2's near and far layers take a lattice thing's or list row's look, solid and disc from the catalogue, at where it is now (Task 4), before any list has a row. Legacy wonders keep lane 2's own.
  - Each kind's card and words go in with its rows, through lane 3's `THING_CARDS` and `PLACE`. Lane 3's resolver, parking, picking and tags take every kind. The one change to lane 3's rules is in `around.js`, so that what's listed stays what's drawn: its cap counts what the disc layer draws (Task 4), a kind drawn with no disc (a field, a cloud, a gargantuan) is listed by its card's own `far` outside the cap, as moons and stations are, and a binary's companions take their places in the cap as their discs do in the pick (Task 6).
- **Drawn (PR group 4a.2).**
  - A drawer for each kind through lane 2's `drawers` hook: instanced, shared geometry, the palette's tints.
  - Nebula pockets and supernova remnants through lane 1's one nebula renderer.
  - Gargantuans' impostors are extra instances of the landmark draw, in a slot the Curve's sun leaves free in the main sector, so a baseline pose gains no draw call and no triangle. Their meshes are built near and fade in through what each material really draws with: a `uFade` uniform in the black hole's shaders, `opacity` on the stock materials.
  - The Maw's look moves out of `deepspace.js`, so a generated black hole wears it.
- **What you can do (PR group 4a.3).** Pure rules (`universe/things/rules.js`) say what each thing does: ore, salvage, scans, hails, signals, tails, storms, beams and wormholes. `universe/things/index.js` plays them in the scene. Dev hooks force every kind and every gargantuan form, and the endless check visits each.
- **Three PR groups on the one branch.** The coordinator merges every lane, so this plan opens no pull request. Its tasks end in commits.
  - 4a.1 (Tasks 1–11): only the far layer's specks change. The lattice's new mix (Task 3), the core's fields, comets and rigs (Task 5) and the companions of binary and trinary suns (Task 6) show as discs. Each is a point of farStars' one `Points`, so a baseline pose gains no call and no triangle. Task 1's Step 0 takes the before; Task 11's gate compares.
  - 4a.2 (Tasks 12–22): pictures change; the baseline poses keep their calls and triangles.
  - 4a.3 (Tasks 23–25): the actions, the checks and the hand-off.

**Tech Stack:**
- React 19
- three.js 0.186 on the GLSL path (`universe/module.js` is `'glsl'`)
- Vitest
- the Playwright check scripts under `scripts/`

**Spec:** `docs/superpowers/specs/2026-10-18-endless-universe-design.md`. This lane is:
- section B's catalogue and density targets, and "every one has a name, a card and a parking spot, and shows on the map" for its kinds. The drawing on the map is lane 6b's, from what this lane hands it.
- section C's gargantuans. The arrival's gargantuan is lane 4c's, through this lane's hook.
- section H's `thingKinds` and `gargantuan` rows, and the poses "at a gargantuan" and "in an asteroid field"
- done item 3's kinds of thing (not its events), and a dev hook that forces each one
- done item 5's last bullet, for gargantuans
- the endless check's "reaches a gargantuan", and its sweep of every kind

The index plan is `docs/superpowers/plans/2026-10-18-endless-universe.md`. Lane 2's plan (`…-lane-2-one-space.md`, "What later lanes consume") and lane 3's (`…-lane-3-places.md`, "What later lanes consume") are this lane's inputs. Lane 1's renderer and landmarks are its Tasks 4 and 7.

**Depends on:** lanes 1, 2 (all five PRs), 3 (both groups), 5a and 6a merged on the branch. Lane 4b runs beside this one and merges after it. Nothing here waits on 4b: an event this lane triggers that 4b hasn't made yet falls back to one the director has today (Task 23).

Line numbers are from `main` at `cc5e2eaf`. Lanes 1, 2 and 3 move them, so find the code again by the quoted text. Where this plan changes another lane's file, it names the function, and the behaviour it gives wins over the plan's guess at that file's code.

## Global Constraints

**Process (HANDOFF-universe's owner's rules and the index's Global Constraints, all of them):**
- Nothing a visitor can do is lost: every key, save, route, dev hook and test works as before, and no test is loosened.
  - Two assertions in lane 2's `things.test.js` describe the starting tables this lane is told to fill: `SECTOR_EXTRAS` `toEqual([])` and "has four valid kinds". Each is replaced in the same commit by a test of what replaces it (Tasks 3 and 4), and the commit names both.
  - Lane 2's `budget.test.js` may pin its whole rows ("The table as above") with `thingKinds: {}` at every tier. If it does, each expected row gains this lane's `thingKinds` counts in Task 12's commit, which names the change: it adds to the test and loosens nothing, as lane 3 did for its `tags`.
  - Every other existing test stays as it is. New tests go in new `describe`s or new `it`s.
- Pure first:
  - `expanse/gen/*`, `universe/things/{rules,layout,cards}.js`, `universe/landmarkRules.js` and `universe/gargantuans/rules.js` import no React, no DOM and no three.js.
  - `gargantuans/rules.js` takes `landK` from `universe/landmarkRules.js` (Task 19), never from `landmarks.js`, which imports three (`landmarks.js:33`).
  - Every rule has its Node test before its drawing half.
- A changed picture is on purpose. Task 1's Step 0 takes the before shots at `--quality mid`, before any code of this lane.
- Draw calls and triangles at every pose in `lab/universe/baseline/<tier>.json` are no higher than this lane's own before (Task 1, Step 0). Say the numbers.
- Before the lane is done: `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`, and `node scripts/autopilot-check.mjs --only smoke --skip lint,test,build --routes /universe`.
- Every commit is one plain sentence in the repo's voice. Its body says why and gives the numbers, and it ends with the attribution lines the session's harness gives. This plan writes the first line only, with no model names.
- The hand-off goes in `docs/superpowers/evidence/endless-universe-lane-4a/HANDOFF-NOTES.md`, not `HANDOFF-universe.md`, which the coordinator folds. Evidence goes in that folder too, each picture under 1 MB (element shots, or JPEG at 80).

**Code shape:**
- `src/components/universe/scene.js` doesn't grow.
  - Task 21 moves the rock fields and the finding half of `rocksHit` out, about 50 lines.
  - Tasks 22 and 24 add at most 30 lines between them.
  - Each task says its `wc -l` before and after.
- New files stay under 800 lines.
- **Islands.**
  - The generator reaches the universe only through `universe/shared/space.js`, which gains `PALETTE` and `tint`.
  - The universe reaches the expanse only through lane 3's `expanse/shared/space.js`. Each name joins it in the task that first imports it from the universe side, and Task 11 pins the whole list. Lane 2's `FAR`, `FADE` and `levelWeights` (`expanse/scene/levels.js`) and `THING_NEAR` come only through it, never from `expanse/scene/*` or `expanse/gen/*` directly.
  - No cycles: `extras/*`, `gargantuans.js` and `finder.js` import `things.js` and the leaf `gen/cube.js`, never `space.js`; `things.js` imports no list (Task 4).
  - `boundary-breaks` and `cycles` don't rise. Each task's last run step is `node scripts/health.mjs --only boundary-breaks,cycles`, its two numbers equal to Task 1's Step 0 and written in the commit body.
- **GLSL.**
  - `glsl-sites` rises by one at most: `gargantuans/hole.js`'s own material helper (Task 18). The Maw's three shader strings gain a `uFade` uniform in place (`deepspaceShaders.js`), which adds no site.
  - Gargantuan impostors are new branches in the landmark material, which already exists. Every other look is `MeshStandardMaterial` or `MeshBasicMaterial`, or (a rogue world only) a body through `galaxy/bodies.js`'s `buildBody`.
  - A gargantuan's mesh fades, so every one of its materials is made `transparent` at create: three keys a program by it, and a fade must never change a program mid-flight.
  - No new `onBeforeCompile`. The rocks reuse `lib/three/rock.js`'s `rockMaterial`, as the belt does.
- **Warm-up** (lane 1's rule for its renderer, and lane 2's for its near layer):
  - Every new material is made when its drawer or renderer is made, on one hidden mesh of the kind that draws it (an `InstancedMesh`, with `instanceColor` when it uses one, since three keys a program by both), in the module's own group. The scene's start-up `prepareScene` (`scene.js:6023-6033`, `roots: [scene]`, which links hidden things too: `gpuWork.js:21`) compiles them before the map is seen.
  - Nothing of this lane calls `prepare` while it is being made. The scene's `warm` is declared at `scene.js:948`, after `createThings` (before `createExpanse`, `:772`) and `createGargantuans` (after `createLandmarks`, `:786`) run. A `prepare: (o) => warm(o)` thunk run then throws a `ReferenceError` (the `const`'s temporal dead zone), and the scene never builds. The repo says so at `:952`: "none is made before the first frame".
  - A mesh made after the first frame (a drawer's meshes when it first has something to show, a field's rocks, a rogue's body, a gargantuan's mesh built near) goes through `prepare(mesh)` once, from the `update` that first has it, never from a factory or a constructor, and is shown when that resolves.
- **One art.** Every new tint is one of `palette.js`'s nine names, through `tint(name, k)` and `hexOf`. The four lattice kinds lane 2 shipped keep their own colours (finding 6).
- Generated content is never stored. The ledgers that pay once are in memory, for the visit.
- No new dependency and no download, so `WORLD_MB['/universe']` stays as it is.

**Ids** (Task 0's `spaceId`; a wonder number names one place for good):

| Wonder numbers | What | Who |
|---|---|---|
| `w0`–`w2` | the middle layer's legacy wonders | `makeSector` |
| `w3` | the sector's gargantuan | `gargantuan` list (this lane) |
| `w4`–`w7` | the arrival's gargantuans, core only | `arrival` list, rows from lane 4c |
| `w8`–`w45` | out between the systems (table below) | this lane |
| `w46`–`w63` | kept free | |
| `w64`–`w8063` | the lattice, `THING_BASE + slot` | lane 2 |
| `w10000 + i` | system `i`'s station | lane 3 |
| `w20000 + k`, `w30000 + k`, `w40000 + k`, `w50000 + k`, `w60000 + k` | fields, comets, rigs, fleets, shipyards | this lane |

- `EXTRA_HIGH = 20000`. A high list's base is a multiple of 10,000 and its `max` is at most 9,999.
- `E:1,0:w60` and `E:1,0:w9999` stay empty, as lanes 2 and 3 test.

**Numbers the spec pins:**
- At least 20 kinds of thing. This lane keeps the spec's 23, drawn as 32 kinds.
- Every kind can be forced by a dev hook.
- Gargantuans:
  - at most one a sector, at least one in every 3 × 3 × 3
  - none within 20,000 of home except the arrival's
  - each 20 to 200 times a planet's size, and visible from across a sector
  - world-space, true angular size at every distance, an impostor far and a mesh near
  - each with a name, a card and a parking spot
- The Maw keeps its place, size, pull and its "beyond" link, and every pixel.
- The density targets are lane 2's `density.test.js`: at least three things within 9,000 and the nearest within 6,000 of 1,000 points across 27 sectors. It stays green, unchanged.
- Generation is additive: `makeSector`'s output keeps its index, type and seed (lane 2's fingerprint, unchanged).
- Inside the core: "systems, fields, derelicts and the smaller things", and no gargantuan within 20,000 of home but the arrival's.
- Actions pay through the existing earning (`economy.js`'s `EARN`, through the scene's `pay`). There is no new economy, no new `EARN` key and no new NPC conversation.

**Numbers this plan picks (each pinned by a test, so it can be tuned):**

*The lattice (`THING_KINDS`), things that stay put, every one solid at its size:*

| kind | weight | size | tint | lit |
|---|---|---|---|---|
| rock | 6 | 20–120 | `#8a8178` (lane 2's) | yes |
| ice | 2 | 15–90 | `#cfe3ee` (lane 2's) | yes |
| derelict | 1 | 30–140 | `#6d727c` (lane 2's) | yes |
| rogue | 0.4 | 100–260 | `#4a3f38` (lane 2's) | yes |
| outpost | 0.35 | 40–160 | `bone`, 0 | yes |
| beacon | 0.5 | 12–30 | `shot`, 0 | no (a lamp) |
| relay | 0.5 | 12–45 | `ink`, 0.3 | yes |
| monolith | 0.25 | 15–60 | `sky`, 0.05 | yes |

*Out between the systems (low ids; none in the core sector):*

| list | kind(s) | ids | a sector | size | moves | extent |
|---|---|---|---|---|---|---|
| `gargantuan` | `hole`, `arc`, `hulk`, `giant`, `dyson` | `w3` | 1 in a residue sector | by form | no | size |
| `arrival` | lane 4c's | `w4`–`w7` | lane 4c's rows, core only | — | no | — |
| `wormhole` | `wormhole` | `w8` | 1 | 60–140 | no | 0 |
| `remnant` | `remnant` | `w10`–`w11` | 1–2 | 2,500–6,000 | no | 0 |
| `pulsar` | `pulsar` (0.7), `magnetar` (0.3) | `w12`–`w14` | 1–3 | 40–90 | beams sweep | beam, 25 × size |
| `protostar` | `protostar` | `w15`–`w17` | 1–3 | 300–700 | no | 0 |
| `storm` | `storm` | `w18`–`w21` | 2–4 | 1,500–4,000 | loop of 0.4–1 × size, 2–6 turns a cycle | the loop |
| `pocket` | `pocket` | `w22`–`w27` | 2–6 | 1,200–3,000 | no | 0 |
| `swarm` | `swarm` | `w28`–`w36` | one in each pocket and legacy nebula, 9 at most | 80–200 | loop of 0.35 × its nebula's size, 4–12 turns a cycle | the loop |
| `herd` | `herd` | `w37`–`w39` | 1–3 | 120–300 | loop of 3,000–8,000, 2–5 turns a cycle | the loop |
| `debris` | `debris` | `w40`–`w45` | 2–6 | 300–900 | no | 0 |

*Round systems and stations (high ids):*

| list | kind(s) | base | how many | where | size | core |
|---|---|---|---|---|---|---|
| `field` | `field`, `icefield` (0.3) | 20000 | 1 system in 3 | 1.15–1.6 × its system's reach from the star, within ±300 of its height | 250–700 | yes |
| `comet` | `comet` | 30000 | 1 system in 4 | on an ellipse round the star: perihelion 1.2–2 × the star's size, aphelion 1.5–3 × the reach | nucleus 6–20 | yes |
| `rig` | `rig` | 40000 | 1 field in 3 | at its field's middle | 40–90 | yes |
| `fleet` | `fleet` | 50000 | 1 station in 2 | on its station's pole, `3 × station size + size` further out | 80–220 | no |
| `shipyard` | `shipyard` | 60000 | 1 station in 4 | over the other pole of the star, at lane 3's `poleHeight(system, size)` | 120–300 | no |

*Gargantuans (`size` is the whole extent; `body` is what's solid):*

| form | size | body and parts |
|---|---|---|
| `hole` | `body × 9…13` | `body` (the shadow) 300–650; the disc from 1.6 × body to `size` |
| `arc` | ring radius 3,000–7,500 | band 150–400 wide; span 0.5π–1.2π; solid along the band |
| `hulk` | half-length 1,200–2,800 | solid along its spine, radius 0.12 × size |
| `giant` | 1,800–3,000 | the whole sphere |
| `dyson` | shell 1,500–4,000 | the star, `body` 150–300; the swarm isn't solid |

- **A planet's size** is `PLANET_SIZE`, the weighted mean of `PLANET_TYPES`' radius midpoints: 54.04. Every form's size is between 20 and 200 times it.
- **Where a gargantuan goes.**
  - `residuesOf(universe)`: three residues mod 3 from `hash64(universe, 'gargantuans')`, never all nought. A sector holds one when `mod(sx, 3)`, `mod(sy, 3)` and `mod(sz, 3)` match them. The core sector never does.
  - Placed by up to 200 darts in the cube `CUBE_HALF − size` round the sector's middle (`CUBE_HALF` is lane 2's 56,000, moved to the leaf `gen/cube.js` in Task 4), so its whole extent stays in its own sector, where a neighbour's systems and lattice, which don't know it, can't reach. Clear of:
    - every row of `KEEP_OUTS` by `FAR + size` (45,000 + size), so its mesh is never built at a baseline pose. All 27 rows, not `keepOutsNear(sx, sy, sz)`: that keeps only the keep-outs whose sphere touches the sector's cube, and every hand-made place is within about 40,000 of home, so for four of the six face neighbours it is empty.
    - legacy systems by `reach + size + 2,000`
    - legacy wonders by `w.size + size`
    - beacons by `3,000 + size`
  - Then appended systems keep out of `{ at, r: size + 2,000 }`, and the lattice and extras keep off its solid parts (`gargantuanKeeps`). In the shared universe's core sector the same holds for each of the arrival's gargantuans (lane 4c's rows).
- **Clearances for every extra:**
  - from every row of `KEEP_OUTS` (all 27, for the reason above; lane 2's lattice keeps `ctx.outs`, which is enough for its clearances of at most 2,340) by `(THING_NEAR + 1) × size + extent`; pockets and remnants by `NEBULA_SHOW + size`, where `NEBULA_SHOW = 40000`. A swarm keeps the first rule: it is drawn near, not by the nebula renderer.
  - from a system by `reach + size + extent`; a list placed round a system skips its own system
  - from a legacy non-nebula wonder by `w.size + size`, and from a beacon by 3,000
  - from each extra placed before it, by the two sizes and extents
  - from the gargantuans' solid parts (`ctx.keeps`, Task 10), by its size and extent
  - A dart lands in the cube `CUBE_HALF − size − extent` round the sector's middle, so a row's whole extent stays in its own sector. A comet's whole path stays inside its sector's cube.
  - So no thing is built near, and no cloud is drawn, at any baseline pose. Task 8 pins it from the ten poses' own points.
- **Movers:**
  - Comets go round once in `COMET_PERIOD = 8 × ORBIT_CYCLE` (524,288 s) on Kepler's ellipse, about 0.05 units a second on average.
  - Perihelion is fast for a long ellipse round a small star: drawn uniformly, about one comet in 90 would pass 0.3, and the corners of the ranges reach 0.51. So a comet whose `pathSpeed` is `COMET.fast` (0.25) or more is dropped, about one in 23. Every comet is then slow enough for the autopilot's stop, and the carry takes the rest (Review Focus 1).
  - A loop turns a whole number of times a cycle (`revs`), so it wraps smoothly on `ORBIT_CYCLE` as lane 2's orbits do.
- **Binary and trinary systems** (Task 6):
  - About 22% of systems have one companion and about 5% two, sized 0.12–0.3 of the primary.
  - Each goes round the star in the room between the star (its size + 4) and the nearest planet's whole extent (`orbit − extentOf − 4`), laid out from the inside.
  - A second that doesn't fit is dropped, then a first. `planetsOf` puts the first planet at exactly three star sizes, so the room is at most two.
  - The draw shares are 0.30 and 0.08; measured over the test's five sectors (1,242 systems), the kept shares are about 0.22 and 0.046.
  - A companion is drawn as its primary is: a disc in the far layer, faded by the system's reach (Task 6), then a ball once the system is built (Task 15). Without the disc it would appear whole at the reach, tens of pixels across, in about a quarter of systems.
- **Actions** (Task 23):
  - Ore pays `found` ×1 a rock, at most 5 rocks of a field a visit.
  - Salvage pays `found` ×2, once a thing a visit; a derelict is a trap one time in six.
  - A relay's scan pays `found` ×1. A monolith's pays `found` ×3 and gives a line of lore, once a visit.
  - A comet's tail pays `found` ×1 for 2 s inside it, once a comet a visit.
  - A storm drains 4 shields a second, never below 10. The drain isn't a hit: no `laser` event (Comms' hit sound and crew line, `Comms.jsx:249-251`), no shake, no hurt flash (Task 24's `drain`, beside `hurt`).
  - A pulsar's beam scrambles the HUD for 1.2 s.
  - A wormhole throws you 30–80 sectors away, one way, from inside 0.45 × its size, and never mid-trip.
- **The budget's rows** (Task 12, in lane 2's one tier table):

| field | low | mid | high | ultra |
|---|---|---|---|---|
| `thingKinds.rocks` (a field's rocks) | 48 | 96 | 160 | 240 |
| `thingKinds.pieces` (a debris field's pieces) | 16 | 32 | 56 | 80 |
| `thingKinds.bodies` (a herd's or swarm's creatures) | 4 | 8 | 12 | 16 |
| `thingKinds.panels` (a Dyson swarm's collectors) | 300 | 900 | 1,800 | 3,000 |
| `gargantuan` (lane 2's) | `'low'` | `'mid'` | `'high'` | `'high'` |

  The quality steps multiply each `thingKinds` count as lane 2's `discs`: `[1, 0.75, 0.5, 0.35]` for steps 0 to 3, 0.25 at the floor, rounded and never below 1. `gargantuan` drops one level from step 2, and is `'low'` at the floor.

**Boundaries:**
- **Not touched:**
  - `director.js` and its `EVENTS`, `traffic.js`, `farFights.js` and `leviathans.js` (lane 4b's). This lane calls only what exists: `director.soon`, the scene's `happen`, and `hunters.pack`.
  - `nav.js`, `NavMap.jsx`, `MiniMap.jsx` and `chart/*` (lane 6b's)
  - `entry.js`, `footScene.js`, `lib/land/*` and `expanse/flight/*` (lane 5b's)
  - `ship.js`'s `startAt` and the saves (lane 4c's)
  - `online/*` and `post.js`
- **Other lanes' files this lane changes, each by name:**
  - lane 2's `expanse/gen/things.js` (Tasks 3, 4), `space.js` (Tasks 4, 10), `scene/nearThings.js` (Task 4), `scene/discs.js` (Tasks 4, 6), `scene/near.js` (Task 15), and `universe/budget.js` (Task 12)
  - lane 3's `places/cards.js` (Task 3), `places/carry.js` (Task 5), `places/around.js` (Tasks 4, 6; its test also in 10 and 11), `places/weight.test.js` (Task 11), `words.js`'s `PLACE` (Tasks 3, 5–10), `places/PlaceCard.jsx` and `UniversePanel.jsx` (Task 24), and `expanse/shared/space.js` (each task that lends a name; pinned in Task 11)
  - lane 1's `landmarks.js` (Task 19) and `nebula/index.js` (Task 17)
  - `deepspace.js` and `deepspaceShaders.js` (Task 18)
  - `scripts/universe-check.mjs` (`--t`, Task 18; the two poses, Task 25)

**Words and UI (`docs/health/RULES.md`, "UI"):**
- Every new on-screen word goes into `src/components/universe/words.js` first: kinds into lane 3's `PLACE.thing` and `PLACE.about`, and verbs and notes into a new `THINGS`.
- British spelling, sentence case, curly quotes, no Oxford comma, no retired word (`src/lib/words.js`'s `RETIRED`).
- The action's button is the card's one primary button (lane 3's `PlaceCard`), and its key is E in the prompt.

**Browser checks:**
- Headless Chromium draws in software here at a frame or two a second. `universe-check` takes 2 to 4 minutes a pose and tier.
- A task's browser check runs at `--quality mid` only, on the poses or steps it changes. Task 25 runs the full all-tier measure once.
- Every browser command runs with `CHROME=/opt/pw-browsers/chromium CHROMIUM=/opt/pw-browsers/chromium` in front (lane 3's Global Constraints say why).
- `universe-check`, `universe-endless-check`, `autopilot-check` and `perf-probe` start their own server. `navmap-check`, `sector-check`, `flyto-check` and `links-check` need `npx vite --port 5173 --strictPort` in the background first. Wait until `curl --noproxy '*' -sf -o /dev/null http://localhost:5173/` succeeds, in an until-loop on that condition, giving up after 60 s.
- Every wait is on a condition, never a sleep.
- **"Not a pixel changes" is decided by bytes, at a held clock.**
  - The scene's clock runs at a held pose (`scene.js:5067`, `t = (now − t0) / 1000`), and the Maw's disc, the belt and the Twins move with it. So a shot to compare is taken with `universe-check --t <seconds>` (Task 18), which pins the clock as the quality floor does (`scene.js:6157-6160`).
  - `scripts/pixel-measure.mjs` prints a picture's luminance statistics; it doesn't compare two. `scripts/same-pixels.mjs` (Task 18) does: it decodes both shots with sharp and compares the raw buffers byte for byte, outside an optional mask. Its answer decides. Pixel-measure's numbers go in the README beside it.
  - First, two befores at the same `t` are compared. If they differ (something on screen the clock doesn't hold, a passing ship), the box where they differ is the mask for every comparison of that pose, and the README names what moved there.

## Review Focus

1. **A thing that moves.** A comet, storm, herd or swarm is drawn, listed, picked, collided with and parked at where it is now, not where it was at t = 0. At a frame or two a second a ship parked at a comet stays parked: every comet is under `COMET.fast` (0.25), the autopilot's stop, and the carry takes it. A tab open for days (t = 1e10) moves them smoothly. Pinned in Task 2 (paths at large t), Task 4 (the near and far layers read `rowAt`) and Task 5 (every comet under `COMET.fast`; the carry takes a mover, and a parked ship drifts under a unit in 300 s).
2. **A gargantuan at the handover, or all round you.** Coming in, the impostor and the mesh are never both missing, and never both full: `k + fade` stays at 1, where `fade` is what each material really draws with (the hole's `uFade`, the stock materials' `opacity`). A mesh is never cut by the far plane. The impostor keeps its true angle at 10^6 out. With the camera inside a ringworld's ring, a Dyson shell or a black hole's disc, the mesh is up and nothing pops. A black hole's disc and jets still move: `buildHole`'s three shaders read the `uTime` they're given, deep space's for the Maw and the gargantuans' own for the rest. Pinned in Task 18 (the real `buildHole`'s `uFade` and `uTime`, and two Maw shots at different clocks), Task 19 (the angle, the placement) and Task 20 (the handover on the real looks, inside).
3. **The hand-made core.** The ten baseline poses keep their draw calls and triangles: no extra is built near a keep-out, and no pocket is drawn there, including the lists of the sectors next to the core, whose keep-outs `keepOutsNear` doesn't return. The gargantuan's quad takes the Curve's sun's free slot, and gives it back: lane 1 writes a slot's kind, colours, cell and axis once, at create (`landmarks.js:250-259` on `main`), so every update writes them for every slot from `MAIN_DRAWN` up, and in the Rick and Morty sector the Curve's sun is itself again. The portfolio's stations aren't buried. Pinned in Task 8 (from the ten poses' own points, against all of `KEEP_OUTS`), Task 10 (`FAR + size`, the same way), Task 19 (the instance count, and the slots given back) and Task 22 (the baseline poses measured).
4. **A pocket universe** (`/universe?seed=marble`). Its residues, forms, lists, traits, companions and wormhole exits are its own, deterministic, and kept out of the keep-outs. Its rows share id strings with the shared universe's, so nothing is memoised by id alone. The arrival's gargantuans belong to the shared universe only. Pinned in Tasks 3 and 6 (memos by seed), 5, 9 and 10.
5. **Actions not by accident, and not for ever.**
   - A trip that passes through a wormhole's throat doesn't throw you: only flying by hand does.
   - A storm never destroys the ship, and its drain isn't a hit: `hurt()` emits `laser` and sets the shake and the hurt flash on every call (`scene.js:3154-3168`), and Comms plays a hit sound every 120 ms and a crew line on each (`Comms.jsx:249-251`). The storm lowers the shield through `drain`, which does none of that.
   - Ore, salvage, scans and tails pay once a thing a visit.
   - E at a generated thing never takes over E at a hand-made place: generated things are outside every keep-out, and the hand-made branch comes first.
   - A hostile fleet fights only after a hail.
   Pinned in Task 23 and Task 24.
6. **An id for everything.** Every row of every list resolves by its id through lane 3's resolver, in either case of `E:`. Ids are the same whichever order the sectors are made. Stations, lattice slots and empty slots resolve as before. Pinned in Tasks 4 and 11.
7. **Phones still fly** (done item 10). Every drawer is capped by its `thingKinds` count and the gargantuans' detail by `gargantuan`, both lowered by the quality steps (Task 12). The ten baseline poses build nothing of this lane's, so their frame time can't show it. Task 25 bounds the frame time on `low` and `mid` where this lane does build: `at-gargantuan`, `in-field` and `expanse-system`, against lane 3's endless numbers.
8. **What's listed is what's drawn.** Lane 3's `placesAround` keeps the nearest `max` disc rows, and lane 2's `pickDiscs` the nearest `max` discs. A row the disc layer doesn't draw (a field, a cloud, a gargantuan) must not take a drawn disc's place in the list, or that disc can't be picked or named (lane 3's Review Focus 10, done item 4); and a companion's disc, which takes a place in the pick, takes one in the list. Pinned in Task 4 (the rule, on test lists), Task 6 (companions) and Task 11 (with every list in).
9. **The scene builds.** Nothing of this lane's calls the scene's `warm` while the scene is being made (Global Constraints, "Warm-up"). Pinned in Tasks 13, 14–16 and 20 (no `prepare` at create) and Task 22 (`/universe` loads with no console error before any endless step).

## Files

| File | Responsibility | Task |
|---|---|---|
| `src/components/expanse/gen/catalogue.js` (new) | the 23 entries, 32 kinds, looks, solids, traits | 1, 3 |
| `src/components/expanse/gen/paths.js` (new) | movers on the shared clock | 2 |
| `src/components/expanse/gen/things.js` | the lattice's kinds; extras of any length; no list of its own | 3, 4 |
| `src/components/expanse/gen/cube.js` (new) | `CUBE_HALF`, a leaf the lists and `space.js` share | 4 |
| `src/components/expanse/gen/space.js` | ctx for the lists; `wonderPlace` exported, extras first; the gargantuan before appended systems | 4, 10 |
| `src/components/expanse/gen/extras/index.js` (new) | `SECTOR_EXTRAS` and `EXTRA_LISTS`, assembled | 4–10 |
| `src/components/expanse/gen/extras/place.js` (new) | room for a thing: clearances, darts, names | 5 |
| `src/components/expanse/gen/extras/systems.js` (new) | fields, comets, rigs | 5 |
| `src/components/expanse/gen/companions.js` (new) | binary and trinary stars | 6 |
| `src/components/expanse/gen/extras/anchored.js` (new) | fleets, shipyards | 7 |
| `src/components/expanse/gen/extras/clouds.js` (new) | pockets, remnants, swarms, storms, herds, debris | 8 |
| `src/components/expanse/gen/extras/stars.js` (new) | pulsars, magnetars, forming stars, wormholes and their exits | 9 |
| `src/components/expanse/gen/gargantuans.js` (new) | residues, forms, placement, the arrival's hook, the finder | 10 |
| `src/components/expanse/gen/finder.js` (new) | which kinds a set of sectors holds; the nearest of a kind | 11 |
| `src/components/universe/shared/space.js` | lends `PALETTE`, `tint` | 1 |
| `src/components/expanse/shared/space.js` (lane 3's) | lends this lane's names, each when first used | 3–11 |
| `src/components/universe/words.js` | `PLACE` rows; `THINGS` | 3, 5–10, 23 |
| `src/components/universe/things/cards.js` (new) | `CATALOGUE_CARDS`, spread into lane 3's `THING_CARDS` | 3, 5–10 |
| `src/components/universe/places/cards.js`, `places/carry.js` (lane 3's) | the spread and a card's `land`; movers as frames | 3, 5 |
| `src/components/universe/places/around.js` (lane 3's) | the cap counts what the disc layer draws; disc-0 rows outside it by their card's `far`; companions' places | 4, 6 (its test also 10, 11) |
| `src/components/universe/places/weight.test.js` (lane 3's) | `GENERATOR` names this lane's generator files | 11 |
| `src/components/universe/budget.js` (lane 2's) | `thingKinds`, `gargantuan` stepping | 12 |
| `src/components/expanse/scene/nearThings.js`, `discs.js` (lane 2's) | the catalogue's looks, solids, discs and movers; companions' discs | 4, 6 |
| `src/components/expanse/scene/near.js` (lane 2's) | companions in a built system | 15 |
| `src/components/universe/things/layout.js` (new) | pure layouts: rocks in a field, pieces, bodies, beams, ships | 13–16 |
| `src/components/universe/things/drawers.js` (new) | `createThingDrawers`: lane 2's `drawers` hook | 13 |
| `src/components/universe/things/looks/*.js` (new) | `rocks`, `comet`, `wrecks`, `signals`, `stars`, `weather`, `life`, `fleets` (with the original `trader`), `rogue` | 13–16 |
| `src/components/universe/things/pockets.js` (new) | pockets and remnants fed to lane 1's renderer | 17 |
| `src/components/universe/nebula/index.js` (lane 1's) | a cloud's `k`; `shown()` | 17 |
| `src/components/universe/gargantuans/hole.js` (new), `deepspace.js`, `deepspaceShaders.js` | the Maw's look, shared, with a fade and the clock it's given | 18 |
| `scripts/same-pixels.mjs`, `scripts/same-pixels.test.mjs` (new); `scripts/universe-check.mjs` (`--t`) | two shots compared byte for byte; the clock held for a shot | 18 |
| `src/components/universe/landmarkRules.js` (new) | `landK`, `drawnAngle`, `quadAxes`, pure, re-exported by `landmarks.js` | 19 |
| `src/components/universe/gargantuans/rules.js`, `impostorGlsl.js` (new), `landmarks.js` (lane 1's) | impostors in the landmark draw | 19 |
| `src/components/universe/gargantuans/looks/*.js`, `index.js` (new) | meshes near, solids, light, lens | 20 |
| `src/components/universe/rockFields.js` (new) | the rock fields, moved out of `scene.js` | 21 |
| `src/components/universe/things/index.js` (new) | `createThings`: the scene's things | 22, 24 |
| `src/components/universe/things/rules.js` (new) | actions and their effects, pure | 23 |
| `src/components/universe/scene.js` | wiring only, smaller after | 21, 22, 24 |
| `src/pages/Universe.jsx`, `UniverseMap.jsx`, `UniversePanel.jsx`, `places/PlaceCard.jsx` | the action's button | 24 |
| `src/components/universe/poses.js`, `scripts/universe-check.mjs`, `scripts/universe-endless-check.mjs` | poses; this lane's steps | 22, 24, 25 |

---

## PR 4a.1: The catalogue in the generator (pure)

### Task 1: The catalogue, its kinds and their looks

**Files:**
- Create: `lab/universe/before-4a/mid/*` (from `universe-check`), `docs/superpowers/evidence/endless-universe-lane-4a/README.md`
- Create: `src/components/expanse/gen/catalogue.js`, `src/components/expanse/gen/catalogue.test.js`
- Modify: `src/components/universe/shared/space.js` (add `export { PALETTE, tint } from '../palette';`), `src/components/universe/shared/shared.test.js` (the `space` row's names gain `PALETTE` and `tint`)

**Interfaces:**
- Consumes: `PALETTE`, `tint` through `universe/shared/space.js`; `PLANET_TYPES` (`tables.js`).
- Produces:
  - **`CATALOGUE: [{ n, name, kinds: string[] }]`**, 23 rows in the spec's order. `name` is for tests and docs, never shown.

    | n | kinds | n | kinds |
    |---|---|---|---|
    | 1 | `system` | 13 | `derelict` |
    | 2 | `rogue` | 14 | `debris` |
    | 3 | `comet` | 15 | `fleet` |
    | 4 | `field`, `icefield`, `rock`, `ice` | 16 | `rig` |
    | 5 | `pocket`, `nebula` | 17 | `beacon` |
    | 6 | `pulsar`, `magnetar` | 18 | `relay` |
    | 7 | `remnant` | 19 | `monolith` |
    | 8 | `protostar` | 20 | `shipyard` |
    | 9 | `storm` | 21 | `herd` |
    | 10 | `wormhole` | 22 | `swarm` |
    | 11 | `station` | 23 | `hole`, `arc`, `hulk`, `giant`, `dyson` |
    | 12 | `outpost` | | |

  - **`KINDS: { [kind]: { kind, n, body, disc, lit, tint, color, near, core } }`**, one row per kind (32):
    - `body`: what's solid, as a share of the row's `size`, or null for nothing solid. It is 1 for the lattice kinds, 0.25 for `pulsar` and `magnetar`, 0.12 for `protostar`, 0.6 for `rig`, 0.5 for `shipyard`, 1 for `comet`, and null for everything else. Gargantuans' solids are their own (Task 20), and stations' are lane 3's.
    - `disc`: the disc lane 2's far layer draws, as a share of `size`, or 0 for none. It is 1 for the lattice kinds and `rig`; 3 for `beacon` (its lamp reads from afar); 4 for `comet` (its coma); 0.5 for `pulsar` and `magnetar`; 0.6 for `protostar` and `wormhole`; 0.4 for `fleet`; 0.8 for `shipyard`; and 0 otherwise.
    - `tint`: `[paletteName, k]`. `color` is `hexOf(tint(name, k))`, except lane 2's four lattice kinds, which keep `#8a8178`, `#cfe3ee`, `#6d727c` and `#4a3f38`. The tints are the lattice table's above, and: `field` `grey` 0.25, `icefield` `engine` 0.6, `comet` `star` 0, `pulsar` `engine` 0.5, `magnetar` `nebula` 0.5, `protostar` `sun` 0.2, `storm` `engine` 0, `wormhole` `nebula` 0.3, `debris` `grey` 0.1, `fleet` `bone` 0.2, `rig` `sun` 0, `shipyard` `bone` 0.3, `herd` `nebula` 0.4, `swarm` `engine` 0.3, `pocket` `nebula` 0.15, `remnant` `engine` 0.2, `hole` `sun` 0, `arc` `bone` 0, `hulk` `grey` 0, `giant` `sun` 0.3, `dyson` `star` 0, and `system`, `station` and `nebula` `star` 0.
    - `lit`: false for `beacon`, `comet`, `pulsar`, `magnetar`, `protostar`, `storm`, `wormhole` and `swarm`; true otherwise.
    - `near`: false for the kinds others draw: `system`, `station`, `nebula`, `pocket`, `remnant` and the five gargantuan forms. Lane 2's near layer leaves them out (Task 4).
    - `core`: false for every kind of the low-id lists and for `fleet` and `shipyard`; true for the lattice kinds, `field`, `icefield`, `comet`, `rig`, `system`, `station` and `nebula`.
  - **`lookOf(kind) → { color, lit, disc }`.** An unknown kind reads as `rock`'s colour, lit, disc 1.
  - **`solidOf(row, at = row.at) → { id, at, r, reach } | null`**, with `r = body × size` and `reach = 1.2 × r`. It is null where `body` is null.
  - **`hexOf([r, g, b]) → '#rrggbb'`**, from linear light (the inverse of `palette.js`'s `linearOf`).
  - **`PLANET_SIZE`**: the weighted mean of `PLANET_TYPES`' radius midpoints.

- [ ] **Step 0: The before, on the branch as it stands** (lanes 1, 2, 3, 5a and 6a merged), before any code of this lane. Task 3 changes what the far layer draws in the core, so a before taken later would already hold this lane's changes.
  - Run `node scripts/universe-check.mjs --quality mid --out lab/universe/before-4a/mid`: every pose in its `POSES`, the endless ones (`old-rim`, `above-core`, `expanse-system`, `expanse-station`) included.
  - Run `node scripts/universe-endless-check.mjs --quality mid` and copy its per-step table into the README under "Before".
  - Run `QUALITY=mid node scripts/perf-probe.mjs universe` and `QUALITY=low node scripts/perf-probe.mjs universe` in the background, waiting on their exits, and put the frame times in the README (Task 25 compares).
  - Run `wc -l src/components/universe/scene.js src/components/universe/deepspace.js` and `node scripts/health.mjs --only glsl-sites,big-files,boundary-breaks,cycles`, into the README. These are the numbers every later task compares with.
  - Copy `lab/universe/endless/low.json` and `mid.json`, as lane 3 left them, to `lab/universe/before-4a/endless-low.json` and `endless-mid.json`. Task 25 re-records the endless baselines over them, and bounds this lane's frame time against lane 3's.
  - Commit the shots and the README alone: `git commit -m "Lane 4a's before: the universe at mid, the endless steps and the health numbers"`.
- [ ] **Step 1: Write the failing tests** in `catalogue.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { PALETTE, tint } from '../../universe/shared/space';
import { PLANET_TYPES } from './tables';
import { CATALOGUE, KINDS, PLANET_SIZE, hexOf, lookOf, solidOf } from './catalogue';

const LANE2 = { rock: '#8a8178', ice: '#cfe3ee', derelict: '#6d727c', rogue: '#4a3f38' };

describe('the catalogue', () => {
  it('has the spec’s 23 entries in its order, at least 20, each drawn as its own kinds', () => {
    expect(CATALOGUE.map((c) => c.n)).toEqual(Array.from({ length: 23 }, (_, i) => i + 1));
    expect(CATALOGUE.length).toBeGreaterThanOrEqual(20);
    const kinds = CATALOGUE.flatMap((c) => c.kinds);
    expect(kinds).toHaveLength(32);
    expect(new Set(kinds).size).toBe(32);
    expect(Object.keys(KINDS).sort()).toEqual([...kinds].sort());
    for (const c of CATALOGUE) for (const k of c.kinds) expect(KINDS[k].n, k).toBe(c.n);
    expect(CATALOGUE[22].kinds).toEqual(['hole', 'arc', 'hulk', 'giant', 'dyson']);
  });
  it('tints every kind from the palette, and keeps lane 2’s four colours', () => {
    for (const [k, row] of Object.entries(KINDS)) {
      expect(row.color, k).toMatch(/^#[0-9a-f]{6}$/);
      expect(PALETTE[row.tint[0]], k).toBeDefined();
      if (!LANE2[k]) expect(row.color, k).toBe(hexOf(tint(...row.tint)));
    }
    for (const [k, hex] of Object.entries(LANE2)) expect(KINDS[k].color).toBe(hex);
    expect(hexOf(PALETTE.sun.linear)).toBe(PALETTE.sun.hex);
  });
  it('says what is solid, as a share of its size, at where it is now', () => {
    expect(solidOf({ id: 'E:1,0:w64', kind: 'rock', at: [1, 2, 3], size: 50 })).toEqual({ id: 'E:1,0:w64', at: [1, 2, 3], r: 50, reach: 60 });
    expect(solidOf({ id: 'p', kind: 'pulsar', at: [0, 0, 0], size: 80 })).toEqual({ id: 'p', at: [0, 0, 0], r: 20, reach: 24 });
    expect(solidOf({ id: 'c', kind: 'comet', at: [5, 5, 5], size: 10 }, [9, 9, 9]).at).toEqual([9, 9, 9]);
    for (const kind of ['field', 'icefield', 'pocket', 'remnant', 'storm', 'wormhole', 'debris', 'herd', 'swarm', 'fleet', 'nebula', 'hole', 'arc', 'hulk', 'giant', 'dyson']) {
      expect(solidOf({ id: 'x', kind, at: [0, 0, 0], size: 100 }), kind).toBeNull();
    }
  });
  it('knows which kinds others draw, and which may sit in the core', () => {
    expect(Object.values(KINDS).filter((k) => !k.near).map((k) => k.kind).sort()).toEqual(['arc', 'dyson', 'giant', 'hole', 'hulk', 'nebula', 'pocket', 'remnant', 'station', 'system']);
    expect(Object.values(KINDS).filter((k) => k.core).map((k) => k.kind).sort()).toEqual(['beacon', 'comet', 'derelict', 'field', 'ice', 'icefield', 'monolith', 'nebula', 'outpost', 'relay', 'rig', 'rock', 'rogue', 'station', 'system']);
  });
  it('reads an unknown kind as a plain grey thing', () => expect(lookOf('nonsense')).toEqual({ color: KINDS.rock.color, lit: true, disc: 1 }));
  it('measures a planet by the generator’s own radii', () => {
    const w = PLANET_TYPES.reduce((s, p) => s + p.weight, 0);
    expect(PLANET_SIZE).toBeCloseTo(PLANET_TYPES.reduce((s, p) => s + (p.weight * (p.radius[0] + p.radius[1])) / 2, 0) / w, 9);
    expect(PLANET_SIZE).toBeCloseTo(54.04, 1);
  });
});
```

- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/expanse/gen/catalogue.test.js src/components/universe/shared`. Expected: FAIL, because `./catalogue` can't be resolved and the face lacks `PALETTE`.
- [ ] **Step 3: Implement** `catalogue.js` and the face's line. The header lists the exports, as `things.js` does, and says why lane 2's four colours stay: they were drawn before this lane, and a lane doesn't recolour another's on the way past.
- [ ] **Step 4: Run them and see them pass.** Same command. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "The catalogue: 23 kinds of thing in space, drawn as 32, each with its look and what's solid"`

### Task 2: Things that move, on the shared clock

**Files:**
- Create: `src/components/expanse/gen/paths.js`, `src/components/expanse/gen/paths.test.js`

**Interfaces:**
- Consumes: `ORBIT_CYCLE` (`orbits.js`).
- Produces:
  - **`COMET_PERIOD = 8 * ORBIT_CYCLE`**
  - **`pathAt(path, t) → [x, y, z]`** for two forms:
    - `{ type: 'kepler', focus, q, e, peri, normal, period, phase }`: an ellipse with its focus at `focus`, perihelion distance `q` along the unit `peri`, in the plane with unit normal `normal`. The mean anomaly is `M = 2π · (frac(t / period) + phase)`. Solve Kepler's equation `E − e·sin E = M` with `keplerE`, then `x = a(cos E − e)` along `peri` and `y = a·√(1 − e²)·sin E` along `normal × peri`, where `a = q / (1 − e)`.
    - `{ type: 'loop', centre, radius, revs, phase, normal, ref }`: a circle with `θ = 2π · (revs · frac(t / ORBIT_CYCLE) + phase)`, at `centre + radius · (cos θ · ref + sin θ · (normal × ref))`.
  - **`keplerE(M, e) → E`**: Newton steps from `E = M + e·sin M` until a step moves it under 1e-12, at most 30.
  - **`rowAt(row, t) → [x, y, z]`**: `pathAt(row.path, t)` for a row with a `path`, else `row.at` itself (the same array).
  - **`pathSpeed(path) → number`**: the most units a second it ever moves. For a Kepler ellipse that's at perihelion, `(2π a / period) · √((1 + e) / (1 − e))`; for a loop, `2π · radius · revs / ORBIT_CYCLE`.

- [ ] **Step 1: Write the failing tests:**

```js
import { describe, expect, it } from 'vitest';
import { ORBIT_CYCLE } from './orbits';
import { COMET_PERIOD, keplerE, pathAt, pathSpeed, rowAt } from './paths';

const len = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const comet = { type: 'kepler', focus: [100000, 0, -5000], q: 300, e: 0.85, peri: [1, 0, 0], normal: [0, 1, 0], period: COMET_PERIOD, phase: 0 };
const Q = (comet.q * (1 + comet.e)) / (1 - comet.e);
const storm = { type: 'loop', centre: [5, 6, 7], radius: 2000, revs: 4, phase: 0.25, normal: [0, 0, 1], ref: [1, 0, 0] };

describe('paths', () => {
  it('solves Kepler’s equation', () => {
    for (const e of [0, 0.3, 0.85, 0.95]) for (const M of [0, 0.5, 2, Math.PI, 5]) expect(keplerE(M, e) - e * Math.sin(keplerE(M, e))).toBeCloseTo(M, 10);
  });
  it('puts a comet at perihelion at its start, at aphelion half a period on, and between them always', () => {
    expect(COMET_PERIOD).toBe(8 * ORBIT_CYCLE);
    expect(len(pathAt(comet, 0), [comet.focus[0] + comet.q, 0, comet.focus[2]])).toBeLessThan(1e-6);
    expect(len(pathAt(comet, COMET_PERIOD / 2), comet.focus)).toBeCloseTo(Q, 6);
    for (let i = 0; i < 64; i++) {
      const r = len(pathAt(comet, (i / 64) * COMET_PERIOD), comet.focus);
      expect(r).toBeGreaterThanOrEqual(comet.q - 1e-6);
      expect(r).toBeLessThanOrEqual(Q + 1e-6);
    }
  });
  it('never moves faster than its perihelion speed, and stays smooth days or years on', () => {
    const most = pathSpeed(comet);
    for (const t0 of [0, 1234.5, 1.7e9, 1e10]) expect(len(pathAt(comet, t0 + 1), pathAt(comet, t0))).toBeLessThanOrEqual(most + 1e-6);
    for (const k of [1, 3, 1907]) expect(len(pathAt(comet, k * COMET_PERIOD - 1e-3), pathAt(comet, k * COMET_PERIOD + 1e-3))).toBeLessThan(1e-3);
    expect(most).toBeLessThan(0.3);
  });
  it('goes round a loop a whole number of times a cycle, at its radius', () => {
    for (const t of [0, 99, 1e6, 1e10]) expect(len(pathAt(storm, t), storm.centre)).toBeCloseTo(2000, 6);
    expect(len(pathAt(storm, ORBIT_CYCLE - 1e-3), pathAt(storm, ORBIT_CYCLE + 1e-3))).toBeLessThan(1e-2);
    expect(pathSpeed(storm)).toBeCloseTo((2 * Math.PI * 2000 * 4) / ORBIT_CYCLE, 9);
  });
  it('leaves a thing without a path where it is', () => {
    const row = { at: [1, 2, 3] };
    expect(rowAt(row, 5e9)).toBe(row.at);
    expect(rowAt({ at: [0, 0, 0], path: storm }, 99)).toEqual(pathAt(storm, 99));
  });
});
```

- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/expanse/gen/paths.test.js`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement `paths.js`.** It imports only `orbits.js`'s `ORBIT_CYCLE`. The header says why `frac(t / period)` comes before the angle, as `orbits.js` does it: a clock days from its epoch keeps its precision.
- [ ] **Step 4: Run them and see them pass.** Same command. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "Comets on Kepler's ellipse and storms on loops, on the shared clock"`

### Task 3: The lattice's new kinds, their traits, cards and words

**Files:**
- Modify: `src/components/expanse/gen/things.js` (`THING_KINDS`), `src/components/expanse/gen/things.test.js`: "has four valid kinds" is replaced (below)
- Modify: `src/components/expanse/gen/catalogue.js` (add `traitsOf`, `ROGUE_TYPES`, `LORE_COUNT`)
- Create: `src/components/universe/things/cards.js`, `src/components/universe/things/cards.test.js`
- Modify: `src/components/universe/places/cards.js` (lane 3's): `THING_CARDS` spreads `CATALOGUE_CARDS` after its own rows (+1 import, 0 lines otherwise), and `placeCard`'s thing branch sets `land: card.land?.(row) ?? false` (0 lines, in place)
- Modify: `src/components/universe/words.js`: `PLACE.thing` and `PLACE.about` gain `outpost`, `beacon`, `relay` and `monolith`
- Modify: lane 3's `src/components/expanse/shared/space.js` and `shared.test.js`: the face lends `KINDS`, `lookOf` and `traitsOf`, which `things/cards.js` imports through it

**Interfaces:**
- Consumes: Task 1's `KINDS`; `hash64`, `rngOf`, `int`, `weighted` (`seed.js`); lane 3's `THING_CARDS` and `placeCard`.
- Produces:
  - **`THING_KINDS`**: the eight rows of the lattice table in Global Constraints, lane 2's four first and in their order. Each keeps lane 2's shape, `{ kind, weight, size, look: { color, lit } }`, with `look` from `KINDS`.
  - **`traitsOf(row) → object`**: what a thing is, from `rngOf(hash64(row.seed, 'traits'))`, memoised by `String(row.seed)` (the last 512). Never by id: a pocket universe's rows share id strings with the shared universe's.
    - `rogue`: `{ type, land }`. `type` is weighted from `ROGUE_TYPES = [['rock', 4], ['ice', 3], ['desert', 1], ['gas', 2]]`, and `land` is `type !== 'gas'`.
    - `beacon`: `{ leads }`, `'distress'` with chance 0.6, else `'treasure'`
    - `monolith`: `{ lore }`, an integer in `[0, LORE_COUNT)`, where `LORE_COUNT = 12`
    - `derelict`: `{ trap }`, true with chance 1/6
    - `pulsar` and `magnetar`: `{ spin: unit [x, y, z], period: 1.5–6 s a turn, beam: 25 }`
    - any other kind: `{}`
  - **`CATALOGUE_CARDS: { [kind]: { type, about, color, solid, far?, move?, land?, chart: { shape, priority } } }`**, lane 3's card row with two additions:
    - `land(row) → boolean`, for a kind you can land on. Lane 5b reads it through `placeCard`'s `land`.
    - `chart: { shape, priority }`, for lane 6b's marks. The shapes are lane 6a's (`dot`, `cloud`, `hole`, `star`).
  - This task's rows:
    - `outpost`, `beacon`, `relay` and `monolith`: `solid: true`, `chart: { shape: 'dot', priority: 20 }`, colour `KINDS[k].color`
    - `rogue`: lane 3's row spread, plus `land: (row) => traitsOf(row).land`
  - **`PLACE`** gains:

    ```js
    thing: { …, outpost: 'Abandoned outpost', beacon: 'Beacon', relay: 'Relay array', monolith: 'Monolith' },
    about: {
      …,
      outpost: 'An outpost nobody runs any more. Some of it might still be worth taking.',
      beacon: 'A beacon, blinking. Something out here is calling for someone.',
      relay: 'A relay array, still listening. Worth a scan.',
      monolith: 'A dark slab older than the stars round it, cut all over with signs.',
    },
    ```

- [ ] **Step 1: Write the failing tests.**
  - **In `things.test.js`, replace "has four valid kinds"** with "has eight valid kinds, lane 2’s four first":
    - the kinds are `['rock', 'ice', 'derelict', 'rogue', 'outpost', 'beacon', 'relay', 'monolith']`
    - every row keeps the validity loop's checks, except `look.lit`, which equals `KINDS[k.kind].lit`
    - each `look.color` equals `KINDS[k.kind].color`
    - The commit body names this test as replaced and why: the spec gives lane 4a this table, and lane 2's test pinned its starting rows.
  - **In `catalogue.test.js`, add:**
    - Over every lattice row of `fullSector(UNIVERSE, …)` for `E:1,0`, `E:2,0` and `E:1,0,1`, made once in a `beforeAll`. Only the rogue, beacon, monolith and derelict slots are turned into rows (`thingRow(s, i)` where `s.things.kind[i]` is one of those), about 4,700 of the 23,900 slots.
      - Why three sectors, not 2,000 rows: each sector's lattice holds about 7,960 things (measured at `cc5e2eaf`). With this lane's weights (total 11.0), 2,000 rows hold about 73 rogues, and the gas share's band would be about ±1 standard deviation, so a seed would fall outside it about one time in three. Three sectors hold about 870 rogues, 1,090 beacons and 2,170 derelicts.
      - The test first asserts those counts are at least 600, 600 and 1,200, so each band below is at least 2.5 standard deviations wide. Below that it adds `E:-1,0,2` to the `beforeAll` rather than widen a band.
      - every rogue's `type` is in `ROGUE_TYPES`
      - between 15% and 25% of rogues are gas giants, and only those have `land: false`
      - beacons lead to `distress` 50–70% of the time
      - every monolith's `lore` is in `[0, 12)`
      - derelict traps are between 10% and 24%
    - `traitsOf` gives a deep-equal answer on a second call, and `{}` for a rock.
    - 64 derelict rows `{ id: 'E:1,0:w64', kind: 'derelict', seed: s }` for `s` from `1n` to `64n`, one id among them all, don't all give the same `trap`. An id-keyed memo would hand every one the first's.
  - **In `things/cards.test.js`:**
    - every lattice kind has a card in lane 3's `THING_CARDS` with `type` `PLACE.thing[kind]` and `about` `PLACE.about[kind]`
    - `placeCard({ kind: 'thing', row, sector })` for a rocky rogue has `land: true`, and for a gas rogue `land: false`
    - the four new kinds' `chart` is `{ shape: 'dot', priority: 20 }`
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/expanse/gen src/components/universe/things src/components/universe/places`. Expected: the new tests FAIL. Lane 3's cards test also fails ("has a card for every kind the generator makes"), until the cards are in.
- [ ] **Step 3: Implement** the table, `traitsOf`, the cards, the spread and the words.
- [ ] **Step 4: Run the generator's and lane 3's tests.** Run `npx vitest run src/components/expanse src/components/universe/places src/components/universe/things src/lib/words.test.js`. Expected: PASS. That includes lane 2's `density.test.js`, `space.test.js` and `fingerprint.test.js`, and every test of lane 3's `places/`, unchanged.
  - The lattice's slot positions don't depend on its kinds, but a slot's kind and size do. If one of lane 3's tests turns on what slot 0 or slot 40 of `E:1,0` holds, the test is still right (every lattice kind is solid and stays put): fix the code, never the test, and record it in the hand-off notes as a finding.
  - **This changes a picture.** The weights change most slots' kind and size, and lane 2's far layer draws the core's lattice things as discs at the baseline poses. The colours of lane 2's four kinds stay; the new kinds' discs are new specks. It costs no call and no triangle (farStars' one `Points`). Task 11's gate compares it with Task 1's before.
  - Run `node scripts/health.mjs --only boundary-breaks,cycles`. Expected: Task 1's Step 0 numbers.
- [ ] **Step 5: Commit.** `git commit -m "Abandoned outposts, beacons, relays and monoliths on the lattice, each with its traits, card and words"`. The body says the far layer's core specks change from here, on purpose.

### Task 4: Lists of any length, looked up first, and read by the scene's two layers

**Files:**
- Create: `src/components/expanse/gen/cube.js`: `export const CUBE_HALF = 56000;`, moved out of `space.js` (whose header says why: the lists and the gargantuans need it, and importing `space.js` from them would be a cycle)
- Create: `src/components/expanse/gen/extras/index.js`: `export const SECTOR_EXTRAS = [];` and `export const EXTRA_LISTS = [];`, which Tasks 5–10 grow
- Modify: `src/components/expanse/gen/things.js`:
  - `thingsOf`'s extras checks: a list is low (`3 ≤ base`, `base + max ≤ THING_BASE`) or high (`base ≥ EXTRA_HIGH`, a multiple of 10,000, `max ≤ 9999`)
  - each list's `make(ctx, made)` gets the lists made before it, ids already on their rows
  - export `EXTRA_HIGH = 20000`
  - `SECTOR_EXTRAS` leaves `things.js` for `extras/index.js`, and `thingsOf`'s default becomes `extras = []`. So `things.js` imports no list, and every list can import `THING_NEAR`, `THING_BASE` and `EXTRA_HIGH` from it with no cycle.
- Modify: `src/components/expanse/gen/space.js`:
  - `CUBE_HALF` from `./cube`, `SECTOR_EXTRAS` from `./extras`
  - `fullSector(universe, sx, sy, sz, { things = true, lattice = things, extras = SECTOR_EXTRAS })`: with `lattice: false` the lattice is empty and the lists are made; `extras` is for tests
  - the ctx `thingsOf` gets gains `wonders` (today's, as now), `beacons`, `stations` (lane 3's, already made at that point), `d` (Chebyshev distance in sectors), `core` (`!sx && !sy && !sz`) and `universe`. `outs` stays lane 2's `keepOutsNear`, for the lattice.
  - **`export function wonderPlace(sector, n, extras = SECTOR_EXTRAS)`** (module-private today, `space.js:165`) looks in the lists first, by range, then lane 3's stations, then the lattice, then the legacy wonders
- Modify: `src/components/expanse/gen/things.test.js`: its `SECTOR_EXTRAS` import comes from `./extras`, and `expect(SECTOR_EXTRAS).toEqual([])` is replaced by "every list's range is low or high, and none overlaps another". Name it in the commit.
- Modify: lane 3's `src/components/expanse/shared/space.js`: `SECTOR_EXTRAS` is lent from `../gen/extras` (its names unchanged)
- Modify: lane 2's `src/components/expanse/scene/nearThings.js` and `nearThings.test.js`, `discs.js` and `discs.test.js` (new `it`s; every existing one stays)
- Modify: lane 3's `src/components/universe/places/around.js` and `around.test.js` (a new `it`): the cap counts what the disc layer draws (below). It reads `lookOf` through `expanse/shared/space.js`, which has lent it since Task 3.
- Test: `src/components/expanse/gen/lists.test.js` (new)

**Interfaces:**
- Consumes: lane 2's `thingsOf`, `fullSector`, `placeIn`, `placeOf`, `pickNear`, `createNearThings`, `createDiscs` and `pickDiscs`; lane 3's `stationsOf`, the station branch it put in `wonderPlace`, and `placesAround` and `AROUND`; Task 1's `KINDS`, `lookOf` and `solidOf`; Task 2's `rowAt`.
- Produces, in the generator: `EXTRA_HIGH`, `CUBE_HALF` (in `gen/cube.js`), `SECTOR_EXTRAS` and `EXTRA_LISTS` (in `gen/extras/index.js`), the ctx above, `make(ctx, made)`, `fullSector`'s `lattice` and `extras` options, and `wonderPlace` exported, lists first.
- Produces, in lane 2's layers, so a list's rows are drawn right from the first task that makes one (Task 5):
  - **`pickNear(sectors, cam, { max, t = 0 })`** measures each lattice thing and list row at `rowAt(row, t)`, and leaves out the list kinds whose `KINDS[kind].near` is false. Each entry is `{ id, kind, at, size, look, row }`: `look` is `lookOf(kind)` (lane 2's four keep their colours), and `row` is the source row (for the lattice, `thingRow(sector, i)`, memoised by the sector's seed and the slot, the last 256).
  - **`createNearThings(…).solids()`** lists `solidOf(entry.row, entry.at)` for lattice things and list rows, and skips null.
  - **`discs.js`** pushes a lattice thing or list row as a disc of radius `size × lookOf(kind).disc`, at `rowAt(row, t)`, and not at all when that's 0.
  - **Legacy wonders (`w0`–`w2`) keep lane 2's own rules**, in all three: their look (`sectors.js:41-46`'s `WONDER`: the derelict `#7a808c`, the rogue `#6b5a50`, the pulsar `#b8f4ff`), their solids, their discs, and whether `pickNear` takes them. The catalogue reads lattice things and list rows only. A legacy wonder's kind shares a name with a catalogue kind, but `lookOf` would recolour three of them and shrink a legacy pulsar's solid to `0.25 × size`, and a lane doesn't change another's drawing on the way past (as with lane 2's four lattice colours).
  - Until Tasks 13–16 give a kind its drawer, a near list row is lane 2's ball in its catalogue colour. The clearances keep every list row past `THING_NEAR × size + extent` from the baseline poses (Task 8), so none is built there.
- Produces, in lane 3's `around.js` (`placesAround(sectors, cam, t, { far, inside, max })`), the cap by the disc layer's own rule:
  - A lattice thing or list row whose `lookOf(kind).disc` is over 0 is a disc kind: it is within the far plane by lane 3's rule, counts toward `max`, and is ranked by distance from the middle, as `pickDiscs` ranks it. For the cap's count it uses the disc layer's radius, `size × lookOf(kind).disc`.
  - A list row whose `disc` is 0 (`field`, `icefield`, `pocket`, `remnant`, `storm`, `herd`, `swarm`, `debris` and the five gargantuan forms) is drawn by no disc, so it never takes a disc's place. It is listed outside the cap, as moons and stations are, when its `dist` is within its card's own `far` (`AROUND.far` when the card has none; `NEBULA_SHOW` for a pocket or remnant; 400,000 for a gargantuan, Task 10).
  - Systems, planets and legacy wonders keep lane 3's rule unchanged.
  - Why: lane 3 counted every extra within the far plane toward `budget.discs` (400 on low against about 1,700 lattice things there). Every disc-0 row inside the cap pushed a drawn disc out of the list, and that disc couldn't be picked or named.

- [ ] **Step 1: Write the failing tests.**
  - **`lists.test.js`.** Each test passes its own lists to `thingsOf`, `wonderPlace` and `fullSector`'s `extras`, so they hold whatever `SECTOR_EXTRAS` holds.
    - A high list `{ list: 'testHigh', base: 20000, max: 9999, make: () => [a, b, c] }` gives three rows with ids `w20000`, `w20001` and `w20002`. `wonderPlace(sector, 20001, lists)` is `{ kind: 'extra', row: b }`.
    - A second list's `make(ctx, made)` sees `made.testHigh` with its ids.
    - These throw:
      - a low list reaching `w64`
      - a list based at 500
      - a high list at 25000
      - a high list with `max: 10000`
      - two lists sharing an id
    - With lists first, `wonderPlace` still finds:
      - lane 3's first station of `E:1,0` at `w${STATION_BASE + i}`
      - lattice slot `w64 + slot`
      - legacy `w0`
      - and `w60`, `w8064` and `w9999` give null
    - `fullSector(UNIVERSE, 1, 0, 0, { lattice: false, extras: lists })` has `things.count === 0`, and calls each list's `make` once (a counting `make`).
    - The ctx a `make` sees carries `stations` (lane 3's, the same rows as `fullSector(…).stations`), `beacons`, `wonders`, `d`, `core` and `universe`.
    - `placeOf(UNIVERSE, 'e:1,0:w64')` is unchanged from before this task, row for row.
  - **`nearThings.test.js`, new `it`s,** with a hand-made sector holding a comet (with a `path`), a pocket, a gargantuan `hole`, a field and a rock:
    - `pickNear` at t = 5000 puts the comet at `rowAt(comet, 5000)` and finds it by that place. It leaves out the pocket and the hole, and keeps the field and the rock, each with its `row` and `look` `lookOf(kind)`.
    - `solids()` holds the comet at its place with `r: size`, and the rock with `r: size, reach: 1.2 × size`. It holds neither the field nor the pocket.
    - The same slot of the same id in two sectors with different seeds gives each its own `row`.
  - **`discs.test.js`, new `it`s:** the field and the pocket push no disc; the comet pushes one of radius `4 × size` at `rowAt`; a beacon one of `3 × size`; a lane 2 rock one of `size`, in `#8a8178`.
  - **Legacy wonders, in `nearThings.test.js` and `discs.test.js`:** a sector holding a legacy `derelict`, `rogue` and `pulsar` wonder gives each the same entry, look, solid and disc as before this task (each recorded from lane 2's code in the test, before the change): the derelict still `#7a808c`, and the pulsar's solid still lane 2's.
  - **Lane 3's `around.test.js`, a new `it`: the capped list is the disc layer's pick.**
    - Sectors: the 27 round `E:1,0`, each made with `fullSector(…, { extras: lists })`, where `lists` is the test's own: a low list of 60 `nebula` rows (disc 0; lane 3's card for a legacy nebula already names the kind, and the catalogue's own disc-0 kinds get their cards in Tasks 5–10) and a high list of 40 `beacon`s (disc 3) and 40 `outpost`s (disc 1), darted in each sector's cube by a seeded rng.
    - Camera: `E:1,0`'s middle plus `[7000, 3000, −2000]`.
    - `placesAround(sectors, cam, 0, { ...AROUND, max: 400 })`'s disc rows (its rows less moons, stations and the disc-0 kinds) are exactly the set lane 2's `createDiscs` pushes, with `budget.discs` 400, fed the same sectors and camera through a recording fake far layer (its `discs.push` records the place and radius). Each pushed disc is matched to a row by its place (to 1e-3) and radius.
    - Every `nebula` row within its card's `far` is listed besides, and none of them is among the 400. Task 11 runs the same test with every real list in.
    - If the two sets differ on a kind this lane doesn't own (a system, a planet or a legacy wonder), that is lane 3's rule against lane 2's code: lane 3's rule follows the code (its assumption 18), and the hand-off notes record it as a finding. The test isn't changed to pass.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/expanse/gen/lists.test.js src/components/expanse/scene src/components/universe/places/around.test.js`. Expected: the new tests FAIL; lane 2's and lane 3's existing ones pass.
- [ ] **Step 3: Implement.** The `wonderPlace` header says why lists come first: a high list's numbers are past lane 3's station base too, and the station branch would read `w20001` as station 10001. `around.js`'s header says why a disc-0 row is listed outside the cap: the list follows what the disc layer draws, and a field draws no disc.
- [ ] **Step 4: Run them and see them pass.** Run `npx vitest run src/components/expanse src/components/universe/places`, then `node scripts/health.mjs --only boundary-breaks,cycles`. Expected: PASS, with lane 2's and lane 3's tests unchanged; Task 1's Step 0 numbers.
- [ ] **Step 5: Commit.** `git commit -m "Sector lists of any length, told the stations, beacons and lists before them, looked up first, drawn where they are now and listed as they are drawn"`. The body names the replaced `SECTOR_EXTRAS` test and says why a field, a cloud or a gargantuan is listed outside lane 3's cap.

### Task 5: Fields, comets and rigs round the systems

**Files:**
- Create:
  - `src/components/expanse/gen/extras/place.js`
  - `src/components/expanse/gen/extras/systems.js`, `src/components/expanse/gen/extras/systems.test.js`
- Modify: `src/components/expanse/gen/extras/index.js` (Task 4's; this task's three lists, then each later task's)
- Modify: `src/components/universe/words.js` (`PLACE` rows), `src/components/universe/things/cards.js` (rows), `src/components/universe/things/cards.test.js`
- Modify: lane 3's `src/components/expanse/shared/space.js` and `shared.test.js`: the face lends `rowAt`, `pathAt`, `pathSpeed`, `COMET_PERIOD` and `tailOf`, which `things/cards.js` imports through it
- Modify: `src/components/universe/places/carry.js` (lane 3's): `frameOf` also takes a row with a `move`, the trip's goal first, then where you're at. Its test gains a new `it`.

**Interfaces:**
- Consumes: Tasks 1–4; `systemReach`, `clearOfKeepOuts`, `KEEP_OUTS`, `nameOf`, `cultureOf`, `hash64`, `rngOf`, `range`, `int` (`seed.js`, `names.js`, `systems.js`, `keepOuts.js`); `THING_NEAR` (`things.js`); `CUBE_HALF` (`cube.js`); lane 3's `extentOf`.
- Produces, in `extras/place.js` (which imports `things.js`, `cube.js` and `keepOuts.js`, never `space.js` or `extras/index.js`):
  - **`NEBULA_SHOW = 40000`**, re-exported by `extras/index.js`
  - **`roomFor(at, { size, extent = 0, show = false, own = null }, ctx, placed) → boolean`**: the clearances in Global Constraints.
    - The keep-outs are every row of `KEEP_OUTS` (`clearOfKeepOuts`'s default), not `ctx.outs`. Its header says why: `keepOutsNear` returns only the keep-outs touching the sector's cube, which for most of the core's neighbours is none, and a list's clearances run to 46,000.
    - `show` uses `NEBULA_SHOW + size` from the keep-outs (pockets and remnants only).
    - `own` is a system id whose system isn't checked.
    - `placed` is `[{ at, r }]`, where `r` is each earlier row's size plus its extent.
  - **`dartIn(rng, ctx, spec, placed, tries = 40) → [x, y, z] | null`**: darts in the cube `CUBE_HALF − spec.size − spec.extent` round `ctx.origin`, until `roomFor`, so the row's whole extent stays in its own sector.
  - **`nameIn(rng, ctx) → string`**: `nameOf(rng, cultureOf(rng, ctx.d))`.
- Produces, in `extras/systems.js` (lists `field` 20000, `comet` 30000 and `rig` 40000):
  - **`FIELD = { share: 1/3, ice: 0.3, size: [250, 700], out: [1.15, 1.6], height: 300 }`**. Each system takes `rngOf(hash64(system.seed, 'field'))`, drawn in this order:
    1. `rng() < share`, or no field
    2. the size
    3. ice
    4. the angle round the star
    5. the distance out, as a share of the reach
    6. the height
    7. the name

    A row is `{ kind: 'field' | 'icefield', name, at, size, system: id, seed: hash64(system.seed, 'field') }`. It stays only if `roomFor(at, { size, own: system.id })`.
  - **`COMET = { share: 0.25, size: [6, 20], q: [1.2, 2.0], Q: [1.5, 3], tail: [60, 160], tilt: 0.6, fast: 0.25 }`**, from `rngOf(hash64(system.seed, 'comet'))`.
    - `q` is in star sizes, `Q` in reaches, `e = (Q − q) / (Q + q)`.
    - `peri` is a random unit; `normal` is within `tilt` of the star's +y and perpendicular to `peri`.
    - A row is `{ kind: 'comet', name, at: pathAt(path, 0), size, system, star: system.at, path: { type: 'kepler', focus: system.at, q, e, peri, normal, period: COMET_PERIOD, phase }, tail, extent: Q, seed }`.
    - It stays only when all of these hold:
      - `pathSpeed(path) < COMET.fast`. The ranges alone allow up to 0.51 at perihelion, and about one comet in 23 is dropped by this rule.
      - every row of `KEEP_OUTS` is clear of the focus by `Q + tail + 9·size`
      - every other system's star is at least `Q + tail + its reach` from the focus
      - `ctx.keeps` (Task 10) is clear of the focus by `Q + tail + size`
      - the whole path is inside its sector's cube: `|focus − origin| + Q + tail ≤ SECTOR / 2` on each axis
  - **`RIG = { share: 1/3, size: [40, 90] }`**, from `rngOf(hash64(field.seed, 'rig'))`. A row is `{ kind: 'rig', name, at: field.at, size, field: field.id, system, seed }`.
  - **`tailOf(row, t) → { dir, length }`**: `dir` is the unit vector from `row.star` to `rowAt(row, t)`. `length = row.tail · clamp(2·q / r, 0.15, 1)`, where `r` is that distance.
  - **Words:** `PLACE.thing` gains `field: 'Asteroid field', icefield: 'Ice field', comet: 'Comet', rig: 'Mining rig'`, and `PLACE.about` gains:
    - `field: 'A drift of rock round the edge of a system. Shoot a rock for its ore.'`
    - `icefield: 'A drift of ice shards. Shoot one for what’s frozen inside.'`
    - `comet: 'A comet on its long way round, its tail pointing away from its star.'`
    - `rig: 'A mining rig on a big rock, its haulers coming and going.'`
  - **Cards:**
    - `field`, `icefield`: `solid: false`, `chart: { shape: 'dot', priority: 15 }`
    - `comet`: `solid: true`, `move: (row, t) => rowAt(row, t)`, `chart: { shape: 'dot', priority: 25 }`
    - `rig`: `solid: true`, `chart: { shape: 'dot', priority: 20 }`
  - **`frameOf(rows, { here, going })`** (lane 3's) returns the row whose id is `going` when it's a planet, a moon or has a `move`; else the row whose id is `here`, by the same rule; else null.

- [ ] **Step 1: Write the failing tests** in `extras/systems.test.js`, over `E:1,0`, `E:2,0`, `E:1,0,1` and the core `E:0,0`, each made once with `fullSector`:
  - **Fields:**
    - the share of systems with one is in `[0.25, 0.40]`, and of fields that are ice in `[0.18, 0.42]`
    - each is between `1.15 × reach` and `√((1.6 × reach)² + 300²)` from its star, and within ±300 of its height
    - each is clear of every row of `KEEP_OUTS` by `9 × size` and of every other system by `reach + size`
  - **Comets:**
    - the share of systems with one is in `[0.12, 0.30]`
    - `rowAt(c, 0)` equals `c.at`
    - at 64 times over a period, it is within `[q, Q]` of its star and at least `tail + reach` from every other system's star
    - `extent === Q`, and `pathSpeed(c.path) < COMET.fast` (0.25) for every comet
    - `tailOf(c, 0).length` is `c.tail` at perihelion, and `0.15 × c.tail` at most past `13.3 q`
  - **Rigs:** each is at its field's middle; the share of fields with one is in `[0.2, 0.5]`.
  - **The core:** `E:0,0` has fields and comets, every one clear of all of `KEEP_OUTS` as above, and no rig closer to home than `HOME_KEEP + 9 × size`.
  - **The neighbours:** in `E:1,0`, `E:-1,0`, `E:0,1` and `E:0,-1` (whose `keepOutsNear` is empty, or for `E:0,-1` only the pocket's), every field and comet is clear of all of `KEEP_OUTS` as above.
  - **Ids:**
    - `placeOf(UNIVERSE, 'E:1,0:w20000').row` is `fullSector(…).extras.field[0]`
    - the `k`th comet is `w${30000 + k}`, and `e:1,0:w30000` reads the same
    - a sector made twice gives deep-equal lists
    - `structuredClone` of each list deep-equals it: plain data, for the worker
  - **In lane 3's `carry.test.js`,** a new `it`:
    - `frameOf` takes a comet row with a `move` as `going`, and as `here`, and still gives null for a system
    - a ship parked by `parkPlace` at the comet of `E:1,0` with the highest `pathSpeed`, carried by it for 300 s at `dt` 0.25 with the stick let go, ends within 1 of `followPark` at 300
  - **In `things/cards.test.js`:** the four cards above; `atTime(resolvePlace(comet.id, { t: 0 }), 5000)` equals `rowAt(comet, 5000)` (lane 3's resolver and ids, untouched).
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/expanse/gen/extras src/components/universe/places/carry.test.js src/components/universe/things`. Expected: FAIL.
- [ ] **Step 3: Implement.** `extras/index.js`'s header lists every list and its ids: this task's three now, the rest as later tasks add them. Then run `npx vitest run src/components/expanse/gen/space.test.js src/components/expanse/gen/density.test.js`: lane 2's ten-sector speed test must still pass. If it doesn't, say by how much in the commit, and make the per-system draws cheaper (one `rngOf` per system and list), never the test looser.
- [ ] **Step 4: Run them and see them pass.** Run `npx vitest run src/components/expanse src/components/universe/places src/components/universe/things`, then `node scripts/health.mjs --only boundary-breaks,cycles`. Expected: PASS; Task 1's Step 0 numbers.
- [ ] **Step 5: Commit.** `git commit -m "Asteroid and ice fields, comets on long orbits and mining rigs round the systems"`. The body says the core's fields, comets and rigs now show as far-layer discs, on purpose.

### Task 6: Binary and trinary systems

**Files:**
- Create: `src/components/expanse/gen/companions.js`, `src/components/expanse/gen/companions.test.js`
- Modify: `src/components/universe/words.js`: `PLACE.about.system` takes `companions: [star type, …]`
- Modify: `src/components/universe/places/cards.js` (lane 3's `placeCard`, system branch): it passes `companions: companionsOf(system).map((c) => PLACE.star[c.class].toLowerCase())` to the about (0 lines, in place)
- Modify: lane 3's `src/components/expanse/shared/space.js` and `shared.test.js`: the face lends `companionsOf` and `companionAt`
- Modify: lane 2's `src/components/expanse/scene/discs.js` and `discs.test.js` (a new `it`): companions as discs
- Modify: lane 3's `src/components/universe/places/around.js` and `around.test.js` (a new `it`): a companion takes a place in the cap

(Why the discs go in here, not with the balls in Task 15: a disc is a far-layer speck, and 4a.1 is the group whose gate (Task 11) compares the far layer's specks with Task 1's before. After it, the one picture change PR group 4a.2 makes at the baseline poses is the gargantuan on the sky (Task 22). The discs need `companionsOf`, so they can't come earlier, in Task 4. Between this task and Task 15, a companion's disc fades out inside its system's reach with nothing behind it: a fade, never a pop.)

**Interfaces:**
- Consumes: `STAR_CLASSES`, `revsFor`, lane 3's `extentOf`; lane 2's `createDiscs`, `pickDiscs`, `levelWeights` and `systemReach`; Task 4's `around.js` cap.
- Produces:
  - **`COMPANIONS = { one: 0.30, two: 0.08, size: [0.12, 0.3], gap: 4 }`**
    - Why these numbers: `planetsOf` puts the first planet at exactly three star sizes (`systems.js:61`), so the room inside it is at most two star sizes less the first planet's extent, and under 0.3 of a star size for about one system in four.
    - Companions of 0.25–0.45 on fixed orbits of 1.7–2.5 star sizes kept one for about 12% of systems, and two for 0.24%.
    - Laid out in the room as below, with these draw shares, the kept shares over the test's five sectors (1,242 systems) measure about 0.22 and 0.046.
  - **`companionsOf(system) → [{ k, class, color, size, orbit, phase, revs, tilt }]`**, memoised by `String(system.seed)` (never the id, which a pocket universe shares), from `rngOf(hash64(system.seed, 'companions'))`, drawn in this order:
    1. `u`: two wanted below `two`, one below `one + two`, else none
    2. for each wanted: the class, weighted from `STAR_CLASSES` without `O` and `B`; the size, `size × primary size`, capped at its class's most; the phase; the tilt (±0.3)
    3. the room: `lo = primary.size + gap`, `hi = min over planets of (orbit − extentOf(planet)) − gap` (`3 × primary.size − gap` with no planet). The second is dropped when `2·c₁ + gap + 2·c₂ > hi − lo`, then the first when `2·c₁ > hi − lo`.
    4. the orbits, from the inside: `orbit₁ = lo + c₁ + rng() · slack` (half the slack when there are two), where `slack` is the room less what they need. Then `orbit₂ = orbit₁ + c₁ + gap + c₂ + rng() · (hi − c₂ − (orbit₁ + c₁ + gap + c₂))`.

    `revs = revsFor(orbit)`. Every companion's whole sphere is then inside `[lo, hi]` from the star's middle, so it keeps `gap` from its star and from every planet's whole extent at every `t`, whatever its tilt.
  - **`companionAt(c, system, t) → [x, y, z]`**: a circle round `system.at`, `orbitAt`'s way, tilted about x.
  - **About:** a system with companions reads `A yellow star and a red dwarf with 3 planets, held by …` (two companions: `A yellow star, a red dwarf and a white dwarf with …`). Lane 3's `type`, `sub` and `facts` are unchanged.
  - **Companions in the far layer** (lane 2's `discs.js`), as it draws the primary:
    - Each companion is a disc candidate of its own in `pickDiscs`, at `companionAt(c, system, t)`, of radius `c.size`, emissive in `c.color`. It counts toward `budget.discs` like any disc, so the far layer's capacity is never passed (it drops the nearest past it).
    - Its alpha is `levelWeights(|cam − system.at|, { reach: systemReach(system) }).disc`: the primary's distance and reach, so the companion's disc and its primary's fade together, and both hand over at the reach where lane 2's near layer builds the system (Task 15's ball takes over behind it).
    - A companion is up to 0.3 × a primary of up to 420 (`STAR_CLASSES`' `O`), a radius of about 126: from 2,000–3,000 off, tens of pixels. Lane 2's `pops()` measures far-layer discs, so the disc's own fade-in is measured there.
  - **Companions in lane 3's cap** (`around.js`): a companion of a system takes a place among the `max` by its own distance from the middle, as its disc does in the pick. It lists no row of its own: picking it picks its system, whose row is listed by lane 3's rule. So the capped list and the pick keep the same discs.

- [ ] **Step 1: Write the failing tests:**
  - **`discs.test.js`, a new `it`:** a hand-made binary (a system run through `addBodies`, with `companionsOf` giving one companion) at a camera 10,000 from its star pushes the companion's disc at `companionAt(c, system, t)` for t in `{0, 1000}`, radius `c.size`, in `c.color`, with the same alpha as its primary; at 0.7 × its reach both alphas are 0; and with `budget.discs` 1 and the companion nearer than the primary, the companion is the one disc pushed.
  - **`around.test.js`, a new `it`:** Task 4's test (the capped list is the disc layer's pick), over the real sectors round `E:1,0` with no test lists, with companions in both: the capped rows plus one place for each companion kept equal `createDiscs`' pushes, each companion matched to its system's row.
  - Over the systems of `E:1,0`, `E:2,0`, `E:-3,1`, `E:1,0,1` and `E:5,5`:
    - the share with one companion is in `[0.15, 0.28]`, and with two in `[0.02, 0.08]` (about 0.22 and 0.046 by these rules)
    - no companion is `O` or `B`, and none is bigger than 0.3 of its primary
    - for t in `{0, 1e3, 1.7e9}`, every companion stays clear of its star by 4, of each planet's whole extent (`extentOf`) by 4, and of the other companion
  - For the first 64 systems of `E:1,0` in `UNIVERSE` and in `universeOf('marble')` (the same ids), asked in that order, `companionsOf(marbleSystem)` deep-equals `companionsOf({ ...marbleSystem, id: 'fresh:' + i })`. An id-keyed memo would hand a marble system the shared one's.
  - The about of the first binary of `E:1,0` matches `/^An? [a-z-]+ (star|giant|dwarf)( and |, )/` and still lane 3's `/^An? .+, held by .+\.$/`.
  - Lane 3's "says a system’s star…" test passes unchanged.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/expanse/gen/companions.test.js src/components/expanse/scene/discs.test.js src/components/universe/places/around.test.js`. Expected: the new tests FAIL; the existing ones pass.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them and see them pass.** Run `npx vitest run src/components/expanse src/components/universe/places`, then `node scripts/health.mjs --only boundary-breaks,cycles`. Expected: PASS; Task 1's Step 0 numbers.
- [ ] **Step 5: Commit.** `git commit -m "Binary and trinary systems: companions inside the first planet's way, drawn as discs and named on the system's card"`. The body says the far layer's specks gain the core systems' companions, on purpose.

### Task 7: Fleets and shipyards at the stations

**Files:**
- Create: `src/components/expanse/gen/extras/anchored.js`, `src/components/expanse/gen/extras/anchored.test.js`
- Modify: `extras/index.js` (lists `fleet` 50000, `shipyard` 60000), `words.js`, `things/cards.js` and its test

**Interfaces:**
- Consumes: Task 4's ctx (`stations`, `core`); lane 3's `poleHeight(system, size)` and `Station` rows (`{ id, i, system, at, size, faction, seed }`).
- Produces:
  - **`FLEET = { share: 0.5, size: [80, 220], ships: [3, 7] }`**, from `rngOf(hash64(station.seed, 'fleet'))`. The row is `{ kind: 'fleet', name, at, size, station: id, system, faction: system.faction, ships, seed }`, where `at = station.at + side · [0, 3 × station.size + size, 0]` and `side` is the sign of the station's height over its star.
  - **`YARD = { share: 0.25, size: [120, 300] }`**, from `rngOf(hash64(station.seed, 'yard'))`.
    - `h = poleHeight(system, size)` on the other pole, `at = star + [0, −side · h, 0]`; none when `h` is null.
    - The row is `{ kind: 'shipyard', name, at, size, station: id, system, seed }`.
  - Neither list makes anything in the core sector. Both keep every row of `KEEP_OUTS` clear by `9 × size`.
  - **Words:** `fleet: 'Fleet at anchor'`, `shipyard: 'Shipyard'`; abouts:
    - `fleet: 'Ships at anchor, flying their colours. Hail them.'`
    - `shipyard: 'A hull going up in its scaffold, the cranes still working.'`
  - **Cards:** both `solid: true`, `chart: { shape: 'dot', priority: 30 }`.

- [ ] **Step 1: Write the failing tests** over `E:1,0`, `E:2,0` and `E:1,0,1`:
  - the share of stations with a fleet is in `[0.38, 0.62]`, and with a shipyard in `[0.12, 0.35]`
  - a fleet sits on its station's pole, `3 × station size + size` further from the star, and flies its system's faction
  - a shipyard sits on the other pole at `poleHeight`, clear for t in `{0, 1e4, 1.7e9}` of every planet by `extentOf(p) + size`
  - `E:0,0` has none of either
  - ids resolve at `w50000…` and `w60000…`, and the rows are plain data
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/expanse/gen/extras/anchored.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them and see them pass.** Run `npx vitest run src/components/expanse src/components/universe/things`. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "Fleets at anchor over the stations' poles, and shipyards over the other"`

### Task 8: Clouds and life between the systems

**Files:**
- Create: `src/components/expanse/gen/extras/clouds.js`, `src/components/expanse/gen/extras/clouds.test.js`
- Create: `src/components/universe/things/clear.test.js`: the baseline poses stay clear. It lives on the universe side because it reads `poses.js`; it takes the generator through the face, so it adds no boundary break.
- Modify: `extras/index.js` (lists `remnant`, `storm`, `pocket`, `swarm`, `herd`, `debris` at their low ids; re-exports `NEBULA_SHOW`), `words.js`, `things/cards.js` and its test
- Modify: lane 3's `src/components/expanse/shared/space.js` and `shared.test.js`: the face lends `NEBULA_SHOW`

**Interfaces:**
- Consumes: Tasks 2, 4 and 5 (`dartIn`, `roomFor`, `nameIn`, `NEBULA_SHOW`); `PALETTE`, `tint` and Task 1's `hexOf`.
- Produces: one maker a list, each from `rngOf(hash64(ctx.seed, list))`, making nothing in the core. Counts and sizes are the table's.
  - **`pocket`:** `{ kind: 'pocket', name, at, size, colors: [c0, c1], form: 'cloud', seed }`. The colours are `hexOf(tint(a, 0.15))` and `hexOf(tint(b, 0.3))`, for two different names from `['nebula', 'engine', 'shot', 'sun']`. Placed with `show: true`.
  - **`remnant`:** `{ kind: 'remnant', …, colors: [engine 0.2, shot 0.25], form: 'shell' }`, with `show: true`.
  - **`swarm`:** for each of the sector's pockets, then each legacy wonder of kind `nebula`, in order, nine at most. It sits at the nebula's middle with `path: { type: 'loop', centre: nebula.at, radius: 0.35 × nebula.size, revs: 4–12, phase, normal, ref }`, `nebula: id`, `extent: radius`.
    - Every swarm keeps the near things' rule from all of `KEEP_OUTS`, `9 × size + extent`: it is drawn near, not by the nebula renderer, so `NEBULA_SHOW` isn't its rule.
    - One in a pocket always passes, since the pocket keeps `NEBULA_SHOW + size` off. One in a legacy nebula that doesn't pass is left out.
  - **`storm`:** first a system with `hazard === 'storm'` (the first with room, 6,000 to 20,000 from its star), then the cube. It has `path: loop` with radius `0.4–1 × size` and revs 2–6.
  - **`herd`:** `path: loop` with radius 3,000–8,000 and revs 2–5, `bodies: 5–12`.
  - **`debris`:** a plain row.
  - **Words:**
    - `pocket: 'Nebula'`, `remnant: 'Supernova remnant'`, `storm: 'Ion storm'`, `herd: 'Leviathan herd'`, `swarm: 'Swarm'`, `debris: 'Battle debris'`
    - abouts:
      - `pocket: 'A pocket of glowing gas. Fly in.'`
      - `remnant: 'The shell a star threw off when it blew. Fly through it.'`
      - `storm: 'An ion storm, drifting. Inside it the shields drain.'`
      - `herd: 'A herd of space leviathans going their own way.'`
      - `swarm: 'Glowing drifters that live in the nebula.'`
      - `debris: 'What’s left of an old battle. Salvage what you can.'`
  - **Cards:**
    - `pocket` and `remnant`: `solid: false`, `far: NEBULA_SHOW`, `chart: { shape: 'cloud', priority: 35 }`
    - `storm`, `herd` and `swarm`: `solid: true` (parked outside, not inside), `move: rowAt`, `chart: { shape: 'dot', priority: 30 }`
    - `debris`: `solid: false`, `chart: { shape: 'dot', priority: 15 }`

- [ ] **Step 1: Write the failing tests** over the 26 non-core sectors of the 27 round home, with `{ lattice: false }`, made once in `beforeAll`:
  - each list's count in each sector is within the table's range, swarms aside
  - **swarms,** in each sector:
    - at most `min(9, pockets + legacy nebulae)`
    - exactly one in each pocket (pockets come first, and six at most fit under nine)
    - every legacy nebula without one, among the first `9 − pockets`, fails the rule at the largest swarm: some row `k` of `KEEP_OUTS` has `|nebula.at − k.at| < k.r + 9 × 200 + 0.35 × nebula.size`. (A swarm left out failed at its own size, at most 200, so it fails at 200 too; the test needn't replay the rng.) A legacy nebula of `E:0,−1` near the pocket's keep-out (r 8,966 at z −66,000) is the case this is for.
  - `E:0,0` has none of them
  - every pocket and remnant is clear of every row of `KEEP_OUTS` (all 27, not `keepOutsNear`) by `NEBULA_SHOW + size`, and every storm, herd, debris field and swarm by `9 × size + extent`
  - no two rows of these lists overlap, swarms in their own nebula aside
  - for t in `{0, 3e4, 1e10}`, a swarm is within `0.35 × its nebula's size + 1e-6` of its nebula's middle
  - `pathSpeed` is under 2.5 for every storm and under 4 for every herd
  - pocket colours are two different palette tints, and `form` is `cloud` or `shell`
  - ids: the first pocket of `E:1,0` is `w22`, the first swarm `w28`, the first debris field `w40`
  - rows are plain data
  - **`things/clear.test.js`, the baseline poses** (Review Focus 3). Its points are `poseFor(name).at` and `.eye` (where there is one) for every pose named in `lab/universe/baseline/mid.json`'s `poses`, read with `fs`, so the list follows the baseline. Every one of them is inside a core keep-out, the overview's camera inside the home one. Over the 27 sectors round home (`{ lattice: false }`, through the face), from every point:
    - no pocket or remnant is within `NEBULA_SHOW + size`, so none is drawn
    - no list row of a kind with `KINDS[kind].near` is within `THING_NEAR × size + (extent ?? 0)`, so none is built at any `t`. A mover is measured from its path's middle (`path.focus` or `path.centre`), since its `extent` is its reach from there.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/expanse/gen/extras/clouds.test.js src/components/universe/things/clear.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them and see them pass.** Run `npx vitest run src/components/expanse src/components/universe/things`, then `node scripts/health.mjs --only boundary-breaks,cycles`. Expected: PASS, lane 2's density test included; Task 1's Step 0 numbers.
- [ ] **Step 5: Commit.** `git commit -m "Nebula pockets, supernova remnants, swarms, ion storms, leviathan herds and battle debris between the systems"`

### Task 9: Dead stars, young stars and wormholes

**Files:**
- Create: `src/components/expanse/gen/extras/stars.js`, `src/components/expanse/gen/extras/stars.test.js`
- Modify: `extras/index.js` (lists `wormhole`, `pulsar`, `protostar`), `words.js`, `things/cards.js` and its test
- Modify: lane 3's `src/components/expanse/shared/space.js` and `shared.test.js`: the face lends `wormholeExit`

**Interfaces:**
- Consumes: Tasks 3–5; `beaconsOf` (`sector.js`); `sectorSeedOf`, `sectorKey`.
- Produces:
  - **`pulsar`:** each row is a `pulsar` with chance 0.7, else a `magnetar`, with `extent: 25 × size`. Lane 3's legacy `pulsar` card is reused for generated pulsars.
  - **`protostar`:** a plain row.
  - **`wormhole`:** one, size 60–140. Its row also carries `sector: [sx, sy, sz]`, plain data, for `wormholeExit`.
  - **`wormholeExit(from, universe) → { sector: [sx, sy, sz], key, at, heading, side }`**, where `from` is `{ seed, sector: [sx, sy, sz] }` (a wormhole row is one). It is the one rule for a one-way throw: lane 4b's rift passes its own `{ seed, sector }` rather than make a second rule (hand-off notes). From `rngOf(hash64(from.seed, 'exit'))`:
    - a distance of 30–80 sectors, along a uniform random direction in 3D, from the wormhole's sector
    - one of that sector's four beacons (`beaconsOf(sx, sz, sectorSeedOf(universe, sx, sy, sz), sy)`), picked by the rng
    - `at` is 150 out past the beacon, along its side's normal, and `heading` faces into the sector
  - **Words:**
    - `magnetar: 'Magnetar'`, `protostar: 'Forming star'`, `wormhole: 'Wormhole'`
    - abouts:
      - `magnetar: 'A dead star with a field strong enough to scramble a ship’s screens.'`
      - `protostar: 'A star still forming in its disc of dust.'`
      - `wormhole: 'A tear in space. Fly in and it throws you far away, one way only.'`
  - **Cards:**
    - `magnetar` and `protostar`: `solid: true`, `chart: { shape: 'star', priority: 30 }`
    - `wormhole`: `solid: true` (parked outside its throat), `chart: { shape: 'hole', priority: 40 }`

- [ ] **Step 1: Write the failing tests** over the 26 non-core sectors round home:
  - every one has a wormhole; pulsars and magnetars together number 1–3, as do forming stars
  - the share of magnetars among them all is in `[0.15, 0.45]`
  - pulsars and magnetars are clear of every row of `KEEP_OUTS` by `9 × size + 25 × size`
  - **Exits:**
    - every wormhole's exit is 30 to 80 sectors from its own, by straight-line distance in sector units, and never the core
    - its `at` is 150 from one of that sector's beacons
    - it is the same on a second call
    - `universeOf('marble')`'s wormholes in the same sectors exit elsewhere
  - ids at `w8`, `w12…` and `w15…`; plain data
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/expanse/gen/extras/stars.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them and see them pass.** Run `npx vitest run src/components/expanse src/components/universe/things`. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "Pulsars, magnetars, forming stars and one-way wormholes between the systems"`

### Task 10: Gargantuans in the generator

**Files:**
- Create: `src/components/expanse/gen/gargantuans.js`, `src/components/expanse/gen/gargantuans.test.js`
- Modify: `src/components/expanse/gen/space.js` (`fullSector`, which gains the option `arrivals`, for tests):
  - after the legacy pass, `g = hasGargantuan(…) ? gargantuanOf(universe, sx, sy, sz, sector) : null`
  - `arrivals` defaults to `ARRIVAL_GARGANTUANS` in the shared universe's core sector and `[]` everywhere else
  - `big = [g, ...arrivals]` without the null. Then `appendSystems(sector, [...outs, ...big.map((b) => ({ id: 'gargantuan', at: b.at, r: b.size + GARGANTUAN.systems }))])` (the rows get their ids from their lists, after).
  - the ctx `thingsOf` gets has `gargantuan: g`, `arrivals` and `keeps: big.flatMap(gargantuanKeeps)`, and `outs` stays lane 2's keep-outs
- Modify: `src/components/expanse/gen/things.js`: the lattice's cell keeps clear of `ctx.keeps` as it does of `ctx.outs`, by `(THING_NEAR + 1) × size` (one concatenation in `prepare`, made once a ctx)
- Modify: `src/components/expanse/gen/extras/place.js`: `roomFor` keeps every list row clear of `ctx.keeps` by its size and extent. The show rule's `NEBULA_SHOW` is for the keep-outs alone, or a pocket would keep 40,000 off a gargantuan.
- Modify: `extras/index.js` (lists `gargantuan` at base 3, max 1, giving `[ctx.gargantuan]` or `[]`; and `arrival` at base 4, max 4, giving `ctx.arrivals`), `words.js`, `things/cards.js` and its test
- Modify: lane 3's `src/components/universe/places/around.test.js` (a new `it`; `around.js` itself is unchanged here). A gargantuan's forms have `disc` 0, so Task 4's rule already lists it outside the cap, by its card's `far`, 400,000.
  - Why it matters: `placesAround` keeps the nearest `max` disc rows by distance (400 on low, 1,200 on mid), and about 1,700 lattice things lie within the far plane of any point.
  - A gargantuan is always in a neighbouring sector, 60,000 to 170,000 off, so in the cap it would be cut. Its impostor would be on the sky, but it couldn't be picked, tagged or carded, against "every place you see, you can pick".
- Modify: lane 3's `src/components/expanse/shared/space.js` and `shared.test.js`: the face lends `GARGANTUAN_FORMS`, `GARGANTUAN`, `gargantuanSectors`, `formOf`, `gargantuanKeeps`, `ARRIVAL_BASE`, `ARRIVAL_GARGANTUANS` and `checkGargantuan`
- Modify: `src/components/universe/things/clear.test.js` (Task 8's; a new `it`)

**Interfaces:**
- Consumes: `KEEP_OUTS`, `clearOfKeepOuts`, `makeSector`'s legacy rows, `CUBE_HALF` (`cube.js`), `FAR` (45,000: lane 2's `levels.js` value, restated here as `GARGANTUAN.far` because `expanse/gen` imports nothing from `expanse/scene`; Task 11's face test ties the two), `PLANET_SIZE`; lane 3's `placesAround`, `AROUND` and `pickPlace`.
- Produces:
  - **`GARGANTUAN_FORMS = ['hole', 'arc', 'hulk', 'giant', 'dyson']`**, equal weights
  - **`GARGANTUAN = { far: 45000, tries: 200, home: 20000, systems: 2000 }`**, and each form's dimensions, as the table in Global Constraints
  - **`residuesOf(universe) → [a, b, c]`**: from `h = hash64(universe, 'gargantuans')`, `a = h mod 3`, `b = (h >> 8) mod 3`, `c = (h >> 16) mod 3`. When all are nought, `c = 1`.
  - **`hasGargantuan(universe, sx, sy, sz) → boolean`**, with a mod that's never negative
  - **`formOf(universe, sx, sy, sz) → form`**: the first draw of `rngOf(hash64(sectorSeedOf(universe, sx, sy, sz), 'gargantuan'))`. It is cheap: no sector is made.
  - **`gargantuanOf(universe, sx, sy, sz, legacy) → row | null`**. The same rng draws: the form, its dimensions, `axis` (a unit), `light` (a unit), the two colours, the name, then the darts. `legacy` is `{ systems, wonders, beacons }`.
    - The darts land in the cube `CUBE_HALF − size` round the sector's middle and must clear every row of `KEEP_OUTS` (`clearOfKeepOuts(at, GARGANTUAN.far + size)`, its default `outs`), and the legacy rows as Global Constraints says. Its header says why not `keepOutsNear`: it is empty for four of the core's six face neighbours.
    - The row is `{ kind: form, gargantuan: true, name, at, size, body, band?, span?, mid?, axis, light, colors: [hex, hex], seed }`.
    - The colours: `hole` `[sun 0, shot 0.1]` (as the Maw's), `arc` `[bone 0, engine 0.3]`, `hulk` `[grey 0, shot 0]`, `giant` two of `[sun, bone, shot, engine, nebula]` at 0.2, `dyson` `[sun 0, star 0]`.
  - **`gargantuanKeeps(row) → [{ at, r }]`**, the solid parts as spheres:
    - `hole`: one, `body × 1.6`
    - `arc`: along the band every `band` units of arc, each `band`
    - `hulk`: along the spine every `0.2 × size`, each `0.14 × size`
    - `giant`: one, `size × 1.05`
    - `dyson`: one, `body × 3`
  - **`ARRIVAL_BASE = 4`, `ARRIVAL_MAX = 4`, `ARRIVAL_GARGANTUANS = []`**: lane 4c's rows, in the core sector at `w4` to `w7`. The core's appended systems, lattice and lists keep off each, as off a generated one.
  - **`checkGargantuan(row) → row`**: throws `TypeError` on a form not in the list, a non-finite `at`, a `size` outside 20–200 × `PLANET_SIZE`, or a missing `axis`. Lane 4c's own test runs it over its rows.
  - **`gargantuanSectors(universe, from: [sx, sy, sz], { form = null, n = 1, ring = 12 }) → [[sx, sy, sz], …]`**: the nearest `n` gargantuan sectors with that form (any, if null), out to Chebyshev `ring`. Nearest first by straight-line distance in sector units, ties broken by `sectorKey`. It reads residues and `formOf` only.
  - **Words:** `hole: 'Black hole'`, `arc: 'Ringworld arc'`, `hulk: 'Derelict hulk'`, `giant: 'Supergiant'`, `dyson: 'Dyson swarm'`, and abouts:
    - `hole: 'A black hole, its disc burning round the dark.'`
    - `arc: 'A ringworld left unfinished: a band of land as wide as a world, curving round nothing.'`
    - `hulk: 'A dead ship the size of a moon.'`
    - `giant: 'A gas giant big enough to swallow a system, a storm turning on its face.'`
    - `dyson: 'A star wrapped in a swarm of collectors, most of its light caught.'`
  - **Cards:** each form `solid: true` (parked outside its whole extent), `far: 400000`, `chart: { shape: 'hole' for hole, 'star' for dyson, else 'dot', priority: 80 }`.

- [ ] **Step 1: Write the failing tests:**

```js
import { describe, expect, it } from 'vitest';
import { SECTOR, spaceId } from '../../../lib/space/address.js';
import { KEEP_OUTS, clearOfKeepOuts, keepOutsNear } from './keepOuts';
import { CUBE_HALF } from './cube';
import { beaconsOf, makeSector } from './sector';
import { UNIVERSE, sectorSeedOf, universeOf } from './seed';
import { addBodies } from './systems';
import { fullSector } from './space';
import { PLANET_SIZE } from './catalogue';
import { ARRIVAL_BASE, GARGANTUAN, GARGANTUAN_FORMS, checkGargantuan, formOf, gargantuanKeeps, gargantuanOf, gargantuanSectors, hasGargantuan, residuesOf } from './gargantuans';

const len = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const near = (r) => { const out = []; for (let x = -r; x <= r; x++) for (let y = -r; y <= r; y++) for (let z = -r; z <= r; z++) out.push([x, y, z]); return out; };
// (what fullSector hands gargantuanOf: the middle layer's own on sy 0, and above or below it no systems or wonders and the sector's own beacons, space.js's legacy pass)
const legacy = (u, sx, sy, sz) => (sy === 0 ? addBodies(makeSector(u, sx, sz)) : { systems: [], wonders: [], beacons: beaconsOf(sx, sz, sectorSeedOf(u, sx, sy, sz), sy) });

describe('gargantuans', () => {
  it('is in exactly one sector of every 3 × 3 × 3, and never the core', () => {
    for (const u of [UNIVERSE, universeOf('marble'), universeOf('ab')]) {
      expect(residuesOf(u).every((v) => v >= 0 && v < 3)).toBe(true);
      expect(hasGargantuan(u, 0, 0, 0)).toBe(false);
      for (const [cx, cy, cz] of [[0, 0, 0], [1, 0, 0], [-7, 3, 12], [250, -250, 40], [0, -1, 0]]) {
        const n = near(1).filter(([x, y, z]) => hasGargantuan(u, cx + x, cy + y, cz + z)).length;
        expect(n, `${cx},${cy},${cz}`).toBe(1);
      }
    }
    for (let i = 0; i < 40; i++) expect(hasGargantuan(universeOf(`w${i}`), 0, 0, 0)).toBe(false);
  });
  it('tests the far rule against keep-outs that keepOutsNear leaves out', () => {
    expect(keepOutsNear(1, 0, 0)).toEqual([]); // (so a test against it would pass for nothing)
  });
  it('places one in every gargantuan sector near home, far from every hand-made place', () => {
    for (const [sx, sy, sz] of near(4).filter((c) => hasGargantuan(UNIVERSE, ...c))) {
      const g = gargantuanOf(UNIVERSE, sx, sy, sz, legacy(UNIVERSE, sx, sy, sz));
      expect(g, `${sx},${sy},${sz}`).not.toBeNull();
      expect(len(g.at, [0, 0, 0])).toBeGreaterThanOrEqual(GARGANTUAN.home);
      expect(clearOfKeepOuts(g.at, GARGANTUAN.far + g.size, KEEP_OUTS)).toBe(true); // every row, not keepOutsNear's
      for (const s of legacy(UNIVERSE, sx, sy, sz).systems) expect(len(g.at, s.at)).toBeGreaterThanOrEqual(s.reach + g.size + 2000);
      for (const b of Object.values(legacy(UNIVERSE, sx, sy, sz).beacons)) expect(len(g.at, b.at)).toBeGreaterThanOrEqual(3000 + g.size);
      for (let a = 0; a < 3; a++) expect(Math.abs(g.at[a] - [sx, sy, sz][a] * SECTOR)).toBeLessThanOrEqual(CUBE_HALF - g.size);
    }
  });
  it('finds room for it in a pocket universe too, so every 3 × 3 × 3 there has one', () => {
    // (the guarantee rests on the darts never all failing; UNIVERSE alone would test one draw of the residues)
    for (const u of [universeOf('marble'), universeOf('ab')]) {
      const c = near(1).find((x) => hasGargantuan(u, ...x));
      expect(gargantuanOf(u, ...c, legacy(u, ...c)), String(c)).not.toBeNull();
    }
  });
  it('is 20 to 200 planets across, and seen from across a sector', () => {
    for (const [sx, sy, sz] of near(4).filter((c) => hasGargantuan(UNIVERSE, ...c))) {
      const g = gargantuanOf(UNIVERSE, sx, sy, sz, legacy(UNIVERSE, sx, sy, sz));
      expect(g.size / PLANET_SIZE).toBeGreaterThanOrEqual(20);
      expect(g.size / PLANET_SIZE).toBeLessThanOrEqual(200);
      const px = ((2 * Math.atan(g.size / SECTOR)) / ((34 * Math.PI) / 180)) * 1080;
      expect(px).toBeGreaterThanOrEqual(20);
    }
  });
  it('comes in five forms, every one of them within four sectors of home', () => {
    const forms = new Set(near(4).filter((c) => hasGargantuan(UNIVERSE, ...c)).map((c) => formOf(UNIVERSE, ...c)));
    expect([...forms].sort()).toEqual([...GARGANTUAN_FORMS].sort());
  });
  it('keeps systems out of it and things off its solid parts, at w3', () => {
    const c = near(1).find((x) => hasGargantuan(UNIVERSE, ...x));
    const s = fullSector(UNIVERSE, ...c);
    const g = s.extras.gargantuan[0];
    expect(g.id).toBe(spaceId(c, { wonder: 3 }));
    for (const sys of s.systems.slice(s.legacy.systems)) expect(len(sys.at, g.at)).toBeGreaterThanOrEqual(g.size + 2000 + sys.reach - 1e-6);
    const keeps = gargantuanKeeps(g);
    for (let i = 0; i < s.things.count; i++) {
      const at = [0, 1, 2].map((k) => s.origin[k] + s.things.at[3 * i + k]);
      expect(clearOfKeepOuts(at, 9 * s.things.size[i], keeps)).toBe(true);
    }
  });
  it('holds the arrival’s at w4 on, in the core of the shared universe only, and keeps the core off it', () => {
    expect(ARRIVAL_BASE).toBe(4);
    expect(fullSector(UNIVERSE, 0, 0, 0, { lattice: false }).extras.arrival).toEqual([]);
    expect(fullSector(UNIVERSE, 0, 0, 0, { lattice: false }).extras.gargantuan).toEqual([]);
    const row = checkGargantuan({ kind: 'hole', gargantuan: true, name: 'Test', at: [30000, 0, 30000], size: 4000, body: 400, axis: [0, 1, 0], light: [1, 0, 0], colors: ['#000000', '#ffffff'], seed: 7n });
    const s = fullSector(UNIVERSE, 0, 0, 0, { arrivals: [row] });
    expect(s.extras.arrival[0]).toMatchObject({ id: spaceId([0, 0, 0], { wonder: 4 }), at: row.at });
    for (const sys of s.systems.slice(s.legacy.systems)) expect(len(sys.at, row.at)).toBeGreaterThanOrEqual(row.size + 2000 + sys.reach - 1e-6);
    const keeps = gargantuanKeeps(row);
    for (let i = 0; i < s.things.count; i++) {
      const at = [0, 1, 2].map((k) => s.origin[k] + s.things.at[3 * i + k]);
      expect(clearOfKeepOuts(at, 9 * s.things.size[i], keeps)).toBe(true);
    }
    expect(fullSector(universeOf('marble'), 0, 0, 0, { lattice: false }).extras.arrival).toEqual([]);
  });
  it('finds the nearest of a form without making a sector', () => {
    const got = gargantuanSectors(UNIVERSE, [0, 0, 0], { form: 'arc', n: 2 });
    expect(got).toHaveLength(2);
    for (const c of got) expect([hasGargantuan(UNIVERSE, ...c), formOf(UNIVERSE, ...c)]).toEqual([true, 'arc']);
    expect(Math.hypot(...got[0])).toBeLessThanOrEqual(Math.hypot(...got[1]));
  });
  it('is the same every time, and a pocket universe’s own', () => {
    const c = near(1).find((x) => hasGargantuan(UNIVERSE, ...x));
    expect(gargantuanOf(UNIVERSE, ...c, legacy(UNIVERSE, ...c))).toEqual(gargantuanOf(UNIVERSE, ...c, legacy(UNIVERSE, ...c)));
    expect(residuesOf(universeOf('marble'))).not.toEqual(residuesOf(UNIVERSE)); // (if it happens to match, pick another word and say so)
  });
});
```

  Also:
  - `checkGargantuan` throws on each bad row named above, and passes every generated row.
  - **`things/clear.test.js`, a new `it`:** from every point of the ten baseline poses (Task 8's), every gargantuan of the 27 sectors round home is at least `GARGANTUAN.far + size` off, so its mesh is never built there (Task 19 ties `1.2 × nearOf` under `GARGANTUAN.far`).
  - **Lane 3's `around.test.js`, a new `it`:**
    - Take the home block's gargantuan, a camera 100,000 from it on the line to home, and the sectors within Chebyshev 1 of the camera's and of the gargantuan's, lattice and all.
    - `placesAround(sectors, cam, 0, { ...AROUND, max: 400 })` lists the gargantuan, and still keeps exactly 400 of the disc kinds besides the moons, stations and it.
    - `pickPlace` with a camera at `cam` looking at it, and the test's `project`, picks its id at the screen's middle.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/expanse/gen/gargantuans.test.js src/components/universe/things/clear.test.js src/components/universe/places/around.test.js`. Expected: the new tests FAIL; lane 3's existing ones pass.
- [ ] **Step 3: Implement**, and wire `fullSector`. The `space.js` change says why the gargantuan comes before appended systems: a system appended into a black hole's disc couldn't be moved after.
- [ ] **Step 4: Run them and see them pass.** Run `npx vitest run src/components/expanse src/components/universe/places src/components/universe/things`, then `node scripts/health.mjs --only boundary-breaks,cycles`. Expected: PASS. Lane 2's `space.test.js` counts, density, fingerprint and speed, and lane 3's tests, are unchanged; Task 1's Step 0 numbers.
- [ ] **Step 5: Commit.** `git commit -m "Gargantuans: exactly one in every 3 × 3 × 3, never the core, clear of the hand-made places by the far plane"`. The body says which sectors near home hold one, and that appended systems in those sectors moved (nothing stored names them: finding 4).

### Task 11: The catalogue holds, the finder and the face

**Files:**
- Create: `src/components/expanse/gen/finder.js`, `src/components/expanse/gen/holds.test.js`
- Modify: lane 3's `src/components/expanse/shared/space.js` and `src/components/expanse/shared/shared.test.js` (the rest of the names lent, and the whole list pinned)
- Modify: lane 3's `src/components/universe/places/weight.test.js`: `GENERATOR` names this lane's generator files too
- Modify: lane 3's `src/components/universe/places/around.test.js` (a new `it`, with every list in)
- Modify: `src/components/expanse/gen/things.test.js`: a new `it` pins `EXTRA_LISTS`

**Interfaces:**
- Consumes: Tasks 1–10; lane 3's `stations`; lane 2's `FAR`, `FADE` and `levelWeights` (`expanse/scene/levels.js`, pure).
- Produces:
  - **`kindsIn(sectors) → Map<kind, number>`**: how many of each kind the sectors hold. `sectors` is any iterable of sectors: a caller holding lane 2's `Map` passes `map.values()`.
    - systems, as `system`
    - systems with companions, also as `binary` and `trinary`
    - stations, the lattice's kinds, every list's kinds, and legacy wonders' kinds
  - **`nearestOfKind(sectors, kind, at: [x, y, z], t = 0) → { id, kind, at, sector } | null`**: the nearest row of that kind, measured at `rowAt(row, t)`, over any iterable of sectors. It also takes `binary` and `trinary`, and `gargantuan` for any form.
  - **`EXTRA_LISTS`**, final: `['gargantuan', 'arrival', 'wormhole', 'remnant', 'pulsar', 'protostar', 'storm', 'pocket', 'swarm', 'herd', 'debris', 'field', 'comet', 'rig', 'fleet', 'shipyard']`
  - **The face** `expanse/shared/space.js` lends, besides lane 3's names:
    - from earlier tasks: `KINDS`, `lookOf`, `traitsOf` (Task 3); `rowAt`, `pathAt`, `pathSpeed`, `COMET_PERIOD`, `tailOf` (Task 5); `companionsOf`, `companionAt` (Task 6); `NEBULA_SHOW` (Task 8); `wormholeExit` (Task 9); `GARGANTUAN_FORMS`, `GARGANTUAN`, `gargantuanSectors`, `formOf`, `gargantuanKeeps`, `ARRIVAL_BASE`, `ARRIVAL_GARGANTUANS`, `checkGargantuan` (Task 10)
    - from this task: `CATALOGUE`, `solidOf`, `PLANET_SIZE`, `EXTRA_HIGH`, `EXTRA_LISTS`, `kindsIn`, `nearestOfKind`
    - and lane 2's `FAR`, `FADE` and `levelWeights`, from `../scene/levels`, which the drawers (Task 13) and the gargantuans (Tasks 19 and 20) import through it and nowhere else
    - The light face is unchanged.
  - **`GENERATOR`** in `weight.test.js` becomes:

    ```js
    const GENERATOR = /^src\/components\/expanse\/gen\/(space|sector|systems|things|stations|tables|names|keepOuts|grid|job|catalogue|gargantuans|finder|companions)\.js$|^src\/components\/expanse\/gen\/extras\/[^/]+\.js$|^src\/components\/universe\/places\/(resolve|cards)\.js$|^src\/components\/universe\/things\/(cards|rules)\.js$|^src\/components\/universe\/gargantuans\/rules\.js$/;
    ```

    `paths.js` and `cube.js` stay off it, as lane 3 left `orbits.js` and `extent.js` off: `cube.js` imports nothing and `paths.js` only `orbits.js`, so a later lane may take `rowAt` into what `nav.js` loads (through the light face) at no weight.

- [ ] **Step 1: Write the failing tests** in `holds.test.js`. Its `beforeAll` makes the 27 sectors round home with the lattice, and the 27 round `[5, 2, −9]` with `{ lattice: false }`.
  - **Every entry, in both blocks:** every one of the 23 catalogue entries has at least one of its kinds in `kindsIn`. Every list and lattice kind but the gargantuan forms has at least one row. Exactly one gargantuan row is in each block.
  - **Each non-core sector of the home block** holds at least one wormhole, remnant, pulsar or magnetar, forming star, storm, pocket, herd and debris field, and between 60 and 400 list rows in all.
  - **The core sector** holds only kinds whose `core` is true, and no gargantuan within 20,000 of home.
  - **Lane 2's density targets hold** with every list in: a copy of `density.test.js`'s two checks in a new `describe`, over the home block's sectors as this lane makes them. Lane 2's own file is unchanged and must pass too.
  - **The finder:**
    - `nearestOfKind(home block, 'comet', [0, 0, 0], 1234)` is the comet nearest at `rowAt(·, 1234)`, against a brute-force scan
    - `nearestOfKind(…, 'binary', …)` is a system with a companion
    - `nearestOfKind(…, 'gargantuan', …)` is the block's gargantuan
  - **Ids:**
    - `placeOf(UNIVERSE, id)` gives back the same row for every row of every list of `E:1,0`, a sample of 400, and for each id in lower case
    - making `E:1,0` after `E:2,0`, or alone, gives deep-equal lists
  - **The finder takes lane 2's `Map`:** `nearestOfKind(new Map(blocks.map((x) => [x.id, x])).values(), 'comet', [0, 0, 0], 1234)` equals the array call's.
  - **The face:** `shared.test.js` pins its sorted names, and `GARGANTUAN.far` equals `FAR`, both read through it.
  - **Lane 3's `around.test.js`, a new `it`: what's listed is what's drawn, with every list in.** Task 6's test again, over the 27 real sectors round `E:1,0` as this lane makes them, at `max` 400 (low's `discs`) and at a point in each of three sectors (`E:1,0`'s middle plus `[7000, 3000, −2000]`, `E:2,0`'s middle, and the home block's gargantuan sector's middle): the capped rows plus companions' places equal `createDiscs`' pushes, and every disc-0 row within its card's `far` is listed besides.
  - **`weight.test.js`:** passes with the wider `GENERATOR`, unchanged otherwise (no file of this lane's is on `nav.js`'s, ⌘K's or the home page's imports).
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/expanse/gen/holds.test.js src/components/expanse/shared src/components/universe/places/weight.test.js src/components/universe/places/around.test.js`. Expected: FAIL. `weight.test.js` passes already (it pins what must stay true), and so should the new `around.test.js` `it` (Tasks 4 and 6 made the rule; this pins it with every list in): if it fails, the fault is in a list's `disc` or card, found and fixed here.
- [ ] **Step 3: Implement** `finder.js`, the face and the regex.
- [ ] **Step 4: Run the gate for PR group 4a.1.**
  - Run `npm run lint`, `npm test`, `npm run build` and `node scripts/health.mjs --check --skip build`. Expected: all green; `boundary-breaks`, `cycles` and `big-files` as Task 1's Step 0; `glsl-sites` unchanged.
  - Run `node scripts/universe-check.mjs --quality mid --out lab/universe/after-4a-11/mid` against `before-4a/mid`. Expected:
    - calls and triangles equal at every pose
    - pictures changed only by the far layer's specks: the lattice's new mix, the core's fields, comets and rigs, and its systems' companions. Put the pairs side by side in the README.
    - A call or triangle more, or any other change, is a stop: find it in Tasks 3–10.
- [ ] **Step 5: Commit.** `git commit -m "Every kind of the catalogue in every 3 × 3 × 3, the density targets still held, and a finder for each"`. The body gives a sector's counts (`E:1,0`'s list rows by kind), the ten-sector time before and after this group, and the mid poses' calls and triangles against the before.

---

## PR 4a.2: Drawn

### Task 12: The tier table's rows for things and gargantuans

**Files:**
- Modify: lane 2's `src/components/universe/budget.js` and `budget.test.js` (a new `describe`)

(The before shots this task used to take are Task 1's Step 0, and the near and far layers' reading of the catalogue is Task 4: both had to come before PR group 4a.1 changed what the far layer draws.)

**Interfaces:**
- Consumes: lane 2's `BUDGET` and `universeBudget`.
- Produces:
  - **`BUDGET[tier].thingKinds = { rocks, pieces, bodies, panels }`**, as the Global Constraints table, stepped by `universeBudget` with lane 2's factors and never below 1
  - **`gargantuan`** stepping: one level down from step 2 (`high` → `mid` → `low`), `low` at the floor

- [ ] **Step 1: Write the failing tests.** `budget.test.js`, `describe('things and gargantuans (lane 4a)')`:
  - the `thingKinds` rows equal the table at every tier
  - each count is non-decreasing from low to ultra
  - at every step and floor, no count rises, and none goes below 1
  - `universeBudget({ tier: 'high' }, 2).gargantuan` is `'mid'`; `universeBudget({ tier: 'mid' }, 0, true).gargantuan` is `'low'`
  - **If lane 2's "The table as above" pins whole rows** with `thingKinds: {}` (with `toEqual`), its expected rows gain this lane's `thingKinds` counts, in this commit. That adds to the test and loosens nothing, as lane 3 did for `tags`. Every other assertion of lane 2's and lane 3's stays as it is.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/budget.test.js`. Expected: the new tests FAIL; lane 2's and lane 3's pass. (Lane 2's table test, if its expected rows had to grow, fails with them until Step 3 and passes after.)
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them and see them pass.** Run `npx vitest run src/components/universe src/components/expanse`. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "The tier table's rows for a field's rocks, debris, creatures and a Dyson swarm's panels, and the gargantuans' detail by step"`. If lane 2's table test's expected rows grew, the body says so: the `thingKinds` counts were added to its rows, and nothing in it was loosened.

### Task 13: The drawers' kit, and the rocks: rocks, ice, fields, rigs and comets

**Files:**
- Create:
  - `src/components/universe/things/layout.js`, `src/components/universe/things/layout.test.js`
  - `src/components/universe/things/drawers.js`, `src/components/universe/things/drawers.test.js`
  - `src/components/universe/things/looks/rocks.js`, `src/components/universe/things/looks/comet.js`

**Interfaces:**
- Consumes: Task 4's entries; Task 12's `thingKinds`; lane 2's `levelWeights` and `THING_NEAR` and Task 5's `tailOf`, all through `expanse/shared/space.js` (Task 11), never `expanse/scene/levels.js` itself; `rock`, `rockMaterial` (`lib/three/rock.js`); `universe/kit.js`'s `paint` (`kit.js:32-41`, a canvas from `document.createElement`) and `glowMat`; `PALETTE`, `tint`; the scene's texture set `T` (`scene.js:647`, `loadTextures`), for `kit.js`'s `hull(T, color)` (`kit.js:175`).
- Produces:
  - **`createThingDrawers(group, { budget, tier, prepare, rocks = null, textures = {} }) → { drawers, drawn(), fields(), dispose() }`**
    - `group` holds the warm-up meshes (below). `createThings` passes a group of its own under the map.
    - `budget` is a thunk giving the row, so `setStep` reaches the drawers.
    - `textures` is the scene's `T`, for `hull()`. With `{}` (the tests' stand-in), `hull` gets no maps (`tiled(undefined)` is null, `kit.js:12`) and still makes its material.
    - `drawers[kind](g, ctx) → { update(entries, camera, t), dispose() }` is lane 2's hook, `g` lane 2's group. This task fills `rock`, `ice`, `field`, `icefield`, `rig` and `comet`; Tasks 14–16 add the rest. Each kind with `near: false` gets a drawer that draws nothing, so lane 2's ball never stands in for it.
    - `drawn() → { [kind]: instances shown }`, for the dev hooks
    - `fields() → [{ id, rocks: [{ x, y, z, r }], hidden: Set<index> }]`: the near fields' rocks, for the bolts (Task 24)
    - `rocks`: Task 21's registry. A field coming near is added with `{ id, grid: rockGrid(rocks, 20), box: boxOf(rocks), field: { hide(i), show(i) } }`, and removed when it goes.
  - **The drawer contract**, which every drawer of Tasks 13–16 keeps (Global Constraints, "Warm-up"):
    - Its materials and shared geometry are made when `createThingDrawers` is, each on one hidden mesh in `group` of the kind that draws it (an `InstancedMesh` of count 1, with `instanceColor` when the drawer uses one). The scene's start-up `prepareScene` compiles them. **`prepare` isn't called then**, nor by a factory `drawers[kind](g, ctx)`, which lane 2 may call while the scene is being made.
    - Every mesh made after that (a drawer's `InstancedMesh`es, a near field's own rocks, a rogue's body) is passed to `prepare(mesh)` once, from the first `update` that has something for it, and shown when that resolves.
    - an `InstancedMesh` per part, sized from `budget()`, with `visible = count > 0`
    - an entry is shown when `levelWeights(dist, { reach: THING_NEAR × size }).full > 0.01`
    - `dispose()` frees what it made and empties what it added
  - **Pure layouts** in `layout.js`, each seeded from the row's seed:
    - `fieldRocks(row, n) → [{ x, y, z, r, shape }]`: `n` rocks of radius 0.3–3, in a flattened ball of the field's size (height × 0.35), none within `0.12 × size` of its middle, so a park there is clear. `shape` is 0–2.
    - `rigHaulers(row, n, t) → [{ at, heading }]`: `n` haulers (3–5 from the seed) on loops from the rig out to the field's edge and back, one round in 90–150 s
    - `cometParts(row, t) → { head, coma, tail: { dir, length } }`: `tail` from `tailOf`, `coma = 4 × size`
  - **Looks:**
    - `rock`/`ice`: three lumpy shapes as the belt makes them (`rock(seed)`), the rock in `rockMaterial`, the ice in a pale `MeshStandardMaterial` (`tint('engine', 0.6)`, roughness 0.35)
    - `field`/`icefield`: their rocks, instanced the same way, `thingKinds.rocks` at most
    - `rig`: a big rock under a tower and arms from `kit.js`'s `parts`, its work lights `glowMat(hot(PALETTE.sun.hex, 2.2))` with `hot` from `lib/three/canvasTexture.js`, and its haulers as small instanced hulls
    - `comet`: the nucleus a rock; the coma a camera-facing quad of a soft radial `paint`; the tail two quads turned about the tail's axis to face the camera, a `paint`ed gradient, additive

- [ ] **Step 1: Write the failing tests.**
  - **`layout.test.js`:**
    - `fieldRocks(row, 96)` gives 96 rocks, every one within the field, none within `0.12 × size` of its middle, each radius in `[0.3, 3]`, and the same twice
    - `rigHaulers` stay within the field's size of the rig, and move continuously in t
    - `cometParts(row, t).tail.dir` points from the star to the comet, its length `tailOf`'s
  - **`drawers.test.js`** (Node, three, a counting fake `prepare` that resolves at once, a fake `rocks` registry, and `textures: {}`):
    - **A canvas in Node.** `kit.js`'s `paint` calls `document.createElement('canvas')`, so the file stubs it in a `beforeAll`, as `planets.test.js:46-49` does: `vi.stubGlobal('document', { createElement: () => canvas })`, where `canvas` takes every call and draws nothing (`{ width: 0, height: 0, getContext: () => new Proxy({}, { get: (_, k) => (k === 'canvas' ? canvas : () => gradient), set: () => true }) }`, `gradient = { addColorStop() {} }`), with `vi.unstubAllGlobals()` in an `afterAll`. Tasks 14–16 and 20's look tests do the same.
    - `drawers.rock(group, {}).update([], cam, 0)` leaves no visible mesh
    - three rock entries show three instances
    - a field entry shows `budget().thingKinds.rocks` rocks and adds its rocks to the registry once. Its leaving removes them.
    - **Warm-up:**
      - after `createThingDrawers` and every factory `drawers[kind](g, {})`, `prepare` has been called **0** times, and `group` holds a hidden mesh for each material the drawers made (every material of every drawer's meshes is one of theirs, by identity; a rogue's body aside, which `buildBody` makes when it's near and which goes through `prepare` then, Task 16)
      - the first `update` with three rock entries calls `prepare` once for each mesh it makes (the rock drawer's `InstancedMesh`es), and a second `update` calls it no more
      - a field coming near calls it once for its rocks' mesh; the same field again, none
    - `drawn()` counts what's shown
    - an entry past `THING_NEAR × size` shows nothing
    - every `near: false` kind has a drawer that draws nothing
    - `dispose()` empties the group
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/things`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them and see them pass.** Same command. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "Rocks, ice, asteroid fields, mining rigs and comets drawn near, instanced"`

### Task 14: Wrecks and signals

**Files:**
- Create: `src/components/universe/things/looks/wrecks.js` (`derelict`, `outpost`, `debris`), `src/components/universe/things/looks/signals.js` (`beacon`, `relay`, `monolith`)
- Modify: `things/layout.js`, `things/layout.test.js`, `things/drawers.js`, `things/drawers.test.js`

**Interfaces:**
- Consumes: Task 13's kit; `kit.js`'s `parts`, `hull`, `glowMat`; Task 3's `traitsOf`; `createThingDrawers`' `textures` (the scene's `T`), which `hull(textures, color)` reads.
- Produces:
  - **Layouts:**
    - `debrisPieces(row, n, t) → [{ at, quat, scale, kind: 'plate' | 'girder' }]`: tumbling slowly (one turn in 200–600 s a piece) in the field, none within `0.12 × size` of its middle
    - `beaconBlink(row, t) → 0 | 1`: on for 20% of a period of 1.2–2.4 s from the seed
    - `relayDishes(row) → [{ at, aim, r }]`: 3–6 dishes on a truss
    - `monolithBox(row) → [w, h, d]`: in the ratio 1 : 4 : 9 (`d : w : h`), its height the row's `size × 1.8`
  - **Looks** (original, from `kit.js` parts):
    - `derelict`: three merged wreck shapes (a broken hull with ribs showing) in `hull()`, with faint running lights `glowMat(hot(PALETTE.shot.hex, 1.3))`
    - `outpost`: a hub, a broken ring and a dark arm
    - `debris`: plates and girders
    - `beacon`: a buoy with a lamp in `PALETTE.shot`, its instance colour following `beaconBlink`
    - `relay`: dishes on a truss
    - `monolith`: a dark slab with a faint edge glow

- [ ] **Step 1: Write the failing tests:**
  - `debrisPieces` keeps clear of its middle and turns continuously
  - `beaconBlink` is on 20% of its period over 1,000 samples (±3%)
  - a monolith's box is in its ratio
  - each drawer: none shown for no entries, instance counts for some, `thingKinds.pieces` caps debris
  - each drawer keeps Task 13's warm-up rule: no `prepare` at create or from its factory, one a mesh from the first `update` that has it
  - `derelict` and `outpost` are made with `hull(textures, …)` from the `textures` given, and with `{}` still make a `MeshStandardMaterial` (the canvas stubbed as in Task 13)
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/things`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them and see them pass.** Same command. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "Derelicts, abandoned outposts, battle debris, beacons, relay arrays and monoliths drawn near"`

### Task 15: Stars and weather, and companions in the built system

**Files:**
- Create: `src/components/universe/things/looks/stars.js` (`pulsar`, `magnetar`, `protostar`), `src/components/universe/things/looks/weather.js` (`storm`, `wormhole`)
- Modify: `things/layout.js` and its test, `things/drawers.js` and its test
- Modify: lane 2's `src/components/expanse/scene/near.js` and `near.test.js`:
  - a built system's companions are emissive `BALL`s at `companionAt(c, system, t)`, of radius `c.size` in `c.color`: the disc Task 6 pushes, so that disc fades off a ball of its own size and colour as the camera comes in (lane 2's "a change of level fades, never pops")
  - each ball is made with its system, through near's own `prepare` (lane 2's rule: one call a new mesh)
  - each joins `stars()` with strength 0.4 and its primary's reach, and `solids()` as `{ id: system.id + ':c' + k, at, r: size, reach: size × 1.2 }`

**Interfaces:**
- Consumes: Task 3's `traitsOf`; Task 6's `companionsOf` and `companionAt`; Task 13's kit.
- Produces:
  - **Layouts:**
    - `beamDirs(row, t) → [dirA, dirB]`: two opposite units, each 0.5 rad off the spin axis, turning about it once a `period`
    - `stormPuffs(row, n) → [{ at, r, tone }]`: puffs within the storm's size, about its moving middle
    - `boltsAt(row, t) → [{ from, to }]`: 0–3 lightning bolts, each lit for 0.15 s
  - **Looks:**
    - `pulsar`: a white-hot core (`glowMat`) and two beam cones (additive `MeshBasicMaterial` with a `paint`ed gradient), each `traits.beam × size` long, along `beamDirs`
    - `magnetar`: the same in `PALETTE.nebula`, with three faint field loops (partial tori)
    - `protostar`: a warm core and its dust disc (a `RingGeometry` with a `paint`ed band, double-sided, transparent)
    - `storm`: camera-facing puffs (instanced quads of a `paint`ed cloud, additive) round `rowAt`, and the bolts
    - `wormhole`: a hot ring (a torus in `PALETTE.nebula`), a turning swirl disc (`paint`ed), and a dark throat of radius `0.45 × size`

- [ ] **Step 1: Write the failing tests:**
  - `beamDirs` are unit, opposite, 0.5 rad from the spin axis, and back where they began after one period
  - storm puffs ride the storm's `rowAt`
  - a bolt lasts 0.15 s
  - the drawers as Task 13's
  - **`near.test.js`:** a built binary's companion is at `companionAt` for t in `{0, 1000}`, in `stars()` and `solids()`; its ball's radius is `c.size` and its colour `c.color`, the disc's; a system without companions builds none
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/things src/components/expanse/scene/near.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them and see them pass.** Same command. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "Pulsars and magnetars sweeping their beams, forming stars, ion storms, wormholes, and binary suns in a built system"`

### Task 16: Life, fleets and rogue worlds

**Files:**
- Create: `src/components/universe/things/looks/life.js` (`herd`, `swarm`), `src/components/universe/things/looks/fleets.js` (`fleet`, `shipyard`), `src/components/universe/things/looks/rogue.js` (`rogue`)
- Modify: `things/layout.js` and its test, `things/drawers.js` and its test

**Interfaces:**
- Consumes: Task 13's kit; `trafficModels.js`'s `buildTraffic`, `buildModel` and `BUILT_KINDS` (`:991-1021`); `galaxy/bodies.js`'s `buildBody` and `LOOKS`; Task 3's `traitsOf`.
- Produces:
  - **Layouts:**
    - `herdBodies(row, n, t) → [{ segments: [{ at, r }] }]`: `n` bodies (`min(row.bodies, thingKinds.bodies)`) round the herd's `rowAt`, each eight segments long, a swimming wave down them
    - `swarmBodies(row, n, t) → [{ at, pulse }]`: drifting about the swarm's `rowAt`, `pulse` 0–1
    - `fleetShips(row) → [{ model, at, heading, scale }]`: `row.ships` ships in a loose line abreast, the first a capital at three times the others' scale. `model` is from `FLEET_MODELS[row.faction.id] ?? FLEET_MODELS.independent`.
    - `yardParts(row) → { scaffold, cranes, hull }`: a scaffold box, 2–4 cranes and a half-built hull's ribs
  - **`FLEET_MODELS = { empire: ['destroyer', 'shuttle'], federation: ['federation', 'patrol'], dea: ['madrigal', 'suv'], independent: ['trader', 'trader'] }`**: the site's own models for the authored sides (each in `BUILT_KINDS`), and `trader` for everyone else. Independent and generated factions hold most space past `d = 1` (`tables.js:94-120`), so `trader` is most fleets' look.
  - **`trader`**, this lane's original freighter, built in `looks/fleets.js` from its own kit as the site's models are: `TRADER = (k) => …` (a boxy hull of stacked cargo pods on a spine, a cab and two engine pods, from `k`'s parts), made with `buildModel(TRADER, 'trader')` (exported from `trafficModels.js:1027`, centred and one long in z).
    - Why not a name `buildTraffic` knows: `hauler` is already Rick and Morty's junky space truck (`fleetRickmorty.js:298`, in `BUILT_KINDS`), which would put a cartoon delivery van at anchor in every independent system. And `buildTraffic` turns a kind it doesn't know into a TIE fighter (`:1019-1021`), silently.
    - So `fleetShips`' models all go through one `modelOf(kind)` in `looks/fleets.js`: `kind === 'trader' ? buildModel(TRADER, 'trader') : buildTraffic(kind)`, and it throws on a kind that is neither `trader` nor in `BUILT_KINDS`. `buildModel` gives `{ group, length, size, update, dispose }`, its `group` named `traffic-<kind>`.
  - **Looks:**
    - `herd`: original leviathans, segments as instanced spheres in `tint('nebula', 0.4)`, with glowing spots
    - `swarm`: jellyfish as instanced bells and tendrils, additive, their colour pulsing
    - `fleet`: the models, cloned with shared geometry
    - `shipyard`: the scaffold, cranes and ribs, instanced, with work lights
    - `rogue`: `buildBody(ROGUE_LOOK[traitsOf(row).type], { r: size, tier })`, where `ROGUE_LOOK = { rock: 'moon-grey', ice: 'hoth', desert: 'moon-dust', gas: 'endor-giant' }`. Two at most at once.

- [ ] **Step 1: Write the failing tests:**
  - herd segments stay within the herd's size of its `rowAt`, and the wave moves continuously
  - `herdBodies` honours `thingKinds.bodies`
  - `fleetShips` gives `row.ships` ships, the first the capital, with models by faction and `trader` for an independent or generated faction (a row of `fullSector(UNIVERSE, 5, 0, 5)`'s `fleet` list whose faction isn't one of the authored sides)
  - **No fleet falls back to a TIE:** every name in `FLEET_MODELS` is `trader` or in `BUILT_KINDS`, `modelOf('nonsense')` throws, and the model built for a generated faction's fleet isn't `buildTraffic('tie')`'s (its `group.name` is `'traffic-trader'`, as `buildModel` names it, and its `size` differs from the TIE's)
  - a rogue entry calls `buildBody` once with its type's look, from an `update` (not at create), and `prepare` once with its body
  - the drawers as Task 13's
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/things`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them and see them pass.** Same command. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "Leviathan herds, swarms, fleets at anchor, shipyards and rogue worlds drawn near"`

### Task 17: Nebula pockets and remnants in lane 1's renderer

**Files:**
- Create: `src/components/universe/things/pockets.js`, `src/components/universe/things/pockets.test.js`
- Modify: lane 1's `src/components/universe/nebula/index.js` and `index.test.js`:
  - a desc's `k` (default 1) is read at every `update`. A cloud with `k ≤ 0` isn't written; otherwise its light and density are multiplied by `k`.
  - **`shown() → ids`**: the `id`s of the descs written at the last `update`, in one array kept between calls. It is how the dev hooks see a nebula drawn, a legacy one (`nebulaOf(w)`'s id is the wonder's) or a pocket alike (Task 22).

**Interfaces:**
- Consumes: lane 1's `createNebulae(…).add(desc) → handle`, `remove(handle)`, `update(camera)`; Task 8's rows; `NEBULA_SHOW`.
- Produces: **`createPocketFeed({ nebulae, clock = () => performance.now() / 1000 }) → { update(sectors, cam), shown() → ids, dispose() }`**
  - Four times a second, every pocket and remnant row within `NEBULA_SHOW + size` of `cam` is added once as `{ id, at, r: size, colors, seed, form, k }`.
  - `k = 1 − smoothstep(0.8 × NEBULA_SHOW, NEBULA_SHOW, dist − size)` is written to the desc on every update.
  - A row is removed past `NEBULA_SHOW + size`.
  - `dispose()` removes all it added.

- [ ] **Step 1: Write the failing tests:**
  - with a fake `nebulae` (`add` returns a counter; `remove` records):
    - a pocket 20,000 off is added with `k` 1
    - at `0.9 × SHOW + size` its `k` is between 0 and 1
    - past `SHOW + size` it is removed
    - the same row isn't added twice
    - a remnant is added with `form: 'shell'`
  - **in lane 1's `index.test.js`:** a cloud whose desc has `k: 0` isn't counted in `instanceCount`, and `k: 0.5` writes half its strength into the attribute the implementer packs it in. After an `update`, `shown()` holds the ids of the clouds written and not the `k: 0` one.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/things/pockets.test.js src/components/universe/nebula`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them and see them pass.** Same command. Expected: PASS, lane 1's tests unchanged.
- [ ] **Step 5: Commit.** `git commit -m "Nebula pockets and supernova remnants fade into the one nebula renderer, never near a hand-made place"`

### Task 18: The Maw's look moves out of `deepspace.js`

**Files:**
- Create: `src/components/universe/gargantuans/hole.js`, `src/components/universe/gargantuans/hole.test.js`
- Create: `scripts/same-pixels.mjs`, `scripts/same-pixels.test.mjs`
- Modify: `scripts/universe-check.mjs`: a `--t <seconds>` option (below), and its line in the header's usage
- Modify: `src/components/universe/deepspace.js`: `blackHole(w)` (`:695-711`, from `const blackHole = (w) => {`) becomes a call to `buildHole`, about −15 lines
- Modify: `src/components/universe/deepspaceShaders.js`: `PHOTON_FRAG` (`:413`), `DISK_FRAG` (`:452`) and `JET_FRAG` (`:523`) each gain `uniform float uFade;`, and their last line's colour is multiplied by it (`gl_FragColor = vec4(col * uFade, 1.0);` and the like). All three are additive, so this fades them to nothing. Nothing else uses these three strings (`deepspace.js` alone imports them). Multiplying by exactly 1.0 changes no bit of a float.

**Interfaces:**
- Consumes: `deepspaceShaders.js`'s `PHOTON_VERT`, `PHOTON_FRAG`, `DISK_VERT`, `DISK_FRAG`, `JET_VERT`, `JET_FRAG`; `mergeGeometries`; deep space's clock, `uTime` (`deepspace.js:554`).
- Produces: **`buildHole(parent, { r, disk, uTime, euler = null, axis = null, seg = [192, 112], small = false, jets = true, fade = false }) → { group, tilt, setFade(f), dispose() }`**
  - It builds exactly what `blackHole(w)` builds: the black shadow sphere `(r, 48, 32)`; the photon plane (render order 2, `uDiskN` the disk's normal, `uReach` 2.6); the disk ring from `1.6 r` to `disk` in the tilt group (render order 1); and the jets (render order 1). The materials, blending and sides are the same.
  - **`uTime` is the clock, a uniform object, and is required** (a `TypeError` without it). All three shaders read it: the photon ring's noise (`PHOTON_FRAG`, `:440`), the disc's swirl (`DISK_FRAG`, `:480`) and the jets' flow (`JET_FRAG`, `:542`). Today they get it from deep space's `shader()`, which spreads `{ uTime, ...uniforms }` (`:563`) over the one object deep space advances every frame (`:1445`). A uniform of their own would freeze the Maw's disc and jets, and every generated hole's.
    - The Maw passes deep space's `uTime`.
    - `createGargantuans` passes one of its own and sets its `value` in `update(camera, cam, t)` (Task 20).
  - The three shader materials share one `uFade: { value: 1 }` uniform object, and the `uTime` object they were given, by identity.
  - **`fade: true`** (a generated hole) makes the shadow's `MeshBasicMaterial` `transparent` at create. The Maw passes nothing, so its shadow stays opaque and `uFade` stays 1: not a pixel moves.
  - **`setFade(f)`** sets `uFade.value = f` and, with `fade`, the shadow's `opacity = f`. Setting `.opacity` on the shader materials would do nothing, since their shaders don't read it.
  - The tilt is `euler` (the Maw's `TILT`) or, given `axis`, the quaternion that turns +y onto it.
  - The Maw's `dispose` joins deep space's own list (`own({ dispose })`), so deep space's `dispose` frees it once, as it did.
  - It has one `ShaderMaterial` site of its own: `glsl-sites` +1.
- Produces, for the checks:
  - **`universe-check --t <seconds>`**: at each pose, before the numbers and the shot, the scene's clock is held at that many seconds, as the quality floor holds it (`scene.js:6157-6160`): `__universeDebug.state.tLow = t` and `state.low = true`, then two frames. `render` then takes `t = state.tLow` (`scene.js:5067`), so the Maw's disc, the belt's turn and the Twins are where that clock puts them on every run.
  - **`samePixels(a, b, { mask = null }) → { same, differing, box }`** in `scripts/same-pixels.mjs`, over two decoded `{ data, width, height, channels }`, and its CLI `node scripts/same-pixels.mjs <a> <b> [--mask x0,y0,x1,y1]`: sharp decodes both to raw buffers, and they are compared byte for byte outside the mask. `box` is the smallest box holding every differing pixel. It prints the result as JSON, and exits 0 when they're the same and 1 when not. Two pictures of different sizes throw.

- [ ] **Step 1: Write the failing tests.**
  - **`hole.test.js`** (Node, three):
    - with `uTime = { value: 0 }`, `buildHole(g, { r: 60, disk: 600, uTime, euler: TILT })` gives four meshes:
      - a `SphereGeometry` of radius 60 with a black `MeshBasicMaterial`
      - a `PlaneGeometry` 312 across (`60 × 2.6 × 2`), render order 2, its `uDiskN` +y turned by `TILT`
      - a `RingGeometry` from 96 to 600 under the tilt group, render order 1
      - the jets, render order 1
    - **The clock:** `uniforms.uTime` on all three shader materials is `uTime`, the object passed in (`toBe`), so setting `uTime.value = 12` reads 12 on each. `buildHole(g, { r: 60, disk: 600 })` throws a `TypeError`.
    - with `axis: [0, 0, 1]` the tilt group's +y is +z
    - **The fade, on the real materials:** with `fade: true`, `setFade(0.3)` leaves `uniforms.uFade.value` at 0.3 on all three shader materials (one object), and the shadow `transparent` with `opacity` 0.3. Without `fade`, the shadow's `transparent` is false and `uFade` is 1. Each of the three fragment strings declares `uniform float uFade`.
    - `dispose()` frees every geometry and material
  - **`scripts/same-pixels.test.mjs`:** two equal 4 × 3 RGBA buffers are `{ same: true, differing: 0, box: null }`; one byte changed at (2, 1) gives `{ same: false, differing: 1, box: [2, 1, 3, 2] }`; the same with `mask: [2, 1, 3, 2]` is the same; a 4 × 3 against a 3 × 4 throws.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/gargantuans/hole.test.js scripts/same-pixels.test.mjs`. Expected: FAIL (modules not found).
- [ ] **Step 3: Implement `same-pixels.mjs` and `--t`, not the move yet.** Run `npx vitest run scripts/same-pixels.test.mjs`. Expected: PASS.
- [ ] **Step 4: The befores, at a held clock, on the code as Task 17 left it.** Run, one after the other:
  - `node scripts/universe-check.mjs --quality mid --poses maw --t 1000 --out lab/universe/before-4a-18/t1000`
  - the same again, `--out lab/universe/before-4a-18/t1000b`
  - the same at `--t 1012`, `--out lab/universe/before-4a-18/t1012`

  Then compare (each shot is `<out>/maw.webp`):
  - `t1000` against `t1000b`. Expected: same. If not, something on screen the clock doesn't hold has moved between two page loads: the README names it, and the `box` printed is the `--mask` for every comparison below.
  - `t1000` against `t1012`. Expected: **differ**, in the Maw's disc. If they're the same, the clock wasn't held or doesn't reach the Maw, and the check below would prove nothing: stop and find why.
- [ ] **Step 5: Implement `buildHole`, and move the Maw onto it,** passing deep space's `uTime`. Keep `deepspace.js`'s `lensAt` and every other builder where they are. Run `npx vitest run src/components/universe/gargantuans/hole.test.js`, then `npx vitest run src/components/universe`. Expected: PASS, `deepspace`'s tests unchanged.
- [ ] **Step 6: Check no pixel moves, and the disc still swirls.** Run `universe-check` at `--t 1000` and `--t 1012` again, into `lab/universe/after-4a-18/t1000` and `t1012`. Then, with the mask if Step 4 set one:
  - `node scripts/same-pixels.mjs lab/universe/before-4a-18/t1000/maw.webp lab/universe/after-4a-18/t1000/maw.webp`, and the same for `t1012`. Expected: same, both. This decides.
  - the two afters, `t1000` against `t1012`. Expected: differ, as the befores did. With both pairs the same, the swirl moved between the two clocks exactly as it did before the move. A frozen `uTime` would show here as the two afters the same.
  - `after-4a-18/t1000.json`'s `calls` and `triangles` for `maw` equal `before-4a-18/t1000.json`'s.
  - Run `node scripts/pixel-measure.mjs` on the four shots and put its numbers in the README beside the answer. They don't decide.
  - A changed pixel means the move is wrong.
- [ ] **Step 7: Commit.** `git add` the code, the two scripts and `lab/universe/before-4a-18`, `lab/universe/after-4a-18`, then `git commit -m "The Maw's look moves out of deep space so a generated black hole can wear it; not a pixel changes"`. The body says `deepspace.js`'s lines before and after, `glsl-sites` +1, and the four comparisons' answers.

### Task 19: Gargantuans on the sky: impostors in the landmark draw

**Files:**
- Create: `src/components/universe/gargantuans/rules.js`, `src/components/universe/gargantuans/rules.test.js`, `src/components/universe/gargantuans/impostorGlsl.js` (GLSL strings only)
- Create: `src/components/universe/landmarkRules.js`: `drawnAngle`, `landK` (with its `FADE`, 0.2) and lane 1's `quadAxes`, moved out of `landmarks.js` as they are, importing nothing. `landmarks.js` imports three (`landmarks.js:33`), so a pure module that wants `landK` can't take it from there.
- Modify: lane 1's `src/components/universe/landmarks.js` and `landmarks.test.js` (new `it`s; every existing one stays):
  - `export { drawnAngle, landK, quadAxes } from './landmarkRules';`, so `landmarks.test.js:3` and every importer read what they did
  - `LANDMARKS`: `curvesun` moves to just before the nebula rows. Each test reads by `findIndex`, and `aim.js` reads by id.
  - the instance buffers are sized `LANDMARKS.length + EXTRA_SLOTS`, where `EXTRA_SLOTS = 4`
  - new instance attributes `aLight` (vec3) and `aParam` (vec3: span, band, spare), nought for the hand-made rows
  - `KIND` gains `arc: 4`, `hulk: 5`, `giant: 6`, `dyson: 7`. A generated black hole uses `hole: 1`, the Maw's branch, with its own axis and colours.
  - `update(camera, t, { sector, groups, extra = [] })`:
    - in `'main'`, the extras are written from the Curve's sun's slot on, and `instanceCount = MAIN_DRAWN + n`, where `n = min(extra.length, EXTRA_ROOM)` and `EXTRA_ROOM = LANDMARKS.length + EXTRA_SLOTS − MAIN_DRAWN` (7: the Curve's sun's slot, the two nebula rows' and the four spare). `MAIN_DRAWN` is the count of drawn rows of the main sector: 7. Extras past `EXTRA_ROOM` are dropped, farthest first (the caller orders them nearest first).
    - in any other sector, extras are left out and `instanceCount` stays lane 1's (8)
    - **Every update writes every per-instance attribute of every slot from `MAIN_DRAWN` up** (`aKind`, `aCol0`, `aCol1`, `aCell`, `aAxis`, `aLight`, `aParam`, and lane 1's `aCenter`, `aSize`, `aK`), and flags each for upload:
      - slot `MAIN_DRAWN + i` for `i < n` in `'main'`: extra `i`'s values
      - any other slot that is a `LANDMARKS` row (the Curve's sun's, the nebula rows'): that row's own values, as lane 1's create wrote them (its `KIND`, its colours in linear light, its `cell`, the Maw's axis, `aLight` and `aParam` nought), and lane 1's update's `aCenter`, `aSize` and `aK` (0 for a nebula row)
      - a spare slot past `LANDMARKS`: `aK` 0
    - Why every slot, every update: lane 1 writes `aKind`, `aCol0`, `aCol1`, `aCell` and `aAxis` once, at create (`landmarks.js:250-259` on `main`), and its update writes only `aCenter`, `aSize` and `aK`. Written over by an extra and never put back, the Curve's sun would be drawn in the Rick and Morty sector as a hulk or a Dyson swarm, in the gargantuan's colours and axis, after one main-sector frame with a gargantuan in view. Seven slots a frame is nothing.
    - lane 1's `ks`, `kOf` and which groups are hidden stay per `LANDMARKS` row, untouched by the extras
  - `FRAG` splices `GARGANTUAN_FRAG`'s functions in, with a branch for each kind 4–7 before lane 1's `else` (the pulsar)

**Interfaces:**
- Consumes: `landK` from `../landmarkRules` (never `../landmarks`); lane 1's `createLandmarks`; Task 10's rows; `FAR` and `GARGANTUAN` through `expanse/shared/space.js` (Task 11).
- Produces, in `gargantuans/rules.js` (pure: it imports `../landmarkRules` and the face, nothing else):
  - **`nearOf(row) → N`** = `max(2 × size, 0.55 × FAR − size)`: the mesh is whole within `0.8 N`, the impostor whole past `1.2 N`, the two crossfading between by `landK(dist, N)`
  - **`impostorOf(row, cam, skyFar) → { centre, angle, k, kind, axis, light, param, colors }`**
    - `centre` = `cam + (at − cam) · skyFar / d`
    - `angle` = `2 × atan(size / d)`
    - `k` = `landK(d, nearOf(row))`
    - `kind` is the landmark kind
  - **`ROW_KIND = { hole: 1, arc: 4, hulk: 5, giant: 6, dyson: 7 }`**
  - **`inView(row, cam, sector) → boolean`**: the row's sector within Chebyshev 1 of the camera's, and its angle at least one pixel at 1,080 lines
- Produces, in `impostorGlsl.js`: `GARGANTUAN_FRAG` (`arcOf`, `hulkOf`, `giantOf`, `dysonOf`, each returning premultiplied `vec4`):
  - **arc:** the ring's band as an ellipse squashed by the axis seen (the Maw's maths), drawn only over its span about `mid`. Its inner face is lit in `vCol0`; its rim in `vCol1`.
  - **hulk:** a long dark silhouette along the spine as seen, lit on its `light` side, with a few warm lights
  - **giant:** latitude bands about the pole, a storm oval, a terminator from `light`, a thin air rim
  - **dyson:** a small white core, and a shell of hashed specks over a sphere's projection, flickering
- Produces, in `landmarks.js`: `EXTRA_SLOTS`, `MAIN_DRAWN`, `EXTRA_ROOM`, and `update`'s `extra`.

- [ ] **Step 1: Write the failing tests.**
  - **`rules.test.js`:**
    - for d in `{20000, 120000, 1e6}`, `impostorOf(row, cam, 24000).angle` is `2 × atan(size / d)`, and `|centre − cam|` is 24,000
    - turning the camera's orientation (the same `cam` point) changes nothing
    - `cam + (centre − cam) · d / 24000` is the row's `at`, to 1e-6
    - `k` is 0 at `0.79 N`, 1 at `1.21 N`, and between them smooth (steps of 0.001 N change it by under 0.01)
    - `nearOf` puts the far side of the biggest hole (`size` 8,450) within `0.65 × FAR` at `1.2 N`
    - `1.2 × nearOf(row)` is under `GARGANTUAN.far` for every form at its least and its most size, so Task 10's clearance (`GARGANTUAN.far + size` from every baseline pose's point) means no mesh is built there
    - `inView` is false for a row two sectors off, and true for one in the next sector
    - **Pure:** the text of `rules.js` and `landmarkRules.js` imports neither `three` nor `landmarks` (read with `fs`, as lane 3's `weight.test.js` reads files)
  - **`landmarks.test.js`, new `it`s:**
    - in `'main'` after an update with no extras, `instanceCount` is 7; with one, 8, and slot 7's `aKind` is the extra's
    - in `'rickmorty'` with one extra, `instanceCount` is 8 and `curvesun`'s `aK` at its index is over 0
    - a hole extra's `aAxis` is its axis, not the Maw's
    - **The Curve's sun given back:** an update in `'main'` with a `hulk` extra, then one in `'rickmorty'` with none (the camera at the Rick and Morty sector's origin). Slot 7's `aKind` is `KIND.star`, its `aCol0` is `curvesun`'s colour in linear light (`new THREE.Color(colors[0]).convertSRGBToLinear()`), its `aAxis` the Maw's, and its `aLight` and `aParam` nought: as a fresh `createLandmarks` has them at create.
    - **The nebula rows given back:** an update in `'main'` with two extras (slots 7 and 8 written), then one in `'main'` with none. The `veil` and `cradle` slots' `aKind`, `aCol0`, `aCol1` and `aCell` equal a fresh `createLandmarks`' at those indices, and their `aK` is 0. The same after eight extras (clamped: `instanceCount` 14, and only seven written).
    - the reserved-word test passes over the spliced `FRAG`
    - every existing test passes as it is
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/gargantuans src/components/universe/landmarks.test.js src/components/universe/aim.test.js`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement.** `landmarks.js`'s header says why the extras take the Curve's sun's slot: in the main sector that quad never draws, so a gargantuan costs no triangle at a baseline pose.
- [ ] **Step 4: Run them and see them pass.** Same command, then `npx vitest run src/components/universe`. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "Gargantuans on the sky at their true angle, in the landmark draw, in a slot that never drew in the main sector"`

### Task 20: Gargantuans near: meshes, the handover, solids, light and lens

**Files:**
- Create: `src/components/universe/gargantuans/looks/arc.js`, `hulk.js`, `giant.js`, `dyson.js`; `src/components/universe/gargantuans/index.js`, `src/components/universe/gargantuans/index.test.js`

**Interfaces:**
- Consumes: Task 18's `buildHole` (with `fade: true`) and `setFade`; Task 19's `nearOf`, `impostorOf`, `inView`; Task 10's `gargantuanKeeps`, through the face; `kit.js`'s `parts`, `hull`, `paint` and `glowMat`; `rowAt` (none move, but the shape is shared).
- Produces:
  - **`GARGANTUAN_DETAIL = { low: { seg: 48, disc: 96, jets: false, ring: 96 }, mid: { seg: 64, disc: 128, jets: true, ring: 160 }, high: { seg: 96, disc: 192, jets: true, ring: 256 } }`**, in `rules.js`
  - **`solidsOf(row, ship, max = 8) → [{ id, at, r, reach }]`**: the solid parts (`gargantuanKeeps`'s spheres, at radius `r / 1.6` for the hole's shadow and as listed for the rest), nearest the ship first, `max` at most. In `rules.js`.
  - **`lensOf(rows, cam) → { at: [x, y, z], r, axis: [x, y, z], far } | null`**: the nearest hole within `40 × body`, with `r = body` and `far = 40 × body`. In `rules.js`, pure, so plain arrays.
  - **`starsOf(rows) → [{ id, at, r, colour, strength: 0.9, reach: 3 × size }]`**: each Dyson swarm's star. In `rules.js`.
  - **`createGargantuans(group, { budget, tier, prepare, sectors, universe, textures = {} }) → { … }`**
    - `textures` is the scene's `T`, for the hulk's `hull()` (Task 13 says why).
    - **Warm-up** (Global Constraints): at create it makes one hidden mesh in `group` for each kind of material its looks use (a small `buildHole` with `fade: true`, a transparent `MeshStandardMaterial`, a transparent `MeshBasicMaterial` with a map and `vertexColors`, an additive back-side `MeshBasicMaterial`, and the Dyson's instanced panel), so the start-up `prepareScene` compiles every program. It calls `prepare` for none of them: the scene's `warm` doesn't exist yet when this runs. A look built near calls `prepare(look.group)` once, from `update`, and shows when that resolves.
    - **Its own clock:** one `uTime = { value: 0 }`, passed to every `buildHole` it makes, its `value` set to `t` in every `update`, so a generated hole's disc swirls and its jets flow as the Maw's do.
    - `update(camera, cam, t)`: reads `[...sectors().values()]`; builds the mesh of a row within `1.2 × nearOf(row)`; frees it past `1.3 ×`. Every frame it calls the look's `setFade(1 − k)`.
    - `impostors`: one array kept between frames, the rows `inView`, nearest first, as `impostorOf` gives them, for `landmarks.update`'s `extra`
    - `solids(ship)`: `solidsOf` of the built rows
    - `stars()`
    - **`lens(cam)`** → `lensOf`'s answer in the shape `bend()` reads (`scene.js:3571-3592`): `at` copied into one `THREE.Vector3` kept between calls (`bend()` calls `lensAt.copy(L.at)` and `lensCam.sub(L.at)`), `r`, `far`, and `axis` left an array (it goes into `new THREE.Vector3(...(L.axis ?? DISK_N))`)
    - `setStep(step, floor)`
    - `debug: { rows(), meshed() → ids, angle(id), handover(id) → { k, fade }, screen(id) }`. `meshed()` is an array, since two can be near at once. `handover`'s `fade` is read back from the mesh's real materials, not from what was asked.
    - `dispose()`
  - **The look contract:** each look is `{ group, setFade(f), dispose() }`.
    - Every material it makes is `transparent` from create, at its full opacity, with `depthWrite` on, so the fade never changes a program (three keys a program by `transparent`).
    - `setFade(f)` sets `opacity = f × full` on each stock material, and the hole's `buildHole(…).setFade(f)` its `uFade`.
    - `buildBody` can't do this: its surface is a `ShaderMaterial` (`galaxy/bodies.js:449`) that reads neither `opacity` nor a fade. So the supergiant has a look of its own, below, rather than a planet body.
  - **Looks** (original):
    - `hole`: `buildHole(…, { fade: true })` at the row's body and size, `jets` and `seg` from the detail level
    - `arc`: a ribbon along the arc, its inner face a `paint`ed band of land, sea and cloud, its outer face plated, with rim walls; `MeshStandardMaterial`
    - `hulk`: a long broken hull from `kit.js` parts in `hull()`, cut open part way, with warm lights
    - `giant`: a sphere (`seg` from the detail level) in a `MeshBasicMaterial` with two parts:
      - a `paint`ed map of latitude bands in its two colours with a storm oval (size 0.12, latitude 0.3), the impostor's recipe
      - `vertexColors` baking the terminator from `row.light` once (`smoothstep(−0.12, 0.3, n · light)`, floor 0.03), since neither the giant nor its light moves
      - an air rim: a back-side sphere at `1.025 × size`, additive, in its lighter colour at 0.35
    - `dyson`: an emissive star and `thingKinds.panels` collectors on a shell, instanced, lit by the star

- [ ] **Step 1: Write the failing tests** (Node, three, the real looks, a fake `sectors` returning a `Map`, a counting fake `prepare` that resolves at once, `textures: {}`, and the canvas stubbed for `kit.js`'s `paint` as in Task 13):
  - **The handover, for each of the five forms:**
    - outside `1.2 N` nothing is built
    - at `N` the mesh is built and `handover(id).k + handover(id).fade` is 1 (±1e-9)
    - read on the real materials at `N`:
      - for the hole (the real `buildHole`), every shader material's `uniforms.uFade.value` is `1 − k`, and so is the shadow's `opacity`
      - for the others, every material's `opacity` is `(1 − k) ×` its full opacity
    - every material's `transparent` is the same at `1.3 N`, `N` and `0.7 N` (no program change)
    - at `0.7 N` the fade is 1
  - **Inside:** a camera inside an arc's ring, inside a Dyson shell and inside a hole's disc keeps the mesh, with `k` 0.
  - **Solids:** `solids(ship)` near an arc gives at most 8 spheres along its band, nearest first; the hole's gives its shadow.
  - **Light:** `stars()` holds the Dyson's star.
  - **Lens:** `lens(cam)` is the nearest hole within `40 × body`, and null past it. Its `at` is a `THREE.Vector3`, the same object on two calls, and its `axis` an array of three.
  - **Warm-up:** after `createGargantuans`, `prepare` has been called **0** times, and `group` holds a hidden mesh for each kind of material named above. Moving to `N` from a hole calls it once, with that hole's look's group; another `update` at `N` calls it no more; leaving past `1.3 N` and coming back calls it once more (a new mesh).
  - **The clock:** a generated hole's three shader materials share one `uniforms.uTime`, not deep space's, and after `update(camera, cam, 77)` its `value` is 77.
  - **Detail:** on `'low'` the hole has no jets.
  - **Freeing:** `dispose()` frees everything.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/gargantuans`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them and see them pass.** Same command. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "Gargantuans near: a black hole in the Maw's look, a ringworld arc, a hulk, a supergiant and a Dyson swarm, handed over without a gap"`

### Task 21: The rock fields move out of `scene.js`

**Files:**
- Create: `src/components/universe/rockFields.js`, `src/components/universe/rockFields.test.js`
- Modify `src/components/universe/scene.js`:
  - `:711-721` (from `const BELT_SPIN = 0.006;` to `const smashed = …;`) becomes `const rocks = createRockFields([{ id: 'belt', … }, { id: 'rim', … }, { id: 'debris', …, drift: DEBRIS_DRIFT }]);`
  - `:3170-3243` (`rocksHit`): the restore, sweep and smash move into the module. The consequences stay in the scene: the pop, the bump, the damage, the shake, the flare, the slowing and the note.
  - `__universeDebug`'s `rockFields, smashed` become `rockFields: rocks.fields, smashed: rocks.smashed` (0 lines, on its line)

**Interfaces:**
- Consumes: `rockHits.js`'s `rockGrid`, `sweep`, `toBelt`, `nearRing`, `nearBox`, `ROCK_HIT`.
- Produces: **`createRockFields(list) → { fields, smashed, add(field), remove(id), restore(clock), sweep(from, to, t, radius) → hit | null, smash(hit, clock) }`**
  - A field is `{ id, grid, field: { hide(i), show(i) }, ring?, spin?, box?, drift? }`. A ring field is swept in its turning frame (`toBelt`); any other in its drift's frame (`drift(t)`, nought when absent).
  - A hit is `{ f, i, o, t, rockAt: [x, y, z], shipAt: [x, y, z] }` in the map's frame, the first along the way. `smash` hides it and keeps it gone till `clock + ROCK_HIT.gone`.
  - It behaves exactly as the block did.

- [ ] **Step 1: Write the failing tests** against today's behaviour, over the real `beltRocks()`, `rim`'s rocks and `debrisRocks()`:
  - **The belt:** a way from 2 units before belt rock 17 (in the belt's frame at t = 100) to 2 past it hits rock 17, at the `t` and `rockAt` the old block's maths gives (worked out in the test with `toBelt` and `sweep`, as the block did).
  - **Smashing:** after `smash`, the same way finds the next rock along or nothing. `restore(clock + ROCK_HIT.gone)` shows it again and calls `show(17)`.
  - **Debris:** a debris rock is found at its place plus `DEBRIS_DRIFT(t)`.
  - **Added fields:** a field `add`ed with no ring or drift is swept in the map's frame, and `remove` takes it out.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/rockFields.test.js`. Expected: FAIL.
- [ ] **Step 3: The befores, at a held clock, before the move** (Global Constraints, "Not a pixel changes"; the belt turns with the clock, `BELT_SPIN`). Run `node scripts/universe-check.mjs --quality mid --poses belt --t 1000 --out lab/universe/before-4a-21/t1000`, then the same into `t1000b`. Compare the two `belt.webp`s with `scripts/same-pixels.mjs`: the same, or the printed `box` is the mask below, named in the README.
- [ ] **Step 4: Implement, and move.** Count `scene.js`'s lines before and after.
- [ ] **Step 5: Run them, and check nothing changed.**
  - Run `npm test`. Expected: PASS.
  - Run the same `universe-check` at `--t 1000` into `lab/universe/after-4a-21/t1000`, then `node scripts/same-pixels.mjs lab/universe/before-4a-21/t1000/belt.webp lab/universe/after-4a-21/t1000/belt.webp` (with the mask, if any). Expected: same, and `calls` and `triangles` equal in the two JSONs. The bytes decide; pixel-measure's numbers go in the README beside them.
- [ ] **Step 6: Commit.** `git commit -m "The rock fields move out of the scene, so a generated field's rocks can join them"`. The body says `scene.js`'s lines before and after (about −50) and the comparison's answer.

### Task 22: Wired into the scene; checked at mid

**Files:**
- Create: `src/components/universe/things/index.js`, `src/components/universe/things/index.test.js`
- Modify `src/components/universe/scene.js`. Each change says the lines it adds:
  - **Imports.** `import { createThings } from './things';` and `import { createGargantuans } from './gargantuans';` (+2).
  - **After `universe` is declared, before `createExpanse`.** `const things = createThings(map, { … })` (+1). Its deps on that line:
    - values: `universe`, `device()`, `rocks` (Task 21), `deep.nebulae` (lane 1) and `textures: T` (`scene.js:647`, declared above)
    - thunks, since each is declared below: `prepare: (o) => warm(o)`, `sectors: () => expanse.sectors()`, `solids: () => expanse.solids()`, `meshed: () => gargantuans.debug.meshed()`, `places: () => places`, `travel: (id, d) => travel(id, d)`, `ship: () => state.ship`, `t: () => state.spaceT`
    - **None of them is called while the scene is made.** `warm` is declared at `:948`, below this line, so `prepare` run now would throw a `ReferenceError` and the scene would never build. `createThings` and the drawers only make their materials and hidden meshes (Global Constraints, "Warm-up"); the thunks first run in `render`.
    - no `teleport`: lane 2 writes it inline on `__universeDebug`, so the check teleports with it, to the park `parkOf` gives
  - **`createExpanse`'s options** gain `drawers: things.drawers,` (+1).
  - **After `createLandmarks`.** `const gargantuans = createGargantuans(map, { budget: universeBudget(device(), 0), tier, prepare: (o) => warm(o), sectors: () => expanse.sectors(), universe, textures: T });` (+1). The same holds: `prepare` first runs from `update`.
  - **`render()`.**
    - `landmarks.update(…)` gains `extra: gargantuans.impostors` (0, in place). The gargantuans' `update(camera, camLocal, state.spaceT)` goes just before it (+1).
    - `things.update({ ship: state.ship, camera, cam: camLocal, t: state.spaceT, dt, flying: flying() && !onFoot() && !state.dive && !props.frozen })` goes right after `places.update(…)` (+1).
  - **The light.** `lightAt(…, { nova, stars: expanse.stars() })` becomes `stars: [...expanse.stars(), ...gargantuans.stars()]` (0). If that allocation shows in the frame time, keep one merged array in `gargantuans`.
  - **The solids.** The step's `solidsWith(…)` and the autopilot's `moving` gain `gargantuans.solids(state.ship)` (0, both in place).
  - **The lens.** In `bend()`, `const L = deep.lens?.();` becomes `const L = gargantuans.lens(camLocal) ?? deep.lens?.();`, `d > 3500` becomes `d > (L.far ?? 3500)`, and `DISK_N` becomes `L.axis ?? DISK_N` (0, all in place).
  - **The quality steps.** In `paceTo`: `things.setStep(at.step, at.floor); gargantuans.setStep(at.step, at.floor);` (+1).
  - **Dispose.** `things.dispose(); gargantuans.dispose();` beside `expanse.dispose();` (+1).
  - **The dev hooks.** `__universeDebug` gains `things: things.debug, gargantuans: gargantuans.debug` (0, on its line).

  That is +10. With Task 21's −50 it leaves room for Task 24.
- Modify: `scripts/universe-endless-check.mjs`: the `things` and `gargantuan` steps

**Interfaces:**
- Consumes: Tasks 12–21; lane 3's `places.park(id, from)`, `places.here()`, `places.resolve(id)`, the scene's `travel(id, drive)`, and lane 2's `teleport(x, y, z, heading, pitch)`.
- Produces: **`createThings(group, deps) → { drawers, update(frame), setStep(step, floor), debug, dispose() }`**. Task 24 adds the rest.
  - `drawers` is `createThingDrawers`'s.
  - `update` feeds the pockets (`createPocketFeed`) from `deps.sectors()`.
  - **`debug`:**
    - `kinds() → string[]`: `[...Object.keys(KINDS).filter((k) => k !== 'system' && k !== 'station'), 'binary', 'trinary']`. That is 32, each once: `KINDS` already holds the five gargantuan forms, so they aren't added again. `system` and `station` are lane 3's own steps.
    - **`shown(kind, id) → boolean`**: whether that kind's own drawer has it on screen. Only near kinds go through the drawers, so each class of kind has its own test:
      - a kind whose `KINDS[kind].near` is true: `drawn()[kind] > 0`
      - `pocket`, `remnant` and `nebula` (a legacy one): `deps.nebulae.shown()` holds `id` (Task 17)
      - the five gargantuan forms: `deps.meshed()` holds `id` (Task 20)
      - `binary` and `trinary`: `deps.solids()` holds `id + ':c0'` or `id + ':c1'`, the companion lane 2's `near.js` builds (Task 15)
    - `find(kind) → id | null`: `nearestOfKind(deps.sectors().values(), kind, [ship.x, ship.y, ship.z], t)?.id`, from lane 2's `Map` and the ship's object. Else, for a gargantuan form not in the loaded sectors, `spaceId(gargantuanSectors(universe, sectorAt(ship.x, ship.y, ship.z), { form })[0], { wonder: 3 })`.
    - `force(kind) → Promise<id | null>`: `travel(find(kind), 'hyper')`, which waits on lane 3's fetch when the sector isn't at hand
    - `parkOf(kind) → Promise<{ id, park } | null>`: `find(kind)`, `places.fetch(id)` when its sector isn't at hand, then `places.park(id, [ship.x, ship.z])`. It moves nothing: the check teleports there with `__universeDebug.teleport(park.x, park.y, park.z, park.heading, 0)`.
    - `drawn()`: the drawers'
    - `pockets()`: the feed's shown ids

- [ ] **Step 1: Write the failing tests** in `things/index.test.js` (Node, three):
  - with a fake `sectors` (a `Map`) holding one of every list kind and a fake `places` whose `park` gives a fixed park and whose `fetch` resolves:
    - `debug.kinds()` is exactly the 32 above, pinned as a list in the test, with no repeat
    - `shown` is true, with fakes, for a rock when `drawn().rock` is 1; for a pocket and a legacy nebula when the fake `nebulae.shown()` holds their ids; for an arc when `meshed()` holds it; for a binary when `solids()` holds `<id>:c0`. It is false for each otherwise.
    - `find('comet')` is the comet's id
    - `parkOf('storm')` resolves to `{ id, park }` with that park, and moves nothing
    - `force('arc')` with no arc loaded calls `travel` with `E:<sector>:w3` from `gargantuanSectors`
    - `update` hands the pocket to a fake `nebulae`
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/things/index.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement, and wire `scene.js`.** Count its lines.
- [ ] **Step 4: Run them and see them pass, then check it in the browser.**
  - Run `npm test`. Expected: PASS.
  - **First, the scene builds.** Run `CHROMIUM=/opt/pw-browsers/chromium node scripts/autopilot-check.mjs --only smoke --skip lint,test,build --routes /universe`. Expected: exit 0, no page error and no console error (it fails on either, `autopilot-check.mjs:172-176`). A `prepare` thunk run before `warm` is declared shows here as a `ReferenceError`, before any endless step runs. Don't go on until this passes.
  - **The endless check's two new steps:**
    - **`things`:** for each kind in `debug.kinds()`:
      1. Take `{ id, park }` from `await parkOf(kind)`, and teleport there.
      2. Wait until `__universe().place` is that id.
      3. Wait until `things.debug.shown(kind, id)`.
      4. Shoot `things/<kind>.jpg` into the evidence folder.
      5. **For `binary` and `trinary`, the handover without a pop** (Global Constraints, "Binary and trinary systems"; lane 2's level rule). Teleport to `1.5 × systemReach` from the star and wait until `solids()` lacks `<id>:c0` (lane 2 lets a built system go past 1.3 × its reach). Then teleport to `1.002 × systemReach`, on the line that puts companion 0 on screen facing the star, and hold: wait two frames, shoot A, and check `solids()` still lacks `<id>:c0` (not built). Teleport to `0.998 × systemReach` on the same line, wait until `solids()` holds `<id>:c0` (built), then two frames, and shoot B. The camera moved 0.4% of the reach, so the companion's size changed by under half a percent. A and B, cropped to a box of `4 × ` the companion's projected radius round its projected point (from `__universeDebug.camera`), have no differing blob over 4 px across, by the same blob measure lane 2's held-pose pop check uses (lane 2's step 6). Record `expanse.pops()` over the step too. Expected: under 4 px both.
    - **`gargantuan`** (the spec's "reaches a gargantuan"):
      1. `force('gargantuan')` by the jump, and wait until arrived.
      2. Teleport to `4 N` and `2 N` out along the line in, and check `gargantuans.debug.angle(id)` is `2 × atan(size / d)` to 1e-3 rad.
      3. With `scripts/lib/nebula-measure.mjs`'s parallax and roll measures (lane 1's Task 10), pointed at `gargantuans.debug.screen(id)`, check two poses 5,000 sideways shift it by its parallax within 2 px. Roll the ship 90° and check the impostor's up turns with the stars within 2°.
      4. Step in from `1.3 N` to `0.7 N` in teleports of `0.05 N`, checking `handover(id).k + handover(id).fade` is 1 at each.
      5. Shoot `gargantuan-far.jpg` and `gargantuan-near.jpg`.
  - Run `node scripts/universe-endless-check.mjs --quality mid --only things,gargantuan`. Expected: exit 0, no console errors.
  - Run `node scripts/universe-check.mjs --quality mid --out lab/universe/after-4a-22/mid`. Expected:
    - **Every pose's `errors`** in `after-4a-22/mid.json` empty.
    - **The ten baseline poses:** calls and triangles equal to `before-4a/mid`. Pictures may change: 4a.1's far specks (already in `after-4a-11`) and now the home block's gargantuan on the sky, on purpose, before and after side by side in the README.
    - **`old-rim` and `above-core`:** equal.
    - **`expanse-system` and `expanse-station`:** what the generated system's fields, comets and fleet add. Say the numbers; Task 25 re-records them.
- [ ] **Step 5: Commit.** `git commit -m "The catalogue drawn in the scene, gargantuans on the sky and near, each kind forced by a dev hook and visited by the endless check"`. The body has `scene.js`'s count and the table of calls and triangles.

---

## PR 4a.3: What you can do with them, and the checks

### Task 23: The rules of things (pure)

**Files:**
- Create: `src/components/universe/things/rules.js`, `src/components/universe/things/rules.test.js`
- Modify: `src/components/universe/words.js` (`THINGS`)

**Interfaces:**
- Consumes: `createPayLedger` (`earnRules.js`, through `universe/shared/wallet.js` if it's reached from outside, else directly); Task 3's `traitsOf`; Tasks 5 and 9's `tailOf` and `wormholeExit`; `rowAt`; `EVENTS` is passed in, never imported.
- Produces:
  - **`ACT = { salvage: ['outpost', 'derelict', 'debris'], scan: ['relay', 'monolith'], hail: ['fleet'], follow: ['beacon'] }`**
  - **`PAYS = { ore: ['found', 1], salvage: ['found', 2], relay: ['found', 1], lore: ['found', 3], tail: ['found', 1] }`**
  - **`ORE = { perField: 5 }`, `TAIL = { hold: 2 }`, `STORM = { drain: 4, floor: 10 }`, `BEAM = { width: 0.06, static: 1.2, cool: 6 }`, `THROAT = 0.45`**
  - **`LEADS = { trap: ['derelict', 'hunt'], distress: ['distress', 'escort'], treasure: ['treasure'] }`**
  - **`actionOf(row) → 'salvage' | 'scan' | 'hail' | 'follow' | null`**
  - **`createThingRules({ events, universe }) → { … }`**, with its ledger made by `createPayLedger()`. `universe` is the scene's, for `wormholeExit`.
    - **`act(row, { side }) → Outcome`**, where `Outcome = { pay?: [what, n], note?: string, lead?: eventId, hunt?: { faction, from } }`:
      - `salvage`: once a thing a visit `{ pay: PAYS.salvage, note: THINGS.note.salvaged(name) }`, after that `{ note: THINGS.note.empty(name) }`. A derelict whose `traitsOf(row).trap` is true gives `{ note: THINGS.note.trap(name), lead: leadEvent('trap', events) }` instead, once.
      - `scan`: a relay gives `PAYS.relay` once. A monolith gives `PAYS.lore` and `THINGS.lore[traitsOf(row).lore]` once, then the lore alone.
      - `hail`: hostile when `side?.factions?.[row.faction.id]?.role === 'hunt'`. Then `{ note: THINGS.note.hostile(name), hunt: { faction: row.faction.id, from: the capital's place } }`; else `{ note: THINGS.note.hailed(name) }`.
      - `follow`: `{ note: THINGS.note.signal, lead }`, where `lead = leadEvent(traitsOf(row).leads, events)`, or `{ note: THINGS.note.quiet }` when it's null.
    - **`ore(field, k) → Outcome | null`**: `PAYS.ore` for the first `ORE.perField` rocks of a field a visit, then null.
    - **`effects(rows, ship, t, dt, { shield, trip }) → { static, drain, tail, through, notes }`**, over the near rows of these kinds:
      - `drain`: inside a storm (`|ship − rowAt| < size`), `min(STORM.drain × dt, max(0, shield − STORM.floor))`. It's a drain, not a hit: the scene plays it through `drain`, never `hurt` (Task 24).
      - `static`: in a pulsar's or magnetar's beam (within `BEAM.width` rad of a `beamDirs` direction and within `traits.beam × size`), `BEAM.static`
      - `tail`: after `TAIL.hold` seconds running inside a comet's tail, its id once a visit, with `PAYS.tail`
      - `through`: inside `THROAT × size` of a wormhole, with `trip` false, `{ id, exit: wormholeExit(row, universe) }`
      - `notes`: the first time a storm or a beam takes you, `THINGS.note.storm` or `THINGS.note.beam`, no more often than every `BEAM.cool` seconds
  - **`leadEvent(lead, events) → id | null`**: the first of `LEADS[lead]` that `events` has.
  - **`THINGS`** in `words.js`:

    ```js
    export const THINGS = {
      verb: { salvage: 'Salvage', scan: 'Scan', hail: 'Hail', follow: 'Follow the signal' },
      note: {
        salvaged: (name) => `Salvaged ${name}`,
        empty: (name) => `${name}: nothing left worth taking`,
        scanned: (name) => `Scanned ${name}`,
        trap: (name) => `${name} wakes up`,
        signal: 'Following the signal…',
        quiet: 'The signal’s gone quiet.',
        hailed: (name) => `${name} answers: safe flying.`,
        hostile: (name) => `${name} answers with its guns`,
        ore: 'Ore from a rock, sold',
        tail: (name) => `Through the tail of ${name}`,
        storm: 'In an ion storm: the shields are draining',
        beam: 'Caught in a pulsar’s beam',
        through: (name) => `Through ${name}`,
        cameFrom: 'Where you came in',
      },
      lore: [
        'The signs count down to something. The count is nearly done.',
        'Cut before the first stars in this sky were lit.',
        'A map of a galaxy that isn’t this one.',
        'It hums a note only the hull can hear.',
        'Every face is the same face, turned a little.',
        'The stone is warm. Nothing out here is warm.',
        'One name, again and again, in a thousand hands.',
        'It points at the same star from wherever you stand.',
        'The marks are newer on the side that faces home.',
        'Someone left it here to be found. You found it.',
        'Its shadow falls the wrong way.',
        'A warning or a welcome. Here the two share a sign.',
      ],
    };
    ```

- [ ] **Step 1: Write the failing tests:**

```js
import { describe, expect, it } from 'vitest';
import { THINGS } from '../words';
import { EVENTS } from '../director';
import { LEADS, ORE, STORM, THROAT, actionOf, createThingRules, leadEvent } from './rules';

describe('what a thing does', () => {
  it('says what E does at each kind, and nothing at the rest', () => {
    expect(['outpost', 'derelict', 'debris', 'relay', 'monolith', 'fleet', 'beacon', 'rock', 'storm'].map((kind) => actionOf({ kind }))).toEqual(['salvage', 'salvage', 'salvage', 'scan', 'scan', 'hail', 'follow', null, null]);
  });
  it('pays for salvage once a thing a visit, then says there’s nothing left', () => {
    const r = createThingRules({ events: EVENTS });
    const row = { id: 'E:1,0:w66', kind: 'outpost', name: 'Velan', at: [0, 0, 0], size: 60, seed: 3n };
    expect(r.act(row, {})).toEqual({ pay: ['found', 2], note: THINGS.note.salvaged('Velan') });
    expect(r.act(row, {})).toEqual({ note: THINGS.note.empty('Velan') });
  });
  it('lets a trapped derelict wake into an event the director has', () => {
    expect(leadEvent('trap', EVENTS)).toBe('hunt'); // (lane 4b's 'derelict' isn't there yet)
    expect(leadEvent('trap', { ...EVENTS, derelict: {} })).toBe('derelict');
    expect(leadEvent('treasure', EVENTS)).toBeNull();
    expect(LEADS.distress[0]).toBe('distress');
  });
  it('turns a hostile fleet on you only when hailed, and from its capital', () => {
    const r = createThingRules({ events: EVENTS });
    const fleet = { id: 'E:1,0:w50000', kind: 'fleet', name: 'Kesh', at: [10, 0, 0], size: 100, faction: { id: 'empire' }, ships: 4, seed: 9n };
    const sw = { factions: { empire: { role: 'hunt' } } };
    expect(r.act(fleet, { side: sw })).toMatchObject({ hunt: { faction: 'empire' }, note: THINGS.note.hostile('Kesh') });
    expect(r.act(fleet, { side: { factions: {} } })).toEqual({ note: THINGS.note.hailed('Kesh') });
  });
  it('pays ore for five rocks of a field a visit', () => {
    const r = createThingRules({ events: EVENTS });
    const field = { id: 'E:1,0:w20000' };
    expect(Array.from({ length: 8 }, (_, k) => r.ore(field, k)?.pay ?? null)).toEqual([...Array(ORE.perField).fill(['found', 1]), null, null, null]);
  });
  it('drains the shields in a storm, never below the floor, and never destroys the ship', () => {
    const r = createThingRules({ events: EVENTS });
    const storm = { id: 's', kind: 'storm', name: 'Thel', at: [0, 0, 0], size: 2000, seed: 1n };
    const inside = { x: 100, y: 0, z: 0 };
    expect(r.effects([storm], inside, 0, 0.5, { shield: 80, trip: false }).drain).toBeCloseTo(STORM.drain * 0.5);
    expect(r.effects([storm], inside, 0, 0.5, { shield: 10.5, trip: false }).drain).toBeCloseTo(0.5);
    expect(r.effects([storm], inside, 0, 0.5, { shield: STORM.floor, trip: false }).drain).toBe(0);
  });
  it('throws you through a wormhole only when you fly in by hand, 30 to 80 sectors away', () => {
    const r = createThingRules({ events: EVENTS, universe: 1n });
    // (a wormhole row carries its sector, plain data, for wormholeExit: Task 9)
    const hole = { id: 'E:1,0:w8', kind: 'wormhole', name: 'Aur', at: [120000, 0, 0], size: 100, seed: 5n, sector: [1, 0, 0] };
    const at = { x: 120000 + THROAT * 100 - 1, y: 0, z: 0 };
    expect(r.effects([hole], at, 0, 0.1, { shield: 100, trip: true }).through).toBeNull();
    const through = r.effects([hole], at, 0, 0.1, { shield: 100, trip: false }).through;
    expect(through).toMatchObject({ id: 'E:1,0:w8' });
    const far = Math.hypot(through.exit.sector[0] - 1, through.exit.sector[1], through.exit.sector[2]);
    expect(far).toBeGreaterThanOrEqual(30);
    expect(far).toBeLessThanOrEqual(80);
  });
});
```

  Also:
  - a monolith's first scan pays `['found', 3]` and gives its lore line; the second gives the lore alone
  - a comet's tail pays once after 2 s inside, not before, and never twice
  - a beam's note comes no more often than every `BEAM.cool` seconds
  - every `THINGS` string passes the words test (curly quotes, no retired word)
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/things/rules.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.** The header says how each action uses what the site has: credits through `pay` and the `found` key, fights through `hunters.pack`, events through the director, and no new economy.
- [ ] **Step 4: Run them and see them pass.** Run `npx vitest run src/components/universe/things src/lib/words.test.js`. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "What each thing does, as rules: ore, salvage, scans, hails, signals, tails, storms, beams and wormholes"`

### Task 24: The scene plays them

**Files:**
- Modify: `src/components/universe/things/index.js` and its test (the actions)
- Modify `src/components/universe/scene.js`. Each change says the lines it adds:
  - **`createThings`' deps** (on its line, 0; `EVENTS` joins `scene.js`'s import from `./director`, 0 lines): `pay: (w, n) => pay(w, n)`, `note: (text) => { state.note = { text, until: wall() + 3 }; }`, `emit: (e) => emit(e)`, `happen: (id) => happen(id, state.ship)`, `soon: (id) => director?.soon(id)`, `hunt: (faction, from) => hunters?.pack(faction, state.ship, { from, size: 3 })`, `side: () => sideHere()`, `shield: () => state.shield`, `drain: (n, floor) => drain(n, floor)`, `scramble: (s) => { state.static = Math.max(state.static, s); }`, `trip: () => Boolean(state.auto || state.jump)`, `throwTo: (park, opts) => throwTo(park, opts)`, `events: EVENTS`. All are thunks, since each is declared below the call. There is no `follow` dep yet: it is lane 4b's to pass (below).
  - **The drain** (+6), just below `hurt` (`:3154-3168`), which it mirrors without the hit:

    ```js
    // a drain on the shields that isn't a hit (an ion storm's, things/rules.js): no laser, no shake, no flash, never under `floor`
    const drain = (n, floor) => {
      if (state.crash || !state.ship || powers.mods.ghost || !(n > 0)) return;
      state.shield = Math.max(Math.min(state.shield, floor), state.shield - n * state.stats.armor * state.stats.armorGame);
      if (state.shield < 35 && !state.lowSaid) { state.lowSaid = true; emit({ type: 'shields' }); }
    };
    ```

    - Why not `hurt`: it emits `{ type: 'laser' }`, sets `hitAt`, `hurt` and the shake on every call. Called every frame inside a storm, Comms would play its hit sound every 120 ms and a crew "hit" line on each (`Comms.jsx:249-251`), and the screen would shake for as long as you're in.
    - It keeps what a hit keeps: plating (`armor`, `armorGame`), the ghost mod ("nothing of the game's lands"), and the low-shields alarm once (`lowSaid`, reset at `:3982` as before). It never destroys the ship.
  - **Bolts.** `const mh = meteors.hit(shotFrom, b.position) ?? mines.hit(shotFrom, b.position);` (`:2606`) gains `?? things.hit(shotFrom, b.position)`, and the missiles' (`:2790`) the same (0, both in place).
  - **The lock.** `const rocks = (meteors.count || mines.count) && …` (`:4526`) becomes `(meteors.count || mines.count || things.count) && … ? [...meteors.targets, ...mines.targets, ...things.targets] : []` (0, in place). (Name the local something other than `rocks` if Task 21's `rocks` is in scope.)
  - **E.** After the `state.at` branch (`:5502`): `if ((key === 'e' || (key === 'enter' && !onControl)) && things.canAct()) { e.preventDefault(); things.act(); return; }` (+1).
  - **The prompt.** In `placePrompt`, before the aim's branch: `else if (!onFoot() && flying() && things.prompt()) { text = things.prompt(); cap = 'E'; }` (+1).
  - **The throw.** `riftThrough` (`:4210`) splits: its body after `const park = …` becomes `throwTo(park, { flash: 2.4 })`, the same lines, and the wormhole uses it too (0).
  - **`where()`** gains `cameFrom: things.cameFrom(),` (+1).
  - **The handle** gains `act: (id) => things.act(id),` (+1).

  That is +11 here: Tasks 22 and 24 add 21 lines, against Task 21's −50.
- Modify:
  - `src/components/universe/UniverseMap.jsx`: the handle gains `act: (id) => view.current?.act?.(id) ?? false`
  - `src/pages/Universe.jsx`: the map ref's stand-in gains `act: () => false`. `onEvent` handles `{ type: 'thing', what: 'can' | 'cannot', id, verb }` into an `act` state.
  - `src/components/universe/UniversePanel.jsx`: an `action` prop, passed through to the card
  - lane 3's `src/components/universe/places/PlaceCard.jsx` and its test: with `action = { verb, onAct }`, the one primary button reads the verb, with a `kbd` cap E, and calls `onAct`
- Modify: `scripts/universe-endless-check.mjs`: the `ore`, `hazards` and `wormhole` steps

**Interfaces:**
- Consumes: Task 23; Task 13's `fields()`; Task 21's `smash`; lane 3's `places.here()`, `places.resolve(id)`, `PlaceCard`.
- Produces, on `createThings`:
  - **`hit(from, to) → { at, size } | null`**: a bolt's segment against the near fields' rocks (`segment distance < 0.12 + r`). A hit smashes the rock (Task 21's `smash`, so it's gone `ROCK_HIT.gone`), then `pay`s `rules.ore` and `note`s `THINGS.note.ore` when that gives an outcome.
  - **`targets`**: one array kept between frames, the 12 rocks of near fields nearest the ship within 400, each `{ id: field.id + ':' + i, at: Vector3, vel: Vector3(0, 0, 0), size: r, hp: 1, hpMax: 1, kind: 'rock', faction: 'rocks', threat: 0 }` (`meteors.js`'s shape)
  - **`count`**: their number
  - **`prompt() → string | null`**: `` `${THINGS.verb[action]} · ${name}` `` while `places.here()` is a thing with an action, the ship is slow (`|speed| < 1`) and flying
  - **`canAct() → boolean`**
  - **`act(id = here) → boolean`**: plays `rules.act`'s outcome through `pay`, `note`, `soon(lead)` (or `happen` for a trap) and `hunt`. It emits `{ type: 'thing', what: 'acted', id, action }`.
    - **A beacon's lead goes through one rule.** When `deps.follow(row, lead)` is given and returns true, it has taken the beacon, and `soon` isn't called. Lane 4b passes its `events.follow` here. Without it, `soon(lead)` plays the director's event.
    - So there is one beacon rule, `traitsOf(row).leads`, rather than this lane's and a second `followOf(id)` (finding 16).
  - **`update`** also plays `rules.effects` each frame while flying: `drain(drain, STORM.floor)` (never `hurt`), `scramble(static)`, `pay` for a tail, `note`, and for `through`, `throwTo(exit park)`. It sets `cameFrom` to `{ id, name, at, key }` and emits `{ type: 'thing', what: 'through', id, to: exit.key }`.
  - It emits `'can'` and `'cannot'` as the actionable place comes and goes.
  - **`cameFrom() → { id, name, at, key } | null`**, for lane 6b's map (`THINGS.note.cameFrom` is its label). It is the scene's one `where().cameFrom`.
  - **`setCameFrom({ id, name, at, key })`**: how anything else that throws you one way records where you came in, lane 4b's rift among them. That keeps one `where()` key in one shape, rather than a second `{ at, sector }` (finding 16).

- [ ] **Step 1: Write the failing tests** in `things/index.test.js`, with fakes for every dep:
  - **Ore:** a bolt through a near field's rock hits it, calls `smash` once and pays `['found', 1]`. The sixth rock of the field pays nothing.
  - **The lock:** `targets` holds at most 12, nearest first, all within 400.
  - **Salvage:** parked still at an outpost (`places.here()` it), `prompt()` reads `Salvage · <name>`. `act()` pays `['found', 2]`; a second `act()` notes `empty`. Moving at 2 units a second, `prompt()` is null.
  - **A trap:** a trapped derelict's `act()` calls `happen('hunt')` (no `'derelict'` in today's `EVENTS`).
  - **A hostile fleet:** hailing one with a hunting side calls `hunt('empire', from)`.
  - **A storm:** inside one, the `drain` dep is called with `STORM.drain × dt` and `STORM.floor` each frame, `hurt` is never called and `emit` never gets `{ type: 'laser' }`, and over 60 s at `dt` 0.25 a fake shield that `drain` lowers never goes under 10.
  - **A wormhole:** flying in by hand calls `throwTo` with a park at `wormholeExit`'s point and sets `cameFrom`. On a trip it calls neither.
  - **The hooks for lane 4b:** `setCameFrom(x)` makes `cameFrom()` return `x`. A beacon's `act()` with a `follow` dep returning true calls it with the row and its lead and doesn't call `soon`; without the dep it calls `soon(lead)`.
  - **`PlaceCard.test.jsx`:** with an `action`, the button reads `Salvage` with an E cap; without one, as before.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/things src/components/universe/places/PlaceCard.test.jsx`. Expected: FAIL.
- [ ] **Step 3: Implement, and wire.** Count `scene.js`'s lines.
- [ ] **Step 4: Run them and see them pass, then check it in the browser.**
  - Run `npm test`. Expected: PASS.
  - **The endless check's three new steps:**
    - **`ore`:**
      1. Teleport to `parkOf('field')`.
      2. Wait until `things.targets` has a rock; aim at it with `__universeDebug.state` and fire through the guns' dev hook.
      3. Wait until the wallet's credits rise by `EARN.found.credits` (`__universeDebug.economy`).
      4. Shoot `ore.jpg`.
    - **`hazards`:**
      1. Teleport to `parkOf('storm')`, then into its middle.
      2. Read `__universeDebug.state.hitAt`. Wait until the shield falls, then until 60 more seconds of the wall clock have passed (on a condition), and check it's at 10 or more, `state.hitAt` hasn't changed (no `hurt`: no laser event, no shake) and `state.shake` is 0.
      3. Teleport to `parkOf('pulsar')`, turn into a beam by `beamDirs`, and wait until the HUD has `data-static`.
    - **`wormhole`:**
      1. Teleport to `parkOf('wormhole')`, then fly in by hand.
      2. Wait until `where().cameFrom.id` is the wormhole and the ship's sector is the exit's.
      3. Shoot `wormhole.jpg`.
  - Run `node scripts/universe-endless-check.mjs --quality mid --only ore,hazards,wormhole`. Expected: exit 0, no console errors.
  - At 390 × 844, the card's action button is inside the panel.
- [ ] **Step 5: Commit.** `git commit -m "Shoot a field's rocks for ore, salvage, scan, hail and follow at E, and storms, beams, tails and wormholes as you fly"`. The body says `scene.js`'s count.

### Task 25: The poses, the full measure, and the hand-off notes

**Files:**
- Modify: `src/components/universe/poses.js` (`'at-gargantuan'` and `'in-field'`), `src/components/universe/poses.test.js`, `scripts/universe-check.mjs:31` (the two names)
- Create: `docs/superpowers/evidence/endless-universe-lane-4a/HANDOFF-NOTES.md`
- Modify: `docs/superpowers/evidence/endless-universe-lane-4a/README.md`

**Interfaces:**
- Produces:
  - **`poseFor('at-gargantuan')`**: parked at `E:<the home block's gargantuan sector>:w3`, at `0.75 × nearOf(row)` on its sun's side, facing it. The mesh is up and whole: `landK` is 0 inside `0.8 N`, so the baseline records the mesh alone. (At `0.9 N`, `k` is about 0.16, and the baseline would hold the impostor and the mesh crossfading.)
  - **`poseFor('in-field')`**: parked in the middle of `E:1,0`'s first field, facing out along its widest axis.
  - Both are built only when asked, as lane 3's `expanse-station` is: `POSES` holds plain marker rows, and nothing at `poses.js`'s top level makes a sector.

- [ ] **Step 1: Write the failing test:**
  - `poseFor('at-gargantuan').at` is within `0.75 × nearOf(row) + 1` of the gargantuan, `landK(dist, nearOf(row))` there is 0, and its heading faces it (the dot over 0.99)
  - `poseFor('in-field').at` is within `0.12 × size` of the field's middle
  - `POSES` holds no row or sector, and a second call gives an equal pose
- [ ] **Step 2: Run it and see it fail.** Run `npx vitest run src/components/universe/poses.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement**, and add the names to `universe-check.mjs`.
- [ ] **Step 4: Run it and see it pass.** Same command. Expected: PASS.
- [ ] **Step 5: The full measure, once.** Run these in the background, and wait on their exits:
  - `node scripts/universe-check.mjs --quality high --out lab/universe/after-4a/high`, then the same for `mid` and `low`, as three runs (`universe-check.mjs` ignores `--out` across tiers)
  - `QUALITY=mid node scripts/perf-probe.mjs universe` and `QUALITY=low …`, against Task 1's Step 0

  Expected:
  - **Draw calls and triangles** at every pose in `lab/universe/baseline/<tier>.json`: no higher than before. The keep-outs keep every thing's build and every pocket away from the hand-made poses, and the gargantuan quad takes a slot that never drew.
  - **Frame time:** p50 no worse than 2% at the baseline poses (perf-probe, against Task 1's Step 0).
  - **The endless baselines, re-recorded** in one run a tier: `--poses old-rim,above-core,expanse-system,expanse-station,at-gargantuan,in-field --out lab/universe/endless/<tier>`.
  - **Phones still fly where this lane builds** (done item 10; Review Focus 7). The baseline poses build nothing of this lane's, so their frame time can't show its cost. From the re-recorded `lab/universe/endless/low.json` and `mid.json`, the `frameMsMedian` at `at-gargantuan`, `in-field` and `expanse-system` is each at most 1.15 × lane 3's `expanse-system` median at the same tier (`lab/universe/before-4a/endless-<tier>.json`, kept in Task 1's Step 0), measured in the same container. Over it, this lane's `low` or `mid` `thingKinds` counts or `gargantuan` detail come down (Task 12's table, its test's rows with them, named in the commit) until it holds. The bound isn't raised. The README gives the five numbers a tier.
    - `at-gargantuan` and `in-field` are new and become their own baselines.
    - `expanse-system` and `expanse-station` rise by what this lane's kinds add there (say by how much, and that it's on purpose).
    - `old-rim` and `above-core` should be equal. Any change there is a finding.
- [ ] **Step 6: The endless check, whole.** Run `node scripts/universe-endless-check.mjs --quality mid`, then `--quality low`: lane 2's, lane 3's and this lane's steps. Expected: exit 0 both times. Copy the per-step table into the README.
- [ ] **Step 7: The repo's checks** (the dev server first, as Global Constraints says):
  - `navmap-check`, `sector-check`, `flyto-check --fake` and `links-check`
  - `autopilot-check.mjs --only smoke --skip lint,test,build --routes /universe`
  - `landing-check.mjs`

  Expected: each as before Task 1.
- [ ] **Step 8: Write the README and the hand-off notes.**
  - **The README** holds:
    - before and after, side by side, at the poses whose picture changed
    - the calls and triangles per pose and tier
    - frame times
    - `scene.js`'s lines at Tasks 21, 22 and 24
    - `glsl-sites`, `boundary-breaks`, `cycles` and `big-files`, before and after
    - a sector's counts by kind
    - the ten-sector time before and after 4a.1
  - **`HANDOFF-NOTES.md`, "Landed":** every module above by path with its interface in one line; the catalogue's 23 entries and 32 kinds; the dev hooks; the endless steps (`things`, `gargantuan`, `ore`, `hazards`, `wormhole`); the two poses; the re-recorded endless baselines.
  - **`HANDOFF-NOTES.md`, "Left":**
    - **Lane 4c:** the arrival's gargantuans go in `ARRIVAL_GARGANTUANS` (`expanse/gen/gargantuans.js`), rows `checkGargantuan` passes, at `E:0,0:w4` on.
      - Each is drawn and parked like any other, and the core's appended systems, lattice and lists keep off it (Task 10), so adding one moves what the core appends round it. Nothing stored names those.
      - Only the first impostor in the main sector is free. Each further one costs its quad's two triangles at any baseline pose it's in view from, and a mesh within `1.2 × nearOf(row)`. Put them past that from every baseline pose, or pay for them. `things/clear.test.js` measures from the poses' own points.
      - They reach the sky through `gargantuans.impostors`, which `landmarks.update`'s `extra` takes nearest first, at most `EXTRA_ROOM` (7), every borrowed slot written back each frame (Task 19).
    - **Lane 4b:**
      - **One wormhole rule.** Lane 4b's rift takes its exit from `wormholeExit({ seed, sector }, universe)` (`extras/stars.js`, on the face), not a second `wormholeExit(from, rand)` of its own.
      - **One `where().cameFrom`.** It records where you came in through `things.setCameFrom({ id, name, at, key })`, rather than adding a second `cameFrom: { at, sector }` to `where()`.
      - **One beacon rule.** It passes `follow: (row, lead) => events.follow(…)` to `createThings`, which hands it every beacon with `traitsOf(row).leads`, rather than a second `followOf(id)`.
      - a derelict's trap leads to `'derelict'` and a beacon to `'treasure'` once those events exist (`things/rules.js`'s `LEADS`); today they fall back to `'hunt'` and `'distress'`, or a quiet line
      - the storm, comet, wormhole and herd looks and rules are there for the ion-storm front, the comet fly-by, the wormhole opening and the leviathan migration (`things/looks/weather.js`, `comet.js`, `life.js`; `rules.js`'s `effects`)
      - tidal pull near a black hole: a generated hole has no pull of its own; `gargantuans.debug.rows()` gives where they are. A hole of its own is `buildHole(parent, { r, disk, uTime, … })`, and its `uTime` is required.
      - the ion storm front lowers the shields through the scene's `drain(n, floor)` (beside `hurt`), never `hurt`, so a front makes no hit sound, crew line or shake
    - **Lane 5b:** a rocky rogue planet's card has `land: true`, and its id is `E:…:w<n>`, not a planet id. `planetSpecOf` needs to take it, through `traitsOf(row).type` and the row's size and seed.
    - **Lane 6b:**
      - each kind's card carries `chart: { shape, priority }` for its mark
      - `where().cameFrom` is the wormhole's mark, labelled `THINGS.note.cameFrom`
      - gargantuans list out to 400,000 (`far`), outside `placesAround`'s cap (lane 3's `around.js`, Task 10)
      - `paths.js` imports only `orbits.js`, so `rowAt` can join the light face for marks that move, at no weight
    - **Every later lane:**
      - anything made in the scene before `warm` (`scene.js:948`) makes its materials on hidden meshes and calls `prepare` only from `update` (Global Constraints, "Warm-up")
      - "not a pixel changes" is `universe-check --t <seconds>` and `scripts/same-pixels.mjs`, not pixel-measure's statistics
    - Anything that rose at an endless pose, and why.
- [ ] **Step 9: Run the gates and commit.** Run `npm run lint`, `npm test`, `npm run build` and `node scripts/health.mjs --check --skip build`. Expected: all green, within budget. Then `git add src/components/universe/poses.js src/components/universe/poses.test.js scripts/universe-check.mjs lab/universe/after-4a lab/universe/endless docs/superpowers/evidence/endless-universe-lane-4a && git commit -m "Lane 4a measured at every tier, posed at a gargantuan and in a field, and its hand-off notes"`

---

## What later lanes consume

| Name | From | Used by |
|---|---|---|
| `ARRIVAL_GARGANTUANS`, `ARRIVAL_BASE`, `checkGargantuan`, `GARGANTUAN_FORMS`, `GARGANTUAN`, `gargantuanKeeps` | `expanse/gen/gargantuans.js`, via `expanse/shared/space.js` | 4c (the arrival's gargantuan) |
| `nearOf`, `impostorOf`, `inView` | `universe/gargantuans/rules.js` | 4c (where its gargantuan sits on the sky) |
| `landK`, `drawnAngle`, `quadAxes` (pure; `landmarks.js` re-exports them) | `universe/landmarkRules.js` | 4c, anyone pure that crossfades a landmark |
| `createGargantuans(…).debug` (`rows`, `meshed() → ids`, `angle`, `handover → { k, fade }`, `screen`), `gargantuans.solids`, `.stars`, `.lens` (`at` a kept `Vector3`) | `universe/gargantuans/index.js` | 4b (tidal pull), 4c |
| `CATALOGUE`, `KINDS`, `lookOf`, `solidOf`, `traitsOf`, `PLANET_SIZE` | `expanse/gen/catalogue.js` | 4b, 5b, 6b |
| `rowAt`, `pathAt`, `pathSpeed`, `tailOf`, `COMET_PERIOD` | `expanse/gen/paths.js`, `extras/systems.js` | 4b (the comet fly-by, storm front), 6b (marks where movers are) |
| `kindsIn`, `nearestOfKind` | `expanse/gen/finder.js` | 4b (an event at a kind of thing), 6b |
| `wormholeExit({ seed, sector }, universe)`, `companionsOf`, `companionAt` | `extras/stars.js`, `companions.js` | 4b (its rift's exit: the one rule), 6b |
| `SECTOR_EXTRAS`, `EXTRA_LISTS`, `NEBULA_SHOW` (`extras/index.js`); `EXTRA_HIGH` (`things.js`); `CUBE_HALF` (`cube.js`) | `expanse/gen/`, via the face | 4b, 6b |
| `FAR`, `FADE`, `levelWeights` on the face (lane 2's, lent by this lane) | `expanse/shared/space.js` | anyone in the universe that fades by distance |
| `CATALOGUE_CARDS` (`type`, `about`, `solid`, `far`, `move`, `land`, `chart`) | `universe/things/cards.js`, spread into lane 3's `THING_CARDS` | 5b (`land`), 6b (`chart`) |
| `THINGS` (`verb`, `note`, `lore`) | `universe/words.js` | 4b, 6b |
| `ACT`, `PAYS`, `LEADS`, `actionOf`, `createThingRules`, `leadEvent` | `universe/things/rules.js` | 4b |
| `createThingDrawers(group, { budget, tier, prepare, rocks, textures })` and each look (`looks/*.js`), with the drawer contract (materials made at create on hidden meshes, `prepare` only from `update`) | `universe/things/` | 4b (event visuals that reuse a kind's look) |
| `FLEET_MODELS`, `modelOf(kind)` and the original `trader` | `universe/things/looks/fleets.js` | 4b (traffic and convoys out past the authored sides) |
| `createThings(…)`: `debug.force(kind)`, `debug.parkOf(kind)`, `debug.kinds()`, `debug.shown(kind, id)`, `cameFrom()`, `setCameFrom(x)`, the optional `follow(row, lead)` dep, `act(id)`, `targets`, `hit` | `universe/things/index.js`, `scene.js`'s handle and `__universeDebug.things` | 4b (`setCameFrom`, `follow`), 6b, the endless check |
| `{ type: 'thing', what: 'can' \| 'cannot' \| 'acted' \| 'through', id, … }` | the scene's `emit` | 6b, 4b |
| `createRockFields` (`add`, `remove`, `sweep`, `smash`) | `universe/rockFields.js` | 4b (a meteor shower's or comet's rocks the ship can hit) |
| `buildHole(parent, { r, disk, uTime, … })` (with `fade` and `setFade`; `uTime` required) | `universe/gargantuans/hole.js` | 4b (tidal pull's hole), the Maw |
| the scene's `drain(n, floor)`: shields lowered without a hit | `scene.js`, beside `hurt` | 4b (the ion storm front) |
| `samePixels` / `scripts/same-pixels.mjs <a> <b> [--mask]`, and `universe-check --t <seconds>` | `scripts/` | every later lane that says "not a pixel changes" |
| `createNebulae(…).shown()` | lane 1's `universe/nebula/index.js` | the dev hooks, 6b |
| the cap counts what the disc layer draws: a disc-0 row listed outside it by its card's `far` (a gargantuan's 400,000); a companion takes its disc's place | lane 3's `places/around.js` | 4c, 6b |
| landmarks' `extra` (nearest first, clamped to `EXTRA_ROOM`, every slot from `MAIN_DRAWN` rewritten each update), `EXTRA_SLOTS`, `MAIN_DRAWN`, `EXTRA_ROOM`, kinds 4–7 | `universe/landmarks.js` | 4c |
| `thingKinds`, `gargantuan` stepping | lane 2's `universe/budget.js` | 4b, 4c |
| the `things`, `gargantuan`, `ore`, `hazards` and `wormhole` steps, and the poses `at-gargantuan`, `in-field` | `scripts/universe-endless-check.mjs`, `poses.js` | every later lane |

## Assumptions about unmerged work

Each of these can be checked once lanes 1, 2 and 3 have merged. Where one is false, follow the code and keep the behaviour this plan asks for.

1. **Lane 2's `nearThings.js`** exports `pickNear(sectors, cam, { max })` and `createNearThings(group, { drawers, prepare }) → { update(rows, camera, t), solids(), dispose() }`. `drawers[kind](group, ctx)` returns `{ update(rows, camera, t), dispose() }`, and rows are `{ id, kind, at, size, look }` (its Task 21). Task 4 adds `t`, `row` and the catalogue's rules to it. However lane 2's code finds an extra row's look, Task 4 replaces it with `lookOf(kind)` before any list has a row.
2. **Lane 2's `discs.js`** feeds lattice things and list rows as discs by their kind's `look.color`, within the far plane, the nearest `budget.discs` (its Tasks 15 and 21). A disc is a point of farStars' one `Points` (its Task 14), so a disc more at a baseline pose costs no call and no triangle. That is what lets PR group 4a.1 change the core's specks within the budget.
3. **Lane 2's `budget.js`** has `thingKinds: {}` and `gargantuan` rows, and `universeBudget({ tier, detail }, step, floor)` steps `discs`, `thingsNear` and `traffic`, with lane 3's `tags` beside them.
4. **Lane 2's `levels.js`** exports `levelWeights`, `FAR = 45000` and `FADE`, and the far plane is still 45,000.
5. **Lane 2's `createExpanse`** takes `drawers` and lane 1's `make`, and `expanse.sectors()` is a `Map` of `fullSector`-shaped sectors, `extras` and lane 3's `stations` among them, through `sectorJob` and `withMoons`.
6. **Lane 2's `near.js`** builds a built system's star as an emissive `BALL` and gives `stars()` and `solids()` with the generator's ids. Task 15 adds companions there.
7. **Lane 2's `space.js`** keeps the order legacy → `appendSystems(sector, outs)` → lane 3's stations → `thingsOf`, `CUBE_HALF` is still a private 56,000 (`space.js:27` on `main`), and `wonderPlace` is still module-private and reads `SECTOR_EXTRAS` itself (`:165`). `keepOutsNear` and `KEEP_OUTS` are as on `main`: 27 rows, all within about 40,000 of home except the pocket's at z = −66,000.
8. **Lane 2's `scripts/universe-endless-check.mjs`** has `--only`, a per-step recorder, and `__universeDebug.teleport(x, y, z, heading, pitch)`, with lane 3's steps.
9. **Lane 1's renderer:** `createNebulae(…).add(desc) → handle`, `remove(handle)` and `update(camera)`, every desc with an `id` (a legacy nebula's is its wonder's, `nebulaOf`). Deep space owns the one renderer, reachable as `deep.nebulae`. Task 17 adds `k` and `shown()`.
10. **Lane 1's landmarks:** world-up quads (`quadAxes`), depth-tested, one instanced draw, the nebula rows last and outside `instanceCount` (8), `createLandmarks(parent, { skyFar })`. Its order puts `curvesun` among the drawn rows, which Task 19 moves to just before the nebula rows. `quadAxes` is pure (arrays in, arrays out), so it moves to `landmarkRules.js` with `landK` and `drawnAngle` (on `main`, `FADE`, `drawnAngle` and `landK` at `landmarks.js:43-51`, after `import * as THREE from 'three'` at `:33`).
11. **Lane 1's `scripts/lib/nebula-measure.mjs`** has parallax and roll measures that take a projected point and an axis. If its functions are tied to a nebula, Task 22 writes the two measures for a point beside them, in the same file.
12. **Lane 3:**
    - `THING_CARDS`, `placeCard`, `PLACE` in `words.js`, `resolvePlace`, and `atTime` reading the row's `move`
    - `frameOf` (planet or moon only), and `scenePlaces` with `here()`, `resolve(id)`, `park(id, from)` and `fetch`
    - `travel(E: id)` waiting for a fetch, `where().place`, and `PlaceCard({ dest, docked, onFly, onHangar, leaving })`
    - `expanse/shared/space.js` and its test, `STATION_BASE = 10000`, `poleHeight`, `extentOf`, `fullSector(…).stations`, and the station branch in `wonderPlace`
    - `placesAround(sectors, cam, t, { far, inside, max })` keeps the nearest `max` disc rows, honours a card's own `far`, and lists moons and stations outside the cap (its Task 8); `pickPlace(rows, project, px, py, { tanHalf, height })` (its Task 10)
    - `places/weight.test.js` and its `GENERATOR`, as its Task 7 writes it
13. **Lane 3's tests** don't turn on the kind of lattice slot 0 or 40 of `E:1,0` beyond "solid and stays put". Its `around.test.js` counts every lattice thing with `1.2 × size`, which holds because every lattice kind is solid.
14. **`scene.js`** still has `rocksHit` and the rock fields as on `main` (`:711-721`, `:3170-3243`), `riftThrough` (`:4208-4237`), the bolt and missile chains (`:2606`, `:2790`), the lock's `rocks` (`:4526`), `bend()` (`:3571-3592`, reading `L.at` as a `Vector3`, `L.r` and `DISK_N` as an array), `placePrompt`'s branches, and the E key's `state.at` branch (`:5502`). Lane 3's `trips.js` took the travel block, not these.
15. **`sides.js`'s sides** carry `factions: { [id]: { role } }` with `role: 'hunt'` for the hunters, as `RICKMORTY` and the Star Wars side do on `main`.
16. **The ten baseline poses** (`lab/universe/baseline/mid.json`) each have their `at` and `eye` inside a core keep-out. At `cc5e2eaf` the tightest is `gaming`, 51 inside, and `maw` is 486 inside. Task 8's pose test measures from the points themselves, so if a lane moves a pose outside every keep-out, that test says so.
17. **Lane 4b** (beside this lane, merging after it) takes this lane's `wormholeExit`, `things.setCameFrom` and the `follow` dep in place of its own `wormholeExit(from, rand)`, `cameFrom: { at, sector }` and `followOf(id)` (finding 16). Until it does, the two plans each give `where()` a `cameFrom`.
18. **Lane 2's `createNearThings`** may call a drawer's factory `drawers[kind](g, ctx)` while the scene is being made (inside `createExpanse`, `scene.js:772`) or lazily, the first time a kind is near. The drawer contract (Task 13) holds either way, since no factory calls `prepare`. Lane 2's own `prepare` thunk (`(o) => warm(o)`) is passed the same way and, by its plan, is first called for a mesh built after the first frame.
19. **Lane 2's far layer** (`createFarStars(…, { discs })`, its Task 14) holds at most its capacity of discs and drops the nearest past it, and `pickDiscs` keeps the nearest `budget.discs`. So a companion's disc goes through the pick, never on top of it (Task 6). If lane 2's capacity has room over `budget.discs`, the rule still holds.
20. **Lane 2's `createDiscs`** can be fed in Node with a fake far layer whose `discs.push` records each disc's place and radius (its Task 15's test feeds a hand-made sector). Tasks 4, 6 and 11 compare lane 3's capped list with it that way.
21. **The scene's clock** is still `t = reduced ? 0 : state.low ? state.tLow : (now − t0) / 1000` (`scene.js:5067`), and `__universeDebug.state` is the scene's `state` (`:5911`). `universe-check --t` holds the clock through it (Task 18). If lane 2's camera-relative work moves the clock, `--t` follows it, and a held clock is still what the comparison needs.
22. **Lane 1's landmarks** keep `main`'s split: `aKind`, `aCol0`, `aCol1`, `aCell` and `aAxis` written once at create (`landmarks.js:250-259`), and `update` writing `aCenter`, `aSize` and `aK` (`:311-340`). Lane 1's order is `maw`, `ember`, `halcyon`, `curvesun`, `sun`, the two `twins`, `lantern`, then `veil` and `cradle` (its Task 7). If lane 1 writes every attribute every update already, Task 19's rewrite costs nothing more and its tests still hold.
23. **Deep space's clock**: `deepspace.js` still makes one `uTime` (`:554`), spreads it into every shader (`:563`) and sets it each frame (`:1445`). Lane 1 changes deep space's nebulae, not these.
24. **The scene's textures:** `T` is still `loadTextures`' result at `scene.js:647`, declared above `createThings`' line, with the `plates` maps `kit.js`'s `hull` reads.

## Findings for the coordinator (spec against code)

1. **"At least one gargantuan in every 3 × 3 × 3, always somewhere in view" against "draw calls and triangles no higher" at the baseline poses.**
   - A gargantuan's impostor joins the landmark draw, so there is no new draw call. Its quad would add two triangles.
   - In the main sector the Curve's sun's quad never draws, so the gargantuan takes that slot (Task 19), and the count stays at lane 1's 8.
   - That pays for one. Lane 4c's arrival gargantuans each cost two more where they're in view from a baseline pose.
2. **Lane 2's tests pinned the tables lane 4a is told to fill.** `SECTOR_EXTRAS` `toEqual([])` and "has four valid kinds" are replaced by tests of what replaces them (Tasks 3 and 4), not loosened.
3. **New lattice kinds change what lattice slots hold.** A slot's place doesn't depend on its kind, but its kind and size do, through the weights. Nothing stored names a slot yet: no lane has shipped a lattice id to a visitor. Lane 3's tests are generic over slots (assumption 13).
4. **A gargantuan's sector changes.** The gargantuan is placed before appended systems, so the systems and things appended in its sector (one sector in 27) keep out of it, and differ from lane 2's. Nothing stored names them.
5. **Lane 2's list ids (`base + max ≤ 64`) are too few** for lists round systems (a field at one system in three is up to a hundred a sector). High ranges from `w20000` are additive, and `wonderPlace` looks in the lists first, or lane 3's station branch would read `w20001` as a station.
6. **`look.js` says every tint the map owns is one of `palette.js`'s nine names.** Lane 2's four lattice colours aren't. This lane's are, and it leaves lane 2's as they are.
7. **Rogue planets, "Land, if rocky".** Their ids are wonder ids, which lane 5a's `planetSpecOf` refuses (`e:1,0:w1` → null). The card says `land`, and lane 5b takes it (hand-off).
8. **A beacon "leads to an event", and a derelict is "sometimes a trap (an event)".** The events these name (a treasure signal, a derelict waking) are lane 4b's, unmade when this lane lands. They fall back to the director's `distress` and `hunt`, or a quiet line.
9. **"Watch" (herds and swarms) is a place to park, not a key.** There's no new camera and no new line. The card's about is what you see.
10. **A storm "drains shields while inside".** It stops at 10, so a storm alone never destroys the ship (my call).
11. **Fleets "with their faction".** The authored sides' fleets fly the site's own models (`trafficModels.js`'s), and the rest an original `trader` (finding 32). A hostile fleet fights only once hailed, from its capital, through `hunters.pack`.
12. **`glsl-sites` +1.** The Maw's look moved out of `deepspace.js` brings its own material helper. Every other look is a stock material, or the landmark material's new branches.
13. **`deepspace.js` is at 1,484 lines**, near the 1,500 ceiling. The Maw's builder leaving takes about 15 off.
14. **Binary and trinary systems** are drawn in the built system and named on its card. Far off, the far layer keeps one speck a system.
15. **`keepOutsNear` is too short a list for a big clearance.**
    - It returns the keep-outs whose sphere touches the sector's own cube. Every hand-made place is within about 40,000 of home, so for `E:1,0`, `E:-1,0`, `E:0,1` and the sectors above and below it is empty (`E:0,-1` gets the pocket's).
    - A list in a neighbouring sector darts into its ±56,000 cube, as near as x ≈ 64,000: about 39,000 from the `maw` pose, inside a pocket's 41,200–46,000 show distance.
    - Lane 2's lattice is safe with it, since its clearances are at most 2,340. This lane's lists and gargantuans test all 27 rows of `KEEP_OUTS` (Tasks 5, 8 and 10), and `things/clear.test.js` measures from the ten poses' own points.
16. **Lanes 4a and 4b each planned a wormhole exit, a `where().cameFrom` and a beacon rule.**
    - 4b: `wormholeExit(from, rand)` (8–40 sectors), `cameFrom: { at, sector }` and `followOf(id)`.
    - 4a: `wormholeExit` (30–80), `cameFrom: { id, name, at, key }` and `traitsOf(row).leads`.
    - Two rules and two shapes for one name. Since 4a lands first, it offers the one of each: `wormholeExit({ seed, sector }, universe)`, `things.setCameFrom(x)` and a `follow(row, lead)` dep on `createThings` (Tasks 9 and 24).
    - The coordinator should have lane 4b use them, dropping its own, and route 4a's beacons through `events.follow` (assumption 17).
17. **Lane 3's `placesAround` cap cut every gargantuan.** It keeps the nearest `budget.discs` (400 on low, 1,200 on mid) of about 1,700 lattice things within the far plane, so a gargantuan 60,000–170,000 off was on the sky but not pickable. A gargantuan draws no disc, so Task 4's rule lists it outside the cap by its card's `far`, as moons and stations are (finding 30), and Task 10 pins it.
18. **`buildBody` can't fade, and `.opacity` does nothing to a `ShaderMaterial`.**
    - The black hole's three materials are additive `ShaderMaterial`s, and a planet body's surface is one too (`galaxy/bodies.js:449`). Setting `opacity` or `transparent` on them changes nothing, so a mesh would pop in at full strength over a full impostor.
    - The hole's three shader strings gain a `uFade` uniform (1 for the Maw: not a pixel moves). The supergiant has a look of its own in stock materials rather than a planet body (Tasks 18 and 20).
19. **`landK` lives in a module that imports three, and `FAR` and `levelWeights` in another world's scene folder.**
    - Imported straight, either would break "pure first" or add boundary breaks.
    - `landK`, `drawnAngle` and `quadAxes` move to the pure `universe/landmarkRules.js`, which `landmarks.js` re-exports.
    - `FAR`, `FADE` and `levelWeights` are lent on `expanse/shared/space.js` (Tasks 11 and 19).
20. **Perihelion is fast.** With the comet ranges drawn uniformly, about 1 comet in 90 passes 0.3 units a second at perihelion (the worst sampled 0.40, the ranges' corner 0.51). A comet at 0.25 or more is dropped (`COMET.fast`, about 1 in 23), so every comet is slow enough to stop at.
21. **Companions inside the first planet's way barely fit.** `planetsOf` puts the first planet at exactly three star sizes. Companions of 0.25–0.45 on fixed orbits of 1.7–2.5 star sizes would have kept about 12% one and 0.24% two. They are now 0.12–0.3, laid out in the room there is, with draw shares 0.30 and 0.08: about 22% and 4.6% kept (Task 6). The spec names binaries and trinaries but no share: my call.
22. **PR group 4a.1 is not picture-neutral.**
    - The lattice's new weights change most slots' kind and size, and lane 2's far layer draws the core's lattice as discs at the baseline poses. The core's fields, comets and rigs, and its systems' companions (Task 6), join them.
    - It costs no call and no triangle (farStars' one `Points`). The before is taken before Task 1, and Task 11's gate compares.
    - Lane 2's two layers read the catalogue from Task 4, before any list has a row, so no row reaches them without a look.
23. **`SECTOR_EXTRAS` moves from `things.js` to `extras/index.js`.** The lists import `THING_NEAR`, `THING_BASE` and `EXTRA_HIGH` from `things.js`, so a re-export the other way would be a cycle. `things.js` keeps `thingsOf(ctx, extras = [])`, and lane 3's face lends `SECTOR_EXTRAS` from the new home, so its readers (4b among them) see no change.
24. **The arrival's gargantuans were placed but not kept clear of.** The core's appended systems, lattice and lists now keep off lane 4c's rows as off a generated gargantuan (Task 10). (The review's last finding was cut off at "Task 10 (ARRIV"; this is what I found when I checked the arrival list, and may not be what it said.)
25. **A scene part made before `warm` exists can't warm itself.** `warm` is a `const` at `scene.js:948`; `createExpanse` (`:772`) and `createLandmarks` (`:786`) run before it. A `prepare: (o) => warm(o)` thunk called at create throws a `ReferenceError` and the map never builds; `:952` says as much for the fleet. This plan's first draft called `prepare` at create. Now every material is made on a hidden mesh at create, the start-up `prepareScene` (`:6023`, hidden things too) compiles it, and `prepare` runs only from `update` (Global Constraints, "Warm-up"). Lanes 1 and 2 already work this way; a later lane that passes `prepare` into something made before `:948` should too.
26. **The landmark draw writes a slot's look once.** On `main`, `aKind`, `aCol0`, `aCol1`, `aCell` and `aAxis` are written at create only (`landmarks.js:250-259`). Anything that borrows a slot (this lane's gargantuans, and lane 4c's arrival through the same `extra`) has to write it back, or the borrowed look stays. Task 19 rewrites every slot from `MAIN_DRAWN` up each update.
27. **The Maw's three shaders read deep space's clock.** `PHOTON_FRAG` (`:440`), `DISK_FRAG` (`:480`) and `JET_FRAG` (`:542`) take `uTime` from deep space's shared uniform (`deepspace.js:554`, `:563`). Moved out with a uniform of their own, the disc and jets would freeze, and a still shot can't see it. `buildHole` now requires the `uTime` object, and Task 18 compares shots at two held clocks.
28. **A held pose isn't a still picture.** The scene's clock runs at a held pose (`scene.js:5067`), so two shots of the Maw or the belt differ by time alone, and `scripts/pixel-measure.mjs` prints statistics rather than comparing two pictures. "Not a pixel changes" (Tasks 18 and 21; lane 3's "identical shots at the hand-made poses") needs a held clock and a byte comparison: `universe-check --t` and `scripts/same-pixels.mjs` (Task 18). Lane 3's own "Pixels" check may want the same.
29. **A binary's companion would pop in.** Only a ball in a built system at first, it appeared whole at the reach, tens of pixels across, in about 27% of systems, and lane 2's `pops()` measures only far-layer discs. It is now a disc in the far layer, fading as its primary does, with the ball behind it (Tasks 6 and 15), and the endless `things` step measures the handover at a held pose (Task 22).
30. **What lane 3 lists and what lane 2 draws diverged with this lane's kinds.** Lane 3 counted every extra within the far plane toward `budget.discs`; this lane's disc-0 kinds (fields, clouds, storms, herds, swarms, debris, gargantuans) would have pushed drawn discs out of the list. The cap now counts what the disc layer draws, disc-0 rows are listed outside it by their card's `far`, and companions take their discs' places (Tasks 4, 6, 11). Task 10's own change to `around.js` (rows whose `far` passes the far plane) is now part of that rule.
31. **The storm's drain isn't a hit.** `hurt()` emits `laser` and shakes on every call (`scene.js:3154-3168`), and Comms answers each with a hit sound and a crew line (`Comms.jsx:249-251`). The scene gains `drain(n, floor)` beside it (Task 24), which lane 4b's ion storm front can use too.
32. **The review's `hauler` finding was half right.** `hauler` isn't unbuilt: it is Rick and Morty's junky space truck (`fleetRickmorty.js:298`, in `BUILT_KINDS`), so `buildTraffic('hauler')` doesn't fall back to a TIE. But this plan called it "this lane's original freighter", which it isn't, and it would have put a cartoon delivery van at anchor in most independent systems. The independent fleets now fly an original `trader`, built in `looks/fleets.js` through `buildModel`, and `modelOf` throws on a kind it can't build rather than turn it into a TIE (Task 16).
33. **The review's trait-share arithmetic.** The lattice's weights total 11.0, not 11.35, but the point stands: 2,000 rows hold about 73 rogues, and the gas share's band was about ±1 standard deviation. The test now takes every lattice row of three sectors (about 870 rogues) and asserts the counts that make each band at least 2.5 standard deviations wide (Task 3).

## Spec coverage

- **Done item 3, "More than planets":**
  - at least 20 kinds: the 23 catalogue entries, drawn as 32 kinds (Tasks 1, 3 and 5–10, pinned in Task 11)
  - each forced by a dev hook (Task 22's `debug.force`, every kind and every gargantuan form), and the endless check's sweep sees each by its own `shown` test and shoots it (Task 22)
  - the events and the ten-minute count are lane 4b's
- **Done item 2, "It seems populated":** lane 2's density targets stay green with every list in, checked again over this lane's sectors (Task 11). Herds, swarms, storms, comets, beams and the rigs' haulers add something moving. The 20-second count is lane 4b's, over traffic and events.
- **Done item 4:**
  - Every kind has a name, a card and a parking spot through lane 3 (Tasks 3, 5–10).
  - Movers park and stay parked (Task 5's carry).
  - Solid bodies are solid: lane 2's near layer takes the catalogue's solids (Task 4), and gargantuans' parts are solid (Task 20).
  - "Every place you see, you can pick": lane 3's capped list keeps exactly the discs lane 2 draws, with every list and companion in (Tasks 4, 6 and 11), and a gargantuan on the sky is listed outside the cap and picked (Task 10).
  - "The map lists it" is lane 6b's, from the cards' `chart` and the finder.
- **Done item 1, "no wall of things popping in":** for this lane's kinds, a thing comes in as a far-layer disc that fades as its mesh takes over (Task 4); a companion sun does the same (Tasks 6 and 15, measured at a held pose in Task 22); a gargantuan crossfades from its impostor with `k + fade` at 1 (Tasks 19, 20, 22); a pocket fades in by `k` (Task 17).
- **Done item 5, last bullet:** gargantuans are world-anchored at their true angle, roll with the stars (lane 1's world-up quad), and hand over to a mesh (Tasks 19, 20, and Task 22's parallax and roll check). Generated nebula pockets are lane 1's renderer (Task 17).
- **Done item 8:** the arrival's gargantuan is lane 4c's, through `ARRIVAL_GARGANTUANS` (Task 10).
- **Done item 9:**
  - the rock fields' move is pinned (Task 21), and the Maw's is byte-identical at two held clocks, its disc still swirling (Task 18)
  - the Curve's sun keeps its look in its own sector after a gargantuan has borrowed its slot (Task 19)
  - a storm's drain makes no hit sound, crew line or shake (Task 24)
  - the two replaced tests are listed (Tasks 3, 4)
  - the dev hooks `rockFields` and `smashed` are kept
- **Done item 10:** `thingKinds` and `gargantuan` by tier and quality step (Task 12); the drawers capped by them (Tasks 13–16 and 20); the full measure at every tier (Task 25); and the frame time on `low` and `mid` at `at-gargantuan`, `in-field` and `expanse-system`, where this lane builds, held to 1.15 × lane 3's `expanse-system` (Task 25, Review Focus 7). Nothing of this lane stalls the start: its programs are compiled by the start-up warm-up, and nothing warms before the scene is made (Tasks 13, 20, 22).
- **Section B:**
  - the catalogue; "original in design"; "drawn instanced or as impostors"; each action through `pay` (`found`), `hunters.pack`, the director and lane 3's dock (Tasks 13–16, 23, 24)
  - the density targets
  - "things cluster round systems, but never so tightly that the space between is empty": fields, comets, rigs, fleets and shipyards round systems; the lattice and eleven lists between them
  - "Places with life" is lane 4b's; stations are lane 3's
- **Section C, gargantuans:** at most one a sector, at least one in every 3 × 3 × 3, none within 20,000 of home, 20–200 planets across, visible across a sector, five forms of the spec's six, the Maw as it was (Tasks 10, 18–20). A leviathan migration is lane 4b's event.
- **Section H:** the tier table's rows (Task 12); the poses "at a gargantuan" and "in an asteroid field" (Task 25). The baseline poses keep their calls and triangles (Tasks 22, 25).
- **Section A's "lighter" core:** only fields, comets, rigs and the lattice's kinds in the core sector, and no generated gargantuan (Tasks 1, 10, 11).

## Self-review

- **Types:**
  - `KINDS[kind].body`, `near` and `disc` are defined in Task 1 and read by `solidOf` (Task 1), lane 2's near and far layers (Task 4), the drawers (Tasks 13–16) and `debug.shown` (Task 22).
  - `rowAt` (Task 2) is read by the near and far layers (Task 4), the lists' tests (Tasks 5, 8), the cards' `move` (Tasks 5, 8), the finder (Task 11), the drawers (13–16) and the rules (23).
  - `traitsOf` (Task 3, memoised by seed) is read by the cards (3), the looks (14–16) and the rules (23). `companionsOf` and `companionAt` (Task 6, by seed) by the card and the far layer's discs and lane 3's cap (6), the finder (11) and `near.js` (15), whose ball is the disc's size and colour.
  - `make(ctx, made)` and the ctx (Task 4) are used by every list (Tasks 5–10). `ctx.gargantuan`, `ctx.arrivals` and `ctx.keeps` come from Task 10. Every list's keep-out test is all of `KEEP_OUTS`, through `roomFor` (Task 5); `ctx.outs` is the lattice's alone.
  - `CUBE_HALF` lives in `gen/cube.js` from Task 4 and is read by `dartIn` (5) and `gargantuanOf` (10). `NEBULA_SHOW` lives in `extras/place.js` (5) and is re-exported by `extras/index.js` and the face (8).
  - `wormholeExit({ seed, sector }, universe)` (Task 9) is called by the rules (23) with a wormhole row, which carries `sector`.
  - `buildHole`'s `fade` and `setFade` (Task 18) are what the hole's look's `setFade` (Task 20) calls; `handover`'s `fade` reads them back. Its required `uTime` is deep space's for the Maw (18) and `createGargantuans`' own, set in `update` (20).
  - `lookOf(kind).disc` (Task 1) decides both what lane 2's `discs.js` pushes and what counts in lane 3's cap (Task 4); companions enter both in Task 6. Tasks 4, 6 and 11 test the two against each other.
  - `createThingDrawers(group, { …, textures })` (Task 13) and `createGargantuans(group, { …, textures })` (Task 20) take the scene's `T` (Task 22) for `hull()`. Neither, nor any factory, calls `prepare` at create; each calls it from `update` (Tasks 13–16, 20), and Task 22's smoke run proves the scene builds.
  - `EXTRA_ROOM` (Task 19) clamps `gargantuans.impostors`, which Task 20 orders nearest first.
  - `drain(n, floor)` (Task 24, the scene's) is what `createThings`' `drain` dep calls with `rules.effects`' `drain` and `STORM.floor` (Task 23).
  - `universe-check --t` and `same-pixels.mjs` (Task 18) are what Tasks 18 and 21 decide by.
  - `landK` comes from `landmarkRules.js` (Task 19) in `gargantuans/rules.js`, and `FAR` from the face (Task 11).
  - `nearestOfKind(sectors, kind, at: [x, y, z], t)` (Task 11) takes any iterable; `debug.find` (22) passes `sectors().values()` and `[ship.x, ship.y, ship.z]`.
  - `EXTRA_LISTS` is pinned in Task 11 in the order Tasks 5–10 add them.
  - `nearOf` and `impostorOf` (Task 19) are read by `createGargantuans` (Task 20) and the pose (Task 25).
  - The drawer contract (Task 13) is kept by Tasks 14–16. `fields()` (Task 13) and `smash` (Task 21) are read by `hit` (Task 24).
  - `createThings`' `debug` (Task 22) is read by the endless steps (22, 24) and the poses (25).
  - The `'thing'` events' `what` values (`can`, `cannot`, `acted`, `through`) are the same in Task 24 and the page.
- **Review Focus lines and their tests:**
  - movers: Tasks 2, 4 and 5
  - the handover and inside: Tasks 18, 19 and 20
  - the baseline poses: Tasks 8, 10, 11, 19 (and the slots given back), 22 and 25
  - pockets: Tasks 3, 5, 6, 9 and 10
  - actions not by accident: Tasks 23 and 24
  - ids: Tasks 4 and 11
  - phones: Tasks 12, 13–16, 20 and 25
  - what's listed is what's drawn: Tasks 4, 6, 10 and 11
  - the scene builds: Tasks 13–16, 20 and 22
- **Test times.** The heavy setups are `beforeAll`s, as lane 2's density test's is: Task 3's three sectors, Task 8's 26 sectors without the lattice, Task 11's two blocks of 27, and the 27 sectors of Tasks 4 and 6's `around.test.js` `it`s (the lattice in, as lane 3's own test makes them). Every `it` stays under a second.

# Invincible world, part 3: the Viltrumite truth, the Guardians and the worlds beyond — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/invincible`’s season plays through end to end; fights have grabs, throws, dives, blocks and a city that breaks and remembers; episode 8 tells the Viltrumite truth; Eve, Omni-Man and Thragg are playable; the Guardians of the Globe live in their hall and join fights; season two takes Mark to Angstrom’s dimensions, Mars, Thraxa and Talescria; the city has a clock, weather, an opinion of Mark and leaderboards.

**Architecture:** New pure, tested modules in `src/components/invincible/world/` (`brawl.js`, `demolish.js`, `heroes.js`, `guardians.js`, `dimensions.js`, `season2.js`, `clock.js`, `weather.js`, `standing.js`, `boards.js`, `offworld/{mars,thraxa,talescria}.js`), drawing beside them (`ruins.js`, `storm.js`, `panels.jsx`, `offworld/*Scene.js`, `hall.js`), the existing `missions.js`, `foes.js`, `companions.js`, `flight.js`, `brains.js`, `scene.js` extended, `InvWorld.jsx` split first. Every new figure is a kit stand-in with a `gen3d` issue; every new line is text in the bubble with a `voices` issue.

**Tech Stack:** React 19, three r186, Vitest, the HQ engine (`avengers/hq/engine.js`), `lib/three/rig.js`, `lib/three/facade.js`, `lib/three/fx/debris.js`, `lib/three/explosions.js`, `lib/ai/steer.js`, `lib/durable/supabase.js`, `lib/seeded.js`, Playwright on the bundled Chromium (`scripts/inv-world-check.mjs`).

**Spec:** `docs/superpowers/specs/2026-10-18-invincible-world-3-design.md`

## Global Constraints

- Metres, y up, ground 0 in town; `+z` south; fixed steps of 1/120 s in `flight.js`; `dt` clamped to 0.05 s in `InvWorld`; every rules step tolerates `dt = 60`.
- Rules in pure modules, tests first; a rules module imports neither `three` nor `react` nor any drawing file.
- No file over 800 lines; a split follows the repair recipe (shots before and after, no pixel changed, export names kept).
- Nothing fetched at run time; models under `public/models/invincible/`, credited in `public/models/invincible/credits.json`; never print or commit a key. A new figure ships as a kit stand-in and a `gen3d` issue (title the name; body what, the part-2 style line, a reference picture); a new line ships as text and a `voices` issue.
- Low tier within 1.5 M triangles in town with ruins drawn; figures posed only within 260 m; new instanced draws capped (rubble 400, scaffold 400, swarm 2,400, words 32).
- The HUD is the kit in `src/runtime/hud/`; the accent is `#f5c518`; British spelling, curly quotes, plain sentences; comments say why; dialogue is the site’s own words, never a transcript of the show.
- No gore; nobody dies.
- Before every merge: `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`, the touched shots with `--metrics` and no console errors, `--play` for every episode touched.
- Commit messages: one plain sentence; the body says why with numbers; no model identifiers. One pull request a task; merge origin/main in before the last push.
- `docs/architecture.md`’s “Invincible’s city” paragraph, `docs/superpowers/HANDOFF-invincible-world.md` and the backlog are updated in the task that changes what they say, and only their Invincible parts.

## Review Focus

1. Every mission reachable from Cecil’s board reaches `done` under `--play` (Task 1 and every mission task after it); the rules tests never substitute for it.
2. Ruins: a corrupt `tp-inv-world-ruins` (unknown id, damage out of range, not an array) loads as no ruins; repair never exceeds 1 or goes below 0; the attribute upload touches only changed instances (Task 3).
3. A hero switch mid-flight keeps position and speed and clamps to the new top speed; a mission start switches to Mark and back after (Task 5).
4. Offworld scenes load within 30 km and dispose on leaving: the renderer’s geometry and texture counts (`renderer.info.memory`) return to the orbit’s baseline (Tasks 9 to 11).
5. No Supabase client: `boards.js` returns `null` boards, the card shows the time only, nothing throws, no request is made (Task 13).

---

### Task 1: The season plays through, and `--play`

**Files:**
- Modify: `src/components/invincible/world/quests.js`, `missions.js`, `foes.js`, `challenges.js`, `InvWorld.jsx` (the rescue’s source, the Mauler’s target)
- Modify: `scripts/inv-world-check.mjs` (`--play <ep>`)
- Test: `quests.test.js`, `missions.test.js`, `foes.test.js`

**Interfaces:**
- `quests.js`: `ring` fires for ring 0 as well as 1 to 9; `lesson-start` stays.
- `missions.js`: `progress.kos` (a `Set` of foe ids beaten since the mission began); a `defeat` step reads it; episode 3’s catch-and-beat step has `{ caught, kos }` counters in either order; episode 6’s defeat wants `kos.size >= 6`.
- `foes.js`: a Mauler has `target: 'hangar' | 'mark'` from `pickTarget(mauler, mark, hangar)`; `spawnUpTo(kind, total)`.
- `challenges.js`: a rescue event is `{ caught, source }`.
- `scripts/inv-world-check.mjs --play ep1 … ep7`: starts the mission through `api.mission`, drives Mark with `sim` (fly to, land, punch, wait), fails unless `api.story()` shows the episode done within its own time limit plus 30 s.

- [x] Tests first: `feedMission` on ep1 with `ring` 0 to 9 reaches done; ep3 with `kos` before `caught` reaches done; ep6 with a Mauler beaten during the hold still reaches done; a city rescue (`source: 'city'`) does not count for ep3; `pickTarget` returns `hangar` when Mark is 61 m away or 31 m up, `mark` otherwise.
- [x] The fixes, until the tests are green.
- [x] `--play`: a driver per episode in `scripts/inv-world-check.mjs` (or `scripts/inv-world-play.mjs` if the file would pass 800 lines) that only moves Mark and presses keys through `sim` and the page’s key events; never `api.feed`. Run all seven; each reaches `done`.
- [x] Wire `invade('cecil')` as a radio side call (“A portal, downtown. Now.”, the recorded line); delete the unread `ghost` flag and the unread line sets or read them.
- [x] Hand-off: a “Season plays through, 2026-10-18” section with the seven `--play` times.
- [x] `npm run lint && npm test && npm run build && node scripts/health.mjs --check --skip build`; commit; pull request; merge.

### Task 2: The splits, by the repair recipe

**Files:**
- Create: `src/components/invincible/world/input.js`, `events.js`, `online.js`, `spaceScene.js`, `villainScene.js`; `src/components/invincible/thinkmark/bosses.js`
- Modify: `InvWorld.jsx`, `world/scene.js`, `thinkmark/rules.js` (each under 800 lines after)
- Test: `thinkmark/rules.test.js` keeps passing through the barrel; `imports.test.js` (`src/imports.test.js`) still green

- [x] `node scripts/autopilot-check.mjs --before --routes /invincible` and the shots `spawn street downtown streetnight high porch maulers seismic` with `--metrics`: the “before”.
- [x] Move the keys, pad and touch handling to `input.js` (`bindInput(el, handlers) → unbind`), the mission `out` handling and achievements to `events.js` (`handleOut(out, ctx)`), the travellers to `online.js`; `InvWorld.jsx` keeps the component, the clock and the HUD.
- [x] Move the space drawing (Earth, Moon, Mars, stars, Allen, Thragg) to `spaceScene.js` and the villains’ drawing calls to `villainScene.js`; `scene.js` composes.
- [x] Move Omni-Man’s and Thragg’s chapters from `thinkmark/rules.js` to `bosses.js`; `rules.js` re-exports the same names.
- [x] The same shots after; compare; a changed pixel means the split is wrong.
- [ ] Bring the four over-budget low-tier shots (`maulers seismic everace photo`) under 1.5 M triangles: figures posed only within 260 m, the crowd at the low count. Record the numbers.
- [x] Checks; commit; pull request; merge.

### Task 3: The brawl

**Files:**
- Create: `src/components/invincible/world/brawl.js`, `brawl.test.js`
- Modify: `foes.js` (`held`, `thrown`), `flight.js` (`carrying` speed factor, `dive`), `brains.js` (flee a carried car), `input.js` (hold to grab, release to throw, Shift block, C pound), `scene.js` and `fx.js` (the events drawn), `hits.js` (the new kinds’ forces)
- Test: `foes.test.js`, `flight.test.js`, `brains.test.js`, `hits.test.js`

**Interfaces:**
- `brawl.js`: `BRAWL` (the table in the spec’s section 2), `newBrawl()`, `stepBrawl(b, input, mark, world, dt) → { b, out: [{ kind, target, force, at }] }` with kinds `punch grab throw slam dive block counter pound`; `canGrab(mark, thing)`, `diveDamage(height)`, `counterOpen(b)`.
- `foes.js`: a foe `held` by Mark follows his hand; a `thrown` foe flies its arc, lands for a hit, staggers 0.8 s. A Mauler can be grabbed; Doc Seismic cannot (he is airborne).

- [x] Tests first: a 0.25 s hold within reach grabs the nearest grabbable; release throws at Mark’s speed plus 30; a carry-slam into ground over 40 m/s gives the held thing two hits and a crater event; `diveDamage(30) === 1`, `diveDamage(200) === 3`, between is linear and floored; a block halves damage and a blocked swing staggers the foe and opens a 0.6 s counter window; a pound floors Flaxans within 40 m and staggers Maulers; every step with `dt = 60` moves nothing more than 0.05 s would.
- [x] `brawl.js`, then the hooks into `foes.js`, `flight.js`, `brains.js` and the input.
- [x] Drawing: the carried thing on Mark’s hand (the rig’s hand bone, `lib/three/rig.js`), the throw arc, the dive’s streak and crater, the block pose (the `hit` clip held at its first frame), the pound’s ring (the quake ring’s shader, Mark’s colour). The 70 ms hit-stop and trauma by force as today.
- [x] A shot `brawl` (a Mauler carried over downtown) with `--metrics`.
- [x] Guide: the keys in `src/components/guide/pages.js` (the one place keys are written).
- [x] Checks; commit; pull request; merge.

### Task 4: The city that breaks

**Files:**
- Create: `src/components/invincible/world/demolish.js`, `demolish.test.js`, `ruins.js`
- Modify: `facade.js` (the damage attribute in the shader), `city.js` (the attribute and `setDamage(id, d)` touching one instance), `foes.js` and `brawl.js` (hits on towers), `InvWorld.jsx` (save and load `tp-inv-world-ruins`), `fx.js` (chunks through `lib/three/fx/debris.js`)
- Test: `demolish.test.js`, `facade.test.js` if the shader has one

**Interfaces:**
- `demolish.js`: `DAMAGE` (car 0.15, slam 0.3, mach 0.5, swing 0.1, line 0.05), `newRuins()`, `hitTower(ruins, id, force) → { ruins, delta, stage }` (stage 0 to 3), `repair(ruins, daysSince) → ruins`, `serialise(ruins)` capped at 400 by damage, `parse(text)` tolerant, `stageOf(d)`.
- `city.js`: `setDamage(id, d)` writes one float into the instance attribute and lowers the instance’s top by `stage`’s fraction, marking `needsUpdate` over the one range.
- `ruins.js`: `createRuins(parent, world, level)` with `rubble(id)`, `scaffold(id, on)`, `update(dt)`, `dispose()`: two instanced draws, capped at 400 each; a smoke sprite a stub at high tier only.

- [x] Tests first: `hitTower` adds by force and clamps at 1; stages at 0.3 and 0.6; `repair` heals 0.25 a day and never below 0; `serialise` keeps the 400 most damaged; `parse` of garbage, an unknown id or a damage of 7 gives no ruins; the stand-in `fxPlan` count by tier.
- [x] The shader: cracks and dark glass from 0 (a crack mask by hash of the instance id, in `facade.js`’s palette pass), the top lowered from 0.3, the stub from 0.6.
- [x] Hits land on towers from `brawl.js` (slam, throw), `foes.js` (a thrown car, a Mauler’s swing within 3 m of a face, a foe knocked into one), `flight.js` (Mark over 150 m/s into a wall: the existing `impact` carries its speed).
- [x] Chunks and dust through `fx.js`; rubble and scaffolding through `ruins.js`; the save and the daily repair; the collateral count into a stub `standing` until Task 12.
- [x] A shot `ruins` (three towers at stage 3 downtown at dusk) with `--metrics`; low tier triangles recorded.
- [x] Checks; commit; pull request; merge.

### Task 5: Who you fly as

**Files:**
- Create: `src/components/invincible/world/heroes.js`, `heroes.test.js`, `powers.js` (pure: transmute, line-break, the shout), `powers.test.js`
- Modify: `flight.js` and `brawl.js` (multipliers as an argument), `scene.js` (the player’s figure from `cast.js` by hero), `InvHud.jsx` (the chip, “Fly as” in the Menu), `online.js` (the `h` byte), `lines.js` (the flying lines), `InvWorld.jsx` (`tp-inv-world-hero`)
- Test: `flight.test.js`, `brawl.test.js`, `online` protocol test if one exists for the travellers

**Interfaces:**
- `heroes.js`: `HEROES` (the spec’s table), `hero(id)`, `canPlay(id, { story, quests, thinkmark })`, `DEFAULT = 'mark'`.
- `powers.js`: `stepPower(p, hero, input, mark, world, dt) → { p, out }` with outs `construct` (a wall’s pose, 6 s), `mend` (a tower id and 0.3), `linebreak` (a segment; the windows and the crowd under it), `shout` (a ring to 40 m).
- `flight.js`: `stepFlight(state, input, dt, world, mult = ONE)`; `brawl.js` likewise.

- [x] Tests first: `canPlay('eve')` only with Eve’s race best set; `canPlay('omniman')` only with `truth`; `canPlay('thragg')` only with `regent`; an unknown id is Mark; top speed multiplies and a switch mid-flight clamps speed; `linebreak` floors the crowd within 60 m of its line and adds 0.05 to each tower it crosses; `mend` lowers a tower’s damage by 0.3 and not below 0; `shout` throws every foe and car within 40 m.
- [x] The modules, the hooks, the figure swap (the cast rows exist: `eve`, `omni-man`, `thragg`), the pink construct (a `MeshBasicMaterial` slab with Eve’s pink and a soft edge), the line-break’s glass sparkle (the existing impact debris in white), the shout’s ring.
- [x] A mission start switches to Mark with a toast (“This one is Mark’s.”) and back after.
- [x] Shots `eve omniman thragg` on the spawn street with `--metrics`.
- [x] Checks; commit; pull request; merge.

### Task 6: Episode 8, Where I Really Come From

**Files:**
- Modify: `missions.js` (ep8 and its step kinds `launched`, `beats`, `catchmany`, `sky`), `flight.js` (`launched`), `foes.js` (Omni-Man as a foe), `companions.js` (Dad `gone`), `challenges.js` (twelve rescues from an arc), `lines.js` (Mom’s four after), `scene.js`, `villainScene.js`, `fx.js` (the contrail to a star), `Achievements.jsx` (`truth`)
- Create: `src/components/invincible/world/panels.jsx`, `panels.css`, `panels.js` (pure: the strip’s rules), `panels.test.js`
- Test: `missions.test.js`, `flight.test.js`, `foes.test.js`, `companions.test.js`, `challenges.test.js`

**Interfaces:**
- `panels.js`: `strip(mission, beat) → [{ figure, pose, line, voice }]`, `advance(s, input, dt)`.
- `flight.js`: `launch(state, dir, speed)` sets `launched` for 1.2 s; input ignored meanwhile; a wall hit passes damage through.
- `foes.js`: `OMNIMAN` numbers (600 hp, Mach 2, charge, grab, catches a thrown car); `pickBeat(progress)`.

- [ ] Tests first: ep8 starts only after ep1 to ep7 and at dusk or night from the porch; the launch ignores input for 1.2 s and reports three houses hit; three hits on Dad each produce a `driven` out with a tower id; `catchmany` with twelve rescues or a `carried` chunk reaches the sky beat; the sky beat ends on no input after the lines; after done, Dad is `gone`, `truth` is set, Mom’s line set is the new one.
- [ ] The mission, the panels (from the viewer’s turntable renders, drawn once to a canvas each at load), the launch, the chase, the plaza catch, the sky and the contrail.
- [ ] `--play ep8`; shots `ep8porch ep8sky` with `--metrics`.
- [ ] The voices issue for the beats’ lines; Mark’s “I’d still have you, Dad” is already recorded.
- [ ] Hand-off and architecture paragraph updated.
- [ ] Checks; commit; pull request; merge.

### Task 7: The Guardians of the Globe and their hall

**Files:**
- Create: `src/components/invincible/world/guardians.js`, `guardians.test.js`, `hall.js` (the inside drawn), `hallRules.js` (pure: the room, the plinths, the door, the board)
- Modify: `companions.js` (two Guardians join a fight), `foes.js` (the cavalry’s hits), `people.js` (eight stand-ins by tint, names over them), `landmarks.js` (the door), `InvWorld.jsx` (go in and out through the kit’s Exit), `lines.js` (thirty-two lines)
- Test: `hallRules.test.js`, `companions.test.js`

- [ ] Tests first: `pick(fight)` chooses Bulletproof for falling people, Black Samson for a crowd within 40 m, Rex for Maulers, Robot for an unknown foe, never the same two for one fight; each signature’s rule (Kate’s copies hold a foe 2 s; Monster Girl’s 12 s; Rae’s stagger); the room is a disc of radius 28 m with eight plinths and the door at (0, 21); going in sets the zone `hall` and out restores the street.
- [ ] The modules, the stand-ins, the inside (code-built as `landmarks.js` is: the dome from within, the plinths, Cecil’s board moved here), the cavalry.
- [ ] `gen3d` issues for the eight; a `voices` issue for the thirty-two lines.
- [ ] Shot `hall` with `--metrics`; `guardians` achievement.
- [ ] Checks; commit; pull request; merge.

### Task 8: Angstrom Levy and the dimensions

**Files:**
- Create: `src/components/invincible/world/dimensions.js`, `dimensions.test.js`, `season2.js` (season two’s missions as data, the engine stays in `missions.js`), `season2.test.js`
- Modify: `scene.js` (redraw the city on a dimension change: palettes, water, sky, crowd), `foes.js` (Angstrom, the mirror Mark), `ground.js` (the water level as a uniform), `map.js` (a reflected `near` for the mirror), `InvWorld.jsx`

- [ ] Tests first: four dimensions with their numbers; `enter(dim)` keeps Mark’s position and clears foes; the mirror maps `x` to `−x` in `near`; only `home` serialises ruins and standing; Angstrom portals away on a hit and returns 8 m behind Mark; the mission’s three portals and the thing in each.
- [ ] The modules and the drawing (a dimension swap re-uploads palettes and the water uniform; no new geometry).
- [ ] `--play levy`; shot `levy` (the burnt city at night) with `--metrics`; `gen3d` issue for Angstrom; `voices` issue for his six lines.
- [ ] Checks; commit; pull request; merge.

### Task 9: The Sequids on Mars

**Files:**
- Create: `src/components/invincible/world/offworld/mars.js`, `mars.test.js`, `marsScene.js`, `swarm.js` (pure flocking on `lib/ai/steer.js`), `swarm.test.js`
- Modify: `orbit.js` (the landing on Mars by the Moon’s pattern), `spaceScene.js` (load and dispose within 30 km), `season2.js`, `foes.js` (the host)

- [ ] Tests first: the swarm flocks to the nearest host and scatters 3 s on a punch; four astronauts, each carried to the ship; the host at 12 hits; the gate run at 600 m/s; loading at 30 km and disposing beyond it.
- [ ] The modules, the base and the swarm (one instanced draw, 800 to 2,400 by tier), the astronauts on the kit.
- [ ] `--play sequids`; shot `mars`; `gen3d` issues for a Sequid and the base.
- [ ] Checks; commit; pull request; merge.

### Task 10: Battle Beast

**Files:**
- Modify: `foes.js` (Battle Beast: 14 hits, blocks unless staggered, the leap), `season2.js`, `villainScene.js`, `lines.js`

- [ ] Tests first: a punch on an unstaggered Beast is blocked; a counter staggers him; the leap craters the pad and floors Mark within 15 m; beaten, he leaves.
- [ ] The foe, the stand-in, the lesson in the panels (block, then counter).
- [ ] `--play beast`; shot `beast`; `gen3d` and `voices` issues.
- [ ] Checks; commit; pull request; merge.

### Task 11: Thraxa and Talescria

**Files:**
- Create: `offworld/thraxa.js`, `thraxa.test.js`, `thraxaScene.js`, `offworld/talescria.js`, `talescria.test.js`, `talescriaScene.js`
- Modify: `orbit.js` (Thraxa past Mars, the gate by the Moon), `spaceScene.js`, `season2.js`, `foes.js` (Anissa, Lucan, Vidor at Omni-Man’s numbers times 0.7), `companions.js` (Dad for one fight), `people.js` (Oliver, the Thraxans, Thaedus, the council), `lines.js`

- [ ] Tests first: Thraxa’s landing; Dad hides until found within 40 m; three Viltrumites with the numbers; Dad fights as a companion for the one fight and is `taken` after; Oliver is on the porch at home after; the gate opens only with Allen; Allen’s ring race.
- [ ] The modules and the drawing (Thraxa violet, Nolan’s tower code-built; the station a ring with the hall, flags as instanced quads).
- [ ] `--play thraxa`, `--play coalition`; shots `thraxa talescria`; `gen3d` and `voices` issues.
- [ ] Checks; commit; pull request; merge.

### Task 12: The city alive: the clock, the weather, standing, the helicopter

**Files:**
- Create: `clock.js`, `clock.test.js`, `weather.js`, `weather.test.js`, `storm.js`, `standing.js`, `standing.test.js`
- Modify: `scene.js` and `sky.js` (sun, fog, windows, crowd from the clock’s fraction), `ground.js` (wet specular), `flight.js` (the storm’s wind), `brains.js` (`boo`), `lines.js` (the fans at the ends), `MissionCard.jsx` (Cecil’s debrief), `jet.js` or a new `heli.js` (`heli.glb` circling the biggest thing), `InvHud.jsx` (the clock, the glyph, the standing), `InvWorld.jsx` (saves)

- [ ] Tests first: a day is 24 minutes and T jumps to the next preset; the fraction saves and loads; weather seeded by the day with the lengths in range; lightning every 8 to 20 s only in a storm; wind 6 m/s on flight; standing clamps to ±100 with five names; a saved life adds, damage subtracts, a floored crowd subtracts 5 each; the helicopter picks the biggest thing within 1 km.
- [ ] The modules and the drawing; reduced motion gets no lightning flash and no rain sheet, only the wet streets.
- [ ] Shots `storm night24` with `--metrics`.
- [ ] Checks; commit; pull request; merge.

### Task 13: Leaderboards

**Files:**
- Create: `boards.js`, `boards.test.js`, `supabase/migrations/20261018000000_inv_times.sql`
- Modify: `MissionCard.jsx` (the top ten and yours), `InvWorld.jsx`, `supabase/README.md`

- [ ] Tests first: `submit` keeps only a better time; `top(board)` returns at most ten; with no client every call returns `null` and makes no request; the row shape against the migration.
- [ ] The migration with RLS as `world_entities` has (a row an owner; reads for all; writes clamped by a `security definer` function); the module; the card.
- [ ] Checks; commit; pull request; merge.

### Task 14: Presentation and the hand-off

**Files:**
- Create: `words.js` (pure: the onomatopoeia by force), `words.test.js`, the words’ draw in `fx.js`
- Modify: `quests.js` (season two’s eight cards), `panels.jsx` (every episode gets panels), `InvHud.jsx`, `docs/superpowers/HANDOFF-invincible-world.md`, `docs/architecture.md`, `docs/autopilot/backlog.md`, `README.md`’s Invincible line if it has one

- [ ] Tests first: `wordFor(force)` gives `WHAM` under 100, `KRAK` to 400, `THOOM` over; at most 32 live; off under reduced motion; the eight cards at their places.
- [ ] The words (one instanced draw of text sprites from a canvas atlas), the cards, the panels for episodes 1 to 7.
- [ ] The hand-off rewritten with Done (PR numbers), Left (in order) and Checking it (every shot, every `--play`, the hooks); the architecture paragraph; the backlog’s Invincible items ticked or added.
- [ ] Checks; commit; pull request; merge.

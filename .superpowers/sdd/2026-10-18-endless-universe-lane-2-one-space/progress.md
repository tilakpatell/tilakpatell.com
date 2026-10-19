# SDD ledger — plan: docs/superpowers/plans/2026-10-18-endless-universe-lane-2-one-space.md

Spec: docs/superpowers/specs/2026-10-18-endless-universe-design.md (read). Index: docs/superpowers/plans/2026-10-18-endless-universe.md (read).
Worktree: C:\Users\tilak\src\tilakpatell.com\.claude\worktrees\agent-aeeef2bf873ba228b
PR 2.1 branch: claude/endless-universe-lane-2-1-generator from origin/main ddb364bf3
Health at start: boundary-breaks 487/489, cycles 5/5, big-files 30/30, glsl-sites 607/619.

## Pre-flight scan (PR 2.1 rows in full; PR 2.2-2.5 rows re-checked against merged code at each PR's start)

| Rows | Produces vs consumes | Found |
|---|---|---|
| T1 self | test code complete; fixture written from unchanged code BEFORE grid.js edit | ok; plan order already does this |
| T1 vs T6 | plainSector(sector,{systems,wonders}) cut <- T6 `plainSector(fullSector(..), legacy)` | ok: legacy = {systems, wonders} counts |
| T1 grid vs T7 | grid wrappers keep 2D API; T7 moves layout to address.js | ok |
| T2 self | test code complete; revsFor values 4/32/1 check out; t=1e10 precision ok (f=t/65536 exact) | ok |
| T2 vs T4 | revsFor <- moons/planets revs; orbitAt needs {at, centre, revs} <- addBodies adds centre, revs | ok |
| T3 self | consumes PLACES (deep.js), SECTORS, SECTOR_RADIUS, sectorOf (layout.js) from expanse/gen | CONFLICT with health boundary-breaks (487/489, expanse is a world): keepOuts.js + its test + density.test.js add >=5 breaks -> Ruling 1 |
| T4 self | moves cultureOf/planetsOf/system body/local factions verbatim; helper `weighted` used by both moved code and wonders | duplication risk -> Ruling 2 |
| T4 vs T6 | systemAt(sSeed,{id,i,at,d,band,local}); `id` ambiguous (sector or system id) | Ruling 3 |
| T4 vs lane 5a | moon row {id,k,name,type,seed,radius,orbit,phase,revs,tilt} | ok, names kept |
| T5 self | ctx {sx,sy,sz,origin,seed,systems,outs}; thingInCell order-free | ok |
| T5 vs T6 | thingsOf ctx systems = all systems (legacy+appended); outs = keepOutsNear | ok |
| T6 self | beacons for sy!=0 "same rule at sector's height": sector.js beaconsOf is private and returns home beacons at sx=sz=0 | Ruling 4 |
| T6 density | 27 sectors in beforeAll ~1.6 s vs RULES.md "a test runs under a second" | Ruling 5 |
| T6 vs T9 | rosterWhere uses fullSector(SHARED, ..., {things:false}) | ok, signature matches |
| T6 vs T16/T19 | addBodies(makeSector()) in 2.4; sectorJob=fullSector minus moonList + withMoons in 2.5 | ok |
| T8 vs T17 | both edit scene.js ~:4314 (autopilot) | sequential PRs, ok |
| T14 | "vertexShader includes String(REAL_REACHES)" not defined in T13 | ok: farStars.js:34 has REAL_REACHES = 20 |
| T22 vs T7 | rt.origin stays for /fly | ok |
| Global | every PR: scene.js no growth; new files < 800; gen/runtime/budget/levels no React/DOM/three | carried in every dispatch |

## Rulings
Ruling: Lane 2's new imports from src/components/expanse/** into src/components/universe/** go through a new lending face src/components/universe/shared/space.js (re-exports as needed) with its row in universe/shared/shared.test.js; existing imports are not moved — why: health boundary-breaks is at 487 of 489 and expanse is a world; RULES.md "worlds are islands" sanctions shared/ faces — cost if wrong: one small face file and a test row to fold back later.
Ruling: `weighted` moves out of sector.js into seed.js beside pick (exported, listed in the header) so systems.js and sector.js share one copy — why: Task 4 moves code that uses it while the wonders still use it; a duplicated helper is a review defect — cost if wrong: one import line.
Ruling: systemAt's `id` is the sector's key (sectorKey form) and systemAt makes the system id `${id}:${i}` — why: equals spaceId([sx,sy,sz], i) for every sector and keeps the legacy loop's text verbatim — cost if wrong: one rename.
Ruling: fullSector's beacons for sy!=0 use the generic rule (four beacons at the sector's faces, y = origin y +-200), never the home beacons, seeded from sectorSeedOf; on sy=0 they are makeSector's exactly — why: the plan says "the same rule at the sector's height elsewhere"; home's beacons belong to the middle layer — cost if wrong: beacons above/below home move.
Ruling: density.test.js builds the 27 sectors once in beforeAll and may take ~2 s; accepted as the plan mandates it — why: the spec pins the density test over 27 sectors in 3D; each `it` stays fast — cost if wrong: ~2 s added to the suite.

## Tasks
Task 1: implemented a40d7ffcb (base ddb364bf3), implementer a1e9c1ce62537137f; review dispatched (ae02738bd9f881fe0)
Task 1: minor (deferred): fingerprint.test.js:2 import missing a space `{ existsSync,readFileSync`
Task 1: minor (deferred): grid.js lost its "why 120,000" comment (SPREAD, the authored map's edge at 54,000); address.js doesn't carry it
Task 1: ⚠️ resolved by controller: address.js sectorAt is Math.round(v/SECTOR)+0 per axis (read it), so parity holds; generator files untouched in the diff and the fixture test passes after the grid change
Task 1: complete (commits ddb364bf3..a40d7ffcb, review clean)
Task 2: dispatched (base a40d7ffcb), implementer aee09382232e099f1
Task 2: Ruling: the "stays smooth" test computes `most` from len(planet.at, planet.centre) instead of the literal 1000 — why: the fixture planet's radius is 1000.45 (y offset 30), so any correct circular orbit exceeds the hard-coded bound by 0.045%; the intent (a frame's step never exceeds a frame's arc) is kept exactly — cost if wrong: none, the bound is the true arc.
Task 2: implemented a1df4d569 (trailer amended locally to the lane's text before any push); review a9c592d50f3a51b08
Task 2: minor (deferred): orbits.js:24-26 header sentence is a fragment; orbits.js:70-72 `yx` name for Y×r0 unclear; no test that moonAt starts at phase / tilts out of plane
Task 2: complete (commits a40d7ffcb..a1df4d569, review clean)
Task 3: dispatched (base a1df4d569), implementer ae5d724827f0e349c
Task 3: implemented 892cce033 (face universe/shared/space.js; KEEP_OUTS has duplicate ids 'home'/'rickmorty' because PLACES has planets with those ids); review a687e713ef06f5a4c
Task 3: minor (deferred): keepOuts.js:30 and its test import '../../universe/shared/space' without .js while line 29 has it; the station/pocket test pins only a count; KEEP_OUTS ids repeat ('home', 'rickmorty') — consumers must key by index or id+at (say so in the PR's interfaces)
Task 3: complete (commits a1df4d569..892cce033, review clean)
Task 4: dispatched (base 892cce033), implementer af372eba64ab5ad36
Task 4: implemented 8942ea6ea (no RED captured; addBodies ~0.8 ms/sector); review a83ab89e58062b77c
Task 4: minor (deferred): systems.js:442 NUMERALS has 8 entries, unguarded beyond; icy-share test weak (only "higher"); ringBandOf computed twice per ringed planet in addBodies; moons may nearly touch at 6
Task 4: ⚠️ resolved by controller: `npx vitest run src/components/expanse` 39 files / 322 tests pass (fingerprint untouched); only rosterWhere imports sector.js (makeSector), nobody imported weighted/ORBIT_MAX from it
Task 4: complete (commits 892cce033..8942ea6ea, review clean)
Task 5: dispatched (base 8942ea6ea), implementer a7a1658503f617394
Task 5: implemented d55e4e7b2 (thingsOf 2-10 ms/sector; optional `kinds` param added for the place test); review a7dfad9451e6e68bf
Coordinator rule added (CPU-quiet lock before heavy runs) to lane-context.md for every implementer.
Task 6: dispatched (base d55e4e7b2), implementer abb34288046c0ca88
Task 5: review Needs fixes — Important: keep-out/system clearance test vacuous on (3,0,-2). Fix round 1 sent to a7a1658503f617394 (FIX_BASE 21ca0a3ad)
Task 5: minor (deferred): things.js cache keyed on ctx identity snapshots systems (stale if mutated); thingRow indexes THING_KINDS though thingsOf/thingInCell accept custom kinds; names use 'core' culture; 200 ms timing assertion flake risk
Task 6: implemented 21ca0a3ad (10 sectors 254 ms; beaconsOf(sx,sz,seed,sy=0) exported); review ac806ae8ad21d8415 (opus)
Task 5: fix round 1/5 (1 addressed, 0 open — vacuous clearance test; commits 21ca0a3ad..fd06815d4)
Task 5: complete (commits 8942ea6ea..fd06815d4 incl. fix, review clean)
Task 6: minor (deferred): density.test.js:67 keep-out test slices off legacy systems and checks no moons despite its title
Task 6: minor (deferred): keep-out tests use the code's own keepOutsNear filter; test against all KEEP_OUTS instead
Task 6: minor (deferred): space.test.js:114-121 placeOf checks wonders/things by kind/size only, not the row; extra branch untested
Task 6: minor (deferred): space.test.js:143 console.log in the speed test (output noise)
Task 6: minor (deferred): density.test.js:28 adds legacy wonders to the point set beyond the brief's list
Task 6: minor (deferred): speed test only exercises the no-keep-out path; CI flake watch (254 ms vs 600)
Task 6: complete (commits d55e4e7b2..21ca0a3ad, review clean)
PR 2.1: final whole-branch review next (MERGE_BASE ddb364bf3, HEAD fd06815d4)
PR 2.1 final review (a4fdfdc080a958a5c, opus): Ready after fixes — Important: speed test flakes (448 ms at 100% CPU; my full-suite run read 9,005 ms with 63 load timeouts elsewhere). Fix list: speed test, moonAt phase/tilt test, header comments (KEEP_OUTS ids repeat; placeOf rows shared/read-only; things ctx immutable, extras plain data), extras base>=3/overlap guard, grid.js comment.
Ruling: the speed test measures CPU time (process.cpuUsage, user+system) as the best of three ten-sector batches after a warm-up, with the plan's 600 ms bound unchanged and no console output — why: on this machine's full-suite run the wall clock read 9,005 ms for work that takes 254 ms alone, so a wall-clock bound measures the machine's load, not the code; CPU time keeps the plan's number honest — cost if wrong: none for correctness; a slowdown still fails it.
Ruling: appended systems' placement cube half is 56,000, not the plan's 58,000 — why: the spec keeps the 6,000 gap between systems; the final review found 3 cross-face pairs under 6,000 (closest 4,934, reaches up to 3,182); legacy systems sit >=2,000 inside a face, so appended ones >=4,000 inside keep every cross-face pair (legacy–legacy aside, which can't change) >=6,000 — cost if wrong: about 5% less volume for appended systems; the density test still guards.
Ruling: lattice things are kept clear of legacy wonders other than nebulae (by the wonder's radius plus the thing's size) — why: the final review found things inside wonders, and a rock inside a derelict or pulsar would draw through it once 2.5 draws both; things inside a nebula are wanted (spec B: swarms and fields in nebulae) — cost if wrong: a few fewer slots near wonders (slot ids stay stable).
Ruling: a gas giant's moons may cross a neighbouring planet's orbit (final review issue 5) is left as is — why: positional only and rare (a conjunction), nothing stores moon orbits so a later cap moves nothing saved — cost if wrong: occasionally a moon passes through a neighbouring planet on screen; handed to lane 5a as a note.
PR 2.1: fix wave dispatched (FIX_BASE fd06815d4), implementer a10ede1c3762ee1ca
PR 2.1: fix wave commits 1b4294c73, ba25d6c25; re-review (ae1edb6fa4a538998): all 7 addressed, no new breakage. Final review clean.
PR 2.1: (resumed after an API 429 cut-off; no work lost) build ok, health within budget (487/489), smoke green (/universe, /fly). Pushed; PR #1033 https://github.com/tilakpatell/tilakpatell.com/pull/1033 — waiting for CI.
## PR 2.2 (branch claude/endless-universe-lane-2-2-no-ceilings from origin/main 50c238028; Tasks 7-8 now, merge origin/main after #1033 merges before Task 9 since rosterWhere needs fullSector)
Pre-flight 2.2:
| T7 vs T8 | sectorOf(x,y,z) 3D ball for the pocket; sectorOut(x,z) keeps its 2D signature and step() calls sectorOut(s.x,s.z) | step must read the sector in 3D itself (pocket ball test at y=+7000 crosses over) — carried in T8 dispatch |
| T8 self | `space.roof` replaces `space.ceilingAt` reads in step/autopilot; galaxy/space.js makeSpace has ceilingAt and no roof | Ruling 2.2-a |
| T8 curve | SphereGeometry(edge,256,64) = ~32,256 tris vs today's open cylinder 512; rickmorty baseline pose 183,596 tris | Ruling 2.2-b |
| T8 scene lines | :1809, :1833, :1880, :3398, :4314 match current main | ok |
| T9 vs 2.1 | rosterWhere uses fullSector | needs #1033 merged first |
Ruling: step() and autopilot() take the roof as `space.roof` when the space defines the key, else `space.ceilingAt` (so `roof: null` means none) — why: the galaxy's makeSpace (galaxy/space.js) passes its own space with ceilingAt and no roof, and /galaxy is out of scope; reading only `space.roof` would silently take its ceiling away — cost if wrong: one extra branch in two places.
Ruling: the Curve becomes a ball as SphereGeometry(sec.edge, 256, 2) — the same 256 segments round and 512 triangles as today's open cylinder — and its shader reads the height from the local position (today's half-height, DEEP.ceiling × 1.3, as the unit) instead of the uv, so the band and glow keep their world thickness — why: the plan's 256 × 64 sphere adds ~31,700 triangles at the rickmorty baseline pose (183,596), against the owner's "no higher" rule; the band and glow fade out within ~1,500 of the disc, so the coarse caps draw nothing visible — cost if wrong: the faint glow leans inward slightly on the cone; before/after shots of the rickmorty pose go in the PR.
PR 2.1: CI all green; MERGED #1033 as 489218ca2 (merge commit).
Task 7: implemented 432c2be28 (base 50c238028), implementer aaa1c75602c800efd; boundary-breaks 487→486; sectorById falls back to origin [0,0,0] for a key inExpanse accepts but parseSectorKey rejects (was NaN)
Task 7: minor (deferred, fix in 2.2's final wave): layout.js:76 sectorById gives origin [0,0,0] for an unparseable 'E:' key — return null instead (network ids), with a test; no negative-sy / outside-SECTOR_SPLIT cases
Task 7: complete (commits 50c238028..432c2be28, review clean)
Before shots 2.2 (rickmorty pose, at 432c2be28 = main's picture): high 38 calls / 127,153 tris; mid 24 / 65,883; low 38 / 65,865 (lab/universe/before-2.2/, git-ignored)
Task 8: implemented 367e8a699 (base 432c2be28), implementer a8c147c4bdb80a8f4 (opus); 167 universe files / 1889 tests pass; scene.js 6226→6226
Ruling: the autopilot's climb cap is 1.5 rad where the space has no roof (1.2 kept wherever there is one: SPACE and the galaxy) — why: the plan's own test (park 30,000 above home in OPEN_SPACE within 600 s) can't pass with only the ceiling clamp removed: capped at 1.2 rad the nose never comes onto the climb, the boost drops and the ship circles at y≈12,900; the implementer flew every universe and wonder autopilot scenario in OPEN_SPACE and all park cleanly — cost if wrong: steeper autopilot climbs in the universe than before.
Task 8: review a6c66dac83c36d078 (opus): Approved. Minors deferred to 2.2's final wave:
Task 8: minor (deferred, FIX in wave): curve.js:63 the 256×2 sphere is a double cone (wall leans in up to ~570 at y=600 where threads still show) and closed (a full-screen additive pass inside the pocket). Use the band of the ball `SphereGeometry(edge, 128, 2, 0, 2π, π/2 − d, 2d)`, d = asin(1820/edge): 512 tris, open top/bottom like the cylinder, on the wall
Task 8: minor (deferred, FIX in wave): ship.test.js 30,000-up autopilot test never asserts it parked (`done`)
Task 8: minor (deferred, FIX in wave): no OPEN_SPACE trip slice in the suite (every universe from the edge, the upside-down takeover); no test that a space without a `roof` key (galaxy makeSpace) is still turned back at its ceilingAt
Task 8: minor (deferred): ship.js 828→873 lines (already over 800 before)
Ruling: the Curve is the band of the ball, SphereGeometry(edge, 128, 2, 0, 2π, π/2 − d, 2d) with d = asin(DEEP.ceiling·1.3 / edge), replacing the earlier 256 × 2 double cone — why: the review showed the cone leans up to ~570 inside the wall where the threads still show, and closing it adds a full-screen additive pass inside the pocket; the band keeps 512 triangles, sits on the wall and is open above and below like today's cylinder — cost if wrong: none seen; the shader already reads height from position.
Ruling: nav.js's tripTime still simulates in SPACE (with its ceiling); left to lane 6b, which owns long-trip times (spec F), and noted in the PR — why: nav.js isn't lane 2's file and lane 6b replaces long trips with a formula — cost if wrong: a trip time from far above the core reads long or none until 6b lands.
Task 8: complete (commits 432c2be28..367e8a699, review clean; minors to the final wave)
After shots 2.2 (rickmorty pose, 367e8a699): high 38/127,153; mid 24/65,883; low 38/65,865 — equal to before. Pictures differ only by the planet's turn and traffic (time); the Curve isn't in frame at this pose.
PR 2.2: merged origin/main (with #1033) as 8756d2ee5 (trailer added to the merge message).
Task 9: implemented 7859d7696 (base 8756d2ee5), implementer a7b3a989e0f3aeda7; boundary-breaks 486→485. Review acb1f2a0a29ffc223: Approved.
Ruling: the shot test's `readShot([1e9,…]).p[0]).toBe(90000)` becomes `readShot([1e13,…]).p[0]).toBe(1e12)`, listed in the PR beside the 1,300 one — why: it pinned the FAR shot clamp that the plan's ±1e12 bound removes (other pilots' shots past 90,000 were dropped); same intent at the new bound — cost if wrong: one assertion to restore.
Task 9: minor (deferred, FIX in wave): protocol.js:76-80 writePose parses after only an inExpanse check; guard on the parse result
Task 9: minor (deferred): no negative-sy / on-boundary pose tests; readPack still clamps hunters to ±1,300 and FAR (plan finding 7: lane 4b)
Task 9: complete (commits 8756d2ee5..7859d7696, review clean)
PR 2.2 checks: online-check RELAY=fake --universe: all ok. --ride fails on main too (imports the removed universe/hyperlanes.js). navmap-check desktop: "nothing at .universe-navmap-btn" on this branch and identically on origin/main 721296c73 (as on main).
PR 2.2: final review next (lane-only diff e9ceae7dd..7859d7696)
PR 2.1 gate (local, at fd06815d4): lint clean. npm test: 61 files failed under load; outside the baseline, all are 5 s timeouts (cold dynamic imports of heavy three.js modules, e.g. crews.test.js importing footScene) on a loaded machine, plus space.test.js's wall-clock speed test (9,005 ms) — the latter fixed by ruling; the timeouts import nothing lane 2 touched. CI on Ubuntu is the gate.

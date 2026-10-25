# The endless universe: what is in, and what is left

Date: 2026-10-25. Status: the hand-on for the next session, written when one session stopped mid-way through the endless universe's lanes. The design is `2026-10-18-endless-universe-design.md` (it wins over every plan); the index plan is `../plans/2026-10-18-endless-universe.md`; each lane has its own plan beside it. The owner's rules in `../HANDOFF-universe.md` hold throughout.

Everything below was merged into one branch, `claude/trusting-sagan-tda0fm` (pull request #1244), lane by lane, with a merge commit for each. The lanes' own evidence and hand-off notes are in `../evidence/endless-universe-<lane>/` (`README.md` for the numbers, `HANDOFF-NOTES.md` for what each lane landed and left); lane 6a's pictures are in `../evidence/endless-universe-6a-map/`.

## In

| Lane | What | State |
|---|---|---|
| 2, PR 2.3 | Camera-relative drawing every frame (`universe/relative.js`); bodies, the planets' air, deep space's suns, a landing's crowns, the broken flagship and a portal kill set world positions in the draw | Done, gated, reviewed |
| 2, PR 2.4 | The budget table (`universe/budget.js`), levels of detail (`expanse/scene/levels.js`), the far layer's specks and discs in farStars' one draw, discs of true size (`expanse/scene/discs.js`), the nearest systems built whole (`expanse/scene/near.js`: star and light, planets on `orbitAt`, moons, rings), generated bodies solid and lit, `orbits()` moved out of `scene.js` | Done, gated, reviewed |
| 2, PR 2.5, tasks 18–21 | The chunk grid in 3D (`runtime/chunkGrid3.js`), sectors and the beyond rings made in the worker pool (`expanse/gen/job.js`, `expanse/scene/sector.worker.js`), the Expanse in 3D everywhere with no rim (`expanse/scene/expanse.js`), things drawn as discs and near meshes with the drawers hook (`expanse/scene/nearThings.js`); `workers: ctx.rt.workers` is passed | Built task by task; PR 2.5's task 22, gate and review not done |
| 1, tasks 1–8 | One nebula renderer fixed in the world (`universe/nebula/`: `rules.js`, `budget.js`, `volume.js`, `index.js`, `shaders.js`, `fog.js`); the fog inside; the galaxy sky's option to bake without clouds (off by default, so `/galaxy` is unchanged); landmarks world-up and depth-tested, no nebula drawn as one; deep space draws the Veil and the Cradle with the renderer; the quality step reaches it from `paceTo` | Done, gated, reviewed (part one) |
| 3, PR 3.1 | Generated places as destinations, the pure half: stations at one system in three in the generator, the expanse's two faces (`expanse/shared/gen.js` pure, `universe/shared/space.js` drawn), cards and words (`universe/places/cards.js`, `words.js`'s `PLACE`), ids and the resolver (`places/ids.js`, `places/resolve.js`), parking and the carry (`places/park.js`, `places/carry.js`), the long-trip formula (`places/trip.js`), `nav.js` on `E:` ids everywhere, what's round the ship (`places/around.js`), picking, tags and docking as rules (`places/pick.js`, `places/dock.js`) | Done, gated, reviewed |
| 6a | One chart projection for the nav map and the mini-map (`universe/chart/`: `projection.js`, `declutter.js`, `place.js`, `marks.js`, `input.js`, `useChartView.js`, `NavChart.jsx`, `ChartTools.jsx`), centred on the ship, zoom, pan, tilt and turn with stems, the ship always on it; the gesture reader in `src/lib/gesture.js`; the mini-map on the same projection with wonders and moons and no false orbit rings; `navmap-check.mjs` picks its wonder by name and has desktop, phone, minimap, far and landscape modes | All 11 tasks done and reviewed task by task; gate passed; the lane's whole review not finished |
| 5a | Unique generated planets, the pure half: the roster lock (the 50 planets byte for byte), the sphere and the chart round a landing spot (`lib/land/flight/sphere.js`), 3D noise and eight terrain characters (`characters.js`), the field on the sphere (`sphereField.js`), ids and moons through the address, only the 50 buildable, per-planet variety (`variety.js`), the flight's field on a round planet, generated specs (`generated.js`), life and places from the variety, the orbit map (`orbitMap.js`) baked in a worker and cached in memory (`orbitMaps.js`), worlds you can't build on, the contact sheet (`scripts/planet-contact-sheet.mjs`) | All 14 tasks done (tasks 1–6 reviewed one by one, 7–14 not); the lane's gate and whole review not finished |
| 4a, task 1 | The catalogue: 23 kinds of thing in space, drawn as 32, each with its look and what's solid; the plan re-checked against the code | Task 1 of 25 built, not reviewed |
| 4b | The plan re-checked against the code | No task built |
| 4c, 5b, 6b | Plans written and reviewed: `../plans/2026-10-18-endless-universe-lane-{4c-first-minute,5b-landing,6b-map-2}.md` | Not started |

## Left, in order

1. **Gate what came in unreviewed.** Run the whole review (the plan's PR section against the diff) for lane 6a and lane 5a, and lane 5a's gate: `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`, `node scripts/flight-island.mjs --check`, and its checks (the roster lock, the contact sheet, `autopilot-check.mjs --only smoke` on `/fly` with a generated id).
2. **Lane 2, PR 2.5's task 22** (lane 2's plan): `__universeDebug.teleport`; the poses `old-rim`, `above-core` and `expanse-system` in `poses.js` and `universe-check.mjs`; `scripts/universe-endless-check.mjs` with its steps `start`, `old-rim`, `boundary`, `system`, `climb`; the numbers; then PR 2.5's gate and whole review. Lane 2's `HANDOFF-NOTES.md` lists what its tasks left (stars-only beyond maker if the far field comes late, a generated star with no flare or eclipse, the no-ship overview showing no generated space, and the rest).
3. **Lane 1, tasks 9–11** (lane 1's plan): the Expanse's nebulae through `createNebulae` from `expanse/scene/sectors.js`, fading in as their sector comes (lane 2's note); the poses and the browser measure (parallax over 5,000 sideways, rolling with the stars, growing, the fog inside); the after numbers. Then fold the two nebula tables into one: `nebula/budget.js`'s rows replace `universe/budget.js`'s unread `nebula` entry (its test pins rows exactly, so it changes with them), and `expanse.setStep` hands the renderer `universeBudget(…, step, floor).nebula`.
4. **Lane 3, PR 3.2, tasks 10–15**: the wiring. Its plan's "What PR 3.2 waits on" says what each task needs from lane 2's PR 2.5. One correction to its "What later lanes consume" table, which lanes 4c, 5b and 6b read: `nav.js`'s `parkFor` and `tripTime` need the lookup's `park(id, from)` as well as `place`, so pass `lookupOf(opts)`, never `{ place }` alone.
5. **Lane 4a, tasks 2–25** and **lane 4b, tasks 1–20**: both plans were re-checked against the code and say what each later task waits for. 4a's and 4b's drawn halves need lane 2's PR 2.5 and lane 3's PR 3.2.
6. **Lanes 5b, 6b and 4c**: re-check each plan against the merged code first (their reviews left open findings; lane 3's table correction above applies), then build. Lane 4c is last and owns the whole-route run of the spec's checklist.
7. **The measure, once, at the end**: `node scripts/universe-check.mjs --quality all` against the baseline poses, draw calls and triangles no higher at any of them, the new poses recorded; `scripts/perf-probe.mjs` at mid and low; the endless check at mid and low. Main's before numbers for this were taken at `cc5e2eaf` but live in an ignored `lab/universe/` folder, so take them again from a checkout of `main` (or compare with `lab/universe/baseline/`). The lanes' own mid-tier numbers are in their evidence READMEs.
8. **The hand-off**: fold every lane's `HANDOFF-NOTES.md` into `../HANDOFF-universe.md` ("Landed" and "Left"), and delete the notes.

## The spec's ten "done" items, where each stands

1. No end, no edge, no ceiling: the ceilings went in PR 2.2; the rim went in PR 2.5's task 20. The endless check that proves it (task 22) is left.
2. Populated in every direction: generation covers the core with its keep-outs (2.1, 2.5). The density test is lane 2's; lane 4a's catalogue fills it further. Movement within 20 seconds needs lane 4b.
3. More than planets: 23 kinds are in the generator's catalogue (4a task 1); drawing them, their actions and the 15 events are left (4a, 4b).
4. Every place you see, you can go to: the rules are in (3.1); the wiring is left (3.2).
5. Nebulae stay put: the Veil and the Cradle are drawn by the world-fixed renderer (lane 1 part one); the Expanse's nebulae and the measure are left (lane 1 tasks 9–11).
6. Generated planets unique and landable: unique, round and baked from orbit in the pure half (5a); landing and walking are left (5b).
7. The map is dynamic: the projection, zoom, pan, tilt, the ship always on it and the mini-map on the same projection are in (6a); generated places on the chart, search and pilots everywhere are left (6b).
8. The first minute: left (4c).
9. Nothing is lost: each lane's tests and gates; the whole suite is run on the merged branch before it is pushed.
10. Phones still fly: the budget table by tier is in (2.4); the low-tier measure is left (item 7 above).

## Working notes for the next session

- Chromium is at `/opt/pw-browsers/chromium-1243/chrome-linux64/chrome`; several check scripts look elsewhere by default, so set `CHROMIUM` and `CHROME` to it.
- Headless Chromium draws in software GL here at a frame or two a second: `universe-check` takes 2 to 4 minutes a pose and tier. Keep checks to the mid tier while building, and measure all tiers once.
- With several lanes running, the full suite's 5 s timeouts trip under load; re-run a timed-out file alone before calling it red. On `main`, `scripts/health/art-mix.test.mjs` times out the same way.
- A `dist/` is 1.6 GB: build to `/dev/shm` and delete it, or the disk fills.

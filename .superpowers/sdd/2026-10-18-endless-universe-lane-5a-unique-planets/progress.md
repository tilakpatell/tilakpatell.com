# SDD ledger — plan: docs/superpowers/plans/2026-10-18-endless-universe-lane-5a-unique-planets.md

Branch: claude/endless-universe-lane-5a-unique-planets (from origin/main ddb364bf3)
Spec: docs/superpowers/specs/2026-10-18-endless-universe-design.md (section E, done item 6) — reachable.
Lane 2 (moons, placeOf) not merged at start. PR #1022 (engine floor FL3, the planet flight on the node renderer) is OPEN and may touch src/components/expanse/flight/* — merge origin/main if it lands.

## Pre-flight scan

| Pair / task | Produces → consumes | Found |
|---|---|---|
| T1 → all | ROSTER_LOCK hash over 17 keys, ground, lifeFor, clutterKitOf | T5 moves CLIMATE to PLANE_CLIMATE unchanged (same values, same JSON); T9 adds fauna/flora/exotic reads that are null on the 50. Consistent. |
| T2 → T4,T7,T8,T10 | unit, chartOf, dirOfUv, frameAt | Checked by hand: dirOfUv/uvOf layout matches landings/biomes.js uvOf (atan2(z,−x)); east=cross(north,up) at lon 0 is −z, the way lon grows (fromLatLon). Consistent. |
| T3 → T4 | groundOf({kind,sea,peaks},seed,R) | groundOf's rule needs “a planet with water” but its signature carries no water flag. Ruled (R3). Underwater ×420 can pass −190 for wet sea 0.6. Ruled (R3). |
| T4 → T7,T10 | sphereField.sample slope | T10's exact texel test computes slope as 1 − 1/hypot(1,gx,gz) with central differences at ±SLOPE_STEP along chartOf(dir,R).toDir; sample must use the same expression and order. Guidance carried into T4 dispatch. |
| T4 ↔ T8 | CLIMATE_SPHERE.stretch tuned in T8 | Fine: T8 may raise it; T4 test pins only frequency. |
| T5 → T6,T8,T9 | canonicalId, familyOf, SEEDED_EXPANSE, ROSTER_EXTRA, MOONS | lifeTables' 4-part EXPANSE_ID → canonicalId so moons get life. Consistent. |
| T5 ↔ lane 2 | moonRowOf reads p.moonList[k] | Lane 2 Moon is { id:'<planet id>:k', k, name, type, seed: bigint, radius, orbit, phase, revs, tilt }. Names meet (moonList). Join when lane 2 merges. |
| T6 internal | dominant vs palette | Plan says dominant = dominantOf(palette) (mix of hex low/high) but its own test 'keeps each type in its family' allows only the jitter (0.183) from a slot; high's +6° hue and hex quantization of low-saturation slots (ice s .15: ~10° hue steps) put the mix outside. Ruled (R4). |
| T6 fixture | randomSystems radius ranges from expanse/gen/tables.js | planetSpec.test.js 'the pure layer' scans fixtures/*.js for components/ imports → copy the ranges as numbers. Ruled (R5). |
| T7 → T10,T11 | planetField round, fieldKey | Consistent. |
| T8 → T9,T10,T12 | spec fields, chartedAt, WATER_LOOKS, buildable | Consistent. |
| T9 internal | expanseLife fauna argument | name clash with local `fauna` (FAUNA[type]); implementation detail. |
| T10 → T11,T13 | bakeOrbitMap, groundColour, orbitMapSize | Consistent. |
| T12 | shared.js readOnly | line refs 58-73, 131-137, 219-222 hold on main. |
| T13 | contact sheet, ISLAND.files | src/lib/land/flight is an island dir already, so new lib files ride along. |
| T14 | gates, shots, PR | Index plan: each lane's last commit updates HANDOFF-universe.md (Landed/Left); 5a's plan omits it. Ruled (R6). |
| Each task's own text | tests vs code | T1–T5, T7–T13 agree with themselves apart from the rows above. |

## Rulings

- Ruling: commits carry the brief's trailer (Co-Authored-By … + Claude-Session) although the plan's Global Constraints say no co-author line naming a model — the lane brief is the owner-approved process for this run and every commit on main carries that trailer — cost if wrong: commit messages name a model; history can't be rewritten (no force-push), the owner would ask for it to stop on later lanes.
- Ruling (R3): groundOf takes `wet` in its first argument (`{ kind, sea, peaks, wet = false }`); wet uses the deep underwater mapping, dry uses × lift; sphereField passes `wet: Boolean(spec.water)`. If the −190…1150 bounds fail, the underwater mapping's coefficient (or a smooth floor) may be tuned like peaks, keeping it monotone and negative below s0 so the sea share holds; test bounds never move — the signature in the plan can't carry the rule it states — cost if wrong: one argument on groundOf for lane 5b to know; seas a little shallower than the plan's 420 m/unit.
- Ruling (R4): `varietyOf(row).dominant` is the planet's jittered slot `[h, l]` (the colour its palette is built round, an ocean's water slot), not dominantOf of its hex palette; `dominantOf` stays as written and is what the seeded siblings' template colours are measured with — the plan's own 'in its family' test allows only the jitter, and hex rounding plus high's +6° hue put the palette mix outside it — cost if wrong: the drawn palette may sit up to a few hue degrees off its slot on grey-ish slots, where hue barely shows; the guarantee holds on the slot.
- Ruling (R5): fixtures/generated.js copies the generator's per-type radius ranges as numbers instead of importing expanse/gen/tables.js — lib's pure-layer test forbids components/ imports in fixtures — cost if wrong: the fixture's ranges drift if the generator's change (only a test fixture).
- Ruling (R6): Task 14's last commit also updates docs/superpowers/HANDOFF-universe.md (Landed / Left) — the index plan requires it of every lane — cost if wrong: none.
- Ruling (R7): Task 1 records the lock hash printed by main's unchanged code (node_modules were absent when the plan was written) — the coordinator's note — cost if wrong: none.

## Tasks
Task 1: BASE ddb364bf3; implementer done ed247d4d3 (ROSTER_LOCK 707fb49f); review dispatched
Task 2: BASE ed247d4d3; implementer dispatched (sonnet)
Task 1: minor (deferred): lock failure message is a bare hash with no hint which planet moved (plan-mandated)
Task 1: complete (commits ddb364b..ed247d4, review clean; ⚠️ items checked by controller: 16/16 pass on unchanged src, trailer present)
Task 2: implementer done f8b77bf; review dispatched (sonnet)
Task 3: BASE f8b77bff2; implementer dispatched (opus) with ruling R3
Task 2: minor (deferred): tests don't pin unit(v)===v identity, toChart(antipode)=[πR,0], pole fallback −x, toDir(0,0)===at
Task 2: minor (deferred): frameAt near-pole precision (1−uy² form) ~1e-7 orthogonality for 1e-9<len<1e-8; toDir(0,0) returns shared at array; toChart assumes unit input
Task 2: complete (commits ed247d4..f8b77bf, review clean; ⚠️ tests re-run by controller 6/6)
Task 3: implementer done 88d4765 (tuned: −180 tanh floor under s0 wet and dry; craters peaks max 250→140; ridges peaks max 1100→850)
Ruling: Task 3's crater bowl made continuous at d = 0.6 (rises to meet its 0.3 rim) instead of the brief's −(1−(d/0.6)²) / 0.3·exp(…) pair — the brief's pair jumps 0.3×peaks at d = 0.6, a cliff no frequency or peaks tuning removes, and the 60 m in 4 m rule binds — cost if wrong: crater rims a touch softer than the recipe drew.
Ruling: Task 3's −180 m tanh floor applies to dry basins as well as wet (R3 allowed tuning the underwater mapping) — dry continents at sea 0.6 reached −211 m against the −190 bound — cost if wrong: dry basins slightly shallower than × lift.
Task 3: review dispatched (sonnet), implementer agent a11a2f38fcfbec651
Task 4: BASE 88d4765ca; implementer dispatched (opus) agent a1d4fe959b35aa22a
Task 3: minor (deferred): fastnoise-lite.md Rules line on the wrapper's test still describes only 2D checks; names sphereField.js before it exists (brief asked)
Task 3: minor (deferred): characters.test.js never passes wet, so the wet underwater mapping is untested in that file (sphereField tests cover wet specs)
Task 3: minor (deferred): characters.js seed xors A/B magic numbers; cache comment says 'a few dozen' but cap is 32
Task 3: complete (commits f8b77bf..88d4765, review clean; reviewer spot-checked heights −176…1020 over kinds×seeds×sea×peaks×wet)
Task 4: implementer BLOCKED (uncommitted): FastNoiseLite 1.1.1's 3D OpenSimplex2 steps up to 13.5 m along six great circles; seam test fails at v=0.25
Ruling: noise3For's 'simplex' uses FastNoiseLite's OpenSimplex2S in 3D (2D noiseFor unchanged, so the roster can't move), with a regression test in fnl.test.js across a plane where OpenSimplex2 stepped and a Gotchas line on the stack page — the spec asks for ground with no seam; 3D OpenSimplex2 in 1.1.1 is discontinuous and no table tuning removes it; rotating inside sphereField would leave the steps on every planet — cost if wrong: none known; OpenSimplex2S is a little smoother-looking and about as fast.
Task 4: implementer done 5674749 (OpenSimplex2S in 3D; ROUND_ROUGH keyed family→biome; roundSpec sea/peaks default to TERRAIN mids)
Ruling: ROUND_ROUGH is keyed by family, then biome id (ROUND_ROUGH[family][biomeId]) — the plan's flat biomeId key can't hold ice plains 0.7 and rock plains 0.6 at once — cost if wrong: lane 5b reads a two-level table, not a flat one.
Task 4: review dispatched (sonnet)
Task 5: BASE 56747497a; implementer dispatched (sonnet) agent a6480febe31b42eae
Task 4: minor (deferred): sphereField POI flat honours an unspecified p.h override (sphereField.js ~:495)
Task 4: minor (deferred): heightAt hot path allocates (unit, climate array, weightsAt arrays) — profile in Task 10's bake
Task 4: minor (deferred): overlapping POI pads blend in POI order
Task 4: complete (commits 88d4765..5674749, review clean; ⚠️ roster/GROUND hashes per implementer's 254/254 run, re-checked at gates)
Task 5: implementer done d9c0764 (kitClutter.test.js timed out once under load, passes 6/6 with longer timeout — watch at gates); review dispatched (sonnet)
Task 6: BASE d9c0764a0; implementer dispatched (opus) agent a53fc6cf9bf7a7524 with R4, R5
Task 5: minor (deferred): lifeTables systemOf calls the lookup with null for a non-planet id — guard with canonicalId first
Task 5: minor (deferred): no tests for expanseRow off the middle layer (sy≠0 → null) nor moonRowOf with k past the count (Review Focus 1 names them)
Task 5: minor (deferred): canonicalId rebuilds via Number (>2^53 coords round); planets.js imports expanse without .js
Task 5: complete (commits 5674749..d9c0764, review clean)
Task 6: implementer done 5e36dbd (no tuning; POI kinds distinct; weather amount 0 for none; gas can be exotic; ocean rock/deep from water slot); review dispatched (sonnet)
Task 7: BASE 5e36dbd4e; implementer dispatched (sonnet) agent ae35b89b2e21076d6
Task 6: minor (deferred): weather.amount is 0 for 'none' (brief: 0.2–1) — Task 8 told
Task 6: minor (deferred): variety.test.js (brief verbatim) doesn't exercise glowing→spores, POI doublings, distinct fauna plans, ocean sand/accent, stream independence; 'in its family' near-tautological under R4
Task 6: minor (deferred): exotic can fall on gas/ringed (no ground) — downstream must tolerate
Task 6: minor (deferred): under R4 the rendered hex palette can drift up to ~0.68 colourDistance from its slot on dark lava (hue on near-black)
Task 6: complete (commits d9c0764..5e36dbd, review clean)
Task 7: implementer done b50b312; kitClutter.test.js and landmarkTables.test.js time out at 5 s in dir runs under machine load, pass alone — watch at gates
Ruling: gas and ringed specs keep the variety's exotic as data but take no exotic clutter rows; only round (landable) specs add them — a cloud deck has no ground to stand crystals or spires on — cost if wrong: an exotic gas giant shows nothing exotic in the flight (lane 5b may draw it from orbit).
Task 7: review dispatched (sonnet)
Task 8: BASE b50b3121d; implementer dispatched (opus) agent a026b83f3fd8ed4e1
Task 7: minor (deferred): no test that a round planet's biomeAt is sphereField.biomeAt through the chart; worker test compares one leaf
Task 7: ⚠️ leafMesh/clutter on a round spec unverified by unit tests — covered by Task 14's /fly smoke on a generated planet
Task 7: complete (commits 5e36dbd..b50b312, review clean)
Coordinator message (stale 429 note) checked against ledger and git log: Tasks 1–7 complete, Task 1 not mid-run; carrying on.
Task 8: implementer done 5a35afc (stretch stays 1.5; dropped unused generatedSpecOf import from the verbatim test for lint)
Task 8: review dispatched (sonnet)
Task 9: BASE 5a35afcad; implementer dispatched (sonnet) agent ace16650a6d6e0198
Task 8: minor (deferred): glowing/floating trunk row has no depth (crystal/spire rows have depth 5) — may pop in nearer
Task 8: minor (deferred, plan-mandated): POI candidates are FIB_512's first 256 = one hemisphere, so a planet's POIs and chart origin sit in one random hemisphere — tell lane 5b
Task 8: minor (deferred): ground palette 'mark' colour not swapped (template's kept); wet dropped when the planet has no water
Task 8: complete (commits b50b312..5a35afc, review clean)
Task 9: implementer done be4fc2b (cached kit manifests per pack in landmarkTables.test.js 'names only kit models' after a load timeout); review dispatched (sonnet)
Task 10: BASE be4fc2bb0; implementer dispatched (opus) agent a50e0e55589990c1c
Task 9: minor (deferred): no test of pirate/faction rows beside generated fauna, of the pick clamp at 1, or of a temperate flora family
Task 9: complete (commits 5a35afc..be4fc2b, review clean; ⚠️ kit names covered by the extended manifest test the implementer ran)
Task 10: implementer done 565b129 (bake: 256×128 ≈1 s, 512×256 ≈3–4 s, 98% in sphereField; Bespin and the seeded gas two are banded per plan finding 4; plane windows have a u=0 seam by design)
Task 10: review dispatched (sonnet)
Task 11: BASE 565b129e8; implementer dispatched (sonnet) agent a7cf16dc4ecde1ba4
Task 10: minor (deferred, plan-mandated): no direct unit test of groundColour's steps (texel test uses it as its own oracle); gas/ringed/window bakes only length-checked; bakeBands re-parses palette
Task 10: minor (deferred): 512×256 bake ≈3–4 s, 98% in sphereField's hot path (see Task 4's allocation minor)
Task 10: complete (commits be4fc2b..565b129, review clean)
Task 11: implementer done ab6f266 (peek doesn't refresh recency; extra test for a throwing request); review dispatched (sonnet)
Task 12: BASE ab6f26646; implementer dispatched (sonnet) agent a583c1c583c57969e
Task 11: minor (deferred): no tests of the epoch/dispose paths (in-flight get across dispose) or of a malformed answer; makeOrbitWorker null leaves an unsent job in the pool queue until replaced
Task 11: ⚠️ transferred buffers own their whole ArrayBuffer — bakeOrbitMap allocates fresh typed arrays per bake (Task 10), so yes
Task 11: complete (commits 565b129..ab6f266, review clean)
Task 12: implementer done 3b8a18b; review dispatched (sonnet)
Task 12: minor (deferred): read-only tests could assert the durable factory / makeLoader is never called (they rely on the world() helper's fakes); unbuild has no readOnly guard (unreachable)
Task 12: complete (commits ab6f266..3b8a18b, review clean)
Task 13: BASE 3b8a18b7b; implementer dispatched (opus) agent aa159c51afa922028 with the CPU rule
Task 13: implementer died on an API 429 mid-tuning (uncommitted script, island line, characters.js edit); resumed by SendMessage
Lane 2's PR #1033 (generator in 3D, moonList, placeOf) merged to main — merge origin/main and make the moon join after Task 13

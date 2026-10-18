# Hand-off: Invincible world, part 3

The lane that carries out `docs/superpowers/specs/2026-10-18-invincible-world-3-design.md` by its plan, `docs/superpowers/plans/2026-10-18-invincible-world-3.md` (fourteen tasks, one pull request each, the plan’s boxes ticked as they land). Parts 1 and 2 are recorded in `HANDOFF-worlds.md`’s Invincible sections and, in full, in this file’s history before 2026-10-15 (`git show f97079c75:docs/superpowers/HANDOFF-invincible-world.md`). The code is right where it and this page differ.

## Done

### Task 1: the season plays through, and `--play` (2026-10-18)

- **Episode 1 finishes.** `quests.js` sends `ring` for the first ring too (with `lesson-start`); `missions.js` takes either as ring 0. Starting the episode puts a lesson already under way back to its first ring.
- **Knock-outs count from where a step says.** A mission’s progress keeps `kos` (foe id → kind and the step it went down in); a `defeat` step counts its kind from `since` (its own step unless it says), each foe once. Episode 6’s defeat counts from the hold, so a Mauler beaten while the hangar is held counts, and `upto` brings in any of the six that never came (`foes.js` `spawnUpTo`). Episode 5’s second wave still counts only its own.
- **Episode 3 in either order.** Reach the school, then one step: four students caught (`source: 'mission'` only; the city’s own rescues send `source: 'city'`) and Doc Seismic down. With him down first, the roof gives up a student every 6 s (the mission’s `shake` out), so there is always someone to catch.
- **Episode 6 is a fight for the hangar.** A Mauler goes for the hangar door while Mark is over 60 m from it or over 30 m up (`foes.js` `pickTarget`), and its swings there cost the hangar 10 each; near him, it fights him.
- **Episode 4 can be won.** The race home's middle gate (`MOON.c × 0.34 + [0, RE/4, 0]`) was 54.8 km from the Earth's centre, inside the Earth (radius 60 km), and the line from it to the last gate dipped 9 km under the ground: past the re-entry height (7.5 km) he is back in the city's air, where space's gates can't be flown through. It is now 30 km up, a third of the way round from over the city toward the Moon; a test holds every gate and every line between them over the re-entry height.
- **Dead paths read.** Cecil’s portal is a radio call (`RADIO_CALLS.portal`, offered while nothing is fighting): taken with R, it is `invade('cecil')`, his recorded line with it. Eve says a word from `eveFight` as she goes for a foe near him; Dad greets him from the porch with `dadHome`. Eve’s race’s unread `ghost` flag is gone (her ghost is still under Left).
- **`--play`.** `scripts/inv-world-check.mjs --play ep1,…` (or `--play all`) runs `scripts/inv-world-play.mjs`: Mark steered through the dev hook (camera, held keys, punches, E as a key), never `api.feed`; episode 7’s last step is Think, Mark! played through its own hook and lost. An episode passes when the kept season says it is done.

`--play` times on this tree (game seconds; wall time in SwiftShader on the Windows desktop, Edge through playwright-core, low tier, 960 × 540, the game clock at three times speed outside the steps judged a frame at a time):

PLAYTIMES

## Left, in order

The plan’s tasks 2 to 14, as written there; done for each is its boxes ticked and its pull request merged.

2. The splits by the repair recipe: `InvWorld.jsx` (1,3xx lines) into `input.js`, `events.js`, `online.js`; `scene.js` into `spaceScene.js`, `villainScene.js`; `thinkmark/rules.js` into `bosses.js`; shots before and after with no pixel changed; the four over-budget low-tier shots (`maulers seismic everace photo`) under 1.5 M triangles.
3. The brawl (`brawl.js`: grab, throw, carry-slam, dive, block and counter, ground pound).
4. The city that breaks (`demolish.js`, `ruins.js`, the facade’s damage attribute, `tp-inv-world-ruins`).
5. Who you fly as (`heroes.js`, `powers.js`: Eve, Omni-Man, Thragg).
6. Episode 8, Where I Really Come From (the panels, the launch, the chase, the plaza, the sky).
7. The Guardians of the Globe and their hall.
8. Angstrom Levy and the dimensions.
9. The Sequids on Mars.
10. Battle Beast.
11. Thraxa and Talescria.
12. The clock, the weather, standing, the news helicopter (`heli.glb`).
13. Leaderboards (`boards.js`, `inv_times`).
14. Presentation (the words, season two’s cards, panels for every episode) and this hand-off rewritten.

Still open from part 2: Eve’s ghost on the line at her best time and Allen flying the race home; the Flaxans’ portal closing as episode 5’s second wave goes down (it should stay open until he flies through it); the bank model’s own lettering reads GDA; phone frame rate on hardware.

## Checking it

- `npx vitest run src/components/invincible`: the rules (205 tests in 15 files after Task 1).
- With a dev server up (`npx vite --port 5193 --strictPort --host 127.0.0.1`), from Git Bash on Windows: `BASE=http://127.0.0.1:5193 OUT=<dir> CHROME="C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" node scripts/inv-world-check.mjs [--metrics] [shot …] [--play ep1,ep2,…|all]`. On Linux the script’s default Chromium path stands and `BASE` defaults to port 5173. `PLAYSHOTS=1` with `--play` writes `play-<ep>.png` at each episode’s end.
- Shots: `spawn street curb streetnight downtown high suburb river boost porch gda burger school plaza plazanight burgernight schoolnight eve jet clouds rings card wallback rescue fight climb orbit orbitnight moon reentry allen mars thragg dusk night`; the missions framed through the hook (these still use `api.feed` to finish, as framing, not as a check): `bank chase seismic maulers gdasiege photo everace`; the stubs: `eveescort dadlesson porchdusk`.
- `--play`: `ep1 ep2 ep3 ep4 ep5 ep6 ep7`, one run a merge for every episode a task touches.
- Dev hook `window.__INVWORLD__ = { api, sim }`: `sim.h` the hero, `sim.yaw`/`sim.pitch` the camera, `sim.keys` what is held, `sim.punch` a punch, `sim.speedup` the dev clock, `sim.snap`, `sim.hold`; `api.setTime`, `api.zone`/`api.setZone`, `api.debug` (`npcs jet villains world bodies allen thragg dad`), `api.spawn(kind, n, at)`, `api.mission(id)`, `api.feed(event)` (framing only), `api.story()`. Think, Mark!: `window.__HQ__.thinkmark` (`state`, `view`, `begin(i)`, `setState(name)`).

## Deviations from the part-3 spec

- **The engine.** The spec says the world stays on the HQ games’ engine (`avengers/hq/engine.js`). Pull request #1021 (engine floor FL2, merged just before this lane began) moved Invincible onto the runtime and deleted that file; the world is a runtime module (`world/module.js`) drawn on the HQ stage. Nothing in this lane moves it further.
- **The hand-off’s file.** This file had been folded into `HANDOFF-worlds.md` on 2026-10-15. It is back as the lane’s own record, and `HANDOFF-worlds.md`’s Invincible paragraph points here.
- **`progress.kos` is a map, not a `Set`.** A `Set` of ids cannot tell episode 5’s first wave from its second; each entry keeps the step the foe went down in, and a defeat step counts from its `since`.
- **Episode 3’s roof.** Not in the spec: with Doc Seismic beaten first, nothing shook students off any more, a second soft-lock; the mission now asks for one every 6 s until four are caught.
- **Episode 4's middle gate** moved (it was inside the Earth): not in the spec, found by `--play`.
- **Cecil’s portal call** is the recorded line as it is (“Portal over the river. Flaxans again. Go.”), not “A portal, downtown. Now.”: the portal is over the river, and new words would need a new recording. It is a radio call that starts the invasion, not a mission.
- **`--play`** lives in `scripts/inv-world-play.mjs`, called by `inv-world-check.mjs --play`; episode 7’s Think, Mark! is lost on purpose (its hook’s `setState('hurt')`, then nothing pressed), since the last step takes either result.
- **This machine.** Playwright’s bundled Chromium is not installed here; the checks ran in Edge through `playwright-core` with SwiftShader, as the other Windows hand-offs do. `npm ci` needs `--ignore-scripts` here (`cpu-features` cannot find a compiler; nothing else has an install script). `npm test` on Windows fails about 110 tests in 20 files on main as well (path separators, 5 s timeouts under load, none in `src/components/invincible`); CI on Linux is the gate.

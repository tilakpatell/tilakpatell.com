# Hand-off: aboard the Death Star

The explorable interior of both Death Stars at `/deathstar/inside`, and HD exteriors for both stations. Branch `claude/deathstar-inside`, merged to main in stable checkpoints (a PR from `claude/deathstar-stable`, green CI, a merge commit): #564, #628, #650 and the one after them.

- Design: `docs/superpowers/specs/2026-10-07-deathstar-inside-design.md`
- Plan: `docs/superpowers/plans/2026-10-07-deathstar-inside.md` (seven phases; tasks numbered 1.1 to 7.4)
- Where it all lives: the `src/components/deathstar/inside/` entry in `docs/architecture.md`.

## Done

- Both stations, every room drawn by a builder of its own (`scene/rooms/index.test.js` holds that): the first station’s Bay 327 with the Falcon, Docking Control 327, the corridors and lifts, Detention Block AA-23, the cell bay and cell 2187, the chute and compactor 3263827, the maintenance corridors, the tractor beam’s terminal, the chasm with its telescoping bridge, the TIE bay, the conference room, the overbridge with Alderaan through its window, superlaser fire control, the records archive and Vader’s meditation chamber; the second station’s dock, command centre, Hangar 272, the tower’s antechamber and lift, the throne room with its spoked round window and the shaft in its floor, the reactor shaft, the gallery and the superstructure.
- The game (`rules/game.js` and `rules/play/`): the garrison in every room, the crew’s minds, bolts and blades for you and them, alarms and the intercom, disguise doubt, talk trees and keypads, the four story runs with checkpoints, companions, Easter eggs and achievements.
- The scene and the page: people, bolts, sparks, scorches, lightsabers, the windows’ views, the station’s sounds; the HUD with the story’s objective, the section’s security, the disguise meter, hit marks, the damage arc, the talk box and subtitles.
- HD exteriors: `death-star.hq.glb` and `deathstar2.hq.glb` (4096 maps), loaded on ultra only (`withHq` in `src/components/galaxy/models.js`); the window views use them on ultra too.
- Ways in: the `/deathstar` page’s “Go aboard”, the terminal’s `aboard` and `board`, and flying into the second Death Star at Endor once its shield is down (its dock, as a Rebel).
- `scripts/deathstar-check.mjs`: every room of both stations drawn in Chromium, screenshotted and held to the frame budget.
- The cast, made right (8 October; tilakpatell/tilakpatell.com#668, #680, #684; spec `docs/superpowers/specs/2026-10-08-deathstar-cast-design.md`):
  - Obi-Wan is the first film’s old Ben, `public/models/deathstar/obiwan.glb`, made with Meshy and rigged on the crew’s skeleton by `scripts/rig-transfer.mjs` (weights moved from `jedi3`). C-3PO is rigged again the same way from the officer (`deathstar/c3po.glb`), baked at rest first.
  - The black-clad crew and the Royal Guard are dyed (`lib/three/dye.js`, re-exported from `scene/dye.js`).
  - Everyone moves on `lib/three/animator.js`. `scene/people.js`’s `actOf` maps the rules’ poses, fights and hits to the library’s clips; the player crouches, aims, fires and strokes.
  - The dead fall as ragdolls: `lib/three/ragdollPhysics.js`, against the station’s floors and walls through `scene/fall.js`.
  - Lightsabres ride their owner’s right-hand bone.
  - Anyone between the camera and you, or a friend just ahead of you, is faded.
  - Companions stand on free floor round you. Anyone standing still shuffles out of a body’s way. Seat posts sit. Teleports land on clear floor.
  - `rules/route.js` routes to the story’s target; the HUD marker (`ui/waymark.js`) and the maps show the way. There are first-game tips and a Guide toggle.
  - Every story scene is drawn (`scene/cinematics.js`): camera shots on the story’s spots, actors’ clips, the Falcon and the Lambda flown, flashes, a letterbox. The rules hold you still while a scene plays.
  - A story’s end shows its card (`ui/End.jsx`).
  - Only the Empire’s people bark.
  - Standing and looking well round turns you on the spot.
  - The second station’s Rebel ending plays through: Vader is held up at Luke’s side through the carry, leaning on him and limping, and Luke only walks (`plot.js`’s `holdUp`). The station shakes and panels burst off the walls in fire and smoke while it comes apart (`rules/breach.js`, the camera’s shake in `scene/index.js`, a rumble in `scene/sounds.js`). At the ramp Vader sits for the mask with Luke kneeling, and lies there after the talk.
  - The chasm swing is drawn: Luke and Leia swing across on the grapple’s line (the `swing` act in `scene/cinematics.js`). A story that moves you (`{ to }`) brings your companions with you.
- The mechanics audit (9 October; `docs/superpowers/specs/2026-10-08-deathstar-mechanics-audit.md`):
  - E does every story step's work at whatever it names (`act.js`'s `stepAt`), on both sides. Checkpoints keep what you carry.
  - Routes leave from beside a box's corner and reach doors in a stair room's far wall. A leg along a door's own wall meets the door square. The way goes by doors you can open, then by a jump.
  - Your companions go through the doors you may, stoop under low lintels, and see the garrison as you do. Vader's prisoner (`prisoner`) walks unchallenged, and Vader leads him (the `lead` routine).
  - The camera stops at furniture and ships. Nobody is shot while a scene plays.
  - Blade and Force fighters duel you (`rules/play/duel.js`, on `saber.js` and `force.js`).
  - Every story can be finished with the keys alone: `DS_AUTOPLAY=1 npx vitest run src/components/deathstar/inside/rules/play/autoplay.test.js`.
  - The second round (the audit's findings 15 to 22): in free roam the consoles read out (`rules/play/readouts.js`), the whole crew talks (`rules/talks/crew.js`), the one you talk to stops for you, and E reaches where the camera looks. Seats can be sat in, and every sitter is drawn on the seat (`rules/seats.js`). Luke's saber leaves the armrest when it is taken.

## Left

- The final whole-branch review’s deferred minors, if any (the ledger at `.superpowers/sdd/2026-10-07-deathstar-inside/progress.md`, git-ignored, lists them).
- Alderaan’s tractor beam and Yavin still board the `/deathstar` page (the superlaser and the trench run), as before; the page’s “Go aboard” takes you inside from there.
- The IT-O, the dianoga and the Death Star trooper’s helmet are still built in code. `scripts/meshy-deathstar.mjs` will make them (122 credits); every Meshy account had 1 to 3 credits on 8 October.
- Voices for Tarkin, the Emperor, Jerjerrod, Motti and Tagge. Tarkin and Jerjerrod have sources in `scripts/voices/sources/warcast.json`, but the interior has no `voicelines.js` for the voices pipeline to read.
- Every scene’s shots have been judged by eye in headless Chromium. The tower lift doesn’t move while its scene plays: the camera stays on the four of you in the car.
- The game’s own second Death Star (Battlefront II lane E4’s follow-ups, `docs/superpowers/HANDOFF-bf2017.md`): DeathStar02_01 is walked as an Endor district, `endor/deathstar` (`src/components/galaxy/surface/sites/deathstar2.js`), up by the shuttle on the shield generator’s pad; its `dsi_*` walls, decks and ceilings are drawn by the game’s DSI master shader (`src/lib/three/surface/dsi.js`). This world’s rooms, kit and stories are as they were: the owner chose a district of its own over re-skinning the kit or re-laying the rooms on the game’s map. The kit could wear the DSI master’s look (its paint, plates and wear) the same way, if the owner wants the two to match.

## Checking it

- `DS_AUTOPLAY=1 npx vitest run src/components/deathstar/inside/rules/play/autoplay.test.js` plays all four stories start to end through `rules/play/autoplay.js` (a minute or two each). Run it after any change to the stories, the routes, the doors or the crew's minds.

- `npx vitest run src/components/deathstar/inside` for the rules, the scene’s pure parts and the module.
- `npx vite --port 5197` and open `/#/deathstar/inside?station=ds1&side=rebel&mode=roam` (or `station=ds2`, `side=imperial`, `mode=story`, `at=<room or spot>`). In development `window.__deathstar` has `g`, `view` (the scene and camera), `teleport(room, x, z)`, `do(name, arg)` and `info()`. To reach a story beat, import `rules/play/plot.js` in the page and call `startPlot(__deathstar.g, '<step id>')`: it starts from that beat’s checkpoint.
- `OUT=<dir> node scripts/deathstar-check.mjs [station:room …]` with the dev server up.

## Rulings made on the owner’s behalf

- Both stations in one world on `src/runtime`, not galaxy-surface zones (zones lack zone-to-zone doors, walls for enemies and bolts, more than four lamps, and lazy rooms).
- Third person over the shoulder, with a first-person switch on V.
- Ways in: the Death Star page, the terminal and Endor once its shield is down. Alderaan’s tractor beam and Yavin keep boarding the `/deathstar` page, so the superlaser and the trench run stay where players know them.
- Paths are A* over doors and lifts, straight inside each convex room and bent round furniture; no nav grid.
- The DS2 hull’s lattice gaps were plated over from N8’s own texture so it reads as the half-built station of the film; credited as such.
- Nested rooms (`inside: parentId`) let the Falcon’s smuggling hold sit inside Bay 327.
- The 4096 Death Star maps load on ultra only: about a quarter of a gigabyte of graphics memory between them.

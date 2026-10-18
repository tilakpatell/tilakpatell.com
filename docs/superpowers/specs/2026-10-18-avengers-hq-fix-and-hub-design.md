# Avengers HQ: fix, frame and hub

Date: 2026-10-18. Lane: Avengers HQ (`src/components/avengers/`, `src/pages/Avengers.jsx`). Status: design approved by Tilak in session, section by section; this file is for his review before the plan. Rests on `2026-10-04-avengers-hq-games-design.md` (the seven games and the stone heist), `docs/research/2026-10-05-web-swinging.md`, `2026-10-15-engine-floor-design.md` and `docs/health/RULES.md`. Written from `main` at `ddb364bf` (#1025).

## What the owner asked

“Make the entire Avengers site better. It sucks right now, and the Spider-Man game/world is good but can be much better. Also think bigger picture: we want more stuff and a better site and experience than just a 3D world.”

## Where this sits

The ask is four pieces of work, done in order, each with its own spec, plan and build (Tilak chose “all three directions, in order”):

1. **Fix and frame** (this spec): the broken games, one full-screen game screen with a way out and a way on, continuity between the compound and the buildings, and the code splits that every later piece needs.
2. **The hub** (this spec): links for every building, an ops board under the world that is also the no-3D view, records, an earned finale, the page put in order.
3. **The swing on the lawn** (next spec): momentum, a fixed step, wind and web sound, contextual prompts, touch camera, tour medals, stunts and a daily route, measured.
4. **An original district across the river** (the spec after): a swingable original city, streamed, with Thwip folded in as race routes. Gated on the numbers from piece 3 and a phone frame-rate measurement.

Pieces 1 and 2 share their parts (the game screen and the links meet at the door), so they are one spec.

## 1. What is there

Read off the code at `ddb364bf`, and a live run of the dev server in headless Chromium (SwiftShader) on 2026-10-18 at 1440 × 900, 1024 × 640 and 390 × 844.

- **One route, one long page.** `<Route path="/avengers">` (`src/App.jsx:439`). Top: the compound, a full-viewport 3D world you walk and swing round (`world/CompoundWorld.jsx`). Then a second intro, the world switcher, the Titan gauntlet, a soundboard of 16 clips, GIPHY scenes fetched at run time (`src/data/gifs.js`), credits, then photos (`src/pages/Avengers.jsx:153-288`). 9,587 px tall on a phone.
- **Eight doors.** `PLACES` in `world/rules.js` (`stark`, `thor`, `cap`, `hawkeye`, `widow`, `banner`, `spidey`, `vault`). Each opens `world/Place.jsx`: a fixed dialog with a header, a blurb, a stone pill, then a 16:9 box (`hq.css:3`, `min(78vh, 760px)`) holding the game in `hq/HQFrame.jsx`, and a “3D game: on/off” row under it. Seven of the eight win an Infinity Stone (`hq/stones.js`, `tp-hq-stones`); the gate (Thwip) has none.
- **No way in but walking.** Nothing reads a param or a hash under `src/components/avengers`. The command palette has one entry, filed under “Easter eggs” (`CommandPalette.jsx:146`); the to-do entries, the guide and the tour all go to the bare `/avengers`.
- **Winning is a dead end.** Every game’s win overlay offers a replay and nothing else (e.g. `repulsor/RepulsorRange.jsx:477-479`); the only exit is the dialog’s header button. Leaving re-reads the stones and nothing more (`CompoundWorld.jsx:88-91`).
- **The finale can be had for free.** `toggleStone` sets any stone by hand and Snap enables when six are set (`Avengers.jsx:131, 222-243`). Earning all six changes the clip, a flash and the dust cut, and raises a toast (`Avengers.jsx:136-151`).
- **Without 3D nothing can be won**, yet the copy promises stones (`CompoundWorld.jsx:664`). `earnStone` is called only from the 3D games; the toys in `Place.jsx:36-128` have no score, no fail and no stone; the Tesseract toy opens the portal without the Space Stone (`Place.jsx:114-121`).
- **The 3D switch is global.** `HQFrame.jsx:30` calls `three.set`, which is the site-wide `setMode3D` (`src/lib/gpu.js:118-124`), so turning a game’s 3D off drops the compound behind it to the 2D cards (`CompoundWorld.jsx:101-104`).
- **Broken or trivial games**, confirmed by simulating each `rules.js`:
  - Thwip wins with no input: he drops to the street, loses a heart and jogs at 9 m/s until 2,000 m (`thwip/rules.js:204-208, 307-311`); won at 220 s, seed 1. There is no “doing nothing loses” test.
  - Repulsor Range: Ultron Prime takes hits during its 9 s approach (`rayHit` and `beamStep` never check `arrived`, `repulsor/rules.js:236-253, 298-301`, against `378-386`), so a unibeam fired as wave 9 starts kills it before it attacks; the test pilot sees zero volley or summon events.
  - Trick Shot: rounds end when the quiver empties, after 11–16 s of a 45–55 s clock (`trickshot/rules.js:401`); the stone needs 250 points (`trickshot/rules.js:27`) against the spec’s 1,200.
  - Hold the Lawn: a loss restarts at wave 1, about 4.3 minutes from the boss (`HoldTheLawn.jsx:85-95`).
  - Ricochet: every room rebuild leaks geometries, cloned materials and canvas textures (`ricochet/scene.js:303-311`, allocations at 221-222, 229, 274-276).
  - Repulsor’s `start()` is not gated on the stage, so wave 1 and the voice run over a black screen (`RepulsorRange.jsx:88-98, 269`).
- **Small breaks.** “Things to do” can never pass 7/8: the gate has no stone so is never done (`world/rules.js:2094-2096`, `CompoundHud.jsx:29`). After Clint’s half, the list reads “Soul Stone: won back” (`world/labels.js:22-26`). The tour says six stones open the portal; only Space does (`tour/chapters/player.js:57` against `world/rules.js:2099`). `STONE_OF` is written twice (`Place.jsx:153`, `labels.js:19`) and stone colours are hex literals in each overlay.
- **Continuity.** A game’s code is fetched only once you are inside, then up to 4 s of warm-up (`hq/module.js:34`). Back from a game, `gl` stays `'on'`, so the loading veil never returns and the compound is a blank gradient until it redraws (`CompoundWorld.jsx:240-245, 629`).
- **Touch.** The games hide their key list on coarse pointers with nothing in its place (`hq.css:22`) and have no pause button.
- **Code.** `world/rules.js` (2,139 lines) and `world/scene.js` (2,156) are over the 1,500-line ceiling (`RULES.md`). The page’s static closure carries 605 kB raw (79 kB gzipped) of Battlefront data it never uses, through `CompoundHud.jsx:3` importing the `src/runtime/hud/index.js` barrel, which re-exports `Screen` and `ScreenCanvas`.

What is good and stays: the swing model, the tested and seeded rules of every game with their bots and solvers, the one runtime renderer, the compound kept in memory while a game plays, the twelve backpacks, the tour with its ghost, photo mode, the online holograms.

## 2. The decisions

Made by Tilak in session on 2026-10-18:

- **Scope:** all four pieces, in order. This spec is pieces 1 and 2.
- **Structure:** links over a kept world. `/avengers` still opens on the 3D compound; an ops board sits under it and is the first screen without 3D; each building has a link that opens its game full-screen over the compound, which stays loaded.
- **No 3D:** Ricochet and Infiltration, whose rules are already flat, get a 2D view that wins their stones on any device; the other games say plainly that their stone is won in 3D, with a button to try it. The full heist still needs 3D.
- **The finale:** the snap on `/avengers` unlocks only with stones won in play; Titan’s scene stays as it is, with a heist summary over the dust. The free click-to-set gauntlet stays on the classic page’s interests card.
- **Below the world:** the soundboard, the GIPHY scenes and the photos stay on the page, collapsed under one closed “Archive” section. The GIPHY embeds are kept as they are.

## 3. Rules this work keeps

- **No new depictions of Marvel characters, suits or marks**, drawn in code or generated. Nothing in this spec draws a figure: the 2D views are abstract markers, the board and the records are text and the stones’ existing colours, the heist summary is text over the existing scene. The credited models are only posed and moved, as `HANDOFF-worlds.md:138` says. In later pieces, a game whose code-drawn Marvel figures or marks are reworked gets original designs in their place, not a polish.
- **Worlds are islands; layers as `RULES.md` draws them.** Nothing here adds a cross-world import. The ops board reads `avengers` modules; the 2D views live in their game’s folder.
- **`avengers/hq` is shared.** Invincible (23 imports), Mario 64 (`hq/assets.js`) and the Marvel landing read it; `shared/runtime.js` pins five names. Any change under `hq/` keeps their screenshots identical (`scripts/inv-world-check.mjs`).
- **Splits by the barrel recipe** (`RULES.md:21-32`): the old path becomes a barrel with the same export names, no caller changes in the same PR, before and after screenshots pixel-identical.
- **Pure, seeded rules with tests beside them**, each under one second, no network. No test is loosened, skipped or deleted.
- **One runtime renderer, one live 3D view a page.** No new renderers or animation loops; the HQ modules stay `'glsl'` until their FL3 port, which is the FL2 session’s.
- **HUD from `src/runtime/hud`**: numbers through refs, keys written once in `guide/pages.js`, nothing under 0.7 rem, kit touch sizes. Open draft #1028 edits `guide/pages.js` and `runtime/hud/*`: rebase on it or coordinate before touching those files.
- **Nothing a visitor has is lost.** Every `tp-hq-*` key keeps its name and shape; new fields are appended; every achievement, sound, ghost and dev hook (`__HQWORLD__`, `__HQ__`) keeps working.
- **Copy:** British spelling, curly quotes, sentence case, no Oxford comma, the key first in prompts.

## 4. Links and navigation

- The route becomes `/avengers/:place?`. `pageKey` in `src/App.jsx` maps every `/avengers…` path to `'/avengers'`, as it does `/middle-earth`, so the page and the compound stay mounted while a game opens and closes.
- Links are named for places, not people. One table, `world/links.js`, pure, tested:

  | link | place id | game |
  | --- | --- | --- |
  | `/avengers/workshop` | `stark` | Repulsor Range |
  | `/avengers/lawn` | `thor` | Hold the Lawn |
  | `/avengers/training` | `cap` | Ricochet |
  | `/avengers/range` | `hawkeye` | Trick Shot |
  | `/avengers/operations` | `widow` | Infiltration |
  | `/avengers/lab` | `banner` | Smash Run |
  | `/avengers/gate` | `spidey` | Thwip |
  | `/avengers/hangar` | `vault` | Tesseract Run |

  `linkOf(id)` and `placeOf(slug)`; an unknown slug gives `null` and the page replaces the address with `/avengers`.
- `CompoundWorld` takes its open place from the route instead of from local state. Going through a door pushes `/avengers/<slug>`; Back (the button, Esc or the browser) goes back. When the game was opened from outside the page (a shared link, the palette), Back replaces with `/avengers` rather than leaving the site.
- A cold deep link opens the game at once over a compound that loads behind it (or over the board, without 3D). The game does not wait for the compound.
- The command palette gets one entry per game under Worlds (“Avengers HQ · Ricochet”), and the bare “Avengers HQ” entry moves out of “Easter eggs”. The to-do entries, the guide’s `/avengers` page and the tour chapter link to the building they talk about.
- The portal still jumps down to Titan (`Avengers.jsx:113-128`), and opens only with the Space Stone, in every mode: the Tesseract toy stops opening it for free.

## 5. The game screen

`hq/HQFrame.jsx` grows into the frame the 2026-10-04 spec called `HQGame`. Invincible imports `HQFrame` directly (`invincible/thinkmark/ThinkMark.jsx:2`), so the new frame is a new file, `hq/HQGame.jsx`, built on `HQFrame`, and `HQFrame` keeps its props and its picture.

- **Full screen.** The game fills the viewport under a slim bar: the place’s name, Pause, Back (Esc). `Place.jsx`’s blurb and stone pill move into the game’s own start overlay, so Start is in view at 1024 × 640 and at 390 × 844. `.hq-screen` takes the height left under the bar instead of a 16:9 box.
- **A 3D switch for this game only.** The frame keeps its own `local3D` choice (`'auto' | 'on' | 'off'`), stored per game, and stops calling `three.set`. Where a 2D version exists (Ricochet, Infiltration) the switch says “Play in 2D”; elsewhere, without 3D, the frame shows the toy and one line: “The stone here is won in the 3D game.” with “Try 3D”. The site-wide switch stays in Settings only.
- **Touch.** On a coarse pointer the start overlay shows the touch controls in words and icons in place of the hidden key list. Every game gets the Pause button in the bar, and pauses when the tab is hidden.
- **One results card.** `hq/Results.jsx`, used by every game on win and on loss: the stone won (or the half), score against best, stars or medals where the game keeps them, and three actions: Play again, Back to the compound, Next: <building> (`progress(heist).next`, as its link). The games keep their own overlays for title and pause; their win and loss overlays hand over to the card.
- **Coming back.** On leaving with a new stone, the HUD’s stones chip pulses and a toast names the next building (`runtime/hud` `Toast`).
- **Loading.**
  - When the visitor is within 15 m of a door (`nearPlace`, `CompoundWorld.jsx:501`), `Place` and that game’s module are imported and the module’s `warm()` runs, so the door opens without a cold fetch.
  - On leaving a game, the compound shows its loading veil until its first frame after the return has drawn.
  - Repulsor Range does not start wave 1 until its stage is `'on'`.

## 6. The ops board and records

- **Where.** Directly under the compound, and as the first screen without 3D. It replaces the second intro (`Avengers.jsx:158-172`) and the no-3D cards view (`CompoundWorld.jsx:656-707`). Without 3D, the isometric map (`Compound.jsx`) stays at the top of the view and its pins scroll to their cards.
- **One card a building, eight in all.** The place and the game’s name; its stone (won, half won, or “won in 3D” with “Try 3D”); the best from the key the game already writes (`tp-hq-repulsor-best`, `tp-hq-lawn-best`, `tp-hq-ricochet`, `tp-hq-trickshot-best`, `tp-hq-widow-level`, `tp-hq-smash-best`, `tp-hq-thwip-best`, `tp-hq-tesseract-best`), stars or medals where the game keeps them; Play (its link); Go there (to the door in 3D, hidden without 3D).
- **A records strip at the top of the board.** Stones out of six, the tour’s best (`tp-hq-swing-tour`), best style (`tp-hq-style-best`), backpacks out of twelve (`tp-hq-packs`), the Avengers achievements earned (`Achievements.jsx:213-226`). Read through `runtime/saves` `register` with each key’s current name and shape.
- **Things to do reaches 8/8.** The gate counts as done once Thwip has been won (its `spidey` achievement), and the HUD’s count and the board read the same `progress()`.
- **The page under the board:** the world switcher, then Titan, then one “Archive” section (`<details>`, closed by default) holding the soundboard, the GIPHY scenes and the photos, then the credits last.

## 7. The heist and the finale

- **The snap is earned.** On `/avengers` the gauntlet shows the stones won in play (`earnedStones()`) and cannot be toggled. Locked, it says how many stones are left and links to the next building. All six won: Snap plays Tony’s snap as today.
- **The classic page keeps the free gauntlet**: the click-to-set one on the interests card (`interests/cards.jsx`) is not touched.
- **A heist record.** A new key, `tp-hq-heist`, registered with `runtime/saves` at version 1: `{ stones: { [id]: firstWonAt }, tries: { [game]: n } }`. `earnStone` writes the time a stone is first won; each game’s start writes a try. Old visitors who already hold stones get `firstWonAt: null` for them, and the summary says “before records began” for those.
- **The summary over the dust.** When the earned snap plays, a text panel on glass rises over Titan’s dust: time from the first stone to the sixth, tries per game, the best score per game. Titan’s scene is unchanged.
- **Copy fixes:** the “army” line matches the one figure on screen (`Avengers.jsx:148, 219`); the tour says the Space Stone opens the portal; a half of the Soul Stone reads as a half (`labels.js`); the no-3D lead stops promising stones for toys.

## 8. Two games in 2D

For visitors without 3D, or who pick “Play in 2D”. Each is an SVG view over the game’s own `rules.js`, in its own folder, stepped by the same fixed step the 3D game uses, and awards its stone through `earnStone` exactly as the 3D game does.

- **Ricochet 2D** (`ricochet/Flat.jsx`): the room from above. Steel walls are solid lines, mats are hatched, glass is dashed, switches and doors are small toggles, bots are squares (armoured bots double-outlined), the hostage dummy an open circle. The thrower is a chevron and the thrown disc a plain disc in the game’s accent colour. Aim by dragging from the thrower or with the arrow keys; the preview line comes from `simulateThrow` with the same length the 3D game gives that room; Space or release throws. Stars and par as in 3D, saved to the same `tp-hq-ricochet`.
- **Infiltration 2D** (`widow/Flat.jsx`): the level’s grid. Guards are triangles with their sight cones shaded, the player a filled chevron, lasers lines that blink on their cycle, cameras wedges, terminals, the file and the exit simple icons. Move by tapping a neighbouring tile or with the arrow keys; Widow’s Bite by a button then a tile. The danger preview (“this step gets you caught”) shows on hover and on first tap for touch, with a second tap to commit. Saved to the same `tp-hq-widow-level`.
- Both: keyboard playable, a `role="status"` line, `prefers-reduced-motion` respected, the results card of §5.

## 9. Fixes, each with a test

- **Thwip: doing nothing loses.** The bell (`BELL`, 100 s, `thwip/rules.js:28`) becomes the limit: today reaching school after it still wins, with `onTime: false` (`thwip/rules.js:307-311`); after this, the bell ends the run as a loss (“Late for school”). The idle jog reaches 2,000 m at about 220 s, so it loses. Tests: no input loses on every seed; the existing autopilot (48–56 s) still wins. The hold-the-button exploit is piece 3’s, with the Thwip swing model.
- **Repulsor Range: Prime arrives before it can be hurt.** `rayHit` and `beamStep` skip Prime’s parts until `arrived`. Test: the test pilot’s run sees at least one volley and one summon before Prime dies.
- **Ricochet: no leak.** `build()` disposes what it made: wall, lid and switch geometries, cloned materials, door light materials, canvas textures. Test: `renderer.info.memory` is the same after ten room rebuilds as after one (in the DEV hook, checked by the browser run).
- **Trick Shot: a round lasts its clock.** The quiver is sized so the noisy-archer bot is still shooting when the clock ends, and the stone’s threshold is set from the bot’s score distribution so a fair player wins it in two or three tries. Test: the bot’s rounds last at least 40 s; doing nothing loses; the bot wins the stone on most seeds.
- **Hold the Lawn: a checkpoint at the boss.** After the boss wave has been reached once, a loss offers “Restart at the boss”, starting the boss wave with five hearts and lightning empty. Kept in a new key, `tp-hq-lawn-boss` (`true` once reached); the existing lawn keys are untouched. Test: a game started at the checkpoint opens on the boss wave; doing nothing there still loses.
- **Repulsor Range: start waits for the stage** (see §5).
- **One stone table.** `STONE_OF` lives once, in `world/labels.js`; stone colours come from `interests/stones` `STONES` rather than literals; a `:disabled` button style in the HQ CSS.

## 10. Code health, first

- Split `world/rules.js` and `world/scene.js` by concern under the barrel recipe: `rules.js` into the plan (`PLACES`, `CAST`, `PORTAL`, the grounds’ data), the hero step, aim and anchors, the tour and laps, progress; `scene.js` into the grounds, the buildings, the doors and gems, the cast, the effects. Same exports from the old paths, no caller changes, pixel-identical before and after shots with `scripts/hq-world-check.mjs` and `docs/superpowers/evidence/engine-floor/FL2-avengers/tools/hq-shots.mjs`.
- Stop the HUD barrel pulling Battlefront data into the page: `CompoundHud.jsx` imports the kit parts it uses from their files, not the barrel. Measure the `/avengers` closure before and after from the build manifest. If the barrel itself should stop re-exporting `Screen`, that is a change to `runtime/hud` and goes through #1028’s owner.

## 11. Order of work

One PR each, merged in order, every one green:

1. The splits and the HUD import (§10). No visible change.
2. The fixes (§9).
3. Links and navigation (§4).
4. The game screen (§5).
5. The ops board, records and the page’s order (§6).
6. The heist record, the earned snap and the summary (§7).
7. Ricochet 2D and Infiltration 2D (§8).

## 12. How it is checked

- **Vitest:** `links.js` both ways and unknown slugs; `progress()` reaching 8/8; the heist record’s writes and its migration from no key; the snap’s gate; a scripted player winning Ricochet room 1 and Infiltration level 1 through the 2D views’ controllers on the real rules; Thwip’s idle loss; Prime’s attacks before its death; Trick Shot’s round length and stone rate.
- **In the browser** (`scripts/autopilot-check.mjs --before` on `main`, then `--routes /avengers,/invincible --shots` and `--phone`; `scripts/hq-world-check.mjs`; `scripts/inv-world-check.mjs` whenever `hq/` changes): every link opens its game and Back closes it; Start is in view at 1024 × 640 and 390 × 844; the per-game 3D switch leaves the compound in 3D; with 3D off, the Mind Stone is won in 2D; returning from a game shows the veil, then the compound; no console errors.
- **Before each PR is done:** `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`; `git checkout public/github.json` after a build; the screenshots read, and the closure’s size stated in the PR.

## 13. Not in this spec

Left for piece 3 (the swing on the lawn): swing momentum, fixed step, wind and web sound, contextual prompts, pointer lock, touch camera and the phone HUD, tour medals, stunts, a daily route, the Thwip swing model. Left for piece 4: the original district. Left for later passes on the games: Repulsor’s wave lengths and auto-aim, Smash Run’s late game, Infiltration’s par, stars and undo, Tesseract’s medals, music and ambience beds, the mannequin figures (replaced with original designs when a game is reworked), the dead Meshy manifest request (`smash/meshy.js:27-33`).

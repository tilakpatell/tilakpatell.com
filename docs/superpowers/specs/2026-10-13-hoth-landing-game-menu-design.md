# Hoth lands in the game's menu, with the level loading behind it. The design

Date: 2026-10-13. Status: **approved by the owner on 2026-10-13, with his answers to its three open questions written in below; no code written yet.** It follows the flow design (`2026-10-10-battlefront-flow-and-mods-design.md`) and the deploy-flow design (`2026-10-11-galactic-assault-bf2017-flow-design.md`), and replaces that design's decision 1 route and its waiting screen. Lane: the game's UI (branch `claude/bf-landing-menu`, after the Collection's screens, PR #961).

## What the owner asked

- 2026-10-12, 23:20: “revamp the current loading system and all garbage. When we fly to a planet and land it should launch the game UI that the forked session is making and allow all the instant action features”.
- 2026-10-13, on the first sketch of this design: “Do only hoth for now we plan to port everything but just hoth rn to make it perfect and then apply to the rest once hoth is done (for star wars galaxy).” On the old waiting screen's day picker, machine line and quality button: “Delete all of it.” Then: “get rid of surface world section” and “I think galaxy hit planet and go to menu where everything is loaded is much better”.

- 2026-10-13, on this design: “land in main menu and then we can choose the setup etc. Just delet hoth's old surface (bascially the landing thing) eventually we will add a free roam mode with infinite hoth generation (some logic might still be there). 3 keep the crash and land action as triggers. approved and use REA for the battlefront 2 game and binary do this to make sure its accutate not just frosty export. It needs to be accurate”. Then, of the running game: “this version doesnt have instant action mod loaded”, “So this is vanilla and might be diffferent but look at GUI and code”.

Read as: on Hoth, the galaxy goes from the planet straight to the game's menu; the level loads behind that menu, so Play starts at once; the site's own surface world and its own loading layers are no step of that path any more. Every other planet is left as it is until Hoth is right.

## What was found (read 2026-10-13, branch `claude/bf-ui-collection-screens` at e2a856942)

- **Two worlds load, one after the other.** Flying into Hoth (`pages/Galaxy.jsx`, `onCrash` and `land`) goes to `/galaxy/hoth/surface`. That page builds the site's own Hoth surface (`components/galaxy/surface/`), then shows the site's “Choose your battle” menu (`surface/ModeMenu.jsx`). Galactic Assault there goes to `/battlefront/hoth/galacticAssault?from=/galaxy/hoth` (`surface/modes.js`, `BATTLEFRONT`), which builds the second world, the game's level.
- **Three layers stand over the load that are not the game's.** The surface's landing screen, the mode menu, and the Battlefront world's waiting screen (`battlefront/WaitingScreen.jsx`, 172 lines, and `waiting.css`): a day picker, the machine's line, a quality recommendation with an Apply button, a class list and Deploy.
- **The game's own screens are already on the site** (`battlefront/screens/`): Start, the main menu, Play, the Collection, the loading screen (`Loading.jsx`: the planet's film, a hint, the bar), the spawn screen (`Spawn.jsx`), the in-game menu, the kill screen and the end of round. The front end runs at `/battlefront` with no world behind it.
- **The game's Instant Action setup screen is in the data and not drawn yet**: the tree `UI/Frontend/Screens/Play/InstantAction/InstantActionSettingsScreen` and its widgets (`InstantActionSideSelector`, `InstantActionSettingsListCellSelector`, `InstantActionOptionsListCellSlider`) are in `src/data/bf2017/screens.json`.
- **The options exist as data on another session's branch** (`claude/bf-instant-action`, c84c3d372, session tilak-a6): `src/lib/battlefront/instantAction.js`, `optionsFor(settings, { rulebook, level })` gives ten options (mode, era, difficulty, length, Battle Point rate, heroes, reinforcements, vehicles, friendly bots, enemy bots), each a choice, a toggle or a count, from the game's own settings rows. Today the sim acts on the bots' counts, the era, the difficulty, the Battle Point rate and the reinforcements; the rest is carried on the round for later lanes.
- **A new round means a new world today.** The page mounts the world again when the level or the mode changes (`BattlefrontWorld.jsx`, `rebuild: level/mode`), and `world.do('instantAction', options)` answers with props to mount with. Mounting again throws the loaded level away.
- **The world already loads behind a cover.** Until the first deploy the camera is parked at the spawn and the level streams and its shaders build behind the waiting screen; `waiting.js`'s `readiness()` says when nothing is left to build. That rule is pure and stays.
- **The Instant Action Overhaul V2 mod is extracted** (`bf2-re/data/mods/iao-v2/`, 44,126 resources) but its options are not yet summarised (bf2-re findings 53 has not landed).
- **Only Hoth has a game level** (`battlefront/index.js`, `LEVELS = ['hoth']`).
- **The load today, measured by the frame-time lane** (session tilak-19, 2026-10-13: headless Edge on the RTX 5090, WebGPU, 2560×1440, the dev server, a shared machine, so sizes and not exact figures). From the address to the level loaded: 22 to 40 s, with one gap between frames of 3.4 to 3.6 s in each of two runs (not yet traced to a function), 75 to 85 gaps over 100 ms, and a 95th-percentile gap of 120 to 130 ms. On the waiting screen with the level loaded, one run in five held 10 frames a second for 22 s; no cause found. In play, frames of 85 to 155 ms in the first ten seconds after a deploy, while three builds shaders in slices (that lane first reported a 0.4 to 1.0 s gap in every walk, and then found it was its own profiler starting). The HUD's React work is about 0.6 ms a frame and is not the cost.
- **The built site's load, and its freeze found** (the same lane's five runs on `vite preview`, then this lane's CPU profile, 2026-10-13): one gap of 2.7 to 4.6 s, where the dev server's was 0.6 s; and on the waiting screen after the level has loaded, about 11 frames a second for 7 to 13 s. The gap was three building the shaders of a soldier's first cut in order to dispose them when the level's cut landed: 2,535 ms in one call chain. It is fixed in pull request #964 (`src/lib/three/pipelineGuard.js`): on the same branch built with and without the fix, the longest gap went from 2,763 and 2,693 ms to 442 and 426 ms. The 11 frames a second is the guard's queue of shader builds draining, three or four builds of 40 to 90 ms to a frame; with a menu over the world that is the menu's frame rate too, which is why decision 9 is a thing to measure and decision 10 a thing to build.

## The running game, photographed (2026-10-13, the owner's EA install, build 1.0.117.50617, no mod loaded)

The owner had the game open. Its window was photographed from outside (nothing read from its memory), and its menus walked by two clicks. The pictures are on the desktop at `.scratch-check/out/game/` in this lane's worktree; they are not in the repo because they show the owner's account name. What they show, which the export alone did not settle:

- **The main menu's tabs**: HOME, PLAY, COLLECTION, CAREER, OPTIONS.
- **PLAY's three tiles**: MULTIPLAYER, CO-OP MISSIONS, SINGLE PLAYER. The site's Play screen names the third one Campaign. Each tile: a line drawing, the name in Aurebesh over the name, a description, the player count at the foot.
- **SINGLE PLAYER's three tiles**: CAMPAIGN, INSTANT ACTION, ARCADE, under the breadcrumb PLAY / SINGLE PLAYER, with a BACK button at the foot. The tile under the pointer glows yellow.
- **The Instant Action setup screen** (breadcrumb PLAY / SINGLE PLAYER / INSTANT ACTION). A list on the left in two groups. GAME MODIFIERS: MODE (◀ SUPREMACY ▶), LOCATION (HOTH), AI DIFFICULTY (ROOKIE), ROUND LENGTH (MEDIUM). ADVANCED SETTINGS: BATTLE POINTS (◀ DEFAULT ▶), then sliders with their number: ENEMY AI COUNT, FRIENDLY AI COUNT (20 each as set), ENEMY HERO COUNT, FRIENDLY HERO COUNT (2), ENEMY REINFORCEMENT COUNT, FRIENDLY REINFORCEMENT COUNT (4), ENEMY VEHICLE COUNT, and rows below the fold not yet seen. The enemy's row comes before the friendly one. A help line under the list (“Select gamemode.”). In the middle a panel: the level's name and words, the side's emblem, the player's name and side. On the right the planet. At the foot: PLAY, RESET TO DEFAULTS, CHANGE FACTION, BACK. The values seen may be the owner's own and not the defaults.
- **The loading screen**: the planet's film over the whole screen; at the top left HOTH, under it OUTPOST DELTA, under that the mode's words; a hint in a yellow glowing box with a notch; a small striped mark at the bottom right. One frame was caught, and no bar or percentage is in it (the load took under three seconds on this machine).
- **The first spawn screen** (“PREROUND: EQUIP AND UNLOCK CARDS” at the top): at the top left a panel with the class in Aurebesh and in capitals, its level badge, three card slots, EQUIP CARDS, the weapon's name and drawing, EQUIP WEAPONS. At the bottom left one strip: the four classes as tiles with their icons (the chosen one ticked), then a grid of ten portraits, two rows of five, hatched while their Battle Points are not earned, with the Battle Points over its right end. At the foot: SELECT, VIEW ABILITIES, APPEARANCES. The chosen character stands on the right, large, in the dark room. The site's spawn screen is a column of rows down the left and no character.

From the binary (`bf2-re/data/dump/live.exe`, the image an earlier session took from the same install): a scan of its plain strings finds Instant Action named three times only (`mode8`, `Mode8`, `ExitToMenuTarget_InstantAction`). So the setup screen's options are data, read from the game's records, and no list of them is in the code. REA's Ghidra string search on that 239 MB image did not finish in its 330 s limit; the scan was a plain read of the file.

## Decisions

1. **On Hoth the galaxy goes from the planet to the game's menu.** Flying into the planet and the Land action both go to `/battlefront/hoth?from=/galaxy/hoth`. Nothing of the site's surface world is fetched or built on the way.
2. **Hoth's old landing is deleted.** `/galaxy/hoth/surface` goes to the game's menu (a redirect, so old links and the galaxy panel's tiles still work), and what only that landing used goes with it: Hoth's row in the surface's mode menu, its hand-over from the galaxy, its landing screen. The code that makes Hoth's ground (the terrain and its generation) stays in the tree for the free-roam mode the owner plans (an endless Hoth), though nothing reaches it until then. The other planets keep their surface and their menu, untouched.
3. **One world for the visit, mounted with the menu.** `/battlefront/hoth` mounts the Battlefront world at once and draws the game's front end over it. The level streams and the shaders build while the player is in the menus. The world is made once for the level; the mode and the options no longer make it again (decision 6).
4. **The menu the player lands in is the game's main menu**, past the Start screen (the player has already arrived), and the way from it is the game's own: PLAY → SINGLE PLAYER → INSTANT ACTION, with the breadcrumb the game draws. The Play screen's third tile becomes SINGLE PLAYER, as the game has it, and opens the game's three tiles (Campaign and Arcade marked “not in this world yet”). COLLECTION is beside PLAY. The way back to the galaxy is the menu's own back.
5. **Instant Action's setup is the game's own screen**, drawn from its tree and laid out as the running game draws it (above): the two groups, a choice as ◀ value ▶, a count as a slider with its number, the enemy's row before the friendly one, the help line, the level's panel, the planet, and the foot's PLAY, RESET TO DEFAULTS, CHANGE FACTION and BACK. Its options are read from `optionsFor()` so the screen holds no list of its own, and where that list and the running game differ, the game is right and the difference goes to the sim's lane. Every option the game has is shown. One the sim does not act on yet is shown and marked “not in this world yet”, as the front end already marks its tiles. Limits shown as they are: the player's side is the Empire, the era is the original trilogy's, the level is Hoth.
6. **Start begins the round in place.** The setup's Start sends the options to the world, which makes the round's sim again and keeps the level, its light, its shaders and its bodies. This needs one new action in the sim's lane (below). Until it lands, Start mounts the world again with the options; the browser's cache keeps the level's files, so that costs the build and not the download.
7. **After Play, the game's order and the game's pictures.** If the level is not ready, the game's loading screen as photographed (the film, the planet's name, the map's name, the mode's words, the hint in its box, the mark at the bottom right; the site's percentage line goes, and a bar is drawn only if the game's tree for the screen holds one) until `readiness()` says ready. Then the game's first spawn screen as photographed: the class panel, the strip of classes and portraits, the foot's buttons, and the chosen character standing on the right (the hero stage the Collection already uses). Deploy runs the game's wipe into the field.
11. **Three sources for every screen.** A screen is built from its tree in the export, checked against a picture of the running game, and where code decides something the tree does not say, read from the binary with REA. A difference found is written into the pull request with the picture or the address.
8. **The site's waiting screen is deleted**, and with it the day picker, the machine's line and the quality recommendation with its button. The game's coin picks the day, as the game does. Nothing replaces them on the way in. (The video settings in the site's Menu are not part of this and stay.)
9. **The menu must answer while the level loads.** A click or a key in the menu is answered within 100 ms throughout the load. Today's load does not allow that (the gaps above), so phase 1 traces the 3.5 s gap and the gaps over 100 ms to the work that makes them and splits or moves that work; what belongs to the render path goes to the frame-time lane with the trace. The target is checked, not assumed (see Checks).
10. **What the player will see first is built behind the menu.** The bodies of the round and the materials of the cells round the spawn are warmed before Start is offered, so the walk's late shader builds (0.4 to 1.0 s) do not land in the first life.

## The flow, step by step

| step | what the player sees | what loads |
| --- | --- | --- |
| 1 | The galaxy; the ship reaches Hoth | On approach: the Battlefront page's code and the front end's (a prefetch, as the surface has today) |
| 2 | The screen washes out (700 ms, as now), then the game's main menu | The world mounts behind the menu: the level streams round the spawn, shaders build |
| 3 | PLAY → Instant Action → the setup screen | The settings' rows (68 KB); the level goes on loading |
| 4 | Start | The round's sim is made (in place) |
| 5 | If not ready: the game's loading screen. Then the spawn screen | Whatever is left |
| 6 | Deploy: the wipe, the field | Nothing |

## What goes

- `battlefront/WaitingScreen.jsx`, `waiting.css`, `WaitingScreen.test.jsx`; in `waiting.js`: `recommend`, `machineLine`, `recommendationLine` and `COIN` (kept: `readiness`, `pickVariant`, `WIPE`, `arrivalExposure`, `stopsFrom`, which the world and the loading screen use).
- In `BattlefrontWorld.jsx`: the waiting phase, the day's state, the machine and recommendation lines, the plain “Bringing Hoth in” fallback line.
- In `surface/modes.js`: the `BATTLEFRONT` row for Hoth and its card. In `pages/Galaxy.jsx`: Hoth's two ways down no longer prefetch or hand over to the surface.
- Not deleted: the surface world's code, which every other planet uses, and the making of Hoth's ground, kept for the free-roam mode (decision 2).

## What other lanes are asked for

- **The sim's lane (tilak-a6, `claude/bf-instant-action`)**: one action, `world.do('round', options)` → a promise of `{ ok, round }` or `{ ok: false, why }`, which replaces the battle's sim in place and leaves the level and everything drawn as it is. Its `instantActionSchema` and `optionsFor` are used as they stand.
  - That lane's answer (2026-10-13): feasible, not small, not built. `battle.js` is ready for it (`createBattle` is a pure constructor; the first battle's `nav` passed back in keeps the grid). The work is in `module.js`: its `sim` is held by a dozen closures and must become a battle that can be bound again, and everything that mirrors the old one is cleared at the swap (the figures and their ragdolls, the bolts and the kit's drawing, the sound director's state, the player, and the camera back to its parked pose). The level, the light, the post chain, the physics world and the built shaders stay.
  - Its risk: a round may draw bodies the first battle did not (another class or side), fetched and their shaders built at Start, so the round's first seconds can hitch. So the setup screen warms the bodies of the round it shows before Start is offered (phase 3).
  - Its order: the same hunks of `module.js` are touched by this lane's front-end wiring and by the heroes' lane, so one session makes the change, after phase 1 has landed.
- **The frame-time lane (tilak-19)**: nothing asked. It is sent the numbers from Checks, 3.

## Phases, one pull request each

| phase | what | gate |
| --- | --- | --- |
| 1 | Hoth's two ways down go to `/battlefront/hoth`; the page mounts the world behind the game's main menu; Play still leads to Galactic Assault as today; the waiting screen is deleted and the first life uses the loading and spawn screens; `/galaxy/hoth/surface` redirects | the tests of `battlefront/`, `pages/`, `galaxy/surface/modes`; Checks 1 to 4 |
| 2 | PLAY → SINGLE PLAYER → INSTANT ACTION as the game has it; the setup screen on the game's tree, from `optionsFor()`; Play mounts again with the options | the screens' tests; the site's screen beside the game's picture; a walk in the browser: every option changes the round it starts |
| 2b | The loading screen and the first spawn screen as the game draws them (decision 7) | the screens' tests; each beside the game's picture |
| 3 | Start in place (`world.do('round')`, made by one session after phase 1); the round's bodies warmed before Start; the approach's prefetch | Check 2 again: Start to spawn screen, and the first five seconds of the round with no frame over 50 ms |
| 4 | The Instant Action Overhaul V2's options on the same screen, when bf2-re findings 53 names them | the screen's tests |

## Checks (headless Edge on the desktop, 2560×1440, the bucket's base set, numbers written into the pull request)

1. **One world.** From the galaxy into Hoth, the network log holds no request for the surface world's pack or models, and the runtime makes one world.
2. **Times.** From the hit to the menu drawn; from the menu drawn to `readiness().ready`; from Start to the spawn screen. Before (today's path, both loads) and after, on the same machine in the same hour.
3. **The menu answers.** While the level loads, the longest main-thread task and the time from a key press to the next frame, with the target of decision 9.
4. **Nothing of the old layers is left.** No `bf-waiting` element in the page; the day is the coin's.
5. The repo's own: `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`.

## Answered by the owner (2026-10-13)

1. **The first screen**: the main menu, and the setup is chosen from there (decision 4).
2. **Hoth's old surface**: its landing is deleted now; the ground's generation stays for a later free-roam mode (decision 2).
3. **Hitting the planet**: the crash and the Land action stay as the two triggers (decision 1).

# Hoth lands in the game's menu, with the level loading behind it. The design

Date: 2026-10-13. Status: **design for the owner's review; no code written yet.** It follows the flow design (`2026-10-10-battlefront-flow-and-mods-design.md`) and the deploy-flow design (`2026-10-11-galactic-assault-bf2017-flow-design.md`), and replaces that design's decision 1 route and its waiting screen. Lane: the game's UI (branch `claude/bf-landing-menu`, after the Collection's screens, PR #961).

## What the owner asked

- 2026-10-12, 23:20: “revamp the current loading system and all garbage. When we fly to a planet and land it should launch the game UI that the forked session is making and allow all the instant action features”.
- 2026-10-13, on the first sketch of this design: “Do only hoth for now we plan to port everything but just hoth rn to make it perfect and then apply to the rest once hoth is done (for star wars galaxy).” On the old waiting screen's day picker, machine line and quality button: “Delete all of it.” Then: “get rid of surface world section” and “I think galaxy hit planet and go to menu where everything is loaded is much better”.

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

## Decisions

1. **On Hoth the galaxy goes from the planet to the game's menu.** Flying into the planet and the Land action both go to `/battlefront/hoth?from=/galaxy/hoth`. Nothing of the site's surface world is fetched or built on the way.
2. **`/galaxy/hoth/surface` is no longer a place.** The address goes to the game's menu (a redirect, so old links and the galaxy panel's tiles still work). The surface's mode menu is not shown for Hoth. The other planets keep their surface and their menu, untouched.
3. **One world for the visit, mounted with the menu.** `/battlefront/hoth` mounts the Battlefront world at once and draws the game's front end over it. The level streams and the shaders build while the player is in the menus. The world is made once for the level; the mode and the options no longer make it again (decision 6).
4. **The menu the player lands in is the game's main menu**, past the Start screen (the player has already arrived). PLAY leads to Instant Action; COLLECTION is beside it. The way back to the galaxy is the menu's own back.
5. **Instant Action's setup is the game's own screen**, drawn from its tree, its options read from `optionsFor()` so the screen holds no list of its own. Every option the game has is shown. One the sim does not act on yet is shown and marked “not in this world yet”, as the front end already marks its tiles. Limits shown as they are: the player's side is the Empire, the era is the original trilogy's, the level is Hoth.
6. **Start begins the round in place.** The setup's Start sends the options to the world, which makes the round's sim again and keeps the level, its light, its shaders and its bodies. This needs one new action in the sim's lane (below). Until it lands, Start mounts the world again with the options; the browser's cache keeps the level's files, so that costs the build and not the download.
7. **After Start, the game's order.** If the level is not ready, the game's loading screen (the planet's film, a hint, the bar fed by `readiness()`) until it is; then the game's spawn screen for the first life as for every later one; Deploy runs the game's wipe into the field.
8. **The site's waiting screen is deleted**, and with it the day picker, the machine's line and the quality recommendation with its button. The game's coin picks the day, as the game does. Nothing replaces them on the way in. (The video settings in the site's Menu are not part of this and stay.)
9. **The menu must answer while the level loads.** A click or a key in the menu is answered within 100 ms throughout the load. This is measured, not assumed (see Checks); if the load's work on the main thread breaks it, the cause is named and goes to the frame-time lane.

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
- Not deleted in this lane: the surface world's code, which every other planet uses. Hoth's own surface content (its missions and set pieces on the site's Hoth) is left in the tree, unreachable; see Open, 2.

## What other lanes are asked for

- **The sim's lane (tilak-a6, `claude/bf-instant-action`)**: one action, `world.do('round', options)` → a promise of `{ ok, round }` or `{ ok: false, why }`, which replaces the battle's sim in place and leaves the level and everything drawn as it is. Its `instantActionSchema` and `optionsFor` are used as they stand.
- **The frame-time lane (tilak-19)**: nothing asked. It is sent the numbers from Checks, 3.

## Phases, one pull request each

| phase | what | gate |
| --- | --- | --- |
| 1 | Hoth's two ways down go to `/battlefront/hoth`; the page mounts the world behind the game's main menu; Play still leads to Galactic Assault as today; the waiting screen is deleted and the first life uses the loading and spawn screens; `/galaxy/hoth/surface` redirects | the tests of `battlefront/`, `pages/`, `galaxy/surface/modes`; Checks 1 to 4 |
| 2 | The Instant Action setup screen on the game's tree, from `optionsFor()`; Start mounts again with the options | the screen's tests; a walk in the browser: every option changes the round it starts |
| 3 | Start in place (`world.do('round')`, when the sim's lane has it); the approach's prefetch | Check 2 again: Start to spawn screen |
| 4 | The Instant Action Overhaul V2's options on the same screen, when bf2-re findings 53 names them | the screen's tests |

## Checks (headless Edge on the desktop, 2560×1440, the bucket's base set, numbers written into the pull request)

1. **One world.** From the galaxy into Hoth, the network log holds no request for the surface world's pack or models, and the runtime makes one world.
2. **Times.** From the hit to the menu drawn; from the menu drawn to `readiness().ready`; from Start to the spawn screen. Before (today's path, both loads) and after, on the same machine in the same hour.
3. **The menu answers.** While the level loads, the longest main-thread task and the time from a key press to the next frame, with the target of decision 9.
4. **Nothing of the old layers is left.** No `bf-waiting` element in the page; the day is the coin's.
5. The repo's own: `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`.

## Open, for the owner

1. **The first screen.** Decision 4 lands the player in the main menu, two clicks from the setup screen. The other way is to land straight in the Instant Action setup for Hoth, with the main menu behind its back button. The main menu is recommended: it is where the Collection is, and it is what the game shows.
2. **Hoth's old surface content.** This design leaves it unreachable in the tree. Deleting it (the site's Hoth missions and set pieces) can be a pull request of its own after phase 1, once the owner has seen the new path. Recommended: delete it then, not now.
3. **Hitting the planet.** Today flying into a planet plays a crash and lands. Decision 1 keeps that and the Land action, both to the menu. If the owner wants the menu on approach, with no crash, say so.

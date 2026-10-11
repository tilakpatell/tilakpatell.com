# The game's screens, walked (lane screens of the sixth design)

`node scripts/battlefront-check.mjs --screens --quality low` (headless Chromium, SwiftShader, 1280 × 720, the WebGL leg, the post chain off) walks the 2017 game's own screens on the site and shoots each; `check.json` beside the shots holds the run. The WebGPU leg and the frame times wait for the owner's laptop: the cloud's Chromium fails WebGPU on a `GPUTextureComponentSwizzle` type error (lane 5's finding), and SwiftShader draws a Hoth frame in seconds.

| shot | what it is | drawn from |
| --- | --- | --- |
| `start.png` | the start screen: the game's press-start line (its own string, the button named as the keyboard's) over the multiplayer tile's film | `UI/Frontend/Screens/Start/StartScreen` (the online and store tiles left out), `films.js`'s `tilesFor('assault')` |
| `main-menu.png` | the main menu's tabs (Home, Play, Collection, Career, Options) in the game's cells, faces and palette, faded in as the game's enter animation | `MainMenuScreen` → `MainMenuWidget` → `MainMenuButtonCell` |
| `play.png` | Play's tiles in the boxes the tree gives them; Multiplayer live, Co-op and Campaign greyed ("not in this world yet") | `PlayScreen` → `PlayTile` |
| `multiplayer-category.png` | the multiplayer category: Galactic Assault live, Heroes vs Villains and Arcade greyed | `PlayMultiplayerCategoryScreen` |
| `multiplayer.png` | the mode cards in their lists' boxes: Galactic Assault large with the game's description, Starfighter Assault, Blast, Strike / Extraction and Ewok Hunt beside it | `PlayMultiplayerScreen` (its five list elements) and `info.json` |
| `levels.png` | Galactic Assault's levels in the game's order and names (Mos Eisley … Outpost Delta … Trippa Hive); Hoth's live | `info.json` (the mode's `Levels`, each level's name and planet) |
| `loading.png` | Hoth's loading screen: the planet's film, the level's name, a hint for the mode in the game's hint box, the bar carrying the level's real progress | `LoadingScreenWrapperWidget`, `loading.json` (`MPLoadLevelHothAsset`, the hint bundles' filters) |
| `spawn.png` | the spawn screen over the overview: the classes, reinforcements and heroes in the game's cells with their icons and costs | `SpawnOverlayScreen`, lane 5's `offerRows` |
| `hud.png` (not reached here) | the HUD after deploying, the reticle the game's blaster crosshair (its dot and notches) | `shapes.json`: `Crosshairs_Dot`, `Crosshairs_Notch` |
| `ingame-menu.png` (not reached here) | the pause menu (Resume, Respawn, Scoreboard, Options, Quit) as its tree draws it | `IngameMenuMPScreen` |
| `kill-screen.png` (not reached here) | YOU WERE ELIMINATED, after `do('die')` | `KillCardWidget`, the game's string |
| `end-of-round.png` (not reached here) | the outcome declared (VICTORY), after `do('win')`; the scoreboard and the top players follow on the clock | `RoundOutcomeDeclarationScreenWidget`, `EORScoreboardScreenWidget` |

The boxes of three screens (the main menu, Play, the multiplayer screen) read from the DOM against the resolver's (`src/lib/bf2017/ui/screens.js` at the same size): `check.json`'s `boxes` gives each screen's boxes compared and the worst difference in pixels (the gate: 1).

**The run here (2026-10-10)**: the walk passed (exit 0, no console error) through Start, the main menu, Play, the multiplayer category, the multiplayer modes, the levels, Hoth's loading screen and the spawn screen, and deployed. The boxes: the main menu 108 compared, worst 0.04 px; Play 6, 0.03 px; the multiplayer screen 16, 0.07 px (all within 1 px). **The battle's four screens were not reached in software GL**: after deploying, Hoth's field drew no frame in five minutes (and none in fifteen on earlier runs, at 1280 × 720 and at 960 × 540, with the post chain on and off), and the HUD and every in-battle screen come with the world's snapshot, which comes with a frame. So under SwiftShader the walk records that part (`inWorld` in `check.json`) and does not gate it; on a GPU it gates. The four are rendered from their trees in `src/components/battlefront/screens/screens.test.jsx` (the pause menu's items, the kill screen, the end of round on the clock, the scoreboard's rosters, the crosshair on the HUD). Their shots wait for the owner's laptop: `node scripts/battlefront-check.mjs --screens`.


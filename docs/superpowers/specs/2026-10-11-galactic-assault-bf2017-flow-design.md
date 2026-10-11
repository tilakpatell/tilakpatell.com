# Galactic Assault deploys like the game: the four classes, Battle Points, the heroes earned. The design

Date: 2026-10-11. Status: **design and implementation in one session (Opus 5.5 lanes under a Fable 5.1 orchestrator)**, on the flow design (`2026-10-10-battlefront-flow-and-mods-design.md`, decisions 1 to 3) and the game design (`2026-10-10-battlefront-game-design.md`, catalogue 4: Battle Points). It changes none of their decisions. Hand-off: `docs/superpowers/HANDOFF-galactic-assault.md`, “The game’s deploy flow”.

## What the owner asked

“The current system for galactic assault and stuff is bugged and bigger issue is that textures are not loading everything is white. It should be that you pick which game mode you want to play and you spawn as one of the four classes and hero’s only after battle points. Look online for how it looks in the menu … Also the NPCs can’t walk or run correctly and the old targeting system with the green round circle instead of the bf2 2017 system is there. Needs major gameplay rework.”

## What was found (2026-10-11, 16:40–17:10 UTC)

- **The flow.** The galaxy’s Galactic Assault (`/galaxy/<world>/surface?mode=galacticAssault`, eight maps, `surface/missions/assault*.js`) asked which side and which command post, then put you on the field as whatever the Loadout panel kept: Luke by default, free. The Battlefront world (`/battlefront/hoth/galacticAssault`, one level) already deploys as the game does (`screens/Spawn.jsx`: the four classes, the enforcers and the heroes at their Battle Point price) but nothing on the site links to it; the flow design’s decision 3 left the card’s row (`modes.js`’s `BATTLEFRONT`) unflipped.
- **The white.** The live build does carry the bucket’s base (`assetBase-*.js` names `jzabcqboyemokwifmjmp.supabase.co/…/site-assets`), and the pack’s textures answer from both the bucket and the site, so the white is not a 404. By reading: `level/levelGltf.js` draws a material whose named colour map **failed** to fetch or transcode in plain white (`bareGlb` greys only materials that named no map), and a transcoder that cannot come up fails every map silently. The cloud container cannot draw the node renderer (SwiftShader loses the device), so the owner’s own frame was not reproduced here; the fix closes the failure mode and makes it say what failed.
- **The reticle.** The surface draws the runtime kit’s ticks with the lock-on ring (`--hud-accent`, a round ring that reads green on some themes) in every fight; the game’s crosshair shapes (`src/lib/bf2017/ui/shapes.js`, `blasterCrosshair()`, the hit and kill markers) are on the site and used by the Battlefront world alone.
- **The figures.** In the Battlefront world a soldier’s clip plays at its authored pace whatever the sim moves it at (`figures/figures.js`, `mixer.update(dt)`, timeScale 1), so feet slide at 3.8 m/s and 5.97 m/s. The galaxy’s soldiers on the game’s skeleton go through `lib/three/animator.js`, which paces by measured strides; its statues (unrigged Sketchfab figures) sway by `gait.js` and cannot walk.
- The game, as published: four trooper classes free; enforcers, aerials, infiltrators, vehicles and heroes bought with Battle Points, earned by kills and by playing the objective ([EA’s overview](https://cogconnected.com/2017/08/star-wars-battlefront-ii-battle-point-system/), [Vulkk’s modes overview](https://vulkk.com/2017/09/26/overview-of-all-star-wars-battlefront-ii-multiplayer-modes/)). The prices are the game’s own records in `src/data/bf2017/points.json` (heroes 4,000; a Death Trooper 1,500 by default, 2,000 on Hoth).

## What the owner said next (2026-10-11, 17:30 UTC)

“Make everything 2017 version, not the older version, and make it exactly like the game with its assets (we have everything, and the licence). It’s more like the models don’t have textures: they’re just white. Check how it is in BF2 and make it as accurate; look at gameplay footage.” So: the game’s own level, screens, HUD and spawn flow wherever the site has them; the site’s own battle only where the game’s level is not wired yet, and then with the game’s flow on it.

## Decisions

1. **Hoth’s Galactic Assault is the Battlefront world.** The galaxy’s mode menu, Hoth’s panel tile and its briefing send the player to `/battlefront/hoth/galacticAssault?from=/galaxy/hoth`: the game’s level (Outpost Delta), its loading, spawn, kill and end-of-round screens drawn from its own UI trees, its HUD widgets, its crosshair, its Battle Points and prices, its soldiers on its skeleton and clips. The route’s `from` makes the game’s menu and end of round lead back to the galaxy’s Hoth, not the universe map (`battlefront/index.js`’s `wayBack`).
2. **The other seven worlds take the game’s deploy flow on the galaxy’s engine until their levels are wired.** What the Battlefront world needs of a level and does not have for any but Hoth: a teams row (`teams.json` holds `Orig:hoth_01` alone), a stages rulebook with its objectives chosen (`endor.stages.json` has its three stages and no objectives), a lighting rulebook (`maps/hoth.lighting.json` is the only one), its weather and picture. Those are a lane of their own per level, from the export on the owner’s desktop. Meanwhile the galaxy’s assault (which already draws the game’s level packs and its figures) gets the game’s spawn screen: side, then the four classes free, the side’s enforcer and heroes at the record’s price, greyed until the Battle Points of this battle afford them; a class pick kept as the loadout, a bought hero worn for one life.
3. **Battle Points on the galaxy’s engine are a pure module** (`missions/points.js`) over `points.json`’s numbers, never the whole rulebook (13 MB of records). Earned: a kill 100, a post taken with you in it 200 (by hand), ten a second standing in a contested live post (the game’s `objectiveTick`). Spent at the spawn screen alone. Reset by a new battle, kept through deaths.
4. **The spawn screen is the game’s look on the house kit**: the left column on glass, the game’s faces, names and icons, the posts beside it as the “where”, Battle Points at the foot, the house `kbd` for the keys. No `bf-*` CSS crosses from the Battlefront world (worlds are islands).
5. **The game’s crosshair and markers in every blaster fight on the surface**, through the kit’s `Reticle shape=`; the lock-on ring stays for the lightsaber alone.
6. **A map that fails never draws white, and the loader binds to what is drawn.** three r186’s GLTFLoader copies a material for a mesh with no normals or tangents, or with vertex colours; the level loader bound the pack’s maps to the parser’s material alone, so the copy, the one drawn, stayed white, and on the node renderer the game material was built from that white copy. That is the white the owner saw. The loader now binds every copy; a failed colour map leaves the material bare (grey, as one naming none); failures are counted and said once; the KTX2 loader waits for a WebGPU renderer’s device before reading its features.
7. **The Battlefront world’s figures pace their clips to the sim** from each clip’s own root travel (`clip.userData.root`, written by `scripts/bf2017-clips.mjs`).
8. **The mode menu is laid out as the game’s multiplayer screen**: Galactic Assault the large tile with the game’s film, the others in the grid, the key prompts at the foot.

## Lanes

| lane | files | gate |
| --- | --- | --- |
| A, the white | `surface/level/levelGltf.js`, `level/index.js`, `lib/three/gltf.js`, `lib/three/surface/gameMaterial.js` | `levelGltf.test.js`, `gltf.test.js` |
| B, the deploy flow (seven worlds) | `missions/points.js` (new), `assault.js`, `assaultScene.js`, `scene.js` (two lines), `troopers.js`, `AssaultHud.jsx`, `surface.css`, `pages/GalaxySurface.jsx` | `points.test.js`, `assault.test.js`, `AssaultHud.test.jsx`, `troopers.test.js`, `missions/index.test.js` |
| C, the crosshair | `pages/GalaxySurface.jsx` (the reticle block), `surface.css` | `shapes.test.js`, the page’s smoke check |
| D, the figures | `battlefront/figures/locomotion.js`, `figures.js` | their tests |
| E, the menu | `surface/ModeMenu.jsx`, `modes.js`, `flow.css` | `ModeMenu.test.jsx`, `modes.test.js` |
| F, Hoth on the game’s level | `battlefront/index.js` (`wayBack`), `pages/Battlefront.jsx`, `BattlefrontWorld.jsx`, `galaxy/systems.js`, `GalaxyPanel.jsx`, `surface/modes.js` (`BATTLEFRONT`) | `battlefront/index.test.js`, `systems.test.js`, `modes.test.js` |

## Open

- The other seven worlds on the game’s own level (decision 2’s data: a teams row, the stages’ objectives, the lighting rulebook, the weather and picture per level), one level a lane, from the export on the desktop; Endor first (its pack, picture and stages exist; its objectives and lighting do not).
- The owner’s own frame on WebGPU is not reproduced in the cloud (no WebGPU device there); decision 6’s cause was found by reading three’s loader and holds on every renderer. The settings’ stats and the console now say which map failed and why; `?gpu=webgl` and `?post=off` in the address tell the renderer and the chain apart.
- Aerials, infiltrators and vehicles are not offered on the galaxy’s engine; the galaxy has no bodies for the first two and no vehicle to board on foot yet (`HANDOFF-galactic-assault.md`, “Left”).

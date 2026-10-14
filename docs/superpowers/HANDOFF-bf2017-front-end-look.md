# Handoff: the front end's look from the game (branch claude/caveman-gui-ui-improve-d8fc23)

Saved mid-work on 2026-10-13, when the session ran out. The gates (lint, test, build, health) have NOT run on this commit. Run them before a PR.

## Done on this branch

- **Widget states from the game's logic graphs.** `scripts/lib/bf2017-ui-logic.mjs` evaluates each widget's logic (PropertySelect, ConditionalFloat/Property, PropertyDefaultValue, Or/And/Not, the Math select program, prefab references) for normal, selected, focused and disabled. It writes `{ palette, visible, alpha, line, <Corner>Roundness }`, which the rulebook (`scripts/lib/bf2017-rulebook-ui.mjs`) stores as `states` in `src/data/bf2017/screens.json`. PF_FrontendStates gives: state = enabled ? (focused ? 2 : selected ? 1 : 0) : 3. Palette pickers: 38 light, 39 mid, 40 dark, 2 yellow.
- **Layout and paint.** `stateOf` and `inState` in `src/lib/bf2017/ui/layout.js`. In `paint.js`: rounded corners, polylines (relative points, `follow` length, round caps), film tint, and the CRT key-colour trail glow (CrtTrailSettingsAsset). `follow` comes from the record's TextSize.
- **Tiles.** Each tile takes its film from the screen tree. The top line follows the title. A tile not yet in this world draws the disabled look. Hover takes focus. HOME's first focus is its first tile, not the tab.
- **Frost.** The frost now darkens: `brightness(0.35)`, from the MenuHighlightLightness shader. The game's panels may be darker still (try 0.22).
- **Room in production.** A Vite worker does not get the page's plugins, so its manifest was empty. The page now hands the worker a manifest slice (`manifestSlice(ROOM_ASSETS)` in `src/lib/assetBase.js`).
- **Cameras.** The game's PF_UI_CameraLocators are in `backdrop.json` under `frontend.cameras`. The lens is 50 mm on the CamBody_Cine sensor (36 × 20.25). The camera eases between screens with Expo ease-out over 1 s. The character is hidden on PLAY. HOME uses the Tall variant and the kit offset for Chewbacca. The depth of field is a thin-lens circle of confusion on the pill panel (`spreadOf`).

## Open: the pills look fatter than the game's (the owner's last complaint)

Pill widths, measured with `widths.mjs` (half-maximum width at rows 60 and 125, at 1280 × 720) on the PLAY camera:

| Source | Pill width | Pitch |
|---|---|---|
| Game, SDR capture `bf2-re/data/live/2026-10-13-ui/06-play-sdr-hover-sp.png` | 40–42 px, white cores clipped at 255 | about 70 px |
| Site, PLAY | 54–60 px, flat tops at about 206 | about 70 px |

Changes tried on the site:

| Change | Pill width |
|---|---|
| bloom 0 | 54–58 px |
| depth-of-field spread 0.01 | 54–58 px |
| emission × 0.5 | 48–52 px |
| emission × 0.25 | 44–49 px; tops at about 170, so no longer clipped |

So neither bloom nor depth of field causes the width. Even unclipped, the site's pill is wider than the game's clipped one. The pill's footprint on screen is wider before any blur.

The site's room is also darker between the pills (floor 60–100) than the game's (125–135). The game's whites reach 255. The site's tops stop at about 206, which points at the Walrus LUT or the way it is applied.

Leads, in order:

1. **Texture.** The source texture `BF2_Extract/web/textures/levels/frontend/objects/nowherepilllights_01/t_nowherepilllights_01_e.png` is BC7_SRGB at 1024 × 2048. Its row profile is a smooth bump: it peaks at about sRGB 175/188/199 and is about 92 texels wide at half its linear peak. Check which texture size and filtering the kit GLB (`models/galaxy/kits/frontendstage.glb`) carries, and whether its UVs cover the same number of pills as the game's panel. Count the pill columns across the panel in both frames.
2. **Specular on the pills.** The pill material has `color` 0, but it still reflects the room's environment (the PMREM includes the pills). That can light the whole quad. Material: SS_PropsPreset, `_BaseColor` and `_Emissive` both T_NowherePillLights_01_E, EmissiveIntensity 1500, ESS_Emissive RGBColorTexture.
3. **Mesh scale.** The stage applies scale [0.498, 1.562, 1.746] after a 90° yaw. Check the axis.
4. **Grade.** Why the site's white stops at 206: the LUT applied after the clamp and gamma in FINISH (`light.js`).

Scripts are in the session scratchpad and may be gone; rewrite them from these notes:
- `widths.mjs`: half-maximum widths of the bright columns along one row.
- `crop.mjs`: the same crop of several images, side by side.
- `viewshots.mjs`: headless Edge with `--use-angle=d3d11`, `__bfRoomCamera(name)` then `__bfRoomView({...})`.

The dev server is `caveman-ui-dev` on port 5431 in `.claude/launch.json`.

## Also unfinished

- **Player-count labels** (the PLAY tile's PlayerAmount). `tiles.js` is done: text from `t.players`, both rules follow `Text`, the foot rule 40 px down. Still to do: `paint.js` `pixelLine` honours `follow` (width = `lengthOf`), and `Play.jsx` passes `players: [4, 40]` to the Multiplayer tile.
- **Tests.** Update them for the new scene, assetBase and tiles behaviour. The UI suite passed (214 tests) before the camera and room changes.
- **Docs.** bf2-re `findings/53` (UI render, shaders, logic, front-end cameras). The `backdrop.json` notes cite it.

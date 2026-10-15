# Hand-off: the front end on the canvas, and its 3D room (2026-10-13)

Two designs, one branch (`claude/magical-curie-arkgxh`):

- `specs/2026-10-13-bf2017-ui-canvas-design.md` (its phase 1 plan `plans/2026-10-13-bf2017-ui-canvas-phase1.md`): the game's screens painted on one Canvas 2D from the game's own layout trees, with invisible buttons over the cells. Start, the main menu (HOME), Play and Single Player are on it.
- `specs/2026-10-13-bf2017-frontend-backdrop-design.md`: the front end's 3D room behind HOME and PLAY, drawn in a worker, lit from the game's records (`src/data/bf2017/backdrop.json`), with HOME's Chewbacca on the right.

## What landed

- **The canvas screens.** `src/lib/bf2017/ui/` (`layout.js`, `paint.js`, `screens.js`, `textures.js`) and `src/runtime/hud/ScreenCanvas.jsx`; the screens in `src/components/battlefront/screens/` (`menuHeader.js`, `home.js`, `tiles.js`, `footer.js`). Every hand rule is in `src/data/bf2017/NOTES.md`, "The screens on the canvas, phase 1". `scripts/bf-ui-shots.mjs` shoots the four screens at 1920 and 2560 × 1080 and fails on a paint over 2 ms (p95).
- **The room** (`src/components/battlefront/backdrop/`). `scene.js` draws the room, the figure and the loop; `light.js` holds the game's passes; `governor.js` keeps 60 frames a second (the one tested part); `host.js` runs one room for the whole front end (a worker on an OffscreenCanvas, or the page where a worker can't draw). `GameScreen`'s `room` puts it behind a screen; MainMenu and Play pass it.
- **How the game lights the room**, read from the export:
  - the pill panel is the only light, emissive at its material's 1,500 (`web/materials.jsonl`);
  - the floor is a mirror (smoothness 0.98 to 1.2, the Lighting layer's planar reflection), the walls are glossy, and both maps tile 44 times;
  - a teal SimpleVolumetrics sphere sits in front of the panel (`Levels/Frontend/Lighting`);
  - the camera is VE_FrostEnd's: a fixed exposure at EV 8 −0.35, a linear tone map with an approximate gamma, a five-Gaussian bloom at 0.193, the Walrus base grade, a vignette (0.194) and film grain;
  - the lens is the front end's own camera (`Levels/Frontend/Default`): a `CamBody_Cine` body (36 × 20.25 mm), a 173.9 mm lens at f/6.3, focused at 12.53 m.
- **Three numbers fitted to the capture**, not read from it (`backdrop.json`, `calibrated`): the pills at half of 1,500/π, the haze ×3, and the hero 18.5 m in front of the panel. The fit uses the game's HOME capture, band-averaged, with a mean error of 11/255. The kit's pill map is upside down, and `scene.js` turns it over: the game's columns alternate a long pill on top and a short one, starting from the left.

## To do

### Chewbacca, so he looks like the game (first)

1. **The shots were half resolution.** A reduced-motion visitor (and every check shot so far) starts the governor at its last step, the still, which draws at a pixel scale of 0.5. Reduced motion should be a still at the device's own step. In `governor.js`, `startStep` should ignore `reduced`, and `scene.js`'s `still()` already stops the motion. Change the governor test's expectation first, watch it fail, then fix.
2. **His face is outside the key light's cone.** The level's white spot (sub-level 0: 1,500 lm, a 76° cone, a 5 m reach, at [0.9, 1.67, −0.67] from the hero) is aimed at the hips of a 1.8 m soldier. Chewbacca's head is at 2.1 m. Aim it at his face, or read the Collection's or the HOME camera locator's light rig, and compare with the capture (his face lit from the front left).
3. **His hair is stringy.** The game dithers its hair and resolves it with TAA; the site cuts the cards at alpha 0.35. Turn on `alphaToCoverage` on the hair cards (the scene's target is already 4× multisampled).
4. **Shade his hair as hair.** The game's hair presets (`Shaders/Presets/SS_CharactersHairPreset_*`) are strand shaders. Try `MeshPhysicalMaterial` with `anisotropy` (the strand highlight) and `sheen` (the fur's rim). Read his materials' real numbers from `web/materials.jsonl` (the row for `characters/hero/chewbacca/chewbacca_01/chewbacca_01_mesh`). The `matte` copy in `scene.js` (metalness 0, the hair at roughness 0.85) is a stand-in until then.
5. **Skin and ambient occlusion.** VE_FrostEnd scatters skin (SubSurfaceScatteringComponentData) and darkens the folds with HBAO (AaoIntensity 0.4). Neither is drawn. Check his ORM maps for an occlusion channel to use as `aoMap`.
6. **Bloom on him.** The room has the VE's bloom and the figure has none, so the bowcaster's chrome glints in the game and not here. A per-frame bloom at a quarter of the size is the cost to measure.
7. **Light from the panel.** In the game his ambient is Enlighten's dynamic probes, lit by the emissive panel. Here it's a PMREM baked once from the room at his place. Compare the rim on his edges with the capture.
8. **Look on a real GPU.** Every shot so far is SwiftShader in the cloud. Shoot on the owner's machine at step 0 and ultra (`chewie.ultra.glb`, LOD0 with 2048 maps).

### HOME's online parts (the owner asked to show them)

9. **The loot box tile and the currency.** Show UNOPENED CRATES (`LootBoxButton`) and the currency widget (credits and crystals, top right) "as we are porting the whole game", with something other than currency in it. Both, and the timed challenges row (`TimedChallengesWidget`), are hidden by `home.js`'s ONLINE list and the header. What replaces the currency (the site's own counts, achievements, worlds visited) is the owner's call: ask first.

### The room

10. **The Collection's stage has the pill map upside down too.** `heroStage.js` uses the same kit. Turn the map over in the kit (`scripts/bf2017-kit.mjs`) or in `heroStage.js`, and drop the backdrop's own flip.
11. **Other heroes on the right.** Any hero the front end shows on the room (the owner: "and the other assets when we switch to them") stands where Chewbacca stands, clear of the tiles.
12. **The thin smoke.** `FX_ThinSmoke_01`, lit 25× by the teal spot, isn't drawn; the haze sphere stands in for it.
13. **The baked bounce.** The Enlighten atlas (`FLS_Frontend_01_staticIrradianceTexture`, its direction maps and sky visibility) is listed in `textures.jsonl` but not in the bucket. Upload it from the desktop (lane W), then draw the dome's bounce.
14. **The fitted numbers.** Revisit the three when Frostbite's units for `EmissiveIntensity` and SimpleVolumetrics are known, or when HOME's own camera locator is read (`Levels/Frontend/Camera_Schematic` and the 24 `PF_UI_CameraLocator`s in `Levels/Frontend/Camera`).
15. **The governor on hardware.** Measure frame times on a mid laptop and a phone. Check the worker path in Safari (WebGL on an OffscreenCanvas needs 16.4, GLTFLoader's ImageBitmap path needs 17); the page fallback covers anything older.
16. **Tests.** `scene.js` and `host.js` have none (the owner asked for fewer tests); the governor has six.

### The canvas screens

17. **Phase 1's evidence.** Write `docs/superpowers/evidence/bf-ui-canvas/README.md`: the reference pictures' URLs (interfaceingame.com and the Nexus page), the paint numbers (steady p95 at 1920: main menu 1.6 ms, Play 1.1, Single Player 1.3; first paints 11 to 18 ms in SwiftShader), the differences left, and the SwiftShader caveat.
18. **The final review.** The whole-branch review by a fresh reviewer (the executing-plans skill's last step) wasn't run before this merge.
19. **Phases 2 to 5** of the canvas design: Instant Action, the loading and spawn screens, the HUD, the pause, kill and end-of-round screens, and the desktop's texture resource ids.

## Checking it

- The room in a browser: `/#/battlefront`, then Enter. In development, `window.__bfRoom()` gives `{ mode, step, ready }`, and `window.__bfRoomView({ camera, look, fov, figure, key, env, pills, haze, bloom, room: { div, passes } })` moves the camera and changes the light to compare against a capture. `?quality=ultra` asks for the ultra cut.
- The models it draws are published, not in git. Fetch them for development from the public `site-assets` bucket by the hashes in `src/data/galaxyAssets.json` (the kit `models/galaxy/kits/frontendstage.glb`, `bf2017/crew/chewie*.glb`, `bf2017/clips-chewie.glb`, `clips-emotes-chewie.glb`, `clips-additive.glb`, and `surface/bowcaster.glb`).
- The gates: `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`.

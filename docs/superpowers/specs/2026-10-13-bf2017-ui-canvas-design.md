# The Battlefront screens as the game draws them: one layout, a Canvas 2D painter. The design

Date: 2026-10-13. Status: **approved by the owner on 2026-10-13; phase 1 landed (Start, HOME, Play and Single Player on the canvas); what is left is in `HANDOFF-battlefront.md`.** Branch `claude/magical-curie-arkgxh`. It follows the landing design (`2026-10-13-hoth-landing-game-menu-design.md`), whose decisions 4, 5, 7, 9 and 11 stand, and the screens lane of the accuracy design (`2026-10-10-bf2017-accuracy-design.md`). It changes how the game's screens are drawn, not which screens there are or the way through them.

## What the owner asked

- “The current GUI although much better has bugs and is not perfect or like the game.” Then the Frosty Editor's way into the game's UI: the `TextureAsset`s (icons, HUD textures, menu art, exported as PNG) and the layouts (“UIComp or ScreenAsset … widget placements … text scaling, font variables, and alignment”). “Look for this in the supabase you have access to … Try to fix the UI.”
- “Make a spec and use superpowers skill and ultracave skill.”
- On scope: the Hoth flow, end to end.
- On what “like the game” is checked against: “You search up battlefront 2017 game and with instant action v2 mod from nexusmods as we have integrated boht. I don't have my desktop with the game with me at the moment”.
- On how to draw it: “Whatever is perforamnt and also the msot accurate”, and “Whatever is better and more accurate and performant”.

Read as: every screen on Hoth's way (the main menu, Play, Single Player, Instant Action, the loading screen, the spawn screen, the HUD, the pause menu, the kill screen, the end of round) is drawn from the game's own layout and the game's own pictures, by whatever renderer is both the most faithful and the cheapest, and checked against pictures of the game found on the web, the vanilla game's and the Instant Action Overhaul V2's.

## What Frosty's two kinds are, in the bucket

The export the owner made with Frosty is in the private `bf2017-assets` bucket (`HANDOFF-battlefront.md`, “The bucket”). What the ask names, and where it is:

| the ask's name | what the bucket holds | where | count |
| --- | --- | --- | --- |
| `TextureAsset` (images, icons, HUD textures, menu art) | PNGs and their rows | `web/textures/ui/**`, `web/textures.jsonl` | 850 rows under `UI/` (692 `UI/Bitmaps/Frontend`, 95 `Portraits`, 13 `GameModeTiles`, 8 `SupplyCrateIcons`, 6 `ChooseSideTiles`, 10 `UI/Art/HUD`, the rest single) |
| “UIComp or ScreenAsset” (layouts) | `UIWidgetBlueprint` records | `data/UI/**` (`data.tsv` indexes 83,982 records) | 1,082 (556 in-game, 322 front end, 52 customise, 37 loading screens) |
| the layouts' parts | `DiceUIVectorShapeAsset` (vector shapes), `UITextureMappingAsset` (which texture, and which part of it, a box shows), `UIElementFontStyle`, `UITtfAsset` (the fonts), `UIStateGroup` (focus, hover, disabled), `WSUILoadingScreenAsset`, `SchematicsAsset` (a widget's logic), `WSUICppScreenData` (the screens the game's code draws) | `data/` | 302, 30, 55, 23, 72, 48, about 900, 18 |

The site already reads most of these: `scripts/bf2017-data.mjs` writes `src/data/bf2017/screens.json` (232 screens, 229 widgets, 434 strings), `shapes.json` (292), `info.json`, `loading.json`; `scripts/bf2017-ui.mjs` writes `icons.json`, `fonts.json` and `bitmaps.json` (255 of the 850 textures, as WebP under `public/ui/bf2017/bitmaps/`, 7.5 MB). What it does not do is draw them all, or draw them as the game does.

## What was found (read 2026-10-13 at `1a471eee`)

### The reader and the renderer, for every screen

1. **No texture box is drawn.** The 1,082 layouts hold 88 `TextureElementData` boxes. The reader (`scripts/lib/bf2017-rulebook-ui.mjs`, `elementOf`) keeps a box's place but drops its texture, and `src/runtime/hud/Screen.jsx` has no branch for one. Of the 88, 39 are bound (their `Texture.Id` is 0: the game's code sets the picture, a portrait, a star card, a mode's tile) and 49 are static.
2. **How a static box names its texture.** Its `Texture.Id` is Frostbite's field hash (djb2 with xor, `fieldHash` in `scripts/lib/bf2017-abilities.mjs`) of the texture's short name in lower case: `vignette` hashes to −1768429805, the `Id` of the death screen's and the pause screens' `Vignette`, and `UI/Art/HUD/Vignette/vignette` is in `textures.jsonl`. Eight of the 49 resolve by that hash against the export. The rest go through the widget's own mapping record (`<widget path>_automapping`, a `UITextureMappingAsset`), whose `Output[]` maps the same `Id` to a `TextureRef` (a 64-bit resource id) and a UV rectangle. `textures.jsonl` carries no resource id, so a `TextureRef` cannot be named from the export yet: the five mapping records read hold 11 (the HUD's atlases among them, `UI/Art/HUD/_TextureMappings/GenericSoldierHUDTextures` with its icons as UV rectangles of one texture). The other 25 mapping records are indexed in lower case and the fetch missed them (`data.tsv`'s name and the bucket's folder differ in case).
3. **The icons draw nothing.** 131 `svg` boxes; `Screen.jsx` hands `GameIcon` the path's last part (`Class_Troopers_Assault_01`), while `icons.json` is keyed `folder/name`: 0 of 131 resolve. Looked up by the whole path, 40 of the 70 distinct names do.
4. **Lines and polygons are not drawn**: 137 `line` (their `points` are read and never used), 107 `singlePixelLine`, 12 `polygon`, 27 `regularPolygon`, 1 `arc`, 4 `blendedShape`. A `repeatShape` (21) draws one copy, its count and angle unread.
5. **No frame.** Every box is placed in per cent of its parent and the anchors follow the window's width and height, so a window that is not 16:9 pulls the layout out of shape.
6. **Films.** 29 of the 33 `video` boxes have no film.
7. **Bound fields are empty.** The game's code fills a widget's texts and textures from data; the site fills few. The Play tile (`UI/Frontend/Widgets/Play/PlayTile`, 504 × 736) holds `AurebeshTitle`, `Title`, a `singlePixelLine`, `Description` and `PlayerAmount`; the site draws the title alone. A mode's tile art is in the bucket (`UI/Bitmaps/GameModeTiles/GMTile_*`, 13, 504 × 764), but the mode's record does not name it (`GameModeInformationAsset.GridImage` is empty for Galactic Assault): the code picks it. `info.json`'s `tile` is null for all 21 modes and 28 levels.
8. **Positions by hand.** About 108 left, top, width and height values in `screens.css`, `instantAction.css` and `collection.css` place parts the tree already places, and three screens prune the tree by a regular expression and draw a part of their own in its stead (`Start.jsx`, `Spawn.jsx`, `CollectionList.jsx`).

### The screens on Hoth's way (shot at 1920 × 1080 on the dev server)

Measured against the game's pictures described in the landing design (“The running game, photographed”):

- **Main menu.** A yellow corner mark on every tab, whatever its state; the separators run through the tabs' boxes; the focused tab shows no page under it, and HOME is empty; inside PLAY the tab bar and the breadcrumb are both gone.
- **Play and Single Player.** No breadcrumb (the game: PLAY / SINGLE PLAYER) and no BACK at the foot; each tile lacks its Aurebesh name, description and player count (bullet 7); the tile under the pointer is outlined white where the game's glows yellow; two tiles show the same AT-AT drawing.
- **Instant Action.** A choice's value sits about 5 px below its arrows; a slider's number straddles the edge of its fill; the list is cut in the middle of a row at its foot (ENEMY HEROES).
- **Loading, spawn, kill, end of round.** Mostly parts placed by hand over a pruned tree (bullet 8); the spawn screen's level badge, weapon and its EQUIP buttons are not the game's (the landing design's evidence, phase 2b).

The second private bucket, `bf2-extract`, was not read: this session's permission check refused listing it with the secret key. A session given leave to read it says what it holds before phase 2.

## Decisions

1. **Canvas 2D paints every screen on Hoth's way, the HUD with them.** It is the most faithful of the three ways and as cheap as the cheapest:
   - Faithful: it draws text in the game's own TTFs (`FontFace`, from `public/fonts/bf2017/`), has the game's blend modes built in (the layouts' `WSUIBlendMode_Additive` is `lighter`, `AlphaBlend` is `source-over`, multiply is `multiply`), tints by the game's palette, and draws the vector shapes as paths.
   - Cheap: it paints only when something changed. In battle only the regions whose values changed are painted again in a frame.
   - Not the DOM, today's way: CSS has no additive blend, a glow by CSS filter is paid every frame, and a HUD of many elements lays out again whenever a number changes.
   - Not WebGL: as fast, but its text needs font atlases, which soften small type, and it is the larger build.
2. **One layout core feeds the painter and the input.** A pure function turns a tree and its state into a flat list of boxes in the game's frame. The painter draws that list, and the input layer places its buttons from the same list, so what is drawn and what is clicked cannot disagree.
3. **The game's frame.** The layouts are made at 1920 × 1080. Every box sits in that frame, scaled by `min(width / 1920, height / 1080)` and centred in the window. A box the tree expands to fill its parent (`Expansion` 0, 0, 1, 1) stretches to the window, as backgrounds do in the game. Anything else in the bars beside the frame is black.
4. **Input through invisible buttons.** Each navigable cell of the list gets a transparent `<button>` over its box, its `aria-label` the cell's words. The keys walk the tree's own navigation (`screenKey.js`), and focus and hover go back to the painter as the cell's state, so the ring and the glow are the game's, drawn, never the browser's outline. Screen readers, the mouse and the keyboard work as they do today.
5. **A screen holds no positions.** A screen's component only fills the tree's bound fields: texts, textures, lists, values. A value the tree does not hold is allowed only where the tree is silent, and each one has a line in `src/data/bf2017/NOTES.md` marked hand, with the reason.
6. **The texture a box shows**, in this order:
   1. a static box by the field hash of the short name, against `textures.jsonl`;
   2. a mapped box by the mapping record (looked up ignoring case), `Id` to `TextureRef`, and the `TextureRef` to a texture by the export's resource id once the export carries one (phase 5); an atlas ships whole and is drawn by its UV rectangle;
   3. a bound box by the data the screen fills it from: the mode's tile `GMTile_<mode>`, the side's `CSTile_<era>_<side>`, the portrait by `portrait()`. Where the code, not the data, makes the pick (the mode tiles), the table is hand until the binary is read.
   
   What a Hoth screen names is shipped as WebP beside the 255 there now, by `scripts/bf2017-ui.mjs bitmaps`. The bytes are measured in phase 2 and written into the evidence README; the shots script (Checks) holds the later phases to that number.
7. **The bound fields are a table.** `src/lib/bf2017/ui/bindings.js` says, for a widget and a field, what fills it (`PlayTile.AurebeshTitle` is the mode's `aurebesh` in `info.json`, `PlayerAmount` its `players`). A screen passes its data and the table fills the tree.
8. **What is missing draws nothing.** A texture the bucket lacks, an icon that does not resolve or a font that fails to load draws nothing, or the site's face for text. Each is counted in the check's report (Checks), never covered by art of the site's own.
9. **The house rules, inside the game's screens.** The game's screens are this world's own face. `RULES.md`'s HUD rules for type over the 3D (glass at 0.78 behind text) do not apply where the game draws its own backing, or none. The one rule kept: nothing a player reads is drawn under 0.7 rem, so in a small window the game's smallest type stops shrinking at 0.7 rem while its box keeps the frame's scale. The site's bar, its Menu (the video settings, the way out) and its toasts stay the kit's.
10. **Three sources for every screen** (the landing design's decision 11, held): the layout in the export; a picture of the game; and, where the game's code decides what the layout does not say, the binary through REA (the owner's desktop). Until the owner's desktop is back, the pictures are the web's: the vanilla game's and, for the Instant Action screen's added rows, the Overhaul V2's. Their addresses are listed in `docs/superpowers/evidence/bf-ui-canvas/README.md`, and the pictures themselves go in the private bucket under `ref/ui/`, never into the repository. A difference found is written into the pull request with the picture's address.
11. **The numbers are checked, not assumed.** A full screen paints in 2 ms or less at 1920 × 1080; a battle frame's HUD paints in 0.5 ms or less; a click or a key in the menu is answered within 100 ms while the level loads (the landing design's decision 9).

## The units

| file | what it does | it uses | tested by |
| --- | --- | --- | --- |
| `scripts/lib/bf2017-rulebook-ui.mjs` | keeps what it drops today: a texture box's `Id`, `TextureRef`, UV rectangle, alignment, blend mode and desaturation; a line's points and width; the polygons, the arc, a `repeatShape`'s count and angle; a video's film; a field the code fills (a text or texture whose value is empty and whose property connection comes from outside the widget) | the bucket's records | fixtures cut from records (`scripts/lib/fixtures/`) |
| `scripts/bf2017-ui.mjs bitmaps` | resolves and ships the textures Hoth's trees name (decision 6) | `textures.jsonl`, the mapping records, `bindings.js` | its own test on fixtures |
| `src/lib/bf2017/ui/layout.js` (new) | the tree and its state to a flat list of boxes in the frame: place, size, clip, order, visibility, the state's colours and alpha (`UIStateGroup`) | `screens.json`, `shapes.json` | boxes against the tree's own numbers |
| `src/lib/bf2017/ui/paint.js` (new) | draws the list on a 2D context: rectangles, fills, lines, polygons, shapes as `Path2D`, text, textures as `ImageBitmap`, blend modes, palette tint (an offscreen `source-in`), desaturation, glow cached as a bitmap; paints only the regions whose boxes changed | a 2D context, `fonts.js` | a fake context that logs its calls |
| `src/lib/bf2017/ui/bindings.js` (new) | the bound fields' table (decision 7) | `info.json`, `strings.json`, kits | rows against the data |
| `src/runtime/hud/ScreenCanvas.jsx` (new) | one `<canvas>` at the device's pixel ratio, the frame (decision 3), the invisible buttons (decision 4), a loop only while a film plays or a value moves, films drawn from a `<video>` while one is visible | `layout.js`, `paint.js`, `screenKey.js` | jsdom with the fake context: buttons where the boxes are, keys walk the cells |
| `src/components/battlefront/screens/*` | each screen on Hoth's way fills its tree and nothing else (decision 5) | `ScreenCanvas`, `bindings.js` | its test: the fields filled from the data |

`Screen.jsx` (the DOM one) stays for the screens not on Hoth's way and its other users (the Starfighter HUD, the Collection) until a later design moves them. No new package: Canvas 2D, `Path2D`, `FontFace` and `ImageBitmap` are the browser's.

## The way the data goes

The bucket's records go to `scripts/bf2017-data.mjs` (`screens.json`, `shapes.json`, `info.json`) and its textures to `scripts/bf2017-ui.mjs` (WebP under `public/ui/bf2017/bitmaps/`, `bitmaps.json`). In the page, `useTree` resolves a screen's tree; the screen's data fills its bound fields through `bindings.js`; `layout.js` makes the list for the window's size and the cells' states; `paint.js` draws it; `ScreenCanvas` holds the canvas and the buttons. A change of state (focus, a value, a resize) makes a new list, and only the boxes that differ are painted again.

## Phases

| phase | what ships | done when |
| --- | --- | --- |
| 1 | `layout.js`, `paint.js`, `ScreenCanvas`; Start, the main menu (one tab focused, its page under the tabs, the bar and the breadcrumb kept inside PLAY, the corner mark only where the tree's state sets it), Play and Single Player on the canvas | the four screens drawn from the tree alone, no hand position left in their CSS; the speed numbers met |
| 2 | the reader's new fields; textures (decision 6, steps 1 and 3); icons by the whole path; lines, polygons, `repeatShape`; `bindings.js` with the tiles' Aurebesh name, description, player count and art | every texture, icon and line the four screens' trees hold drawn, or counted missing |
| 3 | Instant Action (the game's rows and the Overhaul V2's, from `instantActionForm.js`), the loading screen, the spawn screen | the three screens drawn from their trees; each difference from the references written down |
| 4 | the HUD, the pause menu, the kill screen, the end of round on the canvas | the battle's screens drawn from their trees; the HUD's 0.5 ms met |
| 5 (the owner's desktop) | the export gains each texture's resource id (a bf2017 picture job, `desktop-jobs`); the 11 atlases and the remaining mapped boxes resolve; REA reads what the code decides (the mode tiles' pick, the bound fields with no data) | `TextureRef` resolves; the hand rows in `NOTES.md` it can answer are read and replaced |

## Checks

- **Tests** beside each unit, as the table says; under a second each, no network.
- **The pictures.** A new `scripts/bf-ui-shots.mjs` walks Hoth's way in the headless browser and shoots each screen at 1920 × 1080 and at 2560 × 1080 (the frame's bars), beside its reference picture. The evidence README lists each screen, its reference's address and the differences left.
- **The report.** The same run counts what drew nothing (decision 8): textures, icons, fonts. The count only goes down from phase to phase.
- **The speed.** `paint.js` marks each paint (`performance.measure('bf-ui-paint')`); the shots script reports the 95th percentile of each screen's paints and of the HUD's per frame. `scripts/bf-landing-check.mjs` measures the answer to a click during the load.
- **The gates**, before each phase is done: `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`.

## Left out

- The other planets' screens, the Collection's screens and the Starfighter HUD: they stay on `Screen.jsx` until Hoth's way is right.
- The game's UI animations (`UIAnimationGroup`, the schematics' transitions) and its CRT trail (`CrtTrailSettingsAsset`, 11 records): phase 1 draws the states (focus, hover, disabled), not the moves between them. A later design takes them once the static screens match.
- A WebGL painter, a worker canvas (`OffscreenCanvas`) and a second renderer for the DOM: none is built unless the speed numbers fail, and then the failing number is the reason written down.

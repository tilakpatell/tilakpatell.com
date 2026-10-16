# The rules of the architecture

What the code should look like, for a session that has to split a file or decide where something goes. The measure (`scripts/health.mjs`) checks what it can; the lint config and the steward enforce the rest.

## Layers

```
src/data  ←  src/lib  ←  src/lib/three  ←  src/runtime  ←  src/components/<area>  ←  src/pages  ←  App.jsx
```

An arrow points from a module at who may import it. `src/lib` knows no React and no page. `src/lib/three` knows Three.js and nothing about any world. `src/runtime` is the world runtime. `src/data` is imported by anyone and imports nothing but other data.

A renderer, a loop and a post chain are the runtime’s alone. `src/runtime` makes the one renderer (the node renderer, WebGPU first and WebGL 2 under it), asks the browser for frames and steps every world inside them; a world hands it a scene and a step. The measure counts what is left to port: `renderers`, each `new WebGLRenderer(` or `new WebGPURenderer(` in code outside `src/runtime/`, and `loops`, each file that calls `requestAnimationFrame(` outside `src/runtime/`, `src/lib/three/loop.js` and `src/lib/shownLoop.js` (tests left out of both). Each is budgeted and only falls (the engine floor’s design, §4.6).

## Worlds are islands

A world (`src/components/<world>/`) imports from `src/lib`, `src/runtime`, `src/data`, its own files, and another world only through that world's `index.js` or `shared/` folder. Something two worlds need moves down to `src/lib` or `src/runtime`. A world that reaches into another world's props can't be split, lazy-loaded or deleted on its own. The galaxy and the universe lend through `src/components/galaxy/shared/` and `src/components/universe/shared/` (re-exports, a test pinning each face's names). A world the site may drop keeps every row outside its folders that names it marked, and a tested remover that knows them all: the planet flight is the example (`scripts/flight-island.mjs`).

One art a world. Each world and page game says in a `look.js` beside its scene what it is drawn as (`painted`: flat colours on the house look, its code-built props from one palette strip, `lib/three/palette.js`; `scanned`: the core kit's and the CC0 sets' PBR on the house look; `own`: a renderer of its own kind, with its why), which tone mapper it takes and which bloom (`src/components/worlds/looks.js`; `looks.test.js` holds every folder to it). It doesn't wear two: a scan is an import of `lib/three/core`, `lib/cc0` or `lib/hdri`'s `loadPbr`, a ramp is a `MeshToonMaterial` or a `gradientMap`, and a world whose scenes reach both (its whole import closure, other worlds' files included) counts in `art-mix`.

## Size

A file stays under 800 lines; 1,500 is the ceiling the measure counts (`big-files`). A prop file over that splits by what it draws:

```
towns/moria/props.js            →  towns/moria/props/index.js   (re-exports, same names)
                                   towns/moria/props/halls.js
                                   towns/moria/props/bridge.js
                                   towns/moria/props/furniture.js
```

Each part exports builders with the signatures they had; the old path becomes a barrel, so no caller changes in the same pull request. Callers move to the parts in a later run, if ever.

## Logic apart from drawing

A game's rules live in a pure `rules.js` with tests; a scene file composes and draws. Anything that can be tested without a canvas is tested: `rules.js`, `kinds.js`, `budget.js`, anything under `src/lib` or `src/runtime` that imports neither `react` nor `three`.

## Tests go beside the file

`x.js` has `x.test.js`. A test runs under a second and touches no network. A fixture lives in a `fixtures/` folder beside the test.

## A dependency has a page

Every package in `package.json` has a row in `docs/stack/README.md` and a page under `docs/stack/` made from `_template.md`, written before the package is first imported. The measure’s `stack-pages` counts the packages with no row and is budgeted at 0, so a new dependency fails CI until it has one. `node scripts/stack-census.mjs --write` rewrites the index’s counts; `docs/stack/stack.test.js` fails when a page names a file that no longer exists.

A record a world reads is a slice. A `.json` imported statically becomes an object literal in the chunk, which every visitor’s engine parses as JavaScript before the first frame. `client-json-kb` sums the kilobytes of each record over 64 KB a file under `src/` imports so (tests and scripts left out). A big record is sliced at build to the keys its readers read (`scripts/library-slice.mjs`’s shape) or fetched with `?url` and parsed by the browser’s JSON parser.

## Evidence is pictures on the bucket

A binary over 1 MB under `docs/` goes to the bucket by hash through `scripts/assets-publish.mjs` and is linked from the lane’s evidence README, never committed: every clone carries a committed one forever. `doc-binaries` counts the committed files over 1 MB under `docs/` (git’s tree at `HEAD`, so an untracked or edited file in a checkout never moves it); it is budgeted at the count on the day it landed and may only fall.

## A repair changes no pixel

The steward's recipe for a split or a move: shoot the route before (`scripts/autopilot-check.mjs --before`), move the code, keep every export name, run the same route's check after, compare the two screenshots. A changed pixel means the repair is wrong, whatever the numbers say.

## UI

One house UI: the shell, the classic pages, the universe map and every world's HUD agree with one another. The spec is `docs/superpowers/specs/2026-10-07-audience-tours-and-ui-audit-design.md` (sections 5 and 8); the findings it rests on, checked against the code and a designer's eye, are in `docs/research/2026-10-07-tours-and-ui-audit/ui-shell-universe-verified.md`.

1. **Tokens are the only source of a number.** `src/index.css` holds depth (`--z-page` … `--z-top`), time (`--t-fast/base/slow`), type (`--fs-xs` … `--fs-display-1`), the floating shadows, the corner edges, `--page-top` and `--measure`. A page-level `z-index` names its depth (`src/styles/tokens.test.js` fails a bare one of 10 or more); any other hard-coded value carries a comment saying why.
2. **Spacing is the 4 px grid**: whole Tailwind steps; sections `py-14 md:py-20`; the last one `.section-last`; controls 44 px on a coarse pointer (a hit area may be wider than what is drawn), 36 px at least otherwise.
3. **One drawing per concept.** In the shell: `.btn`, `.chip` (and `button.chip`), `.switch` (a pill in a track), `.link` / `.link-quiet` / `.link-hover`, `.kbd`, `CloseButton`, `.notice`, `.dialog-title`, `CopyButton`, `Bullets`, and one icon per meaning from `src/components/icons.js`. On the map: `src/components/universe/hud.css`. In a world: `src/runtime/hud/`. A new surface reaches for these before it draws its own; `kbd-styles` (below) counts the key caps drawn anywhere else.
4. **One word per thing.** The glossary is `src/lib/words.js` (the site) and `src/components/universe/words.js` (the map). `src/lib/words.test.js` reads the shell's and the map's files as the browser would and fails on a retired word; crew lines, in-world signs and the fiction keep their own words.
5. **Text over 3D sits on glass**, never bare (a scrim, or the shadow the nav map gives its names).
6. **Dim by colour, never by fading text below 0.55**: a dimmed item's words read at `--muted` (4.5:1 on every theme); its pictures may go grey.
7. **Copy**: British spelling, curly quotes, sentence case, one sentence to a toast, the key first in a prompt (“G Go in · Burger Mart”), no Oxford comma.
8. **Themes and dark mode**: a shared surface reads the theme's tokens (radius, border, ink), so a square theme squares it and dark mode darkens its shadow; type on a photograph (`.on-photo`) is white in every theme.

The measure's `kbd-styles` counts the CSS rules that draw a key cap outside the house `.kbd` (`src/index.css`); lower is better. It walks `src/**/*.css` itself (the context lists no CSS) and is budgeted at its value once the house `.kbd` and the world kit's cap were one (spec section 8, C1): it may only fall.

## The worlds' HUDs

A world's HUD is built from the kit in `src/runtime/hud/` (`index.js` lists the parts) and imports it from there only. The kit holds the rules (`hud.js`, tested), the frame (`Hud.jsx`), one part per idea (Menu, Prompt, Exit, Objective, Toast, Bubble, QuestList, PlayersChip, Stick, TouchButton, MiniMap, `fitCanvas`) and the tokens (`hud.css`). A world keeps its face: it skins the parts with its own classes, and the kit's rules weigh (0,0,1), so any world class wins.

- **Rows, not sums.** The top row, the foot and the thumbs are laid out by `layoutRows` and measured. A position is a kit token (`--hud-pad`, `--hud-pad-b`, `--hud-pad-l/-r`, `--guide-reserve`, `--guide-clear`, `--hud-under`, `--hud-foot`) or a measurement, never a hand sum of other things' sizes.
- **One of each.** One Menu (the world's settings, Things to do, Controls opening the site's guide, the players chip, the way out read from the view: "Universe map" or "Classic site"); one prompt, key first ("E Go in · Burger Mart"), the button itself on touch; one way out of an inner place (the world's verb, or "Leave", with Esc); one toast, top centre under the top row.
- **Plain values in.** Kit parts take resolved values (a count, a callback, `{ label, to }`); `src/runtime` imports nothing from `src/components`.
- **Readable.** Nothing a player reads while playing is under 0.7 rem. Text over the 3D sits on glass at alpha 0.78 or more, never blurred (a blur over a canvas redrawn every frame costs a frame).
- **Numbers through refs.** A frame loop writes the HUD's numbers into the elements it holds, not into React state.
- **The keys are written once**, in `src/components/guide/pages.js`; a world's Controls opens the guide.
- **Touch.** The kit's Stick (116/46, radial, a dead zone) and TouchButton (76 for one main action, 64, 52); the right column keeps the guide's corner.
- **One key cap.** A HUD's key is the house cap in `src/index.css` (`:where(.hud kbd, kbd.hud-prompt-key, kbd.hud-cap)`): a world sets its ink by colour and its face through `--hud-key-face`, `--hud-key-weight`, `--hud-key-border` and `--hud-key-radius`, never a `kbd` rule of its own.
- **Buttons in the frame take a tap.** The frame is `pointer-events: none`; a world card put inside it turns them back on.

`hud-kit` in the measure counts the worlds whose HUD imports nothing from the kit (its folder, or its own page); it only goes down. At 1: the Death Star, whose trench run is a game inside a scrolling page.

## Never

- Reformat lines you aren't moving.
- Rename for taste.
- Add a dependency to make a number move.
- Raise a budget without a sentence saying why in the commit.
- Skip, quieten or delete a test to get green.

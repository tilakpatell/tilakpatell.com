# The site’s colours, all the way through: dialogs, touch and nights

## Why

The owner asked for every colour to be better, for more interactions, for the whole site to feel better, and for “the dialogs to follow the theme”. Middle-earth is now designed end to end (`2026-10-18-middle-earth-colours-design.md`); the other 36 colours change their tokens and their corners, and the fan colours a heading face, a background and a switch-in. Opening anything that floats drops the colour:

- **Dialog titles are Archivo in every colour.** The colour sheets restyle `.display`, `.title`, `.eyebrow` and `.lead` only; `.dialog-title`, `.tour-title`, `.tour-offer-title`, the settings heading, `.start-title` and `.world-gate-title` never change.
- **The settings sheet is outside the house kit**: not a `.card` (so no Shire frame, Mordor strap, Transformers plate or Rick and Morty ink), its own close button, a black shadow, its title an `h2`, pill segments in square colours, a focus ring in `--accent` (weak on AWS orange) and a bare `z-index: 85`.
- **The veils behind dialogs are a fixed navy** (`rgba(6, 8, 10, 0.5)`, `rgb(2 6 14 / 0.62)`): they grey the parchment of Tortuga and the Shire.
- **The map’s glass is one navy in every colour** (`rgb(6 8 16 / 0.93)`: the universe panel, the start card, the map’s offer, the tour card over the map, the world gate, the loading veil).
- **Pills stay pills** where the colour is square: the house `.switch`, `.close-btn`, the settings segments and close, `.theme-chip`, the guide’s `?`.
- **The Transformers’ plates hide the focus ring.** The chamfer is a `clip-path`, which cuts away the `outline` and every shadow (an accessibility bug).
- **The achievement toast slips under the palette’s dim** (toast `--z-sheet`, palette `--z-dialog`).
- **Only Middle-earth answers a hover or a press.** Elsewhere a primary button darkens 12% (in the dark, a glowing button dims), a card lifts 3px.
- **Settings → Motion: Reduced reaches CSS only.** `prefersReducedMotion()` and `useReducedMotion()` read the system setting alone, so the switch-ins, the route’s kyber head and the effects keep moving for someone who asked them to stop.
- **Hover is not fenced to hover devices**: a tapped card stays lifted on a phone.
- **The scroll bar is a lightsaber for the Caribbean and Rick and Morty**, whose worlds have no sabers.
- **A company pick is a flat slab of its swatch** with white words over it (2.1:1 on AWS orange), the loudest moment on the site for the quietest colours.
- **Ten colours have no night of their own**: AWS, RTX and five projects fall to the house near-black; Pendar, Empowerreg and SRC put navy surfaces on it; the Game Boy’s magenta turns green.
- **Small things**: the colours panel says every colour is a company I’ve worked at (it also holds the fan colours and the visitor’s own); Bose’s near-black dot vanishes on a dark panel; Empowerreg’s dot is a green found nowhere in its colours.

The audit behind this (every overlay in five colours, both modes; the hover, press and focus of 13 colours read from computed styles; the personality of all 38) is in the session’s notes.

## The idea

**Whatever floats wears the colour it floats over.** A dialog is the colour’s own object: the Shire’s is a map in its frame, Mordor’s an iron plate, the Caribbean’s a sea chart, the Jedi’s a holo panel, the Transformers’ a console, Stark’s a HUD, Dunder Mifflin’s a memo, the arcade’s a cabinet bezel, the raga’s hung with marigolds, Rick and Morty’s inked. Companies stay quiet: one hairline of their accent, their corners, their ink.

**Every press answers in the colour’s own way**, by transform and opacity only, held still under reduced motion, and only where there is a pointer to hover.

**Every colour has a night.**

Three pull requests, in this order, each merged before the next starts.

## A. Dialogs follow the colour

### A1. Two tokens for what sits behind

A new eager sheet, `src/styles/dialogs.css`, imported in `src/main.jsx` after `fan-dark-themes.css`, holds them:

- `--scrim-ink` and `--scrim`: the veil behind a dialog. By day the colour’s own ink (`--text`), at 45% behind a dialog, so a warm colour dims warm; at night its deepest ground, darkened, at 72%. The tour’s veil, the nav map’s and the start choice’s take their own share of `--scrim-ink`.
- `--glass`: the dark glass of the map and the worlds, the colour’s brand bar (`--nav-bg`) mixed into the map’s near-black, at 94%; `--glass-solid` the same, opaque (the tour card over the map, where 5% of a white title behind it shows).

Both are declared on `:root`, so they resolve against the colour on `<html>` and a `.dark-scope` island inherits them already resolved. They take the place of the fixed values in the palette’s, the settings’, the tour’s and the nav map’s backdrops, and of the glass of the universe panel, the start card, the map’s offer, the tour card on the map, the world gate and the loading veil. The palette tokens stay plain hex; these two are not palette tokens and may mix.

### A2. One kit for every floating panel

- The settings sheet becomes a `.card` (so every colour’s card dress reaches it), its title a `.dialog-title`, its close the house `CloseButton`; its shadow `--shadow-dialog`; its backdrop `--z-dialog`; its focus rings `--accent-text`.
- The panels carry a `dialog` class (the guide, the settings, the tour card, the colours panel; the palette is matched by its own `.palette`, which its file already carries), so a colour can dress them all with one selector.
- Pills follow the colour: `.switch` and its buttons, `.close-btn`, the settings segments, `.theme-chip` and the guide’s `?` take `--r-btn` (a pill colour keeps its pills).
- The toast rises over a dialog’s dim (`calc(var(--z-dialog) + 2)`), under the tour and the covers.

### A3. Titles in the colour’s face

Every panel title (`.dialog-title`, `.tour-title`, `.tour-offer-title`, `.start-title`, the map panel’s `.universe-title`, `.world-gate-title`, and the switch-in’s quote) speaks in its colour’s face, in a readable cut: the display faces that can’t be read at 18px (Aurebesh, Cybertron Script) give way to the family’s second face.

| family | face | treatment |
| --- | --- | --- |
| Star Wars | News Cycle | bold capitals, tracked 0.12em |
| Transformers | Orbitron | 800, capitals, tracked 0.08em |
| Caribbean | Pirata One | a size up |
| Middle-earth | Cinzel | 700 |
| Rick and Morty | Luckiest Guy | tracked 0.02em |
| Stark | Bebas Neue | a size up, tracked 0.03em |
| Dunder Mifflin | Courier Prime | 700 |
| Arcade | Press Start 2P | its size cut by `font-size-adjust` |
| Raga | Yatra One | |
| Heisenberg | the house face | its first letter an element tile, as on the page |

The faces are the ones each colour already loads; no new font.

### A4. The colours’ dress

All CSS, drawn on the panel’s `::before` (Middle-earth’s cards use `::after`), `pointer-events: none`, nothing animated:

- **Companies.** AWS: one orange hairline along the top. RTX: the drafting sheet’s four red corner marks. Bose: no border, its shadow only. Pendar: the spectrum as the top hairline. Empowerreg: a lime hairline. SRC: the title in mono capitals, tracked wide.
- **Projects** (their own pages): Shell, a green top band and the title in mono; NVIDIA, a green top rule and capitals; Claude, the title in a serif and a warm glow in the corner.
- **Star Wars.** A holo panel: four corner brackets in the saber’s colour; the Sith’s at night with a red under-glow.
- **Caribbean.** A sea chart’s double rule inside the edge and a compass rose faint in the foot’s corner; the Dutchman’s at night glows sea-green.
- **Middle-earth.** Its frame and strap now reach the settings sheet and the colours panel.
- **Transformers.** The plate’s bevel without a clip: where the browser can (`corner-shape: bevel`), the corner is cut by the border itself, so the border, the shadow and the focus ring follow it; elsewhere the clip stays and the focus ring moves inside the plate (`outline-offset: -4px`). An energon line along the top.
- **Rick and Morty.** The ink outline at night as well as by day (a black stroke, an offset shadow in the colour).
- **Stark.** A HUD: cyan corner brackets, a cyan hairline at night, a gold head rule by day.
- **Dunder Mifflin.** A memo: the company’s letterhead rule along the top.
- **Arcade.** A cabinet bezel: a hard offset shadow in the marquee pink.
- **Raga.** A marigold garland along the top edge.
- **Heisenberg.** A lab-green edge.

The palette’s chosen row follows too: a blade (Star Wars), energon cells (Transformers), a brass ◆ (Caribbean), a highlighter stroke (Dunder Mifflin), a ▶ (arcade and Game Boy), inverse video (Shell), a goo bar (Rick and Morty), a diya’s dot (raga).

### A5. Tooltips in the house’s own face

The nav’s icons name themselves with the browser’s grey `title` box. They get a house tooltip instead (`data-tip`, drawn in CSS on `::after`, the colour’s surface, ink and corners, shown on hover and on keyboard focus, never on touch) and keep their accessible names.

## B. Every press answers

### B1. The visitor’s motion setting reaches the code

`prefersReducedMotion()` and `useReducedMotion()` (`src/lib/hooks.js`) also answer yes when `<html data-motion="reduced">`, and the hook re-reads when the setting changes; `src/fun/effects.js` and the few files that asked the browser themselves use the shared helper, and the page’s first script puts the setting on `<html>` before anything reads it. Every caller follows.

### B2. Hover where there is hover

The house’s hover lifts and every new hover sit inside `@media (hover: hover)`. In the dark a primary button glows where it darkened (a ring and a halo of its own colour: a lit thing glows when you reach for it), for every colour without a hover of its own. Tailwind’s `hover:` styles apply only where there is hover (`hoverOnlyWhenSupported`).

### B3. The families’ feel

A new eager sheet, `src/styles/feel.css`. Transform and opacity only, never layout; nothing filtered that moves; reduced motion leaves only the colour change; focus at least as visible as hover.

| family | hover | press |
| --- | --- | --- |
| Companies | a hairline draws in under a primary button’s label | the house press |
| Star Wars | a blade ignites along a primary button’s foot (the Sith’s flickers once) | |
| Caribbean | a card rides a swell (a lift and a slight roll) | |
| Transformers | the plate’s bevel deepens | a clunk: 1px down |
| Rick and Morty | the inked button and card lean in (a bigger offset) | they press flat into the page |
| Stark | brackets close in on a card’s corners | |
| Dunder Mifflin | | a stamp’s press (a dip and a tilt) |
| Arcade | | the button drops into its shadow |
| Raga | a ring spreads from a primary button | |
| Heisenberg | a primary button’s edge goes lab green | |

### B4. Two new scroll bars

- **The Caribbean: a spyglass.** A brass eyepiece for the hilt, three drawn tubes for the blade, a lens glint at the tip (verdigris and barnacles on the Dutchman).
- **Rick and Morty: the portal gun.** A grey body with its green bulb, a beam of portal fluid, a small green portal spinning at the tip.

## C. Every colour has a night, and a quiet arrival

### C1. Nights

AWS (squid ink), RTX, DevSpace, Shell, FUSE, Finance, PyTorch and NVIDIA get a dark palette of their own (`src/styles/house-nights.css`); Bose, Pendar, Empowerreg and SRC a ground to match their surfaces; the Game Boy keeps its magenta at night. All are held to the floors by `colours.test.js`, whose night test widens from the fan colours to every colour.

### C2. The company switch-in

The flat slab gives way to the company’s own: its brand bar’s dark, its mark drawn once in its accent (AWS’s smile, RTX’s drafting corners, Bose’s ring, Pendar’s spectrum, Empowerreg’s graph, SRC’s sweep), the company’s name in white (12:1 or more) and the role under it from `data/roles.js` (“Technical Infrastructure PM Intern”). Under 1.1 seconds, no sound, skippable like the others. The visitor’s own colour gets a colour wheel that settles on their colour, with its hex.

### C3. Small mends

- The colours panel’s line says what it holds: “The companies I’ve worked at, your own colour and the ones you find along the way.”
- Every colour’s dot keeps an edge drawn from the ink (`.swatch-dot`), so Bose’s near-black shows on a dark panel; Empowerreg’s dot is its lime. The never-defined `THEMES[id].fill` the panel read goes.

## What doesn’t change

The tokens’ values (but the new nights), the switch-in scenes of the fan colours, the backgrounds, Middle-earth’s sheet (but the dialog title), the unlocks, the voices, `src/pages/MiddleEarth.jsx`.

## Checks

`npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`, and screenshots of the palette, the settings, the guide, the colours panel and the tour in AWS (light), the Shire (dark), Optimus (light), Portal (dark) and Tortuga (light), before and after; the focus ring on an Optimus button; a phone’s settings sheet.

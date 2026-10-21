# Middle-earth colours: the Shire and Mordor, done properly

## Why

The owner asked for the Lord of the Rings colours to be made “super super nice”, from the films’ and the books’ art. Today they are the thinnest fan colours on the site:

- one block of light tokens each, and **no dark mode**: in dark both fall to the shared near-black (`#09090b`) with a lime or orange accent;
- Mordor’s light mode is white, which is no Mordor;
- the type is Cinzel at three levels, the same for both, and nothing else changes;
- the live background (`components/ambience/scenes/middleearth.js`) is three sine lines and a circle for the Shire, and for Mordor a thin pole (Barad-dûr) standing on the route line at the left;
- the drawn backdrop (`worlds/Backdrops.jsx`) is a jagged ridge with a 15px door;
- both colours play the same switch-in, the One Ring on an ember ground, and its inscription is cut off;
- Sting glows blue in the Shire (where no orc is near) and orange in Mordor (where it should blaze blue);
- every chapter page under `/middle-earth/…` wears AWS, because route colours match the path exactly.

The research behind the choices below (the films’ grade and art direction, Tolkien’s own jackets and maps, Alan Lee, John Howe and Ted Nasmith, open-licence type) is in the session’s notes; the motifs are borrowed, never the images.

## The idea

**The Shire is a book.** Warm parchment, door-green ink, red map capitals and one brass knob of light: the 1937 *Hobbit* jacket’s flat colours, the films’ sepia maps and the warm amber-green grade of the first film (not the greener regrade).

**Mordor is iron and ash.** Depth from steps of value; fire the only hue. Tolkien’s black, grey and red designs, Howe’s stacked battlements, the films’ ash grade.

**One sword links them.** Sting is the same blade in both. In the Shire it only catches the light; in Mordor it blazes elven blue, the one cool thing on a Mordor page.

## What changes

### 1. A sheet of their own

The Middle-earth colours leave `src/styles/extras.css` (1,083 lines, past the 800-line rule) for a new eager sheet, `src/styles/middleearth-themes.css`, imported in `src/main.jsx` after `caribbean-themes.css`. It holds the tokens, the type, the ornaments, the selection colour and Sting. `src/styles/tokens.test.js` adds it to `SHEETS`.

### 2. Tokens, light and dark

Each mode sets the whole set (the house dark block otherwise turns accent, accent-text and the button into `--saber`). Every text pair is 4.5:1 or more on `--bg`, `--bg-deep`, `--surface` and `--surface-2`; `--btn-ink` on `--btn-bg` 4.5:1; `--border-strong` and `--accent` 3:1 on `--bg`. A test holds them to it (section 9).

| token | Shire light, “Hobbiton at golden hour” | Shire dark, “A summer night on the Hill” | Mordor light, “Ash-fall over Gorgoroth” | Mordor dark, “Under the Eye” |
| --- | --- | --- | --- | --- |
| `--bg` | `#f5efdd` | `#10140e` | `#ece8e1` | `#100c0b` |
| `--bg-deep` | `#ebe1c5` | `#0b0e09` | `#dfd9cf` | `#090706` |
| `--surface` | `#fcf9ef` | `#171c14` | `#f6f4ef` | `#181311` |
| `--surface-2` | `#f0e8d2` | `#20271b` | `#e4ded4` | `#221b18` |
| `--border` | `#ddd0af` | `#2e3826` | `#ccc4b8` | `#322825` |
| `--border-strong` | `#8c7853` | `#6a7552` | `#7d736a` | `#7a6c63` |
| `--text` | `#241a0e` | `#f3ecd4` | `#141110` | `#f0e8df` |
| `--text-body` | `#3d2e1b` | `#d9d2b6` | `#2e2926` | `#d2c8bd` |
| `--muted` | `#67533a` | `#a8a487` | `#5c5450` | `#9c9087` |
| `--accent` | `#3c6b35` | `#d4ae45` | `#c2381a` | `#ff7a1a` |
| `--accent-text` | `#2f5a2e` | `#e2be5c` | `#9e2a15` | `#ff8c3f` |
| `--btn-bg` | `#2f5a2e` | `#d4ae45` | `#8e1b12` | `#ff8a1e` |
| `--btn-ink` | `#fbf4de` | `#16130a` | `#f6efe6` | `#140c08` |
| `--saber` (selection) | `#f2c14e` | `#f5c866` | `#ff7a1a` | `#ff7a1a` |
| `--route-plan` | `#cdbe96` | `#36402c` | `#c4bbaf` | `#3a312d` |

Shapes belong to the colour, not the mode:

- **Shire:** soft corners (`--r-card` 18px, `--r-panel` 14px, pills for buttons and chips, `--r-photo` 24px); the route marker is a **leaf** (`inset(0 round 0 100% 0 100%)`, a Lórien leaf); the route dashes 6px/5px, like the road on the map.
- **Mordor:** forged corners (every `--r-*` 2px); the marker is **the Eye’s almond** (`polygon(0 50%, 18% 24%, 50% 10%, 82% 24%, 100% 50%, 82% 76%, 50% 90%, 18% 76%)`); the route dashes 2px/4px.

`meta[name=theme-color]` follows the page: the provider reads `--bg` once the colours land (every colour gains from this).

### 3. Type

Cinzel stays, as carved: Cinzel Decorative for the page titles, Cinzel for the other headings and the eyebrows (the Roman capitals of the maps). A bookhand and a blackletter (Almendra, Grenze Gotisch) were tried and set aside on the owner’s word: the old capitals read better. The inks change: door green by day and a brass gradient at night for the Shire’s titles (`background-clip: text`, solid `#e8c766` fallback, dropped in print, forced colours and the dark islands); iron by day and parchment lit from below at night for Mordor’s. Shire eyebrows are rubric red (`#9a3024`; dark `#e39c7e`); Mordor’s open on a small seal. Body text stays Archivo.

### 4. Paper, ash and ornaments

All CSS, no images, no blend modes, nothing animated but a glint:

- **Grain.** A tiled inline-SVG `feTurbulence` noise on `html` and `body` (so it holds whether the live background has moved the page colour to `<html>` or not): sepia at 5% for the Shire (3.5% in dark), coarser grey ash at 6% for Mordor (5% in dark). A warm vignette at the Shire’s edges; an ember underglow at the foot of a dark Mordor page.
- **Cards.** Shire: the map frame, a second hairline 4px inside the border (`inset` shadows), a soft sepia shadow in light. Mordor: a 3px iron strap along the top edge that heats to blood red (light) or ember (dark) on hover, and a hard short shadow in light.
- **Buttons.** Shire: the round door, a pill with a brass inner ring and a 2px sill. Mordor: a square slab; in the dark an ember glow on hover. Never a clip-path on a button: it clips the focus ring.
- **Dividers** (`.divider`). Shire: a hedgerow, a row of small scallops in the leaf green. Mordor: an iron strap with rivets.
- **Selection.** Shire: honey gold. Mordor: ember. Focus rings stay `--accent-text`.

### 5. Sting

The hilt is Frodo’s in all four: a leather wrap and a curved brass guard. The blade is steel. Only the light changes:

- **Shire:** no glow (no orcs near), a warm glint; in the dark, lamplight on darker steel.
- **Mordor:** elven blue, stronger in the dark, pulsing slowly (the pulse is a glow layer’s opacity, not an animated filter, and it holds still under reduced motion).

### 6. The switch-in

Two new scenes replace the shared `ring` in `components/ThemeTransition.jsx`, about 2.4s each, both skippable, both over the `lotr` clip as now, the words in each colour’s own face:

- **Shire, “The round door”** (`kind: 'door'`). A green round door of planks in its frame, the brass knob in the middle catching the light; it swings in on its left hinge and gold light pours through the circle; low hills and a smoke thread rise inside it; the circle grows until the page shows through. Galadriel’s line stays (its voice exists).
- **Mordor, “The Eye opens”** (`kind: 'eye'`). Dark, then a hairline of fire, the lids of the Eye; they part on a fiery iris; the slit pupil narrows; a ring of our own fire-glyphs (not Tengwar, not the inscription) heats around it; the Eye shuts and the slit opens into the page. “One Ring to rule them all.” stays.

Reduced motion keeps the words, as every scene does. The `ring` kind’s ember background leaves `extras.css`.

### 7. The live background

`components/ambience/scenes/middleearth.js` keeps its contract (fields, bursts, the Eye that follows the pointer and sweeps its beam, the fireworks and the dragon); its `LANDS` shader is redrawn, and Barad-dûr becomes a model:

- **The Shire.** A low sun (a moon in the dark, and a few stars); the Misty Mountains faint and blue at the back; rolling downs, lighter and yellower with distance; hedgerows along the crests; the Party Tree on a far hill; the Hill at the side with its round green door, brass knob, round window (lit at dusk, and every window lit in the dark) and a smoke thread from a chimney.
- **Mordor.** A smoke-filled sky, red at the horizon; jagged ridges in steps of value; Mount Doom with lava seams, a glowing crater, gullies and a plume; an ash plain.
- **Barad-dûr in three dimensions** (`scenes/baradDur.js`, `baradDurView.js`, `sauronEye.js`): one merged, faceted mesh built at start (tiers turned against each other, spike fringes, ribs, blade buttresses, needle spires, the crown’s two spurred horns), lit by the Eye’s fire, by Doom from the left and by the ash sky, its glow a small table repainted only when the mode changes; the Eye is sprites painted once, flickering by scale and opacity. It stands at the right, clear of the route line, drawn between the backdrop’s passes so the near ridge hides its foot. About 4,300 triangles and nine draw calls for the whole scene on a strong computer, 2,900 on a mid one; weak devices never load the live background.
- **A mist over the words.** By day the land behind the page’s left column shows at a quarter of its strength (seven tenths at night), so the muted line under the hero keeps 4.5:1.

No new `ShaderMaterial`: the GLSL is the same `backdrop()`; the tower is standard materials, so `glsl-sites` doesn’t move.

### 8. The drawn backdrop

`MiddleEarth` in `components/worlds/Backdrops.jsx` (the hero’s skyline when the live background is off or the device is weak) is redrawn to the same compositions in SVG, its colours in `styles/lazy/worlds.css` for both modes.

### 9. Chapter pages and a test

- `src/theme/themes.js` gains `routeTheme(pathname)`: an exact match first, then the longest prefix, so `/middle-earth/bree` wears the Shire and `/middle-earth/mordor` Mordor. `ThemeProvider` calls it. (`src/pages/MiddleEarth.jsx` is untouched; PR #1023 holds it.)
- `src/theme/themes.test.js` tests `routeTheme`; `src/styles/middleearth-themes.test.js` holds every Middle-earth token pair to the contrast floor in both modes, reading the sheet and resolving the house dark block as the cascade does.

### 10. Small mends that come with it

- The One Ring’s inscription is cut off wherever it is drawn on a path: it gets `textLength` (and `lengthAdjust`) so the whole line fits (`components/middleearth/Ring.jsx`, `components/interests/cards.jsx`).
- The hub’s title keeps its map ink: the Shire’s display colour no longer outranks `.me-hub-title`.

## What doesn’t change

Body text, the house layout, the unlock word (`mellon`), the quotes and their voices, the ambience’s fields and its plumbing (the engine floor’s FL2 lane owns that), `src/pages/MiddleEarth.jsx`, `CommandPalette.jsx` and `Achievements.jsx` (the Road’s first lane edits those).

## Checks

`npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`; before and after screenshots of `/home` in all four combinations, with and without the live background, at desktop and phone width; the two switch-ins caught mid-scene; `/middle-earth` and a chapter page.

## Then: every other colour

A second change, after this one merges: a dark mode of its own for each fan colour that lacks one (22 of 38 fall to the shared near-black), the button labels under 4.5:1 (finance, pytorch, summer), the Caribbean switch-in that shows the raga’s सा, the photo corners that disagree with their cards, RTX’s promised square buttons, and the contrast test widened to every colour.

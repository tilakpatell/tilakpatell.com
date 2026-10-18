# Middle-earth colours Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Shire and Mordor colours the richest on the site: full light and dark palettes, their own type, paper and ash, a lore-true Sting, two new switch-ins, a redrawn live background and drawn backdrop, and route colours for the chapter pages.

**Architecture:** The colours move into their own eager sheet, `src/styles/middleearth-themes.css`; a pure `routeTheme()` in `src/theme/themes.js` replaces the exact route lookup; the switch-ins are two new kinds in `ThemeTransition.jsx`; the live background keeps `backdrop()` and gets new GLSL; the drawn backdrop is SVG in `Backdrops.jsx`.

**Tech Stack:** React 19, CSS custom properties, Vite, vitest, three.js (`components/ambience/kit.js`), `@fontsource`.

**Spec:** `docs/superpowers/specs/2026-10-18-middle-earth-colours-design.md`

## Global Constraints

- Token values: exactly the spec’s table in section 2; every text pair 4.5:1 on `--bg`, `--bg-deep`, `--surface`, `--surface-2`; `--btn-ink` on `--btn-bg` 4.5:1; `--border-strong` and `--accent` 3:1 on `--bg`.
- Fonts: `@fontsource/almendra` (700), `@fontsource/eb-garamond` (400-italic), `@fontsource/grenze-gotisch` (800), `@fontsource/grenze` (400, 600), all `^5.3.0`, loaded only through `THEME_FONTS` in `src/theme/ThemeProvider.jsx`; each gets its census row (`node scripts/stack-census.mjs --write`) and a `FONT_NAMES` entry in `scripts/credits.mjs`, then `npm run credits`.
- Grenze Gotisch never below title size. Body text stays Archivo.
- No new `ShaderMaterial`, `requestAnimationFrame`, renderer or `eslint-disable` (budgets `glsl-sites` 619, `lint-disables` 54 have no headroom to spend).
- Do not edit `src/pages/MiddleEarth.jsx`, `CommandPalette.jsx`, `Achievements.jsx`, `components/ambience/{Ambience,Layer,kit}.js*`.
- Copy and comments: British spelling, curly quotes (’ “ ”), the file’s voice; visitor text says “colours”, never “theme”.
- Every animation still under `prefers-reduced-motion`; no clip-path on focusable buttons; `--r-card` stays one length.
- Only original drawing: motifs, never traced film or book images; never the real Ring inscription in the new scenes.

## Review Focus

1. Language mode (`html[data-script='runes']`): its `!important` font override must still win over the new faces.
2. The live background moves the page colour to `<html>` (`html[data-ambience] body { background: transparent }`): the grain must show once, with or without it, and never cover text.
3. Reduced motion: both switch-ins show the words only; Sting’s pulse holds still.
4. A 390px phone: the drawn backdrop’s focal shapes inside the visible slice (x 300–1140 of 1440), headings in Grenze Gotisch and Almendra wrap without overflow, the switch-in fits.
5. Text on a photo stays white (`.on-photo .display` in `extras.css`), and the Middle-earth hub title keeps its map ink (`.me-hub-title`).

---

### Task 1: Route colours for the chapter pages, and the browser’s bar colour

**Files:**
- Modify: `src/theme/themes.js` (after `ROUTE_THEMES`)
- Modify: `src/theme/ThemeProvider.jsx:100` and `:127-129`
- Create: `src/theme/themes.test.js`

**Interfaces:**
- Produces: `routeTheme(pathname: string): string | undefined` exported from `src/theme/themes.js`; `ROUTE_THEMES` gains `'/middle-earth/mordor': 'mordor'`.

- [ ] **Step 1: Write the failing test** `src/theme/themes.test.js`, `describe('routeTheme')`:
  - `routeTheme('/middle-earth')` → `'shire'`; `'/middle-earth/bree'` → `'shire'`; `'/middle-earth/mordor'` → `'mordor'`; `'/caribbean'` → `'tortuga'`; `'/projects/devspace'` → `'devspace'`; `'/home'` → `undefined`; `'/middle-earthly'` → `undefined` (a prefix ends at a `/`); `''` and `undefined` → `undefined`.
- [ ] **Step 2: Run** `npx vitest run src/theme/themes.test.js` — FAIL, `routeTheme` is not exported.
- [ ] **Step 3: Implement** `routeTheme`: exact key first, else the longest `ROUTE_THEMES` key `k` with `pathname.startsWith(k + '/')`.
- [ ] **Step 4: Use it** in `ThemeProvider.jsx:100` (`routeTheme(pathname)` in place of `ROUTE_THEMES[pathname]`), and set the meta `theme-color` from the computed `--bg` of `<html>` in an effect on `[active, mode]` (read after the two-frame `theme-switching` window, i.e. in a `requestAnimationFrame`), falling back to today’s two values.
- [ ] **Step 5: Run** `npx vitest run src/theme` — PASS.
- [ ] **Step 6: Commit** `Route colours reach the chapter pages; the browser bar takes the page’s colour`.

### Task 2: The sheet: tokens, type, paper, ornaments, Sting

**Files:**
- Create: `src/styles/middleearth-themes.css`
- Modify: `src/styles/extras.css` (remove `709-722` Middle-earth tokens and the ring background, `761-767` Middle-earth headings, `869-875` Sting rules; keep everything else byte for byte)
- Modify: `src/main.jsx:8` (import after `caribbean-themes.css`), `src/styles/tokens.test.js` (`SHEETS`), `src/theme/ThemeProvider.jsx:16-20` (`cinzel` loader becomes per-colour loaders), `package.json`, `docs/stack/README.md`, `scripts/credits.mjs:118`, `CREDITS.md`
- Create: `src/styles/middleearth-themes.test.js` (the contrast block, in its own file so it never collides with Task 1’s test)

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `.saber-progress[data-kind='sting']` markup unchanged (`.hilt`, `.blade`), so `ScrollSaber.jsx` needs no change; the class names Task 3’s scenes may reuse: none.

- [ ] **Step 1: Write the failing test** in `src/styles/middleearth-themes.test.js`, `describe('the Middle-earth colours')`: read `src/styles/middleearth-themes.css`; parse the four blocks `[data-theme='shire']`, `html[data-mode='dark'][data-theme='shire']`, `[data-theme='mordor']`, `html[data-mode='dark'][data-theme='mordor']`; for each assert every token of the spec’s table is set, and with `contrast` from `src/theme/custom.js`: `--text`, `--text-body`, `--muted`, `--accent-text` ≥ 4.5 on each of `--bg`, `--bg-deep`, `--surface`, `--surface-2`; `--btn-ink`/`--btn-bg` ≥ 4.5; `--border-strong`/`--bg` and `--accent`/`--bg` ≥ 3. Also assert the sheet has no `!important` in a `font-family` declaration (Review Focus 1).
- [ ] **Step 2: Run** `npx vitest run src/styles/middleearth-themes.test.js` — FAIL, the sheet does not exist.
- [ ] **Step 3: Write the sheet** from spec sections 2–5: the four token blocks; shapes (`--r-*`, `--marker`, `--route-dash`, `--route-gap`); type (`.display`, `.title`, `.eyebrow`, `.lead`), with the Shire `.display` colour under `:where([data-theme='shire']) .display` so `.me-hub-title` and `.on-photo .display` keep theirs (Review Focus 5); grain as a data-URI `--me-grain` on `html` and `body` (Review Focus 2); the vignette and the dark Mordor underglow on `html`; cards, buttons, `.divider`, `::selection`; Sting’s hilt, blade and per-colour glow (the pulse an opacity animation on `.blade::after`, off under reduced motion).
- [ ] **Step 4: Fonts**: `npm install @fontsource/almendra@^5.3.0 @fontsource/eb-garamond@^5.3.0 @fontsource/grenze-gotisch@^5.3.0 @fontsource/grenze@^5.3.0`; `THEME_FONTS.shire` loads Almendra 700, EB Garamond 400-italic and Cinzel 600; `THEME_FONTS.mordor` Grenze Gotisch 800 and Grenze 400 and 600; census and credits as in Global Constraints.
- [ ] **Step 5: Move**: delete the moved blocks from `extras.css`; import the sheet in `main.jsx`; add it to `SHEETS`.
- [ ] **Step 6: Run** `npx vitest run src/theme src/styles src/lib/words.test.js docs/stack` — PASS. Then screenshot `/#/home` in the four combinations (sessionStorage `tp-theme-pin`, localStorage `tp-mode`, `tp-start` `"home"`, `tp-intro` `1`) with `tp-ambience` `off` and look at them.
- [ ] **Step 7: Commit** `The Shire and Mordor colours get a sheet of their own, with light and dark, type, paper and a lore-true Sting`.

### Task 3: The switch-ins: the round door and the Eye

**Files:**
- Modify: `src/components/ThemeTransition.jsx` (`SCENES.shire`, `SCENES.mordor`, `LENGTH`, `Scene`/`Badge`; `OneRing` and the `ring` kind go)
- Modify: `src/styles/lazy/themetransition.css` (the `ring` rules go; `door` and `eye` come)

**Interfaces:**
- Consumes: the fonts Task 2 loads (`'Almendra'`, `'Grenze'`), with serif fallbacks so the scene stands alone.
- Produces: `kind: 'door'` (shire) and `kind: 'eye'` (mordor), each `LENGTH` 2400.

- [ ] **Step 1: Draw the door** (spec section 6): an inline SVG, planks clipped to a circle, frame, hinge, brass knob with a glint; the leaf swings on its left hinge (`transform-origin` at the hinge, `scaleX` to near 0); a radial of gold light inside the circle with low hill bands and a smoke thread rising; the overlay’s circle grows to reveal the page. Light mode opens on sunlight, dark mode on lamplight (`html[data-mode='dark'] .tt[data-kind='door']`).
- [ ] **Step 2: Draw the Eye**: fire hairline, lids parting (an almond mask scaling in `y`), radial iris, flame lashes, a slit pupil that narrows, a ring of twelve invented fire-glyph paths heating once, the Eye shutting, the slit opening into the page; ash in light, embers in dark.
- [ ] **Step 3: Words** in each colour’s face (`.tt[data-kind='door'] blockquote` Almendra, `eye` Grenze); reduced motion unchanged (words only).
- [ ] **Step 4: Run** `npx vitest run src/lib/words.test.js src/styles` — PASS; `npm run lint` — clean.
- [ ] **Step 5: Look**: type `mellon`, then `mordor`, on `/#/home` in both modes and screenshot at 0.6s, 1.2s and 1.9s; with `reducedMotion: 'reduce'` once.
- [ ] **Step 6: Commit** `The Shire’s switch-in opens a round door; Mordor’s opens the Eye`.

### Task 4: The live background

**Files:**
- Modify: `src/components/ambience/scenes/middleearth.js` (the `LANDS` GLSL, its uniforms and `recolor`; Barad-dûr’s place in `step`)

**Interfaces:**
- Consumes: `backdrop`, `field`, `bursts`, `silhouette`, `rgb` from `../kit` (unchanged).
- Produces: the same `create(canvas, ctx)` contract.

- [ ] **Step 1: Redraw the Shire** (spec section 7) in `LANDS`: sky glow and low sun (moon and a few stars in the dark), faint Misty Mountains, three or four downs lighter with distance, hedgerow crests, the Party Tree on a far hill, the Hill at one outer third with door, knob, round window (lit at dusk, all windows lit in the dark) and a chimney’s smoke.
- [ ] **Step 2: Redraw Mordor**: noise smoke and a red horizon, stepped ridges, Mount Doom at one outer third with pulsing lava seams and crater glow, Barad-dûr at the other outer third (stepped, spiked, two horns round the Eye), an ash plain. Move the Eye’s place in `step` to match.
- [ ] **Step 3: Run** `npx vitest run src/components/ambience` — PASS; `node scripts/health.mjs --only glsl-sites` — 607.
- [ ] **Step 4: Look**: `/#/home?quality=high` in the four combinations, 6s settle, desktop and 390px; the middle third stays quiet behind the text.
- [ ] **Step 5: Commit** `The Shire’s live background gets its downs, its Hill and its door; Mordor its Doom and its tower`.

### Task 5: The drawn backdrop, and the inscription

**Files:**
- Modify: `src/components/worlds/Backdrops.jsx:24-65` (`MiddleEarth`), `src/styles/lazy/worlds.css:3-7`
- Modify: `src/components/middleearth/Ring.jsx` and `src/components/interests/cards.jsx` (the inscription’s `textPath`)

**Interfaces:**
- Produces: `MiddleEarth({ variant, className })` unchanged.

- [ ] **Step 1: Redraw** `MiddleEarth` to spec section 8 (the same compositions as Task 4), focal shapes inside x 300–1140 (Review Focus 4), colours as CSS variables for both modes in `worlds.css`; flicker and smoke under `prefers-reduced-motion: reduce` off.
- [ ] **Step 2: Fit the inscription**: on each `textPath`, `textLength` equal to the path’s length less the start offset and `lengthAdjust="spacingAndGlyphs"`.
- [ ] **Step 3: Run** `npm run lint` and `npx vitest run src/components/middleearth src/components/interests` — PASS.
- [ ] **Step 4: Look**: `/#/home` with `tp-ambience` `off`, four combinations, desktop and 390px.
- [ ] **Step 5: Commit** `The Shire’s drawn hills and Mordor’s skyline, redrawn; the Ring’s inscription fits its band`.

### Task 6: Whole-branch check

- [ ] `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build` — all clean.
- [ ] Before and after screenshots side by side (the befores from `main`), `/#/home`, `/#/middle-earth`, `/#/middle-earth/bree`, four combinations, desktop and phone.

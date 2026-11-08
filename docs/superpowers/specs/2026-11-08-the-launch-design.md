# The launch: the welcome, a quick tour and the intro, with the universe made behind them

**Date:** 2026-11-08 · **Where:** `src/components/launch/`, `src/lib/mapReady.js`, `index.html`, `src/App.jsx`, `src/components/universe/UniverseMap.jsx`, `src/components/cockpit/Cockpit.jsx` · **Decision:** [the launch makes the universe behind it](../../decisions/2026-11-08-the-launch-makes-the-universe-behind-it.md)

## What the owner asked

Every visit to the front door opens on the portfolio's welcome, first visits and returns alike. Then a quick tour, skippable as before, the whole page. All of it in parallel with the universe's shaders, so whoever finishes isn't left waiting on them. And the whole launch cleaned up.

The owner's three answers, in order: the quick tour comes first, then the crawl and the cockpit as before (each skippable); a return's welcome offers the universe first with the intro beside it; a visitor who last read the classic site is offered it first, and nothing 3D is fetched for them until they pick the universe.

## The flow

```
first visit   welcome ─ Start the intro ─▶ quick tour ─▶ crawl ─▶ cockpit ─▶ arrival ─▶ universe
                 │                            │ Skip the intro / Esc ─────────────▶ arrival
                 ├ Skip to the universe ─────────────────────────────────────────▶ arrival
                 └ Go to the classic site ─▶ /home
return        welcome back ─ Enter the universe ─▶ arrival ─▶ universe
                 ├ Replay the intro ─▶ quick tour ─▶ …
                 └ Open the classic site ─▶ /home
classic pick  welcome back ─ Open the classic site (first) · Enter the universe · Replay the intro
reduced motion: the tour ends in the arrival (no crawl, no cockpit)
```

- **Who gets it:** `index.html` sets `html[data-intro]` to `1` on a first visit and `back` on a return, at the front door only (`/`, no deep link), and covers the page until the welcome shows. A return driven by a script (`navigator.webdriver` with `tp-intro` set) goes straight in, as the check scripts always have.
- **The welcome** (`Welcome.jsx`, `rules.js`'s `waysIn`): the same title card, its main button by the visit and the view last picked; a line under the buttons says how the universe is getting on (“Getting the universe ready · 42%”, then “The universe is ready”). Whichever is picked is kept as the front door's choice (`saveStart`). Esc skips a first visit to the universe and takes a return's main way in.
- **The quick tour** (`QuickTour.jsx`, `cards.js`): five cards over the welcome's sky, read in about half a minute (the universe; stations are pages; planets are worlds; flying; the nav map, search and the guide). Next and Back or the arrow keys; Skip the tour goes on to the crawl; Skip the intro and Esc go to the arrival. Seen, it counts as the tour offer made (the map doesn't offer a longer one over it; the guide has them) and its flying card as the map's first-flight basics.
- **The arrival** (`Arrive.jsx`, `rules.js`'s `arrival`): the welcome's sky and the map's own bar, kept until the map is made; then the page is uncovered under the card, so the map's first frame is drawn beneath it, and the card fades once that frame is drawn. After 20 s on one wait, Go in anyway. Off the map (the classic site) it lets go at once; with no map at all after 4 s, it uncovers.
- **The cockpit:** its white at the flash holds up to 2 s for the map to be made as well as the ship (`waitOut`); it uncovers the page only once the map is made (`onReveal`, the launch's). If the map still isn't made, the white clears onto the arrival.

## The map's readiness (`lib/mapReady.js`)

`none → loading → ready → drawing`. The map (`UniverseMap.jsx`) says `loading` while it's meant to show in 3D and isn't drawing, with the runtime's prepare progress as its bar; `ready` once the runtime has begun it (status `ready`: made and prepared) and its own `ready` (every shader) has come; `drawing` at its first frame, or at once with nothing to draw (3D held, off or failed). The runtime draws nothing while the page is covered, so a map made under the cover waits at `ready` until it's uncovered.

## What was measured before

Headless Chromium on SwiftShader at 1440 × 900, the dev server (so slower than the live site, but the same order of things):

- A return visit had no welcome: the map's loading screen for 7 s (“Compiling shaders 15%” for most of it).
- A first visit that skipped the welcome early still waited 5.5 s on the loading screen.
- A first visit that skipped late found the loading screen gone and the map not drawn: 3.6 s of black while the first frame was made, the map coming in without its glow and names.
- After the map, the tour offer (5, 10 or 12 minutes) and the first flight's basics came one after another.
- The launch's logic was in five places: `index.html`, `App.jsx`'s `IntroJump`, `Universe.jsx`'s `StartChoice`, `TourHost`'s offer and the map's `prepFrame`.

## After

Same rig: a first visit that reads the tour finds the universe ready by the third card; Skip the intro then reaches the drawn map in 0.4 s, the card over the swap. Enter the universe at once on a return shows the arrival's card (8 s cold in software GL), never the map's loading screen or a black frame. The classic pick's welcome fetches nothing 3D. On a phone (iPhone 13 emulated) the welcome and the tour fit with no sideways scroll, and the tour's keys give way to touch words.

## Left

- On a low tier (software GL, a budget phone) the map has no prepare (`scene.js`'s `prepare: tier === 'low' ? undefined : prepare`), so its first frames upload what they first see; the arrival's card is over the first, and the rest are the map's as before.
- The cockpit in software GL takes over half a minute to board; that is the cockpit's, unchanged.
- `StartChoice` stays for a visit the launch doesn't run on (a script's return, a deep link back to `/`).

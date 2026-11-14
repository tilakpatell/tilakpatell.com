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

## Follow-up, 2026-11-12

The owner, on the live site: the orange button flashed the loading screen before the tour, and the crawl did the same; the route's line ran through the planet's outline; the X-wing was wrong in the launch and its bloom wanted work; Space didn't launch.

- **The handovers.** Measured frame by frame on the live site, a click on Start left four frames (about 45 ms) with no launch screen up and the map's loading screen showing. The welcome and the tour are one frame now (`Opening.jsx`), so going from one to the other changes only the words; every part is under one Suspense boundary and a part that loads (the crawl, the cockpit) is asked for in a transition, so the one on screen stays up till the next can draw; and `index.html` darkens the page whenever it's covered (`html[data-covered] body::after`, z 89, under the crawl's 90). Welcome to tour to crawl to cockpit: no frame without a launch screen.
- **The planet.** Measured at 18 window sizes (text line by line, the route's rules, the bars and the buttons against the disc and its rim, 12 px of margin): before, something touched it at 16 of them. The column stops short of the rim (`--clear`, from where the disc is: 32.3vmax in from the right), the title's size follows that room so it stays on two lines, and on a phone or a window taller than it's wide the planet is in the flow after everything. After: clear at all 18.
- **Space.** While the cockpit boards (longer with the map still being made behind it) the button was disabled and a press was lost; now a press or a click then is kept, the button says “Launching once seated…”, and it launches as soon as you're sat down.
- **The X-wing.** Its Yavin was the music planet's map, which became that world's own on 2026-10-23 (purple, a flower on it): Yavin is painted now, banded rust, ochre and cream (`cockpit/gasGiant.js`, its colours tested). The canopy frame is painted gunmetal rather than a near-mirror that read as bronze; the console's buttons glow at 1.05 instead of 1.4; the bloom's threshold is over 1 (0.5, 0.38, 1.0), so it's the lights, the sun and the jump that bloom, not the sunlit nose.
- **The map made behind it, kinder to the page.** Under the cover a step of the map's prepare, and now its shaders' warm too (`precompile`'s `frame`), waits for a quiet 300 ms after a key or a click (`prepFrame.js`'s `QUIET_MS`), so what the visitor did is drawn first. In software GL most of the tour's Next clicks now paint in 16 to 50 ms; one, as the shaders finish, can still take a second or more, the main thread idle (the graphics process compiling).

## What was left, 2026-11-14

- **The map made in parts.** Its `create` was one task of about 1.5 s in software GL as the welcome came up (the spare ships of every kind 410 ms, the landmarks 290, the planets 270, deep space 185, the environment 105 to 290), and a click on the welcome waited the lot out. It now breathes between them once a part has run 12 ms (`lib/breathe.js`: a timer's task, so React's commit for the click goes first). Nothing started before a breath reads a name made after it (checked: before `setShip`, the late names are only in comments). The worst main-thread task in the welcome's first seconds fell from about 1.8 s to about 0.3 s, and those left are the app's own start, before the welcome shows.
- **The environment primed.** `createSpaceEnvironment`'s first `make()` compiled three's PMREM shaders and drew with them at once, waiting on each link; `prime()` compiles them first, a slice at a time, and the make after draws with them made.
- **Shaders gently while the launch is being read.** A batch of the warm was sized by the page's time, which is only the asking, so it grew to 64 shaders the graphics process had to get through before it showed the next frame. While something over the map is being read or used (`prepFrame.js`'s `readingIn`: covered, and not by the arrival, which says so with `html[data-arriving]`), a batch is two (`gpuWork`'s `GENTLE_BATCH`) and the next waits for its links; waited on, or uncovered, it goes as fast as it can. In software GL: 15 of 16 of the tour's Next clicks painted in 16 to 190 ms (one in 760); before, about one in three took 0.6 to 1.5 s. Batches let grow back with quick links (to 8, to 64) held three to five slow clicks in a dozen, so they stay at two. The arrival, pressed at once, is as long as before (8.3 s for a return's Enter, 9.0 for a first Skip, in software GL).
- **A phone's planet in its first screenful.** On a phone the planet comes between the column and the small print (its strip fading out at its foot); on a tall tablet, where everything fits, after the small print as before. Clear of the words at all 18 sizes, measured on what of the disc shows.

## Left

- On a low tier (software GL, a budget phone) the map has no prepare (`scene.js`'s `prepare: tier === 'low' ? undefined : prepare`), so its first frames upload what they first see; the arrival's card is over the first, and the rest are the map's as before.
- The cockpit in software GL takes over half a minute to board; that is the cockpit's, unchanged.
- `StartChoice` stays for a visit the launch doesn't run on (a script's return, a deep link back to `/`).
- The cockpit's code, fetched ahead from the welcome, is evaluated in one task when it comes (about 0.6 s in software GL, a few seconds after the welcome shows): a module's evaluation can't be broken up from outside it.
- Everything here was measured in software GL, the only GPU in the container: check on a real chip.

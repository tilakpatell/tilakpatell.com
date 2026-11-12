# Every visit opens on the welcome, and the universe is made behind the launch

**Date:** 2026-11-08 · **Status:** accepted · **Where:** `src/components/launch/`, `src/lib/mapReady.js`, `index.html`, `src/App.jsx`, `src/components/universe/UniverseMap.jsx`, `src/components/cockpit/Cockpit.jsx` · **Follows:** [A first visit is asked one question](2026-10-18-one-question-on-arrival.md) · **Design:** [the launch](../superpowers/specs/2026-11-08-the-launch-design.md)

## Context

The owner wanted the portfolio's welcome on every visit, a quick tour after it, and the universe's shaders made in parallel so nobody finishes and then waits. Measured in headless Chromium on SwiftShader (the numbers are the design's):

- A return visit opened on the map's loading screen, 7 s of it. Only a first visit had anything in front of the map.
- Under the welcome the map's prepare ran (the page covered, a slice at a time in idle moments), but the runtime draws nothing while the page is covered, and the launch had no way to know how far the map had got: a quick skip showed the loading screen, a late one a black frame while the first frame was made.
- On arrival a visitor met up to three more things one after another: the front door's choice (for a visit the welcome didn't ask), the tour offer and the first flight's basics.
- The launch was spread over `index.html`, `App.jsx`'s `IntroJump`, `Universe.jsx`, `TourHost` and the map's `prepFrame`.

## Decision

The front door's launch is one thing, `src/components/launch/`: welcome, quick tour, crawl, cockpit, arrival, every part skippable to the arrival. Every visit to `/` gets it (`index.html`: `data-intro` `1` or `back`); a return is offered the view it last picked first, the intro beside it. The map says how ready it is through `lib/mapReady` (`none`, `loading`, `ready`, `drawing`); the welcome and the tour show it in a line, and the arrival keeps a full-page cover until the map is made, then holds its card over the first frame. The quick tour seen is the tour offer made and the first flight's basics shown.

## Consequences

- No visitor sees the map's loading screen or a half-made map after the launch; one who reads the tour finds it ready.
- A return costs a click (Enter the universe, or Esc) that it didn't before. A script's return is left out (`navigator.webdriver` with `tp-intro` set), so the shot and check scripts behave as before.
- A visitor who last read the classic site fetches nothing 3D unless they pick the universe; then the arrival covers its whole load.
- The cockpit's white holds up to 2 s for the map too, and uncovers only a made map.
- `App.jsx` lost `IntroJump` (125 lines); the welcome moved from `cockpit/` to `launch/`, its styles with it (`launch.css`).
- With reduced motion the welcome now shows too (it was the front door's choice), and its intro is the tour alone.

## Revisit when

- The owner finds the return's welcome a click too many: then a return could skip it once the map is ready, or within a session.
- The map gets a prepare on a low tier: then the arrival's card holds over a frame that is cheap there too.
- The tour's cards change enough to go past half a minute (`rules.test.js` counts the words).

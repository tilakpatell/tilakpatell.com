# A first visit is asked one question, and every first-visit card fits the window

**Date:** 2026-10-18 · **Status:** accepted · **Where:** `src/components/cockpit/Welcome.jsx` and `cockpit.css`, `src/App.jsx`, `src/pages/Universe.jsx`, `src/components/universe/StartChoice.jsx` and `universe.css`, `src/components/tour/` (`TourHost.jsx`, `offer.css`, `Tour.jsx`, `tour.css`), `src/lib/tour.js`, `src/index.css` (one row for Bose's dark scope)

## Context

The owner's word: on a first visit the tour and the dialogs “can be incorrect” depending on zoom and monitor size, and arriving is “so ugly” and “overwhelming”. Measured in headless Chromium at eight sizes, each the CSS viewport a screen leaves at its zoom: 1920 by 1080 at 100% and 150%, 1366 by 768 and 1536 by 864 at 125%, 2560 and 3440 wide, 1280 by 800 at 200%, and a 390 phone.

- The welcome was 682 px tall. A 1366 by 768 laptop at 125% (525 px) put its buttons below the fold, and at 200% only its first line of beats showed.
- Skipping it brought a second dialog, the front door's choice, which asked much the same question. On a laptop it was centred across the whole width and sat on top of the universe panel.
- Then came a third, the tour offer: a light card on the dark map, its four buttons wrapping onto two rows. On a short window over the map it went off the top.
- The tour card had no height limit, so at a high zoom Next could be off the screen. The whole tour's 22 chapters drew 22 dots.

## Decision

The welcome is the visit's one question. It is a title card over the stars: the name, the title, one sentence, the intro's three parts and three ways in (Start the intro, Skip to the universe, Go to the classic site). Whichever is picked is the front door's choice too, kept with `saveStart`, so the map never asks it again. The welcome is a modal (the app behind it is inert), and the choice never mounts under the intro's cover. The choice stays for a visitor the welcome didn't ask (reduced motion, a later visit not remembered), as two tiles in the room the panel leaves.

The welcome and the choice are centred with auto margins in a column that scrolls, sized by height as well as width, and drop what can go on a short window. The offer is the house `.notice` in the map's dark glass, with three side-by-side choices that each say how long they take and an × for Not now. The tour card is capped at the window's height: its words scroll (by mouse or the arrow and Page keys) and its buttons never do. More than 12 chapters or stops draw a slim bar instead of dots.

## Consequences

- One dialog between a newcomer and the site instead of three. A visitor who takes the intro or skips it to the universe is not asked again on a later visit; the nav's switch changes it as before. Skip goes to the universe even when the welcome is over a kept /home, and a kept classic pick replaces / in the history, so Back leaves the site.
- The welcome's small print is word for word as it was, at the foot of the window. Its buttons are in the first screenful down to about 300 px of height (a laptop at 250%); under that the column scrolls from its top.
- The carry-on note's × only puts it away. After an excursion, Stop (which forgets where the tour got to) is a visible button beside Carry on, as before.
- The welcome's own key-cap rule is gone (it uses the house `.kbd`), so `kbd-styles` falls from 70 to 69.
- `lib/tour`'s `TOUR_MINUTES` is the one source of each tour's length, read from `steps.test.js`'s reading times (268, 596 and 725 s): 5, 10 and 12 minutes. The player's tour had said 8 in the palette and the guide. The whole tour's hello said a quarter of an hour and now says twelve minutes.
- Over the map the tour card is solid: at 0.95 the panel's white title still showed through it. In Bose's light colours the dark scope takes Bose's own dark-mode buttons: its black saber had made them black on near-black.

## Revisit when

- The owner wants the front door's choice asked on a return visit after the intro (then don't save on Start).
- The tour gets a chapter list of its own to show progress (then the bar can go).
- A tour's chapters change enough to move its reading time a minute either way.

# A phone flies the ship either way up, and on its side gets the whole screen

**Date:** 2026-10-19 · **Status:** accepted · **Where:** `src/components/universe/thumbs.css` (new), `UniverseMap.jsx`, `scene.js` (`measure`, `refit`, the prompt's `data-key`), `src/pages/Universe.jsx`, `src/components/tour/offer.css`, `src/components/Achievements.jsx`

## Context

The owner's word: driving the ship on a phone was “so cluttered and bad”, and should it be landscape? Measured in headless Chromium with touch at 390 by 844, 375 by 667 and 320 by 568, each both ways up, and a tablet:

- Upright, about a dozen touch buttons (Boost, Fire, View, Weapon, the climbs, the portal gun, the jump, the powers, settings, the Hangar, the nav map, multiplayer, the shields) were each placed by hand against the sheet's height, and overlapped one another, the prompt, the hint and the ship. The jump button collapsed to a 32 px pill.
- On its side a modern phone (844 wide and more) is past the 767 px breakpoint, so it got the desktop layout: a 76 px nav bar and a 400 px side panel left a 420 by 314 strip, and every button piled into it.
- The left of the screen, where the thumb drags to steer, held the settings, the Hangar, the nav map, multiplayer and the shields.

## Decision

Don't force landscape: iPhone Safari has no orientation lock and no fullscreen for anything but video, and WCAG 1.3.4 asks a page not to lock one way. Lay out both, and make landscape the full one.

- Every touch button is in one grid in the right thumb's corner (`.universe-thumbs`, the kit's sizes, the powers in it): three rows on a phone on its side, four upright. The left is left to the drag.
- Flying on a phone, the shields and multiplayer are a row along the top left, the nav map, the Hangar and the settings along the top right. What the right thumb may press next (the jump, the way in) and the line about it sit over the grid, at its measured height.
- On its side (`(pointer: coarse) and (max-height: 500px)`), with a ship, the site's bar steps aside (not during a site tour) and the panel is at the side, never a sheet. The panel, or its bar, has the ways back to the page.
- The first launch on a phone folds the panel away. While it's open, upright or on a small phone on its side, the grid waits: the map over it is too short for both.
- Upright, the scene's open part stops over the grid, so the ship flies above the buttons. The first-flight hint says to turn the phone on its side.

## Consequences

- One drawing per touch layout, by the grid and two measured numbers (`--thumbs-h`, `--thumbs-w`), in place of about twenty hand sums against the sheet. The galaxy flies with the same buttons' classes but none of this reaches it: every rule leaves out `.galaxy-page` and `.galaxy-map`.
- Fire, Boost and the climbs are the kit's TouchButton, so a thumb that drifts off one no longer lets go of it.
- A desktop is unchanged, but the achievement toast on the map is now at the top, as in the worlds, clear of the flight cluster and the thumbs.
- The page's `data-tucked` now follows the panel during a site tour (it had kept the tucked sizes while the tour forced the panel open).
- Folding the panel at launch is saved, as a tuck by hand is: the next visit on that phone starts with it put away.

## Revisit when

- iPhone Safari gets the Fullscreen API or `screen.orientation.lock()` for pages: an optional full-screen landscape button.
- The galaxy's touch HUD is redone: it could take the same grid (`GalaxyView.jsx` renders the same buttons).

# The quiet HUD: one minimal flight HUD for the universe and the galaxy, and a pause menu dressed by the crew

**Date:** 2026-11-18 · **Where:** `src/runtime/hud/` (`presence.js`, `pause.js`, `PauseMenu.jsx`, `pause.css`, `flight/`), `src/components/universe/menu/`, `src/components/universe/UniverseMap.jsx`, `src/components/galaxy/GalaxyView.jsx`, `src/pages/Universe.jsx`, `src/pages/Galaxy.jsx` · **Mockup:** https://claude.ai/artifact/8M8bPUYmc7H8AKkanisxRu

## What the owner asked

The HUD on `/galaxy` and `/universe` was too cluttered: make it clean and minimal, like a game's, with things that go away and come back, and the same on both maps. Hide the site's nav while flying. Gather the rest into a pause menu (settings, an FAQ, the inventory, cargo and money), dressed for the crew you fly with, Rick and Morty's unlike Star Wars', in the way Minecraft's inventory opens on its tabs. No “M More on the map” under a place's prompt; a small jump mark while cruising.

The owner's answers: the thin core is right; the tabs are right with cargo and money added; the dresses are to be judged on the real site.

## While flying: the thin core

Always there while a ship flies: the crosshair, a faint `Esc Menu` chip top left, and one strip bottom centre (the radar, the shields, the speed) with the jump mark at its end (`J` and a lightspeed glyph: dim with nowhere to go, lit and named with a star under the nose or a course plotted).

What comes and goes (`presence.js`, pure and tested, stepped by the flight HUD's writer each frame from its record, and poked by the fight keys):

| Part | Shows | Goes |
| --- | --- | --- |
| Guns, powers, kills | a hostile's arrow on screen, a hit (yours or on you), a fight key (F, R, 1–3, G, X, T, Q) | 6 s after the last of those |
| Target card | a lock | 2 s after the lock drops |
| Shields warning | under 35 % | back over |

The prompt, the crew's lines, the toast, the war's strip, the arrival title and the landing button already come and go; they stay as they are. The target's card is the bracket's own labels on glass; the cluster's card hides in the quiet HUD.

Moved off the screen while flying: the site's nav (`html[data-flight]`), the side panel (UniversePanel, GalaxyPanel), the corner's tools (the flight settings, the Shipyard's door, the nav map button), the galaxy's Keys chip, keys card and Galaxy map chip, and the Multiplayer pill (its card and feed stay). With no ship, or while the site's tour runs, the panel is where it was.

## On a touch screen

The owner asked for the same treatment on a phone, heavily simplified. The touch layout keeps its places (thumbs.css), so nothing under a thumb moves; what goes is faded in place:

- Always: the Menu button (three lines, no Esc), the shields, the radar, Fire, Boost and the nose's two buttons, and the jump's button while a star is on the nose.
- Out for a fight (the cluster's data-fight, presence.js's): the weapon and the crew's two powers.
- After a touch, gone four seconds after the last (FlightHud's data-awake): the view and Rick's portal gun.
- Off the screen, in the menu: the nav map's button (the Map tab), the corner's tools, the guide's corner (Help), the Multiplayer pill (Settings).

## The menu

`Esc` opens it (after the page's own Esc: a tour, the autopilot, the scene's escape), and closes it; `I` opens it on Cargo, `O` on Settings; `1`–`6` and the arrows change tab inside. `H` (the Hangar), `M` (the map) and `?` (the guide) keep their doors; each also has its button in a tab. Offline the world freezes behind it, as the Hangar does; online it carries on (the scene hears no key while the menu, a dialog, is open). A dialog: focus goes in, Tab stays in it, Esc gives it back.

| Tab | Holds |
| --- | --- |
| Ship | the crew and the ship, what it's fitted with, its three guns, two powers and its systems' tiers (`ships/sheet.js`'s `systemRows`) as slots; each slot opens the Hangar on its page; Change ship |
| Cargo | the credits, the level, the flight record, and the hold (`shipSheet`'s: its goods as slots, used of room; empty until the market's lane) |
| Map | what the side panel said (the place picked or near, the way in, the landings), the drive, and the full map's button |
| Settings | the flight settings (FlightSettings's controls, inline), sound and the crew's voices, the site's picture settings, multiplayer |
| Help | the questions (the guide's tips for the page), the keys (the guide's), the site tour's starts, all the controls |
| Site | every page, the résumé, the classic site, search, the credits, start over |

The kit holds the frame (`PauseMenu.jsx`: tabs, keys, focus, plain props) and its rules (`pause.js`: the tabs, which key opens which, the dress for a crew). The map's side composes it (`components/universe/menu/`) and skins it.

## The dresses

The tabs, words, keys and layout are one; the material is the crew's (`data-skin`), on both maps, in faces the site already ships:

- **The Falcon, the smuggler's hold:** gunmetal plates with rivets and seams, amber lamps, stencilled crate labels; Battlefront's Univers Condensed and RaxusPrime. The plates slide up.
- **The X-wing, Artoo's readout:** a blue display with scanlines, corner ticks and a line of Aurebesh under each heading; Univers Condensed, RaxusPrime, Aurebesh. It flickers on.
- **The space cruiser, the garage:** portal green on a dark bench, wobbly edges, masking-tape tabs, Morty's sticky notes for the questions; Luckiest Guy. It opens through a portal.
- **The RV, the lab:** graph paper and lab trays, the crystal's blue, element tiles for tabs whose number is the key, a notebook's typewriter (Courier Prime). The tiles flip in.
- **On foot or with no ship:** the house glass and the site's gold.

## Others' work

The ships, economy and exploration session owns the data (`shipSheet`); the menu draws it when it lands. The universe layout session owns the map's layout and the nav map; the Map tab opens it rather than drawing a chart of its own.

## Checks

Unit: `presence.test.js`, `pause.test.js`, `PauseMenu.test.jsx`, and the tests the move touches. Browser: `/universe` and `/galaxy` at 1440×900 and a phone, before and after; CI's multiplayer checks reach the Multiplayer card as before.

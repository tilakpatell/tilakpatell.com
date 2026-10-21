# The maps show only the names with room, and the flat map gives the home system its own band

**Date:** 2026-10-20 · **Status:** accepted; the flat map's bands superseded on 2026-10-21 by lane 6a's shared chart projection (the stations zoom in instead) · **Where:** `src/components/universe/chart/declutter.js` (new), `NavMap.jsx`, `navmap.css`, `MiniMap.jsx`, `universe.css`

## Context

The owner's word: improve the universe maps, “really nice and not cluttered”. Shot on `main` at 1440 × 900, 1280 × 720 and 390 × 844:

- The nav map's chart wrote every name to the right of its dot, so names sat on each other and on dots: The Portal over Citadel C-137, “A galaxy far, far away” over Glacia's dot, Halcyon over The Lantern, Music room over the home system's label. Two hand-kept exceptions (`UNDER`, The Maw and Glacia) were the only fix. On a phone, names ran off the chart's rim.
- Every place had the same dot, so a world and a wonder read alike.
- The header carried eleven pills (three charts, two tools, five filters) and a search; the side panel always held the drives and their paragraph, and on a phone the place picked and its button were below the fold.
- The flat map (the map with 3D off, and Home's teaser) drew the stations on a square-root scale, where the six of them sit within 17 units of the sun: their names were one smudge.

## Decision

- **Names by priority, or not at all.** A pure `declutter(labels, { bounds, round, sides, dots })` places names greedily (the place picked, the home system's label, where you are, where you're going, the war's front, the worlds and stations, the portals, the wonders, the far fights): each takes the first side (right, left, under, over, or its own list) inside the chart's disc that meets no name and covers no dot, or none. A name with no room comes up on hover and focus, on glass; the dot is still the button, its name its label, and the list has every place. The API is the one lane 6a's plan sets for its Task 4, with `over`, `round` and a label's own `sides` added.
- **One look a kind.** A world is a small lit planet, a station a smaller one, a wonder a diamond; a filtered-out place a grey dot with no name.
- **The header holds the charts and the ways out.** The search and the filters moved to the list; the list is in sections by kind with short distances (“46k”, in ship-lengths); the drives come up with a place picked, beside the button that goes by them. On a phone the place picked comes first.
- **The flat map draws bands, not one scale.** The stations on a ring at a fifth of the radius, the belt past them, and the fandoms' evenly spaced orbits sharing the rest evenly; every place keeps its direction from the sun.

## Consequences

- No name over another on any chart, at any size; a name may go unsaid where the chart is crowded (on a phone, about a third of the worlds' names), and a phone has no hover to bring it up: a tap picks the place and its name shows.
- Which names show can change as the ship flies (its marker is a dot no name covers).
- The flat map's distances are no longer to any one scale; the 3D map and the nav map are.
- `scripts/navmap-check.mjs`'s label checks still pass: the names it measures no longer meet.
- The pilots' green, the ambers and every word are as they were; “Ship-lengths” and “Find a place…” moved into `words.js`.

## Revisit when

- Lane 6a's zoomable chart lands: at a closer zoom the names part and more of them show, and the flat map takes the shared projection the spec asks for.
- A phone layout needs every world named: shorter names on the chart, or names on a second ring.

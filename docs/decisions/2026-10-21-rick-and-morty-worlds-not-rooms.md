# The Rick and Morty places are worlds, not rooms: code buildings where no model is, crowds of the cast's own copies

**Date:** 2026-10-21 · **Status:** accepted · **Where:** `src/components/rickmorty/world/dimensions/` (`worlds.js` and `worlds2.js`, the records; `outskirts.js`, the layout; `lots.js`, the code buildings; `crowd.js` and `crowdPose.js`, the crowds; `surround.js`, which draws it all; `worldRules.js`, what a record may say; `blocks.js`, the only solids a world adds), `world/models.js`, `portal/crowdPaint.js`, `src/lib/three/bakePose.js`; the long version is `docs/superpowers/specs/2026-10-21-rm-worlds-not-rooms-design.md`

## Context

The owner's word: "make sure Rick and Morty worlds are amazing, populated and don't feel empty. Make sure there are buildings; it should feel like a world, not a room." Read in the shots and the code:

- 35 live places, 17 outdoor and 18 rooms. Every outdoor place was the same 70 × 50 m box of painted ground, Morty stopped at a line he couldn't see, and past it the ground ran 130 m into fog with nothing on it.
- Rooms were four closed walls and a ceiling; every view out was a painted panel.
- A place held 0 to 15 figures. Get Schwifty's audience was 60 glowing dots.
- Every outdoor place's fog took Blips and Chitz's pink sky.
- No model of most of the buildings a world needs (a city block, a hangar, a stand) exists, and the owner's rule is that no figure or prop is drawn in code where a model can stand, and no new model files are added.

## Decision

Each place has a record of what stands round it and who's about (`WORLDS`), laid out by a pure, seeded function and drawn into the place's own room kit before it builds:

- **Buildings** round outdoor places and outside rooms' windows are code (fourteen styles in `lots.js`, a few primitives merged into the kit's batches, windows a tiled paint), because no model of those kinds exists. Where a place's own building has a model (Purge's cottages, barn, well and siren; Cronenberg's house and car; the Frundles' house; Bird World's perch; Gear World's big gear and cogs; Squanch's suckulents; the Blood Dome's wrecks), the model stands: as a ring's set piece, or as the place's own `pieces` where its code twin used to be.
- **People** are instanced copies of the cast that's on disk: the unrigged Meshy kinds, the Citadel's light copies (`crowd:<name>`), and the light rigged kinds stood in a clip's pose by `bakePose`. No copy of a place's hunters', lookouts' or named people's kinds stands in its box, and none nearer than 7 m beyond its edge (30 m for a named person's). They walk, queue, gather on blocks (the only solids a world adds, ≤ 1.2 m), hop on a beat, turn to Morty while the place hunts him, and go with the story.
- **Traffic** is the Federation's ship, the Zigerion mothership and the snakes' rocket, never a family's vehicle.
- **Rooms** get windows where their painted panels hung, onto ground (a city, a yard, a dome of Mortys) or space (stars, planets and moons).
- **Budgets** by the device's level (`kit.fit.tier`): crowd triangles 360k, 220k and 150k (a room half), kinds 6/4/3, set copies 4/2/0, traffic 3/2/1, lots 40 + 34, 30 + 24, 20 + 14.

## Consequences

- Every place has buildings to the fog and people in it; the arrival half of each outdoor frame has a forecourt or a crowd in it.
- The crowd has no line and no shadow, as the Citadel's has none. Its kinds repeat: no lighter copies are made (the owner's call, `scripts/crowd.mjs`).
- Pieces stand on every level, low too: Gear World's eleven come to about 99k triangles there.
- Each place's fog is its own sky's; a room's outside is fogged past its own depth.
- The records live outside the page's first download (`destinations.js` merges only `blocks.js`'s few rows).
- `worldRules.js` and `worlds.test.js` hold every record to the rules (kinds counted from the GLB headers, no look-alikes near, blocks clear of spots and routes, sight lines kept, budgets on every level).

## Revisit when

- The owner makes lighter copies of the cast (`scripts/crowd.mjs`): bigger and more varied crowds fit the same budget.
- A model of a building kind arrives (a city block, a hangar, a stand): it replaces that style where it fits.
- A place's game needs room: growing a box is left to the place that needs it (Fantasy World's climb, P8).
- A frame's cost on a phone says the low row is too generous.

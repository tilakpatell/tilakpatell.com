# The galaxy's worlds, alive and endless

The owner, 2026-10-20: "the worlds look so barebones without foliage and not
lively"; "the LOTR world for the mini worlds we worked on a lot to make it
look really nice"; "Corellia is a city and many of these places are a city
and it's like 2 buildings and nothing there"; "make it amazing for free roam,
especially with the infinite world generation logic we were building".

Two maps of the code (this session's) found why. The galaxy surfaces use the
same engine as Middle-earth (grass, wind, the ground map, the house look),
but:

- their cover is laid once, in rings round the landing, and never follows
  you; the Shire packs its cover round the camera, the Road per stage;
- their trees are about 40 times sparser than the Shire's (one per
  8,100 m² against one per 200 m²), their bushes a third of the Road's;
- nothing lives in the air or the grass: no flocks, no butterflies, no
  falling leaves, no birdsong;
- a city is its landmark and two code-built boxes;
- every world is a 590 m circle, though the planet flight already streams
  endless ground for the galaxy's worlds (`/fly/:planet`, its quadtree and
  biomes a removable island, `scripts/lib/flight-island.mjs`).

## Three lanes

### 1. The living ground

- `src/lib/land/cover.js` (pure, tested): a world's cover rows, per 100 m²
  in clumps (the Road's rule, `middleearth/road/scatter.js`), placed on one
  square tile from a seed and the tile's place, so the same tile is the same
  on every visit and every machine, and a ring of tiles can follow you
  anywhere: the core's 590 m or endless ground.
- `src/components/galaxy/surface/living.js`: a ring of tiles round you,
  each tile's items handed to the kit's keyed instanced pools
  (`lib/three/kitNodes` `createPool`: full near, LOD1 to `mid`, a puff
  beyond) under the tile's key, freed as you leave. Nothing on a place's
  flat, in water, on a cliff or by the landing.
- No ring you can see (the owner, the same day: "it should be a ring that
  covers what the user can see. If the ring is too small it looks weird as
  the player can see it change in real time"). The ring is as wide as the
  view: the trees to `far`, a new budgets column (500 m on low to 1,200 on
  ultra; 900 on high, past the core of a world), as their far stand-ins;
  the bushes as far as theirs go (twice `mid`); the cover 40 m past the
  kit's full band. Every pool shrinks its items away over the end of its
  reach, as the 2017 game's scatter dissolves, so an item comes and goes at
  no size, and a tile is laid where nothing of it shows yet. The pools are
  Middle-earth's too, so the Road's stages fade at their edge. The game
  levels' own scatter reaches further (64 m on high, from 40) and thins
  toward its edge rather than everywhere once it is over its cap.
- The biomes (`flora.js`) gain `living`: their cover and kit bushes at the
  Road's and the Shire's densities (8 to 12 an 100 m² on the green worlds,
  3 on the dry, 2 on the ash, none on snow). The scene lays the streamed
  cover in place of the static cover band; the trees and the game's scanned
  rocks stay static rows.
- The grass patch goes 13 m ahead of the camera along the view, as the
  Shire's does, so the blades are where you look.
- Life: the Road's flocks (`road/birds.js`, node materials) lifted to
  `src/lib/three/birds.js` for both; a world's `birds` (or its biome's) over
  its places; pollen and butterflies in the weather on the green worlds;
  birdsong where the biome is green.

### 2. Cities

- `src/components/galaxy/surface/sites/city.js` (pure, tested):
  `city({ seed, at, r, streets, blocks, kit, keep })` lays a street plan (a
  grid or rings and spokes) and fills its lots with a world's building kit,
  facing the street, clear of the places' quest spots, the landmark's
  footprint and a plaza; lamps, crates and stalls along the streets; a crowd
  (`life` rows with `path`s down the streets) and traffic (`flyovers` low
  over the roofs).
- The kits are the made buildings that fit (`catalog/worlds.js`, the earlier
  Meshy lanes', Nevarro's and Mos Eisley's) and a few new Meshy ones where a
  city has none of its own style: fourteen, drawn from words
  (`scripts/meshy-galaxy-cities.mjs`), a light copy each.
- As built: the buildings are scatter rows, not things (a city of a hundred
  houses is a few instanced draws), each solid over its footprint's box; a
  lot is split as the kit can fill it, a ring's lots cut as long as its
  widest house needs; a crowd's middle is kept clear, not all it roams;
  the streets and the plaza are painted into the ground map as paving
  (`site.paving`, `groundPaint.js`), with no grass on them.
- The cities: Coronet City, Worlport (Ord Mantell), Calodan, Kestro City,
  Pau City, Mygeeto's crystal city, Cato Neimoidia's bridge city, NiJedha,
  Plazir-15, Kafrene's Ring, Fondor's yard city, Saleucami's crater town and
  Trask's harbour.

### 3. Endless free roam

- Free roam (`?mode=free`, `surface/modes.js`) lifts the 590 m bound
  (`world.reach = Infinity`, as a zone does) and drops the edge's toast.
- Past the core the ground streams: the flight's dependency-free quadtree,
  stream and leaf mesh lifted to a kept path under `src/lib/land/`, the
  flight re-exporting them so the island stays removable; leaves built from
  the site's own layers minus its mountain ring, in `rt.workers`.
- The living ground (lane 1) already follows you there. Far places are
  seeded a region at a time: ruins, camps, and small towns from lane 2's
  `city()`.
- As built: the roam has no edge wherever you are on a world's own ground
  with no mission running (`surface/roam.js`'s `roamOn`), not on a game
  level. In place of a quadtree the ground's grid and its map move with
  you: 240 m from the grid's middle a new grid round you is sampled a few
  rows a frame (`terrain.js`'s `gridBuild`), the map painted round it
  (`groundmap`'s `moveTo`), and both go in on one frame, the new middle on
  the fine grid's lattice so the near ground stays where it was (about
  180 ms of work over some 40 frames). Past a world's mountain ring the
  land breaks into ranges 4.2 km across with lowlands between (`layers.js`'s
  mountains `ranges`). The living ground is laid again on the moved ground,
  and the grass hides if you outrun the map. Far places: one or none a
  kilometre square (`surface/wayside.js`), a camp, a downed starfighter, an
  outpost or a ruin by the kind of world, on the land's own height; the
  small towns are not built yet.

## Order and checks

Lane 1 first (every world gains from it), then 2, then 3, a pull request
each. Each keeps the surface gate (under 600 draws and 2.5 M triangles on
high, `HANDOFF-worlds.md`) and is judged by `scripts/surface-shot.mjs`
shots before and after.

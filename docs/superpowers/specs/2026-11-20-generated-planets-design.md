# Generated planets: their own look, more kinds of body, traits, the map

2026-11-20. The owner’s ask: “The quality of infinite planets and the textures need to be improved along with them on the map and what they offer … they should be able to have unique properties and stuff not just generic”. And: endless, seeded, at least 500 all different, each matching its style and what’s on the ground. Generated planets shouldn’t be visible as bright bodies from far away. A planet sits in a star system unless it’s a known dark one. More kinds of thing in space: quasars, moons mined by aliens, black holes, dwarf stars, neutron stars.

He chose the look from a sample (each planet’s own look on the galaxy body shader, the middle column of three) and asked for all four lanes built. One pull request each, in this order.

## 1. Each planet its own look (this lane)

- `src/lib/space/planetLook.js`: `planetLook(row)` makes a galaxy `LOOKS` entry from the planet’s variety and a seeded stream of its own.
  - It sets the palette in the shader family’s slots.
  - Its terrain character: sea level, mountains, craters, mesas, canyons, dunes, islands and rivers.
  - Its cloud cover and colour, and its air from its sky.
  - A gas giant’s bands, turbulence and storm.
  - The shader’s noise offset comes from the planet’s id.
  - Moons get the moon family.
  - The far disc’s swatch is the look’s mean colour.
- **The landings’ variety moves out of the planet flight to `src/lib/space/`.** That covers `variety.js`, its hash, its id rule and the tables it reads. The flight re-exports them, so its files and outputs stay as they were, and the universe draws the very planet the flight lands on. The planet-flight island’s rule is that nothing outside imports it; the island can still be removed in one command.
- **No new material.** Each family keeps the air its old fixed look had, so the draw calls don’t rise. Flags come from `FLAG_SETS`, at most three a family.
- **A ring takes two colours** from its giant’s bands, in the existing ring shader.
- **A planet’s far disc shows only near its star.** It is whole within three of its system’s reaches and gone by five (`levels.js`’s `planetShown`). Past that, the system is its star alone.
- **Tests:** deterministic; every slot and param filled; 10,000 planets give 10,000 looks; any 500 neighbours apart by more than a shade (`lookDistance` over 1.5); the flag sets; air by type; the roster’s colours pinned.

## 2. More kinds of body

This extends what lane 4a and the hand-made wonders already draw, without duplicating them:
- the star classes: white dwarfs and neutron stars are there, red and brown dwarfs are new
- pulsars and magnetars
- the black-hole gargantuan

New kinds:
- quasars: far, blinding, with jets, on the beyond’s sky
- moons mined by aliens: rigs, scars and debris
- more moons round the giants

Each is placed where it would be (in systems, as companions, as rare finds), dark where it would be dark, and drawn through `drawers` and stock materials. A region from the layout session’s `regionOf` can favour kinds. Old sectors never change: new draws come from new streams.

## 3. Traits, and something to do

`traitsOfPlanet(row)` is pure and seeded from new streams. It gives:
- resources, as the market’s good ids
- a rare good now and then
- a hazard
- ruins, a station, weather, a moon’s secret and an anomaly

The traits show on the place card. What you can do with them:
- **Earn and trade:** the market lane’s `yieldOfPlanet` and the hold.
- **Explore:** scan the ruins, the signal or the anomaly for lore and a one-off payment through `earn`.
- **Danger:** hazards cost shields and pay for braving them.
- **Collect:** a log of the planets you’ve found and their rare traits.

## 4. The map

Generated planets and their traits go on the nav map and in its rows, as `Mark`s through `chart/marks.js`. Done with the layout session, which owns `chart/`.

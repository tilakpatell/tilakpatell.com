# The universe spread out: the Core, the neighbourhoods, the regions and two pocket universes. The design

> “Make it so the actual worlds are spread apart. Right now they’re in one sector. Make one sector have the main résumé planets, and when we spawn (first time) we spawn at the résumé and those things.” “Not just résumé but my overall site map: experience, projects etc.” “Themed but also spread out with random clusters and the generation and planets in between. Make it feel like a real universe. Then some sectors where we go into a separate galaxy like Star Wars, themed like that, and the portal is massive and it sucks us in.” “Make it infinite, and Star Wars its own thing, as that’s massive.” “The portal pull should be different: in Star Wars more like a tractor beam, in Rick and Morty a cool Rick-esque animation.” “The map and universe stuff first, then the NPC and random event stuff after.” Music gets a neighbourhood of its own.

The sample map the owner saw: https://claude.ai/artifact/Re7DsX4bBfCH4gzuRtXEsi (draft 2).

## What done looks like

1. **The Core.** Sector 0,0,0 holds the sun and the six site stations (Home, Experience, Projects, Résumé, Contact, Terminal), the rim’s ice ring round them, and nothing generated. Every new pilot starts there, at the home system’s edge facing the stations, on a side of their own (so pilots arriving together online don’t all appear in one spot). A link that names a place (`/universe/<id>`) still starts beside it.
2. **The neighbourhoods.** The fandom worlds leave the Core for six hand-made neighbourhoods one to three and a half sectors out (120,000 units a sector), each at its own height, each bunched loosely round a landmark, with generated systems, planets and things in the space between:

   | id | name | worlds | landmark (a wonder that moves there) | sector, roughly |
   | --- | --- | --- | --- | --- |
   | `heroes` | Hero Reach | Marvel, Invincible, Transformers | Ember, a red giant | 1.6, −1.1 |
   | `oldroads` | The Old Roads | Middle-earth, Hogwarts | the Veil | −2.2, 1.0 |
   | `earthside` | Earthside | Breaking Bad, The Office, Caribbean, Travel | Halcyon, a warm sun | 1.2, 2.1 |
   | `stage` | The Stage | Music | the Cradle, a stellar nursery | −0.4, 2.4 |
   | `arcade` | The Arcade Drift | Gaming | the Twins and the Lantern | −1.3, −1.8 |
   | `rift` | The Curve Rift | Rick and Morty’s world and its portal into the Curve | — | −3.1, −0.3 |
   | `maelstrom` | The Maelstrom | the Star Wars gate | — | 3.4, 0.5 |

   Every world keeps its id, name, card, landing, links and jump target: nothing hand-made is removed (the owner’s rule). The Maw, Aurelia, Glacia, the Wanderer and the Graveyard stay round the Core as the first things you see on the way out.
3. **Seen from the Core.** Each neighbourhood shows on the sky as its worlds’ stars and its landmark (`farStars.js`, `landmarks.js`, unchanged in kind); the nav map’s chart frames them all; J and the nav map jump to any of them.
4. **Forever.** Past the neighbourhoods the Expanse goes on as it does, and (PR 3) sectors gather into generated regions with a character each: the Rime, nebula reefs, ship graveyards, pirate havens, star nurseries, Dyson forges, the Quiet.
5. **Two pocket universes behind giant portals** (PR 2). The Maelstrom is a galaxy-sized whirlpool round the Star Wars gate; inside its reach a tractor beam locks on and hauls the ship in unless it boosts free, and you come out in the Star Wars galaxy (`/galaxy`). The Curve Rift is a huge lopsided green portal; get close and it takes the ship with a Rick-ish splat, stretch and swirl, into the Central Finite Curve. Leaving either puts you back at its mouth.

## The design

### A. Neighbourhoods as data (`src/components/universe/neighbourhoods.js`, pure)

`NEIGHBOURHOODS = [{ id, name, centre: [x, y, z], members: [universe ids], landmarks: [wonder ids], tint }]`, and `placeIn(n, i, reach) → [x, y, z]`, a member’s place: a loose golden-angle spiral round the centre, 4,000 to 6,000 apart plus each world’s reach, at small heights. `NEIGHBOURHOOD_OF[id]` names a world’s or a wonder’s neighbourhood. Centres are fixed numbers in this file; a test keeps each one where the table says (whole sectors), clear of the Core, of the Rick and Morty pocket and of every other neighbourhood by a sector at least.

### B. What moves, and what stays

- `layout.js`’s `POSITIONS`: stations on their ring as now; a fandom world at `placeIn` of its neighbourhood; moons as now.
- `deep.js`’s `WONDERS`: a wonder named in a neighbourhood’s `landmarks` sits at the neighbourhood’s centre (plus its own offset), unspread; the rest as now. `rmportal` keeps its place beside Rick and Morty’s world (it follows `POSITIONS.rickmorty`).
- `MAP_RADIUS` keeps its meaning and today’s value: the Core’s extent (the home system, the wonders left round it, the rim). It is frozen as a number, not the furthest world, so the old middle-layer generator (`expanse/gen/sector.js`’s ring-one keep-out) and with it the 25 fingerprinted sectors stay exactly as they are, and the lanes, the chart’s home view and the Core’s edge keep their scale. `UNIVERSE_RADIUS` is new: the furthest hand-made place plus its reach, for whatever must frame them all.
- Who counts as a hand-made place of the main universe is said by the data (`SECTOR_OF[id] === 'main'`, a wonder without `sector`), never by `sectorOf(at) === 'main'`, which now answers an Expanse key for a world out in a neighbourhood. That changes `keepOuts.js` (each world keeps three of its reaches clear in the 3D generator, as before), `regions.js`’s `FAR`, and `ship.js`’s `STARTS`.
- **The generated sectors a neighbourhood sits in.** The 3D generator is additive: the middle layer’s old systems stay, and only the additions honour the keep-outs. So each world and landmark is placed clear of the old systems already in its sector, and a test holds it: every hand-made place is further from every legacy system in its sector than that system’s reach plus three of the place’s.
- `regions.js`: the regions are the neighbourhoods (the Core’s region first, as now), members from the data, each region’s hub its neighbourhood’s centre lifted clear; ids are a region’s biggest member’s, as the old rule made them. `waypoints.js`’s nodes follow; its pinned fixture (`__fixtures__/nodes.json`) is rewritten once, on purpose, in the commit that moves the worlds, and the commit says so: the fronts and far fights are shared online by these ids, and every client moves together at the deploy.

### C. Starting in the Core

A new pilot with no place named starts at the home system’s edge (`HOME_RADIUS + 1.5` from the sun), at an angle of their own, level, facing the stations. `STARTS` keeps its other rows for anything else that reads it, but `startAt` no longer picks a far world. `props.startAt` (a link) works as before.

### D. Getting there

The hyperspace jump already lands anywhere at once once it is charged; the nav map and J reach every neighbourhood by it. Charging, the trip falls back to super speed (900 a second), a few minutes to the furthest. Nothing about the drives changes here (the ship session owns their numbers); a test pins that every named place is a jump target.

### E. The map

The 3D chart already ranges to 3,000,000; its open view frames `UNIVERSE_RADIUS` round the Core so every neighbourhood fits, and it names each neighbourhood. The old 2D view (`CHART_VIEWS.all`) keeps `EDGE` for the Core.

### F. The portals (PR 2) and the regions (PR 3)

Each its own pull request, after PR 1. PR 2: `universe/portals/` (pure pull rules: reach, beam strength, boost to break free; the Maelstrom’s and the Rift’s set pieces; the tractor beam’s lock, alarm and haul; the Rift’s splat and swirl), into the existing `portal` and `portalThrough` paths. PR 3: `src/lib/space/regions.js`, `regionOf([sx, sy, sz]) → { kind, name, danger, richness } | null` (null for the Core and the neighbourhoods), regions of about three by three sectors, shaping how dense and what kind the generated systems are and naming them on the chart; the ship session reads `danger` and `richness`.

## Constraints

- The owner’s rules in `HANDOFF-universe.md` hold: nothing a visitor can do is lost; pure first; draw calls and triangles no higher at any checked pose; one PR at a time, CI green, a merge commit.
- No model names; British spelling.
- Sessions: the ship session owns the flight numbers, the economy and exploration (and will read `regionOf`); the galaxy GUI session owns `/galaxy`’s screens; the tour session owns the welcome and the tours.

## Calls made here, for the owner to check

- The Star Wars gate stays a portal into `/galaxy`; the galaxy itself is untouched and is “its own thing” already.
- Distances: one to three and a half sectors, reached by the jump; the super-speed fallback takes a few minutes to the furthest.
- The fleet-war fronts’ waypoint positions move with the worlds (one rewrite of their fixture).

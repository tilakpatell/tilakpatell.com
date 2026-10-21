# Rick and Morty: worlds, not rooms

**Date:** 2026-10-21 · **Status:** accepted (revised after five critics read the draft against the code) · **For** the owner's word: "Go and make sure Rick and Morty worlds are amazing, populated and don't feel empty. Make sure there are buildings; it should feel like a world, not a room."

**Where:**
- `src/components/rickmorty/world/dimensions/`: every dial destination and the map's small planets, built by `stage.js`.
- `world/models.js` and `portal/crowdPaint.js`: moved helpers.
- `src/lib/three/bakePose.js`.
- Two wiring lines in `world/scene.js`.
- `scripts/c137-shots.mjs`: a frame-cost readout.

## Why

The shots and the code, as of 2026-10-21 (the readers' maps, `scratchpad/worlds`):

**What there is**
- 36 place rows. Gazorpazorp's box is retired, which leaves 35 live places: 17 outdoor and 18 rooms.
- Every outdoor place is the same 70 × 50 m box of painted ground. Morty stops at a line he can't see, and past it the ground runs 130 m into fog with nothing on it. Only Bird World's towers and Get Schwifty's Cromulon heads stand beyond a box.
- The arrival half of every outdoor box is bare. Morty comes in 7 m from the south edge facing north. With the camera about 2.45 m up and 5.6 m back, the lower half of the first frame is ground.
- Rooms are four closed walls and a ceiling, and every view out is a painted panel.
- A place holds 0 to 15 figures. Get Schwifty's audience is 60 glowing dots.
- Every outdoor place's fog takes Blips and Chitz's pink sky (`scene.js:456`), whatever its own sky is: Pluto's, Gear World's and Snake Planet's horizons show a pink seam.
- Nothing in a dimension reads the device's level.

**What the code already allows**
- Only the area Morty is in is drawn (`scene.js:438`), so anything beyond a box never meets a neighbour.
- The room kit merges everything drawn with `R.frame` into a few draw calls.
- Code-built buildings are the precedent where no model of that kind exists: the street's houses, the town's shops, Blips and Chitz, Mortytown, and the engine planets' towns (`planets/props/towns.js:1`, "built in code where there's no model").

## The rules this pass keeps

- **Figures and props are models.** The owner's rule: never a figure or a prop drawn in code where a model can stand.
  - People are copies of existing cast models.
  - Ships are existing ship models.
  - Rocks, bushes, flowers and street lights are the Quaternius models the town already draws (`public/models/quaternius`).
  - A building is drawn in code only where no model of that kind exists. Where a place's own building has a model (Purge's cottages, barn, well and siren; the Cronenberg house and car; the Frundles' house; Bird World's perch; Gear World's big gear and cogs; Squanch's suckulents), the model stands. The builders that draw a code twin of one today (`purge.js`, `cronenberg.js`, and the suckulents in `squanch.js`) are changed to the model in this pass.
- **No new model files.** Crowds are made only of:
  - the unrigged destination figures (9–15k triangles each), drawn instanced;
  - the light copies already on disk (`public/games/meshy/crowd/`: `cop`, 12 Mortys, 20 Ricks, `supremeguard`, about 3–4k each);
  - the light rigged figures (the Meeseeks, the Gromflomite, the Gazorpian, the cop, about 8k each), stood in a clip's pose by `bakePose` at load.

  The heavy rigged figures (Birdperson, Zeep, the Glip-Glop, the Atlantean, 30–41k) appear at most twice in a place, or not at all. Lighter copies made by `scripts/crowd.mjs` would allow bigger crowds; that's the owner's call, and is left as a follow-up.
- **Named landmarks stay unique.** One Squanchy's house, one Thirsty Step, one Needful Things. A place's set piece is repeated at most twice, at least 40 m apart, and never beside itself.
- **Family vehicles are never traffic:** not Jerry's car, Space Beth's ship, the cruiser, the Gotron or the Dirly car. The traffic is:
  - the Federation's ships (`fedship`, already loaded at boot);
  - the Zigerion mothership (`zigerion-ship`), once, high and slow over Customs;
  - the snakes' rockets on Snake Planet.

  Where there is no model for traffic, there is no traffic.
- **No look-alikes of a place's threats or people.**
  - Inside a place's box, the crowd never uses a kind any of its hunters or lookouts are, or a kind one of its named people is.
  - Copies of those kinds stand only behind glass, or at least 7 m beyond the edge (30 m for a named person's kind).
  - Tested.
- **The crowd follows the story.** A crowd entry takes `until`, `after` and `when`, as people do (Squanch's wedding guests go when the raid starts).
- **One line, on the live cast only.** The instanced crowd has no line, as the Citadel's has none (`docs/decisions/2026-10-20-rick-and-morty-without-the-ink-pass.md`). The flat colours and the two-step ramp are unchanged.
- **NPCs do things.** The crowd walks, queues, gathers, watches and hops on a beat. Gatherings turn to Morty when the place hunts him.
- **Not touched:** the planets on the engine, Gazorpazorp, draft PR #1028's files, `RmWorld.jsx`, and the files over 800 lines (`scene.js` gets two wiring lines). Five places are reached only from the map (Purge, Cronenberg, Snake Planet, Nuptia and the Resort). They take the same records as the rest, kept to data. Their records are shaped so an engine site can reuse them when those planets move.

## What every place gets

Six layers, from one record a place (`WORLDS[id]`), drawn by shared code inside `stage()` before the room kit builds.

1. **An edge that belongs to the place**, on the walkable box's line, with no gaps (a road that runs out under it ends at a gate or a striped barrier, as the street does):
   - towns get a kerb, the street being the strip beyond it;
   - wild places get Quaternius rock or bush clusters set 0–5 m outward at irregular offsets, with a cluster at each corner;
   - stadiums get a barrier;
   - the shore and the cliff edges follow the builder's own line.

   Solid edges stand 0.9 m at most and see-through ones (rail, fence, barrier) 1.4 m at most, so the camera, which can drop to 0.4 m up just outside the line, never hides Morty behind it. The south side, by the way in and the portal home, is a kerb or a rail.
2. **Buildings round it**, per side (`n`, `e`, `s`, `w`, each a depth and rows or nothing):
   - The near ring starts 8 m past the edge, faces in, and steps up on plinths row by row, so the place reads as a valley or a hillside town, not a yard.
   - The far skyline runs from 100 m to 0.8 × the fog's far edge, its towers at least 2.5 × the near ring's height so they show over it.
   - A vista stays open along the way in's axis (±15° of north) for the place's hero piece.
   - The near ring is the code styles below and the place's own sets. The skyline is code only.
3. **A forecourt** in the box's south half, for the first frame:
   - a path from the way in to the hero piece, painted on the ground;
   - model props along it;
   - one gathering 10–20 m ahead, off to one side, facing the hero piece;
   - walker loops that cross the frame 8–15 m ahead in the first seconds.
4. **People**, an instanced crowd scaled by the device's level:
   - walkers on closed loops (inside the box, off every solid, person, wander route and spot);
   - gatherings standing beyond the edge, or inside the box on a solid block no taller than 1.2 m. A block is a pen, a rail or a counter, so Morty never walks through someone who stands.
5. **Traffic**: the ships above on lanes, where the place has a sky they'd fly in.
6. **For a room, a world outside.**
   - Its walls get real openings (windows, a glass wall, stage doors), mostly on the north wall the first frame faces, in place of the builder's painted panel there. The panel is removed in the same change.
   - Outside is either `ground` (a sky dome, the ground, and layers 2 and 5) or `space` (a painted star sphere, a planet or a moon, and traffic).
   - The room takes a fog that begins past its own depth, in the outside sky's colour.
   - Everything outside casts no shadow, so nothing falls on the room's floor.
   - The room also gets people of its own: a queue, a gallery, more in the pens.

What doesn't move:
- a place's games, its people, hotspots, solids, tasks and lines;
- its box, centre, kind, way in and portal home.

## The parts

New files, each with its test beside it and under 800 lines:

| file | what it is |
| --- | --- |
| `dimensions/worlds.js` (+ `worlds2.js` past 600 lines) | `WORLDS`: each place's record (below). Imported only by `stage.js` and the lazy builders. |
| `dimensions/blocks.js` | `blocksOf(id, d)`: the record's blocks, as solids in world coordinates. The only part `destinations.js` merges, so the records stay out of the first download. |
| `dimensions/outskirts.js` | `outskirtsOf(d, world, { tier })`, pure: the edge's pieces, the lots by side and row, the skyline, the forecourt's path and props, the crowd's loops and gatherings with their extents, the traffic lanes, `reach`. Seeded by the place's id, so it's the same every visit. |
| `dimensions/crowdPose.js` | Pure: where a walker is at time t on its loop, its heading, its sway and bob; a gathering's hop. Writes into a matrix it's given. |
| `dimensions/lots.js` | The code building styles drawn into the room kit with `BOX`, `CYL8` and `BALL8` only: `block`, `tower`, `dome`, `hut`, `tudor`, `stack` (toothed drums), `adobe`, `mushroom`, `spire`, `stand` (bleachers), `hangar`, `mast`, `berm`. Windows are a world-UV tiled paint per wall colour (`tiledPaint`), not atlas cells. |
| `dimensions/crowd.js` | `createCrowd(kit, R, laid, { tier })`. Each kind's walkers are one `InstancedMesh` on a fresh toon material, moved on the matrix each frame. Each kind's gatherings are another, on the breathing material. Each mesh's bounding sphere is set once from its extent. There's no shadow. `hop()`, `turn(to)` and `show(group, on)` follow the story and the place. |
| `dimensions/surround.js` | `surround(ctx, world, laid)`: draws layers 1–3 and 6, stands the sets, the props and the traffic, and makes the crowd. Every load goes through `kit.track` on a promise of its own that doesn't hold up the place's games. A failure leaves the place as it was. |
| `world/models.js` | The town's `partsOf`, `instanced` and `stoodOn` moved out of `town/scene.js` and made general (`paint: false` for models already painted). The town imports them. |
| `portal/crowdPaint.js` | The Citadel's `BREATH`, `breathing` and `standing` moved out of `citadel/crowd.js`, which re-exports them. No pixel changes. |
| `src/lib/three/bakePose.js` | `bakePose(root, clip, t)`: a rigged figure stood in a clip's pose as plain geometry. Positions and normals are skinned once (`applyBoneTransform`) into new float attributes in the root's space. |

**Wiring.**

`stage()` reads `WORLDS[id]` at its top, and:
- gives the walls their openings (`wallLine`'s `openings`, drawn by `lots.js`'s frames, never `win()`);
- sizes its one ground from `reach`;
- makes a room's sky.

`done()` calls `surround` before `R.build`. It also merges `hop`, `turn` and `crowd` into `area.actions`. The three builders that replace `area.actions` (customs, squanch, purge) spread it instead.

`scene.js` gets two lines:
- the house fog takes the place's own sky (`area.skyLook`) rather than Blips and Chitz's;
- `kit.adopt(o)` puts what arrives late into the house look.

### A world record

```js
WORLDS.<id> = {
  look: { walls, roofs, lit, trim },              // the code buildings' colours, from the place's own (its set pieces' textures, its builder's palette)
  edge: { kind, color, h },                       // kerb | rail | fence | barrier | rocks | bushes | shore | none (rooms)
  ring: { n, e, s, w },                           // each { styles, rows, depth, h, sets: [{ model, h, n }] } or null
  far: { n, e, s, w },                            // each { styles, h } or null: the skyline
  vista: 0.26,                                    // the open angle round north, radians
  forecourt: { path, props: [{ model, n }], gather },
  crowd: { walk: [{ kinds, n: { high, mid, low } }], gather: [{ at, r, face, kinds, n, block?, until?, after?, when? }] },
  fliers: [{ model, n, y, speed, lane }],
  windows: [{ wall, from, to, y0, h, mullion }],  // rooms
  outside: 'ground' | 'space',                    // rooms with windows
  sky, fog,                                       // a room's outside; an outdoor place keeps its row's sky
  hero: [dx, dz],                                 // what the vista and the forecourt's path lead to
};
```

## Budgets

- **The level counted:** `kit.fit.tier`, the renderer row's (a weak chip held at Low by Auto counts as low), not the device tier.
- **What's counted:** every pass, at the way in, with everything loaded.
- **Limit for the crowd:** triangles, not heads. Copies of a kind = floor(the level's crowd allowance ÷ the kind's triangles), from a `TRIS` table that a test holds to the GLB headers.

| level | crowd triangles | crowd kinds | set copies (beyond the place's own) | traffic | lots (near + skyline) | extra draw calls | extra triangles |
| --- | --- | --- | --- | --- | --- | --- | --- |
| high | 360k | 6 | 4 (may cast shadows) | 3 | 40 + 34 | ≤ 24 | ≤ 800k |
| mid | 220k | 4 | 2 (no shadow) | 2 | 30 + 24 | ≤ 16 | ≤ 400k |
| low | 150k | 3 | 0 | 1 (fedship only) | 20 + 14 | ≤ 12 | ≤ 250k |

- **Rooms** take half the crowd and traffic allowance. On low, a room's outside is lots and skyline only.
- **Whole frame:** never over the low row of `lib/budgets.js` (0.8M triangles, 350 calls) at low. (Low's crowd allowance went from 80k to 150k once measured: Get Schwifty with its world draws 329k triangles in 28 calls a frame at low, so 80k left its stands empty.)
- **Low is what the browser checks run on.** `c137-shots.mjs`'s `INFO=1` prints, for each view:
  - calls, triangles (each layer's own too), textures and geometries;
  - the ready wait.

  It runs at `?quality=mid` and `?quality=high` as well.
- **What may not be added:** a shader material, an `onBeforeCompile` (the breathing moves, it isn't added), a light, a loop, a renderer, an import of `lib/three/core`, `lib/cc0`, `galaxy/surface` or `rickmorty/planets/props`, or a JSON over 64 KB. The health budgets stay where they are.
- **Memory:** built areas stay in memory for the session, as they do today. The crowd's meshes, baked geometries and fresh materials are registered with the room so its dispose frees them.

## Each place's world

Build order, with the most care first:
1. customs, schwifty, cablestudio, meeseeksgolf, simulation, agency, microverse, gromflomites;
2. then P8's fantasy, froopyland and dim35c;
3. then the rest.

† = rigged, stood by `bakePose`.

| place | edge · outside | buildings (styles · sets) | people | traffic | openings |
| --- | --- | --- | --- | --- | --- |
| customs | room · ground | the spaceport: apron with pads and Federation ships parked, a control tower, hangars; beyond, the painted city's mushroom-cap towers in its own colours, made 3D | 20+ in a queue through the rope lanes (gearperson-a/b, zigerion, magdalian-a/b/c, plutonian-a/b) on a block ending clear of the queue spot; ground crew outside | fedship lanes; the Zigerion mothership once, high and slow | the north wall glazed where the painted city hangs (30 m, 0.6–6.5 m up) |
| schwifty | barrier · — | a stadium: E, W and S stands on an 8 m apron, Earth's towers beyond; north left to the stage, the light towers and the heads, with 2–3 more heads higher and farther | the pit: two blocks either side of a 4–5 m aisle from the way in to the stage, packed with an Earth crowd (light `cop` copies, tinted) facing north; Earth crowd in the stands; the 60 glow dots and the walk-through barriers go | none | — |
| cablestudio | room · ground | the studio lot: sound stages with the channels' names, broadcast masts | a standing audience at a rail on a raised gallery along the east wall (mixed aliens), clear of the floor the sets' run needs; crew from generic kinds, never copies of the ten channel characters | none | 8 m stage doors open on the west wall onto the lot |
| meeseeksgolf | bushes · — | a clubhouse due north on the axis; Jerry's suburb E and W (code houses in the street's own designs); fairways running on | a Meeseeks† mob of up to 20 on the clubhouse terrace beyond the edge (not the swarm's hunters: beyond the edge), turning on Morty when the swarm starts; the in-box crowd none | none | — |
| simulation | room · none | (inside the hangar; the sky-blue walls kept) more copy-pasted houses along the road | 20+ `simman` on one loop in lockstep (the 2%-CPU joke); zigerion-b/c staff only on the raised walkway | none | none |
| agency | room · ground | a city at night, lit windows | sewer rats running along the skirting (walk-through); agencyguard copies only beyond the glass | none | north and east windows |
| microverse | room · ground | Zeep's white towers and a plaza | a gathering stomping in unison (a steady hop) out on the plaza, of unrigged kinds tinted pale (Zeep's kind is rigged and 41k: two at most) | none | the north window made real |
| gromflomites | room · ground (a hangar apron) | docked Federation ships on gantries | Gromflomite† ground crew outside the glass only | fedship | a hangar window, north |
| fantasy | fence · — | Tudor cottages after `fantasy.js`'s; the giants' castle on a cloud at the beanstalk's top; hills | stair goblins on the tavern's steps | none | — |
| froopyland | bushes (candy) · — | candy hills with solids, mushroom houses, Beth's castle, a lollipop forest to the fog | Froopy copies only beyond the edge (they are its hunters) | none | — |
| dim35c | rocks (roots) · — | a forest of mega trees to the fog | none | Federation patrols | — |
| squanch | bushes (suckulents) · — | the village in code cat-tree houses (Squanchy's house stays one) | wedding guests by the arch (mixed aliens), gone with the raid | none | — |
| birdworld | rocks · — | adobe towers with vine trims; perches (birdperch sets, ≤2) with the hazy towers kept | none in the box; none beyond (no generic bird people) | none | — |
| gearworld | rail · — | toothed gear towers with instanced `sm/gearcog` wheels turning; the big gear (gearbig) as the hero | gearperson-a/b walkers (P10's gear police will be another kind) | none | — |
| pluto | rocks · — | Plutonian domes, mushroom houses, mine heads with turning wheels | a Plutonian rally on a block before the podium, hopping when the king speaks | none | — |
| nimbus | shore · — | no north ring: Atlantis half-sunk 120–220 m out; rocky headlands E and W; a white villa S | none (atlanteans are its hunters) | none | — |
| nuptia | rail (cliff) · — | lodges E, W and S; north open over the cloud sea with far spires | none | none | — |
| resort | kerb · — | hotels outside the field dome (the ring starts 13 m out N and S) | resortguest-a/b at the bar and the pool | none | — |
| snakeplanet | rocks · — | snake domes | none in the box (snakes hunt); a gathering of snake-a/b beyond the edge | snakerocket climbing | — |
| purge | fence · — | the village: purgecottage, purgebarn, purgewell, purgesiren models in place of the code ones; a farmhouse ring | none in the box (magdalians hunt); villagers beyond the fence | none | — |
| cronenberg | wall (rubble) · — | the street's own house designs in a ruined palette, the one cronhouse as the Smiths'; croncar wrecks; Quaternius dead trees | none in the box; Cronenberg copies beyond the edge | none | — |
| blooddome | barrier (tyres) · — | stands built from croncar wrecks; mesas beyond | Death Stalker copies in the stands (deathstalker-a/b, beyond the edge) | none | — |
| frundles | kerb · — | a street of the Frundles' house (≤2 models near) and the same design in code beyond: the place's joke | frundles walkers, frundlesdog | none | — |
| jerryboree | room · ground | a city of towers and domes | a drop-off line of Rick light copies at the desk; Jerrys only at the ball pit (inside its solid), never standing on the floor in the candidates' outfits | none | north windows above the TV |
| gloopynoops | room · ground | a medical city | gloopnurse walkers (the doctors who hunt are Glip-Glops) | none | north ward windows |
| heistcon | room · ground | a casino strip at night | heister copies only behind the booth counters (two heisters are recruitable); a queue at the badge table of other kinds | none | glass behind the keynote stage |
| prison | room · space | the Federation fleet | mixed-alien inmates in the five cells | fedship | a window onto space |
| vindicators | room · space | a planet and a moon; a wing edge of the ship | none more | fedship | the star window made real |
| fortress | room · space | Rick Prime's moon | primedrones racked in wall bays (never on the floor where three hunt) | none | a long window |
| evilrick | room · ground | the dome of Mortys made real: Morty light copies packed tight, breathing, turning as Morty walks in | — | none | the north wall's dome painting made a window |
| dream | room · ground | a dream city: the school (its model), crooked houses, floating door frames | none | none | windows on the dream |
| needful | room · ground | a night street in a small town (the street's house designs), a Quaternius street light | none | none | one window onto the street |
| vat | room · ground | an industrial yard | none more | none | high windows |
| storytrain | room · — | (the scrolling windows kept) | unrigged passengers standing at the vestibules | none | none |
| anatomy | room · — | none: it's the inside of a body | the pens filled with the diseases (copies only inside the pens' solids; the diseases hunt) | none | none |

## What stays fixed, and the tests that hold it

**Boxes, ways in and spots.** Every place's centre, kind, box, way in and portal home stay as they are, so the coordinates `scripts/rm-story-check.mjs` and `scripts/c137-shots.mjs` pin hold without a change. No hotspot or link is added.

**Blocks** (`worlds.test.js`):
- axis-aligned { w, d } with no turn, as the walker's colliders are, and no taller than 1.2 m;
- at least a hotspot's r plus Morty's radius plus 0.5 m from each hotspot's centre, which clears the check's warp spots 0.8–1.7 m off;
- at least 1.5 m from the way in and the portal home;
- at least a link's r plus 0.4 m from each link;
- at least 1 m from every person's and extra's wander route and home;
- an escape's walk from its last spot to the portal grows by no more than 10%;
- `rules.test.js`'s flood still reaches every hotspot.

**Crowds** (`worlds.test.js`):
- inside the box, no hunter's, lookout's or named person's kind;
- walker loops at least 1 m off every wander route and 2 m off the way in, the portal home and every spot's r;
- every world's kinds and models are in `MESHY` or on disk at the URL the loader builds;
- triangles within the level's allowance (`TRIS`, held to the GLB headers);
- gated entries gated.

**Layout** (`outskirts.test.js`):
- nothing taller than 1.4 m within 7 m outside an outdoor box;
- no lot within 8 m of the edge, or on the vista or the way in's axis;
- skyline radius ≤ 0.8 × the fog's far edge, and `reach` ≥ the fog's far edge + 20 m;
- no gap in an edge;
- each kind's extent holds every pose `crowdPose` returns;
- same id, same layout.

**Schwifty.** No lot or skyline rises into the sight lines from the mic to the Cromulon heads.

**Each new file's test:**
- `lots.test.js`: each style inside its footprint and height;
- `crowd.test.js` (fake kit): counts by level, `hop` lifts and settles, `show` hides, `dispose` frees everything, nothing joins `N.list`;
- `surround.test.js` (fake kit): every load tracked, and a throw or a failed load leaves the builder's area and actions as they were;
- `bakePose.test.js`: a two-bone skinned box baked in a clip's pose lands where the skinned mesh draws it, normals turned with it;
- `world/models.test.js`;
- the moved helpers keep their tests.

**Shots.**
- The street and the town before and after the `models.js` move: identical.
- The Citadel before and after the `crowdPaint.js` move: identical.

**The browser:**
- `c137-shots.mjs` of every place before and after, with `INFO=1`;
- `rm-story-check.mjs` green on a fresh save;
- the CLAUDE.md four green.

## For P7

- Get Schwifty's audience is the pit's gathering and the stands. The `hop` action lifts them on a beat. A DOM overlay stops the world's frames, so P7's rhythm either plays over a live world or has the audience cheer when it closes.
- The cable studio's floor between the sets stays clear (the audience is on the east gallery). P7 tunes its sequence clock on the floor as this pass leaves it.
- P7 starts by making the story check read its coordinates from `DESTINATIONS` (way in, portal home, spots), so a later layout change can't break it silently.

## Not in this

- **Box sizes:** growing a box is left for a place whose game needs room (Fantasy World's climb in P8).
- **Other areas:** the C-137 town and street, Blips and Chitz (`annex.js` is over 800 lines; its own pass), the Citadel, and the planets on the engine.
- **Seated or lying crowds:** they need rigged kinds posed on sit and lie clips. The audiences stand.
- **New files:** new models, new cast, and lighter copies by `scripts/crowd.mjs` (the owner's call).

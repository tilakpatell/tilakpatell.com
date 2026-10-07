# A map on every world you walk: the galaxy's surfaces and the universe's landings

Date: 2026-10-07. Status: agreed in conversation (approach A, below). The plan
is `docs/superpowers/plans/2026-10-07-world-maps.md`. The lava work asked for in
the same message (Mustafar's lava burns, a better lava look, lava on Nevarro's
flats) is a bounded change done beside this one and is not part of this spec.

## Intent

What the user asked: every world in the universe and the galaxy gets a map.

Agreed in conversation:

- "Every world" means every place you walk after landing: the galaxy's
  surfaces (`src/components/galaxy/surface/`, all 18 systems) and the universe
  map's landings (`src/components/universe/footScene.js`, every landable
  planet and moon). The standalone world pages (`/invincible`, `/cybertron`,
  Minecraft, Albuquerque and the rest) are out of scope.
- The form is a corner minimap that is always on, plus a full-screen map on M
  (or a tap on the minimap).

What the code does today:

- The space views already have maps: the universe's nav map (`NavMap.jsx`) and
  the galaxy's holo map (`HoloMap.jsx`), both on M while flying.
- A galaxy surface has a compass bar (`scene.js`'s `compass()`, marks in
  `GalaxySurface.jsx`) with the places, the ship and the quest, but no map.
- A universe landing has no map and no compass.

Done looks like this. On any galaxy surface and any universe landing a round
minimap sits in a corner. It shows the ground around you, turned to the way the
camera faces, with you, your mate, the ship, the places, the quest target,
enemies near you and other pilots. M opens a full map of the whole walkable
world, north up, with names, a legend and a list of places with distances. On a
universe landing the full map also has a Planet tab: the planet's own map with
you, the ship and the landing site on it.

## Approach

Approach A, agreed: one shared map piece, fed by both engines. Each engine hands
it a background picture once (a "base"), then a small snapshot (a "frame") a
few times a second. This is how the galaxy's compass already works: the scene
writes into a ref the page gives it.

Rejected: B, each scene drawing its own map (two copies of the drawing code
drifting apart); C, a live top-down 3D render (an extra render pass every
frame, fog and far LOD in the way, awkward on a sphere).

## 1. The shared piece: `src/lib/worldmap/`

Three files, each with one job.

### `project.js` (pure, tested)

The map's coordinates. A world is flat metres `(x, z)` with north toward +z and
east toward −x, as the galaxy compass has it (`atan2(dx, dz)` is the bearing).

- `view({ centre, yaw, radius, size, headingUp })`: how a world point lands on
  a square canvas `size` pixels across, `radius` metres from middle to edge.
  Heading-up turns the map so the camera's way is up. North-up does not turn it.
- `toPixel(view, [x, z]) → [px, py]` and `toWorld(view, [px, py]) → [x, z]`,
  each the other's inverse.
- `onRim(view, [x, z], inset)`: a target off the round minimap is clamped to its
  rim, with the bearing kept, so an arrow there points the right way.
- `fit(area, w, h, pad)`: the north-up view that fits a whole area into a box
  (the full map).

### `bake.js` (pure, tested)

The background picture as RGBA bytes, from functions of a point, so it runs in
Node.

- `bakeBase({ area, size, colour(x, z, out), height(x, z), water })`:
  - Colour: the ground's colour, linear in, sRGB bytes out (as
    `lib/three/groundmap` does).
  - Hillshade: light from the north-west, from the height's slope, mild so the
    colours stay readable.
  - Water: where the height is under `water.level`, the water's colour by kind
    (sea and swamp: their `color` toward `deep` with depth; lava: a hot orange
    with darker crust; clouds: a pale grey-white).
- `footprints(solids)`: the walker's circles and boxes (`createSolids().all`)
  and the floors (decks, platforms) as shapes for the canvas to fill. Buildings
  read as darker blocks with a light edge.

### `WorldMap.jsx` and `worldmap.css`

A React component with an imperative handle:

- `setBase(base)`. The base is
  `{ title, area: { x0, z0, w, d }, picture: ImageData | HTMLCanvasElement, footprints, places: [{ id, name, at: [x, z], r, found }], tabs?: { planet: { picture, title } } }`.
- `update(frame)`. The frame is
  `{ me: { x, z, yaw }, cam: yaw, mate?, ship?, quest?, marks: [{ x, z, kind }], zone?: { name, door: [x, z] }, planet?: { me: [u, v], ship: [u, v], site: [u, v] } }`.
  The kinds are `hostile`, `peer`, `npc` and `door`.

The minimap:

- Round, about 150 px on a desktop and 112 px on a phone, in a corner picked
  against each page's HUD and checked by screenshot.
- Redrawn at about 12 Hz from the last frame. One 2D canvas: the base clipped
  to the circle and turned, footprints over it, marks over those, you in the
  middle as an arrow, and an N tick on the rim.
- Shows about 120 m of radius on a galaxy surface and about 90 m on a universe
  landing.
- Heading-up. Under reduced motion it is north-up and does not turn.
- The ship and the quest, when off the minimap, are arrows on its rim.
- `aria-hidden`: the compass and the full map's list carry the same facts as
  text.
- A tap or click on it opens the full map.

The full map:

- A dialog (`role="dialog"`, `aria-modal="true"`, labelled with the world's
  name). It opens on M and on a tap of the minimap, and closes on M, Escape and
  its × button. The game keeps running under it. While it is open, the keys
  that fly or walk are ignored; the universe scene already skips its keys while
  an `aria-modal` element is up.
- North-up, the whole walkable area fitted to the screen, with the same marks
  at full size and the places named (a place not yet found is a "?", as on the
  compass).
- A legend, and a list of places with their distance from you; the list is the
  text alternative.
- Tabs where the base has them. A universe landing has two: Here (the local
  map) and Planet.

## 2. The galaxy's surfaces: `galaxy/surface/mapBase.js`

`mapBaseOf({ site, grid, painter, groundMap, world })` returns the base:

- The area is the walkable square (`groundPaint.js`'s `mapAreaOf()`, ±640 m).
- The picture comes from the ground map's painted bytes where the world made
  one (`pieces.map`). Otherwise `bakeBase` makes a 256² picture through
  `groundPainter`'s `paint`. Either way the hillshade (from `grid.heightAt`)
  and the water (`site.water`) go over it.
- A world with no ground (`site.noGround`: Bespin's Cloud City) is a sea of
  cloud with its decks and solids drawn on it.
- The places are `site.places`, each marked found from the page's `found` list,
  like the compass marks.
- The footprints are read from `world.solids.all` and `world.floors`. Models
  load after the scene starts, so the footprints are read again when the
  solids' count changes, at most once a second.

The frame, from `scene.js`, written beside `compass()` each tick and sent at
about 12 Hz (`props.map.current?.update(...)`):

- `me`: the lead's `st.x`, `st.z` and facing; `cam`: `state.cam.yaw`.
- `mate`: the other party member. `ship`: `landAt`.
- `quest`: the same target `compass()` works out for its quest mark (a chase's
  target, an assault's target, a step's target or door, or the tracked
  giver).
- `marks`: hostiles alive within the minimap's reach (`life.actors` with a
  hostile spec), other pilots (`peers.js`), and the zones' doors.
- `zone`: inside a zone (a cantina, a temple), its name and the door outside.
  The minimap shows "Inside · <name>" over the outside map pinned at that door,
  and the full map marks you at the door.

`GalaxySurface.jsx` mounts `<WorldMap>` with a ref, passes the ref down through
`SurfaceView` as a `map` prop (like `compass`), adds M to its key handler (with
Escape closing the map as it closes the quest list), and hides the minimap
while landing, as the compass is hidden.

## 3. The universe's landings: `universe/landings/mapBase.js`

A landing lives on a sphere. Things stand on it in metres round the landing's
frame (`foot.js`'s `place(frame, x, z, R)`: +z ahead along the frame's `f`, +x
to its left). The map uses that frame as its flat world.

- `toFrame(frame, n, R) → [x, z]` (pure, tested): the inverse of `place`. The
  arc from the frame's `n` to `n`, in metres, split along `f` and along
  `n × f`. `place(frame, x, z)` then `toFrame` comes back to `(x, z)` within a
  centimetre for points out to 2 km.
- The map's own frame is laid at the landing spot's `n` with `f` toward the
  planet's north pole (`flat([0, 1, 0], n)`; within 2° of a pole, the landing
  frame's `f` instead). So north-up is the planet's north. Things the landing
  placed in its own frame are taken to the map's frame through their `n`.
- The local picture is a 256² square ±250 m round the frame's middle. Each
  texel maps through `place` to a point on the sphere, then `uvOf` reads the
  planet's readable map (`readableMap`, the far map `footScene` keeps). That
  is the same colour the ground patch draws. `sampleMap`'s 256 × 128 copy is
  too coarse at this scale (tens of metres a texel), so the map keeps its own
  copy of the image at up to 2048 × 1024, made once per planet and read with
  bilinear filtering. There is no height map, so no hillshade.
- When you walk more than 120 m from the picture's middle, a new frame is laid
  at your feet, again with `f` toward the pole, and the picture is baked
  again round it (a 256² pass of reads from a cached `ImageData`: a few ms).
  Places and footprints are worked out again in the new frame.
- The footprints are the furnished solids (`furnish`'s `solids`: circles on the
  sphere) taken through `toFrame`.
- The places are the landing's spots: doors (`label`, such as "Enter
  Albuquerque", from `wayin.js`) and people with a line (`say.name`).
- The Planet tab: the readable map drawn whole (equirect), with you, the ship
  and the landing site marked by `uvOf` of their `n`.

`footScene.js` gains `mapBase()` and `mapFrame()`. `mapFrame()` returns `me`,
`mate`, `ship`, the troops as hostile marks, the guests (other pilots' crews)
as peer marks, and the planet tab's points. The universe's `scene.js` calls
`props.footMap.current?.update(foot.mapFrame())` at about 12 Hz while on foot
and `setBase(foot.mapBase())` when the crew step out and after each re-bake.
`UniverseMap.jsx` mounts `<WorldMap>` while `onFoot`, and on foot M opens the
full map instead of the nav map. The nav map stays on M in flight.

## 4. Errors and edge cases

- No readable planet map (a KTX2 only): the local picture is the planet's
  `palette` colour, flat, and the Planet tab is hidden. Footprints and marks
  still show.
- A world whose painter is not available (low tier with no ground map): the
  256² bake through `groundPainter` runs once on load. It is budgeted at
  under 80 ms on a phone. If the measured bake is slower, it drops to 128².
- 3D off or lost: no scene, no map. The page's own no-3D note stands.
- Multiplayer: the map only reads. Nothing new is sent.
- A battle (`assault`) or chase mission: the map shows the same quest target the
  compass shows. Nothing more is added for missions.

## 5. Testing

- vitest, pure:
  - `project.js`: the round trip, heading-up turns, rim clamping, `fit`.
  - `bake.js`: water fills by kind under the level, the hillshade's direction,
    the footprint shapes from circles and boxes.
  - `galaxy/surface/mapBase.js`: on a real site (Mustafar, Bespin), the area,
    the places' found flags, and noGround giving the cloud base.
  - `landings/mapBase.js`: the `place`/`toFrame` round trip, the map frame's
    `f` toward the pole (and the fallback near one), and a spot put through to
    a place.
- In a browser (Playwright, the pre-installed Chromium, `npm run dev`):
  - Screenshots of the minimap and full map on Mustafar, Hoth, Bespin and
    Coruscant, and on two universe landings (Breaking Bad's and Middle-earth's),
    at desktop and phone sizes.
  - M opens and closes the map.
  - Escape closes the map.
  - A tap on the minimap opens the map.
  - The nav map still opens on M in flight.
- `npm run lint` and the changed packages' tests pass before each push.

## Out of scope

- The standalone world pages' maps.
- Waypoints you set yourself, fast travel, pan and zoom on the full map.
- A map in the space views (they have theirs).

# Planet flight, streamed ground and a shared world: the design

Date: 2026-10-09. Status: design, written from the owner's brief by an architecting session, for Opus 5.5 implementation sessions working in parallel (one lane each). The plans are `docs/superpowers/plans/2026-10-09-flight-terrain.md`, `-durable-world.md`, `-spatial-channels.md` and `-shared-world-integration.md`; the hand-off is `docs/superpowers/HANDOFF-planet-flight.md`; the references are `docs/research/2026-10-09-flight-terrain-and-shared-world-references.md`; the decision on a server is `docs/decisions/2026-10-09-supabase-for-durable-shared-state.md`.

## What the owner asked

An infinite 3D multi-planet flight and exploration game, hosted statically on GitHub Pages. Players fly ships over diverse procedural planets (a snowy Hoth-style one, stylised cartoon ones), find fixed points of interest (Echo Base), and place persistent structures and turrets in a shared world. Three pillars:

1. **Terrain and streaming**: infinite chunks round a fast camera, three.js and FastNoiseLite; heights, vertices and normals made in Web Workers so the page holds 60 frames a second; biomes blended, with a flat, zero-noise plane eased in round each fixed POI inside the deterministic field; clutter (ice rocks, spires, debris) as `InstancedMesh`.
2. **Persistence and spatial queries**: PostgreSQL with PostGIS behind Supabase, reached from the static client with row-level security; one table of world entities across 50 planets (planet, type, a 3D transform, JSONB metadata, a `GEOMETRY(Point, 0)` under a GiST index); an RPC `get_entities_in_bounding_box(planet_id, min_x, max_x, min_z, max_z)` the client calls as its view moves.
3. **Hybrid networking**: volatile state (poses, pitch, yaw, roll, shots) over Nostr ephemeral events, durable state (structures, base health) in Supabase; spatial channels so a client subscribes only to the Nostr tags, and asks only the database cells, of the grid round it.

Deliverables: the terrain generator, the SQL schema and query functions, the client-side chunk loader that joins three.js to Supabase. Each is below as reference code; the plans turn each into a tested file.

## Where the site is today

Read from the code in this session.

- **Static hosting, no server, no secrets at run time.** `deploy.yml` builds and publishes `dist/`. The standing rule (`docs/superpowers/specs/2026-10-05-autopilot-design.md`) forbids run-time calls to asset services and any committed key. The infinite-worlds design left a seam for a server and chose not to open one (`2026-10-07-infinite-worlds-design.md`, answer 4). This design opens it, for one purpose, under the decision entry.
- **Chunking is a runtime service.** `src/runtime/chunkGrid.js` (nearest-first, heading-first, in-flight cap, hysteresis, generations), `src/runtime/workers.js` (`rt.workers`: pools by name, one job a worker, lowest priority first, cancel, transferables), `src/runtime/origin.js` (`rt.origin`: a floating origin moved in whole cells of `ORIGIN_CELL = 50000`, the shift broadcast as the `origin` event). Minecraft and the Expanse's sectors stream through them.
- **Land is data in a worker.** `src/lib/land/cell.js` makes a 64 m cell (heights at 1 m, water, a mask, a placement list of props) from a `spec.js` spec and the shared layers (`layers.js`, over `galaxy/surface/noise.js`'s value-noise `fbm`). Built for walking and driving (`src/lib/physics/heightfield.js`), too fine and too slow for a ship at 300 m/s needing 10 km of ground.
- **The POI flat exists.** `src/components/galaxy/surface/terrain.js`'s `levelled(raw, flats)` eases each `{ at, r, edge, h }` into the land with a `smoothstep` band. It lives in a world, so no other world may import it (`docs/health/RULES.md`, “Worlds are islands”).
- **Instancing is a library.** `src/lib/three/pool.js` (one `InstancedMesh` a kind, free slots scaled to nothing), `lod.js` (bands of instanced levels), `gpuWork.js` (uploads and compiles in slices under a frame budget).
- **Multiplayer is Nostr, one room.** `src/components/universe/online/nostr.js`'s `joinRoom` subscribes with `{ kinds: [22742], '#x': [topic], since }` through `pool.js` (one socket a relay, shared by every room; a subscription's `filter` may be a function, asked afresh each time a socket opens). A pose already carries `sec` (`E:sx,sz`) for the Expanse. Nothing filters by place: every client in a room hears every pose in it.
- **Generated planets have ids.** `src/components/expanse/gen/sector.js` gives a planet `id: 'E:sx,sz:i:j'`, `type` (rock, ice, gas, ringed, lava, ocean, forest, desert) and `seed` (a bigint from `seed.js`). The authored planets (Hoth among them) are the galaxy's and the map's.

## The decisions

1. **A planet is an infinite plane, not a sphere.** Flight at a few hundred metres over ground reads as a world; a sphere adds a frame change and a quadtree on a cube for no gain at this height. The quadtree is the same shape either way, so a spherical pass later is a projection, not a rewrite.
2. **One quadtree, leaves by distance, a skirt on every leaf.** Not rings of uniform grids (two grids drawing the same ground fight in the depth buffer; punching holes is where the bugs live). `quadtree.js` is pure: given the camera it names the leaves; a streamer diffs that set against what is loaded, with in-flight caps and generations as `chunkGrid.js` has them.
3. **FastNoiseLite in the worker, behind one wrapper.** `src/lib/land/flight/fnl.js` builds a configured instance per planet seed; nothing else touches the class. The existing value noise stays for the worlds that use it.
4. **Biomes are a weighted blend of layer stacks; a POI is a biome whose stack is one `level` layer.** Weights come from a low-frequency warped noise (temperature, moisture) and a `smoothstep` band at each boundary; a POI's weight is `1 − smoothstep(r, r + edge, d)`, applied last, so inside `r` the height is exactly `h` (zero noise) and the land eases in over `edge`. This is `levelled` generalised: it moves down to `src/lib/land/flats.js` and `terrain.js` imports it from there (a repair: no pixel changes).
5. **Normals and vertices in the worker, from a padded grid.** Heights are sampled on `(N + 2) × (N + 2)` so central differences at a leaf's edge read the neighbour's heights without asking for them; the page only wraps the transferred buffers in a `BufferGeometry`, a capped number a frame.
6. **Clutter is a placement list, drawn by pools.** The worker returns `Float32Array` rows `[x, y, z, yaw, scale, kind]` per leaf at the two finest depths; the page gives each row a slot in the kind's pool and frees the leaf's slots when it goes. One draw a kind. No model files: the kinds are code-built from the look's palette (the world is `painted`).
7. **Supabase is the durable store, by decision entry.** PostGIS with a GiST index, RLS on every table, anonymous sign-in for ownership, an RPC for the envelope query, `SECURITY DEFINER` functions for the few writes that are not the owner's (damage). The client works without it: no URL in the environment means no durable layer, and the flight still flies.
8. **Volatile and durable never share a path.** Nostr carries what dies in a second (poses, shots, hits); Supabase carries what must outlive the visit (what is built, its health). A durable change is *announced* on Nostr as a one-line hint (`built { id, cell }`) so neighbours refetch that cell now; Supabase Realtime is the backstop for anyone whose relay missed it.
9. **One spatial grid for both channels.** `NET_CELL = 2048` m. A client subscribes to the `#g` tags of the 3 × 3 cells round it and asks the database for the same cells. Nostr relays index single-letter tags (NIP-01), so `#g` is a filter the relay applies, not the client.
10. **A room a planet.** The room id is `fly-v1:<planetId>`, so a planet's traffic never reaches another planet's clients at all; the cells cut it further within one.

## Pillar 1: terrain and streaming

### The files

```
src/lib/land/flats.js                 flatten(height, flats) → (x, z) → metres   (moved from galaxy/surface/terrain.js's levelled)
src/lib/land/flight/fnl.js            noiseFor(seed, opts) → (x, z) → −1…1       (the one FastNoiseLite wrapper)
src/lib/land/flight/biomes.js         BIOMES, biomeWeights(spec, x, z) → number[]
src/lib/land/flight/field.js          planetField(spec) → { heightAt(x, z), biomeAt(x, z) }
src/lib/land/flight/planetSpec.js     planetSpecOf(planetId) → spec (type, seed, biomes, pois, palette, clutter)
src/lib/land/flight/quadtree.js       ROOT, MAX_DEPTH, leavesFor(x, z, { split, maxDepth }) → Map<key, leaf>
src/lib/land/flight/leafMesh.js       makeLeaf(spec, leaf, { n }) → { positions, normals, indices, heights, clutter }
src/lib/land/flight/sample.js         heightOn(leaf, heights, n, x, z) → metres (bilinear, the drawn triangles)
src/lib/land/flight/stream.js         createLeafStream({ inFlight, keep }) → { update(leaves) → { ask, drop, cancel }, began, done, failed, reset, loaded, gen }
src/components/expanse/flight/terrain.worker.js   the worker: { key, spec, leaf, n } → makeLeaf's answer, transferred
src/components/expanse/flight/ground.js           the leaves on the page: geometry from buffers, pools for clutter, reanchor on the origin
src/components/expanse/flight/flightRules.js      stepShip(ship, input, dt) → ship (pure)
src/components/expanse/flight/scene.js, module.js, look.js, FlightHud.jsx, pack.js
src/pages/Fly.jsx                                  /fly/:planet
```

Constants, verbatim in the code: `ROOT = 16384` (metres, the root tile), `MAX_DEPTH = 6` (a 256 m leaf), `SPLIT = 1.6` (a leaf splits while the camera is nearer than `size × SPLIT` to its centre), `N = 33` vertices a side (`65` at high and ultra), `SKIRT = 12` m, `IN_FLIGHT = 6`, `UPLOADS_PER_FRAME = { low: 1, mid: 2, high: 3, ultra: 3 }`, `CLUTTER_DEPTHS = [5, 6]`, `NET_CELL = 2048`.

### Noise (`fnl.js`)

```js
// One configured FastNoiseLite per use, behind a function of (x, z), so the
// class is named in this file only. Seeds are 32-bit (a planet's bigint is
// folded: low 32 bits xor high 32).
import FastNoiseLite from 'fastnoise-lite';

export const fold = (seed) => (typeof seed === 'bigint' ? Number((seed ^ (seed >> 32n)) & 0xffffffffn) | 0 : seed | 0);

export function noiseFor(seed, { type = 'simplex', frequency = 0.01, octaves = 4, lacunarity = 2, gain = 0.5, fractal = 'fbm', warp = 0 } = {}) {
  const n = new FastNoiseLite(fold(seed));
  n.SetNoiseType({ simplex: FastNoiseLite.NoiseType.OpenSimplex2, cellular: FastNoiseLite.NoiseType.Cellular, perlin: FastNoiseLite.NoiseType.Perlin, value: FastNoiseLite.NoiseType.Value }[type]);
  n.SetFrequency(frequency);
  n.SetFractalType({ fbm: FastNoiseLite.FractalType.FBm, ridged: FastNoiseLite.FractalType.Ridged, pingpong: FastNoiseLite.FractalType.PingPong, none: FastNoiseLite.FractalType.None }[fractal]);
  n.SetFractalOctaves(octaves);
  n.SetFractalLacunarity(lacunarity);
  n.SetFractalGain(gain);
  let w = null;
  if (warp) {
    w = new FastNoiseLite(fold(seed) ^ 0x5bd1e995);
    w.SetDomainWarpType(FastNoiseLite.DomainWarpType.OpenSimplex2);
    w.SetDomainWarpAmp(warp);
    w.SetFrequency(frequency * 0.5);
  }
  const c = { x: 0, y: 0 };
  return (x, z) => {
    if (!w) return n.GetNoise(x, z);
    c.x = x;
    c.y = z;
    w.DomainWrap(c);
    return n.GetNoise(c.x, c.y);
  };
}
```

### Biomes and the field (`biomes.js`, `field.js`, `flats.js`)

A planet spec (`planetSpec.js`, pure, from a planet id: the Expanse's `makeSector` for `E:` ids, a table for the authored ones):

```js
{
  id: 'hoth', seed: 0x48f1a2c3, type: 'ice',
  climate: { frequency: 0.00025, warp: 400 },          // the two low-frequency fields the biome weights come from
  biomes: [                                             // each a layer stack (lib/land/layers.js's types), and where it lives
    { id: 'plain', at: [0.2, 0.5], reach: 0.35, base: 0, relief: [{ type: 'swell', scale: 900, height: 24 }, { type: 'hills', scale: 180, height: 7 }] },
    { id: 'ridge', at: [0.8, 0.3], reach: 0.3,  base: 40, relief: [{ type: 'ridges', scale: 700, height: 160 }, { type: 'hills', scale: 120, height: 10 }] },
    { id: 'glacier', at: [0.3, 0.9], reach: 0.3, base: 10, relief: [{ type: 'dunes', scale: 300, height: 14, wind: 0.4 }] },
  ],
  pois: [{ id: 'echo-base', name: 'Echo Base', at: [1200, -800], r: 220, edge: 160, h: 12 }],
  palette: { low: '#e9f0f7', high: '#ffffff', rock: '#6b7a8c', accent: '#9fb7d1' },
  clutter: [{ kind: 'rock', perKm2: 60 }, { kind: 'spire', perKm2: 6, depth: 5 }, { kind: 'debris', perKm2: 20 }],
}
```

Every world's ground is the fiction's: `docs/research/2026-10-09-planet-geographies.md` gives each of the 50 its biomes, POIs, palette and clutter, and the flight's ground round a walkable site reuses that site's layers so it is recognisably the same place. A planet type is three to five biomes, not one, and uses every layer `layers.js` has (swell, hills, dunes, mesas, ridges, mountains, channels, island, level): the ice world has wind-scoured plains, a ridge range of 160 to 260 m over a raised base, a glacier field with crevasse channels and a frozen sea with islands; the desert has dune seas, mesa country, canyon land and salt flats; rock has broken highlands, crater fields (negative islands) and rolling regolith; lava has ridged rock cut by channels, a caldera and cinder plains; the stylised types have rounded hills and warped `pingpong` plateaus; the ocean an archipelago and a continent edge of mountains. Each biome has its own `base`, so the blend band between two is a slope you fly down, never a step. The tables live in `planetSpec.js` (or a `tables.js` beside it), and `field.test.js` pins every type finite, within `[−200, 1200]`, and nowhere steeper than 60 m over 4 m outside a POI's edge.

`biomeWeights(spec, x, z)` samples two warped noises (`noiseFor(seed, climate)` and `noiseFor(seed + 1, climate)`), maps them to `[0, 1]`, and for each biome takes `w = 1 − smoothstep(reach × 0.6, reach, distance((t, m), biome.at))`, then normalises so the weights sum to 1 (a point outside every reach falls back to the first biome). `heightAt(x, z) = Σ wᵢ (biomeᵢ.base + fieldAt({ seed, relief: biomeᵢ.relief }, x, z))`, then `flatten(heightAt, spec.pois)`.

`flats.js` is `levelled` moved and renamed; its tests move with it (`terrain.test.js` keeps its cases through the import). The signature stays `flatten(raw, flats = []) → (x, z) → metres`; a flat is `{ at: [x, z], r, edge?, h? }`. Inside `r` the answer is `h` exactly: the test asserts `heightAt(poi.at[0], poi.at[1]) === poi.h` and the same at `r × 0.99`, and that at `r + edge` the raw field is back.

### The quadtree (`quadtree.js`)

```js
export const ROOT = 16384;
export const MAX_DEPTH = 6;
export const SPLIT = 1.6;
export const keyOf = (d, ix, iz) => `${d}:${ix}:${iz}`;
export const sizeAt = (d) => ROOT / 2 ** d;
// the leaf's square: { key, d, ix, iz, size, x0, z0 } (x0, z0 its min corner, world metres)
export const leafOf = (d, ix, iz) => ({ key: keyOf(d, ix, iz), d, ix, iz, size: sizeAt(d), x0: ix * sizeAt(d), z0: iz * sizeAt(d) });

// The leaves to draw for a camera at (x, z): the root tiles within `view`
// metres, each split while the camera is nearer than size × split to its
// centre and d < maxDepth. Breadth first, so the Map's order is coarse to
// fine (the streamer asks in that order: the far ground comes first, the
// detail under the ship next).
export function leavesFor(x, z, { split = SPLIT, maxDepth = MAX_DEPTH, view = ROOT * 1.5 } = {}) {
  const out = new Map();
  const rx0 = Math.floor((x - view) / ROOT), rx1 = Math.floor((x + view) / ROOT);
  const rz0 = Math.floor((z - view) / ROOT), rz1 = Math.floor((z + view) / ROOT);
  const queue = [];
  for (let iz = rz0; iz <= rz1; iz++) for (let ix = rx0; ix <= rx1; ix++) queue.push(leafOf(0, ix, iz));
  while (queue.length) {
    const l = queue.shift();
    const cx = l.x0 + l.size / 2, cz = l.z0 + l.size / 2;
    const near = Math.hypot(x - cx, z - cz) < l.size * split;
    if (near && l.d < maxDepth) {
      for (let dz = 0; dz < 2; dz++) for (let dx = 0; dx < 2; dx++) queue.push(leafOf(l.d + 1, l.ix * 2 + dx, l.iz * 2 + dz));
    } else out.set(l.key, l);
  }
  return out;
}
```

The streamer (`stream.js`) is `chunkGrid.js`'s bookkeeping over arbitrary keys: `update(leaves)` returns `ask` (wanted, not loaded, not flying, up to `inFlight` free slots, in the Map's order), `drop` (loaded, not wanted for `keep` consecutive updates: the hysteresis), `cancel` (flying, not wanted); `began(key, gen)`, `done(key, gen)` (refused when the gen moved or the key was cancelled), `failed(key, gen)`, `reset()` bumps `gen`. Pure, tested like `chunkGrid.test.js`.

### The leaf mesh (`leafMesh.js`)

```js
import { fieldAt } from '../layers.js';
import { biomeWeights } from './biomes.js';
import { flatten } from '../flats.js';
import { seeded } from '../../seeded.js';

export const SKIRT = 12;

// heights on a padded grid: (n + 2)² samples a `step` apart, the leaf's own
// n² inside them, so the normal at an edge reads the neighbour's ground
export function makeLeaf(spec, leaf, { n = 33, field, tier = 'mid' }) {
  const step = leaf.size / (n - 1);
  const pad = n + 2;
  const h = new Float32Array(pad * pad);
  for (let iz = 0; iz < pad; iz++) for (let ix = 0; ix < pad; ix++) h[iz * pad + ix] = field.heightAt(leaf.x0 + (ix - 1) * step, leaf.z0 + (iz - 1) * step);

  const verts = n * n + n * 4; // the grid, and a skirt vertex under each edge vertex
  const positions = new Float32Array(verts * 3);
  const normals = new Float32Array(verts * 3);
  const heights = new Float32Array(n * n);
  let v = 0;
  const put = (x, y, z, nx, ny, nz) => { positions[v * 3] = x; positions[v * 3 + 1] = y; positions[v * 3 + 2] = z; normals[v * 3] = nx; normals[v * 3 + 1] = ny; normals[v * 3 + 2] = nz; v++; };
  for (let iz = 0; iz < n; iz++) for (let ix = 0; ix < n; ix++) {
    const i = (iz + 1) * pad + (ix + 1);
    const y = h[i];
    heights[iz * n + ix] = y;
    // central differences on the padded grid: the slope in metres a metre
    const dx = (h[i + 1] - h[i - 1]) / (2 * step), dz = (h[i + pad] - h[i - pad]) / (2 * step);
    const len = Math.hypot(dx, 1, dz);
    put(ix * step, y, iz * step, -dx / len, 1 / len, -dz / len);
  }
  // the skirt: the edge ring again, SKIRT lower, normals straight up (it is never lit as ground)
  const ring = [];
  for (let ix = 0; ix < n; ix++) ring.push([ix, 0]);
  for (let iz = 1; iz < n; iz++) ring.push([n - 1, iz]);
  for (let ix = n - 2; ix >= 0; ix--) ring.push([ix, n - 1]);
  for (let iz = n - 2; iz >= 1; iz--) ring.push([0, iz]);
  const skirtAt = new Map();
  for (const [ix, iz] of ring) { skirtAt.set(iz * n + ix, v); put(ix * step, heights[iz * n + ix] - SKIRT, iz * step, 0, 1, 0); }

  const quads = (n - 1) * (n - 1);
  const indices = new Uint32Array(quads * 6 + ring.length * 6);
  let t = 0;
  for (let iz = 0; iz < n - 1; iz++) for (let ix = 0; ix < n - 1; ix++) {
    const a = iz * n + ix, b = a + 1, c = a + n, d = c + 1;
    // split (ix + 1, iz)–(ix, iz + 1), as cell.js and the galaxy's ground do
    indices[t++] = a; indices[t++] = c; indices[t++] = b;
    indices[t++] = b; indices[t++] = c; indices[t++] = d;
  }
  for (let k = 0; k < ring.length; k++) {
    const [ix, iz] = ring[k], [jx, jz] = ring[(k + 1) % ring.length];
    const a = iz * n + ix, b = jz * n + jx, sa = skirtAt.get(a), sb = skirtAt.get(b);
    indices[t++] = a; indices[t++] = sa; indices[t++] = b;
    indices[t++] = b; indices[t++] = sa; indices[t++] = sb;
  }
  return { key: leaf.key, n, step, positions, normals, indices, heights, clutter: clutterFor(spec, leaf, heights, n, step, tier) };
}
```

`clutterFor` runs only when `CLUTTER_DEPTHS.includes(leaf.d)`: for each kind in `spec.clutter` whose `depth` (default `MAX_DEPTH`) is the leaf's, `count = round(perKm2 × size² / 1e6 × DENSITY[tier])` placements from `seeded(hash of leaf.key and kind)`, each at a random point of the leaf, `y` read from `heights` bilinearly, dropped where the slope is over `0.7` or a POI's flat holds (`spec.pois` within `r + edge`), `yaw` random, `scale = 0.7 + 0.6 × r²`; rows `[x, y, z, yaw, scale, kindIndex]` in one `Float32Array`. The worker posts `{ key, n, step, positions, normals, indices, heights, clutter }` with every buffer in the transfer list.

### The page side (`ground.js`)

- `rt.workers.define('flight-terrain', () => new Worker(new URL('./terrain.worker.js', import.meta.url), { type: 'module' }))`; the worker builds `planetField(spec)` once per spec id and answers `makeLeaf` jobs; a `cancel` message for its current key is honoured between leaves (one job a worker, so it is only ever the queue that is cancelled).
- Each frame: `leavesFor(ship.x, ship.z)` (cached until the ship crosses into another 256 m cell: one Map a second at most), `stream.update(leaves)`, cancel what fell out, ask the rest (`priority = leaf.d`: coarse first, the ship's own leaf last and therefore soonest when the queue is lowest-first… the streamer asks in breadth order, so the worker receives far ground first; `priority` is the depth so a nearer, finer leaf asked later still jumps the queue). Answers go into a `pending` list; at most `UPLOADS_PER_FRAME[tier]` become geometry a frame (`BufferGeometry` with the three attributes, `boundingSphere` set from the leaf's square and the heights' min and max, no `computeVertexNormals`). A refused `done` (gen moved, leaf dropped) is discarded with its buffers.
- The mesh is one `MeshStandardMaterial` per planet (flat colours from the look's palette by height and slope, `lib/three/groundmap.js`'s GLSL as the galaxy's ground does; `vertexColors` off), `frustumCulled` on, in a group positioned at `[x0, 0, z0] − origin.at`; on the `origin` event every group is moved by the shift.
- Clutter: `pool(geometry, material, CAP[kind], kind)` per kind (`rock`: a flattened icosahedron, `spire`: a tall cone, `debris`: a scattered box; all `painted`), a `Map<leafKey, slot[]>`; a leaf's rows take slots on load and free them on drop. `CAP = { rock: 4000, spire: 600, debris: 2000 }`, halved on low.
- Collision: `heightOn(leaf, heights, n, x, z)` on the finest loaded leaf under the ship; a crash is `ship.y < h + SHIP.clearance`.

### What is not here

- No spherical planet, no atmosphere scattering, no water (the ice world has none; a later ocean type reuses `galaxy/surface/water.js`).
- No physics engine: the ship is a kinematic body under `flightRules.js`; the ground is read, never collided by Rapier.
- No textures from disk: the look is `painted` (`look.js`), so the pack is the code alone (`WORLD_MB['/fly'] = 1`).

## Pillar 2: persistence and spatial queries

### Files

```
supabase/migrations/20261009000000_world_entities.sql    the schema, indexes, RLS, functions (below, verbatim)
supabase/seed.sql                                          the 50 planets (from planetSpec.js's PLANETS, scripts/supabase-seed.mjs writes it)
supabase/README.md                                         how to apply it, how the anon key reaches the build
src/lib/durable/supabase.js       client() → SupabaseClient | null (null: no VITE_SUPABASE_URL; the game plays without the durable layer)
src/lib/durable/entities.js       pure: cellOf, cellsAround, bboxOf, rowToEntity, entityToRow, diffCells, CELL = 2048
src/lib/durable/entityLoader.js   createEntityLoader(...) (below)
docs/stack/supabase.md            the stack page, before the import; PAGES in scripts/stack-census.mjs
.env.example                      VITE_SUPABASE_URL=, VITE_SUPABASE_ANON_KEY=
.github/workflows/deploy.yml      the two from repository secrets, into the build step's env
```

### The schema

```sql
-- 20261009000000_world_entities.sql
create extension if not exists postgis;
create extension if not exists btree_gist;

-- the planets a thing may be built on (50 at launch: supabase/seed.sql)
create table if not exists public.planets (
  id   text primary key check (id ~ '^[A-Za-z0-9:_,-]{1,64}$'),
  name text not null,
  type text not null,
  seed text not null
);

-- fixed places on a planet: nothing may be built inside one
create table if not exists public.pois (
  id        text primary key,
  planet_id text not null references public.planets(id) on delete cascade,
  name      text not null,
  x double precision not null,
  z double precision not null,
  r double precision not null check (r > 0),
  geom geometry(Point, 0) generated always as (ST_MakePoint(x, z)) stored
);
create index if not exists pois_planet_geom on public.pois using gist (planet_id, geom);

create table if not exists public.world_entities (
  id          uuid primary key default gen_random_uuid(),
  planet_id   text not null references public.planets(id) on delete cascade,
  entity_type text not null check (entity_type in ('structure', 'turret', 'beacon', 'wreck')),
  owner       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  x double precision not null check (abs(x) < 1e7),
  y double precision not null check (abs(y) < 1e5),
  z double precision not null check (abs(z) < 1e7),
  rot_x real not null default 0,
  rot_y real not null default 0,
  rot_z real not null default 0,
  scale real not null default 1 check (scale > 0 and scale <= 10),
  hp    integer not null default 100 check (hp >= 0 and hp <= 100000),
  metadata jsonb not null default '{}'::jsonb check (pg_column_size(metadata) <= 4096),
  geom geometry(Point, 0) generated always as (ST_MakePoint(x, z)) stored,
  version    integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- one index answers the envelope query: planet first (btree_gist), then the point
create index if not exists world_entities_planet_geom on public.world_entities using gist (planet_id, geom);
create index if not exists world_entities_planet_updated on public.world_entities (planet_id, updated_at);
create index if not exists world_entities_owner on public.world_entities (owner);

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); new.version := old.version + 1; return new; end $$;
create trigger world_entities_touch before update on public.world_entities for each row execute function public.touch_updated_at();

-- what a build may not do: stand inside a POI, or take an owner past their cap on a planet
create or replace function public.check_placement() returns trigger language plpgsql as $$
declare cap constant integer := 200;
begin
  if exists (select 1 from public.pois p where p.planet_id = new.planet_id and ST_DWithin(p.geom, ST_MakePoint(new.x, new.z), p.r)) then
    raise exception 'inside a point of interest' using errcode = 'check_violation';
  end if;
  if (select count(*) from public.world_entities e where e.owner = new.owner and e.planet_id = new.planet_id) >= cap then
    raise exception 'owner has % entities on this planet already', cap using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger world_entities_placement before insert on public.world_entities for each row execute function public.check_placement();

-- row-level security: the world is public to read; a row is its owner's to write
alter table public.planets enable row level security;
alter table public.pois enable row level security;
alter table public.world_entities enable row level security;
create policy planets_read on public.planets for select using (true);
create policy pois_read on public.pois for select using (true);
create policy entities_read on public.world_entities for select using (true);
create policy entities_insert on public.world_entities for insert to authenticated with check (owner = auth.uid());
create policy entities_update on public.world_entities for update to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
create policy entities_delete on public.world_entities for delete to authenticated using (owner = auth.uid());

-- the envelope query the client makes as its view moves (security invoker: RLS applies)
create or replace function public.get_entities_in_bounding_box(
  planet_id text, min_x double precision, max_x double precision, min_z double precision, max_z double precision,
  since timestamptz default null
) returns setof public.world_entities
language plpgsql stable security invoker set search_path = public as $$
begin
  if max_x - min_x > 8192 or max_z - min_z > 8192 or max_x < min_x or max_z < min_z then
    raise exception 'envelope too large or inverted' using errcode = 'check_violation';
  end if;
  return query
    select e.* from public.world_entities e
    where e.planet_id = get_entities_in_bounding_box.planet_id
      and e.geom && ST_MakeEnvelope(min_x, min_z, max_x, max_z, 0)
      and (since is null or e.updated_at > since)
    order by e.updated_at
    limit 2000;
end $$;
grant execute on function public.get_entities_in_bounding_box(text, double precision, double precision, double precision, double precision, timestamptz) to anon, authenticated;

-- damage from anyone (a turret's hp is not its owner's alone to change): clamped, rate-limited, logged
create table if not exists public.entity_hits (
  entity_id uuid not null references public.world_entities(id) on delete cascade,
  by uuid not null,
  at timestamptz not null default now()
);
create index if not exists entity_hits_by_at on public.entity_hits (by, at);
alter table public.entity_hits enable row level security; -- no policies: reached through the function below only

create or replace function public.damage_entity(entity_id uuid, amount integer) returns integer
language plpgsql volatile security definer set search_path = public as $$
declare caller uuid := auth.uid(); left_hp integer; dmg integer := least(greatest(amount, 1), 30);
begin
  if caller is null then raise exception 'sign in first' using errcode = 'insufficient_privilege'; end if;
  if (select count(*) from public.entity_hits h where h.by = caller and h.at > now() - interval '1 second') >= 10 then
    raise exception 'too many hits' using errcode = 'check_violation';
  end if;
  insert into public.entity_hits (entity_id, by) values (entity_id, caller);
  update public.world_entities e set hp = greatest(e.hp - dmg, 0) where e.id = entity_id returning e.hp into left_hp;
  if left_hp is null then return null; end if;
  if left_hp = 0 then delete from public.world_entities where id = entity_id; end if;
  return left_hp;
end $$;
grant execute on function public.damage_entity(uuid, integer) to authenticated;

-- realtime: the table's changes go out to subscribers (RLS filters what each sees)
alter publication supabase_realtime add table public.world_entities;
```

Notes the implementer keeps: a stored generated column is still NULL in a `BEFORE` trigger, so `check_placement` makes the point from `new.x, new.z` (repaired by `20261009000100_placement_reads_x_z.sql`); `ST_MakePoint` is immutable, so the generated column is allowed; `ST_DWithin` on SRID 0 is in the table's own units (metres); the composite GiST needs `btree_gist`; anonymous users sign in through `supabase.auth.signInAnonymously()` and are role `authenticated` (enable anonymous sign-ins in the project's Auth settings); `security invoker` on the RPC means the read policy applies; the rate limit in `damage_entity` is per caller, not per socket, which is the right side of the trust line for a public anon key.

### The loader (`entityLoader.js`)

```js
// The world's durable things round the ship, cell by cell: which cells the
// ship is in and about (entities.js's grid, CELL = 2048 m), asked for from
// Supabase as an envelope each (get_entities_in_bounding_box), remembered,
// refreshed with `since` after STALE_MS, and let go of past the radius; a
// change that arrives by realtime, or by a neighbour's `built` hint
// (refetch(cell)), is folded in the same way. Pure of three.js: the scene
// draws from on(fn)'s events. Without a client (supabase.js's null) it is
// a loader of nothing that still answers.
//
// createEntityLoader({ client, planetId, radius = 1, inFlight = 4, staleMs, now, realtime = true })
//   → { update(x, z), on(fn) → off, get(id), all(), place(entity) → Promise<entity | null>,
//       remove(id) → Promise<boolean>, damage(id, amount) → Promise<hp | null>, refetch(cellKey), dispose() }
// events: { type: 'add', entity }, { type: 'change', entity }, { type: 'remove', id }, { type: 'error', where, error }

import { CELL, bboxOf, cellOf, cellsAround, diffCells, entityToRow, rowToEntity } from './entities.js';

export const STALE_MS = 20000;

export function createEntityLoader({ client, planetId, radius = 1, inFlight = 4, staleMs = STALE_MS, now = Date.now, realtime = true }) {
  const cells = new Map(); // key → { entities: Map<id, entity>, fetchedAt, since }
  const flying = new Set();
  const listeners = new Set();
  let wanted = [];
  let gen = 0;
  let channel = null;
  const emit = (e) => listeners.forEach((fn) => fn(e));

  const fold = (row) => {
    const entity = rowToEntity(row);
    const key = cellOf(entity.x, entity.z).join(',');
    const cell = cells.get(key);
    if (!cell) return; // not a cell we hold: nothing to draw it in
    const had = cell.entities.get(entity.id);
    cell.entities.set(entity.id, entity);
    emit({ type: had ? 'change' : 'add', entity });
  };
  const forget = (id) => {
    for (const cell of cells.values()) if (cell.entities.delete(id)) { emit({ type: 'remove', id }); return; }
  };

  async function fetchCell(key, since = null) {
    if (!client || flying.has(key) || flying.size >= inFlight) return;
    const myGen = gen;
    flying.add(key);
    const [cx, cz] = key.split(',').map(Number);
    const { minX, maxX, minZ, maxZ } = bboxOf(cx, cz);
    const { data, error } = await client.rpc('get_entities_in_bounding_box', { planet_id: planetId, min_x: minX, max_x: maxX, min_z: minZ, max_z: maxZ, since });
    flying.delete(key);
    if (myGen !== gen || !wanted.includes(key)) return; // dropped meanwhile
    if (error) { emit({ type: 'error', where: 'fetch', error }); return; }
    const cell = cells.get(key) ?? { entities: new Map(), fetchedAt: 0, since: null };
    cells.set(key, cell);
    for (const row of data ?? []) fold(row);
    cell.fetchedAt = now();
    cell.since = data?.length ? data[data.length - 1].updated_at : cell.since;
  }

  function subscribe() {
    if (!client || !realtime || channel) return;
    channel = client.channel(`entities:${planetId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'world_entities', filter: `planet_id=eq.${planetId}` }, (payload) => {
      if (payload.eventType === 'DELETE') forget(payload.old.id);
      else fold(payload.new);
    });
    channel.subscribe();
  }

  return {
    update(x, z) {
      const [cx, cz] = cellOf(x, z);
      const next = cellsAround(cx, cz, radius);
      const { gone } = diffCells(wanted, next);
      wanted = next;
      for (const key of gone) {
        const cell = cells.get(key);
        if (!cell) continue;
        for (const id of cell.entities.keys()) emit({ type: 'remove', id });
        cells.delete(key);
      }
      for (const key of wanted) {
        const cell = cells.get(key);
        if (!cell) fetchCell(key);
        else if (now() - cell.fetchedAt > staleMs) fetchCell(key, cell.since);
      }
      subscribe();
    },
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    get(id) { for (const c of cells.values()) { const e = c.entities.get(id); if (e) return e; } return null; },
    all() { return [...cells.values()].flatMap((c) => [...c.entities.values()]); },
    refetch(key) { const cell = cells.get(key); if (cell) fetchCell(key, cell.since); },
    async place(entity) {
      if (!client) return null;
      const { data, error } = await client.from('world_entities').insert(entityToRow({ ...entity, planetId })).select().single();
      if (error) { emit({ type: 'error', where: 'place', error }); return null; }
      fold(data);
      return rowToEntity(data);
    },
    async remove(id) {
      if (!client) return false;
      const { error } = await client.from('world_entities').delete().eq('id', id);
      if (error) { emit({ type: 'error', where: 'remove', error }); return false; }
      forget(id);
      return true;
    },
    async damage(id, amount) {
      if (!client) return null;
      const { data, error } = await client.rpc('damage_entity', { entity_id: id, amount });
      if (error) { emit({ type: 'error', where: 'damage', error }); return null; }
      if (data === 0) forget(id);
      return data;
    },
    dispose() { gen++; channel?.unsubscribe(); channel = null; cells.clear(); listeners.clear(); wanted = []; },
  };
}
```

`entities.js` (pure): `CELL = 2048`; `cellOf(x, z) → [cx, cz]` (floor); `cellsAround(cx, cz, r) → 'cx,cz'[]` nearest first; `bboxOf(cx, cz) → { minX, maxX, minZ, maxZ }`; `diffCells(prev, next) → { gone, came }`; `rowToEntity(row) → { id, planetId, type, owner, x, y, z, rot: [rx, ry, rz], scale, hp, metadata, version, updatedAt }`; `entityToRow(entity)` the inverse (`planet_id`, `entity_type`, `rot_x` and so on; never `owner`, `id`, `version`: the database sets them). A test proves `rowToEntity(entityToRow(e))` round-trips what the client may set.

## Pillar 3: the hybrid network

### The split

| Volatile (Nostr, ephemeral kind 22742, room `fly-v1:<planetId>`) | Durable (Supabase) |
|---|---|
| `hi` who you are, your ship | a structure or turret placed, moved, removed |
| `pose [x, y, z, pitch, yaw, roll, speed, flags]` ten times a second | its `hp`, through `damage_entity` |
| `shot [x, y, z, vx, vy, vz]` | the planet and POI tables |
| `hit { d }` to the pilot a bolt hit (the universe's `GUARD` rules apply, `protocol.js`'s `aimedAt`) | |
| `built { id, cell }` a hint: I placed `id` in `cell`; refetch it now | |
| `gone { id }` the same for a removal | |

A `built` is never believed as the entity: it names a cell to refetch, and the database (under RLS) is what answers. A turret's shots are volatile and local: every client runs its turrets' aim against the ships it sees; a hit on *your* ship is yours to apply (as `hit` is today), a hit on a turret goes to `damage_entity`.

### Spatial channels

`src/lib/net/cells.js` (pure): `NET_CELL = 2048` (the same grid as `entities.js`'s `CELL`; one constant, the durable module imports it from here); `netCellOf(x, z)`, `netCellsAround(cx, cz, r = 1) → keys`, `cellTag(planetId, key) → '<planetId>/<cx>,<cz>'`, `sameCells(a, b)`.

`pool.js` grows `refresh()` on a subscription: the REQ is sent again under the same id on every open socket (NIP-01: a REQ with an id already open replaces that filter). `nostr.js`'s `joinRoom` takes `cells: () => string[] | null` and, when given, adds `'#g': cells()` to the filter; the room gains `setCell(tag)` (what your own events carry, `['g', tag]`) and `setCells(tags)` (what you listen for; calls `refresh()` when the set changed). A targeted send (`send(data, { target })`) carries the target's last-known cell tag too, taken from their last pose, so it passes their filter. Everything else about the room (bundling, the visit tag, the checks) is unchanged, and a room joined without `cells` behaves exactly as before (`nostr.test.js`'s existing cases hold).

The flight world's wire is its own small `flightProtocol.js` (pure, tested; `createLimiter` from `protocol.js` for the rates: `pose [20, 30]`, `shot [10, 12]`, `hit [10, 12]`, `built [1, 3]`, `gone [1, 3]`, `hi [1, 4]`), read and cleaned as the universe's is: numbers finite and clamped, a pose further than `NET_CELL × 2` from the sender's tag dropped (a tag lie).

## Lanes

| Lane | Plan | Branch | Starts from | Depends on |
|---|---|---|---|---|
| A: flight terrain | `plans/2026-10-09-flight-terrain.md` | `claude/flight-terrain` | main | nothing |
| B: durable world | `plans/2026-10-09-durable-world.md` | `claude/durable-world` | main | nothing (a Supabase project the owner makes; the code is tested against a fake client) |
| C: spatial channels | `plans/2026-10-09-spatial-channels.md` | `claude/spatial-channels` | main | nothing |
| D: shared world | `plans/2026-10-09-shared-world-integration.md` | `claude/shared-world` | main after A, B, C | A, B, C |

A, B and C touch disjoint files (A: `src/lib/land/`, `src/components/expanse/flight/`, `src/pages/Fly.jsx`, a line each in `App.jsx`, `worlds.js`, `looks.js`; B: `supabase/`, `src/lib/durable/`, `docs/stack/`, `scripts/stack-census.mjs`, `package.json`, `deploy.yml`; C: `src/lib/net/`, `src/components/universe/online/pool.js` and `nostr.js` and their tests). B and A both add a package: whoever merges second re-runs `npm install` on main and `node scripts/stack-census.mjs --write`.

## Testing

- Pure modules in Node with Vitest, beside their files, under a second each (`docs/health/RULES.md`). The worker's function (`makeLeaf`) is tested as a function; the worker file itself is a dozen lines and is exercised by the smoke check.
- `flats.test.js` keeps `terrain.test.js`'s levelled cases; the galaxy surface's screenshot before and after the move is compared (`scripts/autopilot-check.mjs --before`, then after: no pixel changes).
- `node scripts/perf-probe.mjs --routes /fly/hoth` on mid: the worst frame under 33 ms with the ship at 300 m/s over a biome boundary and Echo Base (the number goes in the PR).
- The database: `supabase/README.md`'s check runs the migration on a fresh local project (`supabase start`, `supabase db reset`), then a script `scripts/supabase-check.mjs` inserts three entities as an anonymous user, asks the envelope, is refused inside a POI, damages one to zero and sees it gone. It needs a project and runs by hand; CI tests the client against a fake.
- The channels: `scripts/online-check.mjs` grows a `--fly` case: two browsers on `/fly/hoth`, one in cell `0,0`, one in `5,5`; the second sees no pose until the first flies within a cell of it.

## Open assumptions, marked

- `NET_CELL = 2048` and a radius of 1 (a 6 km square heard and asked for) suit a ship at 300 m/s with poses at 10 Hz; lane D measures how many poses a client takes on a busy planet and may widen the radius to 2 for the fastest ships.
- Supabase's free tier (500 MB, 2 GB egress, 200 concurrent realtime peers) is enough for the launch; the decision entry says what reopens it.
- The 50 planets are every world the site has that is a planet, each with its ground from the fiction (`docs/research/2026-10-09-planet-geographies.md`): the galaxy's 17 landable systems, the Rick and Morty sector's 10 moons, the universe map's 10 fandom planets, and 13 Expanse planets by id; listed in `planetSpec.js`'s `PLANETS` and written to `supabase/seed.sql` (with each world's POIs into `pois`) by `scripts/supabase-seed.mjs`; a planet not in the table cannot be built on (the foreign key), which is the point.
- Three field options the roster needs, added to `planetField` and `layers.js` by lane A: `step` (heights snapped to a grid of that many metres: the pixel world), a `blocks` layer (`{ type: 'blocks', cell, gap, hMin, hMax, cover }`: flat-topped towers on a grid, seeded per cell, for the city worlds), and `soft: true` (a cloud deck: the ground is fog, never a crash).

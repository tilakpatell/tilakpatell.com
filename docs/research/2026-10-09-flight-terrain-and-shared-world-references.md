# Flight terrain and shared world state: the references, and what each gives us

Date: 2026-10-09. Written by the architecting session for `docs/superpowers/specs/2026-10-09-planet-flight-and-shared-world-design.md`. The owner pointed at these repositories; the session read none of their code into this one (a licence is checked before any line is borrowed, and the design below takes techniques, not files).

## Terrain and planets

| Repository | What the owner noted | What the design takes |
|---|---|---|
| `ZyFou/ProceduralTerrains` | A three.js landscape engine: infinite chunk streaming, a planet mode, volumetric clouds, biome shaders, GLB export. | The shape of a chunk streamer round a moving camera; nothing else (the site has its own in `src/runtime/chunkGrid.js` and `src/components/minecraft/stream.js`). |
| `dgreenheck/threejs-procedural-planets` | Spherical surfaces from several noises, atmospheric scatter, roughness. | Left for a later spherical pass; this design flies over a flat, infinite plane per planet (see the spec, “What this is not”). |
| `prolearner/procedural-planet` | Quadtree chunked level of detail, on the CPU and the GPU, from orbit down to surface flight. | The quadtree of leaves split by distance (the spec's `quadtree.js`): one tree, a leaf a mesh, a skirt down each edge, so a ship at 300 m/s sees 10 km of ground for a few hundred draws. |
| `Auburn/FastNoiseLite` | A fast, portable noise library with a JavaScript build: Simplex, Cellular, Perlin, fractal types, domain warp. | The dependency `fastnoise-lite@1.1.1` (MIT, ESM, `export default class FastNoiseLite`; `SetNoiseType`, `SetFractalType`, `SetFractalOctaves`, `SetDomainWarpType`, `GetNoise(x, y)`, `DomainWrap`), wrapped once in `src/lib/land/flight/fnl.js` and run in the terrain worker. Its stack page is written before it is imported (`docs/health/RULES.md`, “A dependency has a page”). |

## Spatial state

| Repository | What the owner noted | What the design takes |
|---|---|---|
| `supabase/supabase-js` | The client for Supabase from a static site. | The dependency `@supabase/supabase-js@^2.117.3` (MIT), behind `src/lib/durable/supabase.js` only, with the anon key from the build's environment and never in the repository. |
| `bdon/supabase-vector-tile` | PostGIS bounding-box queries (`ST_MakeEnvelope`) streamed to a three.js / MapLibre client. | The query shape: an envelope against a GiST index, one RPC, the client asking per cell as the camera moves (`get_entities_in_bounding_box`). |

## What the site already had, which these confirm

- A pure chunk grid with in-flight caps, hysteresis and generations (`src/runtime/chunkGrid.js`), a worker pool with cancel and transferables (`src/runtime/workers.js`), a floating origin in whole cells (`src/runtime/origin.js`).
- Land as data in a worker (`src/lib/land/cell.js`: 64 m cells, heights, mesh with skirts, props as a placement list), summed from shared layers (`src/lib/land/layers.js`).
- Flats eased into the land round a site (`src/components/galaxy/surface/terrain.js`'s `levelled`), which is the owner's “zero-noise transition plane for fixed POIs”, already written and tested; the design moves it down to `src/lib/land/flats.js` so a world and the flight share it.
- Instanced pools with free slots (`src/lib/three/pool.js`), instanced LOD bands (`src/lib/three/lod.js`), and the GPU work budget (`src/lib/three/gpuWork.js`).
- Nostr rooms over shared sockets (`src/components/universe/online/pool.js`, `nostr.js`), with the filter given afresh each time it is sent, which is the seam a spatial filter goes through.

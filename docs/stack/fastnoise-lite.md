# FastNoise Lite

**Version** `fastnoise-lite@1.1.1` (pinned, no caret) · **Page owner** `src/lib/land/flight/` · **Decision** none recorded; the reasons are in `docs/superpowers/specs/2026-10-09-planet-flight-and-shared-world-design.md` (decision 3)

## What it is, and why it is here

A single-file noise library (OpenSimplex2, cellular, Perlin, value; fBm, ridged and ping-pong fractals) ported to JavaScript by its author, MIT. The flight's planets (`/fly/:planet`) sample it in a worker for ground a ship crosses at 300 m/s; without it the flight would lean on the galaxy's value noise, whose square cells show from the air and which has no cellular or ping-pong kinds for the stylised planets.

## Where it is used

The census row is in [README.md](README.md): one file imports it, `src/lib/land/flight/fnl.js`, and the rest of the flight reaches it through that file's `noiseFor`:

- `biomes.js` beside it: the two climate fields the biome weights come from.
- `field.js` beside it: a planet's height.
- `characters.js` beside it: a generated planet's land by its character, 3D noise of a direction on its sphere (`noise3For`, `cells3For`).
- `sphereField.js` beside it: a generated planet's climate, hills and detail on its sphere.

## How the site uses it

- **One function a use.** `noiseFor(seed, opts)` builds a configured instance and returns `(x, z) → −1…1`; nothing else names the class.
- **Seeds are 32-bit.** `fold(seed)` folds a planet's bigint (the Expanse's `seed.js`) to an int32: its low 32 bits xor its high 32.
- **The warp is the wrapper's own**: two more noises at half the frequency push `(x, z)` by up to `warp` metres (below, Gotchas).
- **3D noise for round planets.** `noise3For(seed, opts)` takes `noiseFor`'s options and returns `(x, y, z) → −1…1`; `cells3For(seed, { frequency, jitter })` is the cellular distance (Euclidean, from 0 up). A generated planet's ground is a function of a direction on its sphere, so it has no seam and wraps (`docs/superpowers/specs/2026-10-18-endless-universe-design.md`, section E); the 50 roster planets keep their 2D plane.

## What the site does not use, and why

- **`DomainWrap`** and the domain-warp fractal types: see Gotchas.
- **The galaxy's surfaces and the planets' land** keep `src/components/galaxy/surface/noise.js`'s value noise; moving them would change their pixels.

## Rules

- Only `src/lib/land/flight/fnl.js` imports the package; nothing enforces it but review and this page.
- The wrapper is pure and tested beside itself (`src/lib/land/flight/fnl.js`'s test: same seed, same value; values in `[−1, 1]`; the warp moves the value).

## Upgrading

`npm install fastnoise-lite@<v> --save-exact`, then `npx vitest run src/lib/land/flight` and a flight on `/fly/hoth`. Last upgrade: not recorded; record the next one here.

## Gotchas

- In 1.1.1, `DomainWrap(coord)` warps only when `coord` is an instance of the package's `Vector2` class, which it does not export; a plain `{ x, y }` comes back unchanged with no error (found while writing `src/lib/land/flight/fnl.js`; its test “warps the domain” would fail with the class's warp).
- `GetNoise(x, y)` scales by the frequency itself; pass metres, not metres times the frequency.
- The 3D warp is three noises, as the 2D one is two: the wrapper's, not `DomainWrap`, for the reason above. Pass a direction times the radius in metres when the frequency is per metre, the bare unit direction when it is per planet.

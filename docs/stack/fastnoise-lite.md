# FastNoise Lite

**Version** `fastnoise-lite@1.1.1` (pinned, no caret) · **Page owner** `src/lib/land/flight/` · **Decision** none recorded; the reasons are in `docs/superpowers/specs/2026-10-09-planet-flight-and-shared-world-design.md` (decision 3)

## What it is, and why it is here

A single-file noise library (OpenSimplex2, cellular, Perlin, value; fBm, ridged and ping-pong fractals) ported to JavaScript by its author, MIT. The flight's planets (`/fly/:planet`) sample it in a worker for ground a ship crosses at 300 m/s; without it the flight would lean on the galaxy's value noise, whose square cells show from the air and which has no cellular or ping-pong kinds for the stylised planets.

## Where it is used

The census row is in [README.md](README.md): one file imports it, `src/lib/land/flight/fnl.js`, and the rest of the flight reaches it through that file's `noiseFor`, `noise3For` and `cells3For`:

- `biomes.js` beside it: the two climate fields the biome weights come from.
- `field.js` beside it: a planet's height.
- `characters.js` beside it: a generated planet's terrain character (continents, craters and the rest), in 3D, of the direction on its sphere.

## How the site uses it

- **One function a use.** `noiseFor(seed, opts)` builds a configured instance and returns `(x, z) → −1…1`; nothing else names the class.
- **Seeds are 32-bit.** `fold(seed)` folds a planet's bigint (the Expanse's `seed.js`) to an int32: its low 32 bits xor its high 32.
- **The warp is the wrapper's own**: two more noises at half the frequency push `(x, z)` by up to `warp` metres (below, Gotchas).
- **3D for the round planets.** A generated planet's ground is a field of the direction on its sphere, so it has no seam and wraps (`docs/superpowers/specs/2026-10-18-endless-universe-design.md`, section E). `noise3For(seed, opts)` is `noiseFor`'s twin of `(x, y, z)`, its simplex the smooth kind (OpenSimplex2S, the type `'smooth'`) unless asked, and `cells3For(seed, { frequency, jitter })` is the Cellular distance to the nearest point, in cells, read from 0 up. The fifty roster planets stay planes and keep `noiseFor`.

## What the site does not use, and why

- **`DomainWrap`** and the domain-warp fractal types: see Gotchas.
- **The galaxy's surfaces and the planets' land** keep `src/components/galaxy/surface/noise.js`'s value noise; moving them would change their pixels.

## Rules

- Only `src/lib/land/flight/fnl.js` imports the package; nothing enforces it but review and this page.
- The wrapper is pure and tested beside itself (`src/lib/land/flight/fnl.js`'s test: same seed, same value; values in `[−1, 1]`; the warp moves the value; in 2D and 3D).

## Upgrading

`npm install fastnoise-lite@<v> --save-exact`, then `npx vitest run src/lib/land/flight` and a flight on `/fly/hoth`. Last upgrade: not recorded; record the next one here.

## Gotchas

- In 1.1.1, `DomainWrap(coord)` warps only when `coord` is an instance of the package's `Vector2` class, which it does not export; a plain `{ x, y }` comes back unchanged with no error (found while writing `src/lib/land/flight/fnl.js`; its test “warps the domain” would fail with the class's warp).
- `GetNoise(x, y)` scales by the frequency itself; pass metres, not metres times the frequency.
- The 3D warp is three noises, one an axis, as the 2D one is two: `noise3For` doesn't reuse the 2D pair, or one axis would go unwarped.
- The fast OpenSimplex2 in 3D is not quite continuous. It reads four corners of its lattice, and where two are equally near (on the planes `y = z`, `x = y`, `x = z` and their like) it takes one by a comparison, so the value steps by up to 0.006 across those planes: a metre or more on a ridge, and `y = z` is a great circle through every planet's poles. OpenSimplex2S reads more corners and has no steps, at no extra cost here, so `noise3For` defaults to it (found by `sphereField.js`'s seam test, 2.2 m at the equator where the map wraps; `fnl.js`'s test holds it). The 2D fast one has no such ties, and the roster planets keep it.
- Both 3D OpenSimplex2s read exactly 0 at points of their lattice, and the diagonal `x = y = z` passes through them wherever the frequency times x is a whole or half number. At `(100, 100, 100)` with frequency 0.01 the noise and its warp (at half the frequency) are both 0, so the warped value and the unwarped one are equal there; a test that compares two values picks a point off the diagonal.
- Cellular's `Distance` return is the distance less 1, and the class's default distance is the squared one. `cells3For` asks for the Euclidean and adds the 1 back, so a crater's bowl reads in cells and never changes faster than the step.

# FastNoise Lite

**Version** `fastnoise-lite@1.1.1` (pinned, no caret) · **Page owner** `src/lib/land/flight/` · **Decision** none recorded; the reasons are in `docs/superpowers/specs/2026-10-09-planet-flight-and-shared-world-design.md` (decision 3)

## What it is, and why it is here

A single-file noise library (OpenSimplex2, cellular, Perlin, value; fBm, ridged and ping-pong fractals) ported to JavaScript by its author, MIT. The flight's planets (`/fly/:planet`) sample it in a worker for ground a ship crosses at 300 m/s; without it the flight would lean on the galaxy's value noise, whose square cells show from the air and which has no cellular or ping-pong kinds for the stylised planets.

## Where it is used

The census row is in [README.md](README.md): one file imports it, `src/lib/land/flight/fnl.js`, and the rest of the flight reaches it through that file's `noiseFor`, `noise3For` and `cells3For`:

- `biomes.js` beside it: the two climate fields the biome weights come from.
- `field.js` beside it: a planet's height.
- `characters.js` beside it: the eight terrain characters a generated planet's round ground is made from, in 3D noise of a direction on its sphere.
- `sphereField.js` beside it: a generated planet's whole ground, built on `characters.js`.

## How the site uses it

- **One function a use.** `noiseFor(seed, opts)` builds a configured instance and returns `(x, z) → −1…1`; nothing else names the class.
- **Seeds are 32-bit.** `fold(seed)` folds a planet's bigint (the Expanse's `seed.js`) to an int32: its low 32 bits xor its high 32.
- **The warp is the wrapper's own**: two more noises at half the frequency push `(x, z)` by up to `warp` metres (below, Gotchas).
- **3D for the round planets.** A roster planet is a plane and keeps its 2D ground; a generated planet's ground is a function of a point on its sphere, so `noise3For(seed, opts)` takes `noiseFor`'s options and returns `(x, y, z) → −1…1`, and `cells3For(seed, { frequency, jitter })` returns the Euclidean distance to the nearest cell point, from 0 up (the craters).

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
- `GetNoise` picks 2D or 3D by how many arguments it is given, so a 3D call passes all three even when one is 0. The 3D warp is three noises, one an axis, as the 2D warp is two (`noise3For` in `src/lib/land/flight/fnl.js`).
- In 1.1.1, 3D OpenSimplex2 is not continuous. Where two lattice points are both in reach it adds only one, so the value steps where the pick flips, and its default transform makes every octave flip at once on six planes through the origin: a generated planet's ground stepped up to 13 m along six great circles. So `noise3For`'s `'simplex'` is OpenSimplex2S (continuous, about as fast here), while `noiseFor`'s 2D keeps OpenSimplex2, which the roster planets are drawn with (`src/lib/land/flight/fnl.js`; its test “is continuous across the planes where 3D OpenSimplex2 stepped”).
- OpenSimplex2 reads exactly 0 on its lattice points. At frequency 0.01, (100, 100, 100) is one for the noise and for the warp's half-frequency noises too, so warped and unwarped both read 0 there; `fnl.test.js`'s “warps in 3D” samples (100, 37, −80).

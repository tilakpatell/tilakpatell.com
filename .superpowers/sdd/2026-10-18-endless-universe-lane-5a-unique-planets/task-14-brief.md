### Task 14: Verification and pictures

**Files:** none new.

- [ ] **Step 1: Take the before shots on `main`.** Do this from a worktree of `main`, before this branch’s changes: the owner’s rule is that a changed picture is on purpose.
  - Run `node scripts/autopilot-check.mjs --only smoke --routes /fly/hoth,/fly/<id>`. `<id>` is the first rocky planet of sector (3, −2), which Task 13’s `index.json` names once the script has run there; or print it with `planets.test.js:37`’s line.
  - Also run `FLY=hoth node scripts/perf-probe.mjs fly` and keep its draws and triangles.

- [ ] **Step 2: Run the repo’s gates on the branch**

Run: `npm run lint && npm test && npm run build && node scripts/health.mjs --check --skip build && node scripts/flight-island.mjs --check`
Expected: every gate passes. In `npm test`, `the roster`, `TERRAIN_VERSION`, `planets.test.js` and `stack.test.js` are green.

- [ ] **Step 3: Take the after shots and compare**
  - Run the same smoke and probe.
  - `/fly/hoth` must be pixel for pixel the same, with the same draws and triangles.
  - `/fly/<id>` changes on purpose. It should show round-planet ground, its own colours, and a POI where one is in view.
  - Put both pairs in the pull request, with the numbers.

- [ ] **Step 4: Open the pull request.** It’s lane 5a’s one pull request, with a merge commit. The description lists the interfaces lane 5b consumes (below) and the findings for the owner.

## For lane 5b: what this lane hands over

- **Planet spec fields.**
  - Every spec has `kind`, `parent`, `buildable`, `round`, `character`, `sky`, `weather`, `flora`, `fauna` and `exotic`, beside today’s 17.
  - `round` is `{ radius, at }` on landable generated planets and moons, and null on the 50 and on gas giants.
  - `sky` is `{ low, high, haze, clouds, cloudColour, rings, moons }`: the orbit shader’s atmosphere and clouds.
  - `weather` is `{ kind, amount }`. `flora` is `{ family (lib/land/flora.js’s floraFor key), density, pick }`. `fauna` is `{ density, plans }`.
- **Landing at a spot.** `chartedAt(planetSpecOf(id), dirOfLatLon(lat, lon))` (`generated.js`, `sphere.js`) gives the spec whose chart origin, `(0, 0)` in the flight, is the spot dived at.
- **Charts and directions.**
  - `chartOf(at, radius).toDir(x, z)` and `.toChart(dir)` move between the flight and the sphere, for take-off back to orbit.
  - `latLonOfDir`, `dirOfLatLon`, `uvOfDir` and `dirOfUv` share `landings/biomes.js`’s layout.
- **The ground.** `sphereField(spec)` gives `heightAt(dir)`, `biomeAt(dir)` and `sample(dir) → { h, slope, biome }`. `planetField(spec)` is unchanged in shape, and the terrain worker keys fields by `fieldKey(spec)`.
- **The orbit map.**
  - `bakeOrbitMap(spec, { width, height }) → { width, height, rgba (sRGB, alpha 0 under water), biome }`.
  - `createOrbitMaps({ workers: rt.workers }).get(spec, tier)` makes it in a worker and caches it in memory. `orbitMapSize(tier)` gives the size.
  - The texture is sRGB, laid as three’s `SphereGeometry` lays it.
- **The read-only flag.** `spec.buildable === false` turns the shared world read-only (`shared.js`).
- **Islands.** The universe importing `lib/land/flight/*` counts as an island reference: lane 5b marks those rows `// planet flight` and lists the files in `ISLAND.rows`.

## Spec coverage

| Spec (section E, done item 6) | Task |
|---|---|
| One description, `planetSpecOf` | 5, 8 |
| Palette within the family, with a guaranteed hue and lightness distance from siblings | 6 (slots, the 500-planet test), 8 |
| Terrain character, water level, mountain height | 3, 6, 8 |
| Sky, haze, clouds, rings and moons in the sky | 6, 8 |
| Weather | 6, 8 |
| Flora: density, form family, colours | 6, 8, 9 |
| Fauna: density, body plans | 6, 9 |
| Points of interest (never on the seeded 13) | 6, 8, 9 |
| About 1 in 20 exotic | 6, 8, 9 |
| `TERRAIN_VERSION` by its rule (it stays 2) | 1, every task’s run of the lock |
| Ground as a field on the sphere, 3D noise, no seam, wraps | 3, 4 |
| The flight’s plane as an exponential-map chart | 2, 7 |
| Ground radius 15–60 km; climate against the circumference | 4, 8 |
| The 50 roster planets unchanged | 1 (the lock), 5 |
| Building on the 50 only, nothing written, no migration | 5, 12 |
| Moons: type and seed (lane 2), spec and ids | 5, 6, 8 |
| Orbit map: 256 × 128 / 512 × 256, a worker, never stored, cached | 10, 11 |
| The seeded 13’s map from a window of their plane | 10 |
| Contact sheet of 24 | 13 |

**Findings for the coordinator and the owner** (the work goes on as written):

1. **Biomes show from orbit through height only.** The flight’s ground shader (`lib/three/groundLook.js`, shared with the galaxy) colours by height and slope, not by biome.
   - So orbit-matches-ground holds by one shared colour rule (`groundColour`).
   - Biomes show from orbit only through their heights, roughness, water and rock.
   - A biome tint on the ground would need that shared shader, which is outside this lane.
2. **The chart has one singular point.** At πR from the landing spot (47–188 km away), the antipode, the ground is continuous and finite but stretched sideways the further out one flies. That’s inherent to the spec’s chart; re-centring the chart in flight would be lane 5b’s.
3. **Some described fields have no drawing lane.** Weather, cloud cover in the flight’s sky and flora colours are in the spec, but no lane in the table draws them in the flight; lane 5b draws the orbit shader and the walker.
4. **Gas giants’ orbit maps are banded, the seeded two included.** A window of a cloud deck’s plane is one flat colour; gas giants never land, so there’s no ground to match.
5. **Two seeded siblings look alike.** `e:1,0:0:3` and `e:1,0:0:5` are both ice in one system, so they keep one template palette (the roster rule beats uniqueness). Generated planets keep clear of the seeded ones.
6. **The moon and 3D-sector seam.** Moons resolve in the app once lane 2’s moon rows meet `moonRowOf`’s `moonList` name. Sectors off the middle layer resolve once lane 2’s 3D `makeSector` lands. Both are one-line joins.
7. **Systems with more than 8 planets.** The sibling guarantee holds up to 8 planets a system (7 today). If lane 2 appends more planets to a system, each family’s slot list grows first.

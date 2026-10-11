# Tatooine on the game's level

Lane E1 (`docs/superpowers/plans/2026-10-10-bf2017-every-asset-laneE1-tatooine-yavin.md`). Shots by `lab/tmp/shot.mjs` (the scene's `teleport` and `view` QA hooks) in software GL (SwiftShader), 1280 × 720, on high; the clock held and the random numbers seeded.

| shot | what |
|---|---|
| `landing.jpg` | the landing, facing Mos Eisley: the game's town south-east of it, the patrol and the stalls' people in the open |
| `mos-eisley-street.jpg` | the street south of the cantina (300, −258), looking north: the game's domes, towers and antennae |
| `cantina-alley.jpg` | the alley east of the cantina (316, −210), where the site's cantina door now stands |
| `jabba-palace.jpg` | the `jabba` district from above and outside: the B'omarr drum on its rise, the rocks round it |

Three of Tatooine_01's textures are missing from the bucket: a few pieces near the landing draw white. One rooftop antenna stands in the air once its house is culled for distance.

The budget, `BUDGET=1 QUALITY=<tier> node scripts/galaxy-check.mjs surface tatooine,tatooine@jabba,tatooine@jabba-inside` (`galaxy-check.txt`); `main` before this lane in the second column, from the same run on the same machine:

| world | tier | calls | triangles | models MB | row | `main` |
|---|---|---|---|---|---|---|
| tatooine | low | 184 | 678k | 33.0 | models over (20) | models 34.1 over |
| tatooine | mid | 183 | 649k | 36.5 | calls over the old baseline (84; the row is 500) | calls 99 over the same 84 |
| tatooine | high | 183 | 835k | 76.8 | calls (84) and models (60) over | calls 99, models 71.1 over |
| tatooine | ultra | 172 | 1.75M | 162.6 | pass (1,500, none, 240) | |
| the palace | low · mid · high · ultra | 39 | 285k · 285k · 462k · 1.33M | 10.8 · 11.6 · 27.2 · 60.6 | pass | (new) |
| the pit | low · mid · high · ultra | 42 · 38 · 41 · 38 | 255k · 254k · 435k · 1.30M | 9.6 · 9.8 · 24.1 · 57.4 | pass | (new) |

Tatooine's models row was over on `main` before any level (the cast: Luke 12.6 MB and Boba Fett 7.2 MB on high, with their cuts; the zones' people fetched up front). The level's own meshes are 1.1 MB of low's 33; its E-Web and Mark II placements (`vehicles.json`, the game's Galactic Assault layer) 1.4 MB on low and 5.5 MB on high. The calls rows are held to a baseline measured before Tatooine had a level (76 calls); its new baseline is refreshed in `lab/baseline/` with this lane.

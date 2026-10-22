# Hogwarts: the evidence

The numbers and the pictures the Hogwarts lanes keep (the design’s §2 and §4.14: `docs/superpowers/specs/2026-10-21-hogwarts-world-design.md`). Data and text only; a picture over 1 MB goes to the bucket through `scripts/assets-publish.mjs` and is linked from here.

## Lane C, task 1: the grounds and the castle outside

Measured on 2026-10-21 on the owner’s desktop (the node renderer on WebGPU, its graphics chip), headless Chromium at 1440 × 900, `/hogwarts?at=dusk` (the world’s 19:54 on the first night of the term: the windows coming on, the sky still lit), after the world had drawn for six seconds at each pose. `renderer.info`: the last frame’s draws and triangles (the lake’s mirror on high is its own render, before the frame’s, and isn’t in them), and the geometries and textures the renderer holds. The poses are the design’s six, as far as the grounds reach before the rooms land: the castle across the lake from a boat, the lawn below the east front, the great doors, the courtyard door to the Grand Staircase, the pitch, the station.

| pose | where | high: draws | high: triangles | high: geometries / textures | low: draws | low: triangles | low: geometries / textures |
| --- | --- | ---: | ---: | --- | ---: | ---: | --- |
| a boat on the lake | 300 m south of the castle, 2.2 m over the water | 84 | 550,716 | 45 / 59 | 24 | 65,141 | 16 / 21 |
| the lawn | below the east front, looking up at it | 104 | 687,495 | 47 / 63 | 27 | 68,217 | 17 / 21 |
| the Great Hall’s door | the great doors from the steps | 98 | 603,070 | 50 / 63 | 27 | 73,231 | 17 / 21 |
| the Grand Staircase’s door | the courtyard door, from the courtyard | 99 | 659,407 | 47 / 63 | 27 | 67,843 | 17 / 21 |
| the pitch | the south end, looking up its length | 56 | 538,869 | 51 / 61 | 27 | 85,806 | 20 / 27 |
| the station | the platform, the lake’s arm beyond | 60 | 885,434 | 53 / 65 | 24 | 83,923 | 18 / 21 |
| **the most** | | **104** | **885,434** | | **27** | **85,806** | |
| the design’s ceiling (§2) | | 400 | 1,400,000 | | 220 | 450,000 | |

What the tiers draw (`world/hooks.js`’s `TIERS`, the design’s §4.14): low draws no shadows, no blades, no scans on the ground and the far castle always (one draw, its windows baked into it); mid casts the sun’s shadow to 40 m, grows the blades and draws the near castle within 150 m; high casts to 60 m, mirrors the castle in the lake (a half-size picture of the castle, the hills and the ground, its own draws) and keeps the ink line for the cast; ultra draws the near castle to 420 m and adds ambient occlusion.

The grounds build in about a second before the first frame (the land baked into 4 m grids, about 200 ms; the ground’s maps, 300 to 500; the castle near and far, 60 to 200; on a machine running three other lanes’ builds the same work took two and a half seconds), each step handing the browser its turn.

The pictures (960 × 600, WebP, here):

- `c1-dusk.webp`: the castle across the lake from a boat at dusk, the windows coming on and the lake giving them back
- `c1-shore.webp`: from the south shore at noon, the whole of it on its crag and in the water
- `c1-noon.webp`: the cliff and the Great Hall at noon
- `c1-night.webp`: from a boat at midnight, the moon up

What is left for the grounds’ second task (`world/grounds/`): the Whomping Willow, Hagrid’s hut, the greenhouses’ insides, the pitch’s hoops and stands, the forest’s edge, the covered bridge’s sway, the station.

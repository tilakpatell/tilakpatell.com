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

What is left for the grounds’ second task (`world/grounds/`): the Whomping Willow, Hagrid’s hut, the greenhouses’ insides, the pitch’s hoops and stands, the forest’s edge, the covered bridge’s sway, the station. (Done in task 2, below.)

## Lane C, task 2: the landmarks

Measured on 2026-10-21 the same way (the desktop’s graphics chip on WebGPU, 1440 × 900, the world’s dusk), with the landmarks built and every lane on `main` in the world with them (Lane D’s rooms and arrival, Lane E’s wand, broom and match, Lane F’s Map, term and notice board), so the counts are the whole world’s, not the grounds’ alone. The poses are fixed now, so a later lane can measure the same ones: each a camera through the development hook’s `view(at, look)` (heights over the ground where it stands):

| pose | the camera (x, z; eye over the ground) → where it looks | high: draws | high: triangles | high: memory (textures / geometry) | low: draws | low: triangles | low: memory |
| --- | --- | ---: | ---: | --- | ---: | ---: | --- |
| a boat on the lake | (10, 250) 2.2 m over the water → the castle, (−10, 70, −40) | 175 | 674,364 | 342 / 24 MB | 111 | 147,381 | 35 / 5 MB |
| the lawn | (196, −14), 1.7 m → the castle’s east front | 220 | 858,727 | 368 / 46 MB | 94 | 137,825 | 35 / 6 MB |
| the Great Hall’s door | (72, −8), 1.7 m → the great doors | 130 | 759,350 | 368 / 46 MB | 43 | 104,435 | 36 / 5 MB |
| the Grand Staircase’s door | (32, −36), 1.7 m → the courtyard door | 129 | 736,567 | 368 / 47 MB | 42 | 101,941 | 36 / 6 MB |
| the pitch | (300, 34), 1.7 m → up its length | 97 | 597,134 | 368 / 48 MB | 53 | 108,837 | 36 / 6 MB |
| the station | (540, −452), 3.3 m → along the platform | 92 | 862,263 | 370 / 51 MB | 49 | 124,469 | 39 / 6 MB |
| **the most** | | **220** | **862,263** | | **111** | **147,381** | |
| the design’s ceiling (§2) | | 400 | 1,400,000 | | 220 | 450,000 | |

Since task 1 the draws went up with the other lanes’ things in the world (the wand and its practice set, the broom, the Map’s figures, the notice board) and with the landmarks: the Willow five draws (its trunk, its bones, its fronds, its crown, the book), the hut and its paddock eight, the greenhouse’s insides five, the pitch five, the forest’s edge three, the stone circle one, the station nine. The triangles hardly moved: everything a landmark repeats is instanced (the Willow’s bones and fronds, the pumpkins, the logs, the pots and plants, the Tentacula’s vines, the sleepers, the smoke, the centaurs) and the rest is merged by material. The memory is the renderer’s own count, render targets and all: on high the textures are mostly the chain’s targets at the window’s size. Inside Hagrid’s hut: 19 draws, 1,950 triangles.

Where the landmarks are walked, the counts stay under the ceiling too: the Willow’s slope at noon 165 draws and 1,034,953 triangles, the hut 147 and 1,122,702, the stone circle with the castle behind it 212 and 1,061,388, the forest’s edge at night 113 and 1,320,587 (the pines in sight, the most of anywhere on the grounds).

The pictures (960 × 600, WebP, here):

- `c2-willow.webp`: the Whomping Willow on its slope at noon, its limbs drooping, its fronds stirring
- `c2-hut.webp`: Hagrid’s hut, its smoke, the woodpile, the paddock’s fence and the forest behind
- `c2-pitch.webp`: the pitch from over the staff stand: the six stands in the houses’ colours, the hoops, the lake’s arm beyond
- `c2-greenhouse.webp`: inside greenhouse three: the benches, the pots and the Tentacula at the far end
- `c2-circle.webp`: the stone circle at the covered bridge’s end, the castle beyond
- `c2-station.webp`: Hogsmeade station at noon, the scarlet train (a stand-in until the cast lane’s Express) at the platform
- `c2-forest.webp`: the forest’s edge at night, the lanterns lit down the path
- `c2-hutroom.webp`: inside Hagrid’s hut, the fire and the kettle

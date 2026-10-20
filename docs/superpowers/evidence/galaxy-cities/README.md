# The galaxy's cities: the evidence

Lane 2 of `docs/superpowers/specs/2026-10-20-galaxy-living-free-roam-design.md`. Everything here was shot in the cloud container: `scripts/surface-shot.mjs` through the dev server, headless Chromium drawing in software (SwiftShader), at `high`. The draws and triangles are that frame's; a GPU's frame rate is not measured here.

## The cities

Five of the fourteen cities, each from a street and from outside it. To remake the shots, run the dev server (`npx vite --port 5188`), then:

```
OUT=lab/shots node scripts/surface-shot.mjs corellia -191,-150,128,0,street,-0.12 -220,-150,213,35,skyline,-0.2
OUT=lab/shots node scripts/surface-shot.mjs ordmantell -176,-140,105,0,street,-0.12 -200,-140,175,35,skyline,-0.2
OUT=lab/shots node scripts/surface-shot.mjs jedha 259,-60,113,0,street,-0.12 240,-60,188,35,skyline,-0.2
OUT=lab/shots node scripts/surface-shot.mjs plazir 351,-100,40,0,ring,-0.1 240,-60,213,35,skyline,-0.2
OUT=lab/shots node scripts/surface-shot.mjs fondor -191,-140,128,0,street,-0.12 -220,-140,213,35,skyline,-0.2
```

| city | view | draws | triangles |
| --- | --- | --- | --- |
| Coronet City (Corellia) | street | 300 | 1,323,002 |
| Coronet City (Corellia) | skyline | 344 | 1,145,372 |
| Worlport (Ord Mantell) | street | 327 | 1,137,569 |
| Worlport (Ord Mantell) | skyline | 344 | 1,323,850 |
| NiJedha (Jedha) | street | 386 | 1,786,680 |
| NiJedha (Jedha) | skyline | 509 | 1,958,901 |
| Plazir-15 | the first street view, inside a villa | 358 | 1,557,748 |
| Plazir-15 | skyline | 414 | 1,870,878 |
| Fondor's yard city | street | 279 | 1,000,112 |
| Fondor's yard city | skyline | 303 | 916,719 |

Every view is under the surface gate (600 draws, 2.5M triangles). Plazir-15's first street view (260,-60,128,0) assumed a grid and stood inside a villa; its city is rings, so it's shot from a ring street (`ring` above).

## The streets paved

The street views again with the paving (`groundPaint.js`'s `site.paving`), Plazir-15's from its ring street in its own pale stone:

| city | draws | triangles |
| --- | --- | --- |
| Coronet City | 281 | 1,262,522 |
| Worlport | 394 | 1,166,512 |
| Plazir-15 (ring street) | 366 | 1,484,716 |

The first paving darkened the floor's own low colour. On a dark world that was nearly the floor itself, and the haze and the tone map took the rest: on screen the street was about 8% darker than the ground beside it. The default now is a grey at half the low colour's brightness, and the pale cities say their own `road`.

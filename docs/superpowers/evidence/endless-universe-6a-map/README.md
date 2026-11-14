# Endless universe, lane 6a: the map’s first half. Evidence

The nav map and the flat mini-map on one chart (`src/components/universe/chart/`), centred on the ship, zoomed, dragged, tilted and turned, every mark on a stem, the ship always on it. Spec: `docs/superpowers/specs/2026-10-18-endless-universe-design.md`, section F.

## How the shots were made

- Before: `main` at `4b8a6313`, on 12 November 2026, from this lane’s first commit (the check gained a base URL and the `minimap` and `far` modes, nothing else).
- After: the lane’s branch, the same command.
- The command, with `npx vite --port 5173` up: `OUT=<dir> CHROME=/opt/pw-browsers/chromium node scripts/navmap-check.mjs` (all four modes). Headless Chromium in software GL; the shots are JPEG at 82 so each stays well under 1 MB.

## Before and after

| shot | before (`main`) | after |
| --- | --- | --- |
| The nav map on opening | `before/1-navmap.jpg`: the fixed universe chart, round the sun | `after/1-navmap.jpg`: round the ship, the sector grid, the readout and the tools under it |
| A place picked | `before/2-picked.jpg` | `after/2-picked.jpg` |
| The home system | `before/7-home-system.jpg`: its own linear chart | `after/7-home-system.jpg`: the system level of the one chart, stations on their stems, the ship pinned to the rim |
| Phone, the chart | `before/11-phone-chart.jpg` | `after/11-phone-chart.jpg` |
| The flat map (3D off) | `before/12-minimap-flat.jpg`: the fandoms and stations, orbit rings that match nothing | `after/12-minimap-flat.jpg`: every place, the wonders and the Curve’s worlds too, no rings |
| Home’s teaser | `before/13-minimap-teaser.jpg` | `after/13-minimap-teaser.jpg`: the same worlds, on the chart’s projection |
| The ship 250,000 out | `before/14-far-ship.jpg`: the ship is off the chart | `after/14-far-ship.jpg`: the ship in the middle, sector 2, 0, 0 |
| Tilted | none | `after/15-tilted.jpg` |
| Far, dragged away | none | `after/16-far-ship-pinned.jpg`: the ship pinned to the rim, and Home |
| Phone, zoomed in | none | `after/17-phone-zoomed.jpg` |
| Phone on its side (844 × 390) | none | `after/18-phone-sideways.jpg`: the bar beside the circle |

The rest (`3` to `6`, `8` to `10`) are the jump and phone list steps, kept so the two runs line up.

## The checks

| check | `main` | after |
| --- | --- | --- |
| `navmap-check.mjs` | 2 failed of 25: “the site’s jump plays over the map” (the overlay’s lazy chunk is never up in time in dev: HANDOFF “Left”) and “the ship is on the chart, far out” | 1 failed of 47: the same jump overlay; every chart step passes |

The new steps: the chart opens on the ship at the neighbourhood’s zoom, its readout gives the ship’s sector and height, the wheel zooms to a system and − back out, a minus typed in the search stays in the search, a 120 px drag begun on a place’s name moves the ship’s marker 120 px and picks nothing, “Back to the ship” brings it back, a Shift-drag tilts it and “Look straight down” flattens it; far out, the ship is drawn, its sector two out, and dragged off it is pinned inside the rim; on a phone the tools are 44 px, clear of each other and the readout, the panel scrolls, Zoom in zooms, and turned on its side everything is on the screen; the flat map has the wonders and the Curve’s worlds and no orbit rings, and `+` zooms it; the teaser keeps to the worlds.

## The scene

Unchanged: no line of `scene.js`, `ship.js` or the generator moved, so the draw calls and triangles at every pose are as they were. The chart is an SVG over a canvas of stars, drawn only while the map is open.

## The bundle

| chunk | `main` | after |
| --- | --- | --- |
| `NavMap` | 24.79 kB | 24.69 kB |
| `MiniMap` | 2.62 kB | 3.87 kB |
| `Interests` | 7.41 kB | 7.41 kB |
| the chart’s shared chunk (`marks`, `place`) | none | 14.33 kB, 1.60 kB |

Home’s lazy “Interests” section now loads the chart and `nav.js` with the mini-map (the same data and projection as the nav map, as the spec asks), about 16 kB more, gzip about 7 kB.

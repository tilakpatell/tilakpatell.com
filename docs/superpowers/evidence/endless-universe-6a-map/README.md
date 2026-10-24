# The map, first half (endless universe, lane 6a)

The nav map and the mini-map as they are on `main`, before the lane changes them, and after, beside them. The plan is `docs/superpowers/plans/2026-10-18-endless-universe-lane-6a-map.md`.

## How the before shots were taken

- **When:** 2026-10-24.
- **What:** `main` at `cc5e2eaf` (“Merge pull request #1237”), served from a checkout of it: `npx vite --port 5185 --strictPort --host 127.0.0.1`.
- **The check:** the lane’s `scripts/navmap-check.mjs` (its base URL and its `minimap` and `far` modes are the lane’s first commit), run against that server in all four modes:

  ```
  BASE=http://127.0.0.1:5185 OUT=lab/navmap/before CHROME=<chromium> node scripts/navmap-check.mjs
  ```

- **The browser:** headless Chrome for Testing 153, WebGL in software (SwiftShader through ANGLE), `?quality=low`. Desktop 1440 × 900, phone 390 × 844 with touch, the flat map 1280 × 800.
- **The fonts:** that checkout’s `node_modules` is a link to another folder, outside the server’s root, so the server refused the font files of the two faces it serves from there, several 403s: Archivo’s (`archivo-latin-wdth-normal.woff2`) and JetBrains Mono’s 400 and 500, each as `.woff2` and `.woff`, five files, asked for again on every page load. The words in those faces are in the fallback face. The page errors the check printed are these 403s, but it printed only the first eight, so that run doesn’t show there was nothing else past them (the check now prints how many there were and each different one). The after shots are to be served the same way, so the two compare, and the 403s will stay in that run’s errors. A run that is to show no page errors needs a server allowed the linked `node_modules` (`server.fs.allow`, in a throwaway config that extends the repo’s).

The check’s shots of the flights (`3-jumping`, `4-after-jump`, `6-super-to-aurelia`) and `5-charging` (the portal’s swirl over the chart, from the failed Citadel jump below) show nothing this lane changes, so they aren’t kept.

## Before and after

| Shot | What it shows | Before (`main`) | After |
| --- | --- | --- | --- |
| `1-navmap` | The map opened from the ship, desktop | ![](before/1-navmap.png) | |
| `2-picked` | Avengers HQ picked, its course drawn | ![](before/2-picked.png) | |
| `7-home-system` | The Home system chip, the ship elsewhere (below) | ![](before/7-home-system.png) | |
| `8-phone-map` | The universe on a phone, the map button | ![](before/8-phone-map.png) | |
| `9-phone-navmap` | The map on a phone: the list first | ![](before/9-phone-navmap.png) | |
| `10-phone-picked` | Earth picked from the list | ![](before/10-phone-picked.png) | |
| `11-phone-chart` | The chart, a tap away, over the panel | ![](before/11-phone-chart.png) | |
| `11-minimap-flat` | The flat map, with 3D off | ![](before/11-minimap-flat.png) | |
| `12-minimap-teaser` | Home’s teaser | ![](before/12-minimap-teaser.png) | |
| `13-far-ship` | The ship two sectors out (x 250,000): no ship on the chart | ![](before/13-far-ship.png) | |

`7-home-system` was shot on `main` with the ship where the failed Citadel step (below) left it: in the Rick and Morty sector, 220 ship-lengths from The Citadel, on the pulse drive to Aurelia, the jump charging (17 s). So no ship marker is expected on the Home chart in the before shot. Once the Citadel step works, the after shot starts from another place, and the two won’t compare like for like there.

## The checks on `main`

16 of 21 pass. The five that fail are the Citadel jump and the steps that run on from it. The Citadel is no longer at the check’s (1755, −4660) in the main sector: it sits in the Rick and Morty sector now (`deep.js`). So the go button offers the way through the portal (`NavMap.jsx`’s “… through the portal to”), not the jump, and the ship sets off on the pulse drive (HANDOFF-universe.md, “Left”).

- `FAIL the go button reads “Jump to The Citadel”`
- `FAIL the ship’s out at The Citadel on the first frame past the flash (null)`
- `FAIL the map says where you are and that the drive's charging` (it read “540 ship-lengths from The Citadel · On the pulse drive, on the way to The Citadel · Jump: charging, 65 s”)
- `FAIL with the drive charging, it says so and goes at super speed`
- `FAIL still on its way out to Aurelia with the selection cleared (rmportal-back)`

The `far` mode says the ship’s marker is missing from the chart: `NavMap.jsx` draws the ship only in the chart’s own sector and inside its circle.

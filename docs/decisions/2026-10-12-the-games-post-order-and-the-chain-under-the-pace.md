# The game's post order on the lit chain, and the Battlefront chain under the pace

## Context

Hoth at ultra on the owner's desktop (RTX 5090, a 5,120 × 1,440 screen at 200 %) drew a navy field at a frame a second. Measured 2026-10-12 (the owner's `bf2-re` study, `C:\Users\tilak\source\repos\bf2-re`, findings 02 and PROGRESS.md):

- The game's own shaders, read from its shader program database with their reflection kept: the tonemap composite clamps the exposed scene to 0…1, gamma-2.2 encodes it, reads the 32³ grading LUT with that encoded value, and shows the LUT's output as the display value. `passes.js` read the LUT with the linear 0…1 picture and sRGB-encoded after: Hoth's LUT (black under 0.13, white from 0.875) sent every shadow and mid-tone to black.
- The game's sky shader draws the painted panorama as the sky, scaled by the record's `LuminanceScale` alone; `sky.js` fitted the painting's foot to an analytic model's horizon (gain 0.38 on Hoth, ×10 on Kamino).
- The chain's cost: in the browser pane the chip drew the ultra frame in 2.4 ms while the CPU side of `draw` took 20 ms (three's WebGPU renderer submitting ~1,150 draws over 35 passes); the repo's headless check at ultra 1440p gave 59.9 ms a frame. `module.js` never read the pace (no `lowerQuality`, no `sharpness: 'own'`), the runtime never wired the GPU clock (every node world paced on the CPU's frame time), and ultra's budget drew at twice the screen's pixels.

## Decision

- After a record's `tonemap` pass, the LUT reads `pow(clamp(c), 1/2.2)` and its output is shown as it is (`passes.js`, `graded`). Without a tonemap pass the old order stands.
- The painting's gain is the record's luminance (`sky.js`'s `panoramaGain`); the old fit is kept as `meetGain` for a world whose LDR copy lost its level.
- The Battlefront module declares `sharpness: 'own'` and a ratio cap at the screen's own pixels (never over 2), rebuilds its chain under the pace (`lowerQuality` → `headroom`: the internal resolution first, then the shed passes), asks the sun for lane N3's cascade cadence, and the runtime hands every node world the GPU clock (`createGpuTime`), so the controller steps on the chip's time.
- Contact-shadow passes hide every top-level branch of the scene that holds no tracked figure while they draw.
- One physical exposure for the sun, the sky and the lamps (`calibrate.js`): the record's lux, nits and candela over k = 1.2 · 2^(EV − compensation), the EV metered as the game meters it and clamped to MinEV…MaxEV only where the record sets `ClampEV` (Hoth's day meters 16.33; clamped to 15 it blew the snow and the sky to white). Lane G's GAME_TO_SITE (0.0713) and SKY_TO_SITE (0.2006) go: they dimmed the sun 11.7× and the sky 4.2× to hide the LUT read with linear values.

## Consequences

- Hoth's field reads as a day: snow and sky at the grade's levels, not navy.
- Ultra on a 4K-class screen starts at 0.77 of the screen and steps down before shedding; no supersampling on the Battlefront world.
- Hoth's day: sun 3.67, sky 1.00 (the game's 3.66 : 1), snow white with its detail, the sky deep blue; the mean of the headless field shot 0.56/0.65/0.77 (was 0.33/0.43/0.55 navy, 0.05/0.11/0.22 before the LUT fix).

## Revisit when

- A capture of the game's own sunny Hoth (a Galactic Assault match; Arcade's Outpost Delta is the blizzard) puts a number on the snow and the sky to check the 3.67/1.00 against.
- Lane W's HDR panoramas are read by `sky.js`: `meetGain` can go.

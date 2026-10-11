# The twins against their originals

`node scripts/twin-parity.mjs` on 2026-10-10, in the cloud container: Chromium 1194 on SwiftShader, both sides through ANGLE's WebGL 2 (the node side on three's node renderer, `forceWebGL`), 256 × 256, each through its renderer's post chain. The owner reruns it on the laptop's GPU, and with `GPU=webgpu`.

A twin passes at the parity check's line: 32 dB and under 2 % of pixels more than 16/255 off. Two do not yet:

- **dust** (26.8 dB): the node cards come out a little smaller and softer than the GLSL's. The arithmetic is line for line; scaling the card by 1.4 brings it to 34 dB, so something in the instanced billboard's size differs. Open.
- **matcap** (16.8 dB): the baked sphere is lit brighter on the node renderer (its RenderTarget's output). Open; the surface does not ask for matcaps (groundWorld's `matcap` is empty there), so it does not hold up the surface's flip.

The floor bake is compared on its mask: the mean difference a channel, of 255 (the height channels are identical; the sun and the sky differ at shadow edges, by the depth pictures' texels).

| Case | Status | PSNR | Off |
|---|---|---|---|
| grounding:floor | ok | 55.3 dB | 0.00 % |
| grounding:movers | ok | 60.5 dB | 0.00 % |
| grounding:blobs | ok | 54.5 dB | 0.00 % |
| groundLook | ok | 53.6 dB | 0.00 % |
| groundLook:map | ok | 54.5 dB | 0.00 % |
| groundLook:splat | ok | 53.6 dB | 0.00 % |
| foliage | ok | 65.7 dB | 0.00 % |
| core | ok | 61.4 dB | 0.00 % |
| puffs | ok | 64.5 dB | 0.00 % |
| house | ok | 54.4 dB | 0.00 % |
| ink | ok | 66.8 dB | 0.00 % |
| grass | ok | 61.9 dB | 0.00 % |
| dust | ok | 26.8 dB | 11.44 % |
| recolour | ok | 66.3 dB | 0.00 % |
| matcap | ok | 16.8 dB | 16.37 % |
| grounding-bake | ok | {"sun":2.55,"heightHi":0,"heightLo":0,"sky":2.32} |  |
| surface:sky:bespin | ok | 52.7 dB | 0.00 % |
| surface:sky:desert | ok | 52.5 dB | 0.00 % |
| surface:weather:snow | ok | 47.5 dB | 0.06 % |
| surface:weather:rain | ok | 71.6 dB | 0.00 % |
| surface:weather:sand | ok | 43.0 dB | 0.08 % |
| surface:windows | ok | 58.7 dB | 0.00 % |
| surface:post | ok | 52.8 dB | 0.00 % |
| surface:water:sea | ok | 66.7 dB | 0.00 % |
| surface:water:swamp | ok | 80.1 dB | 0.00 % |
| surface:water:lava | ok | Infinity dB | 0.00 % |
| surface:water:clouds | ok | Infinity dB | 0.00 % |

## The flip's round (2026-10-10, night)

The two below the line, fixed: dust's colour was `materialColor` (colour × map) where the GLSL reads the colour alone (`materialReference('color')` now); matcap's sphere was sampled upside down out of its render target (the node renderer reads a target with v = 0 at its top row), so it's drawn into a target of its own and copied over turned.

| Case | Status | PSNR | Off |
|---|---|---|---|
| dust | ok | 64.7 dB | 0.00 % |
| matcap | ok | 64.6 dB | 0.00 % |

The twins the last imports needed, each case file under `scripts/twin-parity/cases/` (`node scripts/twin-parity.mjs <prefix>`):

| Case | Status | PSNR | Off |
|---|---|---|---|
| figures:portal:open | ok | 55.4 dB | 0.00 % |
| figures:portal:shut | ok | 56.0 dB | 0.00 % |
| figures:built | ok | 56.7 dB | 0.00 % |
| rickmorty:toon | ok | 62.3 dB | 0.00 % |
| rickmorty:cast | ok | 61.8 dB | 0.00 % |
| rickmorty:dress | ok | 65.1 dB | 0.00 % |
| rickmorty:glass | ok | 63.4 dB | 0.00 % |
| rickmorty:cruiser | ok | 34.9 dB | 0.23 % |
| fx:livery | ok | 59.8 dB | 0.00 % |
| fx:marks:decal | ok | 57.6 dB | 0.00 % |
| fx:marks:decal-colour | ok | 58.1 dB | 0.00 % |
| fx:marks:glow | ok | 57.5 dB | 0.00 % |
| fx:marks:glow-cooling | ok | 57.6 dB | 0.00 % |
| fx:marks:sprite | ok | 56.4 dB | 0.00 % |
| fx:bolts | ok | 71.5 dB | 0.00 % |
| fx:bolts:look | ok | 68.3 dB | 0.00 % |
| fx:hvv:wall | ok | 54.5 dB | 0.00 % |
| fx:push | ok | 63.8 dB | 0.00 % |

After the sky and the water were split into their workings and their looks, rerun:

| Case | Status | PSNR | Off |
|---|---|---|---|
| surface:sky:bespin | ok | 52.7 dB | 0.00 % |
| surface:sky:desert | ok | 52.5 dB | 0.00 % |
| surface:water:sea | ok | 54.2 dB | 0.00 % |
| surface:water:swamp | ok | 57.2 dB | 0.00 % |
| surface:water:lava | ok | 56.5 dB | 0.00 % |
| surface:water:clouds | ok | 54.4 dB | 0.00 % |

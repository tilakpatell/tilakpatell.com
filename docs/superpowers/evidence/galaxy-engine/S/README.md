# Lane S: the sun's shadows, on the lit fixture

Every shot is `node scripts/light-fixture.mjs … --legs webgl`: the node renderer on a WebGL 2 context, drawn headless on SwiftShader (the CPU) in the cloud container, 1600 × 900, shrunk to 960 wide as WebP. The WebGPU leg is not here: the cloud's software WebGPU device dies on the fixture (assumption B5), so the owner's laptop runs it. Frame times are the CPU's: they compare one row with another, not with a real chip.

## Calibration (`--hoth`)

`calibration-pair.webp`: lane G's calibrated classic Hoth field (`../../bf2017-light/hoth-field-after.webp`, left) beside the fixture under Hoth Sunny's record (right: snow albedo `0xe4eaf0`, the house's Neutral tone mapping at exposure 1.4, the ring's lamps off, the ultra chain).

| shot | mean linear luminance | against lane G's 0.3531 |
|---|---|---|
| lane R's `post-ultra-webgl.png` before this lane (grey ground, Hoth-ish entry) | washed to white | |
| `--hoth`, calibrated, SSGI still in the chain | 0.8112 | +130 % |
| `--hoth`, calibrated, SSGI left out on `nodes-webgl` | 0.3852 | +9.1 % |
| `--hoth`, final (PCSS and the record's cloud shadows) | 0.3686 | +4.4 % |

The chain render → ssgi → output gave 0.787 at GI intensity 0, 0.1, 0.25 and 1 alike, against 0.320 for render → output, so SSGI is left out on this backend (`post.js`'s `CANNOT`).

## Cascades and the shadow sun (`--shadows`)

- `shadows-post-ultra-webgl.webp`: figures (1.8 m capsules) at 2, 20 and 60 m, a wall, a post row to 200 m, four cascades out to 140 m.
- `shadow-sun-pair.webp`: cast along the light (`--light-sun`, 33° up: long shadows, left) and along the record's shadow sun (`ShadowSunRotationY` 82°: short ones, right). The record's shadow sun is the steeper one, so its shadows are shorter, not longer.
- `*-seam.webp`: the post row from above, out past the cascades' far. On SwiftShader a fragment past the last cascade loses its image-based light, which shows as a hard step at the far edge. The generated GLSL reads no cascade there and the shadow term is exactly 1; with the environment off the step shrinks from 92 levels to 6. So the 15 % fade into the far term is judged on a real chip.

## Soft (`--filter pcss | pcf`)

- `penumbra-pair.webp`: PCSS on ultra, a board's shadow 1 m under it (sharp, left) and 10 m under it (soft, about 20 cm of penumbra, right).
- `pcf-vs-pcss-10m.webp`: the 10 m board under three's PCF (hard, left) and PCSS (right).

The frame table: the `--shadows` near view, post off, so the shadow pass dominates. These are mean milliseconds over 6 s on SwiftShader WebGL 2. The WebGPU column waits for the laptop.

| tier | filter | WebGL 2 (SwiftShader) mean ms | WebGPU |
|---|---|---|---|
| ultra | PCSS (8 + 256) | 1223.7 | laptop |
| ultra | PCF | 822.6 | laptop |
| high | PCSS (8 + 32) | 1213.1 | laptop |
| high | PCF | 700.7 | laptop |
| low | no shadow | 547.7 | laptop |

Ultra's 256 samples cost about what high's 32 do. Most texels stop after the initial 8 samples, because the record's 5 % threshold finds them fully lit or fully shadowed.

## Clouds and contact (`--shadows --clouds`)

- `contact-pair.webp`: the 2 m figure's feet without (left) and with (right) its contact shadow.
- `clouds-pair.webp`: the strip from 70 m up under the fixture's test cloud layer (80 m, coverage 1, exponent 1; Hoth Sunny's own layers are nearly clear), and again after 60 s of drift on Hoth's wind (5 m/s).

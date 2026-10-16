# FL3, the Death Star’s inside: the port’s numbers, and where it stands

Lane FL3’s second world (`/deathstar/inside`, `src/components/deathstar/inside/module.js`), started from lane P1’s `claude/perf-p1-ds-inside` (four commits ahead of `main`: the parity views, the explosions and dye twins, the inside’s own twins, the flip to `'nodes'`), with `origin/main` and this lane’s Mario 64 branch merged in (the runtime pieces it needs: a render pass’s `samples`, the bloom’s `composer` glow, a chain freed when disposed early; pull request #1015). Every number was read in the cloud container on 2026-10-16, on SwiftShader. The `webgpu` rows are the owner’s machines’, left empty.

**Not mergeable yet: two of the three world views fail parity (below).**

## The closure

```bash
node docs/superpowers/evidence/perf/tools/glsl-closure.mjs src/components/deathstar/inside/module.js   # 148 files reached, 0 with GLSL
npx vitest run src/runtime/shading.test.js                                                              # green
node scripts/health.mjs --only glsl-sites                                                               # 604 (after Mario 64) → 591
```

On `main` the inside had 13 GLSL sites in eight files of its own (`scene/fx.js`, `saber.js`, `views.js`, `rooms/ds2/space.js`, `rooms/deep/parts.js`, `compactor.js`, `rooms/hangar.js`, `rooms/shaft/depths.js`). P1 moved them into `scene/glsl/`; this lane moved that folder to `scripts/twin-parity/originals/deathstar/`, beside the check that reads it: the 13 sites leave `src/`. `lib/three/explosions.js` and `dye.js` keep their originals: the universe map and Rick and Morty’s planets still draw with them (their twins, `explosionsNodes.js` and `dyeNodes.js`, are P1’s new files).

## The twins (`node scripts/twin-parity.mjs deathstar explosions dye`, the node side on WebGL 2)

| case | PSNR | off |
| --- | --- | --- |
| `deathstar:sky:stars` | 49.8 dB | 0.05 % |
| `deathstar:sky:band` | 69.8 dB | 0.00 % |
| `deathstar:sky:sun` | 75.5 dB | 0.00 % |
| `deathstar:sky:planet` | 71.4 dB | 0.00 % |
| `deathstar:sky:giant` | 71.5 dB | 0.00 % |
| `deathstar:sky:flashes` | 57.2 dB (P1’s: 16.8 dB, 52.26 %) | 0.00 % |
| `deathstar:sky:sunlit` | 57.4 dB | 0.00 % |
| `deathstar:rooms:glow` | 60.6 dB | 0.00 % |
| `deathstar:rooms:haze` | 46.6 dB | 0.00 % |
| `deathstar:rooms:bayField` | 73.1 dB | 0.00 % |
| `deathstar:rooms:ds2Field` | 76.7 dB | 0.00 % |
| `deathstar:rooms:water` | 63.1 dB | 0.00 % |
| `deathstar:rooms:stars` | 69.1 dB | 0.00 % |
| `deathstar:fx:glows` | 70.8 dB | 0.00 % |
| `deathstar:fx:puffs` | 61.2 dB | 0.00 % |
| `deathstar:fx:scorches` | 57.2 dB | 0.00 % |
| `deathstar:saber` | 70.7 dB | 0.00 % |
| `explosions` | 58.7 dB (P1’s: 32.1 dB, 9.23 %) | 0.00 % |
| `dye` | 67.6 dB | 0.00 % |

Two of P1’s twins failed, both the same way: **a node material multiplies its colour by an instanced mesh’s `instanceColor` itself** (`three/src/materials/nodes/NodeMaterial.js:847`), and the battle’s flashes and the blasts’ rings multiplied by it again, drawing each in its colour squared. The flashes’ colour was also a bare float, which three takes as the alpha too, so the additive blend weighed the glow by itself (found by drawing each term of the shader alone on both sides: each matched; the whole matched only as a `vec3`).

## The world (`node scripts/gpu-parity.mjs /deathstar/inside --before a3e97892 --view bay,tractor,throne`)

`a3e97892` is P1’s first commit: the parity views on the classic renderer.

| view | webgl leg (nodes-webgl) | webgpu leg |
| --- | --- | --- |
| bay | 22.53 dB, 16.28 % off, **fail** | the owner’s |
| tractor | 33.52 dB, 3.15 % off, **fail** | the owner’s |
| throne | 49.92 dB, 0.00 % off, pass | the owner’s |

The chain’s two asks (`samples: 0`, `composer: true`, what the classic backend’s `EffectComposer` and `UnrealBloomPass` drew) are right: without them both views fall to 16.5 dB, 53 % off.

What is left, from looking at the pictures and the scene in the page (`scratchpad` scripts, not kept):

1. **The bay’s floor is dark on the node renderer.** The deck is near-black and glossy (`scene/kit.js:482`, `reflect: true`): what shows on it is the room’s reflection probe (`scene/probe.js`). The lamps are the same on both sides (the pool’s thirteen `PointLight`s read 180, 900, 650, 320 and nine at 0 on each). Every `envMapIntensity` in the scene × 10 brightens the Falcon (re-probed later, `rooms/hangar.js:425`) and leaves the floor as it was; shooting the room’s probe again every second for six seconds changes nothing. So on the node WebGL path the bay’s own probe gives the floor nothing: the cube’s picture (taken through `CubeRenderTarget` and `CubeCamera` from `three/webgpu`, `probe.js:61-74`) or its prefilter (`PMREMGenerator.fromCubemap` into the same target a second time). Next: read the probe’s cube back (`readRenderTargetPixelsAsync`) on both sides; try `fromCubemap` without reusing `env`; then the floor copy’s `envMap` at draw time.
2. **A far row of floor strips glows on the node renderer** where the classic one draws a thin dim line: the strip is 1 mm above a black box (`rooms/hangar.js:45-46`), and at that distance the two share a depth value; the classic renderer sorts opaque things by material and happens to draw the black last, the node one sorts by depth. The classic picture is the artefact. The fix is to lift the strip clear of the box, a picture change the owner should see.
3. **The troopers’ poses differ in the parity pictures, not in the world**: held at the view in real time on both sides, they match. Their clips run on frames the view does not hold.
4. **The tractor’s console and the floor under it** are darker on the node side, most likely the same probe as (1).

## The frames (`CAP=on VIEW=800x500@1 perf-probe.mjs deathstarInside`, one run each, the play phase)

| | p50 ms | worst 1 % ms | main ms | draws |
| --- | --- | --- | --- | --- |
| Low, classic (`origin/main`) | 444 | 1218 | 8.4 | 43 |
| Low, nodes | 196 | 425 | 7.6 | 34 |
| High, classic | 584 | 1299 | 8.6 | 46 |
| High, nodes | 593 | 1167 | 11.3 | 50 |
| WebGPU, Low and High | the owner’s | | | |

One pair each, so a first read only: Low no slower; High slower on the main thread (+2.7 ms), level on the median, better on the worst 1 %. `CAP=on`: see `../FL3-mario64/README.md`.

## Left

- The bay’s probe on the node renderer (1), then the views again.
- The far strips (2): lift them, with the owner’s word on the picture.
- The probe at High, three runs a side, then the rebuild if the main thread holds slower (the pool’s lights, the rooms’ meshes).
- `HANDOFF-every-world-on-webgpu.md`’s row struck when this merges.

# Lane V1: the video settings, and the clean picture by default. Evidence

Design: `docs/superpowers/specs/2026-10-11-frostbite-gaps-design.md` §6 (on #927). Plan: `docs/superpowers/plans/2026-10-11-frostbite-laneV1-video.md`. Measured on 2026-10-11 in the cloud container (Node 22.22, Vite 8.3.2, Vitest 5.0.3, Chromium on SwiftShader); `_source` on every row.

## The panel

`panel-ultra.png` and `panel-mid.png`: the settings sheet opened on a classic page (`#/experience`, the intro skipped) at `?quality=ultra` and `?quality=mid`, 1,200 × 900, the sheet’s visible height (it scrolls inside). Counted from the DOM by the script that shot them (`scratchpad/shoot-panel.mjs`, Playwright):

| pinned level | groups | rows | disabled pills |
| --- | --- | --- | --- |
| ultra | Graphics, Anti-aliasing, Shadows, Lighting, Post, Textures, Sound, Controls, Data, About this device | 27 | 6 (the five Quality pills, pinned by the address, and one of Sound’s) |
| mid | the same | 27 | 29 (the same 6, and 23 values above Medium’s ceiling, each with its reason as the pill’s title) |

The mid shot shows SMAA selected under Method, Medium’s own value: the preset the menu reads is the level in play (the address’s pin, Auto’s pick), not the store’s alone, which the first shot of this lane got wrong (TRAA, high’s value, showed at mid) and the commit after it fixed.

## The chain on high

`passesFor('high', hoth.sunny, 'webgpu')` before and after (the audit §1.7; `src/lib/three/light/post.test.js`, “the tiers’ chains”):

| | the chain |
| --- | --- |
| before | render, ssgi, denoise, ao, ssr, bloom, motionBlur, lut, smaa, output |
| after | render, ssgi, ao, ssr, bloom, motionBlur, lut, traa, output |

On `nodes-webgl` (no TRAA) high keeps SMAA and the denoiser, as before. The FLIP of the high tier against G1’s reference is the laptop’s to record (no GPU here).

## The checks

`npm run lint`; `npx vitest run src/lib/video.test.js src/lib/device.test.js src/lib/three/light src/runtime src/components/settings src/components/battlefront src/lib/level src/components/galaxy/surface/level` (every suite green on the way); `npm test`; `npx vite build`; `node scripts/health.mjs --check --skip build`; `npm run coverage:bf2017`; `npm run maps:bf2017`.

## HDR output (lane H1, folded in)

The design’s H1 is one control of this menu, so it rides here: `hdr` (Display group, off in every preset) is shown only where `matchMedia('(dynamic-range: high)')` matches, and on asks the runtime’s backend for a half-float canvas (`createWebGPU`’s `hdr`: `outputType: HalfFloatType`), which three r186 configures with the `'extended'` tone-mapping mode (`node_modules/three/src/renderers/webgpu/WebGPUBackend.js:356`). The record’s chain is unchanged: its linear tone map and LUT already end in linear. It takes effect on the next mount (a reload), since the canvas is configured once. No cloud leg: SwiftShader has no HDR canvas; the laptop’s HDR display shoots it beside the SDR frame.

## Not in this slice

N2’s knobs (the upscaler, the sharpen pass, the frame cap), the geometry and effects groups (draw distance, scatter density, far copies, the particle and ragdoll caps): the second slice, after N2 and N5 land, each as one more row of `lib/video.js`’s schema and one reader.

#!/usr/bin/env node
// Lane W's `lightmaps` job, the site's own bake (GPU-first spec §11, N3's
// second road): a level's static instances lit by the record's sun, sky and
// bounce numbers, gathered into charts the site unwraps itself, written in
// Enlighten's five-map shape (irradiance, three direction maps one a colour
// channel, sky visibility) so light/baked.js reads it as it would the game's.
//
//   node scripts/desktop/bf2017-lightmaps.mjs --dry [--size 64] [--samples 128] [--out <dir>]
//
// --dry (the cloud's): the lit fixture's ground and ring, gathered on the CPU
// by scripts/lib/enlighten-fixture.mjs (pure, tested), into --out (default
// lab/lightmaps-dry/; the committed 256² fixture is `--size 256 --out
// src/runtime/fixtures/enlighten`). It proves the pipeline end to end: rows,
// maps, the sampler, the luminance against lane S's band.
// Without --dry (the owner's desktop, a level): the design's bake is
// three-gpu-pathtracer over the level's instances with watlas charts. That
// package is not a dependency of this repository, and the standing rule is
// no new npm dependency without the owner's word, so the full bake stops
// here and says so: the owner adds the package and its stack page
// (docs/stack/pathtracer.md), then the level road is written in this file.
//
// The irradiance is HDR in the record's units; an 8-bit PNG holds it as
// sqrt(E / peak) a channel (fixture.json's `peak` and `encoding`), which the
// fixture's loader (src/runtime/fixtures/lightN3.js) decodes to half floats.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readEntry, sunDir } from '../../src/lib/three/light/entry.js';
import { CHART, GROUND, SAMPLES, SPAN, STONE, SUN_SCALE, fixtureScene, gatherTexel, openIrradiance, texelToWorld } from '../lib/enlighten-fixture.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const argv = process.argv.slice(2);
const opt = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
if (!argv.includes('--dry')) {
  console.error("the level bake needs three-gpu-pathtracer, which is not a dependency here (the owner's call: no new npm dependency without their word). --dry bakes the lit fixture.");
  process.exit(2);
}
const samples = Number(opt('samples', SAMPLES));
const size = Number(opt('size', 64));
const OUT = join(ROOT, opt('out', 'lab/lightmaps-dry'));
const sharp = (await import('sharp')).default;

const sunny = JSON.parse(readFileSync(join(ROOT, 'src/data/bf2017/light/hoth.json'), 'utf8')).weathers.sunny;
const sun = { dir: sunDir(sunny.sun.az, sunny.sun.el), lux: sunny.sun.lux };
const scene = fixtureScene();
// The sky's shape and tint are the record's probe's; its level is the
// site's own calibrated sky (calibrate.js's sky term, which the hemisphere
// light carries: its up irradiance), back in the record's units by
// gameToSite. The probe's absolute numbers are a reflection cube's (held
// under twice its horizon, Cloudy_VFX's), not the sky's irradiance.
const ve = JSON.parse(readFileSync(join(ROOT, 'src/lib/three/light/fixtures/hoth.ve.json'), 'utf8')).sunny;
const site = readEntry(ve);
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const hemiUp = site.ambient.sky.map((v) => v * site.ambient.intensity);
const shape = { zenith: sunny.probe.zenith, horizon: sunny.probe.horizon, ground: sunny.probe.ground };
const level = lum(hemiUp) / site.gameToSite / lum(openIrradiance(shape, [0, 1, 0], samples));
const sky = Object.fromEntries(Object.entries(shape).map(([k, v]) => [k, v.map((x) => x * level)]));
const open = openIrradiance(sky, [0, 1, 0], samples);
// (a wall's open sky: half the hemisphere, from the side)
const vertical = openIrradiance(sky, [1, 0, 0], samples);

const n = size * size;
const irr = new Float32Array(n * 3);
const dirs = [0, 1, 2].map(() => Buffer.alloc(n * 4));
const vis = Buffer.alloc(n);
for (let j = 0; j < size; j++) {
  for (let i = 0; i < size; i++) {
    const [x, z] = texelToWorld(i, j, size);
    const t = gatherTexel(x, z, scene, sky, sun, samples, { open, vertical });
    const k = j * size + i;
    irr.set(t.irr, k * 3);
    for (let c = 0; c < 3; c++) for (let q = 0; q < 4; q++) dirs[c][k * 4 + q] = Math.round(Math.min(1, Math.max(0, t.dirs[c][q])) * 255);
    vis[k] = Math.round(t.sky * 255);
  }
}
const peak = irr.reduce((a, v) => Math.max(a, v), 0);
const rgb = Buffer.alloc(n * 3);
for (let k = 0; k < n * 3; k++) rgb[k] = Math.round(Math.sqrt(irr[k] / peak) * 255);

mkdirSync(OUT, { recursive: true });
const png = (buf, channels, file) => sharp(buf, { raw: { width: size, height: size, channels } }).png({ compressionLevel: 9 }).toFile(join(OUT, file));
await png(rgb, 3, 'irradiance.png');
for (const [c, name] of ['dirR', 'dirG', 'dirB'].entries()) await png(dirs[c], 4, `${name}.png`);
await png(vis, 1, 'sky.png');
const r = (v) => Math.round(v * 1000) / 1000;
const meta = {
  _source:
    "scripts/desktop/bf2017-lightmaps.mjs --dry (lane W's lightmaps job, the site's own bake on the lit fixture): not the game's bake. Hoth Sunny's probe radiances (src/data/bf2017/light/hoth.json weathers.sunny.probe) for the sky's shape and tint, its level the site's calibrated sky (skyLevel), and the record's sun (lux, az, el) gathered over the lit fixture's ground and ring (litWorld.js), the occluders' bounce at the stone's albedo and the record's SunScale; irradiance in the record's units (lux), sqrt(E / peak) in 8 bits",
  size,
  span: SPAN,
  ground: GROUND,
  chart: CHART.map((v) => r(v * 1e3) / 1e3),
  samples,
  peak: r(peak),
  encoding: 'sqrt',
  openIrradiance: open.map(r),
  skyLevel: { _source: "the probe's radiances × this, so the open snow's up irradiance × gameToSite is the hemisphere light's luminance (readEntry(hoth.ve.json sunny).ambient)", factor: r(level), gameToSite: site.gameToSite, hemisphereUp: hemiUp.map(r) },
  sunScale: SUN_SCALE,
  stone: STONE,
  rows: [{ set: 'fixture_hoth_sunny', variant: 'Sunny', size: [size, size], irradiance: 'irradiance.png', dirR: 'dirR.png', dirG: 'dirG.png', dirB: 'dirB.png', skyVisibility: 'sky.png', uvSet: 1, charts: 'site', rects: { ground: [CHART[2], CHART[3], CHART[0], CHART[1]] } }],
};
writeFileSync(join(OUT, 'fixture.json'), `${JSON.stringify(meta, null, 1)}\n`);
console.log(`peak ${r(peak)} lux, open ${open.map(r).join(', ')}; ${samples} samples a texel, into ${OUT}`);

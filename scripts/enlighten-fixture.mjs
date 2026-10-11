#!/usr/bin/env node
// Writes the lit fixture's Enlighten stand-in (GPU-first lane N3) into
// src/runtime/fixtures/enlighten/: irradiance.png, dirR.png, dirG.png,
// dirB.png, sky.png and fixture.json. The gather is scripts/lib/enlighten-fixture.mjs
// (pure, tested); what it is and is not is said there and in fixture.json.
//
//   node scripts/enlighten-fixture.mjs [--samples 128]
//
// The irradiance is HDR in the record's units; an 8-bit PNG holds it as
// sqrt(E / peak) a channel (fixture.json's `peak` and `encoding`), which the
// fixture's loader (src/runtime/fixtures/lightN3.js) decodes to half floats.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readEntry, sunDir } from '../src/lib/three/light/entry.js';
import { CHART, GROUND, SAMPLES, SIZE, SPAN, STONE, SUN_SCALE, fixtureScene, gatherTexel, openIrradiance, texelToWorld } from './lib/enlighten-fixture.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'src/runtime/fixtures/enlighten');
const argv = process.argv.slice(2);
const samples = argv.includes('--samples') ? Number(argv[argv.indexOf('--samples') + 1]) : SAMPLES;
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

const n = SIZE * SIZE;
const irr = new Float32Array(n * 3);
const dirs = [0, 1, 2].map(() => Buffer.alloc(n * 4));
const vis = Buffer.alloc(n);
for (let j = 0; j < SIZE; j++) {
  for (let i = 0; i < SIZE; i++) {
    const [x, z] = texelToWorld(i, j);
    const t = gatherTexel(x, z, scene, sky, sun, samples, { open, vertical });
    const k = j * SIZE + i;
    irr.set(t.irr, k * 3);
    for (let c = 0; c < 3; c++) for (let q = 0; q < 4; q++) dirs[c][k * 4 + q] = Math.round(Math.min(1, Math.max(0, t.dirs[c][q])) * 255);
    vis[k] = Math.round(t.sky * 255);
  }
}
const peak = irr.reduce((a, v) => Math.max(a, v), 0);
const rgb = Buffer.alloc(n * 3);
for (let k = 0; k < n * 3; k++) rgb[k] = Math.round(Math.sqrt(irr[k] / peak) * 255);

mkdirSync(OUT, { recursive: true });
const png = (buf, channels, file) => sharp(buf, { raw: { width: SIZE, height: SIZE, channels } }).png({ compressionLevel: 9 }).toFile(join(OUT, file));
await png(rgb, 3, 'irradiance.png');
for (const [c, name] of ['dirR', 'dirG', 'dirB'].entries()) await png(dirs[c], 4, `${name}.png`);
await png(vis, 1, 'sky.png');
const r = (v) => Math.round(v * 1000) / 1000;
const meta = {
  _source:
    "scripts/enlighten-fixture.mjs: a stand-in, not the game's bake. Hoth Sunny's probe radiances (src/data/bf2017/light/hoth.json weathers.sunny.probe) for the sky's shape and tint, its level the site's calibrated sky (skyLevel), and the record's sun (lux, az, el) gathered over the lit fixture's ground and ring (litWorld.js), the occluders' bounce at the stone's albedo and the record's SunScale; irradiance in the record's units (lux), sqrt(E / peak) in 8 bits",
  size: SIZE,
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
  rows: [{ set: 'fixture_hoth_sunny', variant: 'Sunny', size: [SIZE, SIZE], irradiance: 'irradiance.png', dirR: 'dirR.png', dirG: 'dirG.png', dirB: 'dirB.png', skyVisibility: 'sky.png', uvSet: 1, charts: { ground: CHART } }],
};
writeFileSync(join(OUT, 'fixture.json'), `${JSON.stringify(meta, null, 1)}\n`);
console.log(`peak ${r(peak)} lux, open ${open.map(r).join(', ')}; ${samples} samples a texel, into ${OUT}`);

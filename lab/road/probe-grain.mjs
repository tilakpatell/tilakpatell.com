// The grain, measured. A place opened, the walk stopped, the camera
// settled; FRAMES pictures RATE ms apart; each pixel's change from frame to
// frame, averaged (what flickers while nothing walks: AO noise, shadow
// dither, blades and leaves aliasing, the sky's stars); a heat map of it,
// the mean, and the share of pixels over a threshold, by region.
//   node lab/road/probe-grain.mjs stage:metres out [quality]
// (GPU=webgpu draws it on the owner's backend, common.mjs; SETTLE=45000 there, as software
// WebGPU takes long to build the pipelines; EXTRA=&traa=off and the like, TAG=name for the files)
import { createRequire } from 'node:module';
import { browser, open } from './common.mjs';
const sharp = createRequire(import.meta.url)('sharp');
const at = process.argv[2] ?? 'hobbiton:40';
const out = process.argv[3] ?? '/tmp';
const quality = process.argv[4] ?? 'high';
const FRAMES = Number(process.env.FRAMES ?? 6);
const RATE = Number(process.env.RATE ?? 400);
const b = await browser();
// (EXTRA=&traa=off, and so on: more of the page's development switches)
const { page, errors } = await open(b, `/middle-earth/road?at=${at}${process.env.EXTRA ?? ''}`, { quality });
await page.evaluate(() => window.__ROAD__.world.setAuto(false));
await page.waitForFunction(() => { const sc = window.__ROAD__.world.scene; return !sc.children.some((c) => /^road:/.test(c.name) && c.children.length === 0 && c.type === 'Group'); }, null, { timeout: 240000, polling: 1000 }).catch(() => {});
await page.waitForTimeout(Number(process.env.SETTLE ?? 8000));
const shots = [];
for (let i = 0; i < FRAMES; i++) {
  shots.push(await page.screenshot({ timeout: 240000 }));
  await page.waitForTimeout(RATE);
}
const raws = await Promise.all(shots.map((s) => sharp(s).removeAlpha().raw().toBuffer({ resolveWithObject: true })));
const { width: w, height: h } = raws[0].info;
const heat = new Float32Array(w * h);
for (let k = 1; k < raws.length; k++) {
  const a = raws[k - 1].data;
  const c = raws[k].data;
  for (let i = 0; i < w * h; i++) heat[i] += (Math.abs(a[i * 3] - c[i * 3]) + Math.abs(a[i * 3 + 1] - c[i * 3 + 1]) + Math.abs(a[i * 3 + 2] - c[i * 3 + 2])) / 3;
}
for (let i = 0; i < heat.length; i++) heat[i] /= raws.length - 1;
// (the HUD's top 80 px and its foot left out)
const y0 = 80;
const y1 = Math.round(h * 0.86);
let sum = 0;
let n = 0;
let hot = 0;
const bands = { top: [0, 0], mid: [0, 0], low: [0, 0] };
for (let y = y0; y < y1; y++)
  for (let x = 0; x < w; x++) {
    const v = heat[y * w + x];
    sum += v;
    n++;
    if (v > 6) hot++;
    const band = y < y0 + (y1 - y0) / 3 ? 'top' : y < y0 + (2 * (y1 - y0)) / 3 ? 'mid' : 'low';
    bands[band][0] += v;
    bands[band][1]++;
  }
const png = Buffer.alloc(w * h * 3);
for (let i = 0; i < w * h; i++) {
  const v = Math.min(255, heat[i] * 12);
  png[i * 3] = v;
  png[i * 3 + 1] = v * 0.4;
  png[i * 3 + 2] = 255 - v;
}
const name = `${at.replace(':', '-')}-${quality}-${process.env.GPU ?? 'webgl'}${process.env.TAG ? `-${process.env.TAG}` : ''}`;
await sharp(png, { raw: { width: w, height: h, channels: 3 } }).png().toFile(`${out}/grain-${name}.png`);
await sharp(shots[0]).toFile(`${out}/frame-${name}.png`);
const backend = await page.evaluate(() => window.__RUNTIME__?.gfx?.backend ?? null);
console.log(JSON.stringify({ at, quality, mean: +(sum / n).toFixed(2), hot: +((hot / n) * 100).toFixed(2), bands: Object.fromEntries(Object.entries(bands).map(([k, [s, c]]) => [k, +(s / c).toFixed(2)])), backend, errors: errors.slice(0, 2) }));
await b.close();

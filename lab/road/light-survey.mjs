// The Road's light, surveyed: one page, every stage at a few points along it
// (`at` its fractions), the walk stopped there and the picture measured once
// the stage stands: its luma (sRGB, Rec. 709) mean, 5th, 50th and 95th
// percentiles, the share clipped white (≥ 250) and crushed black (≤ 6), and
// its saturation. Over the world's picture only: the header and the ribbon
// left out. Each frame kept, and contact sheets of them, sixteen a sheet.
//   node lab/road/light-survey.mjs out [stage …]   (AT=0.15,0.5,0.85; WAIT=s a point, 25)
// (GPU=webgpu for the owner's backend, VIEW=960x600 by default here)
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { browser, open, STAGE_IDS } from './common.mjs';

const sharp = createRequire(import.meta.url)('sharp');
process.env.VIEW ??= '960x600';
const out = process.argv[2] ?? '/tmp/light';
const ids = process.argv.slice(3).length ? process.argv.slice(3) : STAGE_IDS;
const AT = (process.env.AT ?? '0.15,0.5,0.85').split(',').map(Number);
const WAIT = Number(process.env.WAIT ?? 25) * 1000;
mkdirSync(out, { recursive: true });

const b = await browser();
const { page, errors } = await open(b, `/middle-earth/road?at=${ids[0]}:10`);
// (the veil over the Road's first words lifts only as it walks: let it, then stop the walk)
await page.waitForTimeout(20000);
await page.evaluate(() => window.__ROAD__.world.setAuto(false));
const lengths = await page.evaluate(async () => {
  const { STAGES } = await import('/src/components/middleearth/road/stages/index.js');
  return Object.fromEntries(STAGES.map((s) => [s.id, s.length]));
});

const measure = async (png) => {
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const y0 = Math.round(h * 0.13);
  const y1 = Math.round(h * 0.8);
  const lum = [];
  let sat = 0;
  for (let y = y0; y < y1; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 3;
      const [r, g, bl] = [data[i], data[i + 1], data[i + 2]];
      lum.push(0.2126 * r + 0.7152 * g + 0.0722 * bl);
      const mx = Math.max(r, g, bl);
      sat += mx ? (mx - Math.min(r, g, bl)) / mx : 0;
    }
  const n = lum.length;
  const sorted = Float32Array.from(lum).sort();
  const pct = (p) => Math.round(sorted[Math.floor(p * (n - 1))]);
  const mean = lum.reduce((a, v) => a + v, 0) / n;
  return { mean: Math.round(mean), p5: pct(0.05), p50: pct(0.5), p95: pct(0.95), clip: +((lum.filter((v) => v >= 250).length / n) * 100).toFixed(1), crush: +((lum.filter((v) => v <= 6).length / n) * 100).toFixed(1), sat: +(sat / n).toFixed(2) };
};

const rows = [];
const frames = [];
for (const id of ids) {
  for (const f of AT) {
    const metres = Math.round((lengths[id] ?? 100) * f);
    await page.evaluate(
      async ([id, metres]) => {
        const { sOf } = await import('/src/components/middleearth/road/line.js');
        const { STAGES } = await import('/src/components/middleearth/road/stages/index.js');
        window.__ROAD__.world.set(sOf(STAGES, id, metres));
      },
      [id, metres],
    );
    await page.waitForTimeout(WAIT);
    const png = await page.screenshot({ timeout: 300000 });
    const name = `${id}-${metres}`;
    await sharp(png).webp({ quality: 78 }).toFile(`${out}/${name}.webp`);
    frames.push({ name, png });
    const { calls, triangles } = await page.evaluate(() => window.__ROAD__.info());
    const row = { at: `${id}:${metres}`, ...(await measure(png)), calls, triangles };
    rows.push(row);
    console.log(JSON.stringify(row));
  }
}
writeFileSync(`${out}/survey.json`, JSON.stringify(rows, null, 1));

// the contact sheets: sixteen frames a sheet, four across, each named
const W = 480;
const H = 300;
for (let s = 0; s * 16 < frames.length; s++) {
  const some = frames.slice(s * 16, s * 16 + 16);
  const tiles = await Promise.all(
    some.map(async ({ name, png }, i) => {
      const label = Buffer.from(`<svg width="${W}" height="22"><rect width="${W}" height="22" fill="black" opacity="0.6"/><text x="6" y="16" font-size="15" font-family="sans-serif" fill="white">${name}</text></svg>`);
      const tile = await sharp(png).resize(W, H).composite([{ input: label, top: 0, left: 0 }]).png().toBuffer();
      return { input: tile, left: (i % 4) * W, top: Math.floor(i / 4) * H };
    }),
  );
  await sharp({ create: { width: W * 4, height: H * Math.ceil(some.length / 4), channels: 3, background: '#000' } }).composite(tiles).webp({ quality: 80 }).toFile(`${out}/sheet-${s + 1}.webp`);
}
console.log('errors', errors.slice(0, 3));
await b.close();

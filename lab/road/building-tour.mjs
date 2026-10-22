// The stages' buildings, looked at close: for each, the ride put on its
// stage near it (so its stage is the one drawn and lit) and the camera held
// at a place of its own, looking at it (heights over the land under each
// point), the frame kept once it stands, and contact sheets of them. What
// the stages build for themselves (stages/parts.js, in the site's photo
// scans: partsWear.js) and what they take from their chapters, both.
//   node lab/road/building-tour.mjs out [name …]   (WAIT=s a view, 25)
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { browser, open } from './common.mjs';

const sharp = createRequire(import.meta.url)('sharp');
process.env.VIEW ??= '960x600';
const out = process.argv[2] ?? '/tmp/buildings';
const WAIT = Number(process.env.WAIT ?? 25) * 1000;
// name, stage, the ride's metres, the camera [x, over the land, z], where it looks [x, over the land, z]
const VIEWS = [
  ['hobbiton-dragon', 'hobbiton', 140, [-4, 2.2, 142], [-17, 2.5, 152]],
  ['hobbiton-pavilion', 'hobbiton', 140, [6, 2.2, 140], [21, 2.5, 146]],
  ['bree-gate', 'bree', 8, [1.5, 1.8, 10], [0, 3, 22]],
  ['bree-pony', 'bree', 80, [3.5, 2, 84], [-7, 3.5, 93]],
  ['weathertop-ring', 'weathertop', 105, [-9, 3, 108], [2.2, 3, 122]],
  ['ford-bridge', 'ford', 36, [-9, 2.5, 38], [0, 1, 52]],
  ['ford-bridge-deck', 'ford', 25, [0.6, 2.2, 38], [0, 1.4, 60]],
  ['rivendell-bridge', 'rivendell', 40, [5, 2, 40], [0, 1.2, 50]],
  ['rivendell-council', 'rivendell', 76, [3, 4, 76], [-9, 1, 86]],
  ['rivendell-arch', 'rivendell', 132, [1.2, 1.8, 133], [0, 3, 145]],
  ['caradhras-doors', 'caradhras', 128, [0, 2, 128], [0, 4, 150]],
  ['moria-chamber', 'moria', 24, [-2, 1.8, 24], [-14, 1.6, 24]],
  ['moria-hall', 'moria', 44, [0, 2.5, 42], [4.5, 7, 60]],
  ['moria-bridge', 'moria', 120, [2.6, 1.6, 127], [0, 1, 100]],
  ['lorien-dais', 'lorien', 66, [4, 2.5, 66], [-9, 9, 80]],
  ['lorien-mirror', 'lorien', 96, [2, 2.2, 97], [-6, 0.6, 103]],
  ['anduin-argonath', 'anduin', 40, [0, 3, 40], [0, 18, 72]],
  ['anduin-seat', 'anduin', 108, [3, 2.5, 108], [-7, 4, 118]],
  ['ithilien-henneth', 'ithilien', 62, [0, 2, 64], [-9, 3, 70.5]],
  ['ithilien-king', 'ithilien', 84, [3, 2, 85], [-6, 3, 92]],
  ['ithilien-king-lane', 'ithilien', 70, [0, 1.7, 84], [-6, 3.5, 92]],
  ['ithilien-morgul', 'ithilien', 100, [0, 2, 108], [150, 20, 166]],
  ['rivendell-narsil', 'rivendell', 90, [-3, 1.8, 100], [-9.5, 1.4, 103.5]],
  ['rivendell-bilbo', 'rivendell', 100, [2.2, 1.6, 123.5], [6, 1.1, 119.2]],
  ['anduin-seat-west', 'anduin', 100, [-4.6, 4.6, 118.8], [-62, 38, 120]],
  ['marshes-gate', 'marshes', 140, [0, 3, 150], [118, 20, 176]],
  ['cirith-tower', 'cirith-ungol', 112, [0, 2, 112], [22, 14, 124]],
  ['cirith-gate', 'cirith-ungol', 124, [0, 1.8, 126], [0, 3, 134]],
  ['minas-tirith-gate', 'minas-tirith', 60, null, null],
  ['havens-quay', 'havens', 40, [6, 2.5, 40], [-2, 1, 56]],
  ['shire-edge-ferry', 'shire-edge', 116, [6, 2, 118], [0, 0.6, 130]],
];
const pick = process.argv.slice(3);
const views = pick.length ? VIEWS.filter(([n]) => pick.includes(n)) : VIEWS;
mkdirSync(out, { recursive: true });

const b = await browser();
const { page, errors } = await open(b, `/middle-earth/road?at=${views[0][1]}:${views[0][2]}`);
await page.waitForTimeout(20000);
await page.evaluate(() => window.__ROAD__.world.setAuto(false));
const frames = [];
for (const [name, id, m, cam, look] of views) {
  // (a page that reloaded, its context lost under a software GPU, waited for and its walk stopped again)
  await page.waitForFunction(() => window.__ROAD__?.world, null, { timeout: 120000 });
  await page.evaluate(() => window.__ROAD__.world.setAuto(false));
  await page.evaluate(
    async ([id, m, cam, look]) => {
      const { sOf } = await import('/src/components/middleearth/road/line.js');
      const { STAGES } = await import('/src/components/middleearth/road/stages/index.js');
      const w = window.__ROAD__.world;
      w.scene.onBeforeRender = null;
      w.set(sOf(STAGES, id, m));
      // (no camera given: the Road's own, at that place)
      if (!cam) return;
      const passes = typeof window.__ROAD__.passes === 'function' ? window.__ROAD__.passes() : window.__ROAD__.passes;
      const c = passes.find((p) => p.kind === 'render').camera;
      const land = window.__ROAD__.land();
      const at = (p) => [p[0], p[1] + (land?.field(p[0], p[2]) ?? 0), p[2]];
      w.scene.onBeforeRender = () => {
        const [x, y, z] = at(cam);
        c.position.set(x, y, z);
        c.lookAt(...at(look));
        c.updateMatrixWorld();
      };
    },
    [id, m, cam, look],
  );
  await page.waitForTimeout(WAIT);
  const png = await page.screenshot({ timeout: 300000 });
  await sharp(png).webp({ quality: 80 }).toFile(`${out}/${name}.webp`);
  frames.push({ name, png });
  console.log(name);
}
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
  await sharp({ create: { width: W * 4, height: H * Math.ceil(some.length / 4), channels: 3, background: '#000' } }).composite(tiles).webp({ quality: 82 }).toFile(`${out}/sheet-${s + 1}.webp`);
}
console.log('errors', errors.slice(0, 3));
await b.close();

// The Road's pictures, each stage on a desktop (1440 × 900, kept at 960 ×
// 600) and a phone (390 × 844), into docs/superpowers/evidence/the-road/
// shots/<stage>-desktop.webp and -phone.webp: the stage opened by its
// address, the road walking itself for a few seconds first. Development
// only, as measure.mjs.
//
//   node lab/road/shots.mjs [stage | stage:metres | stage:metres:beat@seconds ...] [--phone | --desktop]
//   (a stage:metres is opened there and named <stage>-<metres>; with a
//   beat@seconds the picture waits until that beat has played that long;
//   WAIT=s for the seconds before the picture otherwise, OUT=dir to put them elsewhere)
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { browser, open, STAGE_IDS } from './common.mjs';

const sharp = createRequire(import.meta.url)('sharp');
const OUT = process.env.OUT ? `${process.env.OUT.replace(/\/$/, '')}/` : fileURLToPath(new URL('../../docs/superpowers/evidence/the-road/shots/', import.meta.url));
const WAIT = Number(process.env.WAIT ?? 5) * 1000;
mkdirSync(OUT, { recursive: true });
const argv = process.argv.slice(2);
const picked = argv.filter((a) => !a.startsWith('--'));
const ids = picked.length ? picked : STAGE_IDS;
const kinds = argv.includes('--phone') ? ['phone'] : argv.includes('--desktop') ? ['desktop'] : ['desktop', 'phone'];
const b = await browser();
for (const pick of ids) {
  const [id, metres, when] = pick.split(':');
  const [beat, secs] = when ? when.split('@') : [];
  const name = beat ? `${id}-${beat}-${secs}` : metres ? `${id}-${metres}` : id;
  for (const kind of kinds) {
    const { ctx, page, errors } = await open(b, `/middle-earth/road?at=${id}:${metres ?? 20}`, { phone: kind === 'phone' });
    // (sped up to the beat: the container’s software frames are slow; then back to one to one for the picture)
    if (beat) {
      await page.evaluate(() => window.__ROAD__.fast?.(6));
      await page.waitForFunction(([b, t]) => (window.__ROAD__.info().since?.[b] ?? -1) >= t, [beat, Number(secs)], { timeout: 600000, polling: 100 });
      await page.evaluate(() => window.__ROAD__.fast?.(0));
    }
    else await page.waitForTimeout(WAIT);
    const png = await page.screenshot({ type: 'png', timeout: 120000 });
    const img = kind === 'desktop' ? sharp(png).resize(960, 600) : sharp(png);
    await img.webp({ quality: 72 }).toFile(`${OUT}${name}-${kind}.webp`);
    console.log(`${name}-${kind}.webp${errors.length ? ` (${errors.length} page errors: ${errors[0]})` : ''}`);
    await ctx.close();
  }
}
await b.close();

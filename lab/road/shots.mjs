// The Road's pictures, each stage on a desktop (1440 × 900, kept at 960 ×
// 600) and a phone (390 × 844), into docs/superpowers/evidence/the-road/
// shots/<stage>-desktop.webp and -phone.webp: the stage opened by its
// address, the road walking itself for a few seconds first. Development
// only, as measure.mjs.
//
//   node lab/road/shots.mjs [stage ...] [--phone | --desktop]
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { browser, open, STAGE_IDS } from './common.mjs';

const sharp = createRequire(import.meta.url)('sharp');
const OUT = fileURLToPath(new URL('../../docs/superpowers/evidence/the-road/shots/', import.meta.url));
mkdirSync(OUT, { recursive: true });
const argv = process.argv.slice(2);
const picked = argv.filter((a) => !a.startsWith('--'));
const ids = picked.length ? picked : STAGE_IDS;
const kinds = argv.includes('--phone') ? ['phone'] : argv.includes('--desktop') ? ['desktop'] : ['desktop', 'phone'];
const b = await browser();
for (const id of ids) {
  for (const kind of kinds) {
    const { ctx, page, errors } = await open(b, `/middle-earth/road?at=${id}:20`, { phone: kind === 'phone' });
    await page.waitForTimeout(5000);
    const png = await page.screenshot({ type: 'png' });
    const img = kind === 'desktop' ? sharp(png).resize(960, 600) : sharp(png);
    await img.webp({ quality: 72 }).toFile(`${OUT}${id}-${kind}.webp`);
    console.log(`${id}-${kind}.webp${errors.length ? ` (${errors.length} page errors: ${errors[0]})` : ''}`);
    await ctx.close();
  }
}
await b.close();

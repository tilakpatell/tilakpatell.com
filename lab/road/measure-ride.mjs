// The whole Road's download (the design's ≤ 45 MB, and WORLD_MB's number):
// one window, as a visitor's, opened at Bag End and carried stage by stage
// to the Havens, each stage held until its land is built and its walkers
// are in, every asset counted once (the browser's cache keeps a second
// fetch off the wire). The boot slice is what the first stage fetched.
// Development only: a dev server up (BASE).
//
//   node lab/road/measure-ride.mjs   (QUALITY=low|high, HOLD=s a stage)
import { browser, open, STAGE_IDS } from './common.mjs';

const hold = Number(process.env.HOLD ?? 8) * 1000;
const b = await browser();
const seen = new Set();
let bytes = 0;
const count = (page) =>
  page.on('response', async (r) => {
    const { pathname } = new URL(r.url());
    if (!/\/(models|textures|audio|cc0|kit|hdri)\//.test(pathname) || seen.has(pathname)) return;
    seen.add(pathname);
    const body = await r.body().catch(() => null);
    if (body) bytes += body.length;
  });
const { ctx, page } = await open(b, `/middle-earth/road?at=${STAGE_IDS[0]}`, { onPage: count });
await page.waitForTimeout(hold);
const boot = bytes;
console.log(`| ${STAGE_IDS[0]} | ${(boot / 1e6).toFixed(1)} | ${(boot / 1e6).toFixed(1)} |`);
for (const id of STAGE_IDS.slice(1)) {
  const before = bytes;
  await page.evaluate((id) => {
    location.hash = `#/middle-earth/road?at=${id}`;
  }, id);
  await page.waitForFunction(() => window.__ROAD__ && window.__RUNTIME__?.status === 'on', null, { timeout: 240000 });
  await page.waitForTimeout(hold);
  console.log(`| ${id} | ${((bytes - before) / 1e6).toFixed(1)} | ${(bytes / 1e6).toFixed(1)} |`);
}
console.log(`boot ${(boot / 1e6).toFixed(1)} MB, the whole ride ${(bytes / 1e6).toFixed(1)} MB, each file once`);
await ctx.close();
await b.close();

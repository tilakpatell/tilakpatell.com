// The Road measured stage by stage (docs/superpowers/evidence/the-road/
// README.md's table): each stage opened by its address in a fresh window,
// the walkers given 6 s to arrive, then the last frame's draws and
// triangles (window.__ROAD__.info()), the assets the page fetched (every
// response under /models, /textures, /audio and the like: the stage's
// download from cold, the code left out), and the share of the window the Road's own UI
// covers. Development only: a dev server up (BASE), the browser the
// container's software GL unless CHROME says.
//
//   node lab/road/measure.mjs [stage ...]   (all sixteen with none named)
import { browser, open, STAGE_IDS } from './common.mjs';

const picked = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const ids = picked.length ? picked : STAGE_IDS;
const b = await browser();
const rows = [];
for (const id of ids) {
  const { ctx, page, errors, assets } = await open(b, `/middle-earth/road?at=${id}`);
  await page.waitForTimeout(6000);
  const row = await page.evaluate(() => {
    const info = window.__ROAD__.info();
    const W = innerWidth * innerHeight;
    const share = ['.road-ribbon', '.hud-prompt', '.road-lore', '.road-title', '.road-brand', '.hud-menu']
      .flatMap((sel) => [...document.querySelectorAll(sel)])
      .reduce((a, el) => {
        const r = el.getBoundingClientRect();
        return a + Math.max(0, r.width) * Math.max(0, r.height);
      }, 0);
    return { ...info, ui: share / W };
  });
  row.mb = assets.bytes / 1e6;
  rows.push({ id, ...row, errors: errors.length });
  console.log(`| ${id} | ${row.calls} | ${row.triangles.toLocaleString('en-GB')} | ${row.walkers} | ${row.mb.toFixed(1)} | ${(row.ui * 100).toFixed(1)} % | ${errors.length} |`);
  await ctx.close();
}
await b.close();

/* global window */
// A browser check of the planet landings (universe/landings/). With the dev
// server up (npx vite --port 5173, or PORT=5188 for another):
//   OUT=/tmp/shots node scripts/landing-check.mjs [planet ...] [--ship falcon] [--phone] [--spot lat,lon --name shire --look orodruin]
// For each planet it puts the ship just off it, sets it down there (the dev
// hook's startFoot(), no flight in: scripts/entry-check.mjs flies in), waits for the
// crew to be out, and takes screenshots: coming down, out on the ground,
// and looking round. It prints the draw calls and triangles down there, and
// any errors. --spot forces where it comes down (footScene.js's DEV ?spot=,
// degrees on the planet's own map: landings/biomes.js), and it says which
// biome that was; --name tags the screenshots; --look orodruin turns to face
// a thing by its name for a shot of its own. Headless Chromium draws in
// software, slowly: the waits are long.
// --surface [hoth …] times a galaxy world's landing instead: scripts/lib/landing-surface.mjs.
import { chromium } from 'playwright-core';

const args = process.argv.slice(2);
if (args[0] === '--surface') {
  const { run } = await import('./lib/landing-surface.mjs');
  process.exit(await run(args.slice(1)));
}
const flag = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 ? args.splice(i, 2)[1] : dflt;
};
const ship = flag('--ship', 'falcon');
const spot = flag('--spot', null);
const tag = flag('--name', spot ? spot.replace(',', '_') : null);
const look = flag('--look', null);
// how long the crew get to walk out (WALK_MS: software GL in a container wants several minutes)
const WALK_MS = Number(process.env.WALK_MS ?? 120000);
const phone = args.includes('--phone') ? (args.splice(args.indexOf('--phone'), 1), true) : false;
const out = process.env.OUT ?? '.';
const planets = args.length ? args : ['middleearth', 'breakingbad', 'rickmorty'];
const URL = `http://localhost:${process.env.PORT ?? 5173}/?quality=${phone ? 'low' : 'mid'}${spot ? `&spot=${spot}` : ''}#/universe`;
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const errors = [];
const viewport = phone ? { width: 390, height: 844 } : { width: 1280, height: 800 };
const ctx = await browser.newContext({ viewport, hasTouch: phone });
await ctx.addInitScript((s) => {
  window.localStorage.setItem('tp-intro', '1');
  window.localStorage.setItem('tp-start', '"universe"');
  window.localStorage.setItem('tp-universe-ship', JSON.stringify(s));
}, ship);
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errors.push(`${m.type()}: ${m.text()}`));
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof window.__universe === 'function' && window.__universe().ship, null, { timeout: 180000 });
await page.waitForTimeout(3000);
const shot = (name) => page.screenshot({ path: `${out}/${tag ? name.replace(/^([a-z0-9]+)-/, `$1-${tag}-`) : name}.png`, timeout: 180000 });

for (const id of planets) {
  // just off the planet, on its sunny side, still
  const ok = await page.evaluate((id) => {
    const d = window.__universeDebug;
    const p = d.planets.find((x) => x.id === id);
    if (!p) return false;
    const c = p.group.position;
    const r = p.radius ?? 18;
    const s = d.state.ship;
    d.state.ship = { ...s, x: c.x + r * 1.25, y: c.y + r * 0.3, z: c.z + r * 0.25, speed: 0, vy: 0 };
    return true;
  }, id);
  if (!ok) {
    console.log('FAIL', id, 'no such planet');
    continue;
  }
  await page.waitForTimeout(2500);
  const landed = await page.evaluate(() => window.__universeDebug.startFoot());
  console.log(landed ? 'ok  ' : 'FAIL', id, 'landing');
  const card = await page.waitForSelector('.universe-arrive-title', { timeout: 15000 }).then((el) => el.textContent(), () => null);
  console.log(card ? 'ok  ' : 'FAIL', id, `title card: ${card}`);
  console.log('    ', id, 'biome:', JSON.stringify(await page.evaluate(() => window.__universeDebug.foot.biome)));
  await page.waitForTimeout(2500);
  await shot(`${id}-1-down`);
  await page.waitForFunction(() => window.__universeDebug.foot.phase === 'walk', null, { timeout: WALK_MS, polling: 500 }).catch(async () => console.log('FAIL', id, 'crew never out:', await page.evaluate(() => window.__universeDebug.foot.phase)));
  await page.waitForTimeout(6000);
  await shot(`${id}-2-out`);
  const info = await page.evaluate(() => window.__universe());
  console.log(`     ${id}: ${info.calls} calls, ${Math.round(info.triangles / 1000)}k triangles`);
  // --look <name>: turned to face a thing on the skyline (its object's name, as furnish builds it)
  if (look) {
    for (let i = 0; i < 4; i++) {
      const ang = await page.evaluate((name) => {
        const d = window.__universeDebug;
        const T = d.THREE;
        let thing = null;
        d.scene.traverse((o) => (thing ??= o.name === name ? o : null));
        if (!thing) return null;
        const cam = d.camera;
        const up = cam.up.clone();
        const flat = (v) => v.sub(up.clone().multiplyScalar(v.dot(up))).normalize();
        const f = flat(cam.getWorldDirection(new T.Vector3()));
        const h = flat(thing.getWorldPosition(new T.Vector3()).sub(cam.position));
        return (Math.atan2(f.clone().cross(h).dot(up), f.dot(h)) * 180) / Math.PI;
      }, look);
      if (ang === null || Math.abs(ang) < 3) break;
      await page.evaluate((a) => window.__universeDebug.foot.look(a, 0), ang);
      await page.waitForTimeout(1500);
    }
    await page.waitForTimeout(1500);
    await shot(`${id}-2-${look}`);
  }
  // look round: turn on the spot a third, twice
  for (const k of [1, 2]) {
    await page.evaluate(() => window.__universeDebug.foot.look(330, 0));
    await page.waitForTimeout(2500);
    await shot(`${id}-${2 + k}-round`);
  }
  // back in and up
  await page.evaluate(() => {
    const f = window.__universeDebug.foot;
    f.end();
  });
  await page.waitForTimeout(1500);
}
console.log(errors.length ? `${errors.length} errors/warnings:\n${[...new Set(errors)].slice(0, 30).join('\n')}` : 'no errors');
await browser.close();

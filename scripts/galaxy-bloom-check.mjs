/* global window, document */
// A browser check of the galaxy's bloom in a battle (galaxy/look.js's bloom,
// universe/post.js's soft knee, battleFx.js's GLOW). With the dev server up
// (npx vite --port 5188):
//   OUT=/tmp/shots node scripts/galaxy-bloom-check.mjs [quality]
// It swears to the Rebellion, forces a battle at Endor, lets it run 20 s,
// and looks at it from three places (a panorama from behind the Rebel line,
// beside the defending flagship, in the middle of the dogfight). Each view
// is drawn and read straight off the WebGL canvas (no HUD on it), once as
// the galaxy draws it and once with the bloom at nothing, and measured:
//   darkHalf: the mean luma of the darkest half of the pixels (a veil
//     lifts it: with the map's bloom it was 0.09–0.15 in the dogfight, 0
//     with none);
//   over09: the share of pixels over 0.9 luma (blown out).
// It fails if the dogfight's darkHalf is over 0.03 (with the galaxy's own
// bloom it measured 0.022: the halos of the bolts nearest the camera, which
// fill much of that view), or any view's over09 is over 0.5%. The shots are
// bloom-<view>-<on|off>.png in OUT, the numbers bloom-numbers.json.
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';

const out = process.env.OUT ?? '.';
const quality = process.argv[2] ?? 'high';
const base = process.env.BASE ?? 'http://localhost:5188';
const chrome = process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const LIMIT = { darkHalf: 0.03, over09: 0.005 };
mkdirSync(out, { recursive: true });
const problems = [];
const check = (ok, what) => {
  console.log(ok ? 'ok  ' : 'FAIL', what);
  if (!ok) problems.push(what);
};
const browser = await chromium.launch({ executablePath: chrome, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 760 } });
await ctx.addInitScript(() => {
  window.localStorage.setItem('tp-intro', '1');
  window.localStorage.setItem('tp-start', '"universe"');
  window.localStorage.setItem('tp-universe-ship', JSON.stringify('xwing'));
  window.localStorage.setItem('tp-galaxy-panel', JSON.stringify('tucked'));
  window.localStorage.removeItem('tp-gcw');
  window.sessionStorage.setItem('tp-galaxy-intro', '1');
  window.localStorage.setItem('tp-worlds', JSON.stringify('load')); // (the 3D, without the gate's asking)
  window.localStorage.setItem('tp-software', JSON.stringify('on')); // (past the Star Wars worlds' GPU gate, lib/fit: a software GL is the point here)
});
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('pageerror', String(e).slice(0, 200)));
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s]`, ...a);

await page.goto(`${base}/?quality=${quality}#/galaxy`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof window.__galaxy === 'function' && Boolean(window.__galaxy().system), null, { timeout: 300000 });
await page.waitForFunction(() => Boolean(window.__galaxyOath), null, { timeout: 60000 });
await page.evaluate(() => window.__galaxyOath.swear('rebel'));
await page.goto(`${base}/?quality=${quality}#/galaxy/endor`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof window.__galaxy === 'function' && window.__galaxy().system === 'endor', null, { timeout: 300000 });
await page.waitForFunction(() => !window.__galaxy().jump, null, { timeout: 120000 }).catch(() => {});
log('at Endor');
await page.evaluate(() => window.__galaxyDebug.war.force('rebel'));
await page.evaluate(() => window.__galaxyDebug.war.skip(20)); // (bolts in flight, fighters in the fight)
log('battle forced');

// where to look from: the pose (galaxy/scene.js's pin) worked out in the page from the battle
const VIEWS = {
  panorama: `
    const b = d.war.battle; const own = b.capitals.find((c) => c.team === 0 && c.role === 'flagship');
    const other = b.capitals.find((c) => c.team === 1 && c.role === 'flagship');
    const dx = other.pos.x - own.pos.x, dz = other.pos.z - own.pos.z; const l = Math.hypot(dx, dz);
    const x = own.pos.x - dx / l * 60, z = own.pos.z - dz / l * 60;
    return { x, y: own.pos.y + 30, z, heading: Math.atan2(-dx, -dz), pitch: -0.2, bank: 0 };`,
  flagship: `
    const b = d.war.battle; const f = b.capitals.find((c) => c.team === b.defender && c.role === 'flagship');
    const s = f.size; const x = f.pos.x - f.fwd.x * s * 0.2 + f.right.x * s * 0.7, z = f.pos.z - f.fwd.z * s * 0.2 + f.right.z * s * 0.7;
    return { x, y: f.pos.y + s * 0.18, z, heading: Math.atan2(x - f.pos.x, z - f.pos.z), pitch: -0.15, bank: 0 };`,
  dogfight: `
    const b = d.war.battle; const c = { x: 0, y: 0, z: 0 }; let n = 0;
    for (const f of b.fighters) if (f.alive) { c.x += f.pos.x; c.y += f.pos.y; c.z += f.pos.z; n++; }
    c.x /= n; c.y /= n; c.z /= n;
    return { x: c.x - 18, y: c.y + 4, z: c.z - 6, heading: Math.atan2(-18, -6), pitch: -0.05, bank: 0 };`,
};

const pin = (fn) =>
  page.evaluate((f) => {
    const d = window.__galaxyDebug;
    const pose = new Function('d', f)(d);
    d.state.safeUntil = 1e12;
    d.state.shield = 100;
    d.pin(pose);
  }, fn);

// draw the frame as it is and with no bloom, read each back, measure
const measure = () =>
  page.evaluate(() => {
    const d = window.__galaxyDebug;
    const post = d.post;
    const gl = d.renderer.domElement;
    const c2 = document.createElement('canvas');
    c2.width = gl.width;
    c2.height = gl.height;
    const g = c2.getContext('2d', { willReadFrequently: true });
    const was = { strength: post.bloom.strength, sharp: post.sharpness };
    post.sharpness = 1;
    const res = {};
    for (const [id, strength] of [
      ['on', was.strength],
      ['off', 0],
    ]) {
      post.bloom.strength = strength;
      post.flare(1);
      post.render(gl.clientWidth, gl.clientHeight);
      g.clearRect(0, 0, c2.width, c2.height);
      g.drawImage(gl, 0, 0);
      const px = g.getImageData(0, 0, c2.width, c2.height).data;
      const n = c2.width * c2.height;
      const L = new Float32Array(n);
      let over9 = 0;
      let sum = 0;
      for (let i = 0; i < n; i++) {
        const l = (0.2126 * px[i * 4] + 0.7152 * px[i * 4 + 1] + 0.0722 * px[i * 4 + 2]) / 255;
        L[i] = l;
        sum += l;
        if (l > 0.9) over9++;
      }
      L.sort();
      let dark = 0;
      for (let i = 0; i < n / 2; i++) dark += L[i];
      res[id] = { size: `${c2.width}x${c2.height}`, mean: sum / n, darkHalf: dark / (n / 2), median: L[Math.floor(n / 2)], over09: over9 / n, png: c2.toDataURL('image/png') };
    }
    post.bloom.strength = was.strength;
    post.flare(1);
    post.sharpness = was.sharp;
    return res;
  });

const numbers = {};
for (const [name, fn] of Object.entries(VIEWS)) {
  await pin(fn);
  await page.waitForTimeout(Number(process.env.SETTLE ?? 6000));
  const m = await measure();
  numbers[name] = {};
  for (const [id, r] of Object.entries(m)) {
    writeFileSync(`${out}/bloom-${name}-${id}.png`, Buffer.from(r.png.split(',')[1], 'base64'));
    delete r.png;
    numbers[name][id] = r;
  }
  log(name, JSON.stringify(numbers[name]));
  check(m.on.over09 <= LIMIT.over09, `${name}: ${(m.on.over09 * 100).toFixed(2)}% of pixels over 0.9 luma (at most ${LIMIT.over09 * 100}%)`);
}
check(numbers.dogfight.on.darkHalf <= LIMIT.darkHalf, `the dogfight's darkest half at a mean luma of ${numbers.dogfight.on.darkHalf.toFixed(4)} (at most ${LIMIT.darkHalf}; ${numbers.dogfight.off.darkHalf.toFixed(4)} with no bloom)`);
writeFileSync(`${out}/bloom-numbers.json`, `${JSON.stringify(numbers, null, 2)}\n`);
await browser.close();
if (problems.length) {
  console.log(`\n${problems.length} problem(s)`);
  process.exit(1);
}
console.log('\nall good');

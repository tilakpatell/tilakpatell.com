/* global window */
// A browser check of lane P4's surfaces on a galaxy world: lands, steps out
// beside the ship, fires a bolt of yours at the snow and one at the ship's
// hull (a box solid: a wall), and records what the world's material grid
// picked for each (window.__surfaceScene.surfaces(): the family, the game's
// effect and decal) and the ground's print, with a screenshot of each
// landing. Lane P1's physics-check.mjs takes these steps in when it lands.
// With the dev server up (npx vite --port 5194):
//   CHROME="C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" node scripts/surfaces-check.mjs hoth
//   OUT=docs/superpowers/evidence/bf2017-physics/p4 BASE=http://127.0.0.1:5194 …
// Exits 1 if the snow is not snow or the wall not metal.

import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [id = 'hoth'] = process.argv.slice(2);
const out = process.env.OUT ?? 'docs/superpowers/evidence/bf2017-physics/p4';
const base = process.env.BASE ?? 'http://127.0.0.1:5194';
const chrome = process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const angle = process.env.ANGLE ?? 'swiftshader'; // (d3d11 on a Windows desktop: its graphics chip)
const want = { snow: 'snow', wall: 'metal' };
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ executablePath: chrome, args: ['--use-gl=angle', `--use-angle=${angle}`, '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => {
  window.localStorage.setItem('tp-intro', '1');
  window.localStorage.setItem('tp-galaxy-panel', JSON.stringify('tucked'));
  window.localStorage.setItem('tp-worlds', JSON.stringify('load')); // (the 3D, without the gate's asking)
  window.localStorage.setItem('tp-software', JSON.stringify('on')); // (past the Star Wars worlds' GPU gate, lib/fit: a software GL is the point here)
});
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(`${base}/?quality=low&calibrate=off#/galaxy/${id}/surface`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => Boolean(window.__surfaceScene?.renderer && window.__surface?.()), null, { timeout: 240000, polling: 1000 });
await page.waitForFunction(() => window.__surfaceScene.surfaces().level !== null, null, { timeout: 120000, polling: 1000 });

// out of the ship, 14 m off its side
const spot = await page.evaluate(() => {
  const s = window.__surfaceScene;
  const [lx, lz] = s.land;
  s.put(lx + 14, lz);
  return { land: [lx, lz], you: [lx + 14, lz] };
});
await page.waitForTimeout(1500);

const shots = {};
const shoot = async (name, from, to, level = false) => {
  const before = await page.evaluate(() => window.__surfaceScene.surfaces().picks.length);
  await page.evaluate(
    ([f, t, flat]) => {
      const s = window.__surfaceScene;
      const up = (p) => [p[0], s.heightAt(p[0], p[2]) + p[1], p[2]];
      s.put(f[0], f[2]);
      s.view([f[0] - (t[0] - f[0]) * 0.4, 2.2, f[2] - (t[2] - f[2]) * 0.4], t);
      // (level: at the shooter's height, across; else at `to`'s height over its own ground)
      s.shoot(up(f), flat ? [t[0], s.heightAt(f[0], f[2]) + f[1], t[2]] : up(t));
    },
    [from, to, level],
  );
  await page.waitForFunction((n) => window.__surfaceScene.surfaces().picks.length > n || window.__surfaceScene.surfaces().picks.length === 8, before, { timeout: 5000, polling: 100 }).catch(() => {});
  await page.waitForTimeout(250);
  const picks = await page.evaluate(() => window.__surfaceScene.surfaces().picks);
  shots[name] = picks.length > before || before === 8 ? picks.at(-1) : null;
  await page.screenshot({ path: join(out, `${id}-${name}.jpg`), type: 'jpeg', quality: 80 });
  await page.evaluate(() => window.__surfaceScene.view(null));
};

const [x, z] = spot.you;
// down at the snow a few metres ahead (heights over the ground at each end)
await shoot('snow', [x, 1.6, z], [x + 5, 0, z + 4]);
// across at a wall: the nearest standing box (no base, no top) to where you landed, from 5 m off its face
const wall = await page.evaluate(([lx, lz]) => {
  const all = window.__surfaceScene.solidsNear(lx, lz, 500).filter((o) => o.type === 'box' && o.base == null && o.top == null && o.hw >= 1.2 && o.hd >= 0.2);
  all.sort((p, q) => Math.hypot(p.x - lx, p.z - lz) - Math.hypot(q.x - lx, q.z - lz));
  return all[0] ?? null;
}, spot.land);
if (wall) {
  const out5 = wall.hd + 5; // (along its local z, off its long face)
  const from = [wall.x + wall.s * out5, 1.2, wall.z + wall.c * out5];
  await shoot('wall', from, [wall.x, 1.2, wall.z], true);
  shots.wallSolid = wall;
}

const surfaces = await page.evaluate(() => window.__surfaceScene.surfaces());
const report = { world: id, level: surfaces.level, print: surfaces.print, spot, shots, errors, ok: shots.snow?.family === want.snow && shots.wall?.family === want.wall };
writeFileSync(join(out, `${id}.json`), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
await browser.close();
process.exit(report.ok ? 0 : 1);

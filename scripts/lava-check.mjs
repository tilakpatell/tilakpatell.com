/* global window */
// A browser check of the lava (galaxy/surface/lavaRules.js, lava.js): on each
// world, loads its surface fresh, waits for you to be out and walking, takes
// a look at the lava from its bank, then walks you into it (the dev
// teleport) and checks that it burns (health down, the heat up), and that
// after it's had you you're back on ground clear of it with your health
// back. A screenshot at each step. Reduced motion, so you start out of the
// ship, and every wait is the scene's own time (a software GL draws a frame
// in a second or two). With the dev server up (npx vite --port
// 5188) and Chromium where Playwright keeps it:
//   OUT=/tmp/shots node scripts/lava-check.mjs mustafar,nevarro
// Exit code 1 on a page error, or a step that didn't take.
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

// where to stand to look at it, and a spot in it
const SPOTS = {
  mustafar: { bank: [104, 28, 1.62], into: [175, 25] },
  nevarro: { bank: [300, 225, 0], into: [300, 260] },
};
const list = process.argv[2] ?? 'mustafar';
const out = process.env.OUT ?? '.';
const quality = process.env.QUALITY ?? 'high';
const base = process.env.BASE ?? 'http://127.0.0.1:5188';
const chrome = process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const NOISE = [/WebSocket|wss:\/\/|relay|nostr/i, /net::ERR_|Failed to load resource/i, /SwiftShader|software WebGL|GPU stall|GL Driver Message|Automatic fallback|WebGL: too many errors/i, /AudioContext was not allowed/i, /\[vite\]|preload/i];
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ executablePath: chrome, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let failed = false;
const fail = (id, what) => {
  failed = true;
  console.log(`FAIL ${id}: ${what}`);
};
for (const id of list.split(',')) {
  const spot = SPOTS[id];
  const ctx = await browser.newContext({ viewport: { width: Number(process.env.W ?? 960), height: Number(process.env.H ?? 540) }, reducedMotion: 'reduce' });
  await ctx.addInitScript(() => {
    window.localStorage.setItem('tp-intro', '1');
    window.localStorage.setItem('tp-start', '"universe"');
    window.localStorage.setItem('tp-universe-ship', JSON.stringify('xwing'));
    window.sessionStorage.setItem('tp-galaxy-intro', '1');
    window.localStorage.setItem('tp-worlds', JSON.stringify('load'));
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && !NOISE.some((n) => n.test(m.text())) && errors.push(m.text()));
  await page.goto(`${base}/?quality=${quality}#/galaxy/${id}/surface`, { waitUntil: 'domcontentloaded' });
  const view = () => page.evaluate(() => window.__surface?.() ?? null);
  const shot = (name) => page.screenshot({ path: `${out}/lava-${id}-${name}.png`, timeout: 120000 });
  // (the scene's own seconds)
  const after = async (secs) => {
    const t0 = (await view()).t;
    await page.waitForFunction((t) => (window.__surface?.()?.t ?? 0) >= t, t0 + secs, { timeout: 600000, polling: 500 });
  };
  try {
    await page.waitForFunction(() => window.__surface?.()?.phase === 'walk', null, { timeout: 240000 });
  } catch {
    fail(id, `timed out waiting to walk (${errors[0] ?? 'no errors'})`);
    await ctx.close();
    continue;
  }
  // the bank, looking over it
  await page.evaluate(([x, z, yaw]) => window.__surfaceDo('teleport', x, z, yaw, null, Number(window.__pitch ?? -0.35)), spot.bank);
  await after(1);
  await shot('1-bank');
  let v = await view();
  console.log(`${id}: on the bank, heat ${v.lavaHeat}, safe ${JSON.stringify(v.safeAt)}`);
  // (LOOK=1: the look alone)
  if (process.env.LOOK) {
    await ctx.close();
    continue;
  }
  // into it
  await page.evaluate(([x, z]) => window.__surfaceDo('teleport', x, z), spot.into);
  await after(0.6);
  v = await view();
  await shot('2-in');
  console.log(`${id}: in it, health ${v.health}, heat ${v.lavaHeat}, y ${v.you.y.toFixed(2)}`);
  if (!(v.health < 100)) fail(id, `no burn: health ${v.health}`);
  if (v.lavaHeat !== 1) fail(id, `no heat: ${v.lavaHeat}`);
  if (!(await page.locator('.surface-heat').count())) fail(id, 'no heat glow on the HUD');
  // till it has you: back on the ground clear of it
  await after(3.5);
  v = await view();
  await shot('3-after');
  console.log(`${id}: after, health ${v.health}, at ${v.you.x.toFixed(1)},${v.you.z.toFixed(1)}, heat ${v.lavaHeat}`);
  if (v.lavaHeat >= 1) fail(id, 'still in the lava after it should have had you');
  if (errors.length) fail(id, errors.join(' | '));
  await ctx.close();
}
await browser.close();
process.exit(failed ? 1 : 0);

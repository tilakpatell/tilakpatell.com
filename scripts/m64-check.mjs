/* global window */
// A browser check of the Mario 64 tribute (src/components/mario64/): with the
// dev server up (npx vite --port 5188 --strictPort --host 127.0.0.1),
//   OUT=/tmp/shots node scripts/m64-check.mjs
// It opens #/dot-matrix/64, waits for the castle grounds, starts, walks,
// visits the castle inside and Bob-omb Ridge, and screenshots each; it
// prints the game's mode, area and Mario's place at each step, and fails on
// any page error. Headless Chromium draws in software: the waits are long.
import { chromium } from 'playwright-core';
import sharp from 'sharp';

const out = process.env.OUT ?? '.';
const base = process.env.BASE ?? 'http://127.0.0.1:5188';
const size = { width: Number(process.env.W ?? 1100), height: Number(process.env.H ?? 700) };
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: 1 });
await ctx.addInitScript(() => {
  window.localStorage.setItem('tp-intro', '1');
  window.localStorage.setItem('tp-worlds', JSON.stringify('load'));
  window.localStorage.setItem('tp-software', JSON.stringify('on')); // (past the Star Wars worlds' GPU gate, lib/fit: a software GL is the point here)
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const world = () => 'window.__RUNTIME__?.current?.module?.id === "mario64" ? window.__RUNTIME__.current.world : null';
const state = (label) =>
  page.evaluate(
    ([label, w]) => {
      const world = eval(w);
      const g = world?.game;
      return { label, status: window.__RUNTIME__?.status, mode: g?.mode, area: g?.areaId, mario: g ? [Math.round(g.mario.pos.x), Math.round(g.mario.pos.y), Math.round(g.mario.pos.z), g.mario.action] : null, actors: g?.actors.length };
    },
    [label, world()],
  );
// the 3D, drawn and read straight off the GL context (a screenshot, or the
// canvas's own toDataURL, of a software-drawn WebGL canvas can come back
// cleared), and the page (the HUD, the menus)
const shot = async (name) => {
  const r = await page.evaluate((w) => {
    const world = eval(w);
    const gl = window.__RUNTIME__?.gfx?.renderer?.getContext();
    if (!world || !gl) return null;
    world.draw();
    const W = gl.drawingBufferWidth;
    const H = gl.drawingBufferHeight;
    const px = new Uint8Array(W * H * 4);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let s = '';
    for (let i = 0; i < px.length; i += 0x8000) s += String.fromCharCode(...px.subarray(i, i + 0x8000));
    return { W, H, data: btoa(s) };
  }, world());
  if (r) await sharp(Buffer.from(r.data, 'base64'), { raw: { width: r.W, height: r.H, channels: 4 } }).flip().removeAlpha().png().toFile(`${out}/m64-${name}-3d.png`);
  await page.screenshot({ path: `${out}/m64-${name}.png`, timeout: 180000 }).catch((e) => console.log('shot failed', name, String(e).slice(0, 120)));
};
const step = async (label) => {
  const s = await state(label);
  console.log(JSON.stringify(s));
  await shot(label);
};
const settle = (ms) => page.waitForTimeout(ms);
const call = (fn, ...args) => page.evaluate(([w, fn, args]) => eval(w)?.debug?.[fn]?.(...args), [world(), fn, args]);
// (headless Chromium draws in software, a few frames a second: wait on the game, not the clock)
const until = (cond, arg) => page.waitForFunction(([w, cond, arg]) => { const x = eval(w); return Boolean(x) && new Function('g', 'arg', `return ${cond}`)(x.game, arg); }, [world(), cond, arg], { timeout: 600000, polling: 250 });
const steps = async (n) => {
  const t0 = await page.evaluate((w) => eval(w).game.t, world());
  await until('g.t >= arg', t0 + n);
};
const loaded = (area) => until(`g.areaId === arg && g.mode === 'play' && !document.querySelector('.m64-fade[data-on]')`, area);

await page.goto(`${base}/#/dot-matrix/64`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction((w) => Boolean(eval(w)) && window.__RUNTIME__?.status === 'on', world(), { timeout: 300000 });
await steps(10);
await step('title');

await page.keyboard.press('Enter');
await until("g.mode === 'play'");
await steps(4);
await step('grounds');
await page.keyboard.down('KeyW');
await steps(30);
await page.keyboard.press('Space');
await page.keyboard.up('KeyW');
await steps(4);
// (shots are taken at rest: a software-drawn canvas mid-frame can come out blank)
await step('grounds-run');

await call('enterArea', 'castle', 'main');
await loaded('castle');
await steps(8);
await step('castle');

await call('enterArea', 'castle', 'bobomb');
await loaded('castle');
await steps(8);
await step('castle-painting');

await call('enterCourse', 'bobomb');
await loaded('bobomb');
await steps(8);
await step('bobomb');
await page.keyboard.down('KeyW');
await steps(40);
await page.keyboard.up('KeyW');
await steps(3);
await step('bobomb-walk');

await page.keyboard.press('KeyP');
await until("g.mode === 'pause'");
await steps(1).catch(() => {});
await settle(1500);
await step('pause');

console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'no page errors');
await browser.close();
process.exit(errors.length ? 1 : 0);

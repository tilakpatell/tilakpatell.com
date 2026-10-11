/* global window, document */
// TEMP debug of flyto-check: logs Alpha's trip densely (deleted before commit)
import { chromium } from 'playwright-core';
import { fakeRelays } from './lib/fake-relays.mjs';

const PORT = process.env.PORT ?? '5173';
const BASE = `http://localhost:${PORT}/?quality=low#`;
const tag = Math.random().toString(36).slice(2, 5).toUpperCase();
const ALPHA = `Alpha${tag}`;
const BRAVO = `Bravo${tag}`;
const browser = await chromium.launch({ executablePath: process.env.CHROME, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const relays = fakeRelays();
async function visitor(name, ship, viewport) {
  const ctx = await browser.newContext({ viewport });
  await ctx.addInitScript(
    ([n, s]) => {
      window.localStorage.setItem('tp-intro', '1');
      window.localStorage.setItem('tp-start', '"universe"');
      window.localStorage.setItem('tp-tour', '"skipped"');
      window.localStorage.setItem('tp-universe-online', JSON.stringify('on'));
      window.localStorage.setItem('tp-universe-callsign', JSON.stringify(n));
      window.localStorage.setItem('tp-universe-ship', JSON.stringify(s));
      window.localStorage.setItem('tp-universe-drive', JSON.stringify('super'));
      window.localStorage.setItem('tp-worlds', JSON.stringify('load'));
      window.sessionStorage.setItem('tp-gl-anyway', 'true');
      window.__hud = [];
      const keep = () => {
        const t = document.querySelector('.universe-prompt, .galaxy-note')?.textContent;
        if (t && window.__hud.at(-1) !== t) window.__hud.push(t);
      };
      new window.MutationObserver(keep).observe(document, { childList: true, subtree: true, characterData: true });
      // poses in: when each came
      window.__frames = 0;
      const tick = () => {
        window.__frames++;
        window.requestAnimationFrame(tick);
      };
      window.requestAnimationFrame(tick);
    },
    [name, ship],
  );
  await relays.attach(ctx);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log(`${name} pageerror: ${e}`));
  return page;
}
const look = (page, id) =>
  page.evaluate(
    ([id]) => {
      const g = window.__universeDebug;
      const s = g.state.ship;
      const p = id ? g.pilots.pose(id) : null;
      const net = g.net();
      const peer = id ? net?.peers?.get(id) : null;
      const snaps = peer?.snaps ?? [];
      const now = performance.now();
      return {
        f: window.__frames,
        ship: s && [Math.round(s.x), Math.round(s.y), Math.round(s.z), +s.speed.toFixed(1)],
        bravo: p && [Math.round(p.x), Math.round(p.y), Math.round(p.z)],
        auto: g.state.auto?.id?.slice(0, 14) ?? null,
        then: g.state.then?.id?.slice(0, 14) ?? null,
        jump: g.state.jump ? [g.state.jump.id.slice(0, 14), g.state.jump.phase, +g.state.jump.age.toFixed(1)] : null,
        snapAges: snaps.slice(-4).map((q) => Math.round(now - q.at)),
        hud: window.__hud.slice(-3).join(' | '),
      };
    },
    [id],
  );
const a = await visitor(ALPHA, 'xwing', { width: 640, height: 400 });
const b = await visitor(BRAVO, 'falcon', { width: 320, height: 240 });
await Promise.all([a.goto(BASE + '/universe'), b.goto(BASE + '/universe')]);
await Promise.all([a, b].map((p) => p.waitForFunction(() => window.__universeDebug?.state?.ship && window.__universeDebug.net?.(), null, { timeout: 240000, polling: 500 })));
let bravoId = null;
while (!bravoId) {
  bravoId = await b.evaluate(() => window.__universeDebug.net()?.selfId ?? null);
  await new Promise((r) => setTimeout(r, 500));
}
console.log('bravo', bravoId.slice(0, 8));
console.log('A0', JSON.stringify(await look(a, bravoId)));
console.log('B0', JSON.stringify(await look(b, null)));
await b.evaluate(() => window.__universeDebug.travel('home', 'hyper'));
await a.evaluate(() => window.__universeDebug.travel('resume', 'hyper'));
for (let i = 0; i < 60; i++) {
  await new Promise((r) => setTimeout(r, 1000));
  const ok = await Promise.all([a, b].map((p) => p.evaluate(() => !window.__universeDebug.state.jump && !window.__universeDebug.state.auto)));
  if (ok[0] && ok[1]) break;
}
for (let i = 0; i < 30; i++) {
  const age = await a.evaluate((id) => { const n = window.__universeDebug.net().peers.get(id)?.snaps?.at(-1); return n ? performance.now() - n.at : 1e9; }, bravoId);
  if (age < 800) break;
  await new Promise((r) => setTimeout(r, 300));
}
console.log('landed A', JSON.stringify(await look(a, bravoId)));
await a.evaluate((id) => {
  const g = window.__universeDebug;
  const p = g.pilots.pose(id);
  g.state.jump = null; g.state.auto = null; g.state.then = null;
  g.state.ship = { ...g.state.ship, x: p.x + Math.sin(p.heading) * 40, y: p.y, z: p.z + Math.cos(p.heading) * 40, heading: p.heading + Math.PI / 2, speed: 0, vy: 0 };
}, bravoId);
await new Promise((r) => setTimeout(r, 3000));
await a.evaluate(() => (window.__hud = []));
const pressed = await a.evaluate((label) => {
  const pill = document.querySelector('.universe-online-pill');
  if (pill?.getAttribute('aria-expanded') !== 'true') pill?.click();
  const b = [...document.querySelectorAll('.universe-online-card button')].find((el) => (el.getAttribute('aria-label') ?? el.textContent.trim()) === label);
  b?.click();
  return Boolean(b);
}, 'Fly to ' + BRAVO);
console.log('pressed', pressed);
const t0 = Date.now();
for (let i = 0; i < 120; i++) {
  await new Promise((r) => setTimeout(r, 300));
  const r = await a.evaluate((id) => {
    const g = window.__universeDebug; const s = g.state.ship; const p = g.pilots.pose(id); const peer = g.net().peers.get(id); const n = peer?.snaps?.at(-1);
    return { f: window.__frames, d: p ? Math.round(Math.hypot(s.x - p.x, s.y - p.y, s.z - p.z)) : null, held: p ? Math.round(performance.now() - p.at) : null, age: n ? Math.round(performance.now() - n.at) : null, hid: n?.hidden ?? null, n: peer?.snaps?.length ?? 'nopeer', where: peer?.where, auto: g.state.auto?.id?.slice(0, 10) ?? null, then: g.state.then?.id?.slice(0,10) ?? null, jump: g.state.jump?.phase ?? null, sp: +s.speed.toFixed(1), hud: window.__hud.join(' | ') };
  }, bravoId);
  console.log(((Date.now() - t0) / 1000).toFixed(1), JSON.stringify(r));
  if (r.hud.includes('With') || r.hud.includes('gone')) { if (++i > 0 && r.hud.includes('gone')) {} }
}
process.exit(0);

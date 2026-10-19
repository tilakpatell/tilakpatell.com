/* global window, document, getComputedStyle, innerWidth */
// A browser check of the crews' ship powers in the galaxy (universe/
// shipPowers.js, battlePowers.js; universe/powers.js; PowerBar.jsx). With the
// dev server up (npx vite --port 5188, or BASE= for another):
//   OUT=/tmp/shots node scripts/galaxy-powers-check.mjs layout
//   OUT=/tmp/shots node scripts/galaxy-powers-check.mjs portal
//   OUT=/tmp/shots node scripts/galaxy-powers-check.mjs war xwing|falcon|rv
// layout: at four window sizes, the power tiles (in the flight cluster along
//   the bottom: FlightCluster.jsx) meet nothing else shown over the view and a
//   click at each tile's middle lands on it (the flight settings' button used
//   to cover G on a short window).
// portal: Rick's cruiser stopped 30 off Tatooine's ground with the nose on
//   its middle and no lock: G comes out short of the ground with room to
//   turn, and no crash follows; 5 off the ground it's refused, its cooldown
//   not spent.
// war: sworn to the Rebellion with a battle forced at Tatooine and the ship
//   among the other side's fighters: Luke's Force Focus slows them while
//   the battle's clock keeps the game's time; Chewie's guns land on them;
//   Walt's magnet holds them and the crystal's blast takes their hull off,
//   and a magnet with nobody near is refused.
// Under software GL a frame takes a second or so, so each takes minutes.
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';

const [mode = 'layout', crewArg] = process.argv.slice(2);
const out = process.env.OUT ?? '.';
const base = process.env.BASE ?? 'http://localhost:5188';
const mac = `${homedir()}/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const chrome = process.env.CHROME ?? (existsSync(mac) ? mac : '/opt/pw-browsers/chromium-1194/chrome-linux/chrome');
// (a Mac's own graphics chip through Metal; elsewhere software GL, a frame a second or so)
const gl = process.platform === 'darwin' ? ['--use-angle=metal', '--disable-gpu-vsync', '--disable-frame-rate-limit', '--ignore-gpu-blocklist'] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
mkdirSync(out, { recursive: true });
const problems = [];
const check = (ok, what) => {
  console.log(ok ? 'ok  ' : 'FAIL', what);
  if (!ok) problems.push(what);
};
const browser = await chromium.launch({ executablePath: chrome, args: gl });

// the galaxy at a system, flown by `crew`, ready to fly
const open = async (crew, viewport = { width: 1280, height: 720 }, system = 'tatooine') => {
  const ctx = await browser.newContext({ viewport });
  await ctx.addInitScript((s) => {
    window.localStorage.setItem('tp-intro', '1');
    window.localStorage.setItem('tp-start', '"universe"');
    window.localStorage.setItem('tp-universe-ship', JSON.stringify(s));
    window.localStorage.setItem('tp-worlds', '"load"');
    window.localStorage.setItem('tp-software', '"on"'); // (past the Star Wars worlds' GPU gate, lib/fit)
    window.localStorage.setItem('tp-galaxy-panel', '"tucked"');
    window.sessionStorage.setItem('tp-galaxy-intro', '1');
  }, crew);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && !/GPU stall|swiftshader|WebGL|403/i.test(m.text()) && errors.push(m.text()));
  await page.goto(`${base}/?quality=mid#/galaxy/${system}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.__galaxy === 'function' && window.__galaxy().system && window.__galaxy().ship && !window.__galaxy().jump, null, { timeout: 300000 });
  const G = (fn, arg) => page.evaluate(fn, arg);
  const clock = () => G(() => window.__galaxyDebug.state.clock);
  // (seconds of the game's own time: at a frame a second, many more of ours)
  const waitGame = async (sec, cap = 300000) => {
    const t0 = await clock();
    const until = Date.now() + cap;
    while ((await clock()) - t0 < sec && Date.now() < until) await page.waitForTimeout(200);
  };
  const ready = (slot = 'primary') => page.waitForFunction((s) => window.__galaxy().powers[s].phase === 'ready', slot, { timeout: 900000 });
  return { ctx, page, errors, G, waitGame, ready };
};

if (mode === 'layout') {
  for (const viewport of [{ width: 800, height: 600 }, { width: 1366, height: 657 }, { width: 1280, height: 720 }, { width: 1440, height: 900 }]) {
    const size = `${viewport.width}x${viewport.height}`;
    const { ctx, page, errors, G, waitGame } = await open('xwing', viewport);
    await waitGame(0.5);
    const r = await G(() => {
      const bar = document.querySelector('.hud-powers');
      const tiles = [...document.querySelectorAll('.hud-power')];
      const meets = [];
      for (const e of document.querySelectorAll('body *')) {
        if (bar.contains(e) || e.contains(bar)) continue;
        const cs = getComputedStyle(e);
        if ((cs.position !== 'absolute' && cs.position !== 'fixed') || cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) continue;
        const b = e.getBoundingClientRect();
        if (b.width < 2 || b.height < 2 || b.width > innerWidth * 0.9) continue;
        for (const t of tiles) {
          const a = t.getBoundingClientRect();
          if (a.x < b.right && b.x < a.right && a.y < b.bottom && b.y < a.bottom) meets.push(`${t.dataset.slot} meets ${String(e.className).slice(0, 40)}`);
        }
      }
      const clicks = tiles.map((t) => {
        const a = t.getBoundingClientRect();
        const hit = document.elementFromPoint(a.x + a.width / 2, a.y + a.height / 2);
        return Boolean(hit && t.contains(hit));
      });
      const g = tiles[0].getBoundingClientRect();
      return { on: bar.hasAttribute('data-on'), inCluster: Boolean(bar.closest('.fc')), meets, clicks, g: { x: g.x + g.width / 2, y: g.y + g.height / 2 } };
    });
    check(r.on, `${size}: the bar's shown`);
    check(r.inCluster, `${size}: the bar's in the flight cluster`);
    check(r.meets.length === 0, `${size}: the tiles meet nothing else shown${r.meets.length ? ` (${r.meets.join('; ')})` : ''}`);
    check(r.clicks.every(Boolean), `${size}: a click at each tile's middle lands on it`);
    await page.screenshot({ path: `${out}/powers-layout-${size}.png` });
    await page.mouse.click(r.g.x, r.g.y);
    await waitGame(0.2);
    check((await G(() => window.__galaxy().powers.primary.phase)) === 'active', `${size}: a click on G puts Force Focus on`);
    check(errors.length === 0, `${size}: no errors${errors.length ? ` (${errors.slice(0, 3).join('; ')})` : ''}`);
    await ctx.close();
  }
}

if (mode === 'portal') {
  const { page, errors, G, waitGame, ready } = await open('cruiser');
  const put = (off) =>
    G((o) => {
      const d = window.__galaxyDebug;
      d.state.flown = true;
      d.hunters?.clear?.();
      const p = d.state.space.solids.reduce((a, b) => (b.r > a.r ? b : a));
      window.__planet = p;
      d.pin({ x: p.at[0] + p.r + o, y: p.at[1], z: p.at[2], heading: Math.PI / 2, pitch: 0, bank: 0 }); // (the nose on its middle)
      d.state.lock = null;
      d.state.safeUntil = 1e12;
    }, off);
  const ground = () =>
    G(() => {
      const s = window.__galaxyDebug.state.ship;
      const p = window.__planet;
      return { off: Math.hypot(s.x - p.at[0], s.y - p.at[1], s.z - p.at[2]) - p.r, speed: s.speed, crash: window.__galaxyDebug.state.crash?.id ?? null };
    });
  await put(30);
  await waitGame(0.4);
  check(await G(() => window.__galaxyDebug.power('primary')), 'the portal opens 30 off the ground');
  await waitGame(0.45);
  const at = await ground();
  console.log('     out at', at.off.toFixed(2), 'off the ground, at', at.speed.toFixed(2));
  check(at.off >= 6 && at.off < 30, 'it comes out short of the ground with room to turn off it');
  await page.screenshot({ path: `${out}/powers-portal-out.png` });
  await waitGame(2);
  check((await ground()).crash === null, 'no crash two seconds on');
  await ready();
  await put(5);
  await waitGame(0.3);
  check((await G(() => window.__galaxyDebug.power('primary'))) === false, '5 off the ground, it’s refused');
  check((await G(() => window.__galaxy().powers.primary.phase)) === 'ready', 'and its cooldown isn’t spent');
  check(errors.length === 0, `no errors${errors.length ? ` (${errors.slice(0, 3).join('; ')})` : ''}`);
}

if (mode === 'war') {
  const crew = crewArg ?? 'falcon';
  const { page, errors, G, waitGame, ready } = await open(crew);
  await page.waitForFunction(() => Boolean(window.__galaxyOath), null, { timeout: 30000 });
  await G(() => window.__galaxyOath.swear('rebel'));
  await G(() => window.__galaxyDebug.war.force('rebel'));
  await page.waitForFunction(() => Boolean(window.__galaxyDebug.war.battle), null, { timeout: 30000 });
  await G(() => window.__galaxyDebug.war.skip(8));
  const enemy = () =>
    G(() => {
      const b = window.__galaxyDebug.war.battle;
      const them = b.fighters.filter((f) => f.alive && f.team !== b.you.team);
      return { alive: them.length, hp: them.reduce((s, f) => s + f.hp, 0), held: them.filter((f) => f.held > 0).length };
    });
  // the ship among the other side's fighters, facing their middle
  await G(() => {
    const d = window.__galaxyDebug;
    d.state.flown = true;
    d.hunters?.clear?.();
    const b = d.war.battle;
    const them = b.fighters.filter((f) => f.alive && f.team !== b.you.team);
    const c = them.reduce((a, f) => ({ x: a.x + f.pos.x / them.length, y: a.y + f.pos.y / them.length, z: a.z + f.pos.z / them.length }), { x: 0, y: 0, z: 0 });
    d.pin({ x: c.x + 12, y: c.y + 2, z: c.z, heading: Math.PI / 2, pitch: -0.1, bank: 0 });
    d.state.safeUntil = 1e12;
    d.state.shield = 100;
  });
  await waitGame(0.4);
  check((await G(() => window.__galaxyDebug.war.battle.you.team)) === 0, 'in the battle on the Rebellion’s side');
  if (crew === 'xwing') {
    const moved = async (sec) => {
      const a = await G(() => ({ c: window.__galaxyDebug.state.clock, k: window.__galaxyDebug.war.battle.clock, p: window.__galaxyDebug.war.battle.fighters.map((f) => [f.pos.x, f.pos.y, f.pos.z, f.alive]) }));
      await waitGame(sec);
      const b = await G(() => ({ c: window.__galaxyDebug.state.clock, k: window.__galaxyDebug.war.battle.clock, p: window.__galaxyDebug.war.battle.fighters.map((f) => [f.pos.x, f.pos.y, f.pos.z, f.alive]) }));
      let sum = 0;
      let n = 0;
      b.p.forEach((q, i) => {
        const o = a.p[i];
        if (q[3] && o[3]) {
          sum += Math.hypot(q[0] - o[0], q[1] - o[1], q[2] - o[2]);
          n++;
        }
      });
      return { speed: sum / Math.max(1, n) / Math.max(1e-6, b.c - a.c), game: b.c - a.c, battle: b.k - a.k };
    };
    const before = await moved(0.8);
    check(await G(() => window.__galaxyDebug.power('primary')), 'Force Focus goes on');
    const during = await moved(0.8);
    console.log('     fighters', before.speed.toFixed(2), 'u/s, then', during.speed.toFixed(2));
    check(during.speed / before.speed < 0.5, 'it slows the battle’s fighters');
    check(Math.abs(during.battle - during.game) < 0.05, 'and the battle’s clock keeps the game’s time');
    await page.screenshot({ path: `${out}/powers-war-focus.png` });
  }
  if (crew === 'falcon') {
    await G(() => {
      const w = window.__galaxyDebug.war;
      const hit = w.hit.bind(w);
      window.__warHits = [];
      w.hit = (...args) => {
        const r = hit(...args);
        if (r) window.__warHits.push({ kind: r.kind, down: r.down });
        return r;
      };
      window.__galaxyDebug.charge();
    });
    await waitGame(0.1);
    check(await G(() => window.__galaxyDebug.power('ultimate')), 'Chewie takes the guns');
    await waitGame(4);
    const hits = await G(() => window.__warHits);
    console.log('     hits', hits.length, 'down', hits.filter((h) => h.down).length);
    check(hits.length > 0, 'his shots land on the battle’s fighters');
    await page.screenshot({ path: `${out}/powers-war-quad.png` });
  }
  if (crew === 'rv') {
    check(await G(() => window.__galaxyDebug.power('primary')), 'the magnet goes on');
    await waitGame(0.2);
    check((await enemy()).held > 0, 'it holds the battle’s fighters near it');
    await waitGame(2);
    await G(() => window.__galaxyDebug.charge());
    await waitGame(0.1);
    const a = await enemy();
    check(await G(() => window.__galaxyDebug.power('ultimate')), 'the crystal’s thrown');
    await page.waitForFunction(() => !window.__galaxy().powers.crystal, null, { timeout: 300000 });
    await waitGame(0.3);
    const b = await enemy();
    console.log('     their hull', a.hp, 'then', b.hp);
    check(b.hp < a.hp, 'its blast takes hull off the battle’s fighters');
    await page.screenshot({ path: `${out}/powers-war-blast.png` });
    await ready();
    await G(() => {
      const d = window.__galaxyDebug;
      d.hunters?.clear?.();
      const s = d.state.ship;
      d.pin({ x: s.x + 900, y: s.y + 100, z: s.z, heading: -Math.PI / 2, pitch: 0, bank: 0 });
    });
    await waitGame(0.3);
    check((await G(() => window.__galaxyDebug.power('primary'))) === false, 'with nobody near, the magnet’s refused');
    check((await G(() => window.__galaxy().powers.primary.phase)) === 'ready', 'and its cooldown isn’t spent');
  }
  check(errors.length === 0, `no errors${errors.length ? ` (${errors.slice(0, 3).join('; ')})` : ''}`);
}

await browser.close();
if (problems.length) {
  console.log(`\n${problems.length} failed`);
  process.exit(1);
}

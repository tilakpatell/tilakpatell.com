// The Battlefront front end walked in headless Edge on the real GPU, each
// click timed: the time to the next screen painted, the long tasks, the
// frame deltas, a CPU profile per transition (self time by function and
// file), and what the world draws behind the loading and spawn screens.
//
//   node scripts/bf2017-menus-profile.mjs [--base http://127.0.0.1:5533] [--out dir] [--label before] [--rest 2000]
/* global window, document, requestAnimationFrame, MutationObserver */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const argv = process.argv.slice(2);
const arg = (k, d) => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};
const base = arg('base', 'http://127.0.0.1:5533');
const OUT = arg('out', '.');
const LABEL = arg('label', 'run');
const REST = Number(arg('rest', 2000));
const WAIT = 600000;
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  args: ['--enable-unsafe-webgpu', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-webgl'],
});
const ctx = await browser.newContext({ viewport: { width: 2560, height: 720 }, deviceScaleFactor: 2 });
await ctx.addInitScript(() => {
  localStorage.setItem('tp-intro', '1');
  localStorage.setItem('tp-start', '"universe"');
  localStorage.setItem('tp-worlds', JSON.stringify('load'));
  localStorage.setItem('tp-software', JSON.stringify('on')); // (past the Star Wars worlds' GPU gate, lib/fit: a software GL is the point here)
  localStorage.setItem('tp-quality', 'ultra');
  window.__lt = [];
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) window.__lt.push({ start: Math.round(e.startTime), dur: Math.round(e.duration) });
    }).observe({ type: 'longtask', buffered: true });
  } catch {
    /* no longtask here */
  }
  // (Event Timing: each input's wait for the main thread, processingStart − startTime)
  window.__ev = [];
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) if (/^(mouse|pointer|key|click)/.test(e.name)) window.__ev.push({ name: e.name, start: Math.round(e.startTime), wait: Math.round(e.processingStart - e.startTime), dur: Math.round(e.duration) });
    }).observe({ type: 'event', buffered: true, durationThreshold: 16 });
  } catch {
    /* no event timing here */
  }
  window.__frames = [];
  let last = performance.now();
  const tick = (t) => {
    window.__frames.push([Math.round(t), Math.round((t - last) * 10) / 10]);
    last = t;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
const page = await ctx.newPage();
const console_ = [];
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && console_.push(`${m.type()}: ${m.text().slice(0, 300)}`));
page.on('pageerror', (e) => console_.push(`pageerror: ${String(e).slice(0, 300)}`));
const cdp = await ctx.newCDPSession(page);
await cdp.send('Profiler.enable');
await cdp.send('Profiler.setSamplingInterval', { interval: 250 });

const now = () => page.evaluate(() => performance.now());
const painted = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(performance.now())))));
const since = (t) => page.evaluate((t0) => ({ lt: window.__lt.filter((l) => l.start >= t0 - 1), frames: window.__frames.filter((f) => f[0] >= t0).map((f) => f[1]), inputs: window.__ev.filter((e) => e.start >= t0 - 1) }), t);
const stats = (a) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const mean = a.reduce((p, q) => p + q, 0) / a.length;
  return { n: a.length, mean: +mean.toFixed(1), median: s[s.length >> 1], p95: s[Math.floor(s.length * 0.95)], max: s[s.length - 1] };
};

// a profile's self time by function and by file
function aggregate(profile) {
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const self = new Map();
  let total = 0;
  for (let i = 0; i < profile.samples.length; i++) {
    const n = byId.get(profile.samples[i]);
    const dt = (profile.timeDeltas[i] ?? 0) / 1000;
    total += dt;
    self.set(n.id, (self.get(n.id) ?? 0) + dt);
  }
  const fn = new Map();
  const file = new Map();
  for (const [id, ms] of self) {
    const n = byId.get(id);
    const url = (n.callFrame.url || '').replace(/^https?:\/\/[^/]+/, '').replace(/\?.*$/, '');
    const key = `${n.callFrame.functionName || '(anonymous)'} ${url}:${n.callFrame.lineNumber + 1}`;
    fn.set(key, (fn.get(key) ?? 0) + ms);
    const f = url || `(${n.callFrame.functionName})`;
    file.set(f, (file.get(f) ?? 0) + ms);
  }
  const top = (m, k) => [...m].sort((a, b) => b[1] - a[1]).slice(0, k).map(([name, ms]) => ({ name, ms: +ms.toFixed(1) }));
  return { total: +total.toFixed(1), functions: top(fn, 40), files: top(file, 25) };
}

const steps = [];
const profiles = {};
// (the reticle is a 0 × 0 box with its ticks round it, so it is waited for attached, never visible)
async function step(name, act, sel, { timeout = 60000, state = 'visible' } = {}) {
  await page.evaluate(() => void 0);
  const t0 = await now();
  await cdp.send('Profiler.start');
  await act();
  await page.waitForSelector(sel, { timeout, state });
  const t1 = await painted();
  const { profile } = await cdp.send('Profiler.stop');
  const s = await since(t0);
  const row = { name, toPaint: Math.round(t1 - t0), longTasks: s.lt, longTaskMs: s.lt.reduce((a, l) => a + l.dur, 0), frames: stats(s.frames), inputs: s.inputs };
  // (at rest on the new screen: the frames with nothing pressed)
  const r0 = await now();
  await page.waitForTimeout(REST);
  const rest = await since(r0);
  row.rest = { frames: stats(rest.frames), longTaskMs: rest.lt.reduce((a, l) => a + l.dur, 0), longTasks: rest.lt.length };
  row.profile = aggregate(profile);
  profiles[name] = profile;
  steps.push(row);
  console.log(JSON.stringify({ name, toPaint: row.toPaint, longTaskMs: row.longTaskMs, frames: row.frames, rest: row.rest }));
  await page.screenshot({ path: join(OUT, `${LABEL}-${steps.length}-${name}.png`), scale: 'css' }).catch(() => {});
  return row;
}

const t0 = Date.now();
let loadingBehind = null;
let spawnDraws = null;
let hudDraws = null;
let spawnSettle = null;
let deploySettle = null;
let deployed = null;
let failed = null;
try {
await page.goto(`${base}/#/battlefront`, { waitUntil: 'domcontentloaded', timeout: WAIT });
await step('start', async () => {}, '.bf-start .bf-start-press', { timeout: WAIT });
await step('main-menu', () => page.keyboard.press('Enter'), '[data-screen$="/MainMenuScreen"]');
await step('play', () => page.click('[data-link$="/PlayScreen"]'), '[data-tile="Multiplayer"]');
await step('multiplayer-category', () => page.click('[data-tile="Multiplayer"]'), '[data-tile="Assault Cat"]');
await step('multiplayer', () => page.click('[data-tile="Assault Cat"]'), '[data-mode="PlanetaryBattles"]');
await step('levels', () => page.click('[data-mode="PlanetaryBattles"]'), '[data-level="hoth"]');
await step('loading', () => page.click('[data-level="hoth"]'), '[data-game-screen$="/LoadingScreenWrapperWidget"]', { timeout: WAIT });

// the world behind the loading screen: draws, the level's stream, the frames
await page.waitForFunction(() => Boolean(window.__battlefront?.world), null, { timeout: WAIT, polling: 500 });
const hooked = await page.evaluate(() => {
  const w = window.__battlefront.world;
  const orig = w.draw;
  window.__draws = [];
  w.draw = function (a) {
    window.__renderer = a.renderer;
    const t = performance.now();
    orig.call(w, a);
    const i = a.renderer.info;
    window.__draws.push({ t: Math.round(t), ms: Math.round((performance.now() - t) * 10) / 10, calls: i.render?.calls ?? null, tris: i.render?.triangles ?? null, backend: i.backend ?? null });
  };
  // (the pace every half second from here: a step down builds the chain again)
  window.__pace = [];
  setInterval(() => {
    const q = window.__RUNTIME__?.quality;
    window.__pace.push({ t: Math.round(performance.now()), level: q?.level ?? null, internal: q?.internal ?? null, source: q?.source ?? null, step: window.__battlefront?.paceLevel ?? null, chain: window.__battlefront?.chain?.length ?? null });
  }, 500);
  return { keys: Object.keys(w), chain: window.__battlefront.chain?.length ?? null, pace: window.__battlefront.paceLevel };
});
const loadSamples = [];
const l0 = await now();
for (const until = Date.now() + WAIT; ; ) {
  const v = await page.evaluate(() => {
    // (the world made again mid-load, as a page error makes the runtime do, is a row saying so)
    if (!window.__battlefront) return { t: Math.round(performance.now()), gone: true, loaded: false };
    const v = window.__battlefront.view();
    const d = window.__draws;
    const last = d.slice(-60);
    return { t: Math.round(performance.now()), loaded: v.level.loaded, progress: v.level.progress, stats: v.level, draws: d.length, drawMs: last.length ? +(last.reduce((a, x) => a + x.ms, 0) / last.length).toFixed(2) : null, lastDraw: d[d.length - 1] ?? null };
  });
  loadSamples.push(v);
  if (v.loaded) break;
  if (Date.now() > until) throw new Error('the level never loaded');
  await page.waitForTimeout(1000);
}
const loadWindow = await since(l0);
loadingBehind = { hooked, samples: loadSamples, frames: stats(loadWindow.frames), longTasks: loadWindow.lt.length, longTaskMs: loadWindow.lt.reduce((a, l) => a + l.dur, 0), worst: loadWindow.lt.sort((a, b) => b.dur - a.dur).slice(0, 10) };
console.log('loading behind:', JSON.stringify({ seconds: loadSamples.length, frames: loadingBehind.frames, longTasks: loadingBehind.longTasks, longTaskMs: loadingBehind.longTaskMs, draws: loadSamples.at(-1).draws, drawMs: loadSamples.at(-1).drawMs, last: loadSamples.at(-1).lastDraw }));

// How long the guard (lib/three/pipelineGuard) holds anything out of the
// frame from here: its held and pending counts every quarter second until
// both have been 0 for a second (or 40 s).
const settle = async () => {
  const t0 = await now();
  const rows = [];
  let clear = 0;
  for (let i = 0; i < 160; i++) {
    const row = await page.evaluate(() => {
      const g = window.__renderer?._pipelines?.__guard;
      return { t: Math.round(performance.now()), held: g?.held() ?? null, pending: g?.pending() ?? null, frames: window.__frames.length };
    });
    rows.push(row);
    clear = row.held === 0 && row.pending === 0 ? clear + 1 : 0;
    if (clear >= 4) break;
    await page.waitForTimeout(250);
  }
  const last = rows.at(-1);
  return { settleMs: Math.round(last.t - t0 - (clear >= 4 ? 750 : 0)), settled: clear >= 4, rows: rows.filter((x, i, a) => i === 0 || i === a.length - 1 || x.held !== a[i - 1].held) };
};
await step('spawn', async () => {}, '[data-screen$="/SpawnOverlayScreen"]', { timeout: WAIT });
spawnSettle = await settle();
console.log('spawn settle', JSON.stringify({ settleMs: spawnSettle.settleMs, settled: spawnSettle.settled }));
spawnDraws = await page.evaluate(() => {
  const d = window.__draws.slice(-120);
  return { n: d.length, calls: d.at(-1)?.calls, tris: d.at(-1)?.tris, drawMs: +(d.reduce((a, x) => a + x.ms, 0) / d.length).toFixed(2) };
});
// (the first offer clicked, as a player does; if the sim has not taken it in 20 s the dev door deploys, and the row says so)
await step('deploy', async () => {
  // (stamps in the page itself: when the cell's click fires, when the
  // reticle first stands in the HUD; the driver's own click waits on the
  // frames and says nothing of the page's latency)
  await page.evaluate(() => {
    window.__clickAt = null;
    window.__reticleAt = null;
    document.querySelector('.bf-spawn-screen-cell:not([aria-disabled])')?.addEventListener('click', () => (window.__clickAt = performance.now()), { capture: true, once: true });
    const mo = new MutationObserver(() => {
      if (window.__reticleAt === null && document.querySelector('.bf-hud .hud-reticle-shape')) {
        window.__reticleAt = performance.now();
        mo.disconnect();
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
    // (and a row every 50 ms: the sim's state, which screens stand, the frames gone by)
    window.__after = [];
    const t0 = performance.now();
    const id = setInterval(() => {
      const v = window.__battlefront?.view?.();
      window.__after.push({ t: Math.round(performance.now() - t0), state: v?.player?.state ?? null, open: v?.deploy?.open ?? null, loaded: v?.level?.loaded ?? null, spawn: Boolean(document.querySelector('.bf-spawn-screen')), loading: Boolean(document.querySelector('[data-game-screen$="/LoadingScreenWrapperWidget"]')), reticle: document.querySelectorAll('.bf-hud .hud-reticle-shape').length, frames: window.__frames.length, lt: window.__lt.length });
      if (window.__after.length > 600) clearInterval(id);
    }, 50);
  });
  const c0 = Date.now();
  const box = await page.locator('.bf-spawn-screen-cell:not([aria-disabled])').first().boundingBox();
  const parts = { box: Date.now() - c0 };
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  parts.move = Date.now() - c0;
  await page.mouse.down();
  parts.down = Date.now() - c0;
  await page.mouse.up();
  parts.up = Date.now() - c0;
  const clickMs = Date.now() - c0;
  deployed = { by: 'click', parts };
  // (a row every quarter second from the click to the reticle: the sim's
  // state, the stream, which screens stand, the frames gone by)
  const sample = () =>
    page.evaluate(() => {
      const v = window.__battlefront?.view?.();
      return { t: Math.round(performance.now()), state: v?.player?.state ?? null, open: v?.deploy?.open ?? null, loaded: v?.level?.loaded ?? null, progress: v?.level?.progress ?? null, reticle: document.querySelectorAll('.bf-hud .hud-reticle-shape').length, loadingScreen: Boolean(document.querySelector('[data-game-screen$="/LoadingScreenWrapperWidget"]')), spawnScreen: Boolean(document.querySelector('.bf-spawn-screen')), frames: window.__frames.length, longTasks: window.__lt.length };
    });
  const timeline = [];
  for (let i = 0; i < 240; i++) {
    const row = await sample();
    timeline.push(row);
    if (row.reticle) break;
    if (i === 80 && row.state !== 'alive') {
      deployed = { by: 'door', click: 'not taken in 20 s', result: await page.evaluate(() => window.__battlefront.do('deploy', { classId: 'd-orig-assault' })) };
    }
    await page.waitForTimeout(250);
  }
  const alive = timeline.find((r) => r.state === 'alive');
  const stamps = await page.evaluate(() => ({ clickAt: window.__clickAt, reticleAt: window.__reticleAt }));
  const after = await page.evaluate(() => window.__after.filter((r, i, a) => i === 0 || ['state', 'open', 'loaded', 'spawn', 'loading', 'reticle'].some((k) => r[k] !== a[i - 1][k])));
  deployed = { ...deployed, after, driverClickMs: clickMs, clickToReticleMs: stamps.clickAt != null && stamps.reticleAt != null ? Math.round(stamps.reticleAt - stamps.clickAt) : null, stamps, aliveAfter: alive ? alive.t - timeline[0].t : null, reticleAfter: timeline.at(-1).reticle ? timeline.at(-1).t - timeline[0].t : null, timeline };
}, '.bf-hud .hud-reticle-shape', { timeout: 180000, state: 'attached' });
deploySettle = await settle();
console.log('deploy settle', JSON.stringify({ settleMs: deploySettle.settleMs, settled: deploySettle.settled }));
hudDraws = await page.evaluate(() => {
  const d = window.__draws.slice(-120);
  return { n: d.length, calls: d.at(-1)?.calls, tris: d.at(-1)?.tris, drawMs: +(d.reduce((a, x) => a + x.ms, 0) / d.length).toFixed(2) };
});
await step('ingame-menu', () => page.keyboard.press('Escape'), '[data-screen$="/IngameMenuMPScreen"]');
await step('resume', () => page.click('[data-item="RESUME"]'), '.bf-hud .hud-reticle-shape', { state: 'attached' });

} catch (e) {
  failed = String(e).split('\n')[0];
  console.error('failed:', failed);
}
const gpu = await page.evaluate(() => window.__battlefront?.do('gpu')).catch(() => null);
// (the pace's rows, only where it changed)
const pace = await page.evaluate(() => (window.__pace ?? []).filter((r, i, a) => i === 0 || ['level', 'internal', 'step', 'chain', 'source'].some((k) => r[k] !== a[i - 1][k]))).catch(() => null);
const result = { label: LABEL, base, gpu, failed, totalMs: Date.now() - t0, viewport: '2560x720@2', quality: 'ultra', steps, loadingBehind, spawnDraws, spawnSettle, deployed, deploySettle, hudDraws, pace, console: console_ };
writeFileSync(join(OUT, `${LABEL}.json`), JSON.stringify(result, null, 2));
writeFileSync(join(OUT, `${LABEL}-profiles.json`), JSON.stringify(profiles));
const slowest = [...steps].sort((a, b) => b.toPaint - a.toPaint)[0] ?? { name: 'none', toPaint: 0, profile: { files: [], functions: [] } };
console.log('\nslowest:', slowest.name, slowest.toPaint, 'ms');
console.log(JSON.stringify(slowest.profile.files.slice(0, 12), null, 1));
console.log(JSON.stringify(slowest.profile.functions.slice(0, 20), null, 1));
console.log('console:', console_.length, console_.slice(0, 12).join('\n'));
await browser.close();

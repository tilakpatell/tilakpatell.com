/* global window, document, MutationObserver, requestAnimationFrame, location, Element */
// How the ship you fly comes onto the universe map: whether the first frame
// the visitor sees already has its full model or a stand-in that pops into
// it later, under a throttled network, and what a second visit fetches.
//
//   node scripts/ship-load-check.mjs [--url http://127.0.0.1:4173] [--ship cruiser]
//     [--net cable,fast3g,none] [--quality high] [--out lab/ship-load.json] [--timeout 300] [--dist dist]
//     [--launch cruiser] (instead: the map up flying the Falcon, then the cockpit
//       opened as ⌘K's replay does and launched in `--launch`'s vehicle: how
//       long the white held past the flash, and whether the stand-in was
//       on the map as it cleared)
//
// Without --url it serves the last build (`npm run build` first) with vite
// preview. Each network profile gets a fresh browser (an empty cache): the
// map opened at /universe flying `--ship`, the intro skipped. It reads the
// scene's marks (scene.js's setShip: `universe:ship-stand-in` as the
// stand-in goes in, `universe:ship-full` as the model is mounted over it)
// against the first frame drawn (the world's box turning data-gl="on", which
// the runtime does after its first draw), the frames' times round the swap,
// and the bytes of the ship's files (the C-137 page's saucer, Rick and
// Morty, their clips, the cruiser's code). Then it flies to the C-137 page (/c-137)
// and back, the same visit, and counts what the map fetches again for the
// ship (a second visit's fetches). Headless Chromium draws in software, so
// a frame takes a second or so; it waits on conditions, never on time.
import { spawn } from 'node:child_process';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const args = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (!argv[i].startsWith('--')) continue;
  const next = argv[i + 1];
  if (next === undefined || next.startsWith('--')) args[argv[i].slice(2)] = true;
  else args[argv[i].slice(2)] = argv[++i];
}
const SHIP = args.ship ?? 'cruiser';
const QUALITY = args.quality ?? 'high';
const TIMEOUT = (Number(args.timeout) || 300) * 1000;
// (Chrome's own presets, as its devtools has them: “Fast 3G” is 1.6 Mb/s at
// 562.5 ms; the cable is WebPageTest's, 5 Mb/s at 28 ms)
const NETS = {
  none: null,
  cable: { latency: 28, downloadThroughput: (5e6 / 8) * 0.9, uploadThroughput: (1e6 / 8) * 0.9 },
  fast3g: { latency: 562.5, downloadThroughput: ((1.6 * 1024 * 1024) / 8) * 0.9, uploadThroughput: ((750 * 1024) / 8) * 0.9 },
};
const nets = (typeof args.net === 'string' ? args.net : 'cable,fast3g').split(',').filter(Boolean);
for (const n of nets) if (!(n in NETS)) throw new Error(`no network ${n} (${Object.keys(NETS).join(', ')})`);
// the ship's own files: the cruiser's saucer and crew and their clips, its code; the others' models
const SHIP_FILES = /\/games\/meshy\/(saucer|rick|morty|clips-)[^/]*\.glb|\/assets\/cruiser3d(Core)?-[^/]*\.js|\/models\/galaxy\/(surface\/xwing|falcon)\.glb|\/models\/universe\/rv-wings\.glb/;

const serve = async () => {
  if (args.url) return { base: String(args.url).replace(/\/$/, ''), stop: () => {} };
  const vite = join(dirname(createRequire(import.meta.url).resolve('vite/package.json')), 'bin/vite.js');
  const port = 4300 + Math.floor(Math.random() * 500);
  const server = spawn(process.execPath, [vite, 'preview', '--port', String(port), '--strictPort', '--host', '127.0.0.1', '--outDir', String(args.dist ?? 'dist')], { cwd: ROOT, stdio: 'ignore' });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(base)).ok) return { base, stop: () => server.kill() };
    } catch {
      // (not up yet)
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  server.kill();
  throw new Error('vite preview never answered');
};

// in the page, from its first script: the frames' times and the first frame drawn
const pageProbe = () => {
  window.__ship = { frames: [], first: null };
  performance.setResourceTimingBufferSize(10000); // (the map asks for hundreds of files: the default keeps 250)
  const tick = (t) => {
    window.__ship.frames.push(t);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  new MutationObserver(() => {
    if (window.__ship.first == null && document.querySelector('[data-gl="on"]')) window.__ship.first = performance.now();
  }).observe(document, { subtree: true, attributes: true, attributeFilter: ['data-gl'] });
};

const read = (page) =>
  page.evaluate((files) => {
    const re = new RegExp(files);
    const got = performance.getEntriesByType('resource').filter((r) => re.test(r.name));
    const at = (name) => performance.getEntriesByName(name, 'mark').map((m) => ({ t: m.startTime, kind: m.detail }));
    return { first: window.__ship.first, standIn: at('universe:ship-stand-in'), made: at('universe:ship-made'), full: at('universe:ship-full'), frames: window.__ship.frames.slice(), asked: got.length ? Math.min(...got.map((r) => r.startTime)) : null, landed: got.length ? Math.max(...got.map((r) => r.responseEnd)) : null };
  }, SHIP_FILES.source);

const waitFor = async (page, fn, arg, ms = TIMEOUT) => {
  await page.waitForFunction(fn, arg, { timeout: ms, polling: 250 });
};

async function run(base, net) {
  const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--js-flags=--max-old-space-size=4096'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(([ship, q]) => {
    window.localStorage.setItem('tp-intro', '1');
    window.localStorage.setItem('tp-start', '"universe"');
    window.localStorage.setItem('tp-quality', q);
    window.localStorage.setItem('tp-universe-ship', JSON.stringify(ship));
  }, [SHIP, QUALITY]);
  await ctx.addInitScript(pageProbe);
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  if (NETS[net]) await cdp.send('Network.emulateNetworkConditions', { offline: false, ...NETS[net] });
  const reqs = new Map(); // requestId → { url, bytes, cached, phase }
  let phase = 'first';
  cdp.on('Network.requestWillBeSent', (e) => reqs.set(e.requestId, { url: e.request.url, bytes: 0, cached: false, status: null, phase }));
  cdp.on('Network.requestServedFromCache', (e) => reqs.has(e.requestId) && (reqs.get(e.requestId).cached = true));
  cdp.on('Network.responseReceived', (e) => reqs.has(e.requestId) && (reqs.get(e.requestId).status = e.response.status));
  cdp.on('Network.loadingFinished', (e) => reqs.has(e.requestId) && (reqs.get(e.requestId).bytes = e.encodedDataLength));
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto(`${base}/?quality=${QUALITY}#/universe`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
  await waitFor(page, () => window.__ship.first != null && performance.getEntriesByName('universe:ship-full', 'mark').length > 0);
  // a few frames after the swap, for the longest of them
  const n0 = await page.evaluate(() => window.__ship.frames.length);
  await waitFor(page, (n) => window.__ship.frames.length >= n + 4, n0, 60000).catch(() => {});
  const one = await read(page);
  const full = one.full[0]?.t ?? null;
  const gaps = (from, to) => {
    let worst = 0;
    for (let i = 1; i < one.frames.length; i++) if (one.frames[i] >= from && one.frames[i - 1] <= to) worst = Math.max(worst, one.frames[i] - one.frames[i - 1]);
    return Math.round(worst);
  };
  const shipReqs = (p) => [...reqs.values()].filter((r) => r.phase === p && SHIP_FILES.test(r.url));
  const first = shipReqs('first');
  const result = {
    net,
    ship: SHIP,
    firstFrameMs: Math.round(one.first),
    standInAtMs: Math.round(one.standIn[0]?.t ?? NaN),
    fullAtMs: full == null ? null : Math.round(full),
    fullOnFirstFrame: full != null && full <= one.first,
    standInSeenMs: full == null ? null : Math.max(0, Math.round(full - one.first)),
    // (in the scene, seen or not: from the stand-in going in to the model mounted over it)
    standInInSceneMs: full == null ? null : Math.round(full - (one.standIn[0]?.t ?? full)),
    madeAtMs: Math.round(one.made[0]?.t ?? NaN), // (built and handed over, before its shaders were made)
    shipFirstAskedMs: one.asked == null ? null : Math.round(one.asked),
    shipLastByteMs: one.landed == null ? null : Math.round(one.landed),
    // (the frames on either side of the swap; in software every frame is long, so compare runs, not budgets)
    longestFrameAroundSwapMs: full == null ? null : gaps(full - 1000, full + 3000),
    medianFrameMs: (() => {
      const d = one.frames.slice(1).map((t, i) => t - one.frames[i]).filter((x) => x > 0).sort((a, b) => a - b);
      return Math.round(d[Math.floor(d.length / 2)] ?? NaN);
    })(),
    shipFiles: first.length,
    shipBytes: first.reduce((s, r) => s + r.bytes, 0),
  };

  // a second visit: to the C-137 page and back, the same tab
  phase = 'again';
  await page.evaluate(() => (location.hash = '#/c-137'));
  await page.waitForFunction(() => !document.querySelector('[data-gl]') || location.hash === '#/c-137', null, { timeout: 60000 });
  await page.waitForTimeout(3000);
  await page.evaluate(() => {
    performance.clearMarks('universe:ship-full');
    window.__ship.first = null;
    location.hash = '#/universe';
  });
  await waitFor(page, () => window.__ship.first != null && performance.getEntriesByName('universe:ship-full', 'mark').length > 0).catch((e) => errors.push(`second visit: ${e.message.split('\n')[0]}`));
  const two = await read(page);
  const again = shipReqs('again');
  result.again = {
    firstFrameMs: two.first == null ? null : Math.round(two.first),
    fullAtMs: two.full[0] ? Math.round(two.full[0].t) : null,
    fullOnFirstFrame: two.first != null && two.full[0] != null && two.full[0].t <= two.first,
    shipRequests: again.length,
    shipRequestsFromNetwork: again.filter((r) => !r.cached && r.status !== 304).length,
    shipBytes: again.reduce((s, r) => s + (r.cached ? 0 : r.bytes), 0),
  };
  result.errors = errors.slice(0, 5);
  await browser.close();
  return result;
}

// (the Chromium the container has, as universe-check.mjs finds it)
const exe = args.chromium ?? process.env.CHROMIUM ?? (await readdir('/opt/pw-browsers').catch(() => [])).filter((n) => /^chromium-\d+$/.test(n)).map((n) => [`/opt/pw-browsers/${n}/chrome-linux/chrome`, `/opt/pw-browsers/${n}/chrome-linux64/chrome`]).flat().find(existsSync);
if (!exe) throw new Error('no Chromium (set CHROMIUM=/path/to/chrome)');
// The cockpit's replay: the map up in the Falcon, the cockpit opened over it
// in another vehicle and launched; times from the flash (tp:arrive) to the
// white starting to clear (the veil's fade, cockpit/scene.js's clearOut) and
// to the launched ship's model mounted.
async function runLaunch(base, net, vehicle) {
  const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--js-flags=--max-old-space-size=4096'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript((q) => {
    window.localStorage.setItem('tp-intro', '1');
    window.localStorage.setItem('tp-start', '"universe"');
    window.localStorage.setItem('tp-quality', q);
    window.localStorage.setItem('tp-universe-ship', '"falcon"');
    window.localStorage.setItem('tp-sound', 'off');
    window.localStorage.setItem('tp-tour', 'skipped');
  }, QUALITY);
  await ctx.addInitScript(pageProbe);
  await ctx.addInitScript(() => {
    window.addEventListener('tp:arrive', () => (window.__ship.arrive ??= performance.now()));
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...a) {
      if (this.classList?.contains('cockpit-veil') && window.__ship.launched) window.__ship.clear ??= performance.now(); // (cleared as planned, before the flash's event, or held after it)
      return animate.apply(this, a);
    };
  });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  if (NETS[net]) await cdp.send('Network.emulateNetworkConditions', { offline: false, ...NETS[net] });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${base}/?quality=${QUALITY}#/universe`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
  await waitFor(page, () => window.__ship.first != null);
  console.error(`map drawn; opening the cockpit in the ${vehicle}`);
  await page.evaluate((v) => window.dispatchEvent(new CustomEvent('tp:cockpit', { detail: { vehicle: v } })), vehicle);
  await waitFor(page, () => document.querySelector('.cockpit[data-ready]'));
  const boardAt = await page.evaluate(() => performance.now());
  console.error('sat down; launching');
  await page.waitForTimeout(1500);
  await page.evaluate(() => (window.__ship.launched = true));
  await page.keyboard.press('Space');
  await waitFor(page, () => window.__ship.arrive != null, null, 120000).catch(() => console.error('no flash after Space'));
  console.error('flash');
  await waitFor(page, () => window.__ship.clear != null && !document.querySelector('.cockpit'));
  await page.waitForFunction((v) => performance.getEntriesByName('universe:ship-full', 'mark').some((m) => m.detail === v), vehicle, { timeout: 60000, polling: 250 }).catch(() => {});
  const got = await page.evaluate((v) => ({ arrive: window.__ship.arrive, clear: window.__ship.clear, full: performance.getEntriesByName('universe:ship-full', 'mark').find((m) => m.detail === v)?.startTime ?? null }), vehicle);
  await browser.close();
  const r = (x) => (x == null ? null : Math.round(x));
  return {
    net,
    launch: vehicle,
    boardToFlashMs: r(got.arrive - boardAt),
    whiteHeldMs: Math.max(0, r(got.clear - got.arrive)), // (the plan's own clear starts at the flash: 0 before)
    fullAfterFlashMs: got.full == null ? null : r(got.full - got.arrive),
    standInSeenAfterClearMs: got.full == null ? null : Math.max(0, r(got.full - got.clear)),
    errors: errors.slice(0, 5),
  };
}

const { base, stop } = await serve();
const results = [];
try {
  for (const net of nets) {
    const r = args.launch ? await runLaunch(base, net, String(args.launch)) : await run(base, net);
    console.log(JSON.stringify(r));
    results.push(r);
  }
} finally {
  stop();
}
if (args.out) {
  const out = resolve(ROOT, String(args.out));
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, `${JSON.stringify(results, null, 2)}\n`);
  console.log(`wrote ${join(out)}`);
}

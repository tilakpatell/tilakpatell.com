/* global window */
// How Hoth streams, measured from the browser's own network log. By default
// a laptop on wifi at the ultra level, the site's best: a 1440 × 900 screen
// at twice its pixels, the line held to 50 Mbit/s with 20 ms of latency (CDP
// Network.emulateNetworkConditions), `?quality=ultra`. It opens
// #/galaxy/hoth/surface and records:
//
//   first figure   ms from the world's scene mounting (window.__surface
//                  answers) to the first person drawn as a model
//   walkable MB    what was fetched by the time the world was up
//   most asks      the most times any one URL was downloaded (the browser's
//                  cache answering a second module's ask is not one)
//   fidelity       every model fetched at its best cut: no plain file where
//                  its .ultra cut exists, no .lod1 at all (ultra keeps the
//                  full model at every distance)
//   errors         console errors and page errors
//
// and fails (exit 1) past the profile's numbers (LIMITS). --phone is a phone
// on 3G (1.6 Mbit/s, 150 ms) at `mid`, held to the streaming plan's numbers
// (first figure within 8 s, the world up under 4 MB, no URL asked more than
// three times); --fast drops the throttle.
//
// Against a bundled site built in development mode, so the scene's test hook
// is there (NODE_ENV=development npx vite build --mode development --outDir
// /tmp/stream-dist &&
// npx vite preview --outDir /tmp/stream-dist --port 4173 --strictPort --host
// 127.0.0.1): the dev server's thousand unbundled modules are not what a
// visitor downloads, and a production build has no hook to read. Software GL,
// so its timings are the slow end; the fidelity and the asks are exact.
// (`calibrate=off`, as the QA scripts have it: the world drawn at its
// sharpest step without the twelve timed frames, minutes in software.)
//
// Since 2026-10-13 Hoth's surface address goes on to the game's menu
// (src/components/galaxy/gameLevels.js): the surface has no route until its
// free roam does, so this says so and stops (exit 2) rather than time out.
//
//   node scripts/stream-check.mjs [--phone] [--fast] [--json <file>]
//   BASE=http://127.0.0.1:4173 QUALITY=ultra|high|mid|low CHROME=<path> WAIT=90000

import { readdirSync } from 'node:fs';
import { readdir, writeFile } from 'node:fs/promises';
import { parseArgs } from './lib/args.mjs';

// each profile's numbers: the laptop's are fidelity's (every file once, at
// its best cut), the phone's the plan's (a small first download)
export const LIMITS = {
  laptop: { firstFigureMs: 8000, walkableMB: Infinity, mostAsks: 1, errors: 0, fidelity: true },
  phone: { firstFigureMs: 8000, walkableMB: 4, mostAsks: 3, errors: 0, fidelity: false },
};
export const WIFI = { offline: false, latency: 20, downloadThroughput: (50e6 / 8) | 0, uploadThroughput: (10e6 / 8) | 0 };
// 3G, as the plan sets it: 1.6 Mbit/s down, 150 ms
export const THREE_G = { offline: false, latency: 150, downloadThroughput: (1.6e6 / 8) | 0, uploadThroughput: (750e3 / 8) | 0 };
const PHONE_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36';

// the site paths that have an ultra cut, from public/
function ultraPaths() {
  const out = new Set();
  for (const dir of ['models/galaxy/surface', 'models/galaxy/crew']) {
    let names = [];
    try {
      names = readdirSync(new URL(`../public/${dir}/`, import.meta.url));
    } catch {
      continue;
    }
    for (const n of names) if (n.endsWith('.ultra.glb')) out.add(`/${dir}/${n}`);
  }
  return out;
}

// the verdict on what was measured: the lines that failed, empty when it held
export function failures(m, limits = LIMITS.laptop) {
  const out = [];
  if (limits.fidelity) for (const f of m.lower ?? []) out.push(`a lower cut than the best was fetched: ${f}`);
  if (m.firstFigureMs == null) out.push('no figure was drawn');
  else if (m.firstFigureMs > limits.firstFigureMs) out.push(`the first figure took ${(m.firstFigureMs / 1000).toFixed(1)} s (at most ${limits.firstFigureMs / 1000})`);
  if (m.walkableMB == null) out.push('the world never came up');
  else if (m.walkableMB >= limits.walkableMB) out.push(`${m.walkableMB.toFixed(2)} MB fetched before the world was up (under ${limits.walkableMB})`);
  if (m.mostAsks > limits.mostAsks) out.push(`${m.mostAsked} was asked ${m.mostAsks} times (at most ${limits.mostAsks})`);
  if (m.errors.length > limits.errors) out.push(`${m.errors.length} console error(s): ${m.errors.slice(0, 2).join(' | ')}`);
  return out;
}

// What was fetched below its best: a plain model whose .ultra cut exists
// (`ultra`: the site paths that have one), and any .lod1. A bucket URL is
// read as the site path after its hash.
export function lowerCuts(urls, ultra) {
  const out = new Set();
  for (const u of urls) {
    let path;
    try {
      path = new URL(u, 'http://x').pathname;
    } catch {
      continue;
    }
    path = path.replace(/^.*\/storage\/v1\/object\/public\/[^/]+\/[0-9a-f]{12}\//, '/');
    if (/\.lod1\.glb$/.test(path)) out.add(path);
    else if (path.endsWith('.glb') && !path.endsWith('.ultra.glb') && ultra.has(path.replace(/\.glb$/, '.ultra.glb'))) out.add(path);
  }
  return [...out].sort();
}

// requests per URL, from a list of the URLs asked (data: and blob: aside)
export function asks(urls) {
  const by = new Map();
  for (const u of urls) if (!/^(data|blob):/.test(u)) by.set(u, (by.get(u) ?? 0) + 1);
  let most = 0;
  let which = null;
  for (const [u, n] of by) if (n > most) [most, which] = [n, u];
  return { most, which, by };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const base = process.env.BASE ?? 'http://127.0.0.1:4173';
  const phone = Boolean(args.phone);
  const quality = process.env.QUALITY ?? (phone ? 'mid' : 'ultra');
  const limits = phone ? LIMITS.phone : LIMITS.laptop;
  const wait = Number(process.env.WAIT ?? 90000);
  const pw = (await readdir('/opt/pw-browsers').catch(() => []))
    .filter((n) => /^chromium-\d+$/.test(n))
    .sort()
    .reverse()
    .map((n) => `/opt/pw-browsers/${n}/chrome-linux/chrome`);
  const exe = process.env.CHROME ?? pw[0];
  if (!exe) {
    console.error('stream-check: no browser (CHROME=<path>)');
    return 2;
  }
  const { chromium } = await import('playwright-core');
  const { noisy } = await import('./lib/noise.mjs');
  const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
  try {
    const ctx = await browser.newContext(phone ? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, userAgent: PHONE_UA } : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
    // past the front door, the world loaded without asking (WorldGate), as hoth-check.mjs does
    await ctx.addInitScript(() => {
      const keep = (store, k, v) => {
        try {
          store.setItem(k, v);
        } catch {
          // (storage refused: the gates show)
        }
      };
      keep(window.localStorage, 'tp-intro', '1');
      keep(window.localStorage, 'tp-start', '"universe"');
      keep(window.localStorage, 'tp-galaxy-panel', '"tucked"');
      keep(window.localStorage, 'tp-worlds', '"load"');
      keep(window.localStorage, 'tp-tour', '"skipped"');
      keep(window.sessionStorage, 'tp-galaxy-intro', '1');
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(`page error: ${e.message}`.slice(0, 300)));
    page.on('console', (m) => m.type() === 'error' && !noisy(m.text()) && errors.push(`console: ${m.text()}`.slice(0, 300)));
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Network.enable');
    if (!args.fast) await cdp.send('Network.emulateNetworkConditions', phone ? THREE_G : WIFI);
    const urls = [];
    const bytes = new Map(); // requestId → encoded bytes
    const urlOf = new Map();
    // (an ask the browser's cache answered is no download: counted apart)
    const cached = new Set();
    cdp.on('Network.requestWillBeSent', (e) => urlOf.set(e.requestId, e.request.url));
    cdp.on('Network.requestServedFromCache', (e) => cached.add(e.requestId));
    cdp.on('Network.responseReceived', (e) => {
      if (e.response.fromDiskCache || e.response.fromPrefetchCache || e.response.fromServiceWorker) cached.add(e.requestId);
    });
    cdp.on('Network.loadingFailed', (e) => !e.canceled && urls.push(urlOf.get(e.requestId)));
    cdp.on('Network.loadingFinished', (e) => !cached.has(e.requestId) && urls.push(urlOf.get(e.requestId)));
    cdp.on('Network.loadingFinished', (e) => !cached.has(e.requestId) && bytes.set(e.requestId, e.encodedDataLength));
    cdp.on('Network.dataReceived', (e) => bytes.set(e.requestId, (bytes.get(e.requestId) ?? 0) + (e.encodedDataLength || 0)));
    const fetched = () => [...bytes.values()].reduce((s, n) => s + n, 0);
    const bucket = () => [...urlOf.values()].filter((u) => /\/storage\/v1\/object\/public\//.test(u)).length;

    const t0 = Date.now();
    await page.goto(`${base}/?quality=${quality}&calibrate=off#/galaxy/hoth/surface`, { waitUntil: 'domcontentloaded', timeout: 240000 });
    // the world up: the scene answers (the veil lifts as it does)
    const up = await page
      .waitForFunction(() => Boolean(window.__surface?.()?.phase) || !window.location.hash.includes('/surface'), null, { timeout: wait, polling: 100 })
      .then(() => Date.now())
      .catch(() => null);
    if (!page.url().includes('/surface')) {
      console.error(`stream-check: no surface at #/galaxy/hoth/surface: it went on to ${page.url().replace(base, '')} (the game's menu). Nothing to measure until Hoth's free roam has a route.`);
      return 2;
    }
    const walkableMB = up ? fetched() / 1e6 : null;
    const figure = up
      ? await page
          .waitForFunction(() => (window.__surface?.()?.people ?? []).some((p) => p.fig), null, { timeout: wait, polling: 100 })
          .then(() => Date.now())
          .catch(() => null)
      : null;
    // a moment more, for the retries and repeats a slow line brings
    await page.waitForTimeout(5000);
    const net = up ? await page.evaluate(() => window.__surface?.()?.net ?? null).catch(() => null) : null;
    const a = asks(urls);
    const m = {
      profile: `${phone ? 'phone' : 'laptop'} · ${args.fast ? 'unthrottled' : phone ? '3G (1.6 Mbit/s, 150 ms)' : 'wifi (50 Mbit/s, 20 ms)'} · ${quality}`,
      base,
      upMs: up ? up - t0 : null,
      firstFigureMs: up && figure ? figure - up : null,
      walkableMB,
      totalMB: fetched() / 1e6,
      requests: urls.length,
      bucketRequests: bucket(),
      mostAsks: a.most,
      mostAsked: a.which,
      lower: lowerCuts(urls, ultraPaths()),
      net,
      errors,
      // (every model and texture asked, with how often: the evidence's list)
      files: Object.fromEntries([...a.by].filter(([u]) => /\.(glb|ktx2|webp|jpe?g|png)(\?|$)/i.test(u)).sort()),
    };
    console.log(`stream-check (${m.profile}) against ${base}`);
    console.log(`  up after          ${m.upMs == null ? '—' : `${(m.upMs / 1000).toFixed(1)} s`}`);
    console.log(`  first figure      ${m.firstFigureMs == null ? '—' : `${(m.firstFigureMs / 1000).toFixed(1)} s after the scene mounted`}`);
    console.log(`  walkable          ${m.walkableMB == null ? '—' : `${m.walkableMB.toFixed(2)} MB fetched`}`);
    console.log(`  all told          ${m.totalMB.toFixed(2)} MB, ${m.requests} requests (${m.bucketRequests} of the bucket)`);
    console.log(`  most asks         ${m.mostAsks} (${m.mostAsked ?? '—'})`);
    if (net) console.log(`  the world's pool  ${(net.bytes / 1e6).toFixed(2)} MB in ${net.files} files; in flight ${net.pool?.inFlight}, queued ${net.pool?.queued}`);
    console.log(`  best cuts         ${m.lower.length ? `${m.lower.length} lower: ${m.lower.slice(0, 4).join(', ')}` : 'every model at its best'}`);
    console.log(`  errors            ${errors.length}`);
    if (typeof args.json === 'string') await writeFile(args.json, `${JSON.stringify(m, null, 2)}\n`);
    const bad = failures(m, limits);
    for (const b of bad) console.log(`FAIL: ${b}`);
    if (!bad.length) console.log('OK');
    return bad.length ? 1 : 0;
  } finally {
    await browser.close();
  }
}

if (process.argv[1]?.endsWith('stream-check.mjs')) {
  main().then(
    (code) => process.exit(code),
    (e) => {
      console.error(e.message);
      process.exit(2);
    },
  );
}

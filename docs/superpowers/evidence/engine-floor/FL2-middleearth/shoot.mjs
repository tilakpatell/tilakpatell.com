// Middle-earth shot the same way twice: the before and the after of lane
// FL2, compared pixel for pixel. autopilot-check's shots are taken after a
// wall-clock wait with the world moving, and kept as lossy WebP, so two
// shots of the same build differ; these are taken on a stopped clock.
// Playwright's clock owns time (Date, performance.now, timers and
// requestAnimationFrame), Math.random is seeded, and each shot is a fresh
// page: loaded, scrolled to its part, waited on until that part's canvas
// says it has drawn (data-on), then left `--settle` ms of real time (3000)
// for what's loading, then exactly `--frames` frames of 16 ms more (12),
// and shot as PNG. Both builds are development builds (`vite build --mode
// development`), for the frame guard's switch (window.__tpGuardOff): every
// frame is drawn whole, so what's on screen doesn't depend on when a shader
// linked.
//
//   node docs/superpowers/evidence/engine-floor/FL2-middleearth/shoot.mjs \
//     --dist <built site> --out <folder> [--only bree,mordor-ring] [--frames 12] [--quality high] [--map3d]
//   node …/shoot.mjs --compare <folder a> <folder b>

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { freePort } from '../../../../../scripts/lib/noise.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};

// Each part a shot: the route, and the element scrolled to (null: the top).
const PLACES = ['shire', 'bree', 'weathertop', 'rivendell', 'moria', 'lorien', 'amon-hen', 'dead-marshes', 'cirith-ungol', 'mordor', 'orthanc', 'minas-tirith', 'edoras'];
// each town's development handle (its *World.jsx), whose sim counts its
// frames' seconds: a town shows data-on before its first frame, and whether
// that frame had come by the time it was seen was a race in real time, so
// a town's shot counts from its first frame instead
const GLOBAL = { shire: '__SHIRE__', bree: '__BREE__', weathertop: '__WEATHERTOP__', rivendell: '__RIVENDELL__', moria: '__MORIA__', lorien: '__LORIEN__', 'amon-hen': '__AMONHEN__', 'dead-marshes': '__MARSHES__', 'cirith-ungol': '__CIRITHUNGOL__', mordor: '__DOOM__', orthanc: '__ORTHANC__', 'minas-tirith': '__MINAS__', edoras: '__EDORAS__' };
const ticked = (g) => `Boolean(window.${g}?.sim?.t > 0)`;
const RUSH = new Set(['shire', 'bree', 'weathertop', 'rivendell', 'moria', 'lorien', 'amon-hen', 'dead-marshes', 'cirith-ungol', 'mordor']);
export const SHOTS = [
  { id: 'hub', route: '/middle-earth', part: null, canvas: null },
  // (a town's shot is judged inside its stage: the map behind the page's
  // edges is still easing there, from when the page loaded, and the world
  // up a frame later than the stages were made puts it a frame further on;
  // the map itself is judged where it has come to rest, the hub's shot and
  // the parts')
  ...PLACES.map((p) => ({ id: p, route: `/middle-earth/${p}`, part: null, canvas: '.shire-world .shire-canvas', ticked: ticked(GLOBAL[p]), box: '.shire-world .shire-stage' })),
  // (the kitchens at Low: a part waits on the map behind it, about 200
  // frames, and a kitchen at High is seven seconds a frame in software)
  ...PLACES.filter((p) => RUSH.has(p)).map((p) => ({ id: `${p}-rush`, route: `/middle-earth/${p}`, part: '.rush', canvas: '.rush .shire-canvas', ticked: ticked('__RUSH__'), quality: 'low' })),
  { id: 'moria-bridge', route: '/middle-earth/moria', part: '#khazad-dum', canvas: '#khazad-dum .me-gl canvas' },
  { id: 'mordor-gorgoroth', route: '/middle-earth/mordor', part: '#gorgoroth', canvas: '#gorgoroth .me-gl canvas' },
  { id: 'mordor-ring', route: '/middle-earth/mordor', part: '#ring', canvas: '#ring .me-gl canvas' },
];

async function compare(a, b) {
  const sharp = (await import('sharp')).default;
  const names = (await readdir(a)).filter((n) => n.endsWith('.png')).sort();
  let bad = 0;
  for (const n of names) {
    if (!existsSync(join(b, n))) {
      console.log(`${n}: missing in ${b}`);
      bad++;
      continue;
    }
    const [x, y] = await Promise.all([a, b].map((d) => sharp(join(d, n)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })));
    if (x.info.width !== y.info.width || x.info.height !== y.info.height) {
      console.log(`${n}: sizes differ`);
      bad++;
      continue;
    }
    // (a shot that names its box is judged inside it: the box as shot before)
    const side = [a, b].map((d) => join(d, n.replace(/\.png$/, '.json'))).find(existsSync);
    const box = side ? JSON.parse(await readFile(side, 'utf8')).box : null;
    const W = x.info.width;
    const [x0, y0, x1, y1] = box ? [Math.max(0, box.x), Math.max(0, box.y), Math.min(W, box.x + box.w), Math.min(x.info.height, box.y + box.h)] : [0, 0, W, x.info.height];
    let off = 0;
    for (let py = y0; py < y1; py++)
      for (let px = x0; px < x1; px++) {
        const i = (py * W + px) * 4;
        if (x.data[i] !== y.data[i] || x.data[i + 1] !== y.data[i + 1] || x.data[i + 2] !== y.data[i + 2]) off++;
      }
    if (off) bad++;
    console.log(`${n.padEnd(28)} ${off} pixels differ${box ? ` (in its stage, ${x1 - x0} × ${y1 - y0})` : ''}`);
  }
  console.log(bad ? `${bad} of ${names.length} differ` : `all ${names.length} identical`);
  process.exit(bad ? 1 : 0);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let quietMs = 1200;

async function shoot() {
  const dist = resolve(opt('dist', 'dist'));
  const out = resolve(opt('out', 'shots'));
  const frames = Number(opt('frames', 12));
  const settle = Number(opt('settle', 3000));
  // (a part further down the page has the map behind it, easing to its
  // place on frames of its own since the page loaded: given time to come to
  // rest, its last place is the same however long the loading took)
  const partFrames = Number(opt('part-frames', 240));
  quietMs = Number(opt('quiet', 1200)); // (ms with nothing in flight after each loading frame)
  const probe = opt('probe');
  const map3d = args.includes('--map3d');
  const quality = opt('quality', 'high');
  const split = args.includes('--split-stream');
  const traceRandom = args.includes('--trace-random'); // (an expression read at the shot, for finding what differs)
  const only = opt('only')?.split(',');
  await mkdir(out, { recursive: true });
  const { chromium } = await import('playwright-core');
  const port = await freePort();
  const vite = join(dirname(createRequire(import.meta.url).resolve('vite/package.json')), 'bin/vite.js');
  const server = spawn(process.execPath, [vite, 'preview', '--outDir', dist, '--port', String(port), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore' });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; ; i++) {
    try {
      if ((await fetch(base)).ok) break;
    } catch {
      /* not yet */
    }
    if (i > 100) throw new Error('vite preview never answered');
    await new Promise((r) => setTimeout(r, 300));
  }
  const exe = process.env.CHROMIUM ?? (await readdir('/opt/pw-browsers')).filter((n) => /^chromium-\d+$/.test(n)).map((n) => `/opt/pw-browsers/${n}/chrome-linux/chrome`).find(existsSync);
  const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--js-flags=--max-old-space-size=4096'] });
  for (const shot of SHOTS) {
    if (only && !only.includes(shot.id)) continue;
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    // (--map3d: the WebGL map, which a browser drawing in software never
    // gets, by development's switch, MapBackdrop.jsx's forced())
    if (traceRandom) await ctx.addInitScript(() => window.localStorage.setItem('tp-trace-random', '1'));
    if (map3d) await ctx.addInitScript(() => window.localStorage.setItem('tp-map3d', 'force'));
    await ctx.addInitScript(([q, split]) => {
      window.localStorage.setItem('tp-intro', '1');
      window.localStorage.setItem('tp-start', '"universe"');
      window.localStorage.setItem('tp-quality', q);
      window.sessionStorage.setItem('tp-me-opening', '1');
      // (a seeded random: mulberry32; seeded again where the frames counted
      // begin, since what loads draws from it in an order of its own, and
      // a splash of rain landed elsewhere from one shot to the next)
      let s = 0x2f6b1d3;
      window.__reseed = (n) => {
        s = n;
      };
      const next = (k) => {
        k.s = (k.s + 0x6d2b79f5) | 0;
        let t = Math.imul(k.s ^ (k.s >>> 15), 1 | k.s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
      const main = {
        get s() {
          return s;
        },
        set s(v) {
          s = v;
        },
      };
      // (what the runtime draws from it, its renderer and its views made
      // before the scenes are, three's ids for what they make, comes from a
      // stream of its own: the after build has the runtime and the before
      // hasn't, and a scene built after it took its embers' places from
      // further down the one stream)
      const own = { s: 0x7a11 };
      const ids = { s: 0x1d5 };
      const runtime = /\/assets\/(runtime|browser|views|module)-[\w-]+\.js/;
      Error.stackTraceLimit = 64;
      // (--trace-random: each call's chunks, for finding where two builds part)
      window.__randoms = [];
      Math.random = () => {
        if (window.__traceRandom) {
          const chunks = (new Error().stack.match(/\/assets\/[\w.-]+?(?=-[\w-]{8}\.js)/g) ?? []).map((c) => c.slice(8));
          window.__randoms.push(`${Math.round(performance.now())} ${[...new Set(chunks)].slice(0, 4).join('<')}`);
        }
        if (split && runtime.test(new Error().stack)) return next(own);
        // (three's own draws, its ids for what's made, generateUUID, from a
        // stream of their own: each stage made a renderer of its own before,
        // 36 draws each, and the after build makes one, so every scene made
        // after the first took its rain and its embers from 36 further down)
        const caller = new Error().stack.split('\n')[2] ?? '';
        if (/\/assets\/three\.[\w]+-[\w-]+\.js/.test(caller)) return next(ids);
        return next(main);
      };
      window.__traceRandom = localStorage.getItem('tp-trace-random') === '1';
      if (window.__traceRandom) {
        const realFetch = window.fetch;
        window.fetch = (input, init) => {
          const url = String(input?.url ?? input).replace(/^.*\/\/[^/]+/, '');
          window.__randoms.push(`${Math.round(performance.now())} FETCH ${url}`);
          return realFetch(input, init).then((r) => {
            window.__randoms.push(`${Math.round(performance.now())} FETCHED ${url}`);
            return r;
          });
        };
      }
    }, [shot.quality ?? quality, split]);
    // (the page's CSS animations and transitions run on real time: none)
    await ctx.addInitScript(() => {
      const still = () => {
        const st = document.createElement('style');
        st.textContent = '*, *::before, *::after { animation: none !important; transition: none !important; }';
        document.head.appendChild(st);
      };
      if (document.head) still();
      else document.addEventListener('DOMContentLoaded', still);
    });
    const page = await ctx.newPage();
    await page.clock.install({ time: new Date('2026-10-15T12:00:00Z') });
    // (installed, it still runs on real time: stopped)
    await page.clock.pauseAt(new Date('2026-10-15T12:00:01Z'));
    // (a response is handed over only between frames, never while the
    // clock is stepped: what a load sets going, a scene made, its first
    // frame asked for, then happens in the gap after it, and a frame never
    // lands before or after a load by the luck of the moment it arrived)
    // (and handed over in one order, the address's, one at a time, so two
    // builds that asked for the same files at another moment have them
    // arrive in the same order: a figure's model came in before the
    // kitchen's first frame in one build and after it in the other)
    let stepping = false;
    const waiting = [];
    let fetching = 0; // (asked of the server, not back yet)
    await page.route('**/*', async (route) => {
      let response;
      fetching += 1;
      try {
        response = await route.fetch();
      } catch {
        return route.abort().catch(() => {});
      } finally {
        fetching -= 1;
      }
      await new Promise((release) => waiting.push({ url: route.request().url(), release: () => route.fulfill({ response }).catch(() => {}).then(release) }));
    });
    const handOver = async () => {
      while (waiting.length) {
        // (everything asked for back from the server first, then all of it in order)
        for (let t = 0; fetching > 0 && t < 10000; t += 10) await sleep(10);
        await sleep(30);
        const round = waiting.splice(0).sort((x, y) => (x.url < y.url ? -1 : x.url > y.url ? 1 : 0));
        for (const w of round) {
          if (stepping) {
            waiting.unshift(w);
            break;
          }
          await w.release();
          await sleep(10);
        }
      }
    };
    const step = async (ms) => {
      // (not while a round of answers is being handed over)
      while (pumping) await sleep(5);
      stepping = true;
      try {
        await page.clock.runFor(ms);
      } finally {
        stepping = false;
      }
    };
    // (requests in flight: a loading frame waits for them, in real time)
    let inflight = 0;
    page.on('request', () => inflight++);
    page.on('requestfinished', () => inflight--);
    page.on('requestfailed', () => inflight--);
    // (the answers handed over whenever the clock isn't being stepped: the
    // page's own load waits on them too)
    let pumping = false;
    const pump = setInterval(() => {
      if (pumping || stepping || !waiting.length) return;
      pumping = true;
      handOver().finally(() => (pumping = false));
    }, 20);
    const quiet = async () => {
      let still = 0;
      for (let t = 0; t < 30000 && still < quietMs; t += 50) {
        await sleep(50);
        still = inflight > 0 || waiting.length ? 0 : still + 50;
      }
    };
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const started = Date.now();
    let note = '';
    try {
      await page.goto(`${base}/#${shot.route}`, { waitUntil: 'load', timeout: 120000 });
      // time moves only as we say: a frame's worth, then real time for the
      // loading to get on, until the part's canvas has drawn
      const ready = async () => {
        if (shot.part) await page.evaluate((sel) => document.querySelector(sel)?.scrollIntoView({ block: 'start' }), shot.part);
        // (the hub waits for the WebGL map where it's drawn)
        const canvas = shot.canvas ?? (map3d ? '.me-atlas canvas[data-layer="gl"]' : null);
        if (!canvas) return true;
        const on = await page.evaluate((sel) => Boolean(document.querySelector(sel)?.hasAttribute('data-on')), canvas);
        return on && (!shot.ticked || (await page.evaluate(shot.ticked)));
      };
      // Loading takes the same number of frames each time: each frame is
      // followed by real time until nothing is in flight, so the clock reads
      // the same at the shot (the Ring turns by performance.now(), a town by
      // the frames it was given).
      // (every frame drawn whole: the frame guard holds a shader back until
      // it has linked, in real time, so which frame it first came into
      // differed from shot to shot; asked of every guard made since)
      const whole = () => page.evaluate(() => window.__tpGuardOff?.());
      let ok = false;
      for (let i = 0; i < 3000 && !ok; i++) {
        await whole();
        await step(16);
        await quiet();
        ok = await ready();
      }
      if (!ok) note = ' (never drew)';
      if (probe) note += ` at ready: ${JSON.stringify(await page.evaluate(probe).catch((e) => String(e.message)))}`;
      // what's still loading comes in on a stopped clock, before the frames counted
      await quiet();
      await sleep(settle);
      if (traceRandom) await writeFile(join(out, `${shot.id}.randoms.txt`), (await page.evaluate(() => window.__randoms)).join('\n'));
      await page.evaluate(() => window.__reseed(0x51ed));
      const trace = [];
      for (let i = 0; i < (shot.part ? Math.max(frames, partFrames) : frames); i++) {
        await whole();
        await step(16);
        await sleep(5);
        if (probe && args.includes('--trace')) trace.push(await page.evaluate(probe).catch(() => null));
      }
      if (trace.length) note += ` trace: ${JSON.stringify(trace)}`;
      if (probe) note += ` probe: ${JSON.stringify(await page.evaluate(probe).catch((e) => String(e.message)))}`;
      // (straight from the compositor: Playwright's screenshot waits on a
      // frame the stopped clock never gives it)
      const cdp = await ctx.newCDPSession(page);
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
      await writeFile(join(out, `${shot.id}.png`), Buffer.from(data, 'base64'));
      if (shot.box) {
        const box = await page.evaluate((sel) => {
          const r = document.querySelector(sel)?.getBoundingClientRect();
          return r ? { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } : null;
        }, shot.box);
        await writeFile(join(out, `${shot.id}.json`), JSON.stringify({ box }));
      }
    } catch (e) {
      note = ` failed: ${String(e.message).split('\n')[0]}`;
    }
    clearInterval(pump);
    console.log(`${shot.id.padEnd(20)} ${((Date.now() - started) / 1000).toFixed(0)}s${note}${errors.length ? ` errors: ${errors.slice(0, 2).join(' | ')}` : ''}`);
    await ctx.close();
  }
  await browser.close();
  server.kill();
}

if (args[0] === '--compare') await compare(resolve(args[1]), resolve(args[2]));
else await shoot();

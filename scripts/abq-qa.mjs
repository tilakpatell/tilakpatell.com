/* global window, document, requestAnimationFrame */
// QA for Albuquerque: screenshots at named times from a fixed peek, plus
// renderer counts and frame times. Uses the vite dev server (peek/scene are dev only).
//   node scripts/abq-qa.mjs --tag before --quality low --frames 12 [--times dawn,noon] [--view walt|central|central-slant|park|rv]
//        [--name abq-grounding] [--port 5199] [--reuse] [--no-shots] [--chromium /path/to/chrome]
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { writeFile, mkdir, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import sharp from 'sharp';

// (a path, not the URL's pathname: on Windows that would start /C:/)
const ROOT = fileURLToPath(new URL('..', import.meta.url));

const args = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (!argv[i].startsWith('--')) continue;
  const k = argv[i].slice(2);
  const n = argv[i + 1];
  if (n === undefined || n.startsWith('--')) args[k] = true;
  else args[k] = argv[++i];
}
const tag = args.tag ?? 'test';
const quality = args.quality ?? 'low';
const frames = Number(args.frames ?? 12);
const port = Number(args.port ?? 5199);
const outDir = args.out ?? join(ROOT, 'docs/superpowers/shots');
const TIMES = { dawn: 0.262, noon: 0.5, golden: 0.71, night: 0.93 };
const times = (args.times ?? 'dawn,noon,golden,night').split(',');
const views = {
  walt: { at: [-74, 22, -38], look: [-97, 0.5, -70] },
  central: { at: [22, 30, 30], look: [-6, 0, -4] },
  // down Central at a slant, from just east of 4th, low: where a tiled road shows its repeat
  'central-slant': { at: [34, 4.2, 4.5], look: [-40, 0, -1] },
  // the park's lawn and trees, from its south-east corner
  park: { at: [-60, 8, 116], look: [-90, 0.3, 88] },
  rv: { at: [-318, 16, 146], look: [-338, 0.5, 126] },
};
const viewName = args.view ?? 'walt';
const view = views[viewName];
const shotName = args.name ?? 'abq-grounding';

let server = null;
if (!args.reuse) {
  // vite found as node finds it: a worktree has no node_modules of its own
  const vite = join(dirname(createRequire(import.meta.url).resolve('vite/package.json')), 'bin/vite.js');
  server = spawn(process.execPath, [vite, '--port', String(port), '--strictPort', '--host', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
}
const base = `http://127.0.0.1:${port}`;
for (let t0 = Date.now(); ; ) {
  try {
    if ((await fetch(base)).ok) break;
  } catch {
    /* not yet */
  }
  if (Date.now() - t0 > 60000) throw new Error('vite never answered');
  await new Promise((r) => setTimeout(r, 300));
}
// the browser: as asked, the cloud sandbox's, or one installed on this machine
const LOCAL = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/chromium',
];
const sandbox = (await readdir('/opt/pw-browsers').catch(() => [])).filter((n) => /^chromium-\d+$/.test(n)).map((n) => `/opt/pw-browsers/${n}/chrome-linux/chrome`);
const exe = args.chromium ?? process.env.CHROME ?? process.env.CHROMIUM ?? [...sandbox, '/opt/pw-browsers/chromium', ...LOCAL].find(existsSync);
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--js-flags=--max-old-space-size=6144'] });
const ctx = await browser.newContext({ viewport: { width: 960, height: 600 }, deviceScaleFactor: 1 });
await ctx.addInitScript((q) => {
  window.localStorage.setItem('tp-intro', '1');
  window.localStorage.setItem('tp-3d', 'on');
  window.localStorage.setItem('tp-worlds', '"load"');
  window.localStorage.setItem('tp-software', '"on"'); // (past the Star Wars worlds' GPU gate, lib/fit)
  window.localStorage.setItem('tp-quality', q);
  window.localStorage.setItem('tp-start', '"universe"');
  window.__tpKeepFrames = true;
  // software WebGL draws a frame in seconds, which the stage's watchdog takes
  // as a slow device and turns the shadows off: hand the page a steady 60 Hz
  // clock so the picture stays the one a real GPU gets (frame times are
  // measured with performance.now below)
  {
    const raf = window.requestAnimationFrame.bind(window);
    let lastReal = -1;
    let fake = 0;
    window.requestAnimationFrame = (cb) => raf((t) => { if (t !== lastReal) { lastReal = t; fake += 1000 / 60; } cb(fake); });
  }
  // count every draw the page makes, all passes included (three's own info
  // resets with each pass a composer runs)
  const G = { calls: 0, tris: 0 };
  window.__gl = G;
  const T = 4; // gl.TRIANGLES
  for (const C of [window.WebGL2RenderingContext, window.WebGLRenderingContext]) {
    if (!C) continue;
    const p = C.prototype;
    const de = p.drawElements, da = p.drawArrays, dei = p.drawElementsInstanced, dai = p.drawArraysInstanced;
    p.drawElements = function (m, c, ...r) { G.calls++; if (m === T) G.tris += c / 3; return de.call(this, m, c, ...r); };
    p.drawArrays = function (m, f, c) { G.calls++; if (m === T) G.tris += c / 3; return da.call(this, m, f, c); };
    if (dei) p.drawElementsInstanced = function (m, c, t, o, n) { G.calls++; if (m === T) G.tris += (c / 3) * n; return dei.call(this, m, c, t, o, n); };
    if (dai) p.drawArraysInstanced = function (m, f, c, n) { G.calls++; if (m === T) G.tris += (c / 3) * n; return dai.call(this, m, f, c, n); };
  }
}, quality);
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('pageerror:', e.message));
page.on('console', (m) => m.type() === 'error' && console.log('console:', m.text().slice(0, 300)));
const t0 = Date.now();
await page.goto(`${base}/#/albuquerque`, { waitUntil: 'load', timeout: 180000 });
await page.waitForFunction(() => window.__ABQ__?.api, null, { timeout: 600000, polling: 1000 });
console.log(`world up in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
await page.evaluate(() => window.__ABQ__.api.settle());
// let models and the first compile finish
await page.waitForTimeout(Number(args.settle ?? 15000));

const frameStats = async (n) =>
  page.evaluate(
    (n) =>
      new Promise((res) => {
        const ts = [];
        const gl = [];
        const tick = () => {
          ts.push(performance.now());
          gl.push({ ...window.__gl });
          if (ts.length > n) {
            const gaps = ts.slice(1).map((x, i) => x - ts[i]);
            const info = window.__ABQ__.api.info();
            const per = gl.slice(1).map((g, i) => ({ calls: g.calls - gl[i].calls, tris: g.tris - gl[i].tris }));
            const glCalls = per.reduce((a, b) => a + b.calls, 0) / per.length;
            const glTris = per.reduce((a, b) => a + b.tris, 0) / per.length;
            const sorted = [...gaps].sort((a, b) => a - b);
            res({ glCalls, glTris, mean: gaps.reduce((a, b) => a + b, 0) / gaps.length, median: sorted[Math.floor(sorted.length / 2)], min: sorted[0], max: sorted.at(-1), info });
          } else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    n,
  );

const results = {};
await mkdir(outDir, { recursive: true });
for (const name of times) {
  await page.evaluate(([tod, v]) => {
    const a = window.__ABQ__.api;
    a.setTime(tod, { jump: true });
    a.peek(v.at, v.look);
  }, [TIMES[name], view]);
  // a few frames for the light to land
  await frameStats(3);
  const st = await frameStats(frames);
  results[name] = st;
  console.log(`${name}: frame ${st.mean.toFixed(0)} ms (median ${st.median.toFixed(0)}, min ${st.min.toFixed(0)}, max ${st.max.toFixed(0)}) gl calls ${st.glCalls.toFixed(0)} gl tris ${Math.round(st.glTris)} | info calls ${st.info.calls} tris ${st.info.triangles} shadows ${st.info.shadows} dpr ${st.info.dpr}`);
  if (!args['no-shots']) {
    // (the world alone: the HUD and the page's bar hidden over it)
    const clip = await page.evaluate(() => {
      const c = [...document.querySelectorAll('canvas')].sort((a, b) => b.width * b.height - a.width * a.height)[0];
      c.setAttribute('data-qa', '');
      const r = c.getBoundingClientRect();
      return { x: Math.max(0, r.x), y: Math.max(0, r.y), width: Math.min(r.width, window.innerWidth), height: Math.min(r.height, window.innerHeight - Math.max(0, r.y)) };
    });
    await page.addStyleTag({ content: 'body * { visibility: hidden !important; } canvas[data-qa] { visibility: visible !important; }' }).catch(() => {});
    const png = await page.screenshot({ type: 'png', timeout: 180000, clip });
    const file = join(outDir, `2026-10-06-${shotName}-${name}-${tag}.webp`);
    await writeFile(file, await sharp(png).resize(960, 600, { fit: 'cover' }).webp({ quality: 80 }).toBuffer());
    console.log(' ->', file);
  }
}
await writeFile(join(args.json ?? tmpdir(), `qa-${tag}-${quality}-${viewName}.json`), JSON.stringify(results, null, 1));
await browser.close();
server?.kill();

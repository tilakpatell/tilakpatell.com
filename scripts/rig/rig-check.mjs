/* global window */
// Does a figure skinned by skin.mjs play the site's clips? It loads the
// figure in headless Chromium through the dev server with the site's own
// loader (scripts/rig/rig-check.html), and plays each clip the way a world
// does: its own idle, walk and run beside it (NAME-idle.glb…, else the
// library's), every other clip through lib/three/clipLibrary.js's
// forFigure, retargeted by the hips' height. It says, and fails on:
//   - a bone of Meshy's 24 missing by name, or a role lib/three/rig.js
//     looks for (the hips, the head, each arm, forearm, hand, thigh, calf,
//     foot and toe) not found;
//   - a clip that won't load, moves a bone the figure hasn't, or poses it
//     into nonsense (a NaN);
//   - the soles off the floor in the walk or the idle: the lowest of them,
//     frame by frame, further than FLOOR from y = 0 (in the walk one foot
//     is always down; standing, both are);
//   - a planted toe sliding as the figure walks at its walk's own pace, as
//     scripts/anim-check.mjs measures it (toeDrift, under its LIMIT).
// The run, a cast, a sit and a fall are played and reported (how low the
// body goes), not judged: a fall ends on the floor, a sit lower still.
//
//   node scripts/rig/rig-check.mjs FIGURE.glb [more.glb…] [--sheet OUT.webp] [--clips idle,walk,…]
//     [--base http://127.0.0.1:5297] [--chrome edge|PATH] [--json OUT.json]
//   (no --base: a dev server of its own is started on a free port)
//   --sheet: four views of the figure in its idle, its walk and a cast
//     (`ual-cast`), a row each, as a WebP under 1 MB (one figure only);
//     --rows a,b,c: other clips for the rows (to see how a clip reads on it)
//
//   verdict(result) → { ok, problems: [sentence], numbers } (pure: tested in rig-check.test.mjs)

import { existsSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { browserPath, LIMIT, PLANT, toeDrift } from '../anim-check.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const CLIPS = ['idle', 'walk', 'run', 'cast', 'sit.down', 'knockdown'];
export const SHEET = ['idle', 'walk', 'cast'];
export const FLOOR = 0.04; // the most the walk's lowest sole may be off the floor (m)
export const STAND = 0.02; // and the idle's
export const LUKE_HIPS = 95.5; // the hips' height of the skeleton the clips were made on (cm)
export const ROLES = ['hips', 'head', 'armL', 'foreL', 'handL', 'armR', 'foreR', 'handR', 'thighL', 'calfL', 'footL', 'toeL', 'thighR', 'calfR', 'footR', 'toeR'];

const worst = (ys) => Math.max(...ys.map((y) => Math.abs(y)));

// What the page found and measured, judged: problems as sentences, none
// meaning it passes.
export function verdict(r, { floor = FLOOR, stand = STAND, limit = LIMIT, clips = CLIPS } = {}) {
  const problems = [];
  const numbers = {};
  if (r.errors?.length) problems.push(`the page failed: ${r.errors[0].split('\n')[0]}`);
  if (r.missing?.length) problems.push(`bones missing: ${r.missing.join(', ')}`);
  const roles = new Set(r.roles ?? []);
  const lost = ROLES.filter((k) => !roles.has(k));
  if (lost.length) problems.push(`lib/three/rig.js finds no ${lost.join(', ')}`);
  for (const n of clips) {
    const c = r.clips?.[n];
    if (!c || c.missing) {
      problems.push(`${n}: no clip`);
      continue;
    }
    if (c.lost?.length) problems.push(`${n}: moves bones the figure hasn’t (${c.lost.join(', ')})`);
    if (c.nan) problems.push(`${n}: poses the figure into nonsense (NaN)`);
    numbers[n] = { sole: [Math.min(...c.soleY), Math.max(...c.soleY)], body: Math.min(...c.bodyY) };
  }
  const walk = r.clips?.walk;
  if (walk?.soleY?.length) {
    const off = worst(walk.soleY);
    numbers.walkFloor = off;
    if (off > floor) problems.push(`walk: the lowest sole comes ${(off * 100).toFixed(1)} cm off the floor (at most ${floor * 100})`);
  }
  const idle = r.clips?.idle;
  if (idle?.soleY?.length) {
    const off = worst(idle.soleY);
    numbers.idleFloor = off;
    if (off > stand) problems.push(`idle: the soles come ${(off * 100).toFixed(1)} cm off the floor (at most ${stand * 100})`);
  }
  if (r.walked) {
    // (a toe is down within PLANT of its lowest, 3 cm on a figure Luke's size; a small figure's swing foot
    // clears the ground by less, so the bar is its own size: the hips' height against Luke's 95.5 cm)
    const plant = PLANT * Math.min(1, (r.rest?.hipsY ?? LUKE_HIPS) / LUKE_HIPS);
    const drifts = r.walked.series.map((s) => toeDrift(s, { plant }).drift).filter((d) => d != null);
    numbers.plant = plant;
    numbers.walkSpeed = r.walked.speed;
    numbers.drift = drifts.length ? Math.max(...drifts) : null;
    if (!(r.walked.speed > 0)) problems.push('walk: no stride measured (the toes never plant)');
    else if (!drifts.length) problems.push('walk: neither toe stays down long enough to measure');
    else if (numbers.drift > limit) problems.push(`walk: a planted toe slides ${numbers.drift.toFixed(2)} m/s (at most ${limit})`);
  } else problems.push('walk: not walked');
  return { ok: problems.length === 0, problems, numbers };
}

const freePort = () =>
  new Promise((done, fail) => {
    const s = createServer();
    s.unref();
    s.on('error', fail);
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => done(port));
    });
  });

// A dev server of its own, serving the repository (so /scripts/rig/rig-check.html and /src/ resolve).
export async function devServer() {
  const { createServer: vite } = await import('vite');
  const port = await freePort();
  const server = await vite({ root: ROOT, logLevel: 'error', server: { port, strictPort: true, host: '127.0.0.1' } });
  await server.listen();
  return { base: `http://127.0.0.1:${port}`, close: () => server.close() };
}

const urlOf = (file) => {
  const rel = relative(ROOT, file).split('\\').join('/');
  return `/${rel.startsWith('public/') ? rel.slice('public/'.length) : rel}`;
};

// One figure through the page: its result, and the sheet's PNG when asked.
// (query: more for the page, such as loco=idle.calm,walk.casual,jog to try other library clips for its own)
export async function check(file, { base, browser, clips = CLIPS, sheet = null, w = 300, h = 400, query = {} }) {
  const url = urlOf(file);
  const stem = file.replace(/\.glb$/, '');
  const own = ['idle', 'walk', 'run'].every((n) => existsSync(`${stem}-${n}.glb`)) ? urlOf(stem) : null;
  const page = await browser.newPage({ viewport: { width: w * 4, height: h * (sheet?.length ?? 1) } });
  try {
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const q = new URLSearchParams({ url, clips: clips.join(','), w: String(w), h: String(h) });
    if (own) q.set('own', own);
    // (the hips' height its manifest gives the library's clips, when it has one beside it)
    const manifest = join(dirname(file), 'cast.json');
    const name = basename(file).replace(/(\.hq|\.lo)?\.glb$/, '');
    const hipsY = existsSync(manifest) ? JSON.parse(readFileSync(manifest, 'utf8')).figures?.[name]?.hipsY : null;
    if (hipsY) q.set('hips', String(hipsY));
    if (sheet) q.set('sheet', sheet.join(','));
    for (const [k, v] of Object.entries(query)) q.set(k, v);
    // (the dev server's first visit bundles three and the site's libraries: slow)
    await page.goto(`${base}/scripts/rig/rig-check.html?${q}`, { waitUntil: 'commit', timeout: 300000 });
    await page.waitForFunction(() => window.__rig, null, { timeout: 900000 });
    const r = await page.evaluate(() => window.__rig);
    r.errors = [...(r.errors ?? []), ...errors];
    r.own = own;
    const png = sheet ? await page.locator('canvas').screenshot() : null;
    return { result: r, png };
  } finally {
    await page.close();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const flag = (n, d) => {
    const i = args.indexOf(`--${n}`);
    return i >= 0 ? args.splice(i, 2)[1] : d;
  };
  const sheetOut = flag('sheet');
  const rows = flag('rows', SHEET.join(',')).split(',');
  const clips = flag('clips', CLIPS.join(',')).split(',');
  const jsonOut = flag('json');
  const exe = browserPath(flag('chrome'), process.env, ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome']);
  let base = flag('base', process.env.BASE);
  const files = args.map((f) => resolve(f));
  if (!files.length) throw new Error('usage: node scripts/rig/rig-check.mjs FIGURE.glb [more.glb…] [--sheet OUT.webp] [--base URL]');
  if (!exe) throw new Error('no Chromium or Edge here: set CHROME');
  const server = base ? null : await devServer();
  base ??= server.base;
  const { chromium } = await import('playwright-core');
  const browser = await chromium.launch({ executablePath: exe, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  let failed = 0;
  const all = {};
  try {
    for (const file of files) {
      const { result, png } = await check(file, { base, browser, clips, sheet: sheetOut ? rows : null });
      const v = verdict(result, { clips });
      all[file] = { verdict: v, own: result.own, rest: result.rest };
      const n = v.numbers;
      console.log(`${relative(ROOT, file)}: ${v.ok ? 'ok' : 'FAILED'}; ${result.own ? 'its own idle, walk and run' : 'the library’s idle, walk and run'}; walk ${n.walkSpeed?.toFixed(2) ?? '-'} m/s, toes slide ${n.drift?.toFixed(3) ?? '-'} m/s, lowest sole within ${n.walkFloor != null ? (n.walkFloor * 100).toFixed(1) : '-'} cm walking, ${n.idleFloor != null ? (n.idleFloor * 100).toFixed(1) : '-'} cm standing`);
      for (const c of clips) if (n[c]) console.log(`  ${c.padEnd(10)} soles ${n[c].sole.map((y) => (y * 100).toFixed(1)).join(' to ')} cm, body down to ${(n[c].body * 100).toFixed(1)} cm`);
      for (const p of v.problems) console.log(`  ! ${p}`);
      if (!v.ok) failed++;
      if (png && sheetOut) {
        const { default: sharp } = await import('sharp');
        await mkdir(dirname(resolve(sheetOut)), { recursive: true });
        let q = 82;
        let buf = await sharp(png).webp({ quality: q }).toBuffer();
        while (buf.length > 1000 * 1024 && q > 40) buf = await sharp(png).webp({ quality: (q -= 10) }).toBuffer();
        await writeFile(resolve(sheetOut), buf);
        console.log(`  sheet: ${sheetOut} (${(buf.length / 1024).toFixed(0)} KB)`);
      }
    }
  } finally {
    await browser.close();
    await server?.close();
  }
  if (jsonOut) await writeFile(resolve(jsonOut), JSON.stringify(all, null, 2));
  process.exit(failed ? 1 : 0);
}

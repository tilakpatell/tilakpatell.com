/* global window */
// Albuquerque's floor shadows, baked: for each area of the world, a mask of
// how much of the sun reaches each point of the floor at dawn, noon and
// golden hour (R, G, B) and how much of the sky does (A), rendered by the
// world's own scene in headless Chromium (its api.bake, in development; the
// rendering is lib/three/grounding-bake.js) and kept as lossless WebP beside
// an index the world reads them by (lib/three/grounding's loadFloorShadow).
// Software WebGL takes minutes an area; it runs once and the result is
// committed, like every other asset here.
//
//   public/albuquerque/shadow/{city,rv,arches-w,arches-e}.webp, index.json
//
// Run:   npm run bake:abq [-- names...] [--size city=1024] [--samples 48,64]
//        [--out dir] [--chromium /path/to/chrome]
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { chromium } from 'playwright-core';

// (a path, not the URL's pathname: on Windows that would start /C:/)
const ROOT = fileURLToPath(new URL('..', import.meta.url));

// The areas, in metres (x0, z0 the north-west corner; w east, d south), and
// each one's mask size: rendered at `size`, kept at `ship` (each kept texel
// the average of the rendered ones it covers: the city's mask at 2048² is
// nearly 2 MB even lossless, and averaged down to 1024² it's half that and
// smoother than one rendered at 1024²). Later ones are read over earlier ones
// where they overlap: the arches and billboards on Route 66 get finer tiles.
const AREAS = [
  { name: 'city', x0: -300, z0: -240, w: 600, d: 480, size: 2048, ship: 1024 },
  { name: 'rv', x0: -380, z0: 90, w: 80, d: 70, size: 512 },
  { name: 'arches-w', x0: -296, z0: -30, w: 60, d: 60, size: 512 },
  { name: 'arches-e', x0: 236, z0: -30, w: 60, d: 60, size: 512 },
];
// The named times (sky.js's TIMES) and the channel each is kept in. Night
// and the moments the sun is down are the sky term alone (channel 3): the
// sun's shadows come in as it rises and go as it sets. Dawn's sun stands
// under 4° up, and baked where it is it threw every building's shadow across
// the next block: the mask drowned the town. It's baked as high as golden
// hour's (12.8°), so the morning's shadows run as long as the evening's, the
// other way (`lift`, lib/three/grounding-bake's liftSun).
const TIMES = [
  { tod: 0.245, channel: 3 },
  { tod: 0.262, channel: 0, name: 'dawn', lift: 12.8 },
  { tod: 0.5, channel: 1, name: 'noon' },
  { tod: 0.71, channel: 2, name: 'golden' },
  { tod: 0.76, channel: 3 },
];
const LIMIT = 1.3 * 1024 * 1024; // the most a mask may weigh

const args = { names: [], sizes: {} };
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--size') {
    for (const kv of argv[++i].split(',')) {
      const [k, v] = kv.split('=');
      args.sizes[k] = Number(v);
    }
  } else if (a === '--samples') [args.sun, args.sky] = argv[++i].split(',').map(Number);
  else if (a === '--out') args.out = argv[++i];
  else if (a === '--chromium') args.chromium = argv[++i];
  else if (!a.startsWith('--')) args.names.push(a);
}
const OUT = args.out ?? join(ROOT, 'public/albuquerque/shadow');
const todo = AREAS.filter((a) => !args.names.length || args.names.includes(a.name));

// ── the dev server and the browser ──
const port = await new Promise((res) => {
  const s = createServer();
  s.listen(0, '127.0.0.1', () => {
    const p = s.address().port;
    s.close(() => res(p));
  });
});
// vite found as node finds it: a worktree has no node_modules of its own
const vite = join(dirname(createRequire(import.meta.url).resolve('vite/package.json')), 'bin/vite.js');
const server = spawn(process.execPath, [vite, '--port', String(port), '--strictPort', '--host', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
const base = `http://127.0.0.1:${port}`;
for (const t0 = Date.now(); ; ) {
  try {
    if ((await fetch(base)).ok) break;
  } catch {
    /* not yet */
  }
  if (Date.now() - t0 > 60000) {
    server.kill();
    throw new Error('vite never answered');
  }
  await new Promise((r) => setTimeout(r, 300));
}
// the browser: as asked, the cloud sandbox's, or one installed on this machine
const LOCAL = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/chromium'];
const sandbox = (await readdir('/opt/pw-browsers').catch(() => [])).filter((n) => /^chromium-\d+$/.test(n)).map((n) => `/opt/pw-browsers/${n}/chrome-linux/chrome`);
const exe = args.chromium ?? process.env.CHROMIUM ?? process.env.CHROME ?? [...sandbox, ...LOCAL].find(existsSync);
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--js-flags=--max-old-space-size=8192'] });
const ctx = await browser.newContext({ viewport: { width: 640, height: 400 }, deviceScaleFactor: 1 });
await ctx.addInitScript(() => {
  window.localStorage.setItem('tp-intro', '1');
  window.localStorage.setItem('tp-3d', 'on');
  window.localStorage.setItem('tp-worlds', '"load"');
  window.localStorage.setItem('tp-software', '"on"'); // (past the Star Wars worlds' GPU gate, lib/fit)
  window.localStorage.setItem('tp-quality', 'low');
});
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('page error:', e.message));
page.on('console', (m) => {
  const t = m.text();
  if (m.type() === 'error' || t.startsWith('bake ')) console.log(`  ${t.slice(0, 200)}`);
});
await page.goto(`${base}/?quality=low#/albuquerque`, { waitUntil: 'load', timeout: 180000 });
await page.waitForFunction(() => window.__ABQ__?.api?.bake, null, { timeout: 900000, polling: 1000 });
// (a moment for anything loading after the world, so nothing turns up mid-bake)
await page.waitForTimeout(8000);

// RGBA bytes `w` square, each `k` × `k` block averaged into one texel
function shrink(buf, w, k) {
  if (k <= 1) return buf;
  const n = Math.floor(w / k);
  const out = Buffer.alloc(n * n * 4);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++)
      for (let c = 0; c < 4; c++) {
        let s = 0;
        for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) s += buf[((y * k + j) * w + x * k + i) * 4 + c];
        out[(y * n + x) * 4 + c] = Math.round(s / (k * k));
      }
  return out;
}

// ── each area ──
await mkdir(OUT, { recursive: true });
const indexFile = join(OUT, 'index.json');
const prev = existsSync(indexFile) ? JSON.parse(await readFile(indexFile, 'utf8')) : { areas: [] };
const done = {};
for (const a of todo) {
  const size = args.sizes[a.name] ?? a.size;
  const t0 = Date.now();
  console.log(`baking ${a.name} (${a.w} × ${a.d} m at ${size}², ${((a.w / size) * 100).toFixed(0)} cm a texel)`);
  const r = await page.evaluate(([area, size, times, sun, sky]) => window.__ABQ__.api.bake({ area, size, times, sunSamples: sun, skySamples: sky }), [{ x0: a.x0, z0: a.z0, w: a.w, d: a.d }, size, TIMES, args.sun || undefined, args.sky || undefined]);
  const ship = Math.min(size, args.sizes[a.name] ? size : (a.ship ?? size));
  const raw = shrink(Buffer.from(r.url.slice(r.url.indexOf(',') + 1), 'base64'), r.width, Math.round(r.width / ship));
  const file = join(OUT, `${a.name}.webp`);
  // (exact: the sun's channels are kept even where the sky's is nothing)
  await sharp(raw, { raw: { width: ship, height: ship, channels: 4 } }).webp({ lossless: true, exact: true, effort: 6 }).toFile(file);
  const bytes = (await stat(file)).size;
  done[a.name] = { name: a.name, file: `${a.name}.webp`, x0: a.x0, z0: a.z0, w: a.w, d: a.d, size: ship, baked: size };
  console.log(`  ${a.name}: ${r.passes} passes in ${((Date.now() - t0) / 1000).toFixed(0)} s, kept at ${ship}², ${(bytes / 1024).toFixed(0)} KB${bytes > LIMIT ? '  (over the 1.3 MB limit: bake it smaller)' : ''}`);
}
await browser.close();
server.kill();

// ── the index: every area there is, in the order they're read ──
const areas = AREAS.map((a) => done[a.name] ?? prev.areas.find((p) => p.name === a.name)).filter(Boolean);
await writeFile(indexFile, `${JSON.stringify({ areas, times: TIMES.map(({ tod, channel }) => ({ tod, channel })) }, null, 1)}\n`);
console.log(`index: ${areas.map((a) => a.name).join(', ')}`);

/* global window, document */
// The universe map measured at fixed poses (src/components/universe/poses.js),
// so a visual change has a before and an after of the same pictures:
//
//   node scripts/universe-check.mjs [--quality high|mid|low|all] [--poses a,b]
//     [--out lab/universe/<tier>] [--baseline] [--url http://127.0.0.1:5173] [--chromium /path]
//     [--frames 20] (how many frames are timed: fewer in a container that draws in software, where a frame takes seconds)
//     [--near off] (without the planets' near maps and finer spheres, nearMaps.js: what they cost, measured on one tree)
//
// It starts the dev server (the poses are a DEV hook, `window.__universe().pose`,
// which a production build leaves out) unless --url names one, opens
// /universe at each tier in headless Chromium at 1280 × 720, and at each pose
// reads the renderer's draw calls and triangles for a whole frame, times
// twenty frames, and takes a shot: <out>/<pose>.webp, with the numbers in
// <out>.json, and the canvas inspector's pixel metrics (colour entropy, edge
// density, luminance contrast) of each shot beside them. --baseline writes to
// lab/universe/baseline/<tier> (taken on main before any later change).
// Headless Chromium draws in software, so its frame times compare only with
// each other. Exit 1 if a pose throws or a shot is blank.
import { spawn } from 'node:child_process';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import sharp from 'sharp';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const POSES = ['overview', 'falcon-sun', 'middleearth-limb', 'rickmorty', 'gaming', 'caribbean', 'middleearth', 'breakingbad', 'office', 'belt', 'maw', 'landing-middleearth', 'station', 'far-rim', 'in-nebula'];
const TIERS = ['high', 'mid', 'low'];

const args = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (!argv[i].startsWith('--')) continue;
  const key = argv[i].slice(2);
  const next = argv[i + 1];
  if (next === undefined || next.startsWith('--')) args[key] = true;
  else args[key] = argv[++i];
}
const list = (s) => (typeof s === 'string' ? s.split(',').map((x) => x.trim()).filter(Boolean) : []);
const tiers = !args.quality || args.quality === 'all' ? TIERS : list(args.quality);
const poses = list(args.poses).length ? list(args.poses) : POSES;
const FRAMES = Math.max(3, Number(args.frames) || 20);
for (const t of tiers) if (!TIERS.includes(t)) throw new Error(`no tier ${t} (high, mid, low or all)`);
for (const p of poses) if (!POSES.includes(p)) throw new Error(`no pose ${p} (${POSES.join(', ')})`);
const outFor = (tier) => (args.baseline ? join(ROOT, 'lab/universe/baseline', tier) : args.out && tiers.length === 1 ? join(ROOT, args.out) : join(ROOT, 'lab/universe', tier));

// ── the server: the dev server, as autopilot-check.mjs starts its preview ──
const freePort = () =>
  new Promise((res) => {
    const s = createServer();
    s.listen(0, '127.0.0.1', () => {
      const p = s.address().port;
      s.close(() => res(p));
    });
  });
let server = null;
let base = typeof args.url === 'string' ? args.url.replace(/\/$/, '') : null;
if (!base) {
  const port = await freePort();
  const vite = join(dirname(createRequire(import.meta.url).resolve('vite/package.json')), 'bin/vite.js');
  server = spawn(process.execPath, [vite, '--port', String(port), '--strictPort', '--host', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
  let down = null;
  server.on('exit', (code) => (down ??= `vite exited with ${code}`));
  base = `http://127.0.0.1:${port}`;
  const up = Date.now();
  for (;;) {
    try {
      if ((await fetch(base)).ok) break;
    } catch {
      /* not yet */
    }
    if (down || Date.now() - up > 60000) {
      server.kill();
      throw new Error(down ?? 'the dev server never answered');
    }
    await new Promise((r) => setTimeout(r, 300));
  }
}

// The canvas inspector's pixel metrics (.claude/skills/threejs-qa-release/
// scripts/inspect-threejs-canvas.mjs, computePixelMetrics: it measures a live
// page and doesn't export them, so the same sums are here, on the shot's
// pixels): a coarse luminance grid, colour buckets of 4 bits a channel.
function pixelMetrics({ data, width, height }) {
  const stepX = Math.max(1, Math.floor(width / 160));
  const stepY = Math.max(1, Math.floor(height / 90));
  const cols = Math.floor(width / stepX);
  const rows = Math.floor(height / stepY);
  const lum = new Float64Array(cols * rows);
  const buckets = new Map();
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      const o = (gy * stepY * width + gx * stepX) * 4;
      const [r, g, b] = [data[o], data[o + 1], data[o + 2]];
      lum[gy * cols + gx] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const key = `${r >> 4},${g >> 4},${b >> 4}`;
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
  }
  const n = cols * rows;
  const sorted = Array.from(lum).sort((a, b) => a - b);
  const r1 = (v, d) => Number(v.toFixed(d));
  let entropy = 0;
  let dominant = 0;
  for (const c of buckets.values()) {
    entropy -= (c / n) * Math.log2(c / n);
    dominant = Math.max(dominant, c);
  }
  let edges = 0;
  let checked = 0;
  for (let gy = 0; gy < rows - 1; gy++) {
    for (let gx = 0; gx < cols - 1; gx++) {
      const i = gy * cols + gx;
      if (Math.max(Math.abs(lum[i] - lum[i + 1]), Math.abs(lum[i] - lum[i + cols])) > 12) edges++;
      checked++;
    }
  }
  const p5 = sorted[Math.floor(n * 0.05)];
  const p95 = sorted[Math.floor(n * 0.95)];
  return {
    colorBuckets: buckets.size,
    colorEntropyBits: r1(entropy, 2),
    edgeDensity: r1(edges / checked, 3),
    luminance: { mean: r1(sorted.reduce((s, v) => s + v, 0) / n, 1), p5: r1(p5, 1), p95: r1(p95, 1), contrast: r1(p95 - p5, 1) },
    dominantColorShare: r1(dominant / n, 3),
  };
}

const exe = args.chromium ?? process.env.CHROMIUM ?? (await readdir('/opt/pw-browsers').catch(() => [])).filter((n) => /^chromium-\d+$/.test(n)).map((n) => `/opt/pw-browsers/${n}/chrome-linux/chrome`).find(existsSync);
if (!exe) throw new Error('no Chromium (set CHROMIUM=/path/to/chrome)');
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--js-flags=--max-old-space-size=4096'] });
let failed = 0;
const fail = (what) => {
  failed++;
  console.log(`FAIL ${what}`);
};

for (const tier of tiers) {
  const out = outFor(tier);
  await mkdir(out, { recursive: true });
  const report = { tier, viewport: [1280, 720], poses: {} };
  // a landing can't be flown back from in a script (the take-off is a
  // scene of its own): each pose gets a fresh page, the same start
  for (const name of poses) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    await ctx.addInitScript(([q, near]) => {
      window.localStorage.setItem('tp-intro', '1');
      window.localStorage.setItem('tp-start', '"universe"');
      window.localStorage.setItem('tp-quality', q);
      window.localStorage.setItem('tp-universe-ship', '"falcon"');
      window.__tpKeepFrames = true;
      if (near === 'off') window.localStorage.setItem('tp-near', 'off');
    }, [tier, args.near]);
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e.message ?? e)));
    const t0 = Date.now();
    try {
      await page.goto(`${base}/?quality=${tier}#/universe`, { waitUntil: 'domcontentloaded', timeout: 180000 });
      await page.waitForFunction(() => typeof window.__universe === 'function' && window.__universe().ship && window.__universeDebug?.state?.model, null, { timeout: 300000, polling: 250 });
      // and its box drawn: the hook (runtime/useWorld) marks it data-gl="on"
      // at its own first frame, and until then the runtime holds the canvas at
      // opacity 0 behind the loading veil (runtime.css's data-fresh). The scene is made (and the pose
      // draws) a minute or more before that in software, so the shot taken
      // then was a clear canvas over a white page: one colour, at every pose.
      await page.waitForFunction(() => window.__universeDebug.renderer.domElement.parentElement?.dataset.gl === 'on', null, { timeout: 600000, polling: 500 });
      await page.waitForTimeout(2000);
      await page.evaluate((n) => window.__universe().pose(n), name);
      // (a planet pose: its near maps given a moment to land, unless they're off)
      if (args.near !== 'off') await page.waitForFunction(() => (window.__universe().near ?? []).length > 0, null, { timeout: 15000, polling: 250 }).catch(() => {});
      // the grain moves frame to frame; the shots and their metrics shouldn't (post.js: checkpoint 1)
      await page.evaluate(() => window.__universeDebug.post?.grain?.(0));
      const numbers = await page.evaluate(async (n) => {
        const { renderer } = window.__universeDebug;
        const u = window.__universe();
        // one whole frame's count, every pass in it (the renderer otherwise resets at each render())
        const auto = renderer.info.autoReset;
        renderer.info.autoReset = false;
        renderer.info.reset();
        await u.frames(1);
        const { calls, triangles } = renderer.info.render;
        renderer.info.autoReset = auto;
        // twenty frames (or --frames), each one drawn (held still, the scene would otherwise rest)
        const times = [];
        for (let i = 0; i < n; i++) {
          const t = performance.now();
          await u.frames(1);
          times.push(performance.now() - t);
        }
        const sorted = [...times].sort((a, b) => a - b);
        const r1 = (v) => Number(v.toFixed(1));
        // the ship's box on screen (scene.js's DEV hook, where it has one)
        const shipPx = u.shipPx?.() ?? null;
        return { calls, triangles, shipPx, frameMs: r1(times.reduce((s, v) => s + v, 0) / times.length), frameMsMedian: r1(sorted[Math.floor(n / 2)]), memory: { ...renderer.info.memory } };
      }, FRAMES);
      // the picture alone: the page's bar, panel and HUD hidden (they'd be
      // half the shot, and in its metrics), the map's own canvas (the
      // renderer's, not the biggest on the page)
      const seen = await page.evaluate(() => {
        const canvas = window.__universeDebug.renderer.domElement;
        canvas.setAttribute('data-measured', '');
        const style = document.createElement('style');
        style.textContent = 'body * { visibility: hidden !important; } canvas[data-measured] { visibility: visible !important; }';
        document.head.append(style);
        let opacity = 1;
        for (let e = canvas; e; e = e.parentElement) opacity *= Number(window.getComputedStyle(e).opacity);
        return { inPage: canvas.isConnected, drawn: canvas.matches("[data-gl='on'] > canvas"), opacity };
      });
      // (loudly, so a change to how the map mounts can't blank the shots unseen again)
      if (!seen.inPage || !seen.drawn || seen.opacity < 0.99) throw new Error(`the map's canvas isn't the one on screen (${JSON.stringify(seen)})`);
      await page.evaluate(() => window.__universe().frames(2));
      const png = await page.screenshot({ type: 'png', timeout: 180000 });
      const raw = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const metrics = pixelMetrics({ data: raw.data, width: raw.info.width, height: raw.info.height });
      await writeFile(join(out, `${name}.webp`), await sharp(png).webp({ quality: 88 }).toBuffer());
      report.poses[name] = { ...numbers, metrics, errors: [...new Set(errors)].slice(0, 5) };
      if (metrics.dominantColorShare > 0.98) fail(`${tier} ${name}: the canvas is blank (${metrics.dominantColorShare} one colour)`);
      console.log(`ok   ${tier.padEnd(4)} ${name.padEnd(20)} calls ${String(numbers.calls).padStart(4)}  tris ${String(numbers.triangles).padStart(8)}  ${String(numbers.frameMs).padStart(6)} ms  entropy ${metrics.colorEntropyBits}  edges ${metrics.edgeDensity}  contrast ${metrics.luminance.contrast}${numbers.shipPx ? `  ship ${numbers.shipPx.w} × ${numbers.shipPx.h} px` : ''}  (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
    } catch (e) {
      report.poses[name] = { error: String(e.message ?? e).split('\n')[0], errors: [...new Set(errors)].slice(0, 5) };
      fail(`${tier} ${name}: ${report.poses[name].error}`);
    }
    await ctx.close();
  }
  await writeFile(`${out}.json`, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`wrote ${out}.json`);
}

await browser.close();
server?.kill();
process.exit(failed ? 1 : 0);

/* global window, document */
// Lane FL2’s “a repair changes no pixel”, for a world whose before is not on
// the runtime (scripts/gpu-parity.mjs waits for window.__RUNTIME__, which a
// useScene page never has). Each route is opened on Vite’s dev server of a
// checkout, at a page clock pinned to 2026-10-08T12:00:00Z and stopped, with
// Math.random seeded the same on every run (the map scatters its rocks,
// dust and crews by it), and its box’s data-gl="on" waited for a frame at a
// time; then what loads in real time is let load with the clock stopped,
// the same frames run on every run, the page’s time moved on to one moment,
// and the page shot as a lossless PNG. Two runs are then compared pixel for
// pixel (--compare): any differing pixel is counted, none forgiven.
//
//   node docs/superpowers/evidence/engine-floor/tools/shoot-same.mjs --ref origin/main --out <dir> --routes /,/universe/marvel [--phone] [--settle 8000]
//   node docs/superpowers/evidence/engine-floor/tools/shoot-same.mjs --out <dir> --routes /,/universe/marvel   (this checkout)
//   node docs/superpowers/evidence/engine-floor/tools/shoot-same.mjs --compare <dirA> <dirB>
// --reduced: prefers-reduced-motion, the map held still (its time at 0); --poses a,b
// (with one route): the map's fixed poses shot after it; --phone: 390 × 844, touch
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../../../../', import.meta.url));
const CLOCK = new Date('2026-10-08T12:00:00Z');
const FRAMES = 120;
const SYNC = 90000; // (past the slowest floor's coming on in software, with room)

const argv = process.argv.slice(2);
const args = {};
for (let i = 0; i < argv.length; i++) {
  if (!argv[i].startsWith('--')) continue;
  const next = argv[i + 1];
  args[argv[i].slice(2)] = next === undefined || next.startsWith('--') ? true : argv[++i];
}

const sharp = (await import('sharp')).default;

if (args.compare) {
  const a = resolve(args.compare);
  const b = resolve(argv[argv.indexOf('--compare') + 2]);
  let bad = 0;
  console.log('| shot | pixels | differing | most off (0–255) |');
  console.log('| --- | --- | --- | --- |');
  for (const f of readdirSync(a).filter((n) => n.endsWith('.png')).sort()) {
    if (!existsSync(join(b, f))) {
      console.log(`| ${f} | | missing in ${b} | |`);
      bad++;
      continue;
    }
    const [x, y] = await Promise.all([a, b].map((d) => sharp(join(d, f)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })));
    if (x.info.width !== y.info.width || x.info.height !== y.info.height) {
      console.log(`| ${f} | | sizes differ | |`);
      bad++;
      continue;
    }
    let off = 0;
    let most = 0;
    for (let i = 0; i < x.data.length; i += 4) {
      let d = 0;
      for (let c = 0; c < 4; c++) d = Math.max(d, Math.abs(x.data[i + c] - y.data[i + c]));
      if (d) off++;
      most = Math.max(most, d);
    }
    if (off) bad++;
    console.log(`| ${f} | ${x.info.width * x.info.height} | ${off} | ${most} |`);
  }
  process.exit(bad ? 1 : 0);
}

const routes = String(args.routes ?? '/').split(',').filter(Boolean);
const out = resolve(args.out ?? 'shots');
const settle = Number(args.settle) || 8000;
const phone = Boolean(args.phone);
const reduced = Boolean(args.reduced);
const VIEWPORT = phone ? { width: 390, height: 844 } : { width: 1280, height: 800 };
mkdirSync(out, { recursive: true });

const { chromium } = await import('playwright-core');
const { findChromium, angleFor, launchArgs } = await import(join(ROOT, 'scripts/lib/chromium.mjs'));

async function serve(root, cacheDir) {
  const { createServer } = await import('vite');
  const server = await createServer({ root, configFile: join(root, 'vite.config.js'), cacheDir, server: { host: '127.0.0.1', port: 0, hmr: false, watch: null, fs: { allow: [root, join(ROOT, 'node_modules')] } }, logLevel: 'error' });
  await server.listen();
  return { base: `http://127.0.0.1:${server.httpServer.address().port}`, close: () => server.close() };
}

let wt = null;
let root = ROOT;
if (args.ref) {
  wt = mkdtempSync(join(tmpdir(), 'shoot-same-'));
  rmSync(wt, { recursive: true, force: true });
  execFileSync('git', ['worktree', 'add', '--detach', wt, args.ref], { cwd: ROOT, stdio: 'ignore' });
  symlinkSync(join(ROOT, 'node_modules'), join(wt, 'node_modules'));
  root = wt;
}
const sha = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root }).toString().trim();
const server = await serve(root, join(tmpdir(), `shoot-same-vite-${sha}`));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? findChromium(), args: [...launchArgs({ angle: angleFor(), webgpu: false }), '--js-flags=--max-old-space-size=4096'] });
const report = { sha, ref: args.ref ?? 'HEAD', clock: CLOCK.toISOString(), viewport: VIEWPORT, routes: {} };
try {
  for (const route of routes) {
    const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1, ...(reduced ? { reducedMotion: 'reduce' } : {}), ...(phone ? { isMobile: true, hasTouch: true } : {}) });
    if (typeof args.poses === 'string') await ctx.addInitScript(() => (window.__shootShip = true));
    await ctx.addInitScript(() => {
      const set = (k, v) => window.localStorage.setItem(k, v);
      set('tp-intro', '1');
      set('tp-start', '"universe"');
      set('tp-sound', 'off');
      set('tp-worlds', JSON.stringify('load'));
      set('tp-tour', 'skipped');
      // (a ship flying, which the poses want: universe-check's Falcon)
      if (window.__shootShip) set('tp-universe-ship', '"falcon"');
      window.sessionStorage.setItem('tp-galaxy-intro', '1');
      window.__tpKeepFrames = true;
      // (no GPU timer: main's map calibrated itself on every visit, by the
      // chip's clock where it has one, and in software that clock wanders,
      // so one run softened it a step and the next didn't. Without it the
      // calibration times by the page's clock, which is stopped here: the
      // sharpest step on both, as the runtime's ?calibrate=off has it)
      for (const C of [window.WebGL2RenderingContext, window.WebGLRenderingContext]) {
        const get = C?.prototype.getExtension;
        if (get) {
          C.prototype.getExtension = function (name) {
            return /disjoint_timer_query/i.test(name) ? null : get.call(this, name);
          };
        }
      }
      // (mulberry32: the same scatter on every run)
      let s = 0x2f6b1d3;
      window.__reseed = (n) => {
        s = n;
      };
      Math.random = () => {
        s = (s + 0x6d2b79f5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message.split('\n')[0]));
    await page.clock.install({ time: CLOCK });
    await page.clock.pauseAt(new Date(CLOCK.getTime() + 1000));
    await page.goto(`${server.base}/?quality=high&calibrate=off#${route}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
    const t0 = Date.now();
    let frames = 0;
    for (;;) {
      const on = await page.evaluate(() => document.querySelector('.universe-map')?.dataset.gl === 'on');
      if (on) break;
      if (Date.now() - t0 > 300000) throw new Error(`${route}: the map never came on`);
      await page.clock.runFor(16);
      frames++;
      await page.waitForTimeout(25);
    }
    await page.waitForTimeout(settle);
    // (from here every run is the same: the page's time put at one moment,
    // the scatter reseeded, and the same frames run from there)
    const at = await page.evaluate(() => performance.now());
    if (at < SYNC) await page.clock.fastForward(Math.ceil(SYNC - at));
    await page.clock.setSystemTime(new Date(CLOCK.getTime() + SYNC));
    await page.evaluate(() => window.__reseed(0x51a7e));
    if (process.env.PROBE_STATE) await page.evaluate(() => { const r = window.__universeDebug.renderer; const was = r.render.bind(r); window.__draws = 0; window.__drawAt = []; r.render = (...a) => { window.__draws++; if (!r.getRenderTarget()) window.__drawAt.push(Math.round(performance.now())); return was(...a); }; });
    // (a frame asked for on both, at the same moment: the map at rest draws
    // only when asked, and what asks differs from one floor to the other)
    await page.evaluate(() => window.dispatchEvent(new Event('tp:uncover')));
    for (let n = 0; n < FRAMES; n++) {
      await page.clock.runFor(16);
      await page.waitForTimeout(50);
    }
    await page.waitForTimeout(300);
    if (process.env.HIDE_UI) await page.addStyleTag({ content: 'body *:not(canvas):not(:has(canvas)) { visibility: hidden !important; }' });
    const name = `${route.replace(/^\/+/, '').replace(/[^a-z0-9]+/gi, '-') || 'front'}${phone ? '-phone' : ''}.png`;
    await page.screenshot({ path: join(out, name), type: 'png', animations: 'disabled', caret: 'hide', timeout: 120000 });
    if (process.env.PROBE_STATE) {
      console.log(await page.evaluate(() => {
        const u = window.__universe?.() ?? {};
        const c = document.querySelector('.universe-map canvas');
        const r = window.__universeDebug?.renderer;
        const gl = r?.getContext();
        return JSON.stringify({ draws: window.__draws, screen: window.__drawAt.length, first: window.__drawAt.slice(0, 3), last: window.__drawAt.slice(-3), ratio: u.ratio, sharpness: u.sharpness, view: u.view, seat: u.seat, canvas: [c.width, c.height, c.style.width, c.style.height], samples: gl?.getParameter(gl.SAMPLES), tone: r?.toneMapping, exp: r?.toneMappingExposure, cs: r?.outputColorSpace, clear: r && [r.getClearColor(new window.__universeDebug.THREE.Color()).getHexString(), r.getClearAlpha()], autoClear: r?.autoClear, sort: r?.sortObjects, shadows: r?.shadowMap.enabled, clip: r?.localClippingEnabled, attrs: gl?.getContextAttributes() });
      }));
    }
    if (process.env.PROBE) {
      const [px, py] = process.env.PROBE.split(',').map(Number);
      console.log(await page.evaluate(([x, y]) => {
        const d = window.__universeDebug;
        if (!d) return 'no debug';
        const { THREE, camera, scene } = d;
        const box = document.querySelector('.universe-map canvas').getBoundingClientRect();
        const rc = new THREE.Raycaster();
        rc.setFromCamera(new THREE.Vector2(((x - box.left) / box.width) * 2 - 1, -((y - box.top) / box.height) * 2 + 1), camera);
        return rc.intersectObjects(scene.children, true).filter((h) => h.distance > 1).slice(0, 8).map((h) => { const names = []; for (let o = h.object; o; o = o.parent) names.push(o.name || o.type); const m = h.object.material; const src = (t) => t?.image?.currentSrc ?? t?.image?.src ?? (t?.image ? `${t.image.constructor?.name} ${t.image.width}x${t.image.height}` : null); return `${h.distance.toFixed(1)} ${names.join("<")} ${m?.type} map=${src(m?.map)} emissive=${src(m?.emissiveMap)} ud=${JSON.stringify(h.object.parent?.parent?.userData ?? {}).slice(0, 80)} ${h.object.parent?.parent?.name}`; }).join('\n');
      }, [px, py]));
      console.log(await page.evaluate(() => {
        const { THREE, camera, planets } = window.__universeDebug;
        const v = new THREE.Vector3();
        return planets.map((p) => { p.group.getWorldPosition(v); const d = v.distanceTo(camera.getWorldPosition(new THREE.Vector3())); v.project(camera); return `${p.id} d=${d.toFixed(0)} at ${((v.x + 1) * 640).toFixed(0)},${((1 - v.y) * 400).toFixed(0)}`; }).filter((l) => +l.split('d=')[1].split(' ')[0] < 3000).join('\n');
      }));
      console.log(await page.evaluate(([x, y]) => document.elementsFromPoint(x, y).slice(0, 4).map((e) => `${e.tagName}.${e.className} ${(e.textContent ?? '').slice(0, 60)}`).join(' | '), [px, py]));
    }
    // the map's fixed poses (poses.js, through scene.js's DEV hook), each
    // from the last, each at its own moment of the page's time
    const poses = typeof args.poses === 'string' ? args.poses.split(',') : [];
    // (the ship and its model in first, a frame at a time, as universe-check waits)
    for (let n = 0; poses.length && n < 3000; n++) {
      if (await page.evaluate(() => Boolean(window.__universe?.().ship && window.__universeDebug?.state?.model))) break;
      await page.clock.runFor(16);
      await page.waitForTimeout(25);
    }
    for (let i = 0; i < poses.length; i++) {
      // (the hook waits on frames of its own: started, then the clock stepped till it's done)
      await page.evaluate((n) => {
        window.__posed = null;
        Promise.resolve(window.__universe().pose(n)).then(
          () => (window.__posed = 'ok'),
          (e) => (window.__posed = String(e?.message ?? e)),
        );
      }, poses[i]);
      for (let n = 0; n < 3000 && !(await page.evaluate(() => window.__posed)); n++) {
        await page.clock.runFor(16);
        await page.waitForTimeout(25);
      }
      const posed = await page.evaluate(() => window.__posed);
      if (posed !== 'ok') throw new Error(`pose ${poses[i]}: ${posed ?? 'never done'}`);
      await page.waitForTimeout(settle);
      const when = SYNC + (i + 1) * 20000;
      const now = await page.evaluate(() => performance.now());
      if (now < when) await page.clock.fastForward(Math.ceil(when - now));
      await page.clock.setSystemTime(new Date(CLOCK.getTime() + when));
      await page.evaluate(() => window.__reseed(0x51a7e));
      if (process.env.PROBE_POST) {
        await page.evaluate(() => {
          const r = window.__universeDebug.renderer;
          if (!r.__counted) {
            const was = r.render.bind(r);
            r.__counted = true;
            r.render = (...a) => {
              if (!r.getRenderTarget()) window.__drawAt.push(Math.round(performance.now()));
              return was(...a);
            };
          }
          window.__drawAt = [];
        });
      }
      await page.evaluate(() => window.dispatchEvent(new Event('tp:uncover')));
      for (let n = 0; n < FRAMES; n++) {
        await page.clock.runFor(16);
        await page.waitForTimeout(50);
      }
      await page.waitForTimeout(300);
      await page.screenshot({ path: join(out, `pose-${poses[i]}${phone ? '-phone' : ''}.png`), type: 'png', animations: 'disabled', caret: 'hide', timeout: 600000 });
      if (process.env.PROBE_POST) {
        console.log(
          await page.evaluate(() => {
            const { post, renderer, state } = window.__universeDebug;
            const val = (v) => (typeof v === 'number' ? +v.toFixed(5) : v?.isVector2 || v?.isVector3 || v?.isColor ? v.toArray().map((x) => +x.toFixed(5)) : undefined);
            const passes = post.composer.passes.map((p) => ({ k: p.constructor.name, on: p.enabled, s: val(p.strength), r: val(p.radius), t: val(p.threshold), u: p.uniforms ? Object.fromEntries(Object.entries(p.uniforms).map(([n, u]) => [n, val(u.value)]).filter(([, v]) => v !== undefined)) : undefined }));
            return JSON.stringify({ drawn: window.__drawAt.length, first: window.__drawAt.slice(0, 3), last: window.__drawAt.slice(-3), ratio: renderer.getPixelRatio(), sharp: post.sharpness, pr: post.ratio, view: state.view, low: state.low, passes });
          }),
        );
      }
      console.log(`  pose ${poses[i]}: shot (page time ${Math.round(now)} ms)`);
    }
    report.routes[route] = { frames, pageTime: Math.round(at), errors: [...new Set(errors)] };
    console.log(`${route}: on after ${frames} frames, page time ${Math.round(at)} ms${errors.length ? `, errors: ${[...new Set(errors)].join('; ')}` : ''}`);
    await ctx.close();
  }
} finally {
  await browser.close();
  await server.close();
  if (wt) {
    try {
      unlinkSync(join(wt, 'node_modules'));
    } catch {
      /* gone */
    }
    execFileSync('git', ['worktree', 'remove', '--force', wt], { cwd: ROOT, stdio: 'ignore' });
  }
  writeFileSync(join(out, `report${phone ? '-phone' : ''}.json`), JSON.stringify(report, null, 1));
}

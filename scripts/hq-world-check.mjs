/* global window, document */
// A browser check of the Avengers compound (components/avengers/world).
// With the dev server up (npx vite --port 5173):
//   OUT=/tmp/shots node scripts/hq-world-check.mjs [shot …]
// It opens /avengers, waits for the compound, and frames it from the places
// the QA cares about (dev hook window.__HQWORLD__: `sim.h` is where he is,
// `sim.yaw`/`sim.pitch` the camera). Headless Chrome draws in software, slowly
// (and with 32 texture units where a desktop GPU has 16: UNITS checks that).
// Env: Q (quality), W, H, DPR; HUD=1 keeps the HUD; WHERE=1 says where the
// camera is and what's under the middle of the screen; ALPHA=1 reads the
// frame's alpha back (under 1, the page shows through the canvas);
// SWEEP=x,z (PITCH=a,b) turns the camera round him, with NAN=1 scanning each
// view's HDR frame for NaN, infinite and blinding pixels instead; SPIN=n
// turns it over time as the frame-rate watchdog steps the tier down;
// BEAM=1 (ONLY=i, PROBE=x,y;…) puts the camera beside each door's beam;
// UNITS=1 lists each shader's texture units.
import { chromium } from 'playwright-core';

const out = process.env.OUT ?? '.';
const W = Number(process.env.W ?? 960);
const H = Number(process.env.H ?? 540);
const Q = process.env.Q ?? 'low';
const URL = `http://localhost:5173/?quality=${Q}#/avengers`;
const chrome = process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: chrome, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [];
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: Number(process.env.DPR ?? 1), hasTouch: W < 600, isMobile: W < 600 });
await ctx.addInitScript((q) => {
  window.localStorage.setItem('tp-intro', '1');
  window.localStorage.setItem('tp-3d', '"on"');
  window.localStorage.setItem('tp-worlds', '"load"');
  window.localStorage.setItem('tp-software', '"on"'); // (past the Star Wars worlds' GPU gate, lib/fit)
  window.localStorage.setItem('tp-quality', JSON.stringify(q));
}, Q);
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errors.push(`${m.type()}: ${m.text()}`));
page.on('requestfailed', (r) => errors.push(`failed: ${r.url()} ${r.failure()?.errorText}`));
page.on('response', (r) => r.status() >= 400 && errors.push(`${r.status()}: ${r.url()}`));
const t0 = Date.now();
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__HQWORLD__?.api && document.querySelector('.cw-canvas[data-on]'), null, { timeout: 240000 });
console.log('compound up in', ((Date.now() - t0) / 1000).toFixed(1), 's');
console.log('context', await page.evaluate(() => JSON.stringify(window.__HQWORLD__.api.engine.renderer.getContext().getContextAttributes())));
// (the HUD hidden, so the picture is all world)
if (!process.env.HUD) await page.addStyleTag({ content: '.cw-stage > :not(canvas), header, nav, [class*="guide"] { display: none !important; }' });
await page.evaluate(() => {
  window.__HQWORLD__.api.skipIntro();
  document.querySelector('.cw-canvas')?.scrollIntoView({ block: 'center' });
});

// shots: where he stands (metres) and where the camera looks
const SHOTS = {
  spawn: {},
  lawn: { x: 96.8, z: 90, face: Math.PI * 1.25, pitch: 0.12 },
  hangar: { x: 40, z: 130, face: Math.PI, pitch: 0.1 },
  prow: { x: 70, z: 95, face: Math.PI * 1.1, pitch: 0.15 },
  training: { x: 175, z: 80, face: Math.PI, pitch: 0.15 },
  lab: { x: 150, z: 160, face: Math.PI * 0.5, pitch: 0.15 },
  river: { x: 80, z: 30, face: 0, pitch: 0.1 },
  roof: { x: 80, y: 32, z: 50, mode: 'air', face: Math.PI * 1.2, pitch: 0.35 },
  high: { x: 100, y: 60, z: 170, mode: 'air', face: Math.PI, pitch: 0.55 },
};
const want = process.argv.slice(2);
await page.waitForTimeout(3000);
// NAN=1: the scene drawn into a float target at every sweep angle and read
// back: pixels that aren't numbers, are infinite, negative or blinding (bloom
// spreads any of those into a block on the screen)
async function scanHdr(tag) {
  const r = await page.evaluate(() => {
    const { api } = window.__HQWORLD__;
    const { renderer, camera } = api.engine;
    const scene = api.scene;
    const T = api.engine.THREE;
    const w = 320, h = 180;
    const rt = new T.WebGLRenderTarget(w, h, { type: T.FloatType });
    const prev = renderer.getRenderTarget();
    renderer.setRenderTarget(rt);
    renderer.render(scene, camera);
    const px = new Float32Array(w * h * 4);
    renderer.readRenderTargetPixels(rt, 0, 0, w, h, px);
    renderer.setRenderTarget(prev);
    rt.dispose();
    let nan = 0, inf = 0, neg = 0, big = 0, max = 0;
    const where = [];
    for (let i = 0; i < w * h; i++) {
      for (let c = 0; c < 3; c++) {
        const v = px[i * 4 + c];
        if (Number.isNaN(v)) { nan++; if (where.length < 6) where.push(['nan', i % w, h - 1 - Math.floor(i / w), c]); }
        else if (!Number.isFinite(v)) { inf++; if (where.length < 6) where.push(['inf', i % w, h - 1 - Math.floor(i / w), c]); }
        else { if (v < -1e-3) neg++; if (v > 64) big++; if (v > max) max = v; }
      }
    }
    return { nan, inf, neg, big, max: +max.toFixed(2), where };
  });
  console.log('hdr', tag, JSON.stringify(r));
}
// SPIN=n: n frames over time while the camera keeps turning (the watchdog
// steps the tier down meanwhile, as on a slow machine), each with its tier
if (process.env.SPIN) {
  for (let k = 0; k < Number(process.env.SPIN); k++) {
    await page.evaluate((k) => {
      const { sim } = window.__HQWORLD__;
      sim.yaw += 0.7;
      sim.pitch = 0.1 + (k % 3) * 0.2;
      sim.dragAt = sim.t;
    }, k);
    await page.waitForTimeout(2500);
    const info = await page.evaluate(() => window.__HQWORLD__.api.engine.info());
    await page.screenshot({ path: `${out}/spin-${String(k).padStart(2, '0')}.png`, timeout: 180000 });
    console.log('spin', k, info.tier, info.dpr, JSON.stringify(info.size));
  }
}
// BEAM=1: each door's beam with the camera swung round beside it (he stands
// back from the door, the camera between him and it)
if (process.env.BEAM) {
  const beams = await page.evaluate(() => {
    const out = [];
    window.__HQWORLD__.api.scene.traverse((o) => {
      if (o.isMesh && o.geometry?.parameters?.height === 46) {
        const p = o.getWorldPosition(new o.position.constructor());
        out.push({ x: p.x, z: p.z, color: '#' + o.material.uniforms.uColor.value.getHexString() });
      }
    });
    return out;
  });
  for (const [i, b] of beams.entries()) {
    for (const back of [6.5, 8.5]) {
      await page.evaluate(([b, back]) => {
        const { sim } = window.__HQWORLD__;
        // he stands `back` m from the beam, out on the lawn side; the camera behind him toward it
        const a = Math.atan2(96.8 - b.x, 118 - b.z);
        const x = b.x + Math.sin(a) * back;
        const z = b.z + Math.cos(a) * back;
        Object.assign(sim.h, { x, z, y: 0, vx: 0, vz: 0, vy: 0, speed: 0, mode: 'ground', web: null, wall: null, face: a });
        sim.yaw = a + 0.05;
        sim.pitch = 0.12;
        sim.dragAt = sim.t;
      }, [b, back]);
      await page.waitForTimeout(3000);
      if (process.env.ONLY && Number(process.env.ONLY) !== i) continue;
      await page.locator('.cw-canvas').screenshot({ path: `${out}/beam-${i}-${back}.png`, timeout: 180000 });
      console.log('beam', i, b.color, back, await page.evaluate(() => {
        const { api, sim } = window.__HQWORLD__;
        const c = api.engine.camera.position;
        return `cam ${c.x.toFixed(2)},${c.y.toFixed(2)},${c.z.toFixed(2)} hero ${sim.h.x.toFixed(2)},${sim.h.y.toFixed(2)},${sim.h.z.toFixed(2)} ${sim.h.mode}`;
      }));
      // PROBE=x,y;x,y: what's at those canvas points (fractions of its size)
      if (process.env.PROBE) {
        const hits = await page.evaluate((pts) => {
          const { api } = window.__HQWORLD__;
          const T = api.engine.THREE;
          const rc = new T.Raycaster();
          return pts.split(';').map((q) => {
            const [fx, fy] = q.split(',').map(Number);
            rc.setFromCamera(new T.Vector2(fx * 2 - 1, 1 - fy * 2), api.engine.camera);
            const h = rc.intersectObject(api.scene, true).filter((x) => x.object.visible)[0];
            if (!h) return `${q}: nothing`;
            const m = Array.isArray(h.object.material) ? h.object.material[h.face?.materialIndex ?? 0] : h.object.material;
            return `${q}: ${h.object.type} '${h.object.name}' d=${h.distance.toFixed(1)} mat=${m?.type} key=${m?.customProgramCacheKey?.().slice(0, 40)} color=${m?.color?.getHexString?.()} emissive=${m?.emissive?.getHexString?.()}x${m?.emissiveIntensity} n=${h.face ? [h.face.normal.x, h.face.normal.y, h.face.normal.z].map((v) => v.toFixed(2)).join(',') : ''}`;
          });
        }, process.env.PROBE);
        console.log(hits.join('\n'));
        // where the frame is over the bloom's threshold, as a coarse map, and what's brightest
        const hot = await page.evaluate(() => {
          const { api } = window.__HQWORLD__;
          const { renderer, camera } = api.engine;
          const T = api.engine.THREE;
          const w = 160, h = 90;
          const rt = new T.WebGLRenderTarget(w, h, { type: T.FloatType });
          renderer.setRenderTarget(rt);
          renderer.render(api.scene, camera);
          const px = new Float32Array(w * h * 4);
          renderer.readRenderTargetPixels(rt, 0, 0, w, h, px);
          renderer.setRenderTarget(null);
          rt.dispose();
          const rows = [];
          let best = { v: 0 };
          for (let y = h - 1; y >= 0; y -= 6) {
            let row = '';
            for (let x = 0; x < w; x += 4) {
              const i = (y * w + x) * 4;
              const v = Math.max(px[i], px[i + 1], px[i + 2]);
              row += v > 3 ? '#' : v > 1.2 ? '+' : v > 0.8 ? '.' : ' ';
            }
            rows.push(row);
          }
          for (let i = 0; i < w * h; i++) {
            const v = Math.max(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]);
            if (v > best.v) best = { v, x: (i % w) / w, y: 1 - Math.floor(i / w) / h, rgb: [px[i * 4], px[i * 4 + 1], px[i * 4 + 2]].map((c) => +c.toFixed(2)) };
          }
          return { rows, best };
        });
        console.log(hot.rows.join('\n'));
        console.log('brightest', JSON.stringify(hot.best));
      }
    }
  }
}
// every shader program and how many textures it samples (a desktop GPU has 16 units)
if (process.env.UNITS) {
  const rows = await page.evaluate(() => {
    const r = window.__HQWORLD__.api.engine.renderer;
    const gl = r.getContext();
    const SAMPLERS = new Set([gl.SAMPLER_2D, gl.SAMPLER_CUBE, gl.SAMPLER_3D, gl.SAMPLER_2D_ARRAY, gl.SAMPLER_2D_SHADOW, gl.INT_SAMPLER_2D, gl.UNSIGNED_INT_SAMPLER_2D]);
    return r.info.programs.map((p) => {
      const n = gl.getProgramParameter(p.program, gl.ACTIVE_UNIFORMS);
      const names = [];
      let units = 0;
      for (let i = 0; i < n; i++) {
        const u = gl.getActiveUniform(p.program, i);
        if (SAMPLERS.has(u.type)) {
          units += u.size;
          names.push(u.size > 1 ? `${u.name}x${u.size}` : u.name);
        }
      }
      return { name: p.name, key: p.cacheKey.slice(-60), units, names: names.join(' ') };
    }).sort((a, b) => b.units - a.units);
  });
  for (const r of rows.slice(0, 25)) console.log(r.units, r.name, '|', r.names, '|', r.key);
}
// SWEEP=x,z[,y]: the camera turned all the way round him there, at two pitches
if (process.env.SWEEP) {
  const [x, z, y = 0] = process.env.SWEEP.split(',').map(Number);
  for (const pitch of (process.env.PITCH ?? '0.1,0.5').split(',').map(Number))
    for (let k = 0; k < 8; k++) {
      await page.evaluate(([x, y, z, yaw, pitch]) => {
        const { sim } = window.__HQWORLD__;
        Object.assign(sim.h, { x, z, y, vx: 0, vz: 0, vy: 0, speed: 0, mode: y ? 'perch' : 'ground', web: null, wall: null });
        sim.yaw = yaw;
        sim.pitch = pitch;
        sim.dragAt = sim.t;
      }, [x, y, z, (k / 8) * Math.PI * 2, pitch]);
      await page.waitForTimeout(1200);
      if (process.env.NAN) await scanHdr(`${pitch}/${k}`);
      else await page.locator('.cw-canvas').screenshot({ path: `${out}/sweep-${pitch}-${k}.png`, timeout: 180000 });
    }
}
for (const [name, s] of Object.entries(SHOTS)) {
  if (want.length && !want.includes(name)) continue;
  await page.evaluate((s) => {
    const { sim } = window.__HQWORLD__;
    if (s.x != null) {
      Object.assign(sim.h, { x: s.x, z: s.z, y: s.y ?? 0, vx: 0, vz: 0, vy: 0, speed: 0, mode: s.mode ?? 'ground', web: null, wall: null, face: s.face });
      sim.yaw = Math.atan2(-Math.cos(s.face), Math.sin(s.face));
      sim.pitch = s.pitch;
      sim.dragAt = 1e9;
    }
  }, s);
  await page.waitForTimeout(s.mode === 'air' ? 600 : 4000);
  if (s.mode === 'air') await page.evaluate((s) => Object.assign(window.__HQWORLD__.sim.h, { x: s.x, z: s.z, y: s.y, vy: 0 }), s);
  await page.waitForTimeout(1500);
  await page.locator('.cw-canvas').screenshot({ path: `${out}/hq-${name}.png`, timeout: 180000 });
  const info = await page.evaluate(() => window.__HQWORLD__.api.info);
  console.log(name, JSON.stringify(info));
  // ALPHA=1: the frame drawn and its alpha read straight back (the canvas is
  // see-through wherever it's under 1, and the page's painted sky shows)
  if (process.env.ALPHA) console.log('alpha', await page.evaluate(() => {
    const { api } = window.__HQWORLD__;
    const r = api.engine.renderer;
    const gl = r.getContext();
    api.engine.renderOnce();
    const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
    const px = new Uint8Array(w * h * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let low = 0, zero = 0;
    const rows = [];
    for (let y = h - 1; y >= 0; y -= Math.ceil(h / 14)) {
      let row = '';
      for (let x = 0; x < w; x += Math.ceil(w / 60)) {
        const a = px[(y * w + x) * 4 + 3];
        row += a < 8 ? '#' : a < 250 ? '+' : '.';
      }
      rows.push(row);
    }
    for (let i = 3; i < px.length; i += 4) {
      if (px[i] < 250) low++;
      if (px[i] < 8) zero++;
    }
    return `${w}x${h} under-1: ${low} clear: ${zero}\n${rows.join('\n')}`;
  }));
  if (process.env.WHERE) console.log(await page.evaluate(() => {
    const { api, sim } = window.__HQWORLD__;
    const T = api.engine.THREE;
    const cam = api.engine.camera;
    const rc = new T.Raycaster();
    const at = (fx, fy) => {
      rc.setFromCamera(new T.Vector2(fx * 2 - 1, 1 - fy * 2), cam);
      const h = rc.intersectObject(api.scene, true).filter((x) => x.object.visible)[0];
      if (!h) return 'nothing';
      const m = Array.isArray(h.object.material) ? h.object.material[0] : h.object.material;
      return `${h.object.type}/${m?.type}/${m?.customProgramCacheKey?.().slice(0, 30)} d=${h.distance.toFixed(2)} side=${m?.side}`;
    };
    const c = cam.position;
    return [`cam ${c.x.toFixed(2)},${c.y.toFixed(2)},${c.z.toFixed(2)} hero ${sim.h.x.toFixed(2)},${sim.h.y.toFixed(2)},${sim.h.z.toFixed(2)} ${sim.h.mode}`, 'centre ' + at(0.5, 0.5), 'low ' + at(0.5, 0.85), 'high ' + at(0.5, 0.2)].join('\n');
  }));
}
console.log(errors.length ? `errors:\n${[...new Set(errors)].slice(0, 30).join('\n')}` : 'no page errors');
await browser.close();

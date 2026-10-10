/* global window, document, requestAnimationFrame, WebGL2RenderingContext, WebGLRenderingContext, HTMLImageElement, HTMLCanvasElement */
// How smooth the worlds draw, measured in a real browser on the real
// graphics chip: every frame's time, and what the graphics chip was sent in
// it (shaders linked, pictures and buffers uploaded, draws and triangles),
// so a hitch can be told from a slow scene and a hitch's cause named.
//
//   node scripts/perf-probe.mjs [journey ...]      (all of them with none named)
//   node scripts/perf-probe.mjs --list
//
// With BASE unset it starts its own Vite (on 5294) and stops it after; with
// BASE set (a dev server already up) it uses that. CHROME is the Chromium
// to drive (Playwright's own on a Mac, on Metal, uncapped: no vsync, no
// frame-rate limit, so a frame's time is what it cost). VIEW is the window
// (default 1470x956@2, a 13" laptop's retina screen), QUALITY pins the
// device tier (?quality=), GPU picks the backend a 'nodes' world draws on
// (?gpu=webgl|webgpu: a port's frame-time table is two runs of the same
// journey; a 'glsl' world is on the classic renderer either way, and each
// journey's report names the backend it was actually drawn on), OUT is
// where the JSON report goes.
// planet flight: begin
// FLY picks the /fly journey's planet (default Hoth).
// planet flight: end
// Each journey prints a table: a row per phase (load, idle, move...), with the frame
// times' spread, the hitches (frames over 50 and 100 ms), what the worst
// frames were spent on, and `sizes`, the 3D canvases resized (each one
// waits on the graphics chip: a stall with no GL call named in it).
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const profile = Boolean(process.env.PROFILE);
const trace = Boolean(process.env.TRACE);
const out = process.env.OUT ?? '.';
const quality = process.env.QUALITY ?? '';
const gpu = ['webgl', 'webgpu'].includes(process.env.GPU) ? process.env.GPU : null;
const [vw, vh, vdpr] = (process.env.VIEW ?? '1470x956@2').match(/(\d+)x(\d+)(?:@([\d.]+))?/).slice(1).map(Number);

// ── what's recorded in the page ──
// A rAF of its own (one a frame), the GL calls that cost (shader links,
// uploads) counted and timed per frame, draws and triangles counted, and
// the browser's long animation frames with the scripts in them.
function recorder() {
  const zero = () => ({ links: 0, compiles: 0, glMs: 0, drawMs: 0, tex: 0, texBytes: 0, buf: 0, bufBytes: 0, draws: 0, tris: 0, slow: '', sized: new Set() });
  let cur = zero();
  // (mid: the shaders three made in the middle of a frame so far, as the
  // frame guard counts them in development: lib/three/frameGuard.js)
  const frames = []; // [t, links, texUploads, texMB, bufMB, draws, tris, glMs, drawMs, slow, mid, sizes]
  const stacks = new Map(); // a slow GL call's callers → ms
  const loaf = [];
  const tick = () => {
    const c = cur;
    frames.push([performance.now(), c.links, c.tex, c.texBytes / 1048576, c.bufBytes / 1048576, c.draws, c.tris, c.glMs, c.drawMs, c.slow, window.__tpGuardSlips ?? 0, c.sized.size]);
    cur = zero();
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  const timed = (proto, name, add) => {
    const fn = proto[name];
    if (typeof fn !== 'function') return;
    proto[name] = function (...a) {
      const t0 = performance.now();
      try {
        return fn.apply(this, a);
      } finally {
        const ms = performance.now() - t0;
        cur.glMs += ms;
        // (the slowest call of the frame, named: what a stall waited in)
        if (ms > 20 && !cur.slow.includes(name)) cur.slow += `${name} ${Math.round(ms)}ms `;
        // (who asked, for the slow ones: the stack's first frames outside three)
        if (ms > 20) {
          const at = (new Error().stack ?? '')
            .split('\n')
            .slice(2)
            .map((l) => l.trim().replace(/^at /, '').replace(/\(?https?:\/\/[^/]+\//, '(').replace(/\?[^:)]*/, ''))
            .filter((l) => !l.includes('recorder') && !l.includes('three.core') && !l.includes('deps/three.js'))
            .slice(0, 3)
            .join(' < ');
          const key = `${name}: ${at}`;
          stacks.set(key, (stacks.get(key) ?? 0) + ms);
        }
        add?.(a);
      }
    };
  };
  // (TRACE times the draws too: a draw whose shader is still linking waits
  // for it, and that wait shows here; it costs a little on every draw)
  const trace = Boolean(window.__probeTrace);
  const counted = (proto, name, add) => {
    const fn = proto[name];
    if (typeof fn !== 'function') return;
    proto[name] = trace
      ? function (...a) {
          add(a);
          const t0 = performance.now();
          try {
            return fn.apply(this, a);
          } finally {
            cur.drawMs += performance.now() - t0;
          }
        }
      : function (...a) {
          add(a);
          return fn.apply(this, a);
        };
  };
  const side = (s) => (s ? [s.width ?? s.naturalWidth ?? s.videoWidth ?? 0, s.height ?? s.naturalHeight ?? s.videoHeight ?? 0] : [0, 0]);
  const texBytes = (a) => {
    // (target, level, internal, w, h, border, format, type, pixels) or (target, level, internal, format, type, source)
    if (a.length >= 8 && typeof a[3] === 'number' && typeof a[4] === 'number') return a[3] * a[4] * 4;
    const [w, h] = side(a[a.length - 1] instanceof HTMLImageElement || typeof a[a.length - 1] === 'object' ? a[a.length - 1] : null);
    return w * h * 4;
  };
  const TRIANGLES = 4;
  // (a WebGL canvas given a new width or height: its drawing buffer made
  // again, which waits on the graphics chip, a stall with no GL call in it;
  // counted once a canvas a frame)
  const webgl = new WeakSet();
  const getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...a) {
    const ctx = getContext.call(this, type, ...a);
    if (ctx && /webgl/.test(type)) webgl.add(this);
    return ctx;
  };
  for (const k of ['width', 'height']) {
    const d = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, k);
    Object.defineProperty(HTMLCanvasElement.prototype, k, {
      configurable: true,
      enumerable: d.enumerable,
      get() {
        return d.get.call(this);
      },
      set(v) {
        if (!webgl.has(this) || d.get.call(this) === v >>> 0) {
          d.set.call(this, v);
          return;
        }
        const t0 = performance.now();
        d.set.call(this, v);
        const ms = performance.now() - t0;
        cur.sized.add(this);
        cur.glMs += ms;
        if (ms > 20) cur.slow += `canvas ${k} ${Math.round(ms)}ms `;
      },
    });
  }
  for (const C of [typeof WebGL2RenderingContext !== 'undefined' ? WebGL2RenderingContext : null, typeof WebGLRenderingContext !== 'undefined' ? WebGLRenderingContext : null]) {
    if (!C) continue;
    const p = C.prototype;
    timed(p, 'linkProgram', () => (cur.links += 1));
    timed(p, 'compileShader', () => (cur.compiles += 1));
    timed(p, 'getProgramParameter');
    timed(p, 'getShaderParameter');
    timed(p, 'texImage2D', (a) => {
      cur.tex += 1;
      cur.texBytes += texBytes(a);
    });
    timed(p, 'texSubImage2D', (a) => {
      // (target, level, x, y, w, h, format, type, pixels) or (target, level, x, y, format, type, source)
      cur.tex += 1;
      cur.texBytes += a.length >= 9 ? (a[4] || 0) * (a[5] || 0) * 4 : texBytes(a.slice(0, 2).concat(a.slice(4)));
    });
    timed(p, 'texImage3D', (a) => {
      cur.tex += 1;
      cur.texBytes += (a[3] || 0) * (a[4] || 0) * (a[5] || 1) * 4;
    });
    timed(p, 'texStorage2D', (a) => {
      cur.tex += 1;
      cur.texBytes += (a[3] || 0) * (a[4] || 0) * 4 * 1.33;
    });
    timed(p, 'compressedTexImage2D', (a) => {
      cur.tex += 1;
      cur.texBytes += a[6]?.byteLength ?? 0;
    });
    timed(p, 'compressedTexSubImage2D', (a) => {
      cur.tex += 1;
      cur.texBytes += a[8]?.byteLength ?? 0;
    });
    timed(p, 'generateMipmap');
    timed(p, 'bufferData', (a) => {
      cur.buf += 1;
      cur.bufBytes += typeof a[1] === 'number' ? a[1] : (a[1]?.byteLength ?? 0);
    });
    timed(p, 'bufferSubData', (a) => {
      cur.buf += 1;
      cur.bufBytes += a[2]?.byteLength ?? 0;
    });
    timed(p, 'readPixels');
    counted(p, 'drawElements', (a) => {
      cur.draws += 1;
      if (a[0] === TRIANGLES) cur.tris += a[1] / 3;
    });
    counted(p, 'drawArrays', (a) => {
      cur.draws += 1;
      if (a[0] === TRIANGLES) cur.tris += a[2] / 3;
    });
    counted(p, 'drawElementsInstanced', (a) => {
      cur.draws += 1;
      if (a[0] === TRIANGLES) cur.tris += (a[1] / 3) * a[4];
    });
    counted(p, 'drawArraysInstanced', (a) => {
      cur.draws += 1;
      if (a[0] === TRIANGLES) cur.tris += (a[2] / 3) * a[3];
    });
  }
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        loaf.push({
          t: e.startTime,
          ms: Math.round(e.duration),
          block: Math.round(e.blockingDuration ?? 0),
          scripts: (e.scripts ?? [])
            .filter((s) => s.duration > 8)
            .map((s) => ({ ms: Math.round(s.duration), fn: s.sourceFunctionName || s.invoker || '', url: (s.sourceURL || '').replace(/^.*\/(src|node_modules)\//, '$1/').replace(/\?.*$/, ''), at: s.sourceCharPosition })),
        });
      }
    }).observe({ type: 'long-animation-frame', buffered: true });
  } catch {
    /* no LoAF in this browser */
  }
  window.__probe = {
    take() {
      return { frames, loaf, origin: performance.timeOrigin, heap: performance.memory?.usedJSHeapSize ?? null, stacks: [...stacks.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8) };
    },
  };
}

// ── where a phase's main-thread time went (PROFILE=1): the heaviest
// functions by self time, named with their file ──
function hot(profile, top = 12) {
  const self = new Map();
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const dt = profile.timeDeltas ?? [];
  for (let i = 0; i < profile.samples.length; i++) {
    const n = byId.get(profile.samples[i]);
    if (!n) continue;
    const { functionName, url, lineNumber } = n.callFrame;
    if (functionName === '(idle)' || functionName === '(program)') continue;
    const key = `${functionName || '(anon)'}@${(url || '').replace(/^.*\/(src|node_modules|deps)\//, '').replace(/\?.*$/, '')}:${lineNumber + 1}`;
    self.set(key, (self.get(key) ?? 0) + (dt[i] ?? 0) / 1000);
  }
  return [...self.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, top)
    .map(([k, ms]) => `${Math.round(ms)}ms ${k}`)
    .join(' | ');
}

// ── the numbers per phase ──
const pct = (sorted, p) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] : 0);
const r1 = (n) => Math.round(n * 10) / 10;
function phases({ frames, marks, loaf }) {
  const rows = [];
  for (let i = 0; i < marks.length - 1; i++) {
    const [name, t0] = marks[i];
    const t1 = marks[i + 1][1];
    const fs = frames.filter((f) => f[0] > t0 && f[0] <= t1);
    const before = frames.filter((f) => f[0] <= t0).at(-1);
    const gaps = [];
    for (let k = 1; k < fs.length; k++) gaps.push({ ms: fs[k][0] - fs[k - 1][0], f: fs[k] });
    const ms = gaps.map((g) => g.ms).sort((a, b) => a - b);
    const sum = (j) => fs.reduce((s, f) => s + f[j], 0);
    const worst = gaps
      .slice()
      .sort((a, b) => b.ms - a.ms)
      .slice(0, 5)
      .map((g) => {
        const lf = loaf.find((l) => g.f[0] >= l.t && g.f[0] <= l.t + l.ms + 20);
        return { ms: Math.round(g.ms), links: g.f[1], tex: g.f[2], texMB: r1(g.f[3]), bufMB: r1(g.f[4]), glMs: Math.round(g.f[7]), drawMs: Math.round(g.f[8]), slow: g.f[9], scripts: lf?.scripts?.slice(0, 3) ?? [] };
      });
    const secs = (t1 - t0) / 1000;
    rows.push({
      phase: name,
      secs: r1(secs),
      frames: fs.length,
      fps: r1(gaps.length / Math.max(0.001, gaps.reduce((s, g) => s + g.ms, 0) / 1000)),
      p50: r1(pct(ms, 0.5)),
      p95: r1(pct(ms, 0.95)),
      p99: r1(pct(ms, 0.99)),
      max: Math.round(ms[ms.length - 1] ?? 0),
      over50: ms.filter((m) => m > 50).length,
      over100: ms.filter((m) => m > 100).length,
      links: sum(1),
      mid: fs.length ? fs[fs.length - 1][10] - (before?.[10] ?? 0) : 0,
      texMB: r1(sum(3)),
      bufMB: r1(sum(4)),
      draws: Math.round(sum(5) / Math.max(1, fs.length)),
      ktris: Math.round(sum(6) / Math.max(1, fs.length) / 1000),
      sizes: sum(11),
      worst,
    });
  }
  return rows;
}

// ── the journeys ──
// Each is (page, mark, h) => ..., h has the helpers. A phase runs from one
// mark to the next; the journey's last mark ends the last phase.
const wait = (page, ms) => page.waitForTimeout(ms);
const hold = async (page, key, ms) => {
  await page.keyboard.down(key);
  await wait(page, ms);
  await page.keyboard.up(key);
};
const canvasUp = (page, timeout = 180000) => page.waitForFunction(() => [...document.querySelectorAll('canvas')].some((c) => c.width > 300 && c.height > 200), null, { timeout });

// a world page: the load (from the address to its first frames), resting, then walking about
const worldPage = (route, { ready = canvasUp, move = 'KeyW' } = {}) =>
  async function (page, mark) {
    mark('load');
    await page.goto(`${this.base}/${this.q}#${route}`, { waitUntil: 'domcontentloaded' });
    await ready(page);
    mark('settle');
    await wait(page, 4000);
    mark('idle');
    await wait(page, 6000);
    mark('move');
    await page.mouse.click(vw / 2, vh / 2).catch(() => {});
    await hold(page, move, 3000);
    await hold(page, 'KeyA', 1500);
    await hold(page, move, 3000);
    mark('end');
  };

const JOURNEYS = {
  // planet flight: begin (scripts/flight-island.mjs removes this block)
  // the planet flight (/fly/hoth): the ground streamed in at the start, then
  // 300 m/s north for 14 s, from the range onto the plains (a biome boundary
  // at z ≈ 1000), into the glacier (z ≈ −500), over Echo Base (z −800) and
  // back onto the plains (z ≈ −1550), and a long
  // bank round (the ship's dev hook, expanse/flight/module.js's __FLIGHT__)
  async fly(page, mark) {
    mark('load');
    // (FLY names another planet to fly)
    await page.goto(`${this.base}/${this.q}#/fly/${process.env.FLY ?? 'hoth'}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__FLIGHT__ && window.__RUNTIME__?.status === 'on', null, { timeout: 240000 });
    mark('settle');
    await page.waitForFunction(() => window.__FLIGHT__.stats().leaves > 100, null, { timeout: 120000 }).catch(() => {});
    await wait(page, 4000);
    mark('idle');
    await wait(page, 4000);
    mark('fly');
    await page.evaluate(() => (window.__FLIGHT__.ship = { speed: 300, pitch: 0, roll: 0 }));
    await page.keyboard.down('ShiftLeft');
    await wait(page, 14000);
    mark('bank');
    await hold(page, 'KeyD', 1200);
    await wait(page, 6000);
    await page.keyboard.up('ShiftLeft');
    mark('end');
  },
  // planet flight: end
  async universe(page, mark) {
    mark('load');
    await page.goto(`${this.base}/${this.q}#/universe`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.__universe === 'function' && window.__universe().ship, null, { timeout: 180000 });
    mark('settle');
    await wait(page, 4000);
    mark('idle');
    await wait(page, 6000);
    mark('fly');
    await hold(page, 'KeyW', 4000);
    await hold(page, 'ArrowLeft', 2000);
    await page.keyboard.down('ShiftLeft');
    await hold(page, 'KeyW', 3000);
    await page.keyboard.up('ShiftLeft');
    mark('end');
  },
  async galaxy(page, mark) {
    mark('load');
    await page.goto(`${this.base}/${this.q}#/galaxy/tatooine`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__galaxyDebug?.state?.ship && window.__RUNTIME__?.status === 'on', null, { timeout: 240000 });
    mark('settle');
    await wait(page, 4000);
    mark('idle');
    await wait(page, 5000);
    mark('fly');
    await hold(page, 'KeyW', 4000);
    await hold(page, 'ArrowLeft', 2000);
    mark('end');
  },
  // the galaxy's flown trip: down to Tatooine's surface, a walk, and back up
  async travel(page, mark) {
    await page.goto(`${this.base}/${this.q}#/galaxy/tatooine`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__galaxyDebug?.state?.ship && window.__RUNTIME__?.status === 'on', null, { timeout: 240000 });
    await wait(page, 4000);
    await page.evaluate(() => {
      const { state } = window.__galaxyDebug;
      const r = state.sys.body.r;
      Object.assign(state.ship, { x: r * 1.6, y: r * 0.2, z: 0, speed: 0 });
    });
    await page.waitForSelector('.galaxy-land', { timeout: 120000 });
    mark('dive');
    await page.click('.galaxy-land');
    await page.waitForFunction(() => window.location.hash.includes('/surface'), null, { timeout: 300000 });
    mark('landing');
    const phase = () => page.evaluate(() => document.querySelector('.surface-page')?.dataset.phase ?? null);
    for (let i = 0; i < 40 && (await phase()) === 'landing'; i++) {
      await page.keyboard.press('Space');
      await wait(page, 1000);
    }
    await page.waitForFunction(() => document.querySelector('.surface-page')?.dataset.phase === 'walk', null, { timeout: 300000 });
    mark('walk');
    await hold(page, 'KeyW', 4000);
    await hold(page, 'KeyA', 1500);
    await hold(page, 'KeyW', 3000);
    mark('climb');
    await page.evaluate(() => document.querySelector('.surface-world')?.click());
    await page.waitForFunction(() => /#\/galaxy\/[a-z]+$/.test(window.location.hash), null, { timeout: 300000 });
    mark('space');
    await wait(page, 6000);
    mark('end');
  },
  // down onto a planet of the universe map and out on foot (footScene.js):
  // set down from just off it by the dev hook, as scripts/landing-check.mjs
  // does, the crew out, a walk, then back to the ship, in and up, and a
  // while in space after. LAND names the planets (music's, with its lamps,
  // and Middle-earth's, unless told), one after another on the one page.
  async landing(page, mark) {
    const ids = (process.env.LAND ?? 'music,middleearth').split(',').filter(Boolean);
    mark('load');
    await page.goto(`${this.base}/${this.q}#/universe`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.__universe === 'function' && window.__universe().ship, null, { timeout: 240000 });
    mark('settle');
    await wait(page, 4000);
    for (const id of ids) {
      // just off the planet, on its sunny side, still
      const ok = await page.evaluate((id) => {
        const d = window.__universeDebug;
        const p = d.planets.find((x) => x.id === id);
        if (!p) return false;
        const c = p.group.position;
        const r = p.radius ?? 18;
        d.state.ship = { ...d.state.ship, x: c.x + r * 1.25, y: c.y + r * 0.3, z: c.z + r * 0.25, speed: 0, vy: 0 };
        return true;
      }, id);
      if (!ok) throw new Error(`no planet ${id}`);
      await wait(page, 2500);
      mark(`land:${id}`);
      if (!(await page.evaluate((id) => window.__universeDebug.startFoot({ id }), id))) throw new Error(`couldn't land on ${id}`);
      await page.waitForFunction(() => window.__universeDebug.foot.phase === 'walk', null, { timeout: 300000, polling: 200 });
      mark(`walk:${id}`);
      await hold(page, 'KeyW', 4000);
      await hold(page, 'KeyA', 1500);
      await hold(page, 'KeyW', 3000);
      // (back by the ship, the dev hook's way, and in)
      mark(`lift:${id}`);
      await page.evaluate(() => {
        const f = window.__universeDebug.foot;
        const S = f.debug;
        S.me = { ...S.me, n: S.spot.n };
        return f.board();
      });
      await page.waitForFunction(() => !window.__universeDebug.foot.phase, null, { timeout: 300000, polling: 200 });
      mark(`space:${id}`);
      await wait(page, 6000);
    }
    mark('end');
  },
  surface: worldPage('/galaxy/tatooine/surface', { ready: (p) => p.waitForFunction(() => document.querySelector('.surface-page')?.dataset.phase === 'walk' || document.querySelector('.surface-page')?.dataset.phase === 'landing', null, { timeout: 240000 }) }),
  // a big planet of the Rick and Morty sector on the surface engine
  // (rickmorty/planets/): the landing, then a walk toward the first place.
  // RM_PLANET names another (the Purge Planet's night mission is the most
  // on screen, `purge?mission=night`, once that planet has it).
  async rmPlanet(page, mark) {
    const route = process.env.RM_PLANET ?? 'gazorpazorp';
    const phase = () => page.evaluate(() => document.querySelector('.surface-page')?.dataset.phase ?? null);
    mark('load');
    await page.goto(`${this.base}/${this.q}#/c-137/${route}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => ['landing', 'walk'].includes(document.querySelector('.surface-page')?.dataset.phase), null, { timeout: 240000 });
    mark('settle');
    await wait(page, 4000);
    // (the landing skipped, as a player who's seen it would)
    for (let i = 0; i < 40 && (await phase()) === 'landing'; i++) {
      await page.keyboard.press('Space');
      await wait(page, 1000);
    }
    await page.waitForFunction(() => document.querySelector('.surface-page')?.dataset.phase === 'walk', null, { timeout: 300000 });
    mark('walk');
    await page.mouse.click(vw / 2, vh / 2).catch(() => {});
    await hold(page, 'KeyW', 10000);
    mark('end');
  },
  avengers: worldPage('/avengers'),
  shire: worldPage('/middle-earth/shire'),
  abq: worldPage('/albuquerque'),
  // (ready once the world's canvas is live, its loading screen gone: the
  // galaxy behind the page is a big canvas long before the street is)
  c137: worldPage('/c-137', { ready: (p) => p.waitForFunction(() => document.querySelector('.rm-world-canvas[data-on]'), null, { timeout: 300000 }) }),
  cybertron: worldPage('/cybertron'),
  invincible: worldPage('/invincible'),
  earth: worldPage('/earth'),
  minecraft: worldPage('/dot-matrix/minecraft'),
  // Minecraft walked 200 blocks each way along x and z, a block every 100 ms
  // (a sprint's pace and more), so chunks keep arriving and going
  async minecraftWalk(page, mark) {
    mark('load');
    await page.goto(`${this.base}/${this.q}#/dot-matrix/minecraft`, { waitUntil: 'domcontentloaded' });
    // (past the game's password, to the tribute)
    await page.getByRole('button', { name: /Walk the tribute/ }).click({ timeout: 120000 });
    await page.waitForFunction(() => window.__RUNTIME__?.status === 'on' && window.__RUNTIME__.current?.world?.game, null, { timeout: 180000 });
    // (the same world every run: seed 1, at its spawn)
    await page.evaluate(() => window.__RUNTIME__.current.world.newWorld(1));
    await page.waitForFunction(() => {
      const g = window.__RUNTIME__.current.world.game;
      return g.world.loaded(g.player.x, g.player.z);
    }, null, { timeout: 180000 });
    mark('settle');
    await wait(page, 4000);
    for (const [name, dx, dz] of [['east', 1, 0], ['west', -1, 0], ['south', 0, 1], ['north', 0, -1]]) {
      mark(name);
      for (let i = 0; i < 200; i++) {
        await page.evaluate(([dx, dz]) => {
          const { world } = window.__RUNTIME__.current;
          const p = world.game.player;
          world.debug.teleport(p.x + dx, 120, p.z + dz);
        }, [dx, dz]);
        await wait(page, 100);
      }
    }
    mark('end');
  },
  music: worldPage('/music'),
  scranton: worldPage('/scranton'),
  citadel: worldPage('/c-137/citadel'),
  dotmatrix: worldPage('/dot-matrix'),
  caribbean: worldPage('/caribbean'),
};

if (argv.includes('--list')) {
  console.log(Object.keys(JOURNEYS).join('\n'));
  process.exit(0);
}
const picked = argv.filter((a) => !a.startsWith('--'));
const names = picked.length ? picked : Object.keys(JOURNEYS);
for (const n of names) if (!JOURNEYS[n]) throw new Error(`no journey ${n} (--list)`);

let server = null;
let base = process.env.BASE;
if (!base) {
  const { createServer } = await import('vite');
  server = await createServer({ server: { host: '127.0.0.1', port: 5294, strictPort: true, hmr: false, watch: null }, logLevel: 'error' });
  await server.listen();
  base = 'http://127.0.0.1:5294';
}
const { adapterFor, angleFor, findChromium, launchArgs } = await import('./lib/chromium.mjs');
const chrome = findChromium();
if (!chrome) throw new Error('no Chromium (set CHROME=/path/to/chrome)');
// (the machine's own chip, uncapped, so a frame's time is what it cost;
// scripts/lib/chromium.mjs)
const args = launchArgs({ angle: angleFor(), webgpu: gpu === 'webgpu', adapter: adapterFor(), uncapped: true });
if (process.platform === 'darwin') args.push('--enable-gpu-rasterization');
const browser = await chromium.launch({ executablePath: chrome, args });
const report = {};
mkdirSync(out, { recursive: true });
try {
  for (const name of names) {
    const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: vdpr || 1 });
    // (Vite's first transform of the whole site, on a busy machine, runs past Playwright's 30 s)
    ctx.setDefaultNavigationTimeout(240000);
    await ctx.addInitScript(() => {
      const set = (k, v) => window.localStorage.setItem(k, v);
      set('tp-intro', '1');
      set('tp-start', '"universe"');
      set('tp-sound', 'off');
      set('tp-worlds', JSON.stringify('load'));
      set('tp-tour', 'skipped');
      set('tp-universe-ship', JSON.stringify('xwing'));
      // (no reading back every shader's log: the built site doesn't, and it waits on each link)
      window.__tpNoShaderChecks = true;
      window.sessionStorage.setItem('tp-galaxy-intro', '1');
    });
    if (trace) await ctx.addInitScript(() => (window.__probeTrace = true));
    await ctx.addInitScript(recorder);
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
    // (lib/three/frameGuard names, in development, what still compiles mid-frame)
    const slips = new Map();
    page.on('console', (m) => {
      const t = m.text();
      if (t.startsWith('[frameGuard]')) slips.set(t, (slips.get(t) ?? 0) + 1);
    });
    // (marked by the wall clock here, so a page frozen mid-frame can't hold a mark back)
    const marks = [];
    const cdp = profile ? await ctx.newCDPSession(page) : null;
    const profiles = [];
    let profiling = null;
    const mark = (n) => {
      marks.push([n, Date.now()]);
      if (!cdp) return;
      // (each phase its own CPU profile: stopped and started on the mark)
      const was = profiling;
      profiling = n;
      cdp
        .send('Profiler.stop')
        .then(({ profile: p }) => was && profiles.push([was, p]))
        .catch(() => {})
        .then(() => n !== 'end' && cdp.send('Profiler.start'))
        .catch(() => {});
    };
    if (cdp) {
      await cdp.send('Profiler.enable');
      await cdp.send('Profiler.setSamplingInterval', { interval: 500 });
    }
    const h = { base, q: `?${[quality && `quality=${quality}`, gpu && `gpu=${gpu}`].filter(Boolean).join('&')}`.replace(/^\?$/, '') };
    const t0 = Date.now();
    let failed = null;
    try {
      // (the first mark comes once the page and its recorder are up)
      await JOURNEYS[name].call(h, page, mark);
    } catch (err) {
      failed = String(err).split('\n')[0];
      mark('end');
    }
    // (the backend the world was drawn on: rt.gfx's kind, and whether three found a WebGPU device under it)
    const drawnOn = await page.evaluate(() => (window.__RUNTIME__?.gfx ? `${window.__RUNTIME__.gfx.backend}${window.__RUNTIME__.gfx.renderer?.backend?.isWebGPUBackend ? ' (WebGPU device)' : ''}` : null)).catch(() => null);
    const data = await page.evaluate(() => window.__probe?.take()).catch(() => null);
    const rows = data ? phases({ ...data, marks: marks.map(([n, t]) => [n, t - data.origin]) }) : [];
    const ready = data && marks.find((m) => m[0] === 'settle');
    if (cdp) {
      await new Promise((r) => setTimeout(r, 300));
      for (const [phase, p] of profiles) console.log(`  cpu in ${phase}: ${hot(p)}`);
    }
    report[name] = { backend: gpu ?? 'default', drawnOn, rows, errors, failed, secs: Math.round((Date.now() - t0) / 1000), readyS: ready ? r1((ready[1] - data.origin) / 1000) : null, heapMB: data?.heap ? Math.round(data.heap / 1048576) : null };
    console.log(`\n== ${name}${failed ? `  (stopped: ${failed})` : ''}  on ${drawnOn ?? '?'}  ready ${report[name].readyS}s  total ${report[name].secs}s  heap ${report[name].heapMB} MB${errors.length ? `  errors ${errors.length}` : ''}`);
    const pw = Math.max(9, ...rows.map((r) => r.phase.length));
    console.log(`${'phase'.padEnd(pw)}  secs  fps    p50   p95   p99   max  >50 >100 links   mid texMB bufMB draws ktris sizes`);
    for (const r of rows) {
      console.log(
        [r.phase.padEnd(pw), String(r.secs).padStart(5), String(r.fps).padStart(5), String(r.p50).padStart(6), String(r.p95).padStart(5), String(r.p99).padStart(5), String(r.max).padStart(5), String(r.over50).padStart(4), String(r.over100).padStart(4), String(r.links).padStart(5), String(r.mid).padStart(5), String(r.texMB).padStart(5), String(r.bufMB).padStart(5), String(r.draws).padStart(5), String(r.ktris).padStart(5), String(r.sizes).padStart(5)].join(' '),
      );
    }
    for (const r of rows) {
      const bad = r.worst.filter((w) => w.ms > 50);
      if (!bad.length) continue;
      console.log(`  worst in ${r.phase}: ${bad.map((w) => `${w.ms}ms[links ${w.links}, tex ${w.tex}/${w.texMB}MB, buf ${w.bufMB}MB, gl ${w.glMs}ms${w.slow ? ` (${w.slow.trim()})` : ''}${trace ? `, draws ${w.drawMs}ms` : ''}${w.scripts.length ? `; ${w.scripts.map((s) => `${s.fn || '?'}@${s.url.split('/').slice(-2).join('/')} ${s.ms}ms`).join(', ')}` : ''}]`).join('  ')}`);
    }
    if (process.env.STACKS && data?.stacks?.length) {
      console.log('  slow GL calls, by caller:');
      for (const [k, ms] of data.stacks) console.log(`    ${Math.round(ms)}ms ${k}`);
    }
    if (slips.size) {
      console.log('  mid-frame compiles:');
      for (const [t, n] of [...slips.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)) console.log(`    ${n}× ${t.slice(13)}`);
    }
    report[name].slips = Object.fromEntries(slips);
    await ctx.close();
  }
} finally {
  writeFileSync(`${out}/perf-probe.json`, JSON.stringify({ view: { vw, vh, vdpr }, quality, gpu: gpu ?? 'default', report }, null, 1));
  await browser.close();
  await server?.close();
}

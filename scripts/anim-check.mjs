/* global window, document */
// Do the figures move naturally? A browser check of every rigged figure in
// a world: it opens a route of the dev server in headless Chromium, waits
// for the world, then follows each figure's toes frame by frame and says,
// per figure, how fast the planted toe drifts (a foot that's down should
// stay where it's put: W2's bar is under 0.15 m/s), how many figures stand
// at the bind pose (every bone where the skin was bound: nothing's playing),
// and how many breathe in step with another (one clip, one phase: started
// together). Exit code 1 when a figure in view drifts over the limit (and,
// with --strict, when one in view is at the bind pose or in step).
// (docs/superpowers/plans/2026-10-07-living-characters-w2.md, task A3)
//
// With the dev server up (npx vite --port 5391 --strictPort --host 127.0.0.1):
//   node scripts/anim-check.mjs --route '#/c-137' [--seconds 6] [--port 5391]
//     [--frames 20] [--settle 4] [--wait 300] [--range 40] [--limit 0.15]
//     [--unit 1] [--clock mixer|wall] [--quality high|mid|low] [--phone]
//     [--do 'click:Defend'] [--do "__surfaceDo('missionDo','side','defend')"]
//     [--json out.json] [--strict] [--gpu] [--headed] [--chrome edge|/path]
//     [--held] [--talk] [--allow-empty]
//
//   --route: a hash route, written '#/c-137' or 'c-137' (Git Bash turns a
//     bare '/c-137' into a path of its own). --seconds of the world sampled,
//     and at least --frames frames of it; --settle seconds let go by first
//     (models arriving), --wait the most for the world to start. --range:
//     how near the camera a figure on screen must be to count as in view
//     (the world's units). --unit: the world's units to the metre. --do,
//     as often as needed, once the world's drawing: 'click:<name>' presses
//     a button by its name, anything else is run in the page (a world's dev
//     hook: choosing a side in a Battlefront mission). --gpu draws on the
//     graphics chip (on Windows, ANGLE's D3D11) instead of in software.
//   --held: every held thing (lib/three/held.js's holdItem) sampled too:
//     its grip in the palm, its axis on its line, a still carry's arm and
//     an upright one's top (scripts/lib/anim-held.mjs has the measures);
//     --talk: once sampled, each of the route's talkers (its dev hooks
//     window.__talkers and window.__teleport) visited, the prompt naming
//     them read and the key it names pressed, and the body's answer
//     watched. Either failing is exit 1, and so is either asked for that
//     sampled nothing (no held thing, no talker: "not run"), unless
//     --allow-empty.
//   CHROME (or --chrome) is the browser: a path, or 'edge' or 'chrome' for
//     the usual places on Windows; else Playwright's Chromium in
//     /opt/pw-browsers, else a local Edge or Chrome. PORT sets the port.
//   A Battlefront, its side picked and a post taken through its dev hooks
//   (as scripts/assault-check.mjs does):
//     node scripts/anim-check.mjs --route '#/galaxy/hoth/surface?mission=assault'
//       --do "__surfaceDo('missionDo', 'side', 'defend')"
//       --do "__surfaceDo('missionDo', 'deploy', __surface().mission.posts.find((p) => p.can).id)"
//
// It gets past the front door the way the other checks do: the intro seen,
// the classic view picked, the 3D let load without asking, the tour turned
// down, and a world's basics skipped if they show. It finds the scenes
// through three.js's own hook for its devtools (window.__THREE_DEVTOOLS__,
// which every Scene, renderer and AnimationMixer tells of itself as it's
// made), so no world's code is touched: each renderer's render is wrapped
// to list the scenes it draws on window.__threeScenes (weakly, with the
// camera each was last drawn with), and to read each figure's toes once a
// frame, just after it's drawn. The toes' times are the world's (the
// mixers' clocks, shared out over the frames by how long each took), so a
// software renderer's slow frames, which the world counts short, don't
// read as slow feet. A toe is planted while it's within 3 cm of the lowest
// it gets within 0.6 s either side (so a slope or a stair isn't a lift);
// its drift is how far it goes along the ground, first to last, while it's
// down (so a far figure posed every other frame, its toe stepping back and
// forth, doesn't read as sliding). Headless Chromium draws in software,
// slowly: the waits are long, and --gpu gives finer stances.
import { existsSync } from 'node:fs';
import { readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { emptyFails, HELD_LIMITS, heldPageScript, heldVerdict, talkCheck } from './lib/anim-held.mjs';

export { emptyFails, HELD_LIMITS, heldPageScript, heldVerdict, keyOf, promptFor, sampleHeld, swingOf, TALK_WITHIN, talkCheck, talkVerdict } from './lib/anim-held.mjs';

export const LIMIT = 0.15; // the most a planted toe may drift (m/s)
export const PLANT = 0.03; // within this of its lowest, a toe is down (m)
export const WINDOW = 0.6; // the lowest is looked for this far either side (s)
export const JUMP = 1.5; // further than this between frames is a figure put somewhere else (m)
const MIN_TIME = 0.25; // a toe down for less time than this says nothing (s)
export const BIND_EPS = 0.01; // every bone this near where it was bound is the bind pose
export const PHASE_TOL = 0.001; // two loops this near in their cycle started together
export const LONGEST = 0.1; // what a frame counts for on the wall clock, at most (s)

const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe', '/usr/bin/microsoft-edge', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'];
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'];
const USAGE = "usage: node scripts/anim-check.mjs --route '#/c-137' [--seconds 6] [--port 5391] (the header says the rest)";

// ── the measures (pure: tested in anim-check.test.mjs) ──

// A toe's drift while it's down. series: [{ t, p: [x, y, z] | null }] in
// frame order, t the world's seconds, p null while the figure was hidden.
// → { drift (m/s, or null when it was down too little to say), dist, time,
// stances }. Only the ground's plane counts (`up` is the world's up).
export function toeDrift(series, { up = [0, 1, 0], plant = PLANT, window = WINDOW, jump = JUMP, minTime = MIN_TIME } = {}) {
  const n = Math.hypot(up[0], up[1], up[2]) || 1;
  const u = [up[0] / n, up[1] / n, up[2] / n];
  const h = series.map((s) => (s?.p ? s.p[0] * u[0] + s.p[1] * u[1] + s.p[2] * u[2] : null));
  const t = series.map((s) => s?.t ?? 0);
  const planted = h.map((hi, i) => {
    if (hi === null) return false;
    let lo = hi;
    for (let j = i - 1; j >= 0 && t[i] - t[j] <= window; j--) if (h[j] !== null && h[j] < lo) lo = h[j];
    for (let j = i + 1; j < h.length && t[j] - t[i] <= window; j++) if (h[j] !== null && h[j] < lo) lo = h[j];
    return hi - lo <= plant;
  });
  // along the ground: the part of a step that isn't up
  const flat = (a, b) => {
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const k = d[0] * u[0] + d[1] * u[1] + d[2] * u[2];
    return Math.hypot(d[0] - k * u[0], d[1] - k * u[1], d[2] - k * u[2]);
  };
  let dist = 0;
  let time = 0;
  let stances = 0;
  let from = -1;
  const close = (to) => {
    if (from >= 0 && to > from) {
      dist += flat(series[from].p, series[to].p);
      time += t[to] - t[from];
      stances++;
    }
    from = -1;
  };
  for (let i = 0; i < series.length; i++) {
    if (!planted[i]) {
      close(i - 1);
      continue;
    }
    const p = series[i].p;
    const q = series[i - 1]?.p;
    if (from >= 0 && q && Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) > jump) close(i - 1);
    if (from < 0) from = i;
  }
  close(series.length - 1);
  return { drift: time >= minTime ? dist / time : null, dist, time, stances };
}

// The world's seconds for each sampled frame. wall: each frame's seconds
// since the one before (the first 0); totals: how far each mixer's clock
// went between the first frame and the last. The mixers keep the world's
// time (a world counts a slow frame short), shared out over the frames by
// how long each took on the wall; with no mixer going, each frame's wall
// time, a tenth of a second at most.
export function worldTimes(wall, totals = [], { clock = 'mixer', longest = LONGEST } = {}) {
  const sum = wall.reduce((s, w) => s + Math.max(0, w), 0);
  const going = totals.filter((x) => x > 0).sort((a, b) => a - b);
  if (clock === 'wall' || !going.length || !(sum > 0)) {
    const dt = wall.map((w) => Math.min(Math.max(0, w), longest));
    return { dt, from: 'wall', total: dt.reduce((s, x) => s + x, 0) };
  }
  // (the middle mixer: one stepped every other frame by two frames' time
  // keeps the same time, but one that started late or was set back doesn't)
  const total = going[Math.floor(going.length / 2)];
  return { dt: wall.map((w) => (total * Math.max(0, w)) / sum), from: 'mixers', total };
}

// a × b, 4 × 4, column-major as three.js keeps them
export function mul4(a, b) {
  const out = new Array(16);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++) out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  return out;
}

// How far one bone is from where the skin was bound: its skinning matrix
// (as three.js makes it: bindMatrixInverse · bone's world · boneInverse ·
// bindMatrix) is the identity at the bind pose, wherever the figure stands.
// → the most any of its turn's entries is off.
export function skinDeviation(bindMatrixInverse, boneWorld, boneInverse, bindMatrix) {
  const s = mul4(mul4(mul4(bindMatrixInverse, boneWorld), boneInverse), bindMatrix);
  let most = 0;
  for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) most = Math.max(most, Math.abs(s[c * 4 + r] - (r === c ? 1 : 0)));
  return most;
}

// a figure's worst bone (skinDeviation's), null when it couldn't be read
export const atBindPose = (dev, eps = BIND_EPS) => dev != null && dev < eps;

// Whether a point is on screen and within `range` of the eye. vp: the
// camera's projection · its world inverse; eye: its world matrix.
export function inView(vp, eye, p, range = Infinity) {
  const [x, y, z] = p;
  const w = vp[3] * x + vp[7] * y + vp[11] * z + vp[15];
  if (!(w > 0)) return false;
  const cx = (vp[0] * x + vp[4] * y + vp[8] * z + vp[12]) / w;
  const cy = (vp[1] * x + vp[5] * y + vp[9] * z + vp[13]) / w;
  if (Math.abs(cx) > 1 || Math.abs(cy) > 1) return false;
  return Math.hypot(x - eye[12], y - eye[13], z - eye[14]) <= range;
}

// a bone's name without its rig's prefix or the number a download appended (lib/three/rig.js's)
function plainBone(name) {
  return String(name ?? '')
    .replace(/^mixamorig\d*:?/i, '')
    .replace(/^CC_Base_/i, '')
    .replace(/_\d+$/, '')
    .toLowerCase();
}

// Which of a skeleton's bones (by name) are its toes, rig by rig as
// lib/three/rig.js has them, else its feet: { l, r, by: 'toe' | 'foot' }
// (indices into names), or null.
export function toesOf(names) {
  const roles = [
    ['toe', ['lefttoebase', 'ball_l', 'l_toebase', 'l_leg04_toes_xl2', 'lefttoe', 'toe_l', 'toe.l'], ['righttoebase', 'ball_r', 'r_toebase', 'r_leg04_toes_xl2', 'righttoe', 'toe_r', 'toe.r']],
    ['foot', ['leftfoot', 'foot_l', 'l_foot', 'l_leg03_ankle_xb', 'foot.l'], ['rightfoot', 'foot_r', 'r_foot', 'r_leg03_ankle_xb', 'foot.r']],
    // (the game's walkers on their own rigs, lib/three/rigSets.js: the AT-AT's and AT-TE's front feet)
    ['foot', ['leftfrontfoot'], ['rightfrontfoot']],
  ];
  const plain = names.map((n) => plainBone(n));
  for (const [by, left, right] of roles) {
    const l = left.map((n) => plain.indexOf(n)).find((i) => i >= 0);
    const r = right.map((n) => plain.indexOf(n)).find((i) => i >= 0);
    if (l !== undefined && r !== undefined) return { l, r, by };
  }
  return null;
}

// A figure's name: the nearest of its own and its parents' (nearest first)
// that isn't one an exporter gave it.
export function figureName(names) {
  const generic = /^(scene|auxscene|root|rootnode|armature|sketchfab_model|gltf_scenerootnode|(object|mesh|group|node|geometry|skinnedmesh|model|body|char)([_.\s-]*\d+)?|.*\.(fbx|obj|glb|gltf))$/i;
  return names.find((n) => n && !generic.test(n)) ?? 'figure';
}

// Loops started together: figures on one clip whose phases (0…1 through it)
// are within `tol` of each other, round the loop's end too. → { count (the
// figures in step with another), groups: [{ clip, ids }] }
export function lockstep(list, { tol = PHASE_TOL } = {}) {
  const groups = [];
  const byClip = new Map();
  for (const f of list) byClip.set(f.clip, [...(byClip.get(f.clip) ?? []), f]);
  for (const [clip, fs] of byClip) {
    const sorted = [...fs].sort((a, b) => a.phase - b.phase);
    const runs = [];
    for (const f of sorted) {
      const last = runs.at(-1);
      if (last && f.phase - last.at(-1).phase <= tol) last.push(f);
      else runs.push([f]);
    }
    // (the last run and the first are one if they meet round the end)
    if (runs.length > 1 && runs[0][0].phase + 1 - runs.at(-1).at(-1).phase <= tol) runs[0].unshift(...runs.pop());
    for (const r of runs) if (r.length > 1) groups.push({ clip, ids: r.map((f) => f.id) });
  }
  return { count: groups.reduce((s, g) => s + g.ids.length, 0), groups };
}

// How spread each clip's phases are, for clips two or more figures play:
// [{ clip, n, r }], r the length of the phases' mean on the circle (1: all
// in unison; near 0: spread round), most played first.
export function phaseSpread(list) {
  const byClip = new Map();
  for (const f of list) byClip.set(f.clip, [...(byClip.get(f.clip) ?? []), f.phase]);
  const out = [];
  for (const [clip, ph] of byClip) {
    if (ph.length < 2) continue;
    const c = ph.reduce((s, p) => s + Math.cos(2 * Math.PI * p), 0) / ph.length;
    const s = ph.reduce((a, p) => a + Math.sin(2 * Math.PI * p), 0) / ph.length;
    out.push({ clip, n: ph.length, r: Math.hypot(c, s) });
  }
  return out.sort((a, b) => b.n - a.n);
}

// The page's results (__animCheck.stop()'s) judged: each figure's drift
// (the worse toe's), whether it's in view (on screen and in range for half
// its frames at least), at the bind pose, and in step with another.
export function analyse(res, { limit = LIMIT, unit = 1, clock = 'mixer', plant = PLANT, bindEps = BIND_EPS, tol = PHASE_TOL } = {}) {
  const time = worldTimes(res.wall ?? [], res.totals ?? [], { clock });
  const at = [];
  time.dt.reduce((t, d, k) => (at[k] = t + d), 0);
  const rows = res.figs.map((f) => {
    const toe = (k) => f.s.map((x) => ({ t: at[x[0]] ?? 0, p: x.length > 1 ? [x[1 + 3 * k], x[2 + 3 * k], x[3 + 3 * k]] : null }));
    const opts = { up: f.up ?? [0, 1, 0], plant: plant * unit, jump: JUMP * unit };
    const [left, right] = [0, 1].map((k) => toeDrift(toe(k), opts).drift).map((d) => (d === null ? null : d / unit));
    const known = [left, right].filter((d) => d !== null);
    const shown = f.s.filter((x) => x.length > 1).length;
    const seen = f.s.filter((x) => x[7]).length;
    return { id: f.id, name: f.name, by: f.by, drift: known.length ? Math.max(...known) : null, left, right, shown, inView: shown > 0 && seen * 2 >= shown, dev: f.dev, bind: atBindPose(f.dev, bindEps), act: f.act ?? null };
  });
  const loops = rows.filter((r) => r.act?.loop && r.shown).map((r) => ({ id: r.id, clip: r.act.clip, phase: r.act.phase }));
  const over = rows.filter((r) => r.inView && r.drift !== null && r.drift > limit);
  return { rows, over, bind: rows.filter((r) => r.bind && r.shown), locked: lockstep(loops, { tol }), spread: phaseSpread(loops), time, fail: over.length > 0 };
}

// ── the command line ──

// '#/c-137', '/c-137' and 'c-137' are all '#/c-137'
export const routeOf = (r) => `#/${String(r).replace(/^#?\/?/, '')}`;

export function parseArgs(argv, env = {}) {
  const a = { route: 'c-137', seconds: 6, frames: 20, port: Number(env.PORT) || 5391, host: '127.0.0.1', settle: 4, wait: 300, range: 40, unit: 1, limit: LIMIT, clock: 'mixer', quality: null, chrome: null, json: null, do: [], strict: false, gpu: false, headed: false, phone: false, held: false, talk: false, allowEmpty: false };
  const flags = new Set(['strict', 'gpu', 'headed', 'phone', 'held', 'talk', 'allow-empty']);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      a.route = arg;
      continue;
    }
    const key = arg.slice(2);
    if (flags.has(key)) {
      a[key === 'allow-empty' ? 'allowEmpty' : key] = true;
      continue;
    }
    if (!(key in a) || flags.has(key)) throw new Error(`unknown option ${arg}`);
    const v = argv[++i];
    if (v === undefined || v.startsWith('--')) throw new Error(`${arg} takes a value`);
    if (key === 'do') a.do.push(v);
    else if (typeof a[key] === 'number') {
      a[key] = Number(v);
      if (!Number.isFinite(a[key]) || a[key] < 0) throw new Error(`${arg} takes a number, not ${v}`);
    } else a[key] = v;
  }
  if (/^[A-Za-z]:[\\/]/.test(a.route)) throw new Error(`the route came through as a path (${a.route}): Git Bash rewrites a leading /, so write it as '#/c-137'`);
  if (!['mixer', 'wall'].includes(a.clock)) throw new Error(`--clock is mixer or wall, not ${a.clock}`);
  a.route = routeOf(a.route);
  return a;
}

// The browser: the one asked for (a path, or 'edge' / 'chrome' for the
// usual places), else the first of `found` (Playwright's) and the usual
// places that's there. null when there's none.
export function browserPath(given, env, found = [], exists = existsSync) {
  const want = given ?? env.CHROME ?? env.CHROMIUM ?? null;
  const named = { edge: EDGE, chrome: CHROME };
  if (want && named[want.toLowerCase()]) return named[want.toLowerCase()].find(exists) ?? null;
  if (want) return exists(want) ? want : null;
  return [...found, ...EDGE, ...CHROME].find(exists) ?? null;
}

// ── the page's half ──

// Run in the page before the site's own scripts (an init script), with
// `lib` the pure helpers above and `cfg` { range, fresh } (fresh: how
// lately a scene must have been drawn to count, in ms). It sets up
// window.__THREE_DEVTOOLS__ (three.js tells it of every renderer and mixer
// it makes), lists the scenes each renderer draws on window.__threeScenes,
// and puts the controls on window.__animCheck: drawn() → { scenes, figures }
// (the scenes drawn lately, the figures shown in them), start() → the
// figures found, sampling() → frames so far, stop() → { figs, wall, totals }.
function inPage(cfg, lib) {
  const G = globalThis;
  const reg = (G.__threeScenes = G.__threeScenes || []); // [{ scene: WeakRef, camera: WeakRef, at, frames }]
  const entries = new WeakMap(); // a drawn root → its entry
  const mixers = []; // WeakRefs
  const clock = { frame: 0 }; // one a frame (requestAnimationFrame's)
  let run = null;
  if (typeof G.requestAnimationFrame === 'function') {
    const tick = () => {
      clock.frame++;
      G.requestAnimationFrame(tick);
    };
    G.requestAnimationFrame(tick);
  }
  const now = () => G.performance.now();
  const shown = (o, root) => {
    for (; o; o = o.parent) {
      if (!o.visible) return false;
      if (o === root) return true;
    }
    return false;
  };
  // (drawn lately: a big world in software can take seconds a frame)
  const live = () => reg.filter((e) => e.scene.deref() && now() - e.at < cfg.fresh);
  const toesIn = (mesh) => (mesh.isSkinnedMesh && mesh.skeleton ? lib.toesOf(mesh.skeleton.bones.map((b) => b?.name ?? '')) : null);
  // the mixer rooted nearest above the figure's toe (or its mesh)
  const mixerOf = (fig) => {
    let best = null;
    let near = Infinity;
    for (const ref of mixers) {
      const m = ref.deref();
      const root = m?.getRoot?.();
      if (!root?.isObject3D) continue;
      for (const from of [fig.l, fig.meshes[0]]) {
        let d = 0;
        for (let o = from; o && d < near; o = o.parent, d++)
          if (o === root) {
            [best, near] = [m, d];
            break;
          }
      }
    }
    return best;
  };

  // every figure under a drawn root: a skeleton with toes (or feet), once
  // however many meshes it's skinned to
  const find = (e, root) => {
    e.found = now();
    root.traverse((o) => {
      const t = toesIn(o);
      if (!t) return;
      const bones = o.skeleton.bones;
      const had = run.figs.get(bones[t.l]);
      if (had) {
        if (!had.meshes.includes(o)) had.meshes.push(o);
        return;
      }
      const names = [];
      for (let p = o; p && p !== root; p = p.parent) names.push(p.name || p.userData?.name || '');
      run.figs.set(bones[t.l], { id: run.figs.size, name: lib.figureName(names), by: t.by, l: bones[t.l], r: bones[t.r], meshes: [o], entry: e, s: [] });
    });
  };

  // once a frame, just after a root's drawn: each of its figures' toes,
  // where they are in the world, and whether the camera has them
  const sample = (e, root, camera) => {
    if (run.frame !== clock.frame) {
      run.frame = clock.frame;
      const t = now();
      run.wall.push(run.at === null ? 0 : (t - run.at) / 1000);
      run.at = t;
      for (const ref of mixers) {
        const m = ref.deref();
        if (!m) continue;
        if (!run.t0.has(m)) run.t0.set(m, m.time);
        run.t1.set(m, m.time);
      }
    }
    if (now() - e.found > 2000) find(e, root);
    const k = run.wall.length - 1;
    const vp = camera?.projectionMatrix && camera.matrixWorldInverse ? lib.mul4(camera.projectionMatrix.elements, camera.matrixWorldInverse.elements) : null;
    const eye = camera?.matrixWorld?.elements;
    for (const fig of run.figs.values()) {
      if (fig.entry !== e) continue;
      if (!fig.meshes.some((m) => shown(m, root))) {
        fig.s.push([k]);
        continue;
      }
      const a = fig.l.matrixWorld.elements;
      const b = fig.r.matrixWorld.elements;
      const mid = [(a[12] + b[12]) / 2, (a[13] + b[13]) / 2, (a[14] + b[14]) / 2];
      fig.s.push([k, a[12], a[13], a[14], b[12], b[13], b[14], vp && eye && lib.inView(vp, eye, mid, cfg.range) ? 1 : 0]);
    }
  };

  const note = (root, camera) => {
    // (a full-screen pass's quad isn't a world)
    if (!root?.isObject3D || (!root.isScene && root.isMesh)) return;
    let e = entries.get(root);
    if (!e) {
      for (let i = reg.length - 1; i >= 0; i--) if (!reg[i].scene.deref()) reg.splice(i, 1);
      e = { scene: new WeakRef(root), camera: null, at: 0, frames: 0, sampled: -1, found: 0 };
      entries.set(root, e);
      reg.push(e);
    }
    // (what's in view is judged by the camera the root was drawn with last
    // last frame: a world that draws a reflection or a map of the same
    // scene first draws its own view last)
    const judge = e.camera?.deref() ?? camera;
    if (camera?.isCamera && e.camera?.deref() !== camera) e.camera = new WeakRef(camera);
    e.at = now();
    e.frames++;
    if (!run || e.sampled === clock.frame) return;
    if (!run.entries.has(e)) {
      run.entries.add(e);
      find(e, root);
    }
    e.sampled = clock.frame;
    sample(e, root, judge);
  };

  const wrap = (renderer) => {
    const draw = renderer.render;
    if (typeof draw !== 'function' || draw.__animCheck) return;
    const wrapped = function (root, camera, ...rest) {
      const out = draw.call(this, root, camera, ...rest);
      try {
        note(root, camera);
      } catch (err) {
        G.__animCheckError = String(err?.stack ?? err);
      }
      return out;
    };
    wrapped.__animCheck = true;
    renderer.render = wrapped;
  };

  const hook = G.__THREE_DEVTOOLS__ || (G.__THREE_DEVTOOLS__ = new EventTarget());
  hook.addEventListener('observe', (ev) => {
    const o = ev.detail;
    if (!o) return;
    if ((o.isWebGLRenderer || o.isRenderer) && typeof o.render === 'function') wrap(o);
    else if (typeof o.clipAction === 'function' && typeof o.getRoot === 'function') mixers.push(new WeakRef(o));
  });

  // the loop a figure's mixer weighs most, and where it is in it
  const playing = (m) => {
    let best = null;
    for (const a of (m?._actions ?? []).slice(0, m?._nActiveActions ?? 0)) {
      const w = a.getEffectiveWeight();
      if (w > (best?.w ?? 0.001)) best = { a, w };
    }
    if (!best) return null;
    const d = best.a.getClip().duration || 0;
    return { clip: best.a.getClip().name, phase: d > 0 ? (((best.a.time % d) + d) % d) / d : 0, loop: best.a.loop !== 2200, weight: best.w }; // (2200: LoopOnce)
  };

  G.__animCheck = {
    drawn() {
      const figures = new Set();
      const drawn = live();
      for (const e of drawn) {
        const root = e.scene.deref();
        root.traverse((o) => {
          const t = toesIn(o);
          if (t && shown(o, root)) figures.add(o.skeleton.bones[t.l]);
        });
      }
      return { scenes: drawn.length, figures: figures.size };
    },
    start() {
      for (let i = mixers.length - 1; i >= 0; i--) if (!mixers[i].deref()) mixers.splice(i, 1);
      run = { figs: new Map(), entries: new Set(), wall: [], at: null, frame: -1, t0: new WeakMap(), t1: new WeakMap() };
      for (const e of live()) {
        run.entries.add(e);
        find(e, e.scene.deref());
      }
      return run.figs.size;
    },
    sampling: () => (run ? run.wall.length : 0),
    stop() {
      if (!run) return null;
      const figs = [];
      for (const fig of run.figs.values()) {
        const mesh = fig.meshes[0];
        let dev = null;
        try {
          const sk = mesh.skeleton;
          dev = 0;
          sk.bones.forEach((b, i) => {
            const inv = sk.boneInverses[i];
            if (b && inv) dev = Math.max(dev, lib.skinDeviation(mesh.bindMatrixInverse.elements, b.matrixWorld.elements, inv.elements, mesh.bindMatrix.elements));
          });
        } catch {
          dev = null;
        }
        const cam = fig.entry.camera?.deref();
        figs.push({ id: fig.id, name: fig.name, by: fig.by, s: fig.s, dev, act: playing(mixerOf(fig)), up: cam?.up ? [cam.up.x, cam.up.y, cam.up.z] : [0, 1, 0] });
      }
      const totals = [];
      for (const ref of mixers) {
        const m = ref.deref();
        if (m && run.t0.has(m)) totals.push((run.t1.get(m) - run.t0.get(m)) / (m.timeScale || 1));
      }
      const out = { figs, wall: run.wall, totals };
      run = null;
      return out;
    },
  };
}

const PAGE_LIB = [mul4, skinDeviation, inView, plainBone, toesOf, figureName];

// the page's half as one script, its helpers with it
export const pageScript = ({ range = 40, fresh = 10000 } = {}) => `(() => {\n${PAGE_LIB.map(String).join('\n')}\n(${inPage})(${JSON.stringify({ range, fresh })}, { ${PAGE_LIB.map((f) => f.name).join(', ')} });\n})();`;

// ── the run ──

const fmt = (x, d = 3) => (x === null || x === undefined ? '-' : x.toFixed(d));

// The report, as lines.
export function report(v, { route, limit = LIMIT, scenes = 1, frames = 0, wall = 0 } = {}) {
  const lines = [];
  const seen = v.rows.filter((r) => r.inView);
  lines.push(`${route}: ${v.rows.length} figures in ${scenes} scene${scenes === 1 ? '' : 's'}, ${seen.length} in view; ${frames} frames, ${wall.toFixed(1)} s on the wall, ${v.time.total.toFixed(1)} s in the world (by the ${v.time.from === 'mixers' ? 'mixers’ clocks' : 'wall clock'})`);
  lines.push(`  drift m/s  left   right  view  playing         figure`);
  const order = [...v.rows].filter((r) => r.shown).sort((a, b) => b.inView - a.inView || (b.drift ?? -1) - (a.drift ?? -1));
  for (const r of order) {
    const flag = r.inView && r.drift !== null && r.drift > limit ? ' OVER' : r.bind ? ' BIND' : '';
    const act = r.act ? `${r.act.clip} ${r.act.phase.toFixed(2)}` : r.bind ? '(bind pose)' : '(no clip)';
    lines.push(`  ${fmt(r.drift).padStart(8)}  ${fmt(r.left).padStart(5)}  ${fmt(r.right).padStart(5)}  ${r.inView ? 'in ' : 'out'}   ${act.slice(0, 14).padEnd(14)}  ${r.name}#${r.id}${r.by === 'foot' ? ' (by its feet)' : ''}${flag}`);
  }
  const hidden = v.rows.length - order.length;
  if (hidden) lines.push(`  (${hidden} more never shown)`);
  const name = (id) => {
    const r = v.rows.find((x) => x.id === id);
    return `${r.name}#${r.id}`;
  };
  lines.push(`bind pose: ${v.bind.length}${v.bind.length ? ` (${v.bind.map((r) => `${r.name}#${r.id}${r.inView ? '' : ', out of view'}`).join('; ')})` : ''}`);
  lines.push(`in step: ${v.locked.count}${v.locked.groups.map((g) => ` ${g.clip} [${g.ids.map(name).join(', ')}]`).join(';')}`);
  if (v.spread.length) lines.push(`phase spread (1 in unison, 0 spread round): ${v.spread.map((s) => `${s.clip} ×${s.n} ${s.r.toFixed(2)}`).join(', ')}`);
  return lines;
}

// --held's and --talk's lines for the report
export function heldTalkLines(held, talk) {
  const lines = [];
  const deg = (r) => (r == null ? '-' : `${((r * 180) / Math.PI).toFixed(0)}°`);
  if (held && !held.items.length) lines.push('held: not run (nothing held was sampled)');
  else if (held) {
    lines.push(`held: ${held.items.length} thing${held.items.length === 1 ? '' : 's'} (grip under ${HELD_LIMITS.grip * 100} cm, axis ${deg(HELD_LIMITS.axis)}, still arm ${HELD_LIMITS.swing} rad, upright ${deg(HELD_LIMITS.up)})`);
    for (const it of held.items) lines.push(`  ${it.ok ? 'ok  ' : 'OVER'} ${it.kind.padEnd(11)} grip ${fmt(it.grip * 100, 1)} cm  axis ${deg(it.axis)}  swing ${fmt(it.swing, 2)}  up ${deg(it.up)}${it.why.length ? `  (${it.why.join('; ')})` : ''}`);
  }
  if (talk?.skipped || (talk && !talk.talkers?.length)) lines.push(`talk: not run (${talk.skipped ?? 'no talkers'})`);
  else if (talk) {
    lines.push(`talk: ${talk.talkers.length} talker${talk.talkers.length === 1 ? '' : 's'}`);
    const read = (t) => (t.prompt ? ` (read “${t.prompt}”${t.theirs === false ? `, the first of ${t.prompts}: none named them` : ''})` : '');
    for (const t of talk.talkers) lines.push(`  ${t.ok ? 'ok  ' : 'FAIL'} ${t.name}: ${t.ok ? `answered in ${t.at.toFixed(2)} s` : t.why}${read(t)}`);
  }
  return lines;
}

// Is there a server on the port? Its address, or null.
async function serverAt(port, host) {
  for (const h of [...new Set([host, 'localhost'])]) {
    try {
      const r = await fetch(`http://${h}:${port}/`, { signal: AbortSignal.timeout(5000) });
      if (r.ok) return `http://${h}:${port}`;
    } catch {
      // nothing there
    }
  }
  return null;
}

// a check that couldn't be made (exit code 2), as against one that failed (1)
class Stop extends Error {}
const stop = (msg) => {
  throw new Stop(msg);
};

async function check() {
  let a;
  try {
    a = parseArgs(process.argv.slice(2), process.env);
  } catch (e) {
    stop(`${e.message}\n${USAGE}`);
  }
  const base = await serverAt(a.port, a.host);
  if (!base) stop(`Nothing answers on port ${a.port}: start the dev server first (npx vite --port ${a.port} --strictPort --host 127.0.0.1), then run this again.`);
  const pw = (await readdir('/opt/pw-browsers').catch(() => []))
    .filter((n) => /^chromium-\d+$/.test(n))
    .sort()
    .reverse()
    .map((n) => `/opt/pw-browsers/${n}/chrome-linux/chrome`);
  const exe = browserPath(a.chrome, process.env, pw);
  if (!exe) stop(`No browser${a.chrome ?? process.env.CHROME ? ` at ${a.chrome ?? process.env.CHROME}` : ''}: set CHROME=edge, or CHROME=/path/to/chrome.`);
  const { chromium } = await import('playwright-core');
  const { noisy } = await import('./lib/noise.mjs');
  const gl = a.gpu ? [...(process.platform === 'win32' ? ['--use-angle=d3d11'] : []), '--enable-gpu', '--ignore-gpu-blocklist'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'];
  const browser = await chromium.launch({ executablePath: exe, headless: !a.headed, args: gl });
  const errors = [];
  let code = 0;
  try {
    const viewport = a.phone ? { width: 390, height: 844 } : { width: 1280, height: 720 };
    const ctx = await browser.newContext({ viewport, hasTouch: a.phone });
    // past the front door: the intro seen, the classic view picked, the 3D
    // loaded without asking (a software GL is slow, and that's the point),
    // the tour turned down, the galaxy's panel tucked and its crawl seen
    await ctx.addInitScript(() => {
      const keep = (store, k, v) => {
        try {
          store.setItem(k, v);
        } catch {
          // (storage refused: the gates show, and the check waits on them)
        }
      };
      keep(window.localStorage, 'tp-intro', '1');
      keep(window.localStorage, 'tp-start', '"home"');
      keep(window.localStorage, 'tp-worlds', '"load"');
      keep(window.localStorage, 'tp-software', '"on"'); // (past the Star Wars worlds' GPU gate, lib/fit)
      keep(window.localStorage, 'tp-tour', '"skipped"');
      keep(window.localStorage, 'tp-galaxy-panel', '"tucked"');
      keep(window.sessionStorage, 'tp-galaxy-intro', '1');
    });
    await ctx.addInitScript(pageScript({ range: a.range }));
    if (a.held) await ctx.addInitScript(heldPageScript());
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`page error: ${e.message}`));
    page.on('console', (m) => m.type() === 'error' && !noisy(m.text()) && errors.push(`console: ${m.text().slice(0, 300)}`));
    const url = `${base}/${a.quality ? `?quality=${a.quality}` : ''}${a.route}`;
    console.log(`${url} in ${exe.split(/[\\/]/).pop()}, ${a.gpu ? 'on the graphics chip' : 'in software'}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });

    // a world's basics, if they show; the world's canvas on screen (a
    // page's scene only draws while it's in view)
    const skipBasics = async () => {
      const b = page.getByRole('button', { name: 'Skip the basics' });
      if (await b.count().catch(() => 0)) await b.first().click({ timeout: 3000 }).catch(() => {});
    };
    const onScreen = () =>
      page
        .evaluate(() => {
          let best = null;
          let most = 0;
          for (const c of document.querySelectorAll('canvas')) {
            const r = c.getBoundingClientRect();
            if (r.width * r.height > most) [best, most] = [c, r.width * r.height];
          }
          const r = best?.getBoundingClientRect();
          if (r && (r.top < 0 || r.bottom > window.innerHeight + 1)) best.scrollIntoView({ block: r.height > window.innerHeight ? 'start' : 'center' });
        })
        .catch(() => {});
    const drawn = () => page.evaluate(() => window.__animCheck?.drawn() ?? { scenes: 0, figures: 0 }).catch(() => ({ scenes: 0, figures: 0 }));

    const t0 = Date.now();
    const until = t0 + a.wait * 1000;
    let state = { scenes: 0, figures: 0 };
    let done = false;
    while (Date.now() < until) {
      await skipBasics();
      await onScreen();
      state = await drawn();
      if (state.scenes && !done) {
        done = true;
        // (each tried again till it takes: a world's hooks and cards come a
        // while after its first frame)
        for (const step of a.do) {
          console.log(`  ${step}`);
          for (;;) {
            try {
              if (step.startsWith('click:')) await page.getByRole('button', { name: step.slice(6) }).first().click({ timeout: 5000 });
              else await page.evaluate(step);
              break;
            } catch (e) {
              if (Date.now() > until) stop(`--do ${step} didn't take: ${String(e.message ?? e).split('\n')[0]}`);
              await page.waitForTimeout(2000);
            }
          }
          await page.waitForTimeout(1500);
        }
        continue;
      }
      if (done && state.figures) break;
      await page.waitForTimeout(1000);
    }
    const why = () => (errors.length ? ` (${errors.slice(0, 3).join('; ')})` : '');
    if (!state.scenes) stop(`No three.js scene drew in ${a.wait} s on ${a.route}: did the world start?${why()}`);
    if (!state.figures) stop(`Nothing to measure on ${a.route}: no rigged figure (a SkinnedMesh with toe or foot bones) drawn in ${a.wait} s.${why()}`);
    console.log(`  the world's up in ${((Date.now() - t0) / 1000).toFixed(0)} s, ${state.figures} figures drawn; settling ${a.settle} s`);
    await page.waitForTimeout(a.settle * 1000);
    await skipBasics();

    const found = await page.evaluate(() => window.__animCheck.start());
    if (a.held) await page.evaluate(() => window.__animHeld?.start());
    const began = Date.now();
    const most = began + (a.seconds + 60) * 1000;
    let frames = 0;
    while (Date.now() < most) {
      await page.waitForTimeout(500);
      frames = await page.evaluate(() => window.__animCheck.sampling());
      if (Date.now() - began >= a.seconds * 1000 && frames >= a.frames) break;
    }
    const res = await page.evaluate(() => window.__animCheck.stop());
    const held = a.held ? heldVerdict(await page.evaluate(() => window.__animHeld?.stop() ?? []), { scale: a.unit }) : null;
    const talk = a.talk ? await talkCheck(page) : null;
    const wall = (Date.now() - began) / 1000;
    const inner = await page.evaluate(() => window.__animCheckError ?? null);
    if (inner) errors.push(`the sampler: ${inner.split('\n')[0]}`);
    if (frames < a.frames) console.log(`note: only ${frames} frames in ${wall.toFixed(0)} s (asked for ${a.frames}): the world drew slowly, or stopped drawing`);
    const v = analyse(res, { limit: a.limit, unit: a.unit, clock: a.clock });
    for (const line of report(v, { route: a.route, limit: a.limit, scenes: state.scenes, frames: res.wall.length, wall })) console.log(line);
    if (found !== res.figs.length) console.log(`  (${found} figures at the start, ${res.figs.length} by the end)`);
    for (const line of heldTalkLines(held, talk)) console.log(line);
    if (a.json) {
      await writeFile(a.json, JSON.stringify({ route: a.route, ...v, held, talk }, null, 1));
      console.log(`  → ${a.json}`);
    }
    if (errors.length) console.log(`${errors.length} errors:\n  ${[...new Set(errors)].slice(0, 8).join('\n  ')}`);
    const bindSeen = v.bind.filter((r) => r.inView).length;
    const lockedSeen = v.locked.groups.flatMap((g) => g.ids).filter((id) => v.rows.find((r) => r.id === id)?.inView).length;
    const fails = [];
    if (v.over.length) fails.push(`${v.over.length} figure${v.over.length === 1 ? '' : 's'} in view over ${a.limit} m/s planted-toe drift`);
    if (a.strict && bindSeen) fails.push(`${bindSeen} in view at the bind pose`);
    if (a.strict && lockedSeen) fails.push(`${lockedSeen} in view in step with another`);
    const heldBad = held?.items.filter((it) => !it.ok).length ?? 0;
    const talkBad = talk?.talkers?.filter((t) => !t.ok).length ?? 0;
    if (heldBad) fails.push(`${heldBad} held thing${heldBad === 1 ? '' : 's'} out of hand`);
    if (talkBad) fails.push(`${talkBad} talker${talkBad === 1 ? '' : 's'} not answering the key`);
    fails.push(...emptyFails(a, held, talk));
    console.log(fails.length ? `FAIL ${fails.join('; ')}` : `ok   every figure in view under ${a.limit} m/s`);
    code = fails.length ? 1 : 0;
  } finally {
    await browser.close();
  }
  return code;
}

async function main() {
  let code;
  try {
    code = await check();
  } catch (e) {
    if (!(e instanceof Stop)) throw e;
    console.error(e.message);
    code = 2;
  }
  process.exit(code);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();

// The page's side of the physics worker (worker.js): the face of world.js's
// createPhysics, its engine in a module Worker. `createPhysics({ worker:
// true })` gives this where a Worker can be made and its engine comes up,
// and the main-thread engine everywhere else (world.js); nothing turns it on
// today (worker.js's header says why: lane X2's 0.5 ms a frame).
//
// How a frame goes: step(dt) counts its substeps and alpha here, at once,
// with the engine's own arithmetic, and posts the dt with one of two pose
// buffers; the worker steps and sends the buffer back filled (poses.js,
// rows keyed by id); the answer lands before the next frame, so what a
// body says is the step before the one just asked for (one frame behind,
// the hop's price). Two buffers, so a step can go while the last answer is
// still on its way; were both out, the dt waits and goes with the next.
// No SharedArrayBuffer (GitHub Pages can't isolate the page).
//
// What it carries: add, remove, step, alpha, awake, onOrigin, onOriginShift,
// sleepOutside, disposed, dispose, and a Body's position, quaternion,
// sleeping, removed, dirty, resets, push, wake, reset, enable, onHit,
// onEnter and onLeave (other: the Body or null); plus drawn(outP, outQ)
// (between the last two poses by alpha), query(kind, ...args) → Promise
// (queries.js's, answered with the next step; a body is its handle),
// flush() → Promise (the answers in flight landed), status() → { worker,
// hopMs }, stats() → { rows, inFlight }. What it does not: RAPIER, world,
// onSubstep, tagOf, attach, detach, a Body's `body` and `colliders` (they
// are Rapier's objects, which live in the worker); a world that needs them
// stays on the main thread. A desc the worker can't build is handed to
// onError and its handle marked removed (the main thread throws instead).
// A worker that dies mid-run is reported once and steps nothing more.
//
//   createWorkerPhysics({ make, timeoutMs = 5000, gravity, timeScale,
//     maxSubsteps, maxSpeed, onError }) → Promise<face | null> (null: no
//     worker could be made, or its engine didn't come up in time)
// No three.js, no DOM.

import { HEADER, readPoses, ROW } from './poses.js';

const STEP = 1 / 60; // world.js's STEP (a constant there; a cycle to import it)
const sane = (v, ok, fallback) => (Number.isFinite(v) && ok(v) ? v : fallback);
const finite = (a) => !a || (a.length >= 3 && a.every(Number.isFinite));
const clock = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

// the module Worker, through the pool's shape (src/runtime/workers.js: a factory)
export const makePhysicsWorker = () => new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });

// a desc as data: its functions stay on the page
function plain(desc) {
  const out = {};
  for (const k in desc) if (typeof desc[k] !== 'function') out[k] = desc[k];
  return out;
}

export async function createWorkerPhysics({ make = makePhysicsWorker, timeoutMs = 5000, gravity = -9.81, timeScale = 1, maxSubsteps = 4, maxSpeed = 200, onError = (err) => console.error('physics:', err) } = {}) {
  let worker;
  try {
    worker = make();
  } catch {
    return null; // (no module workers here: the main thread)
  }
  const report = (err) => {
    try {
      onError?.(err);
    } catch {
      // (a reporter that throws has nobody to tell)
    }
  };
  let ready = null;
  const up = new Promise((resolve) => {
    ready = resolve;
  });
  const timer = setTimeout(() => ready(false), timeoutMs);
  worker.onerror = (e) => {
    if (ready) ready(false);
    else dead(e?.error ?? new Error(e?.message ?? 'the physics worker failed'));
  };
  worker.onmessage = (e) => {
    const msg = e.data;
    if (msg?.type === 'ready') ready(true);
    else if (msg?.type === 'failed') ready(false);
    else if (msg?.type === 'poses') land(msg);
  };
  worker.postMessage({ type: 'init', opts: { gravity, timeScale, maxSubsteps, maxSpeed } });
  const ok = await up;
  clearTimeout(timer);
  ready = null;
  if (!ok) {
    worker.terminate();
    return null;
  }

  const scale = sane(timeScale, (v) => v >= 0, 1);
  const most = Math.floor(sane(maxSubsteps, (v) => v >= 1, 4));
  const byId = new Map();
  const shifts = new Set();
  const free = [new Float32Array(HEADER + 64 * ROW), new Float32Array(HEADER + 64 * ROW)];
  let asked = []; // queries for the next step
  const waiting = new Map(); // qid → resolve
  let flights = []; // { sent, resolve }: steps whose poses have not come back
  let owed = 0; // dt that waited for a buffer
  let backlog = 0;
  let nextId = 1;
  let nextQ = 1;
  let rows = 0;
  let hopMs = 0;
  let alive = true;
  let disposed = false;

  function dead(err) {
    if (!alive) return;
    alive = false;
    report(err);
    worker.terminate();
    settleAll();
  }
  function settleAll() {
    for (const resolve of waiting.values()) resolve(undefined);
    waiting.clear();
    for (const f of flights) f.resolve();
    flights = [];
  }

  function land(msg) {
    const f = flights.shift();
    if (f) hopMs = +(clock() - f.sent).toFixed(3);
    const buf = msg.buf;
    rows = buf[0] | 0;
    // (a call that took no substep moves nothing: the last two poses stay
    // the two to draw between)
    const moved = msg.steps > 0;
    readPoses(buf, (id, at, sleeping) => {
      const h = byId.get(id);
      if (!h) return; // (removed since: its row is nobody's)
      if (moved) h.prev.set(h.cur);
      for (let k = 0; k < 7; k++) h.cur[k] = buf[at + k];
      h.asleep = sleeping;
    });
    if (!disposed) free.push(buf);
    for (let k = 0; k < msg.hits.length; k += 5) {
      const h = byId.get(msg.hits[k]);
      if (!h?.onHit) continue;
      try {
        h.onHit(msg.hits[k + 1], [msg.hits[k + 2], msg.hits[k + 3], msg.hits[k + 4]]);
      } catch (err) {
        report(err);
      }
    }
    for (const [id, other, tag, otherTag, started] of msg.crossings) {
      const h = byId.get(id);
      const fn = started ? h?.onEnter : h?.onLeave;
      if (!fn) continue;
      try {
        fn(byId.get(other) ?? null, tag, otherTag);
      } catch (err) {
        report(err);
      }
    }
    for (const { qid, value, error } of msg.answers) {
      if (error) report(new Error(error));
      const resolve = waiting.get(qid);
      waiting.delete(qid);
      resolve?.(withHandles(value));
    }
    for (const { id, message } of msg.errors) {
      const h = byId.get(id);
      if (h) {
        h.removed = true;
        byId.delete(id);
      }
      report(new Error(message));
    }
    f?.resolve();
    if (owed > 0 && !disposed) send(0);
  }

  const withHandles = (v) => {
    if (!v || typeof v !== 'object') return v;
    if (Array.isArray(v)) return v.map(withHandles);
    return 'body' in v ? { ...v, body: byId.get(v.body) ?? null } : v;
  };

  function send(dt) {
    owed += dt;
    if (!free.length || !alive) return;
    const buf = free.pop();
    const queries = asked;
    asked = [];
    let resolve;
    const done = new Promise((r) => {
      resolve = r;
    });
    flights.push({ sent: clock(), resolve, done });
    worker.postMessage({ type: 'step', dt: owed, buf, queries }, [buf.buffer]);
    owed = 0;
  }

  const call = (h, op, args = []) => {
    if (h.removed || !alive) return;
    worker.postMessage({ type: 'call', id: h.id, op, args });
  };

  function add(desc) {
    if (disposed) throw new Error('physics: add after the world was disposed');
    if (!finite(desc.position)) throw new Error(`physics: a body's position must be three numbers, not ${JSON.stringify(desc.position)}`);
    const id = nextId++;
    const p = desc.position ?? [0, 0, 0];
    const q = desc.rotation ?? [0, 0, 0, 1];
    const cur = new Float32Array([p[0], p[1], p[2], q[0], q[1], q[2], q[3]]);
    const h = {
      id,
      desc,
      body: null,
      colliders: [],
      onHit: desc.onHit ?? null,
      onEnter: desc.onEnter ?? null,
      onLeave: desc.onLeave ?? null,
      initial: { position: [...p], rotation: [...q], sleeping: !!desc.sleeping },
      resets: 0,
      removed: false,
      dirty: false,
      asleep: !!desc.sleeping,
      cur,
      prev: cur.slice(),
      get sleeping() {
        return h.removed || h.asleep;
      },
      position(out = [0, 0, 0]) {
        out[0] = h.cur[0];
        out[1] = h.cur[1];
        out[2] = h.cur[2];
        return out;
      },
      quaternion(out = [0, 0, 0, 1]) {
        for (let k = 0; k < 4; k++) out[k] = h.cur[3 + k];
        return out;
      },
      // between the last two poses by alpha (the position lerped, the
      // rotation nlerped: a step's turn is small)
      drawn(outP = [0, 0, 0], outQ = null) {
        const t = Math.min(1, backlog / STEP);
        for (let k = 0; k < 3; k++) outP[k] = h.prev[k] + (h.cur[k] - h.prev[k]) * t;
        if (outQ) {
          const s = h.prev[3] * h.cur[3] + h.prev[4] * h.cur[4] + h.prev[5] * h.cur[5] + h.prev[6] * h.cur[6] < 0 ? -1 : 1;
          let len = 0;
          for (let k = 0; k < 4; k++) {
            outQ[k] = h.prev[3 + k] * (1 - t) + h.cur[3 + k] * s * t;
            len += outQ[k] * outQ[k];
          }
          len = Math.sqrt(len) || 1;
          for (let k = 0; k < 4; k++) outQ[k] /= len;
        }
        return outP;
      },
      push(impulse, at = null) {
        if (h.removed || !finite(impulse) || !finite(at) || !impulse) return false;
        call(h, 'push', at ? [[...impulse], [...at]] : [[...impulse]]);
        return true;
      },
      wake: () => call(h, 'wake'),
      reset() {
        if (h.removed) return;
        h.resets++;
        h.dirty = true;
        call(h, 'reset');
      },
      enable: (on) => call(h, 'enable', [!!on]),
      attach: () => null,
      detach() {},
    };
    byId.set(id, h);
    if (alive) worker.postMessage({ type: 'add', id, desc: plain(desc), hits: !!desc.onHit, enter: !!desc.onEnter, leave: !!desc.onLeave });
    return h;
  }

  function remove(h) {
    if (disposed || !h || h.removed || byId.get(h.id) !== h) return;
    h.removed = true;
    byId.delete(h.id);
    if (alive) worker.postMessage({ type: 'remove', id: h.id });
  }

  function step(dt) {
    if (disposed || !alive || !(dt > 0)) return 0;
    backlog += dt * scale;
    let n = Math.floor(backlog / STEP + 1e-9);
    if (n > most) {
      n = most;
      backlog = 0;
    } else backlog = Math.max(0, backlog - n * STEP);
    send(dt);
    return n;
  }

  return {
    RAPIER: null,
    world: null,
    step,
    add,
    remove,
    tagOf: () => null,
    status: () => ({ worker: alive && !disposed, hopMs }),
    stats: () => ({ rows, inFlight: flights.length }),
    get disposed() {
      return disposed;
    },
    get alpha() {
      return Math.min(1, backlog / STEP);
    },
    // (substep hooks run beside the engine: a world that needs them stays on the main thread)
    onSubstep() {
      report(new Error('physics: substep hooks need the main-thread engine (createPhysics({ worker: false }))'));
      return () => {};
    },
    onOriginShift(fn) {
      shifts.add(fn);
      return () => shifts.delete(fn);
    },
    awake(fn) {
      for (const h of byId.values()) if (!h.asleep && h.desc.type !== 'fixed') fn(h);
    },
    onOrigin(shift) {
      if (disposed) return;
      const [sx, sy, sz] = shift;
      // (moved here at once, so the frame between the ask and the answer doesn't jump)
      for (const h of byId.values()) {
        for (const a of [h.cur, h.prev]) {
          a[0] -= sx;
          a[1] -= sy;
          a[2] -= sz;
        }
        const p = h.initial.position;
        h.initial.position = [p[0] - sx, p[1] - sy, p[2] - sz];
        h.dirty = true;
      }
      if (alive) worker.postMessage({ type: 'origin', shift: [sx, sy, sz] });
      for (const fn of [...shifts]) {
        try {
          fn([sx, sy, sz]);
        } catch (err) {
          report(err);
        }
      }
    },
    sleepOutside(at, r) {
      if (!disposed && alive) worker.postMessage({ type: 'sleepOutside', at: [...at], r });
    },
    query(kind, ...args) {
      if (disposed || !alive) return Promise.resolve(undefined);
      const qid = nextQ++;
      const sent = args.map((a, i) => {
        if (i !== args.length - 1 || !a || typeof a !== 'object' || Array.isArray(a)) return a;
        const o = { ...a };
        if (o.exclude) o.exclude = o.exclude.id;
        if (o.omit) o.omit = [...o.omit].map((b) => b.id);
        return o;
      });
      asked.push({ qid, kind, args: sent });
      return new Promise((resolve) => waiting.set(qid, resolve));
    },
    flush: () => Promise.all(flights.map((f) => f.done)).then(() => undefined),
    dispose() {
      if (disposed) return;
      disposed = true;
      if (alive) worker.postMessage({ type: 'dispose' });
      worker.terminate();
      alive = false;
      settleAll();
      for (const h of byId.values()) h.removed = true;
      byId.clear();
    },
  };
}

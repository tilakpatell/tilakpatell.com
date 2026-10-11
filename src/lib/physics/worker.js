// The physics worker's side: world.js's createPhysics run in a module
// Worker, spoken to by workerClient.js. Rapier still loads through
// engine.js and lib/wasm/load (the SIMD build where it validates, a named
// WasmError within 20 s), only inside the worker. The page sends what it
// would have called; each step comes back as the poses of every body that
// moves, in a transferred Float32Array (poses.js), with the hits, the
// sensor crossings, the queries' answers and any errors since the last.
//
// Off by default (`createPhysics({ worker: false })` everywhere): lane X2
// measured the Battlefront's whole CPU step at 0.5 ms a frame, and the hop
// costs 0.1 to 0.5 ms (the GPU-first research note's Cinevva figure), so it
// pays only where a world's step is measured over 2 ms a frame on the
// owner's laptop (the GPU-first design's N5).
//
// Messages, page to worker (in order; anything before `init` is answered
// once the engine is up):
//   { type: 'init', opts }                     → { type: 'ready', build } | { type: 'failed', message }
//   { type: 'add', id, desc, hits, enter, leave }   (desc as world.js's, its functions left out)
//   { type: 'remove', id }
//   { type: 'call', id, op: 'push' | 'wake' | 'reset' | 'enable', args }
//   { type: 'origin', shift } ; { type: 'sleepOutside', at, r }
//   { type: 'step', dt, buf, queries: [{ qid, kind, args }] }
//     → { type: 'poses', buf, alpha, steps, hits, crossings, answers, errors } (buf transferred both ways)
//   { type: 'dispose' }
// Queries are queries.js's (ray, sweep, overlap, floorAt, project), unbudgeted
// here (the page's client spends its own budget), a body named by its id.
//
//   serve(scope, { create = createPhysics }) (a test runs it in-process: fixtures/fakeWorker.js)
// No three.js, no DOM.

import { encodePoses, HEADER } from './poses.js';
import { createQueries } from './queries.js';
import { createPhysics } from './world.js';

const NONE = { take: () => true, frame() {}, stats: () => ({}) };

export function serve(scope, { create = createPhysics } = {}) {
  let physics = null;
  let queries = null;
  let early = []; // (messages before the engine is up)
  const byId = new Map();
  const moving = new Set(); // (the bodies with a row: the fixed never move)
  let hits = [];
  let crossings = [];
  let errors = [];
  const post = (msg, transfer) => scope.postMessage(msg, transfer);

  const ref = (body) => (body && body.id !== undefined ? body.id : 0);
  const handOut = (v) => {
    if (!v || typeof v !== 'object') return v;
    if (Array.isArray(v)) return v.map(handOut);
    const out = { ...v };
    if ('body' in out) out.body = ref(out.body);
    return out;
  };
  const named = (id) => (id ? (byId.get(id) ?? null) : null);

  function add({ id, desc, hits: wantsHits, enter, leave }) {
    const d = { ...desc };
    if (wantsHits) d.onHit = (force, at) => hits.push(id, force, at[0], at[1], at[2]);
    if (enter) d.onEnter = (other, tag, otherTag) => crossings.push([id, ref(other), tag, otherTag, 1]);
    if (leave) d.onLeave = (other, tag, otherTag) => crossings.push([id, ref(other), tag, otherTag, 0]);
    try {
      const body = physics.add(d);
      body.id = id;
      byId.set(id, body);
      if ((d.type ?? 'dynamic') !== 'fixed') moving.add(body);
    } catch (err) {
      errors.push({ id, message: err?.message ?? String(err) });
    }
  }

  function answer({ qid, kind, args }) {
    try {
      const a = [...args];
      // (a body named by id: queries.js's exclude, and omit's Set)
      const o = a[a.length - 1];
      if (o && typeof o === 'object' && !Array.isArray(o)) {
        const opts = { ...o };
        if ('exclude' in opts) opts.exclude = named(opts.exclude);
        if (Array.isArray(opts.omit)) opts.omit = new Set(opts.omit.map(named).filter(Boolean));
        a[a.length - 1] = opts;
      }
      return { qid, value: handOut(queries[kind](...a)) };
    } catch (err) {
      return { qid, value: undefined, error: err?.message ?? String(err) };
    }
  }

  function handle(msg) {
    switch (msg.type) {
      case 'add':
        return add(msg);
      case 'remove': {
        const body = byId.get(msg.id);
        if (!body) return;
        byId.delete(msg.id);
        moving.delete(body);
        physics.remove(body);
        return;
      }
      case 'call': {
        const body = byId.get(msg.id);
        if (body && typeof body[msg.op] === 'function' && ['push', 'wake', 'reset', 'enable'].includes(msg.op)) body[msg.op](...(msg.args ?? []));
        return;
      }
      case 'origin':
        return physics.onOrigin(msg.shift);
      case 'sleepOutside':
        return physics.sleepOutside(msg.at, msg.r);
      case 'step': {
        const steps = physics.step(msg.dt);
        const answers = (msg.queries ?? []).map(answer);
        const buf = encodePoses(moving, msg.buf.length >= HEADER ? msg.buf : new Float32Array(HEADER));
        buf[1] = steps;
        buf[2] = physics.alpha;
        const out = { type: 'poses', buf, alpha: physics.alpha, steps, hits, crossings, answers, errors };
        hits = [];
        crossings = [];
        errors = [];
        return post(out, [buf.buffer]);
      }
      case 'dispose':
        physics.dispose();
        byId.clear();
        moving.clear();
        return;
      default:
    }
  }

  scope.onmessage = (e) => {
    const msg = e.data;
    if (msg?.type === 'init') {
      const opts = { ...(msg.opts ?? {}), onError: (err) => errors.push({ id: 0, message: err?.message ?? String(err) }) };
      Promise.resolve()
        .then(() => create(opts))
        .then(
          (p) => {
            physics = p;
            queries = createQueries(p, { budget: NONE });
            post({ type: 'ready' });
            const queued = early;
            early = null;
            for (const m of queued) handle(m);
          },
          (err) => post({ type: 'failed', message: err?.message ?? String(err) }),
        );
      return;
    }
    if (early) early.push(msg);
    else if (physics && !physics.disposed) handle(msg);
  };
}

// (in a real worker: serve the page; imported by a test, nothing runs)
if (typeof globalThis.WorkerGlobalScope !== 'undefined' && globalThis instanceof globalThis.WorkerGlobalScope) serve(globalThis);

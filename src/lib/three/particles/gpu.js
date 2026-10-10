// One emitter's particles on the GPU: emitter.js's step as a TSL compute
// pass over storage buffers, one dispatch an emitter a frame, the quads
// drawn straight from the buffers (three's webgpu_tsl_compute_attractors_
// particles and webgpu_particles are the pattern). On the node renderer
// over WebGL 2 the CPU steps the pool (emitter.js) into instanced
// attributes of the same layout, so sprites.js draws either without
// knowing which.
//
// The spawn is not sent: the CPU tells the pass where the ring's head is,
// the next serial and the batches ({ owner, count }), and each thread whose
// slot falls in the window draws its particle from its serial's hashes, the
// same integers curves.js hashes (PCG in u32), so a seeded spawn lands the
// same on both. gpu.test.js steps both 120 frames and reads the buffers back.
//
// createSim(em, n, { renderer, seed, mode }) → Promise<{
//   mode: 'gpu' | 'cpu', n, pool (the CPU twin's counters; its buffers on 'cpu'),
//   nodes: { posAge, velLife, extra } (per-instance vec4 nodes for sprites.js),
//   step(dt, { batches, batchCount, owners, wind }) → spawned,
//   read() → Promise<{ posAge, velLife, extra }> (Float32Arrays: the GPU's read back),
//   clear() (every slot dead),
//   dispose() }>
// mode: 'gpu' where the renderer is WebGPU, else 'cpu'; forced for the tests

import { createPool, MAX_BATCHES, MAX_OWNERS, OWNER, stepPool } from './emitter.js';
import { loadThree } from '../light/three.js';

export const modeFor = (renderer) => (renderer?.backend?.isWebGLBackend || !renderer?.isWebGPURenderer ? 'cpu' : 'gpu');

export async function createSim(em, n, { renderer = null, seed = 1, mode = modeFor(renderer) } = {}) {
  const { THREE, tsl } = await loadThree();
  const pool = createPool(em, n, { seed });
  if (mode === 'cpu') {
    const attrs = ['posAge', 'velLife', 'extra'].map((k) => {
      const a = new THREE.InstancedBufferAttribute(pool[k], 4);
      a.setUsage(THREE.DynamicDrawUsage);
      return a;
    });
    return {
      mode,
      n,
      pool,
      nodes: { posAge: tsl.instancedBufferAttribute(attrs[0]), velLife: tsl.instancedBufferAttribute(attrs[1]), extra: tsl.instancedBufferAttribute(attrs[2]) },
      step(dt, opts) {
        const spawned = stepPool(pool, dt, opts);
        for (const a of attrs) a.needsUpdate = true;
        return spawned;
      },
      read: async () => ({ posAge: pool.posAge.slice(), velLife: pool.velLife.slice(), extra: pool.extra.slice() }),
      clear() {
        pool.velLife.fill(0);
        pool.posAge.fill(0);
        for (const a of attrs) a.needsUpdate = true;
      },
      dispose() {},
    };
  }
  return gpuSim(THREE, tsl, pool, renderer);
}

function gpuSim(THREE, tsl, pool, renderer) {
  const { Fn, If, Loop, instancedArray, instanceIndex, uniform, uniformArray, uint, float, vec3, vec4, sin, cos, sqrt, max, pow, PI } = tsl;
  const { em, n } = pool;
  const posAge = instancedArray(n, 'vec4');
  const velLife = instancedArray(n, 'vec4');
  const extra = instancedArray(n, 'vec4');
  const u = {
    dt: uniform(0),
    head: uniform(0, 'uint'),
    serial: uniform(0, 'uint'),
    total: uniform(0, 'uint'),
    seed: uniform(pool.seed, 'uint'),
    wind: uniform(new THREE.Vector3()),
    batches: uniformArray(
      Array.from({ length: MAX_BATCHES }, () => new THREE.Vector4()),
      'vec4',
    ),
    owners: uniformArray(
      Array.from({ length: MAX_OWNERS * (OWNER / 4) }, () => new THREE.Vector4()),
      'vec4',
    ),
  };

  // PCG's output function in u32, as curves.js's pcg
  const pcg = (v) => {
    const state = v.mul(uint(747796405)).add(uint(2891336453));
    const word = state.shiftRight(state.shiftRight(uint(28)).add(uint(4))).bitXor(state).mul(uint(277803737));
    return word.shiftRight(uint(22)).bitXor(word);
  };
  const rnd = (serial, k) => float(pcg(pcg(u.seed.add(serial)).add(uint(k))).shiftRight(uint(8))).div(16777216);
  const turn = (q, v) => {
    const t = q.xyz.cross(v).mul(2);
    return v.add(t.mul(q.w)).add(q.xyz.cross(t));
  };
  // a curve at t = 0 with the draw r, as evalCurve (the spawn's curves)
  const at0 = (c, r) => {
    if (typeof c === 'number') return float(c);
    if (c?.poly) return float(c.poly[0] * (c.scale ?? 1));
    if (c?.random) return float(c.random[0]).add(r.mul(c.random[1] - c.random[0]));
    return float(0);
  };

  const spawn = (i, serial, o) => {
    const r = (k) => rnd(serial, k);
    const place = em.spawn?.position;
    let local = vec3(0);
    if (place?.box) {
      const { center, size } = place.box;
      local = vec3(r(0).sub(0.5).mul(size[0]).add(center[0]), r(1).sub(0.5).mul(size[1]).add(center[1]), r(2).sub(0.5).mul(size[2]).add(center[2]));
    } else if (place?.sphere) {
      const z = r(0).mul(2).sub(1);
      const phi = r(1).mul(PI.mul(2));
      const rad = pow(r(2), 1 / 3).mul(place.sphere.radius);
      const s = sqrt(max(z.mul(z).oneMinus(), 0));
      local = vec3(s.mul(cos(phi)).mul(rad), z.mul(rad), s.mul(sin(phi)).mul(rad));
    }
    const [dx, dy, dz] = em.spawn?.direction?.dir ?? [0, 1, 0];
    const cosMax = Math.cos(((em.spawn?.direction?.spread ?? 0) * Math.PI) / 180);
    const cosT = r(3).mul(1 - cosMax).oneMinus();
    const sinT = sqrt(max(cosT.mul(cosT).oneMinus(), 0));
    const phi = r(4).mul(PI.mul(2));
    // the basis round d, computed here in JavaScript: d is the record's constant
    const up = Math.abs(dy) < 0.99 ? [0, 1, 0] : [1, 0, 0];
    let a = [dy * up[2] - dz * up[1], dz * up[0] - dx * up[2], dx * up[1] - dy * up[0]];
    const al = Math.hypot(...a) || 1;
    a = a.map((c) => c / al);
    const b = [dy * a[2] - dz * a[1], dz * a[0] - dx * a[2], dx * a[1] - dy * a[0]];
    const cp = cos(phi).mul(sinT);
    const sp = sin(phi).mul(sinT);
    const dir = vec3(dx, dy, dz).mul(cosT).add(vec3(...a).mul(cp)).add(vec3(...b).mul(sp));
    const speed = at0(em.spawn?.speed ?? 0, r(5));
    const size = at0(em.spawn?.size ?? 1, r(6));
    const life = at0(em.lifetime ?? 1, r(7));
    const g = em.gravity ? r(8).mul(2).sub(1).mul(em.gravity.random ?? 0).add(1).mul(em.gravity.g) : float(0);
    const ob = o.mul(OWNER / 4);
    const op = u.owners.element(ob);
    const oq = u.owners.element(ob.add(1));
    const ov = u.owners.element(ob.add(2));
    const p = op.xyz.add(turn(oq, local.mul(op.w)));
    let v = turn(oq, dir).mul(speed);
    if (em.follow?.velocity) v = v.add(ov.xyz);
    posAge.element(i).assign(vec4(p, 0));
    velLife.element(i).assign(vec4(v, max(life, 1e-3)));
    extra.element(i).assign(vec4(size.mul(op.w), g, r(9), float(o)));
  };

  const update = Fn(() => {
    const i = instanceIndex;
    const j = i.add(uint(n)).sub(u.head).mod(uint(n));
    If(j.lessThan(u.total), () => {
      const owner = uint(0).toVar();
      Loop(MAX_BATCHES, ({ i: k }) => {
        const bt = u.batches.element(k);
        If(float(j).greaterThanEqual(bt.y).and(float(j).lessThan(bt.y.add(bt.z))), () => {
          owner.assign(uint(bt.x));
        });
      });
      spawn(i, u.serial.add(j), owner);
    });
    const pa = posAge.element(i);
    const vl = velLife.element(i);
    const ex = extra.element(i);
    If(pa.w.lessThan(vl.w), () => {
      const drag = float(em.drag ?? 0);
      const acc = vec3(0, ex.y.negate(), 0).add(u.wind.sub(vl.xyz).mul(drag));
      const v = vl.xyz.add(acc.mul(u.dt));
      let move = v.mul(u.dt);
      if (em.follow?.source) move = move.add(u.owners.element(uint(ex.w).mul(OWNER / 4).add(3)).xyz);
      vl.assign(vec4(v, vl.w));
      pa.assign(vec4(pa.xyz.add(move), pa.w.add(u.dt)));
    });
  })().compute(n);

  return {
    mode: 'gpu',
    n,
    pool,
    nodes: { posAge: posAge.toAttribute(), velLife: velLife.toAttribute(), extra: extra.toAttribute() },
    step(dt, { batches = [], batchCount = batches.length, owners, wind = null } = {}) {
      // the window: the batches' counts laid end to end from the head, as stepPool lays them
      let total = 0;
      const nb = Math.min(batchCount, MAX_BATCHES);
      for (let k = 0; k < MAX_BATCHES; k++) {
        const bt = u.batches.array[k];
        if (k < nb && total < n) {
          const c = Math.min(batches[k].count, n - total);
          bt.set(batches[k].owner, total, c, 0);
          total += c;
        } else bt.set(0, 0, 0, 0);
      }
      for (let k = 0; k < u.owners.array.length; k++) u.owners.array[k].fromArray(owners, k * 4);
      u.dt.value = dt;
      u.head.value = pool.head;
      u.serial.value = pool.serial;
      u.total.value = total;
      if (wind) u.wind.value.fromArray(wind);
      else u.wind.value.set(0, 0, 0);
      renderer.compute(update);
      pool.head = (pool.head + total) % n;
      pool.serial = (pool.serial + total) >>> 0;
      return total;
    },
    // every slot dead (a hidden kind's: nothing resumes where it froze)
    clear() {
      for (const b of [posAge, velLife]) {
        b.value.array.fill(0);
        b.value.needsUpdate = true;
      }
    },
    async read() {
      const get = async (node) => new Float32Array(await renderer.getArrayBufferAsync(node.value));
      return { posAge: await get(posAge), velLife: await get(velLife), extra: await get(extra) };
    },
    dispose() {
      update.dispose?.();
      for (const s of [posAge, velLife, extra]) s.value?.dispose?.();
    },
  };
}

// The game's effects in a scene: pools per effect kind, instances spawned
// by name, the blueprint's caps and culling honoured, one draw per emitter
// of a kind however many instances run (fidelity lane X).
//
// createEffects(scene, renderer, { tier, defs, load, sheets, light, shadow }) → {
//   spawn(name, at, quat, scale, { autoStart, parent }) → handle,
//   place(json) → { enter(cellKey), leave(cellKey), dispose }   (a level's effects.json)
//   update(dt, camera, wind), stats, ready(name) → Promise, dispose }
//
// - defs: { <Effect>: src/data/bf2017/fx/<Effect>.json }, or `load(name)` →
//   Promise<json> for the ones not given; a name with neither is counted
//   under stats.unknown and its handle does nothing.
// - The variant by tier: the blueprint's Ultra on ultra, High on high,
//   Medium on mid, Low on low (the reader fills a blueprint without them
//   with MaxCount × 1, 0.75, 0.5, 0.25); the variant's scale takes both the
//   pool and the rate.
// - A kind's pool per emitter: MaxCount × scale × MaxActiveInstanceCount
//   slots (MaxActiveInstanceCount held to emitter.js's MAX_OWNERS).
// - Every frame a kind's running instances are ranked by distance to the
//   camera: past the blueprint's CullDistance nothing (stats.beyond counts
//   those instances; a kind with none nearer is not stepped and its meshes
//   are hidden, stats.culled); the nearest
//   MaxActiveInstanceCount simulate, and no more than MaxNearbyInstanceCount
//   of them within NearbyRadius of one another (90 ceiling-snow spawns in
//   the hangar run as the few nearest). Each running emitter spawns by
//   emitter.js's spawnCount, thinned by MaxSpawnDistance and
//   ParticleCullingFactor.
// - SpawnProbability: a spawn that loses its draw is inert (stats.declined).
// - `autoStart: false` waits for `handle.start()` (lane 5's events); an
//   explicit spawn starts at once. A one-shot (no looping emitter) ends by
//   itself once its last particle could have died.
// - `parent`: the instance rides an Object3D (`at`, `quat` in its frame):
//   exhaust and contrails on a ship; the emitters' FollowSpawnSource and
//   FollowSpawnSourceVelocity say whether the particles go with it.
// - light: applyGameLight's result (its params lit the quads each frame);
//   shadow: lane S's sunShadowNode as a function of the world position, when
//   it is on main. sheets: the fx.json manifest (sheets.js); a texture it
//   lacks draws as sprites.js's placeholder.
// Nothing is allocated per frame: the ranks, batches and owners are kept.

import { curveRange, rnd } from './curves.js';
import { createTrails, lifeMax, MAX_OWNERS, OWNER, perInstance, spawnCount, spawnFactor, stepTrails } from './emitter.js';
import { createSim } from './gpu.js';
import { SHEET_DIR, sheetFile, sizeFor } from './sheets.js';
import { createRibbonMesh, createShared, createSpriteMesh, placeholderSheet } from './sprites.js';

const TIER_KEY = { ultra: 'ultra', high: 'high', mid: 'mid', low: 'low' };

// The instances of a kind that run this frame, nearest first: within
// `cull`, at most `maxActive`, at most `nearby.max` within `nearby.radius`
// of one another. `list`: [{ d, x, z, ... }] already holding distances;
// `out` filled and its length returned. Pure, for the tests.
export function chooseRunning(list, count, { cull = Infinity, maxActive = Infinity, nearby = null }, out, order) {
  let n = 0;
  for (let i = 0; i < count; i++) if (list[i].d <= (cull ?? Infinity)) order[n++] = i;
  // (an insertion sort over the kept: a kind runs tens, not thousands)
  for (let i = 1; i < n; i++) {
    const k = order[i];
    let j = i - 1;
    while (j >= 0 && list[order[j]].d > list[k].d) {
      order[j + 1] = order[j];
      j--;
    }
    order[j + 1] = k;
  }
  let m = 0;
  for (let i = 0; i < n && m < maxActive; i++) {
    const a = list[order[i]];
    if (nearby) {
      let close = 0;
      for (let j = 0; j < m; j++) {
        const b = out[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dz = a.z - b.z;
        if (dx * dx + dy * dy + dz * dz <= nearby.radius * nearby.radius) close++;
      }
      if (close >= nearby.max) continue;
    }
    out[m++] = a;
  }
  return m;
}

export function variantFor(def, tier = 'high') {
  return def.variants?.[TIER_KEY[tier] ?? 'high'] ?? { emitters: def.emitters.map((_, i) => i), scale: 1 };
}

// slots an emitter's pool holds at a tier
export const poolSize = (em, def, variant) => Math.max(1, Math.ceil(perInstance(em) * (variant.scale ?? 1)) * Math.min(variant.maxActive ?? def.maxActive ?? 1, MAX_OWNERS));

// the tier's cull distance (none past which: null) and its active cap
export const cullFor = (def, variant) => (variant.cull !== undefined ? variant.cull : def.cull) ?? Infinity;

// how long a one-shot instance lives: its longest emitter's spawning plus its longest life
export function oneShotLength(def) {
  if (def.emitters.some((e) => e.loop !== false)) return Infinity;
  return Math.max(0, ...def.emitters.map((e) => (e.duration ?? lifeMax(e)) + curveRange(e.lifetime)[1]));
}

export function createEffects(scene, renderer, { tier = 'high', defs = {}, load = null, sheets = null, light = null, shadow = null, loadTexture = null } = {}) {
  const kinds = new Map();
  const stats = { kinds: 0, instances: 0, running: 0, beyond: 0, culled: 0, drawn: 0, dispatches: 0, declined: 0, unknown: 0 };
  let shared = null;
  const sharedReady = createShared().then((s) => {
    shared = s;
    if (shadow) shared.shadow = shadow;
    return s;
  });
  const camPrev = { x: 0, y: 0, z: 0, set: false };
  let disposed = false;
  let serial = 0;

  async function sheetFor(em) {
    if (!em.texture) return null;
    const entry = sheets?.sheets?.[em.texture];
    const size = sizeFor(entry, tier);
    if (entry && size && loadTexture) {
      try {
        return await loadTexture(`${SHEET_DIR}${sheetFile(em.texture, size)}`);
      } catch {
        // (the sheet missing on the host: the stand-in below)
      }
    }
    return placeholderSheet(em.uv?.grid ?? [1, 1]);
  }

  async function build(name) {
    const def = defs[name] ?? (load ? await load(name) : null);
    if (!def) return null;
    await sharedReady;
    if (disposed) return null;
    const variant = variantFor(def, tier);
    const emitters = [];
    const maxActive = Math.min(variant.maxActive ?? def.maxActive ?? 1, MAX_OWNERS);
    // (dispose() during the build: what was made goes with it)
    const abandon = () => {
      for (const e of emitters) {
        e.mesh.removeFromParent();
        e.mesh.geometry.dispose();
        e.mesh.material.dispose();
        e.sim?.dispose();
      }
      return null;
    };
    for (const idx of variant.emitters) {
      const em = def.emitters[idx];
      if (!em) continue;
      if (em.kind === 'ribbon') {
        // a trail per owner slot, all of the kind's in one strip mesh
        const trails = createTrails(em, maxActive);
        const rib = await createRibbonMesh(em, trails, { shared, map: await sheetFor(em) });
        rib.mesh.visible = false;
        scene.add(rib.mesh);
        emitters.push({ em, trails, rib, mesh: rib.mesh, n: trails.m * maxActive });
        if (disposed) return abandon();
        continue;
      }
      const n = poolSize(em, def, variant);
      const sim = await createSim(em, n, { renderer, seed: (serial++ * 2654435761) >>> 0 });
      const mesh = await createSpriteMesh(em, sim, { shared, map: await sheetFor(em) });
      mesh.visible = false;
      scene.add(mesh);
      emitters.push({ em, sim, mesh, n });
      if (disposed) return abandon();
    }
    return {
      name,
      def,
      variant,
      emitters,
      maxActive,
      cull: cullFor(def, variant),
      tier: TIER_KEY[tier] ?? 'high',
      life: oneShotLength(def),
      instances: [],
      // (kept for the frame: the ranks, the chosen, the owner table, the batches)
      order: new Int32Array(256),
      chosen: [],
      owners: new Float32Array(MAX_OWNERS * OWNER),
      slots: new Array(MAX_OWNERS).fill(null),
      // (a freed slot rests until its last following particle could have died)
      freedAt: new Float64Array(MAX_OWNERS).fill(-Infinity),
      hold: Math.max(...emitters.map((e) => lifeMax(e.em)), 0),
      clock: 0,
      shown: false,
      batches: Array.from({ length: maxActive }, () => ({ owner: 0, count: 0 })),
      active: new Int32Array(maxActive),
    };
  }

  function kindOf(name) {
    let k = kinds.get(name);
    if (!k) {
      k = { promise: null, kind: null, waiting: [] };
      k.promise = build(name).then((kind) => {
        k.kind = kind;
        if (!kind) stats.unknown++;
        else {
          stats.kinds++;
          for (const inst of k.waiting) kind.instances.push(inst);
        }
        k.waiting = null;
        return kind;
      });
      kinds.set(name, k);
    }
    return k;
  }

  function spawn(name, at = [0, 0, 0], quat = [0, 0, 0, 1], scale = 1, { autoStart = true, parent = null } = {}) {
    const k = kindOf(name);
    const prob = k.kind?.def.probability ?? defs[name]?.probability ?? 1;
    const inst = {
      at: [...at],
      quat: [...quat],
      scale,
      parent,
      running: autoStart,
      dead: false,
      t: 0,
      states: [],
      x: 0,
      y: 0,
      z: 0,
      prev: null,
      d: 0,
      slot: -1,
    };
    if (prob < 1 && rnd(7, serial++, 0) >= prob) {
      stats.declined++;
      inst.dead = true;
    }
    if (!inst.dead) {
      if (k.kind) k.kind.instances.push(inst);
      else if (k.waiting) k.waiting.push(inst);
    }
    return {
      get running() {
        return inst.running && !inst.dead;
      },
      start() {
        inst.running = true;
      },
      stop() {
        inst.running = false;
      },
      kill() {
        inst.dead = true;
      },
      move(p, q) {
        inst.at[0] = p[0];
        inst.at[1] = p[1];
        inst.at[2] = p[2];
        if (q) for (let i = 0; i < 4; i++) inst.quat[i] = q[i];
      },
    };
  }

  // an instance's world position (and the owner record) this frame
  const v3 = { x: 0, y: 0, z: 0 };
  function worldOf(inst) {
    if (inst.parent) {
      const e = inst.parent.matrixWorld.elements;
      const [x, y, z] = inst.at;
      v3.x = e[0] * x + e[4] * y + e[8] * z + e[12];
      v3.y = e[1] * x + e[5] * y + e[9] * z + e[13];
      v3.z = e[2] * x + e[6] * y + e[10] * z + e[14];
    } else {
      v3.x = inst.at[0];
      v3.y = inst.at[1];
      v3.z = inst.at[2];
    }
    return v3;
  }

  const pq = [0, 0, 0, 1];
  function ownerQuat(inst) {
    if (!inst.parent) return inst.quat;
    // the parent's world rotation times the instance's own
    const q = inst.parent.getWorldQuaternion ? inst.parent.getWorldQuaternion(inst._q ?? (inst._q = inst.parent.quaternion.clone())) : inst.parent.quaternion;
    const [bx, by, bz, bw] = inst.quat;
    pq[0] = q.w * bx + q.x * bw + q.y * bz - q.z * by;
    pq[1] = q.w * by - q.x * bz + q.y * bw + q.z * bx;
    pq[2] = q.w * bz + q.x * by - q.y * bx + q.z * bw;
    pq[3] = q.w * bw - q.x * bx - q.y * by - q.z * bz;
    return pq;
  }

  // an owner slot given up: its row zeroed (its particles stop following),
  // its trails cut, and rested before another instance takes it
  function freeSlot(kind, s) {
    kind.slots[s] = null;
    kind.owners.fill(0, s * OWNER, (s + 1) * OWNER);
    kind.freedAt[s] = kind.clock;
    for (const e of kind.emitters) if (e.trails) e.trails.on[s] = 0;
  }

  function takeSlot(kind) {
    let best = -1;
    for (let s = 0; s < MAX_OWNERS; s++) {
      if (kind.slots[s]) continue;
      if (kind.clock - kind.freedAt[s] >= kind.hold) return s;
      if (best < 0 || kind.freedAt[s] < kind.freedAt[best]) best = s;
    }
    return best;
  }

  function updateKind(kind, dt, camera, wind) {
    kind.clock += dt;
    const { x: cx, y: cy, z: cz } = camera.position;
    const list = kind.instances;
    // the dead and the finished one-shots out (in place)
    let w = 0;
    for (let i = 0; i < list.length; i++) {
      const inst = list[i];
      if (inst.running) inst.t += dt;
      if (inst.dead || inst.t > kind.life) {
        if (inst.slot >= 0) freeSlot(kind, inst.slot);
        inst.slot = -1;
        continue;
      }
      list[w++] = inst;
    }
    list.length = w;
    // the running ones first, their distances taken, so chooseRunning sees them at 0…r
    let r = 0;
    for (let i = 0; i < list.length; i++) {
      const inst = list[i];
      if (!inst.running) continue;
      const p = worldOf(inst);
      inst.x = p.x;
      inst.y = p.y;
      inst.z = p.z;
      inst.d = Math.hypot(p.x - cx, p.y - cy, p.z - cz);
      if (inst.d > kind.cull) stats.beyond++;
      list[i] = list[r];
      list[r] = inst;
      r++;
    }
    if (r > kind.order.length) kind.order = new Int32Array(r * 2);
    const m = chooseRunning(list, r, { cull: kind.cull, maxActive: kind.maxActive, nearby: kind.def.nearby }, kind.chosen, kind.order);
    kind.chosen.length = m;
    if (r > 0 && m === 0) stats.culled++;
    // owner slots: kept by those still chosen, freed by the rest
    for (let s = 0; s < MAX_OWNERS; s++) {
      const inst = kind.slots[s];
      if (inst && !kind.chosen.includes(inst)) {
        inst.slot = -1;
        freeSlot(kind, s);
      }
    }
    let nb = 0;
    for (let c = 0; c < m; c++) {
      const inst = kind.chosen[c];
      if (inst.slot < 0) {
        inst.slot = takeSlot(kind);
        kind.slots[inst.slot] = inst;
        inst.prev = null;
      }
      const b = inst.slot * OWNER;
      const o = kind.owners;
      const q = ownerQuat(inst);
      const [px, py, pz] = inst.prev ?? [inst.x, inst.y, inst.z];
      o[b] = inst.x;
      o[b + 1] = inst.y;
      o[b + 2] = inst.z;
      o[b + 3] = inst.scale;
      o[b + 4] = q[0];
      o[b + 5] = q[1];
      o[b + 6] = q[2];
      o[b + 7] = q[3];
      o[b + 12] = inst.x - px;
      o[b + 13] = inst.y - py;
      o[b + 14] = inst.z - pz;
      o[b + 8] = dt > 0 ? o[b + 12] / dt : 0;
      o[b + 9] = dt > 0 ? o[b + 13] / dt : 0;
      o[b + 10] = dt > 0 ? o[b + 14] / dt : 0;
      inst.prev ??= [0, 0, 0];
      inst.prev[0] = inst.x;
      inst.prev[1] = inst.y;
      inst.prev[2] = inst.z;
      nb++;
    }
    stats.running += m;
    const visible = m > 0;
    for (let c = 0; c < m; c++) kind.active[c] = kind.chosen[c].slot;
    // hidden (culled, or nothing running): everything dies once, so nothing
    // resumes where it froze when the kind comes back
    if (!visible && kind.shown) {
      for (const e of kind.emitters) {
        e.sim?.clear();
        if (e.trails) stepTrails(e.trails, Infinity, kind.owners, kind.active, 0);
      }
    }
    kind.shown = visible;
    for (let e = 0; e < kind.emitters.length; e++) {
      const { em, sim, mesh, trails, rib } = kind.emitters[e];
      if (!visible) {
        mesh.visible = false;
        continue;
      }
      if (trails) {
        stepTrails(trails, dt, kind.owners, kind.active, m);
        rib.update(camera);
        mesh.visible = true;
        stats.drawn++;
        continue;
      }
      for (let c = 0; c < m; c++) {
        const inst = kind.chosen[c];
        // (the emitter's own: its StartDelay, and its SpawnProbability by
        // tier drawn once an instance)
        const st = (inst.states[e] ??= { t: -(em.delay ?? 0), acc: 0, burst: false, skip: rnd(11, serial++, 0) >= (em.probability?.[kind.tier] ?? 1) });
        kind.batches[c].owner = inst.slot;
        if (st.skip) kind.batches[c].count = 0;
        else if (st.t < 0) {
          st.t += dt;
          kind.batches[c].count = 0;
        } else kind.batches[c].count = spawnCount(st, em, dt, { scale: kind.variant.scale ?? 1, factor: spawnFactor(inst.d, em) });
      }
      sim.step(dt, { batches: kind.batches, batchCount: nb, owners: kind.owners, wind });
      stats.dispatches += sim.mode === 'gpu' ? 1 : 0;
      mesh.visible = true;
      stats.drawn++;
    }
  }

  function lightUp() {
    const p = light?.params;
    if (!p || !shared) return;
    shared.sunDir.value.set(...p.sun.dir).normalize();
    shared.sunColor.value.setRGB(...p.sun.color).multiplyScalar(p.sun.intensity / Math.PI);
    // (the sky's ambient at full: it stands in for the environment light
    // the quads do not sample)
    shared.ambient.value.setRGB(...p.ambient.sky).multiplyScalar(p.ambient.intensity);
    shared.gameToSite.value = p.gameToSite ?? 1;
  }

  return {
    stats,
    spawn,
    ready: (name) => kindOf(name).promise,
    // a level's effects.json (scripts/bf2017-effects.mjs): each cell's
    // effects spawned when it enters and killed when it leaves
    place(json) {
      const live = new Map();
      return {
        enter(key) {
          if (live.has(key)) return;
          const handles = (json.cells?.[key] ?? []).map((e) => spawn(e.name, e.pos, e.quat ?? [0, 0, 0, 1], e.scale ?? 1, { autoStart: e.autoStart ?? defs[e.name]?.autoStart ?? true }));
          live.set(key, handles);
        },
        leave(key) {
          for (const h of live.get(key) ?? []) h.kill();
          live.delete(key);
        },
        handles: (key) => live.get(key) ?? [],
        dispose() {
          for (const key of [...live.keys()]) this.leave(key);
        },
      };
    },
    update(dt, camera, wind = null) {
      stats.instances = 0;
      stats.running = 0;
      stats.beyond = 0;
      stats.culled = 0;
      stats.drawn = 0;
      stats.dispatches = 0;
      const cp = camera.position;
      if (shared) {
        if (camPrev.set && dt > 0) shared.camVel.value.set((cp.x - camPrev.x) / dt, (cp.y - camPrev.y) / dt, (cp.z - camPrev.z) / dt);
        lightUp();
      }
      camPrev.x = cp.x;
      camPrev.y = cp.y;
      camPrev.z = cp.z;
      camPrev.set = true;
      for (const k of kinds.values()) {
        if (!k.kind) continue;
        updateKind(k.kind, dt, camera, wind);
        stats.instances += k.kind.instances.length;
      }
    },
    dispose() {
      disposed = true;
      for (const k of kinds.values()) {
        for (const e of k.kind?.emitters ?? []) {
          e.mesh.removeFromParent();
          e.mesh.geometry.dispose();
          e.mesh.material.dispose();
          e.sim?.dispose();
        }
      }
      kinds.clear();
    },
  };
}

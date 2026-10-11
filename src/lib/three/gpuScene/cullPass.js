// The GPU scene's cull as TSL compute (GPU-first lane N1): cull.js's rules
// (its cullCpu is the twin, tested in Node) over every row of the instance
// buffer, in three dispatches a frame:
//
//   reset     the keys' counters and the stats to 0
//   cull      a thread a row: dead, seenAt, the LOD cut, the frustum, the
//             depth pyramid; the row's index appended to its key's list
//             (and the old key's while it fades, and the shadow list)
//   finalize  a thread a draw slot: its key's count into the slot's
//             drawIndexedIndirect arguments, its key's base as firstInstance
//
// The buffers (storage, six a stage at most, under WebGPU's default eight):
//   rows      the scene's rows, two uvec4 a row (pack.js), read-only
//   info      two vec4 a mesh: bounds centre and radius; the four LOD steps
//   table     u32: a mesh's LOD → file and (file, mirrored) → key + 1; the keys' bases
//   counters  atomic u32: the keys' counts (camera, then shadow), then the stats
//   state     uvec2 a row: x the file drawn (low 4 bits) and the file before it (next 4); y when it changed (f32 bits)
//   visible   u32: the lists (the camera's keys' rooms, then the shadow's)
//   indirect  the draws' arguments, five u32 a slot (camera slots, then shadow): three.js's IndirectStorageBufferAttribute
//
// createCull(renderer, { scene, table, hzb, three, slots }) → {
//   nodes: { rows, visible, state, visibleRead, stateRead } (draws.js's vertex pull), uniforms, indirect,
//   setSlot(s, { key, indexCount, firstIndex, baseVertex }), slotCount,
//   run(camera, { now, width, height, occlude }), stats() → { tested, culled, occluded, drawn } (read every 30 frames),
//   read() → Promise<every buffer as u32> (the parity check's),
//   dispose() }

import { FADE, MESH_U32, NONE, SHADOW_REACH } from './cull.js';
import { MIN_RADIUS } from '../../level/lod.js';
import { MAX_LODS, lodIndexNode } from './lodRule.js';
import { FLAG } from './pack.js';
import { upload } from './three.js';

// frames between two reads of the stats (a read waits on the GPU: never every frame)
export const STATS_EVERY = 30;
const STATS = 4;

export function createCull(renderer, { scene, table, hzb = null, three, slots = 256 }) {
  const { THREE, tsl } = three;
  const { Fn, If, Loop, instanceIndex, uniform, uniformArray, uint, float, vec2, vec3, vec4, storage, atomicAdd, atomicLoad, atomicStore, abs, max, min, dot, bool, select, unpackHalf2x16, bitcast, length } = tsl;
  const keys = Math.max(1, table.keys.length);
  const cap = scene.capacity;

  const rowsAttr = new THREE.StorageBufferAttribute(scene.rows, 4);
  const infoAttr = new THREE.StorageBufferAttribute(table.info, 4);
  const tableAttr = new THREE.StorageBufferAttribute(table.u32, 1);
  const counterAttr = new THREE.StorageBufferAttribute(new Uint32Array(keys * 2 + STATS), 1);
  const stateAttr = new THREE.StorageBufferAttribute(new Uint32Array(cap * 2).fill(NONE | (NONE << 4)), 2);
  const visibleAttr = new THREE.StorageBufferAttribute(new Uint32Array(Math.max(1, table.room * 2)), 1);
  const slotKeyAttr = new THREE.StorageBufferAttribute(new Uint32Array(slots), 1);
  const indirect = new THREE.IndirectStorageBufferAttribute(slots * 2, 5);

  const rows = storage(rowsAttr, 'uvec4', cap * 2).toReadOnly();
  const info = storage(infoAttr, 'vec4', table.meshes * 2).toReadOnly();
  const tab = storage(tableAttr, 'uint', table.u32.length).toReadOnly();
  const counters = storage(counterAttr, 'uint', keys * 2 + STATS).toAtomic();
  const state = storage(stateAttr, 'uvec2', cap);
  const visible = storage(visibleAttr, 'uint', Math.max(1, table.room * 2));
  const slotKey = storage(slotKeyAttr, 'uint', slots).toReadOnly();
  const args = storage(indirect, 'uint', slots * 10);

  const u = {
    count: uniform(0, 'uint'),
    slots: uniform(0, 'uint'),
    pos: uniform(new THREE.Vector3()),
    planes: uniformArray(Array.from({ length: 6 }, () => new THREE.Vector4()), 'vec4'),
    view: uniform(new THREE.Matrix4()),
    proj: uniform(new THREE.Matrix4()),
    screen: uniform(new THREE.Vector2(1, 1)),
    near: uniform(0.1),
    K: uniform(Number.isFinite(table.K) ? table.K : 1e9),
    L0: uniform(table.L0),
    now: uniform(0),
    fade: uniform(FADE),
    reach: uniform(SHADOW_REACH),
    hzbOn: uniform(0, 'uint'),
  };
  const lodIndex = lodIndexNode(tsl);
  const room = uint(table.room);
  const keyBase = (key) => tab.element(uint(table.keyBaseAt).add(key));

  const reset = Fn(() => {
    atomicStore(counters.element(instanceIndex), uint(0));
  })().compute(keys * 2 + STATS);

  const emit = (key, i, shadow) => {
    const at = atomicAdd(counters.element(shadow ? key.add(uint(keys)) : key), uint(1)).toVar();
    visible.element(keyBase(key).add(shadow ? room : uint(0)).add(at)).assign(i);
  };
  const stat = (k) => atomicAdd(counters.element(uint(keys * 2 + k)), uint(1));

  const cull = Fn(() => {
    const i = instanceIndex;
    If(i.lessThan(u.count), () => {
      const a = rows.element(i.mul(2));
      const b = rows.element(i.mul(2).add(1));
      const flags = b.w.shiftRight(uint(16));
      If(flags.bitAnd(uint(FLAG.live)).notEqual(uint(0)), () => {
        stat(0);
        const m = b.w.bitAnd(uint(0xffff));
        const mir = select(flags.bitAnd(uint(FLAG.mirrored)).notEqual(uint(0)), uint(1), uint(0));
        const p = vec3(bitcast(a.x, 'float'), bitcast(a.y, 'float'), bitcast(a.z, 'float'));
        const qxy = unpackHalf2x16(a.w);
        const qzw = unpackHalf2x16(b.x);
        const q = vec4(qxy.x, qxy.y, qzw.x, qzw.y);
        const sxy = unpackHalf2x16(b.y);
        const s = vec3(sxy.x, sxy.y, unpackHalf2x16(b.z).x);
        const head = info.element(m.mul(2));
        const steps = info.element(m.mul(2).add(1));
        const R = max(float(MIN_RADIUS), head.w.mul(max(abs(s.x), max(abs(s.y), abs(s.z))))).toVar();
        const t = q.xyz.cross(head.xyz.mul(s)).mul(2);
        const c = p.add(head.xyz.mul(s)).add(t.mul(q.w)).add(q.xyz.cross(t)).toVar();
        const d = length(vec2(p.x.sub(u.pos.x), p.z.sub(u.pos.z))).toVar();
        const st = state.element(i);
        const old = st.x.bitAnd(uint(15)).toVar();
        const prev = st.x.shiftRight(uint(4)).bitAnd(uint(15)).toVar();
        const changed = bitcast(st.y, 'float').toVar();
        const done = bool(head.w.lessThan(0).or(d.greaterThan(u.K.mul(R)))).toVar();
        If(done, () => stat(1));
        const base = m.mul(uint(MESH_U32));
        const keyAt = (k) => tab.element(base.add(uint(MAX_LODS)).add(k.mul(2)).add(mir));
        const loaded = (k) => k.lessThan(uint(MAX_LODS)).and(keyAt(min(k, uint(MAX_LODS - 1))).notEqual(uint(0)));
        const k = uint(NONE).toVar();
        If(done.not(), () => {
          const n = lodIndex(d, R, u.L0, tsl.uvec4(steps));
          const want = tab.element(base.add(min(n, uint(MAX_LODS - 1)))).toVar();
          // (as chooseFile: the wanted file, the one drawn last frame, the
          // nearest coarser loaded, the nearest finer)
          const coarser = uint(NONE).toVar();
          const finer = uint(NONE).toVar();
          for (let f = MAX_LODS - 1; f >= 0; f--) If(uint(f).greaterThan(want).and(loaded(uint(f))), () => coarser.assign(uint(f)));
          for (let f = 0; f < MAX_LODS; f++) If(uint(f).lessThan(want).and(loaded(uint(f))), () => finer.assign(uint(f)));
          k.assign(select(loaded(want), want, select(loaded(old), old, select(coarser.notEqual(uint(NONE)), coarser, finer))));
          If(k.equal(uint(NONE)), () => {
            done.assign(true);
            stat(1);
          });
        });
        If(done.not(), () => {
          If(old.notEqual(uint(NONE)).and(old.notEqual(k)), () => {
            prev.assign(old);
            changed.assign(u.now);
          });
          const key = keyAt(k).sub(uint(1)).toVar();
          If(d.sub(R).lessThanEqual(u.reach).and(flags.bitAnd(uint(FLAG.horizon)).equal(uint(0))), () => emit(key, i, true));
          Loop(6, ({ i: j }) => {
            const pl = u.planes.element(j);
            If(dot(pl.xyz, c).add(pl.w).lessThan(R.negate()), () => done.assign(true));
          });
          If(done, () => stat(1));
          if (hzb) {
            If(done.not().and(u.hzbOn.equal(uint(1))), () => {
              const v = u.view.mul(vec4(c, 1)).xyz.toVar();
              If(v.z.negate().sub(R).greaterThan(u.near), () => {
                const lo = vec2(1e9, 1e9).toVar();
                const hi = vec2(-1e9, -1e9).toVar();
                for (const dx of [-1, 1]) for (const dy of [-1, 1]) for (const dz of [-1, 1]) {
                  const cl = u.proj.mul(vec4(v.add(vec3(dx, dy, dz).mul(R)), 1));
                  const ndc = cl.xy.div(cl.w);
                  lo.assign(min(lo, ndc));
                  hi.assign(max(hi, ndc));
                }
                const zc = u.proj.mul(vec4(0, 0, v.z.add(R), 1));
                const px = (x) => min(u.screen.x.sub(1e-3), max(0, x.mul(0.5).add(0.5).mul(u.screen.x)));
                const py = (y) => min(u.screen.y.sub(1e-3), max(0, float(0.5).sub(y.mul(0.5)).mul(u.screen.y)));
                const rect = vec4(px(lo.x), py(hi.y), px(hi.x), py(lo.y));
                If(hzb.occludedNode(rect, zc.z.div(zc.w)), () => {
                  done.assign(true);
                  stat(2);
                });
              });
            });
          }
          If(done.not(), () => {
            stat(3);
            emit(key, i, false);
            If(prev.notEqual(uint(NONE)).and(prev.notEqual(k)).and(u.now.sub(changed).lessThan(u.fade)).and(loaded(prev)), () => emit(keyAt(prev).sub(uint(1)), i, false));
          });
        });
        st.assign(tsl.uvec2(k.bitOr(prev.shiftLeft(uint(4))), bitcast(changed, 'uint')));
      });
    });
  })().compute(cap);

  const finalize = Fn(() => {
    const s = instanceIndex;
    If(s.lessThan(u.slots), () => {
      const key = slotKey.element(s);
      const b = keyBase(key);
      args.element(s.mul(5).add(1)).assign(atomicLoad(counters.element(key)));
      args.element(s.mul(5).add(4)).assign(b);
      const t = s.add(uint(slots)).mul(5);
      args.element(t.add(1)).assign(atomicLoad(counters.element(key.add(uint(keys)))));
      args.element(t.add(4)).assign(b.add(room));
    });
  })().compute(slots);

  let frame = 0;
  let last = { tested: 0, culled: 0, occluded: 0, drawn: 0 };
  let reading = false;
  let tableVersion = -1;
  let slotCount = 0;
  const _m = new THREE.Matrix4();
  const _f = new THREE.Frustum();

  return {
    // (the vertex stage reads storage read-only: views of the same buffers)
    nodes: { rows, visible, state, visibleRead: storage(visibleAttr, 'uint', Math.max(1, table.room * 2)).toReadOnly(), stateRead: storage(stateAttr, 'uvec2', cap).toReadOnly() },
    uniforms: u,
    indirect,
    slots,
    keys,
    get slotCount() {
      return slotCount;
    },
    // a draw slot's static arguments (its part's place in the group's
    // merged geometry), for the camera and the shadow alike
    setSlot(s, { key, indexCount, firstIndex, baseVertex }) {
      if (s >= slots) throw new Error(`the GPU scene holds ${slots} draw slots`);
      slotKeyAttr.array[s] = key;
      upload(slotKeyAttr, { start: s, count: 1 });
      for (const at of [s, slots + s]) {
        indirect.array.set([indexCount, 0, firstIndex, baseVertex, 0], at * 5);
      }
      // (the whole buffer: the two halves are far apart, and finalize writes the counts every frame)
      indirect.needsUpdate = true;
      slotCount = Math.max(slotCount, s + 1);
    },
    run(camera, { now = 0, width, height, occlude = true } = {}) {
      if (scene.capacity !== cap) throw new Error('the GPU scene grew: make the cull again');
      upload(rowsAttr, scene.takeDirty(), 2);
      if (table.version !== tableVersion) {
        tableAttr.needsUpdate = true;
        tableVersion = table.version;
      }
      camera.updateMatrixWorld();
      u.count.value = scene.count;
      u.slots.value = slotCount;
      u.pos.value.setFromMatrixPosition(camera.matrixWorld);
      u.view.value.copy(camera.matrixWorldInverse);
      u.proj.value.copy(camera.projectionMatrix);
      u.near.value = camera.near;
      u.now.value = now;
      _f.setFromProjectionMatrix(_m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse), camera.coordinateSystem, camera.reversedDepth);
      _f.planes.forEach((p, k) => u.planes.array[k].set(p.normal.x, p.normal.y, p.normal.z, p.constant));
      u.hzbOn.value = hzb?.valid && occlude ? 1 : 0;
      if (width) u.screen.value.set(width, height);
      renderer.compute(reset);
      renderer.compute(cull);
      renderer.compute(finalize);
      if (++frame % STATS_EVERY === 0 && !reading && renderer.getArrayBufferAsync) {
        reading = true;
        renderer
          .getArrayBufferAsync(counterAttr)
          .then((buf) => {
            const v = new Uint32Array(buf, (keys * 2) * 4, STATS);
            last = { tested: v[0], culled: v[1], occluded: v[2], drawn: v[3] };
          })
          .catch(() => {})
          .finally(() => (reading = false));
      }
    },
    stats: () => last,
    // every buffer read back (the parity check's; it waits on the GPU)
    async read() {
      const get = async (a) => new Uint32Array(await renderer.getArrayBufferAsync(a));
      return { counters: await get(counterAttr), visible: await get(visibleAttr), state: await get(stateAttr), indirect: await get(indirect), keys, room: table.room, slots };
    },
    dispose() {
      for (const n of [reset, cull, finalize]) n.dispose?.();
      for (const a of [rowsAttr, infoAttr, tableAttr, counterAttr, stateAttr, visibleAttr, slotKeyAttr, indirect]) a.dispose?.();
    },
  };
}


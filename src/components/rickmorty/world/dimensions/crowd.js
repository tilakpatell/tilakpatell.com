// A place's crowd (its world's walkers and gatherings, laid out by
// ./outskirts.js): copies of the cast the site already has, drawn as
// instances, so a crowd of thirty costs a few draws. Each kind of each
// walker and gathering is one InstancedMesh on a material of its own (the
// cast's texture, the cast's light ramp, never the cast's own material):
//   - a kind that isn't rigged, the cast's model as it stands (kit.cast.prop);
//   - a rigged kind, stood in its idle by lib/three/bakePose (the figure
//     made to stand it let go after);
//   - `crowd:<name>`, one of the Citadel's light copies (/games/meshy/crowd).
// Walkers go round their loops on the instance's matrix (./crowdPose.js),
// bobbing and swaying in their step; a gathering stands in its disc facing
// what it watches, breathing (../../portal/crowdPaint.js: never a walker,
// whose breath would jitter as it moves), hopping on a beat and turning to
// look at someone when it's asked. No shadow, no line (as the Citadel's
// crowd has none), each mesh's bounds its layout's, so a walker never pops
// out of view. Who's there follows the story (`until`, `after`, `when`, as
// a place's people do) and the place (`show`).
//
// createCrowd(kit, R, laid, { loader }) → { ready, hop(), turn(to | null),
//   show(key | 'all', on), counts() }
//   kit: the world's (need, track, cast, adopt); R: the place's room kit
//   (its group, own, tick); laid: outskirtsOf's

import * as THREE from 'three';
import { toon } from '../../portal/toon';
import { MESHY, RIGGED, lightRamp } from '../../portal/meshyCastCore';
import { breathing, standing } from '../../portal/crowdPaint';
import { bakePose } from '../../../../lib/three/bakePose';
import { gltfLoader } from '../../../../lib/three/gltf';
import { gatherAt, hopOf, loopLengths, rowAt, walkerAt } from './crowdPose';

const COPIES = '/games/meshy/crowd';
// how tall a light copy stands (the Citadel's: a Morty 1.5 m, the rest 1.85)
const copyTall = (name) => (name.includes('morty') ? 1.5 : 1.85);
const IDLE_AT = 0.4; // seconds into the idle a rigged kind is stood at
const HOPS = 1.2; // seconds a hop takes to ripple through a gathering
// how much room each of a gathering takes: along a row, and in a disc (its radius grows as the root)
const ROW_EACH = 1.1;
const DISC_EACH = 0.75;

const isOn = (e, state, shown) => {
  if (shown.get('all') === false || shown.get(e.key) === false) return false;
  const done = state?.done ?? [];
  if (e.when) return e.when(state);
  return (!e.until || !done.includes(e.until)) && (!e.after || done.includes(e.after));
};

export function createCrowd(kit, R, laid, { loader = null } = {}) {
  const clock = { value: 0 };
  const shapes = new Map(); // kind → Promise<{ geo, map, h } | null>
  let gltf = loader;

  // a kind's geometry, standing on the ground at its height, and its texture
  const shapeOf = (kind) => {
    if (!shapes.has(kind)) shapes.set(kind, makeShape(kind).catch(() => null));
    return shapes.get(kind);
  };
  const firstMesh = (root) => {
    let mesh = null;
    root.traverse((o) => {
      if (o.isMesh && !mesh) mesh = o;
    });
    return mesh;
  };
  async function makeShape(kind) {
    if (kind.startsWith('crowd:')) {
      const name = kind.slice(6);
      gltf ??= gltfLoader();
      const g = await gltf.loadAsync(`${COPIES}/${name}.glb`);
      const mesh = firstMesh(g.scene);
      if (!mesh) return null;
      g.scene.updateMatrixWorld(true);
      const h = copyTall(name);
      const geo = R.own(standing(mesh.geometry, mesh.matrixWorld, h));
      const map = mesh.material.map ?? null;
      if (map) R.own(map);
      mesh.geometry.dispose();
      mesh.material.dispose();
      return { geo, map, h };
    }
    const spec = MESHY[kind];
    if (!spec) return null;
    const rigged = RIGGED.has(spec.a);
    await kit.need([spec.a], { clips: rigged ? ['idle', 'walk', 'run'] : [] });
    if (!rigged) {
      const g = kit.cast.prop(spec.a, spec.h);
      const mesh = g && firstMesh(g);
      if (!mesh) return null;
      g.updateMatrixWorld(true);
      return { geo: R.own(standing(mesh.geometry, mesh.matrixWorld, spec.h)), map: mesh.material.map ?? null, h: spec.h };
    }
    const c = kit.cast.make(kind);
    const model = c?.body?.children[0];
    if (!model) return null;
    const baked = bakePose(model, c.act?.idle?.getClip?.() ?? null, IDLE_AT);
    let map = null;
    model.traverse((o) => {
      if (o.isSkinnedMesh && !map) map = o.material.map ?? null;
    });
    c.release?.();
    if (!baked) return null;
    const geo = R.own(standing(baked, new THREE.Matrix4(), spec.h));
    baked.dispose();
    return { geo, map, h: spec.h };
  }

  // (what moves them, made once: nothing is made a frame)
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const eul = new THREE.Euler(0, 0, 0, 'YXZ');
  const v = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  const pose = {};
  let last = 0;
  let watch = null; // where a gathering's turned to look, if it's been asked
  let hopAt = null;
  const shown = new Map();

  // ── standing them ──
  const records = []; // { e, mesh, copies: [j…], walking }
  const entries = [...laid.walkers.map((e) => ({ ...e, walking: true })), ...laid.gathers.map((e) => ({ ...e, walking: false }))];
  const ready = Promise.all(
    entries.map(async (e) => {
      // copy j is the j-th kind round
      const byKind = new Map();
      for (let j = 0; j < e.n; j++) {
        const k = e.kinds[j % e.kinds.length];
        if (!byKind.has(k)) byKind.set(k, []);
        byKind.get(k).push(j);
      }
      for (const [kind, copies] of byKind) {
        const s = await shapeOf(kind);
        if (!s) continue;
        const mat = R.own(toon(0xffffff, { map: s.map, gradientMap: lightRamp() }));
        if (!e.walking) breathing(mat, clock, s.h);
        const mesh = R.own(new THREE.InstancedMesh(s.geo, mat, copies.length));
        mesh.castShadow = false;
        mesh.receiveShadow = true;
        const x = laid.extents[e.key];
        if (x) mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(x.x, x.y, x.z), x.r);
        mesh.userData.crowd = e.key;
        const rec = { e, mesh, copies, loop: e.walking ? { ...loopLengths(e.loop) } : null, since: null, faced: undefined };
        records.push(rec);
        place(rec, last);
        R.add(mesh, { ink: false });
        kit.adopt?.(mesh);
      }
    }),
  );
  kit.track?.(ready);

  function place(rec, t) {
    const { e, mesh, copies } = rec;
    for (let i = 0; i < copies.length; i++) {
      const j = copies[i];
      if (e.walking) {
        walkerAt(e.loop, rec.loop.lengths, rec.loop.total, e.speed, t, (j + 0.5) / e.n, pose);
        v.set(pose.x, pose.bob, pose.z);
        eul.set(0, pose.yaw + Math.PI / 2, pose.sway);
      } else {
        // (a few stand close, as a group: as wide as there are people for, never wider than it's given)
        const g = e.row ? rowAt(e.at, Math.min(e.row, e.n * ROW_EACH), j, e.n, watch ?? e.face, 1.7) : gatherAt(e.at, Math.min(e.r, DISC_EACH * Math.sqrt(e.n) + 0.6), j, e.n, watch ?? e.face, 1.7);
        v.set(g.x, (e.y ?? 0) + hopOf(t, rec.since, j), g.z);
        eul.set(0, g.yaw + Math.PI / 2, 0);
      }
      mesh.setMatrixAt(i, m4.compose(v, q.setFromEuler(eul), one));
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  R.tick((t, dt, state) => {
    last = t;
    clock.value = t;
    for (const rec of records) {
      rec.mesh.visible = isOn(rec.e, state, shown);
      if (!rec.mesh.visible) continue;
      if (rec.e.walking) {
        place(rec, t);
        continue;
      }
      // a gathering moves only to hop, or to turn
      // (on its own beat, if it keeps one; or when it's asked)
      if (rec.e.beat) rec.since = Math.floor(t / rec.e.beat) * rec.e.beat;
      else if (hopAt != null && rec.since !== hopAt) rec.since = hopAt;
      const hopping = rec.since != null && t - rec.since < HOPS;
      if (hopping || rec.faced !== watch || rec.settle) {
        place(rec, t);
        rec.faced = watch;
        rec.settle = hopping;
      }
    }
  });

  return {
    ready,
    hop: () => (hopAt = last),
    turn: (to) => (watch = to),
    show: (key, on) => shown.set(key, on),
    // how many of each walker and gathering stand (for the checks)
    counts: () => records.reduce((o, r) => ({ ...o, [r.e.key]: (o[r.e.key] ?? 0) + r.mesh.count }), {}),
  };
}

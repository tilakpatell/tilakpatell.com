// The game's additive clips laid over a figure's pose (walrusSets/
// additive.js): each a delta on the bones it moves, post-multiplied onto
// the pose the mixer and the animator's layers left (as three.js's own
// additive blending does), `w` of the way from nothing. Laid by hand rather
// than as mixer actions, so the mixer's weights still sum to exactly 1 (an
// additive action under three's mixer counts toward nothing and a figure
// with none of these clips is never touched: Review Focus 2). Laying is
// idempotent: a bone nobody has set since keeps the pose it was laid over,
// so laying twice in a frame (or on a frame the animator held) adds once.
//
// createAdditiveLayer(model, clips: { name: AnimationClip }) → { (the
//   additive pack's names, `add.aim.up`, `add.hit.left`…; any other clip is passed by)
//   has(name), aim(pitch, yaw, prefix = '') (the four aims' weights,
//   additive.js's additiveFor; `prefix` a stance's own, 'p.' or 'l.', where
//   it has them), hit(side, kind = '') → whether it has that side's (played
//   once through, on top), apply(dt) (after the layers, each frame), clear() }

import * as THREE from 'three';
import { additiveFor } from './walrusSets/additive';

const IDENTITY = new THREE.Quaternion();
const AIMS = ['up', 'down', 'left', 'right'];
const FADE = 0.12; // s a hit fades in and out over

export function createAdditiveLayer(model, clips = {}) {
  const byName = new Map();
  model.traverse((o) => o.name && !byName.has(o.name) && byName.set(o.name, o));
  // each clip's tracks as { bone, path, interp } for this body
  const parts = new Map();
  for (const [name, clip] of Object.entries(clips ?? {})) {
    if (!clip?.tracks || !name.startsWith('add.')) continue;
    const list = [];
    for (const t of clip.tracks) {
      const i = t.name.lastIndexOf('.');
      const bone = byName.get(t.name.slice(0, i));
      const path = t.name.slice(i + 1);
      if (bone && (path === 'quaternion' || path === 'position')) list.push({ bone, path, interp: t.createInterpolant() });
    }
    if (list.length) parts.set(name, { clip, list });
  }
  const st = { aim: { up: 0, down: 0, left: 0, right: 0 }, prefix: '', hits: [] };
  const laid = new Map(); // bone → { q, p (the pose it was laid over), wq, wp (what was written) }
  const q = new THREE.Quaternion();
  const d = new THREE.Quaternion(); // (the delta; q its share)
  const v = new THREE.Vector3();
  const entryOf = (bone) => {
    let e = laid.get(bone);
    if (!e) laid.set(bone, (e = { q: new THREE.Quaternion(), p: new THREE.Vector3(), wq: null, wp: null }));
    return e;
  };
  // the clip's delta at time t, `w` of it, onto the bones
  const layOn = (name, t, w) => {
    const pt = parts.get(name);
    if (!pt || w <= 1e-4) return;
    for (const { bone, path, interp } of pt.list) {
      const r = interp.evaluate(Math.min(t, pt.clip.duration));
      if (path === 'quaternion') {
        d.fromArray(r).normalize();
        bone.quaternion.multiply(w < 1 ? q.slerpQuaternions(IDENTITY, d, w) : d);
      } else bone.position.add(v.fromArray(r).multiplyScalar(w));
    }
  };
  const aimName = (dir) => (st.prefix && parts.has(`add.aim.${st.prefix}${dir}`) ? `add.aim.${st.prefix}${dir}` : `add.aim.${dir}`);

  return {
    has: (name) => parts.has(name),
    aim(pitch, yaw, prefix = '') {
      st.aim = additiveFor(pitch, yaw);
      st.prefix = prefix;
    },
    hit(side, kind = '') {
      const name = [kind && `add.hit.${kind}.${side}`, `add.hit.${side}`].find((n) => n && parts.has(n));
      if (!name) return false;
      st.hits = st.hits.filter((h) => h.name !== name);
      st.hits.push({ name, t: 0 });
      return true;
    },
    apply(dt = 0) {
      // (the pose to lay over: as it was, where nobody's set the bone since)
      for (const [bone, e] of laid) {
        if (e.wq && bone.quaternion.equals(e.wq)) bone.quaternion.copy(e.q);
        if (e.wp && bone.position.equals(e.wp)) bone.position.copy(e.p);
      }
      for (const h of st.hits) h.t += dt;
      st.hits = st.hits.filter((h) => h.t < (parts.get(h.name)?.clip.duration ?? 0));
      const any = AIMS.some((k) => st.aim[k] > 1e-4) || st.hits.length;
      // (the bones it will touch, their pose kept to lay over again)
      const touched = new Set();
      if (any) {
        for (const k of AIMS) if (st.aim[k] > 1e-4) parts.get(aimName(k))?.list.forEach((x) => touched.add(x.bone));
        for (const h of st.hits) parts.get(h.name)?.list.forEach((x) => touched.add(x.bone));
      }
      for (const bone of touched) {
        const e = entryOf(bone);
        e.q.copy(bone.quaternion);
        e.p.copy(bone.position);
      }
      for (const k of AIMS) layOn(aimName(k), 0, st.aim[k]);
      for (const h of st.hits) {
        const d = parts.get(h.name).clip.duration;
        const w = Math.min(1, h.t / FADE, (d - h.t) / FADE);
        layOn(h.name, h.t, w);
      }
      for (const [bone, e] of laid) {
        if (!touched.has(bone)) {
          e.wq = e.wp = null;
          continue;
        }
        (e.wq ??= new THREE.Quaternion()).copy(bone.quaternion);
        (e.wp ??= new THREE.Vector3()).copy(bone.position);
      }
    },
    clear() {
      st.aim = { up: 0, down: 0, left: 0, right: 0 };
      st.hits = [];
    },
  };
}

// The fallen as the game's ragdoll: a soldier shot down plays its death
// clip's first LEAD seconds, then its figure is handed to the game's fifteen
// bodies (lib/three/ragdoll2017.js on lane P2's ragdoll.json row), moving
// as the clip had them moving, with the bolt's ImpactImpulse (impulses.json,
// 50 N·s for every Hoth class weapon) at the bone it struck, on the level's
// ground. The ragdoll is the client's in the game too
// (WSEACharacterPhysicsComponentData.Realm), so it lives here, never in the
// sim. At most `max` fall at once (RAGDOLLS by tier) within `range` of the
// eye; past that a body keeps its clip. A settled body is frozen and costs
// nothing; it lies for the trooper's TimeForCorpse (death.json), sinks and is
// hidden, and no more than `corpses` lie at once (the oldest goes first).
// The figure is forgotten when the sim takes it away (drop).
//
//   createRagdolls({ book, rowId, floorAt, max, range, lead, impulses, lie, sink, deep, corpses })
//     → { fall(id, fig, { fall, vel, eye }) → bool, update(dt), has(id), handed(id),
//         settled(id), drop(id), count() → { active, settled, waiting }, lie, dispose() }
//   book: ragdoll.json, or a promise of it (no fall is taken until it comes);
//   fig: { model, mixer } (figures.js's); fall: the battle view's { part, dir, at, weapon };
//   vel: the entity's [x, z] m/s; eye: the camera's place ([x, y, z] or { x, y, z })

import * as THREE from 'three';
import impulseBook from '../../../data/bf2017/physics/impulses.json';
import deathBook from '../../../data/bf2017/physics/death.json';
import { isGameSkeleton } from '../../../lib/physics/boneCapsules.js';
import { floorCollide, ragdollOf, rig2017 } from '../../../lib/three/ragdoll2017.js';
import { admit, boneForHit, expired, impulseOf } from './fall.js';

// (hand values: src/data/bf2017/physics/NOTES.md)
export const RAGDOLLS = { high: 6, mid: 4, low: 2 }; // bodies falling at once, by the device's tier
export const RANGE = 60; // m from the eye a body may fall as a ragdoll
export const LEAD = 0.2; // s of the death clip before the ragdoll takes over
export const CORPSES = 24; // bodies lying at once, at most
export const SINK = 1.5; // s a corpse takes to sink once its time is up
export const DEEP = 0.4; // m it sinks before it is hidden
const ROW = 'stormtroopershared';

const _v = new THREE.Vector3();
const xyz = (p) => (Array.isArray(p) ? p : p ? [p.x, p.y, p.z] : null);

function bonesOf(model) {
  const bones = {};
  model.traverse((o) => {
    if (o.isBone && !bones[o.name]) bones[o.name] = o;
  });
  return bones;
}

export function createRagdolls({ book, rowId = ROW, floorAt = () => 0, max = RAGDOLLS.mid, range = RANGE, lead = LEAD, impulses = impulseBook, lie = deathBook.rows[deathBook.default]?.timeForCorpse ?? 10, sink = SINK, deep = DEEP, corpses = CORPSES } = {}) {
  let row = null;
  const take = (b) => {
    row = ragdollOf(b, rowId);
  };
  if (book && typeof book.then === 'function') book.then(take, () => {});
  else take(book);
  const collide = floorCollide(floorAt);
  const all = new Map(); // id → { fig, bones, names, since, prev, cur, sdt, fall, vel, rag, gone, born }
  let born = 0;

  const falling = () => {
    let n = 0;
    for (const r of all.values()) if (!r.gone && !(r.rag && r.rag.settled)) n++;
    return n;
  };

  // the body bones' places in the world now (their speed at the hand-off is the clip's)
  const sample = (r) => {
    const out = new Float64Array(r.names.length * 3);
    r.names.forEach((n, i) => {
      r.bones[n].getWorldPosition(_v);
      out[i * 3] = _v.x;
      out[i * 3 + 1] = _v.y;
      out[i * 3 + 2] = _v.z;
    });
    return out;
  };

  function handOff(r) {
    r.fig.mixer?.stopAllAction();
    const v = r.vel ? { x: r.vel[0] ?? 0, y: 0, z: r.vel[1] ?? 0 } : null;
    const rag = rig2017(r.bones, row, { collide, speed: 0, velocity: v });
    // moving as the clip moved it
    if (r.prev && r.cur && r.sdt > 0)
      r.names.forEach((n, j) => {
        const i = rag.indexOf(n);
        if (i < 0) return;
        const o = j * 3;
        rag.body.kick(i, { x: (r.cur[o] - r.prev[o]) / r.sdt, y: (r.cur[o + 1] - r.prev[o + 1]) / r.sdt, z: (r.cur[o + 2] - r.prev[o + 2]) / r.sdt });
      });
    // and the bolt, at the bone it struck
    const dir = r.fall?.dir;
    if (dir) {
      const { impulse } = impulseOf(r.fall.weapon, impulses);
      const bone = boneForHit(r.fall.part, r.fall.at, (n) => rag.point(n));
      if (impulse > 0) rag.kickAt(bone, [dir[0] * impulse, dir[1] * impulse, dir[2] * impulse]);
    }
    r.rag = rag;
    r.prev = r.cur = null;
  }

  function hide(r) {
    r.gone = true;
    r.rag = null;
    r.fig.model.visible = false;
  }

  return {
    lie,
    fall(id, fig, { fall = null, vel = null, eye = null } = {}) {
      if (!row || !fig?.model || all.has(id)) return false;
      const bones = bonesOf(fig.model);
      if (!isGameSkeleton(bones) || !bones.Hips) return false;
      const e = xyz(eye);
      const at = fig.model.getWorldPosition(_v);
      const dist = e ? Math.hypot(at.x - e[0], at.y - e[1], at.z - e[2]) : 0;
      if (!admit({ active: falling(), dist, max, range })) return false;
      const names = row.bodies.map((b) => b.bone).filter((n) => bones[n]);
      const fallCopy = fall && { part: fall.part ?? null, dir: fall.dir ? fall.dir.slice() : null, at: fall.at ? fall.at.slice() : null, weapon: fall.weapon ?? null };
      all.set(id, { fig, bones, names, since: 0, prev: null, cur: null, sdt: 0, fall: fallCopy, vel: vel ? vel.slice() : null, rag: null, gone: false, born: born++ });
      return true;
    },
    update(dt) {
      if (!(dt > 0)) return;
      for (const r of all.values()) {
        if (r.gone) continue;
        r.since += dt;
        if (!r.rag) {
          r.prev = r.cur;
          r.cur = sample(r);
          r.sdt = dt;
          if (r.since >= lead - 1e-9) handOff(r);
          // (the hit lands on the first step)
          if (r.rag && lead <= 0) r.rag.step(dt);
          continue;
        }
        const when = expired({ since: r.since, lie, sink });
        if (when === 'gone') {
          hide(r);
          continue;
        }
        if (when === 'sink') {
          r.rag.body.settled = true;
          r.fig.model.position.y -= (deep / sink) * dt;
          continue;
        }
        r.rag.step(dt);
      }
      // the corpse cap: the oldest settled bodies hidden first
      const lying = [...all.values()].filter((r) => !r.gone && r.rag?.settled).sort((a, b) => a.born - b.born);
      for (let i = 0; i < lying.length - corpses; i++) hide(lying[i]);
    },
    has: (id) => all.has(id),
    handed: (id) => {
      const r = all.get(id);
      return Boolean(r && (r.rag || r.gone));
    },
    settled: (id) => Boolean(all.get(id)?.rag?.settled),
    drop(id) {
      all.delete(id);
    },
    count() {
      let active = 0;
      let settled = 0;
      let waiting = 0;
      for (const r of all.values()) {
        if (r.gone) continue;
        if (!r.rag) waiting++;
        else if (r.rag.settled) settled++;
        else active++;
      }
      return { active, settled, waiting };
    },
    dispose() {
      all.clear();
    },
  };
}

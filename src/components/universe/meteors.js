// A meteor stream (director.js): a couple of dozen rocks cross your path
// ahead of you, at your height, on a straight run from far out on one side
// to far out on the other (lanes.js's meteorLane). Each is a target the
// guns can lock on to and a bolt can pop; one that reaches the ship hits
// it (the scene takes it off the shields). The rocks are the belt's
// (belt.js's rock shapes), one instanced draw, tumbling as they go.
//
// stormPlan(lane, rand, n) → [{ at, vel, size }] is pure (tested): where
// each rock starts and how it goes.
// createMeteors(parent, { small, tier }) → { storm(ship, rand) → boolean,
//   update(dt, ship) → events, hit(from, to) → { at, size } | null, targets,
//   count, clear(), dispose() }
// Events: { type: 'meteor', damage }. Points are in `parent`'s space.

import * as THREE from 'three';
import { meteorLane } from './lanes';
import { rock } from './belt';
import { rockHook } from '../../lib/three/rock';

const METEOR = { count: 24, speed: [12, 16], size: [0.25, 0.7], spread: 40, across: 4, up: 3, damage: 8, life: 30 };
const SHIP_R = 0.3; // how close a rock must come to the ship's way to hit it, plus its size
const BOLT_R = 0.12; // and a bolt to a rock, plus the rock's size

// n rocks along the lane's first `spread` units from its start, scattered a
// little across and up, none on top of another, each moving the lane's way
export function stormPlan([from, to], rand, n = METEOR.count) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const dz = to[2] - from[2];
  const len = Math.hypot(dx, dy, dz) || 1;
  const dir = [dx / len, dy / len, dz / len];
  const across = [-dir[2], 0, dir[0]];
  const rocks = [];
  for (let i = 0; i < n; i++) {
    const size = METEOR.size[0] + rand() * (METEOR.size[1] - METEOR.size[0]);
    let at = null;
    for (let tries = 0; tries < 30 && !at; tries++) {
      const along = rand() * METEOR.spread;
      const side = (rand() * 2 - 1) * METEOR.across;
      const up = (rand() * 2 - 1) * METEOR.up;
      const p = [from[0] + dir[0] * along + across[0] * side, from[1] + dir[1] * along + up, from[2] + dir[2] * along + across[2] * side];
      if (rocks.every((r) => Math.hypot(r.at[0] - p[0], r.at[1] - p[1], r.at[2] - p[2]) > r.size + size + 0.2)) at = p;
    }
    if (!at) continue;
    const speed = METEOR.speed[0] + rand() * (METEOR.speed[1] - METEOR.speed[0]);
    rocks.push({ at, vel: [dir[0] * speed, dir[1] * speed, dir[2] * speed], size });
  }
  return rocks;
}

// how close a segment from a to b passes the point c, at the nearest
const segmentDistance = (a, b, c) => {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const abz = b.z - a.z;
  const l2 = abx * abx + aby * aby + abz * abz;
  const t = l2 > 1e-9 ? Math.min(1, Math.max(0, ((c.x - a.x) * abx + (c.y - a.y) * aby + (c.z - a.z) * abz) / l2)) : 0;
  return Math.hypot(a.x + abx * t - c.x, a.y + aby * t - c.y, a.z + abz * t - c.z);
};

export function createMeteors(parent, { small = false, tier = 'high' } = {}) {
  const MAX = small ? 16 : METEOR.count;
  const geo = rock(4242);
  // (stone, pitted on high and mid: lib/three/rock)
  const mat = rockHook(new THREE.MeshStandardMaterial({ color: '#8a7f72', roughness: 0.95, metalness: 0.04, flatShading: true }), { tier });
  const mesh = new THREE.InstancedMesh(geo, mat, MAX);
  mesh.count = 0;
  mesh.frustumCulled = false;
  mesh.name = 'meteors';
  parent.add(mesh);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const sc = new THREE.Vector3();
  const live = []; // { id, at: Vector3, vel: Vector3, size, spin: [x, y, z], age, hp, hpMax, kind, faction, threat }
  let made = 0;
  let clock = 0;
  const targets = [];
  const was = new THREE.Vector3(); // the ship a frame ago (a rock is tested against its whole way since: no tunnelling)
  const now = new THREE.Vector3();
  let seen = false;

  const draw = () => {
    mesh.count = live.length;
    live.forEach((r, i) => {
      q.setFromEuler(e.set(r.spin[0] * clock, r.spin[1] * clock, r.spin[2] * clock));
      sc.setScalar(r.size);
      mesh.setMatrixAt(i, m.compose(r.at, q, sc));
    });
    mesh.instanceMatrix.needsUpdate = true;
  };
  const drop = (r) => {
    const i = live.indexOf(r);
    if (i >= 0) live.splice(i, 1);
  };

  return {
    // a stream across the ship's path, if there's room for one
    storm(ship, rand = Math.random) {
      const lane = meteorLane(ship, rand);
      if (!lane) return false;
      for (const r of stormPlan(lane, rand, MAX)) {
        if (live.length >= MAX) break;
        made += 1;
        live.push({ id: `meteor-${made}`, at: new THREE.Vector3(...r.at), vel: new THREE.Vector3(...r.vel), size: r.size, spin: [rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1], age: 0, hp: 1, hpMax: 1, kind: 'meteor', faction: 'rocks', threat: 0 });
      }
      draw();
      return live.length > 0;
    },

    update(dt, ship) {
      const events = [];
      if (ship) {
        now.set(ship.x, ship.y, ship.z);
        if (!seen) was.copy(now);
        seen = true;
      } else seen = false;
      if (!live.length) return events;
      clock += dt;
      for (const r of [...live]) {
        r.age += dt;
        r.at.addScaledVector(r.vel, dt);
        if (r.age > METEOR.life) {
          drop(r);
          continue;
        }
        if (ship && segmentDistance(was, now, r.at) < SHIP_R + r.size) {
          drop(r);
          events.push({ type: 'meteor', damage: METEOR.damage, at: r.at.clone(), size: r.size });
        }
      }
      if (ship) was.copy(now);
      draw();
      return events;
    },

    // a bolt from `from` to `to` (Vector3s) into a rock: pops it
    hit(from, to) {
      for (const r of live) {
        if (segmentDistance(from, to, r.at) < BOLT_R + r.size) {
          drop(r);
          draw();
          return { at: r.at.clone(), size: r.size };
        }
      }
      return null;
    },

    // the rocks still coming, for the guns (targeting.js)
    get targets() {
      targets.length = 0;
      for (const r of live) targets.push(r);
      return targets;
    },
    get count() {
      return live.length;
    },

    clear() {
      live.length = 0;
      draw();
    },

    dispose() {
      mesh.removeFromParent();
      mesh.dispose();
      geo.dispose();
      mat.dispose();
    },
  };
}

// The minefield's mines, drawn (minefield.js has the rules): dark spiked
// balls, one instanced draw, each with a red light on top that blinks,
// quicker the nearer you are (a second instanced draw, bright enough to
// bloom). Each is a target the guns can lock on to and a bolt can set off;
// a ship that comes close sets one off; one going off sets off its
// neighbours. The scene plays each blast (and takes what reaches the ship
// off its shields).
//
// createMines(parent, { small, tier }) → { lay(ship, rand) → boolean,
//   update(dt, ship) → events, hit(from, to) → { at, size } | null, targets,
//   count, clear(), dispose() }
// Events: { type: 'mine', at, size, damage } (damage: what reached the ship).
// Points are in `parent`'s space.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MINE, chainFrom, layMines, mineBlast, mineHit, minefieldLane } from './minefield';

const LIFE = 75; // seconds a field stays, unless you're long past it
const GONE = 260; // or once you're this far from it
const BOLT_R = 0.12;
const BLINK = { far: 1.1, near: 6, close: 14 }; // blinks a second, out of range and right by it; and from how far it quickens

// a mine, a unit across: a ball with twelve spikes (an icosahedron's corners)
function mineGeometry() {
  const parts = [new THREE.IcosahedronGeometry(0.5, 2)];
  const corners = new THREE.IcosahedronGeometry(1, 0).getAttribute('position');
  const seen = [];
  const up = new THREE.Vector3(0, 1, 0);
  const d = new THREE.Vector3();
  for (let i = 0; i < corners.count; i++) {
    d.fromBufferAttribute(corners, i).normalize();
    if (seen.some((v) => v.distanceToSquared(d) < 1e-4)) continue;
    seen.push(d.clone());
    const spike = new THREE.CylinderGeometry(0.02, 0.07, 0.36, 6);
    spike.translate(0, 0.62, 0);
    spike.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, d));
    parts.push(spike);
  }
  // (the ball, an icosahedron with detail, comes without an index: only the
  // spikes are un-indexed, so they merge with it)
  const merged = mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)));
  for (const g of parts) g.dispose();
  merged.computeVertexNormals();
  return merged;
}

export function createMines(parent, { small = false } = {}) {
  const MAX = MINE.n;
  const geo = mineGeometry();
  const mat = new THREE.MeshStandardMaterial({ color: '#2a2c31', roughness: 0.42, metalness: 0.75, flatShading: true });
  const mesh = new THREE.InstancedMesh(geo, mat, MAX);
  const lampGeo = new THREE.SphereGeometry(1, small ? 6 : 10, small ? 4 : 8);
  const lampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 0.35, 0.2), toneMapped: false });
  const lamps = new THREE.InstancedMesh(lampGeo, lampMat, MAX);
  for (const m of [mesh, lamps]) {
    m.count = 0;
    m.frustumCulled = false;
    parent.add(m);
  }
  mesh.name = 'mines';
  lamps.name = 'mine lamps';
  for (let i = 0; i < MAX; i++) lamps.setColorAt(i, new THREE.Color(1, 1, 1));

  const live = []; // { id, at: Vector3, vel: Vector3, size, spin, phase, hp, hpMax, kind, faction, threat, gone }
  const blasts = []; // set off this frame, for update to play and weigh against the ship
  let made = 0;
  let age = 0;
  let clock = 0;
  const middle = new THREE.Vector3();
  const targets = [];
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const sc = new THREE.Vector3();
  const top = new THREE.Vector3();
  const lit = new THREE.Color();
  let shipAt = null;

  const draw = () => {
    mesh.count = live.length;
    lamps.count = live.length;
    live.forEach((r, i) => {
      q.setFromEuler(e.set(r.spin[0] * clock, r.spin[1] * clock + r.phase, r.spin[2] * clock));
      sc.setScalar(r.size * 2);
      mesh.setMatrixAt(i, m4.compose(r.at, q, sc));
      // (its lamp on its top, blinking: quicker the nearer you are)
      top.set(0, r.size * 1.02, 0).applyQuaternion(q).add(r.at);
      const d = shipAt ? shipAt.distanceTo(r.at) : Infinity;
      const rate = d >= BLINK.close ? BLINK.far : BLINK.near - ((BLINK.near - BLINK.far) * d) / BLINK.close;
      const on = Math.sin((clock * rate + r.phase) * Math.PI * 2) > 0.2 ? 1 : 0.12;
      sc.setScalar(r.size * 0.3);
      lamps.setMatrixAt(i, m4.compose(top, q, sc));
      lamps.setColorAt(i, lit.setScalar(on));
    });
    mesh.instanceMatrix.needsUpdate = true;
    lamps.instanceMatrix.needsUpdate = true;
    if (lamps.instanceColor) lamps.instanceColor.needsUpdate = true;
  };
  // mine i goes off, and every one it sets off
  const setOff = (i) => {
    const list = live.map((r) => ({ at: [r.at.x, r.at.y, r.at.z], r: r.size, gone: r.gone }));
    for (const j of chainFrom(list, i)) {
      live[j].gone = true;
      blasts.push({ at: live[j].at.clone(), size: live[j].size });
    }
    for (let k = live.length - 1; k >= 0; k--) if (live[k].gone) live.splice(k, 1);
  };

  // the mines laid, live, and drawn
  let gone = GONE; // how far from the field it's let go
  const place = (list, rand, far = GONE) => {
    gone = far;
    live.length = 0;
    middle.set(0, 0, 0);
    for (const m of list) {
      made += 1;
      live.push({ id: `mine-${made}`, at: new THREE.Vector3(...m.at), vel: new THREE.Vector3(), size: m.r, spin: [rand() * 0.6 - 0.3, rand() * 0.8 - 0.4, rand() * 0.6 - 0.3], phase: rand(), hp: 1, hpMax: 1, kind: 'mine', faction: 'mines', threat: 0, gone: false });
      middle.add(live[live.length - 1].at);
    }
    if (live.length) middle.divideScalar(live.length);
    age = 0;
    draw();
    return live.length > 0;
  };

  return {
    // a field across the ship's way ahead, if there's room for one
    lay(ship, rand = Math.random) {
      const lane = minefieldLane(ship, rand);
      if (!lane) return false;
      return place(layMines({ lane, seed: Math.floor(rand() * 1e9) }), rand);
    },

    update(dt, ship) {
      const events = [];
      shipAt = ship ? (shipAt ?? new THREE.Vector3()).set(ship.x, ship.y, ship.z) : null;
      if (!live.length && !blasts.length) return events;
      clock += dt;
      age += dt;
      if (ship && live.length) {
        const hits = mineHit(
          ship,
          live.map((r) => ({ at: [r.at.x, r.at.y, r.at.z], r: r.size })),
          dt,
        );
        if (hits.length) setOff(hits[0]);
      }
      for (const b of blasts.splice(0)) events.push({ type: 'mine', at: b.at, size: b.size, damage: shipAt ? mineBlast(Math.max(0, shipAt.distanceTo(b.at) - b.size)) : 0 });
      // (gone in time, or once you're long past it)
      if (age > LIFE || (shipAt && shipAt.distanceTo(middle) > gone + Math.abs(ship.speed || 0) * MINE.lead)) live.length = 0;
      draw();
      return events;
    },

    // a bolt from `from` to `to` (Vector3s) into a mine: sets it off (and
    // its neighbours; update plays the blasts)
    hit(from, to) {
      const seg = new THREE.Line3(from, to);
      const near = new THREE.Vector3();
      for (let i = 0; i < live.length; i++) {
        const r = live[i];
        seg.closestPointToPoint(r.at, true, near);
        if (near.distanceTo(r.at) < BOLT_R + r.size) {
          const at = r.at.clone();
          const size = r.size;
          setOff(i);
          draw();
          return { at, size };
        }
      }
      return null;
    },

    // the mines still there, for the guns (targeting.js)
    get targets() {
      targets.length = 0;
      for (const r of live) targets.push(r);
      return targets;
    },
    get count() {
      return live.length;
    },
    // where the field is (for checking)
    get middle() {
      return live.length ? middle.clone() : null;
    },

    clear() {
      live.length = 0;
      blasts.length = 0;
      draw();
    },

    dispose() {
      for (const m of [mesh, lamps]) {
        m.removeFromParent();
        m.dispose();
      }
      geo.dispose();
      mat.dispose();
      lampGeo.dispose();
      lampMat.dispose();
    },
  };
}

// The doors that open (plan.js’s DOORS): the great doors, the courtyard’s
// door to the Grand Staircase, the viaduct’s and the covered bridge’s gates,
// the boathouse, the Owlery, the greenhouse. Each is an arched opening in
// pale stone, dark inside, and its oak leaves (one or two, iron-strapped) on
// their hinges. Stand at one and the prompt names it, key first (“E Go in ·
// The Great Hall”); press E and a room’s door swings open and you go
// through (rooms/index.js), a gate swings open or shut where it stands, and
// a door whose room no one has built yet rattles on its bolt and says so,
// in character: “Locked. Not today.”
//
// Every leaf of every door is one instance of one leaf (a single draw); the
// openings are two (stone, dark); so the doors cost three draws in all.
//
//   createDoors({ materials, ground, doors, hasRoom }) → {
//     group, step(dt, { at: [x, y, z], act }) → { prompt, enter, toast },
//     state(id) → 0…1 open, colliders() → the shut gates’ boxes, dispose() }
//   REACH: m from a door’s middle its prompt shows within
//   promptFor(door, { open, hasRoom }) → { key, verb, name } (pure)
//   nearestDoor(doors, x, z, y) → the door within REACH, nearest (pure)
//   LOCKED: what a locked door says

import * as THREE from 'three';
import { createMesh, archOutline } from './mesh';
import { TONES } from './materials';
import { DOORS } from './plan';
import { hasRoom as registered } from '../../rooms/index';

export const REACH = 3.6;
export const LOCKED = 'Locked. Not today.';
const SWING = 1.25; // radians a leaf opens
const SPEED = 1.6; // of the way a second

export function promptFor(door, { open = 0, hasRoom = registered } = {}) {
  if (door.kind === 'room') return { key: 'E', verb: 'Go in', name: door.name, locked: !hasRoom(door.room) };
  // (a gate is opened and shut where it stands; one you go through to be inside says so while it’s shut)
  return { key: 'E', verb: open > 0.5 ? 'Close' : (door.shut ?? 'Open'), name: door.name, locked: false };
}

export function nearestDoor(doors, x, z, y = null) {
  let best = null;
  let bestD = REACH;
  for (const d of doors) {
    const dy = y == null || d.y == null ? 0 : Math.abs(y - d.y);
    if (dy > 3) continue;
    // (in front of it: a door is gone through from outside)
    const fx = Math.sin(d.faces);
    const fz = Math.cos(d.faces);
    const ahead = (x - d.at[0]) * fx + (z - d.at[1]) * fz;
    if (ahead < -0.5) continue;
    const dist = Math.hypot(x - d.at[0], z - d.at[1]);
    if (dist < bestD) {
      best = d;
      bestD = dist;
    }
  }
  return best;
}

export function createDoors({ materials, ground, doors = DOORS, hasRoom = registered } = {}) {
  const group = new THREE.Group();
  group.name = 'castle:doors';
  const yOf = (d) => d.y ?? ground(d.at[0], d.at[1]);
  // the openings: a pale arch round each, dark inside (an interior, as far as the eye knows)
  const mesh = createMesh();
  for (const d of doors) {
    const y = yOf(d);
    const fx = Math.sin(d.faces);
    const fz = Math.cos(d.faces);
    mesh.tone(TONES.pale);
    mesh.shape('ashlar', { at: [d.at[0] - fx * 0.05, y, d.at[1] - fz * 0.05], turn: d.faces, outline: archOutline(d.w + 1.1, d.h + 0.7, { pointed: true, segs: 4 }) });
    mesh.tone([0.008, 0.007, 0.006]);
    mesh.shape('iron', { at: [d.at[0] - fx * 0.02, y, d.at[1] - fz * 0.02], turn: d.faces, outline: archOutline(d.w, d.h, { pointed: true, segs: 4 }) });
  }
  const geos = mesh.geometries();
  for (const [name, g] of Object.entries(geos)) {
    const m = new THREE.Mesh(g, materials[name]);
    m.name = `doors:${name}`;
    m.receiveShadow = true;
    group.add(m);
  }

  // the leaves: one oak leaf with its iron straps, a unit square, instanced at each door’s size
  const leafMesh = createMesh();
  leafMesh.tone(TONES.oak);
  leafMesh.box('timber', { at: [0.5, 0, 0], size: [1, 1, 1] });
  leafMesh.tone(TONES.iron);
  for (const v of [0.18, 0.5, 0.82]) leafMesh.box('timber', { at: [0.42, v - 0.025, 0.52], size: [0.8, 0.05, 0.08] });
  const leafGeo = leafMesh.geometries().timber;
  const leaves = [];
  for (const d of doors)
    for (let i = 0; i < d.leaves; i++) {
      // each hinged at its own side of the opening, its free edge to the middle
      // when shut; turned inward, away from you, as it opens
      const side = d.leaves === 1 ? -1 : i === 0 ? -1 : 1;
      const fx = Math.sin(d.faces);
      const fz = Math.cos(d.faces);
      const rx = -fz;
      const rz = fx;
      const shut = Math.atan2(side * rz, -side * rx); // (a leaf’s +x, turned by θ about y, is (cos θ, −sin θ))
      const inward = (t) => -(Math.cos(t) * fx - Math.sin(t) * fz);
      const sign = inward(shut + Math.PI / 2) > 0 ? 1 : -1;
      leaves.push({ door: d, w: d.leaves === 1 ? d.w : d.w / 2, hinge: [d.at[0] + rx * side * (d.w / 2) + fx * 0.12, d.at[1] + rz * side * (d.w / 2) + fz * 0.12], shut, sign });
    }
  const inst = new THREE.InstancedMesh(leafGeo, materials.timber, leaves.length);
  inst.name = 'doors:leaves';
  inst.castShadow = true;
  inst.receiveShadow = true;
  group.add(inst);

  const open = new Map(doors.map((d) => [d.id, 0]));
  const target = new Map(doors.map((d) => [d.id, 0]));
  const rattle = new Map();
  let pending = null; // { door, room } going through once it has swung
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const place = () => {
    leaves.forEach((l, k) => {
      const d = l.door;
      // (the leaf’s height: the arch’s spring line, a little under its point)
      const h = d.h * 0.86;
      const r = rattle.get(d.id) ?? 0;
      const a = open.get(d.id) * SWING + (r > 0 ? Math.sin(r * 60) * 0.02 : 0);
      p.set(l.hinge[0], yOf(d), l.hinge[1]);
      q.setFromAxisAngle(up, l.shut + l.sign * a);
      s.set(l.w, h, 0.18);
      m4.compose(p, q, s);
      inst.setMatrixAt(k, m4);
    });
    inst.instanceMatrix.needsUpdate = true;
    inst.computeBoundingSphere();
  };
  place();

  return {
    group,
    state: (id) => open.get(id) ?? 0,
    step(dt, { at = null, act = false } = {}) {
      let moved = false;
      for (const d of doors) {
        const o = open.get(d.id);
        const t = target.get(d.id);
        if (o !== t) {
          open.set(d.id, t > o ? Math.min(t, o + dt * SPEED) : Math.max(t, o - dt * SPEED));
          moved = true;
        }
        const r = rattle.get(d.id);
        if (r > 0) {
          rattle.set(d.id, Math.max(0, r - dt));
          moved = true;
        }
      }
      if (moved) place();
      const out = { prompt: null, enter: null, toast: null };
      // through a door that has swung open
      if (pending && open.get(pending.door.id) >= 0.95) {
        out.enter = { room: pending.door.room, from: pending.door.id };
        target.set(pending.door.id, 0);
        pending = null;
      }
      if (!at) return out;
      const d = nearestDoor(doors, at[0], at[2], at[1]);
      if (!d) return out;
      out.prompt = promptFor(d, { open: open.get(d.id), hasRoom });
      if (!act) return out;
      if (d.kind === 'room') {
        if (hasRoom(d.room)) {
          target.set(d.id, 1);
          pending = { door: d };
        } else {
          rattle.set(d.id, 0.45);
          out.toast = LOCKED;
        }
      } else target.set(d.id, target.get(d.id) > 0.5 ? 0 : 1);
      return out;
    },
    // a shut gate stands in the way; an open one doesn’t
    colliders() {
      return doors
        .filter((d) => d.kind === 'gate' && (open.get(d.id) ?? 0) < 0.6)
        .map((d) => ({ id: d.id, kind: 'box', at: d.at, w: d.w, d: 0.6, turn: d.faces + Math.PI / 2 }));
    },
    dispose() {
      for (const g of Object.values(geos)) g.dispose();
      leafGeo.dispose();
      inst.dispose?.();
    },
  };
}

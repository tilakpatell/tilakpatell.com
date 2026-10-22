// The house ghosts (the design’s §4.10): Nearly Headless Nick, the Fat
// Friar, the Grey Lady and the Bloody Baron, each one of the cast’s figures
// (Lane B’s, stood in until then) worn in a material of their own: pale
// blue-white, lit from inside at the edges, the room seen through them,
// added to what is behind rather than covering it. They drift, never quite
// on the floor, round a slow loop of their room, and say their line once
// when you come near (rules/lines.js).
//
//   GHOSTS: { house: ghost name }
//   ghostMaterial(source) → a node material for one of a figure’s meshes (its colour map kept, faint)
//   createGhost(name, { rt, path: [[x, z]…], y, speed, seed }) → { group, ready, step(dt, at) → line | null, dispose() }
//     at: where you are, [x, z] in the room; the line is { who, name, text }, once a visit

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { cameraPosition, dot, float, normalWorld, normalize, positionWorld, pow, sin, time, vec3 } from 'three/tsl';
import { figure } from './figures';
import { LINES, NAMES } from '../rules/lines';

export const GHOSTS = { gryffindor: 'nick', slytherin: 'baron', ravenclaw: 'greylady', hufflepuff: 'friar' };
const TINT = { nick: [0.78, 0.9, 1.0], baron: [0.7, 0.78, 0.95], greylady: [0.85, 0.88, 0.95], friar: [0.86, 0.95, 1.0] };
const NEAR = 3.2; // m: close enough for a ghost to speak

export function ghostMaterial(tint = [0.8, 0.9, 1]) {
  const m = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  m.userData.noHouse = true;
  // (the edges bright where the eye grazes them, the middle faint: a ghost is mostly outline)
  const view = normalize(cameraPosition.sub(positionWorld));
  const rim = pow(float(1).sub(dot(normalize(normalWorld), view).abs()), 2.2);
  const shimmer = sin(time.mul(1.7).add(positionWorld.y.mul(3))).mul(0.06).add(0.94);
  m.colorNode = vec3(...tint).mul(rim.mul(0.85).add(0.12)).mul(shimmer);
  return m;
}

export function createGhost(name, { rt = null, path = [[0, 0]], y = 0.15, speed = 0.35, seed = 1 } = {}) {
  const mats = [];
  const fig = figure(name, {
    rt,
    seed,
    ink: false,
    material: () => {
      const m = ghostMaterial(TINT[name]);
      mats.push(m);
      return m;
    },
  });
  fig.set({ base: 'idle', speed: 0 });
  const group = new THREE.Group();
  group.name = `ghost:${name}`;
  group.add(fig.group);
  // the loop round the room: its legs’ lengths, walked at a drift
  const legs = path.map((p, i) => {
    const q = path[(i + 1) % path.length];
    return { p, q, len: Math.hypot(q[0] - p[0], q[1] - p[1]) || 1 };
  });
  const total = legs.reduce((a, l) => a + l.len, 0);
  let s = (seed * 7.3) % total;
  let t = 0;
  let spoke = false;
  const where = (d) => {
    let left = ((d % total) + total) % total;
    for (const l of legs) {
      if (left <= l.len) {
        const k = left / l.len;
        return { x: l.p[0] + (l.q[0] - l.p[0]) * k, z: l.p[1] + (l.q[1] - l.p[1]) * k, yaw: Math.atan2(l.q[0] - l.p[0], l.q[1] - l.p[1]) };
      }
      left -= l.len;
    }
    return { x: path[0][0], z: path[0][1], yaw: 0 };
  };
  return {
    group,
    ready: fig.ready,
    step(dt, at = null) {
      t += dt;
      // (a ghost stops to look at you while you’re near it)
      const here = where(s);
      const near = at && Math.hypot(at[0] - here.x, at[1] - here.z) < NEAR;
      if (!near) s += speed * dt;
      const p = where(s);
      group.position.set(p.x, y + Math.sin(t * 0.9 + seed) * 0.08, p.z);
      group.rotation.y = near ? Math.atan2(at[0] - p.x, at[1] - p.z) : p.yaw;
      fig.set({ speed: near ? 0 : speed });
      fig.tick(dt);
      if (near && !spoke) {
        spoke = true;
        const text = LINES[name]?.hello;
        return text ? { who: name, name: NAMES[name] ?? name, text } : null;
      }
      return null;
    },
    dispose() {
      fig.dispose();
      for (const m of mats) m.dispose();
      group.removeFromParent();
    },
  };
}

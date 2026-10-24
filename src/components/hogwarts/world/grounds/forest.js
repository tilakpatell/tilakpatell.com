// The Forbidden Forest’s edge (the design’s §4.3): the pines close and dark
// past the paddock (world/scatter.js plants them), and here what the edge
// keeps: lanterns on their posts down the path the Care of Magical
// Creatures class takes, lit from dusk; the clearing at the path’s end, a
// fallen trunk and mossy stones in it; the fog that thickens as you go in
// off the path and, past FAR metres in, closes altogether and turns you
// round, Hagrid’s voice from somewhere behind you; and far in, through the
// trees, two centaurs passing, dark shapes in the murk.
//
// Draws: the lanterns and the clearing (merged by material, two or three),
// the centaurs (one instanced draw, their legs walking in the shader).
//
//   FAR: m into the forest the fog turns you round; THICK: where it starts to close
//   HAGRID: what he calls after you
//   forestDepth(x, z) → metres into the forest from its edge (negative outside) (pure)
//   onPath(x, z) → whether you are on the lantern path or in its clearing (pure)
//   turnBack(x, z) → { to: [x, z], yaw }: where the fog turns you out to, facing out (pure)
//   createForest({ house, materials, ground, tier }) → { group, step(dt, { at }) → { fog, turn, say }, dispose() }

import * as THREE from 'three';
import { MeshLambertNodeMaterial } from 'three/webgpu';
import { attribute, positionLocal, sin, uniform, vec3 } from 'three/tsl';
import { archOutline, createMesh } from '../castle/mesh';
import { TONES } from '../castle/materials';
import { PATHS } from '../terrain';
import { placeById } from '../../rules/places';
import { seeded } from '../../../../lib/seeded';

export const FAR = 120;
export const THICK = 55;
export const HAGRID = '“Not that way. Not without me.”';
const PATH = PATHS.find((p) => p.id === 'forest').points;
const CLEARING = placeById('clearing');

// how far into the forest a point is: past its west edge (x −300) or its
// north edge (z −330, where it reaches that far east), whichever is deeper
export function forestDepth(x, z) {
  const west = -x - 300;
  const north = x < 160 ? -z - 330 - Math.max(0, x + 160) * 0.4 : -Infinity;
  return Math.max(west, north);
}

const toSegment = (x, z, [ax, az], [bx, bz]) => {
  const dx = bx - ax;
  const dz = bz - az;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(x - ax - dx * t, z - az - dz * t);
};
export function onPath(x, z) {
  if (Math.hypot(x - CLEARING.at[0], z - CLEARING.at[1]) < CLEARING.r + 14) return true;
  for (let i = 1; i < PATH.length; i++) if (toSegment(x, z, PATH[i - 1], PATH[i]) < 16) return true;
  return false;
}

// out the way you came: back toward the edge, a dozen metres short of where the fog closes
export function turnBack(x, z) {
  const west = -x - 300;
  const north = -z - 330;
  // (the edge you are deepest past is the one to go back over)
  const out = west >= north ? [1, 0] : [0, 1];
  const back = Math.max(0, forestDepth(x, z) - (FAR - 14));
  const to = [x + out[0] * back, z + out[1] * back];
  // (the walk’s yaw looks along (−sin, −cos): facing out of the forest)
  return { to, yaw: Math.atan2(-out[0], -out[1]) };
}

// a centaur, its own frame facing +x: a horse’s body and legs, a man’s
// back and shoulders and head rising from its chest, a bow in one hand.
// Each leg’s vertices carry their phase (aLeg: ±1 for the diagonal pairs,
// 0 for the rest), so the walk is the shader’s
function centaurGeometry() {
  const parts = [];
  const add = (g, leg = 0) => {
    const n = g.attributes.position.count;
    g.setAttribute('aLeg', new THREE.Float32BufferAttribute(new Float32Array(n).fill(leg), 1));
    parts.push(g.index ? g.toNonIndexed() : g);
  };
  add(new THREE.SphereGeometry(1, 14, 10).scale(1.25, 0.62, 0.55).translate(0, 1.55, 0));
  for (const [x, z, leg] of [
    [0.85, 0.32, 1],
    [0.85, -0.32, -1],
    [-0.9, 0.32, -1],
    [-0.9, -0.32, 1],
  ])
    add(new THREE.CylinderGeometry(0.12, 0.08, 1.4, 6).translate(x, 0.7, z), leg);
  add(new THREE.CylinderGeometry(0.06, 0.12, 0.9, 6).rotateZ(-1.1).translate(-1.5, 1.4, 0));
  add(new THREE.CylinderGeometry(0.32, 0.42, 1.3, 9).rotateZ(-0.25).translate(1.2, 2.45, 0));
  add(new THREE.SphereGeometry(0.24, 10, 8).translate(1.4, 3.3, 0));
  for (const z of [-0.45, 0.45]) add(new THREE.CylinderGeometry(0.08, 0.07, 1.1, 6).rotateZ(0.6).translate(1.55, 2.6, z));
  add(new THREE.TorusGeometry(0.75, 0.035, 4, 16, Math.PI * 0.9).rotateY(Math.PI / 2).translate(1.95, 2.6, 0.55));
  const out = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'aLeg']) {
    const size = parts[0].attributes[name].itemSize;
    const all = new Float32Array(parts.reduce((s, g) => s + g.attributes[name].count * size, 0));
    let o = 0;
    for (const g of parts) {
      all.set(g.attributes[name].array, o);
      o += g.attributes[name].count * size;
    }
    out.setAttribute(name, new THREE.BufferAttribute(all, size));
  }
  for (const g of parts) g.dispose();
  return out;
}

export function createForest({ house = null, materials, ground, tier = 'high' } = {}) {
  const group = new THREE.Group();
  group.name = 'grounds:forest';
  const m = createMesh();
  const rng = seeded(23);

  // the lanterns down the path: a post every twenty-odd metres, either side
  // in turn, an iron arm, the lantern hung from it, lit warm at dusk
  let run = 0;
  let next = 10;
  for (let i = 1; i < PATH.length; i++) {
    const [ax, az] = PATH[i - 1];
    const [bx, bz] = PATH[i];
    const len = Math.hypot(bx - ax, bz - az);
    while (next <= run + len) {
      const t = (next - run) / len;
      const side = Math.round(next / 22) % 2 ? 1 : -1;
      const nx = -(bz - az) / len;
      const nz = (bx - ax) / len;
      const x = ax + (bx - ax) * t + nx * side * 2;
      const z = az + (bz - az) * t + nz * side * 2;
      const y = ground(x, z);
      m.tone(TONES.oak);
      m.box('timber', { at: [x, y - 0.4, z], size: [0.18, 2.9, 0.18], turn: Math.atan2(nx, nz) });
      const hx = x - nx * side * 0.6;
      const hz = z - nz * side * 0.6;
      m.tone(TONES.iron);
      m.beam('iron', [x, y + 2.35, z], [hx, y + 2.35, hz], 0.05);
      m.box('iron', { at: [hx, y + 1.75, hz], size: [0.34, 0.06, 0.34] });
      m.box('iron', { at: [hx, y + 2.22, hz], size: [0.4, 0.08, 0.4] });
      // (the glass: four panes round the flame, lit first of anything at dusk)
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2;
        m.tone([1, 1, 1]).lit(0.01 + rng() * 0.03);
        m.shape('glass', { at: [hx + Math.sin(a) * 0.15, y + 1.81, hz + Math.cos(a) * 0.15], turn: a, outline: archOutline(0.28, 0.4, { pointed: false, segs: 2 }) });
        m.lit(0);
      }
      next += 22;
    }
    run += len;
  }

  // the clearing: a fallen trunk across it, mossy stones at its edge
  const [cx, cz] = CLEARING.at;
  const cy = ground(cx, cz);
  m.tone([0.45, 0.4, 0.34]);
  m.beam('timber', [cx - 6, ground(cx - 6, cz + 3) + 0.45, cz + 3], [cx + 5, ground(cx + 5, cz + 6) + 0.38, cz + 6], 0.85, 0.8);
  for (let k = 0; k < 6; k++) {
    const a = rng() * Math.PI * 2;
    const d = CLEARING.r - 2 + rng() * 4;
    const x = cx + Math.sin(a) * d;
    const z = cz + Math.cos(a) * d;
    m.tone([0.38 + rng() * 0.08, 0.42 + rng() * 0.08, 0.3]);
    m.lathe('rubble', { at: [x, ground(x, z) - 0.3, z], profile: [[0.9 + rng() * 0.5, 0], [1.1, 0.5], [0.8, 1.0 + rng() * 0.4], [0.001, 1.3 + rng() * 0.4]], sides: 7 });
  }
  void cy;

  const geometries = m.geometries();
  for (const [name, g] of Object.entries(geometries)) {
    const mesh = new THREE.Mesh(g, materials[name]);
    mesh.castShadow = tier !== 'low' && name !== 'glass';
    mesh.receiveShadow = true;
    mesh.name = `forest:${name}`;
    group.add(mesh);
  }

  // the centaurs: two dark shapes walking a line deep among the trees
  const uTime = uniform(0);
  const body = centaurGeometry();
  const dark = house ? house.material({ color: 0x14130f }) : new MeshLambertNodeMaterial({ color: 0x14130f });
  const leg = attribute('aLeg', 'float');
  // (the legs swing about the hip, their feet most, their pairs opposite)
  const swing = sin(uTime.mul(3.1)).mul(leg).mul(positionLocal.y.sub(1.4).negate().max(0)).mul(0.32);
  dark.positionNode = positionLocal.add(vec3(swing, 0, 0));
  const centaurs = new THREE.InstancedMesh(body, dark, 2);
  centaurs.frustumCulled = false;
  centaurs.name = 'forest:centaurs';
  group.add(centaurs);
  const walks = [
    { from: [-560, -250], to: [-560, -470], speed: 1.6, t: 0 },
    { from: [-520, -520], to: [-300, -520], speed: 1.3, t: 70 },
  ];
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  const up = new THREE.Vector3(0, 1, 0);

  let fogK = 0;
  let turnedAt = -Infinity;
  let t = 0;
  return {
    group,
    step(dt, { at = null } = {}) {
      t += dt;
      uTime.value = t;
      walks.forEach((w, i) => {
        const L = Math.hypot(w.to[0] - w.from[0], w.to[1] - w.from[1]);
        // (there and back along their line, turning at its ends)
        const s = (w.t + t * w.speed) % (2 * L);
        const k = s < L ? s / L : 2 - s / L;
        const x = w.from[0] + (w.to[0] - w.from[0]) * k;
        const z = w.from[1] + (w.to[1] - w.from[1]) * k;
        const dir = s < L ? 1 : -1;
        q.setFromAxisAngle(up, Math.atan2(-(w.to[1] - w.from[1]) * dir, (w.to[0] - w.from[0]) * dir));
        centaurs.setMatrixAt(i, m4.compose(p.set(x, ground(x, z) + Math.abs(Math.sin(t * 3.1)) * 0.05, z), q, one));
      });
      centaurs.instanceMatrix.needsUpdate = true;
      if (!at) {
        fogK = 0;
        return { fog: 0, turn: null, say: null };
      }
      const depth = forestDepth(at[0], at[2]);
      const path = onPath(at[0], at[2]);
      // the fog closing in off the path, and on it only past the clearing
      const want = Math.max(0, Math.min(1, (depth - THICK) / (FAR - THICK))) * (path ? 0.35 : 1);
      fogK += (want - fogK) * Math.min(1, dt * 1.5);
      if (depth > FAR && !path && t - turnedAt > 2) {
        turnedAt = t;
        return { fog: fogK, turn: turnBack(at[0], at[2]), say: HAGRID };
      }
      return { fog: fogK, turn: null, say: null };
    },
    dispose() {
      for (const g of Object.values(geometries)) g.dispose();
      body.dispose();
      dark.dispose();
    },
  };
}

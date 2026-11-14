// Hagrid’s hut (the design’s §4.3), the site’s own reading of it: a squat
// octagon of rough grey stone at the forest’s edge, a tall cone of
// weathered shingles over it, a stone chimney with its smoke going up, a
// heavy plank door with a crossbow hung over it, small windows lit warm at
// night; the pumpkin patch beside it, pumpkins bigger than you among them;
// the woodpile; and the paddock behind, its fence of split rails. Inside is
// one room (./hutRoom.js, registered here with rooms/index.js), gone into
// by its door (castle/doors.js draws the door and gives its prompt).
//
// Draws: the hut and its fence merged by material (stone, shingle, timber,
// glass, iron: five), the pumpkins and their stems (two), the logs (one),
// the smoke (one).
//
//   HUT: { at, r, door } (the hut’s middle, its radius, its door for castle/doors.js)
//   PADDOCK: { at, r, gate } (the fence’s ring, the gap in it)
//   createHut({ house, materials, ground, tier }) → { group, colliders, step(dt, camera, { night }), dispose() }
//   pumpkinGeometry(seed) → a ribbed pumpkin, one metre across (pure but for three)

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { attribute, float, length, smoothstep, uniform, uv, vec2 } from 'three/tsl';
import { archOutline, createMesh } from '../castle/mesh';
import { TONES } from '../castle/materials';
import { placeById } from '../../rules/places';
import { registerRoom } from '../../rooms/index';
import { seeded } from '../../../../lib/seeded';

const DOOR = placeById('hut');
export const HUT = {
  at: [DOOR.at[0] - 5.6, DOOR.at[1]],
  r: 4.4,
  // (for castle/doors.js: the hut’s door, on its east face, to its one room)
  door: { id: 'hut', place: 'hut', at: [DOOR.at[0] - 1.15, DOOR.at[1]], y: null, faces: DOOR.faces, w: 1.7, h: 2.7, leaves: 1, room: 'hut', kind: 'room', name: 'Hagrid’s hut' },
};
export const PADDOCK = { at: placeById('paddock').at, r: 16, gate: Math.PI / 2 }; // (its gate toward the hut)
const PUMPKINS = placeById('pumpkins').at;

// the room is the grounds’ own: registered here, loaded when its door is gone through
registerRoom('hut', { name: 'Hagrid’s hut', load: () => import('./hutRoom.js') });

const SHINGLE = [0.36, 0.27, 0.19];
const STONE = [0.5, 0.48, 0.45];

export function pumpkinGeometry(seed = 1) {
  const g = new THREE.SphereGeometry(0.5, 18, 10);
  const p = g.attributes.position;
  const r = seeded(seed);
  const lean = 0.06 * (r() - 0.5);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const a = Math.atan2(z, x);
    // (ribs round it, flattened top and bottom, a dimple where the stem goes)
    const rib = 1 - 0.07 * Math.abs(Math.sin(a * 5));
    const flat = 0.72 + 0.06 * Math.cos(a * 2 + 1);
    const dimple = y > 0.42 ? 0.88 : 1;
    p.setXYZ(i, x * rib + lean * y, y * flat * dimple + 0.5 * flat, z * rib);
  }
  g.computeVertexNormals();
  return g;
}

// smoke: soft round cards rising from the chimney, each on its own phase,
// spreading and fading as it climbs, turned to the camera
function createSmoke({ at, count = 9 }) {
  const geo = new THREE.PlaneGeometry(1, 1);
  const phase = new Float32Array(count).map((_, i) => i / count);
  geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1));
  const uAge = uniform(0);
  const m = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
  const d = length(uv().sub(vec2(0.5)));
  const life = attribute('aPhase', 'float').add(uAge).fract();
  m.colorNode = float(0.62).mul(float(1).sub(life.mul(0.3)));
  m.opacityNode = smoothstep(0.5, 0.15, d).mul(smoothstep(0, 0.12, life)).mul(float(1).sub(life)).mul(0.38);
  const mesh = new THREE.InstancedMesh(geo, m, count);
  mesh.frustumCulled = false;
  mesh.name = 'hut:smoke';
  const m4 = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  let t = 0;
  return {
    mesh,
    step(dt, camera, wind = 0.4) {
      t += dt * 0.12;
      uAge.value = t % 1;
      for (let i = 0; i < count; i++) {
        const life = (phase[i] + t) % 1;
        p.set(at[0] + life * 5 * wind + Math.sin(life * 7 + i) * 0.3, at[1] + life * 9, at[2] + life * 2.4 * wind);
        const k = 0.8 + life * 3.4;
        m4.compose(p, camera.quaternion, s.set(k, k, k));
        mesh.setMatrixAt(i, m4);
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      geo.dispose();
      m.dispose();
    },
  };
}

export function createHut({ house = null, materials, ground, tier = 'high' } = {}) {
  const group = new THREE.Group();
  group.name = 'grounds:hut';
  const [hx, hz] = HUT.at;
  const base = ground(hx, hz);
  const m = createMesh();
  const rng = seeded(41);
  const sides = 8;
  const faces = DOOR.faces;
  // (the octagon turned so a face, not a corner, carries the door)
  const turn = faces + Math.PI / sides;
  const P = (a, r, y) => [hx + Math.sin(a) * r, base + y, hz + Math.cos(a) * r];

  // the walls: eight faces of rough stone on a plinth into the ground
  m.tone(STONE.map((v) => v * 0.8));
  m.ring('rubble', { at: [hx, base - 1, hz], r: HUT.r + 0.25, h: 1.4, sides, from: turn, to: turn + Math.PI * 2 });
  m.tone(STONE);
  m.ring('rubble', { at: [hx, base, hz], r: HUT.r, h: 3.3, sides, from: turn, to: turn + Math.PI * 2 });
  // the roof: a tall cone of shingles, flared at its eave, a cap of lead at its point
  const R = HUT.r + 0.9;
  const prof = [];
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    prof.push([Math.max(0.001, R * Math.pow(1 - t, 1.12)), 3.1 + 5.2 * t]);
  }
  m.tone(SHINGLE);
  m.lathe('slate', { at: [hx, base, hz], profile: prof, sides: 16 });
  m.tone(TONES.lead);
  m.lathe('lead', { at: [hx, base + 8.1, hz], profile: [[0.25, 0], [0.12, 0.5], [0.001, 1.1]], sides: 6 });
  // the chimney up its north-west side, through the roof
  const ca = faces + Math.PI * 0.8;
  const [cx, , cz] = P(ca, HUT.r - 0.6, 0);
  m.tone(STONE.map((v) => v * 0.9));
  m.box('rubble', { at: [cx, base, cz], size: [1.3, 7.9, 1.3], turn: ca });
  m.tone(TONES.plinth);
  m.box('rubble', { at: [cx, base + 7.9, cz], size: [1.5, 0.3, 1.5], turn: ca });
  // the windows: small, deep-set, lit early (someone is always in)
  for (const off of [-1.1, 1.3, 2.4]) {
    const a = faces + off;
    m.tone(TONES.glass).lit(0.04 + rng() * 0.08);
    m.shape('glass', { at: P(a, HUT.r * Math.cos(Math.PI / sides) + 0.04, 1.2), turn: a, outline: archOutline(0.8, 1.2, { pointed: false, segs: 3 }) });
    m.lit(0);
    m.tone(TONES.oak);
    m.box('timber', { at: P(a, HUT.r * Math.cos(Math.PI / sides) + 0.12, 1.12), size: [1.1, 0.12, 0.25], turn: a });
  }
  // the crossbow over the door: its stock across, its bow, its string
  const da = faces;
  const above = (u, y, out = 0.25) => P(da, HUT.r * Math.cos(Math.PI / sides) + out, y).map((v, i) => v + (i === 0 ? Math.cos(da) * u : i === 2 ? -Math.sin(da) * u : 0));
  m.tone(TONES.oak);
  m.beam('timber', above(-0.7, 3.0), above(0.7, 3.0), 0.12, 0.1);
  m.beam('timber', above(0.4, 2.55), above(0.55, 3.45), 0.07);
  m.tone(TONES.iron);
  m.beam('iron', above(0.42, 2.6, 0.32), above(0.53, 3.4, 0.32), 0.015);
  // the woodpile against the south wall, and a chopping block
  const wa = faces - 1.9;
  const [wx, , wz] = P(wa, HUT.r + 0.9, 0);
  m.tone(TONES.oak);
  m.box('timber', { at: [wx, base, wz], size: [0.7, 0.55, 0.7], turn: wa });

  // the paddock’s fence: posts round its ring, two split rails between, a gap for the gate
  const [px, pz] = PADDOCK.at;
  const pBase = (x, z) => ground(x, z);
  const posts = 32;
  const gate = Math.atan2(hx - px, hz - pz);
  const colliders = [{ id: 'hut', kind: 'circle', at: [hx, hz], r: HUT.r + 0.35 }];
  for (let i = 0; i < posts; i++) {
    const a0 = (i / posts) * Math.PI * 2;
    const a1 = ((i + 1) / posts) * Math.PI * 2;
    const off = Math.abs(Math.atan2(Math.sin(a0 - gate), Math.cos(a0 - gate)));
    const x0 = px + Math.sin(a0) * PADDOCK.r;
    const z0 = pz + Math.cos(a0) * PADDOCK.r;
    const x1 = px + Math.sin(a1) * PADDOCK.r;
    const z1 = pz + Math.cos(a1) * PADDOCK.r;
    const y0 = pBase(x0, z0);
    const y1 = pBase(x1, z1);
    m.tone(TONES.timber.map((v) => v * (0.8 + rng() * 0.3)));
    m.box('timber', { at: [x0, y0 - 0.4, z0], size: [0.22, 1.75, 0.22], turn: a0 });
    colliders.push({ id: 'paddock', kind: 'circle', at: [x0, z0], r: 0.3 });
    // (no rails across the gate’s gap: the way in)
    if (off < 0.2 || Math.abs(Math.atan2(Math.sin(a1 - gate), Math.cos(a1 - gate))) < 0.2) continue;
    for (const h of [0.55, 1.15]) m.beam('timber', [x0, y0 + h, z0], [x1, y1 + h + (rng() - 0.5) * 0.08, z1], 0.1, 0.14);
    if (i % 2 === 0) colliders.push({ id: 'paddock', kind: 'circle', at: [(x0 + x1) / 2, (z0 + z1) / 2], r: 0.3 });
  }

  const geometries = m.geometries();
  for (const [name, g] of Object.entries(geometries)) {
    const mesh = new THREE.Mesh(g, materials[name]);
    mesh.castShadow = mesh.receiveShadow = tier !== 'low';
    mesh.name = `hut:${name}`;
    group.add(mesh);
  }

  // the pumpkin patch: a score of pumpkins, a few far bigger than you, their stems
  const pr = seeded(77);
  const spots = [];
  for (let i = 0; i < 18; i++) {
    const a = pr() * Math.PI * 2;
    const d = Math.sqrt(pr()) * 10;
    const x = PUMPKINS[0] + Math.sin(a) * d;
    const z = PUMPKINS[1] + Math.cos(a) * d;
    const big = i < 4 ? 1.6 + pr() * 0.9 : 0.5 + pr() * 0.6;
    spots.push({ x, z, s: big, yaw: pr() * 6.28 });
  }
  const pumpkinGeo = pumpkinGeometry(3);
  const orange = house ? house.material({ color: 0xc46a1c }) : new THREE.MeshLambertMaterial({ color: 0xc46a1c });
  const pumpkins = new THREE.InstancedMesh(pumpkinGeo, orange, spots.length);
  const stemGeo = new THREE.CylinderGeometry(0.035, 0.06, 0.18, 6).translate(0, 0.09, 0);
  const stemMat = house ? house.material({ color: 0x4a5a26 }) : new THREE.MeshLambertMaterial({ color: 0x4a5a26 });
  const stems = new THREE.InstancedMesh(stemGeo, stemMat, spots.length);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const v = new THREE.Vector3();
  const s = new THREE.Vector3();
  spots.forEach((sp, i) => {
    const y = ground(sp.x, sp.z) - 0.04 * sp.s;
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), sp.yaw);
    pumpkins.setMatrixAt(i, m4.compose(v.set(sp.x, y, sp.z), q, s.set(sp.s, sp.s, sp.s)));
    stems.setMatrixAt(i, m4.compose(v.set(sp.x, y + sp.s * 0.7, sp.z), q, s.set(sp.s, sp.s, sp.s)));
    if (sp.s > 1.2) colliders.push({ id: 'pumpkin', kind: 'circle', at: [sp.x, sp.z], r: sp.s * 0.5 });
  });
  pumpkins.castShadow = stems.castShadow = tier !== 'low';
  pumpkins.receiveShadow = true;
  group.add(pumpkins, stems);

  // the logs stacked by the woodpile
  const logGeo = new THREE.CylinderGeometry(0.16, 0.16, 1.1, 7).rotateZ(Math.PI / 2);
  const logMat = house ? house.material({ color: 0x6a4e34 }) : new THREE.MeshLambertMaterial({ color: 0x6a4e34 });
  const logs = new THREE.InstancedMesh(logGeo, logMat, 15);
  const [lx, , lz] = P(wa + 0.35, HUT.r + 0.7, 0);
  let k = 0;
  for (let row = 0; row < 4; row++)
    for (let n = 0; n < 5 - row && k < 15; n++) {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), wa + Math.PI / 2);
      const u = (n - (4 - row) / 2) * 0.33;
      logs.setMatrixAt(k++, m4.compose(v.set(lx + Math.cos(wa) * u, base + 0.16 + row * 0.29, lz - Math.sin(wa) * u), q, s.set(1, 1, 1)));
    }
  logs.count = k;
  logs.castShadow = tier !== 'low';
  group.add(logs);

  const smoke = createSmoke({ at: [cx, base + 8.3, cz] });
  group.add(smoke.mesh);

  return {
    group,
    colliders,
    step(dt, camera, { wind = 0.4 } = {}) {
      smoke.step(dt, camera, wind);
    },
    dispose() {
      for (const g of Object.values(geometries)) g.dispose();
      pumpkinGeo.dispose();
      stemGeo.dispose();
      logGeo.dispose();
      orange.dispose?.();
      stemMat.dispose?.();
      logMat.dispose?.();
      smoke.dispose();
    },
  };
}

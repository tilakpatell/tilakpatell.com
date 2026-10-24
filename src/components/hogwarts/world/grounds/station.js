// Hogsmeade station on the grounds (the design’s §4.3, §4.9): the platform
// along the lake’s arm at its head, its edge in dressed stone; the station
// house of rough stone with its slate roof, its canopy over the platform
// and its board with the name painted in the site’s own lettering; lamps
// on iron posts down the platform, lit from dusk; the line coming in from
// the north to its buffers; the signal at the platform’s end, its arm
// down; and standing at the platform, the scarlet train.
//
// The train is a stand-in made of plain shapes in its proportions (an
// engine and three carriages, scarlet and black, their windows lit at
// night, steam off the chimney) until the cast lane’s Hogwarts Express
// lands (to be `public/models/hogwarts/props/express.glb`, the design’s
// §4.10 props); then it is that model, placed where this stands. Lane D’s
// arrival has a station set of its own (world/arrival/station.js), drawn
// far from the grounds; this is the one you walk to.
//
// Draws: the station by material (stone, slate, timber, iron, glass, paint:
// six), the board (one), the steam (one), the sleepers (one).
//
//   STATION_AT: { at: [x, z], along: [dx, dz], y } the platform’s middle, its line, its top
//   createStation({ house, materials, ground, tier, renderer }) → { group, colliders, step(dt, camera), dispose() }

import * as THREE from 'three';
import { MeshBasicNodeMaterial, MeshLambertNodeMaterial } from 'three/webgpu';
import { attribute, float, length, smoothstep, uniform, uv, vec2 } from 'three/tsl';
import { archOutline, createMesh } from '../castle/mesh';
import { TONES } from '../castle/materials';
import { placeById } from '../../rules/places';
import { canvasTexture } from '../../../../lib/three/canvasTexture';

const P0 = placeById('station').at;
// (the platform runs along the flat the terrain levels for it: north-north-west to south-south-east)
const TURN = -0.42;
const ALONG = [-Math.sin(TURN), Math.cos(TURN)];
const ACROSS = [Math.cos(TURN), Math.sin(TURN)];
export const STATION_AT = { at: [P0[0] + 2, P0[1] - 2], along: ALONG, y: 4.6 };
const LEN = 84; // m of platform
const W = 6.5;
const TOP = 0.95; // m the platform stands over the track’s bed
const TRACK = -4.2; // m across from the platform’s middle to the track’s (landward, west)
const lin = (hex) => new THREE.Color(hex).toArray();
const SCARLET = lin(0x8a1212);
const BLACK = lin(0x161514);
const CREAM = lin(0xd9cfb4);
const BRASS = lin(0xb08a3e);

// a point on the platform’s frame: u along it (+ toward the buffers, south), v across it (+ toward the lake)
const at = (u, v) => [STATION_AT.at[0] + ALONG[0] * u + ACROSS[0] * v, STATION_AT.at[1] + ALONG[1] * u + ACROSS[1] * v];
const yawAlong = Math.atan2(ALONG[0], ALONG[1]);

// the board’s name, painted: cream letters on a dark green board in a plain serif
function boardTexture(renderer) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = '#1f3a2c';
  g.fillRect(0, 0, 512, 96);
  g.strokeStyle = '#d9cfb4';
  g.lineWidth = 6;
  g.strokeRect(8, 8, 496, 80);
  g.fillStyle = '#e9dfc4';
  g.font = '600 52px Georgia, "Times New Roman", serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('HOGSMEADE', 256, 52);
  return canvasTexture(c, renderer, { wrap: false });
}

function createSteam({ from, count = 8 }) {
  const geo = new THREE.PlaneGeometry(1, 1);
  const phase = new Float32Array(count).map((_, i) => i / count);
  geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1));
  const uAge = uniform(0);
  const m = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
  const life = attribute('aPhase', 'float').add(uAge).fract();
  m.colorNode = float(0.85);
  m.opacityNode = smoothstep(0.5, 0.1, length(uv().sub(vec2(0.5)))).mul(smoothstep(0, 0.1, life)).mul(float(1).sub(life)).mul(0.42);
  const mesh = new THREE.InstancedMesh(geo, m, count);
  mesh.frustumCulled = false;
  const m4 = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  let t = 0;
  return {
    mesh,
    step(dt, camera) {
      t += dt * 0.22;
      uAge.value = t % 1;
      for (let i = 0; i < count; i++) {
        const life = (phase[i] + t) % 1;
        p.set(from[0] + Math.sin(i * 3.1) * life, from[1] + life * 6, from[2] + life * 3 * ALONG[1]);
        const k = 0.9 + life * 4;
        mesh.setMatrixAt(i, m4.compose(p, camera.quaternion, s.set(k, k, k)));
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      geo.dispose();
      m.dispose();
    },
  };
}

export function createStation({ house = null, materials, ground, tier = 'high', renderer = null } = {}) {
  const group = new THREE.Group();
  group.name = 'grounds:station';
  const y = STATION_AT.y;
  const m = createMesh();
  const paint = createMesh();
  const colliders = [];
  const P = (u, h, v) => {
    const [x, z] = at(u, v);
    return [x, y + h, z];
  };

  // the platform: a stone edge to the track, its top in gravel, a low wall to the lake
  m.tone(TONES.stone);
  m.box('ashlar', { at: P(0, -0.6, -W / 2 + 0.4), size: [0.8, TOP + 0.6, LEN], turn: yawAlong });
  m.tone(TONES.old);
  m.box('rubble', { at: P(0, -0.6, 0.4), size: [W - 0.8, TOP + 0.55, LEN], turn: yawAlong });
  m.tone(TONES.plinth);
  m.box('rubble', { at: P(0, TOP - 0.05, W / 2 - 0.2), size: [0.5, 0.9, LEN], turn: yawAlong });

  // the line: two rails on sleepers, from the north edge of the ground to the buffers south of the platform
  const north = -260;
  const south = LEN / 2 + 12;
  m.tone(TONES.iron);
  for (const side of [-0.72, 0.72]) {
    const pts = [];
    for (let u = north; u <= south; u += 12) {
      const [x, z] = at(u, TRACK + side);
      pts.push([x, Math.max(ground(x, z), y - TOP) + 0.22, z]);
    }
    for (let i = 1; i < pts.length; i++) m.beam('iron', pts[i - 1], pts[i], 0.09, 0.13);
  }
  // the buffers at the line’s end, and the signal at the platform’s north end, its arm down
  m.tone(SCARLET);
  m.box('timber', { at: P(south + 0.6, -TOP, TRACK), size: [2.4, 1.2, 0.6], turn: yawAlong });
  m.tone(TONES.iron);
  const sig = P(-LEN / 2 - 6, -TOP, TRACK - 2.4);
  m.beam('iron', sig, [sig[0], sig[1] + 7, sig[2]], 0.18);
  paint.tone(SCARLET);
  paint.beam('paint', [sig[0], sig[1] + 6.4, sig[2]], [sig[0] + ACROSS[0] * 1.5, sig[1] + 5.6, sig[2] + ACROSS[1] * 1.5], 0.28, 0.08);
  m.tone([1, 1, 1]).lit(0.02);
  m.box('glass', { at: [sig[0], sig[1] + 5.2, sig[2]], size: [0.32, 0.32, 0.32] });
  m.lit(0);

  // the station house on the lake side, its canopy over the platform
  const hu = -6;
  m.tone(TONES.old);
  m.box('rubble', { at: P(hu, TOP, W / 2 + 3.4), size: [6.2, 4.2, 14], turn: yawAlong });
  // (its roof a gable along the platform: two slopes of slate and stone ends)
  {
    const [x0, , z0] = P(hu - 7.4, 0, W / 2 + 3.4);
    const [x1, , z1] = P(hu + 7.4, 0, W / 2 + 3.4);
    const eave = y + TOP + 4.2;
    const out = (k, s) => [ACROSS[0] * k * s, ACROSS[1] * k * s];
    const [ax, az] = out(1, 3.6);
    m.tone(TONES.slate);
    m.quad('slate', [x0 + ax, eave - 0.3, z0 + az], [x1 + ax, eave - 0.3, z1 + az], [x1, eave + 2.4, z1], [x0, eave + 2.4, z0]);
    m.quad('slate', [x1 - ax, eave - 0.3, z1 - az], [x0 - ax, eave - 0.3, z0 - az], [x0, eave + 2.4, z0], [x1, eave + 2.4, z1]);
    m.tone(TONES.old);
    m.tri('rubble', [x0 + ax * 0.86, eave, z0 + az * 0.86], [x0, eave + 2.3, z0], [x0 - ax * 0.86, eave, z0 - az * 0.86]);
    m.tri('rubble', [x1 - ax * 0.86, eave, z1 - az * 0.86], [x1, eave + 2.3, z1], [x1 + ax * 0.86, eave, z1 + az * 0.86]);
    // its chimney
    m.box('rubble', { at: P(hu + 5, TOP + 4.2, W / 2 + 4.6), size: [0.9, 3.6, 0.9], turn: yawAlong });
  }
  // its door and its windows to the platform, lit
  m.tone(TONES.oak);
  m.shape('timber', { at: P(hu, TOP, W / 2 + 0.36), turn: yawAlong - Math.PI / 2, outline: archOutline(1.3, 2.5, { pointed: false, segs: 3 }) });
  for (const du of [-4, 3.5]) {
    m.tone([1, 1, 1]).lit(0.03 + Math.abs(du) * 0.01);
    m.shape('glass', { at: P(hu + du, TOP + 1, W / 2 + 0.36), turn: yawAlong - Math.PI / 2, outline: archOutline(1.1, 1.6, { pointed: false, segs: 3 }) });
    m.lit(0);
  }
  // the canopy: posts along the platform, a roof sloping back to the house
  m.tone(TONES.timber);
  for (let u = hu - 12; u <= hu + 12; u += 4) m.box('timber', { at: P(u, TOP, -0.6), size: [0.2, 3.3, 0.2], turn: yawAlong });
  {
    const a = P(hu - 12.5, TOP + 3.3, -1.3);
    const b = P(hu + 12.5, TOP + 3.3, -1.3);
    const c = P(hu + 12.5, TOP + 4.1, W / 2 + 0.3);
    const d = P(hu - 12.5, TOP + 4.1, W / 2 + 0.3);
    m.tone(TONES.slate);
    m.quad('slate', d, c, b, a, { u: 25, v: 5 });
    m.quad('slate', a, b, c, d, { u: 25, v: 5 });
  }
  colliders.push({ id: 'station', kind: 'box', at: at(hu, W / 2 + 3.4), w: 14, d: 6.4, turn: yawAlong + Math.PI / 2 });

  // the lamps down the platform: an iron post, a lantern, lit first of anything at dusk
  for (let u = -LEN / 2 + 6; u <= LEN / 2 - 6; u += 12) {
    const [x, , z] = P(u, 0, -W / 2 + 1.4);
    m.tone(TONES.iron);
    m.beam('iron', [x, y + TOP, z], [x, y + TOP + 3.4, z], 0.12);
    m.box('iron', { at: [x, y + TOP + 3.35, z], size: [0.5, 0.1, 0.5] });
    m.tone([1, 1, 1]).lit(0.01 + ((u + 50) % 7) * 0.004);
    m.box('glass', { at: [x, y + TOP + 2.8, z], size: [0.34, 0.55, 0.34] });
    m.lit(0);
    colliders.push({ id: 'lamp', kind: 'circle', at: [x, z], r: 0.25 });
  }

  // the train at the platform: the engine at the south end, smokebox to the buffers, three carriages behind
  const engineU = LEN / 2 - 10;
  const Tp = (u, h, v = 0) => P(u, h - TOP + 0.35, TRACK + v);
  paint.tone(BLACK);
  paint.box('paint', { at: Tp(engineU - 2, 0.6), size: [2.9, 0.8, 15], turn: yawAlong });
  paint.tone(SCARLET);
  // (the boiler: a cylinder along the line, as beams round it)
  for (let k = 0; k < 14; k++) {
    const a0 = (k / 14) * Math.PI * 2;
    const a1 = ((k + 1) / 14) * Math.PI * 2;
    const ring = (a, u) => {
      const [x, , z] = Tp(u, 0);
      return [x + ACROSS[0] * Math.cos(a) * 1.15, y + 2.55 + Math.sin(a) * 1.15, z + ACROSS[1] * Math.cos(a) * 1.15];
    };
    paint.quad('paint', ring(a1, engineU + 4.5), ring(a0, engineU + 4.5), ring(a0, engineU - 4), ring(a1, engineU - 4));
  }
  paint.tone(BLACK);
  paint.box('paint', { at: Tp(engineU + 4.6, 1.3), size: [2.5, 2.6, 0.4], turn: yawAlong });
  paint.box('paint', { at: Tp(engineU + 3.2, 3.6), size: [0.9, 1.6, 0.9], turn: yawAlong });
  paint.tone(BRASS);
  paint.box('paint', { at: Tp(engineU + 0.5, 3.6), size: [0.8, 0.7, 0.8], turn: yawAlong });
  paint.tone(SCARLET);
  paint.box('paint', { at: Tp(engineU - 6.2, 1.3), size: [2.9, 3.2, 3.6], turn: yawAlong });
  paint.tone(BLACK);
  paint.box('paint', { at: Tp(engineU - 6.2, 4.5), size: [3.1, 0.25, 3.9], turn: yawAlong });
  for (let k = 0; k < 4; k++) for (const v of [-1.15, 1.15]) paint.box('paint', { at: Tp(engineU + 2.8 - k * 2.3, 0.2, v), size: [0.3, 1.8, 1.8], turn: yawAlong });
  // the carriages, scarlet with a cream band, windows down their sides lit at night
  for (let c = 0; c < 3; c++) {
    const cu = engineU - 18 - c * 20.5;
    paint.tone(SCARLET);
    paint.box('paint', { at: Tp(cu, 1.0), size: [2.8, 3.0, 19.5], turn: yawAlong });
    paint.tone(CREAM);
    paint.box('paint', { at: Tp(cu, 2.0, 0), size: [2.84, 0.9, 19.3], turn: yawAlong });
    paint.tone(BLACK);
    paint.box('paint', { at: Tp(cu, 4.0), size: [2.9, 0.3, 19.7], turn: yawAlong });
    for (const end of [-8, 8]) for (const v of [-1, 1]) paint.box('paint', { at: Tp(cu + end, 0.15, v * 0.9), size: [0.25, 0.9, 0.9], turn: yawAlong });
    for (let w = 0; w < 8; w++)
      for (const side of [-1, 1]) {
        const [x, , z] = Tp(cu - 8.4 + w * 2.4, 0, side * 1.43);
        m.tone([1, 1, 1]).lit(0.05 + ((w * 7 + c * 3) % 10) * 0.05);
        m.box('glass', { at: [x, y - TOP + 2.35, z], size: [0.9, 0.75, 0.04], turn: yawAlong });
        m.lit(0);
      }
  }
  colliders.push({ id: 'train', kind: 'box', at: at(engineU - 30, TRACK), w: 3, d: 82, turn: yawAlong });

  const mats = { ...materials, paint: house ? house.material({ vertexColors: true }) : new MeshLambertNodeMaterial({ vertexColors: true }) };
  const geos = [];
  for (const built of [m, paint])
    for (const [name, g] of Object.entries(built.geometries())) {
      const mesh = new THREE.Mesh(g, mats[name]);
      mesh.castShadow = tier !== 'low' && name !== 'glass';
      mesh.receiveShadow = true;
      mesh.name = `station:${name}`;
      group.add(mesh);
      geos.push(g);
    }

  // the sleepers under the rails: one instanced draw
  const sleeperGeo = new THREE.BoxGeometry(2.6, 0.16, 0.28);
  const sleeperMat = house ? house.material({ color: 0x3a2e24 }) : new MeshLambertNodeMaterial({ color: 0x3a2e24 });
  const count = Math.floor((south - north) / 0.9);
  const sleepers = new THREE.InstancedMesh(sleeperGeo, sleeperMat, count);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yawAlong + Math.PI / 2);
  const v3 = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  for (let i = 0; i < count; i++) {
    const [x, z] = at(north + i * 0.9, TRACK);
    sleepers.setMatrixAt(i, m4.compose(v3.set(x, Math.max(ground(x, z), y - TOP) + 0.06, z), q, one));
  }
  sleepers.receiveShadow = true;
  group.add(sleepers);

  // the name board on its posts at the platform’s middle, facing the line
  const tex = boardTexture(renderer);
  const boardMat = new MeshLambertNodeMaterial({ map: tex, color: tex ? 0xffffff : 0x1f3a2c });
  const board = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 0.8), boardMat);
  const [bx, by, bz] = P(8, TOP + 2.3, -W / 2 + 0.9);
  board.position.set(bx, by, bz);
  board.rotation.y = yawAlong - Math.PI / 2;
  group.add(board);
  m.tone(TONES.iron);

  const steam = createSteam({ from: Tp(engineU + 3.2, 5.3) });
  group.add(steam.mesh);

  return {
    group,
    colliders,
    step(dt, camera) {
      steam.step(dt, camera);
    },
    dispose() {
      for (const g of geos) g.dispose();
      mats.paint.dispose();
      sleeperGeo.dispose();
      sleeperMat.dispose();
      board.geometry.dispose();
      boardMat.dispose();
      tex?.dispose();
      steam.dispose();
    },
  };
}

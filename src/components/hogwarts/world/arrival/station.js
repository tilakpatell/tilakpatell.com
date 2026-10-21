// Hogsmeade station at night (the design’s §4.2, beat one): the scarlet
// engine standing at the platform with steam rolling off it along the
// carriages, their windows lit; lamps on iron posts down the platform, the
// trunks and the owls in their cages stacked by the carriages; the station
// house with its sign; the dark hills behind and the village’s few lights up
// the glen. The students streaming down the platform; and at its end,
// Hagrid, his lantern held up, the brightest thing there.
//
// The train is a stand-in made here until the cast lane’s Express comes
// (§4.10’s props; to be `public/models/hogwarts/props/express.glb`, the Hogwarts cast’s),
// built from the kit’s pieces into the room kit’s merged meshes.
//
// The set’s frame: the platform runs along +x, its edge at z 0.5, its top at
// y 0 (the track bed below, on the −z side); Hagrid stands at its far end.
//
//   (its numbers: ./sets.js’s STATION)
//   createStation({ rt, kit, tier, at }) → { group, step(dt, { camera, beat, since }), dispose() }

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { attribute, float, fract, length, mix, mx_fractal_noise_float, smoothstep, time, uv, vec3, vec4, cameraProjectionMatrix, modelViewMatrix, positionGeometry } from 'three/tsl';
import { createCrowd } from '../../cast/crowd';
import { CROWD, figure } from '../../cast/figures';
import { canvasTexture } from '../../../../lib/three/canvasTexture';
import { createRoomKit } from '../../rooms/kit';
import { STATION } from './sets';


const SCARLET = '#8a1414';
const BLACK = '#141312';

export function createStation({ rt = null, kit, tier = 'high', at = [0, 0, 0] }) {
  const group = new THREE.Group();
  group.name = 'arrival:station';
  group.position.set(...at);
  group.visible = false;
  // (this set’s own pieces in a kit of their own, merged in its frame, so they come and go with it)
  const K = createRoomKit({ tier });
  void kit;
  const { platform: P, track: T } = STATION;
  const box = (m, x, y, z, w, h, d, o) => K.box(m, x, y, z, w, h, d, o);
  const cyl = (m, x, y, z, r0, r1, h, o) => K.cyl(m, x, y, z, r0, r1, h, o);

  // the ground, the platform and its coping, the track bed, the rails and sleepers
  box(K.paint('#1b2219', { scan: 'grass', metres: 3, strength: 0.6, rough: 1 }), 0, -1.25, 20, 400, 0.3, 300);
  box('flags', (P.x0 + P.x1) / 2, -P.height, (P.z0 + P.z1) / 2, P.x1 - P.x0, P.height, P.z1 - P.z0);
  box('ashlar', (P.x0 + P.x1) / 2, -0.08, P.z0 + 0.25, P.x1 - P.x0, 0.12, 0.5);
  box(K.paint('#2a2622', { scan: 'gravel', metres: 1.5, strength: 0.7 }), (P.x0 + P.x1) / 2, -1.2, T.z, P.x1 - P.x0 + 60, 0.22, 3.2);
  for (const dz of [-0.72, 0.72]) box('iron', (P.x0 + P.x1) / 2, T.y + 0.02, T.z + dz, P.x1 - P.x0 + 60, 0.12, 0.08);
  for (let x = P.x0 - 30; x < P.x1 + 30; x += 0.9) box('darkoak', x, T.y - 0.1, T.z, 0.26, 0.12, 2.4);

  // the engine: running plate, boiler, smokebox, chimney, dome, cab, wheels, buffers, tender
  const E = STATION.engine.front;
  const by = T.y + 0.06; // the wheels’ foot
  const red = K.paint(SCARLET, { rough: 0.38, metal: 0.25 });
  const black = K.paint(BLACK, { rough: 0.55, metal: 0.4 });
  const brass = 'brass';
  box(black, E - 7.2, by + 1.05, T.z, 14.2, 0.32, 2.7);
  box(red, E - 0.2, by + 0.75, T.z, 0.35, 0.9, 2.8);
  for (const dz of [-0.8, 0.8]) cyl(brass, E + 0.15, by + 1.2, T.z + dz, 0.2, 0.2, 0.36, { rz: -Math.PI / 2, seg: 10 });
  cyl(red, E - 6.4, by + 2.45, T.z, 0.92, 0.92, 7.4, { rz: -Math.PI / 2, seg: 24 });
  for (const x of [-9.6, -7.6, -5.6, -3.6]) cyl(brass, E + x + 2, by + 2.45, T.z, 0.94, 0.94, 0.08, { rz: -Math.PI / 2, seg: 24 });
  cyl(black, E - 1.6, by + 2.45, T.z, 0.98, 0.98, 1.5, { rz: -Math.PI / 2, seg: 24 });
  cyl(black, E - 0.1, by + 2.45, T.z, 0.9, 0.9, 0.1, { rz: -Math.PI / 2, seg: 24 });
  cyl(black, E - 1.0, by + 3.3, T.z, 0.3, 0.36, 1.15, { seg: 14 });
  cyl(black, E - 1.0, by + 4.38, T.z, 0.4, 0.3, 0.16, { seg: 14 });
  cyl(red, E - 4.6, by + 3.25, T.z, 0.38, 0.45, 0.62, { seg: 14 });
  cyl(brass, E - 4.6, by + 3.85, T.z, 0.3, 0.38, 0.12, { seg: 14 });
  cyl(brass, E - 7.6, by + 3.3, T.z, 0.12, 0.16, 0.42, { seg: 10 });
  box(red, E - 11.7, by + 1.3, T.z, 3.0, 2.9, 2.8);
  box(black, E - 11.7, by + 4.2, T.z, 3.4, 0.16, 3.1);
  box(K.glow('#ffb46a', 1.6), E - 10.25, by + 2.8, T.z + 1.41, 0.9, 0.7, 0.02);
  box(K.glow('#ffb46a', 1.6), E - 10.25, by + 2.8, T.z - 1.41, 0.9, 0.7, 0.02);
  box(red, E - 16.2, by + 1.3, T.z, 5.4, 2.1, 2.7);
  box(K.paint('#0d0d0d', { scan: 'rock', metres: 0.6, strength: 0.8, rough: 1 }), E - 16.2, by + 3.35, T.z, 5.0, 0.4, 2.4);
  for (const side of [-1, 1]) {
    for (const x of [-9.4, -7.2, -5.0]) {
      cyl(red, E + x, by + 0.9, T.z + side * 1.18, 0.88, 0.88, 0.16, { rx: Math.PI / 2, seg: 22 });
      cyl(black, E + x, by + 0.9, T.z + side * 1.24, 0.9, 0.9, 0.06, { rx: Math.PI / 2, seg: 22 });
    }
    for (const x of [-2.4, -1.0, -13.4, -15.4, -17.4]) cyl(black, E + x, by + 0.5, T.z + side * 1.15, 0.48, 0.48, 0.14, { rx: Math.PI / 2, seg: 16 });
    box(K.paint('#9c9a94', { rough: 0.3, metal: 0.9 }), E - 7.2, by + 0.86, T.z + side * 1.34, 4.6, 0.12, 0.06);
    // the gold lining down the boiler bands and the cab’s side
    box('gold', E - 11.7, by + 1.55, T.z + side * 1.41, 2.7, 0.05, 0.02);
    box('gold', E - 11.7, by + 3.95, T.z + side * 1.41, 2.7, 0.05, 0.02);
  }
  // the lamp on the buffer beam
  box(K.glow('#fff1c8', 2.4), E + 0.05, by + 1.65, T.z, 0.18, 0.2, 0.2);

  // the carriages: maroon under a black roof, every window lit
  const CAR = 17.5;
  const windowGlow = K.glow('#ffc078', 1.45);
  const carRed = K.paint('#6e1414', { rough: 0.42, metal: 0.2 });
  for (let c = 0; c < 3; c++) {
    const x1 = E - 19.4 - c * (CAR + 0.9);
    const mid = x1 - CAR / 2;
    box(carRed, mid, by + 0.95, T.z, CAR, 2.75, 2.8);
    cyl(black, mid, by + 3.68, T.z, 1.48, 1.48, CAR + 0.1, { rz: -Math.PI / 2, seg: 18 });
    box(black, mid, by + 0.55, T.z, CAR - 1, 0.4, 2.2);
    for (const side of [-1, 1]) {
      for (let w = 0; w < 8; w++) box(windowGlow, x1 - 1.6 - w * 2.05, by + 2.1, T.z + side * 1.405, 1.2, 0.9, 0.02);
      box('gold', mid, by + 3.0, T.z + side * 1.405, CAR - 0.4, 0.05, 0.02);
      box('gold', mid, by + 1.6, T.z + side * 1.405, CAR - 0.4, 0.05, 0.02);
      for (const x of [x1 - 2, x1 - CAR + 2]) for (const dx of [-0.8, 0.8]) cyl(black, x + dx, by + 0.45, T.z + side * 1.1, 0.45, 0.45, 0.12, { rx: Math.PI / 2, seg: 14 });
    }
  }

  // the lamps down the platform, the trunks and the owls’ cages, the station house and its sign
  const lampGlow = K.glow('#ffcf8a', 2.6);
  for (const x of STATION.lamps) {
    cyl('iron', x, 0, P.z1 - 0.7, 0.07, 0.1, 3.4, { seg: 8 });
    cyl('iron', x, 0, P.z1 - 0.7, 0.18, 0.22, 0.25, { seg: 8 });
    box('iron', x, 3.35, P.z1 - 0.7, 0.36, 0.05, 0.36);
    box(lampGlow, x, 3.0, P.z1 - 0.7, 0.24, 0.34, 0.24);
    cyl('iron', x, 3.4, P.z1 - 0.7, 0.02, 0.24, 0.2, { seg: 4, ry: Math.PI / 4 });
  }
  const leather = K.paint('#4b3020', { rough: 0.7, scan: 'wood', metres: 0.5, strength: 0.25 });
  let s = 17;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 22; i++) {
    const x = -36 + i * 2.4 + rnd();
    const z = 4.8 + rnd() * 1.4;
    const h = 0.42 + rnd() * 0.1;
    box(leather, x, 0, z, 0.9, h, 0.55, { ry: (rnd() - 0.5) * 0.4 });
    box('brass', x, h - 0.02, z, 0.92, 0.04, 0.57, { ry: 0 });
    if (rnd() > 0.55) box(leather, x + 0.05, h, z, 0.8, 0.38, 0.5, { ry: (rnd() - 0.5) * 0.5 });
    if (rnd() > 0.7) {
      cyl('brass', x, h + 0.02, z, 0.16, 0.18, 0.04, { seg: 12 });
      K.add('brass', new THREE.SphereGeometry(0.17, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), { at: [x, h + 0.06, z] });
    }
  }
  const house = { x: 30, z: 11, w: 13, d: 7, h: 4.4 };
  box('stonewarm', house.x, 0, house.z, house.w, house.h, house.d);
  for (const side of [-1, 1]) box('slate', house.x, house.h - 0.2, house.z + side * 1.9, house.w + 0.8, 0.22, 4.2, { rx: side * 0.62 });
  for (const x of [-4, -1.2, 2.6, 5]) box(K.glow('#ffb86e', 1.3), house.x + x, 1.3, house.z - house.d / 2 - 0.02, 1, 1.4, 0.04);
  box('darkoak', house.x + 0.8, 0, house.z - house.d / 2 - 0.03, 1.3, 2.4, 0.06);
  cyl('stonedark', house.x + 4.5, house.h, house.z + 1, 0.4, 0.4, 2.2, { seg: 8 });
  // the sign on its two posts: the station’s name, the site’s own lettering
  for (const dx of [-1.5, 1.5]) cyl('darkoak', 2 + dx, 0, P.z1 - 0.4, 0.07, 0.07, 2.4, { seg: 6 });
  const signTex = typeof document === 'undefined' ? null : canvasTexture(paintSign('Hogsmeade'), rt?.gfx?.renderer ?? null, { wrap: false });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.62), new MeshBasicNodeMaterial({ map: signTex, color: new THREE.Color(0.42, 0.4, 0.36), fog: false }));
  sign.material.userData.noHouse = true;
  sign.position.set(2, 2.0, P.z1 - 0.47);
  sign.rotation.y = Math.PI;
  group.add(sign);

  // the hills behind, and the village’s windows up the glen
  for (const [x, z, r, h] of [
    [-120, 140, 120, 46],
    [40, 170, 150, 62],
    [190, 120, 110, 38],
    [-260, 60, 140, 52],
    [300, -60, 130, 44],
    [-60, -160, 160, 50],
  ])
    K.add(K.paint('#0f1412', { rough: 1 }), new THREE.SphereGeometry(1, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), { at: [x, -1, z], scale: [r, h, r * 0.7] });
  const villageGeo = new THREE.PlaneGeometry(0.9, 0.9);
  const villageMat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  villageMat.userData.noHouse = true;
  villageMat.colorNode = vec3(1, 0.62, 0.3).mul(smoothstep(0.5, 0.0, length(uv().sub(0.5)))).mul(2.2);
  const village = new THREE.InstancedMesh(villageGeo, villageMat, 26);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 26; i++) {
    const a = rnd();
    m4.makeTranslation(150 + a * 90, 14 + rnd() * 16 + a * 12, 70 + rnd() * 60);
    village.setMatrixAt(i, m4);
  }
  village.frustumCulled = false;
  group.add(village);

  // the steam: soft cards rising off the chimney and rolling along the platform under the carriages
  const steam = createSteam({ at: [E - 1.0, by + 4.4, T.z], along: [E - 24, E - 2], ground: by + 0.3, z: T.z, tier });
  group.add(steam.mesh);

  // the lamps’ light: three real ones down the platform, the rest their glow
  const lights = [];
  for (const x of [-20, 4, 28].slice(0, tier === 'low' ? 1 : 3)) {
    const l = new THREE.PointLight(0xffc27a, 10, 18, 1.8);
    l.position.set(x, 2.9, P.z1 - 0.7);
    group.add(l);
    lights.push(l);
  }

  // the students streaming down the platform toward Hagrid; Hagrid with his lantern up
  const walkers = [];
  for (let i = 0; i < (tier === 'low' ? 10 : 22); i++) walkers.push({ x: -40 + i * 2.6 + rnd() * 1.6, z: 1.6 + rnd() * 3.0, v: 1.0 + rnd() * 0.25 });
  const crowd = createCrowd({ rt, spots: walkers.map((w) => ({ at: [w.x, 0, w.z], yaw: Math.PI / 2 })), bodies: CROWD, clips: { idle: 'walk' }, tier, sit: false });
  group.add(crowd.group);
  const hagrid = figure('hagrid', { rt, seed: 11 });
  hagrid.set({ base: 'lantern' });
  hagrid.group.position.set(...STATION.hagrid);
  hagrid.group.rotation.y = -Math.PI / 2 - 0.35;
  group.add(hagrid.group);
  const lantern = new THREE.Group();
  const lanternGlass = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.3, 0.22), new MeshBasicNodeMaterial({ color: new THREE.Color(1, 0.7, 0.35).multiplyScalar(4), fog: false }));
  lanternGlass.material.userData.noHouse = true;
  const lanternLight = new THREE.PointLight(0xffb066, 16, 14, 1.7);
  lantern.add(lanternGlass, lanternLight);
  group.add(lantern);
  K.build(group);
  const hand = new THREE.Vector3();
  const inv = new THREE.Matrix4();
  let t = 0;
  const walkAt = [];

  return {
    group,
    lights,
    ready: Promise.all([crowd.ready, hagrid.ready]),
    step(dt, { camera } = {}) {
      t += dt;
      steam.update(t);
      for (const l of lights) l.intensity = 10 * (0.94 + 0.06 * Math.sin(t * 6 + l.position.x));
      walkAt.length = 0;
      for (const w of walkers) {
        w.x += w.v * dt;
        if (w.x > STATION.hagrid[0] - 2.5) w.x -= 50;
        walkAt.push({ at: [w.x, 0, w.z], yaw: Math.PI / 2 });
      }
      crowd.move(walkAt);
      crowd.step(dt, { camera });
      hagrid.tick(dt);
      // the lantern in his hand, or held up where his hand would be before he has come
      const b = hagrid.bone('RightHand');
      if (b) {
        b.getWorldPosition(hand);
        inv.copy(group.matrixWorld).invert();
        hand.applyMatrix4(inv);
        lantern.position.set(hand.x, hand.y - 0.22, hand.z);
      } else lantern.position.set(STATION.hagrid[0] - 0.4, 2.3, STATION.hagrid[2] + 0.3);
      lanternLight.intensity = 16 * (0.9 + 0.1 * Math.sin(t * 9.7));
    },
    dispose() {
      crowd.dispose();
      hagrid.dispose();
      steam.dispose();
      K.dispose();
      sign.geometry.dispose();
      sign.material.dispose();
      signTex?.dispose();
      villageGeo.dispose();
      villageMat.dispose();
      lanternGlass.geometry.dispose();
      lanternGlass.material.dispose();
      group.removeFromParent();
    },
  };
}

// the station’s name, painted on a board: cream letters on dark green, a gold rule
function paintSign(text) {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 192;
  const g = c.getContext('2d');
  g.fillStyle = '#1d3a2a';
  g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = '#c9a24a';
  g.lineWidth = 8;
  g.strokeRect(14, 14, c.width - 28, c.height - 28);
  g.fillStyle = '#efe4c8';
  g.font = '600 104px Cinzel, Georgia, serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text.toUpperCase(), c.width / 2, c.height / 2 + 6);
  return c;
}

// Steam off the engine: cards rising from the chimney and spreading, and a
// low rolling bank along the carriages, each on its own life, on the GPU.
function createSteam({ at, along, ground, z, tier }) {
  const n = { low: 30, mid: 60, high: 110, ultra: 140 }[tier] ?? 90;
  const geo = new THREE.PlaneGeometry(1, 1);
  const seeds = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) seeds.set([Math.random(), Math.random(), Math.random(), i < n * 0.6 ? 1 : 0], i * 4);
  geo.setAttribute('aSteam', new THREE.InstancedBufferAttribute(seeds, 4));
  const mat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, fog: false });
  mat.userData.noHouse = true;
  const a = attribute('aSteam', 'vec4');
  const life = fract(time.mul(mix(float(0.09), float(0.16), a.y)).add(a.x));
  // from the chimney: up and drifting back; else along the train low, spreading
  const chimney = vec3(float(at[0]).sub(life.mul(9).mul(a.z.add(0.5))), float(at[1]).add(life.mul(life.oneMinus().mul(2).add(5))), float(at[2]).add(a.z.sub(0.5).mul(life).mul(4)));
  const low = vec3(mix(float(along[0]), float(along[1]), a.z), float(ground).add(life.mul(1.1)), float(z).add(life.mul(2.2)).add(a.y.mul(1.2)));
  const centre = mix(low, chimney, a.w);
  const size = mix(float(1.4), float(4.2), life).mul(mix(float(0.8), float(1.2), a.y));
  const mv = modelViewMatrix.mul(vec4(centre, 1));
  mat.vertexNode = cameraProjectionMatrix.mul(mv.add(vec4(positionGeometry.xy.mul(size), 0, 0)));
  const r = length(uv().sub(0.5)).mul(2);
  const puff = smoothstep(1, 0.15, r).mul(mx_fractal_noise_float(vec3(uv().mul(3).add(a.x.mul(10)), life), 3).mul(0.5).add(0.65));
  const fade = smoothstep(0, 0.12, life).mul(smoothstep(1, 0.55, life));
  mat.colorNode = vec3(0.62, 0.64, 0.7);
  mat.opacityNode = puff.mul(fade).mul(mix(float(0.13), float(0.22), a.w));
  const mesh = new THREE.InstancedMesh(geo, mat, n);
  const ident = new THREE.Matrix4();
  for (let i = 0; i < n; i++) mesh.setMatrixAt(i, ident);
  mesh.frustumCulled = false;
  mesh.renderOrder = 9;
  return {
    mesh,
    update() {},
    dispose() {
      geo.dispose();
      mat.dispose();
      mesh.dispose?.();
    },
  };
}

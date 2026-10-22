// Ithilien’s landmarks: Henneth Annûn’s fall beside the path, a curtain of
// water across the mouth of a rock hollow that the camera stands in; the
// Cross-roads’ seated king with an orc-daub where his head was and his own
// head fallen by the road, crowned with flowers; Minas Morgul off to the
// left in its vale, the Cirith Ungol chapter’s own (towns/cirithungol/
// morgul.js) on the Road’s kit, its walls lit green and its beam; the
// Morgul host’s column; the Haradrim’s on their road below on the right;
// and the seven beacons far off west on the White Mountains. In the stage’s
// frame: the road along +z from 0, +x on the walker’s left.
//
//   buildProps({ K, road, heightAt, tier }) → { group, fall, morgul, host, harad, beacons, dispose }
//   FALL, KING, MORGUL, HOST, HARAD: where they stand, for the beats and the scene

import * as THREE from 'three';
import { MeshBasicNodeMaterial, SpriteNodeMaterial } from 'three/webgpu';
import { float, fract, mix, pow, sin, smoothstep, uniform, uv, vec3 } from 'three/tsl';
import { hot } from '../../../../../lib/three/canvasTexture';
import { morgul as buildMorgul, orcColumnGeo, rockGeo } from '../../../towns/cirithungol/props';
import { columnGeo } from '../../../towns/marshes/props';
import { BEACONS } from '../../beacons';
import { C, merged, mergeStatics, part } from '../parts';
import { wearParts } from '../../partsWear';

const THREADS = [360, 140]; // the fall's threads of water across its width, fine and coarse (a few cm each, the camera a metre and a half off)
export const FALL = { x: -9, z: 70.5, w: 8, h: 6 }; // the curtain across the hollow’s mouth (the camera inside it, at z 72)
export const KING = { at: [-6, 92] }; // the seated king by the Cross-roads, on the right
export const MORGUL = { at: [150, 166], scale: 0.42 }; // the dead city in its vale on the left
export const HOST = { from: [118, 160], to: [24, 140], rows: 30, files: 4 }; // out of the vale towards the road
export const HARAD = { from: [-40, -20], to: [-40, 110], rows: 24, files: 3 }; // the southern road below on the right
const RIDGE = { x: -260, z0: 30, z1: 260, y: 46 }; // the White Mountains’ line far off west

export function buildProps({ K, road, heightAt, tier = 'high' }) {
  const group = new THREE.Group();
  group.name = 'ithilien:props';
  const low = tier === 'low';
  const material = wearParts(road.material({ vertexColors: true, flatShading: true }), { tier });

  // Henneth Annûn: a hollow of rock beside the path, the fall across its mouth
  const rocks = [];
  const y0 = heightAt(FALL.x, FALL.z);
  // (two jambs of rock either side of the curtain, the camera between them behind it)
  for (const s of [-1, 1]) rocks.push(part(new THREE.BoxGeometry(1.4, FALL.h + 1, 2.4), C(0xa89c86), { at: [FALL.x + s * (FALL.w / 2 + 0.7), y0 + (FALL.h + 1) / 2 - 0.5, FALL.z + 1] }));
  rocks.push(part(rockGeo(7), C(0xb0a690), { at: [FALL.x - FALL.w / 2 - 2.5, y0 + 1, FALL.z + 1.5], scale: [1.4, 2.2, 1.4] }));
  rocks.push(part(rockGeo(8), C(0xb0a690), { at: [FALL.x + FALL.w / 2 + 2.5, y0 + 1, FALL.z + 1.5], scale: [1.4, 2.2, 1.4] }));
  // the lintel over the mouth the water pours from
  rocks.push(part(new THREE.BoxGeometry(FALL.w + 3, 1.8, 3), C(0xa89c86), { at: [FALL.x, y0 + FALL.h + 0.8, FALL.z + 1] }));
  group.add(merged(rocks, material, 'ithilien:henneth'));
  const tFall = uniform(0);
  const fallMat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide });
  // (threads of water falling down the sheet, in two layers, fine and coarse, each thread at its
  // own pace and phase; thinner between them, so the light beyond shows through; white foam at its foot)
  const at = uv();
  const threads = (n, seed, length, sharp) => {
    const col = at.x.mul(n).floor();
    const rnd = fract(sin(col.mul(12.9898).add(seed)).mul(43758.5453));
    const run = pow(fract(at.y.mul(length).add(tFall.mul(rnd.mul(0.8).add(1.4))).add(rnd.mul(7))), sharp);
    return run.mul(sin(fract(at.x.mul(n)).mul(Math.PI)));
  };
  const sheet = threads(THREADS[0], 0, 1.4, 2).mul(0.7).add(threads(THREADS[1], 3.7, 2.2, 3).mul(0.5)).clamp(0, 1);
  const foam = smoothstep(0.18, 0, at.y);
  fallMat.colorNode = mix(vec3(0.66, 0.74, 0.8), vec3(0.97, 0.98, 1), sheet.add(foam).clamp(0, 1));
  fallMat.opacityNode = float(0.3).add(sheet.mul(0.55)).add(foam.mul(0.3)).clamp(0, 0.95);
  const fall = new THREE.Mesh(new THREE.PlaneGeometry(FALL.w, FALL.h, 1, 1), fallMat);
  fall.position.set(FALL.x, y0 + FALL.h / 2, FALL.z);
  group.add(fall);

  // the Cross-roads’ king: a seated stone giant, an orc-daub where his head was, his own fallen and crowned
  const k = [];
  const kx = KING.at[0];
  const kz = KING.at[1];
  const ky = heightAt(kx, kz);
  const stone = C(0xc0b49c); // (warm: under the Road’s cool sky a grey stone reads violet)
  k.push(part(new THREE.BoxGeometry(3.2, 1.2, 3.2), C(0xa89c86), { at: [kx, ky + 0.6, kz] }));
  k.push(part(new THREE.BoxGeometry(2.2, 2, 1.6), stone, { at: [kx, ky + 2.2, kz - 0.3] }));
  k.push(part(new THREE.BoxGeometry(1.8, 3, 1.4), stone, { at: [kx, ky + 4.6, kz - 0.6] }));
  for (const s of [-1, 1]) k.push(part(new THREE.BoxGeometry(0.6, 2.6, 0.6), stone, { at: [kx + s * 1.2, ky + 4.4, kz - 0.4], pitch: -0.3 }));
  k.push(part(new THREE.DodecahedronGeometry(0.75, 0), C(0x3a2a24), { at: [kx, ky + 6.7, kz - 0.6] }));
  k.push(part(new THREE.DodecahedronGeometry(0.75, 1), stone, { at: [kx + 2.2, ky + 0.6, kz + 1.6], roll: 0.4 }));
  // (the trailing flowers in a crown on it, white and gold)
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    k.push(part(new THREE.IcosahedronGeometry(0.13, 0), C(i % 2 ? 0xf4f0e0 : 0xe8c84a), { at: [kx + 2.2 + Math.cos(a) * 0.62, ky + 1.15, kz + 1.6 + Math.sin(a) * 0.62] }));
  }
  group.add(merged(k, material, 'ithilien:king'));

  // Minas Morgul in its vale, its gate’s bridge towards the road
  const morgul = buildMorgul(K);
  morgul.group.position.set(MORGUL.at[0], heightAt(...MORGUL.at) + 10, MORGUL.at[1]);
  morgul.group.rotation.y = -Math.PI / 2;
  morgul.group.scale.setScalar(MORGUL.scale);
  // (its own valley and river are the chapter’s ground; here the Road’s land is)
  for (const name of ['valley', 'morgulduin']) {
    const o = morgul.group.getObjectByName(name);
    if (o) o.visible = false;
  }
  group.add(morgul.group);

  // the host out of the vale and the Haradrim on their road (one instanced draw each; the scene marches them)
  const host = new THREE.InstancedMesh(orcColumnGeo(), K.mats.orc, HOST.rows * HOST.files * (low ? 0.5 : 1));
  host.name = 'ithilien:host';
  host.frustumCulled = false;
  group.add(host);
  const haradMat = road.material({ vertexColors: true, color: 0xd8a080 });
  const harad = new THREE.InstancedMesh(columnGeo(), haradMat, HARAD.rows * HARAD.files * (low ? 0.5 : 1));
  harad.name = 'ithilien:harad';
  harad.frustumCulled = false;
  group.add(harad);

  // the beacons: seven fires on the far ridge, unlit until the scene lights them
  const fireMat = new SpriteNodeMaterial({ map: K.tex.glow, color: hot(0xffa040, 3), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  // the White Mountains’ far line, dark against the west, a beacon on every other summit
  const peaks = [];
  const tops = [];
  for (let i = 0; i < 14; i++) {
    const z = RIDGE.z0 - 40 + i * 24;
    const h = 30 + ((i * 37) % 23);
    const x = RIDGE.x - 10 - (i % 2) * 30;
    const y = RIDGE.y - 34 + h;
    peaks.push(part(new THREE.ConeGeometry(18 + (i % 3) * 6, h, 5), C(0x3a4048), { at: [x, y - h / 2, z] }));
    tops.push([x, y, z]);
  }
  group.add(merged(peaks, material, 'ithilien:white-mountains'));
  const beacons = Array.from({ length: BEACONS }, (_, i) => {
    const f = new THREE.Sprite(fireMat);
    // (lit from the east end of the line, the nearest, westward)
    const [x, y, z] = tops[13 - i * 2];
    f.position.set(x, y + 2, z);
    f.scale.setScalar(7);
    f.visible = false;
    group.add(f);
    return f;
  });

  // (the stills one a material: the fall, the city and the columns as they are)
  mergeStatics(group, { keep: [fall, morgul.group, host, harad, ...beacons] });

  return {
    group,
    fall: { tick: (t) => void (tFall.value = t) },
    morgul,
    host,
    harad,
    beacons,
    dispose() {
      group.removeFromParent();
      group.traverse((o) => o.geometry?.dispose());
      material.dispose();
      fallMat.dispose();
      haradMat.dispose();
      fireMat.dispose();
    },
  };
}

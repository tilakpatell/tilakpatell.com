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
export const KING = { at: [-6, 92], facing: 2.4 }; // the seated king by the Cross-roads, on the right, facing (a yaw from +z) across the road and down it
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
  // (rock, all of it: a warm grey reads as wood to roleOf)
  for (const s of [-1, 1]) rocks.push(part(new THREE.BoxGeometry(1.4, FALL.h + 1, 2.4), C(0xa89c86), { at: [FALL.x + s * (FALL.w / 2 + 0.7), y0 + (FALL.h + 1) / 2 - 0.5, FALL.z + 1], role: 'rock' }));
  rocks.push(part(rockGeo(7), C(0xb0a690), { at: [FALL.x - FALL.w / 2 - 2.5, y0 + 1, FALL.z + 1.5], scale: [1.4, 2.2, 1.4], role: 'rock' }));
  rocks.push(part(rockGeo(8), C(0xb0a690), { at: [FALL.x + FALL.w / 2 + 2.5, y0 + 1, FALL.z + 1.5], scale: [1.4, 2.2, 1.4], role: 'rock' }));
  // the lintel over the mouth the water pours from
  rocks.push(part(new THREE.BoxGeometry(FALL.w + 3, 1.8, 3), C(0xa89c86), { at: [FALL.x, y0 + FALL.h + 0.8, FALL.z + 1], role: 'rock' }));
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

  // the Cross-roads’ king: a seated stone giant on his throne, his hands on his knees, looking across
  // the road at those coming up it; a rough round stone where his head was, daubed with one red eye;
  // his own head fallen before him, crowned with flowers
  const k = [];
  const ky = heightAt(...KING.at);
  const stone = C(0xc0b49c); // (warm: under the Road’s cool sky a grey stone reads violet)
  const plinth = C(0xa89c86);
  // (each part placed in his own frame: x across him, z the way he faces)
  const kc = Math.cos(KING.facing);
  const ks = Math.sin(KING.facing);
  const onKing = ([x, y, z]) => [KING.at[0] + x * kc + z * ks, ky + y, KING.at[1] - x * ks + z * kc];
  const carved = (geometry, colour, where, role = 'stone') => k.push(part(geometry, colour, { at: onKing(where), yaw: KING.facing, role }));
  carved(new THREE.BoxGeometry(3.4, 1, 3.6), plinth, [0, 0.5, 0]);
  // the throne: its seat, its back to his shoulder blades (his shoulders and head clear of it), its arms
  carved(new THREE.BoxGeometry(2.8, 0.6, 2.2), stone, [0, 1.3, -0.4]);
  carved(new THREE.BoxGeometry(2.8, 2.5, 0.5), plinth, [0, 2.85, -1.5]);
  for (const s of [-1, 1]) carved(new THREE.BoxGeometry(0.4, 0.9, 2), plinth, [s * 1.6, 2.05, -0.3]);
  for (const s of [-1, 1]) {
    // his thighs along the seat, his shins down to the plinth, his feet on it
    carved(new THREE.BoxGeometry(0.8, 0.7, 2), stone, [s * 0.5, 1.95, 0.2]);
    carved(new THREE.BoxGeometry(0.7, 1.4, 0.7), stone, [s * 0.5, 1.65, 1]);
    carved(new THREE.BoxGeometry(0.75, 0.35, 1), stone, [s * 0.5, 1.17, 1.25]);
    // his arms down from the shoulder, his forearms along his thighs, his hands on his knees
    carved(new THREE.BoxGeometry(0.55, 1.7, 0.6), stone, [s * 1.15, 3.55, -0.55]);
    carved(new THREE.BoxGeometry(0.5, 0.5, 1.6), stone, [s * 1.05, 2.55, 0.15]);
    carved(new THREE.BoxGeometry(0.55, 0.3, 0.6), stone, [s * 0.95, 2.45, 1.05]);
  }
  carved(new THREE.BoxGeometry(1.5, 2.5, 1.1), stone, [0, 3.55, -0.7]);
  carved(new THREE.BoxGeometry(2.5, 0.55, 1.25), stone, [0, 4.9, -0.7]);
  // (the daub, and its eye)
  carved(new THREE.DodecahedronGeometry(0.66, 1), C(0x8a7a66), [0, 5.75, -0.65], 'rock');
  carved(new THREE.SphereGeometry(0.17, 8, 6), C(0xb02a1c), [0.12, 5.85, 0], 'none');
  const head = onKing([1.3, 0, 2.9]);
  head[1] = heightAt(head[0], head[2]) + 0.6;
  k.push(part(new THREE.DodecahedronGeometry(0.75, 1), stone, { at: head, roll: 0.4, role: 'stone' }));
  // (the trailing flowers in a crown on it, white and gold)
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    k.push(part(new THREE.IcosahedronGeometry(0.13, 0), C(i % 2 ? 0xf4f0e0 : 0xe8c84a), { at: [head[0] + Math.cos(a) * 0.62, head[1] + 0.55, head[2] + Math.sin(a) * 0.62] }));
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

// The house banners over the Great Hall’s tables (and the common rooms’
// walls): long swallow-tailed cloths in the house’s colour, a border in its
// second colour, and its beast on a shield, painted here on a canvas (the
// lion rampant, the serpent, the eagle displayed, the badger’s striped
// head; the site’s own drawing, no studio art). Each house’s banners are
// one instanced draw, hung from their tops and moving a little in the
// hall’s draught, each on its own phase.
//
//   paintBanner(house, { w, h }) → canvas (in a browser)
//   createBanners(spots, { renderer, w, h }) → { group, dispose() }
//     spots: [{ house, at: [x, y (the top), z], ry? }]

import * as THREE from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { float, instanceIndex, positionLocal, sin, time, vec3 } from 'three/tsl';
import { canvasTexture } from '../../../lib/three/canvasTexture';
import { HOUSES } from '../rules/sorting';

const shade = (hex, k) => {
  const c = new THREE.Color(hex).multiplyScalar(k);
  return `#${c.getHexString()}`;
};

function lion(g) {
  // rampant, facing left: the body reared, forepaws up, the tail curled over
  g.save();
  g.beginPath();
  g.ellipse(4, 18, 30, 52, -0.35, 0, Math.PI * 2);
  g.fill();
  // the mane and the head
  g.beginPath();
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    const r = i % 2 ? 30 : 38;
    g.lineTo(-22 + Math.cos(a) * r, -48 + Math.sin(a) * r);
  }
  g.closePath();
  g.fill();
  g.beginPath();
  g.ellipse(-40, -46, 20, 14, -0.2, 0, Math.PI * 2);
  g.fill();
  g.lineCap = 'round';
  g.lineWidth = 15;
  g.strokeStyle = g.fillStyle;
  const limb = (pts) => {
    g.beginPath();
    g.moveTo(...pts[0]);
    for (const p of pts.slice(1)) g.lineTo(...p);
    g.stroke();
  };
  limb([[-14, -10], [-46, -22], [-62, -44]]);
  limb([[-6, 2], [-44, 4], [-62, -10]]);
  limb([[18, 54], [6, 84], [-18, 96]]);
  limb([[30, 44], [40, 80], [26, 100]]);
  g.lineWidth = 8;
  g.beginPath();
  g.moveTo(32, 50);
  g.bezierCurveTo(78, 40, 70, -30, 44, -40);
  g.stroke();
  g.beginPath();
  g.ellipse(44, -44, 10, 13, 0.4, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

function serpent(g) {
  g.save();
  g.lineCap = 'round';
  g.strokeStyle = g.fillStyle;
  g.lineWidth = 20;
  g.beginPath();
  g.moveTo(30, 100);
  g.bezierCurveTo(-70, 80, 70, 10, -10, -10);
  g.bezierCurveTo(-60, -24, -30, -70, 10, -66);
  g.stroke();
  g.beginPath();
  g.ellipse(22, -70, 22, 14, -0.3, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(42, -76);
  g.lineTo(62, -80);
  g.moveTo(62, -80);
  g.lineTo(70, -88);
  g.moveTo(62, -80);
  g.lineTo(71, -74);
  g.stroke();
  g.restore();
}

function eagle(g) {
  g.save();
  // the wings displayed, their lower edges cut into feathers
  for (const side of [-1, 1]) {
    g.beginPath();
    g.moveTo(0, -20);
    g.lineTo(side * 34, -66);
    g.lineTo(side * 92, -78);
    for (let i = 0; i < 5; i++) {
      g.lineTo(side * (88 - i * 14), -40 + i * 14);
      g.lineTo(side * (78 - i * 14), -50 + i * 14);
    }
    g.lineTo(side * 12, 20);
    g.closePath();
    g.fill();
  }
  g.beginPath();
  g.ellipse(0, 10, 18, 46, 0, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.ellipse(-4, -54, 13, 15, 0, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.moveTo(-14, -56);
  g.lineTo(-30, -50);
  g.lineTo(-14, -46);
  g.fill();
  // the tail fanned
  g.beginPath();
  g.moveTo(-14, 50);
  g.lineTo(-26, 92);
  g.lineTo(0, 82);
  g.lineTo(26, 92);
  g.lineTo(14, 50);
  g.fill();
  g.restore();
}

function badger(g, pale) {
  g.save();
  // the head from the front: broad, tapering to the snout, a pale stripe down it
  const head = () => {
    g.beginPath();
    g.moveTo(-58, -40);
    g.quadraticCurveTo(0, -84, 58, -40);
    g.quadraticCurveTo(54, 30, 0, 86);
    g.quadraticCurveTo(-54, 30, -58, -40);
    g.closePath();
  };
  head();
  g.fill();
  g.fillStyle = pale;
  g.beginPath();
  g.moveTo(-12, -68);
  g.quadraticCurveTo(0, -72, 12, -68);
  g.lineTo(8, 60);
  g.quadraticCurveTo(0, 70, -8, 60);
  g.closePath();
  g.fill();
  for (const side of [-1, 1]) {
    g.beginPath();
    g.ellipse(side * 50, -54, 12, 15, side * 0.3, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(side * 58, -24);
    g.quadraticCurveTo(side * 40, 10, side * 30, 48);
    g.lineTo(side * 44, 10);
    g.closePath();
    g.fill();
  }
  g.fillStyle = '#111';
  g.beginPath();
  g.ellipse(0, 74, 9, 7, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

const BEASTS = { gryffindor: lion, slytherin: serpent, ravenclaw: eagle, hufflepuff: badger };

export function paintBanner(house, { w = 256, h = 768 } = {}) {
  const [main, second] = HOUSES[house].colours;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  // the cloth, swallow-tailed: outside it is clear (the material cuts it out)
  const notch = h * 0.09;
  const shape = (inset) => {
    g.beginPath();
    g.moveTo(inset, inset);
    g.lineTo(w - inset, inset);
    g.lineTo(w - inset, h - inset);
    g.lineTo(w / 2, h - notch - inset * 0.5);
    g.lineTo(inset, h - inset);
    g.closePath();
  };
  shape(0);
  g.fillStyle = second;
  g.fill();
  shape(12);
  const grad = g.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0, shade(main, 0.78));
  grad.addColorStop(0.5, main);
  grad.addColorStop(1, shade(main, 0.78));
  g.fillStyle = grad;
  g.fill();
  // the weave: faint threads up and across
  g.globalAlpha = 0.06;
  g.fillStyle = '#000';
  for (let x = 0; x < w; x += 3) g.fillRect(x, 0, 1, h);
  for (let y = 0; y < h; y += 4) g.fillRect(0, y, w, 1);
  g.globalAlpha = 1;
  // the shield, edged in the second colour, the beast on it
  const cx = w / 2;
  const cy = h * 0.42;
  const sw = w * 0.36;
  g.beginPath();
  g.moveTo(cx - sw, cy - sw * 1.1);
  g.lineTo(cx + sw, cy - sw * 1.1);
  g.lineTo(cx + sw, cy + sw * 0.2);
  g.quadraticCurveTo(cx + sw, cy + sw * 1.1, cx, cy + sw * 1.5);
  g.quadraticCurveTo(cx - sw, cy + sw * 1.1, cx - sw, cy + sw * 0.2);
  g.closePath();
  g.fillStyle = shade(main, 0.62);
  g.fill();
  g.lineWidth = 7;
  g.strokeStyle = second;
  g.stroke();
  g.save();
  g.translate(cx, cy + 6);
  g.scale((sw / 110) * 0.95, (sw / 110) * 0.95);
  g.fillStyle = second;
  BEASTS[house](g, shade(main, 1.3));
  g.restore();
  // a band across under the shield, and a second near the top
  g.fillStyle = second;
  g.fillRect(12, h * 0.75, w - 24, 10);
  g.fillRect(12, h * 0.08, w - 24, 6);
  return c;
}

export function createBanners(spots, { renderer = null, w = 2, h = 6.5 } = {}) {
  const group = new THREE.Group();
  group.name = 'hogwarts:banners';
  const geo = new THREE.PlaneGeometry(w, h, 1, 12);
  // hung from the top edge
  geo.translate(0, -h / 2, 0);
  const made = [];
  const byHouse = new Map();
  for (const s of spots) {
    if (!byHouse.has(s.house)) byHouse.set(s.house, []);
    byHouse.get(s.house).push(s);
  }
  for (const [house, list] of byHouse) {
    const tex = typeof document === 'undefined' ? null : canvasTexture(paintBanner(house), renderer, { wrap: false });
    const mat = new MeshStandardNodeMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.95, color: tex ? 0xffffff : new THREE.Color(HOUSES[house].colours[0]) });
    // the draught: the cloth swings more the further it hangs from its rod
    const hang = positionLocal.y.negate().div(h);
    const ph = float(instanceIndex).mul(1.93);
    const sway = sin(time.mul(0.7).add(ph).add(positionLocal.y.mul(0.5))).mul(0.16).add(sin(time.mul(1.3).add(ph.mul(2))).mul(0.05));
    mat.positionNode = positionLocal.add(vec3(sin(time.mul(0.4).add(ph)).mul(0.04).mul(hang), 0, sway.mul(hang)));
    const mesh = new THREE.InstancedMesh(geo, mat, list.length);
    const m4 = new THREE.Matrix4();
    list.forEach((s, i) => {
      m4.makeRotationY(s.ry ?? 0).setPosition(...s.at);
      mesh.setMatrixAt(i, m4);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    mesh.receiveShadow = true;
    group.add(mesh);
    made.push(mesh, mat, tex);
  }
  return {
    group,
    dispose() {
      geo.dispose();
      for (const x of made) x?.dispose?.();
      group.removeFromParent();
    },
  };
}

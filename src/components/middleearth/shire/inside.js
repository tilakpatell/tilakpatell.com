// Inside Bag End, the night after the party: the round parlour, panelled
// and beamed, a fire in the grate, Gandalf by it, and Bilbo's envelope on
// the mantelpiece. Built a little way under the world (nothing outside can
// be seen from in here), and lit by the fire. The steps (./rules.js's
// RING_STEPS) move the Ring: out of the envelope, into the fire, where the
// letters show, and out again with the tongs.

import * as THREE from 'three';
import { canvasTexture, hot } from '../../../lib/three/stage3dNodes';
import { fbm, makeCanvas, makeNoise, paintPixels } from '../../../lib/paint';
import { rng } from '../../../lib/texture';
import { makePerson } from './people';
import { castDo } from '../cast3d';

export const INSIDE = new THREE.Vector3(0, -60, 0);
const R = 4.6; // the room's radius
const H = 2.7; // to where the ceiling starts to curve

const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, ...o });
function put(parent, geo, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

// warm oak panelling below, plaster above, a dado rail between
function wallTexture(renderer) {
  const c = makeCanvas(512);
  const n = makeNoise(17);
  paintPixels(c, (u, v, out) => {
    const plank = Math.floor(u * 24);
    const grain = fbm(n, u * 24 * 0.2 + plank * 3.1, v * 30, { octaves: 3 });
    const seam = Math.min((u * 24) % 1, 1 - ((u * 24) % 1)) < 0.04 ? 0.55 : 1;
    if (v > 0.52) {
      const k = 0.62 + grain * 0.38;
      out[0] = 150 * k * seam;
      out[1] = 92 * k * seam;
      out[2] = 52 * k * seam;
    } else if (v > 0.49) {
      out[0] = 92;
      out[1] = 56;
      out[2] = 30;
    } else {
      const k = 0.9 + fbm(n, u * 6, v * 6, { octaves: 3 }) * 0.1;
      out[0] = 226 * k;
      out[1] = 208 * k;
      out[2] = 170 * k;
    }
  });
  return canvasTexture(c, renderer, { repeat: [3, 1] });
}
function floorTexture(renderer) {
  const c = makeCanvas(512);
  const n = makeNoise(29);
  paintPixels(c, (u, v, out) => {
    const board = Math.floor(v * 10);
    const off = (board * 0.37) % 1;
    const end = ((u + off) * 2) % 1 < 0.012;
    const grain = fbm(n, (u + off) * 4, v * 10 * 4 + board * 7, { octaves: 3 });
    const edge = (v * 10) % 1 < 0.05 || end ? 0.55 : 1;
    const k = (0.62 + grain * 0.38) * edge * (0.9 + (board % 3) * 0.05);
    out[0] = 128 * k;
    out[1] = 80 * k;
    out[2] = 46 * k;
  });
  return canvasTexture(c, renderer, { repeat: [2, 2] });
}
// The fire-letters, round the band: flowing strokes, as they show in the heat.
function lettersTexture(renderer) {
  const c = makeCanvas(1024, 64);
  const g = c.getContext('2d');
  g.clearRect(0, 0, 1024, 64);
  const rand = rng(7);
  g.strokeStyle = '#ffd27a';
  g.lineCap = 'round';
  g.lineWidth = 3.2;
  g.shadowColor = '#ff6a14';
  g.shadowBlur = 10;
  let x = 10;
  while (x < 1010) {
    const w = 14 + rand() * 18;
    g.beginPath();
    g.moveTo(x, 40);
    g.bezierCurveTo(x + w * 0.2, 14 + rand() * 10, x + w * 0.8, 14 + rand() * 10, x + w, 38);
    if (rand() < 0.5) {
      g.moveTo(x + w * 0.5, 38);
      g.lineTo(x + w * 0.5 + (rand() - 0.5) * 6, 50 + rand() * 8);
    }
    g.stroke();
    if (rand() < 0.55) {
      g.beginPath();
      g.arc(x + w * 0.5, 9 + rand() * 4, 2.2, 0, Math.PI * 2);
      g.fillStyle = '#ffd27a';
      g.fill();
    }
    x += w + 4 + rand() * 6;
  }
  return canvasTexture(c, renderer, { repeat: [1, 1] });
}

export function buildInside(renderer, { fx }) {
  const g = new THREE.Group();
  g.position.copy(INSIDE);

  // the room: panelled round wall, a domed and beamed ceiling, a board floor
  const wall = put(g, new THREE.CylinderGeometry(R, R, H, 48, 1, true), std({ map: wallTexture(renderer), side: THREE.BackSide, roughness: 0.8 }), 0, H / 2, 0);
  wall.castShadow = false;
  const dome = put(g, new THREE.SphereGeometry(R, 40, 12, 0, Math.PI * 2, 0, Math.PI / 2), std({ color: 0xe6d6b4, side: THREE.BackSide }), 0, H, 0);
  dome.scale.y = 0.42;
  dome.castShadow = false;
  const beam = std({ color: 0x5a3a20 });
  // the beams, from the wall up to the middle of the dome
  const arc = new THREE.TorusGeometry(R * 0.99, 0.09, 6, 20, Math.PI / 2);
  for (let i = 0; i < 8; i++) {
    const b = put(g, arc, beam, 0, H, 0);
    b.scale.set(1, 0.42, 1);
    b.rotation.y = (i / 8) * Math.PI * 2;
  }
  put(g, new THREE.TorusGeometry(R - 0.05, 0.08, 6, 48), beam, 0, H, 0).rotation.x = Math.PI / 2;
  const floor = put(g, new THREE.CircleGeometry(R, 48).rotateX(-Math.PI / 2), std({ map: floorTexture(renderer), roughness: 0.7 }), 0, 0.001, 0);
  floor.castShadow = false;
  // a round rug, red and gold
  put(g, new THREE.CircleGeometry(1.5, 40).rotateX(-Math.PI / 2), std({ color: 0x8a2a22, roughness: 1 }), 0, 0.012, 0.2).castShadow = false;
  put(g, new THREE.RingGeometry(1.15, 1.3, 40).rotateX(-Math.PI / 2), std({ color: 0xc8963a, roughness: 1 }), 0, 0.014, 0.2).castShadow = false;

  // the fireplace, on the north wall (-z): a stone arch, a hearth, logs
  const stone = std({ color: 0x8a7e70, roughness: 0.95, flatShading: true });
  const fp = new THREE.Group();
  fp.position.set(0, 0, -R + 0.45);
  g.add(fp);
  put(fp, new THREE.BoxGeometry(2.2, 1.6, 0.6), stone, 0, 0.8, -0.1);
  // the grate's dark mouth, in the face of the chimney breast; the fire
  // burns on the hearth in front of it
  const mouth = put(fp, new THREE.PlaneGeometry(1.2, 0.95), new THREE.MeshBasicMaterial({ color: 0x0c0604 }), 0, 0.5, 0.205);
  mouth.castShadow = false;
  put(fp, new THREE.TorusGeometry(0.62, 0.11, 6, 16, Math.PI), stone, 0, 0.95, 0.24);
  put(fp, new THREE.BoxGeometry(2.6, 0.16, 1.0), stone, 0, 0.08, 0.35);
  // the mantelpiece, with the envelope, a clock and candlesticks
  const oak = std({ color: 0x6a4224 });
  put(fp, new THREE.BoxGeometry(2.6, 0.12, 0.42), oak, 0, 1.66, 0.1);
  put(fp, new THREE.CylinderGeometry(0.12, 0.14, 0.32, 12), std({ color: 0x8a5a2a }), -0.9, 1.88, 0.1);
  put(fp, new THREE.CircleGeometry(0.09, 16), std({ color: 0xf2ead8 }), -0.9, 1.9, 0.23);
  for (const x of [0.75, 1.05]) {
    put(fp, new THREE.CylinderGeometry(0.03, 0.05, 0.22, 8), std({ color: 0xc8a050, metalness: 0.7, roughness: 0.35 }), x, 1.83, 0.1);
    put(fp, new THREE.CylinderGeometry(0.025, 0.025, 0.14, 8), std({ color: 0xf2ead8 }), x, 2.0, 0.1);
    put(fp, new THREE.SphereGeometry(0.025, 6, 5), new THREE.MeshBasicMaterial({ color: hot(0xffc870, 3) }), x, 2.1, 0.1);
  }
  const envelope = new THREE.Group();
  envelope.position.set(0.05, 1.83, 0.14);
  envelope.rotation.x = -0.25;
  put(envelope, new THREE.BoxGeometry(0.42, 0.28, 0.02), std({ color: 0xf4ecd8 }));
  put(envelope, new THREE.CylinderGeometry(0.045, 0.045, 0.02, 14).rotateX(Math.PI / 2), std({ color: 0xa01818, roughness: 0.5 }), 0, 0, 0.015);
  fp.add(envelope);
  const logs = std({ color: 0x3a2414 });
  for (const [x, r] of [[-0.25, 0.3], [0.22, -0.4], [0, 0.1]]) put(fp, new THREE.CylinderGeometry(0.07, 0.08, 0.7, 8).rotateZ(Math.PI / 2), logs, x * 0.4, 0.22, 0.34 + r * 0.05).rotation.y = r;

  // the furniture: an armchair by the fire, a table with a candle and
  // Bilbo's book, a bookcase, a round window, the round door
  const leather = std({ color: 0x7a3020, roughness: 0.6 });
  const chair = new THREE.Group();
  chair.position.set(-1.8, 0, -1.8);
  chair.rotation.y = 0.7;
  put(chair, new THREE.BoxGeometry(0.9, 0.42, 0.85), leather, 0, 0.21, 0);
  put(chair, new THREE.BoxGeometry(0.9, 0.9, 0.2), leather, 0, 0.75, -0.35);
  for (const s of [-1, 1]) put(chair, new THREE.BoxGeometry(0.16, 0.5, 0.8), leather, s * 0.45, 0.55, 0);
  g.add(chair);
  const table = new THREE.Group();
  table.position.set(1.9, 0, -1.2);
  put(table, new THREE.CylinderGeometry(0.6, 0.6, 0.06, 24), oak, 0, 0.72, 0);
  put(table, new THREE.CylinderGeometry(0.08, 0.14, 0.7, 10), oak, 0, 0.36, 0);
  put(table, new THREE.BoxGeometry(0.34, 0.07, 0.26), std({ color: 0x6a1a14 }), -0.1, 0.79, 0.1).rotation.y = 0.4;
  put(table, new THREE.CylinderGeometry(0.03, 0.03, 0.18, 8), std({ color: 0xf2ead8 }), 0.2, 0.84, -0.1);
  put(table, new THREE.SphereGeometry(0.03, 6, 5), new THREE.MeshBasicMaterial({ color: hot(0xffc870, 3) }), 0.2, 0.96, -0.1);
  g.add(table);
  const shelf = new THREE.Group();
  shelf.position.set(R - 0.5, 0, 0.6);
  shelf.rotation.y = -Math.PI / 2 - 0.15;
  put(shelf, new THREE.BoxGeometry(1.6, 2.0, 0.36), std({ color: 0x5a3a20 }), 0, 1.0, 0);
  const bookRand = rng(3);
  for (let row = 0; row < 4; row++)
    for (let i = 0; i < 9; i++) {
      const c = [0x7a2a1a, 0x2a4a6a, 0x3a5a2a, 0x8a6a2a, 0x5a2a4a][Math.floor(bookRand() * 5)];
      put(shelf, new THREE.BoxGeometry(0.13, 0.32 + bookRand() * 0.08, 0.26), std({ color: c }), -0.65 + i * 0.16, 0.36 + row * 0.47, 0.06);
    }
  g.add(shelf);
  const door = new THREE.Group();
  door.position.set(0, 0, R - 0.08);
  put(door, new THREE.CircleGeometry(1.05, 32), std({ color: 0x2e6b3a, side: THREE.DoubleSide }), 0, 1.05, 0).rotation.y = Math.PI;
  put(door, new THREE.SphereGeometry(0.07, 10, 8), std({ color: 0xd4a84a, metalness: 0.8, roughness: 0.3 }), 0, 1.05, -0.05);
  g.add(door);
  const win = new THREE.Group();
  win.position.set(-R + 0.1, 1.5, 1.2);
  win.rotation.y = Math.PI / 2 - 0.25;
  put(win, new THREE.CircleGeometry(0.55, 24), new THREE.MeshBasicMaterial({ color: hot(0x2a3a6a, 0.8) }));
  put(win, new THREE.TorusGeometry(0.56, 0.06, 6, 24), oak);
  put(win, new THREE.BoxGeometry(1.1, 0.05, 0.04), oak);
  put(win, new THREE.BoxGeometry(0.05, 1.1, 0.04), oak);
  g.add(win);

  // the light: the fire, and the candles, and a little moonlight
  const fireLight = new THREE.PointLight(0xff9a48, 14, 12, 1.6);
  fireLight.position.set(0, 0.7, -R + 1.0);
  fireLight.castShadow = false;
  g.add(fireLight);
  const fill = new THREE.PointLight(0xffc890, 2.4, 9, 2);
  fill.position.set(1.9, 1.6, -1.2);
  g.add(fill);

  // Gandalf by the fire
  const gandalf = makePerson('gandalf');
  gandalf.group.position.set(1.55, 0, -2.6);
  gandalf.group.rotation.y = -Math.PI / 2 - 0.5;
  g.add(gandalf.group);

  // the Ring, and its letters
  const ringMat = new THREE.MeshStandardMaterial({ color: 0xffcf5a, metalness: 1, roughness: 0.18, emissive: new THREE.Color(0xff6a14), emissiveIntensity: 0 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.02, 12, 40), ringMat);
  ring.visible = false;
  g.add(ring);
  const letters = new THREE.Mesh(
    new THREE.CylinderGeometry(0.098, 0.098, 0.034, 48, 1, true),
    new THREE.MeshBasicMaterial({ map: lettersTexture(renderer), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, color: hot(0xffffff, 2.4) }),
  );
  letters.rotation.x = Math.PI / 2;
  ring.add(letters);

  const world = (local) => local.clone().add(INSIDE);
  const HEARTH = new THREE.Vector3(0.06, 0.3, -R + 1.02);
  const PALM = new THREE.Vector3(0, 1.35, 0.9);
  const FIRE_AT = world(new THREE.Vector3(0, 0.26, -R + 0.8));
  const S = { step: 'envelope', t: 0, from: new THREE.Vector3(), heat: 0, glow: 0 };
  const tmp = new THREE.Vector3();
  const cam = { at: new THREE.Vector3(), look: new THREE.Vector3() };

  const update = (step, t, dt) => {
    if (step !== S.step) {
      S.from.copy(ring.visible ? ring.position : envelope.getWorldPosition(tmp).sub(INSIDE));
      S.step = step;
      S.t = 0;
    }
    S.t += dt;
    const k = Math.min(1, S.t / 1.1);
    const ease = k * k * (3 - 2 * k);
    envelope.visible = step === 'envelope';
    ring.visible = step !== 'envelope';
    if (step === 'fire') {
      // out of the envelope, into Frodo's hand
      ring.position.lerpVectors(S.from, PALM, ease);
      ring.rotation.set(t * 0.6, t * 0.9, 0);
      S.heat = Math.max(0, S.heat - dt);
    } else if (step === 'letters') {
      // tossed into the grate, glowing, and the letters coming up
      tmp.lerpVectors(S.from, HEARTH, ease);
      tmp.y += Math.sin(k * Math.PI) * 0.5;
      ring.position.copy(tmp);
      ring.rotation.set(Math.PI / 2, 0, t * 0.2);
      S.heat = Math.min(1, S.heat + dt * 0.45);
    } else if (step === 'safe') {
      tmp.lerpVectors(S.from, PALM, ease);
      ring.position.copy(tmp);
      ring.rotation.set(Math.PI / 2 - 0.9 * ease, t * 0.4, 0);
      S.heat = Math.max(0, S.heat - dt * 0.35);
    }
    ringMat.emissiveIntensity = S.heat * 2.6;
    ringMat.color.setRGB(1, 0.81 - S.heat * 0.2, 0.35 - S.heat * 0.2);
    letters.material.opacity = Math.max(0, Math.min(1, (S.heat - 0.55) * 3)) * (step === 'safe' ? Math.max(0, 1 - S.t * 0.4) : 1);
    // the fire, flickering
    fireLight.intensity = 12 + Math.sin(t * 13) * 1.5 + Math.sin(t * 29) * 1 + S.heat * 6;
    for (let i = 0; i < 2; i++) fx.flame(FIRE_AT, 0.4);
    // Gandalf leans on his staff and watches (on the cast: watches the Ring)
    gandalf.body.rotation.z = Math.sin(t * 0.8) * 0.03;
    gandalf.head.rotation.y = Math.sin(t * 0.5) * 0.25 - 0.2;
    castDo(gandalf, { look: ring.visible ? ring : null });
    // where the camera wants to be for this step
    if (step === 'letters') {
      cam.at.set(0.15, 0.85, -R + 2.05);
      cam.look.set(0.06, 0.3, -R + 1.02);
    } else if (step === 'envelope') {
      cam.at.set(-0.5, 1.75, -0.4);
      cam.look.set(0.1, 1.55, -R);
    } else {
      cam.at.set(0, 1.65, 1.9);
      cam.look.copy(ring.position);
    }
    cam.at.add(INSIDE);
    cam.look.add(INSIDE);
    return cam;
  };

  return { group: g, update, fireLight };
}

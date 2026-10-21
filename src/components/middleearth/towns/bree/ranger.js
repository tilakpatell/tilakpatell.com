// The man in the corner: Strider, as the hobbits first see him in the
// Prancing Pony. He sits back on the settle in the darkest corner of the
// room, one boot up on the bench and his hood drawn, so all you can make out
// is the glow of his pipe, and his eyes catching it when he draws on it. A
// Ranger's cloak, weathered and green-grey, falls round him and over the
// seat; long dark hair and a dark beard under the hood; a long-stemmed pipe
// in his gloved hand, and its smoke curling up into the beams.
//
// Made in code, as the rest of the Pony is. Faces +x, sitting on the settle
// at the origin. update(t, { watch, close }) makes him draw on the pipe (the
// ember brightens, the smoke rises, his eyes catch the light) and turn his
// head towards `watch`. `bowl` is where the pipe's light goes.

import * as THREE from 'three';
import { hot } from '../../../../lib/three/stage3dNodes';
import { fbm, makeCanvas, makeNoise, normalFromField, paintPixels } from '../../../../lib/paint';
import { B, ball, lathe, parts, tube } from '../../shire/props';
import { sharpen } from '../../../../lib/three/textures';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;

// Wool for the cloak: a coarse weave, darker in the creases, worn pale at
// the edges, with its relief for the light to catch.
function clothTextures(renderer, { base = [46, 56, 44], seed = 5, size = 256 } = {}) {
  const n = makeNoise(seed);
  const field = new Float32Array(size * size);
  const c = makeCanvas(size);
  paintPixels(c, (u, v, out, x, y) => {
    const weave = (Math.sin(u * size * 1.1) * Math.sin(v * size * 1.1)) * 0.5 + 0.5;
    const blotch = fbm(n, u * 6, v * 6, { period: 6, octaves: 4 });
    const fine = fbm(n, u * 48 + 3, v * 48, { period: 48, octaves: 2 });
    const h = weave * 0.25 + blotch * 0.5 + fine * 0.25;
    field[y * size + x] = h;
    const k = 0.62 + blotch * 0.55 + fine * 0.12 - weave * 0.06;
    out[0] = base[0] * k;
    out[1] = base[1] * k;
    out[2] = base[2] * k;
  });
  const tex = (canvas, srgb) => {
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(2, 2);
    t.anisotropy = Math.min(8, renderer.capabilities?.getMaxAnisotropy?.() ?? renderer.getMaxAnisotropy?.() ?? 1);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  return { map: tex(c, true), normalMap: tex(normalFromField(field, size, size, 2.6), false) };
}

// a soft puff, for the smoke
function puffTexture() {
  const c = makeCanvas(64);
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(235,228,215,0.85)');
  grad.addColorStop(0.45, 'rgba(210,205,195,0.35)');
  grad.addColorStop(1, 'rgba(200,195,185,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  sharpen(t);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// A cloth shell: a lathe swept round only part of the way (open at the
// front), with folds running down it and the hem uneven.
function drape(profile, { seg = 40, phi0, phiLen, folds = 9, depth = 0.035, seed = 3, ragged = 0.06 }) {
  const g = lathe(profile, seg, phi0, phiLen);
  const p = g.attributes.position;
  const n = makeNoise(seed);
  const top = Math.max(...profile.map((q) => q[1]));
  const bottom = Math.min(...profile.map((q) => q[1]));
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const a = Math.atan2(z, x);
    const r = Math.hypot(x, z);
    const down = (top - y) / (top - bottom || 1); // 0 at the shoulders, 1 at the hem
    const fold = Math.sin(a * folds + n(a * 3, y * 2) * 2.4) * depth * (0.25 + down);
    const rr = r + fold;
    let yy = y;
    if (down > 0.92) yy -= n(a * 7.3, 2) * ragged * (down - 0.92) * 12;
    p.setXYZ(i, Math.cos(a) * rr, yy, Math.sin(a) * rr);
  }
  g.computeVertexNormals();
  return g;
}

export function makeStrider(renderer) {
  const g = new THREE.Group();
  g.name = 'strider-corner';
  const cloth = clothTextures(renderer);
  const cloak = new THREE.MeshStandardMaterial({ color: 0xffffff, map: cloth.map, normalMap: cloth.normalMap, normalScale: new THREE.Vector2(0.8, 0.8), roughness: 0.94, side: THREE.DoubleSide });
  const hoodIn = new THREE.MeshStandardMaterial({ color: 0x0a0b09, roughness: 1, side: THREE.BackSide });
  const leather = new THREE.MeshStandardMaterial({ color: 0x3a281a, roughness: 0.62, metalness: 0.05 });
  const boot = new THREE.MeshStandardMaterial({ color: 0x2a1c12, roughness: 0.5, metalness: 0.05 });
  const cloth2 = new THREE.MeshStandardMaterial({ color: 0x3a3226, roughness: 0.9 });
  const skin = new THREE.MeshStandardMaterial({ color: 0x8a6249, roughness: 0.66 });
  const hair = new THREE.MeshStandardMaterial({ color: 0x1c140e, roughness: 0.85 });
  const oak = new THREE.MeshStandardMaterial({ color: 0x3a2516, roughness: 0.7 });
  const pipeWood = new THREE.MeshStandardMaterial({ color: 0x5a3a20, roughness: 0.45 });

  // the settle he sits on: a high-backed bench in the corner
  const bk = parts();
  bk.add(oak, B(0.62, 0.08, 1.5), { p: [-0.05, 0.46, 0] });
  bk.add(oak, B(0.08, 1.55, 1.56), { p: [-0.36, 0.78, 0] });
  for (const s of [-1, 1]) {
    bk.add(oak, B(0.62, 0.5, 0.06), { p: [-0.05, 0.22, s * 0.74] });
    bk.add(oak, B(0.5, 0.06, 0.08), { p: [0.02, 0.78, s * 0.76] });
    bk.add(oak, B(0.06, 0.32, 0.06), { p: [0.24, 0.62, s * 0.76] });
  }
  bk.add(oak, B(0.1, 0.08, 1.62), { p: [-0.36, 1.58, 0] });
  // and a stool for the boot he has up
  bk.add(oak, B(0.32, 0.05, 0.32), { p: [0.6, 0.46, 0.22] });
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) bk.add(oak, B(0.04, 0.44, 0.04), { p: [0.6 + dx * 0.12, 0.22, 0.22 + dz * 0.12] });

  // legs: the left down, its boot on the floor; the right up, its boot on the bench
  const leg = (pts, r0, r1, mat) => bk.add(mat, tube(pts, r0, r1, { seg: 10, radial: 10 }));
  leg([[0.0, 0.56, -0.15], [0.26, 0.56, -0.17], [0.46, 0.54, -0.18]], 0.1, 0.085, cloth2);
  leg([[0.46, 0.54, -0.18], [0.5, 0.3, -0.18], [0.5, 0.1, -0.19]], 0.08, 0.07, boot);
  bk.add(boot, B(0.26, 0.1, 0.12), { p: [0.57, 0.05, -0.19], r: [0, 0, 0.05] });
  leg([[0.0, 0.56, 0.15], [0.2, 0.78, 0.18], [0.34, 0.98, 0.2]], 0.1, 0.085, cloth2);
  leg([[0.34, 0.98, 0.2], [0.46, 0.76, 0.22], [0.52, 0.58, 0.22]], 0.08, 0.07, boot);
  bk.add(boot, B(0.26, 0.1, 0.12), { p: [0.6, 0.53, 0.22], r: [0, 0, 0.1] });
  // a turned-down boot top on each
  bk.add(boot, tube([[0.46, 0.42, -0.18], [0.5, 0.4, -0.18]], 0.1, 0.1, { seg: 2, radial: 12 }));
  bk.add(boot, tube([[0.4, 0.86, 0.21], [0.43, 0.82, 0.21]], 0.1, 0.1, { seg: 2, radial: 12 }));

  // the body, leaning back into the settle
  const body = new THREE.Group();
  body.position.set(-0.02, 0.56, 0);
  body.rotation.z = 0.16;
  g.add(body);
  const bb = parts();
  bb.add(leather, lathe([[0.001, 0], [0.2, 0], [0.22, 0.2], [0.25, 0.48], [0.25, 0.66], [0.19, 0.8], [0.09, 0.86], [0.001, 0.88]], 18), { s: [0.82, 1, 1] });
  // a belt, its buckle, and a strap across the chest
  bb.add(leather, tube([[0, 0.12, -0.21], [0.19, 0.12, 0], [0, 0.12, 0.21]], 0.03, 0.03, { seg: 8, radial: 6 }));
  bb.add(new THREE.MeshStandardMaterial({ color: 0x8a7a5a, metalness: 0.8, roughness: 0.35 }), B(0.03, 0.06, 0.08), { p: [0.19, 0.12, 0] });
  bb.add(boot, tube([[0.12, 0.72, -0.17], [0.2, 0.42, 0], [0.12, 0.14, 0.18]], 0.025, 0.025, { seg: 8, radial: 5 }));
  // the cloak: round his shoulders and back, falling over the seat to the floor
  bb.add(cloak, drape([[0.27, 0.83], [0.34, 0.7], [0.4, 0.42], [0.48, 0.1], [0.56, -0.22], [0.6, -0.5]], { seg: 44, phi0: Math.PI * 0.62, phiLen: Math.PI * 1.32, folds: 11, depth: 0.04, seed: 9 }), { s: [0.95, 1, 1.15] });
  bb.add(cloak, drape([[0.2, 0.9], [0.3, 0.82], [0.36, 0.66], [0.4, 0.52]], { seg: 36, phi0: Math.PI * 0.45, phiLen: Math.PI * 1.7, folds: 7, depth: 0.025, seed: 4 }), { s: [0.95, 1, 1.12] });
  // arms: the left on the raised knee, the right lifting the pipe
  const arm = (pts) => {
    bb.add(cloak, tube(pts, 0.085, 0.07, { seg: 12, radial: 10 }));
  };
  arm([[0.02, 0.76, -0.25], [0.12, 0.52, -0.32], [0.3, 0.42, -0.14], [0.4, 0.43, 0.08]]);
  arm([[0.02, 0.76, 0.25], [0.12, 0.52, 0.34], [0.32, 0.6, 0.36], [0.44, 0.74, 0.26]]);
  // gloves
  bb.add(leather, ball(0.07, 12, 10), { p: [0.43, 0.44, 0.1], s: [1.3, 0.8, 1] });
  bb.add(leather, ball(0.065, 12, 10), { p: [0.47, 0.77, 0.24], s: [1.1, 1, 0.9] });
  bb.build(body);
  bk.build(g);

  // ── the head, in the hood ──
  const head = new THREE.Group();
  head.position.set(0.06, 1.68, 0);
  g.add(head);
  const hk = parts();
  hk.add(skin, ball(0.26, 24, 18), { s: [0.95, 1, 0.92] });
  // the beard and moustache: dark, round the jaw and over the lip
  // (a sphere's +x half is phi π/2…3π/2; this is the lower front of it)
  const beard = new THREE.SphereGeometry(0.268, 28, 14, Math.PI * 0.6, Math.PI * 0.8, Math.PI * 0.52, Math.PI * 0.45);
  hk.add(hair, beard, { s: [0.98, 1, 0.96] });
  // a moustache that droops into it
  for (const s2 of [-1, 1]) hk.add(hair, tube([[0.25, -0.05, 0], [0.245, -0.07, s2 * 0.06], [0.22, -0.13, s2 * 0.09]], 0.026, 0.014, { seg: 6, radial: 6 }));
  // long hair falling from under the hood, either side
  for (const s of [-1, 1]) {
    for (let k = 0; k < 3; k++) hk.add(hair, tube([[0.02 - k * 0.07, 0.12, s * 0.24], [0.04 - k * 0.07, -0.12, s * 0.27], [-0.02 - k * 0.08, -0.36, s * (0.22 + k * 0.02)]], 0.04, 0.012, { seg: 8, radial: 6, seed: k + s * 5 }));
  }
  // the hood: a cowl over his head and down to his shoulders, open only
  // where his face is, its brim standing out past his brow, peaked behind
  const hood = new THREE.SphereGeometry(0.35, 40, 28, 0, TAU, 0, Math.PI * 0.78);
  {
    // cut the face opening first, while the dome is still round
    const idx = hood.index.array;
    const pos = hood.attributes.position;
    const keep = [];
    const c = V3();
    for (let i = 0; i < idx.length; i += 3) {
      c.set(0, 0, 0);
      for (let k = 0; k < 3; k++) c.add(V3(pos.getX(idx[i + k]), pos.getY(idx[i + k]), pos.getZ(idx[i + k])));
      c.multiplyScalar(1 / 3);
      const ang = Math.atan2(Math.abs(c.z), c.x); // 0 straight ahead
      const face = c.x > 0 && ang < 0.62 && c.y < 0.1 && c.y > -0.32;
      if (!face) keep.push(idx[i], idx[i + 1], idx[i + 2]);
    }
    hood.setIndex(keep);
    const hp = hood.attributes.position;
    for (let i = 0; i < hp.count; i++) {
      let x = hp.getX(i);
      let y = hp.getY(i);
      const z = hp.getZ(i);
      // the brim: the front edge drawn forward and down over his brow
      if (x > 0) {
        const k = x / 0.35;
        x += k * k * k * 0.2;
        if (y > 0) y -= k * k * 0.06;
      }
      // a peak at the back, the cloth sagging into it
      if (x < 0 && y > 0.1) {
        const k = (-x / 0.35) * (y / 0.35);
        x -= k * 0.17;
        y += k * 0.09;
      }
      // seen from the front a cowl, not a ball: close at the sides of his
      // head, drawn up to a soft point over it, and falling wide below
      // over his neck and on to his shoulders
      let w = 0.84;
      if (y > 0.12) {
        const k = (y - 0.12) / 0.3;
        y += k * k * 0.12;
        w *= 1 - Math.min(0.7, k * 0.55);
      }
      if (y < -0.08) {
        const k = (-0.08 - y) / 0.2;
        y -= k * 0.16;
        w *= 1 + k * 0.75;
        x -= k * 0.05;
      }
      hp.setXYZ(i, x, y, z * w);
    }
    hood.computeVertexNormals();
  }
  const lining = hood.clone();
  hk.add(cloak, hood, { p: [-0.03, 0.03, 0] });
  hk.add(hoodIn, lining, { p: [-0.03, 0.03, 0], s: [0.98, 0.98, 0.98] });
  hk.build(head);
  // the shadow the hood throws over his brow: a dark band inside the brim
  // (a dark veil over his face down to his cheeks, fading out below them,
  // so the pipe lights only his jaw and the ember catches his eyes)
  const veil = new THREE.SphereGeometry(0.262, 28, 14, -Math.PI * 0.5, Math.PI, 0, Math.PI * 0.62);
  {
    const vp = veil.attributes.position;
    const a = new Float32Array(vp.count * 4);
    for (let i = 0; i < vp.count; i++) {
      const y = vp.getY(i) / 0.262;
      a.set([0, 0, 0, Math.min(1, Math.max(0, (y + 0.42) * 2.2)) * 0.9], i * 4);
    }
    veil.setAttribute('color', new THREE.BufferAttribute(a, 4));
  }
  const shade = new THREE.Mesh(veil, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false }));
  shade.rotation.y = Math.PI; // the half-sphere turned to cover his face (+x)
  shade.scale.set(0.97, 1.01, 0.95);
  head.add(shade);
  // his eyes, under the brow: dark, with a glint that the ember lights
  const glint = new THREE.MeshBasicMaterial({ color: hot(0xffd2a0, 1.2), transparent: true });
  const eyeDark = new THREE.MeshStandardMaterial({ color: 0x120c08, roughness: 0.2 });
  const glints = [];
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 8), eyeDark);
    e.position.set(0.238, 0.02, s * 0.08);
    head.add(e);
    const gl = new THREE.Mesh(new THREE.SphereGeometry(0.0055, 6, 5), glint);
    gl.position.set(0.259, 0.026, s * 0.076);
    head.add(gl);
    glints.push(gl);
  }

  // ── the pipe: a long stem from his mouth to the bowl in his hand ──
  const pipe = new THREE.Group();
  pipe.position.set(0.24, -0.12, 0.05);
  head.add(pipe);
  const pk = parts();
  pk.add(pipeWood, tube([[0, 0, 0], [0.14, -0.06, 0.04], [0.3, -0.17, 0.1], [0.4, -0.27, 0.15]], 0.012, 0.016, { seg: 12, radial: 6 }));
  pk.add(pipeWood, lathe([[0.012, 0], [0.034, 0.01], [0.04, 0.06], [0.036, 0.085], [0.028, 0.085], [0.026, 0.02]], 14), { p: [0.41, -0.33, 0.155] });
  pk.build(pipe);
  const emberMat = new THREE.MeshBasicMaterial({ color: hot(0xff6a1a, 2) });
  const ember = new THREE.Mesh(new THREE.CircleGeometry(0.027, 14).rotateX(-Math.PI / 2), emberMat);
  ember.position.set(0.41, -0.255, 0.155);
  pipe.add(ember);
  const bowl = V3();

  // ── smoke: from the bowl, and a breath of it from his mouth ──
  const puff = puffTexture();
  const smoke = [];
  for (let i = 0; i < 12; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puff, color: 0xd8d0c4, transparent: true, depthWrite: false, opacity: 0 }));
    s.renderOrder = 5;
    g.add(s);
    smoke.push({ s, t: i / 12 });
  }

  const A = { draw: 0, look: 0 };
  const from = V3();
  const mouth = V3();
  const update = (t, { watch = null, close = false } = {}) => {
    // a draw on the pipe every few seconds: the ember flares, then fades
    const cycle = (t % 5.2) / 5.2;
    const draw = cycle < 0.28 ? Math.sin((cycle / 0.28) * Math.PI) : 0;
    A.draw = draw;
    emberMat.color.copy(hot(0xff5a14, 1.2 + draw * 3.4 + Math.sin(t * 13) * 0.08));
    glint.opacity = 0.25 + draw * 0.75;
    // the head: slowly towards whoever he's watching
    let want = 0.25;
    if (watch) {
      const local = g.worldToLocal(watch.clone());
      want = Math.max(-0.7, Math.min(0.7, Math.atan2(-local.z, local.x)));
    }
    // by the clock, so the turn takes the same time at 30 or 120 frames a second
    A.look += (want - A.look) * (1 - Math.exp(-(t - (A.t ?? t)) * 2.4));
    A.t = t;
    head.rotation.y = A.look;
    head.rotation.z = -0.08 - draw * 0.06;
    // where the bowl is now (for the light), and the smoke
    ember.getWorldPosition(bowl);
    g.worldToLocal(from.copy(bowl));
    pipe.localToWorld(mouth.set(0, 0, 0));
    g.worldToLocal(mouth);
    for (const p of smoke) {
      p.t = (p.t + 0.0035 * (close ? 1 : 0.8)) % 1;
      const k = p.t;
      const exhale = (p.s.id % 3 === 0);
      const o = exhale ? mouth : from;
      p.s.position.set(o.x + 0.05 + k * 0.18 + Math.sin(t * 0.8 + k * 6 + p.s.id) * 0.05 * k, o.y + k * 0.9, o.z + Math.cos(t * 0.6 + k * 5 + p.s.id) * 0.06 * k);
      const size = 0.06 + k * 0.32;
      p.s.scale.set(size, size, 1);
      p.s.material.opacity = Math.sin(k * Math.PI) * (exhale ? 0.22 * (1 - cycle) : 0.32);
    }
    return A.draw;
  };

  // nothing here moves but the head, the pipe and the smoke: everything
  // casts and takes shadows
  g.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = o.material !== emberMat && !o.material.transparent;
      o.receiveShadow = true;
    }
  });
  return { group: g, head, ember, bowl, update, get draw() { return A.draw; } };
}

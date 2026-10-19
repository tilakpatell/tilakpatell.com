// The Middle-earth scenes' common parts that hold no shader, shared by
// ./kit.js (their GLSL materials, on the classic renderer) and
// ./nodes/kit.js (the same in TSL, on the node renderer): painted stone and
// charred hide, the particles' colour ramps and their pool, and the figures
// (a wizard, a Balrog, hobbits and orcs).

import * as THREE from 'three';
import { canvasTexture, hot } from '../../lib/three/stage3dNodes';
import { clamp01, fbm, makeCanvas, makeCells, makeNoise, mix, normalFromField, paintPixels, smooth } from '../../lib/paint';
import { createStride, createTracker, footAt, legRig } from './creatures';
// ── painted textures ──

// (main's ./stoneTextures.js, the Road's too, re-exported as kit.js re-exports it)
export { stoneTextures } from './stoneTextures';

// A Balrog's hide: charred plates, and fire showing in the cracks between.
function magmaTextures(renderer, { seed = 7, size = 256, repeat = [2, 2] } = {}) {
  const n = makeNoise(seed);
  const cells = makeCells(seed + 5);
  const field = new Float32Array(size * size);
  const glow = makeCanvas(size);
  const gctx = glow.getContext('2d');
  const g = gctx.createImageData(size, size);
  const c = makeCanvas(size);
  paintPixels(c, (u, v, out, x, y) => {
    const k = cells(u * 5, v * 5, 5);
    const heat = fbm(n, u * 3, v * 3, { period: 3, octaves: 3 });
    const edge = k.f2 - k.f1;
    const plate = smooth(0, 0.16, edge);
    const vein = (1 - smooth(0, 0.012 + heat * 0.05, edge)) * smooth(0.5, 0.78, heat);
    const grain = fbm(n, u * 24, v * 24, { period: 24, octaves: 2 });
    field[y * size + x] = plate * (0.7 + grain * 0.3);
    const shade = 12 + plate * 24 + grain * 14 + k.id * 10;
    out[0] = shade * 1.15;
    out[1] = shade * 0.9;
    out[2] = shade * 0.82;
    const i = (y * size + x) * 4;
    g.data[i] = 255 * vein;
    g.data[i + 1] = 255 * vein * (0.16 + 0.3 * vein);
    g.data[i + 2] = 255 * vein * 0.05;
    g.data[i + 3] = 255;
  });
  gctx.putImageData(g, 0, 0);
  return {
    map: canvasTexture(c, renderer, { repeat }),
    emissiveMap: canvasTexture(glow, renderer, { repeat }),
    normalMap: canvasTexture(normalFromField(field, size, size, 3.5), renderer, { repeat, srgb: false }),
  };
}

// ── particles ──

// Colour over a particle's life: [t, r, g, b, a] stops. Above 1 blooms.
export const FIRE = [
  [0, 2.6, 2.0, 1.1, 0],
  [0.08, 2.8, 1.5, 0.4, 0.85],
  [0.45, 1.7, 0.45, 0.06, 0.6],
  [1, 0.3, 0.03, 0, 0],
];
export const EMBER = [
  [0, 3, 1.6, 0.4, 0],
  [0.1, 3, 1.2, 0.2, 1],
  [0.7, 1.6, 0.35, 0.03, 0.8],
  [1, 0.4, 0.04, 0, 0],
];
export const SMOKE = [
  [0, 0.05, 0.035, 0.03, 0],
  [0.2, 0.03, 0.022, 0.02, 0.5],
  [1, 0.012, 0.01, 0.01, 0],
];
export const LIGHT = [
  [0, 3, 3.4, 4, 1],
  [0.4, 1.6, 2.2, 3.2, 0.7],
  [1, 0.4, 0.7, 1.4, 0],
];

function lut(stops, n = 48) {
  const out = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    let k = 1;
    while (k < stops.length - 1 && stops[k][0] < t) k += 1;
    const a = stops[k - 1];
    const b = stops[k];
    const f = clamp01((t - a[0]) / (b[0] - a[0] || 1));
    for (let j = 0; j < 4; j++) out[i * 4 + j] = mix(a[j + 1], b[j + 1], f);
  }
  return out;
}

// A pool of soft billboards (instanced quads, so they can be any size on
// screen). emit() adds one; step() ages, moves and redraws them. The
// material is the renderer's kind's (makeMaterial({ stretch, additive })):
// ./kit.js's on the classic renderer, ./nodes/kit.js's on the node one.
export function particlePool(makeMaterial, max, { ramp = FIRE, additive = true, stretch = 1, gravity = 0, drag = 0.6, swirl = 0 } = {}) {
  const quad = new THREE.PlaneGeometry(1, 1);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = quad.index;
  geo.setAttribute('position', quad.getAttribute('position'));
  const at = new Float32Array(max * 4);
  const co = new Float32Array(max * 4);
  const aAt = new THREE.InstancedBufferAttribute(at, 4).setUsage(THREE.DynamicDrawUsage);
  const aCo = new THREE.InstancedBufferAttribute(co, 4).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aAt', aAt);
  geo.setAttribute('aColor', aCo);
  geo.instanceCount = 0;
  const material = makeMaterial({ stretch, additive });
  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = additive ? 3 : 2;

  const table = lut(ramp);
  const N = table.length / 4;
  // x y z, vx vy vz, age life, size0 size1, gain, seed
  const P = new Float32Array(max * 12);
  let count = 0;

  const emit = (x, y, z, vx, vy, vz, life, s0, s1 = s0, gain = 1) => {
    if (count >= max) return;
    const i = count * 12;
    P[i] = x;
    P[i + 1] = y;
    P[i + 2] = z;
    P[i + 3] = vx;
    P[i + 4] = vy;
    P[i + 5] = vz;
    P[i + 6] = 0;
    P[i + 7] = life;
    P[i + 8] = s0;
    P[i + 9] = s1;
    P[i + 10] = gain;
    P[i + 11] = Math.random() * 6.283;
    count += 1;
  };

  const step = (dt) => {
    const damp = Math.max(0, 1 - drag * dt);
    for (let n = 0; n < count; n++) {
      const i = n * 12;
      P[i + 6] += dt;
      if (P[i + 6] >= P[i + 7]) {
        count -= 1;
        P.copyWithin(i, count * 12, count * 12 + 12);
        n -= 1;
        continue;
      }
      const k = P[i + 6] / P[i + 7];
      if (swirl) {
        P[i + 3] += Math.sin(P[i + 11] + P[i + 6] * 2.3) * swirl * dt;
        P[i + 5] += Math.cos(P[i + 11] * 1.7 + P[i + 6] * 1.9) * swirl * dt;
      }
      P[i + 4] += gravity * dt;
      P[i + 3] *= damp;
      P[i + 4] *= damp;
      P[i + 5] *= damp;
      P[i] += P[i + 3] * dt;
      P[i + 1] += P[i + 4] * dt;
      P[i + 2] += P[i + 5] * dt;
      const o = n * 4;
      at[o] = P[i];
      at[o + 1] = P[i + 1];
      at[o + 2] = P[i + 2];
      at[o + 3] = mix(P[i + 8], P[i + 9], k);
      const c = Math.min(N - 1, Math.floor(k * (N - 1))) * 4;
      const gain = P[i + 10];
      co[o] = table[c] * gain;
      co[o + 1] = table[c + 1] * gain;
      co[o + 2] = table[c + 2] * gain;
      co[o + 3] = table[c + 3];
    }
    geo.instanceCount = count;
    aAt.needsUpdate = true;
    aCo.needsUpdate = true;
  };

  return {
    mesh,
    emit,
    step,
    clear() {
      count = 0;
      geo.instanceCount = 0;
    },
    get count() {
      return count;
    },
  };
}

// ── shapes ──

const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, ...o });
const solid = (geo, mat, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
};
const lathe = (profile, seg = 16) =>
  new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(r, y)),
    seg,
  );
const UP = new THREE.Vector3(0, 1, 0);

// A tapered limb from a to b.
function limb(a, b, r0, r1, mat, radial = 8) {
  const A = new THREE.Vector3(...a);
  const B = new THREE.Vector3(...b);
  const m = solid(new THREE.CylinderGeometry(r1, r0, A.distanceTo(B), radial), mat);
  m.position.copy(A).add(B).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(UP, B.clone().sub(A).normalize());
  return m;
}

// A tube along a curve through `points`, thinning from r0 to r1.
function taperedTube(points, { segments = 18, radial = 7, r0 = 0.2, r1 = 0.02 } = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const g = new THREE.TubeGeometry(curve, segments, 1, radial, false);
  const pos = g.attributes.position;
  const c = new THREE.Vector3();
  const v = new THREE.Vector3();
  for (let i = 0; i <= segments; i++) {
    curve.getPointAt(i / segments, c);
    const r = mix(r0, r1, i / segments);
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j;
      v.fromBufferAttribute(pos, k).sub(c).multiplyScalar(r).add(c);
      pos.setXYZ(k, v.x, v.y, v.z);
    }
  }
  return g;
}

// A wing's skin: panels fanning out from the wrist W between each pair of
// rim points, the free edge scalloped and the skin bellied a little.
function membrane(W, rim, n = 7, m = 4) {
  const pos = [];
  const idx = [];
  const w = new THREE.Vector3(...W);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const nor = new THREE.Vector3();
  const p = new THREE.Vector3();
  for (let k = 0; k < rim.length - 1; k++) {
    a.set(...rim[k]).sub(w);
    b.set(...rim[k + 1]).sub(w);
    nor.crossVectors(a, b).normalize();
    const base = pos.length / 3;
    for (let i = 0; i <= n; i++) {
      const s = i / n;
      const sag = 1 - 0.26 * Math.sin(Math.PI * s);
      for (let j = 0; j <= m; j++) {
        const r = (j / m) * sag;
        p.copy(a)
          .lerp(b, s)
          .multiplyScalar(r)
          .add(w)
          .addScaledVector(nor, 0.4 * Math.sin(Math.PI * s) * (j / m));
        pos.push(p.x, p.y, p.z);
      }
    }
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < m; j++) {
        const a0 = base + i * (m + 1) + j;
        const b0 = a0 + m + 1;
        idx.push(a0, b0, a0 + 1, a0 + 1, b0, b0 + 1);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// ── the figures ──

// Gandalf, 1.9 tall with the hat, facing -x. The staff is in the hand
// nearer the camera (+z), Glamdring in the other.
export function makeGandalf() {
  const g = new THREE.Group();
  const cloth = std({ color: 0x7a7f89 });
  const hatCloth = std({ color: 0x666b75 });
  const skin = std({ color: 0xd9c3a5, roughness: 0.7 });
  const hair = std({ color: 0xe9e8e2, roughness: 1 });
  const wood = std({ color: 0x5b452e, roughness: 0.8 });

  const body = new THREE.Group();
  g.add(body);
  body.add(
    solid(
      lathe([
        [0.001, 0],
        [0.46, 0],
        [0.42, 0.28],
        [0.3, 0.9],
        [0.24, 1.24],
        [0.28, 1.42],
        [0.15, 1.53],
        [0.001, 1.55],
      ]),
      cloth,
    ),
  );
  body.add(solid(new THREE.SphereGeometry(0.13, 14, 10), skin, -0.02, 1.67, 0));
  body.add(solid(new THREE.SphereGeometry(0.14, 12, 10), hair, 0.045, 1.68, 0));
  const beard = solid(new THREE.ConeGeometry(0.115, 0.44, 10), hair, -0.11, 1.44, 0);
  beard.rotation.z = Math.PI - 0.2;
  body.add(beard);
  const hat = new THREE.Group();
  hat.add(solid(new THREE.CylinderGeometry(0.34, 0.37, 0.03, 20), hatCloth, 0, 1.78, 0));
  const cone = solid(new THREE.ConeGeometry(0.18, 0.64, 14), hatCloth, 0.04, 2.08, 0);
  cone.rotation.z = -0.14;
  hat.add(cone);
  body.add(hat);

  // the staff arm
  body.add(limb([-0.04, 1.4, 0.24], [-0.4, 1.28, 0.36], 0.11, 0.07, cloth));
  const staff = new THREE.Group();
  staff.position.set(-0.42, 1.26, 0.37);
  // (a staff in a hand, gripped at its origin: lib/three/held.js's kinds)
  staff.userData.held = { kind: 'staff' };
  const grip = new THREE.Object3D();
  grip.name = 'grip';
  staff.add(grip);
  staff.add(solid(new THREE.CylinderGeometry(0.022, 0.03, 2.3, 7), wood, 0, -0.1, 0));
  const gnarl = solid(new THREE.TorusGeometry(0.07, 0.022, 6, 10), wood, 0, 1.06, 0);
  gnarl.rotation.y = Math.PI / 2;
  staff.add(gnarl);
  const crystalMat = new THREE.MeshBasicMaterial({ color: hot(0xdfeaff, 3) });
  staff.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.055, 1), crystalMat).translateY(1.06));
  const light = new THREE.PointLight(0xcfe0ff, 12, 18, 2);
  light.position.y = 1.1;
  staff.add(light);
  g.add(staff);

  // the sword arm
  body.add(limb([-0.04, 1.4, -0.24], [-0.36, 1.2, -0.34], 0.11, 0.07, cloth));
  const blade = solid(
    new THREE.BoxGeometry(0.022, 0.95, 0.07),
    new THREE.MeshStandardMaterial({
      color: 0xcfd8e6,
      metalness: 0.9,
      roughness: 0.25,
      emissive: 0x7fa8ff,
      emissiveIntensity: 0.7,
    }),
    -0.66,
    1.5,
    -0.36,
  );
  blade.rotation.z = 0.85;
  body.add(blade);

  let white = false;
  const setWhite = (on) => {
    white = on;
    cloth.color.set(on ? 0xf2f1ea : 0x7a7f89);
    cloth.emissive.set(on ? 0x3a3a36 : 0x000000);
    wood.color.set(on ? 0xeeeade : 0x5b452e);
    hat.visible = !on;
  };

  // raise: the staff lifted against the whip; slam: 1 as it comes down on the bridge
  const animate = ({ t, raise = 0, slam = 0, glow = 0, lean = 0 }) => {
    const lift = raise * 0.5 + Math.sin(Math.min(1, slam * 1.6) * Math.PI) * 0.55;
    staff.position.y = 1.26 + lift;
    staff.rotation.z = raise * 0.38 - slam * 0.1;
    body.scale.y = 1 + Math.sin(t * 1.4) * 0.006;
    body.rotation.z = -lean * 0.3;
    light.intensity = (white ? 26 : 12) + raise * 50 + glow * 160 + Math.sin(t * 7) * 0.8;
    crystalMat.color.setScalar(1).multiply(hot(0xdfeaff, 3 + raise * 3 + glow * 6));
  };

  return { group: g, staff, light, setWhite, animate };
}

// The Balrog: about seven units to the top of its head, more to the horns,
// facing +x. Shadow and flame: a charred body with fire in the cracks, great
// wings behind, a sword of flame in one hand and the whip hand free (the
// scene draws the whip). `flames` are the places the fire rises from.
// animate({ t, spread, raise, lash, roar, flare }): its walk is read from
// where the scene puts it (./creatures.js), each foot held where it comes
// down while the other comes through, however fast it crosses; `steps`
// counts its footfalls (for the shake and the embers), `stride` and
// `moving` are no longer needed.
export function makeBalrog(renderer) {
  const tex = magmaTextures(renderer);
  const skin = new THREE.MeshStandardMaterial({
    map: tex.map,
    normalMap: tex.normalMap,
    normalScale: new THREE.Vector2(1.4, 1.4),
    roughness: 0.82,
    metalness: 0.05,
    emissive: new THREE.Color(1, 1, 1),
    emissiveMap: tex.emissiveMap,
    emissiveIntensity: 2,
  });
  const horn = std({ color: 0x2b1e17, roughness: 0.55 });
  const web = new THREE.MeshStandardMaterial({
    color: 0x120a08,
    roughness: 0.95,
    side: THREE.DoubleSide,
    emissive: 0x3a0d02,
    emissiveIntensity: 0.6,
  });
  const fireMat = new THREE.MeshBasicMaterial({ color: hot(0xff9a32, 2.6) });
  const eyeMat = new THREE.MeshBasicMaterial({ color: hot(0xffe27a, 4) });
  const flames = [];
  const flame = (parent, x, y, z, rate, size) => {
    const o = new THREE.Object3D();
    o.position.set(x, y, z);
    parent.add(o);
    flames.push({ at: o, rate, size, acc: 0 });
    return o;
  };

  const g = new THREE.Group();
  const hips = new THREE.Group();
  hips.position.y = 3.05;
  g.add(hips);
  hips.add(solid(new THREE.SphereGeometry(0.9, 14, 10).scale(0.95, 0.8, 1.05), skin));

  const legs = [1, -1].map((s) => {
    const leg = new THREE.Group();
    leg.position.set(0, -0.15, 0.55 * s);
    hips.add(leg);
    leg.add(limb([0, 0, 0], [0.35, -1.45, 0], 0.54, 0.36, skin, 10));
    const shin = new THREE.Group();
    shin.position.set(0.35, -1.45, 0);
    leg.add(shin);
    shin.add(solid(new THREE.SphereGeometry(0.38, 10, 8), skin));
    shin.add(limb([0, 0, 0], [-0.3, -1.3, 0], 0.36, 0.22, skin, 10));
    shin.add(solid(new THREE.BoxGeometry(1.0, 0.32, 0.62), skin, 0.08, -1.36, 0));
    for (const dz of [-0.2, 0, 0.2]) {
      const claw = solid(new THREE.ConeGeometry(0.09, 0.4, 6), horn, 0.72, -1.42, dz);
      claw.rotation.z = -Math.PI / 2;
      shin.add(claw);
    }
    return { leg, shin };
  });

  const torso = new THREE.Group();
  hips.add(torso);
  const chest = solid(
    lathe(
      [
        [0.001, -0.2],
        [0.7, -0.1],
        [0.78, 0.4],
        [0.95, 1.1],
        [1.28, 1.8],
        [1.3, 2.3],
        [0.95, 2.7],
        [0.45, 2.92],
        [0.001, 2.98],
      ],
      18,
    ),
    skin,
  );
  chest.scale.set(0.8, 1, 1.08);
  torso.add(chest);
  for (const [y, r] of [
    [0.9, 0.9],
    [1.5, 1.0],
    [2.1, 1.05],
    [2.65, 0.8],
  ]) {
    const spike = solid(new THREE.ConeGeometry(0.17, 0.8, 6), horn, -r, y, 0);
    spike.rotation.z = 1.15;
    torso.add(spike);
    flame(torso, -r - 0.3, y + 0.2, 0, 16, 1.1);
  }

  const head = new THREE.Group();
  head.position.set(0.32, 2.95, 0);
  torso.add(head);
  head.add(solid(new THREE.SphereGeometry(0.56, 14, 12).scale(1.05, 0.95, 0.9), skin, 0.15, 0.42, 0));
  const snout = solid(new THREE.CylinderGeometry(0.2, 0.4, 0.75, 7), skin, 0.72, 0.38, 0);
  snout.rotation.z = -Math.PI / 2;
  head.add(snout);
  const brow = solid(new THREE.BoxGeometry(0.4, 0.14, 0.8), skin, 0.52, 0.72, 0);
  brow.rotation.z = -0.25;
  head.add(brow);
  const jaw = new THREE.Group();
  jaw.position.set(0.3, 0.18, 0);
  head.add(jaw);
  const jawBone = solid(new THREE.CylinderGeometry(0.14, 0.32, 0.72, 7), skin, 0.38, -0.08, 0);
  jawBone.rotation.z = -Math.PI / 2;
  jaw.add(jawBone);
  head.add(new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6).scale(1.7, 0.45, 1), fireMat).translateX(0.72).translateY(0.18));
  for (const s of [1, -1]) {
    head.add(
      new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), eyeMat)
        .translateX(0.6)
        .translateY(0.58)
        .translateZ(0.25 * s),
    );
    head.add(
      solid(
        taperedTube(
          [
            [0.1, 0.75, 0.42 * s],
            [-0.45, 1.15, 0.95 * s],
            [-0.4, 1.95, 1.35 * s],
            [0.35, 2.5, 1.25 * s],
            [0.95, 2.4, 0.95 * s],
          ],
          { r0: 0.25, r1: 0.02, segments: 20 },
        ),
        horn,
      ),
    );
  }
  flame(head, -0.1, 1.0, 0, 26, 1.3);

  const arm = (s) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(0.05, 2.35, 1.28 * s);
    torso.add(shoulder);
    shoulder.add(solid(new THREE.SphereGeometry(0.62, 12, 10), skin));
    shoulder.add(limb([0, 0, 0], [0, -1.7, 0.12 * s], 0.46, 0.36, skin, 10));
    const fore = new THREE.Group();
    fore.position.set(0, -1.7, 0.12 * s);
    shoulder.add(fore);
    fore.add(solid(new THREE.SphereGeometry(0.38, 10, 8), skin));
    fore.add(limb([0, 0, 0], [0, -1.55, 0], 0.4, 0.3, skin, 10));
    const hand = new THREE.Group();
    hand.position.set(0, -1.62, 0);
    fore.add(hand);
    hand.add(solid(new THREE.SphereGeometry(0.36, 10, 8), skin));
    for (const dz of [-0.18, 0, 0.18]) {
      const claw = solid(new THREE.ConeGeometry(0.07, 0.42, 6), horn, 0.12, -0.42, dz);
      claw.rotation.z = Math.PI + 0.3;
      hand.add(claw);
    }
    flame(shoulder, -0.1, 0.6, 0, 18, 1.2);
    return { shoulder, fore, hand };
  };
  const armR = arm(1);
  const armL = arm(-1);

  // the sword of flame
  const sword = new THREE.Group();
  sword.rotation.z = 1.35;
  armL.hand.add(sword);
  const edge = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.22, 3.8, 4).scale(1, 1, 0.4), fireMat);
  edge.position.y = -2.1;
  edge.rotation.z = Math.PI;
  sword.add(edge);
  sword.add(solid(new THREE.BoxGeometry(0.2, 0.16, 0.9), horn, 0, -0.25, 0));
  flame(sword, 0, -1.4, 0, 14, 0.8);
  flame(sword, 0, -2.8, 0, 14, 0.7);

  const wings = [1, -1].map((s) => {
    const root = new THREE.Group();
    root.position.set(-0.6, 2.3, 0.55 * s);
    torso.add(root);
    const inner = new THREE.Group();
    inner.scale.z = s;
    root.add(inner);
    const S = [0, 0, 0];
    const W = [-1.3, 2.9, 2.3];
    const F = [
      [0.4, 5.6, 4.0],
      [-1.8, 5.2, 6.6],
      [-3.6, 3.0, 7.6],
      [-4.2, 0.2, 6.0],
    ];
    const B = [-0.5, -1.9, 0.1];
    inner.add(
      solid(
        taperedTube([S, [-0.9, 1.6, 1.0], W], {
          r0: 0.32,
          r1: 0.18,
          segments: 10,
        }),
        skin,
      ),
    );
    for (const f of F) {
      const mid = [mix(W[0], f[0], 0.5) + 0.25, mix(W[1], f[1], 0.5) + 0.3, mix(W[2], f[2], 0.5)];
      inner.add(
        solid(
          taperedTube([W, mid, f], {
            r0: 0.16,
            r1: 0.025,
            segments: 12,
            radial: 6,
          }),
          horn,
        ),
      );
    }
    const skinMesh = solid(membrane(W, [...F, B]), web);
    inner.add(skinMesh);
    const claw = solid(new THREE.ConeGeometry(0.12, 0.7, 6), horn, W[0] + 0.2, W[1] + 0.45, W[2]);
    inner.add(claw);
    flame(inner, W[0], W[1] + 0.4, W[2], 9, 1.0);
    return root;
  });

  const light = new THREE.PointLight(0xff6a22, 90, 46, 2);
  light.position.set(1.4, 2.2, 0);
  torso.add(light);

  // its walk: a heavy tread, each foot down a little over half the stride
  const track = createTracker({ fastest: 30 });
  const gait = createStride({
    stride: 4.2,
    hz: 0.72,
    longest: 1.2,
    stance: 0.52,
    cadence: [0.8, 1.2],
    seed: 7,
  });
  // each leg on its rig: the knee where the shin hangs from the thigh, the
  // sole under the shin, standing turned as it was built
  const RIG = legRig({
    knee: [0.35, -1.45],
    foot: [0.3, -1.52],
    rest: [0.04, -0.22],
  });
  const self = { steps: 0 };
  let down = [true, true];
  const animate = ({ t, spread = 0.4, raise = 0, lash = 0, roar = 0, flare = 1 }) => {
    const m = track(t, g.position.x, g.position.z, g.rotation.y, g.scale.x);
    const st = gait.step(m.dt, m.fwd < -0.05 ? -m.speed : m.speed);
    const moving = st.amount;
    const stride = st.phase;
    // the near foot's swing (+ forward)
    const sw = Math.cos(stride) * moving;
    // each foot held where it comes down (its knee taking up the rest), the
    // stride under the hips, the hips lower the longer it is and highest
    // with a foot beneath them
    const cx = RIG.home[0] * (1 - moving);
    const lower = RIG.sink(st.travel * moving, cx) * (0.8 + 0.2 * Math.cos(2 * stride - 0.52 * Math.PI * 2)) + (1 - moving) * 0.04;
    legs.forEach(({ leg, shin }, i) => {
      const f = footAt(st.cycle + (i ? 0.5 : 0), 0.52);
      const [th, sh] = RIG.reach(cx + ((f.x * st.travel) / 2) * moving, RIG.home[1] + lower + f.lift * 0.55 * moving);
      leg.rotation.z = th;
      shin.rotation.z = sh;
      // a footfall: a foot come down
      const isDown = f.lift === 0;
      if (isDown && !down[i] && moving > 0.5) self.steps++;
      down[i] = isDown;
    });
    hips.position.y = 3.05 - lower;
    torso.rotation.x = sw * 0.045;
    torso.rotation.y = -sw * 0.1;
    torso.rotation.z = -0.2 + roar * 0.28 + Math.sin(t * 1.2) * 0.015;
    head.rotation.z = 0.15 + roar * 0.3;
    jaw.rotation.z = -0.06 - roar * 0.55;
    armL.shoulder.rotation.z = 0.35 - sw * 0.25 + roar * 0.3;
    armL.shoulder.rotation.x = 0.2 + roar * 0.3;
    armL.fore.rotation.z = 0.7;
    const up = mix(mix(0.3 + sw * 0.3, 3.3, raise), 1.25, lash);
    armR.shoulder.rotation.z = up;
    armR.shoulder.rotation.x = -0.2 - raise * 0.25;
    armR.fore.rotation.z = mix(mix(0.6, 0.95, raise), 0.12, lash);
    const fold = 1 - spread;
    const flap = Math.sin(t * 1.7) * (0.05 + 0.08 * spread);
    wings.forEach((w, i) => {
      const s = i ? -1 : 1;
      w.rotation.x = -s * (flap - 0.35 * fold + 0.1 * roar);
      w.rotation.y = -s * (0.95 * fold - 0.15 * roar);
    });
    skin.emissiveIntensity = (1.7 + Math.sin(t * 2.3) * 0.4 + roar * 2.2) * flare;
    light.intensity = (70 + Math.sin(t * 9) * 8 + Math.sin(t * 23) * 5 + roar * 120) * flare;
  };

  return Object.assign(self, {
    group: g,
    animate,
    flames,
    hand: armR.hand,
    head,
    light,
  });
}

// A hobbit under an elven cloak, 1.05 tall, facing +x. `pack` for Sam.
export function makeHobbit({ cloak = 0x4b5a3a, pack = false } = {}) {
  const g = new THREE.Group();
  const cloth = std({ color: cloak });
  const skin = std({ color: 0xd9b48c, roughness: 0.7 });
  const body = new THREE.Group();
  g.add(body);
  body.add(
    solid(
      lathe(
        [
          [0.001, 0],
          [0.3, 0],
          [0.27, 0.2],
          [0.19, 0.55],
          [0.2, 0.7],
          [0.1, 0.8],
          [0.001, 0.82],
        ],
        12,
      ),
      cloth,
    ),
  );
  body.add(solid(new THREE.SphereGeometry(0.115, 12, 8), skin, 0.02, 0.9, 0));
  const hood = solid(new THREE.SphereGeometry(0.15, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.62), cloth, -0.03, 0.92, 0);
  hood.rotation.z = 0.5;
  body.add(hood);
  if (pack) body.add(solid(new THREE.BoxGeometry(0.2, 0.3, 0.3), std({ color: 0x6b5338 }), -0.24, 0.52, 0));
  return { group: g, body, cloth };
}

// An orc of Mordor, 1.5 tall, facing -x (they march down the road towards
// the hobbits): hunched, helmeted, with a spear and a shield.
export function makeOrc(iron, hide) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const legs = [1, -1].map((s) => {
    const leg = new THREE.Group();
    leg.position.set(0, 0.62, 0.13 * s);
    leg.add(limb([0, 0, 0], [0, -0.6, 0], 0.11, 0.08, hide, 6));
    g.add(leg);
    return leg;
  });
  const torso = solid(new THREE.CapsuleGeometry(0.22, 0.42, 4, 8), hide, 0, 0.92, 0);
  torso.rotation.z = 0.28;
  body.add(torso);
  body.add(solid(new THREE.SphereGeometry(0.15, 10, 8), hide, -0.14, 1.28, 0));
  const helm = solid(new THREE.ConeGeometry(0.17, 0.3, 6), iron, -0.13, 1.42, 0);
  body.add(helm);
  const shield = solid(new THREE.CylinderGeometry(0.26, 0.26, 0.04, 8), iron, -0.1, 0.92, 0.28);
  shield.rotation.x = Math.PI / 2;
  body.add(shield);
  const spear = solid(new THREE.CylinderGeometry(0.015, 0.015, 1.9, 5), hide, -0.2, 1.1, -0.26);
  spear.rotation.z = 0.18;
  body.add(spear);
  const tip = solid(new THREE.ConeGeometry(0.045, 0.22, 5), iron, -0.39, 2.12, -0.26);
  tip.rotation.z = 0.18;
  body.add(tip);
  return { group: g, body, legs };
}

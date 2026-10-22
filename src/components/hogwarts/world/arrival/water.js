// What the lake does while the boats cross it (the design’s §4.2): a low
// mist lying on the black water, thinning as the castle comes up, each bank
// of it a soft card turned to the eye and catching the moon; and once, far
// off, the giant squid’s arm, rising out of the water, curling, and going
// back under with a ring spreading where it went. The arm is a creature, not
// a person: drawn here, a taper of overlapping beads along a moving curve,
// the suckers pale along its inside.
//
//   createMist({ route, water, tier }) → { group, set({ thick, moon }), update(camera, t), dispose() }
//   armCurve(k, base, out) → [[x, y, z]…] (pure: the arm’s spine k of the way through its rise and fall)
//   createSquid({ at, water, toward }) → { group, play(seconds), update(dt), dispose() }

import * as THREE from 'three';
import { MeshBasicNodeMaterial, MeshStandardNodeMaterial } from 'three/webgpu';
import { attribute, float, length, mx_fractal_noise_float, normalView, smoothstep, time, uniform, uv, vec2, vec3 } from 'three/tsl';

const BANKS = { low: 10, mid: 22, high: 36, ultra: 44 };

export function createMist({ route, water = 0, tier = 'high', seed = 5 } = {}) {
  const group = new THREE.Group();
  group.name = 'arrival:mist';
  const n = BANKS[tier] ?? BANKS.high;
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const geo = new THREE.PlaneGeometry(1, 1);
  const seeds = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) seeds.set([rnd() * 10, rnd()], i * 2);
  geo.setAttribute('aMist', new THREE.InstancedBufferAttribute(seeds, 2));
  const uThick = uniform(1);
  const uMoon = uniform(new THREE.Color(0.55, 0.62, 0.78));
  const mat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  mat.userData.noHouse = true;
  const a = attribute('aMist', 'vec2');
  const p = uv().sub(0.5);
  const edge = smoothstep(0.5, 0.1, length(p.mul(vec2(1, 2.2))));
  const n1 = mx_fractal_noise_float(vec3(uv().mul(vec2(2.5, 1.2)).add(a.x), time.mul(0.03).add(a.x)), 3).mul(0.5).add(0.5);
  mat.colorNode = uMoon.mul(edge.mul(n1).mul(0.11).mul(uThick)).mul(float(0.7).add(a.y.mul(0.6)));
  const mesh = new THREE.InstancedMesh(geo, mat, n);
  mesh.frustumCulled = false;
  mesh.renderOrder = 8;
  group.add(mesh);
  // the banks along the boats’ way, either side and over it, low on the water
  const banks = [];
  for (let i = 0; i < n; i++) {
    const m = rnd() * route.length;
    const pt = route.at(m);
    const side = (rnd() - 0.5) * 120;
    banks.push({ x: pt.x - pt.tz * side, z: pt.z + pt.tx * side, y: water + 0.6 + rnd() * 2.2, w: 18 + rnd() * 26, h: 3 + rnd() * 3.5, drift: (rnd() - 0.5) * 0.6 });
  }
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const v = new THREE.Vector3();
  const sc = new THREE.Vector3();
  const e = new THREE.Euler();
  return {
    group,
    set({ thick, moon } = {}) {
      if (thick != null) uThick.value = thick;
      if (moon) uMoon.value.setRGB(...moon);
    },
    update(camera, t) {
      banks.forEach((b, i) => {
        const x = b.x + Math.sin(t * 0.05 + i) * 4 + b.drift * t;
        // (turned to the eye about the up only: a bank stays lying along the water)
        e.set(0, Math.atan2(camera.position.x - x, camera.position.z - b.z), 0);
        q.setFromEuler(e);
        m4.compose(v.set(x, b.y, b.z), q, sc.set(b.w, b.h, 1));
        mesh.setMatrixAt(i, m4);
      });
      mesh.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      geo.dispose();
      mat.dispose();
      mesh.dispose?.();
      group.removeFromParent();
    },
  };
}

// The arm’s spine, k (0…1) through its moment: up out of the water leaning
// away, its tip curling over, then down again; `base` where it breaks the
// surface, `out` the way it leans (a unit [x, z]).
export function armCurve(k, base, out, { reach = 11, n = 28 } = {}) {
  const rise = k < 0.35 ? Math.sin((k / 0.35) * (Math.PI / 2)) : k < 0.62 ? 1 : Math.cos(((k - 0.62) / 0.38) * (Math.PI / 2));
  const curl = Math.min(1, Math.max(0, (k - 0.15) / 0.5));
  // (sideways: across the way it leans)
  const side = [-out[1], out[0]];
  const pts = [];
  for (let i = 0; i < n; i++) {
    const s = i / (n - 1);
    const h = reach * rise * s ** 0.9;
    // it leans out as it rises, a slow wave running up it, and its last third rolls over toward the water
    const lean = s * s * 4.5 * rise + Math.sin(s * Math.PI) * 0.6;
    const wave = Math.sin(s * 4.2 - k * 7) * 1.1 * s * rise;
    const roll = Math.max(0, s - 0.58) / 0.42;
    const over = curl * roll * roll * 5 * rise;
    pts.push([base[0] + out[0] * (lean + over) + side[0] * wave, base[1] + h - over * 1.6 - 0.8 * (1 - rise), base[2] + out[1] * (lean + over) + side[1] * wave]);
  }
  return pts;
}

export function createSquid({ at = [0, 0, 0], toward = [1, 0], beads = 46, reach = 15 } = {}) {
  const group = new THREE.Group();
  group.name = 'arrival:squid';
  group.visible = false;
  // (wet: the moon catches its edges, so it reads against the black water a hundred metres off)
  const skin = new MeshStandardNodeMaterial({ color: new THREE.Color('#6a5464'), roughness: 0.22, metalness: 0.05 });
  skin.emissiveNode = vec3(0.45, 0.5, 0.65).mul(float(1).sub(normalView.z.abs()).pow(2.2)).mul(0.6);
  const sucker = new MeshStandardNodeMaterial({ color: new THREE.Color('#9a8590'), roughness: 0.45 });
  const geo = new THREE.SphereGeometry(1, 12, 8);
  const body = new THREE.InstancedMesh(geo, skin, beads);
  const cups = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), sucker, beads);
  body.frustumCulled = cups.frustumCulled = false;
  group.add(body, cups);
  // the ring where it broke the water, spreading and fading
  const ringGeo = new THREE.RingGeometry(0.85, 1, 48).rotateX(-Math.PI / 2);
  const ringMat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  ringMat.userData.noHouse = true;
  const uRing = uniform(0);
  ringMat.colorNode = vec3(0.65, 0.7, 0.85).mul(uRing).mul(1.6);
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.set(at[0], at[1] + 0.03, at[2]);
  group.add(ring);
  const len = Math.hypot(...toward) || 1;
  const out = [toward[0] / len, toward[1] / len];
  let t = -1;
  let span = 9;
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const v = new THREE.Vector3();
  const sc = new THREE.Vector3();
  const pose = (k) => {
    const pts = armCurve(k, at, out, { n: beads, reach });
    pts.forEach((p, i) => {
      const s = i / (beads - 1);
      const r = 0.85 * (1 - s) ** 0.8 + 0.06;
      m4.compose(v.set(...p), q, sc.setScalar(p[1] < at[1] - 0.2 ? 0 : r));
      body.setMatrixAt(i, m4);
      // (the cups along its inside: toward the way it curls)
      const nx = i < beads - 1 ? pts[i + 1][0] - p[0] : 0;
      const nz = i < beads - 1 ? pts[i + 1][2] - p[2] : 0;
      const k2 = Math.hypot(nx, nz) || 1;
      m4.compose(v.set(p[0] - (nz / k2) * r * 0.75, p[1] - r * 0.2, p[2] + (nx / k2) * r * 0.75), q, sc.setScalar(p[1] < at[1] - 0.2 ? 0 : r * 0.32));
      cups.setMatrixAt(i, m4);
    });
    body.instanceMatrix.needsUpdate = true;
    cups.instanceMatrix.needsUpdate = true;
  };
  return {
    group,
    play(seconds = 9) {
      span = seconds;
      t = 0;
      group.visible = true;
    },
    update(dt) {
      if (t < 0) return;
      t += dt;
      const k = t / span;
      if (k >= 1) {
        group.visible = false;
        t = -1;
        return;
      }
      pose(k);
      const rk = Math.min(1, k * 1.6);
      ring.scale.setScalar(1 + rk * 9);
      uRing.value = (1 - rk) * 0.5 * Math.min(1, k * 8);
    },
    dispose() {
      geo.dispose();
      cups.geometry.dispose();
      ringGeo.dispose();
      for (const m of [skin, sucker, ringMat]) m.dispose();
      body.dispose?.();
      cups.dispose?.();
      group.removeFromParent();
    },
  };
}

// The cliff’s foot where the boats go in (the design’s §4.2: “Heads down”, in
// the site’s words Hagrid’s “Duck yer heads under the ivy”): a low mouth in
// the rock at the water, black inside but for the harbour’s torchlight far
// in, a curtain of ivy hanging over it that the lanterns catch, and broken
// rock heaped along the water either side. `at`: the mouth’s middle at the
// water [x, z]; it faces +z, the way the boats come.
export function createCliff({ at = [0, 0], water = 0, kit, strands = 70 } = {}) {
  const group = new THREE.Group();
  group.name = 'arrival:cliff';
  const [cx, cz] = at;
  // the rock round the mouth, and the heaps along the water
  const rock = kit.paint('#3c3934', { scan: 'rock', metres: 4, strength: 0.85, rough: 1 });
  const lump = (x, y, z, s, sy = s) => {
    const g = new THREE.IcosahedronGeometry(1, 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const vx = p.getX(i);
      const vy = p.getY(i);
      const vz = p.getZ(i);
      const n = 1 + 0.22 * Math.sin(vx * 3.1 + vz * 2.3) * Math.sin(vy * 2.7 + 1) + 0.1 * Math.sin(vx * 7 + vy * 5);
      p.setXYZ(i, vx * n, vy * n, vz * n);
    }
    g.computeVertexNormals();
    kit.add(rock, g, { at: [x, y, z], scale: [s, sy, s * 0.8] });
  };
  for (let i = -6; i <= 6; i++) {
    if (Math.abs(i) < 2) continue;
    lump(cx + i * 4.2, water - 1.5 + Math.abs(i) * 0.6, cz + 2 + Math.sin(i) * 1.5, 3 + (Math.abs(i) % 3), 4 + Math.abs(i) * 0.9);
  }
  // the arch over the mouth: a half ring of rock, heavy, and the face above it
  const arch = new THREE.TorusGeometry(5.2, 2.2, 8, 18, Math.PI);
  kit.add(rock, arch, { at: [cx, water - 0.5, cz] });
  lump(cx, water + 9, cz - 1, 9, 6);
  lump(cx - 9, water + 4, cz - 1.5, 5, 7);
  lump(cx + 9, water + 4, cz - 1.5, 5, 7);
  // black inside, but for a little torchlight far in
  const dark = new MeshBasicNodeMaterial({ color: 0x020203, fog: false });
  dark.userData.noHouse = true;
  const mouth = new THREE.Mesh(new THREE.CircleGeometry(5.3, 24, 0, Math.PI), dark);
  mouth.position.set(cx, water - 0.4, cz - 2.6);
  const deep = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  deep.userData.noHouse = true;
  deep.colorNode = vec3(1.0, 0.5, 0.2).mul(smoothstep(0.5, 0.0, length(uv().sub(vec2(0.5, 0.25))))).mul(0.5);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(4, 3), deep);
  glow.position.set(cx, water + 0.9, cz - 2.5);
  group.add(mouth, glow);
  // the ivy: strands hung from the lip, leaves cut from noise, lit by the lanterns
  const ivyGeo = new THREE.PlaneGeometry(0.45, 1);
  ivyGeo.translate(0, -0.5, 0);
  const seeds = new Float32Array(strands * 2);
  for (let i = 0; i < strands; i++) seeds.set([Math.random() * 10, Math.random()], i * 2);
  ivyGeo.setAttribute('aIvy', new THREE.InstancedBufferAttribute(seeds, 2));
  const ivy = new MeshStandardNodeMaterial({ color: new THREE.Color('#1f3a1c'), roughness: 0.75, side: THREE.DoubleSide, alphaTest: 0.5 });
  const a = attribute('aIvy', 'vec2');
  const leaf = mx_fractal_noise_float(vec3(uv().mul(vec2(3, 14)).add(a.x), float(0.5)), 3).mul(0.5).add(0.5);
  ivy.opacityNode = smoothstep(0.42, 0.5, leaf.sub(length(vec2(uv().x.sub(0.5), 0)).mul(0.7)));
  ivy.colorNode = vec3(0.09, 0.2, 0.08).mul(leaf.mul(0.9).add(0.4)).mul(a.y.mul(0.5).add(0.75));
  const curtain = new THREE.InstancedMesh(ivyGeo, ivy, strands);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < strands; i++) {
    const k = i / (strands - 1);
    const x = cx + (k - 0.5) * 13 + (Math.random() - 0.5) * 0.4;
    const top = water + 5.1 + Math.sin(k * Math.PI) * 2.2;
    const len = 2.4 + Math.random() * (top - water - 2.6);
    m4.compose(new THREE.Vector3(x, top, cz + 0.4 + Math.random() * 0.6), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.08)), new THREE.Vector3(1, len, 1));
    curtain.setMatrixAt(i, m4);
  }
  curtain.frustumCulled = false;
  group.add(curtain);
  return {
    group,
    dispose() {
      mouth.geometry.dispose();
      glow.geometry.dispose();
      ivyGeo.dispose();
      for (const m of [dark, deep, ivy]) m.dispose();
      curtain.dispose?.();
      group.removeFromParent();
    },
  };
}

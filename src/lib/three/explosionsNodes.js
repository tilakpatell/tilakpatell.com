// explosions.js on the node renderer: the same fireballs, shards and rings,
// pooled the same way, with the same names, flags and uniforms (uniform
// nodes under the GLSL’s names: each blast’s `u`, which update() writes),
// so a 'nodes' world bursts what a classic one does. explosionPlan is
// explosions.js’s, copied: importing it would bring its GLSL into a 'nodes'
// world’s closure. So is the noise its fire churns with (noiseGlsl’s value
// noise, seeded by uSeed), as nodes, line for line.
//
// explosionPlan(size, tint, t) → { fire: { radius, colour, alpha }, shards, ring }
// createExplosions({ parent, small, pool }) → { burst(at, size, tint),
//   update(dt), setMode('full' | 'pop'), active, meshes, dispose }

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { Fn, attribute, cameraProjectionMatrix, dot, floor, fract, length, mix, modelViewMatrix, positionGeometry, smoothstep, uniform, varyingProperty, vec3, vec4 } from 'three/tsl';
import { instanceMatrixOf } from './hookNodes';

const LIFE = 1.4; // seconds
const SWELL = 0.4; // to its full size
const SHARDS = 24; // a blast’s
const WHITE = [1, 0.97, 0.9];
const ORANGE = [1, 0.48, 0.12];
const SMOKE = [0.2, 0.18, 0.17];

const mix3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function explosionPlan(size, tint = null, t = 0) {
  // swells fast and keeps a little growth as it burns out
  const swell = 1 - (1 - Math.min(1, t / SWELL)) ** 3;
  // (2.2 times its size across: a fighter’s is a few of your ships wide)
  const radius = 1.1 * size * swell * (1 + 0.15 * smooth(SWELL, LIFE, t));
  // white, to orange (a third of the way to its tint) by 0.45 s, to smoke by 1.4 s
  const hot = tint ? mix3(ORANGE, tint, 0.35) : ORANGE;
  const colour = t < 0.45 ? mix3(WHITE, hot, smooth(0.05, 0.45, t)) : mix3(hot, SMOKE, smooth(0.45, LIFE, t));
  const alpha = t >= LIFE ? 0 : 1 - smooth(0.6, LIFE, t);
  return { fire: { radius, colour, alpha }, shards: size < 0.1 ? 0 : SHARDS, ring: size > 0.3 };
}

// ── the noise (noiseGlsl’s hash13 and noise, seeded) ──

const hash13 = (p, seed) => {
  const q = fract(p.add(seed).mul(0.1031));
  const r = q.add(dot(q, q.zyx.add(31.32)));
  return fract(r.x.add(r.y).mul(r.z));
};
// value noise, −1…1
const noise = (x, seed) => {
  const i = floor(x);
  const w = fract(x);
  const f = w.mul(w).mul(w.mul(-2).add(3));
  const h = (a, b, c) => hash13(i.add(vec3(a, b, c)), seed);
  const lo = mix(mix(h(0, 0, 0), h(1, 0, 0), f.x), mix(h(0, 1, 0), h(1, 1, 0), f.x), f.y);
  const hi = mix(mix(h(0, 0, 1), h(1, 0, 1), f.x), mix(h(0, 1, 1), h(1, 1, 1), f.x), f.y);
  return mix(lo, hi, f.z).mul(2).sub(1);
};

// GLSL’s smoothstep with its edges reversed (from 1 at a down to 0 at b), as nodes
const fall = (a, b, x) => smoothstep(b, a, x).oneMinus();

// (its colour is premultiplied in the shader already, as the GLSL’s: the
// flag is for the blend alone, so the node material’s own multiply is off)
const keepPremultiplied = (m) => {
  m.setupPremultipliedAlpha = (builder, out) => out;
  return m;
};

// the fireball: a quad facing the camera, a ball of noise that churns
function fireMaterial(u) {
  const material = keepPremultiplied(new MeshBasicNodeMaterial({ lights: false, transparent: true, depthWrite: false, premultipliedAlpha: true, blending: THREE.NormalBlending, toneMapped: false, fog: false }));
  const vUv = varyingProperty('vec2', 'vFireUv');
  material.vertexNode = Fn(() => {
    vUv.assign(positionGeometry.xy);
    const mv = modelViewMatrix.mul(vec4(0, 0, 0, 1));
    return cameraProjectionMatrix.mul(vec4(mv.xy.add(positionGeometry.xy.mul(u.uRadius)), mv.z, mv.w));
  })();
  const d = length(vUv);
  // billows: noise over the disc, churning as it ages
  const n = noise(vec3(vUv.mul(2.6), u.uAge.mul(1.8)), u.uSeed)
    .mul(0.6)
    .add(noise(vec3(vUv.mul(6).add(7), u.uAge.mul(3)), u.uSeed).mul(0.4));
  const body = fall(1, 0.35, d.add(n.mul(0.28)));
  // a white-hot heart early on, past what the bloom picks out
  const heart = fall(0.5, 0, d.add(n.mul(0.15)))
    .mul(smoothstep(0, 0.5, u.uAge).oneMinus())
    .mul(2);
  const a = body.mul(u.uAlpha);
  material.colorNode = u.uColour.mul(n.mul(0.6).add(0.8)).add(vec3(heart)).mul(a);
  material.opacityNode = a;
  material.maskNode = d.lessThanEqual(1);
  material.uniforms = u;
  return material;
}

// the rings: a quad facing the camera, a thin ring of light running out
function ringMaterial() {
  const material = keepPremultiplied(new MeshBasicNodeMaterial({ lights: false, transparent: true, depthWrite: false, premultipliedAlpha: true, blending: THREE.AdditiveBlending, toneMapped: false, fog: false }));
  const vUv = varyingProperty('vec2', 'vRingUv');
  const vAge = varyingProperty('float', 'vRingAge');
  material.vertexNode = Fn((builder) => {
    vUv.assign(positionGeometry.xy);
    vAge.assign(attribute('aAge', 'float'));
    const im = instanceMatrixOf(builder);
    const mv = modelViewMatrix.mul(im ? im.mul(vec4(0, 0, 0, 1)) : vec4(0, 0, 0, 1));
    const scale = im ? length(im.element(0).xyz) : 1;
    return cameraProjectionMatrix.mul(vec4(mv.xy.add(positionGeometry.xy.mul(scale)), mv.z, mv.w));
  })();
  const d = length(vUv);
  const ring = smoothstep(0.82, 0.95, d).mul(smoothstep(0.95, 1, d).oneMinus());
  const a = ring.mul(vAge.oneMinus());
  // (the ring's colour, the GLSL's instanceColor, is three's to put on: a
  // node material multiplies its colour by an instanced mesh's
  // instanceColor itself, so multiplying by it here too drew the ring in
  // its colour squared, 9 % of its pixels off the GLSL's)
  material.colorNode = vec3(a);
  material.opacityNode = a;
  return material;
}

export function createExplosions({ parent, small = false, pool = 6 } = {}) {
  const n = small ? Math.max(2, Math.floor(pool / 2)) : pool;
  const quad = new THREE.PlaneGeometry(2, 2);
  const blasts = Array.from({ length: n }, (_, i) => {
    const u = { uRadius: uniform(0), uColour: uniform(new THREE.Color()), uAlpha: uniform(0), uAge: uniform(0), uSeed: uniform(new THREE.Vector3(i * 13 + 5, i * 7 + 2, i * 3 + 11)) };
    const mat = fireMaterial(u);
    const mesh = new THREE.Mesh(quad, mat);
    mesh.visible = false;
    mesh.frustumCulled = false;
    mesh.renderOrder = 6;
    mesh.name = 'blast';
    parent?.add(mesh);
    return { mesh, u, live: false, t: 0, size: 0, tint: null, at: new THREE.Vector3(), flung: [] };
  });
  // every blast’s shards, one draw: small hot bits of hull, tumbling out and cooling
  const shardGeo = new THREE.TetrahedronGeometry(1, 0);
  const shardMat = new MeshBasicNodeMaterial({ lights: false, toneMapped: false });
  const shards = new THREE.InstancedMesh(shardGeo, shardMat, SHARDS * n);
  shards.count = 0;
  shards.frustumCulled = false;
  shards.visible = false;
  shards.name = 'blast-shards';
  shards.setColorAt(0, new THREE.Color());
  parent?.add(shards);
  // and every ring, one draw
  const ringGeo = new THREE.PlaneGeometry(2, 2);
  const age = new THREE.InstancedBufferAttribute(new Float32Array(n), 1);
  ringGeo.setAttribute('aAge', age);
  const ringMat = ringMaterial();
  const rings = new THREE.InstancedMesh(ringGeo, ringMat, n);
  rings.count = 0;
  rings.frustumCulled = false;
  rings.visible = false;
  rings.name = 'blast-rings';
  rings.setColorAt(0, new THREE.Color());
  parent?.add(rings);

  let mode = 'full';
  let next = 0;
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const c = new THREE.Color();
  let rand = 0x9e3779b9;
  const r = () => {
    rand = (rand * 1664525 + 1013904223) >>> 0;
    return rand / 4294967296;
  };

  return {
    // `at` in the parent’s space; `size` across, map units; `tint` [r, g, b] or null
    burst(at, size, tint = null) {
      if (mode === 'pop' || !(size > 0)) return;
      const b = blasts[next];
      next = (next + 1) % n;
      Object.assign(b, { live: true, t: 0, size, tint });
      b.at.copy(at);
      b.mesh.position.copy(at);
      // the shards' ways out, spins and sizes, drawn now
      const count = explosionPlan(size, tint, 0).shards;
      b.flung = Array.from({ length: count }, () => {
        const z = r() * 2 - 1;
        const a = r() * Math.PI * 2;
        const k = Math.sqrt(1 - z * z);
        const v = size * (1.4 + r() * 2.2);
        return { v: [Math.cos(a) * k * v, z * v, Math.sin(a) * k * v], spin: [r() * 6, r() * 6, r() * 6], s: size * (0.04 + r() * 0.08) };
      });
    },
    setMode(m) {
      mode = m === 'pop' ? 'pop' : 'full';
      if (mode === 'pop') for (const b of blasts) b.live = false;
    },
    get active() {
      return blasts.filter((b) => b.live).length;
    },
    update(dt) {
      let ns = 0;
      let nr = 0;
      for (const b of blasts) {
        if (b.live) b.t += dt;
        if (b.live && b.t >= LIFE) b.live = false;
        b.mesh.visible = b.live;
        if (!b.live) continue;
        const plan = explosionPlan(b.size, b.tint, b.t);
        b.u.uRadius.value = plan.fire.radius;
        b.u.uColour.value.setRGB(...plan.fire.colour);
        b.u.uAlpha.value = plan.fire.alpha;
        b.u.uAge.value = b.t / LIFE;
        // the shards: out and slowing, tumbling, cooling from orange to dark
        const k = b.t / LIFE;
        const out = (1 - Math.exp(-b.t * 2.2)) / 2.2;
        c.setRGB(...mix3([1, 0.6, 0.25], [0.12, 0.11, 0.1], smooth(0, 0.7, k)));
        for (const f of b.flung) {
          p.set(b.at.x + f.v[0] * out, b.at.y + f.v[1] * out, b.at.z + f.v[2] * out);
          q.setFromEuler(e.set(f.spin[0] * b.t, f.spin[1] * b.t, f.spin[2] * b.t));
          s.setScalar(f.s * (1 - smooth(0.6, 1, k)));
          shards.setMatrixAt(ns, m4.compose(p, q, s));
          shards.setColorAt(ns, c);
          ns++;
        }
        if (plan.ring) {
          const rr = b.size * 3.5 * (1 - (1 - Math.min(1, b.t / 0.9)) ** 2);
          rings.setMatrixAt(nr, m4.compose(b.at, q.identity(), s.setScalar(Math.max(1e-4, rr))));
          rings.setColorAt(nr, c.setRGB(...mix3([1, 0.85, 0.6], b.tint ?? [1, 0.6, 0.3], 0.4)));
          age.array[nr] = Math.min(1, b.t / 0.9);
          nr++;
        }
      }
      shards.count = ns;
      shards.visible = ns > 0;
      shards.instanceMatrix.needsUpdate = true;
      if (shards.instanceColor) shards.instanceColor.needsUpdate = true;
      rings.count = nr;
      rings.visible = nr > 0;
      rings.instanceMatrix.needsUpdate = true;
      if (rings.instanceColor) rings.instanceColor.needsUpdate = true;
      age.needsUpdate = true;
    },
    // for the warm-up: every blast’s, shard’s and ring’s shader made before
    // the first fight (they’re hidden until then)
    get meshes() {
      return [...blasts.map((b) => b.mesh), shards, rings];
    },
    dispose() {
      for (const b of blasts) {
        b.mesh.removeFromParent();
        b.mesh.material.dispose();
      }
      quad.dispose();
      shards.removeFromParent();
      shardGeo.dispose();
      shardMat.dispose();
      shards.dispose();
      rings.removeFromParent();
      ringGeo.dispose();
      ringMat.dispose();
      rings.dispose();
    },
  };
}

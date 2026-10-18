// The Shire's moving light and smoke: Gandalf's fireworks (five kinds, one
// to a colour) and the dragon Merry and Pippin let off, smoke rings, the
// chimneys' smoke, fireflies at night and butterflies by day, and the little
// bursts that say something happened. All soft billboards and simple meshes,
// pooled, nothing downloaded.
//
// On the node renderer: ../../shire/fx.js copied, its particles the kit's
// twin's (../kit.js), its smoke rings and fireflies node materials line
// for line with the GLSL, their uniforms uniform nodes under the GLSL's
// names on `material.uniforms`. What differs, and why:
// - Each ring has a material of its own made fresh (the GLSL cloned one,
//   and a node material's clone shares its uniform nodes).
// - The fireflies were points sized by gl_PointSize, and the node renderer
//   draws a point one pixel wide: each is a sprite instanced once a fly
//   (PointsNodeMaterial on a Sprite with a count, `position` and `aSeed`
//   instance attributes over the same arrays), its sizeNode the GLSL's
//   gl_PointSize; toneMapped off, as the GLSL had no tone-mapping chunk.

import * as THREE from 'three';
import { MeshBasicNodeMaterial, PointsNodeMaterial } from 'three/webgpu';
import { Fn, abs, cos, dot, floor, fract, instancedBufferAttribute, length, mix, normalLocal, normalize, positionView, pow, screenDPR, sin, smoothstep, transformNormalToView, uniform, uv, varying, vec2, vec3 } from 'three/tsl';
import { hot } from '../../../../lib/three/stage3dNodes';
import { FIRE, createParticles } from '../kit';

// colour over a spark's life, [t, r, g, b, a]; above 1 blooms
const RAMPS = {
  gold: [
    [0, 3.4, 2.6, 1.2, 0],
    [0.04, 3.4, 2.3, 0.8, 1],
    [0.55, 2.4, 1.1, 0.25, 0.85],
    [1, 0.7, 0.2, 0.02, 0],
  ],
  green: [
    [0, 1.8, 3.4, 1.6, 0],
    [0.04, 1.0, 3.2, 1.0, 1],
    [0.6, 0.3, 1.9, 0.4, 0.8],
    [1, 0.05, 0.4, 0.1, 0],
  ],
  red: [
    [0, 3.4, 1.4, 1.1, 0],
    [0.04, 3.2, 0.6, 0.5, 1],
    [0.6, 2.1, 0.2, 0.15, 0.8],
    [1, 0.4, 0.03, 0.02, 0],
  ],
  blue: [
    [0, 1.6, 2.2, 3.6, 0],
    [0.04, 0.8, 1.5, 3.6, 1],
    [0.6, 0.3, 0.6, 2.4, 0.8],
    [1, 0.05, 0.1, 0.5, 0],
  ],
  white: [
    [0, 3.6, 3.6, 3.6, 0],
    [0.04, 3.2, 3.2, 3.4, 1],
    [0.5, 2.0, 2.0, 2.4, 0.75],
    [1, 0.4, 0.4, 0.5, 0],
  ],
};
const SMOKE = [
  [0, 0.75, 0.74, 0.72, 0],
  [0.15, 0.7, 0.69, 0.68, 0.3],
  [1, 0.55, 0.56, 0.6, 0],
];
const PUFF = [
  [0, 0.95, 0.94, 0.9, 0],
  [0.1, 0.9, 0.9, 0.88, 0.5],
  [1, 0.8, 0.8, 0.82, 0],
];
export const SWATCH = {
  gold: '#ffc94a',
  green: '#6ee07a',
  red: '#ff5a4a',
  blue: '#6aa8ff',
  white: '#f4f4ff',
};
const R = (a) => (Math.random() - 0.5) * 2 * a;
const unit = (v) => {
  // a random direction
  const u = Math.random() * 2 - 1;
  const a = Math.random() * Math.PI * 2;
  const s = Math.sqrt(1 - u * u);
  return v.set(Math.cos(a) * s, u, Math.sin(a) * s);
};

// the rings' GLSL noise
const hash = Fn(([p]) => fract(sin(dot(p, vec2(127.1, 311.7))).mul(43758.5453)), 'float');
const noise = Fn(([p]) => {
  const i = floor(p);
  const f0 = fract(p);
  const f = f0.mul(f0).mul(f0.mul(-2).add(3));
  return mix(mix(hash(i), hash(i.add(vec2(1, 0))), f.x), mix(hash(i.add(vec2(0, 1))), hash(i.add(vec2(1, 1))), f.x), f.y);
}, 'float');

// (GLSL's smoothstep with its edges reversed, defined in WGSL)
const fall = (a, b, x) => smoothstep(b, a, x).oneMinus();

// a smoke ring's material: wisps along the torus, thinning at its edge
// as seen (the view-space normal's z), lit a little from above
function ringMaterial() {
  const uniforms = {
    uOpacity: uniform(0.8),
    uTime: uniform(0),
    uLight: uniform(new THREE.Color(0xf4f0e8)),
  };
  const u = uniforms;
  const material = new MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    fog: false,
  });
  const vUv = varying(uv(), 'vUv');
  const vN = varying(normalize(transformNormalToView(normalLocal)), 'vN');
  const wisp = noise(vec2(vUv.x.mul(24).add(u.uTime.mul(0.6)), vUv.y.mul(4)))
    .mul(0.6)
    .add(noise(vec2(vUv.x.mul(60).sub(u.uTime), vUv.y.mul(9))).mul(0.4));
  const edge = pow(abs(vN.z), 0.8);
  material.colorNode = u.uLight.mul(vN.y.mul(0.35).add(0.75));
  material.opacityNode = u.uOpacity.mul(edge).mul(wisp.mul(0.55).add(0.45));
  material.uniforms = uniforms;
  return material;
}

// the fireflies' material: `position` and `seed` instance attributes, each
// fly wandering about its place and glowing on and off
function flyMaterial(position, seed) {
  const uniforms = { uTime: uniform(0), uOn: uniform(0), uSize: uniform(14) };
  const u = uniforms;
  const material = new PointsNodeMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
    toneMapped: false,
    sizeAttenuation: false,
  });
  material.positionNode = position.add(vec3(sin(u.uTime.mul(0.6).add(seed.mul(12))).mul(0.9), sin(u.uTime.mul(0.9).add(seed.mul(7))).mul(0.35), cos(u.uTime.mul(0.5).add(seed.mul(9))).mul(0.9)));
  const glow = pow(
    sin(u.uTime.mul(2.2).add(seed.mul(30)))
      .mul(0.5)
      .add(0.5),
    3,
  )
    .mul(0.65)
    .add(0.35);
  const vGlow = varying(glow, 'vGlow');
  // gl_PointSize, in the drawing buffer's pixels (the sprite multiplies by the DPR again)
  material.sizeNode = u.uSize.mul(glow).div(positionView.z.negate()).mul(10).div(screenDPR);
  const a = fall(0.5, 0, length(uv().sub(0.5)));
  material.colorNode = vec3(2.4, 2.6, 0.9).mul(a).mul(vGlow).mul(u.uOn);
  material.opacityNode = a.mul(u.uOn);
  material.uniforms = uniforms;
  return material;
}

export function createFx(scene, { scale = 1 } = {}) {
  const max = (n) => Math.max(40, Math.round(n * scale));
  const sparks = {};
  for (const [k, ramp] of Object.entries(RAMPS)) {
    sparks[k] = createParticles(max(900), {
      ramp,
      additive: true,
      gravity: k === 'gold' ? -4.2 : -2.4,
      drag: k === 'gold' ? 1.4 : 1.0,
    });
    scene.add(sparks[k].mesh);
  }
  const trail = createParticles(max(500), {
    ramp: RAMPS.gold,
    additive: true,
    gravity: -1.5,
    drag: 2.2,
  });
  const smoke = createParticles(max(260), {
    ramp: SMOKE,
    additive: false,
    gravity: 0.25,
    drag: 0.5,
    swirl: 0.25,
  });
  const puffs = createParticles(max(160), {
    ramp: PUFF,
    additive: false,
    gravity: 0.12,
    drag: 1.4,
    swirl: 0.3,
  });
  const fire = createParticles(max(160), {
    ramp: FIRE,
    additive: true,
    gravity: 1.6,
    drag: 1.2,
    swirl: 0.6,
  });
  scene.add(trail.mesh, smoke.mesh, puffs.mesh, fire.mesh);
  smoke.mesh.renderOrder = 2;
  puffs.mesh.renderOrder = 2;
  const v = new THREE.Vector3();

  // a firework bursting at `at`, each kind its own shape
  const burst = (at, colour = 'gold', size = 1) => {
    const p = sparks[colour] ?? sparks.gold;
    const n = Math.round(130 * Math.min(1.6, size) * Math.max(0.5, scale));
    if (colour === 'blue') {
      // a ring, tilted towards you
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const s = (8 + R(0.4)) * size;
        p.emit(at.x, at.y, at.z, Math.cos(a) * s, Math.sin(a) * s * 0.9, Math.sin(a) * s * 0.35, 1.5 + Math.random() * 0.4, 0.55 * size, 0.08);
      }
    } else if (colour === 'gold') {
      // a willow: slow, heavy, hanging long
      for (let i = 0; i < n; i++) {
        unit(v).multiplyScalar((5.5 + Math.random() * 2) * size);
        p.emit(at.x, at.y, at.z, v.x, v.y + 2, v.z, 2.4 + Math.random() * 0.8, 0.5 * size, 0.1);
      }
    } else if (colour === 'green') {
      // two shells, one inside the other
      for (let i = 0; i < n; i++) {
        unit(v).multiplyScalar((i % 2 ? 9 : 4.5) * size);
        p.emit(at.x, at.y, at.z, v.x, v.y, v.z, 1.6 + Math.random() * 0.3, 0.5 * size, 0.06);
      }
    } else if (colour === 'white') {
      // glitter: lots of small ones that crackle
      for (let i = 0; i < n * 1.4; i++) {
        unit(v).multiplyScalar((3 + Math.random() * 7) * size);
        p.emit(at.x, at.y, at.z, v.x, v.y, v.z, 0.9 + Math.random() * 1.1, (0.18 + Math.random() * 0.3) * size, 0.02, 0.6 + Math.random() * 0.8);
      }
    } else {
      for (let i = 0; i < n; i++) {
        unit(v).multiplyScalar((7.5 + Math.random() * 1.2) * size);
        p.emit(at.x, at.y, at.z, v.x, v.y, v.z, 1.6 + Math.random() * 0.4, 0.6 * size, 0.08);
      }
    }
    // and a flash at the heart of it
    p.emit(at.x, at.y, at.z, 0, 0, 0, 0.25, 4 * size, 7 * size, 1.4);
  };

  // rockets climbing: { from, to, t, flight }
  const rockets = [];
  const rocket = (from, to, flight) => rockets.push({ from: from.clone(), to: to.clone(), t: 0, flight });

  // ── the dragon: a fiery serpent with wings, along a path ──
  const dragon = new THREE.Group();
  const dragonMat = new THREE.MeshBasicMaterial({
    color: hot(0xff9a3a, 3.2),
    toneMapped: true,
  });
  const wingMat = new THREE.MeshBasicMaterial({
    color: hot(0xff7a2a, 2.4),
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const SEGS = 14;
  const segs = [];
  for (let i = 0; i < SEGS; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.46 * (1 - i / (SEGS + 4)), 10, 8), dragonMat);
    dragon.add(s);
    segs.push(s);
  }
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.6, 8).rotateX(Math.PI / 2), dragonMat);
  dragon.add(head);
  const wingGeo = new THREE.BufferGeometry();
  // a bat's wing: three fingers of fire from the shoulder, swept back
  wingGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.5, 4.2, 0.9, -1.4, 1.6, 0.2, -1.2, 0, 0, 0.2, 3.4, 0.5, -2.4, 1.2, 0.1, -2.0, 0, 0, -0.1, 2.2, 0.2, -3.0, 0.4, 0, -2.4], 3));
  wingGeo.computeVertexNormals();
  const wings = [1, -1].map((s) => {
    const w = new THREE.Mesh(wingGeo, wingMat);
    w.scale.x = s;
    dragon.add(w);
    return w;
  });
  dragon.visible = false;
  scene.add(dragon);
  const D = { on: false, t: 0, dur: 7, curve: null, hist: [], burst: null };
  const startDragon = (points, dur, onBurst) => {
    D.on = true;
    D.t = 0;
    D.dur = dur;
    D.curve = new THREE.CatmullRomCurve3(points.map((p) => p.clone()));
    D.hist = [];
    D.burst = onBurst;
    dragon.visible = true;
  };

  // ── smoke rings ──
  const ringGeo = new THREE.TorusGeometry(1, 0.2, 10, 40);
  const ringPool = [];
  const getRing = (i) => {
    while (ringPool.length <= i) {
      const m = new THREE.Mesh(ringGeo, ringMaterial());
      m.visible = false;
      m.renderOrder = 4;
      scene.add(m);
      ringPool.push(m);
    }
    return ringPool[i];
  };
  // show rings: [{ at: Vector3, r, opacity, face: Vector3 (normal) }]
  const showRings = (list, t) => {
    list.forEach((r, i) => {
      const m = getRing(i);
      m.visible = true;
      m.position.copy(r.at);
      m.scale.set(r.r, r.r, r.r * 0.9);
      m.lookAt(v.copy(r.at).add(r.face));
      m.material.uniforms.uOpacity.value = r.opacity;
      m.material.uniforms.uTime.value = t + i * 3.1;
    });
    for (let i = list.length; i < ringPool.length; i++) ringPool[i].visible = false;
  };

  // ── fireflies and butterflies ──
  const FLY = Math.round(140 * Math.max(0.4, scale));
  const flyGeo = new THREE.BufferGeometry();
  const flyPos = new Float32Array(FLY * 3);
  const flySeed = new Float32Array(FLY);
  // (instance attributes, under the GLSL's names, held by a geometry of
  // their own: the sprite draws its own quad)
  flyGeo.setAttribute('position', new THREE.InstancedBufferAttribute(flyPos, 3));
  flyGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(flySeed, 1));
  const flyMat = flyMaterial(instancedBufferAttribute(flyGeo.attributes.position), instancedBufferAttribute(flyGeo.attributes.aSeed));
  const flies = new THREE.Sprite(flyMat);
  flies.count = FLY;
  flies.frustumCulled = false;
  flies.visible = false;
  scene.add(flies);
  const placeFlies = (spots) => {
    for (let i = 0; i < FLY; i++) {
      const s = spots[i % spots.length];
      flyPos[i * 3] = s.x + R(s.r ?? 6);
      flyPos[i * 3 + 1] = s.y + 0.6 + Math.random() * 1.8;
      flyPos[i * 3 + 2] = s.z + R(s.r ?? 6);
      flySeed[i] = Math.random();
    }
    flyGeo.attributes.position.needsUpdate = true;
    flyGeo.attributes.aSeed.needsUpdate = true;
  };

  const BUTTER = Math.round(16 * Math.max(0.5, scale));
  const wing = new THREE.PlaneGeometry(0.16, 0.12).translate(0.08, 0, 0);
  const butterMat = new THREE.MeshLambertMaterial({
    side: THREE.DoubleSide,
    vertexColors: false,
  });
  const butter = new THREE.InstancedMesh(wing, butterMat, BUTTER * 2);
  butter.frustumCulled = false;
  scene.add(butter);
  const flutter = [];
  const BUTTER_COLOURS = [0xf4e4a0, 0xf8f4ec, 0xf0a040, 0xa8c8f8];
  const placeButterflies = (spots) => {
    for (let i = 0; i < BUTTER; i++) {
      const s = spots[i % spots.length];
      flutter.push({
        x: s.x,
        y: s.y,
        z: s.z,
        r: 2 + Math.random() * 3,
        ph: Math.random() * 10,
        sp: 0.4 + Math.random() * 0.4,
      });
      const c = new THREE.Color(BUTTER_COLOURS[i % BUTTER_COLOURS.length]);
      butter.setColorAt(i * 2, c);
      butter.setColorAt(i * 2 + 1, c);
    }
    if (butter.instanceColor) butter.instanceColor.needsUpdate = true;
  };
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const one = new THREE.Vector3(1, 1, 1);

  // ── a quick burst of something: a pick, a thread, a bark ──
  const pop = (at, colour = 'gold', n = 24, speed = 2.5) => {
    const p = sparks[colour] ?? sparks.gold;
    for (let i = 0; i < n * Math.max(0.5, scale); i++) {
      unit(v).multiplyScalar(speed * (0.5 + Math.random() * 0.5));
      p.emit(at.x, at.y, at.z, v.x, Math.abs(v.y) + 1, v.z, 0.6 + Math.random() * 0.4, 0.14, 0.02, 0.7);
    }
  };
  const puff = (at, dir, n = 10) => {
    for (let i = 0; i < n; i++) puffs.emit(at.x + R(0.05), at.y + R(0.05), at.z + R(0.05), dir.x * 1.5 + R(0.3), dir.y * 1.5 + R(0.2) + 0.2, dir.z * 1.5 + R(0.3), 1.2 + Math.random() * 0.8, 0.18, 0.7);
  };
  const chimney = (at) => smoke.emit(at.x + R(0.1), at.y, at.z + R(0.1), R(0.15) + 0.25, 0.7 + Math.random() * 0.3, R(0.15), 4 + Math.random() * 2, 0.35, 1.8);
  const flame = (at, spread = 0.35) => fire.emit(at.x + R(spread), at.y, at.z + R(spread * 0.4), R(0.1), 0.6 + Math.random() * 0.4, R(0.1), 0.5 + Math.random() * 0.4, 0.32, 0.08, 0.9);

  const pools = [...Object.values(sparks), trail, smoke, puffs, fire];
  const step = (dt, t, { night = 0, day = 1 } = {}) => {
    // an empty pool isn't drawn at all
    for (const p of pools) {
      p.step(dt);
      p.mesh.visible = p.count > 0;
    }
    // rockets: a spark trail up to where they burst
    for (let i = rockets.length - 1; i >= 0; i--) {
      const r = rockets[i];
      r.t += dt;
      const k = Math.min(1, r.t / r.flight);
      const e2 = 1 - (1 - k) * (1 - k);
      v.lerpVectors(r.from, r.to, e2);
      v.y += Math.sin(k * Math.PI) * 0.6;
      for (let n = 0; n < 3; n++) trail.emit(v.x + R(0.05), v.y, v.z + R(0.05), R(0.4), -1 - Math.random(), R(0.4), 0.45 + Math.random() * 0.3, 0.16, 0.02, 0.8);
      if (k >= 1) rockets.splice(i, 1);
    }
    // the dragon
    if (D.on) {
      D.t += dt;
      const k = Math.min(1, D.t / D.dur);
      const p = D.curve.getPointAt(k);
      D.hist.unshift(p.clone());
      if (D.hist.length > 80) D.hist.pop();
      head.position.copy(p);
      const ahead = D.curve.getPointAt(Math.min(1, k + 0.01));
      head.lookAt(ahead);
      segs.forEach((s, i) => {
        const h = D.hist[Math.min(D.hist.length - 1, (i + 1) * 3)];
        s.position.copy(h);
      });
      const flap = Math.sin(D.t * 9) * 0.7;
      wings.forEach((w, i) => {
        w.position.copy(segs[2].position);
        w.quaternion.copy(head.quaternion);
        w.rotateZ(i === 0 ? flap : -flap);
      });
      for (let n = 0; n < 6; n++) trail.emit(p.x + R(0.3), p.y + R(0.3), p.z + R(0.3), R(1.2), R(1.2), R(1.2), 0.8 + Math.random() * 0.6, 0.35, 0.04, 1.2);
      if (k >= 1) {
        D.on = false;
        dragon.visible = false;
        burst(p, 'gold', 2.2);
        burst(p, 'red', 1.6);
        burst(p, 'white', 1.4);
        D.burst?.(p);
      }
    }
    // fireflies by night, butterflies by day
    flyMat.uniforms.uTime.value = t;
    flyMat.uniforms.uOn.value = night;
    flies.visible = night > 0.02;
    butter.visible = day > 0.3;
    if (butter.visible) {
      flutter.forEach((b, i) => {
        const a = t * b.sp + b.ph;
        const x = b.x + Math.cos(a) * b.r;
        const z = b.z + Math.sin(a * 1.3) * b.r;
        const y = b.y + 0.6 + Math.sin(a * 3) * 0.3;
        const yaw = -a;
        const f = Math.sin(t * 22 + b.ph) * 1.1;
        for (let s = 0; s < 2; s++) {
          e.set(0, yaw, s ? f : Math.PI - f);
          q.setFromEuler(e);
          m4.compose(v.set(x, y, z), q, one);
          butter.setMatrixAt(i * 2 + s, m4);
        }
      });
      butter.instanceMatrix.needsUpdate = true;
    }
  };

  return {
    burst,
    rocket,
    startDragon,
    get dragonOn() {
      return D.on;
    },
    showRings,
    placeFlies,
    placeButterflies,
    pop,
    puff,
    chimney,
    flame,
    step,
    swatch: SWATCH,
  };
}

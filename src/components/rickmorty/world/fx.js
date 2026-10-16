// The C-137 world's effects, for ./scene.js: green sparks (a thing done),
// rings on the ground (the cruiser boarding or landing, doors you can use),
// the show's green portal swirl opening and closing, and soft round shadows
// under Morty and the cruiser. None of it is inked.

import * as THREE from 'three';
import { hot } from '../stage';
import { dotTexture } from '../../middleearth/towns/bake';
import { SWIRL_GLSL } from '../swirl';

// The show's portal: a swirl disc w × h, standing, that opens (0…1).
export function portalMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    premultipliedAlpha: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
    uniforms: { t: { value: 0 }, open: { value: 1 }, seed: { value: Math.random() * 10 } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform float t, open, seed;
      varying vec2 vUv;
      ${SWIRL_GLSL}
      void main() {
        vec4 c = portal((vUv * 2.0 - 1.0) * 1.22, t, open, seed);
        if (c.a < 0.004) discard;
        gl_FragColor = vec4(c.rgb * 1.6, c.a);
      }`,
  });
}

export function createFx() {
  const group = new THREE.Group();
  group.name = 'fx';
  const spot = dotTexture();

  // ── sparks: points that fly up and fall, each with its own life ──
  const N = 240;
  const pos = new Float32Array(N * 3);
  const vel = new Float32Array(N * 3);
  const life = new Float32Array(N);
  const size = new Float32Array(N);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aLife', new THREE.BufferAttribute(life, 1));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  const sparkMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { map: { value: spot }, col: { value: hot(0x8dff4a, 2.2) }, scale: { value: 300 } },
    vertexShader: `
      attribute float aLife, aSize;
      uniform float scale;
      varying float vLife;
      void main() {
        vLife = aLife;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aLife > 0.0 ? aSize * scale / -mv.z : 0.0;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform sampler2D map;
      uniform vec3 col;
      varying float vLife;
      void main() {
        float a = texture2D(map, gl_PointCoord).a * clamp(vLife * 2.0, 0.0, 1.0);
        if (a < 0.01) discard;
        gl_FragColor = vec4(col * a, a);
      }`,
  });
  const sparks = new THREE.Points(geo, sparkMat);
  sparks.frustumCulled = false;
  group.add(sparks);
  let next = 0;
  let live = false; // any sparks in the air (or just landed, to clear them)
  const burst = (x, y, z, n = 90, speed = 4) => {
    for (let k = 0; k < n; k++) {
      const i = next;
      next = (next + 1) % N;
      const a = Math.random() * Math.PI * 2;
      const up = 0.4 + Math.random() * 0.9;
      const s = speed * (0.4 + Math.random() * 0.8);
      pos.set([x, y, z], i * 3);
      vel.set([Math.cos(a) * s * 0.6, up * s, Math.sin(a) * s * 0.6], i * 3);
      life[i] = 0.9 + Math.random() * 0.8;
      size[i] = 0.12 + Math.random() * 0.16;
    }
    live = true;
  };

  // ── rings on the ground that grow and fade ──
  const ringGeo = new THREE.RingGeometry(0.8, 1, 48).rotateX(-Math.PI / 2);
  const rings = [];
  const ring = (x, y, z, color = 0xffffff, grow = 5, time = 0.8) => {
    const mat = new THREE.MeshBasicMaterial({ color: hot(color, 1.2), transparent: true, depthWrite: false, opacity: 0.8 });
    const mesh = new THREE.Mesh(ringGeo, mat);
    mesh.position.set(x, y + 0.04, z);
    group.add(mesh);
    rings.push({ mesh, age: 0, time, grow });
  };

  // ── the portal: opens, holds, closes ──
  const portalMat = portalMaterial();
  const portal = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 2.9), portalMat);
  portal.visible = false;
  group.add(portal);
  let portalAge = -1;
  const openPortal = (x, z, y = 0) => {
    portal.position.set(x, y + 1.45, z);
    portalAge = 0;
    portal.visible = true;
    burst(x, y + 1.2, z, 60, 3);
  };

  // ── soft shadows on the ground ──
  const shadowMat = new THREE.MeshBasicMaterial({ map: spot, color: 0x0b1a10, transparent: true, depthWrite: false, opacity: 0.35, polygonOffset: true, polygonOffsetFactor: -2 });
  const blob = (r) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2).rotateX(-Math.PI / 2), shadowMat.clone());
    mesh.renderOrder = 1;
    group.add(mesh);
    return mesh;
  };

  // the doors' glowing rings, and the marker over the thing you're next to
  const markGeo = new THREE.RingGeometry(0.62, 0.78, 40).rotateX(-Math.PI / 2);
  const markMat = new THREE.MeshBasicMaterial({ color: hot(0x9dff5a, 1.6), transparent: true, depthWrite: false, opacity: 0.55 });
  const marks = new Map();
  const markAt = (id, x, y, z) => {
    const m = new THREE.Mesh(markGeo, markMat.clone());
    m.position.set(x, y + 0.05, z);
    group.add(m);
    marks.set(id, m);
    return m;
  };
  const pin = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.42, 4).rotateX(Math.PI), new THREE.MeshBasicMaterial({ color: hot(0x9dff5a, 2) }));
  pin.visible = false;
  group.add(pin);

  const update = (dt, t) => {
    if (live) {
      live = false;
      for (let i = 0; i < N; i++) {
        if (life[i] <= 0) continue;
        life[i] -= dt;
        live = true;
        vel[i * 3 + 1] -= 6 * dt;
        for (let a = 0; a < 3; a++) pos[i * 3 + a] += vel[i * 3 + a] * dt;
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.aLife.needsUpdate = true;
      geo.attributes.aSize.needsUpdate = true;
    }
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i];
      r.age += dt;
      const k = r.age / r.time;
      r.mesh.scale.setScalar(0.4 + k * r.grow);
      r.mesh.material.opacity = 0.8 * (1 - k);
      if (k >= 1) {
        r.mesh.removeFromParent();
        r.mesh.material.dispose();
        rings.splice(i, 1);
      }
    }
    if (portalAge >= 0) {
      portalAge += dt;
      const open = portalAge < 0.35 ? portalAge / 0.35 : portalAge < 1.1 ? 1 : Math.max(0, 1 - (portalAge - 1.1) / 0.4);
      portalMat.uniforms.open.value = open;
      portalMat.uniforms.t.value = t;
      if (portalAge > 1.5) {
        portalAge = -1;
        portal.visible = false;
      }
    }
    for (const m of marks.values()) m.material.opacity = (m.userData.near ? 0.85 : 0.35) + Math.sin(t * 4) * 0.12;
    pin.position.y = (pin.userData.y ?? 0) + Math.sin(t * 3.2) * 0.1;
    pin.rotation.y = t * 1.5;
  };

  const dispose = () => {
    spot.dispose();
    for (const r of rings) r.mesh.material.dispose();
  };

  return { group, spot, burst, ring, openPortal, blob, markAt, marks, pin, update, dispose, portal };
}

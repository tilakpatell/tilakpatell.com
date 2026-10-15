// Hold the Lawn's models: Mjolnir, Thor's cape, the Chitauri chariot, the rain,
// the portal over the trees, and lightning.

import * as THREE from 'three';
import { hot } from '../hq/stage';
import { PartBuilder, canvasTexture, rbox, taper } from '../hq/kit/shapes';

// Knotwork for the hammer's ends: interlaced loops, as a bump map.
export function knotTexture() {
  return canvasTexture(
    256,
    256,
    (x, w) => {
      x.fillStyle = '#808080';
      x.fillRect(0, 0, w, w);
      const c = w / 2;
      x.lineCap = 'round';
      const ring = (r, lw, color) => {
        x.strokeStyle = color;
        x.lineWidth = lw;
        x.beginPath();
        x.arc(c, c, r, 0, Math.PI * 2);
        x.stroke();
      };
      ring(c * 0.86, 10, '#d8d8d8');
      ring(c * 0.86, 4, '#5a5a5a');
      // four interlaced loops, each over then under its neighbour
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2 + Math.PI / 4;
        const cx = c + Math.cos(a) * c * 0.32;
        const cy = c + Math.sin(a) * c * 0.32;
        x.strokeStyle = '#e6e6e6';
        x.lineWidth = 14;
        x.beginPath();
        x.arc(cx, cy, c * 0.34, a + 0.6, a + Math.PI * 2 - 0.6);
        x.stroke();
        x.strokeStyle = '#4a4a4a';
        x.lineWidth = 3;
        x.stroke();
      }
      ring(c * 0.16, 12, '#e6e6e6');
    },
    { srgb: false },
  );
}

// Mjolnir, its grip at the origin, the head up (+y).
export function buildMjolnir(mats) {
  const g = new THREE.Group();
  const knot = knotTexture();
  const uru = mats.uru;
  const ends = mats.ends ?? uru.clone();
  ends.bumpMap = knot;
  ends.bumpScale = 3;
  // the head: its ends (±x) carry the knotwork
  const head = new THREE.Mesh(rbox(0.32, 0.19, 0.19, 0.025, 2), [ends, ends, uru, uru, uru, uru]);
  head.position.y = 0.28;
  g.add(head);
  // a band of runes round the middle
  const band = new THREE.Mesh(rbox(0.06, 0.195, 0.195, 0.01, 1), mats.dark);
  band.position.y = 0.28;
  g.add(band);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.033, 0.38, 14), mats.grip);
  shaft.position.y = 0;
  g.add(shaft);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.038, 0.035, 14), uru);
  collar.position.y = 0.175;
  g.add(collar);
  const pommel = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.044, 0.05, 14), uru);
  pommel.position.y = -0.2;
  g.add(pommel);
  const strap = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.008, 6, 20), mats.grip);
  strap.position.y = -0.28;
  strap.scale.set(0.7, 1.4, 1);
  g.add(strap);
  g.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return { group: g, head };
}

// Thor's cape: a cloth that hangs from the shoulders and streams back in the
// wind; `update` moves it.
export function buildCape(mat) {
  const W = 0.62;
  const H = 1.35;
  const geo = new THREE.PlaneGeometry(W, H, 8, 14).translate(0, -H / 2, 0);
  const base = geo.attributes.position.array.slice();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  const update = (t, { wind = 1, run = 0, lift = 0 } = {}) => {
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = base[i * 3];
      const y = base[i * 3 + 1];
      const k = -y / H; // 0 at the shoulders, 1 at the hem
      const wave = Math.sin(t * 3.1 + k * 5 + x * 3) * 0.08 + Math.sin(t * 5.3 + k * 9) * 0.03;
      const back = (0.18 + wind * 0.25 + run * 0.35 + lift * 0.5) * k * k + wave * k * (0.6 + wind);
      // the hem spreads a little and lifts as it streams
      p.setXYZ(i, x * (1 + k * 0.25), y + back * 0.35, -back - 0.02);
    }
    p.needsUpdate = true;
    geo.computeVertexNormals();
  };
  update(0);
  return { mesh, update };
}

// A Chitauri chariot: a long armoured sled with two engines, its nose along +z.
export function buildChariot(mats) {
  const b = new PartBuilder();
  b.add('armour', taper(rbox(0.95, 0.32, 3.4, 0.1), 1, 0.35, { axis: 'z' }), { p: [0, 0, 0.1] });
  b.add('armour', taper(rbox(0.5, 0.22, 1.2, 0.06), 1, 0.4, { axis: 'z' }), { p: [0, 0.22, 1.1], r: [-0.08, 0, 0] }); // the prow
  b.add('dark', rbox(0.8, 0.08, 1.6, 0.03), { p: [0, 0.2, -0.5] }); // the deck the rider stands on
  for (const sd of [-1, 1]) {
    b.add('armour', taper(rbox(0.7, 0.06, 1.1, 0.02), 1, 0.3, { axis: 'x' }), { p: [sd * 0.75, -0.05, -0.7], r: [0, 0, sd * -0.25] }); // fins
    b.add('dark', new THREE.CylinderGeometry(0.17, 0.2, 0.7, 14).rotateX(Math.PI / 2), { p: [sd * 0.38, -0.08, -1.55] }); // engines
    b.add('glow', new THREE.CircleGeometry(0.15, 14).rotateY(Math.PI), { p: [sd * 0.38, -0.08, -1.91] });
    b.add('armour', rbox(0.05, 0.6, 0.05, 0.015), { p: [sd * 0.3, 0.5, -0.1] }); // the rail
  }
  b.add('armour', rbox(0.65, 0.05, 0.05, 0.015), { p: [0, 0.8, -0.1] });
  b.add('glow', rbox(0.06, 0.03, 2.2, 0.01), { p: [0, -0.17, 0.2] }); // underglow
  return b.build(mats);
}

// Rain: streaks falling in a box that follows the camera.
export function buildRain({ count = 3500, size = [44, 26, 44], calm = false } = {}) {
  const pos = new Float32Array(count * 2 * 3);
  const seed = new Float32Array(count * 2);
  const end = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const x = (Math.random() - 0.5) * size[0];
    const y = Math.random() * size[1];
    const z = (Math.random() - 0.5) * size[2];
    // one seed for both ends: ends falling at different speeds drift apart and
    // wrap at different times, stretching the streak across the whole volume
    const s = Math.random();
    for (let k = 0; k < 2; k++) {
      pos.set([x, y, z], (i * 2 + k) * 3);
      seed[i * 2 + k] = s;
      end[i * 2 + k] = k;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  geo.setAttribute('end', new THREE.BufferAttribute(end, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uTime: { value: 0 }, uCenter: { value: new THREE.Vector3() }, uSize: { value: new THREE.Vector3(...size) }, uSpeed: { value: calm ? 8 : 19 }, uWind: { value: new THREE.Vector2(-2.5, 1.2) }, uFlash: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute float seed;
      attribute float end;
      uniform float uTime, uSpeed, uFlash;
      uniform vec3 uCenter, uSize;
      uniform vec2 uWind;
      varying float vA;
      void main() {
        vec3 p = position;
        float fall = uTime * uSpeed * (0.85 + seed * 0.3);
        p.y = mod(p.y - fall, uSize.y);
        p.x += uWind.x * (uSize.y - p.y) / uSpeed;
        p.z += uWind.y * (uSize.y - p.y) / uSpeed;
        // wrap round the camera
        p.xz = mod(p.xz - uCenter.xz + uSize.xz * 0.5, uSize.xz) - uSize.xz * 0.5 + uCenter.xz;
        // a streak: the top end trails behind the fall
        vec3 dir = normalize(vec3(-uWind.x, uSpeed, -uWind.y));
        p += dir * end * 0.6;
        // fainter close up, where a streak would be long on screen
        float near = smoothstep(1.5, 7.0, distance(p, cameraPosition));
        vA = (0.16 + uFlash * 0.3) * (0.5 + seed * 0.5) * (1.0 - end * 0.85) * near;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      varying float vA;
      void main() { gl_FragColor = vec4(0.72, 0.8, 0.95, vA); }`,
  });
  const lines = new THREE.LineSegments(geo, mat);
  lines.frustumCulled = false;
  lines.renderOrder = 9;
  return { lines, mat };
}

// The portal over the trees: a swirl of dark sky with a burning blue rim.
export function buildPortal(radius = 26) {
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: false,
    uniforms: { uTime: { value: 0 }, uFlash: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uFlash;
      varying vec2 vUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
      }
      void main() {
        float r = length(vUv);
        if (r > 1.0) discard;
        float a = atan(vUv.y, vUv.x);
        // the swirl: noise in polar coordinates, wound tighter toward the middle
        float s = a + uTime * 0.12 + 1.6 / (r + 0.25);
        float n = noise(vec2(cos(s), sin(s)) * 3.0 + r * 4.0 - uTime * 0.3) * 0.6 + noise(vec2(s * 2.0, r * 10.0 - uTime)) * 0.4;
        vec3 deep = vec3(0.01, 0.015, 0.04);
        vec3 cloud = mix(vec3(0.05, 0.12, 0.3), vec3(0.4, 0.75, 1.2), n * n);
        float rim = smoothstep(0.72, 0.97, r) * (1.0 - smoothstep(0.97, 1.0, r));
        vec3 col = mix(deep, cloud, smoothstep(0.15, 0.95, r) * (0.35 + n * 0.65));
        col += vec3(0.6, 0.9, 1.6) * rim * (2.2 + n * 2.0 + uFlash * 2.0);
        // a few stars deep inside
        float st = step(0.992, hash(floor(vUv * 90.0))) * (1.0 - smoothstep(0.2, 0.6, r));
        col += st * 1.2;
        float alpha = smoothstep(1.0, 0.94, r);
        gl_FragColor = vec4(col, alpha);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(radius, 64), mat);
  mesh.renderOrder = -2;
  return { mesh, mat };
}

// Lightning: jagged ribbons between two points, with forks, drawn bright for
// the bloom. A pool, so a storm costs nothing new.
export function lightningPool(scene, n = 10) {
  const MAX = 64; // points per bolt, forks included
  const pool = Array.from({ length: n }, () => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX * 6 * 3), 3));
    geo.setAttribute('alpha', new THREE.BufferAttribute(new Float32Array(MAX * 6), 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      fog: false,
      // the ribbon's quads are wound away from the camera; seen from either side
      side: THREE.DoubleSide,
      uniforms: { uColor: { value: hot(0xcfe6ff, 4) }, uFade: { value: 1 } },
      vertexShader: /* glsl */ `attribute float alpha; varying float vA; void main() { vA = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `uniform vec3 uColor; uniform float uFade; varying float vA; void main() { gl_FragColor = vec4(uColor * vA * uFade, 1.0); }`,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.visible = false;
    mesh.renderOrder = 10;
    scene.add(mesh);
    return { mesh, geo, mat, life: 0, age: 0, count: 0 };
  });
  let next = 0;
  const v = new THREE.Vector3();
  const side = new THREE.Vector3();
  const view = new THREE.Vector3();

  // a jagged path from a to b, `jag` its wildness
  const path = (a, b, jag, steps) => {
    const pts = [a.clone()];
    const len = a.distanceTo(b);
    for (let i = 1; i < steps; i++) {
      const p = a.clone().lerp(b, i / steps);
      const k = Math.sin((i / steps) * Math.PI);
      p.x += (Math.random() - 0.5) * len * jag * k;
      p.y += (Math.random() - 0.5) * len * jag * 0.5 * k;
      p.z += (Math.random() - 0.5) * len * jag * k;
      pts.push(p);
    }
    pts.push(b.clone());
    return pts;
  };

  // strike from a to b; `camera` turns the ribbon toward the view
  const strike = (a, b, camera, { width = 0.22, jag = 0.12, forks = 2, life = 0.45, color = 0xcfe6ff, k = 2.5 } = {}) => {
    const s = pool[next];
    next = (next + 1) % pool.length;
    const strands = [path(a, b, jag, 14)];
    for (let f = 0; f < forks; f++) {
      const main = strands[0];
      const from = main[3 + Math.floor(Math.random() * 8)];
      const to = from.clone().add(new THREE.Vector3((Math.random() - 0.5) * 6, -2 - Math.random() * 5, (Math.random() - 0.5) * 6));
      strands.push(path(from, to, jag * 1.4, 5));
    }
    const pos = s.geo.attributes.position.array;
    const al = s.geo.attributes.alpha.array;
    let q = 0;
    for (const [si, pts] of strands.entries()) {
      const w = si ? width * 0.45 : width;
      for (let i = 0; i < pts.length - 1 && q < MAX; i++) {
        const p0 = pts[i];
        const p1 = pts[i + 1];
        v.copy(p1).sub(p0).normalize();
        view.copy(camera.position).sub(p0).normalize();
        side.crossVectors(v, view).normalize().multiplyScalar(w);
        const corners = [p0.clone().add(side), p0.clone().sub(side), p1.clone().add(side), p1.clone().sub(side)];
        const order = [0, 1, 2, 2, 1, 3];
        for (let j = 0; j < 6; j++) {
          const c = corners[order[j]];
          pos.set([c.x, c.y, c.z], (q * 6 + j) * 3);
          al[q * 6 + j] = si ? 0.6 : 1;
        }
        q++;
      }
    }
    s.count = q;
    s.geo.setDrawRange(0, q * 6);
    s.geo.attributes.position.needsUpdate = true;
    s.geo.attributes.alpha.needsUpdate = true;
    s.mat.uniforms.uColor.value.copy(hot(color, k));
    s.life = life;
    s.age = 0;
    s.mesh.visible = true;
  };

  const update = (dt) => {
    for (const s of pool) {
      if (!s.mesh.visible) continue;
      s.age += dt;
      if (s.age >= s.life) {
        s.mesh.visible = false;
        continue;
      }
      // a flicker, then a fade
      const k = s.age / s.life;
      s.mat.uniforms.uFade.value = (1 - k) * (0.6 + 0.4 * Math.sin(s.age * 90) ** 2);
    }
  };
  return { strike, update };
}

// The crater the hammer waits in: cracked paving round a scorched middle.
export function craterTexture() {
  return canvasTexture(512, 512, (x, w) => {
    x.clearRect(0, 0, w, w);
    const c = w / 2;
    const g = x.createRadialGradient(c, c, 0, c, c, c);
    g.addColorStop(0, 'rgba(10,10,12,0.95)');
    g.addColorStop(0.35, 'rgba(25,24,26,0.8)');
    g.addColorStop(1, 'rgba(30,30,32,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, w, w);
    x.strokeStyle = 'rgba(8,8,10,0.85)';
    x.lineCap = 'round';
    let s = 7;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 14; i++) {
      let a = (i / 14) * Math.PI * 2 + r() * 0.3;
      let px = c + Math.cos(a) * c * 0.15;
      let py = c + Math.sin(a) * c * 0.15;
      x.lineWidth = 3 + r() * 3;
      x.beginPath();
      x.moveTo(px, py);
      for (let k = 0; k < 6; k++) {
        a += (r() - 0.5) * 0.7;
        const step = c * (0.08 + r() * 0.08);
        px += Math.cos(a) * step;
        py += Math.sin(a) * step;
        x.lineTo(px, py);
        x.lineWidth *= 0.8;
      }
      x.stroke();
    }
  });
}

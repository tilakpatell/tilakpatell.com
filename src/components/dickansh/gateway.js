// The gateway: a South Indian temple courtyard at dusk. A carved stone arch
// stands on a kolam, with the portal to the Dhurandhar universe swirling in
// its doorway; the gopuram rises behind it, coconut palms either side, Nandi
// and Ganesha keep the gate, brass lamps and a path of diyas lead up to it,
// marigold garlands hang across it, and the giant fan cutouts that go up
// outside a cinema on release day (Pushpa 2 and Dhurandhar) tower over the
// courtyard. Embers drift up into the sky.
//
// build({ renderer, still }) → { scene, portal, portalCenter, update(dt, t), ready, dispose }
// (`still` is a Dhurandhar still, seen through the portal.)

import * as THREE from 'three';
import { loadGltf } from '../../lib/three/gltf';
import { courtyardTexture, flameTexture, glowTexture, rng } from './textures';
import { sharpen } from '../../lib/three/textures';

export const ARCH = { halfWidth: 2.1, lintel: 3.5, notchHalf: 1.3, top: 4.6 }; // the doorway, in metres
const MODELS = {
  arch: '/models/dickansh/arch.glb',
  gopuram: '/models/dickansh/gopuram.glb',
  kit: '/models/dickansh/kit.glb',
  palm: '/models/dickansh/palm.glb',
  nandi: '/models/dickansh/nandi.glb',
  ganesha: '/models/dickansh/ganesha.glb',
  diya: '/models/dickansh/diya.glb',
};
const CUTOUTS = ['/dickansh/posters/pushpa-01.webp', '/dickansh/posters/pushpa-06.webp', '/dickansh/posters/dhurandhar-02.webp', '/dickansh/posters/dhurandhar-07.webp'];

const SKY_VS = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * p;
  gl_Position.z = gl_Position.w; // always at the back
}`;
const SKY_FS = /* glsl */ `
varying vec3 vDir;
uniform vec3 sunDir;
uniform float time;
float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 horizon = vec3(1.0, 0.46, 0.18);
  vec3 mid = vec3(0.78, 0.25, 0.32);
  vec3 top = vec3(0.07, 0.05, 0.2);
  vec3 col = mix(horizon, mid, smoothstep(0.0, 0.18, h));
  col = mix(col, top, smoothstep(0.12, 0.7, h));
  float s = max(dot(d, sunDir), 0.0);
  col += vec3(1.0, 0.55, 0.2) * pow(s, 6.0) * 0.55 + vec3(1.0, 0.85, 0.6) * pow(s, 900.0) * 6.0;
  // the first stars
  vec3 q = floor(d * 380.0);
  float st = step(0.9975, hash(q)) * smoothstep(0.25, 0.7, h);
  col += vec3(st) * (0.6 + 0.4 * sin(time * 2.0 + hash(q + 1.0) * 40.0));
  col = mix(col, vec3(0.16, 0.08, 0.06), smoothstep(0.0, -0.06, h));
  gl_FragColor = vec4(col, 1.0);
}`;

const PORTAL_VS = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const PORTAL_FS = /* glsl */ `
varying vec2 vUv;
uniform float time;
uniform float power;
uniform sampler2D still;
uniform vec2 size; // metres
uniform vec4 arch; // halfWidth, lintel, notchHalf, top
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
float sdBox(vec2 p, vec2 c, vec2 b) { vec2 d = abs(p - c) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
void main() {
  vec2 p = vec2((vUv.x - 0.5) * size.x, vUv.y * size.y); // metres, from the threshold's middle
  float d = min(sdBox(p, vec2(0.0, arch.y * 0.5), vec2(arch.x, arch.y * 0.5)), sdBox(p, vec2(0.0, arch.w * 0.5), vec2(arch.z, arch.w * 0.5)));
  if (d > 0.02) discard;
  vec2 c = vec2(0.0, 2.1);
  vec2 q = p - c;
  float r = length(q);
  float a = atan(q.y, q.x);
  float swirl = a + 2.6 / (r + 0.35) - time * 1.4;
  vec2 sp = vec2(cos(swirl), sin(swirl)) * r;
  // noise read round a circle, so there's no seam where the angle wraps
  float n = fbm(vec2(cos(swirl), sin(swirl)) * 2.0 + vec2(log(r + 0.05) * 2.6 - time * 1.4, 0.0));
  vec3 fire = mix(vec3(0.55, 0.02, 0.04), vec3(1.0, 0.45, 0.05), n);
  fire = mix(fire, vec3(1.0, 0.85, 0.45), smoothstep(0.62, 0.9, n));
  // the other side, through the swirl: a still from Dhurandhar
  vec2 suv = clamp(vec2(0.5 + sp.x * 0.2, 0.5 + sp.y * 0.24), 0.0, 1.0);
  vec3 other = texture2D(still, suv).rgb;
  float see = smoothstep(1.9, 0.2, r) * 0.75;
  vec3 col = mix(fire, other * 1.3 + fire * 0.25, see * (0.5 + 0.5 * power));
  col += vec3(1.0, 0.9, 0.7) * smoothstep(0.5, 0.0, r) * (0.6 + power * 2.0);
  // a hot rim along the stone
  col += vec3(1.0, 0.55, 0.15) * smoothstep(-0.25, 0.0, d) * 1.2;
  float alpha = smoothstep(0.02, -0.06, d);
  gl_FragColor = vec4(col * (0.75 + power * 0.7), alpha);
}`;

function catenary(a, b, sag, n) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = new THREE.Vector3().lerpVectors(a, b, t);
    p.y -= Math.sin(t * Math.PI) * sag;
    pts.push(p);
  }
  return pts;
}

// a tall brass kuthuvilakku: a turned stem on a round foot, a dish of five flames on top
function brassLamp(flames) {
  const g = new THREE.Group();
  const brass = new THREE.MeshStandardMaterial({ color: 0xd9a441, metalness: 1, roughness: 0.25 });
  const prof = [
    [0.0, 0.0], [0.42, 0.0], [0.44, 0.05], [0.3, 0.12], [0.12, 0.2], [0.07, 0.35], [0.09, 0.42], [0.06, 0.5],
    [0.05, 1.3], [0.09, 1.36], [0.05, 1.42], [0.05, 1.7], [0.1, 1.76], [0.06, 1.82], [0.3, 1.9], [0.34, 1.96], [0.3, 1.98], [0.06, 2.0],
    [0.04, 2.15], [0.08, 2.2], [0.02, 2.4], [0.0, 2.42],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 40), brass);
  body.castShadow = true;
  g.add(body);
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    flames.push({ parent: g, pos: new THREE.Vector3(Math.cos(a) * 0.28, 2.08, Math.sin(a) * 0.28), scale: 0.22 });
  }
  return g;
}

export function build({ renderer, still }) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x6a2a2a, 60, 190);
  const r = rng(21);
  const disposables = [];
  const keep = (x) => (disposables.push(x), x);
  const sunDir = new THREE.Vector3(-0.55, 0.1, -0.83).normalize();

  // the sky
  const sky = new THREE.Mesh(
    keep(new THREE.SphereGeometry(500, 48, 24)),
    keep(new THREE.ShaderMaterial({ vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false, uniforms: { sunDir: { value: sunDir }, time: { value: 0 } } })),
  );
  sky.frustumCulled = false;
  scene.add(sky);

  // light: dusk, a low sun behind the gopuram's shoulder, warm bounce off the stone
  scene.add(new THREE.HemisphereLight(0xffb48a, 0x3a1a10, 0.6));
  const sun = new THREE.DirectionalLight(0xffa060, 1.5);
  sun.position.set(-34, 22, -40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 140 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
  scene.add(sun);
  const front = new THREE.DirectionalLight(0xffd2a8, 0.6);
  front.position.set(10, 14, 30);
  scene.add(front);

  // the ground: the courtyard, and beyond it red earth
  const courtTex = keep(courtyardTexture());
  courtTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const court = new THREE.Mesh(keep(new THREE.PlaneGeometry(36, 36)), keep(new THREE.MeshStandardMaterial({ map: courtTex, roughness: 0.92 })));
  court.rotation.x = -Math.PI / 2;
  court.position.set(0, 0, 11);
  court.receiveShadow = true;
  scene.add(court);
  const earth = new THREE.Mesh(keep(new THREE.CircleGeometry(400, 64)), keep(new THREE.MeshStandardMaterial({ color: 0x5a2c1c, roughness: 1 })));
  earth.rotation.x = -Math.PI / 2;
  earth.position.y = -0.02;
  earth.receiveShadow = true;
  scene.add(earth);

  // the portal, in the arch's doorway
  const pw = ARCH.halfWidth * 2 + 0.1;
  const ph = ARCH.top + 0.05;
  const portalMat = keep(
    new THREE.ShaderMaterial({
      vertexShader: PORTAL_VS,
      fragmentShader: PORTAL_FS,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
      uniforms: { time: { value: 0 }, power: { value: 0 }, still: { value: still }, size: { value: new THREE.Vector2(pw, ph) }, arch: { value: new THREE.Vector4(ARCH.halfWidth, ARCH.lintel, ARCH.notchHalf, ARCH.top) } },
    }),
  );
  const portal = new THREE.Mesh(keep(new THREE.PlaneGeometry(pw, ph)), portalMat);
  portal.position.set(0, ph / 2, 0);
  scene.add(portal);
  const portalLight = new THREE.PointLight(0xff7a2a, 16, 22, 1.6);
  portalLight.position.set(0, 2.2, 1.6);
  scene.add(portalLight);
  const portalCenter = new THREE.Vector3(0, 2.1, 0);

  // flames: the brass lamps', the diyas' (sprites, flickering)
  const flames = [];
  const flameTex = keep(flameTexture());
  const glowTex = keep(glowTexture());
  for (const s of [-1, 1]) {
    const lamp = brassLamp(flames);
    lamp.position.set(s * 3.7, 0, 2.4);
    scene.add(lamp);
  }
  const lampLights = [-1, 1].map((s) => {
    const l = new THREE.PointLight(0xffa040, 3.5, 9, 1.8);
    l.position.set(s * 3.7, 2.3, 2.6);
    scene.add(l);
    return l;
  });

  // marigold garlands, swagged across the arch and hanging down its pillars
  const marigold = keep(new THREE.IcosahedronGeometry(0.075, 1));
  const garlandPts = [];
  const swags = [
    [-4.2, 6.1, 4.2, 6.1, 0.9],
    [-4.2, 6.1, 0, 6.3, 0.55],
    [0, 6.3, 4.2, 6.1, 0.55],
    [-2.2, 4.8, 2.2, 4.8, 0.35],
  ];
  for (const [x0, y0, x1, y1, sag] of swags) garlandPts.push(...catenary(new THREE.Vector3(x0, y0, 1.4), new THREE.Vector3(x1, y1, 1.4), sag, Math.round(Math.abs(x1 - x0) * 9)));
  for (const x of [-4.2, -2.3, 2.3, 4.2]) for (let k = 0; k < 18; k++) garlandPts.push(new THREE.Vector3(x, 6.0 - k * 0.12, 1.4));
  const garland = new THREE.InstancedMesh(marigold, keep(new THREE.MeshStandardMaterial({ roughness: 0.7, emissive: 0x401000 })), garlandPts.length);
  const m4 = new THREE.Matrix4();
  const col = new THREE.Color();
  garlandPts.forEach((p, i) => {
    m4.makeRotationFromEuler(new THREE.Euler(r() * 3, r() * 3, 0)).setPosition(p);
    garland.setMatrixAt(i, m4);
    garland.setColorAt(i, col.set(i % 3 === 0 ? 0xffc21a : i % 7 === 0 ? 0xd0213a : 0xff8a10));
  });
  scene.add(garland);

  // the cutouts: fan banners on bamboo scaffolds, a garland along each top
  const loader = new THREE.TextureLoader();
  const cutouts = [
    { x: -12.5, z: -1.5, ry: 0.42, h: 12, src: CUTOUTS[0] },
    { x: 12.5, z: -1.5, ry: -0.42, h: 12, src: CUTOUTS[2] },
    { x: -20.5, z: -9, ry: 0.55, h: 14, src: CUTOUTS[1] },
    { x: 20.5, z: -9, ry: -0.55, h: 14, src: CUTOUTS[3] },
  ];
  const bamboo = keep(new THREE.MeshStandardMaterial({ color: 0xb08a4a, roughness: 0.8 }));
  const pole = keep(new THREE.CylinderGeometry(0.07, 0.08, 1, 8));
  const posters = [];
  for (const c of cutouts) {
    const w = c.h * (2 / 3);
    const g = new THREE.Group();
    const tex = keep(loader.load(c.src));
    sharpen(tex, { color: true });
    const mat = keep(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.08 }));
    posters.push(mat);
    const board = new THREE.Mesh(keep(new THREE.PlaneGeometry(w, c.h)), mat);
    board.position.y = c.h / 2 + 1.2;
    board.castShadow = true;
    g.add(board);
    const backing = new THREE.Mesh(keep(new THREE.PlaneGeometry(w, c.h)), keep(new THREE.MeshStandardMaterial({ color: 0x2a1a10, side: THREE.BackSide })));
    backing.position.copy(board.position);
    g.add(backing);
    for (const px of [-w / 2 + 0.4, 0, w / 2 - 0.4])
      for (const pz of [-0.3, -1.6]) {
        const p = new THREE.Mesh(pole, bamboo);
        p.scale.y = c.h + 1.4;
        p.position.set(px, (c.h + 1.4) / 2, pz);
        p.castShadow = true;
        g.add(p);
      }
    for (let y = 1.5; y < c.h + 1; y += 2.2) {
      const p = new THREE.Mesh(pole, bamboo);
      p.scale.y = w;
      p.rotation.z = Math.PI / 2;
      p.position.set(0, y, -0.95);
      g.add(p);
    }
    const top = catenary(new THREE.Vector3(-w / 2, c.h + 1.2, 0.08), new THREE.Vector3(w / 2, c.h + 1.2, 0.08), 0.9, 44);
    const side = [...catenary(new THREE.Vector3(-w / 2, c.h + 1.2, 0.08), new THREE.Vector3(-w / 2, 1.4, 0.08), 0, 40), ...catenary(new THREE.Vector3(w / 2, c.h + 1.2, 0.08), new THREE.Vector3(w / 2, 1.4, 0.08), 0, 40)];
    const all = [...top, ...side];
    const gm = new THREE.InstancedMesh(marigold, garland.material, all.length);
    all.forEach((p, i) => {
      m4.makeScale(1.6, 1.6, 1.6).setPosition(p);
      gm.setMatrixAt(i, m4);
      gm.setColorAt(i, col.set(i % 2 ? 0xff8a10 : 0xffc21a));
    });
    g.add(gm);
    g.position.set(c.x, 0, c.z);
    g.rotation.y = c.ry;
    scene.add(g);
  }

  // embers, rising
  const EMBERS = 260;
  const emberGeo = keep(new THREE.BufferGeometry());
  const ep = new Float32Array(EMBERS * 3);
  const ev = new Float32Array(EMBERS);
  const spawn = (i, anywhere) => {
    const a = r() * Math.PI * 2;
    const rad = 2 + r() * 22;
    ep[i * 3] = Math.cos(a) * rad;
    ep[i * 3 + 1] = anywhere ? r() * 20 : 0;
    ep[i * 3 + 2] = Math.sin(a) * rad * 0.7 + 6;
    ev[i] = 0.3 + r() * 0.9;
  };
  for (let i = 0; i < EMBERS; i++) spawn(i, true);
  emberGeo.setAttribute('position', new THREE.BufferAttribute(ep, 3));
  const embers = new THREE.Points(emberGeo, keep(new THREE.PointsMaterial({ size: 0.16, map: glowTex, color: 0xffa040, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })));
  embers.frustumCulled = false;
  scene.add(embers);

  // the models
  let disposed = false;
  const place = async (name, fn) => {
    const got = await loadGltf(MODELS[name], { renderer, fresh: true });
    if (!got || disposed) return null;
    // materials of its own (the loader's copies are shared with every visit,
    // and this tints them), and shadows cast and caught
    got.scene.traverse((o) => {
      if (!o.isMesh) return;
      o.material = Array.isArray(o.material) ? o.material.map((m) => keep(m.clone())) : keep(o.material.clone());
      o.castShadow = o.receiveShadow = true;
    });
    fn(got.scene);
    return got.scene;
  };
  const diyaSpots = [];
  for (let z = 3.2; z < 20; z += 1.7) for (const s of [-1, 1]) diyaSpots.push([s * 2.7, z]);
  for (let k = -3; k <= 3; k++) if (k) diyaSpots.push([k * 0.62, 1.75]);

  const ready = Promise.all([
    place('arch', (m) => {
      // carved sandstone, warm in the lamplight
      m.traverse((o) => {
        if (!o.isMesh) return;
        o.material.color?.set(0xc9a27c);
        o.material.roughness = 0.78;
      });
      scene.add(m);
    }),
    place('gopuram', (m) => {
      m.scale.setScalar(1.6);
      m.position.set(0, 0, -40);
      m.traverse((o) => {
        if (o.isMesh) o.material.color?.multiplyScalar(0.62);
      });
      scene.add(m);
    }),
    place('kit', (m) => {
      m.scale.setScalar(1.25);
      m.position.set(0, 0, -112);
      m.rotation.y = Math.PI;
      scene.add(m);
    }),
    place('palm', (m) => {
      const spots = [
        [-9, 6, 1.3], [9.5, 5, 1.2], [-7.5, 15, 1.1], [8, 16, 1.25], [-16, 9, 1.5], [16.5, 10, 1.4], [-27, -4, 1.6], [27, -3, 1.7], [-6, -14, 1.8], [6.5, -15, 1.7],
      ];
      spots.forEach(([x, z, s], i) => {
        const p = i ? m.clone() : m;
        p.position.set(x, 0, z);
        p.scale.setScalar(s);
        p.rotation.y = r() * Math.PI * 2;
        scene.add(p);
      });
    }),
    place('nandi', (m) => {
      m.position.set(-6.2, 0.45, 6.5);
      m.rotation.y = Math.PI * 0.82;
      scene.add(m);
      const plinth = new THREE.Mesh(keep(new THREE.BoxGeometry(2.2, 0.45, 3.0)), keep(new THREE.MeshStandardMaterial({ color: 0x8a7058, roughness: 0.9 })));
      plinth.position.set(-6.2, 0.225, 6.5);
      plinth.rotation.y = Math.PI * 0.82;
      plinth.castShadow = plinth.receiveShadow = true;
      scene.add(plinth);
    }),
    place('ganesha', (m) => {
      m.position.set(6.2, 0.9, 5.6);
      m.rotation.y = -0.35;
      scene.add(m);
      const plinth = new THREE.Mesh(keep(new THREE.CylinderGeometry(1.15, 1.3, 0.9, 32)), keep(new THREE.MeshStandardMaterial({ color: 0x8a7058, roughness: 0.9 })));
      plinth.position.set(6.2, 0.45, 5.6);
      plinth.castShadow = plinth.receiveShadow = true;
      scene.add(plinth);
    }),
    place('diya', (m) => {
      diyaSpots.forEach(([x, z], i) => {
        const d = i ? m.clone() : m;
        d.position.set(x, 0, z);
        d.scale.setScalar(1.6);
        d.rotation.y = r() * 6;
        scene.add(d);
        flames.push({ parent: scene, pos: new THREE.Vector3(x + 0.0, 0.42, z), scale: 0.2 });
      });
    }),
  ]).then(() => {
    for (const f of flames) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, color: 0xffc070, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
      s.position.copy(f.pos);
      s.scale.set(f.scale * 0.55, f.scale, 1);
      s.userData = { base: f.scale, seed: r() * 100 };
      f.parent.add(s);
      f.sprite = s;
    }
  });

  return {
    scene,
    portal,
    portalCenter,
    ready,
    setPower(p) {
      portalMat.uniforms.power.value = p;
      portalLight.intensity = 16 + p * 90;
    },
    update(dt, t) {
      sky.material.uniforms.time.value = t;
      portalMat.uniforms.time.value = t;
      for (const f of flames) {
        if (!f.sprite) continue;
        const k = 1 + Math.sin(t * 13 + f.sprite.userData.seed) * 0.08 + Math.sin(t * 29 + f.sprite.userData.seed * 2) * 0.05;
        f.sprite.scale.set(f.sprite.userData.base * 0.55 * k, f.sprite.userData.base * k * 1.05, 1);
      }
      for (const l of lampLights) l.intensity = 3.5 + Math.sin(t * 11 + l.position.x) * 0.5;
      for (let i = 0; i < EMBERS; i++) {
        ep[i * 3 + 1] += ev[i] * dt;
        ep[i * 3] += Math.sin(t * 0.7 + i) * dt * 0.2;
        if (ep[i * 3 + 1] > 22) spawn(i, false);
      }
      emberGeo.attributes.position.needsUpdate = true;
    },
    dispose() {
      disposed = true;
      for (const d of disposables) d.dispose?.();
      for (const f of flames) f.sprite?.material.dispose();
    },
  };
}

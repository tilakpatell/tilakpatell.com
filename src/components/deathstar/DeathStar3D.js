// The Death Star page's hero in WebGL: the station, its superlaser and the
// planet it faces, drawn over the same 680×460 scene as the SVG version
// (an orthographic camera on the SVG's own coordinates, y flipped), so the
// layout, the phone crop and the beam's line all match it. The page tells it
// the state (idle, charging, firing, boom, gone; the station destroyed; a
// new arrival) and it animates from there. Loaded only with a graphics chip;
// the SVG stays as the fallback.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { paintStation } from './plating';
import { paintGiant, paintPlanet } from './planetPaint';
import { pixelRatio } from '../../lib/device';
import { houseOn } from '../../lib/three/house';
import { precompile, precompilePasses, quiet, releaseContext } from '../../lib/three/renderer';
import { sharpen } from '../../lib/three/textures';
import { BLOOMS } from './look';

const DS = { x: 505, y: 292, r: 145 };
const DISH = { x: 446, y: 232, r: 38 };
const FOCUS = { x: 420, y: 217 };
const TARGET = { x: 170, y: 78, r: 46 };
const GIANT = { x: 100, y: 352, r: 118 };
const BEAM = new THREE.Color('#8dff6b');

const GLOW = { alderaan: '#6aa8ff', yavin: '#9fe08a', tatooine: '#f0c27a', hoth: '#d8ecff', endor: '#9fd68e' };

const W = (x, y, z = 0) => new THREE.Vector3(x, -y, z);
const ease = (t) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;

function glowTexture(stops) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  for (const [o, col] of stops) g.addColorStop(o, col);
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  sharpen(t);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// An atmosphere: a shell lit at its rim, brighter on the sunny side.
function atmosphere(radius, color, sun) {
  return new THREE.Mesh(
    new THREE.SphereGeometry(radius, 64, 32),
    new THREE.ShaderMaterial({
      uniforms: { glow: { value: new THREE.Color(color) }, sun: { value: sun.clone().normalize() } },
      vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vW;
        void main() {
          vN = normalize(normalMatrix * normal);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vV = normalize(-mv.xyz);
          vW = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `uniform vec3 glow; uniform vec3 sun; varying vec3 vN; varying vec3 vV; varying vec3 vW;
        void main() {
          float f = 1.0 - abs(dot(vN, vV));
          float day = max(0.0, dot(vW, sun));
          float lit = 0.15 + 0.85 * smoothstep(-0.25, 0.6, dot(vW, sun));
          float a = (pow(f, 2.6) * 1.4 + pow(f, 8.0) * 1.8) * lit + 0.05 * day;
          gl_FragColor = vec4(glow * a, a);
        }`,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
}

export function createDeathStar3D(canvas, { onLost } = {}) {
  // opaque, in the page's own black: the canvas is the hero's whole backdrop
  const renderer = quiet(new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // (the tone is the house’s: houseOn, below, maps it Neutral and lifts this
  // exposure by its 1.4, as bright as ACES had it; ./look.js)
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true; // for the dish rim's shadow in the bowl
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const big = renderer.capabilities.maxTextureSize >= 4096 && !coarse;
  let ratio = pixelRatio(1.5); // lib/device: lower on a phone or a weak device
  renderer.setPixelRatio(ratio);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x03040a);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  scene.environment = env;
  scene.environmentIntensity = 0.1;
  const camera = new THREE.OrthographicCamera(0, 680, 0, -460, 1, 4000);
  camera.position.set(0, 0, 1500);
  camera.lookAt(0, 0, 0);

  // a sun from the upper left, as the SVG's highlights have it, and a cool rim
  const sunDir = new THREE.Vector3(-0.75, 0.62, 0.9).normalize();
  const sun = new THREE.DirectionalLight(0xfff6ec, 2.0);
  sun.position.copy(W(DS.x, DS.y)).addScaledVector(sunDir, 700);
  sun.target.position.copy(W(DS.x, DS.y));
  sun.castShadow = true;
  sun.shadow.mapSize.set(big ? 2048 : 1024, big ? 2048 : 1024);
  Object.assign(sun.shadow.camera, { left: -170, right: 170, top: 170, bottom: -170, near: 300, far: 1100 });
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.6;
  scene.add(sun, sun.target);
  const rim = new THREE.DirectionalLight(0x9cc4ff, 0.7);
  rim.position.set(900, -200, -900);
  scene.add(rim);
  const dsHemi = new THREE.HemisphereLight(0x9aa6b8, 0x06070a, 0.1);
  scene.add(dsHemi);

  // ── the station ──
  const station = new THREE.Group();
  station.position.copy(W(DS.x, DS.y));
  scene.add(station);
  const tilt = new THREE.Group(); // north tipped toward us, so the trench curves
  tilt.rotation.x = 0.2;
  station.add(tilt);
  // the station's own grey: one equirectangular map, its bands on the latitudes
  const skin = paintStation({ w: big ? 2048 : 1024, h: big ? 1024 : 512 });
  const tex = (c, srgb) => {
    const t = new THREE.CanvasTexture(c);
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const hullMat = new THREE.MeshStandardMaterial({
    map: tex(skin.color, true),
    normalMap: tex(skin.normal),
    normalScale: new THREE.Vector2(0.6, 0.6),
    emissiveMap: tex(skin.lit, true),
    emissive: new THREE.Color(0.55, 0.5, 0.42),
    metalness: 0.28,
    roughness: 0.62,
    envMapIntensity: 1.4,
    transparent: true,
  });
  // where the dish sits on the sphere, in the tilted frame
  const R = DS.r;
  const dishWorld = new THREE.Vector3(DISH.x - DS.x, -(DISH.y - DS.y), 0);
  dishWorld.z = Math.sqrt(Math.max(0, R * R - dishWorld.lengthSq()));
  const nDish = dishWorld.clone().normalize().applyEuler(new THREE.Euler(-tilt.rotation.x, 0, 0));
  const theta = Math.asin(DISH.r / R);
  // the hull, with a hole cut where the dish goes
  {
    const g = new THREE.SphereGeometry(R, 192, 112).toNonIndexed();
    const pos = g.attributes.position;
    const keep = [];
    const a = new THREE.Vector3();
    const cosT = Math.cos(theta);
    for (let i = 0; i < pos.count; i += 3) {
      a.set(0, 0, 0);
      for (let k = 0; k < 3; k++) a.add(new THREE.Vector3(pos.getX(i + k), pos.getY(i + k), pos.getZ(i + k)));
      if (a.normalize().dot(nDish) < cosT) keep.push(i, i + 1, i + 2);
    }
    const out = new THREE.BufferGeometry();
    for (const name of ['position', 'normal', 'uv']) {
      const src = g.attributes[name];
      const arr = new Float32Array(keep.length * src.itemSize);
      keep.forEach((v, j) => {
        for (let c = 0; c < src.itemSize; c++) arr[j * src.itemSize + c] = src.array[v * src.itemSize + c];
      });
      out.setAttribute(name, new THREE.BufferAttribute(arr, src.itemSize));
    }
    g.dispose();
    const hull = new THREE.Mesh(out, hullMat);
    hull.castShadow = true;
    tilt.add(hull);
  }
  // the equatorial trench: a dark band with lights along it
  const trenchMat = new THREE.MeshStandardMaterial({ color: 0x3c3f44, roughness: 0.9, metalness: 0.05, transparent: true });
  const trench = new THREE.Mesh(new THREE.SphereGeometry(R + 0.3, 192, 2, 0, Math.PI * 2, Math.PI / 2 - 0.016, 0.032), trenchMat);
  tilt.add(trench);
  // the dish: a shallow bowl in concentric rings, eight emitters round it,
  // and the focusing lens in the middle
  const dishTex = (() => {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 512;
    const x = c.getContext('2d');
    for (let y = 0; y < 512; y++) {
      // rings, darker toward the middle where the lens sits
      const k = 0.6 + 0.4 * (y / 511);
      const ring = (y % 32 < 3 ? 82 : y % 8 < 1 ? 100 : 120 + ((y * 37) % 9)) * k;
      x.fillStyle = `rgb(${ring},${ring + 3},${ring + 7})`;
      x.fillRect(0, y, 64, 1);
    }
    const t = new THREE.CanvasTexture(c);
    sharpen(t);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = THREE.RepeatWrapping;
    t.repeat.set(24, 1);
    return t;
  })();
  const dish = new THREE.Group();
  const rd = R * Math.sin(theta);
  const depth = 17;
  {
    const prof = [];
    for (let i = 0; i <= 24; i++) {
      const rho = (i / 24) * rd;
      prof.push(new THREE.Vector2(Math.max(0.01, rho), -depth * (1 - (rho / rd) ** 2)));
    }
    const bowl = new THREE.Mesh(new THREE.LatheGeometry(prof, 96), new THREE.MeshStandardMaterial({ map: dishTex, metalness: 0.05, roughness: 0.85, side: THREE.DoubleSide, transparent: true }));
    bowl.receiveShadow = true;
    dish.add(bowl);
    const lip = new THREE.Mesh(new THREE.TorusGeometry(rd, 1.2, 8, 96), new THREE.MeshStandardMaterial({ color: 0x55585c, metalness: 0.05, roughness: 0.85, transparent: true }));
    lip.rotation.x = Math.PI / 2;
    lip.castShadow = true;
    dish.add(lip);
  }
  const lensMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.18, 0.2, 0.22) });
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 4.2, 9, 24), lensMat);
  lens.position.y = -depth + 4;
  dish.add(lens);
  const emitters = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const rho = rd - 6;
    const e = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 4), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.15, 0.18, 0.15) }));
    e.position.set(Math.cos(a) * rho, -depth * (1 - (rho / rd) ** 2) + 1.5, Math.sin(a) * rho);
    dish.add(e);
    emitters.push(e);
  }
  dish.position.copy(nDish).multiplyScalar(R * Math.cos(theta));
  dish.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), nDish);
  tilt.add(dish);

  // ── the superlaser: eight tributaries to a focus, then the beam ──
  const glowTex = glowTexture([
    [0, 'rgba(255,255,255,1)'],
    [0.2, 'rgba(255,255,255,0.8)'],
    [0.5, 'rgba(255,255,255,0.25)'],
    [1, 'rgba(255,255,255,0)'],
  ]);
  const beamMat = new THREE.MeshBasicMaterial({ color: BEAM.clone().multiplyScalar(1.4), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const coreMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.92, 1, 0.88), transparent: true, depthWrite: false, toneMapped: false });
  const unitBeam = new THREE.CylinderGeometry(1, 1, 1, 12, 1, true);
  unitBeam.translate(0, 0.5, 0);
  const span = (m, from, to, r) => {
    const d = to.clone().sub(from);
    m.position.copy(from);
    m.scale.set(r, d.length(), r);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  };
  const tributaries = emitters.map(() => {
    const m = new THREE.Mesh(unitBeam, beamMat);
    m.visible = false;
    scene.add(m);
    return m;
  });
  const focusAt = W(FOCUS.x, FOCUS.y, 135); // out in front of the dish, clear of the hull
  const beam = new THREE.Mesh(unitBeam, beamMat);
  const beamCore = new THREE.Mesh(unitBeam, coreMat);
  beam.visible = beamCore.visible = false;
  scene.add(beam, beamCore);
  const focusGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: BEAM.clone().multiplyScalar(1.6), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false }));
  focusGlow.visible = false;
  scene.add(focusGlow);
  const hitGlow = focusGlow.clone();
  hitGlow.material = focusGlow.material.clone();
  scene.add(hitGlow);

  // ── the planet it faces, the giant behind it, Tatooine's suns ──
  const planetGroup = new THREE.Group();
  planetGroup.position.copy(W(TARGET.x, TARGET.y, 0));
  planetGroup.rotation.set(0.25, 0, 0.32);
  scene.add(planetGroup);
  const planetMat = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, transparent: true });
  const planet = new THREE.Mesh(new THREE.SphereGeometry(TARGET.r, 96, 64), planetMat);
  planetGroup.add(planet);
  const cloudMat = new THREE.MeshStandardMaterial({ transparent: true, depthWrite: false, roughness: 1 });
  const clouds = new THREE.Mesh(new THREE.SphereGeometry(TARGET.r * 1.012, 96, 64), cloudMat);
  planetGroup.add(clouds);
  let air = null;
  const giantGroup = new THREE.Group();
  giantGroup.position.copy(W(GIANT.x, GIANT.y, -600));
  giantGroup.rotation.set(0.2, 0.4, -0.24);
  scene.add(giantGroup);
  const giantMat = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0 });
  const giant = new THREE.Mesh(new THREE.SphereGeometry(GIANT.r, 96, 64), giantMat);
  giantGroup.add(giant);
  let giantAir = null;
  const sunTex = glowTexture([
    [0, 'rgba(255,250,235,1)'],
    [0.18, 'rgba(255,226,160,0.95)'],
    [0.4, 'rgba(255,190,110,0.35)'],
    [1, 'rgba(255,160,80,0)'],
  ]);
  const suns = [
    [TARGET.x + 92, TARGET.y - 40, 56, '#ffd27a'],
    [TARGET.x + 124, TARGET.y - 54, 36, '#ffb067'],
  ].map(([x, y, s, col]) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex, color: new THREE.Color(col), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    sp.position.copy(W(x, y, -300));
    sp.scale.setScalar(s);
    sp.visible = false;
    scene.add(sp);
    return sp;
  });

  // painted once per planet, kept for when they jump back
  const looks = new Map();
  const lookFor = (id) => {
    if (looks.has(id)) return looks.get(id);
    const set = paintPlanet(id, big ? { w: 1024, h: 512 } : { w: 512, h: 256 });
    const t = (c, srgb) => {
      const x = new THREE.CanvasTexture(c);
      x.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      if (srgb) x.colorSpace = THREE.SRGBColorSpace;
      return x;
    };
    const L = { color: t(set.color, true), normal: t(set.normal), rough: t(set.rough), clouds: set.clouds ? t(set.clouds, true) : null };
    looks.set(id, L);
    return L;
  };
  const giants = new Map();
  const giantFor = (id) => {
    if (!giants.has(id)) {
      const c = paintGiant(id, big ? { w: 1024, h: 512 } : { w: 768, h: 384 });
      const t = new THREE.CanvasTexture(c);
      sharpen(t);
      t.colorSpace = THREE.SRGBColorSpace;
      giants.set(id, t);
    }
    return giants.get(id);
  };

  // ── explosions: a white core, the ring, and debris ──
  const fireTex = glowTexture([
    [0, 'rgba(255,255,245,1)'],
    [0.25, 'rgba(255,236,170,0.95)'],
    [0.55, 'rgba(255,150,60,0.5)'],
    [1, 'rgba(255,80,20,0)'],
  ]);
  // the Praxis ring: a thin bright band with a soft halo either side
  const ringTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(256, 256, 0, 256, 256, 256);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.78, 'rgba(255,220,160,0)');
    g.addColorStop(0.86, 'rgba(255,230,180,0.35)');
    g.addColorStop(0.895, 'rgba(255,255,240,1)');
    g.addColorStop(0.92, 'rgba(255,220,160,0.4)');
    g.addColorStop(0.98, 'rgba(255,180,110,0.06)');
    g.addColorStop(1, 'rgba(255,180,110,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 512, 512);
    const t = new THREE.CanvasTexture(c);
    sharpen(t);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const makeBlast = () => {
    const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: fireTex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false }));
    const ring = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), new THREE.MeshBasicMaterial({ map: ringTex, color: new THREE.Color(1.5, 1.35, 1.05), transparent: true, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    const n = 220;
    const debris = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0.2, emissive: new THREE.Color(0.6, 0.25, 0.08) }), n);
    debris.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const bits = Array.from({ length: n }, () => ({ v: new THREE.Vector3(), s: 1, spin: new THREE.Vector3() }));
    core.visible = ring.visible = debris.visible = false;
    scene.add(core, ring, debris);
    return { core, ring, debris, bits, at: -1, pos: new THREE.Vector3(), size: 1, life: 2.6 };
  };
  const planetBlast = makeBlast();
  const stationBlast = makeBlast();
  const m4 = new THREE.Matrix4();
  const q4 = new THREE.Quaternion();
  const e4 = new THREE.Euler();
  const s4 = new THREE.Vector3();
  const p4 = new THREE.Vector3();
  const ringTilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(1.2, 0.2, 0.3));
  const detonate = (b, where, size, color, rand = Math.random) => {
    b.at = clock;
    b.pos.copy(where);
    b.size = size;
    b.debris.material.color.set(color);
    b.bits.forEach((bit) => {
      // most of it flung out in the ring's plane, the rest every which way
      const flat = rand() < 0.65;
      const a = rand() * Math.PI * 2;
      const v = (0.4 + rand() * 1.4) * size;
      bit.v.set(Math.cos(a) * v, Math.sin(a) * v * (flat ? 0.18 : 1), (rand() - 0.5) * v * (flat ? 0.18 : 1)).applyQuaternion(flat ? ringTilt : q4.identity());
      bit.s = (0.5 + rand() ** 2 * 2.8) * (size / 46);
      bit.spin.set(rand() * 6, rand() * 6, rand() * 6);
    });
  };
  const animateBlast = (b) => {
    const t = clock - b.at;
    const on = b.at >= 0 && t < b.life + 2;
    b.core.visible = b.ring.visible = b.debris.visible = on;
    if (!on) return;
    const k = t / b.life;
    b.core.position.copy(b.pos);
    b.core.scale.setScalar(b.size * (0.6 + ease(t / 0.35) * 2.2) * (1 - Math.min(1, k) * 0.4));
    b.core.material.opacity = Math.max(0, 1 - t / 0.9);
    b.ring.position.copy(b.pos);
    b.ring.quaternion.copy(ringTilt);
    b.ring.scale.setScalar(b.size * (1 + ease(t / 1.6) * 3.6));
    b.ring.material.opacity = Math.max(0, 1 - t / 1.8);
    b.debris.count = b.bits.length;
    b.bits.forEach((bit, i) => {
      const d = 1 - Math.exp(-t * 1.1);
      p4.copy(bit.v).multiplyScalar(d * 1.6).add(b.pos);
      const sc = bit.s * Math.max(0, 1 - t / (b.life + 2));
      m4.compose(p4, q4.setFromEuler(e4.set(bit.spin.x * t, bit.spin.y * t, bit.spin.z * t)), s4.setScalar(Math.max(0.0001, sc)));
      b.debris.setMatrixAt(i, m4);
    });
    b.debris.instanceMatrix.needsUpdate = true;
    // white-hot at first, cooling to the colour of what it was
    b.debris.material.emissive.setRGB(1.4, 0.75, 0.3);
    b.debris.material.emissiveIntensity = Math.max(0, 1 - t / 1.4) ** 1.5;
  };

  // ── state from the page ──
  let state = { planet: null, phase: 'idle', destroyed: false, arrivals: 0, shots: 0, reduced: false };
  let clock = 0;
  let phaseAt = 0;
  let arriveAt = -9;
  let planetAt = -9;
  let destroyedAt = -1;
  let size = { w: 1, h: 1 };
  let lost = false;
  let vb = { x: 0, y: 0, w: 680, h: 460 };

  const setPlanet = (id) => {
    const L = lookFor(id);
    Object.assign(planetMat, { map: L.color, normalMap: L.normal, roughnessMap: L.rough });
    planetMat.needsUpdate = true;
    clouds.visible = !!L.clouds;
    if (L.clouds) {
      cloudMat.map = L.clouds;
      cloudMat.needsUpdate = true;
    }
    if (air) {
      planetGroup.remove(air);
      air.geometry.dispose();
      air.material.dispose();
    }
    air = atmosphere(TARGET.r * 1.07, GLOW[id] ?? '#88aaff', sunDir);
    planetGroup.add(air);
    const g = id === 'yavin' || id === 'endor';
    giantGroup.visible = g;
    if (g) {
      giantMat.map = giantFor(id);
      giantMat.needsUpdate = true;
      if (giantAir) {
        giantGroup.remove(giantAir);
        giantAir.geometry.dispose();
        giantAir.material.dispose();
      }
      giantAir = atmosphere(GIANT.r * 1.04, id === 'yavin' ? '#f2b878' : '#b8d2d9', sunDir);
      giantGroup.add(giantAir);
    }
    for (const s of suns) s.visible = id === 'tatooine';
    planetAt = clock;
  };

  function update(next) {
    const prev = state;
    state = { ...state, ...next };
    if (next.vb && (next.vb.x !== vb.x || next.vb.w !== vb.w || next.vb.y !== vb.y || next.vb.h !== vb.h)) {
      vb = next.vb;
      fitCamera();
    }
    if (state.planet !== prev.planet) setPlanet(state.planet);
    if (state.phase !== prev.phase) {
      phaseAt = clock;
      if (state.phase === 'boom') detonate(planetBlast, W(TARGET.x, TARGET.y, 10), TARGET.r, new THREE.Color(GLOW[state.planet] ?? '#888').multiplyScalar(0.6));
    }
    if (state.arrivals !== prev.arrivals && state.arrivals > 0 && !state.reduced) arriveAt = clock;
    if (state.destroyed && !prev.destroyed) {
      destroyedAt = clock;
      detonate(stationBlast, W(DS.x, DS.y, 200), DS.r * 0.9, new THREE.Color('#6b7078'));
    }
    if (!state.destroyed && prev.destroyed) {
      destroyedAt = -1;
      stationBlast.at = -1;
    }
  }

  // the camera sees the scene's coordinates over the canvas's whole box:
  // `frame` is that box in SVG units, worked out by the page from where the
  // SVG sits inside the canvas, so everything lines up with the 2D layout
  let frame = null;
  const fitCamera = () => {
    const f = frame ?? { x0: vb.x, x1: vb.x + vb.w, y0: vb.y, y1: vb.y + vb.h };
    camera.left = f.x0;
    camera.right = f.x1;
    camera.top = -f.y0;
    camera.bottom = -f.y1;
    camera.updateProjectionMatrix();
    stars.position.set((f.x0 + f.x1) / 2, -(f.y0 + f.y1) / 2, -1500);
    stars.scale.setScalar(Math.max(f.x1 - f.x0, f.y1 - f.y0) / 1000);
    band.position.set((f.x0 + f.x1) / 2, -(f.y0 + f.y1) / 2, -1400);
    band.scale.set((f.x1 - f.x0) * 1.3, (f.y1 - f.y0) * 0.9, 1);
  };

  // the sky: stars of different sizes and warmth that twinkle a little, and
  // a faint band of the galaxy behind them
  const stars = (() => {
    const n = 2200;
    const rand = (() => {
      let a = 99;
      return () => {
        a = (a * 1664525 + 1013904223) >>> 0;
        return a / 4294967296;
      };
    })();
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const size = new Float32Array(n);
    const seed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos.set([(rand() - 0.5) * 1000, (rand() - 0.5) * 1000, 0], i * 3);
      const warm = rand();
      const b = 0.35 + rand() ** 3 * 1.6;
      col.set([b * (warm > 0.7 ? 1 : 0.82), b * 0.9, b * (warm < 0.3 ? 1.1 : 0.85)], i * 3);
      size[i] = 0.8 + rand() ** 4 * 2.6;
      seed[i] = rand() * 100;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('size', new THREE.BufferAttribute(size, 1));
    g.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    const m = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 }, dpr: { value: ratio } },
      vertexShader: `attribute float size; attribute float seed; attribute vec3 color; uniform float time; uniform float dpr; varying vec3 vC; varying float vT;
        void main() {
          vC = color;
          vT = 0.75 + 0.25 * sin(time * (0.6 + fract(seed) * 1.8) + seed);
          gl_PointSize = size * dpr * 1.6;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `varying vec3 vC; varying float vT;
        void main() {
          vec2 d = gl_PointCoord - 0.5;
          float r = length(d);
          float a = smoothstep(0.5, 0.0, r);
          gl_FragColor = vec4(vC * vT * a, a);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const p = new THREE.Points(g, m);
    p.frustumCulled = false;
    scene.add(p);
    return p;
  })();
  const band = (() => {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 512;
    const x = c.getContext('2d');
    x.translate(512, 256);
    x.rotate(-0.42);
    for (let i = 0; i < 70; i++) {
      const gx = (Math.sin(i * 12.9898) * 0.5 + 0.5 - 0.5) * 1100;
      const gy = Math.sin(i * 78.233) * 60;
      const r = 60 + ((i * 37) % 90);
      const gr = x.createRadialGradient(gx, gy, 0, gx, gy, r);
      const hue = i % 3 === 0 ? '120,140,200' : i % 3 === 1 ? '170,150,190' : '110,120,150';
      gr.addColorStop(0, `rgba(${hue},0.07)`);
      gr.addColorStop(1, `rgba(${hue},0)`);
      x.fillStyle = gr;
      x.fillRect(gx - r, gy - r, r * 2, r * 2);
    }
    const t = new THREE.CanvasTexture(c);
    sharpen(t);
    t.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9 }));
    m.frustumCulled = false;
    scene.add(m);
    return m;
  })();

  // ── post: bloom on what glows (the beam, the lights, the fire) ──
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), BLOOMS.station.strength, BLOOMS.station.radius, BLOOMS.station.threshold);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  let useBloom = true;

  const emitterWorld = new THREE.Vector3();
  function render(ms = 16) {
    if (lost) return;
    const dt = Math.min(0.05, ms / 1000);
    clock += dt;
    const still = state.reduced;
    const since = clock - phaseAt;

    // the station: in from hyperspace on an arrival, gone when it's destroyed
    const a = ease((clock - arriveAt) / 1.1);
    station.position.set(DS.x + (1 - a) * 180, -DS.y, 0);
    station.scale.setScalar(0.6 + 0.4 * a);
    const gone = destroyedAt >= 0 ? Math.min(1, (clock - destroyedAt) / 0.5) : 0;
    station.visible = gone < 1;
    for (const m of [hullMat, trenchMat]) m.opacity = 1 - gone;
    hullMat.emissiveIntensity = 1 + gone * 3;

    // the planet turns; on a new one it fades in
    if (!still) {
      planet.rotation.y += dt * 0.05;
      clouds.rotation.y += dt * 0.07;
      giant.rotation.y += dt * 0.012;
    }
    const fade = still ? 1 : ease((clock - planetAt) / 0.8);
    const visible = state.phase === 'idle' || state.phase === 'charging' || state.phase === 'firing';
    planetGroup.visible = visible;
    planetMat.opacity = fade;
    cloudMat.opacity = fade * 0.92;
    // hit by the beam, it flares before it goes
    const firing = state.phase === 'firing';
    planetMat.emissive.setRGB(firing ? 0.5 + Math.random() * 0.3 : 0, firing ? 0.7 : 0, firing ? 0.4 : 0);

    // the superlaser
    const charging = state.phase === 'charging' || firing;
    tributaries.forEach((m, i) => {
      const on = charging && (still || since > i * 0.05 || firing);
      m.visible = on;
      if (!on) return;
      emitters[i].getWorldPosition(emitterWorld);
      span(m, emitterWorld, focusAt, 1.1 + Math.sin(clock * 40 + i) * 0.25);
    });
    lensMat.color.setRGB(charging ? 0.6 : 0.18, charging ? 1.6 : 0.2, charging ? 0.5 : 0.22);
    focusGlow.visible = charging;
    focusGlow.position.copy(focusAt);
    focusGlow.scale.setScalar(firing ? 46 : 14 + Math.min(1, since / 1.1) * 26);
    beam.visible = beamCore.visible = firing;
    hitGlow.visible = firing;
    if (firing) {
      const target = W(TARGET.x, TARGET.y, 0);
      span(beam, focusAt, target, 5.5 + Math.sin(clock * 60) * 0.8);
      span(beamCore, focusAt, target, 1.6);
      hitGlow.position.copy(target).setZ(30);
      hitGlow.scale.setScalar(70 + Math.random() * 14);
    }
    animateBlast(planetBlast);
    animateBlast(stationBlast);
    stars.material.uniforms.time.value = still ? 0 : clock;
    if (useBloom) composer.render();
    else renderer.render(scene, camera);
    watch(ms);
  }

  // a machine that can't keep up: fewer pixels first, then tell the page
  const perf = { acc: 0, n: 0, last: performance.now(), told: false };
  const watch = () => {
    const t = performance.now();
    const gap = t - perf.last;
    perf.last = t;
    if (gap > 1000) {
      perf.acc = perf.n = 0;
      return;
    }
    perf.acc += gap;
    perf.n += 1;
    if (perf.acc < 3000 || perf.n < 4) return;
    const avg = perf.acc / perf.n;
    perf.acc = perf.n = 0;
    if (avg < 36) return; // a battery-saving 30 fps cap (33.3 ms) isn't struggling; under 28 fps is, the site's floor being 30
    if (ratio > 1) {
      ratio = 1;
      resize(size.w, size.h, frame);
    } else useBloom = false;
  };
  const resize = (w, h, f = null) => {
    size = { w: Math.max(1, w), h: Math.max(1, h) };
    frame = f;
    renderer.setPixelRatio(ratio);
    renderer.setSize(size.w, size.h, false);
    composer.setPixelRatio(ratio);
    composer.setSize(size.w, size.h);
    bloom.resolution.set(size.w / 2, size.h / 2);
    stars.material.uniforms.dpr.value = ratio;
    fitCamera();
  };
  const onContextLost = (e) => {
    e.preventDefault();
    lost = true;
    onLost?.();
  };
  canvas.addEventListener('webglcontextlost', onContextLost);

  const dispose = () => {
    canvas.removeEventListener('webglcontextlost', onContextLost);
    const seen = new Set();
    scene.traverse((o) => {
      if (o.geometry && !seen.has(o.geometry)) {
        seen.add(o.geometry);
        o.geometry.dispose();
      }
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of mats) {
        if (seen.has(m)) continue;
        seen.add(m);
        for (const k of ['map', 'normalMap', 'roughnessMap', 'emissiveMap']) m[k]?.dispose?.();
        m.dispose?.();
      }
    });
    for (const L of looks.values()) for (const t of Object.values(L)) t?.dispose();
    for (const t of giants.values()) t.dispose();
    env.dispose();
    composer.dispose?.();
    renderer.dispose();
    releaseContext(renderer); // (lib/three/renderer: given back once nothing is compiling)
  };

  // every shader (the scene's, into the composer's buffer, and the passes')
  // linked in the background: the hero waits for this before its first frame
  // the house look (lib/three/house): the shade one colour from the light
  // out here, under the house tone mapper (its exposure lifted from ACES;
  // the fog left as it is), on everything, before the shaders are linked
  houseOn({ renderer, scene, sun, hemi: dsHemi, look: { fog: false } });
  const ready = Promise.all([precompile(renderer, scene, camera, scene, composer.readBuffer), precompilePasses(renderer, composer, camera)]);
  return { update, render, resize, dispose, ready, get lost() { return lost; } };
}

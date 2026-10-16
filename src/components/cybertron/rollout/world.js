// Roll out's three stages as places: the sky, the road and the land beside
// it, the canyon under a broken bridge, and layers of scenery that recycle
// down the road (guard rails and dry grass near; shrubs, boulders, quiver
// trees and street lamps in the middle; buttes, towers and megastructures far
// off). Each stage brings its own light: a Nevada sunset, Mission City at
// night, Kaon under a burning sky.
//
// The sky is a photographed CC0 pure sky (Poly Haven) turned so its sun sits
// where the stage's light comes from, with mountains or a skyline along the
// horizon; the fog takes its colour from the sky just above the horizon, so
// the land fades into it. The surfaces are scanned CC0 materials (Poly
// Haven, ambientCG) and the light the metal reflects is a Poly Haven HDRI per
// stage; scripts/cc0.mjs fetches them all.
//
// Iacon, the Autobots' capital (the Decepticons' last stage), is Kaon's iron
// re-lit: night, energon blue in the window slits, the lane lines and the
// river under the broken bridges, the towers taller.

import * as THREE from 'three';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { canvasTexture } from '../../../lib/stage3d';
import { antiTile } from '../../../lib/three/surface';
import { paintChasm, paintConcrete, paintDeck, paintFacade, paintLanes, paintPavement, paintRoad, paintSand, paintSign, paintStrata, ROAD_TILE } from './paint';
import { ROLL } from './rules';
import { createLand, cutFace, cutWiden, CUT_PAD } from './terrain';
import { tuftGeometry, tuftMaterial } from './flora';
import { gateGeometry, gateTrimGeometry, kaonMetal, megaGeometry } from './kaon';
import { loadTexture } from '../../../lib/three/textures';
import { envLevel } from '../../../lib/three/house';

// sky: the photographed sky (u and elevation: where its own sun is, as
// `npm run cc0` prints it), how bright, its tint, the sun drawn over it, how
// much the horizon hazes into the fog, and what stands along the horizon
// (1 mountains, 2 an iron skyline, 3 a city skyline). sunAz: the sun's
// bearing (x, z); at night the light comes from sunElevation instead.
export const LOOK = {
  jasper: {
    hdri: 'jasper',
    env: 0.75,
    exposure: 1.0,
    sky: { tex: 'jasper-sky', u: 0.6077, elevation: 8.17, k: 1.0, tint: [1.16, 0.9, 0.72], sunK: 1.4, haze: 0.6, horizon: 1, ridge: [0.5, 0.42, 0.5], windows: [0, 0, 0] },
    sunAz: [-0.85, -1],
    fogDensity: 0.0025,
    sun: { color: 0xffbf86, k: 3.4 },
    hemi: [0xf2c8a8, 0x6a4a32, 0.5],
    grade: { contrast: 0.16, saturation: 1.05, vignette: 0.26, shadow: [0.0, 0.01, 0.03], high: [0.035, 0.014, 0.0] },
    night: false,
  },
  mission: {
    hdri: 'mission',
    env: 0.22,
    exposure: 0.95,
    sky: { tex: 'mission-sky', u: 0.6, elevation: 38, k: 0.055, tint: [0.72, 0.8, 1.05], sunK: 0, haze: 0.85, horizon: 3, ridge: [0.32, 0.36, 0.5], windows: [1.6, 1.25, 0.8], glow: [0.32, 0.17, 0.08] },
    sunAz: [0.4, -1],
    sunElevation: 32,
    fogDensity: 0.0062,
    sun: { color: 0x9fb4ff, k: 0.55 },
    hemi: [0x3a4a7a, 0x120f14, 0.55],
    grade: { contrast: 0.14, saturation: 1.08, vignette: 0.3, shadow: [0.0, 0.015, 0.04], high: [0.03, 0.015, 0.0] },
    night: true,
  },
  kaon: {
    hdri: 'kaon',
    env: 0.5,
    exposure: 1.05,
    sky: { tex: 'kaon-sky', u: 0.6018, elevation: 4.13, k: 0.5, tint: [1.75, 0.58, 0.36], sunK: 2.2, haze: 0.9, horizon: 2, ridge: [0.22, 0.13, 0.13], windows: [2.4, 0.8, 0.25], glow: [0.25, 0.06, 0.02] },
    sunAz: [0.55, -1],
    fogDensity: 0.0044,
    sun: { color: 0xff7a48, k: 2.0 },
    hemi: [0xb0503a, 0x1a0a0c, 0.5],
    grade: { contrast: 0.2, saturation: 1.02, vignette: 0.32, shadow: [0.02, 0.0, 0.01], high: [0.04, 0.01, 0.0] },
    night: true,
  },
  iacon: {
    hdri: 'mission',
    env: 0.45,
    exposure: 1.05,
    sky: { tex: 'mission-sky', u: 0.6, elevation: 38, k: 0.11, tint: [0.55, 0.82, 1.45], sunK: 0, haze: 0.85, horizon: 2, ridge: [0.16, 0.22, 0.34], windows: [0.35, 1.3, 2.6], glow: [0.03, 0.12, 0.3] },
    sunAz: [0.4, -1],
    sunElevation: 34,
    fogDensity: 0.0045,
    sun: { color: 0x9fcfff, k: 0.9 },
    hemi: [0x4f78b0, 0x0a1220, 0.6],
    grade: { contrast: 0.18, saturation: 1.06, vignette: 0.3, shadow: [0.0, 0.012, 0.04], high: [0.0, 0.02, 0.04] },
    night: true,
  },
};

// One cache per renderer: an environment map belongs to the GL context it
// was made in.
const HDRI = new WeakMap();
function loadHdri(name, stage) {
  const { renderer } = stage;
  if (!HDRI.has(renderer)) HDRI.set(renderer, new Map());
  const cache = HDRI.get(renderer);
  if (cache.has(name)) return cache.get(name);
  const p = new Promise((resolve) => {
    new HDRLoader().load(
      `/games/hdri/${name}.hdr`,
      (tex) => {
        if (stage.disposed) {
          tex.dispose();
          resolve(null);
          return;
        }
        const pm = new THREE.PMREMGenerator(renderer);
        const env = pm.fromEquirectangular(tex).texture;
        // (its mean light, for the house look: the PMREM has no pixels to read)
        env.userData.level = envLevel(tex);
        pm.dispose();
        tex.dispose();
        resolve(env);
      },
      undefined,
      () => resolve(null), // no HDRI: the lights still light it
    );
  });
  cache.set(name, p);
  return p;
}

// The photographed skies, cached the same way. Stored range-compressed
// (x / (1 + x), then gamma 2.2); the sky shader undoes it.
const SKIES = new WeakMap();
function loadSky(name, renderer) {
  if (!SKIES.has(renderer)) SKIES.set(renderer, new Map());
  const cache = SKIES.get(renderer);
  if (!cache.has(name))
    cache.set(
      name,
      // (decoded off the main thread; always seen magnified, so no mipmaps)
      loadTexture(`/games/sky/${name}.webp`, { renderer, color: false, mipmaps: false, aniso: 1 })
        .then((tex) => {
          tex.wrapS = THREE.RepeatWrapping;
          tex.wrapT = THREE.ClampToEdgeWrapping;
          tex.userData.shared = true;
          return tex;
        })
        .catch(() => null),
    );
  return cache.get(name);
}

// The sky's colour just above the horizon across the half ahead of you (so
// the sun's own glow doesn't bleach it), a shade deeper: the fog's colour.
function horizonColour(tex, sky, shift) {
  const fallback = new THREE.Color(sky.tint[0], sky.tint[1], sky.tint[2]).multiplyScalar(0.35 * sky.k);
  if (!tex?.image) return fallback;
  try {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 72;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(tex.image, 0, 0, 256, 72);
    const row = x.getImageData(0, Math.round(((90 - 2.5) / 101.25) * 72), 256, 1).data;
    const dec = (v) => {
      const l = (v / 255) ** 2.2;
      return l / Math.max(1 - l, 0.004);
    };
    const sum = [0, 0, 0];
    const u0 = 0.25 + shift;
    let n = 0;
    for (let k = -64; k <= 64; k++) {
      const px = (((Math.floor((u0 + k / 256) * 256) % 256) + 256) % 256) * 4;
      // the median-ish: brightest pixels (the sun) count for less
      const w = 1 / (1 + dec(row[px]) + dec(row[px + 1]));
      for (let ch = 0; ch < 3; ch++) sum[ch] += dec(row[px + ch]) * w;
      n += w;
    }
    const deep = sky.fogK ?? 0.82;
    return new THREE.Color((sum[0] / n) * sky.k * sky.tint[0] * deep, (sum[1] / n) * sky.k * sky.tint[1] * deep, (sum[2] / n) * sky.k * sky.tint[2] * deep);
  } catch {
    return fallback;
  }
}

// A material that cuts holes for the broken bridges: anything between a
// gap's two ends (world z) is discarded.
function holes(material, key) {
  material.userData.gaps = new Array(3).fill(null).map(() => new THREE.Vector2(1e9, 1e9));
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uGaps = { value: material.userData.gaps };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vHoleWPos;')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        #ifdef USE_INSTANCING
          vHoleWPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
        #else
          vHoleWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        #endif`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vHoleWPos;\nuniform vec2 uGaps[3];')
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nfor (int i = 0; i < 3; i++) { if (-vHoleWPos.z > uGaps[i].x && -vHoleWPos.z < uGaps[i].y) discard; }');
  };
  material.customProgramCacheKey = () => `holes-${key}`;
  return material;
}

// Facades on buildings of any size: the windows come from world position,
// so a tall block and a short one share one texture without stretching.
function worldUv(material, tileW, tileH, key) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <uv_vertex>',
      `#include <uv_vertex>
      {
        vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vec3 wn = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
        float seed = float(gl_InstanceID);
        vec2 wuv = vec2((abs(wn.x) > 0.5 ? wp.z : wp.x) / ${tileW.toFixed(1)}, wp.y / ${tileH.toFixed(1)}) + vec2(floor(fract(sin(seed * 12.9898) * 43758.5453) * 4.0) * 0.25, 0.0);
        #ifdef USE_MAP
          vMapUv = wuv;
        #endif
        #ifdef USE_EMISSIVEMAP
          vEmissiveMapUv = wuv;
        #endif
        #ifdef USE_NORMALMAP
          vNormalMapUv = wuv;
        #endif
        #ifdef USE_ROUGHNESSMAP
          vRoughnessMapUv = wuv;
        #endif
        #ifdef USE_METALNESSMAP
          vMetalnessMapUv = wuv;
        #endif
        #ifdef USE_AOMAP
          vAoMapUv = wuv;
        #endif
      }`,
    );
  };
  material.customProgramCacheKey = () => `worlduv-${key}`;
  return material;
}

// The sky dome: the photograph, the sun over it, haze at the horizon, and
// mountains or a skyline standing along it. It follows the camera.
function buildSky(look, tex, sunDir, shift, fogCol) {
  const s = look.sky;
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      skyTex: { value: tex },
      hasTex: { value: tex ? 1 : 0 },
      skyK: { value: s.k },
      shift: { value: shift },
      tint: { value: new THREE.Vector3(...s.tint) },
      sunK: { value: s.sunK },
      sunCol: { value: new THREE.Color(look.sun.color) },
      sunDir: { value: sunDir.clone() },
      haze: { value: s.haze },
      fogCol: { value: fogCol },
      horizon: { value: s.horizon },
      ridgeCol: { value: new THREE.Vector3(...s.ridge) },
      windowCol: { value: new THREE.Vector3(...s.windows) },
      glow: { value: new THREE.Vector3(...(s.glow ?? [0, 0, 0])) },
    },
    vertexShader: `varying vec3 vDir; void main() { vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
    fragmentShader: `
      uniform sampler2D skyTex;
      uniform float hasTex, skyK, shift, sunK, haze, horizon;
      uniform vec3 tint, sunCol, sunDir, fogCol, ridgeCol, windowCol, glow;
      varying vec3 vDir;
      float h1(float n) { return fract(sin(n * 127.1) * 43758.5453); }
      float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      vec3 photo(vec3 d) {
        float el = degrees(asin(clamp(d.y, -1.0, 1.0)));
        float u = atan(d.z, d.x) / 6.2831853 + 0.5 + shift;
        float v = 1.0 - (90.0 - max(el, -11.0)) / 101.25;
        vec3 l = pow(texture2D(skyTex, vec2(u, clamp(v, 0.002, 0.998))).rgb, vec3(2.2));
        return l / max(vec3(1.0) - l, vec3(0.004));
      }
      float ridge(float a, float s) {
        return 0.5 + 0.24 * sin(a * 3.0 + s) + 0.13 * sin(a * 7.0 + s * 2.3) + 0.08 * abs(sin(a * 17.0 + s * 1.7)) + 0.04 * abs(sin(a * 43.0 + s * 3.1)) - 0.06;
      }
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 c = hasTex > 0.5 ? photo(d) * skyK * tint : mix(fogCol, fogCol * 0.5, smoothstep(0.0, 0.6, h));
        float sd = max(dot(d, sunDir), 0.0);
        c += sunCol * sunK * (smoothstep(0.99993, 0.99997, sd) * 40.0 + pow(sd, 900.0) * 3.0 + pow(sd, 60.0) * 0.4 + pow(sd, 7.0) * 0.1);
        c += glow * exp(-max(h, 0.0) * 9.0);
        c = mix(c, fogCol, (1.0 - smoothstep(-0.01, 0.15, h)) * haze);
        float a = atan(d.x, -d.z);
        float aa = 0.0014;
        if (horizon > 0.5 && horizon < 1.5) {
          // two ranges far off, the nearer one darker
          float far = 0.014 + 0.028 * ridge(a, 1.3);
          float near = 0.003 + 0.03 * ridge(a * 1.4, 4.1) * ridge(a * 0.6, 2.0);
          c = mix(c, mix(fogCol, fogCol * ridgeCol * 1.6, 0.35), smoothstep(far + aa, far - aa, h));
          c = mix(c, mix(fogCol, fogCol * ridgeCol, 0.55), smoothstep(near + aa, near - aa, h));
        } else if (horizon > 1.5) {
          // skylines: towers far off, a few windows lit
          for (int L = 0; L < 2; L++) {
            float fl = float(L);
            float n = 80.0 + fl * 46.0;
            float cell = floor(a * n);
            float r = h1(cell + fl * 31.0);
            float top = 0.008 + pow(r, 2.4) * (horizon > 2.5 ? 0.04 + fl * 0.03 : 0.05 + fl * 0.04);
            if (horizon < 2.5 && r > 0.82) top += (1.0 - abs(fract(a * n) - 0.5) * 2.0) * (0.03 + fl * 0.02);
            float inside = smoothstep(top + aa * 0.6, top - aa * 0.6, h);
            vec3 bc = mix(fogCol, fogCol * ridgeCol, 0.45 + fl * 0.35);
            vec2 wc = floor(vec2(a * n * 7.0, h * 520.0));
            float lit = step(horizon > 2.5 ? 0.86 : 0.94, h2(wc + fl * 17.0)) * step(0.45, fract(h * 520.0)) * step(0.3, fract(a * n * 7.0));
            bc += windowCol * lit * (0.5 + fl * 0.5) * step(0.004, top - h);
            c = mix(c, bc, inside);
          }
        }
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(500, 48, 24), mat);
  dome.frustumCulled = false;
  dome.renderOrder = -10;
  return dome;
}

// Instances spread down the road that move forward a band at a time as you
// pass them, each taking a fresh variation from (its index, its lap).
class Band {
  constructor(mesh, count, length, place) {
    this.mesh = mesh;
    this.count = count;
    this.length = length;
    this.place = place;
    this.laps = new Int32Array(count).fill(-99999);
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.e = new THREE.Euler();
    this.p = new THREE.Vector3();
    this.s = new THREE.Vector3();
    if (mesh.isObject3D) mesh.frustumCulled = false;
  }

  update(z) {
    let dirty = false;
    for (let i = 0; i < this.count; i++) {
      const base = (i / this.count) * this.length;
      // the lap that puts this one between 30 behind you and a band ahead
      const lap = Math.ceil((z - 30 - base) / this.length);
      if (lap === this.laps[i]) continue;
      this.laps[i] = lap;
      const r = rnd(i * 7919 + lap * 104729 + this.length);
      const t = this.place(i, r, base + lap * this.length);
      if (!t) {
        this.m.makeScale(0, 0, 0);
      } else {
        this.p.set(t.x, t.y ?? 0, -t.z);
        this.e.set(t.rx ?? 0, t.ry ?? 0, t.rz ?? 0);
        this.q.setFromEuler(this.e);
        const sc = t.s ?? 1;
        if (typeof sc === 'number') this.s.set(sc, sc, sc);
        else this.s.set(sc[0], sc[1], sc[2]);
        this.m.compose(this.p, this.q, this.s);
      }
      this.mesh.setMatrixAt(i, this.m);
      dirty = true;
    }
    if (dirty) {
      if (this.mesh.commit) this.mesh.commit();
      else this.mesh.instanceMatrix.needsUpdate = true;
    }
  }
}
// a seeded random source per (index, lap)
function rnd(seed) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A guard rail's W-beam, in section, as a thin sheet bulging toward the road.
function wBeam() {
  const P = [
    [0, -0.16],
    [0.05, -0.125],
    [0.052, -0.055],
    [0.018, -0.01],
    [0.018, 0.01],
    [0.052, 0.055],
    [0.05, 0.125],
    [0, 0.16],
  ];
  const s = new THREE.Shape();
  s.moveTo(P[0][0], P[0][1]);
  for (const [x, y] of P.slice(1)) s.lineTo(x, y);
  for (const [x, y] of P.slice().reverse()) s.lineTo(x - 0.01, y);
  const g = new THREE.ExtrudeGeometry(s, { depth: 4.02, bevelEnabled: false, curveSegments: 1 });
  g.translate(0, 0.66, -2.01);
  return g;
}

// ── one stage's place ──

// The scanned props each stage scatters (see scripts/cc0.mjs).
const PROPS = {
  jasper: ['quiver-tree', 'rock', 'tyre', 'barrel', 'shrub', 'brush', 'boulders', 'boulder', 'dead-trunk'],
  mission: ['street-lamp', 'utility-box', 'trash-can'],
  kaon: ['barrel'],
  iacon: ['barrel'],
};

// The Poly Haven sets each stage is surfaced with.
const SETS = {
  jasper: { road: 'asphalt-desert', ground: 'desert-ground', ground2: 'desert-sand', rock: 'mesa-rock' },
  mission: { road: 'asphalt-city', ground: 'sidewalk', ground2: null, rock: 'concrete' },
  kaon: { road: 'plate-road', ground: 'plate-deck', ground2: 'plate-road', rock: 'plate-road' },
  iacon: { road: 'plate-road', ground: 'plate-deck', ground2: 'plate-road', rock: 'plate-road' },
};

// How each stage's land takes its sets: tile sizes in metres (ground, second
// ground, rock), tints, where the slope turns to rock.
const LAND = {
  desert: { tile: [4.6, 7.5, 18], tint: [0xffffff, 0xf2e2cf, 0xf0c8a8], rock: [0.3, 0.5], metal: false, env: 0.5, sheen: 0.3, key: 'desert' },
  kaon: { tile: [7, 9, 9], tint: [0x6c6a74, 0x55535c, 0x8a8894], rock: [0.22, 0.4], metal: true, env: 1.1, sheen: 1, key: 'kaon' },
  iacon: { tile: [7, 9, 9], tint: [0x6c7686, 0x566070, 0x8c96a6], rock: [0.22, 0.4], metal: true, env: 1.2, sheen: 1, key: 'iacon' },
};

// Kaon's furnace light, or Iacon's energon blue
const CYBER = {
  kaon: { slit: [2.6, 0.95, 0.35], lamp: 0xff8a2a, trim: 0xff6a2a, lane: '#ff6a2a', river: 'lava', tall: 1, sign: { text: ['DECEPTICON', 'BARRIER'], bg: '#7a2fb8', fg: '#fff' } },
  iacon: { slit: [0.45, 1.5, 2.8], lamp: 0x4fd8ff, trim: 0x3fc8ff, lane: '#3fd0ff', river: 'energon', tall: 1.55, sign: { text: ['AUTOBOT', 'CHECKPOINT'], bg: '#c8102e', fg: '#fff' } },
};

export async function buildWorld(id, renderer, { big = true, M, shared, lib, models }) {
  const look = LOOK[id];
  const root = new THREE.Group();
  const own = []; // textures this world made, to free with it
  const T = (canvas, opts) => {
    const t = canvasTexture(canvas, renderer, opts);
    own.push(t);
    return t;
  };
  const size = big ? 512 : 256;
  const kind = id === 'jasper' ? 'desert' : id === 'mission' ? 'city' : 'kaon';
  const cyber = CYBER[id] ?? CYBER.kaon;
  const want = SETS[id];
  const [roadSet, groundSet, ground2Set, rockSet, skyTex] = await Promise.all([...[want.road, want.ground, want.ground2, want.rock].map((n) => (n ? lib.load(n) : null)), loadSky(look.sky.tex, renderer)]);

  // the sun: its bearing from the stage, its height from the photograph
  const az = new THREE.Vector2(look.sunAz[0], look.sunAz[1]).normalize();
  const el = THREE.MathUtils.degToRad(look.sky.sunK ? look.sky.elevation : look.sunElevation);
  const sunDir = new THREE.Vector3(az.x * Math.cos(el), Math.sin(el), az.y * Math.cos(el));
  const shift = look.sky.u - (Math.atan2(sunDir.z, sunDir.x) / (2 * Math.PI) + 0.5);
  const fogCol = horizonColour(skyTex, look.sky, shift);

  // sky
  const sky = buildSky(look, skyTex, sunDir, shift, fogCol);
  root.add(sky);

  // the road: a strip that steps forward a tile at a time, so its texture
  // stays put on the ground; holes cut where a bridge is out. Real asphalt
  // (or Kaon's iron plate) underneath, the markings painted over it.
  const ROAD_LEN = ROAD_TILE * 34;
  const along = ROAD_LEN / ROAD_TILE;
  let roadMat;
  if (roadSet) {
    roadMat = lib.material(roadSet, { repeat: [4, 4 * along], metal: kind === 'kaon', roughness: kind === 'city' ? 0.78 : 1, envMapIntensity: kind === 'city' ? 1.5 : 0.8, normalScale: new THREE.Vector2(1.1, 1.1) });
  } else {
    const roadP = paintRoad({ size, seed: 3 + id.length, kind });
    roadMat = new THREE.MeshStandardMaterial({ map: T(roadP.color, { repeat: [1, along] }), normalMap: T(roadP.normal, { repeat: [1, along], srgb: false }), roughnessMap: T(roadP.rough, { repeat: [1, along], srgb: false }), metalness: kind === 'kaon' ? 0.55 : 0.05, roughness: 1 });
  }
  holes(roadMat, `road-${id}`);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_TILE, ROAD_LEN), roadMat);
  road.rotation.x = -Math.PI / 2;
  road.receiveShadow = true;
  root.add(road);
  const lanesP = paintLanes({ size: big ? 1024 : 512, seed: 3 + id.length, kind, glow: cyber.lane });
  const laneMat = holes(
    new THREE.MeshStandardMaterial({
      map: T(lanesP.color, { repeat: [1, along] }),
      emissiveMap: lanesP.emissive ? T(lanesP.emissive, { repeat: [1, along] }) : null,
      emissive: lanesP.emissive ? new THREE.Color(1.1, 0.55, 0.3) : new THREE.Color(0, 0, 0),
      transparent: true,
      depthWrite: false,
      roughness: 0.55,
      metalness: 0,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -2,
    }),
    `lanes-${id}`,
  );
  const lanes = new THREE.Mesh(road.geometry, laneMat);
  lanes.rotation.x = -Math.PI / 2;
  lanes.receiveShadow = true;
  lanes.renderOrder = 1;
  root.add(lanes);

  // the land either side: rolling ground and buttes (Jasper), iron terraces
  // (Kaon); Mission City's is flat pavement
  const painted = (p) => {
    const arm = new THREE.DataTexture(new Uint8Array([255, 235, 0, 255]), 1, 1);
    arm.needsUpdate = true;
    own.push(arm);
    return { color: T(p.color), normal: T(p.normal, { srgb: false }), arm };
  };
  let land = null;
  let ground = null;
  let groundMat = null;
  const GT = 16;
  const GW = 520;
  const GL = 528;
  if (kind !== 'city') {
    const fallback = kind === 'desert' ? paintSand({ size, seed: 5 }) : paintDeck({ size, seed: 7 });
    const flat = groundSet ?? painted(fallback);
    const rock = rockSet ?? (kind === 'desert' ? painted(paintStrata({ size, seed: 9, palette: kind })) : flat);
    land = createLand(kind, { big, sets: { flat, flat2: ground2Set ?? flat, rock }, look: LAND[id === 'iacon' ? 'iacon' : kind] });
    root.add(land.mesh);
  } else {
    if (groundSet) {
      groundMat = lib.material(groundSet, { repeat: [(GW / GT) * 8, (GL / GT) * 8], envMapIntensity: 0.6, normalScale: new THREE.Vector2(1.2, 1.2) });
    } else {
      const groundP = paintPavement({ size, seed: 6 });
      groundMat = new THREE.MeshStandardMaterial({ map: T(groundP.color, { repeat: [GW / GT, GL / GT] }), normalMap: T(groundP.normal, { repeat: [GW / GT, GL / GT], srgb: false }), roughnessMap: T(groundP.rough, { repeat: [GW / GT, GL / GT], srgb: false }), roughness: 1 });
    }
    holes(groundMat, `ground-${id}`);
    // (the scan repeats every 2 m over 500: a turned second copy, blended in
    // by a slow noise, keeps the repeat from showing; lib/three/surface)
    antiTile(groundMat, { frequency: 0.05 });
    ground = new THREE.Mesh(new THREE.PlaneGeometry(GW, GL), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.03;
    ground.receiveShadow = true;
    root.add(ground);
  }
  const height = land ? land.height : () => 0;

  // the canyon under a broken bridge: rock faces (cut through the land, or
  // straight down in the city), a river (or lava), the deck's broken ends and
  // the piers that held it up
  const rockTint = kind === 'kaon' ? 0x6a5a58 : kind === 'city' ? 0x9a9a9a : 0xf0c8a8;
  let rockMat;
  if (rockSet) rockMat = lib.material(rockSet, { repeat: land ? [1, 1] : [GW / 26, 40 / 26], color: rockTint, metal: kind === 'kaon', normalScale: new THREE.Vector2(1.4, 1.4) });
  else {
    const strata = paintStrata({ size, seed: 9, palette: kind });
    rockMat = new THREE.MeshStandardMaterial({ map: T(strata.color, { repeat: land ? [1, 1] : [12, 2] }), normalMap: T(strata.normal, { repeat: land ? [1, 1] : [12, 2], srgb: false }), roughness: 0.95 });
  }
  rockMat.side = THREE.DoubleSide;
  if (land) rockMat.vertexColors = true;
  const chasmP = paintChasm({ size: 256, kind: kind === 'kaon' && cyber.river === 'energon' ? 'energon' : kind });
  const chasmMat = new THREE.MeshStandardMaterial({
    map: T(chasmP.color, { repeat: [60, 6] }),
    emissiveMap: chasmP.emissive ? T(chasmP.emissive, { repeat: [60, 6] }) : null,
    emissive: chasmP.emissive ? new THREE.Color(2.2, 1, 0.3) : new THREE.Color(0, 0, 0),
    roughness: kind === 'kaon' ? 0.6 : 0.08,
    metalness: kind === 'kaon' ? 0 : 0.3,
    envMapIntensity: 1.4,
  });
  const deckMat = shared.concreteMat;
  const FLOOR_W = land ? 1640 : GW;
  // the ramp's side profile, extruded across the road
  const profile = new THREE.Shape();
  profile.moveTo(0, 0);
  profile.lineTo(ROLL.ramp.len, ROLL.ramp.h);
  profile.lineTo(ROLL.ramp.len, -0.8);
  profile.lineTo(0, -0.06);
  const rampGeo = new THREE.ExtrudeGeometry(profile, { depth: ROAD_TILE - 0.2, bevelEnabled: false });
  rampGeo.rotateY(Math.PI / 2);
  rampGeo.translate(-(ROAD_TILE - 0.2) / 2, 0, 0);
  const lipGeo = new THREE.PlaneGeometry(ROAD_TILE - 0.2, 0.7);
  const lipMat = new THREE.MeshStandardMaterial({ map: shared.hazard, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2 });
  const canyons = [0, 1].map(() => {
    const g = new THREE.Group();
    let near;
    let far;
    if (land) {
      near = cutFace(height, { big });
      far = cutFace(height, { big });
      g.add(new THREE.Mesh(near.geo, rockMat), new THREE.Mesh(far.geo, rockMat));
    } else {
      near = new THREE.Mesh(new THREE.PlaneGeometry(GW, 40), rockMat);
      far = near.clone();
      far.rotation.y = Math.PI;
      g.add(near, far);
    }
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(FLOOR_W, 1), chasmMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -26;
    const deckA = new THREE.Mesh(new THREE.BoxGeometry(ROAD_TILE + 0.6, 1.3, 3.2), deckMat);
    const deckB = deckA.clone();
    deckA.castShadow = deckB.castShadow = true;
    const pierGeo = new THREE.CylinderGeometry(0.9, 1.1, 26, 12);
    const piers = [];
    for (let i = 0; i < 4; i++) {
      const pier = new THREE.Mesh(pierGeo, deckMat);
      piers.push(pier);
      g.add(pier);
    }
    // jagged broken ends with rebar
    const chunkGeo = new THREE.BoxGeometry(1, 1, 1);
    const chunks = new THREE.InstancedMesh(chunkGeo, deckMat, 36);
    const rebarGeo = new THREE.CylinderGeometry(0.035, 0.035, 1.4, 5);
    const rebars = new THREE.InstancedMesh(rebarGeo, M.dark, 40);
    chunks.castShadow = true;
    // the ramp: the broken deck tilted up toward the gap, chevrons on its lip
    const ramp = new THREE.Mesh(rampGeo, deckMat);
    ramp.castShadow = ramp.receiveShadow = true;
    const lip = new THREE.Mesh(lipGeo, lipMat);
    lip.rotation.x = -Math.PI / 2 + Math.atan2(ROLL.ramp.h, ROLL.ramp.len);
    g.add(floor, deckA, deckB, chunks, rebars, ramp, lip);
    g.visible = false;
    root.add(g);
    return { g, near, far, floor, deckA, deckB, piers, chunks, rebars, ramp, lip, gap: null };
  });
  const placeCanyon = (c, gap) => {
    c.gap = gap;
    const z0 = gap.z;
    const z1 = gap.z + gap.len;
    const pad = CUT_PAD;
    if (land) {
      c.near.shape(z0, 1, -30);
      c.far.shape(z1, -1, -30);
    } else {
      c.near.position.set(0, -20, -(z0 - pad));
      c.far.position.set(0, -20, -(z1 + pad));
      c.near.rotation.y = Math.PI;
      c.far.rotation.y = 0;
    }
    const reach = land ? cutWiden(820) + pad : pad;
    c.floor.scale.y = z1 - z0 + reach * 2; // the plane's own y runs along the road once laid flat
    c.ramp.position.set(0, 0, -(z0 - ROLL.ramp.len));
    c.lip.position.set(0, ROLL.ramp.h * (1 - 0.35 / ROLL.ramp.len) + 0.015, -(z0 - 0.35));
    c.floor.position.set(0, -26, -(z0 + z1) / 2);
    c.deckA.position.set(0, -0.66, -(z0 - pad / 2 + 0.1));
    c.deckB.position.set(0, -0.66, -(z1 + pad / 2 - 0.1));
    c.piers.forEach((p, i) => p.position.set(i % 2 ? 4 : -4, -13.5, i < 2 ? -(z0 - pad / 2) : -(z1 + pad / 2)));
    const r = rnd(Math.round(z0));
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    for (let i = 0; i < 36; i++) {
      const side = i < 18 ? 0 : 1;
      const x = -6.4 + ((i % 18) / 17) * 12.8;
      const z = side ? z1 : z0;
      e.set((r() - 0.5) * 0.8, r() * 3, (r() - 0.5) * 0.8);
      q.setFromEuler(e);
      m.compose(new THREE.Vector3(x, -0.35 - r() * 0.3, -(z + (side ? -0.1 : 0.1) * (1 + r()))), q, new THREE.Vector3(0.5 + r() * 0.5, 0.4 + r() * 0.6, 0.4 + r() * 0.5));
      c.chunks.setMatrixAt(i, m);
    }
    for (let i = 0; i < 40; i++) {
      const side = i < 20 ? 0 : 1;
      const x = -6.2 + ((i % 20) / 19) * 12.4;
      const z = side ? z1 : z0;
      e.set(Math.PI / 2 + (r() - 0.5) * 0.9 * (side ? -1 : 1), 0, (r() - 0.5) * 0.5);
      q.setFromEuler(e);
      m.compose(new THREE.Vector3(x, -0.45, -(z + (side ? 0.55 : -0.55))), q, new THREE.Vector3(1, 0.6 + r() * 0.6, 1));
      c.rebars.setMatrixAt(i, m);
    }
    c.chunks.instanceMatrix.needsUpdate = true;
    c.rebars.instanceMatrix.needsUpdate = true;
    c.g.visible = true;
  };

  // ── scenery ──
  // Nothing stands where a canyon cuts the land: this stage's broken bridges
  // are all known when it starts.
  let gapsNow = [];
  const inCut = (x, z) => {
    const w = CUT_PAD + (land ? cutWiden(x) : 0) + 2;
    for (const p of gapsNow) if (z > p.z - w && z < p.z + p.len + w) return true;
    return false;
  };
  const steep = (x, z) => {
    const h = height(x, z);
    return Math.hypot(height(x + 1, z) - h, height(x, z + 1) - h) > 0.55;
  };
  const cut = []; // [material, extra margin] for everything cut at a broken bridge
  const bands = [];
  const keep = (place) => (i, r, z) => {
    const t = place(i, r, z);
    return t && !inCut(t.x, t.z) ? t : null;
  };
  const band = (geo, mat, count, length, place, { shadow = false } = {}) => {
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    root.add(mesh);
    const b = new Band(mesh, count, length, keep(place));
    bands.push(b);
    return b;
  };
  // the same for a scanned model: every part of it instanced together
  const modelBand = (model, count, length, place, { shadow = false, scale = 1 } = {}) => {
    if (!model) return null;
    const inst = models.instanced(model, count, { shadow, scale });
    inst.addTo(root);
    const b = new Band(inst, count, length, keep(place));
    bands.push(b);
    return b;
  };
  const sideX = (r, lo, hi) => (r() < 0.5 ? -1 : 1) * (lo + r() * (hi - lo));
  // stood on the land, a little sunk so nothing floats on a slope
  const on = (x, z, sink = 0.1) => height(x, z) - sink;
  const props = await Promise.all((PROPS[id] ?? []).map((n) => models.load(n)));
  const prop = (n) => props[(PROPS[id] ?? []).indexOf(n)] ?? null;
  // a model's scale to stand h metres tall
  const tall = (model, h) => (model ? h / Math.max(0.01, model.size.y) : 1);

  const railMat = holes(new THREE.MeshStandardMaterial({ color: 0xc4cad2, metalness: 0.9, roughness: 0.32 }), `rail-${id}`);
  const postMat = holes(new THREE.MeshStandardMaterial({ color: 0x8e949c, metalness: 0.75, roughness: 0.5 }), `post-${id}`);
  const reflMat = holes(M.lamp(0xffb34a, 1.6), `refl-${id}`);
  cut.push([railMat, 0], [postMat, 0], [reflMat, 0]);
  if (kind === 'desert') {
    // W-beam guard rail on steel posts, reflector posts beyond it
    const postGeo = new THREE.BoxGeometry(0.1, 0.84, 0.16);
    postGeo.translate(0, 0.42, 0);
    band(postGeo, postMat, 120, 240, (i, r, z) => ({ x: (i % 2 ? 1 : -1) * 7.27, z: z + (i % 2) * 2, y: on(7.27, z, 0.05) }));
    band(wBeam(), railMat, 120, 240, (i, r, z) => ({ x: (i % 2 ? 1 : -1) * 7.2, z: z + (i % 2) * 2 + 2, ry: i % 2 ? Math.PI : 0 }));
    const refl = new THREE.CylinderGeometry(0.035, 0.035, 1.1, 6);
    refl.translate(0, 0.55, 0);
    band(refl, reflMat, 40, 240, (i, r, z) => ({ x: (i % 2 ? 1 : -1) * 7.9, z: z + 3, y: on(7.9, z + 3, 0.05) }));
  } else if (kind === 'kaon') {
    // Kaon: low iron barriers with an amber lamp on every other one
    const kerb = new THREE.BoxGeometry(0.5, 0.42, 3.4);
    kerb.translate(0, 0.21, 0);
    const kerbMat = holes(new THREE.MeshStandardMaterial({ color: 0x3a3c44, metalness: 0.85, roughness: 0.38 }), 'kerb');
    const lampMat = holes(M.lamp(cyber.lamp, 1.4), `kerb-lamp-${id}`);
    cut.push([kerbMat, 0], [lampMat, 0]);
    band(kerb, kerbMat, 100, 400, (i, r, z) => ({ x: (i % 2 ? 1 : -1) * 7.15, z }));
    const lamp = new THREE.BoxGeometry(0.16, 0.06, 0.5);
    lamp.translate(0, 0.45, 0);
    band(lamp, lampMat, 50, 400, (i, r, z) => ({ x: (i % 2 ? 1 : -1) * 7.15, z }));
  }

  if (kind === 'desert') {
    // dry grass, thick by the road and thinning out
    const tufts = new THREE.InstancedMesh(tuftGeometry({ seed: 11 }), tuftMaterial({ fadeFrom: 92, fadeTo: 128 }), big ? 2600 : 1300);
    const tint = new THREE.Color();
    const tr = rnd(77);
    for (let i = 0; i < tufts.count; i++) tufts.setColorAt(i, tint.setHSL(0.09 + tr() * 0.05, 0.25 + tr() * 0.3, 0.42 + tr() * 0.2).multiplyScalar(1.6));
    tufts.receiveShadow = true;
    root.add(tufts);
    bands.push(
      new Band(
        tufts,
        tufts.count,
        160,
        keep((i, r, z) => {
          const x = (r() < 0.5 ? -1 : 1) * (7.7 + r() ** 1.8 * 60);
          const zz = z + r() * 3;
          if (steep(x, zz)) return null;
          return { x, z: zz, y: on(x, zz, 0.04), s: 0.7 + r() * 0.9, ry: r() * 6.3 };
        }),
      ),
    );
    // shrubs and brush, boulders, quiver trees (Poly Haven scans); tyres and
    // barrels dumped by the road; telephone poles
    const shrub = prop('shrub');
    modelBand(shrub, 90, 360, (i, r, z) => {
      const x = sideX(r, 8.5, 130);
      const zz = z + r() * 4;
      return steep(x, zz) ? null : { x, z: zz, y: on(x, zz, 0.08), s: tall(shrub, 0.7 + r() * 1.1), ry: r() * 6.3 };
    });
    const brush = prop('brush');
    modelBand(brush, 24, 320, (i, r, z) => {
      const x = sideX(r, 8.2, 40);
      const zz = z + r() * 6;
      return { x, z: zz, y: on(x, zz, 0.05), s: tall(brush, 0.35 + r() * 0.3), ry: r() * 6.3 };
    });
    const tree = prop('quiver-tree');
    modelBand(tree, 40, 520, (i, r, z) => {
      const x = sideX(r, 11, 150);
      const zz = z + r() * 8;
      return steep(x, zz) ? null : { x, z: zz, y: on(x, zz, 0.15), s: 2.4 + r() * 2.4, ry: r() * 6.3 };
    }, { shadow: true });
    const trunk = prop('dead-trunk');
    modelBand(trunk, 10, 480, (i, r, z) => {
      const x = sideX(r, 10, 60);
      const zz = z + r() * 8;
      return { x, z: zz, y: on(x, zz, 0.1), s: tall(trunk, 1.4 + r() * 1.6), ry: r() * 6.3 };
    }, { shadow: true });
    const boulders = prop('boulders');
    modelBand(boulders, 22, 480, (i, r, z) => {
      const x = sideX(r, 12, 160);
      const zz = z + r() * 10;
      return { x, z: zz, y: on(x, zz, 0.4), s: tall(boulders, 1.4 + r() * 4 * (Math.abs(x) / 160 + 0.4)), ry: r() * 6.3 };
    });
    const boulder = prop('boulder');
    modelBand(boulder, 30, 440, (i, r, z) => {
      const x = sideX(r, 9.5, 120);
      const zz = z + r() * 10;
      return { x, z: zz, y: on(x, zz, 0.3), s: tall(boulder, 0.6 + r() * 2.6), ry: r() * 6.3, rx: (r() - 0.5) * 0.3 };
    });
    modelBand(prop('rock'), 16, 420, (i, r, z) => {
      const x = sideX(r, 30, 200);
      const zz = z + r() * 5;
      return { x, z: zz, s: [3 + r() * 9, 2.5 + r() * 7, 3 + r() * 9], ry: r() * 6.3, y: on(x, zz, 0.6) };
    });
    modelBand(prop('tyre'), 8, 420, (i, r, z) => {
      const x = sideX(r, 8.4, 11);
      return { x, z, s: 1.1, rx: Math.PI / 2, ry: r() * 6.3, y: on(x, z, -0.08) };
    }, { shadow: true });
    modelBand(prop('barrel'), 6, 520, (i, r, z) => {
      const x = sideX(r, 8.6, 12);
      return { x, z, s: 1, ry: r() * 6.3, rz: r() < 0.4 ? Math.PI / 2 : 0, y: on(x, z, 0.02) };
    }, { shadow: true });
    const pole = new THREE.CylinderGeometry(0.12, 0.17, 9.4, 8);
    pole.translate(0, 4.5, 0);
    const wood = new THREE.MeshStandardMaterial({ color: 0x5a4330, roughness: 0.9 });
    band(pole, wood, 24, 480, (i, r, z) => ({ x: 13.5, z, y: on(13.5, z, 0.3) }), { shadow: true });
    const arm = new THREE.BoxGeometry(2.2, 0.14, 0.14);
    arm.translate(0, 8.4, 0);
    band(arm, wood, 24, 480, (i, r, z) => ({ x: 13.5, z, y: on(13.5, z, 0.3) }));
    const insulator = new THREE.CylinderGeometry(0.05, 0.07, 0.22, 6);
    insulator.translate(0, 8.6, 0);
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x6d8f7a, roughness: 0.15, metalness: 0.1 });
    for (const dx of [-0.9, 0.9]) band(insulator, glassMat, 24, 480, (i, r, z) => ({ x: 13.5 + dx, z, y: on(13.5, z, 0.3) }));
  } else if (kind === 'city') {
    // blocks faced with ambientCG facades: their windows light up by themselves
    const facades = await Promise.all(['facade-brick', 'facade-office', 'facade-tower', 'facade-glass'].map((n) => lib.load(n, { emission: true })));
    const box = new THREE.BoxGeometry(1, 1, 1);
    box.translate(0, 0.5, 0);
    const plan = [
      [facades[0], 34, true, 13],
      [facades[1], 34, true, 13],
      [facades[2], 30, false, 26],
      [facades[3], 30, false, 26],
    ];
    plan.forEach(([set, count, near, tile], fi) => {
      let mat;
      if (set) mat = lib.material(set, { envMapIntensity: 0.5, emissiveIntensity: 0.7 });
      else {
        const f = paintFacade({ w: 256, h: 384, seed: 13 + fi, kind: near ? 'brick' : 'glass' });
        mat = new THREE.MeshStandardMaterial({ map: T(f.color), emissiveMap: T(f.emissive), emissive: new THREE.Color(1.6, 1.4, 1.1), roughness: 0.6 });
      }
      worldUv(mat, tile, tile, `facade-${fi}`);
      band(box, mat, count, 420, (i, r, z) => {
        const sd = i % 2 ? 1 : -1;
        const wid = 13 + Math.round(r() * 2) * 6.5;
        const hgt = near ? 13 + Math.round(r() * 2) * 6.5 : 39 + Math.round(r() * 5) * 13;
        return { x: sd * (15.5 + wid / 2 + (near ? 0 : 6 + r() * 30)), z: z + r() * 6, s: [wid, hgt, 12 + r() * 14] };
      });
    });
    // lampposts (scanned): their glass lanterns lit, a pool of light below each
    const lampModel = prop('street-lamp');
    const lampScale = lampModel ? 6.2 / lampModel.size.y : 1;
    if (lampModel) {
      for (const part of lampModel.parts) {
        if (/glass/i.test(part.material.name)) {
          part.material.emissive = new THREE.Color(1, 0.72, 0.42);
          part.material.emissiveIntensity = 1.7;
        }
      }
    }
    modelBand(lampModel, 36, 396, (i, r, z) => ({ x: (i % 2 ? 1 : -1) * 8.1, z: z + (i % 2) * 11, ry: r() * 6.3 }), { scale: lampScale, shadow: true });
    const poolGeo = new THREE.PlaneGeometry(9, 9);
    poolGeo.rotateX(-Math.PI / 2);
    const poolMat = holes(new THREE.MeshBasicMaterial({ map: shared.pool, color: new THREE.Color(1, 0.78, 0.5).multiplyScalar(0.3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -3 }), 'pool');
    cut.push([poolMat, 0]);
    band(poolGeo, poolMat, 36, 396, (i, r, z) => ({ x: (i % 2 ? 1 : -1) * 6.6, z: z + (i % 2) * 11, y: 0.02 }));
    modelBand(prop('utility-box'), 12, 400, (i, r, z) => ({ x: (i % 2 ? 1 : -1) * (10.6 + r()), z, ry: (i % 2 ? -1 : 1) * Math.PI / 2 }), { shadow: true });
    modelBand(prop('trash-can'), 12, 360, (i, r, z) => ({ x: (i % 2 ? 1 : -1) * (9.6 + r() * 0.6), z, ry: r() * 6 }), { shadow: true });
    const sidewalk = new THREE.BoxGeometry(4.5, 0.25, 20);
    band(sidewalk, deckMat, 40, 400, (i, r, z) => ({ x: (i % 2 ? 1 : -1) * 9.6, z, y: 0.12 }));
  } else {
    // Kaon: megastructures in plated iron with furnace light in their window
    // slits, standing on the terraces; gates over the road
    let ironMat;
    if (roadSet) ironMat = lib.material(roadSet, { metal: true, color: 0x8a8894, envMapIntensity: 1.25, normalScale: new THREE.Vector2(1.3, 1.3) });
    else ironMat = new THREE.MeshStandardMaterial({ color: 0x3a3a42, metalness: 0.85, roughness: 0.4 });
    ironMat.emissive = new THREE.Color(...cyber.slit);
    kaonMetal(ironMat, { tile: 11, slit: 4.6, key: 'mega' });
    const megas = [megaGeometry(3), megaGeometry(8), megaGeometry(21)];
    megas.forEach((geo, k) => {
      band(geo, ironMat, 9, 760, (i, r, z) => {
        const w = 16 + r() * 22;
        const x = (i % 2 ? 1 : -1) * (30 + w * 0.6 + r() * 70);
        const zz = z + r() * 30;
        return { x, z: zz, y: on(x, zz, 3), s: [w, w * (0.85 + r() * 0.7) * cyber.tall, w], ry: r() * 6.3 };
      });
      band(geo, ironMat, 12, 900, (i, r, z) => {
        const w = 30 + r() * 40;
        const x = (r() < 0.5 ? -1 : 1) * (150 + r() * 330);
        const zz = z + r() * 60;
        return { x, z: zz, y: on(x, zz, 3), s: [w, w * (1 + r() * 0.8) * cyber.tall, w], ry: r() * 6.3 };
      });
      return k;
    });
    const gateMat = new THREE.MeshStandardMaterial({ color: 0x2c2d34, metalness: 0.9, roughness: 0.35, envMapIntensity: 1.3 });
    band(gateGeometry(), gateMat, 5, 700, (i, r, z) => ({ x: 0, z, y: 0 }), { shadow: true });
    band(gateTrimGeometry(), M.lamp(cyber.trim, 1.6), 5, 700, (i, r, z) => ({ x: 0, z, y: 0 }));
    modelBand(prop('barrel'), 10, 480, (i, r, z) => {
      const x = sideX(r, 8.4, 12);
      return { x, z, s: 1, ry: r() * 6.3, rz: r() < 0.5 ? Math.PI / 2 : 0, y: on(x, z, 0) };
    }, { shadow: true });
  }

  // signs before roadblocks and broken bridges
  const signs = {
    closed: T(paintSign(kind === 'kaon' ? cyber.sign : { text: ['ROAD', 'CLOSED'], bg: '#f39c12', fg: '#111' }), { wrap: false }),
    bridge: T(paintSign({ text: ['BRIDGE', 'OUT'], bg: '#f39c12' }), { wrap: false }),
  };
  const signGeo = new THREE.PlaneGeometry(2.2, 2.2);
  const signPostGeo = new THREE.CylinderGeometry(0.06, 0.06, 2.4, 6);
  const makeSign = (tex) => {
    const g = new THREE.Group();
    const face = new THREE.Mesh(signGeo, new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.5, roughness: 0.4, metalness: 0.1, side: THREE.DoubleSide }));
    face.position.y = 3.2;
    const post = new THREE.Mesh(signPostGeo, postMat);
    post.position.y = 1.2;
    face.castShadow = true;
    g.add(face, post);
    root.add(g);
    g.visible = false;
    return g;
  };
  const signPool = Array.from({ length: 6 }, (_, i) => ({ g: makeSign(i < 3 ? signs.closed : signs.bridge), kind: i < 3 ? 'closed' : 'bridge' }));

  const placeSigns = (g) => {
    const want = [];
    for (const b of g.barricades) if (!b.broken && b.z > g.z - 10 && b.z < g.z + 260) want.push({ z: b.z - 45, kind: 'closed' });
    for (const p of g.gaps) if (p.z > g.z - 10 && p.z < g.z + 280) want.push({ z: p.z - ROLL.ramp.len - 55, kind: 'bridge' });
    let ci = 0;
    let bi = 3;
    for (const s of signPool) s.g.visible = false;
    for (const w of want) {
      const slot = w.kind === 'closed' ? signPool[ci++] : signPool[bi++];
      if (!slot || (w.kind === 'closed' ? ci > 3 : bi > 6)) continue;
      slot.g.visible = true;
      slot.g.position.set(7.9, height(7.9, w.z), -w.z);
      slot.g.rotation.y = -0.25;
    }
  };

  // ── light ──
  const hemi = new THREE.HemisphereLight(look.hemi[0], look.hemi[1], look.hemi[2]);
  root.add(hemi);
  const sun = new THREE.DirectionalLight(look.sun.color, look.sun.k);
  sun.castShadow = true;
  sun.shadow.mapSize.set(big ? 2048 : 1024, big ? 2048 : 1024);
  const sc = sun.shadow.camera;
  sc.left = -18;
  sc.right = 18;
  sc.top = 32;
  sc.bottom = -32;
  sc.near = 1;
  sc.far = 160;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  root.add(sun, sun.target);
  // shadows from a low sun run long: cast them from no lower than 14°
  const shadowDir = sunDir.clone();
  shadowDir.y = Math.max(shadowDir.y, Math.sin(THREE.MathUtils.degToRad(14)));
  shadowDir.normalize();

  let envTex = null;
  const fog = new THREE.FogExp2(fogCol, look.fogDensity);

  const update = (g, cam, t) => {
    const z = g.z;
    sky.position.copy(cam.position);
    // road and ground step forward a tile at a time
    const zr = Math.floor((z - 60) / ROAD_TILE) * ROAD_TILE;
    road.position.set(0, 0, -(zr + ROAD_LEN / 2));
    lanes.position.copy(road.position);
    if (land) land.follow(z);
    else {
      const zg = Math.floor((z - 120) / GT) * GT;
      ground.position.set(0, -0.03, -(zg + GL / 2));
    }
    // the holes, and the canyons under them
    gapsNow = g.gaps;
    const near = g.gaps.filter((p) => p.z + p.len > z - 60 && p.z < z + 420).slice(0, 3);
    const surfaces = [[roadMat, 0], [laneMat, 0], ...(land ? [[land.material, 0]] : [[groundMat, CUT_PAD]]), ...cut];
    for (let i = 0; i < 3; i++) {
      const p = near[i];
      for (const [m, pad] of surfaces) m.userData.gaps[i].set(p ? p.z - pad : 1e9, p ? p.z + p.len + pad : 1e9);
    }
    canyons.forEach((c, i) => {
      const p = near[i];
      if (!p) c.g.visible = false;
      else if (c.gap !== p) placeCanyon(c, p);
    });
    for (const b of bands) b.update(z);
    for (const b of bands) {
      const u = b.mesh.material?.userData?.uniforms;
      if (u?.uTime) u.uTime.value = t;
    }
    placeSigns(g);
    // the sun's shadow box follows you; the light comes from where the sun is
    sun.position.set(g.x + shadowDir.x * 70, shadowDir.y * 70, -(z + 12) + shadowDir.z * 70);
    sun.target.position.set(g.x, 0, -(z + 12));
  };

  const attach = (scene, stage) => {
    scene.add(root);
    scene.fog = fog;
    stage.renderer.toneMappingExposure = look.exposure;
    stage.grade?.(look.grade);
    loadHdri(look.hdri, stage).then((env) => {
      if (!root.parent || !env || stage.disposed) return;
      envTex = env;
      scene.environment = env;
      scene.environmentIntensity = look.env;
    });
  };

  const dispose = (scene) => {
    scene.remove(root);
    if (scene.environment === envTex) scene.environment = null;
    root.traverse((o) => {
      o.geometry?.dispose?.();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of mats) if (!m.userData?.shared && !Object.values(M).includes(m)) m.dispose?.();
    });
    own.forEach((t) => t.dispose());
  };

  return { id, look, root, update, attach, dispose, night: look.night, kind, height, sun, hemi };
}

// Surfaces every stage shares: Poly Haven concrete for decks, piers and
// barriers (painted if it can't load), and hazard chevrons for the ramps.
export async function sharedSurfaces(renderer, big, panels, lib) {
  const set = await lib.load('concrete');
  let concreteMat;
  if (set) concreteMat = lib.material(set, { repeat: [2, 1], envMapIntensity: 0.5 });
  else {
    const c = paintConcrete({ size: big ? 256 : 128, seed: 12 });
    concreteMat = new THREE.MeshStandardMaterial({ map: canvasTexture(c.color, renderer, { repeat: [2, 1] }), normalMap: canvasTexture(c.normal, renderer, { repeat: [2, 1], srgb: false }), roughness: 0.9 });
  }
  concreteMat.userData.shared = true;
  const hz = document.createElement('canvas');
  hz.width = 256;
  hz.height = 32;
  const x = hz.getContext('2d');
  x.fillStyle = '#f2c230';
  x.fillRect(0, 0, 256, 32);
  x.fillStyle = '#141414';
  for (let i = -32; i < 288; i += 32) {
    x.beginPath();
    x.moveTo(i, 0);
    x.lineTo(i + 16, 0);
    x.lineTo(i + 32, 32);
    x.lineTo(i + 16, 32);
    x.fill();
  }
  // the pool of light under a street lamp
  const pool = document.createElement('canvas');
  pool.width = pool.height = 128;
  const px = pool.getContext('2d');
  const gr = px.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.45, 'rgba(255,255,255,0.45)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  px.fillStyle = gr;
  px.fillRect(0, 0, 128, 128);
  return { panels, concreteMat, hazard: canvasTexture(hz, renderer, { repeat: [3, 1] }), pool: canvasTexture(pool, renderer, { wrap: false }) };
}

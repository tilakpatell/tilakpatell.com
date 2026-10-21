// Portal panic in WebGL: reads the game state and draws it, nothing more.
// Toon-shaded like the show, a line round the cast only and no film grade
// (./look.js). Each dimension is a painted floor in
// a ring (a picket fence, a ridge of flesh, rocks, a deck rail), its props
// and backdrop from CC0 Kenney kits (toon-shaded), a cartoon sky, and its own
// light. Portals are the show's green swirl; shots, bolts, seeds and sparks
// glow through bloom. Loaded only when a game starts.
//
// The cast's bodies show what the rules decide and never change it: each
// figure's feet from the ground it covers (lib/ai/body.js, so a strafing
// Gromflomite's hips turn to where it's going while its chest stays on you,
// and a backpedal walks backward), its turns eased, and the rules' events
// played on it: the gun up while it fires, a flinch where it's hit, a
// Gazorpian's punch as it winds up, a fall by the shot's way when it dies
// (and a moment on the ground before it goes), a Meeseeks from the box
// stopping to punch and cheering before it poofs, the hero's cheer on a
// wave cleared and chest-pounding taunt on a combo, Evil Morty's shot, taunt
// and fall. A figure that has no clips (the shapes of ./cast.js, a model
// without a skeleton) takes the calls and does nothing with them.

import * as THREE from 'three';
import { canvasTexture, createStage } from '../../../lib/stage3d';
import { houseOn } from '../../../lib/three/house';
import { CAST_INK, LOOK as PANIC_LOOK } from './look';
import { PLAIN } from '../world/look';
import { createModels } from '../../../lib/models';
import { turn } from '../../../lib/three/gait';
import { bodyFrom } from '../../../lib/ai/body';
import { PANIC, butterRobots } from './rules';
import { releaf, releafMap, toon } from './toon';
import { animate, hull, makeCast, portalGun } from './cast';
import { createMeshyCast } from './meshyCast';
import { glowDot, paintFloor, paintFloorGlow, puff } from './paint';
import { SWIRL_GLSL } from '../swirl';
import { createFeel, feelGroups } from '../../../lib/three/feel';

const R = PANIC.arena;

// each dimension's sky, ground and light
const LOOK = {
  backyard: { top: 0x2f7fd6, mid: 0x86c4ef, low: 0xdff2ff, ground: 0x4f9a3c, sun: [0xfff1d8, 2.3], hemi: [0xd2ecff, 0x4b7a3b, 1.2], clouds: 0.62, stars: 0, suns: 1, sunCol: 0xfff6c8, fog: [0xcde9fa, 55, 150], exposure: 1.0, rim: 'fence', leaf: 0x2f8530 },
  cronenberg: { top: 0x2c1640, mid: 0x7a3c6c, low: 0xd2a070, ground: 0x8e4462, sun: [0xffd2b0, 2.0], hemi: [0xf0a8c8, 0x55203e, 1.05], clouds: 0.7, stars: 0, suns: 1, sunCol: 0xffe4a0, fog: [0xb07a86, 45, 130], exposure: 1.0, rim: 'flesh', leaf: 0x8a5a9a },
  gazorpazorp: { top: 0x6e2452, mid: 0xe06a3a, low: 0xffc276, ground: 0xc4652c, sun: [0xffd49a, 2.6], hemi: [0xffc4a0, 0x7a3a20, 1.0], clouds: 0.28, stars: 0, suns: 2, sunCol: 0xfff0b0, fog: [0xf0a070, 50, 140], exposure: 1.0, rim: 'rocks', leaf: 0x2aa08a },
  citadel: { top: 0x04050e, mid: 0x111637, low: 0x34296a, ground: 0x343e52, sun: [0xd4e2ff, 1.9], hemi: [0x8ca2ff, 0x1c1c2c, 1.05], clouds: 0, stars: 1, suns: 0, sunCol: 0xffffff, fog: [0x1a1838, 50, 160], exposure: 1.05, rim: 'rail' },
};

// a prop for each obstacle kind: a Kenney model, tinted for the dimension
const PROPS = {
  backyard: { tree: ['oak'], bush: ['bush'], rock: ['rock'] },
  cronenberg: { flesh: [null], stump: ['stump', 0xb0687a, 0.5], rock: ['rock-tall', 0xa0607a, 0.45], mushroom: ['mushroom', 0x9a4ad0, 0.65] },
  gazorpazorp: { spire: ['spire', 0xd0683a, 0.55], crystal: ['crystal', 0xd060ff, 0.5], rock: ['meteor', 0xb05a30, 0.4], cactus: ['cactus', 0x3abf9f, 0.6] },
  citadel: { console: ['console'], pillar: ['pillar'], crate: ['barrels'] },
};
const KENNEY = ['house-a', 'house-c', 'house-f', 'house-k', 'fence', 'tree-large', 'tree-small', 'oak', 'bush', 'rock', 'flowers', 'dead-tree', 'stump', 'mushroom', 'rock-tall', 'spire', 'cliff', 'cactus', 'crystal', 'meteor', 'crater', 'console', 'computer', 'pillar', 'barrels', 'dish', 'hangar', 'turret'];

// the plants among them, whose greens take each dimension's leaf colour
const PLANTS = new Set(['tree-large', 'tree-small', 'oak', 'bush', 'flowers', 'dead-tree', 'cactus']);

const ENEMY_CAST = { meeseeks: 'meeseeks', gromflomite: 'gromflomite', cronenberg: 'cronenberg', blob: 'blob', gazorpian: 'gazorpian', cop: 'cop', morty: 'mortyclone' };
const BOSS_CAST = { snowball: 'snowball', cronenberg: 'bigcronenberg', cromulon: 'cromulon', evilmorty: 'evilmorty' };
const PUFF_COL = { meeseeks: [0.45, 0.8, 0.95], gromflomite: [0.5, 0.6, 0.35], cronenberg: [0.95, 0.6, 0.65], blob: [0.95, 0.65, 0.7], gazorpian: [0.75, 0.4, 0.3], cop: [0.4, 0.45, 0.7], morty: [0.95, 0.85, 0.4] };

// ── the bodies ──
// A fallen enemy lies LIE seconds once its fall's over, then sinks out of
// sight in SINK; how long each fall takes, by its clip (clipLibrary.js's
// files: the troopers' deaths, Meshy's Knock_Down, the UAL's Death01)
export const LIE = 0.8;
const SINK = 0.45;
const SINK_DEPTH = 0.7;
const FALL = { 'die.fwd': 2.2, 'die.back': 3.53, 'die.blown': 2.7, fall: 2.53, die: 2.4 };
const CRUMPLE = 0.8; // a figure of shapes going down (./cast.js's down)
const NO_FALL = new Set(['cronenberg', 'blob']); // a Cronenberg splits, a blob pops: gone in a puff, as ever
const TELEPORT = 24; // faster than this over the ground (a second) is a jump through a portal, not a step
const FIRE_HOLD = 0.5; // the hero's gun kept up this long after the last shot
const AIM_HOLD = 2.6; // an enemy's, after its last bolt (they fire every two seconds or so)
const FIRE_EVERY = 0.25; // the quickest a shot's kick plays again
const CHEER = 1.1; // a Meeseeks' cheer before it poofs
// how fast each turns to face where it wants (gait.js turn's rate)
const TURN = { hero: 16, enemy: 9, charge: 14, ally: 10, snowball: 3.5, cronenberg: 2, evilmorty: 10 };
const STILL = Object.freeze({ speed: 0, side: 0, turn: 0 });
const UP = new THREE.Vector3(0, 1, 0);
const NONE = new Map();

// The enemies' figures, by id: a living enemy keeps the figure take(kind,
// id) gave it; a killed one keeps it while it falls (`fallen`: id → the
// seconds its fall takes), lies `lie` seconds and sinks `sink`, and only
// then is it freed; one gone without a fall is freed at once. Pure, so the
// tests can hand it fakes.
//   sync(enemies, fallen): once a frame, after the kills are known
//   step(dt): the dying's clocks; figure(id); dying: [{ c, id, kind, t, left }]
//   clear(): everyone freed (a new dimension, a new game)
export function createRoster({ take, free, lie = LIE, sink = SINK }) {
  const live = new Map(); // id → { c, kind }
  const dying = [];
  const sync = (enemies, fallen = NONE) => {
    const alive = new Set();
    for (const e of enemies) if (e.alive) alive.add(e.id);
    for (const [id, r] of live) {
      if (alive.has(id)) continue;
      live.delete(id);
      const len = fallen.get(id) ?? 0;
      if (len > 0) dying.push({ c: r.c, id, kind: r.kind, t: 0, left: len + lie + sink });
      else free(r.c, id);
    }
    for (const e of enemies) {
      if (!e.alive) continue;
      const r = live.get(e.id);
      if (r?.kind === e.kind) continue;
      if (r) free(r.c, e.id);
      live.set(e.id, { c: take(e.kind, e.id), kind: e.kind });
    }
  };
  const step = (dt) => {
    for (let i = dying.length - 1; i >= 0; i--) {
      const d = dying[i];
      d.t += dt;
      d.left -= dt;
      if (d.left > 0) continue;
      dying.splice(i, 1);
      free(d.c, d.id);
    }
  };
  const clear = () => {
    for (const [id, r] of live) free(r.c, id);
    live.clear();
    for (const d of dying.splice(0)) free(d.c, d.id);
  };
  return { sync, step, clear, dying, figure: (id) => live.get(id)?.c ?? null };
}

function rng(seed) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── the sky: a cartoon dome ──
function buildSky(L) {
  const sunDir = new THREE.Vector3(-0.45, 0.42, -1).normalize();
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(L.top) },
      mid: { value: new THREE.Color(L.mid) },
      low: { value: new THREE.Color(L.low) },
      sunCol: { value: new THREE.Color(L.sunCol) },
      sunDir: { value: sunDir },
      clouds: { value: L.clouds },
      stars: { value: L.stars },
      suns: { value: L.suns },
      t: { value: 0 },
    },
    vertexShader: 'varying vec3 vDir; void main() { vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }',
    fragmentShader: `
      uniform vec3 top, mid, low, sunCol, sunDir;
      uniform float clouds, stars, suns, t;
      varying vec3 vDir;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
      float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 c = h > 0.0 ? mix(mix(low, mid, smoothstep(0.0, 0.28, h)), top, smoothstep(0.22, 0.85, h)) : low;
        // suns: hard-edged discs with a soft halo
        if (suns > 0.5) {
          float s1 = dot(d, sunDir);
          c = mix(c, sunCol * 1.6, smoothstep(0.9965, 0.997, s1));
          c += sunCol * pow(max(s1, 0.0), 40.0) * 0.25;
          if (suns > 1.5) {
            vec3 s2d = normalize(sunDir + vec3(0.32, -0.12, 0.05));
            float s2 = dot(d, s2d);
            c = mix(c, vec3(1.0, 0.75, 0.55) * 1.4, smoothstep(0.9985, 0.999, s2));
          }
        }
        // flat cartoon clouds, a shade darker underneath
        if (clouds > 0.0 && h > 0.0) {
          vec2 uv = d.xz / (h + 0.3) * 1.4 + vec2(t * 0.006, 0.0);
          float n = fbm(uv);
          float cl = smoothstep(0.56, 0.575, n + clouds * 0.12 - 0.06) * smoothstep(0.02, 0.12, h);
          float under = smoothstep(0.56, 0.68, fbm(uv + vec2(0.0, 0.04)));
          vec3 cc = mix(mix(low, vec3(1.0), 0.75), vec3(1.0), under);
          c = mix(c, cc, cl);
        }
        // stars, and the planet the Citadel hangs over
        if (stars > 0.0 && h > -0.2) {
          vec2 g = floor(d.xz / (abs(h) + 0.6) * 220.0 + d.y * 400.0);
          float s = step(0.996, hash(g));
          c += vec3(s) * (0.6 + 0.4 * sin(t * 2.0 + hash(g * 1.3) * 30.0));
          vec3 pd = normalize(vec3(0.55, 0.25, -1.0));
          float pl = dot(d, pd);
          if (pl > 0.985) {
            float shade = smoothstep(0.985, 1.0, pl);
            vec3 pc = mix(vec3(0.25, 0.55, 0.85), vec3(0.45, 0.8, 0.55), step(0.5, noise(d.xy * 40.0)));
            c = mix(c, pc * (0.4 + 0.6 * shade), smoothstep(0.985, 0.9855, pl));
          }
          c += vec3(0.4, 0.3, 0.9) * pow(max(fbm(d.xz * 3.0 + 2.0) - 0.45, 0.0), 2.0) * 0.6; // nebula
        }
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(180, 40, 20), mat);
  dome.frustumCulled = false;
  dome.renderOrder = -10;
  return dome;
}

// ── portals: the green swirl, the same one as the rest of the site ──
// (the rim sits a little inside the disc so its haze has room)
const PORTAL_PAD = 1.22;
const portalMat = () =>
  new THREE.ShaderMaterial({
    transparent: true,
    premultipliedAlpha: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
    uniforms: { t: { value: 0 }, seed: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform float t, seed;
      varying vec2 vUv;
      ${SWIRL_GLSL}
      void main() {
        vec4 c = portal((vUv * 2.0 - 1.0) * ${PORTAL_PAD.toFixed(2)}, t, 1.0, seed);
        if (c.a < 0.004) discard;
        gl_FragColor = c;
      }`,
  });

// a disc on the ground that fills as a blast comes down
const zoneMat = () =>
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    uniforms: { k: { value: 0 }, col: { value: new THREE.Color(2.2, 0.5, 0.35) }, t: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform float k, t;
      uniform vec3 col;
      varying vec2 vUv;
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        if (r > 1.0) discard;
        float ring = smoothstep(0.86, 0.92, r) * smoothstep(1.0, 0.95, r);
        float fill = step(r, k) * (0.28 + 0.12 * sin(t * 18.0));
        float stripes = step(0.5, fract((p.x + p.y) * 4.0 + t * 2.0)) * 0.12 * step(r, 0.86);
        gl_FragColor = vec4(col, max(ring, fill) + stripes);
      }`,
  });

// sparks, smoke puffs, glints: points, each with its own life, size and colour
class Fx {
  constructor(n, tex, additive) {
    this.n = n;
    this.pos = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.col = new Float32Array(n * 3);
    this.size = new Float32Array(n);
    this.alpha = new Float32Array(n);
    this.life = new Float32Array(n);
    this.max = new Float32Array(n);
    this.s0 = new Float32Array(n);
    this.s1 = new Float32Array(n);
    this.grav = new Float32Array(n);
    this.next = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    this.mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      toneMapped: !additive,
      uniforms: { map: { value: tex }, scale: { value: 600 } },
      vertexShader: `
        uniform float scale;
        attribute float aSize; attribute float aAlpha;
        varying vec3 vCol; varying float vA;
        void main() {
          vCol = color; vA = aAlpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * scale / max(0.1, -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform sampler2D map;
        varying vec3 vCol; varying float vA;
        void main() {
          vec4 t = texture2D(map, gl_PointCoord);
          gl_FragColor = vec4(vCol * t.rgb, t.a * vA);
          if (gl_FragColor.a < 0.01) discard;
        }`,
      vertexColors: true,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
  }

  emit(x, y, z, vx, vy, vz, life, s0, s1, r, g, b, grav = 0) {
    const i = this.next;
    this.next = (i + 1) % this.n;
    this.pos.set([x, y, z], i * 3);
    this.vel.set([vx, vy, vz], i * 3);
    this.col.set([r, g, b], i * 3);
    this.life[i] = life;
    this.max[i] = life;
    this.s0[i] = s0;
    this.s1[i] = s1;
    this.grav[i] = grav;
  }

  update(dt) {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) {
        this.alpha[i] = 0;
        continue;
      }
      this.life[i] -= dt;
      const k = 1 - Math.max(0, this.life[i]) / this.max[i];
      this.vel[i * 3 + 1] -= this.grav[i] * dt;
      for (let a = 0; a < 3; a++) {
        this.pos[i * 3 + a] += this.vel[i * 3 + a] * dt;
        this.vel[i * 3 + a] *= 1 - Math.min(1, dt * 1.5);
      }
      this.size[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * k;
      this.alpha[i] = this.life[i] > 0 ? Math.min(1, (1 - k) * 2.2) : 0;
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.color.needsUpdate = true;
    g.attributes.aSize.needsUpdate = true;
    g.attributes.aAlpha.needsUpdate = true;
  }
}

export async function createPortal3D(canvas, { soft = false, hero: heroKind = 'rick', alive = () => true, onLost, onSlow, onProgress } = {}) {
  const stage = createStage(canvas, { soft, shadows: true, bloom: PANIC_LOOK.bloom, exposure: 1, fov: 40, near: 0.5, far: 400, onLost, onSlow });
  const { renderer, scene, camera } = stage;
  const big = !soft && Math.min(window.screen?.width ?? 1280, window.screen?.height ?? 800) >= 700;
  const progress = (k, label) => alive() && onProgress?.(k, label);
  progress(0.05, 'Opening a portal');

  const fx = new THREE.Group(); // glows and sprites
  const decals = new THREE.Group(); // marks on the ground
  scene.add(fx, decals);
  let sky = null;

  // light
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.position.set(-12, 26, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(big ? 2048 : 1024, big ? 2048 : 1024);
  Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 80 });
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.02;
  scene.add(hemi, sun, sun.target);
  // the house look (lib/three/house), as in the rest of C-137: the house tone
  // mapper over each dimension's exposure (set under ACES), the shade one
  // colour from its sky light; each dimension keeps its own fog
  const house = houseOn({ renderer, scene, sun, hemi, look: { fog: false } });
  let houseFrames = 0;

  // the models, all four dimensions' worth (they're small)
  const models = createModels({ base: '/games/kenney' });
  const loaded = {};
  let done = 0;
  await Promise.all(
    KENNEY.map((n) =>
      models.load(n).then((m) => {
        loaded[n] = m;
        done += 1;
        progress(0.08 + (done / KENNEY.length) * 0.5, 'Loading the dimensions');
      }),
    ),
  );
  // the cast and set pieces modelled for the site (./meshyCast.js)
  const meshy = createMeshyCast({ ink: soft ? 0 : CAST_INK }); // (the show's line round each; none in software mode)
  await meshy.load((k) => progress(0.58 + k * 0.2, 'Bringing in the cast'));
  // a figure: the modelled one where it loaded, the shapes otherwise
  const figure = (kind, variant = 0) => meshy.make(kind, variant) ?? makeCast(kind, variant);
  if (!alive()) {
    stage.dispose();
    return null;
  }
  // toon versions, one per (model, tint)
  const toonCache = new Map();
  // Kenney's foliage is mint; each dimension greens (or sickens) it to suit:
  // every green in a plant (its colours, and its palette texture's greens),
  // and anything named for a plant elsewhere (the grass on a rock)
  let leaf = null;
  const leafMaps = new Map(); // a palette with its greens changed, per leaf
  const toonModel = (name, tint = null, k = 0.6) => {
    const key = `${name}-${tint}-${k}-${leaf}`;
    if (toonCache.has(key)) return toonCache.get(key);
    const m = loaded[name];
    if (!m) return null;
    const plant = PLANTS.has(name);
    const parts = m.parts.map((p) => {
      const c = (p.material.color ?? new THREE.Color(1, 1, 1)).clone();
      let map = p.material.map ?? null;
      if (leaf != null && (plant || /leaf|grass|bush|plant/i.test(p.material.name ?? ''))) {
        releaf(c, leaf);
        if (map && plant) {
          const mk = `${map.uuid}-${leaf}`;
          if (!leafMaps.has(mk)) leafMaps.set(mk, releafMap(map, leaf));
          map = leafMaps.get(mk);
        }
      }
      if (tint != null) c.lerp(new THREE.Color(tint), k);
      const mat = toon(c, { map });
      mat.userData.shared = true;
      return { geometry: p.geometry, material: mat, base: p.base };
    });
    const out = { parts, size: m.size, name };
    toonCache.set(key, out);
    return out;
  };

  const T = (c, o) => canvasTexture(c, renderer, o);
  const glowTex = T(glowDot(64), { wrap: false });
  const puffTex = T(puff(64), { wrap: false });
  const glow = new Fx(soft ? 500 : 1100, glowTex, true);
  const smoke = new Fx(soft ? 160 : 320, puffTex, false);
  fx.add(glow.points, smoke.points);

  // ── a dimension's place ──
  let dimGroup = null;
  let dimOwn = [];
  let dimIndex = -1;
  let builtFor = null;
  const obstacleProps = [];

  const fitProp = (model, r) => {
    const w = Math.max(model.size.x, model.size.z, 0.01);
    return (r * 2.2) / w;
  };
  const place = (group, model, list, { shadow = true } = {}) => {
    if (!model || !list.length) return;
    const inst = models.instanced(model, list.length, { shadow, receive: true });
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    list.forEach((p, i) => {
      e.set(0, p.ry ?? 0, 0);
      q.setFromEuler(e);
      m.compose(new THREE.Vector3(p.x, p.y ?? 0, p.z), q, new THREE.Vector3(p.s, p.s, p.s));
      inst.setMatrixAt(i, m);
    });
    inst.commit();
    inst.addTo(group);
  };
  // a fleshy mound for Cronenberg World, eyes and all
  const fleshMound = (r) => {
    const g = new THREE.Group();
    const m1 = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 12), toon(0xd8848f));
    m1.scale.y = 0.75;
    m1.castShadow = m1.receiveShadow = true;
    g.add(m1);
    for (let i = 0; i < 3; i++) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(r * 0.18, 12, 8), toon(0xffffff));
      const a = i * 2.1;
      e.position.set(Math.cos(a) * r * 0.6, r * 0.55, Math.sin(a) * r * 0.6);
      const p = new THREE.Mesh(new THREE.SphereGeometry(r * 0.07, 8, 6), toon(0x111111));
      p.position.set(Math.cos(a) * r * 0.16, 0, Math.sin(a) * r * 0.16);
      e.add(p);
      g.add(e);
    }
    dimOwn.push(g);
    return g;
  };

  const buildDim = (g) => {
    if (dimGroup) {
      scene.remove(dimGroup);
      dimGroup.traverse((o) => {
        if (o.userData.shared || o.material?.userData?.shared) return;
        if (o.isMesh || o.isInstancedMesh) {
          if (!o.isInstancedMesh) o.geometry?.dispose();
          for (const m of [].concat(o.material)) {
            if (m?.userData?.shared) continue;
            for (const v of Object.values(m ?? {})) if (v?.isTexture) v.dispose();
            m?.dispose?.();
          }
        }
        if (o.isInstancedMesh) o.dispose();
      });
    }
    dimOwn = [];
    obstacleProps.length = 0;
    const d = PANIC.dims[g.dim];
    const L = LOOK[d.id];
    leaf = L.leaf ?? null;
    const group = new THREE.Group();
    const r = rng(g.seed * 13 + g.dim * 101 + 1);
    // sky, ground, the floor
    sky = buildSky(L);
    group.add(sky);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(d.id === 'citadel' ? 34 : 140, 64), toon(L.ground));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.03;
    ground.receiveShadow = true;
    group.add(ground);
    const floorTex = T(paintFloor(d.id, { size: big ? 1024 : 512, span: (R + 1.2) * 2, seed: 3 + g.dim }), { wrap: false });
    const floorMat = toon(0xffffff, { map: floorTex });
    if (d.id === 'citadel') {
      floorMat.emissiveMap = T(paintFloorGlow({ size: 512, span: (R + 1.2) * 2 }), { wrap: false });
      floorMat.emissive = new THREE.Color(0.7, 0.7, 0.7);
    }
    const floor = new THREE.Mesh(new THREE.CircleGeometry(R + 1.2, 96), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    group.add(floor);
    // the ring round the arena
    if (L.rim === 'fence' && toonModel('fence')) {
      const fm = toonModel('fence');
      const seg = Math.max(0.5, fm.size.x);
      const n = Math.ceil((2 * Math.PI * (R + 0.7)) / (seg * 1.5));
      const s = (2 * Math.PI * (R + 0.7)) / n / seg;
      const list = [];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        list.push({ x: Math.cos(a) * (R + 0.7), z: Math.sin(a) * (R + 0.7), ry: -a + Math.PI / 2, s });
      }
      place(group, fm, list, { shadow: false });
    } else if (L.rim === 'flesh') {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(R + 1.1, 0.75, 10, 96), toon(0xc8687e));
      ring.rotation.x = Math.PI / 2;
      ring.scale.z = 0.7;
      ring.receiveShadow = true;
      group.add(ring);
      const bumps = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8), toon(0xe08a98), 40);
      const m = new THREE.Matrix4();
      for (let i = 0; i < 40; i++) {
        const a = (i / 40) * Math.PI * 2 + r() * 0.1;
        const s = 0.35 + r() * 0.5;
        m.compose(new THREE.Vector3(Math.cos(a) * (R + 1.2), 0.35, Math.sin(a) * (R + 1.2)), new THREE.Quaternion(), new THREE.Vector3(s, s * 0.8, s));
        bumps.setMatrixAt(i, m);
      }
      group.add(bumps);
    } else if (L.rim === 'rocks') {
      const rm = toonModel('rock', 0xb05a30, 0.5);
      const list = [];
      for (let i = 0; i < 46; i++) {
        const a = (i / 46) * Math.PI * 2 + r() * 0.05;
        list.push({ x: Math.cos(a) * (R + 1.3), z: Math.sin(a) * (R + 1.3), ry: r() * 6.3, s: rm ? (1.2 + r() * 1.3) / Math.max(rm.size.x, 0.1) : 1 });
      }
      place(group, rm, list, { shadow: false });
    } else {
      const rail = new THREE.Mesh(new THREE.TorusGeometry(R + 0.7, 0.07, 6, 128), toon(0x9aa6ba));
      rail.rotation.x = Math.PI / 2;
      rail.position.y = 0.9;
      group.add(rail);
      const strip = new THREE.Mesh(new THREE.TorusGeometry(R + 0.7, 0.05, 6, 128), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 2.2, 2.6), toneMapped: false }));
      strip.rotation.x = Math.PI / 2;
      strip.position.y = 0.05;
      group.add(strip);
      const posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.06, 0.08, 0.9, 6), toon(0x6c7890), 48);
      const m = new THREE.Matrix4();
      for (let i = 0; i < 48; i++) {
        const a = (i / 48) * Math.PI * 2;
        m.makeTranslation(Math.cos(a) * (R + 0.7), 0.45, Math.sin(a) * (R + 0.7));
        posts.setMatrixAt(i, m);
      }
      group.add(posts);
    }
    // the backdrop
    const ring = (count, rMin, rMax, arc = [0, Math.PI * 2]) =>
      Array.from({ length: count }, () => {
        const a = arc[0] + r() * (arc[1] - arc[0]);
        const dist = rMin + r() * (rMax - rMin);
        return { x: Math.cos(a) * dist, z: Math.sin(a) * dist, ry: r() * 6.3, a };
      });
    const north = [Math.PI * 1.05, Math.PI * 1.95]; // behind the arena, as the camera sees it
    const tall = (m, h) => (m ? h / Math.max(m.size.y, 0.01) : 1);
    if (d.id === 'backyard') {
      ['house-a', 'house-c', 'house-f', 'house-k'].forEach((n, i) => {
        const m = toonModel(n);
        place(group, m, ring(2, 27, 38, north).map((p) => ({ ...p, ry: -p.a - Math.PI / 2 + (i % 2) * 0.2, s: tall(m, 7.5) })));
      });
      const tl = toonModel('tree-large');
      place(group, tl, ring(14, 19, 40).map((p) => ({ ...p, s: tall(tl, 6 + r() * 3) })));
      const ts = toonModel('tree-small');
      place(group, ts, ring(12, 18, 34).map((p) => ({ ...p, s: tall(ts, 3 + r() * 2) })));
      const fl = toonModel('flowers');
      place(group, fl, ring(40, R + 1.6, R + 5).map((p) => ({ ...p, s: tall(fl, 0.5 + r() * 0.4) })), { shadow: false });
      const bu = toonModel('bush');
      place(group, bu, ring(16, R + 2, R + 7).map((p) => ({ ...p, s: tall(bu, 1 + r()) })));
      // the Smiths' garage behind the fence, Rick's cruiser parked by it
      const garage = meshy.prop('garage', 5.2);
      if (garage) {
        garage.position.set(-7, 0, -(R + 7));
        garage.rotation.y = 0.25;
        group.add(garage);
      }
      const cruiser = meshy.prop('cruiser', 1.7);
      if (cruiser) {
        cruiser.position.set(3.5, 0, -(R + 5));
        cruiser.rotation.y = -0.5;
        group.add(cruiser);
      }
    } else if (d.id === 'cronenberg') {
      ['house-a', 'house-f'].forEach((n) => {
        const m = toonModel(n, 0x8a6a7a, 0.55);
        place(group, m, ring(3, 26, 40, north).map((p) => ({ ...p, ry: -p.a - Math.PI / 2, s: tall(m, 7) })));
      });
      const dt = toonModel('dead-tree', 0x5a3a4a, 0.4);
      place(group, dt, ring(18, 18, 40).map((p) => ({ ...p, s: tall(dt, 5 + r() * 4) })));
      const mu = toonModel('mushroom', 0x9a4ad0, 0.6);
      place(group, mu, ring(14, R + 2, 30).map((p) => ({ ...p, s: tall(mu, 1.5 + r() * 3.5) })));
      for (const p of ring(8, R + 4, 30)) {
        const f = fleshMound(1.2 + r() * 2);
        f.position.set(p.x, 0, p.z);
        group.add(f);
      }
    } else if (d.id === 'gazorpazorp') {
      const cl = toonModel('cliff', 0xb8582c, 0.55);
      place(group, cl, ring(9, 32, 46, north).map((p) => ({ ...p, s: tall(cl, 12 + r() * 10) })));
      const sp = toonModel('spire', 0xd0683a, 0.55);
      place(group, sp, ring(14, 20, 40).map((p) => ({ ...p, s: tall(sp, 6 + r() * 9) })));
      const cr = toonModel('crystal', 0xd060ff, 0.5);
      place(group, cr, ring(12, R + 2, 30).map((p) => ({ ...p, s: tall(cr, 1.5 + r() * 2.5) })));
      const ca = toonModel('cactus', 0x3abf9f, 0.6);
      place(group, ca, ring(12, R + 2, 30).map((p) => ({ ...p, s: tall(ca, 2 + r() * 2.5) })));
      const cz = toonModel('crater', 0xb05a30, 0.5);
      place(group, cz, ring(6, 20, 34).map((p) => ({ ...p, s: tall(cz, 0.8) * 1.2 })), { shadow: false });
    } else {
      const hg = toonModel('hangar', null);
      place(group, hg, ring(4, 24, 30, north).map((p) => ({ ...p, ry: -p.a - Math.PI / 2, s: tall(hg, 7) })));
      const di = toonModel('dish');
      place(group, di, ring(5, 20, 31).map((p) => ({ ...p, s: tall(di, 4 + r() * 3) })));
      const tu = toonModel('turret');
      place(group, tu, ring(6, R + 2.5, 28).map((p) => ({ ...p, s: tall(tu, 2 + r()) })));
      const co = toonModel('computer');
      place(group, co, ring(8, R + 2, 22).map((p) => ({ ...p, ry: -p.a + Math.PI / 2, s: tall(co, 1.4) })));
      const pi = toonModel('pillar');
      place(group, pi, ring(10, 22, 32).map((p) => ({ ...p, s: tall(pi, 8 + r() * 6) })));
    }
    // the obstacles in the arena
    for (const o of g.obstacles) {
      const spec = PROPS[d.id][o.kind] ?? (d.id === 'cronenberg' ? [null] : ['rock', 0x8a7a70, 0.3]);
      let obj;
      if (spec[0]) {
        const m = toonModel(spec[0], spec[1] ?? null, spec[2] ?? 0.6);
        if (!m) continue;
        obj = models.single(m, fitProp(m, o.r));
      } else obj = fleshMound(o.r);
      obj.position.set(o.x, 0, o.y);
      obj.rotation.y = r() * 6.3;
      group.add(obj);
      obstacleProps.push(obj);
    }
    // light and air
    hemi.color.set(L.hemi[0]);
    hemi.groundColor.set(L.hemi[1]);
    hemi.intensity = L.hemi[2];
    sun.color.set(L.sun[0]);
    sun.intensity = L.sun[1];
    scene.fog = new THREE.Fog(L.fog[0], L.fog[1], L.fog[2]);
    renderer.toneMappingExposure = L.exposure * house.exposure;
    house.adopt(group);
    house.follow();
    stage.grade?.(PLAIN);
    scene.add(group);
    dimGroup = group;
    dimIndex = g.dim;
    builtFor = g;
  };

  // ── the cast ──
  // A figure's body this frame: its yaw eased toward what it wants, and its
  // motion (body.js: speed along its facing, side across it, turn) from where
  // it was last frame, with a move (0…1, eased) for its clips' blend of idle,
  // walk and run; a step faster than TELEPORT is a jump (a portal, a new
  // dimension), not a walk. Kept on the figure (c.mo), dropped with it.
  const face = (c, want, dt, rate) => (c.yaw = c.yaw == null ? want : dt > 0 ? turn(c.yaw, want, dt, rate) : c.yaw);
  const body = (c, x, z, dt, full) => {
    const yaw = c.yaw ?? 0;
    const was = c.mo ?? (c.mo = { x, z, yaw, move: 0 });
    const jump = Math.hypot(x - was.x, z - was.z) > TELEPORT * Math.max(dt, 1 / 60);
    const motion = jump || !(dt > 0) ? { ...STILL } : bodyFrom(was, { x, z, yaw }, dt).motion;
    Object.assign(was, { x, z, yaw });
    was.move += (Math.min(1, Math.hypot(motion.speed, motion.side) / full) - was.move) * (1 - Math.exp(-dt * 10));
    return motion;
  };
  // (where it faces, for locomotion's hips and the head's look)
  const frame = { forward: new THREE.Vector3(), up: UP };
  const drive = (c, clock, dt, motion, squash = 0, down = 0) => {
    const y = c.yaw ?? 0;
    frame.forward.set(Math.sin(y), 0, Math.cos(y));
    animate(c, clock, c.mo?.move ?? 0, squash, { dt, motion, frame, down });
    // a model without a skeleton (Pickle Rick) goes over onto its back
    if (c.meshy && !c.anim) c.body.rotation.x = -1.45 * Math.min(1, down) ** 2;
  };
  // a figure back to how it stood, for its next turn in the pool
  const reset = (c) => {
    c.mo = null;
    c.yaw = null;
    c.aimT = c.punchT = c.hurtT = 0;
    c.fireAt = c.hitAt = c.tauntAt = -9;
    c.full = null;
    c.group.position.y = 0;
    c.stop?.(0, 'full');
    c.stop?.(0, 'upper');
    c.look?.(null);
  };
  // the gun up and a shot's kick (react.js's fire), no quicker than FIRE_EVERY
  const fire = (c, target = null) => {
    if (time - (c.fireAt ?? -9) < FIRE_EVERY) return;
    c.fireAt = time;
    c.react?.('fire', target ? { target } : {});
  };

  const castPool = new Map(); // kind → [cast]
  const take = (kind, variant = 0) => {
    const list = castPool.get(kind) ?? [];
    castPool.set(kind, list);
    let c = list.find((x) => !x.used && (kind !== 'mortyclone' || x.variant === variant % 6));
    if (!c) {
      c = figure(kind, variant);
      c.variant = variant % 6;
      if (!c.meshy) hull(c, 0.03);
      scene.add(c.group);
      list.push(c);
    }
    c.used = true;
    c.castKey = kind;
    c.group.visible = true;
    return c;
  };
  // the enemies' figures by id, the fallen kept a while (createRoster, above)
  const roster = createRoster({
    take: (kind, id) => take(ENEMY_CAST[kind], id),
    free: (c) => {
      reset(c);
      c.used = false;
      c.group.visible = false;
    },
  });
  // A killed enemy's fall, the way the shot that did it was going (from the
  // hero): the seconds it takes, or 0 for one that goes in a puff (a
  // Cronenberg, a blob, a model without a skeleton). Its gun lowered and its
  // head let go first, so nothing's left over the fall.
  const fallen = new Map(); // this frame's: id → its fall's seconds
  const fell = (c, e, p) => {
    if (NO_FALL.has(e.kind) || (c.meshy && !c.anim)) return 0;
    c.group.position.set(e.x, 0, e.y);
    c.mo = null;
    if (!c.anim) return c.legs ? CRUMPLE : 0;
    c.stop(0.15, 'upper');
    c.look(null);
    const r = c.react('down', { dir: { x: e.x - p.x, z: e.y - p.y }, yaw: c.yaw ?? 0, force: Math.random() < 0.3 ? 1 : 0.4 });
    c.fallClip = r?.clip ?? null;
    c.fallLen = r ? (FALL[r.clip] ?? 2.5) : 0;
    return c.fallLen;
  };
  // the nearest enemy (and the boss, unless `boss` is false) to a point
  const nearest = (g, x, y, boss = true) => {
    let best = boss && g.boss?.alive ? g.boss : null;
    let bd = best ? Math.hypot(best.x - x, best.y - y) : Infinity;
    for (const e of g.enemies) {
      if (!e.alive) continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < bd) [best, bd] = [e, d];
    }
    return best;
  };
  // the hero's moments: firing, taunting, hurt, down (a new game starts them over)
  const hero = { game: null, fireT: 0, tauntT: 0, hurtT: 0, down: false, downT: 0 };
  const heroAgain = () => {
    Object.assign(hero, { fireT: 0, tauntT: 0, hurtT: 0, down: false, downT: 0 });
    if (player) reset(player);
  };
  let player = null;
  let playerHero = null;
  const setHero = (h) => {
    if (playerHero === h && player) return;
    if (player) {
      scene.remove(player.group);
    }
    player = figure(h);
    heroAgain();
    if (!player.meshy) hull(player, 0.03);
    // a modelled hero holds the portal gun in the right hand
    if (player.hand) {
      player.group.updateMatrixWorld(true);
      const gun = portalGun();
      const k = 1 / player.hand.getWorldScale(new THREE.Vector3()).x;
      gun.scale.setScalar(k);
      gun.position.set(0, 0.06 * k, 0.04 * k);
      gun.rotation.set(Math.PI / 2, 0, 0);
      player.hand.add(gun);
      player.gun = gun;
    }
    scene.add(player.group);
    playerHero = h;
  };
  setHero(heroKind);
  let bossCast = null;
  let bossId = null;
  let bossFall = null; // the boss beaten: { c, t, len (its clip's), y (where it fell from) }
  // the Meeseeks from the box, each its own figure for as long as it's
  // there (by its object in g.allies, so one going doesn't hand its figure
  // to the next); a poofed one cheers a moment first
  const allyFig = new Map();
  const allySpare = [];
  const leaving = []; // { c, t, x, z }
  let allyN = 0;
  const spareAlly = (c) => {
    reset(c);
    c.group.visible = false;
    allySpare.push(c);
  };
  const robotPool = [];
  // everyone off: a new dimension, a new game
  const clearCast = () => {
    roster.clear();
    for (const c of allyFig.values()) spareAlly(c);
    allyFig.clear();
    for (const l of leaving.splice(0)) spareAlly(l.c);
    if (bossFall) scene.remove(bossFall.c.group);
    bossFall = null;
  };

  // ── shots, bolts, pickups ──
  const shotGeo = new THREE.CapsuleGeometry(0.11, 0.55, 4, 8);
  const shots = new THREE.InstancedMesh(shotGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(0.7, 3, 0.8), toneMapped: false }), 240);
  const bolts = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.1, 0.5), toneMapped: false }), 320);
  const seedGeo = new THREE.SphereGeometry(1, 12, 8);
  const seedMat = toon(0xe0a648);
  seedMat.emissive = new THREE.Color(0.5, 0.32, 0.08);
  const seeds = new THREE.InstancedMesh(seedGeo, seedMat, 200);
  const sauceMat = toon(0xd8342a);
  sauceMat.emissive = new THREE.Color(0.25, 0.04, 0.02);
  const sauces = new THREE.InstancedMesh(new THREE.BoxGeometry(0.42, 0.56, 0.12), sauceMat, 20);
  for (const m of [shots, bolts, seeds, sauces]) {
    m.frustumCulled = false;
    m.count = 0;
  }
  seeds.castShadow = true;
  fx.add(shots, bolts);
  scene.add(seeds, sauces);

  // ── portals, hazards, telegraphs ──
  const portalGeo = new THREE.CircleGeometry(1, 48);
  const portals = Array.from({ length: 10 }, (_, i) => {
    const m = new THREE.Mesh(portalGeo, portalMat());
    m.material.uniforms.seed.value = i * 1.7;
    m.visible = false;
    fx.add(m);
    return m;
  });
  const flashes = []; // short-lived portals: dashes, Evil Morty
  const zoneGeo = new THREE.CircleGeometry(1, 40);
  zoneGeo.rotateX(-Math.PI / 2);
  const zones = Array.from({ length: 14 }, () => {
    const m = new THREE.Mesh(zoneGeo, zoneMat());
    m.visible = false;
    decals.add(m);
    return m;
  });
  const beamGeo = new THREE.BoxGeometry(1, 1, 1);
  beamGeo.translate(0.5, 0, 0);
  const beams = Array.from({ length: 3 }, () => {
    const m = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 0.55, 1.25), transparent: true, opacity: 0.8, toneMapped: false, depthWrite: false }));
    m.visible = false;
    fx.add(m);
    return m;
  });
  const lineGeo = new THREE.PlaneGeometry(1, 1);
  lineGeo.rotateX(-Math.PI / 2);
  lineGeo.translate(0.5, 0, 0);
  const lineMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 0.4, 0.3), transparent: true, opacity: 0.5, toneMapped: false, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
  const lines = Array.from({ length: 8 }, () => {
    const m = new THREE.Mesh(lineGeo, lineMat);
    m.visible = false;
    decals.add(m);
    return m;
  });

  // ── the hero's mark: a ring of portal green round their feet, a chevron on
  // it where they aim, so they can be found in a crowd (and while they blink
  // after a hit, or are gone mid-dash) ──
  const markMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.42, 1.6, 0.5), transparent: true, opacity: 0.85, toneMapped: false, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4 });
  const ringGeo = new THREE.RingGeometry(0.66, 0.8, 48);
  ringGeo.rotateX(-Math.PI / 2);
  const chevron = new THREE.Shape();
  chevron.moveTo(-0.26, 0);
  chevron.lineTo(0, 0.36);
  chevron.lineTo(0.26, 0);
  chevron.lineTo(0, 0.12);
  chevron.closePath();
  const chevGeo = new THREE.ShapeGeometry(chevron);
  chevGeo.rotateX(Math.PI / 2); // pointing along +z, the way the hero faces
  chevGeo.translate(0, 0, 0.86);
  const mark = new THREE.Group();
  mark.add(new THREE.Mesh(ringGeo, markMat), new THREE.Mesh(chevGeo, markMat));
  decals.add(mark);

  // ── the camera ──
  const look = new THREE.Vector3();
  // the shake (lib/three/feel: trauma², none under reduced motion) at the
  // game's own numbers: its decay of 1.6 a second, 0.3 off at the most, no
  // roll; and hitstop on a boss down, which the loop takes through step()
  const feel = createFeel({ baseFov: 40, offset: 0.3 });
  feel.set({ decay: 1.6, roll: 0 });
  let time = 0;
  const tmp = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const mtx = new THREE.Matrix4();
  const up = new THREE.Vector3(0, 1, 0);
  const ray = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  const burst = (x, z, n, col, { speed = 5, life = 0.5, size = 0.5, y = 0.9, grav = 4 } = {}) => {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      glow.emit(x, y + Math.random() * 0.4, z, Math.cos(a) * s, Math.random() * s * 0.9, Math.sin(a) * s, life * (0.6 + Math.random() * 0.6), size, size * 0.2, col[0], col[1], col[2], grav);
    }
  };
  const smokeAt = (x, z, n, col, { size = 1.2, y = 0.8 } = {}) => {
    for (let i = 0; i < n; i++) smoke.emit(x + (Math.random() - 0.5) * 0.8, y + Math.random() * 0.6, z + (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 2, 1 + Math.random(), (Math.random() - 0.5) * 2, 0.55 + Math.random() * 0.3, size * 0.6, size * 1.4, col[0], col[1], col[2], -0.5);
  };

  // what this frame's events mean for the bodies, gathered as the sparks fly
  const heard = { kills: [], hits: new Set(), windups: new Set(), bolts: new Set(), punches: [], poofs: [], hurt: null, bossDown: null };
  const events = (g) => {
    heard.kills.length = heard.punches.length = heard.poofs.length = 0;
    heard.hits.clear();
    heard.windups.clear();
    heard.bolts.clear();
    heard.hurt = heard.bossDown = null;
    heard.shot = heard.bossHit = heard.bossBolt = heard.bossPhase = heard.cleared = heard.combo = heard.lost = heard.won = false;
    for (const e of g.events) {
      switch (e.type) {
        case 'kill':
          // (its puff once it's known whether it falls: the enemies, below)
          heard.kills.push(e);
          burst(e.x, e.y, 10, [2.2, 2.2, 1.6], { speed: 6 });
          break;
        case 'hit':
          if (e.boss) heard.bossHit = true;
          else heard.hits.add(e.id);
          burst(e.x, e.y, 4, [1.6, 2.6, 1.2], { speed: 4, life: 0.25, size: 0.35, y: 1 });
          break;
        case 'spark':
        case 'block':
          burst(e.x, e.y, 5, [2.6, 2.0, 1.0], { speed: 4, life: 0.25, size: 0.3, y: 1 });
          break;
        case 'shot':
          heard.shot = true;
          if (player?.gun) player.gunFlash = 0.08;
          break;
        case 'bolt':
          if (e.boss) heard.bossBolt = true;
          else if (e.id != null) heard.bolts.add(e.id);
          break;
        case 'windup':
          if (!e.boss) heard.windups.add(e.id);
          break;
        case 'dash':
          flashes.push({ x: e.x, y: e.y, t: 0, life: 0.45, s: 0.9 }, { x: e.tx, y: e.ty, t: 0, life: 0.45, s: 0.9 });
          burst(e.x, e.y, 14, [0.8, 2.6, 0.8], { speed: 5, life: 0.4 });
          break;
        case 'hurt':
          heard.hurt = e;
          feel.trauma(0.35);
          burst(e.x, e.y, 12, [2.8, 0.6, 0.4], { speed: 6, life: 0.35 });
          break;
        case 'cleared':
          heard.cleared = true;
          break;
        case 'combo':
          heard.combo = true;
          break;
        case 'lost':
          heard.lost = true;
          break;
        case 'won':
          heard.won = true;
          break;
        case 'bossPhase':
          heard.bossPhase = true;
          break;
        case 'slam':
          feel.trauma(0.6);
          smokeAt(e.x, e.y, 10, [0.85, 0.8, 0.75], { size: 2, y: 0.3 });
          break;
        case 'boom':
          burst(e.x, e.y, 18, [2.8, 1.3, 0.5], { speed: 7, life: 0.45, y: 0.4 });
          smokeAt(e.x, e.y, 5, [0.5, 0.45, 0.45], { size: 1.6, y: 0.3 });
          feel.trauma(0.15);
          break;
        case 'seed':
          burst(e.x, e.y, 6, [2.4, 1.8, 0.6], { speed: 3, life: 0.35, size: 0.3, y: 0.6, grav: -2 });
          break;
        case 'heal':
          if (g.p) burst(g.p.x, g.p.y, 16, [0.8, 2.6, 1.0], { speed: 3, life: 0.6, size: 0.4, y: 1, grav: -3 });
          break;
        case 'split':
          smokeAt(e.x, e.y, 6, [0.95, 0.6, 0.65], { size: 1.4 });
          break;
        case 'bossDown':
          heard.bossDown = e;
          feel.trauma(0.9);
          feel.hitstop(90);
          for (let i = 0; i < 4; i++) burst(e.x + (Math.random() - 0.5) * 3, e.y + (Math.random() - 0.5) * 3, 30, [2.8, 2.2, 1.0], { speed: 10, life: 0.8, size: 0.8, y: 1.5 });
          smokeAt(e.x, e.y, 16, [0.9, 0.9, 0.9], { size: 3, y: 1 });
          break;
        case 'punch':
          heard.punches.push(e);
          burst(e.x, e.y, 5, [1.5, 2.5, 2.8], { speed: 4, life: 0.25, size: 0.35, y: 1 });
          break;
        case 'poof':
          // (its puff once it's cheered: the allies, below)
          heard.poofs.push(e);
          break;
        default:
      }
    }
  };

  const render = (g, ms = 16, { calm = false } = {}) => {
    if (stage.lost || stage.disposed) return;
    const dt = Math.min(0.05, ms / 1000);
    time += dt;
    if (dimIndex !== g.dim || builtFor !== g) {
      clearCast();
      buildDim(g);
      // the new dimension's shaders (and the fog it brought) link in the
      // background; the stage holds its last frame until they have
      stage.precompile();
    }
    events(g);
    sky.material.uniforms.t.value = time;

    // the hero: facing the aim, eased (a new target's a quick turn, not a
    // snap; the mark at its feet shows the aim itself), its feet from the
    // ground it covers, so a strafe turns its hips toward where it's going
    // and a backpedal walks backward. The gun up while it fires, a flinch
    // when it's hurt, a cheer on a wave cleared, a chest-pounding taunt on a
    // combo, a dance when it's all won, a fall when it's lost; whatever's on
    // the whole body is cut the moment it moves, so it never skates.
    const p = g.p;
    const pc = player;
    if (hero.game !== g) {
      hero.game = g;
      heroAgain();
    }
    const aim = Math.atan2(p.aim.x, p.aim.y);
    const hy = hero.down ? (pc.yaw ?? aim) : face(pc, aim, dt, TURN.hero);
    pc.group.position.set(p.x, 0, p.y);
    pc.group.rotation.y = hy;
    const hm = body(pc, p.x, p.y, dt, 5);
    const going = Math.hypot(hm.speed, hm.side) > 0.6;
    hero.fireT -= dt;
    hero.tauntT -= dt;
    hero.hurtT = Math.max(0, hero.hurtT - dt);
    if (heard.lost && !hero.down) {
      // over the way the blow went: from whoever walked into the hero, else
      // the nearest thing that could have done it
      hero.down = true;
      const from = g.enemies.find((e) => e.id === heard.hurt?.id) ?? nearest(g, p.x, p.y);
      pc.stop?.(0.15, 'upper');
      pc.react?.('down', { dir: from ? { x: p.x - from.x, z: p.y - from.y } : { x: -Math.sin(hy), z: -Math.cos(hy) }, yaw: hy });
    } else if (!hero.down) {
      if (heard.hurt) {
        hero.hurtT = 0.3;
        pc.react?.('hit', { where: 'chest' });
      }
      if (heard.shot) {
        hero.fireT = FIRE_HOLD;
        if (hero.tauntT <= 0) fire(pc);
      } else if (hero.fireT <= 0 && hero.fireT + dt > 0 && hero.tauntT <= 0) pc.stop?.(0.25, 'upper');
      if (heard.combo) {
        hero.tauntT = 1.8;
        pc.play?.('taunt', { layer: 'upper', lasts: 1.8 });
      }
      if (heard.cleared) {
        pc.full = going ? null : 'cheer';
        pc.play?.('cheer', { layer: going ? 'upper' : 'full' });
      }
      if (heard.won) {
        pc.full = 'dance';
        pc.play?.('dance', { loop: true });
      }
      if (going && pc.full && pc.anim?.playing('full') === pc.full) {
        pc.full = null;
        pc.stop(0.15, 'full');
      }
    }
    if (hero.down) hero.downT += dt;
    const blink = !hero.down && p.inv > 0 && p.dashT <= 0 && Math.floor(time * 16) % 2 === 0;
    pc.group.visible = p.dashT <= 0 && !blink && g.status !== 'travel';
    hm.hurt = hero.hurtT / 0.3;
    drive(pc, time, dt, hm, 0, hero.down ? hero.downT / CRUMPLE : 0);
    mark.visible = g.status !== 'travel';
    mark.position.set(p.x, 0.025, p.y);
    mark.rotation.y = aim;
    mark.scale.setScalar(1 + Math.sin(time * 3) * 0.03);
    markMat.opacity = p.inv > 0 ? 0.45 + Math.abs(Math.sin(time * 14)) * 0.45 : 0.85;
    if (pc.gun?.userData.tip) {
      pc.gunFlash = Math.max(0, (pc.gunFlash ?? 0) - dt);
      pc.gun.userData.tip.scale.setScalar(0.05 * (1 + (pc.gunFlash > 0 ? 1.8 : 0)));
    }

    // the enemies, each on its own figure (the roster's). One killed falls
    // the way the shot that did it was going and lies a moment before it
    // sinks away; one that can't fall goes in a puff, as they always did.
    for (const e of heard.kills) {
      const c = roster.figure(e.id);
      const len = c ? fell(c, e, p) : 0;
      if (len > 0) fallen.set(e.id, len);
      else smokeAt(e.x, e.y, 6, PUFF_COL[e.kind] ?? [1, 1, 1]);
    }
    roster.sync(g.enemies, fallen);
    fallen.clear();
    for (const e of g.enemies) {
      if (!e.alive) continue;
      const c = roster.figure(e.id);
      if (!c) continue;
      // facing you, or where it charges (a Gazorpian, from its windup)
      const charging = e.state === 'charge' || e.state === 'windup';
      const yaw = face(c, charging ? Math.atan2(e.cx ?? 0, e.cy ?? 1) : Math.atan2(p.x - e.x, p.y - e.y), dt, charging ? TURN.charge : TURN.enemy);
      c.group.visible = true;
      c.group.position.set(e.x, 0, e.y);
      c.group.rotation.y = yaw;
      const m = body(c, e.x, e.y, dt, 3);
      const flash = e.flash / 0.12;
      m.hurt = flash;
      m.knock = e.id % 2 ? 0.5 : -0.5;
      // what happened to it: firing (the gun kept up a while, so a hit's
      // only a flinch then), hit, winding up (the punch on its top half,
      // its legs free for the charge)
      if (heard.bolts.has(e.id)) {
        fire(c, { x: p.x, z: p.y });
        c.aimT = AIM_HOLD;
      } else if (c.aimT > 0 && (c.aimT -= dt) <= 0) c.stop?.(0.3, 'upper');
      if (heard.hits.has(e.id) && !(c.aimT > 0)) c.react?.('hit', { where: Math.random() < 0.3 ? 'head' : 'chest' });
      if (heard.windups.has(e.id)) c.play?.('punch', { layer: 'upper', lasts: PANIC.enemies[e.kind].windup + PANIC.enemies[e.kind].chargeTime + 0.15 });
      const shake = e.state === 'windup' && !c.anim ? 0.5 + Math.sin(time * 40) * 0.3 : 0;
      drive(c, time + e.id, dt, m, Math.max(c.anim ? flash * 0.4 : flash, shake));
    }
    for (const d of roster.dying) {
      const c = d.c;
      const { x, z } = c.group.position;
      // a fall that never began (its clip wouldn't load): gone in a puff
      if (c.anim && d.t > 0.5 && d.left > SINK && c.anim.playing('full') !== c.fallClip) {
        smokeAt(x, z, 6, PUFF_COL[d.kind] ?? [1, 1, 1]);
        d.left = 0;
        continue;
      }
      const sink = d.left < SINK ? 1 - Math.max(0, d.left) / SINK : 0;
      if (sink > 0 && !d.dust) {
        d.dust = true;
        smokeAt(x, z, 4, PUFF_COL[d.kind] ?? [1, 1, 1], { size: 1, y: 0.2 });
      }
      c.group.position.y = -sink * SINK_DEPTH;
      // (lain still on its clip's last frame, there's nothing left to step)
      if (!c.anim || d.t < c.fallLen + 0.3) drive(c, time + d.id, dt, STILL, 0, d.t / CRUMPLE);
    }
    roster.step(dt);
    for (const list of castPool.values()) for (const c of list) if (!c.used) c.group.visible = false;

    // the boss: eased round to you (Snowball to where it charges), its feet
    // or its sway from the ground it covers, a flinch when it's hit. Evil
    // Morty fires, taunts you once he's hurt you (or you've angered him) and
    // flinches now and then. Beaten, it falls (a model without a skeleton
    // sinks, the Cromulon below the arena's edge) and stays down a while.
    const b = g.boss;
    if (!b && bossCast) {
      if (heard.bossDown) {
        const c = bossCast;
        const { x, z } = c.group.position;
        let len = 0;
        if (c.anim) {
          c.stop(0.15, 'upper');
          c.look(null);
          len = FALL[c.react('down', { dir: { x: x - p.x, z: z - p.y }, yaw: c.yaw ?? 0 })?.clip] ?? 0;
        }
        if (bossFall) scene.remove(bossFall.c.group);
        bossFall = { c, t: 0, len, y: c.group.position.y };
      } else scene.remove(bossCast.group);
      bossCast = null;
      bossId = null;
    }
    if (b && b.id !== bossId) {
      if (bossCast) scene.remove(bossCast.group);
      bossCast = figure(BOSS_CAST[b.id]);
      if (!bossCast.meshy) hull(bossCast, 0.04);
      scene.add(bossCast.group);
      bossId = b.id;
    }
    if (b && bossCast) {
      const c = bossCast;
      const air = b.id === 'cromulon' ? 2.2 + Math.sin(time * 0.8) * 0.3 : 0;
      const enter = b.state === 'enter' ? Math.min(1, b.st / 1.2) : 1;
      const charging = b.id === 'snowball' && (b.state === 'windup' || b.state === 'charge');
      const want = b.id === 'cromulon' ? 0 : charging ? Math.atan2(b.cx ?? 0, b.cy ?? 1) : Math.atan2(p.x - b.x, p.y - b.y);
      const yaw = face(c, want, dt, TURN[b.id] ?? 6);
      c.group.position.set(b.x, air - (1 - enter) * 3, b.y);
      c.group.rotation.y = yaw;
      c.group.visible = b.state !== 'vanish' || Math.floor(time * 20) % 2 === 0;
      const m = body(c, b.x, b.y, dt, 3);
      c.hurtT = Math.max(0, (c.hurtT ?? 0) - dt);
      if (heard.bossHit) c.hurtT = 0.2;
      m.hurt = (c.hurtT / 0.2) * 0.6;
      if (b.id === 'evilmorty') {
        if (heard.bossBolt) {
          fire(c, { x: p.x, z: p.y });
          c.aimT = 1.4;
        } else if (c.aimT > 0 && (c.aimT -= dt) <= 0) c.stop?.(0.3, 'upper');
        if (heard.hurt || heard.bossPhase) c.gloat = true;
        if (c.gloat && !(c.aimT > 0) && time - (c.tauntAt ?? -9) > 5) {
          c.gloat = false;
          c.tauntAt = time;
          c.play?.('taunt', { layer: 'upper', lasts: 2.2 });
        } else if (heard.bossHit && !(c.aimT > 0) && time - Math.max(c.hitAt ?? -9, c.tauntAt ?? -9) > 2.2) {
          c.hitAt = time;
          c.react?.('hit', { where: Math.random() < 0.3 ? 'head' : 'chest' });
        }
      }
      drive(c, time, dt, m, b.flash > 0 ? (c.anim ? 0.2 : 0.5) : b.state === 'windup' ? 0.4 : 0);
    }
    if (bossFall) {
      // on its clip it lies a while and then sinks; a model without a
      // skeleton tips back as it sinks; shapes crumple, then sink
      const f = bossFall;
      const c = f.c;
      f.t += dt;
      const lie = f.len > 0 ? f.len + 1.2 : c.meshy ? 0 : CRUMPLE + 0.6;
      const k = Math.min(1, Math.max(0, (f.t - lie) / (f.len > 0 || !c.meshy ? 0.8 : 2.2)));
      c.group.position.y = f.y - k * k * ((c.height ?? 2) * 1.15 + 0.5);
      drive(c, time, dt, STILL, 0, c.anim ? 0 : c.meshy ? Math.min(0.55, f.t / 2) : f.t / CRUMPLE);
      if (k >= 1) {
        scene.remove(c.group);
        bossFall = null;
      }
    }

    // the Meeseeks from the box ("I'm Mr. Meeseeks! Look at me!"): a wave as
    // it pops in, after the nearest enemy, stopped and punching once it's
    // there, and when its time's up a cheer, then gone in a puff
    for (const [a, c] of allyFig) {
      if (g.allies.includes(a)) continue;
      allyFig.delete(a);
      if (heard.poofs.some((q) => Math.hypot(q.x - a.x, q.y - a.y) < 0.75)) {
        c.stop?.(0.15, 'upper');
        c.play?.('cheer');
        leaving.push({ c, t: 0, x: a.x, z: a.y });
      } else spareAlly(c);
    }
    for (const [i, a] of g.allies.entries()) {
      let c = allyFig.get(a);
      if (!c) {
        c = allySpare.pop();
        if (!c) {
          c = figure('ally');
          c.off = allyN++ * 3;
          if (!c.meshy) hull(c, 0.025);
          scene.add(c.group);
        }
        allyFig.set(a, c);
        c.group.visible = true;
        c.play?.('wave', { layer: 'upper', lasts: 1.6 });
      }
      const foe = nearest(g, a.x, a.y, false);
      const yaw = face(c, foe ? Math.atan2(foe.x - a.x, foe.y - a.y) : (c.yaw ?? 0), dt, TURN.ally);
      c.group.position.set(a.x, 0, a.y);
      c.group.rotation.y = yaw;
      const m = body(c, a.x, a.y, dt, 3);
      if (heard.punches.some((q) => q.ally === i)) {
        c.punchT = 0.7;
        if (c.anim?.playing('upper') !== 'punch') c.play?.('punch', { layer: 'upper' });
      } else if (c.punchT > 0 && (c.punchT -= dt) <= 0) c.stop?.(0.25, 'upper');
      drive(c, time + (c.off ?? 0), dt, m);
    }
    for (let i = leaving.length - 1; i >= 0; i--) {
      const l = leaving[i];
      l.t += dt;
      drive(l.c, time + (l.c.off ?? 0), dt, STILL);
      if (l.t < (l.c.anim ? CHEER : 0)) continue;
      smokeAt(l.x, l.z, 6, [0.55, 0.85, 1.0], { size: 1.2 });
      spareAlly(l.c);
      leaving.splice(i, 1);
    }

    // butter robots
    const robots = butterRobots(g);
    robots.forEach((rb, i) => {
      if (!robotPool[i]) {
        robotPool[i] = makeCast('butter');
        scene.add(robotPool[i].group);
      }
      const c = robotPool[i];
      c.group.visible = g.status === 'play' || g.status === 'pick';
      c.group.position.set(rb.x, 0.6 + Math.sin(time * 4 + i) * 0.15, rb.y);
      c.group.rotation.y = -rb.a;
    });
    for (let i = robots.length; i < robotPool.length; i++) robotPool[i].group.visible = false;

    // shots and bolts
    let n = 0;
    for (const s of g.shots) {
      if (n >= 240) break;
      tmp.set(s.vx, 0, s.vy).normalize();
      q.setFromUnitVectors(up, tmp);
      mtx.compose(new THREE.Vector3(s.x, 1.05, s.y), q, new THREE.Vector3(1, 1, 1));
      shots.setMatrixAt(n++, mtx);
    }
    shots.count = n;
    shots.instanceMatrix.needsUpdate = true;
    n = 0;
    for (const o of g.bolts) {
      if (n >= 320) break;
      mtx.compose(new THREE.Vector3(o.x, 1, o.y), q.identity(), new THREE.Vector3(o.r, o.r, o.r));
      bolts.setMatrixAt(n++, mtx);
    }
    bolts.count = n;
    bolts.instanceMatrix.needsUpdate = true;
    // Mega Seeds spin and bob; Szechuan sauce too
    n = 0;
    let ns = 0;
    for (const s of g.pickups) {
      const bob = 0.45 + Math.sin(time * 4 + s.x) * 0.1;
      q.setFromAxisAngle(up, time * 3 + s.y);
      if (s.kind === 'seed' && n < 200) {
        mtx.compose(new THREE.Vector3(s.x, bob, s.y), q, new THREE.Vector3(0.16, 0.26, 0.16));
        seeds.setMatrixAt(n++, mtx);
        if (Math.random() < dt * 2) glow.emit(s.x, bob, s.y, 0, 0.6, 0, 0.5, 0.5, 0.1, 1.6, 1.2, 0.4);
      } else if (s.kind === 'sauce' && ns < 20) {
        mtx.compose(new THREE.Vector3(s.x, bob + 0.1, s.y), q, new THREE.Vector3(1, 1, 1));
        sauces.setMatrixAt(ns++, mtx);
      }
    }
    seeds.count = n;
    sauces.count = ns;
    seeds.instanceMatrix.needsUpdate = true;
    sauces.instanceMatrix.needsUpdate = true;

    // portals: opening, swirling, closing
    const yaw = Math.atan2(camera.position.x - look.x, camera.position.z - look.z);
    let pi = 0;
    const showPortal = (x, z, s, t) => {
      const m = portals[pi++];
      if (!m) return;
      m.visible = true;
      m.position.set(x, s * 1.3, z);
      m.rotation.set(-0.3, yaw, 0, 'YXZ');
      m.scale.set(s * PORTAL_PAD, s * 1.3 * PORTAL_PAD, s);
      m.material.uniforms.t.value = t;
      if (Math.random() < dt * 20) glow.emit(x + (Math.random() - 0.5) * s * 2, s * 1.3 + (Math.random() - 0.5) * s * 2, z, 0, 0, 0, 0.4, 0.4, 0.1, 0.8, 2.6, 0.8);
    };
    for (const pr of g.portals) {
      const open = Math.min(1, pr.t / Math.max(0.3, pr.open * 0.7));
      const close = pr.close != null ? Math.max(0, Math.min(1, (pr.close - pr.t) / 0.5)) : 1;
      showPortal(pr.x, pr.y, (pr.big ? 2.8 : 1.3) * open * close, time + pr.x);
    }
    if (g.boss?.state === 'vanish') showPortal(g.boss.tx, g.boss.ty, 1.3 * Math.min(1, g.boss.st / 0.4), time);
    for (const f of flashes) {
      f.t += dt;
      const k = Math.sin(Math.min(1, f.t / f.life) * Math.PI);
      showPortal(f.x, f.y, f.s * k, time);
    }
    for (let i = flashes.length - 1; i >= 0; i--) if (flashes[i].t >= flashes[i].life) flashes.splice(i, 1);
    if (g.status === 'travel') showPortal(p.x, p.y - 0.5, 2.2 * Math.min(1, (PANIC.travel - g.travelT) / 0.6), time);
    for (; pi < portals.length; pi++) portals[pi].visible = false;

    // hazards: blasts coming down, beams sweeping; a charge's line
    let zi = 0;
    let bi = 0;
    for (const h of g.hazards) {
      if (h.kind === 'zone' && !h.done && zi < zones.length) {
        const m = zones[zi++];
        m.visible = true;
        m.position.set(h.x, 0.03, h.y);
        m.scale.setScalar(h.r);
        m.material.uniforms.k.value = Math.min(1, h.t / h.fuse);
        m.material.uniforms.t.value = time;
      } else if (h.kind === 'beam' && bi < beams.length) {
        const m = beams[bi++];
        const on = h.t >= h.warn;
        const a = on ? h.a ?? h.a0 : h.a0;
        m.visible = true;
        m.position.set(h.x, on ? 1.2 : 0.05, h.y);
        m.rotation.set(0, -a, 0);
        m.scale.set(h.len, on ? 0.7 : 0.04, on ? h.w * 0.8 : 0.25);
        m.material.opacity = on ? 0.85 : 0.35 + 0.3 * Math.sin(time * 30);
        if (on && Math.random() < dt * 30) {
          const along = Math.random() * h.len * 0.6;
          glow.emit(h.x + Math.cos(a) * along, 1.2, h.y + Math.sin(a) * along, 0, 2, 0, 0.3, 0.6, 0.1, 2.6, 1.6, 2.4);
        }
      }
    }
    for (; zi < zones.length; zi++) zones[zi].visible = false;
    for (; bi < beams.length; bi++) beams[bi].visible = false;
    let li = 0;
    const windups = g.enemies.filter((e) => e.alive && e.state === 'windup');
    if (b?.state === 'windup') windups.push({ x: b.x, y: b.y, cx: b.cx, cy: b.cy, big: true });
    for (const w of windups) {
      if (li >= lines.length) break;
      const m = lines[li++];
      m.visible = true;
      m.position.set(w.x, 0.04, w.y);
      m.rotation.y = -Math.atan2(w.cy, w.cx);
      m.scale.set(w.big ? 12 : 8, 1, w.big ? 2.6 : 1.4);
    }
    for (; li < lines.length; li++) lines[li].visible = false;

    // the camera: over the hero's shoulder, the arena in view; back a
    // little for the Cromulon
    const aspect = stage.size.w / Math.max(1, stage.size.h);
    const portrait = aspect < 1 ? 1 : 0;
    // the Cromulon looms over the north edge: pull back and look up the arena
    const crom = g.boss?.id === 'cromulon';
    const far = crom ? 1.32 : 1;
    const tx = p.x * (crom ? 0.4 : 0.62);
    const tz = crom ? -6.5 + p.y * 0.35 : p.y * 0.62 + 0.5;
    const k = calm ? 1 : Math.min(1, dt * 4);
    look.x += (tx - look.x) * k;
    look.z += (tz - look.z) * k;
    look.y = 0;
    const dist = (portrait ? 1.45 : aspect < 1.4 ? 1.15 : 1) * far;
    camera.position.set(look.x, 17.5 * dist, look.z + 12.5 * dist);
    camera.lookAt(look.x, 0, look.z - 1.5);
    feel.update(dt, camera);
    sun.target.position.set(look.x, 0, look.z);
    sun.position.set(look.x - 12, 26, look.z + 10);
    sky.position.copy(camera.position);

    glow.mat.uniforms.scale.value = stage.size.h * 0.9;
    smoke.mat.uniforms.scale.value = stage.size.h * 0.9;
    glow.update(dt);
    smoke.update(dt);
    // (the cast as it comes, taken on now and then)
    house.follow({ adopt: houseFrames++ % 60 === 0 });
    stage.render(ms);
  };

  const resize = (w, h) => stage.resize(w, h);
  // the ground point under a screen position (for aiming with the mouse)
  const unproject = (sx, sy) => {
    const ndc = new THREE.Vector2((sx / stage.size.w) * 2 - 1, -(sy / stage.size.h) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = new THREE.Vector3();
    if (!ray.ray.intersectPlane(plane, hit)) return null;
    return { x: hit.x, y: hit.z };
  };
  const project = (x, y, z = 1.2) => {
    const v = new THREE.Vector3(x, z, y).project(camera);
    return { x: (v.x * 0.5 + 0.5) * stage.size.w, y: (-v.y * 0.5 + 0.5) * stage.size.h };
  };
  const dispose = () => {
    stage.dispose();
    models.dispose();
    meshy.dispose();
    for (const t of leafMaps.values()) t.dispose();
  };
  // the passes' shaders (bloom), linked before the game is shown; the
  // scene's wait for its first dimension (render, above)
  await stage.precompile(null);
  progress(1, 'Ready');
  return {
    render,
    resize,
    unproject,
    project,
    dispose,
    setHero,
    // the frame's dt as the game should take it (a boss down's hitstop): the loop steps by this
    step: (dt) => feel.step(dt),
    // behind ?debug: the stage's bloom, the shake's numbers, and what the game adds
    tune: (groups = []) => stage.tune([...feelGroups(feel), ...groups]),
    get lost() {
      return stage.lost;
    },
    get quality() {
      return stage.quality;
    },
    info: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, quality: stage.quality }),
  };
}

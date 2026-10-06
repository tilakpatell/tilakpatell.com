// The places on the universe map: the fandoms as planets, and (built by
// stations.js) the site's own pages as stations round the sun. The planets
// wear real planetary maps recoloured for their worlds
// (scripts/build-universe-textures.py makes them, from Solar System Scope's
// maps and ambientCG's materials), or are painted here (the Game Boy world in
// pixels, the Caribbean's islands); each has air round it in its colour and
// the things that make it that place, in orbit or on it: the sitar's strings,
// the One Ring, Cybertron's energon seams, the Infinity Stones, the crystals
// and element tiles, the mug, the portal, the travel routes. Star Wars isn't
// a planet but the way into a galaxy far, far away: the galaxy in miniature
// behind a hyperspace gate (galaxy/gateway.js), Star Destroyers on guard.
// The models (the site owner's, from Meshy: the sitar, Optimus Prime and
// Megatron, the gauntlet, the motorhome, the Game Boy, Mario and a Piranha
// Plant, a Republic attack cruiser; plus Rick's cruiser from the C-137 page
// and the Black Pearl) load after the map is up and are parked on orbits or
// stood on the ground (a model can take the painted sphere's place, `skin`);
// a planet whose model never arrives simply goes without. The sun is sun.js's.
//
// loadTextures({ small }) → the textures (any that fail are just missing)
// mapFile(name, level) → the file for a planet map at lib/detail's level
// buildPlanet(u, T) → { id, radius, group, update(t, camera), setState, mount }

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { cloneScene, loadGLTF } from '../../lib/three/gltfCache';
import { gltfLoader } from '../../lib/three/gltf';
import { loadTexture } from '../../lib/three/textures';
import { detailLevel } from '../../lib/detail';
import { SWIRL_GLSL } from '../rickmorty/swirl';
import { globeData } from '../travel/globe3d/data';
import { facing, fit, glowMat, orbit, paint, rng, rounded, tiled } from './kit';
import { STATIONS } from './stations';
import { buildGateway } from '../galaxy/gateway';
import { SIDES, cybertronSkin } from '../cybertron/skin';
import { createWar, warZones } from '../cybertron/war';

const LIGHT = new THREE.Vector3(-0.6, 0.62, 0.48).normalize(); // the scene's key light

// ── Textures ──

const BASE = '/textures/universe/';
const PLANET_MAPS = ['music', 'middleearth', 'transformers', 'marvel', 'breakingbad', 'office', 'rickmorty', 'earth', 'earth-clouds', 'earth-night', 'invincible', 'invincible-clouds', 'invincible-night', 'sun', 'sky'];
const FIXED = ['middleearth-glow', 'rickmorty-glow', 'invincible-glow'];
const DATA = ['plates-normal', 'plates-rough', 'hull-normal', 'hull-rough', 'paper-normal', 'transformers-normal-sm', 'transformers-glow-sm', 'middleearth-normal', 'breakingbad-normal', 'invincible-normal', 'earth-rough'];
const COLOUR = ['plates', 'hull'];

// The file for a planet map (or the sky) at a detail level (lib/detail):
// the half-size `-sm` copy on a phone or a weak device, the standard file on
// a desktop, and the `-hq` set (twice the texels: 2048 planets, a 4096
// Earth, an 8192 sky, scripts/build-universe-textures.py --hq) for a strong
// graphics card, so a planet filling the screen and the Milky Way behind it
// stay sharp instead of going soft as the camera comes in.
// Maps made by their own scripts (build-invincible-planet.mjs,
// build-cybertron-planet.mjs), with no `-hq` yet: a strong card gets the
// standard file straight away rather than asking for one that isn't there.
const NO_HQ = new Set(['invincible', 'invincible-clouds', 'invincible-night', 'transformers']);
export function mapFile(name, level = 'high') {
  const suffix = level === 'ultra' ? (NO_HQ.has(name) ? '' : '-hq') : level === 'high' ? '' : '-sm';
  return `${name}${suffix}.webp`;
}

export async function loadTextures({ small = false, level = small ? 'mid' : detailLevel() } = {}) {
  const T = { small }; // (and whether this is a phone, for the builders)
  const get = async (name, file, colour, fallback = null) => {
    try {
      // (decoded off the main thread, as sharp as the device's tier allows,
      // and shared with any other scene that wants the same map)
      T[name] = await loadTexture(BASE + file, { color: colour });
    } catch {
      // missing: the standard file where a sharper set was asked for, else whoever wanted it does without
      if (fallback) await get(name, fallback, colour);
    }
  };
  await Promise.all([
    ...PLANET_MAPS.map((n) => get(n, mapFile(n, level), !n.endsWith('-clouds'), level === 'ultra' ? mapFile(n, 'high') : null)),
    ...FIXED.map((n) => get(n, `${n}.webp`, true)),
    ...DATA.map((n) => get(n, `${n}.webp`, false)),
    ...COLOUR.map((n) => get(n, `${n}.webp`, true)),
  ]);
  return T;
}

// ── Shared pieces ──

// The air round a planet, in its colour, brightest on its sunlit side: a
// halo just outside its edge (the back of a slightly bigger sphere, fading
// out from the limb) and a glow on the surface's own rim (added to the
// planet's material, below), so it's one extra draw a planet as before.
const HALO = 1.2; // the halo's reach, as a share of the planet's radius
const HALO_VERT = `
uniform vec3 uLight;
varying vec3 vN;
varying vec3 vV;
varying vec3 vL;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  vL = normalize((viewMatrix * vec4(uLight, 0.0)).xyz);
  gl_Position = projectionMatrix * mv;
}`;
const HALO_FRAG = `
uniform vec3 uColor;
uniform float uStrength;
uniform float uReach;
varying vec3 vN;
varying vec3 vV;
varying vec3 vL;
void main() {
  vec3 n = normalize(vN);
  // how far out from the planet's edge this ray passes, 0 at the edge and 1
  // at the halo's, so the air thins out evenly rather than ending in a rim
  float c = -dot(n, normalize(vV));
  float x = clamp((sqrt(max(1.0 - c * c, 0.0)) * uReach - 1.0) / (uReach - 1.0), 0.0, 1.0);
  float lit = 0.12 + 0.88 * smoothstep(-0.45, 0.5, dot(n, vL));
  gl_FragColor = vec4(uColor * pow(1.0 - x, 3.0) * uStrength * lit, 1.0);
  #include <colorspace_fragment>
}`;

const RIM = { idle: 0.5, hover: 1.3, selected: 0.95 };

function halo(radius, color, seg) {
  const mat = new THREE.ShaderMaterial({
    vertexShader: HALO_VERT,
    fragmentShader: HALO_FRAG,
    uniforms: { uColor: { value: new THREE.Color(color) }, uStrength: { value: RIM.idle }, uLight: { value: LIGHT }, uReach: { value: HALO } },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.BackSide,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius * HALO, seg[0], seg[1]), mat);
  mesh.renderOrder = 2;
  return mesh;
}

// The glow on a planet's own rim, in its material, and (for Earth) its
// cities' lights on the night side: both follow the sun.
function airGlow(mat, color, { night = null } = {}) {
  const u = {
    uRimColor: { value: new THREE.Color(color) },
    uRimStrength: { value: RIM.idle * 0.8 },
    uSunW: { value: LIGHT },
    uNight: { value: night },
  };
  mat.userData.air = u;
  // (after any hook the planet's builder gave it, such as Cybertron's skin)
  const prev = mat.onBeforeCompile;
  const prevKey = mat.customProgramCacheKey;
  mat.onBeforeCompile = (shader, renderer) => {
    prev?.call(mat, shader, renderer);
    Object.assign(shader.uniforms, u);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform vec3 uRimColor;\nuniform float uRimStrength;\nuniform vec3 uSunW;\nuniform sampler2D uNight;`)
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          vec3 sunV = normalize((viewMatrix * vec4(uSunW, 0.0)).xyz);
          float day = dot(normal, sunV);
          float rim = pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 3.0);
          totalEmissiveRadiance += uRimColor * rim * uRimStrength * (0.2 + 0.8 * smoothstep(-0.3, 0.6, day));
          ${night ? 'totalEmissiveRadiance += texture2D(uNight, vMapUv).rgb * 1.5 * smoothstep(0.12, -0.3, day);' : ''}
        }`,
      );
  };
  mat.customProgramCacheKey = () => `${night ? 'air-night' : 'air'}${prevKey ? `-${prevKey.call(mat)}` : ''}`;
  return mat;
}

// A station's big sign: its name in its colour and a line under it, on a
// dark glass panel with a lit edge, always facing you. A click on it opens
// the page (the scene does the picking).
function bigSign(u) {
  const [title, line] = u.sign;
  const W2 = 768;
  const H2 = 216;
  const tex = paint(
    (g, w, h) => {
      g.clearRect(0, 0, w, h);
      rounded(g, 14, 14, w - 28, h - 28, 26);
      g.fillStyle = 'rgba(6, 10, 20, 0.84)';
      g.fill();
      g.shadowColor = u.swatch;
      g.shadowBlur = 22;
      g.lineWidth = 5;
      g.strokeStyle = u.swatch;
      g.stroke();
      g.shadowBlur = 0;
      rounded(g, 26, 26, w - 52, h - 52, 18);
      g.lineWidth = 1.5;
      g.strokeStyle = 'rgba(255,255,255,0.18)';
      g.stroke();
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = u.swatch;
      g.shadowColor = u.swatch;
      g.shadowBlur = 18;
      g.font = '800 92px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';
      if ('letterSpacing' in g) g.letterSpacing = '6px';
      g.fillText(title, w / 2, h * 0.43);
      g.shadowBlur = 0;
      if ('letterSpacing' in g) g.letterSpacing = '0px';
      g.fillStyle = 'rgba(255,255,255,0.86)';
      g.font = '500 30px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';
      g.fillText(`${line}  →`, w / 2, h * 0.76);
    },
    W2,
    H2,
  );
  const w = u.size * 2.9;
  const h = (w * H2) / W2;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, depthWrite: false, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  mesh.position.y = u.size * 1.45 + h / 2;
  mesh.renderOrder = 5;
  mesh.userData.size = [w, h];
  return mesh;
}

// ── The fandoms ──

const BUILDERS = {
  starwars(p, { u, T }) {
    const r = u.size;
    // not a planet: the way into a galaxy far, far away (galaxy/gateway.js),
    // the galaxy itself in miniature behind a hyperspace gate; the painted
    // sphere stays, unseen, for what a place needs one for
    p.body.material.visible = false;
    const gate = buildGateway(r, { small: T.small });
    p.group.add(gate.group);
    p.tick.push((t, camera) => gate.update(t, camera));

    // a Republic attack cruiser further out (the site owner's Meshy model,
    // when it comes; its nose is −x, so a quarter turn points it the way the
    // orbit goes). Slave I is about too, as traffic (traffic.js)
    const far = orbit(p.group, { radius: r * 1.38, tilt: 0.12, yaw: 0.8, speed: 0.14, phase: 4.1 });
    p.orbits.push(far);
    // and two Star Destroyers on station round it (the site owner's model;
    // its nose is −z, the way an orbit's holder travels)
    const guard = [orbit(p.group, { radius: r * 1.3, tilt: -0.1, yaw: 2.4, speed: 0.1, phase: 0.6 }), orbit(p.group, { radius: r * 1.34, tilt: 0.2, yaw: 4.0, speed: 0.09, phase: 3.3 })];
    p.orbits.push(...guard);
    p.slots = {
      cruiser: { holder: far.holder, size: r * 0.14, turn: [0, -Math.PI / 2, -0.1], sway: 0.08 },
      escort1: { holder: guard[0].holder, size: r * 0.26, turn: [0, 0, 0.05], sway: 0.04 },
      escort2: { holder: guard[1].holder, size: r * 0.24, turn: [0, 0, -0.06], sway: 0.04 },
    };
  },

  music(p, { u, T }) {
    const r = u.size;
    p.body.material = new THREE.MeshStandardMaterial({ map: T.music ?? null, color: T.music ? '#ffffff' : u.palette.base, roughness: 1 });
    // the rings are a sitar's strings: thin brass lines, plucked when it's
    // picked, over a banded disc of saffron and brass dust (its texture runs
    // out from the planet: the ring geometry's own uvs are remapped to radius)
    const strings = new THREE.Group();
    strings.rotation.set(Math.PI / 2 - 0.42, 0, 0.22);
    p.group.add(strings);
    const IN = r * 1.28;
    const OUT = r * 1.95;
    const bands = paint(
      (g, w, h) => {
        const ring = rng('music-ring');
        g.clearRect(0, 0, w, h);
        for (let x = 0; x < w; x++) {
          const k = x / w;
          // dense in the middle, thin toward the edges, with gaps
          const body = Math.sin(k * Math.PI) ** 0.6 * (0.55 + 0.45 * Math.sin(k * 41 + Math.sin(k * 13) * 2)) * (k > 0.62 && k < 0.66 ? 0.1 : 1);
          const a = Math.max(0, Math.min(1, body * (0.7 + ring() * 0.3)));
          const tone = 150 + Math.sin(k * 23) * 50 + ring() * 30;
          g.fillStyle = `rgba(${Math.min(255, tone + 70)}, ${tone * 0.72}, ${tone * 0.32}, ${a.toFixed(3)})`;
          g.fillRect(x, 0, 1, h);
        }
      },
      512,
      4,
    );
    const disc = new THREE.RingGeometry(IN, OUT, 128, 1);
    const pos = disc.attributes.position;
    const uv = disc.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, (Math.hypot(pos.getX(i), pos.getY(i)) - IN) / (OUT - IN), 0.5);
    const ringDisc = new THREE.Mesh(disc, new THREE.MeshStandardMaterial({ map: bands, transparent: true, depthWrite: false, side: THREE.DoubleSide, roughness: 0.8, metalness: 0.2, emissive: '#3a2008', emissiveIntensity: 0.4 }));
    strings.add(ringDisc);
    const brass = new THREE.MeshStandardMaterial({ color: '#e9c27c', metalness: 0.8, roughness: 0.35, emissive: '#6b4a14', emissiveIntensity: 0.6 });
    const lines = [];
    for (let i = 0; i < 6; i++) {
      const line = new THREE.Mesh(new THREE.TorusGeometry(r * (1.36 + i * 0.105), r * (0.005 + (i === 0 ? 0.003 : 0)), 5, 200), brass);
      strings.add(line);
      lines.push(line);
    }
    let pluckAt = -1;
    p.onSelect = (t) => (pluckAt = t);
    p.tick.push((t) => {
      const age = pluckAt < 0 ? 99 : t - pluckAt;
      lines.forEach((line, i) => {
        const a = age < 3 ? 0.06 * Math.exp(-age * 2.2) * Math.sin(age * 28 + i * 1.3) : 0;
        line.rotation.x = a;
        line.rotation.y = a * 0.6;
      });
    });
    const o = orbit(p.group, { radius: r * 1.2, tilt: -0.55, speed: 0.2, phase: 0.6 });
    p.orbits.push(o);
    p.slot = { holder: o.holder, size: r * 0.78, turn: [0, Math.PI / 2, 0.35] };
  },

  middleearth(p, { u, T }) {
    const r = u.size;
    p.body.material = new THREE.MeshStandardMaterial({
      map: T.middleearth ?? null,
      color: T.middleearth ? '#ffffff' : u.palette.base,
      normalMap: T['middleearth-normal'] ?? null,
      normalScale: new THREE.Vector2(1.1, 1.1),
      emissive: '#ffffff',
      emissiveMap: T['middleearth-glow'] ?? null,
      emissiveIntensity: T['middleearth-glow'] ? 1.4 : 0,
      roughness: 0.95,
    });
    // the One Ring, its inscription lit
    const rand = rng('ring');
    const words = paint(
      (g, w, h) => {
        g.fillStyle = '#000';
        g.fillRect(0, 0, w, h);
        g.strokeStyle = '#ffd9a0';
        g.lineWidth = 1.4;
        g.lineCap = 'round';
        for (const y0 of [h * 0.1, h * 0.9]) {
          for (let x = 4; x < w - 6; x += 7) {
            g.beginPath();
            g.moveTo(x, y0 + 3);
            g.quadraticCurveTo(x + 2 + rand() * 3, y0 - 4 - rand() * 2, x + 5, y0 + (rand() - 0.5) * 3);
            if (rand() < 0.4) g.arc(x + 3, y0 + 2, 1.6, 0, Math.PI * 2);
            g.stroke();
          }
        }
      },
      512,
      32,
    );
    const ringMat = new THREE.MeshStandardMaterial({ color: '#e0a83a', metalness: 1, roughness: 0.22, emissive: '#ff6a12', emissiveMap: words, emissiveIntensity: 0.9 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 0.26, r * 0.06, 20, 72), ringMat);
    const o = orbit(p.group, { radius: r * 1.55, tilt: 0.42, speed: 0.22, phase: 4 });
    o.holder.add(ring);
    p.orbits.push(o);
    p.tick.push((t) => {
      ring.rotation.set(0.9 + Math.sin(t * 0.5) * 0.3, t * 0.6, 0.3);
      ringMat.emissiveIntensity = 0.75 + 0.35 * Math.sin(t * 1.7) ** 2;
    });
  },

  transformers(p, { u, T }) {
    const r = u.size;
    // built over from pole to pole (scripts/build-cybertron-planet.mjs):
    // tiers of plating, chasms with energon running in them, the city-states'
    // discs, the Sea of Rust, the war's fires; cybertron/skin.js colours the
    // energon, lights the cities on the night side and carries the plating
    // on in the shader up close, where the maps run out
    const mat = new THREE.MeshStandardMaterial({
      map: T.transformers ?? null,
      color: T.transformers ? '#ffffff' : u.palette.base,
      normalMap: T['transformers-normal-sm'] ?? null,
      normalScale: new THREE.Vector2(1.1, 1.1),
      roughness: 0.55,
      metalness: 0.45,
    });
    p.body.material = mat;
    if (T.transformers && T['transformers-glow-sm']) {
      const skin = cybertronSkin(mat, { glow: T['transformers-glow-sm'], sun: LIGHT });
      // the energon breathes, and turns from the Autobots' blue to the
      // Decepticons' violet and back as the war goes one way and the other
      const blue = SIDES.autobot.energon;
      const violet = SIDES.decepticon.energon;
      p.tick.push((t) => {
        skin.uTime.value = t;
        skin.uEnergon.value.copy(blue).lerp(violet, 0.5 + 0.5 * Math.sin(t * 0.05));
      });
      // and the war, a few fireballs at a time out of the burning fronts
      // (cybertron/war.js: one draw, turning with the planet)
      const battle = createWar({ radius: r, zones: warZones(T['transformers-glow-sm']), count: T.small ? 3 : 5, flares: 1, small: true, light: false });
      p.body.add(battle.group);
      p.tick.push((t, camera) => battle.update(t, camera, 0.85));
    }
    // Optimus Prime and Megatron on one orbit, a little apart, facing off as
    // they go round
    const R = r * 1.55;
    const o = orbit(p.group, { radius: R, tilt: 0.3, speed: 0.12, phase: 1.2 });
    p.orbits.push(o);
    const apart = 0.55; // radians between them on the orbit
    const rival = new THREE.Group();
    rival.position.set(Math.cos(apart) * R, 0, -Math.sin(apart) * R);
    o.pivot.add(rival);
    // each turned to look at the other (a model's face is its +z)
    const dx = rival.position.x - R;
    const dz = rival.position.z;
    p.slot = { holder: o.holder, size: r * 0.55, turn: [0, Math.atan2(dx, dz), 0], sway: 0.12 };
    p.slots = { rival: { holder: rival, size: r * 0.58, turn: [0, Math.atan2(-dx, -dz), 0], sway: 0.12 } };
  },

  marvel(p, { u, T }) {
    const r = u.size;
    p.body.material = new THREE.MeshStandardMaterial({ map: T.marvel ?? null, color: T.marvel ? '#ffffff' : u.palette.base, roughness: 1 });
    // the six Stones, as small glowing moons in a ring
    const STONES = ['#3d7bff', '#ffd23d', '#ff3d3d', '#a34dff', '#3dff8a', '#ff8a3d'];
    const stones = new THREE.InstancedMesh(new THREE.OctahedronGeometry(r * 0.085, 0), new THREE.MeshBasicMaterial({ toneMapped: false }), 6);
    const c = new THREE.Color();
    STONES.forEach((hex, i) => stones.setColorAt(i, c.set(hex)));
    const ring = new THREE.Group();
    ring.rotation.set(0.3, 0, -0.18);
    ring.add(stones);
    p.group.add(ring);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const s = new THREE.Vector3(1, 1.35, 1);
    const at = new THREE.Vector3();
    p.tick.push((t) => {
      for (let i = 0; i < 6; i++) {
        const a = t * 0.3 + (i / 6) * Math.PI * 2;
        at.set(Math.cos(a) * r * 1.3, 0, Math.sin(a) * r * 1.3);
        q.setFromEuler(e.set(t * 0.8 + i, t * 0.5, 0));
        stones.setMatrixAt(i, m.compose(at, q, s));
      }
      stones.instanceMatrix.needsUpdate = true;
    });
    const o = orbit(p.group, { radius: r * 1.55, tilt: -0.4, speed: 0.16, phase: 3 });
    p.orbits.push(o);
    p.slot = { holder: o.holder, size: r * 0.62, turn: [0, Math.PI / 2, 0] };
  },

  breakingbad(p, { u, T }) {
    const r = u.size;
    p.body.material = new THREE.MeshStandardMaterial({
      map: T.breakingbad ?? null,
      color: T.breakingbad ? '#ffffff' : u.palette.base,
      normalMap: T['breakingbad-normal'] ?? null,
      normalScale: new THREE.Vector2(1.2, 1.2),
      roughness: 1,
    });
    // blue crystal moons
    const crystals = new THREE.InstancedMesh(
      new THREE.OctahedronGeometry(r * 0.07, 0),
      new THREE.MeshStandardMaterial({ color: '#8fe0ff', emissive: '#1b6f9e', emissiveIntensity: 0.9, metalness: 0.1, roughness: 0.15, flatShading: true }),
      5,
    );
    const belt = new THREE.Group();
    belt.rotation.set(0.5, 0, 0.1);
    belt.add(crystals);
    p.group.add(belt);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const at = new THREE.Vector3();
    const sz = [1, 0.8, 1.2, 0.7, 1].map((k) => new THREE.Vector3(k, k * 1.9, k));
    p.tick.push((t) => {
      for (let i = 0; i < 5; i++) {
        const a = t * 0.26 + (i / 5) * Math.PI * 2 + (i % 2) * 0.3;
        at.set(Math.cos(a) * r * 1.32, (i % 2 ? 1 : -1) * r * 0.06, Math.sin(a) * r * 1.32);
        q.setFromEuler(e.set(0.4, t * 0.7 + i, 0.3));
        crystals.setMatrixAt(i, m.compose(at, q, sz[i]));
      }
      crystals.instanceMatrix.needsUpdate = true;
    });
    // element tiles, as the show's titles have them
    const tiles = new THREE.Group();
    tiles.rotation.set(-0.22, 0, 0.12);
    p.group.add(tiles);
    [
      ['Br', 35],
      ['Ba', 56],
      ['C', 6],
      ['N', 7],
    ].forEach(([sym, n], i) => {
      const tex = paint(
        (g, w, h) => {
          const grad = g.createLinearGradient(0, 0, w, h);
          grad.addColorStop(0, '#2a7a44');
          grad.addColorStop(1, '#13492a');
          g.fillStyle = grad;
          g.fillRect(0, 0, w, h);
          g.strokeStyle = '#8fd07a';
          g.lineWidth = 6;
          g.strokeRect(5, 5, w - 10, h - 10);
          g.fillStyle = '#ffffff';
          g.font = '600 22px ui-monospace, Menlo, monospace';
          g.fillText(String(n), 16, 34);
          g.font = '700 64px ui-sans-serif, system-ui, sans-serif';
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.fillText(sym, w / 2, h / 2 + 10);
        },
        128,
        128,
      );
      const tile = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex }));
      tile.scale.setScalar(r * 0.22);
      tile.userData.a = (i / 4) * Math.PI * 2;
      tiles.add(tile);
    });
    p.tick.push((t) => {
      for (const tile of tiles.children) {
        const a = tile.userData.a - t * 0.14;
        tile.position.set(Math.cos(a) * r * 1.68, 0, Math.sin(a) * r * 1.68);
      }
    });
    const o = orbit(p.group, { radius: r * 1.5, tilt: 1.0, speed: 0.2, phase: 0.4 });
    p.orbits.push(o);
    p.slot = { holder: o.holder, size: r * 0.6, turn: [0, Math.PI / 2, 0] };
  },

  office(p, { u, T }) {
    const r = u.size;
    p.body.material = new THREE.MeshStandardMaterial({
      map: T.office ?? null,
      color: T.office ? '#ebe6da' : u.palette.base, // paper, not snow: a little warm and a little grey
      normalMap: tiled(T['paper-normal'], 4, 2),
      normalScale: new THREE.Vector2(1.1, 1.1),
      roughness: 0.95,
    });
    // the mug
    const label = paint(
      (g, w, h) => {
        g.fillStyle = '#ffffff';
        g.fillRect(0, 0, w, h);
        g.fillStyle = '#111111';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.font = '800 15px ui-sans-serif, system-ui, sans-serif';
        g.fillText("WORLD'S BEST", w * 0.25, h * 0.38);
        g.fillText('BOSS', w * 0.25, h * 0.66);
      },
      256,
      64,
    );
    const white = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3 });
    const mug = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.12, r * 0.105, r * 0.26, 32, 1), [
      new THREE.MeshStandardMaterial({ map: label, roughness: 0.3 }),
      new THREE.MeshStandardMaterial({ color: '#4a2b18', roughness: 0.2 }),
      white,
    ]);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(r * 0.07, r * 0.02, 10, 20, Math.PI), white);
    handle.position.x = -r * 0.115;
    handle.rotation.z = Math.PI / 2;
    mug.add(body, handle);
    const o = orbit(p.group, { radius: r * 1.5, tilt: 0.32, speed: 0.28, phase: 5 });
    o.holder.add(mug);
    p.orbits.push(o);
    p.tick.push((t) => mug.rotation.set(0.25 + Math.sin(t * 0.6) * 0.2, t * 0.5, 0.15));
  },

  rickmorty(p, { u, T }) {
    const r = u.size;
    p.body.material = new THREE.MeshStandardMaterial({
      map: T.rickmorty ?? null,
      color: T.rickmorty ? '#ffffff' : u.palette.base,
      emissive: '#ffffff',
      emissiveMap: T['rickmorty-glow'] ?? null,
      emissiveIntensity: T['rickmorty-glow'] ? 1 : 0,
      roughness: 1,
    });
    // a portal hangs on the cruiser's orbit, so it flies through it
    const o = orbit(p.group, { radius: r * 1.55, tilt: 0.36, speed: 0.24, phase: 1 });
    const portalMat = new THREE.ShaderMaterial({
      transparent: true,
      premultipliedAlpha: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: { t: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `
        uniform float t;
        varying vec2 vUv;
        ${SWIRL_GLSL}
        void main() {
          vec4 c = portal((vUv * 2.0 - 1.0) * 1.22, t, 1.0, 3.0);
          if (c.a < 0.004) discard;
          gl_FragColor = c;
        }`,
    });
    const portal = new THREE.Mesh(new THREE.PlaneGeometry(r * 0.8, r * 0.8), portalMat);
    portal.position.set(Math.cos(2.4) * r * 1.55, 0, -Math.sin(2.4) * r * 1.55);
    portal.renderOrder = 3;
    o.plane.add(portal);
    const q = new THREE.Quaternion();
    p.tick.push((t, camera) => {
      portalMat.uniforms.t.value = t;
      if (!camera) return;
      // always face the camera: undo the turns above it, then take the camera's
      portal.parent.getWorldQuaternion(q);
      portal.quaternion.copy(q.invert()).multiply(camera.quaternion);
    });
    p.orbits.push(o);
    p.slot = { holder: o.holder, size: r * 0.58, turn: [0.15, Math.PI, 0] }; // its nose (the headlights) is +z: turned along the orbit
  },

  gaming(p, { u }) {
    const r = u.size;
    const P = u.palette;
    const rand = rng('gaming');
    // A Game Boy world, in its four greens: pixel-art continents on a dark
    // sea, drawn small and shown with no smoothing so every pixel is crisp,
    // with pixel clouds drifting over it and blocky mountains standing up
    // off the land where it's highest.
    const W = 256;
    const H = 128;
    // wrapped value noise over the map, a few octaves
    const grid = (n) => Array.from({ length: n * (n / 2 + 1) }, () => rand());
    const octaves = [8, 16, 32, 64].map((n) => ({ n, g: grid(n) }));
    const smooth = (t) => t * t * (3 - 2 * t);
    const height = (x, y) => {
      let v = 0;
      let amp = 0.55;
      for (const { n, g } of octaves) {
        const fx = (x / W) * n;
        const fy = (y / H) * (n / 2);
        const x0 = Math.floor(fx);
        const y0 = Math.floor(fy);
        const tx = smooth(fx - x0);
        const ty = smooth(fy - y0);
        const at = (i, j) => g[(((j % (n / 2 + 1)) + n / 2 + 1) % (n / 2 + 1)) * n + (((i % n) + n) % n)];
        const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * tx;
        const bottom = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * tx;
        v += (top + (bottom - top) * ty) * amp;
        amp *= 0.5;
      }
      // the poles a little colder: more sea at the top and bottom
      return v - Math.abs(y / H - 0.5) * 0.35;
    };
    const SEA = 0.46;
    const GREENS = [P.dark, P.glow, P.base, P.light];
    const map = paint(
      (g) => {
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            const h = height(x, y);
            let c;
            if (h < SEA - 0.1) c = P.dark; // the deep
            else if (h < SEA) c = rand() < 0.04 ? P.dark : P.glow; // the sea, with the odd wave
            else if (h < SEA + 0.015) c = P.light; // a beach
            else if (h < SEA + 0.12) c = P.base;
            else c = P.light;
            g.fillStyle = c;
            g.fillRect(x, y, 1, 1);
            // trees: a dark pixel here and there on the land
            if (h >= SEA + 0.02 && h < SEA + 0.12 && (x * 7 + y * 13) % 17 === 0) {
              g.fillStyle = P.glow;
              g.fillRect(x, y, 1, 1);
            }
          }
        }
      },
      W,
      H,
    );
    map.magFilter = THREE.NearestFilter;
    map.minFilter = THREE.NearestMipmapLinearFilter;
    map.anisotropy = 1;
    p.body.material = new THREE.MeshStandardMaterial({ map, roughness: 0.85, metalness: 0 });
    // pixel clouds, drifting a little faster than the ground
    const clouds = paint(
      (g) => {
        g.clearRect(0, 0, W, H);
        g.fillStyle = GREENS[3];
        for (let i = 0; i < 34; i++) {
          const cx = Math.floor(rand() * W);
          const cy = Math.floor(H * (0.15 + rand() * 0.7));
          const len = 4 + Math.floor(rand() * 12);
          for (let k = 0; k < len; k++) {
            const x = (cx + k) % W;
            g.fillRect(x, cy, 1, 1);
            if (k > 1 && k < len - 2) g.fillRect(x, cy - 1, 1, 1);
            if (k > 3 && k < len - 4 && rand() < 0.6) g.fillRect(x, cy - 2, 1, 1);
          }
        }
      },
      W,
      H,
    );
    clouds.magFilter = THREE.NearestFilter;
    const cloudShell = new THREE.Mesh(new THREE.SphereGeometry(r * 1.025, 64, 40), new THREE.MeshStandardMaterial({ map: clouds, transparent: true, depthWrite: false, roughness: 1, alphaTest: 0.5 }));
    p.group.add(cloudShell);
    p.tick.push((t) => (cloudShell.rotation.y = t * 0.09));
    // blocky mountains: a few voxels standing up where the land is highest
    const peaks = [];
    for (let n = 0; n < 4000 && peaks.length < 70; n++) {
      const x = rand() * W;
      const y = rand() * H;
      const h = height(x, y);
      if (h > SEA + 0.17) peaks.push([x, y, h]);
    }
    const c = r * 0.05;
    const blocks = new THREE.InstancedMesh(new THREE.BoxGeometry(c, c, c), new THREE.MeshStandardMaterial({ roughness: 0.75 }), peaks.length * 2);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const out = new THREE.Vector3();
    const col = new THREE.Color();
    let i = 0;
    for (const [x, y, h] of peaks) {
      // the point on the sphere under that pixel (as SphereGeometry maps it)
      const phi = (x / W) * Math.PI * 2;
      const theta = (y / H) * Math.PI;
      out.set(-Math.cos(phi) * Math.sin(theta), Math.cos(theta), Math.sin(phi) * Math.sin(theta));
      q.setFromUnitVectors(up, out);
      const tall = h > SEA + 0.23 ? 2 : 1;
      for (let k = 0; k < tall; k++) {
        m.compose(out.clone().multiplyScalar(r + c * (0.35 + k)), q, new THREE.Vector3(1, 1, 1));
        blocks.setMatrixAt(i, m);
        blocks.setColorAt(i, col.set(k ? GREENS[3] : GREENS[2]));
        i++;
      }
    }
    blocks.count = i;
    p.body.add(blocks);
    // Mario stands on top of it, like the Little Prince on his asteroid (on
    // the pole, so the world turns under him and he stays facing you), and a
    // Piranha Plant pokes out of its pipe on the land, going round with it
    const hero = new THREE.Group();
    hero.position.y = r + r * 0.16;
    p.group.add(hero);
    const plantAt = new THREE.Vector3(0.55, 0.62, 0.56).normalize();
    const plant = new THREE.Group();
    plant.position.copy(plantAt).multiplyScalar(r + r * 0.12);
    plant.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), plantAt);
    p.body.add(plant);
    p.slots = {
      mario: { holder: hero, size: r * 0.34, turn: [0, 0, 0], sway: 0.35, hop: true },
      plant: { holder: plant, size: r * 0.26, turn: [0, 0.6, 0], sway: 0.5, chomp: true },
    };
    const o = orbit(p.group, { radius: r * 1.55, tilt: -0.3, speed: 0.22, phase: 2.6 });
    p.orbits.push(o);
    p.slot = { holder: o.holder, size: r * 0.6, turn: [0, Math.PI, 0.2] };

  },

  caribbean(p, { u }) {
    const r = u.size;
    const P = u.palette;
    const rand = rng('caribbean');
    // a world that is nearly all sea: deep water, turquoise shallows round
    // small islands of sand and green, and a little cloud
    const map = paint(
      (g, w, h) => {
        const sea = g.createLinearGradient(0, 0, 0, h);
        sea.addColorStop(0, '#0a4a55');
        sea.addColorStop(0.5, P.base);
        sea.addColorStop(1, P.dark);
        g.fillStyle = sea;
        g.fillRect(0, 0, w, h);
        const blob = (x, y, s, fill) => {
          // drawn twice across the seam, so the map wraps
          for (const dx of [0, -w, w]) {
            g.beginPath();
            g.ellipse(x + dx, y, s * 1.5, s, 0, 0, Math.PI * 2);
            g.fillStyle = fill;
            g.fill();
          }
        };
        // island chains: each a few lumps run together, so no two are the
        // same shape; the shallows first, then the sand, then the green
        const isles = [];
        for (let i = 0; i < 64; i++) {
          const x = rand() * w;
          const y = h * (0.16 + rand() * 0.68);
          const s = 3 + rand() * rand() * 15;
          const run = rand() * Math.PI;
          for (let k = 0, n = 2 + Math.floor(rand() * 5); k < n; k++) isles.push([x + Math.cos(run) * k * s * 1.3 + (rand() - 0.5) * s, y + Math.sin(run) * k * s * 0.7 + (rand() - 0.5) * s, s * (0.55 + rand() * 0.6)]);
        }
        for (const [x, y, s] of isles) blob(x, y, s * 2.4, 'rgba(64, 220, 200, 0.14)');
        for (const [x, y, s] of isles) blob(x, y, s * 1.6, 'rgba(64, 220, 200, 0.3)');
        for (const [x, y, s] of isles) blob(x, y, s * 1.08, P.light);
        for (const [x, y, s] of isles) blob(x, y, s * 0.78, '#3f7a3a');
        for (let i = 0; i < 60; i++) blob(rand() * w, rand() * h, 6 + rand() * 30, `rgba(255, 255, 255, ${(0.03 + rand() * 0.08).toFixed(3)})`);
      },
      1024,
      512,
    );
    p.body.material = new THREE.MeshStandardMaterial({ map, roughness: 0.6 });
    // the black galleon sails round it
    const o = orbit(p.group, { radius: r * 1.5, tilt: 0.22, speed: 0.2, phase: 0.7 });
    p.orbits.push(o);
    p.slot = { holder: o.holder, size: r * 0.9, turn: [0.1, -Math.PI / 2, 0] }; // her bow is −x: along the orbit
  },

  invincible(p, { u, T }) {
    const r = u.size;
    const P = u.palette;
    const rand = rng('invincible');
    if (T.invincible) {
      // a war-worn world (scripts/build-invincible-planet.mjs): rust plateaus
      // over dark old sea beds, ridges, craters thrown wide, and long rifts
      // still molten along their floors; cities light its night side, and
      // high dust streams round it in bands
      const mat = new THREE.MeshStandardMaterial({
        map: T.invincible,
        normalMap: T['invincible-normal'] ?? null,
        normalScale: new THREE.Vector2(1.35, 1.35),
        emissive: '#ffffff',
        emissiveMap: T['invincible-glow'] ?? null,
        emissiveIntensity: T['invincible-glow'] ? 2.4 : 0,
        roughness: 0.92,
      });
      p.body.material = mat;
      p.night = T['invincible-night'] ?? null;
      // the rifts breathe, slowly
      if (T['invincible-glow']) p.tick.push((t) => (mat.emissiveIntensity = 2 + 1.2 * (0.5 + 0.5 * Math.sin(t * 1.1)) ** 2));
      if (T['invincible-clouds']) {
        const dust = new THREE.Mesh(
          new THREE.SphereGeometry(r * 1.016, T.small ? 44 : 64, T.small ? 28 : 40),
          new THREE.MeshStandardMaterial({ color: '#f3d4b4', alphaMap: T['invincible-clouds'], transparent: true, depthWrite: false, roughness: 1 }),
        );
        p.group.add(dust);
        p.tick.push((t) => (dust.rotation.y = t * 0.065));
      }
    } else {
      // (without the maps: painted here, rust and ochre, dark old sea beds, bands of high cloud)
      const map = paint(
        (g, w, h) => {
          const ground = g.createLinearGradient(0, 0, 0, h);
          ground.addColorStop(0, P.dark);
          ground.addColorStop(0.3, P.base);
          ground.addColorStop(0.7, P.base);
          ground.addColorStop(1, P.dark);
          g.fillStyle = ground;
          g.fillRect(0, 0, w, h);
          const blob = (x, y, rx, ry, fill) => {
            for (const dx of [0, -w, w]) {
              g.beginPath();
              g.ellipse(x + dx, y, rx, ry, 0, 0, Math.PI * 2);
              g.fillStyle = fill;
              g.fill();
            }
          };
          for (let i = 0; i < 90; i++) blob(rand() * w, h * (0.12 + rand() * 0.76), 10 + rand() * 60, 6 + rand() * 26, `rgba(40, 10, 6, ${(0.12 + rand() * 0.25).toFixed(3)})`);
          for (let i = 0; i < 120; i++) blob(rand() * w, h * (0.1 + rand() * 0.8), 4 + rand() * 30, 3 + rand() * 12, `rgba(230, 160, 90, ${(0.08 + rand() * 0.2).toFixed(3)})`);
        },
        1024,
        512,
      );
      p.body.material = new THREE.MeshStandardMaterial({ map, roughness: 0.85 });
    }

    // a soft glow, for the flyers' heads and the shockwaves
    const soft = paint(
      (g, w, h) => {
        const k = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
        k.addColorStop(0, 'rgba(255,255,255,1)');
        k.addColorStop(0.2, 'rgba(255,255,255,0.6)');
        k.addColorStop(0.55, 'rgba(255,255,255,0.12)');
        k.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = k;
        g.fillRect(0, 0, w, h);
      },
      128,
      128,
    );
    // a trail's fade, bright at the head
    const fade = paint(
      (g, w, h) => {
        const k = g.createLinearGradient(0, 0, w, 0);
        k.addColorStop(0, '#ffffff');
        k.addColorStop(0.25, '#9a9a9a');
        k.addColorStop(1, '#000000');
        g.fillStyle = k;
        g.fillRect(0, 0, w, h);
      },
      256,
      4,
    );

    // ── a debris belt: what's left of something that was hit very hard ──
    {
      const rock = new THREE.DodecahedronGeometry(1, 0);
      const pos = rock.attributes.position;
      for (let i = 0; i < pos.count; i++) pos.setXYZ(i, pos.getX(i) * (0.75 + 0.5 * Math.abs(Math.sin(i * 1.7))), pos.getY(i) * (0.6 + 0.3 * Math.abs(Math.cos(i * 2.3))), pos.getZ(i) * (0.8 + 0.4 * Math.abs(Math.sin(i * 0.9))));
      rock.computeVertexNormals();
      const N = T.small ? 70 : 150;
      const rocks = new THREE.InstancedMesh(rock, new THREE.MeshStandardMaterial({ color: '#8a5a44', roughness: 0.95, flatShading: true }), N);
      const belt = new THREE.Group();
      belt.rotation.set(0.42, 0, -0.16);
      belt.add(rocks);
      p.group.add(belt);
      const bits = Array.from({ length: N }, () => {
        const a = rand() * Math.PI * 2;
        const rad = r * (1.48 + rand() * 0.34 + (rand() < 0.15 ? rand() * 0.2 : 0));
        return { a, rad, y: (rand() - 0.5) * r * 0.05, s: r * (0.006 + rand() ** 3 * 0.03), spin: (rand() - 0.5) * 2, ax: rand() * 6, w: 0.05 + rand() * 0.04 };
      });
      const c = new THREE.Color();
      bits.forEach((b, i) => rocks.setColorAt(i, c.set(rand() < 0.2 ? '#5a3a30' : rand() < 0.5 ? '#9a6a50' : '#7a4a38')));
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const e = new THREE.Euler();
      const at = new THREE.Vector3();
      const sc = new THREE.Vector3();
      const place = (t) => {
        bits.forEach((b, i) => {
          const a = b.a + t * b.w;
          at.set(Math.cos(a) * b.rad, b.y, Math.sin(a) * b.rad);
          q.setFromEuler(e.set(b.ax + t * b.spin, b.ax * 2 + t * b.spin * 0.7, 0));
          rocks.setMatrixAt(i, m.compose(at, q, sc.setScalar(b.s)));
        });
        rocks.instanceMatrix.needsUpdate = true;
      };
      place(0);
      p.tick.push(place);
      // and the dust it's grinding into, a faint band
      const IN = r * 1.42;
      const OUT = r * 1.9;
      const bands = paint(
        (g, w, h) => {
          g.clearRect(0, 0, w, h);
          for (let x = 0; x < w; x++) {
            const k = x / w;
            const a = Math.sin(k * Math.PI) ** 1.4 * (0.45 + 0.55 * Math.abs(Math.sin(k * 23 + Math.sin(k * 7) * 2)));
            g.fillStyle = `rgba(220, 150, 110, ${(a * 0.55).toFixed(3)})`;
            g.fillRect(x, 0, 1, h);
          }
        },
        512,
        4,
      );
      const disc = new THREE.RingGeometry(IN, OUT, 128, 1);
      const dp = disc.attributes.position;
      const uv = disc.attributes.uv;
      for (let i = 0; i < dp.count; i++) uv.setXY(i, (Math.hypot(dp.getX(i), dp.getY(i)) - IN) / (OUT - IN), 0.5);
      const dust = new THREE.Mesh(disc, new THREE.MeshBasicMaterial({ map: bands, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide }));
      dust.rotation.x = -Math.PI / 2;
      belt.add(dust);
    }

    // ── a moon, broken: cracks of light through it, and pieces drifting off its side ──
    {
      const o = orbit(p.group, { radius: r * 2.15, tilt: -0.22, yaw: 0.9, speed: 0.07, phase: 1.3 });
      p.orbits.push(o);
      const mr = r * 0.17;
      const geo = new THREE.IcosahedronGeometry(mr, T.small ? 3 : 4);
      const gp = geo.attributes.position;
      const v = new THREE.Vector3();
      for (let i = 0; i < gp.count; i++) {
        v.fromBufferAttribute(gp, i).normalize();
        // pocked, and flattened where the piece came off (+x)
        const pock = 1 + 0.035 * Math.sin(v.x * 17 + v.y * 9) * Math.sin(v.z * 13 - v.y * 7) - 0.05 * Math.max(0, Math.sin(v.x * 29) * Math.sin(v.y * 31) * Math.sin(v.z * 23));
        const cut = v.x > 0.55 ? 1 - (v.x - 0.55) * 0.9 : 1;
        v.multiplyScalar(mr * pock * cut);
        gp.setXYZ(i, v.x, v.y, v.z);
      }
      geo.computeVertexNormals();
      const cracks = paint(
        (g, w, h) => {
          g.fillStyle = '#000';
          g.fillRect(0, 0, w, h);
          g.lineCap = 'round';
          // from the broken side (u ≈ 0.5 faces +x), jagged lines running out round it
          for (let i = 0; i < 16; i++) {
            let x = w * (0.5 + (rand() - 0.5) * 0.08);
            let y = h * (0.3 + rand() * 0.4);
            g.strokeStyle = `rgba(255, ${100 + rand() * 80}, 40, ${(0.5 + rand() * 0.5).toFixed(2)})`;
            g.lineWidth = 1 + rand() * 2.5;
            g.beginPath();
            g.moveTo(x, y);
            const dir = rand() < 0.5 ? -1 : 1;
            for (let k = 0; k < 9; k++) {
              x += dir * (8 + rand() * 22);
              y += (rand() - 0.5) * 26;
              g.lineTo(x, y);
            }
            g.stroke();
          }
        },
        512,
        256,
      );
      const moon = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#8f7f74', roughness: 1, emissive: '#ffffff', emissiveMap: cracks, emissiveIntensity: 1.6 }));
      o.holder.add(moon);
      const chunks = [];
      const shard = new THREE.DodecahedronGeometry(1, 0);
      const chunkMat = new THREE.MeshStandardMaterial({ color: '#7f6f64', roughness: 1, flatShading: true });
      for (let i = 0; i < 6; i++) {
        const c = new THREE.Mesh(shard, chunkMat);
        const s = mr * (0.12 + rand() * 0.22);
        c.scale.set(s, s * (0.6 + rand() * 0.5), s * (0.8 + rand() * 0.4));
        o.holder.add(c);
        chunks.push({ c, dir: new THREE.Vector3(1, (rand() - 0.5) * 1.2, (rand() - 0.5) * 1.2).normalize(), d: mr * (1.15 + rand() * 0.9), ph: rand() * 6, spin: (rand() - 0.5) * 0.8 });
      }
      p.tick.push((t) => {
        moon.rotation.y = t * 0.05;
        for (const k of chunks) {
          // out, and back a little, as if still coming apart
          k.c.position.copy(k.dir).multiplyScalar(k.d * (1 + 0.08 * Math.sin(t * 0.3 + k.ph)));
          k.c.rotation.set(k.ph + t * k.spin, k.ph * 2 + t * k.spin * 0.6, 0);
        }
      });
    }

    // ── two flyers round it, each trailing light, now and then breaking the
    // sound barrier in a ring: one in yellow and blue, one in white and red ──
    const q = new THREE.Quaternion();
    const flyer = (head, tail, { radius, tilt, yaw, speed, phase, boom }) => {
      const o = orbit(p.group, { radius, tilt, yaw, speed, phase });
      p.orbits.push(o);
      const core = new THREE.Mesh(new THREE.SphereGeometry(r * 0.022, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(head).multiplyScalar(2.6), toneMapped: false }));
      o.holder.add(core);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: soft, color: new THREE.Color(head).multiplyScalar(1.6), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
      halo.scale.setScalar(r * 0.2);
      o.holder.add(halo);
      // the trail: a tube along the orbit just behind, tapering and fading
      const ARC = 1.7;
      const pts = Array.from({ length: 41 }, (_, i) => {
        const b = -(i / 40) * ARC;
        return new THREE.Vector3(Math.cos(b) * radius, 0, -Math.sin(b) * radius);
      });
      const path = new THREE.CatmullRomCurve3(pts);
      const tube = (width) => {
        const g = new THREE.TubeGeometry(path, 80, width, 8, false);
        // (each ring of the tube drawn in toward its centre, more the further back)
        const tp = g.attributes.position;
        const at = new THREE.Vector3();
        for (let i = 0; i <= 80; i++) {
          const k = i / 80;
          path.getPointAt(k, at);
          const taper = (1 - k) ** 1.3;
          for (let j = 0; j <= 8; j++) {
            const n = i * 9 + j;
            tp.setXYZ(n, at.x + (tp.getX(n) - at.x) * taper, at.y + (tp.getY(n) - at.y) * taper, at.z + (tp.getZ(n) - at.z) * taper);
          }
        }
        return g;
      };
      const trailMat = (c, k) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k), alphaMap: fade, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
      o.pivot.add(new THREE.Mesh(tube(r * 0.024), trailMat(tail, 1.2)), new THREE.Mesh(tube(r * 0.008), trailMat(head, 2)));
      // the shockwave: a ring that bursts out from the head and fades
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(head).lerp(new THREE.Color('#ffffff'), 0.5).multiplyScalar(1.8), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }));
      o.holder.add(ring);
      p.tick.push((t, camera) => {
        halo.material.opacity = 0.75 + 0.25 * Math.sin(t * 9 + phase);
        const k = ((t + boom) % 6.5) / 0.9; // every six and a half seconds, for nine tenths of one
        const on = k < 1;
        ring.visible = on;
        if (!on) return;
        ring.scale.setScalar(r * (0.03 + 0.4 * (1 - (1 - k) ** 2)));
        ring.material.opacity = (1 - k) ** 1.5 * 0.9;
        if (camera) {
          ring.parent.getWorldQuaternion(q);
          ring.quaternion.copy(q.invert()).multiply(camera.quaternion);
        }
      });
    };
    flyer('#ffd23a', '#3aa0ff', { radius: r * 1.3, tilt: 0.35, yaw: 0.4, speed: 0.55, phase: 0, boom: 0 });
    flyer('#ffffff', '#ff3a2a', { radius: r * 1.4, tilt: -0.25, yaw: 1.9, speed: 0.48, phase: 2.1, boom: 3.2 });
  },

  travel(p, { u, T }) {
    const r = u.size;
    // the oceans catch the sun (a roughness map), the cities light the night side (in airGlow)
    p.body.material = new THREE.MeshStandardMaterial({
      map: T.earth ?? null,
      color: T.earth ? '#ffffff' : u.palette.base,
      roughnessMap: T['earth-rough'] ?? null,
      roughness: T['earth-rough'] ? 1 : 0.85,
      metalness: 0,
    });
    p.night = T['earth-night'] ?? null;
    // the clouds, drifting a little faster than the ground
    if (T['earth-clouds']) {
      const clouds = new THREE.Mesh(
        new THREE.SphereGeometry(r * 1.012, 64, 40),
        new THREE.MeshStandardMaterial({ color: '#ffffff', alphaMap: T['earth-clouds'], transparent: true, depthWrite: false, roughness: 1 }),
      );
      p.group.add(clouds);
      p.tick.push((t) => (clouds.rotation.y = t * 0.075));
    }
    // a few routes from home, lifted off the surface (the travel globe's own)
    const data = globeData();
    const routes = data.arcs.filter(Boolean);
    const pick = [0, 0.2, 0.4, 0.6, 0.8].map((k) => routes[Math.floor(k * routes.length)]).filter(Boolean);
    const tubes = pick.map((pts) => {
      const steps = pts.length / 3 - 1;
      const curve = new THREE.CatmullRomCurve3(
        Array.from({ length: 25 }, (_, i) => {
          const k = Math.round((i / 24) * steps) * 3;
          return new THREE.Vector3(pts[k] * r * 1.01, pts[k + 1] * r * 1.01, pts[k + 2] * r * 1.01);
        }),
      );
      return new THREE.TubeGeometry(curve, 48, r * 0.01, 5, false);
    });
    if (tubes.length) {
      const arcs = new THREE.Mesh(mergeGeometries(tubes), glowMat(u.swatch));
      for (const t of tubes) t.dispose();
      p.body.add(arcs);
    }
  },
  ...STATIONS,
};

export function buildPlanet(u, T = {}) {
  const core = u.kind === 'core';
  const seg = T.small ? [44, 28] : [64, 40]; // a phone's screen needs fewer
  const group = new THREE.Group();
  const spinner = new THREE.Group(); // what turns about the planet's axis
  group.add(spinner);
  const body = new THREE.Mesh(new THREE.SphereGeometry(u.size, seg[0], seg[1]), new THREE.MeshStandardMaterial({ color: u.palette.base, roughness: 1 }));
  spinner.add(body);
  // a planet has air round it in its colour; a station's sign does that job
  const air = core || u.airless ? null : halo(u.size, u.rim ?? u.swatch, seg); // (a station has no air round it)
  if (air) group.add(air);
  const p = { group, body, orbits: [], tick: [], focus: [], slot: null, onSelect: null };
  BUILDERS[u.id]?.(p, { u, T });
  if (!core && p.body.material?.isMeshStandardMaterial) airGlow(p.body.material, u.rim ?? u.swatch, { night: p.night });
  // a station's big sign, over it
  const sign = u.sign ? bigSign(u) : null;
  if (sign) {
    group.add(sign);
    p.tick.push(facing(sign));
  }
  const spin = core ? 0 : 0.05 + rng(`${u.id}-spin`)() * 0.05;
  let turn0 = body.rotation.y;
  let held = null; // the turn it's held at, while someone stands on it
  let selected = false;
  let t0 = 0;

  return {
    id: u.id,
    radius: u.size,
    group,
    sign,
    // what a crash lays its shockwave on (a station's is hidden: none)
    surface: core ? null : body,
    body,
    air,
    // held still (true) while the crew walk about on it, and turning on
    // from there once they're gone
    hold(on) {
      if (on && held === null) held = body.rotation.y;
      else if (!on && held !== null) {
        turn0 = held - t0 * spin;
        held = null;
      }
    },
    // the sign brightens and grows a little under the pointer
    setSignHover(on) {
      if (!sign) return;
      sign.scale.setScalar(on ? 1.08 : 1);
      sign.material.color.setScalar(on ? 1.35 : 1);
    },
    // (`live`: it's in view and big enough to see, so its own motion, which
    // can be a lot, is worth working out; all of it goes by `t`, so it's
    // where it should be the moment it's back in view)
    update(t, camera, live = true) {
      t0 = t;
      body.rotation.y = held ?? turn0 + t * spin;
      for (const o of p.orbits) o.set(t);
      if (live) for (const fn of p.tick) fn(t, camera);
    },
    // `dim`: somewhere else is picked, so this station's sign steps back
    setState({ hover, selected: sel, dim = false }) {
      const k = hover ? RIM.hover : sel ? RIM.selected : RIM.idle;
      if (air) air.material.uniforms.uStrength.value = k;
      const glow = body.material?.userData?.air;
      if (glow) glow.uRimStrength.value = k * 0.8;
      if (sel && !selected) p.onSelect?.(t0);
      if (sel !== selected) for (const fn of p.focus) fn(sel);
      selected = sel;
      if (sign) sign.material.opacity = dim && !hover ? 0.28 : 1;
    },
    // a loaded model, parked on its orbit or its spot: the planet's own, or
    // the one named (most planets have just their own; a few have more:
    // Cybertron's 'rival', the Game Boy world's 'mario' and 'plant', the Death
    // Star's 'cruiser'). True when this planet takes it
    mount(model, name) {
      const s = name ? p.slots?.[name] : p.slot;
      if (!s || !model) return false;
      const holder = fit(model, s.size);
      holder.rotation.set(...s.turn);
      s.holder.add(holder);
      // a model that's the planet itself: the painted sphere stops drawing
      // (it stays, for what's laid over it: a crash's shockwave)
      if (s.skin) {
        p.body.material.visible = false;
        model.traverse((o) => {
          if (o.isMesh && o.material?.emissiveMap) o.material.emissiveIntensity = 1.6; // its lit windows
        });
      }
      const sway = s.sway ?? 0.25;
      p.tick.push((t) => {
        holder.rotation.y = s.turn[1] + Math.sin(t * 0.4) * sway;
        // Mario's hop, now and then, the way he does
        if (s.hop) holder.position.y = Math.max(0, Math.sin(t * 1.7)) ** 3 * s.size * 0.35;
        // the Piranha Plant's chomp
        if (s.chomp) holder.scale.y = holder.scale.x * (1 + Math.max(0, Math.sin(t * 3.1)) ** 4 * 0.12);
      });
      return true;
    },
  };
}

// One model, or null if it doesn't load: a copy of the page's one parse of it
// (gltfCache.js), its materials its own, its geometry and textures shared.
export function loadModel(url) {
  return loadGLTF(url).then((g) => g && cloneScene(g));
}

// [planet, model, and which of its spots, if not its own]. The sitar is
// Amagi_Arts's model, from Sketchfab (scripts/sketchfab-batch.mjs, credited
// in data/modelCredits.json)
const MODELS = [
  ['music', '/models/sketchfab/sitar.glb'],
  ['transformers', '/models/cybertron/optimus-orbit.glb'], // War for Cybertron's, as Cybertron's own world has him
  ['transformers', '/models/cybertron/megatron-orbit.glb', 'rival'], // and Fall of Cybertron's
  ['marvel', '/models/universe/marvel.glb'],
  ['breakingbad', '/models/universe/breakingbad.glb'],
  ['rickmorty', '/games/meshy/saucer.glb'], // the classic cruiser, as on the C-137 page
  ['gaming', '/models/universe/gaming.glb'],
  ['gaming', '/models/universe/mario.glb', 'mario'],
  ['gaming', '/models/universe/piranha.glb', 'plant'],
  ['caribbean', '/games/caribbean/pearl-far.glb'],
  ['starwars', '/models/universe/venator.glb', 'cruiser'],
  ['starwars', '/models/universe/star-destroyer.glb', 'escort1'],
  ['starwars', '/models/universe/star-destroyer.glb', 'escort2'],
];

// Load the models one by one, handing each over as it arrives; a model that
// fails is skipped.
export function loadModels(onModel) {
  const loader = gltfLoader();
  return Promise.all(
    MODELS.map(([id, url, spot]) =>
      loader
        .loadAsync(url)
        .then((g) => onModel(id, g.scene, spot))
        .catch(() => {}),
    ),
  );
}

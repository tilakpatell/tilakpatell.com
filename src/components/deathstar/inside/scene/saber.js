// What a duel looks like aboard: the lightsabers (a hilt in the fist, a
// white-hot core in a coloured glow, red for Vader’s, blue for Obi-Wan’s,
// green for Luke’s on the second station, humming with a soft flicker),
// the ribbon a swung blade leaves for a moment, sparks and a flash where
// blades meet or a blade turns a bolt, the Emperor’s lightning (branching
// blue-white arcs from his hands, drawn anew a few times a second so it
// crawls), the ripple a push sends through the air and the faint one at a
// gripped throat. The colours are light over white, so the bloom takes
// them; with no bloom (the low tier) the glows are still drawn round each
// blade and arc, so nothing goes flat.
//
// The shaders are TSL (./nodes/saber.js); the GLSL they were is
// ./glsl/saber.js, for the parity check.
//
// Everything is made at the start and pooled (four draws however hard the
// fight: hilts, cores, trails, and every glow, arc, spark, flash and ripple
// as one set of sprites), and `warm` compiles its shaders before the first
// stroke, so nothing is allocated or compiled mid-duel. No light is added,
// since a new light rebuilds every lit shader: `lamps()` hands back what
// the blades and the lightning would light, in the stream’s lamp form,
// for whoever owns the lamps to light them (a clash’s blink is too quick
// for a lamp eased up and down: the bloom is its light).
//
// A blade follows its hand: up out of the fist along the hand’s own `axis`
// (+y unless given), or along a way it is aimed, which `swing` works out
// from the rules’ fighter (up and forward at rest, across the body behind
// a guard, round through a stroke so its blow lands as the rules’ does).
//
//   SEG: the 7 floats of an arc’s segment: its two ends, and its weight (1 the main arc, less a fork)
//   POOLS → { high, mid, low }: blades, trail samples and bits (sparks, flashes, ripples) a tier keeps,
//     and how finely its lightning is cut (ultra takes high’s)
//   bladeHues(colour) → { core, glow: [r, g, b], light: 0xrrggbb }   colour: 'red' | 'green' | 'blue', or the cast’s number
//   hum(t, seed) → about 1   a blade’s brightness t seconds on: a soft flicker, out of step between seeds
//   swing(fighter, ahead = 0, out?) → { x, y, z }   pure: where a rules/saber.js fighter’s blade points,
//     its stroke carried on `ahead` seconds past the last step
//   trailLevel(age, speed) → 0…1   a trail’s brightness `age` seconds behind a tip moving at `speed` m/s
//   arcPath(from, to, rand, { depth, branches, jag }, out, at = 0) → segments written   pure and seeded:
//     an arc cut into 2^depth pieces, straying up to `jag` of its length, with `branches` fainter forks
//     off its bends, written into the Float32Array `out` from segment `at` and never past its end
//   createSabers(scene, { tier }) → sabers
//     blade(id, colour) → handle   the same for the same id; a full pool gives up its oldest, unlit first
//       handle: attach(hand: Object3D | null, axis?), aim(dir | null), on(lit), update(dt), release(),
//       along(k, out) → out (the point k of the way from the emitter to the lit tip)
//     clash(at, kind = 'block', dir?)   kind: resolveClash’s 'block' | 'parry' | 'break' | 'hit', or
//       'deflect' (a bolt turned, its sparks thrown along `dir`)
//     lightning(from: point | [point], to, on = true)   each frame it burns;  push(at, dir);  choke(throat, on = true)
//     update(dt)   once a frame: steps every blade its handle hasn’t, then draws
//     lamps() → [{ x, y, z, color, intensity, distance }]   those lit now (the same objects each frame)
//     warm(renderer, camera, target?) → Promise;  live() → { blades, trails, sparks, flashes, arcs, ripples }
//     meshes;  dispose()

import * as THREE from 'three';
import { seeded } from '../../../../lib/seeded';
import { precompile } from '../../../../lib/three/renderer';
import { STROKES } from '../rules/saber';
import { createSlots } from './fx';
import { bladeGlowMaterial, trailMaterial } from './nodes/saber';

export const SEG = 7;
const MOST = 6; // the finest an arc is ever cut: 64 pieces
const HANDS = 2; // the Emperor throws it from both
const GRAVITY = 9.8;

// metres: the blade’s length and the radii of its core and two glows; s: how long it takes to light and to go out
const BLADE = { length: 0.95, core: 0.013, inner: 0.045, outer: 0.15, on: 0.16, off: 0.22 };
const HILT = { emitter: 0.17 }; // how far up the hilt from the fist the blade leaves it
const NAMED = { red: 0xff2a1f, green: 0x46ff3c, blue: 0x3f8cff }; // the cast’s red and blue, and Luke’s green
const GLOW = 2.6; // the glow’s brightest channel, as light
const CORE = 4.2; // the core’s, every channel near it: white-hot
// life: s a trail lasts; slow…fast: m/s of the tip between no trail and a full one; jump: metres between
// two frames that are a blade put somewhere new, not swung
const TRAIL = { life: 0.14, slow: 3, fast: 12, jump: 2, bright: 0.25 }; // bright: a smear, not a sheet
// rate: times a second it is drawn anew; reach: metres its end wanders over the body it burns
const ARC = { rate: 8, jag: 0.22, reach: 0.25, fade: 0.15, core: [2.2, 2.7, 4.2], glow: [0.32, 0.45, 1.5], r: 0.012, halo: 0.07, light: 0xa4bcff };
const HOT = [4, 3.2, 2.2]; // a spark as it leaves the blades
const COOL = [1.4, 0.35, 0.06]; // and as it dies
const FLASH = [4, 3.7, 3.3]; // two blades meeting: white-hot
const BOLT_FLASH = [3.2, 0.9, 0.5]; // a bolt turned: its own red
const BLINK = 0.14; // s a flash lasts
// sparks thrown, the flash’s size in metres and its colour (FLASH unless given): a parry rings brighter
// than a block (timing beats strength), a broken guard brightest; a turned bolt flashes its own red
const CLASHES = { block: { sparks: 14, flash: 0.18 }, parry: { sparks: 26, flash: 0.28 }, break: { sparks: 32, flash: 0.32 }, hit: { sparks: 6, flash: 0.1 }, deflect: { sparks: 8, flash: 0.12, colour: BOLT_FLASH } };
// a push: rings sent along it; a choke: one at the throat every `every` s, tightening
const RIPPLE = { colour: [0.05, 0.06, 0.08], push: { rings: 3, gap: 0.07, life: 0.5, speed: 6, from: 0.25, to: 1.1, band: 0.12 }, choke: { every: 0.35, life: 0.6, from: 0.17, to: 0.07, band: 0.3 } };
const [SPARK, FLASHED, PUSHED, GRIPPED] = [0, 1, 2, 3]; // the bits’ kinds
const LAMP = { blade: 7, bladeReach: 4.5, arc: 40, arcReach: 10 };

export const POOLS = Object.freeze({
  high: Object.freeze({ blades: 4, trail: 16, bits: 184, depth: 5, branches: 5 }),
  mid: Object.freeze({ blades: 4, trail: 12, bits: 114, depth: 4, branches: 4 }),
  low: Object.freeze({ blades: 4, trail: 8, bits: 60, depth: 3, branches: 2 }),
});

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const reach = (k) => k * (2 - k); // a blade shoots out and slows as it reaches full length

export function bladeHues(colour) {
  const hex = typeof colour === 'number' ? colour : (NAMED[colour] ?? NAMED.blue);
  const c = [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
  const most = Math.max(...c) || 1;
  const n = c.map((v) => v / most);
  // the glow saturated (the colour as light), the core near white with a tint of it
  return { core: n.map((v) => CORE * (0.68 + 0.32 * v)), glow: n.map((v) => GLOW * v ** 2.2), light: hex };
}

export function hum(t, seed = 0) {
  return 1 + 0.035 * Math.sin(t * 41 + seed * 1.7) + 0.025 * Math.sin(t * 67.3 + seed * 3.1) + 0.015 * Math.sin(t * 113.9 + seed * 5.3);
}

// ── where a fighter’s blade points: [right, up, forward] in its own frame ──

const REST = [0.3, 0.55, 0.78];
const GUARDED = [-0.78, 0.45, 0.42]; // across the body, point high to the left
const REELING = [0.6, -0.25, 0.75]; // knocked out wide and low
// A stroke’s ways: from rest it winds up (by WIND of the time to its
// blow), cuts through as the rules’ blow lands, follows through (by FOLLOW
// of the time after it) and is back at rest by its end.
const SWINGS = {
  light: [REST, [0.55, 0.8, -0.25], [-0.1, -0.05, 1], [-0.7, -0.45, 0.55], REST],
  heavy: [REST, [0.05, 0.75, -0.65], [0, -0.1, 1], [0.15, -0.8, 0.55], REST],
};
const WIND = 0.75;
const FOLLOW = 0.45;
// how each piece eases: off rest and into the top of the wind-up slowly, faster and faster into the
// blow and slowing out of it (a cut is fastest as it lands), and slowly back to rest
const EASES = [(x) => x * x * (3 - 2 * x), (x) => x * x, (x) => 1 - (1 - x) * (1 - x), (x) => x * x * (3 - 2 * x)];
const _way = [0, 0, 0];
const _keys = [0, 0, 0, 0, 0];

// the way e of the way round from a to b (neither need be of length 1), turning evenly
function turn(a, b, e, out) {
  const la = Math.hypot(a[0], a[1], a[2]);
  const lb = Math.hypot(b[0], b[1], b[2]);
  const th = Math.acos(clamp((a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (la * lb), -1, 1));
  const s = Math.sin(th);
  const p = s < 1e-4 ? 1 - e : Math.sin((1 - e) * th) / s;
  const q = s < 1e-4 ? e : Math.sin(e * th) / s;
  for (let i = 0; i < 3; i++) out[i] = (a[i] / la) * p + (b[i] / lb) * q;
  return out;
}

export function swing(f, ahead = 0, out = { x: 0, y: 0, z: 0 }) {
  let way = f.guard ? GUARDED : f.stagger > 0 ? REELING : REST;
  const k = STROKES[f.stroke?.kind];
  if (k) {
    const ways = SWINGS[f.stroke.kind];
    const t = clamp(f.stroke.t + Math.max(0, ahead), 0, k.s);
    _keys[1] = k.at * WIND;
    _keys[2] = k.at;
    _keys[3] = k.at + (k.s - k.at) * FOLLOW;
    _keys[4] = k.s;
    let i = 0;
    while (i < 3 && t >= _keys[i + 1]) i++;
    way = turn(ways[i], ways[i + 1], EASES[i](clamp((t - _keys[i]) / (_keys[i + 1] - _keys[i]), 0, 1)), _way);
  }
  const [r, u, fw] = way;
  const yaw = f.yaw || 0;
  // yaw 0 looks along −z and turning towards +x is positive: right is (cos, 0, sin), forward (sin, 0, −cos)
  const x = r * Math.cos(yaw) + fw * Math.sin(yaw);
  const z = r * Math.sin(yaw) - fw * Math.cos(yaw);
  const l = Math.hypot(x, u, z) || 1;
  out.x = x / l;
  out.y = u / l;
  out.z = z / l;
  return out;
}

export function trailLevel(age, speed) {
  if (!(age >= 0 && age < TRAIL.life)) return 0;
  const k = 1 - age / TRAIL.life;
  return smooth(TRAIL.slow, TRAIL.fast, speed) * k * k;
}

// ── lightning ──

const vectors = (n) => Array.from({ length: n }, () => new THREE.Vector3());
const _main = vectors(2 ** MOST + 1); // the main arc’s bends
const _fork = vectors(2 ** MOST + 1); // a fork’s
const [_d, _u, _w, _md, _mu, _mw, _e] = vectors(7);
const X = new THREE.Vector3(1, 0, 0);
const UP = new THREE.Vector3(0, 1, 0);

// Cut the line from a to b into 2^depth pieces, each bend pushed off it
// square to the line by up to `jag` of the piece it splits, coarse bends
// first: so it never strays more than twice `jag` of its length. Leaves
// the line’s way in _d, and two ways square to it in _u and _w.
function bend(pts, a, b, depth, jag, rand) {
  const n = 2 ** depth;
  pts[0].copy(a);
  pts[n].copy(b);
  const length = _d.subVectors(b, a).length();
  _d.divideScalar(length || 1);
  _u.crossVectors(_d, Math.abs(_d.x) < 0.9 ? X : UP).normalize();
  _w.crossVectors(_d, _u);
  for (let step = n; step > 1; step >>= 1) {
    const most = (jag * length * step) / n;
    for (let i = 0; i < n; i += step) {
      const off = most * rand();
      const turn = rand() * Math.PI * 2;
      pts[i + step / 2].addVectors(pts[i], pts[i + step]).multiplyScalar(0.5).addScaledVector(_u, Math.cos(turn) * off).addScaledVector(_w, Math.sin(turn) * off);
    }
  }
  return n;
}

function put(out, s, a, b, w) {
  a.toArray(out, s * SEG);
  b.toArray(out, s * SEG + 3);
  out[s * SEG + 6] = w;
}

export function arcPath(from, to, rand, { depth = 4, branches = 3, jag = 0.2 } = {}, out, at = 0) {
  const room = Math.floor(out.length / SEG) - at;
  const d = clamp(Math.round(depth), 1, MOST);
  const n = bend(_main, from, to, d, jag, rand);
  const length = _e.subVectors(to, from).length();
  let written = 0;
  for (let i = 0; i < n && written < room; i++) put(out, at + written++, _main[i], _main[i + 1], 1);
  // each fork leaves from a bend (never an end), on towards the target and out to one side
  _md.copy(_d);
  _mu.copy(_u);
  _mw.copy(_w);
  for (let b = 0; b < branches && written < room; b++) {
    const start = _main[1 + Math.floor(rand() * (n - 1))];
    const turn = rand() * Math.PI * 2;
    const side = 0.6 + 0.6 * rand();
    _e.copy(_md).addScaledVector(_mu, Math.cos(turn) * side).addScaledVector(_mw, Math.sin(turn) * side);
    _e.setLength(length * (0.18 + 0.22 * rand())).add(start);
    const m = bend(_fork, start, _e, Math.max(1, d - 2), jag * 1.4, rand);
    for (let k = 0; k < m && written < room; k++) put(out, at + written++, _fork[k], _fork[k + 1], 0.5);
  }
  return written;
}

// ── the parts ──

// A hilt turned along +y, the fist round y = 0: a steel pommel, the black
// grip, the steel body and the flared emitter whose mouth is HILT.emitter up.
const HILT_PROFILE = [[0, -0.1], [0.017, -0.1], [0.017, -0.07], [0.0155, -0.07], [0.0155, 0.05], [0.018, 0.05], [0.018, 0.12], [0.022, HILT.emitter], [0, HILT.emitter]];
const GRIP = new Set([3, 4]); // the profile’s points that are the grip

function buildHilt() {
  const geo = new THREE.LatheGeometry(HILT_PROFILE.map(([r, y]) => new THREE.Vector2(r, y)), 12);
  const n = geo.attributes.position.count;
  const colours = new Float32Array(n * 3);
  const black = new THREE.Color(0x121315);
  const steel = new THREE.Color(0x9aa0a8);
  // (the lathe lays its vertices out a ring of the profile at a time)
  for (let i = 0; i < n; i++) (GRIP.has(i % HILT_PROFILE.length) ? black : steel).toArray(colours, i * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  return geo;
}

const quadGeo = () => {
  const g = new THREE.InstancedBufferGeometry();
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
  g.instanceCount = 0;
  return g;
};
const perInstance = (geo, name, n, size) => {
  const a = new THREE.InstancedBufferAttribute(new Float32Array(n * size), size);
  a.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute(name, a);
  return a;
};
const put3 = (arr, i, x, y, z) => {
  arr[i * 3] = x;
  arr[i * 3 + 1] = y;
  arr[i * 3 + 2] = z;
};

export function createSabers(scene, { tier = 'high' } = {}) {
  const N = POOLS[tier] ?? POOLS.high;
  const rand = seeded(0x5abe7);
  const group = new THREE.Group();
  group.name = 'sabers';

  // ── the hilts and the cores, one instance a blade (a core: a unit-long capsule up from its foot, stretched to the lit length) ──
  const hiltGeo = buildHilt();
  const hiltMat = new THREE.MeshStandardMaterial({ name: 'ds-hilt', vertexColors: true, metalness: 0.85, roughness: 0.32 });
  const hilts = new THREE.InstancedMesh(hiltGeo, hiltMat, N.blades);
  hilts.name = 'saber-hilts';
  const coreGeo = new THREE.CapsuleGeometry(BLADE.core, 1, 3, 8).translate(0, 0.5, 0);
  const coreMat = new THREE.MeshBasicMaterial({ name: 'ds-blade', color: 0xffffff, toneMapped: false });
  const cores = new THREE.InstancedMesh(coreGeo, coreMat, N.blades);
  cores.name = 'saber-cores';
  cores.setColorAt(0, new THREE.Color());
  for (const m of [hilts, cores]) {
    m.count = 0;
    m.frustumCulled = false;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  }

  // ── the trails: a ribbon of quads between a blade’s last few places ──
  const quadCap = N.blades * (N.trail - 1);
  const trailGeo = new THREE.BufferGeometry();
  const tPos = new THREE.BufferAttribute(new Float32Array(quadCap * 12), 3).setUsage(THREE.DynamicDrawUsage);
  const tColour = new THREE.BufferAttribute(new Float32Array(quadCap * 12), 3).setUsage(THREE.DynamicDrawUsage);
  const edge = new Float32Array(quadCap * 4);
  const index = [];
  for (let q = 0; q < quadCap; q++) {
    // each quad: the older hilt end, its tip, the newer tip, the newer hilt end
    edge.set([0, 1, 1, 0], q * 4);
    index.push(q * 4, q * 4 + 1, q * 4 + 2, q * 4, q * 4 + 2, q * 4 + 3);
  }
  trailGeo.setAttribute('position', tPos);
  trailGeo.setAttribute('aColour', tColour);
  trailGeo.setAttribute('aEdge', new THREE.BufferAttribute(edge, 1));
  trailGeo.setIndex(index);
  trailGeo.setDrawRange(0, 0);
  const trailMat = trailMaterial();
  const trails = new THREE.Mesh(trailGeo, trailMat);
  trails.name = 'saber-trails';
  trails.renderOrder = 4;

  // ── the sprites: the blades’ glows, the arcs, sparks, flashes and ripples ──
  const arcCap = HANDS * (2 ** N.depth + N.branches * 2 ** Math.max(1, N.depth - 2));
  const spriteCap = N.blades * 2 + arcCap * 2 + N.bits;
  const spriteGeo = quadGeo();
  const sAt = perInstance(spriteGeo, 'aAt', spriteCap, 3);
  const sDir = perInstance(spriteGeo, 'aDir', spriteCap, 3);
  const sSize = perInstance(spriteGeo, 'aSize', spriteCap, 3);
  const sColour = perInstance(spriteGeo, 'aColour', spriteCap, 3);
  const spriteMat = bladeGlowMaterial();
  const sprites = new THREE.Mesh(spriteGeo, spriteMat);
  sprites.name = 'saber-sprites';
  sprites.renderOrder = 5;
  for (const m of [trails, sprites]) m.frustumCulled = false;

  group.add(hilts, cores, trails, sprites);
  scene.add(group);

  // ── state, in flat arrays and objects made now, so a duel makes no garbage ──
  const records = new Map(); // id → a blade
  const slots = new Array(N.blades).fill(null);
  let born = 0;
  let clock = 0;
  let ns = 0; // sprites written this frame
  // the bits, sparks, flashes and ripples: kind, where, way, radius from and to, band (0 a soft glow), age, life, delay, colour
  const bitSlots = createSlots(N.bits);
  const F = (k = 1) => new Float32Array(N.bits * k);
  const bits = { kind: new Uint8Array(N.bits), p: F(3), v: F(3), from: F(), to: F(), band: F(), t: F(), life: F(), delay: F(), colour: F(3) };
  const bolt = { on: false, hands: 0, from: new Float64Array(HANDS * 3), to: new Float64Array(3), level: 0, wait: 0, since: 0, n: 0, segs: new Float32Array(arcCap * SEG) };
  const grip = { on: false, at: new THREE.Vector3(), wait: 0 };
  const arcLamp = { x: 0, y: 0, z: 0, color: ARC.light, intensity: 0, distance: LAMP.arcReach };
  const arcOpts = { depth: N.depth, branches: N.branches, jag: ARC.jag };
  const lit = [];

  const [_v, _a, _b, _s, _end, _hand, NONE] = vectors(7);
  const _q = new THREE.Quaternion();
  const _m = new THREE.Matrix4();
  const _c = new THREE.Color();

  const place = (lamp, x, y, z, intensity) => {
    lamp.x = x;
    lamp.y = y;
    lamp.z = z;
    lamp.intensity = intensity;
  };
  function sprite(x, y, z, dx, dy, dz, core, radius, band, r, g, b) {
    sAt.setXYZ(ns, x, y, z);
    sDir.setXYZ(ns, dx, dy, dz);
    sSize.setXYZ(ns, core, radius, band);
    sColour.setXYZ(ns, r, g, b);
    ns++;
  }

  // ── the blades ──

  function makeBlade(id, colour, slot) {
    const hue = bladeHues(colour);
    const r = { id, slot, colour, hue, seed: slot * 1.37 + 0.5, born: born++, hand: null, axis: new THREE.Vector3(0, 1, 0), aimed: false, aim: new THREE.Vector3(), lit: false, k: 0, placed: false, ticked: false, dead: false };
    Object.assign(r, { grip: new THREE.Vector3(), base: new THREE.Vector3(), dir: new THREE.Vector3(0, 1, 0), lamp: { x: 0, y: 0, z: 0, color: hue.light, intensity: 0, distance: LAMP.bladeReach } });
    // the trail’s samples, a ring: the hilt’s end, the tip, when, and how lit
    r.trail = { base: new Float32Array(N.trail * 3), tip: new Float32Array(N.trail * 3), t: new Float64Array(N.trail), k: new Float32Array(N.trail), n: 0, head: 0 };
    r.handle = {
      attach(hand, axis) {
        if (r.dead) return r.handle;
        r.hand = hand ?? null;
        if (axis) r.axis.set(axis.x, axis.y, axis.z).normalize();
        r.trail.n = 0;
        return r.handle;
      },
      aim(dir) {
        r.aimed = !!dir && Math.hypot(dir.x, dir.y, dir.z) > 1e-9;
        if (r.aimed) r.aim.set(dir.x, dir.y, dir.z).normalize();
        return r.handle;
      },
      on(lit) {
        r.lit = !!lit;
        return r.handle;
      },
      update(dt) {
        if (r.dead) return;
        tick(r, dt);
        r.ticked = true;
      },
      along(k, out) {
        return out.copy(r.dir).multiplyScalar(BLADE.length * reach(r.k) * k).add(r.base);
      },
      release() {
        if (r.dead) return;
        r.dead = true;
        slots[r.slot] = null;
        records.delete(r.id);
      },
    };
    return r;
  }

  // the blade’s place this frame, from its hand, and a sample of it for the trail
  function tick(r, dt) {
    const step = Math.max(0, dt || 0);
    r.k = clamp(r.k + (r.lit ? step / BLADE.on : -step / BLADE.off), 0, 1);
    r.placed = !!r.hand;
    if (!r.placed) {
      r.trail.n = 0;
      return;
    }
    r.hand.getWorldPosition(r.grip);
    if (r.aimed) r.dir.copy(r.aim);
    else r.dir.copy(r.axis).applyQuaternion(r.hand.getWorldQuaternion(_q)).normalize();
    r.base.copy(r.grip).addScaledVector(r.dir, HILT.emitter);
    const tip = _v.copy(r.dir).multiplyScalar(BLADE.length * reach(r.k)).add(r.base);
    const tr = r.trail;
    // a blade put somewhere new (a teleport, a cut in the story) starts its trail afresh
    if (tr.n) {
      const j = ((tr.head + N.trail - 1) % N.trail) * 3;
      if (Math.hypot(tip.x - tr.tip[j], tip.y - tr.tip[j + 1], tip.z - tr.tip[j + 2]) > TRAIL.jump) tr.n = 0;
    }
    tr.n = Math.min(N.trail, tr.n + 1);
    const i = tr.head;
    put3(tr.base, i, r.base.x, r.base.y, r.base.z);
    put3(tr.tip, i, tip.x, tip.y, tip.z);
    tr.t[i] = clock + step;
    tr.k[i] = r.k;
    tr.head = (i + 1) % N.trail;
  }

  // ── the effects ──

  function addBit(kind, at, v, from, to, band, life, delay, colour) {
    const i = bitSlots.take();
    bits.kind[i] = kind;
    put3(bits.p, i, at.x, at.y, at.z);
    put3(bits.v, i, v.x, v.y, v.z);
    put3(bits.colour, i, colour[0], colour[1], colour[2]);
    bits.from[i] = from;
    bits.to[i] = to;
    bits.band[i] = band;
    bits.t[i] = 0;
    bits.life[i] = life;
    bits.delay[i] = delay;
  }

  function throwSparks(at, n, dir) {
    for (let k = 0; k < n; k++) {
      // anywhere, leaning up, or (a turned bolt) mostly back along its new way
      _a.set(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1).normalize();
      if (dir) _a.multiplyScalar(0.6).add(_b.set(dir.x, dir.y, dir.z).normalize());
      else _a.y += 0.5;
      addBit(SPARK, at, _a.normalize().multiplyScalar(2 + rand() * 4), 0, 0, 0, 0.2 + rand() * 0.4, 0, HOT);
    }
  }

  // the arcs drawn anew: from each hand to somewhere on the body it burns
  function strike() {
    bolt.n = 0;
    for (let h = 0; h < bolt.hands; h++) {
      _end.set(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1).multiplyScalar(ARC.reach).add(_a.fromArray(bolt.to));
      bolt.n += arcPath(_hand.fromArray(bolt.from, h * 3), _end, rand, arcOpts, bolt.segs, bolt.n);
    }
    bolt.wait = 1 / ARC.rate;
    bolt.since = 0;
  }

  // ── drawing, once a frame ──

  function drawBlades() {
    let nb = 0;
    let nh = 0;
    for (const r of slots) {
      if (!r?.placed) continue;
      _q.setFromUnitVectors(UP, r.dir);
      hilts.setMatrixAt(nh++, _m.compose(r.grip, _q, _s.setScalar(1)));
      const long = BLADE.length * reach(r.k);
      r.lamp.intensity = 0;
      if (long < 1e-3) continue;
      const h = hum(clock, r.seed);
      const { core, glow } = r.hue;
      cores.setMatrixAt(nb, _m.compose(r.base, _q, _s.set(1, long, 1)));
      cores.setColorAt(nb++, _c.setRGB(core[0] * h, core[1] * h, core[2] * h));
      // a tight bright glow round the core, and a wide faint one
      const mid = _a.copy(r.dir).multiplyScalar(long / 2).add(r.base);
      const { x, y, z } = r.dir;
      sprite(mid.x, mid.y, mid.z, x, y, z, long / 2, BLADE.inner * (0.96 + 0.04 * h), 0, glow[0] * 0.85 * h, glow[1] * 0.85 * h, glow[2] * 0.85 * h);
      sprite(mid.x, mid.y, mid.z, x, y, z, long / 2, BLADE.outer * (0.96 + 0.04 * h), 0, glow[0] * 0.3 * h, glow[1] * 0.3 * h, glow[2] * 0.3 * h);
      place(r.lamp, mid.x, mid.y, mid.z, LAMP.blade * r.k * h);
    }
    hilts.count = nh;
    hilts.visible = nh > 0;
    cores.count = nb;
    cores.visible = nb > 0;
    hilts.instanceMatrix.needsUpdate = true;
    cores.instanceMatrix.needsUpdate = true;
    cores.instanceColor.needsUpdate = true;
  }

  function drawTrails() {
    let nq = 0;
    const tp = tPos.array;
    const tc = tColour.array;
    for (const r of slots) {
      if (!r?.placed) continue;
      const { base, tip, t, k, n, head } = r.trail;
      for (let s = n - 1; s > 0; s--) {
        const i = (head + N.trail - 1 - s) % N.trail; // the older of the two
        const j = (i + 1) % N.trail;
        if (!(t[j] > t[i])) continue;
        const i3 = i * 3;
        const j3 = j * 3;
        const speed = Math.hypot(tip[j3] - tip[i3], tip[j3 + 1] - tip[i3 + 1], tip[j3 + 2] - tip[i3 + 2]) / (t[j] - t[i]);
        const li = trailLevel(clock - t[i], speed) * k[i] * TRAIL.bright;
        const lj = trailLevel(clock - t[j], speed) * k[j] * TRAIL.bright;
        if (li <= 0 && lj <= 0) continue;
        const o = nq++ * 12;
        for (let a = 0; a < 3; a++) {
          tp[o + a] = base[i3 + a];
          tp[o + 3 + a] = tip[i3 + a];
          tp[o + 6 + a] = tip[j3 + a];
          tp[o + 9 + a] = base[j3 + a];
          tc[o + a] = tc[o + 3 + a] = r.hue.glow[a] * li;
          tc[o + 6 + a] = tc[o + 9 + a] = r.hue.glow[a] * lj;
        }
      }
    }
    trailGeo.setDrawRange(0, nq * 6);
    trails.visible = nq > 0;
    tPos.needsUpdate = true;
    tColour.needsUpdate = true;
  }

  function drawLightning(step) {
    bolt.wait = Math.max(-1, bolt.wait - step);
    bolt.since += step;
    if (bolt.on && bolt.wait <= 0) strike();
    bolt.level = bolt.on ? 1 : Math.max(0, bolt.level - step / ARC.fade);
    arcLamp.intensity = 0;
    if (bolt.level <= 0) return;
    // brightest as it is struck anew, settling till the next
    const crackle = bolt.level * (0.55 + 0.45 * Math.exp(-bolt.since * 20));
    const s = bolt.segs;
    for (let k = 0; k < bolt.n; k++) {
      const j = k * SEG;
      const dx = s[j + 3] - s[j];
      const dy = s[j + 4] - s[j + 1];
      const dz = s[j + 5] - s[j + 2];
      const l = Math.hypot(dx, dy, dz) || 1e-6;
      const a = crackle * s[j + 6];
      const thin = 0.5 + 0.5 * s[j + 6]; // a branch is thinner
      sprite(s[j] + dx / 2, s[j + 1] + dy / 2, s[j + 2] + dz / 2, dx / l, dy / l, dz / l, l / 2, ARC.r * thin, 0, ARC.core[0] * a, ARC.core[1] * a, ARC.core[2] * a);
      sprite(s[j] + dx / 2, s[j + 1] + dy / 2, s[j + 2] + dz / 2, dx / l, dy / l, dz / l, l / 2, ARC.halo * thin, 0, ARC.glow[0] * a, ARC.glow[1] * a, ARC.glow[2] * a);
    }
    place(arcLamp, (bolt.from[0] + bolt.to[0]) / 2, (bolt.from[1] + bolt.to[1]) / 2, (bolt.from[2] + bolt.to[2]) / 2, LAMP.arc * crackle);
  }

  // the bits: sparks thrown, falling, dragged, streaked along their way and cooling; a flash gone in a
  // blink; a push’s rings out along it, swelling and thinning; a grip’s tightening at the throat as it rises
  function drawBits(step) {
    grip.wait = Math.max(-1, grip.wait - step);
    if (grip.on && grip.wait <= 0) {
      const c = RIPPLE.choke;
      addBit(GRIPPED, grip.at, NONE, c.from, c.to, c.band, c.life, 0, RIPPLE.colour);
      grip.wait = c.every;
    }
    const drag = Math.exp(-1.5 * step);
    const { p, v, colour, kind } = bits;
    for (let i = 0; i < N.bits; i++) {
      if (!bitSlots.used(i)) continue;
      bits.t[i] += step;
      const t = bits.t[i] - bits.delay[i];
      const k = t / bits.life[i];
      if (k >= 1) {
        bitSlots.release(i);
        continue;
      }
      if (t < 0) continue;
      const j = i * 3;
      if (kind[i] === SPARK) {
        v[j] *= drag;
        v[j + 1] = v[j + 1] * drag - GRAVITY * step;
        v[j + 2] *= drag;
      }
      if (kind[i] === GRIPPED) put3(p, i, grip.at.x, grip.at.y, grip.at.z);
      else for (let a = 0; a < 3; a++) p[j + a] += v[j + a] * step;
      if (kind[i] === SPARK) {
        const speed = Math.hypot(v[j], v[j + 1], v[j + 2]) || 1;
        const fade = 1 - k * k;
        sprite(p[j], p[j + 1], p[j + 2], v[j] / speed, v[j + 1] / speed, v[j + 2] / speed, Math.min(0.08, speed * 0.012), 0.012, 0, (HOT[0] + (COOL[0] - HOT[0]) * k) * fade, (HOT[1] + (COOL[1] - HOT[1]) * k) * fade, (HOT[2] + (COOL[2] - HOT[2]) * k) * fade);
        continue;
      }
      const level = kind[i] === FLASHED ? (1 - k) ** 2 : Math.sin(Math.PI * Math.min(1, k * 1.2)) * (1 - k);
      const radius = bits.from[i] + (bits.to[i] - bits.from[i]) * (1 - (1 - k) ** 2);
      sprite(p[j], p[j + 1], p[j + 2], 0, 0, 0, 0, radius, bits.band[i], colour[j] * level, colour[j + 1] * level, colour[j + 2] * level);
    }
  }

  const count = (...kinds) => {
    let c = 0;
    for (let i = 0; i < N.bits; i++) if (bitSlots.used(i) && kinds.includes(bits.kind[i])) c++;
    return c;
  };

  return {
    meshes: [hilts, cores, trails, sprites],

    blade(id, colour) {
      const had = records.get(id);
      if (had) {
        if (had.colour !== colour) {
          had.colour = colour;
          had.hue = bladeHues(colour);
          had.lamp.color = had.hue.light;
        }
        return had.handle;
      }
      let slot = slots.indexOf(null);
      if (slot < 0) {
        // the pool is full: the blade longest kept goes, an unlit one before a lit one
        let worst = null;
        for (const r of slots) if (!worst || (r.lit === worst.lit ? r.born < worst.born : !r.lit)) worst = r;
        worst.handle.release();
        slot = worst.slot;
      }
      const r = makeBlade(id, colour, slot);
      slots[slot] = r;
      records.set(id, r);
      return r.handle;
    },

    clash(at, kind = 'block', dir = null) {
      const c = CLASHES[kind] ?? CLASHES.block;
      throwSparks(at, c.sparks, dir);
      addBit(FLASHED, at, NONE, c.flash, c.flash * 0.6, 0, BLINK, 0, c.colour ?? FLASH);
    },

    lightning(from, to, on = true) {
      const hands = Array.isArray(from) ? from : from ? [from] : [];
      const was = bolt.on ? bolt.hands : 0;
      bolt.on = !!on && hands.length > 0 && !!to;
      if (!bolt.on) return;
      bolt.hands = Math.min(HANDS, hands.length);
      for (let h = 0; h < bolt.hands; h++) put3(bolt.from, h, hands[h].x, hands[h].y, hands[h].z);
      put3(bolt.to, 0, to.x, to.y, to.z);
      // struck at once when it starts or a hand joins or drops, not at the next redraw
      if (was !== bolt.hands) bolt.wait = 0;
    },

    push(at, dir) {
      const p = RIPPLE.push;
      _b.set(dir?.x ?? 0, dir?.y ?? 0, dir?.z ?? 0);
      if (_b.lengthSq() < 1e-12) _b.set(0, 0, -1);
      _b.normalize();
      _a.set(at.x, at.y, at.z).addScaledVector(_b, 0.3);
      _s.copy(_b).multiplyScalar(p.speed);
      for (let k = 0; k < p.rings; k++) addBit(PUSHED, _a, _s, p.from, p.to, p.band, p.life, k * p.gap, RIPPLE.colour);
    },

    choke(throat, on = true) {
      grip.on = !!on && !!throat;
      if (grip.on) grip.at.set(throat.x, throat.y, throat.z);
    },

    update(dt) {
      const step = Math.max(0, dt || 0);
      for (const r of slots) {
        if (!r) continue;
        if (!r.ticked) tick(r, step);
        r.ticked = false;
      }
      clock += step;
      ns = 0;
      drawBlades();
      drawTrails();
      drawLightning(step);
      drawBits(step);
      spriteGeo.instanceCount = ns;
      sprites.visible = ns > 0;
      for (const a of [sAt, sDir, sSize, sColour]) a.needsUpdate = true;
    },

    lamps() {
      lit.length = 0;
      for (const r of slots) if (r?.placed && r.lamp.intensity > 0) lit.push(r.lamp);
      if (arcLamp.intensity > 0) lit.push(arcLamp);
      return lit;
    },

    // every shader the sabers use made now, not at the first stroke (the
    // pools are hidden while empty; precompile takes hidden ones too)
    warm(renderer, camera, target) {
      return precompile(renderer, group, camera, scene, target);
    },

    live() {
      let blades = 0;
      for (const r of slots) if (r?.placed && r.k > 0) blades++;
      return { blades, trails: trailGeo.drawRange.count / 6, sparks: count(SPARK), flashes: count(FLASHED), arcs: bolt.level > 0 ? bolt.n : 0, ripples: count(PUSHED, GRIPPED) };
    },

    dispose() {
      group.removeFromParent();
      hilts.dispose();
      cores.dispose();
      for (const g of [hiltGeo, coreGeo, trailGeo, spriteGeo]) g.dispose();
      for (const m of [hiltMat, coreMat, trailMat, spriteMat]) m.dispose();
      records.clear();
      slots.fill(null);
    },
  };
}

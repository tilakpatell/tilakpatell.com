// What the station’s windows show: the stars and the faint band of the
// galaxy, a planet sunlit at its true apparent size (Alderaan from the
// overbridge, Yavin with Yavin 4 beside it, Endor’s forest moon with its gas
// giant), the battle of Endor out of the Emperor’s window, and the station’s
// own exterior for the arrival and the escape. A room puts a view’s `object`
// at its window, −z looking out.
//
// The sky (stars, band, sun, planets) is pinned round the eye and drawn on
// the far plane after the room: it never shifts as you walk past a window,
// the walls hide it before it is shaded, and ships always pass in front of
// it. Its bodies are drawn 1 km out, each as big as its true size and
// distance make it look, painted by ../../planetPaint.js at the device’s
// size, once a page. Ships and stations are things out beyond the window,
// loaded by URL (lib/three/gltf.js): the fleet from the galaxy’s far-off cuts
// of its models (scripts/galaxy-lod.mjs: one piece each, the look baked into
// vertex colours), so a kind is one instanced draw however many fly; the
// stations whole, the 4096-texel cut on the strongest graphics. All of it is
// lit by the view’s own sun in its shaders (a light in the scene would light
// the room through its walls, and recompile all of it) and kept out of the
// room’s house look. A view keeps to about 30 draws. The battle is stateless:
// where every fighter, bolt and flash is comes from the time, round a loop.
// The shaders are TSL (./nodes/sky.js, the node renderer’s); the GLSL they
// were is ./glsl/sky.js, for the parity check.
//
//   VIEW_KINDS: 'space' 'alderaan' 'yavin' 'endor' 'endor-battle' 'ds1-exterior' 'ds2-exterior'
//   angleOf(radius, distance) → degrees a sphere spans;  apparent(size, distance, at) → its size drawn at `at`
//   skyPlan(kind) → { sun, bodies: [{ id, paint, look, radius, distance, position, r, order, … }], station }
//   exteriorUrl(station, level) → the station’s model at a detail level (lib/detail);  paintSize(level) → { w, h }
//   BATTLE: { loop, gone, grow, … };  battlePlan(level) → { loop, capitals, fighters, shots, blasts, far }
//   fighterPose(fighter, t) → { x, y, z, dx, dy, dz, show }   show 0…1: gone after it is shot down, then back
//   boltAt(plan, shot, t) → null | { x, y, z, dx, dy, dz, length, width, life, hue }
//   crossed(at, t0, t1, loop) → whether a moment `at` into the loop fell in (t0, t1]
//   createView(kind, { renderer, tier, load, paint }) → { object, ready, update(t, dt), dispose() }
//     ready settles once its models are in (or failed); `load` (loadGltf) and `paint` (planetPaint’s) a test hands in

import * as THREE from 'three';
import { detailLevel, seg } from '../../../../lib/detail';
import { seeded } from '../../../../lib/seeded';
import { createExplosions } from '../../../../lib/three/explosionsNodes';
import { loadGltf } from '../../../../lib/three/gltf';
import { sharpen } from '../../../../lib/three/textures';
import { paintGiant, paintPlanet } from '../../planetPaint';
import { bandMaterial, bodyMaterial, flashMaterial, haloMaterial, skyUniforms, starsMesh, sunMaterial, sunlit } from './nodes/sky';

export const VIEW_KINDS = ['space', 'alderaan', 'yavin', 'endor', 'endor-battle', 'ds1-exterior', 'ds2-exterior'];

const FAR = 1000; // metres out the sky’s bodies are drawn (only their angle shows: they sit on the far plane)
const LEVELS = ['low', 'mid', 'high', 'ultra'];
const deg = (r) => (r * 180) / Math.PI;
const rad = (d) => (d * Math.PI) / 180;
const mod = (x, m) => ((x % m) + m) % m;
const scale = (v, k) => [v[0] * k, v[1] * k, v[2] * k];
const unit = (v) => scale(v, 1 / (Math.hypot(v[0], v[1], v[2]) || 1));
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
// a direction `az` degrees right of straight out (−z) and `el` up
const toward = (az, el) => [Math.sin(rad(az)) * Math.cos(rad(el)), Math.sin(rad(el)), -Math.cos(rad(az)) * Math.cos(rad(el))];
// a nose turned `yaw` degrees right of −z and `pitch` up (the station’s convention)
const heading = (yaw, pitch = 0) => [Math.sin(rad(yaw)) * Math.cos(rad(pitch)), Math.sin(rad(pitch)), -Math.cos(rad(yaw)) * Math.cos(rad(pitch))];

export const angleOf = (radius, distance) => deg(2 * Math.asin(Math.min(1, radius / distance)));
export const apparent = (size, distance, at) => (at * size) / distance;

// ── the skies ──

// Sizes and distances in km; only their ratio counts. Alderaan (12,500 km
// across) from where the superlaser fires; Yavin (200,000 km) with Yavin 4
// (10,200 km) nearer and to one side, as the station rounds the giant; the
// forest moon (4,900 km) close under the second station, its giant far off;
// the stations (120 and 160 km across) from a ship coming in.
const FOREST = { id: 'forest-moon', paint: 'planet', look: 'endor', radius: 2450, tilt: 0.2, spin: 0.004, air: [0.45, 0.7, 1] };
const SIGHTS = {
  space: { sun: [0.62, 0.3, -0.72], bodies: [] },
  alderaan: { sun: [0.78, 0.32, 0.54], bodies: [{ id: 'alderaan', paint: 'planet', look: 'alderaan', radius: 6250, distance: 25000, dir: [0.1, -0.06, -1], tilt: 0.4, spin: 0.003, air: [0.5, 0.68, 1] }] },
  yavin: {
    sun: [-0.62, 0.36, 0.7],
    bodies: [
      { id: 'yavin', paint: 'giant', look: 'yavin', radius: 100000, distance: 600000, dir: [-0.32, 0.12, -1], tilt: 0.12, spin: 0.002, air: [1, 0.72, 0.45] },
      { id: 'yavin-4', paint: 'planet', look: 'yavin', radius: 5100, distance: 120000, dir: [0.2, -0.1, -1], tilt: 0.3, spin: 0.004, air: [0.55, 0.85, 0.7] },
    ],
  },
  endor: {
    sun: [0.66, 0.44, 0.6],
    bodies: [{ id: 'endor', paint: 'giant', look: 'endor', radius: 70000, distance: 800000, dir: [0.5, 0.3, -1], tilt: -0.2, spin: 0.002, air: [0.72, 0.82, 0.85] }, { ...FOREST, distance: 7450, dir: [-0.22, -0.3, -1] }],
  },
  'endor-battle': { sun: [0.82, 0.3, 0.48], bodies: [{ ...FOREST, distance: 7450, dir: [-0.66, -0.52, -1] }] },
  'ds1-exterior': { sun: [-0.75, 0.4, 0.55], bodies: [], station: { id: 'ds1', radius: 60, distance: 250, dir: [0.08, 0.04, -1], at: 1200, turn: [0.12, -0.6, 0] } },
  'ds2-exterior': { sun: [0.8, 0.38, 0.45], bodies: [{ ...FOREST, distance: 5300, dir: [-0.62, -0.42, -1] }], station: { id: 'ds2', radius: 80, distance: 300, dir: [0.06, 0.08, -1], at: 1250, turn: [0.1, 0.5, 0] } },
};

export function skyPlan(kind) {
  const s = SIGHTS[kind] ?? SIGHTS.space;
  // (the farthest drawn first, so a nearer one covers it)
  const far = [...s.bodies].sort((a, b) => b.distance - a.distance);
  const bodies = s.bodies.map((b) => ({ ...b, position: scale(unit(b.dir), FAR), r: apparent(b.radius, b.distance, FAR), order: far.indexOf(b) }));
  const st = s.station;
  const station = st ? { ...st, position: scale(unit(st.dir), st.at), r: apparent(st.radius, st.distance, st.at) } : null;
  return { sun: unit(s.sun), bodies, station };
}

const EXTERIOR = {
  ds1: ['/models/universe/death-star.glb', '/models/universe/death-star.hq.glb'],
  ds2: ['/models/galaxy/deathstar2.glb', '/models/galaxy/deathstar2.hq.glb'],
};
export const exteriorUrl = (station, level) => EXTERIOR[station]?.[level === 'ultra' ? 1 : 0] ?? null;

// (a 1024 × 512 planet takes most of a second to paint, all of it on the
// main thread, so the strongest graphics get no more than a desktop does)
const PAINT = { low: 256, mid: 512, high: 1024, ultra: 1024 };
export const paintSize = (level) => {
  const w = PAINT[level] ?? PAINT.high;
  return { w, h: w / 2 };
};

// ── the battle of Endor ──

export const BATTLE = {
  loop: 40, // seconds before it all comes round again
  gone: 6, // a fighter shot down is missing this long,
  grow: 0.6, // then another comes in over this
  fighterBolt: { speed: 300, life: 0.9, length: 6, width: 0.25 },
  capitalBolt: { speed: 620, length: 0.028, width: 0.0012 }, // length and width per metre out, so they look alike near and far
  pairs: { low: 3, mid: 5, high: 8, ultra: 10 }, // dogfights: a fighter and the one on its tail
};
const W = (2 * Math.PI) / BATTLE.loop;
const LENGTH = { moncal: 1.2, destroyer: 1.6, executor: 19, xwing: 0.0125, tie: 0.0063 }; // km
// The fleets close in, as the films show them from the throne room: the
// Rebels’ cruisers broadside on, making for the Empire’s line; the Executor
// over all. `d`: km away (a nearer one drawn nearer), `at`: metres out drawn.
const FLEET = [
  { model: 'moncal', side: 'rebel', az: -12, el: -4, d: 7, at: 620, yaw: 64, pitch: 3 },
  { model: 'moncal', side: 'rebel', az: 19, el: 4, d: 10, at: 700, yaw: 78, pitch: -2 },
  { model: 'moncal', side: 'rebel', az: -28, el: 10, d: 13, at: 770, yaw: 56, pitch: 4 },
  { model: 'destroyer', side: 'empire', az: 27, el: 11, d: 14, at: 800, yaw: -118, pitch: -3 },
  { model: 'moncal', side: 'rebel', az: 6, el: -14, d: 16, at: 850, yaw: 70, pitch: 0 },
  { model: 'destroyer', side: 'empire', az: -4, el: 16, d: 18, at: 900, yaw: -104, pitch: 2 },
  { model: 'destroyer', side: 'empire', az: 35, el: -4, d: 22, at: 980, yaw: -126, pitch: 0 },
  { model: 'destroyer', side: 'empire', az: -20, el: 20, d: 26, at: 1060, yaw: -112, pitch: -4 },
  { model: 'executor', side: 'empire', az: 10, el: 23, d: 70, at: 1300, yaw: -98, pitch: -2 },
];

// a fighter shot down is gone a while, then another grows in out of the dark
const showAt = (f, t) => (f.down == null ? 1 : Math.min(1, Math.max(0, (mod(t - f.down, BATTLE.loop) - BATTLE.gone) / BATTLE.grow)));

export function fighterPose(f, t) {
  const u = t - f.lag;
  const th = f.k * W * u + f.ph;
  const sway = f.k2 * W * u + f.ph2;
  const c = Math.cos(th);
  const s = Math.sin(th);
  const p = add(add(f.c, add(scale(f.e1, f.a * c), scale(f.e2, f.a * s))), scale(f.n, f.b * Math.sin(sway)));
  // (round the circle at a steady pace, swaying across it: never slower than the circle’s)
  const v = unit(add(scale(add(scale(f.e1, -s), scale(f.e2, c)), f.a * f.k * W), scale(f.n, f.b * f.k2 * W * Math.cos(sway))));
  return { x: p[0], y: p[1], z: p[2], dx: v[0], dy: v[1], dz: v[2], show: showAt(f, t) };
}

const capitalAt = (c, along, up = 0) => add(add(c.position, scale(c.nose, along * c.length)), [0, up * c.length, 0]);

// Where a shot starts, where it is aimed, and how long it flies.
function shotPath(plan, s) {
  if (s.kind === 'capital') {
    const from = capitalAt(plan.capitals[s.from], s.gun, 0.06);
    const to = capitalAt(plan.capitals[s.target], s.hit, s.rise);
    const b = BATTLE.capitalBolt;
    const out = Math.hypot(...from);
    return { from, to, life: Math.hypot(...sub(to, from)) / b.speed, speed: b.speed, length: b.length * out, width: b.width * out };
  }
  const a = fighterPose(plan.fighters[s.from], s.at);
  const q = fighterPose(plan.fighters[s.target], s.at + 0.25);
  const nose = [a.dx, a.dy, a.dz];
  const from = add([a.x, a.y, a.z], scale(nose, 4));
  const b = BATTLE.fighterBolt;
  return { from, to: add([q.x, q.y, q.z], s.miss), life: b.life, speed: b.speed, length: b.length, width: b.width };
}

export function boltAt(plan, s, t) {
  const age = mod(t - s.at, plan.loop);
  const path = shotPath(plan, s);
  if (age > path.life) return null;
  const d = unit(sub(path.to, path.from));
  const p = add(path.from, scale(d, path.speed * age));
  return { x: p[0], y: p[1], z: p[2], dx: d[0], dy: d[1], dz: d[2], length: path.length, width: path.width, life: path.life, hue: s.side === 'rebel' ? 'red' : 'green' };
}

export function crossed(at, t0, t1, loop) {
  // (the time from t0 to the moment’s next turn, a whole loop if it is t0 itself)
  const next = mod(at - t0, loop) || loop;
  return next <= t1 - t0;
}

export function battlePlan(level) {
  const rand = seeded(1983);
  const r = (a, b) => a + rand() * (b - a);
  const capitals = FLEET.map((f) => ({ model: f.model, side: f.side, position: scale(toward(f.az, f.el), f.at), nose: heading(f.yaw, f.pitch), length: apparent(LENGTH[f.model], f.d, f.at) }));
  const fighters = [];
  const pairs = BATTLE.pairs[level] ?? BATTLE.pairs.high;
  for (let i = 0; i < pairs; i++) {
    // a circle in a tilted plane, out beyond the window, swaying across it
    const n = unit([r(-0.6, 0.6), 1, r(-0.6, 0.6)]);
    const e1 = unit(cross(n, [0.3, 0, 1]));
    const path = { c: scale(toward(r(-26, 26), r(-14, 14)), r(240, 380)), n, e1, e2: cross(n, e1), a: r(60, 110), b: r(10, 30), k: 3 + Math.floor(rand() * 4), k2: 1 + Math.floor(rand() * 3), ph: r(0, 6.28), ph2: r(0, 6.28) };
    const [lead, chase] = i % 2 ? ['tie', 'xwing'] : ['xwing', 'tie'];
    const side = (m) => (m === 'xwing' ? 'rebel' : 'empire');
    // (two dogfights in three end with the quarry shot down)
    const down = i % 3 === 2 ? null : Number(r(3, BATTLE.loop - 3).toFixed(2));
    fighters.push({ ...path, model: lead, side: side(lead), length: LENGTH[lead] * 1000, lag: 0, chases: -1, down });
    fighters.push({ ...path, model: chase, side: side(chase), length: LENGTH[chase] * 1000, lag: r(0.7, 1.2), chases: fighters.length - 1, down: null });
  }
  const shots = [];
  const blasts = [];
  // the dogfights: bursts of two from the one behind, the last of them as the quarry goes
  fighters.forEach((f, i) => {
    if (f.chases < 0) return;
    const quarry = fighters[f.chases];
    const gap = r(2.4, 3.6);
    const times = [];
    for (let t = r(0, gap); t < BATTLE.loop - 0.5; t += gap) times.push(t);
    if (quarry.down != null) times.push(quarry.down - 0.32);
    for (const t0 of times) {
      for (const t of [t0, t0 + 0.14]) {
        const at = mod(t, BATTLE.loop);
        if (showAt(quarry, at) < 1) continue; // (nothing fires at a gap where a fighter was)
        shots.push({ kind: 'fighter', from: i, target: f.chases, side: f.side, at: Number(at.toFixed(3)), miss: [r(-3, 3), r(-3, 3), r(-3, 3)] });
      }
    }
    if (quarry.down != null) blasts.push({ at: quarry.down, fighter: f.chases, size: 7 });
  });
  // the capital ships’ turbolasers, across at the other line; one hit in seven bursts on the hull
  capitals.forEach((c, i) => {
    const foes = capitals.map((o, j) => (o.side === c.side ? -1 : j)).filter((j) => j >= 0);
    const gap = r(0.9, 1.6);
    for (let t = r(0, gap); t < BATTLE.loop; t += gap) {
      const shot = { kind: 'capital', from: i, target: foes[Math.floor(rand() * foes.length)], side: c.side, at: Number(t.toFixed(3)), gun: r(-0.3, 0.3), hit: r(-0.35, 0.35), rise: r(-0.04, 0.08) };
      shots.push(shot);
      if (rand() < 1 / 7) blasts.push({ at: 0, shot: shots.length - 1, size: 0.07 * capitals[shot.target].length });
    }
  });
  // and farther off, the rest of the battle: flashes out past the fleets
  const far = Array.from({ length: 14 }, () => ({ at: Number(r(0, BATTLE.loop).toFixed(2)), position: scale(toward(r(-40, 40), r(-20, 28)), r(1450, 1650)), size: r(14, 30) }));
  const plan = { loop: BATTLE.loop, capitals, fighters, shots, blasts, far };
  // (a hull’s burst comes as its bolt strikes)
  for (const b of blasts) if (b.shot != null) b.at = Number(mod(shots[b.shot].at + shotPath(plan, shots[b.shot]).life, BATTLE.loop).toFixed(3));
  return plan;
}

// ── drawing ──

const SUN = [3.1, 2.95, 2.75]; // about π times white: what three’s Lambert takes to show a face square to it its own colour
const STARS = { low: 1200, mid: 2000, high: 3200, ultra: 4800 };
const POLE = unit([0.35, 0.8, 0.45]); // the galaxy’s pole, so its band runs aslant across a window
// (after the room’s own opaque things, so its walls hide the sky before it is shaded)
const ORDER = { stars: 900, band: 901, sun: 902, body: 910 };
const PAINTERS = { planet: paintPlanet, giant: paintGiant };
const FLEET_URLS = { moncal: '/models/galaxy/lod/moncal.glb', destroyer: '/models/galaxy/lod/destroyer.glb', executor: '/models/galaxy/lod/executor.glb', xwing: '/models/galaxy/lod/xwing.glb', tie: '/models/galaxy/lod/tie.glb' };
const NOSE = { destroyer: Math.PI }; // the turn that brings a model’s nose to +z (the rest come that way)
const ENGINE = { moncal: [0.3, 0.7, 2], destroyer: [0.55, 0.8, 1.8], executor: [0.55, 0.75, 1.8], xwing: [2.6, 0.75, 0.5], tie: [1, 0.35, 0.3] };
const HUE = { rebel: { core: [4, 0.35, 0.25], flash: [3, 0.7, 0.4] }, empire: { core: [0.35, 4, 0.45], flash: [0.8, 3, 0.8] } };
const HIT = [3, 2.1, 1.2]; // a bolt striking a hull, whoever fired it
const POOL = { bolts: 64, flashes: 96 };
const UP = new THREE.Vector3(0, 1, 0);

const levelOf = (tier) => (tier === 'high' ? detailLevel() : LEVELS.includes(tier) ? tier : 'high');

// (drawn round the eye, not where it stands, so its bounds would cull it wrongly)
const farMesh = (geo, mat, order, name, Kind = THREE.Mesh) => Object.assign(new Kind(geo, mat), { renderOrder: order, frustumCulled: false, name });

// The stars: most faint, a few bright, a third crowding the galaxy’s band.
function makeStars(level, u, owned, renderer) {
  const rand = seeded(1977);
  const n = STARS[level] ?? STARS.high;
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const size = new Float32Array(n);
  const b1 = unit(cross(POLE, [0, 0, 1]));
  const b2 = cross(POLE, b1);
  for (let i = 0; i < n; i++) {
    let d;
    if (rand() < 0.35) {
      const a = rand() * Math.PI * 2;
      d = unit(add(add(scale(b1, Math.cos(a)), scale(b2, Math.sin(a))), scale(POLE, (rand() + rand() + rand() - 1.5) * 0.12)));
    } else {
      const z = rand() * 2 - 1;
      const a = rand() * Math.PI * 2;
      const k = Math.sqrt(1 - z * z);
      d = [k * Math.cos(a), z, k * Math.sin(a)];
    }
    pos.set(scale(d, FAR), i * 3);
    const k = 0.18 + rand() ** 4 * 1.4;
    const tint = rand();
    col.set(tint < 0.15 ? [k, k * 0.82, k * 0.62] : tint < 0.3 ? [k * 0.78, k * 0.88, k] : [k, k, k], i * 3);
    size[i] = 1.3 + k * 1.5;
  }
  const stars = starsMesh(pos, col, size, u, renderer?.getPixelRatio?.() ?? 1);
  owned.push(stars.geometry, stars.material);
  return Object.assign(stars, { renderOrder: ORDER.stars, frustumCulled: false, name: 'stars' });
}

function makeBand(u, owned) {
  const geo = new THREE.SphereGeometry(FAR, 48, 24);
  const mat = bandMaterial(u, POLE);
  owned.push(geo, mat);
  return farMesh(geo, mat, ORDER.band, 'galaxy');
}

function makeSun(dir, u, owned) {
  const geo = new THREE.PlaneGeometry(2, 2);
  const mat = sunMaterial(u, FAR * Math.tan(rad(12)));
  owned.push(geo, mat);
  const mesh = farMesh(geo, mat, ORDER.sun, 'sun');
  mesh.position.set(...scale(dir, FAR));
  return mesh;
}

// A planet’s or a gas giant’s maps, painted once a page for each size (and
// each painter: a test hands in its own).
const painted = new WeakMap();
function mapsOf(body, size, paint) {
  const painter = paint[body.paint];
  const done = painted.get(painter) ?? painted.set(painter, new Map()).get(painter);
  const key = `${body.look}:${size.w}`;
  if (!done.has(key)) done.set(key, body.paint === 'giant' ? { color: painter(body.look, size) } : painter(body.look, size));
  return done.get(key);
}

function makeBody(body, level, u, { renderer, paint, owned }) {
  const maps = mapsOf(body, paintSize(level), paint);
  const tex = (canvas, color) => {
    owned.push(sharpen(new THREE.CanvasTexture(canvas), { renderer, color }));
    return owned.at(-1);
  };
  const giant = body.paint === 'giant';
  const map = tex(maps.color, true);
  const relief = giant ? {} : { normal: tex(maps.normal, false), rough: tex(maps.rough, false), clouds: maps.clouds ? tex(maps.clouds, true) : null };
  // (64 round at high: a 40° disc’s edge is then within half a pixel of round)
  const segs = seg(64, { level });
  const geo = new THREE.SphereGeometry(body.r, segs, Math.round(segs / 2));
  const mat = bodyMaterial(u, { air: body.air, map, giant, ...relief });
  const { uniforms } = mat;
  const mesh = farMesh(geo, mat, ORDER.body + body.order * 2, body.id);
  const haloGeo = new THREE.SphereGeometry(body.r * 1.06, segs, Math.round(segs / 3));
  // (the halo shares the body’s air)
  const haloMat = haloMaterial(u, { air: uniforms.uAir, r: body.r });
  const halo = farMesh(haloGeo, haloMat, ORDER.body + body.order * 2 + 1, `${body.id}:air`);
  owned.push(geo, mat, haloGeo, haloMat);
  // (turned on its tilted axis: the tilt applied last)
  mesh.rotation.order = 'ZYX';
  mesh.rotation.z = body.tilt;
  mesh.position.set(...body.position);
  halo.position.set(...body.position);
  return {
    meshes: [mesh, halo],
    update(t) {
      mesh.rotation.y = t * body.spin;
      uniforms.uDrift.value = t * body.spin * 0.2;
    },
  };
}

const _x = new THREE.Vector3();
const _y = new THREE.Vector3();
const _z = new THREE.Vector3();
const _s = new THREE.Vector3();
// A matrix that stands a thing at `pos`, its +z along `dir` and its +y as near `up` as that allows, scaled by `size` ([x, y, z]).
function orient(out, pos, dir, up, size) {
  _z.set(dir[0], dir[1], dir[2]).normalize();
  _x.crossVectors(up, _z);
  if (_x.lengthSq() < 1e-8) _x.set(1, 0, 0);
  _x.normalize();
  _y.crossVectors(_z, _x);
  return out.makeBasis(_x, _y, _z).scale(_s.set(size[0], size[1], size[2])).setPosition(pos[0], pos[1], pos[2]);
}

// A loaded ship’s one mesh, and the matrix that sits it centred, nose along
// +z and one metre long; each instance is then placed and scaled by its length.
function shipOf(root, kind) {
  const meshes = [];
  root.updateMatrixWorld(true);
  root.traverse((o) => o.isMesh && meshes.push(o));
  const mesh = meshes[0];
  if (!mesh) return null;
  const geo = mesh.geometry;
  // (the far-off cuts come without normals: scripts/galaxy-lod.mjs)
  if (!geo.attributes.normal) geo.computeVertexNormals();
  const box = new THREE.Box3().setFromBufferAttribute(geo.attributes.position).applyMatrix4(mesh.matrixWorld);
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  const k = 1 / Math.max(size.z, 1e-6);
  const base = new THREE.Matrix4().makeRotationY(NOSE[kind] ?? 0);
  base.multiply(new THREE.Matrix4().makeScale(k, k, k)).multiply(new THREE.Matrix4().makeTranslation(-centre.x, -centre.y, -centre.z)).multiply(mesh.matrixWorld);
  return { geo, base };
}

// The battle: the fleets (one instanced draw a kind), the bolts (one), every
// glow and flash (one) and the fireballs (lib/three/explosions: none on a
// weak device, where the flashes stand in for them), all from the time.
function makeBattle(group, plan, { level, load, renderer, u, owned, alive }) {
  const fleetMat = sunlit(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.1 }), u);
  const boltGeo = new THREE.BoxGeometry(1, 1, 1);
  const boltMat = new THREE.MeshBasicMaterial({ toneMapped: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const bolts = new THREE.InstancedMesh(boltGeo, boltMat, POOL.bolts);
  const flashGeo = new THREE.PlaneGeometry(2, 2);
  const flashMat = flashMaterial();
  const flashes = new THREE.InstancedMesh(flashGeo, flashMat, POOL.flashes);
  const c = new THREE.Color();
  bolts.name = 'bolts';
  flashes.name = 'flashes';
  for (const mesh of [bolts, flashes]) {
    mesh.setColorAt(0, c.setRGB(0, 0, 0)); // (made now, so the shader has its colours from the first frame)
    mesh.count = 0;
    mesh.frustumCulled = false;
    group.add(mesh);
  }
  const blasts = level === 'low' ? null : createExplosions({ parent: group, small: level === 'mid', pool: 4 });
  owned.push(fleetMat, boltGeo, boltMat, bolts, flashGeo, flashMat, flashes);
  if (blasts) owned.push(blasts);

  const fleet = {}; // kind → { mesh, base, caps, figs }
  const m = new THREE.Matrix4();
  const ready = Promise.all(
    Object.entries(FLEET_URLS).map(([kind, url]) =>
      Promise.resolve(load(url, { renderer }))
        .then((got) => {
          const ship = got && alive() ? shipOf(got.scene, kind) : null;
          if (!ship) return;
          const caps = plan.capitals.flatMap((s, i) => (s.model === kind ? [i] : []));
          const figs = plan.fighters.flatMap((s, i) => (s.model === kind ? [i] : []));
          const mesh = new THREE.InstancedMesh(ship.geo, fleetMat, caps.length + figs.length);
          mesh.name = `fleet:${kind}`;
          mesh.frustumCulled = false;
          // (the capital ships hold their places: set once)
          caps.forEach((i, k) => mesh.setMatrixAt(k, orient(m, plan.capitals[i].position, plan.capitals[i].nose, UP, [1, 1, 1].map(() => plan.capitals[i].length)).multiply(ship.base)));
          fleet[kind] = { mesh, base: ship.base, caps, figs };
          owned.push(mesh);
          group.add(mesh);
        })
        .catch(() => {}),
    ),
  );

  const at = new THREE.Vector3();
  const up = new THREE.Vector3();
  let nf = 0;
  const flash = (pos, size, colour) => {
    if (nf >= POOL.flashes || !(size > 0)) return;
    flashes.setMatrixAt(nf, m.makeScale(size, size, size).setPosition(pos[0], pos[1], pos[2]));
    flashes.setColorAt(nf, c.setRGB(colour[0], colour[1], colour[2]));
    nf++;
  };
  const pointOf = (p) => [p.x, p.y, p.z];
  const blastAt = (b) => (b.shot != null ? shotPath(plan, plan.shots[b.shot]).to : pointOf(fighterPose(plan.fighters[b.fighter], b.at)));

  return {
    ready,
    update(t, dt) {
      nf = 0;
      // the capital ships’ engines
      for (const s of plan.capitals) flash(capitalAt(s, -0.5), s.length * 0.05, ENGINE[s.model]);
      // the fighters, round their loops, banked into their turns, and their engines
      for (const kind of ['xwing', 'tie']) {
        const f = fleet[kind];
        f?.figs.forEach((i, k) => {
          const fighter = plan.fighters[i];
          const p = fighterPose(fighter, t);
          const pos = pointOf(p);
          const nose = [p.dx, p.dy, p.dz];
          up.set(...unit(add(fighter.n, scale(unit(sub(fighter.c, pos)), 0.9))));
          const size = fighter.length * p.show;
          f.mesh.setMatrixAt(f.caps.length + k, size > 0 ? orient(m, pos, nose, up, [size, size, size]).multiply(f.base) : m.makeScale(0, 0, 0));
          flash(add(pos, scale(nose, -fighter.length * 0.55)), (kind === 'xwing' ? 1.6 : 1) * p.show, ENGINE[kind]);
        });
        if (f) f.mesh.instanceMatrix.needsUpdate = true;
      }
      // the bolts in the air, the flash of each gun as it fires and of each hit on a hull
      let nb = 0;
      for (const s of plan.shots) {
        const age = mod(t - s.at, plan.loop);
        if (age > 2.5) continue; // (no bolt is in the air, nor its hit still glowing, this long after)
        const path = shotPath(plan, s);
        const hue = HUE[s.side];
        if (age <= path.life) {
          if (nb >= POOL.bolts) continue;
          const d = unit(sub(path.to, path.from));
          bolts.setMatrixAt(nb, orient(m, add(path.from, scale(d, path.speed * age)), d, UP, [path.width, path.width, path.length]));
          bolts.setColorAt(nb, c.setRGB(...hue.core));
          nb++;
          if (age < 0.08) flash(path.from, path.width * 5, hue.flash);
        } else if (s.kind === 'capital' && age < path.life + 0.3) {
          const k = 1 - (age - path.life) / 0.3;
          flash(path.to, path.width * 8 * (0.6 + k), scale(HIT, k));
        }
      }
      // what blows up: a white flash (all a weak device shows), and the fireball, as its moment passes
      for (const b of plan.blasts) {
        const age = mod(t - b.at, plan.loop);
        if (age > 0.9) continue;
        const pos = blastAt(b);
        const k = 1 - age / 0.9;
        flash(pos, b.size * (1.2 + age * 3), [4 * k, 2.6 * k, 1.2 * k]);
        if (blasts && dt < 1 && crossed(b.at, t - dt, t, plan.loop)) blasts.burst(at.set(...pos), b.size);
      }
      // and the rest of the battle, far off
      for (const f of plan.far) {
        const age = mod(t - f.at, plan.loop);
        if (age < 0.7) flash(f.position, f.size * (0.6 + age), scale([3, 2.4, 1.6], 1 - age / 0.7));
      }
      bolts.count = nb;
      flashes.count = nf;
      for (const mesh of [bolts, flashes]) {
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
      blasts?.update(dt);
    },
  };
}

// The station whole, the size it looks from a ship coming in, turned to show
// its dish, lit by the view’s sun.
function makeStation(group, st, { level, load, renderer, u, owned, alive }) {
  let holder = null;
  const ready = Promise.resolve(load(exteriorUrl(st.id, level), { renderer, fresh: true }))
    .then((got) => {
      if (!got || !alive()) return;
      const root = got.scene;
      const box = new THREE.Box3().setFromObject(root);
      const size = box.getSize(new THREE.Vector3());
      root.position.sub(box.getCenter(new THREE.Vector3()));
      root.traverse((o) => {
        if (!o.isMesh) return;
        const mats = [o.material].flat().map((mat) => sunlit(mat.clone(), u));
        owned.push(...mats);
        o.material = Array.isArray(o.material) ? mats : mats[0];
      });
      holder = new THREE.Group();
      holder.name = 'station';
      holder.add(root);
      holder.scale.setScalar((2 * st.r) / Math.max(size.x, size.y, size.z, 1e-6));
      holder.position.set(...st.position);
      holder.rotation.set(...st.turn);
      group.add(holder);
    })
    .catch(() => {});
  return {
    ready,
    update(t) {
      // (turning, slowly, as it does in every shot of it)
      if (holder) holder.rotation.y = st.turn[1] + t * 0.004;
    },
  };
}

export function createView(kind, { renderer = null, tier = 'high', load = loadGltf, paint = PAINTERS } = {}) {
  const known = VIEW_KINDS.includes(kind) ? kind : 'space';
  const level = levelOf(tier);
  const sky = skyPlan(known);
  const object = new THREE.Group();
  object.name = `view:${known}`;
  const owned = [];
  let dead = false;
  const alive = () => !dead;
  const sunLocal = new THREE.Vector3(...sky.sun);
  const u = skyUniforms(sunLocal, SUN);
  const deps = { level, load, renderer, paint, u, owned, alive };

  const stars = makeStars(level, u, owned, renderer);
  object.add(stars, makeBand(u, owned), makeSun(sky.sun, u, owned));
  const bodies = sky.bodies.map((b) => makeBody(b, level, u, deps));
  for (const b of bodies) object.add(...b.meshes);
  const battle = known === 'endor-battle' ? makeBattle(object, battlePlan(level), deps) : null;
  const station = sky.station ? makeStation(object, sky.station, deps) : null;

  // the sky pinned round the eye from where the window is, and the sun turned with the room
  const q = new THREE.Quaternion();
  const follow = () => {
    object.updateWorldMatrix(true, false);
    object.getWorldPosition(u.uOrigin.value);
    u.uSun.value.copy(sunLocal).applyQuaternion(object.getWorldQuaternion(q)).normalize();
  };
  follow();
  // (and again as the sky is drawn, its stars first, so it is right however a room calls update)
  stars.onBeforeRender = follow;

  return {
    object,
    ready: Promise.all([battle?.ready, station?.ready]).then(() => undefined),
    update(t, dt) {
      if (dead) return;
      follow();
      for (const b of bodies) b.update(t);
      battle?.update(t, dt);
      station?.update(t);
    },
    dispose() {
      if (dead) return;
      dead = true;
      object.removeFromParent();
      for (const o of owned) o.dispose();
      owned.length = 0;
    },
  };
}

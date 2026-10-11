// Debris, split as Chaos splits destruction (the GPU-first design's N5): a
// break (a crate, a wall section, a speeder) becomes the few pieces big
// enough to matter as Rapier hulls the player can walk into and shoot
// round, and the rest as one burst into effects.js's GPU pools that lands
// on last frame's depth (collide.js) and never reads back. breaks.js
// decides which is which and holds the live cap (64 hulls, a ragdoll's
// bodies counted too); a hull asleep 2 s leaves the engine and becomes a
// static instance (onStatic: the world's, or createDebrisMeshes' below),
// and its slot is free for the next break.
//
// The burst is one effect record, DEBRIS_FX (debrisDefs()), made from the
// game's own falling plaster on Hoth (FX_Arctic_Ceiling_FallingSnow's
// em_arctic_ceiling_debris: its sheet, colour, size and fade) with a
// break's spawn: one particle a burst, times the break's 200 to 2,000
// (effects.js's `burst`), thrown out of a sphere the break's size, under
// gravity, three seconds at most, colliding.
//
// A seed gives the same pieces in the same places (curves.js's rnd over a
// break's serial): Rapier steps them the same, so a seeded battle stays the
// same battle.
//
//   createDebris(effects, physics, { cap, seed = 1, sleepToStatic = 2,
//     onStatic(pose), density = 300, piecesPerMetre = 6 }) → {
//     break(at, size, velocity = [0, 0, 0], material = null, { pieces, mass, light }),
//       (light: the burst's glow while it runs, effects.js's `light`: an explosion's flash)
//     update(dt), hulls() → [{ body, size, points, material }], cap,
//     stats() → { breaks, hulls, statics, refused, bursts, particles }, dispose() }
//     pose: { position, quaternion, size, points, material }
//   createDebrisMeshes(scene, debris, { max = 512 }) → Promise<{ update(), statics(pose), dispose() }>
//     (the live hulls and the static ones as two InstancedMeshes, for a world
//     with no GPU scene of its own to put them in, and the fixture)
//   debrisDefs() → { [DEBRIS_FX]: the record } (effects.js's `defs`)

import { BREAK, createHullCap, splitBreak } from '../../physics/breaks.js';
import CEILING from '../../../data/bf2017/fx/FX_Arctic_Ceiling_FallingSnow.json';
import { rnd } from './curves.js';
import { loadThree } from '../light/three.js';

export const DEBRIS_FX = 'FX_Break_Debris';
const DENSITY = 300; // kg/m³ over a break's bounding cube: a crate, hollow (this lane's)
const PIECES_PER_METRE = 6; // pieces a break makes a metre of its size, at most 24 (this lane's)
const SCATTER = 1.5; // m/s a hull is thrown out of the break, at most (this lane's)
const BURST_LIFE = [1.8, 3]; // s: a burst's particles (the plan's: the lifetime bounds them)

const plaster = CEILING.emitters.find((e) => e.name.endsWith('em_arctic_ceiling_debris'));

export function debrisDefs() {
  const em = {
    ...plaster,
    name: 'site/debris/em_break_burst',
    maxCount: BREAK.burstMax,
    lifetime: { random: BURST_LIFE },
    duration: 0.05,
    loop: false,
    delay: 0,
    probability: undefined,
    maxSpawnDistance: null,
    nearby: null,
    collide: true,
    gravity: { g: 9.81, random: 0.1 },
    drag: 0.4,
    spawn: {
      ...plaster.spawn,
      rate: 0,
      burst: 1,
      speed: { random: [1, 7] },
      size: { random: [0.04, 0.16] },
      direction: { dir: [0, 1, 0], spread: 80 },
      position: { sphere: { radius: 0.5, inner: 0, zenith: [0, 180], scale: [1, 1, 1], center: [0, 0, 0] } },
    },
    _source: { look: `${CEILING.name}: ${plaster.name}`, spawn: 'this lane’s, for a break (docs/superpowers/plans/2026-10-11-gpu-first-laneN5-sim.md)' },
  };
  const variant = { emitters: [0], scale: 1, maxActive: 8, cull: 400 };
  return {
    [DEBRIS_FX]: {
      format: CEILING.format,
      name: DEBRIS_FX,
      cull: 400,
      maxActive: 8,
      probability: 1,
      nearby: null,
      autoStart: true,
      variants: { low: variant, mid: variant, high: variant, ultra: variant },
      emitters: [em],
      textures: CEILING.textures,
      _source: 'src/lib/three/particles/debris.js (a break’s burst on the game’s plaster)',
    },
  };
}

// a chunk's eight corners, each pushed in or out a little, as a hull's points
function chunk(size, seed, serial, k0) {
  const pts = new Float32Array(24);
  const h = [size / 2, (size * 0.6) / 2, (size * 0.8) / 2];
  for (let i = 0; i < 8; i++)
    for (let a = 0; a < 3; a++) pts[i * 3 + a] = (i >> a) & 1 ? h[a] * (0.7 + 0.3 * rnd(seed, serial, k0 + i * 3 + a)) : -h[a] * (0.7 + 0.3 * rnd(seed, serial, k0 + 24 + i * 3 + a));
  return pts;
}

// a turn drawn from three draws (Shoemake's uniform quaternion)
function turn(seed, serial, k) {
  const u1 = rnd(seed, serial, k);
  const u2 = rnd(seed, serial, k + 1) * Math.PI * 2;
  const u3 = rnd(seed, serial, k + 2) * Math.PI * 2;
  const a = Math.sqrt(1 - u1);
  const b = Math.sqrt(u1);
  return [a * Math.sin(u2), a * Math.cos(u2), b * Math.sin(u3), b * Math.cos(u3)];
}

const ok3 = (a) => Array.isArray(a) && a.length >= 3 && a.every(Number.isFinite);

export function createDebris(effects, physics, { cap = createHullCap(), seed = 1, sleepToStatic = BREAK.sleepToStatic, onStatic = null, density = DENSITY, piecesPerMetre = PIECES_PER_METRE } = {}) {
  const live = [];
  const stats = { breaks: 0, hulls: 0, statics: 0, refused: 0, bursts: 0, particles: 0 };
  let serial = 0;

  function piecesOf(size) {
    return Math.max(1, Math.min(24, Math.round(piecesPerMetre * size)));
  }

  function breakAt(at, size, velocity = [0, 0, 0], material = null, { pieces, mass, light = null } = {}) {
    if (!ok3(at) || !(size > 0) || !Number.isFinite(size) || physics.disposed) return;
    const v = ok3(velocity) ? velocity : [0, 0, 0];
    const s = serial++;
    const split = splitBreak({ size, mass: mass ?? density * size ** 3, pieces: pieces ?? piecesOf(size) }, { room: cap.room() });
    const granted = cap.take(split.hulls);
    stats.breaks++;
    stats.refused += split.wanted - granted;
    for (let i = 0; i < granted; i++) {
      const k = i * 64;
      const sz = split.sizes[i];
      const r = size / 2;
      const off = [(rnd(seed, s, k) - 0.5) * r, (rnd(seed, s, k + 1) - 0.5) * r, (rnd(seed, s, k + 2) - 0.5) * r];
      const points = chunk(sz, seed, s, k + 6);
      let body;
      try {
        body = physics.add({
          position: [at[0] + off[0], at[1] + off[1], at[2] + off[2]],
          rotation: turn(seed, s, k + 3),
          mass: split.masses[i],
          linearDamping: 0.2,
          angularDamping: 0.4,
          colliders: [{ shape: 'hull', args: [points] }],
        });
      } catch {
        cap.give(1); // (a chunk that wouldn't hull: its slot back, its rubble in the burst)
        continue;
      }
      // thrown out of the break, with its own speed on top of the break's
      const len = Math.hypot(off[0], off[1], off[2]) || 1;
      const kick = SCATTER * rnd(seed, s, k + 60);
      const m = split.masses[i];
      body.push([(v[0] + (off[0] / len) * kick) * m, (v[1] + (off[1] / len) * kick + kick * 0.5) * m, (v[2] + (off[2] / len) * kick) * m]);
      live.push({ body, size: sz, points, material, asleep: 0 });
    }
    stats.hulls = live.length;
    if (split.burst > 0) {
      effects.spawn(DEBRIS_FX, [...at], [0, 0, 0, 1], size, { burst: split.burst, light });
      stats.bursts++;
      stats.particles += split.burst;
    }
  }

  const pose = (h) => ({ position: h.body.position(), quaternion: h.body.quaternion(), size: h.size, points: h.points, material: h.material });

  return {
    break: breakAt,
    cap,
    hulls: () => live,
    // a hull asleep long enough leaves the engine for a static instance
    update(dt) {
      if (!(dt > 0)) return;
      let w = 0;
      for (let i = 0; i < live.length; i++) {
        const h = live[i];
        if (h.body.removed) {
          cap.give(1);
          continue;
        }
        h.asleep = h.body.sleeping ? h.asleep + dt : 0;
        if (h.asleep >= sleepToStatic) {
          const p = pose(h);
          physics.remove(h.body);
          cap.give(1);
          stats.statics++;
          try {
            onStatic?.(p);
          } catch {
            // (a world's instance list that throws keeps nothing: the hull is gone either way)
          }
          continue;
        }
        live[w++] = h;
      }
      live.length = w;
      stats.hulls = w;
    },
    stats: () => ({ ...stats, cap: cap.stats() }),
    dispose() {
      for (const h of live) {
        physics.remove(h.body);
        cap.give(1);
      }
      live.length = 0;
      stats.hulls = 0;
    },
  };
}

// The hulls drawn: the live ones from their bodies each frame, the static
// ones written once into a ring (the oldest overwritten past `max`). A unit
// box scaled to each chunk's size; one draw each.
export async function createDebrisMeshes(scene, debris, { max = 512, color = 0x8a8178 } = {}) {
  const { THREE } = await loadThree();
  const geo = new THREE.BoxGeometry(1, 0.6, 0.8);
  const mat = new THREE.MeshStandardNodeMaterial({ color, roughness: 0.9 });
  const liveMesh = new THREE.InstancedMesh(geo, mat, BREAK.live);
  const staticMesh = new THREE.InstancedMesh(geo, mat, max);
  for (const m of [liveMesh, staticMesh]) {
    m.count = 0;
    m.frustumCulled = false;
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
  }
  liveMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const mx = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const a3 = [0, 0, 0];
  const a4 = [0, 0, 0, 1];
  let ring = 0;
  return {
    update() {
      const list = debris.hulls();
      for (let i = 0; i < list.length; i++) {
        const h = list[i];
        p.fromArray(h.body.position(a3));
        q.fromArray(h.body.quaternion(a4));
        s.setScalar(h.size);
        liveMesh.setMatrixAt(i, mx.compose(p, q, s));
      }
      liveMesh.count = list.length;
      liveMesh.instanceMatrix.needsUpdate = true;
    },
    statics(pose) {
      p.fromArray(pose.position);
      q.fromArray(pose.quaternion);
      s.setScalar(pose.size);
      staticMesh.setMatrixAt(ring, mx.compose(p, q, s));
      ring = (ring + 1) % max;
      staticMesh.count = Math.min(max, staticMesh.count + 1);
      staticMesh.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      for (const m of [liveMesh, staticMesh]) m.removeFromParent();
      geo.dispose();
      mat.dispose();
    },
  };
}

// The Road’s weather and fire: the particle layer under the Battlefront
// effects (lib/three/particles: emitter.js’s step on the CPU, gpu.js’s twin
// on WebGPU, sprites.js’s instanced quads), driven by the Road’s own eight
// records (src/data/middleearth/fx/*.json, in emitter.js’s record shape) and
// drawn from its own sheets (scripts/road-sheets.mjs). One pool a kind
// asked for, so a kind is one draw.
//
//   createWeather(renderer, { tier, velocity }) → {
//     group,                         the quads (each at the origin, its corners in world space)
//     kind(name, { count, box, follow }) → { at(x, y, z), rate(k), stop(), ready },
//     light(daylight),               the sun and the ambient the lit kinds take
//     update(dt, camera, { wind }),  spawn and step every kind
//     stats(),                       [{ name, n, alive }] (alive on the CPU path; null on the GPU’s)
//     dispose() }
//
// `follow`: the kind’s box rides with the camera (rain, snow, ash round the
// walkers), `at` its offset from it; else `at` is where it stands. `box`:
// [w, h, d], the spawning sheet h metres over the point, w × d across.
// `scale`: each particle that many times its record’s size (a firework’s sparks seen from afar).
// `count`: the slots (the record’s maxCount else), quartered on low and
// halved on mid; `rate(k)` scales the spawning (0 holds it, 1 the record’s).
// `stop()` spawns no more and lets the live ones die before freeing the pool.
// `velocity`: the frame is drawn into a pass with a velocity target (the
// chain’s TRAA), so the quads keep sprites.js’s still velocity; drawn
// straight to the canvas they must not, or the draw writes an output the
// canvas lacks and WebGL 2 drops it.
//
//   KINDS, SHEETS, countFor(n, tier), recordFor(name, { count, box, scale }): pure, for the test.

import * as THREE from 'three';
import { OWNER, aliveCount, lifeMax, spawnCount } from '../../../lib/three/particles/emitter';
import { evalCurve } from '../../../lib/three/particles/curves';
import { createSim } from '../../../lib/three/particles/gpu';
import { createShared, createSpriteMesh } from '../../../lib/three/particles/sprites';
import rain from '../../../data/middleearth/fx/rain.json';
import snow from '../../../data/middleearth/fx/snow.json';
import ash from '../../../data/middleearth/fx/ash.json';
import embers from '../../../data/middleearth/fx/embers.json';
import motes from '../../../data/middleearth/fx/motes.json';
import spray from '../../../data/middleearth/fx/spray.json';
import smoke from '../../../data/middleearth/fx/smoke.json';
import fire from '../../../data/middleearth/fx/fire.json';

export const KINDS = { rain, snow, ash, embers, motes, spray, smoke, fire };
export const SHEETS = ['flake', 'drop', 'flame', 'mote', 'leaf', 'petal', 'puff', 'ash'];
const SHARE = { low: 0.25, mid: 0.5, high: 1, ultra: 1 };

export const countFor = (n, tier) => Math.max(1, Math.round(n * (SHARE[tier] ?? 1)));

// a kind’s record for this asking: its slots, its box, and a rate that keeps
// that many alive (the shortest life’s worth a second), the record itself untouched
export function recordFor(name, { count, box, scale = 1 } = {}) {
  const em = structuredClone(KINDS[name]);
  if (count) {
    em.maxCount = count;
    const shortest = Math.max(1e-3, evalCurve(em.lifetime, 0, 0));
    em.spawn.rate = Math.ceil(count / shortest);
  }
  if (scale !== 1) {
    const s = em.spawn.size;
    em.spawn.size = typeof s === 'number' ? s * scale : { random: s.random.map((v) => v * scale) };
  }
  if (box && em.spawn.position?.box) {
    em.spawn.position.box.size = [box[0], 0, box[2]];
    em.spawn.position.box.center = [0, box[1], 0];
  }
  return em;
}

export function createWeather(renderer, { tier = 'high', velocity = false } = {}) {
  const group = new THREE.Group();
  group.name = 'road:weather';
  const shared = createShared();
  let lit = null; // (the shared uniforms, once made)
  shared.then((sh) => (lit = sh));
  const sheets = new Map();
  const sheet = (name) => {
    if (!sheets.has(name))
      sheets.set(
        name,
        new THREE.TextureLoader().loadAsync(`/models/middleearth/fx/${name}.webp`).then((t) => {
          t.colorSpace = THREE.SRGBColorSpace;
          return t;
        }),
      );
    return sheets.get(name);
  };
  const handles = new Set();
  let seeds = 0;
  const last = new THREE.Vector3();
  let lastSet = false;

  const free = (h) => {
    handles.delete(h);
    h.dead = true;
    if (h.mesh) {
      group.remove(h.mesh);
      h.mesh.geometry.dispose();
      h.mesh.material.dispose();
    }
    h.sim?.dispose();
  };

  return {
    group,
    kind(name, { count, box, follow = false, scale = 1 } = {}) {
      if (!KINDS[name]) throw new Error(`weather: no kind ${name}`);
      const n = countFor(count ?? KINDS[name].maxCount, tier);
      const em = recordFor(name, { count: n, box, scale });
      const owners = new Float32Array(OWNER);
      owners[3] = 1; // scale
      owners[7] = 1; // the quaternion’s w
      const h = { name, em, n, owners, follow, pos: [0, 0, 0], k: 1, on: true, left: 0, state: { t: 0, acc: 0, burst: false }, sim: null, mesh: null, dead: false };
      h.ready = (async () => {
        const sim = await createSim(em, n, { renderer, seed: 1 + ++seeds });
        const [map, sh] = await Promise.all([sheet(em.sheet), shared]);
        const mesh = await createSpriteMesh(em, sim, { shared: sh, map });
        if (!velocity) mesh.material.mrtNode = null;
        h.sim = sim;
        h.mesh = mesh;
        if (h.dead) return free(h);
        mesh.name = `weather:${name}`;
        group.add(mesh);
      })();
      handles.add(h);
      return {
        at(x, y, z) {
          h.pos = [x, y, z];
        },
        rate(k) {
          h.k = Math.max(0, k);
        },
        stop() {
          if (!h.on) return;
          h.on = false;
          h.left = lifeMax(em);
        },
        ready: h.ready,
      };
    },
    async light(l) {
      const sh = await shared;
      const { az, el, colour } = l.sun;
      sh.sunDir.value.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
      sh.sunColor.value.setRGB(...colour).multiplyScalar(Math.max(0, Math.min(1, (el + 0.05) / 0.3)));
      sh.ambient.value.setRGB(...l.fog.colour).multiplyScalar(0.25 + l.ambient * 0.8);
    },
    update(dt, camera, { wind = null } = {}) {
      if (!(dt > 0)) return;
      // the camera’s own velocity, so a falling streak is not smeared by a pan
      if (lit && lastSet) lit.camVel.value.subVectors(camera.position, last).divideScalar(dt);
      last.copy(camera.position);
      lastSet = true;
      for (const h of handles) {
        if (!h.sim) continue;
        const o = h.owners;
        const base = h.follow ? camera.position : null;
        o[0] = (base?.x ?? 0) + h.pos[0];
        o[1] = (base?.y ?? 0) + h.pos[1];
        o[2] = (base?.z ?? 0) + h.pos[2];
        const count = h.on && h.k > 0 ? spawnCount(h.state, h.em, dt, { factor: h.k }) : 0;
        h.sim.step(dt, { batches: count ? [{ owner: 0, count }] : [], owners: o, wind });
        if (!h.on && (h.left -= dt) <= 0) free(h);
      }
    },
    stats: () => [...handles].map((h) => ({ name: h.name, n: h.n, alive: h.sim?.mode === 'cpu' ? aliveCount(h.sim.pool) : null })),
    dispose() {
      for (const h of [...handles]) free(h);
      for (const p of sheets.values()) p.then((t) => t.dispose());
    },
  };
}

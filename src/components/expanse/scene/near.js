// The nearest generated systems, built whole: the first of levels.js's
// levels (the design's section A: within a system's reach, everything is
// drawn). Each has:
//   - its star, a ball in its colour that shines, and its light: an entry in
//     stars(), in lighting.js's shape, its strength by its class and its
//     reach three of the system's
//   - its planets where their orbits have them on the shared clock
//     (orbitAt), each in its type's look (sectors.js's TYPE_LOOK, built by
//     galaxy/bodies.js) and lit from its star
//   - their moons where theirs have them (moonAt), small, in their kind's
//     look (MOON_LOOK)
//   - a ring for each ring band: flat in its planet's orbit plane, banded
//     from the planet's seed, no texture, dark where the planet's shadow
//     falls on it. A ring has no disc (discs.js), so it fades in as the
//     system's discs fade out
// and its star, planets and moons in solids(), where they are this frame,
// for the ship to hit.
//
// Which: the budget's systemsBuilt nearest whose build reach holds the
// camera, made from a little further out (AHEAD) so they're ready when
// their discs give way. A system's build reach is its reach, or more, so no
// body's disc is bigger than a chip draws a point before its body is built:
// seven of a body's radii past the most it is from its star, for each planet
// and moon (a disc is under 512 px on a 1,080 px screen from seven radii
// out). One is let go past LET_GO of its build reach; or, once past its build
// reach (its discs whole again), to a nearer one that wants its place.
//
// A little a frame: a system's bodies are made one at a time, as many a
// frame as the budget's expanseMs allows (one at least), the system hidden
// till all are. Then it goes through `prepare` (the scene's warm(): its
// shaders made) and shows when that's done. Only then does built() give it,
// with its build reach, so its discs give way over the last fifth of that
// with the bodies there to take over; its light and its solids are there
// from the start.
//
// DISC_RADII, AHEAD, LET_GO: the numbers above
// buildReach(system) → its build reach (the system through gen's addBodies)
// strengthOf(starClass) → its light's strength
// createNear(group, { budget, tier, build = buildBody, prepare, timer }) → {
//   update(systems, cam, t, camera, clock), built() → Map(id → build reach),
//   stars() → [{ id, at, r, colour, strength, reach }],
//   solids() → [{ id, at, r, reach }], setStep(step), dispose() }
//   group: where it builds, in the map's space (the systems' and cam's)
//   budget: universe/budget.js's row (systemsBuilt, expanseMs)
//   timer: () → ms (performance.now), for the frame's time
//   update: the loaded systems through addBodies, the camera's place, the
//   shared clock in seconds (orbits.js's spaceTime), the camera (each body's
//   update) and the scene's own clock in seconds (the bodies' clouds and the
//   like); a system no longer among them is let go
//   stars(), solids(): one array each, kept while what's built stays the
//   same; a solid's `at` is updated in it each frame
//   setStep(step): the pace's (qualityStep.js); from step 2 the bodies'
//   ground is worked to fewer octaves, as the map's planets' is

import * as THREE from 'three';
import { LOOKS, buildBody } from '../../galaxy/bodies';
import { moonAt, orbitAt } from '../gen/orbits';
import { hash64, range, rngOf } from '../gen/seed';
import { levelWeights } from './levels';
import { MOON_LOOK, TYPE_LOOK } from './sectors';

export const DISC_RADII = 7;
export const AHEAD = 1.15;
export const LET_GO = 1.3;
const SWITCH = 500; // how much nearer another system must be to take a place
const LIGHT_REACHES = 3; // a star lights this many of its system's reaches
const STAR_REACH = 1.4; // its solid's reach, in its radii (the home sun's)
const STRENGTH = { O: 0.9, B: 0.9, A: 0.9, F: 0.9, G: 0.9, K: 0.7, M: 0.7, 'white dwarf': 0.4, neutron: 0.4 };
const LESS_DETAIL = 2; // the pace's step the ground's detail goes at (planets.js's)

export const strengthOf = (cls) => STRENGTH[cls] ?? 0.7;

// (shared by every star, never disposed)
const STAR_BALL = new THREE.SphereGeometry(1, 32, 24);
const Z = new THREE.Vector3(0, 0, 1);
const PALE = new THREE.Color('#d8d0c4');
const TAU = 2 * Math.PI;

const dist = (a, b) => {
  const x = a[0] - b[0];
  const y = a[1] - b[1];
  const z = a[2] - b[2];
  return Math.sqrt(x * x + y * y + z * z);
};

export function buildReach(system) {
  let r = system.reach;
  for (const p of system.planets) {
    const d = dist(p.at, p.centre ?? system.at);
    r = Math.max(r, d + DISC_RADII * p.radius);
    for (const m of p.moonList ?? []) r = Math.max(r, d + m.orbit + DISC_RADII * m.radius);
  }
  return r;
}

// the axis a planet goes round its star about (orbitAt's): the part of up
// square to where it starts, so a level orbit's is up
function orbitAxis(p, out) {
  const x = p.at[0] - p.centre[0];
  const y = p.at[1] - p.centre[1];
  const z = p.at[2] - p.centre[2];
  out.set(-x * y, z * z + x * x, -y * z);
  return out.lengthSq() > 0 ? out.normalize() : out.set(0, 1, 0);
}

// A ring in its own frame, its planet at nought and the ring in z = 0: bands
// across it (three waves and a gap, from the planet's seed), soft at its
// edges, lit by how square the star is to it and dark in the planet's shadow
const RING_VERT = /* glsl */ `
  varying vec2 vAt;
  void main() {
    vAt = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const RING_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform vec2 uBand;
  uniform vec4 uWaves;
  uniform vec4 uPhases;
  uniform vec3 uSun;
  uniform float uR;
  uniform float uFade;
  varying vec2 vAt;
  void main() {
    float x = (length(vAt) - uBand.x) / (uBand.y - uBand.x);
    if (x < 0.0 || x > 1.0) discard;
    float band = 0.5 + 0.22 * sin(x * uWaves.x + uPhases.x) + 0.16 * sin(x * uWaves.y + uPhases.y) + 0.12 * sin(x * uWaves.z + uPhases.z);
    band *= smoothstep(0.0, uWaves.w, abs(x - uPhases.w));
    float edge = smoothstep(0.0, 0.05, x) * smoothstep(1.0, 0.92, x);
    vec3 p = vec3(vAt, 0.0);
    float toward = dot(p, uSun);
    float off = length(p - toward * uSun);
    float lit = toward < 0.0 ? smoothstep(uR * 0.96, uR * 1.04, off) : 1.0;
    float face = 0.3 + 0.7 * sqrt(abs(uSun.z));
    float a = clamp(band, 0.0, 1.0) * edge * uFade;
    gl_FragColor = vec4(uColor * face * mix(0.12, 1.0, lit), a);
  }
`;

// a planet's ring: its band, its look from the planet's seed, in its orbit plane
function ringOf(p) {
  const rng = rngOf(hash64(p.seed, 'ring look'));
  const color = new THREE.Color(p.color).lerp(PALE, range(rng, 0.35, 0.7));
  const uniforms = {
    uColor: { value: color },
    uBand: { value: new THREE.Vector2(p.ringBand.inner, p.ringBand.outer) },
    uWaves: { value: new THREE.Vector4(range(rng, 8, 18), range(rng, 22, 40), range(rng, 50, 90), range(rng, 0.01, 0.04)) },
    uPhases: { value: new THREE.Vector4(rng() * TAU, rng() * TAU, rng() * TAU, range(rng, 0.35, 0.75)) },
    uSun: { value: new THREE.Vector3(0, 0, 1) },
    uR: { value: p.radius },
    uFade: { value: 0 },
  };
  const geo = new THREE.RingGeometry(p.ringBand.inner, p.ringBand.outer, 96, 1);
  const mat = new THREE.ShaderMaterial({ vertexShader: RING_VERT, fragmentShader: RING_FRAG, uniforms, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = `ring:${p.id}`;
  mesh.quaternion.setFromUnitVectors(Z, orbitAxis(p, new THREE.Vector3()));
  return { mesh, uniforms, back: mesh.quaternion.clone().invert() };
}

export function createNear(group, { budget, tier = 'mid', build = buildBody, prepare = null, timer = () => performance.now() }) {
  const held = new Map(); // id → a system built, or being
  const shown = new Map(); // id → build reach, for what's shown
  const stars = [];
  const solids = [];
  const wants = [];
  let frame = 0;
  let detail = 1;
  const W = { full: 0, disc: 0, speck: 0 };
  const REACH = { reach: 0 };
  const P = [0, 0, 0]; // (a planet where it is this frame, and a moon of it)
  const M = [0, 0, 0];

  const relist = () => {
    stars.length = 0;
    solids.length = 0;
    for (const h of held.values()) {
      stars.push(h.light);
      solids.push(h.solid);
      for (const rec of h.planets) {
        solids.push(rec.solid);
        for (const m of rec.moons) solids.push(m.solid);
      }
    }
  };
  // a planet or moon: what the ship hits, and what's drawn of it once made
  const bodyOf = (id, look, r, small) => ({ solid: { id, at: [0, 0, 0], r, reach: r * (LOOKS[look]?.atmo?.top ?? 1) }, look, small, body: null, suns: null });

  // a system wanted: its solids and its light now, its meshes a little a frame
  const hold = (s, reach, d) => {
    const root = new THREE.Group();
    root.name = `system:${s.id}`;
    root.visible = false;
    group.add(root);
    let left = 1; // (its star)
    const planets = s.planets.map((p) => {
      const moons = p.moonList.map((m) => ({ m, ...bodyOf(m.id, MOON_LOOK[m.type] ?? MOON_LOOK.rocky, m.radius, true) }));
      left += 1 + moons.length + (p.ringBand ? 1 : 0);
      return { p, ...bodyOf(p.id, TYPE_LOOK[p.type] ?? TYPE_LOOK.rock, p.radius, false), moons, ring: null };
    });
    held.set(s.id, {
      s,
      reach,
      d,
      seen: frame,
      root,
      planets,
      left,
      star: null,
      colour: new THREE.Color(s.star.color),
      light: { id: s.id, at: s.at, r: s.star.size, colour: s.star.color, strength: strengthOf(s.star.class), reach: LIGHT_REACHES * s.reach },
      solid: { id: s.id, at: [...s.at], r: s.star.size, reach: s.star.size * STAR_REACH },
      made: false,
      gone: false,
    });
    relist();
  };

  const letGo = (h) => {
    h.gone = true;
    for (const rec of h.planets) {
      rec.body?.dispose();
      for (const m of rec.moons) m.body?.dispose();
      if (rec.ring) {
        rec.ring.mesh.geometry.dispose();
        rec.ring.mesh.material.dispose();
      }
    }
    h.star?.material.dispose();
    h.root.removeFromParent();
    h.root.clear();
    held.delete(h.s.id);
    shown.delete(h.s.id);
    relist();
  };

  const show = (h) => {
    if (h.gone) return;
    h.root.visible = true;
    shown.set(h.s.id, h.reach);
  };
  const made = (one, kind) => {
    const b = build(one.look, one.small ? { r: one.solid.r, small: true, tier } : { r: one.solid.r, tier });
    b.group.name = `${kind}:${one.solid.id}`;
    if (detail < 1) b.setDetail?.(detail);
    one.body = b;
    one.suns = [{ dir: new THREE.Vector3(), color: null }];
    return b.group;
  };
  // the next thing of a system made: its star, then each planet, its moons
  // and its ring
  const makeNext = (h) => {
    if (!h.star) {
      h.star = new THREE.Mesh(STAR_BALL, new THREE.MeshBasicMaterial({ color: h.s.star.color, toneMapped: false }));
      h.star.name = `star:${h.s.id}`;
      h.star.position.set(...h.s.at);
      h.star.scale.setScalar(h.s.star.size);
      h.root.add(h.star);
      return;
    }
    for (const rec of h.planets) {
      if (!rec.body) {
        h.root.add(made(rec, 'planet'));
        return;
      }
      const m = rec.moons.find((one) => !one.body);
      if (m) {
        h.root.add(made(m, 'moon'));
        return;
      }
      if (rec.p.ringBand && !rec.ring) {
        rec.ring = ringOf(rec.p);
        h.root.add(rec.ring.mesh);
        return;
      }
    }
  };
  const finish = (h) => {
    h.made = true;
    const p = prepare?.(h.root);
    if (p && typeof p.then === 'function') p.then(() => show(h), () => show(h));
    else show(h);
  };

  // a body put where it is and lit from its star, the way that is as drawn
  const place = (one, at, h, camera, clock) => {
    const { solid, body: b } = one;
    solid.at[0] = at[0];
    solid.at[1] = at[1];
    solid.at[2] = at[2];
    if (!b) return;
    b.group.position.set(at[0], at[1], at[2]);
    const sun = one.suns[0];
    sun.dir.set(h.s.at[0] - at[0], h.s.at[1] - at[1], h.s.at[2] - at[2]).transformDirection(group.matrixWorld);
    sun.color = h.colour;
    b.setSuns(one.suns);
    b.update(clock, camera);
  };

  return {
    update(systems, cam, t = 0, camera = null, clock = 0) {
      frame++;
      wants.length = 0;
      for (let i = 0; i < systems.length; i++) {
        const s = systems[i];
        const d = dist(s.at, cam);
        const h = held.get(s.id);
        if (h) {
          h.seen = frame;
          h.d = d;
          continue;
        }
        // (a build reach is never eight of a reach: a quick no first)
        if (!(d < AHEAD * (DISC_RADII + 1) * s.reach)) continue;
        const reach = buildReach(s);
        if (d < AHEAD * reach) wants.push({ s, d, reach });
      }
      for (const h of held.values()) if (h.seen !== frame || !(h.d <= LET_GO * h.reach)) letGo(h);
      // the nearest wanted first; a held one past its reach gives its place
      // to one much nearer, when there's no room
      wants.sort((a, b) => a.d - b.d || (a.s.id < b.s.id ? -1 : 1));
      const most = Math.max(1, budget.systemsBuilt);
      for (const w of wants) {
        if (held.size >= most) {
          let out = null;
          for (const h of held.values()) if (h.d > h.reach && h.d > w.d + SWITCH && (!out || h.d > out.d)) out = h;
          if (!out) break;
          letGo(out);
        }
        hold(w.s, w.reach, w.d);
      }
      // a little made, as long as the frame's time allows
      const until = timer() + budget.expanseMs;
      let any = false;
      for (const h of held.values()) {
        while (h.left > 0 && (!any || timer() < until)) {
          makeNext(h);
          h.left--;
          any = true;
        }
        if (h.left === 0 && !h.made) finish(h);
      }
      // everything where it is now
      group.updateWorldMatrix(true, false);
      for (const h of held.values()) {
        REACH.reach = h.reach;
        const fade = levelWeights(h.d, REACH, W).full;
        for (const rec of h.planets) {
          orbitAt(rec.p, t, P);
          place(rec, P, h, camera, clock);
          for (const m of rec.moons) place(m, moonAt(m.m, rec.p, t, M, P), h, camera, clock);
          if (rec.ring) {
            rec.ring.mesh.position.set(P[0], P[1], P[2]);
            rec.ring.uniforms.uSun.value.set(h.s.at[0] - P[0], h.s.at[1] - P[1], h.s.at[2] - P[2]).applyQuaternion(rec.ring.back).normalize();
            rec.ring.uniforms.uFade.value = fade;
          }
        }
      }
    },
    built: () => shown,
    stars: () => stars,
    solids: () => solids,
    setStep(step) {
      detail = step >= LESS_DETAIL ? 0 : 1;
      for (const h of held.values())
        for (const rec of h.planets) {
          rec.body?.setDetail?.(detail);
          for (const m of rec.moons) m.body?.setDetail?.(detail);
        }
    },
    dispose() {
      for (const h of held.values()) letGo(h);
    },
  };
}

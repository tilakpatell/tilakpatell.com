// A star system, built: its planet (bodies.js), its moons, the gas giant it
// orbits, and the moment from the films it's remembered for (systems.js's
// `pieces`), played out round it: the Devastator chasing the Tantive IV over
// Tatooine; Death Squadron over Hoth, the transports running for it under
// the ion cannon's fire, the asteroid field; the Battle of Endor under the
// half-built Death Star and its shield; the Death Star rounding Yavin with
// the fighters streaming up from the temple, its trench to fly down; Cloud
// City on Bespin's cloud tops; the blockade of Naboo; Coruscant's traffic
// and the battle over it; Geonosis's ring and its core ships lifting off;
// the Shield Gate, the battle and the Death Star's shot at Scarif; the Razor
// Crest with a TIE on its tail over Nevarro; the Mandalorians' Gauntlets
// against Moff Gideon's TIEs over the glass of Mandalore.
//
// Everything moves by `t`, the time on the wall (seconds), not this page's
// own clock: every pilot in a system sees its moment at the same point, so
// online, the Death Star fires on Scarif for everyone at once. (The
// battles' shots and who's hit are each pilot's own.)
//
// buildSystem(sys, { models, bolts, flashes, small, ratio }) → { group, solids,
//   goals, body, shield, tractor, update(t, dt, camera, ship) → busy,
//   setDetail(k), setRatio(r), events (drained by the scene), wake(ship),
//   quiet(on), setEffects(effects), garrison, war: { holdShield(up),
//   station(kind, shown), planetShield(on), superlaser(at), face(kind, at),
//   dish(kind) }, dispose() }
// setEffects(effects): who holds the system in the galaxy's war
// (warEffects.js): a fleet piece is drawn only for its holder, a standing
// battle only while the system's fought over, and where the holder has no
// fleet here, two of its ships stand in orbit (`garrison`); null puts it
// back as the system's own.
// quiet(on): the system's own fleets and battle (and Hoth's ion cannon) stand
// aside, hidden and not in the way, while the war's battle is on there
// (galaxy/warfront.js). war: the battle's set pieces' hold on the system
// (galaxy/warpieces/): the second Death Star's shield held up or down (null:
// its own cycle), a station gone (the Death Star blown, the Shield Gate
// rammed) and Scarif's shield down; Scarif's Death Star held away
// (superlaser(at): in at the wall second `at`, once, firing on the planet
// from its dish); the second Death Star turned off its spin so its dish
// faces a point (face(kind, at); null: eased back to its spin) and where
// its dish is (dish(kind), stationFx.js). quiet(false) puts everything back.
// solids: ship.js's ({ id, at, r, reach, band?, goal?, name? }), some
// moving (their `at` is updated in place); goals: the solids the autopilot
// can take you to, with their names. setDetail(k): how finely to draw the
// planets (0…1, bodies.js); setRatio(r): the pixel ratio it's drawn at, for the
// ships of the skylanes (the size of a point is in pixels).

import * as THREE from 'three';
import { buildBody } from './bodies';
import { createRocks } from './rocks';
import { createPlaces } from './placesDraw';
import { placesOf } from './places';
import { createSpacePieces } from './spacePieces';
import { createTrench } from '../universe/trench';
import { trenchBand } from '../universe/deep';
import { DEATHSTAR_REACH, STATION_NAMES, TRACTOR_REACH, reachOf } from './systems';
import { LASER } from './fx';
import { HULLS } from '../universe/wars';
import { garrisonFleet, piecesShown } from './warEffects';
import { DISH, buildBeam, dishAt, faceDish } from './stationFx';

const TAU = Math.PI * 2;
const SPIN = TAU / 900; // a planet turns once in fifteen minutes
const frac = (x) => x - Math.floor(x);
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (x) => {
  const k = clamp01(x);
  return k * k * (3 - 2 * k);
};
const Y = new THREE.Vector3(0, 1, 0);
const Zf = new THREE.Vector3(0, 0, 1);

// the same numbers for the same thing, for every pilot
function seeded(text) {
  let h = 2166136261;
  for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = (h + 0x6d2b79f5) >>> 0;
    let x = h;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

// How each big ship fills its box, for flying into: spheres along its
// length (universe/wars.js's HULLS, shared with the fleet war's battles).
const ROUND = { coreship: 0.48, deathstar2: 0.47 };
// a station turned to face the war's battle: seconds to turn, and to ease back to its spin
const FACE = { turn: 8, back: 20 };

// the way a holder turns to point its nose (+z) along `dir`, its top toward `up`
const basis = new THREE.Matrix4();
const vx = new THREE.Vector3();
const vy = new THREE.Vector3();
const vz = new THREE.Vector3();
function pointAlong(obj, dir, up = Y) {
  vz.copy(dir).normalize();
  vx.crossVectors(up, vz);
  if (vx.lengthSq() < 1e-8) vx.set(1, 0, 0);
  vx.normalize();
  vy.crossVectors(vz, vx);
  basis.makeBasis(vx, vy, vz);
  obj.quaternion.setFromRotationMatrix(basis);
}

export function buildSystem(sys, { models, bolts, flashes, small = false, ratio = 1 }) {
  const group = new THREE.Group();
  group.name = `system-${sys.id}`;
  const solids = [];
  const ticks = []; // (t, dt, camera, ship) → busy
  const disposers = [];
  const bodies = []; // every planet and moon made, for setDetail
  const dpr = []; // the uniforms that hold the pixel ratio, for setRatio
  const events = [];
  const capitals = []; // the big ships, for the ion cannon and the battles: { slot, side, size }
  // what stands aside while the war's battle is on here: the holders, the solids, and whether it is
  const ambient = { holders: [], solids: [], on: false };
  // and what the war's holder doesn't have here (setEffects: another side's
  // fleet, a standing battle nobody's fighting), by piece
  const byPiece = []; // piece index → { holders, solids }
  let hidden = []; // piece index → true while its holder's elsewhere
  let building = -1; // (the piece being built)
  const aside = (fn) => {
    const i = building;
    return (...a) => (ambient.on || hidden[i] ? false : fn(...a));
  };
  // the war's hold on it: the Death Star's shield (null: its own cycle),
  // the stations, Scarif's shield, Scarif's Death Star (null: its own
  // cycle; false: away; a wall second: in then, once) and a station turned
  // to face the battle (kind → { goal, on, k })
  const hold = { shield: null, superlaser: null };
  const facing = {};
  const stations = {}; // kind → { holder, solids: [{ o, r, reach }] }
  const sunDirs = sys.suns.map((s) => new THREE.Vector3(...s.dir).normalize());
  const sunLights = sys.suns.map((s, i) => ({ dir: sunDirs[i], color: new THREE.Color(s.color).multiplyScalar(i === 0 ? 1.25 : 0.7) }));
  const out = { group, solids, goals: [], body: null, shield: null, tractor: null, events };
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const tmp3 = new THREE.Vector3();
  const cam = new THREE.Vector3();
  let camAt = null;
  let dead = false;
  const timers = [];

  const addSolid = (o) => {
    solids.push(o);
    if (o.goal) out.goals.push(o);
    return o;
  };
  const body = (look, r) => {
    const b = buildBody(look, { r, small });
    b.setSuns(sunLights);
    bodies.push(b);
    disposers.push(() => b.dispose());
    return b;
  };
  // a big ship's spheres, from where it is and which way it points
  const hull = (slot, id, stand = false) => {
    const prof = HULLS[slot.kind];
    const round = ROUND[slot.kind];
    const list = [];
    if (round) list.push({ z: 0, r: round });
    else if (prof) for (const [z, r] of prof) list.push({ z, r });
    else if (slot.size > 3) for (const z of [-0.3, 0, 0.3]) list.push({ z, r: 0.08 });
    slot.holder.updateMatrixWorld(true);
    list.forEach((s, i) => {
      tmp.set(0, 0, s.z * slot.size).applyMatrix4(slot.holder.matrix);
      const o = addSolid({ id: `${id}-${i}`, at: tmp.toArray(), r: s.r * slot.size, reach: s.r * slot.size, hull: id });
      if (stand) ambient.solids.push({ o, r: o.r });
    });
  };
  const place = (slot, at, { yaw = 0, pitch = 0, roll = 0 } = {}) => {
    slot.holder.position.set(...at);
    slot.holder.rotation.set(pitch, yaw, roll, 'YXZ');
    group.add(slot.holder);
    disposers.push(() => models.drop(slot));
    return slot;
  };

  // ── The planet, the gas giant it orbits, its moons ──
  if (sys.body) {
    const b = body(sys.body.look, sys.body.r);
    out.body = b;
    group.add(b.group);
    addSolid({ id: 'planet', name: sys.name, at: [0, 0, 0], r: b.radius ?? sys.body.r, reach: reachOf(sys), goal: true, planet: true, look: sys.body.look });
    ticks.push((t, dt, camera) => {
      b.group.rotation.y = frac((t * SPIN) / TAU) * TAU;
      b.update(t % 3600, camera);
      return true;
    });
  }
  // (Alderaan's gone: where it was is still somewhere to go)
  else addSolid({ id: 'planet', name: `Where ${sys.name} was`, at: [0, 0, 0], r: 0.01, reach: 60, goal: true });
  if (sys.parent) {
    const p = body(sys.parent.look, sys.parent.r);
    p.group.position.set(...sys.parent.at);
    group.add(p.group);
    ticks.push((t, dt, camera) => {
      p.group.rotation.y = frac((t * SPIN * 0.6) / TAU) * TAU;
      p.update(t % 3600, camera);
      return false;
    });
  }
  sys.moons.forEach((m, i) => {
    const b = body(m.look, m.r);
    const holder = new THREE.Group();
    holder.rotation.x = m.tilt;
    holder.add(b.group);
    group.add(holder);
    const solid = addSolid({ id: `moon-${i}`, at: [0, 0, 0], r: m.r, reach: m.r * 1.3 });
    ticks.push((t, dt, camera) => {
      const a = t * m.speed + m.phase;
      b.group.position.set(Math.cos(a) * m.orbit, 0, Math.sin(a) * m.orbit);
      b.group.rotation.y = a * 2;
      holder.updateMatrixWorld(true);
      b.group.getWorldPosition(tmp);
      solid.at[0] = tmp.x;
      solid.at[1] = tmp.y;
      solid.at[2] = tmp.z;
      b.update(t % 3600, camera);
      return true;
    });
  });

  // ── The set pieces ──
  const BUILD = {
    // one ship chasing another round the planet, firing as it goes (its
    // bolts its side's colour, or a big ship's green and a small one's red)
    chase(p, i) {
      const runner = place(models.slot(p.runner.kind, p.runner.size), [0, 0, 0]);
      const hunter = place(models.slot(p.hunter.kind, p.hunter.size), [0, 0, 0]);
      const tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), p.tilt);
      const lag = (p.hunter.size * 0.8 + p.runner.size * 2 + 4) / p.radius;
      const at = (a, v) => v.set(Math.cos(a) * p.radius, p.height, Math.sin(a) * p.radius).applyQuaternion(tilt);
      const solid = addSolid({ id: `chase-${i}`, at: [0, 0, 0], r: p.hunter.size * 0.12, reach: p.hunter.size * 0.12 });
      const small = p.fire === 'small';
      const color = LASER[p.side] ?? (small ? LASER.rebel : LASER.empire);
      let cool = 0.5;
      const up = new THREE.Vector3();
      const run = (slot, ang) => {
        at(ang, slot.holder.position);
        at(ang + 0.01, tmp).sub(slot.holder.position);
        up.copy(slot.holder.position).normalize();
        pointAlong(slot.holder, tmp, up);
      };
      ticks.push((t, dt) => {
        const a = t * p.speed;
        run(runner, a);
        run(hunter, a - lag);
        hunter.holder.position.toArray(solid.at);
        cool -= dt;
        if (cool <= 0) {
          cool = small ? 0.25 + Math.random() * 0.3 : 0.3 + Math.random() * 0.5;
          const hit = Math.random() < 0.3;
          tmp2.copy(hunter.holder.position).addScaledVector(tmp.normalize(), p.hunter.size * 0.45);
          tmp3.copy(runner.holder.position).add(tmp.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(hit ? p.runner.size * 0.3 : p.runner.size * 4));
          bolts.fire(tmp2, tmp3, { color, speed: small ? 70 : 85, width: small ? 0.02 : 0.1, length: small ? 0.7 : 3.2, onHit: hit ? (pt) => flashes.at(pt, { size: small ? 0.5 : p.runner.size * 0.5 }) : null });
        }
        return true;
      });
    },

    // capital ships on station, riding a little at anchor (or turning, a battleship's ring)
    fleet(p) {
      p.ships.forEach((s, j) => {
        const slot = place(models.slot(s.kind, s.size, { tint: s.tint }), s.at, { yaw: s.yaw, pitch: s.pitch, roll: s.roll });
        capitals.push({ slot, side: p.side, size: s.size });
        ambient.holders.push(slot.holder);
        hull(slot, `fleet-${s.kind}-${j}`, true);
        const y0 = s.at[1];
        ticks.push((t) => {
          slot.holder.position.y = y0 + Math.sin(t * 0.07 + j * 1.7) * s.size * 0.012;
          if (s.spin) slot.holder.rotation.y = s.yaw + Math.sin(t * s.spin) * 0.4;
          return false;
        });
      });
    },

    // ships running for it, out from the planet to the jump, one after another
    escape(p, i) {
      const runs = [0, 0.5].map((off) => ({
        off,
        ship: place(models.slot(p.kind, p.size), p.from),
        escorts: [-1, 1].map(() => place(models.slot(p.escort, 0.3), p.from)),
        gone: false,
      }));
      const from = new THREE.Vector3(...p.from);
      const to = new THREE.Vector3(...p.to);
      const mid = from.clone().multiplyScalar(1.8).add(new THREE.Vector3(0, 18, 0));
      const bez = (k, v) => v.copy(from).multiplyScalar((1 - k) ** 2).addScaledVector(mid, 2 * k * (1 - k)).addScaledVector(to, k * k);
      ticks.push((t) => {
        for (const r of runs) {
          const k = frac(t / p.every + r.off + i * 0.13);
          const flying = k < 0.86;
          const s = 1 - (1 - Math.min(1, k / 0.86)) ** 2;
          bez(s, r.ship.holder.position);
          bez(Math.min(1, s + 0.01), tmp).sub(r.ship.holder.position);
          pointAlong(r.ship.holder, tmp.lengthSq() > 1e-9 ? tmp : Zf);
          // the jump: stretched long, a flash, gone
          const jump = clamp01((k - 0.84) / 0.02);
          r.ship.holder.scale.set(1 - jump * 0.6, 1 - jump * 0.6, 1 + jump * 14);
          r.ship.holder.visible = k < 0.86 && k > 0.004;
          if (!flying && !r.gone) {
            r.gone = true;
            flashes.at(r.ship.holder.position, { size: p.size * 2.2, color: [1.2, 1.8, 3.2], life: 0.7 });
            events.push({ type: 'event', id: 'escaped', kind: p.kind });
          } else if (flying) r.gone = false;
          for (let j = 0; j < r.escorts.length; j++) {
            const e = r.escorts[j];
            tmp2.set(j ? p.size * 1.4 : -p.size * 1.4, p.size * 0.4, -p.size * (1.2 + j * 0.5)).applyQuaternion(r.ship.holder.quaternion);
            e.holder.position.copy(r.ship.holder.position).add(tmp2);
            e.holder.quaternion.copy(r.ship.holder.quaternion);
            e.holder.scale.copy(r.ship.holder.scale);
            e.holder.visible = r.ship.holder.visible;
          }
        }
        return true;
      });
    },

    // the ion cannon at Hoth: two great bolts up at a Star Destroyer, now and then
    cannon(p) {
      const from = new THREE.Vector3(...p.from);
      let last = -1;
      ticks.push(aside((t) => {
        const cyc = Math.floor(t / p.every);
        if (cyc === last) return false;
        const first = last < 0;
        last = cyc;
        if (first) return false;
        const target = capitals[p.target] ?? capitals[0];
        if (!target) return false;
        for (let k = 0; k < 2; k++) {
          const aim = target.slot.holder.position.clone().add(tmp2.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(target.size * 0.15));
          const shoot = () =>
            !dead &&
            bolts.fire(from, aim, {
              color: LASER.ion,
              speed: 55,
              width: 0.55,
              length: 5,
              onHit: (pt) => {
                flashes.at(pt, { size: 9, color: [1, 1.8, 3.4], life: 1.1 });
                flashes.at(pt, { size: 4, color: [2.6, 1.2, 0.4], life: 0.6 });
              },
            });
          if (k === 0) shoot();
          else timers.push(setTimeout(shoot, 260));
        }
        events.push({ type: 'event', id: 'ion' });
        return true;
      }));
    },

    rocks(p, i) {
      const r = createRocks({ ...p, small });
      group.add(r.group);
      for (const s of r.solids) addSolid({ ...s, id: `rocks-${i}-${s.id}` });
      disposers.push(() => r.dispose());
      ticks.push((t, dt, camera) => {
        r.update(t % 3600, camera);
        return false;
      });
    },

    // a great station: the half-built Death Star (and its shield), Cloud City, the Shield Gate
    station(p) {
      const slot = place(models.slot(p.kind, p.size), p.at);
      const st = (stations[p.kind] = { holder: slot.holder, solids: [], r: p.size * (ROUND[p.kind] ?? 0.5) });
      const mark = (o) => (st.solids.push({ o, r: o.r, reach: o.reach }), o);
      const at = new THREE.Vector3(...p.at);
      const up = at.clone().normalize();
      if (p.surface || p.kind === 'gate') slot.holder.quaternion.setFromUnitVectors(Y, up);
      slot.holder.updateMatrixWorld(true);
      const names = STATION_NAMES;
      if (p.kind === 'deathstar2') {
        mark(addSolid({ id: 'deathstar2', name: names.deathstar2, at: p.at, r: p.size * 0.47, reach: p.size * 0.66, goal: true, board: p.board }));
        if (p.shield) {
          const R = p.size * 0.66;
          const shell = addSolid({ id: 'ds2-shield', at: p.at, r: R, reach: R, shield: true });
          const mat = new THREE.ShaderMaterial({
            vertexShader: 'varying vec3 vN; varying vec3 vV; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }',
            fragmentShader: 'uniform float uOn; uniform float uHit; varying vec3 vN; varying vec3 vV; void main() { float f = pow(1.0 - abs(dot(vN, vV)), 3.0); vec3 c = vec3(0.35, 0.85, 1.0) * (f * 0.5 + uHit * 0.35) * uOn; gl_FragColor = vec4(c, 1.0); }',
            uniforms: { uOn: { value: 1 }, uHit: { value: 0 } },
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide,
          });
          const bubble = new THREE.Mesh(new THREE.SphereGeometry(R, 48, 32), mat);
          bubble.position.copy(at);
          group.add(bubble);
          disposers.push(() => (bubble.geometry.dispose(), mat.dispose()));
          out.dsShield = { solid: shell, mat, R };
          // the shield is up for four minutes, then the strike team on Endor gets it down for two
          let was = null;
          ticks.push((t, dt) => {
            const up = hold.shield ?? frac(t / 360) < 0.66;
            shell.r = up ? R : 0;
            shell.reach = up ? R : 0;
            mat.uniforms.uOn.value += ((up ? 1 : 0) - mat.uniforms.uOn.value) * clamp01(dt * 2);
            mat.uniforms.uHit.value = Math.max(0, mat.uniforms.uHit.value - dt * 1.5);
            if (was !== null && was !== up) events.push({ type: 'event', id: up ? 'shield-up' : 'shield-down' });
            was = up;
            return mat.uniforms.uHit.value > 0;
          });
        }
      } else if (p.kind === 'cloudcity') {
        const s = p.size;
        addSolid({ id: 'cloudcity', name: names.cloudcity, at: tmp.copy(at).addScaledVector(up, s * 0.08).toArray(), r: s * 0.17, reach: s * 0.55, goal: true });
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * TAU;
          tmp.set(Math.cos(a) * s * 0.33, s * 0.04, Math.sin(a) * s * 0.33).applyQuaternion(slot.holder.quaternion).add(at);
          addSolid({ id: `cloudcity-${k}`, at: tmp.toArray(), r: s * 0.11, reach: s * 0.11 });
        }
      } else if (p.kind === 'gate') {
        const s = p.size;
        addSolid({ id: 'gate', name: names.gate, at: p.at, r: 0.01, reach: s * 0.5, goal: true, ring: true });
        for (let k = 0; k < 18; k++) {
          const a = (k / 18) * TAU;
          tmp.set(Math.cos(a) * s * 0.42, 0, Math.sin(a) * s * 0.42).applyQuaternion(slot.holder.quaternion).add(at);
          mark(addSolid({ id: `gate-${k}`, at: tmp.toArray(), r: s * 0.065, reach: s * 0.065 }));
        }
        out.gate = { at: at.clone(), axis: up.clone(), hole: s * 0.33 };
      }
      if (p.spin) {
        const q0 = slot.holder.quaternion.clone();
        const spinQ = new THREE.Quaternion();
        ticks.push((t) => {
          // (about its own up: a ring about its axis, the Death Star about its poles)
          spinQ.setFromAxisAngle(Y, frac((t * p.spin) / TAU) * TAU);
          slot.holder.quaternion.copy(q0).multiply(spinQ);
          // the war's hold: turned off its spin to face the battle, and eased
          // back when let go (on the wall clock, so at any frame rate alike)
          const f = facing[p.kind];
          if (!f) return false;
          f.t0 ??= t;
          f.k = f.on ? clamp01(f.from + (t - f.t0) / FACE.turn) : clamp01(f.from - (t - f.t0) / FACE.back);
          if (f.k > 0) slot.holder.quaternion.slerp(f.goal, f.k * f.k * (3 - 2 * f.k));
          return f.k > 0 && f.k < 1;
        });
      }
    },

    // Scarif's planetary shield: the only way in is through the gate
    shield(p) {
      out.body?.set?.('shield', 1);
      out.shield = { r: p.r };
      stations.shield = { r: p.r };
    },

    // two fleets in a battle: their turbolasers, their fighters dogfighting between
    battle(p, i) {
      const C = new THREE.Vector3(...p.at);
      const sides = Object.keys(p.sides);
      const ships = {};
      for (const side of sides) {
        ships[side] = p.sides[side].map((s, j) => {
          const slot = place(models.slot(s.kind, s.size, { tint: s.tint }), [p.at[0] + s.at[0], p.at[1] + s.at[1], p.at[2] + s.at[2]], { yaw: s.yaw });
          ambient.holders.push(slot.holder);
          hull(slot, `battle-${i}-${side}-${j}`, true);
          capitals.push({ slot, side, size: s.size });
          return { slot, size: s.size };
        });
      }
      // the fighters, in pairs: one after the other, round looping paths through the battle
      const rand = seeded(`${sys.id}-battle-${i}`);
      const n = small ? Math.ceil(p.count / 2) : p.count;
      const fighters = [];
      for (let j = 0; j < n; j++) {
        const side = sides[j % 2];
        const list = p.fighters[side];
        const kind = list[Math.floor(rand() * list.length)];
        const slot = place(models.slot(kind, 0.3), p.at);
        ambient.holders.push(slot.holder);
        const lead = j % 2 === 0;
        const leader = fighters[j - 1];
        if (lead || !leader) {
          const u = new THREE.Vector3(rand() - 0.5, (rand() - 0.5) * 0.6, rand() - 0.5).normalize();
          const w = new THREE.Vector3().crossVectors(u, new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5)).normalize();
          const v = new THREE.Vector3().crossVectors(w, u);
          fighters.push({ slot, side, lead: true, R: p.radius * (0.25 + rand() * 0.45), u, v, w, w1: 0.25 + rand() * 0.2, ph: rand() * TAU, down: 0, cool: rand() });
        } else {
          // a chaser: round its leader's path, a little behind it
          fighters.push({ ...leader, slot, side, lead: false, ph: leader.ph - 2.6 / leader.R, down: 0, cool: rand() });
        }
      }
      const path = (f, t, v) => {
        const a = t * f.w1 + f.ph;
        return v
          .copy(C)
          .addScaledVector(f.u, Math.cos(a) * f.R)
          .addScaledVector(f.v, Math.sin(a) * f.R)
          .addScaledVector(f.w, Math.sin(a * 2.3 + f.ph) * f.R * 0.3);
      };
      let fireCool = 0;
      ticks.push(aside((t, dt) => {
        // the capital ships trade turbolaser fire
        fireCool -= dt;
        while (fireCool <= 0) {
          fireCool += small ? 0.22 : 0.11;
          const a = sides[Math.random() < 0.5 ? 0 : 1];
          const b = sides[0] !== a ? sides[0] : sides[1];
          const from = ships[a][Math.floor(Math.random() * ships[a].length)];
          const to = ships[b][Math.floor(Math.random() * ships[b].length)];
          if (!from || !to) break;
          tmp.set((Math.random() - 0.5) * 0.5, (Math.random() - 0.3) * 0.15, (Math.random() - 0.5) * 0.7).multiplyScalar(from.size).applyQuaternion(from.slot.holder.quaternion).add(from.slot.holder.position);
          tmp2.set((Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.12, (Math.random() - 0.5) * 0.6).multiplyScalar(to.size).applyQuaternion(to.slot.holder.quaternion).add(to.slot.holder.position);
          const hit = Math.random() < 0.55;
          if (!hit) tmp2.addScaledVector(tmp3.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5), to.size * 0.8);
          bolts.fire(tmp, tmp2, { color: LASER[a] ?? LASER.rebel, speed: 95, width: 0.11, length: 3.4, onHit: hit ? (pt) => flashes.at(pt, { size: 1.4 + Math.random() * 1.6, life: 0.6 }) : null });
        }
        // the fighters
        for (let j = 0; j < fighters.length; j++) {
          const f = fighters[j];
          if (f.down > 0) {
            f.down -= dt;
            f.slot.holder.visible = false;
            if (f.down <= 0) f.ph += Math.PI; // back in, the far side of the battle
            continue;
          }
          f.slot.holder.visible = true;
          path(f, t, f.slot.holder.position);
          path(f, t + 0.05, tmp).sub(f.slot.holder.position);
          tmp2.copy(f.slot.holder.position).sub(C).normalize();
          pointAlong(f.slot.holder, tmp, tmp2);
          f.cool -= dt;
          if (!f.lead && f.cool <= 0) {
            f.cool = 0.35 + Math.random() * 0.5;
            const target = fighters[j - 1];
            if (target && target.down <= 0) {
              const hit = Math.random() < 0.18;
              tmp2.copy(f.slot.holder.position).addScaledVector(tmp.normalize(), 0.2);
              tmp3.copy(target.slot.holder.position).add(tmp.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(hit ? 0.05 : 1.2));
              bolts.fire(tmp2, tmp3, {
                color: LASER[f.side] ?? LASER.rebel,
                speed: 60,
                width: 0.015,
                length: 0.5,
                onHit: hit
                  ? (pt) => {
                      flashes.at(pt, { size: 1.6, life: 0.8 });
                      target.down = 3 + Math.random() * 3;
                    }
                  : null,
              });
            }
          }
        }
        return true;
      }));
    },

    // the Death Star: its trench to fly down, its tractor beam (Alderaan), its hangar to be pulled into
    deathstar(p) {
      const r = p.r;
      const holder = new THREE.Group();
      holder.position.set(...p.at);
      group.add(holder);
      // a grey sphere and its trench till the model's here
      const stand = new THREE.Mesh(new THREE.SphereGeometry(r, 64, 40), new THREE.MeshStandardMaterial({ color: '#868c95', roughness: 0.8, metalness: 0.25 }));
      const groove = new THREE.Mesh(new THREE.TorusGeometry(r * 0.995, r * 0.02, 6, 96), new THREE.MeshStandardMaterial({ color: '#2b2e33', roughness: 0.9 }));
      groove.rotation.x = Math.PI / 2;
      stand.add(groove);
      holder.add(stand);
      disposers.push(() => {
        stand.geometry.dispose();
        stand.material.dispose();
        groove.geometry.dispose();
        groove.material.dispose();
      });
      const slot = models.slot('deathstar', r * 2);
      holder.add(slot.holder);
      disposers.push(() => models.drop(slot));
      const station = { id: 'deathstar', at: p.at, r, trench: { segments: 34 } };
      const band = p.trench ? trenchBand(station) : null;
      addSolid({ id: 'deathstar', name: STATION_NAMES.deathstar, at: p.at, r, reach: r * DEATHSTAR_REACH, goal: true, board: p.board, ...(band ? { band } : {}) });
      let trench = null;
      if (p.trench) {
        trench = createTrench(station);
        group.add(trench.group);
        disposers.push(() => trench.dispose());
      }
      if (p.tractor) out.tractor = { at: new THREE.Vector3(...p.at), r, reach: r * TRACTOR_REACH, board: p.board };
      ticks.push((t) => {
        stand.visible = !slot.real;
        holder.rotation.y = frac((t * 0.002) / TAU) * TAU;
        if (trench && camAt && camAt.distanceTo(holder.position) < 700) trench.wake();
        return false;
      });
    },

    // fighters streaming up from the moon toward the Death Star
    stream(p) {
      const dur = 26;
      const n = Math.ceil(dur / p.every);
      const target = new THREE.Vector3(...p.to);
      const from = new THREE.Vector3(...p.from);
      const r0 = sys.body?.r ?? 20;
      const toward = target.clone().sub(from).normalize();
      const rand = seeded(`${sys.id}-stream`);
      const runs = Array.from({ length: n }, (_, j) => {
        const off = new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(0.9);
        const start = toward.clone().add(off).normalize().multiplyScalar(r0 + 0.4);
        const mid = start.clone().multiplyScalar(1.9);
        const end = target.clone().addScaledVector(toward, -48).add(off.clone().multiplyScalar(30));
        return { slot: place(models.slot(p.kinds[j % p.kinds.length], p.size), start.toArray()), start, mid, end, j };
      });
      const bez = (r, k, v) => v.copy(r.start).multiplyScalar((1 - k) ** 2).addScaledVector(r.mid, 2 * k * (1 - k)).addScaledVector(r.end, k * k);
      ticks.push((t) => {
        for (const r of runs) {
          const k = frac((t + r.j * p.every) / dur);
          const e = k * k * (1.6 - 0.6 * k);
          bez(r, e, r.slot.holder.position);
          bez(r, Math.min(1, e + 0.01), tmp).sub(r.slot.holder.position);
          tmp2.copy(r.slot.holder.position).normalize();
          pointAlong(r.slot.holder, tmp, tmp2);
          const s = smooth(k / 0.04) * smooth((1 - k) / 0.06);
          r.slot.holder.scale.setScalar(Math.max(0.001, s));
        }
        return true;
      });
    },

    // small ships circling something
    patrol(p, i) {
      const C = new THREE.Vector3(...p.at);
      const slots = Array.from({ length: p.count }, () => place(models.slot(p.kind, p.size), p.at));
      ticks.push((t) => {
        for (let j = 0; j < slots.length; j++) {
          const s = slots[j];
          const a = t * p.speed + (j / p.count) * TAU + i;
          const pos = s.holder.position.set(Math.cos(a) * p.radius, Math.sin(a * 2 + j) * p.height, Math.sin(a) * p.radius).add(C);
          tmp.set(-Math.sin(a) * p.radius, Math.cos(a * 2 + j) * 2 * p.height, Math.cos(a) * p.radius).multiplyScalar(Math.sign(p.speed) || 1);
          tmp2.copy(pos).sub(C).normalize().multiplyScalar(-0.4).add(Y).normalize();
          pointAlong(s.holder, tmp, tmp2);
        }
        return true;
      });
    },

    // one ship leaving, now and then: lifting off, out, and away into hyperspace
    depart(p) {
      const slot = place(models.slot(p.kind, p.size), p.from);
      const from = new THREE.Vector3(...p.from);
      const to = new THREE.Vector3(...p.to);
      let gone = false;
      ticks.push((t) => {
        const k = frac(t / p.every);
        const s = smooth((k - 0.05) / 0.62);
        slot.holder.position.lerpVectors(from, to, s * s);
        tmp.copy(to).sub(from);
        pointAlong(slot.holder, tmp);
        const jump = clamp01((k - 0.66) / 0.02);
        slot.holder.scale.set(1 - jump * 0.6, 1 - jump * 0.6, 1 + jump * 12);
        slot.holder.visible = k < 0.68;
        if (k >= 0.68 && !gone) {
          gone = true;
          flashes.at(slot.holder.position, { size: p.size * 4, color: [1.2, 1.8, 3.2], life: 0.6 });
        } else if (k < 0.68) gone = false;
        return true;
      });
    },

    // Coruscant's skylanes: streams of ships, round and round the planet
    lanes(p) {
      const r0 = sys.body.r;
      const n = small ? Math.floor(p.count / 2) : p.count;
      const lanes = Array.from({ length: 12 }, (_, j) => ({ r: r0 * (1.05 + (j % 6) * 0.05), incl: (j * 0.37) % 1.1 - 0.55, node: j * 1.31, speed: (j % 2 ? 1 : -1) * (0.012 + (j % 5) * 0.003) }));
      const lane = new Float32Array(n * 4);
      const phase = new Float32Array(n);
      const colour = new Float32Array(n * 3);
      const rand = seeded(`${sys.id}-lanes`);
      const palette = [
        [2.4, 2.2, 1.8],
        [2.6, 1.6, 0.8],
        [2.6, 0.6, 0.4],
        [1.2, 1.8, 2.8],
      ];
      for (let j = 0; j < n; j++) {
        const l = lanes[j % lanes.length];
        lane.set([l.r + (rand() - 0.5) * 0.4, l.incl, l.node, l.speed * (0.9 + rand() * 0.2)], j * 4);
        // in convoys along the lane
        phase[j] = Math.floor(rand() * 9) * 0.7 + rand() * 0.25;
        colour.set(palette[rand() < 0.6 ? 0 : Math.floor(rand() * palette.length)], j * 3);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      geo.setAttribute('aLane', new THREE.BufferAttribute(lane, 4));
      geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
      geo.setAttribute('aColor', new THREE.BufferAttribute(colour, 3));
      const mat = new THREE.ShaderMaterial({
        vertexShader: `
          attribute vec4 aLane; attribute float aPhase; attribute vec3 aColor;
          uniform float uTime; uniform float uDpr; varying vec3 vColor;
          void main() {
            float a = aPhase + uTime * aLane.w;
            vec3 p = vec3(cos(a) * aLane.x, 0.0, sin(a) * aLane.x);
            float ci = cos(aLane.y), si = sin(aLane.y);
            p = vec3(p.x, -p.z * si, p.z * ci);
            float cn = cos(aLane.z), sn = sin(aLane.z);
            p = vec3(p.x * cn + p.z * sn, p.y, -p.x * sn + p.z * cn);
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_PointSize = clamp(${p.size.toFixed(3)} * 900.0 / -mv.z, 1.0, 4.0) * uDpr;
            vColor = aColor;
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: `varying vec3 vColor; void main() { float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vColor * smoothstep(0.5, 0.15, d), 1.0); }`,
        uniforms: { uTime: { value: 0 }, uDpr: { value: ratio } },
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const pts = new THREE.Points(geo, mat);
      pts.frustumCulled = false;
      group.add(pts);
      dpr.push(mat.uniforms.uDpr);
      disposers.push(() => (geo.dispose(), mat.dispose()));
      ticks.push((t) => {
        mat.uniforms.uTime.value = t % 7200;
        return true;
      });
    },

    // Geonosis: the Separatists' core ships lifting off and away, one after another
    liftoff(p) {
      const r0 = sys.body.r;
      const rand = seeded(`${sys.id}-liftoff`);
      const runs = Array.from({ length: p.count }, (_, j) => {
        const d = new THREE.Vector3(...sys.suns[0].dir).add(new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(1.4)).normalize();
        const slot = place(models.slot(p.kind, p.size), d.clone().multiplyScalar(r0).toArray());
        const solid = addSolid({ id: `coreship-${j}`, at: [0, 0, 0], r: p.size * 0.45, reach: p.size * 0.45 });
        return { d, slot, solid, j, gone: false };
      });
      ticks.push((t) => {
        for (const r of runs) {
          const k = frac(t / (p.every * p.count) + r.j / p.count);
          const climb = k < 0.25 ? r0 - p.size * 0.3 + (k / 0.25) * p.size * 1.2 : r0 + p.size * 0.9 + ((k - 0.25) / 0.6) ** 2 * r0 * 2.4;
          r.slot.holder.position.copy(r.d).multiplyScalar(climb);
          pointAlong(r.slot.holder, r.d);
          r.slot.holder.visible = k < 0.85;
          r.slot.holder.position.toArray(r.solid.at);
          r.solid.r = k < 0.85 ? p.size * 0.45 : 0;
          if (k >= 0.85 && !r.gone) {
            r.gone = true;
            flashes.at(r.slot.holder.position, { size: p.size * 1.6, color: [1.2, 1.8, 3.2], life: 0.7 });
          } else if (k < 0.85) r.gone = false;
        }
        return true;
      });
    },

    // Scarif: the Death Star arrives, fires a single reactor's worth at the Citadel, and leaves
    superlaser(p) {
      const ds = models.slot('deathstar', 64);
      const at = new THREE.Vector3(...p.from);
      ds.holder.position.copy(at);
      group.add(ds.holder);
      disposers.push(() => models.drop(ds));
      const solid = addSolid({ id: 'deathstar', name: 'The Death Star', at: p.from, r: 0, reach: 0 });
      const target = new THREE.Vector3(...p.at);
      const dish = new THREE.Vector3();
      const landing = new THREE.Vector3();
      // turned so its dish faces what it fires on (stationFx.js)
      faceDish('deathstar', ds.holder, target, ds.holder.quaternion);
      // the beam: a hot green core in a wider glow
      const beam = buildBeam();
      group.add(beam.mesh);
      // where it lands: a ring of fire running out over the sea
      const waveMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 2, 0.8), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
      const wave = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 64), waveMat);
      wave.visible = false;
      group.add(wave);
      disposers.push(() => (beam.dispose(), wave.geometry.dispose(), waveMat.dispose()));
      let phase = null;
      ticks.push((t, dt) => {
        // its own cycle; or the war's hold: away while the war's battle is
        // on, and in once at the wall second it says (the gate fallen)
        const h = hold.superlaser;
        const k = h === null ? frac(t / p.every) : h === false ? 1 : (t - h) / p.every;
        const shown = k >= 0 && k < 0.42;
        ds.holder.visible = shown;
        solid.r = solid.reach = shown ? 32 : 0;
        // in out of hyperspace, long and thin, snapping to size; out again
        const inK = clamp01(k / 0.012);
        const outK = clamp01((k - 0.405) / 0.015);
        const s = shown ? Math.max(0.02, inK * (1 - outK)) : 0.02;
        ds.holder.scale.set(s, s, s * (1 + (1 - inK) * 6 + outK * 6));
        dishAt('deathstar', ds.holder, 32, dish);
        const now = k < 0 ? 'gone' : k < 0.012 ? 'in' : k < 0.12 ? 'hold' : k < 0.15 ? 'fire' : k < 0.4 ? 'after' : 'gone';
        if (now !== phase) {
          // (in and out of hyperspace: not at the first look, when it may be anywhere in its cycle)
          if (phase !== null && (now === 'in' || now === 'gone')) flashes.at(at, { size: 70, color: [1.2, 1.8, 3.2], life: 0.9 });
          if (now === 'fire') {
            events.push({ type: 'event', id: 'superlaser' });
            flashes.at(dish, { size: 14, color: [0.8, 3.5, 0.8], life: 1.2 });
          }
          phase = now;
        }
        const firing = k >= 0.12 && k < 0.15;
        if (firing) {
          beam.lay(dish, target, 1.6 + Math.sin(t * 40) * 0.3);
          if (Math.random() < dt * 20) flashes.at(target, { size: 10 + Math.random() * 10, color: [2.6, 2.2, 0.8], life: 0.6 });
        } else beam.hide();
        // the wave over the surface after it lands
        const w = (k - 0.13) / 0.25;
        wave.visible = w > 0 && w < 1;
        if (wave.visible) {
          const n = landing.copy(target).normalize();
          wave.position.copy(n).multiplyScalar((sys.body?.r ?? 32) + 0.25);
          wave.quaternion.setFromUnitVectors(Zf, n);
          wave.scale.setScalar(2 + w * 24);
          waveMat.opacity = (1 - w) * 0.9;
        }
        return shown;
      });
    },

  };
  sys.pieces.forEach((p, i) => {
    building = i;
    const h0 = ambient.holders.length;
    const s0 = ambient.solids.length;
    BUILD[p.type]?.(p, i);
    byPiece[i] = { holders: ambient.holders.slice(h0), solids: ambient.solids.slice(s0) };
  });
  building = -1;
  // ── The places to find, out in the open (places.js; placesDraw.js draws them all in two draws) ──
  {
    const places = placesOf(sys);
    const drawn = createPlaces({ places, sun: sunDirs[0]?.toArray() ?? [0, 1, 0], small });
    group.add(drawn.group);
    // (the nebula's not solid, r 0: at it by its reach, flown through; the rest you bump)
    for (const p of places) addSolid({ id: p.id, name: p.name, hint: p.hint, kind: p.kind, at: [...p.at], r: Math.max(p.r, 0.01), reach: p.reach, goal: true, place: true });
    disposers.push(() => drawn.dispose());
    ticks.push((t) => {
      drawn.update(t % 3600);
      return false;
    });
  }
  // ── The game's space level, where the system has one (spacePieces.js): scenery, not the war's ships,
  // and aside while the war's battle is on (a Starfighter Assault draws its own level: warfront.js) ──
  const spaceLevel = createSpacePieces(sys.id);
  group.add(spaceLevel.group);
  for (const g of spaceLevel.goals) addSolid({ ...g, at: [...g.at] });
  disposers.push(() => spaceLevel.dispose());
  ticks.push((t) => (spaceLevel.update(t % 3600), false));
  // what's shown: nothing of it while the war's battle is on here (quiet),
  // and of the rest only what its holder has here (setEffects)
  const garrison = { ships: [], slots: [], solids: [] };
  const refresh = () => {
    byPiece.forEach(({ holders, solids: own }, i) => {
      const shown = !ambient.on && !hidden[i];
      for (const h of holders) h.visible = shown;
      for (const x of own) x.o.r = x.o.reach = shown ? x.r : 0;
    });
    for (const slot of garrison.slots) slot.holder.visible = !ambient.on;
    spaceLevel.group.visible = !ambient.on;
    for (const x of garrison.solids) x.o.r = x.o.reach = ambient.on ? 0 : x.r;
  };

  out.update = (t, dt, camera, ship) => {
    camAt = camera ? cam.copy(camera.position) : null;
    let busy = false;
    for (const tick of ticks) if (tick(t, dt, camera, ship)) busy = true;
    return busy;
  };
  out.quiet = (on) => {
    if (on === ambient.on) return;
    ambient.on = on;
    refresh();
    // (Scarif's Death Star away while it's on, till the war brings it in)
    hold.superlaser = on ? false : null;
    // (and the war's hold let go: everything as it was)
    if (!on) {
      out.war.holdShield(null);
      for (const kind of Object.keys(stations)) if (kind !== 'shield') out.war.station(kind, true);
      out.war.planetShield(true);
      for (const kind of Object.keys(facing)) out.war.face(kind, null);
    }
  };
  // who holds the system in the war (warEffects.js's effects, or null for
  // as it was): their fleet in orbit, or a garrison of theirs where the
  // system has none, and its standing battle only while it's fought over
  out.garrison = [];
  out.setEffects = (effects) => {
    hidden = piecesShown(sys, effects).map((shown) => !shown);
    const want = effects ? garrisonFleet(sys, effects) : [];
    const key = (list) => list.map((g) => `${g.kind}@${g.at}`).join('|');
    if (key(want) !== key(garrison.ships)) {
      for (const slot of garrison.slots) {
        slot.holder.removeFromParent();
        models.drop(slot);
      }
      for (const x of garrison.solids) solids.splice(solids.indexOf(x.o), 1);
      garrison.slots = [];
      garrison.solids = [];
      garrison.ships = want;
      want.forEach((g, j) => {
        const slot = models.slot(g.kind, g.size);
        slot.holder.position.set(...g.at);
        slot.holder.rotation.set(0, g.yaw, 0, 'YXZ');
        group.add(slot.holder);
        garrison.slots.push(slot);
        const before = solids.length;
        hull(slot, `garrison-${g.kind}-${j}`);
        for (const o of solids.slice(before)) garrison.solids.push({ o, r: o.r });
      });
      out.garrison = want;
    }
    refresh();
  };
  out.war = {
    holdShield(up) {
      hold.shield = up;
    },
    station(kind, shown) {
      const st = stations[kind];
      if (!st) return;
      st.holder.visible = shown;
      for (const x of st.solids) {
        x.o.r = shown ? x.r : 0;
        x.o.reach = shown ? x.reach : 0;
      }
    },
    planetShield(on) {
      if (!stations.shield) return;
      out.shield = on ? { r: stations.shield.r } : null;
      out.body?.set?.('shield', on ? 1 : 0);
    },
    // Scarif's Death Star in at the wall second `at`, once (null: its own cycle again)
    superlaser(at) {
      hold.superlaser = at;
    },
    // a spinning station turned to face `at` ({ x, y, z } or [x, y, z]), or let go (null)
    face(kind, at) {
      const st = stations[kind];
      if (!st || !DISH[kind]) return;
      const f = (facing[kind] ??= { goal: new THREE.Quaternion(), on: false, k: 0, from: 0, t0: null });
      if (at) faceDish(kind, st.holder, Array.isArray(at) ? tmp.fromArray(at) : tmp.set(at.x, at.y, at.z), f.goal);
      // (turning on from wherever it's got to, timed from the next tick)
      f.on = Boolean(at);
      f.from = f.k;
      f.t0 = null;
    },
    // where a station's dish is now, or null
    dish(kind) {
      const st = stations[kind];
      return st && DISH[kind] ? dishAt(kind, st.holder, st.r) : null;
    },
  };
  // the second Death Star's shield, lit where the ship bumped it
  out.shieldHit = () => {
    if (out.dsShield) out.dsShield.mat.uniforms.uHit.value = 1;
  };
  out.sunLights = sunLights;
  out.setDetail = (k) => {
    for (const b of bodies) b.setDetail(k);
  };
  out.setRatio = (r) => {
    for (const u of dpr) u.value = r;
  };
  out.dispose = () => {
    dead = true;
    for (const slot of garrison.slots) models.drop(slot);
    for (const id of timers) clearTimeout(id);
    for (const d of disposers) d();
    group.removeFromParent();
  };
  return out;
}

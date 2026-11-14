// A star system, built: its planet (bodies.js), its moons, the gas giant it
// orbits, and the moment from the films it’s remembered for (systems.js’s
// `pieces`), played out round it: the Devastator chasing the Tantive IV over
// Tatooine; Death Squadron over Hoth, the transports running for it under
// the ion cannon’s fire, the asteroid field; the Battle of Endor under the
// half-built Death Star and its shield; the Death Star rounding Yavin with
// the fighters streaming up from the temple, its trench to fly down; Cloud
// City on Bespin’s cloud tops; the blockade of Naboo; Coruscant’s traffic
// and the battle over it; Geonosis’s ring and its core ships lifting off;
// the Shield Gate, the battle and the Death Star’s shot at Scarif; the Razor
// Crest with a TIE on its tail over Nevarro; the Mandalorians’ Gauntlets
// against Moff Gideon’s TIEs over the glass of Mandalore.
//
// Everything moves by `t`, the time on the wall (seconds), not this page’s
// own clock: every pilot in a system sees its moment at the same point, so
// online, the Death Star fires on Scarif for everyone at once. (The
// battles’ shots and who’s hit are each pilot’s own.)
//
// buildSystem(sys, { models, bolts, flashes, small, ratio }) → { group, solids,
//   goals, body, shield, tractor, update(t, dt, camera, ship) → busy,
//   setDetail(k), setRatio(r), events (drained by the scene), wake(ship),
//   quiet(on), setEffects(effects), garrison, war: { holdShield(up),
//   station(kind, shown), planetShield(on), superlaser(at), face(kind, at),
//   dish(kind) }, dispose() }
// setEffects(effects): who holds the system in the galaxy’s war
// (warEffects.js): a fleet piece is drawn only for its holder, a standing
// battle only while the system’s fought over, and where the holder has no
// fleet here, two of its ships stand in orbit (`garrison`); null puts it
// back as the system’s own.
// quiet(on): the system’s own fleets and battle (and Hoth’s ion cannon) stand
// aside, hidden and not in the way, while the war’s battle is on there
// (galaxy/warfront.js). war: the battle’s set pieces’ hold on the system
// (galaxy/warpieces/): the second Death Star’s shield held up or down (null:
// its own cycle), a station gone (the Death Star blown, the Shield Gate
// rammed) and Scarif’s shield down; Scarif’s Death Star held away
// (superlaser(at): in at the wall second `at`, once, firing on the planet
// from its dish); the second Death Star turned off its spin so its dish
// faces a point (face(kind, at); null: eased back to its spin) and where
// its dish is (dish(kind), stationFx.js). quiet(false) puts everything back.
// solids: ship.js’s ({ id, at, r, reach, band?, goal?, name? }), some
// moving (their `at` is updated in place); goals: the solids the autopilot
// can take you to, with their names. setDetail(k): how finely to draw the
// planets (0…1, bodies.js); setRatio(r): the pixel ratio it’s drawn at, for the
// ships of the skylanes (the size of a point is in pixels).
//
// The twin of ../world.js on the node renderer: the same buildSystem, the
// same returned shape, the same moments on the same clock. Its planets are
// ./bodies.js’s, its rocks ./rocks.js’s, its places ./placesDraw.js’s, the
// game’s space level ./spacePieces.js’s and its lasers’ colours ./fx.js’s
// (the twins); its set pieces and the two shaders world.js wrote inline (the
// second Death Star’s shield, Coruscant’s skylanes) are ./worldParts.js’s,
// which says what differs there. The rest is world.js’s, copied: it holds
// its GLSL beside it, and FL4 deletes it, keeping this.

import * as THREE from 'three';
import { buildBody } from './bodies';
import { createPlaces } from './placesDraw';
import { placesOf } from '../places';
import { createSpacePieces } from './spacePieces';
import { reachOf } from '../systems';
import { HULLS } from '../../universe/wars';
import { garrisonFleet, piecesShown } from '../warEffects';
import { DISH, dishAt, faceDish } from '../stationFx';
import { ROUND, SPIN, TAU, frac, setPieces } from './worldParts';

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
  // what stands aside while the war’s battle is on here: the holders, the solids, and whether it is
  const ambient = { holders: [], solids: [], on: false };
  // and what the war’s holder doesn’t have here (setEffects: another side’s
  // fleet, a standing battle nobody’s fighting), by piece
  const byPiece = []; // piece index → { holders, solids }
  let hidden = []; // piece index → true while its holder’s elsewhere
  let building = -1; // (the piece being built)
  const aside = (fn) => {
    const i = building;
    return (...a) => (ambient.on || hidden[i] ? false : fn(...a));
  };
  // the war’s hold on it: the Death Star’s shield (null: its own cycle),
  // the stations, Scarif’s shield, Scarif’s Death Star (null: its own
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
  const live = { dead: false, camAt: null }; // (what the set pieces read as it changes)
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
  // a big ship’s spheres, from where it is and which way it points
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
  // (Alderaan’s gone: where it was is still somewhere to go)
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

  // ── The set pieces (./worldParts.js: world.js’s BUILD, copied) ──
  const BUILD = setPieces({ sys, models, bolts, flashes, small, ratio, group, ticks, disposers, dpr, events, capitals, ambient, hold, facing, stations, out, live, timers, tmp, tmp2, tmp3, addSolid, hull, place, aside });
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
    // (the nebula’s not solid, r 0: at it by its reach, flown through; the rest you bump)
    for (const p of places) addSolid({ id: p.id, name: p.name, hint: p.hint, kind: p.kind, at: [...p.at], r: Math.max(p.r, 0.01), reach: p.reach, goal: true, place: true });
    disposers.push(() => drawn.dispose());
    ticks.push((t) => {
      drawn.update(t % 3600);
      return false;
    });
  }
  // ── The game’s space level, where the system has one (spacePieces.js): scenery, not the war’s ships,
  // and aside while the war’s battle is on (a Starfighter Assault draws its own level: warfront.js) ──
  const spaceLevel = createSpacePieces(sys.id);
  group.add(spaceLevel.group);
  for (const g of spaceLevel.goals) addSolid({ ...g, at: [...g.at] });
  disposers.push(() => spaceLevel.dispose());
  ticks.push((t) => (spaceLevel.update(t % 3600), false));
  // what’s shown: nothing of it while the war’s battle is on here (quiet),
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
    live.camAt = camera ? cam.copy(camera.position) : null;
    let busy = false;
    for (const tick of ticks) if (tick(t, dt, camera, ship)) busy = true;
    return busy;
  };
  out.quiet = (on) => {
    if (on === ambient.on) return;
    ambient.on = on;
    refresh();
    // (Scarif’s Death Star away while it’s on, till the war brings it in)
    hold.superlaser = on ? false : null;
    // (and the war’s hold let go: everything as it was)
    if (!on) {
      out.war.holdShield(null);
      for (const kind of Object.keys(stations)) if (kind !== 'shield') out.war.station(kind, true);
      out.war.planetShield(true);
      for (const kind of Object.keys(facing)) out.war.face(kind, null);
    }
  };
  // who holds the system in the war (warEffects.js’s effects, or null for
  // as it was): their fleet in orbit, or a garrison of theirs where the
  // system has none, and its standing battle only while it’s fought over
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
      if (st.bubble) st.bubble.visible = shown;
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
    // Scarif’s Death Star in at the wall second `at`, once (null: its own cycle again)
    superlaser(at) {
      hold.superlaser = at;
    },
    // a spinning station turned to face `at` ({ x, y, z } or [x, y, z]), or let go (null)
    face(kind, at) {
      const st = stations[kind];
      if (!st || !DISH[kind]) return;
      const f = (facing[kind] ??= { goal: new THREE.Quaternion(), on: false, k: 0, from: 0, t0: null });
      if (at) faceDish(kind, st.holder, Array.isArray(at) ? tmp.fromArray(at) : tmp.set(at.x, at.y, at.z), f.goal);
      // (turning on from wherever it’s got to, timed from the next tick)
      f.on = Boolean(at);
      f.from = f.k;
      f.t0 = null;
    },
    // where a station’s dish is now, or null
    dish(kind) {
      const st = stations[kind];
      return st && DISH[kind] ? dishAt(kind, st.holder, st.r) : null;
    },
  };
  // the second Death Star’s shield, lit where the ship bumped it
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
    live.dead = true;
    for (const slot of garrison.slots) models.drop(slot);
    for (const id of timers) clearTimeout(id);
    for (const d of disposers) d();
    group.removeFromParent();
  };
  return out;
}

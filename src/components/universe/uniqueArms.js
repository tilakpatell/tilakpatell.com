// The skill tree's four ship weapons in a scene that flies the universe's
// ships (the universe map, and the galaxy through shared/flying.js): what
// each does past a bolt is lib/arms/behaviours.js's, uniqueFx.js draws it,
// and this plays it out in the scene, as powers.js plays the crews' powers
// (the scene hands it the same pieces and calls it when the guns fire and
// once a frame, so the scene itself only grows by the calls).
//
// - The Seismic charge: dropped behind the ship, drifting on, a light
//   blinking on it; at its fuse a flat ring swells out level, and everything
//   in it is hit at once.
// - Concentrated dark matter: one slow, dark bolt that goes through every
//   ship in its line, a third less at each.
// - The Blue sky cluster: a round homing on the lock; near it, six blue
//   shards, each a small hit along its line.
// - The Energon arc: lightning to the lock (or the nearest ahead) and on to
//   up to three more near it, each jump weaker, all at once.
// Only the game's own ships are touched (the hunters, and the war's battle
// through its own hit(), the cut on its objectives); never another pilot, as
// with the powers. Their hits charge the big power as the guns' do.
//
// createUniqueArms({ parent, hunters, war, bolts, flashes, state, emit, strike, scored, reduced })
//   → { fire(id, at, dir, speed, w, punch) → the shot's velocity (for the wire), frame(dt), clear(), busy, dispose() }
// (`punch`: what a hit of the line's is worth against the game's ships, the ship's guns and pickups in it)
// state: the scene's (its ship, its lock, the shake and flare it plays);
// strike(from, to, punch, opts) and scored(hit, opts): the scene's hit test
// and what a hit does (as powers.js has them).

import * as THREE from 'three';
import { SHIP_FX, burstDirs, chain, dropAt, firstFor, inRing, jagged, pierce, punchAfter } from '../../lib/arms/behaviours';
import { shotRadius } from '../../lib/combat/contact';
import { AIM, dirTo, intercept } from './targeting';
import { isObjective, shotAt } from './shipPowers';
import { createUniqueFx } from './uniqueFx';
import { fan, steer } from './weapons';

const SUB = 0.5; // a battle's objectives take this share of a hit (the powers' cut)
const RING_FADE = 0.45; // seconds a ring takes to swell to its size and fade
const RAILS = 0.12; // seconds a cluster round flies straight before it homes (the rounds' own)
const ARC_POINTS = 7;
const BLUE = [0.9, 2.6, 3.6];
const GREEN = [0.4, 2.6, 0.7];
const SONIC = [0.8, 1.6, 2.8];

// (an orb meets a ship as a bolt would: contact.js's reach for a shot)
const orbReach = (t) => shotRadius(t.size ?? 1);
const apart = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const unit = (x, y, z) => {
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
};

export function createUniqueArms({ parent, hunters, war, bolts, flashes, state, emit, strike, scored, reduced = false }) {
  const fx = createUniqueFx(parent);
  const run = { charges: [], rings: [], orbs: [], rounds: [], arcs: [] };
  let gen = 0; // bumped at a clear: shards still in the air land on nothing
  const v1 = new THREE.Vector3();
  const v2 = new THREE.Vector3();

  // what they may hit: the hunters after you (not prey-chasers' quarry) and the war's
  const huntersNow = () => (hunters?.targets ?? []).filter((t) => !t.prey);
  const foes = () => [...huntersNow(), ...(war?.targets ?? [])];
  // a hit landed on one of them: the hunters' through their damage(), the
  // war's as a shot at it through its own hit(), as the guns' would be
  const land = (t, punch, from) => {
    if (hunters?.targets.includes(t)) {
      const r = hunters.damage(t.id, punch);
      return r ? scored(r, { src: 'hunters', normal: v2.set(t.at.x - from.x, t.at.y - from.y + 1, t.at.z - from.z).normalize() }) : null;
    }
    const s = shotAt(t, from);
    const r = war?.hit(s.from, s.to, isObjective(t) ? punch * SUB : punch);
    return r ? scored(r, { src: 'war' }) : null;
  };
  const say = (id, what) => emit({ type: 'unique', id, what });
  const shake = (k) => {
    if (!reduced) state.shake = Math.max(state.shake ?? 0, k);
  };

  // ── each as it's fired ──
  const fire = (id, at, dir, speed, w, punch) => {
    const o = { x: at.x, y: at.y, z: at.z };
    if (id === 'seismic') {
      const d = dropAt(o, dir, state.ship?.speed ?? 0);
      run.charges.push({ ...d.at, v: d.v, age: 0, punch, blink: 0 });
      return d.v;
    }
    if (id === 'darkmatter') {
      for (const d of fan(dir, w.count, w.cone)) run.orbs.push({ ...o, v: [d[0] * speed, d[1] * speed, d[2] * speed], life: AIM.life * w.life, punch, n: 0, hit: new Set() });
      return [dir[0] * speed, dir[1] * speed, dir[2] * speed];
    }
    if (id === 'crystal') {
      const lock = foes().includes(state.lockTarget) ? state.lockTarget : null;
      run.rounds.push({ ...o, v: [dir[0] * speed, dir[1] * speed, dir[2] * speed], life: AIM.life * w.life, age: 0, punch, homing: w.homing ?? 0, target: lock });
      return [dir[0] * speed, dir[1] * speed, dir[2] * speed];
    }
    if (id === 'energon') {
      const list = foes();
      const hops = chain(firstFor(o, dir, list, { lock: state.lockTarget }), list, { jumps: Math.max(0, w.count - 1), punch });
      let from = o;
      for (const h of hops) {
        const to = { x: h.t.at.x, y: h.t.at.y, z: h.t.at.z };
        run.arcs.push({ points: jagged(from, to, ARC_POINTS), age: 0 });
        land(h.t, h.punch, from);
        flashes.at(v1.set(to.x, to.y, to.z), { size: 0.4, color: BLUE, life: 0.3 });
        from = to;
      }
      // (nothing in reach: it crackles out ahead and dies)
      if (!hops.length) run.arcs.push({ points: jagged(o, { x: o.x + dir[0] * 6, y: o.y + dir[1] * 6, z: o.z + dir[2] * 6 }, ARC_POINTS), age: 0 });
      say('energon', hops.length ? 'arc' : 'fizzle');
      return [dir[0] * speed, dir[1] * speed, dir[2] * speed];
    }
    return [dir[0] * speed, dir[1] * speed, dir[2] * speed];
  };

  // ── each a frame on ──
  const blast = (c) => {
    const P = SHIP_FX.seismic;
    run.rings.push({ x: c.x, y: c.y, z: c.z, age: 0 });
    for (const t of inRing(c, foes(), P.radius, P.slab)) land(t, c.punch, c);
    flashes.at(v1.set(c.x, c.y, c.z), { size: 1.2, color: SONIC, life: 0.5, bright: 0.7 });
    shake(0.35);
    say('seismic', 'blast');
  };
  const charges = (dt) => {
    const P = SHIP_FX.seismic;
    for (let i = run.charges.length - 1; i >= 0; i--) {
      const c = run.charges[i];
      c.age += dt;
      c.x += c.v[0] * dt;
      c.y += c.v[1] * dt;
      c.z += c.v[2] * dt;
      // (blinking quicker as the fuse runs down)
      c.blink = Math.sin(c.age * (6 + c.age * 18)) > 0.2 ? 1 : 0;
      if (c.age >= P.fuse) {
        blast(c);
        run.charges.splice(i, 1);
      }
    }
    for (let i = run.rings.length - 1; i >= 0; i--) {
      const r = run.rings[i];
      r.age += dt;
      const k = r.age / RING_FADE;
      if (k >= 1) run.rings.splice(i, 1);
      else {
        r.r = P.radius * (0.15 + 0.85 * (1 - (1 - k) ** 3));
        r.k = 1 - k * k;
      }
    }
  };
  const orbs = (dt) => {
    const list = foes();
    for (let i = run.orbs.length - 1; i >= 0; i--) {
      const o = run.orbs[i];
      o.life -= dt;
      const from = { x: o.x, y: o.y, z: o.z };
      o.x += o.v[0] * dt;
      o.y += o.v[1] * dt;
      o.z += o.v[2] * dt;
      for (const t of pierce(from, o, list, o.hit, orbReach)) {
        o.hit.add(t.id ?? t);
        land(t, punchAfter(o.punch, o.n), from);
        o.n += 1;
        flashes.at(v1.set(t.at.x, t.at.y, t.at.z), { size: 0.5, color: GREEN, life: 0.35 });
      }
      if (o.life <= 0) {
        flashes.at(v1.set(o.x, o.y, o.z), { size: 0.3, color: GREEN, life: 0.3 });
        run.orbs.splice(i, 1);
      }
    }
  };
  const burst = (r) => {
    const P = SHIP_FX.crystal;
    const was = gen;
    const t = r.target;
    const way = t ? unit(t.at.x - r.x, t.at.y - r.y, t.at.z - r.z) : unit(...r.v);
    const from = { x: r.x, y: r.y, z: r.z };
    for (const d of burstDirs(way, P.shards, P.cone)) {
      const to = { x: r.x + d[0] * P.reach, y: r.y + d[1] * P.reach, z: r.z + d[2] * P.reach };
      bolts.fire(v1.set(from.x, from.y, from.z), v2.set(to.x, to.y, to.z), {
        color: BLUE,
        speed: P.speed,
        width: 0.03,
        length: 0.9,
        // (each shard's hit, as it gets there: along its own line, into whatever it meets)
        onHit: () => {
          if (was === gen) strike(from, to, P.punch * (r.punch / 3), { pilots: false, warPunch: P.punch * SUB });
        },
      });
    }
    flashes.at(v1.set(r.x, r.y, r.z), { size: 0.8, color: BLUE, life: 0.35 });
    say('crystal', 'burst');
  };
  const rounds = (dt) => {
    const P = SHIP_FX.crystal;
    const live = new Set(foes());
    for (let i = run.rounds.length - 1; i >= 0; i--) {
      const r = run.rounds[i];
      r.life -= dt;
      r.age += dt;
      if (r.target && !live.has(r.target)) r.target = null; // (its target gone: on straight)
      const speed = Math.hypot(r.v[0], r.v[1], r.v[2]) || 1;
      if (r.target && r.age > RAILS) steer(r.v, dirTo(r, intercept(r, speed, r.target.at, r.target.vel) ?? r.target.at), r.homing, dt);
      const from = { x: r.x, y: r.y, z: r.z };
      r.x += r.v[0] * dt;
      r.y += r.v[1] * dt;
      r.z += r.v[2] * dt;
      // near its target it bursts; into something on the way, it bursts there; at the end of its flight, too
      const near = r.target && apart(r, r.target.at) < P.near;
      const hit = near ? null : strike(from, r, r.punch, { vel: r.v, pilots: false, warPunch: r.punch * SUB });
      if (near || hit || r.life <= 0) {
        burst(r);
        run.rounds.splice(i, 1);
      }
    }
  };
  const arcs = (dt) => {
    for (let i = run.arcs.length - 1; i >= 0; i--) {
      const a = run.arcs[i];
      a.age += dt;
      a.k = Math.max(0, 1 - a.age / SHIP_FX.energon.show);
      if (a.k <= 0) run.arcs.splice(i, 1);
      // (it flickers: struck afresh a couple of times while it shows)
      else if (Math.random() < dt * 20) a.points = jagged(a.points[0], a.points[a.points.length - 1], ARC_POINTS);
    }
  };

  return {
    fire,
    frame(dt) {
      if (!this.busy) return;
      fx.update(dt);
      charges(dt);
      orbs(dt);
      rounds(dt);
      arcs(dt);
      fx.charges(run.charges);
      fx.rings(run.rings);
      fx.orbs(run.orbs);
      fx.gems(run.rounds);
      fx.arcs(run.arcs);
    },
    get busy() {
      return Boolean(run.charges.length || run.rings.length || run.orbs.length || run.rounds.length || run.arcs.length);
    },
    // a crash, a landing, a jump away: what's in flight is gone
    clear() {
      gen += 1;
      for (const k of Object.keys(run)) run[k].length = 0;
      fx.clear();
    },
    dispose() {
      fx.dispose();
    },
  };
}

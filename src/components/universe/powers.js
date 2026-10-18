// The crews' ship powers in a scene that flies the universe's ships (the
// universe map, and the galaxy through shared/flying.js): shipPowers.js says
// what each does and when it's on, powerFx.js draws them, and this plays
// them out in the scene (the scene hands it its pieces and calls it at the
// moments that matter, so the scene itself only grows by the calls). A
// scene with no war hands `war: null`.
//
// - Force Focus: the hunters' clock and the war's battle's at a third, the
//   guns' help onto the lead and the nose's tracking of the lock turned up
//   (onto the game's own ships only), the picture's edges pulled apart a
//   little and the light dimmed.
// - The torpedo salvo: four, launched off alternate wingtips a moment apart,
//   each homing on its own target (the ones coming at you in the cone
//   first), and through the scene's own hit test as they go (strike), with
//   the cut damage on a battle's objectives.
// - Never tell me the odds: a corkscrew and a sidestep the way the stick
//   rolls, the ship a ghost to the lasers (hunterRules.js's), and everyone on
//   a run or your tail broken off.
// - Chewie on the quad guns: a shot every so often from the dorsal and the
//   ventral turret in turn, at whoever's nearest coming at you, all the way
//   round; seven in ten land, the rest go wide.
// - The portal gun: in at a swirl ahead of the nose (the lasers near it
//   swallowed), and out of another behind the lock, facing the way it's
//   going, or a long hop on. Not through Scarif's shield, nor out of the
//   tractor beam or a set piece's hold.
// - Wubba lubba dub dub: the cruiser's ray from the nose, into whatever's
//   first in its way ten times a second, the stick heavy while it's on.
// - Magnets: everyone near held, dragged into a ball ahead of the RV with
//   their guns jammed, sparks crawling to it.
// - Say my name: a crystal thrown along the nose (onto the lock's lead), going
//   off at its fuse or when it's near anything, the blast hardest in its
//   middle.
// Only the game's own ships are touched (the hunters, and the war's battle:
// its time and its ghost through warfront.js's update, Walt's magnet through
// its pull, and every hit as a shot through its own hit()); never another
// pilot. The big one's charge and the power's cooldown are kept in the
// session (KEPT_KEY) so a landing neither loses the one nor ends the other;
// another crew starts from nothing.
//
// createGalaxyPowers({ parent, reduced, hunters, war, bolts, flashes, crashFx, pops, post, state, emit, strike, scored, teleport, controls })
//   → { setCrew(kind, { fx, picks }), press(slot) → { ok, id } or { ok: false, why }, gain(what, key), pickup(), mods, aim(own),
//       shipFor(live), warOpts, hold, afterStep(ship, dt) → ship, roll, hidden, frame(dt, live),
//       cancel(), place(el, on), view, info, busy, keep(), fill(), dispose() }
// state: the scene's (its ship, lock, world, space, keys and stick, and the
// shake and flare it plays); strike(from, to, punch, opts) and scored(hit,
// opts): the scene's hit test and what a hit does; teleport(pose): the ship
// put there, the camera with it.

import * as THREE from 'three';
import { KEPT_KEY, POWERS, aimHelp, beamOf, blastPunch, cancel as cancelAll, clearOfSolids, createPowers, crossesShell, finish, firstAlong, gain as charge, hasten, isObjective, isOn, jinkStep, mods as modsOf, pickTargets, portalExit, press as pressSlot, readCooling, readKept, shotAt, step, turretPick, view as viewOf, writeKept } from './shipPowers';
import { createPowerFx } from './powerFx';
import { steer } from './weapons';
import { assist, dirTo, intercept, nose } from './targeting';

const SLOTS = ['primary', 'ultimate'];
// Chewie's bolts off the quad guns: the Rebellion's red, hot enough to bloom (galaxy/fx.js's LASER.rebel; a scene may hand its own as `laser`)
const REBEL_LASER = [5.8, 0.75, 0.55];
const BIG = 3; // kills from one big one that make a big haul (the crew's line for it)
const KEEP_EVERY = 2; // seconds between writes of the charge to the session
const SPARKS = 0.07; // seconds between the magnet's sparks
const FOCUS_EASE = 0.25; // seconds Force Focus's look takes to come and go
const CRYSTAL_OUT = 1.8; // how far ahead of the ship's middle Walt's crystal is thrown from
const CRYSTAL_GROW = 0.1; // seconds it takes to grow to its size
const NONE = Object.freeze(modsOf(null));
const PHASE_WORDS = { ready: 'ready', active: 'on', cooling: 'cooling down', charging: 'charging' };
// why a press was refused, in a word for the cluster's tile, kept 2 s (DENIED_FOR, in ms)
const WHY_WORDS = { held: 'Held', solid: 'No room', shield: 'Shielded', empty: 'Nobody near', cooling: 'Cooling', charging: 'Charging', active: 'On', none: '' };
const DENIED_FOR = 2000;

const apart = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const ahead = (s, d) => {
  const [nx, ny, nz] = nose(s);
  return { x: s.x + nx * d, y: s.y + ny * d, z: s.z + nz * d };
};
// (the session can be closed to us: a private window, storage blocked)
const session = {
  get: () => {
    try {
      return window.sessionStorage.getItem(KEPT_KEY);
    } catch {
      return null;
    }
  },
  set: (v) => {
    try {
      if (v) window.sessionStorage.setItem(KEPT_KEY, v);
    } catch {
      // not kept, then: the next take-off starts from nothing
    }
  },
};

export function createGalaxyPowers({ parent, reduced, hunters, war, bolts, flashes, crashFx, pops, post, state, emit, strike, scored, teleport, controls, laser = REBEL_LASER }) {
  // (with motion reduced there are no hunters or battles to use them on: no powers)
  const fx = reduced || !hunters ? null : createPowerFx(parent);
  let st = null;
  let m = NONE;
  let hold = false; // a set piece holding the ship, as of the war's last frame
  let focusK = 0;
  let keptFor = 0;
  let lastSide = 1;
  let gen = 0; // bumped at a cancel: what was in flight then lands on nothing
  const run = { kills: 0, torps: [], queue: [], salvo: 0, jink: null, hop: null, beam: null, turret: null, magnet: null, crystal: null };
  const v1 = new THREE.Vector3();
  const v2 = new THREE.Vector3();

  const say = (what, slot, id, more = {}) => emit({ type: 'power', what, id, slot, crew: st?.crew ?? null, ...more });

  // what the powers may go for: the hunters after you (not prey-chasers' quarry)
  // and the war's (its fighters only, for Chewie)
  const huntersNow = () => (hunters?.targets ?? []).filter((t) => !t.prey);
  const warNow = () => war?.targets ?? [];
  const warFighters = () => warNow().filter((t) => !isObjective(t));
  // a power's hit on one of the war's: a shot through its own hit(), aimed
  // at it from `from` (shipPowers.js's shotAt), so it counts as the guns' do
  const warStrike = (t, from, punch, by) => {
    const s = shotAt(t, from);
    const r = war?.hit(s.from, s.to, punch);
    return r ? scored(kill(r), { src: 'war', by }) : null;
  };
  const known = (t) => Boolean(t) && (hunters?.targets.includes(t) || warNow().includes(t));
  const srcOf = (t) => (hunters?.targets.includes(t) ? 'hunters' : 'war');
  // a battle's punch for what a shot from `from` to `to` meets first: its
  // fighters the whole of it, its objectives the cut (`sub`)
  const warPunch = (from, to, punch, sub, dt) => {
    const t = firstAlong(from, to, warNow(), dt);
    return t && !isObjective(t) ? punch : sub;
  };
  const kill = (r) => {
    if (r?.down) run.kills += 1;
    return r;
  };

  // ── each power, as it goes on ──
  const start = (id, { exit, target, magnetAt }) => {
    const s = state;
    const ship = s.ship;
    run.kills = POWERS[id].slot === 'ultimate' ? 0 : run.kills;
    if (id === 'salvo') {
      const P = POWERS.salvo;
      const picked = pickTargets(ship, [...huntersNow(), ...warNow()], P);
      const lock = known(s.lockTarget) ? s.lockTarget : null;
      run.salvo = 0;
      run.queue = Array.from({ length: P.count }, (_, i) => ({ at: i * P.every, target: picked[i] ?? lock ?? picked[i % Math.max(1, picked.length)] ?? null, side: i % 2 ? 1 : -1 }));
    } else if (id === 'odds') {
      const roll = (s.keys.d ? 1 : 0) - (s.keys.a ? 1 : 0) + (s.stick?.on ? Math.sign(s.stick.dx) : 0);
      lastSide = roll ? Math.sign(roll) : -lastSide;
      run.jink = { t: 0, side: lastSide, roll: 0 };
      hunters.breakOff();
    } else if (id === 'quad') run.turret = { next: 0, prev: null, side: 1 };
    else if (id === 'portal') {
      // (its mouth where the ship will be as the hop goes: it's flown into)
      const P = POWERS.portal;
      const mouth = ahead(ship, Math.min(P.mouth, Math.max(0.6, ship.speed * P.dur)));
      crashFx.arrive({ point: v1.set(mouth.x, mouth.y, mouth.z), kind: 'cruiser' });
      hunters.swallow(mouth, P.swallow);
      run.hop = { exit, target };
    } else if (id === 'wubba') run.beam = { tick: 0, reach: POWERS.wubba.length };
    else if (id === 'magnets') run.magnet = { at: magnetAt, k: 0, sparks: 0 }; // (they're held already: press)
    else if (id === 'heisenberg') {
      const P = POWERS.heisenberg;
      const speed = P.speed + Math.max(0, ship.speed);
      let dir = nose(ship);
      const tgt = known(s.lockTarget) ? s.lockTarget : null;
      const lead = tgt && intercept(ship, speed, tgt.at, tgt.vel);
      if (lead) dir = assist(dir, dirTo(ship, lead), Math.max(controls().assist, 1));
      // (thrown from well out ahead of the nose: from the ship's middle it was
      // just in front of the chase camera, a faceted blue ball over the picture)
      const out = CRYSTAL_OUT;
      run.crystal = { x: ship.x + dir[0] * out, y: ship.y + dir[1] * out, z: ship.z + dir[2] * out, vx: dir[0] * speed, vy: dir[1] * speed, vz: dir[2] * speed, age: 0 };
    }
  };

  // one that's gone off (its time up, its work done, or cancelled): what
  // it left in flight put away, and a big haul said
  const ended = (slot, id, { quiet = false } = {}) => {
    if (id === 'salvo') {
      run.torps.length = 0;
      run.queue.length = 0;
    } else if (id === 'odds') run.jink = null;
    else if (id === 'quad') run.turret = null;
    else if (id === 'portal') {
      if (run.hop && !quiet) exitHop();
      run.hop = null;
    }
    else if (id === 'wubba') run.beam = null;
    else if (id === 'magnets') run.magnet = null;
    else if (id === 'heisenberg') run.crystal = null;
    say('end', slot, id);
    if (slot === 'ultimate' && !quiet && run.kills >= BIG) say('big', slot, id, { kills: run.kills });
    if (slot === 'ultimate') run.kills = 0;
  };
  const done = (slot) => {
    for (const e of finish(st, slot)) ended(e.slot, e.id);
  };

  // ── each frame, what's on ──
  const torpedoes = (dt) => {
    const P = POWERS.salvo;
    const s = state.ship;
    run.salvo += dt;
    while (run.queue.length && run.queue[0].at <= run.salvo) {
      const q = run.queue.shift();
      const [nx, ny, nz] = nose(s);
      const rx = Math.cos(s.heading);
      const rz = -Math.sin(s.heading);
      const v = P.speed + Math.max(0, s.speed);
      run.torps.push({ x: s.x + nx * 0.2 + rx * 0.12 * q.side, y: s.y + ny * 0.2, z: s.z + nz * 0.2 + rz * 0.12 * q.side, v: [nx * v, ny * v, nz * v], vx: 0, vy: 0, vz: 0, life: P.life, target: q.target });
      say('launch', 'ultimate', 'salvo');
    }
    const live = new Set([...(hunters?.targets ?? []), ...warNow()]);
    for (let i = run.torps.length - 1; i >= 0; i--) {
      const t = run.torps[i];
      t.life -= dt;
      if (t.target && !live.has(t.target)) t.target = null; // (its target gone: on straight)
      const speed = Math.hypot(t.v[0], t.v[1], t.v[2]) || 1;
      if (t.target) steer(t.v, dirTo(t, intercept(t, speed, t.target.at, t.target.vel) ?? t.target.at), P.turn, dt);
      let from = { x: t.x, y: t.y, z: t.z };
      t.x += t.v[0] * dt;
      t.y += t.v[1] * dt;
      t.z += t.v[2] * dt;
      [t.vx, t.vy, t.vz] = t.v;
      let to = { x: t.x, y: t.y, z: t.z };
      // (close enough to its target, it goes off on it: through it, so the hit test meets it)
      if (t.target && apart(t, t.target.at) < P.near) {
        const a = t.target.at;
        from = to;
        to = { x: a.x + (t.v[0] / speed) * 0.5, y: a.y + (t.v[1] / speed) * 0.5, z: a.z + (t.v[2] / speed) * 0.5 };
      }
      const hit = kill(strike(from, to, P.punch * big, { vel: t.v, pilots: false, warPunch: warPunch(from, to, P.punch * big, P.sub * big, dt), by: 'salvo' }));
      if (hit || t.life <= 0) {
        if (!hit) flashes.at(v1.set(t.x, t.y, t.z), { size: 0.35, color: [2.6, 1.1, 0.35], life: 0.4 });
        run.torps.splice(i, 1);
      }
    }
    fx.torpedoes(run.torps);
    if (!run.torps.length && !run.queue.length) done('ultimate');
  };

  const jink = (ship, dt) => {
    const j = run.jink;
    const step1 = jinkStep(j.t, dt, POWERS.odds, j.side);
    j.t += dt;
    j.roll = step1.roll;
    const p = { x: ship.x + Math.cos(ship.heading) * step1.step, y: ship.y, z: ship.z - Math.sin(ship.heading) * step1.step };
    clearOfSolids(p, state.space?.solids ?? [], 0.5); // (down in the Death Star's trench, kept in it)
    return { ...ship, x: p.x, y: p.y, z: p.z };
  };

  const turret = (dt) => {
    const P = POWERS.quad;
    const tu = run.turret;
    tu.next -= dt;
    while (tu.next <= 0) {
      tu.next += P.every;
      const s = state.ship;
      const pool = [...huntersNow(), ...warFighters()];
      const t = turretPick(s, pool, P.range, tu.prev);
      if (!t) continue;
      tu.prev = t.id;
      tu.side = -tu.side;
      const from = v1.set(s.x, s.y + 0.08 * tu.side, s.z);
      const lead = intercept(from, P.speed, t.at, t.vel) ?? t.at;
      const lands = Math.random() < P.chance;
      v2.set(lead.x, lead.y, lead.z);
      if (!lands) v2.add(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(P.miss));
      const src = srcOf(t);
      const was = gen;
      const origin = { x: from.x, y: from.y, z: from.z };
      bolts.fire(from, v2, {
        color: laser,
        speed: P.speed,
        width: 0.045,
        length: 2.2,
        onHit: lands
          ? () => {
              if (was !== gen) return;
              if (src === 'hunters') {
                const r = hunters.damage(t.id, P.punch * big);
                if (r) scored(kill(r), { src, by: 'quad' });
                return;
              }
              // (one of the war's, if it's still up: one shot down comes back
              // as the same one, but seconds later, long after a bolt's landed)
              if (warNow().includes(t)) warStrike(t, origin, P.punch * big, 'quad');
            }
          : null,
      });
      say('shot', 'ultimate', 'quad');
    }
  };

  // out of the portal, as it closes (the portal's time is the hop's): behind
  // where the target is now, if it's still there and that's not through the
  // shield, else where it was; the other swirl just behind, round the ship
  // as it comes out (any further back and the chase camera is past it before
  // it's open)
  // (where the portal lets the ship out: shipPowers.js's portalExit, inside
  // the system's edge, ceiling and floor, with room ahead of it)
  const exitFor = (target) => portalExit(state.ship, target, POWERS.portal, state.space?.solids ?? [], { edge: state.space?.edge ?? Infinity, ceiling: state.space?.ceilingAt ?? null });
  const exitHop = () => {
    const s = state;
    let exit = run.hop.exit;
    if (known(run.hop.target)) {
      const again = exitFor(run.hop.target);
      if (again && !(s.world?.shield && crossesShell(s.ship, again, s.world.shield.r))) exit = again;
    }
    teleport({ x: exit.x, y: exit.y, z: exit.z, heading: exit.heading, pitch: exit.pitch, bank: 0, speed: exit.speed });
    const [fx, fy, fz] = nose(exit);
    pops.arrive({ point: v1.set(exit.x - fx * 0.3, exit.y - fy * 0.3, exit.z - fz * 0.3), kind: 'cruiser' });
  };

  const ray = (dt) => {
    const P = POWERS.wubba;
    const b = beamOf(state.ship, P.length);
    const r = run.beam;
    r.tick -= dt;
    if (r.tick <= 0) {
      r.tick += P.tick;
      const hit = kill(strike(b.from, b.to, P.punch * big, { pilots: false, warPunch: warPunch(b.from, b.to, P.punch * big, P.sub * big, P.tick), by: 'wubba' }));
      r.reach = hit ? apart(b.from, hit.at) : P.length;
    }
    const n = nose(state.ship);
    fx.beam(b.from, { x: b.from.x + n[0] * r.reach, y: b.from.y + n[1] * r.reach, z: b.from.z + n[2] * r.reach });
    if (!reduced) state.shake = Math.max(state.shake, 0.15);
  };

  const magnet = (dt) => {
    const mg = run.magnet;
    mg.k = Math.min(1, mg.k + dt * 4);
    fx.magnet(mg.at, mg.k * (0.75 + 0.25 * Math.sin(state.clock * 14)));
    // sparks crawling in from the ones it holds
    mg.sparks -= dt;
    if (mg.sparks > 0) return;
    mg.sparks = SPARKS;
    const held = (hunters?.targets ?? []).filter((t) => t.held);
    const t = held[Math.floor(Math.random() * held.length)];
    if (t) bolts.fire(v1.set(t.at.x, t.at.y, t.at.z), v2.set(mg.at.x, mg.at.y, mg.at.z), { color: [0.7, 1.9, 4.2], speed: 40, width: 0.012, length: 0.7 });
  };

  const blast = (at) => {
    const P = POWERS.heisenberg;
    fx.crystal(null);
    // (the shell and the flash drawn well short of the blast's whole reach:
    // with the magnet's ball six units ahead, the bang is close, and its
    // whole size would be all you saw)
    fx.shock(at, P.radius * 0.55);
    flashes.at(v1.set(at.x, at.y, at.z), { size: 2.4, color: [0.7, 1.6, 4.2], life: 0.8, bright: 0.6 });
    if (!reduced) {
      state.shake = Math.max(state.shake, 0.6);
      state.flare = Math.max(state.flare, 1.25);
    }
    say('blast', 'ultimate', 'heisenberg');
    for (const t of huntersNow()) {
      const d = apart(t.at, at);
      if (d > P.radius) continue;
      const r = hunters.damage(t.id, blastPunch(d, P) * big);
      if (r) scored(kill(r), { src: 'hunters', normal: v2.set(t.at.x - at.x, t.at.y - at.y + 1, t.at.z - at.z).normalize(), by: 'heisenberg' });
    }
    // the war's battle: each of its within reach, a shot at it from the
    // blast through its own hit() (the cut on its objectives)
    for (const t of [...warNow()]) {
      const d = apart(t.at, at);
      if (d <= P.radius) warStrike(t, at, blastPunch(d, P) * big * (isObjective(t) ? P.sub : 1), 'heisenberg');
    }
    run.crystal = null;
    done('ultimate');
  };

  const crystal = (dt) => {
    const P = POWERS.heisenberg;
    const c = run.crystal;
    c.age += dt;
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    c.z += c.vz * dt;
    const near = [...huntersNow(), ...warNow()].some((t) => apart(t.at, c) < P.near);
    if (near || c.age >= P.fuse) blast({ x: c.x, y: c.y, z: c.z });
    else fx.crystal(c, c.age / CRYSTAL_GROW);
  };

  // Force Focus's look: the edges pulled apart a little and the light
  // dimmed, eased in and out (only set while it's on or going: nothing
  // else in the galaxy sets them)
  const focusLook = (dt) => {
    const want = isOn(st, 'focus') ? 1 : 0;
    if (want === focusK) return;
    focusK = want > focusK ? Math.min(1, focusK + dt / FOCUS_EASE) : Math.max(0, focusK - dt / FOCUS_EASE);
    post.aberration(0.007 * focusK);
    post.exposure(1 - 0.12 * focusK);
  };

  const clearRun = () => {
    gen += 1;
    run.torps.length = 0;
    run.queue.length = 0;
    run.jink = run.hop = run.beam = run.turret = run.magnet = run.crystal = null;
    run.kills = 0;
    fx?.clear();
  };

  let bar = { root: null };
  let denied = null; // { slot, why, until }: the last refusal, while the tile still says why
  let crewSig = null; // (the crew, skills and picks the state was made for)
  let big = 1; // the skill tree's overcharge: the big ones' punch
  return {
    // the crew flying, with the skill tree's effects and the pair it carries
    // (hangar/skills's fx and shipPowers.js's picksFor): a crew change starts
    // from nothing; new skills or picks for the same crew keep its charge and
    // its cooldown
    setCrew(kind, { fx: skillFx = null, picks = null } = {}) {
      const sig = JSON.stringify([kind ?? null, skillFx, picks]);
      if (sig === crewSig) return;
      const same = (st?.crew ?? null) === (kind ?? null);
      crewSig = sig;
      if (same) this.keep();
      denied = null;
      clearRun();
      const kept = session.get();
      st = fx && kind ? createPowers(kind, { charge: readKept(kept, kind), cool: readCooling(kept, kind, Date.now()), fx: skillFx, picks }) : null;
      big = Number.isFinite(skillFx?.bigPunch) && skillFx.bigPunch > 0 ? skillFx.bigPunch : 1;
      m = modsOf(st);
      this.keep(); // (another crew's charge gone at once: a crew change starts from nothing, and stays so if you change back)
    },

    // G or X: on, if it can be (the scene has checked you're flying); what
    // won't go says why
    press(slot) {
      const id = st?.[slot]?.id;
      if (!id) return { ok: false, why: 'none' };
      const s = state;
      let exit = null;
      let target = null;
      if (id === 'portal' && st.primary.phase === 'ready') {
        const P = POWERS.portal;
        // (no portal out of the tractor beam's hold, or a set piece's)
        if (s.pull > 0.3 || hold) return this.deny(slot, id, 'held');
        target = known(s.lockTarget) && apart(s.lockTarget.at, s.ship) <= P.range ? s.lockTarget : null;
        exit = exitFor(target);
        // (nowhere to come out with room to turn off what's ahead: no portal, and no cooldown spent)
        if (!exit) return this.deny(slot, id, 'solid');
        if (s.world?.shield && crossesShell(s.ship, exit, s.world.shield.r)) return this.deny(slot, id, 'shield');
      }
      let magnetAt = null;
      if (id === 'magnets' && st.primary.phase === 'ready') {
        // everyone near enough held (the hunters and the war's fighters); with
        // nobody, no magnet, and no cooldown spent on nothing
        const P = POWERS.magnets;
        magnetAt = ahead(s.ship, P.ahead);
        const held = hunters.pull(magnetAt, P.radius, P.pull, P.dur, P.daze) + (war?.pull(magnetAt, P.radius, P.dur, P.daze) ?? 0);
        if (!held) return this.deny(slot, id, 'empty');
      }
      const r = pressSlot(st, slot);
      if (!r.ok) return this.deny(slot, id, r.why);
      start(id, { exit, target, magnetAt });
      m = modsOf(st);
      say('use', slot, id);
      this.keep();
      return r;
    },
    deny(slot, id, why) {
      say('denied', slot, id, { why });
      denied = { slot, why, until: performance.now() + DENIED_FOR };
      return { ok: false, why };
    },

    // what your guns did, toward the big one ('hit', 'kill', 'ace',
    // 'objective', or nothing: shipPowers.js's chargeFor), `key` what was hit
    // (a hit's share is by what it hit); a kill's charge kept at once, not
    // at the next of the every-two-seconds writes (at a low frame rate those
    // are far apart, and a landing may come first)
    gain(what, key = null) {
      if (!st || !what) return;
      const full = charge(st, what, 1, key);
      if (full) say('ready', 'ultimate', st.ultimate.id);
      if (full || what !== 'hit') this.keep();
    },
    // a power cell picked up (pickups.js): the big one charged a quarter and G's cooldown cut 5 s
    pickup() {
      if (!st) return;
      const full = charge(st, 'pickup', 1);
      if (full) say('ready', 'ultimate', st.ultimate.id);
      if (hasten(st, 5)) say('ready', 'primary', st.primary.id);
      this.keep();
    },
    get mods() {
      return m;
    },
    // the guns' help onto the lead and the nose's tracking of the lock
    // (`own`: the flight settings'), Force Focus's only while the lock is one
    // of the game's own ships: never onto another pilot
    aim(own) {
      return aimHelp(m, own, known(state.lockTarget));
    },
    // the ship as the hunters are handed it: a ghost, or with the magnet ahead
    shipFor(live) {
      if (!live || (!m.ghost && !run.magnet)) return live;
      if (run.magnet) run.magnet.at = ahead(live, POWERS.magnets.ahead);
      return { ...live, ghost: m.ghost, magnet: run.magnet?.at ?? null };
    },
    // what the war's battle is handed: its time slowed, a ghost its fire
    // flies through, the magnet its held fighters are dragged to (warfront.js,
    // universe/battlePowers.js)
    get warOpts() {
      return { slow: m.slow, ghost: m.ghost, magnet: run.magnet?.at ?? null, pull: POWERS.magnets.pull };
    },
    set hold(on) {
      hold = on;
    },
    // the ship just stepped: Han's sidestep on it
    afterStep(ship, dt) {
      return run.jink ? jink(ship, dt) : ship;
    },
    // the corkscrew's roll, for the model
    get roll() {
      return run.jink?.roll ?? 0;
    },
    // gone through a portal: the other pilots see you vanish (the pose's own flag)
    get hidden() {
      return Boolean(run.hop);
    },

    frame(dt, live) {
      if (!st) return;
      for (const e of step(st, dt, { flying: Boolean(live) })) {
        if (e.type === 'end') ended(e.slot, e.id);
        else say('ready', e.slot, e.id);
      }
      m = modsOf(st);
      if (live) {
        if (run.queue.length || run.torps.length) torpedoes(dt);
        if (run.turret) turret(dt);
        if (run.beam) ray(dt);
        else fx.beam(null);
        if (run.magnet) magnet(dt);
        else fx.magnet(null);
        if (run.crystal) crystal(dt);
      }
      focusLook(dt);
      fx.update(dt);
      keptFor += dt;
      if (keptFor >= KEEP_EVERY) this.keep();
    },

    // shot down, crashed, jumping: whatever's on stops (the charge stays)
    cancel() {
      if (!st) return;
      for (const e of cancelAll(st)) ended(e.slot, e.id, { quiet: true });
      clearRun();
      m = modsOf(st);
    },

    // the HUD (PowerBar.jsx's): each slot's phase, its ring (--k) and its
    // seconds, written only when they change
    place(root, on) {
      if (root !== bar.root) {
        const q = (slot) => root?.querySelector(`[data-slot="${slot}"]`) ?? null;
        const part = (slot, sel) => q(slot)?.querySelector(sel) ?? null;
        bar = { root, on: null, slots: Object.fromEntries(SLOTS.map((slot) => [slot, q(slot)])), small: Object.fromEntries(SLOTS.map((slot) => [slot, part(slot, 'small')])), state: Object.fromEntries(SLOTS.map((slot) => [slot, part(slot, '.hud-power-state')])), sig: {} };
      }
      if (!root) return;
      const shown = Boolean(on && st);
      if (shown !== bar.on) {
        bar.on = shown;
        root.toggleAttribute('data-on', shown);
      }
      if (!shown) return;
      const v = viewOf(st);
      for (const slot of SLOTS) {
        const el = bar.slots[slot];
        if (!el) continue;
        const x = v[slot];
        const k = Math.round(x.k * 50) / 50;
        const text = x.phase === 'active' || x.phase === 'cooling' ? `${x.left}s` : x.phase === 'charging' ? `${Math.floor(x.charge * 100)}%` : '';
        // (the cluster's word: a refusal's reason for a couple of seconds, else where the power stands)
        const no = denied && denied.slot === slot && performance.now() < denied.until ? (WHY_WORDS[denied.why] ?? '') : '';
        const words = no || (x.phase === 'active' ? `On ${x.left}s` : x.phase === 'cooling' ? `${x.left}s` : x.phase === 'charging' ? `${Math.floor(x.charge * 100)}%` : 'Ready');
        const sig = `${x.phase}|${k}|${text}|${no}`;
        if (bar.sig[slot] === sig) continue;
        const phaseWas = bar.sig[slot]?.split('|')[0];
        bar.sig[slot] = sig;
        el.style.setProperty('--k', String(k));
        if (bar.small[slot]) bar.small[slot].textContent = text;
        if (bar.state[slot]) bar.state[slot].textContent = words;
        el.toggleAttribute('data-denied', Boolean(no));
        if (phaseWas !== x.phase) {
          el.dataset.phase = x.phase;
          el.setAttribute('aria-label', `${x.name} (${x.key}): ${PHASE_WORDS[x.phase]}`);
        }
      }
    },

    get view() {
      return viewOf(st);
    },
    // (for checking from a browser)
    get info() {
      if (!st) return null;
      return { ...viewOf(st), torpedoes: run.torps.length + run.queue.length, jink: Boolean(run.jink), hop: Boolean(run.hop), beam: Boolean(run.beam), turret: Boolean(run.turret), magnet: run.magnet && { ...run.magnet.at }, crystal: Boolean(run.crystal), kills: run.kills, focus: +focusK.toFixed(2) };
    },
    get busy() {
      return Boolean(fx?.busy || focusK > 0 || run.queue.length || run.torps.length || run.jink || run.hop || run.beam || run.turret || run.magnet || run.crystal);
    },
    // the big one's charge and the power's cooldown, into the session
    keep() {
      keptFor = 0;
      if (st) session.set(writeKept(st, Date.now()));
    },
    // (DEV: the big one charged, to try it)
    fill() {
      if (!st) return false;
      this.gain('kill');
      while (st.ultimate.phase === 'charging') this.gain('kill');
      return true;
    },
    dispose() {
      this.keep();
      if (focusK > 0) {
        post.aberration(0);
        post.exposure(1);
      }
      fx?.dispose();
    },
  };
}

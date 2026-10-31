// A battle's fighters in flights (battleTactics.js chooses their targets,
// battleAi.js flies them; this is how they fly together, under createBattle's
// `tactics`, the galaxy's). Pure (no three.js), tested in Node through
// battle.js.
//
// One fighter at a time, a dogfight was sixty duels; flights of three make
// it a battle:
// - each side's fighters fly in flights of three of a kind (the order they
//   were put up in), the first of a flight still in the fight its leader:
//   the leader picks the target (battleTactics.js), and the wingmen take it,
//   or whoever's on the leader's tail;
// - on the way to it (further than FLIGHTS.transit), the wingmen hold their
//   slots off the leader's wing, and the leader eases off till they're up;
// - each flight of bombers has a flight of fighters to escort it, which goes
//   after whatever comes for the bombers and otherwise keeps near them;
// - the defender's interceptors fly cover over the ship the objectives are
//   on: they take on only what comes near it, and circle it otherwise;
// - the objectives keep a tally of the threat to them (the enemy near, and
//   the hits lately), and the defender weighs the enemy round the most
//   threatened one twice;
// - a fighter down to a third of its hull goes home to its carrier's hangar
//   (a ship that carries fighters, or the flagship), and after FLIGHTS.docked
//   seconds there is back in at its full hull, no ticket spent; a flight
//   outnumbered three to one (squad.js's confidence: panicked) breaks for
//   home together;
// - the fighters shot down come back together, in waves on the battle's
//   clock (the attacker's every 20 s, the defender's every 30), out of
//   their carriers' hangars: not one at a time, a few seconds after each
//   went down;
// - once the battle's over, the losing side's fighters go home.
//
// createFlights(k) → { form(), adopt(fighters), lead(f), escortOf(f),
//   cover(f), threat, sense(), nerve(flight), step(dt, out), steer(f, dist) };
// hangarAt(cap, out) → a capital ship's hangar point (battleHome.js too).
// `k` is the battle's inner context (battle.js's createBattle).

import { confidence } from '../../lib/ai/squad';
import { copy, cross, dist2, norm, set, v3 } from './battleKit';

export const FLIGHTS = {
  size: 3, // fighters to a flight
  transit: 40, // further than this from its target, a wingman holds its slot
  slot: [3, 2], // its slot: this far out to the side, this far back
  rejoin: 1.3, // how much faster than its best a wingman catches up to its slot
  ease: 0.85, // and how much the leader eases off while it does
  cover: 50, // the defender's interceptors' cover over the objective ship
  coverReach: 80, // and how far off it they'll go after anything
  orbit: 35, // how far off it they circle, with nothing to take on
  escortReach: 45, // an escort goes after what's this near its bombers
  threat: 40, // an enemy this near an objective is a threat to it
  heat: 10, // seconds a hit on an objective counts in its threat
  weigh: 2, // and how much more the defender weighs the enemy round the most threatened
  rtb: 0.35, // a fighter goes home with this share of its hull left
  dock: 10, // within this of its hangar it's home
  docked: 6, // and after this long there, it's back in at its full hull
  waves: { attacker: 20, defender: 30 }, // seconds between each side's waves of fighters back in
  nerve: 60, // the enemy this near a flight counts against its nerve
  nerveEvery: 2, // seconds between a flight's nerve being weighed
  carriers: ['destroyer', 'venator', 'moncal', 'lucrehulk', 'executor', 'acclamator'], // the ships fighters fly home to
};
const CARRIERS = new Set(FLIGHTS.carriers);

// A capital ship's hangar: under its middle, clear of the hull (into `out`)
export function hangarAt(cap, out) {
  let r = 0;
  let near = Infinity;
  for (const sp of cap.spheres) {
    const d = dist2(sp.c, cap.pos);
    if (d < near) (near = d), (r = sp.r);
  }
  return set(out, cap.pos.x - cap.up.x * (r + 4), cap.pos.y - cap.up.y * (r + 4), cap.pos.z - cap.up.z * (r + 4));
}

export function createFlights(k) {
  const { b, A, C } = k;
  const flights = [];
  let threat = null; // the most threatened objective now: { pos, score }
  let heat = 0; // hits on the objective ship lately (for its threat)
  let senseAt = -Infinity;
  const tmp = v3();
  const right = v3();

  const leaderOf = (fl) => fl.members.find((m) => m.alive && m.mode !== 'rtb') ?? null;
  // the ship a fighter flies home to: the nearest of its side's that carry fighters, or its flagship
  const carrierOf = (f) => {
    let best = null;
    let bd = Infinity;
    for (const cap of b.capitals) {
      if (cap.team !== f.team || !cap.alive || cap.dying > 0 || !CARRIERS.has(cap.kind)) continue;
      const d = dist2(cap.pos, f.pos);
      if (d < bd) (bd = d), (best = cap);
    }
    if (best) return best;
    const flag = k.flagOf(f.team);
    return flag?.alive && flag.dying <= 0 ? flag : null;
  };
  // its hangar (kept on the ship, made once)
  const hangarOf = (cap) => hangarAt(cap, (cap.hangar ??= v3()));

  const make = (team, members) => {
    const fl = { id: flights.length, team, members, role: members[0].role, escort: null, escorting: null, cap: false, nerveAt: flights.length * 0.37 };
    members.forEach((m, i) => Object.assign(m, { flight: fl, wing: i }));
    flights.push(fl);
    return fl;
  };
  // a side's flights in threes, in the order they were put up
  const group = (team, list) => {
    const out = [];
    for (let i = 0; i < list.length; i += FLIGHTS.size) out.push(make(team, list.slice(i, i + FLIGHTS.size)));
    return out;
  };
  // each flight of bombers given a flight of fighters to escort it (fighters
  // first, then interceptors not flying cover), and the defender's
  // interceptors put on cover over the objective ship
  const pair = (team) => {
    const own = flights.filter((fl) => fl.team === team);
    if (team === k.defender && k.objOf()) for (const fl of own) if (fl.role === 'interceptor') fl.cap = true;
    const free = [...own.filter((fl) => fl.role === 'fighter'), ...own.filter((fl) => fl.role === 'interceptor' && !fl.cap)].filter((fl) => !fl.escorting);
    for (const fl of own) {
      if (fl.role !== 'bomber' || fl.escort) continue;
      const e = free.shift();
      if (!e) break;
      fl.escort = e;
      e.escorting = fl;
    }
  };
  // a wingman put in its slot off its leader's wing (the battle's first moments, a wave launched)
  const slotOf = (f, lead, out) => {
    norm(cross(lead.fwd, { x: 0, y: 1, z: 0 }, right));
    const side = f.wing % 2 ? 1 : -1;
    const out1 = FLIGHTS.slot[0] * Math.ceil(f.wing / 2) * side;
    return set(out, lead.pos.x + right.x * out1 - lead.fwd.x * FLIGHTS.slot[1] * f.wing, lead.pos.y + right.y * out1 - lead.fwd.y * FLIGHTS.slot[1] * f.wing + 0.4 * f.wing, lead.pos.z + right.z * out1 - lead.fwd.z * FLIGHTS.slot[1] * f.wing);
  };
  const formUp = (fl) => {
    const lead = leaderOf(fl);
    if (!lead) return;
    for (const m of fl.members) {
      if (m === lead || !m.alive) continue;
      slotOf(m, lead, m.pos);
      copy(m.prev, m.pos);
      copy(m.seen, m.pos);
      copy(m.fwd, lead.fwd);
      set(m.vel, lead.vel.x, lead.vel.y, lead.vel.z);
    }
  };

  // home: its target let go, its carrier's hangar (or, the battle over and no carrier left, its own line)
  const sendHome = (f, panicked = false) => {
    if (f.target === b.you) b.you.on = Math.max(0, b.you.on - 1);
    k.tactics?.drop(f);
    f.target = null;
    f.mode = 'rtb';
    f.modeT = 0;
    f.dockT = 0;
    f.panicked = panicked;
  };
  const backIn = (f) => {
    f.hp = f.type.hp;
    f.mode = f.role === 'bomber' ? 'run' : 'engage';
    f.dockT = 0;
    f.panicked = false;
    f.station = null;
    f.retarget = 0;
  };
  const lineOf = (team) => {
    const dir = team === 0 ? 1 : -1;
    return v3(C.x - A.x * k.lines * dir * 1.6, C.y, C.z - A.z * k.lines * dir * 1.6);
  };

  // the fighters waiting to come back, out of their carriers' hangars together
  const launch = (team, out) => {
    const waiting = b.fighters.filter((f) => f.team === team && !f.alive && f.waiting);
    if (!waiting.length) return;
    const carriers = b.capitals.filter((c) => c.team === team && c.alive && c.dying <= 0 && CARRIERS.has(c.kind));
    waiting.forEach((f, i) => {
      f.waiting = false;
      k.spawn(f, false);
      const cap = carriers.length ? carriers[i % carriers.length] : null;
      if (cap) {
        const h = hangarOf(cap);
        const dir = team === 0 ? 1 : -1;
        set(f.pos, h.x + (k.rand() - 0.5) * 6, h.y - k.rand() * 3, h.z + (k.rand() - 0.5) * 6);
        norm(set(f.fwd, A.x * dir, -0.15, A.z * dir));
        set(f.vel, f.fwd.x * f.speed, f.fwd.y * f.speed, f.fwd.z * f.speed);
        copy(f.prev, f.pos);
        copy(f.seen, f.pos);
      }
      out.push({ type: 'arrive', team, kind: f.kind, at: copy(v3(), f.pos), hangar: Boolean(cap) }); // (out of a hangar: drawn with no flash, battleScene.js)
    });
    // (each flight launched in its formation)
    for (const fl of new Set(waiting.map((f) => f.flight).filter(Boolean))) formUp(fl);
  };

  const api = {
    get flights() {
      return flights;
    },
    get threat() {
      return threat;
    },
    // both sides' flights, as they were put up
    form() {
      for (const team of [0, 1]) {
        group(
          team,
          b.fighters.filter((f) => f.team === team),
        ).forEach(formUp);
        pair(team);
      }
    },
    // fighters put up later (a bomber wave, a reserve squadron), in flights of their own
    adopt(list) {
      for (const team of [0, 1]) {
        const own = list.filter((f) => f.team === team);
        if (own.length) group(team, own).forEach(formUp);
      }
      for (const team of [0, 1]) pair(team);
    },
    // a wingman's leader, if it has one in the fight
    lead(f) {
      const lead = f.flight ? leaderOf(f.flight) : null;
      return lead && lead !== f ? lead : null;
    },
    // the bombers a flight's escorting, if they're still flying
    escortOf(f) {
      const fl = f.flight?.escorting;
      return fl ? leaderOf(fl) : null;
    },
    // the objective ship, if `f` flies cover over it
    cover(f) {
      if (!f.flight?.cap) return null;
      const ship = k.objOf();
      return ship?.alive && ship.dying <= 0 ? ship : null;
    },
    // a hit on the objective ship (its threat)
    struck() {
      heat += 1;
    },
    // the threat to each of the defender's objectives now, and the most threatened
    sense() {
      senseAt = b.clock;
      const ship = k.objOf();
      const list = b.objectives ? b.objectives.filter((o) => o.alive && !o.hidden && o.phase === b.phase) : (ship?.subs ?? []).filter((s) => s.alive && s.phase === b.phase);
      if (!list.length && ship?.alive) list.push(ship);
      threat = null;
      for (const o of list) {
        let n = o.cap === ship || o === ship ? heat / FLIGHTS.heat : 0;
        for (const f of b.fighters) if (f.alive && f.team !== k.defender && dist2(f.pos, o.pos) < FLIGHTS.threat * FLIGHTS.threat) n += 1;
        if (n > 0 && (!threat || n > threat.score)) threat = { pos: o.pos, score: n };
      }
    },
    // a flight's nerve: outnumbered three to one round it (its own side's
    // fighters near it on its side of the count, squad.js's confidence), it
    // breaks for home
    nerve(fl) {
      const own = fl.members.filter((m) => m.alive && m.mode !== 'rtb' && !m.ace);
      if (!own.length) return;
      const mid = v3();
      for (const m of own) set(mid, mid.x + m.pos.x / own.length, mid.y + m.pos.y / own.length, mid.z + m.pos.z / own.length);
      const round = b.fighters.filter((f) => f.alive && f.mode !== 'rtb' && dist2(f.pos, mid) < FLIGHTS.nerve * FLIGHTS.nerve);
      const foes = round.filter((f) => f.team !== fl.team);
      if (!foes.length) return;
      const friends = round.filter((f) => f.team === fl.team);
      const { level } = confidence({ members: friends.map((m) => m.id) }, friends, foes);
      if (level === 'panicked') for (const m of own) if (carrierOf(m)) sendHome(m, true);
    },

    // a step of the flights: the threat, each flight's nerve, the fighters
    // hurt going home and the ones home back in, and the waves
    step(dt, out) {
      const t = b.clock;
      heat *= Math.exp(-dt / FLIGHTS.heat);
      if (t - senseAt >= 1) api.sense();
      if (!b.over)
        for (const fl of flights) {
          fl.nerveAt -= dt;
          if (fl.nerveAt > 0) continue;
          fl.nerveAt = FLIGHTS.nerveEvery;
          api.nerve(fl);
        }
      const loser = b.over ? 1 - b.over.winner : null;
      for (const f of b.fighters) {
        if (!f.alive) continue;
        if (f.mode !== 'rtb') {
          // (an ace's hull is its own, or the director's: it fights on)
          if ((!f.ace && f.hp <= f.type.hp * FLIGHTS.rtb && carrierOf(f)) || f.team === loser) sendHome(f);
          else continue;
        }
        const cap = carrierOf(f);
        f.station = cap ? hangarOf(cap) : (f.home ??= lineOf(f.team));
        if (dist2(f.pos, f.station) > FLIGHTS.dock * FLIGHTS.dock) continue;
        f.dockT = (f.dockT ?? 0) + dt;
        if (f.team === loser || !cap) {
          // (the battle over: gone home for good)
          f.alive = false;
          f.waiting = false;
          f.respawn = Infinity;
        } else if (f.dockT >= FLIGHTS.docked) backIn(f);
      }
      // the waves, on the battle's clock (multiples of each side's period)
      if (b.over) return;
      for (const team of [0, 1]) {
        const period = FLIGHTS.waves[team === k.attacker ? 'attacker' : 'defender'];
        if (Math.floor(t / period + 1e-9) > Math.floor((t - dt) / period + 1e-9)) launch(team, out);
      }
    },

    // where a fighter's to fly, if not straight at its target: home, its
    // slot on the way, its bombers' side or its cover's circle → { at, speed? } | null
    steer(f, dist) {
      if (f.mode === 'rtb') {
        const near = f.station && dist2(f.pos, f.station) < (FLIGHTS.dock * 2) ** 2;
        return f.station ? { at: f.station, speed: near ? f.type.speed * 0.4 : f.type.speed } : null;
      }
      const lead = api.lead(f);
      if (lead && dist > FLIGHTS.transit && dist2(lead.pos, f.pos) < 60 * 60) {
        const at = slotOf(f, lead, f.slot ?? (f.slot = v3()));
        const off = Math.sqrt(dist2(at, f.pos));
        return { at, speed: off < 3 ? lead.speed : f.type.speed * FLIGHTS.rejoin };
      }
      if (!lead && dist > FLIGHTS.transit && f.flight && f.flight.members.some((m) => m !== f && m.alive && m.mode !== 'rtb' && m.slot && dist2(m.slot, m.pos) > 9)) return { at: null, speed: f.type.speed * FLIGHTS.ease };
      if (f.target) return null;
      // nothing to go after: by its bombers, or circling its cover
      const bombers = api.escortOf(f);
      if (bombers) {
        set(tmp, bombers.pos.x - bombers.fwd.x * 4, bombers.pos.y + 4, bombers.pos.z - bombers.fwd.z * 4);
        return { at: (f.station = copy(f.station ?? v3(), tmp)), speed: Math.max(bombers.speed, f.type.speed * 0.8) };
      }
      const ship = api.cover(f);
      if (ship) {
        const a = b.clock * 0.25 + f.flight.id * 2.1 + f.wing * 0.4;
        set(tmp, ship.pos.x + Math.cos(a) * FLIGHTS.orbit, ship.pos.y + 10 + f.wing * 2, ship.pos.z + Math.sin(a) * FLIGHTS.orbit);
        return { at: (f.station = copy(f.station ?? v3(), tmp)) };
      }
      return null;
    },
  };
  return api;
}

// The director's capital ship, as plain rules: a Star Destroyer (or a
// Federation cruiser, or a Madrigal freighter: sides.js's `capitalShip`)
// drops out of hyperspace by you, launches its fighters, and is something
// you can fight back against. Pure (no three.js), so it's tested in Node;
// setpieces.js draws it and scene.js voices it.
//
// How a jump looks (`jumpSmear`): coming out of hyperspace, the ship is a
// streak along its line of flight whose nose runs in from behind and stops
// where the ship stops: nothing of it is ever ahead of where it comes to
// rest. Going in, the stern never slides back: the nose streaks away ahead
// and the stern follows. (The first version stretched the hull about its
// middle, so the stern smeared backwards on the way out, and the ship
// looked as if it had left the wrong way.)
//
// The fight: its shield parts (a Star Destroyer's two shield domes on the
// bridge tower) cover the hull and the bridge; any gun knocks them out. With
// them gone the bridge is open, and the ship starts to run: it jumps away
// FLEE seconds after its shields go unless the bridge goes first, and
// then it's done for: it lists, goes up along its length and is gone.
// Meanwhile its turbolasers fire at you from along the hull whenever you're
// in range: slow fat bolts, easy to see, that hurt if they land. Its
// fighters come out of its belly a moment after it arrives; see them all
// off while its shields still stand and it launches a second wave before it
// gives up and goes. Nothing happens to the ship while it's a streak.
//
// createCapital({ rand }) → {
//   arrive(kind, at: [x, y, z], heading, { len, top }) → { hangar: [x, y, z], heading },
//   leave(reason), cleared(), update(dt, you) → busy, hit(from, to, punch) → hit | null,
//   events (what happened, to be drained), targets, parts, bolts,
//   state ('in' | 'here' | 'out' | 'dying' | null), here, at, heading, len, roll, pitch, age,
//   solids (its hull, ship.js's solids, once it's here) }
// A hit: { type: 'shielded' | 'hull' | 'part' | 'bridge', part?, at: [x, y, z], down, left }.
// Events: { type: 'launch', wave, from }, { type: 'volley', from, to },
// { type: 'hit', damage }, { type: 'part', part, left }, { type: 'open' },
// { type: 'dying' }, { type: 'blast', at, size }, { type: 'dead' },
// { type: 'leaving', reason: 'left' | 'fled' | 'done' }, { type: 'gone', reason }.
// `you` is your ship ({ x, y, z, heading, speed }) or null. Everything is
// in the map's space; `top` is how high the model's top is above its
// middle, as a fraction of its length (the parts sit on it).

import { segmentSphere } from './siege';

export const JUMP = 0.7; // seconds to come out of (or go into) hyperspace
export const CAPITAL = {
  stay: 55, // seconds it stays before jumping away, fighters or no
  launchAt: 2.4, // seconds after it's here that its fighters come out
  waves: 2, // how many waves it launches while its shields stand
  relaunch: 3, // seconds after a wave's gone that the next comes out
  flee: 16, // seconds after its shields go that it jumps away (unless the bridge goes first)
  die: 5.5, // seconds it takes to go up
  blastEvery: 0.32, // seconds between the blasts along it while it does
  range: 46, // map units its turbolasers reach
  volley: [1.2, 2.0], // seconds between volleys
  bolt: { speed: 23, life: 3.4, damage: 14, r: 0.9, spread: 1.6, lead: 0.85 }, // a turbolaser bolt: fat and slow, and it hurts
  drift: 1.4, // map units a second it crosses your way at
  list: 0.22, // radians a second it rolls over as it dies
  shieldHp: 10, // punches (weapons.js) a shield part takes: ten blaster hits, or two heavy rounds
  bridgeHp: 12,
};
// how long each capital ship is, in map units (a Star Destroyer's the biggest)
export const LENGTH = { destroyer: 16, venator: 11.4, moncal: 12, fedcruiser: 12, madrigal: 8 };

// each ship's parts, in its own frame: x and z as fractions of its length
// (nose +z, stern −z), y as a fraction of its length below its top; r as a
// fraction of its length. The hull is a chain of spheres down its middle
// (a shot into it splashes off the shield, or sparks). Batteries are where
// the turbolasers fire from; blasts are where it goes up.
export const PARTS = {
  destroyer: {
    shields: [
      { id: 'dome0', name: 'Shield dome', at: [0.065, 0.02, -0.44], r: 0.05 },
      { id: 'dome1', name: 'Shield dome', at: [-0.065, 0.02, -0.44], r: 0.05 },
    ],
    bridge: { id: 'bridge', name: 'Bridge', at: [0, 0.07, -0.39], r: 0.06 },
    hull: [
      [0, 0.18, -0.36, 0.17],
      [0, 0.2, -0.16, 0.15],
      [0, 0.22, 0.06, 0.12],
      [0, 0.24, 0.26, 0.08],
    ],
    batteries: [
      [0.14, 0.14, -0.2],
      [-0.14, 0.14, -0.2],
      [0.1, 0.16, 0.08],
      [-0.1, 0.16, 0.08],
      [0.06, 0.18, 0.3],
      [-0.06, 0.18, 0.3],
    ],
  },
  // the Republic's: its shield generators and its bridge on the twin towers aft, its batteries down the spine
  venator: {
    shields: [
      { id: 'gen0', name: 'Shield generator', at: [0.075, 0.03, -0.36], r: 0.04 },
      { id: 'gen1', name: 'Shield generator', at: [-0.075, 0.03, -0.36], r: 0.04 },
    ],
    bridge: { id: 'bridge', name: 'Bridge', at: [0.075, 0.05, -0.33], r: 0.05 },
    hull: [
      [0, 0.16, -0.34, 0.16],
      [0, 0.18, -0.14, 0.15],
      [0, 0.2, 0.08, 0.11],
      [0, 0.22, 0.28, 0.07],
    ],
    batteries: [
      [0.12, 0.13, -0.18],
      [-0.12, 0.13, -0.18],
      [0.08, 0.15, 0.06],
      [-0.08, 0.15, 0.06],
      [0.05, 0.16, 0.26],
      [-0.05, 0.16, 0.26],
    ],
  },
  // the Rebellion's: its shield projectors amidships, its bridge at the bow
  moncal: {
    shields: [
      { id: 'proj0', name: 'Shield projector', at: [0.08, 0.02, -0.05], r: 0.05 },
      { id: 'proj1', name: 'Shield projector', at: [-0.08, 0.02, -0.05], r: 0.05 },
    ],
    bridge: { id: 'bridge', name: 'Bridge', at: [0, 0.04, 0.38], r: 0.06 },
    hull: [
      [0, 0.12, -0.32, 0.12],
      [0, 0.13, -0.08, 0.13],
      [0, 0.13, 0.16, 0.12],
      [0, 0.12, 0.36, 0.08],
    ],
    batteries: [
      [0.1, 0.09, -0.25],
      [-0.1, 0.09, -0.25],
      [0.11, 0.1, 0.02],
      [-0.11, 0.1, 0.02],
      [0.08, 0.1, 0.24],
      [-0.08, 0.1, 0.24],
    ],
  },
  fedcruiser: {
    shields: [
      { id: 'proj0', name: 'Shield projector', at: [0.11, 0.02, -0.12], r: 0.05 },
      { id: 'proj1', name: 'Shield projector', at: [-0.11, 0.02, -0.12], r: 0.05 },
    ],
    bridge: { id: 'bridge', name: 'Bridge', at: [0, 0.05, -0.4], r: 0.06 },
    hull: [
      [0, 0.14, -0.33, 0.13],
      [0, 0.15, -0.1, 0.13],
      [0, 0.16, 0.14, 0.1],
      [0, 0.17, 0.34, 0.06],
    ],
    batteries: [
      [0.1, 0.1, -0.25],
      [-0.1, 0.1, -0.25],
      [0.08, 0.12, 0.05],
      [-0.08, 0.12, 0.05],
      [0, 0.14, 0.3],
    ],
  },
  madrigal: {
    shields: [
      { id: 'emit0', name: 'Shield emitter', at: [0.09, 0.02, -0.08], r: 0.06 },
      { id: 'emit1', name: 'Shield emitter', at: [-0.09, 0.02, -0.08], r: 0.06 },
    ],
    bridge: { id: 'bridge', name: 'Cab', at: [0, 0.06, 0.36], r: 0.07 },
    hull: [
      [0, 0.12, -0.3, 0.14],
      [0, 0.12, -0.05, 0.14],
      [0, 0.12, 0.2, 0.12],
    ],
    batteries: [
      [0.14, 0.08, -0.2],
      [-0.14, 0.08, -0.2],
      [0.14, 0.08, 0.1],
      [-0.14, 0.08, 0.1],
    ],
  },
};

// How the ship is drawn `k` (0…1) of the way into a jump: how far it's
// stretched along its length, and how far its middle is shifted along its
// nose from where it rests, in map units for a ship `len` long. Arriving
// ('in'), the nose is never ahead of where it comes to rest; leaving
// ('out'), the stern is never behind where it was. Any other state: as it
// is.
export function jumpSmear(state, k, len) {
  k = Math.min(1, Math.max(0, k));
  if (state === 'in') {
    const back = (1 - k) ** 3;
    const stretch = 1 + back * 14;
    // the middle sits behind the rest by half the extra length (so the nose
    // comes no further than its rest), and further back again, closing in
    return { stretch, shift: -(len * (stretch - 1)) / 2 - back * len * 4 + 0 }; // (+ 0: never −0)
  }
  if (state === 'out') {
    const stretch = 1 + k * k * 18;
    // the middle runs ahead by half the extra length (so the stern stays
    // where it was), and further ahead again, pulling away
    return { stretch, shift: (len * (stretch - 1)) / 2 + k * k * len * 6 };
  }
  return { stretch: 1, shift: 0 };
}

const between = (rand, [a, b]) => a + rand() * (b - a);

const NO_SOLIDS = [];

export function createCapital({ rand = Math.random } = {}) {
  const events = [];
  const bolts = [];
  const targets = [];
  const c = {
    state: null,
    kind: null,
    age: 0, // seconds in this state
    at: [0, 0, 0],
    heading: 0,
    len: LENGTH.destroyer,
    top: 0.14,
    roll: 0,
    pitch: 0,
    parts: [], // { id, name, kind: 'shield' | 'bridge', local: [x, y, z], r, hp, hpMax, at: [x, y, z], alive }
    hull: [], // { local, r, at }
    batteries: [], // { local, at }
    waves: 0,
    relaunchAt: null, // age at which the next wave comes out
    openAt: null, // age at which its shields went
    cool: 0, // seconds to the next volley
    nextBlast: 0,
    reason: null,
  };

  // a point in the ship's frame carried into the map's: the ship's nose is
  // along forward(heading) (−z at heading 0: ship.js), so its +z is turned
  // by heading + π about y
  const place = (local, out) => {
    const a = c.heading + Math.PI;
    const cs = Math.cos(a);
    const sn = Math.sin(a);
    const x = local[0] * c.len;
    const y = (c.top - local[1]) * c.len;
    const z = local[2] * c.len;
    out[0] = c.at[0] + x * cs + z * sn;
    out[1] = c.at[1] + y;
    out[2] = c.at[2] - x * sn + z * cs;
    return out;
  };
  const placeAll = () => {
    for (const p of c.parts) place(p.local, p.at);
    for (const h of c.hull) place(h.local, h.at);
    for (const b of c.batteries) place(b.local, b.at);
  };
  const shieldsUp = () => c.parts.some((p) => p.kind === 'shield' && p.alive);
  const live = () => c.state === 'here';
  const go = (reason) => {
    if (c.state !== 'here' && c.state !== 'in') return;
    c.state = 'out';
    c.age = 0;
    c.reason = reason;
    bolts.length = 0;
    events.push({ type: 'leaving', reason });
  };

  // its turbolasers: from the battery nearest you, at where you'll be
  const fire = (you) => {
    if (!c.batteries.length) return;
    let from = c.batteries[0].at;
    let best = Infinity;
    for (const b of c.batteries) {
      const d = Math.hypot(b.at[0] - you.x, b.at[1] - you.y, b.at[2] - you.z);
      if (d < best) {
        best = d;
        from = b.at;
      }
    }
    const v = you.speed ?? 0;
    const t = (best / CAPITAL.bolt.speed) * CAPITAL.bolt.lead;
    const tx = you.x - Math.sin(you.heading ?? 0) * v * t + (rand() - 0.5) * CAPITAL.bolt.spread;
    const ty = you.y + (rand() - 0.5) * CAPITAL.bolt.spread * 0.6;
    const tz = you.z - Math.cos(you.heading ?? 0) * v * t + (rand() - 0.5) * CAPITAL.bolt.spread;
    const dx = tx - from[0];
    const dy = ty - from[1];
    const dz = tz - from[2];
    const l = Math.hypot(dx, dy, dz) || 1;
    const s = CAPITAL.bolt.speed / l;
    bolts.push({ x: from[0], y: from[1], z: from[2], vx: dx * s, vy: dy * s, vz: dz * s, life: CAPITAL.bolt.life });
    events.push({ type: 'volley', from: [...from], to: [tx, ty, tz] });
  };
  const sFrom = [0, 0, 0];
  const sTo = [0, 0, 0];
  let solids = NO_SOLIDS; // (its hull's, made as it arrives: their `at` is the hull's own, placed as it moves)

  return {
    events,
    bolts,
    get state() {
      return c.state;
    },
    get here() {
      return c.state === 'here' || c.state === 'in' || c.state === 'dying';
    },
    // its hull as ship.js's solids, so flying into it is a planet's bump or
    // crash: once it's here (or going up), never while it jumps in or out
    get solids() {
      return c.state === 'here' || c.state === 'dying' ? solids : NO_SOLIDS;
    },
    get at() {
      return c.at;
    },
    get heading() {
      return c.heading;
    },
    get len() {
      return c.len;
    },
    get kind() {
      return c.kind;
    },
    get age() {
      return c.age;
    },
    get roll() {
      return c.roll;
    },
    get pitch() {
      return c.pitch;
    },
    get parts() {
      return c.parts;
    },
    get reason() {
      return c.reason;
    },
    get shielded() {
      return shieldsUp();
    },

    // it drops out of hyperspace at `at`, pointing along `heading`, `len`
    // long with its top `top` above its middle (fractions of its length)
    arrive(kind, at, heading, { len = LENGTH[kind] ?? LENGTH.destroyer, top = 0.14 } = {}) {
      if (c.state) return null;
      const def = PARTS[kind] ?? PARTS.destroyer;
      c.state = 'in';
      c.kind = kind;
      c.age = 0;
      c.at = [...at];
      c.heading = heading;
      c.len = len;
      c.top = top;
      c.roll = 0;
      c.pitch = 0;
      c.waves = 0;
      c.relaunchAt = null;
      c.openAt = null;
      c.reason = null;
      c.cool = between(rand, CAPITAL.volley) + 1.5;
      c.nextBlast = 0;
      bolts.length = 0;
      events.length = 0;
      c.parts = [
        ...def.shields.map((p) => ({ id: p.id, name: p.name, kind: 'shield', local: p.at, r: p.r, hp: CAPITAL.shieldHp, hpMax: CAPITAL.shieldHp, at: [0, 0, 0], alive: true })),
        { id: def.bridge.id, name: def.bridge.name, kind: 'bridge', local: def.bridge.at, r: def.bridge.r, hp: CAPITAL.bridgeHp, hpMax: CAPITAL.bridgeHp, at: [0, 0, 0], alive: true },
      ];
      c.hull = def.hull.map(([x, y, z, r]) => ({ local: [x, y, z], r, at: [0, 0, 0] }));
      solids = c.hull.map((h, i) => ({ id: `cap:hull:${i}`, at: h.at, r: h.r * len, reach: h.r * len, ship: true }));
      c.batteries = def.batteries.map((b) => ({ local: b, at: [0, 0, 0] }));
      placeAll();
      return { hangar: this.hangar, heading };
    },
    // where its fighters come out: its belly
    get hangar() {
      return [c.at[0], c.at[1] - 2.2 * (c.len / LENGTH.destroyer), c.at[2]];
    },
    // and it jumps away
    leave(reason = 'left') {
      go(reason);
    },
    // its fighters are all gone (shot down, or given up): another wave while
    // its shields stand and it has one left, else it goes
    cleared() {
      if (!live()) return;
      if (c.waves < CAPITAL.waves && shieldsUp()) c.relaunchAt = c.age + CAPITAL.relaunch;
      else go('done');
    },

    update(dt, you) {
      if (!c.state) return false;
      c.age += dt;
      if (c.state === 'in') {
        if (c.age >= JUMP) {
          c.state = 'here';
          c.age = 0;
        }
      } else if (c.state === 'here') {
        const [fx, fz] = [-Math.sin(c.heading), -Math.cos(c.heading)];
        c.at[0] += fx * CAPITAL.drift * dt;
        c.at[2] += fz * CAPITAL.drift * dt;
        placeAll();
        // the fighters: the first wave a moment after it's here, the next when asked
        if (c.waves === 0 && c.age >= CAPITAL.launchAt) {
          c.waves = 1;
          events.push({ type: 'launch', wave: 1, from: this.hangar });
        } else if (c.relaunchAt !== null && c.age >= c.relaunchAt) {
          c.relaunchAt = null;
          c.waves += 1;
          events.push({ type: 'launch', wave: c.waves, from: this.hangar });
        }
        // running, its shields gone; or it's had its go
        if (c.openAt !== null && c.age - c.openAt >= CAPITAL.flee) go('fled');
        else if (c.age >= CAPITAL.stay) go('left');
        // the turbolasers
        if (you && c.state === 'here' && c.age > CAPITAL.launchAt) {
          const d = Math.hypot(you.x - c.at[0], you.y - c.at[1], you.z - c.at[2]);
          c.cool -= dt;
          if (d < CAPITAL.range && c.cool <= 0) {
            c.cool = between(rand, CAPITAL.volley);
            fire(you);
          }
        }
      } else if (c.state === 'out') {
        if (c.age >= JUMP) {
          const reason = c.reason;
          c.state = null;
          events.push({ type: 'gone', reason });
        }
      } else if (c.state === 'dying') {
        c.roll += CAPITAL.list * dt;
        c.pitch += CAPITAL.list * 0.4 * dt;
        placeAll();
        if (c.age >= c.nextBlast && c.age < CAPITAL.die - 0.4) {
          c.nextBlast = c.age + CAPITAL.blastEvery;
          // somewhere along the hull, a little off its middle
          const z = -0.45 + rand() * 0.85;
          const at = place([(rand() - 0.5) * 0.2 * (0.5 - z), 0.1 + rand() * 0.1, z], [0, 0, 0]);
          events.push({ type: 'blast', at, size: c.len * (0.05 + rand() * 0.07) });
        }
        if (c.age >= CAPITAL.die) {
          c.state = null;
          events.push({ type: 'dead' });
        }
      }
      // the bolts fly on, and one that passes near enough you lands
      for (let i = bolts.length - 1; i >= 0; i--) {
        const b = bolts[i];
        b.life -= dt;
        if (b.life <= 0) {
          bolts.splice(i, 1);
          continue;
        }
        const x1 = b.x + b.vx * dt;
        const y1 = b.y + b.vy * dt;
        const z1 = b.z + b.vz * dt;
        if (you) {
          sFrom[0] = b.x;
          sFrom[1] = b.y;
          sFrom[2] = b.z;
          sTo[0] = x1;
          sTo[1] = y1;
          sTo[2] = z1;
          if (segmentSphere(sFrom, sTo, [you.x, you.y, you.z], CAPITAL.bolt.r) !== null) {
            bolts.splice(i, 1);
            events.push({ type: 'hit', damage: CAPITAL.bolt.damage });
            continue;
          }
        }
        b.x = x1;
        b.y = y1;
        b.z = z1;
      }
      return Boolean(c.state);
    },

    // a shot of yours from `from` to `to` ([x, y, z]) this frame, worth
    // `punch`: what it hit, or null. Only while it's here (a streak can't be hit)
    hit(from, to, punch = 1) {
      if (!live()) return null;
      // (nowhere near it: nothing to test)
      const reach = Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]) + c.len * 1.2;
      if (Math.hypot(from[0] - c.at[0], from[1] - c.at[1], from[2] - c.at[2]) > reach) return null;
      const up = shieldsUp();
      let hit = null;
      let first = Infinity;
      for (const p of c.parts) {
        if (!p.alive || (p.kind === 'bridge' && up)) continue;
        const k = segmentSphere(from, to, p.at, p.r * c.len);
        if (k !== null && k < first) {
          first = k;
          hit = p;
        }
      }
      let hull = false;
      for (const h of c.hull) {
        const k = segmentSphere(from, to, h.at, h.r * c.len);
        if (k !== null && k < first) {
          first = k;
          hull = true;
          hit = null;
        }
      }
      if (hit === null && !hull) return null;
      const at = [from[0] + (to[0] - from[0]) * first, from[1] + (to[1] - from[1]) * first, from[2] + (to[2] - from[2]) * first];
      if (hull) return { type: up ? 'shielded' : 'hull', at, down: false, left: c.parts.filter((p) => p.kind === 'shield' && p.alive).length };
      hit.hp -= punch;
      const down = hit.hp <= 0;
      if (down) {
        hit.alive = false;
        hit.hp = 0;
        if (hit.kind === 'shield') {
          const left = c.parts.filter((p) => p.kind === 'shield' && p.alive).length;
          events.push({ type: 'part', part: hit.id, left });
          if (left === 0) {
            c.openAt = c.age;
            events.push({ type: 'open' });
          }
        } else {
          c.state = 'dying';
          c.age = 0;
          c.nextBlast = 0;
          bolts.length = 0;
          events.push({ type: 'dying' });
        }
      }
      return { type: hit.kind === 'shield' ? 'part' : 'bridge', part: hit.id, at, down, left: c.parts.filter((p) => p.kind === 'shield' && p.alive).length };
    },

    // what the guns may lock on to: the shield parts still up, then the
    // bridge once they're gone
    get targets() {
      targets.length = 0;
      if (!live()) return targets;
      const up = shieldsUp();
      for (const p of c.parts) {
        if (!p.alive || (p.kind === 'bridge' && up)) continue;
        p.target ??= { id: `cap:${p.id}`, at: { x: 0, y: 0, z: 0 }, vel: { x: 0, y: 0, z: 0 }, size: p.r * c.len * 1.4, kind: 'capital', name: p.name, hp: p.hp, hpMax: p.hpMax, faction: c.kind, threat: 0 };
        p.target.at.x = p.at[0];
        p.target.at.y = p.at[1];
        p.target.at.z = p.at[2];
        p.target.vel.x = -Math.sin(c.heading) * CAPITAL.drift;
        p.target.vel.z = -Math.cos(c.heading) * CAPITAL.drift;
        p.target.hp = p.hp;
        p.target.size = p.r * c.len * 1.4;
        targets.push(p.target);
      }
      return targets;
    },
  };
}

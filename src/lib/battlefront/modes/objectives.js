// Galactic Assault's objective kinds (spec catalogue 6), each a small state
// machine the mode ticks with who is inside it: a capture point's meter, an
// arm-and-destroy charge, an escort's walker, a hold, and Hoth's uplinks
// (the defenders' call for a bombing run on the walkers). Pure.
//
//   capture.create({ volume, name, meter }) → o      capture.tick(o, dt, { inside: { attack, defend } })
//   arm.create({ at, name, charge }) → o             arm.tick(o, dt, { interactions: [{ side, id, held }] })   (charge: a map rulebook `charges` row)
//   uplink.create({ at, name }) → o                  uplink.tick(o, dt, { interactions, open })
//   escort.create({ path, health, name }) → o        escort.tick(o, dt, { near })   (o.walker is the walker's body)
//   hold.create({ volume, seconds, name }) → o       hold.tick(o, dt, { inside })
//   carry.create({ at, to, radius, returns, name }) → o   carry.tick(o, dt, { carriers: [{ id, at: [x, z] }] })   (Strike's objective, Extraction's cargo)
//   each kind's view(o) → the HUD's row
//   insidePolygon(points, x, z)    centroid(points)

// `PF_CapturePoint`'s cast: 60 s for one attacker alone to take a point from neutral to held.
export const CAPTURE_SECONDS = 60;
// The most a crowd counts for on a point, by hand (the game's meter speeds up to four soldiers' worth).
export const ADVANTAGE_MAX = 6;
// The HUD's thirds of the meter (`PF_CapturePoint`'s 0.33 and 0.66).
export const THIRDS = [0.33, 0.66];
// A bomb's holds and fuse where the map rulebook keeps no charge for it (Strike's), by hand: hold 6 s to arm,
// 30 s of fuse, 6 s to defuse. Hoth's fuel charges read theirs (`charges`: 2 s, 45 s, 3 s).
export const ARM_SECONDS = 6;
export const FUSE_SECONDS = 30;
export const DEFUSE_SECONDS = 6;
// An AT-AT's walk (`VehicleWaypointData` holds speeds by stop, not one for the walk), by hand.
export const WALKER_SPEED = 2.5;
// How near an attacker must be for the walker to keep walking, by hand.
export const ESCORT_REACH = 60;
// How near an interact prop a soldier must stand to use it (the bomb, the uplink's console), by hand.
export const INTERACT_REACH = 3;
// An uplink called: the bombing run leaves the walkers open to fire this long; then the console rests. By hand.
export const VULNERABLE_SECONDS = 30;
// The share of each walker's health the bombing run itself takes, by hand
// (the Y-wings' bombs; the rest is the defenders' fire while it is open).
export const BOMBING_RUN = 0.2;
// An uplink can call a run only with a walker this near it, and only when no
// run is in the air (one at a time), by hand.
export const UPLINK_RANGE = 250;
export const UPLINK_REST = 30;

export function insidePolygon(points, x, z) {
  let c = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, zi] = points[i];
    const [xj, zj] = points[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}

export const centroid = (points) => [points.reduce((n, p) => n + p[0], 0) / points.length, points.reduce((n, p) => n + p[1], 0) / points.length];

const clamp = (v) => Math.max(-1, Math.min(1, v));

// -- capture: −1 the defenders' to +1 the attackers'; the side with more inside moves it --
// A point opens at 0, the defenders' (`PF_CapturePoint`'s 0 to 1 is the
// attackers' take); the defenders can push it on to −1, a margin to win back.

export const capture = {
  create({ volume, name = null, meter = 0 }) {
    return { type: 'capture', name, volume, at: centroid(volume.points), meter, owner: meter >= 1 ? 'attack' : 'defend', contested: false, overtime: false, moving: null, done: meter >= 1 };
  },
  tick(o, dt, { inside }) {
    const a = inside.attack ?? 0;
    const d = inside.defend ?? 0;
    o.contested = a > 0 && d > 0;
    o.overtime = o.contested;
    const net = a - d;
    const sign = Math.sign(net);
    o.moving = null;
    if (sign && !(sign > 0 && o.meter >= 1) && !(sign < 0 && o.meter <= -1)) {
      o.meter = clamp(o.meter + (sign * Math.min(ADVANTAGE_MAX, Math.abs(net)) * dt) / CAPTURE_SECONDS);
      o.moving = sign > 0 ? 'attack' : 'defend';
    }
    if (o.meter >= 1) o.owner = 'attack';
    if (o.meter <= -1) o.owner = 'defend';
    o.done = o.meter >= 1;
  },
  view: (o) => ({ type: o.type, name: o.name, meter: o.meter, owner: o.owner, contested: o.contested, armed: false, fuse: 0, progress: Math.abs(o.meter) }),
};

// -- arm: an attacker holds the interaction to arm, a defender to defuse; the fuse runs out and it is done --
//
// With a row of the map rulebook's `charges` (Hoth's fuel charges, bf2-re findings/63) the charge runs as the
// game's PF_Interact_PlanetaryBattle_Core does: its keypad comes on `live` seconds after the stage enables it;
// one soldier holds it at a time (the button's AllowMoreInteractors off while one does), the attackers while
// it is off (the arm hold) and the defenders once armed (the defuse hold); a hold let go starts again; a
// finished hold arms or defuses `settle` seconds later (the keypad's Delay); the fuse stops while a defender
// holds the keypad and runs on when they let go; a defuse resets it, and the attackers may arm it again.
// Without one (Strike's bombs) the hand values above: anyone of the side, the fuse running through a defuse.
//   arm.create({ at, name, charge }) → o      o.fired: the step's events ('armed', 'defused', 'detonated', 'warn');
//   o.by: who finished the hold that armed or defused it

export function armRules(charge = null) {
  if (!charge) return { arm: ARM_SECONDS, defuse: DEFUSE_SECONDS, fuse: FUSE_SECONDS, live: 0, settle: 0, one: false, keep: false, pause: false, reset: true, warn: 0 };
  const f = charge.fuse ?? {};
  return {
    arm: charge.arm?.hold ?? ARM_SECONDS,
    defuse: charge.defuse?.hold ?? DEFUSE_SECONDS,
    // (the StopWatch's Multiplier: the fuse runs that many seconds a second)
    fuse: (f.seconds ?? FUSE_SECONDS) / (f.multiplier || 1),
    live: charge.live?.seconds ?? 0,
    settle: charge.settle?.seconds ?? 0,
    one: Boolean(charge.interact?.one),
    keep: Boolean(charge.interact?.keep),
    pause: Boolean(f.pausedWhileHeld),
    reset: f.resetOnDefuse !== false,
    warn: f.warn ?? 0,
  };
}

export const arm = {
  create({ at, name = null, charge = null }) {
    const rules = armRules(charge);
    return { type: 'arm', name, at, charge, rules, armed: false, fuse: 0, elapsed: 0, progress: 0, defuse: 0, holder: null, by: [], paused: false, wait: rules.live, settling: null, warned: false, fired: [], done: false };
  },
  tick(o, dt, { interactions }) {
    o.fired = [];
    if (o.done) return;
    const R = o.rules ?? armRules(o.charge);
    if (o.wait > 1e-9) {
      o.wait -= dt;
      if (o.wait <= 1e-9) o.wait = 0;
      return;
    }
    // (who holds: the side the keypad is for, the one already at it, else the first)
    const side = o.armed ? 'defend' : 'attack';
    const held = (interactions ?? []).filter((i) => i.held && i.side === side);
    const key = o.armed ? 'defuse' : 'progress';
    let holding;
    if (R.one) {
      const had = o.holder;
      if (o.holder && !held.some((i) => i.id === o.holder)) o.holder = null;
      if (!o.holder && held.length) o.holder = held[0].id;
      holding = Boolean(o.holder);
      // (the one who held it let go: the next starts over, the button's StopWatch reset on OnInteractStop)
      if (had && o.holder !== had && !R.keep && o.settling === null) o[key] = 0;
    } else holding = held.length > 0;
    if (!holding && !R.keep && o.settling === null) o[key] = 0;
    else if (holding && o.settling === null) {
      o[key] = Math.min(1, o[key] + dt / (o.armed ? R.defuse : R.arm));
      if (o[key] >= 1 - 1e-9) {
        o.settling = R.settle;
        o.by = R.one ? [o.holder] : held.map((i) => i.id);
      }
    }
    o.paused = o.armed && R.pause && holding;
    if (o.settling !== null) {
      o.settling -= dt;
      if (o.settling <= 1e-9) {
        o.settling = null;
        o.holder = null;
        if (!o.armed) {
          o.armed = true;
          if (R.reset) o.elapsed = 0;
          o.progress = 0;
          o.defuse = 0;
          o.warned = false;
          o.fired.push('armed');
        } else {
          o.armed = false;
          if (R.reset) o.elapsed = 0;
          o.defuse = 0;
          o.progress = 0;
          o.paused = false;
          o.fired.push('defused');
        }
      }
    }
    // (the fuse starts on the step after the armed event)
    if (o.armed && !o.paused && !o.fired.includes('armed')) {
      o.elapsed += dt;
      if (!o.warned && R.warn > 0 && R.fuse - o.elapsed <= R.warn + 1e-9) {
        o.warned = true;
        o.fired.push('warn');
      }
      if (o.elapsed >= R.fuse - 1e-9) {
        o.armed = false;
        o.done = true;
        o.fired.push('detonated');
      }
    }
    o.fuse = o.armed ? Math.max(0, R.fuse - o.elapsed) : 0;
  },
  view: (o) => {
    const R = o.rules ?? armRules(o.charge);
    return { type: o.type, name: o.name, meter: o.armed ? o.fuse / R.fuse : o.progress, owner: o.done ? 'attack' : 'defend', contested: false, armed: o.armed, fuse: o.fuse, progress: o.armed ? o.defuse : o.progress, paused: o.paused, live: o.wait <= 0 };
  },
};

const holding = (interactions, side) => (interactions ?? []).some((i) => i.side === side && i.held);

// -- uplink: a defender holds the console to call a bombing run (o.fired for the step it lands), then it rests --

export const uplink = {
  create({ at, name = null }) {
    return { type: 'uplink', name, at, progress: 0, rest: 0, runs: 0, fired: false, open: true, done: false };
  },
  tick(o, dt, { interactions, open = true }) {
    o.fired = false;
    o.open = open && o.rest <= 0;
    if (o.rest > 0) o.rest = Math.max(0, o.rest - dt);
    if (!o.open) {
      o.progress = 0;
      return;
    }
    o.progress = holding(interactions, 'defend') ? o.progress + dt / ARM_SECONDS : 0;
    if (o.progress >= 1 - 1e-9) {
      o.progress = 0;
      o.fired = true;
      o.runs++;
      o.rest = UPLINK_REST;
    }
  },
  view: (o) => ({ type: o.type, name: o.name, meter: o.progress, owner: 'defend', contested: false, armed: !o.open, fuse: o.rest, progress: o.progress }),
};

// -- escort: the walker walks its path while an attacker is near; done at the end, failed at 0 hp --

function pathLength(path) {
  let n = 0;
  for (let i = 1; i < path.length; i++) n += Math.hypot(path[i][0] - path[i - 1][0], path[i][2] - path[i - 1][2]);
  return n;
}

// the point `dist` metres along the path, and the heading there
function along(path, dist) {
  let left = dist;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    const L = Math.hypot(b[0] - a[0], b[2] - a[2]);
    if (left <= L || i === path.length - 1) {
      const t = L > 0 ? Math.min(1, left / L) : 1;
      return { at: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t], yaw: Math.atan2(b[0] - a[0], b[2] - a[2]) };
    }
    left -= L;
  }
  return { at: [...path[0]], yaw: 0 };
}

export const escort = {
  create({ path, health, name = null }) {
    const start = along(path, 0);
    const walker = { kind: 'walker', at: start.at, yaw: start.yaw, hp: health, hpMax: health, alive: true, dist: 0, length: pathLength(path), vulnerable: false, disabled: false, moving: false };
    return { type: 'escort', name, path, walker, at: walker.at, done: false, failed: false };
  },
  tick(o, dt, { near = 0 }) {
    const w = o.walker;
    if (o.done || o.failed) return;
    if (!w.alive || w.hp <= 0) {
      w.alive = false;
      w.moving = false;
      o.failed = true;
      return;
    }
    w.moving = near > 0 && !w.disabled;
    if (w.moving) {
      w.dist = Math.min(w.length, w.dist + WALKER_SPEED * dt);
      const p = along(o.path, w.dist);
      w.at[0] = p.at[0];
      w.at[1] = p.at[1];
      w.at[2] = p.at[2];
      w.yaw = p.yaw;
    }
    if (w.dist >= w.length - 1e-6) o.done = true;
  },
  view: (o) => ({ type: o.type, name: o.name, meter: o.walker.dist / (o.walker.length || 1), owner: 'attack', contested: false, armed: o.walker.vulnerable, fuse: 0, progress: o.walker.hp / o.walker.hpMax }),
};

// -- hold: attackers alone inside for `seconds` --

export const hold = {
  create({ volume, seconds, name = null }) {
    return { type: 'hold', name, volume, at: centroid(volume.points), seconds, held: 0, done: false };
  },
  tick(o, dt, { inside }) {
    if (o.done) return;
    if ((inside.attack ?? 0) > 0 && !(inside.defend ?? 0)) o.held += dt;
    if (o.held >= o.seconds - 1e-9) o.done = true;
  },
  view: (o) => ({ type: o.type, name: o.name, meter: o.held / o.seconds, owner: o.done ? 'attack' : 'defend', contested: false, armed: false, fuse: 0, progress: o.held / o.seconds }),
};

// -- carry: an attacker within reach picks it up and it rides with them; their
// death drops it where they fell; left lying, it goes home after `returns`
// seconds (never, when null); carried into its drop-off, it is done --

// How near the drop-off the carrier must bring it, by hand (Pf_FlagDropOff's marker has no radius in the export).
export const DROP_RADIUS = 4;

const close = (a, b, r) => Math.hypot(a[0] - b[0], a[1] - b[1]) <= r;

export const carry = {
  create({ at, to, radius = DROP_RADIUS, returns = null, name = null }) {
    return { type: 'carry', name, home: [...at], at: [...at], to, radius, returns, carrier: null, lying: 0, done: false };
  },
  tick(o, dt, { carriers = [] }) {
    if (o.done) return;
    const held = o.carrier && carriers.find((c) => c.id === o.carrier);
    if (o.carrier && !held) {
      // (the carrier down: it lies at the last place they carried it)
      o.carrier = null;
      o.lying = 0;
    }
    if (held) o.at = [held.at[0], held.at[1]];
    else {
      const by = carriers.find((c) => close(c.at, o.at, INTERACT_REACH));
      if (by) {
        o.carrier = by.id;
        o.at = [by.at[0], by.at[1]];
      } else if (o.returns != null && (o.at[0] !== o.home[0] || o.at[1] !== o.home[1])) {
        o.lying += dt;
        if (o.lying >= o.returns - 1e-9) {
          o.at = [...o.home];
          o.lying = 0;
        }
      }
    }
    if (o.carrier && close(o.at, o.to, o.radius)) o.done = true;
  },
  view: (o) => ({ type: o.type, name: o.name, meter: o.returns && !o.carrier ? o.lying / o.returns : 0, owner: o.carrier ? 'attack' : 'defend', contested: false, armed: Boolean(o.carrier), fuse: o.returns && !o.carrier ? o.returns - o.lying : 0, progress: o.carrier ? 1 : 0 }),
};

export const KINDS = { capture, arm, uplink, escort, hold, carry };

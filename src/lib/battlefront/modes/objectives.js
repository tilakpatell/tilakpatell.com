// Galactic Assault's objective kinds (spec catalogue 6), each a small state
// machine the mode ticks with who is inside it: a capture point's meter, an
// arm-and-destroy charge, an escort's walker, a hold, and Hoth's uplinks
// (the defenders' call for a bombing run on the walkers). Pure.
//
//   capture.create({ volume, name, meter }) → o      capture.tick(o, dt, { inside: { attack, defend } })
//   arm.create({ at, name }) → o                     arm.tick(o, dt, { interactions: [{ side, id, held }] })
//   uplink.create({ at, name }) → o                  uplink.tick(o, dt, { interactions, open })
//   escort.create({ path, health, name }) → o        escort.tick(o, dt, { near })   (o.walker is the walker's body)
//   hold.create({ volume, seconds, name }) → o       hold.tick(o, dt, { inside })
//   each kind's view(o) → the HUD's row
//   insidePolygon(points, x, z)    centroid(points)

// `PF_CapturePoint`'s cast: 60 s for one attacker alone to take a point from neutral to held.
export const CAPTURE_SECONDS = 60;
// The most a crowd counts for on a point, by hand (the game's meter speeds up to four soldiers' worth).
export const ADVANTAGE_MAX = 6;
// The HUD's thirds of the meter (`PF_CapturePoint`'s 0.33 and 0.66).
export const THIRDS = [0.33, 0.66];
// `SW02_VO_BombInteract`'s shape, by hand: hold 6 s to arm, 30 s of fuse, 6 s to defuse.
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

const holding = (interactions, side) => (interactions ?? []).some((i) => i.side === side && i.held);

export const arm = {
  create({ at, name = null }) {
    return { type: 'arm', name, at, armed: false, fuse: 0, progress: 0, defuse: 0, done: false };
  },
  tick(o, dt, { interactions }) {
    if (o.done) return;
    if (!o.armed) {
      o.progress = holding(interactions, 'attack') ? o.progress + dt / ARM_SECONDS : 0;
      if (o.progress >= 1 - 1e-9) {
        o.armed = true;
        o.fuse = FUSE_SECONDS;
        o.progress = 0;
        o.defuse = 0;
      }
      return;
    }
    o.defuse = holding(interactions, 'defend') ? o.defuse + dt / DEFUSE_SECONDS : 0;
    if (o.defuse >= 1 - 1e-9) {
      o.armed = false;
      o.fuse = 0;
      o.defuse = 0;
      return;
    }
    o.fuse = Math.max(0, o.fuse - dt);
    if (o.fuse <= 1e-9) o.done = true;
  },
  view: (o) => ({ type: o.type, name: o.name, meter: o.armed ? o.fuse / FUSE_SECONDS : o.progress, owner: o.done ? 'attack' : 'defend', contested: false, armed: o.armed, fuse: o.fuse, progress: o.armed ? o.defuse : o.progress }),
};

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

export const KINDS = { capture, arm, uplink, escort, hold };

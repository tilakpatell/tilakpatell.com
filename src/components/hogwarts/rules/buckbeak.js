// Buckbeak (quest 6, docs/superpowers/specs/2026-10-21-hogwarts-world-
// design.md §4.7). A Hippogriff is proud: walk up slowly, bow, and hold
// it, eyes on his, until he bows back. Come at him at a run, or bob down
// and straight up again, and he rears (you’re put back and must start
// over); stand up before he has made up his mind and he is only wary
// again. Once he has bowed, he lets you up, and the ride is on rails: up
// out of the paddock, low over the Black Lake, a climb and a wide turn
// round the castle’s towers and home, the broom’s keys off and the view
// the point.
//
//   BOW, newBow(), stepBow(b, { bowing, dist, closing }, dt) → { bow, what }
//   ridePath({ paddock, lake, castle }) → the ride’s points, from the
//     three places ([x, y, z], y the ground or water there)
//   newRide(points, { speed }) → a ride: { points, length, duration }
//   rideAt(ride, t) → { p, yaw, pitch, bank, done }
//   result() → the lesson’s done event, buckbeakBot(b) → whether to bow

export const BOW = {
  near: 4.5, // metres: close enough to bow to him
  wary: 8, // within this, coming in faster than `walk` makes him rear
  walk: 2.2, // m/s
  hold: 2.2, // seconds of bow before he decides
  quick: 0.6, // a bob shorter than this is rude
  think: [0.5, 1.4], // seconds he takes to decide, attempt by attempt
  rear: 3, // seconds rearing before he calms
  points: 10,
};

export const SAYS = {
  close: 'Bow to him. Hold it, and don’t blink.',
  bowing: 'He looks at you a long time.',
  bowed: 'He bows back. You may approach.',
  rear: 'He rears up, screeching. Back off, and try again more slowly.',
  wary: 'He’s still deciding. Bow again.',
  ride: 'Hold on to the feathers, not the neck.',
  home: 'Back in the paddock. He accepts a dead ferret, graciously.',
};

export function newBow() {
  return { phase: 'wary', held: 0, think: 0, rear: 0, tries: 0 };
}

// the attempt’s thinking time, the same every visit (a golden-ratio walk
// across the range, so no two tries feel the same)
const thinkFor = (tries) => BOW.think[0] + (BOW.think[1] - BOW.think[0]) * ((tries * 0.618034) % 1);

export function stepBow(b, { bowing = false, dist = Infinity, closing = 0 } = {}, dt) {
  if (b.phase === 'bowed') return { bow: b, what: null };
  if (b.phase === 'rearing') {
    const rear = Math.max(0, b.rear - dt);
    return { bow: { ...b, rear, phase: rear === 0 ? 'wary' : 'rearing' }, what: rear === 0 ? 'calm' : null };
  }
  // at a run, close in: he won’t have it
  if (dist < BOW.wary && closing > BOW.walk) return { bow: { ...b, phase: 'rearing', rear: BOW.rear, held: 0 }, what: 'rear' };
  if (b.phase === 'wary') {
    if (bowing && dist <= BOW.near) return { bow: { ...b, phase: 'bowing', held: dt, tries: b.tries + 1 }, what: 'bowing' };
    return { bow: b, what: null };
  }
  if (b.phase === 'bowing') {
    if (!bowing) {
      if (b.held < BOW.quick) return { bow: { ...b, phase: 'rearing', rear: BOW.rear, held: 0 }, what: 'rear' };
      return { bow: { ...b, phase: 'wary', held: 0 }, what: 'wary' };
    }
    const held = b.held + dt;
    if (held >= BOW.hold) return { bow: { ...b, phase: 'thinking', held, think: thinkFor(b.tries) }, what: null };
    return { bow: { ...b, held }, what: null };
  }
  // thinking: keep bowing until he answers
  if (!bowing) return { bow: { ...b, phase: 'wary', held: 0 }, what: 'wary' };
  const think = b.think - dt;
  if (think <= 0) return { bow: { ...b, phase: 'bowed', think: 0 }, what: 'bowed' };
  return { bow: { ...b, think }, what: null };
}

// the bot: walks up slowly (the play’s), and bows until he bows back
export const buckbeakBot = (b, dist) => b.phase !== 'bowed' && b.phase !== 'rearing' && dist <= BOW.near;

// The ride’s points from the three places: up out of the paddock, down to
// the lake’s near shore, low over the water to the far side, a climb to a
// wide turn round the castle at the height of its towers, and home.
export function ridePath({ paddock, lake, castle }) {
  const [px, py, pz] = paddock;
  const [lx, ly, lz] = lake;
  const [cx, cy, cz] = castle;
  // across the lake: from the side nearer the paddock to the far one
  const ax = lx - px;
  const az = lz - pz;
  const al = Math.hypot(ax, az) || 1;
  const ux = ax / al;
  const uz = az / al;
  const R = 150; // round the castle
  const tower = cy + 70;
  const round = [0.5, 1.5, 2.5, 3.5].map((k) => {
    const a = Math.atan2(lz - cz, lx - cx) + (k * Math.PI) / 2;
    return [cx + Math.cos(a) * R, tower + (k === 2.5 ? 15 : 0), cz + Math.sin(a) * R];
  });
  return [
    [px, py + 1.6, pz],
    [px + ux * 20, py + 14, pz + uz * 20],
    [lx - ux * 90, Math.max(ly, py) + 14, lz - uz * 90],
    // (low enough to trail a claw in it, as he does; the curve dips a
    // little under its points, so they sit a little higher)
    [lx - ux * 30, ly + 5, lz - uz * 30],
    [lx + ux * 40, ly + 5, lz + uz * 40],
    [lx + ux * 100, ly + 30, lz + uz * 100],
    ...round,
    [px + ux * 40, py + 30, pz + uz * 40],
    [px + ux * 8, py + 6, pz + uz * 8],
    [px, py + 1.6, pz],
  ];
}

const catmull = (p0, p1, p2, p3, t) => {
  const t2 = t * t;
  const t3 = t2 * t;
  return p1.map((_, i) => 0.5 * (2 * p1[i] + (-p0[i] + p2[i]) * t + (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * t2 + (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * t3));
};
const SAMPLES = 40; // a segment

export function newRide(points, { speed = 18, ease = [4, 5] } = {}) {
  // the curve sampled, with the distance along it at each sample
  const at = [];
  let length = 0;
  let last = null;
  for (let s = 0; s < points.length - 1; s++) {
    const p0 = points[Math.max(0, s - 1)];
    const p3 = points[Math.min(points.length - 1, s + 2)];
    for (let k = 0; k < SAMPLES; k++) {
      const p = catmull(p0, points[s], points[s + 1], p3, k / SAMPLES);
      if (last) length += Math.hypot(p[0] - last[0], p[1] - last[1], p[2] - last[2]);
      at.push({ p, d: length });
      last = p;
    }
  }
  const end = points[points.length - 1];
  length += Math.hypot(end[0] - last[0], end[1] - last[1], end[2] - last[2]);
  at.push({ p: end, d: length });
  // a speed that eases up from a standstill and down to one
  const [up, down] = ease;
  const duration = length / speed + (up + down) / 2;
  return { points, at, length, duration, speed, up, down };
}

// distance along the ride at time t
function along(r, t) {
  const { speed: v, up, down, duration: T } = r;
  if (t <= 0) return 0;
  if (t >= T) return r.length;
  if (t < up) return (v * t * t) / (2 * up);
  const cruise = (v * up) / 2;
  if (t < T - down) return cruise + v * (t - up);
  const left = T - t;
  return r.length - (v * left * left) / (2 * down);
}

function pointAt(r, d) {
  const a = r.at;
  let lo = 0;
  let hi = a.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (a[mid].d <= d) lo = mid;
    else hi = mid;
  }
  const span = a[hi].d - a[lo].d || 1;
  const k = Math.min(1, Math.max(0, (d - a[lo].d) / span));
  return a[lo].p.map((v, i) => v + (a[hi].p[i] - v) * k);
}

export function rideAt(r, t) {
  const d = along(r, t);
  const p = pointAt(r, d);
  const ahead = pointAt(r, Math.min(r.length, d + 3));
  const behind = pointAt(r, Math.max(0, d - 3));
  const dir = [ahead[0] - behind[0], ahead[1] - behind[1], ahead[2] - behind[2]];
  const flat = Math.hypot(dir[0], dir[2]);
  const yaw = Math.atan2(dir[0], dir[2]);
  const pitch = Math.atan2(dir[1], flat || 1);
  // the bank from how fast the heading turns here (a wing down into the turn)
  const further = pointAt(r, Math.min(r.length, d + 12));
  const turn = Math.atan2(Math.sin(Math.atan2(further[0] - ahead[0], further[2] - ahead[2]) - yaw), Math.cos(Math.atan2(further[0] - ahead[0], further[2] - ahead[2]) - yaw));
  const bank = Math.max(-0.6, Math.min(0.6, -turn * 2));
  return { p, yaw, pitch, bank, done: t >= r.duration };
}

export const result = () => ({ type: 'lesson', id: 'buckbeak', done: true, points: BOW.points });

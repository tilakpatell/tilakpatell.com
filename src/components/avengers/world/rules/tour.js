// The swing tour, Peter's backpacks and the lap ghost.

import { CRES } from '../../compound/plan';
import { FLAGS, FLAG_H, MASTS, MAST_H, S, solidById } from './plan';

// ── the swing tour: rings round the compound, against the clock ──
// Up the main drive, under the bridge, round the back of the main building,
// over the glass wing's roof, past the training center and the lab's roof,
// and home by the gate. Through the first ring starts the clock.
export const RING_R = 3.2;
export const TOUR = (() => {
  const at = [
    [96, 5, 100],
    [84, 11, 66],
    [64, 8.5, 56],
    [64.5, 7, 41.5],
    [63, 11, 15],
    [95, 12, 6],
    [127, 31.5, 27],
    [140, 13, 60],
    [178, 10, 66],
    [160, 11, 102],
    [148, 18, 126],
    [104, 8, 132],
  ];
  return at.map(([x, y, z], i) => {
    // facing along the course: from the ring before toward the ring after
    const a = at[Math.max(0, i - 1)];
    const b = at[Math.min(at.length - 1, i + 1)];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) || 1;
    return { x, y, z, n: [(b[0] - a[0]) / l, (b[1] - a[1]) / l, (b[2] - a[2]) / l] };
  });
})();
// how long a tour may go without a ring before it's given up (s)
export const TOUR_GAP = 30;

// Whether going from p0 to p1 (his middle) took him through a ring.
export function throughRing(p0, p1, r, rad = RING_R + 0.5) {
  const d0 = (p0[0] - r.x) * r.n[0] + (p0[1] - r.y) * r.n[1] + (p0[2] - r.z) * r.n[2];
  const d1 = (p1[0] - r.x) * r.n[0] + (p1[1] - r.y) * r.n[1] + (p1[2] - r.z) * r.n[2];
  if (d0 > 0 || d1 < 0 || d0 === d1) return false; // (only forwards, along the course)
  const t = d0 / (d0 - d1);
  const qx = p0[0] + (p1[0] - p0[0]) * t - r.x;
  const qy = p0[1] + (p1[1] - p0[1]) * t - r.y;
  const qz = p0[2] + (p1[2] - p0[2]) * t - r.z;
  return Math.hypot(qx, qy, qz) < rad;
}

export const newTour = (best = null) => ({ on: false, next: 0, t: 0, since: 0, best });
// One step of the tour, from where he was (p0) to where he is (p1): → [tour, events]
export function stepTour(tour, p0, p1, dt) {
  const t = { ...tour };
  const ev = [];
  if (t.on) {
    t.t += dt;
    t.since += dt;
    if (t.since > TOUR_GAP) {
      ev.push({ type: 'tour-lost' });
      return [newTour(t.best), ev];
    }
  }
  if (throughRing(p0, p1, TOUR[t.next])) {
    if (t.next === 0) {
      t.on = true;
      t.t = 0;
      ev.push({ type: 'tour-start' });
    } else ev.push({ type: 'tour-ring', n: t.next });
    t.since = 0;
    t.next += 1;
    if (t.next === TOUR.length) {
      const best = t.best == null || t.t < t.best;
      ev.push({ type: 'tour-done', time: t.t, best });
      return [newTour(best ? t.t : t.best), ev];
    }
  }
  return [t, ev];
}

// ── Peter's backpacks ──
// He keeps losing them, and webs them up wherever he was when he noticed:
// a dozen of them round the compound, on the roofs, up the masts and under
// the bridge, each with something of his in it and a word about it. Walk
// (or swing, or land) up to one to find it. `at` is [x, y, z] in metres,
// where it sits (a roof, a mast's top, the ground); `where` is for the list.
const packAt = (id, [px, py, pz], where, memento, line) => ({ id, x: px, y: py, z: pz, where, memento, line });
const roofAt = (b, x, y) => [x * S, solidById(b).h, y * S];
export const PACK_R = 1.7; // how near his middle has to come to one
export const PACKS = [
  packAt('hangar', roofAt('hangar', 18, 58), 'The hangar’s roof, by the A', 'The Stark Internship badge', 'Mr. Stark said it was a real internship. The badge doesn’t open any doors. I checked.'),
  packAt('prow', roofAt('prow', 55, 22), 'The main building’s roof, by the comms mast', 'A Midtown Tech decathlon medal', 'Second place. Flash still says the Washington trip didn’t count.'),
  packAt('wing', [(CRES.cx + 32 * Math.cos((44.75 * Math.PI) / 180)) * S, solidById('wing').h, (CRES.cy + 32 * Math.sin((44.75 * Math.PI) / 180)) * S], 'The glass wing’s roof, between the plant rooms', 'Happy’s business card', 'He’s not answering the number on it. He never answers the number on it.'),
  packAt('clerestory', roofAt('clerestory', 110, 22.5), 'The top of the training center’s clerestory', 'A web-fluid cartridge, empty', 'Note to self: refill before patrol. Every time, Peter.'),
  packAt('lab', roofAt('lab', 92, 75.8), 'The lab’s roof, between the roof lights', 'Ned’s Lego Emperor Palpatine', 'He wants it back. He’s wanted it back since sophomore year.'),
  packAt('bridge', roofAt('bridge', 37, 26.2), 'On top of the bridge', 'Half a churro', 'A nice lady gave me this after I helped her with directions. I’m saving it.'),
  packAt('underbridge', [41 * S, 0, 26.2 * S], 'Under the bridge', 'A Stark Expo ticket stub, 2010', 'I was eight. There was a guy in a helmet. It’s a long story.'),
  packAt('mast', [MASTS[1].x, MAST_H + 0.95, MASTS[1].z], 'The top of a floodlight mast, by the helipad', 'Aunt May’s walnut date loaf, wrapped', 'Nobody eats it, but you take it. That’s the rule.'),
  packAt('gate', roofAt('gate', 42, 100), 'The gatehouse roof', 'A library book, three years overdue', 'Midtown’s going to find out eventually.'),
  packAt('berm', roofAt('berm', -12, 14.5), 'On the range’s berm', 'Clint’s practice arrow, snapped', 'He said keep it. He also said I can’t aim. Both true.'),
  packAt('stalls', roofAt('stalls', -12, 66), 'The roof of the range’s stalls', 'A Sokovia Accords pamphlet', 'I was going to read it on the plane. Then there was an airport.'),
  packAt('flag', [FLAGS[1].x, FLAG_H + 0.5, FLAGS[1].z], 'The top of the middle flagpole', 'MJ’s drawing of me in a crisis', 'She says it’s not a compliment. I’m keeping it anyway.'),
];
// The backpack within reach of someone whose feet are at (x, y, z) that isn't
// among `found` (ids), nearest first; null if none.
export function nearPack(x, y, z, found = []) {
  let best = null;
  for (const p of PACKS) {
    if (found.includes(p.id)) continue;
    const d = Math.hypot(p.x - x, p.y + 0.3 - (y + 1), p.z - z);
    if (d < PACK_R && (!best || d < best.d)) best = { p, d };
  }
  return best?.p ?? null;
}

// ── the best lap, as a ghost ──
// A tour is recorded as it goes: where he is every tenth of a second, as
// [x, y, z, face] to a decimal, and the best lap's recording is kept, so
// the next tour can race it: a hologram of him going round his best time.
export const LAP = { every: 0.1, max: 1200 }; // samples: two minutes at most
// The recording with a sample added, if a tenth of a second has gone since
// the last (`t` is the tour's clock): → the recording (the same one if not).
export function recordLap(rec, h, t) {
  if (rec.length >= LAP.max) return rec;
  const n = rec.length;
  if (n && t < n * LAP.every - 1e-6) return rec;
  const r1 = (v) => Math.round(v * 10) / 10;
  return [...rec, [r1(h.x), r1(h.y), r1(h.z), Math.round(h.face * 100) / 100]];
}
// Where the ghost is at `t` seconds into the lap: between the samples either
// side, held at the ends. → { x, y, z, face, speed } or null for no lap.
export function lapAt(rec, t) {
  if (!rec?.length) return null;
  const k = Math.max(0, Math.min(rec.length - 1, t / LAP.every));
  const i = Math.floor(k);
  const a = rec[i];
  const b = rec[Math.min(rec.length - 1, i + 1)];
  const f = k - i;
  let df = b[3] - a[3];
  df = Math.atan2(Math.sin(df), Math.cos(df));
  return { x: a[0] + (b[0] - a[0]) * f, y: a[1] + (b[1] - a[1]) * f, z: a[2] + (b[2] - a[2]) * f, face: a[3] + df * f, speed: Math.hypot(b[0] - a[0], b[2] - a[2]) / LAP.every };
}
// A recording as kept (or anything): a list of four-number samples, or null.
export const readLap = (raw) => (Array.isArray(raw) && raw.length > 1 && raw.every((p) => Array.isArray(p) && p.length === 4 && p.every(Number.isFinite)) ? raw.slice(0, LAP.max) : null);

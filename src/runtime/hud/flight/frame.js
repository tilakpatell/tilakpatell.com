// The flight HUD's record: what the overlay shows this frame, worked out
// from plain values each map's scene hands it (its ship, its lock, its
// lists of threats and mates, its goal), the way both scenes' placeHud
// worked it out before. flightHud.js writes it into the page. Pure (no
// three.js, no DOM): the scene passes its own projection, `project(x, y,
// z, out)` → out { x, y (px), z (depth in front) }.
//
//   createFrame() → the record, made once and filled in place every frame:
//     { on, static, rect,
//       reticle: { on, x, y, hot, hit, kill },
//       lock:    { on, x, y, z, r, hot, name, dist, text, tough, hp },
//       lead:    { on, x, y, hot },
//       threats: { n, at: [{ x, y, z } × 3] } | null (on foot: left as it was),
//       mates:   { n, at: [{ x, y, z, name } × 4] } | null (likewise),
//       nav:     { on, x, y, z, r, way, name, dist, text },
//       cluster, speed, kills, target, radar, wanted, alt (the cluster's parts: null for now) }
//   fillFlight(frame, v, project) → frame
//     v: { on, gun (the gun line shows), foot, ship ({ x, y, z, heading, pitch } | null on foot),
//          hot, hit, kill, static, rect, tanHalf, h (the view's height in px),
//          lock ({ id, at, size, hp?, hpMax?, dist? } | null), lockName, lockText (null: the
//          distance in the map's unit), bracket ({ k, min, max }: BRACKET by default),
//          lead ({ x, y, z, t } | null), life (a shot's seconds: the pip's reach),
//          threatsFrom ([list | null]: each list's candidates with a threat), mates (list | null),
//          to ({ id, name, at } | null: the pilot flown to), goal ({ at: [x, y, z], reach, way,
//          name, text, dist? } | null), navMin (34 by default), navMax }
//   distText(d)  a distance as the HUD writes it: a tenth under ten, whole past it
//   BRACKET      the lock's bracket in flight: ×2.6 its size on screen, 30 to 140 px

import { nose, onScreen } from '../../../lib/combat/flight/targeting.js';

export const BRACKET = { k: 2.6, min: 30, max: 140 };
const THREATS = 3;
const NONE = Object.freeze([]);
const MATES = 4;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const apart = (ax, ay, az, bx, by, bz) => Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2 + (az - bz) ** 2);

export const distText = (d) => (d < 10 ? d.toFixed(1) : Math.round(d).toString());

export function createFrame() {
  return {
    on: false,
    static: false,
    rect: null,
    reticle: { on: false, x: 0, y: 0, hot: false, hit: false, kill: false },
    lock: { on: false, x: 0, y: 0, z: 0, r: 0, hot: false, name: '', dist: 0, text: null, tough: null, hp: 0 },
    lead: { on: false, x: 0, y: 0, hot: false },
    threats: { n: 0, at: Array.from({ length: THREATS }, () => ({ x: 0, y: 0, z: 0 })) },
    mates: { n: 0, at: Array.from({ length: MATES }, () => ({ x: 0, y: 0, z: 0, name: '' })) },
    nav: { on: false, x: 0, y: 0, z: 0, r: 0, way: false, name: '', dist: 0, text: null },
    cluster: null,
    speed: null,
    kills: null,
    target: null,
    radar: null,
    wanted: null,
    alt: null,
  };
}

// (made once: a frame's arrows' records, kept while on foot has them null;
// the lists gathered and sorted, nearest the ship first)
const kept = new WeakMap();
const list = [];
const pt = { x: 0, y: 0, z: 0 };
const gun = [0, 0, 0];
let from = null;
const nearer = (a, b) => apart(a.at.x, a.at.y, a.at.z, from.x, from.y, from.z) - apart(b.at.x, b.at.y, b.at.z, from.x, from.y, from.z);

const has = (l, id) => {
  for (const c of l) if (c.id === id) return true;
  return false;
};

// the first `max` of `list` off the screen, nearest first, into `out.at`
function arrows(out, max, rect, project, named) {
  list.sort(nearer);
  let n = 0;
  for (const c of list) {
    if (n >= max) break;
    project(c.at.x, c.at.y, c.at.z, pt);
    if (onScreen(pt.x, pt.y, pt.z, rect)) continue;
    const a = out.at[n++];
    a.x = pt.x;
    a.y = pt.y;
    a.z = pt.z;
    if (named) a.name = c.name;
  }
  out.n = n;
  list.length = 0;
}

export function fillFlight(frame, v, project) {
  if (!kept.has(frame)) kept.set(frame, { threats: frame.threats, mates: frame.mates });
  const arrowsOf = kept.get(frame);
  const s = v.ship;
  frame.on = v.on;
  frame.static = v.static;
  frame.rect = v.rect;
  // the gun line: a little way out along the nose
  const ret = frame.reticle;
  ret.on = Boolean(v.on && v.gun && s);
  if (ret.on) {
    const [nx, ny, nz] = nose(s, gun);
    project(s.x + nx * 6, s.y + ny * 6, s.z + nz * 6, pt);
    ret.x = pt.x;
    ret.y = pt.y;
    ret.hot = v.hot;
    ret.hit = v.hit;
    ret.kill = v.kill;
  }
  // the lock: brackets round it, its name and range
  const t = v.on ? v.lock : null;
  const lock = frame.lock;
  lock.on = Boolean(t);
  if (t) {
    project(t.at.x, t.at.y, t.at.z, pt);
    const b = v.bracket ?? BRACKET;
    const px = pt.z > 0 ? (t.size / (pt.z * v.tanHalf)) * (v.h / 2) * b.k : 0;
    lock.x = pt.x;
    lock.y = pt.y;
    lock.z = pt.z;
    lock.r = clamp(px, b.min, b.max);
    lock.hot = v.hot;
    lock.name = v.lockName;
    lock.dist = s ? apart(t.at.x, t.at.y, t.at.z, s.x, s.y, s.z) : t.dist;
    lock.text = v.lockText ?? null;
    // (what it has left, for the ones that take a few hits; on foot, not said)
    lock.tough = v.foot ? null : (t.hpMax ?? 1) > 1;
    lock.hp = lock.tough ? t.hp / t.hpMax : 0;
  }
  // the ones coming at you that you can't see, and your allies: arrows at
  // the edge (on foot, left as they were)
  if (v.foot) {
    frame.threats = null;
    frame.mates = null;
  } else {
    frame.threats = arrowsOf.threats;
    frame.mates = arrowsOf.mates;
    frame.threats.n = 0;
    frame.mates.n = 0;
    from = s;
    if (v.on && s) {
      for (const l of v.threatsFrom ?? NONE) if (l) for (const c of l) if (c.threat && c.id !== t?.id) list.push(c);
      arrows(frame.threats, THREATS, v.rect, project, false);
      if (v.mates) {
        for (const c of v.mates) list.push(c);
        // (and the pilot flown to, ally or not, so you can see where the trip's taking you)
        if (v.to && !has(v.mates, v.to.id)) list.push(v.to);
        arrows(frame.mates, MATES, v.rect, project, true);
      }
    }
  }
  // the lead pip, where a shot would meet the lock, while a shot reaches it
  const lead = frame.lead;
  lead.on = false;
  if (t && v.lead && v.lead.t <= v.life) {
    project(v.lead.x, v.lead.y, v.lead.z, pt);
    lead.on = onScreen(pt.x, pt.y, pt.z, v.rect, 8);
    lead.x = pt.x;
    lead.y = pt.y;
    lead.hot = v.hot;
  }
  // the way to go
  const g = v.on ? v.goal : null;
  const nav = frame.nav;
  nav.on = Boolean(g);
  if (g) {
    project(g.at[0], g.at[1], g.at[2], pt);
    const px = pt.z > 0 && g.reach ? (g.reach / (pt.z * v.tanHalf)) * (v.h / 2) * 2.2 : 0;
    nav.x = pt.x;
    nav.y = pt.y;
    nav.z = pt.z;
    nav.r = clamp(px, v.navMin ?? 34, v.navMax);
    nav.way = g.way;
    nav.name = g.name;
    nav.dist = g.dist ?? (s ? apart(g.at[0], g.at[1], g.at[2], s.x, s.y, s.z) : 0);
    nav.text = g.text ?? null;
  }
  return frame;
}

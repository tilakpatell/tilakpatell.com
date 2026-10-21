// The heroes' powers (./heroes.js names which; F held in the air), as plain
// numbers. Eve transmutes: a pink wall where she looks that stops a thrown
// car or a bolt for a while, or, aimed at a damaged tower, mends it at
// once. Omni-Man breaks the line: two seconds at Mach 2 straight ahead, and
// every window under the line within reach shatters (the towers take a
// little damage), the crowd is floored and Cecil calls. Thragg shouts: a
// ring that throws every foe and car near him. Pure: ./InvWorld.jsx reads
// `push` and the outs, ./scene.js draws them.
//
// newPower() → { cool, line: { until, dir } | null, wall: { p, face, until } | null }
// stepPower(p, hero, input, h, foes, dt, world) → { p, foes, ruins, push, out }
//   hero: ./heroes.js's row; input: { power (F held), look, pressed (its edge) }
//   h: ./flight.js's hero; foes: ./foes.js's state; world: { ruins (./demolish.js),
//   towersNear(p, r) → [{ key, x, z, w, d, h }] for the line and the mend }
//   out: { type: 'construct' | 'mend' | 'linebreak' | 'lineHit' | 'shout' | 'shoutHit', … }
// wallStops(wall, from, to) → whether a thing moving from→to crosses the wall

import { FLY } from './flight';
import { KINDS, knockOut, live, mid } from './foes';
import { DAMAGE, hitTower } from './demolish';

export const POWERS = {
  transmute: { wall: 12, high: 6, life: 6, mend: 0.3, reach: 60, cool: 4 },
  linebreak: { time: 2, mach: 2, speed: 343 * 2, reach: 60, cool: 8 },
  shout: { r: 40, throwSpeed: 26, cool: 8 },
};

export const newPower = () => ({ cool: 0, line: null, wall: null });

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (v) => Math.hypot(v[0], v[1], v[2]);
const unit = (v) => {
  const l = len(v) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const flatUnit = (v) => {
  const l = Math.hypot(v[0], v[2]) || 1;
  return [v[0] / l, 0, v[2] / l];
};

// a wall across the look, `wall` wide, `high` tall, a few metres ahead of her
export function wallOf(h, look, now) {
  const f = flatUnit(look);
  return { p: [h.p[0] + f[0] * 6, h.p[1], h.p[2] + f[2] * 6], face: Math.atan2(f[0], f[2]), until: now + POWERS.transmute.life };
}

// does the move a→b cross the wall's slab (its plane, within its width and height)?
export function wallStops(wall, a, b) {
  if (!wall) return false;
  const n = [Math.sin(wall.face), 0, Math.cos(wall.face)];
  const da = dot(sub(a, wall.p), n);
  const db = dot(sub(b, wall.p), n);
  if (da * db > 0) return false; // (both on the same side)
  const k = Math.abs(da) / (Math.abs(da) + Math.abs(db) || 1);
  const at = [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  const r = [n[2], 0, -n[0]];
  const across = Math.abs(dot(sub(at, wall.p), r));
  const up = at[1] - wall.p[1];
  return across <= POWERS.transmute.wall / 2 && up >= -0.5 && up <= POWERS.transmute.high;
}

export function stepPower(prev, hero, input = {}, h, prevFoes, rawDt, world = {}) {
  const dt = Math.min(0.05, Math.max(0, rawDt || 0));
  const p = { ...prev, cool: Math.max(0, prev.cool - dt) };
  const now = h.t ?? 0;
  const out = [];
  let push = null;
  let foes = prevFoes;
  let ruins = world.ruins ?? null; // (./demolish.js's, given back changed or as it came)
  const look = unit(input.look ?? [0, 0, -1]);
  const id = hero?.power ?? null;
  if (p.wall && now >= p.wall.until) p.wall = null;

  // ── the line, under way: straight on at Mach 2, the windows under it ──
  if (p.line) {
    if (now >= p.line.until) {
      p.line = null;
      out.push({ type: 'lineEnd', at: [...h.p] });
    } else {
      push = p.line.dir.map((c) => c * POWERS.linebreak.speed);
      // the towers along this step's reach: a little damage each, once a line
      const near = world.towersNear?.(h.p, POWERS.linebreak.reach) ?? [];
      for (const t of near) {
        if (p.line.hit.includes(t.key)) continue;
        p.line.hit.push(t.key);
        if (ruins) {
          const r = hitTower(ruins, t.key, DAMAGE.line);
          ruins = r.ruins;
          out.push({ type: 'lineHit', key: t.key, at: [t.x, h.p[1], t.z], d: r.d });
        }
      }
    }
  }

  const wants = Boolean(input.power) && h.mode === 'air' && p.cool <= 0 && !p.line;
  if (wants && id === 'transmute') {
    // aimed at a damaged tower within reach: mended; else a wall ahead
    const near = (world.towersNear?.(h.p, POWERS.transmute.reach) ?? []).filter((t) => (ruins?.damage.get(t.key) ?? 0) > 0 && dot(flatUnit(sub([t.x, h.p[1], t.z], h.p)), flatUnit(look)) > 0.7);
    if (near.length && ruins) {
      const t = near.sort((a, b) => Math.hypot(a.x - h.p[0], a.z - h.p[2]) - Math.hypot(b.x - h.p[0], b.z - h.p[2]))[0];
      const was = ruins.damage.get(t.key);
      const d = Math.max(0, was - POWERS.transmute.mend);
      const damage = new Map(ruins.damage);
      if (d > 0) damage.set(t.key, d);
      else damage.delete(t.key);
      const mending = new Set(ruins.mending ?? []);
      mending.delete(t.key); // (mended by hand: no crews needed)
      ruins = { ...ruins, damage, mending };
      out.push({ type: 'mend', key: t.key, at: [t.x, h.p[1], t.z], d, was });
    } else {
      p.wall = wallOf(h, look, now);
      out.push({ type: 'construct', wall: p.wall });
    }
    p.cool = POWERS.transmute.cool;
  } else if (wants && id === 'linebreak') {
    p.line = { until: now + POWERS.linebreak.time, dir: flatUnit(look), hit: [] };
    p.cool = POWERS.linebreak.cool;
    out.push({ type: 'linebreak', at: [...h.p], dir: p.line.dir });
  } else if (wants && id === 'shout') {
    p.cool = POWERS.shout.cool;
    const chest = [h.p[0], h.p[1] + 1, h.p[2]];
    foes = { ...prevFoes, foes: prevFoes.foes.map((e) => ({ ...e, p: [...e.p], v: [...e.v] })), cars: (prevFoes.cars ?? []).map((c) => ({ ...c, p: [...c.p], v: [...c.v] })) };
    let n = 0;
    for (const e of foes.foes) {
      if (!live(e) || e.state === 'held') continue;
      const m = mid(e);
      if (len(sub(m, chest)) > POWERS.shout.r) continue;
      n++;
      const away = unit(sub(m, chest));
      const ev = [];
      if (KINDS[e.kind ?? 'flaxan'].hits <= 1) knockOut(e, chest, ev, { shouted: true });
      else Object.assign(e, { state: 'thrown', v: [away[0] * POWERS.shout.throwSpeed, 9, away[2] * POWERS.shout.throwSpeed], t: 3 });
      out.push(...ev, { type: 'shoutHit', id: e.id, kind: e.kind ?? 'flaxan', at: m });
    }
    for (const c of foes.cars) {
      if (len(sub(c.p, chest)) > POWERS.shout.r) continue;
      const away = unit(sub(c.p, chest));
      Object.assign(c, { held: null, away: true, v: [away[0] * POWERS.shout.throwSpeed, 8, away[2] * POWERS.shout.throwSpeed], life: 3 });
      n++;
    }
    out.push({ type: 'shout', at: chest, n });
  }

  // the wall: a thrown car or a bolt that crosses it stops there
  if (p.wall && foes.bolts?.length) {
    const bolts = foes.bolts.filter((b) => {
      const to = [b.p[0] + b.v[0] * dt, b.p[1] + b.v[1] * dt, b.p[2] + b.v[2] * dt];
      if (!wallStops(p.wall, b.p, to)) return true;
      out.push({ type: 'wallHit', at: [...b.p] });
      return false;
    });
    if (bolts.length !== foes.bolts.length) foes = { ...foes, bolts };
  }
  if (p.wall && foes.cars?.length) {
    let changed = false;
    const cars = foes.cars.map((c) => {
      if (c.held != null || c.away) return c;
      const to = [c.p[0] + c.v[0] * dt, c.p[1] + c.v[1] * dt, c.p[2] + c.v[2] * dt];
      if (!wallStops(p.wall, c.p, to)) return c;
      changed = true;
      out.push({ type: 'wallHit', at: [...c.p] });
      return { ...c, away: true, v: [0, -4, 0], life: 1 };
    });
    if (changed) foes = { ...foes, cars };
  }
  return { p, foes, ruins, push, out };
}

export const topOf = (hero) => FLY.top * (hero?.flight?.top ?? 1);

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createNpcs } from '../npc';
import { destinationById } from './destinations';

// A place's duel fought in Node through its own data: its duellist hunting
// Morty, who fires (F) every `every` s from 0.3 s on, his bolts landing at
// 90 m/s on what the duellist's cone gives; Morty turned as the walker turns
// him (towards where he walks, rate 12) and by the lock-on (towards the
// duellist, rate 8); with `kite`, stepping back at walking pace for 0.7 s
// whenever the duellist's within 2.6 m. Who won, and when, inside 30 s.
const figure = (x, z) => {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  return { group, height: 2, update() {}, play: () => Promise.resolve(true), stop() {}, react: () => ({}), look() {} };
};
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
function fight(area, who, start, { fire = true, every = 0.6, kite = false }) {
  const d = destinationById(area);
  const P = d.people.find((p) => p.id === who);
  const N = createNpcs({ id: area, area: d.area, solids: d.solids, words: { caught: d.caught } });
  const n = N.add(figure(P.x, P.z), { x: P.x, z: P.z, face: P.face, ai: P.ai, id: who });
  N.hunt(true);
  const dt = 1 / 60;
  const ease = (k) => 1 - Math.exp(-k * dt);
  let m = { x: d.centre.x + start[0], z: d.centre.z + start[1], face: Math.PI / 2, speed: 0 };
  let [firedAt, backUntil, won, beaten] = [-1e9, 0, null, null];
  const bolts = [];
  for (let t = dt; t <= 30 && won == null && beaten == null; t += dt) {
    const p = n.c.group.position;
    const away = Math.hypot(m.x - p.x, m.z - p.z);
    if (kite && away < 2.6 && !backUntil) backUntil = t + 0.7;
    if (backUntil && t > backUntil) backUntil = 0;
    if (backUntil) {
      const k = (3.6 * dt) / Math.max(away, 1e-3);
      m = { ...m, x: Math.min(d.area.x1 - 1, Math.max(d.area.x0 + 1, m.x + (m.x - p.x) * k)), z: Math.min(d.area.z1 - 1, Math.max(d.area.z0 + 1, m.z + (m.z - p.z) * k)), speed: 3.6 };
      m.face += wrap(Math.atan2(-(m.z - p.z), m.x - p.x) - m.face) * ease(12);
    } else m = { ...m, speed: 0 };
    if (fire) m.face += wrap(Math.atan2(-(p.z - m.z), p.x - m.x) - m.face) * ease(8);
    const told = [];
    N.step(n, t, dt, { morty: { ...m }, done: [], fading: false, emit: (name, e) => told.push([name, e]) });
    if (told.some(([name, e]) => name === 'strike' && e.beaten)) beaten = t;
    for (const b of bolts) if (!b.done && t >= b.land) [b.done, won] = [true, N.hit(who)?.down ? t : won];
    if (fire && t > 0.3 && t - firedAt >= every) {
      firedAt = t;
      const r = N.fire({ x: m.x, z: m.z, face: m.face });
      if (r?.at) bolts.push({ land: t + Math.hypot(r.at.x - m.x, r.at.z - m.z) / 90, done: false });
    }
  }
  return won != null ? 'won' : beaten != null ? 'beaten' : 'neither';
}
const ways = (area, who, start) => ({
  none: fight(area, who, start, { fire: false }),
  slow: fight(area, who, start, { every: 1.2 }),
  stand: fight(area, who, start, {}),
  kite: fight(area, who, start, { kite: true }),
});

describe('the duels, fought four ways', () => {
  it('has Hemorrhage beat a Morty who doesn’t fire or fires slowly, and lose to one who fires steadily, standing or keeping out of reach', () => {
    expect(ways('blooddome', 'hemorrhage', [0, -0.1])).toEqual({ none: 'beaten', slow: 'beaten', stand: 'won', kite: 'won' });
  });

  it('has Evil Rick do the same in the lair', () => {
    expect(ways('evilrick', 'evilrick', [-14, 4])).toEqual({ none: 'beaten', slow: 'beaten', stand: 'won', kite: 'won' });
  });
});

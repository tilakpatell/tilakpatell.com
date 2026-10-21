import { describe, expect, it } from 'vitest';
import { SWARM, killSwarm, newSwarm, stepSwarm } from './swarm';

const flat = () => 0;
function run(s, secs, sense, dt = 1 / 30) {
  const ev = [];
  let bite = false;
  for (let t = 0; t < secs; t += dt) {
    const r = stepSwarm(s, typeof sense === 'function' ? sense(s, t) : sense, dt);
    s = r.swarm;
    ev.push(...r.ev);
    bite = bite || r.bite;
  }
  return { s, ev, bite };
}
const spread = (s) => Math.sqrt(s.bodies.reduce((a, b) => a + (b.p[0] - s.mid[0]) ** 2 + (b.p[2] - s.mid[2]) ** 2, 0) / s.bodies.length);

describe('the swarm', () => {
  it('is n bodies round a point', () => {
    const s = newSwarm(300, [10, 4, -5]);
    expect(s.bodies).toHaveLength(300);
    expect(Math.hypot(s.mid[0] - 10, s.mid[2] + 5)).toBeLessThan(1e-6);
    for (const b of s.bodies) expect(Math.hypot(b.p[0] - 10, b.p[2] + 5)).toBeLessThanOrEqual(SWARM.spread + 1e-6);
  });
  it('flocks to its prey and holds together on the way', () => {
    const s0 = newSwarm(200, [0, 4, 0]);
    const { s, bite } = run(s0, 4, { target: [120, 1, 0], punch: null, ground: flat });
    expect(s.mid[0]).toBeGreaterThan(45);
    expect(Math.abs(s.mid[2])).toBeLessThan(10);
    expect(spread(s)).toBeLessThan(SWARM.spread * 2.5);
    expect(bite).toBe(false);
    const there = run(s, 10, { target: [120, 1, 0], punch: null, ground: flat });
    expect(Math.hypot(there.s.mid[0] - 120, there.s.mid[2])).toBeLessThan(SWARM.bite + 1);
    expect(there.bite).toBe(true);
  });
  it('scatters three seconds on a punch into it, then gathers again', () => {
    const s0 = newSwarm(200, [0, 4, 0]);
    const settled = run(s0, 2, { target: [0, 1, 0], punch: null, ground: flat }).s;
    const hit = run(settled, 0.1, (s, t) => ({ target: [0, 1, 0], punch: t === 0 ? [0, 4, 0] : null, ground: flat }));
    expect(hit.ev.some((e) => e.type === 'scatter')).toBe(true);
    expect(hit.s.scatter).toBeGreaterThan(SWARM.scatter - 0.2);
    expect(SWARM.scatter).toBe(3);
    const wide = run(hit.s, 1.5, { target: [0, 1, 0], punch: null, ground: flat });
    expect(spread(wide.s)).toBeGreaterThan(spread(settled) * 1.8);
    expect(wide.bite).toBe(false);
    const back = run(wide.s, 10, { target: [0, 1, 0], punch: null, ground: flat });
    expect(back.s.scatter).toBe(0);
    expect(spread(back.s)).toBeLessThan(spread(wide.s));
  });
  it('a punch wide of it does nothing', () => {
    const s0 = newSwarm(50, [0, 4, 0]);
    const r = run(s0, 0.1, (s, t) => ({ target: null, punch: t === 0 ? [40, 4, 0] : null, ground: flat }));
    expect(r.ev).toEqual([]);
    expect(r.s.scatter).toBe(0);
  });
  it('dies with its host: the bodies fall and lie still', () => {
    const s0 = killSwarm(newSwarm(50, [0, 6, 0]));
    const { s, bite } = run(s0, 4, { target: [0, 1, 0], punch: null, ground: flat });
    expect(bite).toBe(false);
    for (const b of s.bodies) expect(b.p[1]).toBeLessThanOrEqual(0.5);
  });
  it('takes a minute-long step as one short one', () => {
    const s0 = newSwarm(50, [0, 4, 0]);
    const { swarm } = stepSwarm(s0, { target: [1000, 1, 0], punch: null, ground: flat }, 60);
    expect(swarm.mid[0]).toBeLessThan(5);
  });
});

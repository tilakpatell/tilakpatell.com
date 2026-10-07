import { describe, expect, it } from 'vitest';
import { byDistance, createSchedule } from './schedule';

const at = (x, id) => ({ id, pos: { x, y: 0, z: 0 } });
const view = { at: { x: 0, y: 0, z: 0 }, range: 100 };

// a clock the test owns: each done() costs `cost` ms
function clocked(opts = {}, cost = 0.01) {
  let clock = 0;
  const s = createSchedule({ ...opts, now: () => clock });
  const run = (dt, v = view) => {
    const out = s.frame(dt, v, 0);
    for (const e of out.due) {
      clock += typeof cost === 'function' ? cost(e.agent) : cost;
      s.done(e.agent);
    }
    return out;
  };
  return { s, run };
}

const counts = (run, agents, seconds, dt = 0.016, v = view) => {
  const n = new Map(agents.map((a) => [a, { think: 0, sense: 0, dts: [] }]));
  for (let t = 0; t < seconds - 1e-9; t += dt) {
    for (const e of run(dt, v).due) {
      const c = n.get(e.agent);
      if (e.think) {
        c.think++;
        c.dts.push(e.dt);
      }
      if (e.sense) c.sense++;
    }
  }
  return n;
};

describe('byDistance', () => {
  it('is 1 at the eye, 0 at the range and past it', () => {
    expect(byDistance(at(0), view)).toBe(1);
    expect(byDistance(at(50), view)).toBeCloseTo(0.5);
    expect(byDistance(at(1000), view)).toBe(0);
  });

  it('counts everyone fully without a view', () => {
    expect(byDistance(at(1000), null)).toBe(1);
    expect(byDistance(at(1000), undefined)).toBe(1);
  });
});

describe('createSchedule', () => {
  it('an agent thinks at its lane’s rate, with the fixed dt, however the frames fall', () => {
    for (const dt of [0.016, 0.007, 0.033]) {
      const { s, run } = clocked();
      const a = at(1, 'a');
      s.add(a);
      const c = counts(run, [a], 1, dt).get(a);
      expect(c.think).toBeGreaterThanOrEqual(9);
      expect(c.think).toBeLessThanOrEqual(11);
      for (const d of c.dts) expect(Math.abs(d - 0.1)).toBeLessThan(1e-9);
    }
  });

  it('sense runs at 20 Hz and think at 10 Hz for the same agent', () => {
    const { s, run } = clocked();
    const a = at(1, 'a');
    s.add(a);
    const c = counts(run, [a], 2).get(a);
    expect(c.sense).toBeGreaterThanOrEqual(38);
    expect(c.sense).toBeLessThanOrEqual(41);
    expect(c.think).toBeGreaterThanOrEqual(19);
    expect(c.think).toBeLessThanOrEqual(21);
  });

  it('rates given in part keep the defaults for the rest', () => {
    const { s, run } = clocked({ rates: { think: 5 } });
    const a = at(1, 'a');
    s.add(a);
    const c = counts(run, [a], 2).get(a);
    expect(c.sense).toBeGreaterThanOrEqual(38);
    expect(c.sense).toBeLessThanOrEqual(41);
    expect(c.think).toBeGreaterThanOrEqual(9);
    expect(c.think).toBeLessThanOrEqual(11);
  });

  it('throws on an unknown lane, not a brain that never thinks', () => {
    const s = createSchedule();
    expect(() => s.add(at(1, 'a'), { lane: 'thinc' })).toThrow(/thinc/);
    // a lane of the caller's own is a lane once it has a rate
    expect(() => createSchedule({ rates: { patrol: 2 } }).add(at(1, 'b'), { lane: 'patrol' })).not.toThrow();
  });

  it('stats carries each agent’s significance from its rank', () => {
    const { s, run } = clocked();
    for (const a of [at(10, 'near'), at(60, 'far'), at(200, 'gone')]) s.add(a);
    run(0.016);
    const { sig } = s.stats();
    expect(sig.near).toBeCloseTo(0.9);
    expect(sig.far).toBeCloseTo(0.4);
    expect(sig.gone).toBe(0);
    // a copy: the caller's edits don't reach the schedule
    sig.near = 0;
    expect(s.stats().sig.near).toBeCloseTo(0.9);
  });

  it('an ambient agent thinks at 4 Hz, and one that doesn’t sense never does', () => {
    const { s, run } = clocked();
    const a = at(1, 'a');
    s.add(a, { lane: 'ambient', sense: false });
    const c = counts(run, [a], 2).get(a);
    expect(c.sense).toBe(0);
    expect(c.think).toBeGreaterThanOrEqual(7);
    expect(c.think).toBeLessThanOrEqual(9);
  });

  it('a paused agent accrues nothing and thinks once, dt clamped, when it ranks again', () => {
    const { s, run } = clocked();
    const near = at(1, 'near');
    const far = at(1000, 'far');
    s.add(near);
    s.add(far);
    const c = counts(run, [near, far], 3);
    expect(c.get(far).think).toBe(0);
    expect(c.get(far).sense).toBe(0);
    far.pos.x = 0.5; // nearer than the other, so the top tier
    // back within one ranking (0.5 s), and once, with one step's dt
    let first = null;
    for (let t = 0; t < 0.6 && !first; t += 0.016) {
      const mine = run(0.016).due.filter((e) => e.agent === far);
      if (mine.length) {
        expect(mine).toHaveLength(1);
        first = mine[0];
      }
    }
    expect(first?.think).toBe(true);
    expect(first.dt).toBeCloseTo(0.1, 9);
  });

  it('ranks spread the rate by tier', () => {
    const { s, run } = clocked();
    const agents = [1, 10, 50, 1000].map((d) => at(d, `d${d}`));
    for (const a of agents) s.add(a);
    const c = counts(run, agents, 2);
    const thinks = agents.map((a) => c.get(a).think);
    const want = [20, 10, 5, 0];
    thinks.forEach((n, i) => expect(Math.abs(n - want[i])).toBeLessThanOrEqual(1));
  });

  it('a slower tier’s dt is the real time its step stands for, so it keeps time', () => {
    const { s, run } = clocked();
    const agents = [1, 10, 50].map((d) => at(d, `d${d}`));
    for (const a of agents) s.add(a);
    const c = counts(run, agents, 2);
    // after the first ranking, each step's dt is 0.1 / its tier's share
    expect(c.get(agents[1]).dts.slice(1).every((d) => Math.abs(d - 0.2) < 1e-9)).toBe(true);
    expect(c.get(agents[2]).dts.slice(1).every((d) => Math.abs(d - 0.4) < 1e-9)).toBe(true);
  });

  it('without a view every agent runs at the full rate', () => {
    const { s, run } = clocked();
    const agents = [1, 10, 50, 1000].map((d) => at(d, `d${d}`));
    for (const a of agents) s.add(a);
    const c = counts(run, agents, 2, 0.016, null);
    for (const a of agents) expect(Math.abs(c.get(a).think - 20)).toBeLessThanOrEqual(1);
  });

  it('a crowd’s phases are spread, not in step', () => {
    const { s, run } = clocked();
    const agents = Array.from({ length: 20 }, (_, i) => ({ id: `npc:${i}`, pos: { x: 5, y: 0, z: 0 } }));
    for (const a of agents) s.add(a);
    let most = 0;
    for (let t = 0; t < 3; t += 0.016) most = Math.max(most, run(0.016).due.filter((e) => e.think).length);
    expect(most).toBeLessThanOrEqual(4);
  });

  it('an agent’s phase is its own, whatever order it was added in', () => {
    const firstThink = (order) => {
      const { s, run } = clocked();
      const agents = order.map((id) => at(1, id));
      for (const a of agents) s.add(a);
      for (let f = 0; f < 10; f++) {
        const e = run(0.016).due.find((x) => x.agent.id === 'b' && x.think);
        if (e) return f;
      }
      return -1;
    };
    expect(firstThink(['a', 'b'])).toBe(firstThink(['b', 'a']));
  });

  it('the budget defers in rank order and counts the deferrals', () => {
    const { s, run } = clocked({ budget: { ms: 1 } }, 0.1);
    const agents = Array.from({ length: 60 }, (_, i) => ({ id: `n${i}`, pos: { x: 1, y: 0, z: 0 } }));
    for (const a of agents) s.add(a);
    // a short frame learns what a think costs
    run(0.016, null);
    // a whole step at once: every agent due
    const big = run(0.1, null);
    const thought = big.due.length;
    // 1 ms of 0.1 ms thinks is ten, give or take the edge
    expect(thought).toBeGreaterThanOrEqual(9);
    expect(thought).toBeLessThanOrEqual(11);
    expect(s.stats().skipped).toBeGreaterThanOrEqual(49 - 10);
    expect(thought + s.stats().skipped).toBeGreaterThanOrEqual(50);
    const handed = new Set(big.due.map((e) => e.agent));
    const next = run(0.001, null);
    expect(next.due.length).toBeGreaterThan(0);
    expect(handed.has(next.due[0].agent)).toBe(false);
  });

  it('defers the least significant first', () => {
    const { s, run } = clocked({ budget: { ms: 0.35 } }, 0.1);
    const agents = [3, 1, 4, 2].map((d) => at(d, `d${d}`));
    for (const a of agents) s.add(a);
    // long frames, so every tier is due: the first learns the costs
    run(1);
    const out = run(1);
    expect(out.due.map((e) => e.agent.id)).toEqual(['d1', 'd2', 'd3']);
  });

  it('stats names the worst agent', () => {
    const slow = at(1, 'slow');
    const quick = at(1, 'quick');
    const { s, run } = clocked({}, (a) => (a === slow ? 0.4 : 0.01));
    s.add(slow);
    s.add(quick);
    run(0.2, null);
    const st = s.stats();
    expect(st.agents).toBe(2);
    expect(st.thought).toBe(2);
    expect(st.worst).toEqual({ id: 'slow', ms: expect.closeTo(0.4, 9) });
    expect(st.ms).toBeCloseTo(0.41, 9);
  });

  it('drop forgets an agent', () => {
    const { s, run } = clocked();
    const a = at(1, 'a');
    s.add(a);
    s.drop(a);
    expect(counts(run, [a], 1).get(a).think).toBe(0);
    expect(s.stats().agents).toBe(0);
  });

  it('without a clock the budget is a count', () => {
    const s = createSchedule({ now: () => undefined, budget: { ms: 0.5 } });
    for (let i = 0; i < 30; i++) s.add({ id: `n${i}`, pos: { x: 1, y: 0, z: 0 } });
    const out = s.frame(0.1, null, 0);
    for (const e of out.due) s.done(e.agent);
    expect(out.due.length).toBe(10);
  });
});

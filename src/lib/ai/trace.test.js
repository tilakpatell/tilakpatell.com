import { describe, expect, it } from 'vitest';
import { createTrace } from './trace';

describe('the trace', () => {
  it('the ring keeps the last size records per agent', () => {
    const trace = createTrace({ size: 3 });
    for (let i = 0; i < 5; i++) trace.note('a', i / 10, { mode: 'idle', i });
    trace.note('b', 0, { mode: 'chase' });
    expect(trace.history('a', 10).map((r) => r.i)).toEqual([2, 3, 4]);
    expect(trace.history('b')).toHaveLength(1);
    expect(trace.agents().sort()).toEqual(['a', 'b']);
  });

  it('history returns newest last', () => {
    const trace = createTrace({ size: 4 });
    for (let i = 0; i < 7; i++) trace.note('a', i, { i });
    expect(trace.history('a', 2).map((r) => r.i)).toEqual([5, 6]);
    expect(trace.history('a').map((r) => r.t)).toEqual([3, 4, 5, 6]);
    expect(trace.last('a')).toEqual({ i: 6, t: 6 });
    expect(trace.last('nobody')).toBeNull();
    expect(trace.history('nobody')).toEqual([]);
  });

  it('stores t on the record without touching the caller’s object', () => {
    const trace = createTrace();
    const record = { mode: 'idle' };
    trace.note('a', 1.5, record);
    expect(trace.last('a')).toEqual({ mode: 'idle', t: 1.5 });
    expect(record).toEqual({ mode: 'idle' });
  });

  it('export is plain JSON', () => {
    const trace = createTrace({ size: 2 });
    trace.note('a', 0, { mode: 'idle', scores: { wait: 0.4 } });
    trace.note('a', 0.1, { mode: 'chase', belief: { at: { x: 1, z: 2 }, confidence: 0.8, visible: true } });
    trace.note('a', 0.2, { mode: 'fire' });
    trace.note('b', 0, { mode: 'idle' });
    const out = trace.export();
    expect(JSON.parse(JSON.stringify(out))).toEqual(out);
    expect(out.size).toBe(2);
    expect(out.agents.a.map((r) => r.mode)).toEqual(['chase', 'fire']);
    expect(out.agents.b).toHaveLength(1);
  });

  it('clear forgets one agent or all', () => {
    const trace = createTrace();
    trace.note('a', 0, {});
    trace.note('b', 0, {});
    trace.clear('a');
    expect(trace.agents()).toEqual(['b']);
    trace.clear();
    expect(trace.agents()).toEqual([]);
  });
});

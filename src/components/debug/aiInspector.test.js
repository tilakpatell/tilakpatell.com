import { describe, expect, it } from 'vitest';
import { createSchedule } from '../../lib/ai/schedule';
import { bars, rows } from './aiInspector';

const actor = (id) => ({ current: () => id });

describe('rows', () => {
  it('sorts the agents by significance, most first', () => {
    const out = rows({ agents: 3 }, [
      { id: 'a', kind: 'orc', mode: 'idle', sig: 0.2 },
      { id: 'b', kind: 'orc', mode: 'chase', sig: 0.9 },
      { id: 'c', kind: 'elf', mode: 'wander', sig: 0.5 },
    ]);
    expect(out.map((r) => r.id)).toEqual(['b', 'c', 'a']);
  });

  it('sorts by the schedule’s own significance, carried in its stats', () => {
    const s = createSchedule({ now: () => 0 });
    const agents = [
      { id: 'a', kind: 'orc', pos: { x: 80, y: 0, z: 0 } },
      { id: 'b', kind: 'orc', pos: { x: 5, y: 0, z: 0 } },
      { id: 'c', kind: 'elf', pos: { x: 40, y: 0, z: 0 } },
    ];
    for (const a of agents) s.add(a);
    s.frame(0.016, { at: { x: 0, y: 0, z: 0 }, range: 100 }, 0);
    const out = rows(s.stats(), agents);
    expect(out.map((r) => r.id)).toEqual(['b', 'c', 'a']);
    expect(out[0].sig).toBeCloseTo(0.95);
  });

  it('takes the action and phase from the actor, the mode from the row', () => {
    const [r] = rows({}, [{ id: 'a', kind: 'orc', mode: 'chase', sig: 1, actor: actor('swing') }]);
    expect(r).toEqual({ id: 'a', kind: 'orc', mode: 'chase', action: 'swing', phase: 'running', sig: 1 });
    const [idle] = rows({}, [{ id: 'a', kind: 'orc', mode: 'idle', actor: actor(null) }]);
    expect(idle.action).toBe(null);
    expect(idle.phase).toBe('idle');
  });

  it('falls back on the last record when there is no actor', () => {
    const [r] = rows({}, [{ id: 'a', kind: 'orc', last: { mode: 'flee', action: 'run', phase: 'ending' } }]);
    expect(r).toMatchObject({ mode: 'flee', action: 'run', phase: 'ending', sig: 0 });
  });

  it('reads a significance the stats carry, and a broken actor costs only its row', () => {
    const out = rows({ sig: { a: 0.1, b: 0.7 } }, [
      { id: 'a', kind: 'x', actor: { current: () => { throw new Error('gone'); } } },
      { id: 'b', kind: 'x' },
    ]);
    expect(out.map((r) => r.id)).toEqual(['b', 'a']);
    expect(out[1].action).toBe(null);
  });

  it('is empty for no agents', () => {
    expect(rows(null, null)).toEqual([]);
  });
});

describe('bars', () => {
  it('gives the best 1 and the rest in proportion, best first', () => {
    expect(bars({ attack: 2, flee: 1, idle: 0.5 })).toEqual([
      { id: 'attack', w: 1 },
      { id: 'flee', w: 0.5 },
      { id: 'idle', w: 0.25 },
    ]);
  });

  it('is zero all round when every score is zero (or below)', () => {
    expect(bars({ a: 0, b: -1 })).toEqual([
      { id: 'a', w: 0 },
      { id: 'b', w: 0 },
    ]);
  });

  it('is empty for no scores', () => {
    expect(bars(undefined)).toEqual([]);
  });
});

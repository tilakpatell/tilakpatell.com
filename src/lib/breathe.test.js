import { describe, expect, it, vi } from 'vitest';
import { breather } from './breathe';

describe('a long piece of work, a breath at a time', () => {
  it('goes straight on while the part so far is under its budget', async () => {
    let t = 0;
    const gap = vi.fn((fn) => fn());
    const breathe = breather(12, { now: () => t, gap });
    t = 5;
    await breathe();
    t = 11.9;
    await breathe();
    expect(gap).not.toHaveBeenCalled();
  });

  it('gives the page a turn once it is over, and starts its count again after', async () => {
    let t = 0;
    const turns = [];
    const gap = vi.fn((fn) => turns.push(fn));
    const breathe = breather(12, { now: () => t, gap });
    t = 13;
    let done = false;
    const waiting = breathe().then(() => (done = true));
    await Promise.resolve();
    expect(gap).toHaveBeenCalledTimes(1);
    expect(done).toBe(false);
    t = 20;
    turns.shift()();
    await waiting;
    expect(done).toBe(true);
    // (counted from the turn: 20 + 11 is still under)
    t = 31;
    await breathe();
    expect(gap).toHaveBeenCalledTimes(1);
    t = 33;
    breathe();
    expect(gap).toHaveBeenCalledTimes(2);
  });

  it('gives its turn as a task, after what was already waiting', async () => {
    const order = [];
    const breathe = breather(0);
    setTimeout(() => order.push('the click'), 0);
    await breathe();
    order.push('the work');
    expect(order).toEqual(['the click', 'the work']);
  });
});

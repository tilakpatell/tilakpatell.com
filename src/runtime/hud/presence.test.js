import { describe, expect, it } from 'vitest';
import { FIGHT_MS, LOCK_MS, LOW, createPresence } from './presence.js';

// a frame's input, quiet unless told otherwise
const quiet = (o = {}) => ({ threats: 0, hit: false, kill: false, lock: false, shields: 1, ...o });

describe('presence', () => {
  it('starts with nothing out', () => {
    const p = createPresence();
    expect(p.step(0, quiet())).toEqual({ fight: false, target: false, low: false });
  });

  it('brings the guns out while a hostile has an arrow, and keeps them out six seconds after', () => {
    const p = createPresence();
    expect(p.step(0, quiet({ threats: 2 })).fight).toBe(true);
    expect(p.step(1000, quiet({ threats: 1 })).fight).toBe(true); // (the last frame with an arrow: the six seconds run from here)
    expect(p.step(1000 + FIGHT_MS - 1, quiet()).fight).toBe(true);
    expect(p.step(1000 + FIGHT_MS + 1, quiet()).fight).toBe(false);
  });

  it('counts a hit or a kill of yours as fighting', () => {
    const p = createPresence();
    expect(p.step(0, quiet({ hit: true })).fight).toBe(true);
    expect(p.step(FIGHT_MS + 1, quiet()).fight).toBe(false);
    expect(p.step(10000, quiet({ kill: true })).fight).toBe(true);
  });

  it('counts the shields falling as fighting, and their coming back as not', () => {
    const p = createPresence();
    p.step(0, quiet({ shields: 0.8 }));
    expect(p.step(100, quiet({ shields: 0.6 })).fight).toBe(true);
    const q = createPresence();
    q.step(0, quiet({ shields: 0.6 }));
    expect(q.step(100, quiet({ shields: 0.7 })).fight).toBe(false);
  });

  it('is poked out by a fight key, and the poke ages as any other', () => {
    const p = createPresence();
    p.poke(500);
    expect(p.step(600, quiet()).fight).toBe(true);
    expect(p.step(500 + FIGHT_MS + 1, quiet()).fight).toBe(false);
  });

  it('shows the target while there is a lock, and two seconds after it drops', () => {
    const p = createPresence();
    expect(p.step(0, quiet({ lock: true })).target).toBe(true);
    expect(p.step(100, quiet({ lock: true })).target).toBe(true); // (the lock's last frame)
    expect(p.step(100 + LOCK_MS - 1, quiet()).target).toBe(true);
    expect(p.step(100 + LOCK_MS + 1, quiet()).target).toBe(false);
  });

  it('warns under 35 % of the shields, and says nothing with no shields to read (on foot)', () => {
    const p = createPresence();
    expect(p.step(0, quiet({ shields: LOW - 0.01 })).low).toBe(true);
    expect(p.step(1, quiet({ shields: LOW + 0.01 })).low).toBe(false);
    expect(p.step(2, quiet({ shields: null })).low).toBe(false);
    // (and a reading after none isn't a fall)
    expect(p.step(3, quiet({ shields: 0.2 })).fight).toBe(false);
  });

  it('fills one record in place every frame', () => {
    const p = createPresence();
    const a = p.step(0, quiet());
    const b = p.step(16, quiet({ threats: 1 }));
    expect(a).toBe(b);
  });

  it('takes its holds as asked, and forgets everything on reset', () => {
    const p = createPresence({ fightMs: 100, lockMs: 50 });
    p.step(0, quiet({ hit: true, lock: true }));
    expect(p.step(101, quiet())).toMatchObject({ fight: false, target: false });
    p.step(200, quiet({ threats: 1, lock: true }));
    p.reset();
    expect(p.step(201, quiet())).toMatchObject({ fight: false, target: false });
  });
});

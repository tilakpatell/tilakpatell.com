import { describe, expect, it } from 'vitest';
import { BEACONS, CHAIN, alight, nameBeacon, newChain, stepChain } from './beacons';

const run = (c, s, dt = 0.05) => {
  const ev = [];
  for (let t = 0; t < s; t += dt) ev.push(...stepChain(c, dt));
  return ev;
};
const showAll = (c) => run(c, CHAIN.wait + c.round * CHAIN.show + 0.1);

describe('Gondor calls for aid', () => {
  it('names the seven beacons east to west, Amon Dîn to Halifirien', () => {
    expect(BEACONS.map((b) => b.name)).toEqual(['Amon Dîn', 'Eilenach', 'Nardol', 'Erelas', 'Min-Rimmon', 'Calenhad', 'Halifirien']);
  });

  it('lights the first three, one after another, then asks for them', () => {
    const c = newChain(3);
    const ev = showAll(c);
    expect(ev.filter((e) => e.type === 'light').map((e) => e.id)).toEqual(['amon-din', 'eilenach', 'nardol']);
    expect(ev.at(-1)).toEqual({ type: 'ask' });
    expect(c.phase).toBe('ask');
    expect(alight(c)).toBe(0);
  });

  it('takes them back in order, a round at a time, up to all seven', () => {
    const c = newChain(5);
    for (let round = CHAIN.first; round <= BEACONS.length; round++) {
      showAll(c);
      for (let i = 0; i < round; i++) {
        const r = nameBeacon(c, BEACONS[i].id);
        expect(r).toBe(i < round - 1 ? 'right' : round < BEACONS.length ? 'round' : 'lit');
      }
      run(c, CHAIN.pause + 0.1);
    }
    expect(c.state).toBe('lit');
    expect(c.slips).toBe(0);
    expect(alight(c)).toBe(BEACONS.length);
  });

  it('a wrong name is a slip, and they are lit again from the first', () => {
    const c = newChain(9);
    showAll(c);
    expect(nameBeacon(c, 'amon-din')).toBe('right');
    expect(nameBeacon(c, 'calenhad')).toBe('wrong');
    expect(c.slips).toBe(1);
    expect(nameBeacon(c, 'eilenach')).toBe(null);
    run(c, CHAIN.pause + 0.1);
    expect(c.phase).toBe('show');
    expect(c.round).toBe(CHAIN.first);
    const again = showAll(c);
    expect(again.filter((e) => e.type === 'light')).toHaveLength(CHAIN.first);
  });

  it('shuffles the names on the buttons, and each deck is all seven', () => {
    const c = newChain(11);
    expect([...c.deck].sort()).toEqual(BEACONS.map((b) => b.id).sort());
    const first = [...c.deck];
    showAll(c);
    for (let i = 0; i < CHAIN.first; i++) nameBeacon(c, BEACONS[i].id);
    run(c, CHAIN.pause + 0.1);
    expect([...c.deck].sort()).toEqual([...first].sort());
    expect(c.deck).not.toEqual(BEACONS.map((b) => b.id));
  });
});

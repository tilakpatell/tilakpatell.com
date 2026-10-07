import { describe, expect, it } from 'vitest';
import { hash, seeded, streams } from './seeded';
import { seeded as shireSeeded } from '../components/middleearth/shire/rules';

describe('seeded', () => {
  it('draws exactly what the Shire’s draws, seed for seed', () => {
    for (const seed of [0, 1, 23, 91, 137, -5, 2 ** 31 - 1]) {
      const a = seeded(seed);
      const b = shireSeeded(seed);
      for (let i = 0; i < 200; i++) expect(a(), `${seed} #${i}`).toBe(b());
    }
  });
});

const three = (rand) => [rand(), rand(), rand()];

describe('streams', () => {
  it('fork gives the same stream for the same label, a different one for another', () => {
    const world = streams(4121);
    expect(world.seed).toBe(4121);
    const vader = three(world.fork('npc:vader'));
    expect(three(world.fork('npc:vader'))).toEqual(vader);
    expect(three(streams(4121).fork('npc:vader'))).toEqual(vader);
    expect(three(world.fork('npc:luke'))).not.toEqual(vader);
    expect(three(streams(4122).fork('npc:vader'))).not.toEqual(vader);
  });

  it('a fork doesn’t depend on what was forked before it', () => {
    const a = streams(9);
    a.fork('hunters')();
    a.fork('director')();
    expect(three(a.fork('npc:vader'))).toEqual(three(streams(9).fork('npc:vader')));
  });

  it('fork is seeded(hash(seed, label))', () => {
    expect(three(streams(7).fork('npc:vader'))).toEqual(three(seeded(hash(7, 'npc:vader'))));
  });
});

describe('hash', () => {
  it('hash is stable', () => {
    expect(hash(7, 'npc:vader')).toBe(787283891);
  });

  it('is an unsigned 32-bit int that moves with the seed and the label', () => {
    for (const [seed, label] of [[0, ''], [7, 'npc:vader'], [-5, 'hunters'], [2 ** 31 - 1, 'director']]) {
      const h = hash(seed, label);
      expect(Number.isInteger(h)).toBe(true);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(2 ** 32);
    }
    expect(hash(7, 'npc:vader')).not.toBe(hash(8, 'npc:vader'));
    expect(hash(7, 'npc:vader')).not.toBe(hash(7, 'npc:vadeR'));
  });
});

import { describe, expect, it } from 'vitest';
import { deployPick } from './deployPick';
import { offersFor } from './points';
import { readHero } from '../../heroes';

const MAP = { system: 'hoth', sides: { attack: { id: 'empire' }, defend: { id: 'rebels' } } };
const offer = (side, id) => offersFor({ mission: MAP, side, points: 1e6 }).find((o) => o.id === id);

describe('who you deploy as', () => {
  it('a class in the world’s own kit, kept as your loadout', () => {
    const { next, keep } = deployPick(offer('defend', 'trooper-rebel-heavy'), readHero({ id: 'luke' }));
    expect(keep).toBe(true);
    expect(next).toMatchObject({ id: 'trooper-rebel-heavy', kind: 'hothtrooper', gun: 'dlt19' });
  });
  it('an enforcer kept too, in its own body', () => {
    const { next, keep } = deployPick(offer('attack', 'trooper-empire-enforcer'));
    expect(keep).toBe(true);
    expect(next).toMatchObject({ id: 'trooper-empire-enforcer', kind: 'deathtrooper', gun: 'dlt19' });
  });
  it('a hero bought for points worn for that life only', () => {
    const { next, keep } = deployPick(offer('attack', 'vader'), readHero({ id: 'trooper-empire-assault' }));
    expect(keep).toBe(false);
    expect(next).toMatchObject({ id: 'vader', color: 'red' });
  });
  it('the same pick again keeps what’s on it', () => {
    const was = readHero({ id: 'trooper-rebel-assault', kind: 'hothtrooper', gun: 'blaster', mods: ['scope'] });
    expect(was.gun).toBe('blaster');
    const { next } = deployPick(offer('defend', 'trooper-rebel-assault'), was);
    expect(next).toEqual(was);
  });
});

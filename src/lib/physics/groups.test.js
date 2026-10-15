import { describe, expect, it } from 'vitest';
import { GROUPS, MEMBERS, filterOf } from './groups';

const member = (g) => g >>> 16;
const filter = (g) => g & 0xffff;
const meets = (a, b) => (member(a) & filter(b)) !== 0 && (member(b) & filter(a)) !== 0;

describe('GROUPS', () => {
  it('his three keep their meaning, with characters in the floor’s and the objects’ filters', () => {
    // (the floor meets everything, an object everything and bumpers, a bumper objects only: as his;
    // a character is in the floor's and the object's filter, not in their membership word, so a
    // query for floor | object never admits a figure: a brain's sight, a bolt's flight)
    expect(GROUPS.floor).toBe((1 << 16) | (1 | MEMBERS.character));
    expect(GROUPS.object).toBe((3 << 16) | (5 | MEMBERS.character));
    expect(GROUPS.bumper).toBe((4 << 16) | 2);
    expect(meets(GROUPS.floor, GROUPS.object)).toBe(true);
    expect(meets(GROUPS.object, GROUPS.bumper)).toBe(true);
    expect(meets(GROUPS.floor, GROUPS.bumper)).toBe(false);
  });

  it('a query for the floor and objects never admits a character', () => {
    const f = filterOf('floor', 'object');
    expect(member(GROUPS.character) & filter(f)).toBe(0);
    expect(member(GROUPS.floor) & filter(f)).not.toBe(0);
    expect(member(GROUPS.object) & filter(f)).not.toBe(0);
    expect(member(GROUPS.character) & filter(filterOf('floor', 'object', 'character'))).not.toBe(0);
  });

  it('a character meets the floor and another character, not a hurtbox', () => {
    expect(meets(GROUPS.character, GROUPS.floor)).toBe(true);
    expect(meets(GROUPS.character, GROUPS.object)).toBe(true);
    expect(meets(GROUPS.character, GROUPS.character)).toBe(true);
    expect(meets(GROUPS.character, GROUPS.hurtbox)).toBe(false);
    expect(meets(GROUPS.hurtbox, GROUPS.floor)).toBe(false);
  });

  it('a barrier meets a character and nothing else: not the floor, an object, a bolt’s or a sight’s query', () => {
    expect(meets(GROUPS.barrier, GROUPS.character)).toBe(true);
    expect(meets(GROUPS.barrier, GROUPS.floor)).toBe(false);
    expect(meets(GROUPS.barrier, GROUPS.object)).toBe(false);
    expect(member(GROUPS.barrier) & filter(GROUPS.projectile)).toBe(0);
    expect(member(GROUPS.barrier) & filter(GROUPS.sight)).toBe(0);
  });

  it('a zone meets a character and nothing else by contact', () => {
    expect(meets(GROUPS.zone, GROUPS.character)).toBe(true);
    expect(meets(GROUPS.zone, GROUPS.floor)).toBe(false);
    expect(meets(GROUPS.zone, GROUPS.object)).toBe(false);
  });

  it('filterOf sets those memberships in the filter word, with every membership set', () => {
    const f = filterOf('floor', 'object', 'hurtbox');
    expect(filter(f)).toBe(MEMBERS.floor | MEMBERS.object | MEMBERS.hurtbox);
    expect(member(f)).toBe(0xffff);
    expect(() => filterOf('lasers')).toThrow(/no group/);
  });

  it('every name has a unique membership bit', () => {
    const bits = Object.values(MEMBERS);
    expect(new Set(bits).size).toBe(bits.length);
    for (const b of bits) expect(b & (b - 1)).toBe(0);
    expect(Object.keys(GROUPS)).toEqual(['floor', 'object', 'bumper', 'character', 'hurtbox', 'zone', 'projectile', 'sight', 'barrier']);
  });
});

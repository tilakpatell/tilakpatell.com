import { describe, expect, it } from 'vitest';
import { STANCE_KEYS, STANCE_SET, stanceClips, stanceFor, weaponClassOf } from './stance';

describe('the stances by weapon', () => {
  it('names each class’s set under stance.<key>.<name>', () => {
    for (const k of STANCE_KEYS) {
      const set = STANCE_SET(k);
      for (const n of ['idle', 'walk', 'run', 'sprint', 'walk.back', 'walk.left', 'walk.right', 'turn.left', 'turn.right', 'crouch.run']) expect(set[`stance.${k}.${n}`], `${k} ${n}`).toBeTruthy();
    }
    expect(STANCE_SET('p')['stance.p.walk']).toContain('C_HM_Pistol_Walk_Fwd');
    expect(STANCE_SET('t')['stance.t.walk']).toContain('C_HM_Rifle_Walk_Fwd_01');
    expect(STANCE_SET('l')['stance.l.walk']).toContain('C_HM_Lmg_Walk_Fwd_01');
  });
  it('tells the stance from the weapon’s class, the humanoid set for anything else', () => {
    expect(stanceFor('pistol')).toBe('p');
    expect(stanceFor('rifle')).toBe('t');
    expect(stanceFor('bowcaster')).toBe('t');
    expect(stanceFor('long')).toBe('t');
    expect(stanceFor('heavy')).toBe('l');
    // (Review Focus 1: a weapon with no stance set, or none at all)
    expect(stanceFor('saber')).toBe('humanoid');
    expect(stanceFor(undefined)).toBe('humanoid');
    expect(stanceFor('meshyblaster')).toBe('humanoid');
  });
  it('gives the site’s guns their classes', () => {
    expect(weaponClassOf('blaster')).toBe('pistol');
    expect(weaponClassOf('e11')).toBe('rifle');
    expect(weaponClassOf('dlt19')).toBe('heavy');
    expect(weaponClassOf('saber')).toBe(null);
  });
  it('lays a stance’s clips over the base names, leaving the rest', () => {
    const clips = new Map([
      ['idle', 'humanoid idle'],
      ['walk', 'humanoid walk'],
      ['die', 'humanoid die'],
      ['stance.p.idle', 'pistol idle'],
      ['stance.p.walk', 'pistol walk'],
      ['stance.t.walk', 'rifle walk'],
    ]);
    expect(stanceClips(clips, 'p')).toEqual({ idle: 'pistol idle', walk: 'pistol walk' });
    expect(stanceClips(clips, 'humanoid')).toEqual({});
  });
});

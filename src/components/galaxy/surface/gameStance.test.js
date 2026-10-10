import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { strokeTable } from '../../../data/bf2017/strokes';
import { STANCE_IDS } from './combatRules';
import { stanceFor, strokeFor } from './gameStance';

describe('a stance for a hero on the game’s rig', () => {
  it('is the game’s for a walrus hero with a table; nothing off the game’s rig (nothing else fences)', () => {
    expect(stanceFor('single', { rig: 'walrus', pack: 'luke' }).strokes[0].clip).toBe('A_Luke_AttackLoop_Strike1');
    expect(stanceFor('single', { rig: 'walrus', pack: 'luke' })).toBe(stanceFor('single', { rig: 'walrus', pack: 'luke' }));
    expect(stanceFor('single', { pack: 'luke' })).toBe(null);
    expect(stanceFor('nope')).toBe(null);
    expect(STANCE_IDS).toEqual(['single', 'double']);
    expect(strokeTable('luke').hero).toBe('luke');
    expect(strokeTable('han')).toBe(null);
  });

  it('stands Luke’s strokes in for a figure on the rig whose set has no strikes (the Emperor’s, a clone’s)', () => {
    expect(stanceFor('single', { rig: 'walrus', pack: 'palpatine' }).strokes[0].clip).toBe('A_Luke_AttackLoop_Strike1');
    expect(stanceFor('double', { rig: 'walrus', pack: null }).game).toBe('luke');
    expect(stanceFor('double', { rig: 'walrus', pack: 'maul' }).name).toBe('Double blade');
  });

  it('chains the strikes within the rulebook’s combo window, and a heavy one is the jump or the dash', () => {
    const st = stanceFor('single', { rig: 'walrus', pack: 'luke' });
    const a = strokeFor(st);
    const b = strokeFor(st, { last: { ...a, endedAt: 1 }, now: 1.2 });
    expect(b.clip).toBe('A_Luke_AttackLoop_Strike2');
    expect(strokeFor(st, { last: { ...a, endedAt: 1 }, now: 3 }).clip).toBe('A_Luke_AttackLoop_Strike1');
    expect(strokeFor(st, { heavy: true }).clip).toBe('A_Luke_Jump_SaberAttack_Light_FH_01');
  });

  // (the universe's online protocol imports combatRules.js for STANCE_IDS:
  // with the tables behind it, every flight page carried them, and a turret
  // took half a second longer to reach the other pilot, past the multiplayer check's 3 s)
  it('leaves combatRules.js without the tables, so the pages that only need its names don’t load them', () => {
    const src = readFileSync(new URL('./combatRules.js', import.meta.url), 'utf8');
    expect(src).not.toMatch(/^import /m);
  });
});

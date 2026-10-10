import { describe, expect, it } from 'vitest';
import luke from '../../../data/bf2017/strokes/luke.json';
import palpatine from '../../../data/bf2017/strokes/palpatine.json';
import { duelFor } from './duellists';
import { strokeFor } from './gameStance';
import { WAYS, stanceFromTable } from './stanceFromTable';

const of = (table) => stanceFromTable(table);

describe('a 2017 hero’s stance, from its stroke table', () => {
  const st = of(luke);

  it('has a name and its strokes, each a clip at its speed (what lands is the engine’s, not the stance’s)', () => {
    expect(st.name).toBe('One blade');
    for (const s of st.strokes) {
      expect(typeof s.clip).toBe('string');
      expect(s.speed).toBeGreaterThan(0);
      expect(s).not.toHaveProperty('damage');
    }
  });

  it('chains the game’s six strikes in its order, each with its measured window and its return', () => {
    expect(st.strokes.map((s) => s.clip)).toEqual([1, 2, 3, 4, 5, 6].map((i) => `A_Luke_AttackLoop_Strike${i}`));
    const one = luke.strikes.find((s) => s.name === 'A_Luke_AttackLoop_Strike1');
    expect(st.strokes[0].contact).toEqual(one.contact);
    expect(st.strokes[0].back).toBe('A_Luke_AttackLoop_Strike1_BackToIdle');
    // (a return is never a strike)
    expect(st.strokes.some((s) => /BackToIdle/.test(s.clip))).toBe(false);
  });

  it('makes its heavies of the jump attack and the dash, and names its blocks', () => {
    expect(st.heavies.map((h) => h.clip)).toEqual(['A_Luke_Jump_SaberAttack_Light_FH_01', 'A_Luke_Stand_SaberDash_01']);
    // (each on the side of him it was measured holding the blade on, whatever its name: luke.held)
    for (const side of ['left', 'right']) for (const n of st.blocks[side]) expect(luke.held[n].tip[0] >= 0 ? 'left' : 'right', n).toBe(side);
    expect(st.blocks.left).toContain('A_Luke_Stand_Block_SwingLeft_01');
    expect(st.blocks.left.length).toBeGreaterThan(1); // (the game's several, by variant)
  });

  it('knows the side each of its strokes comes in from, on the root’s axes, not the way for the keys', () => {
    for (const s of [...luke.strikes, luke.dash, luke.jump]) expect(st.cuts[s.name] ?? null, s.name).toBe(s.side);
    // (his second reads 'right' on the hips' frame, which it turns as it cuts, and comes round the front from his left)
    expect(luke.strikes.find((s) => s.name === 'A_Luke_AttackLoop_Strike2')).toMatchObject({ dir: 'right', side: 'left' });
    expect(st.cuts['A_Luke_AttackLoop_Strike2']).toBe('left');
  });

  it('cuts each way with a strike that cuts that way, read from the tip', () => {
    for (const k of WAYS) expect(st.dirs[k].clip).toMatch(/^A_Luke_/);
    expect(luke.strikes.find((s) => s.name === st.dirs.left.clip).dir).toBe('left');
  });

  it('keeps its cadence: each strike’s length and its return’s', () => {
    const s1 = one('A_Luke_AttackLoop_Strike1');
    // (the strike is over when its blade comes to rest: the clip holds the pose on for the chain)
    expect(st.cadence['A_Luke_AttackLoop_Strike1']).toEqual({ dur: s1.settle, back: s1.returnDuration });
    expect(s1.settle).toBeLessThan(s1.duration);
  });

  it('is nothing for a set with no strikes (Palpatine’s): gameStance.js stands Luke’s in', () => {
    expect(of(palpatine)).toBe(null);
  });
});

const one = (name) => luke.strikes.find((s) => s.name === name);

describe('strokeFor on the game’s stance', () => {
  const st = of(luke);

  it('gives the game’s names: the chain, a way, a heavy', () => {
    const a = strokeFor(st);
    expect(a.clip).toBe('A_Luke_AttackLoop_Strike1');
    const b = strokeFor(st, { last: { ...a, endedAt: 1 }, now: 1.2 });
    expect(b.clip).toBe('A_Luke_AttackLoop_Strike2');
    expect(strokeFor(st, { dir: 'left' }).clip).toBe(st.dirs.left.clip);
    const h = strokeFor(st, { heavy: true });
    expect(h).toMatchObject({
      kind: 'heavy',
      heavy: true,
      clip: 'A_Luke_Jump_SaberAttack_Light_FH_01',
    });
    expect(strokeFor(st, { heavy: true, last: { ...h, endedAt: 1 }, now: 1.1 }).clip).toBe('A_Luke_Stand_SaberDash_01');
  });

});

describe('a 2017 duellist', () => {
  const spec = { kind: 'luke', hostile: { blade: { stance: 'single' } } };

  it('fences with the game’s strikes at the game’s cadence', () => {
    const d = duelFor(spec, 1, { rig: 'walrus', pack: 'luke' });
    expect(d.strokes[0]).toBe('A_Luke_AttackLoop_Strike1');
    expect(d.cadence['A_Luke_AttackLoop_Strike1'].back).toBe(one('A_Luke_AttackLoop_Strike1').returnDuration);
  });

  it('has no strokes of the game’s for a figure on another rig (it doesn’t fence: activity.js gives it no saber)', () => {
    const d = duelFor(spec, 1, null);
    expect(d.cadence).toBe(null);
  });

  it('is the game’s for the spawn’s own kind when its crew row is the game’s figure', () => {
    expect(duelFor(spec, 1).strokes[0]).toBe('A_Luke_AttackLoop_Strike1');
  });
});

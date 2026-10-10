import { NodeIO } from '@gltf-transform/core';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { WAYS } from '../../src/components/galaxy/surface/stanceFromTable.js';
import { BLOCK_AT } from '../../src/components/galaxy/surface/saberRules.js';
import { GENERIC, HELD, classify, clipOf, emitterOf, measure, rigOf, rodOf, sourceName, strokeSide, tableFor } from './bf2017-strokes.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
// (the fixtures: Luke's first and second strikes and Obi-Wan's fourth, and two blocks, Obi-Wan's SwingLeft_03 and
// Luke's SwingRight_01 (the cinematics' skeleton's), the socket's chain only: Reference → … → Spine2 → Wep_Root)

describe('a pack clip’s source', () => {
  // (today's packs hold the bare game name; the first ones the credit's spelling)
  it('reads the game’s name in either spelling', () => {
    expect(sourceName('A_Luke_AttackLoop_Strike1')).toBe('A_Luke_AttackLoop_Strike1');
    expect(sourceName('Star Wars Battlefront II (2017): A_Luke_AttackLoop_Strike1')).toBe('A_Luke_AttackLoop_Strike1');
    expect(sourceName(undefined)).toBe(null);
  });
});

describe('a 2017 clip’s name', () => {
  it.each([
    ['A_Luke_AttackLoop_Strike3_V2_BackToIdle', { hero: 'luke', kind: 'return', index: 3, variant: 2 }],
    ['A_Luke_AttackLoop_Strike4_V2_BackToIdle 1', { hero: 'luke', kind: 'return', index: 4, variant: 2 }],
    ['A_Dooku_AttackLoop_Strike2_BackToIdle_02', { hero: 'dooku', kind: 'return', index: 2, variant: 1 }],
    ['A_Luke_AttackLoop_Strike6', { hero: 'luke', kind: 'strike', index: 6, variant: 1 }],
    ['A_Vader_AttackLoop_Strike1_V2', { hero: 'vader', kind: 'strike', index: 1, variant: 2 }],
    ['A_Vader_Stand_Block_SwingLeft_03', { hero: 'vader', kind: 'block', dir: 'left', variant: 3 }],
    ['A_Luke_Block_Stagger_01', { hero: 'luke', kind: 'block', variant: 1 }],
    ['A_Vader_LightAttack_Blocked_05', { hero: 'vader', kind: 'blocked', index: 5 }],
    // (Grievous spells a take after the strike and a side in the reaction)
    ['A_Grievous_AttackLoop_Strike3_01', { hero: 'grievous', kind: 'strike', index: 3, variant: 1 }],
    ['A_Grievous_Stand_LightAttack_Blocked_Right_02', { hero: 'grievous', kind: 'blocked', index: 2 }],
    ['A_Luke_Stagger_Front_02', { hero: 'luke', kind: 'stagger', dir: 'front', variant: 2 }],
    ['A_Vader_Stagger_Fwd_01', { hero: 'vader', kind: 'stagger', dir: 'back' }],
    ['A_ObiWan_Dodge_Left_01', { hero: 'obiwan', kind: 'dodge', dir: 'left' }],
    ['A_Luke_Stand_SaberDash_01', { hero: 'luke', kind: 'dash' }],
    ['A_Luke_Jump_SaberAttack_Light_FH_01', { hero: 'luke', kind: 'jump' }],
    ['A_Vader_Stand_Block_Choke_01', { hero: 'vader', kind: 'force' }],
    ['A_Luke_Defeated_01', { hero: 'luke', kind: 'defeat' }],
    ['C_Luke_Stand_Walk_Fwd_01', { hero: 'luke', kind: 'locomotion' }],
  ])('%s', (name, want) => {
    expect(classify(name)).toMatchObject(want);
  });
});

const read = async (file, skel = 'walrus_humanmale') => {
  const d = await new NodeIO().readBinary(new Uint8Array(readFileSync(join(HERE, '..', 'fixtures', 'bf2017', 'web', 'anims', skel, file))));
  return measure(clipOf(d.getRoot().listAnimations()[0]), rigOf(d));
};
const luke = await read('a_luke_attackloop_strike1.glb');
const luke2 = await read('a_luke_attackloop_strike2.glb');
const obiwan = await read('a_obiwan_attackloop_strike4.glb');
const obiBlock = await read('a_obiwan_stand_block_swingleft_03.glb');
const lukeBlock = await read('a_luke_stand_block_swingright_01.glb', 'walrus_nis_s0800_skeleton');

describe('a strike, measured on the game’s rig', () => {
  const m = luke;

  // (checked by hand once, ual-bake's widening and all: the tip a metre up
  // the socket's +y counts before the hips from 0.1 s to 0.233 s (15, 24,
  // 24, 36, 47 m/s with the root's travel), fastest at 0.233; back to 0.2 s
  // while within 0.6 of that, one frame back for the speed's start (0.167),
  // and 0.06 s either side: [0.107, 0.293]. The snap out of the guard in the
  // first key, 49 m/s at 0.033 s, must not count: ual-bake's own rule counts
  // it, [0.05, 0.093])
  it('lands where the blade crosses the front, not on the snap out of the guard', () => {
    expect(m.contact).toEqual([0.107, 0.293]);
  });

  // (Obi-Wan's fourth drives forward with the lunge, the hips ahead of the
  // tip until 0.367 s, the end of the drive; the first key's snap, 35 m/s,
  // is again the fastest thing in the clip and again doesn't count)
  it('times a strike that turns and drives the body the same way', () => {
    expect(obiwan.contact).toEqual([0.274, 0.426]);
  });

  it('says when the blade comes to rest, long before the clip ends', () => {
    expect(m.settle).toBe(0.533);
    expect(obiwan.settle).toBeGreaterThan(obiwan.contact[1]);
    expect(obiwan.settle).toBeLessThan(obiwan.duration);
  });

  it('reads the way it cuts and the plane it sweeps from the tip’s path', () => {
    expect(WAYS).toContain(m.dir);
    expect(m.dir).toBe('right');
    expect(Math.abs(m.plane[1])).toBeGreaterThan(0.9); // (a level cut)
  });

  // (measured once, the tip less the hips on the root's axes: Luke's second
  // goes from (0.42, −1.01) in x and z at 0.174 s round the front to
  // (−1.19, 0.29) at 0.36 s, from his left across to his right, while the
  // hips turn from 56° to 96° round under it, so on their frame it reads
  // 'right'; his first comes in from his right on either)
  it('says the side a cut comes in from on the root’s axes, the line the one it meets stands on', () => {
    expect(luke2.side).toBe('left');
    expect(luke2.dir).toBe('right'); // (the way for the keys, on the hips' frame, as it was)
    expect(m.side).toBe('right');
  });

  it('carries the trajectory’s travel as root rows, the way ual-bake writes them', () => {
    expect(m.root[0]).toEqual([0, 0, 0]);
    expect(m.root.at(-1)[2]).toBeCloseTo(2, 1);
    expect(m.duration).toBeGreaterThan(1.5);
  });
});

describe('the side a cut comes in from', () => {
  // (rows as the measure makes them: `rel` the tip less the hips on the root's axes, +x the figure's left)
  const rows = (...at) => at.map((rel, i) => ({ t: i / 10, rel }));

  it('is the side its tip crosses the front from, in its window', () => {
    expect(strokeSide(rows([1, 1, -1], [1.2, 1, 0.5], [0, 1, 1.6], [-1.2, 1, 0.3]), [0.1, 0.3])).toBe('left');
    expect(strokeSide(rows([-1, 1, 0], [0, 1.1, 1], [1, 1.2, 0]), [0, 0.2])).toBe('right');
  });

  it('is none for a cut that goes more up or down than across', () => {
    expect(strokeSide(rows([0.3, 1.9, 0.5], [0.1, 1.2, 1], [-0.2, 0.4, 0.8]), [0, 0.2])).toBe(null);
    expect(strokeSide(rows([0, 0.2, 0.8], [0.3, 1.6, 0.6]), [0, 0.1])).toBe(null);
  });

  // (Vader's second as measured: the window opens over his shoulder, behind,
  // and ends low in front; between, the tip comes round his left and down across)
  it('reads a cut wound up from behind where its tip is before the hips', () => {
    expect(strokeSide(rows([0.58, 1.03, -0.62], [1.53, 0.47, 0.02], [1.21, -0.38, 0.99], [0.05, -0.82, 1.18]), [0, 0.3])).toBe('left');
  });
});

describe('a block, measured on the game’s rig', () => {
  it('reads a block at the frame the site lays it', () => {
    expect(HELD).toBe(BLOCK_AT);
    expect(obiBlock.held.at).toBe(+(obiBlock.duration * HELD).toFixed(3));
    expect(obiBlock.held.at).toBe(0.373);
  });

  // (measured once: Obi-Wan's SwingLeft_03 holds the tip at (−0.789, 0.79,
  // 1.165) from the hips, on his right; Luke's SwingRight_01 at (0.31, 1.495,
  // 0.184), up on his left. The game's heroes stand side-on, the chest turned
  // to the figure's left, so most of its blocks hold the blade there,
  // whatever the name)
  it('holds the blade on the side the measure says, not the name', () => {
    expect(obiBlock.held.tip[0]).toBeLessThan(-0.5);
    expect(lukeBlock.held.tip[0]).toBeGreaterThan(0.2);
    expect(lukeBlock.held.tip[1]).toBeGreaterThan(1);
  });
});

describe('the committed tables', () => {
  const dir = join(HERE, '..', '..', 'src', 'data', 'bf2017', 'strokes');
  const tables = readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')));

  it('time every strike past the first key’s snap, and come to rest after the cut', () => {
    for (const t of tables)
      for (const s of t.strikes) {
        expect(s.contact[1], s.name).toBeGreaterThan(0.15);
        expect(s.settle, s.name).toBeGreaterThanOrEqual(s.contact[1]);
        expect(s.settle, s.name).toBeLessThanOrEqual(s.duration);
      }
  });

  it('block a cut with the blocks measured holding the blade on its side, each swing block on one side', () => {
    const sideOf = (n, t) => (t.held[n].tip[0] >= 0 ? 'left' : 'right');
    for (const t of tables) {
      for (const side of ['left', 'right']) for (const n of t.blocks[side]) expect(sideOf(n, t), `${t.hero} ${n}`).toBe(side);
      // (a swing block sits on the side it was measured on, never on the other: a side with none is the site's block's)
      for (const n of Object.keys(t.held).filter((k) => classify(k).dir)) {
        expect(t.blocks[sideOf(n, t)], `${t.hero} ${n}`).toContain(n);
        expect(t.blocks[sideOf(n, t) === 'left' ? 'right' : 'left'], `${t.hero} ${n}`).not.toContain(n);
      }
    }
  });

  it('say the side each strike, dash and jump comes in from, measured on the root’s axes', () => {
    for (const t of tables)
      for (const s of [...t.strikes, t.dash, t.jump].filter(Boolean)) expect(['left', 'right', null], `${t.hero} ${s.name}`).toContain(s.side);
    const luke = tables.find((t) => t.hero === 'luke');
    expect(luke.strikes.find((s) => s.name === 'A_Luke_AttackLoop_Strike2').side).toBe(luke2.side);
    expect(luke.strikes.find((s) => s.name === 'A_Luke_AttackLoop_Strike1').side).toBe('right');
  });
});

describe('a hero’s table', () => {
  const at = (name, more = {}) => ({
    name,
    duration: 1,
    contact: [0.2, 0.3],
    dir: 'up',
    ...more,
  });
  const clips = [
    at('A_Luke_AttackLoop_Strike2'),
    at('A_Luke_AttackLoop_Strike1'),
    at('A_Luke_AttackLoop_Strike1_BackToIdle', { duration: 0.7 }),
    at('A_Luke_AttackLoop_Strike2_BackToIdle', { duration: 0.6 }),
    at('A_Luke_AttackLoop_Strike1_V2'),
    at('A_Luke_Block_Stagger_01'),
    at('A_Luke_Stagger_Front_01'),
    at('A_Luke_Dodge_Back_01'),
    at('A_Luke_Stand_SaberDash_01'),
    at('A_Luke_Jump_SaberAttack_Light_FH_01'),
    at('A_Vader_AttackLoop_Strike3'),
  ];
  const t = tableFor('luke', clips);

  it('keeps the game’s chain, each strike with its return', () => {
    expect(t.strikes.map((s) => [s.name, s.return])).toEqual([
      ['A_Luke_AttackLoop_Strike1', 'A_Luke_AttackLoop_Strike1_BackToIdle'],
      ['A_Luke_AttackLoop_Strike1_V2', null],
      ['A_Luke_AttackLoop_Strike2', 'A_Luke_AttackLoop_Strike2_BackToIdle'],
    ]);
    expect(t.strikes[0].returnDuration).toBe(0.7);
  });

  it('never lists a return as a strike, nor another hero’s', () => {
    expect(t.strikes.some((s) => /BackToIdle|Vader/.test(s.name))).toBe(false);
  });

  it('leaves a side with no block measured on it empty, its any apart (the site’s block meets a cut there: blockSide.js)', () => {
    expect(t.blocks).toEqual({
      left: [],
      right: [],
      any: 'A_Luke_Block_Stagger_01',
    });
    expect(t.blocked).toHaveLength(6);
  });

  it('sides its blocks by where each was measured holding the blade, not by the name', () => {
    const held = (x) => ({ at: 0.3, tip: [x, 1.2, 0.4] });
    const s = tableFor('luke', [
      at('A_Luke_Stand_Block_SwingRight_02', { held: held(0.4) }),
      at('A_Luke_Stand_Block_SwingRight_01', { held: held(0.5) }),
      at('A_Luke_Stand_Block_SwingLeft_01', { held: held(-0.3) }),
      at('A_Luke_Stand_Block_SwingLeft_02'), // (never measured: on neither side)
      at('A_Luke_Block_Stagger_01', { held: held(0.1) }),
    ]);
    expect(s.blocks.left).toEqual(['A_Luke_Stand_Block_SwingRight_01', 'A_Luke_Stand_Block_SwingRight_02']);
    expect(s.blocks.right).toEqual(['A_Luke_Stand_Block_SwingLeft_01']);
    expect(s.blocks.any).toBe('A_Luke_Block_Stagger_01');
    expect(s.held['A_Luke_Stand_Block_SwingLeft_01']).toEqual(held(-0.3));
    expect(Object.keys(s.held)).not.toContain('A_Luke_Stand_Block_SwingLeft_02');
    // (a side with none of its own is left empty, never padded with the stagger)
    const one = tableFor('luke', [at('A_Luke_Stand_Block_SwingLeft_01', { held: held(0.2) }), at('A_Luke_Block_Stagger_01')]);
    expect(one.blocks.right).toEqual([]);
  });

  it('fills what the set lacks from the game’s generic humanoid, never another library', () => {
    expect(t.dodges.back).toBe('A_Luke_Dodge_Back_01');
    expect(t.dodges.left).toBe(GENERIC.dodges.left);
    expect(t.staggers.back).toEqual(GENERIC.staggers.back);
    expect(t.defeat).toBe(GENERIC.defeat);
    const names = JSON.stringify(t).match(/"[A-Za-z]+_[A-Za-z0-9_ ]+"/g) ?? [];
    expect(names.length).toBeGreaterThan(10);
    expect(JSON.stringify(t)).not.toMatch(/sword\.|"Sword_/);
  });

  it('names the dash and the jump attack', () => {
    expect(t.dash.name).toBe('A_Luke_Stand_SaberDash_01');
    expect(t.jump.contact).toEqual([0.2, 0.3]);
  });

  it('keeps the side each stroke comes in from apart from the way it cuts', () => {
    const s = tableFor('luke', [
      at('A_Luke_AttackLoop_Strike2', { dir: 'right', side: 'left' }),
      at('A_Luke_Stand_SaberDash_01', { side: 'right' }),
      at('A_Luke_Jump_SaberAttack_Light_FH_01'),
    ]);
    expect(s.strikes[0]).toMatchObject({ dir: 'right', side: 'left' });
    expect(s.dash).toMatchObject({ dir: 'up', side: 'right' });
    expect(s.jump.side).toBe(null);
  });
});

describe('the blade out of a hilt', () => {
  // a hilt 0.28 m along +y about its grip, a 0.01 m-wide emitter ring on its axis at the top, and a prong off the axis higher still
  const ring = (y, r, cx = 0) => Array.from({ length: 12 }, (_, i) => [cx + Math.cos(i) * r, y, Math.sin(i) * r]);
  const hilt = [...ring(-0.21, 0.02), ...ring(0, 0.022), ...ring(0.07, 0.012), [0, 0.12, 0.09]];

  it('comes out of the emitter on the hilt’s axis, not a prong beside it', () => {
    const e = emitterOf(hilt);
    expect(e.top[1]).toBeCloseTo(0.07, 3);
    expect(Math.hypot(e.top[0], e.top[2])).toBeLessThan(1e-3);
    expect(e.bottom[1]).toBeCloseTo(-0.21, 3);
  });

  it('takes the rod’s width and where it starts', () => {
    const rod = [...ring(0.068, 0.011), ...ring(0.081, 0.011)];
    expect(rodOf(rod)).toEqual({ radius: 0.011, from: 0.068 });
  });
});

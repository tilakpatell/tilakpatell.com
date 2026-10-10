import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import luke from '../../../data/bf2017/strokes/luke.json';
import { BLOCK_CLIP, SIDE_ON, blockClipFor, cutOf, incomingSide } from './blockSide';
import { stanceFromTable } from './stanceFromTable';

describe('the way a stroke cuts', () => {
  const st = stanceFromTable(luke);

  it('cuts a 2017 hero’s stroke from the side the game’s tip was measured coming in from, on the root’s axes', () => {
    for (const s of luke.strikes) expect(cutOf(st, s.name), s.name).toBe(s.side);
    expect(cutOf(st, luke.jump.name)).toBe(luke.jump.side);
    expect(cutOf(st, luke.dash.name)).toBe(luke.dash.side);
  });

  // (the second of every chain of his: read on the hips' frame it came in on
  // your left, and you blocked there; its tip comes round from his left)
  it('brings Luke’s second strike in on your right as he faces you', () => {
    expect(incomingSide(cutOf(st, 'A_Luke_AttackLoop_Strike2'), { from: Math.PI, to: 0 })).toBe('right');
  });

  it('gives no side for a stroke it doesn’t know, nor for none', () => {
    expect(cutOf(st, 'sword.light.a')).toBe(null);
    expect(cutOf(st, null)).toBe(null);
    expect(cutOf(null, 'A_Luke_AttackLoop_Strike1')).toBe(null);
  });
});

describe('the side a cut comes in on', () => {
  it('mirrors a side cut for the one it faces', () => {
    expect(incomingSide('right')).toBe('left');
    expect(incomingSide('left')).toBe('right');
    for (const cut of ['up', 'rise', null]) expect(incomingSide(cut)).toBe(null);
  });

  // (as the site stands them: a holder turned rotation.y = yaw, its +x its
  // left and +z the way it faces. A cut from the striker's `way` side comes
  // in from a metre out that side of the line it cuts across; the struck
  // sees that start in its own frame)
  it('sees the side from where the two stand', () => {
    const striker = new THREE.Object3D();
    const struck = new THREE.Object3D();
    let n = 0;
    for (let from = -Math.PI; from < Math.PI; from += 0.1)
      for (let to = -Math.PI; to < Math.PI; to += 0.1) {
        striker.rotation.y = from;
        struck.rotation.y = to;
        striker.updateMatrixWorld(true);
        struck.updateMatrixWorld(true);
        for (const [cut, x] of [
          ['left', 1],
          ['right', -1],
        ]) {
          const start = striker.localToWorld(new THREE.Vector3(x, 1.2, 0.8));
          const mid = striker.localToWorld(new THREE.Vector3(0, 1.2, 0.8));
          const seen = struck.worldToLocal(start.clone()).x - struck.worldToLocal(mid.clone()).x;
          const want = Math.abs(Math.cos(from - to)) < SIDE_ON ? null : seen > 0 ? 'left' : 'right';
          expect(incomingSide(cut, { from, to }), `${cut} ${from.toFixed(1)} ${to.toFixed(1)}`).toBe(want);
          n++;
        }
      }
    expect(n).toBeGreaterThan(7000);
    // (from behind it keeps its side; side-on it has none)
    expect(incomingSide('right', { from: 0, to: 0 })).toBe('right');
    expect(incomingSide('right', { from: 0, to: Math.PI / 2 })).toBe(null);
  });
});

describe('the block for a side', () => {
  const blocks = { left: ['a', 'b', 'c'], right: ['d'], any: 'e' };
  const has = (n) => n !== 'b';

  it('takes the side’s own blocks it has, one a raise in turn', () => {
    expect([0, 1, 2].map((n) => blockClipFor(blocks, 'left', has, n))).toEqual(['a', 'c', 'a']);
    expect(blockClipFor(blocks, 'right', has)).toBe('d');
  });

  // (a table's any is mostly the parry's stagger, held low: Obi-Wan's,
  // Anakin's, Maul's and Dooku's packs carry it as their sword.blocked)
  it('leaves a cut with no side, or none of its own, to the site’s one block (null: saber.js), its any only for a figure without that', () => {
    const site = (n) => n === 'e' || n === BLOCK_CLIP;
    expect(blockClipFor(blocks, null, has)).toBe(null);
    expect(blockClipFor(blocks, null, site)).toBe(null);
    expect(blockClipFor({ ...blocks, right: [] }, 'right', has)).toBe(null);
    expect(blockClipFor(blocks, 'right', site)).toBe(null);
    expect(blockClipFor(blocks, 'right', (n) => n === 'e')).toBe('e');
    expect(blockClipFor(blocks, null, (n) => n === 'e')).toBe('e');
    expect(blockClipFor(blocks, 'left', () => false)).toBe(null);
    expect(blockClipFor(undefined, 'left', () => true)).toBe(null);
  });
});

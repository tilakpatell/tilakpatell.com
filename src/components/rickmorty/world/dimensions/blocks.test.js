import { describe, expect, it } from 'vitest';
import { BLOCKS, MORTY_R, blockProblems, blocksOf } from './blocks';
import { MORTY } from '../rules';
import { E, N, place } from './place';
import { DESTINATIONS } from './destinations';

// a place to try blocks on: row 0's spot, a person who stands, one who
// wanders, and a spot to use
const fixture = () =>
  place(0, {
    id: 'trial',
    name: 'A trial',
    kind: 'outdoor',
    deep: 50,
    wide: 70,
    people: [
      { id: 'stander', dx: -10, dz: -10, face: E },
      { id: 'walker', dx: 10, dz: 0, face: N, ai: { wander: [[10, 0], [20, 0], [20, -10]] } },
    ],
    spots: [{ id: 'thing', dx: 0, dz: -15, label: 'A thing', verb: 'Look', r: 1.6 }],
  });
const at = (d, dx, dz, w = 2, dd = 2, h = 1) => ({ id: `b-${dx}-${dz}`, x: d.centre.x + dx, z: d.centre.z + dz, w, d: dd, h });

describe('a place’s blocks', () => {
  it('stand where their row says, in the world', () => {
    const d = { id: 'customs', centre: { x: -400, z: 900 } };
    const out = blocksOf(d, [{ id: 'queue', dx: -4, dz: 2, w: 3, d: 1, h: 1 }]);
    expect(out).toEqual([{ id: 'customs-queue', x: -404, z: 902, w: 3, d: 1, h: 1, block: true }]);
  });

  it('are clear when nothing is near', () => {
    const d = fixture();
    expect(blockProblems(d, [at(d, -25, 5)])).toEqual([]);
  });

  it('may be no taller than 1.2 m, and must be inside the box', () => {
    const d = fixture();
    expect(blockProblems(d, [at(d, -25, 5, 2, 2, 1.4)])).toEqual([expect.stringMatching(/taller/)]);
    expect(blockProblems(d, [at(d, 34.5, 0)])).toEqual([expect.stringMatching(/outside/)]);
  });

  it('keep clear of a spot by its reach, Morty’s radius and half a metre (the check’s warp spots stand off it)', () => {
    const d = fixture();
    // the spot's r 1.6 + 0.4 + 0.5 = 2.5 from its centre to the block's nearest edge
    expect(blockProblems(d, [at(d, 0, -15 + 3.4)])).toEqual([expect.stringMatching(/thing/)]);
    expect(blockProblems(d, [at(d, 0, -15 + 3.6)])).toEqual([]);
  });

  it('keep 1.5 m from the way in and the portal home', () => {
    const d = fixture();
    const inZ = d.arrive.z - d.centre.z;
    expect(blockProblems(d, [at(d, 2, inZ)])).toEqual([expect.stringMatching(/way in/)]);
    const homeZ = d.back.z - d.centre.z;
    expect(blockProblems(d, [at(d, -2.2, homeZ)])).toEqual([expect.stringMatching(/portal/)]);
  });

  it('keep a metre from where anyone stands or walks', () => {
    const d = fixture();
    expect(blockProblems(d, [at(d, -10, -8.5)])).toEqual([expect.stringMatching(/stander/)]);
    // (on the walker's route back from (20, -10) to (10, 0))
    expect(blockProblems(d, [at(d, 15, -5, 1, 1)])).toEqual([expect.stringMatching(/walker/)]);
  });

  it('take Morty’s radius from the rules', () => {
    expect(MORTY_R).toBe(MORTY.radius);
  });

  it('are clear of everything in every real place', () => {
    for (const d of DESTINATIONS) expect(blockProblems(d, blocksOf(d, BLOCKS[d.id] ?? [])), d.id).toEqual([]);
  });
});

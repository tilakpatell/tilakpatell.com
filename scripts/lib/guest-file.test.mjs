// The guests' files as they are read: a Meshy figure at its bind in metres,
// a body on the game's rig in its Reference node's frame, a clip pack with
// its numbers as the file has them. On committed files.
import { describe, expect, it } from 'vitest';
import { readBody, readGuest, readPack } from './guest-file.mjs';

const span = (positions) => {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 1; i < positions.length; i += 3) {
    lo = Math.min(lo, positions[i]);
    hi = Math.max(hi, positions[i]);
  }
  return [lo, hi];
};

describe('a Meshy figure, read', () => {
  it('comes at its bind in metres: Rick’s soles on the ground, his hair’s tips at 1.8', async () => {
    const guest = await readGuest('public/games/meshy/rick.glb');
    const [lo, hi] = span(guest.surface.positions);
    expect(lo).toBeCloseTo(0, 3);
    expect(hi).toBeCloseTo(1.8, 3);
    // (the file's own nodes are centimetres under a root scaled a hundredth)
    expect(guest.rows[0].scale).toEqual([0.01, 0.01, 0.01]);
  });

  it('gives the skin’s joints in the skin’s order, each with its parent among them, and every vertex’s weights summing to one', async () => {
    const { joints, surface, prims } = await readGuest('public/games/meshy/morty.glb');
    expect(joints.length).toBe(24);
    expect(joints[0]).toEqual({ name: 'Hips', parent: null });
    expect(joints.find((j) => j.name === 'head_end').parent).toBe('Head');
    expect(surface.joints).toEqual(joints.map((j) => j.name));
    const count = surface.positions.length / 3;
    expect(prims.reduce((n, p) => n + p.count, 0)).toBe(count);
    expect(surface.normals.length).toBe(count * 3);
    for (let v = 0; v < count; v += 97) {
      const sum = surface.skinWeight[v * 4] + surface.skinWeight[v * 4 + 1] + surface.skinWeight[v * 4 + 2] + surface.skinWeight[v * 4 + 3];
      expect(sum).toBeCloseTo(1, 5);
      for (let k = 0; k < 4; k++) expect(surface.skinIndex[v * 4 + k]).toBeLessThan(24);
    }
  });
});

describe('a body on the game’s rig, read', () => {
  it('comes out from under the `ground` an import hangs it on: the game’s trooper in his own skeleton’s metres', async () => {
    const man = await readBody('public/models/galaxy/bf2017/crew/stormtrooper.lod1.glb');
    expect(man.rows[0]).toEqual({ name: 'Reference', parent: null, translation: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] });
    expect(man.rows.some((r) => r.name === 'ground')).toBe(false);
    for (const n of ['Hips', 'Wep_Root', 'LeftToeBase', 'RightHandMiddle4']) expect(man.rows.some((r) => r.name === n), n).toBe(true);
    // (his soles within a centimetre of his skeleton's ground, his helmet's top about 1.8 m over it)
    const [lo, hi] = span(man.surface.positions);
    expect(Math.abs(lo)).toBeLessThan(0.01);
    expect(hi).toBeGreaterThan(1.7);
    expect(hi).toBeLessThan(1.9);
    expect(man.surface.joints).toContain('Head');
  });

  it('reads a fitted guest the same way: 256 nodes from Reference, the mesh as it stands', async () => {
    const morty = await readBody('public/models/guests/morty.glb');
    expect(morty.rows.length).toBe(256);
    expect(morty.rows[0].name).toBe('Reference');
    const [lo, hi] = span(morty.surface.positions);
    expect(Math.abs(lo)).toBeLessThan(0.005);
    expect(hi).toBeCloseTo(1.5, 2);
  });

  it('refuses a file that is not on the game’s skeleton', async () => {
    await expect(readBody('public/games/meshy/rick.glb')).rejects.toThrow(/Reference/);
  });
});

describe('a clip pack, read', () => {
  it('gives each clip’s tracks with their numbers as the file has them: a turn’s as normalized shorts', async () => {
    const pack = await readPack('public/models/galaxy/bf2017/clips-humanoid.glb');
    expect(pack.pack).toBe('humanoid');
    expect(pack.aliases).toEqual({ 'die.fwd': 'die' });
    expect(pack.rows.length).toBe(254);
    expect(pack.clips.length).toBe(31);
    const walk = pack.clips.find((c) => c.name === 'walk');
    expect(walk.extras.source).toBe('C_HM_Rifle_Walk_Fwd_01');
    const turn = walk.tracks.find((t) => t.node === 'Hips' && t.path === 'rotation');
    expect(turn.values.constructor).toBe(Int16Array);
    expect(turn.normalized).toBe(true);
    expect(turn.values.length).toBe(turn.times.length * 4);
    const place = walk.tracks.find((t) => t.node === 'Hips' && t.path === 'translation');
    expect(place.values.constructor).toBe(Float32Array);
    expect(place.normalized).toBe(false);
  });
});

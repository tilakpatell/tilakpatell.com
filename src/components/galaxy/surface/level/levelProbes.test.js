import { describe, expect, it } from 'vitest';
import { createLevelProbes, facesOf, probeAt } from './levelProbes';

const box = (id, centre, size) => ({ id, centre, axes: [[size, 0, 0], [0, size, 0], [0, 0, size]], faces: `probes/${id}` });

describe('the level’s probes', () => {
  const hangar = box('hangar', [0, 0, 0], 100);
  const room = box('room', [10, 0, 10], 8);
  const far = box('far', [400, 0, 0], 50);

  it('takes the smallest box that holds you, else the nearest within reach, else none', () => {
    expect(probeAt([hangar, room, far], [11, 1, 9]).id).toBe('room');
    expect(probeAt([hangar, room, far], [30, 0, 0]).id).toBe('hangar');
    expect(probeAt([hangar, room, far], [300, 0, 0]).id).toBe('far');
    expect(probeAt([far], [0, 0, 0])).toBe(null);
  });

  it('says a new probe once, with the faces’ stem in the world’s pack', () => {
    const seen = [];
    const p = createLevelProbes({ world: 'hoth', list: [hangar, room], onProbe: (x) => seen.push(x) });
    p.update([30, 0, 0]);
    p.update([31, 0, 0]);
    p.update([10, 0, 10]);
    expect(seen.map((x) => x.id)).toEqual(['hangar', 'room']);
    expect(seen[0].url).toBe('models/galaxy/bf2017/levels/hoth/probes/hangar');
  });
});

describe('the probe’s faces by tier (lane D2)', () => {
  const box = { id: 'a', centre: [0, 0, 0], axes: [[10, 0, 0], [0, 10, 0], [0, 0, 10]], faces: 'probes/a', ultra: 'probes/a.ultra' };
  it('ultra takes the 128² faces with the sun where the pack has them; every other tier the 64²', () => {
    expect(facesOf(box, 'ultra')).toBe('probes/a.ultra');
    expect(facesOf(box, 'high')).toBe('probes/a');
    expect(facesOf({ ...box, ultra: undefined }, 'ultra')).toBe('probes/a');
  });
  it('names the stem in the url it hands on', () => {
    const seen = [];
    createLevelProbes({ world: 'hoth', list: [box], tier: 'ultra', onProbe: (p) => seen.push(p.url) }).update([0, 0, 0]);
    expect(seen).toEqual(['models/galaxy/bf2017/levels/hoth/probes/a.ultra']);
  });
});

import { describe, expect, it } from 'vitest';
import { instancesOf, readmeSection } from './bf2017-level-mode.mjs';

const t = (x) => [1, 0, 0, 0, 1, 0, 0, 0, 1, x, 0, 0];
const manifest = {
  level: 'Levels/MP/Test/Test',
  subworlds: ['Levels/MP/Test/Test', 'Levels/MP/Test/FantasyBattle'],
  meshes: [{ file: 'models/a_mesh.glb' }, { file: 'models/fx/meshes/lighting/cone_mesh.glb' }, { file: 'models/droid_mesh.glb' }],
  groups: [
    { mesh: 0, sub: 0, kind: 'static', count: 1, t: t(1) },
    { mesh: 0, sub: 1, kind: 'object', count: 2, t: [...t(2), ...t(3)] },
    { mesh: 1, sub: 1, kind: 'static', count: 1, t: t(4) },
    { mesh: 2, sub: 1, kind: 'actor', count: 1, t: t(5) },
  ],
};

describe('the mode part’s instances from the map’s manifest', () => {
  it('takes the sub-level’s, as the pack builder keeps them (no lighting proxy, no moving actor)', () => {
    const out = instancesOf(manifest, 'Levels/MP/Test/FantasyBattle');
    expect(out.map((i) => [i.mesh, i.world.t[0], i.i])).toEqual([
      ['models/a_mesh.glb', 2, 1],
      ['models/a_mesh.glb', 3, 2],
    ]);
    expect(() => instancesOf(manifest, 'Levels/MP/Test/Nope')).toThrow(/not a sub-level/);
  });

  it('says in the README what the mode is made of', () => {
    const md = readmeSection({ controller: { curve: 'Sine', mode: 'EaseOut' }, doors: [{ leaves: [1, 2] }], gates: [], props: [{ kind: 'wreck', parts: [{ instances: [1] }] }], boxes: [{ layer: 'character' }, { layer: 'static' }], unmatched: [] }, 'node x');
    expect(md).toContain('| doors | 1 (2 leaves) |');
    expect(md).toContain('| wreck | 1 | shown once its vehicle is destroyed');
    expect(md).toContain('| walls | 2 (1 soldiers only) |');
  });
});

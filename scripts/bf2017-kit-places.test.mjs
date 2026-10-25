import { describe, expect, it } from 'vitest';
import { kitOf, packOf } from './bf2017-kit-places.mjs';

describe('bf2017-kit-places', () => {
  it('names a space map’s level pack', () => {
    expect(packOf('levels/space/sb_endor_01/sb_endor_01')).toBe('sb_endor');
    expect(packOf('levels/space/sb_droidbattleship_01/sb_droidbattleship_01')).toBe('sb_droidbattleship');
  });

  it('writes each part round the anchor with its pack mesh and LODs and the kit’s map rows, and names a part the pack hasn’t got', () => {
    const at = (x = 0) => ({ at: [x, 2, 3], quaternion: [0, 0, 0, 1], scale: [1, 1, 1] });
    const model = { parts: [{ file: 'x/stardestroyer_hull_01_sb_endor_mesh.glb', ...at() }, { file: 'x/stardestroyer_tower_mesh.glb', ...at(1.23456) }, { file: 'x/gone_mesh.glb', ...at() }] };
    const level = {
      meshes: [{ name: 'models/x/stardestroyer_tower_mesh.glb', glb: ['meshes/a.lod0.glb', 'meshes/a.lod1.glb', null] }],
      tex: { t_stardestroyer_tower_cs: { low: 512, mid: 1024, high: 1024, ultra: 2048, srgb: true }, t_other_cs: { low: 512 } },
    };
    const { kit, missing } = kitOf(model, level, { pack: 'sb_endor', from: 'endor-isd' });
    expect(kit.anchor).toBe('stardestroyer_hull_01_sb_endor_mesh');
    expect(kit.parts).toEqual([['stardestroyer_tower_mesh', [1.235, 2, 3], [0, 0, 0, 1], [1, 1, 1]]]);
    expect(kit.lods).toEqual({ stardestroyer_tower_mesh: 2 });
    expect(kit.tex).toEqual({ t_stardestroyer_tower_cs: { low: 512, mid: 1024, high: 1024, ultra: 2048 } });
    expect(missing).toEqual(['gone_mesh']);
  });
});

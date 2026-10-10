import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { checkLedger, readConsumers, resolveLevels, walkListing } from './bf2017-coverage.mjs';
import { normalise } from './lib/bf2017-coverage.mjs';

describe('walkListing', () => {
  it('keeps going past a full page and walks into folders', async () => {
    const asked = [];
    const list = async (prefix, offset) => {
      asked.push([prefix, offset]);
      if (prefix === 'web/x') {
        const all = [...Array.from({ length: 1001 }, (_, i) => ({ name: `f${String(i).padStart(4, '0')}.glb`, id: `i${i}` })), { name: 'sub', id: null }];
        return all.slice(offset, offset + 1000);
      }
      if (prefix === 'web/x/sub') return offset ? [] : [{ name: 'deep.glb', id: 'd' }];
      return [];
    };
    const paths = await walkListing(list, 'web/x');
    expect(paths).toHaveLength(1002);
    expect(new Set(paths).size).toBe(1002);
    expect(paths).toContain('web/x/f1000.glb');
    expect(paths).toContain('web/x/sub/deep.glb');
    expect(asked).toContainEqual(['web/x', 1000]);
  });
});

describe('readConsumers', () => {
  const root = mkdtempSync(join(tmpdir(), 'coverage-'));
  afterAll(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'src/data'), { recursive: true });
  mkdirSync(join(root, 'public/models/galaxy/bf2017/levels/hoth'), { recursive: true });
  writeFileSync(
    join(root, 'src/data/galaxyAssets.json'),
    JSON.stringify({
      'models/galaxy/awing.glb': { from: 'gameplay/vehicles/air/awing/vehicle_air_awing_01_static_donotuse_mesh' },
      'models/galaxy/bf2017/crew/luke.glb': { from: 'characters/hero/luke/luke_rotj_01/luke_rotj_01_mesh|lod1' },
    }),
  );
  writeFileSync(
    join(root, 'public/models/galaxy/bf2017/levels/hoth/level.json'),
    JSON.stringify({ map: 'levels/mp/hoth_01', meshes: [{ name: 'models/objects/a/rock_01_mesh.glb' }, { name: 'models/objects/a/rock_02_mesh.glb' }, { name: 'models/objects/b/wall_01_mesh.glb' }], tex: {} }),
  );
  it('reads the manifest’s rows and the level’s meshes, each with its file', async () => {
    const c = await readConsumers(root);
    for (const n of ['vehicle_air_awing_01_static_donotuse_mesh', 'luke_rotj_01_mesh']) expect(c.by.get(n)).toBe('src/data/galaxyAssets.json');
    for (const n of ['rock_01_mesh', 'rock_02_mesh', 'wall_01_mesh']) expect(c.by.get(n)).toBe('public/models/galaxy/bf2017/levels/hoth/level.json');
    expect(c.names.has(normalise('mapref:levels/mp/hoth_01'))).toBe(true);
  });
});

describe('resolveLevels', () => {
  const rows = [
    { part: 'maps', name: 'Levels/SP/A1/M1END/DS02', keys: ['map:levels/sp/a1/m1end/ds02'] },
    { part: 'maps', name: 'Levels/MP/Tatooine_01/Tatooine_01', keys: ['map:levels/mp/tatooine_01/tatooine_01'] },
    { part: 'terrain', name: 'Levels/MP/Tatooine_01/Terrain/Terrain', keys: ['terrain:levels/mp/tatooine_01/terrain/terrain'] },
    { part: 'terrain', name: 'S9_3/Hoth_02/Hoth_01_Terrain/Hoth_01_Terrain', keys: ['terrain:s9_3/hoth_02/hoth_01_terrain/hoth_01_terrain'] },
    { part: 'terrain', name: 'Levels/SP/A1/M1END/TerrainEndor/Endor_Terrain', keys: ['terrain:levels/sp/a1/m1end/terrainendor/endor_terrain'] },
  ];
  it('finds a pack’s map as written or doubled, and the terrains under its folder', () => {
    const c = { names: new Set(['mapref:levels/sp/a1/m1end/ds02', 'mapref:levels/mp/tatooine_01']), by: new Map([['mapref:levels/sp/a1/m1end/ds02', 'a/level.json'], ['mapref:levels/mp/tatooine_01', 'b/level.json']]) };
    resolveLevels(c, rows);
    expect(c.by.get('map:levels/sp/a1/m1end/ds02')).toBe('a/level.json');
    expect(c.by.get('map:levels/mp/tatooine_01/tatooine_01')).toBe('b/level.json');
    expect(c.by.get('terrain:levels/mp/tatooine_01/terrain/terrain')).toBe('b/level.json');
    expect(c.by.get('terrain:levels/sp/a1/m1end/terrainendor/endor_terrain')).toBe('a/level.json');
    expect(c.names.has('terrain:s9_3/hoth_02/hoth_01_terrain/hoth_01_terrain')).toBe(false);
  });
});

describe('checkLedger', () => {
  const owners = [{ lane: 'K', merged: 825 }, { lane: 'O' }];
  it('fails an owned row whose lane has merged', () => {
    const r = checkLedger([{ name: 'a', state: 'owned', by: 'K' }, { name: 'b', state: 'used', by: 'x' }], owners);
    expect(r.ok).toBe(false);
    expect(r.stale).toEqual([{ name: 'a', lane: 'K', merged: 825 }]);
  });
  it('fails an unowned row', () => {
    expect(checkLedger([{ name: 'c', state: 'unowned', by: '' }], owners)).toMatchObject({ ok: false, unowned: ['c'] });
  });
  it('fails a row owned by a lane the table does not know', () => {
    expect(checkLedger([{ name: 'd', state: 'owned', by: 'Zz' }], owners)).toMatchObject({ ok: false, unknown: [{ name: 'd', lane: 'Zz' }] });
  });
  it('passes a ledger that is all used, owned by open lanes, or excluded', () => {
    expect(checkLedger([{ name: 'a', state: 'used', by: 'x' }, { name: 'b', state: 'owned', by: 'O' }, { name: 'c', state: 'excluded', by: 'era' }], owners)).toEqual({ ok: true, unowned: [], stale: [], unknown: [] });
  });
});

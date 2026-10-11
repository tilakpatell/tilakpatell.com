import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dataPath, globDir, globMatch, globRegExp, imageUris, inBucket, isCurrent, jobsFor, localPath, mapPath, objectUrl, readIndex, summaryLine, textureSources, writeIndex, namesOfType } from './bf2017-paths.mjs';

// a GLB of just a JSON chunk, the way gltfpack's start
function glbOf(json) {
  let text = JSON.stringify(json);
  while (text.length % 4) text += ' ';
  const body = Buffer.from(text, 'utf8');
  const head = Buffer.alloc(20);
  head.write('glTF', 0, 'ascii');
  head.writeUInt32LE(2, 4);
  head.writeUInt32LE(20 + body.length, 8);
  head.writeUInt32LE(body.length, 12);
  head.writeUInt32LE(0x4e4f534a, 16);
  return Buffer.concat([head, body]);
}

describe('the 2017 drop’s paths', () => {
  it('reads a GLB’s image URIs as bucket paths, whatever shape they come in', () => {
    const glb = glbOf({ asset: { version: '2.0' }, images: [{ uri: '../../../../../textures/x/y_cs.ktx2' }, { uri: 'textures/x/z.ktx2' }, { uri: 'data:image/png;base64,AA==' }, { bufferView: 0 }] });
    expect(imageUris(glb, 'web/models/a/b/c/d/e_mesh.glb')).toEqual(['web/textures/x/y_cs.ktx2', 'web/textures/x/z.ktx2']);
    expect(imageUris(glbOf({ images: [{ uri: 'web/textures/q.ktx2' }] }), 'web/models/a.glb')).toEqual(['web/textures/q.ktx2']);
    expect(imageUris(glbOf({ asset: {} }), 'web/models/a.glb')).toEqual([]);
  });

  it('asks for the PNG first, then the KTX2', () => {
    expect(textureSources('web/textures/x/y_cs.ktx2')).toEqual(['web/textures/x/y_cs.png', 'web/textures/x/y_cs.ktx2']);
    expect(textureSources('web/textures/x/y_nm__orm_eb4aa84f.ktx2')).toEqual(['web/textures/x/y_nm.png', 'web/textures/x/y_nm__orm_eb4aa84f.ktx2']);
    expect(textureSources('web/textures/x/y_nm__normal.ktx2')).toEqual(['web/textures/x/y_nm.png', 'web/textures/x/y_nm__normal.ktx2']);
    expect(textureSources('web/textures/x/y_cs.png')).toEqual(['web/textures/x/y_cs.png']);
  });

  it('builds the object URL with each segment encoded', () => {
    expect(objectUrl('https://p.supabase.co', 'bf2017-assets', 'web/models/at-at/a b.glb')).toBe('https://p.supabase.co/storage/v1/object/bf2017-assets/web/models/at-at/a%20b.glb');
    expect(objectUrl('https://p.supabase.co/', 'b', 'x')).toBe('https://p.supabase.co/storage/v1/object/b/x');
  });

  it('reads the manifest’s paths as bucket paths', () => {
    expect(inBucket('models/a/b.glb')).toBe('web/models/a/b.glb');
    expect(inBucket('web/models/a/b.glb')).toBe('web/models/a/b.glb');
    // (the records' folder is at the bucket's root: `--folder data/Levels/…` lists it)
    expect(inBucket('data/Levels/MP/Hoth_01.json.gz')).toBe('data/Levels/MP/Hoth_01.json.gz');
    expect(mapPath('Gameplay/Heroes/X/T_X_3p_NAM')).toBe('web/textures/gameplay/heroes/x/t_x_3p_nam.png');
  });

  it('keeps the bucket’s layout on disk', () => {
    expect(localPath('/r', 'web/models/x.glb')).toBe('/r/web/models/x.glb');
  });

  it('keeps an index of what is on disk, and reads it back', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'bf2017-index-'));
    try {
      const file = join(dir, '.index.json');
      expect(await readIndex(file)).toEqual({});
      await writeIndex(file, { 'web/b.glb': { bytes: 2, at: 't' }, 'web/a.glb': { bytes: 1, at: 't' } });
      expect(await readIndex(file)).toEqual({ 'web/a.glb': { bytes: 1, at: 't' }, 'web/b.glb': { bytes: 2, at: 't' } });
      expect(Object.keys(await readIndex(file))).toEqual(['web/a.glb', 'web/b.glb']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('calls a file current only when the index, the disk and the manifest agree on its bytes', () => {
    const index = { 'web/a.glb': { bytes: 5, at: 't' } };
    expect(isCurrent(index, 'web/a.glb', 5, 5)).toBe(true);
    expect(isCurrent(index, 'web/a.glb', null, 5)).toBe(true);
    expect(isCurrent(index, 'web/a.glb', 6, 5)).toBe(false);
    expect(isCurrent(index, 'web/a.glb', 5, 4)).toBe(false);
    expect(isCurrent(index, 'web/a.glb', 5, null)).toBe(false);
    expect(isCurrent(index, 'web/b.glb', 5, 5)).toBe(false);
  });

  it('matches a glob over the manifest’s names, a star across folders', () => {
    expect(globMatch('characters/hero/luke/*')('characters/hero/luke/luke_rotj_01/luke_rotj_01_mesh')).toBe(true);
    expect(globMatch('characters/hero/luke/*')('characters/hero/leia/x')).toBe(false);
    expect(globMatch('a.b')('aXb')).toBe(false);
  });

  it('turns a glob into every file of the models it names: LODs and collision (each with the manifest’s size, a guess), then textures PNG first', () => {
    const manifest = new Map([
      ['a/one_mesh', { name: 'a/one_mesh', lods: [{ lod: 0, file: 'models/a/one_mesh.glb', bytes: 10 }, { lod: 2, file: 'models/a/one_mesh_lod2.glb', bytes: 4 }], collision: { file: 'collision/a/one_mesh.glb', bytes: 3 }, textures: ['A/T_One_CS', 'Shared/T_Grime_NAM'] }],
      ['a/two_mesh', { name: 'a/two_mesh', lods: [{ lod: 0, file: 'models/a/two_mesh.glb', bytes: 7 }], textures: ['Shared/T_Grime_NAM'] }],
      ['b/three_mesh', { name: 'b/three_mesh', lods: [{ lod: 0, file: 'models/b/three_mesh.glb', bytes: 1 }] }],
    ]);
    const jobs = jobsFor(manifest, 'a/*');
    expect(jobs.filter((j) => j.kind !== 'texture')).toEqual([
      { kind: 'model', path: 'web/models/a/one_mesh.glb', size: 10 },
      { kind: 'model', path: 'web/models/a/one_mesh_lod2.glb', size: 4 },
      { kind: 'collision', path: 'web/collision/a/one_mesh.glb', size: 3 },
      { kind: 'model', path: 'web/models/a/two_mesh.glb', size: 7 },
    ]);
    // (each map once, though two models name it)
    expect(jobs.filter((j) => j.kind === 'texture')).toEqual([
      { kind: 'texture', path: 'web/textures/a/t_one_cs.ktx2', sources: ['web/textures/a/t_one_cs.png', 'web/textures/a/t_one_cs.ktx2'] },
      { kind: 'texture', path: 'web/textures/shared/t_grime_nam.ktx2', sources: ['web/textures/shared/t_grime_nam.png', 'web/textures/shared/t_grime_nam.ktx2'] },
    ]);
    expect(jobsFor(manifest, 'a/*', { textures: false, collision: false }).map((j) => j.path)).toEqual(['web/models/a/one_mesh.glb', 'web/models/a/one_mesh_lod2.glb', 'web/models/a/two_mesh.glb']);
  });

  it('never takes a sequel-era model, whatever the glob', () => {
    const manifest = new Map([['characters/kyloren/k_mesh', { name: 'characters/kyloren/k_mesh', lods: [{ lod: 0, file: 'models/k.glb', bytes: 1 }] }]]);
    expect(jobsFor(manifest, 'characters/*')).toEqual([]);
  });

  it('sums a run up in one line', () => {
    expect(summaryLine({ fetched: 3, kept: 10, missing: 1, failed: 0, bytes: 5.25e6, seconds: 4.04 })).toBe('fetched 3 · kept 10 · missing 1 · failed 0 · 5.3 MB · 4.0 s');
  });

  it('reads a data glob: one star stays in its folder, two cross them', () => {
    const re = globRegExp('Gameplay/Equipment/Rifles/A280C/*');
    expect(re.test('Gameplay/Equipment/Rifles/A280C/WeaponFiring_A280C')).toBe(true);
    expect(re.test('Gameplay/Equipment/Rifles/A280C/Mods/U_A280C_Barrel')).toBe(false);
    expect(globRegExp('AI/BattleAI/**').test('AI/BattleAI/Cover/CoverConstants')).toBe(true);
    expect(globRegExp('Levels/MP/Hoth_01/FantasyBattle_*').test('Levels/MP/Hoth_01/FantasyBattle_Logic')).toBe(true);
    expect(globRegExp('a.b').test('axb')).toBe(false);
  });

  it('lists a data glob from the deepest folder it names', () => {
    expect(globDir('Gameplay/Equipment/Rifles/A280C/*')).toBe('Gameplay/Equipment/Rifles/A280C');
    expect(globDir('Levels/MP/Hoth_01/FantasyBattle_*')).toBe('Levels/MP/Hoth_01');
    expect(globDir('AI/**')).toBe('AI');
    expect(globDir('Settings')).toBe('');
    expect(dataPath('Gameplay/Kits/MP/Assault/Class_Assault')).toBe('data/Gameplay/Kits/MP/Assault/Class_Assault.json.gz');
  });
});

describe('namesOfType', () => {
  it('names the records of one type from data.tsv, whatever they are called', () => {
    const tsv = 'A_ShaderParameterVariation\tObjectVariation\tdata/A_ShaderParameterVariation.json\t4765\nCharacters/Luke/Luke_Default\tObjectVariation\tdata/Characters/Luke/Luke_Default.json\t900\nShaders/P\tSurfaceShaderPreset\tdata/Shaders/P.json\t12\n\n';
    expect(namesOfType(tsv, 'ObjectVariation')).toEqual(['A_ShaderParameterVariation', 'Characters/Luke/Luke_Default']);
    expect(namesOfType(tsv, 'surfaceshaderpreset')).toEqual(['Shaders/P']);
    expect(namesOfType(tsv, 'Nope')).toEqual([]);
  });
});

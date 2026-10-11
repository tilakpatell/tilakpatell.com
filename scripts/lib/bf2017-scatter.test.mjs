import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { glbJson } from './bf2017-paths.mjs';
import { CARD, QUALITY, RULES, bindMaps, claimOf, footprintOf, hash01, kindOf, lookOf, mapsOf, paintedOf, scatterJson, surfaceOf, typesOf } from './bf2017-scatter.mjs';

// Endor_01's table trimmed: each layer's first two types, the surface
// combinations of one or two layers
const endor = JSON.parse(readFileSync(new URL('./fixtures/endor_01_terrain.scatter.json', import.meta.url), 'utf8'));
const hoth = JSON.parse(readFileSync(new URL('./fixtures/hoth_01_terrain.surface.json', import.meta.url), 'utf8'));

describe('surfaceOf', () => {
  it('reads each paint layer’s texture from the combinations its bit is in', () => {
    const s = Object.fromEntries(surfaceOf(endor).map((x) => [x.layer, x.texture]));
    expect(s[0]).toBe('T_ForestBase_Leaves_02');
    expect(s[1]).toBe('T_ForestBase_River_02');
    expect(s[2]).toBe('T_ForestBase_Roots_02');
    expect(s[3]).toBe('T_ForestBurnt_Mud_03');
    // (a tie between the layer's normal set and a height map shared with it goes to the normals)
    expect(s[7]).toBe('T_ForestBase_Ferns_Distance_02');
  });
  it('agrees with lane Q2’s Hoth: the rocky snow is two layers, the packed snow one', () => {
    const s = surfaceOf(hoth);
    expect(s.find((x) => x.layer === 1).texture).toBe('T_ArcticBase_SnowPacked_04');
    expect(s.filter((x) => kindOf(x.texture) === 'rock').length).toBeGreaterThanOrEqual(2);
  });
  it('a table with no combinations has no surface', () => {
    expect(surfaceOf({ layers: [] })).toEqual([]);
  });
});

describe('kindOf', () => {
  it('names a layer by its texture', () => {
    expect(kindOf('T_ForestBurnt_Mud_03')).toBe('mud');
    expect(kindOf('T_ForestBurnt_Soot')).toBe('burnt');
    expect(kindOf('T_ForestBase_Clover_02')).toBe('cover');
    expect(kindOf('T_ArcticBase_SnowRockyPacked_04')).toBe('rock');
    expect(kindOf(null)).toBeNull();
  });
});

describe('typesOf', () => {
  const layers = typesOf(endor);
  it('every type with its density per tier (ultra the record’s Ultra, mid its Medium), scale, wind and dissolve', () => {
    const fern = layers.find((l) => l.index === 4).types[0];
    expect(fern.mesh).toMatch(/fern_01_a_mesh$/);
    expect(fern.density).toEqual({ low: 0.25, mid: 0.25, high: 0.25, ultra: 0.25 });
    expect(fern.scale).toEqual({ min: [0.6, 0.6], max: [1.3, 1.3] });
    expect(fern.wind).toMatchObject({ scale: 0.2, stiffness: 8, damping: 0.7, wiggle: 0.3 });
    expect(fern.dissolve.range).toBe(0.4);
    expect(fern._source).toMatch(/layer 4/);
    expect(Object.values(QUALITY)).toEqual(['Low', 'Medium', 'High', 'Ultra']);
  });
});

describe('paintedOf', () => {
  it('a run of equal heights (the pack’s fill) is not painted, varied ground is', () => {
    const w = 8;
    const h = 4;
    const heights = new Float32Array(w * h);
    for (let z = 0; z < h; z++) for (let x = 0; x < w; x++) heights[z * w + x] = x < 4 ? x * 0.37 + z * 0.91 + ((x * z) % 3) * 0.13 : 5;
    const p = paintedOf(heights, { w, h });
    expect(p[1 * w + 1]).toBe(1);
    expect(p[1 * w + 6]).toBe(0);
  });
});

describe('footprintOf', () => {
  const frame = { w: 20, h: 20, minX: 0, minZ: 0, metresPerPixel: 1 };
  it('covers a turned box, and nothing for a piece under the ground', () => {
    const f = footprintOf(
      [
        { x: 10, z: 10, yaw: Math.PI / 4, half: [3, 1], top: 5 },
        { x: 3, z: 3, yaw: 0, half: [2, 2], top: -1 },
      ],
      frame,
      () => 0,
    );
    expect(f[10 * 20 + 10]).toBe(1);
    // (along the turned long axis, not the unturned one)
    expect(f[12 * 20 + 12]).toBe(1);
    expect(f[10 * 20 + 13]).toBe(0);
    expect(f[3 * 20 + 3]).toBe(0);
  });
});

describe('claimOf', () => {
  const w = 10;
  const h = 10;
  const frame = { w, h, minX: 0, minZ: 0, metresPerPixel: 1 };
  const flat = new Float32Array(w * h);
  const slope = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) slope[i] = i % w < 5 ? 5 : 40;
  const canopy = new Float32Array(w * h).fill(0.9);
  const play = new Float32Array(w * h).fill(1);
  const rules = [
    { layer: 2, slope: [30, null] },
    { layer: 6, canopy: [0.5, null] },
  ];
  it('the first rule that holds claims the texel; nothing under a built piece or off the painted ground', () => {
    const built = new Uint8Array(w * h);
    built[0] = 1;
    const painted = new Uint8Array(w * h).fill(1);
    painted[1] = 0;
    const c = claimOf(rules, { heights: flat, slope, field: flat, canopy, play, painted, built, frame });
    expect(c[2 * w + 8]).toBe(3);
    expect(c[2 * w + 2]).toBe(7);
    expect(c[0]).toBe(0);
    expect(c[1]).toBe(0);
  });
  it('is the same every run (the soft edges dithered by the texel’s own number)', () => {
    const a = claimOf(rules, { heights: flat, slope, field: flat, canopy, play, frame });
    const b = claimOf(rules, { heights: flat, slope, field: flat, canopy, play, frame });
    expect(a).toEqual(b);
    expect(hash01(3, 4)).toBe(hash01(3, 4));
    expect(hash01(3, 4)).not.toBe(hash01(4, 3));
  });
});

describe('RULES', () => {
  it('Hoth scatters nothing; Endor names the layers by their textures', () => {
    expect(RULES.hoth.rules).toEqual([]);
    const kinds = Object.fromEntries(surfaceOf(endor).map((s) => [s.layer, kindOf(s.texture)]));
    for (const r of RULES.endor.rules.filter((x) => x.kind && [0, 2, 7].includes(x.layer))) expect(kinds[r.layer]).toBe(r.kind);
  });
});

describe('looks and maps', () => {
  it('a card without its colour map waits, a solid piece takes its kind’s colour', () => {
    expect(lookOf('x/ms_forestbase_fern_01_a_mesh', {}).look).toBe('waits');
    expect(lookOf('x/ms_forestbase_stone_01_mesh', {})).toMatchObject({ look: 'colour', rgb: expect.any(Array) });
    expect(lookOf('x/ms_forestbase_fern_01_a_mesh', { color: 'c' }).look).toBe('maps');
    expect(CARD.test('ms_forestbase_twigs_01_d_mesh')).toBe(true);
  });
  it('finds a mesh’s maps in its own folder, not the far card’s', () => {
    const index = new Map([
      ['T_MS_ForestBase_Fern_01_C', { file: 'textures/objects/nature/forest/_forestbase/_meshscattering/ms_forestbase_fern_01/t_ms_forestbase_fern_01_c.png' }],
      ['T_MS_ForestBase_Fern_01_N', { file: 'textures/objects/nature/forest/_forestbase/_meshscattering/ms_forestbase_fern_01/t_ms_forestbase_fern_01_n.png' }],
      ['T_MS_ForestBase_Fern_01_LOD_C', { file: 'textures/objects/nature/forest/_forestbase/_meshscattering/ms_forestbase_fern_01/t_ms_forestbase_fern_01_lod_c.png' }],
    ]);
    expect(mapsOf('models/objects/nature/forest/_forestbase/_meshscattering/ms_forestbase_fern_01/ms_forestbase_fern_01_a_mesh.glb', index)).toEqual({
      color: 'textures/objects/nature/forest/_forestbase/_meshscattering/ms_forestbase_fern_01/t_ms_forestbase_fern_01_c.ktx2',
      normal: 'textures/objects/nature/forest/_forestbase/_meshscattering/ms_forestbase_fern_01/t_ms_forestbase_fern_01_n__normal.ktx2',
    });
  });
  it('binds the maps into a GLB’s materials, alpha-tested for a card', () => {
    const json = Buffer.from(JSON.stringify({ asset: { version: '2.0' }, materials: [{ name: 'Fern_01' }] }));
    const pad = Buffer.alloc((4 - (json.length % 4)) % 4, 0x20);
    const head = Buffer.alloc(20);
    head.write('glTF', 0, 'ascii');
    head.writeUInt32LE(2, 4);
    head.writeUInt32LE(20 + json.length + pad.length, 8);
    head.writeUInt32LE(json.length + pad.length, 12);
    head.write('JSON', 16, 'ascii');
    const out = glbJson(bindMaps(Buffer.concat([head, json, pad]), { color: '../tex/c.ktx2', normal: '../tex/n.ktx2', card: true }));
    expect(out.images.map((i) => i.uri)).toEqual(['../tex/c.ktx2', '../tex/n.ktx2']);
    expect(out.materials[0]).toMatchObject({ alphaMode: 'MASK', doubleSided: true, normalTexture: { index: 1 }, pbrMetallicRoughness: { baseColorTexture: { index: 0 } } });
    expect(out.extensionsUsed).toContain('KHR_texture_basisu');
  });
});

describe('scatterJson', () => {
  it('says the mask is derived, which layers are placed, and each type’s mesh', () => {
    const j = scatterJson({ world: 'endor', table: endor, rules: RULES.endor, mask: { png: 'scatter/layers.png' }, meshes: {} });
    expect(j).toMatchObject({ format: 1, world: 'endor', mask: 'derived' });
    expect(j.layers.find((l) => l.index === 4).placed).toBe(true);
    expect(j.layers.find((l) => l.index === 3).placed).toBe(false);
    expect(j.layers[0].types[0].glb).toBeNull();
  });
});

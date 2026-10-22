import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildManifest, byName, checkManifest, sortByName } from './manifest.mjs';
import { importPack } from './import.mjs';

// The tiny fixture's shape (scripts/fixtures/kit/tiny/): two birches of one
// family, each a bark part and a leaf part of four triangles, sharing two
// materials; the leaf map an 8 × 8 of green texels, half of them see-through.
function leafMap() {
  const rgba = new Uint8Array(8 * 8 * 4);
  for (let i = 0; i < 64; i++) rgba.set(i % 2 ? [60, 140, 40, 255] : [0, 0, 0, 0], i * 4);
  return { rgba, w: 8, h: 8 };
}
function birch(name, height) {
  return {
    name,
    positions: new Float32Array([-0.1, 0, -0.1, 0.1, 0, 0.1, 0, height, 0, -1, height * 0.6, 0, 1, height * 0.8, 0.5]),
    parts: [
      { part: 'bark', material: 'Bark_Birch', tris: 4, tris1: 1 },
      { part: 'leaves', material: 'Leaves_Birch', tris: 4, tris1: 2 },
    ],
  };
}
const tiny = () => [
  {
    family: 'birch',
    file: 'birch.glb',
    models: [birch('Birch_1', 3), birch('Birch_2', 4)],
    materials: {
      Bark_Birch: { leaf: false, wind: true, maps: { colour: [8, 8], normal: [8, 8] } },
      Leaves_Birch: { leaf: true, wind: true, maps: { colour: [8, 8] }, pixels: leafMap() },
    },
  },
];

describe('a pack’s manifest', () => {
  it('describes each model of the tiny fixture: its family, file, kind, parts and size', () => {
    const m = buildManifest('tiny', tiny(), { title: 'Tiny Kit' });
    expect(m.pack).toBe('tiny');
    expect(m.licence).toBe('CC0-1.0');
    expect(m.source).toBe('Quaternius, Tiny Kit (https://quaternius.com)');
    expect(Object.keys(m.models)).toEqual(['Birch_1', 'Birch_2']);
    const b = m.models.Birch_1;
    expect(b).toMatchObject({ family: 'birch', file: 'birch.glb', kind: 'tree', parts: ['bark', 'leaves'], tris: 8, tris1: 3 });
    expect(b.height).toBe(3);
    expect(b.radius).toBeCloseTo(Math.hypot(2, 0.6) / 2, 3);
    expect(b.trunk).toBeGreaterThan(0);
    expect(m.models.Birch_2.height).toBe(4);
    expect(b.rig).toBeUndefined();
  });

  it('takes a tree’s trunk from its bark alone, and a model with no bark’s from all of it', () => {
    // (a bark post 0.2 across the middle under a crown, and a leaf card 4 m wide at 0.3 m, under the 8 % line of 10 m)
    const bark = [-0.1, 0, -0.1, 0.1, 0, 0.1, -0.1, 9, -0.1, 0.1, 9, 0.1];
    const card = [-2, 0.3, 0, 2, 0.3, 0, -2, 0.5, 0, 2, 0.5, 0];
    const crown = [-3, 7, 0, 3, 10, 0];
    const positions = new Float32Array([...bark, ...card, ...crown]);
    const tree = { ...birch('Birch_1', 10), positions, bark: new Float32Array(bark) };
    const fern = { name: 'Fern_1', positions, parts: [{ part: 'leaves', material: 'Leaves_Birch', tris: 4, tris1: 2 }] };
    const m = buildManifest('tiny', [
      { ...tiny()[0], models: [tree] },
      { ...tiny()[0], family: 'fern', file: 'fern.glb', models: [fern] },
    ]);
    expect(m.models.Birch_1.trunk).toBeCloseTo(Math.SQRT2 * 0.1, 3);
    expect(m.models.Birch_1.height).toBe(10);
    expect(m.models.Birch_1.radius).toBeCloseTo(Math.hypot(6, 0.2) / 2, 3);
    expect(m.models.Fern_1.trunk).toBeCloseTo(2, 3);
  });

  it('gives a tree its leaf map’s two tones, linear and a darker then a lighter', () => {
    const { tones } = buildManifest('tiny', tiny()).models.Birch_1;
    expect(tones).toHaveLength(2);
    for (const t of tones) {
      expect(t).toHaveLength(3);
      for (const c of t) {
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThanOrEqual(1);
      }
    }
    // sRGB 140 is about 0.262 linear; the tones are it ×0.88 and ×1.12
    expect(tones[0][1]).toBeCloseTo(0.262 * 0.88, 2);
    expect(tones[1][1]).toBeCloseTo(0.262 * 1.12, 2);
  });

  it('makes a leaf material a mask and the bark opaque, both bending as a tree', () => {
    const { materials } = buildManifest('tiny', tiny());
    expect(materials.Leaves_Birch).toEqual({ alpha: 'mask', leaf: true, wind: 'tree', maps: { colour: '8x8' } });
    expect(materials.Bark_Birch).toEqual({ alpha: 'opaque', leaf: false, wind: 'tree', maps: { colour: '8x8', normal: '8x8' } });
  });

  it('lists a LOD1’s own material though no model’s parts wear it, and no other such', () => {
    const [fam] = tiny();
    const { materials } = buildManifest('tiny', [{ ...fam, materials: { ...fam.materials, Birch_1_Facade: { leaf: false, wind: false, far: true, maps: { colour: [16, 16] } }, Unworn: { leaf: false, wind: false, maps: {} } } }]);
    expect(materials.Birch_1_Facade).toEqual({ alpha: 'opaque', leaf: false, wind: null, maps: { colour: '16x16' } });
    expect(materials.Unworn).toBeUndefined();
  });

  it('bends a material as a tree when any tree wears it, as a shrub when only low things do, and not at all otherwise', () => {
    const part = (material, part = 'leaves') => ({ part, material, tris: 10, tris1: 4 });
    const model = (name, ...parts) => ({ name, positions: new Float32Array([0, 0, 0, 1, 1, 1]), parts });
    const mats = {
      Leaves_Shared: { leaf: true, wind: true, maps: { colour: [4, 4] }, pixels: leafMap() },
      Grass: { leaf: false, wind: true, maps: { colour: [4, 4] } },
      Rocks: { leaf: false, wind: true, maps: { colour: [4, 4] } },
      Flowers: { leaf: true, wind: false, maps: { colour: [4, 4] } },
    };
    const m = buildManifest('x', [
      { family: 'bush', file: 'bush.glb', models: [model('Bush_Common', part('Leaves_Shared'))], materials: mats },
      { family: 'twistedtree', file: 'twistedtree.glb', models: [model('TwistedTree_1', part('Leaves_Shared'))], materials: mats },
      { family: 'grass', file: 'grass.glb', models: [model('Grass_Tall', part('Grass', 'main'))], materials: mats },
      { family: 'rock', file: 'rock.glb', models: [model('Rock_Big_2', part('Rocks', 'main'))], materials: mats },
      { family: 'petal', file: 'petal.glb', models: [model('Petal_1', part('Flowers'))], materials: mats },
    ]);
    expect(m.materials.Leaves_Shared.wind).toBe('tree');
    expect(m.materials.Grass.wind).toBe('shrub');
    expect(m.materials.Rocks.wind).toBeNull();
    // (no _WIND in its geometry, so nothing to bend by)
    expect(m.materials.Flowers.wind).toBeNull();
    expect(m.models.Bush_Common.tones).toHaveLength(2);
    expect(m.models.Grass_Tall.tones).toBeUndefined();

    // a family imported on its own: its leaves still bend as the trees that
    // also wear them, elsewhere in the pack
    const alone = buildManifest('x', [
      { family: 'bush', file: 'bush.glb', models: [model('Bush_Common', part('Leaves_Shared'))], materials: { Leaves_Shared: { ...mats.Leaves_Shared, worn: ['bush', 'tree'] } } },
    ]);
    expect(alone.materials.Leaves_Shared.wind).toBe('tree');
    expect(buildManifest('x', [{ family: 'bush', file: 'bush.glb', models: [model('Bush_Common', part('Leaves_Shared'))], materials: mats }]).materials.Leaves_Shared.wind).toBe('shrub');
  });

  it('files a rigged model as a character with its bones and clips, and no LOD1', () => {
    const rig = { bones: 43, clips: { Idle: 1, Walk: 1 } };
    const m = buildManifest('space', [
      {
        family: 'astronaut',
        file: 'astronaut_finnthefrog.glb',
        models: [{ name: 'Astronaut_FinnTheFrog', rig, positions: new Float32Array([0, 0, 0, 0.5, 1.8, 0.3]), parts: [{ part: 'main', material: 'Atlas', tris: 8000 }] }],
        materials: { Atlas: { leaf: false, wind: false, maps: { colour: [512, 512] } } },
      },
    ]);
    expect(m.models.Astronaut_FinnTheFrog).toMatchObject({ kind: 'character', rig, tris: 8000, tris1: null, file: 'astronaut_finnthefrog.glb' });
    expect(m.materials.Atlas).toEqual({ alpha: 'opaque', leaf: false, wind: null, maps: { colour: '512x512' } });
  });
});

describe('the kit’s one order of names', () => {
  it('is code-unit order, the same on every machine (capitals, then `_`, then small letters)', () => {
    expect(['Rock_Big_1', 'RockPath_Round', 'birch', 'Birch_2', 'Birch_10'].sort(byName)).toEqual(['Birch_10', 'Birch_2', 'RockPath_Round', 'Rock_Big_1', 'birch']);
    expect(Object.keys(sortByName({ Rock_Big_1: 1, RockPath_Round: 2 }))).toEqual(['RockPath_Round', 'Rock_Big_1']);
    expect(byName('a', 'a')).toBe(0);
  });
});

describe('checking a manifest against its files', () => {
  const MiB = 1048576;
  it('is clean when every file is there and within its budget', () => {
    const m = buildManifest('tiny', tiny());
    expect(checkManifest(m, { 'birch.glb': 0.4 * MiB })).toEqual([]);
  });

  it('flags a family file over 1.5 MiB, a tree over 15,000 triangles, a tree’s LOD1 over 40 % and a missing file', () => {
    const m = buildManifest('tiny', tiny());
    expect(checkManifest(m, { 'birch.glb': 1.6 * MiB })).toEqual([expect.stringMatching(/birch\.glb.*1\.6 MiB.*1\.5 MiB/)]);
    m.models.Birch_1.tris = 16000;
    m.models.Birch_1.tris1 = 3000;
    m.models.Birch_2.tris1 = m.models.Birch_2.tris / 2;
    const errors = checkManifest(m, { 'birch.glb': MiB });
    expect(errors).toHaveLength(2);
    expect(errors[0]).toMatch(/Birch_1.*16000.*15000/);
    expect(errors[1]).toMatch(/Birch_2.*LOD1.*50 %/);
    expect(checkManifest(m, {})).toContainEqual(expect.stringMatching(/Birch_1.*birch\.glb.*missing/));
  });

  it('holds only a tree’s LOD1 to 40 %, and any other LOD1 to no more than its model', () => {
    const model = (name, tris, tris1) => ({ name, positions: new Float32Array([0, 0, 0, 1, 1, 1]), parts: [{ part: 'leaves', material: 'Flowers', tris, tris1 }] });
    const m = buildManifest('x', [
      { family: 'petal', file: 'petal.glb', models: [model('Petal_1', 10, 9), model('Petal_2', 10, 11)], materials: { Flowers: { leaf: true, wind: false, maps: { colour: [4, 4] } } } },
    ]);
    expect(checkManifest(m, { 'petal.glb': 1000 })).toEqual([expect.stringMatching(/Petal_2.*LOD1 11 of 10.*more than/)]);
    // (a tree at 50 % is flagged: the test above)
  });

  it('wants the licence and the source said', () => {
    const m = buildManifest('tiny', tiny());
    delete m.licence;
    m.source = '';
    expect(checkManifest(m, { 'birch.glb': MiB })).toEqual([expect.stringMatching(/licence/), expect.stringMatching(/source/)]);
  });
});

describe('the import, run on the tiny fixture', () => {
  it('writes one family GLB of two models, their LOD1s and two materials, and its manifest', async () => {
    const out = mkdtempSync(join(tmpdir(), 'kit-tiny-'));
    try {
      const script = join(import.meta.dirname, 'import.mjs');
      const from = join(import.meta.dirname, '..', 'fixtures', 'kit', 'tiny');
      execFileSync(process.execPath, [script, 'tiny', '--from', from, '--out', out], { stdio: 'pipe' });

      const { NodeIO } = await import('@gltf-transform/core');
      const { ALL_EXTENSIONS } = await import('@gltf-transform/extensions');
      const { MeshoptDecoder } = await import('meshoptimizer');
      await MeshoptDecoder.ready;
      const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
      const doc = await io.read(join(out, 'birch.glb'));
      const root = doc.getRoot();
      expect(root.listMeshes().map((m) => m.getName()).sort()).toEqual(['Birch_1', 'Birch_1.lod1', 'Birch_2', 'Birch_2.lod1']);
      expect(root.listNodes().map((n) => n.getName()).sort()).toEqual(['Birch_1', 'Birch_1.lod1', 'Birch_2', 'Birch_2.lod1']);
      expect(root.listMaterials().map((m) => m.getName()).sort()).toEqual(['Bark_Birch', 'Leaves_Birch']);
      const leaf = root.listMaterials().find((m) => m.getName() === 'Leaves_Birch');
      expect([leaf.getAlphaMode(), leaf.getAlphaCutoff(), leaf.getDoubleSided()]).toEqual(['MASK', 0.3, true]);
      expect(root.listMaterials().find((m) => m.getName() === 'Bark_Birch').getAlphaMode()).toBe('OPAQUE');
      for (const mesh of root.listMeshes()) {
        expect(mesh.listPrimitives().map((p) => p.getExtras().part)).toEqual(['bark', 'leaves']);
        for (const p of mesh.listPrimitives()) {
          const wind = p.getAttribute('_WIND');
          expect(wind, mesh.getName()).toBeTruthy();
          expect([wind.getType(), wind.getComponentType(), wind.getNormalized()]).toEqual(['SCALAR', 5121, true]);
          expect(p.getAttribute('COLOR_0')).toBeNull();
        }
        // the trunk's foot at 0.14 and its top at 1 (floats), the crown at 1 (shorts)
        const [bark, crown] = mesh.listPrimitives().map((p) => [...new Set(p.getAttribute('_WIND').getArray())].sort((a, b) => a - b));
        expect(bark).toEqual([36, 255]);
        expect(crown).toEqual([255]);
      }
      // a LOD1 crown keeps one of its two cards
      expect(root.listMeshes().find((m) => m.getName() === 'Birch_1.lod1').listPrimitives()[1].getIndices().getCount()).toBe(6);
      expect(root.listTextures().map((t) => t.getMimeType())).toEqual(['image/webp', 'image/webp']);

      const manifest = JSON.parse(readFileSync(join(out, 'index.json'), 'utf8'));
      expect(manifest).toMatchObject({ pack: 'tiny', licence: 'CC0-1.0' });
      expect(manifest.models.Birch_1).toMatchObject({ family: 'birch', file: 'birch.glb', kind: 'tree', parts: ['bark', 'leaves'], tris: 8 });
      expect(manifest.models.Birch_1.tris1).toBeLessThan(8);
      expect(manifest.models.Birch_1.tones).toHaveLength(2);
      expect(manifest.materials.Leaves_Birch).toEqual({ alpha: 'mask', leaf: true, wind: 'tree', maps: { colour: '8x8' } });
      expect(manifest.materials.Bark_Birch).toEqual({ alpha: 'opaque', leaf: false, wind: 'tree', maps: { colour: '8x8' } });
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  }, 60000);
});

describe('a family too heavy for one file', () => {
  it('goes into <family>.glb, <family>-2.glb … in model order, each under the cap, its materials named as before', async () => {
    const from = join(import.meta.dirname, '..', 'fixtures', 'kit', 'tiny');
    const [whole, split] = [mkdtempSync(join(tmpdir(), 'kit-whole-')), mkdtempSync(join(tmpdir(), 'kit-split-'))];
    try {
      const one = await importPack({ pack: 'tiny', from, out: whole, log: () => {} });
      const size = statSync(join(whole, 'birch.glb')).size;
      expect(new Set(Object.values(one.models).map((m) => m.file))).toEqual(new Set(['birch.glb']));

      // a cap the two birches together are over, and each alone under
      const m = await importPack({ pack: 'tiny', from, out: split, log: () => {}, cap: size - 1 });
      expect([m.models.Birch_1.file, m.models.Birch_2.file]).toEqual(['birch.glb', 'birch-2.glb']);
      expect(m.models.Birch_2.family).toBe('birch');
      expect(readdirSync(split).sort()).toEqual(['birch-2.glb', 'birch.glb', 'index.json']);
      for (const f of ['birch.glb', 'birch-2.glb']) expect(statSync(join(split, f)).size).toBeLessThan(size);
      expect(m.materials).toEqual(one.materials);

      const { NodeIO } = await import('@gltf-transform/core');
      const { ALL_EXTENSIONS } = await import('@gltf-transform/extensions');
      const { MeshoptDecoder } = await import('meshoptimizer');
      await MeshoptDecoder.ready;
      const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
      const second = (await io.read(join(split, 'birch-2.glb'))).getRoot();
      expect(second.listMeshes().map((x) => x.getName()).sort()).toEqual(['Birch_2', 'Birch_2.lod1']);
      expect(second.listMaterials().map((x) => x.getName()).sort()).toEqual(['Bark_Birch', 'Leaves_Birch']);
    } finally {
      rmSync(whole, { recursive: true, force: true });
      rmSync(split, { recursive: true, force: true });
    }
  }, 60000);
});

describe('a tree with a leaf card below its 8 % line', () => {
  it('is given its bark’s trunk by the import, not the card’s width; its height and footprint are the whole tree’s', async () => {
    const { Document, NodeIO } = await import('@gltf-transform/core');
    const { ALL_EXTENSIONS } = await import('@gltf-transform/extensions');
    const { MeshoptDecoder } = await import('meshoptimizer');
    await MeshoptDecoder.ready;
    const [from, out] = [mkdtempSync(join(tmpdir(), 'kit-low-')), mkdtempSync(join(tmpdir(), 'kit-low-out-'))];
    try {
      const doc = new Document();
      const buffer = doc.createBuffer();
      const prim = (material, positions, indices) =>
        doc
          .createPrimitive()
          .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(positions)).setBuffer(buffer))
          .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint16Array(indices)).setBuffer(buffer))
          .setMaterial(doc.createMaterial(material));
      // the bark a post 0.2 across, 9 m tall
      const post = [];
      for (const y of [0, 9]) post.push(-0.1, y, -0.1, 0.1, y, -0.1, 0.1, y, 0.1, -0.1, y, 0.1);
      const sides = [0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7, 4, 5, 6, 4, 6, 7];
      // the leaves two cards: one 4 m wide at 0.3-0.5 m (under 8 % of 10 m), one in the crown up to 10 m
      const cards = [-2, 0.3, 0, 2, 0.3, 0, 2, 0.5, 0, -2, 0.5, 0, -3, 7, 0, 3, 7, 0, 3, 10, 0, -3, 10, 0];
      const quads = [0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7];
      const mesh = doc.createMesh('Birch_7').addPrimitive(prim('Bark_Birch', post, sides)).addPrimitive(prim('Leaves_Birch', cards, quads));
      doc.createScene().addChild(doc.createNode('Birch_7').setMesh(mesh));
      const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
      await io.write(join(from, 'Birch_7.glb'), doc);

      const m = await importPack({ pack: 'low', from, out, log: () => {} });
      expect(m.models.Birch_7).toMatchObject({ kind: 'tree', parts: ['bark', 'leaves'] });
      expect(m.models.Birch_7.trunk).toBeCloseTo(Math.SQRT2 * 0.1, 2);
      expect(m.models.Birch_7.height).toBeCloseTo(10, 2);
      expect(m.models.Birch_7.radius).toBeCloseTo(Math.hypot(6, 0.2) / 2, 2);
    } finally {
      rmSync(from, { recursive: true, force: true });
      rmSync(out, { recursive: true, force: true });
    }
  }, 60000);
});

describe('materials of one name in different colours', () => {
  it('are told apart, `Name` for the colour most models wear and `Name_2` for the next, each keeping its colour', async () => {
    const { Document, NodeIO } = await import('@gltf-transform/core');
    const { ALL_EXTENSIONS } = await import('@gltf-transform/extensions');
    const { MeshoptDecoder } = await import('meshoptimizer');
    await MeshoptDecoder.ready;
    const [from, out] = [mkdtempSync(join(tmpdir(), 'kit-flat-')), mkdtempSync(join(tmpdir(), 'kit-flat-out-'))];
    const DARK = [0.03, 0.009, 0.004, 1];
    const DARKER = [0.003, 0.001, 0.0007, 1];
    try {
      // three tetrahedra in a flat colour named `Brown`, the second darker
      // (as two of the farm animals' are)
      const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
      for (const [name, colour] of [['Box_1', DARK], ['Box_2', DARKER], ['Box_3', DARK]]) {
        const doc = new Document();
        const buffer = doc.createBuffer();
        const position = doc.createAccessor().setType('VEC3').setArray(new Float32Array([0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0])).setBuffer(buffer);
        const indices = doc.createAccessor().setType('SCALAR').setArray(new Uint16Array([0, 1, 2, 0, 3, 1, 0, 2, 3, 1, 3, 2])).setBuffer(buffer);
        const material = doc.createMaterial('Brown').setBaseColorFactor(colour);
        const mesh = doc.createMesh(name).addPrimitive(doc.createPrimitive().setAttribute('POSITION', position).setIndices(indices).setMaterial(material));
        doc.createScene().addChild(doc.createNode(name).setMesh(mesh));
        await io.write(join(from, `${name}.glb`), doc);
      }
      const m = await importPack({ pack: 'flat', from, out, log: () => {} });
      expect(Object.keys(m.materials)).toEqual(['Brown', 'Brown_2']);
      const root = (await io.read(join(out, 'box.glb'))).getRoot();
      const worn = (model) => root.listMeshes().find((x) => x.getName() === model).listPrimitives()[0].getMaterial();
      expect(worn('Box_1').getName()).toBe('Brown');
      expect(worn('Box_3').getName()).toBe('Brown');
      expect(worn('Box_2').getName()).toBe('Brown_2');
      expect(worn('Box_1').getBaseColorFactor().map((x) => Number(x.toFixed(4)))).toEqual(DARK);
      expect(worn('Box_2').getBaseColorFactor().map((x) => Number(x.toFixed(4)))).toEqual(DARKER);
    } finally {
      rmSync(from, { recursive: true, force: true });
      rmSync(out, { recursive: true, force: true });
    }
  }, 60000);
});

import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { dims, triangles } from './lib/surface-model.mjs';

const HILT = 'gameplay/equipment/heroes/lightsaberlukeskywalker/lightsaberlukeskywalker_meshp_mesh';
const FIXTURE = 'scripts/fixtures/bf2017';
const PERMISSION = 'From EA DICE’s Star Wars Battlefront II (2017), used with permission on this non-commercial fan project; Star Wars and everything in it belong to Lucasfilm.';
const reader = async () => {
  await MeshoptDecoder.ready;
  return new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
};
async function scratch() {
  const dir = await mkdtemp(join(tmpdir(), 'bf2017-import-'));
  await writeFile(join(dir, 'bf2017.js'), 'export const MODELS = {};\n');
  await writeFile(join(dir, 'credits.json'), '{}\n');
  return dir;
}
const args = (dir, name, more = []) => ['scripts/bf2017-import.mjs', name, '--root', FIXTURE, '--kind', 'hiltfixture', '--as', 'the fixture hilt', '--out', dir, '--catalog', join(dir, 'bf2017.js'), '--credits', join(dir, 'credits.json'), '--unpacked', join(dir, 'unpacked'), ...more];

describe('the 2017 import', () => {
  it('turns the fixture hilt into the site’s file, row and credit', { timeout: 10000 }, async () => {
    const dir = await scratch();
    const said = execFileSync('node', args(dir, HILT, ['--asis', '--tex', '64', '--maps', '32']), { encoding: 'utf8' });
    expect(said).toMatch(/glb-shot\.mjs/);
    const doc = await (await reader()).read(join(dir, 'surface', 'hiltfixture.glb'));
    const root = doc.getRoot();
    expect(root.listScenes().length).toBe(1);
    const used = root.listExtensionsUsed().map((e) => e.extensionName);
    expect(used).toContain('EXT_meshopt_compression');
    expect(used).toContain('EXT_texture_webp');
    expect(used).not.toContain('KHR_texture_basisu');
    const sizes = root
      .listTextures()
      .map((t) => t.getSize()[0])
      .sort((a, b) => a - b);
    expect(sizes).toEqual([32, 32, 64]);
    const mat = root.listMaterials()[0];
    expect(mat.getBaseColorTexture().getSize()).toEqual([64, 64]);
    expect(mat.getNormalTexture()).toBeTruthy();
    expect(mat.getMetallicRoughnessTexture()).toBeTruthy();
    expect(mat.getExtras()).toEqual({});
    expect(triangles(doc)).toBe(920);
    const manifest = JSON.parse((await readFile(join(FIXTURE, 'web', 'models.jsonl'), 'utf8')).trim());
    const tall = manifest.max[1] - manifest.min[1];
    expect(Math.abs(dims(doc)[1] - tall) / tall).toBeLessThan(0.01);
    const { min } = (await import('./lib/surface-model.mjs')).bounds(doc, root.listScenes()[0]);
    expect(Math.abs(min[1])).toBeLessThan(0.001);
    expect(root.listNodes().some((n) => n.getName() === 'grip')).toBe(true);
    expect(existsSync(join(dir, 'surface', 'hiltfixture.lod1.glb'))).toBe(false);
    const rows = (await readFile(join(dir, 'bf2017.js'), 'utf8')).split('\n').filter((l) => l.startsWith('  hiltfixture: '));
    expect(rows.length).toBe(1);
    expect(rows[0].startsWith("  hiltfixture: { made: 'bf2017'")).toBe(true);
    expect(rows[0]).toContain(`from: '${HILT}'`);
    const credit = JSON.parse(await readFile(join(dir, 'credits.json'), 'utf8'))['surface-hiltfixture'];
    expect(credit.license).toBe('permission');
    expect(credit.permission).toBe(PERMISSION);
    expect(credit.author).toBe('EA DICE');
    expect(credit.file).toBe('/models/galaxy/surface/hiltfixture.glb');
  });

  it('writes the full-fidelity cut: the game’s own maps as AVIF, opaque colour without its alpha, positions at 16 bits', { timeout: 20000 }, async () => {
    const dir = await scratch();
    execFileSync('node', args(dir, HILT, ['--asis', '--full']), { encoding: 'utf8' });
    const file = join(dir, 'surface', 'hiltfixture.glb');
    const doc = await (await reader()).read(file);
    const root = doc.getRoot();
    const used = root.listExtensionsUsed().map((e) => e.extensionName);
    expect(used).toContain('EXT_texture_avif');
    expect(used).not.toContain('EXT_texture_webp');
    // (the fixture's maps are 64: the game's own size, never resized)
    expect(root.listTextures().map((t) => [t.getMimeType(), t.getSize()[0]])).toEqual([
      ['image/avif', 64],
      ['image/avif', 64],
      ['image/avif', 64],
    ]);
    const sharp = (await import('./lib/bf2017-textures.mjs')).sharpOf();
    const colour = root.listMaterials()[0].getBaseColorTexture().getImage();
    expect((await sharp(Buffer.from(colour)).metadata()).hasAlpha).toBe(false);
    const pos = root.listMeshes()[0].listPrimitives()[0].getAttribute('POSITION');
    // (16 bits, not meshopt's 14: at 14, glTF-Transform fills a short's two
    // low bits with the value's top two, so every value would repeat them)
    const at14 = (v) => (Math.abs(v) & 3) === Math.abs(v) >> 13;
    expect([...pos.getArray()].every(at14)).toBe(false);
    expect(triangles(doc)).toBe(920);
  });

  it('writes a far cut from the last LOD at 256, under 150 KB', { timeout: 20000 }, async () => {
    const dir = await scratch();
    const said = execFileSync('node', args(dir, HILT, ['--asis', '--far', '--tex', '64', '--maps', '64']), { encoding: 'utf8' });
    expect(said).toMatch(/hiltfixture\.far\.glb\s+far/);
    const file = join(dir, 'surface', 'hiltfixture.far.glb');
    const doc = await (await reader()).read(file);
    expect(Math.max(...doc.getRoot().listTextures().map((t) => t.getSize()[0]))).toBeLessThanOrEqual(256);
    expect((await readFile(file)).length).toBeLessThan(150 * 1024);
    expect(await readFile(join(dir, 'bf2017.js'), 'utf8')).toContain('far: true');
  });

  it('refuses the sequel era, and writes nothing', async () => {
    const dir = await scratch();
    const r = spawnSync('node', args(dir, 'characters/hero/kyloren/x'), { encoding: 'utf8' });
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/sequel-era/);
    expect(readdirSync(dir).sort()).toEqual(['bf2017.js', 'credits.json']);
    expect(await readFile(join(dir, 'bf2017.js'), 'utf8')).toBe('export const MODELS = {};\n');
  });
});

// a skinned person in a scratch drop: Hips → Spine → RightHand → IK_Joint_RightHand
// and Wep_Root, and Hips → FACIAL_Jaw, Spine → Cape_Phys; only the hand carries weight
async function riggedDrop({ weapon = true, parts = false } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'bf2017-rig-'));
  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene();
  const n = (name, t) => doc.createNode(name).setTranslation(t);
  const [hips, spine, hand, ik, wep, jaw, cape] = [n('Hips', [0, 1, 0]), n('Spine', [0, 0.3, 0]), n('RightHand', [0.4, 0.2, 0]), n('IK_Joint_RightHand', [0.05, 0, 0]), n('Wep_Root', [0.06, -0.02, 0]), n('FACIAL_Jaw', [0, 0.6, 0.1]), n('Cape_Phys', [0, 0.1, -0.1])];
  scene.addChild(hips);
  hips.addChild(spine).addChild(jaw);
  spine.addChild(hand).addChild(cape);
  hand.addChild(ik).addChild(wep);
  const joints = [hips, spine, hand, ik, wep, jaw, cape];
  const acc = (type, array) => doc.createAccessor().setType(type).setArray(array).setBuffer(buffer);
  const ibm = new Float32Array(16 * joints.length);
  joints.forEach((j, i) => {
    const w = j.getWorldTranslation();
    ibm.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -w[0], -w[1], -w[2], 1], i * 16);
  });
  const skin = doc.createSkin().setSkeleton(hips).setInverseBindMatrices(acc('MAT4', ibm));
  for (const j of joints) skin.addJoint(j);
  const prim = doc
    .createPrimitive()
    .setAttribute('POSITION', acc('VEC3', new Float32Array([0, 0, 0, 0.2, 0, 0, 0, 1.8, 0])))
    .setAttribute('JOINTS_0', acc('VEC4', new Uint16Array([2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0])))
    .setAttribute('WEIGHTS_0', acc('VEC4', new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0])))
    .setIndices(acc('SCALAR', new Uint16Array([0, 1, 2])));
  if (!weapon) {
    skin.removeJoint(wep);
    wep.dispose();
  }
  scene.addChild(doc.createNode('body').setMesh(doc.createMesh().addPrimitive(prim)).setSkin(skin));
  if (parts) {
    // (a helmet in a material of its own and a backpack in the body's, all on the one skin)
    const armour = doc.createMaterial('armour');
    prim.setMaterial(armour);
    const part = (name, material, y) =>
      scene.addChild(
        doc
          .createNode(name)
          .setMesh(
            doc.createMesh(name).addPrimitive(
              doc
                .createPrimitive()
                .setMaterial(material)
                .setAttribute('POSITION', acc('VEC3', new Float32Array([0, y, 0, 0.2, y, 0, 0, y + 0.1, 0])))
                .setAttribute('JOINTS_0', acc('VEC4', new Uint16Array([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0])))
                .setAttribute('WEIGHTS_0', acc('VEC4', new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0])))
                .setIndices(acc('SCALAR', new Uint16Array([0, 1, 2]))),
            ),
          )
          .setSkin(skin),
      );
    part('helmet', doc.createMaterial('visor').setBaseColorFactor([0.1, 0.1, 0.1, 1]), 1.7);
    part('backpack', armour, 1.2);
  }
  const name = 'characters/hero/test/test_01/test_01_mesh';
  await mkdir(join(root, 'web/models/characters/hero/test/test_01'), { recursive: true });
  await writeFile(join(root, `web/models/${name}.glb`), await new NodeIO().writeBinary(doc));
  const entry = { name, file: `models/${name}.glb`, min: [0, 0, 0], max: [0.2, 1.8, 0], lods: [{ lod: 0, file: `models/${name}.glb`, triangles: 1 }] };
  await writeFile(join(root, 'web/models.jsonl'), `${JSON.stringify(entry)}\n`);
  return { root, name };
}

describe('the 2017 import of a rig', () => {
  const importRig = async (drop, more = []) => {
    const { root, name } = await riggedDrop(drop);
    const dir = await scratch();
    const said = execFileSync('node', ['scripts/bf2017-import.mjs', name, '--root', root, '--kind', 'rigtest', '--as', 'a test', '--rig', '--out', dir, '--catalog', join(dir, 'bf2017.js'), '--credits', join(dir, 'credits.json'), ...more], { encoding: 'utf8' });
    const doc = await (await reader()).read(join(dir, 'surface', 'rigtest.glb'));
    const grip = doc
      .getRoot()
      .listNodes()
      .find((x) => x.getName() === 'grip');
    return { said, doc, dir, grip };
  };

  it('keeps the whole rig, face and physics alike, with the grip on the weapon socket', { timeout: 10000 }, async () => {
    const { said, doc, dir, grip } = await importRig();
    expect(said).toMatch(/rig kept whole: 7 joints/);
    const names = doc
      .getRoot()
      .listSkins()[0]
      .listJoints()
      .map((j) => j.getName());
    expect(names.sort()).toEqual(['Cape_Phys', 'FACIAL_Jaw', 'Hips', 'IK_Joint_RightHand', 'RightHand', 'Spine', 'Wep_Root']);
    expect(grip.getParentNode().getName()).toBe('Wep_Root');
    expect(await readFile(join(dir, 'bf2017.js'), 'utf8')).toContain('rig: true');
  });

  it('joins a figure’s parts per material with --join: three parts in two materials are two draws', { timeout: 10000 }, async () => {
    const draws = (doc) =>
      doc
        .getRoot()
        .listMeshes()
        .reduce((n, m) => n + m.listPrimitives().length, 0);
    expect(draws((await importRig({ parts: true })).doc)).toBe(3);
    const { doc, said } = await importRig({ parts: true }, ['--join']);
    expect(draws(doc)).toBe(2);
    expect(said).toMatch(/2 draws/);
    expect(doc.getRoot().listSkins().length).toBe(1);
  });

  it('holds by the hand’s IK socket where the rig has no weapon socket', { timeout: 10000 }, async () => {
    const { grip } = await importRig({ weapon: false });
    expect(grip.getParentNode().getName()).toBe('IK_Joint_RightHand');
  });
});

describe('a cut over its cap', () => {
  it('is named, against the cap a hero, a light cut and an ultra one each have', async () => {
    const { overCaps } = await import('./bf2017-import.mjs');
    const MB = 1048576;
    expect(overCaps([['plain', 3 * MB], ['lod1', 2 * MB]], { hero: false })).toEqual(['plain: 3.0 MB over 2.5 MB']);
    expect(overCaps([['plain', 3.9 * MB], ['lod1', 2 * MB], ['ultra', 20 * MB]], { hero: true })).toEqual([]);
    expect(overCaps([['plain', 14 * MB]], { hero: true })).toEqual(['plain: 14.0 MB over 4.0 MB']);
    expect(overCaps([['ultra', 25 * MB]], { hero: true })).toEqual(['ultra: 25.0 MB over 24.0 MB']);
    // (a native hero's, the game's own maps: fetched light first, from the bucket)
    expect(overCaps([['plain', 14 * MB], ['lod1', 3.4 * MB], ['ultra', 44 * MB]], { hero: true, native: true })).toEqual([]);
    expect(overCaps([['ultra', 66 * MB]], { hero: true, native: true })).toEqual(['ultra: 66.0 MB over 64.0 MB']);
    expect(overCaps([['plain', 12.8 * MB]], { native: true })).toEqual([]);
  });
});

describe('--textures: a map a shader graph binds', () => {
  it('parses materials to their slots and names, and refuses a slot it has no use for', async () => {
    const { parseTextures, overridePath } = await import('./bf2017-import.mjs');
    const t = parseTextures('ATAT_Head_Layered=color:Gameplay/Vehicles/Ground/AT-AT/texture/T_ATATHead_01_CW,normal:Gameplay/Vehicles/Ground/AT-AT/texture/T_ATATHead_01_N;Legs_Shader=color:A/B/T_Legs_CS');
    expect(Object.keys(t)).toEqual(['ATAT_Head_Layered', 'Legs_Shader']);
    expect(t.ATAT_Head_Layered).toEqual([
      { slot: 'color', name: 'Gameplay/Vehicles/Ground/AT-AT/texture/T_ATATHead_01_CW' },
      { slot: 'normal', name: 'Gameplay/Vehicles/Ground/AT-AT/texture/T_ATATHead_01_N' },
    ]);
    expect(parseTextures('')).toEqual({});
    expect(() => parseTextures('M=roughness:A/T_X')).toThrow(/--textures/);
    // (the bucket's paths: lower case under web/textures, a normal map as the pipeline's derived __normal)
    expect(overridePath('Gameplay/Vehicles/Ground/AT-AT/texture/T_ATATHead_01_CW', 'color')).toBe('web/textures/gameplay/vehicles/ground/at-at/texture/t_atathead_01_cw.ktx2');
    expect(overridePath('Gameplay/Vehicles/Ground/AT-AT/texture/T_ATATHead_01_N', 'normal')).toBe('web/textures/gameplay/vehicles/ground/at-at/texture/t_atathead_01_n__normal.ktx2');
  });
});

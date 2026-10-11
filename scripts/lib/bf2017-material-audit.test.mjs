import { describe, expect, it } from 'vitest';
import { auditPack, summarise } from './bf2017-material-audit.mjs';

const CS = 'Objects/Box/T_Box_CS';
const NAM = 'Objects/Box/T_Box_NAM';
const ktx = (name, normal = false) => `textures/${name.toLowerCase()}${normal ? '__normal' : ''}.ktx2`;

// three meshes: one the game binds as the dump does, one it varies and the
// pack draws as the default, one no variation database lists
const meshes = [
  { name: 'models/objects/box/box_mesh.glb', mats: 1 },
  { name: 'models/objects/lamp/lamp_mesh.glb', mats: 1 },
  { name: 'models/objects/rock/rock_mesh.glb', mats: 2 },
];
const dump = new Map([
  ['objects/box/box_mesh', { materials: [{ textures: { _CS: CS, _NAM_texcoord0: NAM } }] }],
  ['objects/lamp/lamp_mesh', { materials: [{ textures: { _CS: 'Objects/Lamp/T_Lamp_CS' } }] }],
  ['objects/rock/rock_mesh', { materials: [{ textures: {} }, { textures: {} }] }],
]);
const variations = {
  meshes: {
    'objects/box/box_mesh': { default: [{ textures: { _CS: ktx(CS), _NAM_texcoord0: ktx(NAM, true) } }], variations: {}, use: null, by: null },
    'objects/lamp/lamp_mesh': {
      default: [{ textures: { _CS: ktx('Objects/Lamp/T_Lamp_CS') } }],
      variations: { Lamp_Lit: { materials: [{ textures: { _CS: ktx('Objects/Lamp/T_Lamp_CS') }, vectors: { EmissiveIntensety: [1, 1, 1, 1] } }] } },
      use: null,
      by: 'mixed',
      uses: { default: 2, Lamp_Lit: 3 },
    },
  },
  maps: {},
};

describe('auditPack', () => {
  it('names each drawn material bound, default-only or no-entry', () => {
    const rows = auditPack({ meshes, dump, variations });
    expect(rows.map((r) => [r.mesh.split('/').pop(), r.material, r.state])).toEqual([
      ['box_mesh', 0, 'bound'],
      ['lamp_mesh', 0, 'default-only'],
      ['rock_mesh', 0, 'no-entry'],
      ['rock_mesh', 1, 'no-entry'],
    ]);
  });

  it('a slot bound to another texture than the variation database names is not bound, and is named', () => {
    const other = new Map(dump);
    other.set('objects/box/box_mesh', { materials: [{ textures: { _CS: 'Objects/Box/T_Box_Old_CS', _NAM_texcoord0: NAM } }] });
    const [row] = auditPack({ meshes: meshes.slice(0, 1), dump: other, variations });
    expect(row.state).toBe('unbound');
    expect(row.slots).toEqual(['_CS']);
  });

  it('a slot the database names and the dump does not is not bound (the GLB lacks it)', () => {
    const v = structuredClone(variations);
    v.meshes['objects/box/box_mesh'].default[0].textures._RGB = ktx('Objects/Box/T_Box_M');
    const [row] = auditPack({ meshes: meshes.slice(0, 1), dump, variations: v });
    expect(row).toMatchObject({ state: 'unbound', slots: ['_RGB'] });
  });

  it('a texture the bucket lacks is missing-texture (Review Focus 2)', () => {
    const v = structuredClone(variations);
    v.meshes['objects/box/box_mesh'].default[0] = { textures: { _CS: ktx(CS), _NAM_texcoord0: ktx(NAM, true), _RGB: null }, missing: { _RGB: 'Objects/Box/T_Box_M' } };
    const [row] = auditPack({ meshes: meshes.slice(0, 1), dump, variations: v });
    expect(row).toMatchObject({ state: 'missing-texture', slots: ['_RGB Objects/Box/T_Box_M'] });
  });

  it('a texture without a KTX2 that the dump binds too is bound: the export baked it into the GLB', () => {
    const v = structuredClone(variations);
    v.meshes['objects/box/box_mesh'].default[0] = { textures: { _CS: ktx(CS), _NAM_texcoord0: null }, missing: { _NAM_texcoord0: NAM } };
    expect(auditPack({ meshes: meshes.slice(0, 1), dump, variations: v })[0].state).toBe('bound');
  });

  it('an applied variation is bound when its own maps are in the pack, and the instances that use the default only are bound too', () => {
    const v = structuredClone(variations);
    const lamp = v.meshes['objects/lamp/lamp_mesh'];
    lamp.variations.Lamp_Red = { materials: [{ textures: { _CS: ktx('Objects/Lamp/T_Lamp_Red_CS') } }] };
    lamp.use = 'Lamp_Red';
    lamp.by = 'instances';
    v.maps[ktx('Objects/Lamp/T_Lamp_Red_CS')] = 'tex/t_lamp_red_cs.ktx2';
    const [, row] = auditPack({ meshes: meshes.slice(0, 2), dump, variations: v });
    expect(row).toMatchObject({ state: 'bound', variation: 'Lamp_Red' });
    v.maps[ktx('Objects/Lamp/T_Lamp_Red_CS')] = null;
    expect(auditPack({ meshes: meshes.slice(0, 2), dump, variations: v })[1]).toMatchObject({ state: 'unbound', slots: ['_CS'] });
    const plain = structuredClone(variations);
    plain.meshes['objects/lamp/lamp_mesh'].uses = { default: 5 };
    expect(auditPack({ meshes: meshes.slice(0, 2), dump, variations: plain })[1].state).toBe('bound');
  });

  it('a mesh varied with no instance data and no variation applied is default-only (Review Focus 1)', () => {
    const v = structuredClone(variations);
    delete v.meshes['objects/lamp/lamp_mesh'].uses;
    v.meshes['objects/lamp/lamp_mesh'].by = null;
    expect(auditPack({ meshes: meshes.slice(0, 2), dump, variations: v })[1].state).toBe('default-only');
  });
});

describe('summarise', () => {
  it('counts the states and the bound share', () => {
    const s = summarise(auditPack({ meshes, dump, variations }));
    expect(s).toEqual({ materials: 4, bound: 1, 'default-only': 1, 'missing-texture': 0, unbound: 0, 'no-entry': 2, share: 0.25 });
  });
});

describe('auditPack: the default by texture, not by slot name', () => {
  it("an applied variation binding the default's texture under another slot name is bound by the GLB", () => {
    const v = structuredClone(variations);
    const box = v.meshes['objects/box/box_mesh'];
    box.variations.Box_Dyn = { materials: [{ textures: { _BaseColor: ktx(CS), _Normal: ktx(NAM, true) } }] };
    box.use = 'Box_Dyn';
    expect(auditPack({ meshes: meshes.slice(0, 1), dump, variations: v })[0]).toMatchObject({ state: 'bound', variation: 'Box_Dyn' });
  });
});

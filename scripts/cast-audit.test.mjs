import { Document, NodeIO } from '@gltf-transform/core';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { HELD, handSkinCount, skinStep } from '../src/lib/three/held.js';
import { strideOf } from '../src/lib/three/locomotion.js';
import { meshyRig, withHands } from '../src/lib/three/meshyRig.fixture.js';
import { findBones } from '../src/lib/three/rig.js';
import { BODIES, fileOf } from '../src/lib/cast/bodies.js';
import { castCounts, castRows, castTable, failing, rowOf, table } from './cast-audit.mjs';

const lib = { findBones, strideOf, HELD, skinStep };

// a figure as a GLB would have it, read back: the rig's bones, its hands'
// skin (when it has hands), its walk; `pad` more vertices on the hips, after
// the hands' (a body)
async function glb({ without = [], verts = 60, walk = true, pad = 0 } = {}) {
  const rig = withHands(meshyRig({ without }), { verts });
  if (pad) {
    const g = rig.hands.geometry;
    const n = g.attributes.position.count;
    const grow = (a, size, fill) => {
      const out = new a.array.constructor((n + pad) * size).fill(0);
      out.set(a.array);
      for (let i = n; i < n + pad; i++) out[i * size] = fill;
      return out;
    };
    const big = new THREE.BufferGeometry();
    big.setAttribute('position', new THREE.Float32BufferAttribute(grow(g.attributes.position, 3, 0), 3));
    big.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(grow(g.attributes.skinIndex, 4, 0), 4));
    big.setAttribute('skinWeight', new THREE.Float32BufferAttribute(grow(g.attributes.skinWeight, 4, 1), 4));
    rig.hands.geometry = big;
  }
  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene();
  const nodes = new Map();
  const add = (o, parent) => {
    const n = doc.createNode(o.name).setTranslation(o.position.toArray()).setRotation(o.quaternion.toArray()).setScale(o.scale.toArray());
    nodes.set(o, n);
    (parent ?? scene).addChild(n);
    for (const c of o.children) if (c.isBone || c === rig.armature) add(c, n);
  };
  add(rig.armature, null);
  const acc = (a, type) => doc.createAccessor().setArray(a).setType(type).setBuffer(buffer);
  const mesh = rig.hands;
  const bones = mesh.skeleton.bones;
  const g = mesh.geometry;
  if (g.attributes.position.count) {
    const prim = doc
      .createPrimitive()
      .setAttribute('POSITION', acc(new Float32Array(g.attributes.position.array), 'VEC3'))
      .setAttribute('JOINTS_0', acc(new Uint16Array(g.attributes.skinIndex.array), 'VEC4'))
      .setAttribute('WEIGHTS_0', acc(new Float32Array(g.attributes.skinWeight.array), 'VEC4'));
    const ibm = new Float32Array(16 * bones.length);
    mesh.skeleton.boneInverses.forEach((m, j) => ibm.set(m.elements, j * 16));
    const skin = doc.createSkin().setInverseBindMatrices(acc(ibm, 'MAT4'));
    for (const b of bones) skin.addJoint(nodes.get(b));
    scene.addChild(doc.createNode('body').setMesh(doc.createMesh().addPrimitive(prim)).setSkin(skin));
  }
  if (walk) {
    const anim = doc.createAnimation('walk');
    for (const tr of rig.clips.walk.tracks) {
      const [bone] = tr.name.split('.');
      const node = [...nodes].find(([o]) => o.name === bone)?.[1];
      if (!node) continue;
      const sampler = doc.createAnimationSampler().setInput(acc(new Float32Array(tr.times), 'SCALAR')).setOutput(acc(new Float32Array(tr.values), 'VEC4')).setInterpolation('LINEAR');
      anim.addSampler(sampler).addChannel(doc.createAnimationChannel().setTargetNode(node).setTargetPath('rotation').setSampler(sampler));
    }
  }
  const bytes = await new NodeIO().writeBinary(doc);
  return { doc: await new NodeIO().readBinary(bytes), bytes: bytes.byteLength, rig };
}

describe('the cast audit', () => {
  it('reads a Meshy figure’s bones, its hands’ skin, its walk and its stride', async () => {
    const got = await glb();
    const row = rowOf({ name: 'gandalf', file: '/x/gandalf.glb', holds: 'staff' }, got, lib);
    expect(row.bones).toEqual({ hips: true, handR: true, handL: true, toes: true, head: true });
    expect(row.handSkin.r).toBeGreaterThanOrEqual(40);
    expect(row.handSkin.l).toBeGreaterThanOrEqual(40);
    expect(row.clips.own).toEqual(['walk']);
    expect(row.clips.borrowed).toBe(true);
    expect(row.stride).toBe(true);
    expect(row.bytes).toBeGreaterThan(0);
    expect(failing([row], lib)).toEqual([]);
    expect(table([row], 'middleearth')).toMatch(/\| gandalf \| \d+ \| yes \| both \| yes \| yes \| 60 \/ 60 \| walk \| yes \| yes \| staff \|/);
  });

  it('fails a figure that holds something with no hand to hold it, naming it', async () => {
    const got = await glb({ without: ['RightHand', 'LeftHand'], walk: false });
    const row = rowOf({ name: 'gimli', file: '/x/gimli.glb', holds: 'staff' }, got, lib);
    expect(row.bones.handR).toBe(false);
    expect(row.warn).toContain('no hand bone');
    const bad = failing([row], lib);
    expect(bad).toHaveLength(1);
    expect(bad[0].name).toBe('gimli');
    expect(bad[0].why).toMatch(/holds staff/);
    // (holding nothing, the same figure passes with its warning)
    expect(failing([{ ...row, holds: null }], lib)).toEqual([]);
  });

  it('counts a hand’s skin as held.js reads it: on a mesh of over 16,000 vertices, a sample', async () => {
    const got = await glb({ pad: 16000 });
    const row = rowOf({ name: 'troll', file: '/x/troll.glb', holds: 'staff' }, got, lib);
    expect(row.handSkin.r).toBe(handSkinCount(got.rig.model, got.rig.bones.RightHand));
    expect(row.handSkin.l).toBe(handSkinCount(got.rig.model, got.rig.bones.LeftHand));
    expect(row.handSkin.r).toBe(30);
    expect(row.warn).toContain('right hand skin 30');
  });

  it('a two-handed kind needs the other hand too', async () => {
    const row = rowOf({ name: 'tusken', file: '/x/tusken.glb', holds: 'gaffi' }, await glb(), lib);
    expect(failing([row], lib)).toEqual([]);
    const one = { ...row, bones: { ...row.bones, handL: false } };
    expect(failing([one], lib)).toEqual([{ name: 'tusken', why: 'holds gaffi, but its left hand can’t take it (no hand bone)' }]);
    const thin = { ...row, handSkin: { r: 60, l: 12 }, forearm: { r: true, l: false } };
    expect(failing([thin], lib)[0].why).toMatch(/holds gaffi, but its left hand can’t take it \(12 vertices, no forearm\)/);
    // a one-handed kind asks nothing of the other
    expect(failing([{ ...one, holds: 'staff' }], lib)).toEqual([]);
  });

  it('a hand with little skin but a forearm warns and passes; a missing file fails', async () => {
    const got = await glb({ verts: 20 });
    const row = rowOf({ name: 'legolas', file: '/x/legolas.glb', holds: 'bow' }, got, lib);
    expect(row.handSkin.l).toBe(20);
    expect(row.warn).toContain('left hand skin 20');
    expect(failing([row], lib)).toEqual([]);
    const gone = rowOf({ name: 'frodo', file: '/x/frodo.glb' }, { doc: null }, lib);
    expect(failing([gone], lib)).toEqual([{ name: 'frodo', why: 'missing /x/frodo.glb' }]);
  });
});

describe('the cast table’s audit', () => {
  // one of each: the game’s, a mod’s, a site’s with nothing to replace it and
  // more faces, and a site’s that could be replaced
  const ROWS = {
    trooper: { url: '/models/galaxy/bf2017/crew/trooper.glb', tall: 1.83, rig: 'walrus', source: 'game' },
    hero: { url: '/models/galaxy/bf2017/crew/hero.glb', tall: 1.8, rig: 'walrus', source: 'mod:expanded' },
    knight: { url: '/x/knight.glb', tall: 1.75, faces: [{ url: '/x/knight2.glb', tall: 1.8 }], source: 'site', could: null },
    alien: { name: 'alien', tall: 1.7, source: 'site', could: 'the game’s alien | not imported yet' },
  };

  it('lists every kind with its source, file and could, then the counts', () => {
    const rows = castRows(ROWS, fileOf);
    expect(rows.map((r) => r.kind)).toEqual(['trooper', 'hero', 'knight', 'alien']);
    expect(rows[2]).toEqual({ kind: 'knight', source: 'site', file: '/x/knight.glb', faces: 1, could: null });
    expect(castCounts(rows)).toEqual({ kinds: 4, by: { game: 1, 'mod:expanded': 1, site: 2 }, site: 2, could: 1 });
    const md = castTable(rows);
    expect(md).toMatch(/\| trooper \| game \| \/models\/galaxy\/bf2017\/crew\/trooper\.glb \| {2}\|/);
    expect(md).toMatch(/\| knight \| site \| \/x\/knight\.glb and 1 more face \| — \(none has it\) \|/);
    // (a bar in a note can’t end its cell)
    expect(md).toMatch(/\| alien \| site \| \/models\/galaxy\/crew\/alien\.glb \| the game’s alien \\\| not imported yet \|/);
    expect(md).toMatch(/4 kinds: 1 game, 1 mod:expanded, 2 site\./);
    expect(md).toMatch(/Site rows with a `could`: 1 of 2\./);
  });

  it('counts the site’s own table, every kind once', () => {
    const c = castCounts(castRows(BODIES, fileOf));
    expect(c.kinds).toBe(Object.keys(BODIES).length);
    expect(Object.values(c.by).reduce((a, b) => a + b, 0)).toBe(c.kinds);
    expect(c.could).toBeLessThanOrEqual(c.site);
  });
});

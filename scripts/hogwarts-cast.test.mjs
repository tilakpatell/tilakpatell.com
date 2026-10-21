// hogwarts-cast.mjs's pure parts: the table's words, the task state, the
// manifest and the credits. (The steps themselves run on the desktop's GPU.)
import { Document } from '@gltf-transform/core';
import { describe, expect, it } from 'vitest';
import { FIGURES, LOOK, NAMES_NEVER, POSE, prompt } from './hogwarts-cast-figures.mjs';
import { clean, CLIPS_CREDIT, credit, CUTS, due, manifest, matte, only, record, smooth } from './hogwarts-cast.mjs';

describe('the figures’ words', () => {
  it.each(Object.keys(FIGURES))('%s is described by its look, never by a name', (name) => {
    const p = prompt(name);
    expect(p).not.toMatch(NAMES_NEVER);
    expect(() => clean(name)).not.toThrow();
    expect(p).toContain(POSE);
    expect(p).toContain('an oversized round head about a third of the whole height');
  });

  it('turns a name down before it reaches the picture step', () => {
    FIGURES.x = { height: 1, kind: 'student', look: 'A boy who looks like Harry Potter.' };
    try {
      expect(() => clean('x')).toThrow(/name someone \("Harry"\)/);
    } finally {
      delete FIGURES.x;
    }
  });

  it('gives every figure a height, and the giant the tall mark', () => {
    for (const [name, f] of Object.entries(FIGURES)) {
      expect(f.height, name).toBeGreaterThan(0.5);
      expect(f.height, name).toBeLessThan(3);
    }
    expect(FIGURES.hagrid).toMatchObject({ height: 2.6, tall: true });
    expect(LOOK('a huge body')).toContain('a huge body');
  });
});

describe('the task state', () => {
  it('makes a step again only when what it’s made from has changed, or when asked', () => {
    const s = {};
    expect(due(s, 'harry', 'bake', 'k1')).toBe(true);
    record(s, 'harry', 'bake', 'k1', { seconds: 140 });
    expect(s.harry.bake).toMatchObject({ key: 'k1', seconds: 140 });
    expect(due(s, 'harry', 'bake', 'k1')).toBe(false);
    expect(due(s, 'harry', 'bake', 'k2')).toBe(true);
    expect(due(s, 'harry', 'bake', 'k1', { fresh: true })).toBe(true);
    expect(due(s, 'ron', 'bake', 'k1')).toBe(true);
  });

  it('reads --only, and refuses a figure the table hasn’t', () => {
    expect(only('harry, ron')).toEqual(['harry', 'ron']);
    expect(only(undefined)).toEqual(Object.keys(FIGURES));
    expect(() => only('harry,voldemort')).toThrow(/voldemort/);
  });
});

describe('what ships', () => {
  it('lists in cast.json only the figures cut, each with its height, its cuts and its clips', () => {
    const m = manifest({ harry: { cut: { key: 'k' }, skin: { hipsY: 48.2 } }, hagrid: { cut: { key: 'k' } }, ron: { bake: { key: 'k' } } });
    expect(Object.keys(m.figures)).toEqual(['harry', 'hagrid']);
    expect(m.figures.harry).toMatchObject({ height: 1.45, kind: 'student', house: 'gryffindor', hipsY: 48.2, cuts: { hq: 'harry.hq.glb', mid: 'harry.glb', lo: 'harry.lo.glb' }, clips: { idle: 'harry-idle.glb', walk: 'harry-walk.glb', run: 'harry-run.glb' } });
    expect(m.figures.harry.tall).toBeUndefined();
    expect(m.figures.hagrid).toMatchObject({ height: 2.6, tall: true });
    expect(m.about).toMatch(/forFigure/);
  });

  it('credits each figure as made here from a concept picture, and the clips once', () => {
    const c = credit('hermione');
    expect(c.name).toMatch(/^Hermione, a big-headed toy figure/);
    expect(c.name).toMatch(/concept picture/);
    expect(c.name).toMatch(/scripts\/hogwarts-cast\.mjs/);
    expect(c.license).toBeTruthy();
    // (the folder named, so the clips beside every figure are covered by it: scripts/ai-e2e/assets/credits.mjs)
    expect(CLIPS_CREDIT.name).toContain('public/models/hogwarts/cast/');
    expect(CLIPS_CREDIT.license).toBe('CC0 1.0');
  });

  it('cuts each tier smaller than the one above it', () => {
    expect(CUTS.hq.faces).toBeGreaterThan(CUTS.mid.faces);
    expect(CUTS.mid.faces).toBeGreaterThan(CUTS.lo.faces);
    expect(CUTS.hq.tex).toBeGreaterThanOrEqual(CUTS.mid.tex);
    expect(CUTS.mid.tex).toBeGreaterThan(CUTS.lo.tex);
    expect([CUTS.hq.suffix, CUTS.mid.suffix, CUTS.lo.suffix]).toEqual(['.hq', '', '.lo']);
  });
});

describe('the paint and the normals', () => {
  function quad() {
    const doc = new Document();
    const buf = doc.createBuffer();
    // two triangles meeting at a fold, the fold's vertices split (a UV seam)
    const pos = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 1, 1]);
    const prim = doc
      .createPrimitive()
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(pos).setBuffer(buf))
      .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint16Array([0, 1, 2, 3, 5, 4])).setBuffer(buf));
    const mat = doc.createMaterial('m').setMetallicFactor(1).setRoughnessFactor(0.2);
    mat.setMetallicRoughnessTexture(doc.createTexture('mr')).setNormalTexture(doc.createTexture('n')).setBaseColorTexture(doc.createTexture('c'));
    prim.setMaterial(mat);
    doc.createMesh('q').addPrimitive(prim);
    return doc;
  }

  it('keeps the colour and makes the rest matte', () => {
    const doc = matte(quad());
    const [m] = doc.getRoot().listMaterials();
    expect(m.getMetallicFactor()).toBe(0);
    expect(m.getRoughnessFactor()).toBeCloseTo(0.85);
    expect(m.getMetallicRoughnessTexture()).toBeNull();
    expect(m.getNormalTexture()).toBeNull();
    expect(m.getBaseColorTexture()?.getName()).toBe('c');
    expect(doc.getRoot().listTextures().map((t) => t.getName())).toEqual(['c']);
  });

  it('gives a seam’s two sides one normal, the faces’ round it', () => {
    const doc = smooth(quad());
    const n = doc.getRoot().listMeshes()[0].listPrimitives()[0].getAttribute('NORMAL');
    const at = (i) => n.getElement(i, []);
    // vertex 1 and 3 are one place: the same normal, between the two faces'
    expect(at(1)).toEqual(at(3));
    expect(Math.hypot(...at(1))).toBeCloseTo(1, 5);
    expect(at(0)).toEqual([0, 0, 1]);
  });
});

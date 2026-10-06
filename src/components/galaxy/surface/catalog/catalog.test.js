import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import CREDITS from '../../../../data/modelCredits.json';
import { GROUPS, SURFACE_MODELS, madeKinds, surfaceLodUrl, surfaceUrl } from './index';

const file = (kind) => new URL(`../../../../../public${surfaceUrl(kind)}`, import.meta.url);
const lodFile = (kind) => new URL(`../../../../../public${surfaceLodUrl(kind)}`, import.meta.url);
const README = readFileSync(new URL('../../../../../public/cc0/README.md', import.meta.url), 'utf8');
const MB = 1024 * 1024;

describe('the surface models', () => {
  it('names each kind once, across the groups', () => {
    const all = Object.values(GROUPS).flatMap((m) => Object.keys(m));
    expect(new Set(all).size).toBe(all.length);
    for (const kind of all) expect(kind, kind).toMatch(/^[a-z0-9]+$/);
  });

  it('has each one brought in, small enough, with what the import needs', () => {
    for (const [kind, m] of Object.entries(SURFACE_MODELS)) {
      expect(m.as, kind).toBeTruthy();
      expect(m.metres, kind).toBeGreaterThan(0);
      expect(['x', 'y', 'z', 'max', undefined], kind).toContain(m.along);
      expect(existsSync(file(kind)), `${kind}.glb`).toBe(true);
      expect(statSync(file(kind)).size, `${kind}.glb`).toBeLessThan((m.hero ? 4 : 2.5) * MB);
    }
  });

  it('credits each Sketchfab model, and lists each made one', () => {
    const made = madeKinds(README);
    for (const [kind, m] of Object.entries(SURFACE_MODELS)) {
      if (m.made) {
        expect(m.made, kind).toBe('meshy');
        expect(m.uid, kind).toBeUndefined();
        expect(made.has(kind), `${kind} in public/cc0/README.md`).toBe(true);
      } else {
        expect(m.uid, kind).toMatch(/^[0-9a-f]{32}$/);
        expect(CREDITS[`surface-${kind}`]?.file, `${kind}'s credit`).toBe(surfaceUrl(kind));
      }
    }
  });

  it('reads the made kinds from the README list', () => {
    expect([...madeKinds('x `../models/galaxy/surface/{theed,palace}.glb`: made')]).toEqual(['theed', 'palace']);
    expect(madeKinds('nothing here').size).toBe(0);
  });

  it('has a light model beside each one marked lod, and only those (scripts/galaxy-surface-lod.mjs)', () => {
    for (const [kind, m] of Object.entries(SURFACE_MODELS)) {
      expect(existsSync(lodFile(kind)), `${kind}.lod1.glb`).toBe(Boolean(m.lod));
      if (m.lod) expect(statSync(lodFile(kind)).size, `${kind}.lod1.glb`).toBeLessThan(0.7 * statSync(file(kind)).size);
    }
    const dir = new URL('../../../../../public/models/galaxy/surface/', import.meta.url);
    for (const f of readdirSync(dir).filter((f) => f.endsWith('.lod1.glb'))) expect(SURFACE_MODELS[f.slice(0, -9)]?.lod, f).toBe(true);
  });
});

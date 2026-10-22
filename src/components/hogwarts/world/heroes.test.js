import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { COMMIT_BYTES, HEROES, fileOf, placement, tierFor } from './heroes';

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const manifest = JSON.parse(readFileSync(join(ROOT, 'public', 'models', 'hogwarts', 'models.json'), 'utf8'));

describe('the hero models’ list', () => {
  it('names a cut’s file beside the plain one', () => {
    expect(fileOf('castle', 'mid')).toBe('/models/hogwarts/castle/castle.glb');
    expect(fileOf('castle', 'hq')).toBe('/models/hogwarts/castle/castle.hq.glb');
    expect(fileOf('willow', 'lo')).toBe('/models/hogwarts/props/willow.lo.glb');
  });

  it('sets a model to its size, its footprint’s middle on the origin and its foot on y = 0', () => {
    const { s, offset } = placement({ min: [-1, 2, -3], max: [3, 6, 1] }, { along: 'y', metres: 8 });
    expect(s).toBe(2);
    expect(offset).toEqual([-2, -4, 2]);
  });

  it('steps down to a tier the model has and the site can reach', () => {
    expect(tierFor('castle', 'ultra')).toBe('ultra');
    expect(tierFor('boat', 'high')).toBe('mid');
    expect(tierFor('castle', 'ultra', { has: (f) => !f.includes('.ultra') })).toBe('hq');
    expect(tierFor('boat', 'low')).toBe('lo');
  });

  it('says what each is, where it came from and how big it stands', () => {
    for (const [name, spec] of Object.entries(HEROES)) {
      expect(spec.what.length, name).toBeGreaterThan(20);
      expect(['meshy', 'gen3d', 'sketchfab'], name).toContain(spec.made);
      if (spec.made === 'sketchfab') expect(spec.uid, name).toMatch(/^[0-9a-f]{32}$/);
      expect(spec.size.metres, name).toBeGreaterThan(0);
    }
  });
});

describe('what the cut wrote', () => {
  it('has every model the list has, cut at every tier it asks for', () => {
    for (const [name, spec] of Object.entries(HEROES)) {
      expect(manifest[name], name).toBeDefined();
      expect(Object.keys(manifest[name].cuts).sort(), name).toEqual(Object.keys(spec.cuts).sort());
    }
  });

  it('keeps every committed cut on disk and under the size git takes', () => {
    for (const [name, { cuts }] of Object.entries(manifest))
      for (const cut of Object.values(cuts)) {
        if (cut.bucket) continue;
        const file = join(ROOT, 'public', cut.file);
        expect(existsSync(file), `${name}: ${cut.file}`).toBe(true);
        expect(statSync(file).size, cut.file).toBeLessThanOrEqual(COMMIT_BYTES);
      }
  });
});

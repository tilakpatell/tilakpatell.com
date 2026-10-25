import { describe, expect, it } from 'vitest';
import { hedgeGeo, wheatGeo } from '../../shire/build';
import { hedgeBlock, wheatClump } from './shireLight';

const tris = (g) => (g.index ? g.index.count : g.attributes.position.count) / 3;
const box = (g) => {
  g.computeBoundingBox();
  return g.boundingBox;
};

describe('the Shire’s pieces drawn lighter for the Road', () => {
  for (const [name, light, chapter] of [
    ['wheat clump', wheatClump(), wheatGeo()],
    ['metre of hedge', hedgeBlock(), hedgeGeo()],
  ]) {
    it(`the ${name} is half the chapter’s triangles or less`, () => {
      expect(tris(light)).toBeLessThanOrEqual(tris(chapter) / 2);
    });
    it(`the ${name} stands as tall, wide and deep as the chapter’s, its colour in its vertices`, () => {
      const [a, b] = [box(light), box(chapter)];
      for (const k of ['x', 'y', 'z']) {
        expect(a.max[k]).toBeCloseTo(b.max[k], 1);
        expect(a.min[k]).toBeCloseTo(b.min[k], 1);
      }
      expect(light.attributes.color).toBeTruthy();
    });
  }
});

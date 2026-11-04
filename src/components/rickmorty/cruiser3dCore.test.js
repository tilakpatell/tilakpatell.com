import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildCruiserWith } from './cruiser3dCore';

// a cast that keeps a list of what it owns, as meshyCastCore's does: each
// figure made adds what's its alone (a line, a clone's shirt), and its
// release() takes that off again
const fakeCast = () => {
  const owned = [];
  const cast = {
    owned,
    made: 0,
    load: async () => {},
    prop: () => {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.BoxGeometry(2.7, 1.7, 2.7), new THREE.MeshBasicMaterial()));
      return g;
    },
    make: (kind) => {
      cast.made += 1;
      const mine = [{ kind, line: true }];
      owned.push(...mine);
      const group = new THREE.Group();
      return {
        group,
        height: 1.7,
        base: null,
        update() {},
        release() {
          for (const m of mine) owned.splice(owned.indexOf(m), 1);
          mine.length = 0;
        },
      };
    },
    dispose() {},
  };
  return cast;
};

const pen = { createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, set fillStyle(v) {} };
let had;
beforeEach(() => {
  had = globalThis.document;
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => pen }) };
});
afterEach(() => {
  globalThis.document = had;
});

const paintWith = (cast) => ({
  createMeshyCast: () => cast,
  inkHull: () => ({ dispose() {} }),
  glassDome: () => 1,
  dress: () => () => {},
});
const LOOKS = { rick: { body: 'rick' }, morty: { body: 'morty' } };

describe('the cruiser’s cast, kept for the page’s life', () => {
  it('is made once for every cruiser built with one paint', async () => {
    const cast = fakeCast();
    let casts = 0;
    const paint = { ...paintWith(cast), createMeshyCast: () => (casts++, cast) };
    const build = buildCruiserWith(paint);
    (await build({ looks: LOOKS })).dispose();
    (await build({ looks: LOOKS })).dispose();
    expect(casts).toBe(1);
  });

  it('is left as it was found by a cruiser built and disposed: its crew’s own things freed', async () => {
    const cast = fakeCast();
    const build = buildCruiserWith(paintWith(cast));
    const c = await build({ looks: LOOKS });
    expect(cast.made).toBe(2);
    expect(cast.owned).toHaveLength(2);
    c.dispose();
    expect(cast.owned).toHaveLength(0);
  });

  it('frees the crew member a new look takes the place of', async () => {
    const cast = fakeCast();
    const build = buildCruiserWith(paintWith(cast));
    const c = await build({ looks: LOOKS });
    await c.setLooks({ ...LOOKS, morty: { body: 'morty', hat: 'cap' } });
    expect(cast.made).toBe(3);
    expect(cast.owned).toHaveLength(2);
    c.dispose();
    expect(cast.owned).toHaveLength(0);
  });
});

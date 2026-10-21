// Every place's world record (./worlds.js), held to the rules
// (./worldRules.js) against the place it's for, and every crowd kind's
// triangles to the model's own file.
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TRIS, WORLDS } from './worlds';
import { BLOCKS } from './blocks';
import { blocksSight, worldProblems } from './worldRules';
import { LEVELS, outskirtsOf } from './outskirts';
import { destinationById } from './destinations';
import { MESHY, assetUrl } from '../../portal/meshyCastCore';
import { TASKS } from '../rules';

// a GLB's triangles, from its header (its index counts)
function trianglesIn(path) {
  const b = readFileSync(path);
  const len = b.readUInt32LE(12);
  const j = JSON.parse(b.subarray(20, 20 + len).toString('utf8'));
  let t = 0;
  for (const m of j.meshes ?? []) for (const p of m.primitives) t += Math.floor(j.accessors[p.indices ?? p.attributes.POSITION].count / 3);
  return t;
}
const fileOf = (kind) => (kind.startsWith('crowd:') ? `public/games/meshy/crowd/${kind.slice(6)}.glb` : `public${assetUrl(MESHY[kind].a)}`);
const TASK_IDS = TASKS.map((t) => t.id);

describe('the worlds round the places', () => {
  it('count each crowd kind’s triangles as its model has them', () => {
    for (const [kind, n] of Object.entries(TRIS)) {
      const path = fileOf(kind);
      expect(existsSync(path), path).toBe(true);
      expect(Math.abs(trianglesIn(path) - n) / n, kind).toBeLessThan(0.01);
    }
  });

  it('are each for a place there is, and keep the rules', () => {
    for (const [id, world] of Object.entries(WORLDS)) {
      const d = destinationById(id);
      expect(d, id).toBeTruthy();
      expect(worldProblems(d, world, { tris: TRIS, tasks: TASK_IDS, blocks: BLOCKS[id] ?? [] }), id).toEqual([]);
    }
  });

  it('stand their models from files there are', () => {
    for (const [id, world] of Object.entries(WORLDS)) {
      const models = [...['n', 'e', 's', 'w'].flatMap((s) => (world.ring?.[s]?.sets ?? []).map((x) => x.model)), ...(world.fliers ?? []).map((f) => f.model), ...(world.pieces ?? []).map((p) => p.model)];
      for (const m of models) expect(existsSync(`public${m}`), `${id}: ${m}`).toBe(true);
    }
  });

  it('keep each place’s crowd within its level’s triangles, everywhere, on every level', () => {
    for (const [id, world] of Object.entries(WORLDS)) {
      const d = destinationById(id);
      for (const tier of ['high', 'mid', 'low']) {
        const L = outskirtsOf(d, world, { tier, fogFar: 300, tris: TRIS });
        const sum = [...L.walkers, ...L.gathers].reduce((a, c) => a + c.n * Math.max(...c.kinds.map((k) => TRIS[k])), 0);
        expect(sum, `${id} ${tier}`).toBeLessThanOrEqual(d.kind === 'room' ? LEVELS[tier].crowd / 2 : LEVELS[tier].crowd);
      }
    }
  });

  it('leave clear the sight lines a place says it keeps (the heads, from the mic)', () => {
    for (const [id, world] of Object.entries(WORLDS)) {
      const d = destinationById(id);
      for (const tier of ['high', 'mid', 'low']) {
        const L = outskirtsOf(d, world, { tier, fogFar: 320, tris: TRIS });
        for (const { from, to } of world.sight ?? []) {
          const W = ([dx, y, dz]) => [d.centre.x + dx, y, d.centre.z + dz];
          expect(blocksSight(L, W(from), W(to)), `${id} ${tier}`).toBe(false);
        }
      }
    }
  });
});

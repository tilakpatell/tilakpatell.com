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
import { standAt } from './crowdPose';
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

  it('stand no one of a place’s crowd inside a building round it, and no building in another, on any level', () => {
    // (a footprint as drawn, turned a quarter at a time, grown by `pad`)
    const box = (l, pad = 0) => {
      const across = Math.abs(Math.sin(l.turn ?? 0)) > 0.5;
      return { x: l.x, z: l.z, hw: (across ? l.d : l.w) / 2 + pad, hd: (across ? l.w : l.d) / 2 + pad };
    };
    const inBox = (b, x, z) => Math.abs(x - b.x) < b.hw && Math.abs(z - b.z) < b.hd;
    const meet = (a, b) => Math.abs(a.x - b.x) < a.hw + b.hw && Math.abs(a.z - b.z) < a.hd + b.hd;
    const bad = [];
    for (const [id, world] of Object.entries(WORLDS)) {
      const d = destinationById(id);
      for (const tier of ['high', 'mid', 'low']) {
        const L = outskirtsOf(d, world, { tier, fogFar: 300, tris: TRIS });
        const grounded = L.lots.filter((l) => (l.y ?? 0) < 20 && (l.w || l.d));
        const buildings = [...grounded.filter((l) => !l.stand), ...L.skyline.map((s) => ({ ...s, turn: 0 }))];
        for (const g of L.gathers.filter((c) => c.out && !c.key.startsWith('stand-')))
          for (let j = 0; j < g.n; j++) {
            const p = standAt(g, j);
            const inside = buildings.find((b) => inBox(box(b, 0.3), p.x, p.z));
            if (inside) bad.push(`${id} ${tier}: ${g.key} #${j} inside a ${inside.style ?? 'skyline'} at ${inside.x.toFixed(1)}, ${inside.z.toFixed(1)}`);
          }
        const ring = grounded.filter((l) => l.side);
        for (const o of grounded.filter((l) => !l.side))
          for (const l of ring) if (meet(box(o), box(l))) bad.push(`${id} ${tier}: a ${l.style} of the ring in the ${o.stand ? 'stand' : o.piece ? 'piece' : 'landmark'} at ${o.x.toFixed(1)}, ${o.z.toFixed(1)}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('lay the forecourt’s props off everyone’s way round, and the same on every level', () => {
    // (from a point to a closed route, sampled every quarter metre)
    const toRoute = (pts, x, z) => {
      let best = Infinity;
      for (let i = 0; i < pts.length; i++) {
        const [ax, az] = pts[i];
        const [bx, bz] = pts[(i + 1) % pts.length];
        const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.25));
        for (let k = 0; k <= n; k++) best = Math.min(best, Math.hypot(ax + ((bx - ax) * k) / n - x, az + ((bz - az) * k) / n - z));
      }
      return best;
    };
    const bad = [];
    for (const [id, world] of Object.entries(WORLDS)) {
      const d = destinationById(id);
      const A = d.area;
      const routes = [...d.people, ...d.extras].filter((p) => p.ai?.wander).map((p) => p.ai.wander);
      const loops = (world.crowd?.walk ?? []).filter((c) => Array.isArray(c.loop)).map((c) => c.loop.map(([dx, dz]) => [d.centre.x + dx, d.centre.z + dz]));
      const inBox = (p) => p.x >= A.x0 && p.x <= A.x1 && p.z >= A.z0 && p.z <= A.z1;
      const laid = {};
      for (const tier of ['high', 'mid', 'low']) {
        const props = outskirtsOf(d, world, { tier, fogFar: 300, tris: TRIS }).props.filter(inBox);
        laid[tier] = props.map((p) => `${p.model} ${p.x.toFixed(2)} ${p.z.toFixed(2)}`).join('; ');
        for (const p of props) for (const r of [...routes, ...loops]) if (toRoute(r, p.x, p.z) < 1) bad.push(`${id} ${tier}: ${p.model} at ${p.x.toFixed(1)}, ${p.z.toFixed(1)} is ${toRoute(r, p.x, p.z).toFixed(2)} m off a way round`);
      }
      if (laid.high !== laid.mid || laid.mid !== laid.low) bad.push(`${id}: the forecourt moves between levels`);
    }
    expect(bad).toEqual([]);
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

// Where a stage's draws and triangles go (Task 34's budgets): each stage
// opened by its address, the walkers given 6 s to arrive, then one frame's
// render calls caught (the shadow cascades, the scene pass, the post) with
// the draws and triangles each added, and the scene's shown meshes in the
// camera's frustum summed by the nearest named ancestor, heaviest first.
// Development only: a dev server up (BASE).
//
//   node lab/road/probe-tris.mjs [stage ...]   (QUALITY=low|high, TOP=20)
import { browser, open, STAGE_IDS } from './common.mjs';

const picked = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const ids = picked.length ? picked : STAGE_IDS;
const top = Number(process.env.TOP ?? 20);
const b = await browser();
for (const id of ids) {
  const { ctx, page } = await open(b, `/middle-earth/road?at=${id}`);
  await page.waitForTimeout(6000);
  const out = await page.evaluate(async (top) => {
    const world = window.__ROAD__.world;
    const draw = world.draw;
    const passes = [];
    let caught = null;
    await new Promise((done) => {
      world.draw = (a) => {
        world.draw = draw;
        const r = a.renderer;
        const render = r.render;
        r.render = function (scene, camera) {
          const i = r.info.render;
          const t0 = i.triangles, c0 = i.drawCalls ?? i.calls;
          const v = render.apply(this, arguments);
          passes.push({ scene: scene.name || scene.type, camera: camera.name || camera.type, triangles: i.triangles - t0, calls: (i.drawCalls ?? i.calls) - c0 });
          if (!caught && scene.isScene && camera.isPerspectiveCamera && scene.children.length > 4) caught = { scene, camera };
          return v;
        };
        const v = draw.call(world, a);
        r.render = render;
        done();
        return v;
      };
    });
    const by = new Map();
    if (caught) {
      const { scene, camera } = caught;
      camera.updateMatrixWorld();
      const m = camera.projectionMatrix.clone().multiply(camera.matrixWorldInverse);
      const e = m.elements;
      // the frustum's six planes from the matrix, by hand (no three import here)
      const planes = [[e[3] - e[0], e[7] - e[4], e[11] - e[8], e[15] - e[12]], [e[3] + e[0], e[7] + e[4], e[11] + e[8], e[15] + e[12]], [e[3] + e[1], e[7] + e[5], e[11] + e[9], e[15] + e[13]], [e[3] - e[1], e[7] - e[5], e[11] - e[9], e[15] - e[13]], [e[3] - e[2], e[7] - e[6], e[11] - e[10], e[15] - e[14]], [e[3] + e[2], e[7] + e[6], e[11] + e[10], e[15] + e[14]]].map(([a, b2, c, d]) => {
        const l = Math.hypot(a, b2, c);
        return [a / l, b2 / l, c / l, d / l];
      });
      const shown = (o) => {
        for (let p = o; p; p = p.parent) if (!p.visible) return false;
        return true;
      };
      const label = (o) => {
        const path = [];
        for (let p = o; p && p !== scene; p = p.parent) if (p.name) path.push(p.name);
        return path.slice(0, 2).reverse().join(' / ') || `(${o.type} ${o.material?.name || o.material?.type || ''})`;
      };
      scene.traverse((o) => {
        if (!(o.isMesh || o.isPoints || o.isLine) || !shown(o)) return;
        const g = o.geometry;
        if (!g) return;
        const n = g.index ? g.index.count : g.attributes.position?.count ?? 0;
        const count = o.isInstancedMesh ? o.count : o.isBatchedMesh ? 1 : g.instanceCount ?? 1;
        const tris = (o.isMesh ? n / 3 : 0) * (Number.isFinite(count) ? count : 1);
        let inside = true;
        if (o.frustumCulled !== false && !o.isInstancedMesh && !o.isSkinnedMesh) {
          if (!g.boundingSphere) g.computeBoundingSphere();
          const s = g.boundingSphere.clone().applyMatrix4(o.matrixWorld);
          inside = planes.every(([a, b2, c, d]) => a * s.center.x + b2 * s.center.y + c * s.center.z + d > -s.radius);
        }
        if (!inside) return;
        const k = label(o);
        const row = by.get(k) ?? { label: k, tris: 0, draws: 0 };
        row.tris += tris;
        row.draws += 1;
        by.set(k, row);
      });
    }
    const rows = [...by.values()].sort((a, c) => c.tris - a.tris);
    const sum = rows.reduce((a, r) => ({ tris: a.tris + r.tris, draws: a.draws + r.draws }), { tris: 0, draws: 0 });
    return { passes, rows: rows.slice(0, top), sum };
  }, top);
  console.log(`\n## ${id}`);
  for (const p of out.passes) console.log(`pass ${p.scene} ${p.camera}: ${p.calls} draws, ${p.triangles.toLocaleString('en-GB')} triangles`);
  console.log(`scene pass, shown in the frustum: ${out.sum.draws} meshes, ${Math.round(out.sum.tris).toLocaleString('en-GB')} triangles`);
  for (const r of out.rows) console.log(`  ${Math.round(r.tris).toLocaleString('en-GB').padStart(10)}  ${String(r.draws).padStart(4)}  ${r.label}`);
  await ctx.close();
}
await b.close();

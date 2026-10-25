// Where a stage's draws and triangles go (Task 34's budgets): each stage
// opened by its address, the walkers given 6 s to arrive, then one frame's
// render calls caught (the shadow cascades, the scene pass, the post) with
// the draws and triangles each added, and the scene pass's own draws as
// the renderer makes them, summed by the nearest named ancestor, heaviest
// first.
// Development only: a dev server up (BASE).
//
//   node lab/road/probe-tris.mjs [stage ...]   (QUALITY=low|high, TOP=20, DETAIL=1 for each mesh)
import { browser, open, STAGE_IDS } from './common.mjs';

const picked = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const ids = picked.length ? picked : STAGE_IDS;
const top = Number(process.env.TOP ?? 20);
const detail = process.env.DETAIL === '1';
const b = await browser();
for (const id of ids) {
  const { ctx, page } = await open(b, `/middle-earth/road?at=${id}`);
  await page.waitForTimeout(6000);
  const out = await page.evaluate(async ({ top, detail }) => {
    const world = window.__ROAD__.world;
    const draw = world.draw;
    const passes = [];
    const by = new Map();
    const label = (o, scene) => {
      const path = [];
      for (let p = o; p && p !== scene; p = p.parent) if (p.name) path.push(p.name);
      const head = path.slice(0, 2).reverse().join(' / ') || `(${o.type} ${o.material?.name || o.material?.type || ''})`;
      return detail ? `${head} :: ${o.name || o.material?.name || o.type}${o.isInstancedMesh ? ` ×${o.count}` : ''}` : head;
    };
    await new Promise((done) => {
      world.draw = (a) => {
        world.draw = draw;
        const r = a.renderer;
        const render = r.render;
        const direct = r._renderObjectDirect;
        let inScene = false;
        let depth = 0;
        // (each draw of the scene pass, as the renderer makes it: what the
        // frustum left in, and a two-sided transparent material's two draws)
        r._renderObjectDirect = function (object, material, scene, camera, lightsNode, group, clippingContext, passId) {
          if (inScene) {
            const g = object.geometry;
            const n = g.index ? g.index.count : g.attributes.position?.count ?? 0;
            const count = object.isInstancedMesh ? object.count : g.isInstancedBufferGeometry ? g.instanceCount : 1;
            const tris = object.isMesh ? (Math.min(n, g.drawRange.count) / 3) * (Number.isFinite(count) ? count : 1) : 0;
            const k = `${depth > 1 ? 'shadow' : 'scene '}  ${label(object, scene)}${detail && material.side === 2 ? ' (two-sided)' : ''}`;
            const row = by.get(k) ?? { label: k, tris: 0, draws: 0 };
            row.tris += tris;
            row.draws += 1;
            by.set(k, row);
          }
          return direct.apply(this, arguments);
        };
        r.render = function (scene, camera) {
          const i = r.info.render;
          const t0 = i.triangles, c0 = i.drawCalls ?? i.calls;
          const main = scene.isScene && camera.isPerspectiveCamera && scene.children.length > 4 && !passes.some((p) => p.main);
          // (a render inside the scene pass, a probe's or a reflection's, keeps it the scene pass's)
          const was = inScene;
          inScene = main || was;
          depth += inScene ? 1 : 0;
          const v = render.apply(this, arguments);
          depth -= inScene ? 1 : 0;
          inScene = was;
          passes.push({ main, nested: was, target: r.getRenderTarget()?.texture?.name || (r.getRenderTarget() ? `${r.getRenderTarget().width}×${r.getRenderTarget().height}` : null), scene: scene.name || scene.type, camera: camera.name || camera.type, triangles: i.triangles - t0, calls: (i.drawCalls ?? i.calls) - c0 });
          return v;
        };
        const v = draw.call(world, a);
        r.render = render;
        delete r._renderObjectDirect;
        done();
        return v;
      };
    });
    const rows = [...by.values()].sort((a, c) => c.tris - a.tris);
    const sum = rows.reduce((a, r) => ({ tris: a.tris + r.tris, draws: a.draws + r.draws }), { tris: 0, draws: 0 });
    return { passes, rows: rows.slice(0, top), sum };
  }, { top, detail });
  console.log(`\n## ${id}`);
  for (const p of out.passes) console.log(`pass ${p.nested ? '(inside the scene pass) ' : ''}${p.scene} ${p.camera}${p.target ? ` → ${p.target}` : ''}: ${p.calls} draws, ${p.triangles.toLocaleString('en-GB')} triangles`);
  console.log(`the scene pass and its cascades, draw by draw: ${out.sum.draws} draws, ${Math.round(out.sum.tris).toLocaleString('en-GB')} triangles`);
  for (const r of out.rows) console.log(`  ${Math.round(r.tris).toLocaleString('en-GB').padStart(10)}  ${String(r.draws).padStart(4)}  ${r.label}`);
  await ctx.close();
}
await b.close();

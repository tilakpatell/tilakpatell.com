// Invisible walls, looked for: every stage's lane and the camera's room
// behind the walkers, |x| ≤ REACH, from just over the ground to head height
// and the camera's, cell by cell through the stage's solid grid
// (solids.js), from where the walkers stand (the land, or the stair, quay or
// bridge a stage carries them on). Wherever the grid says something stands,
// rays across the cell through what is drawn, and where they find nothing,
// the cell itself against every shown triangle. A solid cell with nothing
// drawn in it is a wall no one can see: listed, with where it is and how high.
//   node lab/road/probe-walls.mjs [stage …]   (STEP=m along, 0.5; REACH=m across, 3)
import { browser, open, STAGE_IDS } from './common.mjs';

const ids = process.argv.slice(2).length ? process.argv.slice(2) : STAGE_IDS;
const STEP = Number(process.env.STEP ?? 0.5);
const REACH = Number(process.env.REACH ?? 3);
const b = await browser();
const { page, errors } = await open(b, `/middle-earth/road?at=${ids[0]}:10`);
await page.waitForTimeout(20000);
await page.evaluate(() => window.__ROAD__.world.setAuto(false));
const all = {};
for (const id of ids) {
  await page.evaluate(async (id) => {
    const { sOf } = await import('/src/components/middleearth/road/line.js');
    const { STAGES } = await import('/src/components/middleearth/road/stages/index.js');
    window.__ROAD__.world.set(sOf(STAGES, id, 5));
  }, id);
  // (until the stage's grid has filled and stopped growing)
  let last = -1;
  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(3000);
    const n = await page.evaluate(() => window.__ROAD__.info().solids);
    if (n != null && n === last) break;
    last = n;
  }
  const res = await page.evaluate(
    async ([id, STEP, REACH]) => {
      const THREE = await import('/node_modules/three/build/three.module.js');
      const { STAGES } = await import('/src/components/middleearth/road/stages/index.js');
      const grid = window.__ROAD__.grid();
      const group = window.__ROAD__.group();
      const land = window.__ROAD__.land();
      if (!grid || !group || !land) return { error: 'not built', grid: Boolean(grid), group: Boolean(group), land: Boolean(land) };
      const length = STAGES.find((s) => s.id === id).length;
      const road = land.road;
      const shown = (o) => {
        for (let p = o; p; p = p.parent) if (!p.visible) return false;
        return true;
      };
      const GROUND = /^road:(ground|track|blades)|^grass$/;
      group.updateMatrixWorld(true);
      const ray = new THREE.Raycaster();
      // (a sprite's raycast needs the camera it faces)
      const passes = typeof window.__ROAD__.passes === 'function' ? window.__ROAD__.passes() : window.__ROAD__.passes;
      ray.camera = passes.find((p) => p.kind === 'render').camera;
      const hitsAt = (x, y, z) => {
        for (const [dx, dz] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
          ray.set(new THREE.Vector3(x - dx * 0.6, y, z - dz * 0.6), new THREE.Vector3(dx, 0, dz));
          ray.far = 1.2;
          const hit = ray.intersectObject(group, true).find((h) => shown(h.object) && !GROUND.test(h.object.name));
          if (hit) return hit.object.name || hit.object.type;
        }
        // (and down onto it, a slab underfoot or a roof)
        ray.set(new THREE.Vector3(x, y + 0.6, z), new THREE.Vector3(0, -1, 0));
        ray.far = 1.2;
        const down = ray.intersectObject(group, true).find((h) => shown(h.object) && !GROUND.test(h.object.name));
        return down ? down.object.name || down.object.type : null;
      };
      const walls = [];
      let solid = 0;
      for (let m = 0; m <= length; m += STEP) {
        const p = road.pointAt(Math.min(m, road.length));
        const [tx, , tz] = p.tangent;
        const l = Math.hypot(tx, tz) || 1;
        for (let off = -REACH; off <= REACH + 1e-6; off += 0.5) {
          const x = p.x + (tz / l) * off;
          const z = p.z - (tx / l) * off;
          // (from where the walkers stand: the land, or what the stage carries them on, a stair, a quay, a bridge)
          const carried = window.__ROAD__.floor?.(x, z);
          const y0 = carried == null ? land.field(x, z) : Math.max(land.field(x, z), carried);
          for (const h of [0.45, 1.0, 1.6, 2.4, 3.2]) {
            if (!grid.at(x, y0 + h, z, 0)) continue;
            solid++;
            const what = hitsAt(x, y0 + h, z);
            if (!what) walls.push({ m: Math.round(m * 10) / 10, off, h, x: +x.toFixed(2), y: +(y0 + h).toFixed(2), z: +z.toFixed(2) });
          }
        }
      }
      // A cell the rays missed may still hold something drawn elsewhere in it
      // (a post, a rail): its exact cell (solids.js's CELL and SLAB, from the
      // ground at its middle) tested against every shown mesh's triangles. A
      // solid cell with none in it is a wall no one can see.
      const { CELL, SLAB, SPAN, BASE } = await import('/src/components/middleearth/road/solids.js');
      const PAST = -40; // (scenes.js's: the grid from 40 m before the stage)
      const tris = [];
      const im = new THREE.Matrix4();
      const t = new THREE.Triangle();
      const tb = new THREE.Box3();
      group.traverse((o) => {
        if (!o.isMesh || !o.geometry?.attributes?.position || !shown(o) || GROUND.test(o.name)) return;
        const pos = o.geometry.attributes.position;
        const idx = o.geometry.index;
        const nt = idx ? idx.count / 3 : pos.count / 3;
        const n = o.isInstancedMesh ? o.count : 1;
        for (let k = 0; k < n; k++) {
          if (o.isInstancedMesh) {
            o.getMatrixAt(k, im);
            im.premultiply(o.matrixWorld);
          } else im.copy(o.matrixWorld);
          for (let f = 0; f < nt; f++) {
            const at = (j) => (idx ? idx.getX(f * 3 + j) : f * 3 + j);
            const a = new THREE.Vector3().fromBufferAttribute(pos, at(0)).applyMatrix4(im);
            const b = new THREE.Vector3().fromBufferAttribute(pos, at(1)).applyMatrix4(im);
            const c = new THREE.Vector3().fromBufferAttribute(pos, at(2)).applyMatrix4(im);
            if (Math.max(Math.abs(a.x), Math.abs(b.x), Math.abs(c.x)) > SPAN + 1 && Math.min(Math.abs(a.x), Math.abs(b.x), Math.abs(c.x)) > SPAN + 1) continue;
            tris.push([a, b, c]);
          }
        }
      });
      const unseen = walls.filter((w) => {
        const ix = Math.floor((w.x + SPAN) / CELL);
        const iz = Math.floor((w.z - PAST) / CELL);
        const x0 = -SPAN + ix * CELL;
        const z0 = PAST + iz * CELL;
        const fl = land.field(x0 + CELL / 2, z0 + CELL / 2);
        const y0c = fl + BASE + Math.floor((w.y - fl - BASE) / SLAB) * SLAB;
        const box = new THREE.Box3(new THREE.Vector3(x0, y0c, z0), new THREE.Vector3(x0 + CELL, y0c + SLAB, z0 + CELL));
        for (const [a, b, c] of tris) {
          tb.setFromPoints([a, b, c]);
          if (!tb.intersectsBox(box)) continue;
          t.set(a, b, c);
          if (box.intersectsTriangle(t)) return false;
        }
        return true;
      });
      return { solid, missed: walls.length, walls: unseen.length, first: unseen.slice(0, 12).map(({ m, off, h }) => ({ m, off, h })) };
    },
    [id, STEP, REACH],
  );
  all[id] = res;
  console.log(id, JSON.stringify(res));
}
console.log('errors', errors.slice(0, 3));
await b.close();

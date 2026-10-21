// Invisible walls, looked for: every stage's lane and the camera's room
// behind the walkers, |x| ≤ REACH, from just over the ground to head height
// and the camera's, cell by cell through the stage's solid grid
// (solids.js); wherever the grid says something stands, rays across the
// cell through what is drawn. A solid cell with nothing drawn in it is a
// wall no one can see: listed, with where it is and how high.
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
          const y0 = land.field(x, z);
          for (const h of [0.45, 1.0, 1.6, 2.4, 3.2]) {
            if (!grid.at(x, y0 + h, z, 0)) continue;
            solid++;
            const what = hitsAt(x, y0 + h, z);
            if (!what) walls.push({ m: Math.round(m * 10) / 10, off, h });
          }
        }
      }
      return { solid, walls: walls.length, first: walls.slice(0, 40) };
    },
    [id, STEP, REACH],
  );
  all[id] = res;
  console.log(id, JSON.stringify(res));
}
console.log('errors', errors.slice(0, 3));
await b.close();

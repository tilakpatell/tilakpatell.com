// The shaders a ride builds, counted: the ride put at each place in turn
// (a seam crossed, a stage come into view and one gone), and after each the
// render pipelines the page has made so far (common.mjs's __PIPES__) and the
// lights the scene draws under. A light coming or going makes every lit
// material a new pipeline: the count jumps where it does.
//   GPU=webgpu node lab/road/probe-seam.mjs stage:metres …   (WAIT=s a place, 30)
import { browser, open } from './common.mjs';

const places = process.argv.slice(2);
const WAIT = Number(process.env.WAIT ?? 30) * 1000;
const b = await browser();
const { page, errors } = await open(b, `/middle-earth/road?at=${places[0]}`);
await page.waitForTimeout(20000);
await page.evaluate(() => window.__ROAD__.world.setAuto(false));
let was = 0;
for (const at of places) {
  const [id, m] = at.split(':');
  await page.evaluate(
    async ([id, m]) => {
      const { sOf } = await import('/src/components/middleearth/road/line.js');
      const { STAGES } = await import('/src/components/middleearth/road/stages/index.js');
      window.__ROAD__.world.set(sOf(STAGES, id, Number(m)));
    },
    [id, m],
  );
  await page.waitForTimeout(WAIT);
  const r = await page.evaluate(() => {
    const passes = typeof window.__ROAD__.passes === 'function' ? window.__ROAD__.passes() : window.__ROAD__.passes;
    const { scene, camera } = passes.find((p) => p.kind === 'render');
    const lights = [];
    scene.traverse((o) => {
      if (!o.isLight || !o.layers.test(camera.layers)) return;
      for (let p = o; p; p = p.parent) if (!p.visible) return;
      lights.push(o.name || o.type);
    });
    return { pipes: window.__PIPES__ ?? null, lights };
  });
  console.log(at.padEnd(18), 'pipelines', String(r.pipes).padStart(5), `(+${r.pipes - was})`, 'lights', r.lights.length, r.lights.join(','));
  was = r.pipes;
}
console.log('errors', errors.slice(0, 3));
await b.close();

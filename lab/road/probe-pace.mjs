// What each stage costs to draw, against the others: the ride put at a
// place on each stage (`AT` its fraction), let settle, then the frames the
// page drew over a span counted. In software (SwiftShader) the frames are
// few and bound by the drawing, so their rate between stages is how much
// more one asks of a chip than another: a laptop's built-in one is slowest
// where they are. With the triangles three drew last and the lights lit.
//   node lab/road/probe-pace.mjs [stage …]   (AT=0.5, SETTLE=s 15, SPAN=s 20)
import { browser, open, STAGE_IDS } from './common.mjs';

const ids = process.argv.slice(2).length ? process.argv.slice(2) : STAGE_IDS;
const AT = Number(process.env.AT ?? 0.5);
const SETTLE = Number(process.env.SETTLE ?? 15) * 1000;
const SPAN = Number(process.env.SPAN ?? 20) * 1000;
const b = await browser();
const { page, errors } = await open(b, `/middle-earth/road?at=${ids[0]}:10`);
await page.waitForTimeout(20000);
await page.evaluate(() => {
  window.__ROAD__.world.setAuto(false);
  window.__FRAMES__ = 0;
  const count = () => {
    window.__FRAMES__++;
    requestAnimationFrame(count);
  };
  requestAnimationFrame(count);
});
const rows = [];
for (const id of ids) {
  await page.evaluate(
    async ([id, AT]) => {
      const { sOf } = await import('/src/components/middleearth/road/line.js');
      const { STAGES } = await import('/src/components/middleearth/road/stages/index.js');
      const st = STAGES.find((s) => s.id === id);
      window.__ROAD__.world.set(sOf(STAGES, id, Math.round(st.length * AT)));
    },
    [id, AT],
  );
  await page.waitForTimeout(SETTLE);
  const f0 = await page.evaluate(() => window.__FRAMES__);
  await page.waitForTimeout(SPAN);
  const r = await page.evaluate(() => {
    const passes = typeof window.__ROAD__.passes === 'function' ? window.__ROAD__.passes() : window.__ROAD__.passes;
    const scene = passes.find((p) => p.kind === 'render').scene;
    let lights = 0;
    scene.traverse((o) => {
      if (o.isLight && o.visible && o.intensity > 0 && !o.isHemisphereLight && !o.isAmbientLight) lights++;
    });
    return { frames: window.__FRAMES__, triangles: window.__ROAD__.info().triangles, lights };
  });
  const row = { id, fps: +(((r.frames - f0) * 1000) / SPAN).toFixed(2), triangles: r.triangles, lights: r.lights };
  rows.push(row);
  console.log(JSON.stringify(row));
}
const fastest = Math.max(...rows.map((r) => r.fps));
for (const r of rows) console.log(r.id.padEnd(14), 'cost', fastest && r.fps ? (fastest / r.fps).toFixed(1) : '—', '× the lightest');
console.log('errors', errors.slice(0, 3));
await b.close();

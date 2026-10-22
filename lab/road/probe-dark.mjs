// A dark frame taken apart: at a place, the lights the scene holds near the
// camera (their kind, colour, strength, reach and how far off), the fog,
// and the frame two ways: as it is and with the fog lifted, so a frame
// black for want of light is told from one black for its fog.
//   node lab/road/probe-dark.mjs out stage:metres   (WAIT=s, 30)
import { mkdirSync } from 'node:fs';
import { browser, open } from './common.mjs';

const out = process.argv[2] ?? '/tmp/dark';
const at = process.argv[3] ?? 'moria:90';
const WAIT = Number(process.env.WAIT ?? 30) * 1000;
mkdirSync(out, { recursive: true });
const b = await browser();
const { page, errors } = await open(b, `/middle-earth/road?at=${at}`);
await page.waitForTimeout(20000);
await page.evaluate(() => window.__ROAD__.world.setAuto(false));
await page.waitForTimeout(WAIT);
const said = await page.evaluate(() => {
  const passes = typeof window.__ROAD__.passes === 'function' ? window.__ROAD__.passes() : window.__ROAD__.passes;
  const { scene: s, camera: cam } = passes.find((p) => p.kind === 'render');
  const lights = [];
  s.traverse((o) => {
    if (!o.isLight) return;
    const w = o.getWorldPosition(o.position.clone());
    lights.push(`${o.type}#${o.color.getHexString()} i${o.intensity.toFixed(2)} d${(o.distance ?? 0).toFixed(0)} @${w.distanceTo(cam.position).toFixed(1)}m${o.visible ? '' : ' hidden'}${o.castShadow ? ' casts' : ''}`);
  });
  const figs = [];
  s.traverse((o) => {
    if (o.isSkinnedMesh && o.visible) figs.push(`${o.parent?.name || o.name}@${o.getWorldPosition(o.position.clone()).distanceTo(cam.position).toFixed(1)}m`);
  });
  return { cam: cam.position.toArray().map((v) => +v.toFixed(1)), fog: s.fog && { colour: s.fog.color.getHexString(), density: s.fog.density }, lights: lights.slice(0, 24), figures: [...new Set(figs)].slice(0, 12), info: window.__ROAD__.info() };
});
console.log(JSON.stringify(said, null, 1));
await page.screenshot({ path: `${out}/as-is.png` });
await page.evaluate(() => {
  const passes = typeof window.__ROAD__.passes === 'function' ? window.__ROAD__.passes() : window.__ROAD__.passes;
  const { scene: s } = passes.find((p) => p.kind === 'render');
  window.__FOG__ = s.fog;
  s.fog = null;
});
await page.waitForTimeout(8000);
await page.screenshot({ path: `${out}/no-fog.png` });

console.log('errors', errors.slice(0, 3));
await b.close();

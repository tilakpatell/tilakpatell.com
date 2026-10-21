// The road looked down, at eye height: a place opened, the walk stopped, and
// the camera held over the road's middle at `m` metres along the stage,
// looking `ahead` metres on (or back, with a negative ahead), on the
// track's own vertices (track.js), so it stands where the road is.
//   node lab/road/probe-look.mjs stage:metres out [ahead=24] [eye=1.6] [side=0]
import { browser, open } from './common.mjs';
const at = process.argv[2] ?? 'hobbiton:60';
const out = process.argv[3] ?? '/tmp';
const ahead = Number(process.argv[4] ?? 24);
const eye = Number(process.argv[5] ?? 1.6);
const side = Number(process.argv[6] ?? 0);
const b = await browser();
const { page, errors } = await open(b, `/middle-earth/road?at=${at}`);
// (the walk left on: the veil over the Road's first words lifts only as it walks)
await page.waitForTimeout(Number(process.env.SETTLE ?? 20000));
const res = await page.evaluate(
  ([m, ahead, eye, side, hide]) => {
    const w = window.__ROAD__.world;
    const track = w.scene.getObjectByName('road:track');
    if (!track) return { error: 'no track', keys: Object.keys(w) };
    const g = track.geometry;
    const pos = g.getAttribute('position');
    const uv = g.getAttribute('uv');
    const near = (mm, off) => {
      let best = -1;
      let d = Infinity;
      for (let k = 0; k < uv.count; k++) {
        const e = Math.abs(uv.getY(k) - mm) + Math.abs(uv.getX(k) - off) * 4;
        if (e < d) {
          d = e;
          best = k;
        }
      }
      const z0 = track.parent?.position.z ?? 0;
      return [pos.getX(best), pos.getY(best), pos.getZ(best) + z0];
    };
    const from = near(m, side);
    const to = near(m + ahead, 0);
    // (the chain's render pass holds the camera; the world keeps none of its own to hand)
    const passes = typeof window.__ROAD__.passes === 'function' ? window.__ROAD__.passes() : window.__ROAD__.passes;
    const cam = passes?.find((p) => p.kind === 'render')?.camera;
    if (!cam) return { error: 'no camera' };
    // (HIDE=road:ground and the like: a part of the scene hidden, to see what's under or behind it)
    for (const name of hide) w.scene.traverse((o) => {
      if (o.name === name) o.visible = false;
    });
    w.scene.onBeforeRender = () => {
      cam.position.set(from[0], from[1] + eye, from[2]);
      cam.lookAt(to[0], to[1] + eye * 0.35, to[2]);
      cam.updateMatrixWorld();
    };
    return { from, to };
  },
  [Number(at.split(':')[1] ?? 60), ahead, eye, side, (process.env.HIDE ?? '').split(',').filter(Boolean)],
);
console.log(JSON.stringify(res), errors.slice(0, 3));
await page.waitForTimeout(4000);
await page.screenshot({ path: `${out}/look-${at.replace(':', '-')}${process.env.TAG ? `-${process.env.TAG}` : ''}.png`, timeout: 240000 });
await b.close();

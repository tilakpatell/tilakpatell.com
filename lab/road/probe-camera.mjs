// What the camera sees at a place, close to: the walk stopped there, the
// shot it is on, where the camera stands over the land, and the first few
// things drawn along its view (rays through the middle and the four
// quarters of the frame), so a frame gone dark or flat is told apart: a
// wall in its face, the floor of something over it, the land itself, or
// only the dark. A frame of each.
//   node lab/road/probe-camera.mjs out stage:metres …   (WAIT=s a place, 25)
import { mkdirSync } from 'node:fs';
import { browser, open } from './common.mjs';

const out = process.argv[2] ?? '/tmp/camera';
const places = process.argv.slice(3);
const WAIT = Number(process.env.WAIT ?? 25) * 1000;
mkdirSync(out, { recursive: true });
const b = await browser();
const [first] = places;
const { page, errors } = await open(b, `/middle-earth/road?at=${first}`);
await page.waitForTimeout(20000);
await page.evaluate(() => window.__ROAD__.world.setAuto(false));
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
  const res = await page.evaluate(async () => {
    const THREE = await import('/node_modules/three/build/three.module.js');
    const passes = typeof window.__ROAD__.passes === 'function' ? window.__ROAD__.passes() : window.__ROAD__.passes;
    const cam = passes.find((p) => p.kind === 'render').camera;
    const scene = passes.find((p) => p.kind === 'render').scene;
    const land = window.__ROAD__.land();
    const group = window.__ROAD__.group();
    const info = window.__ROAD__.info();
    const shown = (o) => {
      for (let p = o; p; p = p.parent) if (!p.visible) return false;
      return true;
    };
    const ray = new THREE.Raycaster();
    const looks = {};
    for (const [name, x, y] of [['mid', 0, 0], ['tl', -0.5, 0.5], ['tr', 0.5, 0.5], ['bl', -0.5, -0.5], ['br', 0.5, -0.5]]) {
      ray.setFromCamera(new THREE.Vector2(x, y), cam);
      ray.far = 400;
      const hits = ray.intersectObject(scene, true).filter((h) => shown(h.object));
      looks[name] = hits.slice(0, 3).map((h) => `${h.object.name || h.object.type}@${h.distance.toFixed(1)}${h.face && h.face.normal.dot(ray.ray.direction) > 0 ? '(back)' : ''}`);
    }
    // the camera in the land's frame: its height over the land
    const g = new THREE.Vector3();
    group?.getWorldPosition(g);
    const over = land ? cam.position.y - g.y - land.field(cam.position.x - g.x, cam.position.z - g.z) : null;
    // (what the scene holds at its top, and where: the lands, the stage's own group, the walkers)
    const top = scene.children.filter((o) => o.name).map((o) => `${o.name}${o.visible ? '' : '(hidden)'}@${o.position.toArray().map((v) => Math.round(v)).join(',')}`);
    const stage = [];
    scene.traverse((o) => {
      if (/^stage:/.test(o.name)) {
        const w = new THREE.Vector3();
        o.getWorldPosition(w);
        stage.push(`${o.name}${shown(o) ? '' : '(hidden)'}@${w.toArray().map((v) => Math.round(v)).join(',')}`);
      }
    });
    return { shot: info.shot, boom: +(info.boom ?? 1).toFixed(2), s: +info.s.toFixed(4), cam: cam.position.toArray().map((v) => +v.toFixed(1)), g: g.toArray().map((v) => Math.round(v)), over: over == null ? null : +over.toFixed(2), looks, top: top.slice(0, 30), stage };
  });
  await page.screenshot({ path: `${out}/${id}-${m}.png` });
  console.log(at, JSON.stringify(res));
}
console.log('errors', errors.slice(0, 3));
await b.close();

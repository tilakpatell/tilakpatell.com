// A buffer used after it was destroyed, run down: the ride jumped from
// place to place (as a visitor's does, Carry on or the ribbon), every
// buffer labelled with where it was made (BUFFERS=1, common.mjs), and at
// each place the device's errors over a destroyed one, each with where
// that buffer was made and where from it was destroyed.
//   GPU=webgpu BUFFERS=1 node lab/road/probe-destroyed.mjs stage:metres …   (WAIT=s a place, 30)
import { browser, open } from './common.mjs';

process.env.BUFFERS = '1';
const places = process.argv.slice(2);
const WAIT = Number(process.env.WAIT ?? 30) * 1000;
const b = await browser();
const { page, errors } = await open(b, `/middle-earth/road?at=${places[0]}`);
await page.waitForTimeout(20000);
await page.evaluate(() => window.__ROAD__.world.setAuto(false));
let seen = 0;
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
  const fresh = errors.slice(seen);
  seen = errors.length;
  const labels = [...new Set(fresh.map((e) => /\[Buffer "([^"]*)"\]/.exec(e)?.[1]).filter(Boolean))];
  const by = await page.evaluate((labels) => labels.map((l) => ({ made: l, destroyedBy: [...new Set((window.__DESTROYED__ ?? []).filter((d) => d.label === l).map((d) => d.by))].slice(0, 3) })), labels);
  console.log(at, 'errors', fresh.length, JSON.stringify(by, null, 1));
  // (and what three warns of as it builds a draw: a lit mesh with no normals, a mapped one with no uv)
  const bare = await page.evaluate(() => {
    const passes = typeof window.__ROAD__.passes === 'function' ? window.__ROAD__.passes() : window.__ROAD__.passes;
    const scene = passes.find((p) => p.kind === 'render').scene;
    const out = { normal: new Set(), uv: new Set(), aRole: new Set() };
    scene.traverse((o) => {
      if (!o.isMesh || !o.geometry?.attributes) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const a = o.geometry.attributes;
      const label = `${o.name || o.parent?.name || o.type}/${mats.map((m) => m?.type).join('+')}`;
      if (!a.normal && mats.some((m) => m && !/Basic|Sprite|Points|Line|Shadow/.test(m.type))) out.normal.add(label);
      if (!a.uv && mats.some((m) => m?.map || m?.normalMap || m?.alphaMap || m?.emissiveMap)) out.uv.add(label);
      if (!a.aRole && mats.some((m) => String(m?.customProgramCacheKey?.() ?? '').includes('parts:wear'))) out.aRole.add(label);
    });
    return { normal: [...out.normal].slice(0, 12), uv: [...out.uv].slice(0, 12), aRole: [...out.aRole].slice(0, 12) };
  });
  console.log(' bare', JSON.stringify(bare));
  if (fresh.length && !labels.length) console.log(' first', fresh[0].slice(0, 400));
  // (and what in the scene still draws with a buffer gone: its attributes' buffers, as three's backend holds them)
  if (fresh.length) {
    const users = await page.evaluate(() => {
      const backend = window.__RUNTIME__?.gfx?.renderer?.backend;
      const dead = window.__DEAD__;
      const passes = typeof window.__ROAD__.passes === 'function' ? window.__ROAD__.passes() : window.__ROAD__.passes;
      const scene = passes.find((p) => p.kind === 'render').scene;
      const found = [];
      const path = (o) => {
        const names = [];
        for (let p = o; p; p = p.parent) names.push(p.name || p.type);
        return names.slice(0, 6).join(' < ');
      };
      scene.traverse((o) => {
        if (!o.geometry) return;
        const attrs = [...Object.entries(o.geometry.attributes ?? {}), ['index', o.geometry.index], ['instanceMatrix', o.instanceMatrix]].filter(([, a]) => a);
        for (const [name, a] of attrs) {
          const d = backend?.get?.(a.isInterleavedBufferAttribute ? a.data : a);
          if (d?.buffer && dead?.has(d.buffer)) found.push(`${name} of ${path(o)}${o.visible ? '' : ' (hidden)'}`);
        }
      });
      return found.slice(0, 20);
    });
    console.log(' drawn with a dead buffer:', JSON.stringify(users, null, 1));
  }
}
await b.close();

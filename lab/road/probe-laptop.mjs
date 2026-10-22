// Middle-earth's other worlds on a laptop's own chip: each page opened
// fresh (the chapters, the hub, the Red Book), its world brought into view,
// left to stand, then what the runtime says of it (the backend, the
// renderer tier and why, the GPU clock, the quality level), what three
// drew last frame, the errors the device raised and three's warnings, and
// a frame. Run it as a built-in chip has it:
//   GPU=webgpu LIMITS=default QUALITY=low node lab/road/probe-laptop.mjs out /middle-earth/shire …
// (WAIT=s a page, 45)
import { mkdirSync, writeFileSync } from 'node:fs';
import { browser, open } from './common.mjs';

const out = process.argv[2] ?? '/tmp/laptop';
const paths = process.argv.slice(3);
const WAIT = Number(process.env.WAIT ?? 45) * 1000;
mkdirSync(out, { recursive: true });
const b = await browser();
const rows = [];
for (const path of paths) {
  const name = path.replace(/^\/+/, '').replace(/[/?=:]+/g, '-') || 'home';
  let row = { path };
  try {
    const { ctx, page, errors, warnings } = await open(b, path, { road: false });
    // (each world starts as its box comes into view: every canvas on the page, the biggest last)
    await page.waitForTimeout(8000);
    await page.evaluate(() => {
      const boxes = [...document.querySelectorAll('canvas, [data-world], .me-scene')].map((e) => [e, e.getBoundingClientRect()]);
      boxes.sort((a, c) => a[1].width * a[1].height - c[1].width * c[1].height);
      boxes.at(-1)?.[0].scrollIntoView({ block: 'center' });
    });
    await page.waitForTimeout(WAIT);
    const said = await page.evaluate(() => {
      const rt = window.__RUNTIME__;
      const r = rt?.gfx?.renderer;
      const clock = rt?.gpuClock;
      return {
        backend: rt?.gfx?.backend ?? null,
        tier: rt?.tier ?? null,
        why: rt?.tierWhy ?? null,
        current: rt?.current?.id ?? null,
        level: localStorage.getItem('tp-quality'),
        calls: r?.info?.render?.calls ?? null,
        triangles: r?.info?.render?.triangles ?? null,
        gpu: clock?.available ? { median: +(clock.median ?? 0).toFixed(1), p95: +(clock.p95 ?? 0).toFixed(1) } : null,
        canvases: [...document.querySelectorAll('canvas')].filter((c) => c.width * c.height > 1).length,
      };
    });
    // (what three warns of as it builds a draw: a lit mesh with no normals, a mapped one with no uv;
    // every scene the renderer is asked to draw for a few frames, looked through)
    const bare = await page.evaluate(async () => {
      const r = window.__RUNTIME__?.gfx?.renderer;
      if (!r) return null;
      const scenes = new Set();
      const render = r.render;
      r.render = function (scene, ...rest) {
        scenes.add(scene);
        return render.call(this, scene, ...rest);
      };
      await new Promise((done) => setTimeout(done, 4000));
      r.render = render;
      const out = { normal: new Set(), uv: new Set() };
      const path = (o) => {
        const names = [];
        for (let p = o; p && names.length < 4; p = p.parent) names.push(p.name || p.type);
        return names.join(' < ');
      };
      for (const scene of scenes)
        scene.traverse?.((o) => {
          if (!(o.isMesh || o.isPoints || o.isLine) || !o.geometry?.attributes) return;
          const mats = [o.material].flat();
          const a = o.geometry.attributes;
          const label = `${path(o)}/${mats.map((m) => m?.type).join('+')}`;
          if (!a.normal && mats.some((m) => m && /Lambert|Standard|Phong|Physical|Toon/.test(m.type))) out.normal.add(label);
          if (!a.uv && mats.some((m) => m?.map || m?.normalMap || m?.alphaMap || m?.emissiveMap || m?.roughnessMap)) out.uv.add(label);
        });
      return { scenes: scenes.size, normal: [...out.normal].slice(0, 10), uv: [...out.uv].slice(0, 10) };
    });
    await page.screenshot({ path: `${out}/${name}.png`, timeout: 120000 });
    const uniq = (a) => [...new Set(a)];
    row = { path, ...said, errors: uniq(errors).slice(0, 6), warnings: uniq(warnings).slice(0, 8), nWarnings: warnings.length, bare };
    await ctx.close();
  } catch (e) {
    row = { path, fail: String(e.message ?? e).slice(0, 300) };
  }
  rows.push(row);
  console.log(JSON.stringify(row));
}
writeFileSync(`${out}/laptop.json`, JSON.stringify(rows, null, 1));
await b.close();

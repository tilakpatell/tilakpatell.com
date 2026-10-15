// Scratch: the planet flight's scene graph at play, counted by its
// top-level subtrees (what three walks each frame). Run from a checkout's
// root with its own Vite: node docs/superpowers/evidence/engine-floor/
// FL3-fly/tools/fly-census.mjs [planet] (QUALITY=low|high, GPU=webgl)
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const { chromium } = await import(pathToFileURL(resolve('node_modules/playwright-core/index.mjs')).href);
const { findChromium, launchArgs, angleFor } = await import(pathToFileURL(resolve('scripts/lib/chromium.mjs')).href);
const { createServer } = await import(pathToFileURL(resolve('node_modules/vite/dist/node/index.js')).href);
const server = await createServer({ root: resolve('.'), server: { host: '127.0.0.1', port: 5297, strictPort: true, hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const BASE = 'http://127.0.0.1:5297';
const browser = await chromium.launch({ executablePath: findChromium(), args: launchArgs({ angle: angleFor(), webgpu: false, uncapped: true }) });
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(() => {
    const set = (k, v) => window.localStorage.setItem(k, v);
    set('tp-intro', '1');
    set('tp-sound', 'off');
    set('tp-worlds', JSON.stringify('load'));
    set('tp-software', JSON.stringify('on'));
    set('tp-tour', 'skipped');
  });
  const page = await ctx.newPage();
  const q = `?quality=${process.env.QUALITY ?? 'low'}&gpu=${process.env.GPU ?? 'webgl'}`;
  await page.goto(`${BASE}/${q}#/fly/${process.argv[2] ?? 'hoth'}`, { waitUntil: 'domcontentloaded', timeout: 240000 });
  await page.waitForFunction(() => window.__FLIGHT__ && window.__RUNTIME__?.status === 'on', null, { timeout: 240000 });
  await page.waitForFunction(() => window.__FLIGHT__.stats().leaves > 100, null, { timeout: 120000 }).catch(() => {});
  await page.waitForTimeout(8000);
  const out = await page.evaluate(() => {
    const scene = window.__FLIGHT__.scene;
    const count = (root) => {
      const c = { objects: 0, visible: 0, meshes: 0, shownMeshes: 0, instanced: 0, instances: 0, auto: 0, materials: new Set() };
      const walk = (o, shown) => {
        c.objects++;
        const on = shown && o.visible;
        if (on) c.visible++;
        if (o.matrixAutoUpdate) c.auto++;
        if (o.isInstancedMesh) {
          c.instanced++;
          if (on) c.instances += o.count;
        } else if (o.isMesh || o.isPoints || o.isLine || o.isSprite) {
          c.meshes++;
          if (on) c.shownMeshes++;
        }
        if (o.material) for (const m of [o.material].flat()) c.materials.add(m.uuid);
        for (const k of o.children) walk(k, on);
      };
      walk(root, true);
      return { ...c, materials: c.materials.size };
    };
    const rows = scene.children.map((o) => ({ name: o.name || o.type, ...count(o) }));
    return { backend: window.__RUNTIME__.backend ?? window.__RUNTIME__.gfx?.backend, total: count(scene), rows, info: window.__RUNTIME__.gfx?.renderer?.info?.render };
  });
  console.log(JSON.stringify(out, null, 1));
} finally {
  await browser.close();
  await server.close();
}

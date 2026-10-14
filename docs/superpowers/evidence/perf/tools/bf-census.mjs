// Scratch: Battlefront's scene graph at play, counted. Run from a checkout
// with a dev server (BASE) or its own Vite: node bf-census.mjs
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const { chromium } = await import(pathToFileURL(resolve('node_modules/playwright-core/index.mjs')).href);
const { findChromium, launchArgs, angleFor } = await import(pathToFileURL(resolve('scripts/lib/chromium.mjs')).href);
let BASE = process.env.BASE;
let server = null;
if (!BASE) {
  const { createServer } = await import(pathToFileURL(resolve('node_modules/vite/dist/node/index.js')).href);
  server = await createServer({ root: resolve('.'), server: { host: '127.0.0.1', port: 5296, strictPort: true, hmr: false, watch: null }, logLevel: 'error' });
  await server.listen();
  BASE = 'http://127.0.0.1:5296';
}
const browser = await chromium.launch({ executablePath: findChromium(), args: launchArgs({ angle: angleFor(), webgpu: true, uncapped: true }) });
try {
  const ctx = await browser.newContext({ viewport: { width: 1470, height: 956 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => {
    const set = (k, v) => window.localStorage.setItem(k, v);
    set('tp-intro', '1');
    set('tp-sound', 'off');
    set('tp-worlds', JSON.stringify('load'));
    set('tp-software', JSON.stringify('on'));
    set('tp-tour', 'skipped');
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/?quality=${process.env.QUALITY ?? 'high'}#/battlefront/hoth/galacticAssault`, { waitUntil: 'domcontentloaded', timeout: 240000 });
  await page.waitForSelector('.bf-stage[data-bf-stage="spawn"]', { timeout: 300000 });
  await page.waitForSelector('.bf-spawn-screen-cell[data-kind="class"]:not([aria-disabled])', { timeout: 60000 });
  await page.click('.bf-spawn-screen-cell[data-kind="class"]:not([aria-disabled])');
  await page.waitForFunction(() => window.__battlefront?.view().player?.state === 'alive' && window.__battlefront.view().parked === false, null, { timeout: 120000 });
  await page.waitForTimeout(5000);
  const out = await page.evaluate(() => {
    const scene = window.__battlefront.chain?.[0]?.scene;
    if (!scene) return { error: 'no scene' };
    const by = {};
    let objects = 0;
    let auto = 0;
    let visible = 0;
    let meshes = 0;
    let instanced = 0;
    let instances = 0;
    let skinned = 0;
    let bones = 0;
    let groups = 0;
    let maxDepth = 0;
    const top = {};
    const walk = (o, depth, root) => {
      objects++;
      if (o.matrixAutoUpdate) auto++;
      if (o.visible) visible++;
      if (o.isBone) bones++;
      if (o.isSkinnedMesh) skinned++;
      if (o.isInstancedMesh) {
        instanced++;
        instances += o.count;
      } else if (o.isMesh) meshes++;
      if (o.isGroup || o.type === 'Object3D') groups++;
      maxDepth = Math.max(maxDepth, depth);
      by[o.type] = (by[o.type] ?? 0) + 1;
      top[root] = (top[root] ?? 0) + 1;
      for (const c of o.children) walk(c, depth + 1, root);
    };
    for (const c of scene.children) walk(c, 1, c.name || c.type);
    const topList = Object.entries(top).sort((a, b) => b[1] - a[1]).slice(0, 15);
    return { objects, matrixAutoUpdate: auto, visible, meshes, instanced, instances, skinned, bones, groups, maxDepth, byType: by, top: topList, sceneAuto: scene.matrixWorldAutoUpdate };
  });
  console.log(JSON.stringify(out, null, 1));
} finally {
  await browser.close();
  await server?.close();
}

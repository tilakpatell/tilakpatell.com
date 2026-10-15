/* global window, requestAnimationFrame */
// Sea shots, before and after: ROOT=<checkout> TAG=before|after OUT=<dir> node scripts/sea-shot.mjs scarif,naboo,kamino (Vite in-process, cached Chromium on Metal, or SwiftShader off a Mac; prints calls, triangles, p50 ms)
const ROOT = process.env.ROOT ?? process.cwd();
const TAG = process.env.TAG ?? 'after';
const OUT = process.env.OUT;
const PORT = Number(process.env.PORT ?? 5193);
const worlds = (process.argv[2] ?? 'scarif').split(',');
process.chdir(ROOT);
const { createServer } = await import(ROOT + '/node_modules/vite/dist/node/index.js');
const { chromium } = await import(ROOT + '/node_modules/playwright-core/index.mjs');
const server = await createServer({ root: ROOT, logLevel: 'error', server: { port: PORT, host: '127.0.0.1', hmr: false, watch: null } });
await server.listen();
const { siteOf } = await server.ssrLoadModule('/src/components/galaxy/surface/sites/index.js');
const { makeHeight } = await server.ssrLoadModule('/src/components/galaxy/surface/terrain.js');
// a spot on land just above the waterline, nearest the landing, and which way the sea is
const shore = (site) => {
  if (!site.water || site.noGround) return null;
  const h = makeHeight(site.ground);
  const lv = site.water.level;
  let best = null;
  for (let a = 0; a < 64; a++) {
    const dx = Math.sin((a / 64) * Math.PI * 2), dz = Math.cos((a / 64) * Math.PI * 2);
    for (let r = 20; r < 520; r += 2) {
      const x = dx * r, z = dz * r;
      if (h(x, z) < lv) {
        const lx = x - dx * 8, lz = z - dz * 8;
        if (h(lx, lz) > lv + 0.3 && (!best || r < best.r)) best = { r, x: lx, z: lz, yaw: Math.atan2(dx, dz) };
        break;
      }
    }
  }
  return best;
};
// (the cached Chromium on a Mac, on Metal; elsewhere the one Playwright finds, on SwiftShader)
const mac = process.platform === 'darwin';
const exe = process.env.EXE ?? (mac ? process.env.HOME + '/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' : undefined);
const gl = mac ? ['--use-angle=metal'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const browser = await chromium.launch({ executablePath: exe, args: [...gl, '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
for (const id of worlds) {
  const spot = shore(siteOf(id));
  const ctx = await browser.newContext({ viewport: { width: Number(process.env.W ?? 1280), height: Number(process.env.H ?? 720) } });
  await ctx.addInitScript(() => {
    localStorage.setItem('tp-intro', '1'); localStorage.setItem('tp-start', '"universe"'); localStorage.setItem('tp-universe-ship', '"xwing"');
    localStorage.setItem('tp-galaxy-panel', '"tucked"'); localStorage.setItem('tp-sound', 'off'); sessionStorage.setItem('tp-galaxy-intro', '1'); localStorage.setItem('tp-worlds', '"load"');
    window.localStorage.setItem('tp-software', '"on"'); // (past the Star Wars worlds' GPU gate, lib/fit)
    const held = Date.UTC(2026, 9, 5, 12); Date.now = () => held;
    let seed = 7; Math.random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 200)));
  await page.goto(`http://127.0.0.1:${PORT}/?quality=high#/galaxy/${id}/surface`, { timeout: 180000 });
  await page.waitForFunction(() => window.__surface?.()?.phase, null, { timeout: 180000 });
  await page.waitForTimeout(3000);
  for (let i = 0; i < 6 && (await page.evaluate(() => window.__surface?.()?.phase)) !== 'walk'; i++) {
    await page.evaluate(() => window.__surfaceDo('advance', 40));
    await page.waitForTimeout(1500);
  }
  if (spot) await page.evaluate(([x, z, yaw]) => window.__surfaceDo('teleport', x, z, yaw), [spot.x, spot.z, spot.yaw]);
  await page.waitForTimeout(Number(process.env.SETTLE ?? 6000));
  const file = `${OUT}/${id}-${TAG}.png`;
  await page.screenshot({ path: file, timeout: 300000 });
  const info = await page.evaluate(() => new Promise((r) => { const info = window.__surfaceScene.renderer.info; info.autoReset = false; let n = 0; const times = []; let last = performance.now(); let f = null; const tick = (now) => { times.push(now - last); last = now; f = { calls: info.render.drawCalls ?? info.render.calls, tris: info.render.triangles }; info.reset(); if (++n < 90) requestAnimationFrame(tick); else { info.autoReset = true; times.sort((a, b) => a - b); r({ ...f, p50: +times[45].toFixed(1) }); } }; requestAnimationFrame(tick); }));
  console.log(id, TAG, spot ? `shore r=${spot.r}` : 'no shore', JSON.stringify(info), errors.length ? 'ERR ' + errors.slice(0, 2).join(' | ') : 'ok');
  await ctx.close();
}
await browser.close();
await server.close();

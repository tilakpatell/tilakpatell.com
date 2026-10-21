// What the Road's lab scripts share: a Chromium on the container's software
// GL (or CHROME), a page on the dev server (BASE, else localhost:5173), the
// house's first-visit keys set so no intro or Load 3D card stands in front, and the Road's
// save cleared so no resume card holds the ride.
import { chromium } from 'playwright-core';
import { readdirSync, existsSync } from 'node:fs';

export const BASE = process.env.BASE ?? 'http://localhost:5173';
export const STAGE_IDS = ['hobbiton', 'shire-edge', 'bree', 'weathertop', 'ford', 'rivendell', 'caradhras', 'moria', 'lorien', 'anduin', 'marshes', 'ithilien', 'cirith-ungol', 'gorgoroth', 'minas-tirith', 'havens'];

export async function browser() {
  const exe = process.env.CHROME ?? readdirSync('/opt/pw-browsers').filter((n) => /^chromium-\d+$/.test(n)).map((n) => `/opt/pw-browsers/${n}/chrome-linux/chrome`).find(existsSync);
  // (GPU=webgpu: WebGPU on Dawn's SwiftShader adapter, the owner's own backend, in software;
  // without Vulkan on SwiftShader too the device is lost within seconds, "A valid external
  // Instance reference no longer exists")
  const gpu = process.env.GPU === 'webgpu' ? ['--enable-unsafe-webgpu', '--use-webgpu-adapter=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--disable-gpu-watchdog'] : [];
  return chromium.launch({ executablePath: exe, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', ...gpu] });
}

export async function open(b, path, { phone = false, quality = process.env.QUALITY ?? 'high', onPage = null } = {}) {
  // (VIEW=960x600 for a smaller frame: WebGPU in software is slow)
  const [vw, vh] = (process.env.VIEW ?? '').split('x').map(Number);
  const viewport = phone ? { width: 390, height: 844 } : vw && vh ? { width: vw, height: vh } : { width: 1440, height: 900 };
  const ctx = await b.newContext({ viewport, hasTouch: phone, isMobile: phone, deviceScaleFactor: 1 });
  await ctx.addInitScript((q) => {
    localStorage.setItem('tp-intro', '1');
    localStorage.setItem('tp-start', '"universe"');
    localStorage.setItem('tp-quality', q);
    localStorage.setItem('tp-map3d', 'force');
    // (at low the site holds a heavy world behind its Load 3D card: always load, as the probe does)
    localStorage.setItem('tp-worlds', JSON.stringify('load'));
    localStorage.removeItem('tp-road');
  }, quality);
  // (GPU=webgpu: SwiftShader's adapter is a fallback one, which the runtime
  // rightly refuses a visitor; here it's told otherwise, so the probe draws
  // on the owner's backend. The site itself is untouched.)
  if (process.env.GPU === 'webgpu')
    await ctx.addInitScript(() => {
      const gpu = navigator.gpu;
      if (!gpu) return;
      // (and --enable-unsafe-webgpu turns on an older, experimental shape of a view's `swizzle`, a
      // dictionary, where three passes the string 'rgba': dropped here, as a visitor's Chrome ignores it)
      const view = GPUTexture.prototype.createView;
      GPUTexture.prototype.createView = function (d) {
        if (d && typeof d.swizzle === 'string') {
          const { swizzle, ...rest } = d;
          return view.call(this, rest);
        }
        return view.call(this, d);
      };
      const not = (o) => o && Object.defineProperty(o, 'isFallbackAdapter', { value: false, configurable: true });
      const ask = gpu.requestAdapter.bind(gpu);
      gpu.requestAdapter = async (opts) => {
        const a = await ask(opts);
        if (!a) return a;
        not(a);
        not(a.info);
        const make = a.requestDevice.bind(a);
        a.requestDevice = async (d) => {
          const device = await make(d);
          not(device.adapterInfo);
          return device;
        };
        return a;
      };
    });
  const page = await ctx.newPage();
  onPage?.(page);
  // the assets' bytes as they arrive (the models come through workers and
  // the loaders' own fetches, which the page's resource timings miss; the
  // code is left out: on the dev server it's hundreds of unbundled modules)
  const assets = { bytes: 0 };
  page.on('response', async (r) => {
    if (!/\/(models|textures|audio|cc0|kit|hdri)\//.test(new URL(r.url()).pathname)) return;
    const body = await r.body().catch(() => null);
    if (body) assets.bytes += body.length;
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${BASE}/?calibrate=off#${path}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => window.__ROAD__ && window.__RUNTIME__?.status === 'on', null, { timeout: 240000 });
  return { ctx, page, errors, assets };
}

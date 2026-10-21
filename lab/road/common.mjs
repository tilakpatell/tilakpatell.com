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

export async function open(b, path, { phone = false, quality = process.env.QUALITY ?? 'high', onPage = null, road = true } = {}) {
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
  // (LIMITS=default: the adapter says only WebGPU's own defaults, the least any chip has, a
  // laptop's built-in one among them, and every error the device raises is put on the console)
  if (process.env.GPU === 'webgpu')
    await ctx.addInitScript((least) => {
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
        if (least) {
          const DEFAULTS = { maxColorAttachmentBytesPerSample: 32, maxColorAttachments: 8, maxStorageBuffersPerShaderStage: 8, maxSampledTexturesPerShaderStage: 16, maxSamplersPerShaderStage: 16, maxInterStageShaderVariables: 16, maxVertexAttributes: 16, maxVertexBuffers: 8, maxUniformBuffersPerShaderStage: 12, maxBindGroups: 4, maxTextureDimension2D: 8192 };
          const limits = {};
          for (const k in a.limits) limits[k] = a.limits[k];
          window.__ADAPTER_LIMITS__ = { ...limits };
          Object.assign(limits, DEFAULTS);
          Object.defineProperty(a, 'limits', { value: limits, configurable: true });
        }
        // (BUFFERS=1: every buffer labelled with where it was made, and every one destroyed noted with
        // where from, so an error over a destroyed buffer names it: window.__DESTROYED__)
        if (window.__BUFFERS__) {
          const where = (skip) =>
            new Error().stack
              .split('\n')
              .slice(skip, skip + 18)
              .map((l) => l.trim().replace(/^at /, '').replace(/https?:\/\/[^/]+/g, '').replace(/\?[^:)]*/g, ''))
              .filter((l) => !/three\.webgpu|node_modules/.test(l))
              .slice(0, 4)
              .join(' < ');
          window.__DESTROYED__ = [];
          const create = GPUDevice.prototype.createBuffer;
          GPUDevice.prototype.createBuffer = function (desc) {
            return create.call(this, { ...desc, label: desc?.label || `made ${where(2)}`.slice(0, 400) });
          };
          const destroy = GPUBuffer.prototype.destroy;
          GPUBuffer.prototype.destroy = function () {
            window.__DESTROYED__.push({ label: this.label, by: where(2).slice(0, 400) });
            (window.__DEAD__ ??= new WeakSet()).add(this);
            if (window.__DESTROYED__.length > 4000) window.__DESTROYED__.splice(0, 1000);
            return destroy.call(this);
          };
        }
        // (every render pipeline the page makes, counted: window.__PIPES__, a shader built again shows)
        window.__PIPES__ = 0;
        for (const k of ['createRenderPipeline', 'createRenderPipelineAsync']) {
          const f = GPUDevice.prototype[k];
          GPUDevice.prototype[k] = function (...a) {
            window.__PIPES__++;
            return f.apply(this, a);
          };
        }
        const make = a.requestDevice.bind(a);
        a.requestDevice = async (d) => {
          const asked = d ? { ...d, requiredLimits: least ? {} : d.requiredLimits } : d;
          const device = await make(asked);
          not(device.adapterInfo);
          device.addEventListener('uncapturederror', (e) => console.error(`WebGPU error: ${e.error?.message ?? e.error}`));
          return device;
        };
        return a;
      };
    }, process.env.LIMITS === 'default');
  if (process.env.BUFFERS === '1') await ctx.addInitScript(() => void (window.__BUFFERS__ = true));
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
  // (and three's own warnings, TSL's among them, kept apart: `warnings`)
  const warnings = [];
  page.on('console', (m) => {
    if (/WebGPU error|THREE\.WebGPU|Invalid|GPUValidationError/i.test(m.text())) errors.push(m.text().slice(0, 400));
    else if (/^THREE\.|TSL/.test(m.text()) && (m.type() === 'warning' || m.type() === 'error')) warnings.push(m.text().slice(0, 300));
  });
  await page.goto(`${BASE}/?calibrate=off#${path}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  // (`road: false`, another world's page: the runtime on is enough)
  await page.waitForFunction((road) => (!road || window.__ROAD__) && window.__RUNTIME__?.status === 'on', road, { timeout: 240000 });
  return { ctx, page, errors, warnings, assets };
}

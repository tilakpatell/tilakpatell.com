// Browser proof of an already-open build across a Worker config switch. Synthetic two-build fixture only;
// real HTTP/module redirects and Worker servePlay, no engine/retail content/GPU. Optional --worker selects a control.
// node scripts/bf2web-deploy-continuity.mjs [--worker .scratch/control/play.js] [--out .scratch/deploy-continuity]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';
import { adopted } from './lib/bf2web-site.mjs';

const args = process.argv.slice(2), option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const { servePlay } = await import(pathToFileURL(path.resolve(option('--worker', 'cloudflare/play.js'))).href);
const out = path.resolve(option('--out', '.scratch/deploy-continuity'));
fs.mkdirSync(out, { recursive: true });
const modules = {
  'runtime/world-play.mjs': `export async function start() {
    const ui = await import('/ui/main.js');
    const uiVersion = ui.originalOnly();
    const rules = await (await fetch('/ui-data/screens.json')).json();
    const font = await (await fetch('/export/fonts/a.ttf')).text();
    const late = await import('./late.mjs');
    return { ui: uiVersion, dependency: ui.dependency, rules: rules.version, font, late: late.version };
  }
  export const later = async () => (await import('./late.mjs')).version;`,
  'runtime/late.mjs': "export const version = 'old';",
  'ui/main.js': "import {version} from './dependency.js'; export const dependency=version; export const originalOnly=()=> 'old';",
  'ui/dependency.js': "export const version = 'old';",
};
const manifest = { entries: Object.entries(modules).map(([name, value]) => ({ path: name, bytes: Buffer.byteLength(value) })) };
const objects = new Map();
for (const [name, value] of Object.entries(modules)) objects.set('sites/old/' + name, value);
objects.set('sites/old/manifest.json', JSON.stringify(manifest));
objects.set('sites/old/ui-data/screens.json', '{"version":"old"}');
objects.set('exports/old/fonts/a.ttf', 'old');
for (const [name, value] of Object.entries(modules)) objects.set('sites/new/' + name, value.replaceAll('old', 'new').replace('originalOnly', 'changedAPI'));
objects.set('sites/new/manifest.json', JSON.stringify(manifest));
objects.set('sites/new/ui-data/screens.json', '{"version":"new"}');
objects.set('exports/new/fonts/a.ttf', 'new');
let config = { build: 'old', site: 'sites/old/', uiData: 'sites/old/ui-data/', export: 'exports/old/', exportAllow: ['fonts/'] };
const env = { PLAY: { async get(key) {
  if (!objects.has(key)) return null;
  const value = objects.get(key), body = new TextEncoder().encode(value);
  return { body, size: body.length, httpEtag: '"fixture"', json: async () => JSON.parse(value) };
} } };
const manifests = new Map(), requests = [];
const report = { schema: 'bf2-deployment-continuity/1', synthetic: true, passed: false, requests };
const server = http.createServer(async (req, res) => {
  try {
    const origin = 'http://' + req.headers.host;
    if (/^\/battlefront\/engine\/(old|new)\/$/.test(req.url)) return res.writeHead(200, { 'content-type': 'text/html', 'referrer-policy': 'same-origin' }).end(
      '<!doctype html><script type="module">window.runtime = await import("./runtime/world-play.mjs"); window.ready = true;</script>');
    const response = await servePlay(new Request(origin + req.url, { headers: req.headers }), env, config, manifests);
    requests.push({ path: req.url, referrer: req.headers.referer ?? null, status: response?.status ?? 404, location: response?.headers.get('location') ?? null });
    if (!response) return res.writeHead(404).end('not routed');
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) { res.writeHead(500).end(String(error)); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  const flags = ['--disable-gpu', '--disable-webgl', '--disable-software-rasterizer'];
  browser = await chromium.launch({ executablePath: process.env.ENGINE_TEST_BROWSER ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true, args: flags });
  report.browser = browser.version(); report.flags = flags;
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/battlefront/engine/old/`);
  await page.waitForFunction(() => globalThis.ready === true);
  // The old runtime is already loaded. Adoption switches the active config before it imports its UI,
  // fetches rulebooks/fonts and dynamically imports a late runtime module.
  config = { ...adopted(config, 'new', manifest, 'sites/new/ui-data/'), export: 'exports/new/' };
  report.result = await page.evaluate(async () => {
    try { return { value: await globalThis.runtime.start() }; } catch (error) { return { error: String(error) }; }
  });
  report.late = await page.evaluate(async () => {
    try { return { value: await globalThis.runtime.later() }; } catch (error) { return { error: String(error) }; }
  });
  assert.deepEqual(report.result, { value: { ui: 'old', dependency: 'old', rules: 'old', font: 'old', late: 'old' } });
  assert.deepEqual(report.late, { value: 'old' });
  assert.equal(requests.some(row => row.path.includes('/engine/new/')), false);
  const fresh = await browser.newPage();
  await fresh.goto(`http://127.0.0.1:${server.address().port}/battlefront/engine/new/`);
  await fresh.waitForFunction(() => globalThis.ready === true);
  report.fresh = await fresh.evaluate(() => globalThis.runtime.start());
  assert.deepEqual(report.fresh, { ui: 'new', dependency: 'new', rules: 'new', font: 'new', late: 'new' });
  report.passed = true;
} catch (error) { report.error = String(error.stack ?? error); }
finally {
  await browser?.close();
  server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
}
console.log(JSON.stringify({ passed: report.passed, result: report.result, late: report.late, fresh: report.fresh, error: report.error, requests: requests.length }));
process.exitCode = report.passed ? 0 : 1;

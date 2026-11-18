import { test } from 'vitest';
import assert from 'node:assert/strict';
import {WORKER_SOURCE, following, warmOrder, warmEngineBuild} from '../cloudflare/engineCache.js';

const files = ['scene-t-0.pixels', 'scene-t-1.stored.pixels', 'scene-cloudy/scene-t-2.pixels',
  'scene-frontend/scene-t-3.pixels', 'scene-t-0.dbx', 'scene-t-1.dbx', 'scene-m-0.res'];
test('warm order and series exclude texture payloads, retaining descriptors and meshes', () => {
  assert.deepEqual(warmOrder(files), files.slice(4));
  assert.deepEqual([...following(files).keys()], files.slice(4));
});
test('serialized worker ignores old-page texture warms and passes ranges through unchanged', async () => {
  const on = {}, asked = [], cached = new Map(), origin = 'https://fixture.invalid';
  const dir = origin + '/battlefront/engine/fixture/';
  new Function('self', WORKER_SOURCE)({location: {origin}, addEventListener: (type, fn) => {on[type] = fn;},
    clients: {matchAll: async () => []}, caches: {keys: async () => [], open: async () => ({
      match: async r => cached.get(typeof r === 'string' ? r : r.url),
      put: async (r, value) => {cached.set(typeof r === 'string' ? r : r.url, value);}})},
    fetch: async request => {const url = typeof request === 'string' ? request : request.url;
      if (url.endsWith('/tp-files.json')) return Response.json({files});
      asked.push(url); return new Response('demanded bytes');}});
  const get = async (path, headers) => {let answer; const waits = [];
    on.fetch({request: new Request(dir + path, {headers}), respondWith: p => {answer = p;}, waitUntil: p => waits.push(p)});
    const result = await answer; await Promise.all(waits); return result;};
  for (const path of files.slice(0, 4)) assert.equal((await get(path, {'x-tp-warm': '1'})).status, 204);
  assert.deepEqual(asked, []);
  assert.equal(await get(files[0], {Range: 'bytes=5242880-'}), undefined);
  assert.deepEqual(asked, []);
  assert.equal(await (await get(files[0])).text(), 'demanded bytes');
  assert.deepEqual(asked, [dir + files[0]], 'a demanded whole texture does not prefetch siblings');
});
test('menu warm-up never requests a scene texture payload', async () => {
  const asked = [];
  warmEngineBuild({navigator: {serviceWorker: {controller: {}}}, location: {pathname: '/battlefront/engine/fixture/'},
    document: {body: {classList: {contains: () => true}}}, MutationObserver: class {observe() {}},
    fetch: async url => {if (url.endsWith('tp-files.json')) return Response.json({files});
      asked.push(url); return new Response(null, {status: 204});}}, warmOrder);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(asked.map(url => url.split('/').at(-1)), files.slice(4));
});

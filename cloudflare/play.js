// bf2-web's play site, served by the Worker from the private bucket (docs/decisions/2026-10-28-hoth-on-bf2-web.md):
// the page bf2-web exports (WebPort/tools/export-play-site.mjs: the page, every file it loads, the front end's ui/
// and manifest.json) under /battlefront/engine/<build>/, read through the R2 binding PLAY. Its page also asks for
// three roots by absolute path, which bf2-web's own servers map: /ui/ (the front end, the site's copy beside the
// page; the site's own /ui/bf2017/ is left to its files), /export/ (the game's export, extract/, only the folders the
// front end and the HUD read) and /ui-data/ (the front end's rulebooks). Only a file the build's manifest lists is
// served from the build. Everything is cross-origin isolated, as the engine's threads need (COOP, COEP require-corp:
// the page loads nothing from another origin). A build's files are a year and immutable under its id; the roots,
// whose paths don't carry it, are asked again each visit (304 by their ETag). The page itself is served with the site's
// way back added (playReturn.js), under an ETag of its object's and the script's, so a new script is a new page.
//
//   playRoute(pathname, config) → { key, root, path } | null   (null: not the play site's, the site's files answer)
//   servePlay(request, env, config, manifests, ctx?, cache?) → Promise<Response | null>
//     cache: the edge's (caches.default): a build's immutable file, asked whole, is answered from it and put in it,
//     so a visit after the first costs no read of the bucket
//   contentType(path)   ISOLATED: the headers   ENGINE: the page's path

import { RETURN_VERSION, withReturn } from './playReturn.js';

export const ENGINE = '/battlefront/engine/';
export const ISOLATED = { 'cross-origin-opener-policy': 'same-origin', 'cross-origin-embedder-policy': 'require-corp', 'cross-origin-resource-policy': 'same-origin' };

const TYPES = {
  html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', mjs: 'text/javascript; charset=utf-8', json: 'application/json',
  wasm: 'application/wasm', css: 'text/css; charset=utf-8', ttf: 'font/ttf', otf: 'font/otf', woff2: 'font/woff2', png: 'image/png',
  jpg: 'image/jpeg', svg: 'image/svg+xml', webp: 'image/webp', webm: 'video/webm', mp4: 'video/mp4', wgsl: 'text/plain; charset=utf-8', xml: 'application/xml',
};
export const contentType = (path) => TYPES[/\.([a-z0-9]+)$/i.exec(path)?.[1]?.toLowerCase()] ?? 'application/octet-stream';

const safe = (rest) => !rest.split('/').some((part) => part === '..' || part === '.' || part === '');

export function playRoute(pathname, config) {
  if (!config?.build || !config.site) return null;
  if (pathname.startsWith(ENGINE)) {
    const [build, ...parts] = pathname.slice(ENGINE.length).split('/');
    if (build !== config.build) return null;
    const path = parts.join('/') || 'index.html';
    return safe(path) ? { root: 'site', path, key: config.site + path } : null;
  }
  if (pathname.startsWith('/ui/') && !pathname.startsWith('/ui/bf2017/')) {
    const path = 'ui/' + pathname.slice('/ui/'.length);
    return safe(path) ? { root: 'site', path, key: config.site + path } : null;
  }
  if (pathname.startsWith('/export/')) {
    const path = pathname.slice('/export/'.length);
    return safe(path) && config.exportAllow.some((p) => path.startsWith(p)) ? { root: 'export', path, key: config.export + path } : null;
  }
  if (pathname.startsWith('/ui-data/')) {
    const path = pathname.slice('/ui-data/'.length);
    return safe(path) ? { root: 'uiData', path, key: config.uiData + path } : null;
  }
  return null;
}

// the build's manifest, read once an isolate and kept: the paths it lists
async function listed(env, config, manifests) {
  if (!manifests.has(config.build)) {
    manifests.set(config.build, (async () => {
      const object = await env.PLAY.get(config.site + 'manifest.json');
      if (!object) throw new Error('play-manifest-missing');
      return new Set((await object.json()).entries.map((e) => e.path));
    })());
  }
  try {
    return await manifests.get(config.build);
  } catch (error) {
    // (a failure isn't kept: the next request asks again)
    manifests.delete(config.build);
    throw error;
  }
}

const isolatedNotFound = () => new Response('Not found', { status: 404, headers: { ...ISOLATED, 'content-type': 'text/plain; charset=utf-8' } });

export async function servePlay(request, env, config, manifests, ctx = null, cache = null) {
  const url = new URL(request.url);
  const route = playRoute(url.pathname, config);
  if (!route) return null;
  if (!env.PLAY) return null;
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response(null, { status: 405, headers: { ...ISOLATED, allow: 'GET, HEAD' } });
  const immutable = route.root === 'site' && url.pathname.startsWith(ENGINE) && route.path !== 'index.html';
  const cacheable = cache && immutable && request.method === 'GET' && !request.headers.has('range');
  if (cacheable) {
    const hit = await cache.match(request);
    if (hit) return hit;
  }
  if (route.root === 'site' && !(await listed(env, config, manifests)).has(route.path)) return isolatedNotFound();
  const page = route.root === 'site' && route.path === 'index.html';
  // (the page whole, and its precondition the Worker's: its ETag isn't the object's)
  const object = await env.PLAY.get(route.key, page ? {} : { range: request.headers, onlyIf: request.headers });
  if (!object) return isolatedNotFound();
  const headers = new Headers({
    ...ISOLATED,
    'content-type': contentType(route.path),
    etag: object.httpEtag,
    'accept-ranges': 'bytes',
    'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'public, max-age=0, must-revalidate',
  });
  if (page) {
    const etag = `"${String(object.httpEtag).replace(/^W\/|"/g, '')}-${RETURN_VERSION}"`;
    headers.set('etag', etag);
    headers.delete('accept-ranges');
    if (request.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers });
    const html = new TextEncoder().encode(withReturn(await new Response(object.body).text()));
    headers.set('content-length', String(html.length));
    return new Response(request.method === 'HEAD' ? null : html, { status: 200, headers });
  }
  // (a precondition the object meets, If-None-Match among them: no body)
  if (!('body' in object) || !object.body) return new Response(null, { status: 304, headers });
  if (object.range && request.headers.has('range')) {
    const { offset = 0, length = object.size - offset } = object.range;
    headers.set('content-range', `bytes ${offset}-${offset + length - 1}/${object.size}`);
    headers.set('content-length', String(length));
    return new Response(request.method === 'HEAD' ? null : object.body, { status: 206, headers });
  }
  headers.set('content-length', String(object.size));
  const response = new Response(request.method === 'HEAD' ? null : object.body, { status: 200, headers });
  if (cacheable) {
    const put = cache.put(request, response.clone());
    if (ctx) ctx.waitUntil(put);
    else await put;
  }
  return response;
}

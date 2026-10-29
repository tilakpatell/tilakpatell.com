// bf2-web's play site, served by the Worker from the private bucket (docs/decisions/2026-10-28-hoth-on-bf2-web.md):
// the page bf2-web exports (WebPort/tools/export-play-site.mjs: the page, every file it loads, the front end's ui/
// and manifest.json) under /battlefront/engine/<build>/, read through the R2 binding PLAY. Its page also asks for
// three roots by absolute path, which bf2-web's own servers map: /ui/ (the front end, the site's copy beside the
// page; the site's own /ui/bf2017/ is left to its files), /export/ (the game's export, only the folders the
// front end and the HUD read) and /ui-data/ (the front end's rulebooks). Only a file the build's manifest lists is
// served from the build. Everything is cross-origin isolated, as the engine's threads need (COOP, COEP require-corp:
// the page loads nothing from another origin). A build's files are a year and immutable under its id; the roots,
// whose paths don't carry it, redirect to the requesting engine build's qualified path. Requests outside an engine
// page still use the current roots and revalidate. Previously published roots are explicitly retained by adoption;
// unpublished bucket builds are never discovered or served. The page itself is served with the site's
// way back added (playReturn.js), under an ETag of its object's and the script's, so a new script is a new page.
//
//   playRoute(pathname, config) → { key, root, path } | null   (null: not the play site's, the site's files answer)
//   servePlay(request, env, config, manifests, ctx?, cache?) → Promise<Response | null>
//     cache: the edge's (caches.default): a build's immutable file, asked whole, is answered from it and put in it,
//     so a visit after the first costs no read of the bucket
//   contentType(path)   ISOLATED: the headers   ENGINE: the page's path   /battlefront/engine/sw.js: engineCache.js's worker
//   <build>/tp-files.json: the paths the build's manifest lists, for that worker to read ahead of the engine's loader
// A build file the browser takes brotli for (Accept-Encoding br), asked whole, that the build has a brotli copy of
// (sites/<build>/<path>.br, listed in its encodings.json: scripts/bf2web-compress.mjs writes them for the binary files
// Cloudflare doesn't compress on its own, the textures and scene data, about a quarter of a first visit) is answered
// with that copy as it is, Content-Encoding br, for the browser to decode; it isn't kept at the edge.
// A read R2 fails (it can, now and then, and a level's load is some 2,500 reads) is asked once again; failing again,
// the answer is a plain 503, isolated, never Cloudflare's own HTML error page, which the engine would read as data.

import { FILES, WORKER_SOURCE } from './engineCache.js';
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

// Retention is an explicit publication record, not permission to read any build found in the bucket.
function configForBuild(config, build) {
  if (build === config?.build) return config;
  const retained = config?.retainedBuilds;
  return retained && Object.hasOwn(retained, build) ? { ...config, ...retained[build], build } : null;
}

function externalRoute(pathname, config) {
  if (pathname.startsWith('/ui-data/')) {
    const path = pathname.slice('/ui-data/'.length);
    return safe(path) ? { root: 'uiData', path, key: config.uiData + path } : null;
  }
  if (pathname.startsWith('/export/')) {
    const path = pathname.slice('/export/'.length);
    return safe(path) && config.exportAllow.some((p) => path.startsWith(p)) ? { root: 'export', path, key: config.export + path } : null;
  }
  return null;
}

export function playRoute(pathname, config) {
  if (!config?.build || !config.site) return null;
  if (pathname.startsWith(ENGINE)) {
    const [build, ...parts] = pathname.slice(ENGINE.length).split('/');
    const selected = configForBuild(config, build);
    if (!selected) return null;
    const path = parts.join('/') || 'index.html';
    if (path.startsWith('ui-data/') || path.startsWith('export/')) return externalRoute('/' + path, selected);
    return safe(path) ? { root: 'site', path, key: selected.site + path } : null;
  }
  if (pathname.startsWith('/ui/') && !pathname.startsWith('/ui/bf2017/')) {
    const path = 'ui/' + pathname.slice('/ui/'.length);
    return safe(path) ? { root: 'site', path, key: config.site + path } : null;
  }
  return externalRoute(pathname, config);
}

// an R2 read, asked once again when it throws; null for a key the bucket hasn't got
async function read(env, key, opts) {
  try {
    return await env.PLAY.get(key, opts);
  } catch {
    return env.PLAY.get(key, opts);
  }
}

// the build's manifest, read once an isolate and kept: the paths it lists
async function listed(env, config, manifests) {
  if (!manifests.has(config.build)) {
    manifests.set(config.build, (async () => {
      const object = await read(env, config.site + 'manifest.json');
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

// the build's brotli copies (encodings.json, written last by scripts/bf2web-compress.mjs), read once an isolate and
// kept: the paths that have one; none without the file
async function brotliCopies(env, config, manifests) {
  const key = `${config.build}#br`;
  if (!manifests.has(key)) {
    manifests.set(key, (async () => {
      const object = await read(env, config.site + 'encodings.json');
      return new Set(Object.keys(object ? (await object.json()).br ?? {} : {}));
    })());
  }
  try {
    return await manifests.get(key);
  } catch (error) {
    manifests.delete(key);
    throw error;
  }
}

const isolatedNotFound = () => new Response('Not found', { status: 404, headers: { ...ISOLATED, 'content-type': 'text/plain; charset=utf-8' } });
const unavailable = () =>
  new Response('Unavailable, try again', { status: 503, headers: { ...ISOLATED, 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'retry-after': '1' } });

// the service worker that keeps a build on the visitor's disk (engineCache.js), asked again each visit so a change
// reaches everyone
const engineWorkerScript = () =>
  new Response(WORKER_SOURCE, { status: 200, headers: { ...ISOLATED, 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'public, max-age=0, must-revalidate' } });

export async function servePlay(request, env, config, manifests, ctx = null, cache = null) {
  const url = new URL(request.url);
  if (url.pathname === ENGINE + 'sw.js' && config?.build) return engineWorkerScript();
  // Public entry addresses and an older build's page lead to the current build, with the query intact. The build
  // directory needs its trailing slash: otherwise the page's relative modules and assets resolve outside it.
  // These redirects name a moving build, so they are never cached. Explicitly retained files remain available
  // to already-open pages; fresh navigation to a build directory still starts the current version.
  const entry = url.pathname === '/battlefront' || url.pathname === '/battlefront/';
  const named = /^\/battlefront\/engine(?:\/([^/]+))?(?:\/(index\.html))?\/?$/.exec(url.pathname);
  if (config?.build && (entry || (named && named[1] !== 'sw.js' && (named[1] !== config.build || (!url.pathname.endsWith('/') && !named[2])))))
    return new Response(null, { status: 302, headers: { location: new URL(`${ENGINE}${config.build}/${url.search}`, url).toString(), 'cache-control': 'no-store' } });

  // Older exports request these roots by absolute URL. Redirect each request to the build that initiated it,
  // so relative imports use the final versioned module URL and HTTP caches cannot mix two generations at /ui/.
  // Same-origin referrers identify a published build only; they are never used as an R2 prefix or authorization.
  if (url.pathname.startsWith('/ui/') || url.pathname.startsWith('/ui-data/') || url.pathname.startsWith('/export/')) {
    let referringBuild = null;
    try {
      const referring = new URL(request.headers.get('referer'));
      if (referring.origin === url.origin) referringBuild = /^\/battlefront\/engine\/([^/]+)\//.exec(referring.pathname)?.[1] ?? null;
    } catch { /* normal unversioned request */ }
    if (referringBuild && !url.pathname.startsWith('/ui/bf2017/')) {
      const selected = configForBuild(config, referringBuild);
      if (!selected) return new Response('This build is no longer available. Reload to open the current version.', {
        status: 410, headers: { ...ISOLATED, 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
      });
      const target = `${ENGINE}${referringBuild}${url.pathname}`;
      if (playRoute(target, config)) {
        if (request.method !== 'GET' && request.method !== 'HEAD') return new Response(null, { status: 405, headers: { ...ISOLATED, allow: 'GET, HEAD' } });
        return new Response(null, {
          status: 302, headers: { ...ISOLATED, location: new URL(target + url.search, url).toString(), 'cache-control': 'no-store' },
        });
      }
    }
  }
  const route = playRoute(url.pathname, config);
  if (!route) return null;
  if (!env.PLAY) return null;
  const selected = url.pathname.startsWith(ENGINE) ? configForBuild(config, url.pathname.slice(ENGINE.length).split('/')[0]) : config;
  try {
    return await answer(request, url, route, env, selected, manifests, ctx, cache);
  } catch {
    return unavailable();
  }
}

async function answer(request, url, route, env, config, manifests, ctx, cache) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response(null, { status: 405, headers: { ...ISOLATED, allow: 'GET, HEAD' } });
  const immutable = route.root === 'site' && url.pathname.startsWith(ENGINE) && route.path !== 'index.html';
  const whole = !request.headers.has('range');
  // (the build's own list, unless the build has a file of that name)
  if (immutable && route.path === FILES) {
    const paths = await listed(env, config, manifests);
    if (!paths.has(FILES)) {
      const body = JSON.stringify({ build: config.build, files: [...paths] });
      return new Response(request.method === 'HEAD' ? null : body, {
        status: 200,
        headers: { ...ISOLATED, 'content-type': 'application/json', 'cache-control': 'public, max-age=31536000, immutable' },
      });
    }
  }
  if (immutable && whole && /\bbr\b/.test(request.headers.get('accept-encoding') ?? '')) {
    const listedPaths = await listed(env, config, manifests);
    if (!listedPaths.has(route.path)) return isolatedNotFound();
    if ((await brotliCopies(env, config, manifests)).has(route.path)) {
      const copy = await read(env, route.key + '.br', { onlyIf: request.headers });
      if (copy) {
        const headers = new Headers({
          ...ISOLATED,
          'content-type': contentType(route.path),
          'content-encoding': 'br',
          vary: 'accept-encoding',
          etag: copy.httpEtag,
          'cache-control': 'public, max-age=31536000, immutable',
        });
        if (!('body' in copy) || !copy.body) return new Response(null, { status: 304, headers });
        headers.set('content-length', String(copy.size));
        // (encodeBody manual: the bytes are brotli already, sent as they are)
        return new Response(request.method === 'HEAD' ? null : copy.body, { status: 200, headers, encodeBody: 'manual' });
      }
    }
  }
  const cacheable = cache && immutable && request.method === 'GET' && whole;
  if (cacheable) {
    try {
      const hit = await cache.match(request);
      if (hit) return hit;
    } catch { /* The edge cache is optional; the manifest-checked R2 read still answers. */ }
  }
  if (route.root === 'site' && !(await listed(env, config, manifests)).has(route.path)) return isolatedNotFound();
  const page = route.root === 'site' && route.path === 'index.html';
  // (the page whole, and its precondition the Worker's: its ETag isn't the object's)
  const object = await read(env, route.key, page ? {} : { range: request.headers, onlyIf: request.headers });
  if (!object) return isolatedNotFound();
  const headers = new Headers({
    ...ISOLATED,
    'content-type': contentType(route.path),
    etag: object.httpEtag,
    'accept-ranges': 'bytes',
    'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'public, max-age=0, must-revalidate',
    ...(immutable ? { vary: 'accept-encoding' } : {}),
  });
  if (page) {
    // Absolute-root requests from the document and its modules must retain the same-origin build path.
    headers.set('referrer-policy', 'same-origin');
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
    const copy = response.clone();
    const put = (async () => {
      try { await cache.put(request, copy); }
      catch {
        // Abandon the failed cache branch without awaiting the caller's still-unread body.
        try { copy.body?.cancel().catch(() => {}); } catch { /* already consumed or locked */ }
      }
    })();
    if (ctx) ctx.waitUntil(put);
    else await put;
  }
  return response;
}

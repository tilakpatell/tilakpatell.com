// bf2-web's play site, served by the Worker from the private bucket (docs/decisions/2026-10-28-hoth-on-bf2-web.md):
// the page bf2-web exports (WebPort/tools/export-play-site.mjs: the page, every file it loads, the front end's ui/
// and manifest.json) under /battlefront/engine/<build>/, read through the R2 binding PLAY. Its page also asks for
// three roots by absolute path, which bf2-web's own servers map: /ui/ (the front end, the site's copy beside the
// page; the site's own /ui/bf2017/ is left to its files), /export/ (the game's export, only the folders the
// front end and the HUD read) and /ui-data/ (the front end's rulebooks). Only a file the build's manifest lists is
// served from the build. Everything is cross-origin isolated, as the engine's threads need (COOP, COEP require-corp:
// the page loads nothing from another origin). A build's files are a year and immutable under its id; the roots,
// whose paths don't carry it, redirect to the requesting engine build's qualified path. Requests outside an engine
// page still use the current roots and revalidate. Previously published roots are explicitly retained by adoption,
// and a pre-uploaded build is explicitly staged (play.json's retainedBuilds / stagedBuilds): each is opened by its
// exact name, its page noindex and no-store; any other bucket build is never discovered or served. The page itself is served with the site's
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

// Retention and staging are explicit publication records, not permission to read any build found in the bucket:
// stagedBuilds (a build uploaded ahead of adoption, scripts/bf2web-adopt.mjs --stage) and retainedBuilds (the builds
// adoption moved off, the rollback among them) are served by their exact names; play.json's build stays the current one.
export function buildKind(config, build) {
  if (!build || !config?.build) return null;
  if (build === config.build) return 'current';
  if (config.stagedBuilds && Object.hasOwn(config.stagedBuilds, build)) return 'staged';
  if (config.retainedBuilds && Object.hasOwn(config.retainedBuilds, build)) return 'retained';
  return null;
}

function configForBuild(config, build) {
  const kind = buildKind(config, build);
  if (kind === 'current') return config;
  return kind ? { ...config, ...config[kind === 'staged' ? 'stagedBuilds' : 'retainedBuilds'][build], build } : null;
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

// Nothing the Worker waits on may wait forever (live r1073, 15 Nov 22:07Z and 22:32Z: a boot's first script request
// pending 15+ minutes with 0 bytes on a fresh profile, while the same file from the edge answered in under a second;
// tilak-06's query-busted probes stalled 2 of 40 past 20 s through the Worker, during a Cloudflare "Partially Degraded").
// A read that has not answered in time is a failure: asked once again, then a 503 with Retry-After, which the page's
// and the service worker's loaders already ask again. A cached manifest that has not arrived in time is dropped, so
// one stuck read cannot hold every later request of the isolate. The edge cache is optional: a lookup that does not
// answer in time is a miss. (TIMEOUTS is exported for the tests.)
export const TIMEOUTS = { read: 10_000, manifest: 15_000, cacheMatch: 3_000 };

class PlayTimeout extends Error {}
function timed(promise, ms, what) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new PlayTimeout(`play-timeout ${ms} ms: ${what}`)), ms); }),
  ]).finally(() => clearTimeout(timer));
}

// an R2 read, asked once again when it throws or does not answer in time; null for a key the bucket hasn't got
async function read(env, key, opts) {
  try {
    return await timed(env.PLAY.get(key, opts), TIMEOUTS.read, key);
  } catch {
    return timed(env.PLAY.get(key, opts), TIMEOUTS.read, key);
  }
}

// one value per isolate, read once and kept; a failure or a read past its time is not kept (only the promise this call
// waited on is dropped: a newer one another request put there stays)
async function kept(manifests, key, load) {
  if (!manifests.has(key)) manifests.set(key, timed(load(), TIMEOUTS.manifest, key));
  const pending = manifests.get(key);
  try {
    return await pending;
  } catch (error) {
    if (manifests.get(key) === pending) manifests.delete(key);
    throw error;
  }
}

// the build's manifest, read once an isolate and kept: the paths it lists
function listed(env, config, manifests) {
  return kept(manifests, config.build, async () => {
    const object = await read(env, config.site + 'manifest.json');
    if (!object) throw new Error('play-manifest-missing');
    return new Set((await object.json()).entries.map((e) => e.path));
  });
}

// the build's brotli copies (encodings.json, written last by scripts/bf2web-compress.mjs), read once an isolate and
// kept: the paths that have one; none without the file
function brotliCopies(env, config, manifests) {
  return kept(manifests, `${config.build}#br`, async () => {
    const object = await read(env, config.site + 'encodings.json');
    return new Set(Object.keys(object ? (await object.json()).br ?? {} : {}));
  });
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
  // Public entry addresses lead to the current build, with the query intact, and so does a build directory that
  // names no build play.json knows. A build play.json names (current, staged or retained) is opened by its exact
  // name: a staged build can be gated on the hosted path before adoption and the rollback opened as a control.
  // The build directory needs its trailing slash: otherwise the page's relative modules and assets resolve outside it.
  // These redirects are never cached.
  const entry = url.pathname === '/battlefront' || url.pathname === '/battlefront/';
  const named = /^\/battlefront\/engine(?:\/([^/]+))?(?:\/(index\.html))?\/?$/.exec(url.pathname);
  if (config?.build && (entry || (named && named[1] !== 'sw.js'))) {
    const known = !entry && buildKind(config, named[1]) ? named[1] : null;
    if (!known || (!url.pathname.endsWith('/') && !named[2]))
      return new Response(null, { status: 302, headers: { location: new URL(`${ENGINE}${known ?? config.build}/${url.search}`, url).toString(), 'cache-control': 'no-store' } });
  }

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
  const build = url.pathname.startsWith(ENGINE) ? url.pathname.slice(ENGINE.length).split('/')[0] : config.build;
  const selected = configForBuild(config, build);
  // (a staged or retained build is not the site: never indexed, and its page never kept by a cache)
  const preview = buildKind(config, build) !== 'current';
  try {
    return await answer(request, url, route, env, selected, manifests, ctx, cache, preview);
  } catch {
    return unavailable();
  }
}

async function answer(request, url, route, env, config, manifests, ctx, cache, preview = false) {
  const response = await answerBuild(request, url, route, env, config, manifests, ctx, cache);
  if (!preview || !response) return response;
  // (headers of a Response read from the edge cache are immutable: copied onto a new one)
  const headers = new Headers(response.headers);
  headers.set('x-robots-tag', 'noindex');
  if (route.root === 'site' && route.path === 'index.html') headers.set('cache-control', 'no-store');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers, ...(headers.get('content-encoding') === 'br' ? { encodeBody: 'manual' } : {}) });
}

async function answerBuild(request, url, route, env, config, manifests, ctx, cache) {
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
  const cacheable = cache && immutable && request.method === 'GET' && whole;
  const takesBrotli = /\bbr\b/.test(request.headers.get('accept-encoding') ?? '');
  const brotli = (body, etag, size, state) => {
    const headers = new Headers({
      ...ISOLATED,
      'content-type': contentType(route.path),
      'content-encoding': 'br',
      vary: 'accept-encoding',
      etag,
      'cache-control': 'public, max-age=31536000, immutable',
      'x-play-cache': state,
    });
    if (!body) return new Response(null, { status: 304, headers });
    if (size != null) headers.set('content-length', String(size));
    // (encodeBody manual: the bytes are brotli already, sent as they are)
    return new Response(request.method === 'HEAD' ? null : body, { status: 200, headers, encodeBody: 'manual' });
  };
  const fromEdge = async () => {
    const hit = await edgeMatch(cache, url, 'identity');
    if (!hit) return null;
    const headers = new Headers(hit.headers);
    headers.set('vary', 'accept-encoding');
    headers.set('x-play-cache', 'hit');
    if (notModified(request, hit)) { headers.delete('content-length'); return new Response(null, { status: 304, headers }); }
    return new Response(hit.body, { status: 200, headers });
  };
  // A build file the edge already holds is answered before any read of the bucket, the build's manifest and encodings list
  // among them (16 Nov, boot hangs: after a deploy every isolate is cold, and a browser's first request, br, read the 5.4 MB
  // manifest from R2 before the edge was asked; a client without br went straight to the edge). Safe without the manifest: a
  // copy is put only after a manifest-checked whole read of a listed file, under its build's immutable path, and a build
  // play.json does not name never reaches this function.
  // Which entry: a browser that takes br gets the br copy of a file that can have one (only application/octet-stream files
  // get one, scripts/bf2web-compress.mjs compressible, by this module's contentType), so for those only the br entry is taken
  // edge-first; on its miss the brotli branch below reads and stores the copy. Every other file (the engine's .js and .wasm,
  // the JSON) never has a br copy, and its own entry is the answer for any client ([c5] on abe9d8522: an identity entry put by a
  // client without br must not be served, uncompressed, to a browser in place of a .res or .glb's br copy).
  if (cacheable) {
    const mayHaveCopy = contentType(route.path) === 'application/octet-stream';
    if (takesBrotli && mayHaveCopy) {
      const hit = await edgeMatch(cache, url, 'br');
      if (hit) return brotli(notModified(request, hit) ? null : hit.body, hit.headers.get('etag'), hit.headers.get('content-length'), 'hit');
    } else {
      const plain = await fromEdge();
      if (plain) return plain;
    }
  }
  if (immutable && whole && takesBrotli) {
    const listedPaths = await listed(env, config, manifests);
    if (!listedPaths.has(route.path)) return isolatedNotFound();
    if ((await brotliCopies(env, config, manifests)).has(route.path)) {
      const copy = await read(env, route.key + '.br', { onlyIf: request.headers });
      if (copy) {
        if (!('body' in copy) || !copy.body) return brotli(null, copy.httpEtag, null, 'miss');
        let body = copy.body;
        if (cacheable) {
          const [sent, kept] = streamOf(body).tee();
          body = sent;
          await edgePut(cache, url, 'br', kept, {
            'content-type': 'application/octet-stream', etag: copy.httpEtag, 'content-length': String(copy.size), 'cache-control': 'public, max-age=31536000, immutable',
          }, ctx);
        }
        return brotli(body, copy.httpEtag, copy.size, cacheable ? 'miss' : 'off');
      }
    }
  }
  // (a br client's octet-stream file that has no br copy: its own entry, as #1322 had it)
  if (cacheable && takesBrotli && contentType(route.path) === 'application/octet-stream') {
    const plain = await fromEdge();
    if (plain) return plain;
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
  if (immutable) headers.set('x-play-cache', cacheable ? 'miss' : 'off');
  let body = request.method === 'HEAD' ? null : object.body;
  if (cacheable && body) {
    const [sent, kept] = streamOf(body).tee();
    body = sent;
    const stored = new Headers(headers);
    stored.delete('vary');
    stored.delete('x-play-cache');
    await edgePut(cache, url, 'identity', kept, stored, ctx);
  }
  return new Response(body, { status: 200, headers });
}

// The edge cache (caches.default), keyed by the file's URL and its encoding variant, with no request header in the key.
// A stored copy holds no Vary and no Content-Encoding (a brotli copy is kept as the bytes it is, octet-stream), so
// neither the cache nor the runtime recodes or varies it; the response's encoding headers are put back on the way out.
// x-play-cache on a build file says which: hit, miss (read from R2, put at the edge) or off (not cacheable).
const edgeKey = (url, variant) => {
  const key = new URL(url);
  key.searchParams.append('play-encoding', variant);
  return new Request(key.toString(), { method: 'GET' });
};

async function edgeMatch(cache, url, variant) {
  try {
    return (await timed(cache.match(edgeKey(url, variant)), TIMEOUTS.cacheMatch, 'edge cache')) ?? null;
  } catch {
    return null; // (the edge cache is optional, and a lookup past its time is a miss; the manifest-checked R2 read still answers)
  }
}

async function edgePut(cache, url, variant, body, headers, ctx) {
  const put = (async () => {
    try { await cache.put(edgeKey(url, variant), new Response(body, { status: 200, headers })); }
    catch {
      // Abandon the failed cache branch without awaiting the caller's still-unread body.
      try { body?.cancel().catch(() => {}); } catch { /* already consumed or locked */ }
    }
  })();
  if (ctx) ctx.waitUntil(put);
  else await put;
}

// (an R2 body is a stream; anything else, as a test's bucket gives, is made one so it can be split for the edge)
const streamOf = (body) => (body instanceof ReadableStream ? body : new Response(body).body);

// a conditional request the stored copy meets (If-None-Match, weak or strong, one of a list)
function notModified(request, stored) {
  const asked = request.headers.get('if-none-match');
  const etag = stored.headers.get('etag');
  if (!asked || !etag) return false;
  const bare = (t) => t.trim().replace(/^W\//, '');
  return asked.trim() === '*' || asked.split(',').some((t) => bare(t) === bare(etag));
}

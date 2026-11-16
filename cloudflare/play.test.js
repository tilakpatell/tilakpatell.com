import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ENGINE, ISOLATED, TIMEOUTS, buildKind, contentType, playRoute, servePlay } from './play.js';
import { RETURN_VERSION } from './playReturn.js';

const config = { build: 'b1', site: 'sites/b1/', export: 'extract/', uiData: 'library/ui/frontend/', exportAllow: ['fonts/', 'strings/'] };
const manifest = { schema: 'bf2-play-site/1', entries: ['index.html', 'original-frame-graph.js', 'original-frame-graph.wasm', 'scene.json', 'scene-r-0.res', 'ui/main.js', 'runtime/world-play.mjs'].map((path) => ({ path })) };

// an R2 binding over a map of keys to text, answering ranges and If-None-Match as R2 does
function bucket(files) {
  const gets = [];
  return {
    gets,
    async get(key, opts = {}) {
      gets.push(key);
      if (!(key in files)) return null;
      const bytes = new TextEncoder().encode(files[key]);
      const httpEtag = `"${key.length}"`;
      if (opts.onlyIf?.get?.('if-none-match') === httpEtag) return { size: bytes.length, httpEtag };
      const m = /^bytes=(\d+)-(\d+)$/.exec(opts.range?.get?.('range') ?? '');
      const range = m ? { offset: Number(m[1]), length: Number(m[2]) - Number(m[1]) + 1 } : undefined;
      const body = range ? bytes.slice(range.offset, range.offset + range.length) : bytes;
      return { size: bytes.length, httpEtag, range, body, json: async () => JSON.parse(files[key]) };
    },
  };
}
const files = {
  'sites/b1/manifest.json': JSON.stringify(manifest),
  'sites/b1/index.html': '<!doctype html>',
  'sites/b1/original-frame-graph.wasm': 'wasm-bytes',
  'sites/b1/ui/main.js': 'export {}',
  'sites/b1/secret.bin': 'not listed',
  'sites/b1/scene-r-0.res': 'scene bytes, whole',
  'sites/b1/scene-r-0.res.br': 'BR',
  'sites/b1/encodings.json': JSON.stringify({ schema: 'bf2-play-encodings/1', br: { 'scene-r-0.res': 2 } }),
  'extract/fonts/a.ttf': 'font',
  'extract/models/a.glb': 'model',
  'library/ui/frontend/screens.json': '{}',
};
const ask = (path, headers = {}) => new Request(`https://tilakpatell.com${path}`, { headers });
const serve = (path, headers, env = { PLAY: bucket(files) }) => servePlay(ask(path, headers), env, config, new Map());

describe('an open build across a deployment', () => {
  const previous = { site: 'sites/b0/', uiData: 'sites/b0/ui-data/', export: 'extract-old/', exportAllow: ['fonts/'] };
  const next = { ...config, uiData: 'sites/b1/ui-data/', retainedBuilds: { b0: previous } };
  const oldFiles = { ...files,
    'sites/b0/manifest.json': JSON.stringify(manifest),
    'sites/b0/index.html': '<!doctype html><title>b0</title>',
    'sites/b0/runtime/world-play.mjs': 'old runtime',
    'sites/b0/ui/main.js': 'old UI',
    'sites/b0/ui-data/screens.json': 'old rules',
    'sites/b1/ui-data/screens.json': 'new rules',
    'extract-old/fonts/a.ttf': 'old font',
    'sites/unpublished/manifest.json': JSON.stringify(manifest),
    'sites/unpublished/ui/main.js': 'private unadopted UI',
  };

  it('keeps only explicitly retained build files available and manifest-checked', async () => {
    const env = { PLAY: bucket(oldFiles) }, manifests = new Map();
    for (const [path, expected] of [['runtime/world-play.mjs', 'old runtime'], ['ui/main.js', 'old UI'], ['ui-data/screens.json', 'old rules'], ['export/fonts/a.ttf', 'old font']]) {
      const res = await servePlay(ask(`${ENGINE}b0/${path}`), env, next, manifests);
      expect(res?.status, path).toBe(200);
      expect(await res.text()).toBe(expected);
    }
    expect((await servePlay(ask(`${ENGINE}b0/not-listed.js`), env, next, manifests)).status).toBe(404);
    expect(await servePlay(ask(`${ENGINE}unpublished/ui/main.js`), env, next, manifests)).toBeNull();
    expect(env.PLAY.gets.some(key => key.startsWith('sites/unpublished/'))).toBe(false);
    // (a retained build is opened by its exact name, the rollback as a control; an unknown name still leads to the current)
    expect((await servePlay(ask(`${ENGINE}b0/`), env, next, manifests)).status).toBe(200);
    expect((await servePlay(ask(`${ENGINE}b0/index.html?from=/galaxy/hoth`), env, next, manifests)).status).toBe(200);
    expect((await servePlay(ask(`${ENGINE}b0?from=/galaxy/hoth`), env, next, manifests)).headers.get('location')).toBe(`https://tilakpatell.com${ENGINE}b0/?from=/galaxy/hoth`);
    expect((await servePlay(ask(`${ENGINE}unpublished/`), env, next, manifests)).headers.get('location')).toBe(`https://tilakpatell.com${ENGINE}b1/`);
    expect((await servePlay(ask(`${ENGINE}b1/index.html`), env, next, manifests)).status).toBe(200);
  });

  it('pins buildless UI, rulebooks and export requests to the referring engine build', async () => {
    const env = { PLAY: bucket(oldFiles) }, manifests = new Map();
    for (const path of ['/ui/main.js', '/ui-data/screens.json', '/export/fonts/a.ttf']) {
      for (const build of ['b0', 'b1']) {
        const res = await servePlay(ask(path + '?v=1', { referer: `https://tilakpatell.com${ENGINE}${build}/runtime/world-play.mjs` }), env, next, manifests);
        expect(res.status).toBe(302);
        expect(res.headers.get('location')).toBe(`https://tilakpatell.com${ENGINE}${build}${path}?v=1`);
        expect(res.headers.get('cache-control')).toBe('no-store');
      }
    }
    const unavailable = await servePlay(ask('/ui/main.js', { referer: `https://tilakpatell.com${ENGINE}unpublished/` }), env, next, manifests);
    expect(unavailable.status).toBe(410);
    expect(unavailable.headers.get('cache-control')).toBe('no-store');
    for (const referer of ['', 'https://elsewhere.test/battlefront/engine/b0/', 'https://tilakpatell.com/galaxy']) {
      const res = await servePlay(ask('/ui/main.js', { referer }), env, next, manifests);
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('export {}');
    }
    const post = new Request('https://tilakpatell.com/ui/main.js', { method: 'POST', headers: { referer: `https://tilakpatell.com${ENGINE}b0/` } });
    expect((await servePlay(post, env, next, manifests)).status).toBe(405);
  });
});

describe('the play site’s routes', () => {
  it('maps the build’s page and files, and refuses another build or a climb', () => {
    expect(playRoute(`${ENGINE}b1/`, config)).toEqual({ root: 'site', path: 'index.html', key: 'sites/b1/index.html' });
    expect(playRoute(`${ENGINE}b1/runtime/world-play.mjs`, config).key).toBe('sites/b1/runtime/world-play.mjs');
    expect(playRoute(`${ENGINE}b0/index.html`, config)).toBeNull();
    expect(playRoute(`${ENGINE}b1/../secret`, config)).toBeNull();
  });

  it('maps the page’s absolute roots, leaving the site’s own /ui/bf2017/ to its files', () => {
    expect(playRoute('/ui/style.css', config).key).toBe('sites/b1/ui/style.css');
    expect(playRoute('/ui/bf2017/icons.png', config)).toBeNull();
    expect(playRoute('/export/fonts/a.ttf', config).key).toBe('extract/fonts/a.ttf');
    expect(playRoute('/export/models/a.glb', config)).toBeNull();
    expect(playRoute('/ui-data/screens.json', config).key).toBe('library/ui/frontend/screens.json');
  });

  it('serves nothing while no build is published', () => {
    expect(playRoute(`${ENGINE}b1/`, { ...config, build: null })).toBeNull();
    expect(playRoute('/ui/style.css', { ...config, build: null })).toBeNull();
  });

  it('names the types the engine needs', () => {
    expect(contentType('original-frame-graph.wasm')).toBe('application/wasm');
    expect(contentType('runtime/world-play.mjs')).toMatch(/^text\/javascript/);
    expect(contentType('scene-m-3.res')).toBe('application/octet-stream');
  });
});

describe('serving the play site', () => {
  it('serves a listed file cross-origin isolated, a year under its build', async () => {
    const res = await serve(`${ENGINE}b1/original-frame-graph.wasm`);
    expect(res.status).toBe(200);
    for (const [k, v] of Object.entries(ISOLATED)) expect(res.headers.get(k)).toBe(v);
    expect(res.headers.get('content-type')).toBe('application/wasm');
    expect(res.headers.get('cache-control')).toContain('immutable');
    expect(await res.text()).toBe('wasm-bytes');
  });

  it('asks the page again each visit, and answers its ETag with a 304', async () => {
    const page = await serve(`${ENGINE}b1/`);
    expect(page.headers.get('cache-control')).toContain('max-age=0');
    expect(page.headers.get('referrer-policy')).toBe('same-origin');
    const again = await serve(`${ENGINE}b1/`, { 'if-none-match': page.headers.get('etag') });
    expect(again.status).toBe(304);
  });

  it('serves the page with the way back added, under an ETag the script is part of', async () => {
    const res = await serve(`${ENGINE}b1/`);
    expect(res.headers.get('etag')).toBe(`"${'sites/b1/index.html'.length}-${RETURN_VERSION}"`);
    const html = await res.text();
    expect(html.startsWith('<!doctype html><script>(')).toBe(true);
    expect(res.headers.get('content-length')).toBe(String(new TextEncoder().encode(html).length));
    expect((await serve(`${ENGINE}b1/`, { range: 'bytes=0-3' })).status).toBe(200);
  });

  it('refuses a file the manifest doesn’t list, even when the bucket has it', async () => {
    const env = { PLAY: bucket(files) };
    const res = await serve(`${ENGINE}b1/secret.bin`, {}, env);
    expect(res.status).toBe(404);
    expect(env.PLAY.gets).not.toContain('sites/b1/secret.bin');
  });

  it('answers a range with those bytes', async () => {
    const res = await serve(`${ENGINE}b1/original-frame-graph.wasm`, { range: 'bytes=0-3' });
    expect(res.status).toBe(206);
    expect(res.headers.get('content-range')).toBe('bytes 0-3/10');
    expect(await res.text()).toBe('wasm');
  });

  it('serves the front end and the export’s allowed folders, and leaves the rest to the site', async () => {
    expect((await serve('/ui/main.js')).status).toBe(200);
    expect((await serve('/export/fonts/a.ttf')).status).toBe(200);
    expect(await serve('/export/models/a.glb')).toBeNull();
    expect(await serve('/ui/bf2017/icons.png')).toBeNull();
    expect(await serve('/universe')).toBeNull();
  });

  it('keeps a build’s file at the edge after the first read, and serves it from there', async () => {
    const env = { PLAY: bucket(files) };
    const kept = new Map();
    const cache = { match: async (r) => kept.get(r.url)?.clone() ?? null, put: async (r, res) => void kept.set(r.url, res) };
    const first = await servePlay(ask(`${ENGINE}b1/original-frame-graph.wasm`), env, config, new Map(), null, cache);
    expect(await first.text()).toBe('wasm-bytes');
    const reads = env.PLAY.gets.length;
    const second = await servePlay(ask(`${ENGINE}b1/original-frame-graph.wasm`), env, config, new Map(), null, cache);
    expect(await second.text()).toBe('wasm-bytes');
    expect(env.PLAY.gets.length).toBe(reads);
    // (the page and a range are never kept)
    await servePlay(ask(`${ENGINE}b1/`), env, config, new Map(), null, cache);
    expect(kept.has(`https://tilakpatell.com${ENGINE}b1/`)).toBe(false);
  });

  it('keeps a brotli copy at the edge too, apart from the file itself, and serves both from there', async () => {
    // (hosted 15 Nov, r1073: a look's .glb files, brotli copies, were a Worker-to-R2 read every time: first byte
    // 163 ms median the first time, 188 ms the second; the cache was looked up only after the brotli branch returned)
    const env = { PLAY: bucket(files) };
    const kept = new Map();
    const cache = { match: async (r) => kept.get(r.url)?.clone() ?? null, put: async (r, res) => void kept.set(r.url, res) };
    const path = `${ENGINE}b1/scene-r-0.res`, br = { 'accept-encoding': 'gzip, br' };
    const first = await servePlay(ask(path, br), env, config, new Map(), null, cache);
    expect(first.headers.get('content-encoding')).toBe('br');
    expect(first.headers.get('x-play-cache')).toBe('miss');
    expect(await first.text()).toBe('BR');
    const reads = env.PLAY.gets.length;
    const second = await servePlay(ask(path, br), env, config, new Map(), null, cache);
    expect(second.status).toBe(200);
    expect(second.headers.get('x-play-cache')).toBe('hit');
    expect(second.headers.get('content-encoding')).toBe('br');
    expect(second.headers.get('vary')).toBe('accept-encoding');
    expect(second.headers.get('cross-origin-embedder-policy')).toBe('require-corp');
    expect(second.headers.get('etag')).toBe(first.headers.get('etag'));
    expect(second.headers.get('content-length')).toBe('2');
    expect(await second.text()).toBe('BR');
    expect(env.PLAY.gets.slice(reads).filter((k) => k.endsWith('.br'))).toEqual([]);
    // (a browser that doesn't take brotli gets the file itself, never the edge's brotli copy)
    const plain = await servePlay(ask(path), env, config, new Map(), null, cache);
    expect(plain.headers.has('content-encoding')).toBe(false);
    expect(await plain.text()).toBe('scene bytes, whole');
    const plainAgain = await servePlay(ask(path), env, config, new Map(), null, cache);
    expect(plainAgain.headers.get('x-play-cache')).toBe('hit');
    const isolatedTyped = (res, what) => {
      for (const [k, v] of Object.entries(ISOLATED)) expect(res.headers.get(k), `${what} ${k}`).toBe(v);
      expect(res.headers.get('content-type'), what).toBe('application/octet-stream');
    };
    isolatedTyped(plainAgain, 'identity hit');
    expect(await plainAgain.text()).toBe('scene bytes, whole');
    const plain304 = await servePlay(ask(path, { 'if-none-match': plainAgain.headers.get('etag') }), env, config, new Map(), null, cache);
    expect(plain304.status).toBe(304);
    isolatedTyped(plain304, 'identity 304');
    // (a range is never answered from the edge's whole copy: R2's bytes, 206, whichever encoding the browser takes)
    for (const headers of [{ range: 'bytes=0-4' }, { range: 'bytes=0-4', 'accept-encoding': 'br' }]) {
      const ranged = await servePlay(ask(path, headers), env, config, new Map(), null, cache);
      expect(ranged.status, JSON.stringify(headers)).toBe(206);
      expect(ranged.headers.get('content-range')).toBe('bytes 0-4/18');
      expect(ranged.headers.has('x-play-cache')).toBe(false);
      expect(ranged.headers.has('content-encoding')).toBe(false);
      expect(await ranged.text()).toBe('scene');
    }
    // (what is stored holds no Vary and no Content-Encoding, so neither the edge nor the runtime recodes it)
    expect(kept.size).toBe(2);
    for (const stored of kept.values()) {
      expect(stored.headers.has('vary')).toBe(false);
      expect(stored.headers.has('content-encoding')).toBe(false);
      expect(stored.headers.has('x-play-cache')).toBe(false);
    }
  });

  it('answers a conditional request a stored copy meets with a 304, either encoding', async () => {
    const env = { PLAY: bucket(files) };
    const kept = new Map();
    const cache = { match: async (r) => kept.get(r.url)?.clone() ?? null, put: async (r, res) => void kept.set(r.url, res) };
    const path = `${ENGINE}b1/scene-r-0.res`;
    for (const encoding of [{ 'accept-encoding': 'br' }, {}]) {
      const first = await servePlay(ask(path, encoding), env, config, new Map(), null, cache);
      const etag = first.headers.get('etag');
      await first.text();
      const again = await servePlay(ask(path, { ...encoding, 'if-none-match': `W/${etag}` }), env, config, new Map(), null, cache);
      expect(again.status).toBe(304);
      expect(again.headers.get('x-play-cache')).toBe('hit');
    }
  });

  it('says a build file was not cacheable when there is no edge cache, and never on the page', async () => {
    const env = { PLAY: bucket(files) };
    expect((await servePlay(ask(`${ENGINE}b1/original-frame-graph.wasm`), env, config, new Map())).headers.get('x-play-cache')).toBe('off');
    expect((await servePlay(ask(`${ENGINE}b1/scene-r-0.res`, { 'accept-encoding': 'br' }), env, config, new Map())).headers.get('x-play-cache')).toBe('off');
    expect((await servePlay(ask(`${ENGINE}b1/`), env, config, new Map())).headers.has('x-play-cache')).toBe(false);
  });

  it('serves the R2 asset when the optional edge cache cannot read', async () => {
    const cache = { match: async () => { throw new Error('edge cache read unavailable'); }, put: async () => {} };
    const env = { PLAY: bucket(files) };
    const response = await servePlay(ask(`${ENGINE}b1/original-frame-graph.wasm`), env, config, new Map(), null, cache);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('wasm-bytes');
    expect(response.headers.get('cross-origin-embedder-policy')).toBe('require-corp');
    expect(response.headers.get('cache-control')).toContain('immutable');
    expect(env.PLAY.gets).toContain('sites/b1/original-frame-graph.wasm');
    const unlisted = await servePlay(ask(`${ENGINE}b1/secret.bin`), env, config, new Map(), null, cache);
    expect(unlisted.status).toBe(404);
    expect(env.PLAY.gets).not.toContain('sites/b1/secret.bin');
  });

  it.each(['throw', 'reject'])('serves the asset when edge cache writes %s, with or without a Worker context', async (failure) => {
    const cache = { match: async () => null, put: () => {
      if (failure === 'throw') throw new Error('edge cache write unavailable');
      return Promise.reject(new Error('edge cache write unavailable'));
    } };
    for (const context of [false, true]) {
      const pending = [], ctx = context ? { waitUntil: promise => pending.push(promise) } : null;
      const response = await servePlay(ask(`${ENGINE}b1/original-frame-graph.wasm`), { PLAY: bucket(files) }, config, new Map(), ctx, cache);
      expect(response.status).toBe(200);
      expect(await response.text()).toBe('wasm-bytes');
      if (context) {
        expect(pending).toHaveLength(1);
        expect((await Promise.allSettled(pending)).map(result => result.status)).toEqual(['fulfilled']);
      }
    }
  });

  it('still reports an R2 outage when the edge cache cannot read', async () => {
    const cache = { match: async () => { throw new Error('edge cache unavailable'); }, put: async () => {} };
    let reads = 0;
    const env = { PLAY: { get: async () => { reads++; throw new Error('R2 unavailable'); } } };
    const response = await servePlay(ask(`${ENGINE}b1/original-frame-graph.wasm`), env, config, new Map(), null, cache);
    expect(response.status).toBe(503);
    expect(response.headers.get('retry-after')).toBe('1');
    expect(reads).toBe(2);
  });

  it('asks R2 again when a read fails, and answers a 503 of its own when it fails again', async () => {
    const flaky = (fails) => {
      const inner = bucket(files);
      let left = fails;
      return { gets: inner.gets, get: async (key, opts) => (left-- > 0 ? Promise.reject(new Error('Network connection lost')) : inner.get(key, opts)) };
    };
    const once = await serve(`${ENGINE}b1/original-frame-graph.wasm`, {}, { PLAY: flaky(1) });
    expect(once.status).toBe(200);
    expect(await once.text()).toBe('wasm-bytes');
    const down = await serve(`${ENGINE}b1/original-frame-graph.wasm`, {}, { PLAY: flaky(99) });
    expect(down.status).toBe(503);
    expect(down.headers.get('cross-origin-embedder-policy')).toBe('require-corp');
    expect(down.headers.get('cache-control')).toBe('no-store');
    expect(down.headers.get('content-type')).toMatch(/^text\/plain/);
  });

  it('sends a build file’s brotli copy, whole, to a browser that takes brotli, for it to decode', async () => {
    const env = { PLAY: bucket(files) };
    const res = await serve(`${ENGINE}b1/scene-r-0.res`, { 'accept-encoding': 'gzip, deflate, br, zstd' }, env);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-encoding')).toBe('br');
    expect(res.headers.get('content-type')).toBe('application/octet-stream');
    expect(res.headers.get('vary')).toBe('accept-encoding');
    expect(res.headers.get('accept-ranges')).toBeNull();
    expect(res.headers.get('cross-origin-embedder-policy')).toBe('require-corp');
    expect(await res.text()).toBe('BR');
    expect(env.PLAY.gets).toContain('sites/b1/scene-r-0.res.br');
  });

  it('sends the file itself to a browser that doesn’t take brotli, for a range, and for a file with no copy', async () => {
    expect(await (await serve(`${ENGINE}b1/scene-r-0.res`, { 'accept-encoding': 'gzip' })).text()).toBe('scene bytes, whole');
    const ranged = await serve(`${ENGINE}b1/scene-r-0.res`, { 'accept-encoding': 'br', range: 'bytes=0-4' });
    expect(ranged.status).toBe(206);
    expect(ranged.headers.get('content-encoding')).toBeNull();
    const plain = await serve(`${ENGINE}b1/original-frame-graph.wasm`, { 'accept-encoding': 'br' });
    expect(plain.headers.get('content-encoding')).toBeNull();
    expect(await plain.text()).toBe('wasm-bytes');
    // (a build without encodings.json: every file as itself)
    const bare = { ...files };
    delete bare['sites/b1/encodings.json'];
    expect(await (await serve(`${ENGINE}b1/scene-r-0.res`, { 'accept-encoding': 'br' }, { PLAY: bucket(bare) })).text()).toBe('scene bytes, whole');
  });

  it('answers the brotli copy’s ETag with a 304', async () => {
    const first = await serve(`${ENGINE}b1/scene-r-0.res`, { 'accept-encoding': 'br' });
    const again = await serve(`${ENGINE}b1/scene-r-0.res`, { 'accept-encoding': 'br', 'if-none-match': first.headers.get('etag') });
    expect(again.status).toBe(304);
    expect(again.headers.get('content-encoding')).toBe('br');
  });

  it('serves the worker that keeps a build on disk, asked again each visit', async () => {
    const res = await serve(`${ENGINE}sw.js`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/^text\/javascript/);
    expect(res.headers.get('cache-control')).toContain('max-age=0');
    expect(await res.text()).toContain('tp-engine-');
  });

  it('lists the build’s files for that worker to read ahead, a year under the build, whatever the browser takes', async () => {
    for (const headers of [{}, { 'accept-encoding': 'br' }]) {
      const res = await serve(`${ENGINE}b1/tp-files.json`, headers);
      expect(res.status).toBe(200);
      expect(res.headers.get('cache-control')).toContain('immutable');
      expect(res.headers.get('cross-origin-embedder-policy')).toBe('require-corp');
      expect(await res.json()).toEqual({ build: 'b1', files: manifest.entries.map((e) => e.path) });
    }
    expect(await serve(`${ENGINE}b0/tp-files.json`)).toBeNull();
  });

  it('leaves everything to the site without the binding', async () => {
    expect(await serve(`${ENGINE}b1/`, {}, {})).toBeNull();
  });
});

describe('nothing the Worker waits on waits forever (live r1073 boot hangs, 15 Nov)', () => {
  const never = () => new Promise(() => {});
  const short = async (fn) => {
    const saved = { ...TIMEOUTS };
    Object.assign(TIMEOUTS, { read: 30, manifest: 120, cacheMatch: 30 });
    try { await fn(); } finally { Object.assign(TIMEOUTS, saved); }
  };
  const path = `${ENGINE}b1/original-frame-graph.wasm`;

  it('a read that never answers is asked once again, then answered 503 with Retry-After', () => short(async () => {
    const inner = bucket(files);
    let reads = 0;
    const env = { PLAY: { get: (key, opts) => (key.endsWith('.wasm') ? (reads++, never()) : inner.get(key, opts)) } };
    const res = await servePlay(ask(path), env, config, new Map());
    expect(res.status).toBe(503);
    expect(res.headers.get('retry-after')).toBe('1');
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(reads).toBe(2);
  }), 5000);

  it('a manifest that never arrives is dropped, so the isolate answers once the bucket does', () => short(async () => {
    const manifests = new Map();
    const inner = bucket(files);
    // (the manifest's object arrives, its body never does: only the manifest's own time limit can end it)
    const stuck = { PLAY: { get: (key, opts) => (key.endsWith('manifest.json') ? Promise.resolve({ json: never }) : inner.get(key, opts)) } };
    expect((await servePlay(ask(path), stuck, config, manifests)).status).toBe(503);
    const res = await servePlay(ask(path), { PLAY: bucket(files) }, config, manifests);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('wasm-bytes');
  }), 5000);

  it('an edge cache lookup that never answers is a miss: the bucket answers', () => short(async () => {
    const cache = { match: never, put: async () => {} };
    const res = await servePlay(ask(path), { PLAY: bucket(files) }, config, new Map(), null, cache);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('wasm-bytes');
  }), 5000);
});

describe('opening a build by its exact name: current, staged, retained', () => {
  // (r1074 gated on the hosted path before adoption; r1072, the rollback, opened beside r1073 as a control)
  const named = { ...config, uiData: 'sites/b1/ui-data/',
    stagedBuilds: { s2: { site: 'sites/s2/', export: 'extract/', uiData: 'sites/s2/ui-data/', exportAllow: ['fonts/'] } },
    retainedBuilds: { b0: { site: 'sites/b0/', export: 'extract-old/', uiData: 'sites/b0/ui-data/', exportAllow: ['fonts/'] } } };
  const pages = { ...files };
  for (const b of ['b0', 's2']) Object.assign(pages, {
    [`sites/${b}/manifest.json`]: JSON.stringify(manifest), [`sites/${b}/index.html`]: `<!doctype html><title>${b}</title>`,
    [`sites/${b}/ui/main.js`]: `${b} UI`, [`sites/${b}/ui-data/screens.json`]: `${b} rules`, [`sites/${b}/runtime/world-play.mjs`]: `${b} runtime`,
  });
  Object.assign(pages, { 'sites/b1/ui-data/screens.json': 'b1 rules', 'extract-old/fonts/a.ttf': 'b0 font', 'sites/unknown/manifest.json': JSON.stringify(manifest), 'sites/unknown/index.html': 'never' });
  const open = (path, headers = {}, env = { PLAY: bucket(pages) }) => servePlay(ask(path, headers), env, named, new Map());

  it('serves the current build’s page as before: cached by revalidation, indexable', async () => {
    const res = await open(`${ENGINE}b1/`);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('public, max-age=0, must-revalidate');
    expect(res.headers.has('x-robots-tag')).toBe(false);
    expect(buildKind(named, 'b1')).toBe('current');
  });

  it('serves a staged build by its exact name, noindex and never stored', async () => {
    const res = await open(`${ENGINE}s2/?from=%2Fgalaxy%2Fhoth`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('<title>s2</title>');
    expect(res.headers.get('x-robots-tag')).toBe('noindex');
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('cross-origin-embedder-policy')).toBe('require-corp');
    const file = await open(`${ENGINE}s2/runtime/world-play.mjs`);
    expect(await file.text()).toBe('s2 runtime');
    expect(file.headers.get('x-robots-tag')).toBe('noindex');
    expect(file.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    // (its directory without the slash goes to its own directory, not the current build)
    expect((await open(`${ENGINE}s2`)).headers.get('location')).toBe(`https://tilakpatell.com${ENGINE}s2/`);
    expect(buildKind(named, 's2')).toBe('staged');
  });

  it('serves a retained build (the rollback) by its exact name, noindex and never stored', async () => {
    const res = await open(`${ENGINE}b0/index.html`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('<title>b0</title>');
    expect(res.headers.get('x-robots-tag')).toBe('noindex');
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(buildKind(named, 'b0')).toBe('retained');
  });

  it('still sends a name play.json does not know to the current build, reading nothing of it', async () => {
    const env = { PLAY: bucket(pages) };
    for (const path of [`${ENGINE}unknown/`, `${ENGINE}unknown/index.html`, `${ENGINE}unknown`]) {
      const res = await open(path, {}, env);
      expect(res.status, path).toBe(302);
      expect(res.headers.get('location')).toBe(`https://tilakpatell.com${ENGINE}b1/`);
      expect(res.headers.get('cache-control')).toBe('no-store');
    }
    expect(env.PLAY.gets.some((key) => key.startsWith('sites/unknown/'))).toBe(false);
    expect(buildKind(named, 'unknown')).toBeNull();
    expect(buildKind(named, 'hasOwnProperty')).toBeNull();
  });

  it('lands the public entry on the current build exactly as before', async () => {
    for (const path of ['/battlefront', '/battlefront/']) {
      const res = await open(path + '?from=%2Fgalaxy%2Fhoth');
      expect(res.status).toBe(302);
      expect(res.headers.get('location')).toBe(`https://tilakpatell.com${ENGINE}b1/?from=%2Fgalaxy%2Fhoth`);
      expect(res.headers.get('cache-control')).toBe('no-store');
    }
  });

  it('resolves an open staged or retained page’s /ui/, /ui-data/ and /export/ roots to its own build', async () => {
    for (const [build, ui, rules] of [['b0', 'b0 UI', 'b0 rules'], ['s2', 's2 UI', 's2 rules']]) {
      const referer = `https://tilakpatell.com${ENGINE}${build}/runtime/world-play.mjs`;
      for (const [path, body] of [['/ui/main.js', ui], ['/ui-data/screens.json', rules], ['/export/fonts/a.ttf', build === 'b0' ? 'b0 font' : 'font']]) {
        const hop = await open(path, { referer });
        expect(hop.status, `${build} ${path}`).toBe(302);
        const location = hop.headers.get('location');
        expect(location).toBe(`https://tilakpatell.com${ENGINE}${build}${path}`);
        const res = await open(new URL(location).pathname, { referer });
        expect(res.status, `${build} ${path}`).toBe(200);
        expect(await res.text()).toBe(body);
      }
    }
  });
});

describe('the engine’s bare address', () => {
  it('sends /battlefront/engine and an older build’s page to the current build, with the query', async () => {
    const config = { build: 'b1', site: 'sites/b1/' };
    for (const path of ['/battlefront/engine', '/battlefront/engine/', '/battlefront/engine/old-build/', '/battlefront/engine/old-build']) {
      const r = await servePlay(new Request('https://x.test' + path + '?from=%2Fgalaxy%2Fhoth'), {}, config, null);
      expect(r.status).toBe(302);
      expect(r.headers.get('location')).toBe('https://x.test/battlefront/engine/b1/?from=%2Fgalaxy%2Fhoth');
    }
  });

  it('leaves the current build, its service worker and an unpublished site alone', async () => {
    const config = { build: 'b1', site: 'sites/b1/' };
    expect(await servePlay(new Request('https://x.test/battlefront/engine/b1/'), {}, config, null)).toBeNull();
    expect((await servePlay(new Request('https://x.test/battlefront/engine/sw.js'), {}, config, null)).status).toBe(200);
    expect(await servePlay(new Request('https://x.test/battlefront/engine/'), {}, { build: null, site: null }, null)).toBeNull();
  });

  it('routes every public entry through the Worker and a canonical build directory', async () => {
    const source = readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8');
    const config = JSON.parse(source.replace(/^\s*\/\/.*$/gm, ''));
    const runsWorker = (path) => config.assets.run_worker_first.some((pattern) =>
      pattern.endsWith('*') ? path.startsWith(pattern.slice(0, -1)) : path === pattern);
    const paths = ['/battlefront', '/battlefront/', '/battlefront/engine', '/battlefront/engine/', '/battlefront/engine/b1'];
    for (const path of paths) {
      expect(runsWorker(path), path).toBe(true);
      const res = await servePlay(new Request('https://x.test' + path + '?from=%2Fgalaxy%2Fhoth&quality=high'), {}, { build: 'b1', site: 'sites/b1/' }, null);
      expect(res.status, path).toBe(302);
      expect(res.headers.get('location')).toBe('https://x.test/battlefront/engine/b1/?from=%2Fgalaxy%2Fhoth&quality=high');
      expect(res.headers.get('cache-control')).toBe('no-store');
      expect(new URL('runtime/world-play.mjs', res.headers.get('location')).pathname).toBe('/battlefront/engine/b1/runtime/world-play.mjs');
    }
  });
});

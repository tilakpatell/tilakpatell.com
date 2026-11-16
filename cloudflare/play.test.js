import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
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

  // (R2 refuses a range that starts at or past the end: a 503 "try again" made the service worker and the page ask three more times)
  it('answers 416 with the size for a range past the end; any other failed read stays a 503', async () => {
    const r2 = (getFails) => {
      const inner = bucket(files);
      return {
        gets: inner.gets,
        head: async (key) => (key in files ? { size: new TextEncoder().encode(files[key]).length } : null),
        get: async (key, opts = {}) => {
          const start = /^bytes=(\d+)-/.exec(opts.range?.get?.('range') ?? '')?.[1];
          if (getFails || (start !== undefined && Number(start) >= 10)) throw new Error('InvalidRange');
          return inner.get(key, opts);
        },
      };
    };
    for (const range of ['bytes=10-', 'bytes=1048576-', 'bytes=12-20']) {
      const past = await serve(`${ENGINE}b1/original-frame-graph.wasm`, { range }, { PLAY: r2(false) });
      expect(past.status).toBe(416);
      expect(past.headers.get('content-range')).toBe('bytes */10');
      expect(past.headers.get('cross-origin-embedder-policy')).toBe('require-corp');
      expect(past.headers.get('retry-after')).toBeNull();
    }
    // (a range inside the file whose read fails is an outage, not a bad range)
    const down = await serve(`${ENGINE}b1/original-frame-graph.wasm`, { range: 'bytes=2-' }, { PLAY: r2(true) });
    expect(down.status).toBe(503);
    // (a binding with no head, or a head that fails: the 503 as before)
    const { head, ...noHead } = r2(false);
    expect((await serve(`${ENGINE}b1/original-frame-graph.wasm`, { range: 'bytes=10-' }, { PLAY: noHead })).status).toBe(503);
    const headDown = { ...r2(false), head: async () => { throw new Error('R2 unavailable'); } };
    expect((await serve(`${ENGINE}b1/original-frame-graph.wasm`, { range: 'bytes=10-' }, { PLAY: headDown })).status).toBe(503);
  });

  // (s-buildfast's review of #1324: the head is the same hang class as #1323's reads, so it has a time limit)
  // (live r1074-b / staged 1075, s-classui: Chrome's WebM demuxer seeks at the end, Range: bytes=830825- on the 830,825-byte
  // Tile_Light.webm; the 503 surfaced as MEDIA_ERR_NETWORK on seven menu tile films. A range that starts exactly at the size is 416.)
  it('a range starting exactly at the size of an export file (a film seek at its end) is 416 with the size; its last byte is 206', async () => {
    const inner = bucket(files), size = (key) => new TextEncoder().encode(files[key]).length;
    const env = { PLAY: { gets: inner.gets, head: async (key) => (key in files ? { size: size(key) } : null),
      get: async (key, opts = {}) => {
        const start = /^bytes=(\d+)-/.exec(opts.range?.get?.('range') ?? '')?.[1];
        if (start !== undefined && key in files && Number(start) >= size(key)) throw new Error('InvalidRange');
        return inner.get(key, opts);
      } } };
    const end = await serve('/export/fonts/a.ttf', { range: 'bytes=4-' }, env);
    expect(end.status).toBe(416);
    expect(end.headers.get('content-range')).toBe('bytes */4');
    expect(end.headers.get('retry-after')).toBeNull();
    const last = await serve('/export/fonts/a.ttf', { range: 'bytes=3-3' }, env);
    expect(last.status).toBe(206);
    expect(last.headers.get('content-range')).toBe('bytes 3-3/4');
    expect(await last.text()).toBe('t');
  });

  it('a head that never answers leaves the ranged read a 503 after TIMEOUTS.read, not a hang', async () => {
    vi.useFakeTimers();
    try {
      const inner = bucket(files);
      const env = { PLAY: { gets: inner.gets, head: () => new Promise(() => {}), get: async (key, opts = {}) => { if (opts.range?.get?.('range')) throw new Error('InvalidRange'); return inner.get(key, opts); } } };
      let settled = null;
      const pending = serve(`${ENGINE}b1/original-frame-graph.wasm`, { range: 'bytes=10-' }, env).then((res) => (settled = res));
      await vi.advanceTimersByTimeAsync(TIMEOUTS.read - 1);
      expect(settled).toBeNull();
      await vi.advanceTimersByTimeAsync(1);
      await pending;
      expect(settled.status).toBe(503);
      expect(settled.headers.get('retry-after')).toBe('1');
    } finally {
      vi.useRealTimers();
    }
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

  it('answers a warmed build file on a cold isolate with no read of the bucket at all, the manifest included (16 Nov boot hangs)', async () => {
    const env = { PLAY: bucket(files) };
    const kept = new Map();
    const cache = { match: async (r) => kept.get(r.url)?.clone() ?? null, put: async (r, res) => void kept.set(r.url, res) };
    const browser = { 'accept-encoding': 'gzip, deflate, br, zstd' };
    // (one isolate warms the edge: the engine's script, which has no brotli copy, and a scene file, which has one)
    for (const p of ['original-frame-graph.wasm', 'scene-r-0.res']) await (await servePlay(ask(`${ENGINE}b1/${p}`, browser), env, config, new Map(), null, cache)).text();
    // (a deploy: a new isolate, its manifests not read yet)
    const reads = env.PLAY.gets.length;
    const script = await servePlay(ask(`${ENGINE}b1/original-frame-graph.wasm`, browser), env, config, new Map(), null, cache);
    expect(script.status).toBe(200);
    expect(script.headers.get('x-play-cache')).toBe('hit');
    expect(await script.text()).toBe('wasm-bytes');
    const scene = await servePlay(ask(`${ENGINE}b1/scene-r-0.res`, browser), env, config, new Map(), null, cache);
    expect(scene.headers.get('content-encoding')).toBe('br');
    expect(await scene.text()).toBe('BR');
    expect(env.PLAY.gets.slice(reads)).toEqual([]);
    // (a file the edge does not hold still goes through the manifest: an unlisted one is refused as before)
    expect((await servePlay(ask(`${ENGINE}b1/secret.bin`, browser), env, config, new Map(), null, cache)).status).toBe(404);
    expect(env.PLAY.gets.slice(reads)).toContain('sites/b1/manifest.json');
  });

  it('never serves a br client the identity entry of a file that has a br copy, whoever came first ([c5] on abe9d8522)', async () => {
    const env = { PLAY: bucket(files) };
    const kept = new Map();
    const cache = { match: async (r) => kept.get(r.url)?.clone() ?? null, put: async (r, res) => void kept.set(r.url, res) };
    const path = `${ENGINE}b1/scene-r-0.res`, browser = { 'accept-encoding': 'gzip, deflate, br, zstd' };
    // (a client without br first: the file itself goes to the edge)
    expect(await (await servePlay(ask(path), env, config, new Map(), null, cache)).text()).toBe('scene bytes, whole');
    // (then browsers: the br copy, read once and stored, then from the edge)
    const first = await servePlay(ask(path, browser), env, config, new Map(), null, cache);
    expect(first.headers.get('content-encoding')).toBe('br');
    expect(first.headers.get('x-play-cache')).toBe('miss');
    expect(await first.text()).toBe('BR');
    const again = await servePlay(ask(path, browser), env, config, new Map(), null, cache);
    expect(again.headers.get('content-encoding')).toBe('br');
    expect(again.headers.get('x-play-cache')).toBe('hit');
    expect([...kept.keys()].map((k) => new URL(k).searchParams.get('play-encoding')).sort()).toEqual(['br', 'identity']);
    // (a file that can never have a br copy, the engine's .wasm: its own entry, edge-first, for a browser too)
    await (await servePlay(ask(`${ENGINE}b1/original-frame-graph.wasm`), env, config, new Map(), null, cache)).text();
    const reads = env.PLAY.gets.length;
    const wasm = await servePlay(ask(`${ENGINE}b1/original-frame-graph.wasm`, browser), env, config, new Map(), null, cache);
    expect(wasm.headers.get('x-play-cache')).toBe('hit');
    expect(wasm.headers.has('content-encoding')).toBe(false);
    expect(env.PLAY.gets.slice(reads)).toEqual([]);
  });

  it('answers a br client\'s octet-stream file that has no br copy from its own edge entry, not R2 ([c5] on 7457f2def)', async () => {
    // (a file under 1 KB of scene data: the compress step makes it no br copy, so encodings.json does not list it)
    const tinyManifest = { ...manifest, entries: [...manifest.entries, { path: 'scene-tiny.bin' }] };
    const env = { PLAY: bucket({ ...files, 'sites/b1/manifest.json': JSON.stringify(tinyManifest), 'sites/b1/scene-tiny.bin': 'tiny' }) };
    const kept = new Map();
    const cache = { match: async (r) => kept.get(r.url)?.clone() ?? null, put: async (r, res) => void kept.set(r.url, res) };
    const path = `${ENGINE}b1/scene-tiny.bin`, browser = { 'accept-encoding': 'gzip, deflate, br, zstd' };
    const first = await servePlay(ask(path, browser), env, config, new Map(), null, cache);
    expect(first.headers.get('x-play-cache')).toBe('miss');
    expect(await first.text()).toBe('tiny');
    const fileReads = () => env.PLAY.gets.filter((k) => k === 'sites/b1/scene-tiny.bin').length;
    const before = fileReads();
    const again = await servePlay(ask(path, browser), env, config, new Map(), null, cache);
    expect(again.headers.get('x-play-cache')).toBe('hit');
    expect(again.headers.has('content-encoding')).toBe(false);
    expect(await again.text()).toBe('tiny');
    expect(fileReads()).toBe(before);
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

describe('a build’s own ui-data: immutable, kept at the edge, an octet-stream file from its brotli copy (16 Nov: the tone data)', () => {
  const own = { ...config, uiData: 'sites/b1/ui-data/', retainedBuilds: { b0: { site: 'sites/b0/', export: 'extract/', uiData: 'sites/b0/ui-data/', exportAllow: ['fonts/'] } } };
  const data = {
    ...files,
    'sites/b0/manifest.json': JSON.stringify(manifest),
    'sites/b1/ui-data/screens.json': '{"rules":1}',
    'sites/b1/ui-data/screens.json.br': 'JSON-BR-NEVER-SERVED',
    'sites/b1/ui-data/backdrop/cam2.tone.bin': 'tone bytes, whole',
    'sites/b1/ui-data/backdrop/cam2.tone.bin.br': 'TONE-BR',
    'sites/b1/ui-data/backdrop/cam9.tone.bin': 'no copy, whole',
    'sites/b0/ui-data/backdrop/cam2.tone.bin': 'b0 tone',
    'sites/b0/ui-data/backdrop/cam2.tone.bin.br': 'B0-BR',
  };
  const browser = { 'accept-encoding': 'gzip, deflate, br, zstd' };
  const edge = () => {
    const kept = new Map();
    return { kept, match: async (r) => kept.get(r.url)?.clone() ?? null, put: async (r, res) => void kept.set(r.url, res) };
  };
  const tone = `${ENGINE}b1/ui-data/backdrop/cam2.tone.bin`;

  it('answers a br client with the brotli copy, a year and immutable, then from the edge with no read of the bucket', async () => {
    const env = { PLAY: bucket(data) }, cache = edge();
    const first = await servePlay(ask(tone, browser), env, own, new Map(), null, cache);
    expect(first.status).toBe(200);
    expect(first.headers.get('content-encoding')).toBe('br');
    expect(first.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    expect(first.headers.get('x-play-cache')).toBe('miss');
    expect(await first.text()).toBe('TONE-BR');
    // (ui-data is not in the site's manifest: it is never read for it)
    expect(env.PLAY.gets).toEqual(['sites/b1/ui-data/backdrop/cam2.tone.bin.br']);
    const reads = env.PLAY.gets.length;
    const again = await servePlay(ask(tone, browser), env, own, new Map(), null, cache);
    expect(again.headers.get('x-play-cache')).toBe('hit');
    expect(again.headers.get('content-encoding')).toBe('br');
    expect(await again.text()).toBe('TONE-BR');
    expect(env.PLAY.gets.length).toBe(reads);
  });

  it('never serves the brotli copy to a client without br, nor the file itself to a br client, whoever came first', async () => {
    const env = { PLAY: bucket(data) }, cache = edge();
    await (await servePlay(ask(tone, browser), env, own, new Map(), null, cache)).text();
    const plain = await servePlay(ask(tone), env, own, new Map(), null, cache);
    expect(plain.headers.has('content-encoding')).toBe(false);
    expect(plain.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    expect(await plain.text()).toBe('tone bytes, whole');
    const again = await servePlay(ask(tone), env, own, new Map(), null, cache);
    expect(again.headers.get('x-play-cache')).toBe('hit');
    expect(await again.text()).toBe('tone bytes, whole');
    const br = await servePlay(ask(tone, browser), env, own, new Map(), null, cache);
    expect(br.headers.get('content-encoding')).toBe('br');
    expect(await br.text()).toBe('TONE-BR');
    expect([...cache.kept.keys()].map((k) => new URL(k).searchParams.get('play-encoding')).sort()).toEqual(['br', 'identity']);
  });

  it('sends a typed file (the rulebooks) itself, never a .br beside it, and an octet-stream file with no copy itself, kept', async () => {
    const env = { PLAY: bucket(data) }, cache = edge();
    const rules = await servePlay(ask(`${ENGINE}b1/ui-data/screens.json`, browser), env, own, new Map(), null, cache);
    expect(rules.headers.has('content-encoding')).toBe(false);
    expect(rules.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    expect(await rules.text()).toBe('{"rules":1}');
    expect(env.PLAY.gets).not.toContain('sites/b1/ui-data/screens.json.br');
    const bare = await servePlay(ask(`${ENGINE}b1/ui-data/backdrop/cam9.tone.bin`, browser), env, own, new Map(), null, cache);
    expect(bare.headers.has('content-encoding')).toBe(false);
    expect(await bare.text()).toBe('no copy, whole');
    const reads = env.PLAY.gets.length;
    const kept = await servePlay(ask(`${ENGINE}b1/ui-data/backdrop/cam9.tone.bin`, browser), env, own, new Map(), null, cache);
    expect(kept.headers.get('x-play-cache')).toBe('hit');
    expect(await kept.text()).toBe('no copy, whole');
    // (the file from the edge; its copy is asked for again each time, not remembered absent: the fill adds copies after a deploy)
    expect(env.PLAY.gets.slice(reads)).toEqual(['sites/b1/ui-data/backdrop/cam9.tone.bin.br']);
    // (a range is the file's own bytes, never kept)
    const part = await servePlay(ask(tone, { ...browser, range: 'bytes=0-3' }), env, own, new Map(), null, cache);
    expect(part.status).toBe(206);
    expect(part.headers.has('content-encoding')).toBe(false);
    expect(await part.text()).toBe('tone');
  });

  it('serves another build’s ui-data from that build only, and leaves a shared ui-data folder and the bare path revalidating', async () => {
    const env = { PLAY: bucket(data) }, cache = edge();
    await (await servePlay(ask(tone, browser), env, own, new Map(), null, cache)).text();
    const old = await servePlay(ask(`${ENGINE}b0/ui-data/backdrop/cam2.tone.bin`, browser), env, own, new Map(), null, cache);
    expect(old.headers.get('content-encoding')).toBe('br');
    expect(await old.text()).toBe('B0-BR');
    expect(await (await servePlay(ask(tone, browser), env, own, new Map(), null, cache)).text()).toBe('TONE-BR');
    // (play.json's uiData not the build's own prefix: its files may change under one name, so they revalidate and are not kept)
    const sharedEnv = { PLAY: bucket({ ...data, 'library/ui/frontend/backdrop/cam2.tone.bin': 'shared tone', 'library/ui/frontend/backdrop/cam2.tone.bin.br': 'SHARED-BR' }) };
    const sharedCache = edge();
    const s = await servePlay(ask(`${ENGINE}b1/ui-data/backdrop/cam2.tone.bin`, browser), sharedEnv, config, new Map(), null, sharedCache);
    expect(s.headers.get('cache-control')).toBe('public, max-age=0, must-revalidate');
    expect(s.headers.has('content-encoding')).toBe(false);
    expect(await s.text()).toBe('shared tone');
    expect(sharedCache.kept.size).toBe(0);
    // (a build whose uiData names another build's folder is not its own ui-data: revalidated, not kept, no copy)
    const borrowed = { ...own, stagedBuilds: { s2: { site: 'sites/b1/', export: 'extract/', uiData: 'sites/b1/ui-data/', exportAllow: ['fonts/'] } } };
    const borrowedCache = edge();
    const b = await servePlay(ask(`${ENGINE}s2/ui-data/backdrop/cam2.tone.bin`, browser), env, borrowed, new Map(), null, borrowedCache);
    expect(b.headers.get('cache-control')).toBe('public, max-age=0, must-revalidate');
    expect(b.headers.has('content-encoding')).toBe(false);
    expect(await b.text()).toBe('tone bytes, whole');
    expect(borrowedCache.kept.size).toBe(0);
    // (the unqualified root, asked with no engine page behind it, revalidates as before)
    const bare = await servePlay(ask('/ui-data/backdrop/cam2.tone.bin', browser), env, own, new Map(), null, edge());
    expect(bare.headers.get('cache-control')).toBe('public, max-age=0, must-revalidate');
    expect(await bare.text()).toBe('tone bytes, whole');
  });
});

import { describe, expect, it } from 'vitest';
import { ENGINE, ISOLATED, contentType, playRoute, servePlay } from './play.js';
import { RETURN_VERSION } from './playReturn.js';

const config = { build: 'b1', site: 'sites/b1/', export: 'extract/', uiData: 'library/ui/frontend/', exportAllow: ['fonts/', 'strings/'] };
const manifest = { schema: 'bf2-play-site/1', entries: ['index.html', 'original-frame-graph.js', 'original-frame-graph.wasm', 'scene.json', 'ui/main.js', 'runtime/world-play.mjs'].map((path) => ({ path })) };

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
  'extract/fonts/a.ttf': 'font',
  'extract/models/a.glb': 'model',
  'library/ui/frontend/screens.json': '{}',
};
const ask = (path, headers = {}) => new Request(`https://tilakpatell.com${path}`, { headers });
const serve = (path, headers, env = { PLAY: bucket(files) }) => servePlay(ask(path, headers), env, config, new Map());

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

  it('leaves everything to the site without the binding', async () => {
    expect(await serve(`${ENGINE}b1/`, {}, {})).toBeNull();
  });
});

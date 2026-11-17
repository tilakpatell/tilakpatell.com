import { describe, expect, it } from 'vitest';
import { TRANSPORT_TRIES, isTransport, open, publicPathOf, verifiedAtEdge } from './bf2web-r2.mjs';

// (dummy keys: the fakes below never check a signature)
const env = { R2_ACCESS_KEY_ID: 'test-id', R2_SECRET_ACCESS_KEY: 'test-secret' };
const terminated = () => Object.assign(new TypeError('terminated'), { cause: Object.assign(new Error('other side closed'), { code: 'UND_ERR_SOCKET' }) });
const answer = (status, body = '', headers = {}) => new Response(status === 304 ? null : body, { status, headers: { etag: '"e1"', ...headers } });
// a response whose status came but whose body ends in transport, as undici's 'terminated' (r1075-b88a2bd5's adopt smoke)
const cut = () => ({ status: 200, ok: true, headers: new Headers({ etag: '"e1"' }), arrayBuffer: async () => { throw terminated(); }, text: async () => { throw terminated(); } });

describe('the R2 shim: a transport end is asked again on a fresh connection, an S3 status is not', () => {
  it('names transport ends and only them', () => {
    expect(isTransport(terminated())).toBe(true);
    for (const e of [Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' }), new Error('socket hang up')]) expect(isTransport(e)).toBe(true);
    for (const e of [new Error('get k: HTTP 503'), new Error('get k: HTTP 403'), new SyntaxError('Unexpected token')]) expect(isTransport(e)).toBe(false);
  });

  it('a read cut in its body is answered from a fresh connection, the whole body, and says so', async () => {
    const kept = [], fresh = [], logs = [];
    const r2 = open(env, { fetchImpl: async (url) => (kept.push(url), cut()), fresh: async (url) => (fresh.push(url), answer(200, '<svg/>')), log: (l) => logs.push(l) });
    const o = await r2.binding.get('web/svg/UI/SVG/Classes/Class_Vehicle_Speeder.svg');
    expect(new TextDecoder().decode(o.body)).toBe('<svg/>');
    expect(o.httpEtag).toBe('"e1"');
    expect([kept.length, fresh.length]).toEqual([1, 1]);
    expect(logs[0]).toMatch(/Class_Vehicle_Speeder\.svg: terminated on its connection; fresh connection, try 1 of 3: answered/);
  });

  it('an S3 status fails at once, as before: no fresh connection', async () => {
    const fresh = [];
    const r2 = open(env, { fetchImpl: async () => answer(503, 'slow down'), fresh: async (url) => (fresh.push(url), answer(200)) });
    await expect(r2.binding.get('web/x.svg')).rejects.toThrow('get web/x.svg: HTTP 503');
    expect(fresh).toEqual([]);
  });

  it('a transport end on every try fails, marked as transport, after the fresh tries', async () => {
    let kept = 0, fresh = 0;
    const r2 = open(env, { fetchImpl: async () => (kept++, cut()), fresh: async () => (fresh++, cut()), log: () => {} });
    const error = await r2.binding.get('web/x.svg').catch((e) => e);
    expect(error.transport).toBe(true);
    expect(error.message).toMatch(/transport, 4 tries, 3 on fresh connections/);
    expect([kept, fresh]).toEqual([1, TRANSPORT_TRIES]);
  });

  it('a 304, a 404 and text() read as before', async () => {
    const r2 = open(env, { fetchImpl: async (url) => (String(url).endsWith('/gone') ? answer(404) : String(url).endsWith('/same') ? answer(304) : answer(200, '{"a":1}')) });
    expect(await r2.binding.get('gone')).toBeNull();
    expect(await r2.binding.get('same', { onlyIf: new Headers({ 'if-none-match': '"e1"' }) })).toEqual({ size: 0, httpEtag: '"e1"' });
    expect(await r2.json('doc')).toEqual({ a: 1 });
  });
});

describe("the smoke's last resort: the file at the build's public address, passed only with the stored ETag", () => {
  const config = { build: 'r1075-b88a2bd5', site: 'sites/r1075-b88a2bd5/', uiData: 'sites/r1075-b88a2bd5/ui-data/', export: 'web/' };
  const key = 'web/svg/UI/SVG/Classes/Class_Vehicle_Speeder.svg';
  it("maps a key to the build's public path by the config's own prefixes", () => {
    expect(publicPathOf(key, config)).toBe('/battlefront/engine/r1075-b88a2bd5/export/svg/UI/SVG/Classes/Class_Vehicle_Speeder.svg');
    expect(publicPathOf('sites/r1075-b88a2bd5/ui-data/screens.json', config)).toBe('/battlefront/engine/r1075-b88a2bd5/ui-data/screens.json');
    expect(publicPathOf('sites/r1075-b88a2bd5/runtime/world-play.mjs', config)).toBe('/battlefront/engine/r1075-b88a2bd5/runtime/world-play.mjs');
    expect(publicPathOf('elsewhere/x', config)).toBeNull();
  });
  it('passes a 200 with the stored ETag; a different ETag, a non-200 or no stored ETag do not', async () => {
    const edge = (status, etag) => async (url) => (expect(url).toBe('https://tilakpatell.com' + publicPathOf(key, config)), new Response(status === 200 ? '<svg/>' : 'no', { status, headers: { etag } }));
    const ok = await verifiedAtEdge(key, { config, build: config.build, etagOf: async () => '"d75e"', fetchEdge: edge(200, '"d75e"') });
    expect(new TextDecoder().decode(ok.body)).toBe('<svg/>');
    expect(ok.httpEtag).toBe('"d75e"');
    expect(await verifiedAtEdge(key, { config, build: config.build, etagOf: async () => '"d75e"', fetchEdge: edge(200, '"other"') })).toBeNull();
    expect(await verifiedAtEdge(key, { config, build: config.build, etagOf: async () => '"d75e"', fetchEdge: edge(503, '"d75e"') })).toBeNull();
    expect(await verifiedAtEdge(key, { config, build: config.build, etagOf: async () => null, fetchEdge: edge(200, '"d75e"') })).toBeNull();
  });
});

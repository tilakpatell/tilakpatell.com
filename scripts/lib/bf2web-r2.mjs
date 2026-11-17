// The private bucket bf2-web's builds sit in, for the pipeline's scripts (scripts/bf2web-*.mjs,
// docs/decisions/2026-10-28-bf2web-pipeline.md): R2's S3 address signed with the keys in the environment
// (scripts/lib/bucket.mjs), never printed.
//
//   BUCKET   open(env) → { fetch, text(key), json(key), files(prefix), binding }
//     text/json: null for a key the bucket hasn't got   files: [{ key, size }] under the prefix, every page
//     binding: the R2 binding's get(key, { range, onlyIf }) over S3, enough of it for cloudflare/play.js
//     (a range and If-None-Match), so a local server answers as the Worker does

import { NO_KEYS, bucketEnv, list, objectUrl } from './bucket.mjs';
import { request as httpsRequest } from 'node:https';

// A read that dies in transport, not with an S3 status (undici's 'terminated', a reset socket): r1075-b88a2bd5's adopt smoke,
// 3 of 3 runs, 'R2 read web/svg/UI/SVG/Classes/Class_Vehicle_Speeder.svg: terminated (after 0.1 s)' twice, the same 261 B object
// the edge serves 200 to every visitor. Such a read is asked again on a FRESH connection (freshFetch), up to TRANSPORT_TRIES times.
export const TRANSPORT_TRIES = 3;
export const isTransport = (error) => {
  const text = [error?.message, error?.code, error?.cause?.message, error?.cause?.code].filter(Boolean).join(' ');
  return /terminated|ECONNRESET|socket hang up|UND_ERR_SOCKET|other side closed|EPIPE/i.test(text);
};

// One request on its own new TLS connection (agent: false: no kept-alive socket is reused), the whole body read before it is
// answered, and nothing decoded (no Accept-Encoding is sent): a Response as fetch gives one.
export function freshFetch(url, init = {}) {
  return new Promise((resolve, reject) => {
    const method = init.method ?? 'GET';
    const req = httpsRequest(String(url), { method, headers: init.headers ?? {}, agent: false }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('error', reject);
      res.on('end', () => {
        const headers = new Headers();
        for (const [k, v] of Object.entries(res.headers)) for (const one of [].concat(v)) headers.append(k, String(one));
        const empty = method === 'HEAD' || res.statusCode === 204 || res.statusCode === 304;
        resolve(new Response(empty ? null : Buffer.concat(chunks), { status: res.statusCode, headers }));
      });
    });
    req.on('error', reject);
    req.end();
  });
}

export const BUCKET = 'bf2017-assets';

export function open(env = process.env, { fetchImpl = globalThis.fetch, fresh = freshFetch, log = console.warn } = {}) {
  const b = bucketEnv(env, fetchImpl), f = bucketEnv(env, fresh);
  if (!b) throw new Error(NO_KEYS);
  // (the response with its whole body read: a transport end can come in the body, after the status)
  const once = async (fetchFn, key, headers) => {
    const r = await fetchFn(objectUrl(BUCKET, key), { headers });
    if (r.status === 404) return null;
    if (!r.ok && r.status !== 206 && r.status !== 304) throw new Error(`get ${key}: HTTP ${r.status}`);
    return { r, bytes: r.status === 304 ? null : new Uint8Array(await r.arrayBuffer()) };
  };
  // An S3 status fails at once, as before; only a transport end is asked again, each time on a fresh connection.
  const get = async (key, headers = {}) => {
    try {
      return await once(b.fetch, key, headers);
    } catch (error) {
      if (!isTransport(error)) throw error;
      let last = error;
      for (let i = 1; i <= TRANSPORT_TRIES; i++) {
        try {
          const got = await once(f.fetch, key, headers);
          log(`R2 shim: ${key}: ${error.message} on its connection; fresh connection, try ${i} of ${TRANSPORT_TRIES}: answered`);
          return got;
        } catch (again) {
          if (!isTransport(again)) throw again;
          last = again;
        }
      }
      const failed = new Error(`get ${key}: ${last.message} (transport, ${TRANSPORT_TRIES + 1} tries, ${TRANSPORT_TRIES} on fresh connections)`);
      failed.transport = true;
      throw failed;
    }
  };
  const text = async (key) => {
    const got = await get(key);
    return got ? new TextDecoder().decode(got.bytes) : null;
  };
  // (the object's stored ETag, by a HEAD on a fresh connection: no body to end in transport)
  const etagOf = async (key) => {
    const r = await f.fetch(objectUrl(BUCKET, key), { method: 'HEAD' });
    return r.status === 200 ? r.headers.get('etag') : null;
  };
  const binding = {
    async get(key, opts = {}) {
      const headers = {};
      const range = opts.range?.get?.('range');
      if (range) headers.range = range;
      const etag = opts.onlyIf?.get?.('if-none-match');
      if (etag) headers['if-none-match'] = etag;
      const got = await get(key, headers);
      if (!got) return null;
      const { r, bytes: body } = got;
      const httpEtag = r.headers.get('etag');
      if (r.status === 304) return { size: 0, httpEtag };
      const m = /bytes (\d+)-(\d+)\/(\d+)/.exec(r.headers.get('content-range') ?? '');
      return {
        size: m ? Number(m[3]) : body.length,
        httpEtag,
        range: m ? { offset: Number(m[1]), length: body.length } : undefined,
        body,
        json: async () => JSON.parse(new TextDecoder().decode(body)),
      };
    },
  };
  return {
    fetch: b.fetch,
    text,
    json: async (key) => {
      const t = await text(key);
      return t === null ? null : JSON.parse(t);
    },
    files: async (prefix) => (await list(b.fetch, BUCKET, prefix)).files,
    folders: async (prefix) => (await list(b.fetch, BUCKET, prefix, { delimiter: '/' })).folders,
    binding,
    etagOf,
  };
}

// (the smoke's last resort for a read that died in transport on every try: the same file from the PUBLIC address of the build,
// passed only on a 200 whose ETag is the object's stored one; anything else fails as before. key -> the build's public path by the
// config's own prefixes: its site, its export, its ui-data.)
export function publicPathOf(key, config, build = config.build) {
  for (const [prefix, root] of [[config.site, ''], [config.uiData, 'ui-data/'], [config.export, 'export/']])
    if (prefix && key.startsWith(prefix)) return `/battlefront/engine/${build}/${root}${key.slice(prefix.length)}`;
  return null;
}
export async function verifiedAtEdge(key, { config, build, etagOf, fetchEdge = globalThis.fetch, origin = 'https://tilakpatell.com' }) {
  const path = publicPathOf(key, config, build);
  if (!path) return null;
  const [stored, res] = await Promise.all([etagOf(key), fetchEdge(origin + path, { headers: { 'accept-encoding': 'identity' } })]);
  if (res.status !== 200 || !stored || res.headers.get('etag') !== stored) return null;
  const body = new Uint8Array(await res.arrayBuffer());
  return { size: body.length, httpEtag: stored, body, path, json: async () => JSON.parse(new TextDecoder().decode(body)) };
}

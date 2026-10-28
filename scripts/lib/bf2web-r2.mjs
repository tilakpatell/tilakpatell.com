// The private bucket bf2-web's builds sit in, for the pipeline's scripts (scripts/bf2web-*.mjs,
// docs/decisions/2026-10-28-bf2web-pipeline.md): R2's S3 address signed with the keys in the environment
// (scripts/lib/bucket.mjs), never printed.
//
//   BUCKET   open(env) → { fetch, text(key), json(key), files(prefix), binding }
//     text/json: null for a key the bucket hasn't got   files: [{ key, size }] under the prefix, every page
//     binding: the R2 binding's get(key, { range, onlyIf }) over S3, enough of it for cloudflare/play.js
//     (a range and If-None-Match), so a local server answers as the Worker does

import { NO_KEYS, bucketEnv, list, objectUrl } from './bucket.mjs';

export const BUCKET = 'bf2017-assets';

export function open(env = process.env) {
  const b = bucketEnv(env);
  if (!b) throw new Error(NO_KEYS);
  const get = async (key, headers = {}) => {
    const r = await b.fetch(objectUrl(BUCKET, key), { headers });
    if (r.status === 404) return null;
    if (!r.ok && r.status !== 206 && r.status !== 304) throw new Error(`get ${key}: HTTP ${r.status}`);
    return r;
  };
  const text = async (key) => {
    const r = await get(key);
    return r ? r.text() : null;
  };
  const binding = {
    async get(key, opts = {}) {
      const headers = {};
      const range = opts.range?.get?.('range');
      if (range) headers.range = range;
      const etag = opts.onlyIf?.get?.('if-none-match');
      if (etag) headers['if-none-match'] = etag;
      const r = await get(key, headers);
      if (!r) return null;
      const httpEtag = r.headers.get('etag');
      if (r.status === 304) return { size: 0, httpEtag };
      const body = new Uint8Array(await r.arrayBuffer());
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
  };
}

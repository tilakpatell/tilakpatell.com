// The asset buckets on Cloudflare R2, for the scripts (docs/stack/cloudflare.md):
// the private bf2017-assets the 2017 drop sits in, and the public
// site-assets the site reads its heavy files from. R2 speaks S3, so each
// request carries AWS's Signature Version 4, made here with node:crypto (one
// hash and five HMACs, held to AWS's own worked examples in the test), and
// nothing is installed for it. Until 2026-10-21 both buckets were on
// Supabase Storage and read through its REST calls; `folder` answers in its
// list call's shape (an entry with no id is a subfolder, a file's size in
// metadata.size), so a script that walked that listing walks this one as it
// did.
//
// keysOf(env) → { id, secret } | null: R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY,
//   whitespace a paste left dropped (never printed)
// bucketEnv(env, fetch) → { base, fetch } | null: the endpoint and a fetch that signs
// sign({ method, url, headers, id, secret, now, region, payload }) → the headers, signed
// signer(keys, fetch, now) → fetch(url, init): a request to the account's R2 signed, any other as it came
// objectUrl(bucket, path, base) → the object's S3 address (bf2017-paths' objectUrl is this)
// assetBase(env) → site-assets' public address (ASSET_BASE, VITE_ASSET_BASE, else PUBLIC)
// listing(xml) → { files: [{ key, size }], folders: [prefix], next } (a ListObjectsV2 page; pure)
// list(fetch, bucket, prefix, { delimiter }) → { files, folders }, every page
// folder(fetch, bucket, prefix) → [{ name, id, metadata }], one folder's entries, by name
// put(fetch, bucket, key, body, { type, cache }) → the response; throws on a refusal
// remove(fetch, bucket, key) → the response; a key already gone is no error

import { createHash, createHmac } from 'node:crypto';

// (the owner's account: an id, not a key; wrangler.jsonc has it too)
export const ACCOUNT = 'b12a527ca9fde882ef12c5c60f75f2e8';
export const ENDPOINT = `https://${ACCOUNT}.r2.cloudflarestorage.com`;
// site-assets' own domain, cached by Cloudflare (r2.dev is rate-limited and never cached)
export const PUBLIC = 'https://assets.tilakpatell.com';
export const NO_KEYS = "Set R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY (R2's S3 keys: R2 → Manage API tokens) in .env.local and run with node --env-file=.env.local.";

export function keysOf(env = process.env) {
  const id = String(env.R2_ACCESS_KEY_ID ?? '').replace(/\s+/g, '');
  const secret = String(env.R2_SECRET_ACCESS_KEY ?? '').replace(/\s+/g, '');
  return id && secret ? { id, secret } : null;
}

export function bucketEnv(env = process.env, fetchImpl = globalThis.fetch) {
  const keys = keysOf(env);
  return keys ? { base: ENDPOINT, fetch: signer(keys, fetchImpl) } : null;
}

export const assetBase = (env = process.env) => (env.ASSET_BASE || env.VITE_ASSET_BASE || PUBLIC).replace(/\/+$/, '');

// RFC 3986's unreserved characters stay, everything else is %XX: what S3
// signs, so the address sent and the one signed are the same string
const strict = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
export const encodePath = (path) => String(path).split('/').map(strict).join('/');
export const objectUrl = (bucket, path, base = ENDPOINT) => `${base.replace(/\/+$/, '')}/${bucket}/${encodePath(path)}`;

const sha256 = (s) => createHash('sha256').update(s).digest('hex');
const hmac = (key, s) => createHmac('sha256', key).update(s).digest();
// (20130524T000000Z: the ISO time with its dashes, colons and milliseconds dropped)
const stamp = (now) => now.toISOString().replace(/[-:]|\.\d{3}/g, '');

export function sign({ method = 'GET', url, headers = {}, id, secret, now = new Date(), region = 'auto', payload = 'UNSIGNED-PAYLOAD' }) {
  const u = new URL(String(url));
  const date = stamp(now);
  const day = date.slice(0, 8);
  const all = { ...Object.fromEntries(new Headers(headers)), host: u.host, 'x-amz-content-sha256': payload, 'x-amz-date': date };
  const names = Object.keys(all).sort();
  const query = [...u.searchParams].map(([k, v]) => [strict(k), strict(v)]).sort(([a, x], [b, y]) => (a < b ? -1 : a > b ? 1 : x < y ? -1 : x > y ? 1 : 0)).map(([k, v]) => `${k}=${v}`).join('&');
  const canonical = [method.toUpperCase(), u.pathname || '/', query, names.map((n) => `${n}:${String(all[n]).trim().replace(/\s+/g, ' ')}\n`).join(''), names.join(';'), payload].join('\n');
  const scope = `${day}/${region}/s3/aws4_request`;
  const key = hmac(hmac(hmac(hmac(`AWS4${secret}`, day), region), 's3'), 'aws4_request');
  const signature = createHmac('sha256', key).update(['AWS4-HMAC-SHA256', date, scope, sha256(canonical)].join('\n')).digest('hex');
  // (fetch sets the host itself from the address)
  const out = { ...all };
  delete out.host;
  return { ...out, authorization: `AWS4-HMAC-SHA256 Credential=${id}/${scope}, SignedHeaders=${names.join(';')}, Signature=${signature}` };
}

export function signer(keys, fetchImpl = globalThis.fetch, now = () => new Date()) {
  const host = new URL(ENDPOINT).host;
  return (url, init = {}) => {
    if (new URL(String(url)).host !== host) return fetchImpl(url, init);
    return fetchImpl(url, { ...init, headers: sign({ method: init.method ?? 'GET', url, headers: init.headers, ...keys, now: now() }) });
  };
}

const XML = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const unxml = (s = '') => s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => (e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : (XML[e] ?? m)));
const tags = (s, name) => [...s.matchAll(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, 'g'))].map((m) => m[1]);

export function listing(xml) {
  const files = tags(xml, 'Contents').map((c) => ({ key: unxml(tags(c, 'Key')[0]), size: Number(tags(c, 'Size')[0] ?? 0) }));
  const folders = tags(xml, 'CommonPrefixes').map((c) => unxml(tags(c, 'Prefix')[0]));
  const truncated = tags(xml, 'IsTruncated')[0] === 'true';
  return { files, folders, next: truncated ? unxml(tags(xml, 'NextContinuationToken')[0]) || null : null };
}

export async function list(fetchImpl, bucket, prefix = '', { delimiter = '' } = {}) {
  const files = [];
  const folders = [];
  for (let next = null; ; ) {
    const q = { 'list-type': '2', prefix, ...(delimiter ? { delimiter } : {}), ...(next ? { 'continuation-token': next } : {}) };
    const query = Object.entries(q).map(([k, v]) => `${strict(k)}=${strict(v)}`).join('&');
    const res = await fetchImpl(`${ENDPOINT}/${bucket}?${query}`);
    if (!res.ok) throw new Error(`list ${bucket}/${prefix}: HTTP ${res.status}`);
    const page = listing(await res.text());
    files.push(...page.files);
    folders.push(...page.folders);
    if (!page.next) return { files, folders };
    next = page.next;
  }
}

export async function folder(fetchImpl, bucket, prefix = '') {
  const dir = String(prefix).replace(/^\/+|\/+$/g, '');
  const at = dir ? `${dir}/` : '';
  const { files, folders } = await list(fetchImpl, bucket, at, { delimiter: '/' });
  const entries = [...folders.map((f) => ({ name: f.slice(at.length).replace(/\/$/, ''), id: null, metadata: null })), ...files.map((f) => ({ name: f.key.slice(at.length), id: f.key, metadata: { size: f.size } }))];
  return entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

export async function put(fetchImpl, bucket, key, body, { type = 'application/octet-stream', cache = null } = {}) {
  const res = await fetchImpl(objectUrl(bucket, key), { method: 'PUT', headers: { 'content-type': type, ...(cache ? { 'cache-control': cache } : {}) }, body });
  if (!res.ok) throw new Error(`put ${bucket}/${key}: HTTP ${res.status} ${(await res.text().catch(() => '')).slice(0, 200)}`);
  return res;
}

export async function remove(fetchImpl, bucket, key) {
  const res = await fetchImpl(objectUrl(bucket, key), { method: 'DELETE' });
  if (!res.ok && res.status !== 404) throw new Error(`delete ${bucket}/${key}: HTTP ${res.status}`);
  return res;
}

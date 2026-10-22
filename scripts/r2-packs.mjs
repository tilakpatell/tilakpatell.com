// The raw asset packs the worlds are built from, kept in the owner's
// Cloudflare R2 bucket (tilak-assets) rather than in the repo: each pack's
// files as downloaded, under packs/<source>/<pack>/<file>, and an index of
// them all (packs/index.json, its copy committed as scripts/r2-packs.json:
// each pack's name, licence, author, source and every file's size and
// sha256). The import scripts take models from a pack fetched into
// lab/assets/<pack>/ (git-ignored); what each pack is and which worlds use
// it: docs/assets/city-packs.md. The bucket is private: a session needs the
// keys to read it as well as to write it.
//
//   node scripts/r2-packs.mjs list
//   node scripts/r2-packs.mjs upload <source>/<pack> <file…> --name <what> --licence <CC0|CC-BY-4.0> --author <who> --url <where>
//   node scripts/r2-packs.mjs fetch <source>/<pack> [--out <dir>]
//
// The keys: R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY from the environment,
// the owner's, never printed and never in a file the repo tracks; the script
// refuses to run in CI. The account is wrangler.jsonc's; the bucket
// R2_BUCKET's, or tilak-assets. Node's fetch behind a proxy needs
// NODE_USE_ENV_PROXY=1.
//
//   signV4({ method, url, headers, payloadHash, key, secret, date, region, service }) →
//     the request's headers with its AWS signature version 4 (pure; R2
//     speaks S3's)
//   packKey(pack, file) → the object's key (pure)

import { createHash, createHmac } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const INDEX = 'packs/index.json';
const LOCAL_INDEX = join(ROOT, 'scripts', 'r2-packs.json');

const sha256 = (data) => createHash('sha256').update(data).digest('hex');
const hmac = (key, data) => createHmac('sha256', key).update(data).digest();
// (S3's encoding of a path: every byte but the unreserved ones and the slashes)
const encodePath = (p) => p.split('/').map((s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)).join('/');

export const packKey = (pack, file) => `packs/${pack}/${basename(file)}`;

export function signV4({ method, url, headers = {}, payloadHash, key, secret, date = new Date(), region = 'auto', service = 's3' }) {
  const u = new URL(url);
  const stamp = date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const day = stamp.slice(0, 8);
  const all = { ...Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), String(v).trim()])), host: u.host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': stamp };
  const names = Object.keys(all).sort();
  const query = [...u.searchParams].map(([k, v]) => [encodeURIComponent(k), encodeURIComponent(v)]).sort(([a, x], [b, y]) => (a === b ? (x < y ? -1 : 1) : a < b ? -1 : 1));
  const canonical = [method, encodePath(decodeURIComponent(u.pathname)), query.map(([k, v]) => `${k}=${v}`).join('&'), ...names.map((n) => `${n}:${all[n]}`), '', names.join(';'), payloadHash].join('\n');
  const scope = `${day}/${region}/${service}/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', stamp, scope, sha256(canonical)].join('\n');
  // (the key's chain: the day, the region, the service, then aws4_request)
  const signing = [day, region, service, 'aws4_request'].reduce((k, part) => hmac(k, part), `AWS4${secret}`);
  const signature = createHmac('sha256', signing).update(toSign).digest('hex');
  return { ...all, authorization: `AWS4-HMAC-SHA256 Credential=${key}/${scope},SignedHeaders=${names.join(';')},Signature=${signature}` };
}

function bucketUrl(path = '') {
  const wrangler = readFileSync(join(ROOT, 'wrangler.jsonc'), 'utf8');
  const account = /"account_id":\s*"([0-9a-f]+)"/.exec(wrangler)?.[1];
  if (!account) throw new Error('no account_id in wrangler.jsonc');
  return `https://${account}.r2.cloudflarestorage.com/${process.env.R2_BUCKET ?? 'tilak-assets'}${path ? `/${encodePath(path)}` : ''}`;
}

async function r2(method, path, { body = null, query = '', type = null } = {}) {
  const key = process.env.R2_ACCESS_KEY_ID;
  const secret = process.env.R2_SECRET_ACCESS_KEY;
  if (!key || !secret) throw new Error('R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY are needed in the environment');
  const url = bucketUrl(path) + query;
  const headers = signV4({ method, url, headers: type ? { 'content-type': type } : {}, payloadHash: sha256(body ?? ''), key, secret });
  delete headers.host;
  const res = await fetch(url, { method, headers, body });
  if (!res.ok && !(method === 'GET' && res.status === 404)) throw new Error(`${method} ${path || '/'}: ${res.status} ${(await res.text()).slice(0, 200)}`);
  return res;
}

const readIndex = async () => {
  const res = await r2('GET', INDEX);
  return res.status === 404 ? { packs: {} } : res.json();
};
const writeIndex = async (index) => {
  const text = `${JSON.stringify(index, null, 2)}\n`;
  await r2('PUT', INDEX, { body: text, type: 'application/json' });
  writeFileSync(LOCAL_INDEX, text);
};

const flag = (args, name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : null;
};
const TYPES = { '.zip': 'application/zip', '.glb': 'model/gltf-binary', '.json': 'application/json', '.txt': 'text/plain', '.png': 'image/png', '.jpg': 'image/jpeg' };

async function main([cmd, pack, ...args]) {
  if (process.env.CI) throw new Error('not in CI: the keys are the owner’s, for a session or their machine');
  if (cmd === 'list') {
    const index = await readIndex();
    for (const [id, p] of Object.entries(index.packs)) console.log(`${id}  ${p.licence}  ${p.files.length} file${p.files.length === 1 ? '' : 's'}, ${(p.files.reduce((s, f) => s + f.bytes, 0) / 2 ** 20).toFixed(1)} MB  ${p.name}`);
    return;
  }
  if (cmd === 'upload') {
    const files = args.filter((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
    const meta = { name: flag(args, 'name'), licence: flag(args, 'licence'), author: flag(args, 'author'), url: flag(args, 'url') };
    if (!pack?.includes('/') || !files.length || Object.values(meta).some((v) => !v)) throw new Error('upload <source>/<pack> <file…> --name --licence --author --url');
    const index = await readIndex();
    const listed = [];
    for (const f of files) {
      const buf = readFileSync(f);
      const ext = f.slice(f.lastIndexOf('.')).toLowerCase();
      await r2('PUT', packKey(pack, f), { body: buf, type: TYPES[ext] ?? 'application/octet-stream' });
      listed.push({ name: basename(f), bytes: buf.length, sha256: sha256(buf) });
      console.log(`  ${packKey(pack, f)}  ${(buf.length / 2 ** 20).toFixed(1)} MB`);
    }
    const had = index.packs[pack]?.files ?? [];
    index.packs[pack] = { ...meta, added: new Date().toISOString().slice(0, 10), files: [...had.filter((h) => !listed.some((l) => l.name === h.name)), ...listed] };
    await writeIndex(index);
    console.log(`${pack}: ${listed.length} uploaded, the index written`);
    return;
  }
  if (cmd === 'fetch') {
    const index = existsSync(LOCAL_INDEX) ? JSON.parse(readFileSync(LOCAL_INDEX, 'utf8')) : await readIndex();
    const p = index.packs[pack];
    if (!p) throw new Error(`${pack}: not in the index (node scripts/r2-packs.mjs list)`);
    const out = resolve(flag(args, 'out') ?? join(ROOT, 'lab', 'assets', pack.split('/')[1]));
    mkdirSync(out, { recursive: true });
    for (const f of p.files) {
      const to = join(out, f.name);
      if (existsSync(to) && sha256(readFileSync(to)) === f.sha256) continue;
      const buf = Buffer.from(await (await r2('GET', `packs/${pack}/${f.name}`)).arrayBuffer());
      if (sha256(buf) !== f.sha256) throw new Error(`${f.name}: its sha256 doesn't match the index`);
      writeFileSync(to, buf);
      console.log(`  ${to}`);
    }
    console.log(`${pack}: in ${out}`);
    return;
  }
  throw new Error('list | upload <source>/<pack> <file…> --name --licence --author --url | fetch <source>/<pack> [--out <dir>]');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}

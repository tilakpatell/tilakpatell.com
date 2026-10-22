// Where the 2017 drop's files are, in the bucket and on disk. A model's GLB
// names its textures by a path relative to itself (`../../../../../textures/
// …_cs.ktx2`), not embedded, so the fetch reads those URIs to know what else
// to ask for, and keeps the bucket's layout on disk so they still resolve.
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join, posix } from 'node:path';
import { encodePath } from './bucket.mjs';
import { isSequel } from './bf2017-manifest.mjs';

// The JSON chunk of a GLB (chunk 0 starts at byte 20; its length is at 12).
export function glbJson(glb) {
  const buf = Buffer.isBuffer(glb) ? glb : Buffer.from(glb.buffer, glb.byteOffset, glb.byteLength);
  if (buf.toString('ascii', 0, 4) !== 'glTF') throw new Error('not a GLB');
  return JSON.parse(buf.toString('utf8', 20, 20 + buf.readUInt32LE(12)));
}

// An image URI as a bucket path (under web/), resolved against the GLB's own;
// null for one in the file (a data URI or a buffer view).
export function imagePath(uri, glbBucketPath) {
  if (!uri || uri.startsWith('data:')) return null;
  const path = decodeURIComponent(uri);
  if (path.startsWith('web/')) return path;
  if (path.startsWith('textures/')) return `web/${path}`;
  return posix.normalize(posix.join(posix.dirname(glbBucketPath), path));
}

// Each image's bucket path, in order, those in the file left out.
export const imageUris = (glb, glbBucketPath) => (glbJson(glb).images ?? []).map((img) => imagePath(img.uri, glbBucketPath)).filter(Boolean);

// Where a texture may be, best first: the raw PNG of its source map (the
// uploader's derived `__normal` and `__orm_<hash>` maps are made from it),
// then the KTX2 the GLB names.
export function textureSources(bucketPath) {
  if (!bucketPath.endsWith('.ktx2')) return [bucketPath];
  const stem = bucketPath.slice(0, -'.ktx2'.length).replace(/__(normal|orm_[0-9a-f]+)$/, '');
  return [`${stem}.png`, bucketPath];
}

// A manifest path (`models/…glb`, relative to the bucket's web/) as a bucket
// path, and a `derived` recipe's map (`Gameplay/…/T_…_NAM`, the source
// texture's Frostbite name) as the bucket path of its PNG.
// A manifest's file lives under web/; the dump's records live under data/ at
// the bucket's root (dataPath), so a data/ path is kept as it is.
export const inBucket = (file) => (file.startsWith('web/') || file.startsWith('data/') ? file : `web/${file}`);
export const mapPath = (map) => `web/textures/${map.toLowerCase()}.png`;

export const localPath = (root, bucketPath) => join(root, bucketPath);

// (an S3 address on R2's endpoint, the bucket first: lib/bucket.mjs signs it)
export const objectUrl = (base, bucket, path) => `${base.replace(/\/+$/, '')}/${bucket}/${encodePath(path)}`;

// A glob over the manifest's names (a star crosses folders, as --list's
// always has), as a test.
export const globMatch = (glob) => {
  const re = new RegExp(`^${String(glob).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);
  return (name) => re.test(name);
};

// Every file a set of models needs, from the manifest alone: each LOD and
// its collision mesh with the size the manifest gives (a guess, for the
// timeout: the uploader re-encoded the GLBs after writing it, so the bucket's
// are smaller), then each map it names once, as its
// sources best first (the PNG, then the KTX2). The derived maps (`__normal`,
// `__orm_<hash>`) are named only in the GLBs, so the fetch adds those as each
// GLB lands. Never a sequel-era model.
export function jobsFor(manifest, glob, { textures = true, collision = true } = {}) {
  const match = globMatch(glob);
  const files = [];
  const maps = new Map();
  for (const [name, e] of manifest) {
    if (!match(name) || isSequel(name)) continue;
    for (const l of e.lods ?? []) files.push({ kind: 'model', path: inBucket(l.file), size: l.bytes ?? null });
    if (collision && e.collision?.file) files.push({ kind: 'collision', path: inBucket(e.collision.file), size: e.collision.bytes ?? null });
    if (!textures) continue;
    for (const t of e.textures ?? []) {
      const png = mapPath(t);
      const ktx2 = png.replace(/\.png$/, '.ktx2');
      if (!maps.has(ktx2)) maps.set(ktx2, { kind: 'texture', path: ktx2, sources: [png, ktx2] });
    }
  }
  return [...files, ...maps.values()];
}

// The local index (lab/assets/bf2017/.index.json): what a run left on disk,
// { [bucket path]: { bytes, at } }, so a second pass over a big set asks the
// bucket nothing for what it already has.
export async function readIndex(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return {};
  }
}

export async function writeIndex(file, index) {
  const sorted = Object.fromEntries(Object.keys(index).sort().map((k) => [k, index[k]]));
  await mkdir(dirname(file), { recursive: true });
  // (whole or not at all, like every file the fetch writes)
  await writeFile(`${file}.part`, `${JSON.stringify(sorted, null, 1)}\n`);
  await rename(`${file}.part`, file);
}

// Is the file on disk the one the index wrote down, and (where the manifest
// knows) the size it should be? `onDisk`: its size, or null when it's gone.
export function isCurrent(index, path, bytes, onDisk) {
  const had = index[path];
  if (!had || onDisk == null || had.bytes !== onDisk) return false;
  return bytes == null || bytes === onDisk;
}

export const summaryLine = ({ fetched, kept, missing, failed, bytes, seconds }) =>
  `fetched ${fetched} · kept ${kept} · missing ${missing} · failed ${failed} · ${(bytes / 1e6).toFixed(1)} MB · ${seconds.toFixed(1)} s`;

// The gameplay records (`data/<Name>.json.gz`, the dump's EBX as JSON) are
// asked for by a glob over their names: `*` within a folder, `**` across
// (unlike `globMatch`, whose star crosses folders: a record folder can hold
// thousands below it).
export const dataPath = (name) => `data/${name}.json.gz`;

// The records of one type in data.tsv (name, type, path, bytes a line):
// their names, for a fetch by type (`data type:ObjectVariation`), since a
// record's name seldom says what it is (2,807 ObjectVariation records, 40
// with "Variation" in the name).
export function namesOfType(tsv, type) {
  const want = String(type).toLowerCase();
  const out = [];
  for (const line of String(tsv).split('\n')) {
    const [name, kind] = line.split('\t');
    if (name && kind && kind.toLowerCase() === want) out.push(name);
  }
  return out;
}

export function globRegExp(glob) {
  const body = glob
    .split('**')
    .map((part) => part.replace(/[.+^${}()|[\]\\?]/g, '\\$&').replace(/\*/g, '[^/]*'))
    .join('.*');
  return new RegExp(`^${body}$`);
}

// The deepest folder a glob names before its first star: where a listing starts.
export function globDir(glob) {
  const star = glob.indexOf('*');
  const head = star < 0 ? glob : glob.slice(0, star);
  const cut = head.lastIndexOf('/');
  return cut < 0 ? '' : head.slice(0, cut);
}

// Every asset a world's source names is in its pack (src/components/<world>/pack.js),
// so an install (src/runtime/install.js) fetches what the world will ask for and a
// pack cannot quietly go stale. A URL is an asset when it starts with one of
// PREFIXES; a template's `${…}` counts as a wildcard, so `/models/x/${id}.glb` needs a
// glob over /models/x/, or /models/x in the pack's `computed` (folders the source only
// builds paths in) with the files it takes from there listed. Run after a change to a world: `node scripts/pack-check.mjs`
// (exit 1 listing what is undeclared, or what a pack lists that public/ lacks).
//
// undeclared(src, pack) → string[]   (src: a file or folder, or a list of them)

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const PREFIXES = ['/models/', '/textures/', '/audio/', '/hdri/', '/hq/', '/cc0/', '/mc/', '/n64/', '/games/', '/eagler/', '/albuquerque/', '/kit/'];
const CODE = new Set(['.js', '.jsx', '.mjs', '.ts', '.tsx']);
const QUOTED = /(['"`])(\/[a-z0-9-]+\/(?:(?!\1)[^\n])*?)\1/gi;

// glob → RegExp: `**` any depth, `*` within one folder
export const globRe = (glob) =>
  new RegExp(
    `^${glob
      .split(/(\*\*\/?|\*)/)
      .map((p) => (p.startsWith('**') ? '.*' : p === '*' ? '[^/]*' : p.replace(/[.+?^${}()|[\]\\]/g, '\\$&')))
      .join('')}$`,
  );

// the asset URLs in one file's text, a template's `${…}` as `*`
export function assetRefs(text) {
  const out = new Set();
  for (const m of text.matchAll(QUOTED)) {
    const ref = m[2].replace(/\$\{[^}]*\}/g, '*').replace(/[?#].*$/, '');
    if (PREFIXES.some((p) => ref.startsWith(p))) out.add(ref);
  }
  return [...out];
}

// a ref is covered when listed, or when a glob matches it with each wildcard (and a
// trailing folder slash) standing for a file name
export function covered(ref, pack) {
  if (pack.urls?.includes(ref)) return true;
  // a folder the source only builds paths in (`${DIR}/${name}.glb`): the pack lists the files it takes from there
  if ((pack.computed ?? []).some((dir) => ref === dir.replace(/\/$/, '') || ref.startsWith(dir.endsWith('/') ? dir : `${dir}/`))) return true;
  // (a folder may be named without its slash: '/models/x' as a base for '/models/x/<name>')
  const samples = (ref.endsWith('/') ? [`${ref}x`] : [ref, `${ref}/x`]).map((r) => r.replace(/\*/g, 'x'));
  return (pack.globs ?? []).some((g) => samples.some((x) => globRe(g).test(x)));
}

const filesIn = (path) => {
  if (!existsSync(path)) return [];
  if (!statSync(path).isDirectory()) return [path];
  return readdirSync(path, { withFileTypes: true }).flatMap((d) => (d.name === 'node_modules' || d.name.startsWith('.') ? [] : filesIn(join(path, d.name))));
};

export function undeclared(src, pack) {
  const files = [src].flat().flatMap(filesIn).filter((f) => CODE.has(extname(f)) && !/\.test\.[a-z]+$/.test(f));
  const refs = new Set(files.flatMap((f) => assetRefs(readFileSync(f, 'utf8'))));
  return [...refs].filter((r) => !covered(r, pack)).sort();
}

// what a pack lists that public/ does not have: a URL with no file, a glob matching nothing, a
// computed folder it takes nothing from
// (`published`: site paths the public bucket alone holds, src/data/galaxyAssets.json's,
// which a checkout never has: present all the same)
export function missing(pack, publicDir, published = []) {
  const all = [...new Set([...filesIn(publicDir).map((f) => `/${relative(publicDir, f).split('\\').join('/')}`), ...published])];
  const listed = [...(pack.urls ?? []), ...all.filter((f) => (pack.globs ?? []).some((g) => globRe(g).test(f)))];
  const under = (dir) => (dir.endsWith('/') ? dir : `${dir}/`);
  const there = new Set(published);
  return [
    ...(pack.urls ?? []).filter((u) => !there.has(u) && !existsSync(join(publicDir, u))),
    ...(pack.globs ?? []).filter((g) => !all.some((f) => globRe(g).test(f))),
    ...(pack.computed ?? []).filter((d) => !listed.some((f) => f.startsWith(under(d)))),
  ];
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const { PACKS } = await import(pathToFileURL(join(root, 'src/components/worlds/packs.js')).href);
  let bad = 0;
  for (const pack of Object.values(PACKS)) {
    const loose = undeclared((pack.src ?? []).map((s) => join(root, s)), pack);
    const gone = missing(pack, join(root, 'public'));
    for (const r of loose) console.log(`${pack.id}: ${r} is not in its pack`);
    for (const r of gone) console.log(`${pack.id}: ${r} is in its pack but not in public/`);
    bad += loose.length + gone.length;
  }
  if (bad) process.exit(1);
  console.log(`pack check: ${Object.keys(PACKS).length} packs, every asset declared`);
}

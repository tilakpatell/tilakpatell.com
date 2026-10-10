// Which of the site's files each credit is for. The credits are kept in
// three shapes, none of which names its file outright:
//
//   public/games/credits.json        "<kind>/<name>": the file is <name>, under a folder of its own (or a
//                                     pack's, the public/…/ folder its text names)
//                                     (tex/armour → public/games/tex/armour/…, meshy/rm/fart →
//                                     public/models/c137/rm/fart.glb): any file whose path ends in
//                                     /<name>, or a folder named <name>
//   src/data/modelCredits.json       "<name>": its `file`, else /models/sketchfab/<name>.glb; or its
//                                     `paths` (a level pack credited whole: everything under those folders)
//   public/models/<dir>/credits.json "<name>": the cast's name for a model in that folder
//                                     (civA → civ-a.glb, omni → omni-man.glb: src/components/invincible/cast.js)
//
// A model's cuts are credited with it: <name>.hq.glb, <name>.lo.glb, <name>.ultra.glb and the
// galaxy surfaces' far-off <name>.lod1.glb, and
// the smaller copies in a lod/ or sm/ folder beside the original.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const tracked = (root, dir = 'public') => String(execFileSync('git', ['-C', root, 'ls-files', dir], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })).split('\n').filter(Boolean);

// a file as its credit names it: no cut suffix, no extension
export const stem = (f) => f.replace(/\.(hq|lo|lod1|far|ultra)\.glb$/, '.glb').replace(/\.[^./]+$/, '');
// a smaller copy in lod/ or sm/ is credited as the original one folder up
const original = (f) => f.replace(/\/(lod|sm)\/([^/]+)$/, '/$2');

export function credits(root) {
  const json = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));
  // (a pack credited whole, such as a texture pack rebuilt into a folder of its own, says where in its text: public/mc/)
  const games = Object.entries(json('public/games/credits.json')).map(([key, c]) => ({ list: 'public/games/credits.json', key, name: key.split('/').slice(1).join('/'), paths: [...JSON.stringify(c).matchAll(/public\/[\w./-]+\//g)].map((m) => m[0]) }));
  // (a level pack is credited whole, by its folder: `paths`, the way a games pack is)
  const models = Object.entries(json('src/data/modelCredits.json')).map(([key, m]) => (m.paths ? { list: 'src/data/modelCredits.json', key, paths: m.paths } : { list: 'src/data/modelCredits.json', key, file: `public${m.file ?? `/models/sketchfab/${key}.glb`}` }));
  const folders = tracked(root, 'public/models')
    .filter((f) => f.endsWith('/credits.json'))
    .flatMap((list) => Object.keys(json(list)).map((key) => ({ list, key, dir: list.replace(/credits\.json$/, ''), name: key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`) })));
  return [...games, ...models, ...folders];
}

// Whether a credit is for a file.
export function covers(credit, file) {
  const f = original(file);
  if (credit.file) return stem(credit.file) === stem(f);
  if (credit.dir) {
    if (!f.startsWith(credit.dir) || f.slice(credit.dir.length).includes('/')) return false;
    const base = stem(f).slice(credit.dir.length);
    return base === credit.name || base.startsWith(`${credit.name}-`);
  }
  return stem(f).endsWith(`/${credit.name}`) || f.includes(`/${credit.name}/`) || Boolean(credit.paths?.some((p) => f.startsWith(p)));
}

// The credits that point at nothing, and the models under public/models/ no credit is for.
// A file published to the bucket (src/data/galaxyAssets.json) and so out of
// git is the site's as much as one in public/.
export function audit(root) {
  const files = tracked(root);
  const all = credits(root);
  const manifest = join(root, 'src/data/galaxyAssets.json');
  const published = existsSync(manifest) ? JSON.parse(readFileSync(manifest, 'utf8')) : {};
  const there = (file) => existsSync(join(root, file)) || Boolean(published[file.replace(/^public\//, '')]);
  // (a folder credited whole may be all published: the space levels' models)
  const shipped = [...files, ...Object.keys(published).map((k) => `public/${k}`)];
  const dead = all.filter((c) => (c.file ? !there(c.file) : !shipped.some((f) => covers(c, f))));
  const uncredited = files.filter((f) => f.startsWith('public/models/') && f.endsWith('.glb') && !all.some((c) => covers(c, f)));
  return { dead, uncredited };
}

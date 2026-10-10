// The drop's object library as surface models (the fifth design, lane O):
// any placeable object in Battlefront II (2017) (EA DICE's, used with
// permission on this non-commercial fan project: docs/decisions/2026-10-10-
// battlefront-2017-assets.md) by its manifest name, as `game:<name>`. The
// index of every one is src/data/bf2017/library.json (scripts/
// bf2017-library.mjs); the site never loads it whole. An object a world
// asks for is imported on demand (scripts/bf2017-library-import.mjs: the
// game's own KTX2 in the plain cut, a light `.lod1` and a `.far` cut, each
// published to the bucket and credited by the import), and its index row
// copied into src/data/bf2017/library-used.json, which this reads: a row
// whose cuts are not published yet draws nothing (the placer says so once).
//
//   gameKind(name) → 'game:<name>'; isGame(model) → whether it names one
//   slugOf(name) → the file's name: the last segment's letters and digits
//     and a short hash of the whole name (two sets have the same last
//     segments), letters and digits only, as the import's kinds are
//   gameUrl(name, cut?) → /models/galaxy/surface/game/<slug>[.<cut>].glb
//   rowFor(name, index, published) → a row in SURFACE_MODELS' shape ({ url,
//     lodUrl?, farUrl?, as, metres, size, tris, rig, native, made, from,
//     credit }) when the plain cut is published, else null
//   MODELS: the rows of every used object that is published, by gameKind
//   gameModel(model, models, said, warn?) → the kind a placer loads a
//     `game:` spec or row as, or null (not published yet, or rigged: a
//     placer draws still things), said once a name

import PUBLISHED from '../../../../data/galaxyAssets.json';
import USED from '../../../../data/bf2017/library-used.json';
import { gameKind, gameUrl, slugOf } from './bf2017-slug';

export { GAME, gameKind, gameName, gameUrl, isGame, slugOf } from './bf2017-slug';

const published = (manifest, url) => Boolean(manifest?.[url.slice(1)]);

export function rowFor(name, index, manifest = PUBLISHED) {
  const at = index instanceof Map ? index.get(name) : index?.[name];
  if (!at) return null;
  const url = gameUrl(name);
  if (!published(manifest, url)) return null;
  const lodUrl = gameUrl(name, 'lod1');
  const farUrl = gameUrl(name, 'far');
  return {
    made: 'bf2017',
    native: true,
    url,
    ...(published(manifest, lodUrl) ? { lodUrl } : {}),
    ...(published(manifest, farUrl) ? { farUrl } : {}),
    as: at.as ?? name.split('/').pop(),
    metres: at.metres ?? 1,
    along: 'y',
    size: at.size,
    tris: at.tris,
    ...(at.rig ? { rig: true } : {}),
    from: name,
    credit: `surface-game-${slugOf(name)}`,
  };
}

export const MODELS = Object.fromEntries(
  Object.keys(USED)
    .map((name) => [gameKind(name), rowFor(name, USED)])
    .filter(([, row]) => row),
);

export function gameModel(model, models, said, warn = console.warn) {
  const row = models[model];
  if (row && !row.rig) return model;
  if (!said.has(model)) {
    said.add(model);
    warn(`placer: ${model} ${row ? 'is rigged, and a placer draws still things' : 'is not imported yet (scripts/bf2017-library-import.mjs)'}; nothing drawn`);
  }
  return null;
}

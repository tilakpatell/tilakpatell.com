// The files a planet's landmarks and kit clutter fetch, at a detail level:
// each placement's catalog model (and its light cut where the level swaps
// to it far off), each kit model's family file, and the kits' manifests. So
// the planet's download is measured from the files themselves
// (landmarkFiles.test.js holds WORLD_MB['/fly'] to the heaviest), and the
// install's list (./pack.js) is held to have them all.
//
// No three.js: the catalog and the placements are data and pure code.
//
//   landmarkFiles(spec, { level, kits }) → url[] (sorted, each once)
//     kits: { [pack]: manifest } (public/kit/<pack>/index.json's)

import { SURFACE_MODELS, isGame, lodUrlFor, modelUrlFor, wantsLod } from '../../galaxy/shared/models';
import { planetField } from '../../../lib/land/flight/field';
import { clutterKitOf } from '../../../lib/land/flight/landmarkTables';
import { placementsFor } from './landmarks';

const KIT = /^kit:([a-z0-9-]+)\/(\S+)$/i;

export function landmarkFiles(spec, { level = 'mid', kits }) {
  const urls = new Set();
  const kit = (pack, name) => {
    const row = kits[pack]?.models?.[name];
    if (!row) return;
    urls.add(`/kit/${pack}/index.json`);
    urls.add(`/kit/${pack}/${row.file}`);
  };
  const kind = (k) => {
    const m = SURFACE_MODELS[k];
    if (!m) return; // (built in code: nothing fetched)
    // (a cluster is its members, each its own file)
    if (m.cluster) return m.cluster.forEach(([member]) => kind(member));
    urls.add(modelUrlFor(k, level));
    if (wantsLod(k, level)) urls.add(lodUrlFor(k));
  };
  const built = new Set((spec.landmarks ?? []).map((l) => l.at));
  const { heightAt } = planetField(spec);
  for (const poi of spec.pois ?? []) {
    if (built.has(poi.id)) continue;
    for (const p of placementsFor(spec, poi, { heightAt }).list) {
      const ref = KIT.exec(p.model ?? '');
      if (ref) kit(ref[1], ref[2]);
      // (one of the drop's library objects: its row is under its `game:` name)
      else if (isGame(p.model)) kind(p.model);
      else if (p.model !== false) kind(p.kind);
    }
  }
  if (level !== 'low') for (const row of Object.values(clutterKitOf(spec))) kit(row.kit, row.name);
  return [...urls].sort();
}

// The object library's slice of the asset manifest, as a virtual module
// (lane D3 of the Frostbite gaps design). src/data/galaxyAssets.json is
// 16 MB of published files (nearly all of them level packs' cells and maps),
// and the library imported it whole, so the galaxy's chunk was 13 MB before
// compression for a lookup of some thirty objects' three cuts. This plugin
// serves `virtual:bf2017-published`: the paths the library asks about and
// nothing else (scripts/lib/library-slice.mjs, tested), read from the two
// JSON files each time the module is loaded, so a build, the dev server and
// Vitest see the manifest as it is on disk and nothing is committed twice.
// In dev, a change to either file reloads the module.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { sliceFor } from './lib/library-slice.mjs';

export const SPECIFIER = 'virtual:bf2017-published';
const RESOLVED = '\0bf2017-published';
const ROOT = fileURLToPath(new URL('..', import.meta.url)).replace(/\/+$/, '');
export const PUBLISHED = 'src/data/galaxyAssets.json';
export const USED = 'src/data/bf2017/library-used.json';

const read = (p) => JSON.parse(readFileSync(p, 'utf8'));

async function sliceCode(root = ROOT) {
  // (a file URL, not the path: on Windows a bare C:\ path reads as a URL scheme and the import fails)
  const { gameUrl } = await import(pathToFileURL(join(root, 'src/components/galaxy/surface/catalog/bf2017-slug.js')).href);
  const slice = sliceFor(read(join(root, PUBLISHED)), read(join(root, USED)), { urlFor: gameUrl });
  return `export default ${JSON.stringify(slice)};\n`;
}

export default function librarySlice() {
  return {
    name: 'library-slice',
    resolveId(source) {
      return source === SPECIFIER ? RESOLVED : null;
    },
    async load(id) {
      if (id !== RESOLVED) return null;
      this.addWatchFile?.(join(ROOT, PUBLISHED));
      this.addWatchFile?.(join(ROOT, USED));
      return sliceCode(ROOT);
    },
  };
}

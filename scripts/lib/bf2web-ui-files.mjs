// The files of a build's ui-data folder that go up: the rulebooks at its root and the menu backdrop's manifest and stills in backdrop/
// (bf2-web's frontend/ui/backdrop.js reads /ui-data/backdrop/backdrop.json), as paths relative to the folder with forward slashes, sorted.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

export function uiDataFiles(root, rel = '') {
  return readdirSync(join(root, rel), { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? uiDataFiles(root, `${rel}${e.name}/`) : /\.(json|png)$/i.test(e.name) ? [`${rel}${e.name}`] : []))
    .sort();
}

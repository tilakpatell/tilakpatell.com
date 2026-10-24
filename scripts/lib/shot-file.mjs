// Where a browser check keeps a screenshot: a PNG, or a JPEG when the PNG
// is 1 MB or more (RULES.md: no committed picture is over 1 MB).
//
//   keepShot({ out, name, png, jpeg }) → the path written
//     png: the shot's PNG bytes; jpeg: () → a promise of the same shot as a
//     JPEG, asked for only when the PNG is too big.
//
// The folder is made if it isn't there yet, as Playwright's
// screenshot({ path }) does, so a check sent to a new folder doesn't die on
// its first shot after minutes of waiting for shaders. The same name's other
// kind, left by an earlier run into the folder, goes, so a folder never
// holds a stale picture beside the new one. Tested beside.

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const SHOT_MAX = 1 << 20;

export async function keepShot({ out, name, png, jpeg }) {
  const big = png.length >= SHOT_MAX;
  const file = join(out, `${name}.${big ? 'jpg' : 'png'}`);
  mkdirSync(out, { recursive: true });
  writeFileSync(file, big ? await jpeg() : png);
  rmSync(join(out, `${name}.${big ? 'png' : 'jpg'}`), { force: true });
  return file;
}

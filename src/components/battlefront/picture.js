// The record's picture on the Battlefront world (lane P): the level's
// <level>.picture.json (scripts/bf2017-picture.mjs) laid over the
// rulebook's entry for a weather (grade.js's withPicture: the record's
// texture names and tone map method, which the rulebook's rows leave out),
// so applyGameLight draws the painted panorama, the fog gradient, the cloud
// texture, the 33³ LUT after the linear tone map and the five Gaussians.
// A level with no picture file, or a weather it has no row for, lights as
// it did.
//
//   picturesOf(level) → Promise<the level's picture manifest | null>
//   litWith(pictures, entry, weather) → { entry, picture }

import { gamePictureOf } from '../../data/bf2017/light/index.js';
import { withPicture } from '../../lib/three/light/grade.js';

export const picturesOf = (level) => gamePictureOf({ picture: `${level}.picture.json` }).catch(() => null);

export const litWith = (pictures, entry, weather) => withPicture(entry, pictures?.weathers?.[weather] ?? null);

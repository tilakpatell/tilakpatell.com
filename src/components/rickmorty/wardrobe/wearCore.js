// wear.js without its paint: the wardrobe's bodies in a cast's table, and
// dress for a dressColors passed in, so ./wear.js dresses in GLSL
// (./dress.js) and ./wearNodes.js in nodes (./dressNodes.js). What each
// is for is said in ./wear.js.

import { MESHY, RIGGED } from '../portal/meshyCastCore';
import { BODIES, bodyById, whoseBody } from './looks';
import { wearGear } from './gear';

const ALL = Object.values(BODIES).flat();
export const bodyKind = (look) => `wd:${look.body}`;
export const bodyAsset = (look) => bodyById(look.body)?.asset ?? look.body;
// whose a look is, by its body (Rick’s when it’s nobody’s, as it always was)
export const whoOf = (look) => whoseBody(look.body) ?? 'rick';

export const withWardrobe = ({ kinds = MESHY, rigged = RIGGED, ...rest } = {}) => ({
  ...rest,
  kinds: { ...kinds, ...Object.fromEntries(ALL.map((b) => [`wd:${b.id}`, { a: b.asset, h: b.h }])) },
  rigged: new Set([...rigged, ...ALL.map((b) => b.asset)]),
});

// The look’s colours and gear on a figure (one from such a cast, or any
// model on the same skeleton, as { group }); returns what takes them off
// (its own copies of the materials freed, the gear gone). A figure built
// from shapes has no skeleton to dress, and is left as it is.
export function dressWith(dressColors) {
  return function dress(figure, look) {
    if (!figure?.group || !look || !bodyById(look.body)) return () => {};
    const mats = dressColors(figure, look);
    const off = wearGear(figure, look);
    return () => {
      off();
      for (const m of mats) m.dispose();
    };
  };
}

// The other travellers (./travellers.js), drawn in your town: each a Frodo
// from another world, pale and shimmering, lit from the edges, with their
// name over their head and a faint ring of light where they stand. They're
// not in your story: nothing bumps into them and nothing sees them. One
// wearing the Ring shows only while you wear it too. An ally of yours (the
// row's `ally`, the roster's) wears the site's ally green on their name
// card and their ring, so your party reads apart from strangers in every
// world, as it does on the universe map (online/pilots.js).
//
// createGhosts({ height, make, animate, tag, halo, snap }) → { group,
// update(list, t, dt, { ringOn }), dispose() }; add `group` to the town (the
// scene's layer()). `make` builds the figure ({ group, top }: a Shire Frodo
// unless it says; the map's are its own big-headed toys; a figure whose
// geometry is shared with others brings its own `dispose`, and one whose
// materials are, `shared`, so they're left alone: Albuquerque's copy of
// Walt's Aztek), `animate(f, t, p, dt)` moves it (a Frodo's walk unless it
// says; `t` is that traveller's own clock, not the scene's), `tag` is the
// name card's height and `halo` the size of the ring of light, in the
// scene's units, and `snap` how far behind it can be before it's put
// straight there (further for a car). A traveller who jumps (`y`, from a
// world that sends it) leaves the ground. One whose world says what
// they're doing and how they move (travellers.js's `emote` and `motion`)
// comes to `animate` with them: `p.emote` as lib/emote.js's readEmote
// gives it ({ id, at, t }, timed on their own clock from when it was
// heard, or null once it's over: the world plays it with applyEmote), and
// `p.motion` ({ speed, side, turn }) as it came. An older traveller's
// message, without them, comes as it always did.
//
// A figure on Middle-earth's cast (../cast3d.js: a makePerson's, a
// makeFolk's) is the cast's own pale self once its model's here: its feet
// go by the ground the ghost covers (so an old client's ghost, sending no
// motion, still walks, and walks in step with where it goes), it strikes
// the emotes it's sent, and this draws it each frame (it's no town's).

import * as THREE from 'three';
import { pose } from '../mapFigures';
import { makePerson } from '../shire/people';
import { ALLY_HALO, GHOST_HALO, createGhostsOf } from './ghostsOf';

export { ALLY_HALO, GHOST_HALO };

const TINT = new THREE.Color(0xcfe0ff);
const GLOW = new THREE.Color(0x6a8cff);
// pale, see-through, brighter at the edges (a rim of light, as the Ring's
// world shows things)
function ghostMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: TINT, emissive: GLOW, emissiveIntensity: 0.55, roughness: 0.5, transparent: true, opacity: 0, depthWrite: false });
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
      float rim = 1.0 - abs(dot(normalize(normal), normalize(vViewPosition)));
      totalEmissiveRadiance += vec3(0.55, 0.7, 1.0) * pow(rim, 2.2) * 1.6;`,
    );
  };
  return m;
}

// (the drawing is ./ghostsOf.js's; here, the Frodo, his walk and the rim of light)
export function createGhosts({ make = () => makePerson('frodo'), animate = (f, t, p) => pose(f, t, { moving: p.moving }), ...rest } = {}) {
  return createGhostsOf({ paint: ghostMaterial, make, animate, ...rest });
}

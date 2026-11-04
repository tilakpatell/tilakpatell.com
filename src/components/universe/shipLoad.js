// The ship you fly's own model, made ahead (./shipSpares.js): the C-137
// page's cruiser with its crew sat in it, or the X-wing's, the Falcon's or
// the RV's model, the stand-in's to take over from. The page asks for it as
// soon as it knows the ship (UniverseMap.jsx, beside the map's own code
// coming, and again as the cockpit seats you in another), and scene.js's
// setShip takes it; one taken is never made twice, and the cruiser's
// models are fetched and parsed once for the page's life (cruiser3dCore's
// cast), so a change of ship and back, or a second visit, makes only the
// copies. One made ahead and never taken waits for the next visit: it has
// sent nothing to the graphics chip.
//
// shipAhead(kind)   one made ahead, if it has a model and none is coming
// takeShip(kind) → Promise<{ group, … } (the cruiser's) | Object3D (a model) | null>

import { atPriority } from '../../lib/assetLoad';
import { local } from '../../lib/hooks';
import { cloneScene, loadGLTF } from '../../lib/three/gltfCache';
import { LOOK_KEY, readLooks } from '../rickmorty/wardrobe/looks';
import { CREW_INK, LENGTH, SHIP_MODELS } from './shipModelsCore';
import { createSpares } from './shipSpares';

// (its files ahead of the planets' maps in the site's pool, lib/assetLoad:
// it's what the first frame is waited on for, and what's looked at)
const SHIP_PRIORITY = 4;

const spares = createSpares({
  build(kind) {
    // the C-137 page's cruiser, crew aboard; its ink drawn to the map's
    // scale (it's 2.7 across there, LENGTH here), theirs finer (they're drawn big)
    if (kind === 'cruiser') return import('../rickmorty/cruiser3d').then((m) => atPriority(SHIP_PRIORITY, () => m.buildCruiser({ ink: LENGTH / 2.7, crewInk: CREW_INK })));
    if (SHIP_MODELS[kind]) return loadGLTF(SHIP_MODELS[kind]).then((g) => g && cloneScene(g));
    return null;
  },
});

export const shipAhead = (kind) => spares.want(kind);

export const takeShip = (kind) =>
  spares.take(kind).then((made) => {
    // (made ahead, perhaps a visit ago: the crew in the wardrobe's looks as they are now)
    Promise.resolve(made?.setLooks?.(readLooks(local.get(LOOK_KEY)))).catch(() => {});
    return made;
  });

// kit.js on the node renderer: the same kit (../kitCore.js), with the
// plants lit and blown by lib/three/foliageNodes, the scanned surfaces worn
// by coreNodes, the scans from scansNodes (the set scene.js wears), kit
// models from kitNodes and the props' windows, shield and shafts from
// ./props.js.

import { faceless, wind, wrapLighting } from '../../../../lib/three/foliageNodes';
import { wear } from '../../../../lib/three/coreNodes';
import { loadScan, scanOf } from '../../../../lib/three/scansNodes';
import { asNode } from '../../../../lib/three/hookNodes';
import { loadKit } from '../../../../lib/three/kitNodes';
import { litWindows, shaftMaterial, shieldMaterial } from './props';
import { createKitWith } from '../kitCore';

export * from '../kitCore';
export { loadScan, scanOf };

const LOOKS = { material: asNode, faceless, wind, wrapLighting, wear, loadScan, scanOf, loadKit, litWindows, shield: shieldMaterial, shaft: shaftMaterial };

export const densityOf = (role, fallback) => (scanOf(role)?.metres ? 1 / scanOf(role).metres : fallback);
export const createKit = (opts) => createKitWith(LOOKS, opts);

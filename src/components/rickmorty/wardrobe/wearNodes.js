// wear.js on the node renderer: the same bodies in a cast's table
// (./wearCore.js), and a figure dressed with ./dressNodes.js's colours.
// The same exports as wear.js; a cast for it is ../portal/meshyCastNodes.js's.

import { dressColors } from './dressNodes';
import { dressWith } from './wearCore';

export { bodyAsset, bodyKind, whoOf, withWardrobe } from './wearCore';

export const dress = dressWith(dressColors);

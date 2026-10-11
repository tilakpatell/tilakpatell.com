// gameFx.js on the node renderer: the same effects and workings
// (./gameFxCore.js), the sheets and the push drawn by their node twins
// (marksNodes.js, pushNodes.js), so a world on three's node renderer
// reaches no GLSL through them. The debris is lit three's own way on both.
//
// createGameFx(parent, { level, groundAt, site, lit, look }) → gameFx.js's

import { createGameFxWith } from './gameFxCore';
import { createSheetFx } from './marksNodes';
import { createPush } from './pushNodes';

export const createGameFx = (parent, opts) => createGameFxWith({ createSheetFx, createPush }, parent, opts);

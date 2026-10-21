// The game's bot brain and what it stands on, for the galaxy's ground war,
// as one module the adapter (brain.js) takes as its `lib`. groundScene.js
// loads it with import() when a ground war starts: the brain reads ai.json
// through the Battlefront rulebook, whose records are fetched (scripts/
// data-slice.mjs), so they come with a ground war and never with the
// galaxy's own chunk. The tests import it as it is.
//
//   createBrain, think, act          src/lib/battlefront/ai/soldierBrain.js
//   difficultyFor                    src/lib/battlefront/ai/difficulty.js
//   buildNav, heightAt, shields, walkable   src/lib/battlefront/nav.js (the navgrid)
//   newSoldier                       src/lib/battlefront/soldier.js (the brain's own soldier)
//   STEP, THINK                      src/lib/battlefront/core.js (a frame of the sim, a think)
//   aiRows() → ai.json's rows        classOf(id) → classes.json's row

import { aiOf, classOf as classRow, loadRulebook } from '../../../../lib/battlefront/rulebook.js';

export { act, createBrain, think } from '../../../../lib/battlefront/ai/soldierBrain.js';
export { difficultyFor } from '../../../../lib/battlefront/ai/difficulty.js';
export { buildNav, heightAt, shields, walkable } from '../../../../lib/battlefront/nav.js';
export { newSoldier } from '../../../../lib/battlefront/soldier.js';
export { STEP, THINK } from '../../../../lib/battlefront/core.js';

export const aiRows = () => aiOf(loadRulebook());
export const classOf = (id) => classRow(loadRulebook(), id);

// A fixture world for the brain's tests (brain.test.js, fight.test.js, the
// scenario): the brain's module as it is (brainLib.js), the game's AI rows,
// and a navgrid on flat ground (or a world's own heights) round the origin,
// with whatever solids the test stands up.
//
//   flatMinds({ seesThrough, heightAt, standable, solids, at, half, difficulty })
//     → { minds, window, lib, ai }

import * as lib from '../brainLib';
import { createMinds, createNavWindow } from '../brain';

export function flatMinds({ seesThrough = null, heightAt = () => 0, standable = null, solids = null, at = [0, 0], half = undefined, difficulty = 'normal' } = {}) {
  const ai = lib.aiRows();
  const window = createNavWindow({ lib, heightAt, standable, solids, cover: ai.coverConstants, ...(half ? { half } : {}) });
  window.update(at[0], at[1]);
  const minds = createMinds({ lib, ai, difficulty, nav: () => window.nav, seesThrough });
  return { minds, window, lib, ai };
}

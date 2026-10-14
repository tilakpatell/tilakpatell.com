// A step of the map’s prepare (lib/three/gpuWork’s slices, a few ms of
// uploads and shaders each): the next frame, or, while something covers
// the whole page, the next moment the page is idle, so the map made under
// it never takes the frames of what plays over it (the opening crawl and
// the cockpit at the front door, html[data-covered]; a tour’s card in the
// middle, html[data-tour-still]). lib/three/useScene handed its scenes
// this; the world runtime hands a prepare only `alive`, so the map brings
// its own.
//
// prepFrame({ doc, idle, frame }) → Promise (the parts passed in for a test)

import { nextFrame } from '../../lib/three/gpuWork';

export const coveredIn = (doc) => Boolean(doc) && ('covered' in doc.documentElement.dataset || 'tourStill' in doc.documentElement.dataset);

// (half a second at most for an idle moment: a page that never rests still gets there)
const whenIdle = (fn) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(fn, { timeout: 500 }) : setTimeout(fn, 50));

export function prepFrame({ doc = typeof document !== 'undefined' ? document : null, idle = whenIdle, frame = nextFrame } = {}) {
  if (!coveredIn(doc)) return frame();
  return new Promise((resolve) => idle(() => resolve()));
}

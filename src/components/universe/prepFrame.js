// A step of the map’s prepare (lib/three/gpuWork’s slices, a few ms of
// uploads and shaders each): the next frame, or, while something covers
// the whole page, the next moment the page is idle, so the map made under
// it never takes the frames of what plays over it (the opening crawl and
// the cockpit at the front door, html[data-covered]; a tour’s card in the
// middle, html[data-tour-still]). lib/three/useScene handed its scenes
// this; the world runtime hands a prepare only `alive`, so the map brings
// its own. While the cockpit's launch plays over it (lib/foreground), a
// step waits for the launch to be over first, covered or not (the map is
// uncovered under the flash's rise), and looks again after its idle moment,
// in case a launch began while it waited: a texture or a shader link on the
// chip then is a held frame in the jump.
//
// Under the cover, a step also waits for a quiet moment after a press (a
// key, a click, a tap: QUIET_MS): what the visitor did there (the launch's
// Next, its Start) is drawn first, not held behind a slice of the map's on
// the chip (in software GL a click on the tour's Next waited a second for
// its paint, behind the map's calibration draws).
//
// prepFrame({ doc, idle, frame, clear, held, quiet }) → Promise (the parts passed in for a test)

import { nextFrame } from '../../lib/three/gpuWork';
import { foreground, whenClear } from '../../lib/foreground';

export const coveredIn = (doc) => Boolean(doc) && ('covered' in doc.documentElement.dataset || 'tourStill' in doc.documentElement.dataset);

// (half a second at most for an idle moment: a page that never rests still gets there)
const whenIdle = (fn) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(fn, { timeout: 500 }) : setTimeout(fn, 50));

// the last press, and the quiet after it
export const QUIET_MS = 300;
let pressed = -Infinity;
if (typeof window !== 'undefined')
  for (const type of ['pointerdown', 'keydown'])
    window.addEventListener(
      type,
      () => {
        pressed = performance.now();
      },
      { capture: true, passive: true },
    );
export const afterPress = ({ last = pressed, now = typeof performance !== 'undefined' ? performance.now() : 0, wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) } = {}) => {
  const left = last + QUIET_MS - now;
  return left > 0 ? wait(left) : Promise.resolve();
};

export function prepFrame({ doc = typeof document !== 'undefined' ? document : null, idle = whenIdle, frame = nextFrame, clear = whenClear, held = foreground, quiet = () => afterPress() } = {}) {
  const step = () =>
    clear('launch')
      .then(() => (coveredIn(doc) ? quiet().then(() => new Promise((resolve) => idle(() => resolve()))) : frame()))
      .then((v) => (held() === 'launch' ? step() : v));
  return step();
}

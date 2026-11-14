// Whether the universe map is ready to be seen. The launch (components/
// launch) keeps its full-page cover up until it is, and the cockpit's white
// holds on it a while, so a visitor never sees the map half made or its
// loading screen after the intro. Pure, as lib/shipReady is: the map
// (UniverseMap.jsx) tells it, the launch and the cockpit read it.
//
// Four states, in order:
//   'none'     no map mounted
//   'loading'  a map getting ready behind the cover (its bar: value 0…1, step)
//   'ready'    made, begun and every shader built: the cover may lift. The
//              runtime draws nothing while the page is covered, so a map
//              stops here until it is uncovered
//   'drawing'  its first frame drawn (or nothing to draw: 3D held, off or
//              failed, the flat map shows at once)
//
// mapLoading()              a map is mounted and getting ready
// mapProgress(value, step)  how far it's got (0…1) and what it's doing (worlds/loadingSteps' keys)
// mapReady()                made: may be uncovered
// mapDrawing()              drawing, or nothing to wait for
// forgetMap()               the map's gone
// mapState() → { state, value, step }
// onMapState(fn) → off      fn(mapState()) on every change
// mapMade(state) → bool     'ready' or 'drawing'
// whenMapReady(ms) → Promise<boolean>: true once no map is loading (at once
//   with none); false after `ms`

const NONE = Object.freeze({ state: 'none', value: 0, step: 'load' });

let current = NONE;
const listeners = new Set();

const set = (next) => {
  if (next.state === current.state && next.value === current.value && next.step === current.step) return;
  current = Object.freeze(next);
  for (const fn of [...listeners]) fn(current);
};

const clamp01 = (v) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

export const mapMade = (state) => state === 'ready' || state === 'drawing';

export function mapLoading() {
  // (a map loading keeps its bar)
  if (current.state === 'loading') return;
  set({ state: 'loading', value: 0, step: 'load' });
}

export function mapProgress(value, step = current.step) {
  if (current.state !== 'loading') return;
  // (the bar never goes back: worlds/loadingSteps' rule)
  set({ state: 'loading', value: Math.max(current.value, clamp01(value)), step: typeof step === 'string' ? step : current.step });
}

export function mapReady() {
  if (current.state === 'drawing') return; // (drawn already: it stays drawn)
  set({ state: 'ready', value: 1, step: current.step });
}

export function mapDrawing() {
  set({ state: 'drawing', value: 1, step: current.step });
}

export function forgetMap() {
  set(NONE);
}

export const mapState = () => current;

export function onMapState(fn) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function whenMapReady(ms) {
  const done = () => current.state !== 'loading';
  if (done()) return Promise.resolve(true);
  return new Promise((resolve) => {
    let timer = null;
    const off = onMapState(() => {
      if (!done()) return;
      off();
      clearTimeout(timer);
      resolve(true);
    });
    timer = setTimeout(() => {
      off();
      resolve(done());
    }, ms);
  });
}

// Fetches the cockpit ahead of time (three.js, the scene, the first
// vehicle's code and its crew), so the cockpit is ready when the opening
// crawl ends (App starts the code at the welcome, and the crew as the
// crawl begins). No three.js import
// here, so this costs nothing until it's asked for.

import { gpu, mode3D, resolve3D } from '../../lib/gpu';

let mod = null;
let pending = null;

// the scene module, if it has arrived
export const cockpitScene = () => mod;

// Can the cockpit be drawn here at all? (WebGL, 3D not switched off.)
export const cockpitPossible = () => typeof window !== 'undefined' && resolve3D(mode3D(), gpu());

// `crew`: the vehicle's crew too (Chewie's 4 MB, the game's light cut and
// the drivers' clips; 0.8 when he was Meshy's, and on a desktop his full cut
// comes after him, 11.5 MB more, put on as he sits): not while the welcome's
// still asking whether you want the intro at all, only once it's begun
export function preloadCockpit(first = 'falcon', { crew = true } = {}) {
  if (!mod && !pending) {
    if (!cockpitPossible()) return null;
    pending = import('./scene')
      .then((m) => {
        mod = m;
        return m;
      })
      .catch(() => {
        pending = null; // a dropped connection: try again next time
        return null;
      });
  }
  if (crew) pending?.then((m) => m?.preloadVehicle(first));
  return pending;
}

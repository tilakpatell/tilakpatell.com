import { WARS, WAR_IDS } from './sides';

// What the galaxy map draws (HoloMap.jsx), each a switch kept in this
// browser: the war's territory (each system's share of space in its
// holder's colour, the borders where they meet and the war's own links),
// its fronts (the offensives and their fleets, the systems' rings), the
// hyperspace lanes, the regions' rings and names, and the atlas's grid.
// The territory and the grid are off till asked for: the systems' rings
// say who holds what, and the panel says the square. (The key's second
// name: the map's look changed, so everyone's choices start again from it.)
export const LAYERS = ['territory', 'fronts', 'lanes', 'regions', 'grid'];
export const LAYER_LABEL = { territory: 'Territory', fronts: 'Fronts', lanes: 'Lanes', regions: 'Regions', grid: 'Grid' };
export const LAYERS_KEY = 'tp-galaxy-layers-2';
export const DEFAULT_LAYERS = Object.freeze({ territory: false, fronts: true, lanes: true, regions: true, grid: false });

export function readLayers(raw) {
  const v = raw && typeof raw === 'object' ? raw : {};
  return Object.fromEntries(LAYERS.map((id) => [id, typeof v[id] === 'boolean' ? v[id] : DEFAULT_LAYERS[id]]));
}

// the war an era's chip shows: its own war, or with every era lit, the one you fight in
export const warForEra = (era, oathWar) => WAR_IDS.find((id) => WARS[id].era === era) ?? oathWar;

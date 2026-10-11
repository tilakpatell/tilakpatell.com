import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import PUBLISHED from '../../data/galaxyAssets.json';
import CREDITS from '../../data/modelCredits.json';
import { PAINTABLE } from './shipModelsCore';
import { SHIP_MODELS } from './shipModels';

const at = (path) => new URL(`../../../public${path}`, import.meta.url);
const onSite = (path) => existsSync(at(path)) || Boolean(PUBLISHED[path.slice(1)]);

// (lane S1 of the galaxy-in-space design, decision 2: the player flies the
// game's ship; the RV stays the site owner's Meshy one, the cruiser is built)
describe('the ships you fly', () => {
  it('are the game’s X-wing and Falcon as lane V imported them, and Meshy’s RV, each in the site', () => {
    expect(SHIP_MODELS).toEqual({ xwing: '/models/galaxy/surface/xwing.glb', falcon: '/models/galaxy/surface/falcon.glb', rv: '/models/universe/rv-wings.glb' });
    for (const [kind, url] of Object.entries(SHIP_MODELS)) expect(onSite(url), kind).toBe(true);
    for (const kind of ['xwing', 'falcon']) expect(CREDITS[`surface-${kind}`]?.author, kind).toBe('EA DICE');
    // (the Sketchfab ones retired with their files)
    for (const name of ['xwing-hd', 'falcon-hd']) {
      expect(CREDITS[name], name).toBeUndefined();
      expect(existsSync(at(`/models/sketchfab/${name}.glb`)), name).toBe(false);
    }
  });

  it('paints the game’s hull materials and leaves its windows as they come', () => {
    for (const name of ['Mat_XWing_Fuselage_LOD', 'Mat_XWing_Wings_LOD', 'Mat_XWing_LandingGear_LOD']) expect(PAINTABLE.xwing.test(name), name).toBe(true);
    for (const name of ['Windows', 'Mat_XWing_decal_ca']) expect(PAINTABLE.xwing.test(name), name).toBe(false);
    for (const name of ['Main_Shader1', 'Details_Shader1']) expect(PAINTABLE.falcon.test(name), name).toBe(true);
    expect(PAINTABLE.falcon.test('Windows_Shader1')).toBe(false);
  });
});

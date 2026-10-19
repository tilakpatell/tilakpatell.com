import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import * as rules from './rules';

// rules.js before its split lent exactly these; its barrel lends the same
const FACE = ['ANCHORS', 'ARMOUR', 'BENCHES', 'BODY', 'BUILDINGS', 'CAST', 'CLERESTORY', 'COMMS', 'CORNERS', 'CRATER', 'DOOR_R', 'FLAGS', 'FLAG_H', 'GAIT', 'HERO', 'HERO_R', 'JUMP', 'LAMPS', 'LAP', 'LAWN_PROPS', 'LAWN_TREES', 'LAWN_W', 'MASTS', 'MAST_H', 'PACKS', 'PACK_R', 'PARKED_CARS', 'PARKED_JET', 'PERCHES', 'PHOTO', 'PLACES', 'PLANTERS', 'PORTAL', 'RING_R', 'RIVER_W', 'ROADS_W', 'ROAD_HALF', 'ROOF_LIGHTS', 'ROOF_PLANT', 'ROUND', 'S', 'SETTINGS', 'SETTINGS_DEFAULTS', 'SOLIDS', 'START', 'SUIT', 'SWING', 'TOUR', 'TOUR_GAP', 'TRICK', 'V', 'aimWeb', 'behindYaw', 'camRoom', 'cameraMove', 'collide', 'findPerch', 'floorAt', 'gaitFor', 'inJet', 'jumpPress', 'lapAt', 'linesFor', 'nearArmour', 'nearCast', 'nearPack', 'nearPlace', 'nearestEdge', 'newHero', 'newPhoto', 'newTour', 'outside', 'pastAnchor', 'photoView', 'placeById', 'progress', 'readLap', 'readPhoto', 'readSettings', 'recordLap', 'samplePath', 'solidById', 'stepHero', 'stepTour', 'swingArc', 'swingPose', 'throughRing', 'toWorld', 'treeHeight', 'underPortal', 'walkable'];
const PARTS = ['plan', 'bump', 'tuning', 'aim', 'air', 'hero', 'camera', 'tour', 'progress'];
const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

describe('world/rules.js, the barrel', () => {
  it('lends exactly the names rules.js had before its split', () => {
    expect(FACE).toHaveLength(91);
    expect(Object.keys(rules).sort()).toEqual(FACE);
  });

  it('is re-exports from its nine parts and nothing else', () => {
    const code = read('./rules.js').replace(/\/\/.*$/gm, '').replace(/\s+/g, ' ');
    const statements = code.split(';').map((s) => s.trim()).filter(Boolean);
    expect(statements.map((s) => s.match(/^export \{ [\w, ]+ \} from '\.\/rules\/(\w+)'$/)?.[1])).toEqual(PARTS);
  });

  it('keeps each part under 800 lines (docs/health/RULES.md, Size)', () => {
    expect(PARTS.filter((p) => read(`./rules/${p}.js`).split('\n').length >= 800)).toEqual([]);
  });
});

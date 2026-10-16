import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { createPhysics } from '../../../lib/physics/world.js';
import { addHeightfield } from '../../../lib/physics/heightfield.js';
import BODY from '../../../data/bf2017/physics/soldier.json';
import { classOf, loadRulebook } from '../../../lib/battlefront/rulebook.js';
import { newSoldier } from '../../../lib/battlefront/soldier.js';
import mode from '../../../../public/models/galaxy/bf2017/levels/hoth/ga/mode.json';
import { createPartsCollision, modeBoxes } from './collision.js';
import { matcher } from './doorsTable.js';
import { createWalker, fromPackFrame, toPackFrame } from './walk.js';

// lane P0's fixture pack: snow piles 0.9 m tall at (10, 0, 10), (20, 0, 10), (30, 0, 10) in cell 0,0
const PACK = new URL('../../../../scripts/fixtures/bf2017/physics/pack/', import.meta.url);
const fixture = JSON.parse(readFileSync(new URL('level.json', PACK), 'utf8'));
const loadBin = async (file) => {
  const b = readFileSync(new URL(file, PACK));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
};
const ORIGIN = [205, 362.3, -1540];
const pack = { ...fixture, origin: ORIGIN, yaw: 0 };
const at = (p) => [p[0] + ORIGIN[0], p[1] + ORIGIN[1], p[2] + ORIGIN[2]];
const ROW = BODY.rows[BODY.default];
const DT = 1 / 30;
const ASSAULT = classOf(loadRulebook(), 'd-orig-assault');

let physics;
beforeEach(async () => {
  physics = await createPhysics();
});

// the mode part's collision: the fixture's cell as the mode's, the middle pile one its doors move, and two walls
function parts({ boxes = [] } = {}) {
  const moved = [{ mesh: fixture.meshes[0].name, at: [20, 0, 10], kind: 'leaf', id: 'door' }];
  return createPartsCollision({ parts: { outside: { pack: { ...pack, cells: {} }, loadBin }, mode: { pack, loadBin, mode: { boxes }, match: matcher(pack, moved) } }, physics });
}

describe('the mode part’s collision', () => {
  it('reads the mode’s walls from mode.json: 104 of them, 78 for soldiers only', () => {
    expect(mode.boxes).toHaveLength(104);
    expect(mode.boxes.filter((b) => b.layer === 'character')).toHaveLength(78);
    const descs = modeBoxes(mode.boxes);
    expect(new Set(descs.map((d) => d.group))).toEqual(new Set(['barrier', 'floor']));
    expect(descs.every((d) => d.type === 'fixed')).toBe(true);
    expect(descs.filter((d) => d.colliders[0].shape === 'ball')).toHaveLength(1);
  });

  it('builds the part’s cells without what its doors move', async () => {
    const col = parts();
    await col.add('0,0', await loadBin('cells/0_0.bin'), 'near', 'mode');
    col.update(Infinity);
    // (a ball rolled east at 0.5 m along z = 10: the first pile stops it, the middle one, moved, is not there)
    const from = at([5, 0.5, 10]);
    expect(col.sweep(from, [1, 0, 0], 30, 0.15)).toBeLessThan(5.5);
    const past = at([15, 0.5, 10]);
    const d = col.sweep(past, [1, 0, 0], 30, 0.15);
    expect(d).toBeGreaterThan(12);
    col.dispose();
  });

  it('a static wall stops the camera’s sweep; a soldiers-only wall lets it through', () => {
    const col = parts({
      boxes: [
        { at: [0, 1, 5], half: [3, 1, 0.5], rotation: [0, 0, 0, 1], layer: 'character' },
        { at: [0, 1, 15], half: [3, 1, 0.5], rotation: [0, 0, 0, 1], layer: 'static' },
      ],
    });
    physics.world.step();
    expect(col.stats().walls).toBe(2);
    const d = col.sweep(at([0, 1, 0]), [0, 0, 1], 30, 0.15);
    expect(d).toBeGreaterThan(14);
    expect(d).toBeLessThan(15);
    col.dispose();
    expect(physics.world.colliders.len()).toBe(0);
  });

  it('a soldiers-only wall stops a soldier walking into it', () => {
    const g = addHeightfield(physics, { heights: new Float32Array(65 * 65), n: 65, size: 64, x: -32, z: -32 });
    const col = parts({ boxes: [{ at: [0, 1.5, 3], half: [6, 1.5, 0.25], rotation: [0, 0, 0, 1], layer: 'character' }] });
    physics.world.step();
    const s = newSoldier(ASSAULT, { id: 'p', team: 2, at: fromPackFrame(pack, [0, 0, 0]) });
    const w = createWalker({ physics, pack, row: ROW, at: s.at });
    for (let i = 0; i < 60; i++) (w.mover(s, [0, 1], DT), w.step());
    // (two seconds ahead at 3.8 m/s would be 7.6 m: held at the wall's near face, 2.75 m less the capsule's radius)
    expect(toPackFrame(pack, s.at)[2]).toBeLessThan(2.75);
    expect(toPackFrame(pack, s.at)[2]).toBeGreaterThan(1.5);
    w.dispose();
    col.dispose();
    physics.remove(g);
  });
});

import { describe, expect, it } from 'vitest';
import gryffindor from './gryffindor';
import slytherin from './slytherin';
import ravenclaw from './ravenclaw';
import hufflepuff from './hufflepuff';
import kitchens from '../kitchens';
import { FLOO, NOTICES, paintBoard } from './shared';
import { solidsOf } from '../host';

const ROOMS = { gryffindor, slytherin, ravenclaw, hufflepuff, kitchens };
const inside = (b, [x, z]) => x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1;
const blocked = (solids, [x, z], r = 0.35) => solids.some((c) => Math.hypot(x - c.at[0], z - c.at[1]) < c.r + r);

describe('the common rooms and the kitchens', () => {
  it('each a room for the host: an id, a name and a build', () => {
    for (const [id, room] of Object.entries(ROOMS)) {
      expect(room.id).toBe(id);
      expect(room.name).toMatch(/^The /);
      expect(typeof room.build).toBe('function');
    }
  });

  it('stands you inside the walls and clear of the furniture as you come in', () => {
    for (const [id, { spec }] of Object.entries(ROOMS)) {
      const at = [spec.spawn.at[0], spec.spawn.at[2]];
      expect(inside(spec.bounds, at), id).toBe(true);
      expect(blocked(solidsOf(spec.colliders), at), id).toBe(false);
    }
  });

  it('gives every house’s room its Floo, a bed and the notice board, inside the walls', () => {
    for (const id of ['gryffindor', 'slytherin', 'ravenclaw', 'hufflepuff']) {
      const { spec } = ROOMS[id];
      expect(spec.house).toBe(id);
      for (const at of [spec.floo, spec.bed, spec.boardAt]) {
        expect(at, id).toBeTruthy();
        expect(inside(spec.bounds, at), `${id} ${at}`).toBe(true);
      }
      // (a ghost on its loop, inside the room)
      for (const p of spec.ghostPath) expect(inside(spec.bounds, p), id).toBe(true);
    }
    expect(ROOMS.kitchens.spec.floo).toBeTruthy();
  });

  it('pins the week’s notices in the site’s own words, and says where the fire goes', () => {
    expect(NOTICES.length).toBeGreaterThanOrEqual(4);
    for (const n of NOTICES) {
      expect(n.title).toMatch(/^[A-Z]/);
      expect(n.text).not.toMatch(/['"]/);
    }
    expect(FLOO).toMatch(/Diagon Alley/);
    expect(typeof paintBoard).toBe('function');
  });
});

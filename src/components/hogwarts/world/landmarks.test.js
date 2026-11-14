import { describe, expect, it } from 'vitest';
import { LINES, ROAD_END, createLandmarks } from './landmarks';
import { createCastleMaterials } from './castle/materials';
import { limbPose } from './grounds/willow';
import { WILLOW } from '../rules/willow';
import { FAR, HAGRID, forestDepth, onPath, turnBack } from './grounds/forest';
import { creakEvery, onBridge, swayOf } from './grounds/bridge';
import { PITCH_AT, STANDS, seatsOf } from './grounds/pitch';
import { HUT, PADDOCK, pumpkinGeometry } from './grounds/hut';
import { STATION_AT } from './grounds/station';
import { BRIDGES } from './castle/plan';
import { PATHS } from './terrain';
import { placeById } from '../rules/places';
import { hasRoom, roomName } from '../rooms/index';
import { PITCH } from '../rules/quidditch';

describe('the Whomping Willow’s limbs', () => {
  it('are chains of bones, each from where the last ended, as long as the limb', () => {
    for (const limb of WILLOW.limbs) {
      const bones = limbPose(limb, { yaw: 0, lift: 0 }, [0, 5, 0]);
      expect(bones).toHaveLength(4);
      for (let i = 1; i < bones.length; i++) expect(bones[i].from).toEqual(bones[i - 1].to);
      expect(bones.reduce((s, b) => s + b.len, 0)).toBeCloseTo(limb.length, 6);
      // (rising, then drooping)
      expect(bones[0].dir[1]).toBeGreaterThan(0);
      expect(bones[3].dir[1]).toBeLessThan(0);
      expect(bones[3].r).toBeLessThan(bones[0].r);
    }
  });

  it('lifts as it strikes', () => {
    const rest = limbPose(WILLOW.limbs[0], { yaw: 0, lift: 0 }, [0, 5, 0]);
    const lifted = limbPose(WILLOW.limbs[0], { yaw: 0, lift: 0.5 }, [0, 5, 0]);
    expect(lifted[3].to[1]).toBeGreaterThan(rest[3].to[1]);
  });
});

describe('the forest’s edge', () => {
  it('measures how deep you are from its edge', () => {
    expect(forestDepth(...placeById('hut').at)).toBeLessThan(0);
    expect(forestDepth(...placeById('lawn').at)).toBeLessThan(0);
    expect(forestDepth(...placeById('forest').at)).toBeGreaterThan(100);
  });

  it('keeps the lantern path and the clearing open, and nowhere else deep in', () => {
    for (const [x, z] of PATHS.find((p) => p.id === 'forest').points) expect(onPath(x, z)).toBe(true);
    expect(onPath(...placeById('clearing').at)).toBe(true);
    expect(onPath(-600, -500)).toBe(false);
  });

  it('turns you about short of where the fog closes, facing out', () => {
    for (const [x, z] of [
      [-480, -280],
      [-200, -520],
    ]) {
      expect(forestDepth(x, z)).toBeGreaterThan(FAR);
      const { to, yaw } = turnBack(x, z);
      expect(forestDepth(...to)).toBeLessThanOrEqual(FAR - 13.9);
      // (the walk looks along (−sin, −cos): out is the way back over the edge)
      const look = [-Math.sin(yaw), -Math.cos(yaw)];
      expect(forestDepth(to[0] + look[0] * 10, to[1] + look[1] * 10)).toBeLessThan(forestDepth(...to));
    }
    expect(HAGRID).toMatch(/^“.+”$/);
  });
});

describe('the covered bridge', () => {
  it('sways a little in the wind, more under you, never far', () => {
    let still = 0;
    let walked = 0;
    for (let t = 0; t < 30; t += 0.1) {
      still = Math.max(still, Math.abs(swayOf(t, 0)));
      walked = Math.max(walked, Math.abs(swayOf(t, 1, 3)));
    }
    expect(still).toBeLessThan(0.004);
    expect(walked).toBeGreaterThan(still * 2);
    expect(walked).toBeLessThan(0.03);
  });

  it('creaks more often the faster you go, and not when you stand', () => {
    expect(creakEvery(0)).toBe(Infinity);
    expect(creakEvery(3)).toBeLessThan(creakEvery(1));
  });

  it('knows when you are on its deck', () => {
    const { from, to } = BRIDGES.covered;
    const mid = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2];
    expect(onBridge(mid)).toBeCloseTo(0.5, 6);
    expect(onBridge([mid[0], mid[1] - 20, mid[2]])).toBeNull();
    expect(onBridge([mid[0] + 10, mid[1], mid[2] + 10])).toBeNull();
  });
});

describe('the pitch', () => {
  it('turns the match’s long axis north and south on the lawn', () => {
    const x = [Math.cos(PITCH_AT.yaw), -Math.sin(PITCH_AT.yaw)];
    expect(Math.abs(x[1])).toBeCloseTo(1, 6);
  });

  it('seats the crowd on four tiers of each of the six stands, round the oval outside the play', () => {
    const rows = seatsOf();
    expect(STANDS).toHaveLength(6);
    expect(rows).toHaveLength(24);
    for (const r of rows) {
      const mid = [(r.from[0] + r.to[0]) / 2, (r.from[2] + r.to[2]) / 2];
      expect((mid[0] / (PITCH.length / 2)) ** 2 + (mid[1] / (PITCH.width / 2)) ** 2).toBeGreaterThan(1);
      expect(r.from[1]).toBe(r.to[1]);
      expect(r.from[1]).toBeGreaterThan(4);
    }
    expect(new Set(rows.map((r) => r.house))).toEqual(new Set(['gryffindor', 'slytherin', 'ravenclaw', 'hufflepuff', 'staff']));
  });
});

describe('Hagrid’s hut, the paddock and the station', () => {
  it('puts the hut’s door at its place, opening onto its one room, registered', () => {
    const p = placeById('hut');
    expect(Math.hypot(HUT.door.at[0] - p.at[0], HUT.door.at[1] - p.at[1])).toBeLessThan(2);
    expect(Math.hypot(HUT.door.at[0] - HUT.at[0], HUT.door.at[1] - HUT.at[1])).toBeCloseTo(HUT.r + 0.05, 0);
    expect(HUT.door.room).toBe('hut');
    expect(hasRoom('hut')).toBe(true);
    expect(roomName('hut')).toBe('Hagrid’s hut');
    expect(Math.hypot(PADDOCK.at[0] - HUT.at[0], PADDOCK.at[1] - HUT.at[1])).toBeGreaterThan(PADDOCK.r + HUT.r);
  });

  it('makes a pumpkin a metre across, ribbed, sitting on the ground', () => {
    const g = pumpkinGeometry(3);
    g.computeBoundingBox();
    expect(g.boundingBox.min.y).toBeGreaterThan(-0.05);
    expect(g.boundingBox.max.x - g.boundingBox.min.x).toBeGreaterThan(0.9);
    g.dispose();
  });

  it('lays the station’s platform at its place', () => {
    const p = placeById('station');
    expect(Math.hypot(STATION_AT.at[0] - p.at[0], STATION_AT.at[1] - p.at[1])).toBeLessThan(p.r);
    expect(Math.hypot(...STATION_AT.along)).toBeCloseTo(1, 9);
  });
});

describe('the landmarks, built', () => {
  it('build on a flat ground, answer a frame, throw you from the Willow and give the book', () => {
    const materials = createCastleMaterials({ tier: 'low' });
    const marks = createLandmarks({ materials, ground: () => 10, tier: 'low' });
    expect(marks.group.children.length).toBeGreaterThan(5);
    expect(marks.colliders.length).toBeGreaterThan(20);
    expect(marks.pitch).toMatchObject({ built: true });
    expect(marks.doors.map((d) => d.id)).toEqual(['hut']);
    // walk up to the Willow and stand: it strikes and throws you clear
    const w = placeById('willow').at;
    let thrown = null;
    for (let i = 0; i < 90 && !thrown; i++) thrown = marks.step(1 / 30, { at: [w[0] + 4, 10, w[1] + 4] }).throw;
    expect(Math.hypot(...thrown)).toBeCloseTo(6, 6);
    // a stone on its knot, then the book under its roots
    marks.knock();
    const still = marks.step(1 / 30, { at: [w[0] + 40, 10, w[1]] });
    expect(still.events).toContainEqual({ type: 'willow', frozen: true });
    const book = marks.willow.book.at;
    const near = marks.step(1 / 30, { at: [book[0], 10, book[2]] });
    expect(near.prompt).toMatchObject({ key: 'E', verb: 'Take' });
    const took = marks.step(1 / 30, { at: [book[0], 10, book[2]], act: true });
    expect(took.events).toContainEqual({ type: 'pickup', id: 'willow-book' });
    expect(took.toast).toBe(LINES.book);
    // the road’s end past the station: on up into Hogsmeade
    const road = marks.step(1 / 30, { at: [ROAD_END[0], 10, ROAD_END[1]] });
    expect(road.prompt).toMatchObject({ key: 'E', verb: 'Walk on', name: 'Hogsmeade' });
    expect(marks.step(1 / 30, { at: [ROAD_END[0], 10, ROAD_END[1]], act: true }).enter).toEqual({ room: 'hogsmeade', from: 'road' });
    marks.dispose();
    materials.dispose();
  });
});

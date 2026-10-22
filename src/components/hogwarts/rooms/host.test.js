import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ROOM_ORIGIN, createRoomHost, solidsOf } from './host';

// a room as a room module builds one: a group, a spawn, walls, a door
const roomOf = (extra = {}) => ({
  build: () => ({
    id: 'test',
    name: 'The test room',
    group: new THREE.Group(),
    spawn: { at: [1, 0, 2], yaw: 0 },
    colliders: [{ kind: 'circle', at: [3, 0], r: 1 }],
    bounds: { x0: -5, x1: 5, z0: -5, z1: 5 },
    floorAt: () => 0,
    doors: [],
    step() {},
    dispose() {},
    ...extra,
  }),
});

function hostWith(mod, outside = []) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x000000, 0.01);
  const camera = new THREE.PerspectiveCamera();
  const told = [];
  const host = createRoomHost({ rt: null, scene, camera, house: null, outside, load: async () => mod, tell: (type, data) => told.push([type, data]) });
  return { host, scene, told };
}

describe('the room host', () => {
  it('stands a room far below the grounds and hides the grounds while you’re in it', async () => {
    const shore = new THREE.Group();
    const { host, scene } = hostWith(roomOf(), [shore]);
    const room = await host.enter('test', { walk: false });
    expect(room.group.position.toArray()).toEqual(ROOM_ORIGIN);
    expect(shore.visible).toBe(false);
    expect(scene.fog).toBeNull();
    host.leave();
    expect(shore.visible).toBe(true);
    expect(scene.fog).not.toBeNull();
  });

  it('never takes a room’s own at(…) for where it stands (the staircase has one)', async () => {
    const { host } = hostWith(roomOf({ at: () => {} }));
    const room = await host.enter('test', { walk: false });
    expect(room.group.position.toArray()).toEqual(ROOM_ORIGIN);
  });

  it('stands a room with an origin in the world, keeps the grounds up round it, and reads its frame back', async () => {
    const shore = new THREE.Group();
    const origin = [94, 147, -642];
    const { host, scene } = hostWith(roomOf({ origin }), [shore]);
    const room = await host.enter('test', { walk: false });
    expect(room.group.position.toArray()).toEqual(origin);
    expect(shore.visible).toBe(true);
    expect(scene.fog).not.toBeNull();
    expect(host.frame([95, -640])).toEqual([1, 2]);
    host.leave();
    expect(shore.visible).toBe(true);
  });

  it('lays a box collider as a row of circles down its longer side', () => {
    const c = solidsOf([{ kind: 'box', at: [0, 0], w: 4, d: 1, turn: 0 }]);
    expect(c).toHaveLength(4);
    for (const s of c) expect(s.r).toBe(0.5);
    expect(Math.min(...c.map((s) => s.at[0]))).toBeCloseTo(-1.5, 5);
  });
});

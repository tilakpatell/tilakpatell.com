import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { farCut } from '../galaxy/shared/models';
import { GLB, createFleet } from './glbFleet';

// a model as GLTFLoader gives one: twice as wide as it is long, off centre
const wide = () => {
  const scene = new THREE.Group();
  const m = new THREE.Mesh(new THREE.BoxGeometry(4, 1, 2), new THREE.MeshStandardMaterial());
  m.position.set(3, 0, 1);
  scene.add(m);
  return { scene, animations: [] };
};
const settle = async () => {
  for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
};
// a built one, made 1 long in z as buildTraffic's are (`size` its box)
const built = (x, y) => () => {
  const group = new THREE.Group();
  group.add(new THREE.Mesh(new THREE.BoxGeometry(x, y, 1), new THREE.MeshStandardMaterial()));
  return { group, size: new THREE.Vector3(x, y, 1), update() {}, dispose() {} };
};
// how it's drawn: scaled by its fit, as the hunters, the wingmen and the traffic scale it (times their size)
const drawn = (made) => {
  made.group.scale.setScalar(made.fit);
  made.group.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(made.group, true).getSize(new THREE.Vector3());
};

describe('the fleet’s models, fitted to their size', () => {
  const glb = { xwing: { url: '/x.glb', nose: 0, built: true }, slave1: { url: '/s.glb', nose: 0, built: false } };

  it('fits a loaded ship by its length, nose to tail, its wings out past it', async () => {
    const fleet = createFleet({ glb, build: built(2, 0.5), load: async () => wide() });
    fleet.want(['xwing']);
    await settle();
    expect(fleet.loaded('xwing')).toBe(true);
    const made = fleet.make('xwing');
    expect(made.model).toBe(true);
    const s = drawn(made);
    expect(s.z).toBeCloseTo(1, 5);
    expect(s.x).toBeCloseTo(2, 5);
    expect(made.size.z).toBeCloseTo(1, 5); // (its box, in the units it's fitted in)
    fleet.dispose();
  });

  it('fits Slave I by its biggest side: it flies upright, its length standing up', async () => {
    const fleet = createFleet({ glb, load: async () => wide() });
    fleet.want(['slave1']);
    await settle();
    const s = drawn(fleet.make('slave1'));
    expect(Math.max(s.x, s.y, s.z)).toBeCloseTo(1, 5);
    fleet.dispose();
  });

  it('fits a built one the same way, so a ship keeps its length when its model comes', () => {
    const fleet = createFleet({ glb, build: built(2, 0.5), load: () => new Promise(() => {}) });
    const ship = fleet.make('xwing');
    expect(ship.fit).toBeCloseTo(1);
    expect(drawn(ship).z).toBeCloseTo(1, 5);
    const meeseeks = createFleet({ glb: {}, build: built(0.4, 2.4) }).make('meeseeks'); // (as tall as his size)
    expect(meeseeks.fit).toBeCloseTo(1 / 2.4);
    fleet.dispose();
  });

  it('fits one made ahead the same way', () => {
    const fleet = createFleet({ glb, build: built(2, 0.5), load: () => new Promise(() => {}) });
    fleet.stock('tie', built(2, 3)());
    const made = fleet.make('tie');
    expect(made.fit).toBeCloseTo(1);
    fleet.dispose();
  });
});

// (lane C2 of the Battlefront-by-default design: the map's Star Wars fighters
// are the game's, as the galaxy has them, never a gen3d or Meshy model)
describe('the Star Wars fleet on the map', () => {
  it('flies the game’s fighters in the galaxy’s far copies, lent through its face', () => {
    for (const kind of ['interceptor', 'slave1', 'ywing', 'awing', 'tiebomber']) {
      expect(GLB[kind], kind).toEqual({ ...farCut(kind), built: kind !== 'slave1' });
      expect(GLB[kind].url, kind).toBe(`/models/galaxy/lod/${kind}.glb`);
      expect(existsSync(new URL(`../../../public${GLB[kind].url}`, import.meta.url)), kind).toBe(true);
    }
    // (the X-wing keeps the game's light cut; the Star Destroyer and the corvette stay the map's own)
    expect(GLB.xwing.url).toBe('/models/galaxy/surface/xwing.lod1.glb');
    expect([GLB.destroyer.url, GLB.corvette.url]).toEqual(['/models/universe/star-destroyer.glb', '/models/universe/cr90.glb']);
    for (const row of Object.values(GLB)) expect(row.url).not.toMatch(/gen3d|universe\/slave1/);
  });
});

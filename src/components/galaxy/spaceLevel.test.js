import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { hulled, litWindows } from './spaceLevel';

describe('spaceLevel', () => {
  it('gives a level’s own bare hull the game’s material of its kind, asking once a mesh, and leaves the rest', async () => {
    const group = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ name: 'M_Hull_01' }));
    const rock = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ name: 'Rock' }));
    group.add(hull, rock);
    const game = new THREE.MeshStandardMaterial({ name: 'M_Hull_01|game' });
    const asked = [];
    const stub = (name) => (asked.push(name), name === 'M_Hull_01' ? Promise.resolve(game) : null);
    hulled(group, { hull: stub });
    hulled(group, { hull: stub });
    await Promise.resolve();
    await Promise.resolve();
    expect(asked).toEqual(['M_Hull_01', 'Rock']);
    expect(hull.material).toBe(game);
    expect(rock.material.name).toBe('Rock');
  });

  it('lights the Star Destroyer’s map-less windows as the war’s are, one material for the level, and leaves the other ships’ windows', () => {
    const group = new THREE.Group();
    const isd = () => new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ name: 'M_Windows' }));
    const a = isd();
    const b = isd();
    const venator = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ name: 'VenatorStarDestroyer_Window_M' }));
    group.add(a, b, venator);
    const made = litWindows(group);
    expect(a.material).toBe(made.windows);
    expect(b.material).toBe(made.windows);
    expect(made.windows.userData.gameHull).toBe(true);
    expect(made.windows.emissiveIntensity).toBeGreaterThan(0);
    expect(venator.material.name).toBe('VenatorStarDestroyer_Window_M');
    // (again, as the level's draws come in: the same material)
    const c = isd();
    group.add(c);
    litWindows(group, made);
    expect(c.material).toBe(made.windows);
  });
});

import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { capMetal, hulled, litWindows } from './spaceLevel';

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

  it('lights the Star Destroyer’s map-less windows as the war’s are, one material for the level, and leaves the other ships’ windows', async () => {
    const group = new THREE.Group();
    const isd = () => new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ name: 'M_Windows' }));
    const a = isd();
    const b = isd();
    const venator = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ name: 'VenatorStarDestroyer_Window_M' }));
    group.add(a, b, venator);
    const height = new THREE.Texture();
    const asked = [];
    const made = litWindows(group, {}, { panes: () => (asked.push(1), Promise.resolve(height)) });
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
    // (the game's heightmap of the panes asked for once, and on them when it comes)
    await Promise.resolve();
    expect(asked).toHaveLength(1);
    expect(made.windows.userData.panes.height.value).toBe(height);
  });

  it('keeps the level’s own capitals’ mapped metal to a capital’s, and leaves a plain material be', () => {
    const group = new THREE.Group();
    const panel = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ metalness: 1, metalnessMap: new THREE.Texture() }));
    const plain = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ metalness: 0.9 }));
    group.add(panel, plain);
    capMetal(group);
    expect(panel.material.metalness).toBe(0.2);
    expect(plain.material.metalness).toBe(0.9);
  });
});

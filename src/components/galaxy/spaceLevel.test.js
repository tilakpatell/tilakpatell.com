import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { hulled } from './spaceLevel';

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
});
